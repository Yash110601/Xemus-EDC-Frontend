/**
 * Shared report filters — Site/Patient paged DD + Visit/CRF study dropdown APIs.
 * Do not call report filter-options endpoints (removed from backend).
 */

/** Cascade validation — mirror backend error messages when optional filters are chained. */
export function validateReportPatientCascadeFilters(filters = {}) {
  const siteId = String(filters.siteId ?? "").trim()
  const patientEnrolmentId = String(filters.patientEnrolmentId ?? "").trim()
  const visitScheduleId = String(filters.visitScheduleId ?? "").trim()
  const crfDesignId = String(filters.crfDesignId ?? "").trim()

  if (patientEnrolmentId && !siteId) {
    return "Site is required when a patient is selected."
  }
  if (visitScheduleId && !patientEnrolmentId) {
    return "Patient is required when a visit is selected."
  }
  if (crfDesignId && !visitScheduleId) {
    return "Visit is required when a CRF form is selected."
  }
  return null
}

export function formatReportPatientOptionLabel(p) {
  const id = p?.patientId ?? p?.patientEnrolmentId ?? p?.id
  const initial = String(p?.initial ?? p?.patientCode ?? p?.name ?? "").trim()
  if (id != null && String(id).trim() !== "" && initial) {
    return `${id} - ${initial}`
  }
  if (id != null && String(id).trim() !== "") return String(id)
  return initial || "Patient"
}

/** Normalize GET /api/VisitSchedules/GetVisitSchedulesForDropdown/{studyId} */
export function normalizeVisitSchedulesDropdownItems(raw) {
  let list = raw
  if (raw && !Array.isArray(raw) && Array.isArray(raw?.items)) {
    list = raw.items
  }
  if (!Array.isArray(list)) return []

  if (list.length > 0 && typeof list[0] === "string") {
    return list
      .map((name, index) => {
        const label = String(name ?? "").trim()
        if (!label) return null
        const id = index + 1
        return { id, name: label }
      })
      .filter(Boolean)
  }

  return list
    .map((item) => {
      const id = Number(
        item?.id ?? item?.Id ?? item?.visitScheduleId ?? item?.VisitScheduleId,
      )
      if (!Number.isFinite(id) || id <= 0) return null
      const name = String(
        item?.name ?? item?.Name ?? item?.visitName ?? item?.VisitName ?? "",
      ).trim()
      return { id, name: name || String(id) }
    })
    .filter(Boolean)
}

/** Normalize GET /api/CrfDesigns/GetCrfDesignsForDropdown/{studyId} */
export function normalizeCrfDesignsDropdownItems(raw) {
  let list = raw
  if (raw && !Array.isArray(raw) && Array.isArray(raw?.items)) {
    list = raw.items
  }
  if (!Array.isArray(list)) return []

  if (list.length > 0 && typeof list[0] === "string") {
    return list
      .map((name, index) => {
        const label = String(name ?? "").trim()
        if (!label) return null
        const crfDesignId = index + 1
        return { crfDesignId, crfName: label }
      })
      .filter(Boolean)
  }

  return list
    .map((item) => {
      const crfDesignId = Number(item?.crfDesignId ?? item?.CrfDesignId ?? item?.id ?? item?.Id)
      if (!Number.isFinite(crfDesignId) || crfDesignId <= 0) return null
      const crfName = String(
        item?.crfName ?? item?.CrfName ?? item?.name ?? item?.Name ?? "",
      ).trim()
      return {
        crfDesignId,
        crfName: crfName || `CRF ${crfDesignId}`,
      }
    })
    .filter(Boolean)
}

export function formatReportCrfDesignOptionLabel(form) {
  if (!form) return ""
  const name = form.crfName || form.name || ""
  const id = form.crfDesignId ?? form.id
  if (name) return name
  return id != null ? `CRF ${id}` : ""
}
