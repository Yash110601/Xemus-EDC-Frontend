"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import studyService from "@/lib/services/study.service"
import cdiscExportService from "@/lib/services/cdiscExport.service"
import { PI_SIGNOFF_REPORT_INITIAL_FILTERS } from "@/lib/reports/studySitePatientReportUi"
import { toast } from "sonner"
import { useStudySiteContext } from "@/hooks/useStudySiteContext"

const isFilterValueActive = (key, value) => {
  if (key === "pageNumber" || key === "pageSize" || key === "piSignoffStatus") return false
  return String(value ?? "").trim() !== ""
}

export function useCdiscExportFilters(options = {}) {
  const syncHeaderContext = options.syncHeaderContext !== false
  const { studyId: headerStudyId, siteId: headerSiteId, ready: headerReady } = useStudySiteContext()
  const [filters, setFilters] = useState(PI_SIGNOFF_REPORT_INITIAL_FILTERS)
  const [studies, setStudies] = useState([])
  const [sites, setSites] = useState([])
  const [patients, setPatients] = useState([])
  const [visits, setVisits] = useState([])
  const [crfForms, setCrfForms] = useState([])

  const [loadingStudies, setLoadingStudies] = useState(false)
  const [loadingCascade, setLoadingCascade] = useState(false)
  const [studyRequiredError, setStudyRequiredError] = useState(false)

  const [studySearch, setStudySearch] = useState("")
  const [siteSearch, setSiteSearch] = useState("")
  const [patientSearch, setPatientSearch] = useState("")
  const [visitSearch, setVisitSearch] = useState("")
  const [crfSearch, setCrfSearch] = useState("")

  const hasStudySelected = useMemo(() => String(filters.studyId || "").trim() !== "", [filters.studyId])
  const hasSiteSelected = useMemo(() => String(filters.siteId || "").trim() !== "", [filters.siteId])
  const hasPatientSelected = useMemo(
    () => String(filters.patientEnrolmentId || "").trim() !== "",
    [filters.patientEnrolmentId],
  )
  const hasVisitSelected = useMemo(
    () => String(filters.visitScheduleId || "").trim() !== "",
    [filters.visitScheduleId],
  )

  const hasActiveFilters = useMemo(
    () => Object.entries(filters).some(([key, value]) => isFilterValueActive(key, value)),
    [filters],
  )

  const loadStudies = useCallback(async () => {
    setLoadingStudies(true)
    try {
      const response = await studyService.getStudiesForDropdown()
      if (response?.isSuccess && response.data) {
        setStudies(Array.isArray(response.data) ? response.data : [])
      }
    } catch (error) {
      toast.error(error?.message || "Failed to load studies")
    } finally {
      setLoadingStudies(false)
    }
  }, [])

  const reloadCascadeForFilters = useCallback(async (nextFilters) => {
    const studyId = parseInt(nextFilters.studyId, 10)
    if (!Number.isFinite(studyId) || studyId <= 0) {
      setSites([])
      setPatients([])
      setVisits([])
      setCrfForms([])
      return
    }

    setLoadingCascade(true)
    try {
      const siteId = parseInt(nextFilters.siteId, 10)
      const patientEnrolmentId = parseInt(nextFilters.patientEnrolmentId, 10)
      const visitScheduleId = parseInt(nextFilters.visitScheduleId, 10)

      const response = await cdiscExportService.getFilterOptions({
        studyId,
        siteId: Number.isFinite(siteId) && siteId > 0 ? siteId : undefined,
        patientEnrolmentId:
          Number.isFinite(patientEnrolmentId) && patientEnrolmentId > 0 ? patientEnrolmentId : undefined,
        visitScheduleId:
          Number.isFinite(visitScheduleId) && visitScheduleId > 0 ? visitScheduleId : undefined,
      })

      const normalized = response?.normalized ?? {}
      setSites(normalized.sites ?? [])
      setPatients(normalized.patients ?? [])
      setVisits(normalized.visits ?? [])
      setCrfForms(normalized.crfForms ?? [])
    } catch (error) {
      toast.error(error?.message || "Failed to load filter options")
      setSites([])
      setPatients([])
      setVisits([])
      setCrfForms([])
    } finally {
      setLoadingCascade(false)
    }
  }, [])

  const handleFilterChange = useCallback(
    (key, value) => {
      setFilters((prev) => {
        const next = { ...prev, [key]: value }
        if (key === "studyId") {
          next.siteId = ""
          next.patientEnrolmentId = ""
          next.visitScheduleId = ""
          next.crfDesignId = ""
        } else if (key === "siteId") {
          next.patientEnrolmentId = ""
          next.visitScheduleId = ""
          next.crfDesignId = ""
        } else if (key === "patientEnrolmentId") {
          next.visitScheduleId = ""
          next.crfDesignId = ""
        } else if (key === "visitScheduleId") {
          next.crfDesignId = ""
        }
        reloadCascadeForFilters(next)
        return next
      })
      if (key === "studyId" && String(value || "").trim()) {
        setStudyRequiredError(false)
      }
    },
    [reloadCascadeForFilters],
  )

  const clearFilters = useCallback(() => {
    setFilters(PI_SIGNOFF_REPORT_INITIAL_FILTERS)
    setSites([])
    setPatients([])
    setVisits([])
    setCrfForms([])
    setStudyRequiredError(false)
  }, [])

  useEffect(() => {
    loadStudies()
  }, [loadStudies])

  useEffect(() => {
    if (!syncHeaderContext || !headerReady) return
    if (!headerStudyId) return

    setFilters((prev) => {
      if (String(prev.studyId) === String(headerStudyId)) return prev
      const next = {
        ...PI_SIGNOFF_REPORT_INITIAL_FILTERS,
        studyId: String(headerStudyId),
        siteId: headerSiteId ? String(headerSiteId) : "",
      }
      reloadCascadeForFilters(next)
      return next
    })
  }, [headerReady, headerSiteId, headerStudyId, reloadCascadeForFilters, syncHeaderContext])

  return {
    filters,
    setFilters,
    studies,
    sites,
    patients,
    visits,
    crfForms,
    loadingStudies,
    loadingCascade,
    studyRequiredError,
    setStudyRequiredError,
    studySearch,
    setStudySearch,
    siteSearch,
    setSiteSearch,
    patientSearch,
    setPatientSearch,
    visitSearch,
    setVisitSearch,
    crfSearch,
    setCrfSearch,
    hasStudySelected,
    hasSiteSelected,
    hasPatientSelected,
    hasVisitSelected,
    hasActiveFilters,
    handleFilterChange,
    clearFilters,
    reloadCascadeForFilters,
  }
}
