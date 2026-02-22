const fs = require("node:fs");
const path = require("node:path");

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
  "run_sql",
  "calculate_expression"
]);

function normalizeDigits(value) {
  return String(value || "")
    .replace(/[Û°-Û¹]/g, (d) => String("Û°Û±Û²Û³Û´ÛµÛ¶Û·Û¸Û¹".indexOf(d)))
    .replace(/[Ù -Ù©]/g, (d) => String("Ù Ù¡Ù¢Ù£Ù¤Ù¥Ù¦Ù§Ù¨Ù©".indexOf(d)));
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

  return {
    id: `${partner.id}/${projectId}`,
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

function executeRunBusinessReport(action, statements) {
  const totals = statements.reportBusinessTotals.get();
  const summary = [
    `Income: ${Number(totals.totalIncome || 0)}`,
    `Outcome: ${Number(totals.totalOutcome || 0)}`,
    `Expenses: ${Number(totals.totalExpenses || 0)}`,
    `Projects: ${Number(totals.totalProjects || 0)}`
  ].join(" | ");

  return {
    id: "report-business",
    summary: `Business report => ${summary}`
  };
}

function executeRunProjectProfitReport(action, statements) {
  const totals = statements.reportProjectProfitTotals.get();
  const summary = [
    `Client received: ${Number(totals.totalClientReceived || 0)}`,
    `Partner due: ${Number(totals.totalPartnerDue || 0)}`,
    `Partner paid: ${Number(totals.totalPartnerPaid || 0)}`,
    `Expected net: ${Number(totals.totalExpectedNetProfit || 0)}`,
    `Realized net: ${Number(totals.totalRealizedNetProfit || 0)}`
  ].join(" | ");

  return {
    id: "report-project-profit",
    summary: `Project profit report => ${summary}`
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

function executeWriteAction(action, statements) {
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

  if (action.type === "run_sql") return executeRunSql(action, statements);
  if (action.type === "calculate_expression") return executeCalculateExpression(action, statements);

  throw new Error("Unsupported action type.");
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
- For calculations requiring high precision, use action type calculate_expression.
- For complex DB access, use run_sql action with a single safe SQL statement.
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
        SELECT id, name, pricing_model AS pricingModel, rate, currency, description, is_active AS isActive
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
        SELECT id, title, client_name AS clientName, status, start_date AS startDate, end_date AS endDate, notes
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
          is_active AS isActive
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
      "SELECT id, partner_id AS partnerId, project_id AS projectId FROM partner_project_terms WHERE id = ? LIMIT 1"
    ),
    partnerTermByPair: db.prepare(
      "SELECT id FROM partner_project_terms WHERE partner_id = ? AND project_id = ? LIMIT 1"
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
          settlement_date AS settlementDate
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
          partner_id AS partnerId
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
        SELECT id, scope, paid_by AS paidBy, category, amount, expense_date AS expenseDate, description
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
          description
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
        summary: safeString(rawAction?.summary).trim() || "Ø¹Ù…Ù„ÛŒØ§Øª Ù†Ø§Ù…Ø¹ØªØ¨Ø±",
        error: "Ù†ÙˆØ¹ Ø¹Ù…Ù„ÛŒØ§Øª Ù¾Ø´ØªÛŒØ¨Ø§Ù†ÛŒ Ù†Ù…ÛŒâ€ŒØ´ÙˆØ¯."
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
        error: safeString(error?.message).trim() || "Ø®Ø·Ø§ÛŒ Ù†Ø§Ø´Ù†Ø§Ø®ØªÙ‡"
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
      throw new Error("Ú©Ù„ÛŒØ¯ Gemini ØªÙ†Ø¸ÛŒÙ… Ù†Ø´Ø¯Ù‡ Ø§Ø³Øª.");
    }

    const messages = sanitizeChatMessages(payload.messages);
    if (!messages.length) {
      throw new Error("Ù¾ÛŒØ§Ù…ÛŒ Ø¨Ø±Ø§ÛŒ Ø¯Ø³ØªÛŒØ§Ø± Ø§Ø±Ø³Ø§Ù„ Ù†Ø´Ø¯Ù‡ Ø§Ø³Øª.");
    }

    const context = buildContextSnapshot(statements);
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

    return {
      assistantReply,
      pendingActions,
      modelUsed: activeModel
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





