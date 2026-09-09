/**
 * CDASH suggest — single field API only (Phase 2).
 */

export {
  suggestForControl,
  normalizeCdashSuggestion,
  normalizeSuggestFieldResult,
  canAutoApply,
  canShowApply,
  canShowInList,
  toMappingDraft,
  SUGGEST_APPLY_THRESHOLD,
  SUGGEST_AUTO_THRESHOLD,
  SUGGEST_LIST_THRESHOLD,
} from "./cdashApiSuggest"

/** Manual picker — GET /Variables with per-CRF availability when crfDesignId / drafts provided. */
export async function searchPickerForControl(control, options = {}) {
  const { searchCdashVariablesForField } = await import("./cdashVariableSearch")
  return searchCdashVariablesForField(control, options)
}
