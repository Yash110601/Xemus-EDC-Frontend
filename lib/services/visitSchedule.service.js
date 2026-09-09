/**
 * Visit Schedule Service
 * Handles visit schedule management operations
 */

import apiClient from "../api/client"
import { API_CONFIG } from "../api/config"
import logger from "../api/logger"
import { mapVisitTypeEnumToLabel, mapVisitTypeLabelToEnum } from "../visitTypes"

class VisitScheduleService {
  /**
   * Get all Visit Schedules with pagination and filters
   * @param {number} pageNumber - Page number (default: 1)
   * @param {number} pageSize - Page size (default: 10)
   * @param {number|null} studyId - Filter by study ID (optional)
   * @param {string|null} search - Search query (optional)
   * @param {boolean|null} isActive - Filter by active status (optional)
   */
  async getVisitSchedulesList(pageNumber = 1, pageSize = 10, studyId = null, search = null, isActive = null) {
    try {
      const queryParams = new URLSearchParams({
        pageNumber: pageNumber.toString(),
        pageSize: pageSize.toString(),
      })
      
      if (studyId !== null) {
        queryParams.append("studyId", studyId.toString())
      }
      if (search) {
        queryParams.append("search", search)
      }
      if (isActive !== null) {
        queryParams.append("isActive", isActive.toString())
      }
      
      return await apiClient.get(`${API_CONFIG.ENDPOINTS.VISIT_SCHEDULES.GET_LIST}?${queryParams.toString()}`)
    } catch (error) {
      logger.error("Get visit schedules list failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch visit schedules",
      }
    }
  }

  /**
   * Get Visit Schedule by ID
   * @param {number} id - Visit Schedule ID
   */
  async getVisitScheduleById(id) {
    try {
      return await apiClient.get(API_CONFIG.ENDPOINTS.VISIT_SCHEDULES.BY_ID(id))
    } catch (error) {
      logger.error("Get visit schedule by ID failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch visit schedule",
      }
    }
  }

  /**
   * Get all Visit Schedules for a study
   * @param {number} studyId - Study ID
   */
  async getVisitSchedulesByStudyId(studyId) {
    try {
      return await apiClient.get(API_CONFIG.ENDPOINTS.VISIT_SCHEDULES.BY_STUDY(studyId))
    } catch (error) {
      logger.error("Get visit schedules by study ID failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch visit schedules for study",
      }
    }
  }

  /**
   * Get Visit Schedules for dropdown (only for Visit-based studies)
   * @param {number} studyId - Study ID
   * @param {number|null} crfDesignId - CRF Design ID (optional)
   */
  async getVisitSchedulesForDropdown(studyId, crfDesignId = null, options = {}) {
    try {
      let url = API_CONFIG.ENDPOINTS.VISIT_SCHEDULES.GET_DROPDOWN(studyId)
      if (crfDesignId !== null && crfDesignId > 0) {
        const queryParams = new URLSearchParams({
          crfDesignId: crfDesignId.toString(),
        })
        url += `?${queryParams.toString()}`
      }
      return await apiClient.get(url, options)
    } catch (error) {
      logger.error("Get visit schedules for dropdown failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch visit schedules for dropdown",
      }
    }
  }

  /**
   * Map visit type from display format to enum format
   * Backend enum: Screening = 1 … Patient Feedback Form = 7, Study Completion Form = 8 (see lib/visitTypes.js)
   * @param {string} visitType - Visit type from form (e.g., "Screening")
   * @returns {number} Enum value as integer
   */
  mapVisitTypeToEnum(visitType) {
    return mapVisitTypeLabelToEnum(visitType)
  }

  /**
   * Create multiple Visit Schedules automatically based on Total Visits (Batch)
   * @param {Object} batchData - Batch creation data
   * @param {number} batchData.studyId - Study ID
   * @param {number} batchData.totalVisits - Total number of visits to create (1-1000)
   * @param {string} batchData.visitType - Visit type (Screening/Baseline/Visits)
   * @param {number} batchData.duration - Duration in days for all visits
   * @param {number} [batchData.windowMin] - Window min in days for all visits (optional, defaults to 0)
   * @param {number} [batchData.windowMax] - Window max in days for all visits (optional, defaults to 0)
   */
  async createVisitScheduleBatch(batchData) {
    try {
      // Map form data to API request format (camelCase as per JsonPropertyName attributes)
      const mappedVisitType = batchData.visitType ? this.mapVisitTypeToEnum(batchData.visitType) : null
      
      // Determine mode based on visit type: 'batch' for 'Visits' (type 3), 'single' for others.
      const mode = mappedVisitType === 3 ? 'batch' : 'single'
      
      // Validate required fields before building request
      // Note: windowMin and windowMax are optional - will default to 0 if not provided
      if (!batchData.studyId || !mappedVisitType || 
          batchData.duration === undefined || batchData.duration === "") {
        logger.error("Create visit schedule batch failed - missing required fields", {
          studyId: batchData.studyId,
          visitType: mappedVisitType,
          duration: batchData.duration,
        })
        return {
          isSuccess: false,
          statusCode: 400,
          data: null,
          message: "All required fields must be provided",
        }
      }
      
      // Validate mode-specific required fields
      if (mode === 'batch' && (!batchData.totalVisits || batchData.totalVisits === "")) {
        logger.error("Create visit schedule batch failed - totalVisits required for batch mode")
        return {
          isSuccess: false,
          statusCode: 400,
          data: null,
          message: "Total visits is required for batch mode",
        }
      }
      
      if (mode === 'single' && (!batchData.visitNo || !batchData.visitName)) {
        logger.error("Create visit schedule batch failed - visitNo and visitName required for single mode", {
          visitNo: batchData.visitNo,
          visitName: batchData.visitName,
        })
        return {
          isSuccess: false,
          statusCode: 400,
          data: null,
          message: "Visit number and visit name are required for single mode",
        }
      }
      
      const requestData = {
        studyId: parseInt(batchData.studyId),
        mode: mode, // Required by API: 'batch' or 'single'
        visitTypeId: mappedVisitType, // numeric enum (1-3)
        duration: parseInt(batchData.duration),
        // Window Min and Max are optional - default to 0 if not provided
        windowMin: batchData.windowMin !== undefined && batchData.windowMin !== "" ? parseInt(batchData.windowMin) : 0,
        windowMax: batchData.windowMax !== undefined && batchData.windowMax !== "" ? parseInt(batchData.windowMax) : 0,
      }
      
      // Add mode-specific required fields
      if (mode === 'batch') {
        // For batch mode: totalVisits is required
        requestData.totalVisits = parseInt(batchData.totalVisits)
      } else {
        // For single mode: visitNo and visitName are required
        requestData.visitNo = batchData.visitNo || 1
        requestData.visitName =
          batchData.visitName || mapVisitTypeEnumToLabel(mappedVisitType) || batchData.visitType || "Visit"
      }

      const response = await apiClient.post(API_CONFIG.ENDPOINTS.VISIT_SCHEDULES.CREATE_BATCH, requestData)
      
      if (!response.isSuccess) {
        logger.error("Create visit schedule batch failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }
      
      return response
    } catch (error) {
      logger.error("Create visit schedule batch failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to create visit schedules batch",
      }
    }
  }

  /**
   * Update Visit Schedule
   * Uses the UpdateVisitSchedule API endpoint: PUT /VisitSchedules/UpdateVisitSchedule/{id}
   * @param {number} id - Visit Schedule ID
   * @param {Object} visitScheduleData - Visit Schedule data matching UpdateVisitScheduleRequest DTO
   * @param {number} visitScheduleData.studyId - Study ID (required)
   * @param {number} visitScheduleData.visitNo - Visit number (required)
   * @param {string} visitScheduleData.visitName - Visit name (required)
   * @param {string} visitScheduleData.visitType - Visit type (Screening/Baseline/Visits) - will be mapped to visitTypeId enum
   * @param {number} visitScheduleData.duration - Duration in days (required)
   * @param {number} [visitScheduleData.windowMin] - Window min in days (optional, defaults to 0)
   * @param {number} [visitScheduleData.windowMax] - Window max in days (optional, defaults to 0)
   * @returns {Promise<Object>} API response with VisitScheduleDto
   */
  async updateVisitSchedule(id, visitScheduleData) {
    try {
      // Map form data to API request format (camelCase as per JsonPropertyName attributes)
      // The backend UpdateVisitScheduleRequest DTO uses JsonPropertyName with camelCase
      // Note: windowMin and windowMax are optional - will default to 0 if not provided
      
      // Map enum values first to ensure they're valid
      const mappedVisitType = visitScheduleData.visitType ? this.mapVisitTypeToEnum(visitScheduleData.visitType) : null
      
      // Validate required fields before building request
      if (!visitScheduleData.studyId || !visitScheduleData.visitNo || !visitScheduleData.visitName || 
          !mappedVisitType || !visitScheduleData.duration) {
        logger.error("Update visit schedule failed - missing required fields", {
          studyId: visitScheduleData.studyId,
          visitNo: visitScheduleData.visitNo,
          visitName: visitScheduleData.visitName,
          visitType: mappedVisitType,
          duration: visitScheduleData.duration,
        })
        return {
          isSuccess: false,
          statusCode: 400,
          data: null,
          message: "All required fields must be provided",
        }
      }
      
      // Build request payload matching UpdateVisitScheduleRequest DTO
      // Note: All fields are required per DTO, including windowMin and windowMax (must be 0 or greater)
      const requestData = {
        studyId: parseInt(visitScheduleData.studyId),
        visitNo: parseInt(visitScheduleData.visitNo),
        visitName: visitScheduleData.visitName,
        visitTypeId: mappedVisitType, // numeric enum (1-5): Screening=1, Baseline=2, Visits=3, Unscheduled Visit=4, Adverse Event=5
        duration: parseInt(visitScheduleData.duration),
        // Window Min and Max are required - default to 0 if not provided or empty
        windowMin: (visitScheduleData.windowMin !== undefined && visitScheduleData.windowMin !== "" && visitScheduleData.windowMin !== null) 
          ? parseInt(visitScheduleData.windowMin) 
          : 0,
        windowMax: (visitScheduleData.windowMax !== undefined && visitScheduleData.windowMax !== "" && visitScheduleData.windowMax !== null) 
          ? parseInt(visitScheduleData.windowMax) 
          : 0,
      }

      // Call UpdateVisitSchedule API: PUT /VisitSchedules/UpdateVisitSchedule/{id}
      // Note: Only sending primitive values (IDs, strings, numbers) - no entity objects
      // to avoid Entity Framework tracking conflicts on the backend
      const response = await apiClient.put(API_CONFIG.ENDPOINTS.VISIT_SCHEDULES.UPDATE(id), requestData)
      
      // Log backend Entity Framework tracking errors for debugging
      if (!response.isSuccess && response.message && response.message.includes("cannot be tracked")) {
        logger.error("Update visit schedule failed - Entity Framework tracking error (backend issue)", {
          visitScheduleId: id,
          requestData,
          error: response.message,
        })
      }
      
      return response
    } catch (error) {
      logger.error("Update visit schedule failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to update visit schedule",
      }
    }
  }

  /**
   * Update Visit Schedule status (Activate/Deactivate)
   * @param {number} id - Visit Schedule ID
   * @param {boolean} isActive - Active status
   */
  async updateVisitScheduleStatus(id, isActive) {
    try {
      return await apiClient.put(API_CONFIG.ENDPOINTS.VISIT_SCHEDULES.UPDATE_STATUS(id,isActive))
    } catch (error) {
      logger.error("Update visit schedule status failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to update visit schedule status",
      }
    }
  }

  /**
   * Delete Visit Schedule
   */
  async deleteVisitSchedule(id) {
    try {
      return await apiClient.delete(`${API_CONFIG.ENDPOINTS.VISIT_SCHEDULES.BASE}/DeleteVisitSchedule/${id}`)
    } catch (error) {
      logger.error("Delete visit schedule failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to delete visit schedule",
      }
    }
  }
}

export default new VisitScheduleService()

