"use client"

import EcrfMetricChip from "@/components/ecrf/data-entry/EcrfMetricChip"
import { cn } from "@/lib/utils"
import { CheckCircle2, Clock3, Layers } from "lucide-react"

/**
 * Aggregate visit stats shown above the visit matrix.
 */
export default function EcrfVisitsOverviewStrip({
  visitSummary,
  querySummary,
  onOpenQueries,
  className,
}) {
  if (!visitSummary?.total) return null

  const openQueries = querySummary?.open ?? 0

  return (
    <div
      className={cn(
        "mb-3 grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4",
        className,
      )}
      role="region"
      aria-label="Visit overview"
    >
      <EcrfMetricChip
        label="Visit columns"
        value={visitSummary.total}
        hint={`Avg ${visitSummary.avgProgress}% across grid`}
        icon={Layers}
        tone="neutral"
      />
      <EcrfMetricChip
        label="Submitted"
        value={visitSummary.completed}
        hint="Completed visit cells"
        icon={CheckCircle2}
        tone="emerald"
      />
      <EcrfMetricChip
        label="In progress"
        value={visitSummary.inProcess}
        hint={`${visitSummary.pending} pending`}
        icon={Clock3}
        tone="teal"
      />
      <EcrfMetricChip
        label="Open queries"
        value={openQueries}
        hint={onOpenQueries ? "Click to open query management" : "Across all visits"}
        tone="amber"
        onClick={onOpenQueries}
      />
    </div>
  )
}
