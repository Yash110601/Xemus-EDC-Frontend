/* eslint-disable no-console */
"use strict"

const { evaluateRuntimeSlo } = require("../lib/rule-engine/slo.cjs")

function runAssertions(evaluateRuntimeSlo) {
  const scenarios = [
    { trigger: "change", durationMs: 6, expectPass: true },
    { trigger: "change", durationMs: 11, expectPass: false },
    { trigger: "submit", durationMs: 18, expectPass: true },
    { trigger: "submit", durationMs: 26, expectPass: false },
    { trigger: "background", durationMs: 12, expectPass: true },
    { trigger: "background", durationMs: 21, expectPass: false },
    { trigger: "idle", durationMs: 22, expectPass: true },
    { trigger: "idle", durationMs: 39, expectPass: false },
  ]

  let failed = 0
  scenarios.forEach((s) => {
    const out = evaluateRuntimeSlo(s.trigger, s.durationMs)
    const ok = Boolean(out?.pass) === s.expectPass
    if (!ok) {
      failed += 1
      console.error(
        `[tier-assert] FAIL trigger=${s.trigger} duration=${s.durationMs}ms expectedPass=${s.expectPass} got=${Boolean(out?.pass)}`
      )
      return
    }
    console.log(
      `[tier-assert] PASS trigger=${s.trigger} duration=${s.durationMs}ms budget=${out.budgetMs}ms pass=${out.pass}`
    )
  })

  if (failed > 0) {
    process.exit(1)
  }
}

if (typeof evaluateRuntimeSlo !== "function") {
  console.error("[tier-assert] FAIL evaluateRuntimeSlo export missing")
  process.exit(1)
}

runAssertions(evaluateRuntimeSlo)
