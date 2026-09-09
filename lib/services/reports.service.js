/**
 * Reports Service
 * Handles report operations including study details report
 */

import apiClient from "../api/client"
import { API_CONFIG } from "../api/config"
import logger from "../api/logger"

function reportTabularExportExtension(format) {
  return format === "pdf" ? "pdf" : "xlsx"
}

/** Append download-dialog PDF page options to an export query string. */
function appendPdfPageOptions(queryParams, { format, pageSize, orientation } = {}) {
  if (String(format || "").toLowerCase() !== "pdf") return
  if (pageSize) queryParams.append("pdfPageSize", String(pageSize))
  if (orientation) queryParams.append("pdfOrientation", String(orientation))
}

class ReportsService {
  /**
   * Get Study Details Report (Paginated)
   * @param {Object} params - Query parameters
   * @param {number} params.pageNumber - Page number (default: 1)
   * @param {number} params.pageSize - Items per page (default: 10)
   * @param {number} params.studyId - Filter by study ID (optional)
   * @param {Date} params.startDate - Filter from date (optional)
   * @param {Date} params.endDate - Filter to date (optional)
   * @param {string} params.search - Search term (optional)
   * @returns {Promise<Object>} Paged result with study details
   */
  async getStudyDetailsReport(params = {}) {
    try {
      const {
        pageNumber = 1,
        pageSize = 10,
        studyId,
        startDate,
        endDate,
        search,
      } = params

      const queryParams = new URLSearchParams({
        pageNumber: pageNumber.toString(),
        pageSize: pageSize.toString(),
      })

      if (studyId) {
        queryParams.append("studyId", studyId.toString())
      }

      if (startDate) {
        queryParams.append("startDate", startDate.toISOString())
      }

      if (endDate) {
        queryParams.append("endDate", endDate.toISOString())
      }

      if (search) {
        queryParams.append("search", search)
      }

      const response = await apiClient.get(
        `${API_CONFIG.ENDPOINTS.REPORTS.STUDY_DETAILS}?${queryParams.toString()}`
      )

      if (response.isSuccess) {
        logger.info("Study details report retrieved successfully", response.data)
        return response
      } else {
        logger.error("Failed to retrieve study details report", response.message)
        throw new Error(response.message || "Failed to retrieve study details report")
      }
    } catch (error) {
      logger.error("Error in getStudyDetailsReport", error)
      throw error
    }
  }

  /**
   * Export Study Details Report
   * @param {Object} params - Export parameters
   * @param {string} params.format - Export format: "csv" or "pdf" (default: "csv")
   * @param {number} params.studyId - Filter by study ID (optional)
   * @param {Date} params.startDate - Filter from date (optional)
   * @param {Date} params.endDate - Filter to date (optional)
   * @param {string} params.search - Search term (optional)
   * @returns {Promise<Blob>} File blob for download
   */
  async exportStudyDetailsReport(params = {}) {
    try {
      const {
        format = "csv",
        studyId,
        startDate,
        endDate,
        search,
      } = params

      const queryParams = new URLSearchParams({
        format: format,
      })
      appendPdfPageOptions(queryParams, { format, pageSize: params.pageSize, orientation: params.orientation })

      if (studyId) {
        queryParams.append("studyId", studyId.toString())
      }

      if (startDate) {
        queryParams.append("startDate", startDate.toISOString())
      }

      if (endDate) {
        queryParams.append("endDate", endDate.toISOString())
      }

      if (search) {
        queryParams.append("search", search)
      }

      // Use fetch directly for blob response
      const token = localStorage.getItem("authToken")
      const baseUrl = API_CONFIG.BASE_URL
      const url = `${baseUrl}${API_CONFIG.ENDPOINTS.REPORTS.STUDY_DETAILS_EXPORT}?${queryParams.toString()}`

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Export failed with status ${response.status}`)
      }

      const blob = await response.blob()
      
      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition")
      let filename = `study-details-${new Date().toISOString().split("T")[0]}.${reportTabularExportExtension(format)}`
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i)
        if (filenameMatch) {
          filename = filenameMatch[1].replace(/"/g, "")
        }
      }

      // Trigger download
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(link)

      logger.info("Study details report exported successfully", { format, filename })
      return { success: true, filename }
    } catch (error) {
      logger.error("Error in exportStudyDetailsReport", error)
      throw error
    }
  }

  /**
   * Get Site Details Report (Paginated)
   * @param {Object} params - Query parameters
   * @param {number} params.pageNumber - Page number (default: 1)
   * @param {number} params.pageSize - Items per page (default: 10)
   * @param {number} params.studyId - Filter by study ID (optional)
   * @param {number} params.siteId - Filter by site ID (optional)
   * @param {Date} params.startDate - Filter from date (optional)
   * @param {Date} params.endDate - Filter to date (optional)
   * @param {string} params.search - Search term (optional)
   * @returns {Promise<Object>} Paged result with site details
   */
  async getSiteDetailsReport(params = {}) {
    try {
      const {
        pageNumber = 1,
        pageSize = 10,
        studyId,
        siteId,
        startDate,
        endDate,
        search,
      } = params

      const queryParams = new URLSearchParams({
        pageNumber: pageNumber.toString(),
        pageSize: pageSize.toString(),
      })

      if (studyId) {
        queryParams.append("studyId", studyId.toString())
      }

      if (siteId) {
        queryParams.append("siteId", siteId.toString())
      }

      if (startDate) {
        queryParams.append("startDate", startDate.toISOString())
      }

      if (endDate) {
        queryParams.append("endDate", endDate.toISOString())
      }

      if (search) {
        queryParams.append("search", search)
      }

      const response = await apiClient.get(
        `${API_CONFIG.ENDPOINTS.REPORTS.SITE_DETAILS}?${queryParams.toString()}`
      )

      if (response.isSuccess) {
        logger.info("Site details report retrieved successfully", response.data)
        return response
      } else {
        logger.error("Failed to retrieve site details report", response.message)
        throw new Error(response.message || "Failed to retrieve site details report")
      }
    } catch (error) {
      logger.error("Error in getSiteDetailsReport", error)
      throw error
    }
  }

  /**
   * Export Site Details Report
   * @param {Object} params - Export parameters
   * @param {string} params.format - Export format: "csv" or "pdf" (default: "csv")
   * @param {number} params.studyId - Filter by study ID (optional)
   * @param {number} params.siteId - Filter by site ID (optional)
   * @param {Date} params.startDate - Filter from date (optional)
   * @param {Date} params.endDate - Filter to date (optional)
   * @param {string} params.search - Search term (optional)
   * @returns {Promise<Blob>} File blob for download
   */
  async exportSiteDetailsReport(params = {}) {
    try {
      const {
        format = "csv",
        studyId,
        siteId,
        startDate,
        endDate,
        search,
      } = params

      const queryParams = new URLSearchParams({
        format: format,
      })
      appendPdfPageOptions(queryParams, { format, pageSize: params.pageSize, orientation: params.orientation })

      if (studyId) {
        queryParams.append("studyId", studyId.toString())
      }

      if (siteId) {
        queryParams.append("siteId", siteId.toString())
      }

      if (startDate) {
        queryParams.append("startDate", startDate.toISOString())
      }

      if (endDate) {
        queryParams.append("endDate", endDate.toISOString())
      }

      if (search) {
        queryParams.append("search", search)
      }

      // Use fetch directly for blob response
      const token = localStorage.getItem("authToken")
      const baseUrl = API_CONFIG.BASE_URL
      const url = `${baseUrl}${API_CONFIG.ENDPOINTS.REPORTS.SITE_DETAILS_EXPORT}?${queryParams.toString()}`

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Export failed with status ${response.status}`)
      }

      const blob = await response.blob()
      
      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition")
      let filename = `site-details-${new Date().toISOString().split("T")[0]}.${reportTabularExportExtension(format)}`
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i)
        if (filenameMatch) {
          filename = filenameMatch[1].replace(/"/g, "")
        }
      }

      // Trigger download
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(link)

      logger.info("Site details report exported successfully", { format, filename })
      return { success: true, filename }
    } catch (error) {
      logger.error("Error in exportSiteDetailsReport", error)
      throw error
    }
  }

  /**
   * Get Agreement Details Report (Paginated)
   * @param {Object} params - Query parameters
   * @param {number} params.pageNumber - Page number (default: 1)
   * @param {number} params.pageSize - Items per page (default: 10)
   * @param {number} params.studyId - Filter by study ID (optional)
   * @param {number} params.agreementId - Filter by agreement ID (optional)
   * @param {Date} params.startDate - Filter from date (optional)
   * @param {Date} params.endDate - Filter to date (optional)
   * @param {string} params.search - Search term (optional)
   * @returns {Promise<Object>} Paged result with agreement details
   */
  async getAgreementDetailsReport(params = {}) {
    try {
      const {
        pageNumber = 1,
        pageSize = 10,
        studyId,
        agreementId,
        startDate,
        endDate,
        search,
      } = params

      const queryParams = new URLSearchParams({
        pageNumber: pageNumber.toString(),
        pageSize: pageSize.toString(),
      })

      if (studyId) {
        queryParams.append("studyId", studyId.toString())
      }

      if (agreementId) {
        queryParams.append("agreementId", agreementId.toString())
      }

      if (startDate) {
        queryParams.append("startDate", startDate.toISOString())
      }

      if (endDate) {
        queryParams.append("endDate", endDate.toISOString())
      }

      if (search) {
        queryParams.append("search", search)
      }

      const response = await apiClient.get(
        `${API_CONFIG.ENDPOINTS.REPORTS.AGREEMENT_DETAILS}?${queryParams.toString()}`
      )

      if (response.isSuccess) {
        logger.info("Agreement details report retrieved successfully", response.data)
        return response
      } else {
        logger.error("Failed to retrieve agreement details report", response.message)
        throw new Error(response.message || "Failed to retrieve agreement details report")
      }
    } catch (error) {
      logger.error("Error in getAgreementDetailsReport", error)
      throw error
    }
  }

  /**
   * Export Agreement Details Report
   * @param {Object} params - Export parameters
   * @param {string} params.format - Export format: "csv" or "pdf" (default: "csv")
   * @param {number} params.studyId - Filter by study ID (optional)
   * @param {number} params.agreementId - Filter by agreement ID (optional)
   * @param {Date} params.startDate - Filter from date (optional)
   * @param {Date} params.endDate - Filter to date (optional)
   * @param {string} params.search - Search term (optional)
   * @returns {Promise<Blob>} File blob for download
   */
  async exportAgreementDetailsReport(params = {}) {
    try {
      const {
        format = "csv",
        studyId,
        agreementId,
        startDate,
        endDate,
        search,
      } = params

      const queryParams = new URLSearchParams({
        format: format,
      })
      appendPdfPageOptions(queryParams, { format, pageSize: params.pageSize, orientation: params.orientation })

      if (studyId) {
        queryParams.append("studyId", studyId.toString())
      }

      if (agreementId) {
        queryParams.append("agreementId", agreementId.toString())
      }

      if (startDate) {
        queryParams.append("startDate", startDate.toISOString())
      }

      if (endDate) {
        queryParams.append("endDate", endDate.toISOString())
      }

      if (search) {
        queryParams.append("search", search)
      }

      // Use fetch directly for blob response
      const token = localStorage.getItem("authToken")
      const baseUrl = API_CONFIG.BASE_URL
      const url = `${baseUrl}${API_CONFIG.ENDPOINTS.REPORTS.AGREEMENT_DETAILS_EXPORT}?${queryParams.toString()}`

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Export failed with status ${response.status}`)
      }

      const blob = await response.blob()
      
      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition")
      let filename = `agreement-details-${new Date().toISOString().split("T")[0]}.${reportTabularExportExtension(format)}`
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i)
        if (filenameMatch) {
          filename = filenameMatch[1].replace(/"/g, "")
        }
      }

      // Trigger download
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(link)

      logger.info("Agreement details report exported successfully", { format, filename })
      return { success: true, filename }
    } catch (error) {
      logger.error("Error in exportAgreementDetailsReport", error)
      throw error
    }
  }

  /**
   * Get Patient Details Report (Paginated)
   * @param {Object} params - Query parameters
   * @param {number} params.pageNumber - Page number (default: 1)
   * @param {number} params.pageSize - Items per page (default: 10)
   * @param {number} params.studyId - Study ID (required, must be > 0)
   * @param {number} params.siteId - Filter by site ID (optional)
   * @param {number} params.visitScheduleId - Filter by visit schedule ID (optional)
   * @param {number} params.patientStatus - Filter by participation status code 1–9 (optional)
   * @param {Date} params.startDate - Filter from date (optional)
   * @param {Date} params.endDate - Filter to date (optional)
   * @param {string} params.search - Search term (optional)
   * @returns {Promise<Object>} Paged result with patient details
   */
  async getPatientDetailsReport(params = {}) {
    try {
      const {
        pageNumber = 1,
        pageSize = 10,
        studyId,
        siteId,
        visitScheduleId,
        patientStatus,
        startDate,
        endDate,
        search,
      } = params

      const studyIdNum = Number(studyId)
      if (!Number.isFinite(studyIdNum) || studyIdNum <= 0) {
        throw new Error("StudyId is required and must be greater than 0")
      }

      const queryParams = new URLSearchParams({
        studyId: studyIdNum.toString(),
        pageNumber: pageNumber.toString(),
        pageSize: pageSize.toString(),
      })

      const patientStatusNum = Number(patientStatus)
      if (Number.isFinite(patientStatusNum) && patientStatusNum > 0) {
        queryParams.append("patientStatus", patientStatusNum.toString())
      }

      if (siteId) {
        queryParams.append("siteId", siteId.toString())
      }

      const visitScheduleIdNum = Number(visitScheduleId)
      if (Number.isFinite(visitScheduleIdNum) && visitScheduleIdNum > 0) {
        queryParams.append("visitScheduleId", visitScheduleIdNum.toString())
      }

      if (startDate) {
        queryParams.append("startDate", startDate.toISOString())
      }

      if (endDate) {
        queryParams.append("endDate", endDate.toISOString())
      }

      if (search) {
        queryParams.append("search", search)
      }

      const response = await apiClient.get(
        `${API_CONFIG.ENDPOINTS.REPORTS.PATIENT_DETAILS}?${queryParams.toString()}`
      )

      if (response.isSuccess) {
        logger.info("Patient details report retrieved successfully", response.data)
        return response
      } else {
        logger.error("Failed to retrieve patient details report", response.message)
        throw new Error(response.message || "Failed to retrieve patient details report")
      }
    } catch (error) {
      logger.error("Error in getPatientDetailsReport", error)
      throw error
    }
  }

  /**
   * Export Patient Details Report
   * @param {Object} params - Export parameters
   * @param {string} params.format - Export format: "csv" or "pdf" (default: "csv")
   * @param {number} params.studyId - Study ID (required, must be > 0)
   * @param {number} params.siteId - Filter by site ID (optional)
   * @param {number} params.visitScheduleId - Filter by visit schedule ID (optional)
   * @param {number} params.patientStatus - Filter by participation status code 1–9 (optional)
   * @param {Date} params.startDate - Filter from date (optional)
   * @param {Date} params.endDate - Filter to date (optional)
   * @param {string} params.search - Search term (optional)
   * @returns {Promise<Blob>} File blob for download
   */
  async exportPatientDetailsReport(params = {}) {
    try {
      const {
        format = "csv",
        studyId,
        siteId,
        visitScheduleId,
        patientStatus,
        startDate,
        endDate,
        search,
      } = params

      const studyIdNum = Number(studyId)
      if (!Number.isFinite(studyIdNum) || studyIdNum <= 0) {
        throw new Error("StudyId is required and must be greater than 0")
      }

      const queryParams = new URLSearchParams({
        format: format,
        studyId: studyIdNum.toString(),
      })
      appendPdfPageOptions(queryParams, { format, pageSize: params.pageSize, orientation: params.orientation })

      const patientStatusNum = Number(patientStatus)
      if (Number.isFinite(patientStatusNum) && patientStatusNum > 0) {
        queryParams.append("patientStatus", patientStatusNum.toString())
      }

      if (siteId) {
        queryParams.append("siteId", siteId.toString())
      }

      const visitScheduleIdNum = Number(visitScheduleId)
      if (Number.isFinite(visitScheduleIdNum) && visitScheduleIdNum > 0) {
        queryParams.append("visitScheduleId", visitScheduleIdNum.toString())
      }

      if (startDate) {
        queryParams.append("startDate", startDate.toISOString())
      }

      if (endDate) {
        queryParams.append("endDate", endDate.toISOString())
      }

      if (search) {
        queryParams.append("search", search)
      }

      // Use fetch directly for blob response
      const token = localStorage.getItem("authToken")
      const baseUrl = API_CONFIG.BASE_URL
      const url = `${baseUrl}${API_CONFIG.ENDPOINTS.REPORTS.PATIENT_DETAILS_EXPORT}?${queryParams.toString()}`

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Export failed with status ${response.status}`)
      }

      const blob = await response.blob()
      
      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition")
      let filename = `patient-details-${new Date().toISOString().split("T")[0]}.${reportTabularExportExtension(format)}`
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i)
        if (filenameMatch) {
          filename = filenameMatch[1].replace(/"/g, "")
        }
      }

      // Trigger download
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(link)

      logger.info("Patient details report exported successfully", { format, filename })
      return { success: true, filename }
    } catch (error) {
      logger.error("Error in exportPatientDetailsReport", error)
      throw error
    }
  }

  /**
   * Get Audit Log Report (Paginated)
   * @param {Object} params - Query parameters
   * @param {number} params.pageNumber - Page number (default: 1)
   * @param {number} params.pageSize - Items per page (default: 10)
   * @param {string} params.entityName - Filter by entity name (optional)
   * @param {string} params.action - Filter by action (optional)
   * @param {number} params.userId - Filter by user ID (optional)
   * @param {string} params.module - Filter by module name (optional)
   * @param {Date} params.startDate - Filter from date (optional)
   * @param {Date} params.endDate - Filter to date (optional)
   * @param {string} params.search - Search term (optional)
   * @returns {Promise<Object>} Paged result with audit log entries
   */
  async getAuditLogReport(params = {}) {
    try {
      const {
        pageNumber = 1,
        pageSize = 10,
        entityName,
        action,
        userId,
        module,
        startDate,
        endDate,
        search,
        studyId,
        siteId,
      } = params

      const queryParams = new URLSearchParams({
        pageNumber: pageNumber.toString(),
        pageSize: pageSize.toString(),
      })

      if (studyId) {
        queryParams.append("studyId", studyId.toString())
      }

      if (siteId) {
        queryParams.append("siteId", siteId.toString())
      }

      if (entityName) {
        queryParams.append("entityName", entityName)
      }

      if (action) {
        queryParams.append("action", action)
      }

      if (userId) {
        queryParams.append("userId", userId.toString())
      }

      if (module) {
        queryParams.append("module", module)
      }

      if (startDate) {
        queryParams.append("startDate", startDate.toISOString())
      }

      if (endDate) {
        queryParams.append("endDate", endDate.toISOString())
      }

      if (search) {
        queryParams.append("search", search)
      }

      const response = await apiClient.get(
        `${API_CONFIG.ENDPOINTS.REPORTS.AUDIT_LOG}?${queryParams.toString()}`
      )

      if (response.isSuccess) {
        logger.info("Audit log report retrieved successfully", response.data)
        return response
      }

      const statusCode = response.statusCode || response.httpStatus
      const rawMsg = (response.message || "").toString().trim()
      const isGenericMsg = !rawMsg || rawMsg === "Request failed" || rawMsg === "An unexpected error occurred"

      const msg =
        statusCode === 401
          ? "Authentication required. Please log in again."
          : statusCode === 403
            ? "You don't have permission to access the audit log."
            : isGenericMsg
              ? `Request failed (HTTP ${statusCode || "?"})`
              : rawMsg

      logger.error("Failed to retrieve audit log report", { statusCode, message: rawMsg })
      throw new Error(msg)
    } catch (error) {
      logger.error("Error in getAuditLogReport", error)
      throw error
    }
  }

  /**
   * Export Audit Log Report
   * @param {Object} params - Export parameters
   * @param {string} params.format - Export format: "csv" or "pdf" (default: "csv")
   * @param {string} params.entityName - Filter by entity name (optional)
   * @param {string} params.action - Filter by action (optional)
   * @param {number} params.userId - Filter by user ID (optional)
   * @param {string} params.module - Filter by module name (optional)
   * @param {Date} params.startDate - Filter from date (optional)
   * @param {Date} params.endDate - Filter to date (optional)
   * @param {string} params.search - Search term (optional)
   * @returns {Promise<Blob>} File blob for download
   */
  async exportAuditLogReport(params = {}) {
    try {
      const {
        format = "csv",
        entityName,
        action,
        userId,
        module,
        startDate,
        endDate,
        search,
        studyId,
        siteId,
      } = params

      const queryParams = new URLSearchParams({
        format: format,
      })
      appendPdfPageOptions(queryParams, { format, pageSize: params.pageSize, orientation: params.orientation })

      if (studyId) {
        queryParams.append("studyId", studyId.toString())
      }

      if (siteId) {
        queryParams.append("siteId", siteId.toString())
      }

      if (entityName) {
        queryParams.append("entityName", entityName)
      }

      if (action) {
        queryParams.append("action", action)
      }

      if (userId) {
        queryParams.append("userId", userId.toString())
      }

      if (module) {
        queryParams.append("module", module)
      }

      if (startDate) {
        queryParams.append("startDate", startDate.toISOString())
      }

      if (endDate) {
        queryParams.append("endDate", endDate.toISOString())
      }

      if (search) {
        queryParams.append("search", search)
      }

      // Use fetch directly for blob response
      const token = localStorage.getItem("authToken")
      const baseUrl = API_CONFIG.BASE_URL
      const url = `${baseUrl}${API_CONFIG.ENDPOINTS.REPORTS.AUDIT_LOG_EXPORT}?${queryParams.toString()}`

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Export failed with status ${response.status}`)
      }

      const blob = await response.blob()
      
      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition")
      let filename = `audit-log-report-${new Date().toISOString().split("T")[0]}.${reportTabularExportExtension(format)}`
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i)
        if (filenameMatch) {
          filename = filenameMatch[1].replace(/"/g, "")
        }
      }

      // Trigger download
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(link)

      logger.info("Audit log report exported successfully", { format, filename })
      return { success: true, filename }
    } catch (error) {
      logger.error("Error in exportAuditLogReport", error)
      throw error
    }
  }

  /**
   * Get Visit Details Report (Paginated)
   * @param {Object} params - Query parameters
   * @param {number} params.pageNumber - Page number (default: 1)
   * @param {number} params.pageSize - Items per page (default: 10)
   * @param {number} params.studyId - Filter by study ID (optional)
   * @param {number} params.visitId - Filter by visit ID (optional)
   * @param {Date} params.startDate - Filter from date (optional)
   * @param {Date} params.endDate - Filter to date (optional)
   * @param {string} params.search - Search term (optional)
   * @returns {Promise<Object>} Paged result with visit details
   */
  async getVisitDetailsReport(params = {}) {
    try {
      const {
        pageNumber = 1,
        pageSize = 10,
        studyId,
        visitId,
        startDate,
        endDate,
        search,
      } = params

      const queryParams = new URLSearchParams({
        pageNumber: pageNumber.toString(),
        pageSize: pageSize.toString(),
      })

      if (studyId) {
        queryParams.append("studyId", studyId.toString())
      }

      if (visitId) {
        queryParams.append("visitId", visitId.toString())
      }

      if (startDate) {
        queryParams.append("startDate", startDate.toISOString())
      }

      if (endDate) {
        queryParams.append("endDate", endDate.toISOString())
      }

      if (search) {
        queryParams.append("search", search)
      }

      const response = await apiClient.get(
        `${API_CONFIG.ENDPOINTS.REPORTS.VISIT_DETAILS}?${queryParams.toString()}`
      )

      if (response.isSuccess) {
        logger.info("Visit details report retrieved successfully", response.data)
        return response
      } else {
        logger.error("Failed to retrieve visit details report", response.message)
        throw new Error(response.message || "Failed to retrieve visit details report")
      }
    } catch (error) {
      logger.error("Error in getVisitDetailsReport", error)
      throw error
    }
  }

  /**
   * Export Visit Details Report
   * @param {Object} params - Export parameters
   * @param {string} params.format - Export format: "csv" or "pdf" (default: "csv")
   * @param {number} params.studyId - Filter by study ID (optional)
   * @param {number} params.visitId - Filter by visit ID (optional)
   * @param {Date} params.startDate - Filter from date (optional)
   * @param {Date} params.endDate - Filter to date (optional)
   * @param {string} params.search - Search term (optional)
   * @returns {Promise<Blob>} File blob for download
   */
  async exportVisitDetailsReport(params = {}) {
    try {
      const {
        format = "csv",
        studyId,
        visitId,
        startDate,
        endDate,
        search,
      } = params

      const queryParams = new URLSearchParams({
        format: format,
      })
      appendPdfPageOptions(queryParams, { format, pageSize: params.pageSize, orientation: params.orientation })

      if (studyId) {
        queryParams.append("studyId", studyId.toString())
      }

      if (visitId) {
        queryParams.append("visitId", visitId.toString())
      }

      if (startDate) {
        queryParams.append("startDate", startDate.toISOString())
      }

      if (endDate) {
        queryParams.append("endDate", endDate.toISOString())
      }

      if (search) {
        queryParams.append("search", search)
      }

      // Use fetch directly for blob response
      const token = localStorage.getItem("authToken")
      const baseUrl = API_CONFIG.BASE_URL
      const url = `${baseUrl}${API_CONFIG.ENDPOINTS.REPORTS.VISIT_DETAILS_EXPORT}?${queryParams.toString()}`

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Export failed with status ${response.status}`)
      }

      const blob = await response.blob()
      
      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition")
      let filename = `visit-details-${new Date().toISOString().split("T")[0]}.${reportTabularExportExtension(format)}`
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i)
        if (filenameMatch) {
          filename = filenameMatch[1].replace(/"/g, "")
        }
      }

      // Trigger download
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(link)

      logger.info("Visit details report exported successfully", { format, filename })
      return { success: true, filename }
    } catch (error) {
      logger.error("Error in exportVisitDetailsReport", error)
      throw error
    }
  }

  /**
   * Export eCRF Details Report (CSV only)
   * @param {Object} params - Export parameters
   * @param {number} params.studyId - Filter by study ID (optional)
   * @param {number} params.siteId - Filter by site ID (optional)
   * @param {number} params.patientEnrolmentId - Filter by patient enrolment ID (optional)
   * @param {number} params.crfDesignId - Filter by CRF design ID (optional)
   * @param {number} params.visitScheduleId - Filter by visit schedule ID (optional)
   * @returns {Promise<Blob>} File blob for download
   */
  async exportEcrfDetailsReport(params = {}) {
    try {
      const {
        studyId,
        siteId,
        patientEnrolmentId,
        crfDesignId,
        visitScheduleId,
      } = params

      const queryParams = new URLSearchParams()

      if (studyId) {
        queryParams.append("studyId", studyId.toString())
      }

      if (siteId) {
        queryParams.append("siteId", siteId.toString())
      }

      if (patientEnrolmentId) {
        queryParams.append("patientEnrolmentId", patientEnrolmentId.toString())
      }

      if (crfDesignId) {
        queryParams.append("crfDesignId", crfDesignId.toString())
      }

      // visitScheduleId can be 0 (meaning "All") so don't rely on truthiness.
      if (visitScheduleId !== undefined && visitScheduleId !== null && visitScheduleId !== "") {
        queryParams.append("visitScheduleId", visitScheduleId.toString())
      }

      // Use fetch directly for blob response
      const token = localStorage.getItem("authToken")
      const baseUrl = API_CONFIG.BASE_URL
      const url = `${baseUrl}${API_CONFIG.ENDPOINTS.REPORTS.ECRF_DETAILS_EXPORT}${queryParams.toString() ? `?${queryParams.toString()}` : ""}`

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        // Guard against HTML error pages (e.g. login redirect) being force-downloaded
        const respContentType = (response.headers.get("content-type") || "").toLowerCase()
        if (respContentType.includes("text/html")) {
          throw new Error("Server returned an HTML page instead of a file. You may need to log in again.")
        }
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Export failed with status ${response.status}`)
      }

      const blob = await response.blob()
      const contentType = (response.headers.get("content-type") || "").toLowerCase()
      const contentDisposition = response.headers.get("content-disposition") || ""

      // --- Determine filename from Content-Disposition (server-preferred) ---
      let filename = null

      if (contentDisposition) {
        // Handle RFC 5987 UTF-8 encoded filenames: filename*=UTF-8''name.ext
        const utf8Match = /filename\*\s*=\s*UTF-8''([^;\s]+)/i.exec(contentDisposition)
        if (utf8Match) {
          filename = decodeURIComponent(utf8Match[1])
        }

        // Fallback: standard filename="name.ext" or filename=name.ext
        if (!filename) {
          const stdMatch = /filename\s*=\s*"?([^";\s]+)"?/i.exec(contentDisposition)
          if (stdMatch) {
            filename = stdMatch[1].replace(/"/g, "")
          }
        }
      }

      // --- If no server filename, detect ZIP vs CSV by Content-Type or magic bytes ---
      if (!filename) {
        let isZip = contentType.includes("application/zip") ||
                    contentType.includes("application/x-zip") ||
                    contentType.includes("application/octet-stream")

        // When Content-Type is ambiguous (octet-stream), verify with ZIP magic bytes (PK..)
        if (!isZip || contentType.includes("application/octet-stream")) {
          try {
            const headerSlice = blob.slice(0, 4)
            const headerBuf = await headerSlice.arrayBuffer()
            const headerBytes = new Uint8Array(headerBuf)
            // ZIP magic: 50 4B 03 04
            isZip = headerBytes[0] === 0x50 &&
                    headerBytes[1] === 0x4B &&
                    headerBytes[2] === 0x03 &&
                    headerBytes[3] === 0x04
          } catch {
            // If slice/arrayBuffer fails, rely on Content-Type
          }
        }

        const dateSuffix = new Date().toISOString().split("T")[0]
        filename = isZip
          ? `ecrf-details-${dateSuffix}.zip`
          : `ecrf-details-${dateSuffix}.xlsx`
      }

      // Trigger download
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(link)

      logger.info("eCRF details report exported successfully", { filename })
      return { success: true, filename }
    } catch (error) {
      logger.error("Error in exportEcrfDetailsReport", error)
      throw error
    }
  }

  /**
   * Export eCRF Details ZIP bundle (single request for browser-side PDF ZIP).
   * Backend should return all required meta/design snapshot + submitted record formData.
   * Retries once on HTTP 404 using the alternate route when configured (some deployments only register the alias).
   */
  async exportEcrfDetailsExportBundle(payload = {}) {
    const opts = {
      headers: {
        Accept: "application/json",
      },
    }
    const primary = API_CONFIG.ENDPOINTS.REPORTS.ECRF_DETAILS_EXPORT_BUNDLE
    const alt = API_CONFIG.ENDPOINTS.REPORTS.ECRF_DETAILS_EXPORT_BUNDLE_ALT

    try {
      const first = await apiClient.post(primary, payload, opts)
      if (
        !first?.isSuccess &&
        first?.httpStatus === 404 &&
        alt &&
        typeof alt === "string" &&
        alt !== primary
      ) {
        logger.warn("eCRF bundle primary route returned 404; retrying alternate", { alt })
        return await apiClient.post(alt, payload, opts)
      }
      return first
    } catch (error) {
      logger.error("Error in exportEcrfDetailsExportBundle", error)
      throw error
    }
  }

  /**
   * Get User Details Report (Paginated)
   * @param {Object} params - Query parameters
   * @param {number} params.pageNumber - Page number (default: 1)
   * @param {number} params.pageSize - Items per page (default: 10)
   * @param {number} params.studyId - Study ID (required)
   * @param {string} params.role - Filter by role: "CRC", "CRA", "CRM", "SPONSOR", or "ALL" (default: "ALL")
   * @param {string} params.search - Search term (optional)
   * @returns {Promise<Object>} Paged result with user details
   */
  async getUserDetailsReport(params = {}) {
    try {
      const {
        pageNumber = 1,
        pageSize = 10,
        studyId,
        role = "ALL",
        search,
      } = params

      if (!studyId || studyId <= 0) {
        throw new Error("studyId is required and must be greater than 0")
      }

      const queryParams = new URLSearchParams({
        studyId: studyId.toString(),
        role: role,
        pageNumber: pageNumber.toString(),
        pageSize: pageSize.toString(),
      })

      if (search && search.trim()) {
        queryParams.append("search", search.trim())
      }

      const endpoint = `${API_CONFIG.ENDPOINTS.REPORTS.USER_DETAILS}?${queryParams.toString()}`
      const response = await apiClient.get(endpoint)

      if (response.isSuccess) {
        logger.info("User details report retrieved successfully", response.data)
        return response
      } else {
        // Try to extract error message from response data if available
        let errorMessage = response.message || "Request failed"
        
        // Check if response.data contains error information
        if (response.data) {
          if (typeof response.data === 'string') {
            errorMessage = response.data
          } else if (response.data.message) {
            errorMessage = response.data.message
          } else if (response.data.error) {
            errorMessage = response.data.error
          } else if (Array.isArray(response.data.errors) && response.data.errors.length > 0) {
            errorMessage = response.data.errors[0]
          }
        }
        
        // Provide specific messages based on status code
        const statusCode = response.statusCode || response.httpStatus
        if (!errorMessage || errorMessage === "Request failed") {
          errorMessage = 
            statusCode === 400 ? "Invalid request parameters. Please check your filters." :
            statusCode === 401 ? "Authentication required. Please log in again." :
            statusCode === 403 ? "You don't have permission to access this report." :
            statusCode === 404 ? "User details report endpoint not found. Please verify the API endpoint." :
            statusCode === 500 ? "Server error occurred. Please try again later." :
            statusCode === 0 ? "Network error. Please check your internet connection." :
            `Failed to retrieve user details report (Status: ${statusCode || 'Unknown'})`
        }
        
        logger.error("Failed to retrieve user details report", {
          message: errorMessage,
          statusCode: statusCode,
          endpoint,
          params,
          responseData: response.data
        })
        throw new Error(errorMessage)
      }
    } catch (error) {
      logger.error("Error in getUserDetailsReport", {
        error: error.message || error,
        stack: error.stack,
        params
      })
      
      // If error is already an Error object with message, throw it as is
      if (error instanceof Error) {
        throw error
      }
      
      // Otherwise, wrap it in an Error
      throw new Error(error.message || "Failed to retrieve user details report. Please try again.")
    }
  }

  /**
   * Export User Details Report
   * @param {Object} params - Export parameters
   * @param {string} params.format - Export format: "csv" or "pdf" (default: "csv")
   * @param {number} params.studyId - Study ID (required)
   * @param {string} params.role - Filter by role: "CRC", "CRA", "CRM", "SPONSOR", or "ALL" (default: "ALL")
   * @param {string} params.search - Search term (optional)
   * @returns {Promise<Blob>} File blob for download
   */
  async exportUserDetailsReport(params = {}) {
    try {
      const {
        format = "csv",
        studyId,
        role = "ALL",
        search,
      } = params

      if (!studyId || studyId <= 0) {
        throw new Error("studyId is required and must be greater than 0")
      }

      const queryParams = new URLSearchParams({
        format: format,
        studyId: studyId.toString(),
        role: role,
      })
      appendPdfPageOptions(queryParams, { format, pageSize: params.pageSize, orientation: params.orientation })

      if (search && search.trim()) {
        queryParams.append("search", search.trim())
      }

      // Use fetch directly for blob response
      const token = localStorage.getItem("authToken")
      const baseUrl = API_CONFIG.BASE_URL
      const url = `${baseUrl}${API_CONFIG.ENDPOINTS.REPORTS.USER_DETAILS_EXPORT}?${queryParams.toString()}`

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Export failed with status ${response.status}`)
      }

      const blob = await response.blob()
      
      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition")
      let filename = `user-details-${new Date().toISOString().split("T")[0]}.${reportTabularExportExtension(format)}`
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i)
        if (filenameMatch) {
          filename = filenameMatch[1].replace(/"/g, "")
        }
      }

      // Trigger download
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(link)

      logger.info("User details report exported successfully", { format, filename })
      return { success: true, filename }
    } catch (error) {
      logger.error("Error in exportUserDetailsReport", error)
      throw error
    }
  }

  /**
   * Get Audit Trail Report (Paginated)
   * All filters are optional.
   */
  async getAuditTrailReport(params = {}) {
    try {
      const {
        pageNumber = 1,
        pageSize = 10,
        entityName,
        entityId,
        fieldName,
        action,
        userId,
        studyId,
        siteId,
        patientId,
        correlationId,
        module,
        startDate,
        endDate,
        search,
      } = params

      const queryParams = new URLSearchParams({
        pageNumber: pageNumber.toString(),
        pageSize: pageSize.toString(),
      })

      const appendIfPresent = (key, value) => {
        if (value === undefined || value === null) return
        const str = String(value).trim()
        if (!str) return
        queryParams.append(key, str)
      }

      appendIfPresent("entityName", entityName)
      appendIfPresent("entityId", entityId)
      appendIfPresent("fieldName", fieldName)
      appendIfPresent("action", action)
      appendIfPresent("userId", userId)
      appendIfPresent("studyId", studyId)
      appendIfPresent("siteId", siteId)
      appendIfPresent("patientId", patientId)
      appendIfPresent("correlationId", correlationId)
      appendIfPresent("module", module)

      if (startDate) {
        const d = startDate instanceof Date ? startDate : new Date(startDate)
        if (!isNaN(d.getTime())) queryParams.append("startDate", d.toISOString())
      }
      if (endDate) {
        const d = endDate instanceof Date ? endDate : new Date(endDate)
        if (!isNaN(d.getTime())) queryParams.append("endDate", d.toISOString())
      }
      if (search && String(search).trim()) {
        queryParams.append("search", String(search).trim())
      }

      const endpoint = `${API_CONFIG.ENDPOINTS.REPORTS.AUDIT_TRAIL}?${queryParams.toString()}`
      const response = await apiClient.get(endpoint)

      if (response.isSuccess) {
        logger.info("Audit trail report retrieved successfully", response.data)
        return response
      }

      const statusCode = response.statusCode || response.httpStatus
      const rawMsg = (response.message || "").toString().trim()
      const isGenericMsg = !rawMsg || rawMsg === "Request failed" || rawMsg === "An unexpected error occurred"
      const msg =
        statusCode === 401
          ? "Authentication required. Please log in again."
          : statusCode === 403
            ? "You don't have permission to access the audit trail."
            : isGenericMsg
              ? `Request failed (HTTP ${statusCode || "?"})`
              : rawMsg
      throw new Error(msg)
    } catch (error) {
      logger.error("Error in getAuditTrailReport", error)
      throw error
    }
  }

  /**
   * Export Audit Trail Report (CSV/PDF)
   * Returns a file response and triggers browser download.
   */
  async exportAuditTrailReport(params = {}) {
    try {
      const {
        format = "csv",
        entityName,
        entityId,
        fieldName,
        action,
        userId,
        studyId,
        siteId,
        patientId,
        correlationId,
        module,
        startDate,
        endDate,
        search,
      } = params

      const queryParams = new URLSearchParams({
        format: format,
      })
      appendPdfPageOptions(queryParams, { format, pageSize: params.pageSize, orientation: params.orientation })

      const appendIfPresent = (key, value) => {
        if (value === undefined || value === null) return
        const str = String(value).trim()
        if (!str) return
        queryParams.append(key, str)
      }

      appendIfPresent("entityName", entityName)
      appendIfPresent("entityId", entityId)
      appendIfPresent("fieldName", fieldName)
      appendIfPresent("action", action)
      appendIfPresent("userId", userId)
      appendIfPresent("studyId", studyId)
      appendIfPresent("siteId", siteId)
      appendIfPresent("patientId", patientId)
      appendIfPresent("correlationId", correlationId)
      appendIfPresent("module", module)

      if (startDate) {
        const d = startDate instanceof Date ? startDate : new Date(startDate)
        if (!isNaN(d.getTime())) queryParams.append("startDate", d.toISOString())
      }
      if (endDate) {
        const d = endDate instanceof Date ? endDate : new Date(endDate)
        if (!isNaN(d.getTime())) queryParams.append("endDate", d.toISOString())
      }
      if (search && String(search).trim()) {
        queryParams.append("search", String(search).trim())
      }

      const token = localStorage.getItem("authToken")
      const baseUrl = API_CONFIG.BASE_URL
      const url = `${baseUrl}${API_CONFIG.ENDPOINTS.REPORTS.AUDIT_TRAIL_EXPORT}?${queryParams.toString()}`

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Export failed with status ${response.status}`)
      }

      const blob = await response.blob()

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get("Content-Disposition")
      const now = new Date()
      const pad2 = (n) => String(n).padStart(2, "0")
      const timestamp = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}${pad2(
        now.getHours()
      )}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`
      let filename = `audit-trail-report-${timestamp}.${reportTabularExportExtension(format)}`

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i)
        if (filenameMatch) {
          filename = filenameMatch[1].replace(/"/g, "")
        }
      }

      // Trigger download
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(link)

      logger.info("Audit trail report exported successfully", { format, filename })
      return { success: true, filename }
    } catch (error) {
      logger.error("Error in exportAuditTrailReport", error)
      throw error
    }
  }

  toDdMmYyyy(value) {
    const raw = String(value || "").trim()
    if (!raw) return ""
    const parts = raw.split("-")
    if (parts.length !== 3) return ""
    const [y, m, d] = parts
    if (!y || !m || !d) return ""
    return `${d}-${m}-${y}`
  }

  buildAuditTrailWithReasonParams(filters = {}, includePaging = true) {
    const params = new URLSearchParams()
    const appendIfPresent = (key, value) => {
      if (value === undefined || value === null) return
      const str = String(value).trim()
      if (!str) return
      params.append(key, str)
    }

    appendIfPresent("searchEntityName", filters.searchEntityName)
    appendIfPresent("studyId", filters.studyId)
    appendIfPresent("siteId", filters.siteId)
    appendIfPresent("patientId", filters.patientId)
    appendIfPresent("visitId", filters.visitId)
    appendIfPresent("crfId", filters.crfId)
    appendIfPresent("crfDataId", filters.crfDataId)
    appendIfPresent("userId", filters.userId)
    appendIfPresent("module", filters.module)

    const dateFrom = this.toDdMmYyyy(filters.dateFrom)
    const dateTo = this.toDdMmYyyy(filters.dateTo)
    if (dateFrom) params.append("dateFrom", dateFrom)
    if (dateTo) params.append("dateTo", dateTo)

    if (includePaging) {
      params.append("pageNumber", String(filters.pageNumber || 1))
      params.append("pageSize", String(filters.pageSize || 10))
    }

    return params
  }

  async getAuditTrailWithReasonReport(filters = {}) {
    try {
      const queryParams = this.buildAuditTrailWithReasonParams(filters, true)
      const endpoint = `${API_CONFIG.ENDPOINTS.REPORTS.AUDIT_TRAIL_WITH_REASON}?${queryParams.toString()}`
      const response = await apiClient.get(endpoint)
      if (response?.isSuccess) {
        return response
      }
      throw new Error(response?.message || "Failed to load report")
    } catch (error) {
      logger.error("Error in getAuditTrailWithReasonReport", error)
      throw error
    }
  }

  async exportAuditTrailWithReasonReport(filters = {}, format = "csv") {
    try {
      const queryParams = this.buildAuditTrailWithReasonParams(filters, false)
      queryParams.append("format", format === "pdf" ? "pdf" : "csv")
      appendPdfPageOptions(queryParams, {
        format,
        pageSize: filters.pdfPageSize,
        orientation: filters.pdfOrientation,
      })

      const token = localStorage.getItem("authToken")
      const baseUrl = API_CONFIG.BASE_URL
      const endpoint = API_CONFIG.ENDPOINTS.REPORTS.AUDIT_TRAIL_WITH_REASON_EXPORT
      const url = `${baseUrl}${endpoint}?${queryParams.toString()}`

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.message || "Export failed")
      }

      const blob = await response.blob()
      const ext = reportTabularExportExtension(format)
      const fileName = `audit-trail-with-reason-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${ext}`
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
      logger.error("Error in exportAuditTrailWithReasonReport", error)
      throw error
    }
  }

  /**
   * Email a generated report file as an attachment (download dialog Send as Email).
   * @param {{ to: string, cc?: string, bcc?: string, subject?: string, body?: string, blob: Blob, fileName: string }} params
   */
  async sendExportEmail({ to, cc, bcc, subject, body, blob, fileName } = {}) {
    try {
      if (!to || !String(to).trim()) {
        throw new Error("Recipient email (To) is required.")
      }
      if (!blob) {
        throw new Error("Attachment file is required.")
      }

      const form = new FormData()
      form.append("to", String(to).trim())
      if (cc && String(cc).trim()) form.append("cc", String(cc).trim())
      if (bcc && String(bcc).trim()) form.append("bcc", String(bcc).trim())
      form.append("subject", subject && String(subject).trim() ? String(subject).trim() : "Report export")
      form.append(
        "body",
        body && String(body).trim() ? String(body).trim() : "Please find the report attached.",
      )
      form.append("file", blob, fileName || "report-export.bin")

      const response = await apiClient.post(
        API_CONFIG.ENDPOINTS.REPORTS.SEND_EXPORT_EMAIL,
        form,
      )

      if (!response?.isSuccess) {
        throw new Error(response?.message || "Failed to send report email.")
      }
      return response
    } catch (error) {
      logger.error("Error in sendExportEmail", error)
      throw error
    }
  }
}

export default new ReportsService()
