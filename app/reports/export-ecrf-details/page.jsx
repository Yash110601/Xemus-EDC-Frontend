"use client"

import { REPORT_PAGE_SHELL_CLASS } from "@/lib/reports/studySitePatientReportUi"

import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Filter,
  X,
  Loader2,
  FileText,
  Search,
} from "lucide-react"
import { useReportExportJobs } from "@/context/ReportExportJobsContext"
import reportsService from "@/lib/services/reports.service"
import studyService from "@/lib/services/study.service"
import siteService from "@/lib/services/site.service"
import patientEnrolmentService from "@/lib/services/patientEnrolment.service"
import crfDesignService from "@/lib/services/crfDesign.service"
import visitScheduleService from "@/lib/services/visitSchedule.service"
import { buildEcrfDetailsExportParams } from "@/lib/utils/ecrfDetailsExportParams"
import { toast } from "sonner"
import { useReportExportAccess } from "@/app/reports/_hooks/useReportExportAccess"
import ReportDownloadActions, { REPORT_CSV_ZIP_FORMATS } from "@/components/reports/ReportDownloadActions"

export default function ExportECRFDetailsPage() {
  const { canExport, assertCanExport, reportKey, withWorkspace } = useReportExportAccess()
  const { startEcrfPdfZipExport, jobs } = useReportExportJobs()
  const pdfZipRunning = jobs.some(
    (j) => j.kind === "ecrf-pdf-zip" && j.status === "running"
  )

  // State management
  const [exporting, setExporting] = useState(false)
  const [studies, setStudies] = useState([])
  const [loadingStudies, setLoadingStudies] = useState(false)
  const [sites, setSites] = useState([])
  const [loadingSites, setLoadingSites] = useState(false)
  const [patientEnrolments, setPatientEnrolments] = useState([])
  const [loadingPatientEnrolments, setLoadingPatientEnrolments] = useState(false)
  const [crfDesigns, setCrfDesigns] = useState([])
  const [loadingCrfDesigns, setLoadingCrfDesigns] = useState(false)
  const [visitSchedules, setVisitSchedules] = useState([])
  const [loadingVisitSchedules, setLoadingVisitSchedules] = useState(false)
  
  // Search state for dropdowns
  const [studySearch, setStudySearch] = useState("")
  const [siteSearch, setSiteSearch] = useState("")
  const [patientSearch, setPatientSearch] = useState("")

  // Refs to track AbortControllers for each API call
  const sitesAbortControllerRef = useRef(null)
  const patientEnrolmentsAbortControllerRef = useRef(null)
  const crfDesignsAbortControllerRef = useRef(null)
  const visitSchedulesAbortControllerRef = useRef(null)
  
  // Refs to track what's currently being loaded
  const loadingSiteStudyIdRef = useRef(null)
  const loadingPatientStudyIdRef = useRef(null)
  const loadingPatientSiteIdRef = useRef(null)
  const loadingCrfDesignStudyIdRef = useRef(null)
  const loadingVisitStudyIdRef = useRef(null)
  const loadingVisitCrfDesignIdRef = useRef(null)
  
  // Filter state
  const [filters, setFilters] = useState({
    studyId: "",
    siteId: "",
    patientEnrolmentId: "",
    crfDesignId: "",
    visitScheduleId: "",
  })

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

    // Cleanup function
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
      console.log(`[Sites] Skipping duplicate call for studyId: ${studyIdNum}`)
      return
    }

    // Mark as loading and track the studyId
    console.log(`[Sites] Starting API call for studyId: ${studyIdNum}`)
    loadingSiteStudyIdRef.current = studyIdNum
    const abortController = new AbortController()
    sitesAbortControllerRef.current = abortController
    setLoadingSites(true)

    const loadSites = async () => {
      try {
        const response = await siteService.getSitesForDropdown(studyIdNum, { signal: abortController.signal })
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

  // Load patient enrolments for dropdown when both study and site are selected
  useEffect(() => {
    // Early return if dependencies not met
    if (!filters.studyId || !filters.siteId) {
      setPatientEnrolments([])
      loadingPatientStudyIdRef.current = null
      loadingPatientSiteIdRef.current = null
      return
    }

    const studyIdNum = parseInt(filters.studyId)
    const siteIdNum = parseInt(filters.siteId)
    if (isNaN(studyIdNum) || studyIdNum <= 0 || isNaN(siteIdNum) || siteIdNum <= 0) {
      setPatientEnrolments([])
      loadingPatientStudyIdRef.current = null
      loadingPatientSiteIdRef.current = null
      return
    }

    // Cancel previous request if it exists and is for a different combination
    if (patientEnrolmentsAbortControllerRef.current && 
        (loadingPatientStudyIdRef.current !== studyIdNum || loadingPatientSiteIdRef.current !== siteIdNum)) {
      patientEnrolmentsAbortControllerRef.current.abort()
      patientEnrolmentsAbortControllerRef.current = null
    }

    // Prevent duplicate calls - only proceed if this combination is not already being loaded
    if (patientEnrolmentsAbortControllerRef.current && 
        loadingPatientStudyIdRef.current === studyIdNum && 
        loadingPatientSiteIdRef.current === siteIdNum) {
      return
    }

    // Mark as loading and track the IDs
    loadingPatientStudyIdRef.current = studyIdNum
    loadingPatientSiteIdRef.current = siteIdNum
    const abortController = new AbortController()
    patientEnrolmentsAbortControllerRef.current = abortController
    setLoadingPatientEnrolments(true)

    const loadPatientEnrolments = async () => {
      try {
        const response = await patientEnrolmentService.getPatientEnrolmentsForDropdown(studyIdNum, siteIdNum, { signal: abortController.signal })
        if (!abortController.signal.aborted && 
            loadingPatientStudyIdRef.current === studyIdNum && 
            loadingPatientSiteIdRef.current === siteIdNum) {
          if (response.isSuccess && response.data) {
            let patientsData = response.data || []
            // Handle array of strings
            if (Array.isArray(patientsData) && patientsData.length > 0 && typeof patientsData[0] === 'string') {
              patientsData = patientsData.map((name, index) => ({
                patientEnrolmentId: index + 1,
                id: index + 1,
                initial: name,
                name: name
              }))
            }
            setPatientEnrolments(patientsData)
          } else {
            setPatientEnrolments([])
          }
        }
      } catch (error) {
        if (!abortController.signal.aborted && 
            loadingPatientStudyIdRef.current === studyIdNum && 
            loadingPatientSiteIdRef.current === siteIdNum) {
          console.error("Error loading patient enrolments:", error)
          setPatientEnrolments([])
        }
      } finally {
        if (!abortController.signal.aborted && 
            loadingPatientStudyIdRef.current === studyIdNum && 
            loadingPatientSiteIdRef.current === siteIdNum) {
          setLoadingPatientEnrolments(false)
        }
        // Clear refs only if this is still the current request
        if (loadingPatientStudyIdRef.current === studyIdNum && 
            loadingPatientSiteIdRef.current === siteIdNum &&
            patientEnrolmentsAbortControllerRef.current === abortController) {
          patientEnrolmentsAbortControllerRef.current = null
          loadingPatientStudyIdRef.current = null
          loadingPatientSiteIdRef.current = null
        }
      }
    }

    loadPatientEnrolments()

    // Cleanup function
    return () => {
      // Only abort if this is still the current request
      if (patientEnrolmentsAbortControllerRef.current === abortController && 
          loadingPatientStudyIdRef.current === studyIdNum && 
          loadingPatientSiteIdRef.current === siteIdNum) {
        abortController.abort()
        patientEnrolmentsAbortControllerRef.current = null
        loadingPatientStudyIdRef.current = null
        loadingPatientSiteIdRef.current = null
      }
    }
  }, [filters.studyId, filters.siteId])

  // Load CRF designs for dropdown when study is selected
  useEffect(() => {
    // Early return if no study selected
    if (!filters.studyId) {
      setCrfDesigns([])
      loadingCrfDesignStudyIdRef.current = null
      return
    }

    const studyIdNum = parseInt(filters.studyId)
    if (isNaN(studyIdNum) || studyIdNum <= 0) {
      setCrfDesigns([])
      loadingCrfDesignStudyIdRef.current = null
      return
    }

    // Cancel previous request if it exists and is for a different studyId
    if (crfDesignsAbortControllerRef.current && loadingCrfDesignStudyIdRef.current !== studyIdNum) {
      crfDesignsAbortControllerRef.current.abort()
      crfDesignsAbortControllerRef.current = null
    }

    // Prevent duplicate calls - only proceed if this studyId is not already being loaded
    if (crfDesignsAbortControllerRef.current && loadingCrfDesignStudyIdRef.current === studyIdNum) {
      return
    }

    // Mark as loading and track the studyId
    loadingCrfDesignStudyIdRef.current = studyIdNum
    const abortController = new AbortController()
    crfDesignsAbortControllerRef.current = abortController
    setLoadingCrfDesigns(true)

    const loadCrfDesigns = async () => {
      try {
        const response = await crfDesignService.getCrfDesignsForDropdown(studyIdNum, { signal: abortController.signal })
        if (!abortController.signal.aborted && loadingCrfDesignStudyIdRef.current === studyIdNum) {
          if (response.isSuccess && response.data) {
            // Handle different response structures
            let crfDesignsData = response.data || []
            
            // If the API returns an array of strings, convert to objects
            if (Array.isArray(crfDesignsData) && crfDesignsData.length > 0 && typeof crfDesignsData[0] === 'string') {
              crfDesignsData = crfDesignsData.map((name, index) => ({
                id: index + 1,
                crfDesignId: index + 1,
                name: name,
                crfName: name
              }))
            }
            
            setCrfDesigns(crfDesignsData)
          } else {
            setCrfDesigns([])
          }
        }
      } catch (error) {
        if (!abortController.signal.aborted && loadingCrfDesignStudyIdRef.current === studyIdNum) {
          console.error("Error loading CRF designs:", error)
          setCrfDesigns([])
        }
      } finally {
        if (!abortController.signal.aborted && loadingCrfDesignStudyIdRef.current === studyIdNum) {
          setLoadingCrfDesigns(false)
        }
        // Clear refs only if this is still the current request
        if (loadingCrfDesignStudyIdRef.current === studyIdNum && crfDesignsAbortControllerRef.current === abortController) {
          crfDesignsAbortControllerRef.current = null
          loadingCrfDesignStudyIdRef.current = null
        }
      }
    }

    loadCrfDesigns()

    // Cleanup function
    return () => {
      // Only abort if this is still the current request
      if (crfDesignsAbortControllerRef.current === abortController && loadingCrfDesignStudyIdRef.current === studyIdNum) {
        abortController.abort()
        crfDesignsAbortControllerRef.current = null
        loadingCrfDesignStudyIdRef.current = null
      }
    }
  }, [filters.studyId])

  // Load visit schedules when study is selected (optional crfDesignId narrows the list)
  useEffect(() => {
    // Early return if no study selected
    if (!filters.studyId) {
      setVisitSchedules([])
      loadingVisitStudyIdRef.current = null
      loadingVisitCrfDesignIdRef.current = null
      if (visitSchedulesAbortControllerRef.current) {
        visitSchedulesAbortControllerRef.current.abort()
        visitSchedulesAbortControllerRef.current = null
      }
      setFilters((prev) => ({
        ...prev,
        visitScheduleId: "",
      }))
      return
    }

    const studyIdNum = parseInt(filters.studyId, 10)
    if (isNaN(studyIdNum) || studyIdNum <= 0) {
      setVisitSchedules([])
      loadingVisitStudyIdRef.current = null
      loadingVisitCrfDesignIdRef.current = null
      setFilters((prev) => ({
        ...prev,
        visitScheduleId: "",
      }))
      return
    }

    // Get crfDesignId if selected
    let crfDesignIdNum = null
    if (filters.crfDesignId) {
      crfDesignIdNum = parseInt(filters.crfDesignId, 10)
      if (isNaN(crfDesignIdNum) || crfDesignIdNum <= 0) {
        crfDesignIdNum = null
      }
    }

    // Cancel previous request if it exists and is for a different combination
    if (
      visitSchedulesAbortControllerRef.current &&
      (loadingVisitStudyIdRef.current !== studyIdNum ||
        loadingVisitCrfDesignIdRef.current !== crfDesignIdNum)
    ) {
      visitSchedulesAbortControllerRef.current.abort()
      visitSchedulesAbortControllerRef.current = null
    }

    // Prevent duplicate calls - only proceed if this combination is not already being loaded
    if (
      visitSchedulesAbortControllerRef.current &&
      loadingVisitStudyIdRef.current === studyIdNum &&
      loadingVisitCrfDesignIdRef.current === crfDesignIdNum
    ) {
      return
    }

    // Mark as loading and track the IDs
    loadingVisitStudyIdRef.current = studyIdNum
    loadingVisitCrfDesignIdRef.current = crfDesignIdNum
    const abortController = new AbortController()
    visitSchedulesAbortControllerRef.current = abortController
    setLoadingVisitSchedules(true)

    const loadVisitSchedules = async () => {
      try {
        const response = await visitScheduleService.getVisitSchedulesForDropdown(studyIdNum, crfDesignIdNum, { signal: abortController.signal })
        if (
          !abortController.signal.aborted &&
          loadingVisitStudyIdRef.current === studyIdNum &&
          loadingVisitCrfDesignIdRef.current === crfDesignIdNum
        ) {
          if (response.isSuccess && response.data) {
            let visitsData = response.data || []

            // Handle array of strings
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
        if (
          !abortController.signal.aborted &&
          loadingVisitStudyIdRef.current === studyIdNum &&
          loadingVisitCrfDesignIdRef.current === crfDesignIdNum
        ) {
          console.error("Error loading visit schedules:", error)
          setVisitSchedules([])
          setFilters((prev) => ({ ...prev, visitScheduleId: "" }))
        }
      } finally {
        if (
          !abortController.signal.aborted &&
          loadingVisitStudyIdRef.current === studyIdNum &&
          loadingVisitCrfDesignIdRef.current === crfDesignIdNum
        ) {
          setLoadingVisitSchedules(false)
        }
        // Clear refs only if this is still the current request
        if (
          loadingVisitStudyIdRef.current === studyIdNum &&
          loadingVisitCrfDesignIdRef.current === crfDesignIdNum &&
          visitSchedulesAbortControllerRef.current === abortController
        ) {
          visitSchedulesAbortControllerRef.current = null
          loadingVisitStudyIdRef.current = null
          loadingVisitCrfDesignIdRef.current = null
        }
      }
    }

    loadVisitSchedules()

    // Cleanup function
    return () => {
      // Only abort if this is still the current request
      if (
        visitSchedulesAbortControllerRef.current === abortController &&
        loadingVisitStudyIdRef.current === studyIdNum &&
        loadingVisitCrfDesignIdRef.current === crfDesignIdNum
      ) {
        abortController.abort()
        visitSchedulesAbortControllerRef.current = null
        loadingVisitStudyIdRef.current = null
        loadingVisitCrfDesignIdRef.current = null
      }
    }
  }, [filters.studyId, filters.crfDesignId])

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return filters.studyId !== "" || 
           filters.siteId !== "" || 
           filters.patientEnrolmentId !== "" ||
           filters.crfDesignId !== "" ||
           filters.visitScheduleId !== ""
  }, [filters])

  // Handle filter changes
  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => {
      const newFilters = { ...prev, [key]: value }
      // Clear siteId when study changes
      if (key === "studyId") {
        newFilters.siteId = ""
        newFilters.patientEnrolmentId = ""
        newFilters.crfDesignId = ""
        // Default to all visits so CSV/PDF export is available as soon as study is selected.
        newFilters.visitScheduleId = value ? "0" : ""
      }
      // Clear patientEnrolmentId when site changes
      if (key === "siteId") {
        newFilters.patientEnrolmentId = ""
      }
      return newFilters
    })
    // Reset the patient-search box whenever the upstream dependencies change so
    // a stale search term does not hide items in the freshly loaded patient list.
    if (key === "studyId" || key === "siteId") {
      setPatientSearch("")
    }
  }, [])

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    setFilters({
      studyId: "",
      siteId: "",
      patientEnrolmentId: "",
      crfDesignId: "",
      visitScheduleId: "",
    })
    setStudySearch("")
    setSiteSearch("")
    setPatientSearch("")
    setSites([])
    setPatientEnrolments([])
    setCrfDesigns([])
    setVisitSchedules([])

    // Cancel any in-flight dependent dropdown loads
    if (sitesAbortControllerRef.current) sitesAbortControllerRef.current.abort()
    if (patientEnrolmentsAbortControllerRef.current) patientEnrolmentsAbortControllerRef.current.abort()
    if (crfDesignsAbortControllerRef.current) crfDesignsAbortControllerRef.current.abort()
    if (visitSchedulesAbortControllerRef.current) visitSchedulesAbortControllerRef.current.abort()

    sitesAbortControllerRef.current = null
    patientEnrolmentsAbortControllerRef.current = null
    crfDesignsAbortControllerRef.current = null
    visitSchedulesAbortControllerRef.current = null

    loadingSiteStudyIdRef.current = null
    loadingPatientStudyIdRef.current = null
    loadingPatientSiteIdRef.current = null
    loadingCrfDesignStudyIdRef.current = null
    loadingVisitStudyIdRef.current = null
    loadingVisitCrfDesignIdRef.current = null
  }, [])

  // Export function
  const handleExport = useCallback(async () => {
    if (!assertCanExport()) return
    if (exporting) return

    setExporting(true)
    
    try {
      const studyIdNum = filters.studyId ? parseInt(filters.studyId, 10) : NaN

      // Study required; visit schedule optional (defaults to all visits via buildEcrfDetailsExportParams).
      if (!Number.isFinite(studyIdNum) || studyIdNum <= 0) {
        toast.error("Please select Study before exporting eCRF details (CSV).")
        return
      }

      const params = buildEcrfDetailsExportParams(filters)

      await reportsService.exportEcrfDetailsReport(withWorkspace(params))
      toast.success("eCRF details exported successfully.")
    } catch (error) {
      console.error("Export error:", error)
      toast.error(error.message || "Unable to export eCRF details. Please try again.")
    } finally {
      setExporting(false)
    }
  }, [assertCanExport, filters, exporting])

  const handlePdfZipExport = useCallback(() => {
    if (!assertCanExport()) return
    const studyIdNum = filters.studyId ? parseInt(filters.studyId, 10) : NaN

    if (!Number.isFinite(studyIdNum) || studyIdNum <= 0) {
      toast.error("Please select Study before exporting PDF ZIP.")
      return
    }
    if (pdfZipRunning) return

    startEcrfPdfZipExport({
      studyId: filters.studyId,
      siteId: filters.siteId || "",
      patientEnrolmentId: filters.patientEnrolmentId || "",
      crfDesignId: filters.crfDesignId || "",
      visitScheduleId: filters.visitScheduleId || "",
    })
  }, [assertCanExport, filters, pdfZipRunning, startEcrfPdfZipExport])

  return (
    <DashboardLayout>
      <div className={REPORT_PAGE_SHELL_CLASS}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <FileText className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">eCRF Details Export</h1>
            <p className="text-slate-600 text-sm">Export electronic case report form data and details</p>
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
              {/* Study Filter */}
              <div className="space-y-2">
                <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                  Study
                  <span className="text-red-500">*</span>
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

              {/* Visit Schedule Filter */}
              <div className="space-y-2">
                <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                  Visit Schedule
                </label>
                <Select
                  value={filters.visitScheduleId || undefined}
                  onValueChange={(value) => handleFilterChange("visitScheduleId", value)}
                  disabled={loadingVisitSchedules || !filters.studyId}
                >
                  <SelectTrigger className="w-full border-2 border-slate-200 rounded-lg bg-white hover:bg-blue-50 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all px-4 py-3 shadow-sm">
                    <SelectValue
                      placeholder={
                        !filters.studyId
                          ? "Select Study first"
                          : loadingVisitSchedules
                            ? "Loading visit schedules..."
                            : "All / select visit"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-2 border-slate-200 rounded-lg shadow-lg">
                    <SelectItem value="0" className="px-4 py-2 data-[highlighted]:bg-blue-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors">
                      All Visit Schedules
                    </SelectItem>
                    {visitSchedules.map((visitSchedule) => {
                      const visitId = visitSchedule.visitScheduleId || visitSchedule.id
                      if (!visitId) return null
                      const displayName =
                        visitSchedule.visitName ||
                        visitSchedule.name ||
                        visitSchedule.visitScheduleName ||
                        (typeof visitSchedule === "string" ? visitSchedule : null) ||
                        `Visit Schedule ${visitId}`

                      return (
                        <SelectItem
                          key={visitId}
                          value={visitId.toString()}
                          className="px-4 py-2 data-[highlighted]:bg-blue-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors"
                        >
                          {displayName}
                        </SelectItem>
                      )
                    })}
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
                  disabled={loadingSites || !filters.studyId}
                >
                  <SelectTrigger className="w-full border-2 border-slate-200 rounded-lg bg-white hover:bg-blue-50 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all px-4 py-3 shadow-sm">
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
                            <SelectItem key={siteId} value={siteId.toString()} className="px-4 py-2 data-[highlighted]:bg-blue-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors">
                              {displayName}
                            </SelectItem>
                          )
                        })}
                    </div>
                  </SelectContent>
                </Select>
              </div>

              {/* Patient Enrolment Filter */}
              <div className="space-y-2">
                <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                  Patient Enrolment
                </label>
                <Select
                  value={filters.patientEnrolmentId || undefined}
                  onValueChange={(value) => handleFilterChange("patientEnrolmentId", value === "all" ? "" : value)}
                  disabled={loadingPatientEnrolments || !filters.studyId || !filters.siteId}
                >
                  <SelectTrigger className="w-full border-2 border-slate-200 rounded-lg bg-white hover:bg-blue-50 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all px-4 py-3 shadow-sm">
                    <SelectValue 
                      placeholder={
                        !filters.studyId || !filters.siteId
                          ? "Select Study & Site first" 
                          : loadingPatientEnrolments 
                            ? "Loading patients..." 
                            : "Select Patient"
                      } 
                    />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-2 border-slate-200 rounded-lg shadow-lg">
                    {/* Search Input — same UX as Study / Site dropdowns. */}
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
                          className="pl-10 border-2 border-slate-200 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      <SelectItem value="all" className="px-4 py-2 data-[highlighted]:bg-blue-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors">All Patients</SelectItem>
                      {patientEnrolments
                        .filter((patient) => patient && (patient.patientEnrolmentId || patient.id))
                        .filter((patient) => {
                          if (!patientSearch.trim()) return true
                          const searchLower = patientSearch.toLowerCase()
                          const patientId = patient.patientEnrolmentId || patient.id
                          // Build the same display name the row renders so search
                          // matches exactly what the user sees in the dropdown.
                          const displayName = (
                            patient.initial ||
                            patient.patientInitial ||
                            patient.name ||
                            patient.patientName ||
                            (typeof patient === "string" ? patient : null) ||
                            `Patient ${patientId}`
                          ).toString().toLowerCase()
                          return displayName.includes(searchLower)
                        })
                        .map((patient) => {
                          const patientId = patient.patientEnrolmentId || patient.id
                          const displayName = patient.initial ||
                                            patient.patientInitial ||
                                            patient.name ||
                                            patient.patientName ||
                                            (typeof patient === 'string' ? patient : null) ||
                                            `Patient ${patientId}`
                          return (
                            <SelectItem key={patientId} value={patientId.toString()} className="px-4 py-2 data-[highlighted]:bg-blue-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors">
                              {displayName}
                            </SelectItem>
                          )
                        })}
                    </div>
                  </SelectContent>
                </Select>
              </div>

              {/* CRF Design Filter */}
              <div className="space-y-2">
                <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                  CRF Design
                </label>
                <Select
                  value={filters.crfDesignId || undefined}
                  onValueChange={(value) => handleFilterChange("crfDesignId", value === "all" ? "" : value)}
                  disabled={loadingCrfDesigns || !filters.studyId}
                >
                  <SelectTrigger className="w-full border-2 border-slate-200 rounded-lg bg-white hover:bg-blue-50 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all px-4 py-3 shadow-sm">
                    <SelectValue 
                      placeholder={
                        !filters.studyId 
                          ? "Select Study first" 
                          : loadingCrfDesigns 
                            ? "Loading CRF designs..." 
                            : "Select CRF Design"
                      } 
                    />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-2 border-slate-200 rounded-lg shadow-lg">
                    <SelectItem value="all" className="px-4 py-2 data-[highlighted]:bg-blue-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors">All CRF Designs</SelectItem>
                    {crfDesigns.map((crfDesign) => {
                      const crfId = crfDesign.crfDesignId || crfDesign.id
                      // Try multiple field name variations for display name
                      const displayName = crfDesign.crfName || 
                                        crfDesign.name || 
                                        crfDesign.crfDesignName ||
                                        crfDesign.designName ||
                                        (typeof crfDesign === 'string' ? crfDesign : null) ||
                                        `CRF Design ${crfId}`
                      
                      return (
                        <SelectItem key={crfId} value={crfId.toString()} className="px-4 py-2 data-[highlighted]:bg-blue-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors">
                          {displayName}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

            </div>

            {/* Action buttons — compact; full guidance in hover tooltips */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                onClick={handleClearFilters}
                variant="outline"
                disabled={exporting || !hasActiveFilters}
                className="rounded-2xl border-slate-200/80 bg-white/55 backdrop-blur-xl px-4 py-2.5 text-slate-800 self-start shadow-[0_10px_30px_-18px_rgba(15,23,42,0.35),inset_0_1px_0_rgba(255,255,255,0.8)] hover:bg-white/75 hover:border-emerald-200/80 transition-all duration-200 disabled:opacity-50 disabled:hover:bg-white/55 disabled:shadow-none"
              >
                <X className="w-4 h-4 mr-2" />
                Clear Filters
              </Button>

              <ReportDownloadActions
                canExport={canExport}
                reportKey={reportKey}
                assertCanExport={assertCanExport}
                defaultSubject="eCRF Details Report"
                defaultFormat="csv"
                enabledFormats={REPORT_CSV_ZIP_FORMATS}
                disabled={!filters.studyId}
                busy={exporting || pdfZipRunning}
                buttonClassName="rounded-2xl bg-emerald-700 text-white hover:bg-emerald-800 px-4 py-2.5 text-sm font-semibold"
                onExport={async ({ format }) => {
                  if (format === "zip") {
                    handlePdfZipExport()
                    return
                  }
                  if (format === "csv") {
                    await handleExport()
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
