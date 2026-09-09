"use client"

import { X, CheckCircle, Clock, Loader2, XCircle, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"

function formPickerTitles(form) {
  const design = String(form?.crfDesignName || "").trim()
  const section = String(form?.sectionName || "").trim()
  const sectionIsGeneric = !section || /^section\s*\d+$/i.test(section) || section === "Form"
  if (design && sectionIsGeneric) {
    return { title: design, subtitle: section && section !== design ? section : null }
  }
  if (section && design && section !== design) {
    return { title: section, subtitle: design }
  }
  return { title: design || section || "Form", subtitle: null }
}

export default function EcrfMatrixFormPickerDialog({
  open,
  visitName,
  patientLabel,
  forms = [],
  loading,
  onSelect,
  onClose,
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ecrf-matrix-form-picker-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 bg-gradient-to-r from-emerald-50/90 to-teal-50/70 px-5 py-4">
          <div className="min-w-0">
            <h3 id="ecrf-matrix-form-picker-title" className="text-base font-bold text-slate-900">
              Select CRF form
            </h3>
            <p className="mt-0.5 truncate text-sm text-slate-600">
              {patientLabel} · {visitName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-slate-800"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[min(24rem,60vh)] overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500" role="status" aria-busy="true">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
              Loading forms…
            </div>
          ) : forms.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No forms available for this visit.</p>
          ) : (
            <div className="space-y-2">
              {forms.map((form) => {
                const formStatus = form.status || "notstarted"
                const statusConfig = {
                  completed: { icon: CheckCircle, text: "Completed", className: "text-emerald-700" },
                  inprogress: { icon: Clock, text: "In progress", className: "text-amber-700" },
                  notstarted: { icon: XCircle, text: "Not started", className: "text-slate-500" },
                }
                const meta = statusConfig[formStatus] || statusConfig.notstarted
                const Icon = meta.icon
                const isSdvDone = Boolean(form.isSdvVerify ?? form.IsSdvVerify)
                const titles = formPickerTitles(form)

                return (
                  <button
                    key={form.id}
                    type="button"
                    disabled={form.canView === false}
                    onClick={() => onSelect(form)}
                    className={cn(
                      "w-full rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50/50",
                      form.canView === false && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{titles.title}</p>
                        {titles.subtitle ? (
                          <p className="truncate text-xs text-slate-500">{titles.subtitle}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className={cn("inline-flex items-center gap-1 text-xs font-medium", meta.className)}>
                          <Icon className="h-3.5 w-3.5" />
                          {meta.text}
                        </span>
                        {isSdvDone ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                            <ShieldCheck className="h-3 w-3" aria-hidden />
                            SDV done
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
