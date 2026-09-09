/**
 * Single-field read with camelCase + simple PascalCase fallback (and CRF name variants).
 * Use on report tables when APIs may return either JSON casing.
 * @param {Record<string, unknown> | null | undefined} row
 * @param {string} key - camelCase key, e.g. `studyProtocol`, `siteName`, `crfName`
 */
export function pickDtoField(row, key) {
  if (!row || typeof row !== "object") return undefined
  if (key === "crfName") return row.crfName ?? row.CrfName ?? row.CRFName
  const pascal = key.charAt(0).toUpperCase() + key.slice(1)
  return row[key] ?? row[pascal]
}

/** "Changed by" display for Audit Trail With Reason rows (camel + Pascal user fields). */
export function getAuditTrailReasonChangedByLabel(row) {
  if (!row || typeof row !== "object") return "-"
  const name = row.changedByUserName ?? row.ChangedByUserName
  const email = row.changedByUserEmail ?? row.ChangedByUserEmail
  const id = row.changedByUserId ?? row.ChangedByUserId
  /** Some APIs return a single login/display string on `changedBy` only. */
  const changedByLegacy = row.changedBy ?? row.ChangedBy
  if (toReportDisplay(name) !== "-") return name
  if (toReportDisplay(email) !== "-") return email
  if (toReportDisplay(changedByLegacy) !== "-") return toReportDisplay(changedByLegacy)
  return toReportDisplay(id)
}

/** Read first populated field from a DTO row (camelCase / PascalCase tolerant). */
export function firstTruthyField(row, keys) {
  if (!row || typeof row !== "object") return ""
  for (const k of keys) {
    if (!Object.prototype.hasOwnProperty.call(row, k)) continue
    const v = row[k]
    if (v === undefined || v === null) continue
    const s = String(v).trim()
    if (s) return s
  }
  return ""
}

export function toReportDisplay(value) {
  if (value === null || value === undefined) return "-"
  const text = String(value).trim()
  return text ? text : "-"
}

/**
 * Shared Tailwind classes for report grid copy controls (dense tables, long text).
 * Import wherever a Copy icon appears next to truncated report values.
 */
export const REPORT_GRID_COPY_BTN_CLASS =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-emerald-600 shadow-sm transition-colors hover:border-emerald-300/80 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-1 active:scale-[0.97]"

/** Merge onto the same element as {@link REPORT_GRID_COPY_BTN_CLASS}; parent needs `group/cell`. */
export const REPORT_GRID_COPY_HOVER_REVEAL_CLASS =
  "opacity-0 transition-opacity duration-200 motion-reduce:transition-none group-hover/cell:opacity-100 group-focus-within/cell:opacity-100 focus-visible:opacity-100"
