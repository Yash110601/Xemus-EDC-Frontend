"use client"

import { useEffect, useState } from "react"
import { fetchStudySettingsByStudyId } from "@/lib/utils/studySettingsRead"
import { resolvePatientIdentifierModeForStudy } from "@/lib/utils/patientIdentifierSettingsOverlay"

const DEFAULT_MODE = {
  screeningEnabled: false,
  maskCustomizable: false,
  screeningNumberMask: "S-{SITE}-{SEQ:3}",
  randomizationNumberEnabled: false,
}

export function usePatientIdentifierStudySettings(studyId) {
  const [mode, setMode] = useState(DEFAULT_MODE)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const numericId = Number.parseInt(String(studyId ?? ""), 10)
    if (!Number.isFinite(numericId) || numericId <= 0) {
      setMode(DEFAULT_MODE)
      return undefined
    }

    let cancelled = false
    setLoading(true)

    fetchStudySettingsByStudyId(numericId)
      .then((res) => {
        if (cancelled) return
        setMode(resolvePatientIdentifierModeForStudy(numericId, res?.data ?? {}))
      })
      .catch(() => {
        if (!cancelled) setMode(DEFAULT_MODE)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    const onSettingsUpdated = (event) => {
      if (String(event?.detail?.studyId ?? "") !== String(numericId)) return
      fetchStudySettingsByStudyId(numericId, { forceRefresh: true }).then((res) => {
        if (!cancelled) {
          setMode(resolvePatientIdentifierModeForStudy(numericId, res?.data ?? {}))
        }
      })
    }

    if (typeof window !== "undefined") {
      window.addEventListener("studySettingsUpdated", onSettingsUpdated)
    }

    return () => {
      cancelled = true
      if (typeof window !== "undefined") {
        window.removeEventListener("studySettingsUpdated", onSettingsUpdated)
      }
    }
  }, [studyId])

  return { ...mode, loading }
}
