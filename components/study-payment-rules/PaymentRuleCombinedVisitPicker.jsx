"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { getConfiguredVisitDisplayName, sortVisitSchedules } from "@/lib/utils/paymentRuleTriggerOptions"
import { normalizeVisitScheduleIds } from "@/lib/utils/paymentRuleVisitScheduleIds"

export default function PaymentRuleCombinedVisitPicker({
  visitSchedules = [],
  selectedIds = [],
  onChange,
  disabled = false,
  error = null,
}) {
  const sorted = useMemo(() => sortVisitSchedules(visitSchedules), [visitSchedules])
  const normalizedSelected = useMemo(() => normalizeVisitScheduleIds(selectedIds), [selectedIds])

  const toggleVisit = (rawId) => {
    const id = Number(rawId)
    if (!Number.isFinite(id) || id <= 0) return
    const next = normalizedSelected.includes(id)
      ? normalizedSelected.filter((value) => value !== id)
      : [...normalizedSelected, id].sort((a, b) => a - b)
    onChange?.(next)
  }

  if (sorted.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500">
        Configure visits under Visit configuration first.
      </p>
    )
  }

  return (
    <div>
      <div
        className={cn(
          "max-h-48 space-y-1 overflow-y-auto overscroll-contain rounded-xl border border-slate-200/90 bg-slate-50/50 p-2",
          disabled && "opacity-60 pointer-events-none",
        )}
        onWheel={(event) => event.stopPropagation()}
      >
        {sorted.map((visit) => {
          const id = Number(visit?.id ?? visit?.Id)
          if (!id) return null
          const checked = normalizedSelected.includes(id)
          const label = getConfiguredVisitDisplayName(visit)
          return (
            <label
              key={id}
              className={cn(
                "flex cursor-pointer items-start gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
                checked ? "bg-emerald-50/90 text-emerald-800" : "hover:bg-white text-slate-700",
              )}
            >
              <input
                type="checkbox"
                className="mt-0.5"
                checked={checked}
                disabled={disabled}
                onChange={() => toggleVisit(id)}
              />
              <span className="leading-snug">{label}</span>
            </label>
          )
        })}
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        Select <strong>2 or more visits</strong>. A patient counts only when they complete{" "}
        <strong>all</strong> selected visits.
        {normalizedSelected.length > 0 ? (
          <>
            {" "}
            Selected: <strong>{normalizedSelected.length}</strong>
          </>
        ) : null}
      </p>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
