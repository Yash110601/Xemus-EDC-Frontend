/**
 * Agreement Service
 * Handles agreement management operations
 */

import apiClient from "../api/client"
import { API_CONFIG } from "../api/config"
import logger from "../api/logger"

class AgreementService {
  /**
   * Create a new agreement
   * @param {Object} agreementData - Agreement data with FormData format
   * @returns {Promise<Object>} API response
   */
  async createAgreement(agreementData) {
    try {
      const formData = new FormData()

      // Append all fields to FormData
      Object.keys(agreementData).forEach((key) => {
        const value = agreementData[key]
        
        // Skip undefined values
        if (value === undefined) {
          return
        }
        
        // Handle File objects (Logo and Signature)
        if ((key === "Logo" || key === "Signature") && value instanceof File) {
          formData.append(key, value)
        }
        // Handle null values - send as empty string for FormData (backend will convert to null)
        else if (value === null) {
          formData.append(key, "")
        }
        // Handle empty strings - send as empty string (backend will convert to null)
        else if (value === "" && !(value instanceof File)) {
          formData.append(key, "")
        }
        // Handle all other values (strings, numbers, etc.)
        else if (!(value instanceof File) && typeof value !== "object") {
          formData.append(key, value.toString())
        }
      })

      const response = await apiClient.post(API_CONFIG.ENDPOINTS.AGREEMENTS.CREATE, formData)
      
      if (!response.isSuccess) {
        logger.error("Create agreement failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }
      
      return response
    } catch (error) {
      logger.error("Create agreement failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to create agreement",
      }
    }
  }

  /**
   * Update an existing agreement
   * @param {number} id - Agreement ID
   * @param {Object} agreementData - Agreement data with FormData format
   * @returns {Promise<Object>} API response
   */
  async updateAgreement(id, agreementData) {
    try {
      const formData = new FormData()

      // Append all fields to FormData
      Object.keys(agreementData).forEach((key) => {
        const value = agreementData[key]
        
        // Skip undefined values
        if (value === undefined) {
          return
        }
        
        // Handle File objects (Logo and Signature)
        if ((key === "Logo" || key === "Signature") && value instanceof File) {
          formData.append(key, value)
        }
        // Handle null values - send as empty string for FormData (backend will convert to null)
        else if (value === null) {
          formData.append(key, "")
        }
        // Handle empty strings - send as empty string (backend will convert to null)
        else if (value === "" && !(value instanceof File)) {
          formData.append(key, "")
        }
        // Handle all other values (strings, numbers, etc.)
        else if (!(value instanceof File) && typeof value !== "object") {
          formData.append(key, value.toString())
        }
      })

      const response = await apiClient.put(API_CONFIG.ENDPOINTS.AGREEMENTS.UPDATE(id), formData)
      
      if (!response.isSuccess) {
        logger.error("Update agreement failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }
      
      return response
    } catch (error) {
      logger.error("Update agreement failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to update agreement",
      }
    }
  }

  /**
   * Get all agreements with pagination
   * @param {number} pageNumber - Page number (default: 1)
   * @param {number} pageSize - Page size (default: 10)
   * @param {string} search - Search term (optional)
   * @param {number} studyId - Study ID filter (optional)
   * @param {boolean} isActive - Active status filter (optional)
   * @returns {Promise<Object>} API response
   */
  async getAgreementsList(pageNumber = 1, pageSize = 10, search = null, studyId = null, isActive = null) {
    try {
      const queryParams = new URLSearchParams({
        pageNumber: pageNumber.toString(),
        pageSize: pageSize.toString(),
      })
      
      if (search) {
        queryParams.append("search", search)
      }
      if (studyId !== null && studyId !== undefined) {
        queryParams.append("studyId", studyId.toString())
      }
      if (isActive !== null && isActive !== undefined) {
        queryParams.append("isActive", isActive.toString())
      }
      
      return await apiClient.get(`${API_CONFIG.ENDPOINTS.AGREEMENTS.GET_LIST}?${queryParams.toString()}`)
    } catch (error) {
      logger.error("Get agreements list failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch agreements",
      }
    }
  }

  /**
   * Get agreement by ID
   * @param {number} id - Agreement ID
   * @returns {Promise<Object>} API response
   */
  async getAgreementById(id) {
    try {
      return await apiClient.get(API_CONFIG.ENDPOINTS.AGREEMENTS.BY_ID(id))
    } catch (error) {
      logger.error("Get agreement by ID failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch agreement",
      }
    }
  }

  /**
   * Get active agreement for a study
   * @param {number} studyId - Study ID
   * @returns {Promise<Object>} API response
   */
  async getActiveAgreement(studyId) {
    try {
      return await apiClient.get(API_CONFIG.ENDPOINTS.AGREEMENTS.ACTIVE_BY_STUDY(studyId))
    } catch (error) {
      logger.error("Get active agreement failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch active agreement",
      }
    }
  }

  /**
   * Delete an agreement
   * @param {number} id - Agreement ID
   * @returns {Promise<Object>} API response
   */
  async deleteAgreement(id) {
    try {
      return await apiClient.delete(API_CONFIG.ENDPOINTS.AGREEMENTS.DELETE(id))
    } catch (error) {
      logger.error("Delete agreement failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to delete agreement",
      }
    }
  }
}

export default new AgreementService()

