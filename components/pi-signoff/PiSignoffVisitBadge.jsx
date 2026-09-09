"use client"

import { FileCheck } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Compact PI pending/signed indicator on visit cards (eCRF landing).
 */
export default function PiSignoffVisitBadge({ pendingCount = 0, signedCount = 0, compact = true }) {
  const pending = Number(pendingCount) || 0
  const signed = Number(signedCount) || 0
  if (pending <= 0 && signed <= 0) return null

  if (pending > 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-amber-200/90 bg-amber-50 px-2 py-0.5 font-semibold text-amber-900",
          compact ? "text-[10px]" : "text-xs",
        )}
      >
        <FileCheck className="h-3 w-3 shrink-0" />
        PI pending {pending}
      </span>
    )
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-emerald-200/90 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800",
        compact ? "text-[10px]" : "text-xs",
      )}
    >
      <FileCheck className="h-3 w-3 shrink-0" />
      PI signed{signed > 1 ? ` (${signed})` : ""}
    </span>
  )
}
