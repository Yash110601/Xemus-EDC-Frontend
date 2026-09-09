/** Save / submit workflow progress — section-wise from progress.sections[] when available. */

import { CRF_PROGRESS_STATUS, normalizeCrfProgress } from "@/lib/utils/crfProgress"

function normalizeCrfWorkflowStatusCode(rawStatus) {
  const normalized = String(rawStatus ?? "")
    .trim()
    .toLowerCase()
  if (normalized === "3" || normalized === "submitted" || normalized === "completed" || normalized === "locked") {
    return 3
  }
  if (
    normalized === "2" ||
    normalized === "saved" ||
    normalized === "inprogress" ||
    normalized === "inprocess"
  ) {
    return 2
  }
  return 1
}

function statusCodeFromFormStatus(formStatus) {
  const value = String(formStatus ?? "").toLowerCase()
  if (value === "completed") return 3
  if (value === "inprogress") return 2
  return 1
}

function getExpectedVisitFormCount(visit) {
  if (Array.isArray(visit?.crfDesigns) && visit.crfDesigns.length > 0) {
    return visit.crfDesigns.length
  }
  if (visit?.crfDesignId != null && visit?.crfDesignId !== "") return 1
  return 0
}

function readVisitCrfInfoValues(visitCrfInfoByDesignId) {
  if (!visitCrfInfoByDesignId || typeof visitCrfInfoByDesignId !== "object") return []

  const isLegacy =
    visitCrfInfoByDesignId.crfDesignId != null &&
    (visitCrfInfoByDesignId.status != null || "status" in visitCrfInfoByDesignId)

  return isLegacy
    ? [visitCrfInfoByDesignId]
    : Object.values(visitCrfInfoByDesignId).filter(
        (entry) => entry && typeof entry === "object" && ("status" in entry || "crfDataId" in entry),
      )
}

function toPositiveRowNumber(value) {
  const n = Number.parseInt(String(value ?? ""), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Collect per-form workflow status codes for a visit (1=draft, 2=saved, 3=submitted).
 */
export function getVisitFormStatusEntries({
  visit,
  visitCrfDataMap = {},
  selectedPatient = null,
  formsForVisit = [],
  getRepeatableKindFromValue = () => null,
}) {
  if (Array.isArray(formsForVisit) && formsForVisit.length > 0) {
    return formsForVisit.map((form) => ({
      statusCode: statusCodeFromFormStatus(form?.status),
    }))
  }

  if (visit?.isRepeatableGroup) {
    const entries = Array.isArray(selectedPatient?.visitCrfData) ? selectedPatient.visitCrfData : []
    const wantedRows = new Set(
      (visit.repeatableRowNumbers || []).map((n) => toPositiveRowNumber(n)).filter(Boolean),
    )
    const matchedEntries = entries.filter((row) => {
      const kind =
        getRepeatableKindFromValue(row?.crfFormType) ||
        getRepeatableKindFromValue(row?.visitType) ||
        getRepeatableKindFromValue(row?.visitName)
      const rowNumber = toPositiveRowNumber(row?.rowNumber)
      return kind === visit.repeatableKind && rowNumber != null && wantedRows.has(rowNumber)
    })

    if (matchedEntries.length > 0) {
      return matchedEntries.map((entry) => ({
        statusCode: normalizeCrfWorkflowStatusCode(entry?.status),
      }))
    }
  }

  const scheduleKey =
    visit?.visitScheduleId != null && visit?.visitScheduleId !== ""
      ? String(visit.visitScheduleId)
      : null
  const visitCrfInfoByDesignId = scheduleKey ? visitCrfDataMap[scheduleKey] : null
  const values = readVisitCrfInfoValues(visitCrfInfoByDesignId)

  if (values.length > 0) {
    return values.map((entry) => ({
      statusCode: normalizeCrfWorkflowStatusCode(entry?.status),
    }))
  }

  const expectedTotal = getExpectedVisitFormCount(visit)
  if (expectedTotal > 0) {
    return Array.from({ length: expectedTotal }, () => ({ statusCode: 1 }))
  }

  return []
}

function buildWorkflowProgress(completed, total, unit = "forms") {
  const safeTotal = Math.max(0, total)
  const safeCompleted = Math.min(Math.max(0, completed), safeTotal)
  const progressPercent = safeTotal > 0 ? Math.round((safeCompleted / safeTotal) * 100) : 0

  return {
    progressPercent,
    progressStatus:
      safeTotal > 0 && safeCompleted === safeTotal
        ? "Completed"
        : safeCompleted > 0
          ? "InProgress"
          : "NotStarted",
    requiredFieldCount: safeTotal,
    completedRequiredFieldCount: safeCompleted,
    unit,
  }
}

function isSectionSaved(section) {
  const status = section?.progressStatus
  return (
    status === CRF_PROGRESS_STATUS.IN_PROGRESS ||
    status === CRF_PROGRESS_STATUS.COMPLETED ||
    Number(section?.progressPercent) > 0 ||
    Number(section?.completedRequiredFieldCount) > 0
  )
}

function isSectionSubmitted(section) {
  const status = section?.progressStatus
  return status === CRF_PROGRESS_STATUS.COMPLETED || Number(section?.progressPercent) >= 100
}

/**
 * Section-wise save/submit from progress.sections[] (grid or GetCrfProgress).
 * Save = sections with data entered; Submit = sections at 100% required fields.
 */
export function computeVisitSectionWorkflowProgress(visitProgress) {
  const normalized = normalizeCrfProgress(visitProgress)
  const sections = normalized.sections
  if (!sections.length) return null

  const total = sections.length
  const savedCount = sections.filter(isSectionSaved).length
  const submittedCount = sections.filter(isSectionSubmitted).length

  return {
    save: buildWorkflowProgress(savedCount, total, "sections"),
    submit: buildWorkflowProgress(submittedCount, total, "sections"),
    sectionTotal: total,
    savedCount,
    submittedCount,
    unit: "sections",
  }
}

/**
 * @returns {{ save, submit, formTotal, savedCount, submittedCount, unit } | null}
 */
export function computeVisitWorkflowProgress(params) {
  const entries = getVisitFormStatusEntries(params)
  const total = entries.length
  if (total === 0) return null

  const savedCount = entries.filter((entry) => entry.statusCode >= 2).length
  const submittedCount = entries.filter((entry) => entry.statusCode === 3).length

  return {
    save: buildWorkflowProgress(savedCount, total, "forms"),
    submit: buildWorkflowProgress(submittedCount, total, "forms"),
    formTotal: total,
    savedCount,
    submittedCount,
    unit: "forms",
  }
}

/** Resolve primary crfDataId for GetCrfProgress without loading full form payloads. */
export function getPrimaryCrfDataIdForVisit({
  visit,
  visitCrfDataMap = {},
  formsForVisit = [],
}) {
  if (Array.isArray(formsForVisit) && formsForVisit.length > 0) {
    const form = formsForVisit.find((item) => item?.crfDataId) || formsForVisit[0]
    if (form?.crfDataId) return form.crfDataId
  }

  const scheduleKey =
    visit?.visitScheduleId != null && visit?.visitScheduleId !== ""
      ? String(visit.visitScheduleId)
      : null
  const visitCrfInfoByDesignId = scheduleKey ? visitCrfDataMap[scheduleKey] : null
  const values = readVisitCrfInfoValues(visitCrfInfoByDesignId)
  const withId = values.find((entry) => entry?.crfDataId)
  return withId?.crfDataId ?? null
}

/**
 * Prefer section-wise workflow; fall back to form-wise when sections[] is empty.
 */
export function computeVisitWorkflowProgressBestEffort(visitProgress, formParams) {
  const sectionWorkflow = computeVisitSectionWorkflowProgress(visitProgress)
  if (sectionWorkflow) return sectionWorkflow
  return computeVisitWorkflowProgress(formParams)
}
