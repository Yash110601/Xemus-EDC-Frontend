/** Map API role rows to matrix column shape (dynamic from GetRolesForDropdown). */
export function isSuperAdminRole(role) {
  if (!role || typeof role !== "object") return false

  const code = String(role.code ?? role.Code ?? role.roleCode ?? role.RoleCode ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
  const nameCompact = String(role.name ?? role.Name ?? role.roleName ?? role.RoleName ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")

  return code === "SUPERADMIN" || nameCompact === "superadmin" || nameCompact.includes("superadmin")
}

export function mapRolesForMatrix(roles = []) {
  if (!Array.isArray(roles)) return []

  return roles
    .filter((role) => !isSuperAdminRole(role))
    .map((role) => ({
      roleGuid: String(role.guid ?? role.roleGuid ?? role.Guid ?? "")
        .trim()
        .toLowerCase(),
      roleName: String(role.name ?? role.roleName ?? role.Name ?? "Role"),
    }))
    .filter((role) => role.roleGuid)
}

/** Keep only matrix columns for roles shown in the study matrix editor. */
export function pickMatrixForRoles(matrix = {}, matrixRoles = []) {
  if (!matrix || typeof matrix !== "object") return {}
  const next = {}
  for (const role of matrixRoles) {
    const guid = String(role?.roleGuid ?? "")
      .trim()
      .toLowerCase()
    if (!guid) continue
    if (matrix[guid] != null) {
      next[guid] = matrix[guid]
    }
  }
  return next
}
