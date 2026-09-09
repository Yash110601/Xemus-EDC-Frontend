"use client"

import { useCallback, useEffect, useState } from "react"
import dbLockService from "@/lib/services/dbLock.service"

/**
 * Resolves effective DB lock for study/site/CRF scope (backend cascade).
 * @param {string|number|null} studyId
 * @param {string|number|null} [siteId]
 * @param {string|number|null} [crfDataId]
 */
export function useStudyLockStatus(studyId, siteId = null, crfDataId = null) {
  const [loading, setLoading] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [lockMeta, setLockMeta] = useState(null)

  const refresh = useCallback(async () => {
    const sid = Number.parseInt(String(studyId ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0) {
      setIsLocked(false)
      setLockMeta(null)
      return
    }

    const parsedSiteId = Number.parseInt(String(siteId ?? ""), 10)
    const parsedCrfId = Number.parseInt(String(crfDataId ?? ""), 10)

    setLoading(true)
    try {
      const res = await dbLockService.getLockStatus(sid, {
        siteId: Number.isFinite(parsedSiteId) && parsedSiteId > 0 ? parsedSiteId : undefined,
        crfDataId: Number.isFinite(parsedCrfId) && parsedCrfId > 0 ? parsedCrfId : undefined,
      })
      setIsLocked(Boolean(res?.data?.isLocked))
      setLockMeta(res?.data ?? null)
    } finally {
      setLoading(false)
    }
  }, [studyId, siteId, crfDataId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const onContextChange = () => void refresh()
    window.addEventListener("studySiteChanged", onContextChange)
    return () => window.removeEventListener("studySiteChanged", onContextChange)
  }, [refresh])

  return { loading, isLocked, lockMeta, refresh }
}

export default useStudyLockStatus
