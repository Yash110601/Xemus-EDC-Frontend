"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  confidenceBadgeClass,
  formatAiConfidence,
  matchStatusBadgeClass,
} from "@/lib/intelligence/xemusIntelligence"
import { Check, Loader2, Sparkles, X } from "lucide-react"

/**
 * Reusable suggest / accept / reject banner for YP Intelligence.
 */
export default function AiSuggestionBanner({
  title = "AI suggestion",
  loading = false,
  confidence = null,
  matchStatus = null,
  rationale = "",
  extractedText = "",
  suggestedLabel = "",
  suggestedValue = "",
  onAccept,
  onReject,
  acceptLabel = "Accept",
  rejectLabel = "Dismiss",
  disabled = false,
  className,
}) {
  const confidencePct = formatAiConfidence(confidence)

  return (
    <div
      className={cn(
        "rounded-xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-white p-3 shadow-sm",
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={title}
    >
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white shadow-sm">
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-violet-900">{title}</p>
            {suggestedLabel ? (
              <p className="truncate text-sm font-medium text-slate-900">{suggestedLabel}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {confidencePct != null ? (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
                confidenceBadgeClass(confidence),
              )}
            >
              {confidencePct}% confidence
            </span>
          ) : null}
          {matchStatus ? (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                matchStatusBadgeClass(matchStatus),
              )}
            >
              {String(matchStatus).replace(/_/g, " ")}
            </span>
          ) : null}
        </div>
      </div>

      {extractedText ? (
        <p className="mb-2 rounded-lg bg-white/80 px-2.5 py-2 text-xs leading-relaxed text-slate-700 ring-1 ring-slate-200/60">
          <span className="font-medium text-slate-500">Source: </span>
          {extractedText}
        </p>
      ) : null}

      {suggestedValue !== undefined && suggestedValue !== "" ? (
        <p className="mb-2 text-xs text-slate-600">
          <span className="font-medium text-slate-500">eCRF value: </span>
          {String(suggestedValue)}
        </p>
      ) : null}

      {rationale ? (
        <p className="mb-3 text-xs leading-relaxed text-slate-600">{rationale}</p>
      ) : null}

      {!loading && (onAccept || onReject) ? (
        <div className="flex flex-wrap gap-2">
          {onAccept ? (
            <Button
              type="button"
              size="sm"
              disabled={disabled}
              onClick={onAccept}
              className="h-8 rounded-lg bg-violet-700 text-white hover:bg-violet-800"
            >
              <Check className="mr-1 h-3.5 w-3.5" />
              {acceptLabel}
            </Button>
          ) : null}
          {onReject ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={onReject}
              className="h-8 rounded-lg border-slate-200"
            >
              <X className="mr-1 h-3.5 w-3.5" />
              {rejectLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
