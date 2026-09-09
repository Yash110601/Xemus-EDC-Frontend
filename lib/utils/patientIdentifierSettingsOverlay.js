/**
 * Frontend overlay for patient-identifier study settings until the .NET API persists
 * screening number / SUBJID configuration fields.
 */

const OVERLAY_PREFIX = "patientIdentifierSettingsOverlay_v1_"
const OVERLAY_LOCAL_PREFIX = "patientIdentifierSettingsOverlay_local_v1_"

export const DEFAULT_SCREENING_NUMBER_MASK = "S-{SITE}-{SEQ:3}"

const OVERLAY_FIELDS = [
  "isScreeningNumberEnabled",
  "isScreeningNumberMaskCustomizable",
  "screeningNumberMask",
  "isRandomizationNumberEnabled",
]

export function persistPatientIdentifierSettingsOverlay(studyId, fields = {}) {
  if (typeof window === "undefined") return
  const key = String(studyId ?? "").trim()
  if (!key) return

  try {
    const payload = {
      ts: Date.now(),
      isScreeningNumberEnabled: Boolean(fields.isScreeningNumberEnabled),
      isScreeningNumberMaskCustomizable: Boolean(fields.isScreeningNumberMaskCustomizable),
      screeningNumberMask:
        String(fields.screeningNumberMask ?? DEFAULT_SCREENING_NUMBER_MASK).trim() ||
        DEFAULT_SCREENING_NUMBER_MASK,
      isRandomizationNumberEnabled: Boolean(fields.isRandomizationNumberEnabled),
    }
    const serialized = JSON.stringify(payload)
    sessionStorage.setItem(`${OVERLAY_PREFIX}${key}`, serialized)
    localStorage.setItem(`${OVERLAY_LOCAL_PREFIX}${key}`, serialized)
  } catch {
    /* quota or private mode */
  }
}

export function readPatientIdentifierSettingsOverlay(studyId) {
  if (typeof window === "undefined") return null
  const key = String(studyId ?? "").trim()
  if (!key) return null

  try {
    const raw =
      sessionStorage.getItem(`${OVERLAY_PREFIX}${key}`) ??
      localStorage.getItem(`${OVERLAY_LOCAL_PREFIX}${key}`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return null
    return parsed
  } catch {
    return null
  }
}

export function clearPatientIdentifierSettingsOverlay(studyId) {
  if (typeof window === "undefined") return
  const key = String(studyId ?? "").trim()
  if (!key) return
  try {
    sessionStorage.removeItem(`${OVERLAY_PREFIX}${key}`)
    localStorage.removeItem(`${OVERLAY_LOCAL_PREFIX}${key}`)
  } catch {
    /* ignore */
  }
}

export function mergePatientIdentifierSettingsOverlay(studyId, apiData) {
  if (!apiData || typeof apiData !== "object") return apiData

  const apiDefinesPatientIdentifiers =
    apiData.isScreeningNumberEnabled !== undefined ||
    apiData.IsScreeningNumberEnabled !== undefined

  if (apiDefinesPatientIdentifiers) return apiData

  const overlay = readPatientIdentifierSettingsOverlay(studyId)
  if (!overlay) return apiData

  if (!overlay.isScreeningNumberEnabled) {
    return {
      ...apiData,
      isScreeningNumberEnabled: false,
      isScreeningNumberMaskCustomizable: false,
      screeningNumberMask:
        String(apiData.screeningNumberMask ?? apiData.ScreeningNumberMask ?? DEFAULT_SCREENING_NUMBER_MASK).trim() ||
        DEFAULT_SCREENING_NUMBER_MASK,
      isRandomizationNumberEnabled: false,
    }
  }

  return {
    ...apiData,
    isScreeningNumberEnabled: true,
    isScreeningNumberMaskCustomizable: Boolean(overlay.isScreeningNumberMaskCustomizable),
    screeningNumberMask: overlay.screeningNumberMask || DEFAULT_SCREENING_NUMBER_MASK,
    isRandomizationNumberEnabled: Boolean(overlay.isRandomizationNumberEnabled),
  }
}

function apiExplicitlyEnablesScreeningNumber(payload) {
  if (!payload || typeof payload !== "object") return false
  return (
    payload.isScreeningNumberEnabled === true ||
    payload.IsScreeningNumberEnabled === true ||
    payload.studySetting?.isScreeningNumberEnabled === true ||
    payload.studySetting?.IsScreeningNumberEnabled === true
  )
}

/**
 * Resolves patient identifier mode for enrolment / eCRF.
 * When disabled, callers must keep legacy behaviour (PID-{id}, manual flow).
 */
export function resolvePatientIdentifierModeForStudy(studyId, apiPayload = {}) {
  const overlay = readPatientIdentifierSettingsOverlay(studyId)

  if (overlay && overlay.isScreeningNumberEnabled === false) {
    return {
      screeningEnabled: false,
      maskCustomizable: false,
      screeningNumberMask: DEFAULT_SCREENING_NUMBER_MASK,
      randomizationNumberEnabled: false,
    }
  }

  if (overlay?.isScreeningNumberEnabled === true) {
    return {
      screeningEnabled: true,
      maskCustomizable: Boolean(overlay.isScreeningNumberMaskCustomizable),
      screeningNumberMask: overlay.screeningNumberMask || DEFAULT_SCREENING_NUMBER_MASK,
      randomizationNumberEnabled: Boolean(overlay.isRandomizationNumberEnabled),
    }
  }

  if (apiExplicitlyEnablesScreeningNumber(apiPayload)) {
    const maskCustomizable = Boolean(
      apiPayload.isScreeningNumberMaskCustomizable ??
        apiPayload.IsScreeningNumberMaskCustomizable ??
        apiPayload.studySetting?.isScreeningNumberMaskCustomizable ??
        apiPayload.studySetting?.IsScreeningNumberMaskCustomizable,
    )
    const mask =
      String(
        apiPayload.screeningNumberMask ??
          apiPayload.ScreeningNumberMask ??
          apiPayload.studySetting?.screeningNumberMask ??
          apiPayload.studySetting?.ScreeningNumberMask ??
          DEFAULT_SCREENING_NUMBER_MASK,
      ).trim() || DEFAULT_SCREENING_NUMBER_MASK
    const randomizationNumberEnabled = Boolean(
      apiPayload.isRandomizationNumberEnabled ??
        apiPayload.IsRandomizationNumberEnabled ??
        apiPayload.studySetting?.isRandomizationNumberEnabled ??
        apiPayload.studySetting?.IsRandomizationNumberEnabled,
    )
    return {
      screeningEnabled: true,
      maskCustomizable,
      screeningNumberMask: mask,
      randomizationNumberEnabled,
    }
  }

  return {
    screeningEnabled: false,
    maskCustomizable: false,
    screeningNumberMask: DEFAULT_SCREENING_NUMBER_MASK,
    randomizationNumberEnabled: false,
  }
}

export function overlayTouchesPatientIdentifierFields(payload) {
  if (!payload || typeof payload !== "object") return false
  return OVERLAY_FIELDS.some((field) => payload[field] !== undefined)
}
