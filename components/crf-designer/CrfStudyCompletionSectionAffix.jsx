"use client"

import { ClipboardCheck } from "lucide-react"
import {
  getStudyCompletionStatusLabel,
  getStudyCompletionStatusCode,
  isStudyCompletionStatusSection,
} from "@/lib/crfDesigner/studyCompletionFormDesigner"

export function CrfStudyCompletionSectionTabAffix({ section }) {
  if (!isStudyCompletionStatusSection(section)) return null
  const code = getStudyCompletionStatusCode(section)
  const label = getStudyCompletionStatusLabel(code)
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-md bg-teal-500/20 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-100"
      title={label ? `Status: ${label}` : "Study completion status"}
    >
      <ClipboardCheck className="h-2.5 w-2.5 shrink-0" aria-hidden />
    </span>
  )
}

export function CrfStudyCompletionSectionCanvasBanner({ section }) {
  if (!isStudyCompletionStatusSection(section)) return null
  const code = getStudyCompletionStatusCode(section)
  const label = getStudyCompletionStatusLabel(code) || section?.name
  return (
    <p className="mb-4 rounded-lg border border-teal-200/90 bg-teal-50/50 px-3 py-2 text-xs text-teal-900/90">
      <span className="font-semibold">Sub-section — {label}.</span> Fields here apply only to this
      patient status within the Study Completion section.
    </p>
  )
}
