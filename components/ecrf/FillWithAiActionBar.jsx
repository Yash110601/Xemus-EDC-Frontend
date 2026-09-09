"use client"

import { AlertTriangle, Loader2, Mic, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import GlassSheen from "@/components/ecrf/GlassSheen"

const GLASS_PILL_BASE = cn(
  "group relative inline-flex items-center overflow-hidden",
  "rounded-full border border-white/55",
  "bg-white/42 backdrop-blur-2xl backdrop-saturate-150",
  "shadow-[0_10px_40px_-12px_rgba(15,23,42,0.28),inset_0_1px_0_rgba(255,255,255,0.92),inset_0_-1px_0_rgba(255,255,255,0.12)]",
  "transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/35 focus-visible:ring-offset-2",
)

const GLASS_PILL_HOVER = cn(
  "hover:border-white/78 hover:bg-white/55",
  "hover:shadow-[0_14px_48px_-10px_rgba(99,102,241,0.32),inset_0_1px_0_rgba(255,255,255,1)]",
  "active:scale-[0.98]",
)

function MicOrb({ loading, size = "default" }) {
  const inner = size === "rail" ? "h-11 w-11" : "h-10 w-10 sm:h-11 sm:w-11"
  const icon = size === "rail" ? "h-5 w-5" : "h-[18px] w-[18px]"
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        inner,
        "bg-gradient-to-b from-teal-500 via-teal-600 to-emerald-800",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_6px_16px_-4px_rgba(67,56,202,0.5)]",
        "ring-1 ring-white/35 transition-transform duration-500 group-hover:scale-[1.03]",
      )}
    >
      <GlassSheen className="rounded-full" />
      {loading ? (
        <Loader2 className={cn("relative animate-spin text-white", icon)} aria-hidden />
      ) : (
        <Mic className={cn("relative text-white drop-shadow-sm", icon)} strokeWidth={2.25} aria-hidden />
      )}
    </span>
  )
}

/** Resting img1: glass halo only (orb stays centered; halo fades on hover). */
function RailGlassHalo() {
  return (
    <span
      className={cn(
        "pointer-events-none absolute inset-0 rounded-full",
        "border border-white/65 bg-white/38 backdrop-blur-2xl backdrop-saturate-150",
        "shadow-[0_10px_36px_-12px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.95)]",
        "ring-1 ring-white/50 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "group-hover:scale-[0.88] group-hover:opacity-0 group-focus-visible:scale-[0.88] group-focus-visible:opacity-0",
      )}
      aria-hidden
    >
      <GlassSheen className="rounded-full" />
    </span>
  )
}

/**
 * AI fill CTA — centered row (`placement="center"`) or right-edge glass pill (`placement="rail"`).
 */
export default function FillWithAiActionBar({
  onOpen,
  loading = false,
  disabled = false,
  error = null,
  compact = false,
  placement = "center",
}) {
  if (placement === "rail") {
    return (
      <div
        className="pointer-events-none absolute right-2 top-1/2 z-[45] -translate-y-1/2 sm:right-3"
        role="region"
        aria-label="Fill with AI"
      >
        <div className="pointer-events-auto flex flex-col items-end gap-2.5">
          <button
            type="button"
            onClick={onOpen}
            disabled={disabled || loading}
            aria-label="Fill with AI — voice or document"
            title=""
            className={cn(
              "group relative inline-flex items-center overflow-hidden rounded-full",
              "gap-0 p-1 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
              "bg-transparent",
              "hover:gap-3 hover:border hover:border-slate-200/90 hover:py-1.5 hover:pl-1.5 hover:pr-5",
              "hover:bg-white/95 hover:backdrop-blur-2xl hover:backdrop-saturate-150",
              "hover:shadow-[0_16px_48px_-14px_rgba(99,102,241,0.32),0_0_0_1px_rgba(255,255,255,1),inset_0_1px_0_rgba(255,255,255,1)]",
              "focus-visible:gap-2.5 focus-visible:border focus-visible:border-white/75 focus-visible:py-1 focus-visible:pl-1 focus-visible:pr-4",
              "focus-visible:bg-gradient-to-br focus-visible:from-teal-100/95 focus-visible:via-white/92 focus-visible:to-emerald-50/88",
              "focus-visible:backdrop-blur-2xl focus-visible:shadow-[0_14px_44px_-12px_rgba(99,102,241,0.38),inset_0_1px_0_rgba(255,255,255,1)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100",
              "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45",
            )}
          >
            {/* Hover color effect 1 — cool violet bloom */}
            <span
              className="pointer-events-none absolute -inset-3 rounded-full bg-emerald-500/0 blur-2xl transition-all duration-500 group-hover:bg-emerald-500/25 group-focus-visible:bg-emerald-500/25"
              aria-hidden
            />
            {/* Hover color effect 2 — warm amber accent */}
            <span
              className="pointer-events-none absolute -right-2 -top-2 h-14 w-14 rounded-full bg-amber-300/0 blur-2xl transition-all duration-500 group-hover:bg-amber-300/35 group-focus-visible:bg-amber-300/35"
              aria-hidden
            />
            <GlassSheen className="rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100" />

            <span className="relative flex h-[3.65rem] w-[3.65rem] shrink-0 items-center justify-center sm:h-[3.85rem] sm:w-[3.85rem]">
              <RailGlassHalo />
              <MicOrb loading={loading} size="rail" />
              {!loading ? (
                <Sparkles
                  className="pointer-events-none absolute right-2 top-2 z-[1] h-3.5 w-3.5 text-amber-300/95 drop-shadow-[0_0_6px_rgba(251,191,36,0.55)] transition-transform duration-300 group-hover:scale-110 group-focus-visible:scale-110"
                  aria-hidden
                />
              ) : null}
            </span>

            <span
              className={cn(
                "relative flex min-w-0 max-w-0 flex-col overflow-hidden whitespace-nowrap text-left opacity-0",
                "transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                "group-hover:max-w-[8rem] group-hover:opacity-100",
                "group-focus-visible:max-w-[8rem] group-focus-visible:opacity-100",
              )}
            >
              <span className="flex items-center gap-1 text-[13px] font-semibold tracking-tight text-slate-900">
                Fill with AI
                {!loading ? (
                  <Sparkles className="h-3.5 w-3.5 text-amber-500/90" aria-hidden />
                ) : null}
              </span>
              <span className="flex gap-2 text-[10px] font-medium text-slate-500">
                <span>Voice</span>
                <span>Upload</span>
              </span>
            </span>
          </button>

          {error ? (
            <p
              className={cn(
                "flex max-w-[11rem] items-start gap-1.5 rounded-2xl border border-red-200/60 px-3 py-2",
                "bg-white/55 text-[10px] leading-snug text-red-700 shadow-lg backdrop-blur-xl",
              )}
              role="alert"
            >
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              <span>{error}</span>
            </p>
          ) : null}
        </div>
      </div>
    )
  }

  const buttonClass = cn(
    GLASS_PILL_BASE,
    GLASS_PILL_HOVER,
    "max-w-full gap-2.5",
    compact ? "px-4 py-2.5 sm:px-5" : "gap-3 px-5 py-3 sm:px-7 sm:py-3.5",
    "disabled:pointer-events-none disabled:opacity-50",
  )

  const mainButton = (
    <button
      type="button"
      onClick={onOpen}
      disabled={disabled || loading}
      className={buttonClass}
      aria-label="Fill with AI using voice or document"
      title=""
    >
      <GlassSheen className="rounded-full" />
      <MicOrb loading={loading} />
      <span className="relative flex min-w-0 flex-col items-start text-left">
        <span className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-slate-900">
          Fill with AI
          {!loading ? <Sparkles className="h-3.5 w-3.5 text-amber-500/90" aria-hidden /> : null}
        </span>
        <span className="text-[11px] font-medium leading-snug text-slate-500">
          Voice dictation or upload a document
        </span>
      </span>
    </button>
  )

  const extras = error ? (
      <div className="flex flex-col items-center gap-2 px-2">
        <p className="flex max-w-md items-center justify-center gap-1.5 text-center text-xs text-red-600">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      </div>
    ) : null

  return (
    <div className={cn("w-full", compact ? "mb-0" : "mb-6")} role="region" aria-label="Fill with AI">
      <div className="flex w-full items-center justify-center">{mainButton}</div>
      {extras ? <div className="mt-3">{extras}</div> : null}
    </div>
  )
}
