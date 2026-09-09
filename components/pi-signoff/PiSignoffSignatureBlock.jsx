"use client"

import { FileCheck } from "lucide-react"
import { isPiSignoffStatusVoided, isPiSignoffStatusSigned } from "@/lib/piSignoff/piSignoffReadiness"
import { PI_SIGNOFF_APPLY_ATTESTATION } from "@/lib/piSignoff/piSignoffAttestation"

function formatSignedAt(value) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}

/**
 * Printed-style PI signature block for eCRF (Part 11 display).
 */
export default function PiSignoffSignatureBlock({ record, className = "" }) {
  if (!record) return null

  const status = String(record.status ?? "Pending").trim()
  const signed = isPiSignoffStatusSigned(status)
  const voided = isPiSignoffStatusVoided(status)

  return (
    <div
      className={`mt-3 rounded-lg border border-slate-200/90 bg-white/90 px-3 py-2.5 ${className}`}
      aria-label="PI signature record"
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <FileCheck className="h-3.5 w-3.5 text-indigo-600" />
        Principal Investigator signature
      </div>
      <dl className="mt-2 grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Status</dt>
          <dd className={`font-semibold ${signed ? "text-emerald-700" : voided ? "text-amber-800" : "text-slate-800"}`}>
            {status}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Signed by</dt>
          <dd className="font-medium text-slate-900">{record.signedBy || "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Signed at</dt>
          <dd className="font-medium text-slate-900">{formatSignedAt(record.signedAt)}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Meaning of signature</dt>
          <dd className="text-slate-700">{PI_SIGNOFF_APPLY_ATTESTATION}</dd>
        </div>
        {record.comment ? (
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Comment</dt>
            <dd className="text-slate-700">{record.comment}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  )
}
