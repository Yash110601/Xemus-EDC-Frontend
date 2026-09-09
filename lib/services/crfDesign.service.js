/**
 * CRF Design Service
 * Handles CRF design operations - create, update, and manage CRF designs
 */

import apiClient from "../api/client"
import { API_CONFIG } from "../api/config"
import logger from "../api/logger"

class CrfDesignService {
  /**
   * Get paginated list of CRF Designs with filters
   * @param {number} pageNumber - Page number (default: 1)
   * @param {number} pageSize - Page size (default: 10)
   * @param {number|null} studyId - Study ID filter (optional)
   * @param {string|null} search - Search term (optional)
   * @param {boolean|null} isActive - Active status filter (optional)
   * @returns {Promise<Object>} Response with paginated CRF designs
   */
  async getCrfDesignsList(pageNumber = 1, pageSize = 10, studyId = null, search = null, isActive = null) {
    try {
      const queryParams = new URLSearchParams({
        pageNumber: pageNumber.toString(),
        pageSize: pageSize.toString(),
      })

      if (studyId !== null && studyId !== undefined) {
        queryParams.append("studyId", studyId.toString())
      }
      if (search !== null && search !== undefined && search.trim() !== "") {
        queryParams.append("search", search.trim())
      }
      if (isActive !== null && isActive !== undefined) {
        queryParams.append("isActive", isActive.toString())
      }

      const response = await apiClient.get(
        `${API_CONFIG.ENDPOINTS.CRF_DESIGNS.GET_LIST}?${queryParams.toString()}`
      )

      if (!response.isSuccess) {
        logger.error("Get CRF designs list failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }

      return response
    } catch (error) {
      logger.error("Get CRF designs list failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch CRF designs list",
      }
    }
  }

  /**
   * Get CRF Design by ID
   * @param {number} id - CRF Design ID
   * @param {number} studyId - Study ID (required)
   * @returns {Promise<Object>} Response with CRF design
   */
  async getCrfDesignById(id, studyId) {
    const designId = Number.parseInt(String(id ?? ""), 10)
    const sid = Number.parseInt(String(studyId ?? ""), 10)
    if (!Number.isFinite(designId) || designId <= 0) {
      return {
        isSuccess: false,
        statusCode: 400,
        data: null,
        message: "CRF design ID is required",
      }
    }
    if (!Number.isFinite(sid) || sid <= 0) {
      return {
        isSuccess: false,
        statusCode: 400,
        data: null,
        message: "Study ID is required",
      }
    }

    try {
      const response = await apiClient.get(
        `${API_CONFIG.ENDPOINTS.CRF_DESIGNS.GET_BY_ID(designId)}?studyId=${sid}`,
      )

      if (!response?.isSuccess) {
        const statusCode = response?.statusCode ?? response?.httpStatus ?? null
        const detail = {
          designId,
          studyId: sid,
          statusCode,
          message: response?.message || "Failed to fetch CRF design",
        }
        // Missing/orphan designs are common during study schedule prefetch — warn, don't throw console.error noise.
        if (statusCode === 404 || statusCode === 400) {
          logger.warn("Get CRF design by ID failed", detail)
        } else {
          logger.error("Get CRF design by ID failed", detail)
        }
      }

      return response
    } catch (error) {
      const detail = {
        designId,
        studyId: sid,
        statusCode: error?.statusCode ?? error?.httpStatus ?? 500,
        message: error?.message || "Failed to fetch CRF design",
      }
      logger.error("Get CRF design by ID failed", detail)
      return {
        isSuccess: false,
        statusCode: detail.statusCode,
        data: null,
        message: detail.message,
      }
    }
  }

  /**
   * Create a new CRF Design
   * @param {Object} crfDesignRequest - CRF Design request object
   * @returns {Promise<Object>} Response with created CRF design
   */
  async createCrfDesign(crfDesignRequest) {
    try {
      const response = await apiClient.post(
        API_CONFIG.ENDPOINTS.CRF_DESIGNS.CREATE,
        crfDesignRequest
      )

      if (!response.isSuccess) {
        logger.error("Create CRF design failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }

      return response
    } catch (error) {
      logger.error("Create CRF design failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to create CRF design",
      }
    }
  }

  /**
   * Update CRF Design
   * @param {number} id - CRF Design ID
   * @param {Object} crfDesignRequest - Updated CRF Design request object
   * @returns {Promise<Object>} Response with updated CRF design
   */
  async updateCrfDesign(id, crfDesignRequest) {
    try {
      const response = await apiClient.put(
        API_CONFIG.ENDPOINTS.CRF_DESIGNS.UPDATE(id),
        crfDesignRequest
      )

      if (!response.isSuccess) {
        logger.error("Update CRF design failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }

      return response
    } catch (error) {
      logger.error("Update CRF design failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to update CRF design",
      }
    }
  }

  /**
   * Update CRF Design status (Activate/Deactivate)
   * @param {number} id - CRF Design ID
   * @param {Object} statusRequest - Status update request object with IsActive property
   * @returns {Promise<Object>} Response with updated CRF design
   */
  async updateCrfDesignStatus(id, statusRequest) {
    try {
      const response = await apiClient.put(
        API_CONFIG.ENDPOINTS.CRF_DESIGNS.UPDATE_STATUS(id),
        statusRequest
      )

      if (!response.isSuccess) {
        logger.error("Update CRF design status failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }

      return response
    } catch (error) {
      logger.error("Update CRF design status failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to update CRF design status",
      }
    }
  }

  /**
   * Get all CRF Designs for a study
   * @param {number} studyId - Study ID
   * @returns {Promise<Object>} Response with list of CRF designs
   */
  async getCrfDesignsByStudyId(studyId) {
    try {
      const response = await apiClient.get(
        API_CONFIG.ENDPOINTS.CRF_DESIGNS.GET_BY_STUDY_ID(studyId)
      )

      if (!response.isSuccess) {
        logger.error("Get CRF designs by study ID failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }

      return response
    } catch (error) {
      logger.error("Get CRF designs by study ID failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch CRF designs",
      }
    }
  }

  /**
   * Export CRF Designs list to CSV
   * @param {number|null} studyId - Study ID filter (optional)
   * @param {string|null} search - Search term (optional)
   * @param {boolean|null} isActive - Active status filter (optional)
   * @returns {Promise<Object>} Response with CSV file download
   */
  async exportCrfDesigns(studyId = null, search = null, isActive = null) {
    try {
      const queryParams = new URLSearchParams()

      if (studyId !== null && studyId !== undefined) {
        queryParams.append("studyId", studyId.toString())
      }
      if (search !== null && search !== undefined && search.trim() !== "") {
        queryParams.append("search", search.trim())
      }
      if (isActive !== null && isActive !== undefined) {
        queryParams.append("isActive", isActive.toString())
      }

      const response = await apiClient.get(
        `${API_CONFIG.ENDPOINTS.CRF_DESIGNS.EXPORT}?${queryParams.toString()}`,
        { responseType: "blob" }
      )

      if (response.isSuccess && response.data) {
        const blob = new Blob([response.data], { type: "text/csv" })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        const timestamp = new Date().toISOString().split("T")[0]
        a.download = `crf-designs-${timestamp}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)

        return { isSuccess: true, message: "CRF designs exported successfully" }
      } else {
        logger.error("Export CRF designs failed", {
          statusCode: response.statusCode,
          message: response.message,
        })
        return {
          isSuccess: false,
          statusCode: response.statusCode,
          message: response.message || "Failed to export CRF designs",
        }
      }
    } catch (error) {
      logger.error("Export CRF designs failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        message: error.message || "Failed to export CRF designs",
      }
    }
  }

  /**
   * Get CRF Designs for dropdown by study ID
   * @param {number} studyId - Study ID
   * @returns {Promise<Object>} Response with CRF designs list
   */
  async getCrfDesignsForDropdown(studyId, options = {}) {
    try {
      const response = await apiClient.get(
        `${API_CONFIG.ENDPOINTS.CRF_DESIGNS.BASE}/GetCrfDesignsForDropdown/${studyId}`,
        options
      )

      if (!response.isSuccess) {
        logger.error("Get CRF designs for dropdown failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }

      return response
    } catch (error) {
      logger.error("Get CRF designs for dropdown failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch CRF designs for dropdown",
      }
    }
  }

  /**
   * Export portable CRF bundle (design + rules) for cross-environment promotion.
   */
  async exportBundle(crfDesignId, studyId, { includeRules = true } = {}) {
    try {
      const params = new URLSearchParams({
        studyId: String(studyId),
        includeRules: String(includeRules),
      })
      const response = await apiClient.get(
        `${API_CONFIG.ENDPOINTS.CRF_DESIGNS.EXPORT_BUNDLE(crfDesignId)}?${params.toString()}`
      )
      if (!response?.isSuccess) {
        throw new Error(response?.message || "Failed to export CRF bundle")
      }
      return response.data ?? response.Data
    } catch (error) {
      logger.error("Export CRF bundle failed", error)
      throw error
    }
  }

  /**
   * Import portable CRF bundle into target study (atomic design + rules).
   */
  async importBundle(payload) {
    try {
      const response = await apiClient.post(
        API_CONFIG.ENDPOINTS.CRF_DESIGNS.IMPORT_BUNDLE,
        payload
      )
      if (!response?.isSuccess) {
        throw new Error(response?.message || "Failed to import CRF bundle")
      }
      return response.data ?? response.Data
    } catch (error) {
      logger.error("Import CRF bundle failed", error)
      throw error
    }
  }

  /**
   * Check whether a CRF design can be permanently deleted for a study.
   */
  async getDeleteEligibility(id, studyId) {
    try {
      const response = await apiClient.get(
        `${API_CONFIG.ENDPOINTS.CRF_DESIGNS.DELETE_ELIGIBILITY(id)}?studyId=${studyId}`
      )
      if (!response?.isSuccess) {
        const msg = response?.message || "Failed to check delete eligibility"
        if (
          response?.httpStatus === 404 &&
          !/CRF Design not found/i.test(msg) &&
          !/Study ID does not match/i.test(msg)
        ) {
          throw new Error(
            "Delete eligibility API returned 404. Rebuild and restart the .NET API (Pr.Edc.API), then try again."
          )
        }
        throw new Error(msg)
      }
      return response.data ?? response.Data
    } catch (error) {
      logger.error("Get CRF delete eligibility failed", error)
      throw error
    }
  }

  /**
   * Permanently delete a CRF design (soft-delete on server with safety guards).
   */
  async deleteCrfDesign(id, studyId) {
    try {
      const response = await apiClient.delete(
        `${API_CONFIG.ENDPOINTS.CRF_DESIGNS.DELETE(id)}?studyId=${studyId}`
      )
      if (!response?.isSuccess) {
        throw new Error(response?.message || "Failed to delete CRF design")
      }
      return response
    } catch (error) {
      logger.error("Delete CRF design failed", error)
      throw error
    }
  }
}

export default new CrfDesignService()

