function parseCsv(raw) {
  return String(raw || "")
    .split(",")
    .map((v) => String(v || "").trim())
    .filter(Boolean)
}

/**
 * Read rollout flags from localStorage with optional form/study targeting.
 */
export function readRuleRuntimeRolloutConfig() {
  if (typeof window === "undefined") {
    return {
      shadowEnabled: false,
      pilotEnabled: false,
      primaryEnabled: false,
      applyValuesEnabled: false,
      compareModeEnabled: false,
      autoFallbackOnCompareFail: false,
      allowedFormIds: [],
      allowedStudyIds: [],
      primaryFormIds: [],
      primaryStudyIds: [],
      mismatchWarnThreshold: 0,
      mismatchSampleRate: 0.1,
    }
  }

  const shadowEnabled = window.localStorage?.getItem("crfRuleRuntimeShadow") === "1"
  const pilotEnabled = window.localStorage?.getItem("crfRuleRuntimePilot") === "1"
  const primaryEnabled = window.localStorage?.getItem("crfRuleRuntimePrimary") === "1"
  const applyValuesEnabled = window.localStorage?.getItem("crfRuleRuntimePilotApplyValues") === "1"
  const compareModeEnabled = window.localStorage?.getItem("crfRuleRuntimeCompareMode") === "1"
  const autoFallbackOnCompareFail = window.localStorage?.getItem("crfRuleRuntimeAutoFallbackOnFail") === "1"
  const allowedFormIds = parseCsv(window.localStorage?.getItem("crfRuleRuntimePilotFormIds"))
  const allowedStudyIds = parseCsv(window.localStorage?.getItem("crfRuleRuntimePilotStudyIds"))
  const primaryFormIds = parseCsv(window.localStorage?.getItem("crfRuleRuntimePrimaryFormIds"))
  const primaryStudyIds = parseCsv(window.localStorage?.getItem("crfRuleRuntimePrimaryStudyIds"))
  const mismatchWarnThresholdRaw = Number(window.localStorage?.getItem("crfRuleRuntimeMismatchWarnThreshold"))
  const mismatchWarnThreshold =
    Number.isFinite(mismatchWarnThresholdRaw) && mismatchWarnThresholdRaw > 0
      ? mismatchWarnThresholdRaw
      : 0
  const mismatchSampleRateRaw = Number(window.localStorage?.getItem("crfRuleRuntimeMismatchSampleRate"))
  const mismatchSampleRate =
    Number.isFinite(mismatchSampleRateRaw) && mismatchSampleRateRaw >= 0 && mismatchSampleRateRaw <= 1
      ? mismatchSampleRateRaw
      : 0.1

  return {
    shadowEnabled,
    pilotEnabled,
    primaryEnabled,
    applyValuesEnabled,
    compareModeEnabled,
    autoFallbackOnCompareFail,
    allowedFormIds,
    allowedStudyIds,
    primaryFormIds,
    primaryStudyIds,
    mismatchWarnThreshold,
    mismatchSampleRate,
  }
}

export function isRuleRuntimePilotAllowed(config, { formId = "", studyId = "" } = {}) {
  if (!config?.pilotEnabled) return false
  const normalizedFormId = String(formId || "").trim()
  const normalizedStudyId = String(studyId || "").trim()

  const formAllowed =
    !Array.isArray(config.allowedFormIds) ||
    config.allowedFormIds.length === 0 ||
    config.allowedFormIds.includes(normalizedFormId)
  const studyAllowed =
    !Array.isArray(config.allowedStudyIds) ||
    config.allowedStudyIds.length === 0 ||
    config.allowedStudyIds.includes(normalizedStudyId)

  return formAllowed && studyAllowed
}

export function isRuleRuntimePrimaryAllowed(config, { formId = "", studyId = "" } = {}) {
  if (!config?.primaryEnabled) return false
  const normalizedFormId = String(formId || "").trim()
  const normalizedStudyId = String(studyId || "").trim()

  const formAllowed =
    !Array.isArray(config.primaryFormIds) ||
    config.primaryFormIds.length === 0 ||
    config.primaryFormIds.includes(normalizedFormId)
  const studyAllowed =
    !Array.isArray(config.primaryStudyIds) ||
    config.primaryStudyIds.length === 0 ||
    config.primaryStudyIds.includes(normalizedStudyId)

  return formAllowed && studyAllowed
}
