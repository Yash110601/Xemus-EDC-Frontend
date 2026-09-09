"use client"

import { cn } from "@/lib/utils"
import { getCrfProgressTone } from "@/lib/utils/crfProgress"

const TONE_STYLES = {
  completed: { bar: "bg-emerald-500", text: "text-emerald-600" },
  inProgress: { bar: "bg-orange-500", text: "text-orange-600" },
  notStarted: { bar: "bg-slate-300", text: "text-slate-500" },
}

export function resolveSectionProgressTitle(section, formSections = []) {
  const explicit = String(section?.sectionName ?? "").trim()
  if (explicit) return explicit

  const id = String(section?.sectionId ?? "")
  if (!id) return "Section"

  const match = (Array.isArray(formSections) ? formSections : []).find(
    (item) => String(item?.id ?? "") === id,
  )
  return match?.name || match?.title || match?.label || `Section ${id.slice(0, 8)}`
}

/**
 * Section-by-section CRF completion list (matches eCRF "BY SECTION" panel).
 */
export default function EcrfSectionProgressList({
  sections = [],
  formSections = [],
  loading = false,
  compact = false,
  className,
  title = "By section",
}) {
  if (loading) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-slate-200/75 bg-white/95 p-4 shadow-sm",
          className,
        )}
        role="status"
        aria-busy="true"
        aria-label="Loading section progress"
      >
        <div className="animate-pulse space-y-3">
          <div className="h-2.5 w-24 rounded bg-slate-200/90" />
          {Array.from({ length: compact ? 3 : 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-2.5 w-full rounded bg-slate-200/80" />
              <div className="h-1.5 w-full rounded-full bg-slate-200/70" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!sections.length) return null

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/75 bg-white/95 shadow-[0_12px_28px_-20px_rgba(15,23,42,0.2)]",
        compact ? "p-3" : "p-4",
        className,
      )}
      role="region"
      aria-label="CRF progress by section"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{title}</p>
      <div className={cn("space-y-3", compact ? "mt-2.5" : "mt-3")}>
        {sections.map((section) => {
          const tone = getCrfProgressTone(section)
          const styles = TONE_STYLES[tone]
          const label = resolveSectionProgressTitle(section, formSections)

          return (
            <div key={section.sectionId || `${label}-${section.progressPercent}`} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate font-medium uppercase text-slate-700",
                    compact ? "text-[10px]" : "text-xs",
                  )}
                  title={label}
                >
                  {label}
                </span>
                <span
                  className={cn(
                    "shrink-0 font-bold tabular-nums",
                    compact ? "text-[10px]" : "text-xs",
                    styles.text,
                  )}
                >
                  {section.progressPercent}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/60">
                <div
                  className={cn("h-full transition-all duration-500", styles.bar)}
                  style={{ width: `${section.progressPercent}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
