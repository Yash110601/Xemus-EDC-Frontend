/* eslint-disable no-console */
"use strict"

const { performance } = require("perf_hooks")

function createRuleDependencyIndex(expression, targetIds = []) {
  const expr = String(expression || "")
  const referencedIds = [...new Set(expr.match(/\bctrl_[A-Za-z0-9_]+\b/g) || [])]
  return {
    expressionTrimmed: expr.trim(),
    referencedIds,
    targetIds: Array.isArray(targetIds) ? targetIds.map(String).filter(Boolean) : [],
  }
}

function buildDependencyGraph(rules) {
  const depToRuleIds = new Map()
  const ruleById = new Map()
  rules.forEach((rule, idx) => {
    const ruleId = `rule_${idx}`
    ruleById.set(ruleId, rule)
    const deps = new Set([...(rule.referencedIds || []), ...(rule.targetIds || [])])
    deps.forEach((dep) => {
      if (!dep) return
      if (!depToRuleIds.has(dep)) depToRuleIds.set(dep, new Set())
      depToRuleIds.get(dep).add(ruleId)
    })
  })
  return { depToRuleIds, ruleById }
}

function getImpactedRuleIds(graph, dirtyFieldIds) {
  if (!graph || !graph.ruleById) return []
  const dirty = Array.isArray(dirtyFieldIds) ? dirtyFieldIds.map(String).filter(Boolean) : []
  if (dirty.length === 0 || dirty.includes("*")) return [...graph.ruleById.keys()]
  const impacted = new Set()
  dirty.forEach((id) => {
    const set = graph.depToRuleIds.get(id)
    if (!set) return
    set.forEach((ruleId) => impacted.add(ruleId))
  })
  return [...impacted]
}

function runCase(name, ruleCount, dirtyKeys, p95BudgetMs) {
  const rules = Array.from({ length: ruleCount }, (_, i) => {
    const src = `ctrl_source_${i % 600}`
    const dep = `ctrl_source_${(i + 1) % 600}`
    const tgt = `ctrl_target_${i % 1200}`
    return createRuleDependencyIndex(`${src} == "Yes" && ${dep} != ""`, [tgt])
  })

  const graph = buildDependencyGraph(rules)
  const samples = []
  let matchedLast = 0
  for (let pass = 0; pass < 30; pass += 1) {
    const dirty = Array.from({ length: dirtyKeys }, (_, i) => `ctrl_source_${(pass + i) % 600}`)
    const t0 = performance.now()
    const impactedRuleIds = getImpactedRuleIds(graph, dirty)
    matchedLast = impactedRuleIds.length
    samples.push(performance.now() - t0)
  }

  samples.sort((a, b) => a - b)
  const p50 = samples[Math.floor((samples.length - 1) * 0.5)] || 0
  const p95 = samples[Math.floor((samples.length - 1) * 0.95)] || 0
  const avg = samples.reduce((sum, n) => sum + n, 0) / samples.length
  const pass = p95 <= p95BudgetMs

  console.log(
    `[matrix] ${name} rules=${ruleCount} dirty=${dirtyKeys} matched=${matchedLast} avg=${avg.toFixed(2)}ms p50=${p50.toFixed(2)}ms p95=${p95.toFixed(2)}ms budget=${p95BudgetMs}ms pass=${pass}`
  )
  return pass
}

function main() {
  const cases = [
    { name: "small", rules: 10000, dirty: 8, p95: Number(process.env.RULE_MATRIX_SMALL_P95_MS || 10) },
    { name: "medium", rules: 50000, dirty: 10, p95: Number(process.env.RULE_MATRIX_MEDIUM_P95_MS || 24) },
    { name: "large", rules: 100000, dirty: 12, p95: Number(process.env.RULE_MATRIX_LARGE_P95_MS || 48) },
  ]
  const failed = cases
    .map((c) => runCase(c.name, c.rules, c.dirty, c.p95))
    .filter((ok) => !ok).length
  if (failed > 0) process.exit(1)
}

main()
