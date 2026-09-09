/**
 * Resolve View/Add/Edit/Delete/Export flags from the login menu for a given pathname.
 * Mirrors route-matching used on eCRF manual entry, with extra flag aliases (`isEdit`, etc.)
 * so role-permission payloads stay consistent.
 */

const normalizePath = (value) => {
  const path = (value || "").toString().trim().toLowerCase()
  if (!path) return ""
  return path.startsWith("/") ? path : `/${path}`
}

function readAnyTrue(node, keys) {
  if (!node || typeof node !== "object") return false
  return keys.some((k) => node[k] === true)
}

const PERM_FLAG_KEYS = {
  canView: ["canView", "isView", "isCanView", "CanView", "IsView", "IsCanView"],
  canAdd: ["canAdd", "isAdd", "isCanAdd", "CanAdd", "IsAdd", "IsCanAdd"],
  canEdit: ["canEdit", "isEdit", "isCanEdit", "CanEdit", "IsEdit", "IsCanEdit"],
  canDelete: ["canDelete", "isDelete", "isCanDelete", "CanDelete", "IsDelete", "IsCanDelete"],
  canExport: ["canExport", "isExport", "isCanExport", "canDownload", "isDownload", "CanExport", "IsExport", "IsCanExport"],
}

function hasExplicitPermissionFlag(node, keys) {
  if (!node || typeof node !== "object") return false
  return keys.some((k) => node[k] !== undefined && node[k] !== null)
}

export function normalizeMenuPermissions(menu) {
  if (Array.isArray(menu)) return menu
  if (menu && Array.isArray(menu.features)) return menu.features
  if (menu && Array.isArray(menu.Features)) return menu.Features
  if (menu && Array.isArray(menu.data)) return menu.data
  if (menu && Array.isArray(menu.items)) return menu.items
  if (menu && Array.isArray(menu.Items)) return menu.Items
  return []
}

/**
 * @param {unknown} menu - Raw menu from auth (array or `{ features: [] }`)
 * @param {string} [pathname]
 * @returns {{ canView: boolean, canAdd: boolean, canEdit: boolean, canDelete: boolean, canExport: boolean }}
 */
/** Sidebar / nav: true when API sends canView/isView; default true when flags omitted (local dev APIs). */
export function hasMenuViewPermission(node) {
  if (!node || typeof node !== "object") return false
  const keys = PERM_FLAG_KEYS.canView
  if (!hasExplicitPermissionFlag(node, keys)) return true
  return readAnyTrue(node, keys)
}

/**
 * Resolve CRUD flags for a matched menu/sub-feature node.
 * canView matches sidebar (omitted flag = allowed); other flags require explicit true.
 */
export function resolveMenuNodePermissions(node) {
  if (!node || typeof node !== "object") {
    return { canView: false, canAdd: false, canEdit: false, canDelete: false, canExport: false }
  }

  return {
    canView: hasMenuViewPermission(node),
    canAdd: readAnyTrue(node, PERM_FLAG_KEYS.canAdd),
    canEdit: readAnyTrue(node, PERM_FLAG_KEYS.canEdit),
    canDelete: readAnyTrue(node, PERM_FLAG_KEYS.canDelete),
    canExport: readAnyTrue(node, PERM_FLAG_KEYS.canExport),
  }
}

/**
 * Resolve permission flags for a top-level menu feature by code (e.g. USER_MGMT).
 * @param {unknown} menu
 * @param {string} featureCode
 */
export function resolveFeatureMenuPermissions(menu, featureCode) {
  const menuPermissions = normalizeMenuPermissions(menu)
  const code = String(featureCode ?? "")
    .trim()
    .toUpperCase()
  const picked = menuPermissions.find(
    (feature) => String(feature?.code ?? feature?.Code ?? "").trim().toUpperCase() === code,
  )

  if (!picked) {
    return { canView: false, canAdd: false, canEdit: false, canDelete: false, canExport: false }
  }

  return {
    canView: readAnyTrue(picked, PERM_FLAG_KEYS.canView),
    canAdd: readAnyTrue(picked, PERM_FLAG_KEYS.canAdd),
    canEdit: readAnyTrue(picked, PERM_FLAG_KEYS.canEdit),
    canDelete: readAnyTrue(picked, PERM_FLAG_KEYS.canDelete),
    canExport: readAnyTrue(picked, PERM_FLAG_KEYS.canExport),
  }
}

/**
 * Resolve permission flags for a sub-feature by code (e.g. VISIT_ATTACHMENTS).
 * @returns {{ found: boolean, canView: boolean, canAdd: boolean, canEdit: boolean, canDelete: boolean, canExport: boolean }}
 */
export function resolveSubFeatureMenuPermissions(menu, subFeatureCode) {
  const menuPermissions = normalizeMenuPermissions(menu)
  const code = String(subFeatureCode ?? "")
    .trim()
    .toUpperCase()
  if (!code) {
    return {
      found: false,
      canView: false,
      canAdd: false,
      canEdit: false,
      canDelete: false,
      canExport: false,
    }
  }

  for (const feature of menuPermissions) {
    const subs = feature?.subFeatures ?? feature?.SubFeatures ?? []
    if (!Array.isArray(subs)) continue
    const picked = subs.find(
      (subFeature) =>
        String(subFeature?.code ?? subFeature?.Code ?? "")
          .trim()
          .toUpperCase() === code,
    )
    if (picked) {
      return { found: true, ...resolveMenuNodePermissions(picked) }
    }
  }

  return {
    found: false,
    canView: false,
    canAdd: false,
    canEdit: false,
    canDelete: false,
    canExport: false,
  }
}

export function resolveRouteMenuPermissions(menu, pathname) {
  const menuPermissions = normalizeMenuPermissions(menu)
  if (!menuPermissions.length) {
    return { canView: true, canAdd: true, canEdit: true, canDelete: true, canExport: true }
  }

  const currentPath = normalizePath(pathname)
  const candidates = []

  menuPermissions.forEach((feature) => {
    const featureRoute = normalizePath(feature?.route)
    const featureMatch =
      featureRoute &&
      (currentPath === featureRoute ||
        currentPath.startsWith(`${featureRoute}/`) ||
        featureRoute.startsWith(`${currentPath}/`))
    if (featureMatch) candidates.push({ node: feature, routeLen: featureRoute.length, priority: 1 })

    if (Array.isArray(feature?.subFeatures)) {
      feature.subFeatures.forEach((subFeature) => {
        const subRoute = normalizePath(subFeature?.route)
        const subMatch =
          subRoute &&
          (currentPath === subRoute ||
            currentPath.startsWith(`${subRoute}/`) ||
            subRoute.startsWith(`${currentPath}/`))
        if (subMatch) candidates.push({ node: subFeature, routeLen: subRoute.length, priority: 2 })
      })
    }
  })

  const sorted = candidates.sort((a, b) => b.priority - a.priority || b.routeLen - a.routeLen)
  const picked = sorted[0]?.node

  if (!picked) {
    return { canView: true, canAdd: true, canEdit: true, canDelete: true, canExport: true }
  }

  return {
    canView: readAnyTrue(picked, PERM_FLAG_KEYS.canView),
    canAdd: readAnyTrue(picked, PERM_FLAG_KEYS.canAdd),
    canEdit: readAnyTrue(picked, PERM_FLAG_KEYS.canEdit),
    canDelete: readAnyTrue(picked, PERM_FLAG_KEYS.canDelete),
    canExport: readAnyTrue(picked, PERM_FLAG_KEYS.canExport),
  }
}
