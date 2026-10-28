"use client"

import Link from "next/link"
import { Link2 } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Shown on Patient Enrolment only when Enterprise IWRS is enabled for the study.
 * Reminds sites to use the same Subject ID in IWRS (EDC does not auto-create from IWRS).
 */
export default function IwrsEnrolmentLinkBanner({ className }) {
  return (
    <div
      role="status"
      className={cn(
        "mb-4 flex gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-950 shadow-sm",
        className,
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
        <Link2 className="h-4 w-4" strokeWidth={2} aria-hidden />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-semibold text-emerald-900">Enterprise IWRS is linked for this study</p>
        <p className="text-xs leading-relaxed text-emerald-800/90 sm:text-[13px]">
          Enrol the patient here first, then use the{" "}
          <span className="font-semibold">same Subject ID (screening / SUBJID)</span> when you enroll
          or randomize in IWRS. EDC does not create patients from IWRS. Sync status appears on the
          manage list after IWRS events arrive.
        </p>
        <p className="text-[11px] text-emerald-700/80">
          Events log:{" "}
          <Link
            href="/platform/integration"
            className="font-semibold underline underline-offset-2 hover:text-emerald-900"
          >
            Platform → Integration hub
          </Link>
        </p>
      </div>
    </div>
  )
}
