"use client"

import { cn } from "@/lib/utils"
import {
  getCrfProgressStatusLabel,
  getCrfProgressTone,
  normalizeCrfProgress,
} from "@/lib/utils/crfProgress"
import CrfProgressBar from "@/components/ecrf/CrfProgressBar"
import { resolveSectionProgressTitle } from "@/components/ecrf/data-entry/EcrfSectionProgressList"

const TONE_STYLES = {
  completed: "text-emerald-600",
  inProgress: "text-orange-600",
  notStarted: "text-slate-500",
}

/**
 * Shows progress for the currently selected CRF section tab only.
 */
export default function CrfSectionProgressPanel({
  progress,
  formSections = [],
  activeSectionId = null,
  loading = false,
  className,
}) {
  const normalized = normalizeCrfProgress(progress)
  const effectiveSectionId =
    activeSectionId && formSections.some((s) => String(s?.id) === String(activeSectionId))
      ? activeSectionId
      : formSections[0]?.id ?? null

  const activeSectionProgress = effectiveSectionId
    ? normalized.sections.find((section) => String(section.sectionId) === String(effectiveSectionId))
    : null

  const sectionTitle = resolveSectionProgressTitle(
    activeSectionProgress || { sectionId: effectiveSectionId },
    formSections,
  )

  const sectionProgress = activeSectionProgress || {
    progressPercent: 0,
    progressStatus: "NotStarted",
    requiredFieldCount: 0,
    completedRequiredFieldCount: 0,
  }

  const hasSectionData =
    Boolean(activeSectionProgress) ||
    normalized.sections.length > 0 ||
    normalized.requiredFieldCount > 0 ||
    formSections.length > 0

  if (!loading && !hasSectionData) {
    return null
  }

  const tone = getCrfProgressTone(sectionProgress)

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/75 bg-white/95 p-4 shadow-[0_12px_28px_-20px_rgba(15,23,42,0.25)]",
        className,
      )}
      role="region"
      aria-label={`Section progress: ${sectionTitle}`}
    >
      {loading ? (
        <div className="animate-pulse space-y-3" role="status" aria-busy="true" aria-label="Loading section progress">
          <div className="flex items-center justify-between gap-2">
            <div className="h-4 w-40 rounded bg-slate-200/90" />
            <div className="h-4 w-10 rounded bg-slate-200/90" />
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200/90" />
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="min-w-0 truncate text-sm font-bold uppercase tracking-[0.02em] text-slate-900">
              {sectionTitle}
            </h3>
            <span className={cn("shrink-0 text-xs font-semibold", TONE_STYLES[tone])}>
              {getCrfProgressStatusLabel(sectionProgress.progressStatus)} · {sectionProgress.progressPercent}%
            </span>
          </div>

          <CrfProgressBar
            progress={sectionProgress}
            label="Section progress"
            showStatus={false}
            showCounts={sectionProgress.requiredFieldCount > 0}
          />
        </>
      )}
    </div>
  )
}
