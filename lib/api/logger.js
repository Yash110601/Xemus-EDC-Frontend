/**
 * API Logger Module
 * Centralized logging for API requests and responses
 */

const LOG_LEVELS = {
  DEBUG: "DEBUG",
  INFO: "INFO",
  WARN: "WARN",
  ERROR: "ERROR",
}

class ApiLogger {
  constructor(enabled = false) {
    this.enabled = enabled
  }

  log(level, message, data = null) {
    if (!this.enabled) return

    const timestamp = new Date().toISOString()
    const logMessage = `[API ${level}] ${timestamp} - ${message}`

    switch (level) {
      case LOG_LEVELS.DEBUG:
        console.debug(logMessage, data || "")
        break
      case LOG_LEVELS.INFO:
        console.info(logMessage, data || "")
        break
      case LOG_LEVELS.WARN:
        console.warn(logMessage, data || "")
        break
      case LOG_LEVELS.ERROR:
        console.error(logMessage, data || "")
        break
      default:
        console.log(logMessage, data || "")
    }
  }

  debug(message, data) {
    this.log(LOG_LEVELS.DEBUG, message, data)
  }

  info(message, data) {
    this.log(LOG_LEVELS.INFO, message, data)
  }

  warn(message, data) {
    this.log(LOG_LEVELS.WARN, message, data)
  }

  error(message, data) {
    this.log(LOG_LEVELS.ERROR, message, data)
  }

  request(method, url, config) {
    this.debug(`Request: ${method} ${url}`, {
      headers: config.headers,
      body: config.body,
    })
  }

  response(method, url, status, data) {
    this.debug(`Response: ${method} ${url}`, {
      status,
      data,
    })
  }
}

export default new ApiLogger(process.env.NEXT_PUBLIC_API_LOGGING === "true")

