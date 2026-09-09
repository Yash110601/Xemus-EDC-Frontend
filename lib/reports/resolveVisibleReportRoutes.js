import { getStudyNavCatalogFallback } from "@/lib/navigation/studyNavCatalogFallback"
import { filterNavItemsByStudyMatrix } from "@/lib/utils/studyNavPermissions"
import { hasMenuViewPermission } from "@/lib/utils/menuRoutePermissions"

function toSlug(str) {
  if (!str || typeof str !== "string") return ""
  return str
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function resolveSubHref(feature, sub) {
  const featureHref = sub?.route || feature?.route || "/reports"
  if (sub?.route) return sub.route
  const featureBase = feature?.route || "/reports"
  return `${featureBase}/${toSlug(sub?.code || sub?.name || "")}`
}

function findReportsFeature(menu) {
  if (!Array.isArray(menu)) return null
  return (
    menu.find(
      (feature) =>
        String(feature?.code ?? feature?.Code ?? "")
          .trim()
          .toUpperCase() === "REPORTS" ||
        String(feature?.route ?? "").trim().toLowerCase() === "/reports",
    ) ?? null
  )
}

function mapReportNavItems(reportsFeature) {
  const featureHref = reportsFeature?.route || "/reports"
  const subs = reportsFeature?.subFeatures ?? reportsFeature?.SubFeatures ?? []
  return subs
    .map((sub) => ({
      name: sub?.name ?? sub?.Name ?? "",
      href: resolveSubHref(reportsFeature, sub),
      navCode: sub?.code ?? sub?.Code ?? "",
      subItems: [],
      displayOrder: sub?.displayOrder ?? sub?.DisplayOrder ?? 0,
    }))
    .sort(
      (a, b) =>
        (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name),
    )
}

/**
 * Report routes visible for the current user (study matrix or global login menu).
 */
export function resolveVisibleReportRoutes({
  loginMenu,
  matrixActive = false,
  can,
  permissions = null,
} = {}) {
  const catalog = getStudyNavCatalogFallback()
  const reportsFeature =
    findReportsFeature(catalog?.length ? catalog : loginMenu) ?? findReportsFeature(loginMenu)

  if (!reportsFeature) return []

  let items = mapReportNavItems(reportsFeature)

  if (matrixActive && typeof can === "function") {
    items = filterNavItemsByStudyMatrix(items, can, { matrixActive: true, permissions })
  } else {
    items = items.filter((item) => {
      const sub = (reportsFeature?.subFeatures ?? reportsFeature?.SubFeatures ?? []).find(
        (sf) =>
          String(sf?.code ?? sf?.Code ?? "")
            .trim()
            .toUpperCase() ===
          String(item.navCode ?? "")
            .trim()
            .toUpperCase(),
      )
      return sub ? hasMenuViewPermission(sub) : true
    })
  }

  return items.filter((item) => item?.href)
}
