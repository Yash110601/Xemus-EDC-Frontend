"use client"

import { Skeleton } from "@/components/ui/skeleton"

export default function MacSkeletonList({
  rows = 5,
  variant = "generic",
  className = "",
  label = "Loading",
}) {
  const wrapperClass =
    variant === "patient"
      ? "space-y-2.5"
      : variant === "visit"
        ? "space-y-3"
        : "space-y-3"

  return (
    <div
      className={`${wrapperClass} ${className}`.trim()}
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-200/80 bg-white/88 p-3.5 shadow-[0_10px_28px_-22px_rgba(15,23,42,0.35)] backdrop-blur-md"
        >
          {variant === "patient" ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-20 rounded-md bg-slate-200/90" />
                <Skeleton className="h-4 w-4 rounded-sm bg-slate-200/75" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-2 w-2 rounded-full bg-slate-200/90" />
                <Skeleton className="h-3 w-10 rounded-md bg-slate-200/80" />
              </div>
              <Skeleton className="h-5 w-24 rounded-full bg-slate-200/80" />
            </div>
          ) : variant === "visit" ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-xl bg-slate-200/90" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-28 rounded-md bg-slate-200/90" />
                    <Skeleton className="h-3 w-16 rounded-md bg-slate-200/75" />
                  </div>
                </div>
                <Skeleton className="h-4 w-4 rounded-sm bg-slate-200/75" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-14 rounded-md bg-slate-200/75" />
                  <Skeleton className="h-3 w-10 rounded-md bg-slate-200/80" />
                </div>
                <Skeleton className="h-2 w-full rounded-full bg-slate-200/85" />
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <Skeleton className="h-4 w-44 rounded-md bg-slate-200/90" />
              <Skeleton className="h-3 w-32 rounded-md bg-slate-200/75" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

