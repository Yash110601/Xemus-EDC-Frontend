"use client"

import { Building2, ChevronRight, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"

function ContextSegment({
  kind,
  label,
  value,
  placeholder,
  needsAttention,
  isSelected,
  isOpen,
  onClick,
}) {
  const isStudy = kind === "study"
  const Icon = isStudy ? Building2 : MapPin

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group/seg relative flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left transition-all duration-300 sm:gap-3 sm:px-3.5 sm:py-2.5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-300/70",
        isStudy ? "rounded-l-[calc(1rem-1px)]" : "rounded-r-[calc(1rem-1px)]",
        isSelected && isStudy && "bg-gradient-to-br from-emerald-50/90 via-white/50 to-teal-50/70",
        isSelected && !isStudy && "bg-gradient-to-br from-sky-50/90 via-white/50 to-cyan-50/70",
        !isSelected && "hover:bg-white/80",
        needsAttention && "novera-study-site-bar__segment--attention"
      )}
      title={value || placeholder}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-colors duration-300 sm:h-9 sm:w-9",
          isSelected && isStudy && "border-emerald-200/80 bg-emerald-100/80 text-emerald-700",
          isSelected && !isStudy && "border-sky-200/80 bg-sky-100/80 text-sky-700",
          !isSelected && needsAttention && "border-amber-200/80 bg-amber-50/90 text-amber-700",
          !isSelected && !needsAttention && "border-slate-200/80 bg-slate-50/90 text-slate-500 group-hover/seg:border-slate-300/80 group-hover/seg:text-slate-600"
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[10px] font-semibold uppercase tracking-[0.14em]",
            isSelected && isStudy && "text-emerald-600",
            isSelected && !isStudy && "text-sky-600",
            !isSelected && needsAttention && "text-amber-600",
            !isSelected && !needsAttention && "text-slate-400"
          )}
        >
          {label}
        </p>
        <p
          className={cn(
            "mt-0.5 truncate text-[13px] font-semibold leading-tight tracking-tight sm:text-sm",
            isSelected && "text-slate-900",
            !isSelected && needsAttention && "text-slate-800",
            !isSelected && !needsAttention && "text-slate-600"
          )}
        >
          {value || placeholder}
        </p>
      </div>

      <ChevronRight
        className={cn(
          "h-3.5 w-3.5 shrink-0 transition-all duration-300 group-hover/seg:translate-x-0.5",
          isSelected && isStudy && "text-emerald-500",
          isSelected && !isStudy && "text-sky-500",
          !isSelected && "text-slate-400"
        )}
        strokeWidth={2.25}
        aria-hidden
      />

      {needsAttention ? (
        <span
          className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-amber-500 ring-2 ring-white/95 sm:right-2.5 sm:top-2.5"
          aria-hidden
        />
      ) : null}
    </button>
  )
}

/**
 * Premium dual-segment Study + Site context control for header (admin compact mode).
 */
export default function StudySiteContextBar({
  study,
  site,
  onStudyClick,
  onSiteClick,
  isOpen = false,
  needsStudy = false,
  needsSite = false,
  className,
}) {
  const studyValue = study?.protocolNumber || null
  const siteValue =
    site?.siteName || site?.SiteName || (site ? `Site ${site.id || site.siteId}` : null)

  const hasSelection = Boolean(studyValue || siteValue)
  const needsAttention = needsStudy || needsSite

  return (
    <div
      className={cn(
        "novera-study-site-bar group relative rounded-2xl",
        isOpen && "novera-study-site-bar--open",
        needsAttention && !hasSelection && "novera-study-site-bar--attention",
        className
      )}
      aria-label="Study and site context"
    >
      <span className="novera-study-site-bar__ring" aria-hidden="true" />

      <div
        className={cn(
          "novera-study-site-bar__inner relative flex min-w-0 items-stretch overflow-hidden rounded-[calc(1rem-1px)] border border-slate-200/75 bg-white/92 backdrop-blur-xl",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_10px_32px_-16px_rgba(15,23,42,0.14)]",
          "transition-[transform,box-shadow,border-color] duration-300",
          "group-hover:-translate-y-px group-hover:border-slate-300/80 group-hover:shadow-[inset_0_1px_0_rgba(255,255,255,1),0_16px_40px_-18px_rgba(16,185,129,0.16)]",
          isOpen && "-translate-y-px border-emerald-200/70 shadow-[inset_0_1px_0_rgba(255,255,255,1),0_18px_44px_-18px_rgba(20,184,166,0.2)]"
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-emerald-50/30 via-white/20 to-sky-50/35 opacity-80" />

        <ContextSegment
          kind="study"
          label="Study"
          value={studyValue}
          placeholder="Choose study"
          needsAttention={needsStudy}
          isSelected={Boolean(studyValue)}
          isOpen={isOpen}
          onClick={onStudyClick}
        />

        <div
          className="relative z-10 w-px shrink-0 self-stretch bg-gradient-to-b from-transparent via-slate-200/90 to-transparent"
          aria-hidden
        />

        <ContextSegment
          kind="site"
          label="Site"
          value={siteValue}
          placeholder="Choose site"
          needsAttention={needsSite}
          isSelected={Boolean(siteValue)}
          isOpen={isOpen}
          onClick={onSiteClick}
        />
      </div>
    </div>
  )
}
