import { isStudyPermissionEnforcementReady } from "@/lib/permissions/isStudyPermissionMatrixEnabled"
import { isNavModulePermissionKey, studyMatrixHasNavModuleKeys } from "@/lib/permissions/studyNavModuleKeys"

/**
 * Resolve a single permission when matrix enforcement is active.
 * Returns `null` only when enforcement is off or API is not ready — callers use legacy/menu checks.
 * When enforcement is on, the study/site effective permissions payload is authoritative.
 *
 * @param {string} permissionKey
 * @param {Record<string, boolean>|null|undefined} effectivePermissions
 * @param {{ matrixLoadedFromApi?: boolean }} options
 * @returns {boolean|null} true/false when enforced; null = use legacy path
 */
export function resolveStudyPermission(permissionKey, effectivePermissions, options = {}) {
  if (
    !isStudyPermissionEnforcementReady(
      options.matrixLoadedFromApi,
      options.studyUsesRolePermissionMatrix,
    )
  ) {
    return null
  }
  if (!effectivePermissions || typeof effectivePermissions !== "object") {
    return false
  }
  if (!Object.prototype.hasOwnProperty.call(effectivePermissions, permissionKey)) {
    if (isNavModulePermissionKey(permissionKey)) {
      if (studyMatrixHasNavModuleKeys(effectivePermissions)) {
        return false
      }
      return null
    }
    return false
  }
  return Boolean(effectivePermissions[permissionKey])
}
