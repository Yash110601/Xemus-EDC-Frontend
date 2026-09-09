"use client"

import { getRsdvStatusBadgeClass, getRsdvStatusLabel } from "@/lib/rsdv/rsdvDisplay"
import { cn } from "@/lib/utils"

export default function RsdvReviewStatusBadge({ status, className }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        getRsdvStatusBadgeClass(status),
        className,
      )}
    >
      {getRsdvStatusLabel(status)}
    </span>
  )
}
