"use client"

import { Copy } from "lucide-react"
import { toast } from "sonner"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  REPORT_GRID_COPY_BTN_CLASS,
  REPORT_GRID_COPY_HOVER_REVEAL_CLASS,
} from "@/lib/reports/reportRowDisplay"

async function copyToClipboard(text) {
  const value = String(text ?? "")
  if (!value) return
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
    } else {
      const ta = document.createElement("textarea")
      ta.value = value
      ta.style.position = "fixed"
      ta.style.left = "-9999px"
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      document.execCommand("copy")
      document.body.removeChild(ta)
    }
    toast.success("Copied")
  } catch {
    toast.error("Copy failed")
  }
}

/**
 * Single-line truncation, Radix tooltip with full text, copy control (audit-log style, Mac-friendly grid cells).
 */
export function TruncTooltipCopyCell({
  value,
  className,
  textClassName,
  emptyLabel = "—",
  /** When true, still show copy for whitespace-only if you pass trimmed elsewhere */
  disableCopy = false,
}) {
  const raw = value === null || value === undefined ? "" : String(value)
  const trimmed = raw.trim()
  const isEmpty = !trimmed

  if (isEmpty) {
    return <span className={cn("text-[11px] text-slate-400", className)}>{emptyLabel}</span>
  }

  const showCopy = !disableCopy && Boolean(trimmed)

  return (
    <div className={cn("group/cell relative flex min-w-0 max-w-full items-center gap-1", className)}>
      <Tooltip delayDuration={280}>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "block min-w-0 max-w-full cursor-default truncate text-left leading-snug text-slate-800",
              textClassName,
            )}
            tabIndex={0}
          >
            {trimmed}
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="start"
          sideOffset={8}
          className="z-[100] max-w-[min(28rem,90vw)] whitespace-pre-wrap break-words border border-slate-200/90 bg-white px-3.5 py-2.5 text-xs leading-relaxed text-slate-800 shadow-[0_16px_48px_-20px_rgba(15,23,42,0.45)]"
        >
          {raw}
        </TooltipContent>
      </Tooltip>
      {showCopy ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            void copyToClipboard(raw)
          }}
          className={cn(REPORT_GRID_COPY_BTN_CLASS, REPORT_GRID_COPY_HOVER_REVEAL_CLASS)}
          title="Copy"
          aria-label="Copy full cell text"
        >
          <Copy className="h-4 w-4" strokeWidth={2} />
        </button>
      ) : null}
    </div>
  )
}
