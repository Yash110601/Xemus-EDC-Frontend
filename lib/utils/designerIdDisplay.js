/**
 * Compact display helpers for CRF designer control / section IDs.
 * Full IDs remain on title + clipboard — canvas shows a short suffix only.
 */

export function formatDesignerControlIdShort(id = "") {
  const raw = String(id ?? "").trim()
  if (!raw) return "—"

  const parts = raw.split("_").filter(Boolean)
  if (parts[0]?.toLowerCase() === "ctrl" && parts.length >= 2) {
    return parts[parts.length - 1]
  }

  if (raw.length <= 10) return raw
  return `…${raw.slice(-8)}`
}

export function formatDesignerSectionIdShort(id = "") {
  const raw = String(id ?? "").trim()
  if (!raw) return "—"

  const sectionMatch = raw.match(/^section[_-]?(.+)$/i)
  if (sectionMatch?.[1]) return sectionMatch[1]

  if (raw.length <= 10) return raw
  return `…${raw.slice(-6)}`
}

export function designerControlIdTitle(id = "") {
  const raw = String(id ?? "").trim()
  if (!raw) return "Control ID"
  const short = formatDesignerControlIdShort(raw)
  if (short === raw) return `Control ID: ${raw}`
  return `Control ID: ${raw}\nShort: ${short}`
}

export function designerSectionIdTitle(id = "") {
  const raw = String(id ?? "").trim()
  if (!raw) return "Section ID"
  const short = formatDesignerSectionIdShort(raw)
  if (short === raw) return `Section ID: ${raw}`
  return `Section ID: ${raw}\nShort: ${short}`
}
