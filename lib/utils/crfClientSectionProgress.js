import { CRF_PROGRESS_STATUS } from "@/lib/utils/crfProgress"

const normalizeGender = (raw) => {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
  if (!s || s === "both" || s === "all" || s === "any") return "both"
  if (s === "m" || s === "male") return "male"
  if (s === "f" || s === "female") return "female"
  return s
}

const isGenderApplicable = (control, patient) => {
  const controlGender = normalizeGender(control?.properties?.genderSpecific || "both")
  if (controlGender === "both") return true
  const patientGender = normalizeGender(patient?.gender)
  if (!patientGender) return true
  return controlGender === patientGender
}

const isVisibleForProgress = (evaluatedControl, patient) => {
  if (!evaluatedControl) return false
  if (Boolean(evaluatedControl?.properties?.hidden)) return false
  return isGenderApplicable(evaluatedControl, patient)
}

const isRequiredControl = (evaluatedControl) =>
  Boolean(evaluatedControl?.properties?.required || evaluatedControl?.properties?.conditionallyRequired)

const getTableDimensions = (props, controlId, formValues) => {
  const numCols = Math.max(1, Number(props?.columns || 1))
  const designRows = Math.max(1, Number(props?.rows || 1))
  const addRowEnabled = props?.addRow === true
  const rowCountKey = `${controlId}_rowCount`
  const rowCountFromForm = addRowEnabled ? Number.parseInt(String(formValues?.[rowCountKey] ?? ""), 10) : NaN
  const numRows =
    addRowEnabled && Number.isFinite(rowCountFromForm) && rowCountFromForm > 0
      ? Math.max(designRows, rowCountFromForm)
      : designRows
  return { numCols, numRows, designRows, addRowEnabled }
}

const mapTemplateRow = (rowIdx, designRows, addRowEnabled) =>
  addRowEnabled && rowIdx >= designRows ? 0 : rowIdx

const isTableCellExcludedFromProgress = (props, rowIdx, colIdx) => {
  const cellRule = props?.tableCellRuleProps?.[`${rowIdx}_${colIdx}`]
  if (cellRule?.hidden) return true
  if (cellRule?.readonly) return true
  return false
}

const accumulateTableProgress = ({
  controlId,
  props,
  formValues,
  valueIsFilled,
  requiredFieldCount,
  completedRequiredFieldCount,
  countedKeys,
}) => {
  let required = requiredFieldCount
  let completed = completedRequiredFieldCount
  const { numCols, numRows, designRows, addRowEnabled } = getTableDimensions(props, controlId, formValues)
  const tableCellRuleProps =
    props?.tableCellRuleProps && typeof props.tableCellRuleProps === "object"
      ? props.tableCellRuleProps
      : {}

  const tryCountCell = (rowIdx, colIdx) => {
    const flatKey = `${controlId}_row_${rowIdx}_col_${colIdx}`
    if (countedKeys.has(flatKey)) return
    if (isTableCellExcludedFromProgress(props, rowIdx, colIdx)) return
    countedKeys.add(flatKey)
    required += 1
    if (valueIsFilled(formValues[flatKey])) completed += 1
  }

  const requiredCells = Array.isArray(props?.requiredCells)
    ? props.requiredCells.filter((cell) => cell?.row != null && cell?.col != null)
    : []

  if (requiredCells.length > 0) {
    for (let row = 0; row < numRows; row += 1) {
      const templateRow = mapTemplateRow(row, designRows, addRowEnabled)
      requiredCells.forEach((cell) => {
        const reqRow = Number.parseInt(String(cell.row ?? ""), 10)
        const colIdx = Number.parseInt(String(cell.col ?? ""), 10)
        if (!Number.isFinite(reqRow) || !Number.isFinite(colIdx)) return
        if (reqRow !== templateRow) return
        if (colIdx < 0 || colIdx >= numCols) return
        tryCountCell(row, colIdx)
      })
    }
  } else {
    const requiredColumn = Number.parseInt(String(props?.requiredColumn ?? ""), 10)
    if (Number.isFinite(requiredColumn) && requiredColumn >= 0 && requiredColumn < numCols) {
      for (let row = 0; row < numRows; row += 1) {
        tryCountCell(row, requiredColumn)
      }
    }

    const requiredRow = Number.parseInt(String(props?.requiredRow ?? ""), 10)
    if (Number.isFinite(requiredRow) && requiredRow >= 0) {
      const rowsToCount =
        addRowEnabled && requiredRow === 0
          ? Array.from({ length: numRows }, (_, i) => i)
          : requiredRow < numRows
            ? [requiredRow]
            : []
      rowsToCount.forEach((rowIdx) => tryCountCell(rowIdx, 0))
    }
  }

  for (let row = 0; row < numRows; row += 1) {
    for (let col = 0; col < numCols; col += 1) {
      const cellRule = tableCellRuleProps[`${row}_${col}`]
      if (!cellRule?.conditionallyRequired) continue
      tryCountCell(row, col)
    }
  }

  return { requiredFieldCount: required, completedRequiredFieldCount: completed }
}

const resolveProgressStatus = (progressPercent) => {
  if (progressPercent >= 100) return CRF_PROGRESS_STATUS.COMPLETED
  if (progressPercent > 0) return CRF_PROGRESS_STATUS.IN_PROGRESS
  return CRF_PROGRESS_STATUS.NOT_STARTED
}

/**
 * Live section progress from current form values + rule-evaluated visibility.
 * Hidden-by-rule required fields are excluded (Yes/No branching).
 */
export function computeClientSectionProgress({
  sectionId,
  controls = [],
  formValues = {},
  evaluatedControlsById = {},
  patient = null,
  hasMeaningfulValue,
}) {
  const safeSectionId = String(sectionId || "").trim()
  if (!safeSectionId) return null

  const valueIsFilled =
    typeof hasMeaningfulValue === "function"
      ? hasMeaningfulValue
      : (value) => {
          if (value == null) return false
          const s = String(value).trim()
          return s !== "" && s !== "undefined" && s !== "null"
        }

  let requiredFieldCount = 0
  let completedRequiredFieldCount = 0
  const countedKeys = new Set()

  for (const control of controls) {
    const controlId = String(control?.id || "").trim()
    if (!controlId) continue

    const evaluated = evaluatedControlsById[controlId] || control
    if (!isVisibleForProgress(evaluated, patient)) continue

    const controlType = String(control?.type || evaluated?.type || "").toLowerCase()
    if (controlType === "table") {
      const next = accumulateTableProgress({
        controlId,
        props: evaluated?.properties || {},
        formValues,
        valueIsFilled,
        requiredFieldCount,
        completedRequiredFieldCount,
        countedKeys,
      })
      requiredFieldCount = next.requiredFieldCount
      completedRequiredFieldCount = next.completedRequiredFieldCount
      continue
    }

    if (!isRequiredControl(evaluated)) continue

    requiredFieldCount += 1
    if (valueIsFilled(formValues[controlId])) completedRequiredFieldCount += 1
  }

  const progressPercent =
    requiredFieldCount > 0
      ? Math.min(100, Math.round((completedRequiredFieldCount / requiredFieldCount) * 100))
      : 0

  return {
    sectionId: safeSectionId,
    requiredFieldCount,
    completedRequiredFieldCount,
    progressPercent,
    progressStatus: resolveProgressStatus(progressPercent),
  }
}

/** Merge live section progress into API progress for the open form. */
export function mergeLiveSectionProgress(apiProgress, liveSectionProgress) {
  if (!liveSectionProgress) return apiProgress

  const base = apiProgress?.sections?.length
    ? { ...apiProgress, sections: [...apiProgress.sections] }
    : { sections: [], requiredFieldCount: 0, completedRequiredFieldCount: 0, progressPercent: 0, progressStatus: "NotStarted" }

  const idx = base.sections.findIndex(
    (section) => String(section?.sectionId) === String(liveSectionProgress.sectionId),
  )
  if (idx >= 0) {
    base.sections[idx] = { ...base.sections[idx], ...liveSectionProgress }
  } else {
    base.sections.push(liveSectionProgress)
  }

  const requiredFieldCount = base.sections.reduce((sum, s) => sum + (Number(s?.requiredFieldCount) || 0), 0)
  const completedRequiredFieldCount = base.sections.reduce(
    (sum, s) => sum + (Number(s?.completedRequiredFieldCount) || 0),
    0,
  )
  const progressPercent =
    requiredFieldCount > 0
      ? Math.min(100, Math.round((completedRequiredFieldCount / requiredFieldCount) * 100))
      : 0

  return {
    ...base,
    requiredFieldCount,
    completedRequiredFieldCount,
    progressPercent,
    progressStatus: resolveProgressStatus(progressPercent),
  }
}
