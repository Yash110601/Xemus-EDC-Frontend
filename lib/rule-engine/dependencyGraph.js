/**
 * Create a lightweight dependency index for incremental rule execution.
 * Graph shape:
 * - dependencyToRuleIds: source field id -> impacted canonical rule ids
 * - ruleIdToTargets: canonical rule id -> target field ids
 */
export function buildRuleDependencyGraph(canonicalRules = []) {
  const dependencyToRuleIds = new Map()
  const ruleIdToTargets = new Map()

  canonicalRules.forEach((rule) => {
    const ruleId = String(rule?.id || "")
    if (!ruleId) return

    const deps = Array.isArray(rule?.dependencies) ? rule.dependencies : []
    deps.forEach((dep) => {
      const depId = String(dep || "").trim()
      if (!depId) return
      if (!dependencyToRuleIds.has(depId)) dependencyToRuleIds.set(depId, new Set())
      dependencyToRuleIds.get(depId).add(ruleId)
    })

    const targets = Array.isArray(rule?.targets)
      ? rule.targets.map((t) => String(t?.fieldId || "").trim()).filter(Boolean)
      : []
    ruleIdToTargets.set(ruleId, new Set(targets))
  })

  return {
    dependencyToRuleIds,
    ruleIdToTargets,
  }
}

/**
 * Return impacted rule ids for changed fields.
 * @param {Object} graph
 * @param {string[]} changedFieldIds
 * @returns {Set<string>}
 */
export function getImpactedRuleIds(graph, changedFieldIds = []) {
  const impacted = new Set()
  if (!graph || !graph.dependencyToRuleIds) return impacted

  changedFieldIds.forEach((fieldId) => {
    const normalized = String(fieldId || "").trim()
    if (!normalized) return
    const candidates = graph.dependencyToRuleIds.get(normalized)
    if (!candidates) return
    candidates.forEach((ruleId) => impacted.add(ruleId))
  })

  return impacted
}
