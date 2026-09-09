/** Build search/scoring profile from a CRF designer control. */

import { resolveControlFieldInstanceId } from "@/lib/utils/cdashMappings"

export function normalizeText(value = "") {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function tokenize(value = "") {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 1)
}

export function extractDomainHint(fieldInstanceId = "") {
  const match = String(fieldInstanceId).match(/ctrl_([a-z]{2})_/i)
  return match ? match[1].toUpperCase() : null
}

export function extractVarHint(fieldInstanceId = "") {
  const parts = String(fieldInstanceId).split("_")
  return parts.length >= 3 ? parts.slice(2).join("_") : null
}

/** API controlType values for POST /api/Cdash/Suggest. */
export const CDASH_SUGGEST_CONTROL_TYPES = ["date", "datetime", "number", "text", "select"]

/**
 * Map CRF designer control.type → CDASH suggest controlType.
 * Always returns one of: date | datetime | number | text | select
 */
export function mapDesignerControlTypeForCdashSuggest(type = "") {
  const raw = String(type ?? "").trim().toLowerCase()
  if (!raw) return "text"

  if (
    raw === "date" ||
    raw === "ukunkdate" ||
    raw === "datepicker" ||
    raw === "datefield" ||
    raw === "date picker"
  ) {
    return "date"
  }
  if (raw === "datetime" || raw === "datetime-local" || raw === "datetimelocal") {
    return "datetime"
  }
  if (raw === "time" || raw === "timepicker") {
    return "datetime"
  }
  if (raw === "number" || raw === "numberbox" || raw === "numberfield") {
    return "number"
  }
  if (
    raw === "select" ||
    raw === "dropdown" ||
    raw === "optionlist" ||
    raw === "radio" ||
    raw === "checkbox"
  ) {
    return "select"
  }
  if (raw === "textarea" || raw === "textbox" || raw === "text") {
    return "text"
  }

  return "text"
}

/** Prefer designer labelText — clearer labels improve suggest quality. */
export function resolveDesignerControlLabel(control) {
  const labelText = String(control?.properties?.labelText ?? "").trim()
  if (labelText) return labelText
  const propsLabel = String(control?.properties?.label ?? "").trim()
  if (propsLabel) return propsLabel
  return String(control?.label ?? "").trim()
}

export function resolveDesignerControlType(control) {
  return String(control?.type ?? control?.properties?.controlType ?? "").trim()
}

/** @returns {import('./types').MappableCrfControl} */
export function toMappableControl(control, sectionKey = "") {
  const designerType = resolveDesignerControlType(control)
  return {
    fieldInstanceId: resolveControlFieldInstanceId(control),
    id: String(control?.id ?? ""),
    label: resolveDesignerControlLabel(control),
    controlType: mapDesignerControlTypeForCdashSuggest(designerType),
    designerControlType: designerType,
    sectionKey: String(sectionKey ?? "").trim() || undefined,
  }
}

export function buildControlProfile(control) {
  const mappable = typeof control?.fieldInstanceId === "string" ? control : toMappableControl(control)
  const label = normalizeText(mappable.label)
  const fieldId = normalizeText(mappable.fieldInstanceId)
  const tokens = tokenize(`${label} ${fieldId}`)
  return {
    label,
    fieldId,
    tokens,
    domainHint: extractDomainHint(mappable.fieldInstanceId),
    varHint: extractVarHint(mappable.fieldInstanceId),
    controlType: String(mappable.controlType ?? "text").toLowerCase(),
  }
}

export function isGenericDesignerFieldLabel(label = "") {
  const trimmed = String(label ?? "").trim()
  if (!trimmed) return true
  return /^(text|date|number|select|textarea|checkbox|radio|time|file|lab|ukunkdate)\s+field$/i.test(trimmed)
}
