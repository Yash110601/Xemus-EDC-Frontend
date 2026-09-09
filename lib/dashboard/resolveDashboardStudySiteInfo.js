function pickText(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim()
    if (text) return text
  }
  return ""
}

function studyIdOf(study) {
  const id = study?.studyId ?? study?.StudyId ?? study?.id
  const parsed = Number.parseInt(String(id ?? ""), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function siteIdOf(site) {
  const id = site?.siteId ?? site?.SiteId ?? site?.id
  const parsed = Number.parseInt(String(id ?? ""), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function findAssignedStudy(assignedStudies, studyId) {
  if (!Array.isArray(assignedStudies) || !studyId) return null
  return (
    assignedStudies.find((study) => studyIdOf(study) === studyId) ??
    (assignedStudies.length === 1 ? assignedStudies[0] : null)
  )
}

function sitesOf(study) {
  if (Array.isArray(study?.sites)) return study.sites
  if (Array.isArray(study?.Sites)) return study.Sites
  return []
}

function findAssignedSite(assigned, studyId, siteId) {
  const studies = Array.isArray(assigned) ? assigned : []
  const scopedStudies = studyId
    ? studies.filter((study) => studyIdOf(study) === studyId)
    : studies.length === 1
      ? studies
      : studies

  const searchPool = scopedStudies.length > 0 ? scopedStudies : studies

  if (siteId) {
    for (const study of searchPool) {
      const match = sitesOf(study).find((site) => siteIdOf(site) === siteId)
      if (match) return match
    }
    return null
  }

  for (const study of searchPool) {
    const sites = sitesOf(study)
    if (sites.length === 1) return sites[0]
  }
  return null
}

/**
 * Resolve study + site metadata for dashboard context strip.
 */
export function resolveDashboardStudySiteInfo({
  dashboardData = null,
  assignedStudies = [],
  studyId = null,
  siteId = null,
} = {}) {
  const empty = {
    hasContent: false,
    protocolNumber: "—",
    nameOfDrug: "—",
    studyTitle: "—",
    siteName: "—",
    siteFullName: "—",
  }

  const parsedStudyId = Number.parseInt(String(studyId ?? ""), 10)
  const parsedSiteId = Number.parseInt(String(siteId ?? ""), 10)
  const scopedStudyId = Number.isFinite(parsedStudyId) && parsedStudyId > 0 ? parsedStudyId : null
  const scopedSiteId = Number.isFinite(parsedSiteId) && parsedSiteId > 0 ? parsedSiteId : null

  if (!scopedStudyId) {
    return empty
  }

  const studyInfo = dashboardData?.studyInfo ?? null
  const assignedFromDashboard =
    dashboardData?.assignedStudySiteDetails?.studies ??
    dashboardData?.assignedStudySiteDetails?.Studies
  const assigned =
    Array.isArray(assignedFromDashboard) && assignedFromDashboard.length > 0
      ? assignedFromDashboard
      : assignedStudies

  const assignedStudy = findAssignedStudy(assigned, scopedStudyId)
  const assignedSite = findAssignedSite(assigned, scopedStudyId, scopedSiteId)

  const storageSite =
    typeof window !== "undefined" ? String(localStorage.getItem("selectedSite") ?? "").trim() : ""

  const protocolNumber = pickText(
    studyInfo?.protocolNumber,
    studyInfo?.ProtocolNumber,
    assignedStudy?.protocolNumber,
    assignedStudy?.ProtocolNumber,
  )
  const nameOfDrug = pickText(studyInfo?.nameOfDrug, studyInfo?.NameOfDrug, assignedStudy?.nameOfDrug)
  const studyTitle = pickText(
    studyInfo?.studyTitle,
    studyInfo?.StudyTitle,
    assignedStudy?.studyTitle,
    assignedStudy?.StudyTitle,
    typeof window !== "undefined" ? localStorage.getItem("selectedStudyTitle") : "",
  )
  const siteName = pickText(
    studyInfo?.siteName,
    studyInfo?.SiteName,
    assignedSite?.siteName,
    assignedSite?.SiteName,
    storageSite,
  )
  const siteFullName = pickText(
    studyInfo?.siteFullName,
    studyInfo?.SiteFullName,
    assignedSite?.siteFullName,
    assignedSite?.SiteFullName,
  )

  const hasContent = Boolean(protocolNumber || nameOfDrug || studyTitle)

  return {
    hasContent,
    protocolNumber: protocolNumber || "—",
    nameOfDrug: nameOfDrug || "—",
    studyTitle: studyTitle || "—",
    siteName: siteName || "—",
    siteFullName: siteFullName || "—",
  }
}
