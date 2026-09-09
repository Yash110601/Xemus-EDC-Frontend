/**
 * Per-control AI entry flags for eCRF FormData (backend CrfAiEntryType).
 * Client sends only isAiBasedEntry + aiEntryType. Backend owns aiEntryAt / aiEntryBy.
 */

export const CRF_AI_ENTRY_TYPE = Object.freeze({
  VoiceToText: "VoiceToText",
  FileUpload: "FileUpload",
})

/** @typedef {'VoiceToText' | 'FileUpload'} CrfAiEntryType */

/**
 * @param {unknown} mode - UI mode from AI fill (`voice` | `upload`)
 * @returns {CrfAiEntryType | null}
 */
export function resolveCrfAiEntryTypeFromMode(mode) {
  const normalized = String(mode || "")
    .trim()
    .toLowerCase()
  if (normalized === "voice") return CRF_AI_ENTRY_TYPE.VoiceToText
  if (
    normalized === "upload" ||
    normalized === "file" ||
    normalized === "fileupload" ||
    normalized === "document"
  ) {
    return CRF_AI_ENTRY_TYPE.FileUpload
  }
  return null
}

/** @param {CrfAiEntryType} type */
export function markAiEntry(type, extras = {}) {
  const aiEntryType =
    type === CRF_AI_ENTRY_TYPE.FileUpload
      ? CRF_AI_ENTRY_TYPE.FileUpload
      : CRF_AI_ENTRY_TYPE.VoiceToText
  const entry = { isAiBasedEntry: true, aiEntryType }
  if (extras.aiConfidence != null && Number.isFinite(Number(extras.aiConfidence))) {
    entry.aiConfidence = Number(extras.aiConfidence)
  }
  if (extras.aiSuggestionLogId != null && Number(extras.aiSuggestionLogId) > 0) {
    entry.aiSuggestionLogId = Number(extras.aiSuggestionLogId)
  }
  return entry
}

export function clearAiEntry() {
  return { isAiBasedEntry: false }
}

/**
 * Fields to merge onto a FormData control node for create/update.
 * Never includes aiEntryAt / aiEntryBy.
 * @param {{ isAiBasedEntry?: boolean, aiEntryType?: string } | null | undefined} flag
 */
export function buildAiEntryFieldsForSave(flag) {
  if (!flag || typeof flag !== "object") return {}
  if (flag.isAiBasedEntry === true) {
    const aiEntryType =
      flag.aiEntryType === CRF_AI_ENTRY_TYPE.FileUpload
        ? CRF_AI_ENTRY_TYPE.FileUpload
        : CRF_AI_ENTRY_TYPE.VoiceToText
    const fields = { isAiBasedEntry: true, aiEntryType }
    if (flag.aiConfidence != null && Number.isFinite(Number(flag.aiConfidence))) {
      fields.aiConfidence = Number(flag.aiConfidence)
    }
    if (flag.aiSuggestionLogId != null && Number(flag.aiSuggestionLogId) > 0) {
      fields.aiSuggestionLogId = Number(flag.aiSuggestionLogId)
    }
    return fields
  }
  if (flag.isAiBasedEntry === false) {
    return { isAiBasedEntry: false }
  }
  return {}
}

function normalizeSavedAiEntryType(raw) {
  const text = String(raw ?? "").trim()
  if (!text) return null
  if (/^2$|^fileupload$/i.test(text)) return CRF_AI_ENTRY_TYPE.FileUpload
  if (/^1$|^voicetotext$/i.test(text)) return CRF_AI_ENTRY_TYPE.VoiceToText
  if (text === CRF_AI_ENTRY_TYPE.FileUpload) return CRF_AI_ENTRY_TYPE.FileUpload
  if (text === CRF_AI_ENTRY_TYPE.VoiceToText) return CRF_AI_ENTRY_TYPE.VoiceToText
  return null
}

function parsePersistedAiBased(raw) {
  if (raw === true || raw === 1) return true
  if (raw === false || raw === 0 || raw == null) return false
  const normalized = String(raw).trim().toLowerCase()
  return normalized === "true" || normalized === "1" || normalized === "yes"
}

/**
 * Read per-field AI flags from nested/flat API formData (GET / save response).
 * @returns {Record<string, { isAiBasedEntry: boolean, aiEntryType?: string, aiEntryAt?: *, aiEntryBy?: * }>}
 */
export function extractAiEntryFlagsFromSavedFormData(rawFormData) {
  const flags = {}
  if (!rawFormData) return flags

  let parsed = rawFormData
  try {
    if (typeof parsed === "string") parsed = JSON.parse(parsed)
  } catch {
    return flags
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return flags

  const visitField = (fieldId, raw) => {
    const id = String(fieldId || "").trim()
    if (!id || raw == null || typeof raw !== "object" || Array.isArray(raw)) return

    const hasAiFlag =
      Object.prototype.hasOwnProperty.call(raw, "isAiBasedEntry") ||
      Object.prototype.hasOwnProperty.call(raw, "IsAiBasedEntry")
    if (!hasAiFlag) return

    const isAiBasedEntry = parsePersistedAiBased(raw.isAiBasedEntry ?? raw.IsAiBasedEntry)
    if (!isAiBasedEntry) {
      flags[id] = { isAiBasedEntry: false }
      return
    }

    const aiEntryType = normalizeSavedAiEntryType(raw.aiEntryType ?? raw.AiEntryType)
    const entry = { isAiBasedEntry: true }
    if (aiEntryType) entry.aiEntryType = aiEntryType
    const at = raw.aiEntryAt ?? raw.AiEntryAt
    const by = raw.aiEntryBy ?? raw.AiEntryBy
    if (at != null && String(at).trim() !== "") entry.aiEntryAt = at
    if (by != null && String(by).trim() !== "") entry.aiEntryBy = by
    flags[id] = entry
  }

  const topKeys = Object.keys(parsed)
  const looksFlat = topKeys.some((k) => String(k || "").startsWith("ctrl_"))
  if (looksFlat) {
    topKeys.forEach((fid) => visitField(fid, parsed[fid]))
    return flags
  }
  topKeys.forEach((sectionKey) => {
    const section = parsed[sectionKey]
    if (!section || typeof section !== "object" || Array.isArray(section)) return
    Object.keys(section).forEach((fid) => visitField(fid, section[fid]))
  })
  return flags
}
