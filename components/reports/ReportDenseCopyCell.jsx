"use client"

import { Copy } from "lucide-react"
import { toast } from "sonner"
import {
  REPORT_GRID_COPY_BTN_CLASS,
  REPORT_GRID_COPY_HOVER_REVEAL_CLASS,
} from "@/lib/reports/reportRowDisplay"
import { cn } from "@/lib/utils"

/**
 * Truncated report table cell with optional copy (used across dense audit/export grids).
 */
export default function ReportDenseCopyCell({ text, copyable = false, truncate = true }) {
  const titleText = String(text ?? "")
  const showCopy = copyable && titleText.trim() !== "" && titleText !== "-"

  const handleCopy = () => {
    const t = titleText.trim()
    if (!t || t === "-") return
    void navigator.clipboard.writeText(t).then(
      () => toast.success("Copied to clipboard"),
      () => toast.error("Could not copy"),
    )
  }

  return (
    <div className={cn("group/cell flex items-center gap-1.5", truncate && "min-w-0")}>
      <span
        className={cn(
          "text-left",
          truncate ? "min-w-0 flex-1 truncate pr-0.5" : "shrink-0 whitespace-nowrap",
        )}
        title={titleText}
      >
        {text}
      </span>
      {showCopy ? (
        <button
          type="button"
          className={cn(REPORT_GRID_COPY_BTN_CLASS, REPORT_GRID_COPY_HOVER_REVEAL_CLASS)}
          title="Copy value"
          aria-label="Copy cell value"
          onClick={(e) => {
            e.stopPropagation()
            handleCopy()
          }}
        >
          <Copy className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
      ) : null}
    </div>
  )
}
