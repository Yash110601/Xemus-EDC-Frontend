const MODE_KEYS = [
  "crfRuleRuntimeShadow",
  "crfRuleRuntimePilot",
  "crfRuleRuntimePrimary",
  "crfRuleRuntimePilotApplyValues",
  "crfRuleRuntimeCompareMode",
  "crfRuleRuntimeAutoFallbackOnFail",
  "crfRuleRuntimePilotFormIds",
  "crfRuleRuntimePilotStudyIds",
  "crfRuleRuntimePrimaryFormIds",
  "crfRuleRuntimePrimaryStudyIds",
  "crfRuleRuntimeMismatchWarnThreshold",
  "crfRuleRuntimeMismatchSampleRate",
]

function setIfDefined(storage, key, value) {
  if (value === undefined || value === null || value === "") {
    storage.removeItem(key)
    return
  }
  storage.setItem(key, String(value))
}

/**
 * Apply one of the standard runtime modes.
 * Modes:
 * - off: disable all runtime modes
 * - shadow: compare only (no patch apply)
 * - pilot: apply runtime patches in gated scope
 * - primary: runtime-first in gated scope with compare fallback
 */
export function setRuleRuntimeMode(mode = "off", options = {}) {
  if (typeof window === "undefined") return null
  const storage = window.localStorage
  const normalizedMode = String(mode || "off").trim().toLowerCase()

  MODE_KEYS.forEach((k) => storage.removeItem(k))

  if (normalizedMode === "off") {
    return getRuleRuntimeModeConfig()
  }

  const pilotFormIds = options.pilotFormIds || options.formIds || ""
  const pilotStudyIds = options.pilotStudyIds || options.studyIds || ""
  const primaryFormIds = options.primaryFormIds || options.formIds || ""
  const primaryStudyIds = options.primaryStudyIds || options.studyIds || ""
  const mismatchWarnThreshold =
    options.mismatchWarnThreshold != null ? options.mismatchWarnThreshold : 0
  const mismatchSampleRate =
    options.mismatchSampleRate != null ? options.mismatchSampleRate : 0.25

  if (normalizedMode === "shadow") {
    storage.setItem("crfRuleRuntimeShadow", "1")
    storage.setItem("crfRuleRuntimeCompareMode", "1")
    setIfDefined(storage, "crfRuleRuntimeMismatchWarnThreshold", mismatchWarnThreshold)
    setIfDefined(storage, "crfRuleRuntimeMismatchSampleRate", mismatchSampleRate)
    return getRuleRuntimeModeConfig()
  }

  if (normalizedMode === "pilot") {
    storage.setItem("crfRuleRuntimeShadow", "1")
    storage.setItem("crfRuleRuntimePilot", "1")
    storage.setItem("crfRuleRuntimeCompareMode", "1")
    storage.setItem("crfRuleRuntimeAutoFallbackOnFail", "1")
    if (options.applyValues === true) storage.setItem("crfRuleRuntimePilotApplyValues", "1")
    setIfDefined(storage, "crfRuleRuntimePilotFormIds", pilotFormIds)
    setIfDefined(storage, "crfRuleRuntimePilotStudyIds", pilotStudyIds)
    setIfDefined(storage, "crfRuleRuntimeMismatchWarnThreshold", mismatchWarnThreshold)
    setIfDefined(storage, "crfRuleRuntimeMismatchSampleRate", mismatchSampleRate)
    return getRuleRuntimeModeConfig()
  }

  if (normalizedMode === "primary") {
    storage.setItem("crfRuleRuntimeShadow", "1")
    storage.setItem("crfRuleRuntimePrimary", "1")
    storage.setItem("crfRuleRuntimeCompareMode", "1")
    storage.setItem("crfRuleRuntimeAutoFallbackOnFail", "1")
    if (options.applyValues !== false) storage.setItem("crfRuleRuntimePilotApplyValues", "1")
    setIfDefined(storage, "crfRuleRuntimePrimaryFormIds", primaryFormIds)
    setIfDefined(storage, "crfRuleRuntimePrimaryStudyIds", primaryStudyIds)
    setIfDefined(storage, "crfRuleRuntimeMismatchWarnThreshold", mismatchWarnThreshold)
    setIfDefined(storage, "crfRuleRuntimeMismatchSampleRate", mismatchSampleRate)
    return getRuleRuntimeModeConfig()
  }

  throw new Error(`Unknown runtime mode: ${mode}`)
}

export function clearRuleRuntimeMode() {
  if (typeof window === "undefined") return null
  const storage = window.localStorage
  MODE_KEYS.forEach((k) => storage.removeItem(k))
  return getRuleRuntimeModeConfig()
}

export function getRuleRuntimeModeConfig() {
  if (typeof window === "undefined") return {}
  const storage = window.localStorage
  const snapshot = {}
  MODE_KEYS.forEach((k) => {
    const v = storage.getItem(k)
    if (v != null) snapshot[k] = v
  })
  return snapshot
}
