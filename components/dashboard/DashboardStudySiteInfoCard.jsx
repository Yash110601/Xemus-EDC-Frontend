"use client"

import {
  Building2,
  FlaskConical,
  MapPin,
} from "lucide-react"
import { cn } from "@/lib/utils"

function displayValue(value) {
  const text = String(value ?? "").trim()
  return text || ""
}

function ValueText({ value, className, emptyClassName }) {
  const text = displayValue(value)
  const isEmpty = !text
  return (
    <span
      className={cn(
        "min-w-0 truncate font-semibold tracking-tight text-[#2D1C4E]",
        isEmpty && "font-medium italic text-[#A89BB8]",
        className,
        isEmpty && emptyClassName,
      )}
      title={isEmpty ? undefined : text}
    >
      {isEmpty ? "Not provided" : text}
    </span>
  )
}

function StudySiteIdentityStrip({ info }) {
  const protocol = displayValue(info.protocolNumber)
  const drug = displayValue(info.nameOfDrug)

  return (
    <div className="border-t border-[#EEE8F6]/90 bg-gradient-to-b from-white/40 via-[#FBF9FE]/90 to-[#F5F1FB] px-5 py-5 sm:px-7 sm:py-6 md:px-8">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
        {/* Study */}
        <article className="relative min-w-0 overflow-hidden rounded-[20px] border border-[#E8E0F4]/90 bg-white/80 p-4 shadow-[0_1px_0_rgba(255,255,255,.8)_inset,0_8px_24px_-16px_rgba(45,28,78,.18)] backdrop-blur-sm sm:p-5">
          <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(124,107,181,0.14),transparent_70%)]" aria-hidden />
          <div className="relative flex items-start gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#EDE7F6] to-[#DDD4F0] text-[#5B4B8A] shadow-sm">
              <FlaskConical className="h-[18px] w-[18px]" strokeWidth={2.1} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#8B7BA8]">
                Study
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {protocol ? (
                  <span className="inline-flex max-w-full items-center rounded-xl bg-[#3D2F63] px-2.5 py-1 text-[13px] font-bold tracking-tight text-white shadow-sm">
                    <span className="truncate">{protocol}</span>
                  </span>
                ) : (
                  <ValueText value="" className="text-[15px]" />
                )}
                {drug ? (
                  <span className="inline-flex max-w-full items-center rounded-full border border-[#D9CFEC] bg-[#F7F4FC] px-2.5 py-1 text-[12px] font-semibold text-[#5B4B8A]">
                    <span className="truncate">{drug}</span>
                  </span>
                ) : null}
              </div>
              <p className="mt-2.5 text-[11.5px] font-medium text-[#8B7BA8]">Study title</p>
              <ValueText value={info.studyTitle} className="mt-0.5 block text-[14.5px] leading-snug sm:text-[15px]" />
            </div>
          </div>
        </article>

        {/* Site */}
        <article className="relative min-w-0 overflow-hidden rounded-[20px] border border-[#E8E0F4]/90 bg-white/80 p-4 shadow-[0_1px_0_rgba(255,255,255,.8)_inset,0_8px_24px_-16px_rgba(45,28,78,.18)] backdrop-blur-sm sm:p-5">
          <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(124,107,181,0.10),transparent_70%)]" aria-hidden />
          <div className="relative flex items-start gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#EDE7F6] to-[#DDD4F0] text-[#5B4B8A] shadow-sm">
              <Building2 className="h-[18px] w-[18px]" strokeWidth={2.1} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-[#8B7BA8]">
                Site
              </p>
              <ValueText value={info.siteName} className="mt-2 block text-[17px] sm:text-[18px]" />
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#EEE8F6] bg-[#FBF9FE]/90 px-3 py-2.5">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#7C6BB5]" strokeWidth={2.2} aria-hidden />
                <div className="min-w-0">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[#8B7BA8]">
                    Full name
                  </p>
                  <ValueText value={info.siteFullName} className="mt-0.5 block text-[13.5px] font-semibold text-[#463A63]" />
                </div>
              </div>
            </div>
          </div>
        </article>
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
      className={cn(
        "min-w-0 overflow-hidden rounded-[24px] border border-[#E4DCF2] bg-white shadow-[0_1px_2px_rgba(45,28,78,.04),0_12px_32px_-12px_rgba(45,28,78,.10)]",
        className,
      )}
      aria-label="Study and site information"
    >
      <StudySiteIdentityStrip info={info} />
    </section>
  )
}
