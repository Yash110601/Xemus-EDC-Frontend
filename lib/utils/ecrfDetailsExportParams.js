/**
 * Shared filter → API params for eCRF details CSV export (and parity checks).
 * @param {object} filters — export-ecrf-details page filter state
 * @returns {object} params for reportsService.exportEcrfDetailsReport
 */
export function buildEcrfDetailsExportParams(filters) {
  const params = {}

  // Backend requires visitScheduleId for CSV export even when we want "All".
  // Use 0 as the "All visit schedules" sentinel.
  // (PDF bundle payload only includes visitScheduleId when > 0.)
  const visitScheduleIdNum = parseInt(filters?.visitScheduleId, 10)
  if (!isNaN(visitScheduleIdNum) && visitScheduleIdNum >= 0) {
    params.visitScheduleId = visitScheduleIdNum
  } else {
    params.visitScheduleId = 0
  }

  if (filters?.studyId) {
    const studyIdNum = parseInt(filters.studyId, 10)
    if (!isNaN(studyIdNum) && studyIdNum > 0) params.studyId = studyIdNum
  }

  if (filters?.siteId) {
    const siteIdNum = parseInt(filters.siteId, 10)
    if (!isNaN(siteIdNum) && siteIdNum > 0) params.siteId = siteIdNum
  }

  if (filters?.patientEnrolmentId) {
    const patientEnrolmentIdNum = parseInt(filters.patientEnrolmentId, 10)
    if (!isNaN(patientEnrolmentIdNum) && patientEnrolmentIdNum > 0) {
      params.patientEnrolmentId = patientEnrolmentIdNum
    }
  }

  if (filters?.crfDesignId) {
    const crfDesignIdNum = parseInt(filters.crfDesignId, 10)
    if (!isNaN(crfDesignIdNum) && crfDesignIdNum > 0) params.crfDesignId = crfDesignIdNum
  }

  if (filters?.visitScheduleId) {
    const visitScheduleIdNum = parseInt(filters.visitScheduleId, 10)
    if (!isNaN(visitScheduleIdNum) && visitScheduleIdNum > 0) {
      params.visitScheduleId = visitScheduleIdNum
    }
  }

  return params
}

/**
 * POST body for eCRF details PDF ZIP bundle API (same filters as CSV; nulls for unselected optionals).
 * Keeps one source of truth with {@link buildEcrfDetailsExportParams}.
 * @param {object} filters — export-ecrf-details page filter state
 */
export function buildEcrfDetailsPdfBundlePayload(filters) {
  const p = buildEcrfDetailsExportParams(filters)
  /** Omit optional keys when unset — some .NET model binders reject explicit nulls for int?. */
  const body = {
    studyId: p.studyId,
    status: "Submitted",
    includeFormData: true,
    includeDesignSnapshot: true,
    pdfMode: "filled",
  }
  if (p.siteId != null && p.siteId > 0) body.siteId = p.siteId
  if (p.patientEnrolmentId != null && p.patientEnrolmentId > 0) body.patientEnrolmentId = p.patientEnrolmentId
  if (p.crfDesignId != null && p.crfDesignId > 0) body.crfDesignId = p.crfDesignId
  if (p.visitScheduleId != null && p.visitScheduleId > 0) body.visitScheduleId = p.visitScheduleId
  return body
}
