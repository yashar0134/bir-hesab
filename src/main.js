const path = require("node:path");
const fs = require("node:fs");
const XLSX = require("xlsx");
const { app, BrowserWindow, ipcMain, shell, dialog, Notification } = require("electron");
const { initializeDatabase } = require("./database/connection.js");
const { registerServiceHandlers } = require("./modules/services.js");
const { registerProjectHandlers } = require("./modules/projects.js");
const { registerPartnerHandlers } = require("./modules/partners.js");
const { registerSettlementHandlers } = require("./modules/settlements.js");
const { registerReminderHandlers } = require("./modules/reminders.js");
const { registerExpenseHandlers } = require("./modules/expenses.js");
const { registerCashboxHandlers } = require("./modules/cashbox.js");
const { registerUpdaterHandlers } = require("./modules/updater.js");
const { registerAssistantHandlers } = require("./modules/assistant.js");

let mainWindow;
let db;
let calendarEventsDatasetCache = null;

const AUTO_BACKUP_SETTINGS_FILE = "auto-backup-settings.json";
const DEFAULT_AUTO_BACKUP_SETTINGS = Object.freeze({
  enabled: true,
  schedule: "daily",
  keepLast: 14,
  lastBackupAt: ""
});

function getDatabasePath() {
  return path.join(app.getPath("userData"), "bir-hesab.db");
}

function getBackupsDirectoryPath() {
  return path.join(app.getPath("userData"), "backups");
}

function getAutoBackupSettingsPath() {
  return path.join(app.getPath("userData"), AUTO_BACKUP_SETTINGS_FILE);
}

function getBackupFileName() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `bir-hesab-backup-${yyyy}${mm}${dd}-${hh}${min}.db`;
}

function unlinkIfExists(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sanitizeAutoBackupSettings(raw = {}) {
  const enabled =
    typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_AUTO_BACKUP_SETTINGS.enabled;

  const schedule = raw.schedule === "weekly" ? "weekly" : "daily";
  const keepRaw = Number(raw.keepLast);
  const keepLast = Number.isFinite(keepRaw)
    ? Math.min(120, Math.max(1, Math.trunc(keepRaw)))
    : DEFAULT_AUTO_BACKUP_SETTINGS.keepLast;

  let lastBackupAt = "";
  if (typeof raw.lastBackupAt === "string" && raw.lastBackupAt.trim()) {
    const parsed = Date.parse(raw.lastBackupAt);
    if (!Number.isNaN(parsed)) {
      lastBackupAt = new Date(parsed).toISOString();
    }
  }

  return {
    enabled,
    schedule,
    keepLast,
    lastBackupAt
  };
}

function loadAutoBackupSettings() {
  const filePath = getAutoBackupSettingsPath();
  const fallback = { ...DEFAULT_AUTO_BACKUP_SETTINGS };

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), "utf8");
    return fallback;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const normalized = sanitizeAutoBackupSettings(raw);
    fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2), "utf8");
    return normalized;
  } catch {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), "utf8");
    return fallback;
  }
}

function saveAutoBackupSettings(settings) {
  const normalized = sanitizeAutoBackupSettings(settings);
  const filePath = getAutoBackupSettingsPath();
  fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2), "utf8");
  return normalized;
}

function getAutoBackupFileName(now = new Date()) {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `bir-hesab-auto-${yyyy}${mm}${dd}-${hh}${min}${ss}.db`;
}

function createDatabaseBackup(targetPath) {
  db.pragma("wal_checkpoint(TRUNCATE)");
  fs.copyFileSync(getDatabasePath(), targetPath);
}

function listAutoBackups(limit = 30) {
  const backupsDir = getBackupsDirectoryPath();
  if (!fs.existsSync(backupsDir)) {
    return [];
  }

  return fs
    .readdirSync(backupsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".db"))
    .map((entry) => {
      const filePath = path.join(backupsDir, entry.name);
      const stat = fs.statSync(filePath);
      return {
        name: entry.name,
        path: filePath,
        sizeBytes: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        modifiedAtMs: stat.mtimeMs
      };
    })
    .sort((a, b) => b.modifiedAtMs - a.modifiedAtMs)
    .slice(0, Math.max(1, Number(limit) || 30))
    .map(({ modifiedAtMs, ...item }) => item);
}

function pruneAutoBackups(keepLast) {
  const keep = Math.min(120, Math.max(1, Math.trunc(Number(keepLast) || 1)));
  const allBackups = listAutoBackups(2000);
  allBackups.slice(keep).forEach((file) => unlinkIfExists(file.path));
}

function isAutoBackupDue(settings) {
  if (!settings.enabled) return false;
  if (!settings.lastBackupAt) return true;

  const lastTime = Date.parse(settings.lastBackupAt);
  if (Number.isNaN(lastTime)) return true;

  const intervalMs =
    settings.schedule === "weekly"
      ? 7 * 24 * 60 * 60 * 1000
      : 24 * 60 * 60 * 1000;

  return Date.now() - lastTime >= intervalMs;
}

function runAutoBackupNow() {
  const settings = loadAutoBackupSettings();
  if (!settings.enabled) {
    return {
      skipped: true,
      reason: "disabled",
      settings,
      recentBackups: listAutoBackups(10)
    };
  }

  const now = new Date();
  ensureDirectoryExists(getBackupsDirectoryPath());
  const targetPath = path.join(getBackupsDirectoryPath(), getAutoBackupFileName(now));
  createDatabaseBackup(targetPath);

  const updatedSettings = saveAutoBackupSettings({
    ...settings,
    lastBackupAt: now.toISOString()
  });

  pruneAutoBackups(updatedSettings.keepLast);

  return {
    skipped: false,
    filePath: targetPath,
    settings: updatedSettings,
    recentBackups: listAutoBackups(10)
  };
}

function runScheduledAutoBackupIfDue() {
  try {
    const settings = loadAutoBackupSettings();
    if (!isAutoBackupDue(settings)) {
      return;
    }
    runAutoBackupNow();
  } catch (error) {
    console.error("Auto backup failed:", error);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1120,
    minHeight: 720,
    title: "Bir Hesab",
    icon: path.join(__dirname, "..", "assets", "icons", "app.ico"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, "ui", "index.html"));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file://")) {
      event.preventDefault();
    }
  });
}

function registerDataHandlers() {
  ipcMain.handle("system:backup:settings:get", () => {
    const settings = loadAutoBackupSettings();
    return {
      settings,
      dueNow: isAutoBackupDue(settings),
      recentBackups: listAutoBackups(10)
    };
  });

  ipcMain.handle("system:backup:settings:update", (_, payload = {}) => {
    const current = loadAutoBackupSettings();
    const next = saveAutoBackupSettings({
      ...current,
      enabled:
        typeof payload.enabled === "boolean" ? payload.enabled : current.enabled,
      schedule: payload.schedule ?? current.schedule,
      keepLast:
        payload.keepLast === undefined ? current.keepLast : payload.keepLast,
      lastBackupAt: current.lastBackupAt
    });

    pruneAutoBackups(next.keepLast);

    return {
      settings: next,
      dueNow: isAutoBackupDue(next),
      recentBackups: listAutoBackups(10)
    };
  });

  ipcMain.handle("system:backup:auto:run", () => {
    return runAutoBackupNow();
  });

  ipcMain.handle("system:backup:create", async () => {
    const saveResult = await dialog.showSaveDialog(mainWindow, {
      title: "ذخیره فایل پشتیبان",
      defaultPath: path.join(app.getPath("documents"), getBackupFileName()),
      filters: [
        { name: "SQLite Database", extensions: ["db", "sqlite", "sqlite3"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });

    if (saveResult.canceled || !saveResult.filePath) {
      return { canceled: true };
    }

    createDatabaseBackup(saveResult.filePath);

    return {
      canceled: false,
      filePath: saveResult.filePath
    };
  });

  ipcMain.handle("system:backup:restore", async () => {
    const openResult = await dialog.showOpenDialog(mainWindow, {
      title: "انتخاب فایل پشتیبان",
      filters: [{ name: "SQLite Database", extensions: ["db", "sqlite", "sqlite3"] }],
      properties: ["openFile"]
    });

    if (openResult.canceled || !openResult.filePaths?.length) {
      return { canceled: true };
    }

    const backupPath = openResult.filePaths[0];
    const dbPath = getDatabasePath();

    if (path.resolve(backupPath) === path.resolve(dbPath)) {
      throw new Error("فایل انتخابی همان دیتابیس فعلی است.");
    }

    const confirmResult = await dialog.showMessageBox(mainWindow, {
      type: "warning",
      title: "بازیابی پشتیبان",
      message:
        "با بازیابی پشتیبان، داده‌های فعلی جایگزین می‌شوند. بعد از تایید، برنامه ری‌استارت می‌شود.",
      buttons: ["ادامه", "لغو"],
      defaultId: 1,
      cancelId: 1,
      noLink: true
    });

    if (confirmResult.response !== 0) {
      return { canceled: true };
    }

    if (db) {
      db.close();
    }

    unlinkIfExists(dbPath);
    unlinkIfExists(`${dbPath}-wal`);
    unlinkIfExists(`${dbPath}-shm`);
    fs.copyFileSync(backupPath, dbPath);

    app.relaunch();
    app.exit(0);
    return { canceled: false, restarting: true };
  });
}

function getCalendarEventsDataset() {
  if (calendarEventsDatasetCache) {
    return calendarEventsDatasetCache;
  }

  const candidatePaths = [
    path.join(app.getAppPath(), "src", "data", "calendar-events-1404-1405.json"),
    path.join(__dirname, "data", "calendar-events-1404-1405.json")
  ];

  for (const filePath of candidatePaths) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") continue;
      calendarEventsDatasetCache = parsed;
      return calendarEventsDatasetCache;
    } catch {
      // Continue to next candidate path.
    }
  }

  calendarEventsDatasetCache = { days: {} };
  return calendarEventsDatasetCache;
}

function registerCalendarEventHandlers() {
  ipcMain.handle("calendar:events:dataset", () => getCalendarEventsDataset());
}

function registerNotificationHandlers() {
  ipcMain.handle("notifications:windows:show", (_, payload = {}) => {
    const title = String(payload.title || "یادآور بیر حساب").slice(0, 120);
    const body = String(payload.body || "").slice(0, 600);

    if (!Notification.isSupported()) {
      return { ok: true, sent: false };
    }

    const notice = new Notification({
      title,
      body,
      silent: false
    });
    notice.on("click", () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    });
    notice.show();
    return { ok: true, sent: true };
  });
}

function registerReportHandlers() {
  ipcMain.handle("reports:business", () => {
    const totals = db
      .prepare(
        `
        SELECT
          (SELECT COALESCE(SUM(amount), 0) FROM cashbox WHERE entry_type = 'in') AS totalIncome,
          (SELECT COALESCE(SUM(amount), 0) FROM cashbox WHERE entry_type = 'out') AS totalOutcome,
          (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE scope IN ('business', 'shared')) AS totalExpenses,
          (SELECT COUNT(*) FROM projects) AS totalProjects
      `
      )
      .get();

    const monthly = db
      .prepare(
        `
        SELECT substr(entry_date, 1, 7) AS monthKey,
               SUM(CASE WHEN entry_type = 'in' THEN amount ELSE 0 END) AS income,
               SUM(CASE WHEN entry_type = 'out' THEN amount ELSE 0 END) AS outcome
        FROM cashbox
        GROUP BY monthKey
        ORDER BY monthKey DESC
        LIMIT 6
      `
      )
      .all();

    const yearly = db
      .prepare(
        `
        SELECT substr(entry_date, 1, 4) AS yearKey,
               SUM(CASE WHEN entry_type = 'in' THEN amount ELSE 0 END) AS income,
               SUM(CASE WHEN entry_type = 'out' THEN amount ELSE 0 END) AS outcome
        FROM cashbox
        GROUP BY yearKey
        ORDER BY yearKey DESC
      `
      )
      .all();

    return { totals, monthly, yearly };
  });

  const getProjectProfitReport = () => {
    const projectRows = db
      .prepare(
        `
        WITH client_by_project AS (
          SELECT project_id, SUM(amount) AS clientReceived
          FROM settlements
          WHERE settlement_type = 'client'
          GROUP BY project_id
        ),
        partner_paid_by_project AS (
          SELECT project_id, SUM(amount) AS partnerPaid
          FROM settlements
          WHERE settlement_type = 'partner'
          GROUP BY project_id
        ),
        terms_due_by_project AS (
          SELECT
            t.project_id AS projectId,
            SUM(
              CASE
                WHEN t.payment_model = 'percent'
                  THEN COALESCE(c.clientReceived, 0) * t.percent_value / 100.0
                ELSE t.salary_amount
              END
            ) AS partnerDue
          FROM partner_project_terms t
          LEFT JOIN client_by_project c ON c.project_id = t.project_id
          GROUP BY t.project_id
        )
        SELECT
          p.id AS projectId,
          p.title AS projectTitle,
          p.client_name AS clientName,
          p.status,
          COALESCE(c.clientReceived, 0) AS clientReceived,
          COALESCE(d.partnerDue, 0) AS partnerDue,
          COALESCE(pp.partnerPaid, 0) AS partnerPaid,
          COALESCE(d.partnerDue, 0) - COALESCE(pp.partnerPaid, 0) AS partnerRemaining,
          COALESCE(c.clientReceived, 0) - COALESCE(d.partnerDue, 0) AS expectedNetProfit,
          COALESCE(c.clientReceived, 0) - COALESCE(pp.partnerPaid, 0) AS realizedNetProfit
        FROM projects p
        LEFT JOIN client_by_project c ON c.project_id = p.id
        LEFT JOIN terms_due_by_project d ON d.projectId = p.id
        LEFT JOIN partner_paid_by_project pp ON pp.project_id = p.id
        ORDER BY p.id DESC
      `
      )
      .all();

    const partnerRows = db
      .prepare(
        `
        WITH client_by_project AS (
          SELECT project_id, SUM(amount) AS clientReceived
          FROM settlements
          WHERE settlement_type = 'client'
          GROUP BY project_id
        ),
        term_due_totals AS (
          SELECT
            t.partner_id AS partnerId,
            COUNT(DISTINCT t.project_id) AS projectsCount,
            SUM(
              CASE
                WHEN t.payment_model = 'percent'
                  THEN COALESCE(c.clientReceived, 0) * t.percent_value / 100.0
                ELSE t.salary_amount
              END
            ) AS dueAmount
          FROM partner_project_terms t
          LEFT JOIN client_by_project c ON c.project_id = t.project_id
          GROUP BY t.partner_id
        ),
        partner_paid_totals AS (
          SELECT related_id AS partnerId, SUM(amount) AS paidAmount
          FROM settlements
          WHERE settlement_type = 'partner' AND related_id IS NOT NULL
          GROUP BY related_id
        )
        SELECT
          p.id AS partnerId,
          p.full_name AS partnerName,
          COALESCE(td.projectsCount, 0) AS projectsCount,
          COALESCE(td.dueAmount, 0) AS dueAmount,
          COALESCE(pp.paidAmount, 0) AS paidAmount,
          COALESCE(td.dueAmount, 0) - COALESCE(pp.paidAmount, 0) AS remainingAmount
        FROM partners p
        LEFT JOIN term_due_totals td ON td.partnerId = p.id
        LEFT JOIN partner_paid_totals pp ON pp.partnerId = p.id
        ORDER BY remainingAmount DESC, p.id DESC
      `
      )
      .all();

    const totals = projectRows.reduce(
      (acc, row) => {
        acc.totalClientReceived += Number(row.clientReceived || 0);
        acc.totalPartnerDue += Number(row.partnerDue || 0);
        acc.totalPartnerPaid += Number(row.partnerPaid || 0);
        acc.totalExpectedNetProfit += Number(row.expectedNetProfit || 0);
        acc.totalRealizedNetProfit += Number(row.realizedNetProfit || 0);
        return acc;
      },
      {
        totalClientReceived: 0,
        totalPartnerDue: 0,
        totalPartnerPaid: 0,
        totalExpectedNetProfit: 0,
        totalRealizedNetProfit: 0
      }
    );

    return {
      totals,
      projects: projectRows,
      partners: partnerRows
    };
  };

  ipcMain.handle("reports:project-profit", () => {
    return getProjectProfitReport();
  });

  ipcMain.handle("reports:export:excel", async (_, payload) => {
    const defaultName = "birino-report.xlsx";
    const saveResult = await dialog.showSaveDialog(mainWindow, {
      title: "ذخیره گزارش Excel",
      defaultPath: defaultName,
      filters: [{ name: "Excel", extensions: ["xlsx"] }]
    });

    if (saveResult.canceled || !saveResult.filePath) return { canceled: true };

    const workbook = XLSX.utils.book_new();

    const metricMap = {
            totalIncome: "درآمد کل",
            totalOutcome: "خروجی کل",
            totalExpenses: "هزینه کسب‌وکار",
            totalProjects: "تعداد پروژه"
          };

    const totalsRows = Object.entries(payload.report.totals || {}).map(([key, value]) => ({
      "شاخص": metricMap[key] || key,
      "مقدار": Number(value || 0)
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(totalsRows), "خلاصه");

    if (Array.isArray(payload.report.monthly)) {
      const monthlyRows = payload.report.monthly.map((row) => ({
        "ماه": row.monthKey,
        "ورودی": Number(row.income || 0),
        "خروجی": Number(row.outcome || 0)
      }));
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(monthlyRows),
        "ماهانه"
      );
    }
    if (Array.isArray(payload.report.yearly)) {
      const yearlyRows = payload.report.yearly.map((row) => ({
        "سال": row.yearKey,
        "ورودی": Number(row.income || 0),
        "خروجی": Number(row.outcome || 0)
      }));
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(yearlyRows),
        "سالانه"
      );
    }
    if (Array.isArray(payload.report.byUser) && payload.report.byUser.length) {
      const byUserRows = payload.report.byUser.map((row) => ({
        "کاربر": row.userName,
        "درآمد": Number(row.income || 0),
        "هزینه": Number(row.expense || 0)
      }));
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(byUserRows),
        "کاربران"
      );
    }

    XLSX.writeFile(workbook, saveResult.filePath);
    return { canceled: false, filePath: saveResult.filePath };
  });

  ipcMain.handle("reports:export:pdf", async (_, payload) => {
    const defaultName = "birino-report.pdf";
    const saveResult = await dialog.showSaveDialog(mainWindow, {
      title: "ذخیره گزارش PDF",
      defaultPath: defaultName,
      filters: [{ name: "PDF", extensions: ["pdf"] }]
    });

    if (saveResult.canceled || !saveResult.filePath) return { canceled: true };

    const totalsLabelMap = {
            totalIncome: "درآمد کل",
            totalOutcome: "خروجی کل",
            totalExpenses: "هزینه کسب‌وکار",
            totalProjects: "تعداد پروژه"
          };

    const toRows = (arr, keys) =>
      (arr || [])
        .map(
          (row) =>
            `<tr>${keys
              .map((key) => `<td>${String(row[key] ?? "")}</td>`)
              .join("")}</tr>`
        )
        .join("");
    const totalsRows = Object.entries(payload.report.totals || {})
      .map(([k, v]) => `<tr><td>${totalsLabelMap[k] || k}</td><td>${String(v ?? 0)}</td></tr>`)
      .join("");

    const monthlyKeys = ["monthKey", "income", "outcome"];
    const yearlyKeys = ["yearKey", "income", "outcome"];

    const html = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: Tahoma, sans-serif; padding: 24px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: right; }
    h2, h3 { margin: 12px 0; }
  </style>
</head>
<body>
  <h2>گزارش بیرینو</h2>
  <h3>خلاصه</h3>
  <table><tbody>${totalsRows}</tbody></table>
  <h3>ماهانه</h3>
  <table><tbody>${toRows(payload.report.monthly, monthlyKeys)}</tbody></table>
  <h3>سالانه</h3>
  <table><tbody>${toRows(payload.report.yearly, yearlyKeys)}</tbody></table>
</body>
</html>`;

    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
    });
    await printWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
    );
    const pdfBuffer = await printWindow.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true
    });
    fs.writeFileSync(saveResult.filePath, pdfBuffer);
    printWindow.close();

    return { canceled: false, filePath: saveResult.filePath };
  });

  ipcMain.handle("reports:project-profit:export:excel", async () => {
    const report = getProjectProfitReport();
    const saveResult = await dialog.showSaveDialog(mainWindow, {
      title: "ذخیره گزارش سود پروژه/همکار (Excel)",
      defaultPath: "birino-project-profit-report.xlsx",
      filters: [{ name: "Excel", extensions: ["xlsx"] }]
    });

    if (saveResult.canceled || !saveResult.filePath) return { canceled: true };

    const workbook = XLSX.utils.book_new();

    const totalsRows = [
      { "شاخص": "دریافتی کل از کارفرما", "مقدار": Number(report.totals.totalClientReceived || 0) },
      { "شاخص": "قابل پرداخت کل به همکار", "مقدار": Number(report.totals.totalPartnerDue || 0) },
      { "شاخص": "پرداخت‌شده کل به همکار", "مقدار": Number(report.totals.totalPartnerPaid || 0) },
      { "شاخص": "سود خالص انتظاری", "مقدار": Number(report.totals.totalExpectedNetProfit || 0) },
      { "شاخص": "سود خالص تحقق‌یافته", "مقدار": Number(report.totals.totalRealizedNetProfit || 0) }
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(totalsRows), "خلاصه سود");

    const projectRows = (report.projects || []).map((row) => ({
      "شناسه پروژه": Number(row.projectId || 0),
      "پروژه": row.projectTitle || "",
      "کارفرما": row.clientName || "",
      "وضعیت": row.status || "",
      "دریافتی از کارفرما": Number(row.clientReceived || 0),
      "قابل پرداخت به همکار": Number(row.partnerDue || 0),
      "پرداخت‌شده به همکار": Number(row.partnerPaid || 0),
      "مانده همکار": Number(row.partnerRemaining || 0),
      "سود خالص انتظاری": Number(row.expectedNetProfit || 0),
      "سود خالص تحقق‌یافته": Number(row.realizedNetProfit || 0)
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(projectRows), "پروژه‌ها");

    const partnerRows = (report.partners || []).map((row) => ({
      "شناسه همکار": Number(row.partnerId || 0),
      "همکار": row.partnerName || "",
      "تعداد پروژه": Number(row.projectsCount || 0),
      "قابل پرداخت": Number(row.dueAmount || 0),
      "پرداخت‌شده": Number(row.paidAmount || 0),
      "مانده": Number(row.remainingAmount || 0)
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(partnerRows), "همکاران");

    XLSX.writeFile(workbook, saveResult.filePath);
    return { canceled: false, filePath: saveResult.filePath };
  });

  ipcMain.handle("reports:project-profit:export:pdf", async () => {
    const report = getProjectProfitReport();
    const saveResult = await dialog.showSaveDialog(mainWindow, {
      title: "ذخیره گزارش سود پروژه/همکار (PDF)",
      defaultPath: "birino-project-profit-report.pdf",
      filters: [{ name: "PDF", extensions: ["pdf"] }]
    });

    if (saveResult.canceled || !saveResult.filePath) return { canceled: true };

    const totalsRows = [
      ["دریافتی کل از کارفرما", report.totals.totalClientReceived],
      ["قابل پرداخت کل به همکار", report.totals.totalPartnerDue],
      ["پرداخت‌شده کل به همکار", report.totals.totalPartnerPaid],
      ["سود خالص انتظاری", report.totals.totalExpectedNetProfit],
      ["سود خالص تحقق‌یافته", report.totals.totalRealizedNetProfit]
    ]
      .map(([label, value]) => `<tr><td>${label}</td><td>${String(value ?? 0)}</td></tr>`)
      .join("");

    const projectRows = (report.projects || [])
      .map(
        (row) => `
        <tr>
          <td>${String(row.projectTitle || "-")}</td>
          <td>${String(row.clientName || "-")}</td>
          <td>${String(row.clientReceived ?? 0)}</td>
          <td>${String(row.partnerDue ?? 0)}</td>
          <td>${String(row.partnerPaid ?? 0)}</td>
          <td>${String(row.expectedNetProfit ?? 0)}</td>
          <td>${String(row.realizedNetProfit ?? 0)}</td>
        </tr>
      `
      )
      .join("");

    const partnerRows = (report.partners || [])
      .map(
        (row) => `
        <tr>
          <td>${String(row.partnerName || "-")}</td>
          <td>${String(row.projectsCount ?? 0)}</td>
          <td>${String(row.dueAmount ?? 0)}</td>
          <td>${String(row.paidAmount ?? 0)}</td>
          <td>${String(row.remainingAmount ?? 0)}</td>
        </tr>
      `
      )
      .join("");

    const html = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: Tahoma, sans-serif; padding: 24px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: right; }
    h2, h3 { margin: 12px 0; }
  </style>
</head>
<body>
  <h2>گزارش سود پروژه/همکار بیرینو</h2>
  <h3>خلاصه</h3>
  <table><tbody>${totalsRows}</tbody></table>
  <h3>پروژه‌ها</h3>
  <table>
    <thead>
      <tr>
        <th>پروژه</th><th>کارفرما</th><th>دریافتی</th><th>قابل پرداخت</th><th>پرداخت‌شده</th><th>سود انتظاری</th><th>سود تحقق‌یافته</th>
      </tr>
    </thead>
    <tbody>${projectRows}</tbody>
  </table>
  <h3>همکاران</h3>
  <table>
    <thead>
      <tr>
        <th>همکار</th><th>تعداد پروژه</th><th>قابل پرداخت</th><th>پرداخت‌شده</th><th>مانده</th>
      </tr>
    </thead>
    <tbody>${partnerRows}</tbody>
  </table>
</body>
</html>`;

    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
    });
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdfBuffer = await printWindow.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true
    });
    fs.writeFileSync(saveResult.filePath, pdfBuffer);
    printWindow.close();

    return { canceled: false, filePath: saveResult.filePath };
  });
}

process.on("unhandledRejection", (error) => {
  // Keep crashes explicit in production logs.
  console.error("Unhandled promise rejection:", error);
});

app
  .whenReady()
  .then(() => {
    db = initializeDatabase(app);
    loadAutoBackupSettings();
    runScheduledAutoBackupIfDue();

    registerServiceHandlers(ipcMain, db);
    registerProjectHandlers(ipcMain, db);
    registerPartnerHandlers(ipcMain, db);
    registerSettlementHandlers(ipcMain, db);
    registerReminderHandlers(ipcMain, db);
    registerExpenseHandlers(ipcMain, db);
    registerCashboxHandlers(ipcMain, db);
    registerAssistantHandlers(ipcMain, db, app);
    registerReportHandlers();
    registerDataHandlers();
    registerCalendarEventHandlers();
    registerNotificationHandlers();

    createWindow();
    registerUpdaterHandlers(ipcMain, () => mainWindow, app);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  })
  .catch((error) => {
    console.error("Failed to start Bir Hesab:", error);
    app.quit();
  });

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
