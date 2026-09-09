"use client"

import { cn } from "@/lib/utils"

const TONE_CLASS = {
  neutral: "border-slate-200/80 bg-white/90 text-slate-900",
  emerald: "border-emerald-200/80 bg-emerald-50/70 text-emerald-950",
  teal: "border-teal-200/80 bg-teal-50/70 text-teal-950",
  amber: "border-amber-200/80 bg-amber-50/70 text-amber-950",
}

export default function EcrfMetricChip({ label, value, hint, icon: Icon, tone = "neutral", onClick, className }) {
  const Wrapper = onClick ? "button" : "div"

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "rounded-2xl border px-3.5 py-3 text-left shadow-sm shadow-slate-900/5",
        TONE_CLASS[tone] ?? TONE_CLASS.neutral,
        onClick &&
          "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-1",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
          <p className="mt-1 text-xl font-bold tabular-nums tracking-tight">{value}</p>
          {hint ? <p className="mt-0.5 truncate text-[11px] text-slate-500">{hint}</p> : null}
        </div>
        {Icon ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/70 text-emerald-600">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        ) : null}
      </div>
    </Wrapper>
  )
}
