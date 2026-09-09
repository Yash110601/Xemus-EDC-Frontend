/** Display helpers for Email Delivery Report (SR UI guide). */

import {
  dateInputToAppDayEndIso,
  dateInputToAppDayStartIso,
  formatAppDateTime,
  getAppDateRangeLastDays,
} from "@/lib/utils/appDateTime"

export const EMAIL_TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "UserCredentials", label: "User Credentials" },
  { value: "PasswordResetByAdmin", label: "Password Reset By Admin" },
  { value: "ForgotPasswordOtp", label: "Forgot Password OTP" },
  { value: "DailyStudyUpdate", label: "Daily Study Update" },
]

/** Submit filter — Status enum: Sent = 0, Failed = 1 (do not invert). */
export const SUBMIT_STATUS_OPTIONS = [
  { value: "", label: "All submit statuses" },
  { value: "Sent", label: "Sent" },
  { value: "Failed", label: "Failed" },
]

/**
 * Delivery outcome filter — user-facing outcomes only (not raw ACS enums).
 * Sent as deliveryOutcome=… query param.
 */
export const DELIVERY_OUTCOME_OPTIONS = [
  { value: "", label: "All delivery outcomes" },
  { value: "Awaiting", label: "Pending (awaiting confirmation)" },
  { value: "Delivered", label: "Delivered" },
  { value: "NotDelivered", label: "Not delivered / Blocked" },
  { value: "Unavailable", label: "Unavailable" },
  { value: "Failed", label: "Failed (not sent)" },
]

/** @deprecated use DELIVERY_OUTCOME_OPTIONS */
export const DELIVERY_STATUS_OPTIONS = DELIVERY_OUTCOME_OPTIONS

export const PROVIDER_OPTIONS = [
  { value: "", label: "All providers" },
  { value: "AzureCommunicationServices", label: "Azure Communication Services" },
  { value: "SMTP", label: "SMTP" },
]

export const EMAIL_STATUS_TOOLTIP =
  "Email status (submit) — Sent or Failed when the message was handed to the email service. Sent alone is not delivery success."

export const DELIVERY_STATUS_TOOLTIP =
  "Delivery outcome at the mailbox — only Delivered is success. Pending means waiting for ACS confirmation."

export const NOTE_MESSAGE_TOOLTIP =
  "Note / Message — user-safe text from the API. Failed rows show submit message; other outcomes show delivery message."

/** @deprecated use EMAIL_STATUS_TOOLTIP */
export const SUBMIT_STATUS_TOOLTIP = EMAIL_STATUS_TOOLTIP

const BADGE_BASE =
  "rounded-full border px-2.5 py-0.5 text-xs font-semibold shadow-none whitespace-nowrap"

const OUTCOME_FIXED_MESSAGES = {
  Awaiting: "Waiting for delivery confirmation.",
  Delivered: "Delivered to the recipient mailbox.",
  Unavailable: "We could not confirm whether this email reached the recipient mailbox.",
}

const OUTCOME_DEFAULTS = {
  Failed: { submitLabel: "Failed", deliveryLabel: "Not sent", deliverySeverity: "error" },
  Awaiting: { submitLabel: "Sent", deliveryLabel: "Pending", deliverySeverity: "info" },
  Delivered: { submitLabel: "Sent", deliveryLabel: "Delivered", deliverySeverity: "success" },
  NotDelivered: {
    submitLabel: "Sent",
    deliveryLabel: "Not delivered / Blocked",
    deliverySeverity: "error",
  },
  Unavailable: { submitLabel: "Sent", deliveryLabel: "Unavailable", deliverySeverity: "warning" },
}

/**
 * Delivery badge color from deliverySeverity only.
 * success→green, info→blue, warning→amber, error→red
 */
export function getDeliverySeverityBadgeClass(severity) {
  const s = String(severity ?? "")
    .trim()
    .toLowerCase()
  if (s === "success") {
    return `${BADGE_BASE} border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50`
  }
  if (s === "warning") {
    return `${BADGE_BASE} border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-50`
  }
  if (s === "error") {
    return `${BADGE_BASE} border-red-200 bg-red-50 text-red-800 hover:bg-red-50`
  }
  if (s === "info") {
    return `${BADGE_BASE} border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-50`
  }
  return `${BADGE_BASE} border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-50`
}

/** Email status badge: Failed → red, otherwise green. */
export function getSubmitLabelBadgeClass(submitLabel) {
  const s = String(submitLabel ?? "").trim()
  if (s.toLowerCase() === "failed") {
    return `${BADGE_BASE} border-red-200 bg-red-50 text-red-800 hover:bg-red-50`
  }
  return `${BADGE_BASE} border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50`
}

/** As-is API label with safe empty fallback. */
export function asApiLabel(value, fallback = "—") {
  const text = String(value ?? "").trim()
  return text || fallback
}

export function getDeliveryOutcome(row) {
  return String(row?.deliveryOutcome ?? row?.DeliveryOutcome ?? "").trim()
}

/** Only Delivered is mailbox success — never treat submit Sent alone as success. */
export function isDeliverySuccess(row) {
  return getDeliveryOutcome(row) === "Delivered"
}

export function hasAwaitingDeliveryRows(rows) {
  return Array.isArray(rows) && rows.some((row) => getDeliveryOutcome(row) === "Awaiting")
}

function pickSubmitClientMessage(row) {
  return String(row?.submitClientMessage ?? row?.SubmitClientMessage ?? "").trim()
}

function pickDeliveryClientMessage(row) {
  return String(row?.deliveryClientMessage ?? row?.DeliveryClientMessage ?? "").trim()
}

/**
 * Note / Message column — outcome-aware, user-safe fields only.
 */
export function getEmailDeliveryNoteMessage(row, statusView = null) {
  const view = statusView || getEmailDeliveryStatusDisplay(row)
  const outcome = view.deliveryOutcome || getDeliveryOutcome(row)

  if (outcome === "Failed" || view.submitLabel?.toLowerCase() === "failed") {
    return pickSubmitClientMessage(row)
  }
  if (outcome === "NotDelivered") {
    return pickDeliveryClientMessage(row)
  }
  if (outcome === "Awaiting" || outcome === "Delivered" || outcome === "Unavailable") {
    return OUTCOME_FIXED_MESSAGES[outcome] || pickDeliveryClientMessage(row)
  }
  return pickDeliveryClientMessage(row) || pickSubmitClientMessage(row)
}

/**
 * SR status fields — driven by deliveryOutcome with API label fallbacks.
 * Never surface statusCode, deliveryStatusCode, errorMessage, or deliveryDetailText.
 */
export function getEmailDeliveryStatusDisplay(row) {
  const outcome = getDeliveryOutcome(row)
  const defaults = outcome ? OUTCOME_DEFAULTS[outcome] : null

  const submitLabel = String(
    row?.submitLabel ?? row?.SubmitLabel ?? defaults?.submitLabel ?? "",
  ).trim()
  const deliveryLabel = String(
    row?.deliveryLabel ?? row?.DeliveryLabel ?? defaults?.deliveryLabel ?? "",
  ).trim()
  const deliverySeverity = String(
    row?.deliverySeverity ?? row?.DeliverySeverity ?? defaults?.deliverySeverity ?? "",
  ).trim()

  const base = {
    deliveryOutcome: outcome,
    submitLabel: submitLabel || "—",
    deliveryLabel: deliveryLabel || "—",
    deliverySeverity,
    isDeliverySuccess: outcome === "Delivered",
  }

  return {
    ...base,
    noteMessage: getEmailDeliveryNoteMessage(row, base),
  }
}

/** Human display name — never use raw createdBy in SR UI. */
export function getCreatedByDisplay(row) {
  return asApiLabel(row?.createdByDisplay ?? row?.CreatedByDisplay ?? "")
}

export function getStudyNameDisplay(row) {
  return asApiLabel(row?.studyName ?? row?.StudyName ?? "")
}

export function getSiteNameDisplay(row) {
  return asApiLabel(row?.siteName ?? row?.SiteName ?? "")
}

/** Sent timestamp — prefer API display field. */
export function getEmailCreatedAtDisplay(row) {
  const display = String(row?.createdAtDisplay ?? row?.CreatedAtDisplay ?? "").trim()
  if (display) return display
  return formatEmailCreatedLocal(row?.createdAtUtc ?? row?.CreatedAtUtc)
}

/** Last delivery update — only when API sends a display value. */
export function getEmailDeliveryUpdatedAtDisplay(row) {
  const display = String(
    row?.deliveryUpdatedAtDisplay ?? row?.DeliveryUpdatedAtDisplay ?? "",
  ).trim()
  return display || null
}

/** @deprecated Prefer getDeliverySeverityBadgeClass / getSubmitLabelBadgeClass */
export function getSubmitStatusBadgeClass(status) {
  return getSubmitLabelBadgeClass(status)
}

/** @deprecated Prefer getDeliverySeverityBadgeClass — do not color from deliveryStatus */
export function getDeliveryStatusBadgeClass(status) {
  void status
  return getDeliverySeverityBadgeClass("info")
}

/** Last 7 IST calendar days as YYYY-MM-DD for date inputs. */
export function getDefaultEmailDeliveryDateRange() {
  return getAppDateRangeLastDays(7)
}

/** @deprecated Prefer dateInputToAppDayStartIso — do not send UTC Z midnight from FE */
export function dateInputToUtcStartIso(dateStr) {
  return dateInputToAppDayStartIso(dateStr)
}

/** @deprecated Prefer dateInputToAppDayEndIso */
export function dateInputToUtcEndIso(dateStr) {
  return dateInputToAppDayEndIso(dateStr)
}

/** Fallback when createdAtDisplay is absent — API ISO+offset as app wall clock. */
export function formatEmailCreatedLocal(value) {
  return formatAppDateTime(value)
}

export function formatEmailTypeLabel(value) {
  const raw = String(value ?? "").trim()
  if (!raw) return "—"
  const match = EMAIL_TYPE_OPTIONS.find((o) => o.value === raw)
  if (match?.label) return match.label
  const byIndex = {
    0: "User Credentials",
    1: "Password Reset By Admin",
    2: "Forgot Password OTP",
    3: "Daily Study Update",
  }
  if (byIndex[raw] != null) return byIndex[raw]
  return raw
}

export function formatProviderLabel(value) {
  const raw = String(value ?? "").trim()
  if (!raw) return "—"
  if (raw === "AzureCommunicationServices") return "ACS"
  return raw
}

export function formatAddressList(value) {
  if (value == null || value === "") return "—"
  if (Array.isArray(value)) {
    const joined = value.map((v) => String(v).trim()).filter(Boolean).join(", ")
    return joined || "—"
  }
  return String(value).trim() || "—"
}
