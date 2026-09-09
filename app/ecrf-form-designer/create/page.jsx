"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import DashboardLayout from "@/components/dashboard-layout"
import { APP_VIEWPORT_WORKSPACE_CLASS } from "@/lib/ui/appShellClasses"

const CRFDesigner = dynamic(() => import("@/components/crf-designer/CRFDesigner"), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-full min-h-0 bg-slate-50"
      role="status"
      aria-busy="true"
      aria-label="Loading form designer"
    >
      <div className="w-48 flex-shrink-0 border-r border-slate-200 bg-white p-3 space-y-2">
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="h-8 rounded-md bg-slate-100 animate-pulse" />
        ))}
      </div>
      <div className="flex-1 flex flex-col gap-3 p-4">
        <div className="h-24 rounded-xl border border-slate-200 bg-white animate-pulse" />
        <div className="flex-1 min-h-[280px] rounded-xl border border-slate-200 bg-white animate-pulse" />
      </div>
      <div className="w-64 flex-shrink-0 border-l border-slate-200 bg-white p-4">
        <div className="h-full min-h-[200px] rounded-xl bg-slate-100 animate-pulse" />
      </div>
    </div>
  ),
})

export default function CRFCreatePage() {
  const [currentCRF, setCurrentCRF] = useState(null)

  const handleBack = () => {
    setCurrentCRF(null)
  }

  const handleSaveComplete = () => {
    setCurrentCRF(null)
  }

  return (
    <DashboardLayout>
      <div className={APP_VIEWPORT_WORKSPACE_CLASS}>
        <CRFDesigner
          initialCRF={currentCRF}
          onSave={handleSaveComplete}
          onCancel={handleBack}
        />
      </div>
    </DashboardLayout>
  )
}
