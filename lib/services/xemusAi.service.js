/**
 * YP Intelligence — unified client for backend XemusAi + RSDV suggest APIs.
 */

import { API_CONFIG, STORAGE_KEYS } from "../api/config"
import apiClient from "../api/client"
import logger from "../api/logger"
import { normalizeSdvReportPage } from "./sdvReport.service"

function buildOversightQueryParams(filters = {}) {
  const params = new URLSearchParams()
  const studyId = parseInt(String(filters.studyId ?? ""), 10)
  if (!Number.isFinite(studyId) || studyId <= 0) {
    throw new Error("Study is required.")
  }
  params.set("studyId", String(studyId))

  const siteId = parseInt(String(filters.siteId ?? ""), 10)
  if (Number.isFinite(siteId) && siteId > 0) params.set("siteId", String(siteId))

  const module = String(filters.module ?? "").trim()
  if (module) {
    const normalized =
      module.toLowerCase() === "capture"
        ? "Capture"
        : module.toLowerCase() === "verify"
          ? "Verify"
          : module.charAt(0).toUpperCase() + module.slice(1)
    params.set("module", normalized)
  }

  const accepted = String(filters.accepted ?? "").trim()
  if (accepted === "true" || accepted === "false") params.set("accepted", accepted)

  const search = String(filters.search ?? "").trim()
  if (search) params.set("search", search)

  const pageNumber = parseInt(String(filters.pageNumber ?? 1), 10)
  const pageSize = parseInt(String(filters.pageSize ?? 50), 10)
  params.set("pageNumber", String(Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1))
  params.set(
    "pageSize",
    String(Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 200) : 50),
  )

  return params
}

class XemusAiService {
  /** POST /XemusAi/RecordAcceptance — log accept/reject for audit. */
  async recordAcceptance(payload = {}) {
    try {
      const response = await apiClient.post(API_CONFIG.ENDPOINTS.XEMUS_AI.RECORD_ACCEPTANCE, payload)
      if (response?.isSuccess) return response
      throw new Error(response?.message || "Failed to record AI acceptance")
    } catch (error) {
      logger.error("XemusAi recordAcceptance failed", error)
      throw error
    }
  }

  /** POST /XemusAi/RecordCaptureAcceptance — log + accept/reject in one call. */
  async recordCaptureAcceptance(payload = {}) {
    try {
      const response = await apiClient.post(
        API_CONFIG.ENDPOINTS.XEMUS_AI.RECORD_CAPTURE_ACCEPTANCE,
        payload,
      )
      if (response?.isSuccess) return response
      throw new Error(response?.message || "Failed to record capture acceptance")
    } catch (error) {
      logger.error("XemusAi recordCaptureAcceptance failed", error)
      throw error
    }
  }

  /** POST /XemusAi/LogSuggestion */
  async logSuggestion(payload = {}) {
    try {
      const response = await apiClient.post(API_CONFIG.ENDPOINTS.XEMUS_AI.LOG_SUGGESTION, payload)
      if (response?.isSuccess) return response
      throw new Error(response?.message || "Failed to log AI suggestion")
    } catch (error) {
      logger.error("XemusAi logSuggestion failed", error)
      throw error
    }
  }

  /** POST /XemusAi/ClassifyDocument */
  async classifyDocument(payload = {}) {
    try {
      const response = await apiClient.post(
        API_CONFIG.ENDPOINTS.XEMUS_AI.CLASSIFY_DOCUMENT,
        payload,
      )
      if (response?.isSuccess) return response
      return {
        isSuccess: false,
        message: response?.message || "Document classification unavailable",
        data: null,
      }
    } catch (error) {
      logger.error("XemusAi classifyDocument failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  /** POST /RsdvReview/BatchPageScan */
  async batchPageScan(payload = {}) {
    try {
      const response = await apiClient.post(
        API_CONFIG.ENDPOINTS.XEMUS_AI.BATCH_PAGE_SCAN,
        payload,
      )
      if (response?.isSuccess) return response
      return {
        isSuccess: false,
        message: response?.message || "Page scan unavailable",
        data: null,
      }
    } catch (error) {
      logger.error("XemusAi batchPageScan failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  /** POST /RsdvReview/SuggestSourceMatch */
  async suggestSourceMatch(payload = {}) {
    try {
      const response = await apiClient.post(
        API_CONFIG.ENDPOINTS.XEMUS_AI.SUGGEST_SOURCE_MATCH,
        payload,
      )
      if (response?.isSuccess) return response
      return {
        isSuccess: false,
        message: response?.message || "Source match suggestion unavailable",
        data: null,
      }
    } catch (error) {
      logger.error("XemusAi suggestSourceMatch failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  /** POST /RsdvReview/SuggestQuery */
  async suggestQuery(payload = {}) {
    try {
      const response = await apiClient.post(API_CONFIG.ENDPOINTS.XEMUS_AI.SUGGEST_QUERY, payload)
      if (response?.isSuccess) return response
      return {
        isSuccess: false,
        message: response?.message || "Query suggestion unavailable",
        data: null,
      }
    } catch (error) {
      logger.error("XemusAi suggestQuery failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  /** POST /XemusAi/AnalyzeCrfQuality */
  async analyzeCrfQuality(payload = {}) {
    try {
      const response = await apiClient.post(
        API_CONFIG.ENDPOINTS.XEMUS_AI.ANALYZE_CRF_QUALITY,
        payload,
      )
      if (response?.isSuccess) return response
      return { isSuccess: false, message: response?.message, data: { hints: [] } }
    } catch (error) {
      logger.error("XemusAi analyzeCrfQuality failed", error)
      return { isSuccess: false, message: error.message, data: { hints: [] } }
    }
  }

  /** POST /XemusAi/SuggestCoding */
  async suggestCoding(payload = {}) {
    try {
      const response = await apiClient.post(API_CONFIG.ENDPOINTS.XEMUS_AI.SUGGEST_CODING, payload)
      if (response?.isSuccess) return response
      return { isSuccess: false, message: response?.message, data: { suggestions: [] } }
    } catch (error) {
      logger.error("XemusAi suggestCoding failed", error)
      return { isSuccess: false, message: error.message, data: { suggestions: [] } }
    }
  }

  /** POST /XemusAi/GenerateMonitoringSummary */
  async generateMonitoringSummary(payload = {}) {
    try {
      const response = await apiClient.post(
        API_CONFIG.ENDPOINTS.XEMUS_AI.GENERATE_MONITORING_SUMMARY,
        payload,
      )
      if (response?.isSuccess) return response
      throw new Error(response?.message || "Monitoring summary unavailable")
    } catch (error) {
      logger.error("XemusAi generateMonitoringSummary failed", error)
      throw error
    }
  }

  /** POST /XemusAi/StudyAssistant */
  async studyAssistant(payload = {}) {
    try {
      const response = await apiClient.post(API_CONFIG.ENDPOINTS.XEMUS_AI.STUDY_ASSISTANT, payload)
      if (response?.isSuccess) return response
      throw new Error(response?.message || "Study assistant unavailable")
    } catch (error) {
      logger.error("XemusAi studyAssistant failed", error)
      throw error
    }
  }

  /** POST /XemusAi/GenerateConsentQuestions */
  async generateConsentQuestions(payload = {}) {
    try {
      const response = await apiClient.post(
        API_CONFIG.ENDPOINTS.XEMUS_AI.GENERATE_CONSENT_QUESTIONS,
        payload,
      )
      if (response?.isSuccess) return response
      throw new Error(response?.message || "Consent question generation failed")
    } catch (error) {
      logger.error("XemusAi generateConsentQuestions failed", error)
      throw error
    }
  }

  /** GET /XemusAi/OversightReport */
  async getOversightReport(filters = {}) {
    try {
      const query = buildOversightQueryParams(filters)
      const endpoint = `${API_CONFIG.ENDPOINTS.XEMUS_AI.OVERSIGHT_REPORT}?${query.toString()}`
      const response = await apiClient.get(endpoint)
      if (response?.isSuccess) return response
      throw new Error(response?.message || "Failed to load AI oversight report")
    } catch (error) {
      logger.error("XemusAi getOversightReport failed", error)
      throw error
    }
  }

  normalizeOversightPage(response) {
    return normalizeSdvReportPage(response)
  }

  async exportOversightReport(filters = {}, format = "csv") {
    if (format !== "csv") {
      throw new Error("PDF export is not available yet. Use CSV export.")
    }

    const query = buildOversightQueryParams({ ...filters, pageNumber: 1, pageSize: 50 })
    query.delete("pageNumber")
    query.delete("pageSize")

    const endpoint = `${API_CONFIG.ENDPOINTS.XEMUS_AI.OVERSIGHT_EXPORT}?${query.toString()}`
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) ||
          sessionStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
        : null

    const res = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      throw new Error(errText || `Export failed (${res.status})`)
    }

    const blob = await res.blob()
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "")
    const fileName = `ai-oversight-report-${stamp}.csv`
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

  /** Convenience: log capture accept with module constant. */
  async logCaptureAcceptance({ studyId, fieldId, accepted, confidence, entityId, requestJson }) {
    return this.recordCaptureAcceptance({
      studyId,
      fieldId,
      accepted,
      confidence,
      entityId,
      requestJson,
    })
  }
}

export default new XemusAiService()
