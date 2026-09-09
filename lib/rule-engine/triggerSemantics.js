/**
 * Mirrors legacy ruleEvaluator trigger semantics for enable/disable on tables vs cell ids.
 */

function expressionReferencesControlId(expression, controlId) {
  if (!expression || !controlId) return false
  const esc = String(controlId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  try {
    return new RegExp(`\\b${esc}\\b`).test(String(expression))
  } catch {
    return String(expression).includes(String(controlId))
  }
}

export function expressionUsesTableCellIdsPrefixedByControl(expression, controlId) {
  if (!expression || !controlId) return false
  const esc = String(controlId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  try {
    return new RegExp(`${esc}_row_\\d+_col_\\d+`).test(String(expression))
  } catch {
    return false
  }
}

export function resolveReadonlyForEnableDisable({
  mode,
  conditionMet,
  fieldId,
  expression,
  controlTypesById,
}) {
  const expr = String(expression || "")
  const fid = String(fieldId || "").trim()
  const ctype = String(controlTypesById?.get?.(fid) || "").toLowerCase()
  const isTableControl = ctype === "table"
  const exprTargetsTableCells = expressionUsesTableCellIdsPrefixedByControl(expr, fid)

  if (isTableControl && exprTargetsTableCells) {
    return { skip: true, readonly: false }
  }

  const isTrigger =
    Boolean(fid) &&
    expressionReferencesControlId(expr, fid) &&
    !expressionUsesTableCellIdsPrefixedByControl(expr, fid)

  if (mode === "disable") {
    return { skip: false, readonly: isTrigger ? false : Boolean(conditionMet) }
  }
  if (mode === "enable") {
    return { skip: false, readonly: isTrigger ? false : !Boolean(conditionMet) }
  }
  return { skip: false, readonly: false }
}
