"use client"

import { REPORT_PAGE_SHELL_CLASS } from "@/lib/reports/studySitePatientReportUi"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import DataPagination from "@/components/ui/data-pagination"
import SectionSkeleton from "@/components/ui/section-skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  FileText, 
  Search, 
  Calendar, 
  Filter, 
  X, 
  Loader2,
  ExternalLink
} from "lucide-react"
import reportsService from "@/lib/services/reports.service"
import studyService from "@/lib/services/study.service"
import agreementService from "@/lib/services/agreement.service"
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
import { useStudyAgreementEnabledForStudy } from "@/hooks/useStudyAgreementEnabled"
import { fetchIsAgreementEnabledForStudy } from "@/lib/utils/studyAgreementGate"

export default function ExportAgreementReportPage() {
  const { canExport, assertCanExport, reportKey, withWorkspace } = useReportExportAccess()
  const { startReportExport, jobs } = useReportExportJobs()
  const csvRunning = jobs.some((j) => j.kind === "agreement-report-csv" && j.status === "running")
  const pdfRunning = jobs.some((j) => j.kind === "agreement-report-pdf" && j.status === "running")

  // State management
  const [agreements, setAgreements] = useState([])
  const [loading, setLoading] = useState(false)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalCount, setTotalCount] = useState(0)
  
  // Dropdown data
  const [studies, setStudies] = useState([])
  const [loadingStudies, setLoadingStudies] = useState(false)
  const [agreementOptions, setAgreementOptions] = useState([])
  const [loadingAgreementOptions, setLoadingAgreementOptions] = useState(false)
  
  // Search state for dropdowns
  const [studySearch, setStudySearch] = useState("")
  
  // Filter state
  const [filters, setFilters] = useState({
    search: "",
    studyId: "",
    agreementId: "",
    startDate: "",
    endDate: "",
  })

  // Refs to track AbortControllers for each API call
  const agreementsAbortControllerRef = useRef(null)
  const loadingAgreementStudyIdRef = useRef(null)
  const isLoadingRef = useRef(false)

  // Calculate total pages
  const totalPages = useMemo(() => Math.ceil(totalCount / pageSize), [totalCount, pageSize])

  // Check if any filters are active
  const { isAgreementEnabled: studyAgreementEnabled } = useStudyAgreementEnabledForStudy(filters.studyId)
  const agreementBlockedForStudy =
    Boolean(filters.studyId) && studyAgreementEnabled === false

  const hasActiveFilters = useMemo(() => {
    return filters.search.trim() !== "" || 
           filters.studyId !== "" || 
           filters.agreementId !== "" ||
           filters.startDate !== "" || 
           filters.endDate !== ""
  }, [filters])

  // Load agreements function - use filters from state directly to avoid dependency issues
  const loadAgreements = useCallback(async () => {
    // Prevent duplicate calls
    if (isLoadingRef.current) {
      return
    }

    if (filters.studyId) {
      const studyIdNum = Number.parseInt(String(filters.studyId), 10)
      if (Number.isFinite(studyIdNum) && studyIdNum > 0) {
        const enabled = await fetchIsAgreementEnabledForStudy(studyIdNum)
        if (!enabled) {
          setAgreements([])
          setTotalCount(0)
          setLoading(false)
          return
        }
      }
    }
    
    isLoadingRef.current = true
    setLoading(true)
    try {
      const params = {
        pageNumber,
        pageSize,
      }

      // Add filters from current state
      if (filters.studyId) {
        const studyIdNum = parseInt(filters.studyId)
        if (!isNaN(studyIdNum) && studyIdNum > 0) {
          params.studyId = studyIdNum
        }
      }

      if (filters.agreementId) {
        const agreementIdNum = parseInt(filters.agreementId)
        if (!isNaN(agreementIdNum) && agreementIdNum > 0) {
          params.agreementId = agreementIdNum
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

      const response = await reportsService.getAgreementDetailsReport(withWorkspace(params))

      if (response.isSuccess && response.data) {
        setAgreements(response.data.items || [])
        setTotalCount(response.data.totalCount || 0)
      } else {
        toast.error(response.message || "Failed to load agreement details")
        setAgreements([])
        setTotalCount(0)
      }
    } catch (error) {
      console.error("Error loading agreements:", error)
      toast.error(error.message || "Failed to load agreement details. Please try again.")
      setAgreements([])
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

  // Load agreements for dropdown when study is selected
  useEffect(() => {
    // Early return if no study selected
    if (!filters.studyId) {
      setAgreementOptions([])
      loadingAgreementStudyIdRef.current = null
      if (agreementsAbortControllerRef.current) {
        agreementsAbortControllerRef.current.abort()
        agreementsAbortControllerRef.current = null
      }
      return
    }

    const studyIdNum = parseInt(filters.studyId)
    if (isNaN(studyIdNum) || studyIdNum <= 0) {
      setAgreementOptions([])
      loadingAgreementStudyIdRef.current = null
      if (agreementsAbortControllerRef.current) {
        agreementsAbortControllerRef.current.abort()
        agreementsAbortControllerRef.current = null
      }
      return
    }

    // Cancel previous request if it exists and is for a different studyId
    if (agreementsAbortControllerRef.current && loadingAgreementStudyIdRef.current !== studyIdNum) {
      agreementsAbortControllerRef.current.abort()
      agreementsAbortControllerRef.current = null
    }

    // Prevent duplicate calls - only proceed if this studyId is not already being loaded
    if (agreementsAbortControllerRef.current && loadingAgreementStudyIdRef.current === studyIdNum) {
      return
    }

    // Mark as loading and track the studyId
    loadingAgreementStudyIdRef.current = studyIdNum
    const abortController = new AbortController()
    agreementsAbortControllerRef.current = abortController
    setLoadingAgreementOptions(true)

    const loadAgreements = async () => {
      try {
        // Use getAgreementsList with studyId to get agreements for dropdown
        const response = await agreementService.getAgreementsList(1, 1000, null, studyIdNum, null)
        // Only update if this request hasn't been aborted and is still the current one
        if (!abortController.signal.aborted && loadingAgreementStudyIdRef.current === studyIdNum) {
          if (response.isSuccess && response.data) {
            const items = response.data.items || response.data || []
            setAgreementOptions(items)
          } else {
            setAgreementOptions([])
          }
        }
      } catch (error) {
        // Only log error if this request hasn't been aborted
        if (!abortController.signal.aborted && loadingAgreementStudyIdRef.current === studyIdNum) {
          console.error("Error loading agreements:", error)
          setAgreementOptions([])
        }
      } finally {
        if (!abortController.signal.aborted && loadingAgreementStudyIdRef.current === studyIdNum) {
          setLoadingAgreementOptions(false)
        }
        // Clear refs only if this is still the current request
        if (loadingAgreementStudyIdRef.current === studyIdNum && agreementsAbortControllerRef.current === abortController) {
          agreementsAbortControllerRef.current = null
          loadingAgreementStudyIdRef.current = null
        }
      }
    }

    loadAgreements()

    // Cleanup function
    return () => {
      // Only abort if this is still the current request
      if (agreementsAbortControllerRef.current === abortController && loadingAgreementStudyIdRef.current === studyIdNum) {
        abortController.abort()
        agreementsAbortControllerRef.current = null
        loadingAgreementStudyIdRef.current = null
      }
    }
  }, [filters.studyId])

  // Initial load and reload on pagination change only
  // Filters are applied only when Search button is clicked
  useEffect(() => {
    loadAgreements()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber, pageSize])

  // Handle filter changes
  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => {
      const newFilters = { ...prev, [key]: value }
      // Clear agreementId when study changes
      if (key === "studyId") {
        newFilters.agreementId = ""
      }
      return newFilters
    })
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
    // loadAgreements will be called by useEffect when pageNumber changes
    // But we need to ensure it uses current filters, so we'll trigger it manually
    // after a small delay to ensure state is updated
    setTimeout(() => {
      loadAgreements()
    }, 0)
  }, [loadAgreements])

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setFilters({
      search: "",
      studyId: "",
      agreementId: "",
      startDate: "",
      endDate: "",
    })
    setStudySearch("")
    setAgreementOptions([])
    setPageNumber(1)
    // If already on page 1, ensure we refresh with cleared filters
    setTimeout(() => {
      loadAgreements()
    }, 0)
  }, [loadAgreements])

  // Export function (background)
  const handleExport = useCallback(
    (format, { pageSize, orientation } = {}) => {
      if (!assertCanExport()) return
      const kind = `agreement-report-${format}`
      if (jobs.some((j) => j.kind === kind && j.status === "running")) return

      if (agreementBlockedForStudy) {
        toast.error("Agreement is disabled for the selected study in Study Settings.")
        return
      }

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
        label: `Agreement details (${format.toUpperCase()})`,
        task: async (setDetail) => {
          setDetail("Preparing export…")
          const params = { format, pageSize, orientation }

          if (filters.studyId) {
            const studyIdNum = parseInt(filters.studyId)
            if (!isNaN(studyIdNum) && studyIdNum > 0) {
              params.studyId = studyIdNum
            }
          }

          if (filters.agreementId) {
            const agreementIdNum = parseInt(filters.agreementId)
            if (!isNaN(agreementIdNum) && agreementIdNum > 0) {
              params.agreementId = agreementIdNum
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
          await reportsService.exportAgreementDetailsReport(withWorkspace(params))
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
            <FileText className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Agreement Details Report</h1>
            <p className="text-slate-600 text-sm">View and export agreement information and details</p>
          </div>
        </div>

        {agreementBlockedForStudy && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Agreement is turned off for this study in Study Settings. Select another study or enable
            &quot;Agreement enabled&quot; for this study.
          </div>
        )}

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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5 mb-6">
              {/* Search */}
              <div className="space-y-2">
                <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Search agreements..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange("search", e.target.value)}
                    onKeyPress={handleSearchKeyPress}
                    className="pl-10 border-2 border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  />
                </div>
              </div>

              {/* Study Filter */}
              <div className="space-y-2">
                <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                  Study
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
                      <SelectItem value="all" className="px-4 py-2 data-[highlighted]:bg-blue-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors">All Studies</SelectItem>
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

              {/* Agreement Filter */}
              <div className="space-y-2">
                <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                  Agreement
                </label>
                <Select
                  value={filters.agreementId || undefined}
                  onValueChange={(value) => handleFilterChange("agreementId", value === "all" ? "" : value)}
                  disabled={loadingAgreementOptions || !filters.studyId}
                >
                  <SelectTrigger className="w-full border-2 border-slate-200 rounded-lg bg-white hover:bg-blue-50 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all px-4 py-3 shadow-sm">
                    <SelectValue 
                      placeholder={
                        !filters.studyId 
                          ? "Select Study first" 
                          : loadingAgreementOptions 
                            ? "Loading agreements..." 
                            : "Select Agreement"
                      } 
                    />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-2 border-slate-200 rounded-lg shadow-lg">
                    <SelectItem value="all" className="px-4 py-2 data-[highlighted]:bg-blue-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors">All Agreements</SelectItem>
                    {agreementOptions.map((agreement) => {
                      const agreementId = agreement.id || agreement.agreementId
                      if (!agreementId) return null
                      const displayName = agreement.companyName || 
                                        agreement.name ||
                                        agreement.agreementNumber ||
                                        (typeof agreement === 'string' ? agreement : null) ||
                                        `Agreement ${agreementId}`
                      return (
                        <SelectItem key={agreementId} value={agreementId.toString()} className="px-4 py-2 data-[highlighted]:bg-blue-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors">
                          {displayName}
                        </SelectItem>
                      )
                    })}
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
                defaultSubject="Agreement Report"
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
                Agreement Details {totalCount > 0 && `(${totalCount} total)`}
              </h2>
            </div>
          </div>

          {loading ? (
            <SectionSkeleton title="Loading agreement details..." rows={6} variant="agreementReport" />
          ) : agreements.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 font-medium mb-2">No agreement details found</p>
              <p className="text-slate-500 text-sm">
                {hasActiveFilters 
                  ? "Try adjusting your filters to see more results." 
                  : "No agreements are available at this time."}
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
                        GUID
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Protocol #
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Company Name
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Tagline
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Phone
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Website
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        CIN
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        GST
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Representative
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Created By
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Updated By
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {agreements.map((agreement) => (
                      <tr 
                        key={agreement.id} 
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm text-slate-900 font-medium">
                          {agreement.id || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 font-mono text-xs whitespace-nowrap">
                          {agreement.guid || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-900 font-medium whitespace-nowrap">
                          {agreement.studyProtocolNumber || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                          {agreement.companyName || "N/A"}
                        </td>
                        <td 
                          className="px-4 py-3 text-sm text-slate-700 max-w-xs truncate" 
                          title={agreement.tagline || ""}
                        >
                          {agreement.tagline || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                          {agreement.phoneNumber || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {agreement.website ? (
                            <a 
                              href={agreement.website} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-emerald-600 hover:text-emerald-800 hover:underline flex items-center gap-1"
                            >
                              <span className="truncate max-w-[150px]">{agreement.website}</span>
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            </a>
                          ) : (
                            "N/A"
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                          {agreement.cin || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                          {agreement.gst || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {agreement.companyRepresentativeName 
                            ? `${agreement.companyRepresentativeName}${agreement.designation ? ` (${agreement.designation})` : ""}`
                            : "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {agreement.createdByName || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {agreement.updatedByName || "N/A"}
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
                  itemName="agreements"
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
