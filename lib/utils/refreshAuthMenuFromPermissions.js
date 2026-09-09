import { authService, permissionsService } from "@/lib/services"
import {
  buildNavMenuFromPermissionFeatures,
  getUserRoleGuid,
  isPrivilegedNavUser,
} from "@/lib/utils/authMenuFallback"
import { hasMenuViewPermission } from "@/lib/utils/menuRoutePermissions"

const REPORTS_FEATURE_CODES = new Set(["REPORTS", "REPORT_MGMT"])

export function isReportsMenuFeature(feature) {
  if (!feature || typeof feature !== "object") return false
  const code = String(feature.code ?? feature.Code ?? "")
    .trim()
    .toUpperCase()
  const route = String(feature.route ?? feature.Route ?? "")
    .trim()
    .toLowerCase()
  return REPORTS_FEATURE_CODES.has(code) || route === "/reports"
}

export function reportsMenuHasSubFeatureCode(menu, subFeatureCode) {
  if (!Array.isArray(menu) || !subFeatureCode) return false
  const reports = menu.find(isReportsMenuFeature)
  if (!reports) return false
  const codeUpper = String(subFeatureCode).trim().toUpperCase()
  const subs = reports.subFeatures ?? reports.SubFeatures ?? []
  return subs.some(
    (sf) =>
      String(sf.code ?? sf.Code ?? "")
        .trim()
        .toUpperCase() === codeUpper && hasMenuViewPermission(sf),
  )
}

/**
 * Rebuild login menu from Role Permissions API (fixes stale localStorage after new sub-features).
 * @returns {Promise<object[]|null>}
 */
export async function refreshAuthMenuFromRolePermissions() {
  if (typeof window === "undefined") return null

  const user = authService.getUser()
  const roleGuid = getUserRoleGuid(user)
  if (!roleGuid) return null

  const response = await permissionsService.getRolePermissions(roleGuid)
  if (!response?.isSuccess || !response.data) return null

  const built = buildNavMenuFromPermissionFeatures(response.data, {
    allowAllIfEmpty: isPrivilegedNavUser(user),
  })
  if (!built.length) return null

  authService.storeAuthData(authService.getToken(), user, built)
  window.dispatchEvent(new CustomEvent("authMenuUpdated"))
  return built
}
