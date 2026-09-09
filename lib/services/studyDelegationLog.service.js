import { API_CONFIG } from "../api/config"
import apiClient from "../api/client"
import logger from "../api/logger"

class StudyDelegationLogService {
  async getEntries(studyId, siteId = null) {
    try {
      const params = new URLSearchParams({ studyId: String(studyId) })
      if (siteId) params.set("siteId", String(siteId))
      const endpoint = `${API_CONFIG.ENDPOINTS.STUDY_DELEGATION_LOG.BASE}?${params.toString()}`
      const response = await apiClient.get(endpoint)
      if (response?.isSuccess) return response
      throw new Error(response?.message || "Failed to load delegation log")
    } catch (error) {
      logger.error("getDelegationLog failed", error)
      throw error
    }
  }

  async createEntry(payload) {
    try {
      const response = await apiClient.post(API_CONFIG.ENDPOINTS.STUDY_DELEGATION_LOG.BASE, payload)
      if (response?.isSuccess) return response
      throw new Error(response?.message || "Failed to create delegation entry")
    } catch (error) {
      logger.error("createDelegationLog failed", error)
      throw error
    }
  }

  async updateEntry(id, payload) {
    try {
      const endpoint = API_CONFIG.ENDPOINTS.STUDY_DELEGATION_LOG.BY_ID(id)
      const response = await apiClient.put(endpoint, payload)
      if (response?.isSuccess) return response
      throw new Error(response?.message || "Failed to update delegation entry")
    } catch (error) {
      logger.error("updateDelegationLog failed", error)
      throw error
    }
  }

  async deactivateEntry(id, studyId) {
    try {
      const endpoint = `${API_CONFIG.ENDPOINTS.STUDY_DELEGATION_LOG.BY_ID(id)}/deactivate?studyId=${studyId}`
      const response = await apiClient.post(endpoint, {})
      if (response?.isSuccess) return response
      throw new Error(response?.message || "Failed to deactivate delegation entry")
    } catch (error) {
      logger.error("deactivateDelegationLog failed", error)
      throw error
    }
  }

  async signEntry(id, { studyId, password, comment }) {
    try {
      const endpoint = `${API_CONFIG.ENDPOINTS.STUDY_DELEGATION_LOG.BY_ID(id)}/sign`
      const response = await apiClient.post(endpoint, { studyId, password, comment: comment || null })
      if (response?.isSuccess) return response
      throw new Error(response?.message || "Failed to sign delegation entry")
    } catch (error) {
      logger.error("signDelegationLog failed", error)
      throw error
    }
  }

  async exportPdf(studyId, siteId = null) {
    const token = localStorage.getItem("authToken")
    const params = new URLSearchParams({ studyId: String(studyId), format: "pdf" })
    if (siteId) params.set("siteId", String(siteId))
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.STUDY_DELEGATION_LOG.BASE}/export?${params.toString()}`
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.message || body.Message || `Export failed (${response.status})`)
    }
    const blob = await response.blob()
    const dispo = response.headers.get("content-disposition") ?? ""
    const plain = /filename="?([^";]+)"?/i.exec(dispo)
    const fileName = plain?.[1] || `delegation-log-${studyId}.pdf`
    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = downloadUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(downloadUrl)
  }
}

export default new StudyDelegationLogService()
