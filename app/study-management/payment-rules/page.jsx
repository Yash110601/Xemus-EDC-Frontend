"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import StudyPaymentRuleFormDialog from "@/components/study-payment-rules/StudyPaymentRuleFormDialog"
import SearchableSelect from "@/components/ui/searchable-select"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import {
  authService,
  studyPaymentRuleService,
  studyService,
  visitScheduleService,
} from "@/lib/services"
import { resolveRouteMenuPermissions } from "@/lib/utils/menuRoutePermissions"
import { getStudyTypeValue } from "@/lib/utils/studyFormEnums"
import { formatSimpleRuleSummary } from "@/lib/utils/paymentRuleSimpleTriggers"
import { fetchAllVisitSchedulesForStudy } from "@/lib/utils/visitScheduleList"
import {
  STUDY_TYPE,
  studyTypeLabel,
} from "@/lib/utils/paymentRuleEnums"
import { fetchStudySettingsByStudyId, pickIsSitePaymentEnabled } from "@/lib/utils/studySettingsRead"
import { cn } from "@/lib/utils"
import { VIEWPORT_PAGE_SHELL_WITH_EMERALD_BG_CLASS, MOBILE_TABLE_SCROLL_CLASS } from "@/lib/ui/responsivePageUi"
import { Badge } from "@/components/ui/badge"
import {
  AlertTriangle,
  CircleDollarSign,
  Database,
  IndianRupee,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  Wallet,
} from "lucide-react"

const PANEL =
  "flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)] backdrop-blur-md"

const getStudyId = (study) => study?.studyId ?? study?.StudyId ?? study?.id ?? study?.Id ?? null

const getStudyLabel = (study) => {
  const protocol =
    study?.studyProtocolNumber ?? study?.StudyProtocolNumber ?? study?.protocolNumber ?? study?.name ?? ""
  const title = study?.studyTitle ?? study?.StudyTitle ?? ""
  if (protocol && title) return `${protocol} — ${title}`
  return protocol || title || `Study ${getStudyId(study) ?? ""}`
}

function PageSkeleton() {
  return (
    <div className="space-y-3 p-4" role="status" aria-busy="true" aria-label="Loading payment rules">
      <Skeleton className="h-9 w-full max-w-xs rounded-xl bg-slate-200/60" />
      <Skeleton className="h-24 w-full rounded-2xl bg-slate-200/40" />
      <Skeleton className="h-48 w-full rounded-2xl bg-slate-200/40" />
    </div>
  )
}

function EmptyRulesState({ canEdit, onApplyTemplate, onAddRule, applyingTemplate }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200/90 bg-gradient-to-b from-slate-50/90 to-white px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
        <Wallet className="h-7 w-7" strokeWidth={1.75} />
      </div>
      <h2 className="text-base font-semibold text-slate-900">No payment rules configured</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600">
        Define when each payment step triggers for this study. Start from a study-type template or add rules manually.
      </p>
      {canEdit ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={applyingTemplate}
            onClick={onApplyTemplate}
            className="rounded-xl border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"
          >
            {applyingTemplate ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            Apply template
          </Button>
          <Button type="button" size="sm" onClick={onAddRule} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add rule
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function PaymentRulesPageContent() {
  const { toast } = useToast()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const routePerm = useMemo(
    () => resolveRouteMenuPermissions(authService.getMenu?.(), pathname),
    [pathname],
  )
  const studySettingsPerm = useMemo(
    () => resolveRouteMenuPermissions(authService.getMenu?.(), "/study-management/study-settings"),
    [pathname],
  )

  const [studies, setStudies] = useState([])
  const [selectedStudyId, setSelectedStudyId] = useState(() => {
    const fromUrl = searchParams.get("studyId")
    return fromUrl ? String(fromUrl) : ""
  })
  const [selectedStudyMeta, setSelectedStudyMeta] = useState(null)
  const [catalog, setCatalog] = useState(null)
  const [rules, setRules] = useState([])
  const [visitSchedules, setVisitSchedules] = useState([])
  const [loadingStudies, setLoadingStudies] = useState(true)
  const [loadingRules, setLoadingRules] = useState(false)
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [applyingTemplate, setApplyingTemplate] = useState(false)
  const [savingRule, setSavingRule] = useState(false)
  const [deletingRuleId, setDeletingRuleId] = useState(null)
  const [rulesBusy, setRulesBusy] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState("create")
  const [editingRule, setEditingRule] = useState(null)
  const [apiReady, setApiReady] = useState(true)
  const [sitePaymentEnabled, setSitePaymentEnabled] = useState(true)

  const canView = routePerm.canView || studySettingsPerm.canView
  const canEdit = routePerm.canEdit || studySettingsPerm.canEdit

  const studyOptions = useMemo(
    () =>
      studies.map((study) => {
        const id = getStudyId(study)
        return { value: String(id ?? ""), label: getStudyLabel(study) }
      }),
    [studies],
  )

  const studyType = useMemo(() => {
    const fromMeta = getStudyTypeValue(
      selectedStudyMeta?.studyType ??
        selectedStudyMeta?.StudyType ??
        selectedStudyMeta?.studyTypeName ??
        selectedStudyMeta?.StudyTypeName,
    )
    if (fromMeta) return fromMeta
    const fromList = studies.find((s) => String(getStudyId(s)) === String(selectedStudyId))
    return getStudyTypeValue(
      fromList?.studyType ?? fromList?.StudyType ?? fromList?.studyTypeName ?? fromList?.StudyTypeName,
    )
  }, [selectedStudyMeta, selectedStudyId, studies])

  const loadStudies = useCallback(async () => {
    setLoadingStudies(true)
    try {
      const res = await studyService.getStudiesForDropdown()
      setStudies(Array.isArray(res?.data) ? res.data : [])
    } finally {
      setLoadingStudies(false)
    }
  }, [])

  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true)
    try {
      const res = await studyPaymentRuleService.getCatalog()
      setApiReady(res?.statusCode !== 404 && res?.statusCode !== 501)
      setCatalog(res?.data ?? null)
    } finally {
      setLoadingCatalog(false)
    }
  }, [])

  const loadVisitSchedules = useCallback(async (studyId) => {
    const sid = Number.parseInt(String(studyId ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0) {
      setVisitSchedules([])
      return
    }
    const list = await fetchAllVisitSchedulesForStudy(sid, visitScheduleService)
    setVisitSchedules(list)
  }, [])

  const loadRules = useCallback(async (studyId) => {
    const sid = Number.parseInt(String(studyId ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0) {
      setRules([])
      setSitePaymentEnabled(true)
      return
    }
    setLoadingRules(true)
    try {
      const [rulesRes, studyRes, settingsRes] = await Promise.all([
        studyPaymentRuleService.listByStudy(sid, { includeInactive: true }),
        studyService.getStudyById(sid),
        fetchStudySettingsByStudyId(sid, { preferFullEndpoint: true }),
      ])
      setApiReady(rulesRes?.statusCode !== 404 && rulesRes?.statusCode !== 501)
      setRules(Array.isArray(rulesRes?.data) ? rulesRes.data : [])
      if (studyRes?.data) setSelectedStudyMeta(studyRes.data)
      setSitePaymentEnabled(pickIsSitePaymentEnabled(settingsRes?.data ?? settingsRes))
      await loadVisitSchedules(sid)
    } finally {
      setLoadingRules(false)
    }
  }, [loadVisitSchedules])

  useEffect(() => {
    void loadStudies()
    void loadCatalog()
  }, [loadStudies, loadCatalog])

  useEffect(() => {
    void loadRules(selectedStudyId)
  }, [selectedStudyId, loadRules])

  useEffect(() => {
    if (!formOpen || !selectedStudyId) return
    void loadVisitSchedules(selectedStudyId)
  }, [formOpen, selectedStudyId, loadVisitSchedules])

  const handleStudyChange = (value) => {
    const next = String(value ?? "")
    setSelectedStudyId(next)
    const params = new URLSearchParams(searchParams.toString())
    if (next) params.set("studyId", next)
    else params.delete("studyId")
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const handleApplyTemplate = async (force = false) => {
    const sid = Number.parseInt(String(selectedStudyId ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0) return

    if (force) {
      const ok = window.confirm(
        "Replace all existing payment rules with the default template for this study type? This cannot be undone from the UI.",
      )
      if (!ok) return
    } else if (rules.length > 0) {
      const ok = window.confirm(
        "Rules already exist. Apply template anyway? Choose OK to replace all rules (force), or Cancel to keep current rules.",
      )
      if (!ok) return
      force = true
    }

    setApplyingTemplate(true)
    try {
      const res = await studyPaymentRuleService.applyTemplate(sid, {
        studyType: studyType ?? undefined,
        force,
      })
      if (res?.isSuccess) {
        toast({
          title: "Template applied",
          description: `${(res.data ?? []).length} rule(s) configured.`,
          variant: "success",
        })
        await loadRules(sid)
      } else {
        toast({
          title: "Template not applied",
          description: res?.message || "Unable to apply payment rule template.",
          variant: "destructive",
        })
      }
    } finally {
      setApplyingTemplate(false)
    }
  }

  const openCreate = () => {
    setFormMode("create")
    setEditingRule(null)
    setFormOpen(true)
  }

  const openEdit = (rule) => {
    setFormMode("edit")
    setEditingRule(rule)
    setFormOpen(true)
  }

  const handleSaveRule = async (payload) => {
    const sid = Number.parseInt(String(selectedStudyId ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0) return
    setSavingRule(true)
    try {
      const res =
        formMode === "edit" && editingRule?.id
          ? await studyPaymentRuleService.update(sid, editingRule.id, payload)
          : await studyPaymentRuleService.create(sid, payload)
      if (res?.isSuccess) {
        toast({
          title: formMode === "edit" ? "Rule updated" : "Rule created",
          variant: "success",
        })
        setFormOpen(false)
        await loadRules(sid)
      } else {
        toast({
          title: "Save failed",
          description: res?.message || "Could not save payment rule.",
          variant: "destructive",
        })
      }
    } finally {
      setSavingRule(false)
    }
  }

  const handleDeleteRule = async (rule) => {
    const sid = Number.parseInt(String(selectedStudyId ?? ""), 10)
    const rid = Number.parseInt(String(rule?.id ?? ""), 10)
    if (!Number.isFinite(sid) || !Number.isFinite(rid)) return
    const ok = window.confirm(`Delete rule "${rule.ruleName}"?`)
    if (!ok) return
    setDeletingRuleId(rid)
    try {
      const res = await studyPaymentRuleService.delete(sid, rid)
      if (res?.isSuccess) {
        toast({ title: "Rule deleted", variant: "success" })
        await loadRules(sid)
      } else {
        toast({
          title: "Delete failed",
          description: res?.message || "Could not delete payment rule.",
          variant: "destructive",
        })
      }
    } finally {
      setDeletingRuleId(null)
    }
  }

  const handleRecalculate = async () => {
    const sid = Number.parseInt(String(selectedStudyId ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0 || rulesBusy) return
    setRulesBusy(true)
    try {
      const res = await studyPaymentRuleService.recalculate(sid)
      if (res?.isSuccess) {
        toast({ title: "Progress recalculated", variant: "success" })
      } else {
        toast({
          title: "Recalculate failed",
          description: res?.message || "Could not recalculate payment rules.",
          variant: "destructive",
        })
      }
    } finally {
      setRulesBusy(false)
    }
  }

  const handleMigrateLegacy = async () => {
    const sid = Number.parseInt(String(selectedStudyId ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0 || rulesBusy) return
    if (
      !window.confirm(
        "Import legacy SiteMilestone / SiteVisit rows into payment rules? One-time per study; fails if rules already exist.",
      )
    ) {
      return
    }
    setRulesBusy(true)
    try {
      const res = await studyPaymentRuleService.migrateLegacy(sid)
      if (res?.isSuccess) {
        toast({
          title: "Legacy data migrated",
          description: "Cheque details copied to payment rules. View progress on Finance Status.",
          variant: "success",
        })
        await studyPaymentRuleService.recalculate(sid)
        await loadRules(sid)
      } else {
        toast({
          title: "Migrate failed",
          description: res?.message || "Could not migrate legacy payment data.",
          variant: "destructive",
        })
      }
    } finally {
      setRulesBusy(false)
    }
  }

  const activeRules = useMemo(() => rules.filter((r) => r.isActive !== false), [rules])

  if (!canView) {
    return (
      <DashboardLayout>
        <div className="flex flex-1 flex-col p-4">
          <div className={cn(PANEL, "items-center justify-center p-8 text-center")}>
            <AlertTriangle className="mb-3 h-8 w-8 text-amber-600" />
            <p className="text-sm font-semibold text-slate-900">You do not have permission to view payment rules.</p>
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
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-blue-500 text-white shadow-md shadow-emerald-500/20">
              <CircleDollarSign className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Payment rules</h1>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
                One row per payment step. Set <strong className="font-semibold text-slate-800">when</strong> to pay here
                {sitePaymentEnabled ? (
                  <>
                    ; set <strong className="font-semibold text-slate-800">how much</strong> per doctor in User Creation.
                  </>
                ) : (
                  <> for this study. Amounts are hidden because site payment is off in Study Settings.</>
                )}
              </p>
              {selectedStudyId && studyType ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-lg border-slate-200 bg-white/80 font-medium text-slate-700">
                    {studyTypeLabel(studyType)}
                  </Badge>
                  {activeRules.length > 0 ? (
                    <Badge className="rounded-lg bg-emerald-50 font-medium text-emerald-800 hover:bg-emerald-50">
                      {activeRules.length} active rule{activeRules.length === 1 ? "" : "s"}
                    </Badge>
                  ) : null}
                  {studyType === STUDY_TYPE.VISIT ? (
                    <span className="text-xs text-slate-500">Re-apply template after visit schedules are saved</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {canEdit ? (
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <div className="flex flex-wrap gap-1.5 rounded-xl bg-white/70 p-1 ring-1 ring-slate-200/70">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!selectedStudyId || loadingRules}
                  onClick={() => void loadRules(selectedStudyId)}
                  className="rounded-lg text-slate-600 hover:text-slate-900"
                >
                  <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loadingRules && "animate-spin")} />
                  Refresh
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!selectedStudyId || rulesBusy}
                  onClick={() => void handleRecalculate()}
                  className="rounded-lg text-slate-600 hover:text-slate-900"
                >
                  {rulesBusy ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Recalculate
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!selectedStudyId || rulesBusy}
                  onClick={() => void handleMigrateLegacy()}
                  className="rounded-lg text-slate-600 hover:text-slate-900"
                >
                  <Database className="mr-1.5 h-3.5 w-3.5" />
                  Migrate legacy
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!selectedStudyId || applyingTemplate}
                onClick={() => void handleApplyTemplate(false)}
                className="rounded-xl border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"
              >
                {applyingTemplate ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                )}
                Apply template
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!selectedStudyId}
                onClick={openCreate}
                className="rounded-xl bg-emerald-600 shadow-sm hover:bg-emerald-700"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add rule
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!selectedStudyId || loadingRules}
              onClick={() => void loadRules(selectedStudyId)}
              className="rounded-xl"
            >
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loadingRules && "animate-spin")} />
              Refresh
            </Button>
          )}
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
                        ? "border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
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
                <IndianRupee className="mb-3 h-8 w-8 text-slate-300" strokeWidth={1.5} />
                <p className="text-sm font-medium text-slate-700">Select a study to manage payment rules</p>
                <p className="mt-1 text-xs text-slate-500">Choose a study above to view or configure payment steps.</p>
              </div>
            ) : loadingRules && rules.length === 0 ? (
              <PageSkeleton />
            ) : !apiReady ? (
              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-4 text-sm text-amber-950">
                <p className="font-semibold">Payment rules API is not deployed yet</p>
                <p className="mt-1 text-amber-900/90">
                  Run backend migration{" "}
                  <code className="rounded bg-white/70 px-1.5 py-0.5 text-xs">20260618100000_AddStudyPaymentRules</code>{" "}
                  and restart the API.
                </p>
              </div>
            ) : (
              <>
                {studyType === STUDY_TYPE.VISIT && activeRules.length === 0 ? (
                  <div className="mb-4 rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-3.5 text-sm text-amber-950">
                    <p className="font-semibold">Visit study — no payment rules yet</p>
                    <p className="mt-1 leading-relaxed text-amber-900/90">
                      Save visit schedules first, then click <strong>Apply template</strong> to generate one rule per visit.{" "}
                      <Link href="/visit-configuration/manage" className="font-semibold underline underline-offset-2">
                        Open visit configuration →
                      </Link>
                    </p>
                  </div>
                ) : null}

                {activeRules.length === 0 ? (
                  <EmptyRulesState
                    canEdit={canEdit}
                    applyingTemplate={applyingTemplate}
                    onApplyTemplate={() => void handleApplyTemplate(false)}
                    onAddRule={openCreate}
                  />
                ) : (
                  <div className={cn("overflow-hidden rounded-2xl border border-slate-200/80 bg-white", MOBILE_TABLE_SCROLL_CLASS)}>
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 z-[1] bg-slate-50/95 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur-sm">
                        <tr>
                          <th className="px-4 py-3">Step</th>
                          <th className="px-4 py-3">Rule</th>
                          <th className="px-4 py-3">When to pay</th>
                          {sitePaymentEnabled ? <th className="px-4 py-3">Amount (CRC)</th> : null}
                          <th className="px-4 py-3">Status</th>
                          {canEdit ? <th className="px-4 py-3 text-right">Actions</th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {[...rules]
                          .sort((a, b) => (a.sequenceNo ?? 0) - (b.sequenceNo ?? 0))
                          .map((rule) => {
                            const inactive = rule.isActive === false
                            return (
                              <tr
                                key={rule.id}
                                className={cn(
                                  "border-t border-slate-100 align-top transition-colors hover:bg-slate-50/70",
                                  inactive && "bg-slate-50/80 text-slate-500",
                                )}
                              >
                                <td className="px-4 py-3">
                                  <span className="inline-flex min-w-[2rem] items-center justify-center rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-700">
                                    {rule.sequenceNo}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="font-semibold text-slate-900">{rule.ruleName}</p>
                                  {rule.visitScheduleName ? (
                                    <p className="mt-0.5 text-xs text-slate-500">{rule.visitScheduleName}</p>
                                  ) : null}
                                </td>
                                <td className="px-4 py-3 text-slate-700">
                                  {formatSimpleRuleSummary(rule, visitSchedules)}
                                </td>
                                {sitePaymentEnabled ? (
                                  <td className="px-4 py-3">
                                    {Number(rule.paymentAmount ?? 0) > 0 ? (
                                      <span className="inline-flex items-center gap-0.5 font-medium text-slate-900">
                                        <IndianRupee className="h-3.5 w-3.5 text-emerald-700" />
                                        {Number(rule.paymentAmount).toLocaleString("en-IN")}
                                      </span>
                                    ) : (
                                      <span
                                        className="text-xs text-slate-500"
                                        title="Amount comes from User Creation milestone rows for each CRC"
                                      >
                                        On CRC assignment
                                      </span>
                                    )}
                                  </td>
                                ) : null}
                                <td className="px-4 py-3">
                                  <span
                                    className={cn(
                                      "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1",
                                      inactive
                                        ? "bg-slate-100 text-slate-600 ring-slate-200"
                                        : "bg-emerald-50 text-emerald-800 ring-emerald-100",
                                    )}
                                  >
                                    {inactive ? "Inactive" : "Active"}
                                  </span>
                                </td>
                                {canEdit ? (
                                  <td className="px-4 py-3 text-right">
                                    <div className="flex justify-end gap-1">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 rounded-lg p-0"
                                        onClick={() => openEdit(rule)}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 rounded-lg p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                                        disabled={deletingRuleId === rule.id}
                                        onClick={() => void handleDeleteRule(rule)}
                                      >
                                        {deletingRuleId === rule.id ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <Trash2 className="h-3.5 w-3.5" />
                                        )}
                                      </Button>
                                    </div>
                                  </td>
                                ) : null}
                              </tr>
                            )
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <StudyPaymentRuleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        initialRule={editingRule}
        catalog={catalog}
        visitSchedules={visitSchedules}
        prerequisiteRules={rules}
        saving={savingRule}
        onSubmit={handleSaveRule}
      />
    </DashboardLayout>
  )
}

export default function PaymentRulesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PaymentRulesPageContent />
    </Suspense>
  )
}
