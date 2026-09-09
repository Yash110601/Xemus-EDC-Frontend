/**
 * Rule Engine Contracts
 *
 * Shared canonical shapes used by the compiler/runtime pipeline.
 * Keep these contracts framework-agnostic so UI code can consume
 * stable runtime patches without embedding business logic.
 */

export const RULE_ACTION_TYPES = Object.freeze({
  VISIBILITY: "visibility",
  READONLY: "readonly",
  REQUIRED: "required",
  COMPUTE: "compute",
  DATE_BOUND: "date_bound",
  VALIDATION: "validation",
  SUBMIT_GUARD: "submit_guard",
  SIDE_EFFECT: "side_effect",
})

export const RULE_SCOPE_TYPES = Object.freeze({
  FORM: "form",
  SECTION: "section",
  FIELD: "field",
  TABLE: "table",
  TABLE_CELL: "table_cell",
})

/**
 * Create a canonical target descriptor.
 * @param {Object} input
 * @returns {{
 *  scope: string,
 *  fieldId: string|null,
 *  tableId: string|null,
 *  row: number|null,
 *  col: number|null
 * }}
 */
export function createCanonicalTarget(input = {}) {
  return {
    scope: input.scope || RULE_SCOPE_TYPES.FIELD,
    fieldId: input.fieldId || null,
    tableId: input.tableId || null,
    row: Number.isFinite(Number(input.row)) ? Number(input.row) : null,
    col: Number.isFinite(Number(input.col)) ? Number(input.col) : null,
  }
}

/**
 * Create a canonical rule representation (IR-like object).
 * @param {Object} input
 * @returns {{
 *  id: string,
 *  version: number,
 *  name: string,
 *  priority: number,
 *  enabled: boolean,
 *  sourceCategory: string,
 *  conditionExpression: string,
 *  dependencies: string[],
 *  targets: Array,
 *  action: { type: string, payload: Object },
 *  message: string,
 *  severity: string
 * }}
 */
export function createCanonicalRule(input = {}) {
  return {
    id: String(input.id ?? ""),
    version: Number.isFinite(Number(input.version)) ? Number(input.version) : 1,
    name: String(input.name || ""),
    priority: Number.isFinite(Number(input.priority)) ? Number(input.priority) : 0,
    enabled: input.enabled !== false,
    sourceCategory: String(input.sourceCategory || ""),
    conditionExpression: String(input.conditionExpression || ""),
    dependencies: Array.isArray(input.dependencies)
      ? [...new Set(input.dependencies.map((d) => String(d || "").trim()).filter(Boolean))]
      : [],
    targets: Array.isArray(input.targets)
      ? input.targets.map((t) => createCanonicalTarget(t))
      : [],
    action: {
      type: input?.action?.type || RULE_ACTION_TYPES.SIDE_EFFECT,
      payload: input?.action?.payload && typeof input.action.payload === "object"
        ? { ...input.action.payload }
        : {},
    },
    message: String(input.message || ""),
    severity: String(input.severity || "SOFT").toUpperCase(),
  }
}

/**
 * Runtime patch envelope consumed by UI state layer.
 * @param {Object} input
 * @returns {{
 *  changedFieldIds: string[],
 *  fieldPatches: Record<string, Object>,
 *  validationPatches: Record<string, string[]>,
 *  traces: Array<Object>,
 *  meta: Object
 * }}
 */
export function createRuntimePatch(input = {}) {
  return {
    changedFieldIds: Array.isArray(input.changedFieldIds)
      ? [...new Set(input.changedFieldIds.map((id) => String(id || "").trim()).filter(Boolean))]
      : [],
    fieldPatches:
      input.fieldPatches && typeof input.fieldPatches === "object" ? { ...input.fieldPatches } : {},
    validationPatches:
      input.validationPatches && typeof input.validationPatches === "object"
        ? { ...input.validationPatches }
        : {},
    traces: Array.isArray(input.traces) ? [...input.traces] : [],
    meta: input.meta && typeof input.meta === "object" ? { ...input.meta } : {},
  }
}
