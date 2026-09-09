"use client"

import { MapPin, Microscope } from "lucide-react"
import { cn } from "@/lib/utils"

export default function EcrfWorkspaceContextNotice({ studyId, siteId, className }) {
  const hasStudy = studyId != null && studyId !== "" && !Number.isNaN(Number(studyId))
  const hasSite =
    siteId != null && siteId !== "" && !Number.isNaN(Number(siteId)) && Number(siteId) > 0

  if (hasStudy && hasSite) return null

  const needsStudy = !hasStudy
  const message = needsStudy
    ? "Select a study from the header bar to load the patient visit matrix."
    : "Select a site from the header bar to load patients and open CRF forms."

  return (
    <div
      className={cn(
        "flex shrink-0 items-start gap-3 rounded-2xl border border-amber-200/90 bg-amber-50/95 px-4 py-3 text-sm text-amber-950 shadow-sm",
        className,
      )}
      role="status"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
        {needsStudy ? <Microscope className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
      </span>
      <div className="min-w-0">
        <p className="font-semibold">{needsStudy ? "Study required" : "Site required"}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-amber-900/90 sm:text-sm">{message}</p>
      </div>
    </div>
  )
}
