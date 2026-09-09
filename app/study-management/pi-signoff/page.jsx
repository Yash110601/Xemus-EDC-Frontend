"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import PiSignoffReadinessBadges, { PiSignoffBlockedReasons } from "@/components/pi-signoff/PiSignoffReadinessBadges"
import PiSignoffPasswordDialog from "@/components/pi-signoff/PiSignoffPasswordDialog"
import SearchableSelect from "@/components/ui/searchable-select"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { authService, studyService, piSignoffService } from "@/lib/services"
import { resolveRouteMenuPermissions } from "@/lib/utils/menuRoutePermissions"
import useStudyPermissionGates from "@/hooks/useStudyPermissionGates"
import {
  fetchStudySettingsByStudyId,
  pickIsPiSignoffRequired,
  pickIsPiSignoffBulkEnabled,
} from "@/lib/utils/studySettingsRead"
import {
  isFieldPiSignoffEnabled,
  isPiSignoffStatusVoided,
  requiresPiResign,
  reviewOrderLabel,
} from "@/lib/piSignoff/piSignoffReadiness"
import { cn } from "@/lib/utils"
import { VIEWPORT_PAGE_SHELL_WITH_EMERALD_BG_CLASS, MOBILE_TABLE_SCROLL_CLASS, MOBILE_TABLE_HINT_CLASS } from "@/lib/ui/responsivePageUi"
import { Badge } from "@/components/ui/badge"
import {
  AlertTriangle,
  ClipboardCheck,
  ExternalLink,
  FileCheck,
  RefreshCw,
  Users,
} from "lucide-react"
import Link from "next/link"

const PANEL =
  "flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] backdrop-blur-md"

const getStudyId = (study) => study?.studyId ?? study?.StudyId ?? study?.id ?? study?.Id ?? null

const getStudyLabel = (study) => {
  const protocol = study?.studyProtocolNumber ?? study?.StudyProtocolNumber ?? study?.protocolNumber ?? study?.name ?? ""
  const title = study?.studyTitle ?? study?.StudyTitle ?? ""
  if (protocol && title) return `${protocol} — ${title}`
  return protocol || title || `Study ${getStudyId(study) ?? ""}`
}

const formatPatientLabel = (row) => {
  const pid = row?.patientId ?? row?.patientEnrolmentId
  const initial = row?.patientInitial
  if (pid && initial) return `${pid} (${initial})`
  if (pid) return String(pid)
  if (initial) return initial
  return "—"
}

const formatVisitLabel = (row) => {
  const name = row?.visitName
  const no = row?.visitNo
  if (name && no != null) return `${name} (#${no})`
  return name || (no != null ? `Visit ${no}` : "—")
}

const formatSubmittedAt = (value) => {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString()
}

function PageSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-busy="true" aria-label="Loading PI sign-off">
      <div className="flex gap-3">
        <Skeleton className="h-16 flex-1 rounded-2xl bg-slate-200/40" />
        <Skeleton className="h-16 w-32 rounded-2xl bg-slate-200/40" />
      </div>
      <Skeleton className="h-64 w-full rounded-2xl bg-slate-200/40" />
    </div>
  )
}

function EmptyQueueState({ icon: Icon, title, description, actionHref, actionLabel }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200/90 bg-gradient-to-b from-slate-50/90 to-white px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100">
        <Icon className="h-7 w-7" strokeWidth={1.75} />
      </div>
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-600">{description}</p>
      {actionHref && actionLabel ? (
        <Button asChild type="button" variant="outline" size="sm" className="mt-6 rounded-xl border-indigo-200 text-indigo-800 hover:bg-indigo-50">
          <Link href={actionHref}>
            {actionLabel}
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>
      ) : null}
    </div>
  )
}

function PiSignoffPageContent() {
  const { toast } = useToast()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const routePerm = useMemo(
    () => resolveRouteMenuPermissions(authService.getMenu?.(), pathname),
    [pathname],
  )

  const [studies, setStudies] = useState([])
  const [loadingStudies, setLoadingStudies] = useState(true)
  const [loadingQueue, setLoadingQueue] = useState(false)
  const [pending, setPending] = useState([])
  const [pendingPatientCount, setPendingPatientCount] = useState(0)
  const [reviewOrder, setReviewOrder] = useState("sdv_before_sign")
  const [piSignoffGranularity, setPiSignoffGranularity] = useState("crf_only")
  const [isPiSignoffRequired, setIsPiSignoffRequired] = useState(null)
  const [isPiSignoffBulkEnabled, setIsPiSignoffBulkEnabled] = useState(false)
  const [selectedSiteId, setSelectedSiteId] = useState("")
  const [apiReady, setApiReady] = useState(true)
  const [signComment, setSignComment] = useState("")
  const [passwordDialog, setPasswordDialog] = useState({
    open: false,
    row: null,
    mode: "apply",
    bulkSiteId: null,
    bulkReadyCount: 0,
  })
  const [passwordDialogSaving, setPasswordDialogSaving] = useState(false)
  const [selectedStudyId, setSelectedStudyId] = useState(() => {
    const fromUrl = searchParams.get("studyId")
    return fromUrl ? String(fromUrl) : ""
  })

  const { gates } = useStudyPermissionGates(selectedStudyId, null, {
    menuCanView: routePerm.canView,
    menuCanEdit: routePerm.canEdit,
  })

  const canView = routePerm.canView || gates.canPiSignoff
  const canSign = routePerm.canEdit || gates.canPiSignoff

  const studyOptions = useMemo(
    () =>
      studies.map((study) => {
        const id = getStudyId(study)
        return { value: String(id ?? ""), label: getStudyLabel(study) }
      }),
    [studies],
  )

  const loadStudies = useCallback(async () => {
    setLoadingStudies(true)
    try {
      const res = await studyService.getStudiesForDropdown()
      setStudies(Array.isArray(res?.data) ? res.data : [])
    } finally {
      setLoadingStudies(false)
    }
  }, [])

  const loadPending = useCallback(async (studyId) => {
    const sid = Number.parseInt(String(studyId ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0) {
      setPending([])
      setPendingPatientCount(0)
      setReviewOrder("sdv_before_sign")
      setIsPiSignoffRequired(null)
      setIsPiSignoffBulkEnabled(false)
      setSelectedSiteId("")
      return
    }
    setLoadingQueue(true)
    try {
      const [settings, res] = await Promise.all([
        fetchStudySettingsByStudyId(sid),
        piSignoffService.getPendingByStudy(sid),
      ])
      const requiredFromSettings = pickIsPiSignoffRequired(settings?.data ?? settings)
      const bulkFromSettings = pickIsPiSignoffBulkEnabled(settings?.data ?? settings)
      const requiredFromApi = res?.isPiSignoffRequired
      const bulkFromApi = res?.isPiSignoffBulkEnabled
      const required =
        requiredFromApi === true || requiredFromApi === false ? requiredFromApi : requiredFromSettings
      const bulkEnabled =
        bulkFromApi === true || bulkFromApi === false ? bulkFromApi : bulkFromSettings
      setIsPiSignoffRequired(required)
      setIsPiSignoffBulkEnabled(required && bulkEnabled)
      setApiReady(res?.statusCode !== 404 && res?.statusCode !== 501)
      setReviewOrder(res?.reviewOrder ?? "sdv_before_sign")
      setPiSignoffGranularity(res?.piSignoffGranularity ?? "crf_only")
      const rows = required ? (Array.isArray(res?.data) ? res.data : []) : []
      setPending(rows)
      setPendingPatientCount(
        Number.isFinite(res?.pendingPatientCount) && res.pendingPatientCount > 0
          ? res.pendingPatientCount
          : new Set(
              rows
                .map((row) => row?.patientEnrolmentId ?? row?.patientId)
                .filter((id) => id != null && String(id).trim() !== ""),
            ).size,
      )
    } finally {
      setLoadingQueue(false)
    }
  }, [])

  useEffect(() => {
    void loadStudies()
  }, [loadStudies])

  useEffect(() => {
    void loadPending(selectedStudyId)
  }, [selectedStudyId, loadPending])

  const handleStudyChange = (value) => {
    const next = String(value ?? "")
    setSelectedStudyId(next)
    setSelectedSiteId("")
    const params = new URLSearchParams(searchParams.toString())
    if (next) params.set("studyId", next)
    else params.delete("studyId")
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const handleSignoff = async (row, password, comment = "") => {
    const sid = Number.parseInt(String(selectedStudyId ?? ""), 10)
    const cid = Number.parseInt(String(row?.crfDataId ?? ""), 10)
    if (!Number.isFinite(sid) || !Number.isFinite(cid)) return false
    if (!row?.readiness?.isReadyToSign) return false

    const res = await piSignoffService.applySignoff({
      studyId: sid,
      crfDataId: cid,
      password,
      ...(String(comment || "").trim() ? { comment: String(comment).trim() } : {}),
    })
    if (res?.isSuccess) {
      toast({ title: "PI sign-off applied", variant: "success" })
      setSignComment("")
      await loadPending(sid)
      return true
    }
    toast({
      title: "Sign-off failed",
      description: res?.message || "PI sign-off could not be applied.",
      variant: "destructive",
    })
    return false
  }

  const handleRevoke = async (row, password, reason) => {
    const sid = Number.parseInt(String(selectedStudyId ?? ""), 10)
    const cid = Number.parseInt(String(row?.crfDataId ?? ""), 10)
    if (!Number.isFinite(sid) || !Number.isFinite(cid)) return false
    if (!String(reason || "").trim()) return false

    const res = await piSignoffService.revokeSignoff({
      studyId: sid,
      crfDataId: cid,
      password,
      reason: String(reason).trim(),
    })
    if (res?.isSuccess) {
      toast({ title: "PI sign-off revoked", variant: "success" })
      await loadPending(sid)
      return true
    }
    toast({
      title: "Revoke failed",
      description: res?.message || "Unable to revoke PI sign-off.",
      variant: "destructive",
    })
    return false
  }

  const handleBulkSignoff = async (siteId, password, comment = "") => {
    const sid = Number.parseInt(String(selectedStudyId ?? ""), 10)
    const site = Number.parseInt(String(siteId ?? ""), 10)
    if (!Number.isFinite(sid) || !Number.isFinite(site)) return false

    const res = await piSignoffService.applyBulkSignoff({
      studyId: sid,
      siteId: site,
      password,
      ...(String(comment || "").trim() ? { comment: String(comment).trim() } : {}),
    })
    if (res?.isSuccess) {
      const result = res?.data ?? {}
      const signed = Number(result.signedCount ?? 0)
      const skipped = Number(result.skippedCount ?? 0)
      const failed = Number(result.failedCount ?? 0)
      toast({
        title: "Bulk PI sign-off complete",
        description: `${signed} signed${skipped > 0 ? `, ${skipped} skipped` : ""}${failed > 0 ? `, ${failed} failed` : ""}.`,
        variant: signed > 0 ? "success" : "default",
      })
      setSignComment("")
      await loadPending(sid)
      return true
    }
    toast({
      title: "Bulk sign-off failed",
      description: res?.message || "Bulk PI sign-off could not be applied.",
      variant: "destructive",
    })
    return false
  }

  const buildEcrfLink = (row) => {
    const params = new URLSearchParams()
    if (selectedStudyId) params.set("studyId", String(selectedStudyId))
    const siteId = row?.siteId ?? row?.SiteId
    const patientId = row?.patientEnrolmentId ?? row?.patientId
    const visitId = row?.visitScheduleId ?? row?.visitId
    const crfDesignId = row?.crfDesignId
    if (siteId) params.set("siteId", String(siteId))
    if (patientId) params.set("patientId", String(patientId))
    if (visitId) params.set("visitId", String(visitId))
    if (crfDesignId) params.set("crfDesignId", String(crfDesignId))
    return `/ecrf-data-entry/manually?${params.toString()}`
  }

  const handlePasswordConfirm = async (password, extraReason, extraComment) => {
    setPasswordDialogSaving(true)
    try {
      let ok = false
      if (passwordDialog.mode === "bulkApply") {
        ok = await handleBulkSignoff(
          passwordDialog.bulkSiteId,
          password,
          extraComment || signComment,
        )
      } else if (!passwordDialog.row) {
        return
      } else if (passwordDialog.mode === "revoke") {
        ok = await handleRevoke(passwordDialog.row, password, extraReason)
      } else {
        ok = await handleSignoff(passwordDialog.row, password, extraComment || signComment)
      }
      if (ok) {
        setPasswordDialog({ open: false, row: null, mode: "apply", bulkSiteId: null, bulkReadyCount: 0 })
      }
    } finally {
      setPasswordDialogSaving(false)
    }
  }

  const fieldPiEnabled = isFieldPiSignoffEnabled(piSignoffGranularity)
  const siteOptions = useMemo(() => {
    const map = new Map()
    pending.forEach((row) => {
      const id = row?.siteId
      if (id == null || String(id).trim() === "") return
      const key = String(id)
      if (!map.has(key)) {
        map.set(key, { value: key, label: row.siteName ? `${row.siteName} (${key})` : `Site ${key}` })
      }
    })
    return [{ value: "", label: "All sites" }, ...Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label))]
  }, [pending])

  const filteredPending = useMemo(() => {
    if (!selectedSiteId) return pending
    return pending.filter((row) => String(row?.siteId ?? "") === selectedSiteId)
  }, [pending, selectedSiteId])

  const readyCount = useMemo(
    () => filteredPending.filter((row) => row?.readiness?.isReadyToSign).length,
    [filteredPending],
  )
  const readyCountForSelectedSite = useMemo(() => {
    if (!selectedSiteId) return 0
    return pending.filter(
      (row) => String(row?.siteId ?? "") === selectedSiteId && row?.readiness?.isReadyToSign,
    ).length
  }, [pending, selectedSiteId])
  const filteredPatientCount = useMemo(
    () =>
      new Set(
        filteredPending
          .map((row) => row?.patientEnrolmentId ?? row?.patientId)
          .filter((id) => id != null && String(id).trim() !== ""),
      ).size,
    [filteredPending],
  )
  const studySettingsHref = selectedStudyId
    ? `/study-management/study-settings?studyId=${encodeURIComponent(selectedStudyId)}`
    : null
  const ecrfEntryHref = selectedStudyId
    ? `/ecrf-data-entry/manually?studyId=${encodeURIComponent(selectedStudyId)}`
    : null

  if (!canView) {
    return (
      <DashboardLayout>
        <div className="flex flex-1 flex-col p-4">
          <div className={cn(PANEL, "items-center justify-center p-8 text-center")}>
            <AlertTriangle className="mb-3 h-8 w-8 text-amber-600" />
            <p className="text-sm font-semibold text-slate-900">You do not have permission to view PI sign-off.</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className={cn(VIEWPORT_PAGE_SHELL_WITH_EMERALD_BG_CLASS, "flex min-h-0 flex-1 flex-col")}>
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-500 text-white shadow-md shadow-indigo-500/20">
              <ClipboardCheck className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">PI sign-off</h1>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
                Review submitted CRFs awaiting principal investigator sign-off. Readiness gates follow the study
                review order setting.
              </p>
              {selectedStudyId ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-lg border-slate-200 bg-white/80 font-medium text-slate-700">
                    {reviewOrderLabel(reviewOrder)}
                  </Badge>
                  {pending.length > 0 ? (
                    <>
                      <Badge className="rounded-lg bg-indigo-50 font-medium text-indigo-800 hover:bg-indigo-50">
                        {pending.length} pending CRF{pending.length === 1 ? "" : "s"}
                      </Badge>
                      {pendingPatientCount > 0 ? (
                        <Badge variant="outline" className="rounded-lg border-slate-200 bg-white/80 font-medium text-slate-600">
                          {pendingPatientCount} patient{pendingPatientCount === 1 ? "" : "s"}
                        </Badge>
                      ) : null}
                      {readyCount > 0 ? (
                        <Badge className="rounded-lg bg-emerald-50 font-medium text-emerald-800 hover:bg-emerald-50">
                          {readyCount} ready to sign
                        </Badge>
                      ) : null}
                      {isPiSignoffBulkEnabled ? (
                        <Badge variant="outline" className="rounded-lg border-indigo-200 bg-indigo-50/70 font-medium text-indigo-800">
                          Bulk sign-off on
                        </Badge>
                      ) : null}
                    </>
                  ) : isPiSignoffRequired === false ? (
                    <Badge variant="outline" className="rounded-lg border-amber-200 bg-amber-50/80 font-medium text-amber-900">
                      PI sign-off off
                    </Badge>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {canSign && isPiSignoffBulkEnabled && pending.length > 0 ? (
              <Button
                type="button"
                size="sm"
                disabled={!selectedSiteId || readyCountForSelectedSite <= 0 || loadingQueue}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700"
                onClick={() => {
                  setSignComment("")
                  setPasswordDialog({
                    open: true,
                    row: null,
                    mode: "bulkApply",
                    bulkSiteId: Number.parseInt(selectedSiteId, 10),
                    bulkReadyCount: readyCountForSelectedSite,
                  })
                }}
              >
                Sign all ready at site ({readyCountForSelectedSite || 0})
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!selectedStudyId || loadingQueue}
              onClick={() => void loadPending(selectedStudyId)}
              className="rounded-xl bg-white/80"
            >
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loadingQueue && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        <div className={PANEL}>
          <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="w-full min-w-0 sm:max-w-lg">
                <label className="mb-1.5 block text-sm font-bold text-slate-700">
                  Study <span className="text-red-500">*</span>
                </label>
                {loadingStudies ? (
                  <Skeleton className="h-11 w-full rounded-xl bg-slate-200/60" aria-hidden />
                ) : (
                  <SearchableSelect
                    placeholder="Search and select study"
                    options={studyOptions}
                    value={selectedStudyId}
                    onChange={handleStudyChange}
                    disabled={loadingStudies}
                    showSearch
                    searchIconPosition="end"
                    includeEmptyOption
                    className={cn(
                      "min-h-[44px] w-full rounded-xl border-2 bg-white px-3 py-2.5 text-sm transition-all outline-none",
                      selectedStudyId
                        ? "border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                        : "border-red-200 bg-red-50/40 focus:border-red-400 focus:ring-4 focus:ring-red-100",
                    )}
                  />
                )}
              </div>
              {selectedStudyId ? (
                <div className="flex min-h-[44px] items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200/70">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Study ID</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-900">{selectedStudyId}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-1 flex-col p-4 sm:p-5">
            {!selectedStudyId ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200/80 bg-slate-50/50 px-6 py-16 text-center">
                <ClipboardCheck className="mb-3 h-8 w-8 text-slate-300" strokeWidth={1.5} />
                <p className="text-sm font-medium text-slate-700">Select a study to load the sign-off queue</p>
                <p className="mt-1 text-xs text-slate-500">Choose a study above to review submitted CRFs awaiting PI sign-off.</p>
              </div>
            ) : loadingQueue && pending.length === 0 ? (
              <PageSkeleton />
            ) : !apiReady ? (
              <EmptyQueueState
                icon={FileCheck}
                title="PI sign-off queue API is not deployed yet"
                description="Open eCRF for submitted forms — users with pi.signoff permission will see the in-form sign-off panel when PI sign-off is enabled in Study Settings."
              />
            ) : isPiSignoffRequired === false ? (
              <EmptyQueueState
                icon={AlertTriangle}
                title="PI sign-off is not enabled for this study"
                description="Turn on PI sign-off required in Study Settings to use the queue and eCRF sign-off panel."
                actionHref={studySettingsHref}
                actionLabel="Open Study Settings"
              />
            ) : pending.length === 0 ? (
              <EmptyQueueState
                icon={FileCheck}
                title="No CRFs awaiting PI sign-off"
                description="This queue lists submitted CRFs that are not yet PI-signed. Saved or draft forms do not appear here — submit them from eCRF Data Entry first."
                actionHref={ecrfEntryHref}
                actionLabel="Open eCRF Data Entry"
              />
            ) : (
              <div className="flex flex-col gap-4">
                {siteOptions.length > 2 || isPiSignoffBulkEnabled ? (
                  <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="w-full min-w-0 sm:max-w-xs">
                      <label className="mb-1.5 block text-sm font-semibold text-slate-700">Filter by site</label>
                      <SearchableSelect
                        placeholder="All sites"
                        options={siteOptions}
                        value={selectedSiteId}
                        onChange={(value) => setSelectedSiteId(String(value ?? ""))}
                        showSearch
                        searchIconPosition="end"
                        includeEmptyOption={false}
                        className="min-h-[44px] w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm"
                      />
                    </div>
                    {isPiSignoffBulkEnabled ? (
                      <p className="text-xs leading-relaxed text-slate-600 sm:max-w-md">
                        Select a site, then use <strong className="font-semibold text-slate-800">Sign all ready at site</strong> to
                        PI-sign every ready submitted CRF at that site in one step.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pending CRFs</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{filteredPending.length}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Patients</p>
                    <p className="mt-1 flex items-center gap-2 text-2xl font-bold tabular-nums text-slate-900">
                      {filteredPatientCount}
                      <Users className="h-5 w-5 text-slate-400" strokeWidth={1.75} />
                    </p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/40 px-4 py-3.5 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800/80">Ready to sign</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-900">{readyCount}</p>
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-slate-500">
                  Each row is one submitted form (patient + visit + CRF). Use <strong className="font-semibold text-slate-600">Open eCRF</strong> to
                  review data; sign off here when readiness checks pass.
                </p>

                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
                  <p className={MOBILE_TABLE_HINT_CLASS}>Swipe horizontally to see all columns</p>
                  <div className={MOBILE_TABLE_SCROLL_CLASS}>
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 z-[1] bg-slate-50/95 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur-sm">
                        <tr>
                          <th className="px-4 py-3">Patient</th>
                          <th className="px-4 py-3">Site</th>
                          <th className="px-4 py-3">Visit</th>
                          <th className="px-4 py-3">CRF</th>
                          <th className="px-4 py-3">Submitted</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 min-w-[220px]">Readiness</th>
                          <th className="px-4 py-3">Signed by</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPending.map((row) => {
                          const ready = Boolean(row?.readiness?.isReadyToSign)
                          const voided = isPiSignoffStatusVoided(row?.status)
                          const resign = requiresPiResign(row)
                          const blockedReasons = Array.isArray(row?.readiness?.blockedReasons)
                            ? row.readiness.blockedReasons.filter(Boolean)
                            : []
                          return (
                            <tr
                              key={row.crfDataId}
                              className="border-t border-slate-100 align-top transition-colors hover:bg-slate-50/70"
                            >
                              <td className="px-4 py-3">
                                <p className="font-semibold text-slate-900">{formatPatientLabel(row)}</p>
                              </td>
                              <td className="px-4 py-3 text-slate-700">{row.siteName ?? "—"}</td>
                              <td className="px-4 py-3 text-slate-700">{formatVisitLabel(row)}</td>
                              <td className="px-4 py-3">
                                <p className="font-medium text-slate-900">{row.crfDesignName ?? "—"}</p>
                              </td>
                              <td className="px-4 py-3 text-xs tabular-nums text-slate-600">
                                {formatSubmittedAt(row.submittedAt)}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={cn(
                                    "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1",
                                    voided || resign
                                      ? "bg-amber-50 text-amber-900 ring-amber-200/80"
                                      : "bg-slate-100 text-slate-700 ring-slate-200/80",
                                  )}
                                >
                                  {row.status ?? "Pending"}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <PiSignoffReadinessBadges
                                  record={row}
                                  reviewOrder={reviewOrder}
                                  isFieldPiSignoffEnabled={fieldPiEnabled}
                                  className="mt-0"
                                />
                                {blockedReasons.length > 0 ? (
                                  <PiSignoffBlockedReasons
                                    reasons={blockedReasons}
                                    className="mt-1.5 text-[11px] leading-snug text-rose-800/90"
                                  />
                                ) : null}
                              </td>
                              <td className="px-4 py-3 text-slate-700">{row.signedBy ?? "—"}</td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex flex-col items-end gap-2">
                                  <Button
                                    asChild
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-8 rounded-lg border-slate-200 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 hover:text-indigo-900"
                                  >
                                    <Link href={buildEcrfLink(row)}>
                                      Open eCRF
                                      <ExternalLink className="ml-1 h-3 w-3" />
                                    </Link>
                                  </Button>
                                  {fieldPiEnabled &&
                                  row?.readiness?.fieldSignoff?.totalEligible > 0 &&
                                  !row?.readiness?.fieldSignoff?.allFieldsSigned ? (
                                    <span className="text-[10px] text-slate-500">Field sign-off in eCRF</span>
                                  ) : null}
                                  {canSign ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      disabled={!ready}
                                      title={!ready && blockedReasons.length ? blockedReasons.join("; ") : undefined}
                                      className={cn(
                                        "h-8 rounded-lg text-xs font-semibold",
                                        ready
                                          ? "bg-indigo-600 text-white hover:bg-indigo-700"
                                          : "bg-slate-100 text-slate-400 hover:bg-slate-100",
                                      )}
                                      onClick={() => {
                                        setSignComment("")
                                        setPasswordDialog({
                                          open: true,
                                          row,
                                          mode: "apply",
                                          bulkSiteId: null,
                                          bulkReadyCount: 0,
                                        })
                                      }}
                                    >
                                      {resign || voided ? "Re-sign" : "Sign off"}
                                    </Button>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <PiSignoffPasswordDialog
        open={passwordDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setPasswordDialog({ open: false, row: null, mode: "apply", bulkSiteId: null, bulkReadyCount: 0 })
          }
        }}
        mode={
          passwordDialog.mode === "bulkApply"
            ? "bulkApply"
            : passwordDialog.mode === "revoke"
              ? "revoke"
              : passwordDialog.row &&
                  (requiresPiResign(passwordDialog.row) ||
                    isPiSignoffStatusVoided(passwordDialog.row?.status))
                ? "resign"
                : "apply"
        }
        title={
          passwordDialog.mode === "bulkApply"
            ? `Confirm bulk PI sign-off (${passwordDialog.bulkReadyCount} ready CRF${passwordDialog.bulkReadyCount === 1 ? "" : "s"})`
            : passwordDialog.mode === "revoke"
              ? "Confirm revoke PI sign-off"
              : passwordDialog.row &&
                  (requiresPiResign(passwordDialog.row) ||
                    isPiSignoffStatusVoided(passwordDialog.row?.status))
                ? "Confirm PI re-sign"
                : "Confirm PI sign-off"
        }
        confirmLabel={
          passwordDialog.mode === "bulkApply"
            ? `Sign ${passwordDialog.bulkReadyCount} CRF${passwordDialog.bulkReadyCount === 1 ? "" : "s"}`
            : passwordDialog.mode === "revoke"
              ? "Revoke sign-off"
              : passwordDialog.row &&
                  (requiresPiResign(passwordDialog.row) ||
                    isPiSignoffStatusVoided(passwordDialog.row?.status))
                ? "Re-sign CRF"
                : "Sign off CRF"
        }
        showComment={passwordDialog.mode !== "revoke"}
        commentPlaceholder="e.g. Reviewed with site staff — no discrepancies"
        requireReason={passwordDialog.mode === "revoke"}
        commentValue={signComment}
        onCommentChange={setSignComment}
        loading={passwordDialogSaving}
        onConfirm={handlePasswordConfirm}
      />
    </DashboardLayout>
  )
}

export default function PiSignoffPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PiSignoffPageContent />
    </Suspense>
  )
}
