const fs = require("node:fs");
const path = require("node:path");
const XLSX = require("xlsx");
const { BrowserWindow, dialog } = require("electron");

const SETTINGS_FILE_NAME = "assistant-settings.json";
const DEFAULT_MODEL = "gemini-2.5-flash";
const LEGACY_MODEL_ALIASES = new Set([
  "gemini-2.0-flash-preview-02-05",
  "models/gemini-2.0-flash-preview-02-05",
  "gemini-2.0-flash",
  "models/gemini-2.0-flash"
]);
const MAX_CHAT_MESSAGES = 24;
const MAX_PENDING_ACTIONS = 20;
const MAX_EXECUTION_ACTIONS = 30;
const MODEL_RESOLUTION_MAX_PAGES = 6;
const MAX_SQL_ROWS = 120;
const MAX_SQL_PREVIEW_ROWS = 8;
const MAX_ASSISTANT_OPS_LIST = 120;
const MAX_ASSISTANT_HISTORY_LOOKBACK = 420;
const MAX_ASSISTANT_DAILY_MEMORY_DAYS = 21;
const MAX_ASSISTANT_CHAT_MEMORY_ROWS = 1600;
const MAX_ASSISTANT_CHAT_CONTEXT = 18;

const MODEL_PREFERENCE_ORDER = Object.freeze([
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro"
]);

const SUPPORTED_ACTION_TYPES = new Set([
  "create_service",
  "update_service",
  "delete_service",
  "create_project",
  "update_project",
  "delete_project",
  "create_partner",
  "update_partner",
  "delete_partner",
  "upsert_partner_term",
  "delete_partner_term",
  "create_settlement",
  "update_settlement",
  "delete_settlement",
  "update_reminder",
  "toggle_reminder_done",
  "snooze_reminder",
  "clear_reminder_snooze",
  "delete_reminder",
  "create_expense",
  "update_expense",
  "delete_expense",
  "create_cashbox",
  "update_cashbox",
  "delete_cashbox",
  "create_reminder",
  "run_report_business",
  "run_report_project_profit",
  "export_business_excel",
  "export_business_pdf",
  "export_project_profit_excel",
  "export_project_profit_pdf",
  "run_sql",
  "calculate_expression"
]);

function normalizeDigits(value) {
  return String(value || "")
    .replace(/[Û°-Û¹]/g, (d) => String("Û°Û±Û²Û³Û´ÛµÛ¶Û·Û¸Û¹".indexOf(d)))
    .replace(/[Ù -Ù©]/g, (d) => String("Ù Ù¡Ù¢Ù£Ù¤Ù¥Ù¦Ù§Ù¨Ù©".indexOf(d)));
}

function toPersianDigits(value) {
  return normalizeDigits(value).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d) || 0]);
}

function safeString(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
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
  const normalized = compact.replace(/^models\//i, "").toLowerCase();
  if (LEGACY_MODEL_ALIASES.has(compact.toLowerCase()) || normalized === "gemini-2.0-flash") {
    return DEFAULT_MODEL;
  }
  return compact.replace(/^models\//i, "").slice(0, 80);
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

function formatToJalaliDate(dateValue) {
  const parsed = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
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
  if (!y || !m || !d) return "";
  return `${y}/${m}/${d}`;
}

function getRelativeJalaliDate(dayOffset) {
  const offset = Number(dayOffset || 0);
  if (!Number.isFinite(offset)) return getTodayJalaliDate();
  const date = new Date(Date.now() + Math.trunc(offset) * 24 * 60 * 60 * 1000);
  return formatToJalaliDate(date) || getTodayJalaliDate();
}

function toIsoDateTime(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString();
}

function normalizeProfileDisplayName(value) {
  return safeString(value)
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

function pickLatestUserMessage(messages) {
  if (!Array.isArray(messages) || !messages.length) return "";
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const item = messages[i];
    if (item?.role !== "user") continue;
    const content = safeString(item?.content).trim();
    if (content) return content;
  }
  return "";
}

function extractProfileNameFromText(rawText) {
  const text = safeString(rawText)
    .replace(/[,\.\!\?\u061F:؛]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";

  const patterns = [
    /(?:اسم(?:\s*من|م)?|نام(?:\s*من|م)?)\s*(?:هست|می(?:\s*)?باشد|:)?\s*([A-Za-z\u0600-\u06FF][A-Za-z0-9\u0600-\u06FF\s]{1,50})/i,
    /(?:من)\s+([A-Za-z\u0600-\u06FF][A-Za-z0-9\u0600-\u06FF\s]{1,40})\s+(?:هستم|می(?:\s*)?باشم)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    let candidate = match[1].trim();
    candidate = candidate.replace(
      /\b(هستم|است|میباشد|می\s*باشد|جان|عزیز|میگن|صدا(?:م|م\s*کن))\b.*$/i,
      ""
    );
    const normalized = normalizeProfileDisplayName(candidate);
    if (normalized.length >= 2) {
      return normalized;
    }
  }
  return "";
}

function detectNameRecallIntent(rawText) {
  const text = safeString(rawText).toLowerCase();
  if (!text) return false;
  return (
    text.includes("اسم من") ||
    text.includes("اسمم") ||
    text.includes("نام من") ||
    text.includes("من کی هستم") ||
    text.includes("یادت هست من")
  );
}

function detectHistoryIntent(rawText) {
  const text = safeString(rawText);
  if (!text) return false;
  const hasTimeHint =
    /دیروز|امروز|پریروز|فردا|پس\s*فردا|روزهای قبل|روز قبل|تاریخ|[1-9][0-9]{3}[\/-][0-9]{1,2}[\/-][0-9]{1,2}/.test(
      text
    );
  const hasHistoryWord = /چه\s*کار|چی\s*کار|انجام\s*داد|عملیات|کارهایی|یادته|سوابق|گزارش\s*کار/.test(
    text
  );
  const hasQuestionWord = /چه|چی|کدوم|گزارش|بگو|نشون|نمایش|یادته/.test(text);
  const hasWriteIntent = /ثبت\s*کن|ایجاد\s*کن|اضافه\s*کن|حذف\s*کن|ویرایش\s*کن|تغییر\s*بده/.test(
    text
  );
  return hasTimeHint && hasHistoryWord && hasQuestionWord && !hasWriteIntent;
}

function detectCalendarIntent(rawText) {
  const text = safeString(rawText);
  if (!text) return false;
  const hasCalendarKeyword = /تقویم|رویداد|مناسبت|تعطیل|تعطیلات|calendar|event/i.test(text);
  const hasWriteIntent = /ثبت\s*کن|ایجاد\s*کن|اضافه\s*کن|حذف\s*کن|ویرایش\s*کن|تغییر\s*بده/.test(
    text
  );
  return hasCalendarKeyword && !hasWriteIntent;
}

function extractDateMention(rawText, fallbackDate = "") {
  const text = normalizeDigits(rawText).replace(/-/g, "/");
  const explicitMatch = text.match(/([1-9][0-9]{3}\/[0-9]{1,2}\/[0-9]{1,2})/);
  if (explicitMatch?.[1]) {
    return toCanonicalJalaliDate(explicitMatch[1], fallbackDate);
  }
  if (/پریروز/.test(text)) return getRelativeJalaliDate(-2);
  if (/پس\s*فردا/.test(text)) return getRelativeJalaliDate(2);
  if (/دیروز/.test(text)) return getRelativeJalaliDate(-1);
  if (/فردا/.test(text)) return getRelativeJalaliDate(1);
  if (/امروز/.test(text)) return getRelativeJalaliDate(0);
  return fallbackDate || "";
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
  if (v.includes("Ù‡Ù…Ú©Ø§Ø±")) return "partner";
  if (v.includes("Ú©Ø§Ø±ÙØ±Ù…Ø§")) return "client";
  return "personal";
}

function sanitizePaymentMethod(value) {
  const v = safeString(value).trim().toLowerCase();
  if (v === "card" || v === "cart" || v.includes("Ú©Ø§Ø±Øª")) return "card";
  if (v === "bank" || v.includes("Ø¨Ø§Ù†Ú©")) return "bank";
  return "cash";
}

function sanitizeExpenseScope(value) {
  const v = safeString(value).trim().toLowerCase();
  if (v === "shared" || v.includes("Ù…Ø´ØªØ±Ú©")) return "shared";
  if (v === "personal" || v.includes("Ø´Ø®ØµÛŒ")) return "personal";
  return "business";
}

function sanitizeEntryType(value) {
  const v = safeString(value).trim().toLowerCase();
  if (v === "out" || v.includes("Ø®Ø±Ø¬") || v.includes("Ù¾Ø±Ø¯Ø§Ø®Øª")) return "out";
  return "in";
}

function toBoolean(value, defaultValue = false) {
  if (typeof value === "boolean") return value;
  const v = safeString(value).trim().toLowerCase();
  if (!v) return defaultValue;
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return defaultValue;
}

function sanitizePricingModel(value) {
  const v = safeString(value).trim().toLowerCase();
  if (
    v === "hourly" ||
    v === "daily" ||
    v === "weekly" ||
    v === "monthly" ||
    v === "project" ||
    v === "per-minute"
  ) {
    return v;
  }
  return "project";
}

function sanitizeProjectStatus(value) {
  const v = safeString(value).trim().toLowerCase();
  if (v === "open" || v === "in-progress" || v === "done" || v === "cancelled") {
    return v;
  }
  return "open";
}

function sanitizePartnerPaymentModel(value) {
  const v = safeString(value).trim().toLowerCase();
  if (v === "percent") return "percent";
  if (v === "salary" || v === "fixed" || v.includes("salary")) return "salary";
  return "percent";
}

function sanitizePartnerSalaryPeriod(value) {
  const v = safeString(value).trim().toLowerCase();
  if (v === "weekly") return "weekly";
  return "monthly";
}

function sanitizeTermPaymentModel(value) {
  const v = safeString(value).trim().toLowerCase();
  if (v === "percent") return "percent";
  if (v === "salary_weekly" || v === "salary-weekly") return "salary_weekly";
  if (v === "salary_monthly" || v === "salary-monthly") return "salary_monthly";
  if (v === "weekly") return "salary_weekly";
  if (v === "monthly" || v === "salary") return "salary_monthly";
  return "percent";
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

function toSettingsResponse(settings, profile = null) {
  const profileView = profile && typeof profile === "object" ? profile : {};
  return {
    model: settings.model,
    hasApiKey: Boolean(settings.apiKey),
    apiKeyMasked: settings.apiKey ? maskApiKey(settings.apiKey) : "",
    displayName: normalizeProfileDisplayName(profileView.displayName || "")
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
          parsed.assistantReply ?? parsed.reply ?? parsed.message ?? parsed.response
        ).trim(),
        pendingActions: Array.isArray(parsed.pendingActions)
          ? parsed.pendingActions
          : Array.isArray(parsed.actions)
            ? parsed.actions
            : Array.isArray(parsed.pending_actions)
              ? parsed.pending_actions
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

function normalizeServicePayload(rawPayload) {
  const hasIsActive = hasOwn(rawPayload, "isActive");
  return {
    id: toId(rawPayload?.id ?? rawPayload?.serviceId),
    name: safeString(rawPayload?.name).trim(),
    serviceName: safeString(rawPayload?.serviceName ?? rawPayload?.name).trim(),
    pricingModel: sanitizePricingModel(rawPayload?.pricingModel),
    rate: parseAmount(rawPayload?.rate),
    currency: "TOMAN",
    description: safeString(rawPayload?.description).trim(),
    isActive: hasIsActive ? toBoolean(rawPayload?.isActive, true) : null
  };
}

function normalizeProjectPayload(rawPayload, fallbackDate) {
  const hasStartDate = hasOwn(rawPayload, "startDate");
  const hasEndDate = hasOwn(rawPayload, "endDate");
  const serviceIds = Array.isArray(rawPayload?.serviceIds)
    ? rawPayload.serviceIds.map((item) => toId(item)).filter(Boolean)
    : [];
  const serviceNames = Array.isArray(rawPayload?.serviceNames)
    ? rawPayload.serviceNames.map((item) => safeString(item).trim()).filter(Boolean)
    : [];

  return {
    id: toId(rawPayload?.id ?? rawPayload?.projectId),
    title: safeString(rawPayload?.title).trim(),
    projectTitle: safeString(rawPayload?.projectTitle ?? rawPayload?.title).trim(),
    clientName: safeString(rawPayload?.clientName).trim(),
    status: sanitizeProjectStatus(rawPayload?.status),
    startDate: hasStartDate ? toCanonicalJalaliDate(rawPayload?.startDate, fallbackDate) : "",
    endDate: hasEndDate ? toCanonicalJalaliDate(rawPayload?.endDate, "") : "",
    notes: safeString(rawPayload?.notes).trim(),
    serviceIds,
    serviceNames
  };
}

function normalizePartnerPayload(rawPayload) {
  const hasIsActive = hasOwn(rawPayload, "isActive");
  return {
    id: toId(rawPayload?.id ?? rawPayload?.partnerId),
    fullName: safeString(rawPayload?.fullName).trim(),
    partnerName: safeString(rawPayload?.partnerName ?? rawPayload?.fullName).trim(),
    role: safeString(rawPayload?.role).trim(),
    phone: safeString(rawPayload?.phone).trim(),
    sharePercent: parseAmount(rawPayload?.sharePercent),
    paymentModel: sanitizePartnerPaymentModel(rawPayload?.paymentModel),
    salaryPeriod: sanitizePartnerSalaryPeriod(rawPayload?.salaryPeriod),
    salaryAmount: parseAmount(rawPayload?.salaryAmount),
    isActive: hasIsActive ? toBoolean(rawPayload?.isActive, true) : null
  };
}

function normalizePartnerTermPayload(rawPayload) {
  return {
    id: toId(rawPayload?.id ?? rawPayload?.termId),
    partnerId: toId(rawPayload?.partnerId),
    partnerName: safeString(rawPayload?.partnerName).trim(),
    projectId: toId(rawPayload?.projectId),
    projectTitle: safeString(rawPayload?.projectTitle).trim(),
    paymentModel: sanitizeTermPaymentModel(rawPayload?.paymentModel),
    percentValue: parseAmount(rawPayload?.percentValue),
    salaryAmount: parseAmount(rawPayload?.salaryAmount)
  };
}

function normalizeSettlementPayload(rawPayload, fallbackDate) {
  const hasSettlementDate = hasOwn(rawPayload, "settlementDate");
  const amount = parseAmount(rawPayload?.amount);
  const hasSettlementType = hasOwn(rawPayload, "settlementType");
  const hasPaymentMethod = hasOwn(rawPayload, "paymentMethod");
  return {
    id: toId(rawPayload?.id ?? rawPayload?.settlementId),
    settlementType: hasSettlementType ? sanitizeSettlementType(rawPayload?.settlementType) : "",
    relatedId: toId(rawPayload?.relatedId),
    partnerName: safeString(rawPayload?.partnerName).trim(),
    counterpartyName: safeString(rawPayload?.counterpartyName).trim(),
    projectId: toId(rawPayload?.projectId),
    projectTitle: safeString(rawPayload?.projectTitle).trim(),
    amount,
    paymentMethod: hasPaymentMethod ? sanitizePaymentMethod(rawPayload?.paymentMethod) : "",
    description: safeString(rawPayload?.description).trim(),
    settlementDate: hasSettlementDate
      ? toCanonicalJalaliDate(rawPayload?.settlementDate, fallbackDate)
      : ""
  };
}

function normalizeExpensePayload(rawPayload, fallbackDate) {
  const hasScope = hasOwn(rawPayload, "scope");
  const hasCategory = hasOwn(rawPayload, "category");
  const hasExpenseDate = hasOwn(rawPayload, "expenseDate");
  return {
    id: toId(rawPayload?.id ?? rawPayload?.expenseId),
    scope: hasScope ? sanitizeExpenseScope(rawPayload?.scope) : "",
    paidBy: safeString(rawPayload?.paidBy).trim(),
    category: hasCategory ? safeString(rawPayload?.category).trim() : "",
    amount: parseAmount(rawPayload?.amount),
    expenseDate: hasExpenseDate
      ? toCanonicalJalaliDate(rawPayload?.expenseDate, fallbackDate)
      : "",
    description: safeString(rawPayload?.description).trim()
  };
}

function normalizeCashboxPayload(rawPayload, fallbackDate) {
  const hasEntryType = hasOwn(rawPayload, "entryType");
  const hasEntryDate = hasOwn(rawPayload, "entryDate");
  return {
    id: toId(rawPayload?.id ?? rawPayload?.cashboxId),
    entryType: hasEntryType ? sanitizeEntryType(rawPayload?.entryType) : "",
    amount: parseAmount(rawPayload?.amount),
    category: safeString(rawPayload?.category).trim(),
    referenceType: safeString(rawPayload?.referenceType).trim(),
    referenceId: toId(rawPayload?.referenceId),
    entryDate: hasEntryDate ? toCanonicalJalaliDate(rawPayload?.entryDate, fallbackDate) : "",
    description: safeString(rawPayload?.description).trim()
  };
}

function normalizeReminderPayload(rawPayload, fallbackDate) {
  const hasRepeatType = hasOwn(rawPayload, "repeatType");
  const hasIsDone = hasOwn(rawPayload, "isDone");
  const hasReminderDate = hasOwn(rawPayload, "reminderDate");
  const hasReminderTime = hasOwn(rawPayload, "reminderTime");
  const repeatType = hasRepeatType ? sanitizeRepeatType(rawPayload?.repeatType) : "";
  const repeatUntil =
    repeatType === "none"
      ? ""
      : toCanonicalJalaliDate(rawPayload?.repeatUntil, safeString(rawPayload?.repeatUntil).trim());
  return {
    id: toId(rawPayload?.id ?? rawPayload?.reminderId),
    title: safeString(rawPayload?.title).trim(),
    description: safeString(rawPayload?.description).trim(),
    reminderDate: hasReminderDate
      ? toCanonicalJalaliDate(rawPayload?.reminderDate, fallbackDate)
      : "",
    reminderTime: hasReminderTime ? sanitizeReminderTime(rawPayload?.reminderTime) : "",
    isDone: hasIsDone ? toBoolean(rawPayload?.isDone, false) : null,
    repeatType,
    repeatUntil,
    snoozeUntil: safeString(rawPayload?.snoozeUntil).trim(),
    projectId: toId(rawPayload?.projectId),
    projectTitle: safeString(rawPayload?.projectTitle).trim(),
    partnerId: toId(rawPayload?.partnerId),
    partnerName: safeString(rawPayload?.partnerName).trim()
  };
}

function normalizeReminderSnoozePayload(rawPayload) {
  const rawMinutes = Number(rawPayload?.minutes);
  const safeMinutes = Number.isFinite(rawMinutes) ? Math.trunc(rawMinutes) : 30;
  return {
    id: toId(rawPayload?.id ?? rawPayload?.reminderId),
    minutes: Math.max(1, Math.min(24 * 60, safeMinutes))
  };
}

function normalizeSqlPayload(rawPayload) {
  const params = rawPayload?.params;
  let safeParams = {};
  if (Array.isArray(params)) {
    safeParams = params;
  } else if (params && typeof params === "object") {
    safeParams = params;
  }
  return {
    sql: safeString(rawPayload?.sql).trim(),
    params: safeParams
  };
}

function normalizeCalculationPayload(rawPayload) {
  return {
    expression: safeString(rawPayload?.expression ?? rawPayload?.formula).trim()
  };
}

function buildActionSummary(type, payload) {
  if (type === "create_service") {
    return `Create service ${payload.name || "-"}`;
  }
  if (type === "update_service") {
    return `Update service ${payload.id || payload.serviceName || "-"}`;
  }
  if (type === "delete_service") {
    return `Delete service ${payload.id || payload.serviceName || "-"}`;
  }
  if (type === "create_project") {
    return `Create project ${payload.title || "-"}`;
  }
  if (type === "update_project") {
    return `Update project ${payload.id || payload.projectTitle || "-"}`;
  }
  if (type === "delete_project") {
    return `Delete project ${payload.id || payload.projectTitle || "-"}`;
  }
  if (type === "create_partner") {
    return `Create partner ${payload.fullName || "-"}`;
  }
  if (type === "update_partner") {
    return `Update partner ${payload.id || payload.partnerName || "-"}`;
  }
  if (type === "delete_partner") {
    return `Delete partner ${payload.id || payload.partnerName || "-"}`;
  }
  if (type === "upsert_partner_term") {
    return `Upsert partner term ${payload.partnerName || payload.partnerId || "-"} / ${payload.projectTitle || payload.projectId || "-"}`;
  }
  if (type === "delete_partner_term") {
    return `Delete partner term ${payload.id || `${payload.partnerName || payload.partnerId || "-"}/${payload.projectTitle || payload.projectId || "-"}`}`;
  }
  if (type === "create_settlement") {
    return `Create settlement ${payload.settlementType} amount ${payload.amount}`;
  }
  if (type === "update_settlement") {
    return `Update settlement ${payload.id || "-"}`;
  }
  if (type === "delete_settlement") {
    return `Delete settlement ${payload.id || "-"}`;
  }
  if (type === "create_expense") {
    return `Create expense amount ${payload.amount} (${payload.category || "general"})`;
  }
  if (type === "update_expense") {
    return `Update expense ${payload.id || "-"}`;
  }
  if (type === "delete_expense") {
    return `Delete expense ${payload.id || "-"}`;
  }
  if (type === "create_cashbox") {
    return `Create cashbox ${payload.entryType} amount ${payload.amount}`;
  }
  if (type === "update_cashbox") {
    return `Update cashbox ${payload.id || "-"}`;
  }
  if (type === "delete_cashbox") {
    return `Delete cashbox ${payload.id || "-"}`;
  }
  if (type === "create_reminder") {
    return `Create reminder ${payload.title || "-"} at ${payload.reminderDate} ${payload.reminderTime}`;
  }
  if (type === "update_reminder") {
    return `Update reminder ${payload.id || "-"}`;
  }
  if (type === "toggle_reminder_done") {
    return `Toggle reminder done ${payload.id || "-"}`;
  }
  if (type === "snooze_reminder") {
    return `Snooze reminder ${payload.id || "-"} for ${payload.minutes || 30}m`;
  }
  if (type === "clear_reminder_snooze") {
    return `Clear reminder snooze ${payload.id || "-"}`;
  }
  if (type === "delete_reminder") {
    return `Delete reminder ${payload.id || "-"}`;
  }
  if (type === "run_report_business") {
    return "Run business report";
  }
  if (type === "run_report_project_profit") {
    return "Run project profit report";
  }
  if (type === "export_business_excel") {
    return "Export business report to Excel";
  }
  if (type === "export_business_pdf") {
    return "Export business report to PDF";
  }
  if (type === "export_project_profit_excel") {
    return "Export project profit report to Excel";
  }
  if (type === "export_project_profit_pdf") {
    return "Export project profit report to PDF";
  }
  if (type === "run_sql") {
    return `Run SQL: ${(payload.sql || "").slice(0, 60)}`;
  }
  if (type === "calculate_expression") {
    return `Calculate: ${payload.expression || "-"}`;
  }
  return "Operation";
}

function normalizeAction(rawAction, fallbackDate) {
  const type = safeString(
    rawAction?.type ?? rawAction?.action ?? rawAction?.operation
  )
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  if (!SUPPORTED_ACTION_TYPES.has(type)) return null;

  let payload = {};
  if (type === "create_service" || type === "update_service" || type === "delete_service") {
    payload = normalizeServicePayload(rawAction?.payload);
  } else if (type === "create_project" || type === "update_project" || type === "delete_project") {
    payload = normalizeProjectPayload(rawAction?.payload, fallbackDate);
  } else if (type === "create_partner" || type === "update_partner" || type === "delete_partner") {
    payload = normalizePartnerPayload(rawAction?.payload);
  } else if (type === "upsert_partner_term" || type === "delete_partner_term") {
    payload = normalizePartnerTermPayload(rawAction?.payload);
  } else if (type === "create_settlement" || type === "update_settlement" || type === "delete_settlement") {
    payload = normalizeSettlementPayload(rawAction?.payload, fallbackDate);
  } else if (type === "create_expense" || type === "update_expense" || type === "delete_expense") {
    payload = normalizeExpensePayload(rawAction?.payload, fallbackDate);
  } else if (type === "create_cashbox" || type === "update_cashbox" || type === "delete_cashbox") {
    payload = normalizeCashboxPayload(rawAction?.payload, fallbackDate);
  } else if (
    type === "create_reminder" ||
    type === "update_reminder" ||
    type === "toggle_reminder_done" ||
    type === "clear_reminder_snooze" ||
    type === "delete_reminder"
  ) {
    payload = normalizeReminderPayload(rawAction?.payload, fallbackDate);
  } else if (type === "snooze_reminder") {
    payload = normalizeReminderSnoozePayload(rawAction?.payload);
  } else if (type === "run_sql") {
    payload = normalizeSqlPayload(rawAction?.payload);
  } else if (type === "calculate_expression") {
    payload = normalizeCalculationPayload(rawAction?.payload);
  }

  const summary = safeString(rawAction?.summary).trim() || buildActionSummary(type, payload);
  const kind =
    type === "run_sql" ||
    type === "run_report_business" ||
    type === "run_report_project_profit" ||
    type === "export_business_excel" ||
    type === "export_business_pdf" ||
    type === "export_project_profit_excel" ||
    type === "export_project_profit_pdf" ||
    type === "calculate_expression"
      ? "tool"
      : "write";

  return {
    kind,
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

function uniqueIds(items) {
  return Array.from(new Set((items || []).map((item) => toId(item)).filter(Boolean)));
}

function resolveServiceId(payload, statements) {
  const directId = toId(payload?.id ?? payload?.serviceId);
  if (directId) {
    const row = statements.serviceById.get(directId);
    if (row) return row.id;
  }

  const name = safeString(payload?.serviceName ?? payload?.name).trim();
  if (!name) return null;

  const exact = statements.serviceByNameExact.get(name);
  if (exact) return exact.id;

  const like = statements.serviceByNameLike.get(`%${escapeLikePattern(name)}%`);
  return like?.id || null;
}

function resolveProjectId(payload, statements) {
  const directId = toId(payload?.id ?? payload?.projectId);
  if (directId) {
    const row = statements.projectById.get(directId);
    if (row) return row.id;
  }

  const title = safeString(payload?.projectTitle ?? payload?.title).trim();
  if (!title) return null;

  const exact = statements.projectByTitleExact.get(title);
  if (exact) return exact.id;

  const like = statements.projectByTitleLike.get(`%${escapeLikePattern(title)}%`);
  if (like) return like.id;
  return null;
}

function resolvePartner(payload, statements) {
  const directId = toId(payload?.id ?? payload?.relatedId ?? payload?.partnerId);
  if (directId) {
    const row = statements.partnerById.get(directId);
    if (row) return row;
  }

  const byName = safeString(payload?.partnerName ?? payload?.fullName).trim();
  if (!byName) return null;

  const exact = statements.partnerByNameExact.get(byName);
  if (exact) return exact;

  const like = statements.partnerByNameLike.get(`%${escapeLikePattern(byName)}%`);
  if (like) return like;
  return null;
}

function resolvePartnerTermId(payload, statements) {
  const directId = toId(payload?.id ?? payload?.termId);
  if (directId) {
    const row = statements.partnerTermById.get(directId);
    if (row) return row.id;
  }

  const partner = resolvePartner(payload, statements);
  const projectId = resolveProjectId(payload, statements);
  if (!partner?.id || !projectId) return null;

  const row = statements.partnerTermByPair.get(partner.id, projectId);
  return row?.id || null;
}

function resolveReminderId(payload, statements) {
  const directId = toId(payload?.id ?? payload?.reminderId);
  if (directId) {
    const row = statements.reminderById.get(directId);
    if (row) return row.id;
  }

  const title = safeString(payload?.title).trim();
  const reminderDate = toCanonicalJalaliDate(payload?.reminderDate, "");
  if (!title || !reminderDate) return null;

  const row = statements.reminderByTitleDateLatest.get(title, reminderDate);
  return row?.id || null;
}

function resolveExpenseId(payload, statements) {
  const directId = toId(payload?.id ?? payload?.expenseId);
  if (directId) {
    const row = statements.expenseById.get(directId);
    if (row) return row.id;
  }
  return null;
}

function resolveCashboxId(payload, statements) {
  const directId = toId(payload?.id ?? payload?.cashboxId);
  if (directId) {
    const row = statements.cashboxById.get(directId);
    if (row) return row.id;
  }
  return null;
}

function resolveSettlementId(payload, statements) {
  const directId = toId(payload?.id ?? payload?.settlementId);
  if (directId) {
    const row = statements.settlementById.get(directId);
    if (row) return row.id;
  }
  return null;
}

function resolveServiceIds(payload, statements, fallbackIds = []) {
  if (Array.isArray(payload?.serviceIds) && payload.serviceIds.length) {
    return uniqueIds(payload.serviceIds).filter((id) => Boolean(statements.serviceById.get(id)));
  }

  if (Array.isArray(payload?.serviceNames) && payload.serviceNames.length) {
    const ids = payload.serviceNames
      .map((name) => resolveServiceId({ serviceName: name }, statements))
      .filter(Boolean);
    return uniqueIds(ids);
  }

  return uniqueIds(fallbackIds).filter((id) => Boolean(statements.serviceById.get(id)));
}

function assertPositiveAmount(amount) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be greater than zero.");
  }
}

function assertRequiredText(value, fieldLabel) {
  if (!safeString(value).trim()) {
    throw new Error(`${fieldLabel} is required.`);
  }
}

function executeCreateService(action, statements) {
  const payload = normalizeServicePayload(action.payload);
  assertRequiredText(payload.name, "Service name");

  const info = statements.createService.run({
    name: payload.name,
    pricingModel: payload.pricingModel,
    rate: Number(payload.rate || 0),
    currency: payload.currency || "TOMAN",
    description: payload.description,
    isActive: payload.isActive === false ? 0 : 1,
    createdAt: new Date().toISOString()
  });

  return {
    id: info.lastInsertRowid,
    summary: buildActionSummary("create_service", payload)
  };
}

function executeUpdateService(action, statements) {
  const payload = normalizeServicePayload(action.payload);
  const serviceId = resolveServiceId(payload, statements);
  if (!serviceId) throw new Error("Service not found for update.");

  const current = statements.serviceById.get(serviceId);
  const next = {
    id: serviceId,
    name: payload.name || current.name,
    pricingModel: payload.pricingModel || current.pricingModel,
    rate: Number(payload.rate || current.rate || 0),
    currency: payload.currency || current.currency || "TOMAN",
    description: payload.description || current.description || "",
    isActive:
      payload.isActive === null || payload.isActive === undefined
        ? Number(current.isActive || 0)
        : payload.isActive
          ? 1
          : 0
  };

  statements.updateService.run(next);
  return {
    id: serviceId,
    summary: buildActionSummary("update_service", payload)
  };
}

function executeDeleteService(action, statements) {
  const payload = normalizeServicePayload(action.payload);
  const serviceId = resolveServiceId(payload, statements);
  if (!serviceId) throw new Error("Service not found for delete.");

  statements.deleteService.run(serviceId);
  return {
    id: serviceId,
    summary: buildActionSummary("delete_service", payload)
  };
}

function executeCreateProject(action, statements) {
  const payload = normalizeProjectPayload(action.payload, getTodayJalaliDate());
  assertRequiredText(payload.title, "Project title");
  assertRequiredText(payload.clientName, "Client name");

  const now = new Date().toISOString();
  const serviceIds = resolveServiceIds(payload, statements, []);

  const runTx = statements.db.transaction(() => {
    const info = statements.createProject.run({
      title: payload.title,
      clientName: payload.clientName,
      status: payload.status,
      startDate: payload.startDate || getTodayJalaliDate(),
      endDate: payload.endDate || "",
      notes: payload.notes,
      createdAt: now
    });

    const projectId = Number(info.lastInsertRowid);
    for (const serviceId of serviceIds) {
      statements.insertProjectService.run(projectId, serviceId, now);
    }
    return projectId;
  });

  const id = runTx();
  return {
    id,
    summary: buildActionSummary("create_project", payload)
  };
}

function executeUpdateProject(action, statements) {
  const payload = normalizeProjectPayload(action.payload, getTodayJalaliDate());
  const projectId = resolveProjectId(payload, statements);
  if (!projectId) throw new Error("Project not found for update.");

  const current = statements.projectByIdDetail.get(projectId);
  if (!current) throw new Error("Project not found for update.");

  const currentServiceIds = statements.projectServiceIdsByProject
    .all(projectId)
    .map((row) => Number(row.serviceId));
  const nextServiceIds = resolveServiceIds(payload, statements, currentServiceIds);

  const runTx = statements.db.transaction(() => {
    statements.updateProject.run({
      id: projectId,
      title: payload.title || current.title,
      clientName: payload.clientName || current.clientName,
      status: payload.status || current.status,
      startDate: payload.startDate || current.startDate,
      endDate: payload.endDate || current.endDate || "",
      notes: payload.notes || current.notes || ""
    });

    statements.deleteProjectServices.run(projectId);
    const now = new Date().toISOString();
    for (const serviceId of nextServiceIds) {
      statements.insertProjectService.run(projectId, serviceId, now);
    }
  });

  runTx();
  return {
    id: projectId,
    summary: buildActionSummary("update_project", payload)
  };
}

function executeDeleteProject(action, statements) {
  const payload = normalizeProjectPayload(action.payload, getTodayJalaliDate());
  const projectId = resolveProjectId(payload, statements);
  if (!projectId) throw new Error("Project not found for delete.");

  statements.deleteProject.run(projectId);
  return {
    id: projectId,
    summary: buildActionSummary("delete_project", payload)
  };
}

function executeCreatePartner(action, statements) {
  const payload = normalizePartnerPayload(action.payload);
  assertRequiredText(payload.fullName, "Partner name");

  const info = statements.createPartner.run({
    fullName: payload.fullName,
    role: payload.role,
    phone: payload.phone,
    sharePercent: Number(payload.sharePercent || 0),
    paymentModel: payload.paymentModel,
    salaryPeriod: payload.salaryPeriod,
    salaryAmount: Number(payload.salaryAmount || 0),
    isActive: payload.isActive === false ? 0 : 1,
    createdAt: new Date().toISOString()
  });

  return {
    id: info.lastInsertRowid,
    summary: buildActionSummary("create_partner", payload)
  };
}

function executeUpdatePartner(action, statements) {
  const payload = normalizePartnerPayload(action.payload);
  const partner = resolvePartner(payload, statements);
  if (!partner?.id) throw new Error("Partner not found for update.");

  const current = statements.partnerById.get(partner.id);
  statements.updatePartner.run({
    id: partner.id,
    fullName: payload.fullName || current.fullName,
    role: payload.role || current.role || "",
    phone: payload.phone || current.phone || "",
    sharePercent: Number(payload.sharePercent || current.sharePercent || 0),
    paymentModel: payload.paymentModel || current.paymentModel || "percent",
    salaryPeriod: payload.salaryPeriod || current.salaryPeriod || "monthly",
    salaryAmount: Number(payload.salaryAmount || current.salaryAmount || 0),
    isActive:
      payload.isActive === null || payload.isActive === undefined
        ? Number(current.isActive || 0)
        : payload.isActive
          ? 1
          : 0
  });

  return {
    id: partner.id,
    summary: buildActionSummary("update_partner", payload)
  };
}

function executeDeletePartner(action, statements) {
  const payload = normalizePartnerPayload(action.payload);
  const partner = resolvePartner(payload, statements);
  if (!partner?.id) throw new Error("Partner not found for delete.");

  statements.deletePartner.run(partner.id);
  return {
    id: partner.id,
    summary: buildActionSummary("delete_partner", payload)
  };
}

function executeUpsertPartnerTerm(action, statements) {
  const payload = normalizePartnerTermPayload(action.payload);
  const partner = resolvePartner(payload, statements);
  const projectId = resolveProjectId(payload, statements);
  if (!partner?.id || !projectId) {
    throw new Error("Partner and project are required for term upsert.");
  }

  const now = new Date().toISOString();
  statements.upsertPartnerTerm.run({
    partnerId: partner.id,
    projectId,
    paymentModel: payload.paymentModel,
    percentValue: Number(payload.percentValue || 0),
    salaryAmount: Number(payload.salaryAmount || 0),
    createdAt: now,
    updatedAt: now
  });
  const termRow = statements.partnerTermByPair.get(partner.id, projectId);

  return {
    id: termRow?.id || `${partner.id}/${projectId}`,
    partnerId: partner.id,
    projectId,
    summary: buildActionSummary("upsert_partner_term", payload)
  };
}

function executeDeletePartnerTerm(action, statements) {
  const payload = normalizePartnerTermPayload(action.payload);
  const termId = resolvePartnerTermId(payload, statements);
  if (!termId) throw new Error("Partner term not found for delete.");

  statements.deletePartnerTerm.run(termId);
  return {
    id: termId,
    summary: buildActionSummary("delete_partner_term", payload)
  };
}

function executeCreateSettlement(action, statements) {
  const payload = normalizeSettlementPayload(action.payload, getTodayJalaliDate());
  const settlementType = payload.settlementType || "personal";
  assertPositiveAmount(payload.amount);

  const partner = resolvePartner(payload, statements);
  const projectId = resolveProjectId(payload, statements);
  const now = new Date().toISOString();

  const relatedId = settlementType === "partner" ? partner?.id || payload.relatedId : null;
  const counterpartyName = payload.counterpartyName || partner?.fullName || "";

  const info = statements.createSettlement.run({
    settlementType,
    relatedId: relatedId || null,
    counterpartyName,
    projectId,
    amount: payload.amount,
    paymentMethod: payload.paymentMethod || "cash",
    description: payload.description,
    settlementDate: payload.settlementDate || getTodayJalaliDate(),
    createdAt: now
  });

  return {
    id: info.lastInsertRowid,
    summary: buildActionSummary("create_settlement", payload)
  };
}

function executeUpdateSettlement(action, statements) {
  const payload = normalizeSettlementPayload(action.payload, getTodayJalaliDate());
  const settlementId = resolveSettlementId(payload, statements);
  if (!settlementId) throw new Error("Settlement not found for update.");

  const current = statements.settlementById.get(settlementId);
  const partner = resolvePartner(payload, statements);
  const projectId = resolveProjectId(payload, statements) || current.projectId || null;
  const settlementType = payload.settlementType || current.settlementType || "personal";
  const relatedId =
    settlementType === "partner"
      ? partner?.id || payload.relatedId || current.relatedId || null
      : null;

  statements.updateSettlement.run({
    id: settlementId,
    settlementType,
    relatedId,
    counterpartyName: payload.counterpartyName || current.counterpartyName || partner?.fullName || "",
    projectId,
    amount: Number(payload.amount || current.amount || 0),
    paymentMethod: payload.paymentMethod || current.paymentMethod || "cash",
    description: payload.description || current.description || "",
    settlementDate: payload.settlementDate || current.settlementDate
  });

  return {
    id: settlementId,
    summary: buildActionSummary("update_settlement", payload)
  };
}

function executeDeleteSettlement(action, statements) {
  const payload = normalizeSettlementPayload(action.payload, getTodayJalaliDate());
  const settlementId = resolveSettlementId(payload, statements);
  if (!settlementId) throw new Error("Settlement not found for delete.");

  statements.deleteSettlement.run(settlementId);
  return {
    id: settlementId,
    summary: buildActionSummary("delete_settlement", payload)
  };
}

function executeCreateReminder(action, statements) {
  const payload = normalizeReminderPayload(action.payload, getTodayJalaliDate());
  if (!payload.title) {
    throw new Error("Reminder title is required.");
  }

  const projectId = resolveProjectId(payload, statements);
  const partner = resolvePartner(payload, statements);
  const now = new Date().toISOString();

  const info = statements.createReminder.run({
    title: payload.title,
    description: payload.description,
    reminderDate: payload.reminderDate || getTodayJalaliDate(),
    reminderTime: payload.reminderTime || "09:00",
    isDone: payload.isDone ? 1 : 0,
    repeatType: payload.repeatType || "none",
    repeatUntil: payload.repeatUntil,
    snoozeUntil: payload.snoozeUntil || "",
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

function executeUpdateReminder(action, statements) {
  const payload = normalizeReminderPayload(action.payload, getTodayJalaliDate());
  const reminderId = resolveReminderId(payload, statements);
  if (!reminderId) throw new Error("Reminder not found for update.");

  const current = statements.reminderById.get(reminderId);
  const projectId = resolveProjectId(payload, statements) || current.projectId || null;
  const partner = resolvePartner(payload, statements);
  const repeatType = payload.repeatType || current.repeatType || "none";
  let repeatUntil = current.repeatUntil || "";
  if (payload.repeatType === "none") {
    repeatUntil = "";
  } else if (payload.repeatUntil) {
    repeatUntil = payload.repeatUntil;
  }

  statements.updateReminder.run({
    id: reminderId,
    title: payload.title || current.title,
    description: payload.description || current.description || "",
    reminderDate: payload.reminderDate || current.reminderDate,
    reminderTime: payload.reminderTime || current.reminderTime || "09:00",
    isDone:
      payload.isDone === null || payload.isDone === undefined
        ? Number(current.isDone || 0)
        : payload.isDone
          ? 1
          : 0,
    repeatType,
    repeatUntil,
    snoozeUntil: payload.snoozeUntil || current.snoozeUntil || "",
    projectId,
    partnerId: partner?.id || payload.partnerId || current.partnerId || null,
    updatedAt: new Date().toISOString()
  });

  return {
    id: reminderId,
    summary: buildActionSummary("update_reminder", payload)
  };
}

function executeToggleReminderDone(action, statements) {
  const payload = normalizeReminderPayload(action.payload, getTodayJalaliDate());
  const reminderId = resolveReminderId(payload, statements);
  if (!reminderId) throw new Error("Reminder not found for toggle.");
  const nextDone =
    payload.isDone === null || payload.isDone === undefined ? true : Boolean(payload.isDone);

  statements.toggleReminderDone.run({
    id: reminderId,
    isDone: nextDone ? 1 : 0,
    snoozeUntil: "",
    updatedAt: new Date().toISOString()
  });

  return {
    id: reminderId,
    summary: buildActionSummary("toggle_reminder_done", payload)
  };
}

function executeSnoozeReminder(action, statements) {
  const payload = normalizeReminderSnoozePayload(action.payload);
  if (!payload.id) throw new Error("Reminder ID is required for snooze.");

  const snoozeUntil = new Date(Date.now() + payload.minutes * 60 * 1000).toISOString();
  statements.snoozeReminder.run({
    id: payload.id,
    snoozeUntil,
    updatedAt: new Date().toISOString()
  });

  return {
    id: payload.id,
    summary: buildActionSummary("snooze_reminder", payload)
  };
}

function executeClearReminderSnooze(action, statements) {
  const payload = normalizeReminderPayload(action.payload, getTodayJalaliDate());
  const reminderId = resolveReminderId(payload, statements);
  if (!reminderId) throw new Error("Reminder not found for clear snooze.");

  statements.clearReminderSnooze.run({
    id: reminderId,
    updatedAt: new Date().toISOString()
  });

  return {
    id: reminderId,
    summary: buildActionSummary("clear_reminder_snooze", payload)
  };
}

function executeDeleteReminder(action, statements) {
  const payload = normalizeReminderPayload(action.payload, getTodayJalaliDate());
  const reminderId = resolveReminderId(payload, statements);
  if (!reminderId) throw new Error("Reminder not found for delete.");

  statements.deleteReminder.run(reminderId);
  return {
    id: reminderId,
    summary: buildActionSummary("delete_reminder", payload)
  };
}

function executeCreateExpense(action, statements) {
  const payload = normalizeExpensePayload(action.payload, getTodayJalaliDate());
  assertPositiveAmount(payload.amount);

  const info = statements.createExpense.run({
    scope: payload.scope || "business",
    paidBy: payload.paidBy,
    category: payload.category || "general",
    amount: payload.amount,
    expenseDate: payload.expenseDate || getTodayJalaliDate(),
    description: payload.description,
    createdAt: new Date().toISOString()
  });

  return {
    id: info.lastInsertRowid,
    summary: buildActionSummary("create_expense", payload)
  };
}

function executeUpdateExpense(action, statements) {
  const payload = normalizeExpensePayload(action.payload, getTodayJalaliDate());
  const expenseId = resolveExpenseId(payload, statements);
  if (!expenseId) throw new Error("Expense not found for update.");

  const current = statements.expenseById.get(expenseId);
  statements.updateExpense.run({
    id: expenseId,
    scope: payload.scope || current.scope || "business",
    paidBy: payload.paidBy || current.paidBy || "",
    category: payload.category || current.category || "general",
    amount: Number(payload.amount || current.amount || 0),
    expenseDate: payload.expenseDate || current.expenseDate,
    description: payload.description || current.description || ""
  });

  return {
    id: expenseId,
    summary: buildActionSummary("update_expense", payload)
  };
}

function executeDeleteExpense(action, statements) {
  const payload = normalizeExpensePayload(action.payload, getTodayJalaliDate());
  const expenseId = resolveExpenseId(payload, statements);
  if (!expenseId) throw new Error("Expense not found for delete.");

  statements.deleteExpense.run(expenseId);
  return {
    id: expenseId,
    summary: buildActionSummary("delete_expense", payload)
  };
}

function executeCreateCashbox(action, statements) {
  const payload = normalizeCashboxPayload(action.payload, getTodayJalaliDate());
  assertPositiveAmount(payload.amount);

  const info = statements.createCashbox.run({
    entryType: payload.entryType || "in",
    amount: payload.amount,
    category: payload.category,
    referenceType: payload.referenceType,
    referenceId: payload.referenceId,
    entryDate: payload.entryDate || getTodayJalaliDate(),
    description: payload.description,
    createdAt: new Date().toISOString()
  });

  return {
    id: info.lastInsertRowid,
    summary: buildActionSummary("create_cashbox", payload)
  };
}

function executeUpdateCashbox(action, statements) {
  const payload = normalizeCashboxPayload(action.payload, getTodayJalaliDate());
  const cashboxId = resolveCashboxId(payload, statements);
  if (!cashboxId) throw new Error("Cashbox entry not found for update.");

  const current = statements.cashboxById.get(cashboxId);
  statements.updateCashbox.run({
    id: cashboxId,
    entryType: payload.entryType || current.entryType || "in",
    amount: Number(payload.amount || current.amount || 0),
    category: payload.category || current.category || "",
    referenceType: payload.referenceType || current.referenceType || "",
    referenceId: payload.referenceId || current.referenceId || null,
    entryDate: payload.entryDate || current.entryDate,
    description: payload.description || current.description || ""
  });

  return {
    id: cashboxId,
    summary: buildActionSummary("update_cashbox", payload)
  };
}

function executeDeleteCashbox(action, statements) {
  const payload = normalizeCashboxPayload(action.payload, getTodayJalaliDate());
  const cashboxId = resolveCashboxId(payload, statements);
  if (!cashboxId) throw new Error("Cashbox entry not found for delete.");

  statements.deleteCashbox.run(cashboxId);
  return {
    id: cashboxId,
    summary: buildActionSummary("delete_cashbox", payload)
  };
}

function getBusinessReportData(statements) {
  const totalsRow = statements.reportBusinessTotals.get();
  const monthly = statements.db
    .prepare(
      `
        SELECT
          substr(entry_date, 1, 7) AS monthKey,
          SUM(CASE WHEN entry_type = 'in' THEN amount ELSE 0 END) AS income,
          SUM(CASE WHEN entry_type = 'out' THEN amount ELSE 0 END) AS outcome
        FROM cashbox
        GROUP BY monthKey
        ORDER BY monthKey DESC
        LIMIT 12
      `
    )
    .all();

  const yearly = statements.db
    .prepare(
      `
        SELECT
          substr(entry_date, 1, 4) AS yearKey,
          SUM(CASE WHEN entry_type = 'in' THEN amount ELSE 0 END) AS income,
          SUM(CASE WHEN entry_type = 'out' THEN amount ELSE 0 END) AS outcome
        FROM cashbox
        GROUP BY yearKey
        ORDER BY yearKey DESC
      `
    )
    .all();

  return {
    totals: {
      totalIncome: Number(totalsRow?.totalIncome || 0),
      totalOutcome: Number(totalsRow?.totalOutcome || 0),
      totalExpenses: Number(totalsRow?.totalExpenses || 0),
      totalProjects: Number(totalsRow?.totalProjects || 0)
    },
    monthly: monthly.map((row) => ({
      monthKey: row.monthKey,
      income: Number(row.income || 0),
      outcome: Number(row.outcome || 0)
    })),
    yearly: yearly.map((row) => ({
      yearKey: row.yearKey,
      income: Number(row.income || 0),
      outcome: Number(row.outcome || 0)
    }))
  };
}

function getProjectProfitReportData(statements) {
  const projects = statements.db
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

  const partners = statements.db
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

  const totals = {
    totalClientReceived: 0,
    totalPartnerDue: 0,
    totalPartnerPaid: 0,
    totalExpectedNetProfit: 0,
    totalRealizedNetProfit: 0
  };

  projects.forEach((row) => {
    totals.totalClientReceived += Number(row.clientReceived || 0);
    totals.totalPartnerDue += Number(row.partnerDue || 0);
    totals.totalPartnerPaid += Number(row.partnerPaid || 0);
    totals.totalExpectedNetProfit += Number(row.expectedNetProfit || 0);
    totals.totalRealizedNetProfit += Number(row.realizedNetProfit || 0);
  });

  return {
    totals,
    projects: projects.map((row) => ({
      ...row,
      clientReceived: Number(row.clientReceived || 0),
      partnerDue: Number(row.partnerDue || 0),
      partnerPaid: Number(row.partnerPaid || 0),
      partnerRemaining: Number(row.partnerRemaining || 0),
      expectedNetProfit: Number(row.expectedNetProfit || 0),
      realizedNetProfit: Number(row.realizedNetProfit || 0)
    })),
    partners: partners.map((row) => ({
      ...row,
      projectsCount: Number(row.projectsCount || 0),
      dueAmount: Number(row.dueAmount || 0),
      paidAmount: Number(row.paidAmount || 0),
      remainingAmount: Number(row.remainingAmount || 0)
    }))
  };
}

function toHiddenPrintWindowOptions() {
  return {
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  };
}

async function exportBusinessReportExcel(statements, getMainWindow) {
  const report = getBusinessReportData(statements);
  const saveResult = await dialog.showSaveDialog(getMainWindow?.() || null, {
    title: "Save Business Report (Excel)",
    defaultPath: "bir-hesab-business-report.xlsx",
    filters: [{ name: "Excel", extensions: ["xlsx"] }]
  });

  if (saveResult.canceled || !saveResult.filePath) {
    return { canceled: true };
  }

  const workbook = XLSX.utils.book_new();
  const totalsRows = [
    { Metric: "Total Income", Value: report.totals.totalIncome },
    { Metric: "Total Outcome", Value: report.totals.totalOutcome },
    { Metric: "Total Expenses", Value: report.totals.totalExpenses },
    { Metric: "Total Projects", Value: report.totals.totalProjects }
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(totalsRows), "Summary");
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(report.monthly),
    "Monthly"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(report.yearly),
    "Yearly"
  );
  XLSX.writeFile(workbook, saveResult.filePath);

  return { canceled: false, filePath: saveResult.filePath };
}

async function exportBusinessReportPdf(statements, getMainWindow) {
  const report = getBusinessReportData(statements);
  const saveResult = await dialog.showSaveDialog(getMainWindow?.() || null, {
    title: "Save Business Report (PDF)",
    defaultPath: "bir-hesab-business-report.pdf",
    filters: [{ name: "PDF", extensions: ["pdf"] }]
  });

  if (saveResult.canceled || !saveResult.filePath) {
    return { canceled: true };
  }

  const rowsToHtml = (rows, keys) =>
    rows
      .map((row) => `<tr>${keys.map((key) => `<td>${String(row[key] ?? "")}</td>`).join("")}</tr>`)
      .join("");

  const totalsRows = [
    ["Total Income", report.totals.totalIncome],
    ["Total Outcome", report.totals.totalOutcome],
    ["Total Expenses", report.totals.totalExpenses],
    ["Total Projects", report.totals.totalProjects]
  ]
    .map(([k, v]) => `<tr><td>${k}</td><td>${String(v)}</td></tr>`)
    .join("");

  const html = `<!doctype html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  body { font-family: Tahoma, sans-serif; padding: 24px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
</style>
</head>
<body>
<h2>Bir Hesab Business Report</h2>
<h3>Summary</h3>
<table><tbody>${totalsRows}</tbody></table>
<h3>Monthly</h3>
<table><thead><tr><th>monthKey</th><th>income</th><th>outcome</th></tr></thead><tbody>${rowsToHtml(report.monthly, ["monthKey", "income", "outcome"])}</tbody></table>
<h3>Yearly</h3>
<table><thead><tr><th>yearKey</th><th>income</th><th>outcome</th></tr></thead><tbody>${rowsToHtml(report.yearly, ["yearKey", "income", "outcome"])}</tbody></table>
</body>
</html>`;

  const printWindow = new BrowserWindow(toHiddenPrintWindowOptions());
  await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  const pdfBuffer = await printWindow.webContents.printToPDF({
    printBackground: true,
    preferCSSPageSize: true
  });
  fs.writeFileSync(saveResult.filePath, pdfBuffer);
  printWindow.close();

  return { canceled: false, filePath: saveResult.filePath };
}

async function exportProjectProfitReportExcel(statements, getMainWindow) {
  const report = getProjectProfitReportData(statements);
  const saveResult = await dialog.showSaveDialog(getMainWindow?.() || null, {
    title: "Save Project Profit Report (Excel)",
    defaultPath: "bir-hesab-project-profit-report.xlsx",
    filters: [{ name: "Excel", extensions: ["xlsx"] }]
  });

  if (saveResult.canceled || !saveResult.filePath) {
    return { canceled: true };
  }

  const workbook = XLSX.utils.book_new();
  const totalsRows = [
    { Metric: "Client Received", Value: report.totals.totalClientReceived },
    { Metric: "Partner Due", Value: report.totals.totalPartnerDue },
    { Metric: "Partner Paid", Value: report.totals.totalPartnerPaid },
    { Metric: "Expected Net Profit", Value: report.totals.totalExpectedNetProfit },
    { Metric: "Realized Net Profit", Value: report.totals.totalRealizedNetProfit }
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(totalsRows), "Summary");
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(report.projects),
    "Projects"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(report.partners),
    "Partners"
  );

  XLSX.writeFile(workbook, saveResult.filePath);
  return { canceled: false, filePath: saveResult.filePath };
}

async function exportProjectProfitReportPdf(statements, getMainWindow) {
  const report = getProjectProfitReportData(statements);
  const saveResult = await dialog.showSaveDialog(getMainWindow?.() || null, {
    title: "Save Project Profit Report (PDF)",
    defaultPath: "bir-hesab-project-profit-report.pdf",
    filters: [{ name: "PDF", extensions: ["pdf"] }]
  });

  if (saveResult.canceled || !saveResult.filePath) {
    return { canceled: true };
  }

  const rowsToHtml = (rows, keys) =>
    rows
      .map((row) => `<tr>${keys.map((key) => `<td>${String(row[key] ?? "")}</td>`).join("")}</tr>`)
      .join("");

  const totalsRows = [
    ["Client Received", report.totals.totalClientReceived],
    ["Partner Due", report.totals.totalPartnerDue],
    ["Partner Paid", report.totals.totalPartnerPaid],
    ["Expected Net Profit", report.totals.totalExpectedNetProfit],
    ["Realized Net Profit", report.totals.totalRealizedNetProfit]
  ]
    .map(([k, v]) => `<tr><td>${k}</td><td>${String(v)}</td></tr>`)
    .join("");

  const html = `<!doctype html>
<html>
<head>
<meta charset="UTF-8" />
<style>
  body { font-family: Tahoma, sans-serif; padding: 24px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
</style>
</head>
<body>
<h2>Bir Hesab Project Profit Report</h2>
<h3>Summary</h3>
<table><tbody>${totalsRows}</tbody></table>
<h3>Projects</h3>
<table><thead><tr><th>projectTitle</th><th>clientName</th><th>clientReceived</th><th>partnerDue</th><th>partnerPaid</th><th>expectedNetProfit</th><th>realizedNetProfit</th></tr></thead><tbody>${rowsToHtml(report.projects, ["projectTitle", "clientName", "clientReceived", "partnerDue", "partnerPaid", "expectedNetProfit", "realizedNetProfit"])}</tbody></table>
<h3>Partners</h3>
<table><thead><tr><th>partnerName</th><th>projectsCount</th><th>dueAmount</th><th>paidAmount</th><th>remainingAmount</th></tr></thead><tbody>${rowsToHtml(report.partners, ["partnerName", "projectsCount", "dueAmount", "paidAmount", "remainingAmount"])}</tbody></table>
</body>
</html>`;

  const printWindow = new BrowserWindow(toHiddenPrintWindowOptions());
  await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  const pdfBuffer = await printWindow.webContents.printToPDF({
    printBackground: true,
    preferCSSPageSize: true
  });
  fs.writeFileSync(saveResult.filePath, pdfBuffer);
  printWindow.close();

  return { canceled: false, filePath: saveResult.filePath };
}

function executeRunBusinessReport(action, statements) {
  const report = getBusinessReportData(statements);
  const summary = [
    `Income: ${Number(report.totals.totalIncome || 0)}`,
    `Outcome: ${Number(report.totals.totalOutcome || 0)}`,
    `Expenses: ${Number(report.totals.totalExpenses || 0)}`,
    `Projects: ${Number(report.totals.totalProjects || 0)}`
  ].join(" | ");

  return {
    id: "report-business",
    summary: `Business report => ${summary}`
  };
}

function executeRunProjectProfitReport(action, statements) {
  const report = getProjectProfitReportData(statements);
  const summary = [
    `Client received: ${Number(report.totals.totalClientReceived || 0)}`,
    `Partner due: ${Number(report.totals.totalPartnerDue || 0)}`,
    `Partner paid: ${Number(report.totals.totalPartnerPaid || 0)}`,
    `Expected net: ${Number(report.totals.totalExpectedNetProfit || 0)}`,
    `Realized net: ${Number(report.totals.totalRealizedNetProfit || 0)}`
  ].join(" | ");

  return {
    id: "report-project-profit",
    summary: `Project profit report => ${summary}`
  };
}

async function executeExportBusinessExcel(action, statements, runtime) {
  const result = await exportBusinessReportExcel(statements, runtime?.getMainWindow);
  if (result.canceled) {
    return {
      id: "export-business-excel",
      summary: "Excel export cancelled."
    };
  }
  return {
    id: "export-business-excel",
    summary: `Business Excel exported: ${result.filePath}`
  };
}

async function executeExportBusinessPdf(action, statements, runtime) {
  const result = await exportBusinessReportPdf(statements, runtime?.getMainWindow);
  if (result.canceled) {
    return {
      id: "export-business-pdf",
      summary: "PDF export cancelled."
    };
  }
  return {
    id: "export-business-pdf",
    summary: `Business PDF exported: ${result.filePath}`
  };
}

async function executeExportProjectProfitExcel(action, statements, runtime) {
  const result = await exportProjectProfitReportExcel(statements, runtime?.getMainWindow);
  if (result.canceled) {
    return {
      id: "export-project-profit-excel",
      summary: "Excel export cancelled."
    };
  }
  return {
    id: "export-project-profit-excel",
    summary: `Project profit Excel exported: ${result.filePath}`
  };
}

async function executeExportProjectProfitPdf(action, statements, runtime) {
  const result = await exportProjectProfitReportPdf(statements, runtime?.getMainWindow);
  if (result.canceled) {
    return {
      id: "export-project-profit-pdf",
      summary: "PDF export cancelled."
    };
  }
  return {
    id: "export-project-profit-pdf",
    summary: `Project profit PDF exported: ${result.filePath}`
  };
}

function sanitizeSqlStatement(sqlText) {
  let sql = normalizeDigits(sqlText)
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
  if (!sql) {
    throw new Error("SQL text is empty.");
  }

  sql = sql.replace(/;+\s*$/g, "").trim();
  if (!sql) {
    throw new Error("SQL text is empty.");
  }

  if (sql.includes(";")) {
    throw new Error("Only single SQL statement is allowed.");
  }

  if (/--|\/\*/.test(sql)) {
    throw new Error("SQL comments are not allowed.");
  }

  if (/\b(drop|alter|create|pragma|attach|detach|vacuum|reindex|analyze)\b/i.test(sql)) {
    throw new Error("This SQL keyword is not allowed for assistant execution.");
  }

  const firstWord = (sql.match(/^([a-zA-Z]+)/) || ["", ""])[1].toLowerCase();
  if (!["select", "insert", "update", "delete"].includes(firstWord)) {
    throw new Error("Only SELECT/INSERT/UPDATE/DELETE are allowed.");
  }

  return {
    sql,
    kind: firstWord
  };
}

function limitRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, MAX_SQL_ROWS);
}

function summarizeSqlRows(rows) {
  const previewRows = limitRows(rows).slice(0, MAX_SQL_PREVIEW_ROWS);
  return JSON.stringify(previewRows).slice(0, 1200);
}

function executeRunSql(action, statements) {
  const payload = normalizeSqlPayload(action.payload);
  const { sql, kind } = sanitizeSqlStatement(payload.sql);
  const stmt = statements.db.prepare(sql);

  if (kind === "select") {
    const rows = limitRows(stmt.all(payload.params));
    return {
      id: "sql-select",
      summary: `SQL SELECT returned ${rows.length} row(s). Preview: ${summarizeSqlRows(rows)}`
    };
  }

  const info = stmt.run(payload.params);
  return {
    id: `sql-${kind}`,
    summary: `SQL ${kind.toUpperCase()} done. Changes: ${Number(info.changes || 0)}`
  };
}

function normalizeMathExpression(expression) {
  const raw = normalizeDigits(expression)
    .replace(/,/g, "")
    .replace(/[×xX]/g, "*")
    .replace(/[÷]/g, "/")
    .replace(/[−–—]/g, "-")
    .replace(/\^/g, "**")
    .trim();

  if (!raw) {
    throw new Error("Expression is empty.");
  }

  const withPercent = raw.replace(/(\d+(?:\.\d+)?)\s*%/g, "($1/100)");
  if (/[^0-9+\-*/().\s*]/.test(withPercent)) {
    throw new Error("Expression has unsupported characters.");
  }

  return withPercent;
}

function evaluateMathExpression(expression) {
  const normalized = normalizeMathExpression(expression);
  let depth = 0;
  for (const ch of normalized) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (depth < 0) {
      throw new Error("Invalid parentheses in expression.");
    }
  }
  if (depth !== 0) {
    throw new Error("Invalid parentheses in expression.");
  }

  const result = Function(`"use strict"; return (${normalized});`)();
  if (!Number.isFinite(result)) {
    throw new Error("Expression result is not finite.");
  }

  return Number(result.toFixed(10));
}

function executeCalculateExpression(action) {
  const payload = normalizeCalculationPayload(action.payload);
  if (!payload.expression) {
    throw new Error("Expression is required.");
  }

  const result = evaluateMathExpression(payload.expression);
  return {
    id: "calc",
    summary: `Calculation result: ${result}`
  };
}

async function executeWriteAction(action, statements, runtime = {}) {
  if (action.type === "create_service") return executeCreateService(action, statements);
  if (action.type === "update_service") return executeUpdateService(action, statements);
  if (action.type === "delete_service") return executeDeleteService(action, statements);

  if (action.type === "create_project") return executeCreateProject(action, statements);
  if (action.type === "update_project") return executeUpdateProject(action, statements);
  if (action.type === "delete_project") return executeDeleteProject(action, statements);

  if (action.type === "create_partner") return executeCreatePartner(action, statements);
  if (action.type === "update_partner") return executeUpdatePartner(action, statements);
  if (action.type === "delete_partner") return executeDeletePartner(action, statements);

  if (action.type === "upsert_partner_term") return executeUpsertPartnerTerm(action, statements);
  if (action.type === "delete_partner_term") return executeDeletePartnerTerm(action, statements);

  if (action.type === "create_settlement") return executeCreateSettlement(action, statements);
  if (action.type === "update_settlement") return executeUpdateSettlement(action, statements);
  if (action.type === "delete_settlement") return executeDeleteSettlement(action, statements);

  if (action.type === "create_reminder") return executeCreateReminder(action, statements);
  if (action.type === "update_reminder") return executeUpdateReminder(action, statements);
  if (action.type === "toggle_reminder_done") return executeToggleReminderDone(action, statements);
  if (action.type === "snooze_reminder") return executeSnoozeReminder(action, statements);
  if (action.type === "clear_reminder_snooze") return executeClearReminderSnooze(action, statements);
  if (action.type === "delete_reminder") return executeDeleteReminder(action, statements);

  if (action.type === "create_expense") return executeCreateExpense(action, statements);
  if (action.type === "update_expense") return executeUpdateExpense(action, statements);
  if (action.type === "delete_expense") return executeDeleteExpense(action, statements);

  if (action.type === "create_cashbox") return executeCreateCashbox(action, statements);
  if (action.type === "update_cashbox") return executeUpdateCashbox(action, statements);
  if (action.type === "delete_cashbox") return executeDeleteCashbox(action, statements);

  if (action.type === "run_report_business") return executeRunBusinessReport(action, statements);
  if (action.type === "run_report_project_profit") return executeRunProjectProfitReport(action, statements);
  if (action.type === "export_business_excel") {
    return executeExportBusinessExcel(action, statements, runtime);
  }
  if (action.type === "export_business_pdf") {
    return executeExportBusinessPdf(action, statements, runtime);
  }
  if (action.type === "export_project_profit_excel") {
    return executeExportProjectProfitExcel(action, statements, runtime);
  }
  if (action.type === "export_project_profit_pdf") {
    return executeExportProjectProfitPdf(action, statements, runtime);
  }

  if (action.type === "run_sql") return executeRunSql(action, statements);
  if (action.type === "calculate_expression") return executeCalculateExpression(action, statements);

  throw new Error("Unsupported action type.");
}

function buildContextSnapshot(
  statements,
  userBehavior = null,
  userMemory = null,
  calendarInsight = null
) {
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
      openReminders: Number(totals?.openReminders || 0),
      totalServices: Number(totals?.totalServices || 0),
      totalPartners: Number(totals?.totalPartners || 0),
      totalSettlements: Number(totals?.totalSettlements || 0),
      totalCashboxEntries: Number(totals?.totalCashboxEntries || 0),
      totalExpenseEntries: Number(totals?.totalExpenseEntries || 0)
    },
    services: statements.serviceList.all().map((row) => ({
      id: Number(row.id),
      name: row.name,
      pricingModel: row.pricingModel,
      rate: Number(row.rate || 0),
      isActive: Number(row.isActive || 0)
    })),
    projects: statements.projectList.all().map((row) => ({
      id: Number(row.id),
      title: row.title,
      clientName: row.clientName,
      status: row.status,
      startDate: row.startDate
    })),
    partners: statements.partnerList.all().map((row) => ({
      id: Number(row.id),
      fullName: row.fullName,
      paymentModel: row.paymentModel,
      salaryPeriod: row.salaryPeriod
    })),
    partnerTerms: statements.termList.all().map((row) => ({
      id: Number(row.id),
      partnerId: Number(row.partnerId),
      partnerName: row.partnerName,
      projectId: Number(row.projectId),
      projectTitle: row.projectTitle,
      paymentModel: row.paymentModel,
      percentValue: Number(row.percentValue || 0),
      salaryAmount: Number(row.salaryAmount || 0)
    })),
    recentSettlements: statements.recentSettlements.all().map((row) => ({
      id: Number(row.id),
      settlementType: row.settlementType,
      amount: Number(row.amount || 0),
      settlementDate: row.settlementDate,
      counterpartyName: row.counterpartyName,
      partnerName: row.partnerName,
      projectTitle: row.projectTitle
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
      category: row.category,
      paidBy: row.paidBy
    })),
    recentReminders: statements.recentReminders.all().map((row) => ({
      id: Number(row.id),
      title: row.title,
      reminderDate: row.reminderDate,
      reminderTime: row.reminderTime,
      repeatType: row.repeatType,
      isDone: Number(row.isDone || 0),
      projectId: row.projectId ? Number(row.projectId) : null,
      partnerId: row.partnerId ? Number(row.partnerId) : null
    })),
    assistantCapabilities: {
      canAskClarifyingQuestions: true,
      actionTypes: Array.from(SUPPORTED_ACTION_TYPES)
    },
    userMemory:
      userMemory ||
      {
        profile: { displayName: "", preferences: {}, updatedAt: "" },
        dailyActivity: [],
        recentChats: []
      },
    calendarInsight:
      calendarInsight ||
      {
        source: "",
        generatedAt: "",
        range: {},
        today: { date: today, isHoliday: false, events: [] },
        yesterday: { date: "", isHoliday: false, events: [] },
        tomorrow: { date: "", isHoliday: false, events: [] }
      },
    userBehavior: userBehavior || {
      totalLoggedActions: 0,
      topActionTypes: [],
      preferredReminderTime: "",
      lastOperationAt: ""
    }
  };
}

function buildSystemInstruction(context) {
  return `
You are the accounting assistant for Bir Hesab desktop app.
You must return STRICT JSON only. No markdown, no extra text.

Response schema:
{
  "assistantReply": "string in Persian for user. Always clear and concise.",
  "pendingActions": [
    {
      "kind": "write|tool",
      "type": "one of supported action types",
      "summary": "short Persian summary",
      "payload": {}
    }
  ]
}

Rules:
- All database-changing actions MUST be placed in pendingActions for user confirmation.
- If user asks report/question only, answer directly in assistantReply and keep pendingActions empty.
- If any required field is missing, ask a clarifying question in assistantReply and keep pendingActions empty.
- Amount fields in payload must be pure numbers.
- Date format must be Jalali YYYY/MM/DD.
- Time format must be 24h HH:mm.
- Counterparty in settlement can be any person/entity (not only employer/partner).
- For reminders, prefer asking follow-up if date/time is missing.
- Use userBehavior hints from context to align with user's common workflows and preferred reminder time.
- Use userMemory.profile.displayName when available to personalize replies.
- If user asks about yesterday/previous days, rely on userMemory.dailyActivity and context data.
- If user asks about Jalali calendar events/holidays, use calendarInsight first.
- For calculations requiring high precision, use action type calculate_expression.
- For complex DB access, use run_sql action with a single safe SQL statement.
- For requests to export reports, create the corresponding export_* action in pendingActions.
- Never generate action types outside the supported list.

Supported action types:
create_service, update_service, delete_service
create_project, update_project, delete_project
create_partner, update_partner, delete_partner
upsert_partner_term, delete_partner_term
create_settlement, update_settlement, delete_settlement
create_reminder, update_reminder, toggle_reminder_done, snooze_reminder, clear_reminder_snooze, delete_reminder
create_expense, update_expense, delete_expense
create_cashbox, update_cashbox, delete_cashbox
run_report_business, run_report_project_profit
export_business_excel, export_business_pdf
export_project_profit_excel, export_project_profit_pdf
run_sql, calculate_expression

Live app context JSON:
${JSON.stringify(context)}
`.trim();
}

function normalizeModelId(value) {
  return safeString(value)
    .trim()
    .replace(/\s+/g, "")
    .replace(/^models\//i, "");
}

function buildGeminiRequestUrl(model, apiKey) {
  const modelId = normalizeModelId(model);
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    modelId
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

function buildGeminiApiError(statusCode, remoteMessage, fallbackMessage) {
  const messageText = safeString(remoteMessage).trim();
  const message = messageText
    ? `Gemini API error (${statusCode}): ${messageText}`
    : `Gemini API error (${statusCode})${fallbackMessage ? `: ${fallbackMessage}` : ""}`;
  const err = new Error(message);
  err.statusCode = Number(statusCode);
  err.remoteMessage = messageText;
  return err;
}

function isModelNotFoundError(error) {
  const status = Number(error?.statusCode || 0);
  if (status !== 404) return false;
  const raw = `${safeString(error?.remoteMessage)} ${safeString(error?.message)}`.toLowerCase();
  return (
    raw.includes("not found") ||
    raw.includes("not supported for generatecontent") ||
    raw.includes("no longer available")
  );
}

function modelSupportsGenerateContent(modelRow) {
  const methods = Array.isArray(modelRow?.supportedGenerationMethods)
    ? modelRow.supportedGenerationMethods
    : [];
  return methods.some((method) => safeString(method).toLowerCase() === "generatecontent");
}

function pickPreferredModel(modelIds, currentModel) {
  const unique = Array.from(
    new Set(
      (modelIds || [])
        .map((item) => normalizeModelId(item))
        .filter(Boolean)
    )
  );
  if (!unique.length) return "";

  const current = normalizeModelId(currentModel).toLowerCase();
  const exactCurrent = unique.find((id) => id.toLowerCase() === current);
  if (exactCurrent) return exactCurrent;

  for (const pref of MODEL_PREFERENCE_ORDER) {
    const prefLower = pref.toLowerCase();
    const exact = unique.find((id) => id.toLowerCase() === prefLower);
    if (exact) return exact;
    const withSuffix = unique.find((id) => id.toLowerCase().startsWith(`${prefLower}-`));
    if (withSuffix) return withSuffix;
  }

  return unique[0];
}

async function listGeminiModels(apiKey) {
  const all = [];
  let pageToken = "";

  for (let page = 0; page < MODEL_RESOLUTION_MAX_PAGES; page += 1) {
    const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("pageSize", "100");
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      const text = await response.text();
      let remoteMessage = "";
      try {
        const parsed = JSON.parse(text);
        remoteMessage = safeString(parsed?.error?.message).trim();
      } catch {
        remoteMessage = text.trim().slice(0, 300);
      }
      throw buildGeminiApiError(response.status, remoteMessage, "ListModels failed");
    }

    const json = await response.json();
    const rows = Array.isArray(json?.models) ? json.models : [];
    all.push(...rows);
    pageToken = safeString(json?.nextPageToken).trim();
    if (!pageToken) break;
  }

  return all;
}

async function resolveSupportedModel(apiKey, currentModel) {
  const rows = await listGeminiModels(apiKey);
  const supportedIds = rows
    .filter((row) => modelSupportsGenerateContent(row))
    .map((row) => row?.name);
  return pickPreferredModel(supportedIds, currentModel);
}

async function callGemini({ apiKey, model, messages, context }) {
  const url = buildGeminiRequestUrl(model, apiKey);

  const contents = toGeminiContents(messages);
  if (!contents.length) {
    contents.push({
      role: "user",
      parts: [{ text: "Ø³Ù„Ø§Ù…. ÛŒÚ© Ù¾Ø§Ø³Ø® Ø±Ø§Ù‡Ù†Ù…Ø§ Ø¨Ø¯Ù‡." }]
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
      let remoteMessage = "";
      try {
        const parsed = JSON.parse(errText);
        remoteMessage = safeString(parsed?.error?.message).trim();
      } catch {
        if (errText.trim()) {
          remoteMessage = errText.trim().slice(0, 400);
        }
      }
      throw buildGeminiApiError(response.status, remoteMessage, "");
    }

    const json = await response.json();
    const text = parseGeminiText(json);
    if (!text) {
      throw new Error("Ù¾Ø§Ø³Ø® Ù…ØªÙ†ÛŒ Ø§Ø² Gemini Ø¯Ø±ÛŒØ§ÙØª Ù†Ø´Ø¯.");
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function createDbStatements(db) {
  return {
    db,
    createService: db.prepare(
      `
        INSERT INTO services (name, pricing_model, rate, currency, description, is_active, created_at)
        VALUES (@name, @pricingModel, @rate, @currency, @description, @isActive, @createdAt)
      `
    ),
    updateService: db.prepare(
      `
        UPDATE services
        SET name = @name,
            pricing_model = @pricingModel,
            rate = @rate,
            currency = @currency,
            description = @description,
            is_active = @isActive
        WHERE id = @id
      `
    ),
    deleteService: db.prepare("DELETE FROM services WHERE id = ?"),

    createProject: db.prepare(
      `
        INSERT INTO projects (title, client_name, status, start_date, end_date, notes, created_at)
        VALUES (@title, @clientName, @status, @startDate, @endDate, @notes, @createdAt)
      `
    ),
    updateProject: db.prepare(
      `
        UPDATE projects
        SET title = @title,
            client_name = @clientName,
            status = @status,
            start_date = @startDate,
            end_date = @endDate,
            notes = @notes
        WHERE id = @id
      `
    ),
    deleteProject: db.prepare("DELETE FROM projects WHERE id = ?"),
    insertProjectService: db.prepare(
      "INSERT OR IGNORE INTO project_services (project_id, service_id, created_at) VALUES (?, ?, ?)"
    ),
    deleteProjectServices: db.prepare("DELETE FROM project_services WHERE project_id = ?"),

    createPartner: db.prepare(
      `
        INSERT INTO partners (
          full_name,
          role,
          phone,
          share_percent,
          payment_model,
          salary_period,
          salary_amount,
          is_active,
          created_at
        )
        VALUES (
          @fullName,
          @role,
          @phone,
          @sharePercent,
          @paymentModel,
          @salaryPeriod,
          @salaryAmount,
          @isActive,
          @createdAt
        )
      `
    ),
    updatePartner: db.prepare(
      `
        UPDATE partners
        SET full_name = @fullName,
            role = @role,
            phone = @phone,
            share_percent = @sharePercent,
            payment_model = @paymentModel,
            salary_period = @salaryPeriod,
            salary_amount = @salaryAmount,
            is_active = @isActive
        WHERE id = @id
      `
    ),
    deletePartner: db.prepare("DELETE FROM partners WHERE id = ?"),

    upsertPartnerTerm: db.prepare(
      `
        INSERT INTO partner_project_terms (
          partner_id,
          project_id,
          payment_model,
          percent_value,
          salary_amount,
          created_at,
          updated_at
        )
        VALUES (
          @partnerId,
          @projectId,
          @paymentModel,
          @percentValue,
          @salaryAmount,
          @createdAt,
          @updatedAt
        )
        ON CONFLICT(partner_id, project_id) DO UPDATE SET
          payment_model = excluded.payment_model,
          percent_value = excluded.percent_value,
          salary_amount = excluded.salary_amount,
          updated_at = excluded.updated_at
      `
    ),
    deletePartnerTerm: db.prepare("DELETE FROM partner_project_terms WHERE id = ?"),

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
    updateSettlement: db.prepare(
      `
        UPDATE settlements
        SET settlement_type = @settlementType,
            related_id = @relatedId,
            counterparty_name = @counterpartyName,
            project_id = @projectId,
            amount = @amount,
            payment_method = @paymentMethod,
            description = @description,
            settlement_date = @settlementDate
        WHERE id = @id
      `
    ),
    deleteSettlement: db.prepare("DELETE FROM settlements WHERE id = ?"),

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
    updateReminder: db.prepare(
      `
        UPDATE reminders
        SET title = @title,
            description = @description,
            reminder_date = @reminderDate,
            reminder_time = @reminderTime,
            is_done = @isDone,
            repeat_type = @repeatType,
            repeat_until = @repeatUntil,
            snooze_until = @snoozeUntil,
            project_id = @projectId,
            partner_id = @partnerId,
            updated_at = @updatedAt
        WHERE id = @id
      `
    ),
    toggleReminderDone: db.prepare(
      `
        UPDATE reminders
        SET is_done = @isDone,
            snooze_until = @snoozeUntil,
            updated_at = @updatedAt
        WHERE id = @id
      `
    ),
    snoozeReminder: db.prepare(
      `
        UPDATE reminders
        SET snooze_until = @snoozeUntil,
            updated_at = @updatedAt
        WHERE id = @id
      `
    ),
    clearReminderSnooze: db.prepare(
      `
        UPDATE reminders
        SET snooze_until = '',
            updated_at = @updatedAt
        WHERE id = @id
      `
    ),
    deleteReminder: db.prepare("DELETE FROM reminders WHERE id = ?"),

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
    updateExpense: db.prepare(
      `
        UPDATE expenses
        SET scope = @scope,
            paid_by = @paidBy,
            category = @category,
            amount = @amount,
            expense_date = @expenseDate,
            description = @description
        WHERE id = @id
      `
    ),
    deleteExpense: db.prepare("DELETE FROM expenses WHERE id = ?"),

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
    updateCashbox: db.prepare(
      `
        UPDATE cashbox
        SET entry_type = @entryType,
            amount = @amount,
            category = @category,
            reference_type = @referenceType,
            reference_id = @referenceId,
            entry_date = @entryDate,
            description = @description
        WHERE id = @id
      `
    ),
    deleteCashbox: db.prepare("DELETE FROM cashbox WHERE id = ?"),

    serviceById: db.prepare(
      `
        SELECT
          id,
          name,
          pricing_model AS pricingModel,
          rate,
          currency,
          description,
          is_active AS isActive,
          created_at AS createdAt
        FROM services
        WHERE id = ?
        LIMIT 1
      `
    ),
    serviceByNameExact: db.prepare("SELECT id, name FROM services WHERE name = ? LIMIT 1"),
    serviceByNameLike: db.prepare(
      "SELECT id, name FROM services WHERE name LIKE ? ESCAPE '\\' ORDER BY id DESC LIMIT 1"
    ),

    projectById: db.prepare("SELECT id, title FROM projects WHERE id = ? LIMIT 1"),
    projectByIdDetail: db.prepare(
      `
        SELECT
          id,
          title,
          client_name AS clientName,
          status,
          start_date AS startDate,
          end_date AS endDate,
          notes,
          created_at AS createdAt
        FROM projects
        WHERE id = ?
        LIMIT 1
      `
    ),
    projectByTitleExact: db.prepare("SELECT id, title FROM projects WHERE title = ? LIMIT 1"),
    projectByTitleLike: db.prepare(
      "SELECT id, title FROM projects WHERE title LIKE ? ESCAPE '\\' ORDER BY id DESC LIMIT 1"
    ),
    projectServiceIdsByProject: db.prepare(
      "SELECT service_id AS serviceId FROM project_services WHERE project_id = ? ORDER BY service_id ASC"
    ),

    partnerById: db.prepare(
      `
        SELECT
          id,
          full_name AS fullName,
          role,
          phone,
          share_percent AS sharePercent,
          payment_model AS paymentModel,
          salary_period AS salaryPeriod,
          salary_amount AS salaryAmount,
          is_active AS isActive,
          created_at AS createdAt
        FROM partners
        WHERE id = ?
        LIMIT 1
      `
    ),
    partnerByNameExact: db.prepare(
      "SELECT id, full_name AS fullName FROM partners WHERE full_name = ? LIMIT 1"
    ),
    partnerByNameLike: db.prepare(
      "SELECT id, full_name AS fullName FROM partners WHERE full_name LIKE ? ESCAPE '\\' ORDER BY id DESC LIMIT 1"
    ),

    partnerTermById: db.prepare(
      `
        SELECT
          id,
          partner_id AS partnerId,
          project_id AS projectId,
          payment_model AS paymentModel,
          percent_value AS percentValue,
          salary_amount AS salaryAmount,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM partner_project_terms
        WHERE id = ?
        LIMIT 1
      `
    ),
    partnerTermByPair: db.prepare(
      "SELECT id FROM partner_project_terms WHERE partner_id = ? AND project_id = ? LIMIT 1"
    ),
    partnerTermsByPartner: db.prepare(
      `
        SELECT
          id,
          partner_id AS partnerId,
          project_id AS projectId,
          payment_model AS paymentModel,
          percent_value AS percentValue,
          salary_amount AS salaryAmount,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM partner_project_terms
        WHERE partner_id = ?
        ORDER BY id ASC
      `
    ),

    settlementById: db.prepare(
      `
        SELECT
          id,
          settlement_type AS settlementType,
          related_id AS relatedId,
          counterparty_name AS counterpartyName,
          project_id AS projectId,
          amount,
          payment_method AS paymentMethod,
          description,
          settlement_date AS settlementDate,
          created_at AS createdAt
        FROM settlements
        WHERE id = ?
        LIMIT 1
      `
    ),

    reminderById: db.prepare(
      `
        SELECT
          id,
          title,
          description,
          reminder_date AS reminderDate,
          reminder_time AS reminderTime,
          is_done AS isDone,
          repeat_type AS repeatType,
          repeat_until AS repeatUntil,
          snooze_until AS snoozeUntil,
          project_id AS projectId,
          partner_id AS partnerId,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM reminders
        WHERE id = ?
        LIMIT 1
      `
    ),
    reminderByTitleDateLatest: db.prepare(
      `
        SELECT id
        FROM reminders
        WHERE title = ? AND reminder_date = ?
        ORDER BY id DESC
        LIMIT 1
      `
    ),

    expenseById: db.prepare(
      `
        SELECT
          id,
          scope,
          paid_by AS paidBy,
          category,
          amount,
          expense_date AS expenseDate,
          description,
          created_at AS createdAt
        FROM expenses
        WHERE id = ?
        LIMIT 1
      `
    ),
    cashboxById: db.prepare(
      `
        SELECT
          id,
          entry_type AS entryType,
          amount,
          category,
          reference_type AS referenceType,
          reference_id AS referenceId,
          entry_date AS entryDate,
          description,
          created_at AS createdAt
        FROM cashbox
        WHERE id = ?
        LIMIT 1
      `
    ),

    reportBusinessTotals: db.prepare(
      `
        SELECT
          (SELECT COALESCE(SUM(amount), 0) FROM cashbox WHERE entry_type = 'in') AS totalIncome,
          (SELECT COALESCE(SUM(amount), 0) FROM cashbox WHERE entry_type = 'out') AS totalOutcome,
          (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE scope IN ('business', 'shared')) AS totalExpenses,
          (SELECT COUNT(*) FROM projects) AS totalProjects
      `
    ),
    reportProjectProfitTotals: db.prepare(
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
          COALESCE(SUM(COALESCE(c.clientReceived, 0)), 0) AS totalClientReceived,
          COALESCE(SUM(COALESCE(d.partnerDue, 0)), 0) AS totalPartnerDue,
          COALESCE(SUM(COALESCE(pp.partnerPaid, 0)), 0) AS totalPartnerPaid,
          COALESCE(SUM(COALESCE(c.clientReceived, 0) - COALESCE(d.partnerDue, 0)), 0) AS totalExpectedNetProfit,
          COALESCE(SUM(COALESCE(c.clientReceived, 0) - COALESCE(pp.partnerPaid, 0)), 0) AS totalRealizedNetProfit
        FROM projects p
        LEFT JOIN client_by_project c ON c.project_id = p.id
        LEFT JOIN terms_due_by_project d ON d.projectId = p.id
        LEFT JOIN partner_paid_by_project pp ON pp.project_id = p.id
      `
    ),

    overviewTotals: db.prepare(
      `
        SELECT
          (SELECT COALESCE(SUM(amount), 0) FROM cashbox WHERE entry_type = 'in') AS cashboxIncome,
          (SELECT COALESCE(SUM(amount), 0) FROM cashbox WHERE entry_type = 'out') AS cashboxOutcome,
          (SELECT COALESCE(SUM(amount), 0) FROM expenses) AS totalExpenses,
          (SELECT COUNT(*) FROM reminders WHERE is_done = 0) AS openReminders,
          (SELECT COUNT(*) FROM services) AS totalServices,
          (SELECT COUNT(*) FROM partners) AS totalPartners,
          (SELECT COUNT(*) FROM settlements) AS totalSettlements,
          (SELECT COUNT(*) FROM cashbox) AS totalCashboxEntries,
          (SELECT COUNT(*) FROM expenses) AS totalExpenseEntries
      `
    ),
    serviceList: db.prepare(
      `
        SELECT id, name, pricing_model AS pricingModel, rate, is_active AS isActive
        FROM services
        ORDER BY id DESC
        LIMIT 80
      `
    ),
    projectList: db.prepare(
      `
        SELECT id, title, client_name AS clientName, status, start_date AS startDate
        FROM projects
        ORDER BY id DESC
        LIMIT 80
      `
    ),
    partnerList: db.prepare(
      `
        SELECT id, full_name AS fullName, payment_model AS paymentModel, salary_period AS salaryPeriod
        FROM partners
        ORDER BY id DESC
        LIMIT 80
      `
    ),
    termList: db.prepare(
      `
        SELECT
          t.id,
          t.partner_id AS partnerId,
          p.full_name AS partnerName,
          t.project_id AS projectId,
          pr.title AS projectTitle,
          t.payment_model AS paymentModel,
          t.percent_value AS percentValue,
          t.salary_amount AS salaryAmount
        FROM partner_project_terms t
        JOIN partners p ON p.id = t.partner_id
        JOIN projects pr ON pr.id = t.project_id
        ORDER BY t.id DESC
        LIMIT 120
      `
    ),
    recentCashbox: db.prepare(
      `
        SELECT id, entry_type AS entryType, amount, entry_date AS entryDate, description
        FROM cashbox
        ORDER BY id DESC
        LIMIT 25
      `
    ),
    recentExpenses: db.prepare(
      `
        SELECT id, scope, category, amount, expense_date AS expenseDate, paid_by AS paidBy
        FROM expenses
        ORDER BY id DESC
        LIMIT 25
      `
    ),
    recentSettlements: db.prepare(
      `
        SELECT
          st.id,
          st.settlement_type AS settlementType,
          st.amount,
          st.settlement_date AS settlementDate,
          st.description,
          st.counterparty_name AS counterpartyName,
          st.related_id AS relatedId,
          st.project_id AS projectId,
          p.title AS projectTitle,
          pa.full_name AS partnerName
        FROM settlements st
        LEFT JOIN projects p ON p.id = st.project_id
        LEFT JOIN partners pa ON pa.id = st.related_id
        ORDER BY st.id DESC
        LIMIT 25
      `
    ),
    recentReminders: db.prepare(
      `
        SELECT
          id,
          title,
          reminder_date AS reminderDate,
          reminder_time AS reminderTime,
          repeat_type AS repeatType,
          is_done AS isDone,
          project_id AS projectId,
          partner_id AS partnerId
        FROM reminders
        ORDER BY id DESC
        LIMIT 25
      `
    ),
    reminderStatsByDate: db.prepare(
      `
        SELECT
          COUNT(*) AS total,
          COALESCE(SUM(CASE WHEN is_done = 0 THEN 1 ELSE 0 END), 0) AS openCount
        FROM reminders
        WHERE reminder_date IN (?, ?)
      `
    ),
    settlementTotalsByDate: db.prepare(
      `
        SELECT
          COALESCE(SUM(CASE WHEN settlement_type = 'client' THEN amount ELSE 0 END), 0) AS clientReceived,
          COALESCE(SUM(CASE WHEN settlement_type = 'partner' THEN amount ELSE 0 END), 0) AS partnerPaid,
          COALESCE(SUM(CASE WHEN settlement_type = 'personal' THEN amount ELSE 0 END), 0) AS personalAmount
        FROM settlements
        WHERE settlement_date IN (?, ?)
      `
    ),
    cashboxTotalsByDate: db.prepare(
      `
        SELECT
          COALESCE(SUM(CASE WHEN entry_type = 'in' THEN amount ELSE 0 END), 0) AS cashIn,
          COALESCE(SUM(CASE WHEN entry_type = 'out' THEN amount ELSE 0 END), 0) AS cashOut
        FROM cashbox
        WHERE entry_date IN (?, ?)
      `
    ),
    expenseTotalByDate: db.prepare(
      `
        SELECT
          COALESCE(SUM(amount), 0) AS expenseTotal
        FROM expenses
        WHERE expense_date IN (?, ?)
      `
    )
  };
}

function jsonStringifySafe(value, fallback = "{}") {
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

function jsonParseSafe(value, fallback = null) {
  try {
    return JSON.parse(String(value || ""));
  } catch {
    return fallback;
  }
}

function ensureAssistantMemoryTables(db) {
  db.prepare(
    `
      CREATE TABLE IF NOT EXISTS assistant_user_profile (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        display_name TEXT NOT NULL DEFAULT '',
        preferences_json TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL DEFAULT ''
      )
    `
  ).run();

  db.prepare(
    `
      CREATE TABLE IF NOT EXISTS assistant_chat_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `
  ).run();

  db.prepare(
    `
      CREATE INDEX IF NOT EXISTS idx_assistant_chat_logs_created_at
      ON assistant_chat_logs(created_at DESC)
    `
  ).run();
}

function toProfileView(row) {
  const preferences = jsonParseSafe(row?.preferencesJson, {});
  return {
    displayName: normalizeProfileDisplayName(row?.displayName || ""),
    preferences: preferences && typeof preferences === "object" ? preferences : {},
    updatedAt: row?.updatedAt || ""
  };
}

function createAssistantMemoryStore(db) {
  ensureAssistantMemoryTables(db);

  const store = {
    getProfile: db.prepare(
      `
        SELECT
          display_name AS displayName,
          preferences_json AS preferencesJson,
          updated_at AS updatedAt
        FROM assistant_user_profile
        WHERE id = 1
        LIMIT 1
      `
    ),
    upsertProfile: db.prepare(
      `
        INSERT INTO assistant_user_profile (
          id,
          display_name,
          preferences_json,
          updated_at
        ) VALUES (
          1,
          @displayName,
          @preferencesJson,
          @updatedAt
        )
        ON CONFLICT(id) DO UPDATE SET
          display_name = excluded.display_name,
          preferences_json = excluded.preferences_json,
          updated_at = excluded.updated_at
      `
    ),
    appendChat: db.prepare(
      `
        INSERT INTO assistant_chat_logs (
          role,
          content,
          created_at
        ) VALUES (
          @role,
          @content,
          @createdAt
        )
      `
    ),
    listRecentChats: db.prepare(
      `
        SELECT
          id,
          role,
          content,
          created_at AS createdAt
        FROM assistant_chat_logs
        ORDER BY id DESC
        LIMIT ?
      `
    ),
    pruneChats: db.prepare(
      `
        DELETE FROM assistant_chat_logs
        WHERE id NOT IN (
          SELECT id
          FROM assistant_chat_logs
          ORDER BY id DESC
          LIMIT ?
        )
      `
    )
  };

  return {
    readProfile() {
      return toProfileView(store.getProfile.get());
    },
    updateProfile(nextProfile = {}) {
      const current = this.readProfile();
      const updated = {
        displayName:
          nextProfile.displayName !== undefined
            ? normalizeProfileDisplayName(nextProfile.displayName)
            : current.displayName,
        preferences:
          nextProfile.preferences && typeof nextProfile.preferences === "object"
            ? nextProfile.preferences
            : current.preferences,
        updatedAt: new Date().toISOString()
      };
      store.upsertProfile.run({
        displayName: updated.displayName,
        preferencesJson: jsonStringifySafe(updated.preferences, "{}"),
        updatedAt: updated.updatedAt
      });
      return this.readProfile();
    },
    appendChat(role, content, createdAt = new Date().toISOString()) {
      const safeRole = role === "assistant" ? "assistant" : "user";
      const safeContent = safeString(content).trim();
      if (!safeContent) return;
      store.appendChat.run({
        role: safeRole,
        content: safeContent.slice(0, 4000),
        createdAt: toIsoDateTime(createdAt) || new Date().toISOString()
      });
      store.pruneChats.run(MAX_ASSISTANT_CHAT_MEMORY_ROWS);
    },
    recentChats(limit = MAX_ASSISTANT_CHAT_CONTEXT) {
      const safeLimit = Math.max(1, Math.min(80, Number(limit || 0) || MAX_ASSISTANT_CHAT_CONTEXT));
      return store
        .listRecentChats.all(safeLimit)
        .map((row) => ({
          id: Number(row.id || 0),
          role: row.role === "assistant" ? "assistant" : "user",
          content: safeString(row.content || ""),
          createdAt: row.createdAt || ""
        }))
        .reverse();
    }
  };
}

function ensureAssistantOperationTable(db) {
  db.prepare(
    `
      CREATE TABLE IF NOT EXISTS assistant_operation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action_type TEXT NOT NULL,
        action_kind TEXT NOT NULL DEFAULT 'write',
        action_summary TEXT NOT NULL,
        action_json TEXT NOT NULL,
        undo_json TEXT NOT NULL DEFAULT '',
        undoable INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'done',
        executed_at TEXT NOT NULL,
        undone_at TEXT NOT NULL DEFAULT '',
        undo_error TEXT NOT NULL DEFAULT ''
      )
    `
  ).run();

  db.prepare(
    `
      CREATE INDEX IF NOT EXISTS idx_assistant_operation_logs_executed_at
      ON assistant_operation_logs(executed_at DESC)
    `
  ).run();

  db.prepare(
    `
      CREATE INDEX IF NOT EXISTS idx_assistant_operation_logs_status
      ON assistant_operation_logs(status)
    `
  ).run();
}

function createAssistantOperationStore(db) {
  ensureAssistantOperationTable(db);

  return {
    insert: db.prepare(
      `
        INSERT INTO assistant_operation_logs (
          action_type,
          action_kind,
          action_summary,
          action_json,
          undo_json,
          undoable,
          status,
          executed_at,
          undone_at,
          undo_error
        )
        VALUES (
          @actionType,
          @actionKind,
          @actionSummary,
          @actionJson,
          @undoJson,
          @undoable,
          @status,
          @executedAt,
          @undoneAt,
          @undoError
        )
      `
    ),
    getById: db.prepare(
      `
        SELECT
          id,
          action_type AS actionType,
          action_kind AS actionKind,
          action_summary AS actionSummary,
          action_json AS actionJson,
          undo_json AS undoJson,
          undoable,
          status,
          executed_at AS executedAt,
          undone_at AS undoneAt,
          undo_error AS undoError
        FROM assistant_operation_logs
        WHERE id = ?
        LIMIT 1
      `
    ),
    listRecent: db.prepare(
      `
        SELECT
          id,
          action_type AS actionType,
          action_kind AS actionKind,
          action_summary AS actionSummary,
          action_json AS actionJson,
          undo_json AS undoJson,
          undoable,
          status,
          executed_at AS executedAt,
          undone_at AS undoneAt,
          undo_error AS undoError
        FROM assistant_operation_logs
        ORDER BY id DESC
        LIMIT ?
      `
    ),
    markUndone: db.prepare(
      `
        UPDATE assistant_operation_logs
        SET status = 'undone',
            undone_at = @undoneAt,
            undo_error = ''
        WHERE id = @id
      `
    ),
    markUndoFailed: db.prepare(
      `
        UPDATE assistant_operation_logs
        SET status = 'undo_failed',
            undo_error = @undoError
        WHERE id = @id
      `
    )
  };
}

function toOperationView(row) {
  const action = jsonParseSafe(row?.actionJson, {});
  const undo = jsonParseSafe(row?.undoJson, null);
  return {
    id: Number(row?.id || 0),
    actionType: row?.actionType || "",
    actionKind: row?.actionKind || "",
    actionSummary: row?.actionSummary || "",
    action,
    undoable: Boolean(Number(row?.undoable || 0)) && Boolean(undo),
    status: row?.status || "done",
    executedAt: row?.executedAt || "",
    undoneAt: row?.undoneAt || "",
    undoError: row?.undoError || ""
  };
}

function normalizeOpsLimit(rawLimit) {
  const limit = Number(rawLimit || 0);
  if (!Number.isFinite(limit) || limit <= 0) return 50;
  return Math.min(MAX_ASSISTANT_OPS_LIST, Math.max(1, Math.trunc(limit)));
}

function createAssistantCalendarStore(electronApp) {
  let datasetCache = null;

  const loadDataset = () => {
    if (datasetCache) return datasetCache;

    const appPath =
      electronApp && typeof electronApp.getAppPath === "function"
        ? electronApp.getAppPath()
        : process.cwd();
    const candidatePaths = [
      path.join(appPath, "src", "data", "calendar-events-1404-1405.json"),
      path.join(__dirname, "..", "data", "calendar-events-1404-1405.json"),
      path.join(process.cwd(), "src", "data", "calendar-events-1404-1405.json")
    ];

    for (const filePath of candidatePaths) {
      try {
        if (!fs.existsSync(filePath)) continue;
        const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
        if (!parsed || typeof parsed !== "object") continue;
        const days = parsed.days && typeof parsed.days === "object" ? parsed.days : {};
        datasetCache = {
          source: safeString(parsed.source).trim(),
          generatedAt: safeString(parsed.generatedAt).trim(),
          range: parsed.range && typeof parsed.range === "object" ? parsed.range : {},
          days
        };
        return datasetCache;
      } catch {
        // Continue to next candidate path.
      }
    }

    datasetCache = {
      source: "",
      generatedAt: "",
      range: {},
      days: {}
    };
    return datasetCache;
  };

  const getDay = (dateValue) => {
    const canonical = toCanonicalJalaliDate(dateValue, "");
    if (!canonical) {
      return {
        date: "",
        isHoliday: false,
        events: []
      };
    }
    const dataset = loadDataset();
    const fallbackKey = toPersianDigits(canonical);
    const rawDay = dataset.days[canonical] || dataset.days[fallbackKey] || {};
    const events = Array.isArray(rawDay.events)
      ? rawDay.events
          .map((event) => ({
            description: safeString(event?.description).trim(),
            additionalDescription: safeString(event?.additionalDescription).trim(),
            isHoliday: Boolean(event?.isHoliday),
            isReligious: Boolean(event?.isReligious)
          }))
          .filter((event) => event.description)
      : [];
    return {
      date: canonical,
      isHoliday: Boolean(rawDay?.isHoliday),
      events
    };
  };

  const buildContextInsight = () => {
    const dataset = loadDataset();
    const today = getRelativeJalaliDate(0);
    const yesterday = getRelativeJalaliDate(-1);
    const tomorrow = getRelativeJalaliDate(1);
    const toPreview = (date) => {
      const day = getDay(date);
      return {
        date: day.date,
        isHoliday: day.isHoliday,
        events: day.events.slice(0, 8)
      };
    };

    return {
      source: dataset.source,
      generatedAt: dataset.generatedAt,
      range: dataset.range,
      today: toPreview(today),
      yesterday: toPreview(yesterday),
      tomorrow: toPreview(tomorrow)
    };
  };

  return {
    getDataset: loadDataset,
    getDay,
    buildContextInsight
  };
}

function getDateVariantsForQuery(dateValue) {
  const canonical = normalizeDigits(toCanonicalJalaliDate(dateValue, ""));
  if (!canonical) return ["", ""];
  return [canonical, toPersianDigits(canonical)];
}

function normalizeOperationRows(operationStore, limit = MAX_ASSISTANT_HISTORY_LOOKBACK) {
  if (!operationStore) return [];
  const safeLimit = Math.max(10, Math.min(1200, Number(limit || 0) || MAX_ASSISTANT_HISTORY_LOOKBACK));
  return operationStore
    .listRecent.all(safeLimit)
    .map((row) => toOperationView(row))
    .filter((row) => row?.id);
}

function operationDateToJalali(executedAt) {
  const jalali = formatToJalaliDate(executedAt);
  return toCanonicalJalaliDate(jalali, "");
}

function buildDailyActivitySummary(operationRows, maxDays = MAX_ASSISTANT_DAILY_MEMORY_DAYS) {
  const map = new Map();

  operationRows.forEach((row) => {
    const day = operationDateToJalali(row.executedAt);
    if (!day) return;
    const current = map.get(day) || {
      date: day,
      totalActions: 0,
      failedActions: 0,
      undoneActions: 0,
      topTypes: {},
      samples: []
    };
    current.totalActions += 1;
    if (row.status === "failed") {
      current.failedActions += 1;
    }
    if (row.status === "undone") {
      current.undoneActions += 1;
    }
    const actionType = safeString(row.actionType).trim() || "unknown";
    current.topTypes[actionType] = Number(current.topTypes[actionType] || 0) + 1;
    if (current.samples.length < 6) {
      current.samples.push(safeString(row.actionSummary).trim() || actionType);
    }
    map.set(day, current);
  });

  return Array.from(map.values())
    .sort((a, b) => safeString(b.date).localeCompare(safeString(a.date)))
    .slice(0, Math.max(1, Math.min(90, Number(maxDays || 0) || MAX_ASSISTANT_DAILY_MEMORY_DAYS)))
    .map((item) => ({
      date: item.date,
      totalActions: item.totalActions,
      failedActions: item.failedActions,
      undoneActions: item.undoneActions,
      topActionTypes: Object.entries(item.topTypes)
        .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
        .slice(0, 4)
        .map(([type, count]) => ({ type, count: Number(count || 0) })),
      sampleSummaries: item.samples
    }));
}

function buildUserMemorySnapshot(memoryStore, operationStore) {
  const profile = memoryStore ? memoryStore.readProfile() : { displayName: "", preferences: {} };
  const recentChats = memoryStore ? memoryStore.recentChats(MAX_ASSISTANT_CHAT_CONTEXT) : [];
  const operationRows = normalizeOperationRows(operationStore);
  const dailyActivity = buildDailyActivitySummary(operationRows);

  return {
    profile: {
      displayName: profile.displayName || "",
      preferences: profile.preferences || {},
      updatedAt: profile.updatedAt || ""
    },
    dailyActivity,
    recentChats: recentChats.map((item) => ({
      role: item.role,
      content: item.content,
      createdAt: item.createdAt
    }))
  };
}

function buildOperationDaySnapshot(operationStore, targetDate) {
  const canonical = normalizeDigits(toCanonicalJalaliDate(targetDate, ""));
  if (!canonical) {
    return {
      date: "",
      total: 0,
      failed: 0,
      undone: 0,
      items: []
    };
  }

  const rows = normalizeOperationRows(operationStore, MAX_ASSISTANT_HISTORY_LOOKBACK);
  const matched = rows.filter((row) => operationDateToJalali(row.executedAt) === canonical);

  return {
    date: canonical,
    total: matched.length,
    failed: matched.filter((row) => row.status === "failed").length,
    undone: matched.filter((row) => row.status === "undone").length,
    items: matched.slice(0, 12).map((row) => ({
      actionType: row.actionType,
      summary: row.actionSummary,
      status: row.status
    }))
  };
}

function buildCalendarDaySnapshot(targetDate, statements, operationStore, calendarStore) {
  const [dateEn, dateFa] = getDateVariantsForQuery(targetDate);
  const day = calendarStore.getDay(dateEn || targetDate);

  const reminderStats = dateEn ? statements.reminderStatsByDate.get(dateEn, dateFa) : {};
  const settlementTotals = dateEn ? statements.settlementTotalsByDate.get(dateEn, dateFa) : {};
  const cashboxTotals = dateEn ? statements.cashboxTotalsByDate.get(dateEn, dateFa) : {};
  const expenseTotals = dateEn ? statements.expenseTotalByDate.get(dateEn, dateFa) : {};
  const ops = buildOperationDaySnapshot(operationStore, dateEn || targetDate);

  return {
    date: day.date || dateEn || "",
    isHoliday: day.isHoliday,
    events: day.events,
    reminders: {
      total: Number(reminderStats?.total || 0),
      open: Number(reminderStats?.openCount || 0)
    },
    settlements: {
      clientReceived: Number(settlementTotals?.clientReceived || 0),
      partnerPaid: Number(settlementTotals?.partnerPaid || 0),
      personalAmount: Number(settlementTotals?.personalAmount || 0)
    },
    cashbox: {
      income: Number(cashboxTotals?.cashIn || 0),
      outcome: Number(cashboxTotals?.cashOut || 0)
    },
    expenses: {
      total: Number(expenseTotals?.expenseTotal || 0)
    },
    operations: ops
  };
}

function formatCalendarDayReply(snapshot, profileName = "") {
  const namePrefix = profileName ? `${profileName}، ` : "";
  const eventLines = snapshot.events.length
    ? snapshot.events
        .slice(0, 6)
        .map((event, index) => {
          const tags = [];
          if (event.isHoliday) tags.push("تعطیل");
          if (event.isReligious) tags.push("مذهبی");
          const tagText = tags.length ? ` (${tags.join(" - ")})` : "";
          const extra = event.additionalDescription ? ` - ${event.additionalDescription}` : "";
          return `${index + 1}) ${event.description}${tagText}${extra}`;
        })
        .join("\n")
    : "رویداد ثبت‌شده‌ای برای این روز پیدا نشد.";

  return [
    `${namePrefix}خلاصه روز ${toPersianDigits(snapshot.date || "-")}:`,
    snapshot.isHoliday ? "وضعیت: تعطیل رسمی" : "وضعیت: روز کاری",
    `یادآورها: ${toPersianDigits(snapshot.reminders.total)} (باز: ${toPersianDigits(snapshot.reminders.open)})`,
    `دریافتی کارفرما: ${toPersianDigits(Number(snapshot.settlements.clientReceived || 0).toLocaleString("fa-IR"))}`,
    `پرداختی همکار: ${toPersianDigits(Number(snapshot.settlements.partnerPaid || 0).toLocaleString("fa-IR"))}`,
    `صندوق (دخل/خرج): ${toPersianDigits(Number(snapshot.cashbox.income || 0).toLocaleString("fa-IR"))} / ${toPersianDigits(Number(snapshot.cashbox.outcome || 0).toLocaleString("fa-IR"))}`,
    `هزینه‌ها: ${toPersianDigits(Number(snapshot.expenses.total || 0).toLocaleString("fa-IR"))}`,
    `عملیات ثبت‌شده توسط دستیار: ${toPersianDigits(snapshot.operations.total)}`,
    "رویدادها:",
    eventLines
  ].join("\n");
}

function formatHistoryDayReply(daySnapshot, profileName = "") {
  const namePrefix = profileName ? `${profileName}، ` : "";
  if (!daySnapshot.total) {
    return `${namePrefix}برای ${toPersianDigits(daySnapshot.date || "-")} عملیاتی در لاگ دستیار پیدا نکردم.`;
  }
  const lines = daySnapshot.items
    .slice(0, 8)
    .map((item, index) => {
      const status =
        item.status === "undone"
          ? "Undo"
          : item.status === "failed"
            ? "ناموفق"
            : item.status === "undo_failed"
              ? "Undo ناموفق"
              : "انجام";
      return `${index + 1}) [${status}] ${item.summary || item.actionType || "-"}`;
    })
    .join("\n");

  return [
    `${namePrefix}گزارش کارهای ${toPersianDigits(daySnapshot.date)}:`,
    `تعداد کل: ${toPersianDigits(daySnapshot.total)} | ناموفق: ${toPersianDigits(daySnapshot.failed)} | Undo شده: ${toPersianDigits(daySnapshot.undone)}`,
    lines
  ].join("\n");
}

function tryHandleLocalAssistantMemoryQuery({
  latestUserMessage,
  memoryStore,
  operationStore,
  statements,
  calendarStore
}) {
  const text = safeString(latestUserMessage).trim();
  if (!text) return null;

  const profile = memoryStore ? memoryStore.readProfile() : { displayName: "" };
  const profileName = profile.displayName || "";

  if (detectNameRecallIntent(text)) {
    const reply = profileName
      ? `${profileName}، بله یادم هست. نامی که برایت ذخیره کردم: ${profileName}`
      : "هنوز نامت را ذخیره نکرده‌ام. اگر دوست داری بگو: «اسم من ... است» تا یادت نگه دارم.";
    return {
      assistantReply: reply,
      pendingActions: []
    };
  }

  const requestedDate = extractDateMention(text, getTodayJalaliDate());

  if (detectHistoryIntent(text) && requestedDate) {
    const snapshot = buildOperationDaySnapshot(operationStore, requestedDate);
    if (!snapshot.date) snapshot.date = requestedDate;
    return {
      assistantReply: formatHistoryDayReply(snapshot, profileName),
      pendingActions: []
    };
  }

  if (detectCalendarIntent(text) && requestedDate) {
    const snapshot = buildCalendarDaySnapshot(
      requestedDate,
      statements,
      operationStore,
      calendarStore
    );
    return {
      assistantReply: formatCalendarDayReply(snapshot, profileName),
      pendingActions: []
    };
  }

  return null;
}

function buildAssistantBehaviorHints(operationStore, statements, memoryStore = null) {
  if (!operationStore) {
    return {
      totalLoggedActions: 0,
      topActionTypes: [],
      preferredReminderTime: "",
      lastOperationAt: "",
      userDisplayName: memoryStore ? memoryStore.readProfile().displayName : ""
    };
  }

  const rows = operationStore.listRecent.all(MAX_ASSISTANT_OPS_LIST);
  const typeCounts = {};
  let lastOperationAt = "";

  rows.forEach((row) => {
    const actionType = safeString(row?.actionType).trim();
    if (actionType) {
      typeCounts[actionType] = Number(typeCounts[actionType] || 0) + 1;
    }
    if (!lastOperationAt && row?.executedAt) {
      lastOperationAt = safeString(row.executedAt);
    }
  });

  const topActionTypes = Object.entries(typeCounts)
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
    .slice(0, 8)
    .map(([type, count]) => ({ type, count: Number(count || 0) }));

  const reminderTimeCounts = {};
  statements.recentReminders.all().forEach((row) => {
    const time = safeString(row?.reminderTime).trim();
    if (!time) return;
    reminderTimeCounts[time] = Number(reminderTimeCounts[time] || 0) + 1;
  });

  const preferredReminderTime = Object.entries(reminderTimeCounts)
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
    .map(([time]) => time)[0] || "";

  const profile = memoryStore ? memoryStore.readProfile() : { displayName: "" };

  return {
    totalLoggedActions: rows.length,
    topActionTypes,
    preferredReminderTime,
    lastOperationAt,
    userDisplayName: profile.displayName || "",
    dailyActivityPreview: buildDailyActivitySummary(
      normalizeOperationRows(operationStore, 180),
      7
    )
  };
}

function captureBeforeStateForUndo(action, statements) {
  const type = action.type;

  if (type === "update_service" || type === "delete_service") {
    const id = resolveServiceId(action.payload, statements);
    return id ? { service: statements.serviceById.get(id) } : null;
  }

  if (type === "update_project" || type === "delete_project") {
    const id = resolveProjectId(action.payload, statements);
    if (!id) return null;
    return {
      project: statements.projectByIdDetail.get(id),
      serviceIds: statements.projectServiceIdsByProject
        .all(id)
        .map((row) => Number(row.serviceId || 0))
        .filter((item) => Number.isFinite(item) && item > 0)
    };
  }

  if (type === "update_partner" || type === "delete_partner") {
    const partner = resolvePartner(action.payload, statements);
    if (!partner?.id) return null;
    return {
      partner: statements.partnerById.get(partner.id),
      terms: statements.partnerTermsByPartner.all(partner.id)
    };
  }

  if (type === "upsert_partner_term") {
    const payload = normalizePartnerTermPayload(action.payload);
    const partner = resolvePartner(payload, statements);
    const projectId = resolveProjectId(payload, statements);
    if (!partner?.id || !projectId) return null;
    const existing = statements.partnerTermByPair.get(partner.id, projectId);
    return {
      partnerId: partner.id,
      projectId,
      term: existing ? statements.partnerTermById.get(existing.id) : null
    };
  }

  if (type === "delete_partner_term") {
    const termId = resolvePartnerTermId(action.payload, statements);
    return termId ? { term: statements.partnerTermById.get(termId) } : null;
  }

  if (type === "update_settlement" || type === "delete_settlement") {
    const id = resolveSettlementId(action.payload, statements);
    return id ? { settlement: statements.settlementById.get(id) } : null;
  }

  if (
    type === "update_reminder" ||
    type === "toggle_reminder_done" ||
    type === "snooze_reminder" ||
    type === "clear_reminder_snooze" ||
    type === "delete_reminder"
  ) {
    const id =
      type === "snooze_reminder"
        ? toId(action.payload?.id ?? action.payload?.reminderId)
        : resolveReminderId(action.payload, statements);
    return id ? { reminder: statements.reminderById.get(id) } : null;
  }

  if (type === "update_expense" || type === "delete_expense") {
    const id = resolveExpenseId(action.payload, statements);
    return id ? { expense: statements.expenseById.get(id) } : null;
  }

  if (type === "update_cashbox" || type === "delete_cashbox") {
    const id = resolveCashboxId(action.payload, statements);
    return id ? { cashbox: statements.cashboxById.get(id) } : null;
  }

  return null;
}

function buildUndoInstruction(action, beforeState, result) {
  const type = action.type;

  if (type === "create_service") {
    return { type: "delete_by_id", entity: "services", id: Number(result.id || 0) };
  }
  if (type === "update_service" || type === "delete_service") {
    return beforeState?.service ? { type: "restore_service", row: beforeState.service } : null;
  }

  if (type === "create_project") {
    return { type: "delete_by_id", entity: "projects", id: Number(result.id || 0) };
  }
  if (type === "update_project" || type === "delete_project") {
    return beforeState?.project
      ? {
          type: "restore_project",
          row: beforeState.project,
          serviceIds: Array.isArray(beforeState.serviceIds) ? beforeState.serviceIds : []
        }
      : null;
  }

  if (type === "create_partner") {
    return { type: "delete_by_id", entity: "partners", id: Number(result.id || 0) };
  }
  if (type === "update_partner" || type === "delete_partner") {
    return beforeState?.partner
      ? {
          type: "restore_partner",
          row: beforeState.partner,
          terms: Array.isArray(beforeState.terms) ? beforeState.terms : []
        }
      : null;
  }

  if (type === "upsert_partner_term") {
    if (beforeState?.term) {
      return { type: "restore_partner_term", row: beforeState.term };
    }
    return beforeState?.partnerId && beforeState?.projectId
      ? {
          type: "delete_partner_term_by_pair",
          partnerId: beforeState.partnerId,
          projectId: beforeState.projectId
        }
      : null;
  }
  if (type === "delete_partner_term") {
    return beforeState?.term ? { type: "restore_partner_term", row: beforeState.term } : null;
  }

  if (type === "create_settlement") {
    return { type: "delete_by_id", entity: "settlements", id: Number(result.id || 0) };
  }
  if (type === "update_settlement" || type === "delete_settlement") {
    return beforeState?.settlement
      ? { type: "restore_settlement", row: beforeState.settlement }
      : null;
  }

  if (type === "create_reminder") {
    return { type: "delete_by_id", entity: "reminders", id: Number(result.id || 0) };
  }
  if (
    type === "update_reminder" ||
    type === "toggle_reminder_done" ||
    type === "snooze_reminder" ||
    type === "clear_reminder_snooze" ||
    type === "delete_reminder"
  ) {
    return beforeState?.reminder ? { type: "restore_reminder", row: beforeState.reminder } : null;
  }

  if (type === "create_expense") {
    return { type: "delete_by_id", entity: "expenses", id: Number(result.id || 0) };
  }
  if (type === "update_expense" || type === "delete_expense") {
    return beforeState?.expense ? { type: "restore_expense", row: beforeState.expense } : null;
  }

  if (type === "create_cashbox") {
    return { type: "delete_by_id", entity: "cashbox", id: Number(result.id || 0) };
  }
  if (type === "update_cashbox" || type === "delete_cashbox") {
    return beforeState?.cashbox ? { type: "restore_cashbox", row: beforeState.cashbox } : null;
  }

  return null;
}

function applyUndoInstruction(undo, statements) {
  if (!undo || typeof undo !== "object") {
    throw new Error("Undo data is missing.");
  }

  const allowedDeleteTables = new Set([
    "services",
    "projects",
    "partners",
    "settlements",
    "reminders",
    "expenses",
    "cashbox"
  ]);

  const runDeleteById = (tableName, idValue) => {
    const table = safeString(tableName).trim().toLowerCase();
    if (!allowedDeleteTables.has(table)) {
      throw new Error("Undo delete target is not allowed.");
    }
    const id = Number(idValue || 0);
    if (!id) return;
    statements.db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  };

  if (undo.type === "delete_by_id") {
    const table = String(undo.entity || "").trim();
    if (!table) {
      throw new Error("Undo delete target is invalid.");
    }
    runDeleteById(table, undo.id);
    return;
  }

  if (undo.type === "restore_service") {
    const row = undo.row || {};
    statements.db.prepare(
      `
        INSERT OR REPLACE INTO services (
          id, name, pricing_model, rate, currency, description, is_active, created_at
        ) VALUES (
          @id, @name, @pricingModel, @rate, @currency, @description, @isActive, @createdAt
        )
      `
    ).run({
      id: Number(row.id || 0),
      name: row.name || "",
      pricingModel: row.pricingModel || "project",
      rate: Number(row.rate || 0),
      currency: row.currency || "TOMAN",
      description: row.description || "",
      isActive: Number(row.isActive || 0),
      createdAt: row.createdAt || new Date().toISOString()
    });
    return;
  }

  if (undo.type === "restore_project") {
    const row = undo.row || {};
    const serviceIds = Array.isArray(undo.serviceIds) ? undo.serviceIds : [];
    const tx = statements.db.transaction(() => {
      statements.db.prepare(
        `
          INSERT OR REPLACE INTO projects (
            id, title, client_name, status, start_date, end_date, notes, created_at
          ) VALUES (
            @id, @title, @clientName, @status, @startDate, @endDate, @notes, @createdAt
          )
        `
      ).run({
        id: Number(row.id || 0),
        title: row.title || "",
        clientName: row.clientName || "",
        status: row.status || "open",
        startDate: row.startDate || getTodayJalaliDate(),
        endDate: row.endDate || "",
        notes: row.notes || "",
        createdAt: row.createdAt || new Date().toISOString()
      });

      statements.db.prepare("DELETE FROM project_services WHERE project_id = ?").run(Number(row.id || 0));
      const now = new Date().toISOString();
      serviceIds.forEach((serviceId) => {
        const sid = Number(serviceId || 0);
        if (!sid) return;
        statements.db
          .prepare(
            "INSERT OR IGNORE INTO project_services (project_id, service_id, created_at) VALUES (?, ?, ?)"
          )
          .run(Number(row.id || 0), sid, now);
      });
    });
    tx();
    return;
  }

  if (undo.type === "restore_partner") {
    const row = undo.row || {};
    const terms = Array.isArray(undo.terms) ? undo.terms : [];
    const tx = statements.db.transaction(() => {
      statements.db.prepare(
        `
          INSERT OR REPLACE INTO partners (
            id,
            full_name,
            role,
            phone,
            share_percent,
            payment_model,
            salary_period,
            salary_amount,
            is_active,
            created_at
          ) VALUES (
            @id,
            @fullName,
            @role,
            @phone,
            @sharePercent,
            @paymentModel,
            @salaryPeriod,
            @salaryAmount,
            @isActive,
            @createdAt
          )
        `
      ).run({
        id: Number(row.id || 0),
        fullName: row.fullName || "",
        role: row.role || "",
        phone: row.phone || "",
        sharePercent: Number(row.sharePercent || 0),
        paymentModel: row.paymentModel || "percent",
        salaryPeriod: row.salaryPeriod || "monthly",
        salaryAmount: Number(row.salaryAmount || 0),
        isActive: Number(row.isActive || 0),
        createdAt: row.createdAt || new Date().toISOString()
      });

      terms.forEach((term) => {
        statements.db.prepare(
          `
            INSERT OR REPLACE INTO partner_project_terms (
              id,
              partner_id,
              project_id,
              payment_model,
              percent_value,
              salary_amount,
              created_at,
              updated_at
            ) VALUES (
              @id,
              @partnerId,
              @projectId,
              @paymentModel,
              @percentValue,
              @salaryAmount,
              @createdAt,
              @updatedAt
            )
          `
        ).run({
          id: Number(term.id || 0),
          partnerId: Number(term.partnerId || 0),
          projectId: Number(term.projectId || 0),
          paymentModel: term.paymentModel || "percent",
          percentValue: Number(term.percentValue || 0),
          salaryAmount: Number(term.salaryAmount || 0),
          createdAt: term.createdAt || new Date().toISOString(),
          updatedAt: term.updatedAt || new Date().toISOString()
        });
      });
    });

    tx();
    return;
  }

  if (undo.type === "restore_partner_term") {
    const row = undo.row || {};
    statements.db.prepare(
      `
        INSERT OR REPLACE INTO partner_project_terms (
          id,
          partner_id,
          project_id,
          payment_model,
          percent_value,
          salary_amount,
          created_at,
          updated_at
        ) VALUES (
          @id,
          @partnerId,
          @projectId,
          @paymentModel,
          @percentValue,
          @salaryAmount,
          @createdAt,
          @updatedAt
        )
      `
    ).run({
      id: Number(row.id || 0),
      partnerId: Number(row.partnerId || 0),
      projectId: Number(row.projectId || 0),
      paymentModel: row.paymentModel || "percent",
      percentValue: Number(row.percentValue || 0),
      salaryAmount: Number(row.salaryAmount || 0),
      createdAt: row.createdAt || new Date().toISOString(),
      updatedAt: row.updatedAt || new Date().toISOString()
    });
    return;
  }

  if (undo.type === "delete_partner_term_by_pair") {
    const pair = statements.partnerTermByPair.get(
      Number(undo.partnerId || 0),
      Number(undo.projectId || 0)
    );
    if (pair?.id) {
      statements.deletePartnerTerm.run(Number(pair.id));
    }
    return;
  }

  if (undo.type === "restore_settlement") {
    const row = undo.row || {};
    statements.db.prepare(
      `
        INSERT OR REPLACE INTO settlements (
          id,
          settlement_type,
          related_id,
          counterparty_name,
          project_id,
          amount,
          payment_method,
          description,
          settlement_date,
          created_at
        ) VALUES (
          @id,
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
    ).run({
      id: Number(row.id || 0),
      settlementType: row.settlementType || "personal",
      relatedId: row.relatedId ? Number(row.relatedId) : null,
      counterpartyName: row.counterpartyName || "",
      projectId: row.projectId ? Number(row.projectId) : null,
      amount: Number(row.amount || 0),
      paymentMethod: row.paymentMethod || "cash",
      description: row.description || "",
      settlementDate: row.settlementDate || getTodayJalaliDate(),
      createdAt: row.createdAt || new Date().toISOString()
    });
    return;
  }

  if (undo.type === "restore_reminder") {
    const row = undo.row || {};
    statements.db.prepare(
      `
        INSERT OR REPLACE INTO reminders (
          id,
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
        ) VALUES (
          @id,
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
    ).run({
      id: Number(row.id || 0),
      title: row.title || "",
      description: row.description || "",
      reminderDate: row.reminderDate || getTodayJalaliDate(),
      reminderTime: row.reminderTime || "09:00",
      isDone: Number(row.isDone || 0),
      repeatType: row.repeatType || "none",
      repeatUntil: row.repeatUntil || "",
      snoozeUntil: row.snoozeUntil || "",
      projectId: row.projectId ? Number(row.projectId) : null,
      partnerId: row.partnerId ? Number(row.partnerId) : null,
      createdAt: row.createdAt || new Date().toISOString(),
      updatedAt: row.updatedAt || new Date().toISOString()
    });
    return;
  }

  if (undo.type === "restore_expense") {
    const row = undo.row || {};
    statements.db.prepare(
      `
        INSERT OR REPLACE INTO expenses (
          id,
          scope,
          paid_by,
          category,
          amount,
          expense_date,
          description,
          created_at
        ) VALUES (
          @id,
          @scope,
          @paidBy,
          @category,
          @amount,
          @expenseDate,
          @description,
          @createdAt
        )
      `
    ).run({
      id: Number(row.id || 0),
      scope: row.scope || "business",
      paidBy: row.paidBy || "",
      category: row.category || "",
      amount: Number(row.amount || 0),
      expenseDate: row.expenseDate || getTodayJalaliDate(),
      description: row.description || "",
      createdAt: row.createdAt || new Date().toISOString()
    });
    return;
  }

  if (undo.type === "restore_cashbox") {
    const row = undo.row || {};
    statements.db.prepare(
      `
        INSERT OR REPLACE INTO cashbox (
          id,
          entry_type,
          amount,
          category,
          reference_type,
          reference_id,
          entry_date,
          description,
          created_at
        ) VALUES (
          @id,
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
    ).run({
      id: Number(row.id || 0),
      entryType: row.entryType || "in",
      amount: Number(row.amount || 0),
      category: row.category || "",
      referenceType: row.referenceType || "",
      referenceId: row.referenceId ? Number(row.referenceId) : null,
      entryDate: row.entryDate || getTodayJalaliDate(),
      description: row.description || "",
      createdAt: row.createdAt || new Date().toISOString()
    });
    return;
  }

  throw new Error("Undo operation type is not supported.");
}

async function executeActions(actions, statements, runtime = {}, operationStore = null) {
  const list = Array.isArray(actions) ? actions.slice(0, MAX_EXECUTION_ACTIONS) : [];
  const executed = [];
  const failed = [];

  for (const rawAction of list) {
    const normalized = normalizeAction(rawAction, getTodayJalaliDate());
    if (!normalized) {
      const summary = safeString(rawAction?.summary).trim() || "Action is invalid";
      const errorText = "Action type is not supported.";
      failed.push({
        summary,
        error: errorText
      });
      if (operationStore) {
        operationStore.insert.run({
          actionType: safeString(rawAction?.type || "").trim().toLowerCase() || "unknown",
          actionKind: "invalid",
          actionSummary: summary,
          actionJson: jsonStringifySafe(rawAction || {}, "{}"),
          undoJson: "",
          undoable: 0,
          status: "failed",
          executedAt: new Date().toISOString(),
          undoneAt: "",
          undoError: errorText
        });
      }
      continue;
    }

    const beforeState = captureBeforeStateForUndo(normalized, statements);

    try {
      const result = await executeWriteAction(normalized, statements, runtime);
      const undoInstruction = buildUndoInstruction(normalized, beforeState, result);
      let operationId = null;

      if (operationStore) {
        const insertInfo = operationStore.insert.run({
          actionType: normalized.type,
          actionKind: normalized.kind || "write",
          actionSummary: result.summary || normalized.summary,
          actionJson: jsonStringifySafe(normalized, "{}"),
          undoJson: undoInstruction ? jsonStringifySafe(undoInstruction, "{}") : "",
          undoable: undoInstruction ? 1 : 0,
          status: "done",
          executedAt: new Date().toISOString(),
          undoneAt: "",
          undoError: ""
        });
        operationId = Number(insertInfo.lastInsertRowid || 0);
      }

      executed.push({
        id: result.id,
        type: normalized.type,
        summary: result.summary || normalized.summary,
        operationId,
        undoable: Boolean(undoInstruction)
      });
    } catch (error) {
      const errorText = safeString(error?.message).trim() || "Unknown error";
      failed.push({
        type: normalized.type,
        summary: normalized.summary,
        error: errorText
      });
      if (operationStore) {
        operationStore.insert.run({
          actionType: normalized.type,
          actionKind: normalized.kind || "write",
          actionSummary: normalized.summary,
          actionJson: jsonStringifySafe(normalized, "{}"),
          undoJson: "",
          undoable: 0,
          status: "failed",
          executedAt: new Date().toISOString(),
          undoneAt: "",
          undoError: errorText
        });
      }
    }
  }

  return { executed, failed };
}

function registerAssistantHandlers(ipcMain, db, electronApp, getMainWindow = null) {
  const statements = createDbStatements(db);
  const operationStore = createAssistantOperationStore(db);
  const memoryStore = createAssistantMemoryStore(db);
  const calendarStore = createAssistantCalendarStore(electronApp);

  ipcMain.handle("assistant:settings:get", () => {
    const settings = loadSettings(electronApp);
    const profile = memoryStore.readProfile();
    return toSettingsResponse(settings, profile);
  });

  ipcMain.handle("assistant:settings:update", (_, payload = {}) => {
    const current = loadSettings(electronApp);
    const currentProfile = memoryStore.readProfile();
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

    let savedProfile = currentProfile;
    if (payload.displayName !== undefined) {
      savedProfile = memoryStore.updateProfile({
        displayName: payload.displayName
      });
    }

    const saved = saveSettings(electronApp, next);
    return toSettingsResponse(saved, savedProfile);
  });

  ipcMain.handle("assistant:chat", async (_, payload = {}) => {
    const settings = loadSettings(electronApp);
    const messages = sanitizeChatMessages(payload.messages);
    if (!messages.length) {
      throw new Error("Ù¾ÛŒØ§Ù…ÛŒ Ø¨Ø±Ø§ÛŒ Ø¯Ø³ØªÛŒØ§Ø± Ø§Ø±Ø³Ø§Ù„ Ù†Ø´Ø¯Ù‡ Ø§Ø³Øª.");
    }

    const latestUserMessage = pickLatestUserMessage(messages);
    if (latestUserMessage) {
      memoryStore.appendChat("user", latestUserMessage);
      const inferredName = extractProfileNameFromText(latestUserMessage);
      if (inferredName) {
        const profile = memoryStore.readProfile();
        if (inferredName !== profile.displayName) {
          memoryStore.updateProfile({ displayName: inferredName });
        }
      }
    }

    const localHandled = tryHandleLocalAssistantMemoryQuery({
      latestUserMessage,
      memoryStore,
      operationStore,
      statements,
      calendarStore
    });
    if (localHandled) {
      if (localHandled.assistantReply) {
        memoryStore.appendChat("assistant", localHandled.assistantReply);
      }
      const profile = memoryStore.readProfile();
      return {
        assistantReply: localHandled.assistantReply,
        pendingActions: Array.isArray(localHandled.pendingActions)
          ? localHandled.pendingActions
          : [],
        profileDisplayName: profile.displayName || ""
      };
    }

    if (!settings.apiKey) {
      throw new Error("Ú©Ù„ÛŒØ¯ Gemini ØªÙ†Ø¸ÛŒÙ… Ù†Ø´Ø¯Ù‡ Ø§Ø³Øª.");
    }

    const userBehavior = buildAssistantBehaviorHints(operationStore, statements, memoryStore);
    const userMemory = buildUserMemorySnapshot(memoryStore, operationStore);
    const calendarInsight = calendarStore.buildContextInsight();
    const context = buildContextSnapshot(
      statements,
      userBehavior,
      userMemory,
      calendarInsight
    );
    let activeModel = sanitizeModel(settings.model);
    let rawModelText = "";

    try {
      rawModelText = await callGemini({
        apiKey: settings.apiKey,
        model: activeModel,
        messages,
        context
      });
    } catch (error) {
      if (!isModelNotFoundError(error)) {
        throw error;
      }

      const fallbackModel = await resolveSupportedModel(settings.apiKey, activeModel);
      if (!fallbackModel || fallbackModel.toLowerCase() === activeModel.toLowerCase()) {
        throw error;
      }

      rawModelText = await callGemini({
        apiKey: settings.apiKey,
        model: fallbackModel,
        messages,
        context
      });

      activeModel = fallbackModel;
      try {
        saveSettings(electronApp, {
          ...settings,
          model: activeModel
        });
      } catch {
        // Ignore settings write failures; chat already succeeded.
      }
    }

    const envelope = parseAssistantEnvelope(rawModelText);
    const pendingActions = normalizePendingActions(
      envelope.pendingActions,
      context.todayJalali
    );

    const assistantReply =
      envelope.assistantReply ||
      (pendingActions.length
        ? "Ø¹Ù…Ù„ÛŒØ§Øª Ù¾ÛŒØ´Ù†Ù‡Ø§Ø¯ÛŒ Ø¢Ù…Ø§Ø¯Ù‡ Ø§Ø³Øª. Ø¨Ø¹Ø¯ Ø§Ø² ØªØ§ÛŒÛŒØ¯ØŒ Ø§Ø¬Ø±Ø§ Ù…ÛŒâ€ŒÚ©Ù†Ù…."
        : "Ù¾Ø§Ø³Ø® Ø¢Ù…Ø§Ø¯Ù‡ Ø´Ø¯.");

    if (assistantReply) {
      memoryStore.appendChat("assistant", assistantReply);
    }
    const profile = memoryStore.readProfile();

    return {
      assistantReply,
      pendingActions,
      modelUsed: activeModel,
      profileDisplayName: profile.displayName || ""
    };
  });

  ipcMain.handle("assistant:execute-actions", async (_, payload = {}) => {
    const actions = Array.isArray(payload.actions) ? payload.actions : [];
    return executeActions(actions, statements, { getMainWindow }, operationStore);
  });

  ipcMain.handle("assistant:operations:list", (_, payload = {}) => {
    const limit = normalizeOpsLimit(payload?.limit);
    const items = operationStore
      .listRecent.all(limit)
      .map((row) => toOperationView(row));
    return { items };
  });

  ipcMain.handle("assistant:operations:undo", (_, payload = {}) => {
    const operationId = Number(payload?.operationId || payload?.id || 0);
    if (!Number.isFinite(operationId) || operationId <= 0) {
      throw new Error("Operation id is invalid.");
    }

    const row = operationStore.getById.get(operationId);
    if (!row) {
      throw new Error("Operation not found.");
    }

    const operation = toOperationView(row);
    if (operation.status === "undone") {
      return {
        ok: true,
        alreadyUndone: true,
        operation
      };
    }

    const undo = jsonParseSafe(row.undoJson, null);
    if (!operation.undoable || !undo) {
      throw new Error("This operation cannot be undone.");
    }

    try {
      applyUndoInstruction(undo, statements);
      operationStore.markUndone.run({
        id: operationId,
        undoneAt: new Date().toISOString()
      });
      const updated = operationStore.getById.get(operationId);
      return {
        ok: true,
        operation: toOperationView(updated || row)
      };
    } catch (error) {
      const undoError = safeString(error?.message).trim() || "Unknown undo error";
      operationStore.markUndoFailed.run({
        id: operationId,
        undoError
      });
      throw new Error(`Undo failed: ${undoError}`);
    }
  });
}

module.exports = {
  registerAssistantHandlers
};







