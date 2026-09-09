"use client"

import DashboardLayout from "@/components/dashboard-layout"
import { RSDV_PAGE_SHELL } from "@/lib/rsdv/rsdvUi"
import { FileSearch } from "lucide-react"

export default function RsdvShell({ title, description, children }) {
  return (
    <DashboardLayout>
      <div className={RSDV_PAGE_SHELL}>
        <header className="mb-5 sm:mb-6">
          <div className="flex flex-wrap items-start gap-3">
            <div className="mt-0.5 shrink-0 rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
              <FileSearch className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700/80">
                Remote SDV
              </p>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
              {description ? (
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">{description}</p>
              ) : null}
            </div>
          </div>
        </header>
        {children}
      </div>
    </DashboardLayout>
  )
}
