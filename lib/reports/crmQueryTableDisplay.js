/**
 * Shared display helpers for CRF query tables (align with eCRF manually / Query management grid).
 */

const QUERY_TYPE_SYSTEM = 1
const QUERY_TYPE_MANUAL = 2
const QUERY_STATUS_OPEN = 1
const QUERY_STATUS_IN_PROCESS = 2
const QUERY_STATUS_CLOSED = 3

export function normalizeQueryType(t) {
  if (t === QUERY_TYPE_SYSTEM || t === "SystemGenerated") return QUERY_TYPE_SYSTEM
  if (t === QUERY_TYPE_MANUAL || t === "ManualGenerated") return QUERY_TYPE_MANUAL
  const n = parseInt(String(t), 10)
  return Number.isFinite(n) ? n : null
}

export function normalizeQueryStatus(s) {
  if (s === QUERY_STATUS_OPEN || s === "Open") return QUERY_STATUS_OPEN
  if (s === QUERY_STATUS_IN_PROCESS || s === "InProcess" || s === "In Process") return QUERY_STATUS_IN_PROCESS
  if (s === "SentBack" || s === "ReSubmitted") return QUERY_STATUS_IN_PROCESS
  if (s === 4 || s === "4") return QUERY_STATUS_CLOSED
  if (s === QUERY_STATUS_CLOSED || s === "Closed") return QUERY_STATUS_CLOSED
  const n = parseInt(String(s), 10)
  return Number.isFinite(n) ? n : null
}

export function getQueryStatusLabel(status) {
  const n = normalizeQueryStatus(status)
  if (n === QUERY_STATUS_OPEN) return "Open"
  if (n === QUERY_STATUS_IN_PROCESS) return "In Process"
  if (n === QUERY_STATUS_CLOSED) return "Closed"
  return "Unknown"
}

export function getQueryStatusPillClass(status) {
  const n = normalizeQueryStatus(status)
  if (n === QUERY_STATUS_OPEN) return "border-sky-200 bg-sky-50 text-sky-900"
  if (n === QUERY_STATUS_IN_PROCESS) return "border-orange-200 bg-orange-50 text-orange-900"
  if (n === QUERY_STATUS_CLOSED) return "border-emerald-200 bg-emerald-50 text-emerald-900"
  return "border-slate-200 bg-slate-50 text-slate-800"
}

/** Prefer camelCase DTO keys; fall back to PascalCase from older payloads. */
export function queryDtoPick(row, ...keys) {
  for (const k of keys) {
    const v = row?.[k]
    if (v === undefined || v === null) continue
    if (typeof v === "string" && v.trim() === "") continue
    return v
  }
  return ""
}

export function formatQueryGridScalar(v) {
  if (v === null || v === undefined) return "—"
  if (typeof v === "boolean") return v ? "Yes" : "No"
  const s = String(v)
  return s.length > 240 ? `${s.slice(0, 237)}…` : s
}

/** Handles ISO and common API `yyyy-MM-dd HH:mm:ss` strings. */
export function formatQueryGridDate(raw) {
  if (!raw) return "—"
  try {
    const s = String(raw).trim()
    const normalized = s.includes("T") ? s : s.replace(" ", "T")
    const d = new Date(normalized)
    if (Number.isNaN(d.getTime())) return String(raw)
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
  } catch {
    return String(raw)
  }
}

/**
 * Format a query timestamp as UTC with seconds, matching the API's
 * `yyyy-MM-dd HH:mm:ss` shape. Used by audit-sensitive grids (e.g. Query
 * Management Report) where reviewers across timezones must see one
 * unambiguous timestamp.
 *
 * Handled inputs:
 *  - "2026-05-26 09:17:59"          → treated as UTC (no TZ marker)
 *  - "2026-05-26T09:17:59Z"         → already UTC
 *  - "2026-05-26T14:47:59+05:30"    → converted to UTC
 */
export function formatQueryGridDateUtcWithSeconds(raw) {
  if (!raw) return "—"
  try {
    const s = String(raw).trim()
    // If the string already carries a timezone marker (Z or numeric offset),
    // keep it. Otherwise, force-interpret as UTC by appending "Z".
    const hasTzMarker = /(Z|[+\-]\d{2}:?\d{2})$/.test(s)
    const isoCandidate = s.includes("T") ? s : s.replace(" ", "T")
    const normalized = hasTzMarker ? isoCandidate : `${isoCandidate}Z`
    const d = new Date(normalized)
    if (Number.isNaN(d.getTime())) return String(raw)
    // toISOString → "2026-05-26T09:17:59.000Z" → trim ms+Z → swap T for space.
    return d.toISOString().slice(0, 19).replace("T", " ")
  } catch {
    return String(raw)
  }
}

export function queryGridTypeLabel(t) {
  const n = normalizeQueryType(t)
  if (n === QUERY_TYPE_SYSTEM) return "System"
  if (n === QUERY_TYPE_MANUAL) return "Manual"
  return formatQueryGridScalar(t)
}

/** Decode common HTML entities in API strings (e.g. field path with `&gt;`). */
export function decodeHtmlEntities(input) {
  if (input == null) return ""
  let s = String(input)
  s = s.replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/g, "'").replace(/&apos;/gi, "'")
  s = s.replace(/&amp;/gi, "&")
  return s
}

/** Case-insensitive substring match across common query row fields (current page only). */
export function rowMatchesQuerySearch(row, q) {
  const needle = String(q || "").trim().toLowerCase()
  if (!needle) return true
  const haystack = [
    queryDtoPick(row, "id", "Id"),
    queryDtoPick(row, "status", "Status"),
    queryDtoPick(row, "queryType", "QueryType"),
    queryDtoPick(row, "field", "Field", "fieldLabel", "FieldLabel"),
    queryDtoPick(row, "queryText", "QueryText"),
    queryDtoPick(row, "expectedCondition", "ExpectedCondition", "expected", "Expected"),
    queryDtoPick(row, "currentValue", "CurrentValue", "actualValue", "ActualValue", "actual", "Actual"),
    queryDtoPick(row, "visitName", "VisitName"),
    queryDtoPick(row, "crfDesignName", "CrfDesignName", "crfName", "CrfName"),
    queryDtoPick(row, "studyName", "StudyName", "studyProtocolNumber", "StudyProtocolNumber"),
    queryDtoPick(row, "siteName", "SiteName"),
    queryDtoPick(row, "patientInitials", "PatientInitials", "patientInitial", "PatientInitial"),
    queryDtoPick(row, "raisedBy", "RaisedBy", "queryRaisedByUserName", "QueryRaisedByUserName"),
    queryDtoPick(row, "assigned", "Assigned", "queryAssignedToUserName", "QueryAssignedToUserName"),
    queryDtoPick(row, "approver", "Approver", "queryApproverUserName", "QueryApproverUserName"),
    queryDtoPick(row, "reviewerComment", "ReviewerComment", "queryApproverComment", "QueryApproverComment"),
    queryDtoPick(row, "submitterComment", "SubmitterComment", "crfSubmitterComment", "CrfSubmitterComment"),
  ]
    .map((x) => String(x ?? "").toLowerCase())
    .join(" ")
  return haystack.includes(needle)
}
