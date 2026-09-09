/** CRF required-field progress from grid + GetCrfProgress APIs (req §8.1). */

export const CRF_PROGRESS_STATUS = {
  NOT_STARTED: "NotStarted",
  IN_PROGRESS: "InProgress",
  COMPLETED: "Completed",
}

const EMPTY_PROGRESS = Object.freeze({
  requiredFieldCount: 0,
  completedRequiredFieldCount: 0,
  progressPercent: 0,
  progressStatus: CRF_PROGRESS_STATUS.NOT_STARTED,
  sections: [],
})

function readInt(raw, camelKey, pascalKey) {
  const value = raw?.[camelKey] ?? raw?.[pascalKey]
  const n = Number.parseInt(String(value ?? 0), 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function normalizeProgressStatus(raw) {
  const value = String(raw ?? "").trim()
  if (value === CRF_PROGRESS_STATUS.COMPLETED) return CRF_PROGRESS_STATUS.COMPLETED
  if (value === CRF_PROGRESS_STATUS.IN_PROGRESS || value === "In Progress") {
    return CRF_PROGRESS_STATUS.IN_PROGRESS
  }
  return CRF_PROGRESS_STATUS.NOT_STARTED
}

function normalizeSectionProgress(raw) {
  if (!raw || typeof raw !== "object") return null
  const requiredFieldCount = readInt(raw, "requiredFieldCount", "RequiredFieldCount")
  let completedRequiredFieldCount = readInt(raw, "completedRequiredFieldCount", "CompletedRequiredFieldCount")
  const progressStatus = normalizeProgressStatus(raw.progressStatus ?? raw.ProgressStatus)
  let progressPercent = Math.min(100, Math.max(0, readInt(raw, "progressPercent", "ProgressPercent")))
  if (progressStatus === CRF_PROGRESS_STATUS.COMPLETED) {
    progressPercent = 100
    if (requiredFieldCount > 0) completedRequiredFieldCount = requiredFieldCount
  }
  return {
    sectionId: String(raw.sectionId ?? raw.SectionId ?? ""),
    sectionName: String(raw.sectionName ?? raw.SectionName ?? "").trim(),
    requiredFieldCount,
    completedRequiredFieldCount,
    progressPercent,
    progressStatus,
  }
}

function isCrfSubmittedStatus(rawStatus) {
  const normalized = String(rawStatus ?? "").trim().toLowerCase()
  return normalized === "3" || normalized === "submitted" || normalized === "completed" || normalized === "locked"
}

/** Accept camelCase or PascalCase API payloads. */
export function normalizeCrfProgress(raw) {
  if (!raw || typeof raw !== "object") return { ...EMPTY_PROGRESS }

  const requiredFieldCount = readInt(raw, "requiredFieldCount", "RequiredFieldCount")
  let completedRequiredFieldCount = readInt(raw, "completedRequiredFieldCount", "CompletedRequiredFieldCount")
  let progressPercent = Math.min(100, Math.max(0, readInt(raw, "progressPercent", "ProgressPercent")))
  const progressStatus = normalizeProgressStatus(raw.progressStatus ?? raw.ProgressStatus)

  if (progressStatus === CRF_PROGRESS_STATUS.COMPLETED) {
    progressPercent = 100
    if (requiredFieldCount > 0) completedRequiredFieldCount = requiredFieldCount
  }
  if (progressStatus === CRF_PROGRESS_STATUS.NOT_STARTED && progressPercent === 0) {
    progressPercent = 0
  }

  const sectionsRaw = raw.sections ?? raw.Sections
  const sections = Array.isArray(sectionsRaw)
    ? sectionsRaw.map(normalizeSectionProgress).filter(Boolean)
    : []

  return {
    requiredFieldCount,
    completedRequiredFieldCount,
    progressPercent,
    progressStatus,
    sections,
  }
}

export function getCrfProgressStatusLabel(status) {
  switch (normalizeProgressStatus(status)) {
    case CRF_PROGRESS_STATUS.COMPLETED:
      return "Completed"
    case CRF_PROGRESS_STATUS.IN_PROGRESS:
      return "In Progress"
    default:
      return "Not Started"
  }
}

/** @returns {"completed"|"inProgress"|"notStarted"} */
export function getCrfProgressTone(progress) {
  const normalized = normalizeCrfProgress(progress)
  if (normalized.progressStatus === CRF_PROGRESS_STATUS.COMPLETED || normalized.progressPercent >= 100) {
    return "completed"
  }
  if (normalized.progressStatus === CRF_PROGRESS_STATUS.IN_PROGRESS || normalized.progressPercent > 0) {
    return "inProgress"
  }
  return "notStarted"
}

export function getVisitProgressFromPatient(patient, visitScheduleId) {
  if (patient == null || visitScheduleId == null || visitScheduleId === "") {
    return { ...EMPTY_PROGRESS }
  }

  const scheduleKey = String(visitScheduleId)
  const list = Array.isArray(patient?.visitCrfData) ? patient.visitCrfData : []
  const cell = list.find((vcd) => String(vcd?.visitScheduleId ?? "") === scheduleKey)
  return normalizeCrfProgress(cell?.progress ?? cell?.Progress)
}

/** Sum required-field progress across all CRF rows for one visit schedule. */
export function aggregateVisitFieldProgressFromPatient(patient, visitScheduleId) {
  if (patient == null || visitScheduleId == null || visitScheduleId === "") {
    return { ...EMPTY_PROGRESS }
  }

  const scheduleKey = String(visitScheduleId)
  const rows = (Array.isArray(patient?.visitCrfData) ? patient.visitCrfData : []).filter(
    (vcd) => String(vcd?.visitScheduleId ?? "") === scheduleKey,
  )

  if (!rows.length) return { ...EMPTY_PROGRESS }

  let requiredFieldCount = 0
  let completedRequiredFieldCount = 0

  for (const row of rows) {
    const progress = normalizeCrfProgress(row?.progress ?? row?.Progress)
    requiredFieldCount += progress.requiredFieldCount
    // Submitted CRF rows count as fully complete for visit-level field progress.
    if (isCrfSubmittedStatus(row?.status) && progress.requiredFieldCount > 0) {
      completedRequiredFieldCount += progress.requiredFieldCount
    } else {
      completedRequiredFieldCount += progress.completedRequiredFieldCount
    }
  }

  const progressPercent =
    requiredFieldCount > 0
      ? Math.min(100, Math.round((completedRequiredFieldCount / requiredFieldCount) * 100))
      : 0

  let progressStatus = CRF_PROGRESS_STATUS.NOT_STARTED
  if (requiredFieldCount > 0 && completedRequiredFieldCount >= requiredFieldCount) {
    progressStatus = CRF_PROGRESS_STATUS.COMPLETED
  } else if (completedRequiredFieldCount > 0) {
    progressStatus = CRF_PROGRESS_STATUS.IN_PROGRESS
  }

  return {
    requiredFieldCount,
    completedRequiredFieldCount,
    progressPercent,
    progressStatus,
    sections: [],
  }
}

export function hasCrfProgressData(progress) {
  const normalized = normalizeCrfProgress(progress)
  return (
    normalized.requiredFieldCount > 0 ||
    normalized.progressPercent > 0 ||
    normalized.progressStatus !== CRF_PROGRESS_STATUS.NOT_STARTED
  )
}

export { EMPTY_PROGRESS as EMPTY_CRF_PROGRESS }
