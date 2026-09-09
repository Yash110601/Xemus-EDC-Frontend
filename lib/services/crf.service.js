/**
 * CRF (Case Report Form) Service
 * Handles CRF design save, load, and list operations
 */

import apiClient from "../api/client"
import { API_CONFIG } from "../api/config"

class CRFService {
  /**
   * Get list of CRFs
   */
  async getCRFList(searchQuery = "", page = 1, limit = 50) {
    try {
      const endpoint = `${API_CONFIG.ENDPOINTS.CRF?.LIST || "/api/crf/list"}?search=${encodeURIComponent(searchQuery)}&page=${page}&limit=${limit}`
      const response = await apiClient.get(endpoint)
      return response
    } catch (error) {
      console.error("Error fetching CRF list:", error)
      // Return mock data in development
      if (process.env.NEXT_PUBLIC_MOCK_API === "true") {
        return {
          isSuccess: true,
          data: [],
          message: "Mock data - No CRFs found",
        }
      }
      throw error
    }
  }

  /**
   * Get CRF by ID
   */
  async getCRFById(crfId) {
    try {
      const endpoint = `${API_CONFIG.ENDPOINTS.CRF?.GET || "/api/crf"}/${crfId}`
      const response = await apiClient.get(endpoint)
      return response
    } catch (error) {
      console.error("Error fetching CRF:", error)
      throw error
    }
  }

  /**
   * Save CRF design
   */
  async saveCRF(crfData) {
    try {
      const endpoint = API_CONFIG.ENDPOINTS.CRF?.SAVE || "/api/crf/save"
      const response = await apiClient.post(endpoint, crfData)
      return response
    } catch (error) {
      console.error("Error saving CRF:", error)
      throw error
    }
  }

  /**
   * Submit CRF design (finalize)
   */
  async submitCRF(crfId) {
    try {
      const endpoint = `${API_CONFIG.ENDPOINTS.CRF?.SUBMIT || "/api/crf/submit"}/${crfId}`
      const response = await apiClient.post(endpoint)
      return response
    } catch (error) {
      console.error("Error submitting CRF:", error)
      throw error
    }
  }

  /**
   * Delete CRF
   */
  async deleteCRF(crfId) {
    try {
      const endpoint = `${API_CONFIG.ENDPOINTS.CRF?.DELETE || "/api/crf"}/${crfId}`
      const response = await apiClient.delete(endpoint)
      return response
    } catch (error) {
      console.error("Error deleting CRF:", error)
      throw error
    }
  }

  /**
   * Save to localStorage (for development/testing)
   */
  saveCRFToLocal(crfData) {
    try {
      const crfs = this.getCRFsFromLocal()
      const existingIndex = crfs.findIndex(c => c.id === crfData.id)
      
      if (existingIndex >= 0) {
        crfs[existingIndex] = crfData
      } else {
        crfData.id = crfData.id || `crf_${Date.now()}`
        crfData.createdAt = crfData.createdAt || new Date().toISOString()
        crfs.push(crfData)
      }
      
      crfData.updatedAt = new Date().toISOString()
      localStorage.setItem("crf_designs", JSON.stringify(crfs))
      return { isSuccess: true, data: crfData }
    } catch (error) {
      console.error("Error saving CRF to local storage:", error)
      return { isSuccess: false, message: error.message }
    }
  }

  /**
   * Get CRFs from localStorage
   */
  getCRFsFromLocal() {
    try {
      const stored = localStorage.getItem("crf_designs")
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error("Error reading CRFs from local storage:", error)
      return []
    }
  }

  /**
   * Get CRF by ID from localStorage
   */
  getCRFFromLocal(crfId) {
    try {
      const crfs = this.getCRFsFromLocal()
      return crfs.find(c => c.id === crfId) || null
    } catch (error) {
      console.error("Error reading CRF from local storage:", error)
      return null
    }
  }
}

export const crfService = new CRFService()

