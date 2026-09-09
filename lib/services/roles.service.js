/**
 * Roles Service
 * Handles role management operations
 */

import apiClient from "../api/client"
import { API_CONFIG } from "../api/config"
import logger from "../api/logger"

class RolesService {
  /**
   * Get all roles with pagination and filters
   * @param {Object} params - Query parameters
   * @param {number} params.pageNumber - Page number (default: 1)
   * @param {number} params.pageSize - Page size (default: 10)
   * @param {string} params.search - Search query string
   * @param {boolean} params.isActive - Filter by active status
   */
  async getRolesList({ pageNumber = 1, pageSize = 10, search = "", isActive = null } = {}) {
    try {
      const queryParams = new URLSearchParams({
        pageNumber: pageNumber.toString(),
        pageSize: pageSize.toString(),
      })

      if (search) {
        queryParams.append("search", search)
      }

      if (isActive !== null && isActive !== undefined) {
        queryParams.append("isActive", isActive.toString())
      }

      const queryString = queryParams.toString()
      return await apiClient.get(
        `${API_CONFIG.ENDPOINTS.ROLES.ROLESLIST}${queryString ? `?${queryString}` : ""}`
      )
    } catch (error) {
      logger.error("Get roles list failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to fetch roles list",
      }
    }
  }

  /**
   * Get roles dropdown (simplified list for dropdowns)
   */
  async getRolesDropdown() {
    try {
      const response = await apiClient.get(API_CONFIG.ENDPOINTS.ROLES.Roles)
      
      // Handle 401 Unauthorized - user may not have permission or token expired
      if (response.statusCode === 401 || response.httpStatus === 401) {
        logger.warn("Unauthorized access to roles dropdown - check permissions or token")
        return {
          isSuccess: false,
          statusCode: 401,
          data: null,
          message: response.message || "You don't have permission to view roles. Please contact your administrator.",
        }
      }
      
      return response
    } catch (error) {
      logger.error("Get roles dropdown failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || error.httpStatus || 500,
        data: null,
        message: error.message || "Failed to fetch roles dropdown",
      }
    }
  }

  /**
   * Get roles for dropdown - uses GetRolesForDropdown endpoint
   */
  async getRolesForDropdown() {
    try {
      const response = await apiClient.get(API_CONFIG.ENDPOINTS.ROLES.Roles)

      // Handle 401 Unauthorized - user may not have permission or token expired
      if (response.statusCode === 401 || response.httpStatus === 401) {
        logger.warn("Unauthorized access to roles for dropdown - check permissions or token")
        return {
          isSuccess: false,
          statusCode: 401,
          data: null,
          message: response.message || "You don't have permission to view roles. Please contact your administrator.",
        }
      }

      return response
    } catch (error) {
      logger.error("Get roles for dropdown failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || error.httpStatus || 500,
        data: null,
        message: error.message || "Failed to fetch roles for dropdown",
      }
    }
  }

  /**
   * Create a new role (requires USER_MGMT Add on backend).
   * @param {{ name: string, description?: string }} payload
   */
  async createRole({ name, description = "" }) {
    try {
      return await apiClient.post(API_CONFIG.ENDPOINTS.ROLES.CREATE, {
        name: String(name ?? "").trim(),
        description: String(description ?? "").trim(),
      })
    } catch (error) {
      logger.error("Create role failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || error.httpStatus || 500,
        data: null,
        message: error.message || "Failed to create role",
      }
    }
  }
}

export default new RolesService()

