/**
 * Per-menu study permissions: module.nav.{menu_code}.{action}
 * action: view | add | edit | delete | export (same as Masters → Role Permission)
 */

export const NAV_MODULE_PREFIX = "module.nav."

export const NAV_MODULE_ACTIONS = Object.freeze([
  { id: "view", label: "View" },
  { id: "add", label: "Add" },
  { id: "edit", label: "Edit" },
  { id: "delete", label: "Delete" },
  { id: "export", label: "Export" },
])

const LEGACY_NAV_MODULE_KEYS = Object.freeze([
  "module.crf.show",
  "module.reports.show",
  "module.dblock.show",
])

export function normalizeMenuCode(menuCode) {
  return String(menuCode ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
}

/** Legacy single-toggle key (treated as View). */
export function buildNavModulePermissionKey(menuCode) {
  const normalized = normalizeMenuCode(menuCode)
  return normalized ? `${NAV_MODULE_PREFIX}${normalized}` : ""
}

export function buildNavModuleActionKey(menuCode, action) {
  const normalized = normalizeMenuCode(menuCode)
  const actionId = String(action ?? "").trim().toLowerCase()
  if (!normalized || !actionId) return ""
  return `${NAV_MODULE_PREFIX}${normalized}.${actionId}`
}

export function isNavModulePermissionKey(key) {
  const value = String(key ?? "").trim()
  return value.startsWith(NAV_MODULE_PREFIX) || LEGACY_NAV_MODULE_KEYS.includes(value)
}

export function isLegacyCoarseNavModuleKey(key) {
  return LEGACY_NAV_MODULE_KEYS.includes(String(key ?? "").trim())
}

export function parseNavModulePermissionKey(key) {
  const value = String(key ?? "").trim()
  if (!value.startsWith(NAV_MODULE_PREFIX)) return null

  const remainder = value.slice(NAV_MODULE_PREFIX.length)
  const dot = remainder.lastIndexOf(".")
  if (dot <= 0) {
    return { menuCode: remainder, action: "view" }
  }

  const action = remainder.slice(dot + 1)
  const menuCode = remainder.slice(0, dot)
  if (NAV_MODULE_ACTIONS.some((item) => item.id === action)) {
    return { menuCode, action }
  }

  return { menuCode: remainder, action: "view" }
}

export function studyMatrixHasNavModuleKeys(permissions) {
  if (!permissions || typeof permissions !== "object") return false
  return Object.keys(permissions).some((key) => isNavModulePermissionKey(key))
}

export function resolveNavModuleViewAllowed(menuCode, canFn, permissions) {
  const viewKey = buildNavModuleActionKey(menuCode, "view")
  const legacyKey = buildNavModulePermissionKey(menuCode)

  const viewAllowed = viewKey ? canFn(viewKey) : null
  const legacyAllowed = legacyKey ? canFn(legacyKey) : null
  if (viewAllowed === true || legacyAllowed === true) return true
  if (viewAllowed === false || legacyAllowed === false) return false

  if (!studyMatrixHasNavModuleKeys(permissions)) return true

  return false
}
