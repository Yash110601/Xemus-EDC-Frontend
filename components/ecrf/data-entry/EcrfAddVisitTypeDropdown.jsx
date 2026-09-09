"use client"

import { ChevronDown, Loader2, Plus } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

function VisitTypeMenuItems({
  loading,
  supportsUnscheduled,
  supportsAdverse,
  onAddUnscheduled,
  onAddAdverse,
}) {
  return (
    <>
      {supportsUnscheduled ? (
        <DropdownMenuItem
          className="my-0.5 flex cursor-pointer flex-col items-stretch gap-0.5 rounded-xl px-2.5 py-2.5 focus:bg-emerald-50/90 data-[highlighted]:bg-emerald-50/90"
          disabled={loading}
          onSelect={() => onAddUnscheduled?.()}
        >
          <span className="font-medium text-slate-800">Unscheduled Visit</span>
          <span className="text-[11px] leading-snug text-slate-500">Add an unscheduled repeatable visit</span>
        </DropdownMenuItem>
      ) : null}
      {supportsAdverse ? (
        <DropdownMenuItem
          className="my-0.5 flex cursor-pointer flex-col items-stretch gap-0.5 rounded-xl px-2.5 py-2.5 focus:bg-emerald-50/90 data-[highlighted]:bg-emerald-50/90"
          disabled={loading}
          onSelect={() => onAddAdverse?.()}
        >
          <span className="font-medium text-slate-800">Adverse Event</span>
          <span className="text-[11px] leading-snug text-slate-500">Add an adverse event visit entry</span>
        </DropdownMenuItem>
      ) : null}
    </>
  )
}

export default function EcrfAddVisitTypeDropdown({
  visible = true,
  variant = "toolbar",
  disabled = false,
  loading = false,
  selectedPatientLabel,
  supportsUnscheduled = false,
  supportsAdverse = false,
  open,
  onOpenChange,
  onAddUnscheduled,
  onAddAdverse,
  className,
}) {
  if (!visible || (!supportsUnscheduled && !supportsAdverse)) return null

  const triggerDisabled = disabled || loading || (!supportsUnscheduled && !supportsAdverse)
  const isMatrix = variant === "matrix"

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        {isMatrix ? (
          <button
            type="button"
            disabled={triggerDisabled}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-emerald-300 bg-emerald-50/80 text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-55",
              className,
            )}
            title="Add unscheduled or adverse event visit"
            aria-label="Add visit type"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Plus className="h-4 w-4" aria-hidden />
            )}
          </button>
        ) : (
          <button
            type="button"
            disabled={triggerDisabled}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-xl border border-teal-300/85 bg-white px-3.5 text-xs font-semibold text-teal-800 shadow-sm transition hover:border-teal-400 hover:bg-teal-50/80 disabled:cursor-not-allowed disabled:opacity-55 sm:text-sm",
              className,
            )}
            title={
              disabled && !selectedPatientLabel
                ? "Select a patient from the matrix first"
                : "Add unscheduled or adverse event visit"
            }
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-teal-600" /> : null}
            <span className="whitespace-nowrap">{loading ? "Adding…" : "+ Add Visit Type"}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-teal-600/90" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={isMatrix ? "start" : "end"}
        side={isMatrix ? "right" : "bottom"}
        sideOffset={8}
        collisionPadding={12}
        className="z-[90] min-w-[17.5rem] rounded-2xl border border-slate-200/80 bg-white/95 p-1.5 shadow-xl backdrop-blur-xl"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DropdownMenuLabel className="px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
          Select visit type
          {selectedPatientLabel ? (
            <span className="mt-1 block text-[10px] font-medium normal-case tracking-normal text-slate-500">
              For {selectedPatientLabel}
            </span>
          ) : null}
        </DropdownMenuLabel>
        <VisitTypeMenuItems
          loading={loading}
          supportsUnscheduled={supportsUnscheduled}
          supportsAdverse={supportsAdverse}
          onAddUnscheduled={onAddUnscheduled}
          onAddAdverse={onAddAdverse}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
