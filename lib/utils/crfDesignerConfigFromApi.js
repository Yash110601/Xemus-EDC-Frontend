/**
 * Normalize API / list-row CRF data into the shape expected by CRFConfiguration + CRFDesigner.
 * Fixes: missing isScreenFailedCrf / isRandomizedEnrolledCrf on edit, and isFinalPrint "Yes"/"No" vs "Y"/"N".
 */

export function normalizeIsFinalPrintForDesigner(value) {
  if (value === "Y" || value === "N") return value
  if (value === true || value === "Yes" || value === "yes") return "Y"
  if (value === false || value === "No" || value === "no") return "N"
  return ""
}

export function normalizeBoolForDesigner(value) {
  return value === true || value === "true" || value === 1 || value === "1"
}

/**
 * @param {object} crfRow - CRF from API (getById) or list item; top-level fields win over nested config.
 * @param {object|null|undefined} nestedConfig - optional `config` from list JSON or prior state
 */
export function buildCrfDesignerConfigFromApi(crfRow, nestedConfig) {
  const base = nestedConfig && typeof nestedConfig === "object" ? { ...nestedConfig } : {}
  const row = crfRow && typeof crfRow === "object" ? crfRow : {}

  const nameFromRow = row.name != null ? String(row.name).trim() : ""
  const nameFromBase = base.name != null ? String(base.name).trim() : ""

  return {
    ...base,
    name: nameFromRow !== "" ? row.name : nameFromBase !== "" ? base.name : "",
    description: row.description != null ? row.description : base.description ?? "",
    remarks: row.remarks != null ? row.remarks : base.remarks ?? "",
    isFinalPrint: normalizeIsFinalPrintForDesigner(
      row.isFinalPrint !== undefined && row.isFinalPrint !== null ? row.isFinalPrint : base.isFinalPrint
    ),
    isScreenFailedCrf: normalizeBoolForDesigner(
      row.isScreenFailedCrf !== undefined && row.isScreenFailedCrf !== null
        ? row.isScreenFailedCrf
        : base.isScreenFailedCrf
    ),
    isRandomizedEnrolledCrf: normalizeBoolForDesigner(
      row.isRandomizedEnrolledCrf !== undefined && row.isRandomizedEnrolledCrf !== null
        ? row.isRandomizedEnrolledCrf
        : base.isRandomizedEnrolledCrf
    ),
    isStratificationCrf: normalizeBoolForDesigner(
      row.isStratificationCrf !== undefined && row.isStratificationCrf !== null
        ? row.isStratificationCrf
        : base.isStratificationCrf
    ),
  }
}
