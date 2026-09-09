"use client"

import DashboardLayout from "@/components/dashboard-layout"
import { VIEWPORT_PAGE_SHELL_WITH_EMERALD_BG_CLASS } from "@/lib/ui/responsivePageUi"

export default function PatientEnrolmentPageShell({ title, description, children }) {
  return (
    <DashboardLayout>
      <div className={VIEWPORT_PAGE_SHELL_WITH_EMERALD_BG_CLASS}>
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-2xl border border-emerald-100/80 bg-white/90 px-5 py-5 shadow-sm shadow-emerald-900/5 sm:px-6">
            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-emerald-500 to-teal-500" aria-hidden />
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
            {description ? <p className="mt-1 max-w-2xl text-sm text-slate-600">{description}</p> : null}
          </div>
          {children}
        </div>
      </div>
    </DashboardLayout>
  )
}
