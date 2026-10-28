"use client"

import { ChevronRight, FlaskConical, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"

function ContextSegment({
  kind,
  label,
  value,
  placeholder,
  needsAttention,
  isSelected,
  onClick,
}) {
  const isStudy = kind === "study"
  const Icon = isStudy ? FlaskConical : MapPin

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group/seg relative flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left transition-all duration-300 sm:gap-3 sm:px-3.5 sm:py-2.5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-300/70",
        isStudy ? "rounded-l-[calc(1.125rem-1px)]" : "rounded-r-[calc(1.125rem-1px)]",
        isSelected && "bg-[#F7F4FC]/85",
        !isSelected && "hover:bg-white/75",
        needsAttention && "novera-study-site-bar__segment--attention",
      )}
      title={value || placeholder}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-colors duration-300 sm:h-9 sm:w-9",
          isSelected && "border-[#DDD4F0] bg-gradient-to-br from-[#EDE7F6] to-[#DDD4F0] text-[#5B4B8A]",
          !isSelected && needsAttention && "border-amber-200/80 bg-amber-50/90 text-amber-700",
          !isSelected &&
            !needsAttention &&
            "border-[#E9EDF2] bg-[#F8FAFB] text-[#8A98A8] group-hover/seg:border-[#DDD4F0] group-hover/seg:bg-[#F7F4FC] group-hover/seg:text-[#5B4B8A]",
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={2.1} aria-hidden />
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[10px] font-semibold uppercase tracking-[0.14em]",
            isSelected && "text-[#7C6BB5]",
            !isSelected && needsAttention && "text-amber-600",
            !isSelected && !needsAttention && "text-[#8A98A8]",
          )}
        >
          {label}
        </p>
        {isSelected && isStudy ? (
          <span className="mt-0.5 inline-flex max-w-full items-center rounded-lg bg-[#3D2F63] px-2 py-0.5 text-[12px] font-bold tracking-tight text-white sm:text-[13px]">
            <span className="truncate">{value}</span>
          </span>
        ) : (
          <p
            className={cn(
              "mt-0.5 truncate text-[13px] font-semibold leading-tight tracking-tight sm:text-sm",
              isSelected && "text-[#2D1C4E]",
              !isSelected && needsAttention && "text-slate-800",
              !isSelected && !needsAttention && "text-[#6B7A8C]",
            )}
          >
            {value || placeholder}
          </p>
        )}
      </div>

      <ChevronRight
        className={cn(
          "h-3.5 w-3.5 shrink-0 transition-all duration-300 group-hover/seg:translate-x-0.5",
          isSelected && "text-[#9B87C7]",
          !isSelected && "text-[#B0B9C4]",
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
        "novera-study-site-bar group relative rounded-[1.125rem]",
        isOpen && "novera-study-site-bar--open",
        needsAttention && !hasSelection && "novera-study-site-bar--attention",
        className,
      )}
      aria-label="Study and site context"
    >
      <span className="novera-study-site-bar__ring" aria-hidden="true" />

      <div
        className={cn(
          "novera-study-site-bar__inner relative flex min-w-0 items-stretch overflow-hidden rounded-[calc(1.125rem-1px)] border border-[#E4DCF2]/95 bg-white/94 backdrop-blur-xl",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_10px_32px_-16px_rgba(61,47,99,0.16)]",
          "transition-[transform,box-shadow,border-color] duration-300",
          "group-hover:-translate-y-px group-hover:border-[#D9CFEC] group-hover:shadow-[inset_0_1px_0_rgba(255,255,255,1),0_16px_40px_-18px_rgba(124,107,181,0.22)]",
          isOpen &&
            "-translate-y-px border-[#D9CFEC] shadow-[inset_0_1px_0_rgba(255,255,255,1),0_18px_44px_-18px_rgba(124,107,181,0.28)]",
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#EDE7F6]/45 via-white/30 to-[#F3EEF9]/55 opacity-90" />

        <ContextSegment
          kind="study"
          label="Study"
          value={studyValue}
          placeholder="Choose study"
          needsAttention={needsStudy}
          isSelected={Boolean(studyValue)}
          onClick={onStudyClick}
        />

        <div
          className="relative z-10 w-px shrink-0 self-stretch bg-gradient-to-b from-transparent via-[#DDD4F0] to-transparent"
          aria-hidden
        />

        <ContextSegment
          kind="site"
          label="Site"
          value={siteValue}
          placeholder="Choose site"
          needsAttention={needsSite}
          isSelected={Boolean(siteValue)}
          onClick={onSiteClick}
        />
      </div>
    </div>
  )
}
