"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import PlatformShell from "@/components/platform/PlatformShell"
import {
  PLATFORM_LINK,
  PLATFORM_PHASE_BANNER_SOFT,
  PLATFORM_PHASE_BANNER_LABEL,
} from "@/lib/platform/platformUi"
import { useStudySiteContext } from "@/hooks/useStudySiteContext"
import safetyService from "@/lib/services/safety.service"
import { Loader2 } from "lucide-react"

function formatUtc(value) {
  if (!value) return "—"
  return new Date(value).toISOString().replace("T", " ").slice(0, 16)
}

export default function SafetyRegulatoryPage() {
  const { studyId, siteId } = useStudySiteContext()
  const [loading, setLoading] = useState(false)
  const [overdue, setOverdue] = useState([])
  const [guidance, setGuidance] = useState([])

  const load = useCallback(async () => {
    if (!studyId) return
    setLoading(true)
    const [overdueRes, guidanceRes] = await Promise.all([
      safetyService.getOverdueReports(studyId, siteId),
      safetyService.getPhaseGuidance(studyId),
    ])
    if (overdueRes.isSuccess) setOverdue(Array.isArray(overdueRes.data) ? overdueRes.data : [])
    if (guidanceRes.isSuccess) setGuidance(Array.isArray(guidanceRes.data) ? guidanceRes.data : [])
    setLoading(false)
  }, [studyId, siteId])

  useEffect(() => {
    load()
  }, [load])

  const phaseLabel = guidance[0]?.studyPhaseLabel

  return (
    <PlatformShell
      title="Regulatory inbox"
      description="Overdue SAE reports past the 24-hour regulatory window — Phase I–IV reporting expectations."
    >
      {!studyId ? (
        <p className="text-sm text-slate-600">Select a study from the workspace header.</p>
      ) : loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-6">
          {phaseLabel ? (
            <p className="text-xs text-slate-500">Study phase context: {phaseLabel}</p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div
              className={`rounded-lg border p-4 ${overdue.length > 0 ? "border-red-300 bg-red-50" : "border-slate-200 bg-slate-50"}`}
            >
              <p className="text-xs text-slate-500">Overdue SAE reports</p>
              <p className="text-2xl font-semibold">{overdue.length}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Regulatory window</p>
              <p className="text-2xl font-semibold">
                {guidance[0]?.regulatoryWindowHours ?? 24}h
              </p>
            </div>
          </div>

          {guidance.length > 0 ? (
            <div className={PLATFORM_PHASE_BANNER_SOFT}>
              <p className={PLATFORM_PHASE_BANNER_LABEL}>Reporting expectations</p>
              <ul className="space-y-1 text-sm text-slate-700">
                {guidance.map((g) => (
                  <li key={g.code}>
                    <strong>{g.title}</strong>: {g.description}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {overdue.length === 0 ? (
            <p className="text-sm text-slate-500">No overdue SAE reports. All submitted cases are within regulatory timelines.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Subject</th>
                    <th className="px-3 py-2">Event</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Due (UTC)</th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {overdue.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">{r.screeningNo || `#${r.patientEnrolmentId}`}</td>
                      <td className="px-3 py-2">
                        <Link href={`/platform/safety/reports/${r.id}`} className={PLATFORM_LINK}>
                          {r.eventTerm || "Untitled"}
                        </Link>
                        <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          Overdue
                        </span>
                      </td>
                      <td className="px-3 py-2 capitalize">{r.status}</td>
                      <td className="px-3 py-2 font-medium text-red-600">{formatUtc(r.regulatoryDueAtUtc)}</td>
                      <td className="px-3 py-2">
                        <Link href={`/platform/safety/reports/${r.id}`} className={PLATFORM_LINK}>
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </PlatformShell>
  )
}
