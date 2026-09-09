/**
 * User Agreement Service
 * Handles user agreement operations for CRC users
 */

import apiClient from "../api/client"
import { API_CONFIG, STORAGE_KEYS } from "../api/config"
import logger from "../api/logger"

class UserAgreementService {
  /**
   * Get Agreement Data by Study ID
   * @param {number} studyId - Study ID (required)
   * @returns {Promise<Object>} Response with agreement data
   */
  async getAgreementDataByStudyId(studyId) {
    try {
      const response = await apiClient.get(
        API_CONFIG.ENDPOINTS.USER_AGREEMENTS.GET_AGREEMENT_DATA_BY_STUDY_ID(studyId)
      )

      if (!response.isSuccess) {
        logger.error("Get agreement data by study ID failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }

      return response
    } catch (error) {
      logger.error("Get agreement data by study ID failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch agreement data",
      }
    }
  }

  /**
   * Send Agreement OTP to the logged-in user's registered mobile number for a study.
   * @param {number} studyId - Study ID for which to send OTP
   * @returns {Promise<Object>} Response with otpId, expiresInSeconds, mobileNumberMasked
   */
  async sendAgreementOtp(studyId) {
    try {
      const response = await apiClient.post(
        API_CONFIG.ENDPOINTS.USER_AGREEMENTS.SEND_AGREEMENT_OTP,
        { studyId }
      )
      if (!response.isSuccess) {
        logger.error("Send agreement OTP failed", {
          statusCode: response.statusCode,
          message: response.message,
        })
      }
      return response
    } catch (error) {
      logger.error("Send agreement OTP failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || error.status || 500,
        data: null,
        message: error.message || "Failed to send OTP",
      }
    }
  }

  /**
   * Verify Agreement OTP and get agreement OTP token.
   * @param {Object} payload - { studyId: number, otpId: string, otp: string }
   * @returns {Promise<Object>} Response with agreementOtpToken, expiresInSeconds
   */
  async verifyAgreementOtp(payload) {
    try {
      const response = await apiClient.post(
        API_CONFIG.ENDPOINTS.USER_AGREEMENTS.VERIFY_AGREEMENT_OTP,
        payload
      )
      if (!response.isSuccess) {
        logger.error("Verify agreement OTP failed", {
          statusCode: response.statusCode,
          message: response.message,
        })
      }
      return response
    } catch (error) {
      logger.error("Verify agreement OTP failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || error.status || 500,
        data: null,
        message: error.message || "Failed to verify OTP",
      }
    }
  }

  /**
   * Download signed agreement PDF for a study.
   * GET /api/UserAgreement/DownloadAgreementPdf/{studyId}
   * User must be assigned to the study and have signed the agreement.
   *
   * Expected PDF content (backend): Should include signature block with
   * - "I Accept" / signature image
   * - Signatory name and role (e.g. "Name (Investigator)")
   * - Signed date & time (e.g. "01-Aug-2025 13:19")
   * - "Verified through OTP sent to Mobile No. XXXXXXXX68"
   * - "Email ID: user@example.com"
   *
   * @param {number} studyId - Study ID for which agreement was signed
   * @returns {Promise<Object>} { isSuccess, message } - triggers browser download on success
   */
  async downloadAgreementPdf(studyId) {
    if (!studyId) {
      return { isSuccess: false, message: "Study ID is required." }
    }
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) : null
      const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.USER_AGREEMENTS.DOWNLOAD_AGREEMENT_PDF(studyId)}`
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/pdf",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }))
        let message = err.message || err.errors?.[0] || "Download failed."
        if (res.status === 401) message = "Not logged in or invalid token."
        else if (res.status === 403) message = "No access to that study."
        else if (res.status === 404) message = "Study/user not found or agreement not signed for this study."
        return { isSuccess: false, statusCode: res.status, message }
      }

      const blob = await res.blob()
      const contentDisposition = res.headers.get("Content-Disposition") || ""
      let fileName = `Agreement_Study_${studyId}.pdf`
      const match = contentDisposition.match(/filename="?([^";]+)"?/)
      if (match) fileName = match[1].trim()

      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = objectUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)

      return { isSuccess: true, message: "Download started." }
    } catch (error) {
      logger.error("Download agreement PDF failed", { error, studyId })
      return {
        isSuccess: false,
        statusCode: 500,
        message: error.message || "Failed to download agreement.",
      }
    }
  }

  /**
   * Admin/CRM: Download signed agreement PDF for a specific user in a study.
   * GET /api/UserAgreement/DownloadAgreementPdfForUser?studyId={studyId}&userId={userId}
   * Roles: CRM / Admin / Super Admin with AGREEMENT_MGMT View.
   */
  async downloadAgreementPdfForUser(studyId, userId) {
    if (!studyId || !userId) {
      return { isSuccess: false, message: "Study ID and user ID are required." }
    }

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) : null
      const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.USER_AGREEMENTS.DOWNLOAD_AGREEMENT_PDF_FOR_USER(
        studyId,
        userId
      )}`

      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/pdf",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (!res.ok) {
        let message = "Failed to download agreement for this user."
        try {
          const err = await res.json()
          message = err?.message || err?.errors?.[0] || message
        } catch {
          // ignore JSON parse errors
        }

        if (res.status === 400) {
          message = message || "Agreement not signed yet or invalid input."
        } else if (res.status === 403) {
          message = message || "You don't have permission to download this agreement."
        } else if (res.status === 404) {
          message = message || "Study/user/agreement not found."
        }

        return { isSuccess: false, statusCode: res.status, message }
      }

      const blob = await res.blob()
      const contentDisposition = res.headers.get("Content-Disposition") || ""
      let fileName = `Agreement_Study_${studyId}_User_${userId}.pdf`
      const match = contentDisposition.match(/filename="?([^";]+)"?/)
      if (match) fileName = match[1].trim()

      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = objectUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)

      return { isSuccess: true, message: "Download started." }
    } catch (error) {
      logger.error("Download agreement PDF for user failed", { error, studyId, userId })
      return {
        isSuccess: false,
        statusCode: 500,
        message: error.message || "Failed to download agreement.",
      }
    }
  }

  /**
   * Sign User Agreement (requires SignatureFile and PanCardFile).
   * @param {FormData} agreementData - FormData with StudyId, SignatureFile, PanCardFile
   * @returns {Promise<Object>} Response with signing result
   */
  async signAgreement(agreementData) {
    try {
      const response = await apiClient.post(
        API_CONFIG.ENDPOINTS.USER_AGREEMENTS.SIGN_AGREEMENT,
        agreementData
      )

      if (!response.isSuccess) {
        logger.error("Sign agreement failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
          endpoint: API_CONFIG.ENDPOINTS.USER_AGREEMENTS.SIGN_AGREEMENT,
        })
      }

      return response
    } catch (error) {
      logger.error("Sign agreement failed", {
        error,
        endpoint: API_CONFIG.ENDPOINTS.USER_AGREEMENTS.SIGN_AGREEMENT,
        statusCode: error.statusCode || error.status || 500,
      })
      
      // Preserve status code from error if available
      const statusCode = error.statusCode || error.status || 500
      
      return {
        isSuccess: false,
        statusCode: statusCode,
        data: null,
        message: error.message || "Failed to sign agreement",
      }
    }
  }
}

export default new UserAgreementService()

