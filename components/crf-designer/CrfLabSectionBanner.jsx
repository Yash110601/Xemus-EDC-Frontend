"use client"

import { FlaskConical } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  SECTION_TYPE_LAB,
  normalizeCrfSection,
} from "@/lib/utils/crfLabSection"

/**
 * Distinguishes laboratory sections in preview and eCRF data entry.
 */
export function CrfLabSectionBanner({
  section,
  className,
  /** "designer" | "preview" | "entry" — subtle spacing tweaks */
  variant = "entry",
}) {
  const normalized = normalizeCrfSection(section)
  if (normalized.sectionType !== SECTION_TYPE_LAB) return null

  const label = normalized.labBinding?.labFacilityLabel?.trim()
  const fid = normalized.labBinding?.labFacilityId
  const hasBinding = fid != null && String(fid).trim() !== ""

  const padding =
    variant === "designer"
      ? "px-4 py-3"
      : variant === "preview"
        ? "px-4 py-3 mb-6"
        : "px-4 py-3 mb-4"

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl border border-teal-200/95 bg-gradient-to-r from-teal-50 via-emerald-50/90 to-teal-50 shadow-sm dark:border-teal-900/55 dark:from-teal-950/50 dark:via-emerald-950/40 dark:to-teal-950/50",
        padding,
        className,
      )}
      role="region"
      aria-label="Laboratory section"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white shadow dark:bg-teal-500">
        <FlaskConical className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-800 dark:text-teal-200">
          Laboratory section
        </p>
        {hasBinding ? (
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {label || `Lab facility #${fid}`}
          </p>
        ) : (
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            No lab facility on this capture yet — choose the facility in eCRF data entry for this section.
          </p>
        )}
      </div>
    </div>
  )
}

export function CrfLabSectionTabAffix({ section }) {
  const normalized = normalizeCrfSection(section)
  if (normalized.sectionType !== SECTION_TYPE_LAB) return null
  return (
    <FlaskConical
      className="h-3.5 w-3.5 shrink-0 opacity-90"
      aria-hidden
      title="Laboratory section"
    />
  )
}
