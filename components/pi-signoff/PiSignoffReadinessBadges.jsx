"use client"

import { cn } from "@/lib/utils"
import {
  requiresPiResign,
  shouldShowSdvBeforeSignGates,
} from "@/lib/piSignoff/piSignoffReadiness"

function StatusPill({ ok, label, warn = false }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1",
        ok
          ? "bg-emerald-50 text-emerald-800 ring-emerald-200/80"
          : warn
            ? "bg-amber-50 text-amber-900 ring-amber-200/80"
            : "bg-slate-100 text-slate-700 ring-slate-200/80",
      )}
    >
      {label}
    </span>
  )
}

export function PiSignoffBlockedReasons({ reasons = [], className = "" }) {
  const list = Array.isArray(reasons) ? reasons.filter(Boolean) : []
  if (!list.length) return null
  return (
    <ul className={cn("mt-2 space-y-1 text-xs text-amber-900", className)}>
      {list.map((reason) => (
        <li key={reason} className="flex gap-1.5">
          <span className="text-amber-600" aria-hidden>
            •
          </span>
          <span>{reason}</span>
        </li>
      ))}
    </ul>
  )
}

export default function PiSignoffReadinessBadges({ record, reviewOrder, isFieldPiSignoffEnabled = false, className = "" }) {
  if (!record) return null

  const readiness = record.readiness ?? {}
  const showResign = requiresPiResign(record)
  const showSdvGates = shouldShowSdvBeforeSignGates(reviewOrder)
  const fieldSummary = readiness.fieldSignoff

  return (
    <div className={cn("mt-2 flex flex-wrap items-center gap-1.5", className)}>
      {showResign ? (
        <StatusPill ok={false} warn label="Re-sign required" />
      ) : (
        <>
          {showSdvGates ? (
            <>
              <StatusPill ok={readiness.isSdvVerified} label={readiness.isSdvVerified ? "SDV verified" : "SDV pending"} />
              <StatusPill
                ok={!readiness.hasOpenQueries}
                warn={readiness.hasOpenQueries}
                label={readiness.hasOpenQueries ? "Open queries" : "Queries closed"}
              />
            </>
          ) : null}
          {isFieldPiSignoffEnabled && fieldSummary?.totalEligible > 0 ? (
            <StatusPill
              ok={fieldSummary.allFieldsSigned}
              warn={!fieldSummary.allFieldsSigned}
              label={
                fieldSummary.allFieldsSigned
                  ? "All fields PI-signed"
                  : `Fields ${fieldSummary.signedCount}/${fieldSummary.totalEligible}`
              }
            />
          ) : null}
          <StatusPill
            ok={readiness.isReadyToSign}
            label={readiness.isReadyToSign ? "Ready to sign" : "Not ready"}
          />
        </>
      )}
    </div>
  )
}
