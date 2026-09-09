/**
 * Study/site assignment validation rules (§3.2, §4.2).
 * Used by future assignment UI only — does not alter existing AssignUserModal yet.
 */

export const ASSIGNMENT_SCOPE = Object.freeze({
  STUDY: "study",
  SITE: "site",
})

function normalizeRoleName(roleName) {
  return String(roleName ?? "")
    .trim()
    .toLowerCase()
}

export function isCrcRoleName(roleName) {
  const role = normalizeRoleName(roleName)
  return role.includes("crc") && !role.includes("cra")
}

export function isPiRoleName(roleName) {
  const role = normalizeRoleName(roleName)
  return role.includes("pi") || role.includes("principalinvestigator") || role.includes("investigator")
}

export function isCraRoleName(roleName) {
  const role = normalizeRoleName(roleName).replace(/\s+/g, "")
  return role.includes("cra")
}

/** Max sites selectable for role in one study (null = unlimited). */
export function getMaxSitesPerStudyForRole(roleName) {
  if (isCrcRoleName(roleName) || isPiRoleName(roleName)) return 1
  return null
}

/**
 * @param {string} roleName
 * @param {string[]} selectedSiteIds
 * @returns {{ valid: boolean, message?: string }}
 */
export function validateSiteSelectionForRole(roleName, selectedSiteIds = []) {
  const ids = selectedSiteIds.filter(Boolean)
  const max = getMaxSitesPerStudyForRole(roleName)

  if (max === 1 && ids.length > 1) {
    const label = isPiRoleName(roleName) ? "PI" : "CRC"
    return {
      valid: false,
      message: `${label} users can be assigned to only one site per study.`,
    }
  }

  return { valid: true }
}
