"use client"

import { useCallback, useMemo, useRef } from "react"
import {
  evaluateRule,
  applyRuleAction,
  isDesignerReadonly,
  getFormValues,
  createFieldLabelMap,
  isCrfRuleVerbose,
  createRuleDependencyIndex,
  ruleDependencyMatchesDirtyFields,
  mergeRulePropsRestrictively,
} from "./ruleEvaluator"

const dateRuleDebugLastState = new Map()

function logDateRuleDebug(event, payload) {
  try {
    if (typeof window === "undefined") return
    const enabled =
      window.localStorage?.getItem("crfRulesDebug") === "1" ||
      window.localStorage?.getItem("crfRulesTraceDatePicker") === "1"
    if (!enabled) return
    const key = `${payload?.controlId || ""}|${payload?.ruleId || ""}|${payload?.conditionMet}|${payload?.readonly}|${payload?.sourceValue || ""}`
    const prev = dateRuleDebugLastState.get(event)
    if (prev === key) return
    dateRuleDebugLastState.set(event, key)
    if (dateRuleDebugLastState.size > 200) dateRuleDebugLastState.clear()
    // Intentionally quiet to keep runtime logging minimal.
  } catch {
    /* ignore debug logging errors */
  }
}

/**
 * Hook for dynamic rule evaluation in CRF forms
 * @param {Array} sections - CRF sections with controls
 * @param {Object} formData - Current form data state
 * @param {{ dirtyKeysRef?: { current: string[] | null } }} options - Optional ref: `['fieldId']` = incremental pass; `['*']` or null = full pass (ref read during render; parent clears after CRF effect).
 * @returns {Object} - { evaluatedControls, updateFormValue, applyRulesToControls }
 */
export const useRuleEvaluation = (sections = [], formData = {}, options = {}) => {
  const { dirtyKeysRef } = options
  // Single source of truth: always evaluate rules from parent form data.
  // Avoid local shadow state which can lag and overwrite fresh values.
  const mergedValues = useMemo(() => ({ ...(formData || {}) }), [formData])

  const prevEvaluatedRef = useRef(null)
  const prevSectionsRef = useRef(null)
  const compiledRuleDepsRef = useRef({})

  // Get all controls from all sections
  const getAllControls = useCallback(() => {
    const allControls = []
    sections.forEach((section) => {
      if (section.controls && Array.isArray(section.controls)) {
        allControls.push(...section.controls)
      }
    })
    return allControls
  }, [sections])

  const evaluateOneControl = useCallback(
    (control, values, labelMap, verboseRules) => {
      const rules = Array.isArray(control.properties?.rules) ? [...control.properties.rules] : []
      // Ensure deterministic conflict resolution when multiple rules update
      // the same property (e.g. readonly). We apply lower ids first so
      // newer/specific rules (higher ids) are applied last.
      rules.sort((a, b) => {
        const aId = Number.parseInt(a?.id, 10)
        const bId = Number.parseInt(b?.id, 10)
        const aHasId = Number.isFinite(aId)
        const bHasId = Number.isFinite(bId)
        if (aHasId && bHasId) return aId - bId
        if (aHasId) return -1
        if (bHasId) return 1
        return 0
      })
      let updatedProps = { ...control.properties }
      rules.forEach((rule) => {
        const expression = String(rule?.ruleExpression || rule?.expression || "").trim()
        if (!expression) return
        const category = (rule.ruleCategory || rule.category || "").toString().toLowerCase()
        // Compute rules are handled in eCRF data-entry compute pipeline.
        // Do not run them through boolean expression evaluator here, otherwise
        // JS compute blocks (IIFE/arrow/functions) get rewritten as comparisons and throw syntax errors.
        if (category === "compute") return
        try {
          const ruleMeta = verboseRules
            ? {
                log: "control",
                source: "useRuleEvaluation:render",
                ruleId: rule.id,
                ruleName: rule.ruleName,
                ruleCategory: rule.ruleCategory || rule.category,
                targetControlId: control.id,
                targetControlLabel: control.label || control.properties?.labelText,
              }
            : {}
          const conditionMet = evaluateRule(expression, values, labelMap, ruleMeta)
          const ruleProps = applyRuleAction(rule, control, conditionMet)
          const controlTypeLc = String(control?.type || "").toLowerCase()
          const isDateControl =
            controlTypeLc === "date" || controlTypeLc === "datepicker" || controlTypeLc === "datefield" || controlTypeLc.includes("date")

          if (isDateControl && (category.includes("enable") || category.includes("disable"))) {
            const expression = String(rule.ruleExpression || rule.expression || "")
            const sourceIds = [...new Set(expression.match(/\bctrl_[A-Za-z0-9_]+\b/g) || [])]
            const sourceValues = sourceIds.reduce((acc, id) => {
              acc[id] = values?.[id]
              return acc
            }, {})
            logDateRuleDebug("date_control_rule_eval", {
              controlId: control.id,
              controlLabel: control.label || control.properties?.labelText,
              controlType: control.type,
              ruleId: rule.id,
              ruleName: rule.ruleName,
              category,
              expression,
              conditionMet,
              readonly: ruleProps?.readonly,
              sourceValue:
                sourceIds.length === 1
                  ? values?.[sourceIds[0]]
                  : JSON.stringify(sourceValues),
              sourceValues,
            })
          }
          // Restrictive Wins merge — see mergeRulePropsRestrictively for
          // full rationale. Replaces the previous shallow-spread that let
          // a non-firing rule's `readonly: false` silently undo another
          // rule's `readonly: true` when two rules targeted the same
          // field via "Also applies to" overlap.
          updatedProps = mergeRulePropsRestrictively(updatedProps, ruleProps, {
            ruleCategory: category,
          })
          if (isDesignerReadonly(control.properties)) {
            updatedProps.readonly = true
          }
        } catch {
          // keep existing props on error
        }
      })
      return { ...control, properties: updatedProps }
    },
    []
  )

  // Compute evaluated controls during render so the first paint has correct readonly/disabled.
  const evaluatedControls = useMemo(() => {
    const sectionsChanged = prevSectionsRef.current !== sections
    prevSectionsRef.current = sections
    if (sectionsChanged) {
      prevEvaluatedRef.current = null
    }

    if (!sections?.length) {
      prevEvaluatedRef.current = {}
      return {}
    }
    const controls = getAllControls()
    if (sectionsChanged) {
      const compiled = {}
      controls.forEach((control) => {
        const rules = control.properties?.rules || []
        compiled[control.id] = rules.map((rule) =>
          createRuleDependencyIndex(rule.ruleExpression || rule.expression || "")
        )
      })
      compiledRuleDepsRef.current = compiled
    }

    if (!controls.length) {
      prevEvaluatedRef.current = {}
      return {}
    }

    const labelMap = createFieldLabelMap(controls)
    const values = getFormValues(controls, mergedValues, { useControlDefaults: false })
    const verboseRules = isCrfRuleVerbose()

    const snap = dirtyKeysRef?.current
    const canIncremental =
      dirtyKeysRef &&
      Array.isArray(snap) &&
      snap.length > 0 &&
      snap[0] !== "*" &&
      prevEvaluatedRef.current &&
      Object.keys(prevEvaluatedRef.current).length > 0 &&
      !sectionsChanged

    if (!canIncremental) {
      const evaluated = {}
      controls.forEach((control) => {
        evaluated[control.id] = evaluateOneControl(control, values, labelMap, verboseRules)
      })
      prevEvaluatedRef.current = evaluated
      return evaluated
    }

    const dirtySnap = snap.map(String).filter(Boolean)
    const dirtySet = new Set(dirtySnap)
    const prev = prevEvaluatedRef.current
    const evaluated = { ...prev }
    const controlLookup = new Map(controls.map((c) => [c.id, c]))
    const compiledRuleDeps = compiledRuleDepsRef.current || {}

    controls.forEach((control) => {
      const rules = control.properties?.rules || []
      const compiledDepsForControl = compiledRuleDeps[control.id] || []
      const mustReeval =
        !prev[control.id] ||
        dirtySet.has(control.id) ||
        compiledDepsForControl.some((dep) =>
          ruleDependencyMatchesDirtyFields(dep, dirtySnap, controlLookup)
        ) ||
        (compiledDepsForControl.length === 0 &&
          rules.some((rule) => {
            const ex = rule.ruleExpression || rule.expression
            return ex?.trim()
          }))
      if (!mustReeval) return
      evaluated[control.id] = evaluateOneControl(control, values, labelMap, verboseRules)
    })

    prevEvaluatedRef.current = evaluated
    return evaluated
  }, [sections, mergedValues, getAllControls, evaluateOneControl, dirtyKeysRef])

  // Evaluate rules for all controls (for imperative use)
  const evaluateAllRules = useCallback(() => {
    const controls = getAllControls()
    const labelMap = createFieldLabelMap(controls)
    const values = getFormValues(controls, mergedValues, { useControlDefaults: false })
    const verboseRules = isCrfRuleVerbose()
    const evaluated = {}
    controls.forEach((control) => {
      evaluated[control.id] = evaluateOneControl(control, values, labelMap, verboseRules)
    })
    return evaluated
  }, [getAllControls, mergedValues, evaluateOneControl])

  // Update form value and re-evaluate rules
  const updateFormValue = useCallback((controlId, value) => {
    // Deprecated: parent form state drives rule evaluation.
    // Keep API shape for backward compatibility.
    void controlId
    void value
  }, [])

  // Get evaluated control (with rules applied)
  const getEvaluatedControl = useCallback(
    (controlId) => {
      return evaluatedControls[controlId] || null
    },
    [evaluatedControls]
  )

  return {
    formValues: mergedValues,
    evaluatedControls,
    updateFormValue,
    evaluateAllRules,
    getEvaluatedControl,
  }
}
