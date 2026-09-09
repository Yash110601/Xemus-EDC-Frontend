"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import ActiveLocksTable from "@/components/database-lock/ActiveLocksTable"
import CrfInstancePicker from "@/components/database-lock/CrfInstancePicker"
import CrfLockTargetTree, { selectionKeysToTargets } from "@/components/database-lock/CrfLockTargetTree"
import SearchableSelect from "@/components/ui/searchable-select"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { authService, studyService, siteService, dbLockService } from "@/lib/services"
import { StudyFilter } from "@/lib/api/config"
import { formatDbLockFailure } from "@/lib/dbLock/dbLockApplyFeedback"
import { resolveRouteMenuPermissions } from "@/lib/utils/menuRoutePermissions"
import useStudyPermissionGates from "@/hooks/useStudyPermissionGates"
import useStudyPiPendingSummary from "@/hooks/useStudyPiPendingSummary"
import PiSignoffDbLockBanner from "@/components/pi-signoff/PiSignoffDbLockBanner"
import { cn } from "@/lib/utils"
import { AlertTriangle, Loader2, Lock, Unlock } from "lucide-react"

const PANEL =
  "flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] backdrop-blur-md"

const COARSE_LEVELS = [
  { id: "study", label: "Study" },
  { id: "site", label: "Site" },
  { id: "crf", label: "CRF (granular)" },
]

const PAGE_VIEWS = [
  { id: "active", label: "Active locks" },
  { id: "apply", label: "Apply / release" },
]

const getStudyId = (study) => study?.studyId ?? study?.StudyId ?? study?.id ?? study?.Id ?? null

const getStudyLabel = (study) => {
  const protocol = study?.studyProtocolNumber ?? study?.StudyProtocolNumber ?? study?.protocolNumber ?? study?.name ?? ""
  const title = study?.studyTitle ?? study?.StudyTitle ?? ""
  if (protocol && title) return `${protocol} — ${title}`
  return protocol || title || `Study ${getStudyId(study) ?? ""}`
}

function PageSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4" role="status" aria-busy="true" aria-label="Loading database lock">
      <Skeleton className="h-10 w-full max-w-md rounded-xl bg-slate-200/60" />
      <Skeleton className="h-40 w-full rounded-2xl bg-slate-200/50" />
      <Skeleton className="min-h-[280px] flex-1 rounded-2xl bg-slate-200/40" />
    </div>
  )
}

function DatabaseLockPageContent() {
  const { toast } = useToast()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const routePerm = useMemo(
    () => resolveRouteMenuPermissions(authService.getMenu?.(), pathname),
    [pathname],
  )

  const [studies, setStudies] = useState([])
  const [sites, setSites] = useState([])
  const [loadingStudies, setLoadingStudies] = useState(true)
  const [loadingSites, setLoadingSites] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState(false)
  const [loadingTree, setLoadingTree] = useState(false)
  const [acting, setActing] = useState(false)
  const [lockStatus, setLockStatus] = useState(null)
  const [lockTargets, setLockTargets] = useState(null)
  const [granularApiAvailable, setGranularApiAvailable] = useState(false)
  const [lockLevel, setLockLevel] = useState("study")
  const [selectedSiteId, setSelectedSiteId] = useState("")
  const [crfInstance, setCrfInstance] = useState(null)
  const [sectionTree, setSectionTree] = useState([])
  const [selectedTargetKeys, setSelectedTargetKeys] = useState(new Set())
  const [pageView, setPageView] = useState("active")
  const [locksRefreshToken, setLocksRefreshToken] = useState(0)
  const [studiesLoadError, setStudiesLoadError] = useState("")
  const [selectedStudyId, setSelectedStudyId] = useState(() => {
    const fromUrl = searchParams.get("studyId")
    return fromUrl ? String(fromUrl) : ""
  })

  const { gates } = useStudyPermissionGates(selectedStudyId, selectedSiteId || null, {
    menuCanView: routePerm.canView,
    menuCanEdit: routePerm.canEdit,
  })
  const {
    pendingCount: piPendingCount,
    pendingPatientCount: piPendingPatientCount,
    isPiSignoffRequired: piRequiredForLock,
  } = useStudyPiPendingSummary(selectedStudyId, { enabled: Boolean(selectedStudyId) })

  const canView = routePerm.canView || gates.canViewDbLock
  const canApply = routePerm.canEdit || gates.canApplyDbLock

  const studyOptions = useMemo(
    () =>
      studies.map((study) => {
        const id = getStudyId(study)
        const label = getStudyLabel(study)
        const isLocked = Boolean(study?.isLocked ?? study?.IsLocked)
        return {
          value: String(id ?? ""),
          label: isLocked ? `${label} (locked)` : label,
        }
      }),
    [studies],
  )

  const siteOptions = useMemo(
    () =>
      sites.map((site) => {
        const id = site.siteId ?? site.SiteId ?? site.id ?? site.Id
        const name = site.siteName ?? site.SiteName ?? site.name ?? `Site ${id}`
        return { value: String(id ?? ""), label: String(name) }
      }),
    [sites],
  )

  const lockedSelectionKeys = useMemo(
    () => lockTargets?.lockedSelectionKeys ?? new Set(),
    [lockTargets],
  )

  const wholeCrfLocked = useMemo(() => {
    if (lockLevel !== "crf") return false
    return Boolean(
      lockTargets?.isWholeCrfLocked ||
        lockTargets?.cascadeLocked?.study ||
        lockTargets?.cascadeLocked?.site ||
        (lockStatus?.isLocked && String(lockStatus?.level ?? "").toLowerCase() === "crf"),
    )
  }, [lockLevel, lockTargets, lockStatus])

  const hasPartialGranularLock =
    lockLevel === "crf" &&
    !wholeCrfLocked &&
    !lockStatus?.isLocked &&
    (lockTargets?.lockedFieldKeys?.size > 0 || lockTargets?.lockedSectionKeys?.size > 0)

  const structureMeta = lockTargets?.patientIdentifier
    ? `${lockTargets.patientIdentifier}${lockTargets.visitTypeName ? ` · ${lockTargets.visitTypeName}` : ""}${lockTargets.crfDesignName ? ` · ${lockTargets.crfDesignName}` : ""}`
    : crfInstance?.visitLabel ?? ""

  const loadStudies = useCallback(async () => {
    setLoadingStudies(true)
    setStudiesLoadError("")
    try {
      const [dropdownRes, lockedRes] = await Promise.all([
        studyService.getStudiesForDropdown(null, { includeLocked: true }),
        studyService.getAccessibleStudiesWithSites(StudyFilter.Locked),
      ])

      const byId = new Map()
      const addStudy = (study, forceLocked = false) => {
        const id = getStudyId(study)
        if (!id) return
        const key = String(id)
        const isLocked = forceLocked || Boolean(study?.isLocked ?? study?.IsLocked)
        byId.set(key, {
          ...byId.get(key),
          ...study,
          studyId: id,
          StudyId: id,
          isLocked,
          IsLocked: isLocked,
        })
      }

      if (dropdownRes?.isSuccess && Array.isArray(dropdownRes.data)) {
        dropdownRes.data.forEach((study) => addStudy(study))
      }
      if (lockedRes?.isSuccess && Array.isArray(lockedRes.data)) {
        lockedRes.data.forEach((study) => addStudy(study, true))
      }

      const merged = Array.from(byId.values()).sort((a, b) => {
        const aLocked = Boolean(a?.isLocked ?? a?.IsLocked)
        const bLocked = Boolean(b?.isLocked ?? b?.IsLocked)
        if (aLocked !== bLocked) return aLocked ? -1 : 1
        return getStudyLabel(a).localeCompare(getStudyLabel(b))
      })

      setStudies(merged)

      if (merged.length === 0) {
        const msg = dropdownRes?.message || lockedRes?.message
        setStudiesLoadError(msg || "No studies available for your account.")
      }
    } catch {
      setStudies([])
      setStudiesLoadError("Failed to load studies.")
    } finally {
      setLoadingStudies(false)
    }
  }, [])

  const loadSites = useCallback(async (studyId) => {
    const sid = Number.parseInt(String(studyId ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0) {
      setSites([])
      return
    }
    setLoadingSites(true)
    try {
      const res = await siteService.getSitesByStudy(sid)
      setSites(Array.isArray(res?.data) ? res.data : [])
    } finally {
      setLoadingSites(false)
    }
  }, [])

  const loadLockState = useCallback(async () => {
    const sid = Number.parseInt(String(selectedStudyId ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0) {
      setLockStatus(null)
      setLockTargets(null)
      setSectionTree([])
      return
    }

    const scope = {}
    if (lockLevel === "site" || lockLevel === "crf") {
      const siteNum = Number.parseInt(String(selectedSiteId ?? ""), 10)
      if (Number.isFinite(siteNum) && siteNum > 0) scope.siteId = siteNum
    }
    if (lockLevel === "crf") {
      const crfNum = Number.parseInt(String(crfInstance?.crfDataId ?? ""), 10)
      if (Number.isFinite(crfNum) && crfNum > 0) scope.crfDataId = crfNum
    }

    setLoadingStatus(true)
    if (lockLevel === "crf" && scope.crfDataId) {
      setLoadingTree(true)
    }
    try {
      const statusPromise = dbLockService.getLockStatus(sid, scope)
      const structurePromise =
        lockLevel === "crf" && scope.crfDataId
          ? dbLockService.getCrfStructure(sid, scope.crfDataId)
          : Promise.resolve(null)

      const [statusRes, structureRes] = await Promise.all([statusPromise, structurePromise])
      setLockStatus(statusRes?.data ?? null)

      if (structureRes?.data) {
        setLockTargets(structureRes.data)
        setSectionTree(structureRes.data.sectionTree ?? [])
        setGranularApiAvailable(Boolean(structureRes.granularApiAvailable))
      } else {
        setLockTargets(null)
        setSectionTree([])
        setGranularApiAvailable(false)
      }
    } finally {
      setLoadingStatus(false)
      setLoadingTree(false)
    }
  }, [selectedStudyId, lockLevel, selectedSiteId, crfInstance?.crfDataId])

  useEffect(() => {
    void loadStudies()
  }, [loadStudies])

  // When locked studies exist and none selected, pre-select the first locked study.
  useEffect(() => {
    if (selectedStudyId || loadingStudies || studies.length === 0) return
    const firstLocked = studies.find((s) => s?.isLocked || s?.IsLocked)
    if (!firstLocked) return
    const id = String(getStudyId(firstLocked) ?? "")
    if (!id) return
    setSelectedStudyId(id)
    const params = new URLSearchParams(searchParams.toString())
    params.set("studyId", id)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [studies, selectedStudyId, loadingStudies, pathname, router, searchParams])

  useEffect(() => {
    void loadSites(selectedStudyId)
    setSelectedSiteId("")
    setCrfInstance(null)
    setSectionTree([])
    setSelectedTargetKeys(new Set())
  }, [selectedStudyId, loadSites])

  useEffect(() => {
    void loadLockState()
  }, [loadLockState])

  const handleStudyChange = (value) => {
    const next = String(value ?? "")
    setSelectedStudyId(next)
    const params = new URLSearchParams(searchParams.toString())
    if (next) params.set("studyId", next)
    else params.delete("studyId")
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const bumpLocksList = useCallback(() => {
    setLocksRefreshToken((n) => n + 1)
  }, [])

  const handleLockListRowClick = useCallback((row) => {
    const level = String(row?.level ?? "").toLowerCase()
    if (level === "crf" || level === "section" || level === "field") {
      if (row.siteId) setSelectedSiteId(String(row.siteId))
      setLockLevel("crf")
      setCrfInstance({
        crfDataId: String(row.crfDataId ?? ""),
        visitLabel: row.visitTypeName ?? "",
        crfLabel: row.crfDesignName ?? "",
      })
      setPageView("apply")
      return
    }
    if (level === "site") {
      if (row.siteId) setSelectedSiteId(String(row.siteId))
      setLockLevel("site")
      setCrfInstance(null)
      setPageView("apply")
      return
    }
    setLockLevel("study")
    setCrfInstance(null)
    setPageView("apply")
  }, [])

  const afterLockMutation = useCallback(async () => {
    bumpLocksList()
    await loadLockState()
  }, [bumpLocksList, loadLockState])

  const validateCoarseScope = () => {
    const sid = Number.parseInt(String(selectedStudyId ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0) {
      toast({ title: "Select a study", variant: "destructive" })
      return null
    }
    if (lockLevel === "site" || lockLevel === "crf") {
      const siteNum = Number.parseInt(String(selectedSiteId ?? ""), 10)
      if (!Number.isFinite(siteNum) || siteNum <= 0) {
        toast({ title: "Select a site", variant: "destructive" })
        return null
      }
    }
    if (lockLevel === "crf") {
      const crfNum = Number.parseInt(String(crfInstance?.crfDataId ?? ""), 10)
      if (!Number.isFinite(crfNum) || crfNum <= 0) {
        toast({ title: "Select a CRF instance", variant: "destructive" })
        return null
      }
    }
    return sid
  }

  const handleCoarseApply = async () => {
    const sid = validateCoarseScope()
    if (!sid) return

    setActing(true)
    try {
      const payload = { studyId: sid, level: lockLevel }
      if (lockLevel === "site" || lockLevel === "crf") {
        payload.siteId = Number.parseInt(String(selectedSiteId ?? ""), 10)
      }
      if (lockLevel === "crf") {
        payload.crfDataId = Number.parseInt(String(crfInstance?.crfDataId ?? ""), 10)
      }

      const res = await dbLockService.applyLock(payload)
      if (res?.isSuccess) {
        toast({ title: "Database lock applied", variant: "success" })
        await afterLockMutation()
        window.dispatchEvent(new CustomEvent("studySiteChanged"))
      } else {
        const { title, description } = formatDbLockFailure(res, "apply")
        toast({ title, description, variant: "destructive" })
      }
    } finally {
      setActing(false)
    }
  }

  const handleCoarseRelease = async () => {
    const sid = validateCoarseScope()
    if (!sid) return

    setActing(true)
    try {
      const payload = { studyId: sid, level: lockLevel }
      if (lockLevel === "site" || lockLevel === "crf") {
        payload.siteId = Number.parseInt(String(selectedSiteId ?? ""), 10)
      }
      if (lockLevel === "crf") {
        payload.crfDataId = Number.parseInt(String(crfInstance?.crfDataId ?? ""), 10)
      }

      const res = await dbLockService.releaseLock(payload)
      if (res?.isSuccess) {
        toast({ title: "Database lock released", variant: "success" })
        await afterLockMutation()
        window.dispatchEvent(new CustomEvent("studySiteChanged"))
      } else {
        const { title, description } = formatDbLockFailure(res, "release")
        toast({ title, description, variant: "destructive" })
      }
    } finally {
      setActing(false)
    }
  }

  const buildGranularPayload = (wholeCrf) => {
    const sid = Number.parseInt(String(selectedStudyId ?? ""), 10)
    const siteNum = Number.parseInt(String(selectedSiteId ?? ""), 10)
    const crfNum = Number.parseInt(String(crfInstance?.crfDataId ?? ""), 10)
    return {
      studyId: sid,
      siteId: siteNum,
      crfDataId: crfNum,
      wholeCrf,
      targets: wholeCrf ? [] : selectionKeysToTargets(selectedTargetKeys),
    }
  }

  const handleGranularApply = async (wholeCrf) => {
    const sid = validateCoarseScope()
    if (!sid) return
    if (!wholeCrf && selectedTargetKeys.size === 0) {
      toast({ title: "Nothing selected", description: "Select sections or fields to lock.", variant: "destructive" })
      return
    }

    setActing(true)
    try {
      const res = await dbLockService.applyLockTargets(buildGranularPayload(wholeCrf))
      if (res?.isSuccess) {
        toast({
          title: wholeCrf ? "Whole CRF locked" : "Selected targets locked",
        })
        setSelectedTargetKeys(new Set())
        await afterLockMutation()
        window.dispatchEvent(new CustomEvent("studySiteChanged"))
      } else {
        const { title, description } = formatDbLockFailure(res, "apply")
        toast({ title, description, variant: "destructive" })
      }
    } finally {
      setActing(false)
    }
  }

  const handleGranularRelease = async (wholeCrf) => {
    const sid = validateCoarseScope()
    if (!sid) return
    if (!wholeCrf && selectedTargetKeys.size === 0) {
      toast({
        title: "Nothing selected",
        description: "Select locked sections or fields to release.",
        variant: "destructive",
      })
      return
    }

    setActing(true)
    try {
      const res = await dbLockService.releaseLockTargets(buildGranularPayload(wholeCrf))
      if (res?.isSuccess) {
        toast({
          title: wholeCrf ? "Whole CRF released" : "Selected targets released",
        })
        setSelectedTargetKeys(new Set())
        await afterLockMutation()
        window.dispatchEvent(new CustomEvent("studySiteChanged"))
      } else {
        const { title, description } = formatDbLockFailure(res, "release")
        toast({ title, description, variant: "destructive" })
      }
    } finally {
      setActing(false)
    }
  }

  if (!canView) {
    return (
      <DashboardLayout>
        <div className="flex flex-1 flex-col p-4">
          <div className={cn(PANEL, "items-center justify-center p-8 text-center")}>
            <AlertTriangle className="mb-3 h-8 w-8 text-amber-600" />
            <p className="text-sm font-semibold text-slate-900">You do not have permission to view database lock.</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Database lock</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Review active locks for a study, or apply locks at study, site, or CRF level — including individual
            sections and fields. Effective lock cascades study → site → whole CRF → section → field.
          </p>
        </div>

        <div className={PANEL}>
          <div className="space-y-3 border-b border-slate-200/70 px-4 py-4 md:px-5">
            <SearchableSelect
              label="Study"
              placeholder={loadingStudies ? "Loading studies…" : "Select study"}
              options={studyOptions}
              value={selectedStudyId}
              onChange={handleStudyChange}
              disabled={loadingStudies}
              showSearch
              includeEmptyOption={studyOptions.length > 0}
            />
            {studiesLoadError ? (
              <p className="text-sm text-amber-800 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                {studiesLoadError}
              </p>
            ) : null}
            {!loadingStudies && studyOptions.length > 0 ? (
              <p className="text-xs text-slate-500">
                Studies marked <span className="font-semibold">(locked)</span> have an active database lock. Locked studies are listed first.
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {PAGE_VIEWS.map((view) => (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => setPageView(view.id)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    pageView === view.id
                      ? "bg-slate-900 text-white ring-1 ring-slate-700"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                  )}
                >
                  {view.label}
                </button>
              ))}
            </div>
          </div>

          {pageView === "active" ? (
            <ActiveLocksTable
              studyId={selectedStudyId}
              siteOptions={siteOptions}
              canApply={canApply}
              refreshToken={locksRefreshToken}
              onRowClick={handleLockListRowClick}
              onReleased={() => void loadLockState()}
            />
          ) : (
            <>
          <div className="space-y-3 border-b border-slate-200/70 px-4 py-4 md:px-5">
            <div className="flex flex-wrap gap-2">
              {COARSE_LEVELS.map((level) => (
                <button
                  key={level.id}
                  type="button"
                  onClick={() => {
                    setLockLevel(level.id)
                    setSelectedTargetKeys(new Set())
                  }}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    lockLevel === level.id
                      ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                  )}
                >
                  {level.label}
                </button>
              ))}
            </div>

            {(lockLevel === "site" || lockLevel === "crf") && (
              <SearchableSelect
                label="Site"
                placeholder={loadingSites ? "Loading sites…" : "Select site"}
                options={siteOptions}
                value={selectedSiteId}
                onChange={setSelectedSiteId}
                disabled={!selectedStudyId || loadingSites}
              />
            )}

            {lockLevel === "crf" && selectedSiteId ? (
              <CrfInstancePicker
                studyId={selectedStudyId}
                siteId={selectedSiteId}
                value={crfInstance}
                onChange={setCrfInstance}
                disabled={!selectedStudyId}
              />
            ) : null}
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-5">
            {!selectedStudyId ? (
              <p className="text-sm text-slate-600">Select a study to view lock status.</p>
            ) : loadingStatus && !lockStatus ? (
              <PageSkeleton />
            ) : (
              <>
                <PiSignoffDbLockBanner
                  pendingCount={piPendingCount}
                  pendingPatientCount={piPendingPatientCount}
                  isPiSignoffRequired={piRequiredForLock === true}
                  studyId={selectedStudyId}
                  className="mb-1"
                />

                <div
                  className={cn(
                    "rounded-2xl border px-4 py-4",
                    lockStatus?.isLocked || wholeCrfLocked || (lockTargets?.targets?.length ?? 0) > 0
                      ? "border-amber-200/80 bg-amber-50/80"
                      : "border-emerald-200/80 bg-emerald-50/60",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {lockStatus?.isLocked || wholeCrfLocked ? (
                      <Lock className="h-5 w-5 text-amber-700" />
                    ) : (
                      <Unlock className="h-5 w-5 text-emerald-700" />
                    )}
                    <p className="text-sm font-semibold text-slate-900">
                      {hasPartialGranularLock
                        ? "Partially locked"
                        : lockStatus?.isLocked || wholeCrfLocked
                          ? "Locked"
                          : "Unlocked"}
                    </p>
                    {lockStatus?.level ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600">
                        level: {lockStatus.level}
                      </span>
                    ) : null}
                    {lockLevel === "crf" && !granularApiAvailable && crfInstance?.crfDataId ? (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-800">
                        Structure API unavailable
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs text-slate-600">
                    {lockStatus?.siteId ? `Site ${lockStatus.siteId}` : null}
                    {crfInstance?.crfDataId ? ` · CRF ${crfInstance.crfDataId}` : lockStatus?.crfDataId ? ` · CRF ${lockStatus.crfDataId}` : null}
                    {structureMeta ? ` · ${structureMeta}` : null}
                    {lockStatus?.lockedAt ? ` · ${new Date(lockStatus.lockedAt).toLocaleString()}` : null}
                  </p>
                  {(lockTargets?.targets?.length ?? 0) > 0 ? (
                    <p className="mt-1 text-xs text-amber-900">
                      {lockTargets.targets.length} granular target{lockTargets.targets.length === 1 ? "" : "s"} locked
                    </p>
                  ) : null}
                </div>

                {lockLevel === "crf" && selectedSiteId ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-sm font-semibold text-slate-900">
                        {crfInstance?.crfDataId ? "Sections & fields — select targets to lock" : "Sections & fields"}
                      </h2>
                      {loadingTree ? (
                        <span className="text-xs text-slate-500">Loading CRF fields…</span>
                      ) : crfInstance?.crfDataId ? (
                        <span className="text-xs text-slate-500">
                          {sectionTree.length} sections ·{" "}
                          {sectionTree.reduce((n, s) => n + (s.fields?.length ?? 0), 0)} fields
                        </span>
                      ) : null}
                    </div>

                    {!crfInstance?.crfDataId ? (
                      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-500">
                        Select a patient and visit above. All fields for that CRF will appear here for lock selection.
                      </p>
                    ) : loadingTree ? (
                      <PageSkeleton />
                    ) : (
                      <CrfLockTargetTree
                        sectionTree={sectionTree}
                        lockedSelectionKeys={lockedSelectionKeys}
                        selectedKeys={selectedTargetKeys}
                        onSelectionChange={setSelectedTargetKeys}
                        readOnly={!canApply}
                        disabled={acting}
                        wholeCrfLocked={wholeCrfLocked}
                      />
                    )}

                    {canApply && crfInstance?.crfDataId ? (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={acting || wholeCrfLocked}
                          onClick={() => void handleGranularApply(false)}
                          className="bg-amber-600 hover:bg-amber-700"
                        >
                          {acting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Lock className="mr-1.5 h-4 w-4" />}
                          Lock selected
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={acting}
                          onClick={() => void handleGranularApply(true)}
                        >
                          Lock whole CRF
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={acting || (!wholeCrfLocked && selectedTargetKeys.size === 0)}
                          onClick={() => void handleGranularRelease(wholeCrfLocked)}
                        >
                          {acting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Unlock className="mr-1.5 h-4 w-4" />}
                          Release selected / whole
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {canApply && lockLevel !== "crf" ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={acting || lockStatus?.isLocked}
                      onClick={() => void handleCoarseApply()}
                      className="bg-amber-600 hover:bg-amber-700"
                    >
                      {acting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Lock className="mr-1.5 h-4 w-4" />}
                      Apply lock
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={acting || !lockStatus?.isLocked}
                      onClick={() => void handleCoarseRelease()}
                    >
                      {acting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Unlock className="mr-1.5 h-4 w-4" />}
                      Release lock
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}

export default function DatabaseLockPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DatabaseLockPageContent />
    </Suspense>
  )
}
