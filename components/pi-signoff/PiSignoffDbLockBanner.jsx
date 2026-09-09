"use client"

import Link from "next/link"
import { AlertTriangle, FileCheck } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Warns when submitted CRFs still await PI sign-off before database lock.
 */
export default function PiSignoffDbLockBanner({
  pendingCount = 0,
  pendingPatientCount = 0,
  isPiSignoffRequired = false,
  studyId = "",
  className = "",
}) {
  const pending = Number(pendingCount) || 0
  if (!isPiSignoffRequired || pending <= 0) return null

  return (
    <div
      className={cn(
        "rounded-2xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-amber-950",
        className,
      )}
      role="status"
    >
      <div className="flex flex-wrap items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-amber-950">
            {pending} submitted CRF{pending === 1 ? "" : "s"} awaiting PI sign-off
            {pendingPatientCount > 0
              ? ` across ${pendingPatientCount} patient${pendingPatientCount === 1 ? "" : "s"}`
              : ""}
          </p>
          <p className="mt-1 text-xs text-amber-900/90">
            Database lock may be rejected until PI sign-off is complete for all submitted forms. Review the queue or
            open eCRF to sign off.
          </p>
          {studyId ? (
            <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
              <Link
                href={`/study-management/pi-signoff?studyId=${encodeURIComponent(String(studyId))}`}
                className="inline-flex items-center gap-1 text-indigo-700 hover:text-indigo-900"
              >
                <FileCheck className="h-3.5 w-3.5" />
                PI sign-off queue
              </Link>
              <Link
                href={`/reports/pi-signoff-report?studyId=${encodeURIComponent(String(studyId))}`}
                className="text-indigo-700 hover:text-indigo-900"
              >
                PI sign-off report
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
