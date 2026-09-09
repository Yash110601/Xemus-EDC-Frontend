"use client"

import { Skeleton } from "@/components/ui/skeleton"

export default function StudyManageSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Loading studies">
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <Skeleton className="h-12 flex-1 rounded-lg bg-slate-200/80" />
          <Skeleton className="h-12 w-full md:w-40 rounded-lg bg-slate-200/75" />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[1400px]">
            <div className="grid grid-cols-16 gap-3 border-b-2 border-slate-200 bg-slate-50 px-4 py-4">
              {Array.from({ length: 16 }).map((_, i) => (
                <Skeleton key={`h-${i}`} className="h-3.5 bg-slate-200/85" />
              ))}
            </div>
            {Array.from({ length: 7 }).map((_, rowIdx) => (
              <div key={`r-${rowIdx}`} className="grid grid-cols-16 items-center gap-3 border-b border-slate-100 px-4 py-4">
                <div className="col-span-2 flex items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded-full bg-slate-200/85" />
                  <Skeleton className="h-3.5 w-24 bg-slate-200/80" />
                </div>
                <Skeleton className="h-3.5 bg-slate-200/80" />
                <Skeleton className="h-3.5 bg-slate-200/80" />
                <Skeleton className="h-3.5 bg-slate-200/80" />
                <Skeleton className="h-3.5 bg-slate-200/80" />
                <Skeleton className="h-6 w-16 rounded-full bg-slate-200/75" />
                <Skeleton className="h-6 w-20 rounded-full bg-slate-200/75" />
                <Skeleton className="h-3.5 bg-slate-200/80" />
                <Skeleton className="h-3.5 bg-slate-200/80" />
                <Skeleton className="h-3.5 bg-slate-200/80" />
                <Skeleton className="h-3.5 bg-slate-200/80" />
                <Skeleton className="h-3.5 bg-slate-200/80" />
                <Skeleton className="h-7 w-7 rounded-md bg-slate-200/75" />
                <Skeleton className="h-7 w-7 rounded-md bg-slate-200/75" />
                <Skeleton className="h-7 w-16 rounded-full bg-slate-200/75" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-7 w-10 rounded-lg bg-slate-200/75" />
                  <Skeleton className="h-7 w-10 rounded-lg bg-slate-200/75" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
