/**
 * Permissions Service
 * Handles role permissions operations
 */

import apiClient from "../api/client"
import { API_CONFIG } from "../api/config"
import logger from "../api/logger"

class PermissionsService {
  /**
   * Get all features and sub-features for UI display
   */
  async getAllFeaturesAndSubFeatures() {
    try {
      return await apiClient.get("/Permissions/GetAllFeaturesAndSubFeatures")
    } catch (error) {
      logger.error("Error fetching features and sub-features", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || 500,
        data: null,
        message: error.message || "Failed to fetch features and sub-features",
      }
    }
  }

  /**
   * Get role permissions by role GUID
   * @param {string} roleGuid - The GUID of the role
   */
  async getRolePermissions(roleGuid) {
    try {
      return await apiClient.get(`/Permissions/GetRolePermissions/${roleGuid}`)
    } catch (error) {
      logger.error("Error fetching role permissions", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || 500,
        data: null,
        message: error.message || "Failed to fetch role permissions",
      }
    }
  }

  /**
   * Save role permissions
   * @param {Object} permissionsData - The permissions data to save
   */
  async saveRolePermissions(permissionsData) {
    try {
      return await apiClient.post("/Permissions/SaveRolePermissions", permissionsData)
    } catch (error) {
      logger.error("Error saving role permissions", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || 500,
        data: null,
        message: error.message || "Failed to save role permissions",
      }
    }
  }
}

export default new PermissionsService()

