/**
 * Normalize login menu payloads from .NET API (camelCase, PascalCase, nested shapes).
 */

export function normalizeMenuPermissions(menu) {
  if (Array.isArray(menu)) return menu
  if (!menu || typeof menu !== "object") return []

  if (Array.isArray(menu.features)) return menu.features
  if (Array.isArray(menu.Features)) return menu.Features
  if (Array.isArray(menu.data)) return menu.data
  if (Array.isArray(menu.items)) return menu.items
  if (Array.isArray(menu.Items)) return menu.Items

  return []
}

/**
 * Extract menu array from login response `data` object.
 * @param {unknown} payload
 * @returns {unknown[]|null}
 */
export function extractMenuFromAuthPayload(payload) {
  if (!payload || typeof payload !== "object") return null

  const directCandidates = [
    payload.menu,
    payload.Menu,
    payload.features,
    payload.Features,
    payload.navigation,
    payload.Navigation,
  ]

  for (const candidate of directCandidates) {
    const normalized = normalizeMenuPermissions(candidate)
    if (normalized.length > 0) return normalized
  }

  if (payload.data && typeof payload.data === "object") {
    return extractMenuFromAuthPayload(payload.data)
  }

  return null
}

/**
 * @param {unknown} stored - Value from localStorage MENU key
 * @returns {unknown[]|null}
 */
export function parseStoredAuthMenu(stored) {
  if (!stored) return null
  try {
    const parsed = typeof stored === "string" ? JSON.parse(stored) : stored
    const normalized = normalizeMenuPermissions(parsed)
    if (normalized.length > 0) return normalized
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}
