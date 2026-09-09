"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import DataPagination from "@/components/ui/data-pagination"
import SectionSkeleton from "@/components/ui/section-skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  User, 
  Search, 
  Filter, 
  X, 
  Loader2,
  CheckCircle2,
  XCircle
} from "lucide-react"
import reportsService from "@/lib/services/reports.service"
import studyService from "@/lib/services/study.service"
import siteService from "@/lib/services/site.service"
import visitScheduleService from "@/lib/services/visitSchedule.service"
import DatePicker from "@/components/ui/date-picker"
import { cn } from "@/lib/utils"
import {
  PATIENT_STATUS_FILTER_OPTIONS,
  getPatientParticipationStatusLabel,
  REPORT_FILTER_FIELD_CLASS,
  REPORT_FILTER_GRID_3_CLASS,
  REPORT_FILTER_GRID_4_CLASS,
  REPORT_FILTER_TOOLBAR_CLASS,
  REPORT_INPUT_CLASS,
  REPORT_MOBILE_TABLE_HINT,
  REPORT_TABLE_SCROLL_CLASS,
  REPORT_SELECT_TRIGGER_CLASS,
  REPORT_SELECT_CONTENT_CLASS,
  REPORT_SELECT_ITEM_CLASS,
  REPORT_SELECT_SEARCH_INPUT_CLASS,
  REPORT_PAGE_SHELL_CLASS,
} from "@/lib/reports/studySitePatientReportUi"
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

export default function ExportPatientDetailsPage() {
  const { canExport, assertCanExport, reportKey, withWorkspace } = useReportExportAccess()
  const { startReportExport, jobs } = useReportExportJobs()
  const csvRunning = jobs.some((j) => j.kind === "patient-details-csv" && j.status === "running")
  const pdfRunning = jobs.some((j) => j.kind === "patient-details-pdf" && j.status === "running")

  // State management
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(false)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalCount, setTotalCount] = useState(0)
  
  // Dropdown data
  const [studies, setStudies] = useState([])
  const [loadingStudies, setLoadingStudies] = useState(false)
  const [sites, setSites] = useState([])
  const [loadingSites, setLoadingSites] = useState(false)
  const [visitSchedules, setVisitSchedules] = useState([])
  const [loadingVisitSchedules, setLoadingVisitSchedules] = useState(false)
  
  // Search state for dropdowns
  const [studySearch, setStudySearch] = useState("")
  const [siteSearch, setSiteSearch] = useState("")
  const [visitSearch, setVisitSearch] = useState("")
  
  const [studyRequiredError, setStudyRequiredError] = useState(false)

  // Filter state
  const [filters, setFilters] = useState({
    search: "",
    studyId: "",
    siteId: "",
    visitScheduleId: "",
    patientStatus: "",
    startDate: "",
    endDate: "",
  })

  // Refs to track AbortControllers for each API call
  const sitesAbortControllerRef = useRef(null)
  const loadingSiteStudyIdRef = useRef(null)
  const visitSchedulesAbortControllerRef = useRef(null)
  const loadingVisitStudyIdRef = useRef(null)
  const isLoadingRef = useRef(false)

  // Calculate total pages
  const totalPages = useMemo(() => Math.ceil(totalCount / pageSize), [totalCount, pageSize])

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return filters.search.trim() !== "" || 
           filters.studyId !== "" || 
           filters.siteId !== "" ||
           filters.visitScheduleId !== "" ||
           filters.patientStatus !== "" ||
           filters.startDate !== "" || 
           filters.endDate !== ""
  }, [filters])

  const hasStudySelected = useMemo(() => String(filters.studyId || "").trim() !== "", [filters.studyId])

  // Load patients function - use filters from state directly to avoid dependency issues
  const loadPatients = useCallback(async () => {
    // Prevent duplicate calls
    if (isLoadingRef.current) {
      return
    }

    const studyIdNum = parseInt(filters.studyId, 10)
    if (!Number.isFinite(studyIdNum) || studyIdNum <= 0) {
      setPatients([])
      setTotalCount(0)
      return
    }
    
    isLoadingRef.current = true
    setLoading(true)
    try {
      const params = {
        studyId: studyIdNum,
        pageNumber,
        pageSize,
      }

      if (filters.siteId) {
        const siteIdNum = parseInt(filters.siteId, 10)
        if (!isNaN(siteIdNum) && siteIdNum > 0) {
          params.siteId = siteIdNum
        }
      }

      if (filters.patientStatus) {
        const statusNum = parseInt(filters.patientStatus, 10)
        if (!isNaN(statusNum) && statusNum > 0) {
          params.patientStatus = statusNum
        }
      }

      if (filters.visitScheduleId) {
        const visitScheduleIdNum = parseInt(filters.visitScheduleId, 10)
        if (!isNaN(visitScheduleIdNum) && visitScheduleIdNum > 0) {
          params.visitScheduleId = visitScheduleIdNum
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

      const response = await reportsService.getPatientDetailsReport(withWorkspace(params))

      if (response.isSuccess && response.data) {
        setPatients(response.data.items || [])
        setTotalCount(response.data.totalCount || 0)
      } else {
        toast.error(response.message || "Failed to load patient details")
        setPatients([])
        setTotalCount(0)
      }
    } catch (error) {
      console.error("Error loading patients:", error)
      toast.error(error.message || "Failed to load patient details. Please try again.")
      setPatients([])
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
      setSites([])
      loadingSiteStudyIdRef.current = null
      if (sitesAbortControllerRef.current) {
        sitesAbortControllerRef.current.abort()
        sitesAbortControllerRef.current = null
      }
      return
    }

    const studyIdNum = parseInt(filters.studyId)
    if (isNaN(studyIdNum) || studyIdNum <= 0) {
      setSites([])
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
    setLoadingSites(true)

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
            setSites(sitesData)
          } else {
            setSites([])
          }
        }
      } catch (error) {
        // Only log error if this request hasn't been aborted
        if (!abortController.signal.aborted && loadingSiteStudyIdRef.current === studyIdNum) {
          console.error("Error loading sites:", error)
          setSites([])
        }
      } finally {
        if (!abortController.signal.aborted && loadingSiteStudyIdRef.current === studyIdNum) {
          setLoadingSites(false)
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

  // Load visit schedules for dropdown when study is selected
  useEffect(() => {
    if (!filters.studyId) {
      setVisitSchedules([])
      loadingVisitStudyIdRef.current = null
      if (visitSchedulesAbortControllerRef.current) {
        visitSchedulesAbortControllerRef.current.abort()
        visitSchedulesAbortControllerRef.current = null
      }
      return
    }

    const studyIdNum = parseInt(filters.studyId, 10)
    if (isNaN(studyIdNum) || studyIdNum <= 0) {
      setVisitSchedules([])
      loadingVisitStudyIdRef.current = null
      if (visitSchedulesAbortControllerRef.current) {
        visitSchedulesAbortControllerRef.current.abort()
        visitSchedulesAbortControllerRef.current = null
      }
      return
    }

    if (visitSchedulesAbortControllerRef.current && loadingVisitStudyIdRef.current !== studyIdNum) {
      visitSchedulesAbortControllerRef.current.abort()
      visitSchedulesAbortControllerRef.current = null
    }

    if (visitSchedulesAbortControllerRef.current && loadingVisitStudyIdRef.current === studyIdNum) {
      return
    }

    loadingVisitStudyIdRef.current = studyIdNum
    const abortController = new AbortController()
    visitSchedulesAbortControllerRef.current = abortController
    setLoadingVisitSchedules(true)

    const loadVisitSchedules = async () => {
      try {
        const response = await visitScheduleService.getVisitSchedulesForDropdown(studyIdNum, null, {
          signal: abortController.signal,
        })
        if (!abortController.signal.aborted && loadingVisitStudyIdRef.current === studyIdNum) {
          if (response.isSuccess && response.data) {
            let visitsData = response.data || []
            if (Array.isArray(visitsData) && visitsData.length > 0 && typeof visitsData[0] === "string") {
              visitsData = visitsData.map((name, index) => ({
                visitScheduleId: index + 1,
                id: index + 1,
                visitName: name,
                name: name,
              }))
            }
            setVisitSchedules(visitsData)
          } else {
            setVisitSchedules([])
            setFilters((prev) => ({ ...prev, visitScheduleId: "" }))
          }
        }
      } catch (error) {
        if (!abortController.signal.aborted && loadingVisitStudyIdRef.current === studyIdNum) {
          console.error("Error loading visit schedules:", error)
          setVisitSchedules([])
          setFilters((prev) => ({ ...prev, visitScheduleId: "" }))
        }
      } finally {
        if (!abortController.signal.aborted && loadingVisitStudyIdRef.current === studyIdNum) {
          setLoadingVisitSchedules(false)
        }
        if (
          loadingVisitStudyIdRef.current === studyIdNum &&
          visitSchedulesAbortControllerRef.current === abortController
        ) {
          visitSchedulesAbortControllerRef.current = null
          loadingVisitStudyIdRef.current = null
        }
      }
    }

    loadVisitSchedules()

    return () => {
      if (
        visitSchedulesAbortControllerRef.current === abortController &&
        loadingVisitStudyIdRef.current === studyIdNum
      ) {
        abortController.abort()
        visitSchedulesAbortControllerRef.current = null
        loadingVisitStudyIdRef.current = null
      }
    }
  }, [filters.studyId])

  // Reload on pagination when a study is already selected (Search applies filters first)
  useEffect(() => {
    if (filters.studyId) {
      loadPatients()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber, pageSize])

  // Handle filter changes
  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => {
      const newFilters = { ...prev, [key]: value }
      // Clear dependent filters when study changes
      if (key === "studyId") {
        newFilters.siteId = ""
        newFilters.visitScheduleId = ""
      }
      return newFilters
    })
    if (key === "studyId") {
      setVisitSearch("")
    }
  }, [])

  // Apply filters (reset to page 1 and reload)
  const handleApplyFilters = useCallback(() => {
    if (!filters.studyId) {
      setStudyRequiredError(true)
      toast.error("Study is required.")
      return
    }
    setStudyRequiredError(false)

    if (filters.startDate && filters.endDate) {
      const start = new Date(filters.startDate)
      const end = new Date(filters.endDate)
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start > end) {
        toast.error("Start Date cannot be after End Date")
        return
      }
    }
    setPageNumber(1)
    // loadPatients will be called by useEffect when pageNumber changes
    // But we need to ensure it uses current filters, so we'll trigger it manually
    // after a small delay to ensure state is updated
    setTimeout(() => {
      loadPatients()
    }, 0)
  }, [loadPatients])

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setFilters({
      search: "",
      studyId: "",
      siteId: "",
      visitScheduleId: "",
      patientStatus: "",
      startDate: "",
      endDate: "",
    })
    setStudySearch("")
    setSiteSearch("")
    setVisitSearch("")
    setSites([])
    setVisitSchedules([])
    setStudyRequiredError(false)
    setPageNumber(1)
    setPatients([])
    setTotalCount(0)
  }, [])

  // Export function (background — see floating panel)
  const handleExport = useCallback(
    (format, { pageSize, orientation } = {}) => {
      if (!assertCanExport()) return
      const kind = `patient-details-${format}`
      if (jobs.some((j) => j.kind === kind && j.status === "running")) return

      if (!filters.studyId) {
        setStudyRequiredError(true)
        toast.error("Study is required before exporting.")
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

      const studyIdNum = parseInt(filters.studyId, 10)
      if (!Number.isFinite(studyIdNum) || studyIdNum <= 0) {
        toast.error("Study is required.")
        return
      }

      startReportExport({
        kind,
        label: `Patient details (${format.toUpperCase()})`,
        task: async (setDetail) => {
          setDetail("Preparing export…")
          const params = { format, pageSize, orientation, studyId: studyIdNum }

          if (filters.siteId) {
            const siteIdNum = parseInt(filters.siteId, 10)
            if (!isNaN(siteIdNum) && siteIdNum > 0) {
              params.siteId = siteIdNum
            }
          }

          if (filters.patientStatus) {
            const statusNum = parseInt(filters.patientStatus, 10)
            if (!isNaN(statusNum) && statusNum > 0) {
              params.patientStatus = statusNum
            }
          }

          if (filters.visitScheduleId) {
            const visitScheduleIdNum = parseInt(filters.visitScheduleId, 10)
            if (!isNaN(visitScheduleIdNum) && visitScheduleIdNum > 0) {
              params.visitScheduleId = visitScheduleIdNum
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
          await reportsService.exportPatientDetailsReport(withWorkspace(params))
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

  const selectTriggerClass = cn(REPORT_SELECT_TRIGGER_CLASS, "!w-full min-w-0 max-w-full")
  const selectContentClass = REPORT_SELECT_CONTENT_CLASS
  const selectItemClass = REPORT_SELECT_ITEM_CLASS
  const selectSearchInputClass = REPORT_SELECT_SEARCH_INPUT_CLASS
  
  return (
    <DashboardLayout>
      <div className={REPORT_PAGE_SHELL_CLASS}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <User className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Patient Details Report</h1>
            <p className="text-slate-600 text-sm">View and export patient information and details</p>
          </div>
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200">
            <div className={REPORT_FILTER_TOOLBAR_CLASS}>
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
          
          <div className="p-4 space-y-5 sm:p-6">
            {/* Row 1: Study · Site · Patient Status */}
            <div className={REPORT_FILTER_GRID_3_CLASS}>
              {/* Study (required — red border like Audit Trail With Reason) */}
              <div className={REPORT_FILTER_FIELD_CLASS}>
                <label className="text-sm font-bold text-slate-700">
                  Study <span className="text-red-600">*</span>
                </label>
                <Select
                  value={filters.studyId || "all"}
                  onValueChange={(value) => {
                    handleFilterChange("studyId", value === "all" ? "" : value)
                    if (value && value !== "all") setStudyRequiredError(false)
                  }}
                  disabled={loadingStudies}
                >
                  <SelectTrigger
                    className={cn(
                      selectTriggerClass,
                      !filters.studyId && "border-red-300 focus:border-red-500 focus:ring-red-100",
                    )}
                  >
                    <SelectValue placeholder={loadingStudies ? "Loading studies..." : "Select Study"} />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    <div className="p-3 border-b border-slate-200 sticky top-0 bg-white z-10">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
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
                            <SelectItem key={studyId} value={studyId.toString()} className={selectItemClass}>
                              {displayName}
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

              {/* Site */}
              <div className={REPORT_FILTER_FIELD_CLASS}>
                <label className="text-sm font-bold text-slate-700">Site</label>
                <Select
                  value={filters.siteId || "all"}
                  onValueChange={(value) => handleFilterChange("siteId", value === "all" ? "" : value)}
                  disabled={loadingSites || !hasStudySelected}
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue 
                      placeholder={
                        !filters.studyId 
                          ? "Select Study first" 
                          : loadingSites 
                            ? "Loading sites..." 
                            : "Select Site"
                      } 
                    />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
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
                          className={selectSearchInputClass}
                        />
                      </div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      <SelectItem value="all" className={selectItemClass}>All Sites</SelectItem>
                      {sites
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
                            <SelectItem key={siteId} value={siteId.toString()} className={selectItemClass}>
                              {displayName}
                            </SelectItem>
                          )
                        })}
                    </div>
                  </SelectContent>
                </Select>
              </div>

              {/* Patient Status */}
              <div className={REPORT_FILTER_FIELD_CLASS}>
                <label className="text-sm font-bold text-slate-700">Patient Status</label>
                <Select
                  value={filters.patientStatus || "all"}
                  onValueChange={(value) => handleFilterChange("patientStatus", value === "all" ? "" : value)}
                  disabled={!hasStudySelected}
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder={!hasStudySelected ? "Select Study first" : "All statuses"} />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    {PATIENT_STATUS_FILTER_OPTIONS.map((opt) => (
                      <SelectItem
                        key={opt.value || "all"}
                        value={opt.value || "all"}
                        className={selectItemClass}
                      >
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Visit · Search · Start Date · End Date */}
            <div className={REPORT_FILTER_GRID_4_CLASS}>
              <div className={REPORT_FILTER_FIELD_CLASS}>
                <label className="text-sm font-bold text-slate-700">Visit</label>
                <Select
                  value={filters.visitScheduleId || "all"}
                  onValueChange={(value) =>
                    handleFilterChange("visitScheduleId", value === "all" ? "" : value)
                  }
                  disabled={loadingVisitSchedules || !hasStudySelected}
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue
                      placeholder={
                        !hasStudySelected
                          ? "Select Study first"
                          : loadingVisitSchedules
                            ? "Loading visits..."
                            : "All visits"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    <div className="p-3 border-b border-slate-200 sticky top-0 bg-white z-10">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          type="text"
                          placeholder="Search visits..."
                          value={visitSearch}
                          onChange={(e) => setVisitSearch(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          className={selectSearchInputClass}
                        />
                      </div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      <SelectItem value="all" className={selectItemClass}>
                        All Visits
                      </SelectItem>
                      {visitSchedules
                        .filter((visit) => {
                          const visitId = visit.visitScheduleId || visit.id
                          if (!visitId) return false
                          if (!visitSearch.trim()) return true
                          const searchLower = visitSearch.toLowerCase()
                          const displayName = (
                            visit.visitName ||
                            visit.name ||
                            visit.visitScheduleName ||
                            (typeof visit === "string" ? visit : null) ||
                            `Visit ${visitId}`
                          )
                            .toString()
                            .toLowerCase()
                          return displayName.includes(searchLower)
                        })
                        .map((visit) => {
                          const visitId = visit.visitScheduleId || visit.id
                          const displayName =
                            visit.visitName ||
                            visit.name ||
                            visit.visitScheduleName ||
                            (typeof visit === "string" ? visit : null) ||
                            `Visit ${visitId}`
                          return (
                            <SelectItem
                              key={visitId}
                              value={visitId.toString()}
                              className={selectItemClass}
                            >
                              {displayName}
                            </SelectItem>
                          )
                        })}
                    </div>
                  </SelectContent>
                </Select>
              </div>

              <div className={REPORT_FILTER_FIELD_CLASS}>
                <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Search patients..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange("search", e.target.value)}
                    onKeyPress={handleSearchKeyPress}
                    disabled={!hasStudySelected}
                    className={cn(
                      "pl-10 border-2 rounded-xl transition-all w-full",
                      REPORT_INPUT_CLASS,
                      !hasStudySelected && "opacity-60 cursor-not-allowed",
                    )}
                  />
                </div>
              </div>
              <div className={REPORT_FILTER_FIELD_CLASS}>
                <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                  Start Date
                </label>
                <DatePicker
                  value={filters.startDate}
                  onChange={(value) => handleFilterChange("startDate", value || "")}
                  placeholder="dd-mm-yyyy"
                  disabled={!hasStudySelected}
                  className={cn(!hasStudySelected && "opacity-60 pointer-events-none")}
                />
              </div>
              <div className={REPORT_FILTER_FIELD_CLASS}>
                <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                  End Date
                </label>
                <DatePicker
                  value={filters.endDate}
                  onChange={(value) => handleFilterChange("endDate", value || "")}
                  placeholder="dd-mm-yyyy"
                  minDate={filters.startDate || undefined}
                  disabled={!hasStudySelected}
                  className={cn(!hasStudySelected && "opacity-60 pointer-events-none")}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <Button 
                onClick={handleApplyFilters} 
                className="bg-gradient-to-r btn-brand-gradient  text-white shadow-md"
                disabled={loading || !hasStudySelected}
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
                defaultSubject="Patient Details"
                defaultFormat="pdf"
                enabledFormats={REPORT_CSV_PDF_FORMATS}
                disabled={loading || !hasStudySelected}
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
                Patient Details {totalCount > 0 && `(${totalCount} total)`}
              </h2>
            </div>
          </div>

          {loading ? (
            <SectionSkeleton title="Loading patient details..." rows={6} variant="patientReport" />
          ) : !hasStudySelected ? (
            <div className="text-center py-16">
              <User className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 font-medium mb-2">Select a study to view patients</p>
              <p className="text-slate-500 text-sm">
                Study is required. Choose a study, optionally filter by visit or patient status, then click Search.
              </p>
            </div>
          ) : patients.length === 0 ? (
            <div className="text-center py-16">
              <User className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 font-medium mb-2">No patient details found</p>
              <p className="text-slate-500 text-sm">
                {hasActiveFilters 
                  ? "Try adjusting your filters to see more results." 
                  : "No patients match the selected criteria."}
              </p>
            </div>
          ) : (
            <>
              {/* Table */}
              <p className="border-b border-slate-100 bg-slate-50/90 px-3 py-1.5 text-[11px] text-slate-500 md:hidden">
                {REPORT_MOBILE_TABLE_HINT}
              </p>
              <div className={REPORT_TABLE_SCROLL_CLASS}>
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-slate-100 to-slate-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        ID
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 min-w-[10rem]">
                        Study / site
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Initial
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Gender
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Data Capture Date
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Patient Status
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap">
                        Record Status
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
                    {patients.map((patient) => (
                      <tr 
                        key={patient.id} 
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm text-slate-900 font-medium">
                          {patient.id || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {(() => {
                            const studyPart =
                              patient.studyProtocolNumber || patient.studyName || ""
                            const sitePart = patient.siteName || ""
                            if (studyPart && sitePart) return `${studyPart} · ${sitePart}`
                            return studyPart || sitePart || "N/A"
                          })()}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-900 font-medium whitespace-nowrap">
                          {patient.initial || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                          {patient.gender || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                          {formatDate(patient.dataCaptureDate)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {(() => {
                            const statusLabel = getPatientParticipationStatusLabel(patient)
                            return statusLabel ? (
                              <Badge
                                variant="secondary"
                                className="w-fit bg-emerald-50 text-emerald-800 hover:bg-emerald-50 border border-emerald-100"
                              >
                                {statusLabel}
                              </Badge>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )
                          })()}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {patient.isActive !== undefined ? (
                            <Badge 
                              variant={patient.isActive ? "default" : "secondary"}
                              className={`flex items-center gap-1 w-fit ${
                                patient.isActive 
                                  ? "bg-green-100 text-green-800 hover:bg-green-100" 
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-100"
                              }`}
                            >
                              {patient.isActive ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3" />
                                  Active
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3 h-3" />
                                  Inactive
                                </>
                              )}
                            </Badge>
                          ) : (
                            "N/A"
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {patient.createdByName || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {patient.updatedByName || "N/A"}
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
                  itemName="patients"
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
