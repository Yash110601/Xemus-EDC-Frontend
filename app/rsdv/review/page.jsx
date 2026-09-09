"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import RsdvPatientContextMeta from "@/components/rsdv/RsdvPatientContextMeta"
import RsdvReviewStatusBadge from "@/components/rsdv/RsdvReviewStatusBadge"
import SplitReviewWorkspace from "@/components/rsdv/SplitReviewWorkspace"
import {
  formatRsdvUploadedAt,
  getRsdvQueueEmptyMessage,
  normalizeRsdvStatusFilter,
  RSDV_STATUS_TABS,
} from "@/lib/rsdv/rsdvDisplay"
import SearchableSelect from "@/components/ui/searchable-select"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { authService, studyService, rsdvReviewService } from "@/lib/services"
import {
  resolveRouteMenuPermissions,
  resolveSubFeatureMenuPermissions,
} from "@/lib/utils/menuRoutePermissions"
import useStudyPermissionGates from "@/hooks/useStudyPermissionGates"
import {
  fetchStudySettingsByStudyId,
  filterStudiesWithRemoteSdvEnabled,
  pickIsRemoteSdvEnabled,
  pickQueryRaiseRoleGuidsFromSettings,
  pickRsdvRoleGuidsFromSettings,
  pickSdvRoleGuidsFromSettings,
} from "@/lib/utils/studySettingsRead"
import { cn } from "@/lib/utils"
import { APP_VIEWPORT_WORKSPACE_CLASS } from "@/lib/ui/appShellClasses"
import {
  ArrowLeft,
  FileSearch,
  FileText,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
} from "lucide-react"
import {
  RSDV_BTN_OUTLINE,
  RSDV_BTN_PRIMARY,
  RSDV_BTN_SECONDARY,
  RSDV_COMPARE_TOOLBAR,
} from "@/lib/rsdv/rsdvUi"

const PANEL =
  "flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] backdrop-blur-md"

const getStudyId = (study) => study?.studyId ?? study?.StudyId ?? study?.id ?? study?.Id ?? null

const getStudyLabel = (study) => {
  const protocol = study?.studyProtocolNumber ?? study?.StudyProtocolNumber ?? study?.protocolNumber ?? study?.name ?? ""
  const title = study?.studyTitle ?? study?.StudyTitle ?? ""
  if (protocol && title) return `${protocol} — ${title}`
  return protocol || title || `Study ${getStudyId(study) ?? ""}`
}

function PageSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4" role="status" aria-busy="true" aria-label="Loading remote SDV review">
      <Skeleton className="h-10 w-full max-w-md rounded-xl bg-slate-200/60" />
      <Skeleton className="min-h-[320px] flex-1 rounded-2xl bg-slate-200/40" />
    </div>
  )
}

function RsdvReviewPageContent() {
  const { toast } = useToast()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const routePerm = useMemo(
    () => resolveRouteMenuPermissions(authService.getMenu?.(), pathname),
    [pathname],
  )

  const rsdvReviewMenuPerm = useMemo(
    () => resolveSubFeatureMenuPermissions(authService.getMenu?.(), "RSDV_REVIEW"),
    [pathname],
  )

  const loggedInUserRoleGuid = useMemo(() => {
    const user = authService.getUser?.() || {}
    const raw = user?.roleGuid ?? user?.RoleGuid ?? ""
    const trimmed = String(raw ?? "").trim()
    return trimmed || null
  }, [])

  const [studies, setStudies] = useState([])
  const [studySettingsPayload, setStudySettingsPayload] = useState(null)
  const [loadingStudies, setLoadingStudies] = useState(true)
  const [loadingQueue, setLoadingQueue] = useState(false)
  const [loadingContext, setLoadingContext] = useState(false)
  const [queue, setQueue] = useState([])
  const [queueCounts, setQueueCounts] = useState({
    pending: 0,
    inProgress: 0,
    completed: 0,
    open: 0,
  })
  const [isRemoteSdvEnabled, setIsRemoteSdvEnabled] = useState(null)
  const [statusFilter, setStatusFilter] = useState(() =>
    normalizeRsdvStatusFilter(searchParams.get("status")),
  )
  const [selectedAttachmentId, setSelectedAttachmentId] = useState(() => {
    const fromUrl = searchParams.get("attachmentId")
    return fromUrl ? String(fromUrl) : ""
  })
  const [reviewContext, setReviewContext] = useState(null)
  const [queueDrawerOpen, setQueueDrawerOpen] = useState(false)
  const [selectedStudyId, setSelectedStudyId] = useState(() => {
    const fromUrl = searchParams.get("studyId")
    return fromUrl ? String(fromUrl) : ""
  })
  const [queueSearch, setQueueSearch] = useState("")
  const [queueSiteId, setQueueSiteId] = useState("")
  const [queuePatientEnrolmentId, setQueuePatientEnrolmentId] = useState("")

  const queryRaiseRoleGuids = useMemo(
    () => pickQueryRaiseRoleGuidsFromSettings(studySettingsPayload),
    [studySettingsPayload],
  )
  const rsdvRoleGuids = useMemo(
    () => pickRsdvRoleGuidsFromSettings(studySettingsPayload),
    [studySettingsPayload],
  )
  const sdvRoleGuids = useMemo(
    () => pickSdvRoleGuidsFromSettings(studySettingsPayload),
    [studySettingsPayload],
  )

  const reviewSiteId = useMemo(() => {
    const fromContext = reviewContext?.attachment?.siteId
    if (fromContext != null && fromContext !== "") return fromContext
    const row = queue.find((item) => String(item.attachmentId) === String(selectedAttachmentId))
    return row?.siteId ?? null
  }, [queue, reviewContext?.attachment?.siteId, selectedAttachmentId])

  const { gates } = useStudyPermissionGates(selectedStudyId, reviewSiteId, {
    menuCanView: routePerm.canView || rsdvReviewMenuPerm.canView,
    menuCanEdit:
      routePerm.canEdit ||
      routePerm.canAdd ||
      rsdvReviewMenuPerm.canEdit ||
      rsdvReviewMenuPerm.canAdd,
    userRoleGuid: loggedInUserRoleGuid,
    queryRaiseRoleGuids,
    rsdvRoleGuids,
    sdvRoleGuids,
  })

  const canView = routePerm.canView || rsdvReviewMenuPerm.canView || gates.canRsdvReview
  const canEdit =
    rsdvReviewMenuPerm.canEdit ||
    rsdvReviewMenuPerm.canAdd ||
    routePerm.canEdit ||
    routePerm.canAdd ||
    gates.canRsdvReview
  const canCreateQuery = gates.canCreateQuery || canEdit
  const canCloseQuery = gates.canCloseQuery || canEdit

  const studyOptions = useMemo(
    () =>
      studies.map((study) => {
        const id = getStudyId(study)
        return { value: String(id ?? ""), label: getStudyLabel(study) }
      }),
    [studies],
  )

  const loadQueue = useCallback(async (studyId, status, filters = {}) => {
    const sid = Number.parseInt(String(studyId ?? ""), 10)
    const statusKey = normalizeRsdvStatusFilter(status)
    const search = filters.search ?? queueSearch
    const siteId = filters.siteId ?? queueSiteId
    const patientEnrolmentId = filters.patientEnrolmentId ?? queuePatientEnrolmentId
    if (!Number.isFinite(sid) || sid <= 0) {
      setQueue([])
      setQueueCounts({ pending: 0, inProgress: 0, completed: 0, open: 0 })
      setIsRemoteSdvEnabled(null)
      return
    }
    setLoadingQueue(true)
    try {
      const [settings, res, summaryRes] = await Promise.all([
        fetchStudySettingsByStudyId(sid),
        rsdvReviewService.getQueue(sid, {
          status: statusKey,
          search: search.trim() || undefined,
          siteId: siteId || undefined,
          patientEnrolmentId: patientEnrolmentId || undefined,
        }),
        rsdvReviewService.getSummary(sid),
      ])
      const settingsPayload = settings?.data ?? settings ?? null
      setStudySettingsPayload(settingsPayload)
      const enabledFromSettings = pickIsRemoteSdvEnabled(settingsPayload)
      const enabledFromApi = res?.isRemoteSdvEnabled
      const enabled =
        enabledFromApi === true || enabledFromApi === false ? enabledFromApi : enabledFromSettings
      setIsRemoteSdvEnabled(enabled)
      const rows = enabled ? (Array.isArray(res?.data) ? res.data : []) : []
      setQueue(rows)
      const summary = summaryRes?.data ?? summaryRes ?? {}
      setQueueCounts({
        pending: summaryRes?.pendingCount ?? summary.pendingCount ?? 0,
        inProgress: summaryRes?.inProgressCount ?? summary.inProgressCount ?? 0,
        completed: summaryRes?.completedCount ?? summary.completedCount ?? 0,
        open: summaryRes?.openCount ?? summary.openCount ?? 0,
      })
    } finally {
      setLoadingQueue(false)
    }
  }, [queuePatientEnrolmentId, queueSearch, queueSiteId])

  const loadContext = useCallback(async (attachmentId) => {
    const aid = Number.parseInt(String(attachmentId ?? ""), 10)
    if (!Number.isFinite(aid) || aid <= 0) {
      setReviewContext(null)
      return
    }
    setLoadingContext(true)
    try {
      const res = await rsdvReviewService.getContext(aid)
      if (res?.isSuccess) {
        setReviewContext(res.data)
      } else {
        setReviewContext(null)
        toast({
          title: "Could not load review",
          description: res?.message || "Attachment context unavailable.",
          variant: "destructive",
        })
      }
    } finally {
      setLoadingContext(false)
    }
  }, [toast])

  useEffect(() => {
    let cancelled = false
    const initialStudyId = searchParams.get("studyId") ?? ""

    ;(async () => {
      setLoadingStudies(true)
      try {
        const res = await studyService.getStudiesForDropdown()
        if (cancelled) return
        if (!res?.isSuccess) {
          setStudies([])
          setSelectedStudyId("")
          return
        }
        const allStudies = Array.isArray(res.data) ? res.data : []
        const enabledStudies = await filterStudiesWithRemoteSdvEnabled(allStudies)
        if (cancelled) return

        setStudies(enabledStudies)

        const enabledIds = new Set(enabledStudies.map((s) => String(getStudyId(s))))
        let nextStudyId = ""

        if (initialStudyId && enabledIds.has(String(initialStudyId))) {
          nextStudyId = String(initialStudyId)
        } else if (enabledStudies.length === 1) {
          nextStudyId = String(getStudyId(enabledStudies[0]))
        }

        setSelectedStudyId(nextStudyId)

        if (initialStudyId && !enabledIds.has(String(initialStudyId))) {
          const params = new URLSearchParams(searchParams.toString())
          params.delete("studyId")
          params.delete("attachmentId")
          router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        } else if (nextStudyId && nextStudyId !== initialStudyId) {
          const params = new URLSearchParams(searchParams.toString())
          params.set("studyId", nextStudyId)
          router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }
      } finally {
        if (!cancelled) setLoadingStudies(false)
      }
    })()

    return () => {
      cancelled = true
    }
    // Load RSDV-enabled studies once on mount; study selection is handled locally afterward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const fromUrl = normalizeRsdvStatusFilter(searchParams.get("status"))
    setStatusFilter((current) => (current === fromUrl ? current : fromUrl))
  }, [searchParams])

  useEffect(() => {
    setQueueSearch("")
    setQueueSiteId("")
    setQueuePatientEnrolmentId("")
  }, [selectedStudyId])

  useEffect(() => {
    void loadQueue(selectedStudyId, statusFilter)
  }, [selectedStudyId, statusFilter, loadQueue])

  useEffect(() => {
    void loadContext(selectedAttachmentId)
  }, [selectedAttachmentId, loadContext])

  const handleStatusChange = (nextStatus) => {
    const normalized = normalizeRsdvStatusFilter(nextStatus)
    setStatusFilter(normalized)
    setSelectedAttachmentId("")
    setReviewContext(null)
    setQueueDrawerOpen(false)
    const params = new URLSearchParams(searchParams.toString())
    params.set("status", normalized)
    params.delete("attachmentId")
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const handleStudyChange = (value) => {
    const next = String(value ?? "")
    setSelectedStudyId(next)
    setSelectedAttachmentId("")
    setReviewContext(null)
    setQueueDrawerOpen(false)
    const params = new URLSearchParams(searchParams.toString())
    if (next) params.set("studyId", next)
    else params.delete("studyId")
    params.delete("attachmentId")
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const handleSelectRow = (row) => {
    const aid = String(row?.attachmentId ?? "")
    setSelectedAttachmentId(aid)
    setQueueDrawerOpen(false)
    const params = new URLSearchParams(searchParams.toString())
    if (aid) params.set("attachmentId", aid)
    else params.delete("attachmentId")
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const handleExitCompare = () => {
    setSelectedAttachmentId("")
    setReviewContext(null)
    setQueueDrawerOpen(false)
    const params = new URLSearchParams(searchParams.toString())
    params.delete("attachmentId")
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const selectedQueueRow = useMemo(
    () => queue.find((row) => String(row.attachmentId) === String(selectedAttachmentId)) ?? null,
    [queue, selectedAttachmentId],
  )

  const isCompareMode = Boolean(selectedAttachmentId)
  const isCompletedReview =
    statusFilter === "completed" ||
    String(reviewContext?.reviewStatus ?? selectedQueueRow?.reviewStatus ?? "").toLowerCase() === "completed"
  const activeTabCount =
    statusFilter === "pending"
      ? queueCounts.pending
      : statusFilter === "in_progress"
        ? queueCounts.inProgress
        : queueCounts.completed
  const selectedStudyLabel = useMemo(
    () => studyOptions.find((option) => option.value === String(selectedStudyId))?.label ?? "",
    [studyOptions, selectedStudyId],
  )

  const queueSiteOptions = useMemo(() => {
    const map = new Map()
    for (const row of queue) {
      if (row.siteId == null) continue
      map.set(String(row.siteId), row.siteName || `Site ${row.siteId}`)
    }
    return [...map.entries()].map(([value, label]) => ({ value, label }))
  }, [queue])

  const queuePatientOptions = useMemo(() => {
    const map = new Map()
    for (const row of queue) {
      if (row.patientEnrolmentId == null) continue
      const label = row.patientId || row.patientInitial || `Patient ${row.patientEnrolmentId}`
      map.set(String(row.patientEnrolmentId), label)
    }
    return [...map.entries()].map(([value, label]) => ({ value, label }))
  }, [queue])

  const allowReopenReview =
    Boolean(reviewContext?.allowRsdvReopen) &&
    String(reviewContext?.reviewStatus ?? "").toLowerCase() === "completed"

  const renderStatusTabs = (compact = false) => (
    <div
      className={cn(
        "flex flex-wrap gap-1 border-b border-slate-100",
        compact ? "px-2 py-2" : "px-3 py-2.5",
      )}
      role="tablist"
      aria-label="Review status filter"
    >
      {RSDV_STATUS_TABS.map((tab) => {
        const selected = statusFilter === tab.id
        const count =
          tab.id === "pending"
            ? queueCounts.pending
            : tab.id === "in_progress"
              ? queueCounts.inProgress
              : queueCounts.completed
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => handleStatusChange(tab.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all",
              selected
                ? "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500/30"
                : "border border-slate-200 bg-white text-slate-600 shadow-sm hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800",
            )}
          >
            {tab.label}
            <span
              className={cn(
                "rounded-full px-1.5 py-0 text-[10px] font-bold",
                selected ? "bg-white/25 text-white" : "bg-slate-100 text-slate-600",
              )}
            >
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )

  const renderQueuePanel = (compact = false) => (
    <>
      <div className={cn("flex items-center justify-between border-b border-slate-100 px-3 py-2.5", compact && "pr-2")}>
        <div>
          <p className="text-sm font-semibold text-slate-900">Review queue</p>
          <p className="text-[11px] text-slate-500">
            {activeTabCount} {RSDV_STATUS_TABS.find((tab) => tab.id === statusFilter)?.label.toLowerCase()} document(s)
          </p>
        </div>
        {compact ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-xl border-slate-200 text-slate-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800"
            onClick={() => setQueueDrawerOpen(false)}
            aria-label="Close queue"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      {renderStatusTabs(compact)}
      <div className="space-y-2 border-b border-slate-100 px-3 py-2.5">
        <input
          type="search"
          value={queueSearch}
          onChange={(e) => setQueueSearch(e.target.value)}
          placeholder="Search patient, site, visit, file…"
          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm"
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <SearchableSelect
            value={queueSiteId}
            onChange={setQueueSiteId}
            options={[{ value: "", label: "All sites" }, ...queueSiteOptions]}
            placeholder="Filter by site"
            className="w-full"
          />
          <SearchableSelect
            value={queuePatientEnrolmentId}
            onChange={setQueuePatientEnrolmentId}
            options={[{ value: "", label: "All patients" }, ...queuePatientOptions]}
            placeholder="Filter by patient"
            className="w-full"
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={RSDV_BTN_OUTLINE}
          disabled={!selectedStudyId || loadingQueue}
          onClick={() => void loadQueue(selectedStudyId, statusFilter)}
        >
          Apply filters
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loadingQueue ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          </div>
        ) : queue.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-slate-500">{getRsdvQueueEmptyMessage(statusFilter)}</p>
        ) : (
          <ul className="space-y-2">
            {queue.map((row) => {
              const selected = String(row.attachmentId) === String(selectedAttachmentId)
              return (
                <li key={row.attachmentId}>
                  <button
                    type="button"
                    onClick={() => handleSelectRow(row)}
                    className={cn(
                      "w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
                      selected
                        ? "border-emerald-300 bg-emerald-50/80"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{row.originalFileName}</p>
                      <RsdvReviewStatusBadge status={row.reviewStatus ?? statusFilter} />
                    </div>
                    <RsdvPatientContextMeta row={row} className="mt-2" variant="chips" />
                    <p className="mt-1.5 text-[10px] text-slate-400">
                      {statusFilter === "completed" && row.completedAt
                        ? `Completed ${formatRsdvUploadedAt(row.completedAt)}`
                        : `Uploaded ${formatRsdvUploadedAt(row.uploadedAt)}`}
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )

  const renderCompareToolbar = () => (
    <div className={RSDV_COMPARE_TOOLBAR}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" size="sm" className={cn("shrink-0", RSDV_BTN_PRIMARY)} onClick={handleExitCompare}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Queue
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className={cn(
              "h-9 w-9 shrink-0",
              queueDrawerOpen ? RSDV_BTN_SECONDARY : RSDV_BTN_OUTLINE,
            )}
            onClick={() => setQueueDrawerOpen((open) => !open)}
            aria-label={queueDrawerOpen ? "Hide queue panel" : "Show queue panel"}
          >
            {queueDrawerOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className={cn("h-9 w-9 shrink-0", RSDV_BTN_OUTLINE)}
            disabled={!selectedStudyId || loadingQueue}
            onClick={() => void loadQueue(selectedStudyId, statusFilter)}
            aria-label="Refresh queue"
          >
            <RefreshCw className={cn("h-4 w-4", loadingQueue && "animate-spin")} />
          </Button>
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex min-w-0 items-start gap-2">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-slate-900">
                {selectedQueueRow?.originalFileName || reviewContext?.attachment?.originalFileName || "Source document review"}
              </p>
              {selectedStudyLabel ? (
                <span className="mt-1 inline-flex max-w-full truncate rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-emerald-800">
                  {selectedStudyLabel}
                </span>
              ) : null}
            </div>
            {selectedQueueRow || reviewContext?.attachment ? (
              <RsdvReviewStatusBadge
                status={reviewContext?.reviewStatus ?? selectedQueueRow?.reviewStatus ?? statusFilter}
              />
            ) : null}
          </div>
          <RsdvPatientContextMeta
            row={selectedQueueRow ?? reviewContext?.attachment ?? {}}
            variant="cards"
          />
        </div>
      </div>
    </div>
  )

  const handleReviewCompleted = async () => {
    await loadQueue(selectedStudyId, statusFilter)
    setSelectedAttachmentId("")
    setReviewContext(null)
    setQueueDrawerOpen(false)
    const params = new URLSearchParams(searchParams.toString())
    params.delete("attachmentId")
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  if (!canView) {
    return (
      <DashboardLayout>
        <div className="p-6 text-sm text-slate-600">You do not have permission to view remote SDV review.</div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout hideChrome={isCompareMode}>
      <div
        className={cn(
          APP_VIEWPORT_WORKSPACE_CLASS,
          isCompareMode
            ? "h-[100dvh] bg-slate-100"
            : "max-lg:min-h-[calc(100dvh-var(--topbar-height,4.5625rem)-1.5rem)] max-lg:max-h-[calc(100dvh-var(--topbar-height,4.5625rem)-1.5rem)] lg:min-h-[calc(100dvh-var(--topbar-height,4.5625rem)-3rem)] lg:max-h-[calc(100dvh-var(--topbar-height,4.5625rem)-3rem)] gap-3 p-3 sm:p-4",
        )}
      >
        {isCompareMode ? (
          <>
            {renderCompareToolbar()}
            <div className="relative flex min-h-0 flex-1 overflow-hidden">
              {queueDrawerOpen ? (
                <>
                  <button
                    type="button"
                    className="absolute inset-0 z-20 bg-slate-900/35 lg:hidden"
                    onClick={() => setQueueDrawerOpen(false)}
                    aria-label="Close queue overlay"
                  />
                  <aside
                    className={cn(
                      PANEL,
                      "absolute inset-y-0 left-0 z-30 w-[min(100%,22rem)] shadow-xl lg:static lg:z-0 lg:w-80 lg:max-w-sm lg:shadow-none",
                    )}
                  >
                    {renderQueuePanel(true)}
                  </aside>
                </>
              ) : null}
              <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
                {loadingContext ? (
                  <div className="flex flex-1 items-center justify-center">
                    <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
                  </div>
                ) : (
                  <SplitReviewWorkspace
                    context={reviewContext}
                    canEdit={canEdit && !isCompletedReview}
                    allowReopen={canEdit && allowReopenReview}
                    canCreateQuery={canCreateQuery && !isCompletedReview}
                    canCloseQuery={canCloseQuery && !isCompletedReview}
                    onContextUpdated={setReviewContext}
                    onCompleted={() => void handleReviewCompleted()}
                    layout="fullscreen"
                    className="min-h-0 flex-1"
                  />
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700/80">Remote SDV</p>
                <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">Review queue</h1>
                <p className="text-sm text-slate-500">
                  Compare visit source documents against eCRF data in a split-screen workspace.
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <SearchableSelect
                  value={selectedStudyId}
                  onChange={handleStudyChange}
                  options={studyOptions}
                  placeholder={
                    loadingStudies
                      ? "Loading studies…"
                      : studies.length === 0
                        ? "No RSDV-enabled studies"
                        : "Select study"
                  }
                  disabled={loadingStudies || studies.length === 0}
                  className="w-full sm:w-[min(100%,420px)]"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className={cn("h-10 w-10 shrink-0", RSDV_BTN_OUTLINE)}
                  disabled={!selectedStudyId || loadingQueue}
                  onClick={() => void loadQueue(selectedStudyId, statusFilter)}
                  aria-label="Refresh queue"
                >
                  <RefreshCw className={cn("h-4 w-4", loadingQueue && "animate-spin")} />
                </Button>
              </div>
            </div>

            {!loadingStudies && studies.length === 0 ? (
              <div className={cn(PANEL, "items-center justify-center gap-2 p-8 text-center text-sm text-slate-600")}>
                <FileSearch className="mx-auto h-8 w-8 text-slate-400" />
                <p>No studies have Remote SDV enabled.</p>
                <p className="text-xs text-slate-500">
                  Enable it in Study Settings → Remote SDV for the studies you want to review.
                </p>
              </div>
            ) : !selectedStudyId ? (
              <div className={cn(PANEL, "items-center justify-center p-8 text-sm text-slate-500")}>
                Select a study to load the review queue.
              </div>
            ) : isRemoteSdvEnabled === false ? (
              <div className={cn(PANEL, "items-center justify-center gap-2 p-8 text-center text-sm text-slate-600")}>
                <FileSearch className="mx-auto h-8 w-8 text-slate-400" />
                <p>Remote SDV review is not enabled for this study.</p>
                <p className="text-xs text-slate-500">Turn it on in Study Settings → Remote SDV.</p>
              </div>
            ) : (
              <div className={cn(PANEL, "min-h-0 flex-1")}>{renderQueuePanel()}</div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}

function RsdvReviewPageFallback() {
  return (
    <DashboardLayout>
      <PageSkeleton />
    </DashboardLayout>
  )
}

export default function RsdvReviewPage() {
  return (
    <Suspense fallback={<RsdvReviewPageFallback />}>
      <RsdvReviewPageContent />
    </Suspense>
  )
}
