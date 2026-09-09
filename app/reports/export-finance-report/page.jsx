"use client"

import { REPORT_PAGE_SHELL_CLASS } from "@/lib/reports/studySitePatientReportUi"
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import SectionSkeleton from "@/components/ui/section-skeleton"
import DatePicker from "@/components/ui/date-picker"
import { toast } from "sonner"
import {
  BarChart3,
  DollarSign,
  Users,
  CheckCircle2,
  Clock,
  Filter,
  X,
  Loader2,
  Search,
  FileDown,
  User2,
  Mail,
  Phone,
  Archive,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Upload,
  BookMarked,
  RotateCcw,
  Database,
} from "lucide-react"
import { studyService, userAgreementService, studyPaymentRuleService } from "@/lib/services"
import studyFinanceStatusService from "@/lib/services/studyFinanceStatus.service"
import FinancePaymentRulesPanel from "@/components/finance/FinancePaymentRulesPanel"
import PaymentRuleOverrideDialog from "@/components/finance/PaymentRuleOverrideDialog"
import { getRowPaymentRules } from "@/lib/utils/paymentRuleProgress"
import {
  PAYMENT_CSV_RULES_HINT,
  studyListUsesPaymentRules,
  validatePaymentImportCsv,
} from "@/lib/utils/financePaymentCsv"
import { useReportExportJobs } from "@/context/ReportExportJobsContext"
import { useStudyAgreementEnabledForStudy } from "@/hooks/useStudyAgreementEnabled"
import { useReportExportAccess } from "@/app/reports/_hooks/useReportExportAccess"
import ReportExportGate from "@/components/reports/ReportExportGate"
import ReportDownloadActions from "@/components/reports/ReportDownloadActions"

export default function ExportFinanceReportPage() {
  const { canExport, assertCanExport, reportKey } = useReportExportAccess()
  const { startReportExport, jobs } = useReportExportJobs()
  const csvRunning = jobs.some((j) => j.kind === "finance-report-csv" && j.status === "running")
  const xlsxRunning = jobs.some((j) => j.kind === "finance-report-xlsx" && j.status === "running")
  const zipRunning = jobs.some((j) => j.kind === "finance-report-zip" && j.status === "running")
  const pathname = usePathname()
  const [loadingStudies, setLoadingStudies] = useState(false)
  const [studies, setStudies] = useState([])
  const [selectedStudyId, setSelectedStudyId] = useState("")

  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summary, setSummary] = useState(null)

  const [listLoading, setListLoading] = useState(false)
  const [items, setItems] = useState([])
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("") // CRC Status: "" = None, or Pending | Ongoing | Completed
  const [agreementDateFrom, setAgreementDateFrom] = useState("")
  const [agreementDateTo, setAgreementDateTo] = useState("")
  const [completionDateFrom, setCompletionDateFrom] = useState("")
  const [completionDateTo, setCompletionDateTo] = useState("")
  const [downloadingAgreementUserId, setDownloadingAgreementUserId] = useState(null)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState("summary") // summary | listing
  const [studySearchInput, setStudySearchInput] = useState("")
  const [isStudyDropdownOpen, setIsStudyDropdownOpen] = useState(false)
  const [statusSearchInput, setStatusSearchInput] = useState("")
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false)
  const [expandedRowId, setExpandedRowId] = useState(null) // studyUserId for expanded milestones/visits row
  // Listing-only: Study Type selector (Normal / Milestone Patient / Milestone Visit)
  // Used to filter the Study dropdown API (and can later drive server-side list filters if needed)
  const [studyTypeFilter, setStudyTypeFilter] = useState("all") // internal: "all" = no specific type selected
  // Listing: require a specific Study Type; Summary can work without it
  const isStudyTypeSelected = studyTypeFilter !== "all"
  const isMilestoneStudyType =
    studyTypeFilter === "milestonePatient" || studyTypeFilter === "milestoneVisit"
  const disableStudySelect = activeTab === "listing" && !isStudyTypeSelected

  // Payment edit modal state (for normal + milestone/visit studies)
  const [paymentEditRow, setPaymentEditRow] = useState(null) // row object
  const [overrideContext, setOverrideContext] = useState(null) // { parentRow, rule }
  const [overrideSaving, setOverrideSaving] = useState(false)
  const [paymentRulesBusy, setPaymentRulesBusy] = useState(false)
  const [listRefreshToken, setListRefreshToken] = useState(0)
  const [studyHasRuleDefinitions, setStudyHasRuleDefinitions] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    chequeNumber: "",
    documentNumber: "",
    dateOfIssue: "",
    chequeReceivedDate: "",
    paymentStatus: "Unpaid", // kept in state but not edited directly in UI
  })
  const [savingPayment, setSavingPayment] = useState(false)
  const [importingPayments, setImportingPayments] = useState(false)
  const [importSummary, setImportSummary] = useState(null)
  const [importPreview, setImportPreview] = useState(null) // { headers: string[], rows: { rowNumber, values: string[] }[] }
  const [importFile, setImportFile] = useState(null)
  const [importPreviewPage, setImportPreviewPage] = useState(1)
  const [importResultTab, setImportResultTab] = useState("failed") // "success" | "failed"
  const [importResultPage, setImportResultPage] = useState(1)
  const importInputRef = useRef(null)
  const listFetchIdRef = useRef(0)
  const [successMessage, setSuccessMessage] = useState("")

  const { isAgreementEnabled: studyAgreementEnabled } = useStudyAgreementEnabledForStudy(selectedStudyId)
  const showAgreementFeatures = !selectedStudyId || studyAgreementEnabled !== false

  // Format date string or Date object to API-required dd-MM-yyyy
  const formatApiDate = (value) => {
    if (!value) return null
    if (value instanceof Date && !isNaN(value.getTime())) {
      const dd = String(value.getDate()).padStart(2, "0")
      const mm = String(value.getMonth() + 1).padStart(2, "0")
      const yyyy = value.getFullYear()
      return `${dd}-${mm}-${yyyy}`
    }
    // Handle common "yyyy-mm-dd" or "yyyy/MM/dd" strings
    if (typeof value === "string") {
      const trimmed = value.trim()
      if (!trimmed) return null
      // Already dd-MM-yyyy
      if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) return trimmed
      const parts = trimmed.split(/[-/]/)
      if (parts.length === 3) {
        const [a, b, c] = parts
        // If first part is year (4 digits), convert to dd-MM-yyyy assuming yyyy-mm-dd
        if (a.length === 4) {
          const yyyy = a
          const mm = b.padStart(2, "0")
          const dd = c.padStart(2, "0")
          return `${dd}-${mm}-${yyyy}`
        }
      }
      return trimmed
    }
    return null
  }

  // Simple debounce for search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 400)
    return () => clearTimeout(t)
  }, [search])

  // Auto-clear transient errors after 2 seconds
  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(""), 2000)
    return () => clearTimeout(t)
  }, [error])

  // Auto-clear transient success messages after 2 seconds
  useEffect(() => {
    if (!successMessage) return
    const t = setTimeout(() => setSuccessMessage(""), 2000)
    return () => clearTimeout(t)
  }, [successMessage])

  // When any dropdown is open, lock page scroll so only the dropdown list scrolls
  const isAnyDropdownOpen = isStudyDropdownOpen || isStatusDropdownOpen
  useEffect(() => {
    if (!isAnyDropdownOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [isAnyDropdownOpen])

  const pageInfo = useMemo(() => {
    return {
      title: "Study Finance Status",
      description: "Monitor CRC agreement, finance, and patient status per study",
    }
  }, [pathname])

  // Load studies for dropdown – filtered by Study Type when selected
  useEffect(() => {
    const load = async () => {
      setLoadingStudies(true)
      try {
        let typeForApi = null
        if (studyTypeFilter === "normal") typeForApi = 1
        else if (studyTypeFilter === "milestonePatient") typeForApi = 2
        else if (studyTypeFilter === "milestoneVisit") typeForApi = 3

        const res = await studyService.getStudiesForDropdown(typeForApi)
        if (res?.isSuccess && res?.data) {
          const data = Array.isArray(res.data) ? res.data : res.data.items || res.data.Items || []
          setStudies(data || [])
          // Do not auto-select a study; let the user choose explicitly
        } else {
          setStudies([])
        }
      } catch (e) {
        console.error("Failed to load studies for finance status report:", e)
        setError("Failed to load studies. Please try again.")
      } finally {
        setLoadingStudies(false)
      }
    }
    load()
  }, [studyTypeFilter])

  // Fetch summary whenever study changes (only when Summary tab is active)
  useEffect(() => {
    const loadSummary = async () => {
      if (activeTab !== "summary") return
      if (!selectedStudyId) {
        setSummary(null)
        return
      }
      setSummaryLoading(true)
      try {
        const data = await studyFinanceStatusService.getSummary(parseInt(selectedStudyId, 10))
        setSummary(data || null)
      } catch (e) {
        console.error("Failed to load study finance status summary:", e)
        setSummary(null)
      } finally {
        setSummaryLoading(false)
      }
    }
    loadSummary()
  }, [activeTab, selectedStudyId])

  // Fetch list whenever study / paging / filters change (only when Listing tab is active AND study type is chosen)
  useEffect(() => {
    const ac = new AbortController()
    const fetchId = ++listFetchIdRef.current

    const loadList = async () => {
      if (activeTab !== "listing" || !isStudyTypeSelected) {
        setItems([])
        setTotalCount(0)
        setTotalPages(0)
        if (fetchId === listFetchIdRef.current) setListLoading(false)
        return
      }
      if (!selectedStudyId) {
        setItems([])
        setTotalCount(0)
        setTotalPages(0)
        if (fetchId === listFetchIdRef.current) setListLoading(false)
        return
      }
      setListLoading(true)
      try {
        const data = await studyFinanceStatusService.getList({
          studyId: parseInt(selectedStudyId, 10),
          pageNumber,
          pageSize,
          search: debouncedSearch,
          status: statusFilter,
          agreementDateFrom,
          agreementDateTo,
          completionDateFrom,
          completionDateTo,
          signal: ac.signal,
        })

        if (fetchId !== listFetchIdRef.current) return

        const paged = data?.data || data
        const list = Array.isArray(paged?.items) ? paged.items : paged?.Items || []
        setItems(list || [])
        setPageNumber(paged?.pageNumber || pageNumber)
        setPageSize(paged?.pageSize || pageSize)
        setTotalCount(paged?.totalCount || paged?.TotalCount || list?.length || 0)
        setTotalPages(paged?.totalPages || paged?.TotalPages || 0)
      } catch (e) {
        if (e?.name === "AbortError" || e?.message === "The user aborted a request.") return
        if (fetchId !== listFetchIdRef.current) return
        console.error("Failed to load study finance status list:", e)
        setItems([])
        setTotalCount(0)
        setTotalPages(0)
        setError("Failed to load finance status list. Please try again.")
      } finally {
        if (fetchId === listFetchIdRef.current) {
          setListLoading(false)
        }
      }
    }
    loadList()
    return () => ac.abort()
  }, [
    activeTab,
    selectedStudyId,
    isStudyTypeSelected,
    pageNumber,
    pageSize,
    debouncedSearch,
    statusFilter,
    agreementDateFrom,
    agreementDateTo,
    completionDateFrom,
    completionDateTo,
    listRefreshToken,
  ])

  const studyUsesPaymentRulesFromList = useMemo(
    () => studyListUsesPaymentRules(items),
    [items],
  )
  const studyUsesPaymentRules = studyHasRuleDefinitions || studyUsesPaymentRulesFromList

  useEffect(() => {
    if (!selectedStudyId) {
      setStudyHasRuleDefinitions(false)
      return
    }
    let cancelled = false
    const sid = Number.parseInt(selectedStudyId, 10)
    if (!Number.isFinite(sid) || sid <= 0) return

    studyPaymentRuleService
      .listByStudy(sid, { includeInactive: true })
      .then((res) => {
        if (cancelled) return
        const rules = Array.isArray(res?.data) ? res.data : []
        setStudyHasRuleDefinitions(rules.length > 0)
      })
      .catch(() => {
        if (!cancelled) setStudyHasRuleDefinitions(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedStudyId, listRefreshToken])

  const bumpListRefresh = () => setListRefreshToken((t) => t + 1)

  const openPaymentForRule = useCallback((parentRow, rule) => {
    setPaymentEditRow({
      ...parentRow,
      sitePaymentRuleProgressId: rule.id,
      siteMilestoneId: null,
      siteVisitId: null,
    })
    setPaymentForm({
      chequeNumber: rule.chequeNumber || "",
      documentNumber: rule.documentNumber || "",
      dateOfIssue: rule.dateOfIssue || "",
      chequeReceivedDate: rule.chequeReceivedDate || "",
      paymentStatus: rule.paymentStatus || "Unpaid",
    })
  }, [])

  const handleMigrateLegacyRules = async () => {
    if (!selectedStudyId || paymentRulesBusy) return
    if (
      !window.confirm(
        "Migrate legacy SiteMilestone / SiteVisit rows into payment rules? This is one-time per study and fails if rules already exist.",
      )
    ) {
      return
    }
    setPaymentRulesBusy(true)
    try {
      const studyId = Number.parseInt(selectedStudyId, 10)
      const res = await studyPaymentRuleService.migrateLegacy(studyId)
      if (res?.isSuccess) {
        toast.success("Legacy data migrated. Cheque details copied — refreshing finance grid…")
        await studyPaymentRuleService.recalculate(studyId)
        bumpListRefresh()
      } else {
        toast.error(res?.message || "Legacy migrate failed.")
      }
    } catch (e) {
      toast.error(e?.message || "Legacy migrate failed.")
    } finally {
      setPaymentRulesBusy(false)
    }
  }

  const handleRecalculateRules = async () => {
    if (!selectedStudyId || paymentRulesBusy) return
    setPaymentRulesBusy(true)
    try {
      const studyId = Number.parseInt(selectedStudyId, 10)
      const res = await studyPaymentRuleService.recalculate(studyId)
      if (res?.isSuccess) {
        toast.success("Payment rules recalculated.")
        bumpListRefresh()
      } else {
        toast.error(res?.message || "Recalculate failed.")
      }
    } catch (e) {
      toast.error(e?.message || "Recalculate failed.")
    } finally {
      setPaymentRulesBusy(false)
    }
  }

  const handleOverrideSubmit = async (payload) => {
    if (!overrideContext?.parentRow || !overrideContext?.rule || !selectedStudyId) return
    setOverrideSaving(true)
    try {
      const studyId = Number.parseInt(selectedStudyId, 10)
      const res = await studyPaymentRuleService.overrideProgress(
        studyId,
        overrideContext.rule.id,
        payload,
      )
      if (res?.isSuccess) {
        toast.success("Override applied.")
        setOverrideContext(null)
        bumpListRefresh()
      } else {
        toast.error(res?.message || "Override failed.")
      }
    } catch (e) {
      toast.error(e?.message || "Override failed.")
    } finally {
      setOverrideSaving(false)
    }
  }

  const handleClearFilters = () => {
    setSearch("")
    setStatusFilter("")
    setAgreementDateFrom("")
    setAgreementDateTo("")
    setCompletionDateFrom("")
    setCompletionDateTo("")
    setSelectedStudyId("")
    setStudySearchInput("")
    setStudyTypeFilter("all")
    setPageNumber(1)
    setExpandedRowId(null)
    setPaymentEditRow(null)
  }

  const hasActiveFilters =
    !!selectedStudyId ||
    !!statusFilter ||
    !!debouncedSearch ||
    !!agreementDateFrom ||
    !!agreementDateTo ||
    !!completionDateFrom ||
    !!completionDateTo

  const handleExportCsv = useCallback(() => {
    if (!assertCanExport()) return
    if (!selectedStudyId || csvRunning) return
    const studyId = parseInt(selectedStudyId, 10)
    startReportExport({
      kind: "finance-report-csv",
      label: "Study finance (CSV)",
      task: async (setDetail) => {
        setError("")
        setDetail("Exporting…")
        try {
          await studyFinanceStatusService.exportCsv({
            studyId,
            search: debouncedSearch,
            status: statusFilter,
            agreementDateFrom,
            agreementDateTo,
            completionDateFrom,
            completionDateTo,
          })
        } catch (e) {
          console.error("Export study finance status failed:", e)
          const msg = e?.message || "Export failed. Please try again."
          setError(msg)
          throw e
        }
      },
    })
  }, [
    assertCanExport,
    csvRunning,
    selectedStudyId,
    debouncedSearch,
    statusFilter,
    agreementDateFrom,
    agreementDateTo,
    completionDateFrom,
    completionDateTo,
    startReportExport,
  ])

  const handleExportMilestoneExcel = useCallback(() => {
    if (!assertCanExport()) return
    if (!selectedStudyId || xlsxRunning || !isMilestoneStudyType) return
    const studyId = parseInt(selectedStudyId, 10)
    startReportExport({
      kind: "finance-report-xlsx",
      label: "Milestone finance (Excel)",
      task: async (setDetail) => {
        setError("")
        setDetail("Building Excel…")
        try {
          await studyFinanceStatusService.exportMilestoneExcel({
            studyId,
            search: debouncedSearch,
            status: statusFilter,
            agreementDateFrom,
            agreementDateTo,
            completionDateFrom,
            completionDateTo,
          })
        } catch (e) {
          console.error("Export milestone finance Excel failed:", e)
          const msg = e?.message || "Excel export failed. Please try again."
          setError(msg)
          throw e
        }
      },
    })
  }, [
    assertCanExport,
    xlsxRunning,
    isMilestoneStudyType,
    selectedStudyId,
    debouncedSearch,
    statusFilter,
    agreementDateFrom,
    agreementDateTo,
    completionDateFrom,
    completionDateTo,
    startReportExport,
  ])

  const handleExportZip = useCallback(() => {
    if (!assertCanExport()) return
    if (!selectedStudyId || zipRunning) return
    if (!showAgreementFeatures) {
      toast.error("Agreement is disabled for the selected study in Study Settings.")
      return
    }
    const studyId = parseInt(selectedStudyId, 10)
    startReportExport({
      kind: "finance-report-zip",
      label: "Study finance (agreements ZIP)",
      task: async (setDetail) => {
        setError("")
        setDetail("Building ZIP…")
        try {
          await studyFinanceStatusService.exportAgreementsZip(studyId)
        } catch (e) {
          console.error("Export agreements ZIP failed:", e)
          const msg = e?.message || "Export agreements ZIP failed. Please try again."
          setError(msg)
          throw e
        }
      },
    })
  }, [assertCanExport, selectedStudyId, showAgreementFeatures, zipRunning, startReportExport])

  const handleDownloadPaymentSample = async () => {
    if (!selectedStudyId) return
    try {
      setError("")
      await studyFinanceStatusService.exportPaymentTemplate(parseInt(selectedStudyId, 10))
    } catch (e) {
      console.error("Export payment template failed:", e)
      setError(e?.message || "Failed to download payment template. Please try again.")
    }
  }

  const handleImportPaymentsClick = () => {
    if (!selectedStudyId || importingPayments) return
    importInputRef.current?.click()
  }

  const handleImportPaymentsFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file || !selectedStudyId) return

    try {
      setError("")
      setImportSummary(null)
      setImportFile(file)

      const text = await file.text()
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
      if (lines.length <= 1) {
        setError("Import file is empty or missing rows.")
        setImportPreview(null)
        return
      }

      const headers = lines[0].split(",").map((h) => h.trim())
      const rows = lines.slice(1).map((line, idx) => ({
        rowNumber: idx + 2, // 1 = header, so data starts at 2
        values: line.split(","),
      }))

      const validation = validatePaymentImportCsv({
        headers,
        studyUsesPaymentRules,
      })

      setImportPreview({ headers, rows, ...validation })
      setImportPreviewPage(1)
    } catch (e) {
      console.error("Failed to read import file:", e)
      setError("Failed to read payment CSV file. Please check the format.")
      setImportPreview(null)
      setImportFile(null)
    }
  }

  const handleConfirmImportPayments = async () => {
    if (!selectedStudyId || !importFile) return
    if ((importPreview?.errors ?? []).length > 0) {
      setError(importPreview.errors[0])
      return
    }

    setImportingPayments(true)
    try {
      setError("")
      const result = await studyFinanceStatusService.importPaymentDetails(
        parseInt(selectedStudyId, 10),
        importFile,
      )
      const payload = result?.data || result
      if (payload) {
        const summary = {
          totalRows: payload.totalRows,
          updatedRows: payload.updatedRows,
          errors: payload.errors || [],
        }
        setImportSummary(summary)
        setImportResultTab((summary.errors || []).length > 0 ? "failed" : "success")
        setImportResultPage(1)
        const baseMsg = `Import applied: ${summary.updatedRows}/${summary.totalRows} rows updated`
        if ((summary.errors || []).length > 0) {
          toast.warning(`${baseMsg}. Some rows failed.`, { duration: 2000 })
        } else {
          toast.success(baseMsg, { duration: 2000 })
        }
        bumpListRefresh()
      } else {
        setImportSummary(null)
      }
      setPageNumber(1)
    } catch (e) {
      console.error("Failed to import payments:", e)
      const msg = e?.message || "Failed to import payment status file. Please check the format."
      setError(msg)
      toast.error(msg, { duration: 2000 })
      setImportSummary(null)
    } finally {
      setImportingPayments(false)
    }
  }

  const handleDownloadAgreementForRow = async (row) => {
    if (!showAgreementFeatures) {
      toast.error("Agreement is disabled for the selected study in Study Settings.")
      return
    }
    if (!selectedStudyId || !row?.userId) return
    try {
      setError("")
      setDownloadingAgreementUserId(row.userId)
      const studyIdInt = parseInt(selectedStudyId, 10)
      const res = await userAgreementService.downloadAgreementPdfForUser(studyIdInt, row.userId)
      if (!res?.isSuccess) {
        setError(res?.message || "Failed to download agreement for this CRC user.")
      }
    } catch (e) {
      console.error("Download agreement for CRC user failed:", e)
      setError(e?.message || "Failed to download agreement for this CRC user.")
    } finally {
      setDownloadingAgreementUserId(null)
    }
  }

  const renderSummaryCard = (title, primary, secondary, icon, gradientClasses) => {
    return (
      <div className="relative overflow-hidden rounded-2xl p-4 hover:scale-[1.02] transition-all duration-300 group">
        <div
          className={`absolute inset-0 ${gradientClasses} backdrop-blur-xl border border-white/40 shadow-lg`}
        />
        <div className="absolute inset-0 bg-white/30 backdrop-blur-sm" />
        <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/20 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-2">
            <div className="p-1.5 rounded-xl bg-white/60 backdrop-blur-md border border-white/70 shadow-md">
              {icon}
            </div>
            <span className="text-2xl font-bold text-slate-900 drop-shadow-sm">
              {summaryLoading ? "…" : primary}
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-800">{title}</p>
          {secondary && <p className="text-[11px] text-slate-700 mt-0.5">{secondary}</p>}
        </div>
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className={`${REPORT_PAGE_SHELL_CLASS} space-y-6`}>
        {/* Header + tabs */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{pageInfo.title}</h1>
              <p className="text-slate-600 text-sm">{pageInfo.description}</p>
            </div>
          </div>
          {selectedStudyId && !showAgreementFeatures && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Agreement is disabled for this study in Study Settings. Agreement filters, downloads, and
              summary are hidden.
            </div>
          )}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 w-fit">
            <button
              type="button"
              onClick={() => setActiveTab("summary")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "summary"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-800"
              }`}
            >
              Summary
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("listing")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === "listing"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-800"
              }`}
            >
              Listing
            </button>
          </div>
        </div>

        {/* Study Type selector (drives which studies appear in the dropdown) */}
        {activeTab === "listing" && (
          <div className="mt-4 mb-3">
            <label className="flex items-center gap-1 text-sm font-bold text-slate-700 mb-2">
              Study Type
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: "normal", label: "Normal" },
                { id: "milestonePatient", label: "Milestone (Patient Wise)" },
                { id: "milestoneVisit", label: "Milestone (Visit Wise)" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setStudyTypeFilter(opt.id)
                    setExpandedRowId(null)
                    setSelectedStudyId("")
                    setPageNumber(1)
                  }}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                    studyTypeFilter === opt.id
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filters Section (like Patient details) */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 mb-6">
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 px-6 py-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-emerald-600" />
                <h2 className="text-lg font-bold text-slate-800">Filter Criteria</h2>
              </div>
              <div className="flex items-center gap-2">
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Clear Filters
                  </button>
                )}
                {activeTab === "listing" && selectedStudyId && (
                  <>
                    <ReportDownloadActions
                      canExport={canExport}
                      reportKey={reportKey}
                      assertCanExport={assertCanExport}
                      defaultSubject="Finance Report"
                      defaultFormat={isMilestoneStudyType ? "excel" : "csv"}
                      enabledFormats={
                        isMilestoneStudyType ? ["csv", "excel"] : ["csv"]
                      }
                      disabled={!selectedStudyId}
                      busy={csvRunning || xlsxRunning || zipRunning}
                      buttonClassName="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-60"
                      onExport={async ({ format }) => {
                        if (format === "excel") {
                          handleExportMilestoneExcel()
                          return
                        }
                        if (format === "csv") {
                          handleExportCsv()
                        }
                      }}
                    />
                    {showAgreementFeatures && (
                      <ReportExportGate canExport={canExport} reportKey={reportKey}>
                        <button
                          type="button"
                          onClick={handleExportZip}
                          disabled={zipRunning || csvRunning || xlsxRunning}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors disabled:opacity-60"
                        >
                          {zipRunning ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Archive className="w-4 h-4" />
                          )}
                          Agreements ZIP
                        </button>
                      </ReportExportGate>
                    )}
                    <button
                      type="button"
                      onClick={handleRecalculateRules}
                      disabled={paymentRulesBusy || !canExport}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors disabled:opacity-60"
                    >
                      {paymentRulesBusy ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RotateCcw className="w-4 h-4" />
                      )}
                      Recalculate rules
                    </button>
                    <button
                      type="button"
                      onClick={handleMigrateLegacyRules}
                      disabled={paymentRulesBusy || !canExport}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors disabled:opacity-60"
                    >
                      {paymentRulesBusy ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Database className="w-4 h-4" />
                      )}
                      Migrate legacy
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadPaymentSample}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                    >
                      <FileDown className="w-4 h-4" />
                      Download payment template
                    </button>
                    <button
                      type="button"
                      onClick={handleImportPaymentsClick}
                      disabled={importingPayments}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors disabled:opacity-60"
                    >
                      {importingPayments ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      {importPreview ? "Change CSV" : "Import Payments CSV"}
                    </button>
                    <input
                      ref={importInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleImportPaymentsFile}
                      className="hidden"
                    />
                  </>
                )}
              </div>
            </div>
            {activeTab === "listing" && selectedStudyId && studyUsesPaymentRules ? (
              <p className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50/80 px-3 py-2 text-xs text-indigo-900">
                {PAYMENT_CSV_RULES_HINT}
              </p>
            ) : null}
          </div>

          <div className="p-6">
            <div
              className={`grid grid-cols-1 ${
                activeTab === "listing" ? "md:grid-cols-3" : "md:grid-cols-1"
              } gap-5`}
            >
              {/* Study dropdown with search inside (like Patient Details report) */}
              <div className="space-y-2 max-w-md">
                <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                  Study <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => !loadingStudies && !disableStudySelect && setIsStudyDropdownOpen((v) => !v)}
                    disabled={loadingStudies || disableStudySelect}
                    className={`w-full px-4 py-2.5 rounded-xl border-2 text-left bg-white transition-all flex items-center justify-between gap-2 outline-none focus-visible:outline-none ${
                      disableStudySelect
                        ? "border-slate-200 text-slate-400 cursor-not-allowed opacity-70"
                        : "border-slate-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    }`}
                  >
                    <span className={selectedStudyId ? "text-slate-800" : "text-slate-400"}>
                      {disableStudySelect
                        ? "Select Study Type first"
                        : loadingStudies
                          ? "Loading..."
                          : selectedStudyId
                            ? studies.find((s) => s.studyId === parseInt(selectedStudyId))?.studyProtocolNumber ||
                              studies.find((s) => s.studyId === parseInt(selectedStudyId))?.studyName ||
                              `Study ${selectedStudyId}`
                            : "Select Study"}
                    </span>
                    <span className="text-slate-400 shrink-0" aria-hidden>
                      {isStudyDropdownOpen ? "▲" : "▼"}
                    </span>
                  </button>
                  {isStudyDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-[99]"
                        onClick={() => {
                          setIsStudyDropdownOpen(false)
                          setStudySearchInput("")
                        }}
                      />
                      <div
                        className="absolute top-full left-0 right-0 z-[100] w-full min-w-full bg-white border-2 border-slate-200 rounded-xl shadow-xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Search bar inside dropdown - like second image */}
                        <div className="p-3 border-b border-slate-200 sticky top-0 bg-white z-10">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            <input
                              type="text"
                              value={studySearchInput}
                              onChange={(e) => setStudySearchInput(e.target.value)}
                              onKeyDown={(e) => e.stopPropagation()}
                              placeholder="Search studies..."
                              className="w-full pl-10 pr-4 py-2.5 rounded-lg border-2 border-slate-200 text-sm text-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
                            />
                          </div>
                        </div>
                        <div className="max-h-72 overflow-y-auto">
                          {loadingStudies ? (
                            <div className="px-4 py-3 text-sm text-slate-500">Loading studies...</div>
                          ) : studies.length === 0 ? (
                            <div className="px-4 py-3 text-sm text-slate-500">No studies available</div>
                          ) : (
                            <>
                              {studies
                                .filter((study) => {
                                  if (!studySearchInput.trim()) return true
                                  const q = studySearchInput.toLowerCase().trim()
                                  return (
                                    (study.studyProtocolNumber?.toLowerCase().includes(q) ||
                                      study.studyName?.toLowerCase().includes(q) ||
                                      String(study.studyId).includes(q))
                                  )
                                })
                                .map((study) => (
                                  <button
                                    key={study.studyId}
                                    type="button"
                                    onClick={() => {
                                      setSelectedStudyId(String(study.studyId))
                                      setPageNumber(1)
                                      setIsStudyDropdownOpen(false)
                                      setStudySearchInput("")
                                    }}
                                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-emerald-50 transition-colors border-b border-slate-100 last:border-b-0 ${
                                      selectedStudyId === String(study.studyId) ? "bg-emerald-50 font-semibold" : ""
                                    }`}
                                  >
                                    <div className="font-medium text-slate-900">
                                      {study.studyProtocolNumber || `Study ${study.studyId}`}
                                    </div>
                                    {study.studyName && (
                                      <div className="text-xs text-slate-500 mt-0.5">{study.studyName}</div>
                                    )}
                                  </button>
                                ))}
                            </>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {activeTab === "listing" && (
                <>
                  {/* CRC Status filter */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                      CRC Status
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={statusSearchInput || (statusFilter || "None")}
                        onChange={(e) => {
                          setStatusSearchInput(e.target.value)
                          setIsStatusDropdownOpen(true)
                        }}
                        onFocus={() => {
                          if (!isStatusDropdownOpen) {
                            setIsStatusDropdownOpen(true)
                          }
                        }}
                        placeholder="None / Pending / Ongoing / Completed"
                        disabled={activeTab === "listing" && (!isStudyTypeSelected || !selectedStudyId)}
                        className={`w-full px-4 py-2.5 rounded-xl border-2 bg-white text-sm focus:ring-4 outline-none cursor-pointer transition-all ${
                          !isStudyTypeSelected || !selectedStudyId
                            ? "border-slate-200 text-slate-400 cursor-not-allowed opacity-70"
                            : "border-slate-200 text-slate-800 focus:border-emerald-500 focus:ring-emerald-100"
                        }`}
                      />
                      {isStatusDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => {
                              setIsStatusDropdownOpen(false)
                              setStatusSearchInput("")
                            }}
                          />
                          <div
                            className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-auto"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {["", "Pending", "Ongoing", "Completed"]
                              .filter((value) => {
                                const label = value || "None"
                                if (!statusSearchInput) return true
                                return label.toLowerCase().includes(statusSearchInput.toLowerCase())
                              })
                              .map((value) => {
                                const label = value || "None"
                                return (
                                  <button
                                    key={label}
                                    type="button"
                                    onClick={() => {
                                      setStatusFilter(value)
                                      setPageNumber(1)
                                      setIsStatusDropdownOpen(false)
                                      setStatusSearchInput("")
                                    }}
                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 transition-colors ${
                                      statusFilter === value ? "bg-emerald-50 font-semibold" : ""
                                    }`}
                                  >
                                    {label}
                                  </button>
                                )
                              })}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Search input */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                      Search
                    </label>
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value)
                        setPageNumber(1)
                      }}
                      placeholder="Search by CRC name, email or site..."
                      disabled={activeTab === "listing" && (!isStudyTypeSelected || !selectedStudyId)}
                      className={`w-full px-4 py-2.5 rounded-xl border-2 bg-white text-sm focus:ring-4 outline-none transition-all ${
                        !isStudyTypeSelected || !selectedStudyId
                          ? "border-slate-200 text-slate-400 cursor-not-allowed opacity-70"
                          : "border-slate-200 text-slate-800 focus:border-emerald-500 focus:ring-emerald-100"
                      }`}
                    />
                  </div>

                  {/* Agreement Date & Study Completion Date - same row on larger screens */}
                  <div
                    className={`md:col-span-3 grid grid-cols-1 sm:grid-cols-2 ${
                      showAgreementFeatures ? "lg:grid-cols-4" : "lg:grid-cols-2"
                    } gap-4 pt-2 border-t border-slate-100`}
                  >
                    {showAgreementFeatures && (
                      <>
                        <div className="space-y-2">
                          <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                            Agreement Date From
                          </label>
                          <DatePicker
                            value={agreementDateFrom || null}
                            onChange={(val) => {
                              setAgreementDateFrom(val || "")
                              setPageNumber(1)
                            }}
                            disabled={activeTab === "listing" && (!isStudyTypeSelected || !selectedStudyId)}
                            className={`bg-white text-sm ${
                              !isStudyTypeSelected || !selectedStudyId
                                ? "border-slate-200 text-slate-400 cursor-not-allowed opacity-70"
                                : "border-slate-200 text-slate-800 focus-visible:border-emerald-500 focus-visible:ring-emerald-100"
                            }`}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                            Agreement Date To
                          </label>
                          <DatePicker
                            value={agreementDateTo || null}
                            onChange={(val) => {
                              setAgreementDateTo(val || "")
                              setPageNumber(1)
                            }}
                            disabled={activeTab === "listing" && (!isStudyTypeSelected || !selectedStudyId)}
                            className={`bg-white text-sm ${
                              !isStudyTypeSelected || !selectedStudyId
                                ? "border-slate-200 text-slate-400 cursor-not-allowed opacity-70"
                                : "border-slate-200 text-slate-800 focus-visible:border-emerald-500 focus-visible:ring-emerald-100"
                            }`}
                          />
                        </div>
                      </>
                    )}
                    <div className="space-y-2">
                      <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                        Study Completion Date From
                      </label>
                      <DatePicker
                        value={completionDateFrom || null}
                        onChange={(val) => {
                          setCompletionDateFrom(val || "")
                          setPageNumber(1)
                        }}
                        disabled={activeTab === "listing" && (!isStudyTypeSelected || !selectedStudyId)}
                        className={`bg-white text-sm ${
                          !isStudyTypeSelected || !selectedStudyId
                            ? "border-slate-200 text-slate-400 cursor-not-allowed opacity-70"
                            : "border-slate-200 text-slate-800 focus-visible:border-emerald-500 focus-visible:ring-emerald-100"
                        }`}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                        Study Completion Date To
                      </label>
                      <DatePicker
                        value={completionDateTo || null}
                        onChange={(val) => {
                          setCompletionDateTo(val || "")
                          setPageNumber(1)
                        }}
                        disabled={activeTab === "listing" && (!isStudyTypeSelected || !selectedStudyId)}
                        className={`bg-white text-sm ${
                          !isStudyTypeSelected || !selectedStudyId
                            ? "border-slate-200 text-slate-400 cursor-not-allowed opacity-70"
                            : "border-slate-200 text-slate-800 focus-visible:border-emerald-500 focus-visible:ring-emerald-100"
                        }`}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* SUMMARY TAB - show counts; default 0 when no study selected */}
        {activeTab === "summary" && (
          <div className="space-y-5">
            {!selectedStudyId && (
              <p className="text-sm text-slate-500">Select a study above to load counts.</p>
            )}
            {showAgreementFeatures && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-slate-700 mb-2">Agreement Summary</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {renderSummaryCard(
                    "Completed",
                    selectedStudyId ? (summary?.agreementCompleted ?? 0) : 0,
                    "",
                    <DollarSign className="w-5 h-5 text-orange-700" />,
                    "bg-gradient-to-br from-orange-200/70 via-orange-300/70 to-orange-400/70"
                  )}
                </div>
              </div>
            )}

            {/* CRC / Investigator summary */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-700 mb-2">Investigator Summary</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-3">
                {renderSummaryCard(
                  "Planned",
                  selectedStudyId ? (summary?.crcPlanned ?? 0) : 0,
                  "",
                  <Users className="w-5 h-5 text-emerald-700" />,
                  "bg-gradient-to-br from-emerald-200/70 via-emerald-300/70 to-emerald-400/70"
                )}
                {renderSummaryCard(
                  "Pending",
                  selectedStudyId ? (summary?.crcPending ?? 0) : 0,
                  "",
                  <Clock className="w-5 h-5 text-teal-700" />,
                  "bg-gradient-to-br from-teal-200/70 via-teal-300/70 to-teal-400/70"
                )}
                {renderSummaryCard(
                  "Ongoing",
                  selectedStudyId ? (summary?.crcOngoing ?? 0) : 0,
                  "",
                  <Clock className="w-5 h-5 text-blue-700" />,
                  "bg-gradient-to-br from-blue-200/70 via-blue-300/70 to-blue-400/70"
                )}
                {renderSummaryCard(
                  "Completed",
                  selectedStudyId ? (summary?.crcCompleted ?? 0) : 0,
                  "",
                  <CheckCircle2 className="w-5 h-5 text-green-700" />,
                  "bg-gradient-to-br from-green-200/70 via-green-300/70 to-green-400/70"
                )}
              </div>
            </div>

            {/* Patient summary */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-700 mb-2">Patient Summary</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-3">
                {renderSummaryCard(
                  "Planned",
                  selectedStudyId ? (summary?.patientPlanned ?? 0) : 0,
                  "",
                  <Users className="w-5 h-5 text-teal-700" />,
                  "bg-gradient-to-br from-teal-200/70 via-teal-300/70 to-teal-400/70"
                )}
                {renderSummaryCard(
                  "Pending",
                  selectedStudyId ? (summary?.patientPending ?? 0) : 0,
                  "",
                  <Clock className="w-5 h-5 text-orange-700" />,
                  "bg-gradient-to-br from-orange-200/70 via-orange-300/70 to-orange-400/70"
                )}
                {renderSummaryCard(
                  "Ongoing",
                  selectedStudyId ? (summary?.patientOngoing ?? 0) : 0,
                  "",
                  <Clock className="w-5 h-5 text-pink-700" />,
                  "bg-gradient-to-br from-pink-200/70 via-pink-300/70 to-pink-400/70"
                )}
                {renderSummaryCard(
                  "Completed",
                  selectedStudyId ? (summary?.patientCompleted ?? 0) : 0,
                  "",
                  <CheckCircle2 className="w-5 h-5 text-green-700" />,
                  "bg-gradient-to-br from-green-200/70 via-green-300/70 to-green-400/70"
                )}
              </div>
            </div>
          </div>
        )}

        {/* LISTING TAB */}
        {activeTab === "listing" && isStudyTypeSelected && selectedStudyId && (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
            <div className="bg-gradient-to-r from-slate-100 to-slate-50 px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">
                Finance Status Listing
                {totalCount > 0 && ` (${totalCount} total)`}
              </h2>
            </div>

            {error && (
              <div className="px-6 py-3 text-xs sm:text-sm bg-red-50 border-b border-red-100 text-red-700">
                {error}
              </div>
            )}
            {successMessage && (
              <div className="px-6 py-3 text-xs sm:text-sm bg-emerald-50 border-b border-emerald-100 text-emerald-700">
                {successMessage}
              </div>
            )}

            {listLoading ? (
              <SectionSkeleton title="Loading finance status..." rows={7} variant="finance" />
            ) : items.length === 0 ? (
              <div className="text-center py-16">
                <Users className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600 font-medium mb-2">
                  {items.length > 0 && studyTypeFilter !== "all"
                    ? "No rows match this Study Type on the current page"
                    : "No records found"}
                </p>
                <p className="text-slate-500 text-sm">
                  {items.length > 0 && studyTypeFilter !== "all"
                    ? "Try All or another Study Type, or change page / filters."
                    : hasActiveFilters
                      ? "Try adjusting your filters to see more results."
                      : "No CRC / finance records for this study."}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1100px]">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="pl-3 pr-2 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide sm:pl-4">
                          Study No.
                        </th>
                        <th className="w-8 px-0 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wide" aria-label="Expand row" />
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                          Investigator Name
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                          Frontline Investigator Code
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                          Patients (Planned / Enrolled / Completed)
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                          PAN Card
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                          Amount
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                          SAP Vendor Code
                        </th>
                        {showAgreementFeatures && (
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            Agreement Date
                          </th>
                        )}
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                          Study Completion Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                          Investigator Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                          User Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                          Payment Status
                        </th>
                        {showAgreementFeatures && (
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            Agreement Completed
                          </th>
                        )}
                        {studyTypeFilter === "normal" && (
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wide">
                            Payment
                          </th>
                        )}
                      </tr>
                    </thead>
                  <tbody className="bg-white divide-y divide-slate-100 text-sm">
                    {items.map((row) => {
                      const rowId = row.studyUserId ?? row.id
                      const paymentRules = getRowPaymentRules(row)
                      const hasPaymentRules = paymentRules.length > 0
                      const hasMilestones =
                        !hasPaymentRules && Array.isArray(row.milestones) && row.milestones.length > 0
                      const hasVisits =
                        !hasPaymentRules &&
                        row.visits != null &&
                        (Array.isArray(row.visits) ? row.visits.length > 0 : true)
                      const canExpand = hasPaymentRules || hasMilestones || hasVisits
                      const isExpanded = expandedRowId === rowId

                        const totalPatients = row.noOfPlannedPatients || 0
                        const enrolled = row.enrolledPatients || 0
                        const completed = row.completedPatients || 0
                        const totalHonorarium = row.totalHonorariumAmount || 0
                        const status = row.status || "Pending"
                        const agreementSigned = !!row.isAgreementSigned
                        const userStatusLabel = row.isActive ? "Active" : "Inactive"
                        const userStatusColor = row.isActive
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-50 text-slate-600 border-slate-200"
                        const statusColor =
                          status === "Completed"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : status === "Ongoing"
                            ? "bg-sky-50 text-sky-700 border-sky-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                      const agreementDate = row.signedAt
                        ? new Date(row.signedAt).toLocaleDateString("en-IN")
                        : "—"
                      const paymentStatus = row.paymentStatus || "Unpaid"

                      const studyNoRaw = row.studyProtocolNumber?.trim() || ""
                      const studySegments =
                        studyNoRaw.length > 0 ? studyNoRaw.split("/").map((s) => s.trim()).filter(Boolean) : []
                      const lastSeg = studySegments[studySegments.length - 1] || ""
                      const splitStudyNo =
                        studySegments.length > 1 &&
                        lastSeg.length >= 6 &&
                        studySegments.slice(0, -1).join("/").length > 0

                      return (
                        <Fragment key={rowId}>
                          <tr className="hover:bg-slate-50/80 transition-colors">
                            <td className="min-w-0 max-w-[20rem] pl-3 pr-2 py-3 align-top sm:pl-4">
                              {studyNoRaw ? (
                                <div
                                  className="w-full rounded-lg border border-emerald-200/70 bg-gradient-to-br from-emerald-50/90 via-white to-slate-50/80 px-2.5 py-2 shadow-sm ring-1 ring-emerald-500/5"
                                  title={studyNoRaw}
                                >
                                  <span className="mb-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600/90">
                                    <BookMarked className="h-3 w-3 shrink-0" aria-hidden />
                                    Study
                                  </span>
                                  {splitStudyNo ? (
                                    <>
                                      <p className="text-sm font-semibold leading-snug text-emerald-950 break-words">
                                        {lastSeg}
                                      </p>
                                      <p className="mt-1 border-t border-emerald-100/80 pt-1 text-[11px] leading-snug text-slate-600 break-words">
                                        {studySegments.slice(0, -1).join(" · ")}
                                      </p>
                                    </>
                                  ) : (
                                    <p className="text-sm font-semibold leading-snug text-emerald-950 break-words">
                                      {studyNoRaw}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="w-8 px-0 py-3 text-center align-middle">
                              {canExpand ? (
                                <button
                                  type="button"
                                  onClick={() => setExpandedRowId(isExpanded ? null : rowId)}
                                  className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:border-slate-300"
                                  aria-label={isExpanded ? "Collapse payments" : "Expand payments"}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                </button>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2 text-slate-900 font-semibold">
                                <User2 className="w-4 h-4 text-emerald-500" />
                                <span className="truncate max-w-[220px]">
                                  {row.doctorName || row.userName || "—"}
                                </span>
                              </div>
                              <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                                <Mail className="w-3 h-3 text-slate-400" />
                                <span className="truncate max-w-[220px]">
                                  {row.email || row.emailId || "—"}
                                </span>
                              </div>
                              {row.phoneNumber || row.mobileNo ? (
                                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  <span>{row.phoneNumber || row.mobileNo}</span>
                                </div>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-slate-800">
                              {row.micrCode || "—"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-slate-800">
                              <div className="text-xs text-slate-600">
                                <span className="font-semibold">{completed}</span> completed ·{" "}
                                <span className="font-semibold">{enrolled}</span> enrolled
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {totalPatients}/{enrolled}/{completed} (planned/enrolled/completed)
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-slate-800">
                              {row.panNumber || "—"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-slate-800">
                              ₹{" "}
                              {Number(totalHonorarium).toLocaleString("en-IN", {
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-slate-800">
                              {row.sapVendorCode || "—"}
                            </td>
                            {showAgreementFeatures && (
                              <td className="px-4 py-3 whitespace-nowrap text-slate-800">
                                {agreementDate}
                              </td>
                            )}
                            <td className="px-4 py-3 whitespace-nowrap text-slate-800">
                              {(row.studyCompletionDate || row.completionDate)
                                ? new Date(row.studyCompletionDate || row.completionDate).toLocaleDateString(
                                    "en-IN",
                                  )
                                : "—"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusColor}`}
                              >
                                {status}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${userStatusColor}`}
                              >
                                {userStatusLabel}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                                  paymentStatus === "Paid"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : paymentStatus === "Partially Paid"
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-slate-50 text-slate-600 border-slate-200"
                                }`}
                              >
                                {paymentStatus === "Paid" ? (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                ) : (
                                  <Clock className="w-3.5 h-3.5" />
                                )}
                                <span>{paymentStatus}</span>
                              </span>
                            </td>
                            {showAgreementFeatures && (
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                                      agreementSigned
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        : "bg-slate-50 text-slate-500 border-slate-200"
                                    }`}
                                  >
                                    {agreementSigned ? "Yes" : "No"}
                                  </span>
                                  {agreementSigned && (
                                    <button
                                      type="button"
                                      onClick={() => handleDownloadAgreementForRow(row)}
                                      disabled={downloadingAgreementUserId === row.userId}
                                      className="inline-flex items-center justify-center rounded-full p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-emerald-600 transition-colors"
                                      title={
                                        downloadingAgreementUserId === row.userId
                                          ? "Downloading agreement..."
                                          : "Download signed agreement"
                                      }
                                    >
                                      {downloadingAgreementUserId === row.userId ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <FileDown className="w-4 h-4" />
                                      )}
                                    </button>
                                  )}
                                </div>
                              </td>
                            )}
                            {studyTypeFilter === "normal" && (
                              <td className="px-4 py-3 whitespace-nowrap text-right">
                                {/* Normal study listing only: show single payment icon.
                                    For milestone / visit listings, payments are handled inside the expanded tables only. */}
                                {!canExpand &&
                                  (() => {
                                  const hasPayment =
                                    !!row.chequeNumber ||
                                    !!row.documentNumber ||
                                    !!row.dateOfIssue ||
                                    !!row.chequeReceivedDate ||
                                    (row.paymentStatus && row.paymentStatus !== "Unpaid")

                                  const status = (row.paymentStatus || "").toLowerCase()
                                  const isPaid = status === "paid"
                                  const isPartial = status === "partially paid"

                                  const label = isPaid
                                    ? "View paid payment details"
                                    : hasPayment
                                    ? "Edit payment details"
                                    : "Add payment details"

                                  const baseClasses =
                                    "inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors"

                                  const paidClasses =
                                    "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300"

                                  const partialClasses =
                                    "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-300"

                                  const defaultClasses =
                                    "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300"

                                  const colorClasses = isPaid
                                    ? paidClasses
                                    : isPartial
                                    ? partialClasses
                                    : defaultClasses

                                  return (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPaymentEditRow(row)
                                        setPaymentForm({
                                          chequeNumber: row.chequeNumber || "",
                                          documentNumber: row.documentNumber || "",
                                          dateOfIssue: row.dateOfIssue || "",
                                          chequeReceivedDate: row.chequeReceivedDate || "",
                                          paymentStatus: row.paymentStatus || "Unpaid",
                                        })
                                      }}
                                      className={`${baseClasses} ${colorClasses}`}
                                      title={label}
                                      aria-label={label}
                                    >
                                      <CircleDollarSign className="w-4 h-4" />
                                    </button>
                                  )
                                  })()}
                              </td>
                            )}
                          </tr>
                          {isExpanded && canExpand && (
                            <tr key={`${rowId}-detail`} className="bg-slate-50/80">
                              <td colSpan={13} className="px-4 py-2">
                                <div className="space-y-4 max-h-60 overflow-y-auto pr-2">
                                  {hasPaymentRules && (
                                    <FinancePaymentRulesPanel
                                      rules={paymentRules}
                                      canCapturePayment={canExport}
                                      canOverride={canExport}
                                      onPaymentClick={(rule) => openPaymentForRule(row, rule)}
                                      onOverrideClick={(rule) =>
                                        setOverrideContext({ parentRow: row, rule })
                                      }
                                    />
                                  )}
                                  {hasMilestones && (
                                    <div>
                                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Milestones</h4>
                                      <div className="w-full">
                                        <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                                          <thead className="bg-slate-100">
                                            <tr>
                                              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">#</th>
                                              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Patients</th>
                                              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Amount</th>
                                              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Cheque No.</th>
                                              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Document No.</th>
                                              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Date of Issue</th>
                                              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Cheque Received</th>
                                              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Payment Status</th>
                                              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Payment</th>
                                            </tr>
                                          </thead>
                                          <tbody className="bg-white divide-y divide-slate-100">
                                            {row.milestones.map((m, idx) => {
                                              const mStatusLabel = m.paymentStatus || "Unpaid"
                                              const mStatus = mStatusLabel.toLowerCase()
                                              const mIsPaid = mStatus === "paid"
                                              const mIsPartial = mStatus === "partially paid"
                                              const baseClasses =
                                                "inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors"
                                              const paidClasses =
                                                "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300"
                                              const partialClasses =
                                                "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-300"
                                              const defaultClasses =
                                                "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300"
                                              const colorClasses = mIsPaid
                                                ? paidClasses
                                                : mIsPartial
                                                ? partialClasses
                                                : defaultClasses

                                              return (
                                                <tr key={m.id ?? idx}>
                                                  <td className="px-3 py-2 text-slate-800">{m.milestoneNo ?? idx + 1}</td>
                                                  <td className="px-3 py-2 text-slate-800">{m.noOfPatients ?? "—"}</td>
                                                  <td className="px-3 py-2 text-slate-800">
                                                    ₹{" "}
                                                    {Number(m.amount ?? 0).toLocaleString("en-IN", {
                                                      maximumFractionDigits: 2,
                                                    })}
                                                  </td>
                                                  <td className="px-3 py-2 text-slate-800">{m.chequeNumber ?? "—"}</td>
                                                  <td className="px-3 py-2 text-slate-800">{m.documentNumber ?? "—"}</td>
                                                  <td className="px-3 py-2 text-slate-800">
                                                    {m.dateOfIssue
                                                      ? new Date(m.dateOfIssue).toLocaleDateString("en-IN")
                                                      : "—"}
                                                  </td>
                                                  <td className="px-3 py-2 text-slate-800">
                                                    {m.chequeReceivedDate
                                                      ? new Date(m.chequeReceivedDate).toLocaleDateString("en-IN")
                                                      : "—"}
                                                  </td>
                                                  <td className="px-3 py-2">
                                                    <span
                                                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                                                        mIsPaid
                                                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                          : mIsPartial
                                                          ? "bg-amber-50 text-amber-700 border-amber-200"
                                                          : "bg-slate-50 text-slate-600 border-slate-200"
                                                      }`}
                                                    >
                                                      {mIsPaid ? (
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                      ) : (
                                                        <Clock className="w-3.5 h-3.5" />
                                                      )}
                                                      <span>{mStatusLabel}</span>
                                                    </span>
                                                  </td>
                                                  <td className="px-3 py-2 text-right">
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        setPaymentEditRow({
                                                          ...row,
                                                          siteMilestoneId: m.siteMilestoneId ?? m.id ?? null,
                                                          siteVisitId: null,
                                                        })
                                                        setPaymentForm({
                                                          chequeNumber: m.chequeNumber || row.chequeNumber || "",
                                                          documentNumber: m.documentNumber || row.documentNumber || "",
                                                          dateOfIssue: m.dateOfIssue || row.dateOfIssue || "",
                                                          chequeReceivedDate:
                                                            m.chequeReceivedDate || row.chequeReceivedDate || "",
                                                          paymentStatus: m.paymentStatus || row.paymentStatus || "Unpaid",
                                                        })
                                                      }}
                                                      className={`${baseClasses} ${colorClasses}`}
                                                      title="Add / edit payment for this milestone study"
                                                      aria-label="Add or edit payment"
                                                    >
                                                      <CircleDollarSign className="w-4 h-4" />
                                                    </button>
                                                  </td>
                                                </tr>
                                              )
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}
                                  {hasVisits && (
                                    <div>
                                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Visits</h4>
                                      <div className="w-full">
                                        <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                                          <thead className="bg-slate-100">
                                            <tr>
                                              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Visit</th>
                                              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Amount</th>
                                              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Cheque No.</th>
                                              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Document No.</th>
                                              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Date of Issue</th>
                                              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Cheque Received</th>
                                              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Payment Status</th>
                                              <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Payment</th>
                                            </tr>
                                          </thead>
                                          <tbody className="bg-white divide-y divide-slate-100">
                                            {(Array.isArray(row.visits) ? row.visits : []).map((v, idx) => {
                                              const vStatusLabel = v.paymentStatus || "Unpaid"
                                              const vStatus = vStatusLabel.toLowerCase()
                                              const vIsPaid = vStatus === "paid"
                                              const vIsPartial = vStatus === "partially paid"
                                              const baseClasses =
                                                "inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors"
                                              const paidClasses =
                                                "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300"
                                              const partialClasses =
                                                "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-300"
                                              const defaultClasses =
                                                "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300"
                                              const colorClasses = vIsPaid
                                                ? paidClasses
                                                : vIsPartial
                                                ? partialClasses
                                                : defaultClasses

                                              return (
                                                <tr key={v.id ?? idx}>
                                                  <td className="px-3 py-2 text-slate-800">
                                                    {v.visitNo ?? v.visit ?? idx + 1}
                                                  </td>
                                                  <td className="px-3 py-2 text-slate-800">
                                                    ₹{" "}
                                                    {Number(v.amount ?? 0).toLocaleString("en-IN", {
                                                      maximumFractionDigits: 2,
                                                    })}
                                                  </td>
                                                  <td className="px-3 py-2 text-slate-800">{v.chequeNumber ?? "—"}</td>
                                                  <td className="px-3 py-2 text-slate-800">{v.documentNumber ?? "—"}</td>
                                                  <td className="px-3 py-2 text-slate-800">
                                                    {v.dateOfIssue
                                                      ? new Date(v.dateOfIssue).toLocaleDateString("en-IN")
                                                      : "—"}
                                                  </td>
                                                  <td className="px-3 py-2 text-slate-800">
                                                    {v.chequeReceivedDate
                                                      ? new Date(v.chequeReceivedDate).toLocaleDateString("en-IN")
                                                      : "—"}
                                                  </td>
                                                  <td className="px-3 py-2">
                                                    <span
                                                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                                                        vIsPaid
                                                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                          : vIsPartial
                                                          ? "bg-amber-50 text-amber-700 border-amber-200"
                                                          : "bg-slate-50 text-slate-600 border-slate-200"
                                                      }`}
                                                    >
                                                      {vIsPaid ? (
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                      ) : (
                                                        <Clock className="w-3.5 h-3.5" />
                                                      )}
                                                      <span>{vStatusLabel}</span>
                                                    </span>
                                                  </td>
                                                  <td className="px-3 py-2 text-right">
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        setPaymentEditRow({
                                                          ...row,
                                                          siteMilestoneId: null,
                                                          siteVisitId: v.siteVisitId ?? v.id ?? null,
                                                        })
                                                        setPaymentForm({
                                                          chequeNumber: v.chequeNumber || row.chequeNumber || "",
                                                          documentNumber: v.documentNumber || row.documentNumber || "",
                                                          dateOfIssue: v.dateOfIssue || row.dateOfIssue || "",
                                                          chequeReceivedDate:
                                                            v.chequeReceivedDate || row.chequeReceivedDate || "",
                                                          paymentStatus: v.paymentStatus || row.paymentStatus || "Unpaid",
                                                        })
                                                      }}
                                                      className={`${baseClasses} ${colorClasses}`}
                                                      title="Add / edit payment for this visit study"
                                                      aria-label="Add or edit payment"
                                                    >
                                                      <CircleDollarSign className="w-4 h-4" />
                                                    </button>
                                                  </td>
                                                </tr>
                                              )
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 gap-3 border-t border-slate-200 bg-slate-50/50 text-sm text-slate-600">
                <div>
                  Showing{" "}
                  {totalCount === 0
                    ? "0"
                    : `${(pageNumber - 1) * pageSize + 1}–${Math.min(
                        pageNumber * pageSize,
                        totalCount
                      )}`}{" "}
                  of {totalCount} records
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span>Per page</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(parseInt(e.target.value, 10) || 10)
                        setPageNumber(1)
                      }}
                      className="px-2 py-1.5 rounded-lg border-2 border-slate-200 bg-white text-sm focus:border-emerald-500 outline-none"
                    >
                      {[10, 20, 50].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={pageNumber <= 1}
                      onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-lg border-2 border-slate-200 bg-white hover:bg-emerald-50 disabled:opacity-40 transition-colors"
                    >
                      Prev
                    </button>
                    <span className="font-medium">
                      Page {pageNumber} of {Math.max(totalPages, 1)}
                    </span>
                    <button
                      type="button"
                      disabled={pageNumber >= totalPages}
                      onClick={() => setPageNumber((p) => Math.min(totalPages || 1, p + 1))}
                      className="px-3 py-1.5 rounded-lg border-2 border-slate-200 bg-white hover:bg-emerald-50 disabled:opacity-40 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
              </>
            )}
          </div>
        )}

        {/* Payment Edit Modal for normal study rows */}
        {paymentEditRow && (
          <div className="fixed inset-0 z-[130] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <h3 className="text-base font-semibold text-slate-900">
                  {paymentEditRow?.sitePaymentRuleProgressId
                    ? "Payment rule cheque details"
                    : "Add Payment Details"}
                </h3>
                <button
                  type="button"
                  onClick={() => !savingPayment && setPaymentEditRow(null)}
                  className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!paymentEditRow) return
                  // simple required-field validation for payment details
                  if (
                    !paymentForm.chequeNumber ||
                    paymentForm.chequeNumber.length !== 6 ||
                    !paymentForm.documentNumber ||
                    !paymentForm.dateOfIssue ||
                    !paymentForm.chequeReceivedDate
                  ) {
                    setError("Please fill all payment fields. Cheque number must be 6 digits.")
                    return
                  }
                  setSavingPayment(true)
                  try {
                    const payload = {
                      studyId: Number(selectedStudyId),
                      studyUserId: paymentEditRow.studyUserId ?? paymentEditRow.id,
                      sitePaymentRuleProgressId: paymentEditRow.sitePaymentRuleProgressId ?? null,
                      siteMilestoneId: paymentEditRow.siteMilestoneId ?? null,
                      siteVisitId: paymentEditRow.siteVisitId ?? null,
                      chequeNumber: paymentForm.chequeNumber || null,
                      documentNumber: paymentForm.documentNumber || null,
                      dateOfIssue: formatApiDate(paymentForm.dateOfIssue),
                      chequeReceivedDate: formatApiDate(paymentForm.chequeReceivedDate),
                    }
                    const res = await studyFinanceStatusService.updateChequeDetails(payload)
                    if (res?.isSuccess) {
                      const updatedRow = res.data || res
                      // Update local list so UI reflects new payment fields; API returns full row dto
                      setItems((prev) =>
                        (prev || []).map((r) =>
                          (r.studyUserId ?? r.id) === (updatedRow.studyUserId ?? updatedRow.id)
                            ? updatedRow
                            : r
                        )
                      )
                      setPaymentEditRow(null)
                      setSuccessMessage("Payment details updated successfully.")
                      toast.success("Payment details updated successfully.", { duration: 2000 })
                      bumpListRefresh()
                    } else if (res?.message) {
                      setError(res.message)
                      toast.error(res.message, { duration: 2000 })
                    }
                  } catch (err) {
                    console.error("Failed to update payment status:", err)
                    const msg = "Failed to update payment details. Please try again."
                    setError(msg)
                    toast.error(msg, { duration: 2000 })
                  } finally {
                    setSavingPayment(false)
                  }
                }}
                className="px-5 py-4 space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Cheque Number
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={paymentForm.chequeNumber}
                      onChange={(e) =>
                        setPaymentForm((prev) => {
                          const onlyDigits = e.target.value.replace(/\D/g, "").slice(0, 6)
                          return { ...prev, chequeNumber: onlyDigits }
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
                    />
                    <div className="mt-1 text-[11px] text-slate-400 text-right">
                      {(paymentForm.chequeNumber?.length || 0)}/6
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Document Number
                    </label>
                    <input
                      type="text"
                      value={paymentForm.documentNumber}
                      onChange={(e) =>
                        setPaymentForm((prev) => ({ ...prev, documentNumber: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Date of Issue
                    </label>
                    <DatePicker
                      value={paymentForm.dateOfIssue || null}
                      onChange={(val) =>
                        setPaymentForm((prev) => ({ ...prev, dateOfIssue: val || "" }))
                      }
                      className="w-full rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Cheque Received Date
                    </label>
                    <DatePicker
                      value={paymentForm.chequeReceivedDate || null}
                      onChange={(val) =>
                        setPaymentForm((prev) => ({
                          ...prev,
                          chequeReceivedDate: val || "",
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => !savingPayment && setPaymentEditRow(null)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingPayment}
                    className="px-4 py-2 rounded-lg bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 inline-flex items-center gap-2"
                  >
                    {savingPayment && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{savingPayment ? "Saving..." : "Save"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
      {/* Bulk Payment Import Preview Modal */}
      {activeTab === "listing" && importPreview && (
        <div className="fixed inset-0 z-[135] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="flex h-[92vh] max-h-[92vh] w-[96vw] max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
              <h3 className="text-lg font-semibold text-slate-900">
                Bulk Payment Import Preview
              </h3>
              <button
                type="button"
                onClick={() => {
                  if (importingPayments) return
                  setImportPreview(null)
                  setImportFile(null)
                  setImportSummary(null)
                  setImportPreviewPage(1)
                  setImportResultPage(1)
                }}
                className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-5 py-4 text-sm text-slate-700">
              {(importPreview.errors?.length > 0 || importPreview.warnings?.length > 0) && (
                <div className="shrink-0 space-y-2">
                  {importPreview.errors?.map((msg) => (
                    <p
                      key={msg}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800"
                    >
                      {msg}
                    </p>
                  ))}
                  {importPreview.warnings?.map((msg) => (
                    <p
                      key={msg}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                    >
                      {msg}
                    </p>
                  ))}
                </div>
              )}
              <div className="flex shrink-0 items-center justify-between gap-2">
                <div className="font-semibold">
                  Previewing {importPreview.rows.length} rows
                  {studyUsesPaymentRules ? " (Id = SitePaymentRuleProgressId)" : ""}.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (importingPayments) return
                      setImportPreview(null)
                      setImportFile(null)
                      setImportSummary(null)
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmImportPayments}
                    disabled={importingPayments || (importPreview.errors?.length ?? 0) > 0}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {importingPayments && <Loader2 className="w-3 h-3 animate-spin" />}
                    <span>Apply Import</span>
                  </button>
                </div>
              </div>
              <div
                className={`flex min-h-0 flex-col ${
                  importSummary ? "min-h-[200px] flex-[1.1]" : "min-h-[280px] flex-1"
                }`}
              >
                <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 bg-white">
                  <table className="min-w-full text-xs">
                    <thead className="sticky top-0 z-10 bg-slate-100">
                      <tr>
                        <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600">Row</th>
                        {importPreview.headers.map((h) => (
                          <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.rows
                        .slice((importPreviewPage - 1) * 20, importPreviewPage * 20)
                        .map((r) => (
                        <tr key={r.rowNumber} className="border-t border-slate-100">
                          <td className="whitespace-nowrap px-3 py-2 text-slate-500">{r.rowNumber}</td>
                          {importPreview.headers.map((_, idx) => (
                            <td key={idx} className="whitespace-nowrap px-3 py-2 text-slate-700">
                              {r.values[idx] ?? ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {importPreview.rows.length > 20 && (
                <div className="flex shrink-0 items-center justify-end gap-3 text-xs text-slate-600">
                  <span>
                    Page {importPreviewPage} of{" "}
                    {Math.max(Math.ceil(importPreview.rows.length / 20), 1)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={importPreviewPage <= 1}
                      onClick={() =>
                        setImportPreviewPage((p) => Math.max(1, p - 1))
                      }
                      className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      disabled={
                        importPreviewPage >=
                        Math.ceil(importPreview.rows.length / 20)
                      }
                      onClick={() =>
                        setImportPreviewPage((p) =>
                          Math.min(
                            Math.ceil(importPreview.rows.length / 20),
                            p + 1,
                          )
                        )
                      }
                      className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
              {importSummary && (
                <div className="flex min-h-0 flex-1 flex-col space-y-2 rounded-lg bg-slate-100 px-3 py-2">
                  <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-700">
                      Total: {importSummary.totalRows} rows ·{" "}
                      <span className="text-emerald-700">
                        {importSummary.updatedRows} successful
                      </span>{" "}
                      ·{" "}
                      <span className="text-red-600">
                        {Math.max(
                          importSummary.totalRows - importSummary.updatedRows,
                          0,
                        )}{" "}
                        failed
                      </span>
                    </div>
                    {/* Toggle like Summary / Listing */}
                    <div className="inline-flex rounded-xl bg-slate-100 p-1 w-fit">
                      <button
                        type="button"
                        onClick={() => {
                          setImportResultTab("success")
                          setImportResultPage(1)
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                          importResultTab === "success"
                            ? "bg-white text-emerald-700 shadow-sm"
                            : "text-slate-600 hover:text-slate-800"
                        }`}
                      >
                        Successful
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setImportResultTab("failed")
                          setImportResultPage(1)
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                          importResultTab === "failed"
                            ? "bg-white text-emerald-700 shadow-sm"
                            : "text-slate-600 hover:text-slate-800"
                        }`}
                      >
                        Failed
                      </button>
                    </div>
                  </div>

                  {/* Result grids with pagination (easy for 200k+ rows) */}
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
                    {(() => {
                      const perPage = 10
                      const errorRows = importSummary.errors || []
                      const errorRowNumbers = new Set(
                        errorRows.map((e) => e.rowNumber),
                      )
                      const successRows = importPreview
                        ? importPreview.rows.filter(
                            (r) => !errorRowNumbers.has(r.rowNumber),
                          )
                        : []

                      const sourceList =
                        importResultTab === "failed" ? errorRows : successRows

                      const totalPages = Math.max(
                        Math.ceil(sourceList.length / perPage),
                        1,
                      )
                      const currentPage = Math.min(
                        importResultPage,
                        totalPages,
                      )
                      const paged = sourceList.slice(
                        (currentPage - 1) * perPage,
                        currentPage * perPage,
                      )

                      const start = (currentPage - 1) * perPage + 1
                      const end = Math.min(currentPage * perPage, sourceList.length)

                      return (
                        <>
                          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-600">
                            <span>
                              Showing {sourceList.length ? start : 0}–{end} of{" "}
                              {sourceList.length} {importResultTab === "failed" ? "failed" : "successful"}{" "}
                              rows
                            </span>
                            {sourceList.length > perPage && (
                              <span>
                                Page {currentPage} of {totalPages}
                              </span>
                            )}
                          </div>
                          <div className="min-h-0 flex-1 overflow-auto">
                          <table className="min-w-full text-xs">
                            <thead className="sticky top-0 z-10 bg-slate-100">
                              {importResultTab === "failed" ? (
                                <tr>
                                  <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600">
                                    Row
                                  </th>
                                  <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600">
                                    Id
                                  </th>
                                  <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600">
                                    StudyUserId
                                  </th>
                                  <th className="min-w-[320px] px-3 py-2 text-left font-semibold text-slate-600">
                                    Reason
                                  </th>
                                </tr>
                              ) : (
                                <tr>
                                  <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600">
                                    Row
                                  </th>
                                  {importPreview?.headers.map((h) => (
                                    <th
                                      key={h}
                                      className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600"
                                    >
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              )}
                            </thead>
                            <tbody>
                              {importResultTab === "failed"
                                ? paged.map((err, idx) => (
                                    <tr
                                      key={`${err.rowNumber}-${idx}`}
                                      className="border-t border-slate-100 bg-red-50/40"
                                    >
                                      <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                                        {err.rowNumber}
                                      </td>
                                      <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                                        {err.id ?? "—"}
                                      </td>
                                      <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                                        {err.studyUserId ?? "—"}
                                      </td>
                                      <td className="px-3 py-2 text-red-700">
                                        {err.error}
                                      </td>
                                    </tr>
                                  ))
                                : paged.map((row) => (
                                    <tr
                                      key={row.rowNumber}
                                      className="border-t border-slate-100"
                                    >
                                      <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                                        {row.rowNumber}
                                      </td>
                                      {importPreview?.headers.map((_, idx) => (
                                        <td
                                          key={idx}
                                          className="whitespace-nowrap px-3 py-2 text-slate-700"
                                        >
                                          {row.values[idx] ?? ""}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                            </tbody>
                          </table>
                          </div>
                          {sourceList.length > perPage && (
                            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
                              <span>
                                Page {currentPage} of {totalPages}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={currentPage <= 1}
                                  onClick={() =>
                                    setImportResultPage((p) =>
                                      Math.max(1, p - 1),
                                    )
                                  }
                                  className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"
                                >
                                  Prev
                                </button>
                                <button
                                  type="button"
                                  disabled={currentPage >= totalPages}
                                  onClick={() =>
                                    setImportResultPage((p) =>
                                      Math.min(totalPages, p + 1),
                                    )
                                  }
                                  className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"
                                >
                                  Next
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <PaymentRuleOverrideDialog
        open={Boolean(overrideContext)}
        onOpenChange={(open) => {
          if (!open) setOverrideContext(null)
        }}
        rule={overrideContext?.rule}
        saving={overrideSaving}
        onSubmit={handleOverrideSubmit}
      />
    </DashboardLayout>
  )
}

