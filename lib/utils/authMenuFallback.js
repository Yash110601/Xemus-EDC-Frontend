import { hasMenuViewPermission, normalizeMenuPermissions } from "@/lib/utils/menuRoutePermissions"

/** Admin / Super Admin — may need menu fallback when login payload omits menu (common on local DB). */
export function isPrivilegedNavUser(user) {
  if (!user || typeof user !== "object") return false

  const code = String(user.roleCode ?? user.RoleCode ?? "")
    .trim()
    .toUpperCase()
  const nameCompact = String(user.roleName ?? user.RoleName ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")

  if (code === "ADMIN" || code === "SUPERADMIN") return true
  if (nameCompact === "admin" || nameCompact === "superadmin") return true
  if (nameCompact.includes("superadmin")) return true

  return false
}

/**
 * Build sidebar menu from Permissions API feature tree.
 * @param {unknown} features
 * @param {{ allowAllIfEmpty?: boolean }} [options]
 */
export function buildNavMenuFromPermissionFeatures(features, { allowAllIfEmpty = false } = {}) {
  const list = normalizeMenuPermissions(features)
  if (!list.length) return []

  const mapNode = (node) => {
    const subRaw = node?.subFeatures ?? node?.SubFeatures ?? []
    const subFeatures = Array.isArray(subRaw)
      ? subRaw.filter((sf) => hasMenuViewPermission(sf)).map((sf) => ({ ...sf }))
      : []
    return { ...node, subFeatures }
  }

  let mapped = list.filter((f) => hasMenuViewPermission(f)).map(mapNode)

  if (mapped.length === 0 && allowAllIfEmpty) {
    mapped = list.map((f) => ({
      ...f,
      canView: true,
      subFeatures: (f.subFeatures ?? f.SubFeatures ?? []).map((sf) => ({ ...sf, canView: true })),
    }))
  }

  return mapped
}

export function getUserRoleGuid(user) {
  if (!user) return null
  const guid = user.roleGuid ?? user.RoleGuid
  if (!guid) return null
  const s = String(guid).trim()
  if (!s || s.toLowerCase() === "00000000-0000-0000-0000-000000000000") return null
  return s
}
