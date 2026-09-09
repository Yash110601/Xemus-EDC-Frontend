"use client"

import { useCallback, useEffect, useState } from "react"
import {
  fetchStudySettingsByStudyId,
  pickUseStudyRolePermissionMatrix,
} from "@/lib/utils/studySettingsRead"

/**
 * Per-study opt-in: when true, runtime uses Study Role Permissions instead of global menu for that study.
 */
export function useStudyRolePermissionMode(studyId) {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    const sid = Number.parseInt(String(studyId ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0) {
      setEnabled(false)
      return
    }

    setLoading(true)
    try {
      const settings = await fetchStudySettingsByStudyId(sid, { preferFullEndpoint: true })
      setEnabled(pickUseStudyRolePermissionMatrix(settings?.data ?? settings))
    } catch {
      setEnabled(false)
    } finally {
      setLoading(false)
    }
  }, [studyId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onStudySettingsUpdated = (event) => {
      const detailSid = Number.parseInt(String(event?.detail?.studyId ?? ""), 10)
      const sid = Number.parseInt(String(studyId ?? ""), 10)
      if (Number.isFinite(detailSid) && detailSid === sid) {
        void (async () => {
          setLoading(true)
          try {
            const settings = await fetchStudySettingsByStudyId(sid, {
              preferFullEndpoint: true,
              forceRefresh: true,
            })
            setEnabled(pickUseStudyRolePermissionMatrix(settings?.data ?? settings))
          } catch {
            setEnabled(false)
          } finally {
            setLoading(false)
          }
        })()
      }
    }

    window.addEventListener("studySettingsUpdated", onStudySettingsUpdated)
    return () => window.removeEventListener("studySettingsUpdated", onStudySettingsUpdated)
  }, [studyId, refresh])

  return { enabled, loading, refresh }
}

export default useStudyRolePermissionMode
