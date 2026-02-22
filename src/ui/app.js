const SIMPLE_UI_ENABLED = false;
const SIMPLE_SECTION = "cashbox";

const state = {
  section: SIMPLE_UI_ENABLED ? SIMPLE_SECTION : "dashboard-birino"
};

let reminderNotificationsTimer = null;
let reminderAlertModalBound = false;
let reminderAlertItems = [];
let reminderAlertLastDueTodayCount = 0;
let calendarEventsDatasetPromise = null;
const assistantUiState = {
  messages: [],
  pendingActions: []
};

const sectionMap = {
  "dashboard-birino": "components/dashboard-birino.html",
  services: "components/services.html",
  projects: "components/projects.html",
  settlements: "components/settlements.html",
  reminders: "components/reminders.html",
  expenses: "components/expenses.html",
  cashbox: "components/cashbox.html",
  assistant: "components/assistant.html"
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
    "💵 اینجا خیلی ساده فقط دخل و خرج ثبت می‌کنی.\n\n✅ مبلغ، تاریخ و توضیح را وارد کن.\n✅ اگر پول گرفتی «ثبت دخل» را بزن.\n✅ اگر پول دادی «ثبت خرج» را بزن.\n\n👶 مثال:\nدخل: ۱۵,۰۰۰,۰۰۰ از کارفرما\nخرج: ۴,۰۰۰,۰۰۰ برای همکار",
  assistant:
    "🤖 اینجا دستیار هوش مصنوعی برنامه است.\n\n✅ چه کار می‌کند؟\n۱) ثبت حسابداری با چت\n۲) ارائه گزارش مالی محاوره‌ای\n۳) پیشنهاد عملیات و اجرای آن بعد از تایید شما\n\n👶 مثال:\n«امروز ۲ میلیون از دوستم گرفتم»\n«برای سوپرمارکت ۸۵۰ هزار پرداخت کن»"
};

const quickGuideMap = {
  "dashboard-birino": ["📌 خلاصه مالی", "👀 بررسی مانده", "📤 خروجی گزارش", "✅ تصمیم سریع"],
  services: ["۱️⃣ اسم خدمت", "۲️⃣ مدل قیمت", "۳️⃣ ثبت نرخ", "✅ ذخیره"],
  projects: ["۱️⃣ اسم پروژه", "۲️⃣ انتخاب خدمات", "۳️⃣ انتخاب وضعیت", "✅ ثبت"],
  settlements: ["۱️⃣ تعریف همکار", "۲️⃣ شرط پروژه", "۳️⃣ ثبت تسویه", "✅ دیدن مانده"],
  reminders: ["۱️⃣ انتخاب روز", "۲️⃣ ثبت یادآور", "۳️⃣ دیدن دریافتی/پرداختی", "✅ پیگیری روزانه"],
  expenses: ["۱️⃣ انتخاب دامنه", "۲️⃣ ثبت مبلغ", "۳️⃣ ثبت تاریخ", "✅ ذخیره"],
  cashbox: ["۱️⃣ ثبت مبلغ", "۲️⃣ ثبت تاریخ", "۳️⃣ ثبت توضیح", "✅ دکمه دخل یا خرج"],
  assistant: ["۱️⃣ نوشتن درخواست", "۲️⃣ دیدن پیشنهاد عملیات", "۳️⃣ تایید اجرا", "✅ ثبت و گزارش هوشمند"]
};

const JALALI_MONTH_NAMES = Object.freeze([
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
]);

const JALALI_WEEKDAY_NAMES = Object.freeze([
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه"
]);

const pricingModelLabels = Object.freeze({
  hourly: "ساعتی",
  daily: "روزانه",
  weekly: "هفتگی",
  monthly: "ماهانه",
  project: "پروژه‌ای",
  "per-minute": "دقیقه‌ای"
});

const projectStatusLabels = Object.freeze({
  open: "باز",
  "in-progress": "درحال انجام",
  done: "تکمیل شده",
  cancelled: "لغو شده"
});

const expenseScopeLabels = Object.freeze({
  business: "کسب‌وکار",
  shared: "مشترک"
});

const settlementMethodLabels = Object.freeze({
  cash: "نقدی",
  card: "کارت",
  bank: "بانک"
});

function labelFromMap(mapObj, value, fallback = "-") {
  const key = String(value || "");
  return mapObj[key] || key || fallback;
}

function scrollToFormTop(formElement) {
  if (!formElement?.scrollIntoView) return;
  formElement.scrollIntoView({ behavior: "smooth", block: "start" });
}

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

function sanitizeCalendarEventText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCalendarEventItem(item) {
  return {
    description: sanitizeCalendarEventText(item?.description),
    additionalDescription: sanitizeCalendarEventText(item?.additionalDescription),
    isHoliday: Boolean(item?.isHoliday),
    isReligious: Boolean(item?.isReligious)
  };
}

function buildCalendarEventsMapFromPayload(payload) {
  const map = new Map();
  const days = payload?.days && typeof payload.days === "object" ? payload.days : {};

  Object.entries(days).forEach(([rawDate, rawDay]) => {
    const dateStr = toCanonicalJalaliDate(rawDate);
    if (!parseJalaliDate(dateStr)) return;

    const seen = new Set();
    const events = (Array.isArray(rawDay?.events) ? rawDay.events : [])
      .map((item) => normalizeCalendarEventItem(item))
      .filter((item) => item.description)
      .filter((item) => {
        const key = [
          item.description,
          item.additionalDescription,
          item.isHoliday ? "1" : "0",
          item.isReligious ? "1" : "0"
        ].join("|");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    map.set(dateStr, {
      isOfficialHoliday: Boolean(rawDay?.isHoliday),
      events
    });
  });

  return map;
}

async function loadCalendarEventsDataset() {
  if (calendarEventsDatasetPromise) {
    return calendarEventsDatasetPromise;
  }

  calendarEventsDatasetPromise = (async () => {
    try {
      const payload = await window.birHesab.invoke("calendar:events:dataset");
      return buildCalendarEventsMapFromPayload(payload);
    } catch {
      try {
        const response = await fetch("../data/calendar-events-1404-1405.json", {
          cache: "no-store"
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        return buildCalendarEventsMapFromPayload(payload);
      } catch {
        return new Map();
      }
    }
  })();

  return calendarEventsDatasetPromise;
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
  return `${JALALI_MONTH_NAMES[jm - 1] || ""} ${toPersianDigits(jy)}`;
}

function jalaliWeekdayLabel(jy, jm, jd) {
  return JALALI_WEEKDAY_NAMES[jalaliWeekdayIndex(jy, jm, jd)] || "";
}

function formatGregorianDateLabel(jy, jm, jd) {
  const g = toGregorian(jy, jm, jd);
  const date = new Date(g.gy, g.gm - 1, g.gd);
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeZone: "Asia/Tehran"
  }).format(date);
}

function jalaliDateToJdn(dateValue) {
  const parsed = parseJalaliDate(dateValue);
  if (!parsed) return null;
  return j2d(parsed.jy, parsed.jm, parsed.jd);
}

function compareJalaliDates(a, b) {
  const aJdn = jalaliDateToJdn(a);
  const bJdn = jalaliDateToJdn(b);
  if (aJdn === null || bJdn === null) return 0;
  if (aJdn < bJdn) return -1;
  if (aJdn > bJdn) return 1;
  return 0;
}

function normalizeReminderRepeatType(value) {
  const v = String(value || "none").toLowerCase();
  if (v === "daily" || v === "weekly" || v === "monthly") return v;
  return "none";
}

function getReminderPatternLabel(reminder) {
  const repeatType = normalizeReminderRepeatType(reminder.repeatType);
  if (repeatType === "daily") return "روزانه";
  if (repeatType === "weekly") return "هفتگی";
  if (repeatType === "monthly") return "ماهانه";
  return "بدون تکرار";
}

function reminderOccursOnDate(reminder, targetDate) {
  const start = parseJalaliDate(reminder.reminderDate);
  const target = parseJalaliDate(targetDate);
  if (!start || !target) return false;

  const startJdn = j2d(start.jy, start.jm, start.jd);
  const targetJdn = j2d(target.jy, target.jm, target.jd);
  if (targetJdn < startJdn) return false;

  const repeatType = normalizeReminderRepeatType(reminder.repeatType);
  const repeatUntil = parseJalaliDate(reminder.repeatUntil || "");
  if (repeatUntil) {
    const untilJdn = j2d(repeatUntil.jy, repeatUntil.jm, repeatUntil.jd);
    if (targetJdn > untilJdn) return false;
  }

  if (repeatType === "none") {
    return targetJdn === startJdn;
  }

  if (repeatType === "daily") {
    return true;
  }

  if (repeatType === "weekly") {
    return (targetJdn - startJdn) % 7 === 0;
  }

  if (repeatType === "monthly") {
    const monthsDiff = (target.jy - start.jy) * 12 + (target.jm - start.jm);
    if (monthsDiff < 0) return false;
    const expectedDay = Math.min(start.jd, jalaliMonthLength(target.jy, target.jm));
    return target.jd === expectedDay;
  }

  return false;
}

function normalizeReminderTime(value) {
  const v = normalizeDigits(String(value || "")).trim();
  const m = v.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "09:00";
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return "09:00";
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return "09:00";
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function reminderTimeToMinutes(value) {
  const normalized = normalizeReminderTime(value);
  const [hh, mm] = normalized.split(":").map((x) => Number(x));
  return hh * 60 + mm;
}

function getNowTehranTimeMinutes() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Tehran"
  }).formatToParts(new Date());
  const hh = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const mm = Number(parts.find((p) => p.type === "minute")?.value || 0);
  return hh * 60 + mm;
}

function getReminderSnoozeLabel(reminder) {
  if (!reminder?.snoozeUntil) return "-";
  const d = new Date(reminder.snoozeUntil);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Tehran"
  }).format(d);
}

function isReminderDueNow(reminder, todayJalali, nowDate = new Date()) {
  if (Number(reminder.isDone || 0) === 1) return false;
  if (!reminderOccursOnDate(reminder, todayJalali)) return false;

  const snoozeUntilMs = Date.parse(reminder.snoozeUntil || "");
  if (!Number.isNaN(snoozeUntilMs)) {
    return nowDate.getTime() >= snoozeUntilMs;
  }

  const nowMinutes = getNowTehranTimeMinutes();
  const reminderMinutes = reminderTimeToMinutes(reminder.reminderTime || "09:00");
  return nowMinutes >= reminderMinutes;
}

function getReminderTriggerReference(reminder, todayJalali) {
  const snoozeUntilMs = Date.parse(reminder.snoozeUntil || "");
  if (!Number.isNaN(snoozeUntilMs)) {
    return `snooze:${new Date(snoozeUntilMs).toISOString()}`;
  }
  const time = normalizeReminderTime(reminder.reminderTime || "09:00");
  return `slot:${todayJalali} ${time}`;
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
  if (section === "assistant") return initAssistantSection();
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
  const reminderTimeInput = document.getElementById("reminderTime");
  const reminderRepeatTypeInput = document.getElementById("reminderRepeatType");
  const reminderRepeatUntilInput = document.getElementById("reminderRepeatUntil");
  const reminderProjectInput = document.getElementById("reminderProject");
  const reminderPartnerInput = document.getElementById("reminderPartner");
  const reminderFormReset = document.getElementById("reminderFormReset");
  const remindersRows = document.getElementById("remindersRows");
  const calendarGrid = document.getElementById("jalaliCalendarGrid");
  const monthTitle = document.getElementById("calendarMonthTitle");
  const prevMonthBtn = document.getElementById("calendarPrevMonth");
  const nextMonthBtn = document.getElementById("calendarNextMonth");
  const dayDetails = document.getElementById("calendarDayDetails");
  const reminderInAppNotice = document.getElementById("reminderInAppNotice");

  const filterShowReminders = document.getElementById("calendarFilterShowReminders");
  const filterShowReceivables = document.getElementById("calendarFilterShowReceivables");
  const filterShowPayables = document.getElementById("calendarFilterShowPayables");
  const filterProject = document.getElementById("calendarFilterProject");
  const filterPartner = document.getElementById("calendarFilterPartner");
  const filterReminderStatus = document.getElementById("calendarFilterReminderStatus");
  const calendarQuickAddBtn = document.getElementById("calendarQuickAddBtn");
  const calendarGoTodayBtn = document.getElementById("calendarGoTodayBtn");
  const calendarClearFiltersBtn = document.getElementById("calendarClearFiltersBtn");
  const remindersListSearch = document.getElementById("remindersListSearch");
  const remindersListStatus = document.getElementById("remindersListStatus");
  const remindersListReset = document.getElementById("remindersListReset");
  const dayCardModal = document.getElementById("calendarDayModal");
  const dayCardModalClose = document.getElementById("calendarDayModalClose");
  const dayCardDateLabel = document.getElementById("dayCardDateLabel");
  const dayCardDateMeta = document.getElementById("dayCardDateMeta");
  const dayCardStatusTags = document.getElementById("dayCardStatusTags");
  const dayCardTotals = document.getElementById("dayCardTotals");
  const dayCardEventsList = document.getElementById("dayCardEventsList");
  const dayCardRemindersList = document.getElementById("dayCardRemindersList");
  const dayCardSettlementsList = document.getElementById("dayCardSettlementsList");
  const dayCardReminderForm = document.getElementById("dayCardReminderForm");
  const dayCardReminderTitleInput = document.getElementById("dayCardReminderTitle");
  const dayCardReminderTimeInput = document.getElementById("dayCardReminderTime");
  const dayCardReminderRepeatTypeInput = document.getElementById("dayCardReminderRepeatType");
  const dayCardReminderProjectInput = document.getElementById("dayCardReminderProject");
  const dayCardReminderPartnerInput = document.getElementById("dayCardReminderPartner");
  const dayCardReminderDescInput = document.getElementById("dayCardReminderDescription");
  const dayCardReminderReset = document.getElementById("dayCardReminderReset");
  const dayCardSettlementForm = document.getElementById("dayCardSettlementForm");
  const dayCardSettlementTypeInput = document.getElementById("dayCardSettlementType");
  const dayCardSettlementAmountInput = document.getElementById("dayCardSettlementAmount");
  const dayCardSettlementMethodInput = document.getElementById("dayCardSettlementMethod");
  const dayCardSettlementProjectInput = document.getElementById("dayCardSettlementProject");
  const dayCardSettlementPartnerInput = document.getElementById("dayCardSettlementPartner");
  const dayCardSettlementCounterpartyInput = document.getElementById(
    "dayCardSettlementCounterparty"
  );
  const dayCardSettlementPartnerHint = document.getElementById("dayCardSettlementPartnerHint");
  const dayCardSettlementDescInput = document.getElementById("dayCardSettlementDescription");
  const dayCardSettlementReset = document.getElementById("dayCardSettlementReset");

  const today = parseJalaliDate(getTodayJalaliDate()) || { jy: 1404, jm: 1, jd: 1 };
  let viewYear = today.jy;
  let viewMonth = today.jm;
  let selectedDate = formatJalaliDateParts(today.jy, today.jm, today.jd);
  let editingReminderId = null;
  let reminders = [];
  let settlements = [];
  let projects = [];
  let partners = [];
  let calendarEventsByDate = new Map();

  const normalizeReminderRows = (rows) =>
    (rows || []).map((row) => ({
      ...row,
      reminderDate: toCanonicalJalaliDate(row.reminderDate),
      reminderTime: normalizeReminderTime(row.reminderTime || "09:00"),
      repeatType: normalizeReminderRepeatType(row.repeatType),
      repeatUntil: row.repeatUntil ? toCanonicalJalaliDate(row.repeatUntil) : "",
      snoozeUntil: row.snoozeUntil || "",
      projectId: row.projectId ? Number(row.projectId) : null,
      partnerId: row.partnerId ? Number(row.partnerId) : null,
      isDone: Number(row.isDone || 0)
    }));

  const normalizeSettlementRows = (rows) =>
    (rows || []).map((row) => ({
      ...row,
      settlementType: String(row.settlementType || ""),
      settlementDate: toCanonicalJalaliDate(row.settlementDate),
      amount: Number(row.amount || 0),
      projectId: row.projectId ? Number(row.projectId) : null,
      partnerId: row.relatedId ? Number(row.relatedId) : null,
      counterpartyName: String(row.counterpartyName || "").trim()
    }));

  const syncDayCardSettlementTypeState = () => {
    if (!dayCardSettlementTypeInput) return;
    const isPartnerPayment = dayCardSettlementTypeInput.value === "partner";
    if (dayCardSettlementPartnerInput) {
      dayCardSettlementPartnerInput.required = false;
    }
    if (dayCardSettlementPartnerHint) {
      dayCardSettlementPartnerHint.textContent = isPartnerPayment
        ? "برای پرداختی می‌توانید همکار را انتخاب کنید یا طرف حساب آزاد را وارد کنید."
        : "برای دریافتی هم می‌توانید طرف حساب آزاد یا همکار انتخاب کنید.";
    }
  };

  const renderNoticeBox = (dueNow, dueTodayCount) => {
    if (!reminderInAppNotice) return;
    if (!dueNow.length) {
      reminderInAppNotice.classList.add("hidden");
      reminderInAppNotice.innerHTML = "";
      return;
    }
    const topItems = dueNow
      .slice(0, 5)
      .map((item) => {
        const projectLabel = item.projectTitle ? ` | پروژه: ${item.projectTitle}` : "";
        const partnerLabel = item.partnerName ? ` | همکار: ${item.partnerName}` : "";
        const timeLabel = normalizeReminderTime(item.reminderTime || "09:00");
        return `<li>${item.title} | ساعت ${toPersianDigits(timeLabel)}${projectLabel}${partnerLabel}</li>`;
      })
      .join("");
    reminderInAppNotice.classList.remove("hidden");
    reminderInAppNotice.innerHTML = `
      <strong>یادآورهای فعال الان (${toPersianDigits(dueNow.length)}) از ${toPersianDigits(
        dueTodayCount
      )} مورد امروز</strong>
      <ul>${topItems}</ul>
    `;
  };

  const populateSelect = (selectEl, items, valueField, labelField, placeholder) => {
    if (!selectEl) return;
    const prevValue = selectEl.value;
    selectEl.innerHTML = `<option value="">${placeholder}</option>${items
      .map((item) => `<option value="${item[valueField]}">${item[labelField]}</option>`)
      .join("")}`;
    if (prevValue && items.some((item) => String(item[valueField]) === String(prevValue))) {
      selectEl.value = prevValue;
    }
  };

  const renderLookupSelects = () => {
    populateSelect(reminderProjectInput, projects, "id", "title", "بدون پروژه");
    populateSelect(reminderPartnerInput, partners, "id", "fullName", "بدون همکار");
    populateSelect(filterProject, projects, "id", "title", "همه پروژه‌ها");
    populateSelect(filterPartner, partners, "id", "fullName", "همه همکاران");
    populateSelect(dayCardReminderProjectInput, projects, "id", "title", "بدون پروژه");
    populateSelect(dayCardReminderPartnerInput, partners, "id", "fullName", "بدون همکار");
    populateSelect(dayCardSettlementProjectInput, projects, "id", "title", "بدون پروژه");
    populateSelect(dayCardSettlementPartnerInput, partners, "id", "fullName", "بدون همکار");
    syncDayCardSettlementTypeState();
  };

  const getFilters = () => ({
    showReminders: filterShowReminders?.checked !== false,
    showReceivables: filterShowReceivables?.checked !== false,
    showPayables: filterShowPayables?.checked !== false,
    projectId: filterProject?.value ? Number(filterProject.value) : null,
    partnerId: filterPartner?.value ? Number(filterPartner.value) : null,
    reminderStatus: filterReminderStatus?.value || "all"
  });

  const reminderMatchesFilters = (item, filters) => {
    if (filters.projectId && Number(item.projectId || 0) !== filters.projectId) return false;
    if (filters.partnerId && Number(item.partnerId || 0) !== filters.partnerId) return false;
    if (filters.reminderStatus === "open" && item.isDone) return false;
    if (filters.reminderStatus === "done" && !item.isDone) return false;
    return true;
  };

  const settlementMatchesFilters = (item, filters) => {
    if (filters.projectId && Number(item.projectId || 0) !== filters.projectId) return false;
    if (filters.partnerId && Number(item.partnerId || 0) !== filters.partnerId) return false;

    if (item.settlementType === "client") {
      return filters.showReceivables;
    }
    return filters.showPayables;
  };

  const getVisibleCalendarCells = () => {
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
      let jd;
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

      cells.push({
        jy,
        jm,
        jd,
        inCurrentMonth,
        dateStr: formatJalaliDateParts(jy, jm, jd)
      });
    }
    return cells;
  };

  const getDayCalendarMeta = (dateStr) => {
    const parsed = parseJalaliDate(dateStr);
    if (!parsed) {
      return {
        isFriday: false,
        isOfficialHoliday: false,
        events: [],
        weekdayLabel: "",
        jalaliLongLabel: toPersianDigits(dateStr || "-"),
        gregorianLabel: "-"
      };
    }

    const data = calendarEventsByDate.get(dateStr) || {
      isOfficialHoliday: false,
      events: []
    };
    const isFriday = jalaliWeekdayIndex(parsed.jy, parsed.jm, parsed.jd) === 6;
    const weekdayLabel = jalaliWeekdayLabel(parsed.jy, parsed.jm, parsed.jd);
    const monthLabel = JALALI_MONTH_NAMES[parsed.jm - 1] || "";

    return {
      isFriday,
      isOfficialHoliday: Boolean(data.isOfficialHoliday),
      events: Array.isArray(data.events) ? data.events : [],
      weekdayLabel,
      jalaliLongLabel: `${weekdayLabel} ${toPersianDigits(parsed.jd)} ${monthLabel} ${toPersianDigits(
        parsed.jy
      )}`,
      gregorianLabel: formatGregorianDateLabel(parsed.jy, parsed.jm, parsed.jd)
    };
  };

  const buildDaySnapshot = (dateStr, options = {}) => {
    const parsed = parseJalaliDate(dateStr);
    if (!parsed) return null;
    const normalizedDate = formatJalaliDateParts(parsed.jy, parsed.jm, parsed.jd);
    const applyFilters = options.applyFilters === true;
    const filters = applyFilters ? getFilters() : null;
    const calendarMeta = getDayCalendarMeta(normalizedDate);

    const remindersForDay = reminders
      .filter((item) => {
        if (!reminderOccursOnDate(item, normalizedDate)) return false;
        if (!applyFilters) return true;
        if (!filters.showReminders) return false;
        return reminderMatchesFilters(item, filters);
      })
      .sort((a, b) => {
        const diff =
          reminderTimeToMinutes(a.reminderTime || "09:00") -
          reminderTimeToMinutes(b.reminderTime || "09:00");
        if (diff !== 0) return diff;
        return Number(a.id || 0) - Number(b.id || 0);
      });

    const settlementsForDay = settlements
      .filter((item) => {
        if (item.settlementDate !== normalizedDate) return false;
        if (!applyFilters) return true;
        return settlementMatchesFilters(item, filters);
      })
      .sort((a, b) => Number(a.id || 0) - Number(b.id || 0));

    let receivable = 0;
    let payable = 0;
    settlementsForDay.forEach((item) => {
      if (item.settlementType === "client") {
        receivable += Number(item.amount || 0);
      } else {
        payable += Number(item.amount || 0);
      }
    });

    return {
      dateStr: normalizedDate,
      parsed,
      calendarMeta,
      reminders: remindersForDay,
      settlements: settlementsForDay,
      receivable,
      payable
    };
  };

  const buildDayMap = (visibleCells, filters) => {
    const map = new Map();
    visibleCells.forEach((cell) => {
      const meta = getDayCalendarMeta(cell.dateStr);
      map.set(toDateKey(cell.dateStr), {
        reminders: [],
        settlements: [],
        receivable: 0,
        payable: 0,
        isFriday: meta.isFriday,
        isOfficialHoliday: meta.isOfficialHoliday,
        events: meta.events
      });
    });

    if (filters.showReminders) {
      reminders.forEach((item) => {
        if (!reminderMatchesFilters(item, filters)) return;
        visibleCells.forEach((cell) => {
          if (!reminderOccursOnDate(item, cell.dateStr)) return;
          const bucket = map.get(toDateKey(cell.dateStr));
          if (!bucket) return;
          bucket.reminders.push(item);
        });
      });
    }

    settlements.forEach((item) => {
      if (!settlementMatchesFilters(item, filters)) return;
      const key = toDateKey(item.settlementDate);
      const bucket = map.get(key);
      if (!bucket) return;
      bucket.settlements.push(item);
      if (item.settlementType === "client") {
        bucket.receivable += Number(item.amount || 0);
      } else {
        bucket.payable += Number(item.amount || 0);
      }
    });

    return map;
  };

  const renderDayDetails = () => {
    if (!dayDetails) return;
    const snapshot = buildDaySnapshot(selectedDate, { applyFilters: true });
    if (!snapshot) {
      dayDetails.textContent = "برای مشاهده جزئیات، یک روز را انتخاب کنید.";
      return;
    }

    const meta = snapshot.calendarMeta;
    const statusParts = [];
    if (meta.isFriday) statusParts.push("جمعه");
    if (meta.isOfficialHoliday) statusParts.push("تعطیل رسمی");
    if (meta.events.length) statusParts.push(`${toPersianDigits(meta.events.length)} رویداد`);

    dayDetails.innerHTML = `
      <strong>${meta.jalaliLongLabel}</strong>
      <span class="inline-sep">|</span>
      <span>یادآور: ${toPersianDigits(snapshot.reminders.length)}</span>
      <span class="inline-sep">|</span>
      <span>دریافتی: ${formatCurrency(snapshot.receivable)}</span>
      <span class="inline-sep">|</span>
      <span>پرداختی: ${formatCurrency(snapshot.payable)}</span>
      ${
        statusParts.length
          ? `<br><span class="list-note">${statusParts.join(" | ")}</span>`
          : ""
      }
      <br><span class="list-note">برای جزئیات کامل و ثبت سریع، روی روز کلیک کنید.</span>
    `;
  };

  const renderDayCardModal = () => {
    if (!dayCardModal) return;
    const snapshot = buildDaySnapshot(selectedDate, { applyFilters: false });
    if (!snapshot) return;

    const { calendarMeta } = snapshot;
    if (dayCardDateLabel) {
      dayCardDateLabel.textContent = calendarMeta.jalaliLongLabel;
    }
    if (dayCardDateMeta) {
      dayCardDateMeta.textContent = `میلادی: ${calendarMeta.gregorianLabel}`;
    }

    if (dayCardStatusTags) {
      const tags = [];
      if (calendarMeta.isFriday) {
        tags.push('<span class="day-badge friday">جمعه</span>');
      }
      if (calendarMeta.isOfficialHoliday) {
        tags.push('<span class="day-badge holiday">تعطیل رسمی</span>');
      }
      if (calendarMeta.events.length) {
        tags.push(
          `<span class="day-badge event">رویداد ${toPersianDigits(
            calendarMeta.events.length
          )}</span>`
        );
      }
      dayCardStatusTags.innerHTML = tags.join("");
    }

    if (dayCardTotals) {
      dayCardTotals.innerHTML = `
        <span>دریافتی: ${formatCurrency(snapshot.receivable)}</span>
        <span class="inline-sep">|</span>
        <span>پرداختی: ${formatCurrency(snapshot.payable)}</span>
      `;
    }

    if (dayCardEventsList) {
      if (!calendarMeta.events.length) {
        dayCardEventsList.innerHTML = '<p class="list-note">رویدادی برای این روز ثبت نشده است.</p>';
      } else {
        dayCardEventsList.innerHTML = `
          <ul class="day-card-list">
            ${calendarMeta.events
              .map((eventItem) => {
                const tags = [];
                if (eventItem.isHoliday) {
                  tags.push('<span class="day-badge holiday">تعطیل</span>');
                }
                if (eventItem.isReligious) {
                  tags.push('<span class="day-badge religious">مذهبی</span>');
                } else {
                  tags.push('<span class="day-badge event">ایرانی/جهانی</span>');
                }
                if (eventItem.additionalDescription) {
                  tags.push(
                    `<span class="day-card-subtle">${escapeHtml(
                      eventItem.additionalDescription
                    )}</span>`
                  );
                }
                return `
                  <li class="day-card-item">
                    <div class="day-card-item-title">${escapeHtml(eventItem.description)}</div>
                    <div class="day-card-item-meta">${tags.join(" ")}</div>
                  </li>
                `;
              })
              .join("")}
          </ul>
        `;
      }
    }

    if (dayCardRemindersList) {
      if (!snapshot.reminders.length) {
        dayCardRemindersList.innerHTML = '<p class="list-note">یادآوری برای این روز وجود ندارد.</p>';
      } else {
        dayCardRemindersList.innerHTML = `
          <ul class="day-card-list">
            ${snapshot.reminders
              .map((item) => {
                const relation = [
                  item.projectTitle ? `پروژه: ${item.projectTitle}` : "",
                  item.partnerName ? `همکار: ${item.partnerName}` : ""
                ]
                  .filter(Boolean)
                  .join(" | ");
                const snoozeLabel = getReminderSnoozeLabel(item);
                return `
                  <li class="day-card-item">
                    <div class="day-card-item-head">
                      <strong>${escapeHtml(item.title || "-")}</strong>
                      <div class="row-actions">
                        <button type="button" class="btn-ghost" data-day-reminder-action="edit" data-id="${item.id}">ویرایش</button>
                        <button type="button" class="btn-secondary" data-day-reminder-action="toggle" data-id="${item.id}">${
                          item.isDone ? "بازکردن" : "تأیید انجام"
                        }</button>
                        <button type="button" class="btn-secondary" data-day-reminder-action="snooze30" data-id="${item.id}">اسنوز ۳۰د</button>
                      </div>
                    </div>
                    <div class="day-card-item-meta">
                      ساعت ${toPersianDigits(normalizeReminderTime(item.reminderTime || "09:00"))}
                      <span class="inline-sep">|</span>
                      ${getReminderPatternLabel(item)}
                      ${relation ? `<span class="inline-sep">|</span>${escapeHtml(relation)}` : ""}
                      ${
                        snoozeLabel !== "-"
                          ? `<span class="inline-sep">|</span>اسنوز تا ${escapeHtml(snoozeLabel)}`
                          : ""
                      }
                    </div>
                    ${
                      item.description
                        ? `<div class="day-card-item-note">${escapeHtml(item.description)}</div>`
                        : ""
                    }
                  </li>
                `;
              })
              .join("")}
          </ul>
        `;
      }
    }

    if (dayCardSettlementsList) {
      if (!snapshot.settlements.length) {
        dayCardSettlementsList.innerHTML =
          '<p class="list-note">دریافتی/پرداختی برای این روز ثبت نشده است.</p>';
      } else {
        dayCardSettlementsList.innerHTML = `
          <ul class="day-card-list">
            ${snapshot.settlements
              .map((item) => {
                const typeLabel = item.settlementType === "client" ? "دریافتی" : "پرداختی";
                const relation = [
                  item.projectTitle ? `پروژه: ${item.projectTitle}` : "",
                  item.partnerName ? `همکار: ${item.partnerName}` : "",
                  item.counterpartyName ? `طرف حساب: ${item.counterpartyName}` : ""
                ]
                  .filter(Boolean)
                  .join(" | ");
                return `
                  <li class="day-card-item">
                    <div class="day-card-item-title">${typeLabel}: ${formatCurrency(item.amount)}</div>
                    <div class="day-card-item-meta">
                      ${
                        relation ? `${escapeHtml(relation)}<span class="inline-sep">|</span>` : ""
                      }
                      روش پرداخت: ${escapeHtml(
                        labelFromMap(settlementMethodLabels, item.paymentMethod, "-")
                      )}
                    </div>
                    ${
                      item.description
                        ? `<div class="day-card-item-note">${escapeHtml(item.description)}</div>`
                        : ""
                    }
                  </li>
                `;
              })
              .join("")}
          </ul>
        `;
      }
    }
  };

  const openDayCardModal = () => {
    if (!dayCardModal) return;
    renderDayCardModal();
    dayCardModal.classList.remove("hidden");
  };

  const closeDayCardModal = () => {
    if (!dayCardModal) return;
    dayCardModal.classList.add("hidden");
  };

  const renderCalendar = () => {
    const filters = getFilters();
    const visibleCells = getVisibleCalendarCells();
    const dayMap = buildDayMap(visibleCells, filters);
    monthTitle.textContent = jalaliMonthLabel(viewYear, viewMonth);

    const html = visibleCells
      .map((cell) => {
        const bucket = dayMap.get(toDateKey(cell.dateStr));
        const reminderCount = bucket?.reminders?.length || 0;
        const receivable = Number(bucket?.receivable || 0);
        const payable = Number(bucket?.payable || 0);
        const eventCount = bucket?.events?.length || 0;
        const isFriday = Boolean(bucket?.isFriday);
        const isOfficialHoliday = Boolean(bucket?.isOfficialHoliday);
        const isSelected = selectedDate === cell.dateStr;

        const chips = [];
        if (isOfficialHoliday) {
          chips.push('<span class="day-chip holiday">تعطیل رسمی</span>');
        } else if (isFriday) {
          chips.push('<span class="day-chip friday">جمعه</span>');
        }
        if (eventCount) {
          chips.push(`<span class="day-chip event">رویداد ${toPersianDigits(eventCount)}</span>`);
        }
        if (reminderCount) {
          chips.push(
            `<span class="day-chip reminder">یادآور ${toPersianDigits(reminderCount)}</span>`
          );
        }
        if (receivable > 0) {
          chips.push(
            `<span class="day-chip receive">دریافتی ${toPersianDigits(
              Math.round(receivable).toLocaleString("en-US")
            )}</span>`
          );
        }
        if (payable > 0) {
          chips.push(
            `<span class="day-chip pay">پرداختی ${toPersianDigits(
              Math.round(payable).toLocaleString("en-US")
            )}</span>`
          );
        }

        return `
          <div class="calendar-day ${cell.inCurrentMonth ? "current" : "muted"} ${isSelected ? "selected" : ""} ${
            isFriday ? "friday" : ""
          } ${isOfficialHoliday ? "official-holiday" : ""}" data-date="${cell.dateStr}">
            <div class="calendar-day-head">
              <span>${toPersianDigits(cell.jd)}</span>
              ${
                isOfficialHoliday
                  ? '<span class="calendar-day-mark holiday">تعطیل</span>'
                  : isFriday
                    ? '<span class="calendar-day-mark friday">جمعه</span>'
                    : ""
              }
            </div>
            <div class="calendar-day-chips">${chips.join("")}</div>
          </div>
        `;
      })
      .join("");

    calendarGrid.innerHTML = html;
    renderDayDetails();
    if (dayCardModal && !dayCardModal.classList.contains("hidden")) {
      renderDayCardModal();
    }
  };

  const getTableFilteredReminders = () => {
    const status = remindersListStatus?.value || "all";
    return reminders.filter((item) => {
      if (
        !textMatch(
          remindersListSearch?.value || "",
          item.title,
          item.description,
          item.projectTitle,
          item.partnerName
        )
      ) {
        return false;
      }
      if (status === "open" && item.isDone) return false;
      if (status === "done" && !item.isDone) return false;
      return true;
    });
  };

  const renderRemindersTable = () => {
    remindersRows.innerHTML = getTableFilteredReminders()
      .map(
        (item) => `
          <tr>
            <td>${item.title}</td>
            <td>${toPersianDigits(item.reminderDate)}</td>
            <td>${toPersianDigits(normalizeReminderTime(item.reminderTime || "09:00"))}</td>
            <td>${getReminderPatternLabel(item)}${
              item.repeatUntil ? ` تا ${toPersianDigits(item.repeatUntil)}` : ""
            }</td>
            <td>${item.projectTitle || "-"}</td>
            <td>${item.partnerName || "-"}</td>
            <td>${getReminderSnoozeLabel(item)}</td>
            <td>${item.isDone ? "انجام‌شده" : "باز"}</td>
            <td>${item.description || "-"}</td>
            <td>
              <div class="row-actions">
                <button class="btn-ghost" type="button" data-action="edit" data-id="${item.id}">ویرایش</button>
                <button class="btn-secondary" type="button" data-action="toggle" data-id="${item.id}">${
                  item.isDone ? "بازکردن" : "انجام شد"
                }</button>
                <button class="btn-secondary" type="button" data-action="snooze30" data-id="${item.id}">اسنوز ۳۰د</button>
                ${
                  item.snoozeUntil
                    ? `<button class="btn-secondary" type="button" data-action="clear-snooze" data-id="${item.id}">لغو اسنوز</button>`
                    : ""
                }
                <button class="btn-danger" type="button" data-action="delete" data-id="${item.id}">حذف</button>
              </div>
            </td>
          </tr>
        `
      )
      .join("");
  };

  const updateDueNotifications = async () => {
    const todayStr = toCanonicalJalaliDate(getTodayJalaliDate());
    const dueToday = reminders.filter(
      (item) => !item.isDone && reminderOccursOnDate(item, todayStr)
    );
    const dueNow = dueToday.filter((item) => isReminderDueNow(item, todayStr));
    renderNoticeBox(dueNow, dueToday.length);
  };

  const resetFormState = () => {
    editingReminderId = null;
    reminderForm.reset();
    reminderDoneInput.value = "0";
    reminderTimeInput.value = "09:00";
    reminderRepeatTypeInput.value = "none";
    reminderRepeatUntilInput.value = "";
    reminderProjectInput.value = "";
    reminderPartnerInput.value = "";
    reminderDateInput.value = selectedDate || getTodayJalaliDate();
  };

  const fillReminderFormForEdit = (item) => {
    editingReminderId = Number(item.id);
    reminderTitleInput.value = item.title || "";
    reminderDescInput.value = item.description || "";
    reminderDateInput.value = item.reminderDate || selectedDate;
    reminderDoneInput.value = item.isDone ? "1" : "0";
    reminderTimeInput.value = normalizeReminderTime(item.reminderTime || "09:00");
    reminderRepeatTypeInput.value = normalizeReminderRepeatType(item.repeatType);
    reminderRepeatUntilInput.value = item.repeatUntil || "";
    reminderProjectInput.value = item.projectId || "";
    reminderPartnerInput.value = item.partnerId || "";

    selectedDate = item.reminderDate || selectedDate;
    const parsed = parseJalaliDate(selectedDate);
    if (parsed) {
      viewYear = parsed.jy;
      viewMonth = parsed.jm;
    }
    renderCalendar();
    scrollToFormTop(reminderForm);
  };

  const resetDayCardReminderQuickForm = () => {
    if (!dayCardReminderForm) return;
    dayCardReminderForm.reset();
    if (dayCardReminderTimeInput) dayCardReminderTimeInput.value = "09:00";
    if (dayCardReminderRepeatTypeInput) dayCardReminderRepeatTypeInput.value = "none";
    if (dayCardReminderProjectInput) dayCardReminderProjectInput.value = "";
    if (dayCardReminderPartnerInput) dayCardReminderPartnerInput.value = "";
  };

  const resetDayCardSettlementQuickForm = () => {
    if (!dayCardSettlementForm) return;
    dayCardSettlementForm.reset();
    if (dayCardSettlementTypeInput) dayCardSettlementTypeInput.value = "client";
    if (dayCardSettlementMethodInput) dayCardSettlementMethodInput.value = "cash";
    if (dayCardSettlementProjectInput) dayCardSettlementProjectInput.value = "";
    if (dayCardSettlementPartnerInput) dayCardSettlementPartnerInput.value = "";
    if (dayCardSettlementCounterpartyInput) dayCardSettlementCounterpartyInput.value = "";
    syncDayCardSettlementTypeState();
  };

  const refresh = async () => {
    const payload = await window.birHesab.invoke("reminders:calendar-data");
    reminders = normalizeReminderRows(payload?.reminders || []);
    settlements = normalizeSettlementRows(payload?.settlements || []);
    projects = Array.isArray(payload?.projects) ? payload.projects : [];
    partners = Array.isArray(payload?.partners) ? payload.partners : [];
    if (!calendarEventsByDate.size) {
      calendarEventsByDate = await loadCalendarEventsDataset();
    }

    renderLookupSelects();
    renderCalendar();
    renderRemindersTable();
    await updateDueNotifications();
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

  [filterShowReminders, filterShowReceivables, filterShowPayables, filterProject, filterPartner, filterReminderStatus].forEach(
    (el) => el?.addEventListener("input", renderCalendar)
  );

  [remindersListSearch, remindersListStatus].forEach((el) =>
    el?.addEventListener("input", renderRemindersTable)
  );
  remindersListReset?.addEventListener("click", () => {
    if (remindersListSearch) remindersListSearch.value = "";
    if (remindersListStatus) remindersListStatus.value = "all";
    renderRemindersTable();
  });

  calendarQuickAddBtn?.addEventListener("click", () => {
    reminderDateInput.value = selectedDate || getTodayJalaliDate();
    reminderTitleInput.focus();
  });

  calendarGoTodayBtn?.addEventListener("click", () => {
    const parsedToday = parseJalaliDate(getTodayJalaliDate());
    if (!parsedToday) return;
    viewYear = parsedToday.jy;
    viewMonth = parsedToday.jm;
    selectedDate = formatJalaliDateParts(parsedToday.jy, parsedToday.jm, parsedToday.jd);
    reminderDateInput.value = selectedDate;
    renderCalendar();
  });

  calendarClearFiltersBtn?.addEventListener("click", () => {
    if (filterShowReminders) filterShowReminders.checked = true;
    if (filterShowReceivables) filterShowReceivables.checked = true;
    if (filterShowPayables) filterShowPayables.checked = true;
    if (filterProject) filterProject.value = "";
    if (filterPartner) filterPartner.value = "";
    if (filterReminderStatus) filterReminderStatus.value = "all";
    renderCalendar();
  });

  calendarGrid?.addEventListener("click", (event) => {
    const day = event.target.closest(".calendar-day");
    if (!day) return;
    selectedDate = day.dataset.date || selectedDate;
    reminderDateInput.value = selectedDate;
    const parsed = parseJalaliDate(selectedDate);
    if (parsed) {
      viewYear = parsed.jy;
      viewMonth = parsed.jm;
    }
    renderCalendar();
    openDayCardModal();
  });

  remindersRows?.addEventListener("click", async (event) => {
    const btn = event.target.closest("button[data-id]");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const item = reminders.find((x) => x.id === id);
    if (!item) return;

    if (btn.dataset.action === "edit") {
      fillReminderFormForEdit(item);
      reminderTitleInput.focus();
      return;
    }

    if (btn.dataset.action === "snooze30") {
      await window.birHesab.invoke("reminders:snooze", {
        id,
        minutes: 30
      });
      await refresh();
      return;
    }

    if (btn.dataset.action === "clear-snooze") {
      await window.birHesab.invoke("reminders:clear-snooze", { id });
      await refresh();
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

  dayCardRemindersList?.addEventListener("click", async (event) => {
    const btn = event.target.closest("button[data-day-reminder-action][data-id]");
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const item = reminders.find((x) => Number(x.id) === id);
    if (!item) return;

    const action = btn.dataset.dayReminderAction;
    if (action === "edit") {
      closeDayCardModal();
      fillReminderFormForEdit(item);
      reminderTitleInput.focus();
      return;
    }

    if (action === "toggle") {
      await window.birHesab.invoke("reminders:toggle-done", {
        id,
        isDone: !item.isDone
      });
      await refresh();
      openDayCardModal();
      return;
    }

    if (action === "snooze30") {
      await window.birHesab.invoke("reminders:snooze", {
        id,
        minutes: 30
      });
      await refresh();
      openDayCardModal();
    }
  });

  dayCardReminderForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = String(dayCardReminderTitleInput?.value || "").trim();
    if (!title) {
      alert("عنوان یادآور را وارد کنید.");
      return;
    }

    const payload = {
      title,
      description: String(dayCardReminderDescInput?.value || "").trim(),
      reminderDate: selectedDate,
      reminderTime: normalizeReminderTime(dayCardReminderTimeInput?.value || "09:00"),
      isDone: false,
      repeatType: normalizeReminderRepeatType(dayCardReminderRepeatTypeInput?.value || "none"),
      repeatUntil: "",
      snoozeUntil: "",
      projectId: dayCardReminderProjectInput?.value || null,
      partnerId: dayCardReminderPartnerInput?.value || null
    };

    await window.birHesab.invoke("reminders:create", payload);
    resetDayCardReminderQuickForm();
    await refresh();
    openDayCardModal();
  });

  dayCardReminderReset?.addEventListener("click", () => {
    resetDayCardReminderQuickForm();
  });

  dayCardSettlementTypeInput?.addEventListener("input", () => {
    syncDayCardSettlementTypeState();
  });

  dayCardSettlementForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const settlementType = String(dayCardSettlementTypeInput?.value || "client");
    const amount = parseMoneyInput(dayCardSettlementAmountInput?.value || "");
    if (amount <= 0) {
      alert("مبلغ معتبر وارد کنید.");
      return;
    }

    const relatedId =
      settlementType === "partner" ? dayCardSettlementPartnerInput?.value || null : null;

    await window.birHesab.invoke("settlements:create", {
      settlementType,
      relatedId,
      counterpartyName: String(dayCardSettlementCounterpartyInput?.value || "").trim(),
      projectId: dayCardSettlementProjectInput?.value || null,
      amount,
      paymentMethod: dayCardSettlementMethodInput?.value || "cash",
      description: String(dayCardSettlementDescInput?.value || "").trim(),
      settlementDate: selectedDate
    });

    resetDayCardSettlementQuickForm();
    await refresh();
    openDayCardModal();
  });

  dayCardSettlementReset?.addEventListener("click", () => {
    resetDayCardSettlementQuickForm();
  });

  dayCardModalClose?.addEventListener("click", () => {
    closeDayCardModal();
  });

  dayCardModal?.addEventListener("click", (event) => {
    if (event.target === dayCardModal) {
      closeDayCardModal();
    }
  });

  reminderFormReset?.addEventListener("click", () => {
    resetFormState();
  });

  reminderForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const reminderDate = toCanonicalJalaliDate(reminderDateInput.value);
    if (!parseJalaliDate(reminderDate)) {
      alert("تاریخ شروع معتبر نیست.");
      return;
    }

    const repeatType = normalizeReminderRepeatType(reminderRepeatTypeInput.value);
    let repeatUntil = toCanonicalJalaliDate(reminderRepeatUntilInput.value || "");
    if (repeatType === "none") {
      repeatUntil = "";
    }
    const reminderTime = normalizeReminderTime(reminderTimeInput.value || "09:00");

    if (repeatUntil && !parseJalaliDate(repeatUntil)) {
      alert("تاریخ پایان تکرار معتبر نیست.");
      return;
    }

    if (repeatUntil && compareJalaliDates(repeatUntil, reminderDate) < 0) {
      alert("تاریخ پایان تکرار نباید قبل از تاریخ شروع باشد.");
      return;
    }

    const editingReminder = reminders.find((x) => x.id === editingReminderId);
    const payload = {
      title: reminderTitleInput.value.trim(),
      description: reminderDescInput.value.trim(),
      reminderDate,
      reminderTime,
      isDone: reminderDoneInput.value === "1",
      repeatType,
      repeatUntil,
      snoozeUntil: editingReminder?.snoozeUntil || "",
      projectId: reminderProjectInput.value || null,
      partnerId: reminderPartnerInput.value || null
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
  if (reminderTimeInput && !reminderTimeInput.value) reminderTimeInput.value = "09:00";
  resetDayCardReminderQuickForm();
  resetDayCardSettlementQuickForm();
  await refresh();
}

async function initServicesSection() {
  const form = document.getElementById("serviceForm");
  const rows = document.getElementById("servicesRows");
  const listMeta = document.getElementById("servicesListMeta");
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
    const visible = filtered();
    rows.innerHTML = visible
      .map(
        (service) =>
          `<tr><td><span class="status-dot"></span>${service.name}</td><td>${labelFromMap(
            pricingModelLabels,
            service.pricingModel
          )}</td><td>${formatCurrency(service.rate)}</td><td>${service.description || "-"}</td><td>${actionButtons(
            service.id,
            "service"
          )}</td></tr>`
      )
      .join("");
    if (listMeta) {
      listMeta.textContent = `نمایش ${toPersianDigits(visible.length)} مورد از ${toPersianDigits(
        all.length
      )} خدمت`;
    }
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
      scrollToFormTop(form);
      document.getElementById("serviceName").focus();
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
  const listMeta = document.getElementById("projectsListMeta");
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
        textMatch(
          search.value,
          item.title,
          item.clientName,
          item.status,
          labelFromMap(projectStatusLabels, item.status),
          item.serviceNames
        ) &&
        (!statusFilter.value || item.status === statusFilter.value) &&
        inDateRange(item.startDate, from.value, to.value)
    );

  const render = () => {
    const visible = filtered();
    rows.innerHTML = visible
      .map(
        (project) =>
          `<tr><td>${project.title}</td><td>${project.clientName}</td><td>${project.serviceNames || "-"}</td><td><span class="status-badge status-${escapeHtml(
            project.status
          )}">${labelFromMap(projectStatusLabels, project.status)}</span></td><td>${actionButtons(
            project.id,
            "project"
          )}</td></tr>`
      )
      .join("");
    if (listMeta) {
      listMeta.textContent = `نمایش ${toPersianDigits(visible.length)} مورد از ${toPersianDigits(
        all.length
      )} پروژه`;
    }
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
      scrollToFormTop(form);
      document.getElementById("projectTitle").focus();
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
  const settlementTypeInput = document.getElementById("settlementType");
  const settlementRelatedInput = document.getElementById("settlementRelated");
  const settlementCounterpartyInput = document.getElementById("settlementCounterparty");
  const settlementProjectInput = document.getElementById("settlementProject");
  const settlementRelatedField = document.getElementById("settlementRelatedField");
  const settlementFormHint = document.getElementById("settlementFormHint");

  const partnerSearch = document.getElementById("partnersSearch");
  const partnerFrom = document.getElementById("partnersFrom");
  const partnerTo = document.getElementById("partnersTo");
  const settlementSearch = document.getElementById("settlementsSearch");
  const settlementTypeFilter = document.getElementById("settlementsTypeFilter");
  const settlementFrom = document.getElementById("settlementsFrom");
  const settlementTo = document.getElementById("settlementsTo");
  const settlementTabButtons = Array.from(
    document.querySelectorAll("button[data-settlement-tab]")
  );
  const settlementPanes = Array.from(
    document.querySelectorAll(".settlement-pane[data-settlement-pane]")
  );

  const setActiveSettlementPane = (paneName = "summary") => {
    settlementTabButtons.forEach((btn) => {
      const active = btn.dataset.settlementTab === paneName;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    settlementPanes.forEach((pane) => {
      pane.classList.toggle("hidden", pane.dataset.settlementPane !== paneName);
    });
  };

  settlementTabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      setActiveSettlementPane(btn.dataset.settlementTab || "summary");
    });
  });

  let editingPartnerId = null;
  let editingSettlementId = null;
  let partnersAll = [];
  let projectsAll = [];
  let settlementsAll = [];
  let termsAll = [];
  let partnerNameMap = new Map();
  let projectTitleMap = new Map();

  const paymentLabel = (item) => {
    if (item.paymentModel === "percent") return `درصدی (${toPersianDigits(item.sharePercent)}%)`;
    const period = item.salaryPeriod === "weekly" ? "هفتگی" : "ماهانه";
    return `حقوق ${period}`;
  };

  const paymentValue = (item) => {
    if (item.paymentModel === "percent") return `${toPersianDigits(item.sharePercent)}%`;
    return formatCurrency(item.salaryAmount);
  };

  const settlementTypeLabel = (type) => (type === "client" ? "دریافتی" : "پرداختی");

  const settlementMethodLabel = (method) =>
    labelFromMap(settlementMethodLabels, method, method || "-");

  const settlementCounterpartyLabel = (item, relatedName = "") => {
    if (relatedName) return relatedName;
    if (item.counterpartyName) return item.counterpartyName;
    return "-";
  };

  const populateSimpleSelect = (
    selectEl,
    items,
    valueField,
    labelField,
    placeholder,
    keepValue = true
  ) => {
    if (!selectEl) return;
    const prevValue = keepValue ? String(selectEl.value || "") : "";
    const options = [`<option value="">${placeholder}</option>`];
    items.forEach((item) => {
      options.push(
        `<option value="${item[valueField]}">${escapeHtml(item[labelField] || "")}</option>`
      );
    });
    selectEl.innerHTML = options.join("");
    if (prevValue && items.some((item) => String(item[valueField]) === prevValue)) {
      selectEl.value = prevValue;
    }
  };

  const syncSettlementTypeUi = () => {
    const type = settlementTypeInput?.value || "partner";
    const isPartner = type === "partner";
    if (settlementRelatedField) {
      settlementRelatedField.classList.toggle("hidden", !isPartner);
    }
    if (!isPartner && settlementRelatedInput) {
      settlementRelatedInput.value = "";
    }
    if (settlementFormHint) {
      settlementFormHint.textContent = isPartner
        ? "برای پرداختی، در صورت نیاز همکار یا طرف حساب آزاد را وارد کنید."
        : "برای دریافتی، می‌توانید طرف حساب آزاد یا پروژه مرتبط ثبت کنید.";
    }
  };

  const filteredPartners = () =>
    partnersAll.filter(
      (item) =>
        textMatch(partnerSearch.value, item.fullName, item.role, paymentLabel(item)) &&
        inDateRange(item.createdAt, partnerFrom.value, partnerTo.value)
    );

  const filteredSettlements = () =>
    settlementsAll.filter(
      (item) => {
        const relatedName = partnerNameMap.get(Number(item.relatedId || 0)) || "";
        const projectName =
          item.projectTitle || projectTitleMap.get(Number(item.projectId || 0)) || "";
        return (
          textMatch(
            settlementSearch.value,
            settlementTypeLabel(item.settlementType),
            settlementMethodLabel(item.paymentMethod),
            item.description,
            item.counterpartyName,
            relatedName,
            projectName
          ) &&
        (!settlementTypeFilter.value || item.settlementType === settlementTypeFilter.value) &&
        inDateRange(item.settlementDate, settlementFrom.value, settlementTo.value)
        );
      }
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
      .map((item) => {
        const relatedName = partnerNameMap.get(Number(item.relatedId || 0)) || "-";
        const counterparty = settlementCounterpartyLabel(item, relatedName === "-" ? "" : relatedName);
        const projectName =
          item.projectTitle || projectTitleMap.get(Number(item.projectId || 0)) || "-";
        return `<tr>
          <td>${settlementTypeLabel(item.settlementType)}</td>
          <td>${counterparty}</td>
          <td>${projectName}</td>
          <td>${formatCurrency(item.amount)}</td>
          <td>${settlementMethodLabel(item.paymentMethod)}</td>
          <td>${toJalaliDate(item.settlementDate)}</td>
          <td>${item.description || "-"}</td>
          <td>${actionButtons(item.id, "settlement")}</td>
        </tr>`;
      })
      .join("");
  };

  const refreshPartnerProjectSelectors = async () => {
    projectsAll = await window.birHesab.invoke("projects:list");
    projectTitleMap = new Map(
      projectsAll.map((item) => [Number(item.id), String(item.title || "")])
    );
    partnerNameMap = new Map(
      partnersAll.map((item) => [Number(item.id), String(item.fullName || "")])
    );

    populateSimpleSelect(termPartner, partnersAll, "id", "fullName", "انتخاب همکار");
    populateSimpleSelect(termProject, projectsAll, "id", "title", "انتخاب پروژه");
    populateSimpleSelect(
      settlementRelatedInput,
      partnersAll,
      "id",
      "fullName",
      "بدون همکار"
    );
    populateSimpleSelect(
      settlementProjectInput,
      projectsAll,
      "id",
      "title",
      "بدون پروژه"
    );
    syncSettlementTypeUi();
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
      setActiveSettlementPane("partners");
      editingPartnerId = id;
      document.getElementById("partnerName").value = item.fullName;
      document.getElementById("partnerRole").value = item.role || "";
      document.getElementById("partnerShare").value = item.sharePercent || 0;
      document.getElementById("partnerPaymentModel").value = item.paymentModel || "percent";
      document.getElementById("partnerSalaryAmount").value = formatMoneyInput(item.salaryAmount || 0);
      document.getElementById("partnerSalaryPeriod").value = item.salaryPeriod || "monthly";
      scrollToFormTop(partnerForm);
      document.getElementById("partnerName").focus();
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
      setActiveSettlementPane("settlements");
      editingSettlementId = id;
      settlementTypeInput.value = item.settlementType;
      syncSettlementTypeUi();
      settlementRelatedInput.value = item.relatedId || "";
      if (settlementCounterpartyInput) {
        settlementCounterpartyInput.value = item.counterpartyName || "";
      }
      settlementProjectInput.value = item.projectId || "";
      document.getElementById("settlementAmount").value = formatMoneyInput(item.amount);
      document.getElementById("settlementMethod").value = item.paymentMethod || "cash";
      document.getElementById("settlementDate").value = item.settlementDate || getTodayJalaliDate();
      document.getElementById("settlementDesc").value = item.description || "";
      scrollToFormTop(settlementForm);
      document.getElementById("settlementAmount").focus();
      return;
    }

    if (!confirm("این تسویه حذف شود؟")) return;
    await window.birHesab.invoke("settlements:delete", { id });
    if (editingSettlementId === id) {
      editingSettlementId = null;
      settlementForm.reset();
      syncSettlementTypeUi();
    }
    await refreshSettlements();
  };

  [partnerSearch, partnerFrom, partnerTo].forEach((el) =>
    el.addEventListener("input", renderPartners)
  );
  [settlementSearch, settlementTypeFilter, settlementFrom, settlementTo].forEach((el) =>
    el.addEventListener("input", renderSettlements)
  );
  settlementTypeInput?.addEventListener("input", syncSettlementTypeUi);

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
  syncSettlementTypeUi();
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
    if (!termPartner.value || !termProject.value) {
      alert("همکار و پروژه را انتخاب کنید.");
      return;
    }
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
      settlementType: settlementTypeInput.value,
      relatedId: settlementRelatedInput.value || null,
      counterpartyName: String(settlementCounterpartyInput?.value || "").trim(),
      projectId: settlementProjectInput.value || null,
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
    syncSettlementTypeUi();
    setTodayByDefault("settlementDate");
    await refreshSettlements();
  });

  await refreshPartners();
  await refreshTerms();
  await refreshSettlements();

  if (settlementTabButtons.length && settlementPanes.length) {
    const initialTab =
      settlementTabButtons.find((btn) => btn.classList.contains("active"))?.dataset
        .settlementTab ||
      settlementTabButtons[0].dataset.settlementTab ||
      "summary";
    setActiveSettlementPane(initialTab);
  }
}

async function initExpensesSection() {
  const form = document.getElementById("expenseForm");
  const rows = document.getElementById("expensesRows");
  const listMeta = document.getElementById("expensesListMeta");
  const search = document.getElementById("expensesSearch");
  const scopeFilter = document.getElementById("expensesScopeFilter");
  const from = document.getElementById("expensesFrom");
  const to = document.getElementById("expensesTo");
  let editingId = null;
  let all = [];

  const filtered = () =>
    all.filter(
      (item) =>
        textMatch(
          search.value,
          item.scope,
          labelFromMap(expenseScopeLabels, item.scope),
          item.category,
          item.description,
          item.paidBy
        ) &&
        (!scopeFilter.value || item.scope === scopeFilter.value) &&
        inDateRange(item.expenseDate, from.value, to.value)
    );

  const render = () => {
    const visible = filtered();
    rows.innerHTML = visible
      .map(
        (expense) =>
          `<tr><td>${labelFromMap(expenseScopeLabels, expense.scope)}</td><td>${expense.category}</td><td>${formatCurrency(
            expense.amount
          )}</td><td>${toJalaliDate(expense.expenseDate)}</td><td>${expense.description || "-"}</td><td>${actionButtons(
            expense.id,
            "expense"
          )}</td></tr>`
      )
      .join("");
    if (listMeta) {
      listMeta.textContent = `نمایش ${toPersianDigits(visible.length)} مورد از ${toPersianDigits(
        all.length
      )} هزینه`;
    }
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
      scrollToFormTop(form);
      document.getElementById("expenseCategory").focus();
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
  const listMeta = document.getElementById("cashboxListMeta");
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
    const visible = filtered();
    rows.innerHTML = visible
      .map((entry) => `<tr><td>${entry.entryType === "in" ? "دخل" : "خرج"}</td><td>${formatCurrency(entry.amount)}</td><td>${toJalaliDate(entry.entryDate)}</td><td>${entry.description || "-"}</td><td>${actionButtons(entry.id, "cashbox")}</td></tr>`)
      .join("");
    if (listMeta) {
      listMeta.textContent = `نمایش ${toPersianDigits(visible.length)} مورد از ${toPersianDigits(
        all.length
      )} تراکنش`;
    }
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
      scrollToFormTop(form);
      document.getElementById("cashboxAmount").focus();
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

async function initAssistantSection() {
  const apiKeyInput = document.getElementById("assistantApiKey");
  const clearApiKeyInput = document.getElementById("assistantClearApiKey");
  const modelInput = document.getElementById("assistantModel");
  const saveSettingsBtn = document.getElementById("assistantSaveSettingsBtn");
  const settingsStatus = document.getElementById("assistantSettingsStatus");
  const chatMessages = document.getElementById("assistantChatMessages");
  const chatForm = document.getElementById("assistantChatForm");
  const chatInput = document.getElementById("assistantChatInput");
  const sendBtn = document.getElementById("assistantSendBtn");
  const busyLabel = document.getElementById("assistantBusyLabel");
  const clearConversationBtn = document.getElementById("assistantClearConversationBtn");
  const pendingBox = document.getElementById("assistantPendingBox");
  const pendingList = document.getElementById("assistantPendingList");
  const confirmActionsBtn = document.getElementById("assistantConfirmActionsBtn");
  const cancelActionsBtn = document.getElementById("assistantCancelActionsBtn");
  const quickPrompts = document.getElementById("assistantQuickPrompts");

  if (
    !apiKeyInput ||
    !clearApiKeyInput ||
    !modelInput ||
    !saveSettingsBtn ||
    !settingsStatus ||
    !chatMessages ||
    !chatForm ||
    !chatInput ||
    !sendBtn ||
    !busyLabel ||
    !clearConversationBtn ||
    !pendingBox ||
    !pendingList ||
    !confirmActionsBtn ||
    !cancelActionsBtn
  ) {
    return;
  }

  const setBusy = (busy) => {
    sendBtn.disabled = busy;
    chatInput.disabled = busy;
    busyLabel.classList.toggle("hidden", !busy);
  };

  const showSettingsStatus = (text, kind = "muted") => {
    settingsStatus.textContent = text;
    settingsStatus.classList.remove("assistant-status-ok", "assistant-status-error");
    if (kind === "ok") {
      settingsStatus.classList.add("assistant-status-ok");
    }
    if (kind === "error") {
      settingsStatus.classList.add("assistant-status-error");
    }
  };

  const renderMessages = () => {
    if (!assistantUiState.messages.length) {
      chatMessages.innerHTML = `
        <article class="assistant-msg assistant-msg-assistant">
          <p>سلام. من دستیار بیر حساب هستم. می‌تونی با من چت کنی تا ثبت مالی انجام بدم یا گزارش بگیرم.</p>
        </article>
      `;
      return;
    }
    chatMessages.innerHTML = assistantUiState.messages
      .map((item) => {
        const roleClass =
          item.role === "user"
            ? "assistant-msg-user"
            : item.role === "system"
              ? "assistant-msg-system"
              : "assistant-msg-assistant";
        return `
          <article class="assistant-msg ${roleClass}">
            <p>${escapeHtml(item.text || "").replace(/\n/g, "<br>")}</p>
          </article>
        `;
      })
      .join("");
    chatMessages.scrollTop = chatMessages.scrollHeight;
  };

  const appendMessage = (role, text) => {
    assistantUiState.messages.push({
      role,
      text: String(text || "").trim(),
      createdAt: new Date().toISOString()
    });
    if (assistantUiState.messages.length > 200) {
      assistantUiState.messages = assistantUiState.messages.slice(-200);
    }
    renderMessages();
  };

  const collectMessagesForApi = () =>
    assistantUiState.messages
      .filter((item) => item.role === "user" || item.role === "assistant")
      .slice(-24)
      .map((item) => ({
        role: item.role,
        content: item.text
      }));

  const renderPendingActions = () => {
    const actions = Array.isArray(assistantUiState.pendingActions)
      ? assistantUiState.pendingActions
      : [];

    if (!actions.length) {
      pendingBox.classList.add("hidden");
      pendingList.innerHTML = "";
      return;
    }

    pendingBox.classList.remove("hidden");
    pendingList.innerHTML = actions
      .map(
        (action, index) => `
          <li>
            <strong>${toPersianDigits(index + 1)}.</strong>
            <span>${escapeHtml(action.summary || action.type || "عملیات بدون عنوان")}</span>
          </li>
        `
      )
      .join("");
  };

  const loadSettings = async () => {
    const data = await window.birHesab.invoke("assistant:settings:get");
    modelInput.value = data?.model || "gemini-2.0-flash-preview-02-05";
    apiKeyInput.value = "";
    clearApiKeyInput.checked = false;
    if (data?.hasApiKey) {
      showSettingsStatus(
        `کلید Gemini تنظیم شده است (${data.apiKeyMasked || "مخفی"})`,
        "ok"
      );
    } else {
      showSettingsStatus("کلید Gemini تنظیم نشده است.", "error");
    }
  };

  saveSettingsBtn.addEventListener("click", async () => {
    saveSettingsBtn.disabled = true;
    const prevText = saveSettingsBtn.textContent;
    saveSettingsBtn.textContent = "در حال ذخیره...";
    try {
      const payload = {
        model: modelInput.value.trim(),
        apiKey: apiKeyInput.value.trim(),
        clearApiKey: clearApiKeyInput.checked
      };
      const data = await window.birHesab.invoke("assistant:settings:update", payload);
      apiKeyInput.value = "";
      clearApiKeyInput.checked = false;
      if (data?.hasApiKey) {
        showSettingsStatus(
          `تنظیمات ذخیره شد. کلید فعال: ${data.apiKeyMasked || "مخفی"}`,
          "ok"
        );
      } else {
        showSettingsStatus("تنظیمات ذخیره شد ولی کلیدی ثبت نشده است.", "error");
      }
    } catch (error) {
      showSettingsStatus(`خطا در ذخیره تنظیمات: ${error.message}`, "error");
    } finally {
      saveSettingsBtn.disabled = false;
      saveSettingsBtn.textContent = prevText;
    }
  });

  chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = String(chatInput.value || "").trim();
    if (!text) return;

    chatInput.value = "";
    appendMessage("user", text);
    setBusy(true);
    try {
      const response = await window.birHesab.invoke("assistant:chat", {
        messages: collectMessagesForApi()
      });
      if (response?.assistantReply) {
        appendMessage("assistant", response.assistantReply);
      } else {
        appendMessage("assistant", "پاسخی دریافت نشد.");
      }
      assistantUiState.pendingActions = Array.isArray(response?.pendingActions)
        ? response.pendingActions
        : [];
      renderPendingActions();
    } catch (error) {
      appendMessage("system", `خطا در ارتباط با دستیار: ${error.message}`);
    } finally {
      setBusy(false);
      chatInput.focus();
    }
  });

  confirmActionsBtn.addEventListener("click", async () => {
    const actions = Array.isArray(assistantUiState.pendingActions)
      ? assistantUiState.pendingActions
      : [];
    if (!actions.length) return;

    confirmActionsBtn.disabled = true;
    const prevLabel = confirmActionsBtn.textContent;
    confirmActionsBtn.textContent = "در حال اجرا...";
    try {
      const response = await window.birHesab.invoke("assistant:execute-actions", {
        actions
      });
      const executed = Array.isArray(response?.executed) ? response.executed : [];
      const failed = Array.isArray(response?.failed) ? response.failed : [];
      if (executed.length) {
        appendMessage(
          "system",
          `عملیات انجام شد:\n${executed
            .map((item, index) => `${toPersianDigits(index + 1)}) ${item.summary}`)
            .join("\n")}`
        );
      }
      if (failed.length) {
        appendMessage(
          "system",
          `بخشی از عملیات ناموفق بود:\n${failed
            .map((item, index) => `${toPersianDigits(index + 1)}) ${item.error}`)
            .join("\n")}`
        );
      }
      assistantUiState.pendingActions = [];
      renderPendingActions();
    } catch (error) {
      appendMessage("system", `خطا در اجرای عملیات: ${error.message}`);
    } finally {
      confirmActionsBtn.disabled = false;
      confirmActionsBtn.textContent = prevLabel;
    }
  });

  cancelActionsBtn.addEventListener("click", () => {
    if (!assistantUiState.pendingActions.length) return;
    assistantUiState.pendingActions = [];
    renderPendingActions();
    appendMessage("system", "عملیات پیشنهادی لغو شد.");
  });

  clearConversationBtn.addEventListener("click", () => {
    assistantUiState.messages = [];
    assistantUiState.pendingActions = [];
    renderMessages();
    renderPendingActions();
  });

  quickPrompts?.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-prompt]");
    if (!btn) return;
    chatInput.value = btn.dataset.prompt || "";
    chatInput.focus();
  });

  renderMessages();
  renderPendingActions();
  setBusy(false);
  await loadSettings();
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

function renderGlobalReminderBanner(items, dueNowCount = 0) {
  const banner = document.getElementById("globalReminderBanner");
  if (!banner) return;
  if (!items.length) {
    banner.classList.add("hidden");
    banner.textContent = "";
    return;
  }
  const summary = items
    .slice(0, 3)
    .map(
      (item) =>
        `${item.title} (${toPersianDigits(normalizeReminderTime(item.reminderTime || "09:00"))})`
    )
    .join(" | ");
  banner.classList.remove("hidden");
  banner.textContent = `یادآورهای امروز: ${toPersianDigits(items.length)} مورد | قابل اقدام الان: ${toPersianDigits(
    dueNowCount
  )} | ${summary}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeRelationId(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

function buildReminderUpdatePayload(reminder, overrides = {}) {
  const repeatType = normalizeReminderRepeatType(
    overrides.repeatType ?? reminder.repeatType
  );
  const rawRepeatUntil = overrides.repeatUntil ?? reminder.repeatUntil;
  let repeatUntil = toCanonicalJalaliDate(rawRepeatUntil || "");
  if (repeatType === "none") {
    repeatUntil = "";
  }
  const rawReminderDate = overrides.reminderDate ?? reminder.reminderDate;
  const rawReminderTime = overrides.reminderTime ?? reminder.reminderTime;
  const rawIsDone = overrides.isDone ?? reminder.isDone;
  const rawSnoozeUntil = overrides.snoozeUntil ?? reminder.snoozeUntil;
  return {
    id: Number(reminder.id),
    title: String(overrides.title ?? reminder.title ?? "").trim(),
    description: String(overrides.description ?? reminder.description ?? "").trim(),
    reminderDate: toCanonicalJalaliDate(rawReminderDate || ""),
    reminderTime: normalizeReminderTime(rawReminderTime || "09:00"),
    isDone: Boolean(Number(rawIsDone || 0)),
    repeatType,
    repeatUntil,
    snoozeUntil: String(rawSnoozeUntil || ""),
    projectId: normalizeRelationId(overrides.projectId ?? reminder.projectId),
    partnerId: normalizeRelationId(overrides.partnerId ?? reminder.partnerId)
  };
}

function getReminderAlertElements() {
  return {
    modal: document.getElementById("reminderAlertModal"),
    closeBtn: document.getElementById("closeReminderAlertBtn"),
    summary: document.getElementById("reminderAlertSummary"),
    list: document.getElementById("reminderAlertList")
  };
}

function hideReminderAlertModal() {
  const { modal } = getReminderAlertElements();
  if (!modal) return;
  modal.classList.add("hidden");
}

function renderReminderAlertModal() {
  const { modal, summary, list } = getReminderAlertElements();
  if (!modal || !summary || !list) return;

  if (!reminderAlertItems.length) {
    summary.textContent = "یادآور فعال جدیدی برای اقدام وجود ندارد.";
    list.innerHTML = "";
    hideReminderAlertModal();
    return;
  }

  const dueNowCount = reminderAlertItems.filter((item) => !Number(item.isDone || 0)).length;
  summary.textContent = `یادآورهای امروز: ${toPersianDigits(
    reminderAlertLastDueTodayCount
  )} مورد | در این پاپ‌آپ: ${toPersianDigits(dueNowCount)} مورد`;

  list.innerHTML = reminderAlertItems
    .map((item) => {
      const relation = [item.projectTitle ? `پروژه: ${item.projectTitle}` : "", item.partnerName ? `همکار: ${item.partnerName}` : ""]
        .filter(Boolean)
        .join(" | ");
      const repeatLabel = getReminderPatternLabel(item);
      const timeLabel = normalizeReminderTime(item.reminderTime || "09:00");
      const snoozeLabel = getReminderSnoozeLabel(item);
      return `
        <article class="reminder-alert-item" data-id="${item.id}">
          <div class="reminder-alert-head">
            <strong>${escapeHtml(item.title || "-")}</strong>
            <span class="reminder-alert-meta">ساعت ${toPersianDigits(timeLabel)}</span>
          </div>
          <div class="reminder-alert-meta">
            تاریخ: ${toPersianDigits(item.reminderDate || "-")} | تکرار: ${repeatLabel}${
              snoozeLabel !== "-" ? ` | اسنوز تا: ${snoozeLabel}` : ""
            }${relation ? ` | ${escapeHtml(relation)}` : ""}
          </div>
          <div class="reminder-alert-fields">
            <div>
              <label>عنوان</label>
              <input type="text" data-field="title" maxlength="120" value="${escapeHtml(
                item.title || ""
              )}" />
            </div>
            <div>
              <label>تاریخ</label>
              <input
                type="text"
                data-field="reminderDate"
                data-jdp
                inputmode="numeric"
                autocomplete="off"
                value="${escapeHtml(item.reminderDate || getTodayJalaliDate())}"
              />
            </div>
            <div>
              <label>ساعت</label>
              <input type="time" data-field="reminderTime" value="${escapeHtml(timeLabel)}" />
            </div>
            <div class="full">
              <label>توضیحات</label>
              <textarea data-field="description">${escapeHtml(item.description || "")}</textarea>
            </div>
          </div>
          <div class="reminder-alert-actions">
            <button class="btn-primary" type="button" data-alert-action="save" data-id="${item.id}">ذخیره تغییرات</button>
            <button class="btn-secondary" type="button" data-alert-action="done" data-id="${item.id}">تأیید انجام</button>
            <button class="btn-secondary" type="button" data-alert-action="snooze" data-minutes="10" data-id="${item.id}">اسنوز ۱۰د</button>
            <button class="btn-secondary" type="button" data-alert-action="snooze" data-minutes="30" data-id="${item.id}">اسنوز ۳۰د</button>
          </div>
        </article>
      `;
    })
    .join("");

  setupIranCalendar();
}

function showReminderAlertModal(items, dueTodayCount = 0) {
  if (!Array.isArray(items) || !items.length) return;
  const { modal } = getReminderAlertElements();
  if (!modal) return;

  const nextMap = new Map(reminderAlertItems.map((item) => [Number(item.id), item]));
  items.forEach((item) => {
    nextMap.set(Number(item.id), item);
  });
  reminderAlertItems = Array.from(nextMap.values()).sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
  reminderAlertLastDueTodayCount = Math.max(reminderAlertLastDueTodayCount, Number(dueTodayCount) || 0);
  renderReminderAlertModal();
  modal.classList.remove("hidden");
}

function removeReminderAlertItem(id) {
  reminderAlertItems = reminderAlertItems.filter((item) => Number(item.id) !== Number(id));
  if (!reminderAlertItems.length) {
    reminderAlertLastDueTodayCount = 0;
  }
  renderReminderAlertModal();
}

function setupReminderAlertModal() {
  if (reminderAlertModalBound) return;
  const { modal, closeBtn, list } = getReminderAlertElements();
  if (!modal || !closeBtn || !list) return;

  closeBtn.addEventListener("click", () => {
    hideReminderAlertModal();
  });

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      hideReminderAlertModal();
    }
  });

  list.addEventListener("click", async (event) => {
    const btn = event.target.closest("button[data-alert-action][data-id]");
    if (!btn) return;

    const action = btn.dataset.alertAction;
    const id = Number(btn.dataset.id);
    const card = btn.closest(".reminder-alert-item");
    if (!card || !Number.isFinite(id)) return;

    const current = reminderAlertItems.find((item) => Number(item.id) === id);
    if (!current) return;

    btn.disabled = true;
    try {
      if (action === "done") {
        await window.birHesab.invoke("reminders:toggle-done", {
          id,
          isDone: true
        });
        removeReminderAlertItem(id);
        return;
      }

      if (action === "snooze") {
        const minutes = Math.max(1, Math.min(24 * 60, Number(btn.dataset.minutes || 30)));
        await window.birHesab.invoke("reminders:snooze", {
          id,
          minutes
        });
        removeReminderAlertItem(id);
        return;
      }

      if (action === "save") {
        const titleInput = card.querySelector("input[data-field='title']");
        const dateInput = card.querySelector("input[data-field='reminderDate']");
        const timeInput = card.querySelector("input[data-field='reminderTime']");
        const descInput = card.querySelector("textarea[data-field='description']");

        const title = String(titleInput?.value || "").trim();
        if (!title) {
          alert("عنوان ریمایندر نمی‌تواند خالی باشد.");
          return;
        }

        const reminderDate = toCanonicalJalaliDate(dateInput?.value || "");
        if (!parseJalaliDate(reminderDate)) {
          alert("تاریخ یادآور معتبر نیست.");
          return;
        }

        const reminderTime = normalizeReminderTime(timeInput?.value || current.reminderTime || "09:00");
        const description = String(descInput?.value || "").trim();
        const payload = buildReminderUpdatePayload(current, {
          title,
          description,
          reminderDate,
          reminderTime
        });

        if (!payload.title) {
          alert("عنوان ریمایندر نمی‌تواند خالی باشد.");
          return;
        }

        if (!parseJalaliDate(payload.reminderDate)) {
          alert("تاریخ یادآور معتبر نیست.");
          return;
        }

        if (payload.repeatUntil && compareJalaliDates(payload.repeatUntil, payload.reminderDate) < 0) {
          alert("تاریخ پایان تکرار نباید قبل از تاریخ شروع باشد.");
          return;
        }

        await window.birHesab.invoke("reminders:update", payload);
        reminderAlertItems = reminderAlertItems.map((item) =>
          Number(item.id) === id
            ? {
                ...item,
                ...payload,
                isDone: payload.isDone ? 1 : 0
              }
            : item
        );
        renderReminderAlertModal();
      }
    } catch (error) {
      alert(`خطا در عملیات ریمایندر: ${error.message}`);
    } finally {
      btn.disabled = false;
    }
  });

  reminderAlertModalBound = true;
}

async function runReminderNotificationCheck() {
  const rawReminders = await window.birHesab.invoke("reminders:list");
  const reminders = (rawReminders || []).map((row) => ({
    ...row,
    reminderDate: toCanonicalJalaliDate(row.reminderDate),
    reminderTime: normalizeReminderTime(row.reminderTime || "09:00"),
    repeatType: normalizeReminderRepeatType(row.repeatType),
    repeatUntil: row.repeatUntil ? toCanonicalJalaliDate(row.repeatUntil) : "",
    snoozeUntil: row.snoozeUntil || "",
    isDone: Number(row.isDone || 0)
  }));

  const now = new Date();
  const today = toCanonicalJalaliDate(getTodayJalaliDate());
  const dueToday = reminders.filter(
    (item) => !item.isDone && reminderOccursOnDate(item, today)
  );
  const dueNow = dueToday.filter((item) => isReminderDueNow(item, today, now));

  renderGlobalReminderBanner(dueToday, dueNow.length);

  const fresh = dueNow.filter((item) => {
    const key = `birhesab-global-notified-${item.id}-${getReminderTriggerReference(
      item,
      today
    )}`;
    return !localStorage.getItem(key);
  });
  if (!fresh.length) return;

  showReminderAlertModal(fresh, dueToday.length);

  const body = fresh
    .slice(0, 4)
    .map(
      (item) =>
        `${item.title} (${toPersianDigits(normalizeReminderTime(item.reminderTime || "09:00"))})`
    )
    .join(" | ");

  try {
    await window.birHesab.invoke("notifications:windows:show", {
      title: `بیر حساب: ${toPersianDigits(fresh.length)} یادآور امروز`,
      body: body || "یادآورهای جدید امروز"
    });
  } catch {
    // Ignore transport errors; UI banner already informs user.
  }

  fresh.forEach((item) => {
    const key = `birhesab-global-notified-${item.id}-${getReminderTriggerReference(
      item,
      today
    )}`;
    localStorage.setItem(key, new Date().toISOString());
  });
}

function setupReminderNotifications() {
  const run = async () => {
    try {
      await runReminderNotificationCheck();
    } catch {
      // Ignore reminders check failures to keep app boot resilient.
    }
  };

  run();

  if (reminderNotificationsTimer) {
    clearInterval(reminderNotificationsTimer);
  }
  reminderNotificationsTimer = setInterval(run, 60 * 1000);
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
  setupReminderAlertModal();
  await initSidebar();
  await renderSection();
  setupBackupEvents();
  setupUpdaterEvents();
  setupReminderNotifications();
}

bootstrap().catch((error) => {
  const content = document.getElementById("content");
  if (content) {
    content.innerHTML = `<div class="section-card"><h3>خطا در بارگذاری برنامه</h3><p>${error.message}</p></div>`;
  }
});
