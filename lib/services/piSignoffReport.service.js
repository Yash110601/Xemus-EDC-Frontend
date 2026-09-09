/**
 * PI Sign-off Report — visit summary with completion counts.
 * GET /api/PiSignoffReport/visit-summary | /api/PiSignoffReport/filter-options
 */

import { API_CONFIG } from "../api/config"
import apiClient from "../api/client"
import logger from "../api/logger"
import { normalizeSdvFilterOptionsResponse } from "../reports/sdvReportFilterOptions"
import { normalizePiSignoffReportSummary } from "../reports/piSignoffReportDisplay"
import { buildSdvFilterOptionsQueryParams, buildSdvReportQueryParams } from "./sdvReport.service"

export function buildPiSignoffReportQueryParams(filters = {}, options = {}) {
  const params = buildSdvReportQueryParams(
    { ...filters, crfStatus: "Submitted", isSdvApproved: "" },
    options,
  )
  const status = String(filters.piSignoffStatus ?? "").trim()
  if (status && status !== "all") {
    params.set("piSignoffStatus", status)
  }
  return params
}

export function normalizePiSignoffReportPage(response) {
  const data = response?.data ?? response?.Data ?? {}
  const items = data.items ?? data.Items ?? []
  const summaryRaw = data.summary ?? data.Summary ?? null
  return {
    items: Array.isArray(items) ? items : [],
    summary: summaryRaw ? normalizePiSignoffReportSummary(summaryRaw) : null,
    pageNumber: Number(data.pageNumber ?? data.PageNumber ?? 1) || 1,
    pageSize: Number(data.pageSize ?? data.PageSize ?? 50) || 50,
    totalCount: Number(data.totalCount ?? data.TotalCount ?? 0) || 0,
    totalPages: Number(data.totalPages ?? data.TotalPages ?? 0) || 0,
  }
}

class PiSignoffReportService {
  async getFilterOptions(params = {}) {
    try {
      const query = buildSdvFilterOptionsQueryParams(params)
      const endpoint = `${API_CONFIG.ENDPOINTS.PI_SIGNOFF_REPORT.FILTER_OPTIONS}?${query.toString()}`
      const response = await apiClient.get(endpoint)
      if (response?.isSuccess) {
        return { ...response, normalized: normalizeSdvFilterOptionsResponse(response) }
      }
      throw new Error(response?.message || "Failed to load filter options")
    } catch (error) {
      logger.error("PI sign-off report getFilterOptions failed", error)
      throw error
    }
  }

  async getVisitSummary(filters = {}) {
    try {
      const query = buildPiSignoffReportQueryParams(filters, { includePaging: true })
      const endpoint = `${API_CONFIG.ENDPOINTS.PI_SIGNOFF_REPORT.VISIT_SUMMARY}?${query.toString()}`
      const response = await apiClient.get(endpoint)
      if (response?.isSuccess) {
        return response
      }
      throw new Error(response?.message || "Failed to load PI sign-off report")
    } catch (error) {
      logger.error("PI sign-off report getVisitSummary failed", error)
      throw error
    }
  }

  normalizeReportPage(response) {
    return normalizePiSignoffReportPage(response)
  }

  /**
   * @param {Record<string, unknown>} filters
   * @param {"csv"|"pdf"} format
   */
  async exportPiSignoffReport(filters = {}, format = "csv") {
    const token = localStorage.getItem("authToken")
    const query = buildPiSignoffReportQueryParams(filters, { includePaging: false })
    query.set("format", format === "pdf" ? "pdf" : "csv")
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PI_SIGNOFF_REPORT.EXPORT}?${query.toString()}`

    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    })

    const contentType = response.headers.get("content-type") ?? ""

    if (!response.ok) {
      if (contentType.includes("application/json")) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.message || body.Message || `Export failed (${response.status})`)
      }
      throw new Error(`Export failed (${response.status})`)
    }

    const blob = await response.blob()
    const dispo = response.headers.get("content-disposition") ?? ""
    const star = /filename\*=UTF-8''([^;]+)/i.exec(dispo)
    const plain = /filename="?([^";]+)"?/i.exec(dispo)
    const fromHeader = star?.[1] ? decodeURIComponent(star[1]) : plain?.[1]
    const ext = format === "pdf" ? "pdf" : "xlsx"
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "")
    const fileName = fromHeader || `pi-signoff-report-${stamp}.${ext}`

    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = downloadUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(downloadUrl)
  }
}

export default new PiSignoffReportService()
