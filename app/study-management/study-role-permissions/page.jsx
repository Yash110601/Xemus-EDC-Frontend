"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import StudyRolePermissionMatrix from "@/components/study-permissions/StudyRolePermissionMatrix"
import CreateRoleDialog from "@/components/study-permissions/CreateRoleDialog"
import SearchableSelect from "@/components/ui/searchable-select"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useStudySiteContext } from "@/hooks/useStudySiteContext"
import { authService, rolesService, studyService, studyPermissionService, permissionsService } from "@/lib/services"
import {
  buildStudyNavModuleCatalogFromFeaturesApi,
  buildStudyNavModuleCatalogFromMenu,
  flattenNavModuleCatalog,
} from "@/lib/permissions/buildStudyNavModuleCatalog"
import { mergeNavModuleKeysIntoMatrix, prepareStudyMatrixSavePayload } from "@/lib/utils/studyNavPermissions"
import { isStudyPermissionMatrixPlatformEnabled } from "@/lib/permissions/isStudyPermissionMatrixEnabled"
import useStudyRolePermissionMode from "@/hooks/useStudyRolePermissionMode"
import { mapRolesForMatrix } from "@/lib/permissions/mapRolesForMatrix"
import { resolveRouteMenuPermissions } from "@/lib/utils/menuRoutePermissions"
import { cn } from "@/lib/utils"
import { AlertTriangle, CheckCircle2, Loader2, Plus, RotateCcw, Save, ShieldCheck } from "lucide-react"

const PANEL =
  "flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] backdrop-blur-md"

const getStudyId = (study) =>
  study?.studyId ?? study?.StudyId ?? study?.id ?? study?.Id ?? null

const getStudyLabel = (study) => {
  const protocol =
    study?.studyProtocolNumber ??
    study?.StudyProtocolNumber ??
    study?.protocolNumber ??
    study?.name ??
    ""
  const title = study?.studyTitle ?? study?.StudyTitle ?? ""
  if (protocol && title) return `${protocol} — ${title}`
  return protocol || title || `Study ${getStudyId(study) ?? ""}`
}

function MatrixPageSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4" role="status" aria-busy="true" aria-label="Loading role permissions">
      <Skeleton className="h-10 w-full max-w-md rounded-xl bg-slate-200/60" />
      <Skeleton className="h-24 w-full rounded-2xl bg-slate-200/50" />
      <Skeleton className="min-h-[420px] flex-1 rounded-2xl bg-slate-200/40" />
    </div>
  )
}

function StudyRolePermissionsPageContent() {
  const { toast } = useToast()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const matrixFlagEnabled = isStudyPermissionMatrixPlatformEnabled()
  const { studyId: workspaceStudyId, siteId: workspaceSiteId } = useStudySiteContext()

  const routePerm = useMemo(
    () => resolveRouteMenuPermissions(authService.getMenu?.(), pathname),
    [pathname],
  )

  const [studies, setStudies] = useState([])
  const [roles, setRoles] = useState([])
  const [loadingStudies, setLoadingStudies] = useState(true)
  const [loadingRoles, setLoadingRoles] = useState(true)
  const [loadingMatrix, setLoadingMatrix] = useState(false)
  const [saving, setSaving] = useState(false)
  const [matrixSource, setMatrixSource] = useState("default")
  const [matrixPersisted, setMatrixPersisted] = useState(false)
  const [matrixLoadedFromApi, setMatrixLoadedFromApi] = useState(false)
  const [matrix, setMatrix] = useState({})
  const [enforcementMeta, setEnforcementMeta] = useState(null)
  const [loadingEnforcement, setLoadingEnforcement] = useState(false)
  const [createRoleOpen, setCreateRoleOpen] = useState(false)
  const [highlightedRoleGuid, setHighlightedRoleGuid] = useState("")
  const [navModuleGroups, setNavModuleGroups] = useState([])
  const [selectedStudyId, setSelectedStudyId] = useState(() => {
    const fromUrl = searchParams.get("studyId")
    return fromUrl ? String(fromUrl) : ""
  })
  const { enabled: selectedStudyUsesMatrix } = useStudyRolePermissionMode(selectedStudyId)

  const canView = routePerm.canView
  const canSave = routePerm.canEdit || routePerm.canAdd

  const studyOptions = useMemo(
    () =>
      studies.map((study) => {
        const id = getStudyId(study)
        return { value: String(id ?? ""), label: getStudyLabel(study) }
      }),
    [studies],
  )

  const matrixRoles = useMemo(() => mapRolesForMatrix(roles), [roles])

  const navModulePermissions = useMemo(
    () => flattenNavModuleCatalog(navModuleGroups),
    [navModuleGroups],
  )

  const matrixForEditor = useMemo(
    () => mergeNavModuleKeysIntoMatrix(matrix, navModulePermissions, { defaultValue: false }),
    [matrix, navModulePermissions],
  )

  const applyMatrixResponse = useCallback(
    (res) => {
      if (!res) return
      setMatrix(res.matrix ?? {})
      setMatrixSource(res.source ?? "default")
      setMatrixPersisted(Boolean(res.isPersisted))
      setMatrixLoadedFromApi(Boolean(res.isSuccess))
    },
    [],
  )

  const loadStudies = useCallback(async () => {
    setLoadingStudies(true)
    try {
      const res = await studyService.getStudiesForDropdown()
      const list = res?.data ?? []
      setStudies(Array.isArray(list) ? list : [])
    } finally {
      setLoadingStudies(false)
    }
  }, [])

  const loadRoles = useCallback(async () => {
    setLoadingRoles(true)
    try {
      const res = await rolesService.getRolesForDropdown()
      const list = res?.data ?? []
      const normalized = Array.isArray(list) ? list : []
      setRoles(normalized)
      return normalized
    } finally {
      setLoadingRoles(false)
    }
  }, [])

  const loadMatrix = useCallback(
    async (studyId) => {
      const sid = Number.parseInt(String(studyId ?? ""), 10)
      if (!Number.isFinite(sid) || sid <= 0) {
        setMatrix({})
        setMatrixSource("default")
        setMatrixPersisted(false)
        setMatrixLoadedFromApi(false)
        return null
      }

      setLoadingMatrix(true)
      try {
        const res = await studyPermissionService.getRolePermissionMatrix(sid)
        applyMatrixResponse(res)
        return res
      } finally {
        setLoadingMatrix(false)
      }
    },
    [applyMatrixResponse],
  )

  useEffect(() => {
    void loadStudies()
    void loadRoles()
  }, [loadStudies, loadRoles])

  useEffect(() => {
    let cancelled = false

    const loadNavCatalog = async () => {
      const catalogRes = await studyPermissionService.getNavModuleCatalog()
      if (!cancelled && catalogRes?.isSuccess && Array.isArray(catalogRes.data) && catalogRes.data.length) {
        setNavModuleGroups(buildStudyNavModuleCatalogFromFeaturesApi(catalogRes.data))
        return
      }

      const fromMenu = buildStudyNavModuleCatalogFromMenu(authService.getMenu?.())
      if (fromMenu.length) {
        if (!cancelled) setNavModuleGroups(fromMenu)
        return
      }

      const res = await permissionsService.getAllFeaturesAndSubFeatures()
      if (!cancelled && res?.isSuccess && Array.isArray(res.data) && res.data.length) {
        setNavModuleGroups(buildStudyNavModuleCatalogFromFeaturesApi(res.data))
      }
    }

    void loadNavCatalog()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    void loadMatrix(selectedStudyId)
  }, [selectedStudyId, loadMatrix])

  const refreshEnforcement = useCallback(async (studyId) => {
    const sid = Number.parseInt(String(studyId ?? ""), 10)
    if (!matrixFlagEnabled || !Number.isFinite(sid) || sid <= 0) {
      setEnforcementMeta(null)
      setLoadingEnforcement(false)
      return
    }

    const workspaceSid = Number.parseInt(String(workspaceStudyId ?? ""), 10)
    const previewSiteId =
      Number.isFinite(workspaceSid) && workspaceSid === sid ? workspaceSiteId : null

    setLoadingEnforcement(true)
    try {
      const res = await studyPermissionService.getEffectivePermissions(sid, previewSiteId)
      setEnforcementMeta({
        ready: Boolean(res?.isSuccess && res?.enforcementReady !== false && res?.data != null),
        roleName: res?.roleName ?? null,
        source: res?.permissionSource ?? null,
        previewSiteId: previewSiteId ?? null,
        crfView: res?.data?.["crf.view"] === true,
        crfModuleShow: res?.data?.["module.crf.show"] === true,
        reportsModuleShow: res?.data?.["module.reports.show"] === true,
        message: res?.isSuccess ? null : res?.message ?? "Effective permissions unavailable",
      })
    } finally {
      setLoadingEnforcement(false)
    }
  }, [matrixFlagEnabled, workspaceStudyId, workspaceSiteId])

  useEffect(() => {
    void refreshEnforcement(selectedStudyId)
  }, [selectedStudyId, refreshEnforcement])

  const handleStudyChange = (value) => {
    const next = String(value ?? "")
    setSelectedStudyId(next)
    const params = new URLSearchParams(searchParams.toString())
    if (next) params.set("studyId", next)
    else params.delete("studyId")
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const handleMatrixChange = (roleGuid, permissionKey, allowed) => {
    setMatrix((prev) => ({
      ...prev,
      [roleGuid]: {
        ...(prev[roleGuid] ?? {}),
        [permissionKey]: allowed,
      },
    }))
  }

  const handleResetDefaults = async () => {
    const sid = Number.parseInt(String(selectedStudyId ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0) {
      toast({ variant: "destructive", title: "Select a study", description: "Choose a study before reloading the matrix." })
      return
    }

    const res = await loadMatrix(sid)
    if (res?.isSuccess) {
      toast({
        title: "Reloaded from server",
        description: "Matrix refreshed with current roles and API defaults for this study.",
      })
      return
    }

    toast({
      variant: "destructive",
      title: "Reload failed",
      description: res?.message || "Could not reload matrix from the API.",
    })
  }

  const handleRoleCreated = async (role) => {
    const roleGuid = String(role?.guid ?? role?.Guid ?? "").trim()
    const roleName = String(role?.name ?? role?.Name ?? "Role").trim()

    if (roleGuid) {
      setHighlightedRoleGuid(roleGuid.toLowerCase())
    }

    await loadRoles()

    const sid = Number.parseInt(String(selectedStudyId ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0) {
      toast({
        title: "Role created",
        description: `${roleName} is ready. Select a study to configure permissions, then Save matrix.`,
      })
      return
    }

    const matrixRes = await loadMatrix(sid)
    if (!matrixRes?.isSuccess || !matrixRes.matrix) {
      toast({
        variant: "destructive",
        title: "Role created",
        description: `${roleName} was added, but the matrix could not be refreshed. Try reloading the page.`,
      })
      return
    }

    if (!canSave) {
      toast({
        title: "Role created",
        description: `${roleName} added to the matrix. You need edit access to save study permissions.`,
      })
      return
    }

    setSaving(true)
    try {
      const saveRes = await studyPermissionService.saveRolePermissionMatrix(
        sid,
        prepareStudyMatrixSavePayload(matrixRes.matrix, navModulePermissions, matrixRoles),
      )
      if (saveRes?.isSuccess) {
        setMatrixSource("persisted")
        setMatrixPersisted(true)
        await loadMatrix(sid)
        await refreshEnforcement(sid)
        window.dispatchEvent(new CustomEvent("studySiteChanged"))
        window.dispatchEvent(
          new CustomEvent("studyPermissionMatrixUpdated", { detail: { studyId: sid } }),
        )
        toast({
          title: "Role created & saved",
          description: `${roleName} is in this study matrix with server defaults. Assign users to this role on the study.`,
        })
        return
      }

      toast({
        title: "Role created",
        description: `${roleName} is in the grid. Save failed — adjust toggles and click Save matrix.`,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    const sid = Number.parseInt(String(selectedStudyId ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0) {
      toast({ variant: "destructive", title: "Select a study", description: "Choose a study before saving." })
      return
    }

    setSaving(true)
    try {
      const payload = prepareStudyMatrixSavePayload(matrix, navModulePermissions, matrixRoles)
      const res = await studyPermissionService.saveRolePermissionMatrix(sid, payload)
      if (res?.isSuccess) {
        setMatrixSource("persisted")
        setMatrixPersisted(true)
        await loadMatrix(sid)
        await refreshEnforcement(sid)
        window.dispatchEvent(new CustomEvent("studySiteChanged"))
        window.dispatchEvent(
          new CustomEvent("studyPermissionMatrixUpdated", { detail: { studyId: sid } }),
        )
        toast({ title: "Saved", description: res.message || "Permission matrix saved." })
        return
      }

      const isNotImplemented = res?.statusCode === 501
      toast({
        variant: "destructive",
        title: isNotImplemented ? "Save not available on this environment" : "Save failed",
        description:
          res?.message ||
          (isNotImplemented
            ? "Backend AllowSave is false (typical on UAT/PROD until release). Matrix edits were not persisted."
            : "Could not save permission matrix."),
      })
    } finally {
      setSaving(false)
    }
  }

  const matrixStatus = useMemo(() => {
    if (!selectedStudyId) {
      return {
        tone: "neutral",
        title: "Select a study",
        detail: matrixFlagEnabled
          ? "Choose a study to load and edit its role permission matrix."
          : "Feature flag is OFF — enable NEXT_PUBLIC_STUDY_PERMISSION_MATRIX_ENABLED for runtime gates.",
      }
    }

    if (loadingMatrix || loadingEnforcement) {
      return {
        tone: "neutral",
        title: "Loading study permissions…",
        detail: "Fetching matrix and runtime enforcement status from the API.",
      }
    }

    if (!matrixLoadedFromApi) {
      return {
        tone: "warn",
        title: "Matrix API unavailable",
        detail:
          "Could not load GetRolePermissionMatrix. Confirm backend is running, migrations are applied, and you are logged in.",
      }
    }

    const roleSuffix = enforcementMeta?.roleName ? ` for ${enforcementMeta.roleName}` : ""
    const siteSuffix = enforcementMeta?.previewSiteId
      ? ` at site ${enforcementMeta.previewSiteId}`
      : " (study-level preview — select a site in the header to match eCRF)"
    const crfViewSuffix =
      enforcementMeta?.ready && enforcementMeta.crfView === false
        ? " Your effective permissions currently deny crf.view — enable View CRF for the role shown, and confirm the user’s study assignment role in User Creation matches that column."
        : ""
    const moduleSuffix =
      enforcementMeta?.ready && enforcementMeta.crfModuleShow === false
        ? " Module visibility denies eCRF in the sidebar for your assignment role — enable Show eCRF / Data entry under Module visibility."
        : ""

    if (matrixPersisted) {
      return {
        tone: matrixFlagEnabled && enforcementMeta?.ready ? "ok" : "warn",
        title: "Custom matrix saved for this study",
        detail: matrixFlagEnabled
          ? selectedStudyUsesMatrix
            ? enforcementMeta?.ready
            ? `Runtime enforcement is active${roleSuffix}${siteSuffix}.${moduleSuffix}${crfViewSuffix} eCRF uses the study user assignment role at the selected site, not the login role alone.`
            : enforcementMeta?.message
              ? `Saved matrix loaded, but runtime enforcement is not ready: ${enforcementMeta.message}`
              : "Saved matrix loaded. GetEffectivePermissions did not return data for your user on this study."
            : `Saved matrix loaded. Enable "Use study role permission matrix" in Study Settings for this study to enforce these toggles at runtime.`
          : "Matrix is saved on the server. Platform matrix flag is disabled — set NEXT_PUBLIC_STUDY_PERMISSION_MATRIX_ENABLED (not false) to allow per-study enforcement.",
        showFlagLine: !matrixFlagEnabled || !enforcementMeta?.ready,
      }
    }

    if (matrixFlagEnabled && enforcementMeta?.ready) {
      return {
        tone: "ok",
        title: "Default matrix in use — enforcement active",
        detail: `This study has no custom saved matrix yet. The platform default rules apply${roleSuffix}${siteSuffix}.${moduleSuffix}${crfViewSuffix}`,
        showFlagLine: false,
      }
    }

    return {
      tone: "warn",
      title: matrixSource === "default" ? "Default matrix loaded" : `Matrix loaded (${matrixSource})`,
      detail: matrixFlagEnabled
        ? enforcementMeta?.message
          ? `Runtime enforcement not ready: ${enforcementMeta.message}`
          : "Matrix loaded from API, but GetEffectivePermissions did not return permission data for your user."
        : "Enable NEXT_PUBLIC_STUDY_PERMISSION_MATRIX_ENABLED for runtime gates.",
      showFlagLine: true,
    }
  }, [
    selectedStudyId,
    selectedStudyUsesMatrix,
    matrixFlagEnabled,
    matrixLoadedFromApi,
    matrixPersisted,
    matrixSource,
    enforcementMeta,
    loadingEnforcement,
    loadingMatrix,
  ])

  if (!canView) {
    return (
      <DashboardLayout>
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-slate-500">
          You do not have permission to view this page.
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="flex h-full min-h-0 flex-col gap-4 p-4 md:p-6">
        <header className="shrink-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-slate-900">
                <ShieldCheck className="h-5 w-5 text-emerald-600" strokeWidth={1.75} />
                Study role permissions
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                Top section: <strong className="font-medium text-slate-700">View · Add · Edit · Delete · Export</strong>{" "}
                per menu item (like Masters → Role Permission), study-specific. Lower section: eCRF/query/SDV runtime
                actions inside those modules.
              </p>
              {!loadingRoles ? (
                <p className="mt-1 text-xs text-slate-400">
                  {matrixRoles.length} role(s) in matrix (Super Admin excluded — has all permissions globally)
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canSave ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loadingRoles}
                  onClick={() => setCreateRoleOpen(true)}
                  className="rounded-xl"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add role
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!matrixRoles.length || loadingMatrix}
                onClick={handleResetDefaults}
                className="rounded-xl"
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Reload from server
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!canSave || !selectedStudyId || saving}
                onClick={handleSave}
                className="rounded-xl bg-violet-600 hover:bg-violet-700"
              >
                {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                Save matrix
              </Button>
            </div>
          </div>
        </header>

        <div
          className={cn(
            "flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm",
            matrixStatus.tone === "ok"
              ? "border-emerald-200/80 bg-emerald-50/60 text-emerald-900"
              : matrixStatus.tone === "warn"
                ? "border-amber-200/80 bg-amber-50/70 text-amber-950"
                : "border-slate-200/80 bg-slate-50/80 text-slate-700",
          )}
        >
          {matrixStatus.tone === "ok" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 opacity-90" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
          )}
          <div>
            <p className="font-medium">{matrixStatus.title}</p>
            <p className="mt-0.5 text-xs opacity-90">{matrixStatus.detail}</p>
            {matrixStatus.showFlagLine !== false && (
              <p className="mt-1.5 text-xs opacity-80">
                Feature flag{" "}
                <code className="rounded bg-white/60 px-1 py-0.5">NEXT_PUBLIC_STUDY_PERMISSION_MATRIX_ENABLED</code>{" "}
                is {matrixFlagEnabled ? "ON" : "OFF"}.
                {!matrixFlagEnabled
                  ? " eCRF and reports continue to use legacy role rules until the flag is enabled."
                  : null}
              </p>
            )}
          </div>
        </div>

        <div className={PANEL}>
          <div className="shrink-0 border-b border-slate-200/70 px-4 py-4 md:px-5">
            {loadingStudies ? (
              <Skeleton className="h-11 w-full max-w-lg rounded-xl bg-slate-200/60" aria-hidden />
            ) : (
              <SearchableSelect
                value={selectedStudyId}
                options={studyOptions}
                onChange={handleStudyChange}
                placeholder="Select study…"
                showSearch
                searchIconPosition="end"
                includeEmptyOption
                emptyOptionLabel="Select study"
                className="min-h-[44px] max-w-lg rounded-xl border-0 bg-slate-50/90 px-3 py-2.5 text-sm shadow-sm ring-1 ring-slate-200/70"
                contentClassName="z-[180]"
              />
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-4 md:p-5">
            {loadingRoles || loadingMatrix ? (
              <MatrixPageSkeleton />
            ) : !matrixRoles.length ? (
              <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-14 text-center">
                <p className="max-w-md text-sm text-slate-600">
                  No roles yet. Use <strong>Add role</strong> to create the first role — this is the only place
                  to add roles for study permissions.
                </p>
                {canSave ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setCreateRoleOpen(true)}
                    className="rounded-xl bg-violet-600 hover:bg-violet-700"
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add role
                  </Button>
                ) : null}
              </div>
            ) : !selectedStudyId ? (
              <div className="space-y-4">
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-500">
                  Select a study above to load and edit permissions for {matrixRoles.length} role(s).
                </p>
                <div className="rounded-xl border border-slate-200/70 bg-white px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Roles on server</p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {matrixRoles.map((role) => (
                      <li
                        key={role.roleGuid}
                        className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                      >
                        {role.roleName}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <StudyRolePermissionMatrix
                roles={matrixRoles}
                matrix={matrixForEditor}
                navModuleGroups={navModuleGroups}
                onChange={handleMatrixChange}
                readOnly={!canSave}
                highlightRoleGuid={highlightedRoleGuid}
              />
            )}
          </div>
        </div>
      </div>

      <CreateRoleDialog
        open={createRoleOpen}
        onOpenChange={setCreateRoleOpen}
        onCreated={handleRoleCreated}
      />
    </DashboardLayout>
  )
}

export default function StudyRolePermissionsPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <MatrixPageSkeleton />
        </DashboardLayout>
      }
    >
      <StudyRolePermissionsPageContent />
    </Suspense>
  )
}
