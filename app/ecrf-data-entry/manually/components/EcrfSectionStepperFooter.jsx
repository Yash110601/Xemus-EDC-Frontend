"use client"

import { memo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

/**
 * Phase 3b-4 — Section prev/next stepper in the sticky CRF footer.
 */
const EcrfSectionStepperFooter = memo(function EcrfSectionStepperFooter({
  dataEntrySectionStepper,
  onSectionTabChange,
}) {
  if (!dataEntrySectionStepper?.show) return null

  return (
    <div
      className="flex shrink-0 items-center gap-0.5"
      role="navigation"
      aria-label="CRF sections"
    >
      <button
        type="button"
        data-section-nav="prev"
        aria-label={
          dataEntrySectionStepper.prevId ? "Previous section" : "First section — no previous"
        }
        title={dataEntrySectionStepper.prevTooltip}
        disabled={!dataEntrySectionStepper.prevId}
        onClick={() =>
          dataEntrySectionStepper.prevId && onSectionTabChange(dataEntrySectionStepper.prevId)
        }
        className="inline-flex h-11 min-w-11 items-center justify-center rounded-xl text-slate-700 transition-colors hover:bg-emerald-50/95 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/45 disabled:pointer-events-none disabled:opacity-35"
      >
        <ChevronLeft className="h-5 w-5 shrink-0" aria-hidden />
      </button>
      <span
        className="min-w-[3.25rem] select-none px-1 text-center text-sm font-semibold tabular-nums tracking-tight text-slate-700"
        aria-live="polite"
      >
        {dataEntrySectionStepper.positionLabel}
      </span>
      <button
        type="button"
        data-section-nav="next"
        aria-label={dataEntrySectionStepper.nextId ? "Next section" : "Last section — no next"}
        title={dataEntrySectionStepper.nextTooltip}
        disabled={!dataEntrySectionStepper.nextId}
        onClick={() =>
          dataEntrySectionStepper.nextId && onSectionTabChange(dataEntrySectionStepper.nextId)
        }
        className="inline-flex h-11 min-w-11 items-center justify-center rounded-xl text-slate-700 transition-colors hover:bg-emerald-50/95 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/45 disabled:pointer-events-none disabled:opacity-35"
      >
        <ChevronRight className="h-5 w-5 shrink-0" aria-hidden />
      </button>
    </div>
  )
})

export default EcrfSectionStepperFooter
