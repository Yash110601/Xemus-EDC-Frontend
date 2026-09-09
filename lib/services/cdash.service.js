/**
 * CDASH reference library + report export (Phase 1).
 */

import apiClient from "../api/client"
import { API_CONFIG } from "../api/config"
import logger from "../api/logger"

export const CDASH_IG_VERSION = "2.3"

function appendOptionalQueryParam(query, key, value) {
  if (value == null || value === "") return
  query.append(key, String(value))
}

function buildCdashReportQuery({
  studyId,
  siteId,
  patientEnrolmentId,
  crfDesignId,
  visitScheduleId,
  pageNumber,
  pageSize,
  search,
  isMapped,
} = {}) {
  const query = new URLSearchParams()
  if (studyId != null && studyId !== "") query.append("studyId", String(studyId))
  appendOptionalQueryParam(query, "siteId", siteId)
  appendOptionalQueryParam(query, "patientEnrolmentId", patientEnrolmentId)
  appendOptionalQueryParam(query, "crfDesignId", crfDesignId)
  appendOptionalQueryParam(query, "visitScheduleId", visitScheduleId)
  if (pageNumber != null) query.append("pageNumber", String(pageNumber))
  if (pageSize != null) query.append("pageSize", String(pageSize))
  if (search?.trim()) query.append("search", search.trim())
  if (isMapped === true || isMapped === false) {
    query.append("isMapped", String(isMapped))
  }
  return query
}

async function downloadCdashFile(endpoint, params = {}, fallbackFileName = "cdash-export.csv") {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return
    query.set(key, String(value))
  })

  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null
  const url = `${API_CONFIG.BASE_URL}${endpoint}?${query}`

  const response = await fetch(url, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || `Export failed (${response.status})`)
  }

  const blob = await response.blob()
  const contentDisposition = response.headers.get("Content-Disposition")
  let filename = fallbackFileName
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^";]+)"?/i)
    if (match?.[1]) filename = match[1].replace(/"/g, "")
  }

  const downloadUrl = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = downloadUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  window.URL.revokeObjectURL(downloadUrl)
  document.body.removeChild(link)

  return { success: true, filename }
}

class CdashService {
  async getLibraryStatus(igVersion = CDASH_IG_VERSION) {
    try {
      const query = new URLSearchParams({ igVersion })
      return await apiClient.get(`${API_CONFIG.ENDPOINTS.CDASH.LIBRARY_STATUS}?${query}`)
    } catch (error) {
      logger.error("CDASH library status failed", error)
      return { isSuccess: false, message: error.message || "Failed to load CDASH library status" }
    }
  }

  async getDomains(igVersion = CDASH_IG_VERSION) {
    try {
      const query = new URLSearchParams({ igVersion })
      return await apiClient.get(`${API_CONFIG.ENDPOINTS.CDASH.DOMAINS}?${query}`)
    } catch (error) {
      logger.error("CDASH domains failed", error)
      return { isSuccess: false, message: error.message || "Failed to load CDASH domains" }
    }
  }

  async getVariables({
    igVersion = CDASH_IG_VERSION,
    domainCode,
    search,
    pageNumber = 1,
    pageSize = 50,
    crfDesignId,
    fieldInstanceId,
  } = {}) {
    try {
      const query = new URLSearchParams({
        igVersion,
        pageNumber: String(pageNumber),
        pageSize: String(Math.min(pageSize, 200)),
      })
      if (domainCode) query.append("domainCode", domainCode)
      if (search?.trim()) query.append("search", search.trim())
      const designId = Number(crfDesignId)
      if (Number.isFinite(designId) && designId > 0) {
        query.append("crfDesignId", String(designId))
      }
      const fid = String(fieldInstanceId ?? "").trim()
      if (fid) query.append("fieldInstanceId", fid)
      return await apiClient.get(`${API_CONFIG.ENDPOINTS.CDASH.VARIABLES}?${query}`)
    } catch (error) {
      logger.error("CDASH variables failed", error)
      return { isSuccess: false, message: error.message || "Failed to load CDASH variables" }
    }
  }

  /** POST /api/Cdash/Suggest — one field, optional user pick. */
  async suggest({
    studyId,
    crfDesignId,
    igVersion = CDASH_IG_VERSION,
    fieldInstanceId,
    label = "",
    controlType = "text",
    limit = 3,
    excludeCdashReferenceDataIds = [],
    draftAssignments = [],
  } = {}) {
    try {
      const body = {
        studyId: Number(studyId),
        igVersion,
        fieldInstanceId,
        label: String(label ?? "").trim(),
        controlType: String(controlType ?? "text").trim() || "text",
        limit: Math.min(Math.max(Number(limit) || 3, 1), 10),
      }

      const designId = Number(crfDesignId)
      if (Number.isFinite(designId) && designId > 0) {
        body.crfDesignId = designId
      }

      if (Array.isArray(draftAssignments) && draftAssignments.length > 0) {
        body.draftAssignments = draftAssignments
          .map((row) => ({
            cdashReferenceDataId: Number(row?.cdashReferenceDataId),
            fieldInstanceId: String(row?.fieldInstanceId ?? "").trim(),
            fieldLabel: String(row?.fieldLabel ?? row?.fieldInstanceId ?? "").trim(),
            cdashVariableName: String(row?.cdashVariableName ?? "").trim() || undefined,
          }))
          .filter(
            (row) =>
              Number.isFinite(row.cdashReferenceDataId) &&
              row.cdashReferenceDataId > 0 &&
              row.fieldInstanceId,
          )
      } else {
        const excludeIds = (Array.isArray(excludeCdashReferenceDataIds) ? excludeCdashReferenceDataIds : [])
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0)
        if (excludeIds.length > 0) {
          body.excludeCdashReferenceDataIds = excludeIds
        }
      }

      return await apiClient.post(API_CONFIG.ENDPOINTS.CDASH.SUGGEST, body, { notify: false })
    } catch (error) {
      logger.error("CDASH suggest failed", error)
      return { isSuccess: false, message: error.message || "Failed to load CDASH suggestions" }
    }
  }

  /** GET /api/Cdash/ReportSummary — per-CRF mapped vs pending summary table. */
  async getReportSummary(params = {}) {
    try {
      const query = buildCdashReportQuery(params)
      return await apiClient.get(`${API_CONFIG.ENDPOINTS.CDASH.REPORT_SUMMARY}?${query}`, {
        notify: false,
      })
    } catch (error) {
      logger.error("CDASH report summary failed", error)
      return { isSuccess: false, message: error.message || "Failed to load CDASH report summary" }
    }
  }

  /** GET /api/Cdash/FieldReport — paginated field-level mapping list. */
  async getFieldReport(params = {}) {
    try {
      const query = buildCdashReportQuery(params)
      return await apiClient.get(`${API_CONFIG.ENDPOINTS.CDASH.FIELD_REPORT}?${query}`, {
        notify: false,
      })
    } catch (error) {
      logger.error("CDASH field report failed", error)
      return { isSuccess: false, message: error.message || "Failed to load CDASH field report" }
    }
  }

  /**
   * Download long-format submitted values CSV (legacy — one row per field value).
   * @deprecated Prefer exportSubmittedData for wide eCRF-style export.
   */
  async exportSubmittedDataCsv(params = {}) {
    const query = buildCdashReportQuery(params)
    return downloadCdashFile(
      API_CONFIG.ENDPOINTS.CDASH.EXPORT,
      Object.fromEntries(query.entries()),
      `cdash-submitted-long-study-${params.studyId}.csv`,
    )
  }

  /**
   * GET /api/Cdash/ExportSubmittedData — wide eCRF-style export; CDASH variable columns.
   * visitScheduleId=0 → ZIP (one CSV per visit); specific visit → single CSV.
   */
  async exportSubmittedData(params = {}) {
    const query = buildCdashReportQuery(params)
    const visitScheduleId = Number(params.visitScheduleId)
    const isAllVisits = !Number.isFinite(visitScheduleId) || visitScheduleId === 0
    const stamp = new Date().toISOString().replace(/[:.]/g, "-")
    const fallbackFileName = isAllVisits
      ? `cdash-submitted-study-${params.studyId}-${stamp}.zip`
      : `cdash-submitted-study-${params.studyId}-visit-${visitScheduleId}-${stamp}.csv`

    return downloadCdashFile(
      API_CONFIG.ENDPOINTS.CDASH.EXPORT_SUBMITTED_DATA,
      Object.fromEntries(query.entries()),
      fallbackFileName,
    )
  }

  /** GET /api/Cdash/ExportMappingSummaryCsv */
  async exportMappingSummaryCsv(params = {}) {
    const query = buildCdashReportQuery(params)
    return downloadCdashFile(
      API_CONFIG.ENDPOINTS.CDASH.EXPORT_MAPPING_SUMMARY_CSV,
      Object.fromEntries(query.entries()),
      `cdash-crf-mapping-summary-study-${params.studyId}.csv`,
    )
  }

  /** GET /api/Cdash/ExportMappingDetailCsv — legacy field-level export (all fields). */
  async exportMappingDetailCsv(params = {}) {
    const query = buildCdashReportQuery(params)
    return downloadCdashFile(
      API_CONFIG.ENDPOINTS.CDASH.EXPORT_MAPPING_DETAIL_CSV,
      Object.fromEntries(query.entries()),
      `cdash-field-mapping-detail-study-${params.studyId}.csv`,
    )
  }

  /** GET /api/Cdash/ExportFieldReportCsv — field detail grid export (all rows, supports isMapped + search). */
  async exportFieldReportCsv(params = {}) {
    const query = buildCdashReportQuery(params)
    const stamp = new Date().toISOString().replace(/[:.]/g, "-")
    return downloadCdashFile(
      API_CONFIG.ENDPOINTS.CDASH.EXPORT_FIELD_REPORT_CSV,
      Object.fromEntries(query.entries()),
      `cdash-field-report-study-${params.studyId}-${stamp}.csv`,
    )
  }

  /** GET /api/Cdash/ExportMappingReportZip */
  async exportMappingReportZip(params = {}) {
    const query = buildCdashReportQuery(params)
    return downloadCdashFile(
      API_CONFIG.ENDPOINTS.CDASH.EXPORT_MAPPING_REPORT_ZIP,
      Object.fromEntries(query.entries()),
      `cdash-mapping-report-study-${params.studyId}.zip`,
    )
  }

  /** @deprecated Use exportSubmittedDataCsv for submitted values; mapping exports use exportMapping* methods. */
  async exportCsv(params = {}) {
    return this.exportSubmittedDataCsv(params)
  }
}

const cdashService = new CdashService()
export default cdashService
