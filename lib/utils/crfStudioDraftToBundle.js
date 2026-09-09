/**
 * CRF Studio draft tree → portable CRF design bundle (same shape as ExportBundle / ImportBundle).
 */

import { generateCrfHtmlFromSections } from "@/lib/utils/crfDesignerHtmlExport"
import { normalizeRuleForBundle, resolveCrfFormTypeForBundle } from "@/lib/utils/crfDesignerBundle"
import { crfFormTypeToDesignerVisitLabel } from "@/lib/visitTypes"

function slugId(prefix, seed) {
  const base = String(seed || "item")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  return `${prefix}-${base || Date.now()}`
}

function normalizeDraftFieldType(raw) {
  const t = String(raw || "text").trim().toLowerCase()
  if (["number", "integer", "decimal", "float"].includes(t)) return "number"
  if (["date", "datetime"].includes(t)) return "date"
  if (["textarea", "multiline", "longtext"].includes(t)) return "textarea"
  if (["select", "dropdown", "choice", "enum"].includes(t)) return "select"
  if (["radio", "yesno", "boolean", "yn"].includes(t)) return "radio"
  if (["checkbox", "check"].includes(t)) return "checkbox"
  if (["label", "heading", "static"].includes(t)) return "label"
  return "text"
}

function optionsToCsvValues(field) {
  const opts = field.options || field.choices || field.values
  if (Array.isArray(opts)) {
    return opts
      .map((o) => (typeof o === "string" ? o : o.value || o.label || ""))
      .filter(Boolean)
      .join(",")
  }
  if (typeof opts === "string" && opts.trim()) return opts.trim()
  if (normalizeDraftFieldType(field.type) === "radio" && !opts) return "Yes,No"
  return ""
}

/** @param {Record<string, unknown>} field @param {number} index */
export function draftFieldToControl(field, index) {
  const type = normalizeDraftFieldType(field.type)
  const label = String(field.label || field.name || field.title || `Field ${index + 1}`).trim()
  const id = field.id ? String(field.id) : slugId("ctrl", label || index)
  const csvValues = optionsToCsvValues(field)
  const properties = {
    labelText: label,
    labelPosition: "left",
    required: Boolean(field.required ?? field.mandatory),
    readonly: Boolean(field.readonly),
    placeholder: field.placeholder ? String(field.placeholder) : "",
    maxLength: field.maxLength != null ? Number(field.maxLength) : undefined,
    csvValues: type === "select" || type === "radio" ? csvValues : undefined,
  }

  return {
    id,
    type,
    label,
    controlSize: Number(field.controlSize) || 6,
    properties,
  }
}

/** @param {Record<string, unknown>} form */
export function draftFormToSections(form) {
  if (Array.isArray(form.sections) && form.sections.length > 0) {
    return form.sections.map((section, sIdx) => {
      const controls = Array.isArray(section.controls)
        ? section.controls
        : Array.isArray(section.fields)
          ? section.fields.map(draftFieldToControl)
          : []
      return {
        id: section.id ? String(section.id) : slugId("section", section.name || sIdx),
        name: String(section.name || form.name || `Section ${sIdx + 1}`),
        controls: controls.length
          ? controls.map((c, i) => (c.properties ? c : draftFieldToControl(c, i)))
          : [draftFieldToControl({ label: section.name || "Notes", type: "text" }, 0)],
      }
    })
  }

  const fields = form.fields || form.controls || []
  if (Array.isArray(fields) && fields.length > 0) {
    return [
      {
        id: slugId("section", form.id || form.name),
        name: String(form.name || "Main"),
        controls: fields.map(draftFieldToControl),
      },
    ]
  }

  return [
    {
      id: slugId("section", form.id || form.name),
      name: String(form.name || "Main"),
      controls: [
        draftFieldToControl(
          {
            id: slugId("field", form.id || form.name),
            label: `${form.name || "Form"} — add fields in CRF Studio review`,
            type: "text",
            required: false,
          },
          0,
        ),
      ],
    },
  ]
}

function mapDraftRules(form) {
  const raw = form.rules || form.editChecks || form.editCheckSuggestions || []
  if (!Array.isArray(raw)) return []
  return raw
    .map((rule, idx) =>
      normalizeRuleForBundle({
        id: rule.id || `studio_rule_${idx}`,
        ruleName: rule.ruleName || rule.name || `Rule ${idx + 1}`,
        category: rule.category || rule.ruleCategory || "Validation",
        expression: rule.expression || rule.ruleExpression || "",
        message: rule.message || "",
        severity: rule.severity || "Hard",
        targetField: rule.targetField || "",
        trigger: rule.trigger || "OnChange",
        controlType: rule.controlType || "Label",
        isActive: rule.isActive !== false,
      }),
    )
    .filter((r) => r.ruleName && r.expression)
}

/**
 * @param {{ draftTree: Record<string, unknown>, form: Record<string, unknown>, projectName?: string, visitNameById?: Record<string, string> }}
 */
export function buildCrfStudioFormBundle({ draftTree, form, projectName, visitNameById = {} }) {
  const visitName =
    visitNameById[form.visitId] ||
    form.visitName ||
    (Array.isArray(draftTree.visits) && draftTree.visits[0]?.name) ||
    "Screening"
  const crfFormType = resolveCrfFormTypeForBundle(
    form.crfFormType || crfFormTypeToDesignerVisitLabel(visitName),
  )
  const sections = draftFormToSections(form)
  const htmlContent = generateCrfHtmlFromSections(sections)
  const rules = mapDraftRules(form)

  return {
    meta: {
      bundleVersion: 1,
      includeRules: rules.length > 0,
      ruleCount: rules.length,
      exportedAt: new Date().toISOString(),
      source: "crf-studio",
      sourceProjectName: projectName || null,
    },
    design: {
      name: String(form.name || "Untitled CRF").trim(),
      description: String(form.description || draftTree.metadata?.title || "").trim(),
      htmlContent,
      remarks: projectName ? `CRF Studio project: ${projectName}` : "Exported from CRF Studio",
      isFinalPrint: false,
      status: "Draft",
      crfFormType,
      isScreenFailedCrf: Boolean(form.isScreenFailedCrf),
      isRandomizedEnrolledCrf: Boolean(form.isRandomizedEnrolledCrf),
      isStratificationCrf: Boolean(form.isStratificationCrf),
    },
    rules,
  }
}

/**
 * @param {Record<string, unknown>} draftTree
 * @param {{ projectName?: string }} [options]
 */
export function buildCrfStudioExportBundles(draftTree, { projectName } = {}) {
  const forms = Array.isArray(draftTree?.forms) ? draftTree.forms : []
  const visits = Array.isArray(draftTree?.visits) ? draftTree.visits : []
  const visitNameById = Object.fromEntries(
    visits.map((v) => [String(v.id), String(v.name || "")]).filter(([, name]) => name),
  )

  return forms.map((form) => {
    const bundle = buildCrfStudioFormBundle({ draftTree, form, projectName, visitNameById })
    const visitLabel =
      visitNameById[form.visitId] || form.visitName || bundle.design.crfFormType || "Screening"
    return {
      formId: form.id,
      formName: form.name || bundle.design.name,
      visitLabel,
      bundle,
    }
  })
}
