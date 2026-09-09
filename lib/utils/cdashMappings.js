/** CDASH field mapping helpers for CRF Designer (Phase 1). */

import { CDASH_IG_VERSION } from "@/lib/services/cdash.service"

export { CDASH_IG_VERSION }

/** CDASH mapping applies only to data-entry controls from the designer toolbox. */
export const CDASH_MAPPABLE_CONTROL_TYPES = new Set([
  "text",
  "textarea",
  "number",
  "date",
  "ukunkdate",
  "time",
  "datetime",
  "select",
  "radio",
  "checkbox",
])

/** Table cell types that cannot hold CDASH-mapped data entry values. */
const TABLE_NON_MAPPABLE_CELL_TYPES = new Set(["empty", "label", "file", "lab", "hr", "divider"])

/** Matches eCRF / rule target ids: `{tableId}_row_{R}_col_{C}`. */
const TABLE_CELL_FIELD_ID_PATTERN = /^(.*)_row_(\d+)_col_(\d+)$/

function resolveTableCellTypeFromProps(props = {}, rowIdx, colIdx) {
  const columnTypes = Array.isArray(props.columnTypes) ? props.columnTypes : []
  const cellTypes = Array.isArray(props.cellTypes) ? props.cellTypes : []
  let cellType = cellTypes[rowIdx]?.[colIdx]
  if (!cellType || cellType === "empty") cellType = columnTypes[colIdx] ?? "text"
  return String(cellType || "text").trim().toLowerCase()
}

/** Stable field id for one table cell — same key used in eCRF save payload. */
export function resolveTableCellFieldInstanceId(tableControl, rowIdx, colIdx) {
  const tableId = resolveControlFieldInstanceId(tableControl)
  if (!tableId) return ""
  const row = Number(rowIdx)
  const col = Number(colIdx)
  if (!Number.isFinite(row) || row < 0 || !Number.isFinite(col) || col < 0) return ""
  return `${tableId}_row_${row}_col_${col}`
}

export function buildTableCellLabel(tableControl, rowIdx, colIdx) {
  const props = tableControl?.properties || {}
  const columnHeaders = Array.isArray(props.columnHeaders) ? props.columnHeaders : []
  const colHeader =
    columnHeaders[colIdx] != null && String(columnHeaders[colIdx]).trim() !== ""
      ? String(columnHeaders[colIdx]).trim()
      : `Column ${colIdx + 1}`
  const tableLabel =
    String(tableControl?.label ?? tableControl?.properties?.labelText ?? "Table").trim() || "Table"
  return `${tableLabel} - ${colHeader} (Row ${rowIdx + 1})`
}

/** Synthetic designer control for CDASH suggest / mapping on a table cell. */
export function buildTableCellMappableControl(tableControl, rowIdx, colIdx) {
  const props = tableControl?.properties || {}
  const cellType = resolveTableCellTypeFromProps(props, rowIdx, colIdx)
  const fieldInstanceId = resolveTableCellFieldInstanceId(tableControl, rowIdx, colIdx)
  const label = buildTableCellLabel(tableControl, rowIdx, colIdx)
  return {
    id: fieldInstanceId,
    type: cellType,
    label,
    properties: { labelText: label },
  }
}

export function isTableCellMappableForCdash(tableControl, rowIdx, colIdx) {
  if (!tableControl || String(tableControl?.type || "").toLowerCase() !== "table") return false
  const cellType = resolveTableCellTypeFromProps(tableControl?.properties || {}, rowIdx, colIdx)
  if (TABLE_NON_MAPPABLE_CELL_TYPES.has(cellType)) return false
  if (!CDASH_MAPPABLE_CONTROL_TYPES.has(cellType)) return false
  return Boolean(resolveTableCellFieldInstanceId(tableControl, rowIdx, colIdx))
}

/** Top-level control or selected table cell eligible for CDASH mapping UI. */
export function resolveCdashTargetControl(control, rowIdx = null, colIdx = null) {
  if (!control) return null
  if (isControlMappableForCdash(control)) return control
  if (
    String(control?.type || "").toLowerCase() === "table" &&
    rowIdx != null &&
    colIdx != null &&
    isTableCellMappableForCdash(control, rowIdx, colIdx)
  ) {
    return buildTableCellMappableControl(control, rowIdx, colIdx)
  }
  return null
}

function expandTableCellMappableRows(tableControl, sectionName = "") {
  const props = tableControl?.properties || {}
  const numRows = Math.max(1, Number(props.rows) || 1)
  const numCols = Math.max(1, Number(props.columns) || 1)
  const rows = []
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      if (!isTableCellMappableForCdash(tableControl, r, c)) continue
      const synthetic = buildTableCellMappableControl(tableControl, r, c)
      rows.push({
        fieldInstanceId: synthetic.id,
        label: synthetic.label,
        type: synthetic.type,
        sectionName,
      })
    }
  }
  return rows
}

export function getCdashBadgeForFieldId(mappings = [], fieldInstanceId = "") {
  const fid = String(fieldInstanceId ?? "").trim()
  if (!fid) return null
  const row = findCdashMappingByFieldId(mappings, fid)
  if (!row?.cdashVariableName) return null
  const domain = row.domainCode ? `${row.domainCode}:` : ""
  return `${domain}${row.cdashVariableName}`
}

/** Designer control.type used for CDASH eligibility checks. */
export function getCdashMappableControlType(control) {
  if (!control) return ""
  return String(control?.type ?? control?.properties?.controlType ?? "")
    .trim()
    .toLowerCase()
}

/** Controls eligible for CDASH mapping in designer. */
export function getMappableDesignerControls(sections = []) {
  const rows = []
  ;(sections || []).forEach((section) => {
    ;(section?.controls || []).forEach((control) => {
      if (isControlMappableForCdash(control)) {
        const fieldInstanceId = resolveControlFieldInstanceId(control)
        if (!fieldInstanceId) return
        rows.push({
          fieldInstanceId,
          label: String(control?.label ?? control?.properties?.label ?? fieldInstanceId),
          type: getCdashMappableControlType(control),
          sectionName: section?.name ?? "",
        })
        return
      }
      if (String(control?.type || "").toLowerCase() === "table") {
        rows.push(...expandTableCellMappableRows(control, section?.name ?? ""))
      }
    })
  })
  return rows
}

/** Resolve stable field instance id used in form data / export. */
export function resolveControlFieldInstanceId(control) {
  if (!control) return ""
  const fromProps = control.properties?.fieldInstanceId ?? control.properties?.FieldInstanceId
  const raw = fromProps ?? control.fieldInstanceId ?? control.FieldInstanceId ?? control.id ?? ""
  return String(raw).trim()
}

/** Normalize GET CrfDesignById cdashMappings array. */
export function normalizeCdashMappingsFromApi(payload) {
  const raw =
    payload?.cdashMappings ??
    payload?.CdashMappings ??
    (Array.isArray(payload) ? payload : [])
  if (!Array.isArray(raw)) return []
  return raw
    .map((row) => ({
      id: row?.id ?? row?.Id ?? null,
      fieldInstanceId: String(row?.fieldInstanceId ?? row?.FieldInstanceId ?? "").trim(),
      cdashReferenceDataId: Number(row?.cdashReferenceDataId ?? row?.CdashReferenceDataId),
      cdashVariableName: String(row?.cdashVariableName ?? row?.CdashVariableName ?? "").trim(),
      domainCode: String(row?.domainCode ?? row?.DomainCode ?? "").trim(),
      variableLabel: String(row?.label ?? row?.Label ?? "").trim(),
    }))
    .filter((row) => row.fieldInstanceId)
}

/** Build PUT/POST cdashMappings payload items. */
export function buildCdashMappingsSavePayload(mappings = []) {
  return (mappings || [])
    .filter((m) => m?.fieldInstanceId && m?.cdashReferenceDataId && m?.cdashVariableName)
    .map((m) => ({
      fieldInstanceId: String(m.fieldInstanceId).trim(),
      cdashReferenceDataId: Number(m.cdashReferenceDataId),
      cdashVariableName: String(m.cdashVariableName).trim(),
    }))
}

/** Lookup mapping badge text for a control (e.g. DM:AGE). */
export function getCdashBadgeForControl(control, mappings = []) {
  const fid = resolveControlFieldInstanceId(control)
  if (!fid) return null
  const row = (mappings || []).find((m) => m.fieldInstanceId === fid)
  if (!row?.cdashVariableName) return null
  const domain = row.domainCode ? `${row.domainCode}:` : ""
  return `${domain}${row.cdashVariableName}`
}

/** Whether a designer control can be linked to a CDASH variable. */
export function isControlMappableForCdash(control) {
  if (!control) return false
  const type = getCdashMappableControlType(control)
  if (!CDASH_MAPPABLE_CONTROL_TYPES.has(type)) return false
  return Boolean(resolveControlFieldInstanceId(control))
}

export function findCdashMappingByFieldId(mappings = [], fieldInstanceId = "") {
  const fid = String(fieldInstanceId ?? "").trim()
  if (!fid) return null
  return (mappings || []).find((m) => m.fieldInstanceId === fid) ?? null
}

export function upsertCdashMapping(mappings = [], row = {}) {
  const fid = String(row?.fieldInstanceId ?? "").trim()
  if (!fid) return [...(mappings || [])]
  const list = [...(mappings || [])]
  const idx = list.findIndex((m) => m.fieldInstanceId === fid)
  const next = {
    id: row?.id ?? list[idx]?.id ?? null,
    fieldInstanceId: fid,
    domainCode: String(row?.domainCode ?? list[idx]?.domainCode ?? "").trim(),
    cdashReferenceDataId:
      row?.cdashReferenceDataId ?? list[idx]?.cdashReferenceDataId ?? null,
    cdashVariableName: String(row?.cdashVariableName ?? list[idx]?.cdashVariableName ?? "").trim(),
    variableLabel: String(row?.variableLabel ?? list[idx]?.variableLabel ?? "").trim(),
  }
  if (idx >= 0) list[idx] = next
  else list.push(next)
  return list
}

export function clearCdashMapping(mappings = [], fieldInstanceId = "") {
  const fid = String(fieldInstanceId ?? "").trim()
  if (!fid) return [...(mappings || [])]
  return (mappings || []).filter((m) => m.fieldInstanceId !== fid)
}

/** CDASH reference ids used on other fields in this CRF (legacy exclude list). */
export function getUsedCdashReferenceDataIds(mappings = [], excludeFieldInstanceId = "") {
  const exclude = String(excludeFieldInstanceId ?? "").trim()
  const ids = new Set()
  for (const row of mappings || []) {
    const refId = Number(row?.cdashReferenceDataId)
    if (!Number.isFinite(refId) || refId <= 0) continue
    const fid = String(row?.fieldInstanceId ?? "").trim()
    if (exclude && fid === exclude) continue
    ids.add(refId)
  }
  return [...ids]
}

/** In-memory draft rows for create-CRF Suggest / Variables (other fields already mapped). */
export function buildCdashDraftAssignments(mappings = [], excludeFieldInstanceId = "", getFieldLabel) {
  const exclude = String(excludeFieldInstanceId ?? "").trim()
  return (mappings || [])
    .filter((row) => {
      const fid = String(row?.fieldInstanceId ?? "").trim()
      if (!fid || fid === exclude) return false
      const refId = Number(row?.cdashReferenceDataId)
      const varName = String(row?.cdashVariableName ?? "").trim()
      return (Number.isFinite(refId) && refId > 0) || Boolean(varName)
    })
    .map((row) => ({
      cdashReferenceDataId: Number(row.cdashReferenceDataId),
      fieldInstanceId: String(row.fieldInstanceId).trim(),
      fieldLabel:
        (typeof getFieldLabel === "function"
          ? getFieldLabel(row.fieldInstanceId)
          : null) ||
        String(row.variableLabel ?? "").trim() ||
        String(row.fieldInstanceId).trim(),
      cdashVariableName: String(row.cdashVariableName ?? "").trim(),
    }))
}

/** Create-flow: mark Variables rows unavailable when taken by draft assignments. */
export function applyDraftAvailabilityToVariables(
  items = [],
  draftAssignments = [],
  currentFieldInstanceId = "",
) {
  const taken = buildDraftTakenMaps(draftAssignments, currentFieldInstanceId)
  const { takenByRef, takenByVarName } = taken

  return (items || []).map((item) => {
    if (item?.isAvailable === false) return item
    const refId = Number(item?.id)
    const varName = String(item?.variableName ?? "").trim().toUpperCase()
    const takenLabel =
      (Number.isFinite(refId) && refId > 0 ? takenByRef.get(refId) : null) ??
      (varName ? takenByVarName.get(varName) : null)
    if (!takenLabel) {
      return { ...item, isAvailable: item?.isAvailable !== false }
    }
    return {
      ...item,
      isAvailable: false,
      unavailableReason: `Already mapped to ${takenLabel}.`,
    }
  })
}

function buildDraftTakenMaps(draftAssignments = [], currentFieldInstanceId = "") {
  const current = String(currentFieldInstanceId ?? "").trim()
  const takenByRef = new Map()
  const takenByVarName = new Map()

  for (const draft of draftAssignments || []) {
    const fid = String(draft?.fieldInstanceId ?? "").trim()
    if (!fid || fid === current) continue
    const refId = Number(draft?.cdashReferenceDataId)
    const label = String(draft.fieldLabel ?? fid).trim()
    if (Number.isFinite(refId) && refId > 0) {
      takenByRef.set(refId, label)
    }
    const varName = String(draft?.cdashVariableName ?? "").trim().toUpperCase()
    if (varName) {
      takenByVarName.set(varName, label)
    }
  }

  return { takenByRef, takenByVarName }
}

/** Mark Suggest rows unavailable when another field in this CRF already uses the variable. */
export function applyDraftAvailabilityToSuggestions(
  suggestions = [],
  draftAssignments = [],
  currentFieldInstanceId = "",
) {
  const { takenByRef, takenByVarName } = buildDraftTakenMaps(draftAssignments, currentFieldInstanceId)

  return (suggestions || []).map((suggestion) => {
    if (suggestion?.isAvailable === false) return suggestion

    const refId = Number(suggestion?.variable?.id)
    const varName = String(suggestion?.variable?.variableName ?? "").trim().toUpperCase()
    const takenLabel =
      (Number.isFinite(refId) && refId > 0 ? takenByRef.get(refId) : null) ??
      (varName ? takenByVarName.get(varName) : null)

    if (!takenLabel) return suggestion

    const unavailableReason = `Already mapped to ${takenLabel}.`
    return {
      ...suggestion,
      isAvailable: false,
      unavailableReason,
      variable: suggestion.variable
        ? {
            ...suggestion.variable,
            isAvailable: false,
            unavailableReason,
          }
        : suggestion.variable,
    }
  })
}

/** Returns conflicting mapping row if variable is already used on another field in this CRF. */
export function findCdashVariableConflict(
  mappings = [],
  { fieldInstanceId, cdashReferenceDataId, cdashVariableName } = {},
) {
  const fid = String(fieldInstanceId ?? "").trim()
  const refId = Number(cdashReferenceDataId)
  const varName = String(cdashVariableName ?? "").trim().toUpperCase()
  if (!fid) return null

  for (const row of mappings || []) {
    const otherFid = String(row?.fieldInstanceId ?? "").trim()
    if (!otherFid || otherFid === fid) continue

    if (Number.isFinite(refId) && refId > 0 && Number(row?.cdashReferenceDataId) === refId) {
      return row
    }
    const otherVar = String(row?.cdashVariableName ?? "").trim().toUpperCase()
    if (varName && otherVar && otherVar === varName) {
      return row
    }
  }
  return null
}

export function formatCdashVariableConflictMessage(cdashVariableName = "", otherFieldLabel = "") {
  const name = String(cdashVariableName ?? "").trim()
  const other = String(otherFieldLabel ?? "").trim()
  if (name && other) {
    return `CDASH variable '${name}' is already mapped to "${other}". Each CDASH variable can map to only one field per CRF.`
  }
  if (name) {
    return `CDASH variable '${name}' is already mapped to another field in this CRF. Each CDASH variable can map to only one field per CRF.`
  }
  return "This CDASH variable is already mapped to another field in this CRF. Each CDASH variable can map to only one field per CRF."
}

/** Client-side guard before save — mirrors backend duplicate-variable rule. */
export function validateCdashMappingsUniquePerCrf(mappings = [], getFieldLabel) {
  const seenRef = new Map()

  for (const row of mappings || []) {
    const refId = Number(row?.cdashReferenceDataId)
    if (!Number.isFinite(refId) || refId <= 0) continue

    if (seenRef.has(refId)) {
      const otherFid = seenRef.get(refId)
      const otherLabel =
        typeof getFieldLabel === "function" ? getFieldLabel(otherFid) : otherFid
      return formatCdashVariableConflictMessage(row.cdashVariableName, otherLabel)
    }
    seenRef.set(refId, row.fieldInstanceId)
  }
  return null
}

/** Find designer control by fieldInstanceId across sections. */
export function findDesignerControlByFieldId(sections = [], fieldInstanceId = "") {
  const fid = String(fieldInstanceId ?? "").trim()
  if (!fid) return null

  const cellMatch = fid.match(TABLE_CELL_FIELD_ID_PATTERN)
  if (cellMatch) {
    const tableId = cellMatch[1]
    const rowIdx = Number.parseInt(cellMatch[2], 10)
    const colIdx = Number.parseInt(cellMatch[3], 10)
    for (const section of sections || []) {
      for (const control of section?.controls || []) {
        if (resolveControlFieldInstanceId(control) !== tableId) continue
        if (!isTableCellMappableForCdash(control, rowIdx, colIdx)) return null
        return buildTableCellMappableControl(control, rowIdx, colIdx)
      }
    }
    return null
  }

  for (const section of sections || []) {
    for (const control of section?.controls || []) {
      if (resolveControlFieldInstanceId(control) === fid) return control
    }
  }
  return null
}
