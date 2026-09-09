"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import DashboardLayout from "@/components/dashboard-layout"
import SectionSkeleton from "@/components/ui/section-skeleton"
import { QueryManagementPieChart } from "@/components/dashboard-charts"
import { crfQueryManagementService } from "@/lib/services"
import { useReportExportAccess } from "@/app/reports/_hooks/useReportExportAccess"
import {
  REPORT_CARD_CLASS,
  REPORT_PAGE_SHELL_CLASS,
  REPORT_PRIMARY_BTN_CLASS,
} from "@/lib/reports/studySitePatientReportUi"
import { ClipboardList, ExternalLink, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

function QueryMetricChip({ label, value, tone }) {
  const toneClass =
    tone === "open"
      ? "border-amber-200/80 bg-amber-50/90 text-amber-900"
      : tone === "inProcess"
        ? "border-sky-200/80 bg-sky-50/90 text-sky-900"
        : tone === "closed"
          ? "border-emerald-200/80 bg-emerald-50/90 text-emerald-900"
          : "border-slate-200/80 bg-white/90 text-slate-900"

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_10px_28px_-18px_rgba(15,23,42,0.18)] backdrop-blur-sm",
        toneClass,
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

export default function QueryDashboardPage() {
  const { canView, studyId, siteId, ready } = useReportExportAccess("QUERY_DASHBOARD")

  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState("")

  const loadSummary = useCallback(async () => {
    if (!ready || !studyId) return
    if (!canView) {
      setSummary(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await crfQueryManagementService.getDashboardSummary(studyId, siteId || null)
      if (res?.isSuccess && res.data) {
        setSummary(res.data)
      } else {
        setSummary(null)
        setError(res?.message || "Unable to load query dashboard.")
      }
    } catch {
      setSummary(null)
      setError("Unable to load query dashboard.")
    } finally {
      setLoading(false)
    }
  }, [ready, studyId, siteId, canView])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary])

  useEffect(() => {
    const onContextChange = () => void loadSummary()
    window.addEventListener("studySiteChanged", onContextChange)
    window.addEventListener("studySelected", onContextChange)
    return () => {
      window.removeEventListener("studySiteChanged", onContextChange)
      window.removeEventListener("studySelected", onContextChange)
    }
  }, [loadSummary])

  const queryStatusCounts = useMemo(() => {
    const src = summary ?? {}
    return {
      open: Number(src.open ?? 0),
      inProcess: Number(src.inProcess ?? src.InProcess ?? 0),
      closed: Number(src.closed ?? 0),
      totalQueries: Number(src.totalQueries ?? 0),
    }
  }, [summary])

  const systemQueryStatusCounts = useMemo(() => {
    if (!summary) return null
    const manualOpen = Number(summary.manualOpen ?? 0)
    const systemOpen = Number(summary.systemGeneratedOpen ?? summary.systemGeneratedOpen ?? 0)
    if (!manualOpen && !systemOpen) return null
    return { manualOpen, systemGeneratedOpen: systemOpen }
  }, [summary])

  const reportHref = useMemo(() => {
    const params = new URLSearchParams()
    if (studyId) params.set("studyId", String(studyId))
    if (siteId) params.set("siteId", String(siteId))
    const qs = params.toString()
    return qs ? `/reports/query-management-report?${qs}` : "/reports/query-management-report"
  }, [studyId, siteId])

  return (
    <DashboardLayout>
      <div className={REPORT_PAGE_SHELL_CLASS}>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-1 text-[11px] font-semibold text-emerald-800">
              <ClipboardList className="h-3.5 w-3.5" />
              Query Dashboard
            </div>
            <h1 className="text-xl font-bold text-slate-900">Study query overview</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Query counts from GetDashboardSummary, scoped to workspace study
              {siteId ? ` and site ${siteId}` : " (all assigned sites)"}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadSummary()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              Refresh
            </button>
            <Link href={reportHref} className={REPORT_PRIMARY_BTN_CLASS}>
              <ExternalLink className="h-3.5 w-3.5" />
              Full query report
            </Link>
          </div>
        </div>

        {!studyId ? (
          <div className={cn(REPORT_CARD_CLASS, "p-6 text-sm text-slate-600")}>
            Select a study from the workspace header to load study-scoped query counts.
          </div>
        ) : !canView ? (
          <div className={cn(REPORT_CARD_CLASS, "p-6 text-sm text-slate-600")}>
            You do not have permission to view the query dashboard (report.view).
          </div>
        ) : loading && !summary ? (
          <SectionSkeleton title="Loading query dashboard" rows={4} />
        ) : error ? (
          <div className={cn(REPORT_CARD_CLASS, "border-red-200/80 bg-red-50/60 p-6 text-sm text-red-800")}>
            {error}
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <QueryMetricChip label="Total" value={queryStatusCounts.totalQueries} tone="total" />
              <QueryMetricChip label="Open" value={queryStatusCounts.open} tone="open" />
              <QueryMetricChip label="In process" value={queryStatusCounts.inProcess} tone="inProcess" />
              <QueryMetricChip label="Closed" value={queryStatusCounts.closed} tone="closed" />
            </div>

            {(summary?.manualOpen != null || summary?.systemGeneratedOpen != null) && (
              <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-2">
                <QueryMetricChip label="Manual open" value={Number(summary?.manualOpen ?? 0)} tone="open" />
                <QueryMetricChip
                  label="System open"
                  value={Number(summary?.systemGeneratedOpen ?? 0)}
                  tone="inProcess"
                />
              </div>
            )}

            <div className={cn(REPORT_CARD_CLASS, "p-4 sm:p-5")}>
              <h2 className="mb-3 text-sm font-bold text-slate-900">Query status breakdown</h2>
              <QueryManagementPieChart
                counts={queryStatusCounts}
                systemCounts={systemQueryStatusCounts}
              />
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
