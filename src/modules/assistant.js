const fs = require("node:fs");
const path = require("node:path");

const SETTINGS_FILE_NAME = "assistant-settings.json";
const DEFAULT_MODEL = "gemini-2.0-flash";
const MAX_CHAT_MESSAGES = 24;
const MAX_PENDING_ACTIONS = 20;
const MAX_EXECUTION_ACTIONS = 30;

const SUPPORTED_ACTION_TYPES = new Set([
  "create_settlement",
  "create_expense",
  "create_cashbox",
  "create_reminder"
]);

function normalizeDigits(value) {
  return String(value || "")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

function safeString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function toId(value) {
  const num = Number(normalizeDigits(value));
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.trunc(num);
}

function parseAmount(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.abs(value);
  }
  const normalized = normalizeDigits(value).replace(/,/g, "");
  const compact = normalized.replace(/[^\d.-]/g, "");
  const num = Number(compact);
  if (!Number.isFinite(num)) return 0;
  return Math.abs(num);
}

function sanitizeModel(value) {
  const model = safeString(value, DEFAULT_MODEL).trim();
  if (!model) return DEFAULT_MODEL;
  const compact = model.replace(/\s+/g, "");
  if (!compact) return DEFAULT_MODEL;
  return compact.slice(0, 80);
}

function getTodayJalaliDate() {
  const fmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tehran"
  });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}/${m}/${d}`;
}

function toCanonicalJalaliDate(value, fallback = "") {
  const raw = normalizeDigits(value).trim();
  if (!raw) return fallback;

  const slashForm = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (slashForm) {
    const y = Number(slashForm[1]);
    const m = Number(slashForm[2]);
    const d = Number(slashForm[3]);
    if (y >= 1200 && y <= 1600 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}/${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`;
    }
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const fmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Tehran"
    });
    const parts = fmt.formatToParts(parsed);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (y && m && d) {
      return `${y}/${m}/${d}`;
    }
  }

  return fallback;
}

function sanitizeReminderTime(value) {
  const raw = normalizeDigits(value).trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "09:00";
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return "09:00";
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return "09:00";
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function sanitizeRepeatType(value) {
  const v = safeString(value).trim().toLowerCase();
  if (v === "daily" || v === "weekly" || v === "monthly") return v;
  return "none";
}

function sanitizeSettlementType(value) {
  const v = safeString(value).trim().toLowerCase();
  if (v === "partner") return "partner";
  if (v === "client") return "client";
  if (v === "personal") return "personal";
  if (v.includes("همکار")) return "partner";
  if (v.includes("کارفرما")) return "client";
  return "personal";
}

function sanitizePaymentMethod(value) {
  const v = safeString(value).trim().toLowerCase();
  if (v === "card" || v === "cart" || v.includes("کارت")) return "card";
  if (v === "bank" || v.includes("بانک")) return "bank";
  return "cash";
}

function sanitizeExpenseScope(value) {
  const v = safeString(value).trim().toLowerCase();
  if (v === "shared" || v.includes("مشترک")) return "shared";
  if (v === "personal" || v.includes("شخصی")) return "personal";
  return "business";
}

function sanitizeEntryType(value) {
  const v = safeString(value).trim().toLowerCase();
  if (v === "out" || v.includes("خرج") || v.includes("پرداخت")) return "out";
  return "in";
}

function sanitizeSettings(raw) {
  return {
    model: sanitizeModel(raw?.model),
    apiKey: safeString(raw?.apiKey).trim()
  };
}

function maskApiKey(apiKey) {
  if (!apiKey) return "";
  if (apiKey.length <= 8) {
    return `${apiKey.slice(0, 2)}***${apiKey.slice(-2)}`;
  }
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

function getSettingsPath(electronApp) {
  return path.join(electronApp.getPath("userData"), SETTINGS_FILE_NAME);
}

function loadSettings(electronApp) {
  const filePath = getSettingsPath(electronApp);
  const fallback = sanitizeSettings({
    model: DEFAULT_MODEL,
    apiKey: ""
  });

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), "utf8");
    return fallback;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const normalized = sanitizeSettings(parsed);
    fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2), "utf8");
    return normalized;
  } catch {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), "utf8");
    return fallback;
  }
}

function saveSettings(electronApp, nextSettings) {
  const filePath = getSettingsPath(electronApp);
  const normalized = sanitizeSettings(nextSettings);
  fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2), "utf8");
  return normalized;
}

function toSettingsResponse(settings) {
  return {
    model: settings.model,
    hasApiKey: Boolean(settings.apiKey),
    apiKeyMasked: settings.apiKey ? maskApiKey(settings.apiKey) : ""
  };
}

function sanitizeChatMessages(rawMessages) {
  if (!Array.isArray(rawMessages)) return [];
  return rawMessages
    .map((item) => ({
      role: item?.role === "assistant" ? "assistant" : "user",
      content: safeString(item?.content).trim()
    }))
    .filter((item) => item.content)
    .slice(-MAX_CHAT_MESSAGES);
}

function toGeminiContents(messages) {
  const contents = [];
  for (const item of messages) {
    contents.push({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.content }]
    });
  }
  return contents;
}

function parseGeminiText(responseJson) {
  const candidates = Array.isArray(responseJson?.candidates)
    ? responseJson.candidates
    : [];
  const first = candidates[0];
  const parts = Array.isArray(first?.content?.parts) ? first.content.parts : [];
  return parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .join("\n")
    .trim();
}

function collectJsonCandidates(text) {
  const candidates = [];
  const source = safeString(text).trim();
  if (!source) return candidates;

  candidates.push(source);

  const blockRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match = blockRegex.exec(source);
  while (match) {
    candidates.push(match[1].trim());
    match = blockRegex.exec(source);
  }

  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    candidates.push(source.slice(start, end + 1).trim());
  }

  return Array.from(new Set(candidates));
}

function parseAssistantEnvelope(rawText) {
  const candidates = collectJsonCandidates(rawText);
  for (const item of candidates) {
    try {
      const parsed = JSON.parse(item);
      if (!parsed || typeof parsed !== "object") continue;
      return {
        assistantReply: safeString(
          parsed.assistantReply ?? parsed.reply ?? parsed.message
        ).trim(),
        pendingActions: Array.isArray(parsed.pendingActions)
          ? parsed.pendingActions
          : []
      };
    } catch {
      // Continue to next candidate.
    }
  }

  return {
    assistantReply: safeString(rawText).trim(),
    pendingActions: []
  };
}

function normalizeSettlementPayload(rawPayload, fallbackDate) {
  const amount = parseAmount(rawPayload?.amount);
  const settlementType = sanitizeSettlementType(rawPayload?.settlementType);
  return {
    settlementType,
    relatedId: toId(rawPayload?.relatedId),
    partnerName: safeString(rawPayload?.partnerName).trim(),
    counterpartyName: safeString(rawPayload?.counterpartyName).trim(),
    projectId: toId(rawPayload?.projectId),
    projectTitle: safeString(rawPayload?.projectTitle).trim(),
    amount,
    paymentMethod: sanitizePaymentMethod(rawPayload?.paymentMethod),
    description: safeString(rawPayload?.description).trim(),
    settlementDate: toCanonicalJalaliDate(rawPayload?.settlementDate, fallbackDate)
  };
}

function normalizeExpensePayload(rawPayload, fallbackDate) {
  return {
    scope: sanitizeExpenseScope(rawPayload?.scope),
    paidBy: safeString(rawPayload?.paidBy).trim(),
    category: safeString(rawPayload?.category).trim() || "عمومی",
    amount: parseAmount(rawPayload?.amount),
    expenseDate: toCanonicalJalaliDate(rawPayload?.expenseDate, fallbackDate),
    description: safeString(rawPayload?.description).trim()
  };
}

function normalizeCashboxPayload(rawPayload, fallbackDate) {
  return {
    entryType: sanitizeEntryType(rawPayload?.entryType),
    amount: parseAmount(rawPayload?.amount),
    category: safeString(rawPayload?.category).trim(),
    referenceType: safeString(rawPayload?.referenceType).trim(),
    referenceId: toId(rawPayload?.referenceId),
    entryDate: toCanonicalJalaliDate(rawPayload?.entryDate, fallbackDate),
    description: safeString(rawPayload?.description).trim()
  };
}

function normalizeReminderPayload(rawPayload, fallbackDate) {
  const repeatType = sanitizeRepeatType(rawPayload?.repeatType);
  const repeatUntil = repeatType === "none"
    ? ""
    : toCanonicalJalaliDate(rawPayload?.repeatUntil, "");
  return {
    title: safeString(rawPayload?.title).trim(),
    description: safeString(rawPayload?.description).trim(),
    reminderDate: toCanonicalJalaliDate(rawPayload?.reminderDate, fallbackDate),
    reminderTime: sanitizeReminderTime(rawPayload?.reminderTime),
    isDone: false,
    repeatType,
    repeatUntil,
    projectId: toId(rawPayload?.projectId),
    projectTitle: safeString(rawPayload?.projectTitle).trim(),
    partnerId: toId(rawPayload?.partnerId),
    partnerName: safeString(rawPayload?.partnerName).trim()
  };
}

function buildActionSummary(type, payload) {
  if (type === "create_settlement") {
    return `ثبت تسویه ${payload.settlementType} مبلغ ${payload.amount}`;
  }
  if (type === "create_expense") {
    return `ثبت هزینه مبلغ ${payload.amount} (${payload.category || "عمومی"})`;
  }
  if (type === "create_cashbox") {
    return `ثبت ${payload.entryType === "in" ? "دریافتی" : "پرداختی"} مبلغ ${payload.amount}`;
  }
  if (type === "create_reminder") {
    return `ثبت یادآور ${payload.title || "بدون عنوان"} در ${payload.reminderDate} ${payload.reminderTime}`;
  }
  return "عملیات";
}

function normalizeAction(rawAction, fallbackDate) {
  const type = safeString(
    rawAction?.type ?? rawAction?.action ?? rawAction?.operation
  )
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  if (!SUPPORTED_ACTION_TYPES.has(type)) return null;

  let payload;
  if (type === "create_settlement") {
    payload = normalizeSettlementPayload(rawAction?.payload, fallbackDate);
  } else if (type === "create_expense") {
    payload = normalizeExpensePayload(rawAction?.payload, fallbackDate);
  } else if (type === "create_cashbox") {
    payload = normalizeCashboxPayload(rawAction?.payload, fallbackDate);
  } else {
    payload = normalizeReminderPayload(rawAction?.payload, fallbackDate);
  }

  const summary = safeString(rawAction?.summary).trim() || buildActionSummary(type, payload);
  return {
    kind: "write",
    type,
    summary,
    payload
  };
}

function normalizePendingActions(rawActions, fallbackDate) {
  const list = Array.isArray(rawActions) ? rawActions : [];
  const normalized = [];
  for (const item of list.slice(0, MAX_PENDING_ACTIONS)) {
    const action = normalizeAction(item, fallbackDate);
    if (!action) continue;
    normalized.push(action);
  }
  return normalized;
}

function escapeLikePattern(value) {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

function resolveProjectId(payload, statements) {
  const directId = toId(payload?.projectId);
  if (directId) {
    const row = statements.projectById.get(directId);
    if (row) return row.id;
  }

  const title = safeString(payload?.projectTitle).trim();
  if (!title) return null;

  const exact = statements.projectByTitleExact.get(title);
  if (exact) return exact.id;

  const like = statements.projectByTitleLike.get(`%${escapeLikePattern(title)}%`);
  if (like) return like.id;
  return null;
}

function resolvePartner(payload, statements) {
  const directId = toId(payload?.relatedId ?? payload?.partnerId);
  if (directId) {
    const row = statements.partnerById.get(directId);
    if (row) return row;
  }

  const byName = safeString(payload?.partnerName).trim();
  if (!byName) return null;

  const exact = statements.partnerByNameExact.get(byName);
  if (exact) return exact;

  const like = statements.partnerByNameLike.get(`%${escapeLikePattern(byName)}%`);
  if (like) return like;
  return null;
}

function assertPositiveAmount(amount) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("مبلغ باید عددی بزرگ‌تر از صفر باشد.");
  }
}

function executeCreateSettlement(action, statements) {
  const payload = normalizeSettlementPayload(action.payload, getTodayJalaliDate());
  assertPositiveAmount(payload.amount);

  const partner = resolvePartner(payload, statements);
  const projectId = resolveProjectId(payload, statements);
  const now = new Date().toISOString();

  const relatedId = payload.settlementType === "partner" ? partner?.id || payload.relatedId : null;
  const counterpartyName = payload.counterpartyName || partner?.fullName || "";

  const info = statements.createSettlement.run({
    settlementType: payload.settlementType,
    relatedId: relatedId || null,
    counterpartyName,
    projectId,
    amount: payload.amount,
    paymentMethod: payload.paymentMethod,
    description: payload.description,
    settlementDate: payload.settlementDate,
    createdAt: now
  });

  return {
    id: info.lastInsertRowid,
    summary: buildActionSummary("create_settlement", payload)
  };
}

function executeCreateExpense(action, statements) {
  const payload = normalizeExpensePayload(action.payload, getTodayJalaliDate());
  assertPositiveAmount(payload.amount);

  const info = statements.createExpense.run({
    scope: payload.scope,
    paidBy: payload.paidBy,
    category: payload.category,
    amount: payload.amount,
    expenseDate: payload.expenseDate,
    description: payload.description,
    createdAt: new Date().toISOString()
  });

  return {
    id: info.lastInsertRowid,
    summary: buildActionSummary("create_expense", payload)
  };
}

function executeCreateCashbox(action, statements) {
  const payload = normalizeCashboxPayload(action.payload, getTodayJalaliDate());
  assertPositiveAmount(payload.amount);

  const info = statements.createCashbox.run({
    entryType: payload.entryType,
    amount: payload.amount,
    category: payload.category,
    referenceType: payload.referenceType,
    referenceId: payload.referenceId,
    entryDate: payload.entryDate,
    description: payload.description,
    createdAt: new Date().toISOString()
  });

  return {
    id: info.lastInsertRowid,
    summary: buildActionSummary("create_cashbox", payload)
  };
}

function executeCreateReminder(action, statements) {
  const payload = normalizeReminderPayload(action.payload, getTodayJalaliDate());
  if (!payload.title) {
    throw new Error("عنوان یادآور الزامی است.");
  }

  const projectId = resolveProjectId(payload, statements);
  const partner = resolvePartner(payload, statements);
  const now = new Date().toISOString();

  const info = statements.createReminder.run({
    title: payload.title,
    description: payload.description,
    reminderDate: payload.reminderDate,
    reminderTime: payload.reminderTime,
    isDone: 0,
    repeatType: payload.repeatType,
    repeatUntil: payload.repeatUntil,
    snoozeUntil: "",
    projectId: projectId || null,
    partnerId: partner?.id || payload.partnerId || null,
    createdAt: now,
    updatedAt: now
  });

  return {
    id: info.lastInsertRowid,
    summary: buildActionSummary("create_reminder", payload)
  };
}

function executeWriteAction(action, statements) {
  if (action.type === "create_settlement") {
    return executeCreateSettlement(action, statements);
  }
  if (action.type === "create_expense") {
    return executeCreateExpense(action, statements);
  }
  if (action.type === "create_cashbox") {
    return executeCreateCashbox(action, statements);
  }
  if (action.type === "create_reminder") {
    return executeCreateReminder(action, statements);
  }
  throw new Error("نوع عملیات پشتیبانی نمی‌شود.");
}

function buildContextSnapshot(statements) {
  const today = getTodayJalaliDate();
  const totals = statements.overviewTotals.get();
  return {
    todayJalali: today,
    overview: {
      cashboxIncome: Number(totals?.cashboxIncome || 0),
      cashboxOutcome: Number(totals?.cashboxOutcome || 0),
      cashboxBalance:
        Number(totals?.cashboxIncome || 0) - Number(totals?.cashboxOutcome || 0),
      totalExpenses: Number(totals?.totalExpenses || 0),
      openReminders: Number(totals?.openReminders || 0)
    },
    projects: statements.projectList.all().map((row) => ({
      id: Number(row.id),
      title: row.title,
      clientName: row.clientName,
      status: row.status
    })),
    partners: statements.partnerList.all().map((row) => ({
      id: Number(row.id),
      fullName: row.fullName
    })),
    recentCashbox: statements.recentCashbox.all().map((row) => ({
      id: Number(row.id),
      entryType: row.entryType,
      amount: Number(row.amount || 0),
      entryDate: row.entryDate,
      description: row.description
    })),
    recentExpenses: statements.recentExpenses.all().map((row) => ({
      id: Number(row.id),
      scope: row.scope,
      amount: Number(row.amount || 0),
      expenseDate: row.expenseDate,
      category: row.category
    })),
    recentReminders: statements.recentReminders.all().map((row) => ({
      id: Number(row.id),
      title: row.title,
      reminderDate: row.reminderDate,
      reminderTime: row.reminderTime,
      isDone: Number(row.isDone || 0)
    }))
  };
}

function buildSystemInstruction(context) {
  return `
You are the accounting assistant for Bir Hesab desktop app.
You must return STRICT JSON only. No markdown, no extra text.

Response schema:
{
  "assistantReply": "string in Persian for user",
  "pendingActions": [
    {
      "kind": "write",
      "type": "create_settlement|create_expense|create_cashbox|create_reminder",
      "summary": "short Persian summary",
      "payload": {}
    }
  ]
}

Rules:
- Use pendingActions only for write operations that need user confirmation.
- If user asks report/question only, put answer in assistantReply and pendingActions must be [].
- If data is ambiguous and write action cannot be safely prepared, ask a short clarification in assistantReply and keep pendingActions [].
- Amounts must be pure numbers in payload (no currency text).
- Date should be Persian Jalali format YYYY/MM/DD.
- Time should be 24h HH:mm.
- For generic income/expense not tied to employer/coworker, prefer settlementType="personal" or cashbox entry.
- Never include unsupported action types.

Live app context JSON:
${JSON.stringify(context)}
`.trim();
}

async function callGemini({ apiKey, model, messages, context }) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const contents = toGeminiContents(messages);
  if (!contents.length) {
    contents.push({
      role: "user",
      parts: [{ text: "سلام. یک پاسخ راهنما بده." }]
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: buildSystemInstruction(context) }]
        },
        contents,
        generationConfig: {
          temperature: 0.15,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      let message = `Gemini API error (${response.status})`;
      try {
        const parsed = JSON.parse(errText);
        const remoteMessage = safeString(parsed?.error?.message).trim();
        if (remoteMessage) {
          message = `Gemini API error (${response.status}): ${remoteMessage}`;
        }
      } catch {
        if (errText.trim()) {
          message = `Gemini API error (${response.status}): ${errText.trim().slice(0, 400)}`;
        }
      }
      throw new Error(message);
    }

    const json = await response.json();
    const text = parseGeminiText(json);
    if (!text) {
      throw new Error("پاسخ متنی از Gemini دریافت نشد.");
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function createDbStatements(db) {
  return {
    createSettlement: db.prepare(
      `
        INSERT INTO settlements (
          settlement_type,
          related_id,
          counterparty_name,
          project_id,
          amount,
          payment_method,
          description,
          settlement_date,
          created_at
        )
        VALUES (
          @settlementType,
          @relatedId,
          @counterpartyName,
          @projectId,
          @amount,
          @paymentMethod,
          @description,
          @settlementDate,
          @createdAt
        )
      `
    ),
    createExpense: db.prepare(
      `
        INSERT INTO expenses (
          scope,
          paid_by,
          category,
          amount,
          expense_date,
          description,
          created_at
        )
        VALUES (
          @scope,
          @paidBy,
          @category,
          @amount,
          @expenseDate,
          @description,
          @createdAt
        )
      `
    ),
    createCashbox: db.prepare(
      `
        INSERT INTO cashbox (
          entry_type,
          amount,
          category,
          reference_type,
          reference_id,
          entry_date,
          description,
          created_at
        )
        VALUES (
          @entryType,
          @amount,
          @category,
          @referenceType,
          @referenceId,
          @entryDate,
          @description,
          @createdAt
        )
      `
    ),
    createReminder: db.prepare(
      `
        INSERT INTO reminders (
          title,
          description,
          reminder_date,
          reminder_time,
          is_done,
          repeat_type,
          repeat_until,
          snooze_until,
          project_id,
          partner_id,
          created_at,
          updated_at
        )
        VALUES (
          @title,
          @description,
          @reminderDate,
          @reminderTime,
          @isDone,
          @repeatType,
          @repeatUntil,
          @snoozeUntil,
          @projectId,
          @partnerId,
          @createdAt,
          @updatedAt
        )
      `
    ),
    projectById: db.prepare("SELECT id, title FROM projects WHERE id = ? LIMIT 1"),
    projectByTitleExact: db.prepare(
      "SELECT id, title FROM projects WHERE title = ? LIMIT 1"
    ),
    projectByTitleLike: db.prepare(
      "SELECT id, title FROM projects WHERE title LIKE ? ESCAPE '\\' ORDER BY id DESC LIMIT 1"
    ),
    partnerById: db.prepare(
      "SELECT id, full_name AS fullName FROM partners WHERE id = ? LIMIT 1"
    ),
    partnerByNameExact: db.prepare(
      "SELECT id, full_name AS fullName FROM partners WHERE full_name = ? LIMIT 1"
    ),
    partnerByNameLike: db.prepare(
      "SELECT id, full_name AS fullName FROM partners WHERE full_name LIKE ? ESCAPE '\\' ORDER BY id DESC LIMIT 1"
    ),
    overviewTotals: db.prepare(
      `
        SELECT
          (SELECT COALESCE(SUM(amount), 0) FROM cashbox WHERE entry_type = 'in') AS cashboxIncome,
          (SELECT COALESCE(SUM(amount), 0) FROM cashbox WHERE entry_type = 'out') AS cashboxOutcome,
          (SELECT COALESCE(SUM(amount), 0) FROM expenses) AS totalExpenses,
          (SELECT COUNT(*) FROM reminders WHERE is_done = 0) AS openReminders
      `
    ),
    projectList: db.prepare(
      `
        SELECT id, title, client_name AS clientName, status
        FROM projects
        ORDER BY id DESC
        LIMIT 40
      `
    ),
    partnerList: db.prepare(
      `
        SELECT id, full_name AS fullName
        FROM partners
        ORDER BY id DESC
        LIMIT 40
      `
    ),
    recentCashbox: db.prepare(
      `
        SELECT id, entry_type AS entryType, amount, entry_date AS entryDate, description
        FROM cashbox
        ORDER BY id DESC
        LIMIT 15
      `
    ),
    recentExpenses: db.prepare(
      `
        SELECT id, scope, category, amount, expense_date AS expenseDate
        FROM expenses
        ORDER BY id DESC
        LIMIT 15
      `
    ),
    recentReminders: db.prepare(
      `
        SELECT id, title, reminder_date AS reminderDate, reminder_time AS reminderTime, is_done AS isDone
        FROM reminders
        ORDER BY id DESC
        LIMIT 15
      `
    )
  };
}

function executeActions(actions, statements) {
  const list = Array.isArray(actions) ? actions.slice(0, MAX_EXECUTION_ACTIONS) : [];
  const executed = [];
  const failed = [];

  for (const rawAction of list) {
    const normalized = normalizeAction(rawAction, getTodayJalaliDate());
    if (!normalized) {
      failed.push({
        summary: safeString(rawAction?.summary).trim() || "عملیات نامعتبر",
        error: "نوع عملیات پشتیبانی نمی‌شود."
      });
      continue;
    }

    try {
      const result = executeWriteAction(normalized, statements);
      executed.push({
        id: result.id,
        type: normalized.type,
        summary: result.summary || normalized.summary
      });
    } catch (error) {
      failed.push({
        type: normalized.type,
        summary: normalized.summary,
        error: safeString(error?.message).trim() || "خطای ناشناخته"
      });
    }
  }

  return { executed, failed };
}

function registerAssistantHandlers(ipcMain, db, electronApp) {
  const statements = createDbStatements(db);

  ipcMain.handle("assistant:settings:get", () => {
    const settings = loadSettings(electronApp);
    return toSettingsResponse(settings);
  });

  ipcMain.handle("assistant:settings:update", (_, payload = {}) => {
    const current = loadSettings(electronApp);
    const next = {
      model: payload.model !== undefined ? payload.model : current.model,
      apiKey: current.apiKey
    };

    if (payload.clearApiKey) {
      next.apiKey = "";
    }
    const inputApiKey = safeString(payload.apiKey).trim();
    if (inputApiKey) {
      next.apiKey = inputApiKey;
    }

    const saved = saveSettings(electronApp, next);
    return toSettingsResponse(saved);
  });

  ipcMain.handle("assistant:chat", async (_, payload = {}) => {
    const settings = loadSettings(electronApp);
    if (!settings.apiKey) {
      throw new Error("کلید Gemini تنظیم نشده است.");
    }

    const messages = sanitizeChatMessages(payload.messages);
    if (!messages.length) {
      throw new Error("پیامی برای دستیار ارسال نشده است.");
    }

    const context = buildContextSnapshot(statements);
    const rawModelText = await callGemini({
      apiKey: settings.apiKey,
      model: settings.model,
      messages,
      context
    });

    const envelope = parseAssistantEnvelope(rawModelText);
    const pendingActions = normalizePendingActions(
      envelope.pendingActions,
      context.todayJalali
    );

    const assistantReply =
      envelope.assistantReply ||
      (pendingActions.length
        ? "عملیات پیشنهادی آماده است. بعد از تایید، اجرا می‌کنم."
        : "پاسخ آماده شد.");

    return {
      assistantReply,
      pendingActions
    };
  });

  ipcMain.handle("assistant:execute-actions", (_, payload = {}) => {
    const actions = Array.isArray(payload.actions) ? payload.actions : [];
    return executeActions(actions, statements);
  });
}

module.exports = {
  registerAssistantHandlers
};
