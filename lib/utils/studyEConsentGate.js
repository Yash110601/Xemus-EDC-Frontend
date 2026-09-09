/**
 * Per-study eCONSENT feature gate (Study Settings: isEConsentRequired).
 */

import {
  fetchStudySettingsByStudyId,
  getCachedStudySettings,
  clearStudySettingsCache,
  pickIsEConsentRequired,
} from "@/lib/utils/studySettingsRead"

export {
  toStudySettingBool,
  pickIsEConsentRequired,
  clearStudySettingsCache,
} from "@/lib/utils/studySettingsRead"

/** @deprecated use clearStudySettingsCache */
export const clearStudyEConsentSettingsCache = clearStudySettingsCache

/**
 * Returns whether eCONSENT is required/enabled for the study.
 * Uses shared settings cache — no duplicate API when already loaded.
 */
export async function fetchIsEConsentRequiredForStudy(studyId, { forceRefresh = false } = {}) {
  const numericId = Number.parseInt(String(studyId), 10)
  if (!Number.isFinite(numericId) || numericId <= 0) return false

  try {
    if (!forceRefresh) {
      const cached = getCachedStudySettings(numericId)
      if (cached?.isSuccess && cached.data != null) {
        return pickIsEConsentRequired(cached.data)
      }
    }

    const res = await fetchStudySettingsByStudyId(numericId, { forceRefresh })
    if (res?.isSuccess && res.data != null) {
      return pickIsEConsentRequired(res.data)
    }
  } catch (error) {
    console.warn("[studyEConsentGate] fetch failed", error)
  }
  return false
}

/** Top-level ECONSENT feature or any econsent route/subfeature (incl. legacy STUDY_ECONSENT). */
export function isEConsentMenuItem(item) {
  const route = String(item?.route || item?.href || "").toLowerCase()
  const code = String(item?.code || item?.navCode || "").toUpperCase()
  const name = String(item?.name || "").toLowerCase()
  return (
    code === "ECONSENT" ||
    code.startsWith("ECONSENT_") ||
    code === "STUDY_ECONSENT" ||
    route.includes("/econsent") ||
    route.includes("econsent") ||
    name.includes("econsent") ||
    name.includes("e-consent")
  )
}
