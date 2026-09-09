/**
 * CDASH suggest API layer — single field only (POST /api/Cdash/Suggest).
 * UI displays results; user must Use, Manual, or Skip — never auto-save.
 */

import cdashService, { CDASH_IG_VERSION } from "@/lib/services/cdash.service"
import { toMappableControl } from "./controlProfile"
import { normalizeCdashVariable } from "./normalizeVariable"
import { toMappingDraft } from "./cdashConfidence"

export function normalizeCdashSuggestion(raw) {
  if (!raw) return null
  const variableRaw = raw.variable ?? raw.Variable
  const variable = normalizeCdashVariable(variableRaw)
  if (!variable) return null
  return {
    variable,
    confidence: Number(raw.confidence ?? raw.Confidence ?? 0),
    reasons: Array.isArray(raw.reasons)
      ? raw.reasons
      : Array.isArray(raw.Reasons)
        ? raw.Reasons
        : [],
    rank: Number(raw.rank ?? raw.Rank ?? 0),
    isAvailable: raw.isAvailable ?? raw.IsAvailable ?? true,
    unavailableReason:
      String(raw.unavailableReason ?? raw.UnavailableReason ?? "").trim() || null,
  }
}

export function normalizeSuggestFieldResult(raw) {
  if (!raw) return null
  const suggestionsRaw = raw.suggestions ?? raw.Suggestions ?? []
  const suggestions = (Array.isArray(suggestionsRaw) ? suggestionsRaw : [])
    .map(normalizeCdashSuggestion)
    .filter(Boolean)
    .sort((a, b) => a.rank - b.rank || b.confidence - a.confidence)
    .slice(0, 10)

  const topAvailableRaw = raw.topAvailableSuggestion ?? raw.TopAvailableSuggestion
  const topAvailableSuggestion =
    normalizeCdashSuggestion(topAvailableRaw) ??
    suggestions.find((row) => row.isAvailable !== false) ??
    null

  const topRaw = raw.topSuggestion ?? raw.TopSuggestion
  const topSuggestion =
    normalizeCdashSuggestion(topRaw) ?? topAvailableSuggestion ?? suggestions[0] ?? null

  if (
    topSuggestion &&
    !suggestions.some((row) => row.variable.id === topSuggestion.variable.id)
  ) {
    suggestions.unshift(topSuggestion)
  }

  const hasSuggestions = Boolean(
    raw.hasSuggestions ??
      raw.HasSuggestions ??
      suggestions.some((row) => row.isAvailable !== false),
  )

  return {
    fieldInstanceId: String(raw.fieldInstanceId ?? raw.FieldInstanceId ?? "").trim(),
    label: String(raw.label ?? raw.Label ?? "").trim(),
    hasSuggestions,
    topSuggestion,
    topAvailableSuggestion,
    suggestions,
  }
}

function assertStudyId(studyId) {
  const id = Number(studyId)
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Study ID is required for CDASH suggestions")
  }
  return id
}

/** POST /api/Cdash/Suggest — one selected field, optional user action. */
export async function suggestForControl(
  control,
  studyId,
  igVersion = CDASH_IG_VERSION,
  limit = 3,
  options = {},
) {
  const mappable = typeof control?.fieldInstanceId === "string" ? control : toMappableControl(control)
  if (!mappable.fieldInstanceId) {
    throw new Error("Field instance ID is required")
  }

  const res = await cdashService.suggest({
    studyId: assertStudyId(studyId),
    crfDesignId: options.crfDesignId,
    igVersion,
    fieldInstanceId: mappable.fieldInstanceId,
    label: mappable.label || "",
    controlType: mappable.controlType || "text",
    limit: Math.min(Math.max(Number(limit) || 3, 1), 10),
    excludeCdashReferenceDataIds: options.excludeCdashReferenceDataIds,
    draftAssignments: options.draftAssignments,
  })

  if (!res.isSuccess) {
    throw new Error(res.message || "CDASH suggest failed")
  }

  const payload = res.data?.data ?? res.data
  const normalized = normalizeSuggestFieldResult(payload)
  if (!normalized) {
    return {
      fieldInstanceId: mappable.fieldInstanceId,
      label: mappable.label,
      hasSuggestions: false,
      topSuggestion: null,
      topAvailableSuggestion: null,
      suggestions: [],
    }
  }

  return normalized
}

export {
  canAutoApply,
  canShowApply,
  canShowInList,
  toMappingDraft,
  SUGGEST_APPLY_THRESHOLD,
  SUGGEST_AUTO_THRESHOLD,
  SUGGEST_LIST_THRESHOLD,
} from "./cdashConfidence"
