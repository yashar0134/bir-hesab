const SIMPLE_UI_ENABLED = false;
const SIMPLE_SECTION = "cashbox";

const state = {
  section: SIMPLE_UI_ENABLED ? SIMPLE_SECTION : "dashboard-birino"
};

const sectionMap = {
  "dashboard-birino": "components/dashboard-birino.html",
  services: "components/services.html",
  projects: "components/projects.html",
  settlements: "components/settlements.html",
  reminders: "components/reminders.html",
  expenses: "components/expenses.html",
  cashbox: "components/cashbox.html"
};

const helpMap = {
  "dashboard-birino":
    "📌 این صفحه فقط برای دیدن خلاصه است.\n\n✅ چطور استفاده کنم؟\n۱) اول «خدمت» بساز.\n۲) بعد «پروژه» بساز.\n۳) بعد پول‌هایی که گرفتی/دادی را ثبت کن.\n۴) اینجا نتیجه را می‌بینی.\n\n👶 مثال خیلی ساده:\nتو یک پروژه طراحی داشتی. از کارفرما ۲۰ میلیون گرفتی. به همکار ۶ میلیون دادی. این صفحه کمک می‌کند خیلی سریع بفهمی چقدر مانده است.",
  services:
    "🧩 اینجا می‌گویی «چه کاری انجام می‌دهی».\n\n✅ قدم‌ها:\n۱) اسم خدمت را بنویس (مثلاً تدوین ویدیو).\n۲) مدل قیمت را انتخاب کن (ساعتی/پروژه‌ای/...).\n۳) نرخ را وارد کن.\n\n👶 مثال:\nخدمت: تدوین ویدیو\nمدل: پروژه‌ای\nنرخ: ۵,۰۰۰,۰۰۰ تومان",
  projects:
    "🗂️ اینجا پروژه را می‌سازی.\n\n✅ قدم‌ها:\n۱) عنوان پروژه را بنویس.\n۲) نام کارفرما را بنویس.\n۳) چند خدمت برای پروژه انتخاب کن.\n۴) وضعیت پروژه را تعیین کن.\n\n👶 مثال:\nپروژه: کلیپ اینستاگرام\nکارفرما: شرکت آلفا\nخدمات: فیلمبرداری + تدوین",
  settlements:
    "🤝 مهم‌ترین بخش محاسبه همینجاست.\n\n✅ کار همکار درصدی:\nبرای هر پروژه درصد جدا بگذار (مثلاً علی در پروژه A = ۳۰٪ و پروژه B = ۵۰٪).\n\n✅ کار همکار حقوقی:\nمدل را روی حقوق هفتگی یا ماهانه بگذار و مبلغ حقوق ثبت کن.\n\n👶 مثال:\nاز پروژه A مبلغ ۱۰ میلیون گرفتی.\nاگر سهم علی ۳۰٪ باشد، قابل پرداخت علی = ۳ میلیون.\nاگر ۱ میلیون داده باشی، مانده = ۲ میلیون.",
  reminders:
    "📅 اینجا یک تقویم شمسی کامل داری.\n\n✅ چه چیزی می‌بینی؟\n۱) یادآورها روی روزها\n۲) جمع دریافتی‌ها و پرداختی‌های همان روز\n\n✅ چه کاری می‌تونی بکنی؟\nثبت/ویرایش/حذف یادآور و علامت‌زدن انجام‌شده.",
  expenses:
    "🧾 هر پولی که خرج می‌کنی اینجا ثبت کن.\n\n✅ قدم‌ها:\n۱) دامنه هزینه را انتخاب کن.\n۲) دسته‌بندی را بنویس.\n۳) مبلغ را بزن.\n\n👶 مثال:\nدامنه: کسب‌وکار\nدسته: اینترنت\nمبلغ: ۳۰۰,۰۰۰ تومان",
  cashbox:
    "💵 اینجا خیلی ساده فقط دخل و خرج ثبت می‌کنی.\n\n✅ مبلغ، تاریخ و توضیح را وارد کن.\n✅ اگر پول گرفتی «ثبت دخل» را بزن.\n✅ اگر پول دادی «ثبت خرج» را بزن.\n\n👶 مثال:\nدخل: ۱۵,۰۰۰,۰۰۰ از کارفرما\nخرج: ۴,۰۰۰,۰۰۰ برای همکار"
};

const quickGuideMap = {
  "dashboard-birino": ["📌 خلاصه مالی", "👀 بررسی مانده", "📤 خروجی گزارش", "✅ تصمیم سریع"],
  services: ["۱️⃣ اسم خدمت", "۲️⃣ مدل قیمت", "۳️⃣ ثبت نرخ", "✅ ذخیره"],
  projects: ["۱️⃣ اسم پروژه", "۲️⃣ انتخاب خدمات", "۳️⃣ انتخاب وضعیت", "✅ ثبت"],
  settlements: ["۱️⃣ تعریف همکار", "۲️⃣ شرط پروژه", "۳️⃣ ثبت تسویه", "✅ دیدن مانده"],
  reminders: ["۱️⃣ انتخاب روز", "۲️⃣ ثبت یادآور", "۳️⃣ دیدن دریافتی/پرداختی", "✅ پیگیری روزانه"],
  expenses: ["۱️⃣ انتخاب دامنه", "۲️⃣ ثبت مبلغ", "۳️⃣ ثبت تاریخ", "✅ ذخیره"],
  cashbox: ["۱️⃣ ثبت مبلغ", "۲️⃣ ثبت تاریخ", "۳️⃣ ثبت توضیح", "✅ دکمه دخل یا خرج"]
};

function resolveActiveSection(section) {
  if (SIMPLE_UI_ENABLED) return SIMPLE_SECTION;
  if (sectionMap[section]) return section;
  return "dashboard-birino";
}

function formatCurrency(value) {
  return `${Number(value || 0).toLocaleString("fa-IR")} تومان`;
}

function normalizeDigits(value) {
  if (!value) return "";
  return String(value)
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

function toPersianDigits(value) {
  return normalizeDigits(value).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

function formatMoneyInput(rawValue) {
  const digits = normalizeDigits(rawValue).replace(/[^\d]/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("fa-IR");
}

function parseMoneyInput(rawValue) {
  const digits = normalizeDigits(rawValue).replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
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

function toJalaliDate(dateValue) {
  if (!dateValue) return "-";
  const normalized = normalizeDigits(String(dateValue)).trim();
  if (normalized.includes("/")) return normalized;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return normalized;
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tehran"
  }).format(date);
}

function toDateKey(dateValue) {
  if (!dateValue) return "";
  return normalizeDigits(toJalaliDate(dateValue)).replace(/[^\d]/g, "").slice(0, 8);
}

function inDateRange(dateValue, fromValue, toValue) {
  const key = toDateKey(dateValue);
  const from = toDateKey(fromValue);
  const to = toDateKey(toValue);
  if (from && key < from) return false;
  if (to && key > to) return false;
  return true;
}

function parseJalaliDate(dateValue) {
  const normalized = normalizeDigits(String(dateValue || "")).trim();
  const match = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  const jy = Number(match[1]);
  const jm = Number(match[2]);
  const jd = Number(match[3]);
  if (jm < 1 || jm > 12 || jd < 1) return null;
  try {
    if (jd > jalaliMonthLength(jy, jm)) return null;
  } catch {
    return null;
  }
  return { jy, jm, jd };
}

function formatJalaliDateParts(jy, jm, jd) {
  return `${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`;
}

function toCanonicalJalaliDate(dateValue) {
  const parsed = parseJalaliDate(dateValue);
  if (parsed) {
    return formatJalaliDateParts(parsed.jy, parsed.jm, parsed.jd);
  }
  return normalizeDigits(String(dateValue || "")).trim();
}

function div(a, b) {
  return Math.trunc(a / b);
}

function mod(a, b) {
  return a - Math.trunc(a / b) * b;
}

function g2d(gy, gm, gd) {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j += div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function jalCal(jy) {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635,
    2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178
  ];
  const bl = breaks.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];
  let jump = 0;
  let jm;
  let n;
  let i;

  if (jy < jp || jy >= breaks[bl - 1]) {
    throw new Error("Invalid Jalaali year");
  }

  for (i = 1; i < bl; i += 1) {
    jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) {
      break;
    }
    leapJ += div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  n = jy - jp;

  leapJ += div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) {
    leapJ += 1;
  }

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  if (jump - n < 6) {
    n = n - jump + div(jump + 4, 33) * 33;
  }
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) {
    leap = 4;
  }

  return { leap, gy, march };
}

function j2d(jy, jm, jd) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn) {
  const g = d2g(jdn);
  let jy = g.gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(g.gy, 3, r.march);
  let k = jdn - jdn1f;
  let jd;
  let jm;

  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + div(k, 31);
      jd = mod(k, 31) + 1;
      return { jy, jm, jd };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) {
      k += 1;
    }
  }
  jm = 7 + div(k, 30);
  jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}

function toGregorian(jy, jm, jd) {
  return d2g(j2d(jy, jm, jd));
}

function isLeapJalaliYear(jy) {
  return jalCal(jy).leap === 0;
}

function jalaliMonthLength(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapJalaliYear(jy) ? 30 : 29;
}

function jalaliWeekdayIndex(jy, jm, jd) {
  const g = toGregorian(jy, jm, jd);
  const day = new Date(g.gy, g.gm - 1, g.gd).getDay();
  return (day + 1) % 7;
}

function jalaliMonthLabel(jy, jm) {
  const monthNames = [
    "فروردین",
    "اردیبهشت",
    "خرداد",
    "تیر",
    "مرداد",
    "شهریور",
    "مهر",
    "آبان",
    "آذر",
    "دی",
    "بهمن",
    "اسفند"
  ];
  return `${monthNames[jm - 1] || ""} ${toPersianDigits(jy)}`;
}

function textMatch(query, ...fields) {
  const q = normalizeDigits(query || "").toLowerCase().trim();
  if (!q) return true;
  return fields.some((f) => normalizeDigits(String(f || "")).toLowerCase().includes(q));
}

function actionButtons(id, scope) {
  return `
    <div class="row-actions">
      <button class="btn-ghost" type="button" data-action="edit" data-scope="${scope}" data-id="${id}">ویرایش</button>
      <button class="btn-danger" type="button" data-action="delete" data-scope="${scope}" data-id="${id}">حذف</button>
    </div>
  `;
}

function renderBars(containerId, rows, keyA, keyB) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const max = Math.max(1, ...rows.map((r) => Number(r[keyA] || 0)), ...rows.map((r) => Number(r[keyB] || 0)));
  container.innerHTML = rows.map((row) => {
    const a = Number(row[keyA] || 0);
    const b = Number(row[keyB] || 0);
    return `
      <div class="chart-row">
        <div class="chart-label">${toPersianDigits((row.monthKey || row.yearKey || "").replace("-", "/"))}</div>
        <div class="chart-bars">
          <div class="chart-bar income" style="width:${Math.max(2, (a / max) * 100)}%"></div>
          <div class="chart-bar outcome" style="width:${Math.max(2, (b / max) * 100)}%"></div>
        </div>
      </div>
    `;
  }).join("");
}

async function loadComponent(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load component: ${path}`);
  return response.text();
}

function setTodayByDefault(elementId) {
  const input = document.getElementById(elementId);
  if (input && !input.value) input.value = getTodayJalaliDate();
}

function bindMoneyInputs(root = document) {
  root.querySelectorAll("input.money-input").forEach((input) => {
    if (input.dataset.moneyBound === "1") return;
    input.dataset.moneyBound = "1";
    input.addEventListener("input", () => {
      input.value = formatMoneyInput(input.value);
    });
    input.addEventListener("blur", () => {
      input.value = formatMoneyInput(input.value);
    });
  });
}

function setupIranCalendar() {
  if (window.jalaliDatepicker) {
    window.jalaliDatepicker.startWatch({
      selector: "input[data-jdp]",
      separatorChars: { date: "/", between: " ", time: ":" },
      persianDigits: false,
      autoReadOnlyInput: true,
      days: ["ش", "ی", "د", "س", "چ", "پ", "ج"]
    });
  }
}

function applyModeTheme() {
  document.body.setAttribute("data-mode", "birino");
}

function setupModeTabs() {
  applyModeTheme();
}

function filterSidebarByMode() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    if (SIMPLE_UI_ENABLED) {
      btn.classList.toggle("hidden", btn.dataset.section !== SIMPLE_SECTION);
      return;
    }
    btn.classList.remove("hidden");
  });
}

function setActiveSidebarButton() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.section === state.section);
  });
}

async function initSidebar() {
  const sidebar = document.getElementById("sidebar");
  sidebar.innerHTML = await loadComponent("components/sidebar.html");
  sidebar.addEventListener("click", (event) => {
    const button = event.target.closest(".nav-btn");
    if (!button) return;
    if (SIMPLE_UI_ENABLED && button.dataset.section !== SIMPLE_SECTION) return;
    state.section = resolveActiveSection(button.dataset.section);
    setActiveSidebarButton();
    renderSection();
  });
  filterSidebarByMode();
  setActiveSidebarButton();
}

async function renderSection() {
  const activeSection = resolveActiveSection(state.section);
  if (state.section !== activeSection) {
    state.section = activeSection;
  }
  const content = document.getElementById("content");
  content.innerHTML = await loadComponent(sectionMap[activeSection]);
  bindMoneyInputs(content);
  setupIranCalendar();
  updateQuickGuideBar();
  await initSectionLogic(activeSection);
}

function updateQuickGuideBar() {
  const guide = document.getElementById("quickGuide");
  if (!guide) return;
  const items = quickGuideMap[state.section] || ["راهنما در دسترس نیست"];
  guide.innerHTML = items.map((item) => `<div class="quick-step">${item}</div>`).join("");
}

async function initSectionLogic(section) {
  if (section === "dashboard-birino") return initBirinoDashboard();
  if (section === "services") return initServicesSection();
  if (section === "projects") return initProjectsSection();
  if (section === "settlements") return initSettlementsSection();
  if (section === "reminders") return initRemindersSection();
  if (section === "expenses") return initExpensesSection();
  if (section === "cashbox") return initCashboxSection();
}

async function exportReport(type, kind, report) {
  try {
    if (kind === "excel") {
      const result = await window.birHesab.invoke("reports:export:excel", { type, report });
      if (!result?.canceled) alert("گزارش Excel با موفقیت ذخیره شد.");
      return;
    }

    const modal = document.getElementById("pdfPreviewModal");
    const frame = document.getElementById("pdfPreviewFrame");
    const closeBtn = document.getElementById("closePdfPreview");
    const confirmBtn = document.getElementById("confirmPdfExport");

    const keys = { m: ["monthKey", "income", "outcome"], y: ["yearKey", "income", "outcome"] };

    const rowsHtml = (arr, keysList) =>
      (arr || [])
        .map((row) => `<tr>${keysList.map((k) => `<td>${row[k] ?? ""}</td>`).join("")}</tr>`)
        .join("");
    const totalsHtml = Object.entries(report.totals || {})
      .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
      .join("");

    const previewHtml = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><style>body{font-family:Tahoma,sans-serif;padding:16px}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #ccc;padding:6px;text-align:right}</style></head><body><h2>پیش‌نمایش گزارش بیرینو</h2><h3>خلاصه</h3><table>${totalsHtml}</table><h3>ماهانه</h3><table>${rowsHtml(report.monthly, keys.m)}</table><h3>سالانه</h3><table>${rowsHtml(report.yearly, keys.y)}</table></body></html>`;

    frame.srcdoc = previewHtml;
    modal.classList.remove("hidden");

    const close = () => {
      modal.classList.add("hidden");
      frame.srcdoc = "";
      closeBtn.onclick = null;
      confirmBtn.onclick = null;
    };

    closeBtn.onclick = close;
    confirmBtn.onclick = async () => {
      const result = await window.birHesab.invoke("reports:export:pdf", { type, report });
      if (!result?.canceled) alert("گزارش PDF با موفقیت ذخیره شد.");
      close();
    };
  } catch (error) {
    alert(`خطا در خروجی گرفتن: ${error.message}`);
  }
}

async function initBirinoDashboard() {
  const report = await window.birHesab.invoke("reports:business");
  const profitReport = await window.birHesab.invoke("reports:project-profit");
  const stats = [
    { label: "درآمد کل", value: formatCurrency(report.totals.totalIncome) },
    { label: "خروجی کل", value: formatCurrency(report.totals.totalOutcome) },
    { label: "هزینه کسب‌وکار", value: formatCurrency(report.totals.totalExpenses) },
    { label: "تعداد پروژه", value: toPersianDigits(report.totals.totalProjects) }
  ];

  document.getElementById("birinoStats").innerHTML = stats
    .map((item) => `<div class="stat-box"><h4>${item.label}</h4><strong>${item.value}</strong></div>`)
    .join("");

  const monthly = [...report.monthly].reverse();
  const yearly = [...report.yearly].reverse();

  document.getElementById("birinoMonthlyRows").innerHTML = report.monthly
    .map((row) => `<tr><td>${toPersianDigits(row.monthKey.replace("-", "/"))}</td><td>${formatCurrency(row.income)}</td><td>${formatCurrency(row.outcome)}</td></tr>`)
    .join("");

  document.getElementById("birinoYearlyRows").innerHTML = report.yearly
    .map((row) => `<tr><td>${toPersianDigits(row.yearKey)}</td><td>${formatCurrency(row.income)}</td><td>${formatCurrency(row.outcome)}</td></tr>`)
    .join("");

  renderBars("birinoMonthlyChart", monthly, "income", "outcome");
  renderBars("birinoYearlyChart", yearly, "income", "outcome");

  document.getElementById("exportBusinessExcel")?.addEventListener("click", () => exportReport("business", "excel", report));
  document.getElementById("exportBusinessPdf")?.addEventListener("click", () => exportReport("business", "pdf", report));

  const projectProfitRows = document.getElementById("projectProfitRows");
  if (projectProfitRows) {
    projectProfitRows.innerHTML = (profitReport.projects || [])
      .map(
        (row) => `
          <tr>
            <td>${row.projectTitle || "-"}</td>
            <td>${row.clientName || "-"}</td>
            <td>${formatCurrency(row.clientReceived)}</td>
            <td>${formatCurrency(row.partnerDue)}</td>
            <td>${formatCurrency(row.partnerPaid)}</td>
            <td>${formatCurrency(row.expectedNetProfit)}</td>
            <td>${formatCurrency(row.realizedNetProfit)}</td>
          </tr>
        `
      )
      .join("");
  }

  const partnerProfitRows = document.getElementById("partnerProfitRows");
  if (partnerProfitRows) {
    partnerProfitRows.innerHTML = (profitReport.partners || [])
      .map(
        (row) => `
          <tr>
            <td>${row.partnerName || "-"}</td>
            <td>${toPersianDigits(row.projectsCount || 0)}</td>
            <td>${formatCurrency(row.dueAmount)}</td>
            <td>${formatCurrency(row.paidAmount)}</td>
            <td>${formatCurrency(row.remainingAmount)}</td>
          </tr>
        `
      )
      .join("");
  }

  const projectProfitSummary = document.getElementById("projectProfitSummary");
  if (projectProfitSummary) {
    const t = profitReport.totals || {};
    projectProfitSummary.textContent =
      `دریافتی کل: ${formatCurrency(t.totalClientReceived)} | ` +
      `قابل پرداخت کل: ${formatCurrency(t.totalPartnerDue)} | ` +
      `سود خالص انتظاری: ${formatCurrency(t.totalExpectedNetProfit)} | ` +
      `سود خالص تحقق‌یافته: ${formatCurrency(t.totalRealizedNetProfit)}`;
  }

  document.getElementById("exportProjectProfitExcel")?.addEventListener("click", async () => {
    try {
      const result = await window.birHesab.invoke("reports:project-profit:export:excel");
      if (!result?.canceled) alert("گزارش سود پروژه/همکار (Excel) ذخیره شد.");
    } catch (error) {
      alert(`خطا در خروجی Excel: ${error.message}`);
    }
  });

  document.getElementById("exportProjectProfitPdf")?.addEventListener("click", async () => {
    try {
      const result = await window.birHesab.invoke("reports:project-profit:export:pdf");
      if (!result?.canceled) alert("گزارش سود پروژه/همکار (PDF) ذخیره شد.");
    } catch (error) {
      alert(`خطا در خروجی PDF: ${error.message}`);
    }
  });
}

async function initRemindersSection() {
  const reminderForm = document.getElementById("reminderForm");
  const reminderDateInput = document.getElementById("reminderDate");
  const reminderTitleInput = document.getElementById("reminderTitle");
  const reminderDescInput = document.getElementById("reminderDescription");
  const reminderDoneInput = document.getElementById("reminderDone");
  const reminderFormReset = document.getElementById("reminderFormReset");
  const remindersRows = document.getElementById("remindersRows");
  const calendarGrid = document.getElementById("jalaliCalendarGrid");
  const monthTitle = document.getElementById("calendarMonthTitle");
  const prevMonthBtn = document.getElementById("calendarPrevMonth");
  const nextMonthBtn = document.getElementById("calendarNextMonth");
  const dayDetails = document.getElementById("calendarDayDetails");

  const today = parseJalaliDate(getTodayJalaliDate()) || { jy: 1404, jm: 1, jd: 1 };
  let viewYear = today.jy;
  let viewMonth = today.jm;
  let selectedDate = formatJalaliDateParts(today.jy, today.jm, today.jd);
  let editingReminderId = null;
  let reminders = [];
  let settlements = [];

  const normalizeReminderRows = (rows) =>
    (rows || []).map((row) => ({
      ...row,
      reminderDate: toCanonicalJalaliDate(row.reminderDate),
      isDone: Number(row.isDone || 0)
    }));

  const normalizeSettlementRows = (rows) =>
    (rows || []).map((row) => ({
      ...row,
      settlementDate: toCanonicalJalaliDate(row.settlementDate),
      amount: Number(row.amount || 0)
    }));

  const buildDayMap = () => {
    const map = new Map();
    const ensure = (key) => {
      if (!map.has(key)) {
        map.set(key, {
          reminders: [],
          settlements: [],
          receivable: 0,
          payable: 0
        });
      }
      return map.get(key);
    };

    reminders.forEach((item) => {
      const key = toDateKey(item.reminderDate);
      if (!key) return;
      ensure(key).reminders.push(item);
    });

    settlements.forEach((item) => {
      const key = toDateKey(item.settlementDate);
      if (!key) return;
      const bucket = ensure(key);
      bucket.settlements.push(item);
      if (item.settlementType === "client") {
        bucket.receivable += Number(item.amount || 0);
      } else {
        bucket.payable += Number(item.amount || 0);
      }
    });

    return map;
  };

  const renderDayDetails = (dayMap) => {
    const key = toDateKey(selectedDate);
    const bucket = dayMap.get(key);
    if (!bucket) {
      dayDetails.textContent = `برای تاریخ ${toPersianDigits(selectedDate)} موردی ثبت نشده است.`;
      return;
    }

    const reminderLines = bucket.reminders
      .map((item) => `• ${item.title}${item.isDone ? " (انجام‌شده)" : ""}`)
      .join("<br>");
    const settlementLines = bucket.settlements
      .map((item) => {
        const typeLabel = item.settlementType === "client" ? "دریافتی" : "پرداختی";
        const project = item.projectTitle ? ` - ${item.projectTitle}` : "";
        return `• ${typeLabel}: ${formatCurrency(item.amount)}${project}`;
      })
      .join("<br>");

    dayDetails.innerHTML = `
      <strong>${toPersianDigits(selectedDate)}</strong><br>
      ${bucket.reminders.length ? `<span>یادآورها:</span><br>${reminderLines}<br>` : ""}
      ${bucket.settlements.length ? `<span>تراکنش‌ها:</span><br>${settlementLines}` : ""}
    `;
  };

  const renderCalendar = () => {
    const dayMap = buildDayMap();
    monthTitle.textContent = jalaliMonthLabel(viewYear, viewMonth);

    const daysInMonth = jalaliMonthLength(viewYear, viewMonth);
    const firstWeekday = jalaliWeekdayIndex(viewYear, viewMonth, 1);

    const prevYear = viewMonth === 1 ? viewYear - 1 : viewYear;
    const prevMonth = viewMonth === 1 ? 12 : viewMonth - 1;
    const prevMonthDays = jalaliMonthLength(prevYear, prevMonth);

    const nextYear = viewMonth === 12 ? viewYear + 1 : viewYear;
    const nextMonth = viewMonth === 12 ? 1 : viewMonth + 1;

    const cells = [];
    for (let i = 0; i < 42; i += 1) {
      let jy = viewYear;
      let jm = viewMonth;
      let jd = 0;
      let inCurrentMonth = true;

      if (i < firstWeekday) {
        inCurrentMonth = false;
        jy = prevYear;
        jm = prevMonth;
        jd = prevMonthDays - firstWeekday + i + 1;
      } else if (i >= firstWeekday + daysInMonth) {
        inCurrentMonth = false;
        jy = nextYear;
        jm = nextMonth;
        jd = i - (firstWeekday + daysInMonth) + 1;
      } else {
        jd = i - firstWeekday + 1;
      }

      const dateStr = formatJalaliDateParts(jy, jm, jd);
      const key = toDateKey(dateStr);
      const bucket = dayMap.get(key);
      const reminderCount = bucket?.reminders?.length || 0;
      const receivable = Number(bucket?.receivable || 0);
      const payable = Number(bucket?.payable || 0);
      const isSelected = selectedDate === dateStr;

      const chips = [];
      if (reminderCount) {
        chips.push(`<span class="day-chip reminder">یادآور ${toPersianDigits(reminderCount)}</span>`);
      }
      if (receivable > 0) {
        chips.push(`<span class="day-chip receive">دریافتی ${toPersianDigits(Math.round(receivable).toLocaleString("en-US"))}</span>`);
      }
      if (payable > 0) {
        chips.push(`<span class="day-chip pay">پرداختی ${toPersianDigits(Math.round(payable).toLocaleString("en-US"))}</span>`);
      }

      cells.push(`
        <div class="calendar-day ${inCurrentMonth ? "current" : "muted"} ${isSelected ? "selected" : ""}" data-date="${dateStr}">
          <div class="calendar-day-head">${toPersianDigits(jd)}</div>
          <div class="calendar-day-chips">${chips.join("")}</div>
        </div>
      `);
    }

    calendarGrid.innerHTML = cells.join("");
    renderDayDetails(dayMap);
  };

  const renderRemindersTable = () => {
    remindersRows.innerHTML = reminders
      .map(
        (item) => `
          <tr>
            <td>${item.title}</td>
            <td>${toPersianDigits(item.reminderDate)}</td>
            <td>${item.isDone ? "انجام‌شده" : "باز"}</td>
            <td>${item.description || "-"}</td>
            <td>
              <div class="row-actions">
                <button class="btn-ghost" type="button" data-action="edit" data-id="${item.id}">ویرایش</button>
                <button class="btn-secondary" type="button" data-action="toggle" data-id="${item.id}">${item.isDone ? "بازکردن" : "انجام شد"}</button>
                <button class="btn-danger" type="button" data-action="delete" data-id="${item.id}">حذف</button>
              </div>
            </td>
          </tr>
        `
      )
      .join("");
  };

  const resetFormState = () => {
    editingReminderId = null;
    reminderForm.reset();
    reminderDoneInput.value = "0";
    reminderDateInput.value = selectedDate || getTodayJalaliDate();
  };

  const refresh = async () => {
    const payload = await window.birHesab.invoke("reminders:calendar-data");
    reminders = normalizeReminderRows(payload?.reminders || []);
    settlements = normalizeSettlementRows(payload?.settlements || []);
    renderCalendar();
    renderRemindersTable();
  };

  prevMonthBtn?.addEventListener("click", () => {
    if (viewMonth === 1) {
      viewYear -= 1;
      viewMonth = 12;
    } else {
      viewMonth -= 1;
    }
    renderCalendar();
  });

  nextMonthBtn?.addEventListener("click", () => {
    if (viewMonth === 12) {
      viewYear += 1;
      viewMonth = 1;
    } else {
      viewMonth += 1;
    }
    renderCalendar();
  });

  calendarGrid?.addEventListener("click", (event) => {
    const day = event.target.closest(".calendar-day");
    if (!day) return;
    selectedDate = day.dataset.date || selectedDate;
    reminderDateInput.value = selectedDate;
    renderCalendar();
  });

  remindersRows?.addEventListener("click", async (event) => {
    const btn = event.target.closest("button[data-id]");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const item = reminders.find((x) => x.id === id);
    if (!item) return;

    if (btn.dataset.action === "edit") {
      editingReminderId = id;
      reminderTitleInput.value = item.title || "";
      reminderDescInput.value = item.description || "";
      reminderDateInput.value = item.reminderDate || selectedDate;
      reminderDoneInput.value = item.isDone ? "1" : "0";
      selectedDate = item.reminderDate || selectedDate;
      const parsed = parseJalaliDate(selectedDate);
      if (parsed) {
        viewYear = parsed.jy;
        viewMonth = parsed.jm;
      }
      renderCalendar();
      return;
    }

    if (btn.dataset.action === "toggle") {
      await window.birHesab.invoke("reminders:toggle-done", {
        id,
        isDone: !item.isDone
      });
      await refresh();
      return;
    }

    if (btn.dataset.action === "delete") {
      if (!confirm("این یادآور حذف شود؟")) return;
      await window.birHesab.invoke("reminders:delete", { id });
      if (editingReminderId === id) {
        resetFormState();
      }
      await refresh();
    }
  });

  reminderFormReset?.addEventListener("click", () => {
    resetFormState();
  });

  reminderForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const reminderDate = toCanonicalJalaliDate(reminderDateInput.value);
    if (!parseJalaliDate(reminderDate)) {
      alert("تاریخ ریمایندر معتبر نیست.");
      return;
    }

    const payload = {
      title: reminderTitleInput.value.trim(),
      description: reminderDescInput.value.trim(),
      reminderDate,
      isDone: reminderDoneInput.value === "1"
    };

    if (!payload.title) {
      alert("عنوان ریمایندر را وارد کنید.");
      return;
    }

    if (editingReminderId) {
      await window.birHesab.invoke("reminders:update", {
        id: editingReminderId,
        ...payload
      });
    } else {
      await window.birHesab.invoke("reminders:create", payload);
    }

    selectedDate = reminderDate;
    const parsed = parseJalaliDate(reminderDate);
    if (parsed) {
      viewYear = parsed.jy;
      viewMonth = parsed.jm;
    }
    resetFormState();
    await refresh();
  });

  setTodayByDefault("reminderDate");
  await refresh();
}

async function initServicesSection() {
  const form = document.getElementById("serviceForm");
  const rows = document.getElementById("servicesRows");
  const search = document.getElementById("servicesSearch");
  const from = document.getElementById("servicesFrom");
  const to = document.getElementById("servicesTo");
  let editingId = null;
  let all = [];

  const filtered = () =>
    all.filter(
      (item) =>
        textMatch(search.value, item.name, item.pricingModel, item.description) &&
        inDateRange(item.createdAt, from.value, to.value)
    );

  const render = () => {
    rows.innerHTML = filtered()
      .map((service) => `<tr><td><span class="status-dot"></span>${service.name}</td><td>${service.pricingModel}</td><td>${formatCurrency(service.rate)}</td><td>${service.description || "-"}</td><td>${actionButtons(service.id, "service")}</td></tr>`)
      .join("");
  };

  const refresh = async () => {
    all = await window.birHesab.invoke("services:list");
    render();
  };

  rows.onclick = async (event) => {
    const btn = event.target.closest("button[data-scope='service']");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const item = all.find((x) => x.id === id);
    if (!item) return;

    if (btn.dataset.action === "edit") {
      editingId = id;
      document.getElementById("serviceName").value = item.name;
      document.getElementById("pricingModel").value = item.pricingModel;
      document.getElementById("serviceRate").value = formatMoneyInput(item.rate);
      document.getElementById("serviceDesc").value = item.description || "";
      return;
    }

    if (!confirm("این خدمت حذف شود؟")) return;
    await window.birHesab.invoke("services:delete", { id });
    if (editingId === id) {
      editingId = null;
      form.reset();
    }
    await refresh();
  };

  [search, from, to].forEach((el) => el.addEventListener("input", render));
  document.getElementById("servicesFilterReset").addEventListener("click", () => {
    search.value = "";
    from.value = "";
    to.value = "";
    render();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      name: document.getElementById("serviceName").value.trim(),
      pricingModel: document.getElementById("pricingModel").value,
      rate: parseMoneyInput(document.getElementById("serviceRate").value),
      description: document.getElementById("serviceDesc").value.trim()
    };
    if (editingId) {
      await window.birHesab.invoke("services:update", { id: editingId, ...payload });
    } else {
      await window.birHesab.invoke("services:create", payload);
    }
    editingId = null;
    form.reset();
    await refresh();
  });

  await refresh();
}

async function initProjectsSection() {
  const form = document.getElementById("projectForm");
  const rows = document.getElementById("projectsRows");
  const search = document.getElementById("projectsSearch");
  const statusFilter = document.getElementById("projectsStatusFilter");
  const from = document.getElementById("projectsFrom");
  const to = document.getElementById("projectsTo");
  const servicesList = document.getElementById("projectServicesList");

  let editingId = null;
  let all = [];
  let services = [];

  const loadServices = async () => {
    services = await window.birHesab.invoke("services:list");
    servicesList.innerHTML = services
      .map(
        (s) => `
          <label class="check-item">
            <input type="checkbox" class="project-service-checkbox" value="${s.id}" />
            <span>${s.name}</span>
          </label>
        `
      )
      .join("");
  };

  const getSelectedServiceIds = () =>
    Array.from(document.querySelectorAll(".project-service-checkbox:checked")).map((x) =>
      Number(x.value)
    );

  const setSelectedServiceIds = (ids) => {
    const set = new Set((ids || []).map((x) => Number(x)));
    document.querySelectorAll(".project-service-checkbox").forEach((cb) => {
      cb.checked = set.has(Number(cb.value));
    });
  };

  const filtered = () =>
    all.filter(
      (item) =>
        textMatch(search.value, item.title, item.clientName, item.status, item.serviceNames) &&
        (!statusFilter.value || item.status === statusFilter.value) &&
        inDateRange(item.startDate, from.value, to.value)
    );

  const render = () => {
    rows.innerHTML = filtered()
      .map(
        (project) =>
          `<tr><td>${project.title}</td><td>${project.clientName}</td><td>${project.serviceNames || "-"}</td><td>${project.status}</td><td>${actionButtons(project.id, "project")}</td></tr>`
      )
      .join("");
  };

  const refresh = async () => {
    all = await window.birHesab.invoke("projects:list");
    render();
  };

  rows.onclick = async (event) => {
    const btn = event.target.closest("button[data-scope='project']");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const item = all.find((x) => x.id === id);
    if (!item) return;

    if (btn.dataset.action === "edit") {
      editingId = id;
      document.getElementById("projectTitle").value = item.title;
      document.getElementById("projectClient").value = item.clientName;
      document.getElementById("projectStatus").value = item.status;
      document.getElementById("projectStart").value = item.startDate || getTodayJalaliDate();
      setSelectedServiceIds(item.serviceIds);
      document.getElementById("projectNotes").value = item.notes || "";
      return;
    }

    if (!confirm("این پروژه حذف شود؟")) return;
    await window.birHesab.invoke("projects:delete", { id });
    if (editingId === id) {
      editingId = null;
      form.reset();
    }
    await refresh();
  };

  [search, statusFilter, from, to].forEach((el) => el.addEventListener("input", render));
  document.getElementById("projectsFilterReset").addEventListener("click", () => {
    search.value = "";
    statusFilter.value = "";
    from.value = "";
    to.value = "";
    render();
  });

  await loadServices();
  setTodayByDefault("projectStart");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      title: document.getElementById("projectTitle").value.trim(),
      clientName: document.getElementById("projectClient").value.trim(),
      serviceIds: getSelectedServiceIds(),
      status: document.getElementById("projectStatus").value,
      startDate: document.getElementById("projectStart").value,
      notes: document.getElementById("projectNotes").value.trim()
    };

    if (editingId) {
      await window.birHesab.invoke("projects:update", { id: editingId, ...payload });
    } else {
      await window.birHesab.invoke("projects:create", payload);
    }

    editingId = null;
    form.reset();
    setSelectedServiceIds([]);
    setTodayByDefault("projectStart");
    await refresh();
  });

  await refresh();
}
async function initSettlementsSection() {
  const partnerForm = document.getElementById("partnerForm");
  const settlementForm = document.getElementById("settlementForm");
  const partnerTermForm = document.getElementById("partnerTermForm");
  const partnerRows = document.getElementById("partnersRows");
  const partnerPayablesRows = document.getElementById("partnerPayablesRows");
  const partnerTermsRows = document.getElementById("partnerTermsRows");
  const settlementRows = document.getElementById("settlementsRows");
  const termPartner = document.getElementById("termPartner");
  const termProject = document.getElementById("termProject");

  const partnerSearch = document.getElementById("partnersSearch");
  const partnerFrom = document.getElementById("partnersFrom");
  const partnerTo = document.getElementById("partnersTo");
  const settlementSearch = document.getElementById("settlementsSearch");
  const settlementTypeFilter = document.getElementById("settlementsTypeFilter");
  const settlementFrom = document.getElementById("settlementsFrom");
  const settlementTo = document.getElementById("settlementsTo");

  let editingPartnerId = null;
  let editingSettlementId = null;
  let partnersAll = [];
  let settlementsAll = [];
  let termsAll = [];

  const paymentLabel = (item) => {
    if (item.paymentModel === "percent") return `درصدی (${toPersianDigits(item.sharePercent)}%)`;
    const period = item.salaryPeriod === "weekly" ? "هفتگی" : "ماهانه";
    return `حقوق ${period}`;
  };

  const paymentValue = (item) => {
    if (item.paymentModel === "percent") return `${toPersianDigits(item.sharePercent)}%`;
    return formatCurrency(item.salaryAmount);
  };

  const filteredPartners = () =>
    partnersAll.filter(
      (item) =>
        textMatch(partnerSearch.value, item.fullName, item.role, paymentLabel(item)) &&
        inDateRange(item.createdAt, partnerFrom.value, partnerTo.value)
    );

  const filteredSettlements = () =>
    settlementsAll.filter(
      (item) =>
        textMatch(settlementSearch.value, item.settlementType, item.paymentMethod, item.description) &&
        (!settlementTypeFilter.value || item.settlementType === settlementTypeFilter.value) &&
        inDateRange(item.settlementDate, settlementFrom.value, settlementTo.value)
    );

  const renderPartners = () => {
    partnerRows.innerHTML = filteredPartners()
      .map(
        (partner) =>
          `<tr><td>${partner.fullName}</td><td>${paymentLabel(partner)}</td><td>${paymentValue(
            partner
          )}</td><td>${actionButtons(partner.id, "partner")}</td></tr>`
      )
      .join("");
  };

  const renderTerms = () => {
    partnerTermsRows.innerHTML = termsAll
      .map((term) => {
        const val =
          term.paymentModel === "percent"
            ? `${toPersianDigits(term.percentValue)}%`
            : formatCurrency(term.salaryAmount);
        return `<tr><td>${term.partnerName}</td><td>${term.projectTitle}</td><td>${term.paymentModel}</td><td>${val}</td><td>${actionButtons(
          term.id,
          "term"
        )}</td></tr>`;
      })
      .join("");
  };

  const renderPayables = async () => {
    const rows = await window.birHesab.invoke("partners:payables:list");
    partnerPayablesRows.innerHTML = rows
      .map((row) => {
        const model =
          row.paymentModel === "percent"
            ? `درصدی (${toPersianDigits(row.percentValue)}%)`
            : row.paymentModel === "salary_weekly"
              ? "حقوق هفتگی"
              : "حقوق ماهانه";
        const remainingClass = Number(row.remainingAmount || 0) > 0 ? "style=\"color:#d85b5b;font-weight:700\"" : "";
        return `<tr>
          <td>${row.partnerName}</td>
          <td>${row.projectTitle}</td>
          <td>${model}</td>
          <td>${formatCurrency(row.clientReceived)}</td>
          <td>${formatCurrency(row.dueAmount)}</td>
          <td>${formatCurrency(row.partnerPaid)}</td>
          <td ${remainingClass}>${formatCurrency(row.remainingAmount)}</td>
        </tr>`;
      })
      .join("");
  };

  const renderSettlements = () => {
    settlementRows.innerHTML = filteredSettlements()
      .map(
        (item) =>
          `<tr><td>${item.settlementType}</td><td>${formatCurrency(item.amount)}</td><td>${item.paymentMethod}</td><td>${toJalaliDate(
            item.settlementDate
          )}</td><td>${item.description || "-"}</td><td>${actionButtons(
            item.id,
            "settlement"
          )}</td></tr>`
      )
      .join("");
  };

  const refreshPartnerProjectSelectors = async () => {
    const projects = await window.birHesab.invoke("projects:list");
    termPartner.innerHTML = partnersAll
      .map((p) => `<option value="${p.id}">${p.fullName}</option>`)
      .join("");
    termProject.innerHTML = projects
      .map((p) => `<option value="${p.id}">${p.title}</option>`)
      .join("");
  };

  const refreshPartners = async () => {
    partnersAll = await window.birHesab.invoke("partners:list");
    renderPartners();
    await refreshPartnerProjectSelectors();
    await renderPayables();
  };

  const refreshTerms = async () => {
    termsAll = await window.birHesab.invoke("partners:terms:list");
    renderTerms();
    await renderPayables();
  };

  const refreshSettlements = async () => {
    settlementsAll = await window.birHesab.invoke("settlements:list");
    renderSettlements();
    await renderPayables();
  };

  partnerRows.onclick = async (event) => {
    const btn = event.target.closest("button[data-scope='partner']");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const item = partnersAll.find((x) => x.id === id);
    if (!item) return;

    if (btn.dataset.action === "edit") {
      editingPartnerId = id;
      document.getElementById("partnerName").value = item.fullName;
      document.getElementById("partnerRole").value = item.role || "";
      document.getElementById("partnerShare").value = item.sharePercent || 0;
      document.getElementById("partnerPaymentModel").value = item.paymentModel || "percent";
      document.getElementById("partnerSalaryAmount").value = formatMoneyInput(item.salaryAmount || 0);
      document.getElementById("partnerSalaryPeriod").value = item.salaryPeriod || "monthly";
      return;
    }

    if (!confirm("این همکار حذف شود؟")) return;
    await window.birHesab.invoke("partners:delete", { id });
    if (editingPartnerId === id) {
      editingPartnerId = null;
      partnerForm.reset();
    }
    await refreshPartners();
    await refreshTerms();
  };

  partnerTermsRows.onclick = async (event) => {
    const btn = event.target.closest("button[data-scope='term']");
    if (!btn || btn.dataset.action !== "delete") return;
    if (!confirm("این شرط پروژه حذف شود؟")) return;
    await window.birHesab.invoke("partners:terms:delete", { id: Number(btn.dataset.id) });
    await refreshTerms();
  };

  settlementRows.onclick = async (event) => {
    const btn = event.target.closest("button[data-scope='settlement']");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const item = settlementsAll.find((x) => x.id === id);
    if (!item) return;

    if (btn.dataset.action === "edit") {
      editingSettlementId = id;
      document.getElementById("settlementType").value = item.settlementType;
      document.getElementById("settlementRelated").value = item.relatedId || "";
      document.getElementById("settlementProject").value = item.projectId || "";
      document.getElementById("settlementAmount").value = formatMoneyInput(item.amount);
      document.getElementById("settlementMethod").value = item.paymentMethod || "cash";
      document.getElementById("settlementDate").value = item.settlementDate || getTodayJalaliDate();
      document.getElementById("settlementDesc").value = item.description || "";
      return;
    }

    if (!confirm("این تسویه حذف شود؟")) return;
    await window.birHesab.invoke("settlements:delete", { id });
    if (editingSettlementId === id) {
      editingSettlementId = null;
      settlementForm.reset();
    }
    await refreshSettlements();
  };

  [partnerSearch, partnerFrom, partnerTo].forEach((el) =>
    el.addEventListener("input", renderPartners)
  );
  [settlementSearch, settlementTypeFilter, settlementFrom, settlementTo].forEach((el) =>
    el.addEventListener("input", renderSettlements)
  );

  document.getElementById("partnersFilterReset").addEventListener("click", () => {
    partnerSearch.value = "";
    partnerFrom.value = "";
    partnerTo.value = "";
    renderPartners();
  });
  document.getElementById("settlementsFilterReset").addEventListener("click", () => {
    settlementSearch.value = "";
    settlementTypeFilter.value = "";
    settlementFrom.value = "";
    settlementTo.value = "";
    renderSettlements();
  });

  setTodayByDefault("settlementDate");
  partnerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      fullName: document.getElementById("partnerName").value.trim(),
      role: document.getElementById("partnerRole").value.trim(),
      sharePercent: Number(document.getElementById("partnerShare").value || 0),
      paymentModel: document.getElementById("partnerPaymentModel").value,
      salaryAmount: parseMoneyInput(document.getElementById("partnerSalaryAmount").value),
      salaryPeriod: document.getElementById("partnerSalaryPeriod").value
    };
    if (editingPartnerId) {
      await window.birHesab.invoke("partners:update", { id: editingPartnerId, ...payload });
    } else {
      await window.birHesab.invoke("partners:create", payload);
    }
    editingPartnerId = null;
    partnerForm.reset();
    await refreshPartners();
  });

  partnerTermForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await window.birHesab.invoke("partners:terms:upsert", {
      partnerId: termPartner.value,
      projectId: termProject.value,
      paymentModel: document.getElementById("termModel").value,
      percentValue: Number(document.getElementById("termPercent").value || 0),
      salaryAmount: parseMoneyInput(document.getElementById("termSalary").value)
    });
    partnerTermForm.reset();
    await refreshTerms();
  });

  settlementForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      settlementType: document.getElementById("settlementType").value,
      relatedId: document.getElementById("settlementRelated").value || null,
      projectId: document.getElementById("settlementProject").value || null,
      amount: parseMoneyInput(document.getElementById("settlementAmount").value),
      paymentMethod: document.getElementById("settlementMethod").value,
      settlementDate: document.getElementById("settlementDate").value,
      description: document.getElementById("settlementDesc").value.trim()
    };

    if (editingSettlementId) {
      await window.birHesab.invoke("settlements:update", { id: editingSettlementId, ...payload });
    } else {
      await window.birHesab.invoke("settlements:create", payload);
    }

    editingSettlementId = null;
    settlementForm.reset();
    setTodayByDefault("settlementDate");
    await refreshSettlements();
  });

  await refreshPartners();
  await refreshTerms();
  await refreshSettlements();
}

async function initExpensesSection() {
  const form = document.getElementById("expenseForm");
  const rows = document.getElementById("expensesRows");
  const search = document.getElementById("expensesSearch");
  const scopeFilter = document.getElementById("expensesScopeFilter");
  const from = document.getElementById("expensesFrom");
  const to = document.getElementById("expensesTo");
  let editingId = null;
  let all = [];

  const filtered = () =>
    all.filter(
      (item) =>
        textMatch(search.value, item.scope, item.category, item.description, item.paidBy) &&
        (!scopeFilter.value || item.scope === scopeFilter.value) &&
        inDateRange(item.expenseDate, from.value, to.value)
    );

  const render = () => {
    rows.innerHTML = filtered()
      .map((expense) => `<tr><td>${expense.scope}</td><td>${expense.category}</td><td>${formatCurrency(expense.amount)}</td><td>${toJalaliDate(expense.expenseDate)}</td><td>${expense.description || "-"}</td><td>${actionButtons(expense.id, "expense")}</td></tr>`)
      .join("");
  };

  const refresh = async () => {
    all = await window.birHesab.invoke("expenses:list");
    render();
  };

  rows.onclick = async (event) => {
    const btn = event.target.closest("button[data-scope='expense']");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const item = all.find((x) => x.id === id);
    if (!item) return;

    if (btn.dataset.action === "edit") {
      editingId = id;
      document.getElementById("expenseScope").value = item.scope;
      document.getElementById("expensePaidBy").value = item.paidBy || "";
      document.getElementById("expenseCategory").value = item.category || "";
      document.getElementById("expenseAmount").value = formatMoneyInput(item.amount);
      document.getElementById("expenseDate").value = item.expenseDate || getTodayJalaliDate();
      document.getElementById("expenseDesc").value = item.description || "";
      return;
    }

    if (!confirm("این هزینه حذف شود؟")) return;
    await window.birHesab.invoke("expenses:delete", { id });
    if (editingId === id) {
      editingId = null;
      form.reset();
    }
    await refresh();
  };

  [search, scopeFilter, from, to].forEach((el) => el.addEventListener("input", render));
  document.getElementById("expensesFilterReset").addEventListener("click", () => {
    search.value = "";
    scopeFilter.value = "";
    from.value = "";
    to.value = "";
    render();
  });

  setTodayByDefault("expenseDate");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      scope: document.getElementById("expenseScope").value,
      paidBy: document.getElementById("expensePaidBy").value.trim(),
      category: document.getElementById("expenseCategory").value.trim(),
      amount: parseMoneyInput(document.getElementById("expenseAmount").value),
      expenseDate: document.getElementById("expenseDate").value,
      description: document.getElementById("expenseDesc").value.trim()
    };

    if (editingId) {
      await window.birHesab.invoke("expenses:update", { id: editingId, ...payload });
    } else {
      await window.birHesab.invoke("expenses:create", payload);
    }

    editingId = null;
    form.reset();
    setTodayByDefault("expenseDate");
    await refresh();
  });

  await refresh();
}
async function initCashboxSection() {
  const form = document.getElementById("cashboxForm");
  const rows = document.getElementById("cashboxRows");
  const search = document.getElementById("cashboxSearch");
  const typeFilter = document.getElementById("cashboxTypeFilter");
  const from = document.getElementById("cashboxFrom");
  const to = document.getElementById("cashboxTo");
  const incomeBtn = document.getElementById("cashboxIncomeBtn");
  const expenseBtn = document.getElementById("cashboxExpenseBtn");
  let editingId = null;
  let all = [];

  const filtered = () => {
    return all.filter((item) => {
      const entryLabel = item.entryType === "in" ? "دخل" : "خرج";
      return (
        textMatch(search.value, entryLabel, item.category, item.description, item.referenceType) &&
        (!typeFilter.value || item.entryType === typeFilter.value) &&
        inDateRange(item.entryDate, from.value, to.value)
      );
    });
  };

  const render = () => {
    rows.innerHTML = filtered()
      .map((entry) => `<tr><td>${entry.entryType === "in" ? "دخل" : "خرج"}</td><td>${formatCurrency(entry.amount)}</td><td>${toJalaliDate(entry.entryDate)}</td><td>${entry.description || "-"}</td><td>${actionButtons(entry.id, "cashbox")}</td></tr>`)
      .join("");
  };

  const refresh = async () => {
    all = await window.birHesab.invoke("cashbox:list");
    render();
  };

  rows.onclick = async (event) => {
    const btn = event.target.closest("button[data-scope='cashbox']");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const item = all.find((x) => x.id === id);
    if (!item) return;

    if (btn.dataset.action === "edit") {
      editingId = id;
      document.getElementById("cashboxAmount").value = formatMoneyInput(item.amount);
      document.getElementById("cashboxDate").value = item.entryDate || getTodayJalaliDate();
      document.getElementById("cashboxDesc").value = item.description || "";
      return;
    }

    if (!confirm("این تراکنش صندوق حذف شود؟")) return;
    await window.birHesab.invoke("cashbox:delete", { id });
    if (editingId === id) {
      editingId = null;
      form.reset();
    }
    await refresh();
  };

  [search, typeFilter, from, to].forEach((el) => el.addEventListener("input", render));
  document.getElementById("cashboxFilterReset").addEventListener("click", () => {
    search.value = "";
    typeFilter.value = "";
    from.value = "";
    to.value = "";
    render();
  });

  setTodayByDefault("cashboxDate");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
  });

  const submitCashbox = async (entryType) => {
    if (!form.reportValidity()) return;
    const payload = {
      entryType,
      category: "",
      amount: parseMoneyInput(document.getElementById("cashboxAmount").value),
      entryDate: document.getElementById("cashboxDate").value,
      referenceType: "",
      referenceId: null,
      description: document.getElementById("cashboxDesc").value.trim()
    };

    if (editingId) {
      await window.birHesab.invoke("cashbox:update", { id: editingId, ...payload });
    } else {
      await window.birHesab.invoke("cashbox:create", payload);
    }

    editingId = null;
    form.reset();
    setTodayByDefault("cashboxDate");
    await refresh();
  };

  incomeBtn?.addEventListener("click", () => {
    submitCashbox("in");
  });
  expenseBtn?.addEventListener("click", () => {
    submitCashbox("out");
  });

  await refresh();
}

function setupBackupEvents() {
  const backupBtn = document.getElementById("createBackupBtn");
  const restoreBtn = document.getElementById("restoreBackupBtn");
  const settingsBtn = document.getElementById("backupSettingsBtn");

  const settingsModal = document.getElementById("backupSettingsModal");
  const closeSettingsBtn = document.getElementById("closeBackupSettingsBtn");
  const saveSettingsBtn = document.getElementById("saveAutoBackupSettingsBtn");
  const runAutoNowBtn = document.getElementById("runAutoBackupNowBtn");
  const enabledInput = document.getElementById("autoBackupEnabled");
  const scheduleInput = document.getElementById("autoBackupSchedule");
  const keepLastInput = document.getElementById("autoBackupKeepLast");
  const lastInfo = document.getElementById("autoBackupLastInfo");
  const dueInfo = document.getElementById("autoBackupDueInfo");
  const filesInfo = document.getElementById("autoBackupFilesInfo");

  if (!backupBtn || !restoreBtn) return;

  backupBtn.addEventListener("click", async () => {
    backupBtn.disabled = true;
    const prevLabel = backupBtn.textContent;
    backupBtn.textContent = "در حال ساخت پشتیبان...";
    try {
      const result = await window.birHesab.invoke("system:backup:create");
      if (!result?.canceled) {
        alert("فایل پشتیبان با موفقیت ذخیره شد.");
      }
    } catch (error) {
      alert(`خطا در پشتیبان‌گیری: ${error.message}`);
    } finally {
      backupBtn.disabled = false;
      backupBtn.textContent = prevLabel;
    }
  });

  restoreBtn.addEventListener("click", async () => {
    restoreBtn.disabled = true;
    const prevLabel = restoreBtn.textContent;
    restoreBtn.textContent = "در حال بازیابی...";
    try {
      await window.birHesab.invoke("system:backup:restore");
    } catch (error) {
      alert(`خطا در بازیابی پشتیبان: ${error.message}`);
    } finally {
      restoreBtn.disabled = false;
      restoreBtn.textContent = prevLabel;
    }
  });

  const hasSettingsUi =
    settingsBtn &&
    settingsModal &&
    closeSettingsBtn &&
    saveSettingsBtn &&
    runAutoNowBtn &&
    enabledInput &&
    scheduleInput &&
    keepLastInput &&
    lastInfo &&
    dueInfo &&
    filesInfo;

  if (!hasSettingsUi) return;

  const formatDateTime = (isoString) => {
    if (!isoString) return "هنوز اجرا نشده است.";
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return isoString;
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Asia/Tehran"
    }).format(date);
  };

  const renderSettingsState = (payload) => {
    const settings = payload?.settings || {};
    enabledInput.value = settings.enabled ? "1" : "0";
    scheduleInput.value = settings.schedule === "weekly" ? "weekly" : "daily";
    keepLastInput.value = String(settings.keepLast || 14);

    lastInfo.textContent = `آخرین اجرای بکاپ خودکار: ${formatDateTime(settings.lastBackupAt)}`;
    dueInfo.textContent = payload?.dueNow
      ? "الان زمان اجرای بکاپ خودکار رسیده است."
      : "فعلاً بکاپ خودکار طبق برنامه است.";

    const files = Array.isArray(payload?.recentBackups) ? payload.recentBackups : [];
    if (!files.length) {
      filesInfo.textContent = "هنوز بکاپ خودکار ذخیره نشده است.";
      return;
    }
    filesInfo.textContent = `تعداد بکاپ‌های موجود: ${toPersianDigits(files.length)} | جدیدترین فایل: ${files[0].name}`;
  };

  const loadSettingsState = async () => {
    const payload = await window.birHesab.invoke("system:backup:settings:get");
    renderSettingsState(payload);
  };

  settingsBtn.addEventListener("click", async () => {
    try {
      await loadSettingsState();
      settingsModal.classList.remove("hidden");
    } catch (error) {
      alert(`خطا در بارگذاری تنظیمات بکاپ: ${error.message}`);
    }
  });

  closeSettingsBtn.addEventListener("click", () => {
    settingsModal.classList.add("hidden");
  });

  settingsModal.addEventListener("click", (event) => {
    if (event.target === settingsModal) {
      settingsModal.classList.add("hidden");
    }
  });

  saveSettingsBtn.addEventListener("click", async () => {
    const keepLast = Number.parseInt(normalizeDigits(keepLastInput.value || ""), 10);
    if (!Number.isFinite(keepLast) || keepLast < 1 || keepLast > 120) {
      alert("تعداد نگهداری باید بین ۱ تا ۱۲۰ باشد.");
      return;
    }

    saveSettingsBtn.disabled = true;
    const prevLabel = saveSettingsBtn.textContent;
    saveSettingsBtn.textContent = "در حال ذخیره...";
    try {
      const payload = await window.birHesab.invoke("system:backup:settings:update", {
        enabled: enabledInput.value === "1",
        schedule: scheduleInput.value,
        keepLast
      });
      renderSettingsState(payload);
      alert("تنظیمات بکاپ خودکار ذخیره شد.");
    } catch (error) {
      alert(`خطا در ذخیره تنظیمات: ${error.message}`);
    } finally {
      saveSettingsBtn.disabled = false;
      saveSettingsBtn.textContent = prevLabel;
    }
  });

  runAutoNowBtn.addEventListener("click", async () => {
    runAutoNowBtn.disabled = true;
    const prevLabel = runAutoNowBtn.textContent;
    runAutoNowBtn.textContent = "در حال اجرا...";
    try {
      const result = await window.birHesab.invoke("system:backup:auto:run");
      if (result?.skipped) {
        alert("بکاپ خودکار غیرفعال است. ابتدا آن را فعال کنید.");
      } else {
        alert("بکاپ خودکار با موفقیت اجرا شد.");
      }
      await loadSettingsState();
    } catch (error) {
      alert(`خطا در اجرای بکاپ خودکار: ${error.message}`);
    } finally {
      runAutoNowBtn.disabled = false;
      runAutoNowBtn.textContent = prevLabel;
    }
  });
}

function setupUpdaterEvents() {
  const status = document.getElementById("updateStatus");
  const checkBtn = document.getElementById("checkUpdateBtn");
  const actionBtn = document.getElementById("updateActionBtn");
  if (!status || !checkBtn || !actionBtn) return;

  const statusClasses = ["update-info", "update-ok", "update-warning", "update-error"];

  const setStatus = (text, kind = "info") => {
    status.classList.remove(...statusClasses);
    status.classList.add(`update-${kind}`);
    status.textContent = text;
  };

  const setActionState = (action) => {
    if (!action) {
      actionBtn.classList.add("hidden");
      actionBtn.dataset.action = "";
      actionBtn.disabled = false;
      actionBtn.textContent = "دانلود آپدیت";
      return;
    }
    actionBtn.classList.remove("hidden");
    actionBtn.disabled = false;
    actionBtn.dataset.action = action;
    actionBtn.textContent =
      action === "install" ? "نصب آپدیت و راه‌اندازی مجدد" : "دانلود آپدیت";
  };

  const applyCheckResult = (payload) => {
    if (!payload) return;

    if (payload.hasUpdate) {
      setStatus(
        `نسخه ${toPersianDigits(payload.latestVersion)} آماده دانلود است`,
        "warning"
      );
      setActionState("download");
      return;
    }

    if (String(payload.message || "").includes("No updater source configured")) {
      setStatus("منبع آپدیت تنظیم نشده است (GitHub Repo یا updateUrl)", "error");
      setActionState(null);
      return;
    }

    setStatus(`نسخه ${toPersianDigits(payload.currentVersion)} به‌روز است`, "ok");
    setActionState(null);
  };

  const runCheck = async () => {
    checkBtn.disabled = true;
    checkBtn.textContent = "در حال بررسی...";
    setStatus("در حال بررسی نسخه جدید...", "info");
    try {
      const result = await window.birHesab.invoke("updater:check");
      applyCheckResult(result);
    } catch (error) {
      setStatus(`خطا در بررسی آپدیت: ${error.message}`, "error");
    } finally {
      checkBtn.disabled = false;
      checkBtn.textContent = "بررسی آپدیت";
    }
  };

  checkBtn.addEventListener("click", () => {
    runCheck();
  });

  actionBtn.addEventListener("click", async () => {
    const action = actionBtn.dataset.action;
    if (action === "download") {
      actionBtn.disabled = true;
      setStatus("در حال دانلود آپدیت...", "info");
      try {
        await window.birHesab.invoke("updater:download");
      } catch (error) {
        setStatus(`خطا در دانلود: ${error.message}`, "error");
        actionBtn.disabled = false;
      }
      return;
    }

    if (action === "install") {
      actionBtn.disabled = true;
      setStatus("در حال شروع نصب آپدیت...", "info");
      try {
        await window.birHesab.invoke("updater:install");
      } catch (error) {
        setStatus(`خطا در اجرای نصب: ${error.message}`, "error");
        actionBtn.disabled = false;
      }
    }
  });

  window.birHesab.on("update:available", (payload) => {
    applyCheckResult(payload);
  });

  window.birHesab.on("update:none", (payload) => {
    applyCheckResult(payload);
  });

  window.birHesab.on("update:download-progress", (payload) => {
    if (typeof payload.percent === "number") {
      setStatus(`دانلود آپدیت: ${toPersianDigits(payload.percent)}٪`, "info");
    } else {
      setStatus("دانلود آپدیت در حال انجام است...", "info");
    }
  });

  window.birHesab.on("update:downloaded", (payload) => {
    setStatus(
      `نسخه ${toPersianDigits(payload.latestVersion || payload.version)} دانلود شد`,
      "ok"
    );
    setActionState("install");
  });

  window.birHesab.on("update:installing", () => {
    setStatus("در حال نصب آپدیت و بستن برنامه...", "info");
  });

  window.birHesab.on("update:error", (payload) => {
    setStatus(`خطای آپدیت: ${payload.message}`, "error");
    if (actionBtn.dataset.action === "download") {
      actionBtn.disabled = false;
    }
  });

  runCheck();
}

function setupHelpModal() {
  const openBtn = document.getElementById("openHelpBtn");
  const closeBtn = document.getElementById("closeHelpBtn");
  const modal = document.getElementById("helpModal");
  const content = document.getElementById("helpContent");
  if (!openBtn || !closeBtn || !modal || !content) return;

  const renderHelp = () => {
    const text = helpMap[state.section] || "برای این بخش هنوز متن آموزشی ثبت نشده است.";
    const blocks = text.split("\n\n");
    content.innerHTML = blocks
      .map((block, index) =>
        index === 0
          ? `<p class="help-text"><strong>${block}</strong></p>`
          : `<p class="help-text">${block}</p>`
      )
      .join("");
  };

  openBtn.addEventListener("click", () => {
    renderHelp();
    modal.classList.remove("hidden");
  });
  closeBtn.addEventListener("click", () => {
    modal.classList.add("hidden");
  });
}

async function bootstrap() {
  if (SIMPLE_UI_ENABLED) {
    state.section = SIMPLE_SECTION;
    document.body.classList.add("simple-ui");
  }
  setupModeTabs();
  setupHelpModal();
  await initSidebar();
  await renderSection();
  setupBackupEvents();
  setupUpdaterEvents();
}

bootstrap().catch((error) => {
  const content = document.getElementById("content");
  if (content) {
    content.innerHTML = `<div class="section-card"><h3>خطا در بارگذاری برنامه</h3><p>${error.message}</p></div>`;
  }
});
