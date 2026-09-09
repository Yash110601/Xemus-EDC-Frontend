import apiClient from "@/lib/api/client"
import { API_CONFIG } from "@/lib/api/config"

const EP = API_CONFIG.ENDPOINTS.SAFETY

function unwrap(res) {
  if (res?.isSuccess === false) {
    return { isSuccess: false, message: res.message || "Request failed", data: null }
  }
  return { isSuccess: true, message: res?.message ?? "", data: res?.data ?? res }
}

class SafetyService {
  async getReports(studyId, siteId) {
    try {
      let url = `${EP.REPORTS}?studyId=${studyId}`
      if (siteId) url += `&siteId=${siteId}`
      return unwrap(await apiClient.get(url))
    } catch (error) {
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async getOverdueReports(studyId, siteId) {
    try {
      let url = `${EP.REPORTS_OVERDUE}?studyId=${studyId}`
      if (siteId) url += `&siteId=${siteId}`
      return unwrap(await apiClient.get(url))
    } catch (error) {
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async getReportById(reportId) {
    try {
      return unwrap(await apiClient.get(EP.REPORT_BY_ID(reportId)))
    } catch (error) {
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async getPhaseGuidance(studyId) {
    try {
      return unwrap(await apiClient.get(`${EP.PHASE_GUIDANCE}?studyId=${studyId}`))
    } catch (error) {
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async saveReport(body) {
    try {
      const method = body.id ? "put" : "post"
      return unwrap(await apiClient[method](EP.SAVE_REPORT, body))
    } catch (error) {
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async submitReport(reportId) {
    try {
      return unwrap(await apiClient.post(EP.SUBMIT(reportId), {}))
    } catch (error) {
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async startReview(reportId, reviewNotes) {
    try {
      return unwrap(await apiClient.post(EP.REVIEW(reportId), { reviewNotes }))
    } catch (error) {
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async closeReport(reportId, reviewNotes) {
    try {
      return unwrap(await apiClient.post(EP.CLOSE(reportId), { reviewNotes }))
    } catch (error) {
      return { isSuccess: false, message: error.message, data: null }
    }
  }
}

export default new SafetyService()
