"use client"

import {
  Building2,
  ClipboardList,
  FileText,
  MapPin,
  Pill,
} from "lucide-react"
import { cn } from "@/lib/utils"

function displayValue(value) {
  const text = String(value ?? "").trim()
  return text || ""
}

function GroupLabel({ children }) {
  return (
    <p className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7C8B85]">
      <span>{children}</span>
      <span className="h-px flex-1 bg-[#E5EBE9]" aria-hidden />
    </p>
  )
}

function FieldRow({ icon: Icon, label, value, drugTag = false }) {
  const text = displayValue(value)
  const isEmpty = !text

  return (
    <div className="flex items-center gap-3">
      <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] border border-[#E5EBE9] bg-white text-[#047857]">
        <Icon className="h-[17px] w-[17px]" strokeWidth={2} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-col leading-snug">
        <span className="text-[11.5px] font-medium tracking-[0.01em] text-[#7C8B85]">{label}</span>
        {drugTag && !isEmpty ? (
          <span className="mt-0.5 inline-flex w-fit items-center gap-1.5 rounded-full border border-[#CFEFDF] bg-[#E7F6EF] py-0.5 pl-2 pr-2.5">
            <Pill className="h-3.5 w-3.5 text-[#047857]" strokeWidth={2.2} aria-hidden />
            <b className="text-sm font-bold tracking-tight text-[#047857]">{text}</b>
          </span>
        ) : (
          <span
            className={cn(
              "truncate text-[15px] font-semibold text-[#0F1B17]",
              isEmpty && "text-sm font-medium italic text-[#AEB9B4]",
            )}
            title={isEmpty ? undefined : text}
          >
            {isEmpty ? "Not provided" : text}
          </span>
        )}
      </span>
    </div>
  )
}

function StudySiteIdentityStrip({ info }) {
  return (
    <div className="grid grid-cols-1 gap-6 border-t border-[#EEF2F1] bg-gradient-to-b from-[#FCFDFD] to-[#F7FAF9] px-5 py-5 sm:grid-cols-[minmax(0,1.55fr)_1px_minmax(0,1fr)] sm:gap-x-8 sm:px-8 sm:py-6 md:px-[34px]">
      <div className="min-w-0">
        <GroupLabel>Study</GroupLabel>
        <div className="flex flex-col gap-3.5">
          <FieldRow icon={ClipboardList} label="Protocol no." value={info.protocolNumber} />
          <FieldRow icon={FileText} label="Study title" value={info.studyTitle} />
          <FieldRow icon={Pill} label="Investigational drug" value={info.nameOfDrug} drugTag />
        </div>
      </div>

      <div className="hidden w-px self-stretch bg-[#E5EBE9] sm:block" role="separator" aria-hidden />

      <div className="min-w-0 sm:border-0 max-sm:border-t max-sm:border-dashed max-sm:border-[#E5EBE9] max-sm:pt-6">
        <GroupLabel>Site</GroupLabel>
        <div className="flex flex-col gap-3.5">
          <FieldRow icon={Building2} label="Site name" value={info.siteName} />
          <FieldRow icon={MapPin} label="Full name" value={info.siteFullName} />
        </div>
      </div>
    </div>
  )
}

export default function DashboardStudySiteInfoCard({ info, className, embedded = false }) {
  if (!info?.hasContent) return null

  if (embedded) {
    return (
      <section className={cn("min-w-0", className)} aria-label="Study and site information">
        <StudySiteIdentityStrip info={info} />
      </section>
    )
  }

  return (
    <section
      className={cn("min-w-0 overflow-hidden rounded-2xl border border-[#E5EBE9] bg-white shadow-[0_1px_2px_rgba(15,27,23,.04),0_12px_32px_-12px_rgba(15,27,23,.10)]", className)}
      aria-label="Study and site information"
    >
      <StudySiteIdentityStrip info={info} />
    </section>
  )
}
