"use client"

import { VIEWPORT_PAGE_SHELL_WITH_EMERALD_BG_CLASS } from "@/lib/ui/responsivePageUi"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import StudyDailyEmailPanel from "@/components/study-settings/StudyDailyEmailPanel"
import StudySettingsSkeleton from "@/components/ui/study-settings-skeleton"
import { Skeleton } from "@/components/ui/skeleton"
import SearchableSelect from "@/components/ui/searchable-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { authService, rolesService, studyService, studySettingsService } from "@/lib/services"
import { resolveRouteMenuPermissions } from "@/lib/utils/menuRoutePermissions"
import {
  clearSystemSiteSettingsOverlay,
  mergeSystemSiteSettingsOverlay,
  persistSystemSiteSettingsOverlay,
} from "@/lib/utils/systemSiteSettingsOverlay"
import {
  clearPatientIdentifierSettingsOverlay,
  DEFAULT_SCREENING_NUMBER_MASK,
} from "@/lib/utils/patientIdentifierSettingsOverlay"
import {
  isValidYouTubeUrl,
  mergeStudyDocumentsSettingsOverlay,
  persistStudyDocumentsSettingsOverlay,
} from "@/lib/utils/studyDocumentsSettingsOverlay"
import { previewScreeningNumberMask } from "@/lib/utils/patientIdentifierSettings"
import {
  clearStudySettingsCache,
  fetchStudySettingsByStudyId,
  hasStudySettingsSummary,
  mergeAllStudySettingsOverlays,
  pickQueryRaiseRoleGuidsFromSettings,
  pickRequireSdvForPaymentRules,
  pickReviewOrderFromSettings,
  pickPiSignoffGranularityFromSettings,
  pickPiSignoffRoleGuidsFromSettings,
  pickSdvRoleGuidsFromSettings,
  pickRsdvRoleGuidsFromSettings,
  pickIsRemoteSdvEnabled,
  pickAllowRsdvReopen,
  pickRsdvMarksSdvOnComplete,
  pickRsdvRequireResolvedFindings,
  pickStudyDocShowRoleGuidsFromSettings,
  pickIsStudyDocumentsEnabled,
  pickDemoVideoUrlFromSettings,
  pickUseStudyRolePermissionMatrix,
  pickIsSystemSiteCreationEnabled,
  pickIsSystemSiteNamingCustomizable,
  pickSystemSiteCountFromSettings,
  pickSystemSiteNamePrefixFromSettings,
  pickIsScreeningNumberEnabled,
  pickIsScreeningNumberMaskCustomizable,
  pickScreeningNumberMaskFromSettings,
  pickIsRandomizationNumberEnabled,
  pickIsSitePaymentEnabled,
  pickStudyAiSettings,
  pickIsCdashEnabled,
  pickIsPiSignoffRequired,
  pickIsPiSignoffEmailNotificationsEnabled,
  pickIsPiSignoffBulkEnabled,
} from "@/lib/utils/studySettingsRead"
import {
  DEFAULT_SYSTEM_SITE_PREFIX,
  previewSystemSiteCodes,
} from "@/lib/utils/systemSiteNaming"
import { piSignoffGranularityLabel } from "@/lib/piSignoff/piSignoffReadiness"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  Settings2,
  Save,
  Loader2,
  RotateCcw,
  Users,
  CalendarClock,
  Layers,
  FileSignature,
  FileCheck,
  FileSearch,
  FileText,
  X,
  IndianRupee,
  ClipboardList,
  Shield,
  MapPin,
  Hash,
  Mail,
  Sparkles,
  Database,
} from "lucide-react"

const EMPTY_GUID = "00000000-0000-0000-0000-000000000000"

const DEFAULT_FORM = {
  isPatientStatusEnabled: false,
  isMultiCrfAllowedPerVisitType: false,
  isVisitDateRestriction: false,
  queryRaiseRoleGuids: [],
  sdvRoleGuids: [],
  rsdvRoleGuids: [],
  piSignoffRoleGuids: [],
  isAgreementEnabled: false,
  isSitePaymentEnabled: true,
  isRemoteSdvEnabled: false,
  allowRsdvReopen: false,
  rsdvMarksSdvOnComplete: false,
  rsdvRequireResolvedFindings: false,
  isPiSignoffRequired: false,
  isPiSignoffEmailNotificationsEnabled: false,
  isPiSignoffBulkEnabled: false,
  isDelegationLogEnabled: false,
  isEConsentRequired: false,
  isCdashEnabled: false,
  requireSdvForPaymentRules: false,
  studyDocShowRoleGuids: [],
  isStudyDocumentsEnabled: false,
  demoVideoUrl: "",
  reviewOrder: "sdv_before_sign",
  piSignoffGranularity: "crf_only",
  useStudyRolePermissionMatrix: false,
  isSystemSiteCreationEnabled: false,
  isSystemSiteNamingCustomizable: false,
  systemSiteNamePrefix: DEFAULT_SYSTEM_SITE_PREFIX,
  systemSiteCount: 10,
  isScreeningNumberEnabled: false,
  isScreeningNumberMaskCustomizable: false,
  screeningNumberMask: DEFAULT_SCREENING_NUMBER_MASK,
  isRandomizationNumberEnabled: false,
  isXemusIntelligenceEnabled: false,
  isAiEntryEnabled: false,
  isAiRsdvVerifyEnabled: false,
  isAiQueryCopilotEnabled: false,
  isAiCrfStudioEnabled: false,
  isAiQualityHintsEnabled: false,
  isAiCodingAssistEnabled: false,
  isAiInsightEnabled: false,
  isAiConsentAssistEnabled: false,
}

const REVIEW_ORDER_OPTIONS = [
  {
    value: "sdv_before_sign",
    title: "SDV before PI sign-off",
    description: "Default — PI can sign only after SDV is verified and queries are closed.",
  },
  {
    value: "sign_before_sdv",
    title: "PI sign-off before SDV",
    description: "PI may sign submitted CRFs before SDV verification.",
  },
]

const PI_SIGNOFF_GRANULARITY_OPTIONS = [
  {
    value: "crf_only",
    title: "Overall CRF only",
    description: "One PI signature per submitted CRF. No per-field PI checkboxes on eCRF.",
  },
  {
    value: "field_and_crf",
    title: "Field + CRF",
    description: "PI signs eligible fields first, then applies the overall CRF sign-off.",
  },
]

const PANEL =
  "flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] backdrop-blur-md"

const pickField = (obj, ...keys) => {
  if (!obj || typeof obj !== "object") return undefined
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key]
  }
  return undefined
}

const toBool = (raw) => {
  const normalized = String(raw ?? "").trim().toLowerCase()
  return raw === true || raw === 1 || normalized === "true" || normalized === "1" || normalized === "yes"
}

const isValidRoleGuid = (guid) => {
  const value = String(guid ?? "").trim()
  return Boolean(value) && value !== EMPTY_GUID
}

const formatRoleGuidsForApi = (guids = []) =>
  [...new Set((guids || []).map((g) => String(g).trim()).filter(isValidRoleGuid))]

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

const hasSettingsRecord = (data) => {
  if (hasStudySettingsSummary(data)) return true
  if (!data || typeof data !== "object") return false
  return (
    pickField(data, "studyDocShowRoleGuids", "StudyDocShowRoleGuids") !== undefined ||
    pickField(data, "queryRaiseRoleGuids", "QueryRaiseRoleGuids") !== undefined ||
    pickField(data, "sdvRoleGuids", "SdvRoleGuids") !== undefined ||
    pickField(data, "useStudyRolePermissionMatrix", "UseStudyRolePermissionMatrix") !== undefined
  )
}

function SectionTitle({ title, subtitle }) {
  return (
    <div className="mb-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{title}</h2>
      {subtitle ? <p className="mt-0.5 break-words text-xs leading-relaxed text-slate-500">{subtitle}</p> : null}
    </div>
  )
}

function SettingToggle({ icon: Icon, title, description, checked, onChange, disabled, className = "" }) {
  return (
    <div
      className={`flex flex-col gap-2.5 rounded-2xl bg-slate-50/90 px-3 py-3 ring-1 ring-slate-200/60 transition-all duration-200 hover:bg-white hover:ring-slate-300/80 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4 sm:py-3 ${className}`.trim()}
    >
      <div className="flex min-w-0 items-start gap-2.5 sm:items-center sm:gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm ring-1 ring-slate-200/60 sm:h-9 sm:w-9">
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium leading-snug text-slate-900">{title}</p>
          {description ? (
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 sm:line-clamp-2">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 justify-end sm:pl-2">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={title}
          disabled={disabled}
          onClick={() => !disabled && onChange(!checked)}
          className={`relative h-7 w-[52px] shrink-0 rounded-full transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 focus-visible:ring-offset-2 disabled:opacity-40 ${
            checked ? "bg-violet-600" : "bg-slate-300"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
              checked ? "translate-x-[22px]" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </div>
  )
}

function RoleMultiSelectCard({
  title,
  description,
  selectedGuids = [],
  roleOptions = [],
  onChange,
  disabled,
  loading,
  emptyHint = "No roles selected — API receives an empty array (legacy fallback).",
  className = "",
}) {
  const availableToAdd = roleOptions.filter(
    (opt) => opt.value && !selectedGuids.includes(opt.value),
  )

  const labelByGuid = useMemo(() => {
    const map = new Map(roleOptions.map((o) => [o.value, o.label]))
    return (guid) => map.get(guid) || guid
  }, [roleOptions])

  return (
    <div className={`rounded-2xl bg-slate-50/90 p-3 ring-1 ring-slate-200/60 sm:p-4 ${className}`.trim()}>
      <p className="mb-0.5 text-[13px] font-medium text-slate-900">{title}</p>
      {description ? <p className="mb-2.5 text-[11px] leading-snug text-slate-500">{description}</p> : <div className="mb-2.5" />}
      {loading ? (
        <Skeleton className="h-10 w-full rounded-xl bg-slate-200/60" aria-hidden />
      ) : (
        <>
          <SearchableSelect
            value=""
            options={availableToAdd}
            onChange={(guid) => {
              if (!guid || disabled || selectedGuids.includes(guid)) return
              onChange([...selectedGuids, guid])
            }}
            placeholder={
              availableToAdd.length ? "Add role…" : selectedGuids.length ? "All roles added" : "No roles available"
            }
            disabled={disabled || availableToAdd.length === 0}
            showSearch
            searchIconPosition="end"
            includeEmptyOption={false}
            className="min-h-[44px] rounded-xl border-0 bg-white px-3 py-2.5 text-sm shadow-sm ring-1 ring-slate-200/70"
            contentClassName="z-[180]"
          />
          {selectedGuids.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {selectedGuids.map((guid) => (
                <span
                  key={guid}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200/80"
                >
                  <span className="truncate">{labelByGuid(guid)}</span>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => onChange(selectedGuids.filter((id) => id !== guid))}
                      className="rounded-full p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      aria-label={`Remove ${labelByGuid(guid)}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-400">{emptyHint}</p>
          )}
        </>
      )}
    </div>
  )
}

function StudySettingsPageContent() {
  const { toast } = useToast()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const routePerm = useMemo(
    () => resolveRouteMenuPermissions(authService.getMenu?.(), pathname),
    [pathname],
  )

  const [studies, setStudies] = useState([])
  const [roles, setRoles] = useState([])
  const [loadingStudies, setLoadingStudies] = useState(true)
  const [loadingRoles, setLoadingRoles] = useState(true)
  const [selectedStudyId, setSelectedStudyId] = useState(() => {
    const fromUrl = searchParams.get("studyId")
    return fromUrl ? String(fromUrl) : ""
  })
  const [settingsExist, setSettingsExist] = useState(false)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [settingsLoadError, setSettingsLoadError] = useState(null)
  const [saving, setSaving] = useState(false)

  const screeningNumberPreview = useMemo(() => {
    if (!form.isScreeningNumberEnabled) return ""
    const mask = form.isScreeningNumberMaskCustomizable
      ? String(form.screeningNumberMask || "").trim() || DEFAULT_SCREENING_NUMBER_MASK
      : DEFAULT_SCREENING_NUMBER_MASK
    const studyLabel =
      studies.find((s) => String(getStudyId(s)) === String(selectedStudyId))?.studyProtocolNumber ||
      "STUDY"
    return previewScreeningNumberMask(mask, { study: studyLabel, site: "101", seq: 1 })
  }, [
    form.isScreeningNumberEnabled,
    form.isScreeningNumberMaskCustomizable,
    form.screeningNumberMask,
    selectedStudyId,
    studies,
  ])

  const systemSitePreview = useMemo(() => {
    if (!form.isSystemSiteCreationEnabled) return []
    const prefix = form.isSystemSiteNamingCustomizable
      ? String(form.systemSiteNamePrefix || "").trim() || DEFAULT_SYSTEM_SITE_PREFIX
      : DEFAULT_SYSTEM_SITE_PREFIX
    return previewSystemSiteCodes(form.systemSiteCount, prefix)
  }, [
    form.isSystemSiteCreationEnabled,
    form.isSystemSiteNamingCustomizable,
    form.systemSiteNamePrefix,
    form.systemSiteCount,
  ])

  const canSave = settingsExist ? routePerm.canEdit : routePerm.canAdd
  const canView = routePerm.canView

  const studyIdFromUrl = useMemo(() => {
    const fromUrl = searchParams.get("studyId")
    return fromUrl ? String(fromUrl) : ""
  }, [searchParams])

  const settingsTab = useMemo(() => {
    const tab = searchParams.get("tab")
    return tab === "daily-email" ? "daily-email" : "general"
  }, [searchParams])

  const selectedStudyLabel = useMemo(() => {
    const study = studies.find((s) => String(getStudyId(s)) === String(selectedStudyId))
    return study ? getStudyLabel(study) : ""
  }, [studies, selectedStudyId])

  const handleSettingsTabChange = useCallback(
    (tab) => {
      const params = new URLSearchParams(searchParams?.toString() || "")
      if (tab === "daily-email") params.set("tab", "daily-email")
      else params.delete("tab")
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const studyOptions = useMemo(
    () =>
      studies.map((study) => {
        const id = getStudyId(study)
        return { value: String(id ?? ""), label: getStudyLabel(study) }
      }),
    [studies],
  )

  const roleOptionsFromApi = useMemo(
    () =>
      roles.map((role) => ({
        value: String(role.guid ?? role.roleGuid ?? role.id ?? ""),
        label: String(role.name ?? role.roleName ?? "Role"),
      })),
    [roles],
  )

  const applySettingsPayload = useCallback((payload) => {
    const data = payload?.data ?? payload ?? {}
    setForm({
      isPatientStatusEnabled: toBool(pickField(data, "isPatientStatusEnabled", "IsPatientStatusEnabled")),
      isMultiCrfAllowedPerVisitType: toBool(
        pickField(data, "isMultiCrfAllowedPerVisitType", "IsMultiCrfAllowedPerVisitType"),
      ),
      isVisitDateRestriction: toBool(pickField(data, "isVisitDateRestriction", "IsVisitDateRestriction")),
      queryRaiseRoleGuids: pickQueryRaiseRoleGuidsFromSettings(data),
      sdvRoleGuids: pickSdvRoleGuidsFromSettings(data),
      rsdvRoleGuids: pickRsdvRoleGuidsFromSettings(data),
      piSignoffRoleGuids: pickPiSignoffRoleGuidsFromSettings(data),
      isAgreementEnabled: toBool(pickField(data, "isAgreementEnabled", "IsAgreementEnabled")),
      isSitePaymentEnabled: pickIsSitePaymentEnabled(data),
      isRemoteSdvEnabled: pickIsRemoteSdvEnabled(data),
      allowRsdvReopen: pickAllowRsdvReopen(data),
      rsdvMarksSdvOnComplete: pickRsdvMarksSdvOnComplete(data),
      rsdvRequireResolvedFindings: pickRsdvRequireResolvedFindings(data),
      isPiSignoffRequired: pickIsPiSignoffRequired(data),
      isPiSignoffEmailNotificationsEnabled: pickIsPiSignoffEmailNotificationsEnabled(data),
      isPiSignoffBulkEnabled: pickIsPiSignoffBulkEnabled(data),
      isDelegationLogEnabled: toBool(pickField(data, "isDelegationLogEnabled", "IsDelegationLogEnabled")),
      isEConsentRequired: toBool(pickField(data, "isEConsentRequired", "IsEConsentRequired")),
      isCdashEnabled: pickIsCdashEnabled(data),
      requireSdvForPaymentRules: pickRequireSdvForPaymentRules(data),
      studyDocShowRoleGuids: pickStudyDocShowRoleGuidsFromSettings(data),
      isStudyDocumentsEnabled: pickIsStudyDocumentsEnabled(data),
      demoVideoUrl: pickDemoVideoUrlFromSettings(data),
      reviewOrder: pickReviewOrderFromSettings(data),
      piSignoffGranularity: pickPiSignoffGranularityFromSettings(data),
      useStudyRolePermissionMatrix: pickUseStudyRolePermissionMatrix(data),
      isSystemSiteCreationEnabled: pickIsSystemSiteCreationEnabled(data),
      isSystemSiteNamingCustomizable: pickIsSystemSiteNamingCustomizable(data),
      systemSiteNamePrefix:
        pickSystemSiteNamePrefixFromSettings(data) || DEFAULT_SYSTEM_SITE_PREFIX,
      systemSiteCount: pickSystemSiteCountFromSettings(data) || 10,
      isScreeningNumberEnabled: pickIsScreeningNumberEnabled(data),
      isScreeningNumberMaskCustomizable: pickIsScreeningNumberMaskCustomizable(data),
      screeningNumberMask: pickScreeningNumberMaskFromSettings(data),
      isRandomizationNumberEnabled: pickIsRandomizationNumberEnabled(data),
      ...pickStudyAiSettings(data),
    })
    setSettingsExist(true)
  }, [])

  const resetToCreateDefaults = useCallback(() => {
    setForm(DEFAULT_FORM)
    setSettingsExist(false)
  }, [])

  const loadSettingsForStudy = useCallback(
    async (studyId, { forceRefresh = false } = {}) => {
      const numericId = Number.parseInt(String(studyId), 10)
      if (!studyId || Number.isNaN(numericId) || numericId <= 0) {
        setSettingsLoadError(null)
        resetToCreateDefaults()
        return
      }
      setLoadingSettings(true)
      setSettingsLoadError(null)
      try {
        const res = await fetchStudySettingsByStudyId(numericId, {
          forceRefresh,
          preferFullEndpoint: true,
          skipSystemSiteOverlay: true,
        })
        const status = res?.statusCode ?? res?.httpStatus
        const data = res?.data

        if (res?.isSuccess && data != null && hasSettingsRecord(data)) {
          applySettingsPayload({
            data: mergeAllStudySettingsOverlays(numericId, data),
          })
          return
        }
        if (res?.isSuccess && (data == null || !hasSettingsRecord(data))) {
          resetToCreateDefaults()
          return
        }

        setSettingsExist(false)
        setForm(DEFAULT_FORM)

        if (status === 403) {
          setSettingsLoadError({
            title: "Access denied",
            description: res?.message || "You do not have permission to view settings for this study.",
            status,
          })
          return
        }

        if (status && status !== 404) {
          const serverHint =
            status >= 500
              ? "The server returned an error — confirm the Study Settings API and DB migrations are deployed on this environment."
              : null
          setSettingsLoadError({
            title: "Could not load settings",
            description: [res?.message || "Failed to fetch study settings.", serverHint]
              .filter(Boolean)
              .join(" "),
            status,
          })
          toast({
            title: "Could not load settings",
            description: serverHint || res?.message || "Failed to fetch study settings.",
            variant: "destructive",
          })
        }
      } finally {
        setLoadingSettings(false)
      }
    },
    [applySettingsPayload, resetToCreateDefaults, toast],
  )

  const handleStudyChange = useCallback(
    (studyId) => {
      setSelectedStudyId(studyId)
      const params = new URLSearchParams(searchParams?.toString() || "")
      if (studyId) params.set("studyId", studyId)
      else params.delete("studyId")
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const loadStudies = useCallback(async () => {
    setLoadingStudies(true)
    try {
      const res = await studyService.getStudiesForDropdown()
      setStudies(res?.isSuccess && res.data && Array.isArray(res.data) ? res.data : [])
    } finally {
      setLoadingStudies(false)
    }
  }, [])

  const loadRoles = useCallback(async () => {
    setLoadingRoles(true)
    try {
      const res = await rolesService.getRolesForDropdown()
      setRoles(res?.isSuccess && Array.isArray(res.data) ? res.data : [])
    } finally {
      setLoadingRoles(false)
    }
  }, [])

  useEffect(() => {
    loadStudies()
    loadRoles()
  }, [loadStudies, loadRoles])

  useEffect(() => {
    setSelectedStudyId((prev) => (prev === studyIdFromUrl ? prev : studyIdFromUrl))
  }, [studyIdFromUrl])

  useEffect(() => {
    if (!selectedStudyId) {
      resetToCreateDefaults()
      return
    }
    loadSettingsForStudy(selectedStudyId, { forceRefresh: true })
  }, [selectedStudyId, loadSettingsForStudy, resetToCreateDefaults])

  const handleClear = useCallback(() => {
    setSelectedStudyId("")
    setSettingsLoadError(null)
    router.replace(pathname, { scroll: false })
    resetToCreateDefaults()
  }, [pathname, router, resetToCreateDefaults])

  const handleSave = async () => {
    const numericId = Number.parseInt(String(selectedStudyId), 10)
    if (!selectedStudyId || Number.isNaN(numericId) || numericId <= 0) {
      toast({ title: "Select a study", description: "Choose a valid study first.", variant: "destructive" })
      return
    }
    if (!canSave) {
      toast({
        title: "Permission denied",
        description: settingsExist
          ? "You do not have permission to edit study settings."
          : "You do not have permission to create study settings.",
        variant: "destructive",
      })
      return
    }

    if (form.requireSdvForPaymentRules && formatRoleGuidsForApi(form.sdvRoleGuids).length === 0) {
      toast({
        title: "SDV roles required",
        description:
          "Enable at least one SDV role before turning on “Require SDV for payment rules”.",
        variant: "destructive",
      })
      return
    }

    if (form.isSystemSiteCreationEnabled) {
      const siteCount = Number.parseInt(String(form.systemSiteCount ?? ""), 10)
      if (!Number.isFinite(siteCount) || siteCount < 1 || siteCount > 999) {
        toast({
          title: "Invalid site count",
          description: "Enter a site count between 1 and 999.",
          variant: "destructive",
        })
        return
      }
      if (form.isSystemSiteNamingCustomizable && !String(form.systemSiteNamePrefix || "").trim()) {
        toast({
          title: "Site prefix required",
          description: "Enter a prefix for customizable system site names.",
          variant: "destructive",
        })
        return
      }
    }

    const effectiveSitePrefix = form.isSystemSiteNamingCustomizable
      ? String(form.systemSiteNamePrefix || "").trim() || DEFAULT_SYSTEM_SITE_PREFIX
      : DEFAULT_SYSTEM_SITE_PREFIX

    const effectiveScreeningMask = form.isScreeningNumberMaskCustomizable
      ? String(form.screeningNumberMask || "").trim() || DEFAULT_SCREENING_NUMBER_MASK
      : DEFAULT_SCREENING_NUMBER_MASK

    if (form.isScreeningNumberEnabled) {
      if (form.isScreeningNumberMaskCustomizable && !String(form.screeningNumberMask || "").trim()) {
        toast({
          title: "Screening format required",
          description: "Enter a format mask or turn off customizable screening format.",
          variant: "destructive",
        })
        return
      }
      if (!/\{SEQ:\d+\}/i.test(effectiveScreeningMask)) {
        toast({
          title: "Invalid screening format",
          description: "Include a sequence token such as {SEQ:3} in the screening number mask.",
          variant: "destructive",
        })
        return
      }
    }

    if (form.isStudyDocumentsEnabled && form.demoVideoUrl?.trim() && !isValidYouTubeUrl(form.demoVideoUrl)) {
      toast({
        title: "Invalid YouTube URL",
        description: "Use a valid YouTube link (youtube.com or youtu.be), or leave the field empty.",
        variant: "destructive",
      })
      return
    }

    const payload = {
      studyId: numericId,
      isPatientStatusEnabled: form.isPatientStatusEnabled,
      isMultiCrfAllowedPerVisitType: form.isMultiCrfAllowedPerVisitType,
      isVisitDateRestriction: form.isVisitDateRestriction,
      queryRaiseRoleGuids: formatRoleGuidsForApi(form.queryRaiseRoleGuids),
      sdvRoleGuids: formatRoleGuidsForApi(form.sdvRoleGuids),
      rsdvRoleGuids: formatRoleGuidsForApi(form.rsdvRoleGuids),
      piSignoffRoleGuids: formatRoleGuidsForApi(form.piSignoffRoleGuids),
      isAgreementEnabled: form.isAgreementEnabled,
      isSitePaymentEnabled: form.isSitePaymentEnabled,
      isRemoteSdvEnabled: form.isRemoteSdvEnabled,
      allowRsdvReopen: form.isRemoteSdvEnabled ? form.allowRsdvReopen : false,
      rsdvMarksSdvOnComplete: form.isRemoteSdvEnabled ? form.rsdvMarksSdvOnComplete : false,
      rsdvRequireResolvedFindings: form.isRemoteSdvEnabled ? form.rsdvRequireResolvedFindings : false,
      isPiSignoffRequired: form.isPiSignoffRequired,
      isPiSignoffEmailNotificationsEnabled: form.isPiSignoffRequired
        ? form.isPiSignoffEmailNotificationsEnabled
        : false,
      isPiSignoffBulkEnabled: form.isPiSignoffRequired ? form.isPiSignoffBulkEnabled : false,
      isDelegationLogEnabled: form.isDelegationLogEnabled,
      isEConsentRequired: form.isEConsentRequired,
      isCdashEnabled: Boolean(form.isCdashEnabled),
      requireSdvForPaymentRules: form.requireSdvForPaymentRules,
      studyDocShowRoleGuids: formatRoleGuidsForApi(form.studyDocShowRoleGuids),
      isStudyDocumentsEnabled: form.isStudyDocumentsEnabled,
      demoVideoUrl: form.isStudyDocumentsEnabled ? (form.demoVideoUrl?.trim() || null) : null,
      reviewOrder: form.reviewOrder === "sign_before_sdv" ? "sign_before_sdv" : "sdv_before_sign",
      piSignoffGranularity:
        form.piSignoffGranularity === "field_and_crf" ? "field_and_crf" : "crf_only",
      useStudyRolePermissionMatrix: form.useStudyRolePermissionMatrix,
      isSystemSiteCreationEnabled: form.isSystemSiteCreationEnabled,
      isSystemSiteNamingCustomizable: form.isSystemSiteNamingCustomizable,
      systemSiteNamePrefix: effectiveSitePrefix,
      systemSiteCount: form.isSystemSiteCreationEnabled
        ? Number.parseInt(String(form.systemSiteCount ?? ""), 10) || 0
        : 0,
      isScreeningNumberEnabled: form.isScreeningNumberEnabled,
      isScreeningNumberMaskCustomizable: form.isScreeningNumberMaskCustomizable,
      screeningNumberMask: effectiveScreeningMask,
      isRandomizationNumberEnabled: form.isRandomizationNumberEnabled,
      isXemusIntelligenceEnabled: form.isXemusIntelligenceEnabled,
      isAiEntryEnabled: form.isXemusIntelligenceEnabled ? form.isAiEntryEnabled : false,
      isAiRsdvVerifyEnabled: form.isXemusIntelligenceEnabled ? form.isAiRsdvVerifyEnabled : false,
      isAiQueryCopilotEnabled: form.isXemusIntelligenceEnabled ? form.isAiQueryCopilotEnabled : false,
      isAiCrfStudioEnabled: form.isXemusIntelligenceEnabled ? form.isAiCrfStudioEnabled : false,
      isAiQualityHintsEnabled: form.isXemusIntelligenceEnabled ? form.isAiQualityHintsEnabled : false,
      isAiCodingAssistEnabled: form.isXemusIntelligenceEnabled ? form.isAiCodingAssistEnabled : false,
      isAiInsightEnabled: form.isXemusIntelligenceEnabled ? form.isAiInsightEnabled : false,
      isAiConsentAssistEnabled: form.isXemusIntelligenceEnabled ? form.isAiConsentAssistEnabled : false,
    }

    setSaving(true)
    try {
      const res = settingsExist
        ? await studySettingsService.update(numericId, payload)
        : await studySettingsService.create(payload)

      if (res?.isSuccess) {
        persistStudyDocumentsSettingsOverlay(numericId, {
          isStudyDocumentsEnabled: form.isStudyDocumentsEnabled,
          demoVideoUrl: form.isStudyDocumentsEnabled ? (form.demoVideoUrl?.trim() || "") : "",
        })

        if (form.isSystemSiteCreationEnabled) {
          persistSystemSiteSettingsOverlay(numericId, {
            isSystemSiteCreationEnabled: true,
            isSystemSiteNamingCustomizable: form.isSystemSiteNamingCustomizable,
            systemSiteNamePrefix: effectiveSitePrefix,
            systemSiteCount: payload.systemSiteCount,
          })
        } else {
          clearSystemSiteSettingsOverlay(numericId)
        }

        clearPatientIdentifierSettingsOverlay(numericId)

        clearStudySettingsCache(numericId)
        applySettingsPayload({
          data: mergeAllStudySettingsOverlays(numericId, {
            ...(res.data != null && typeof res.data === "object" ? res.data : {}),
            studyId: numericId,
            isPiSignoffRequired: payload.isPiSignoffRequired,
            isPiSignoffEmailNotificationsEnabled: payload.isPiSignoffEmailNotificationsEnabled,
            isPiSignoffBulkEnabled: payload.isPiSignoffBulkEnabled,
            reviewOrder: payload.reviewOrder,
            piSignoffGranularity: payload.piSignoffGranularity,
            isSystemSiteCreationEnabled: form.isSystemSiteCreationEnabled,
            isSystemSiteNamingCustomizable: form.isSystemSiteNamingCustomizable,
            systemSiteNamePrefix: effectiveSitePrefix,
            systemSiteCount: payload.systemSiteCount,
            isScreeningNumberEnabled: form.isScreeningNumberEnabled,
            isScreeningNumberMaskCustomizable: form.isScreeningNumberMaskCustomizable,
            screeningNumberMask: effectiveScreeningMask,
            isRandomizationNumberEnabled: form.isRandomizationNumberEnabled,
            isStudyDocumentsEnabled: form.isStudyDocumentsEnabled,
            demoVideoUrl: form.isStudyDocumentsEnabled ? (form.demoVideoUrl?.trim() || "") : "",
          }),
        })
        setSettingsExist(true)

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("studySettingsUpdated", { detail: { studyId: numericId } }),
          )
          window.dispatchEvent(new CustomEvent("studySiteChanged"))
        }
        const systemSiteHint = form.isSystemSiteCreationEnabled
          ? " System sites will be created one at a time when CRC users are added."
          : ""
        const screeningHint = form.isScreeningNumberEnabled
          ? " Auto-generated screening / subject IDs are enabled for this study."
          : ""
        toast({
          variant: "success",
          title: settingsExist ? "Settings updated" : "Settings created",
          description: (res?.message || "Study settings saved successfully.") + systemSiteHint + screeningHint,
        })
        await loadSettingsForStudy(String(numericId), { forceRefresh: true })
        return
      }
      toast({
        title: "Save failed",
        description: res?.message || "Could not save study settings.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const showForm = Boolean(selectedStudyId) && !loadingSettings && canView && !settingsLoadError
  const modeLabel = settingsExist ? "Edit" : "Create"

  return (
    <DashboardLayout>
      <div className={cn(VIEWPORT_PAGE_SHELL_WITH_EMERALD_BG_CLASS, "min-w-0")}>
        {/* Page header — matches study-management pages */}
        <div className="mb-3 flex shrink-0 items-start gap-2.5 sm:items-center sm:gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-blue-500 text-white shadow-md shadow-emerald-500/20 sm:h-11 sm:w-11">
            <Settings2 className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">Study Settings</h1>
            <p className="text-xs text-slate-500 sm:text-sm">Per-study configuration — auto-loads by study ID</p>
          </div>
        </div>

        {/* Main panel — full width, fills viewport */}
        <div className={PANEL}>
          {/* Workflow toolbar */}
          <div className="shrink-0 border-b border-slate-100 bg-slate-50/50 px-3 py-3 sm:px-5 sm:py-4">
            <SectionTitle title="Workflow" subtitle="Select study to load or create settings" />
            <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
              <div className="w-full min-w-0 flex-1 sm:max-w-lg">
                <label className="mb-1.5 block text-sm font-bold text-slate-700">
                  Study <span className="text-red-600">*</span>
                </label>
                {loadingStudies ? (
                  <Skeleton className="h-11 w-full rounded-xl bg-slate-200/60" aria-hidden />
                ) : (
                  <>
                    <SearchableSelect
                      value={selectedStudyId}
                      options={studyOptions}
                      onChange={handleStudyChange}
                      placeholder="Search and select study"
                      disabled={loadingStudies}
                      showSearch
                      searchIconPosition="end"
                      includeEmptyOption
                      className={cn(
                        "min-h-[44px] w-full rounded-xl px-3 py-2.5 text-sm transition-all outline-none",
                        !selectedStudyId
                          ? "border-2 border-red-300 bg-red-50/50 focus:border-red-500 focus:ring-4 focus:ring-red-100"
                          : "border-2 border-slate-200 bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100",
                      )}
                      contentClassName="z-[180]"
                    />
                    {!selectedStudyId && (
                      <p className="mt-1.5 text-xs text-red-600 font-medium">Study is required.</p>
                    )}
                  </>
                )}
              </div>
              {selectedStudyId ? (
                <div className="flex w-full flex-wrap items-stretch gap-2 sm:w-auto sm:items-end">
                  <div className="flex min-h-[44px] min-w-0 flex-1 flex-col justify-center rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200/70 sm:flex-none">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Study ID</span>
                    <span className="truncate text-sm font-semibold tabular-nums text-slate-900">{selectedStudyId}</span>
                  </div>
                  {!loadingSettings && (
                    <span
                      className={`inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl px-4 text-xs font-semibold ring-1 sm:flex-none ${
                        settingsExist
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-200/80"
                          : "bg-amber-50 text-amber-800 ring-amber-200/80"
                      }`}
                    >
                      {modeLabel} mode
                    </span>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {selectedStudyId ? (
            <div className="shrink-0 border-b border-slate-100 bg-white px-3 sm:px-5">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => handleSettingsTabChange("general")}
                  className={cn(
                    "relative flex-1 px-4 py-3 text-sm font-semibold transition-all sm:flex-none sm:px-6",
                    settingsTab === "general" ? "text-emerald-700" : "text-slate-500 hover:text-slate-700",
                  )}
                >
                  General settings
                  {settingsTab === "general" && (
                    <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-gradient-to-r from-emerald-600 to-blue-600 sm:inset-x-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleSettingsTabChange("daily-email")}
                  className={cn(
                    "relative flex flex-1 items-center justify-center gap-1.5 px-4 py-3 text-sm font-semibold transition-all sm:flex-none sm:px-6",
                    settingsTab === "daily-email" ? "text-emerald-700" : "text-slate-500 hover:text-slate-700",
                  )}
                >
                  <Mail className="h-4 w-4" />
                  Daily email
                  {settingsTab === "daily-email" && (
                    <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-gradient-to-r from-emerald-600 to-blue-600 sm:inset-x-4" />
                  )}
                </button>
              </div>
            </div>
          ) : null}

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar px-3 py-3 sm:px-5 sm:py-4">
            {!selectedStudyId && !loadingStudies && (
              <div className="flex h-full min-h-[200px] flex-col items-center justify-center text-center">
                <p className="text-sm font-medium text-slate-600">No study selected</p>
                <p className="mt-1 max-w-sm text-xs text-slate-400">
                  Choose a study above. Settings will load from the API and appear here.
                </p>
              </div>
            )}

            {selectedStudyId && loadingSettings && (
              <StudySettingsSkeleton showHeader={false} showStudyPicker={false} showForm />
            )}

            {selectedStudyId && !loadingSettings && !canView && (
              <p className="rounded-xl bg-amber-50 px-4 py-8 text-center text-sm text-amber-800 ring-1 ring-amber-200/60">
                You do not have permission to view study settings.
              </p>
            )}

            {selectedStudyId && !loadingSettings && settingsLoadError && (
              <div
                className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-2xl bg-red-50/80 px-6 py-10 text-center ring-1 ring-red-200/70"
                role="alert"
              >
                <p className="text-sm font-semibold text-red-800">{settingsLoadError.title}</p>
                <p className="mt-2 max-w-lg text-xs leading-relaxed text-red-700/90">
                  {settingsLoadError.description}
                  {settingsLoadError.status ? (
                    <span className="mt-2 block font-mono text-[11px] text-red-600/80">
                      HTTP {settingsLoadError.status}
                    </span>
                  ) : null}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 h-9 rounded-xl border-red-200 bg-white text-red-800 hover:bg-red-50"
                  onClick={() => loadSettingsForStudy(selectedStudyId, { forceRefresh: true })}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
              </div>
            )}

            {selectedStudyId && settingsTab === "daily-email" && canView && (
              <StudyDailyEmailPanel
                studyId={selectedStudyId}
                canView={canView}
                canSave={routePerm.canEdit || routePerm.canAdd}
                canSend={routePerm.canEdit}
                studyLabel={selectedStudyLabel}
              />
            )}

            {showForm && settingsTab === "general" && (
              <div className="space-y-4 sm:space-y-5">
                <div className="rounded-xl border border-violet-200/70 bg-violet-50/40 px-3 py-3 sm:px-4 sm:py-4">
                  <SectionTitle
                    title="Study role permissions"
                    subtitle="Opt in per study — when enabled, eCRF and reports use Study Role Permissions for this study instead of global Role Permission for CRF actions"
                  />
                  <div className="mt-3 grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                    <SettingToggle
                      icon={Shield}
                      title="Use study role permission matrix"
                      description="When on, crf.view / crf.edit and related gates follow Study Management → Study Role Permissions for this study. When off, global Masters → Role Permission applies."
                      checked={form.useStudyRolePermissionMatrix}
                      onChange={(v) => setForm((p) => ({ ...p, useStudyRolePermissionMatrix: v }))}
                      disabled={!canSave}
                      className="bg-white/80"
                    />
                  </div>
                  {form.useStudyRolePermissionMatrix ? (
                    <p className="mt-3 text-xs text-violet-900/80">
                      Configure the matrix under{" "}
                      <Link
                        href={`/study-management/study-role-permissions?studyId=${encodeURIComponent(selectedStudyId)}`}
                        className="font-semibold text-violet-800 underline-offset-2 hover:underline"
                      >
                        Study Role Permissions
                      </Link>
                      . Users must have the correct study/site assignment role in User Creation.
                    </p>
                  ) : (
                    <p className="mt-3 text-xs text-slate-600">
                      This study uses global Role Permission for eCRF view/edit until you enable this option and save.
                    </p>
                  )}
                </div>
                <div className="rounded-xl border border-indigo-200/70 bg-indigo-50/40 px-3 py-3 text-sm text-slate-700 sm:px-4">
                  <p className="font-semibold text-slate-900">Payment rules</p>
                  <p className="mt-1 text-slate-600">
                    Configure milestones and visit triggers, or migrate legacy milestone rows for existing studies.
                  </p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
                    <Link
                      href={`/study-management/payment-rules?studyId=${encodeURIComponent(selectedStudyId)}`}
                      className="inline-flex text-sm font-semibold text-indigo-700 hover:text-indigo-900"
                    >
                      Open payment rules →
                    </Link>
                    <Link
                      href={`/reports/export-finance-report?studyId=${encodeURIComponent(selectedStudyId)}`}
                      className="inline-flex text-sm font-semibold text-indigo-700 hover:text-indigo-900"
                    >
                      View finance progress →
                    </Link>
                  </div>
                  <div className="mt-4 border-t border-indigo-200/60 pt-4 space-y-4">
                    <SettingToggle
                      icon={IndianRupee}
                      title="Site payment enabled"
                      description="When off, honorarium amount fields are hidden in User Creation, Payment Rules, agreements, and finance reports for this study."
                      checked={form.isSitePaymentEnabled}
                      onChange={(v) => setForm((p) => ({ ...p, isSitePaymentEnabled: v }))}
                      disabled={!canSave}
                      className="bg-white/80"
                    />
                    <SettingToggle
                      icon={IndianRupee}
                      title="Require SDV for payment rules"
                      description="When on, each rule uses its completion level (e.g. SDV verified). When off, all rules count CRF submitted only."
                      checked={form.requireSdvForPaymentRules}
                      onChange={(v) => setForm((p) => ({ ...p, requireSdvForPaymentRules: v }))}
                      disabled={!canSave}
                      className="bg-white/80"
                    />
                    {form.requireSdvForPaymentRules && formatRoleGuidsForApi(form.sdvRoleGuids).length === 0 ? (
                      <p className="mt-2 text-xs font-medium text-amber-800">
                        Select at least one SDV role below before saving.
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-xl border border-teal-200/70 bg-teal-50/35 px-3 py-3 sm:px-4 sm:py-4">
                  <SectionTitle
                    title="System site creation"
                    subtitle="Auto-generate numbered sites so users can be assigned directly at user creation"
                  />
                  <div className="mt-3 grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                    <SettingToggle
                      icon={MapPin}
                      title="Enable system site creation"
                      description="Creates sites automatically for this study (e.g. s-01, s-02). Manual site configuration is optional."
                      checked={form.isSystemSiteCreationEnabled}
                      onChange={(v) => setForm((p) => ({ ...p, isSystemSiteCreationEnabled: v }))}
                      disabled={!canSave}
                      className="bg-white/80"
                    />
                  </div>
                  {form.isSystemSiteCreationEnabled ? (
                    <div className="mt-4 space-y-4 rounded-2xl border border-teal-200/60 bg-white/75 p-3 sm:p-4">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="min-w-0">
                          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Maximum site slots
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={999}
                            value={form.systemSiteCount}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                systemSiteCount: Math.max(
                                  1,
                                  Math.min(999, Number.parseInt(e.target.value || "1", 10) || 1),
                                ),
                              }))
                            }
                            disabled={!canSave}
                            className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                          />
                          <p className="mt-1 text-[11px] text-slate-500">
                            Max CRC users for this study. Sites are created on demand (1st user → s-01,
                            100 slots → s-001 … s-100).
                          </p>
                        </div>
                        <div className="min-w-0 sm:flex sm:items-end">
                          <SettingToggle
                            icon={MapPin}
                            title="Customizable site prefix"
                            description="Default is s- when off"
                            checked={form.isSystemSiteNamingCustomizable}
                            onChange={(v) =>
                              setForm((p) => ({
                                ...p,
                                isSystemSiteNamingCustomizable: v,
                                systemSiteNamePrefix: v
                                  ? p.systemSiteNamePrefix || DEFAULT_SYSTEM_SITE_PREFIX
                                  : DEFAULT_SYSTEM_SITE_PREFIX,
                              }))
                            }
                            disabled={!canSave}
                            className="w-full bg-white/90"
                          />
                        </div>
                      </div>
                      {form.isSystemSiteNamingCustomizable ? (
                        <div>
                          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Site name prefix
                          </label>
                          <input
                            type="text"
                            value={form.systemSiteNamePrefix}
                            onChange={(e) =>
                              setForm((p) => ({ ...p, systemSiteNamePrefix: e.target.value }))
                            }
                            disabled={!canSave}
                            placeholder="s-"
                            className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 sm:max-w-xs"
                          />
                        </div>
                      ) : null}
                      {systemSitePreview.length > 0 ? (
                        <p className="text-xs text-teal-900/85">
                          <span className="font-semibold">Preview:</span>{" "}
                          {systemSitePreview.join(" · ")}
                        </p>
                      ) : null}
                      <p className="text-[11px] leading-relaxed text-slate-600">
                        Save settings to enable auto site assignment. Each new CRC user gets the next
                        site (s-01, s-02, …) — sites are not all created upfront.
                      </p>
                    </div>
                  ) : null}
                </div>
                <div className="rounded-xl border border-violet-200/70 bg-violet-50/35 px-3 py-3 sm:px-4 sm:py-4">
                  <SectionTitle
                    title="Patient identifiers"
                    subtitle="When disabled, patient enrolment keeps the current flow (initials, PID-{id}). Enable per study when the protocol requires screening / SUBJID."
                  />
                  <div className="mt-3 grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                    <SettingToggle
                      icon={Hash}
                      title="Enable auto screening / subject ID"
                      description="EDC assigns screening number at enrolment (not hand-typed). Becomes persistent SUBJID."
                      checked={form.isScreeningNumberEnabled}
                      onChange={(v) =>
                        setForm((p) => ({
                          ...p,
                          isScreeningNumberEnabled: v,
                          ...(v
                            ? {}
                            : {
                                isScreeningNumberMaskCustomizable: false,
                                screeningNumberMask: DEFAULT_SCREENING_NUMBER_MASK,
                                isRandomizationNumberEnabled: false,
                              }),
                        }))
                      }
                      disabled={!canSave}
                      className="bg-white/80"
                    />
                    <SettingToggle
                      icon={Users}
                      title="Enable randomization number"
                      description="Separate field after eligibility passes. Off = current status-only workflow."
                      checked={form.isRandomizationNumberEnabled}
                      onChange={(v) => setForm((p) => ({ ...p, isRandomizationNumberEnabled: v }))}
                      disabled={!canSave || !form.isScreeningNumberEnabled}
                      className="bg-white/80"
                    />
                  </div>
                  {form.isScreeningNumberEnabled ? (
                    <div className="mt-4 space-y-4 rounded-2xl border border-violet-200/60 bg-white/75 p-3 sm:p-4">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="min-w-0 sm:flex sm:items-end">
                          <SettingToggle
                            icon={Hash}
                            title="Customizable screening format"
                            description={`Default mask: ${DEFAULT_SCREENING_NUMBER_MASK}`}
                            checked={form.isScreeningNumberMaskCustomizable}
                            onChange={(v) =>
                              setForm((p) => ({
                                ...p,
                                isScreeningNumberMaskCustomizable: v,
                                screeningNumberMask: v
                                  ? p.screeningNumberMask || DEFAULT_SCREENING_NUMBER_MASK
                                  : DEFAULT_SCREENING_NUMBER_MASK,
                              }))
                            }
                            disabled={!canSave}
                            className="w-full bg-white/90"
                          />
                        </div>
                      </div>
                      {form.isScreeningNumberMaskCustomizable ? (
                        <div>
                          <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Screening / SUBJID format mask
                          </label>
                          <input
                            type="text"
                            value={form.screeningNumberMask}
                            onChange={(e) =>
                              setForm((p) => ({ ...p, screeningNumberMask: e.target.value }))
                            }
                            disabled={!canSave}
                            placeholder={DEFAULT_SCREENING_NUMBER_MASK}
                            className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 font-mono text-sm text-slate-900 shadow-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 sm:max-w-md"
                          />
                          <p className="mt-1 text-[11px] text-slate-500">
                            Tokens: {"{STUDY}"}, {"{SITE}"}, {"{SEQ:3}"} (sequence width). Example: S-101-001
                          </p>
                        </div>
                      ) : null}
                      {screeningNumberPreview ? (
                        <p className="text-xs text-violet-900/85">
                          <span className="font-semibold">Preview:</span> {screeningNumberPreview}
                        </p>
                      ) : null}
                      <p className="text-[11px] leading-relaxed text-slate-600">
                        Screen-failed subjects keep their ID for audit; only passed subjects continue to
                        randomization / treatment. Re-screening uses a new ID when the backend supports it.
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                      Disabled — enrolment, eCRF, and reports behave exactly as they do today.
                    </p>
                  )}
                </div>
                <div>
                  <SectionTitle
                    title="PI sign-off"
                    subtitle="Enable PI sign-off for submitted CRFs on this study"
                  />
                  <div className="grid grid-cols-1 gap-2.5">
                    <SettingToggle
                      icon={FileCheck}
                      title="PI sign-off required"
                      description="Queue, eCRF panel, and DB lock PI checks apply only when enabled."
                      checked={form.isPiSignoffRequired}
                      onChange={(v) =>
                        setForm((p) => ({
                          ...p,
                          isPiSignoffRequired: v,
                          ...(v ? {} : { isPiSignoffBulkEnabled: false }),
                        }))
                      }
                      disabled={!canSave}
                    />
                  </div>
                </div>
                <div>
                  <SectionTitle
                    title="Remote SDV"
                    subtitle="Split-screen review of visit source documents against eCRF data"
                  />
                  <div className="grid grid-cols-1 gap-2.5">
                    <SettingToggle
                      icon={FileSearch}
                      title="Remote SDV review enabled"
                      description="CRA/monitor roles can review uploaded visit documents in the RSDV queue."
                      checked={form.isRemoteSdvEnabled}
                      onChange={(v) =>
                        setForm((p) => ({
                          ...p,
                          isRemoteSdvEnabled: v,
                          allowRsdvReopen: v ? p.allowRsdvReopen : false,
                          rsdvMarksSdvOnComplete: v ? p.rsdvMarksSdvOnComplete : false,
                          rsdvRequireResolvedFindings: v ? p.rsdvRequireResolvedFindings : false,
                        }))
                      }
                      disabled={!canSave}
                    />
                    {form.isRemoteSdvEnabled ? (
                      <>
                        <SettingToggle
                          icon={RotateCcw}
                          title="Allow reopening completed reviews"
                          description="Reviewers can return a completed RSDV session to in progress when further verification is needed."
                          checked={form.allowRsdvReopen}
                          onChange={(v) => setForm((p) => ({ ...p, allowRsdvReopen: v }))}
                          disabled={!canSave}
                        />
                        <SettingToggle
                          icon={FileCheck}
                          title="Mark SDV on review complete"
                          description="When enabled, completing remote SDV marks all submitted visit CRFs as SDV-verified (reviewer must confirm)."
                          checked={form.rsdvMarksSdvOnComplete}
                          onChange={(v) => setForm((p) => ({ ...p, rsdvMarksSdvOnComplete: v }))}
                          disabled={!canSave}
                        />
                        <SettingToggle
                          icon={Shield}
                          title="Require resolved findings before complete"
                          description="Blocks completion while open document notes or open/in-process visit queries remain."
                          checked={form.rsdvRequireResolvedFindings}
                          onChange={(v) => setForm((p) => ({ ...p, rsdvRequireResolvedFindings: v }))}
                          disabled={!canSave}
                        />
                      </>
                    ) : null}
                  </div>
                  {form.isRemoteSdvEnabled ? (
                    <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
                      Assign RSDV reviewer roles below, or leave empty to reuse SDV roles. Menu: Remote SDV → Review queue.
                    </p>
                  ) : null}
                </div>

                <div>
                  <SectionTitle
                    title="YP Intelligence"
                    subtitle="Governed AI modules — suggest-only; every action is audit logged"
                  />
                  <div className="grid grid-cols-1 gap-2.5">
                    <SettingToggle
                      icon={Sparkles}
                      title="YP Intelligence enabled"
                      description="Master toggle for Capture, Verify, Studio, Guard, Insight, and Consent AI."
                      checked={form.isXemusIntelligenceEnabled}
                      onChange={(v) =>
                        setForm((p) => ({
                          ...p,
                          isXemusIntelligenceEnabled: v,
                          ...(v
                            ? {}
                            : {
                                isAiEntryEnabled: false,
                                isAiRsdvVerifyEnabled: false,
                                isAiQueryCopilotEnabled: false,
                                isAiCrfStudioEnabled: false,
                                isAiQualityHintsEnabled: false,
                                isAiCodingAssistEnabled: false,
                                isAiInsightEnabled: false,
                                isAiConsentAssistEnabled: false,
                              }),
                        }))
                      }
                      disabled={!canSave}
                    />
                    {form.isXemusIntelligenceEnabled ? (
                      <>
                        <SettingToggle
                          icon={Sparkles}
                          title="Capture AI (voice & document entry)"
                          description="AI-based eCRF entry route and per-field review before merge."
                          checked={form.isAiEntryEnabled}
                          onChange={(v) => setForm((p) => ({ ...p, isAiEntryEnabled: v }))}
                          disabled={!canSave}
                        />
                        <SettingToggle
                          icon={FileSearch}
                          title="Verify AI (RSDV source match)"
                          description="Suggest document region ↔ eCRF field matches in remote SDV."
                          checked={form.isAiRsdvVerifyEnabled}
                          onChange={(v) => setForm((p) => ({ ...p, isAiRsdvVerifyEnabled: v }))}
                          disabled={!canSave}
                        />
                        <SettingToggle
                          icon={ClipboardList}
                          title="Query copilot"
                          description="Draft query text in RSDV and eCRF review — human confirms before raise."
                          checked={form.isAiQueryCopilotEnabled}
                          onChange={(v) => setForm((p) => ({ ...p, isAiQueryCopilotEnabled: v }))}
                          disabled={!canSave}
                        />
                        <SettingToggle
                          icon={Layers}
                          title="Studio AI (CRF Studio extraction)"
                          description="Real LLM extraction pipeline in CRF Studio (replaces stub when backend ready)."
                          checked={form.isAiCrfStudioEnabled}
                          onChange={(v) => setForm((p) => ({ ...p, isAiCrfStudioEnabled: v }))}
                          disabled={!canSave}
                        />
                        <SettingToggle
                          icon={Shield}
                          title="Guard AI (pre-submit quality hints)"
                          description="Non-blocking quality hints before CRF submit."
                          checked={form.isAiQualityHintsEnabled}
                          onChange={(v) => setForm((p) => ({ ...p, isAiQualityHintsEnabled: v }))}
                          disabled={!canSave}
                        />
                        <SettingToggle
                          icon={Hash}
                          title="Coding assist (MedDRA / WHO-DD)"
                          description="AI-suggested coding terms alongside dictionary lookup."
                          checked={form.isAiCodingAssistEnabled}
                          onChange={(v) => setForm((p) => ({ ...p, isAiCodingAssistEnabled: v }))}
                          disabled={!canSave}
                        />
                        <SettingToggle
                          icon={Users}
                          title="Insight AI (CRA copilot & assistant)"
                          description="Monitoring summaries and floating study assistant in eCRF / RSDV."
                          checked={form.isAiInsightEnabled}
                          onChange={(v) => setForm((p) => ({ ...p, isAiInsightEnabled: v }))}
                          disabled={!canSave}
                        />
                        <SettingToggle
                          icon={FileSignature}
                          title="Consent AI (eCONSENT questions)"
                          description="Generate knowledge-check questions from consent section text."
                          checked={form.isAiConsentAssistEnabled}
                          onChange={(v) => setForm((p) => ({ ...p, isAiConsentAssistEnabled: v }))}
                          disabled={!canSave}
                        />
                      </>
                    ) : (
                      <p className="text-[11px] leading-relaxed text-slate-600">
                        Disabled — no AI suggest APIs or UI for this study.
                      </p>
                    )}
                  </div>
                </div>

                {form.isPiSignoffRequired ? (
                <div>
                  <SectionTitle
                    title="PI sign-off review order"
                    subtitle="Controls whether SDV must complete before PI sign-off (invalidation rules still apply after sign)"
                  />
                  <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                    {REVIEW_ORDER_OPTIONS.map((option) => {
                      const selected = form.reviewOrder === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          disabled={!canSave}
                          onClick={() => setForm((p) => ({ ...p, reviewOrder: option.value }))}
                          className={cn(
                            "w-full rounded-2xl px-3 py-3 text-left ring-1 transition-all sm:px-4",
                            selected
                              ? "bg-emerald-50/90 ring-violet-300/80"
                              : "bg-slate-50/90 ring-slate-200/60 hover:bg-white hover:ring-slate-300/80",
                            !canSave && "opacity-60",
                          )}
                        >
                          <p className="text-[13px] font-semibold text-slate-900">{option.title}</p>
                          <p className="mt-1 text-[11px] leading-snug text-slate-500">{option.description}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>
                ) : null}

                {form.isPiSignoffRequired ? (
                <div>
                  <SectionTitle
                    title="PI sign-off scope"
                    subtitle={`Per submitted CRF (patient visit form) · Current mode: ${piSignoffGranularityLabel(form.piSignoffGranularity)}`}
                  />
                  <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                    {PI_SIGNOFF_GRANULARITY_OPTIONS.map((option) => {
                      const selected = form.piSignoffGranularity === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          disabled={!canSave}
                          onClick={() => setForm((p) => ({ ...p, piSignoffGranularity: option.value }))}
                          className={cn(
                            "w-full rounded-2xl px-3 py-3 text-left ring-1 transition-all sm:px-4",
                            selected
                              ? "bg-indigo-50/90 ring-indigo-300/80"
                              : "bg-slate-50/90 ring-slate-200/60 hover:bg-white hover:ring-slate-300/80",
                            !canSave && "opacity-60",
                          )}
                        >
                          <p className="text-[13px] font-semibold text-slate-900">{option.title}</p>
                          <p className="mt-1 text-[11px] leading-snug text-slate-500">{option.description}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>
                ) : null}

                {form.isPiSignoffRequired ? (
                <div>
                  <SectionTitle
                    title="Bulk PI sign-off"
                    subtitle="Allow PI to sign all ready submitted CRFs at a site in one action from the sign-off queue"
                  />
                  <div className="grid grid-cols-1 gap-2.5">
                    <SettingToggle
                      icon={ClipboardList}
                      title="Site bulk sign-off enabled"
                      description="When enabled, the PI sign-off queue shows Sign all ready at site. Only CRFs that pass readiness checks are signed; each record is audited separately."
                      checked={form.isPiSignoffBulkEnabled}
                      onChange={(v) => setForm((p) => ({ ...p, isPiSignoffBulkEnabled: v }))}
                      disabled={!canSave}
                    />
                  </div>
                </div>
                ) : null}

                {form.isPiSignoffRequired ? (
                <div>
                  <SectionTitle
                    title="PI email notifications"
                    subtitle="Email PI-role study users when sign-off is applied or revoked"
                  />
                  <div className="grid grid-cols-1 gap-2.5">
                    <SettingToggle
                      icon={FileCheck}
                      title="Email on PI events"
                      description="Sends alerts to users assigned PI sign-off roles on the site."
                      checked={form.isPiSignoffEmailNotificationsEnabled}
                      onChange={(v) => setForm((p) => ({ ...p, isPiSignoffEmailNotificationsEnabled: v }))}
                      disabled={!canSave}
                    />
                  </div>
                </div>
                ) : null}

                {form.isPiSignoffRequired ? (
                <div>
                  <SectionTitle
                    title="PI sign-off roles"
                    subtitle="Who can apply or revoke PI sign-off (empty = permission matrix fallback)"
                  />
                  <RoleMultiSelectCard
                    title="PI sign-off roles"
                    description="Users with these roles can sign off submitted CRFs when PI sign-off is enabled."
                    selectedGuids={form.piSignoffRoleGuids}
                    roleOptions={roleOptionsFromApi}
                    onChange={(guids) => setForm((p) => ({ ...p, piSignoffRoleGuids: guids }))}
                    disabled={!canSave}
                    loading={loadingRoles}
                    emptyHint="No roles selected — uses study permission matrix (pi.signoff) when configured."
                    className="w-full max-w-2xl"
                  />
                </div>
                ) : null}

                <div>
                  <SectionTitle
                    title="Delegation log (ICH GCP)"
                    subtitle="Per-study delegation of authority log by site"
                  />
                  <div className="grid grid-cols-1 gap-2.5">
                    <SettingToggle
                      icon={ClipboardList}
                      title="Delegation log enabled"
                      description="Track delegated tasks and roles per site for this study only."
                      checked={form.isDelegationLogEnabled}
                      onChange={(v) => setForm((p) => ({ ...p, isDelegationLogEnabled: v }))}
                      disabled={!canSave}
                    />
                  </div>
                  {form.isDelegationLogEnabled && selectedStudyId ? (
                    <p className="mt-3 text-sm">
                      <Link
                        href={`/study-management/delegation-log?studyId=${encodeURIComponent(selectedStudyId)}`}
                        className="font-semibold text-indigo-700 hover:text-indigo-900"
                      >
                        Open delegation log for this study →
                      </Link>
                    </p>
                  ) : null}
                </div>

                <div>
                  <SectionTitle
                    title="eCONSENT"
                    subtitle="Electronic informed consent for this study"
                  />
                  <div className="grid grid-cols-1 gap-2.5">
                    <SettingToggle
                      icon={FileSignature}
                      title="eCONSENT required"
                      description="Enable the eCONSENT module for this study (menu and workflows)."
                      checked={form.isEConsentRequired}
                      onChange={(v) => setForm((p) => ({ ...p, isEConsentRequired: v }))}
                      disabled={!canSave}
                    />
                  </div>
                  {form.isEConsentRequired && selectedStudyId ? (
                    <p className="mt-3 text-sm">
                      <Link
                        href={`/econsent/forms?studyId=${encodeURIComponent(selectedStudyId)}`}
                        className="font-semibold text-indigo-700 hover:text-indigo-900"
                      >
                        Open eCONSENT for this study →
                      </Link>
                    </p>
                  ) : null}
                </div>

                <div>
                  <SectionTitle
                    title="CDASH / Regulatory Export"
                    subtitle="When enabled, CRF designers can map fields to CDASH variables and authorized users can export submitted data as CSV."
                  />
                  <div className="grid grid-cols-1 gap-2.5">
                    <SettingToggle
                      icon={Database}
                      title="Enable CDASH Export & Mapping"
                      description="CDASH variable mapping in form designer and CSV export for submitted CRF data."
                      checked={form.isCdashEnabled}
                      onChange={(v) => setForm((p) => ({ ...p, isCdashEnabled: v }))}
                      disabled={!canSave}
                    />
                  </div>
                </div>

                <div>
                  <SectionTitle title="Workflow flags" subtitle="eCRF and visit behavior for this study" />
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-4">
                  <SettingToggle
                    icon={Users}
                    title="Patient status enabled"
                    description="Patient status workflow on eCRF submit."
                    checked={form.isPatientStatusEnabled}
                    onChange={(v) => setForm((p) => ({ ...p, isPatientStatusEnabled: v }))}
                    disabled={!canSave}
                  />
                  <SettingToggle
                    icon={Layers}
                    title="Multi CRF per visit type"
                    description="Multiple CRF rows per visit type."
                    checked={form.isMultiCrfAllowedPerVisitType}
                    onChange={(v) => setForm((p) => ({ ...p, isMultiCrfAllowedPerVisitType: v }))}
                    disabled={!canSave}
                  />
                  <SettingToggle
                    icon={CalendarClock}
                    title="Visit date restriction"
                    description="Restrict visit dates per schedule."
                    checked={form.isVisitDateRestriction}
                    onChange={(v) => setForm((p) => ({ ...p, isVisitDateRestriction: v }))}
                    disabled={!canSave}
                  />
                  <SettingToggle
                    icon={FileSignature}
                    title="Agreement enabled"
                    description="Agreement signing workflow for CRC users."
                    checked={form.isAgreementEnabled}
                    onChange={(v) => setForm((p) => ({ ...p, isAgreementEnabled: v }))}
                    disabled={!canSave}
                  />
                  </div>
                </div>

                <div>
                  <SectionTitle
                    title="Study documents"
                    subtitle="User manuals, guides, and demo video for study users"
                  />
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <SettingToggle
                        icon={FileText}
                        title="Study documents enabled"
                        description="Allow configured roles to view uploaded manuals and demo video on the dashboard."
                        checked={form.isStudyDocumentsEnabled}
                        onChange={(v) => setForm((p) => ({ ...p, isStudyDocumentsEnabled: v }))}
                        disabled={!canSave}
                      />
                    </div>
                    {form.isStudyDocumentsEnabled && (
                      <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 space-y-3">
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">
                            YouTube demo video URL
                          </label>
                          <Input
                            type="url"
                            placeholder="https://www.youtube.com/watch?v=..."
                            value={form.demoVideoUrl}
                            onChange={(e) => setForm((p) => ({ ...p, demoVideoUrl: e.target.value }))}
                            disabled={!canSave}
                            className="h-10 rounded-xl border-slate-200 bg-white"
                          />
                          <p className="mt-1 text-xs text-slate-500">
                            Optional — users with document access can open this link from the dashboard.
                          </p>
                        </div>
                        {selectedStudyId && (
                          <Link
                            href={`/study-management/study-documents?studyId=${encodeURIComponent(selectedStudyId)}`}
                            className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-800"
                          >
                            <FileText className="h-4 w-4" />
                            Manage study document uploads
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <SectionTitle
                    title="Access & roles"
                    subtitle="Query raise, SDV verify, and study document visibility by role"
                  />
                  <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                    <RoleMultiSelectCard
                      title="Study document show roles"
                      description="Who can view study documents on the dashboard (requires Study documents enabled)."
                      selectedGuids={form.studyDocShowRoleGuids}
                      roleOptions={roleOptionsFromApi}
                      onChange={(guids) => setForm((p) => ({ ...p, studyDocShowRoleGuids: guids }))}
                      disabled={!canSave || !form.isStudyDocumentsEnabled}
                      loading={loadingRoles}
                      emptyHint="No roles selected — study documents hidden for all roles."
                    />
                    <RoleMultiSelectCard
                      title="Query raise roles"
                      description="Who can raise and close CRF queries."
                      selectedGuids={form.queryRaiseRoleGuids}
                      roleOptions={roleOptionsFromApi}
                      onChange={(guids) => setForm((p) => ({ ...p, queryRaiseRoleGuids: guids }))}
                      disabled={!canSave}
                      loading={loadingRoles}
                      emptyHint="No roles selected — legacy open access (anyone with query workflow)."
                    />
                    <RoleMultiSelectCard
                      title="SDV roles"
                      description="Who can SDV-verify CRF fields and use the SDV report."
                      selectedGuids={form.sdvRoleGuids}
                      roleOptions={roleOptionsFromApi}
                      onChange={(guids) => setForm((p) => ({ ...p, sdvRoleGuids: guids }))}
                      disabled={!canSave}
                      loading={loadingRoles}
                      emptyHint="No roles selected — SDV off for this study."
                    />
                    <RoleMultiSelectCard
                      title="Remote SDV roles"
                      description="Who can review visit source documents. Empty = same as SDV roles."
                      selectedGuids={form.rsdvRoleGuids}
                      roleOptions={roleOptionsFromApi}
                      onChange={(guids) => setForm((p) => ({ ...p, rsdvRoleGuids: guids }))}
                      disabled={!canSave || !form.isRemoteSdvEnabled}
                      loading={loadingRoles}
                      emptyHint="Uses SDV roles when empty."
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {canView && settingsTab === "general" && (
            <div className="shrink-0 border-t border-slate-100 bg-slate-50/80 px-3 py-3 backdrop-blur-sm sm:px-5">
              <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClear}
                  disabled={!selectedStudyId || saving}
                  className="h-11 w-full rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 sm:h-10 sm:w-auto sm:min-w-[100px]"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Clear
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !canSave || !selectedStudyId || loadingSettings || Boolean(settingsLoadError)}
                  className="h-11 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-blue-600 text-white shadow-md shadow-emerald-500/20 hover:from-emerald-700 hover:to-blue-700 sm:h-10 sm:w-auto sm:min-w-[110px]"
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {settingsExist ? "Save" : "Create"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}

function StudySettingsPageFallback() {
  return (
    <DashboardLayout>
      <div className="w-full p-3">
        <StudySettingsSkeleton />
      </div>
    </DashboardLayout>
  )
}

export default function StudySettingsPage() {
  return (
    <Suspense fallback={<StudySettingsPageFallback />}>
      <StudySettingsPageContent />
    </Suspense>
  )
}
