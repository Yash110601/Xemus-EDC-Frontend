/**
 * Enhanced API Client
 * Professional HTTP client with interceptors, retry logic, and error handling
 */

import { API_CONFIG, HTTP_STATUS, ERROR_MESSAGES, getActiveApiBaseUrl } from "./config"
import { requestInterceptor, responseInterceptor, errorInterceptor } from "./interceptors"
import logger from "./logger"
import { notifyStudyPermissionDenied } from "@/lib/utils/studyPermissionApiFeedback"

class ApiClient {
  constructor() {
    this.baseURL = getActiveApiBaseUrl() || API_CONFIG.BASE_URL
    this.timeout = API_CONFIG.TIMEOUT
    this.maxRetries = API_CONFIG.MAX_RETRIES
    this.retryDelay = API_CONFIG.RETRY_DELAY
  }

  /**
   * Create AbortController for request timeout
   */
  createAbortController(timeout) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)
    return { controller, timeoutId }
  }

  /**
   * Sleep utility for retry delays
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(status, error) {
    // Retry on network errors, timeouts, and 5xx server errors
    if (!status || status === 0) return true // Network error
    if (status >= HTTP_STATUS.INTERNAL_SERVER_ERROR) return true // 5xx errors
    if (status === HTTP_STATUS.BAD_GATEWAY) return true
    if (status === HTTP_STATUS.SERVICE_UNAVAILABLE) return true
    if (error?.name === "AbortError") return true // Timeout
    return false
  }

  /**
   * Retry request with exponential backoff
   */
  async retryRequest(endpoint, options, retryCount = 0) {
    const maxRetries = options.maxRetries ?? this.maxRetries
    try {
      return await this.executeRequest(endpoint, options)
    } catch (error) {
      const shouldRetry =
        retryCount < maxRetries && this.isRetryableError(error.httpStatus || error.statusCode, error)

      if (shouldRetry) {
        const delay = this.retryDelay * Math.pow(2, retryCount) // Exponential backoff
        logger.warn(`Retrying request (${retryCount + 1}/${maxRetries}) after ${delay}ms`, {
          endpoint,
          error: error.message,
        })

        await this.sleep(delay)
        return this.retryRequest(endpoint, options, retryCount + 1)
      }

      throw error
    }
  }

  /**
   * Execute HTTP request
   */
  getBaseUrl() {
    return getActiveApiBaseUrl() || this.baseURL || API_CONFIG.BASE_URL
  }

  async executeRequest(endpoint, options = {}) {
    const url = `${this.getBaseUrl()}${endpoint}`
    const requestTimeout = options.timeout ?? this.timeout
    const { signal: externalSignal, timeout: _timeout, maxRetries: _maxRetries, ...restOptions } = options
    const { controller, timeoutId } = this.createAbortController(requestTimeout)

    // Combine timeout abort with caller signal (e.g. React effect cleanup) so in-flight requests cancel
    const combinedSignal =
      externalSignal &&
      typeof AbortSignal !== "undefined" &&
      typeof AbortSignal.any === "function"
        ? AbortSignal.any([controller.signal, externalSignal])
        : controller.signal

    // Check if body is FormData - if so, don't set Content-Type (browser will set it with boundary)
    const isFormData = restOptions.body instanceof FormData

    // Prepare request config
    let config = {
      ...restOptions,
      signal: combinedSignal,
      headers: {
        // Only set Content-Type if not FormData (browser will set it automatically for FormData)
        ...(isFormData ? {} : { "Content-Type": API_CONFIG.CONTENT_TYPE }),
        ...restOptions.headers,
      },
    }

    // Apply request interceptor
    config = requestInterceptor(config)

    logger.request(config.method || "GET", url, config)

    try {
      const response = await fetch(url, config)
      clearTimeout(timeoutId)

      // Apply response interceptor - pass isFormData flag to handle file uploads differently
      await responseInterceptor(response, { url, method: config.method, isFormData })

      // Parse response (robust):
      // Some backends return JSON without a proper content-type, so we parse from text first.
      const contentType = (response.headers.get("content-type") || "").toLowerCase()
      const rawText = await response.text()
      const trimmed = rawText.trim()
      let data = null

      const looksLikeJson = trimmed.startsWith("{") || trimmed.startsWith("[")
      const isJsonContentType = contentType.includes("application/json") || contentType.includes("+json")

      if (trimmed) {
        if (isJsonContentType || looksLikeJson) {
          try {
            data = JSON.parse(rawText)
          } catch {
            data = rawText
          }
        } else {
          data = rawText
        }
      }

      logger.response(config.method || "GET", url, response.status, data)

      // Handle non-JSON responses
      if (!data || typeof data !== "object") {
        return {
          isSuccess: response.ok,
          statusCode: response.status,
          data: data || null,
          message: response.ok ? "Request successful" : `Request failed (HTTP ${response.status})`,
          httpStatus: response.status,
        }
      }

      // Standardize response format
      // Handle both isSuccess and success fields from API
      const isSuccess = data.isSuccess !== undefined 
        ? data.isSuccess 
        : (data.success !== undefined ? data.success : response.ok)

      const errorsList = Array.isArray(data.errors)
        ? data.errors
        : Array.isArray(data.Errors)
          ? data.Errors
          : []

      const title = data.title ?? data.Title
      const detail = data.detail ?? data.Detail
      const traceId = data.traceId ?? data.TraceId ?? data.trace_id ?? data.Trace_id

      let message =
        data.message || (response.ok ? "Request successful" : `Request failed (HTTP ${response.status})`)
      if (response.status === 403 && !response.ok) {
        const hint = /permission|forbidden|not allowed|access denied|feature|CRF_/i
        const blob = [message, detail, title].filter(Boolean).join(" ")
        if (!hint.test(blob)) {
          message = `You don't have permission for this action. ${message}`.replace(/\s+/g, " ").trim()
        }
      }

      const standardized = {
        isSuccess: isSuccess,
        statusCode: data.statusCode || response.status,
        data: data.data !== undefined ? data.data : data,
        message,
        httpStatus: response.status,
        errors: errorsList,
        title: title ?? null,
        detail: detail ?? null,
        traceId: traceId ?? null,
      }

      if (!standardized.isSuccess && standardized.httpStatus === 403) {
        notifyStudyPermissionDenied(standardized)
      }

      if (!standardized.isSuccess && standardized.httpStatus === 401) {
        const blob = [message, detail, title].filter(Boolean).join(" ")
        if (/permission|forbidden|not allowed|access denied|insufficient|not authorized/i.test(blob)) {
          notifyStudyPermissionDenied({ ...standardized, statusCode: 403 })
        }
      }

      return standardized
    } catch (error) {
      clearTimeout(timeoutId)

      // Handle abort (timeout)
      if (error.name === "AbortError") {
        logger.error("Request timeout", { endpoint, timeout: requestTimeout })
        throw {
          isSuccess: false,
          statusCode: 408,
          data: null,
          message: ERROR_MESSAGES.TIMEOUT,
          httpStatus: 408,
        }
      }

      // Handle other errors
      const errorResponse = errorInterceptor(error, { url, method: config.method })
      throw errorResponse
    }
  }

  /**
   * Main request method with retry logic
   */
  async request(endpoint, options = {}) {
    try {
      return await this.retryRequest(endpoint, options)
    } catch (error) {
      // If error is already formatted, return it
      if (error.isSuccess !== undefined) {
        return error
      }
      // Otherwise, format it
      return errorInterceptor(error, { url: endpoint, method: options.method })
    }
  }

  /**
   * GET request
   */
  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: "GET" })
  }

  /**
   * POST request
   */
  post(endpoint, data, options = {}) {
    // If data is FormData, use it directly; otherwise stringify JSON
    const body = data instanceof FormData ? data : JSON.stringify(data)
    return this.request(endpoint, {
      ...options,
      method: "POST",
      body: body,
    })
  }

  /**
   * PUT request
   */
  put(endpoint, data, options = {}) {
    // If data is FormData, use it directly; otherwise stringify JSON
    const body = data instanceof FormData ? data : JSON.stringify(data)
    return this.request(endpoint, {
      ...options,
      method: "PUT",
      body: body,
    })
  }

  /**
   * PATCH request
   */
  patch(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: "PATCH",
      body: JSON.stringify(data),
    })
  }

  /**
   * DELETE request
   */
  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: "DELETE" })
  }
}

// Create singleton instance
const apiClient = new ApiClient()

export default apiClient
export { ApiClient }

