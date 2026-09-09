/**
 * YP Intelligence — module constants and shared shapes.
 */

export const XEMUS_AI_MODULES = {
  CAPTURE: "capture",
  VERIFY: "verify",
  STUDIO: "studio",
  GUARD: "guard",
  INSIGHT: "insight",
  CONSENT: "consent",
}

/** Hub cards on `/intelligence` — links to existing AI surfaces (suggest-only). */
export const INTELLIGENCE_HUB_MODULES = [
  {
    key: "isAiEntryEnabled",
    module: "capture",
    title: "Capture AI",
    description: "Voice and document fill on AI-based eCRF entry. Review before merge.",
    href: "/ecrf-data-entry/ai-based",
  },
  {
    key: "isAiRsdvVerifyEnabled",
    module: "verify",
    title: "Verify AI",
    description: "Suggest source-document region matches against eCRF fields in remote SDV.",
    href: "/rsdv/review",
  },
  {
    key: "isAiCrfStudioEnabled",
    module: "studio",
    title: "Studio AI",
    description: "Protocol extraction passes in CRF Studio.",
    href: "/study-management/crf-studio",
  },
  {
    key: "isAiQualityHintsEnabled",
    module: "guard",
    title: "Guard AI",
    description: "Non-blocking quality hints before CRF submit.",
    href: "/ecrf-data-entry/manually",
  },
  {
    key: "isAiInsightEnabled",
    module: "insight",
    title: "Insight AI",
    description: "CRA monitoring summary and study assistant in eCRF / RSDV.",
    href: "/dashboard",
  },
  {
    key: "isAiConsentAssistEnabled",
    module: "consent",
    title: "Consent AI",
    description: "Generate knowledge-check questions from consent section text.",
    href: "/econsent/forms",
  },
]

/** Sub-feature flags stored on StudySettings (master + module toggles). */
export const DEFAULT_STUDY_AI_SETTINGS = {
  isXemusIntelligenceEnabled: false,
  isAiEntryEnabled: false,
  isAiRsdvVerifyEnabled: false,
  isAiQueryCopilotEnabled: false,
  isAiCrfStudioEnabled: false,
  isAiQualityHintsEnabled: false,
  isAiCodingAssistEnabled: false,
  isAiInsightEnabled: false,
  isAiConsentAssistEnabled: false,
}

export const AI_MATCH_STATUS = {
  MATCH: "match",
  MISMATCH: "mismatch",
  UNCLEAR: "unclear",
}

export const AI_QUALITY_SEVERITY = {
  INFO: "info",
  WARNING: "warning",
  ERROR: "error",
}

/** CRF Studio extraction pass labels (align with backend pipeline). */
export const CRF_STUDIO_EXTRACTION_PASSES = [
  { id: 1, key: "visit_schedule", label: "Visit schedule & form list" },
  { id: 2, key: "form_controls", label: "Form sections & controls" },
  { id: 3, key: "coverage", label: "Protocol coverage report" },
  { id: 4, key: "rules", label: "Rule suggestions" },
  { id: 5, key: "sdtm", label: "SDTM mapping hints" },
]

export function formatAiConfidence(confidence) {
  const n = Number(confidence)
  if (!Number.isFinite(n)) return null
  const pct = n <= 1 ? Math.round(n * 100) : Math.round(n)
  return Math.min(100, Math.max(0, pct))
}

export function confidenceBadgeClass(confidence) {
  const pct = formatAiConfidence(confidence)
  if (pct == null) return "bg-slate-100 text-slate-600"
  if (pct >= 85) return "bg-emerald-50 text-emerald-800 ring-emerald-200/80"
  if (pct >= 60) return "bg-amber-50 text-amber-800 ring-amber-200/80"
  return "bg-rose-50 text-rose-800 ring-rose-200/80"
}

export function matchStatusBadgeClass(status) {
  const s = String(status ?? "").toLowerCase()
  if (s === AI_MATCH_STATUS.MATCH) return "bg-emerald-50 text-emerald-800"
  if (s === AI_MATCH_STATUS.MISMATCH) return "bg-rose-50 text-rose-800"
  return "bg-amber-50 text-amber-800"
}

/**
 * Resolve effective module flag: master off → all off; else sub-flag.
 */
export function isAiModuleEnabled(settings, subFlagKey) {
  if (!settings || typeof settings !== "object") return false
  if (!settings.isXemusIntelligenceEnabled) return false
  return Boolean(settings[subFlagKey])
}

/**
 * Build review rows from extracted control map + optional raw NER items.
 * @param {Record<string, unknown>} normalizedValues
 * @param {Array<{ id?: string, label?: string }>} controls
 * @param {Array<{ question_id?: string, answer?: string, confidence?: number }>} [rawItems]
 */
export function buildCaptureAiSuggestions(normalizedValues, controls = [], rawItems = []) {
  if (!normalizedValues || typeof normalizedValues !== "object") return []
  const labelById = new Map(
    (controls || []).map((c) => [String(c?.id ?? ""), String(c?.label ?? c?.id ?? "")]),
  )
  const confidenceById = new Map()
  for (const item of rawItems || []) {
    const id = String(item?.question_id ?? item?.fieldId ?? "").trim()
    if (!id) continue
    confidenceById.set(id, item?.confidence ?? item?.Confidence ?? null)
  }

  return Object.entries(normalizedValues)
    .filter(([key]) => key && !key.endsWith("_rowCount") && !key.endsWith("_removeRow"))
    .map(([fieldId, value]) => ({
      fieldId,
      fieldLabel: labelById.get(fieldId) || fieldId,
      suggestedValue: value,
      confidence: confidenceById.get(fieldId) ?? 0.75,
      sourceSnippet: String(value ?? "").slice(0, 200),
      selected: true,
    }))
}
