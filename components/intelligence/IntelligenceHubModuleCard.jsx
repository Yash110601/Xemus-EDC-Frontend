"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

export default function IntelligenceHubModuleCard({ title, description, href, enabled }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col rounded-xl border bg-white p-4 shadow-sm transition-colors",
        enabled
          ? "border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40"
          : "border-slate-100 opacity-80 hover:border-slate-200",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            enabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500",
          )}
        >
          {enabled ? "On" : "Off"}
        </span>
      </div>
      <p className="mt-1 flex-1 text-xs leading-relaxed text-slate-500">{description}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
        Open <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  )
}
