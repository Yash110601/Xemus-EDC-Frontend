"use client"

import { ClipboardList, LayoutGrid } from "lucide-react"
import { cn } from "@/lib/utils"

const TABS = [
  { id: "visits", label: "Visits", icon: LayoutGrid },
  { id: "queries", label: "Query management", icon: ClipboardList },
]

export default function EcrfPatientWorkspaceTabs({ activeTab = "visits", onTabChange, className }) {
  return (
    <div
      className={cn(
        "inline-flex min-w-0 flex-wrap items-center rounded-full border border-teal-200/80 bg-teal-100/65 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]",
        className,
      )}
      role="tablist"
      aria-label="Patient workspace"
    >
      {TABS.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange?.(tab.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200",
              isActive
                ? "bg-white text-emerald-900 shadow-sm ring-1 ring-emerald-200/80"
                : "text-slate-600 hover:text-slate-900",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
