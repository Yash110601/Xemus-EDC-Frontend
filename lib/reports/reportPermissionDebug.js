/**
 * Opt-in diagnostics for report menu permission resolution.
 * Enable: NEXT_PUBLIC_DEBUG_REPORT_PERMS=true  OR  development build (console.debug only).
 */

const DEBUG_ENV = process.env.NEXT_PUBLIC_DEBUG_REPORT_PERMS === "true"
const IS_DEV = process.env.NODE_ENV === "development"

export function isReportPermissionDebugEnabled() {
  return DEBUG_ENV || IS_DEV
}

/**
 * @param {string} event
 * @param {Record<string, unknown>} payload
 */
export function logReportPermission(event, payload = {}) {
  if (!isReportPermissionDebugEnabled()) return
  console.debug(`[ReportPermissions] ${event}`, payload)
}
