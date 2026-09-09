/**
 * Builds per-control evaluated state using the canonical runtime + reducer path,
 * then applies legacy-only categories (compute / submit / retro) per control.
 */

import { compileRulesToCanonicalIR } from "./compiler"
import { RuleRuntime } from "./runtime"
import {
  evaluateRule,
  applyRuleAction,
  getFormValues,
  createFieldLabelMap,
  isCrfRuleVerbose,
  isDesignerReadonly,
  normalizeRuleCategory,
} from "@/components/crf-designer/ruleEvaluator"

function flattenRulesWithOwners(sections = []) {
  const byId = new Map()
  sections.forEach((sec) => {
    ;(sec.controls || []).forEach((control) => {
      ;(control.properties?.rules || []).forEach((rule) => {
        const rid = rule?.id
        if (rid == null || byId.has(String(rid))) return
        byId.set(String(rid), {
          ...rule,
          expression: rule.expression || rule.ruleExpression,
          ruleExpression: rule.ruleExpression || rule.expression,
          __ownerControlId: control.id,
          __ownerControlType: control.type,
        })
      })
    })
  })
  return [...byId.values()]
}

function buildControlTypesMap(sections = []) {
  const m = new Map()
  sections.forEach((s) => {
    ;(s.controls || []).forEach((c) => {
      if (c?.id) m.set(String(c.id), c.type)
    })
  })
  return m
}

function mergeRuntimePatchIntoProps(baseProps, patch) {
  if (!patch || typeof patch !== "object") return { ...baseProps }
  const next = { ...baseProps }
  Object.keys(patch).forEach((k) => {
    if (k === "__meta") return
    next[k] = patch[k]
  })
  return next
}

/**
 * @param {Array<{controls?: Array}>} sections
 * @param {Record<string, unknown>} mergedValues
 * @returns {Record<string, { id: string, type?: string, label?: string, controlSize?: number, properties: Record<string, unknown> }>}
 */
export function buildEvaluatedControlsMapFromRuntimeReducer(sections = [], mergedValues = {}) {
  const controls = []
  sections.forEach((section) => {
    if (section.controls && Array.isArray(section.controls)) {
      controls.push(...section.controls)
    }
  })
  if (controls.length === 0) return {}

  const flatRules = flattenRulesWithOwners(sections).filter((rule) => {
    const cat = normalizeRuleCategory(rule?.category ?? rule?.ruleCategory ?? rule?.Category)
    return cat !== "compute" && cat !== "submit" && cat !== "retro"
  })

  const { rules: compiled } = compileRulesToCanonicalIR(flatRules)
  const runtime = new RuleRuntime({ rules: compiled })
  const labelMap = createFieldLabelMap(controls)
  const values = getFormValues(controls, mergedValues, { useControlDefaults: false })
  const verboseRules = isCrfRuleVerbose()
  const controlTypesById = buildControlTypesMap(sections)

  const patchEnvelope = runtime.evaluateFullScan({
    formValues: values,
    trigger: "change",
    controlTypesById,
    evaluateExpression: (rule, vals) =>
      evaluateRule(String(rule?.conditionExpression || ""), vals, labelMap, {
        silent: true,
        ...(verboseRules
          ? {
              log: "runtime-reducer",
              ruleId: rule?.id,
              ruleName: rule?.name,
              source: "evaluatedControlsFromRuntime",
            }
          : {}),
      }),
    evaluateCompute: () => null,
  })

  const fieldPatches = patchEnvelope?.fieldPatches && typeof patchEnvelope.fieldPatches === "object"
    ? patchEnvelope.fieldPatches
    : {}

  const evaluated = {}
  controls.forEach((control) => {
    const baseProps = { ...(control.properties || {}) }
    const mergedProps = mergeRuntimePatchIntoProps(baseProps, fieldPatches[control.id])

    let updatedProps = mergedProps
    const rules = control.properties?.rules || []
    rules.forEach((rule) => {
      const cat = normalizeRuleCategory(rule.ruleCategory ?? rule.category ?? rule.Category)
      if (cat !== "compute" && cat !== "submit" && cat !== "retro") return
      if (cat === "compute") return
      try {
        const ruleMeta = verboseRules
          ? {
              log: "control",
              source: "useRuleEvaluation:legacy-overlay",
              ruleId: rule.id,
              ruleName: rule.ruleName,
              ruleCategory: rule.ruleCategory || rule.category,
              targetControlId: control.id,
              targetControlLabel: control.label || control.properties?.labelText,
            }
          : {}
        const conditionMet = evaluateRule(
          rule.ruleExpression || rule.expression || "",
          values,
          labelMap,
          ruleMeta
        )
        const ruleProps = applyRuleAction(rule, control, conditionMet)
        updatedProps = { ...updatedProps, ...ruleProps }
        if (isDesignerReadonly(control.properties)) {
          updatedProps.readonly = true
        }
      } catch {
        /* keep props */
      }
    })

    evaluated[control.id] = {
      ...control,
      properties: updatedProps,
    }
  })

  return evaluated
}
