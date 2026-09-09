/**
 * System / infrastructure endpoints (time-context, health, …).
 */

import { API_CONFIG } from "../api/config"
import apiClient from "../api/client"
import logger from "../api/logger"
import { setAppTimeContext, DEFAULT_TIME_CONTEXT } from "../utils/appDateTime"

class SystemService {
  /**
   * GET /api/system/time-context
   * Also accepts X-App-TimeZone from response headers when present.
   */
  async getTimeContext() {
    try {
      const endpoint = API_CONFIG.ENDPOINTS.SYSTEM?.TIME_CONTEXT || "/system/time-context"
      const response = await apiClient.get(endpoint, { notify: false })
      const data = response?.data ?? response?.Data ?? {}
      const headerTz =
        typeof window !== "undefined"
          ? sessionStorage.getItem("X-App-TimeZone") || ""
          : ""

      const ctx = setAppTimeContext({
        displayName: data.displayName ?? data.DisplayName ?? DEFAULT_TIME_CONTEXT.displayName,
        timeZoneId:
          data.timeZoneId ??
          data.TimeZoneId ??
          (headerTz || DEFAULT_TIME_CONTEXT.timeZoneId),
        offset: data.offset ?? data.Offset ?? data.utcOffset ?? data.UtcOffset,
        utcOffsetMinutes: data.utcOffsetMinutes ?? data.UtcOffsetMinutes,
      })

      return {
        isSuccess: Boolean(response?.isSuccess !== false),
        data: ctx,
        message: response?.message,
        httpStatus: response?.httpStatus,
      }
    } catch (error) {
      logger.warn("getTimeContext failed — using IST defaults", error)
      setAppTimeContext(DEFAULT_TIME_CONTEXT)
      return {
        isSuccess: false,
        data: DEFAULT_TIME_CONTEXT,
        message: error?.message || "Failed to load time context",
        httpStatus: error?.httpStatus ?? 0,
      }
    }
  }
}

export const systemService = new SystemService()
export default systemService
