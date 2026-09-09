function quantile(sortedValues, q) {
  if (!Array.isArray(sortedValues) || sortedValues.length === 0) return 0
  const idx = Math.min(sortedValues.length - 1, Math.max(0, Math.floor(sortedValues.length * q)))
  return sortedValues[idx]
}

/**
 * In-memory perf tracker for runtime shadow/pilot cycles.
 */
export function createRuntimePerfTracker(maxSamples = 200) {
  const samples = []
  return {
    record(durationMs = 0, impactedRuleCount = 0, patchFieldCount = 0) {
      const d = Number.isFinite(Number(durationMs)) ? Number(durationMs) : 0
      const r = Number.isFinite(Number(impactedRuleCount)) ? Number(impactedRuleCount) : 0
      const p = Number.isFinite(Number(patchFieldCount)) ? Number(patchFieldCount) : 0
      samples.push({ durationMs: d, impactedRuleCount: r, patchFieldCount: p, at: Date.now() })
      if (samples.length > maxSamples) samples.splice(0, samples.length - maxSamples)
    },
    summary() {
      if (samples.length === 0) {
        return {
          sampleCount: 0,
          p50Ms: 0,
          p95Ms: 0,
          maxMs: 0,
          avgMs: 0,
          avgImpactedRules: 0,
          avgPatchFields: 0,
        }
      }
      const durations = samples.map((s) => s.durationMs).sort((a, b) => a - b)
      const totalDuration = samples.reduce((acc, s) => acc + s.durationMs, 0)
      const totalRules = samples.reduce((acc, s) => acc + s.impactedRuleCount, 0)
      const totalPatches = samples.reduce((acc, s) => acc + s.patchFieldCount, 0)
      return {
        sampleCount: samples.length,
        p50Ms: quantile(durations, 0.5),
        p95Ms: quantile(durations, 0.95),
        maxMs: durations[durations.length - 1],
        avgMs: Number((totalDuration / samples.length).toFixed(2)),
        avgImpactedRules: Number((totalRules / samples.length).toFixed(2)),
        avgPatchFields: Number((totalPatches / samples.length).toFixed(2)),
      }
    },
  }
}
