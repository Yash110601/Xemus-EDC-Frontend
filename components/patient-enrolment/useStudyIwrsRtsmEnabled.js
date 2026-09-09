"use client"

import { useEffect, useState } from "react"
import platformService from "@/lib/services/platform.service"

/**
 * Study-level Enterprise IWRS (RTSM) link from Platform → Module registry.
 * When false/null, enrolment UI stays classic EDC-only (no IWRS chrome).
 */
export function useStudyIwrsRtsmEnabled(studyId) {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const numericId = Number.parseInt(String(studyId ?? ""), 10)
    if (!Number.isFinite(numericId) || numericId <= 0) {
      setEnabled(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)

    platformService
      .getModules(numericId)
      .then((res) => {
        if (cancelled) return
        const data = res?.data
        const platformOn = Boolean(data?.isPlatformEnabled ?? data?.IsPlatformEnabled)
        const iwrsOn = Boolean(data?.isIwrsRtsmEnabled ?? data?.IsIwrsRtsmEnabled)
        setEnabled(Boolean(res?.isSuccess && platformOn && iwrsOn))
      })
      .catch(() => {
        if (!cancelled) setEnabled(false)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [studyId])

  return { iwrsEnabled: enabled, loading }
}
