/**
 * Apply designer "Default Value" from CRF controls into flat eCRF form data.
 */

function getFormControls(form) {
  const sections =
    form?.crfDesign?.sections?.length > 0
      ? form.crfDesign.sections
      : form?.section?.controls?.length
        ? [form.section]
        : []
  return sections.flatMap((s) => s.controls || []).filter((c) => c?.id)
}

function hasMeaningfulDefault(raw) {
  if (raw === undefined || raw === null) return false
  if (raw === 0 || raw === "0") return true
  return String(raw).trim() !== ""
}

/**
 * Discrete option control types that must NOT receive a pre-populated designer
 * `defaultValue` on fresh CRF open.
 *
 * Why: a pre-selected radio / checkbox / dropdown is visually indistinguishable
 * from a user-entered selection. In a regulated EDC context that creates audit /
 * SDV ambiguity (CRA cannot tell investigator intent from auto-fill), and a
 * "Save" click would persist the default into the database as if the
 * investigator had entered it. Text / number / date defaults remain allowed
 * because users always see them as already-filled inputs and routinely edit
 * them — those carry no audit ambiguity.
 *
 * If a study ever truly needs a radio/checkbox pre-fill (e.g. seeded
 * "Withdrawn? No" workflow), reintroduce it behind an explicit per-control
 * `applyDefaultOnLoad: true` flag — never as the implicit default.
 */
const DISCRETE_OPTION_TYPES_SKIPPED_FROM_DESIGNER_DEFAULTS = new Set([
  "radio",
  "radiobutton",
  "optionbutton",
  "checkbox",
  "select",
  "dropdown",
  "combobox",
  "searchableselect",
  "optionlist",
])

function normalizeControlTypeToken(rawType) {
  return String(rawType || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, "")
}

function isDiscreteOptionControlSkippedFromDesignerDefaults(control) {
  const token = normalizeControlTypeToken(
    control?.type || control?.properties?.controlType,
  )
  return DISCRETE_OPTION_TYPES_SKIPPED_FROM_DESIGNER_DEFAULTS.has(token)
}

/**
 * @param {object} control
 * @param {unknown} rawDefault
 * @returns {string|boolean|null} value for flat formData
 */
export function normalizeDesignerDefaultValue(control, rawDefault) {
  if (!hasMeaningfulDefault(rawDefault)) return null
  const type = String(control?.type || control?.properties?.controlType || "text").toLowerCase()
  if (type === "checkbox") {
    const s = String(rawDefault).trim()
    if (!s) return null
    if (s.includes(",")) return s
    if (s === "true" || s === "1") return true
    if (s === "false" || s === "0") return false
    return s
  }
  if (type === "number") {
    const n = Number(rawDefault)
    if (Number.isFinite(n)) return String(rawDefault).trim()
    return String(rawDefault).trim()
  }
  return String(rawDefault).trim()
}

/**
 * @param {Record<string, unknown>} flatData
 * @param {object} form
 * @param {{ onlyMissing?: boolean }} [options]
 * @returns {Record<string, unknown>}
 */
export function applyDesignerDefaultValues(flatData = {}, form, options = {}) {
  const onlyMissing = options.onlyMissing !== false
  const out = { ...(flatData || {}) }
  const controls = getFormControls(form)

  for (const control of controls) {
    const id = String(control.id || "").trim()
    if (!id) continue

    // Audit-safety: never auto-populate radio / checkbox / select / dropdown
    // with a designer-configured default. See the constant above for rationale.
    if (isDiscreteOptionControlSkippedFromDesignerDefaults(control)) continue

    const rawDefault = control.properties?.defaultValue
    const value = normalizeDesignerDefaultValue(control, rawDefault)
    if (value === null) continue

    if (onlyMissing) {
      // Treat `null` / `undefined` / `""` as "missing" — NOT just key-absent.
      //
      // Why: on save, `buildNestedFormDataForSave` emits a node for EVERY
      // designed control (even ones the user never touched) with
      // `value: null`. On reload, `flattenCrfFormData` extracts that
      // `.value` so the flat data has `{ ctrl_x: null }`. A pure
      // key-existence check would then treat the field as "already set"
      // and skip the designer default — leaving text / number / date
      // fields blank in eCRF data entry even though the CRF design
      // declared a default value.
      //
      // Audit-safety note: this DOES mean a user who explicitly clears a
      // defaulted text/number/date field and saves will see the default
      // reappear on next open. That matches the typical EDC mental model
      // ("default = the form's pre-filled state") and the user can clear
      // again if they truly want it blank. Discrete option types
      // (radio / checkbox / select / dropdown) are still completely
      // exempt — see the discrete-option skip list above for the audit
      // rationale around those.
      const existing = flatData[id]
      const hasMeaningfulExisting =
        existing !== null &&
        existing !== undefined &&
        !(typeof existing === "string" && existing.trim() === "")
      if (hasMeaningfulExisting) continue
    }

    out[id] = value
  }

  return out
}
