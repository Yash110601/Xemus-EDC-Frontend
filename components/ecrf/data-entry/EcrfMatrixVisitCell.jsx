"use client"

import { useRef } from "react"
import { CheckCircle2, Clock3, Loader2, Lock, MessageSquare, Minus } from "lucide-react"
import { ECRF_MATRIX_STATUS } from "@/lib/utils/ecrfVisitMatrixStatus"
import { cn } from "@/lib/utils"

const QUERY_OPEN_VISUAL = {
  label: (count) => (count === 1 ? "1 open query" : `${count} open queries`),
  card:
    "border border-amber-200/75 bg-gradient-to-br from-amber-50/55 via-white/95 to-amber-50/40 shadow-[0_6px_20px_-14px_rgba(245,158,11,0.28),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-sm",
  bar: "bg-gradient-to-r from-amber-400 to-amber-500",
  text: "text-amber-950",
  subtext: "text-amber-800/90",
  iconWrap: "bg-amber-50/90 text-amber-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-amber-200/60",
}

export default function EcrfMatrixVisitCell({
  visit,
  cell,
  isSelected,
  isLoading,
  isLocked,
  lockReason,
  onClick,
  onQueryClick,
  onLockedTap,
}) {
  const statusKey = isLocked ? "locked" : cell?.status || "pending"
  const baseTheme = ECRF_MATRIX_STATUS[statusKey] || ECRF_MATRIX_STATUS.pending
  const openQueries = Math.max(0, Number(cell?.openQueries ?? 0) || 0)
  const hasOpenQueries = openQueries > 0
  const theme = hasOpenQueries
    ? {
        ...baseTheme,
        card: QUERY_OPEN_VISUAL.card,
        bar: QUERY_OPEN_VISUAL.bar,
        text: QUERY_OPEN_VISUAL.text,
        subtext: QUERY_OPEN_VISUAL.subtext,
        label: QUERY_OPEN_VISUAL.label(openQueries),
      }
    : baseTheme
  const progress = Math.max(0, Math.min(100, Number(cell?.progressPercent ?? 0)))
  const requiredFields = Number(cell?.requiredFieldCount ?? 0) || 0
  const completedFields = Number(cell?.completedRequiredFieldCount ?? 0) || 0
  const showFieldCounts = Boolean(cell?.hasFieldProgress && requiredFields > 0)

  const fieldTitle = showFieldCounts
    ? `${completedFields} of ${requiredFields} required fields filled`
    : ""
  const titleText =
    lockReason ||
    [
      visit?.name || "Visit",
      hasOpenQueries ? theme.label : baseTheme.label,
      hasOpenQueries ? "Review required · re-SDV may be needed" : null,
      fieldTitle,
      showFieldCounts ? null : `${progress}%`,
    ]
      .filter(Boolean)
      .join(" — ")

  const StatusIcon = hasOpenQueries
    ? MessageSquare
    : statusKey === "completed"
      ? CheckCircle2
      : statusKey === "inprocess"
        ? Clock3
        : statusKey === "locked"
          ? Lock
          : Minus

  const handleQueryClick = (event) => {
    event.stopPropagation()
    onQueryClick?.()
  }

  const touchRef = useRef({ x: 0, y: 0, moved: false })
  const lastTouchEndRef = useRef(0)

  const handlePointerDown = (event) => {
    touchRef.current = { x: event.clientX, y: event.clientY, moved: false }
  }

  const handlePointerMove = (event) => {
    const dx = Math.abs(event.clientX - touchRef.current.x)
    const dy = Math.abs(event.clientY - touchRef.current.y)
    if (dx > 10 || dy > 10) touchRef.current.moved = true
  }

  const activateCell = () => {
    if (!isLocked && !isLoading) onClick?.()
  }

  const handleTouchEnd = (event) => {
    if (isLocked) {
      if (lockReason) {
        event.preventDefault()
        onLockedTap?.(lockReason)
      }
      return
    }
    if (isLoading || touchRef.current.moved) return
    event.preventDefault()
    lastTouchEndRef.current = Date.now()
    activateCell()
  }

  return (
    <div
      role="button"
      tabIndex={isLocked || isLoading ? -1 : 0}
      title={titleText}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onTouchEnd={handleTouchEnd}
      onClick={() => {
        if (Date.now() - lastTouchEndRef.current < 500) return
        if (isLocked) {
          if (lockReason) onLockedTap?.(lockReason)
          return
        }
        activateCell()
      }}
      onKeyDown={(event) => {
        if (isLocked || isLoading) return
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onClick?.()
        }
      }}
      className={cn(
        "group relative flex h-[6.75rem] w-full min-w-0 flex-col gap-2 rounded-2xl border p-3 text-left transition-all duration-200 ease-out touch-manipulation select-none",
        theme.card,
        isLocked ? "cursor-not-allowed opacity-80" : "cursor-pointer hover:-translate-y-px hover:shadow-lg hover:shadow-amber-900/5",
        isSelected &&
          (hasOpenQueries
            ? "z-[2] !border-2 !border-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.28)]"
            : "z-[2] !border-2 !border-emerald-600 shadow-[0_0_0_3px_rgba(5,150,105,0.28)]"),
        isSelected && !isLocked && "scale-[1.01]",
      )}
      aria-current={isSelected ? "true" : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1 leading-tight">
          <p className={cn("truncate text-[11px] font-bold uppercase tracking-[0.03em]", theme.text)}>
            {visit?.name || "Visit"}
          </p>
          {hasOpenQueries ? (
            <button
              type="button"
              onClick={handleQueryClick}
              className={cn(
                "mt-1 text-left text-[10px] font-medium leading-snug underline decoration-amber-400/50 underline-offset-2 transition hover:decoration-amber-500",
                theme.subtext,
              )}
              aria-label={`${openQueries} open ${openQueries === 1 ? "query" : "queries"} — view query management`}
            >
              {theme.label}
            </button>
          ) : (
            <p className={cn("mt-1 text-[10px] font-medium leading-snug", theme.subtext)}>
              {baseTheme.label}
            </p>
          )}
        </div>
        {hasOpenQueries ? (
          <button
            type="button"
            onClick={handleQueryClick}
            className={cn(
              "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors duration-300",
              QUERY_OPEN_VISUAL.iconWrap,
            )}
            aria-label={`${openQueries} open ${openQueries === 1 ? "query" : "queries"} — view query management`}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label="Loading" />
            ) : (
              <StatusIcon className="h-3.5 w-3.5" aria-hidden />
            )}
            <span
              className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-0.5 text-[8px] font-bold leading-none text-white shadow-sm"
              aria-hidden
            >
              {openQueries}
            </span>
          </button>
        ) : (
          <span
            className={cn(
              "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors duration-300",
              "bg-white/75 ring-1 ring-black/5",
              theme.text,
            )}
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label="Loading" />
            ) : (
              <StatusIcon className="h-3.5 w-3.5" aria-hidden />
            )}
          </span>
        )}
      </div>

      <div className="mt-auto space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-[10px] tabular-nums leading-none">
          {showFieldCounts ? (
            <span className={cn("font-medium", theme.subtext)}>
              <span className="font-semibold">{completedFields}</span>
              <span className="opacity-60">/{requiredFields}</span>
            </span>
          ) : (
            <span className={cn("font-medium opacity-70", theme.subtext)}>Progress</span>
          )}
          <span className={cn("font-bold", theme.text)}>{progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/70 ring-1 ring-black/[0.04]">
          <div
            className={cn("h-full rounded-full transition-all duration-500 ease-out", theme.bar)}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
