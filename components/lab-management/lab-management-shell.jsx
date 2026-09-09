"use client"

import { FlaskConical } from "lucide-react"

/**
 * Page chrome aligned with Reports (e.g. export-study-details): indigo icon chip,
 * slate title stack, content cards handle their own panels (no double glass wrap).
 */
export default function LabManagementShell({ title, subtitle, children }) {
  return (
    <div className="min-h-full">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-950/50">
          <FlaskConical className="h-6 w-6 text-emerald-600 dark:text-emerald-400" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">{title}</h1>
          {subtitle ? (
            <p className="mt-0.5 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">{subtitle}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-6">{children}</div>
    </div>
  )
}
