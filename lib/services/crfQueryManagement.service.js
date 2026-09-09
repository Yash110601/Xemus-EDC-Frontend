/**
 * CRF Query Management Service
 * - Creates system-generated queries for SOFT/WARNING rule violations.
 */

import apiClient from "../api/client"
import { API_CONFIG } from "../api/config"
import logger from "../api/logger"

/** CrfQueryStatus — align with backend (Open = 1, InProcess = 2, Closed = 3). */
export const CRF_QUERY_STATUS_FILTER = {
  OPEN: 1,
  IN_PROCESS: 2,
  CLOSED: 3,
}

/**
 * Build ?status=…&status=… for query list APIs (OR semantics). Omit for all non-deleted queries.
 * @param {number|string|Array<number|string>|undefined|null} status - one value or array (e.g. [1,2] for “active”).
 */
function buildStatusQueryString(status) {
  if (status == null) return ""
  const list = Array.isArray(status) ? status : [status]
  const params = new URLSearchParams()
  for (const s of list) {
    if (s === null || s === undefined || s === "") continue
    params.append("status", String(s))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ""
}

/**
 * @param {{ studyId: number|string, siteId: number|string, patientEnrolmentId: number|string, status?: number|string|Array<number|string> }} params
 */
function buildStudySitePatientQueryString(params = {}) {
  const { studyId, siteId, patientEnrolmentId, status } = params
  const search = new URLSearchParams()
  search.set("studyId", String(studyId))
  search.set("siteId", String(siteId))
  search.set("patientEnrolmentId", String(patientEnrolmentId))
  if (status != null) {
    const list = Array.isArray(status) ? status : [status]
    for (const s of list) {
      if (s === null || s === undefined || s === "") continue
      search.append("status", String(s))
    }
  }
  return `?${search.toString()}`
}

class CrfQueryManagementService {
  sanitizeManualCreatePayload(payload = {}) {
    return {
      studyId: payload.studyId,
      siteId: payload.siteId,
      patientEnrolmentId: payload.patientEnrolmentId,
      visitScheduleId: payload.visitScheduleId,
      crfDesignId: payload.crfDesignId,
      crfDataId: payload.crfDataId,
      fieldId: payload.fieldId,
      fieldLabel: payload.fieldLabel,
      queryText: payload.queryText,
      ...(payload.expectedCondition != null ? { expectedCondition: payload.expectedCondition } : {}),
      ...(payload.actualValue != null ? { actualValue: payload.actualValue } : {}),
      ...(payload.queryApproverComment != null
        ? { queryApproverComment: payload.queryApproverComment }
        : payload.reviewerComment != null
          ? { queryApproverComment: payload.reviewerComment }
          : {}),
    }
  }

  /**
   * POST /api/CrfQueryManagement/CreateSystemGeneratedQuery
   * @param {object} payload - CreateSystemCrfQueryRequest
   * @returns {Promise<{isSuccess:boolean,statusCode:number,data:any,message?:string,errors?:any[]}>}
   */
  async createSystemGeneratedQuery(payload) {
    try {
      return await apiClient.post(API_CONFIG.ENDPOINTS.CRF_QUERY_MANAGEMENT.CREATE_SYSTEM_GENERATED_QUERY, payload)
    } catch (error) {
      logger.error("CreateSystemGeneratedQuery failed", { error })
      return {
        isSuccess: false,
        statusCode: error?.httpStatus || error?.statusCode || 500,
        data: null,
        message: error?.message || "Failed to create system-generated query",
        errors: error?.errors || [],
      }
    }
  }

  /**
   * POST /api/CrfQueryManagement/CreateManualGeneratedQuery
   * @param {object} payload - CreateManualCrfQueryRequest
   */
  async createManualGeneratedQuery(payload) {
    try {
      const safePayload = this.sanitizeManualCreatePayload(payload)
      return await apiClient.post(
        API_CONFIG.ENDPOINTS.CRF_QUERY_MANAGEMENT.CREATE_MANUAL_GENERATED_QUERY,
        safePayload
      )
    } catch (error) {
      logger.error("CreateManualGeneratedQuery failed", { error })
      return {
        isSuccess: false,
        statusCode: error?.httpStatus || error?.statusCode || 500,
        data: null,
        message: error?.message || "Failed to create manual query",
        errors: error?.errors || [],
      }
    }
  }

  /**
   * GET /api/CrfQueryManagement/GetQueryListByCrfDataId/{crfDataId}
   * Optional query: repeat `status` for OR filter (e.g. Open|InProcess: ?status=1&status=2 or ?status=Open&status=InProcess).
   * No status → all non-deleted queries for that CRF data row.
   * @param {number|string} crfDataId
   * @param {{ status?: number|string|Array<number|string> }} [options]
   */
  async getQueryListByCrfDataId(crfDataId, options = {}) {
    try {
      const qs = buildStatusQueryString(options?.status)
      const url =
        API_CONFIG.ENDPOINTS.CRF_QUERY_MANAGEMENT.GET_QUERY_LIST_BY_CRF_DATA_ID(crfDataId) + qs
      return await apiClient.get(url)
    } catch (error) {
      logger.error("GetQueryListByCrfDataId failed", { error })
      return {
        isSuccess: false,
        statusCode: error?.httpStatus || error?.statusCode || 500,
        data: [],
        message: error?.message || "Failed to load CRF queries",
        errors: error?.errors || [],
      }
    }
  }

  /**
   * GET /api/CrfQueryManagement/GetQueryListByStudySitePatient
   * Required: studyId, siteId, patientEnrolmentId. Optional repeated `status` (OR).
   * Returns all non-deleted queries for that patient in the study/site (all CRF data rows).
   * @param {{ studyId: number|string, siteId: number|string, patientEnrolmentId: number|string, status?: number|string|Array<number|string> }} params
   */
  async getQueryListByStudySitePatient(params = {}) {
    try {
      const { studyId, siteId, patientEnrolmentId, status } = params
      if (
        studyId == null ||
        siteId == null ||
        patientEnrolmentId == null ||
        studyId === "" ||
        siteId === "" ||
        patientEnrolmentId === ""
      ) {
        return {
          isSuccess: false,
          statusCode: 400,
          data: [],
          message: "studyId, siteId, and patientEnrolmentId are required",
          errors: [],
        }
      }
      const qs = buildStudySitePatientQueryString({ studyId, siteId, patientEnrolmentId, status })
      const url =
        API_CONFIG.ENDPOINTS.CRF_QUERY_MANAGEMENT.GET_QUERY_LIST_BY_STUDY_SITE_PATIENT + qs
      return await apiClient.get(url)
    } catch (error) {
      logger.error("GetQueryListByStudySitePatient failed", { error })
      return {
        isSuccess: false,
        statusCode: error?.httpStatus || error?.statusCode || 500,
        data: [],
        message: error?.message || "Failed to load CRF queries for patient",
        errors: error?.errors || [],
      }
    }
  }

  /**
   * POST /api/CrfQueryManagement/UpdateReviewer
   * @param {{ queryId: number, queryApproverComment?: string|null }} payload
   */
  async updateReviewer(payload) {
    try {
      const body = {
        queryId: payload?.queryId,
        queryApproverComment:
          payload?.queryApproverComment ??
          payload?.reviewerComment ??
          null,
      }
      return await apiClient.post(API_CONFIG.ENDPOINTS.CRF_QUERY_MANAGEMENT.UPDATE_REVIEWER, body)
    } catch (error) {
      logger.error("UpdateReviewer query failed", { error })
      return {
        isSuccess: false,
        statusCode: error?.httpStatus || error?.statusCode || 500,
        data: null,
        message: error?.message || "Failed to update query",
        errors: error?.errors || [],
      }
    }
  }

  /**
   * POST /api/CrfQueryManagement/UpdateSubmittedUserComment
   * @param {{
   *   queryId: number,
   *   crfSubmitterComment?: string|null,
   *   actualValue?: string|null,
   *   correctedFieldValue?: string|null,
   * }} payload
   * - actualValue: updates the query’s actualValue snapshot (include key to set/clear).
   * - correctedFieldValue: when not null, server patches CrfData.FormData for this query’s fieldId only.
   */
  async updateSubmittedUserComment(payload) {
    try {
      const body = {
        queryId: payload?.queryId,
        crfSubmitterComment:
          payload?.crfSubmitterComment ??
          payload?.submittedUserComment ??
          null,
        actualValue:
          payload?.actualValue ?? payload?.ActualValue ?? null,
        correctedFieldValue:
          payload?.correctedFieldValue ?? payload?.CorrectedFieldValue ?? null,
      }
      return await apiClient.post(
        API_CONFIG.ENDPOINTS.CRF_QUERY_MANAGEMENT.UPDATE_SUBMITTED_USER_COMMENT,
        body
      )
    } catch (error) {
      logger.error("UpdateSubmittedUserComment query failed", { error })
      return {
        isSuccess: false,
        statusCode: error?.httpStatus || error?.statusCode || 500,
        data: null,
        message: error?.message || "Failed to update submitted user comment",
        errors: error?.errors || [],
      }
    }
  }

  /**
   * POST /api/CrfQueryManagement/UpdateStatus
   * @param {{ queryId: number, status: number }} payload
   */
  async updateStatus(payload) {
    try {
      return await apiClient.post(API_CONFIG.ENDPOINTS.CRF_QUERY_MANAGEMENT.UPDATE_STATUS, payload)
    } catch (error) {
      logger.error("UpdateStatus query failed", { error })
      return {
        isSuccess: false,
        statusCode: error?.httpStatus || error?.statusCode || 500,
        data: null,
        message: error?.message || "Failed to update query status",
        errors: error?.errors || [],
      }
    }
  }

  /**
   * @param {string} yyyyMmDd
   * @returns {string} ISO UTC start-of-day or empty if invalid
   */
  yyyyMmDdToStartUtcIso(yyyyMmDd) {
    const s = String(yyyyMmDd || "").trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return ""
    return `${s}T00:00:00.000Z`
  }

  /**
   * @param {string} yyyyMmDd
   * @returns {string} ISO UTC end-of-day or empty if invalid
   */
  yyyyMmDdToEndUtcIso(yyyyMmDd) {
    const s = String(yyyyMmDd || "").trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return ""
    return `${s}T23:59:59.999Z`
  }

  /**
   * Build GET query for `/CrfQueryManagement/Report` and `/Report/Export`.
   * camelCase only. Never send `siteId` without `studyId` (API 400).
   * UI `filters.patientId` holds patient enrolment id from dropdown → `patientEnrolmentId`.
   *
   * @param {object} filters
   * @param {{ includePaging?: boolean }} [options] Export uses includePaging: false
   * @returns {URLSearchParams}
   */
  buildCrfQueryReportParams(filters = {}, { includePaging = true } = {}) {
    const params = new URLSearchParams()
    const appendIfPresent = (key, value) => {
      if (value === undefined || value === null) return
      const str = String(value).trim()
      if (!str) return
      params.append(key, str)
    }

    const studyId = String(filters.studyId ?? "").trim()
    const siteId = String(filters.siteId ?? "").trim()
    if (siteId && !studyId) {
      throw new Error("siteId requires studyId")
    }
    if (studyId) params.append("studyId", studyId)
    if (siteId) params.append("siteId", siteId)

    const enrolmentId = String(filters.patientId ?? filters.patientEnrolmentId ?? "").trim()
    if (enrolmentId) appendIfPresent("patientEnrolmentId", enrolmentId)

    appendIfPresent("visitScheduleId", filters.visitScheduleId)
    appendIfPresent("crfDesignId", filters.crfDesignId)
    appendIfPresent("crfDataId", filters.crfDataId)
    appendIfPresent("queryType", filters.queryType)

    if (filters.status != null) {
      const list = Array.isArray(filters.status) ? filters.status : [filters.status]
      for (const s of list) {
        if (s === null || s === undefined || s === "") continue
        params.append("status", String(s))
      }
    }

    const searchText = String(filters.search ?? filters.searchEntityName ?? "").trim()
    if (searchText) params.append("search", searchText)

    const fromIso = this.yyyyMmDdToStartUtcIso(filters.dateFrom)
    const toIso = this.yyyyMmDdToEndUtcIso(filters.dateTo)
    if (fromIso) params.append("createdFromUtc", fromIso)
    if (toIso) params.append("createdToUtc", toIso)

    const queryAgeFilter = String(filters.queryAgeFilter ?? "All").trim()
    if (queryAgeFilter && queryAgeFilter !== "All") {
      params.append("queryAgeFilter", queryAgeFilter)
    }

    if (includePaging) {
      const pn = Math.max(1, parseInt(String(filters.pageNumber || 1), 10) || 1)
      let ps = parseInt(String(filters.pageSize || 50), 10) || 50
      if (ps < 1) ps = 1
      if (ps > 200) ps = 200
      params.append("pageNumber", String(pn))
      params.append("pageSize", String(ps))
    }

    return params
  }

  /**
   * Normalizes `{ items, totalCount, totalPages }` from ApiResponse `data`.
   */
  normalizeCrfQueryReportPage(response) {
    const data = response?.data ?? {}
    const items = Array.isArray(data.items)
      ? data.items
      : Array.isArray(data.Items)
        ? data.Items
        : []
    const totalCount = Number(data.totalCount ?? data.TotalCount ?? 0)
    const totalPages = Number(data.totalPages ?? data.TotalPages ?? 0)
    return {
      items,
      totalCount: Number.isFinite(totalCount) ? totalCount : 0,
      totalPages: Number.isFinite(totalPages) ? totalPages : 0,
    }
  }

  /**
   * GET /api/CrfQueryManagement/GetDashboardSummary — study/site query counts.
   */
  async getDashboardSummary(studyId, siteId = null) {
    const params = new URLSearchParams()
    const sid = String(studyId ?? "").trim()
    if (!sid) {
      throw new Error("studyId is required")
    }
    params.set("studyId", sid)
    const parsedSite = String(siteId ?? "").trim()
    if (parsedSite) params.set("siteId", parsedSite)

    try {
      const endpoint = `${API_CONFIG.ENDPOINTS.CRF_QUERY_MANAGEMENT.GET_DASHBOARD_SUMMARY}?${params.toString()}`
      const response = await apiClient.get(endpoint)
      if (response?.isSuccess) return response
      throw new Error(response?.message || "Failed to load query dashboard summary")
    } catch (error) {
      logger.error("Error in getDashboardSummary", error)
      throw error
    }
  }

  /**
   * GET /api/CrfQueryManagement/Report — paged list (feature CRF_DATA, View).
   */
  async getCrfQueryReport(filters = {}) {
    try {
      const queryParams = this.buildCrfQueryReportParams(filters, { includePaging: true })
      const endpoint = `${API_CONFIG.ENDPOINTS.CRF_QUERY_MANAGEMENT.REPORT}?${queryParams.toString()}`
      const response = await apiClient.get(endpoint)
      if (response?.isSuccess) {
        return response
      }
      throw new Error(response?.message || "Failed to load CRF query report")
    } catch (error) {
      logger.error("Error in getCrfQueryReport", error)
      throw error
    }
  }

  /**
   * GET /api/CrfQueryManagement/Report/Export — CSV blob (feature CRF_DATA, Export).
   */
  async exportCrfQueryReport(filters = {}) {
    try {
      const queryParams = this.buildCrfQueryReportParams(filters, { includePaging: false })
      const token = localStorage.getItem("authToken")
      const baseUrl = API_CONFIG.BASE_URL
      const endpoint = API_CONFIG.ENDPOINTS.CRF_QUERY_MANAGEMENT.REPORT_EXPORT
      const url = `${baseUrl}${endpoint}?${queryParams.toString()}`

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.message || errorData?.Message || "Export failed")
      }

      const blob = await response.blob()
      const fileName = `crf-query-report-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.xlsx`
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = downloadUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(downloadUrl)
      return { success: true, filename: fileName }
    } catch (error) {
      logger.error("Error in exportCrfQueryReport", error)
      throw error
    }
  }
}

export default new CrfQueryManagementService()

