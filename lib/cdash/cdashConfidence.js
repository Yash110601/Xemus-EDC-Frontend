/** CDASH suggestion confidence thresholds + mapping helpers (UI only). */

export const SUGGEST_LIST_THRESHOLD = 25
export const SUGGEST_APPLY_THRESHOLD = 50
export const SUGGEST_AUTO_THRESHOLD = 80

export function canAutoApply(top) {
  return (top?.confidence ?? 0) >= SUGGEST_AUTO_THRESHOLD
}

export function canShowApply(top) {
  return (top?.confidence ?? 0) >= SUGGEST_APPLY_THRESHOLD
}

export function canShowInList(top) {
  return (top?.confidence ?? 0) >= SUGGEST_LIST_THRESHOLD
}

/** Build CRF save draft from backend suggestion — IDs always from API. */
export function toMappingDraft(suggestion, fieldInstanceId) {
  const variable = suggestion?.variable
  if (!variable?.id || !fieldInstanceId) return null
  return {
    fieldInstanceId: String(fieldInstanceId).trim(),
    cdashReferenceDataId: Number(variable.id),
    cdashVariableName: String(variable.variableName ?? "").trim(),
    domainCode: String(variable.domainCode ?? "").trim(),
    variableLabel: String(variable.label ?? "").trim(),
    confidence: Number(suggestion.confidence ?? 0),
    reasons: Array.isArray(suggestion.reasons) ? suggestion.reasons : [],
    source: "auto",
  }
}
