/**
 * Local mismatch sampler with pluggable upload hook.
 * Default behavior stores sampled entries in memory and exposes flush methods.
 */
export function createMismatchSampler(options = {}) {
  const maxBufferSize = Number.isFinite(Number(options.maxBufferSize))
    ? Math.max(10, Number(options.maxBufferSize))
    : 200
  const uploader = typeof options.uploader === "function" ? options.uploader : null
  const buffer = []

  const shouldSample = (sampleRate = 0.1) => {
    const n = Number(sampleRate)
    if (!Number.isFinite(n) || n <= 0) return false
    if (n >= 1) return true
    return Math.random() <= n
  }

  return {
    record(entry, sampleRate = 0.1) {
      if (!entry || !shouldSample(sampleRate)) return false
      buffer.push({
        ...entry,
        sampledAt: new Date().toISOString(),
      })
      if (buffer.length > maxBufferSize) {
        buffer.splice(0, buffer.length - maxBufferSize)
      }
      return true
    },
    getBuffered() {
      return [...buffer]
    },
    clear() {
      buffer.splice(0, buffer.length)
    },
    flush() {
      const payload = [...buffer]
      if (payload.length === 0) return { sent: 0, mode: "empty" }
      if (uploader) {
        try {
          uploader(payload)
          buffer.splice(0, buffer.length)
          return { sent: payload.length, mode: "uploader" }
        } catch {
          return { sent: 0, mode: "uploader_error" }
        }
      }
      console.info("[RuleRuntime][MismatchSampler][Flush]", payload)
      buffer.splice(0, buffer.length)
      return { sent: payload.length, mode: "console_stub" }
    },
  }
}
