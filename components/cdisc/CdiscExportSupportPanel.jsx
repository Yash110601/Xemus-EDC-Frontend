"use client"

import {
  CDISC_EXPORT_DOMAIN_SUPPORT,
  CDISC_FORMAT_SUPPORT,
  CDISC_MEMBERSHIP_NOTE,
  CDISC_STATUS_META,
  PILOT_STUDY_WORKFLOW,
} from "@/lib/cdisc/exportCapabilities"
import { cn } from "@/lib/utils"
import { Info } from "lucide-react"

function StatusBadge({ status, kind = "domain" }) {
  const meta = CDISC_STATUS_META[status] ?? CDISC_STATUS_META.partial
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        meta.className,
      )}
    >
      {kind === "format" && status === "supported" ? "Supported" : meta.label}
    </span>
  )
}

export default function CdiscExportSupportPanel({ variant = "full", className }) {
  const compact = variant === "compact"

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 flex gap-3">
        <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        <p className="text-sm text-slate-700 leading-relaxed">{CDISC_MEMBERSHIP_NOTE}</p>
      </div>

      {!compact ? (
        <div>
          <h3 className="text-sm font-semibold text-slate-800 mb-2">Pilot study workflow (no membership)</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-slate-600">
            {PILOT_STUDY_WORKFLOW.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      ) : null}

      <div>
        <h3 className="text-sm font-semibold text-slate-800 mb-2">SDTM domains</h3>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Domain</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                {!compact ? <th className="px-3 py-2 font-semibold">Source</th> : null}
                <th className="px-3 py-2 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {CDISC_EXPORT_DOMAIN_SUPPORT.map((row) => (
                <tr key={row.domain} className="bg-white">
                  <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">
                    {row.domain}
                    <span className="block text-xs font-normal text-slate-500">{row.label}</span>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={row.status} />
                  </td>
                  {!compact ? <td className="px-3 py-2 text-slate-600">{row.source}</td> : null}
                  <td className="px-3 py-2 text-slate-600 text-xs leading-relaxed">
                    {row.notes ?? row.variables}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!compact ? (
        <div>
          <h3 className="text-sm font-semibold text-slate-800 mb-2">Export formats</h3>
          <ul className="space-y-2">
            {CDISC_FORMAT_SUPPORT.map((row) => (
              <li
                key={row.format}
                className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-slate-100 bg-white px-3 py-2"
              >
                <div>
                  <span className="font-medium text-slate-800">{row.label}</span>
                  <p className="text-xs text-slate-600 mt-0.5">{row.detail}</p>
                </div>
                <StatusBadge status={row.status} kind="format" />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
