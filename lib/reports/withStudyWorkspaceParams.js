/**
 * Attach header workspace study/site for study-matrix API authorization.
 * Does not override studyId/siteId already set on the payload (report filters).
 */
export function withStudyWorkspaceParams(params = {}, { studyId, siteId } = {}) {
  const next = { ...(params ?? {}) }

  const parsedStudyId = Number.parseInt(String(studyId ?? ""), 10)
  if (
    (next.studyId == null || next.studyId === "") &&
    Number.isFinite(parsedStudyId) &&
    parsedStudyId > 0
  ) {
    next.studyId = parsedStudyId
  }

  const parsedSiteId = Number.parseInt(String(siteId ?? ""), 10)
  if (
    (next.siteId == null || next.siteId === "") &&
    Number.isFinite(parsedSiteId) &&
    parsedSiteId > 0
  ) {
    next.siteId = parsedSiteId
  }

  return next
}
