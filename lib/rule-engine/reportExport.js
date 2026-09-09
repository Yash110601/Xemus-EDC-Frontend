function safeTimestampForFile(value = new Date()) {
  const iso = value.toISOString()
  return iso.replace(/[:.]/g, "-")
}

/**
 * Trigger download of runtime parity report JSON.
 * Works only in browser context.
 *
 * @param {Object} report
 * @param {Object} [options]
 * @param {string} [options.prefix]
 * @returns {string|null} filename when download starts, otherwise null
 */
export function downloadParityReportJson(report, options = {}) {
  if (typeof window === "undefined" || !report) return null
  const prefix = String(options.prefix || "crf-rule-runtime-parity").trim()
  const filename = `${prefix}-${safeTimestampForFile()}.json`
  const payload = {
    ...report,
    exportedAt: new Date().toISOString(),
  }
  const json = JSON.stringify(payload, null, 2)
  const blob = new Blob([json], { type: "application/json;charset=utf-8" })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
  return filename
}
