/**
 * Minimal CRF HTML export for portable bundles (CRF Studio → ImportBundle).
 * Matches parseHtmlContent / CRFDesigner round-trip for standard controls.
 */

import { normalizeCrfSection } from "@/lib/utils/crfLabSection"

function escapeHtml(str) {
  if (str == null) return ""
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function renderControlHtml(control) {
  const props = control.properties || {}
  const labelText = props.labelText || control.label || "Unlabeled Field"
  const required = props.required ? "required" : ""
  const readonly = props.readonly ? "readonly" : ""
  const placeholder = props.placeholder || ""
  const controlId = control.id
  const defaultValue =
    props.defaultValue !== undefined && props.defaultValue !== null && props.defaultValue !== ""
      ? String(props.defaultValue)
      : props.defaultValue === 0 || props.defaultValue === "0"
        ? "0"
        : ""
  const controlSize = control.controlSize || 12

  let dataAttributes = `data-control-id="${controlId}" data-control-type="${control.type}"`
  if (props.labelPosition) dataAttributes += ` data-label-position="${props.labelPosition}"`
  if (props.multiline) dataAttributes += ` data-multiline="true"`
  if (props.readonly) dataAttributes += ` data-readonly="true"`

  let html = `      <div class="control-wrapper" ${dataAttributes} style="width: ${(controlSize / 12) * 100}%;">\n`
  html += `        <label class="control-label" for="${controlId}">${escapeHtml(labelText)}${props.required ? ' <span class="required">*</span>' : ""}</label>\n`

  switch (control.type) {
    case "number":
      html += `        <input type="number" id="${controlId}" name="${controlId}" class="form-control" ${required} ${readonly} placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(defaultValue)}" ${props.min != null ? `min="${props.min}"` : ""} ${props.max != null ? `max="${props.max}"` : ""} />\n`
      break
    case "textarea":
      html += `        <textarea id="${controlId}" name="${controlId}" class="form-control" ${required} ${readonly} placeholder="${escapeHtml(placeholder)}" ${props.maxLength ? `maxlength="${props.maxLength}"` : ""}>${escapeHtml(defaultValue)}</textarea>\n`
      break
    case "dropdown":
    case "select": {
      const csvValues = props.csvValues || ""
      html += `        <select id="${controlId}" name="${controlId}" class="form-control" ${required} ${readonly}`
      if (csvValues) html += ` data-csv-values="${csvValues.replace(/"/g, "&quot;")}"`
      html += `>\n`
      const options = csvValues
        ? csvValues.split(",").map((o) => o.trim()).filter(Boolean)
        : (props.options || []).map((o) => (typeof o === "string" ? o : o.value || o.label))
      options.forEach((opt) => {
        const val = typeof opt === "string" ? opt : opt.value
        const lab = typeof opt === "string" ? opt : opt.label || opt.value
        html += `          <option value="${escapeHtml(val)}" ${defaultValue === val ? "selected" : ""}>${escapeHtml(lab)}</option>\n`
      })
      html += "        </select>\n"
      break
    }
    case "radio": {
      const csvValues = props.csvValues || "Yes,No"
      const options = csvValues.split(",").map((o) => o.trim()).filter(Boolean)
      html += `        <div class="radio-group" data-alignment="${props.alignment || "horizontal"}" data-csv-values="${csvValues.replace(/"/g, "&quot;")}">\n`
      options.forEach((opt, index) => {
        const radioId = `${controlId}_${index}`
        html += `          <div class="radio-option">\n`
        html += `            <input type="radio" id="${escapeHtml(radioId)}" name="${escapeHtml(controlId)}" value="${escapeHtml(opt)}" ${defaultValue === opt ? "checked" : ""} ${required} />\n`
        html += `            <label for="${escapeHtml(radioId)}">${escapeHtml(opt)}</label>\n`
        html += "          </div>\n"
      })
      html += "        </div>\n"
      break
    }
    case "checkbox":
      html += `        <input type="checkbox" id="${controlId}" name="${controlId}" class="form-control" ${defaultValue ? "checked" : ""} />\n`
      break
    case "date":
      html += `        <input type="date" id="${controlId}" name="${controlId}" class="form-control" ${required} ${readonly} value="${escapeHtml(defaultValue)}" />\n`
      break
    case "label":
      html += `        <div id="${controlId}" class="label-control">${escapeHtml(labelText)}</div>\n`
      break
    case "text":
    default:
      html += `        <input type="text" id="${controlId}" name="${controlId}" class="form-control" ${required} ${readonly} placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(defaultValue)}" ${props.maxLength ? `maxlength="${props.maxLength}"` : ""} />\n`
      break
  }

  html += "      </div>\n"
  return html
}

/** @param {{ id: string, name: string, controls: unknown[] }[]} sections */
export function generateCrfHtmlFromSections(sections) {
  let html = '<div class="crf-form">\n'
  const list = Array.isArray(sections) ? sections : []

  list.forEach((section) => {
    const ns = normalizeCrfSection(section)
    html += `  <div class="crf-section" data-section-id="${escapeHtml(ns.id)}" data-section-type="standard">\n`
    html += `    <h3 class="section-title">${escapeHtml(ns.name || "Untitled Section")}</h3>\n`
    html += '    <div class="section-controls">\n'
    ;(ns.controls || []).forEach((control) => {
      html += renderControlHtml(control)
    })
    html += "    </div>\n"
    html += "  </div>\n"
  })

  html += "</div>"
  return html
}
