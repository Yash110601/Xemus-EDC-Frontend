"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { DASHBOARD_SHELL_CLASS, DASHBOARD_METRIC_GRID_CLASS, DASHBOARD_BENTO_CLASS } from "@/lib/ui/dashboardUi"
import { cn } from "@/lib/utils"

function GlowFrameSkeleton({ children, className }) {
  return (
    <div className={cn("rounded-2xl border border-slate-200/75 bg-white/95 p-[1px]", className)}>
      <div className="h-full rounded-[calc(1rem-1px)] bg-white/95">{children}</div>
    </div>
  )
}

export default function DashboardPageSkeleton() {
  return (
    <div className={DASHBOARD_SHELL_CLASS} role="status" aria-busy="true" aria-label="Loading dashboard">
      <header className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-28 bg-slate-200/80" />
            <Skeleton className="h-7 w-56 bg-slate-200/80" />
            <Skeleton className="h-4 w-40 bg-slate-200/70" />
          </div>
          <Skeleton className="h-5 w-28 bg-slate-200/80" />
        </div>
        <div className={DASHBOARD_METRIC_GRID_CLASS}>
          {Array.from({ length: 8 }).map((_, index) => (
            <GlowFrameSkeleton key={index} className="px-4 py-3.5">
              <Skeleton className="h-3 w-16 bg-slate-200/70" />
              <Skeleton className="mt-2 h-7 w-10 bg-slate-200/80" />
            </GlowFrameSkeleton>
          ))}
        </div>
      </header>

      <div className={DASHBOARD_BENTO_CLASS}>
        {Array.from({ length: 2 }).map((_, index) => (
          <GlowFrameSkeleton key={`chart-a-${index}`} className="lg:col-span-6 overflow-hidden">
            <div className="border-b border-slate-100/90 bg-slate-50/40 px-5 py-3.5">
              <Skeleton className="h-5 w-36 bg-slate-200/80" />
            </div>
            <div className="p-5 sm:p-6">
              <Skeleton className="h-56 w-full rounded-lg bg-slate-200/75" />
            </div>
          </GlowFrameSkeleton>
        ))}
      </div>

      <div className={DASHBOARD_BENTO_CLASS}>
        {Array.from({ length: 3 }).map((_, index) => (
          <GlowFrameSkeleton key={`chart-b-${index}`} className="lg:col-span-4 overflow-hidden">
            <div className="border-b border-slate-100/90 bg-slate-50/40 px-5 py-3.5">
              <Skeleton className="h-5 w-32 bg-slate-200/80" />
            </div>
            <div className="p-5 sm:p-6">
              <Skeleton className="h-52 w-full rounded-lg bg-slate-200/75" />
            </div>
          </GlowFrameSkeleton>
        ))}
      </div>
    </div>
  )
}
