/**
 * Extract site rows for Total Subjects / enrollment charts from a dashboard payload.
 */
export function extractDashboardSiteRows(dashboardData) {
  if (!dashboardData || typeof dashboardData !== "object") return []

  const assigned =
    dashboardData.assignedStudySiteDetails ?? dashboardData.AssignedStudySiteDetails ?? null
  const breakdown =
    dashboardData.plannedVsActual?.studySiteBreakdown ??
    dashboardData.plannedVsActual?.StudySiteBreakdown ??
    dashboardData.PlannedVsActual?.studySiteBreakdown ??
    dashboardData.PlannedVsActual?.StudySiteBreakdown ??
    null

  const sources = [assigned, breakdown].filter(Boolean)
  const rows = []
  const seen = new Set()

  for (const source of sources) {
    const studies = source.studies ?? source.Studies
    if (!Array.isArray(studies)) continue
    for (const study of studies) {
      const sites = study?.sites ?? study?.Sites
      if (!Array.isArray(sites)) continue
      for (const site of sites) {
        const id = site?.siteId ?? site?.SiteId ?? site?.id
        const key = id != null ? String(id) : `${site?.siteName ?? site?.SiteName ?? ""}-${rows.length}`
        if (seen.has(key)) continue
        seen.add(key)
        rows.push(site)
      }
    }
  }

  return rows
}
