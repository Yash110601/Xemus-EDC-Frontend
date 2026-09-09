/**
 * CRF Rule Service
 * Handles CRF rule operations - create, update, and manage CRF rules
 */

import apiClient from "../api/client"
import { API_CONFIG } from "../api/config"
import logger from "../api/logger"
import { finalizeRuleExpressionForApi } from "@/lib/utils/ruleExpressionLiterals"

const withQuotedRuleExpression = (request = {}) => {
  if (!request || typeof request !== "object") return request
  const raw = request.expression ?? request.ruleExpression ?? ""
  const expression = finalizeRuleExpressionForApi(raw)
  if (expression !== raw && typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
    logger.info("CRF rule expression literals quoted for API", { before: raw, after: expression })
  }
  return { ...request, expression }
}

class CrfRuleService {
  /**
   * Get paginated list of CRF Rules with filters
   * @param {number} pageNumber - Page number (default: 1)
   * @param {number} pageSize - Page size (default: 10)
   * @param {number|null} crfId - CRF Design ID filter (optional)
   * @param {number|null} studyId - Study ID filter (optional)
   * @param {string|null} category - Rule category filter (optional)
   * @param {string|null} search - Search term (optional)
   * @param {boolean|null} isActive - Active status filter (optional)
   * @returns {Promise<Object>} Response with paginated CRF rules
   */
  async getCrfRulesList(pageNumber = 1, pageSize = 10, crfId = null, studyId = null, category = null, search = null, isActive = null) {
    try {
      const queryParams = new URLSearchParams({
        pageNumber: pageNumber.toString(),
        pageSize: pageSize.toString(),
      })

      if (crfId !== null && crfId !== undefined) {
        queryParams.append("crfId", crfId.toString())
      }
      if (studyId !== null && studyId !== undefined) {
        queryParams.append("studyId", studyId.toString())
      }
      if (category !== null && category !== undefined && category.trim() !== "") {
        queryParams.append("category", category.trim())
      }
      if (search !== null && search !== undefined && search.trim() !== "") {
        queryParams.append("search", search.trim())
      }
      if (isActive !== null && isActive !== undefined) {
        queryParams.append("isActive", isActive.toString())
      }

      const response = await apiClient.get(
        `${API_CONFIG.ENDPOINTS.CRF_RULES.GET_LIST}?${queryParams.toString()}`
      )

      if (!response.isSuccess) {
        logger.error("Get CRF rules list failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }

      return response
    } catch (error) {
      logger.error("Get CRF rules list failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch CRF rules list",
      }
    }
  }

  /**
   * Get CRF Rule by ID
   * @param {number} id - CRF Rule ID
   * @param {number} studyId - Study ID (required)
   * @returns {Promise<Object>} Response with CRF rule
   */
  async getCrfRuleById(id, studyId) {
    try {
      const response = await apiClient.get(
        `${API_CONFIG.ENDPOINTS.CRF_RULES.GET_BY_ID(id)}?studyId=${studyId}`
      )

      if (!response.isSuccess) {
        logger.error("Get CRF rule by ID failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }

      return response
    } catch (error) {
      logger.error("Get CRF rule by ID failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch CRF rule",
      }
    }
  }

  /**
   * Create a new CRF Rule
   * @param {Object} crfRuleRequest - CRF Rule request object
   * @returns {Promise<Object>} Response with created CRF rule
   */
  async createCrfRule(crfRuleRequest) {
    try {
      const payload = withQuotedRuleExpression(crfRuleRequest)
      const response = await apiClient.post(
        API_CONFIG.ENDPOINTS.CRF_RULES.CREATE,
        payload
      )

      if (!response.isSuccess) {
        logger.error("Create CRF rule failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }

      return response
    } catch (error) {
      logger.error("Create CRF rule failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to create CRF rule",
      }
    }
  }

  /**
   * Update CRF Rule
   * @param {number} id - CRF Rule ID
   * @param {Object} crfRuleRequest - Updated CRF Rule request object
   * @returns {Promise<Object>} Response with updated CRF rule
   */
  async updateCrfRule(id, crfRuleRequest) {
    try {
      const payload = withQuotedRuleExpression(crfRuleRequest)
      const response = await apiClient.put(
        API_CONFIG.ENDPOINTS.CRF_RULES.UPDATE(id),
        payload
      )

      if (!response.isSuccess) {
        logger.error("Update CRF rule failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }

      return response
    } catch (error) {
      logger.error("Update CRF rule failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to update CRF rule",
      }
    }
  }

  /**
   * Update CRF Rule status (Activate/Deactivate)
   * @param {number} id - CRF Rule ID
   * @param {boolean} isActive - Active status
   * @returns {Promise<Object>} Response
   */
  async updateCrfRuleStatus(id, isActive) {
    try {
      const response = await apiClient.put(
        `${API_CONFIG.ENDPOINTS.CRF_RULES.UPDATE_STATUS(id)}?isActive=${isActive}`
      )

      if (!response.isSuccess) {
        logger.error("Update CRF rule status failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }

      return response
    } catch (error) {
      logger.error("Update CRF rule status failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to update CRF rule status",
      }
    }
  }

  /**
   * Get CRF Rules by CRF Design ID
   * @param {number} crfId - CRF Design ID
   * @returns {Promise<Object>} Response with list of CRF rules
   */
  async getCrfRulesByCrfId(crfId) {
    try {
      const response = await apiClient.get(
        API_CONFIG.ENDPOINTS.CRF_RULES.GET_BY_CRF_ID(crfId)
      )

      if (!response.isSuccess) {
        logger.error("Get CRF rules by CRF ID failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }

      return response
    } catch (error) {
      logger.error("Get CRF rules by CRF ID failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch CRF rules",
      }
    }
  }

  /**
   * Get CRF Rules by Study ID
   * @param {number} studyId - Study ID
   * @returns {Promise<Object>} Response with list of CRF rules
   */
  async getCrfRulesByStudyId(studyId) {
    try {
      const response = await apiClient.get(
        API_CONFIG.ENDPOINTS.CRF_RULES.GET_BY_STUDY_ID(studyId)
      )

      if (!response.isSuccess) {
        logger.error("Get CRF rules by study ID failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }

      return response
    } catch (error) {
      logger.error("Get CRF rules by study ID failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch CRF rules",
      }
    }
  }

  /**
   * Delete a CRF Rule (soft delete)
   * @param {number} id - CRF Rule ID
   * @param {number} studyId - Study ID (required)
   * @returns {Promise<Object>} Response
   */
  async deleteCrfRule(id, studyId) {
    try {
      const response = await apiClient.delete(
        `${API_CONFIG.ENDPOINTS.CRF_RULES.DELETE(id)}?studyId=${studyId}`
      )

      if (!response.isSuccess) {
        logger.error("Delete CRF rule failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }

      return response
    } catch (error) {
      logger.error("Delete CRF rule failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to delete CRF rule",
      }
    }
  }

  /**
   * Export CRF Rules list to CSV
   * @param {number|null} crfId - CRF Design ID filter (optional)
   * @param {number|null} studyId - Study ID filter (optional)
   * @param {string|null} category - Rule category filter (optional)
   * @param {string|null} search - Search term (optional)
   * @param {boolean|null} isActive - Active status filter (optional)
   * @returns {Promise<Object>} Response with CSV file download
   */
  async exportCrfRules(crfId = null, studyId = null, category = null, search = null, isActive = null) {
    try {
      const queryParams = new URLSearchParams()

      if (crfId !== null && crfId !== undefined) {
        queryParams.append("crfId", crfId.toString())
      }
      if (studyId !== null && studyId !== undefined) {
        queryParams.append("studyId", studyId.toString())
      }
      if (category !== null && category !== undefined && category.trim() !== "") {
        queryParams.append("category", category.trim())
      }
      if (search !== null && search !== undefined && search.trim() !== "") {
        queryParams.append("search", search.trim())
      }
      if (isActive !== null && isActive !== undefined) {
        queryParams.append("isActive", isActive.toString())
      }

      const response = await apiClient.get(
        `${API_CONFIG.ENDPOINTS.CRF_RULES.EXPORT}?${queryParams.toString()}`,
        { responseType: "blob" }
      )

      if (response.isSuccess && response.data) {
        const blob = new Blob([response.data], { type: "text/csv" })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        const timestamp = new Date().toISOString().split("T")[0]
        a.download = `crf-rules-${timestamp}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)

        return { isSuccess: true, message: "CRF rules exported successfully" }
      } else {
        logger.error("Export CRF rules failed", {
          statusCode: response.statusCode,
          message: response.message,
        })
        return {
          isSuccess: false,
          statusCode: response.statusCode,
          message: response.message || "Failed to export CRF rules",
        }
      }
    } catch (error) {
      logger.error("Export CRF rules failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        message: error.message || "Failed to export CRF rules",
      }
    }
  }

  /**
   * Get all rule engine templates
   * @returns {Promise<Object>} Response with list of rule engine templates
   */
  async getAllRuleEngineTemplates() {
    try {
      const response = await apiClient.get(
        API_CONFIG.ENDPOINTS.RULE_ENGINE.GET_ALL
      )

      if (!response.isSuccess) {
        logger.error("Get all rule engine templates failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }

      return response
    } catch (error) {
      logger.error("Get all rule engine templates failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch rule engine templates",
      }
    }
  }
}

export default new CrfRuleService()

