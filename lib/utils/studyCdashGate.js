/**
 * Per-study CDASH feature gate (Study Settings: isCdashEnabled).
 * Separate from external integration / agreement — do not mix stores.
 */

import {
  fetchStudySettingsByStudyId,
  getCachedStudySettings,
  pickIsCdashEnabled,
  resolveIsCdashEnabled,
} from "@/lib/utils/studySettingsRead"

export { pickIsCdashEnabled, resolveIsCdashEnabled } from "@/lib/utils/studySettingsRead"

export async function fetchIsCdashEnabledForStudy(studyId, { forceRefresh = false } = {}) {
  const numericId = Number.parseInt(String(studyId), 10)
  if (!Number.isFinite(numericId) || numericId <= 0) return false

  try {
    if (!forceRefresh) {
      const cached = getCachedStudySettings(numericId)
      if (cached?.isSuccess && cached.data != null) {
        return pickIsCdashEnabled(cached.data)
      }
    }
    const res = await fetchStudySettingsByStudyId(numericId, { forceRefresh })
    if (res?.isSuccess && res.data != null) {
      return pickIsCdashEnabled(res.data)
    }
  } catch (error) {
    console.warn("[studyCdashGate] fetch failed", error)
  }
  return false
}

/** Menu / route items for CDASH export or mapping. */
export function isCdashMenuItem(item) {
  const route = String(item?.route || item?.href || "").toLowerCase()
  const code = String(item?.code || "").toLowerCase()
  const name = String(item?.name || "").toLowerCase()
  return route.includes("cdash") || code.includes("cdash") || name.includes("cdash")
}
