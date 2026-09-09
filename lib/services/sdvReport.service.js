/**
 * SDV Report — visit summary, field-level list, CSV/PDF export.
 * GET /api/SdvReport/visit-summary | /api/SdvReport | /api/SdvReport/export
 */

import { API_CONFIG } from "../api/config"
import apiClient from "../api/client"
import logger from "../api/logger"
import { normalizeSdvFilterOptionsResponse } from "../reports/sdvReportFilterOptions"
import { normalizeSdvReportSummary } from "../reports/piSignoffReportDisplay"

function parseFilenameFromContentDisposition(headerValue) {
  if (!headerValue) return null
  const star = /filename\*=UTF-8''([^;]+)/i.exec(headerValue)
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].replace(/(^")|("$)/g, ""))
    } catch {
      return star[1]
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(headerValue)
  return plain?.[1] ?? null
}

/**
 * @param {Record<string, unknown>} filters
 * @param {{ includePaging?: boolean }} [options]
 */
export function buildSdvReportQueryParams(filters = {}, options = {}) {
  const { includePaging = true } = options
  const params = new URLSearchParams()

  const studyId = parseInt(String(filters.studyId ?? ""), 10)
  if (!Number.isFinite(studyId) || studyId <= 0) {
    throw new Error("Study is required.")
  }
  params.set("studyId", String(studyId))

  const siteId = parseInt(String(filters.siteId ?? ""), 10)
  if (Number.isFinite(siteId) && siteId > 0) {
    params.set("siteId", String(siteId))
  }

  const visitScheduleId = parseInt(String(filters.visitScheduleId ?? ""), 10)
  if (Number.isFinite(visitScheduleId) && visitScheduleId > 0) {
    params.set("visitScheduleId", String(visitScheduleId))
  }

  const patientEnrolmentId = parseInt(String(filters.patientEnrolmentId ?? ""), 10)
  if (Number.isFinite(patientEnrolmentId) && patientEnrolmentId > 0) {
    params.set("patientEnrolmentId", String(patientEnrolmentId))
  }

  const crfDesignId = parseInt(String(filters.crfDesignId ?? ""), 10)
  if (Number.isFinite(crfDesignId) && crfDesignId > 0) {
    params.set("crfDesignId", String(crfDesignId))
  }

  const crfStatus = String(filters.crfStatus ?? "").trim()
  if (crfStatus === "Saved" || crfStatus === "Submitted") {
    params.set("crfStatus", crfStatus)
  }

  const isSdvApproved = String(filters.isSdvApproved ?? "").trim()
  if (isSdvApproved === "true" || isSdvApproved === "false") {
    params.set("isSdvApproved", isSdvApproved)
  }

  const search = String(filters.search ?? "").trim()
  if (search) {
    params.set("search", search)
  }

  if (includePaging) {
    const pageNumber = parseInt(String(filters.pageNumber ?? 1), 10)
    const pageSize = parseInt(String(filters.pageSize ?? 50), 10)
    params.set("pageNumber", String(Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1))
    const cappedSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 200) : 50
    params.set("pageSize", String(cappedSize))
  }

  return params
}

export function normalizeSdvReportPage(response) {
  const data = response?.data ?? response?.Data ?? {}
  const items = data.items ?? data.Items ?? []
  const summaryRaw = data.summary ?? data.Summary ?? null
  return {
    items: Array.isArray(items) ? items : [],
    summary: summaryRaw ? normalizeSdvReportSummary(summaryRaw) : null,
    pageNumber: Number(data.pageNumber ?? data.PageNumber ?? 1) || 1,
    pageSize: Number(data.pageSize ?? data.PageSize ?? 50) || 50,
    totalCount: Number(data.totalCount ?? data.TotalCount ?? 0) || 0,
    totalPages: Number(data.totalPages ?? data.TotalPages ?? 0) || 0,
  }
}

/**
 * @param {{ studyId: string|number, siteId?: string|number, patientEnrolmentId?: string|number, visitScheduleId?: string|number }} params
 */
export function buildSdvFilterOptionsQueryParams(params = {}) {
  const query = new URLSearchParams()
  const studyId = parseInt(String(params.studyId ?? ""), 10)
  if (!Number.isFinite(studyId) || studyId <= 0) {
    throw new Error("Study is required.")
  }
  query.set("studyId", String(studyId))

  const siteId = parseInt(String(params.siteId ?? ""), 10)
  if (Number.isFinite(siteId) && siteId > 0) {
    query.set("siteId", String(siteId))
  }

  const patientEnrolmentId = parseInt(String(params.patientEnrolmentId ?? ""), 10)
  if (Number.isFinite(patientEnrolmentId) && patientEnrolmentId > 0) {
    query.set("patientEnrolmentId", String(patientEnrolmentId))
  }

  const visitScheduleId = parseInt(String(params.visitScheduleId ?? ""), 10)
  if (Number.isFinite(visitScheduleId) && visitScheduleId > 0) {
    query.set("visitScheduleId", String(visitScheduleId))
  }

  return query
}

class SdvReportService {
  /**
   * Cascading dropdown options (study → site → patient → visit → CRF forms).
   */
  async getFilterOptions(params = {}) {
    try {
      const query = buildSdvFilterOptionsQueryParams(params)
      const endpoint = `${API_CONFIG.ENDPOINTS.SDV_REPORT.FILTER_OPTIONS}?${query.toString()}`
      const response = await apiClient.get(endpoint)
      if (response?.isSuccess) {
        return { ...response, normalized: normalizeSdvFilterOptionsResponse(response) }
      }
      throw new Error(response?.message || "Failed to load filter options")
    } catch (error) {
      logger.error("getFilterOptions failed", error)
      throw error
    }
  }

  normalizeFilterOptions(response) {
    return normalizeSdvFilterOptionsResponse(response)
  }

  async getVisitSummary(filters = {}) {
    try {
      const query = buildSdvReportQueryParams(filters, { includePaging: true })
      const endpoint = `${API_CONFIG.ENDPOINTS.SDV_REPORT.VISIT_SUMMARY}?${query.toString()}`
      const response = await apiClient.get(endpoint)
      if (response?.isSuccess) {
        return response
      }
      throw new Error(response?.message || "Failed to load SDV visit summary")
    } catch (error) {
      logger.error("getVisitSummary failed", error)
      throw error
    }
  }

  async getFieldReport(filters = {}) {
    try {
      const query = buildSdvReportQueryParams(filters, { includePaging: true })
      const endpoint = `${API_CONFIG.ENDPOINTS.SDV_REPORT.BASE}?${query.toString()}`
      const response = await apiClient.get(endpoint)
      if (response?.isSuccess) {
        return response
      }
      throw new Error(response?.message || "Failed to load SDV field report")
    } catch (error) {
      logger.error("getFieldReport failed", error)
      throw error
    }
  }

  normalizeSdvReportPage(response) {
    return normalizeSdvReportPage(response)
  }

  /**
   * @param {Record<string, unknown>} filters
   * @param {"csv"|"pdf"} format
   */
  async exportSdvReport(filters = {}, format = "csv") {
    const token = localStorage.getItem("authToken")
    const query = buildSdvReportQueryParams(filters, { includePaging: false })
    query.set("format", format === "pdf" ? "pdf" : "csv")
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SDV_REPORT.EXPORT}?${query.toString()}`

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const contentType = response.headers.get("content-type") ?? ""

    if (!response.ok) {
      if (contentType.includes("application/json")) {
        const body = await response.json().catch(() => ({}))
        const msg = body.message || body.Message || `Export failed (${response.status})`
        throw new Error(msg)
      }
      throw new Error(`Export failed (${response.status})`)
    }

    const blob = await response.blob()
    const dispo = response.headers.get("content-disposition") ?? ""
    const fromHeader = parseFilenameFromContentDisposition(dispo)
    const ext = format === "pdf" ? "pdf" : "xlsx"
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "")
    const fallback = `sdv-report-${stamp}.${ext}`
    const fileName = fromHeader || fallback

    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = downloadUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(downloadUrl)
    return { success: true, filename: fileName }
  }
}

export default new SdvReportService()
