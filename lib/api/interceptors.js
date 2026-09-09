/**
 * API Interceptors Module
 * Request and response interceptors for API calls
 */

import { STORAGE_KEYS, HTTP_STATUS } from "./config"
import logger from "./logger"

const PERMISSION_DENIED_HINTS = [
  "permission",
  "forbidden",
  "not allowed",
  "access denied",
  "insufficient",
  "not authorized",
  "do not have access",
  "feature required",
  "crf_",
]

async function responseLooksLikePermissionDenied(response) {
  try {
    const text = await response.clone().text()
    const trimmed = text.trim()
    if (!trimmed) return false

    const lower = trimmed.toLowerCase()
    if (PERMISSION_DENIED_HINTS.some((hint) => lower.includes(hint))) {
      return true
    }

    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      const data = JSON.parse(trimmed)
      const blob = [data?.message, data?.Message, data?.detail, data?.Detail, data?.title, data?.Title]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return PERMISSION_DENIED_HINTS.some((hint) => blob.includes(hint))
    }
  } catch {
    // Fall through — treat as auth failure
  }
  return false
}

/**
 * Request Interceptor
 * Modifies requests before they are sent
 */
export const requestInterceptor = (config) => {
  // Add authentication token
  if (typeof window !== "undefined") {
    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      }
    }
  }

  // Add request timestamp
  config.metadata = {
    ...config.metadata,
    timestamp: new Date().toISOString(),
  }

  logger.debug("Request interceptor applied", config)

  return config
}

/**
 * Response Interceptor
 * Handles responses and errors
 */
export const responseInterceptor = async (response, originalRequest) => {
  // Handle 401 Unauthorized - Token expired or invalid
  if (response.status === HTTP_STATUS.UNAUTHORIZED) {
    const permissionDenied = await responseLooksLikePermissionDenied(response)

    logger.warn(
      permissionDenied
        ? "Unauthorized response treated as permission denial (no auto-logout)"
        : "Unauthorized request - token may be expired",
      {
        url: originalRequest?.url,
        method: originalRequest?.method,
        isFormData: originalRequest?.isFormData,
      },
    )

    // For file uploads (FormData), don't immediately log out - let the calling code handle the error
    // This prevents users from being logged out during file uploads due to temporary auth issues
    const isFileUpload = originalRequest?.isFormData === true

    if (!isFileUpload && !permissionDenied) {
      // Only auto-logout for non-file-upload requests.
      // Redirect on ANY 401 (token missing/expired/invalid) to avoid pages stuck in 401 error state.
      // Use setTimeout to allow calling code to receive the response first.
      setTimeout(() => {
        if (typeof window === "undefined") return

        // Clear auth data (safe even if already empty)
        localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN)
        localStorage.removeItem(STORAGE_KEYS.USER)
        localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN)
        localStorage.removeItem(STORAGE_KEYS.MENU)

        // Redirect to login if not already there
        if (window.location.pathname !== "/login") {
          window.location.href = "/login"
        }
      }, 100)
    } else {
      // For file uploads, just log the warning but don't auto-logout
      // The calling code should handle the 401 error and show appropriate message to user
      logger.warn("Unauthorized file upload request - error will be handled by calling code")
    }
  }

  // Handle 403 Forbidden
  if (response.status === HTTP_STATUS.FORBIDDEN) {
    logger.warn("Forbidden request - insufficient permissions")
  }

  // Handle 500+ Server Errors
  if (response.status >= HTTP_STATUS.INTERNAL_SERVER_ERROR) {
    logger.error("Server error", {
      status: response.status,
      url: originalRequest.url,
    })
  }

  return response
}

/**
 * Error Interceptor
 * Handles request errors
 */
export const errorInterceptor = (error, originalRequest) => {
  const message =
    error?.message ||
    error?.Message ||
    (typeof error === "string" ? error : null) ||
    "Request failed"
  const url = originalRequest?.url || originalRequest?.endpoint || null
  const method = originalRequest?.method || null

  logger.error("Request error", {
    message,
    url,
    method,
    name: error?.name || null,
  })

  // Already-shaped API error (e.g. re-thrown from a prior interceptor pass)
  if (error && typeof error === "object" && error.isSuccess !== undefined) {
    return error
  }

  // Handle network errors
  if (error?.name === "TypeError" && String(message).toLowerCase().includes("fetch")) {
    const devHint =
      typeof process !== "undefined" &&
      process.env.NODE_ENV === "development" &&
      message
        ? ` (${message})`
        : ""
    return {
      isSuccess: false,
      statusCode: 0,
      data: null,
      message: `Network error. Please check your internet connection.${devHint}`,
      httpStatus: 0,
    }
  }

  // Handle timeout errors
  if (error?.name === "AbortError") {
    return {
      isSuccess: false,
      statusCode: 408,
      data: null,
      message: "Request timeout. Please try again.",
      httpStatus: 408,
    }
  }

  return {
    isSuccess: false,
    statusCode: 500,
    data: null,
    message: message || "An unexpected error occurred",
    httpStatus: 500,
  }
}

