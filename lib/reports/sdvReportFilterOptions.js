/** Normalize GET /api/SdvReport/filter-options response for dropdowns. */

function normalizeIdNameList(list) {
  if (!Array.isArray(list)) return []
  return list
    .map((item) => {
      const id = Number(item?.id ?? item?.Id)
      if (!Number.isFinite(id) || id <= 0) return null
      const name = String(item?.name ?? item?.Name ?? "").trim() || String(id)
      return { id, name }
    })
    .filter(Boolean)
}

export function normalizeSdvFilterOptionsResponse(response) {
  const data = response?.data ?? response?.Data ?? {}
  return {
    studyId: Number(data.studyId ?? data.StudyId) || null,
    selectedSiteId: Number(data.selectedSiteId ?? data.SelectedSiteId) || null,
    selectedPatientEnrolmentId:
      Number(data.selectedPatientEnrolmentId ?? data.SelectedPatientEnrolmentId) || null,
    selectedVisitScheduleId:
      Number(data.selectedVisitScheduleId ?? data.SelectedVisitScheduleId) || null,
    sites: normalizeIdNameList(data.sites ?? data.Sites),
    patients: normalizeIdNameList(data.patients ?? data.Patients),
    visits: normalizeIdNameList(data.visits ?? data.Visits),
    crfForms: normalizeSdvFilterCrfForms(data.crfForms ?? data.CrfForms),
  }
}

export function normalizeSdvFilterCrfForms(list) {
  if (!Array.isArray(list)) return []
  return list
    .map((item) => {
      const crfDesignId = Number(item?.crfDesignId ?? item?.CrfDesignId)
      if (!Number.isFinite(crfDesignId) || crfDesignId <= 0) return null
      const crfName = String(item?.crfName ?? item?.CrfName ?? "").trim()
      const crfDataId = item?.crfDataId ?? item?.CrfDataId ?? null
      const rowNumber = Number(item?.rowNumber ?? item?.RowNumber ?? 0)
      return {
        crfDesignId,
        crfName: crfName || `CRF ${crfDesignId}`,
        crfDataId,
        rowNumber: Number.isFinite(rowNumber) ? rowNumber : 0,
      }
    })
    .filter(Boolean)
}

/** Display label for multi-CRF same visit (rowNumber > 0). */
export function formatSdvCrfFormOptionLabel(form) {
  if (!form) return ""
  const name = form.crfName || `CRF ${form.crfDesignId}`
  const row = Number(form.rowNumber)
  if (Number.isFinite(row) && row > 0) return `${name} (Row ${row})`
  return name
}
