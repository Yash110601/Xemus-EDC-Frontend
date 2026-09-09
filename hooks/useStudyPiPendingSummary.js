"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import piSignoffService from "@/lib/services/piSignoff.service"
import { isPiSignoffStatusSigned } from "@/lib/piSignoff/piSignoffReadiness"

/**
 * Study-level PI pending queue — one fetch per study for visit badges / dashboard / DB lock banner.
 */
export function useStudyPiPendingSummary(studyId, options = {}) {
  const enabled = options.enabled !== false
  const sid = Number.parseInt(String(studyId ?? ""), 10)
  const validStudy = Number.isFinite(sid) && sid > 0

  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])
  const [pendingPatientCount, setPendingPatientCount] = useState(0)
  const [isPiSignoffRequired, setIsPiSignoffRequired] = useState(null)
  const [apiReady, setApiReady] = useState(true)
  const lastFetchRef = useRef(0)

  const reload = useCallback(async () => {
    if (!enabled || !validStudy) {
      setItems([])
      setPendingPatientCount(0)
      setIsPiSignoffRequired(null)
      return
    }
    setLoading(true)
    try {
      const res = await piSignoffService.getPendingByStudy(sid)
      setApiReady(res?.statusCode !== 404 && res?.statusCode !== 501)
      setIsPiSignoffRequired(res?.isPiSignoffRequired ?? null)
      setItems(Array.isArray(res?.data) ? res.data : [])
      setPendingPatientCount(
        Number.isFinite(res?.pendingPatientCount) && res.pendingPatientCount > 0
          ? res.pendingPatientCount
          : 0,
      )
      lastFetchRef.current = Date.now()
    } catch {
      setItems([])
      setPendingPatientCount(0)
      setApiReady(false)
    } finally {
      setLoading(false)
    }
  }, [enabled, validStudy, sid])

  useEffect(() => {
    void reload()
  }, [reload])

  const pendingByCrfDataId = useMemo(() => {
    const map = new Map()
    items.forEach((row) => {
      const id = Number.parseInt(String(row?.crfDataId ?? ""), 10)
      if (Number.isFinite(id) && id > 0) map.set(id, row)
    })
    return map
  }, [items])

  const getVisitPiCounts = useCallback(
    (visitScheduleId, patientEnrolmentId) => {
      const scheduleKey = String(visitScheduleId ?? "").trim()
      const patientKey = String(patientEnrolmentId ?? "").trim()
      let pending = 0
      let signed = 0

      items.forEach((row) => {
        const rowSchedule = String(row?.visitScheduleId ?? row?.visitId ?? "").trim()
        const rowPatient = String(row?.patientEnrolmentId ?? row?.patientId ?? "").trim()
        if (scheduleKey && rowSchedule && rowSchedule !== scheduleKey) return
        if (patientKey && rowPatient && rowPatient !== patientKey) return
        if (isPiSignoffStatusSigned(row?.status)) signed += 1
        else pending += 1
      })

      return { pending, signed }
    },
    [items],
  )

  return {
    loading,
    items,
    pendingCount: items.length,
    pendingPatientCount,
    isPiSignoffRequired,
    apiReady,
    pendingByCrfDataId,
    getVisitPiCounts,
    reload,
    lastFetchedAt: lastFetchRef.current,
  }
}

export default useStudyPiPendingSummary
