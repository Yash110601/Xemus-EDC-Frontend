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
  Users, 
  Search, 
  Filter, 
  X, 
  Loader2,
  CheckCircle2,
  XCircle
} from "lucide-react"
import reportsService from "@/lib/services/reports.service"
import studyService from "@/lib/services/study.service"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { useReportExportJobs } from "@/context/ReportExportJobsContext"
import { useReportExportAccess } from "@/app/reports/_hooks/useReportExportAccess"
import ReportDownloadActions, { REPORT_CSV_PDF_FORMATS } from "@/components/reports/ReportDownloadActions"

export default function ExportUserDetailsPage() {
  const { canExport, assertCanExport, reportKey, withWorkspace } = useReportExportAccess()
  const { startReportExport, jobs } = useReportExportJobs()
  const csvRunning = jobs.some((j) => j.kind === "user-details-csv" && j.status === "running")
  const pdfRunning = jobs.some((j) => j.kind === "user-details-pdf" && j.status === "running")

  // State management
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalCount, setTotalCount] = useState(0)
  
  // Dropdown data
  const [studies, setStudies] = useState([])
  const [loadingStudies, setLoadingStudies] = useState(false)
  
  // Search state for dropdowns
  const [studySearch, setStudySearch] = useState("")
  
  // Filter state
  const [filters, setFilters] = useState({
    search: "",
    studyId: "",
    role: "ALL",
  })

  // Calculate total pages
  const totalPages = useMemo(() => Math.ceil(totalCount / pageSize), [totalCount, pageSize])

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return filters.search.trim() !== "" || 
           filters.studyId !== "" || 
           filters.role !== "ALL"
  }, [filters])

  // Ref to prevent duplicate API calls
  const isLoadingRef = useRef(false)

  // Load users function
  const loadUsers = useCallback(async () => {
    // Prevent duplicate calls
    if (isLoadingRef.current) {
      return
    }
    
    // studyId is required
    if (!filters.studyId) {
      setUsers([])
      setTotalCount(0)
      return
    }
    
    isLoadingRef.current = true
    setLoading(true)
    try {
      const params = {
        pageNumber,
        pageSize,
        studyId: parseInt(filters.studyId),
        role: filters.role || "ALL",
      }

      if (filters.search.trim()) {
        params.search = filters.search.trim()
      }

      const response = await reportsService.getUserDetailsReport(withWorkspace(params))

      if (response.isSuccess && response.data) {
        setUsers(response.data.items || [])
        setTotalCount(response.data.totalCount || 0)
      } else {
        toast.error(response.message || "Failed to load user details")
        setUsers([])
        setTotalCount(0)
      }
    } catch (error) {
      console.error("Error loading users:", error)
      toast.error(error.message || "Failed to load user details. Please try again.")
      setUsers([])
      setTotalCount(0)
    } finally {
      setLoading(false)
      isLoadingRef.current = false
    }
  }, [pageNumber, pageSize, filters])
  
  // Load studies for dropdown
  useEffect(() => {
    let mounted = true
    setLoadingStudies(true)

    const loadStudies = async () => {
      try {
        const response = await studyService.getStudiesForDropdown()
        if (mounted) {
          if (response.isSuccess && response.data) {
            let studiesData = response.data || []
            // Handle array of strings
            if (Array.isArray(studiesData) && studiesData.length > 0 && typeof studiesData[0] === 'string') {
              studiesData = studiesData.map((name, index) => ({
                studyId: index + 1,
                id: index + 1,
                studyProtocolNumber: name,
                name: name
              }))
            }
            setStudies(studiesData)
          } else {
            toast.error(response.message || "Failed to load studies")
          }
        }
      } catch (error) {
        if (mounted) {
          console.error("Error loading studies:", error)
          toast.error("Failed to load studies. Please try again.")
        }
      } finally {
        if (mounted) {
          setLoadingStudies(false)
        }
      }
    }

    loadStudies()

    return () => {
      mounted = false
    }
  }, [])

  // Initial load and reload on pagination change
  useEffect(() => {
    if (filters.studyId) {
      loadUsers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber, pageSize])

  // Handle filter changes
  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  // Apply filters (reset to page 1 and reload)
  const handleApplyFilters = useCallback(() => {
    if (!filters.studyId) {
      toast.error("Please select a Study")
      return
    }
    setPageNumber(1)
    setTimeout(() => {
      loadUsers()
    }, 0)
  }, [filters.studyId, loadUsers])

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setFilters({
      search: "",
      studyId: "",
      role: "ALL",
    })
    setStudySearch("")
    setPageNumber(1)
    setUsers([])
    setTotalCount(0)
  }, [])

  // Export function (background)
  const handleExport = useCallback(
    (format, { pageSize, orientation } = {}) => {
      if (!assertCanExport()) return
      const kind = `user-details-${format}`
      if (jobs.some((j) => j.kind === kind && j.status === "running")) return

      if (!filters.studyId) {
        toast.error("Please select a Study before exporting")
        return
      }

      startReportExport({
        kind,
        label: `User details (${format.toUpperCase()})`,
        task: async (setDetail) => {
          setDetail("Preparing export…")
          const params = {
            format,
            pageSize,
            orientation,
            studyId: parseInt(filters.studyId),
            role: filters.role || "ALL",
          }

          if (filters.search.trim()) {
            params.search = filters.search.trim()
          }

          setDetail("Requesting file…")
          await reportsService.exportUserDetailsReport(withWorkspace(params))
        },
      })
    },
    [assertCanExport, filters, jobs, startReportExport]
  )

  // Format date for display
  const formatDate = useCallback((dateString) => {
    if (!dateString) return "N/A"
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return "N/A"
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    } catch {
      return "N/A"
    }
  }, [])

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
            <Users className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">User Details Report</h1>
            <p className="text-slate-600 text-sm">View and export user information and details</p>
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
              {/* Study Filter - Required */}
              <div className="space-y-2">
                <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                  Study <span className="text-red-500">*</span>
                </label>
                <Select
                  value={filters.studyId || undefined}
                  onValueChange={(value) => handleFilterChange("studyId", value === "all" ? "" : value)}
                  disabled={loadingStudies}
                >
                  <SelectTrigger className="w-full border-2 border-slate-200 rounded-lg bg-white hover:bg-blue-50 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all px-4 py-3 shadow-sm">
                    <SelectValue placeholder={loadingStudies ? "Loading studies..." : "Select Study"} />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-2 border-slate-200 rounded-lg shadow-lg">
                    {/* Search Input */}
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
                          className="pl-10 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      {studies
                        .filter((study) => {
                          if (!studySearch.trim()) return true
                          const searchLower = studySearch.toLowerCase()
                          const displayName = (study.studyProtocolNumber || 
                                              study.protocolNumber ||
                                              study.name ||
                                              study.studyName ||
                                              (typeof study === 'string' ? study : null) ||
                                              `Study ${study.studyId || study.id}`).toLowerCase()
                          return displayName.includes(searchLower)
                        })
                        .map((study) => {
                          const studyId = study.studyId || study.id
                          const displayName = study.studyProtocolNumber || 
                                            study.protocolNumber ||
                                            study.name ||
                                            study.studyName ||
                                            (typeof study === 'string' ? study : null) ||
                                            `Study ${studyId}`
                          return (
                            <SelectItem key={studyId} value={studyId.toString()} className="px-4 py-2 data-[highlighted]:bg-blue-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors">
                              {displayName}
                            </SelectItem>
                          )
                        })}
                    </div>
                  </SelectContent>
                </Select>
              </div>

              {/* Role Filter */}
              <div className="space-y-2">
                <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                  Role
                </label>
                <Select
                  value={filters.role || "ALL"}
                  onValueChange={(value) => handleFilterChange("role", value)}
                >
                  <SelectTrigger className="w-full border-2 border-slate-200 rounded-lg bg-white hover:bg-blue-50 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all px-4 py-3 shadow-sm">
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-2 border-slate-200 rounded-lg shadow-lg">
                    <SelectItem value="ALL" className="px-4 py-2 data-[highlighted]:bg-blue-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors">All Roles</SelectItem>
                    <SelectItem value="CRC" className="px-4 py-2 data-[highlighted]:bg-blue-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors">CRC</SelectItem>
                    <SelectItem value="CRA" className="px-4 py-2 data-[highlighted]:bg-blue-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors">CRA</SelectItem>
                    <SelectItem value="CRM" className="px-4 py-2 data-[highlighted]:bg-blue-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors">CRM</SelectItem>
                    <SelectItem value="SPONSOR" className="px-4 py-2 data-[highlighted]:bg-blue-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors">SPONSOR</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search */}
              <div className="space-y-2">
                <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Search users..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange("search", e.target.value)}
                    onKeyPress={handleSearchKeyPress}
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
                disabled={loading || !filters.studyId}
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
                defaultSubject="User Details"
                defaultFormat="pdf"
                enabledFormats={REPORT_CSV_PDF_FORMATS}
                disabled={loading || !filters.studyId}
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
                User Details {totalCount > 0 && `(${totalCount} total)`}
              </h2>
            </div>
          </div>

          {loading ? (
            <SectionSkeleton title="Loading user details..." rows={6} variant="userReport" />
          ) : !filters.studyId ? (
            <div className="text-center py-16">
              <Users className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 font-medium mb-2">Please select a Study</p>
              <p className="text-slate-500 text-sm">
                Select a study from the filter above to view user details
              </p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-16">
              <Users className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 font-medium mb-2">No user details found</p>
              <p className="text-slate-500 text-sm">
                {hasActiveFilters 
                  ? "Try adjusting your filters to see more results." 
                  : "No users are available for this study."}
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
                        Study User ID
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        User ID
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        User Name
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Email
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Phone Number
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Role
                      </th>
                      {/*
                       * STUDY NAME column shows `studyProtocolNumber` (short
                       * canonical identifier) with the full marketing-style
                       * `studyName` preserved on hover via tooltip. The
                       * standalone "Protocol #" column was removed because it
                       * duplicated this exact value and added noise to the
                       * report grid.
                       */}
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Study Name
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Site Name
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Doctor Name
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Agreement Signed
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Is Active
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Created By
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Created At
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Updated By
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Updated At
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {users.map((user) => (
                      <tr 
                        key={user.studyUserId} 
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm text-slate-900 font-medium">
                          {user.studyUserId || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-900 font-medium">
                          {user.userId || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {user.userName || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {user.email || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {user.phoneNumber || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {user.roleName ? (
                            <Badge 
                              variant="secondary"
                              className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                            >
                              {user.roleName}
                            </Badge>
                          ) : (
                            "N/A"
                          )}
                        </td>
                        {/*
                         * STUDY NAME column intentionally prefers `studyProtocolNumber`
                         * (e.g. "Yuthbless") because the full `studyName` is a long
                         * marketing-style title that wraps badly in a table cell.
                         * The full `studyName` is preserved on hover via the tooltip
                         * so users never lose access to the long-form title.
                         * `studyName` is the fallback when a row has no protocol number.
                         */}
                        <td
                          className="px-4 py-3 text-sm text-slate-700 max-w-[220px] truncate"
                          title={user.studyName || user.studyProtocolNumber || ""}
                        >
                          {user.studyProtocolNumber || user.studyName || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {user.siteName || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {user.doctorName || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {user.isAgreementSigned ? (
                            <div className="flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                              <span className="text-green-700 font-medium">Yes</span>
                              {user.signedAt && (
                                <span className="text-xs text-slate-500 ml-1">
                                  ({formatDate(user.signedAt)})
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <XCircle className="w-4 h-4 text-red-600" />
                              <span className="text-red-700 font-medium">No</span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {user.isActive ? (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                              Active
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                              Inactive
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {user.createdByName || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                          {formatDateTime(user.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {user.updatedByName || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                          {formatDateTime(user.updatedAt)}
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
                  itemName="users"
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
