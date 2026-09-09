"use client"

/* eslint-disable react-hooks/set-state-in-effect -- dropdown bootstrap & cascading clears mirror export-ecrf-details */
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
import { Filter, X, Loader2, FileText, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  REPORT_INPUT_CLASS,
  REPORT_SELECT_CONTENT_CLASS,
  REPORT_SELECT_ITEM_CLASS,
  REPORT_SELECT_SEARCH_INPUT_CLASS,
  REPORT_SELECT_TRIGGER_CLASS,
  REPORT_PAGE_SHELL_WITH_BG_CLASS,
} from "@/lib/reports/studySitePatientReportUi"
import studyService from "@/lib/services/study.service"
import siteService from "@/lib/services/site.service"
import patientEnrolmentService from "@/lib/services/patientEnrolment.service"
import visitScheduleService from "@/lib/services/visitSchedule.service"
import patientVisitCrfStatusReportService from "@/lib/services/patientVisitCrfStatusReport.service"
import { useReportExportAccess } from "@/app/reports/_hooks/useReportExportAccess"
import ReportDownloadActions from "@/components/reports/ReportDownloadActions"

export default function PatientVisitCrfStatusReportPage() {
  const { canExport, assertCanExport, reportKey, withWorkspace } = useReportExportAccess()
  const [exporting, setExporting] = useState(false)
  const [studies, setStudies] = useState([])
  const [loadingStudies, setLoadingStudies] = useState(false)
  const [sites, setSites] = useState([])
  const [loadingSites, setLoadingSites] = useState(false)
  const [patientEnrolments, setPatientEnrolments] = useState([])
  const [loadingPatientEnrolments, setLoadingPatientEnrolments] = useState(false)
  const [visitSchedules, setVisitSchedules] = useState([])
  const [loadingVisitSchedules, setLoadingVisitSchedules] = useState(false)

  const [studySearch, setStudySearch] = useState("")
  const [siteSearch, setSiteSearch] = useState("")
  const [patientSearch, setPatientSearch] = useState("")

  const sitesAbortControllerRef = useRef(null)
  const patientEnrolmentsAbortControllerRef = useRef(null)
  const visitSchedulesAbortControllerRef = useRef(null)
  const loadingSiteStudyIdRef = useRef(null)
  const loadingPatientStudyIdRef = useRef(null)
  const loadingPatientSiteIdRef = useRef(null)
  const loadingVisitStudyIdRef = useRef(null)

  const [studyRequiredError, setStudyRequiredError] = useState(false)

  const [filters, setFilters] = useState({
    studyId: "",
    visitScheduleId: "",
    siteId: "",
    patientEnrolmentId: "",
    search: "",
  })

  useEffect(() => {
    let mounted = true
    setLoadingStudies(true)
    const loadStudies = async () => {
      try {
        const response = await studyService.getStudiesForDropdown()
        if (!mounted) return
        if (response.isSuccess && response.data) {
          let studiesData = response.data || []
          if (Array.isArray(studiesData) && studiesData.length > 0 && typeof studiesData[0] === "string") {
            studiesData = studiesData.map((name, index) => ({
              studyId: index + 1,
              id: index + 1,
              studyProtocolNumber: name,
              name: name,
            }))
          }
          setStudies(studiesData)
        } else {
          toast.error(response.message || "Failed to load studies")
        }
      } catch (error) {
        if (mounted) {
          console.error("Error loading studies:", error)
          toast.error("Failed to load studies. Please try again.")
        }
      } finally {
        if (mounted) setLoadingStudies(false)
      }
    }
    loadStudies()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!filters.studyId) {
      setSites([])
      loadingSiteStudyIdRef.current = null
      if (sitesAbortControllerRef.current) {
        sitesAbortControllerRef.current.abort()
        sitesAbortControllerRef.current = null
      }
      return
    }

    const studyIdNum = parseInt(filters.studyId, 10)
    if (isNaN(studyIdNum) || studyIdNum <= 0) {
      setSites([])
      return
    }

    if (sitesAbortControllerRef.current && loadingSiteStudyIdRef.current !== studyIdNum) {
      sitesAbortControllerRef.current.abort()
      sitesAbortControllerRef.current = null
    }

    if (sitesAbortControllerRef.current && loadingSiteStudyIdRef.current === studyIdNum) {
      return
    }

    loadingSiteStudyIdRef.current = studyIdNum
    const abortController = new AbortController()
    sitesAbortControllerRef.current = abortController
    setLoadingSites(true)

    const loadSites = async () => {
      try {
        const response = await siteService.getSitesForDropdown(studyIdNum)
        if (!abortController.signal.aborted && loadingSiteStudyIdRef.current === studyIdNum) {
          if (response.isSuccess && response.data) {
            let sitesData = response.data || []
            if (Array.isArray(sitesData) && sitesData.length > 0 && typeof sitesData[0] === "string") {
              sitesData = sitesData.map((name, index) => ({
                siteId: index + 1,
                id: index + 1,
                siteName: name,
                name: name,
              }))
            }
            setSites(sitesData)
          } else {
            setSites([])
          }
        }
      } catch (error) {
        if (!abortController.signal.aborted && loadingSiteStudyIdRef.current === studyIdNum) {
          console.error("Error loading sites:", error)
          setSites([])
        }
      } finally {
        if (!abortController.signal.aborted && loadingSiteStudyIdRef.current === studyIdNum) {
          setLoadingSites(false)
        }
        if (loadingSiteStudyIdRef.current === studyIdNum && sitesAbortControllerRef.current === abortController) {
          sitesAbortControllerRef.current = null
          loadingSiteStudyIdRef.current = null
        }
      }
    }

    loadSites()

    return () => {
      if (sitesAbortControllerRef.current === abortController && loadingSiteStudyIdRef.current === studyIdNum) {
        abortController.abort()
        sitesAbortControllerRef.current = null
        loadingSiteStudyIdRef.current = null
      }
    }
  }, [filters.studyId])

  useEffect(() => {
    if (!filters.studyId || !filters.siteId) {
      setPatientEnrolments([])
      loadingPatientStudyIdRef.current = null
      loadingPatientSiteIdRef.current = null
      return
    }

    const studyIdNum = parseInt(filters.studyId, 10)
    const siteIdNum = parseInt(filters.siteId, 10)
    if (isNaN(studyIdNum) || studyIdNum <= 0 || isNaN(siteIdNum) || siteIdNum <= 0) {
      setPatientEnrolments([])
      return
    }

    if (
      patientEnrolmentsAbortControllerRef.current &&
      (loadingPatientStudyIdRef.current !== studyIdNum || loadingPatientSiteIdRef.current !== siteIdNum)
    ) {
      patientEnrolmentsAbortControllerRef.current.abort()
      patientEnrolmentsAbortControllerRef.current = null
    }

    if (
      patientEnrolmentsAbortControllerRef.current &&
      loadingPatientStudyIdRef.current === studyIdNum &&
      loadingPatientSiteIdRef.current === siteIdNum
    ) {
      return
    }

    loadingPatientStudyIdRef.current = studyIdNum
    loadingPatientSiteIdRef.current = siteIdNum
    const abortController = new AbortController()
    patientEnrolmentsAbortControllerRef.current = abortController
    setLoadingPatientEnrolments(true)

    const loadPatientEnrolments = async () => {
      try {
        const response = await patientEnrolmentService.getPatientEnrolmentsForDropdown(studyIdNum, siteIdNum)
        if (
          !abortController.signal.aborted &&
          loadingPatientStudyIdRef.current === studyIdNum &&
          loadingPatientSiteIdRef.current === siteIdNum
        ) {
          if (response.isSuccess && response.data) {
            let patientsData = response.data || []
            if (Array.isArray(patientsData) && patientsData.length > 0 && typeof patientsData[0] === "string") {
              patientsData = patientsData.map((name, index) => ({
                patientEnrolmentId: index + 1,
                id: index + 1,
                initial: name,
                name: name,
              }))
            }
            setPatientEnrolments(patientsData)
          } else {
            setPatientEnrolments([])
          }
        }
      } catch (error) {
        if (
          !abortController.signal.aborted &&
          loadingPatientStudyIdRef.current === studyIdNum &&
          loadingPatientSiteIdRef.current === siteIdNum
        ) {
          console.error("Error loading patient enrolments:", error)
          setPatientEnrolments([])
        }
      } finally {
        if (
          !abortController.signal.aborted &&
          loadingPatientStudyIdRef.current === studyIdNum &&
          loadingPatientSiteIdRef.current === siteIdNum
        ) {
          setLoadingPatientEnrolments(false)
        }
        if (
          loadingPatientStudyIdRef.current === studyIdNum &&
          loadingPatientSiteIdRef.current === siteIdNum &&
          patientEnrolmentsAbortControllerRef.current === abortController
        ) {
          patientEnrolmentsAbortControllerRef.current = null
          loadingPatientStudyIdRef.current = null
          loadingPatientSiteIdRef.current = null
        }
      }
    }

    loadPatientEnrolments()

    return () => {
      if (
        patientEnrolmentsAbortControllerRef.current === abortController &&
        loadingPatientStudyIdRef.current === studyIdNum &&
        loadingPatientSiteIdRef.current === siteIdNum
      ) {
        abortController.abort()
        patientEnrolmentsAbortControllerRef.current = null
        loadingPatientStudyIdRef.current = null
        loadingPatientSiteIdRef.current = null
      }
    }
  }, [filters.studyId, filters.siteId])

  useEffect(() => {
    if (!filters.studyId) {
      setVisitSchedules([])
      loadingVisitStudyIdRef.current = null
      if (visitSchedulesAbortControllerRef.current) {
        visitSchedulesAbortControllerRef.current.abort()
        visitSchedulesAbortControllerRef.current = null
      }
      setFilters((prev) => ({ ...prev, visitScheduleId: "" }))
      return
    }

    const studyIdNum = parseInt(filters.studyId, 10)
    if (isNaN(studyIdNum) || studyIdNum <= 0) {
      setVisitSchedules([])
      setFilters((prev) => ({ ...prev, visitScheduleId: "" }))
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
        const response = await visitScheduleService.getVisitSchedulesForDropdown(studyIdNum, null)
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
        if (loadingVisitStudyIdRef.current === studyIdNum && visitSchedulesAbortControllerRef.current === abortController) {
          visitSchedulesAbortControllerRef.current = null
          loadingVisitStudyIdRef.current = null
        }
      }
    }

    loadVisitSchedules()

    return () => {
      if (visitSchedulesAbortControllerRef.current === abortController && loadingVisitStudyIdRef.current === studyIdNum) {
        abortController.abort()
        visitSchedulesAbortControllerRef.current = null
        loadingVisitStudyIdRef.current = null
      }
    }
  }, [filters.studyId])

  const hasActiveFilters = useMemo(() => {
    return (
      filters.studyId !== "" ||
      filters.visitScheduleId !== "" ||
      filters.siteId !== "" ||
      filters.patientEnrolmentId !== "" ||
      String(filters.search || "").trim() !== ""
    )
  }, [filters])

  const activeFilterCount = useMemo(() => {
    let n = 0
    if (String(filters.studyId || "").trim()) n += 1
    if (String(filters.visitScheduleId || "").trim()) n += 1
    if (String(filters.siteId || "").trim()) n += 1
    if (String(filters.patientEnrolmentId || "").trim()) n += 1
    if (String(filters.search || "").trim()) n += 1
    return n
  }, [filters])

  const hasStudySelected = useMemo(() => String(filters.studyId || "").trim() !== "", [filters.studyId])

  const handleFilterChange = useCallback((key, value) => {
    setStudyRequiredError(false)
    if (key === "studyId" || key === "siteId") {
      setPatientSearch("")
    }
    setFilters((prev) => {
      const next = { ...prev, [key]: value }
      if (key === "studyId") {
        next.visitScheduleId = ""
        next.siteId = ""
        next.patientEnrolmentId = ""
      }
      if (key === "siteId") {
        next.patientEnrolmentId = ""
      }
      return next
    })
  }, [])

  const handleClearFilters = useCallback(() => {
    setStudyRequiredError(false)
    setFilters({
      studyId: "",
      visitScheduleId: "",
      siteId: "",
      patientEnrolmentId: "",
      search: "",
    })
    setStudySearch("")
    setSiteSearch("")
    setPatientSearch("")
    setSites([])
    setPatientEnrolments([])
    setVisitSchedules([])
    if (sitesAbortControllerRef.current) sitesAbortControllerRef.current.abort()
    if (patientEnrolmentsAbortControllerRef.current) patientEnrolmentsAbortControllerRef.current.abort()
    if (visitSchedulesAbortControllerRef.current) visitSchedulesAbortControllerRef.current.abort()
    sitesAbortControllerRef.current = null
    patientEnrolmentsAbortControllerRef.current = null
    visitSchedulesAbortControllerRef.current = null
    loadingSiteStudyIdRef.current = null
    loadingPatientStudyIdRef.current = null
    loadingPatientSiteIdRef.current = null
    loadingVisitStudyIdRef.current = null
  }, [])

  const handleExport = useCallback(async () => {
    if (!assertCanExport()) return
    if (exporting) return
    setExporting(true)
    try {
      const studyIdNum = filters.studyId ? parseInt(filters.studyId, 10) : NaN
      if (!Number.isFinite(studyIdNum) || studyIdNum <= 0) {
        setStudyRequiredError(true)
        toast.error("Please select a study before exporting.")
        return
      }
      await patientVisitCrfStatusReportService.exportPatientVisitCrfStatusReport(withWorkspace(filters))
      toast.success("CSV downloaded successfully.")
    } catch (error) {
      console.error("Patient visit CRF status export error:", error)
      toast.error(error?.message || "Export failed. Please try again.")
    } finally {
      setExporting(false)
    }
  }, [assertCanExport, exporting, filters])

  return (
    <DashboardLayout>
      <div className={REPORT_PAGE_SHELL_WITH_BG_CLASS}>
        <div className="mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br btn-brand-gradient rounded-xl shadow-lg">
              <FileText className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800 mb-1">Patient visit CRF status</h1>
              <p className="text-slate-600">
                Export patient visit and CRF status as CSV (no on-screen grid; opens in Excel or similar).
                When PI sign-off is enabled, export includes PI status columns when supported by the API.
              </p>
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
                  type="button"
                  onClick={handleClearFilters}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
              <div className="space-y-2 min-w-0">
                <label className="text-sm font-bold text-slate-700">
                  Study <span className="text-red-600">*</span>
                </label>
                <Select
                  value={filters.studyId || undefined}
                  onValueChange={(value) => handleFilterChange("studyId", value === "all" ? "" : value)}
                  disabled={loadingStudies}
                >
                  <SelectTrigger
                    className={cn(
                      REPORT_SELECT_TRIGGER_CLASS,
                      "!w-full min-w-0 max-w-full",
                      studyRequiredError && "border-red-300 focus:border-red-500 focus:ring-red-100",
                    )}
                  >
                    <SelectValue placeholder={loadingStudies ? "Loading studies..." : "Select Study"} />
                  </SelectTrigger>
                  <SelectContent className={REPORT_SELECT_CONTENT_CLASS}>
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
                          className={REPORT_SELECT_SEARCH_INPUT_CLASS}
                        />
                      </div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      <SelectItem value="all" className={REPORT_SELECT_ITEM_CLASS}>
                        All Studies
                      </SelectItem>
                      {studies
                        .filter((study) => {
                          if (!studySearch.trim()) return true
                          const searchLower = studySearch.toLowerCase()
                          const displayName = (
                            study.studyProtocolNumber ||
                            study.protocolNumber ||
                            study.name ||
                            study.studyName ||
                            (typeof study === "string" ? study : null) ||
                            `Study ${study.studyId || study.id}`
                          ).toLowerCase()
                          return displayName.includes(searchLower)
                        })
                        .map((study) => {
                          const studyId = study.studyId || study.id
                          const displayName =
                            study.studyProtocolNumber ||
                            study.protocolNumber ||
                            study.name ||
                            study.studyName ||
                            (typeof study === "string" ? study : null) ||
                            `Study ${studyId}`
                          return (
                            <SelectItem key={studyId} value={studyId.toString()} className={REPORT_SELECT_ITEM_CLASS}>
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

              <div className="space-y-2 min-w-0">
                <label className="text-sm font-bold text-slate-700">Visit schedule</label>
                <Select
                  value={filters.visitScheduleId || "all"}
                  onValueChange={(value) => handleFilterChange("visitScheduleId", value === "all" ? "" : value)}
                  disabled={loadingVisitSchedules || !filters.studyId}
                >
                  <SelectTrigger className={cn(REPORT_SELECT_TRIGGER_CLASS, "!w-full min-w-0 max-w-full")}>
                    <SelectValue
                      placeholder={
                        !filters.studyId
                          ? "Select Study first"
                          : loadingVisitSchedules
                            ? "Loading visit schedules..."
                            : "All visit schedules"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className={REPORT_SELECT_CONTENT_CLASS}>
                    <SelectItem value="all" className={REPORT_SELECT_ITEM_CLASS}>
                      All visit schedules
                    </SelectItem>
                    {visitSchedules.map((visitSchedule) => {
                      const visitId = visitSchedule.visitScheduleId || visitSchedule.id
                      if (!visitId) return null
                      const displayName =
                        visitSchedule.visitName ||
                        visitSchedule.name ||
                        visitSchedule.visitScheduleName ||
                        (typeof visitSchedule === "string" ? visitSchedule : null) ||
                        `Visit ${visitId}`
                      return (
                        <SelectItem key={visitId} value={visitId.toString()} className={REPORT_SELECT_ITEM_CLASS}>
                          {displayName}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 min-w-0">
                <label className="text-sm font-bold text-slate-700">Site</label>
                <Select
                  value={filters.siteId || undefined}
                  onValueChange={(value) => handleFilterChange("siteId", value === "all" ? "" : value)}
                  disabled={loadingSites || !filters.studyId}
                >
                  <SelectTrigger className={cn(REPORT_SELECT_TRIGGER_CLASS, "!w-full min-w-0 max-w-full")}>
                    <SelectValue
                      placeholder={
                        !filters.studyId ? "Select Study first" : loadingSites ? "Loading sites..." : "Select Site"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className={REPORT_SELECT_CONTENT_CLASS}>
                    <div className="p-3 border-b border-slate-200 sticky top-0 bg-white z-10">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          type="text"
                          placeholder="Search sites..."
                          value={siteSearch}
                          onChange={(e) => setSiteSearch(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          className={REPORT_SELECT_SEARCH_INPUT_CLASS}
                        />
                      </div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      <SelectItem value="all" className={REPORT_SELECT_ITEM_CLASS}>
                        All Sites
                      </SelectItem>
                      {sites
                        .filter((site) => {
                          if (!siteSearch.trim()) return true
                          const searchLower = siteSearch.toLowerCase()
                          const displayName = (
                            site.siteName ||
                            site.name ||
                            (typeof site === "string" ? site : null) ||
                            `Site ${site.siteId || site.id}`
                          ).toLowerCase()
                          return displayName.includes(searchLower)
                        })
                        .map((site) => {
                          const siteId = site.siteId || site.id
                          const displayName =
                            site.siteName || site.name || (typeof site === "string" ? site : null) || `Site ${siteId}`
                          return (
                            <SelectItem key={siteId} value={siteId.toString()} className={REPORT_SELECT_ITEM_CLASS}>
                              {displayName}
                            </SelectItem>
                          )
                        })}
                    </div>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 min-w-0">
                <label className="text-sm font-bold text-slate-700">Patient enrolment</label>
                <Select
                  value={filters.patientEnrolmentId || undefined}
                  onValueChange={(value) => handleFilterChange("patientEnrolmentId", value === "all" ? "" : value)}
                  disabled={loadingPatientEnrolments || !filters.studyId || !filters.siteId}
                >
                  <SelectTrigger className={cn(REPORT_SELECT_TRIGGER_CLASS, "!w-full min-w-0 max-w-full")}>
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
                  <SelectContent className={REPORT_SELECT_CONTENT_CLASS}>
                    <div className="p-3 border-b border-slate-200 sticky top-0 bg-white z-10">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          type="text"
                          placeholder="Search patients..."
                          value={patientSearch}
                          onChange={(e) => setPatientSearch(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          className={REPORT_SELECT_SEARCH_INPUT_CLASS}
                        />
                      </div>
                    </div>
                    <div className="max-h-[280px] overflow-y-auto overflow-x-hidden overscroll-contain">
                      <SelectItem value="all" className={REPORT_SELECT_ITEM_CLASS}>
                        All Patients
                      </SelectItem>
                      {patientEnrolments
                        .filter((patient) => patient && (patient.patientEnrolmentId || patient.id))
                        .filter((patient) => {
                          if (!patientSearch.trim()) return true
                          const q = patientSearch.toLowerCase()
                          const id = String(patient.patientEnrolmentId || patient.id || "")
                          const initial = String(patient.initial || patient.patientInitial || "").toLowerCase()
                          const name = String(patient.name || patient.patientName || "").toLowerCase()
                          return `${id} ${initial} ${name}`.includes(q)
                        })
                        .map((patient) => {
                          const patientId = patient.patientEnrolmentId || patient.id
                          const displayName =
                            patient.initial ||
                            patient.patientInitial ||
                            patient.name ||
                            patient.patientName ||
                            (typeof patient === "string" ? patient : null) ||
                            `Patient ${patientId}`
                          return (
                            <SelectItem key={patientId} value={patientId.toString()} className={REPORT_SELECT_ITEM_CLASS}>
                              {displayName}
                            </SelectItem>
                          )
                        })}
                    </div>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 min-w-0">
                <label className="text-sm font-bold text-slate-700">Search</label>
                <Input
                  type="text"
                  placeholder="Initial or gender"
                  value={filters.search}
                  onChange={(e) => handleFilterChange("search", e.target.value)}
                  disabled={!filters.studyId}
                  className={cn(
                    REPORT_INPUT_CLASS,
                    "box-border h-10 min-h-10 max-h-10 w-full rounded-lg px-4 py-0 text-sm leading-10 shadow-sm bg-white md:text-sm",
                  )}
                />
              </div>
            </div>
          </div>

          <div className="px-6 pb-6 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={handleClearFilters}
              variant="outline"
              disabled={!hasStudySelected || !hasActiveFilters || exporting}
            >
              <X className="w-4 h-4 mr-2" />
              Clear
            </Button>
            <div className="flex-1" />
            <ReportDownloadActions
              canExport={canExport}
              reportKey={reportKey}
              assertCanExport={assertCanExport}
              defaultSubject="Patient Status Report"
              defaultFormat="csv"
              enabledFormats={["csv"]}
              disabled={!hasStudySelected}
              busy={exporting}
              onExport={async ({ format, pageSize, orientation }) => {
                await handleExport(format, { pageSize, orientation })
              }}
            />
          </div>
          {!hasStudySelected && (
            <p className="text-xs text-slate-500 px-6 pb-4">
              Select Study first. Download uses the filters above.
            </p>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
