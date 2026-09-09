/** Normalized query counts from CRF data entry grid API (req §8.4). */

const EMPTY_SUMMARY = Object.freeze({
  total: 0,
  open: 0,
  inProcess: 0,
  closed: 0,
  manual: 0,
  auto: 0,
})

function readCount(raw, camelKey, pascalKey) {
  const value = raw?.[camelKey] ?? raw?.[pascalKey]
  const n = Number.parseInt(String(value ?? 0), 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Accept camelCase or PascalCase API payloads. */
export function normalizeCrfQuerySummary(raw) {
  if (!raw || typeof raw !== "object") return { ...EMPTY_SUMMARY }

  const summary = {
    total: readCount(raw, "total", "Total"),
    open: readCount(raw, "open", "Open"),
    inProcess: readCount(raw, "inProcess", "InProcess"),
    closed: readCount(raw, "closed", "Closed"),
    manual: readCount(raw, "manual", "Manual"),
    auto: readCount(raw, "auto", "Auto"),
  }

  if (summary.total === 0) {
    summary.total = summary.open + summary.inProcess + summary.closed
  }

  return summary
}

export function hasCrfQueryActivity(summary) {
  const s = summary ?? EMPTY_SUMMARY
  return s.total > 0 || s.open > 0 || s.inProcess > 0 || s.closed > 0
}

export function getVisitQuerySummaryFromPatient(patient, visitScheduleId) {
  if (patient == null || visitScheduleId == null || visitScheduleId === "") {
    return { ...EMPTY_SUMMARY }
  }

  const scheduleKey = String(visitScheduleId)
  const list = Array.isArray(patient?.visitCrfData) ? patient.visitCrfData : []
  const cell = list.find((vcd) => String(vcd?.visitScheduleId ?? "") === scheduleKey)
  return normalizeCrfQuerySummary(cell?.querySummary ?? cell?.QuerySummary)
}

export { EMPTY_SUMMARY as EMPTY_CRF_QUERY_SUMMARY }
