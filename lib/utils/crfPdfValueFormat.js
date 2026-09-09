/** Shared PDF display formatting for CRF export (dates match en-GB UI). */

export function parsePdfDate(value) {
  if (value === undefined || value === null || value === "") return null
  const s = String(value).trim()
  if (!s) return null
  const isoDay = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoDay) {
    const parsed = new Date(Number(isoDay[1]), Number(isoDay[2]) - 1, Number(isoDay[3]))
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  const dmy = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/)
  if (dmy) {
    const parsed = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]))
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  const parsed = new Date(s)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function formatPdfDate(value) {
  const parsed = parsePdfDate(value)
  if (!parsed) return value ? String(value) : ""
  try {
    return parsed.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  } catch {
    return String(value)
  }
}

export function formatPdfDateTime(value) {
  const parsed = parsePdfDate(value)
  if (!parsed) return value ? String(value) : ""
  try {
    return parsed.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return String(value)
  }
}

export function formatPdfTime(value) {
  if (!value) return ""
  try {
    const parsed = parsePdfDate(value) || new Date(`1970-01-01T${String(value).trim()}`)
    if (Number.isNaN(parsed.getTime())) return String(value)
    return parsed.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  } catch {
    return String(value)
  }
}

export function formatPdfTableCellText(cellText, cellType) {
  const type = String(cellType || "").toLowerCase()
  const raw = String(cellText ?? "").trim()
  if (!raw || raw === "—") return raw || "—"
  if (type === "date") return formatPdfDate(raw) || raw
  if (type === "datetime") return formatPdfDateTime(raw) || raw
  if (type === "time") return formatPdfTime(raw) || raw
  return raw
}
