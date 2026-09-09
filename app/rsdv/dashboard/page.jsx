"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import RsdvShell from "@/components/rsdv/RsdvShell"
import SearchableSelect from "@/components/ui/searchable-select"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { authService, rsdvReviewService, studyService } from "@/lib/services"
import { resolveRouteMenuPermissions } from "@/lib/utils/menuRoutePermissions"
import { filterStudiesWithRemoteSdvEnabled } from "@/lib/utils/studySettingsRead"
import { RSDV_CARD, RSDV_CARD_PAD, RSDV_EMPTY } from "@/lib/rsdv/rsdvUi"
import { RsdvStatusDonutChart, RsdvStudyStatusBarChart } from "@/components/rsdv/RsdvDashboardCharts"
import { cn } from "@/lib/utils"
import { ArrowRight, CheckCircle2, Clock3, FileSearch, Loader2, RefreshCw } from "lucide-react"

const getStudyId = (study) => study?.studyId ?? study?.StudyId ?? study?.id ?? study?.Id ?? null

const getStudyLabel = (study) => {
  const protocol = study?.studyProtocolNumber ?? study?.StudyProtocolNumber ?? study?.protocolNumber ?? study?.name ?? ""
  const title = study?.studyTitle ?? study?.StudyTitle ?? ""
  if (protocol && title) return `${protocol} — ${title}`
  return protocol || title || `Study ${getStudyId(study) ?? ""}`
}

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const routePerm = useMemo(
    () => resolveRouteMenuPermissions(authService.getMenu?.(), "/rsdv/dashboard"),
    [],
  )

  const [studies, setStudies] = useState([])
  const [loadingStudies, setLoadingStudies] = useState(true)
  const [loadingStats, setLoadingStats] = useState(false)
  const [studyStats, setStudyStats] = useState([])
  const [selectedStudyId, setSelectedStudyId] = useState(() => searchParams.get("studyId") ?? "")

  const loadStudies = useCallback(async () => {
    setLoadingStudies(true)
    try {
      const res = await studyService.getStudiesForDropdown()
      if (!res?.isSuccess) {
        setStudies([])
        return
      }
      const allStudies = Array.isArray(res.data) ? res.data : []
      setStudies(await filterStudiesWithRemoteSdvEnabled(allStudies))
    } finally {
      setLoadingStudies(false)
    }
  }, [])

  const loadStats = useCallback(async (enabledStudies) => {
    if (!enabledStudies.length) {
      setStudyStats([])
      return
    }
    setLoadingStats(true)
    try {
      const targets = selectedStudyId
        ? enabledStudies.filter((s) => String(getStudyId(s)) === String(selectedStudyId))
        : enabledStudies

      const results = await Promise.all(
        targets.map(async (study) => {
          const sid = getStudyId(study)
          const res = await rsdvReviewService.getSummary(sid)
          const summary = res?.data ?? {}
          return {
            studyId: String(sid),
            label: getStudyLabel(study),
            pending: res?.pendingCount ?? summary.pendingCount ?? 0,
            inProgress: res?.inProgressCount ?? summary.inProgressCount ?? 0,
            completed: res?.completedCount ?? summary.completedCount ?? 0,
            enabled: res?.isRemoteSdvEnabled !== false,
          }
        }),
      )
      setStudyStats(results)
    } finally {
      setLoadingStats(false)
    }
  }, [selectedStudyId])

  useEffect(() => {
    void loadStudies()
  }, [loadStudies])

  useEffect(() => {
    if (!loadingStudies) void loadStats(studies)
  }, [loadingStudies, studies, loadStats])

  const totals = useMemo(
    () =>
      studyStats.reduce(
        (acc, row) => ({
          pending: acc.pending + row.pending,
          inProgress: acc.inProgress + row.inProgress,
          completed: acc.completed + row.completed,
        }),
        { pending: 0, inProgress: 0, completed: 0 },
      ),
    [studyStats],
  )

  const studyOptions = useMemo(
    () => [
      { value: "", label: "All RSDV-enabled studies" },
      ...studies.map((study) => ({
        value: String(getStudyId(study) ?? ""),
        label: getStudyLabel(study),
      })),
    ],
    [studies],
  )

  const handleStudyChange = (value) => {
    const next = String(value ?? "")
    setSelectedStudyId(next)
    const params = new URLSearchParams(searchParams.toString())
    if (next) params.set("studyId", next)
    else params.delete("studyId")
    router.replace(`/rsdv/dashboard?${params.toString()}`, { scroll: false })
  }

  if (!routePerm.canView) {
    return (
      <RsdvShell title="Dashboard" description="Overview of remote SDV review workload.">
        <p className="text-sm text-slate-600">You do not have permission to view the Remote SDV dashboard.</p>
      </RsdvShell>
    )
  }

  return (
    <RsdvShell
      title="Dashboard"
      description="Pending, in-progress, and completed remote SDV reviews across RSDV-enabled studies."
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchableSelect
          value={selectedStudyId}
          onChange={handleStudyChange}
          options={studyOptions}
          placeholder={loadingStudies ? "Loading studies…" : "Filter by study"}
          disabled={loadingStudies || studies.length === 0}
          className="w-full sm:max-w-md"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl"
          disabled={loadingStudies || loadingStats}
          onClick={() => void loadStats(studies)}
        >
          <RefreshCw className={cn("mr-1.5 h-4 w-4", loadingStats && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {!loadingStudies && studies.length === 0 ? (
        <div className={RSDV_CARD_PAD}>
          <div className={RSDV_EMPTY}>
            <FileSearch className="h-10 w-10 text-slate-300" />
            <p className="font-medium text-slate-700">No RSDV-enabled studies</p>
            <p className="text-xs text-slate-500">Enable Remote SDV in Study Settings for at least one study.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <Link
              href={`/rsdv/review${selectedStudyId ? `?studyId=${encodeURIComponent(selectedStudyId)}&status=pending` : "?status=pending"}`}
              className={cn(RSDV_CARD_PAD, "flex items-center gap-3 transition hover:border-amber-200 hover:shadow-md")}
            >
              <div className="rounded-xl bg-amber-50 p-2.5 text-amber-700">
                <Clock3 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{loadingStats ? "—" : totals.pending}</p>
                <p className="text-xs text-slate-500">Pending</p>
              </div>
            </Link>
            <Link
              href={`/rsdv/review${selectedStudyId ? `?studyId=${encodeURIComponent(selectedStudyId)}&status=in_progress` : "?status=in_progress"}`}
              className={cn(RSDV_CARD_PAD, "flex items-center gap-3 transition hover:border-sky-200 hover:shadow-md")}
            >
              <div className="rounded-xl bg-sky-50 p-2.5 text-sky-700">
                <FileSearch className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{loadingStats ? "—" : totals.inProgress}</p>
                <p className="text-xs text-slate-500">In progress</p>
              </div>
            </Link>
            <Link
              href={`/rsdv/review${selectedStudyId ? `?studyId=${encodeURIComponent(selectedStudyId)}&status=completed` : "?status=completed"}`}
              className={cn(RSDV_CARD_PAD, "flex items-center gap-3 transition hover:border-emerald-200 hover:shadow-md")}
            >
              <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{loadingStats ? "—" : totals.completed}</p>
                <p className="text-xs text-slate-500">Completed</p>
              </div>
            </Link>
          </div>

          <div className="mb-5 grid gap-4 lg:grid-cols-2">
            <div className={RSDV_CARD}>
              <div className="border-b border-slate-100 px-5 py-3">
                <p className="text-sm font-semibold text-slate-900">Status overview</p>
                <p className="mt-0.5 text-xs text-slate-500">Share of pending, in progress, and completed reviews</p>
              </div>
              <div className="px-4 py-4 sm:px-5 sm:py-5">
                <RsdvStatusDonutChart totals={totals} loading={loadingStats} />
              </div>
            </div>
            <div className={RSDV_CARD}>
              <div className="border-b border-slate-100 px-5 py-3">
                <p className="text-sm font-semibold text-slate-900">Reviews by study</p>
                <p className="mt-0.5 text-xs text-slate-500">Stack or unstack bars to compare status mix</p>
              </div>
              <div className="px-4 py-4 sm:px-5 sm:py-5">
                <RsdvStudyStatusBarChart studyStats={studyStats} loading={loadingStats} />
              </div>
            </div>
          </div>

          <div className={RSDV_CARD}>
            <div className="border-b border-slate-100 px-5 py-3">
              <p className="text-sm font-semibold text-slate-900">By study</p>
            </div>
            {loadingStats ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
              </div>
            ) : studyStats.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">No study statistics available.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {studyStats.map((row) => (
                  <li key={row.studyId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{row.label}</p>
                      <p className="text-xs text-slate-500">
                        {row.pending} pending · {row.inProgress} in progress · {row.completed} completed
                      </p>
                    </div>
                    <Button asChild size="sm" variant="outline" className="rounded-lg">
                      <Link href={`/rsdv/review?studyId=${encodeURIComponent(row.studyId)}`}>
                        Open review
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </RsdvShell>
  )
}

function DashboardFallback() {
  return (
    <RsdvShell title="Dashboard" description="Overview of remote SDV review workload.">
      <Skeleton className="h-10 w-full max-w-md rounded-xl" />
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </RsdvShell>
  )
}

export default function RsdvDashboardPage() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <DashboardContent />
    </Suspense>
  )
}
