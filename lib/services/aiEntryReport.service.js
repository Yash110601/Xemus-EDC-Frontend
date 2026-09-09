/**
 * AI Entry Report — field grid, visit summary, export.
 * GET /api/AiEntryReport | /visit-summary | /export
 */

import { API_CONFIG } from "../api/config"
import apiClient from "../api/client"
import logger from "../api/logger"
import { normalizeSdvReportPage } from "./sdvReport.service"

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

function toUtcDayBound(dateText, endOfDay) {
  const raw = String(dateText ?? "").trim()
  if (!raw) return ""
  if (/T/.test(raw) || /Z$/i.test(raw)) return raw
  const day = raw.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return raw
  return endOfDay ? `${day}T23:59:59.999Z` : `${day}T00:00:00.000Z`
}

/**
 * @param {Record<string, unknown>} filters
 * @param {{ includePaging?: boolean, forVisitSummary?: boolean }} [options]
 */
export function buildAiEntryReportQueryParams(filters = {}, options = {}) {
  const { includePaging = true, forVisitSummary = false } = options
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
  if (crfStatus === "1" || crfStatus === "2" || crfStatus === "3") {
    params.set("crfStatus", crfStatus)
  } else if (/^(draft|saved|submitted)$/i.test(crfStatus)) {
    const map = { draft: "1", saved: "2", submitted: "3" }
    params.set("crfStatus", map[crfStatus.toLowerCase()])
  }

  if (!forVisitSummary) {
    const isAiBasedEntry = String(filters.isAiBasedEntry ?? "").trim()
    if (isAiBasedEntry === "true" || isAiBasedEntry === "false") {
      params.set("isAiBasedEntry", isAiBasedEntry)
    }

    const aiEntryBy = parseInt(String(filters.aiEntryBy ?? ""), 10)
    if (Number.isFinite(aiEntryBy) && aiEntryBy > 0) {
      params.set("aiEntryBy", String(aiEntryBy))
    }
  }

  const aiEntryType = String(filters.aiEntryType ?? "").trim()
  if (aiEntryType === "1" || aiEntryType === "2") {
    params.set("aiEntryType", aiEntryType)
  }

  const fromUtc = toUtcDayBound(filters.aiEntryFromUtc, false)
  if (fromUtc) params.set("aiEntryFromUtc", fromUtc)

  const toUtc = toUtcDayBound(filters.aiEntryToUtc, true)
  if (toUtc) params.set("aiEntryToUtc", toUtc)

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

class AiEntryReportService {
  async getVisitSummary(filters = {}) {
    try {
      const query = buildAiEntryReportQueryParams(filters, {
        includePaging: true,
        forVisitSummary: true,
      })
      const endpoint = `${API_CONFIG.ENDPOINTS.AI_ENTRY_REPORT.VISIT_SUMMARY}?${query.toString()}`
      const response = await apiClient.get(endpoint)
      if (response?.isSuccess) return response
      throw new Error(response?.message || "Failed to load AI entry visit summary")
    } catch (error) {
      logger.error("AiEntryReport getVisitSummary failed", error)
      throw error
    }
  }

  async getFieldReport(filters = {}) {
    try {
      const query = buildAiEntryReportQueryParams(filters, { includePaging: true })
      const endpoint = `${API_CONFIG.ENDPOINTS.AI_ENTRY_REPORT.BASE}?${query.toString()}`
      const response = await apiClient.get(endpoint)
      if (response?.isSuccess) return response
      throw new Error(response?.message || "Failed to load AI entry field report")
    } catch (error) {
      logger.error("AiEntryReport getFieldReport failed", error)
      throw error
    }
  }

  normalizePage(response) {
    return normalizeSdvReportPage(response)
  }

  /**
   * @param {Record<string, unknown>} filters
   * @param {"csv"|"pdf"} format
   */
  async exportAiEntryReport(filters = {}, format = "csv") {
    const token = localStorage.getItem("authToken")
    const query = buildAiEntryReportQueryParams(filters, { includePaging: false })
    query.set("format", format === "pdf" ? "pdf" : "csv")
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AI_ENTRY_REPORT.EXPORT}?${query.toString()}`

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
    const ext = format === "pdf" ? "pdf" : "csv"
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "")
    const fallback = `ai-entry-report-${stamp}.${ext}`
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

export default new AiEntryReportService()
