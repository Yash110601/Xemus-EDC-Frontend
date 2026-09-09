/**
 * Rule Evaluator Utility
 * Evaluates rule expressions dynamically based on form field values
 */

import {
  sanitizeRuleLiteralPartValue,
  normalizeRuleExpressionLiterals as normalizeRuleExpressionLiteralsCore,
  serializeRuleLiteralForApi,
} from "@/lib/utils/ruleExpressionLiterals"

// Single non-word character: no \b...\b replacement can ever match it (fixes re-quoting of "null")
const NULL_PLACEHOLDER = '\uE000'
// Parameter name used when evaluating - we pass null as this arg
const NULL_PARAM_NAME = '__evalNull__'

/** Console prefix for all CRF rule diagnostics (easy filter / copy-paste for support). */
export const CRF_RULE_LOG_PREFIX = "[CRF Rules]"
const CRF_RULE_LOGGING_ENABLED = false
export const DATE_RESTRICTION_RULE_MARKER = "__DATE_RESTRICTION__"
export const sanitizeCrfRuleMessage = (raw) =>
  String(raw || "")
    .split(DATE_RESTRICTION_RULE_MARKER)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim()

/** Throttle identical warn payloads (same rule firing on every keystroke / re-render). */
const CRF_RULE_WARN_DEDUPE_MS = 25000
const crfRuleWarnDedupe = new Map()
const crfRuleInvalidExpressionCache = new Set()
const MAX_INVALID_EXPRESSION_CACHE = 200
const crfRuleCompiledFnCache = new Map()
const MAX_COMPILED_FN_CACHE = 1000
const crfRulePerfState = {
  enabled: false,
  sampleRate: 0.2,
  rolling: [],
  maxSamples: 500,
  totalCount: 0,
  totalDurationMs: 0,
  lastFlushAt: 0,
}
const WARN_DEDUPE_EVENTS = new Set([
  "rule_target_not_found",
  "rule_table_cell_unresolved",
  "expression_evaluation_failed",
  "expression_eval_outer_error",
  "rule_eval_top_level_error",
])

/**
 * Verbose per-rule logs (expression built, rule_evaluated, unresolved hints, etc.):
 * `localStorage.setItem('crfRulesDebug','1')` in the browser console.
 * Set `'0'` to force quiet. When unset, logs stay off in dev and prod — only real eval failures still warn.
 */
export function isCrfRuleVerbose() {
  if (typeof window === "undefined") return false
  try {
    const v = window.localStorage?.getItem("crfRulesDebug")
    if (v === "1") return true
    if (v === "0") return false
  } catch {
    /* ignore */
  }
  return false
}

function isCrfRulePerfEnabled() {
  if (typeof window === "undefined") return false
  if (crfRulePerfState.enabled) return true
  try {
    const v = window.localStorage?.getItem("crfRulesPerf")
    if (v === "1") {
      crfRulePerfState.enabled = true
      return true
    }
  } catch {
    /* ignore */
  }
  return false
}

function recordRulePerfMetric(durationMs) {
  if (!isCrfRulePerfEnabled()) return
  if (Math.random() > crfRulePerfState.sampleRate) return
  const d = Number(durationMs) || 0
  crfRulePerfState.totalCount += 1
  crfRulePerfState.totalDurationMs += d
  crfRulePerfState.rolling.push(d)
  if (crfRulePerfState.rolling.length > crfRulePerfState.maxSamples) {
    crfRulePerfState.rolling.shift()
  }
  const now = Date.now()
  if (now - crfRulePerfState.lastFlushAt < 5000) return
  crfRulePerfState.lastFlushAt = now
  const arr = [...crfRulePerfState.rolling].sort((a, b) => a - b)
  const pick = (p) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor((arr.length - 1) * p))] : 0)
  const p50 = pick(0.5).toFixed(2)
  const p95 = pick(0.95).toFixed(2)
  const avg = (crfRulePerfState.totalDurationMs / Math.max(1, crfRulePerfState.totalCount)).toFixed(2)
  logCrfRule("info", "rule_eval_perf_baseline", {
    samples: arr.length,
    totalCount: crfRulePerfState.totalCount,
    avgMs: Number(avg),
    p50Ms: Number(p50),
    p95Ms: Number(p95),
  })
}

function executeCompiledExpression(expr, nullParamValue) {
  let fn = crfRuleCompiledFnCache.get(expr)
  if (!fn) {
    fn = new Function(NULL_PARAM_NAME, "return " + expr)
    crfRuleCompiledFnCache.set(expr, fn)
    if (crfRuleCompiledFnCache.size > MAX_COMPILED_FN_CACHE) {
      crfRuleCompiledFnCache.clear()
    }
  }
  return fn(nullParamValue)
}

function getControlResolver(allControls = []) {
  if (allControls instanceof Map) {
    return (id) => allControls.get(id)
  }
  if (allControls && typeof allControls === "object" && !Array.isArray(allControls)) {
    return (id) => allControls[id]
  }
  const controlArray = Array.isArray(allControls) ? allControls : []
  return (id) => controlArray.find((x) => x.id === id)
}

/**
 * Build compact rule dependency metadata once, then reuse across edits.
 */
export function createRuleDependencyIndex(expression, targetIds = []) {
  const expr = String(expression || "")
  const referencedIds = [...new Set(expr.match(/\bctrl_[A-Za-z0-9_]+\b/g) || [])]
  const referencedBaseIds = [...new Set(
    referencedIds
      .map((id) => {
        const m = id.match(/^(.+)_row_\d+_col_\d+$/)
        return m ? m[1] : null
      })
      .filter(Boolean)
  )]
  const targets = Array.isArray(targetIds) ? targetIds.map(String).filter(Boolean) : []
  return {
    expression: expr,
    expressionTrimmed: expr.trim(),
    referencedIds,
    referencedBaseIds,
    targetIds: targets,
  }
}

/**
 * Fast dependency match using precompiled tokens + dirty ids.
 */
export function ruleDependencyMatchesDirtyFields(ruleDep, dirtyFieldIds, allControls = []) {
  if (!Array.isArray(dirtyFieldIds) || dirtyFieldIds.length === 0) return true
  if (dirtyFieldIds.includes("*")) return true
  const dep = ruleDep || createRuleDependencyIndex("")
  if (!dep.expressionTrimmed) return true

  const dirty = dirtyFieldIds.map(String).filter(Boolean)
  const dirtySet = new Set(dirty)
  const dirtyBaseIds = new Set()
  dirty.forEach((id) => {
    const m = id.match(/^(.+)_row_\d+_col_\d+$/)
    if (m?.[1]) dirtyBaseIds.add(m[1])
    if (id.endsWith("_rowCount")) dirtyBaseIds.add(id.replace(/_rowCount$/, ""))
  })

  for (const rid of dep.referencedIds || []) {
    if (dirtySet.has(rid)) return true
  }
  for (const base of dep.referencedBaseIds || []) {
    if (dirtySet.has(base) || dirtyBaseIds.has(base)) return true
  }

  const resolver = getControlResolver(allControls)
  for (const id of dirty) {
    const c = resolver(id)
    const label = c?.label || c?.properties?.labelText
    if (label) {
      const labelVariants = collectRuleLabelMatchKeys(String(label))
      for (const variant of labelVariants) {
        if (!variant) continue
        if (dep.expression.includes(String(variant))) return true
      }
    }
    if (dep.expression.includes(id)) return true
  }

  for (const tid of dep.targetIds || []) {
    if (dirtySet.has(tid)) return true
    for (const d of dirtySet) {
      if (tid === d || tid.startsWith(`${d}_`) || d.startsWith(`${tid}_`)) return true
    }
  }
  return false
}

/**
 * Heuristic: whether a rule expression likely reads any of the given field ids.
 * Uses substring checks on ids, table base ids for cell keys, rowCount keys, and control labels.
 * Returns true when dirtyFieldIds is empty or when expression is empty (caller should treat as "run rule").
 */
export function ruleExpressionLikelyReferencesDirtyIds(expression, dirtyFieldIds, allControls = []) {
  return ruleDependencyMatchesDirtyFields(
    createRuleDependencyIndex(expression),
    dirtyFieldIds,
    allControls
  )
}

/**
 * Whether a CRF-design-level rule should re-run for this edit (expression inputs or targets overlap dirty ids).
 */
export function crfDesignRuleShouldRunForDirtyFields(rule, dirtyFieldIds, allControls = [], precompiledDependency = null) {
  if (!Array.isArray(dirtyFieldIds) || dirtyFieldIds.length === 0) return true
  if (dirtyFieldIds.includes("*")) return true
  const expr = rule.expression || rule.ruleExpression || ""
  let targetIds = []
  if (Array.isArray(rule.targetFields) && rule.targetFields.length > 0) {
    targetIds = rule.targetFields.map(String)
  } else if (rule.targetField) {
    const tf = String(rule.targetField)
    targetIds = tf.includes(",") ? tf.split(",").map((s) => s.trim()).filter(Boolean) : [tf]
  }
  const dep = precompiledDependency || createRuleDependencyIndex(expr, targetIds)
  return ruleDependencyMatchesDirtyFields(dep, dirtyFieldIds, allControls)
}

function pickRelevantFormValuesForLog(expression, formValues) {
  const ids = new Set(
    String(expression || "")
      .match(/\bctrl_[A-Za-z0-9_]+\b/g) || []
  )
  const out = {}
  ids.forEach((id) => {
    if (Object.prototype.hasOwnProperty.call(formValues, id)) {
      out[id] = formValues[id]
    }
  })
  return out
}

function truncateForLog(str, max = 400) {
  const s = String(str ?? "")
  if (s.length <= max) return s
  return `${s.slice(0, max)}…`
}

/** Normalize smart quotes/apostrophes to ASCII for stable parsing/replacement. */
function normalizeRuleTypography(str) {
  if (!str || typeof str !== "string") return str
  return str
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00A0/g, " ")
    // En dash / em dash → ASCII hyphen so rule text matches label text across authors/tools
    .replace(/[\u2013\u2014]/g, "-")
}

/**
 * Alias keys for the same logical field label so rules still resolve when:
 * - the UI shows a trailing " *" (required) but the CRF definition omits it (or the reverse)
 * - authors paste labels with normalized dashes/spaces
 * @param {string} label
 * @returns {string[]}
 */
/**
 * Designer "Read Only" on a control (not rule-driven).
 * User cannot type; compute rules and dropdown auto-value maps may still write values.
 */
export const isDesignerReadonly = (properties) => {
  if (!properties || typeof properties !== "object") return false
  return (
    properties.readonly === true ||
    properties.readonly === "true" ||
    properties.readonly === 1 ||
    properties.readonly === "1" ||
    properties.designerReadonly === true ||
    properties.designerReadonly === "true"
  )
}

export const collectRuleLabelMatchKeys = (label) => {
  if (!label || typeof label !== "string") return []
  const normalized = normalizeRuleTypography(label).trim()
  if (!normalized) return []
  const withoutTrailStars = normalized.replace(/\s*\*+\s*$/u, "").trim()
  const out = new Set([normalized])
  if (withoutTrailStars && withoutTrailStars !== normalized) {
    out.add(withoutTrailStars)
  }
  if (withoutTrailStars) {
    const withStar = `${withoutTrailStars} *`
    if (withStar !== withoutTrailStars) out.add(withStar)
  }
  return [...out].filter(Boolean)
}

function normalizeBooleanLikeOptionValue(raw) {
  const text = String(raw ?? "").trim()
  if (!text) return ""
  const lowered = text.toLowerCase()
  if (lowered === "yes") return "Yes"
  if (lowered === "no") return "No"
  if (lowered === "true") return "true"
  if (lowered === "false") return "false"
  return text
}

/**
 * @param {'log'|'info'|'warn'|'error'} level
 * @param {string} event short machine-readable event id
 * @param {Record<string, unknown>} data
 */
export function logCrfRule(level, event, data = {}) {
  if (!CRF_RULE_LOGGING_ENABLED) return
  const safeEvent = event || "unknown_rule_event"
  const safeData =
    data && typeof data === "object"
      ? data
      : { detail: data == null ? "" : String(data) }
  const payload = { event: safeEvent, ...safeData }
  if (
    Object.keys(payload).length === 1 &&
    Object.prototype.hasOwnProperty.call(payload, "event")
  ) {
    payload.detail = "No additional diagnostic context"
  }
  if (level === "warn" && WARN_DEDUPE_EVENTS.has(safeEvent)) {
    let mapKey
    if (safeEvent === "expression_eval_outer_error" || safeEvent === "expression_evaluation_failed") {
      mapKey = `eval_expression|${safeData.ruleId ?? ""}|${String(safeData.source ?? "")}|${String(safeData.engineMessage || safeData.detail || "").slice(0, 180)}`
    } else {
      const dedupeKey = `${safeData.ruleId ?? ""}|${safeData.targetFieldId ?? ""}|${String(safeData.source ?? "")}|${String(safeData.detail || safeData.engineMessage || "").slice(0, 160)}`
      mapKey = `${safeEvent}|${dedupeKey}`
    }
    const now = Date.now()
    const last = crfRuleWarnDedupe.get(mapKey)
    if (last != null && now - last < CRF_RULE_WARN_DEDUPE_MS) {
      return
    }
    crfRuleWarnDedupe.set(mapKey, now)
    if (crfRuleWarnDedupe.size > 500) crfRuleWarnDedupe.clear()
  }

  const fn =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : level === "info"
          ? console.info
          : console.log
  fn.call(console, CRF_RULE_LOG_PREFIX, payload)
}

/** Normalize API/UI category variants (e.g., "Disable Action") to canonical keys. */
export const normalizeRuleCategory = (rawCategory) => {
  const normalized = (rawCategory ?? "")
    .toString()
    .trim()
    .toLowerCase()
  if (!normalized) return ""
  if (normalized === "show" || normalized.includes("show")) return "show"
  if (normalized === "hide" || normalized.includes("hide")) return "hide"
  if (normalized === "disable" || normalized.includes("disable")) return "disable"
  if (normalized === "enable" || normalized.includes("enable")) return "enable"
  if (normalized === "compute" || normalized.includes("compute")) return "compute"
  if (
    normalized === "date_restriction" ||
    normalized === "daterestriction" ||
    normalized === "date restriction" ||
    (normalized.includes("date") && normalized.includes("restrict"))
  ) {
    return "date_restriction"
  }
  if (normalized === "validation" || normalized.includes("validation")) return "validation"
  if (normalized === "submit" || normalized.includes("submit")) return "submit"
  if (normalized === "retro" || normalized.includes("retro")) return "retro"
  return normalized
}

export { sanitizeRuleLiteralPartValue, serializeRuleLiteralForApi }

export function normalizeRuleExpressionLiterals(expression) {
  const prepped = normalizeRuleTypography(decodeHtmlEntities(String(expression ?? "").trim()))
  return normalizeRuleExpressionLiteralsCore(prepped)
}

export function finalizeRuleExpressionForApi(expression) {
  return normalizeRuleExpressionLiteralsCore(
    normalizeRuleTypography(String(expression ?? "").trim())
  )
}

/** Normalize expression fields on a CRF rule record from API/designer. */
export function normalizeCrfRuleExpressionFields(rule) {
  if (!rule || typeof rule !== "object") return rule
  const raw = rule.expression ?? rule.ruleExpression ?? rule.Expression ?? ""
  const normalized = normalizeRuleExpressionLiterals(raw)
  if (!normalized || normalized === raw) return rule
  return {
    ...rule,
    expression: normalized,
    ruleExpression: normalized,
  }
}

export const isDateRestrictionRule = (rule) => {
  if (!rule || typeof rule !== "object") return false
  const normalizedCategory = normalizeRuleCategory(
    rule?.category ?? rule?.ruleCategory ?? rule?.Category
  )
  if (normalizedCategory === "date_restriction") return true
  const messageRaw = String(rule?.message ?? rule?.Message ?? "")
  return messageRaw.includes(DATE_RESTRICTION_RULE_MARKER)
}

/** UI label for rule category badges (API may store date rules as Validation). */
export const getRuleCategoryDisplayLabel = (rule) => {
  if (isDateRestrictionRule(rule)) return "Date Restriction"
  const raw = String(rule?.ruleCategory ?? rule?.category ?? rule?.Category ?? "").trim()
  return raw || "Unknown"
}

/** @param {Record<string, unknown>} meta */
function shouldLogCrfDesignRule(meta) {
  return meta && meta.log === "crf-design" && meta.silent !== true
}

/** @param {Record<string, unknown>} meta */
function shouldLogControlRule(meta) {
  return (
    meta &&
    meta.log === "control" &&
    meta.silent !== true &&
    (isCrfRuleVerbose() || meta.forceVerbose === true)
  )
}

/**
 * @param {Record<string, unknown>} meta
 * @param {Record<string, unknown>} data
 */
function emitRuleEvaluated(meta, data) {
  if (!meta || meta.silent) return
  const verbose = isCrfRuleVerbose()
  if (!verbose && !shouldLogControlRule(meta)) return
  if (verbose && shouldLogCrfDesignRule(meta)) {
    logCrfRule("info", "rule_evaluated", data)
    return
  }
  if (shouldLogControlRule(meta)) {
    logCrfRule("info", "rule_evaluated", data)
  }
}

/**
 * @param {Record<string, unknown>} meta
 * @param {Record<string, unknown>} data
 */
function emitRuleEvalWarning(meta, data) {
  if (!meta || meta.silent) return
  const verbose = isCrfRuleVerbose()
  if (!verbose && !shouldLogControlRule(meta)) return
  if ((shouldLogCrfDesignRule(meta) && verbose) || shouldLogControlRule(meta)) {
    logCrfRule("warn", data.event || "rule_warning", data)
  }
}

/**
 * Evaluate a rule expression dynamically
 * @param {string} expression - The rule expression to evaluate
 * @param {Object} formValues - Current form field values { fieldId: value }
 * @param {Object} fieldLabels - Map of field IDs to labels for expression replacement
 * @param {Object} [meta] - Optional context for console diagnostics (rule id, source, targets)
 * @returns {boolean} - True if rule condition is met
 */
export const evaluateRule = (expression, formValues = {}, fieldLabels = {}, meta = {}) => {
  expression = normalizeRuleExpressionLiterals(expression)
  const evalStartMs =
    typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now()
  if (!expression || !expression.trim()) {
    if (shouldLogCrfDesignRule(meta)) {
      emitRuleEvaluated(meta, {
        ruleId: meta?.ruleId,
        ruleName: meta?.ruleName,
        ruleCategory: meta?.ruleCategory,
        source: meta?.source,
        targetFieldIds: meta?.targetFieldIds,
        targetControlId: meta?.targetControlId,
        conditionMet: false,
        path: "empty_rule_expression",
      })
    }
    const evalEndMs =
      typeof performance !== "undefined" && performance.now
        ? performance.now()
        : Date.now()
    recordRulePerfMetric(evalEndMs - evalStartMs)
    return false
  }
  const expressionKey = String(expression).trim()
  if (crfRuleInvalidExpressionCache.has(expressionKey)) {
    emitRuleEvaluated(meta, {
      ruleId: meta?.ruleId,
      ruleName: meta?.ruleName,
      ruleCategory: meta?.ruleCategory,
      source: meta?.source,
      targetFieldIds: meta?.targetFieldIds,
      targetControlId: meta?.targetControlId,
      conditionMet: false,
      path: "cached_invalid_expression",
    })
    const evalEndMs =
      typeof performance !== "undefined" && performance.now
        ? performance.now()
        : Date.now()
    recordRulePerfMetric(evalEndMs - evalStartMs)
    return false
  }

  const cacheInvalidExpression = (message) => {
    const m = String(message || "")
    // Cache only parser-level syntax issues, not runtime null/undefined value errors.
    if (
      !m.includes("Unexpected token") &&
      !m.includes("Invalid or unexpected token") &&
      !m.includes("missing )") &&
      !m.includes("missing ]") &&
      !m.includes("Unexpected end of input")
    ) {
      return
    }
    crfRuleInvalidExpressionCache.add(expressionKey)
    if (crfRuleInvalidExpressionCache.size > MAX_INVALID_EXPRESSION_CACHE) {
      crfRuleInvalidExpressionCache.clear()
    }
  }

  try {
    const referencedFieldIds = [
      ...new Set(
        String(expression)
          .match(/\bctrl_[A-Za-z0-9_]+\b/g) || []
      ),
    ]

    if (referencedFieldIds.length > 0) {
      const referencedValues = referencedFieldIds.map((id) => ({
        id,
        hasKey: Object.prototype.hasOwnProperty.call(formValues, id),
        value: formValues[id],
      }))
      const unresolved = referencedValues.filter(
        (item) =>
          !item.hasKey ||
          item.value === undefined ||
          item.value === null ||
          item.value === "null"
      )
      if (unresolved.length > 0 && isCrfRuleVerbose()) {
        logCrfRule("warn", "unresolved_field_values", {
          ruleId: meta?.ruleId,
          source: meta?.source,
          expression: truncateForLog(expression, 200),
          unresolved,
          hint:
            "Rule may evaluate false until these fields exist in formValues.",
        })
      }
    }

    // Replace field labels/IDs with actual values from formValues
    let evalExpression = expression.trim()
    
    // STEP 0: Decode HTML entities (e.g. &gt; -> >, &lt; -> <) BEFORE any processing
    // API may return >= as &gt;= - if we don't decode first, the "=" in &gt;= gets wrongly normalized to "=="
    evalExpression = normalizeRuleTypography(decodeHtmlEntities(evalExpression))
    
    // STEP 1: First, preserve string literals by replacing them with placeholders
    // This prevents field replacement from interfering with quoted strings
    const stringPlaceholders = []
    let placeholderIndex = 0
    
    // Replace double-quoted strings first (e.g., "Female")
    // Handle both regular quotes and escaped quotes
    evalExpression = evalExpression.replace(/"([^"]*)"/g, (match, content) => {
      const placeholder = `__STRING_${placeholderIndex}__`
      stringPlaceholders[placeholderIndex] = content // Store just the content, not the quotes
      placeholderIndex++
      return placeholder
    })
    
    // Replace single-quoted strings (e.g., 'Female')
    evalExpression = evalExpression.replace(/'([^']*)'/g, (match, content) => {
      const placeholder = `__STRING_${placeholderIndex}__`
      stringPlaceholders[placeholderIndex] = content // Store just the content, not the quotes
      placeholderIndex++
      return placeholder
    })
    
    // STEP 2: Replace field references with their values
    // PRIORITY 1: Replace field IDs first (e.g., "ctrl_1769166186766_y82i1z136")
    // This is the most reliable way since IDs are unique
    Object.keys(formValues).forEach(key => {
      if (key && typeof key === 'string' && key.startsWith('ctrl_')) {
        const value = formValues[key]
        const escapedKey = escapeRegex(key)
        const regex = new RegExp(`\\b${escapedKey}\\b`, 'g')
        
        // CRITICAL: Always replace field IDs, even if value is empty/null
        // This prevents "is not defined" errors when field IDs aren't replaced
        // Treat string "null" as null so we never put quoted "null" in expression (avoids re-quoting bug)
        if (value !== undefined && value !== null && value !== 'null') {
          let formattedValue = formatValueForExpression(value)
          
          // Ensure formattedValue is valid - use placeholder, never literal "null" (avoids re-quoting)
          if (!formattedValue || typeof formattedValue !== 'string') {
            formattedValue = NULL_PLACEHOLDER
          }
          
          // CRITICAL SAFETY CHECK: Ensure string values are ALWAYS quoted
          // This prevents "Unexpected identifier" errors like "Unexpected identifier 'Male'"
          if (typeof value === 'string') {
            // Double-check: if formattedValue doesn't start and end with quotes, force quote it
            if (!formattedValue.startsWith('"') || !formattedValue.endsWith('"')) {
              // Force quote it properly with full escaping
              const escaped = String(value)
                .replace(/\\/g, '\\\\')  // Escape backslashes first
                .replace(/"/g, '\\"')   // Escape double quotes
                .replace(/\n/g, '\\n')  // Escape newlines
                .replace(/\r/g, '\\r')  // Escape carriage returns
                .replace(/\t/g, '\\t')  // Escape tabs
              formattedValue = `"${escaped}"`
            }
          }
          
          evalExpression = replaceOutsideDoubleQuotes(evalExpression, regex, () => formattedValue)
        } else {
          // Replace empty/null with placeholder so later label replacement doesn't re-quote "null"
          evalExpression = replaceOutsideDoubleQuotes(evalExpression, regex, NULL_PLACEHOLDER)
        }
      }
    })
    
    // CRITICAL: After replacing known field IDs, check for any remaining field IDs in expression
    // These might be field IDs that weren't in formValues (shouldn't happen if getFormValues is used correctly)
    // But we'll handle them gracefully by replacing with null placeholder
    const remainingFieldIdPattern = /\b(ctrl_\d+_[a-z0-9]+)\b/g
    const remainingFieldIds = [...evalExpression.matchAll(remainingFieldIdPattern)]
    if (remainingFieldIds.length > 0) {
      emitRuleEvalWarning(meta, {
        event: "field_ids_missing_from_formValues",
        ids: remainingFieldIds.map((m) => m[1]),
        hint: "IDs were replaced with null placeholder; rule may not match until getFormValues includes these controls.",
      })
      remainingFieldIds.forEach(match => {
        const fieldId = match[1]
        const escaped = escapeRegex(fieldId)
        const regex = new RegExp(`\\b${escaped}\\b`, 'g')
        evalExpression = replaceOutsideDoubleQuotes(evalExpression, regex, NULL_PLACEHOLDER)
      })
    }
    
    // PRIORITY 2: Replace field labels (e.g., "Gender") - only if not already replaced by ID
    // This is for backward compatibility, but IDs are preferred to avoid duplicate label confusion
    const sortedKeys = Object.keys(formValues)
      .filter(key => key && typeof key === 'string' && !key.startsWith('ctrl_') && !key.startsWith('__STRING_') && key !== NULL_PLACEHOLDER)
      .sort((a, b) => (b?.length || 0) - (a?.length || 0)) // Sort by length descending
    
    sortedKeys.forEach(key => {
      // Never replace a key that appears inside our null placeholder (e.g. "NULL" in __JS_NULL__)
      if (NULL_PLACEHOLDER.indexOf(key) !== -1) {
        return
      }
      // Skip if key appears inside quotes (e.g. "Male") - replacing \bMale\b would corrupt ""Male""
      if (evalExpression.includes(`"${key}"`)) {
        return
      }
      const value = formValues[key]
      const escapedKey = escapeRegex(key)
      const regex = new RegExp(`\\b${escapedKey}\\b`, 'g')
      
      // Only replace if this label hasn't been replaced by an ID already
      // Check if the expression still contains this label
      if (regex.test(evalExpression)) {
        // Treat string "null" as null so we never put quoted "null" in expression (avoids re-quoting bug)
        if (value !== undefined && value !== null && value !== 'null') {
          let formattedValue = formatValueForExpression(value)
          
          // Ensure formattedValue is valid - use placeholder, never literal "null" (avoids re-quoting)
          if (!formattedValue || typeof formattedValue !== 'string') {
            formattedValue = NULL_PLACEHOLDER
          }
          
          // CRITICAL SAFETY CHECK: Ensure string values are ALWAYS quoted
          if (typeof value === 'string') {
            // Double-check: if formattedValue doesn't start and end with quotes, force quote it
            if (!formattedValue.startsWith('"') || !formattedValue.endsWith('"')) {
              // Force quote it properly
              const escaped = String(value)
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"')
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '\\r')
                .replace(/\t/g, '\\t')
              formattedValue = `"${escaped}"`
            }
          }
          
          evalExpression = replaceOutsideDoubleQuotes(evalExpression, regex, () => formattedValue)
        } else {
          evalExpression = replaceOutsideDoubleQuotes(evalExpression, regex, NULL_PLACEHOLDER)
        }
      }
    })
    
    // Also replace field labels from fieldLabels map (for backward compatibility)
    // Skip placeholders when replacing (never replace our null placeholder)
    // Sort by length descending to avoid partial matches
    const sortedFieldLabels = Object.entries(fieldLabels)
      .filter(([fieldId, label]) => label && typeof label === 'string' && !label.startsWith('__STRING_') && label !== NULL_PLACEHOLDER)
      .sort((a, b) => (b[1]?.length || 0) - (a[1]?.length || 0)) // Sort by label length descending
    
    sortedFieldLabels.forEach(([fieldId, label]) => {
      // Skip if label is invalid
      if (!label || typeof label !== 'string') {
        return
      }
      const value = formValues[fieldId] || formValues[label]
      const labelVariants = [...collectRuleLabelMatchKeys(label)].sort(
        (a, b) => String(b).length - String(a).length
      )
      labelVariants.forEach((labelVariant) => {
        if (NULL_PLACEHOLDER.indexOf(labelVariant) !== -1) {
          return
        }
        if (evalExpression.includes(`"${labelVariant}"`)) {
          return
        }
        const escapedLabel = escapeRegex(labelVariant)
        if (!new RegExp(`\\b${escapedLabel}\\b`).test(evalExpression)) {
          return
        }
        const regex = new RegExp(`\\b${escapedLabel}\\b`, 'g')
        if (value !== undefined && value !== null && value !== 'null') {
          const formattedValue = formatValueForExpression(value)
          evalExpression = replaceOutsideDoubleQuotes(evalExpression, regex, () => {
            return formattedValue
          })
        } else {
          evalExpression = replaceOutsideDoubleQuotes(evalExpression, regex, NULL_PLACEHOLDER)
        }
      })
    })
    
    // Final check: if expression still contains field labels that weren't replaced,
    // try to find them in formValues by checking all keys
    // But skip placeholders
    const remainingLabels = evalExpression.match(/\b[A-Z][a-zA-Z0-9\s]+\b/g) || []
    remainingLabels.forEach(label => {
      // Skip if label is invalid
      if (!label || typeof label !== 'string') {
        return
      }
      // Skip if it's a keyword, operator, or placeholder (never replace our null placeholder)
      if (['Today', 'null', 'true', 'false', 'and', 'or', 'not'].includes(label.toLowerCase()) || 
          label.startsWith('__STRING_') || label === NULL_PLACEHOLDER) {
        return
      }
      // CRITICAL: Never replace a label that appears inside our null placeholder (e.g. "NULL" in __JS_NULL__)
      if (NULL_PLACEHOLDER.indexOf(label) !== -1) {
        return
      }
      // Skip if label appears inside quotes (e.g. "Male") - would corrupt ""Male""
      if (evalExpression.includes(`"${label}"`)) {
        return
      }
      // Try to find this label in formValues
      const foundValue = Object.keys(formValues).find(key => 
        key.toLowerCase() === label.toLowerCase() || 
        (typeof formValues[key] === 'string' && formValues[key].toLowerCase() === label.toLowerCase())
      )
      if (foundValue !== undefined) {
        const value = formValues[foundValue]
        const escapedLabel = escapeRegex(label)
        const regex = new RegExp(`\\b${escapedLabel}\\b`, 'g')
        // Treat string "null" as null so we never put quoted "null" in expression (avoids re-quoting bug)
        if (value !== undefined && value !== null && value !== 'null') {
          let formattedValue = formatValueForExpression(value)
          
          // Ensure formattedValue is valid - use placeholder, never literal "null" (avoids re-quoting)
          if (!formattedValue || typeof formattedValue !== 'string') {
            formattedValue = NULL_PLACEHOLDER
          }
          
          // CRITICAL: Ensure string values are ALWAYS quoted
          if (typeof value === 'string') {
            if (!formattedValue.startsWith('"') || !formattedValue.endsWith('"')) {
              const escaped = String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
              formattedValue = `"${escaped}"`
            }
          }
          
          evalExpression = replaceOutsideDoubleQuotes(evalExpression, regex, () => {
            return formattedValue
          })
        }
      }
    })

    // STEP 3: Replace common keywords
    evalExpression = evalExpression.replace(/\bToday\b/g, `new Date('${new Date().toISOString().split('T')[0]}')`)
    
    // STEP 4: Restore string placeholders AFTER all field replacements
    // Restore with proper double-quoting and escape any internal quotes
    // Use a more specific regex to avoid partial matches
    stringPlaceholders.forEach((str, idx) => {
      const escapedContent = String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      // Use word boundaries to ensure we only replace the exact placeholder
      const placeholderRegex = new RegExp(`__STRING_${idx}__`, 'g')
      evalExpression = evalExpression.replace(placeholderRegex, `"${escapedContent}"`)
    })

    // Normalize single = to == so "field=value" is comparison, not assignment (avoids "Invalid left-hand side in assignment")
    // Only replace = when not part of ==, !=, <=, >=, ===, !== (use lookbehind/lookahead to avoid touching those)
    evalExpression = evalExpression.replace(/(?<![=!<>])=(?!=)/g, '==')

    // Auto-quote unquoted comparison literals that include units/range text (e.g. 0-4 mm).
    // Rule authors frequently write dropdown literals without quotes, which is invalid JS.
    evalExpression = replaceOutsideDoubleQuotes(
      evalExpression,
      /(===|!==|==|!=)\s*([0-9]+(?:\s*-\s*[0-9]+)?\s*[A-Za-z][^)\n?:&|]*)/g,
      (match, operator, rhs) => {
        const literal = String(rhs || "").trim()
        if (!literal) return match
        const escaped = literal.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
        return `${operator} "${escaped}"`
      }
    )

    // Protect strict operators before spacing normalization so they never degrade into "== =" / "!= =".
    const STRICT_EQ_PLACEHOLDER = '__OP_STRICT_EQ__'
    const STRICT_NEQ_PLACEHOLDER = '__OP_STRICT_NEQ__'
    evalExpression = evalExpression.replace(/!==/g, STRICT_NEQ_PLACEHOLDER)
    evalExpression = evalExpression.replace(/===/g, STRICT_EQ_PLACEHOLDER)

    // Clean up operator spacing - normalize operators
    // This ensures expressions like "Age>60" or "Age > 60" both work
    evalExpression = evalExpression.replace(/\s*!=(?!=)\s*/g, ' != ')  // Not equal
    evalExpression = evalExpression.replace(/\s*==(?!=)\s*/g, ' == ')  // Equal
    evalExpression = evalExpression.replace(/\s*<=\s*/g, ' <= ') // Less than or equal
    evalExpression = evalExpression.replace(/\s*>=\s*/g, ' >= ') // Greater than or equal
    evalExpression = evalExpression.replace(/\s*<(?!\s*=)\s*/g, ' < ')   // Less than (not part of <=)
    evalExpression = evalExpression.replace(/\s*>(?!\s*=)\s*/g, ' > ')   // Greater than (not part of >=)
    evalExpression = evalExpression.replace(/\s*&&\s*/g, ' && ') // AND
    evalExpression = evalExpression.replace(/\s*\|\|\s*/g, ' || ') // OR
    evalExpression = evalExpression.replace(/\s*\+\s*/g, ' + ')   // Addition
    evalExpression = evalExpression.replace(/\s*-\s*/g, ' - ')    // Subtraction
    evalExpression = evalExpression.replace(/\s*\*\s*/g, ' * ')   // Multiplication
    evalExpression = evalExpression.replace(/\s*\/\s*/g, ' / ')   // Division
    evalExpression = evalExpression.replace(/\s*%\s*/g, ' % ')    // Modulo

    // Restore strict operators after normalization.
    evalExpression = evalExpression.replace(new RegExp(STRICT_EQ_PLACEHOLDER, 'g'), ' === ')
    evalExpression = evalExpression.replace(new RegExp(STRICT_NEQ_PLACEHOLDER, 'g'), ' !== ')

    // Repair common authored-expression syntax issues:
    // - extra closing parenthesis
    // - missing closing parenthesis at end
    // Only touch parentheses outside quoted literals.
    evalExpression = balanceParenthesesOutsideQuotes(evalExpression)

    if (isCrfRuleVerbose()) {
      const forLogExpr = evalExpression.replace(new RegExp(NULL_PLACEHOLDER, "g"), "<null>")
      logCrfRule("log", "rule_expression_built", {
        ruleId: meta?.ruleId,
        source: meta?.source,
        originalExpression: truncateForLog(expression, 400),
        finalExpression: truncateForLog(forLogExpr, 500),
        referencedFormValues: pickRelevantFormValuesForLog(expression, formValues),
        stringLiteralCount: stringPlaceholders.length,
      })
    }
    
    // CRITICAL: Final safety check - detect and fix unquoted string values
    // Look for capitalized words that aren't keywords - these might be unquoted string values
    const unquotedPattern = /\b([A-Z][a-zA-Z0-9]+)\b/g
    // Ignore words inside quoted literals to avoid false positives like "Current Smoker"
    const expressionWithoutQuotedStrings = evalExpression.replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, "")
    const matches = [...expressionWithoutQuotedStrings.matchAll(unquotedPattern)]
    const validKeywords = ['Today', 'null', 'true', 'false', 'NaN', 'Infinity', 'new', 'Date', 'return']
    const suspiciousIdentifiers = matches
      .map(m => m[1])
      .filter(id => 
        id && typeof id === 'string' &&
        !validKeywords.includes(id) && 
        !id.startsWith('__STRING_') &&
        id !== NULL_PLACEHOLDER && // Never replace our null placeholder
        !id.startsWith('ctrl_') && // Field IDs are fine
        !id.match(/^[0-9]/) && // Not a number
        !stringPlaceholders.includes(id) // Never replace string literal content (e.g. "Male")
      )
    
    if (suspiciousIdentifiers.length > 0) {
      emitRuleEvalWarning(meta, {
        event: "potential_unquoted_identifiers",
        identifiers: suspiciousIdentifiers,
        hint: "These tokens may be treated as null/empty if they are not valid JS identifiers for the engine.",
      })
    }

    // CRITICAL: Replace any remaining undefined identifiers with null placeholder to prevent "is not defined" errors
    // (Do NOT auto-quote identifiers here - it double-quotes values that are already quoted from field replacement)
    // This handles cases where field names are used but fields haven't been filled yet
    if (suspiciousIdentifiers && suspiciousIdentifiers.length > 0) {
      suspiciousIdentifiers.forEach(id => {
        // Skip if identifier is already inside quotes (e.g. "Male") - don't replace quoted string literals
        if (evalExpression.includes(`"${id}"`)) {
          return
        }
        // Check if this identifier wasn't already replaced
        if (evalExpression.includes(id)) {
          const escapedId = escapeRegex(id)
          const idRegex = new RegExp(`\\b${escapedId}\\b`, 'g')
          evalExpression = replaceOutsideDoubleQuotes(evalExpression, idRegex, NULL_PLACEHOLDER)
        }
      })
    }

    // Validate expression before evaluation (still using placeholder - no "null" in string yet)
    if (!evalExpression || evalExpression.trim() === '') {
      emitRuleEvalWarning(meta, {
        event: "empty_expression_after_processing",
        originalExpression: truncateForLog(expression, 200),
      })
      emitRuleEvaluated(meta, {
        ruleId: meta?.ruleId,
        ruleName: meta?.ruleName,
        ruleCategory: meta?.ruleCategory,
        source: meta?.source,
        targetFieldIds: meta?.targetFieldIds,
        targetControlId: meta?.targetControlId,
        conditionMet: false,
        path: "empty_after_process",
      })
      return false
    }

    // Safe evaluation - only allow specific operations
    // Note: In production, use a proper expression parser for security
    try {
      // Validate obvious syntax hazards only.
      // Previous heuristic produced false positives for valid quoted strings with apostrophes.
      if (evalExpression.includes("undefined")) {
        emitRuleEvalWarning(meta, {
          event: "expression_contains_undefined_token",
          snippet: truncateForLog(evalExpression, 300),
        })
      }

      // Replace placeholder with a parameter name (never put "null" in string - it gets re-quoted by other logic)
      let finalExpression = evalExpression.replace(new RegExp(escapeRegex(NULL_PLACEHOLDER), 'g'), NULL_PARAM_NAME)

      // Extra safety: if a rule does string operations on empty/null values
      // (e.g. __evalNull__.indexOf("Yes") >= 0), rewrite to operate on "" instead.
      // This prevents crashes before we even reach the try/catch.
      // NOTE: Keep this section disabled for now. The rule expressions are already
      // safely handled by the try/catch blocks below (null member-access errors
      // return false). Avoid rewriting with regex to prevent "Invalid regular expression"
      // runtime issues for certain generated strings.

      // Evaluate with null passed as the parameter - expression never contains literal "null"
      try {
        const result = executeCompiledExpression(finalExpression, null)
        if (Boolean(result)) {
          emitRuleEvaluated(meta, {
            ruleId: meta?.ruleId,
            ruleName: meta?.ruleName,
            ruleCategory: meta?.ruleCategory,
            source: meta?.source,
            targetFieldIds: meta?.targetFieldIds,
            targetControlId: meta?.targetControlId,
            conditionMet: true,
            path: "direct_eval",
            finalExpression: truncateForLog(
              finalExpression.replace(new RegExp(escapeRegex(NULL_PARAM_NAME), "g"), "null"),
              400
            ),
            referencedFormValues: pickRelevantFormValuesForLog(expression, formValues),
          })
          const evalEndMs =
            typeof performance !== "undefined" && performance.now
              ? performance.now()
              : Date.now()
          recordRulePerfMetric(evalEndMs - evalStartMs)
          return true
        }

        // Fallback: if direct evaluation is false, retry once with case-insensitive
        // string literal normalization so rules like `Field == yes` / `"Yes"` both work.
        const ciExpression = finalExpression.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (match, content) => {
          return `"${String(content).toLowerCase()}"`
        })
        if (ciExpression !== finalExpression) {
          const ciResult = executeCompiledExpression(ciExpression, null)
          const ciMet = Boolean(ciResult)
          emitRuleEvaluated(meta, {
            ruleId: meta?.ruleId,
            ruleName: meta?.ruleName,
            ruleCategory: meta?.ruleCategory,
            source: meta?.source,
            targetFieldIds: meta?.targetFieldIds,
            targetControlId: meta?.targetControlId,
            conditionMet: ciMet,
            path: ciMet ? "case_insensitive_match" : "case_insensitive_still_false",
            finalExpression: truncateForLog(
              finalExpression.replace(new RegExp(escapeRegex(NULL_PARAM_NAME), "g"), "null"),
              400
            ),
            referencedFormValues: pickRelevantFormValuesForLog(expression, formValues),
          })
          const evalEndMs =
            typeof performance !== "undefined" && performance.now
              ? performance.now()
              : Date.now()
          recordRulePerfMetric(evalEndMs - evalStartMs)
          return ciMet
        }
        emitRuleEvaluated(meta, {
          ruleId: meta?.ruleId,
          ruleName: meta?.ruleName,
          ruleCategory: meta?.ruleCategory,
          source: meta?.source,
          targetFieldIds: meta?.targetFieldIds,
          targetControlId: meta?.targetControlId,
          conditionMet: false,
          path: "direct_eval_false",
          finalExpression: truncateForLog(
            finalExpression.replace(new RegExp(escapeRegex(NULL_PARAM_NAME), "g"), "null"),
            400
          ),
          referencedFormValues: pickRelevantFormValuesForLog(expression, formValues),
        })
        const evalEndMs =
          typeof performance !== "undefined" && performance.now
            ? performance.now()
            : Date.now()
        recordRulePerfMetric(evalEndMs - evalStartMs)
        return false
      } catch (innerError) {
        // If evaluation fails, extract error message
        const errorMessage = innerError?.message || innerError?.toString() || String(innerError) || null
        cacheInvalidExpression(errorMessage)

        // Handle unquoted yes/no tokens (e.g. Field == yes) by retrying with quoted literals.
        const notDefinedMatch = errorMessage && typeof errorMessage === 'string'
          ? errorMessage.match(/^([A-Za-z_]\w*) is not defined$/)
          : null
        const missingIdentifier = notDefinedMatch?.[1]?.toLowerCase?.()
        if (missingIdentifier === 'yes' || missingIdentifier === 'no') {
          try {
            const withQuotedBooleanText = finalExpression.replace(
              new RegExp(`\\b${missingIdentifier}\\b`, 'g'),
              `"${missingIdentifier}"`
            )
            const retryResult = executeCompiledExpression(withQuotedBooleanText, null)
            if (Boolean(retryResult)) {
              emitRuleEvaluated(meta, {
                ruleId: meta?.ruleId,
                ruleName: meta?.ruleName,
                ruleCategory: meta?.ruleCategory,
                source: meta?.source,
                targetFieldIds: meta?.targetFieldIds,
                targetControlId: meta?.targetControlId,
                conditionMet: true,
                path: "yes_no_unquoted_retry",
                engineMessage: errorMessage,
                referencedFormValues: pickRelevantFormValuesForLog(expression, formValues),
              })
              const evalEndMs =
                typeof performance !== "undefined" && performance.now
                  ? performance.now()
                  : Date.now()
              recordRulePerfMetric(evalEndMs - evalStartMs)
              return true
            }
            const retryCiExpression = withQuotedBooleanText.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (match, content) => {
              return `"${String(content).toLowerCase()}"`
            })
            const retryCiResult = executeCompiledExpression(retryCiExpression, null)
            const retryMet = Boolean(retryCiResult)
            emitRuleEvaluated(meta, {
              ruleId: meta?.ruleId,
              ruleName: meta?.ruleName,
              ruleCategory: meta?.ruleCategory,
              source: meta?.source,
              targetFieldIds: meta?.targetFieldIds,
              targetControlId: meta?.targetControlId,
              conditionMet: retryMet,
              path: retryMet ? "yes_no_unquoted_retry_ci" : "yes_no_unquoted_retry_ci_false",
              engineMessage: errorMessage,
              referencedFormValues: pickRelevantFormValuesForLog(expression, formValues),
            })
            const evalEndMs =
              typeof performance !== "undefined" && performance.now
                ? performance.now()
                : Date.now()
            recordRulePerfMetric(evalEndMs - evalStartMs)
            return retryMet
          } catch (_) {
            // Fall through to existing handling below.
          }
        }
        
        // Suppress "is not defined" errors - these are expected when fields aren't filled yet
        if (
          errorMessage &&
          typeof errorMessage === "string" &&
          (errorMessage.includes("is not defined") || errorMessage.includes("is not a function"))
        ) {
          emitRuleEvaluated(meta, {
            ruleId: meta?.ruleId,
            ruleName: meta?.ruleName,
            ruleCategory: meta?.ruleCategory,
            source: meta?.source,
            targetFieldIds: meta?.targetFieldIds,
            targetControlId: meta?.targetControlId,
            conditionMet: false,
            path: "eval_error_treated_as_false",
            engineMessage: errorMessage,
            finalExpression: truncateForLog(
              finalExpression.replace(new RegExp(escapeRegex(NULL_PARAM_NAME), "g"), "null"),
              400
            ),
            referencedFormValues: pickRelevantFormValuesForLog(expression, formValues),
            hint:
              "Expression threw before a boolean result; treated as condition not met. Fix typo, quoting, or field IDs.",
          })
          const evalEndMs =
            typeof performance !== "undefined" && performance.now
              ? performance.now()
              : Date.now()
          recordRulePerfMetric(evalEndMs - evalStartMs)
          return false
        }

        // Null/undefined member access in dynamic rules is expected when source fields are empty.
        // Examples:
        // - null.indexOf("Yes") >= 0
        // - Cannot read properties of null (reading 'indexOf')
        if (
          errorMessage &&
          typeof errorMessage === "string" &&
          (
            errorMessage.includes("Cannot read properties of null") ||
            errorMessage.includes("Cannot read properties of undefined") ||
            errorMessage.includes("Cannot convert undefined or null to object")
          )
        ) {
          emitRuleEvaluated(meta, {
            ruleId: meta?.ruleId,
            ruleName: meta?.ruleName,
            ruleCategory: meta?.ruleCategory,
            source: meta?.source,
            targetFieldIds: meta?.targetFieldIds,
            targetControlId: meta?.targetControlId,
            conditionMet: false,
            path: "nullish_member_access_treated_as_false",
            engineMessage: errorMessage,
            finalExpression: truncateForLog(
              finalExpression.replace(new RegExp(escapeRegex(NULL_PARAM_NAME), "g"), "null"),
              400
            ),
            referencedFormValues: pickRelevantFormValuesForLog(expression, formValues),
            hint:
              "A value was null/empty while the expression called a method on it. Rule is treated as not met.",
          })
          const evalEndMs =
            typeof performance !== "undefined" && performance.now
              ? performance.now()
              : Date.now()
          recordRulePerfMetric(evalEndMs - evalStartMs)
          return false
        }
        
        // Collect valid error information for other types of errors
        const errorParts = []
        if (errorMessage && errorMessage !== 'Unknown error' && typeof errorMessage === 'string' && errorMessage.trim() !== '') {
          errorParts.push(`Error: ${errorMessage}`)
        }
        if (finalExpression && typeof finalExpression === 'string' && finalExpression.trim() !== '') {
          const forDisplay = finalExpression.replace(new RegExp(escapeRegex(NULL_PARAM_NAME), 'g'), 'null')
          errorParts.push(`Expression: ${forDisplay}`)
        }
        if (expression && typeof expression === 'string' && expression.trim() !== '') {
          errorParts.push(`Original: ${expression}`)
        }
        
        // Only log if we have at least one meaningful error detail (and it's not a suppressed error)
        if (errorParts.length > 0) {
          // Recoverable rule-eval failures should not surface as hard console errors in dev overlay.
          logCrfRule("warn", "expression_evaluation_failed", {
            ruleId: meta?.ruleId,
            source: meta?.source,
            detail: errorParts.join(" | "),
          })
        }
        // If no valid info, silently continue - error will be caught by outer catch blocks
        
        throw innerError // Re-throw to be caught by outer catch
      }
    } catch (evalError) {
      const errorMessage = evalError?.message || evalError?.toString() || String(evalError) || 'Unknown evaluation error'
      cacheInvalidExpression(errorMessage)
      // For null/undefined property reads, treat as unmet condition (expected for empty fields).
      if (
        errorMessage &&
        typeof errorMessage === 'string' &&
        (
          errorMessage.includes("Cannot read properties of null") ||
          errorMessage.includes("Cannot read properties of undefined") ||
          errorMessage.includes("Cannot convert undefined or null to object")
        )
      ) {
        emitRuleEvaluated(meta, {
          ruleId: meta?.ruleId,
          ruleName: meta?.ruleName,
          ruleCategory: meta?.ruleCategory,
          source: meta?.source,
          targetFieldIds: meta?.targetFieldIds,
          targetControlId: meta?.targetControlId,
          conditionMet: false,
          path: "outer_catch_nullish_treated_as_false",
          engineMessage: errorMessage,
          referencedFormValues: pickRelevantFormValuesForLog(expression, formValues),
        })
        return false
      }
      // Only log if we have meaningful error information
      if (errorMessage !== "Unknown evaluation error" || expression) {
        const displayedExpr = evalExpression
          .replace(new RegExp(escapeRegex(NULL_PLACEHOLDER), "g"), NULL_PARAM_NAME)
          .replace(new RegExp(escapeRegex(NULL_PARAM_NAME), "g"), "null")
        // Rule eval fallback path returns false; keep as warning to avoid noisy false-positive console errors.
        logCrfRule("warn", "expression_eval_outer_error", {
          ruleId: meta?.ruleId,
          source: meta?.source,
          engineMessage: errorMessage,
          originalExpression: truncateForLog(expression, 300),
          processedExpression: truncateForLog(displayedExpr, 400),
          referencedFormValues: pickRelevantFormValuesForLog(expression, formValues),
          error: String(evalError),
        })
      }
      // Return false on evaluation error (rule condition not met)
      emitRuleEvaluated(meta, {
        ruleId: meta?.ruleId,
        ruleName: meta?.ruleName,
        ruleCategory: meta?.ruleCategory,
        source: meta?.source,
        targetFieldIds: meta?.targetFieldIds,
        targetControlId: meta?.targetControlId,
        conditionMet: false,
        path: "outer_eval_error",
        engineMessage: errorMessage,
        referencedFormValues: pickRelevantFormValuesForLog(expression, formValues),
      })
      const evalEndMs =
        typeof performance !== "undefined" && performance.now
          ? performance.now()
          : Date.now()
      recordRulePerfMetric(evalEndMs - evalStartMs)
      return false
    }
  } catch (error) {
    const errorMessage = error?.message || error?.toString() || String(error) || 'Unknown error'
    cacheInvalidExpression(errorMessage)
    // Only log if we have meaningful error information
    if (errorMessage !== "Unknown error" || expression) {
      // Top-level catch is also non-blocking for UI behavior (rule treated as unmet).
      logCrfRule("warn", "rule_eval_top_level_error", {
        ruleId: meta?.ruleId,
        source: meta?.source,
        engineMessage: errorMessage,
        expression: truncateForLog(expression, 300),
        referencedFormValues: pickRelevantFormValuesForLog(expression, formValues),
      })
    }
    const evalEndMs =
      typeof performance !== "undefined" && performance.now
        ? performance.now()
        : Date.now()
    recordRulePerfMetric(evalEndMs - evalStartMs)
    return false
  }
}

/**
 * Format a value for use in expression evaluation
 * Handles ALL data types: numbers, strings, booleans, dates, null, undefined
 */
const formatValueForExpression = (value) => {
  // Normalize object-shaped option values (e.g. { value: "Yes", label: "Yes" })
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (Object.prototype.hasOwnProperty.call(value, 'value') || Object.prototype.hasOwnProperty.call(value, 'label')) {
      value = value.value ?? value.label ?? null
    }
  }

  // Handle null and undefined
  if (value === null || value === undefined) {
    return 'null'
  }
  
  // Handle numbers (including 0, negative numbers, decimals)
  if (typeof value === 'number') {
    // Check for NaN or Infinity
    if (isNaN(value)) return 'NaN'
    if (!isFinite(value)) return value > 0 ? 'Infinity' : '-Infinity'
    return value.toString()
  }
  
  // Handle booleans
  if (typeof value === 'boolean') {
    return value.toString()
  }
  
  // Handle Date objects
  if (value instanceof Date) {
    // Return as ISO string for date comparisons
    return `new Date('${value.toISOString()}')`
  }
  
  // Handle string values - wrap in quotes and escape internal quotes
  if (typeof value === 'string') {
    // Empty string should be compared as empty string
    if (value === '') {
      return '""'
    }
    // CRITICAL: Always wrap strings in quotes and escape internal quotes
    // This ensures "Male" becomes '"Male"' not 'Male'
    const escaped = value
      .replace(/\\/g, '\\\\')  // Escape backslashes first
      .replace(/"/g, '\\"')   // Escape double quotes
      .replace(/\n/g, '\\n')  // Escape newlines
      .replace(/\r/g, '\\r')  // Escape carriage returns
      .replace(/\t/g, '\\t')  // Escape tabs
    return `"${escaped}"`
  }
  
  // Handle arrays (for multi-select fields)
  if (Array.isArray(value)) {
    // Convert array to string representation
    return JSON.stringify(value)
  }
  
  // Handle objects (fallback)
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch (e) {
      return 'null'
    }
  }
  
  // Fallback: convert to string
  return `"${String(value).replace(/"/g, '\\"')}"`
}

/**
 * Escape special regex characters
 */
const escapeRegex = (str) => {
  if (!str || typeof str !== 'string') {
    return ''
  }
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Replace matches only when they are outside double-quoted string literals.
 * Prevents corrupting literal content like "Yes – within 48 hrs".
 */
const replaceOutsideDoubleQuotes = (input, regex, replacement) => {
  if (!input || !regex) return input
  const source = String(input)
  const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`
  const globalRegex = new RegExp(regex.source, flags)
  const isFn = typeof replacement === 'function'
  let out = ''
  let last = 0
  let m
  while ((m = globalRegex.exec(source)) !== null) {
    const idx = m.index
    // Count unescaped double quotes before this match.
    let quoteCount = 0
    for (let i = 0; i < idx; i++) {
      if (source[i] === '"' && source[i - 1] !== '\\') quoteCount++
    }
    const insideQuotes = quoteCount % 2 === 1
    if (insideQuotes) continue
    out += source.slice(last, idx)
    out += isFn ? replacement(...m, idx, source) : replacement
    last = idx + m[0].length
  }
  return out ? out + source.slice(last) : source
}

/**
 * Balance parentheses outside double-quoted string literals.
 * Removes unmatched ')' and appends missing ')' at the end.
 */
const balanceParenthesesOutsideQuotes = (input) => {
  if (!input || typeof input !== 'string') return input
  let inQuotes = false
  let openCount = 0
  let out = ''

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    const prev = i > 0 ? input[i - 1] : ''

    if (ch === '"' && prev !== '\\') {
      inQuotes = !inQuotes
      out += ch
      continue
    }

    if (!inQuotes && ch === '(') {
      openCount++
      out += ch
      continue
    }

    if (!inQuotes && ch === ')') {
      if (openCount > 0) {
        openCount--
        out += ch
      }
      continue
    }

    out += ch
  }

  if (openCount > 0) {
    out += ')'.repeat(openCount)
  }

  return out
}

/**
 * True when the expression references dynamic table cell ids that use this
 * control id as a prefix (`${id}_row_N_col_M`). In that case the parent table
 * control must NOT be treated as the "trigger" for enable/disable — otherwise
 * `expression.includes(tableId)` is always true and readonly would stay false.
 * @param {string} expression
 * @param {string} controlId
 */
function expressionUsesTableCellIdsPrefixedByControl(expression, controlId) {
  if (!expression || !controlId) return false
  const esc = String(controlId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  try {
    return new RegExp(`${esc}_row_\\d+_col_\\d+`).test(String(expression))
  } catch {
    return false
  }
}

/** Whole-token match — avoids `col_1` matching inside `col_10`. */
export function expressionReferencesControlId(expression, controlId) {
  if (!expression || !controlId) return false
  const esc = String(controlId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  try {
    return new RegExp(`\\b${esc}\\b`).test(String(expression))
  } catch {
    return String(expression).includes(String(controlId))
  }
}

/**
 * Apply rule actions to a control
 * Generic function that works for ALL rule categories and ALL conditions
 * Supports: show, hide, disable, enable, compute, validation, submit, retro
 * @param {Object} rule - Rule object with category and action
 * @param {Object} control - Control to apply rule to
 * @param {boolean} conditionMet - Whether the rule condition is met
 * @returns {Object} - Updated control properties
 */
export const applyRuleAction = (rule, control, conditionMet) => {
  const updatedProps = { ...control.properties }
  
  // Normalize rule category to lowercase for case-insensitive matching
  // API might return "Hide", "Show", "Disable" etc., but code expects lowercase
  const category = normalizeRuleCategory(rule.ruleCategory ?? rule.category ?? rule.Category)
  // Date restriction rules are persisted as API category "Validation" with a marker
  // message; they must not flip conditionallyRequired (red asterisk) in data entry.
  const effectiveCategory =
    category === "validation" && isDateRestrictionRule(rule) ? "date_restriction" : category

  switch (effectiveCategory) {
    case 'show':
      // Show field when condition is met
      updatedProps.hidden = !conditionMet
      break
    case 'hide':
      // Hide field when condition is met
      updatedProps.hidden = conditionMet
      break
    case 'disable':
      // Disable field when condition is met. Never disable the "trigger" control so user can change it.
      const disableExpression = (rule.ruleExpression || rule.expression || '').trim()
      const isTableControl = String(control?.type || '').toLowerCase() === 'table'
      const expressionTargetsTableCells = expressionUsesTableCellIdsPrefixedByControl(disableExpression, control.id)
      // Table expressions with row/col targets should not set readonly on the whole table.
      // Those are handled separately via cell-level overrides in eCRF data entry.
      if (isTableControl && expressionTargetsTableCells) {
        break
      }
      const isTriggerForDisable =
        control.id &&
        expressionReferencesControlId(disableExpression, control.id) &&
        !expressionTargetsTableCells
      if (isTriggerForDisable) {
        updatedProps.readonly = false
      } else {
        updatedProps.readonly = conditionMet
      }
      break
    case 'enable':
      // Enable field when condition met; disable when not. Never disable the "trigger" control
      // (the one whose value is in the expression) so the user can always change it (e.g. eligibility dropdown).
      const enableExpression = (rule.ruleExpression || rule.expression || '').trim()
      const isEnableTableControl = String(control?.type || '').toLowerCase() === 'table'
      const enableExprTargetsTableCells = expressionUsesTableCellIdsPrefixedByControl(enableExpression, control.id)
      if (isEnableTableControl && enableExprTargetsTableCells) {
        break
      }
      const isTriggerControl =
        control.id &&
        expressionReferencesControlId(enableExpression, control.id) &&
        !enableExprTargetsTableCells
      try {
        if (
          typeof window !== "undefined" &&
          window.localStorage?.getItem("crfRulesDebug") === "1" &&
          control.id &&
          expressionReferencesControlId(enableExpression, control.id) &&
          !isTriggerControl
        ) {
          logCrfRule("log", "enable_trigger_not_parent_table", {
            ruleId: rule.id,
            controlId: control.id,
            controlType: control.type,
            hint:
              "Cell ids share the table control id prefix; table is not treated as the enable/disable trigger.",
          })
        }
      } catch {
        /* ignore */
      }
      if (isTriggerControl) {
        updatedProps.readonly = false
      } else {
        updatedProps.readonly = !conditionMet
      }
      break
    case 'compute':
      // Compute value when condition is met
      if (conditionMet) {
        // Store computed value (can be enhanced to evaluate expression)
        updatedProps.computedValue = rule.ruleExpression || rule.expression
        updatedProps.isComputed = true
      } else {
        updatedProps.isComputed = false
      }
      break
    case 'date_restriction':
      // Date bounds are derived centrally from rule expressions in data-entry flow.
      // No per-control toggle side-effect is needed here.
      break
    case 'validation':
      // Validation rules - make field conditionally required or show validation message
      if (conditionMet && rule.message) {
        updatedProps.conditionallyRequired = true
        updatedProps.requiredIfCondition = rule.ruleExpression || rule.expression
        updatedProps.requiredIfMessage = sanitizeCrfRuleMessage(rule.message)
      } else {
        updatedProps.conditionallyRequired = false
      }
      break
    case 'submit':
    case 'retro':
      // These are typically handled at form submission level
      // Store rule info for submission-time evaluation
      updatedProps.submitRule = conditionMet ? rule : null
      break
    default:
      // Unknown category — always warn (small volume; real config issue).
      logCrfRule("warn", "unknown_rule_category", {
        category: rule.ruleCategory || rule.category,
        ruleId: rule.id,
        ruleName: rule.ruleName || rule.name,
      })
      break
  }

  if (isDesignerReadonly(control.properties)) {
    updatedProps.readonly = true
  }

  return updatedProps
}

/**
 * Restrictive control properties (compose by OR-of-true across rules).
 *
 * Standard EDC semantics: if ANY rule's evaluated outcome asserts `true`
 * for one of these properties, the property is `true` for the merged
 * control — regardless of rule order, priority, or how many other rules
 * emitted `false`. A non-firing rule must NEVER lower the bar.
 *
 * Non-restrictive properties (label, color, computedValue, etc.) keep
 * shallow last-write-wins so rule authors' explicit intent on those keys
 * is honored.
 */
export const RESTRICTIVE_RULE_PROPERTIES = ["readonly", "hidden", "conditionallyRequired"]

/**
 * Merge one rule's evaluated output (`ruleProps`) onto the running
 * cross-rule accumulator (`baseProps`) using:
 *   - Restrictive keys (RESTRICTIVE_RULE_PROPERTIES) → OR-of-true (any
 *     `true` sticks; `false` never clobbers another rule's `true`)
 *   - All other keys → last-write-wins (shallow spread, today's behavior)
 *
 * Why this exists:
 * `applyRuleAction` always returns a clone of `control.properties` with
 * the action applied. For non-firing rules (conditionMet=false), it still
 * emits `readonly: false` / `hidden: false` / `conditionallyRequired: false`
 * — those are SIDE EFFECTS of the action shape, not designer assertions.
 * The previous shallow-spread merge treated them as assertions and
 * silently overrode firing rules' `true` values when two rules targeted
 * the same field ("Also applies to" overlap). This helper fixes that by
 * OR-merging only the restrictive booleans.
 *
 * @param {Record<string, any>} baseProps
 * @param {Record<string, any>} ruleProps
 * @returns {Record<string, any>} merged props
 */
/**
 * Merge one restrictive boolean (readonly / hidden / conditionallyRequired).
 * Disable/Hide/Validation use OR-of-true (any lock sticks).
 * Enable/Show use the rule's explicit value so conditionMet=true can clear
 * readonly/hidden — otherwise Enable never unlocks after a false pass.
 */
export function mergeRestrictiveBooleanProp(baseVal, ruleVal, { ruleCategory, propKey } = {}) {
  const baseIsBool = typeof baseVal === "boolean"
  const ruleIsBool = typeof ruleVal === "boolean"
  if (!baseIsBool && !ruleIsBool) return baseVal
  const category = normalizeRuleCategory(ruleCategory || "")
  const isPermissiveCategory = category === "enable" || category === "show"
  if (
    isPermissiveCategory &&
    ruleIsBool &&
    (propKey === "readonly" || propKey === "hidden")
  ) {
    return ruleVal
  }
  return Boolean(baseVal) || Boolean(ruleVal)
}

export function mergeRulePropsRestrictively(baseProps, ruleProps, options = {}) {
  const safeBase = baseProps && typeof baseProps === "object" ? baseProps : {}
  const safeRule = ruleProps && typeof ruleProps === "object" ? ruleProps : {}
  const ruleCategory =
    options?.ruleCategory ??
    options?.category ??
    ruleProps?.__ruleCategory ??
    safeRule?.__ruleCategory
  // 1. Shallow merge handles every non-restrictive key (last-write-wins).
  const out = { ...safeBase, ...safeRule }
  delete out.__ruleCategory
  // 2. Re-resolve restrictive keys — permissive categories may clear locks.
  for (const key of RESTRICTIVE_RULE_PROPERTIES) {
    const baseVal = safeBase[key]
    const ruleVal = safeRule[key]
    const baseIsBool = typeof baseVal === "boolean"
    const ruleIsBool = typeof ruleVal === "boolean"
    if (!baseIsBool && !ruleIsBool) continue
    out[key] = mergeRestrictiveBooleanProp(baseVal, ruleVal, { ruleCategory, propKey: key })
  }
  return out
}

/**
 * Get all field values from a form section
 * @param {Array} controls - Array of control objects
 * @param {Object} formData - Current form data state
 * @returns {Object} - Map of field IDs to values (and labels for rule evaluation)
 */
/**
 * Get all field values from a form section
 * Generic function that works for ALL field types (text, number, date, select, checkbox, etc.)
 * @param {Array} controls - Array of control objects
 * @param {Object} formData - Current form data state
 * @returns {Object} - Map of field IDs to values (and labels for rule evaluation)
 */
export const getFormValues = (controls, formData = {}, options = {}) => {
  const useControlDefaults = options?.useControlDefaults !== false
  const values = {}
  const flatFormData = formData && typeof formData === 'object' ? formData : {}
  const isOptionLikeType = (rawType) => {
    const token = String(rawType || "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]/g, "")
    return (
      token === "select" ||
      token === "dropdown" ||
      token === "combobox" ||
      token === "searchableselect" ||
      token === "radio" ||
      token === "radiobutton" ||
      token === "optionlist" ||
      token === "optionbutton"
    )
  }
  controls.forEach(control => {
    const fieldId = control.id
    const fieldLabel = control.label || control.properties?.labelText
    const controlType = control.type || control.properties?.controlType || 'text'
    const controlTypeLc = String(controlType || '').toLowerCase()
    
    // Get value from formData or use default value
    let value = formData[fieldId]
    
    // If no value in formData, optionally fall back to control default.
    // In eCRF data entry runtime we disable this fallback so rules reflect
    // exactly what the user currently sees/selected.
    if (useControlDefaults && (value === undefined || value === null || value === '')) {
      value = control.properties?.defaultValue
    }
    
    // Handle different control types
    if (value === undefined || value === null || value === '') {
      // Set appropriate empty value based on control type
      if (controlTypeLc === 'number' || controlTypeLc === 'numberfield') {
        value = null // Numbers should be null, not empty string
      } else if (controlTypeLc === 'date' || controlTypeLc === 'datefield' || controlTypeLc === 'datepicker' || controlTypeLc.includes('date')) {
        // Keep empty dates as empty string so rules like `Date field != ""`
        // behave consistently (instead of `null != ""` => true).
        value = ''
      } else if (controlTypeLc === 'checkbox' || controlTypeLc === 'checkboxfield') {
        value = false // Checkboxes default to false
      } else {
        value = '' // Text fields default to empty string
      }
    }
    
    // Normalize object-shaped values before type conversion.
    // Some renderers provide { value, label } for option controls.
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (Object.prototype.hasOwnProperty.call(value, 'value') || Object.prototype.hasOwnProperty.call(value, 'label')) {
        value = value.value ?? value.label ?? ''
      }
    }

    // Convert value to appropriate type for evaluation
    if (controlTypeLc === 'number' || controlTypeLc === 'numberfield') {
      // Ensure numbers are actual numbers, not strings
      const numValue = parseFloat(value)
      value = isNaN(numValue) ? null : numValue
    } else if (controlTypeLc === 'date' || controlTypeLc === 'datefield' || controlTypeLc === 'datepicker' || controlTypeLc.includes('date')) {
      // Convert date strings to Date objects if needed
      if (typeof value === 'string' && value) {
        const dateValue = new Date(value)
        value = isNaN(dateValue.getTime()) ? null : dateValue
      }
    } else if (controlTypeLc === 'checkbox' || controlTypeLc === 'checkboxfield') {
      // Checkbox group (multiple options) stores comma-separated string e.g. "Face,Other"; keep as string so rules can use .indexOf("Other") >= 0
      if (typeof value === 'string' && value.length > 0) {
        value = value
          .split(',')
          .map((s) => String(s).trim())
          .filter(Boolean)
          .join(',')
      } else {
        value = Boolean(value)
      }
    } else if (isOptionLikeType(controlType) || isOptionLikeType(controlTypeLc)) {
      if (value == null) {
        value = ''
      } else if (typeof value !== 'string') {
        value = normalizeBooleanLikeOptionValue(String(value))
      } else {
        value = normalizeBooleanLikeOptionValue(value)
      }
    }
    
    // Store by field ID
    values[fieldId] = value
    
    // Also store by label (and common aliases) for rule expression evaluation
    if (fieldLabel) {
      collectRuleLabelMatchKeys(fieldLabel).forEach((key) => {
        values[key] = value
      })
    }

    // Include dynamic/static table cell values so expressions using
    // ctrl_xxx_row_N_col_M can resolve correctly during rule evaluation.
    if (String(controlType || control.type || '').toLowerCase() === 'table') {
      const escapedFieldId = escapeRegex(fieldId)
      const tableCellPattern = new RegExp(`^${escapedFieldId}_row_\\d+_col_\\d+$`)
      const columnCount = Math.max(1, parseInt(control.properties?.columns, 10) || 1)
      const designRows = Math.max(1, parseInt(control.properties?.rows, 10) || 1)
      const columnTypes = Array.isArray(control.properties?.columnTypes) ? control.properties.columnTypes : []
      const rowCountKey = `${fieldId}_rowCount`
      const addRowEnabled = Boolean(control.properties?.addRow)
      const dynamicRowsFromData = parseInt(flatFormData[rowCountKey], 10)
      const totalRows =
        addRowEnabled && Number.isFinite(dynamicRowsFromData) && dynamicRowsFromData > 0
          ? Math.max(designRows, dynamicRowsFromData)
          : designRows

      // Seed every visible row/column cell key to ensure row-specific rule expressions
      // always find a key in formValues, even before user enters data.
      for (let rowIdx = 0; rowIdx < totalRows; rowIdx++) {
        for (let colIdx = 0; colIdx < columnCount; colIdx++) {
          const cellKey = `${fieldId}_row_${rowIdx}_col_${colIdx}`
          if (!Object.prototype.hasOwnProperty.call(values, cellKey)) {
            values[cellKey] = ''
          }
        }
      }

      Object.keys(flatFormData).forEach((dataKey) => {
        if (!tableCellPattern.test(dataKey)) return
        let cellValue = flatFormData[dataKey]
        const cellMatch = dataKey.match(/_row_(\d+)_col_(\d+)$/)
        const colIdx = cellMatch ? Number.parseInt(cellMatch[2] || "-1", 10) : -1
        const columnType = colIdx >= 0 ? columnTypes[colIdx] : ""
        if (cellValue && typeof cellValue === 'object' && !Array.isArray(cellValue)) {
          if (Object.prototype.hasOwnProperty.call(cellValue, 'value') || Object.prototype.hasOwnProperty.call(cellValue, 'label')) {
            cellValue = cellValue.value ?? cellValue.label ?? ''
          }
        }
        if (isOptionLikeType(columnType)) {
          cellValue = normalizeBooleanLikeOptionValue(cellValue)
        }
        values[dataKey] = cellValue
      })
    }
  })
  return values
}

/**
 * Replace field IDs in a message/expression string with human-readable field labels
 * Used for displaying validation messages (e.g. "Gender == \"Male\"" instead of "ctrl_1769166186766_y82i1z136 == \"Male\"")
 * @param {string} message - The message or expression containing field IDs
 * @param {Object} fieldLabelMap - Map of field IDs to labels (from createFieldLabelMap)
 * @returns {string} - Message with field IDs replaced by labels
 */
/** Human-readable rule token: `Field label (ctrl_id)` for designer expressions. */
export const formatRuleFieldDisplayToken = (label, fieldId) => {
  const name = String(label || "").trim()
  const id = String(fieldId || "").trim()
  if (!id) return name
  if (!name || name === id) return id
  return `${name} (${id})`
}

export const replaceFieldIdsWithLabels = (message, fieldLabelMap = {}) => {
  if (!message || typeof message !== 'string') return message
  let result = sanitizeCrfRuleMessage(message)
  // Sort IDs by length descending so longer IDs are replaced first (avoids partial matches)
  const ids = Object.keys(fieldLabelMap).filter(id => id && id.startsWith('ctrl_'))
  const sortedIds = [...ids].sort((a, b) => (b?.length || 0) - (a?.length || 0))
  sortedIds.forEach(fieldId => {
    const label = fieldLabelMap[fieldId]
    if (!label) return
    const displayToken = formatRuleFieldDisplayToken(label, fieldId)
    const escapedId = escapeRegex(fieldId)
    const regex = new RegExp(`\\b${escapedId}\\b`, 'g')
    result = result.replace(regex, displayToken)
  })
  return result
}

/**
 * Create a field label map for rule evaluation
 * @param {Array} controls - Array of control objects
 * @returns {Object} - Map of field IDs to labels
 */
export const createFieldLabelMap = (controls) => {
  const labelMap = {}
  controls.forEach(control => {
    const fieldId = control.id
    const fieldLabel = control.label || control.properties?.labelText
    if (fieldLabel) {
      labelMap[fieldId] = fieldLabel
    }
  })
  return labelMap
}

/**
 * Create a map from field label to control ID (first occurrence wins for duplicate labels).
 * Used when converting a display expression (with labels) back to API form (with IDs).
 * @param {Array} controls - Array of control objects
 * @returns {Object} - Map of labels to field IDs
 */
export const createLabelToIdMap = (controls) => {
  const labelToId = {}
  const idToLabel = createFieldLabelMap(controls)
  Object.entries(idToLabel).forEach(([id, label]) => {
    if (!label) return
    const normalized = normalizeRuleTypography(String(label)).trim()
    if (!normalized) return
    const withoutTrailStars = normalized.replace(/\s*\*+\s*$/u, "").trim()
    // Required-marker labels ("Height *") map to bare "Height" for save only.
    // Do not register "Height *" — replaceLabelsWithIds would eat the * in "Height * Height".
    const saveKey =
      withoutTrailStars && withoutTrailStars !== normalized ? withoutTrailStars : normalized
    if (saveKey && !labelToId[saveKey]) labelToId[saveKey] = id
  })
  return labelToId
}

/**
 * Replace field labels in an expression with their control IDs.
 * Used when saving a rule so the API receives IDs (e.g. ctrl_xxx) not display labels.
 * @param {string} expression - Expression string that may contain field labels
 * @param {Object} labelToIdMap - Map of labels to IDs (from createLabelToIdMap)
 * @returns {string} - Expression with labels replaced by IDs
 */
export const escapeRuleLabelForRegExp = (label) =>
  String(label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** Labels that are unsafe as plain tokens (e.g. "1", "2") — digits also appear inside ctrl_* ids. */
export const isAmbiguousRuleFieldLabel = (label) => {
  const text = String(label || "").trim()
  if (!text) return true
  if (/^\d+$/.test(text)) return true
  if (text.length <= 2) return true
  return false
}

const ruleLabelTokenRegex = (label) => {
  const escaped = escapeRuleLabelForRegExp(normalizeRuleTypography(String(label)))
  if (!escaped) return null
  return new RegExp(`(^|[^A-Za-z0-9_])(${escaped})(?=[^A-Za-z0-9_]|$)`, "g")
}

/**
 * Labels still present as whole tokens in an expression (not replaced by ctrl_* ids).
 */
export const findUnresolvedRuleLabelTokens = (expression, labelToIdMap = {}) => {
  const normalized = normalizeRuleTypography(String(expression || ""))
  if (!normalized.trim()) return []
  const withoutQuotedLiterals = normalized.replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, '""')
  return Object.keys(labelToIdMap).filter((label) => {
    const normalizedLabel = normalizeRuleTypography(String(label)).trim()
    if (!normalizedLabel) return false
    const re = ruleLabelTokenRegex(normalizedLabel)
    if (!re) return false
    return re.test(withoutQuotedLiterals)
  })
}

const RULE_EXPRESSION_OPERATORS = [
  "===",
  "!==",
  ">=",
  "<=",
  "&&",
  "||",
  "==",
  "!=",
  ">",
  "<",
  "+",
  "-",
  "*",
  "/",
  "(",
  ")",
]

/** Build ctrl_id → { label, type } from designer controls (incl. expanded table cell controls). */
export const buildRuleFieldMetaById = (controls = []) => {
  const map = {}
  ;(Array.isArray(controls) ? controls : []).forEach((control) => {
    if (!control?.id) return
    const id = String(control.id)
    map[id] = {
      label: control.properties?.labelText || control.label || id,
      type: control.type,
    }
  })
  return map
}

const buildRuleExpressionKnownTokens = (fieldMetaById = {}) => {
  const seen = new Set()
  const tokens = []
  const addToken = (text, fieldId, label, controlType) => {
    const key = String(text || "").trim()
    if (!key || seen.has(key)) return
    seen.add(key)
    tokens.push({
      kind: "field",
      text: key,
      fieldId,
      label,
      controlType,
    })
  }

  Object.entries(fieldMetaById || {}).forEach(([fieldId, meta]) => {
    const id = String(fieldId || "").trim()
    if (!id) return
    const label = String(meta?.label || id).trim()
    addToken(formatRuleFieldDisplayToken(label, id), id, label, meta?.type)
    addToken(id, id, label, meta?.type)
  })

  return tokens.sort((a, b) => b.text.length - a.text.length)
}

const serializeRuleLiteralToken = (value) => serializeRuleLiteralForApi(value)

export const serializeRuleExpressionParts = (parts = []) => {
  if (!Array.isArray(parts) || parts.length === 0) return ""
  return parts
    .map((part) => {
      if (part?.kind === "field") {
        const fieldId = String(part.fieldId || "").trim()
        const label = String(part.label || fieldId).trim()
        return formatRuleFieldDisplayToken(label, fieldId)
      }
      if (part?.kind === "operator") return String(part.value || "").trim()
      if (part?.kind === "literal") return serializeRuleLiteralToken(part.value)
      return ""
    })
    .filter(Boolean)
    .join(" ")
}

export const parseRuleExpressionToParts = (expression, fieldMetaById = {}) => {
  const text = normalizeRuleExpressionLiterals(
    normalizeRuleTypography(String(expression || ""))
  ).trim()
  if (!text) return []
  const parts = []
  let index = 0
  const knownFieldTokens = buildRuleExpressionKnownTokens(fieldMetaById)

  while (index < text.length) {
    while (text[index] === " ") index += 1
    if (index >= text.length) break

    let matchedField = null
    for (const token of knownFieldTokens) {
      if (!text.slice(index).startsWith(token.text)) continue
      const nextChar = text[index + token.text.length]
      if (nextChar !== undefined && nextChar !== " ") continue
      matchedField = token
      break
    }
    if (matchedField) {
      parts.push({
        kind: "field",
        fieldId: matchedField.fieldId,
        label: matchedField.label,
        controlType: matchedField.controlType,
      })
      index += matchedField.text.length
      continue
    }

    let matchedOperator = ""
    for (const op of RULE_EXPRESSION_OPERATORS) {
      if (text.slice(index, index + op.length) === op) {
        matchedOperator = op
        break
      }
    }
    if (matchedOperator) {
      parts.push({ kind: "operator", value: matchedOperator })
      index += matchedOperator.length
      continue
    }

    const quotedMatch = text.slice(index).match(/^"((?:\\.|[^"\\])*)"/)
    if (quotedMatch) {
      const unescaped = quotedMatch[1].replace(/\\(.)/g, "$1")
      parts.push({ kind: "literal", value: sanitizeRuleLiteralPartValue(unescaped) })
      index += quotedMatch[0].length
      continue
    }

    const bareLiteralMatch = text.slice(index).match(/^([A-Za-z0-9._]+)/)
    if (bareLiteralMatch) {
      parts.push({
        kind: "literal",
        value: sanitizeRuleLiteralPartValue(bareLiteralMatch[1]),
      })
      index += bareLiteralMatch[1].length
      continue
    }

    index += 1
  }

  return parts
}

/**
 * Convert designer display tokens `Label (ctrl_id)` and bare labels to ctrl_* ids for API save.
 */
export const replaceRuleDisplayTokensWithIds = (expression, labelToIdMap = {}) => {
  if (!expression || typeof expression !== "string") return expression
  let result = normalizeRuleTypography(expression)

  const displayTokens = Object.entries(labelToIdMap || {})
    .map(([label, fieldId]) => ({
      text: formatRuleFieldDisplayToken(String(label || "").trim(), String(fieldId || "").trim()),
      fieldId: String(fieldId || "").trim(),
    }))
    .filter((entry) => entry.text && entry.fieldId)
    .sort((a, b) => b.text.length - a.text.length)

  displayTokens.forEach(({ text, fieldId }) => {
    result = result.split(text).join(fieldId)
  })

  result = replaceLabelsWithIds(result, labelToIdMap)
  return result
}

export const replaceLabelsWithIds = (expression, labelToIdMap = {}) => {
  if (!expression || typeof expression !== 'string') return expression
  let result = normalizeRuleTypography(expression)
  const entries = Object.entries(labelToIdMap).filter(([label]) => label != null && String(label).trim() !== '')
  entries.sort((a, b) => (b[0].length || 0) - (a[0].length || 0))
  entries.forEach(([label, id]) => {
    const normalizedLabel = normalizeRuleTypography(String(label))
    const variants = [...new Set([String(label), normalizedLabel].filter(Boolean))]
    variants.forEach((variant) => {
      const escaped = escapeRuleLabelForRegExp(variant)
      // Whole-token replace only — avoids "Height *" alias eating the multiply in "Height * Height".
      const re = new RegExp(`(^|[^A-Za-z0-9_])(${escaped})(?=[^A-Za-z0-9_]|$)`, "g")
      result = replaceOutsideDoubleQuotes(result, re, (_, prefix) => `${prefix}${id}`)
    })
  })
  return result
}

/**
 * Decode HTML entities in a string (e.g. &gt; -> >, &amp;&amp; -> &&).
 * Used when displaying rule expressions that were stored or returned HTML-encoded.
 * @param {string} str - String that may contain HTML entities
 * @returns {string} - Decoded string
 */
export const decodeHtmlEntities = (str) => {
  if (!str || typeof str !== 'string') return str
  if (typeof document === "undefined") {
    return str
      .replace(/&gt;/g, ">")
      .replace(/&lt;/g, "<")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
  }
  const textarea = document.createElement('textarea')
  textarea.innerHTML = str
  return textarea.value
}
