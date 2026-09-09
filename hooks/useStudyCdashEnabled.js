"use client"

import { useCallback, useEffect, useState } from "react"
import { useStudySettings } from "@/context/StudySettingsContext"
import {
  fetchStudySettingsByStudyId,
  hasStudySettingsSummary,
  pickIsCdashEnabled,
  resolveIsCdashEnabled,
} from "@/lib/utils/studySettingsRead"

export function useStudyCdashEnabled() {
  const ctx = useStudySettings()

  if (ctx) {
    return {
      studyId: ctx.studyId,
      isCdashEnabled: ctx.isCdashEnabled,
      loading: ctx.loading,
      refresh: ctx.refresh,
    }
  }

  return useStudyCdashEnabledStandalone()
}

function useStudyCdashEnabledStandalone() {
  const [studyId, setStudyId] = useState(null)
  const [isCdashEnabled, setIsCdashEnabled] = useState(null)
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
      setIsCdashEnabled(null)
      setLoading(false)
      return null
    }
    setLoading(true)
    try {
      const res = await fetchStudySettingsByStudyId(id)
      const enabled =
        res?.isSuccess && res.data != null && hasStudySettingsSummary(res.data)
          ? pickIsCdashEnabled(res.data)
          : false
      setIsCdashEnabled(enabled)
      return enabled
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh(readId())
  }, [refresh])

  return { studyId, isCdashEnabled, loading, refresh }
}

export function useStudyCdashEnabledForStudy(studyId) {
  const ctx = useStudySettings()
  const numericId = Number.parseInt(String(studyId), 10)
  const validId = Number.isFinite(numericId) && numericId > 0 ? numericId : null

  const [isCdashEnabled, setIsCdashEnabled] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!validId) {
      setIsCdashEnabled(null)
      setLoading(false)
      return
    }

    if (ctx && ctx.studyId === validId && ctx.isCdashEnabled !== null && !ctx.loading) {
      setIsCdashEnabled(ctx.isCdashEnabled)
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
            ? pickIsCdashEnabled(res.data)
            : false
        setIsCdashEnabled(enabled)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [validId, ctx?.studyId, ctx?.isCdashEnabled, ctx?.loading])

  return { isCdashEnabled, loading }
}
