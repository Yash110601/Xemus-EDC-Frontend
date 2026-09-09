import apiClient from "../api/client"
import { API_CONFIG } from "../api/config"
import logger from "../api/logger"

class UserService {
  async createUser(userData) {
    try {
      return await apiClient.post(API_CONFIG.ENDPOINTS.USER.CREATE, userData)
    } catch (error) {
      logger.error("Create user failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to create user",
      }
    }
  }


  /**
   * Update user profile
   * Uses ProfileController endpoint
   * @param {FormData|Object} profileData - FormData if photo included, otherwise object with Username, FirstName, LastName, Email, PhoneNumber
   */
  async updateProfile(profileData) {
    try {
      // Primary: ProfileController (may be restricted for some roles)
      const primary = await apiClient.put(API_CONFIG.ENDPOINTS.PROFILE.UPDATE_PROFILE, profileData)

      // Fallback: some roles may only have access to /Users/profile
      const fallbackStatuses = [403, 404, 405]
      if (!primary.isSuccess && fallbackStatuses.includes(primary.httpStatus)) {
        return await apiClient.put(API_CONFIG.ENDPOINTS.USER.PROFILE, profileData)
      }

      return primary
    } catch (error) {
      logger.error("Update profile failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to update profile",
      }
    }
  }

  /**
   * Change password
   * @param {string} username - Username of the user
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password (min 6, max 100 characters)
   */
  async changePassword(username, currentPassword, newPassword) {
    try {
      return await apiClient.post(API_CONFIG.ENDPOINTS.USER.CHANGE_PASSWORD, {
        username,
        currentPassword,
        newPassword,
      })
    } catch (error) {
      logger.error("Change password failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to change password",
      }
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    try {
      return await apiClient.get(API_CONFIG.ENDPOINTS.USER.EDITBY_ID(userId))
    } catch (error) {
      logger.error("Get user by ID failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to get user",
      }
    }
  }

  /**
   * Get all users with pagination
   */
  async getAllUsers(pageNumber = 1, pageSize = 100, search = "", isActive = null) {
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
      return await apiClient.get(`${API_CONFIG.ENDPOINTS.USER.BASE}?${queryParams.toString()}`)
    } catch (error) {
      logger.error("Get all users failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to get users",
      }
    }
  }

  /**
   * Update user
   */
  async updateUser(userId, userData) {
    try {
      return await apiClient.put(API_CONFIG.ENDPOINTS.USER.UPDATE(userId), userData)
    } catch (error) {
      logger.error("Update user failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to update user",
      }
    }
  }

  /**
   * Update user status (Active/Inactive)
   */
  async updateUserStatus(userId, isActive) {
    try {
      // isActive is sent as query parameter, not in body
      return await apiClient.put(API_CONFIG.ENDPOINTS.USER.UPDATE_STATUS(userId, isActive))
    } catch (error) {
      logger.error("Update user status failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to update user status",
      }
    }
  }

  /**
   * Delete user
   */
  async deleteUser(userId) {
    try {
      return await apiClient.delete(API_CONFIG.ENDPOINTS.USER.DELETEBY_ID(userId))
    } catch (error) {
      logger.error("Delete user failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to delete user",
      }
    }
  }

  /**
   * Reset user password (generates new password and emails to user).
   * Only Super Admin and Admin. Admin cannot reset Super Admin or Admin.
   * API: POST /api/Users/ResetUserPassword
   * Body: { userId: number }
   * 200 – success (message, data: null); 400 – validation; 403 – not allowed; 404 – user not found; 500 – server error
   */
  async resetUserPassword(userId) {
    try {
      const id = typeof userId === "number" ? userId : parseInt(userId, 10)
      if (!id || isNaN(id)) {
        return {
          isSuccess: false,
          statusCode: 400,
          data: null,
          message: "Valid userId is required",
          errors: ["userId must be a number"],
        }
      }
      return await apiClient.post(API_CONFIG.ENDPOINTS.USER.RESET_USER_PASSWORD, { userId: id })
    } catch (error) {
      logger.error("Reset user password failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode ?? error.httpStatus ?? 500,
        data: null,
        message: error.message || "Failed to reset user password",
        errors: error.errors ?? [],
      }
    }
  }

  /**
   * Assign user to study/site
   */
  async assignUserToStudy(userId, studyId, siteId = null) {
    try {
      return await apiClient.post(API_CONFIG.ENDPOINTS.USER.ASSIGN_TO_STUDY(userId), {
        studyId,
        siteId,
      })
    } catch (error) {
      logger.error("Assign user to study failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to assign user to study",
      }
    }
  }
}

export default new UserService()

