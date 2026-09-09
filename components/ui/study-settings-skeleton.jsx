"use client"

import { Skeleton } from "@/components/ui/skeleton"

function ToggleRowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50/90 px-4 py-3 ring-1 ring-slate-200/60">
      <div className="flex min-w-0 flex-1 gap-3">
        <Skeleton className="h-9 w-9 shrink-0 rounded-xl bg-slate-200/70" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3.5 w-32 rounded-md bg-slate-200/70" />
          <Skeleton className="h-3 w-full max-w-[140px] rounded-md bg-slate-200/60" />
        </div>
      </div>
      <Skeleton className="h-7 w-[52px] shrink-0 rounded-full bg-slate-200/70" />
    </div>
  )
}

function RoleCardSkeleton({ wide = false }) {
  return (
    <div className={`rounded-2xl bg-slate-50/90 p-4 ring-1 ring-slate-200/60 ${wide ? "lg:col-span-2" : ""}`.trim()}>
      <Skeleton className="mb-2.5 h-3.5 w-36 rounded-md bg-slate-200/70" />
      <Skeleton className="h-11 w-full rounded-xl bg-slate-200/65" />
    </div>
  )
}

/**
 * Mirrors Study Settings page layout (header, study picker, toggles, role dropdowns, save).
 */
export default function StudySettingsSkeleton({
  showHeader = true,
  showStudyPicker = true,
  showForm = true,
  toggleRows = 5,
  roleCards = 2,
  className = "",
}) {
  return (
    <div
      className={`space-y-6 ${className}`.trim()}
      role="status"
      aria-busy="true"
      aria-label="Loading study settings"
    >
      {showHeader && showStudyPicker && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-1 items-start gap-4">
              <Skeleton className="h-12 w-12 shrink-0 rounded-xl bg-slate-200/85" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-48 rounded-md bg-slate-200/90" />
                <Skeleton className="h-4 w-full max-w-lg rounded-md bg-slate-200/75" />
              </div>
            </div>
            <div className="w-full lg:max-w-md space-y-2">
              <Skeleton className="h-4 w-16 rounded-md bg-slate-200/85" />
              <Skeleton className="h-12 w-full rounded-xl bg-slate-200/80" />
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="space-y-5">
          <div>
            <Skeleton className="mb-3 h-3 w-28 rounded-md bg-slate-200/65" />
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {Array.from({ length: toggleRows }).map((_, i) => (
                <ToggleRowSkeleton key={`toggle-skel-${i}`} />
              ))}
            </div>
          </div>
          <div>
            <Skeleton className="mb-3 h-3 w-24 rounded-md bg-slate-200/65" />
            <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
              <RoleCardSkeleton key="role-skel-query" />
              <RoleCardSkeleton key="role-skel-doc-multi" wide />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
