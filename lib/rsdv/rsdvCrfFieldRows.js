import {
  buildPdfSectionsForExport,
  deriveDynamicTableRowCounts,
  flattenCrfFormData,
} from "@/lib/utils/crfPdfSectionsBuilder"

function formatFieldDisplayValue(control) {
  const value = control?.value
  if (value?.__table) {
    const rowCount = Array.isArray(value.rows) ? value.rows.length : 0
    return `[Table — ${rowCount} row(s); open eCRF for full view]`
  }
  if (Array.isArray(value)) {
    const parts = value.map((item) => String(item ?? "").trim()).filter(Boolean)
    return parts.length ? parts.join(", ") : "—"
  }
  if (value && typeof value === "object") {
    const preferred = value.label ?? value.Label ?? value.value ?? value.Value ?? value.text ?? value.name
    if (preferred != null && String(preferred).trim() !== "") return String(preferred)
    try {
      return JSON.stringify(value)
    } catch {
      return "—"
    }
  }
  if (value === undefined || value === null || value === "") return "—"
  return String(value)
}

/**
 * Flatten submitted CRF design + form data into review-friendly field rows.
 * @param {object|null} crfDesign
 * @param {object|string|null} rawFormData
 * @returns {Array<{ fieldId: string, label: string, value: string, section: string, type: string }>}
 */
export function buildRsdvCrfFieldRows(crfDesign, rawFormData) {
  if (!crfDesign) return []

  const flat = flattenCrfFormData(rawFormData)
  const syntheticForm = { crfDesign }
  const formValues = deriveDynamicTableRowCounts({ ...flat }, syntheticForm)
  const sections = buildPdfSectionsForExport(crfDesign, formValues, "filled")
  const rows = []

  for (const section of sections) {
    for (const control of section.controls || []) {
      if (!control?.id) continue
      rows.push({
        fieldId: control.id,
        label: control.label || control.id,
        value: formatFieldDisplayValue(control),
        section: section.name || "General",
        type: control.type || "text",
      })
    }
  }

  return rows
}
