/* eslint-disable no-console */
"use strict"

const { evaluateRuntimeStageSlo } = require("../lib/rule-engine/slo.cjs")
const fs = require("fs")
const path = require("path")

function quantile(sortedValues, q) {
  if (!Array.isArray(sortedValues) || sortedValues.length === 0) return 0
  const idx = Math.min(sortedValues.length - 1, Math.max(0, Math.floor(sortedValues.length * q)))
  return sortedValues[idx]
}

function summarizeStage(stage, durationsMs) {
  const sorted = [...durationsMs].sort((a, b) => a - b)
  const p95 = quantile(sorted, 0.95)
  const p50 = quantile(sorted, 0.5)
  const avg = sorted.reduce((sum, n) => sum + n, 0) / sorted.length
  const breaches = durationsMs
    .map((d) => evaluateRuntimeStageSlo(stage, d))
    .filter((r) => !r.pass).length
  const breachRate = sorted.length > 0 ? breaches / sorted.length : 0
  const budgetMs = evaluateRuntimeStageSlo(stage, 0).budgetMs
  return {
    stage,
    count: sorted.length,
    p50Ms: Number(p50.toFixed(2)),
    p95Ms: Number(p95.toFixed(2)),
    avgMs: Number(avg.toFixed(2)),
    budgetMs,
    breaches,
    breachRate: Number((breachRate * 100).toFixed(2)),
  }
}

function evaluateSummary(summary, options) {
  const p95Limit = summary.budgetMs + options.p95HeadroomMs
  const p95Pass = summary.p95Ms <= p95Limit
  const breachPass = summary.breachRate <= options.maxBreachRatePct
  return {
    ...summary,
    p95LimitMs: p95Limit,
    p95Pass,
    breachPass,
    pass: p95Pass && breachPass,
  }
}

function createSyntheticDurations(base, jitter, samples, spikeEvery, spikeFactor) {
  const out = []
  for (let i = 0; i < samples; i += 1) {
    const wave = Math.sin(i / 9) * jitter
    const raw = base + wave + ((i % 7) * 0.15)
    const value = i > 0 && i % spikeEvery === 0 ? raw * spikeFactor : raw
    out.push(Math.max(0, Number(value.toFixed(2))))
  }
  return out
}

function toStageDurations(input = {}, fallbackSamples = 0) {
  const fromInput = (stage) => {
    const raw = input?.[stage]
    if (!Array.isArray(raw)) return []
    return raw
      .map((entry) => {
        if (typeof entry === "number") return Number(entry)
        if (entry && typeof entry === "object" && Number.isFinite(Number(entry.durationMs))) {
          return Number(entry.durationMs)
        }
        return NaN
      })
      .filter((n) => Number.isFinite(n) && n >= 0)
  }
  const evaluate = fromInput("evaluate")
  const apply = fromInput("apply")
  const render = fromInput("render")
  if (evaluate.length || apply.length || render.length) {
    return { evaluate, apply, render, source: "input" }
  }
  return {
    evaluate: createSyntheticDurations(6.2, 1.3, fallbackSamples, 17, 1.18),
    apply: createSyntheticDurations(3.6, 1.1, fallbackSamples, 15, 1.2),
    render: createSyntheticDurations(8.4, 2.2, fallbackSamples, 13, 1.2),
    source: "synthetic",
  }
}

function readInputPayload() {
  const inputPath = String(process.env.RULE_STAGE_GATE_INPUT || "").trim()
  if (!inputPath) return null
  const resolved = path.resolve(process.cwd(), inputPath)
  if (!fs.existsSync(resolved)) {
    console.error(`[stage-gate] FAIL input file not found: ${resolved}`)
    process.exit(1)
  }
  const text = fs.readFileSync(resolved, "utf8")
  try {
    const parsed = JSON.parse(text)
    if (parsed?.stageSamples && typeof parsed.stageSamples === "object") {
      return {
        stageSamples: parsed.stageSamples,
        meta: parsed?.meta || {},
      }
    }
    return {
      stageSamples: parsed || {},
      meta: parsed?.meta || {},
    }
  } catch (error) {
    console.error(`[stage-gate] FAIL invalid input json: ${resolved}`)
    console.error(error?.message || error)
    process.exit(1)
  }
}

function main() {
  const samples = Number(process.env.RULE_STAGE_GATE_SAMPLES || 120)
  const maxBreachRatePct = Number(process.env.RULE_STAGE_GATE_MAX_BREACH_PCT || 10)
  const p95HeadroomMs = Number(process.env.RULE_STAGE_GATE_P95_HEADROOM_MS || 0)
  const requireGroupPass = String(process.env.RULE_STAGE_GATE_REQUIRE_GROUPS || "1") !== "0"
  const reportOutPathRaw = String(process.env.RULE_STAGE_GATE_REPORT_OUT || "").trim()

  const inputPayload = readInputPayload()
  const stageInputsWithSource = toStageDurations(inputPayload?.stageSamples || {}, samples)
  const stageInputs = {
    evaluate: stageInputsWithSource.evaluate,
    apply: stageInputsWithSource.apply,
    render: stageInputsWithSource.render,
  }
  console.log(`[stage-gate] source=${stageInputsWithSource.source}`)

  const summaries = Object.entries(stageInputs).map(([stage, durations]) =>
    summarizeStage(stage, durations)
  )

  const report = {
    generatedAt: new Date().toISOString(),
    source: stageInputsWithSource.source,
    options: {
      maxBreachRatePct,
      p95HeadroomMs,
      requireGroupPass,
    },
    overall: [],
    groups: [],
  }

  let failed = 0
  summaries.forEach((s) => {
    const evaluated = evaluateSummary(s, { maxBreachRatePct, p95HeadroomMs })
    report.overall.push(evaluated)
    console.log(
      `[stage-gate] ${evaluated.stage} count=${evaluated.count} avg=${evaluated.avgMs}ms p50=${evaluated.p50Ms}ms p95=${evaluated.p95Ms}ms budget=${evaluated.budgetMs}ms p95_limit=${evaluated.p95LimitMs}ms breaches=${evaluated.breaches} breach_rate=${evaluated.breachRate}%`
    )
    if (!evaluated.pass) {
      failed += 1
      console.error(
        `[stage-gate] FAIL ${evaluated.stage} p95Pass=${evaluated.p95Pass} breachPass=${evaluated.breachPass} maxBreachRate=${maxBreachRatePct}%`
      )
    }
  })

  const groupRows = Array.isArray(inputPayload?.meta?.breakdownByStudyForm)
    ? inputPayload.meta.breakdownByStudyForm
    : []
  if (requireGroupPass && groupRows.length > 0) {
    groupRows.forEach((group) => {
      const groupLabel = `study=${String(group?.studyId || "unknown")} form=${String(group?.formId || "unknown")}`
      ;["evaluate", "apply", "render"].forEach((stage) => {
        const durationSource = group?.[stage]
        const p95Ms = Number(durationSource?.p95Ms || 0)
        const avgMs = Number(durationSource?.avgMs || 0)
        const p50Ms = Number(durationSource?.p50Ms || 0)
        const count = Number(durationSource?.count || 0)
        if (!Number.isFinite(p95Ms) || count <= 0) return
        const syntheticDurations = [p50Ms, avgMs, p95Ms].filter((n) => Number.isFinite(n) && n >= 0)
        const summary = summarizeStage(stage, syntheticDurations)
        summary.count = count
        summary.p50Ms = p50Ms
        summary.avgMs = avgMs
        summary.p95Ms = p95Ms
        const evaluated = evaluateSummary(summary, { maxBreachRatePct, p95HeadroomMs })
        report.groups.push({
          studyId: String(group?.studyId || "unknown"),
          formId: String(group?.formId || "unknown"),
          stage: evaluated.stage,
          count: evaluated.count,
          p50Ms: evaluated.p50Ms,
          avgMs: evaluated.avgMs,
          p95Ms: evaluated.p95Ms,
          budgetMs: evaluated.budgetMs,
          p95LimitMs: evaluated.p95LimitMs,
          pass: evaluated.p95Pass,
        })
        console.log(
          `[stage-gate][group] ${groupLabel} stage=${evaluated.stage} p95=${evaluated.p95Ms}ms budget=${evaluated.budgetMs}ms p95_limit=${evaluated.p95LimitMs}ms pass=${evaluated.p95Pass}`
        )
        if (!evaluated.p95Pass) {
          failed += 1
          console.error(
            `[stage-gate] FAIL group ${groupLabel} stage=${evaluated.stage} p95=${evaluated.p95Ms}ms budget=${evaluated.budgetMs}ms`
          )
        }
      })
    })
  }

  if (reportOutPathRaw) {
    const reportPath = path.resolve(process.cwd(), reportOutPathRaw)
    fs.mkdirSync(path.dirname(reportPath), { recursive: true })
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8")
    console.log(`[stage-gate] report=${path.relative(process.cwd(), reportPath)}`)
  }

  if (failed > 0) process.exit(1)
}

main()
