/**
 * Frontend overlay for study document library settings until API returns
 * isStudyDocumentsEnabled / demoVideoUrl on GET.
 */

const OVERLAY_PREFIX = "studyDocumentsSettingsOverlay_v1_"
const OVERLAY_LOCAL_PREFIX = "studyDocumentsSettingsOverlay_local_v1_"

export function persistStudyDocumentsSettingsOverlay(studyId, fields = {}) {
  if (typeof window === "undefined") return
  const key = String(studyId ?? "").trim()
  if (!key) return

  try {
    const payload = {
      ts: Date.now(),
      isStudyDocumentsEnabled: Boolean(fields.isStudyDocumentsEnabled),
      demoVideoUrl: String(fields.demoVideoUrl ?? "").trim(),
    }
    const serialized = JSON.stringify(payload)
    sessionStorage.setItem(`${OVERLAY_PREFIX}${key}`, serialized)
    localStorage.setItem(`${OVERLAY_LOCAL_PREFIX}${key}`, serialized)
  } catch {
    /* quota or private mode */
  }
}

export function readStudyDocumentsSettingsOverlay(studyId) {
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

export function clearStudyDocumentsSettingsOverlay(studyId) {
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

export function mergeStudyDocumentsSettingsOverlay(studyId, apiData) {
  if (!apiData || typeof apiData !== "object") return apiData

  const apiDefinesStudyDocuments =
    apiData.isStudyDocumentsEnabled !== undefined ||
    apiData.IsStudyDocumentsEnabled !== undefined

  if (apiDefinesStudyDocuments) {
    clearStudyDocumentsSettingsOverlay(studyId)
    return apiData
  }

  const overlay = readStudyDocumentsSettingsOverlay(studyId)
  if (!overlay) return apiData

  return {
    ...apiData,
    isStudyDocumentsEnabled: overlay.isStudyDocumentsEnabled,
    demoVideoUrl: overlay.demoVideoUrl ?? "",
  }
}

export function isValidYouTubeUrl(url) {
  const trimmed = String(url ?? "").trim()
  if (!trimmed) return true
  try {
    const parsed = new URL(trimmed)
    const host = parsed.hostname.toLowerCase()
    return host === "www.youtube.com" || host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be"
  } catch {
    return false
  }
}
