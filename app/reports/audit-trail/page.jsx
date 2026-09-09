"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import DataPagination from "@/components/ui/data-pagination"
import SectionSkeleton from "@/components/ui/section-skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import reportsService from "@/lib/services/reports.service"
import studyService from "@/lib/services/study.service"
import siteService from "@/lib/services/site.service"
import userService from "@/lib/services/user.service"
import patientEnrolmentService from "@/lib/services/patientEnrolment.service"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { useReportExportJobs } from "@/context/ReportExportJobsContext"
import { cn } from "@/lib/utils"
import {
  REPORT_GRID_COPY_BTN_CLASS,
  REPORT_GRID_COPY_HOVER_REVEAL_CLASS,
} from "@/lib/reports/reportRowDisplay"
import {
  REPORT_CARD_CLASS,
  REPORT_MOBILE_TABLE_HINT,
  REPORT_PAGE_SHELL_WITH_BG_CLASS,
  REPORT_RESULTS_HEADER_CLASS,
  REPORT_TABLE_SCROLL_CLASS,
} from "@/lib/reports/studySitePatientReportUi"
import { useReportExportAccess } from "@/app/reports/_hooks/useReportExportAccess"
import ReportDownloadActions, { REPORT_CSV_PDF_FORMATS } from "@/components/reports/ReportDownloadActions"
import {
  Search,
  Calendar,
  Copy,
  Filter,
  X,
  Loader2,
  Shield,
} from "lucide-react"

export default function StudyAuditTrailReportPage() {
  const pathname = usePathname()

  // Get page name from pathname
  const getPageInfo = (pathname) => {
    if (!pathname) {
      return {
        title: 'Audit Trail Report',
        description: 'Track and view audit trail for activities and changes',
      }
    }

    // Extract page name from pathname (e.g., "/reports/audit-trail" -> "audit-trail")
    const segments = pathname.replace(/^\/+|\/+$/g, '').split('/')
    const pageName = segments[segments.length - 1]

    // Map page names to titles and descriptions
    const pageInfoMap = {
      'audit-trail': {
        title: 'Audit Trail Report',
        description: 'Track and view audit trail for activities and changes',
      },
    }

    // Return mapped info or fallback
    return pageInfoMap[pageName] || {
      title: pageName
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
      description: `View ${pageName.replace(/-/g, ' ')} information`,
    }
  }

  const pageInfo = getPageInfo(pathname)
  const { canExport, assertCanExport, reportKey, withWorkspace } = useReportExportAccess()
  const { startReportExport, jobs } = useReportExportJobs()
  const csvRunning = jobs.some((j) => j.kind === "audit-trail-csv" && j.status === "running")
  const pdfRunning = jobs.some((j) => j.kind === "audit-trail-pdf" && j.status === "running")

  // List state
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalCount, setTotalCount] = useState(0)

  // Dropdown data
  const [studies, setStudies] = useState([])
  const [loadingStudies, setLoadingStudies] = useState(false)
  const [studySearch, setStudySearch] = useState("")

  const [sites, setSites] = useState([])
  const [loadingSites, setLoadingSites] = useState(false)
  const [siteSearch, setSiteSearch] = useState("")

  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [userSearch, setUserSearch] = useState("")

  const [patients, setPatients] = useState([])
  const [loadingPatients, setLoadingPatients] = useState(false)
  const [patientSearch, setPatientSearch] = useState("")

  // Filter state (API filters)
  const [filters, setFilters] = useState({
    search: "",
    entityName: "ALL",
    action: "ALL",
    userId: "",
    studyId: "",
    siteId: "",
    patientId: "",
    startDate: "",
    endDate: "",
  })

  // Select styles (match Audit Log)
  const selectTriggerClass =
    "w-full border-2 border-slate-200 rounded-lg bg-white hover:bg-blue-50 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all px-4 py-3 shadow-sm"
  const selectContentClass = "bg-white border-2 border-slate-200 rounded-lg shadow-lg"
  const selectItemClass =
    "px-4 py-2 data-[highlighted]:bg-blue-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors"
  const selectSearchInputClass =
    "pl-10 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100"

  const totalPages = useMemo(() => Math.ceil(totalCount / pageSize), [totalCount, pageSize])
  const isLoadingRef = useRef(false)

  const columns = useMemo(
    () => [
      { key: "timestamp", label: "Timestamp", widthClass: "w-[190px] max-w-[190px]" },
      { key: "entityName", label: "Entity", widthClass: "w-[150px] max-w-[150px]" },
      { key: "fieldName", label: "Field", widthClass: "w-[140px] max-w-[140px]" },
      { key: "oldValue", label: "Old Value", widthClass: "w-[280px] max-w-[280px]" },
      { key: "newValue", label: "New Value", widthClass: "w-[280px] max-w-[280px]" },
      { key: "action", label: "Action", widthClass: "w-[110px] max-w-[110px]" },
      { key: "aiConfidence", label: "AI confidence", widthClass: "w-[100px] max-w-[100px]", hideOnMobile: true },
      { key: "aiSuggestionLogId", label: "AI log ID", widthClass: "w-[90px] max-w-[90px]", hideOnMobile: true },
      { key: "username", label: "User", widthClass: "w-[180px] max-w-[180px]" },
      { key: "ipAddress", label: "IP", widthClass: "w-[140px] max-w-[140px]", hideOnMobile: true },
      { key: "correlationId", label: "CorrelationId", widthClass: "w-[220px] max-w-[220px]", hideOnMobile: true },
      { key: "hash", label: "Hash", widthClass: "w-[220px] max-w-[220px]", hideOnMobile: true },
    ],
    []
  )

  const copyToClipboard = useCallback(async (text) => {
    const value = String(text ?? "")
    if (!value) return

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
      } else {
        // Fallback (older browsers)
        const ta = document.createElement("textarea")
        ta.value = value
        ta.style.position = "fixed"
        ta.style.left = "-9999px"
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        document.execCommand("copy")
        document.body.removeChild(ta)
      }
      toast.success("Copied")
    } catch (e) {
      console.error("Copy failed", e)
      toast.error("Copy failed")
    }
  }, [])

  const hasActiveFilters = useMemo(() => {
    return (
      Object.entries(filters).some(([k, v]) => {
        const val = String(v || "").trim()
        if (!val) return false
        if ((k === "entityName" || k === "action") && val === "ALL") return false
        return true
      })
    )
  }, [filters])

  // Format date and time for display (same as Audit Log)
  const formatDateTime = useCallback((dateString) => {
    if (!dateString) return "N/A"
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return "N/A"
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return "N/A"
    }
  }, [])

  // If a value looks like an ISO date/time string, show a readable format
  const formatMaybeDateValue = useCallback(
    (value) => {
      if (value === null || value === undefined) return { display: "-", raw: "" }
      const raw = String(value)
      const s = raw.trim()
      if (!s) return { display: "-", raw: "" }

      // ISO-ish formats (with/without timezone, optional fractional seconds)
      const isoLike =
        /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/
      if (isoLike.test(s)) {
        const d = new Date(s)
        if (!isNaN(d.getTime())) {
          return { display: formatDateTime(d), raw }
        }
      }

      return { display: raw, raw }
    },
    [formatDateTime]
  )

  // Get action badge color (same as Audit Log)
  const getActionBadgeColor = useCallback((action) => {
    if (!action) return "bg-slate-100 text-slate-800"
    const actionLower = String(action).toLowerCase()
    switch (actionLower) {
      case "create":
        return "bg-green-100 text-green-800 hover:bg-green-100"
      case "update":
        return "bg-blue-100 text-blue-800 hover:bg-blue-100"
      case "delete":
        return "bg-red-100 text-red-800 hover:bg-red-100"
      default:
        return "bg-slate-100 text-slate-800 hover:bg-slate-100"
    }
  }, [])

  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value }
      // Dependent resets
      if (key === "studyId") {
        next.siteId = ""
        next.patientId = ""
      }
      if (key === "siteId") {
        next.patientId = ""
      }
      return next
    })
  }, [])

  // Load studies/users once
  useEffect(() => {
    let mounted = true

    const loadStudies = async () => {
      setLoadingStudies(true)
      try {
        const res = await studyService.getStudiesForDropdown()
        if (!mounted) return
        setStudies(res?.isSuccess && res.data ? res.data : [])
      } catch (e) {
        if (mounted) setStudies([])
      } finally {
        if (mounted) setLoadingStudies(false)
      }
    }

    const loadUsers = async () => {
      setLoadingUsers(true)
      try {
        // Large pageSize for dropdown usage
        const res = await userService.getAllUsers(1, 500, "", true)
        if (!mounted) return
        const data = res?.data
        const items = Array.isArray(data) ? data : data?.items || data?.Items || []
        setUsers(res?.isSuccess && items ? items : [])
      } catch (e) {
        if (mounted) setUsers([])
      } finally {
        if (mounted) setLoadingUsers(false)
      }
    }

    loadStudies()
    loadUsers()

    return () => {
      mounted = false
    }
  }, [])

  // Load sites when studyId changes
  useEffect(() => {
    let mounted = true
    const studyIdNum = parseInt(filters.studyId, 10)
    if (!filters.studyId || isNaN(studyIdNum) || studyIdNum <= 0) {
      setSites([])
      setPatients([])
      return
    }

    setLoadingSites(true)
    siteService
      .getSitesForDropdown(studyIdNum)
      .then((res) => {
        if (!mounted) return
        setSites(res?.isSuccess && res.data ? res.data : [])
      })
      .catch(() => {
        if (mounted) setSites([])
      })
      .finally(() => {
        if (mounted) setLoadingSites(false)
      })

    return () => {
      mounted = false
    }
  }, [filters.studyId])

  // Load patients when studyId + siteId are selected
  useEffect(() => {
    let mounted = true
    const studyIdNum = parseInt(filters.studyId, 10)
    const siteIdNum = parseInt(filters.siteId, 10)
    if (!filters.studyId || isNaN(studyIdNum) || studyIdNum <= 0 || !filters.siteId || isNaN(siteIdNum) || siteIdNum <= 0) {
      setPatients([])
      return
    }

    setLoadingPatients(true)
    patientEnrolmentService
      .getPatientEnrolmentsForDropdown(studyIdNum, siteIdNum)
      .then((res) => {
        if (!mounted) return
        setPatients(res?.isSuccess && res.data ? res.data : [])
      })
      .catch(() => {
        if (mounted) setPatients([])
      })
      .finally(() => {
        if (mounted) setLoadingPatients(false)
      })

    return () => {
      mounted = false
    }
  }, [filters.studyId, filters.siteId])

  const validateDateRange = useCallback(() => {
    if (filters.startDate && filters.endDate) {
      const start = new Date(filters.startDate)
      const end = new Date(filters.endDate)
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start > end) {
        toast.error("Start Date cannot be after End Date")
        return false
      }
    }
    return true
  }, [filters.startDate, filters.endDate])

  const buildParams = useCallback(() => {
    const toInt = (v) => {
      const n = parseInt(String(v), 10)
      return Number.isFinite(n) ? n : undefined
    }

    return {
      pageNumber,
      pageSize,
      search: filters.search?.trim() || undefined,
      entityName: filters.entityName && filters.entityName !== "ALL" ? filters.entityName.trim() : undefined,
      action: filters.action && filters.action !== "ALL" ? filters.action.trim() : undefined,
      userId: toInt(filters.userId),
      studyId: toInt(filters.studyId),
      siteId: toInt(filters.siteId),
      patientId: toInt(filters.patientId),
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
    }
  }, [filters, pageNumber, pageSize])

  const loadAuditTrail = useCallback(async () => {
    if (isLoadingRef.current) return
    if (!validateDateRange()) return

    isLoadingRef.current = true
    setLoading(true)
    try {
      const response = await reportsService.getAuditTrailReport(withWorkspace(buildParams()))
      if (response.isSuccess && response.data) {
        setRows(response.data.items || [])
        setTotalCount(response.data.totalCount || 0)
      } else {
        toast.error(response.message || "Failed to load audit trail")
        setRows([])
        setTotalCount(0)
      }
    } catch (error) {
      console.error("Error loading audit trail:", error)
      toast.error(error.message || "Failed to load audit trail. Please try again.")
      setRows([])
      setTotalCount(0)
    } finally {
      setLoading(false)
      isLoadingRef.current = false
    }
  }, [buildParams, validateDateRange])

  useEffect(() => {
    loadAuditTrail()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber, pageSize])

  const handleGo = useCallback(() => {
    if (!validateDateRange()) return
    setPageNumber(1)
    setTimeout(() => {
      loadAuditTrail()
    }, 0)
  }, [loadAuditTrail, validateDateRange])

  const handleClearFilters = useCallback(() => {
    setFilters({
      search: "",
      entityName: "ALL",
      action: "ALL",
      userId: "",
      studyId: "",
      siteId: "",
      patientId: "",
      startDate: "",
      endDate: "",
    })
    setStudySearch("")
    setSiteSearch("")
    setUserSearch("")
    setPatientSearch("")
    setSites([])
    setPatients([])
    setPageNumber(1)
    setTimeout(() => {
      loadAuditTrail()
    }, 0)
  }, [loadAuditTrail])

  const handleExport = useCallback(
    (format, { pageSize, orientation } = {}) => {
      if (!assertCanExport()) return
      const kind = `audit-trail-${format}`
      if (jobs.some((j) => j.kind === kind && j.status === "running")) return
      if (!validateDateRange()) return

      startReportExport({
        kind,
        label: `Audit trail (${format.toUpperCase()})`,
        task: async (setDetail) => {
          setDetail("Requesting file…")
          await reportsService.exportAuditTrailReport(
            withWorkspace({ ...buildParams(), format, pageSize, orientation }),
          )
        },
      })
    },
    [assertCanExport, buildParams, jobs, startReportExport, validateDateRange, withWorkspace]
  )

  return (
    <DashboardLayout>
      <div className={REPORT_PAGE_SHELL_WITH_BG_CLASS}>
        {/* Enhanced Header */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="p-2.5 sm:p-3 bg-gradient-to-br btn-brand-gradient rounded-xl shadow-lg shrink-0">
                <Search className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-3xl font-bold text-slate-800 mb-0.5 sm:mb-1 truncate">{pageInfo.title}</h1>
                <p className="text-sm sm:text-base text-slate-600 line-clamp-2">{pageInfo.description}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Filter Form */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 px-6 py-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-emerald-600" />
                <h2 className="text-lg font-bold text-slate-800">Filter Criteria</h2>
              </div>
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {/* Row 1: Search, Entity Name, Action, User, Study */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-5">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Search</label>
                <Input
                  value={filters.search}
                  onChange={(e) => handleFilterChange("search", e.target.value)}
                  placeholder="Search..."
                  className="border-2 border-slate-200 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Entity Name</label>
                <Select
                  value={filters.entityName || "ALL"}
                  onValueChange={(v) => handleFilterChange("entityName", v || "ALL")}
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="All Entities" />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    <SelectItem value="ALL" className={selectItemClass}>
                      All Entities
                    </SelectItem>
                    <SelectItem value="Study" className={selectItemClass}>
                      Study
                    </SelectItem>
                    <SelectItem value="Site" className={selectItemClass}>
                      Site
                    </SelectItem>
                    <SelectItem value="Patient" className={selectItemClass}>
                      Patient
                    </SelectItem>
                    <SelectItem value="CRFData" className={selectItemClass}>
                      CRF Data
                    </SelectItem>
                    <SelectItem value="VisitSchedule" className={selectItemClass}>
                      Visit Schedule
                    </SelectItem>
                    <SelectItem value="CrfDesign" className={selectItemClass}>
                      CRF Design
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Action</label>
                <Select value={filters.action || "ALL"} onValueChange={(v) => handleFilterChange("action", v || "ALL")}>
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="All Actions" />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    <SelectItem value="ALL" className={selectItemClass}>
                      All
                    </SelectItem>
                    <SelectItem value="Create" className={selectItemClass}>
                      Create
                    </SelectItem>
                    <SelectItem value="Update" className={selectItemClass}>
                      Update
                    </SelectItem>
                    <SelectItem value="Delete" className={selectItemClass}>
                      Delete
                    </SelectItem>
                    <SelectItem value="PiSignoffApply" className={selectItemClass}>
                      PI sign-off apply
                    </SelectItem>
                    <SelectItem value="PiSignoffRevoke" className={selectItemClass}>
                      PI sign-off revoke
                    </SelectItem>
                    <SelectItem value="PiFieldSignoff" className={selectItemClass}>
                      PI field sign-off
                    </SelectItem>
                    <SelectItem value="PiFieldSignoffRevoke" className={selectItemClass}>
                      PI field sign-off revoke
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">User</label>
                <Select
                  value={filters.userId || undefined}
                  onValueChange={(v) => handleFilterChange("userId", v === "all" ? "" : v)}
                  disabled={loadingUsers}
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder={loadingUsers ? "Loading users..." : "Select User"} />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    <div className="p-3 border-b border-slate-200 sticky top-0 bg-white z-10">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          type="text"
                          placeholder="Search users..."
                          value={userSearch}
                          onChange={(e) => setUserSearch(e.target.value)}
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
                          const name =
                            u.userName || u.username || `${u.firstName || ""} ${u.lastName || ""}`.trim() || ""
                          const hay = `${email} ${name} ${id || ""}`.toLowerCase()
                          return hay.includes(s)
                        })
                        .map((u) => {
                          const id = u.userId || u.id
                          const email = u.email || u.userEmail || ""
                          const name =
                            u.userName || u.username || `${u.firstName || ""} ${u.lastName || ""}`.trim() || ""
                          const label = email || name || `User ${id}`
                          if (!id) return null
                          return (
                            <SelectItem key={id} value={id.toString()} className={selectItemClass}>
                              <div className="flex items-center justify-between gap-3">
                                <span className="truncate">{label}</span>
                                <span className="text-xs text-slate-500 shrink-0">#{id}</span>
                              </div>
                            </SelectItem>
                          )
                        })}
                    </div>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Study</label>
                <Select
                  value={filters.studyId || undefined}
                  onValueChange={(v) => handleFilterChange("studyId", v === "all" ? "" : v)}
                  disabled={loadingStudies}
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder={loadingStudies ? "Loading studies..." : "Select Study"} />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    <div className="p-3 border-b border-slate-200 sticky top-0 bg-white z-10">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          type="text"
                          placeholder="Search studies..."
                          value={studySearch}
                          onChange={(e) => setStudySearch(e.target.value)}
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
                          const hay = `${protocol} ${name} ${id || ""}`.toLowerCase()
                          return hay.includes(s)
                        })
                        .map((st) => {
                          const id = st.studyId || st.id
                          const protocol = st.studyProtocolNumber || st.protocolNumber || ""
                          const name = st.studyName || st.name || ""
                          const label =
                            protocol && name ? `${protocol} - ${name}` : protocol || name || `Study ${id}`
                          if (!id) return null
                          return (
                            <SelectItem key={id} value={id.toString()} className={selectItemClass}>
                              <div className="flex items-center justify-between gap-3">
                                <span className="truncate">{label}</span>
                                <span className="text-xs text-slate-500 shrink-0">#{id}</span>
                              </div>
                            </SelectItem>
                          )
                        })}
                    </div>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Site, Patient, Date From, Date To */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Site</label>
                <Select
                  value={filters.siteId || undefined}
                  onValueChange={(v) => handleFilterChange("siteId", v === "all" ? "" : v)}
                  disabled={loadingSites || !filters.studyId}
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue
                      placeholder={
                        !filters.studyId ? "Select Study first" : loadingSites ? "Loading sites..." : "Select Site"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    <div className="p-3 border-b border-slate-200 sticky top-0 bg-white z-10">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          type="text"
                          placeholder="Search sites..."
                          value={siteSearch}
                          onChange={(e) => setSiteSearch(e.target.value)}
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
                          const hay = `${code} ${name} ${id || ""}`.toLowerCase()
                          return hay.includes(s)
                        })
                        .map((si) => {
                          const id = si.siteId || si.id
                          const code = si.siteCode || si.code || ""
                          const name = si.siteName || si.name || ""
                          const label = code && name ? `${code} - ${name}` : name || code || `Site ${id}`
                          if (!id) return null
                          return (
                            <SelectItem key={id} value={id.toString()} className={selectItemClass}>
                              <div className="flex items-center justify-between gap-3">
                                <span className="truncate">{label}</span>
                                <span className="text-xs text-slate-500 shrink-0">#{id}</span>
                              </div>
                            </SelectItem>
                          )
                        })}
                    </div>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Patient</label>
                <Select
                  value={filters.patientId || undefined}
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
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          type="text"
                          placeholder="Search patients..."
                          value={patientSearch}
                          onChange={(e) => setPatientSearch(e.target.value)}
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
                          const email = p.email || ""
                          const hay = `${code} ${initial} ${name} ${email} ${id || ""}`.toLowerCase()
                          return hay.includes(s)
                        })
                        .map((p) => {
                          const id = p.patientId || p.patientEnrolmentId || p.id
                          const code = p.patientCode || ""
                          const initial = p.initial || ""
                          const name = p.name || ""
                          const label = initial || code || name || `Patient ${id}`
                          if (!id) return null
                          return (
                            <SelectItem key={id} value={id.toString()} className={selectItemClass}>
                              <div className="flex items-center justify-between gap-3">
                                <span className="truncate">{label}</span>
                                <span className="text-xs text-slate-500 shrink-0">#{id}</span>
                              </div>
                            </SelectItem>
                          )
                        })}
                    </div>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Date From</label>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <Input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange("startDate", e.target.value)}
                    className="border-2 border-slate-200 rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-700">Date To</label>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <Input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange("endDate", e.target.value)}
                    min={filters.startDate || undefined}
                    className="border-2 border-slate-200 rounded-xl"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-6">
              <Button
                onClick={handleGo}
                disabled={loading}
                className="bg-gradient-to-r btn-brand-gradient  text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Search
                  </>
                )}
              </Button>

              <Button onClick={handleClearFilters} variant="outline" disabled={!hasActiveFilters || loading}>
                <X className="w-4 h-4 mr-2" />
                Clear
              </Button>

              <div className="flex-1" />

              <ReportDownloadActions
                canExport={canExport}
                reportKey={reportKey}
                assertCanExport={assertCanExport}
                defaultSubject="Audit Trail"
                defaultFormat="pdf"
                enabledFormats={REPORT_CSV_PDF_FORMATS}
                disabled={loading}
                busy={csvRunning || pdfRunning}
                onExport={({ format, pageSize, orientation }) => {
                  handleExport(format, { pageSize, orientation })
                }}
              />
            </div>
          </div>
        </div>

        {/* Results Section (match Audit Log) */}
        <div className={REPORT_CARD_CLASS}>
          <div className={cn(REPORT_RESULTS_HEADER_CLASS, "px-4 sm:px-6")}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                Audit Trail Entries {totalCount > 0 && `(${totalCount} total)`}
              </h2>
              {rows.length > 0 ? (
                <p className="text-xs text-slate-500 md:hidden">Swipe horizontally to view all columns</p>
              ) : null}
            </div>
          </div>

          {loading ? (
            <SectionSkeleton title="Loading audit trail..." rows={7} variant="audit" />
          ) : rows.length === 0 ? (
            <div className="text-center py-16">
              <Shield className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 font-medium mb-2">No audit trail entries found</p>
              <p className="text-slate-500 text-sm">
                {hasActiveFilters
                  ? "Try adjusting your filters to see more results."
                  : "No audit trail entries are available at this time."}
              </p>
            </div>
          ) : (
            <>
              <div className={REPORT_TABLE_SCROLL_CLASS} role="region" aria-label="Audit trail results">
                <table className="w-full min-w-[920px] md:min-w-[1180px]">
                  <thead className="bg-gradient-to-r from-slate-100 to-slate-50 sticky top-0 z-10">
                    <tr>
                      {columns.map((column) => (
                        <th
                          key={column.key}
                          className={[
                            "px-3 sm:px-4 py-3 sm:py-4 text-left text-[10px] sm:text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap",
                            column.widthClass || "",
                            column.hideOnMobile ? "hidden md:table-cell" : "",
                          ].join(" ")}
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {rows.map((row, index) => (
                      <tr key={row.id || row.hash || index} className="hover:bg-slate-50 transition-colors">
                        {columns.map((column) => (
                          <td
                            key={column.key}
                            className={[
                              "px-3 sm:px-4 py-3 text-xs sm:text-sm text-slate-700 whitespace-nowrap",
                              ["ipAddress", "hash", "correlationId"].includes(column.key) ? "font-mono text-xs" : "",
                              column.widthClass || "",
                              column.hideOnMobile ? "hidden md:table-cell" : "",
                            ].join(" ")}
                          >
                            {column.key === "timestamp" ? (
                              formatDateTime(row?.timestamp)
                            ) : column.key === "action" ? (
                              row?.action ? (
                                <Badge
                                  variant="secondary"
                                  className={`${getActionBadgeColor(row.action)} flex items-center gap-1 w-fit`}
                                >
                                  {row.action}
                                </Badge>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )
                            ) : column.key === "aiConfidence" ? (
                              (() => {
                                const raw = row?.aiConfidence ?? row?.AiConfidence
                                const n = Number(raw)
                                if (!Number.isFinite(n)) return <span className="text-slate-400">-</span>
                                const pct = n <= 1 ? Math.round(n * 100) : Math.round(n)
                                return <span>{pct}%</span>
                              })()
                            ) : column.key === "aiSuggestionLogId" ? (
                              (() => {
                                const raw = row?.aiSuggestionLogId ?? row?.AiSuggestionLogId
                                if (raw == null || String(raw).trim() === "") {
                                  return <span className="text-slate-400">-</span>
                                }
                                return <span>{String(raw)}</span>
                              })()
                            ) : column.key === "oldValue" || column.key === "newValue" ? (
                              <div className="group/cell flex min-w-0 max-w-[360px] items-center gap-1.5">
                                {(() => {
                                  const { display, raw } = formatMaybeDateValue(row?.[column.key])
                                  const isEmpty = !raw
                                  return (
                                    <span
                                      className={[
                                        "min-w-0 flex-1 truncate pr-0.5",
                                        isEmpty ? "text-slate-400" : "",
                                      ].join(" ")}
                                      title={raw}
                                    >
                                      {display}
                                    </span>
                                  )
                                })()}
                                {row?.[column.key] ? (
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(String(row?.[column.key]))}
                                    className={cn(
                                      REPORT_GRID_COPY_BTN_CLASS,
                                      REPORT_GRID_COPY_HOVER_REVEAL_CLASS,
                                      "shrink-0",
                                    )}
                                    title="Copy value"
                                    aria-label="Copy cell value"
                                  >
                                    <Copy className="h-4 w-4" strokeWidth={2} aria-hidden />
                                  </button>
                                ) : null}
                              </div>
                            ) : (
                              (() => {
                                const value = row?.[column.key]
                                const isEmpty = value === null || value === undefined || String(value).trim() === ""
                                const text = isEmpty ? "-" : String(value)
                                return (
                                  <span
                                    className={["block truncate max-w-[240px]", isEmpty ? "text-slate-400" : ""].join(" ")}
                                    title={isEmpty ? "" : text}
                                  >
                                    {text}
                                  </span>
                                )
                              })()
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 0 && (
                <div className="border-t border-slate-200">
                  <DataPagination
                    currentPage={pageNumber}
                    pageSize={pageSize}
                    totalPages={totalPages}
                    totalCount={totalCount}
                    onPageChange={(p) => setPageNumber(p)}
                    onPageSizeChange={(s) => {
                      setPageSize(s)
                      setPageNumber(1)
                    }}
                    itemName="audit trail entries"
                    showPageSizeSelector={true}
                    pageSizeOptions={[10, 20, 50, 100]}
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
