"use client"

import { memo } from "react"
import { CrfLabSectionTabAffix } from "@/components/crf-designer/CrfLabSectionBanner"

/**
 * Phase 3b-4 — Section tab strip for multi-section CRF data entry.
 * Memoized so typing in fields does not rebuild tab buttons unless section list / errors change.
 */
const EcrfSectionTabs = memo(function EcrfSectionTabs({
  sectionsWithContent,
  effectiveActiveId,
  deferredSectionValidationSummary,
  highlightSectionErrors,
  setSectionTabButtonRef,
  onSectionTabChange,
}) {
  if (!sectionsWithContent?.length) return null

  return (
    <div className="sticky top-2 z-10 -mx-1 max-w-full rounded-2xl border border-slate-200/75 bg-white p-2 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.45)]">
      <div className="w-full overflow-x-auto overflow-y-hidden pb-1">
        <div className="flex w-max min-w-full items-center gap-2">
          {sectionsWithContent.map((section) => {
            const sectionErrorCount = Number(
              deferredSectionValidationSummary.counts[String(section.id)] || 0,
            )
            const hasSectionError = highlightSectionErrors && sectionErrorCount > 0
            return (
              <button
                key={section.id}
                type="button"
                data-audit-transition="section-tab"
                data-section-id={String(section.id)}
                ref={setSectionTabButtonRef}
                onClick={() => onSectionTabChange(section.id)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${
                  effectiveActiveId === section.id
                    ? "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-200/90"
                    : hasSectionError
                      ? "bg-rose-50 text-rose-700 ring-1 ring-rose-300/80 hover:bg-rose-100/90"
                      : "bg-slate-50/90 text-slate-600 hover:bg-emerald-50/80 hover:text-emerald-900"
                }`}
              >
                <CrfLabSectionTabAffix section={section} />
                {section.name}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
})

export default EcrfSectionTabs
