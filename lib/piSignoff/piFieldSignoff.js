/** Field-level PI sign-off helpers — mirrors SDV field metadata in persisted form JSON. */

export function getPiFieldKey(formId, controlId) {
  return `${String(formId || "")}::${String(controlId || "")}`
}

function hasPiAuditPayloadValue(raw) {
  if (raw == null) return false
  const s = String(raw).trim()
  return s !== "" && s !== "null" && s !== "undefined"
}

export function buildPiAuditFieldsForSave({ auditMeta, piFieldKey }) {
  const meta = auditMeta?.[piFieldKey] || {}
  const at = meta.piSignedAt ?? meta.PiSignedAt ?? null
  const by = meta.piSignedBy ?? meta.PiSignedBy ?? null
  return {
    piSignedAt: hasPiAuditPayloadValue(at) ? at : null,
    piSignedBy: hasPiAuditPayloadValue(by) ? by : null,
  }
}

/**
 * Reads isPiSigned (+ optional audit meta) from saved nested/flat API formData.
 */
export function extractPiMapsFromSavedFormData(rawFormData, formRuntimeId, getPiFieldKeyFn = getPiFieldKey) {
  const selections = {}
  const signed = {}
  const auditMeta = {}
  if (!rawFormData || formRuntimeId == null || typeof getPiFieldKeyFn !== "function") {
    return { selections, signed, auditMeta }
  }
  let parsed = rawFormData
  try {
    if (typeof parsed === "string") parsed = JSON.parse(parsed)
  } catch {
    return { selections, signed, auditMeta }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { selections, signed, auditMeta }
  }

  const visitField = (fieldId, raw) => {
    if (!fieldId || raw == null || typeof raw !== "object" || Array.isArray(raw)) return
    const k = getPiFieldKeyFn(formRuntimeId, fieldId)
    if (Object.prototype.hasOwnProperty.call(raw, "isPiSigned")) {
      const ok = Boolean(raw.isPiSigned)
      selections[k] = ok
      signed[k] = ok
    }
    const meta = {}
    if (Object.prototype.hasOwnProperty.call(raw, "piSignedAt")) {
      meta.piSignedAt = raw.piSignedAt
    }
    if (Object.prototype.hasOwnProperty.call(raw, "piSignedBy")) {
      meta.piSignedBy = raw.piSignedBy
    }
    if (Object.keys(meta).length > 0) auditMeta[k] = meta
  }

  const topKeys = Object.keys(parsed)
  const looksFlat = topKeys.some((k) => String(k || "").startsWith("ctrl_"))
  if (looksFlat) {
    topKeys.forEach((fid) => visitField(fid, parsed[fid]))
    return { selections, signed, auditMeta }
  }
  topKeys.forEach((sectionKey) => {
    const section = parsed[sectionKey]
    if (!section || typeof section !== "object" || Array.isArray(section)) return
    Object.keys(section).forEach((fid) => visitField(fid, section[fid]))
  })
  return { selections, signed, auditMeta }
}

export function normalizePiFieldSignoffSummary(raw) {
  if (!raw || typeof raw !== "object") {
    return {
      totalEligible: 0,
      signedCount: 0,
      allFieldsSigned: false,
      unsignedFieldKeys: [],
    }
  }
  const unsigned =
    raw.unsignedFieldKeys ??
    raw.UnsignedFieldKeys ??
    []
  return {
    totalEligible: Number(raw.totalEligible ?? raw.TotalEligible ?? 0) || 0,
    signedCount: Number(raw.signedCount ?? raw.SignedCount ?? 0) || 0,
    allFieldsSigned: Boolean(raw.allFieldsSigned ?? raw.AllFieldsSigned),
    unsignedFieldKeys: Array.isArray(unsigned)
      ? unsigned.map((k) => String(k ?? "").trim()).filter(Boolean)
      : [],
  }
}

export function piFieldSignoffProgressLabel(summary) {
  const total = summary?.totalEligible ?? 0
  const signed = summary?.signedCount ?? 0
  if (total <= 0) return "No eligible fields"
  return `${signed} / ${total} fields PI-signed`
}
