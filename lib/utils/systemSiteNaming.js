/**
 * System-generated site codes for studies with auto site creation enabled.
 * Pad width = digit count of siteCount (10 → 01–10, 100 → 001–100).
 */

export const DEFAULT_SYSTEM_SITE_PREFIX = "s-"

export function getSystemSitePadWidth(siteCount) {
  const n = Math.max(1, Number.parseInt(String(siteCount ?? ""), 10) || 1)
  return String(n).length
}

export function formatSystemSiteCode(indexOneBased, siteCount, prefix = DEFAULT_SYSTEM_SITE_PREFIX) {
  const count = Math.max(1, Number.parseInt(String(siteCount ?? ""), 10) || 1)
  const index = Math.max(1, Number.parseInt(String(indexOneBased ?? ""), 10) || 1)
  const safePrefix = String(prefix ?? DEFAULT_SYSTEM_SITE_PREFIX)
  const padWidth = getSystemSitePadWidth(count)
  return `${safePrefix}${String(index).padStart(padWidth, "0")}`
}

/** Preview labels for study settings UI (first, middle dot, last). */
export function previewSystemSiteCodes(siteCount, prefix = DEFAULT_SYSTEM_SITE_PREFIX) {
  const count = Math.max(0, Number.parseInt(String(siteCount ?? ""), 10) || 0)
  if (count <= 0) return []
  if (count === 1) return [formatSystemSiteCode(1, count, prefix)]
  if (count === 2) {
    return [formatSystemSiteCode(1, count, prefix), formatSystemSiteCode(2, count, prefix)]
  }
  const mid = Math.ceil(count / 2)
  return [
    formatSystemSiteCode(1, count, prefix),
    formatSystemSiteCode(mid, count, prefix),
    formatSystemSiteCode(count, count, prefix),
  ]
}
