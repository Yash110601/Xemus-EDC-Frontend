"use strict"

import { evaluateRule } from "./ruleEvaluator"

self.onmessage = (event) => {
  const { requestId, jobs, formValues, fieldLabels } = event.data || {}
  if (!requestId) return
  try {
    const out = {}
    const safeJobs = Array.isArray(jobs) ? jobs : []
    safeJobs.forEach((job) => {
      const key = job?.key
      const expression = job?.expression || ""
      if (!key) return
      out[key] = evaluateRule(expression, formValues || {}, fieldLabels || {}, {
        silent: true,
        source: "rule-worker",
      })
    })
    self.postMessage({ requestId, ok: true, result: out })
  } catch (error) {
    self.postMessage({
      requestId,
      ok: false,
      error: error?.message || String(error),
    })
  }
}

