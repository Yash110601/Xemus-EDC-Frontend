"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useStudySiteContext } from "@/hooks/useStudySiteContext"
import {
  fetchStudySettingsByStudyId,
  hasStudySettingsSummary,
  pickStudyAiSettings,
} from "@/lib/utils/studySettingsRead"
import { DEFAULT_STUDY_AI_SETTINGS, isAiModuleEnabled } from "@/lib/intelligence/xemusIntelligence"

function parsePositiveId(value) {
  const id = Number.parseInt(String(value ?? ""), 10)
  return Number.isFinite(id) && id > 0 ? id : null
}

function resolveSettingsFromPayload(data) {
  if (!data || !hasStudySettingsSummary(data)) return { ...DEFAULT_STUDY_AI_SETTINGS }
  return pickStudyAiSettings(data)
}

/**
 * Read YP Intelligence flags for the active study (URL → workspace context).
 */
export function useStudyAiSettings() {
  const { studyId: workspaceStudyId, ready: workspaceReady } = useStudySiteContext()
  const searchParams = useSearchParams()
  const urlStudyId = parsePositiveId(searchParams?.get("studyId"))
  const studyId = urlStudyId ?? (workspaceReady ? workspaceStudyId ?? null : null)

  const [settings, setSettings] = useState({ ...DEFAULT_STUDY_AI_SETTINGS })
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async (nextStudyId) => {
    const id = nextStudyId === undefined ? studyId : nextStudyId
    if (!id) {
      setSettings({ ...DEFAULT_STUDY_AI_SETTINGS })
      return { ...DEFAULT_STUDY_AI_SETTINGS }
    }
    setLoading(true)
    try {
      const res = await fetchStudySettingsByStudyId(id)
      const next = resolveSettingsFromPayload(res?.data)
      setSettings(next)
      return next
    } finally {
      setLoading(false)
    }
  }, [studyId])

  useEffect(() => {
    if (!studyId) {
      setSettings({ ...DEFAULT_STUDY_AI_SETTINGS })
      return
    }
    let alive = true
    setLoading(true)
    fetchStudySettingsByStudyId(studyId)
      .then((res) => {
        if (!alive) return
        setSettings(resolveSettingsFromPayload(res?.data))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [studyId])

  return useMemo(
    () => ({
      studyId,
      loading: !workspaceReady || loading,
      settings,
      isXemusIntelligenceEnabled: settings.isXemusIntelligenceEnabled,
      isAiEntryEnabled: isAiModuleEnabled(settings, "isAiEntryEnabled"),
      isAiRsdvVerifyEnabled: isAiModuleEnabled(settings, "isAiRsdvVerifyEnabled"),
      isAiQueryCopilotEnabled: isAiModuleEnabled(settings, "isAiQueryCopilotEnabled"),
      isAiCrfStudioEnabled: isAiModuleEnabled(settings, "isAiCrfStudioEnabled"),
      isAiQualityHintsEnabled: isAiModuleEnabled(settings, "isAiQualityHintsEnabled"),
      isAiCodingAssistEnabled: isAiModuleEnabled(settings, "isAiCodingAssistEnabled"),
      isAiInsightEnabled: isAiModuleEnabled(settings, "isAiInsightEnabled"),
      isAiConsentAssistEnabled: isAiModuleEnabled(settings, "isAiConsentAssistEnabled"),
      refresh,
    }),
    [studyId, workspaceReady, loading, settings, refresh],
  )
}

/** Flags for a specific study id (e.g. RSDV attachment study). */
export function useStudyAiSettingsForStudy(studyId) {
  const validId = parsePositiveId(studyId)
  const [settings, setSettings] = useState({ ...DEFAULT_STUDY_AI_SETTINGS })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!validId) {
      setSettings({ ...DEFAULT_STUDY_AI_SETTINGS })
      return
    }
    let alive = true
    setLoading(true)
    fetchStudySettingsByStudyId(validId)
      .then((res) => {
        if (!alive) return
        setSettings(resolveSettingsFromPayload(res?.data))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [validId])

  return useMemo(
    () => ({
      loading,
      settings,
      isAiRsdvVerifyEnabled: isAiModuleEnabled(settings, "isAiRsdvVerifyEnabled"),
      isAiQueryCopilotEnabled: isAiModuleEnabled(settings, "isAiQueryCopilotEnabled"),
      isAiInsightEnabled: isAiModuleEnabled(settings, "isAiInsightEnabled"),
    }),
    [loading, settings],
  )
}
