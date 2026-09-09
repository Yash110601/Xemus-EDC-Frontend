import apiClient from "@/lib/api/client"
import { API_CONFIG } from "@/lib/api/config"

const EP = API_CONFIG.ENDPOINTS.PLATFORM

function unwrap(res) {
  if (res?.isSuccess === false) {
    return { isSuccess: false, message: res.message || "Request failed", data: null }
  }
  return {
    isSuccess: true,
    message: res?.message ?? "",
    data: res?.data ?? res,
  }
}

class PlatformService {
  async getModules(studyId) {
    try {
      const res = await apiClient.get(`${EP.MODULES}?studyId=${studyId}`)
      return unwrap(res)
    } catch (error) {
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async saveModules(payload) {
    try {
      const res = await apiClient.put(EP.SAVE_MODULES, payload)
      return unwrap(res)
    } catch (error) {
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async getSso(studyId) {
    try {
      const res = await apiClient.get(`${EP.SSO}?studyId=${studyId}`)
      return unwrap(res)
    } catch (error) {
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async saveSso(payload) {
    try {
      const res = await apiClient.put(EP.SAVE_SSO, payload)
      return unwrap(res)
    } catch (error) {
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async getIntegrationEvents(studyId, page = 1, pageSize = 25) {
    try {
      const res = await apiClient.get(
        `${EP.INTEGRATION_EVENTS}?studyId=${studyId}&page=${page}&pageSize=${pageSize}`,
      )
      return unwrap(res)
    } catch (error) {
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async publishTestEvent(studyId) {
    try {
      const res = await apiClient.post(`${EP.INTEGRATION_TEST}?studyId=${studyId}`)
      return unwrap(res)
    } catch (error) {
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async getRoadmap(studyId) {
    try {
      const res = await apiClient.get(`${EP.ROADMAP}?studyId=${studyId}`)
      return unwrap(res)
    } catch (error) {
      return { isSuccess: false, message: error.message, data: null }
    }
  }
}

export default new PlatformService()
