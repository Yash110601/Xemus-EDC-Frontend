"use client"

import { REPORT_PAGE_SHELL_CLASS } from "@/lib/reports/studySitePatientReportUi"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import DataPagination from "@/components/ui/data-pagination"
import SectionSkeleton from "@/components/ui/section-skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Search,
  Calendar,
  Filter,
  X,
  Loader2,
  Shield,
  Copy
} from "lucide-react"
import reportsService from "@/lib/services/reports.service"
import userService from "@/lib/services/user.service"
import { toast } from "sonner"
import { useReportExportJobs } from "@/context/ReportExportJobsContext"
import { cn } from "@/lib/utils"
import {
  REPORT_GRID_COPY_BTN_CLASS,
  REPORT_GRID_COPY_HOVER_REVEAL_CLASS,
} from "@/lib/reports/reportRowDisplay"
import { useReportExportAccess } from "@/app/reports/_hooks/useReportExportAccess"
import ReportDownloadActions, { REPORT_CSV_PDF_FORMATS } from "@/components/reports/ReportDownloadActions"

export default function AuditLogPage() {
  const { canExport, assertCanExport, reportKey, withWorkspace } = useReportExportAccess()
  const { startReportExport, jobs } = useReportExportJobs()
  const csvRunning = jobs.some((j) => j.kind === "audit-log-csv" && j.status === "running")
  const pdfRunning = jobs.some((j) => j.kind === "audit-log-pdf" && j.status === "running")

  // State management
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalCount, setTotalCount] = useState(0)

  // Filter state
  const [filters, setFilters] = useState({
    search: "",
    entityName: "",
    action: "",
    userId: "",
    startDate: "",
    endDate: "",
  })

  // Copy to clipboard function
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

  // Users dropdown data (for User Id)
  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [userSearch, setUserSearch] = useState("")


  // Calculate total pages
  const totalPages = useMemo(() => Math.ceil(totalCount / pageSize), [totalCount, pageSize])

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return filters.search.trim() !== "" ||
      filters.entityName !== "" ||
      filters.action !== "" ||
      filters.userId.trim() !== "" ||
      filters.startDate !== "" ||
      filters.endDate !== ""
  }, [filters])

  // Ref to prevent duplicate API calls
  const isLoadingRef = useRef(false)

  // Load audit logs function - use filters from state directly to avoid dependency issues
  const loadAuditLogs = useCallback(async () => {
    // Prevent duplicate calls
    if (isLoadingRef.current) {
      return
    }

    isLoadingRef.current = true
    setLoading(true)
    try {
      const params = withWorkspace({
        pageNumber,
        pageSize,
      })

      // Add filters from current state
      if (filters.entityName) {
        params.entityName = filters.entityName
      }

      if (filters.action) {
        params.action = filters.action
      }

      if (filters.userId.trim()) {
        const userIdNum = parseInt(filters.userId.trim())
        if (!isNaN(userIdNum) && userIdNum > 0) {
          params.userId = userIdNum
        }
      }

      if (filters.startDate) {
        params.startDate = new Date(filters.startDate)
      }

      if (filters.endDate) {
        params.endDate = new Date(filters.endDate)
      }

      if (filters.search.trim()) {
        params.search = filters.search.trim()
      }

      const response = await reportsService.getAuditLogReport(params)

      if (response.isSuccess && response.data) {
        setAuditLogs(response.data.items || [])
        setTotalCount(response.data.totalCount || 0)
      } else {
        toast.error(response.message || "Failed to load audit logs")
        setAuditLogs([])
        setTotalCount(0)
      }
    } catch (error) {
      console.error("Error loading audit logs:", error)
      toast.error(error.message || "Failed to load audit logs. Please try again.")
      setAuditLogs([])
      setTotalCount(0)
    } finally {
      setLoading(false)
      isLoadingRef.current = false
    }
  }, [pageNumber, pageSize, filters, withWorkspace])

  // Initial load and reload on pagination change only
  // Filters are applied only when Search button is clicked
  useEffect(() => {
    loadAuditLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber, pageSize, withWorkspace])

  // Load users for dropdown once
  useEffect(() => {
    let mounted = true
    setLoadingUsers(true)

    userService
      .getAllUsers(1, 500, "", true)
      .then((res) => {
        if (!mounted) return
        const data = res?.data
        const items = Array.isArray(data) ? data : data?.items || data?.Items || []
        setUsers(res?.isSuccess && items ? items : [])
      })
      .catch(() => {
        if (mounted) setUsers([])
      })
      .finally(() => {
        if (mounted) setLoadingUsers(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  // Handle filter changes
  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  // Apply filters (reset to page 1 and reload)
  const handleApplyFilters = useCallback(() => {
    if (filters.startDate && filters.endDate) {
      const start = new Date(filters.startDate)
      const end = new Date(filters.endDate)
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start > end) {
        toast.error("Start Date cannot be after End Date")
        return
      }
    }
    setPageNumber(1)
    // loadAuditLogs will be called by useEffect when pageNumber changes
    // But we need to ensure it uses current filters, so we'll trigger it manually
    // after a small delay to ensure state is updated
    setTimeout(() => {
      loadAuditLogs()
    }, 0)
  }, [loadAuditLogs])

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setFilters({
      search: "",
      entityName: "",
      action: "",
      userId: "",
      module: "",
      startDate: "",
      endDate: "",
    })
    setUserSearch("")

    setPageNumber(1)
    // If already on page 1, ensure we refresh with cleared filters
    setTimeout(() => {
      loadAuditLogs()
    }, 0)
  }, [loadAuditLogs])

  // Export function (background)
  const handleExport = useCallback(
    (format, { pageSize, orientation } = {}) => {
      if (!assertCanExport()) return
      const kind = `audit-log-${format}`
      if (jobs.some((j) => j.kind === kind && j.status === "running")) return

      if (filters.startDate && filters.endDate) {
        const start = new Date(filters.startDate)
        const end = new Date(filters.endDate)
        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start > end) {
          toast.error("Start Date cannot be after End Date")
          return
        }
      }

      startReportExport({
        kind,
        label: `Audit log (${format.toUpperCase()})`,
        task: async (setDetail) => {
          setDetail("Preparing export…")
          const params = withWorkspace({ format, pageSize, orientation })

          if (filters.entityName) {
            params.entityName = filters.entityName
          }

          if (filters.action) {
            params.action = filters.action
          }

          if (filters.userId.trim()) {
            const userIdNum = parseInt(filters.userId.trim())
            if (!isNaN(userIdNum) && userIdNum > 0) {
              params.userId = userIdNum
            }
          }

          if (filters.startDate) {
            params.startDate = new Date(filters.startDate)
          }

          if (filters.endDate) {
            params.endDate = new Date(filters.endDate)
          }

          if (filters.search.trim()) {
            params.search = filters.search.trim()
          }

          setDetail("Requesting file…")
          await reportsService.exportAuditLogReport(params)
        },
      })
    },
    [assertCanExport, filters, jobs, startReportExport, withWorkspace]
  )

  // Format date and time for display
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

  // Get action badge color
  const getActionBadgeColor = useCallback((action) => {
    if (!action) return "bg-slate-100 text-slate-800"
    const actionLower = action.toLowerCase()
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

  // Handle page change
  const handlePageChange = useCallback((newPage) => {
    setPageNumber(newPage)
  }, [])

  // Handle page size change
  const handlePageSizeChange = useCallback((newPageSize) => {
    setPageSize(newPageSize)
    setPageNumber(1)
  }, [])

  // Handle Enter key in search
  const handleSearchKeyPress = useCallback((e) => {
    if (e.key === "Enter") {
      handleApplyFilters()
    }
  }, [handleApplyFilters])

  return (
    <DashboardLayout>
      <div className={REPORT_PAGE_SHELL_CLASS}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <Shield className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Audit Log Report</h1>
            <p className="text-slate-600 text-sm">View and export system audit log entries and activities</p>
          </div>
        </div>

        {/* Filters Section */}
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

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
              {/* Search */}
              <div className="space-y-2">
                <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Search audit logs..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange("search", e.target.value)}
                    onKeyPress={handleSearchKeyPress}
                    className="pl-10 border-2 border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                </div>
              </div>

              {/* Entity Name Filter */}
              <div className="space-y-2">
                <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                  Entity Name
                </label>
                <Select
                  value={filters.entityName || undefined}
                  onValueChange={(value) => handleFilterChange("entityName", value === "all" ? "" : value)}
                >
                  <SelectTrigger className="w-full border-2 border-slate-200 rounded-lg bg-white hover:bg-blue-50 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all px-4 py-3 shadow-sm">
                    <SelectValue placeholder="All Entities" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-2 border-slate-200 rounded-lg shadow-lg">
                    <SelectItem value="all" className="px-4 py-2 data-[highlighted]:bg-blue-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors">All Entities</SelectItem>
                    <SelectItem value="Study" className="px-4 py-2 data-[highlighted]:bg-blue-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors">Study</SelectItem>
                    <SelectItem value="Site" className="px-4 py-2 data-[highlighted]:bg-blue-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors">Site</SelectItem>
                    <SelectItem value="Patient" className="px-4 py-2 data-[highlighted]:bg-blue-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors">Patient</SelectItem>
                    <SelectItem value="CRFData" className="px-4 py-2 data-[highlighted]:bg-blue-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors">CRF Data</SelectItem>
                    <SelectItem value="VisitSchedule" className="px-4 py-2 data-[highlighted]:bg-blue-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors">Visit Schedule</SelectItem>
                    <SelectItem value="CrfDesign" className="px-4 py-2 data-[highlighted]:bg-blue-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors">CRF Design</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Action Filter */}
              <div className="space-y-2">
                <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                  Action
                </label>
                <Select
                  value={filters.action || undefined}
                  onValueChange={(value) => handleFilterChange("action", value === "all" ? "" : value)}
                >
                  <SelectTrigger className="w-full border-2 border-slate-200 rounded-lg bg-white hover:bg-blue-50 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all px-4 py-3 shadow-sm">
                    <SelectValue placeholder="All Actions" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-2 border-slate-200 rounded-lg shadow-lg">
                    <SelectItem value="all" className="px-4 py-2 data-[highlighted]:bg-blue-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors">All Actions</SelectItem>
                    <SelectItem value="Create" className="px-4 py-2 data-[highlighted]:bg-blue-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors">Create</SelectItem>
                    <SelectItem value="Update" className="px-4 py-2 data-[highlighted]:bg-blue-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors">Update</SelectItem>
                    <SelectItem value="Delete" className="px-4 py-2 data-[highlighted]:bg-blue-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors">Delete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
              {/* User Filter */}
              <div className="space-y-2">
                <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                  User
                </label>
                <Select
                  value={filters.userId || undefined}
                  onValueChange={(value) => handleFilterChange("userId", value === "all" ? "" : value)}
                  disabled={loadingUsers}
                >
                  <SelectTrigger className="w-full border-2 border-slate-200 rounded-lg bg-white hover:bg-blue-50 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all px-4 py-3 shadow-sm">
                    <SelectValue placeholder={loadingUsers ? "Loading users..." : "All Users"} />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-2 border-slate-200 rounded-lg shadow-lg p-0">
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
                          className="pl-10 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      <SelectItem value="all" className="px-4 py-2 data-[highlighted]:bg-blue-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors">
                        All Users
                      </SelectItem>
                      {users
                        .filter((u) => {
                          if (!userSearch.trim()) return true
                          const s = userSearch.toLowerCase()
                          const id = u.userId || u.id
                          const email = u.email || u.userEmail || ""
                          const name =
                            u.userName ||
                            u.username ||
                            `${u.firstName || ""} ${u.lastName || ""}`.trim()
                          return `${email} ${name} ${id || ""}`.toLowerCase().includes(s)
                        })
                        .map((u) => {
                          const id = u.userId || u.id
                          if (!id) return null
                          const label =
                            u.userName ||
                            u.username ||
                            u.email ||
                            `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
                            `User ${id}`
                          return (
                            <SelectItem
                              key={id}
                              value={id.toString()}
                              className="px-4 py-2 data-[highlighted]:bg-blue-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors"
                            >
                              {label}
                            </SelectItem>
                          )
                        })}
                    </div>
                  </SelectContent>
                </Select>
              </div>

              {/* Start Date */}
              <div className="space-y-2">
                <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                  Start Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <Input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange("startDate", e.target.value)}
                    className="pl-10 border-2 border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                </div>
              </div>

              {/* End Date */}
              <div className="space-y-2">
                <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                  End Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <Input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange("endDate", e.target.value)}
                    min={filters.startDate || undefined}
                    className="pl-10 border-2 border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                </div>
              </div>
            </div>


            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <Button
                onClick={handleApplyFilters}
                className="bg-gradient-to-r btn-brand-gradient  text-white shadow-md"
                disabled={loading}
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

              <Button
                onClick={handleClearFilters}
                variant="outline"
                disabled={loading || !hasActiveFilters}
                className="border-slate-300 hover:bg-blue-50"
              >
                <X className="w-4 h-4 mr-2" />
                Clear
              </Button>

              <div className="flex-1" />

              <ReportDownloadActions
                canExport={canExport}
                reportKey={reportKey}
                assertCanExport={assertCanExport}
                defaultSubject="Audit Log"
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

        {/* Results Section */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-100 to-slate-50 px-6 py-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">
                Audit Log Entries {totalCount > 0 && `(${totalCount} total)`}
              </h2>
            </div>
          </div>

          {loading ? (
            <SectionSkeleton title="Loading audit logs..." rows={7} variant="audit" />
          ) : auditLogs.length === 0 ? (
            <div className="text-center py-16">
              <Shield className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 font-medium mb-2">No audit log entries found</p>
              <p className="text-slate-500 text-sm">
                {hasActiveFilters
                  ? "Try adjusting your filters to see more results."
                  : "No audit log entries are available at this time."}
              </p>
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-slate-100 to-slate-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        ID
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Timestamp
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Entity Name
                      </th>

                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Action
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Username
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        User Email
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        IP Address
                      </th>

                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Description
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Hash
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {auditLogs.map((log) => (
                      <tr
                        key={log.id}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm text-slate-900 font-medium">
                          {log.id || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                          {formatDateTime(log.timestamp)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                          {log.entityName || "N/A"}
                        </td>

                        <td className="px-4 py-3 text-sm">
                          {log.action ? (
                            <Badge
                              variant="secondary"
                              className={`${getActionBadgeColor(log.action)} flex items-center gap-1 w-fit`}
                            >
                              {log.action}
                            </Badge>
                          ) : (
                            "N/A"
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                          {log.username || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {log.userEmail || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 font-mono text-xs whitespace-nowrap">
                          {log.ipAddress || "N/A"}
                        </td>

                        <td className="px-4 py-3 text-sm text-slate-700 max-w-xs">
                          <div className="group/cell relative flex min-w-0 items-center gap-1.5">
                            <span
                              className="min-w-0 flex-1 truncate pr-0.5"
                              title={log.description || ""}
                            >
                              {log.description || "N/A"}
                            </span>
                            {log.description && (
                              <button
                                type="button"
                                onClick={() => copyToClipboard(log.description)}
                                className={cn(
                                  REPORT_GRID_COPY_BTN_CLASS,
                                  REPORT_GRID_COPY_HOVER_REVEAL_CLASS,
                                  "shrink-0",
                                )}
                                title="Copy description"
                                aria-label="Copy description"
                              >
                                <Copy className="h-4 w-4" strokeWidth={2} aria-hidden />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 font-mono text-xs whitespace-nowrap">
                          {log.hash ? (
                            <span className="truncate max-w-[100px] inline-block" title={log.hash}>
                              {log.hash}
                            </span>
                          ) : (
                            "N/A"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 0 && (
                <DataPagination
                  currentPage={pageNumber}
                  pageSize={pageSize}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                  itemName="audit log entries"
                  showPageSizeSelector={true}
                  pageSizeOptions={[10, 20, 50, 100]}
                />
              )}
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
