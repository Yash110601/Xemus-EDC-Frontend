"use client"

import { useMemo, useState } from "react"
import { ClipboardCheck, Plus } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getAvailableStudyCompletionStatusOptions,
  getStudyCompletionStatusCode,
  getStudyCompletionStatusLabel,
  isStudyCompletionStatusSection,
} from "@/lib/crfDesigner/studyCompletionFormDesigner"

const PLACEHOLDER = "__pick_status__"

/**
 * Compact Study Completion Form bar — status picker + active block chips.
 */
export default function StudyCompletionDesignerPanel({
  sections = [],
  activeSection = "",
  configReady = true,
  onAddStatusSection,
  onActivateSection,
}) {
  const [pendingCode, setPendingCode] = useState(PLACEHOLDER)

  const available = useMemo(() => getAvailableStudyCompletionStatusOptions(sections), [sections])
  const allUsed = available.length === 0
  const canAdd = configReady && !allUsed && pendingCode !== PLACEHOLDER

  const statusSections = useMemo(
    () => (sections || []).filter(isStudyCompletionStatusSection),
    [sections],
  )

  const handleAdd = () => {
    const code = Number.parseInt(String(pendingCode), 10)
    if (!Number.isFinite(code)) return
    onAddStatusSection?.(code)
    setPendingCode(PLACEHOLDER)
  }

  return (
    <div className="mb-2 rounded-lg border border-teal-200/70 bg-teal-50/40 px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-600/15 text-teal-700">
            <ClipboardCheck className="h-3.5 w-3.5" aria-hidden />
          </span>
          <span className="text-xs font-semibold text-slate-800 whitespace-nowrap">
            Study Completion
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
          <Select
            value={pendingCode}
            onValueChange={setPendingCode}
            disabled={!configReady || allUsed}
          >
            <SelectTrigger className="h-8 w-[min(100%,11rem)] rounded-md border border-slate-200 bg-white px-2 text-xs shadow-none">
              <SelectValue placeholder={allUsed ? "All added" : "Status…"} />
            </SelectTrigger>
            <SelectContent className="rounded-lg border border-slate-200 bg-white shadow-md">
              <SelectItem value={PLACEHOLDER} disabled className="text-xs text-slate-400">
                Select status…
              </SelectItem>
              {available.map((opt) => (
                <SelectItem key={opt.code} value={String(opt.code)} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <button
            type="button"
            onClick={handleAdd}
            disabled={!canAdd}
            title={!canAdd && !allUsed ? "Select a status first" : "Add sub-section below"}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md bg-teal-600 px-2.5 text-xs font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add block
          </button>

          {!configReady ? (
            <span className="text-[10px] text-amber-700">Fill Name, Study & Visit first</span>
          ) : !canAdd && !allUsed ? (
            <span className="text-[10px] text-amber-700">Pick status first</span>
          ) : null}
        </div>

        {statusSections.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto sm:ml-auto border-t sm:border-t-0 border-teal-200/60 pt-2 sm:pt-0">
            <span className="text-[10px] font-medium text-slate-500 shrink-0">Sub-sections:</span>
            {statusSections.map((sec) => {
              const code = getStudyCompletionStatusCode(sec)
              const label = getStudyCompletionStatusLabel(code) || sec.name
              const isActive = sec.id === activeSection
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => onActivateSection?.(sec.id)}
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    isActive
                      ? "border-teal-600 bg-teal-600 text-white"
                      : "border-teal-200/80 bg-white text-teal-900 hover:bg-teal-50"
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}
