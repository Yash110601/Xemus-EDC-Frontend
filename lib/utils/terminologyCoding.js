/**
 * Normalizes CRF terminology coding dropdown values from designer / HTML.
 * @param {unknown} raw
 * @returns {'' | 'meddra' | 'whodd'}
 */
export function normalizeTerminologyCoding(raw) {
  const v = String(raw || "")
    .trim()
    .toLowerCase()
  if (v === "meddra" || v === "m") return "meddra"
  if (v === "whodd" || v === "whodrug" || v === "w") return "whodd"
  return ""
}

/**
 * Parse `Preferred term (100123)` produced by lookup selection.
 * @param {unknown} value
 * @returns {{ label: string, code: string | null }}
 */
export function splitTerminologyLabelAndCode(value) {
  const s = String(value ?? "").trimEnd()
  const m = s.match(/^(.+?)\s\(([^)]+)\)\s*$/)
  if (!m) return { label: s, code: null }
  const label = m[1].trim()
  const code = m[2].trim()
  if (!code || !label) return { label: s, code: null }
  if (label === code) return { label: s, code: null }
  return { label, code }
}

/**
 * @param {{ code?: unknown; display?: unknown }} row — search hit from terminologyCoding.service
 * @param {number} [maxLength] — optional CRF max length
 */
export function formatTerminologyLookupSelection(row, maxLength) {
  const codeStr = row?.code != null ? String(row.code) : ""
  if (!codeStr) return ""
  const displayStr = row?.display && String(row.display).trim() ? String(row.display).trim() : ""
  let label = ""
  if (displayStr && displayStr !== codeStr) {
    const sep = displayStr.includes(" — ") ? " — " : displayStr.includes(" · ") ? " · " : null
    const first = sep ? displayStr.split(sep)[0].trim() : displayStr
    label = first && first !== codeStr ? first : displayStr !== codeStr ? displayStr : ""
  }
  let out = label ? `${label} (${codeStr})` : codeStr
  if (maxLength != null && maxLength > 0 && out.length > maxLength) {
    const suf = ` (${codeStr})`
    if (maxLength <= suf.length) return codeStr.slice(0, maxLength)
    const maxLabel = maxLength - suf.length
    const rawLabel = label || ""
    const truncated =
      rawLabel.length > maxLabel ? `${rawLabel.slice(0, Math.max(0, maxLabel - 1))}…` : rawLabel.trimEnd()
    out = truncated ? `${truncated}${suf}` : codeStr.slice(0, maxLength)
  }
  return out
}
