const DEFAULT_SLO_BUDGET_MS = Object.freeze({
  change: 8,
  submit: 20,
  background: 14,
  idle: 30,
})

const DEFAULT_STAGE_SLO_BUDGET_MS = Object.freeze({
  evaluate: 8,
  apply: 5,
  render: 12,
})

export function getRuntimeSloBudgetMs(trigger = "change") {
  const key = String(trigger || "change").trim().toLowerCase()
  return DEFAULT_SLO_BUDGET_MS[key] ?? DEFAULT_SLO_BUDGET_MS.change
}

export function evaluateRuntimeSlo(trigger = "change", durationMs = 0) {
  const budgetMs = getRuntimeSloBudgetMs(trigger)
  const duration = Number.isFinite(Number(durationMs)) ? Number(durationMs) : 0
  const pass = duration <= budgetMs
  return {
    trigger: String(trigger || "change").trim().toLowerCase(),
    durationMs: Number(duration.toFixed(2)),
    budgetMs,
    pass,
    deltaMs: Number((duration - budgetMs).toFixed(2)),
  }
}

export function getRuntimeStageSloBudgetMs(stage = "evaluate") {
  const key = String(stage || "evaluate").trim().toLowerCase()
  return DEFAULT_STAGE_SLO_BUDGET_MS[key] ?? DEFAULT_STAGE_SLO_BUDGET_MS.evaluate
}

export function evaluateRuntimeStageSlo(stage = "evaluate", durationMs = 0) {
  const budgetMs = getRuntimeStageSloBudgetMs(stage)
  const duration = Number.isFinite(Number(durationMs)) ? Number(durationMs) : 0
  const pass = duration <= budgetMs
  return {
    stage: String(stage || "evaluate").trim().toLowerCase(),
    durationMs: Number(duration.toFixed(2)),
    budgetMs,
    pass,
    deltaMs: Number((duration - budgetMs).toFixed(2)),
  }
}
