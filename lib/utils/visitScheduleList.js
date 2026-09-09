/**
 * Normalize visit schedule list payloads from ApiResponse (array or paged wrapper).
 */
export function normalizeVisitScheduleList(response) {
  if (!response) return []

  const data = response?.data !== undefined ? response.data : response

  if (Array.isArray(data)) return data

  if (data && typeof data === "object") {
    const nested =
      data.items ??
      data.Items ??
      data.visitSchedules ??
      data.VisitSchedules ??
      data.results ??
      data.Results ??
      []
    return Array.isArray(nested) ? nested : []
  }

  return []
}

/**
 * Fetch all visit schedules for a study (by-study endpoint, paginated list fallback).
 */
export async function fetchAllVisitSchedulesForStudy(studyId, visitScheduleService) {
  const sid = Number.parseInt(String(studyId ?? ""), 10)
  if (!Number.isFinite(sid) || sid <= 0) return []

  const byStudyRes = await visitScheduleService.getVisitSchedulesByStudyId(sid)
  let list = normalizeVisitScheduleList(byStudyRes)

  if (list.length === 0 && byStudyRes?.isSuccess !== false) {
    const pagedRes = await visitScheduleService.getVisitSchedulesList(1, 500, sid, null, null)
    if (pagedRes?.isSuccess !== false) {
      list = normalizeVisitScheduleList(pagedRes)
    }
  }

  return list
}
