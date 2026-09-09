/**
 * Per-study agreement feature gate (Study Settings: isAgreementEnabled).
 */

import {
  fetchStudySettingsByStudyId,
  getCachedStudySettings,
  clearStudySettingsCache,
  pickIsAgreementEnabledFromStudiesList,
  resolveIsAgreementEnabled,
} from "@/lib/utils/studySettingsRead"

export {
  toStudySettingBool,
  pickIsAgreementEnabled,
  resolveIsAgreementEnabled,
  clearStudySettingsCache,
} from "@/lib/utils/studySettingsRead"

/** @deprecated use clearStudySettingsCache */
export const clearStudyAgreementSettingsCache = clearStudySettingsCache

/**
 * Returns whether agreement workflows are enabled for the study.
 * Uses shared settings cache — no duplicate API when already loaded.
 */
export async function fetchIsAgreementEnabledForStudy(studyId, { forceRefresh = false } = {}) {
  const numericId = Number.parseInt(String(studyId), 10)
  if (!Number.isFinite(numericId) || numericId <= 0) return false

  try {
    if (!forceRefresh) {
      const cached = getCachedStudySettings(numericId)
      if (cached?.isSuccess) {
        const resolved = resolveIsAgreementEnabled(numericId, cached.data ?? null)
        if (resolved !== null) return resolved
      }
    }

    const res = await fetchStudySettingsByStudyId(numericId, { forceRefresh })
    if (res?.isSuccess) {
      const resolved = resolveIsAgreementEnabled(numericId, res.data ?? null)
      if (resolved !== null) return resolved
    }
  } catch (error) {
    console.warn("[studyAgreementGate] fetch failed", error)
  }
  const fromList = pickIsAgreementEnabledFromStudiesList(numericId)
  return fromList ?? false
}

/** Menu / route items tied to agreement setup or agreement reports. */
export function isAgreementMenuItem(item) {
  const route = String(item?.route || item?.href || "").toLowerCase()
  const code = String(item?.code || "").toLowerCase()
  const name = String(item?.name || "").toLowerCase()
  return (
    route.includes("agreement") ||
    code.includes("agreement") ||
    name.includes("agreement")
  )
}
