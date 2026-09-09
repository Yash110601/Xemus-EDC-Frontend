/**
 * Form Validation Helper
 * Validates CRF form values against control properties and rules
 */

import {
  evaluateRule,
  createFieldLabelMap,
  isCrfRuleVerbose,
  sanitizeCrfRuleMessage,
  isDateRestrictionRule,
  normalizeRuleCategory,
  decodeHtmlEntities,
} from "./ruleEvaluator"

const normalizeGenderToken = (raw) => {
  const s = String(raw || "").trim().toLowerCase()
  if (!s) return ""
  if (["m", "male"].includes(s)) return "male"
  if (["f", "female"].includes(s)) return "female"
  if (["both", "all", "any"].includes(s)) return "both"
  return s
}

export const isControlApplicableByGender = (control, patientGender) => {
  const controlGender = normalizeGenderToken(control?.properties?.genderSpecific || "both")
  if (!controlGender || controlGender === "both") return true
  const normalizedPatientGender = normalizeGenderToken(patientGender)
  // If patient gender is missing/unknown, keep backward-compatible behavior (do not hide/skip).
  if (!normalizedPatientGender) return true
  return controlGender === normalizedPatientGender
}

/**
 * True when the rule expression is only cross-field date comparisons (ctrl_a >= ctrl_b, &&/||/parens).
 * Used to skip designer "validation" rows that duplicate date-restriction intent on final submit.
 */
function isDateRelationOnlyExpression(expression) {
  const s = decodeHtmlEntities(String(expression || ""))
    .replace(/\s+/g, " ")
    .trim()
  if (!s || !/\bctrl_/.test(s)) return false
  const remainder = s
    .replace(
      /\bctrl_[A-Za-z0-9_]+\b\s*(>=|<=|===|!==|==|!=|>|<)\s*\bctrl_[A-Za-z0-9_]+\b/g,
      "",
    )
    .trim()
  if (remainder.length >= s.length) return false
  return /^[()&|\s]+$/.test(remainder)
}

/**
 * Validate a single control value
 * @param {Object} control - Control object with properties
 * @param {any} value - Current value
 * @param {Object} allFormValues - All form values for rule evaluation
 * @param {{ skipDateRestrictionValidation?: boolean, patientGender?: string }} [options]
 * - skipDateRestrictionValidation: when true (e.g. final submit), do not block on date-restriction/date-order validation rules.
 * - patientGender: used to evaluate gender-specific applicability for required validation.
 * @returns {Object} - { isValid: boolean, errors: string[] }
 *
 * Query modals (manual/system "Actual value") should call this with the same rule-aware control as data entry
 * (`getRuleAwareControl` + `resolveEvaluatedControlForQueryField` in `app/ecrf-data-entry/manually/page.jsx`).
 * Add new field rules here (or in control props evaluated into `control`); do not duplicate validation only for query UI.
 */
export const validateControl = (control, value, allFormValues = {}, options = {}) => {
  const { skipDateRestrictionValidation = false, patientGender = "" } = options
  const errors = []
  const props = control.properties || {}
  const controlType = String(control.type || "").toLowerCase()
  const isGenderApplicable = isControlApplicableByGender(control, patientGender)
  const isUkUnkDateComplete = (rawValue) => {
    const raw = String(rawValue ?? "").trim()
    if (!raw) return false
    const [day = "", month = "", year = ""] = raw.split("-")
    if (!day || !month || !year) return false
    const normalizedDay = day.toUpperCase()
    const normalizedMonth = month.toUpperCase()
    const dayValid = normalizedDay === "UK" || (/^\d+$/.test(day) && Number(day) >= 1 && Number(day) <= 31)
    const monthValid = normalizedMonth === "UNK" || [
      "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
      "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
    ].includes(normalizedMonth)
    const yearValid = /^\d{4}$/.test(year)
    return dayValid && monthValid && yearValid
  }
  const ukUnkDateComplete = controlType === "ukunkdate" ? isUkUnkDateComplete(value) : true

  // Table required validation: validate by cell keys (controlId_row_R_col_C), not by control.id value.
  if (controlType === "table") {
    // Gender-specific applicability: non-applicable controls must not block submit.
    if (!isGenderApplicable) {
      return { isValid: true, errors: [] }
    }
    // If whole table is readonly (e.g. disabled by rule), skip required validation.
    if (props.readonly) {
      return { isValid: true, errors: [] }
    }

    const baseId = control.id
    const numCols = Math.max(1, Number(props.columns || 1))
    const designRows = Math.max(1, Number(props.rows || 1))
    const addRowEnabled = props.addRow === true
    const rowCountKey = `${baseId}_rowCount`
    const rowCountFromForm = addRowEnabled ? parseInt(allFormValues[rowCountKey], 10) : NaN
    const numRows =
      addRowEnabled && !Number.isNaN(rowCountFromForm) && rowCountFromForm > 0
        ? Math.max(designRows, rowCountFromForm)
        : designRows

    const hasValue = (v) => {
      if (v === null || v === undefined) return false
      if (typeof v === "string") return v.trim() !== ""
      if (Array.isArray(v)) return v.length > 0
      return true
    }
    const getCellValue = (rowIdx, colIdx) => allFormValues[`${baseId}_row_${rowIdx}_col_${colIdx}`]
    const tableCellRuleProps = (props.tableCellRuleProps && typeof props.tableCellRuleProps === "object")
      ? props.tableCellRuleProps
      : {}
    const isCellReadonlyByRule = (rowIdx, colIdx) => {
      const cellRule = tableCellRuleProps[`${rowIdx}_${colIdx}`]
      return Boolean(cellRule?.readonly)
    }
    const requiredCells = Array.isArray(props.requiredCells)
      ? props.requiredCells.filter((c) => c && c.row != null && c.col != null)
      : []
    const requiredColumn = requiredCells.length === 0 && props.requiredColumn != null
      ? parseInt(props.requiredColumn, 10)
      : null
    const requiredRow = requiredCells.length === 0 && props.requiredRow != null
      ? parseInt(props.requiredRow, 10)
      : null
    const mapTemplateRow = (rowIdx) =>
      addRowEnabled && rowIdx >= designRows ? 0 : rowIdx

    // Highest priority: explicit required cells
    if (requiredCells.length > 0) {
      for (let row = 0; row < numRows; row++) {
        const templateRow = mapTemplateRow(row)
        requiredCells.forEach((cell) => {
          const reqRow = parseInt(cell.row, 10)
          const colIdx = parseInt(cell.col, 10)
          if (Number.isNaN(reqRow) || Number.isNaN(colIdx)) return
          if (reqRow !== templateRow) return
          if (colIdx < 0 || colIdx >= numCols) return
          if (isCellReadonlyByRule(row, colIdx)) return
          if (!hasValue(getCellValue(row, colIdx))) {
            errors.push(`${control.label || control.id} - Row ${row + 1}, Col ${colIdx + 1} is required`)
          }
        })
      }
    } else {
      // Backward-compatible fallback: required column or required row (first column marker behavior)
      if (requiredColumn != null && !Number.isNaN(requiredColumn) && requiredColumn >= 0 && requiredColumn < numCols) {
        for (let row = 0; row < numRows; row++) {
          if (isCellReadonlyByRule(row, requiredColumn)) continue
          if (!hasValue(getCellValue(row, requiredColumn))) {
            errors.push(`${control.label || control.id} - Row ${row + 1}, Col ${requiredColumn + 1} is required`)
          }
        }
      }
      if (requiredRow != null && !Number.isNaN(requiredRow) && requiredRow >= 0) {
        const col = 0
        const rowsToValidate =
          addRowEnabled && requiredRow === 0
            ? Array.from({ length: numRows }, (_, i) => i)
            : requiredRow < numRows
              ? [requiredRow]
              : []
        for (const rowIdx of rowsToValidate) {
          if (isCellReadonlyByRule(rowIdx, col)) continue
          if (!hasValue(getCellValue(rowIdx, col))) {
            errors.push(`${control.label || control.id} - Row ${rowIdx + 1}, Col ${col + 1} is required`)
          }
        }
      }
    }

    // CRF-level / designer rules: per-cell conditional required (merged into tableCellRuleProps).
    for (let row = 0; row < numRows; row++) {
      for (let col = 0; col < numCols; col++) {
        const cellRule = tableCellRuleProps[`${row}_${col}`]
        if (!cellRule?.conditionallyRequired || cellRule?.hidden) continue
        if (isCellReadonlyByRule(row, col)) continue
        if (!hasValue(getCellValue(row, col))) {
          errors.push(
            sanitizeCrfRuleMessage(cellRule.requiredIfMessage) ||
              `${control.label || control.id} - Row ${row + 1}, Col ${col + 1} is required`
          )
        }
      }
    }
  }

  // Required field validation - skip when control is readonly (e.g. disabled by rule when "Other" not selected)
  if (
    controlType !== "table" &&
    isGenderApplicable &&
    (props.required || props.conditionallyRequired) &&
    !props.readonly
  ) {
    if (controlType === "ukunkdate") {
      if (!ukUnkDateComplete) {
        errors.push(`${control.label || control.id} is required`)
      }
    } else if (value === null || value === undefined || value === "" || 
        (Array.isArray(value) && value.length === 0)) {
      errors.push(`${control.label || control.id} is required`)
    }
  }
  if (controlType === "ukunkdate" && value !== null && value !== undefined && String(value).trim() !== "") {
    if (!ukUnkDateComplete && !(props.required || props.conditionallyRequired)) {
      errors.push(`${control.label || control.id} must include day, month, and year (use UK/UNK when unknown)`)
    }
  }

  // Min/Max validation for numbers
  if (control.type === "number" && value !== null && value !== undefined && value !== "") {
    const numValue = parseFloat(value)
    if (isNaN(numValue)) {
      errors.push(`${control.label || control.id} must be a valid number`)
    } else {
      if (props.min !== null && props.min !== undefined && numValue < props.min) {
        errors.push(`${control.label || control.id} must be at least ${props.min}`)
      }
      if (props.max !== null && props.max !== undefined && numValue > props.max) {
        errors.push(`${control.label || control.id} must be at most ${props.max}`)
      }
    }
  }

  // Max length validation for text
  if ((control.type === "text" || control.type === "textarea") && value) {
    if (props.maxLength && value.length > props.maxLength) {
      errors.push(`${control.label || control.id} must be at most ${props.maxLength} characters`)
    }
  }

  // Control-level rule validation
  if (props.rules && Array.isArray(props.rules)) {
    props.rules.forEach(rule => {
      const ruleCat = normalizeRuleCategory(
        rule.ruleCategory || rule.category || rule.Category,
      )
      if (ruleCat !== "validation") return

      if (skipDateRestrictionValidation) {
        if (isDateRestrictionRule(rule)) return
        const expr = rule.ruleExpression || rule.expression || ""
        if (isDateRelationOnlyExpression(expr)) return
      }

      try {
        // Create label map for this control
        const labelMap = {}
        const controlLabel = control.label || control.properties?.labelText
        if (controlLabel) {
          labelMap[control.id] = controlLabel
          labelMap[controlLabel] = allFormValues[control.id]
        } else {
          labelMap[control.id] = control.id
        }

        const exprForEval = rule.ruleExpression || rule.expression || ""
        const validationRuleMeta = isCrfRuleVerbose()
          ? {
              log: "control",
              source: "formValidation:validateControl",
              ruleId: rule.id,
              ruleName: rule.ruleName,
              ruleCategory: rule.ruleCategory,
              targetControlId: control.id,
            }
          : {}
        const conditionMet = evaluateRule(
          exprForEval,
          allFormValues,
          labelMap,
          validationRuleMeta,
        )
        if (conditionMet) {
          errors.push(sanitizeCrfRuleMessage(rule.message || rule.ruleName || "Validation rule failed"))
        }
      } catch (error) {
        console.warn(`Error evaluating validation rule for ${control.id}:`, error)
        try {
          const exprForFallback = rule.ruleExpression || rule.expression || ""
          const conditionMet = evaluateSimpleRule(exprForFallback, allFormValues, control.label)
          if (conditionMet) {
            errors.push(sanitizeCrfRuleMessage(rule.message || rule.ruleName || "Validation rule failed"))
          }
        } catch (fallbackError) {
          console.warn(`Fallback validation rule evaluation failed for ${control.id}:`, fallbackError)
        }
      }
    })
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validate all controls in a CRF design
 * @param {Object} crfDesign - CRF design with sections and controls
 * @param {Object} formValues - Current form values
 * @returns {Object} - { isValid: boolean, errors: { controlId: string[] } }
 */
export const validateCRFForm = (crfDesign, formValues) => {
  const allErrors = {}
  let isValid = true

  if (!crfDesign || !crfDesign.sections) {
    return { isValid: false, errors: { general: ["Invalid CRF design"] } }
  }

  crfDesign.sections.forEach(section => {
    if (section.controls && Array.isArray(section.controls)) {
      section.controls.forEach(control => {
        // Skip hidden controls
        if (control.properties?.hidden) {
          return
        }

        const value = formValues[control.id]
        const validation = validateControl(control, value, formValues)

        if (!validation.isValid) {
          isValid = false
          allErrors[control.id] = validation.errors
        }
      })
    }
  })

  return {
    isValid,
    errors: allErrors
  }
}

/**
 * Simple rule evaluation (for validation rules)
 * This is a simplified version - full evaluation uses ruleEvaluator.js
 */
const evaluateSimpleRule = (expression, formValues, fieldLabel) => {
  if (!expression) return false

  try {
    // Replace field references with values
    let evalExpr = expression
    Object.keys(formValues).forEach(key => {
      const value = formValues[key]
      const regex = new RegExp(`\\b${key}\\b`, 'g')
      if (value !== undefined && value !== null) {
        evalExpr = evalExpr.replace(regex, typeof value === 'string' ? `"${value}"` : value)
      }
    })

    // Replace field label with value if found
    if (fieldLabel) {
      const regex = new RegExp(`\\b${fieldLabel}\\b`, 'g')
      const fieldValue = Object.values(formValues).find(v => v !== undefined && v !== null)
      if (fieldValue !== undefined) {
        evalExpr = evalExpr.replace(regex, typeof fieldValue === 'string' ? `"${fieldValue}"` : fieldValue)
      }
    }

    // Safe evaluation
    const result = new Function('return ' + evalExpr)()
    return Boolean(result)
  } catch (error) {
    console.warn("Error evaluating validation rule:", error)
    return false
  }
}
