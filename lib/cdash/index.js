/** Public CDASH exports — single-field suggest only. */

export { cdashLibraryStore } from "./cdashLibraryStore"
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
  searchPickerForControl,
} from "./cdashSuggestEngine"
export {
  buildControlProfile,
  toMappableControl,
  extractDomainHint,
  extractVarHint,
  mapDesignerControlTypeForCdashSuggest,
  resolveDesignerControlLabel,
  resolveDesignerControlType,
  isGenericDesignerFieldLabel,
} from "./controlProfile"
export {
  normalizeCdashVariable,
  extractCdashVariables,
  formatCdashVariableOption,
  confidenceBadgeClass,
} from "./normalizeVariable"
