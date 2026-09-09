"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import visitScheduleService from "@/lib/services/visitSchedule.service"
import crfDesignService from "@/lib/services/crfDesign.service"
import {
  normalizeCrfDesignsDropdownItems,
  normalizeVisitSchedulesDropdownItems,
} from "@/lib/reports/reportPatientCascadeFilters"
import { toast } from "sonner"

const isFilterValueActive = (key, value) => {
  if (key === "pageNumber" || key === "pageSize") return false
  return String(value ?? "").trim() !== ""
}

/**
 * Shared report filters: Study → Site (paged) → Patient (paged) → Visit/CRF (study DD APIs).
 */
export function useReportPatientCascadeFilters({ initialFilters }) {
  const [filters, setFilters] = useState(initialFilters)
  const [visits, setVisits] = useState([])
  const [crfForms, setCrfForms] = useState([])

  const [loadingVisits, setLoadingVisits] = useState(false)
  const [loadingCrfForms, setLoadingCrfForms] = useState(false)
  const [studyRequiredError, setStudyRequiredError] = useState(false)

  const [visitSearch, setVisitSearch] = useState("")
  const [crfSearch, setCrfSearch] = useState("")

  const visitsAbortRef = useRef(null)
  const crfAbortRef = useRef(null)
  const loadingStudyRef = useRef(null)

  const loadingCascade = loadingVisits || loadingCrfForms

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

  const clearStudyDropdowns = useCallback(() => {
    setVisits([])
    setCrfForms([])
  }, [])

  const loadStudyDropdowns = useCallback(async (studyId) => {
    const studyIdNum = parseInt(String(studyId ?? ""), 10)
    if (!Number.isFinite(studyIdNum) || studyIdNum <= 0) {
      clearStudyDropdowns()
      return
    }

    if (visitsAbortRef.current) {
      visitsAbortRef.current.abort()
      visitsAbortRef.current = null
    }
    if (crfAbortRef.current) {
      crfAbortRef.current.abort()
      crfAbortRef.current = null
    }

    if (loadingStudyRef.current === studyIdNum) {
      return
    }

    loadingStudyRef.current = studyIdNum
    const visitsAbort = new AbortController()
    const crfAbort = new AbortController()
    visitsAbortRef.current = visitsAbort
    crfAbortRef.current = crfAbort

    setLoadingVisits(true)
    setLoadingCrfForms(true)

    try {
      const [visitRes, crfRes] = await Promise.all([
        visitScheduleService.getVisitSchedulesForDropdown(studyIdNum, null, {
          signal: visitsAbort.signal,
        }),
        crfDesignService.getCrfDesignsForDropdown(studyIdNum, { signal: crfAbort.signal }),
      ])

      if (loadingStudyRef.current !== studyIdNum) return

      if (!visitsAbort.signal.aborted) {
        if (visitRes?.isSuccess) {
          setVisits(normalizeVisitSchedulesDropdownItems(visitRes.data))
        } else {
          setVisits([])
          if (visitRes?.message) toast.error(visitRes.message)
        }
      }

      if (!crfAbort.signal.aborted) {
        if (crfRes?.isSuccess) {
          setCrfForms(normalizeCrfDesignsDropdownItems(crfRes.data))
        } else {
          setCrfForms([])
          if (crfRes?.message) toast.error(crfRes.message)
        }
      }
    } catch (error) {
      if (loadingStudyRef.current !== studyIdNum) return
      if (error?.name !== "AbortError") {
        toast.error(error?.message || "Failed to load visit/CRF filters")
        setVisits([])
        setCrfForms([])
      }
    } finally {
      if (loadingStudyRef.current === studyIdNum) {
        setLoadingVisits(false)
        setLoadingCrfForms(false)
        loadingStudyRef.current = null
        if (visitsAbortRef.current === visitsAbort) visitsAbortRef.current = null
        if (crfAbortRef.current === crfAbort) crfAbortRef.current = null
      }
    }
  }, [clearStudyDropdowns])

  useEffect(() => {
    const studyId = String(filters.studyId || "").trim()
    if (!studyId) {
      clearStudyDropdowns()
      return
    }
    void loadStudyDropdowns(studyId)
  }, [filters.studyId, clearStudyDropdowns, loadStudyDropdowns])

  const handleFilterChange = useCallback(
    (key, value) => {
      if (key === "studyId") {
        setStudyRequiredError(false)
        setFilters({ ...initialFilters, studyId: value })
        return
      }

      if (key === "siteId") {
        setFilters((prev) => ({
          ...prev,
          siteId: value,
          patientEnrolmentId: "",
          visitScheduleId: "",
          crfDesignId: "",
        }))
        return
      }

      if (key === "patientEnrolmentId") {
        setFilters((prev) => ({
          ...prev,
          patientEnrolmentId: value,
          visitScheduleId: "",
          crfDesignId: "",
        }))
        return
      }

      if (key === "visitScheduleId") {
        setFilters((prev) => ({
          ...prev,
          visitScheduleId: value,
          crfDesignId: "",
        }))
        return
      }

      setFilters((prev) => ({ ...prev, [key]: value }))
    },
    [initialFilters],
  )

  const resetFilterUi = useCallback(() => {
    setVisitSearch("")
    setCrfSearch("")
    setStudyRequiredError(false)
    clearStudyDropdowns()
    setFilters(initialFilters)
  }, [clearStudyDropdowns, initialFilters])

  return {
    filters,
    setFilters,
    visits,
    crfForms,
    loadingVisits,
    loadingCrfForms,
    loadingCascade,
    studyRequiredError,
    setStudyRequiredError,
    handleFilterChange,
    hasStudySelected,
    hasSiteSelected,
    hasPatientSelected,
    hasVisitSelected,
    hasActiveFilters,
    resetFilterUi,
    visitSearch,
    setVisitSearch,
    crfSearch,
    setCrfSearch,
  }
}
