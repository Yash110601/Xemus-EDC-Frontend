"use client"

import { REPORT_PAGE_SHELL_CLASS } from "@/lib/reports/studySitePatientReportUi"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import DataPagination from "@/components/ui/data-pagination"
import SectionSkeleton from "@/components/ui/section-skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  MapPin, 
  Search, 
  Calendar, 
  Filter, 
  X, 
  Loader2,
  Clipboard
} from "lucide-react"
import reportsService from "@/lib/services/reports.service"
import studyService from "@/lib/services/study.service"
import siteService from "@/lib/services/site.service"
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

export default function ExportSiteDetailsPage() {
  const { canExport, assertCanExport, reportKey, withWorkspace } = useReportExportAccess()
  const { startReportExport, jobs } = useReportExportJobs()
  const csvRunning = jobs.some((j) => j.kind === "site-details-csv" && j.status === "running")
  const pdfRunning = jobs.some((j) => j.kind === "site-details-pdf" && j.status === "running")

  // State management
  const [sites, setSites] = useState([])
  const [loading, setLoading] = useState(false)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalCount, setTotalCount] = useState(0)
  
  // Dropdown data
  const [studies, setStudies] = useState([])
  const [loadingStudies, setLoadingStudies] = useState(false)
  const [siteOptions, setSiteOptions] = useState([])
  const [loadingSiteOptions, setLoadingSiteOptions] = useState(false)
  
  // Search state for dropdowns
  const [studySearch, setStudySearch] = useState("")
  const [siteSearch, setSiteSearch] = useState("")
  
  // Filter state
  const [filters, setFilters] = useState({
    search: "",
    studyId: "",
    siteId: "",
    startDate: "",
    endDate: "",
  })

  // Refs to track AbortControllers for each API call
  const sitesAbortControllerRef = useRef(null)
  const loadingSiteStudyIdRef = useRef(null)
  const isLoadingRef = useRef(false)

  // Calculate total pages
  const totalPages = useMemo(() => Math.ceil(totalCount / pageSize), [totalCount, pageSize])

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return filters.search.trim() !== "" || 
           filters.studyId !== "" || 
           filters.siteId !== "" ||
           filters.startDate !== "" || 
           filters.endDate !== ""
  }, [filters])

  // Load sites function - use filters from state directly to avoid dependency issues
  const loadSites = useCallback(async () => {
    // Prevent duplicate calls
    if (isLoadingRef.current) {
      return
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

      if (filters.siteId) {
        const siteIdNum = parseInt(filters.siteId)
        if (!isNaN(siteIdNum) && siteIdNum > 0) {
          params.siteId = siteIdNum
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

      const response = await reportsService.getSiteDetailsReport(withWorkspace(params))

      if (response.isSuccess && response.data) {
        setSites(response.data.items || [])
        setTotalCount(response.data.totalCount || 0)
      } else {
        toast.error(response.message || "Failed to load site details")
        setSites([])
        setTotalCount(0)
      }
    } catch (error) {
      console.error("Error loading sites:", error)
      toast.error(error.message || "Failed to load site details. Please try again.")
      setSites([])
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

  // Load sites for dropdown when study is selected
  useEffect(() => {
    // Early return if no study selected
    if (!filters.studyId) {
      setSiteOptions([])
      loadingSiteStudyIdRef.current = null
      if (sitesAbortControllerRef.current) {
        sitesAbortControllerRef.current.abort()
        sitesAbortControllerRef.current = null
      }
      return
    }

    const studyIdNum = parseInt(filters.studyId)
    if (isNaN(studyIdNum) || studyIdNum <= 0) {
      setSiteOptions([])
      loadingSiteStudyIdRef.current = null
      if (sitesAbortControllerRef.current) {
        sitesAbortControllerRef.current.abort()
        sitesAbortControllerRef.current = null
      }
      return
    }

    // Cancel previous request if it exists and is for a different studyId
    if (sitesAbortControllerRef.current && loadingSiteStudyIdRef.current !== studyIdNum) {
      sitesAbortControllerRef.current.abort()
      sitesAbortControllerRef.current = null
    }

    // Prevent duplicate calls - only proceed if this studyId is not already being loaded
    if (sitesAbortControllerRef.current && loadingSiteStudyIdRef.current === studyIdNum) {
      return
    }

    // Mark as loading and track the studyId
    loadingSiteStudyIdRef.current = studyIdNum
    const abortController = new AbortController()
    sitesAbortControllerRef.current = abortController
    setLoadingSiteOptions(true)

    const loadSites = async () => {
      try {
        const response = await siteService.getSitesForDropdown(studyIdNum)
        // Only update if this request hasn't been aborted and is still the current one
        if (!abortController.signal.aborted && loadingSiteStudyIdRef.current === studyIdNum) {
          if (response.isSuccess && response.data) {
            let sitesData = response.data || []
            // Handle array of strings
            if (Array.isArray(sitesData) && sitesData.length > 0 && typeof sitesData[0] === 'string') {
              sitesData = sitesData.map((name, index) => ({
                siteId: index + 1,
                id: index + 1,
                siteName: name,
                name: name
              }))
            }
            setSiteOptions(sitesData)
          } else {
            setSiteOptions([])
          }
        }
      } catch (error) {
        // Only log error if this request hasn't been aborted
        if (!abortController.signal.aborted && loadingSiteStudyIdRef.current === studyIdNum) {
          console.error("Error loading sites:", error)
          setSiteOptions([])
        }
      } finally {
        if (!abortController.signal.aborted && loadingSiteStudyIdRef.current === studyIdNum) {
          setLoadingSiteOptions(false)
        }
        // Clear refs only if this is still the current request
        if (loadingSiteStudyIdRef.current === studyIdNum && sitesAbortControllerRef.current === abortController) {
          sitesAbortControllerRef.current = null
          loadingSiteStudyIdRef.current = null
        }
      }
    }

    loadSites()

    // Cleanup function
    return () => {
      // Only abort if this is still the current request
      if (sitesAbortControllerRef.current === abortController && loadingSiteStudyIdRef.current === studyIdNum) {
        abortController.abort()
        sitesAbortControllerRef.current = null
        loadingSiteStudyIdRef.current = null
      }
    }
  }, [filters.studyId])

  // Initial load and reload on pagination change only
  // Filters are applied only when Search button is clicked
  useEffect(() => {
    loadSites()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber, pageSize])

  // Handle filter changes
  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => {
      const newFilters = { ...prev, [key]: value }
      // Clear siteId when study changes
      if (key === "studyId") {
        newFilters.siteId = ""
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
    // loadSites will be called by useEffect when pageNumber changes
    // But we need to ensure it uses current filters, so we'll trigger it manually
    // after a small delay to ensure state is updated
    setTimeout(() => {
      loadSites()
    }, 0)
  }, [loadSites])

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setFilters({
      search: "",
      studyId: "",
      siteId: "",
      startDate: "",
      endDate: "",
    })
    setStudySearch("")
    setSiteSearch("")
    setSiteOptions([])
    setPageNumber(1)
    // If already on page 1, ensure we refresh with cleared filters
    setTimeout(() => {
      loadSites()
    }, 0)
  }, [loadSites])

  // Export function (background)
  const handleExport = useCallback(
    (format, { pageSize, orientation } = {}) => {
      if (!assertCanExport()) return
      const kind = `site-details-${format}`
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
        label: `Site details (${format.toUpperCase()})`,
        task: async (setDetail) => {
          setDetail("Preparing export…")
          const params = { format, pageSize, orientation }

          if (filters.studyId) {
            const studyIdNum = parseInt(filters.studyId)
            if (!isNaN(studyIdNum) && studyIdNum > 0) {
              params.studyId = studyIdNum
            }
          }

          if (filters.siteId) {
            const siteIdNum = parseInt(filters.siteId)
            if (!isNaN(siteIdNum) && siteIdNum > 0) {
              params.siteId = siteIdNum
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
          await reportsService.exportSiteDetailsReport(withWorkspace(params))
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
            <MapPin className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Site Details Report</h1>
            <p className="text-slate-600 text-sm">View and export site information and details</p>
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
                    placeholder="Search sites..."
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

              {/* Site Filter */}
              <div className="space-y-2">
                <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                  Site
                </label>
                <Select
                  value={filters.siteId || undefined}
                  onValueChange={(value) => handleFilterChange("siteId", value === "all" ? "" : value)}
                  disabled={loadingSiteOptions || !filters.studyId}
                >
                  <SelectTrigger className="w-full border-2 border-slate-200 rounded-lg bg-white hover:bg-blue-50 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all px-4 py-3 shadow-sm">
                    <SelectValue 
                      placeholder={
                        !filters.studyId 
                          ? "Select Study first" 
                          : loadingSiteOptions 
                            ? "Loading sites..." 
                            : "Select Site"
                      } 
                    />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-2 border-slate-200 rounded-lg shadow-lg">
                    {/* Search Input */}
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
                          className="pl-10 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      <SelectItem value="all" className="px-4 py-2 data-[highlighted]:bg-blue-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors">All Sites</SelectItem>
                      {siteOptions
                        .filter((site) => {
                          if (!siteSearch.trim()) return true
                          const searchLower = siteSearch.toLowerCase()
                          const displayName = (site.siteName ||
                                              site.name ||
                                              (typeof site === 'string' ? site : null) ||
                                              `Site ${site.siteId || site.id}`).toLowerCase()
                          return displayName.includes(searchLower)
                        })
                        .map((site) => {
                          const siteId = site.siteId || site.id
                          const displayName = site.siteName ||
                                            site.name ||
                                            (typeof site === 'string' ? site : null) ||
                                            `Site ${siteId}`
                          return (
                            <SelectItem key={siteId} value={siteId.toString()} className="px-4 py-2 data-[highlighted]:bg-blue-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors">
                              {displayName}
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
                defaultSubject="Site Details"
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
                Site Details {totalCount > 0 && `(${totalCount} total)`}
              </h2>
            </div>
          </div>

          {loading ? (
            <SectionSkeleton title="Loading site details..." rows={6} variant="siteReport" />
          ) : sites.length === 0 ? (
            <div className="text-center py-16">
              <MapPin className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 font-medium mb-2">No site details found</p>
              <p className="text-slate-500 text-sm">
                {hasActiveFilters 
                  ? "Try adjusting your filters to see more results." 
                  : "No sites are available at this time."}
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
                        Site Name
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Site Full Name
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Investigator
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Email
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Mobile
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        City
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        State
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Planned Patients
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Status
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
                    {sites.map((site) => (
                      <tr 
                        key={site.id} 
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm text-slate-900 font-medium">
                          {site.id || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 font-mono text-xs whitespace-nowrap">
                          {site.guid || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-900 font-medium whitespace-nowrap">
                          {site.studyProtocolNumber || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                          {site.siteName || "N/A"}
                        </td>
                        <td 
                          className="px-4 py-3 text-sm text-slate-700 max-w-xs truncate" 
                          title={site.siteFullName || ""}
                        >
                          {site.siteFullName || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {site.investigatorName || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {site.emailId || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {site.mobileNo || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {site.city || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {site.state || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {site.plannedPatients || 0}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            site.isActive 
                              ? "bg-green-100 text-green-800" 
                              : "bg-red-100 text-red-800"
                          }`}>
                            {site.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {site.createdByName || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {site.updatedByName || "N/A"}
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
                  itemName="sites"
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
