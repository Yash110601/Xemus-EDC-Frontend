/**
 * Study document library — custom uploads (user manual, guides) for admins.
 */

import apiClient from "../api/client"
import { API_CONFIG } from "../api/config"
import { STORAGE_KEYS } from "../api/config"
import logger from "../api/logger"

export const StudyDocumentType = {
  ECLetter: 1,
  Protocol: 2,
  Custom: 3,
}

class StudyDocumentService {
  async getCustomDocuments(studyId) {
    try {
      if (!studyId) {
        return { isSuccess: false, statusCode: 400, data: null, message: "Study ID is required" }
      }
      return await apiClient.get(API_CONFIG.ENDPOINTS.STUDY_DOCUMENTS.GET_CUSTOM(studyId))
    } catch (error) {
      logger.error("Get custom study documents failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || 500,
        data: null,
        message: error.message || "Failed to load study documents",
      }
    }
  }

  async uploadCustomDocument({ studyId, displayName, file }) {
    try {
      if (!studyId || !displayName?.trim() || !file) {
        return { isSuccess: false, message: "Study, document name, and file are required." }
      }
      const formData = new FormData()
      formData.append("StudyId", String(studyId))
      formData.append("DocumentType", String(StudyDocumentType.Custom))
      formData.append("DisplayName", displayName.trim())
      formData.append("Document", file)
      return await apiClient.post(API_CONFIG.ENDPOINTS.STUDY_DOCUMENTS.UPLOAD, formData)
    } catch (error) {
      logger.error("Upload custom study document failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || 500,
        data: null,
        message: error.message || "Upload failed",
      }
    }
  }

  async deleteDocument(documentId) {
    try {
      if (!documentId) {
        return { isSuccess: false, message: "Document ID is required." }
      }
      return await apiClient.delete(API_CONFIG.ENDPOINTS.STUDY_DOCUMENTS.DELETE(documentId))
    } catch (error) {
      logger.error("Delete study document failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || 500,
        message: error.message || "Delete failed",
      }
    }
  }

  async getDocumentResources(studyId) {
    try {
      if (!studyId) {
        return { isSuccess: false, statusCode: 400, data: null, message: "Study ID is required" }
      }
      return await apiClient.get(API_CONFIG.ENDPOINTS.STUDIES.DOCUMENT_RESOURCES(studyId))
    } catch (error) {
      logger.error("Get study document resources failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || 500,
        data: null,
        message: error.message || "Failed to load document resources",
      }
    }
  }

  /**
   * Download document for end users (role-gated via study settings).
   */
  async downloadAccessibleDocument(studyId, documentId) {
    if (!studyId || !documentId) {
      return { isSuccess: false, message: "Study ID and document ID are required." }
    }
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) : null
      const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.STUDIES.DOWNLOAD_ACCESSIBLE_DOCUMENT(studyId, documentId)}`
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/pdf,application/octet-stream,*/*",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }))
        return {
          isSuccess: false,
          statusCode: res.status,
          message: err.message || err.errors?.[0] || "Download failed.",
        }
      }

      const blob = await res.blob()
      const disposition = res.headers.get("Content-Disposition") || ""
      const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i)
      const fileName = match ? decodeURIComponent(match[1].replace(/"/g, "")) : "document"

      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(blobUrl)

      return { isSuccess: true }
    } catch (error) {
      logger.error("Download accessible study document failed", error)
      return { isSuccess: false, message: error.message || "Download failed." }
    }
  }
}

export default new StudyDocumentService()
