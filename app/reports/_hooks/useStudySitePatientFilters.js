"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import studyService from "@/lib/services/study.service"
import siteService from "@/lib/services/site.service"
import studyUserService from "@/lib/services/studyUser.service"
import patientEnrolmentService from "@/lib/services/patientEnrolment.service"
import { authService } from "@/lib/services"
import { STUDY_SITE_PATIENT_INITIAL_FILTERS } from "@/lib/reports/studySitePatientReportUi"
import { useStudySiteContext } from "@/hooks/useStudySiteContext"

export { STUDY_SITE_PATIENT_INITIAL_FILTERS, CRF_QUERY_REPORT_INITIAL_FILTERS } from "@/lib/reports/studySitePatientReportUi"

const isFilterValueActive = (key, value) => {
  if (key === "pageNumber" || key === "pageSize") return false
  if (key === "queryAgeFilter" && String(value || "All").trim() === "All") return false
  return String(value ?? "").trim() !== ""
}

/**
 * Shared Study → Site → Patient cascade + search/date filter state for report pages
 * (same UX as `/reports/audit-trail-with-reason`).
 *
 * @param {{ initialFilters?: typeof STUDY_SITE_PATIENT_INITIAL_FILTERS, syncHeaderContext?: boolean }} [options]
 */
export function useStudySitePatientFilters(options = {}) {
  const initialFilters = options.initialFilters ?? STUDY_SITE_PATIENT_INITIAL_FILTERS
  const syncHeaderContext = options.syncHeaderContext !== false
  const { studyId: headerStudyId, siteId: headerSiteId, ready: headerReady } = useStudySiteContext()
  const currentUser = authService.getUser?.() || {}
  const currentUserId = useMemo(() => {
    const raw = currentUser?.id ?? currentUser?.userId ?? currentUser?.UserId
    const parsed = parseInt(String(raw ?? ""), 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }, [currentUser?.id, currentUser?.userId, currentUser?.UserId])

  const [filters, setFilters] = useState(initialFilters)
  const [studies, setStudies] = useState([])
  const [sites, setSites] = useState([])
  const [patients, setPatients] = useState([])
  const [loadingStudies, setLoadingStudies] = useState(false)
  const [loadingSites, setLoadingSites] = useState(false)
  const [loadingPatients, setLoadingPatients] = useState(false)
  const [studySearch, setStudySearch] = useState("")
  const [siteSearch, setSiteSearch] = useState("")
  const [patientSearch, setPatientSearch] = useState("")
  const [studyRequiredError, setStudyRequiredError] = useState(false)

  const hasStudySelected = useMemo(() => String(filters.studyId || "").trim() !== "", [filters.studyId])
  const hasActiveFilters = useMemo(() => {
    return Object.entries(filters).some(([key, value]) => isFilterValueActive(key, value))
  }, [filters])
  const activeFilterCount = useMemo(() => {
    return Object.entries(filters).reduce((count, [key, value]) => {
      return isFilterValueActive(key, value) ? count + 1 : count
    }, 0)
  }, [filters])

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
        patientId: "",
        pageNumber: 1,
      }
    })
  }, [syncHeaderContext, headerReady, headerStudyId, headerSiteId])

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

  useEffect(() => {
    let mounted = true
    const studyId = parseInt(String(filters.studyId || ""), 10)
    if (!Number.isFinite(studyId) || studyId <= 0) {
      return
    }

    const loadSites = async () => {
      setLoadingSites(true)
      try {
        if (!currentUserId) {
          if (mounted) setSites([])
          return
        }
        const res = await studyUserService.getAssignedSitesWithUsersForStudy(studyId)
        if (!mounted) return
        const payload = res?.data
        const sitesFromNewApi = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.sites)
            ? payload.sites
            : Array.isArray(payload?.data?.sites)
              ? payload.data.sites
              : []
        if (res?.isSuccess) {
          setSites(sitesFromNewApi)
          return
        }
        const fallback = await siteService.getSitesForDropdown(studyId)
        if (!mounted) return
        setSites(fallback?.isSuccess && Array.isArray(fallback?.data) ? fallback.data : [])
      } catch {
        if (mounted) setSites([])
      } finally {
        if (mounted) setLoadingSites(false)
      }
    }
    loadSites()
    return () => {
      mounted = false
    }
  }, [filters.studyId, currentUserId])

  useEffect(() => {
    let mounted = true
    const studyId = parseInt(String(filters.studyId || ""), 10)
    const siteId = parseInt(String(filters.siteId || ""), 10)
    if (!Number.isFinite(studyId) || studyId <= 0 || !Number.isFinite(siteId) || siteId <= 0) {
      return
    }

    const loadPatients = async () => {
      setLoadingPatients(true)
      try {
        const res = await patientEnrolmentService.getPatientEnrolmentsForDropdown(studyId, siteId)
        if (!mounted) return
        setPatients(res?.isSuccess && Array.isArray(res?.data) ? res.data : [])
      } catch {
        if (mounted) setPatients([])
      } finally {
        if (mounted) setLoadingPatients(false)
      }
    }
    loadPatients()
    return () => {
      mounted = false
    }
  }, [filters.studyId, filters.siteId])

  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value }
      if (key === "studyId") {
        next.siteId = ""
        next.patientId = ""
        setSites([])
        setPatients([])
        setStudyRequiredError(false)
      }
      if (key === "siteId") {
        next.patientId = ""
        setPatients([])
      }
      return next
    })
  }, [])

  const resetFilterUi = useCallback(() => {
    setStudySearch("")
    setSiteSearch("")
    setPatientSearch("")
    setStudyRequiredError(false)
    setFilters(initialFilters)
    setSites([])
    setPatients([])
  }, [initialFilters])

  return {
    filters,
    setFilters,
    studies,
    sites,
    patients,
    loadingStudies,
    loadingSites,
    loadingPatients,
    studySearch,
    setStudySearch,
    siteSearch,
    setSiteSearch,
    patientSearch,
    setPatientSearch,
    studyRequiredError,
    setStudyRequiredError,
    handleFilterChange,
    hasStudySelected,
    hasActiveFilters,
    activeFilterCount,
    resetFilterUi,
    currentUserId,
  }
}
