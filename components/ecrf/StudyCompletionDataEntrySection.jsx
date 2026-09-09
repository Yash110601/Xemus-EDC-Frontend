"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import {
  STUDY_COMPLETION_DATA_ENTRY_PARENT_NAME,
  STUDY_COMPLETION_STATUS_OPTIONS,
  getStudyCompletionStatusCode,
} from "@/lib/crfDesigner/studyCompletionFormDesigner"

const OPTION_BTN_BASE =
  "rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap"

/**
 * Study Completion — gateway inside the same CRF card as fields (normal eCRF look).
 */
export default function StudyCompletionDataEntrySection({
  blocks = [],
  completedStudy = null,
  terminalStatusCode = null,
  disabled = false,
  onCompletedStudyChange,
  onTerminalStatusChange,
  className,
}) {
  /** Only statuses with a sub-section in this CRF design (Manage eCRF Form). */
  const terminalOptions = useMemo(() => {
    const configuredCodes = new Set(
      (blocks || []).map((b) => getStudyCompletionStatusCode(b)).filter((c) => c != null),
    )
    return STUDY_COMPLETION_STATUS_OPTIONS.filter((o) => configuredCodes.has(o.code))
  }, [blocks])

  return (
    <div className={cn("space-y-4", className)} role="group" aria-label={STUDY_COMPLETION_DATA_ENTRY_PARENT_NAME}>
      <div>
        <p className="text-sm font-semibold text-slate-900">Did patient complete study?</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onCompletedStudyChange?.(true)}
            className={cn(
              OPTION_BTN_BASE,
              completedStudy === true
                ? "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500/70"
                : "bg-slate-100/85 text-slate-700 hover:bg-emerald-50",
              disabled && "pointer-events-none opacity-50",
            )}
          >
            Yes
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onCompletedStudyChange?.(false)}
            className={cn(
              OPTION_BTN_BASE,
              completedStudy === false
                ? "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500/70"
                : "bg-slate-100/85 text-slate-700 hover:bg-emerald-50",
              disabled && "pointer-events-none opacity-50",
            )}
          >
            No
          </button>
        </div>
      </div>

      {completedStudy === false && (
        <div>
          <p className="text-sm font-semibold text-slate-900">Select patient status</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {terminalOptions.map((opt) => {
              const isActive = Number(terminalStatusCode) === opt.code
              return (
                <button
                  key={opt.code}
                  type="button"
                  disabled={disabled}
                  onClick={() => onTerminalStatusChange?.(opt.code)}
                  className={cn(
                    OPTION_BTN_BASE,
                    isActive
                      ? "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500/70"
                      : "bg-slate-100/85 text-slate-700 hover:bg-emerald-50",
                    disabled && "pointer-events-none opacity-50",
                  )}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
          {terminalOptions.length === 0 && (
            <p className="mt-2 text-xs text-amber-800">
              No patient status blocks are configured for this form. Add them in ECRF Form Designer.
            </p>
          )}
        </div>
      )}

      {completedStudy === true && (
        <p className="text-xs text-slate-500">
          Submit to record study completion for this patient.
        </p>
      )}
    </div>
  )
}
