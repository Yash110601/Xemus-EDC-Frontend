"use client"

import { useMemo, useState } from "react"
import { Loader2, Mic, UploadCloud, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { confidenceBadgeClass, formatAiConfidence } from "@/lib/intelligence/xemusIntelligence"

const SECTION = cn(
  "rounded-2xl border border-slate-200/80 bg-slate-50/40",
  "shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
)

/**
 * Fill with AI — voice/upload choice, or per-field review before merge.
 */
export default function AiFillChoiceModal({
  open = false,
  onClose,
  onStartSpeaking,
  aiLoading = false,
  uploadDragActive = false,
  onUploadDrop,
  onUploadDragOver,
  onUploadDragLeave,
  onUploadChange,
  fileInputRef,
  acceptUpload = "",
  maxUploadMb = 10,
  /** Review mode — show suggestions instead of voice/upload UI */
  reviewMode = false,
  suggestions = [],
  sourceSnippet = "",
  onAcceptAll,
  onAcceptSelected,
  onRejectReview,
  onToggleSuggestion,
}) {
  const [localSelected, setLocalSelected] = useState(null)

  const rows = useMemo(() => {
    if (!reviewMode) return []
    if (localSelected) return localSelected
    return (suggestions || []).map((s) => ({ ...s, selected: s.selected !== false }))
  }, [reviewMode, suggestions, localSelected])

  const selectedCount = rows.filter((r) => r.selected).length

  const toggleRow = (fieldId) => {
    setLocalSelected((prev) => {
      const base = prev ?? (suggestions || []).map((s) => ({ ...s, selected: s.selected !== false }))
      return base.map((r) => (r.fieldId === fieldId ? { ...r, selected: !r.selected } : r))
    })
    onToggleSuggestion?.(fieldId)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-xl animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-fill-modal-title"
    >
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-[1.35rem] bg-white",
          "shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_28px_64px_-24px_rgba(15,23,42,0.3)]",
          "animate-in zoom-in-95 duration-300",
          reviewMode ? "max-w-lg" : "max-w-md",
        )}
      >
        <button
          type="button"
          onClick={reviewMode ? onRejectReview : onClose}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100/90 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800"
          aria-label="Close"
        >
          <X className="h-4 w-4" strokeWidth={2.25} />
        </button>

        <div className="px-7 pb-7 pt-10 sm:px-8 sm:pb-8">
          <h2
            id="ai-fill-modal-title"
            className="mb-6 text-center text-lg font-semibold tracking-tight text-slate-900"
          >
            {reviewMode ? "Review AI suggestions" : "Fill with AI"}
          </h2>

          {reviewMode ? (
            <>
              {sourceSnippet ? (
                <p className="mb-4 rounded-xl bg-violet-50/80 px-3 py-2 text-xs leading-relaxed text-slate-700 ring-1 ring-violet-100">
                  {sourceSnippet}
                </p>
              ) : null}
              <div className="max-h-[min(50vh,20rem)] space-y-2 overflow-y-auto pr-1">
                {rows.map((row) => {
                  const pct = formatAiConfidence(row.confidence)
                  return (
                    <label
                      key={row.fieldId}
                      className={cn(
                        "flex cursor-pointer gap-3 rounded-xl border px-3 py-2.5 transition",
                        row.selected
                          ? "border-violet-200 bg-violet-50/50"
                          : "border-slate-200 bg-white opacity-80",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(row.selected)}
                        onChange={() => toggleRow(row.fieldId)}
                        className="mt-1 h-4 w-4 rounded border-slate-300"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-slate-900">{row.fieldLabel}</span>
                          {pct != null ? (
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
                                confidenceBadgeClass(row.confidence),
                              )}
                            >
                              {pct}%
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-600">
                          {String(row.suggestedValue ?? "")}
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="flex-1 bg-violet-700 hover:bg-violet-800"
                  disabled={selectedCount === 0}
                  onClick={() => onAcceptSelected?.(rows.filter((r) => r.selected))}
                >
                  Accept selected ({selectedCount})
                </Button>
                <Button type="button" variant="outline" onClick={() => onAcceptAll?.(rows)}>
                  Accept all
                </Button>
                <Button type="button" variant="ghost" onClick={onRejectReview}>
                  Reject all
                </Button>
              </div>
            </>
          ) : (
            <>
              <section className={cn(SECTION, "bg-white px-5 py-6")}>
                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-5">
                    <span
                      className="ai-processing-orb-halo absolute -inset-2 rounded-2xl bg-teal-400/10"
                      aria-hidden
                    />
                    <span
                      className={cn(
                        "relative flex h-16 w-16 items-center justify-center rounded-2xl",
                        "bg-gradient-to-b from-teal-500 via-teal-600 to-emerald-700",
                        "shadow-[0_10px_28px_-8px_rgba(99,102,241,0.45),inset_0_1px_0_rgba(255,255,255,0.35)]",
                      )}
                    >
                      {aiLoading ? (
                        <Loader2 className="h-7 w-7 animate-spin text-white" aria-hidden />
                      ) : (
                        <Mic className="h-7 w-7 text-white" strokeWidth={2} aria-hidden />
                      )}
                    </span>
                  </div>
                  <p className="mb-5 max-w-[18rem] text-sm leading-relaxed text-slate-600">
                    Speak the details you want added to this CRF
                  </p>
                  <button
                    type="button"
                    onClick={onStartSpeaking}
                    disabled={aiLoading}
                    className={cn(
                      "w-full max-w-[16rem] rounded-full px-6 py-3 text-sm font-semibold text-white",
                      "bg-gradient-to-b from-slate-800 to-slate-900 shadow-md",
                      "transition-all hover:from-slate-700 hover:to-slate-800 active:scale-[0.98]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:ring-offset-2",
                      "disabled:pointer-events-none disabled:opacity-50",
                    )}
                  >
                    {aiLoading ? "Please wait" : "Start Speaking"}
                  </button>
                </div>
              </section>

              <p className="my-5 text-center">
                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  or
                </span>
              </p>

              <section className={cn(SECTION, "p-3")}>
                <label
                  onDrop={onUploadDrop}
                  onDragOver={onUploadDragOver}
                  onDragLeave={onUploadDragLeave}
                  className={cn(
                    "flex min-h-[9.25rem] w-full cursor-pointer flex-col items-center justify-center rounded-xl px-4 py-5 text-center transition-all duration-200",
                    "border border-dashed",
                    uploadDragActive
                      ? "border-teal-400 bg-teal-50/80"
                      : "border-slate-300/90 bg-white hover:border-teal-300 hover:bg-teal-50/40",
                    aiLoading && "pointer-events-none opacity-60",
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={acceptUpload}
                    onChange={onUploadChange}
                    disabled={aiLoading}
                    className="hidden"
                  />
                  <UploadCloud className="mb-3 h-9 w-9 text-teal-600/90" strokeWidth={1.5} aria-hidden />
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold text-teal-700">Choose a file</span>
                    <span className="text-slate-500"> or drop here</span>
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    PDF, PNG, JPEG, JPG up to {maxUploadMb}MB
                  </p>
                </label>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
