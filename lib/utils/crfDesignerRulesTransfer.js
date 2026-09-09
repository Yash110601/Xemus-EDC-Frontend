import {
  finalizeRuleExpressionForApi,
  normalizeRuleCategory,
  DATE_RESTRICTION_RULE_MARKER,
} from "@/components/crf-designer/ruleEvaluator"

const CATEGORY_TO_API = {
  show: "Show",
  hide: "Hide",
  enable: "Enable",
  disable: "Disable",
  compute: "Compute",
  validation: "Validation",
  submit: "Submit",
  retro: "Retro",
  date_restriction: "Validation",
}

const CONTROL_TYPE_TO_API = {
  label: "Label",
  text: "TextBox",
  number: "NumberBox",
  date: "DatePicker",
  ukunkdate: "DatePicker",
  time: "TimePicker",
  file: "FileUploader",
  checkbox: "CheckBox",
  radio: "OptionButton",
  select: "OptionList",
  hr: "Divider",
  table: "Table",
  lab: "Lab",
}

function ruleDedupeKey(rule) {
  if (!rule) return ""
  if (rule.id != null && String(rule.id).trim()) return `id:${rule.id}`
  const name = rule.ruleName || ""
  const expr = rule.expression || rule.ruleExpression || ""
  const target = rule.targetField || (Array.isArray(rule.targetFields) ? rule.targetFields.join(",") : "")
  return `sig:${name}:${expr}:${target}`
}

/** Collect portable rules from CRF-level list and control assignments (deduped). */
export function collectRulesForExport(crfRules = [], sections = []) {
  const byKey = new Map()

  const add = (rule) => {
    if (!rule || typeof rule !== "object") return
    const name = String(rule.ruleName || rule.name || "").trim()
    const expr = String(rule.expression || rule.ruleExpression || "").trim()
    if (!name && !expr) return
    const key = ruleDedupeKey(rule)
    if (!key || byKey.has(key)) return
    byKey.set(key, normalizePortableRule(rule))
  }

  ;(Array.isArray(crfRules) ? crfRules : []).forEach(add)
  ;(Array.isArray(sections) ? sections : [])
    .flatMap((s) => s?.controls || [])
    .flatMap((c) => c?.properties?.rules || [])
    .forEach(add)

  return Array.from(byKey.values())
}

export function normalizePortableRule(rule) {
  const categoryKey = normalizeRuleCategory(rule.category ?? rule.ruleCategory ?? rule.Category)
  const expression = finalizeRuleExpressionForApi(rule.expression ?? rule.ruleExpression ?? "")
  return {
    ruleName: String(rule.ruleName || rule.name || "").trim(),
    category: categoryKey,
    expression,
    message: String(rule.message || "").trim(),
    severity: rule.severity || "Hard",
    targetField: rule.targetField || "",
    targetFields: Array.isArray(rule.targetFields) ? [...rule.targetFields] : undefined,
    trigger: rule.trigger || "OnChange",
    controlType: rule.controlType || "Label",
    ruleEngineTemplateId: rule.ruleEngineTemplateId ?? null,
  }
}

export function mapCategoryToApi(categoryKey) {
  const key = normalizeRuleCategory(categoryKey)
  return CATEGORY_TO_API[key] || "Validation"
}

export function mapControlTypeToApi(type) {
  const normalized = String(type || "label").toLowerCase()
  return CONTROL_TYPE_TO_API[normalized] || "Label"
}

export function buildCrfRuleApiPayload(rule, { crfId, studyId }) {
  const portable = normalizePortableRule(rule)
  const categoryKey = portable.category
  const messageForApi =
    categoryKey === "date_restriction"
      ? portable.message
        ? `${portable.message} ${DATE_RESTRICTION_RULE_MARKER}`
        : DATE_RESTRICTION_RULE_MARKER
      : portable.message

  return {
    crfId,
    studyId,
    ruleName: portable.ruleName,
    category: mapCategoryToApi(categoryKey),
    expression: portable.expression,
    message: messageForApi,
    severity: portable.severity || "Hard",
    targetField: portable.targetField || "",
    trigger: portable.trigger || "OnChange",
    controlType: mapControlTypeToApi(portable.controlType),
    ruleEngineTemplateId: portable.ruleEngineTemplateId ?? null,
  }
}

/** Create imported rules on the server after CRF is saved in the target environment. */
export async function syncImportedRulesToApi(rules, { crfId, studyId }, crfRuleService) {
  const list = Array.isArray(rules) ? rules : []
  const result = { created: 0, failed: 0, errors: [] }

  if (!crfId || !studyId || list.length === 0) return result

  for (const rule of list) {
    try {
      const payload = buildCrfRuleApiPayload(rule, { crfId, studyId })
      if (!payload.ruleName || !payload.expression) {
        result.failed += 1
        result.errors.push(`Skipped rule without name/expression: ${payload.ruleName || "(unnamed)"}`)
        continue
      }
      const response = await crfRuleService.createCrfRule(payload)
      if (response?.isSuccess) {
        result.created += 1
      } else {
        result.failed += 1
        result.errors.push(response?.message || `Failed to create rule "${payload.ruleName}"`)
      }
    } catch (error) {
      result.failed += 1
      result.errors.push(error?.message || "Unexpected error while syncing rule")
    }
  }

  return result
}

export function rulesToDesignerState(rules = []) {
  return (Array.isArray(rules) ? rules : []).map((rule) => {
    const portable = normalizePortableRule(rule)
    return {
      id: rule.id ?? `imported_rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ruleName: portable.ruleName,
      ruleCategory: portable.category,
      ruleExpression: portable.expression,
      message: portable.message,
      category: mapCategoryToApi(portable.category),
      severity: portable.severity,
      trigger: portable.trigger,
      controlType: portable.controlType,
      targetField: portable.targetField,
      targetFields: portable.targetFields,
      ruleEngineTemplateId: portable.ruleEngineTemplateId,
    }
  })
}

function belongsRuleToControl(rule, control) {
  if (!control?.id || !rule) return false
  const targets = []
  if (Array.isArray(rule.targetFields)) targets.push(...rule.targetFields)
  const tf = rule.targetField ?? rule.TargetField ?? ""
  if (typeof tf === "string") {
    if (tf.includes(",")) {
      targets.push(...tf.split(",").map((s) => s.trim()).filter(Boolean))
    } else if (tf.trim()) {
      targets.push(tf.trim())
    }
  }
  const controlId = control.id
  if (targets.some((t) => t === controlId)) return true
  if (control.type === "table") {
    return targets.some(
      (t) =>
        t.startsWith(`${controlId}_row_`) ||
        t.startsWith(`${controlId}_col_`) ||
        t.startsWith(`${controlId}_`),
    )
  }
  return false
}

/** Normalize API / bundle rule records to designer shape. */
export function normalizeCrfRuleFromApi(rule) {
  if (!rule || typeof rule !== "object") return null
  const categoryRaw = rule.category ?? rule.Category ?? rule.ruleCategory ?? ""
  const categoryKey = normalizeRuleCategory(String(categoryRaw))
  const expression = finalizeRuleExpressionForApi(
    rule.expression ?? rule.Expression ?? rule.ruleExpression ?? "",
  )
  const targetField = String(rule.targetField ?? rule.TargetField ?? "").trim()
  return {
    id: rule.id ?? rule.Id ?? `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ruleName: rule.ruleName ?? rule.RuleName ?? "",
    ruleCategory: categoryKey,
    category: mapCategoryToApi(categoryKey),
    expression,
    ruleExpression: expression,
    message: rule.message ?? rule.Message ?? "",
    severity: rule.severity ?? rule.Severity ?? "Hard",
    targetField,
    targetFields: rule.targetFields ?? rule.TargetFields,
    trigger: rule.trigger ?? rule.Trigger ?? "OnChange",
    controlType: rule.controlType ?? rule.ControlType ?? "Label",
  }
}

export function mapApiRulesOntoSections(sections = [], apiRules = []) {
  const normalized = (Array.isArray(apiRules) ? apiRules : [])
    .map(normalizeCrfRuleFromApi)
    .filter(Boolean)
  return mapRulesOntoSections(sections, normalized)
}

export function findControlInSections(sections, controlId) {
  if (!controlId) return null
  for (const section of sections || []) {
    const control = (section.controls || []).find((c) => c.id === controlId)
    if (control) return control
  }
  return null
}

export function findFirstControlWithRules(sections = []) {
  let tableCandidate = null
  for (const section of sections) {
    for (const control of section?.controls || []) {
      const rules = control?.properties?.rules
      if (!Array.isArray(rules) || rules.length === 0) continue
      if (control.type !== "table") return control
      if (!tableCandidate) tableCandidate = control
    }
  }
  return tableCandidate
}

/** When a table control has cell-level rules, pick the first cell so Properties can list them. */
export function resolveTableCellSelectionFromRules(control) {
  if (control?.type !== "table" || !control?.id) return null
  const rules = control?.properties?.rules
  if (!Array.isArray(rules) || rules.length === 0) return null
  const escapedId = String(control.id).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  for (const rule of rules) {
    const tf = String(rule?.targetField || "").trim()
    const rowColMatch = tf.match(new RegExp(`^${escapedId}_row_(\\d+)_col_(\\d+)$`))
    if (rowColMatch) {
      return {
        row: parseInt(rowColMatch[1], 10),
        col: parseInt(rowColMatch[2], 10),
      }
    }
    const colMatch = tf.match(new RegExp(`^${escapedId}_col_(\\d+)$`))
    if (colMatch) {
      return { row: 0, col: parseInt(colMatch[1], 10) }
    }
  }
  return null
}

/** Attach imported rules to matching controls for designer display. */
export function mapRulesOntoSections(sections = [], rules = []) {
  const designerRules = rulesToDesignerState(rules)
  return (Array.isArray(sections) ? sections : []).map((section) => ({
    ...section,
    controls: (section.controls || []).map((control) => {
      const controlRules = designerRules
        .filter((rule) => belongsRuleToControl(rule, control))
        .map((rule) => ({
          id: rule.id,
          ruleName: rule.ruleName,
          ruleCategory: rule.ruleCategory,
          ruleExpression: rule.ruleExpression,
          message: rule.message,
          category: rule.category,
          severity: rule.severity,
          trigger: rule.trigger,
          controlType: rule.controlType,
          targetField: rule.targetField,
        }))
      if (controlRules.length === 0) return control
      return {
        ...control,
        properties: {
          ...control.properties,
          rules: controlRules,
        },
      }
    }),
  }))
}
