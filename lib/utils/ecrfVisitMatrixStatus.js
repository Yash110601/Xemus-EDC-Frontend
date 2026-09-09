/**
 * Visit cell status for the eCRF patient × visit matrix (from patient list visitCrfData).
 */

import {
  aggregateVisitFieldProgressFromPatient,
  CRF_PROGRESS_STATUS,
  hasCrfProgressData,
  normalizeCrfProgress,
} from "@/lib/utils/crfProgress"
import { normalizeCrfQuerySummary } from "@/lib/utils/crfQuerySummary"

export const ECRF_MATRIX_STATUS = {
  completed: {
    id: "completed",
    label: "Completed",
    dot: "bg-emerald-500",
    card: "border-emerald-200/90 bg-gradient-to-b from-emerald-50 to-emerald-100/80",
    bar: "bg-emerald-500",
    text: "text-emerald-900",
    subtext: "text-emerald-700/80",
  },
  inprocess: {
    id: "inprocess",
    label: "In process",
    dot: "bg-amber-400",
    card: "border-amber-200/90 bg-gradient-to-b from-amber-50 to-amber-100/70",
    bar: "bg-amber-400",
    text: "text-amber-950",
    subtext: "text-amber-800/80",
  },
  pending: {
    id: "pending",
    label: "Pending",
    dot: "bg-slate-300",
    card: "border-slate-200/90 bg-gradient-to-b from-slate-50 to-white",
    bar: "bg-slate-300",
    text: "text-slate-800",
    subtext: "text-slate-500",
  },
  notdone: {
    id: "notdone",
    label: "Not done",
    dot: "bg-rose-500",
    card: "border-rose-200/90 bg-gradient-to-b from-rose-50 to-rose-100/70",
    bar: "bg-rose-500",
    text: "text-rose-950",
    subtext: "text-rose-700/80",
  },
  locked: {
    id: "locked",
    label: "Locked",
    dot: "bg-slate-400",
    card: "border-slate-200/80 bg-slate-100/80 opacity-75",
    bar: "bg-slate-300",
    text: "text-slate-600",
    subtext: "text-slate-500",
  },
}

export function deriveVisitStatusFromCrfInfo(visitCrfInfoByDesignId) {
  if (!visitCrfInfoByDesignId || typeof visitCrfInfoByDesignId !== "object") {
    return { status: "pending", progress: 0 }
  }

  const isLegacy =
    visitCrfInfoByDesignId.crfDesignId != null &&
    (visitCrfInfoByDesignId.status != null || "status" in visitCrfInfoByDesignId)

  const values = isLegacy
    ? [visitCrfInfoByDesignId]
    : Object.values(visitCrfInfoByDesignId).filter(
        (v) => v && typeof v === "object" && ("status" in v || "crfDataId" in v),
      )

  const statuses = values.map((x) => (x?.status ?? "").toString().toLowerCase())
  const totalForms = values.length
  if (totalForms === 0) return { status: "pending", progress: 0 }

  const isSubmitted = (s) => s === "submitted" || s === "3"
  const isDraftOrSaved = (s) => s === "draft" || s === "saved" || s === "2" || s === "1"

  const completedCount = statuses.filter(isSubmitted).length
  const inProgressCount = statuses.filter(isDraftOrSaved).length

  if (completedCount === totalForms) {
    return { status: "completed", progress: 100 }
  }

  if (completedCount > 0 || inProgressCount > 0) {
    const progress = Math.round((completedCount * 100 + inProgressCount * 50) / totalForms)
    return { status: "inprocess", progress }
  }

  return { status: "pending", progress: 0 }
}

function toScheduleKey(visitScheduleId) {
  if (visitScheduleId === undefined || visitScheduleId === null || visitScheduleId === "") return ""
  return String(visitScheduleId)
}

export function buildVisitCrfInfoByDesignId(patient, visitScheduleId) {
  const scheduleKey = toScheduleKey(visitScheduleId)
  if (!scheduleKey) return null

  const map = {}
  for (const vcd of patient?.visitCrfData || []) {
    if (toScheduleKey(vcd?.visitScheduleId) !== scheduleKey) continue
    const designKey = String(vcd?.crfDesignId ?? vcd?.crfDesignID ?? "unknown")
    map[designKey] = {
      crfDesignId: vcd?.crfDesignId,
      crfDataId: vcd?.crfDataId,
      status: vcd?.status,
    }
  }

  return Object.keys(map).length ? map : null
}

function isSdvEligibleCrfStatus(rawStatus) {
  const status = String(rawStatus ?? "")
    .trim()
    .toLowerCase()
  return status === "2" || status === "3" || status === "saved" || status === "submitted"
}

/** Patient-level SDV done / pending across Saved+Submitted CRFs. */
export function summarizePatientSdv(patient) {
  let done = 0
  let pending = 0
  for (const vcd of Array.isArray(patient?.visitCrfData) ? patient.visitCrfData : []) {
    if (!isSdvEligibleCrfStatus(vcd?.status)) continue
    if (Boolean(vcd?.isSdvVerify ?? vcd?.IsSdvVerify)) done += 1
    else pending += 1
  }
  return { done, pending, total: done + pending }
}

export function resolveMatrixVisitCell(patient, visit) {
  const visitScheduleId = visit?.visitScheduleId ?? visit?.id
  const crfInfo = buildVisitCrfInfoByDesignId(patient, visitScheduleId)
  const { status, progress } = deriveVisitStatusFromCrfInfo(crfInfo)

  const matchedEntries = (patient?.visitCrfData || []).filter(
    (vcd) => toScheduleKey(vcd?.visitScheduleId) === toScheduleKey(visitScheduleId),
  )

  let openQueries = 0
  let totalQueries = 0
  let sdvDone = 0
  let sdvPending = 0
  matchedEntries.forEach((entry) => {
    const qs = entry?.querySummary
    if (qs && typeof qs === "object") {
      openQueries += Number(qs.open ?? qs.Open ?? 0) || 0
      totalQueries += Number(qs.total ?? qs.Total ?? 0) || 0
    }
    if (!isSdvEligibleCrfStatus(entry?.status)) return
    if (Boolean(entry?.isSdvVerify ?? entry?.IsSdvVerify)) sdvDone += 1
    else sdvPending += 1
  })

  const fieldProgress = aggregateVisitFieldProgressFromPatient(patient, visitScheduleId)
  const hasFieldProgress = fieldProgress.requiredFieldCount > 0

  let progressPercent = hasFieldProgress ? fieldProgress.progressPercent : progress
  let completedRequiredFieldCount = fieldProgress.completedRequiredFieldCount
  const requiredFieldCount = fieldProgress.requiredFieldCount

  // All forms submitted → visit is Completed; align field counts with that label.
  if (status === "completed") {
    progressPercent = 100
    if (requiredFieldCount > 0) completedRequiredFieldCount = requiredFieldCount
  }

  return {
    status,
    progressPercent,
    requiredFieldCount,
    completedRequiredFieldCount,
    hasFieldProgress,
    openQueries,
    totalQueries,
    sdvDone,
    sdvPending,
    sdvTotal: sdvDone + sdvPending,
    hasData: matchedEntries.length > 0,
  }
}

/** Patient-row CRF progress — sum visit cells so it matches the matrix (not raw API aggregate). */
export function resolvePatientMatrixProgress(patient, visitColumns = []) {
  if (!patient) return normalizeCrfProgress(null)

  const columns = Array.isArray(visitColumns) ? visitColumns : []
  if (columns.length > 0) {
    let requiredFieldCount = 0
    let completedRequiredFieldCount = 0
    let hasFieldProgress = false

    for (const visit of columns) {
      const cell = resolveMatrixVisitCell(patient, visit)
      if (!cell.hasFieldProgress) continue
      hasFieldProgress = true
      requiredFieldCount += cell.requiredFieldCount
      completedRequiredFieldCount += cell.completedRequiredFieldCount
    }

    if (hasFieldProgress && requiredFieldCount > 0) {
      const progressPercent = Math.min(
        100,
        Math.round((completedRequiredFieldCount / requiredFieldCount) * 100),
      )
      let progressStatus = CRF_PROGRESS_STATUS.NOT_STARTED
      if (completedRequiredFieldCount >= requiredFieldCount) {
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
  }

  return normalizeCrfProgress(patient?.progress ?? patient?.Progress)
}

export function countPatientOpenQueries(patient, visitColumns) {
  if (!patient || !Array.isArray(visitColumns) || !visitColumns.length) return 0

  let openQueries = 0
  visitColumns.forEach((visit) => {
    openQueries += resolveMatrixVisitCell(patient, visit).openQueries
  })
  return openQueries
}

/** True when a visit CRF row has open or in-process queries (blocks SDV / PI like single-CRF flow). */
export function visitCrfHasOpenQueries(vcd) {
  const qs = normalizeCrfQuerySummary(vcd?.querySummary ?? vcd?.QuerySummary)
  return qs.open > 0 || qs.inProcess > 0
}

/**
 * Bulk All-visits SDV / PI only when visits are fully filled and no open queries remain.
 * Matches single-CRF flow: resolve queries → re-SDV → then PI; bulk is scope-only.
 */
export function isPatientReadyForBulkReview(patient, visitColumns = []) {
  if (!patient) {
    return { ready: false, reason: "no_patient", openQueryCount: 0 }
  }

  const columns = Array.isArray(visitColumns) ? visitColumns : []
  const openFromCells = countPatientOpenQueries(patient, columns)
  const patientQs = normalizeCrfQuerySummary(patient.querySummary ?? patient.QuerySummary)
  let openFromVisitCrfs = 0
  for (const vcd of Array.isArray(patient.visitCrfData) ? patient.visitCrfData : []) {
    const qs = normalizeCrfQuerySummary(vcd?.querySummary ?? vcd?.QuerySummary)
    openFromVisitCrfs += qs.open + qs.inProcess
  }
  const openQueryCount = Math.max(openFromCells, patientQs.open + patientQs.inProcess, openFromVisitCrfs)
  if (openQueryCount > 0) {
    return { ready: false, reason: "open_queries", openQueryCount }
  }

  const progress = resolvePatientMatrixProgress(patient, columns)
  if (hasCrfProgressData(progress)) {
    const allFilled =
      progress.progressStatus === CRF_PROGRESS_STATUS.COMPLETED ||
      (progress.requiredFieldCount > 0 &&
        progress.completedRequiredFieldCount >= progress.requiredFieldCount)
    if (!allFilled) {
      return { ready: false, reason: "incomplete_data", openQueryCount: 0 }
    }
    return { ready: true, reason: null, openQueryCount: 0 }
  }

  const vcds = Array.isArray(patient.visitCrfData) ? patient.visitCrfData : []
  if (vcds.length === 0) {
    return { ready: false, reason: "incomplete_data", openQueryCount: 0 }
  }

  const allCrfsFilled = vcds.every((vcd) => {
    const status = String(vcd?.status ?? "").trim().toLowerCase()
    return status === "2" || status === "3" || status === "saved" || status === "submitted"
  })
  if (!allCrfsFilled) {
    return { ready: false, reason: "incomplete_data", openQueryCount: 0 }
  }

  return { ready: true, reason: null, openQueryCount: 0 }
}

/** First patient with the highest open-query count in the matrix (tie: list order). */
export function findPatientWithMostOpenQueries(patients, visitColumns) {
  if (!Array.isArray(patients) || !patients.length) return null

  let bestPatient = null
  let bestCount = 0
  patients.forEach((patient) => {
    const count = countPatientOpenQueries(patient, visitColumns)
    if (count > bestCount) {
      bestCount = count
      bestPatient = patient
    }
  })

  return bestCount > 0 ? bestPatient : null
}

export function summarizeMatrixVisits(patients, visitColumns) {
  if (!Array.isArray(patients) || !Array.isArray(visitColumns) || !visitColumns.length) {
    return { total: 0, completed: 0, inProcess: 0, pending: 0, avgProgress: 0, openQueries: 0 }
  }

  let completed = 0
  let inProcess = 0
  let pending = 0
  let progressSum = 0
  let openQueries = 0
  const cellCount = patients.length * visitColumns.length

  patients.forEach((patient) => {
    visitColumns.forEach((visit) => {
      const cell = resolveMatrixVisitCell(patient, visit)
      if (cell.status === "completed") completed += 1
      else if (cell.status === "inprocess") inProcess += 1
      else pending += 1
      progressSum += cell.progressPercent
      openQueries += cell.openQueries
    })
  })

  return {
    total: cellCount,
    completed,
    inProcess,
    pending,
    avgProgress: cellCount ? Math.round(progressSum / cellCount) : 0,
    openQueries,
  }
}
