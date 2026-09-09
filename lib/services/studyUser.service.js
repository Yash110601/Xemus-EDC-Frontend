/**
 * Study User Service
 * Handles study user (Doctor/CRC) management operations
 */

import apiClient from "../api/client"
import { API_CONFIG } from "../api/config"
import logger from "../api/logger"
import {
  STUDY_USER_IMPORT_BATCH_SIZE,
  STUDY_USER_IMPORT_BATCH_RETRY_ATTEMPTS,
  STUDY_USER_IMPORT_BATCH_RETRY_DELAY_MS,
  isImportTransportFatal,
  mergeChunkImportData,
  sleep,
  splitCsvTextIntoBatchFiles,
} from "../masters/studyUserCsvImport"

class StudyUserService {
  /**
   * Create a study user
   */
  async createStudyUser(studyUserData) {
    try {
      const response = await apiClient.post(API_CONFIG.ENDPOINTS.STUDY_USERS.CREATE, studyUserData)

      if (!response.isSuccess) {
        logger.error("Create study user failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }

      return response
    } catch (error) {
      logger.error("Create study user failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || 500,
        data: null,
        message: error.message || "Failed to create study user",
      }
    }
  }

  /**
   * Update a study user
   */
  async updateStudyUser(id, studyUserData) {
    try {
      return await apiClient.put(API_CONFIG.ENDPOINTS.STUDY_USERS.UPDATE(id), studyUserData)
    } catch (error) {
      logger.error("Update study user failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || 500,
        data: null,
        message: error.message || "Failed to update study user",
      }
    }
  }

  /**
   * Get study user by ID
   */
  async getStudyUserById(id) {
    try {
      return await apiClient.get(API_CONFIG.ENDPOINTS.STUDY_USERS.BY_ID(id))
    } catch (error) {
      logger.error("Get study user by ID failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || 500,
        data: null,
        message: error.message || "Failed to fetch study user",
      }
    }
  }

  /**
   * Get study users by study ID
   */
  async getStudyUsersByStudy(studyId) {
    try {
      return await apiClient.get(API_CONFIG.ENDPOINTS.STUDY_USERS.BY_STUDY(studyId))
    } catch (error) {
      logger.error("Get study users by study failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || 500,
        data: null,
        message: error.message || "Failed to fetch study users",
      }
    }
  }

  /**
   * Get study users by site ID
   */
  async getStudyUsersBySite(siteId) {
    try {
      return await apiClient.get(API_CONFIG.ENDPOINTS.STUDY_USERS.BY_SITE(siteId))
    } catch (error) {
      logger.error("Get study users by site failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || 500,
        data: null,
        message: error.message || "Failed to fetch study users",
      }
    }
  }

  /**
   * Get paginated study users
   */
  async getPagedStudyUsers(pageNumber = 1, pageSize = 10, search = "", studyId = null, siteId = null, isActive = null) {
    try {
      const queryParams = new URLSearchParams({
        pageNumber: pageNumber.toString(),
        pageSize: pageSize.toString(),
      })
      if (search) {
        queryParams.append("search", search)
      }
      if (studyId !== null) {
        queryParams.append("studyId", studyId.toString())
      }
      if (siteId !== null) {
        queryParams.append("siteId", siteId.toString())
      }
      if (isActive !== null) {
        queryParams.append("isActive", isActive.toString())
      }
      return await apiClient.get(`${API_CONFIG.ENDPOINTS.STUDY_USERS.GET_PAGED}?${queryParams.toString()}`)
    } catch (error) {
      logger.error("Get paged study users failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || 500,
        data: null,
        message: error.message || "Failed to fetch study users",
      }
    }
  }

  /**
   * Update study user status (activate/deactivate)
   */
  async updateStudyUserStatus(id, isActive) {
    try {
      return await apiClient.put(API_CONFIG.ENDPOINTS.STUDY_USERS.UPDATE_STATUS(id), { IsActive: isActive })
    } catch (error) {
      logger.error("Update study user status failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || 500,
        data: null,
        message: error.message || "Failed to update study user status",
      }
    }
  }

  /**
   * Import study users from CSV
   * API: POST /api/StudyUsers/ImportStudyUsers
   * @param {File} file - CSV file to import
   * @param {number} studyId - Study ID (must be > 0)
   * @returns {Promise<{success: boolean, message: string, data: object|null, statusCode: number}>}
   */
  async importStudyUsers(file, studyId) {
    try {
      // Validate studyId
      const studyIdInt = parseInt(studyId)
      if (!studyIdInt || studyIdInt <= 0) {
        return {
          success: false,
          statusCode: 400,
          data: null,
          message: "Study ID is required and must be greater than 0",
        }
      }

      // Validate file
      if (!file) {
        return {
          success: false,
          statusCode: 400,
          data: null,
          message: "CSV file is required",
        }
      }

      // Create FormData with correct field names (lowercase as per API spec)
      const formData = new FormData()
      formData.append("file", file)
      formData.append("studyId", studyIdInt.toString())

      // Use fetch directly for multipart/form-data since apiClient might not handle it properly
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.STUDY_USERS.IMPORT}`, {
        method: "POST",
        headers: {
          // Don't set Content-Type, let browser set it with boundary for multipart/form-data
          Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
        },
        body: formData,
      })

      // Parse response
      const contentType = response.headers.get("content-type")
      let data
      if (contentType && contentType.includes("application/json")) {
        data = await response.json()
      } else {
        const text = await response.text()
        try {
          data = JSON.parse(text)
        } catch {
          data = { message: text || "Unknown error occurred" }
        }
      }

      // Handle error responses (400, 401, 403, 500)
      if (!response.ok) {
        return {
          success: false,
          statusCode: response.status,
          data: data.data || null,
          message: data.message || data.errors?.join(", ") || "Failed to import study users",
          errors: data.errors || [],
        }
      }

      // Handle success response (200 OK)
      // API returns: { success: boolean, message: string, data: {...} }
      // Note: API can return success: false even with 200 OK if all rows failed
      const success = data.success !== undefined ? data.success : false

      return {
        success: success,
        statusCode: response.status,
        data: data.data || null,
        message: data.message || (success ? "Study users imported successfully" : "Import finished with errors"),
        errors: data.errors || [],
      }
    } catch (error) {
      logger.error("Import study users failed", error)
      return {
        success: false,
        statusCode: 500,
        data: null,
        message: error.message || "An error occurred while processing your request",
      }
    }
  }

  /**
   * Import one batch with a single retry on gateway timeout (502/504).
   */
  async importStudyUsersBatchWithRetry(batchFile, studyIdInt, onProgress) {
    let response = await this.importStudyUsers(batchFile, studyIdInt)

    if (!isImportTransportFatal(response.statusCode, response.message)) {
      return response
    }

    for (let attempt = 1; attempt <= STUDY_USER_IMPORT_BATCH_RETRY_ATTEMPTS; attempt++) {
      onProgress?.({ retrying: true, retryAttempt: attempt })
      await sleep(STUDY_USER_IMPORT_BATCH_RETRY_DELAY_MS)
      response = await this.importStudyUsers(batchFile, studyIdInt)
      if (!isImportTransportFatal(response.statusCode, response.message)) {
        return response
      }
    }

    return response
  }

  /**
   * Import large CSV files in sequential batches to avoid gateway timeouts.
   * @param {File} file - Full CSV file
   * @param {number} studyId
   * @param {{ batchSize?: number, onProgress?: (p: object) => void }} [options]
   */
  async importStudyUsersInBatches(file, studyId, options = {}) {
    const batchSize = options.batchSize ?? STUDY_USER_IMPORT_BATCH_SIZE
    const onProgress = options.onProgress

    const studyIdInt = parseInt(studyId)
    if (!studyIdInt || studyIdInt <= 0) {
      return {
        success: false,
        statusCode: 400,
        data: null,
        message: "Study ID is required and must be greater than 0",
      }
    }

    if (!file) {
      return {
        success: false,
        statusCode: 400,
        data: null,
        message: "CSV file is required",
      }
    }

    let splitResult
    try {
      const text = await file.text()
      splitResult = splitCsvTextIntoBatchFiles(text, file.name, batchSize)
    } catch (error) {
      return {
        success: false,
        statusCode: 400,
        data: null,
        message: error.message || "Failed to read CSV file",
      }
    }

    const { batches, totalRows } = splitResult
    const chunkResults = []
    let processedRows = 0
    let runningSuccessCount = 0
    let runningFailedCount = 0
    let runningEmailSentCount = 0
    let runningEmailFailedCount = 0
    let runningNewLoginCount = 0

    for (let idx = 0; idx < batches.length; idx++) {
      const { file: batchFile, startDataRowIndex, batchIndex, rowCount } = batches[idx]

      onProgress?.({
        phase: "creating",
        batchIndex,
        totalBatches: batches.length,
        processedRows,
        totalRows,
        successCount: runningSuccessCount,
        failedCount: runningFailedCount,
        remainingRows: Math.max(0, totalRows - processedRows),
        emailSentCount: runningEmailSentCount,
        emailFailedCount: runningEmailFailedCount,
        emailTotal: runningNewLoginCount,
        emailRemaining: Math.max(0, runningNewLoginCount - runningEmailSentCount - runningEmailFailedCount),
      })

      const response = await this.importStudyUsersBatchWithRetry(batchFile, studyIdInt, (retryState) => {
        onProgress?.({
          phase: "creating",
          batchIndex,
          totalBatches: batches.length,
          processedRows,
          totalRows,
          successCount: runningSuccessCount,
          failedCount: runningFailedCount,
          remainingRows: Math.max(0, totalRows - processedRows),
          emailSentCount: runningEmailSentCount,
          emailFailedCount: runningEmailFailedCount,
          emailTotal: runningNewLoginCount,
          emailRemaining: Math.max(0, runningNewLoginCount - runningEmailSentCount - runningEmailFailedCount),
          ...retryState,
        })
      })

      const chunkEntry = {
        ...response,
        startDataRowIndex,
        batchIndex,
      }

      if (isImportTransportFatal(response.statusCode, response.message)) {
        chunkEntry.aborted = true
        chunkEntry.abortReason = response.message || "Request timed out"
        chunkResults.push(chunkEntry)
        break
      }

      chunkResults.push(chunkEntry)
      processedRows += rowCount

      const batchData = response?.data
      if (batchData && typeof batchData === "object") {
        runningSuccessCount += batchData.successCount || 0
        runningFailedCount += batchData.failedCount || 0
        runningEmailSentCount += batchData.emailSentCount ?? batchData.EmailSentCount ?? 0
        runningEmailFailedCount += batchData.emailFailedCount ?? batchData.EmailFailedCount ?? 0
        const batchCredentials = batchData.newUserCredentials || batchData.NewUserCredentials || []
        if (Array.isArray(batchCredentials)) {
          runningNewLoginCount += batchCredentials.length
        }
      }

      onProgress?.({
        phase: "email",
        batchIndex,
        totalBatches: batches.length,
        processedRows,
        totalRows,
        successCount: runningSuccessCount,
        failedCount: runningFailedCount,
        remainingRows: Math.max(0, totalRows - processedRows),
        emailSentCount: runningEmailSentCount,
        emailFailedCount: runningEmailFailedCount,
        emailTotal: runningNewLoginCount,
        emailRemaining: Math.max(0, runningNewLoginCount - runningEmailSentCount - runningEmailFailedCount),
      })
    }

    const merged = mergeChunkImportData(chunkResults)
    const lastChunk = chunkResults[chunkResults.length - 1]
    const completedAllBatches = chunkResults.length === batches.length && !merged.aborted
    const success =
      completedAllBatches &&
      merged.totalRows > 0 &&
      (merged.successCount > 0 || merged.failedCount < merged.totalRows)

    let message
    if (merged.aborted) {
      message = `Import stopped after ${merged.successCount} of ${totalRows} user(s). ${merged.abortReason || "The server timed out."}`
    } else if (merged.failedCount === 0) {
      message = `Study users imported successfully! (${merged.successCount} user(s))`
    } else {
      message = `Import finished: ${merged.successCount} successful, ${merged.failedCount} failed`
    }

    return {
      success,
      statusCode: merged.aborted ? lastChunk?.statusCode || 504 : 200,
      data: merged,
      message,
      errors: merged.errors,
      partial: merged.aborted,
    }
  }

  /**
   * Assign user to study and sites
   * @param {number} userId - User ID
   * @param {number} studyId - Study ID
   * @param {Array<number>|number|null} siteIds - Site ID(s) - can be array for multiple sites or single site ID
   */
  async assignStudyAndSites(userId, studyId, siteIds = null) {
    try {
      // Convert single siteId to array if needed, or handle null
      let siteIdsArray = null
      if (siteIds !== null) {
        siteIdsArray = Array.isArray(siteIds) ? siteIds : [siteIds]
        // Convert to integers
        siteIdsArray = siteIdsArray.map(id => parseInt(id)).filter(id => !isNaN(id))
      }

      const requestData = {
        userId: parseInt(userId),
        studyId: parseInt(studyId),
        siteIds: siteIdsArray,
      }

      return await apiClient.post(API_CONFIG.ENDPOINTS.STUDY_USERS.ASSIGN_STUDY_AND_SITES, requestData)
    } catch (error) {
      logger.error("Assign study and sites failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || 500,
        data: null,
        message: error.message || "Failed to assign user to study and sites",
      }
    }
  }

  /**
   * Get user study site assignments
   * API: GET /api/StudyUsers/GetUserStudySiteAssignments?userId={userId}
   * Returns studies and sites that can be assigned to a user
   * @param {number} userId - User ID (required)
   */
  async getUserStudySiteAssignments(userId) {
    try {
      if (!userId) {
        return {
          success: false,
          isSuccess: false,
          statusCode: 400,
          data: null,
          message: "User ID is required",
        }
      }

      const url = API_CONFIG.ENDPOINTS.STUDY_USERS.GET_USER_STUDY_SITE_ASSIGNMENTS(userId)
      const response = await apiClient.get(url)

      // Handle API response structure: { success: boolean, message: string, data: [...] }
      // Map success to isSuccess for consistency
      if (response.success !== undefined) {
        return {
          ...response,
          isSuccess: response.success,
        }
      }

      return response
    } catch (error) {
      logger.error("Get user study site assignments failed", error)
      return {
        success: false,
        isSuccess: false,
        statusCode: error.statusCode || 500,
        data: null,
        message: error.message || "Failed to get user study site assignments",
      }
    }
  }

  /**
   * Get assigned sites (and users at each site) for selected study.
   * Backend resolves target user from token.
   * API: GET /api/StudyUsers/GetAssignedSitesWithUsersForStudy?studyId={studyId}
   */
  async getAssignedSitesWithUsersForStudy(studyId) {
    try {
      const parsedStudyId = parseInt(String(studyId ?? ""), 10)
      if (!Number.isFinite(parsedStudyId) || parsedStudyId <= 0) {
        return {
          success: false,
          isSuccess: false,
          statusCode: 400,
          data: null,
          message: "Study ID is required",
        }
      }

      const endpoint = `${API_CONFIG.ENDPOINTS.STUDY_USERS.GET_ASSIGNED_SITES_WITH_USERS_FOR_STUDY}?studyId=${parsedStudyId}`
      const response = await apiClient.get(endpoint)
      if (response.success !== undefined) {
        return {
          ...response,
          isSuccess: response.success,
        }
      }
      return response
    } catch (error) {
      logger.error("Get assigned sites with users for study failed", error)
      return {
        success: false,
        isSuccess: false,
        statusCode: error.statusCode || 500,
        data: null,
        message: error.message || "Failed to get assigned sites for study",
      }
    }
  }

  /**
   * Fetch sample CSV template text (for transforming before download).
   */
  async fetchStudyUserSampleCsvText(studyId) {
    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.STUDY_USERS.DOWNLOAD_TEMPLATE}?studyId=${studyId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
          },
        },
      )

      if (!response.ok) {
        throw new Error("Failed to download template")
      }

      const data = await response.text()
      return {
        isSuccess: true,
        data,
        message: "Template fetched successfully",
      }
    } catch (error) {
      logger.error("Fetch sample CSV failed", error)
      return {
        isSuccess: false,
        data: null,
        message: error.message || "Failed to fetch template",
      }
    }
  }

  /**
   * Download sample CSV template
   */
  async downloadSampleCsv(studyId) {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.STUDY_USERS.DOWNLOAD_TEMPLATE}?studyId=${studyId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to download template")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `study-users-sample-${new Date().toISOString().split("T")[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      return {
        isSuccess: true,
        message: "Template downloaded successfully",
      }
    } catch (error) {
      logger.error("Download sample CSV failed", error)
      return {
        isSuccess: false,
        message: error.message || "Failed to download template",
      }
    }
  }
  /**
   * Assign user to multiple studies and sites (Batch)
   * API: POST /api/StudyUsers/AssignStudyAndSites
   * Payload: { userId: number, assignments: [{ studyId: number, siteIds: number[] }] }
   * @param {number} userId - User ID
   * @param {Array<{studyId: number, siteIds: Array<number>}>} assignments - List of assignments
   * Each assignment: { studyId: number, siteIds: Array<number> }
   * siteIds is always an array (empty [] if no sites selected, or array of site IDs)
   */
  async assignBatchStudiesAndSites(userId, assignments) {
    try {
      // Validate userId
      const userIdInt = parseInt(userId)
      if (!userIdInt || userIdInt <= 0) {
        return {
          isSuccess: false,
          statusCode: 400,
          data: null,
          message: "User ID is required and must be greater than 0",
        }
      }

      // Validate and format assignments
      const formattedAssignments = assignments.map(assignment => {
        const studyId = parseInt(assignment.studyId)
        if (!studyId || studyId <= 0) {
          throw new Error(`Invalid studyId: ${assignment.studyId}`)
        }

        // Ensure siteIds is always an array
        let siteIds = []
        if (assignment.siteIds !== null && assignment.siteIds !== undefined) {
          if (Array.isArray(assignment.siteIds)) {
            siteIds = assignment.siteIds.map(id => parseInt(id)).filter(id => !isNaN(id) && id > 0)
          } else {
            const siteId = parseInt(assignment.siteIds)
            if (!isNaN(siteId) && siteId > 0) {
              siteIds = [siteId]
            }
          }
        }

        return {
          studyId: studyId,
          siteIds: siteIds,
          ...(assignment.roleGuid ? { roleGuid: String(assignment.roleGuid).trim() } : {}),
        }
      })

      const requestData = {
        userId: userIdInt,
        assignments: formattedAssignments
      }

      return await apiClient.post(API_CONFIG.ENDPOINTS.STUDY_USERS.ASSIGN_STUDY_AND_SITES, requestData)
    } catch (error) {
      logger.error("Assign batch studies and sites failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || 500,
        data: null,
        message: error.message || "Failed to assign user to studies and sites",
      }
    }
  }
}

export default new StudyUserService()

