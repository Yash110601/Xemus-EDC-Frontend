import {
  buildNavModuleActionKey,
  isLegacyCoarseNavModuleKey,
  isNavModulePermissionKey,
  normalizeMenuCode,
  resolveNavModuleViewAllowed,
  studyMatrixHasNavModuleKeys,
} from "@/lib/permissions/studyNavModuleKeys"

/** Child sidebar codes inherit parent module.view when study matrix has no child keys yet. */
const NAV_CHILD_PARENT_VIEW_CODES = Object.freeze({
  patient_enrolment_create: "patient_enrolment",
  patient_enrolment_manage: "patient_enrolment",
})
import { pickMatrixForRoles } from "@/lib/permissions/mapRolesForMatrix"
import { STUDY_PERMISSION } from "@/lib/permissions/coalesceStudyPermission"

const normalizeNavHref = (href) => String(href ?? "").trim().toLowerCase().replace(/\/$/, "")

const LEGACY_ROUTE_RULES = [
  {
    test: (href) => href.startsWith("/ecrf-data-entry"),
    legacyKey: "module.crf.show",
    viewKey: STUDY_PERMISSION.CRF_VIEW,
  },
  {
    test: (href) => href.startsWith("/reports"),
    legacyKey: "module.reports.show",
    viewKey: STUDY_PERMISSION.REPORT_VIEW,
  },
  {
    test: (href) => href.startsWith("/patient-enrolment"),
    legacyKey: "module.nav.patient_enrolment",
    viewKey: null,
  },
  {
    test: (href) => href.includes("/study-management/database-lock"),
    legacyKey: "module.dblock.show",
    viewKey: STUDY_PERMISSION.DBLOCK_VIEW,
  },
]

function legacyRouteAllowed(href, canFn, permissions) {
  const normalized = normalizeNavHref(href)
  if (!normalized) return false

  for (const rule of LEGACY_ROUTE_RULES) {
    if (!rule.test(normalized)) continue
    if (canFn(rule.legacyKey) === true) return true
    if (!studyMatrixHasNavModuleKeys(permissions) && canFn(rule.viewKey) === true) return true
    return false
  }
  return false
}

export function isNavItemAllowedByStudyMatrix(navItem, canFn, permissions, { matrixActive = false } = {}) {
  if (!matrixActive || typeof canFn !== "function") return true

  const navCode = navItem?.navCode
  if (!navCode) return true

  if (resolveNavModuleViewAllowed(navCode, canFn, permissions)) return true

  const parentMenuCode = NAV_CHILD_PARENT_VIEW_CODES[normalizeMenuCode(navCode)]
  if (parentMenuCode && resolveNavModuleViewAllowed(parentMenuCode, canFn, permissions)) {
    return true
  }

  if (!studyMatrixHasNavModuleKeys(permissions)) {
    if (navItem?.href && legacyRouteAllowed(navItem.href, canFn, permissions)) return true
    return false
  }

  return false
}

function pruneNavTree(items, canFn, permissions, matrixActive) {
  if (!Array.isArray(items)) return []

  return items
    .map((item) => {
      const subItems = item.subItems?.length
        ? pruneNavTree(item.subItems, canFn, permissions, matrixActive)
        : []

      const selfBlocked = !isNavItemAllowedByStudyMatrix(item, canFn, permissions, { matrixActive })

      if (selfBlocked && !item.subItems?.length) return null

      if (item.subItems?.length) {
        if (subItems.length === 0 && !item.href) return null
        if (selfBlocked && subItems.length === 0) return null
        return { ...item, subItems }
      }

      return { ...item, subItems }
    })
    .filter(Boolean)
}

export function filterNavItemsByStudyMatrix(
  items,
  canFn,
  { matrixActive = false, permissions = null } = {},
) {
  if (!matrixActive) return items ?? []
  return pruneNavTree(items, canFn, permissions, true)
}

export function mergeNavModuleKeysIntoMatrix(matrix, navModulePermissions, { defaultValue = false } = {}) {
  if (!matrix || typeof matrix !== "object" || !Array.isArray(navModulePermissions)) return matrix

  const next = { ...matrix }
  for (const [roleGuid, row] of Object.entries(matrix)) {
    const mergedRow = { ...(row ?? {}) }
    for (const perm of navModulePermissions) {
      const key = perm?.key
      if (!key || !isNavModulePermissionKey(key) || isLegacyCoarseNavModuleKey(key)) continue
      if (!Object.prototype.hasOwnProperty.call(mergedRow, key)) {
        mergedRow[key] = defaultValue
      }
    }
    next[roleGuid] = mergedRow
  }
  return next
}

/** Drop module.nav.* keys that are not in the current catalog (e.g. removed Delete on Dashboard). */
export function stripNavModuleKeysOutsideCatalog(matrix, navModulePermissions) {
  if (!matrix || typeof matrix !== "object") return matrix

  const allowed = new Set(
    (navModulePermissions ?? [])
      .map((perm) => perm?.key)
      .filter((key) => key && isNavModulePermissionKey(key) && !isLegacyCoarseNavModuleKey(key)),
  )

  const next = {}
  for (const [roleGuid, row] of Object.entries(matrix)) {
    const cleaned = {}
    for (const [key, value] of Object.entries(row ?? {})) {
      if (isLegacyCoarseNavModuleKey(key)) continue
      if (isNavModulePermissionKey(key)) {
        if (allowed.has(key)) cleaned[key] = value
        continue
      }
      cleaned[key] = value
    }
    next[roleGuid] = cleaned
  }
  return next
}

/** Sparse matrix for save — only `true` keys are persisted; missing keys resolve to false at runtime. */
export function compactStudyMatrixSavePayload(matrix) {
  if (!matrix || typeof matrix !== "object") return {}

  const next = {}
  for (const [roleGuid, row] of Object.entries(matrix)) {
    const compact = {}
    for (const [key, value] of Object.entries(row ?? {})) {
      if (value === true) compact[key] = true
    }
    if (Object.keys(compact).length > 0) {
      next[roleGuid] = compact
    }
  }
  return next
}

/** Normalize matrix before SaveRolePermissionMatrix — scope roles, strip unknown/legacy keys, compact to allowed-only. */
export function prepareStudyMatrixSavePayload(matrix, navModulePermissions, matrixRoles) {
  const scoped = pickMatrixForRoles(matrix, matrixRoles)
  const stripped = stripNavModuleKeysOutsideCatalog(scoped, navModulePermissions)
  return compactStudyMatrixSavePayload(stripped)
}
