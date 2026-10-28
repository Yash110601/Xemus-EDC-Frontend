"use client"

import { useState } from "react"
import { Loader2, RefreshCw, Check, SquarePen, FileEdit } from "lucide-react"
import SectionSkeleton from "@/components/ui/section-skeleton"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DialogHeader } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

/** Canvas aligned with Reports pages — neutral slate field behind white/shadow cards */
export function LabManagementPageBackdrop({ children }) {
  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-950">
      {children}
    </div>
  )
}

/**
 * Create | Manage — study-style underline tabs (reference: Create / Manage primary navigation).
 */
export function LabSectionModeTabs({
  value,
  onChange,
  createLabel = "Create",
  manageLabel = "Manage",
}) {
  const tabs = [
    { key: "create", label: createLabel },
    { key: "manage", label: manageLabel },
  ]
  return (
    <div
      className="flex w-full gap-0 border-b border-slate-200/90 dark:border-slate-700"
      role="tablist"
      aria-label="Section mode"
    >
      {tabs.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={value === key}
          className={cn(
            "-mb-px min-w-[120px] flex-1 border-b-2 px-4 py-3 text-center text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/35 focus-visible:ring-offset-2 sm:min-w-[140px] sm:flex-none sm:px-8",
            value === key
              ? "border-emerald-600 text-slate-900 dark:border-emerald-400 dark:text-white"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200",
          )}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/** Create | Manage — segmented control, glass, calm typography */
export function LabModeSegment({ value, onChange }) {
  return (
    <div
      className="flex gap-1 rounded-2xl border border-slate-200/80 bg-slate-100/70 p-1 shadow-inner backdrop-blur-md dark:border-slate-600/60 dark:bg-slate-800/50"
      role="tablist"
      aria-label="Mode"
    >
      {["create", "manage"].map((key) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={value === key}
          className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold tracking-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 ${
            value === key
              ? "bg-white text-slate-900 shadow-[0_4px_14px_-4px_rgba(15,23,42,0.2)] dark:bg-white/95 dark:text-slate-900"
              : "text-slate-600 hover:bg-white/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-100"
          }`}
          onClick={() => onChange(key)}
        >
          {key === "create" ? "Create" : "Manage"}
        </button>
      ))}
    </div>
  )
}

/** Matches Reports filter blocks (e.g. export-study-details): shadow-xl + indigo/purple header strip */
export function LabPanelCard({ title, icon: Icon, subtitle, actions, children }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl dark:border-slate-700/80 dark:bg-slate-900/90 dark:shadow-[0_24px_48px_-28px_rgba(0,0,0,0.45)]">
      <div className="border-b border-slate-200 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 px-6 py-4 dark:border-slate-700 dark:from-emerald-950/45 dark:via-teal-950/35 dark:to-emerald-950/45">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            {Icon ? (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/90 shadow-sm dark:bg-slate-800/90">
                <Icon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
              </div>
            ) : null}
            <div>
              <h2 className="text-lg font-bold leading-tight text-slate-800 dark:text-slate-100">{title}</h2>
              {subtitle ? <p className="text-xs text-slate-600 dark:text-slate-400">{subtitle}</p> : null}
            </div>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  )
}

/** Data table container — white card shell (matches reports results panels) */
export function LabTableFrame({ children }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl dark:border-slate-700/80 dark:bg-slate-900/90 dark:shadow-[0_20px_44px_-28px_rgba(0,0,0,0.4)]">
      {children}
    </div>
  )
}

/** Manage-tab grid — audit-trail style thead/tbody (reports parity) */
export const labManageGridTheadClass =
  "bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900/90"

export function labManageGridTh(...parts) {
  return cn(
    "border-b-2 border-slate-200 px-4 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-700 whitespace-nowrap dark:border-slate-600 dark:text-slate-200",
    ...parts,
  )
}

export const labManageGridTbodyClass =
  "divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950/20"

export const labManageGridTrClass =
  "transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"

export function labManageGridTd(...parts) {
  return cn("px-4 py-3 text-sm text-slate-700 dark:text-slate-300", ...parts)
}

/** Manage-tab search — magnifier on the right; extra right padding so text does not overlap the icon */
export const labManageSearchIconClass =
  "pointer-events-none absolute right-4 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-slate-400"

export const labManageSearchInputPadClass = "pr-12"

/**
 * Export CSV — shared green outline treatment across lab management sub-features
 * (matches reference: forest green border + icon + label).
 */
export const labExportCsvButtonClass =
  "h-11 gap-2 rounded-xl border-2 border-emerald-700/90 bg-white font-semibold text-emerald-900 shadow-sm hover:bg-emerald-50 hover:border-emerald-800 dark:border-emerald-600 dark:bg-slate-950 dark:text-emerald-100 dark:hover:bg-emerald-950/45 items-center justify-center"

/** Manage grid — centered edit only (use Status column for active/inactive). */
export const labManageEditActionBtnClass =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-700 shadow-sm transition hover:bg-teal-200 hover:text-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/45 disabled:pointer-events-none disabled:opacity-40 dark:bg-teal-950/55 dark:text-teal-200 dark:hover:bg-teal-900/75"

export function LabManageGridRowActions({ rowLabel, statusBusy, onEdit }) {
  return (
    <div
      className="flex w-full items-center justify-center py-0.5"
      role="group"
      aria-label={`Actions for ${rowLabel}`}
    >
      <button
        type="button"
        className={labManageEditActionBtnClass}
        disabled={statusBusy}
        onClick={onEdit}
        aria-label={`Edit ${rowLabel}`}
      >
        <SquarePen className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}

/** Full table skeleton for Manage tab (not nested in <td>) */
export function LabTableSkeleton({ variant, rows = 6, title = "Loading records" }) {
  return <SectionSkeleton variant={variant} rows={rows} title={title} className="!px-0 !py-0" />
}

/**
 * Form block — Create tab uses default surface; edit modals use `surface="modal"` for a lifted
 * white card (Edit User–style) on the soft modal body tint.
 */
export function LabFormSection({ children, surface = "default" }) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5 sm:p-6",
        surface === "modal"
          ? "border-slate-200/70 bg-white shadow-[0_16px_48px_-28px_rgba(15,23,42,0.16)] ring-1 ring-slate-100/90 dark:border-slate-600/55 dark:bg-slate-900/95 dark:shadow-[0_16px_48px_-28px_rgba(0,0,0,0.38)] dark:ring-slate-800/70"
          : "border-slate-200/60 bg-gradient-to-b from-white/95 to-slate-50/50 shadow-sm dark:border-slate-600/50 dark:from-slate-900/60 dark:to-slate-900/40",
      )}
    >
      {children}
    </div>
  )
}

/** Shared `DialogContent` chrome for Lab Management edit flows */
export const labEditDialogContentClass = cn(
  "gap-0 overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-0",
  "shadow-[0_28px_72px_-36px_rgba(15,23,42,0.38)] dark:border-slate-700 dark:bg-slate-950",
)

/** Sky → indigo → violet strip (Edit User reference) */
export const labEditDialogHeaderStripClass = cn(
  "border-b border-slate-200/50 bg-gradient-to-r from-sky-50/98 via-emerald-50/45 to-teal-50/88 px-6 pb-5 pt-6",
  "dark:border-slate-700 dark:from-slate-900 dark:via-emerald-950/30 dark:to-teal-950/25",
)

export const labEditDialogIconChipClass = cn(
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
  "border border-white/90 bg-white/95 shadow-[0_8px_26px_-12px_rgba(99,102,241,0.38)] ring-1 ring-emerald-100/85",
  "dark:border-slate-600 dark:bg-slate-800/95 dark:ring-emerald-900/45",
)

export const labEditDialogFooterClass = cn(
  "flex shrink-0 flex-col-reverse gap-3 border-t border-slate-200/80 bg-gradient-to-b from-slate-50/95 to-white px-6 py-4",
  "sm:flex-row sm:justify-end dark:border-slate-800 dark:from-slate-900/80 dark:to-slate-950/90",
)

export const labEditCancelButtonClass = cn(
  "h-11 rounded-xl border-2 border-slate-300 bg-white font-semibold text-slate-800 hover:bg-slate-50",
  "dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
)

export const labEditPrimaryButtonClass = cn(
  "inline-flex h-11 items-center gap-2 rounded-xl px-6 font-semibold text-white",
  "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 bg-[length:200%_100%]",
  "shadow-[0_10px_28px_-8px_rgba(79,70,229,0.52)] transition-[background-position,box-shadow] duration-300",
  "hover:bg-[position:100%_0] hover:shadow-[0_14px_36px_-8px_rgba(79,70,229,0.58)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/45 focus-visible:ring-offset-2",
  "disabled:pointer-events-none disabled:opacity-55 disabled:shadow-none",
)

/** Gradient header + icon chip — pass `DialogTitle` (and optional extra header nodes) as children. */
export function LabEditDialogHeader({ icon: Icon = FileEdit, children }) {
  return (
    <div className={labEditDialogHeaderStripClass}>
      <DialogHeader className="gap-0 space-y-0 p-0 text-left">
        <div className="flex items-start gap-3">
          <div className={labEditDialogIconChipClass}>
            <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">{children}</div>
        </div>
      </DialogHeader>
    </div>
  )
}

/**
 * Scrollable modal body — soft tint behind the form card.
 * Pass `fill` inside flex column dialogs (`min-h-0 flex-1`), e.g. range assignment edit.
 */
export function LabEditDialogBody({ children, className, fill }) {
  return (
    <div
      className={cn(
        fill
          ? "min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-slate-50/35 px-6 py-5 dark:bg-slate-950/40"
          : "max-h-[min(60vh,560px)] overflow-y-auto bg-slate-50/35 px-6 py-5 dark:bg-slate-950/40",
        className,
      )}
    >
      {children}
    </div>
  )
}

const skTone = "bg-slate-200/85 dark:bg-slate-700/80"

function SkeletonField({
  fullWidth,
  tall,
  extraTall,
  /** Matches range-assignment edit controls */
  compact,
  hideCounter,
  className,
}) {
  const inputCls = cn(
    "w-full border border-transparent",
    extraTall ? "min-h-[88px] rounded-2xl" : "",
    !extraTall && tall ? "min-h-[72px] rounded-2xl" : "",
    !extraTall && !tall && compact ? "h-11 rounded-2xl" : "",
    !extraTall && !tall && !compact ? "h-11 rounded-2xl" : "",
    skTone,
  )
  return (
    <div className={cn(fullWidth && "md:col-span-2", className)}>
      <Skeleton className={cn(compact ? "mb-1 h-3 w-24 rounded-md" : "mb-2 h-4 w-32 max-w-[45%] rounded-md", skTone)} />
      <Skeleton className={inputCls} />
      {hideCounter ? null : (
        <Skeleton className={cn("mt-1.5 h-3 w-14 rounded-md opacity-70", skTone)} />
      )}
    </div>
  )
}

/**
 * Matches real edit-dialog form layout (not table-style SectionSkeleton).
 * Use while a single record is fetched for edit modals.
 */
export function LabEditFormSkeleton({ variant = "facility", className }) {
  if (variant === "labTest") {
    return (
      <div
        className={cn("py-2", className)}
        role="status"
        aria-busy="true"
        aria-label="Loading record"
      >
        <LabFormSection surface="modal">
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
              <SkeletonField />
              <SkeletonField />
            </div>
            <SkeletonField fullWidth tall />
          </div>
        </LabFormSection>
      </div>
    )
  }

  if (variant === "simple") {
    return (
      <div
        className={cn("py-2", className)}
        role="status"
        aria-busy="true"
        aria-label="Loading record"
      >
        <LabFormSection surface="modal">
          <div className="space-y-5">
            <SkeletonField fullWidth />
            <SkeletonField fullWidth extraTall />
          </div>
        </LabFormSection>
      </div>
    )
  }

  if (variant === "range") {
    return (
      <div className={cn("py-2", className)} role="status" aria-busy="true" aria-label="Loading record">
        <LabFormSection surface="modal">
          <div className="grid gap-3">
            <SkeletonField compact hideCounter />
            <SkeletonField compact hideCounter />
            <SkeletonField compact hideCounter />
            <div className="grid grid-cols-2 gap-2">
              <SkeletonField compact hideCounter />
              <SkeletonField compact hideCounter />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <SkeletonField compact hideCounter />
              <SkeletonField compact hideCounter />
            </div>
            <SkeletonField compact hideCounter />
            <div className="grid grid-cols-2 gap-2">
              <SkeletonField compact hideCounter />
              <SkeletonField compact hideCounter />
            </div>
            <SkeletonField compact hideCounter />
          </div>
        </LabFormSection>
      </div>
    )
  }

  /* facility — labs master */
  return (
    <div
      className={cn("py-2", className)}
      role="status"
      aria-busy="true"
      aria-label="Loading record"
    >
      <LabFormSection surface="modal">
        <div className="grid gap-5 md:grid-cols-2">
          <SkeletonField />
          <SkeletonField />
          <SkeletonField compact hideCounter />
          <SkeletonField compact hideCounter />
          <SkeletonField compact hideCounter />
          <SkeletonField compact hideCounter />
          <SkeletonField fullWidth tall />
          <SkeletonField fullWidth extraTall />
        </div>
      </LabFormSection>
    </div>
  )
}

/** Form field label — report-style bold label */
export function LabFieldLabel({ children, required, className }) {
  return (
    <label
      className={cn("flex items-center gap-1 text-sm font-bold text-slate-800 dark:text-slate-200", className)}
    >
      {children}
      {required ? <span className="text-red-500">*</span> : null}
    </label>
  )
}

/** Status filter as dropdown — clear label spacing, pairs with search/export rows */
export function LabStatusFilterSelect({ value, onChange, className }) {
  return (
    <div className={cn("flex w-full min-w-0 shrink-0 flex-col gap-2 lg:w-[13rem]", className)}>
      <LabFieldLabel className="block w-full leading-tight">Status</LabFieldLabel>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          aria-label="Filter by status"
          className="h-11 w-full min-w-[11rem] rounded-2xl border-2 border-slate-200/85 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm dark:border-slate-600 dark:bg-slate-900 sm:w-[12rem]"
        >
          <SelectValue placeholder="Select status" />
        </SelectTrigger>
        <SelectContent position="popper" className="z-[200]">
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="true">Active only</SelectItem>
          <SelectItem value="false">Inactive only</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

/** All | Active | Inactive — tab strip for list filtering (replaces status dropdown) */
export function LabStatusFilterTabs({ value, onChange, className }) {
  const opts = [
    { key: "all", label: "All" },
    { key: "true", label: "Active" },
    { key: "false", label: "Inactive" },
  ]
  return (
    <div className={cn("space-y-2", className)}>
      <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Status</span>
      <div
        className="inline-flex flex-wrap gap-1 rounded-2xl border border-slate-200/80 bg-slate-100/70 p-1 shadow-inner backdrop-blur-md dark:border-slate-600/60 dark:bg-slate-800/50"
        role="tablist"
        aria-label="Status filter"
      >
        {opts.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={value === key}
            className={cn(
              "rounded-xl px-3 py-2 text-xs font-semibold tracking-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 sm:px-4 sm:text-sm",
              value === key
                ? "bg-white text-slate-900 shadow-[0_4px_14px_-4px_rgba(15,23,42,0.2)] dark:bg-white/95 dark:text-slate-900"
                : "text-slate-600 hover:bg-white/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-100",
            )}
            onClick={() => onChange(key)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Toggle with confirmation — grid Active column.
 * @param {(nextActive: boolean) => Promise<void>} onConfirm - perform API update; throw or toast on failure
 */
export function LabStatusSwitchWithConfirm({ checked, disabled, busy, rowLabel, onConfirm }) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(null)
  const [confirming, setConfirming] = useState(false)

  const locked = disabled || busy || confirming

  return (
    <>
      <div className="flex w-full items-center justify-center py-1" title={rowLabel}>
        <div className="relative inline-flex shrink-0">
          <Switch
            checked={checked}
            disabled={locked}
            onCheckedChange={(next) => {
              if (locked) return
              if (next === checked) return
              setPending(next)
              setOpen(true)
            }}
            aria-label={
              busy || confirming ? "Updating status" : checked ? "Active — tap to deactivate" : "Inactive — tap to activate"
            }
            className={cn("shrink-0", (busy || confirming) && "opacity-40")}
          />
          {busy || confirming ? (
            <span
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              aria-hidden
            >
              <Loader2 className="h-4 w-4 animate-spin text-slate-600 dark:text-slate-300" />
            </span>
          ) : null}
        </div>
      </div>
      <AlertDialog
        open={open}
        onOpenChange={(o) => {
          if (!o) {
            setOpen(false)
            setPending(null)
          }
        }}
      >
        <AlertDialogContent className="gap-0 overflow-hidden rounded-2xl border-slate-200/90 p-0 shadow-2xl sm:max-w-md">
          <AlertDialogHeader className="flex flex-row items-start gap-3 space-y-0 rounded-t-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-4 text-left text-white">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
              <RefreshCw className="h-5 w-5 text-white" aria-hidden />
            </div>
            <div className="min-w-0 pt-0.5">
              <AlertDialogTitle className="border-0 p-0 text-lg font-semibold tracking-tight text-white">
                Change status?
              </AlertDialogTitle>
            </div>
          </AlertDialogHeader>
          <div className="border-b border-slate-100 bg-white px-6 py-5 dark:border-slate-800 dark:bg-slate-950">
            <AlertDialogDescription className="text-left text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Are you sure you want to set{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">&quot;{rowLabel}&quot;</span> to{" "}
              <strong className="text-slate-900 dark:text-slate-50">
                {pending === null ? "…" : pending ? "Active" : "Inactive"}
              </strong>
              ? This updates the record immediately.
            </AlertDialogDescription>
          </div>
          <AlertDialogFooter className="gap-3 border-t border-slate-100 bg-slate-50/95 px-6 py-4 sm:justify-end dark:border-slate-800 dark:bg-slate-900/80">
            <AlertDialogCancel
              disabled={confirming}
              className="h-11 rounded-xl border-2 border-slate-300 bg-white font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={confirming || pending === null}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-violet-600 px-6 font-semibold text-white hover:bg-emerald-700"
              onClick={async () => {
                if (pending === null) return
                setConfirming(true)
                try {
                  await onConfirm(pending)
                  setOpen(false)
                  setPending(null)
                } finally {
                  setConfirming(false)
                }
              }}
            >
              {confirming ? (
                <>
                  <span>Confirm</span>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                </>
              ) : (
                <>
                  <span>Confirm</span>
                  <Check className="h-4 w-4 shrink-0" aria-hidden />
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
