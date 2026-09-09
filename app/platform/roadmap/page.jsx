"use client"

import { useCallback, useEffect, useState } from "react"
import PlatformShell from "@/components/platform/PlatformShell"
import { useStudySiteContext } from "@/hooks/useStudySiteContext"
import platformService from "@/lib/services/platform.service"
import { ROADMAP_MODULES } from "@/lib/platform/platformUi"
import { Loader2 } from "lucide-react"

export default function PlatformRoadmapPage() {
  const { studyId } = useStudySiteContext()
  const [loading, setLoading] = useState(false)
  const [enabled, setEnabled] = useState({})

  const load = useCallback(async () => {
    if (!studyId) return
    setLoading(true)
    const res = await platformService.getRoadmap(studyId)
    if (res.isSuccess && res.data?.modules) {
      const map = {}
      for (const m of res.data.modules) {
        map[m.code] = m.isEnabledForStudy
      }
      setEnabled(map)
    }
    setLoading(false)
  }, [studyId])

  useEffect(() => {
    load()
  }, [load])

  return (
    <PlatformShell
      title="Enterprise roadmap"
      description="Enterprise module rollout status for this study. Enable modules under Module registry."
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-3">
          {ROADMAP_MODULES.map((m) => (
            <div
              key={m.code}
              className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900">{m.name}</span>
                  <span className="rounded bg-slate-200 px-2 py-0.5 text-xs text-slate-700">{m.phase}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{m.note}</p>
              </div>
              <span
                className={`text-xs font-medium ${
                  enabled[m.code] ? "text-emerald-700" : "text-slate-500"
                }`}
              >
                {enabled[m.code] ? "Enabled for study" : studyId ? "Not enabled" : "Select study"}
              </span>
            </div>
          ))}
        </div>
      )}
    </PlatformShell>
  )
}
