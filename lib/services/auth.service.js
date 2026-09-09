/**
 * Authentication Service
 * Handles user authentication, login, logout, and token management
 */

import apiClient from "../api/client"
import { API_CONFIG, STORAGE_KEYS } from "../api/config"
import logger from "../api/logger"
import { extractMenuFromAuthPayload, parseStoredAuthMenu } from "../utils/authMenuNormalize"
class AuthService {

  /**
   * True when login/user payload includes a role the app can use for permissions and study-scoped APIs.
   * Users without role see empty menus, placeholder "Role" in the shell, and often no patients/data.
   */
  hasRequiredRoleAssignment(user) {
    if (!user || typeof user !== "object") return false
    const guid = user.roleGuid ?? user.RoleGuid
    if (guid != null && String(guid).trim() !== "") {
      const g = String(guid).toLowerCase()
      if (g !== "00000000-0000-0000-0000-000000000000") return true
    }
    const code = String(user.roleCode ?? user.RoleCode ?? "").trim()
    if (code) return true
    const name = String(user.roleName ?? user.RoleName ?? user.role ?? "").trim()
    return !!name
  }

  _resolveLoginPayload(data) {
    if (!data || typeof data !== "object") {
      return { token: null, user: null, menu: null }
    }
    return {
      token: data.token ?? data.Token ?? null,
      user: data.user ?? data.User ?? null,
      menu: extractMenuFromAuthPayload(data),
    }
  }

  async login(username, password) {
    try {
      const response = await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.LOGIN, { username, password })

      if (response.isSuccess && response.data) {
        const { token, user, menu } = this._resolveLoginPayload(response.data)
        this.storeAuthData(token, user, menu)
      }

      return response
    } catch (error) {
      logger.error("Login failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Login failed",
      }
    }
  }

  /**
   * Register new user
   */
  async register(userData) {
    try {
      return await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.REGISTER, userData)
    } catch (error) {
      logger.error("Registration failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Registration failed",
      }
    }
  }

  /**
   * Forgot password - sends reset link/OTP to user's email
   * POST /api/Auth/forgot-password  Body: { email }
   */
  async forgotPassword(email) {
    try {
      return await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.FORGOT_PASSWORD, { email })
    } catch (error) {
      logger.error("Forgot password request failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Request failed",
      }
    }
  }

  /**
   * Reset password with OTP (forgot password flow)
   * POST /api/Auth/reset-password  Body: { email, otp, newPassword }
   */
  async resetPassword(email, otp, newPassword) {
    try {
      return await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.RESET_PASSWORD, {
        email,
        otp,
        newPassword,
      })
    } catch (error) {
      logger.error("Reset password failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Password reset failed",
      }
    }
  }

  /**
   * Send OTP for login
   * @param {string} mobileNumber - 10-digit Indian mobile number
   */
  async sendOTP(mobileNumber) {
    try {
      return await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.SEND_OTP, { mobileNumber })
    } catch (error) {
      logger.error("Send OTP failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to send OTP",
      }
    }
  }

  /**
   * Login with OTP
   * @param {string} mobileNumber - 10-digit Indian mobile number
   * @param {string} otpId - OTP ID returned from send-otp API
   * @param {string} otp - 6-digit OTP (exactly 6 digits)
   */
  async loginWithOTP(mobileNumber, otpId, otp) {
    try {
      const response = await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.LOGIN_WITH_OTP, { 
        mobileNumber, 
        otpId, 
        otp 
      })

      if (response.isSuccess && response.data) {
        const { token, user, menu } = this._resolveLoginPayload(response.data)
        this.storeAuthData(token, user, menu)
      }

      return response
    } catch (error) {
      logger.error("OTP login failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "OTP login failed",
      }
    }
  }

  /**
   * Reset password with OTP
   */
  async resetPasswordWithOTP(username, otp, newPassword) {
    try {
      return await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.RESET_PASSWORD_WITH_OTP, {
        username,
        otp,
        newPassword,
      })
    } catch (error) {
      logger.error("Password reset with OTP failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Password reset failed",
      }
    }
  }

  /**
   * Get last username from session storage
   */
  getLastUsername() {
    if (typeof window === "undefined") return null
    return sessionStorage.getItem("lastUsername")
  }

  /**
   * Store last username in session storage
   */
  setLastUsername(username) {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("lastUsername", username)
    }
  }

  /**
   * Change password
   * @param {Object} data - { username, currentPassword, newPassword }
   */
  async changePassword(data) {
    try {
      return await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.CHANGE_PASSWORD, data)
    } catch (error) {
      logger.error("Change password failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Change password failed",
      }
    }
  }

  /**
   * Refresh authentication token
   */
  async refreshToken() {
    try {
      const refreshToken = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN) : null
      if (!refreshToken) {
        throw new Error("No refresh token available")
      }

      const response = await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.REFRESH_TOKEN, {
        refreshToken,
      })

      if (response.isSuccess && response.data?.token) {
        const incomingUser = response.data.user
        if (incomingUser != null && typeof incomingUser === "object" && !this.hasRequiredRoleAssignment(incomingUser)) {
          logger.warn("Token refresh returned user without role assignment; clearing session")
          await this.logout()
          return {
            isSuccess: false,
            statusCode: 403,
            data: null,
            message: "Your account has no role assigned. Please contact your administrator.",
          }
        }
        const { token, user, menu } = this._resolveLoginPayload(response.data)
        this.storeAuthData(token ?? response.data.token, user ?? response.data.user, menu)
      }

      return response
    } catch (error) {
      logger.error("Token refresh failed", error)
      // Logout in background (don't await to avoid blocking error response)
      this.logout().catch(err => logger.warn("Logout during token refresh failed", err))
      return {
        isSuccess: false,
        statusCode: 401,
        data: null,
        message: "Token refresh failed. Please login again.",
      }
    }
  }

  /**
   * Logout user
   * Calls backend API to invalidate token, then clears local storage
   * API Response: { success: boolean, message: string, data: string, errors: string[] }
   * Note: 401 Unauthorized is acceptable for logout (token may be expired/invalid)
   */
  async logout() {
    try {
      // Call backend logout API to invalidate token on server
      const token = this.getToken()
      if (token) {
        try {
          const response = await apiClient.post(API_CONFIG.ENDPOINTS.AUTH.LOGOUT, {})

          // Handle 401 as acceptable (token might be expired, which is fine for logout)
          if (response.httpStatus === 401 || response.statusCode === 401) {
            logger.info("Logout called with expired/invalid token - proceeding with local logout")
          } else if (response.isSuccess || response.success) {
            logger.info("Logout successful", { message: response.message })
          } else {
            logger.warn("Logout API returned unsuccessful response", {
              message: response.message,
              errors: response.errors || response.data?.errors
            })
          }
        } catch (error) {
          // Handle 401 in error response as well
          if (error.httpStatus === 401 || error.statusCode === 401) {
            logger.info("Logout called with expired/invalid token - proceeding with local logout")
          } else {
            // Even if API call fails, continue with local logout
            logger.warn("Logout API call failed, proceeding with local logout", error)
          }
        }
      }
    } catch (error) {
      // Handle 401 in outer catch as well
      if (error.httpStatus === 401 || error.statusCode === 401) {
        logger.info("Logout called with expired/invalid token - proceeding with local logout")
      } else {
        logger.warn("Error calling logout API, proceeding with local logout", error)
      }
    } finally {
      // Always clear local storage regardless of API call result
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN)
        localStorage.removeItem(STORAGE_KEYS.USER)
        localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN)
        localStorage.removeItem(STORAGE_KEYS.MENU)
        // Clear study/site selection
        localStorage.removeItem("selectedStudyId")
        localStorage.removeItem("selectedSiteId")
      }
      logger.info("User logged out - local storage cleared")
    }
  }

  /**
   * Get authentication token
   */
  getToken() {
    if (typeof window === "undefined") return null
    return localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
  }

  /**
   * Get current user
   */
  getUser() {
    if (typeof window === "undefined") return null
    const user = localStorage.getItem(STORAGE_KEYS.USER)
    return user ? JSON.parse(user) : null
  }

  /**
   * Get user menu from login response
   */
  getMenu() {
    if (typeof window === "undefined") return null
    const menu = localStorage.getItem(STORAGE_KEYS.MENU)
    return parseStoredAuthMenu(menu)
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.getToken()
  }

  /**
   * Store authentication data
   */
  storeAuthData(token, user, menu) {
    if (typeof window !== "undefined") {
      if (token) {
        localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token)
      }
      if (user) {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user))
      }
      if (menu) {
        localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify(menu))
      }
      window.dispatchEvent(new CustomEvent("authMenuUpdated"))
    }
  }
}

export default new AuthService()

