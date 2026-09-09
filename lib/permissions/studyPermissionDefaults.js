import { ALL_STUDY_PERMISSION_KEYS } from "@/lib/permissions/studyPermissionKeys"

function keys(set) {
  return Object.fromEntries(ALL_STUDY_PERMISSION_KEYS.map((key) => [key, set.has(key)]))
}

/** Suggested defaults by role name (preview / seed only until backend stores matrix). */
const ROLE_NAME_DEFAULTS = {
  cra: keys(
    new Set([
      "crf.view",
      "crf.edit",
      "query.create",
      "query.respond",
      "query.close",
      "sdv.verify",
      "report.view",
      "report.export",
      "dblock.view",
    ]),
  ),
  crc: keys(
    new Set(["crf.view", "crf.edit", "query.respond", "report.view"]),
  ),
  pi: keys(
    new Set(["crf.view", "crf.edit", "query.respond", "pi.signoff", "report.view"]),
  ),
  dm: keys(
    new Set([
      "crf.view",
      "query.create",
      "query.respond",
      "query.close",
      "report.view",
      "report.export",
      "dblock.view",
      "dblock.apply",
    ]),
  ),
  mm: keys(
    new Set(["crf.view", "query.create", "query.respond", "report.view", "report.export"]),
  ),
  admin: keys(new Set(ALL_STUDY_PERMISSION_KEYS)),
  sponsor: keys(new Set(["crf.view", "report.view", "report.export", "dblock.view"])),
  auditor: keys(
    new Set(["crf.view", "report.view", "report.export", "data.masking.view", "dblock.view"]),
  ),
}

function normalizeRoleName(roleName) {
  return String(roleName ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
}

/** Build default matrix row for a role (all false if unknown). */
export function buildDefaultPermissionsForRole(roleName) {
  const normalized = normalizeRoleName(roleName)
  for (const [token, permissions] of Object.entries(ROLE_NAME_DEFAULTS)) {
    if (normalized.includes(token)) {
      return { ...permissions }
    }
  }
  return keys(new Set())
}

/**
 * @param {{ roleGuid: string, roleName: string }[]} roles
 * @returns {Record<string, Record<string, boolean>>} roleGuid -> permissionKey -> allowed
 */
export function buildDefaultStudyPermissionMatrix(roles = []) {
  const matrix = {}
  for (const role of roles) {
    const guid = String(role?.roleGuid ?? role?.guid ?? "").trim()
    if (!guid) continue
    matrix[guid] = buildDefaultPermissionsForRole(role?.roleName ?? role?.name)
  }
  return matrix
}
