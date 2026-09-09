/**
 * Study Settings Service
 * Per-study operational flags (patient status, SDV, multi-CRF, visit date, query role).
 */

import apiClient from "../api/client"
import { API_CONFIG } from "../api/config"
import logger from "../api/logger"

class StudySettingsService {
  /**
   * GET /api/StudySettings/GetStudySettingsByStudyId/{studyId}
   */
  async getByStudyId(studyId) {
    try {
      if (!studyId) {
        return {
          isSuccess: false,
          statusCode: 400,
          data: null,
          message: "Study ID is required",
        }
      }
      return await apiClient.get(API_CONFIG.ENDPOINTS.STUDY_SETTINGS.GET_BY_STUDY(studyId))
    } catch (error) {
      logger.error("Get study settings by study id failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || error.httpStatus || 500,
        data: null,
        message: error.message || "Failed to fetch study settings",
      }
    }
  }

  /**
   * POST /api/StudySettings/CreateStudySettings
   */
  async create(payload) {
    try {
      return await apiClient.post(API_CONFIG.ENDPOINTS.STUDY_SETTINGS.CREATE, payload)
    } catch (error) {
      logger.error("Create study settings failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || error.httpStatus || 500,
        data: null,
        message: error.message || "Failed to create study settings",
      }
    }
  }

  /**
   * PUT /api/StudySettings/UpdateStudySettings/{studyId}
   */
  async update(studyId, payload) {
    try {
      if (!studyId) {
        return {
          isSuccess: false,
          statusCode: 400,
          data: null,
          message: "Study ID is required",
        }
      }
      return await apiClient.put(API_CONFIG.ENDPOINTS.STUDY_SETTINGS.UPDATE(studyId), payload)
    } catch (error) {
      logger.error("Update study settings failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || error.httpStatus || 500,
        data: null,
        message: error.message || "Failed to update study settings",
      }
    }
  }
}

export default new StudySettingsService()
