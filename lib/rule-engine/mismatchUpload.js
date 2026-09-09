/**
 * Optional upload hook for rule-runtime mismatch samples (browser).
 * Set NEXT_PUBLIC_RULE_MISMATCH_UPLOAD_URL to override the default same-origin API route.
 */
export function createMismatchSamplesUploader(options = {}) {
  const endpoint =
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_RULE_MISMATCH_UPLOAD_URL) ||
    options.endpoint ||
    "/api/rule-engine/mismatch-samples"

  return async (samples) => {
    if (!Array.isArray(samples) || samples.length === 0) return
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        receivedAt: new Date().toISOString(),
        samples,
      }),
      credentials: "same-origin",
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`Mismatch upload failed: ${res.status} ${text}`)
    }
  }
}
