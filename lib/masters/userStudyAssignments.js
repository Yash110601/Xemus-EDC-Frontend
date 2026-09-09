/**
 * Normalize GetUserStudySiteAssignments API payload into flat rows for edit UI.
 */

export function studyTypeToLabel(studyTypeRaw) {
  const stLower = typeof studyTypeRaw === "string" ? studyTypeRaw.toLowerCase() : null
  if (studyTypeRaw === 2 || studyTypeRaw === "2" || stLower === "milestone") {
    return "Milestone (Patient Wise)"
  }
  if (studyTypeRaw === 3 || studyTypeRaw === "3" || stLower === "visit") {
    return "Milestone (Visit Wise)"
  }
  return "Normal"
}

export function studyTypeToFormKey(studyTypeRaw) {
  const stLower = typeof studyTypeRaw === "string" ? studyTypeRaw.toLowerCase() : null
  if (studyTypeRaw === 2 || studyTypeRaw === "2" || stLower === "milestone") {
    return "milestonePatient"
  }
  if (studyTypeRaw === 3 || studyTypeRaw === "3" || stLower === "visit") {
    return "milestoneVisit"
  }
  return "normal"
}

function mapFlatAssignment(row) {
  const id = row.id ?? row.studyUserId ?? row.StudyUserId
  if (id == null) return null

  return {
    id,
    studyUserId: id,
    studyId: row.studyId ?? row.StudyId ?? null,
    siteId: row.siteId ?? row.SiteId ?? null,
    studyName:
      row.studyName ??
      row.studyProtocolNumber ??
      row.StudyProtocolNumber ??
      row.studyTitle ??
      (row.studyId || row.StudyId ? `Study ${row.studyId || row.StudyId}` : ""),
    siteName: row.siteName ?? row.SiteName ?? (row.siteId || row.SiteId ? `Site ${row.siteId || row.SiteId}` : ""),
    totalHonorariumAmount: row.totalHonorariumAmount ?? row.TotalHonorariumAmount ?? null,
    noOfPlannedPatients: row.noOfPlannedPatients ?? row.NoOfPlannedPatients ?? null,
    studyType: row.studyType ?? row.StudyType ?? null,
    studyTypeLabel: studyTypeToLabel(row.studyType ?? row.StudyType ?? null),
  }
}

export function normalizeUserStudyAssignments(raw) {
  if (!raw) return []

  const payload = raw?.data ?? raw
  let list = []

  if (Array.isArray(payload)) {
    if (payload.length > 0 && (payload[0]?.sites || payload[0]?.Sites)) {
      list = payload.flatMap((study) => {
        const sites = study.sites || study.Sites || []
        const studyType = study.studyType ?? study.StudyType ?? null
        const studyName =
          study.studyProtocolNumber ??
          study.StudyProtocolNumber ??
          study.studyName ??
          study.studyTitle ??
          (study.studyId || study.StudyId ? `Study ${study.studyId || study.StudyId}` : "")

        return (Array.isArray(sites) ? sites : []).map((site) =>
          mapFlatAssignment({
            id: site.studyUserId ?? site.StudyUserId,
            studyId: study.studyId ?? study.StudyId,
            siteId: site.siteId ?? site.SiteId,
            studyName,
            siteName: site.siteName ?? site.SiteName,
            totalHonorariumAmount: site.totalHonorariumAmount ?? site.TotalHonorariumAmount,
            noOfPlannedPatients: site.noOfPlannedPatients ?? site.NoOfPlannedPatients,
            studyType,
          }),
        )
      })
    } else {
      list = payload.map((row) => mapFlatAssignment(row))
    }
  } else if (payload && typeof payload === "object") {
    const nested =
      payload.assignments ||
      payload.items ||
      payload.studyUsers ||
      payload.studyUserList ||
      payload.list ||
      payload.data ||
      []
    if (Array.isArray(nested) && nested.length > 0) {
      return normalizeUserStudyAssignments(nested)
    }
    const studies = payload.studies || payload.Studies || []
    if (Array.isArray(studies) && studies.length > 0) {
      return normalizeUserStudyAssignments(studies)
    }
  }

  return list.filter(Boolean)
}

export function formatHonorariumAmount(value) {
  if (value == null || value === "") return "—"
  const num = Number(value)
  if (!Number.isFinite(num)) return "—"
  return num.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
