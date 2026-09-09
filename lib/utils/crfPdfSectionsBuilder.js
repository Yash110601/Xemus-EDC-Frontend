/**
 * Build PDF section payloads for CRF export (aligned with eCRF manual entry PDF export).
 * Uses design-time hidden flags only (no live rule engine).
 */

import { parseHtmlContent } from "@/components/crf-designer/parseHtmlContent"
import { formatPdfTableCellText } from "@/lib/utils/crfPdfValueFormat"

function toExportText(value) {
  if (value === undefined || value === null || value === "") return ""

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => toExportText(item))
      .map((s) => String(s).trim())
      .filter(Boolean)
    return parts.join(", ")
  }

  if (typeof value === "object") {
    const directValue = value.value ?? value.Value
    if (directValue !== undefined && directValue !== null && String(directValue).trim() !== "") {
      return String(directValue)
    }

    const preferred =
      value.label ??
      value.Label ??
      value.displayLabel ??
      value.display ??
      value.text ??
      value.name

    if (preferred !== undefined && preferred !== null && String(preferred).trim() !== "") {
      return String(preferred)
    }

    try {
      return JSON.stringify(value)
    } catch {
      return ""
    }
  }

  return String(value)
}

function resolveTableOptionDisplay(cellRaw, colOptions) {
  const text = toExportText(cellRaw)
  if (!text || String(text).trim() === "") return ""
  const norm = String(text).trim()
  const opts = Array.isArray(colOptions) ? colOptions : []
  for (const opt of opts) {
    const o = String(opt ?? "").trim()
    if (!o) continue
    if (o === norm) return o
    if (o.startsWith(`${norm} `) || o.startsWith(`${norm}(`)) return o
  }
  return norm
}

function parseOptionValues(raw) {
  if (Array.isArray(raw)) {
    return raw
      .map((v) => String(v ?? "").trim())
      .filter(Boolean)
  }
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
  }
  return []
}

export function flattenCrfFormData(rawFormData) {
  if (!rawFormData) return {}

  let parsed = rawFormData
  try {
    if (typeof parsed === "string") parsed = JSON.parse(parsed)
  } catch {
    return {}
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}

  const result = {}
  const absorbControlValue = (controlId, rawValue) => {
    const key = String(controlId || "").trim()
    if (!key.startsWith("ctrl_")) return
    if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue) && rawValue.value !== undefined) {
      result[key] = rawValue.value
    } else if (rawValue !== null && rawValue !== undefined) {
      result[key] = rawValue
    }
  }

  Object.keys(parsed).forEach((topKey) => {
    const entry = parsed[topKey]
    if (String(topKey).startsWith("ctrl_")) {
      absorbControlValue(topKey, entry)
      return
    }
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return
    Object.keys(entry).forEach((controlId) => {
      absorbControlValue(controlId, entry[controlId])
    })
  })

  return result
}

export function deriveDynamicTableRowCounts(flatData, form) {
  if (!flatData || typeof flatData !== "object") return {}
  const out = { ...flatData }
  const sections =
    form?.crfDesign?.sections && Array.isArray(form.crfDesign.sections) && form.crfDesign.sections.length > 0
      ? form.crfDesign.sections
      : form?.section?.controls?.length
        ? [form.section]
        : []
  const controls = sections.flatMap((s) => s.controls || [])
  controls.forEach((control) => {
    if (control.type !== "table" || !control.properties?.addRow) return
    const cid = control.id
    if (!cid) return
    const rowCountKey = cid + "_rowCount"
    if (out[rowCountKey] != null && out[rowCountKey] !== "") return
    let maxRow = -1
    Object.keys(out).forEach((k) => {
      const m = k.match(new RegExp("^" + cid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "_row_(\\d+)_col_"))
      if (m) maxRow = Math.max(maxRow, parseInt(m[1], 10))
    })
    out[rowCountKey] = String(maxRow + 1)
  })
  return out
}

export function getSectionsFromCrfDesign(crfDesign) {
  if (!crfDesign) return []

  let sections = []
  try {
    if (crfDesign.htmlContent) {
      sections = parseHtmlContent(crfDesign.htmlContent)
      if (crfDesign.sections && Array.isArray(crfDesign.sections)) {
        const apiTablesById = new Map()
        crfDesign.sections.forEach((sec) => {
          ;(sec.controls || []).forEach((c) => {
            if (c.type === "table" && c.id) apiTablesById.set(c.id, c)
          })
        })
        sections = sections.map((sec) => ({
          ...sec,
          controls: (sec.controls || []).map((c) => {
            if (c.type !== "table" || !c.id) return c
            const apiTable = apiTablesById.get(c.id)
            if (!apiTable?.properties?.cellLabels) return c
            const hasLabels =
              Array.isArray(c.properties?.cellLabels) &&
              c.properties.cellLabels.some(
                (row) => Array.isArray(row) && row.some((cell) => cell != null && cell !== "")
              )
            if (hasLabels) return c
            return {
              ...c,
              properties: { ...c.properties, cellLabels: apiTable.properties.cellLabels },
            }
          }),
        }))
      }
    } else if (crfDesign.sections && Array.isArray(crfDesign.sections)) {
      sections = crfDesign.sections
    }
  } catch {
    sections = crfDesign.sections && Array.isArray(crfDesign.sections) ? crfDesign.sections : []
  }

  return sections
}

/**
 * @param {object} crfDesign — API CRF design (sections or htmlContent)
 * @param {object} formValues — flat controlId -> value (after flatten + row counts)
 * @param {"filled"|"blank"} pdfMode
 */
export function buildPdfSectionsForExport(crfDesign, formValues, pdfMode = "filled") {
  const sectionsSource = getSectionsFromCrfDesign(crfDesign)
  const syntheticForm = { crfDesign: { sections: sectionsSource } }
  const fv =
    pdfMode === "blank" ? {} : deriveDynamicTableRowCounts({ ...(formValues || {}) }, syntheticForm)

  return sectionsSource.map((section) => ({
    name: section.name,
    controls: (section.controls || [])
      .map((control) => {
        const evaluatedControl = control
        const props = evaluatedControl.properties || {}
        if (props.hidden) return null
        const type = (evaluatedControl.type || "").toLowerCase()
        const rawValue = fv[control.id]
        let value = rawValue

        if (type === "table") {
          const numCols =
            props.columns || (Array.isArray(props.columnHeaders) ? props.columnHeaders.length : 1) || 1
          const designRows = parseInt(props.rows, 10) || 1
          const addRowEnabled = props.addRow === true
          const maxRows = Math.max(designRows, parseInt(props.maxRows, 10) || designRows)
          const rowCountKey = `${control.id}_rowCount`
          const currentRowCountRaw = addRowEnabled ? fv[rowCountKey] : undefined
          const currentRowCount = parseInt(currentRowCountRaw, 10) || designRows || 1
          const rowCount = Math.min(Math.max(1, currentRowCount), maxRows)
          const headers =
            Array.isArray(props.columnHeaders) && props.columnHeaders.length > 0
              ? props.columnHeaders
              : Array.from({ length: numCols }, (_, i) => `Column ${i + 1}`)
          const cellLabels = Array.isArray(props.cellLabels) ? props.cellLabels : []
          const cellTypes = Array.isArray(props.cellTypes) ? props.cellTypes : []
          const columnOptionValues = Array.isArray(props.columnOptionValues) ? props.columnOptionValues : []
          const tableRows = []
          const tableCellMetaRows = []
          for (let r = 0; r < rowCount; r++) {
            const rowCells = []
            const rowMeta = []
            for (let c = 0; c < numCols; c++) {
              const cellId = `${control.id}_row_${r}_col_${c}`
              const cellRaw = fv[cellId]
              const templateRow = r >= designRows ? 0 : r
              const cellLabel = cellLabels?.[templateRow]?.[c]
              const colType =
                cellTypes?.[templateRow]?.[c] ||
                (Array.isArray(props.columnTypes) ? props.columnTypes[c] : "")
              const colTypeNorm = String(colType || "").toLowerCase()
              const isLabelCell = colTypeNorm === "label"
              const isOptionCell = ["select", "dropdown", "radio", "checkbox"].includes(
                String(colType || "").toLowerCase()
              )
              const colOptions = parseOptionValues(columnOptionValues?.[c])
              let cellText = pdfMode === "blank" ? "" : "—"
              if (!(cellRaw === undefined || cellRaw === null || cellRaw === "")) {
                const normalizedCell = toExportText(cellRaw)
                if (normalizedCell && String(normalizedCell).trim() !== "") {
                  const rawText = String(normalizedCell)
                  if (pdfMode === "filled" && ["date", "datetime", "time"].includes(colTypeNorm)) {
                    cellText = formatPdfTableCellText(rawText, colTypeNorm)
                  } else if (pdfMode === "filled" && isOptionCell) {
                    cellText = resolveTableOptionDisplay(cellRaw, colOptions)
                  } else {
                    cellText = rawText
                  }
                } else {
                  cellText = "—"
                }
              } else if (isLabelCell && cellLabel != null && String(cellLabel).trim() !== "") {
                // For label/template cells, export static label text instead of dash.
                cellText = String(cellLabel)
              } else if (pdfMode === "blank" && isOptionCell) {
                // In blank mode, renderer draws select/radio/checkbox controls in table cells.
                // Keep value empty and pass metadata instead.
                cellText = ""
              }
              rowCells.push(cellText)
              rowMeta.push({
                type: String(colType || "").toLowerCase(),
                isLabelCell,
                isOptionCell,
                options: colOptions,
              })
            }
            tableRows.push(rowCells)
            tableCellMetaRows.push(rowMeta)
          }
          value = {
            __table: true,
            headers,
            rows: tableRows,
            cellTypes,
            columnOptionValues,
            columnTypes: Array.isArray(props.columnTypes) ? props.columnTypes : [],
            cellMetaRows: tableCellMetaRows,
          }
        } else if (Array.isArray(rawValue)) {
          value = rawValue
        } else if (typeof rawValue === "string" && type === "checkbox") {
          value = rawValue
            .split(",")
            .map((v) => v.trim())
            .filter((v) => v !== "")
        }

        let options = []
        // Some CRFs store dropdown controls as "dropdown" instead of "select".
        // Treat them as equivalent so PDF export can resolve the label text.
        if (props.csvValues && (type === "select" || type === "dropdown" || type === "radio" || type === "checkbox")) {
          options = props.csvValues.split(",").map((opt) => opt.trim()).filter((opt) => opt !== "")
        } else if (Array.isArray(props.options) && props.options.length > 0) {
          options = props.options.map((o) => (typeof o === "string" ? o : o?.label ?? o?.value ?? ""))
        }

        return {
          id: control.id,
          label:
            props.labelText ||
            props.questionText ||
            props.label ||
            props.text ||
            evaluatedControl.label ||
            "Field",
          type,
          options,
          value,
          controlSize: evaluatedControl.controlSize || control.controlSize || 12,
          properties: props,
        }
      })
      .filter(Boolean),
  }))
}
