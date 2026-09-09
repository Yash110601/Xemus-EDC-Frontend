/* eslint-disable no-console */
"use strict"

const { performance } = require("perf_hooks")

function createRuleDependencyIndex(expression, targetIds = []) {
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
  return {
    expression: expr,
    expressionTrimmed: expr.trim(),
    referencedIds,
    referencedBaseIds,
    targetIds: Array.isArray(targetIds) ? targetIds.map(String).filter(Boolean) : [],
  }
}

function ruleDependencyMatchesDirtyFields(ruleDep, dirtyFieldIds) {
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
  for (const tid of dep.targetIds || []) {
    if (dirtySet.has(tid)) return true
    for (const d of dirtySet) {
      if (tid === d || tid.startsWith(`${d}_`) || d.startsWith(`${tid}_`)) return true
    }
  }
  return false
}

function runBenchmark() {
  const RULES = Number(process.env.RULE_PERF_RULES || 3000)
  const DIRTY_KEYS = Number(process.env.RULE_PERF_DIRTY || 8)
  const P95_BUDGET_MS = Number(process.env.RULE_PERF_P95_MS || 12)

  const rules = Array.from({ length: RULES }, (_, i) => {
    const table = `ctrl_table_${i % 50}`
    const src = `ctrl_source_${i % 120}`
    const tgt = `${table}_row_${i % 3}_col_${i % 6}`
    const expr = `${src} == "Yes" && ${table}_row_${i % 3}_col_${(i + 1) % 6} != ""`
    return createRuleDependencyIndex(expr, [tgt])
  })

  const samples = []
  for (let pass = 0; pass < 40; pass++) {
    const dirty = Array.from({ length: DIRTY_KEYS }, (_, i) => `ctrl_source_${(pass + i) % 120}`)
    const t0 = performance.now()
    let matched = 0
    for (const rule of rules) {
      if (ruleDependencyMatchesDirtyFields(rule, dirty)) matched++
    }
    const elapsed = performance.now() - t0
    samples.push(elapsed)
    if (pass === 39) {
      console.log(`[perf] matched_rules=${matched}/${RULES}`)
    }
  }

  samples.sort((a, b) => a - b)
  const p95 = samples[Math.floor((samples.length - 1) * 0.95)] || 0
  const p50 = samples[Math.floor((samples.length - 1) * 0.5)] || 0
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length

  console.log(`[perf] rule_dependency_match avg=${avg.toFixed(2)}ms p50=${p50.toFixed(2)}ms p95=${p95.toFixed(2)}ms budget=${P95_BUDGET_MS}ms`)
  if (p95 > P95_BUDGET_MS) {
    console.error(`[perf] FAIL p95 ${p95.toFixed(2)}ms exceeded budget ${P95_BUDGET_MS}ms`)
    process.exit(1)
  }
}

runBenchmark()

