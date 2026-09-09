/**
 * CRF Studio — isolated protocol-to-CRF draft workspace (does not modify live CRF designs).
 */

import {
  CRF_STUDIO_REFERENCE_FILE_HINT,
  isAllowedCrfStudioReferenceFile,
} from "@/lib/utils/crfStudioReferenceFiles"
import apiClient from "../api/client"
import { API_CONFIG, STORAGE_KEYS } from "../api/config"
import logger from "../api/logger"

class CrfStudioService {
  async getProjectsByStudyId(studyId) {
    try {
      if (!studyId) {
        return { isSuccess: false, message: "Study ID is required." }
      }
      return await apiClient.get(API_CONFIG.ENDPOINTS.CRF_STUDIO.GET_PROJECTS(studyId))
    } catch (error) {
      logger.error("CRF Studio get projects failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || 500,
        data: null,
        message: error.message || "Failed to load CRF Studio projects",
      }
    }
  }

  async getProject(projectId, studyId) {
    try {
      if (!projectId || !studyId) {
        return { isSuccess: false, message: "Project and study ID are required." }
      }
      return await apiClient.get(API_CONFIG.ENDPOINTS.CRF_STUDIO.GET_PROJECT(projectId, studyId))
    } catch (error) {
      logger.error("CRF Studio get project failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || 500,
        data: null,
        message: error.message || "Failed to load project",
      }
    }
  }

  async createProject({ studyId, name }) {
    try {
      if (!studyId || !name?.trim()) {
        return { isSuccess: false, message: "Study and project name are required." }
      }
      return await apiClient.post(API_CONFIG.ENDPOINTS.CRF_STUDIO.CREATE_PROJECT, {
        studyId: Number(studyId),
        name: name.trim(),
      })
    } catch (error) {
      logger.error("CRF Studio create project failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || 500,
        data: null,
        message: error.message || "Failed to create project",
      }
    }
  }

  async uploadProtocol({ projectId, studyId, file }) {
    try {
      if (!projectId || !studyId || !file) {
        return { isSuccess: false, message: "Project, study, and PDF file are required." }
      }
      const formData = new FormData()
      formData.append("studyId", String(studyId))
      formData.append("file", file)
      return await apiClient.post(API_CONFIG.ENDPOINTS.CRF_STUDIO.UPLOAD_PROTOCOL(projectId), formData)
    } catch (error) {
      logger.error("CRF Studio upload protocol failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || 500,
        data: null,
        message: error.message || "Protocol upload failed",
      }
    }
  }

  async downloadProtocol(projectId, studyId) {
    try {
      if (!projectId || !studyId) {
        return { isSuccess: false, message: "Project and study ID are required." }
      }
      const token = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) : null
      const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CRF_STUDIO.DOWNLOAD_PROTOCOL(projectId, studyId)}`
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/pdf",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }))
        return {
          isSuccess: false,
          statusCode: res.status,
          message: err.message || err.errors?.[0] || "Protocol download failed",
        }
      }

      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      return { isSuccess: true, blobUrl }
    } catch (error) {
      logger.error("CRF Studio download protocol failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || 500,
        message: error.message || "Protocol download failed",
      }
    }
  }

  async saveDraft(projectId, { studyId, draftTreeJson, coverageReportJson }) {
    try {
      if (!projectId || !studyId) {
        return { isSuccess: false, message: "Project and study ID are required." }
      }
      return await apiClient.put(API_CONFIG.ENDPOINTS.CRF_STUDIO.SAVE_DRAFT(projectId), {
        studyId: Number(studyId),
        draftTreeJson: typeof draftTreeJson === "string" ? draftTreeJson : JSON.stringify(draftTreeJson ?? {}),
        coverageReportJson:
          coverageReportJson != null
            ? typeof coverageReportJson === "string"
              ? coverageReportJson
              : JSON.stringify(coverageReportJson)
            : undefined,
      })
    } catch (error) {
      logger.error("CRF Studio save draft failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || 500,
        data: null,
        message: error.message || "Failed to save draft",
      }
    }
  }

  async startExtraction(projectId, studyId) {
    try {
      if (!projectId || !studyId) {
        return { isSuccess: false, message: "Project and study ID are required." }
      }
      return await apiClient.post(API_CONFIG.ENDPOINTS.CRF_STUDIO.START_EXTRACTION(projectId, studyId))
    } catch (error) {
      logger.error("CRF Studio start extraction failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || 500,
        data: null,
        message: error.message || "Extraction failed",
      }
    }
  }

  async uploadCrfPdf({ projectId, studyId, file }) {
    try {
      if (!projectId || !studyId || !file) {
        return { isSuccess: false, message: "Project, study, and CRF file are required." }
      }
      if (!isAllowedCrfStudioReferenceFile(file)) {
        return {
          isSuccess: false,
          message: `Unsupported file type. ${CRF_STUDIO_REFERENCE_FILE_HINT}`,
        }
      }
      const formData = new FormData()
      formData.append("studyId", String(studyId))
      formData.append("file", file)
      return await apiClient.post(API_CONFIG.ENDPOINTS.CRF_STUDIO.UPLOAD_CRF_PDF(projectId), formData)
    } catch (error) {
      logger.error("CRF Studio upload CRF PDF failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || 500,
        data: null,
        message: error.message || "CRF file upload failed",
      }
    }
  }

  async downloadCrfPdf(projectId, studyId) {
    try {
      if (!projectId || !studyId) {
        return { isSuccess: false, message: "Project and study ID are required." }
      }
      const token = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) : null
      const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CRF_STUDIO.DOWNLOAD_CRF_PDF(projectId, studyId)}`
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "*/*",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }))
        return {
          isSuccess: false,
          statusCode: res.status,
          message: err.message || err.errors?.[0] || "CRF file download failed",
        }
      }

      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      return { isSuccess: true, blobUrl }
    } catch (error) {
      logger.error("CRF Studio download CRF PDF failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || 500,
        message: error.message || "CRF PDF download failed",
      }
    }
  }

  async recordImport(projectId, { studyId, formId, formName, crfDesignId }) {
    try {
      if (!projectId || !studyId || !crfDesignId) {
        return { isSuccess: false, message: "Project, study, and CRF design ID are required." }
      }
      return await apiClient.post(API_CONFIG.ENDPOINTS.CRF_STUDIO.RECORD_IMPORT(projectId), {
        studyId: Number(studyId),
        formId: formId ?? "",
        formName: formName ?? "",
        crfDesignId: Number(crfDesignId),
      })
    } catch (error) {
      logger.error("CRF Studio record import failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || 500,
        data: null,
        message: error.message || "Failed to record import",
      }
    }
  }
}

export default new CrfStudioService()
