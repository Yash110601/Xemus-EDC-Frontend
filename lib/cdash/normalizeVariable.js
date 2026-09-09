/** Normalize GET /api/Cdash/Variables rows for the suggestion engine. */

export function normalizeCdashVariable(item) {
  if (!item) return null
  const id = Number(item.id ?? item.Id)
  if (!Number.isFinite(id)) return null
  const variableName = String(item.variableName ?? item.VariableName ?? "").trim()
  if (!variableName) return null
  return {
    id,
    igVersion: String(item.igVersion ?? item.IgVersion ?? "").trim(),
    modelVersion: String(item.modelVersion ?? item.ModelVersion ?? "").trim(),
    observationClass: String(item.observationClass ?? item.ObservationClass ?? "").trim(),
    domainCode: String(item.domainCode ?? item.DomainCode ?? "").trim(),
    variableName,
    label: String(item.label ?? item.Label ?? "").trim() || null,
    questionText: String(item.questionText ?? item.QuestionText ?? "").trim() || null,
    dataType: String(item.dataType ?? item.DataType ?? "").trim() || null,
    ordinal: item.ordinal ?? item.Ordinal ?? null,
    sdtmTarget: String(item.sdtmTarget ?? item.SdtmTarget ?? "").trim() || null,
    isAvailable: item.isAvailable ?? item.IsAvailable ?? true,
    unavailableReason:
      String(item.unavailableReason ?? item.UnavailableReason ?? "").trim() || null,
  }
}

export function extractCdashVariables(response) {
  const raw = response?.data?.items ?? response?.data?.Items ?? response?.data ?? []
  if (!Array.isArray(raw)) return []
  return raw.map(normalizeCdashVariable).filter(Boolean)
}

export function formatCdashVariableOption(item) {
  if (!item) return ""
  const parts = [item.variableName]
  if (item.label) parts.push(`— ${item.label}`)
  if (item.dataType) parts.push(`(${item.dataType})`)
  return parts.join(" ")
}

/** Picker row label — includes unavailable reason when disabled. */
export function formatCdashVariablePickerLabel(item) {
  if (!item) return ""
  const base = formatCdashVariableOption(item)
  if (item.isAvailable === false && item.unavailableReason) {
    return `${base} (${item.unavailableReason})`
  }
  return base
}

export function isCdashVariableSelectable(item) {
  return item?.isAvailable !== false
}

export function confidenceBadgeClass(confidence) {
  if (confidence >= 80) return "bg-emerald-100 text-emerald-800"
  if (confidence >= 50) return "bg-indigo-100 text-indigo-800"
  return "bg-amber-100 text-amber-800"
}
