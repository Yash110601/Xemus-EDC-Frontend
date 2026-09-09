"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import studyService from "@/lib/services/study.service"
import sdvReportService from "@/lib/services/sdvReport.service"
import { SDV_REPORT_INITIAL_FILTERS } from "@/lib/reports/studySitePatientReportUi"
import { parseIsSdvConfiguredFromSettingsResponse } from "@/lib/reports/sdvReportDisplay"
import { toast } from "sonner"
import { useStudySiteContext } from "@/hooks/useStudySiteContext"

const isFilterValueActive = (key, value) => {
  if (key === "pageNumber" || key === "pageSize") return false
  return String(value ?? "").trim() !== ""
}

/**
 * SDV Report cascading filters via GET /api/SdvReport/filter-options.
 * Study → Site → Patient → Visit → CRF (each level clears downstream).
 */
export function useSdvReportCascadingFilters(options = {}) {
  const syncHeaderContext = options.syncHeaderContext !== false
  const { studyId: headerStudyId, siteId: headerSiteId, ready: headerReady } = useStudySiteContext()
  const [filters, setFilters] = useState(SDV_REPORT_INITIAL_FILTERS)
  const [studies, setStudies] = useState([])
  const [sites, setSites] = useState([])
  const [patients, setPatients] = useState([])
  const [visits, setVisits] = useState([])
  const [crfForms, setCrfForms] = useState([])

  const [loadingStudies, setLoadingStudies] = useState(false)
  const [loadingCascade, setLoadingCascade] = useState(false)
  const [studyRequiredError, setStudyRequiredError] = useState(false)
  const [sdvConfiguredForStudy, setSdvConfiguredForStudy] = useState(null)

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

  const activeFilterCount = useMemo(
    () =>
      Object.entries(filters).reduce(
        (count, [key, value]) => (isFilterValueActive(key, value) ? count + 1 : count),
        0,
      ),
    [filters],
  )

  useEffect(() => {
    if (!syncHeaderContext || !headerReady || !headerStudyId) return

    setFilters((prev) => {
      const nextStudyId = String(headerStudyId)
      const nextSiteId = headerSiteId ? String(headerSiteId) : ""

      if (String(prev.studyId || "") === nextStudyId && String(prev.siteId || "") === nextSiteId) {
        return prev
      }

      return {
        ...prev,
        studyId: nextStudyId,
        siteId: nextSiteId,
        patientEnrolmentId: "",
        visitScheduleId: "",
        crfDesignId: "",
        pageNumber: 1,
      }
    })
  }, [syncHeaderContext, headerReady, headerStudyId, headerSiteId])

  const clearCascadeOptions = useCallback((level) => {
    if (level === "study") {
      setSites([])
      setPatients([])
      setVisits([])
      setCrfForms([])
      return
    }
    if (level === "site") {
      setPatients([])
      setVisits([])
      setCrfForms([])
      return
    }
    if (level === "patient") {
      setVisits([])
      setCrfForms([])
      return
    }
    if (level === "visit") {
      setCrfForms([])
    }
  }, [])

  const ensureSdvConfiguredForStudy = useCallback(async (studyId) => {
    const res = await studyService.getStudySettings(studyId)
    const configured = res?.isSuccess ? parseIsSdvConfiguredFromSettingsResponse(res) : false
    setSdvConfiguredForStudy(configured)
    if (!configured) {
      throw new Error("SDV roles are not configured for this study.")
    }
    return true
  }, [])

  const fetchFilterOptions = useCallback(async (params) => {
    setLoadingCascade(true)
    try {
      const res = await sdvReportService.getFilterOptions(params)
      const normalized = res.normalized ?? sdvReportService.normalizeFilterOptions(res)
      return normalized
    } finally {
      setLoadingCascade(false)
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
    loadStudies()
    return () => {
      mounted = false
    }
  }, [])

  const reloadCascadeForFilters = useCallback(
    async (nextFilters) => {
      const studyId = parseInt(String(nextFilters.studyId || ""), 10)
      if (!Number.isFinite(studyId) || studyId <= 0) {
        clearCascadeOptions("study")
        return
      }

      try {
        await ensureSdvConfiguredForStudy(studyId)
      } catch (error) {
        toast.error(error?.message || "SDV is not enabled for this study.")
        clearCascadeOptions("study")
        return
      }

      const siteId = parseInt(String(nextFilters.siteId || ""), 10)
      const patientEnrolmentId = parseInt(String(nextFilters.patientEnrolmentId || ""), 10)
      const visitScheduleId = parseInt(String(nextFilters.visitScheduleId || ""), 10)

      const params = { studyId }
      if (Number.isFinite(siteId) && siteId > 0) params.siteId = siteId
      if (Number.isFinite(patientEnrolmentId) && patientEnrolmentId > 0) {
        params.patientEnrolmentId = patientEnrolmentId
      }
      if (Number.isFinite(visitScheduleId) && visitScheduleId > 0) {
        params.visitScheduleId = visitScheduleId
      }

      try {
        const normalized = await fetchFilterOptions(params)
        setSites(normalized.sites)
        if (!params.siteId) {
          setPatients([])
          setVisits([])
          setCrfForms([])
          return
        }
        setPatients(normalized.patients)
        if (!params.patientEnrolmentId) {
          setVisits([])
          setCrfForms([])
          return
        }
        setVisits(normalized.visits)
        if (!params.visitScheduleId) {
          setCrfForms([])
          return
        }
        setCrfForms(normalized.crfForms)
      } catch (error) {
        toast.error(error?.message || "Failed to load filter options")
        clearCascadeOptions("study")
      }
    },
    [clearCascadeOptions, ensureSdvConfiguredForStudy, fetchFilterOptions],
  )

  const handleFilterChange = useCallback(
    (key, value) => {
      if (key === "studyId") {
        setSdvConfiguredForStudy(null)
        clearCascadeOptions("study")
        setStudyRequiredError(false)
        const next = {
          ...SDV_REPORT_INITIAL_FILTERS,
          studyId: value,
        }
        setFilters(next)
        if (String(value || "").trim()) {
          reloadCascadeForFilters(next)
        }
        return
      }

      if (key === "siteId") {
        clearCascadeOptions("site")
        setFilters((prev) => {
          const next = {
            ...prev,
            siteId: value,
            patientEnrolmentId: "",
            visitScheduleId: "",
            crfDesignId: "",
          }
          void reloadCascadeForFilters(next)
          return next
        })
        return
      }

      if (key === "patientEnrolmentId") {
        clearCascadeOptions("patient")
        setFilters((prev) => {
          const next = {
            ...prev,
            patientEnrolmentId: value,
            visitScheduleId: "",
            crfDesignId: "",
          }
          void reloadCascadeForFilters(next)
          return next
        })
        return
      }

      if (key === "visitScheduleId") {
        clearCascadeOptions("visit")
        setFilters((prev) => {
          const next = {
            ...prev,
            visitScheduleId: value,
            crfDesignId: "",
          }
          void reloadCascadeForFilters(next)
          return next
        })
        return
      }

      setFilters((prev) => ({ ...prev, [key]: value }))
    },
    [clearCascadeOptions, reloadCascadeForFilters],
  )

  const resetFilterUi = useCallback(() => {
    setStudySearch("")
    setSiteSearch("")
    setPatientSearch("")
    setVisitSearch("")
    setCrfSearch("")
    setStudyRequiredError(false)
    setSdvEnabledForStudy(null)
    clearCascadeOptions("study")
    setFilters(SDV_REPORT_INITIAL_FILTERS)
  }, [clearCascadeOptions])

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
    sdvConfiguredForStudy,
    ensureSdvConfiguredForStudy,
    handleFilterChange,
    hasStudySelected,
    hasSiteSelected,
    hasPatientSelected,
    hasVisitSelected,
    hasActiveFilters,
    activeFilterCount,
    resetFilterUi,
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
  }
}
