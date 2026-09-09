import { hasCrfQueryActivity } from "@/lib/utils/crfQuerySummary"
import { normalizeCrfProgress } from "@/lib/utils/crfProgress"
import { deriveVisitStatusFromCrfInfo } from "@/lib/utils/ecrfVisitMatrixStatus"

export function computeVisitInsights({
  visitProgress,
  visitQuerySummary,
  visitData,
  formsForVisit = [],
}) {
  const progress = normalizeCrfProgress(visitProgress ?? visitData?.progress)
  const derived = visitData?.status
    ? {
        status: visitData.status,
        progress: visitData.progress ?? progress.progressPercent ?? 0,
      }
    : deriveVisitStatusFromCrfInfo(null)

  const submitStatus =
    derived.status === "completed"
      ? "completed"
      : derived.status === "inprocess"
        ? "inprocess"
        : "pending"

  const formCount = formsForVisit.length
  const completedForms = formsForVisit.filter((f) => f.status === "completed").length
  const inProgressForms = formsForVisit.filter((f) => f.status === "inprogress").length

  const fieldsTotal = progress.requiredTotal ?? progress.fieldsTotal ?? 0
  const fieldsCompleted = progress.requiredCompleted ?? progress.fieldsCompleted ?? 0
  const fieldsRemaining = Math.max(0, fieldsTotal - fieldsCompleted)

  const queries = {
    open: visitQuerySummary?.open ?? 0,
    total: visitQuerySummary?.total ?? 0,
  }

  return {
    submitStatus,
    progress,
    fieldsTotal,
    fieldsCompleted,
    fieldsRemaining,
    formCount,
    completedForms,
    inProgressForms,
    queries,
  }
}

export function hasVisitQueryActivity(summary) {
  return hasCrfQueryActivity(summary)
}
