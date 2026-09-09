import { normalizeMenuPermissions } from "@/lib/utils/menuRoutePermissions"
import { resolveReportDefinition } from "@/lib/reports/reportRegistry"
import { logReportPermission } from "@/lib/reports/reportPermissionDebug"

const normalizePath = (value) => {
  const path = (value || "").toString().trim().toLowerCase()
  if (!path) return ""
  return path.startsWith("/") ? path : `/${path}`
}

const EXPORT_KEYS = ["canExport", "isExport", "isCanExport", "canDownload", "isDownload"]
const VIEW_KEYS = ["canView", "isView", "isCanView"]

export const REPORT_EXPORT_DENIED_MESSAGE =
  "You do not have permission to export this report."

function readAnyTrue(node, keys) {
  if (!node || typeof node !== "object") return false
  return keys.some((k) => node[k] === true)
}

/**
 * @typedef {Object} ReportMenuPermissionsResult
 * @property {boolean} canView
 * @property {boolean} canExport
 * @property {'menu-match'|'empty-menu-fallback'|'no-menu-match'} source
 * @property {{ code?: string, route?: string, name?: string } | null} matchedSubFeature
 * @property {string | null} reportKey
 */

/**
 * Resolve View/Export for a report sub-feature from login menu.
 * Matches menu sub-feature by pathname and/or registry code.
 *
 * @param {unknown} menu
 * @param {string} pathname
 * @param {string} [subFeatureCode] - Registry / menu code (e.g. SDV_REPORT)
 * @returns {ReportMenuPermissionsResult}
 */
export function resolveReportMenuPermissions(menu, pathname, subFeatureCode) {
  const reportDef = resolveReportDefinition(pathname, subFeatureCode)
  const effectiveCode = subFeatureCode || reportDef?.code || ""
  const menuItems = normalizeMenuPermissions(menu)

  if (!menuItems.length) {
    const result = {
      canView: true,
      canExport: true,
      source: "empty-menu-fallback",
      matchedSubFeature: null,
      reportKey: reportDef?.key || null,
    }
    logReportPermission("resolve:fallback-empty-menu", { pathname, reportKey: result.reportKey, result })
    return result
  }

  const currentPath = normalizePath(pathname)
  const codeUpper = effectiveCode ? String(effectiveCode).trim().toUpperCase() : ""

  let best = null
  for (const feature of menuItems) {
    const subs = feature?.subFeatures
    if (!Array.isArray(subs)) continue
    for (const sf of subs) {
      const subRoute = normalizePath(sf?.route)
      const sfCode = String(sf?.code || "").trim().toUpperCase()
      const routeMatch =
        subRoute &&
        (currentPath === subRoute ||
          currentPath.startsWith(`${subRoute}/`) ||
          subRoute.startsWith(`${currentPath}/`))
      const codeMatch = Boolean(codeUpper && sfCode === codeUpper)
      if (!routeMatch && !codeMatch) continue

      const priority = codeMatch && routeMatch ? 3 : routeMatch ? 2 : 1
      const routeLen = subRoute.length
      if (
        !best ||
        priority > best.priority ||
        (priority === best.priority && routeLen > best.routeLen)
      ) {
        best = { node: sf, priority, routeLen }
      }
    }
  }

  if (!best) {
    const result = {
      canView: false,
      canExport: false,
      source: "no-menu-match",
      matchedSubFeature: null,
      reportKey: reportDef?.key || null,
    }
    logReportPermission("resolve:no-match", {
      pathname,
      effectiveCode: codeUpper || null,
      reportKey: result.reportKey,
      result,
    })
    return result
  }

  const matchedSubFeature = {
    code: best.node?.code,
    route: best.node?.route,
    name: best.node?.name,
  }

  const result = {
    canView: readAnyTrue(best.node, VIEW_KEYS),
    canExport: readAnyTrue(best.node, EXPORT_KEYS),
    source: "menu-match",
    matchedSubFeature,
    reportKey: reportDef?.key || null,
  }

  logReportPermission("resolve:menu-match", {
    pathname,
    effectiveCode: codeUpper || null,
    matchedSubFeature,
    flags: {
      canView: result.canView,
      canExport: result.canExport,
    },
  })

  return result
}

/**
 * @param {ReportMenuPermissionsResult} permissions
 * @param {{ pathname?: string, action?: string }} [context]
 */
export function logExportDenied(permissions, context = {}) {
  logReportPermission("export:denied", {
    ...context,
    reportKey: permissions.reportKey,
    matchedSubFeature: permissions.matchedSubFeature,
    source: permissions.source,
  })
}
