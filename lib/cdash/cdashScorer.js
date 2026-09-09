/** Multi-signal CDASH variable scorer (Phase 1 — client-side). */

import { buildControlProfile, normalizeText, tokenize } from "./controlProfile"
import { synonymBoost } from "./synonyms"

export const SUGGEST_CONFIDENCE_THRESHOLD = 25
export const SUGGEST_APPLY_THRESHOLD = 50
export const SUGGEST_AUTO_THRESHOLD = 80

function fuzzyContains(haystack, needle) {
  const h = normalizeText(haystack)
  const n = normalizeText(needle)
  if (!h || !n) return false
  return h.includes(n) || n.includes(h)
}

function tokenOverlapScore(leftTokens = [], rightTokens = []) {
  if (!leftTokens.length || !rightTokens.length) return 0
  const rightSet = new Set(rightTokens)
  const overlap = leftTokens.filter((token) => rightSet.has(token)).length
  return Math.min(30, Math.round((overlap / Math.max(leftTokens.length, 1)) * 30))
}

export function dataTypeCompatibility(controlType, dataType) {
  const map = {
    date: ["date"],
    ukunkdate: ["date"],
    datetime: ["datetime", "date"],
    number: ["num", "integer", "number"],
    text: ["char", "text"],
    select: ["char"],
    radio: ["char"],
    checkbox: ["char"],
    time: ["time", "datetime"],
  }
  const dt = String(dataType ?? "").toLowerCase()
  const expected = map[String(controlType ?? "").toLowerCase()] ?? []
  return expected.some((entry) => dt.includes(entry)) ? 10 : 0
}

export function scoreVariable(control, variable) {
  const profile = buildControlProfile(control)
  let score = 0
  const reasons = []
  const varName = String(variable?.variableName ?? "").toLowerCase()
  const varLabel = normalizeText(variable?.label ?? "")
  const varQuestion = normalizeText(variable?.questionText ?? "")

  if (profile.domainHint && profile.domainHint === variable.domainCode) {
    score += 15
    reasons.push(`Domain match: ${variable.domainCode}`)
  }

  const varHintNorm = profile.varHint ? profile.varHint.replace(/_/g, "") : ""
  if (varHintNorm && varName === varHintNorm) {
    score += 25
    reasons.push("Field ID matches variable name")
  } else if (varHintNorm && varName.includes(varHintNorm)) {
    score += 15
    reasons.push("Field ID partial match")
  }

  const labelScore = fuzzyContains(profile.label, varLabel)
    ? 30
    : fuzzyContains(profile.label, varQuestion)
      ? 25
      : tokenOverlapScore(
          profile.tokens,
          tokenize(`${varLabel} ${varQuestion} ${varName}`),
        )
  if (labelScore > 0) {
    score += labelScore
    reasons.push("Label/question similarity")
  }

  const synBoost = synonymBoost(profile.label, variable)
  if (synBoost > 0) {
    score += synBoost
    reasons.push("Synonym match")
  }

  const typeScore = dataTypeCompatibility(profile.controlType, variable.dataType)
  if (typeScore > 0) {
    score += typeScore
    reasons.push("Control type compatible")
  }

  if (profile.label.includes(varName)) {
    score += 20
    reasons.push("Label contains CDASH variable name")
  }

  return {
    variable,
    confidence: Math.min(100, score),
    reasons,
    rank: 0,
  }
}

export function rankScoredSuggestions(scored = [], limit = 5) {
  return scored
    .filter((row) => row.confidence >= SUGGEST_CONFIDENCE_THRESHOLD)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit)
    .map((row, index) => ({ ...row, rank: index + 1 }))
}

/** Picker/manual search — show all API hits, ranked by score (no confidence cutoff). */
export function rankPickerVariables(variables = [], control) {
  if (!control || !variables.length) return variables
  const mappable = typeof control?.fieldInstanceId === "string" ? control : control
  return [...variables]
    .map((variable) => scoreVariable(mappable, variable))
    .sort((a, b) => b.confidence - a.confidence)
    .map((row) => row.variable)
}
