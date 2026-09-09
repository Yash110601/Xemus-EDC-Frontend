/**
 * Dashboard Service
 * Handles dashboard data operations
 */

import apiClient from "../api/client"
import { API_CONFIG } from "../api/config"
import logger from "../api/logger"

class DashboardService {
  /**
   * Get dashboard data
   * @param {number|null} studyId - Optional study ID to filter dashboard data
   * @returns {Promise<Object>} Dashboard data response
   */
  async getDashboard(studyId = null, siteId = null) {
    try {
      const endpoint = API_CONFIG.ENDPOINTS.DASHBOARD.GET_DASHBOARD(studyId, siteId)
      logger.info("Fetching dashboard data", { endpoint, studyId, siteId })
      return await apiClient.get(endpoint)
    } catch (error) {
      logger.error("Error fetching dashboard data", { error, studyId })
      return {
        isSuccess: false,
        statusCode: error.statusCode || error.httpStatus || 500,
        data: null,
        message: error.message || "Failed to fetch dashboard data",
      }
    }
  }

  /**
   * Get role-wise multi-CRF progress
   * GET /Dashboard/multi-crf-role-progress?studyId={studyId}[&siteId={siteId}]
   */
  async getMultiCrfRoleProgress(studyId, siteId = null) {
    try {
      if (!studyId) {
        return {
          isSuccess: false,
          statusCode: 400,
          data: null,
          message: "Study ID is required",
        }
      }
      const queryParams = new URLSearchParams({ studyId: String(studyId) })
      if (siteId != null && Number(siteId) > 0) {
        queryParams.append("siteId", String(siteId))
      }
      const endpoint = `${API_CONFIG.ENDPOINTS.DASHBOARD.MULTI_CRF_ROLE_PROGRESS}?${queryParams.toString()}`
      logger.info("Fetching multi-CRF role progress", { endpoint, studyId, siteId })
      return await apiClient.get(endpoint)
    } catch (error) {
      logger.error("Error fetching multi-CRF role progress", { error, studyId, siteId })
      return {
        isSuccess: false,
        statusCode: error.statusCode || error.httpStatus || 500,
        data: null,
        message: error.message || "Failed to fetch multi-CRF role progress",
      }
    }
  }
}

export default new DashboardService()

