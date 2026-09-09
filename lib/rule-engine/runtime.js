import { createRuntimePatch, RULE_ACTION_TYPES } from "./contracts"
import { buildRuleDependencyGraph, getImpactedRuleIds } from "./dependencyGraph"
import { reduceRuleOutcomesToPatches } from "./reducer"
import { selectRuleIdsForTrigger } from "./scheduler"
import { getLikelyNextFields } from "./predictivePrecompute"

/**
 * Phase-1 runtime facade.
 * For now it executes only incremental impact selection and trace creation.
 * Field property/action reconciliation will be added in Phase-2.
 */
export class RuleRuntime {
  /**
   * @param {{ rules: Array<Object> }} options
   */
  constructor(options = {}) {
    this.rules = Array.isArray(options.rules) ? options.rules : []
    this.ruleById = new Map(this.rules.map((r) => [String(r?.id || ""), r]))
    this.graph = buildRuleDependencyGraph(this.rules)
  }

  /**
   * Evaluate impacted rules for changed fields.
   * @param {{
   *  changedFieldIds: string[],
   *  formValues: Record<string, any>,
  *  evaluateExpression?: (rule: Object, formValues: Object) => boolean,
  *  evaluateCompute?: (rule: Object, formValues: Object) => any
   * }} input
   * @returns {{
   *  changedFieldIds: string[],
   *  fieldPatches: Record<string, Object>,
   *  validationPatches: Record<string, string[]>,
   *  traces: Array<Object>
   * }}
   */
  evaluate(input = {}) {
    const changedFieldIds = Array.isArray(input.changedFieldIds) ? input.changedFieldIds : []
    const formValues = input.formValues && typeof input.formValues === "object" ? input.formValues : {}
    const evaluateExpression = typeof input.evaluateExpression === "function"
      ? input.evaluateExpression
      : () => false
    const evaluateCompute = typeof input.evaluateCompute === "function"
      ? input.evaluateCompute
      : () => null

    const trigger = String(input.trigger || "change").trim().toLowerCase()
    const impactedRuleIds = getImpactedRuleIds(this.graph, changedFieldIds)
    const selectedRuleIds = selectRuleIdsForTrigger([...impactedRuleIds], this.ruleById, trigger)
    const traces = []
    const outcomes = []

    selectedRuleIds.forEach((ruleId) => {
      const rule = this.ruleById.get(ruleId)
      if (!rule || rule.enabled === false) return

      const mode = String(rule?.action?.payload?.mode || "").trim()
      const computedValue = mode === "compute" ? evaluateCompute(rule, formValues) : null
      const conditionMet = mode === "compute"
        ? computedValue != null && !(typeof computedValue === "number" && Number.isNaN(computedValue))
        : Boolean(evaluateExpression(rule, formValues))
      traces.push({
        ruleId,
        ruleName: rule.name,
        actionType: rule?.action?.type || RULE_ACTION_TYPES.SIDE_EFFECT,
        sourceCategory: rule.sourceCategory,
        mode,
        conditionMet,
        computedValue: mode === "compute" ? computedValue : undefined,
        dependencies: rule.dependencies || [],
        targets: (rule.targets || []).map((t) => t.fieldId).filter(Boolean),
      })

      outcomes.push({ rule, conditionMet, computedValue })
    })

    const { fieldPatches, validationPatches } = reduceRuleOutcomesToPatches(outcomes)

    return createRuntimePatch({
      changedFieldIds,
      fieldPatches,
      validationPatches,
      traces,
      meta: {
        impactedRuleCount: impactedRuleIds.size,
        scheduledRuleCount: selectedRuleIds.length,
        evaluatedRuleCount: outcomes.length,
        trigger,
        likelyNextFields: getLikelyNextFields({
          graph: this.graph,
          ruleById: this.ruleById,
          fromFieldId: changedFieldIds[0] || "",
          limit: 12,
        }),
      },
    })
  }
}
