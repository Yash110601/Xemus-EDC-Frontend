/**
 * Study Service
 * Handles study management operations
 */

import apiClient from "../api/client"
import { API_CONFIG, StudyFilter, STORAGE_KEYS } from "../api/config"
import logger from "../api/logger"
import { STUDY_OPTIONAL_TEXT_API_FIELDS } from "../utils/studyFormEnums"

/** Document type for download: 1 = ECLetter, 2 = Protocol */
export const StudyDocumentType = { ECLetter: 1, Protocol: 2 }

function appendStudyMultipartFormData(formData, studyData) {
  Object.keys(studyData).forEach((key) => {
    const value = studyData[key]

    if (value === undefined || value === null) {
      if (STUDY_OPTIONAL_TEXT_API_FIELDS.has(key)) {
        formData.append(key, "")
      }
      return
    }

    if (value === "" && !STUDY_OPTIONAL_TEXT_API_FIELDS.has(key)) {
      return
    }

    if ((key === "ECLetterDocument" || key === "ProtocolDocument") && value instanceof File) {
      formData.append(key, value)
      return
    }

    if (typeof value === "object" && !(value instanceof File)) {
      return
    }

    formData.append(key, value.toString())
  })
}

class StudyService {
  async createStudy(studyData) {
    try {
      const formData = new FormData()
      appendStudyMultipartFormData(formData, studyData)

      const response = await apiClient.post(API_CONFIG.ENDPOINTS.STUDIES.CREATE, formData)

      // Log the response for debugging
      if (!response.isSuccess) {
        logger.error("Create study failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }

      return response
    } catch (error) {
      logger.error("Create study failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to create study",
      }
    }
  }

  /**
   * Get all studies with pagination
   */
  async getStudiesList(pageNumber = 1, pageSize = 10, search = "", isActive = null) {
    try {
      const queryParams = new URLSearchParams({
        pageNumber: pageNumber.toString(),
        pageSize: pageSize.toString(),
      })
      if (search) {
        queryParams.append("search", search)
      }
      if (isActive !== null) {
        queryParams.append("isActive", isActive.toString())
      }
      return await apiClient.get(`${API_CONFIG.ENDPOINTS.STUDIES.GET_LIST}?${queryParams.toString()}`)
    } catch (error) {
      logger.error("Get studies list failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch studies",
      }
    }
  }

  /**
   * Get study by ID
   */
  async getStudyById(studyId) {
    try {
      return await apiClient.get(API_CONFIG.ENDPOINTS.STUDIES.BY_ID(studyId))
    } catch (error) {
      logger.error("Get study by ID failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch study",
      }
    }
  }

  /**
   * Get study settings
   * GET /api/Studies/{studyId}/settings
   */
  async getStudySettings(studyId) {
    try {
      if (!studyId) {
        return {
          isSuccess: false,
          statusCode: 400,
          data: null,
          message: "Study ID is required",
        }
      }
      return await apiClient.get(API_CONFIG.ENDPOINTS.STUDIES.GET_SETTINGS(studyId))
    } catch (error) {
      logger.error("Get study settings failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch study settings",
      }
    }
  }

  /**
   * Update study
   */
  async updateStudy(studyId, studyData) {
    try {
      const formData = new FormData()
      appendStudyMultipartFormData(formData, studyData)

      return await apiClient.put(API_CONFIG.ENDPOINTS.STUDIES.UPDATE(studyId), formData)
    } catch (error) {
      logger.error("Update study failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to update study",
      }
    }
  }

  /**
   * Update study status (activate/deactivate)
   */
  async updateStudyStatus(studyId, isActive) {
    try {
      return await apiClient.put(API_CONFIG.ENDPOINTS.STUDIES.UPDATE_STATUS(studyId), {
        isActive,
      })
    } catch (error) {
      logger.error("Update study status failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to update study status",
      }
    }
  }

  /**
   * Download study document (EC Letter or Protocol).
   * GET /api/Studies/DownloadDocument/{studyId}/{documentType}
   * @param {number} studyId - Study ID
   * @param {number} documentType - 1 = ECLetter, 2 = Protocol (use StudyDocumentType)
   * @returns {Promise<{isSuccess: boolean, message?: string, statusCode?: number}>} Triggers browser download on success
   */
  async downloadDocument(studyId, documentType) {
    if (!studyId || documentType == null) {
      return { isSuccess: false, message: "Study ID and document type are required." }
    }
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) : null
      const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.STUDIES.DOWNLOAD_DOCUMENT(studyId, documentType)}`
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/pdf",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }))
        const message = err.message || err.errors?.[0] || "Download failed."
        if (res.status === 401) return { isSuccess: false, statusCode: 401, message: "Not logged in or invalid token." }
        if (res.status === 403) return { isSuccess: false, statusCode: 403, message: "User not assigned to this study." }
        if (res.status === 404) return { isSuccess: false, statusCode: 404, message: "No document found for this study and type." }
        return { isSuccess: false, statusCode: res.status, message }
      }

      const blob = await res.blob()
      const contentDisposition = res.headers.get("Content-Disposition") || ""
      const match = contentDisposition.match(/filename="?([^";]+)"?/)
      const fileName = match ? match[1].trim() : (documentType === 1 ? "ECLetter.pdf" : "Protocol.pdf")

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
      logger.error("Download study document failed", { error, studyId, documentType })
      return {
        isSuccess: false,
        statusCode: 500,
        message: error.message || "Failed to download document.",
      }
    }
  }

  /**
   * Get accessible studies with sites
   * @param {number} filter - StudyFilter enum: StudyFilter.Active (1) or StudyFilter.Locked (2)
   */
  async getAccessibleStudiesWithSites(filter) {
    try {
      // Backend accepts numeric enum values (1 for Active, 2 for Locked)
      const queryParams = new URLSearchParams({
        filter: filter.toString(),
      })
      return await apiClient.get(`${API_CONFIG.ENDPOINTS.STUDIES.GET_ACCESSIBLE_WITH_SITES}?${queryParams.toString()}`)
    } catch (error) {
      logger.error("Get accessible studies with sites failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch accessible studies with sites",
      }
    }
  }

  /**
   * Get accessible studies with sites and assignment status for a specific user
   * @param {number} targetUserId - User ID to check assignment status for
   */
  async getAccessibleStudiesWithSitesAndAssignments(targetUserId) {
    try {
      if (!targetUserId) {
        return {
          isSuccess: false,
          statusCode: 400,
          data: null,
          message: "Target user ID is required",
        }
      }

      const queryParams = new URLSearchParams({
        targetUserId: targetUserId.toString(),
      })
      return await apiClient.get(`${API_CONFIG.ENDPOINTS.STUDIES.GET_ACCESSIBLE_WITH_SITES_AND_ASSIGNMENTS}?${queryParams.toString()}`)
    } catch (error) {
      logger.error("Get accessible studies with sites and assignments failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch accessible studies with sites and assignments",
      }
    }
  }


  /**
   * Get studies for dropdown (StudyId and StudyProtocolNumber only)
   * Admin/Super Admin: all active studies; Others: only assigned studies
   */
  /**
   * Get studies for dropdown
   * @param {number|null} studyType - Optional study type filter (1 = Normal, 2 = Milestone, 3 = Visit)
   */
  async getStudiesForDropdown(studyType = null, options = {}) {
    try {
      const queryParams = new URLSearchParams()
      if (studyType !== null && studyType !== undefined) {
        queryParams.append("studyType", studyType.toString())
      }
      if (options.includeLocked === true) {
        queryParams.append("includeLocked", "true")
      }
      const queryString = queryParams.toString()
      const url = queryString
        ? `${API_CONFIG.ENDPOINTS.STUDIES.GET_DROPDOWN}?${queryString}`
        : API_CONFIG.ENDPOINTS.STUDIES.GET_DROPDOWN
      return await apiClient.get(url)
    } catch (error) {
      logger.error("Get studies for dropdown failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch studies for dropdown",
      }
    }
  }

  /**
   * View or download a study document by URL
   * @param {string} url - The full blob storage URL of the study document
   * @param {boolean} download - If true, forces download. If false (default), attempts to display inline
   * @param {boolean} returnBlobUrl - If true, returns blob URL instead of opening/downloading (useful for images)
   * @returns {Promise<Object>} Response with blob URL or success status
   */
  async viewStudyDocumentByUrl(url, download = false, returnBlobUrl = false) {
    try {
      if (!url) {
        return {
          isSuccess: false,
          statusCode: 400,
          data: null,
          message: "Document URL is required",
        }
      }

      const queryParams = new URLSearchParams({
        url: url,
      })
      if (download) {
        queryParams.append("download", "true")
      }

      // Use fetch directly for file downloads since apiClient might not handle blob responses properly
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.STUDIES.VIEW_DOCUMENT}?${queryParams.toString()}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        return {
          isSuccess: false,
          statusCode: response.status,
          data: null,
          message: errorData.message || "Failed to view document",
        }
      }

      const blob = await response.blob()
      const contentType = response.headers.get("content-type") || blob.type || ""
      const fileName = url.split("/").pop() || "document"

      // Detect if file is an image
      const isImage = contentType.startsWith("image/") ||
        /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(fileName)

      // Create object URL
      const blobUrl = window.URL.createObjectURL(blob)

      // If returnBlobUrl is true, return the blob URL for inline display (e.g., in <img> tag)
      if (returnBlobUrl) {
        return {
          isSuccess: true,
          statusCode: response.status,
          data: blob,
          blobUrl: blobUrl,
          contentType: contentType,
          fileName: fileName,
          isImage: isImage,
          message: "Document loaded successfully",
        }
      }

      if (download) {
        // Force download
        const a = document.createElement("a")
        a.href = blobUrl
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        // Clean up after a short delay to ensure download starts
        setTimeout(() => {
          window.URL.revokeObjectURL(blobUrl)
          document.body.removeChild(a)
        }, 100)
      } else if (isImage) {
        // For images, open in new tab for viewing
        window.open(blobUrl, "_blank")
        // Note: We don't revoke the URL immediately as the new tab needs it
        // The browser will handle cleanup when the tab is closed
      } else {
        // For documents, open in new tab
        window.open(blobUrl, "_blank")
        // Note: We don't revoke the URL immediately as the new tab needs it
        // The browser will handle cleanup when the tab is closed
      }

      return {
        isSuccess: true,
        statusCode: response.status,
        data: blob,
        blobUrl: blobUrl,
        contentType: contentType,
        fileName: fileName,
        isImage: isImage,
        message: download ? "Document downloaded successfully" : "Document opened successfully",
      }
    } catch (error) {
      logger.error("View study document by URL failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to view document",
      }
    }
  }

  /**
   * Delete study
   */
  async deleteStudy(studyId) {
    try {
      return await apiClient.delete(API_CONFIG.ENDPOINTS.STUDIES.DELETE(studyId))
    } catch (error) {
      logger.error("Delete study failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to delete study",
      }
    }
  }

}

export default new StudyService()
