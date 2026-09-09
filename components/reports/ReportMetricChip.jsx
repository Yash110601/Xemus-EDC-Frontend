"use client"

import { cn } from "@/lib/utils"

export function ReportMetricChip({ label, value, tone = "neutral", className = "" }) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200/80 bg-emerald-50/90 text-emerald-900"
      : tone === "warning"
        ? "border-amber-200/80 bg-amber-50/90 text-amber-900"
        : tone === "info"
          ? "border-indigo-200/80 bg-indigo-50/90 text-indigo-900"
          : tone === "danger"
            ? "border-rose-200/80 bg-rose-50/90 text-rose-900"
            : "border-slate-200/80 bg-white/90 text-slate-900"

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_10px_28px_-18px_rgba(15,23,42,0.18)] backdrop-blur-sm",
        toneClass,
        className,
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

export default ReportMetricChip
