"use client"

import { useCallback, useEffect, useState } from "react"
import { useStudySettings } from "@/context/StudySettingsContext"
import {
  fetchStudySettingsByStudyId,
  hasStudySettingsSummary,
  pickIsAgreementEnabled,
} from "@/lib/utils/studySettingsRead"

/**
 * Agreement flag for header-selected study — reads from StudySettingsProvider (no extra API).
 */
export function useStudyAgreementEnabled() {
  const ctx = useStudySettings()

  if (ctx) {
    return {
      studyId: ctx.studyId,
      isAgreementEnabled: ctx.isAgreementEnabled,
      loading: ctx.loading,
      refresh: ctx.refresh,
    }
  }

  return useStudyAgreementEnabledStandalone()
}

/** Fallback when provider is not mounted (e.g. rare layouts). */
function useStudyAgreementEnabledStandalone() {
  const [studyId, setStudyId] = useState(null)
  const [isAgreementEnabled, setIsAgreementEnabled] = useState(null)
  const [loading, setLoading] = useState(false)

  const readId = () => {
    if (typeof window === "undefined") return null
    const raw = localStorage.getItem("selectedStudyId")
    const id = raw ? Number.parseInt(raw, 10) : null
    return Number.isFinite(id) && id > 0 ? id : null
  }

  const refresh = useCallback(async (nextStudyId) => {
    const id = nextStudyId === undefined ? readId() : nextStudyId
    setStudyId(id)
    if (!id) {
      setIsAgreementEnabled(null)
      setLoading(false)
      return null
    }
    setLoading(true)
    try {
      const res = await fetchStudySettingsByStudyId(id)
      const enabled =
        res?.isSuccess && res.data != null && hasStudySettingsSummary(res.data)
          ? pickIsAgreementEnabled(res.data)
          : false
      setIsAgreementEnabled(enabled)
      return enabled
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh(readId())
  }, [refresh])

  return { studyId, isAgreementEnabled, loading, refresh }
}

/**
 * Agreement flag for a specific study id (reports). Uses cache; reuses provider when same study.
 */
export function useStudyAgreementEnabledForStudy(studyId) {
  const ctx = useStudySettings()
  const numericId = Number.parseInt(String(studyId), 10)
  const validId = Number.isFinite(numericId) && numericId > 0 ? numericId : null

  const [isAgreementEnabled, setIsAgreementEnabled] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!validId) {
      setIsAgreementEnabled(null)
      setLoading(false)
      return
    }

    if (ctx && ctx.studyId === validId && ctx.isAgreementEnabled !== null && !ctx.loading) {
      setIsAgreementEnabled(ctx.isAgreementEnabled)
      setLoading(false)
      return
    }

    let alive = true
    setLoading(true)
    fetchStudySettingsByStudyId(validId)
      .then((res) => {
        if (!alive) return
        const enabled =
          res?.isSuccess && res.data != null && hasStudySettingsSummary(res.data)
            ? pickIsAgreementEnabled(res.data)
            : false
        setIsAgreementEnabled(enabled)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [validId, ctx?.studyId, ctx?.isAgreementEnabled, ctx?.loading])

  return { isAgreementEnabled, loading }
}
