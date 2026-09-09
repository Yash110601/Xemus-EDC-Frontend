"use client"

import { evaluateRule } from "./ruleEvaluator"

let workerInstance = null
let requestSeq = 0
const inflight = new Map()

function shouldEnableWorkerEngine(jobCount, options = {}) {
  const preferWorker = options?.preferWorker === true
  if (typeof window === "undefined" || typeof Worker === "undefined") return false
  try {
    const forced = window.localStorage?.getItem("crfRulesWorker")
    if (forced === "1") return true
    // Default OFF for lowest-latency UX. Worker mode can be enabled explicitly
    // when profiling confirms it helps a specific large form.
    if (forced === "0" || forced == null) return false
  } catch {
    /* ignore */
  }
  if (preferWorker) return Number(jobCount) >= 24
  return Number(jobCount) >= 999999
}

function getWorker() {
  if (workerInstance) return workerInstance
  workerInstance = new Worker(new URL("./ruleEvaluator.worker.js", import.meta.url))
  workerInstance.onmessage = (event) => {
    const { requestId, ok, result, error } = event.data || {}
    const pending = inflight.get(requestId)
    if (!pending) return
    inflight.delete(requestId)
    if (ok) pending.resolve(result || {})
    else pending.reject(new Error(error || "Worker evaluation failed"))
  }
  workerInstance.onerror = (err) => {
    // Fail all inflight requests and let caller fallback to sync path.
    inflight.forEach(({ reject }) => reject(err))
    inflight.clear()
  }
  return workerInstance
}

export async function evaluateRuleBatchWithWorkerEngine(
  jobs,
  formValues,
  fieldLabels,
  options = {}
) {
  const safeJobs = Array.isArray(jobs) ? jobs.filter((j) => j?.key && j?.expression) : []
  if (safeJobs.length === 0) return {}

  if (!shouldEnableWorkerEngine(safeJobs.length, options)) {
    const out = {}
    safeJobs.forEach((job) => {
      out[job.key] = evaluateRule(job.expression, formValues || {}, fieldLabels || {}, {
        silent: true,
        source: "rule-main-sync",
      })
    })
    return out
  }

  try {
    const worker = getWorker()
    const requestId = `rw_${Date.now()}_${++requestSeq}`
    const result = await new Promise((resolve, reject) => {
      inflight.set(requestId, { resolve, reject })
      worker.postMessage({ requestId, jobs: safeJobs, formValues, fieldLabels })
    })
    return result || {}
  } catch {
    // Safe fallback: sync evaluation (never break form flow).
    const out = {}
    safeJobs.forEach((job) => {
      out[job.key] = evaluateRule(job.expression, formValues || {}, fieldLabels || {}, {
        silent: true,
        source: "rule-main-fallback",
      })
    })
    return out
  }
}

