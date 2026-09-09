"use client"

import { cn } from "@/lib/utils"
import { CheckCircle2, Clock3, FileText, MessageCircle } from "lucide-react"

const QUERY_ITEMS = [
  {
    key: "open",
    label: "Open",
    tone: "sky",
    icon: MessageCircle,
  },
  {
    key: "inProcess",
    label: "In process",
    tone: "amber",
    icon: Clock3,
  },
  {
    key: "closed",
    label: "Closed",
    tone: "emerald",
    icon: CheckCircle2,
  },
]

const TONE_STYLES = {
  sky: {
    chip: "border-sky-200/80 bg-gradient-to-br from-sky-50/95 to-white/90 text-sky-900",
    value: "text-sky-700",
    ring: "ring-sky-200/60",
    icon: "text-sky-600",
  },
  amber: {
    chip: "border-amber-200/80 bg-gradient-to-br from-amber-50/95 to-white/90 text-amber-900",
    value: "text-amber-700",
    ring: "ring-amber-200/60",
    icon: "text-amber-600",
  },
  emerald: {
    chip: "border-emerald-200/80 bg-gradient-to-br from-emerald-50/95 to-white/90 text-emerald-900",
    value: "text-emerald-700",
    ring: "ring-emerald-200/60",
    icon: "text-emerald-600",
  },
}

const VISIT_STATUS_LEGEND = [
  { label: "Pending", dot: "bg-rose-500", ring: "ring-rose-200/70" },
  { label: "In process", dot: "bg-amber-500", ring: "ring-amber-200/70" },
  { label: "Completed", dot: "bg-emerald-500", ring: "ring-emerald-200/70" },
]

function QueryCountChip({ label, value, tone, icon: Icon, loading, onClick }) {
  const styles = TONE_STYLES[tone] || TONE_STYLES.sky
  const Wrapper = onClick ? "button" : "div"

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "min-w-[4.5rem] rounded-xl border px-2.5 py-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.92)] backdrop-blur-sm transition-all",
        styles.chip,
        onClick && "cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-16px_rgba(15,23,42,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        onClick && styles.ring,
      )}
      aria-label={`${label} queries: ${loading ? "loading" : value}`}
    >
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-3 w-3 shrink-0", styles.icon)} aria-hidden />
        <span className="truncate text-[9px] font-semibold uppercase tracking-[0.06em] opacity-80">
          {label}
        </span>
      </div>
      <p className={cn("mt-1 text-lg font-bold tabular-nums leading-none", styles.value)}>
        {loading ? "…" : value}
      </p>
    </Wrapper>
  )
}

/**
 * Patient header query KPI strip + visit status legend (premium glass layout).
 */
export default function EcrfPatientQueryStatusStrip({
  queryCounts = {},
  loading = false,
  onOpenQueries,
  className,
}) {
  const counts = {
    open: queryCounts.open ?? 0,
    inProcess: queryCounts.inProcess ?? 0,
    closed: queryCounts.closed ?? 0,
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200/75 bg-white/80 shadow-[0_14px_36px_-22px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.92)] backdrop-blur-xl",
        className,
      )}
    >
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-stretch sm:gap-0">
        {/* Query KPIs */}
        <div className="min-w-0 flex-1 sm:pr-3">
          <div className="mb-2 flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-slate-500" aria-hidden />
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
              Query summary
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {QUERY_ITEMS.map((item) => (
              <QueryCountChip
                key={item.key}
                label={item.label}
                value={counts[item.key]}
                tone={item.tone}
                icon={item.icon}
                loading={loading}
                onClick={onOpenQueries}
              />
            ))}
          </div>
        </div>

        <div className="hidden w-px self-stretch bg-gradient-to-b from-transparent via-slate-200/90 to-transparent sm:block" />

        {/* Visit status legend */}
        <div className="min-w-0 sm:w-[11.5rem] sm:pl-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            Visit status
          </p>
          <div className="space-y-1.5">
            {VISIT_STATUS_LEGEND.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2 rounded-lg border border-slate-200/70 bg-slate-50/70 px-2 py-1.5"
              >
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full ring-2 ring-offset-1",
                    item.dot,
                    item.ring,
                  )}
                  aria-hidden
                />
                <span className="text-[11px] font-medium text-slate-700">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
