/**
 * CRF Data Service
 * Handles CRF data entry operations - save, update, and manage filled CRF forms
 */

import apiClient from "../api/client"
import { API_CONFIG } from "../api/config"
import logger from "../api/logger"

class CrfDataService {
  /**
   * Get paginated list of CRF Data with filters
   * @param {number} pageNumber - Page number (default: 1)
   * @param {number} pageSize - Page size (default: 10)
   * @param {number|null} studyId - Study ID filter (optional)
   * @param {number|null} patientEnrolmentId - Patient Enrolment ID filter (optional)
   * @param {number|null} crfDesignId - CRF Design ID filter (optional)
   * @param {string|null} status - CRF Data Status filter (optional) - Draft, Saved, Submitted
   * @param {boolean|null} isActive - Active status filter (optional)
   * @returns {Promise<Object>} Response with paginated CRF data
   */
  async getCrfDataList(pageNumber = 1, pageSize = 10, studyId = null, patientEnrolmentId = null, crfDesignId = null, status = null, isActive = null) {
    try {
      const queryParams = new URLSearchParams({
        pageNumber: pageNumber.toString(),
        pageSize: pageSize.toString(),
      })

      if (studyId !== null && studyId !== undefined) {
        queryParams.append("studyId", studyId.toString())
      }
      if (patientEnrolmentId !== null && patientEnrolmentId !== undefined) {
        queryParams.append("patientEnrolmentId", patientEnrolmentId.toString())
      }
      if (crfDesignId !== null && crfDesignId !== undefined) {
        queryParams.append("crfDesignId", crfDesignId.toString())
      }
      if (status !== null && status !== undefined) {
        queryParams.append("status", status.toString())
      }
      if (isActive !== null && isActive !== undefined) {
        queryParams.append("isActive", isActive.toString())
      }

      const response = await apiClient.get(
        `${API_CONFIG.ENDPOINTS.CRF_DATA.GET_LIST}?${queryParams.toString()}`
      )

      if (!response.isSuccess) {
        logger.error("Get CRF data list failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }

      return response
    } catch (error) {
      logger.error("Get CRF data list failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch CRF data list",
      }
    }
  }

  /**
   * Get Patient and Visit Data for CRF Data Entry
   * @param {number} studyId - Study ID (required)
   * @param {number|null} siteId - Site ID (optional)
   * @returns {Promise<Object>} Response with patient and visit data
   */
  async getPatientAndVisitDataForCrfDataEntry(studyId, siteId = null) {
    try {
      const queryParams = new URLSearchParams({
        studyId: studyId.toString(),
      })

      if (siteId !== null && siteId !== undefined) {
        queryParams.append("siteId", siteId.toString())
      }

      const response = await apiClient.get(
        `${API_CONFIG.ENDPOINTS.CRF_DATA.GET_PATIENT_AND_VISIT_DATA}?${queryParams.toString()}`
      )

      if (!response.isSuccess) {
        logger.error("Get patient and visit data for CRF data entry failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }

      return response
    } catch (error) {
      logger.error("Get patient and visit data for CRF data entry failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch patient and visit data",
      }
    }
  }

  /**
   * Get patient visit-wise primary visit dates chain for date restriction
   * @param {number} studyId - Study ID (required)
   * @param {number|null} siteId - Site ID (optional)
   * @param {number} patientEnrolmentId - Patient enrolment ID (required)
   * @returns {Promise<Object>} Response with ordered visit date chain
   */
  async getPatientVisitPrimaryVisitDates(studyId, siteId = null, patientEnrolmentId) {
    try {
      const queryParams = new URLSearchParams({
        studyId: studyId.toString(),
        patientEnrolmentId: patientEnrolmentId.toString(),
      })

      if (siteId !== null && siteId !== undefined) {
        queryParams.append("siteId", siteId.toString())
      }

      const response = await apiClient.get(
        `${API_CONFIG.ENDPOINTS.CRF_DATA.GET_PATIENT_VISIT_PRIMARY_VISIT_DATES}?${queryParams.toString()}`
      )

      if (!response.isSuccess) {
        logger.error("Get patient visit primary visit dates failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }

      return response
    } catch (error) {
      logger.error("Get patient visit primary visit dates failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch patient visit primary visit dates",
      }
    }
  }

  /**
   * Get CRF Data by ID
   * @param {number} id - CRF Data ID
   * @param {number} studyId - Study ID (required)
   * @returns {Promise<Object>} Response with CRF data
   */
  async getCrfDataById(id, studyId) {
    try {
      const response = await apiClient.get(
        `${API_CONFIG.ENDPOINTS.CRF_DATA.GET_BY_ID(id)}?studyId=${studyId}`
      )

      if (!response.isSuccess) {
        logger.error("Get CRF data by ID failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }

      return response
    } catch (error) {
      logger.error("Get CRF data by ID failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch CRF data",
      }
    }
  }

  /**
   * Get CRF required-field progress with section breakdown (req §8.1).
   * @param {number} crfDataId
   * @param {number} studyId
   */
  async getCrfProgress(crfDataId, studyId) {
    try {
      if (!crfDataId || !studyId) {
        return {
          isSuccess: false,
          statusCode: 400,
          data: null,
          message: "CRF data ID and study ID are required",
        }
      }

      const response = await apiClient.get(
        API_CONFIG.ENDPOINTS.CRF_DATA.GET_CRF_PROGRESS(crfDataId, studyId),
      )

      if (!response.isSuccess) {
        logger.error("Get CRF progress failed", {
          crfDataId,
          studyId,
          statusCode: response.statusCode,
          message: response.message,
        })
      }

      return response
    } catch (error) {
      logger.error("Get CRF progress failed", { error, crfDataId, studyId })
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch CRF progress",
      }
    }
  }

  /**
   * Create new CRF Data (save filled form)
   * @param {Object} crfDataRequest - CRF Data request object
   * @returns {Promise<Object>} Response with created CRF data
   */
  async createCrfData(crfDataRequest) {
    try {
      const response = await apiClient.post(
        API_CONFIG.ENDPOINTS.CRF_DATA.CREATE,
        crfDataRequest
      )

      if (!response.isSuccess) {
        logger.error("Create CRF data failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }

      return response
    } catch (error) {
      logger.error("Create CRF data failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to create CRF data",
      }
    }
  }

  /**
   * Update CRF Data (update filled form - only if status is Draft)
   * @param {number} id - CRF Data ID
   * @param {Object} crfDataRequest - Updated CRF Data request object
   * @returns {Promise<Object>} Response with updated CRF data
   */
  async updateCrfData(id, crfDataRequest) {
    try {
      const response = await apiClient.put(
        API_CONFIG.ENDPOINTS.CRF_DATA.UPDATE(id),
        crfDataRequest
      )

      if (!response.isSuccess) {
        logger.error("Update CRF data failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }

      return response
    } catch (error) {
      logger.error("Update CRF data failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to update CRF data",
      }
    }
  }

  /**
   * Update CRF Data Status (Draft -> Saved or Submitted)
   * @param {number} id - CRF Data ID
   * @param {Object} statusRequest - Status update request object
   * @returns {Promise<Object>} Response with updated CRF data
   */
  async updateCrfDataStatus(id, statusRequest) {
    try {
      const response = await apiClient.put(
        API_CONFIG.ENDPOINTS.CRF_DATA.UPDATE_STATUS(id),
        statusRequest
      )

      if (!response.isSuccess) {
        logger.error("Update CRF data status failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }

      return response
    } catch (error) {
      logger.error("Update CRF data status failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to update CRF data status",
      }
    }
  }

  /**
   * Export CRF Data list to CSV
   * @param {number|null} studyId - Study ID filter (optional)
   * @param {number|null} patientEnrolmentId - Patient Enrolment ID filter (optional)
   * @param {number|null} crfDesignId - CRF Design ID filter (optional)
   * @param {string|null} status - CRF Data Status filter (optional)
   * @param {boolean|null} isActive - Active status filter (optional)
   * @returns {Promise<Object>} Response with CSV file download
   */
  async exportCrfData(studyId = null, patientEnrolmentId = null, crfDesignId = null, status = null, isActive = null) {
    try {
      const queryParams = new URLSearchParams()

      if (studyId !== null && studyId !== undefined) {
        queryParams.append("studyId", studyId.toString())
      }
      if (patientEnrolmentId !== null && patientEnrolmentId !== undefined) {
        queryParams.append("patientEnrolmentId", patientEnrolmentId.toString())
      }
      if (crfDesignId !== null && crfDesignId !== undefined) {
        queryParams.append("crfDesignId", crfDesignId.toString())
      }
      if (status !== null && status !== undefined) {
        queryParams.append("status", status.toString())
      }
      if (isActive !== null && isActive !== undefined) {
        queryParams.append("isActive", isActive.toString())
      }

      // Use fetch directly for blob response
      const baseURL = apiClient.baseURL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5154/api"
      const url = `${baseURL}${API_CONFIG.ENDPOINTS.CRF_DATA.EXPORT}?${queryParams.toString()}`
      
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
          errorData = { message: errorText || "Failed to export CRF data" }
        }
        
        logger.error("Export CRF data failed", {
          statusCode: response.status,
          message: errorData.message,
        })
        
        return {
          isSuccess: false,
          statusCode: response.status,
          message: errorData.message || "Failed to export CRF data",
        }
      }

      // Get blob from response
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      
      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get("content-disposition")
      let fileName = `crf-data-${new Date().toISOString().split("T")[0]}.csv`
      
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

      return { isSuccess: true, message: "CRF data exported successfully" }
    } catch (error) {
      logger.error("Export CRF data failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        message: error.message || "Failed to export CRF data",
      }
    }
  }
}

export default new CrfDataService()

