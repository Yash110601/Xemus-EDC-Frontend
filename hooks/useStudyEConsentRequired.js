"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useStudySettings } from "@/context/StudySettingsContext"
import { useStudySiteContext } from "@/hooks/useStudySiteContext"
import {
  fetchStudySettingsByStudyId,
  hasStudySettingsSummary,
  pickIsEConsentRequired,
} from "@/lib/utils/studySettingsRead"

function parsePositiveId(value) {
  const id = Number.parseInt(String(value ?? ""), 10)
  return Number.isFinite(id) && id > 0 ? id : null
}

/**
 * eCONSENT flag for the active study.
 * studyId comes from URL (?studyId=) → header workspace → StudySettingsProvider.
 */
export function useStudyEConsentRequired() {
  const ctx = useStudySettings()
  const { studyId: workspaceStudyId, ready: workspaceReady } = useStudySiteContext()
  const searchParams = useSearchParams()
  const urlStudyId = parsePositiveId(searchParams?.get("studyId"))

  // Ignore workspace/localStorage study until client context is ready — avoids SSR hydration mismatch.
  const studyId = urlStudyId ?? (workspaceReady ? (ctx?.studyId ?? workspaceStudyId ?? null) : null)

  const [standaloneFlag, setStandaloneFlag] = useState(null)
  const [standaloneLoading, setStandaloneLoading] = useState(false)

  const ctxCoversStudy =
    Boolean(ctx) && ctx.studyId === studyId && ctx.isEConsentRequired !== null && !ctx.loading

  const refresh = useCallback(
    async (nextStudyId) => {
      const id = nextStudyId === undefined ? studyId : nextStudyId
      if (ctx?.refresh) return ctx.refresh(id, { force: true })
      if (!id) {
        setStandaloneFlag(null)
        return null
      }
      setStandaloneLoading(true)
      try {
        const res = await fetchStudySettingsByStudyId(id)
        const enabled =
          res?.isSuccess && res.data != null && hasStudySettingsSummary(res.data)
            ? pickIsEConsentRequired(res.data)
            : false
        setStandaloneFlag(enabled)
        return enabled
      } finally {
        setStandaloneLoading(false)
      }
    },
    [ctx, studyId],
  )

  useEffect(() => {
    if (!studyId || ctxCoversStudy) {
      if (!studyId) setStandaloneFlag(null)
      return
    }
    let alive = true
    setStandaloneLoading(true)
    fetchStudySettingsByStudyId(studyId)
      .then((res) => {
        if (!alive) return
        const enabled =
          res?.isSuccess && res.data != null && hasStudySettingsSummary(res.data)
            ? pickIsEConsentRequired(res.data)
            : false
        setStandaloneFlag(enabled)
      })
      .finally(() => {
        if (alive) setStandaloneLoading(false)
      })
    return () => {
      alive = false
    }
  }, [studyId, ctxCoversStudy])

  return useMemo(
    () => ({
      studyId,
      isEConsentRequired: ctxCoversStudy ? ctx.isEConsentRequired : standaloneFlag,
      loading: !workspaceReady || (ctxCoversStudy ? Boolean(ctx?.loading) : standaloneLoading),
      refresh,
    }),
    [
      studyId,
      ctxCoversStudy,
      ctx?.isEConsentRequired,
      ctx?.loading,
      standaloneFlag,
      standaloneLoading,
      workspaceReady,
      refresh,
    ],
  )
}

/**
 * eCONSENT flag for a specific study id. Uses cache; reuses provider when same study.
 */
export function useStudyEConsentRequiredForStudy(studyId) {
  const ctx = useStudySettings()
  const validId = parsePositiveId(studyId)

  const [isEConsentRequired, setIsEConsentRequired] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!validId) {
      setIsEConsentRequired(null)
      setLoading(false)
      return
    }

    if (ctx && ctx.studyId === validId && ctx.isEConsentRequired !== null && !ctx.loading) {
      setIsEConsentRequired(ctx.isEConsentRequired)
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
            ? pickIsEConsentRequired(res.data)
            : false
        setIsEConsentRequired(enabled)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [validId, ctx?.studyId, ctx?.isEConsentRequired, ctx?.loading])

  return { isEConsentRequired, loading }
}
