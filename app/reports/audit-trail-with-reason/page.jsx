"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import DataPagination from "@/components/ui/data-pagination"
import SectionSkeleton from "@/components/ui/section-skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import DatePicker from "@/components/ui/date-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import reportsService from "@/lib/services/reports.service"
import studyService from "@/lib/services/study.service"
import siteService from "@/lib/services/site.service"
import userService from "@/lib/services/user.service"
import studyUserService from "@/lib/services/studyUser.service"
import patientEnrolmentService from "@/lib/services/patientEnrolment.service"
import { authService } from "@/lib/services"
import { toast } from "sonner"
import { Filter, Loader2, Search, Shield, X } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  REPORT_FILTER_FIELD_CLASS,
  REPORT_FILTER_GRID_4_CLASS,
  REPORT_PAGE_SIZE_OPTIONS,
  REPORT_PREMIUM_PANEL_CLASS,
  REPORT_PREMIUM_PANEL_HEADER_CLASS,
  REPORT_PREMIUM_TABLE_SCROLL_CLASS,
  REPORT_PREMIUM_TH_CLASS,
  REPORT_SELECT_TRIGGER_CLASS,
  REPORT_PAGE_SHELL_WITH_BG_CLASS,
} from "@/lib/reports/studySitePatientReportUi"
import {
  getAuditTrailReasonChangedByLabel,
  pickDtoField,
  toReportDisplay,
} from "@/lib/reports/reportRowDisplay"
import ReportDenseCopyCell from "@/components/reports/ReportDenseCopyCell"
import { useInlineDualExport } from "@/lib/hooks/useInlineDualExport"
import { useReportExportAccess } from "@/app/reports/_hooks/useReportExportAccess"
import ReportDownloadActions, { REPORT_CSV_PDF_FORMATS } from "@/components/reports/ReportDownloadActions"

const INITIAL_FILTERS = {
  searchEntityName: "",
  studyId: "",
  siteId: "",
  patientId: "",
  visitId: "",
  crfId: "",
  crfDataId: "",
  userId: "",
  module: "",
  dateFrom: "",
  dateTo: "",
  pageNumber: 1,
  pageSize: 10,
}

const AUDIT_TRAIL_MODULE_OPTIONS = [
  { value: "ECRF", label: "ECRF" }, // AuditTrailModule.ECRF
]

const parseIsoDate = (value) => {
  if (!value) return null
  const [year, month, day] = String(value).split("-").map((part) => Number(part))
  if (!year || !month || !day) return null
  const parsed = new Date(year, month - 1, day)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export default function AuditTrailWithReasonPage() {
  const pathname = usePathname()
  const { canExport, assertCanExport, reportKey, withWorkspace } = useReportExportAccess()
  const currentUser = authService.getUser?.() || {}
  const currentUserId = useMemo(() => {
    const raw = currentUser?.id ?? currentUser?.userId ?? currentUser?.UserId
    const parsed = parseInt(String(raw ?? ""), 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }, [currentUser?.id, currentUser?.userId, currentUser?.UserId])
  const isAdminOrSuperAdmin = useMemo(() => {
    const name = (currentUser?.roleName || "")
      .toString()
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "")
    const code = (currentUser?.roleCode || "")
      .toString()
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "")
    return (
      name === "ADMIN" ||
      name === "SUPERADMIN" ||
      code === "ADMIN" ||
      code === "SUPERADMIN"
    )
  }, [currentUser?.roleName, currentUser?.roleCode])
  /**
   * Defer showing the admin-only User filter until after mount so SSR + first client paint match.
   * Otherwise `getUser()` is often empty on the server but populated on the client, which shifts
   * this grid and causes a hydration mismatch (e.g. "Module" vs "User" on the same label node).
   */
  const [showUserFilter, setShowUserFilter] = useState(false)
  useEffect(() => {
    setShowUserFilter(isAdminOrSuperAdmin)
  }, [isAdminOrSuperAdmin])
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const { exportingFormat, executeExport } = useInlineDualExport()
  const [totalCount, setTotalCount] = useState(0)
  const [studies, setStudies] = useState([])
  const [sites, setSites] = useState([])
  const [patients, setPatients] = useState([])
  const [users, setUsers] = useState([])
  const [loadingStudies, setLoadingStudies] = useState(false)
  const [loadingSites, setLoadingSites] = useState(false)
  const [loadingPatients, setLoadingPatients] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [studySearch, setStudySearch] = useState("")
  const [siteSearch, setSiteSearch] = useState("")
  const [patientSearch, setPatientSearch] = useState("")
  const [userSearch, setUserSearch] = useState("")
  const [studyRequiredError, setStudyRequiredError] = useState(false)

  const pageInfo = useMemo(() => {
    if (!pathname) {
      return {
        title: "Audit Trail With Reason",
        description: "Track field-level changes with reasons and context",
      }
    }
    return {
      title: "Audit Trail With Reason",
      description: "Track field-level changes with reasons and context",
    }
  }, [pathname])

  const totalPages = useMemo(
    () => Math.ceil((Number(totalCount) || 0) / (Number(filters.pageSize) || 10)),
    [totalCount, filters.pageSize],
  )

  const hasActiveFilters = useMemo(() => {
    return Object.entries(filters).some(([key, value]) => {
      if (key === "pageNumber" || key === "pageSize") return false
      return String(value || "").trim() !== ""
    })
  }, [filters])
  const hasStudySelected = useMemo(() => String(filters.studyId || "").trim() !== "", [filters.studyId])
  const activeFilterCount = useMemo(() => {
    return Object.entries(filters).reduce((count, [key, value]) => {
      if (key === "pageNumber" || key === "pageSize") return count
      return String(value || "").trim() !== "" ? count + 1 : count
    }, 0)
  }, [filters])

  useEffect(() => {
    if (isAdminOrSuperAdmin) return
    setFilters((prev) => (prev.userId ? { ...prev, userId: "" } : prev))
    setUsers([])
    setUserSearch("")
  }, [isAdminOrSuperAdmin])

  const selectTriggerClass = cn(REPORT_SELECT_TRIGGER_CLASS, "!w-full min-w-0 max-w-full")
  const selectContentClass = "bg-white border-2 border-slate-200 rounded-2xl shadow-xl p-2"
  const selectItemClass =
    "px-4 py-2.5 rounded-lg data-[highlighted]:bg-emerald-50 data-[highlighted]:text-slate-900 data-[state=checked]:bg-emerald-100 data-[state=checked]:text-emerald-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors"
  const selectSearchInputClass =
    "pl-10 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white"
  const inputClass = "border-2 border-slate-200 rounded-xl"

  const loadReport = useCallback(async (nextFilters) => {
    setLoading(true)
    try {
      const response = await reportsService.getAuditTrailWithReasonReport(withWorkspace(nextFilters))
      const data = response?.data || {}
      const items = Array.isArray(data?.items) ? data.items : []
      setRows(items)
      setTotalCount(Number(data?.totalCount || 0))
    } catch (error) {
      const message = error?.message || "Failed to load report"
      toast.error(message)
      setRows([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const loadStudies = async () => {
      setLoadingStudies(true)
      try {
        const res = await studyService.getStudiesForDropdown()
        if (!mounted) return
        setStudies(res?.isSuccess && Array.isArray(res?.data) ? res.data : [])
      } catch {
        if (mounted) setStudies([])
      } finally {
        if (mounted) setLoadingStudies(false)
      }
    }
    const loadUsers = async () => {
      setLoadingUsers(true)
      try {
        const res = await userService.getAllUsers(1, 500, "", true)
        if (!mounted) return
        const list = Array.isArray(res?.data) ? res.data : res?.data?.items || res?.data?.Items || []
        setUsers(res?.isSuccess && Array.isArray(list) ? list : [])
      } catch {
        if (mounted) setUsers([])
      } finally {
        if (mounted) setLoadingUsers(false)
      }
    }
    loadStudies()
    if (isAdminOrSuperAdmin) {
      loadUsers()
    } else {
      if (mounted) {
        setUsers([])
        setLoadingUsers(false)
      }
    }
    return () => {
      mounted = false
    }
  }, [currentUserId, isAdminOrSuperAdmin])

  useEffect(() => {
    let mounted = true
    const studyId = parseInt(String(filters.studyId || ""), 10)
    if (!Number.isFinite(studyId) || studyId <= 0) {
      return
    }

    const loadSites = async () => {
      setLoadingSites(true)
      try {
        if (!currentUserId) {
          if (mounted) setSites([])
          return
        }
        const res = await studyUserService.getAssignedSitesWithUsersForStudy(studyId)
        if (!mounted) return
        const payload = res?.data
        const sitesFromNewApi = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.sites)
            ? payload.sites
            : Array.isArray(payload?.data?.sites)
              ? payload.data.sites
              : []
        if (res?.isSuccess) {
          setSites(sitesFromNewApi)
          return
        }
        // Safe fallback if endpoint is unavailable in current env.
        const fallback = await siteService.getSitesForDropdown(studyId)
        if (!mounted) return
        setSites(fallback?.isSuccess && Array.isArray(fallback?.data) ? fallback.data : [])
      } catch {
        if (mounted) setSites([])
      } finally {
        if (mounted) setLoadingSites(false)
      }
    }
    loadSites()
    return () => {
      mounted = false
    }
  }, [filters.studyId, currentUserId])

  useEffect(() => {
    let mounted = true
    const studyId = parseInt(String(filters.studyId || ""), 10)
    const siteId = parseInt(String(filters.siteId || ""), 10)
    if (!Number.isFinite(studyId) || studyId <= 0 || !Number.isFinite(siteId) || siteId <= 0) {
      return
    }

    const loadPatients = async () => {
      setLoadingPatients(true)
      try {
        const res = await patientEnrolmentService.getPatientEnrolmentsForDropdown(studyId, siteId)
        if (!mounted) return
        setPatients(res?.isSuccess && Array.isArray(res?.data) ? res.data : [])
      } catch {
        if (mounted) setPatients([])
      } finally {
        if (mounted) setLoadingPatients(false)
      }
    }
    loadPatients()
    return () => {
      mounted = false
    }
  }, [filters.studyId, filters.siteId])

  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value }
      if (key === "studyId") {
        next.siteId = ""
        next.patientId = ""
        setSites([])
        setPatients([])
        setStudyRequiredError(false)
      }
      if (key === "siteId") {
        next.patientId = ""
        setPatients([])
      }
      return next
    })
  }, [])

  const handleSearch = useCallback(() => {
    if (!String(filters.studyId || "").trim()) {
      setStudyRequiredError(true)
      toast.error("Study is required.")
      return
    }
    const fromDate = parseIsoDate(filters.dateFrom)
    const toDate = parseIsoDate(filters.dateTo)
    if (fromDate && toDate && fromDate > toDate) {
      toast.error("Date From cannot be after Date To.")
      return
    }
    const next = { ...filters, pageNumber: 1 }
    setFilters(next)
    loadReport(next)
  }, [filters, loadReport])

  const handleClear = useCallback(() => {
    setStudySearch("")
    setSiteSearch("")
    setPatientSearch("")
    setUserSearch("")
    setStudyRequiredError(false)
    setFilters(INITIAL_FILTERS)
    setRows([])
    setTotalCount(0)
  }, [])

  const handleExport = useCallback(
    async (format, { pageSize, orientation } = {}) => {
      if (!assertCanExport()) return
      const fromDate = parseIsoDate(filters.dateFrom)
      const toDate = parseIsoDate(filters.dateTo)
      if (fromDate && toDate && fromDate > toDate) {
        toast.error("Date From cannot be after Date To.")
        return
      }
      try {
        await executeExport(format, async () => {
          await reportsService.exportAuditTrailWithReasonReport(
            withWorkspace({
              ...filters,
              pdfPageSize: pageSize,
              pdfOrientation: orientation,
            }),
            format,
          )
          toast.success(format === "pdf" ? "PDF exported successfully." : "CSV exported successfully.")
        })
      } catch (error) {
        toast.error(error?.message || "Export failed")
      }
    },
    [assertCanExport, filters, executeExport, withWorkspace],
  )

  const columns = useMemo(
    () => [
      { key: "studyProtocol", label: "Study", widthClass: "min-w-[9rem] w-[8%]", copyable: false },
      { key: "siteName", label: "Site", widthClass: "min-w-[8rem] w-[7%]", copyable: false },
      { key: "patientDisplay", label: "Patient", widthClass: "min-w-[9.5rem] w-[9%]", copyable: true },
      { key: "visitDisplay", label: "Visit", widthClass: "min-w-[7.5rem] w-[7%]", copyable: true },
      { key: "crfName", label: "CRF Name", widthClass: "min-w-[10rem] w-[10%]", copyable: true },
      { key: "fieldName", label: "Field Name", widthClass: "min-w-[11rem] w-[12%]", copyable: true },
      { key: "oldValue", label: "Old Value", widthClass: "min-w-[7rem] w-[7%]", copyable: true },
      { key: "newValue", label: "New Value", widthClass: "min-w-[7rem] w-[7%]", copyable: true },
      { key: "reason", label: "Reason", widthClass: "min-w-[9rem] w-[10%]", copyable: true },
      { key: "module", label: "Module", widthClass: "min-w-[5.5rem] w-[5%]", copyable: false },
      { key: "changedAtUtc", label: "Changed At (UTC)", widthClass: "min-w-[10rem] w-[9%]", copyable: false },
      { key: "changedBy", label: "Changed By", widthClass: "min-w-[9rem] w-[9%]", copyable: true },
    ],
    [],
  )

  return (
    <DashboardLayout>
      <div className={REPORT_PAGE_SHELL_WITH_BG_CLASS}>
        <div className="mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br btn-brand-gradient rounded-xl shadow-lg">
              <Search className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800 mb-1">{pageInfo.title}</h1>
              <p className="text-slate-600">{pageInfo.description}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 px-6 py-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-emerald-600" />
                <h2 className="text-lg font-bold text-slate-800">Filter Criteria</h2>
                {activeFilterCount > 0 && (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-0.5 text-xs font-semibold">
                    {activeFilterCount} active
                  </span>
                )}
              </div>
              {hasActiveFilters && (
                <button
                  onClick={handleClear}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div className={REPORT_FILTER_GRID_4_CLASS}>
              <div className={REPORT_FILTER_FIELD_CLASS}>
                <label className="text-sm font-bold text-slate-700">
                  Study <span className="text-red-600">*</span>
                </label>
                <Select
                  value={filters.studyId || "all"}
                  onValueChange={(v) => handleFilterChange("studyId", v === "all" ? "" : v)}
                  disabled={loadingStudies}
                >
                  <SelectTrigger
                    className={`${selectTriggerClass} ${!filters.studyId ? "border-red-300 focus:border-red-500 focus:ring-red-100" : ""}`}
                  >
                    <SelectValue placeholder={loadingStudies ? "Loading studies..." : "Select Study"} />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    <div className="p-3 border-b border-slate-200 sticky top-0 bg-white z-10">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          type="text"
                          value={studySearch}
                          onChange={(e) => setStudySearch(e.target.value)}
                          placeholder="Search studies..."
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          className={selectSearchInputClass}
                        />
                      </div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      <SelectItem value="all" className={selectItemClass}>
                        All Studies
                      </SelectItem>
                      {studies
                        .filter((st) => {
                          if (!studySearch.trim()) return true
                          const s = studySearch.toLowerCase()
                          const id = st.studyId || st.id
                          const protocol = st.studyProtocolNumber || st.protocolNumber || ""
                          const name = st.studyName || st.name || ""
                          return `${protocol} ${name} ${id || ""}`.toLowerCase().includes(s)
                        })
                        .map((st) => {
                          const id = st.studyId || st.id
                          if (!id) return null
                          const protocol = st.studyProtocolNumber || st.protocolNumber || ""
                          const name = st.studyName || st.name || ""
                          const label = protocol && name ? `${protocol} - ${name}` : protocol || name || `Study ${id}`
                          return (
                            <SelectItem key={id} value={String(id)} className={selectItemClass}>
                              {label}
                            </SelectItem>
                          )
                        })}
                    </div>
                  </SelectContent>
                </Select>
                {studyRequiredError && !filters.studyId && (
                  <p className="text-xs text-red-600 font-medium">Study is required.</p>
                )}
              </div>
              <div className={REPORT_FILTER_FIELD_CLASS}>
                <label className="text-sm font-bold text-slate-700">Site</label>
                <Select
                  value={filters.siteId || "all"}
                  onValueChange={(v) => handleFilterChange("siteId", v === "all" ? "" : v)}
                  disabled={loadingSites || !filters.studyId}
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder={!filters.studyId ? "Select Study first" : loadingSites ? "Loading sites..." : "Select Site"} />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    <div className="p-3 border-b border-slate-200 sticky top-0 bg-white z-10">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          type="text"
                          value={siteSearch}
                          onChange={(e) => setSiteSearch(e.target.value)}
                          placeholder="Search sites..."
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          className={selectSearchInputClass}
                        />
                      </div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      <SelectItem value="all" className={selectItemClass}>
                        All Sites
                      </SelectItem>
                      {sites
                        .filter((si) => {
                          if (!siteSearch.trim()) return true
                          const s = siteSearch.toLowerCase()
                          const id = si.siteId || si.id
                          const code = si.siteCode || si.code || ""
                          const name = si.siteName || si.name || ""
                          return `${code} ${name} ${id || ""}`.toLowerCase().includes(s)
                        })
                        .map((si) => {
                          const id = si.siteId || si.id
                          if (!id) return null
                          const code = si.siteCode || si.code || ""
                          const name = si.siteName || si.name || ""
                          const label = code && name ? `${code} - ${name}` : name || code || `Site ${id}`
                          return (
                            <SelectItem key={id} value={String(id)} className={selectItemClass}>
                              {label}
                            </SelectItem>
                          )
                        })}
                    </div>
                  </SelectContent>
                </Select>
              </div>
              <div className={REPORT_FILTER_FIELD_CLASS}>
                <label className="text-sm font-bold text-slate-700">Patient</label>
                <Select
                  value={filters.patientId || "all"}
                  onValueChange={(v) => handleFilterChange("patientId", v === "all" ? "" : v)}
                  disabled={loadingPatients || !filters.studyId || !filters.siteId}
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue
                      placeholder={
                        !filters.studyId || !filters.siteId
                          ? "Select Study + Site first"
                          : loadingPatients
                            ? "Loading patients..."
                            : "Select Patient"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    <div className="p-3 border-b border-slate-200 sticky top-0 bg-white z-10">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          type="text"
                          value={patientSearch}
                          onChange={(e) => setPatientSearch(e.target.value)}
                          placeholder="Search patients..."
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          className={selectSearchInputClass}
                        />
                      </div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      <SelectItem value="all" className={selectItemClass}>
                        All Patients
                      </SelectItem>
                      {patients
                        .filter((p) => {
                          if (!patientSearch.trim()) return true
                          const s = patientSearch.toLowerCase()
                          const id = p.patientId || p.patientEnrolmentId || p.id
                          const code = p.patientCode || ""
                          const initial = p.initial || ""
                          const name = p.name || ""
                          return `${code} ${initial} ${name} ${id || ""}`.toLowerCase().includes(s)
                        })
                        .map((p) => {
                          const id = p.patientId || p.patientEnrolmentId || p.id
                          if (!id) return null
                          const label = p.initial || p.patientCode || p.name || `Patient ${id}`
                          return (
                            <SelectItem key={id} value={String(id)} className={selectItemClass}>
                              {label}
                            </SelectItem>
                          )
                        })}
                    </div>
                  </SelectContent>
                </Select>
              </div>
              <div className={REPORT_FILTER_FIELD_CLASS}>
                <label className="text-sm font-bold text-slate-700">Search</label>
                <Input
                  value={filters.searchEntityName}
                  onChange={(e) => handleFilterChange("searchEntityName", e.target.value)}
                  placeholder="Search..."
                  className={cn(inputClass, "w-full min-w-0")}
                />
              </div>
            </div>

            <div
              className={cn(
                REPORT_FILTER_GRID_4_CLASS,
                !showUserFilter && "lg:grid-cols-3",
              )}
            >
              {showUserFilter && (
                <div className={REPORT_FILTER_FIELD_CLASS}>
                  <label className="text-sm font-bold text-slate-700">User</label>
                  <Select
                    value={filters.userId || "all"}
                    onValueChange={(v) => handleFilterChange("userId", v === "all" ? "" : v)}
                    disabled={loadingUsers}
                  >
                    <SelectTrigger className={selectTriggerClass}>
                      <SelectValue placeholder={loadingUsers ? "Loading users..." : "Select User"} />
                    </SelectTrigger>
                    <SelectContent className={selectContentClass}>
                      <div className="p-3 border-b border-slate-200 sticky top-0 bg-white z-10">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            type="text"
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                            placeholder="Search users..."
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            className={selectSearchInputClass}
                          />
                        </div>
                      </div>
                      <div className="max-h-[300px] overflow-y-auto">
                        <SelectItem value="all" className={selectItemClass}>
                          All Users
                        </SelectItem>
                        {users
                          .filter((u) => {
                            if (!userSearch.trim()) return true
                            const s = userSearch.toLowerCase()
                            const id = u.userId || u.id
                            const email = u.email || u.userEmail || ""
                            const name = u.userName || u.username || `${u.firstName || ""} ${u.lastName || ""}`.trim()
                            return `${email} ${name} ${id || ""}`.toLowerCase().includes(s)
                          })
                          .map((u) => {
                            const id = u.userId || u.id
                            if (!id) return null
                            const email = u.email || u.userEmail || ""
                            const name = u.userName || u.username || `${u.firstName || ""} ${u.lastName || ""}`.trim()
                            const label = email || name || `User ${id}`
                            return (
                              <SelectItem key={id} value={String(id)} className={selectItemClass}>
                                {label}
                              </SelectItem>
                            )
                          })}
                      </div>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className={REPORT_FILTER_FIELD_CLASS}>
                <label className="text-sm font-bold text-slate-700">Module</label>
                <Select
                  value={filters.module || "all"}
                  onValueChange={(v) => handleFilterChange("module", v === "all" ? "" : v)}
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="All Modules" />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    <SelectItem value="all" className={selectItemClass}>
                      All Modules
                    </SelectItem>
                    {AUDIT_TRAIL_MODULE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value} className={selectItemClass}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className={REPORT_FILTER_FIELD_CLASS}>
                <label className="text-sm font-bold text-slate-700">Date From</label>
                <DatePicker
                  value={filters.dateFrom}
                  onChange={(value) => handleFilterChange("dateFrom", value || "")}
                />
              </div>
              <div className={REPORT_FILTER_FIELD_CLASS}>
                <label className="text-sm font-bold text-slate-700">Date To</label>
                <DatePicker
                  value={filters.dateTo}
                  onChange={(value) => handleFilterChange("dateTo", value || "")}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-6">
              <Button
                onClick={handleSearch}
                disabled={loading || !hasStudySelected}
                className="bg-gradient-to-r btn-brand-gradient  text-white"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                Search
              </Button>
              <Button onClick={handleClear} variant="outline" disabled={!hasStudySelected || !hasActiveFilters || loading}>
                <X className="w-4 h-4 mr-2" />
                Clear
              </Button>
              <div className="flex-1" />
              <ReportDownloadActions
                canExport={canExport}
                reportKey={reportKey}
                assertCanExport={assertCanExport}
                defaultSubject="Audit Trail With Reason"
                defaultFormat="pdf"
                enabledFormats={REPORT_CSV_PDF_FORMATS}
                disabled={!hasStudySelected}
                busy={exportingFormat != null}
                onExport={async ({ format, pageSize, orientation }) => {
                  await handleExport(format, { pageSize, orientation })
                }}
              />
            </div>
            {!hasStudySelected && (
              <p className="text-xs text-slate-500 mt-1">Select Study first to enable Search, Clear, and Export actions.</p>
            )}
          </div>
        </div>

        <div className={REPORT_PREMIUM_PANEL_CLASS}>
          <div className={REPORT_PREMIUM_PANEL_HEADER_CLASS}>
            <h2 className="text-sm font-semibold tracking-tight text-slate-900">
              Audit Trail Entries
              {totalCount > 0 && (
                <span className="ml-1.5 text-[11px] font-normal text-slate-500">({totalCount} total)</span>
              )}
            </h2>
          </div>

          {loading ? (
            <SectionSkeleton title="Loading report..." rows={7} variant="audit" />
          ) : rows.length === 0 ? (
            <div className="text-center py-16">
              <Shield className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 font-medium mb-2">No entries found</p>
              <p className="text-slate-500 text-sm">
                {!hasStudySelected
                  ? "Select Study and click Search to view report data."
                  : hasActiveFilters
                    ? "Try adjusting your filters to see more results."
                    : "No records are available at this time."}
              </p>
            </div>
          ) : (
            <>
              <div
                className={cn(REPORT_PREMIUM_TABLE_SCROLL_CLASS, "overflow-x-auto")}
                role="region"
                aria-label="Audit trail with reason results"
              >
                <table className="w-full table-fixed border-separate border-spacing-0 text-left">
                  <thead>
                    <tr>
                      {columns.map((column) => (
                        <th
                          key={column.key}
                          className={cn(REPORT_PREMIUM_TH_CLASS, column.widthClass)}
                        >
                          <span className="block truncate" title={column.label}>
                            {column.label}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white/90">
                    {rows.map((row, index) => (
                      <tr
                        key={row?.eventId || row?.correlationId || index}
                        className="h-11 max-h-11 border-b border-slate-100/95 transition-colors hover:bg-slate-50/90"
                      >
                        {columns.map((column) => {
                          const cellText =
                            column.key === "changedBy"
                              ? getAuditTrailReasonChangedByLabel(row)
                              : toReportDisplay(pickDtoField(row, column.key))
                          return (
                            <td
                              key={column.key}
                              className={cn(
                                "h-11 max-h-11 px-3 py-2 align-middle text-[11px] text-slate-700",
                                column.widthClass,
                              )}
                            >
                              <ReportDenseCopyCell text={cellText} copyable={column.copyable} />
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 0 && (
                <div className="border-t border-slate-200/80 bg-white/80">
                  <DataPagination
                    currentPage={filters.pageNumber}
                    pageSize={filters.pageSize}
                    totalPages={totalPages}
                    totalCount={totalCount}
                    onPageChange={(page) => {
                      setFilters((prev) => {
                        const next = { ...prev, pageNumber: page }
                        loadReport(next)
                        return next
                      })
                    }}
                    onPageSizeChange={(size) => {
                      setFilters((prev) => {
                        const next = { ...prev, pageSize: size, pageNumber: 1 }
                        loadReport(next)
                        return next
                      })
                    }}
                    itemName="entries"
                    showPageSizeSelector={true}
                    pageSizeOptions={REPORT_PAGE_SIZE_OPTIONS}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
