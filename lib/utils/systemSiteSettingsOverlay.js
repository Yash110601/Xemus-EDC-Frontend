/**
 * Frontend overlay for system-site study settings until the .NET API persists and returns
 * isSystemSiteCreationEnabled / systemSiteCount / etc.
 */

const OVERLAY_PREFIX = "systemSiteSettingsOverlay_v1_"
const OVERLAY_LOCAL_PREFIX = "systemSiteSettingsOverlay_local_v1_"

const OVERLAY_FIELDS = [
  "isSystemSiteCreationEnabled",
  "isSystemSiteNamingCustomizable",
  "systemSiteNamePrefix",
  "systemSiteCount",
]

export function persistSystemSiteSettingsOverlay(studyId, fields = {}) {
  if (typeof window === "undefined") return
  const key = String(studyId ?? "").trim()
  if (!key) return

  try {
    const payload = {
      ts: Date.now(),
      isSystemSiteCreationEnabled: Boolean(fields.isSystemSiteCreationEnabled),
      isSystemSiteNamingCustomizable: Boolean(fields.isSystemSiteNamingCustomizable),
      systemSiteNamePrefix: String(fields.systemSiteNamePrefix ?? "s-").trim() || "s-",
      systemSiteCount: Math.max(
        0,
        Number.parseInt(String(fields.systemSiteCount ?? ""), 10) || 0,
      ),
    }
    const serialized = JSON.stringify(payload)
    sessionStorage.setItem(`${OVERLAY_PREFIX}${key}`, serialized)
    localStorage.setItem(`${OVERLAY_LOCAL_PREFIX}${key}`, serialized)
  } catch {
    /* quota or private mode */
  }
}

export function readSystemSiteSettingsOverlay(studyId) {
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

export function clearSystemSiteSettingsOverlay(studyId) {
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

/** Merge session overlay only when user enabled system sites in Study Settings this session. */
export function mergeSystemSiteSettingsOverlay(studyId, apiData) {
  if (!apiData || typeof apiData !== "object") return apiData

  const overlay = readSystemSiteSettingsOverlay(studyId)
  if (!overlay) return apiData

  if (!overlay.isSystemSiteCreationEnabled) {
    return {
      ...apiData,
      isSystemSiteCreationEnabled: false,
      isSystemSiteNamingCustomizable: false,
      systemSiteCount: 0,
      systemSiteNamePrefix:
        String(apiData.systemSiteNamePrefix ?? apiData.SystemSiteNamePrefix ?? "s-").trim() || "s-",
    }
  }

  return {
    ...apiData,
    isSystemSiteCreationEnabled: true,
    isSystemSiteNamingCustomizable: Boolean(overlay.isSystemSiteNamingCustomizable),
    systemSiteNamePrefix: overlay.systemSiteNamePrefix || "s-",
    systemSiteCount: Number.parseInt(String(overlay.systemSiteCount ?? ""), 10) || 0,
  }
}

function apiExplicitlyEnablesSystemSites(payload) {
  if (!payload || typeof payload !== "object") return false
  return (
    payload.isSystemSiteCreationEnabled === true ||
    payload.IsSystemSiteCreationEnabled === true ||
    payload.studySetting?.isSystemSiteCreationEnabled === true ||
    payload.studySetting?.IsSystemSiteCreationEnabled === true
  )
}

/**
 * Resolves system-site mode for User Creation / import.
 * Priority: session overlay (Study Settings save) → API explicit true → off.
 */
export function resolveSystemSiteModeForStudy(studyId, apiPayload = {}) {
  const overlay = readSystemSiteSettingsOverlay(studyId)

  if (overlay && overlay.isSystemSiteCreationEnabled === false) {
    return {
      enabled: false,
      autoAssign: false,
      namingCustomizable: false,
      prefix: "s-",
      siteCount: 0,
    }
  }

  if (overlay?.isSystemSiteCreationEnabled === true) {
    return {
      enabled: true,
      autoAssign: !Boolean(overlay.isSystemSiteNamingCustomizable),
      namingCustomizable: Boolean(overlay.isSystemSiteNamingCustomizable),
      prefix: String(overlay.systemSiteNamePrefix || "s-").trim() || "s-",
      siteCount: Math.max(0, Number.parseInt(String(overlay.systemSiteCount ?? ""), 10) || 0),
    }
  }

  if (apiExplicitlyEnablesSystemSites(apiPayload)) {
    const namingCustomizable = Boolean(
      apiPayload.isSystemSiteNamingCustomizable ??
        apiPayload.IsSystemSiteNamingCustomizable ??
        apiPayload.studySetting?.isSystemSiteNamingCustomizable ??
        apiPayload.studySetting?.IsSystemSiteNamingCustomizable,
    )
    const prefix =
      String(
        apiPayload.systemSiteNamePrefix ??
          apiPayload.SystemSiteNamePrefix ??
          apiPayload.studySetting?.systemSiteNamePrefix ??
          apiPayload.studySetting?.SystemSiteNamePrefix ??
          "s-",
      ).trim() || "s-"
    const count = Number.parseInt(
      String(
        apiPayload.systemSiteCount ??
          apiPayload.SystemSiteCount ??
          apiPayload.studySetting?.systemSiteCount ??
          apiPayload.studySetting?.SystemSiteCount ??
          "",
      ),
      10,
    )
    return {
      enabled: true,
      autoAssign: !namingCustomizable,
      namingCustomizable,
      prefix,
      siteCount: Number.isFinite(count) && count > 0 ? count : 0,
    }
  }

  return {
    enabled: false,
    autoAssign: false,
    namingCustomizable: false,
    prefix: "s-",
    siteCount: 0,
  }
}

export function overlayTouchesSystemSiteFields(payload) {
  if (!payload || typeof payload !== "object") return false
  return OVERLAY_FIELDS.some((field) => payload[field] !== undefined)
}
