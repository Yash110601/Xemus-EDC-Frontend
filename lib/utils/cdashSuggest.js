/**
 * Backward-compatible re-exports — prefer `@/lib/cdash` for new code.
 */

import { CDASH_IG_VERSION } from "@/lib/services/cdash.service"
import {
  cdashLibraryStore,
  formatCdashVariableOption,
  normalizeCdashVariable,
  extractCdashVariables,
  suggestForControl,
  searchPickerForControl,
  toMappingDraft,
} from "@/lib/cdash"

export { CDASH_IG_VERSION }
export {
  formatCdashVariableOption,
  normalizeCdashVariable,
  extractCdashVariables,
  suggestForControl,
  searchPickerForControl,
  toMappingDraft,
}

export function normalizeCdashVariableItem(item) {
  return normalizeCdashVariable(item)
}

export function extractCdashVariableItems(response) {
  return extractCdashVariables(response)
}

/** Returns top suggestion summary after single-field POST /Suggest. */
export async function suggestCdashForControl(control, studyId) {
  const result = await suggestForControl(control, studyId)
  const top = result.topSuggestion ?? result.suggestions[0]
  if (!top) return null
  return {
    domainCode: top.variable.domainCode,
    variableName: top.variable.variableName,
    confidence: top.confidence,
    hasSuggestions: result.hasSuggestions,
  }
}

export async function resolveCdashVariableFromApi({ domainCode, variableName, search } = {}) {
  const items = await cdashLibraryStore.search(CDASH_IG_VERSION, {
    domainCode,
    query: search ?? variableName,
    limit: 20,
  })
  return (
    items.find((item) => item.variableName.toUpperCase() === String(variableName).toUpperCase()) ??
    items[0] ??
    null
  )
}

export { extractDomainHint } from "@/lib/cdash"

export function rankCdashVariablesForControl(variables = []) {
  return variables
}
