/**
 * Build a lightweight "likely next fields" list from current focus/change context.
 * It is intentionally deterministic and bounded for UI safety.
 */
export function getLikelyNextFields({ graph, ruleById, fromFieldId, limit = 12 }) {
  const startField = String(fromFieldId || "").trim()
  if (!startField) return []
  if (!graph || !graph.dependencyToRuleIds || !graph.ruleIdToTargets) return []

  const directRuleIds = graph.dependencyToRuleIds.get(startField) || new Set()
  const scoreByField = new Map()

  directRuleIds.forEach((ruleId) => {
    const rule = ruleById?.get?.(String(ruleId || ""))
    const weight = Number(rule?.priority ?? 0)
    const targets = graph.ruleIdToTargets.get(String(ruleId || "")) || new Set()
    targets.forEach((fieldId) => {
      if (!fieldId || fieldId === startField) return
      const prev = scoreByField.get(fieldId) || 0
      scoreByField.set(fieldId, prev + 1 + Math.max(0, 1000 - weight) / 1000)
    })
  })

  return [...scoreByField.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, Math.max(1, Number(limit) || 12))
    .map(([fieldId]) => fieldId)
}
