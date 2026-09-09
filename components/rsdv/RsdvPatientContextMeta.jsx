"use client"

import { getRsdvContextFields } from "@/lib/rsdv/rsdvDisplay"
import { RSDV_CONTEXT_FIELD_STYLES } from "@/lib/rsdv/rsdvUi"
import { cn } from "@/lib/utils"
import { Building2, CalendarDays, Hash, UserRound } from "lucide-react"

const FIELD_ICONS = {
  site: Building2,
  patientId: Hash,
  initial: UserRound,
  visit: CalendarDays,
}

/**
 * Labeled Site / Patient ID / Initial / Visit strip — aligned with SDV report columns.
 *
 * @param {"grid"|"cards"|"chips"} [variant]
 *   - grid: compact labeled grid (queue rows)
 *   - cards: colored stat cards (compare toolbar)
 *   - chips: inline tinted chips (compact lists)
 */
export default function RsdvPatientContextMeta({
  row,
  className,
  includeVisit = true,
  dense = false,
  variant = "grid",
}) {
  const fields = getRsdvContextFields(row, { includeVisit })

  if (variant === "cards") {
    return (
      <dl className={cn("grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4", className)}>
        {fields.map(({ key, label, value }) => {
          const styles = RSDV_CONTEXT_FIELD_STYLES[key] ?? RSDV_CONTEXT_FIELD_STYLES.site
          const Icon = FIELD_ICONS[key] ?? Building2
          return (
            <div
              key={key}
              className={cn("min-w-0 rounded-xl border px-3 py-2.5", styles.card)}
            >
              <dt className="flex items-center gap-1.5">
                <Icon className={cn("h-3.5 w-3.5 shrink-0", styles.label)} aria-hidden />
                <span className={cn("text-[10px] font-bold uppercase tracking-[0.08em]", styles.label)}>
                  {label}
                </span>
              </dt>
              <dd className={cn("mt-1 truncate text-sm font-bold", styles.value)} title={value}>
                {value}
              </dd>
            </div>
          )
        })}
      </dl>
    )
  }

  if (variant === "chips") {
    return (
      <dl className={cn("flex min-w-0 flex-wrap gap-1.5", className)}>
        {fields.map(({ key, label, value }) => {
          const styles = RSDV_CONTEXT_FIELD_STYLES[key] ?? RSDV_CONTEXT_FIELD_STYLES.site
          return (
            <div
              key={key}
              className={cn(
                "inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border px-2 py-1",
                styles.card,
              )}
              title={`${label}: ${value}`}
            >
              <dt className={cn("shrink-0 text-[9px] font-bold uppercase tracking-wide", styles.label)}>
                {label}
              </dt>
              <dd className={cn("truncate text-[11px] font-semibold", styles.value)}>{value}</dd>
            </div>
          )
        })}
      </dl>
    )
  }

  return (
    <dl
      className={cn(
        "grid min-w-0 gap-x-3 gap-y-1",
        includeVisit ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3",
        className,
      )}
    >
      {fields.map(({ key, label, value }) => {
        const styles = RSDV_CONTEXT_FIELD_STYLES[key] ?? RSDV_CONTEXT_FIELD_STYLES.site
        return (
          <div
            key={key}
            className={cn(
              "min-w-0 rounded-lg border px-2 py-1.5",
              dense ? "border-slate-100 bg-slate-50/80" : styles.card,
            )}
          >
            <dt
              className={cn(
                "font-semibold uppercase tracking-[0.08em]",
                dense ? "text-[9px] text-slate-500" : cn("text-[10px]", styles.label),
              )}
            >
              {label}
            </dt>
            <dd
              className={cn(
                "truncate font-semibold",
                dense ? "text-[11px] leading-tight text-slate-800" : cn("text-xs sm:text-sm", styles.value),
              )}
              title={value}
            >
              {value}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
