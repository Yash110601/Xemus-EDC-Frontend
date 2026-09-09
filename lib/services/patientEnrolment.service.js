/**
 * Patient Enrolment Service
 * Handles patient enrolment operations
 */

import apiClient from "../api/client"
import { API_CONFIG } from "../api/config"
import logger from "../api/logger"

/** Patient status codes for POST Studies/.../status */
export const PATIENT_STATUS_CODES = {
  SCREENING: 1,
  SCREEN_FAILED: 2,
  RANDOMIZED_ENROLLED: 3,
  ON_TREATMENT: 4,
  DISCONTINUED: 5,
  WITHDRAWN: 6,
  LOST_TO_FOLLOW_UP: 7,
  DEATH: 8,
  COMPLETED: 9,
}

class PatientEnrolmentService {
  /**
   * Create a patient enrolment
   * @param {Object} patientEnrolmentData - Patient enrolment data
   * @returns {Promise<Object>} Response with created patient enrolment
   */
  async createPatientEnrolment(patientEnrolmentData) {
    try {
      const response = await apiClient.post(
        API_CONFIG.ENDPOINTS.PATIENT_ENROLMENTS.CREATE,
        patientEnrolmentData
      )

      if (!response.isSuccess) {
        logger.error("Create patient enrolment failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }

      return response
    } catch (error) {
      logger.error("Create patient enrolment failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to create patient enrolment",
      }
    }
  }

  /**
   * Update a patient enrolment
   * @param {number} id - Patient enrolment ID
   * @param {Object} patientEnrolmentData - Updated patient enrolment data
   * @returns {Promise<Object>} Response with updated patient enrolment
   */
  async updatePatientEnrolment(id, patientEnrolmentData) {
    try {
      const response = await apiClient.put(
        API_CONFIG.ENDPOINTS.PATIENT_ENROLMENTS.UPDATE(id),
        patientEnrolmentData
      )

      if (!response.isSuccess) {
        logger.error("Update patient enrolment failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }

      return response
    } catch (error) {
      logger.error("Update patient enrolment failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to update patient enrolment",
      }
    }
  }

  /**
   * Update patient status (study completion / discontinued / etc.)
   * POST api/Studies/{studyId}/patients/{patientEnrolmentId}/status
   * @param {number} studyId - Study ID
   * @param {number} patientEnrolmentId - Patient enrolment ID
   * @param {{ newStatusCode: number, reason?: string|null }} body - newStatusCode: 1=Screening, 2=ScreenFailed, 3=RandomizedEnrolled, 4=OnTreatment, 5=Discontinued, 6=Withdrawn, 7=LostToFollowUp, 8=Death, 9=Completed
   * @returns {Promise<Object>} Response with data.currentStatusCode, data.currentStatusName, data.allowedNextStatuses, etc.
   */
  async updatePatientStatus(studyId, patientEnrolmentId, { newStatusCode, reason = null }) {
    try {
      const url = API_CONFIG.ENDPOINTS.STUDIES.PATIENT_STATUS(studyId, patientEnrolmentId)
      console.log("[PatientStatus] calling API", {
        method: "POST",
        url,
        studyId,
        patientEnrolmentId,
        body: { newStatusCode, reason },
      })
      const response = await apiClient.post(url, { newStatusCode, reason })
      console.log("[PatientStatus] API response", {
        isSuccess: response?.isSuccess,
        statusCode: response?.statusCode,
        message: response?.message,
        data: response?.data,
      })

      if (!response.isSuccess) {
        logger.error("Update patient status failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }

      return response
    } catch (error) {
      logger.error("Update patient status failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to update patient status",
      }
    }
  }

  /**
   * Update patient enrolment status (activate/deactivate)
   * @param {number} id - Patient enrolment ID
   * @param {boolean} isActive - Active status
   * @returns {Promise<Object>} Response
   */
  async updatePatientEnrolmentStatus(id, isActive) {
    try {
      const response = await apiClient.put(
        `${API_CONFIG.ENDPOINTS.PATIENT_ENROLMENTS.UPDATE_STATUS(id)}?isActive=${isActive}`
      )

      if (!response.isSuccess) {
        logger.error("Update patient enrolment status failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }

      return response
    } catch (error) {
      logger.error("Update patient enrolment status failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to update patient enrolment status",
      }
    }
  }

  /**
   * Get patient enrolment by ID
   * @param {number} id - Patient enrolment ID
   * @returns {Promise<Object>} Response with patient enrolment
   */
  async getPatientEnrolmentById(id) {
    try {
      const response = await apiClient.get(
        API_CONFIG.ENDPOINTS.PATIENT_ENROLMENTS.BY_ID(id)
      )

      if (!response.isSuccess) {
        logger.error("Get patient enrolment by ID failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }

      return response
    } catch (error) {
      logger.error("Get patient enrolment by ID failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch patient enrolment",
      }
    }
  }

  /**
   * Get paginated list of patient enrolments
   * @param {number} studyId - Study ID (required)
   * @param {number|null} siteId - Site ID (required, nullable)
   * @param {number} pageNumber - Page number (default: 1)
   * @param {number} pageSize - Page size (default: 10)
   * @param {string|null} search - Search term (optional)
   * @returns {Promise<Object>} Response with paginated patient enrolments
   */
  async getPatientEnrolmentsList(studyId, siteId, pageNumber = 1, pageSize = 10, search = null) {
    try {
      const queryParams = new URLSearchParams({
        studyId: studyId.toString(),
        pageNumber: pageNumber.toString(),
        pageSize: pageSize.toString(),
      })

      if (siteId !== null && siteId !== undefined) {
        queryParams.append("siteId", siteId.toString())
      }

      if (search) {
        queryParams.append("search", search)
      }

      const response = await apiClient.get(
        `${API_CONFIG.ENDPOINTS.PATIENT_ENROLMENTS.GET_LIST}?${queryParams.toString()}`
      )

      if (!response.isSuccess) {
        logger.error("Get patient enrolments list failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }

      return response
    } catch (error) {
      logger.error("Get patient enrolments list failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch patient enrolments",
      }
    }
  }

  /**
   * Export patient enrolments to CSV
   * @param {number} studyId - Study ID (required)
   * @param {number|null} siteId - Site ID (optional)
   * @returns {Promise<Object>} Response with CSV file download
   */
  async exportPatientEnrolments(studyId, siteId = null) {
    try {
      const queryParams = new URLSearchParams({
        studyId: studyId.toString(),
      })

      if (siteId !== null && siteId !== undefined) {
        queryParams.append("siteId", siteId.toString())
      }

      // Use fetch directly for blob response
      const baseURL = apiClient.baseURL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5154/api"
      const url = `${baseURL}${API_CONFIG.ENDPOINTS.PATIENT_ENROLMENTS.EXPORT}?${queryParams.toString()}`
      
      // Get auth token
      const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null
      
      const response = await fetch(url, {
        method: "GET",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { message: errorText || "Failed to export patient enrolments" }
        }
        
        logger.error("Export patient enrolments failed", {
          statusCode: response.status,
          message: errorData.message,
        })
        
        return {
          isSuccess: false,
          statusCode: response.status,
          message: errorData.message || "Failed to export patient enrolments",
        }
      }

      // Get blob from response
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      
      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get("content-disposition")
      let fileName = `patient-enrolments-study-${studyId}${siteId ? `-site-${siteId}` : ""}-${new Date().toISOString().split("T")[0]}.csv`
      
      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (fileNameMatch && fileNameMatch[1]) {
          fileName = fileNameMatch[1].replace(/['"]/g, "")
        }
      }
      
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)

      return { isSuccess: true, message: "Patient enrolments exported successfully" }
    } catch (error) {
      logger.error("Export patient enrolments failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        message: error.message || "Failed to export patient enrolments",
      }
    }
  }

  /**
   * Delete patient enrolment (Note: C# controller doesn't have Delete endpoint, use UpdateStatus with isActive=false instead)
   * @deprecated Use updatePatientEnrolmentStatus(id, false) instead
   */
  async deletePatientEnrolment(id) {
    try {
      // Use UpdateStatus with isActive=false as Delete endpoint doesn't exist in C# controller
      return await this.updatePatientEnrolmentStatus(id, false)
    } catch (error) {
      logger.error("Delete patient enrolment failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to delete patient enrolment",
      }
    }
  }

  /**
   * Get patient enrolments for dropdown
   * @param {number} studyId - Study ID (required)
   * @param {number} siteId - Site ID (required)
   * @returns {Promise<Object>} Response with patient enrolments list
   */
  async getPatientEnrolmentsForDropdown(studyId, siteId, options = {}) {
    try {
      const queryParams = new URLSearchParams({
        studyId: studyId.toString(),
        siteId: siteId.toString(),
      })

      const response = await apiClient.get(
        `${API_CONFIG.ENDPOINTS.PATIENT_ENROLMENTS.BASE}/GetPatientEnrolmentsForDropdown?${queryParams.toString()}`,
        options
      )

      if (!response.isSuccess) {
        logger.error("Get patient enrolments for dropdown failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }

      return response
    } catch (error) {
      logger.error("Get patient enrolments for dropdown failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch patient enrolments for dropdown",
      }
    }
  }
}

export default new PatientEnrolmentService()
