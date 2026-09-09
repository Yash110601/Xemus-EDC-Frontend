import { getStudyNavCatalogFallback } from "@/lib/navigation/studyNavCatalogFallback"
import { PLATFORM_PREVIEW_ENABLED } from "@/lib/platform/platformUi"

/** Top-level sidebar features injected when preview is on (each has its own API). */
const PREVIEW_FEATURE_CODES = ["PLATFORM", "SAFETY"]

function featureCode(item) {
  return String(item?.code ?? item?.Code ?? "")
    .trim()
    .toUpperCase()
}

/** Inject enterprise modules as separate sidebar items — zero impact when preview flag is off. */
export function ensurePlatformFeatureInMenu(menu) {
  if (!PLATFORM_PREVIEW_ENABLED || !Array.isArray(menu)) return menu

  const catalog = getStudyNavCatalogFallback()
  const existing = new Set(menu.map(featureCode))

  const toInject = PREVIEW_FEATURE_CODES.map((code) =>
    catalog.find((feature) => featureCode(feature) === code),
  )
    .filter(Boolean)
    .filter((feature) => !existing.has(featureCode(feature)))
    .map((feature) => ({
      ...feature,
      canView: true,
      subFeatures: (feature.subFeatures ?? []).map((sf) => ({ ...sf, canView: true })),
    }))

  if (!toInject.length) return menu
  return [...menu, ...toInject]
}

export function isPlatformMenuItem(item) {
  const code = featureCode(item)
  if (PREVIEW_FEATURE_CODES.includes(code) || code.startsWith("PLATFORM_")) return true
  if (code.startsWith("SAFETY_")) {
    return true
  }
  const route = String(item?.route ?? item?.Route ?? "")
  return route.startsWith("/platform")
}
