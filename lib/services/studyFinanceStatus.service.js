import { API_CONFIG, STORAGE_KEYS } from "../api/config"
import apiClient from "../api/client"
import logger from "../api/logger"

/**
 * Format date for API: YYYY-MM-DD. Pass through if already string, else format Date.
 */
function toDateParam(value) {
  if (!value) return ""
  if (typeof value === "string") return value.trim()
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  return ""
}

class StudyFinanceStatusService {
  /**
   * Get study finance/status summary counts for a study.
   * GET api/StudyFinanceStatus/StudyFinanceStatuscount?studyId=...
   */
  async getSummary(studyId) {
    if (!studyId) {
      throw new Error("studyId is required to fetch finance status summary.")
    }

    try {
      const query = new URLSearchParams({ studyId: String(studyId) })
      const res = await apiClient.get(
        `${API_CONFIG.ENDPOINTS.STUDY_FINANCE_STATUS.SUMMARY}?${query.toString()}`
      )
      if (!res?.isSuccess) {
        throw new Error(res?.message || "Failed to fetch study finance status summary.")
      }
      return res.data || res
    } catch (error) {
      logger.error("Error fetching study finance status summary", error)
      throw error
    }
  }

  /**
   * Get paged finance/status list for a study.
   * GET api/StudyFinanceStatus/StudyFinanceStatuslist
   * CRC Status: send "status" only when not None/empty. Dates: YYYY-MM-DD.
   *
   * Performance: response time is dominated by the API/DB. If this endpoint is slow (>1s),
   * profile the .NET handler and SQL (indexes, N+1, includes). The frontend only cancels stale requests.
   */
  async getList({
    studyId,
    pageNumber = 1,
    pageSize = 10,
    search = "",
    status = "",
    agreementDateFrom = "",
    agreementDateTo = "",
    completionDateFrom = "",
    completionDateTo = "",
    signal,
  }) {
    if (!studyId) {
      throw new Error("studyId is required to fetch finance status list.")
    }

    try {
      const query = new URLSearchParams({
        studyId: String(studyId),
        pageNumber: String(pageNumber),
        pageSize: String(Math.min(Number(pageSize) || 10, 100)),
      })

      if (search && search.trim()) query.append("search", search.trim())
      if (status && status.trim() && status !== "None") query.append("status", status.trim())

      const from = toDateParam(agreementDateFrom)
      const to = toDateParam(agreementDateTo)
      if (from) query.append("agreementDateFrom", from)
      if (to) query.append("agreementDateTo", to)
      const cFrom = toDateParam(completionDateFrom)
      const cTo = toDateParam(completionDateTo)
      if (cFrom) query.append("completionDateFrom", cFrom)
      if (cTo) query.append("completionDateTo", cTo)

      const res = await apiClient.get(`${API_CONFIG.ENDPOINTS.STUDY_FINANCE_STATUS.LIST}?${query.toString()}`, {
        signal,
      })
      if (!res?.isSuccess) {
        throw new Error(res?.message || "Failed to fetch study finance status list.")
      }
      return res.data || res
    } catch (error) {
      logger.error("Error fetching study finance status list", error)
      throw error
    }
  }

  /**
   * Export Study Finance Status as CSV (same filters as list, no pagination).
   * GET api/StudyFinanceStatus/Export
   *
   * When the study has payment rules configured, milestone Status / payment rows use
   * SitePaymentRuleProgressId. Legacy studies still export SiteMilestoneId / SiteVisitId.
   */
  async exportCsv({
    studyId,
    search = "",
    status = "",
    agreementDateFrom = "",
    agreementDateTo = "",
    completionDateFrom = "",
    completionDateTo = "",
    format = "csv",
  }) {
    if (!studyId) {
      throw new Error("studyId is required to export study finance status.")
    }

    const query = new URLSearchParams({ studyId: String(studyId) })
    if (search && search.trim()) query.append("search", search.trim())
    if (status && status.trim() && status !== "None") query.append("status", status.trim())
    const from = toDateParam(agreementDateFrom)
    const to = toDateParam(agreementDateTo)
    if (from) query.append("agreementDateFrom", from)
    if (to) query.append("agreementDateTo", to)
    const cFrom = toDateParam(completionDateFrom)
    const cTo = toDateParam(completionDateTo)
    if (cFrom) query.append("completionDateFrom", cFrom)
    if (cTo) query.append("completionDateTo", cTo)
    if (format && String(format).toLowerCase() !== "csv") {
      query.append("format", String(format).toLowerCase())
    }

    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.STUDY_FINANCE_STATUS.EXPORT}?${query.toString()}`
    const token = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) : null

    const response = await fetch(url, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `Export failed with status ${response.status}`)
    }

    const blob = await response.blob()
    const contentDisposition = response.headers.get("Content-Disposition")
    let filename = `study-finance-status-study-${studyId}-${new Date().toISOString().slice(0, 10)}.${String(format).toLowerCase() === "xlsx" ? "xlsx" : "csv"}`
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?(.+)"?/i)
      if (match) filename = match[1].replace(/"/g, "")
    }

    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = downloadUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    window.URL.revokeObjectURL(downloadUrl)
    document.body.removeChild(link)

    logger.info("Study finance status exported successfully", { filename })
    return { success: true, filename }
  }

  /**
   * Export milestone / visit finance grid as Excel (.xlsx).
   * Uses the same API as CSV with format=xlsx (wide layout for milestone-based studies).
   */
  async exportMilestoneExcel(options) {
    return this.exportCsv({ ...options, format: "xlsx" })
  }

  /**
   * Update cheque/payment details for a single logical row.
   * PATCH api/StudyFinanceStatus/PaymentDetails
   *
   * Payload (all study types share same shape):
   * {
   *   studyId,
   *   studyUserId,
   *   sitePaymentRuleProgressId,
   *   siteMilestoneId,
   *   siteVisitId,
   *   chequeNumber,
   *   documentNumber,
   *   dateOfIssue,
   *   chequeReceivedDate
   * }
   *
   * API returns updated StudyProgressListItemDto (same shape as list row).
   */
  async updateChequeDetails(payload) {
    try {
      const response = await apiClient.patch(
        `${API_CONFIG.ENDPOINTS.STUDY_PAYMENTS.PAYMENT_DETAILS}`,
        payload
      )

      if (!response?.isSuccess) {
        logger.error("Update cheque details failed", {
          statusCode: response?.statusCode,
          message: response?.message,
          data: response?.data,
        })
      }

      return response
    } catch (error) {
      logger.error("Update cheque details failed", error)
      throw error
    }
  }

  /**
   * Export all signed agreements for a study as a ZIP.
   * GET api/StudyFinanceStatus/ExportAgreementsZip?studyId={studyId}
   * Frontend only needs to send studyId.
   */
  async exportAgreementsZip(studyId) {
    if (!studyId) {
      throw new Error("studyId is required to export agreements ZIP.")
    }

    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.STUDY_FINANCE_STATUS.EXPORT_ZIP}?studyId=${studyId}`
    const token = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) : null

    const response = await fetch(url, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `ZIP export failed with status ${response.status}`)
    }

    const blob = await response.blob()
    const contentDisposition = response.headers.get("Content-Disposition")
    let filename = `study-${studyId}-agreements.zip`
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?(.+)"?/i)
      if (match) filename = match[1].replace(/"/g, "")
    }

    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = downloadUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    window.URL.revokeObjectURL(downloadUrl)
    document.body.removeChild(link)

    logger.info("Study agreements ZIP exported successfully", { filename })
    return { success: true, filename }
  }

  /**
   * Download bulk payment template CSV for a study.
   * GET api/StudyPayments/ExportPaymentTemplate?studyId={studyId}
   *
   * Studies with payment rules: Id = SitePaymentRuleProgressId, StudyUserId on every row.
   * Legacy studies: Id = SiteMilestoneId or SiteVisitId (no progress id column).
   */
  async exportPaymentTemplate(studyId) {
    if (!studyId) {
      throw new Error("studyId is required to export payment template.")
    }

    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.STUDY_PAYMENTS.EXPORT_PAYMENT_TEMPLATE}?studyId=${studyId}`
    const token =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) : null

    const response = await fetch(url, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        errorData.message || `Payment template export failed with status ${response.status}`
      )
    }

    const blob = await response.blob()
    const contentDisposition = response.headers.get("Content-Disposition")
    let filename = `payment-template-${studyId}.csv`
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?(.+)"?/i)
      if (match) filename = match[1].replace(/"/g, "")
    }

    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = downloadUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    window.URL.revokeObjectURL(downloadUrl)
    document.body.removeChild(link)

    logger.info("Payment template exported successfully", { filename })
    return { success: true, filename }
  }

  /**
   * Import bulk payment details from CSV for a study.
   * POST api/StudyPayments/ImportPaymentDetails?studyId={studyId}
   *
   * Row Id maps to SitePaymentRuleProgressId when the study has payment rules;
   * otherwise SiteMilestoneId / SiteVisitId. StudyUserId is required on every row.
   */
  async importPaymentDetails(studyId, file) {
    if (!studyId || !file) {
      throw new Error("studyId and file are required to import payment details.")
    }

    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.STUDY_PAYMENTS.IMPORT_PAYMENT_DETAILS}`
    const token =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) : null

    const formData = new FormData()
    formData.append("studyId", String(studyId))
    formData.append("file", file)

    const response = await fetch(url, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      const message = data?.message || `Import failed with status ${response.status}`
      throw new Error(message)
    }

    logger.info("Payment details imported successfully", data)
    return data
  }
}

const studyFinanceStatusService = new StudyFinanceStatusService()
export default studyFinanceStatusService

