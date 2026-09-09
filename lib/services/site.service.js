/**
 * Site Service
 * Handles site management operations
 */

import apiClient from "../api/client"
import { API_CONFIG } from "../api/config"
import logger from "../api/logger"

class SiteService {
  /**
   * Create a site
   */
  async createSite(siteData) {
    try {
      const response = await apiClient.post(API_CONFIG.ENDPOINTS.SITES.CREATE, siteData)
      
      // Log the response for debugging
      if (!response.isSuccess) {
        logger.error("Create site failed", {
          statusCode: response.statusCode,
          message: response.message,
          data: response.data,
        })
      }
      
      return response
    } catch (error) {
      logger.error("Create site failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to create site",
      }
    }
  }

  /**
   * POST /api/Sites/BulkCreateSystemSites
   * Creates numbered system sites for a study (e.g. s-01 … s-10).
   */
  async bulkCreateSystemSites(payload = {}) {
    try {
      const studyId = Number.parseInt(String(payload.studyId ?? ""), 10)
      const siteCount = Number.parseInt(String(payload.siteCount ?? ""), 10)
      if (!Number.isFinite(studyId) || studyId <= 0 || !Number.isFinite(siteCount) || siteCount <= 0) {
        return {
          isSuccess: false,
          statusCode: 400,
          data: null,
          message: "studyId and siteCount are required",
        }
      }
      const requestData = {
        studyId,
        siteCount,
        namePrefix: String(payload.namePrefix ?? "s-").trim() || "s-",
        isNamingCustomizable: Boolean(payload.isNamingCustomizable),
      }
      return await apiClient.post(API_CONFIG.ENDPOINTS.SITES.BULK_CREATE_SYSTEM_SITES, requestData)
    } catch (error) {
      logger.error("Bulk create system sites failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || 500,
        data: null,
        message: error.message || "Failed to create system sites",
      }
    }
  }

  /**
   * Get all sites with pagination
   */
  async getSitesList(pageNumber = 1, pageSize = 10, search = "", studyId = null, isActive = null) {
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
      if (isActive !== null) {
        queryParams.append("isActive", isActive.toString())
      }
      return await apiClient.get(`${API_CONFIG.ENDPOINTS.SITES.GET_LIST}?${queryParams.toString()}`)
    } catch (error) {
      logger.error("Get sites list failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch sites",
      }
    }
  }

  /**
   * Get site by ID
   */
  async getSiteById(siteId) {
    try {
      return await apiClient.get(API_CONFIG.ENDPOINTS.SITES.BY_ID(siteId))
    } catch (error) {
      logger.error("Get site by ID failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch site",
      }
    }
  }

  /**
   * Get sites by Study ID
   */
  async getSitesByStudy(studyId) {
    try {
      return await apiClient.get(API_CONFIG.ENDPOINTS.SITES.BY_STUDY(studyId))
    } catch (error) {
      logger.error("Get sites by study failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch sites",
      }
    }
  }

  /**
   * Update site
   */
  async updateSite(siteId, siteData) {
    try {
      return await apiClient.put(API_CONFIG.ENDPOINTS.SITES.UPDATE(siteId), siteData)
    } catch (error) {
      logger.error("Update site failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to update site",
      }
    }
  }

  /**
   * Update site status (activate/deactivate)
   */
  async updateSiteStatus(siteId, isActive) {
    try {
      return await apiClient.put(API_CONFIG.ENDPOINTS.SITES.UPDATE_STATUS(siteId, isActive))
    } catch (error) {
      logger.error("Update site status failed", error)
      return {
        isSuccess: false,
        statusCode: 500, 
        data: null,
        message: error.message || "Failed to update site status",
      }
    }
  }

  /**
   * Delete site
   */
  async deleteSite(siteId) {
    try {
      return await apiClient.delete(`${API_CONFIG.ENDPOINTS.SITES.BASE}/DeleteSite/${siteId}`)
    } catch (error) {
      logger.error("Delete site failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to delete site",
      }
    }
  }

  /**
   * Get sites for dropdown by study ID
   * @param {number} studyId - Study ID
   */
  async getSitesForDropdown(studyId, options = {}) {
    try {
      return await apiClient.get(`${API_CONFIG.ENDPOINTS.SITES.BASE}/GetSitesForDropdown/${studyId}`, options)
    } catch (error) {
      logger.error("Get sites for dropdown failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch sites for dropdown",
      }
    }
  }

  /**
   * Download sample CSV template for bulk site creation
   * API: GET /api/Sites/DownloadSiteSampleCsv?studyId={studyId}
   * @param {number} studyId - Study ID (required for which study the sites will belong to)
   */
  async downloadSiteSampleCsv(studyId) {
    try {
      const studyIdInt = parseInt(studyId)
      if (!studyIdInt || studyIdInt <= 0) {
        return {
          isSuccess: false,
          message: "Study ID is required",
        }
      }
      const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SITES.DOWNLOAD_SAMPLE_CSV}?studyId=${studyIdInt}`
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to download sample file")
      }

      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = blobUrl
      a.download = `sites-sample-${new Date().toISOString().split("T")[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(blobUrl)
      document.body.removeChild(a)

      return {
        isSuccess: true,
        message: "Sample file downloaded successfully",
      }
    } catch (error) {
      logger.error("Download site sample CSV failed", error)
      return {
        isSuccess: false,
        message: error.message || "Failed to download sample file",
      }
    }
  }

  /**
   * Import sites from CSV file
   * API: POST /api/Sites/ImportSites
   * @param {File} file - CSV file to import
   * @param {number} studyId - Study ID (required; sites will be created under this study)
   */
  async importSites(file, studyId) {
    try {
      if (!file) {
        return {
          isSuccess: false,
          statusCode: 400,
          data: null,
          message: "CSV file is required",
        }
      }
      const studyIdInt = parseInt(studyId)
      if (!studyIdInt || studyIdInt <= 0) {
        return {
          isSuccess: false,
          statusCode: 400,
          data: null,
          message: "Study ID is required for import",
        }
      }

      const formData = new FormData()
      formData.append("file", file)
      formData.append("studyId", studyIdInt.toString())

      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SITES.IMPORT}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
        },
        body: formData,
      })

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

      if (!response.ok) {
        return {
          isSuccess: false,
          statusCode: response.status,
          data: data.data ?? null,
          message: data.message || data.errors?.join(", ") || "Failed to import sites",
          errors: data.errors || [],
        }
      }

      const isSuccess = data.isSuccess !== undefined ? data.isSuccess : (data.success !== undefined ? data.success : true)
      return {
        isSuccess,
        statusCode: response.status,
        data: data.data ?? null,
        message: data.message || (isSuccess ? "Sites imported successfully" : "Import finished with errors"),
        errors: data.errors || [],
      }
    } catch (error) {
      logger.error("Import sites failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "An error occurred while importing sites",
      }
    }
  }

  /**
   * Export sites as CSV
   * API: GET /api/Sites/Export?studyId=123&search=...&isActive=true
   * @param {number} studyId - Required. Study ID (must be > 0)
   * @param {string} [search] - Optional search string
   * @param {boolean|null} [isActive] - Optional filter by active status (true/false)
   */
  async exportSites(studyId, search = "", isActive = null) {
    try {
      const studyIdInt = parseInt(studyId)
      if (!studyIdInt || studyIdInt <= 0) {
        return {
          isSuccess: false,
          message: "Study ID is required for export",
        }
      }

      const params = new URLSearchParams({ studyId: studyIdInt.toString() })
      if (search && String(search).trim()) params.append("search", String(search).trim())
      if (isActive === true || isActive === false) params.append("isActive", isActive.toString())

      const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SITES.EXPORT}?${params.toString()}`
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
        },
      })

      if (!response.ok) {
        const contentType = response.headers.get("content-type")
        let message = "Failed to export sites"
        if (contentType && contentType.includes("application/json")) {
          try {
            const data = await response.json()
            message = data.message || message
          } catch (_) {}
        }
        return { isSuccess: false, message }
      }

      const blob = await response.blob()
      const disposition = response.headers.get("Content-Disposition")
      let filename = `sites-study-${studyIdInt}-${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}.csv`
      if (disposition) {
        const match = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition)
        if (match && match[1]) filename = match[1].replace(/['"]/g, "").trim()
      }

      const blobUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = blobUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(blobUrl)
      document.body.removeChild(a)

      return { isSuccess: true, message: "Sites exported successfully" }
    } catch (error) {
      logger.error("Export sites failed", error)
      return {
        isSuccess: false,
        message: error.message || "Failed to export sites",
      }
    }
  }
}

export default new SiteService()

