"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import dbLockService from "@/lib/services/dbLock.service"
import { LOCK_LEVELS } from "@/lib/dbLock/crfLockTree"

/**
 * Resolves coarse + granular DB lock for study/site/CRF scope.
 * @param {string|number|null} studyId
 * @param {string|number|null} [siteId]
 * @param {string|number|null} [crfDataId]
 * @param {{ sectionTree?: Array<{ sectionKey: string, fields: Array<{ fieldKey: string }> }> }} [options]
 */
export function useGranularDbLock(studyId, siteId = null, crfDataId = null, options = {}) {
  const [loading, setLoading] = useState(false)
  const [coarseStatus, setCoarseStatus] = useState(null)
  const [targetsState, setTargetsState] = useState(null)
  const [granularApiAvailable, setGranularApiAvailable] = useState(false)

  const refresh = useCallback(async () => {
    const sid = Number.parseInt(String(studyId ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0) {
      setCoarseStatus(null)
      setTargetsState(null)
      setGranularApiAvailable(false)
      return
    }

    const parsedSiteId = Number.parseInt(String(siteId ?? ""), 10)
    const parsedCrfId = Number.parseInt(String(crfDataId ?? ""), 10)
    const scope = {
      siteId: Number.isFinite(parsedSiteId) && parsedSiteId > 0 ? parsedSiteId : undefined,
      crfDataId: Number.isFinite(parsedCrfId) && parsedCrfId > 0 ? parsedCrfId : undefined,
    }

    setLoading(true)
    try {
      const [statusRes, structureRes] = await Promise.all([
        dbLockService.getLockStatus(sid, scope),
        scope.crfDataId ? dbLockService.getCrfStructure(sid, scope.crfDataId) : Promise.resolve(null),
      ])

      setCoarseStatus(statusRes?.data ?? null)
      if (structureRes?.isSuccess && structureRes?.data) {
        setTargetsState(structureRes.data)
        setGranularApiAvailable(true)
      } else {
        setTargetsState(null)
        setGranularApiAvailable(false)
      }
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

  const lockState = useMemo(() => {
    const coarseLocked = Boolean(coarseStatus?.isLocked)
    const coarseLevel = String(coarseStatus?.level ?? "").toLowerCase()
    const cascadeStudy = coarseLocked && coarseLevel === LOCK_LEVELS.STUDY
    const cascadeSite = coarseLocked && coarseLevel === LOCK_LEVELS.SITE
    const wholeCrfFromCoarse = coarseLocked && coarseLevel === LOCK_LEVELS.CRF
    const wholeCrfFromTargets = Boolean(targetsState?.isWholeCrfLocked)
    const cascadeFromTargets = Boolean(
      targetsState?.cascadeLocked?.study || targetsState?.cascadeLocked?.site,
    )

    const wholeFormLocked =
      cascadeStudy || cascadeSite || wholeCrfFromCoarse || wholeCrfFromTargets || cascadeFromTargets

    const lockedSectionKeys = new Set([
      ...(coarseStatus?.lockedSections ?? []).map(String),
      ...Array.from(targetsState?.lockedSectionKeys ?? []),
    ])

    const lockedFieldKeys = new Set([
      ...(coarseStatus?.lockedFields ?? []).map(String),
      ...Array.from(targetsState?.lockedFieldKeys ?? []),
    ])

    for (const section of options.sectionTree ?? []) {
      if (lockedSectionKeys.has(section.sectionKey)) {
        section.fields?.forEach((field) => lockedFieldKeys.add(field.fieldKey))
      }
    }

    const hasGranularLocks = lockedSectionKeys.size > 0 || lockedFieldKeys.size > 0

    return {
      active: coarseLocked || hasGranularLocks || wholeCrfFromTargets,
      loading,
      coarseStatus,
      targetsState,
      granularApiAvailable,
      wholeFormLocked,
      hasGranularLocks,
      lockedSectionKeys,
      lockedFieldKeys,
      lockedSelectionKeys: targetsState?.lockedSelectionKeys ?? new Set(),
    }
  }, [coarseStatus, targetsState, loading, granularApiAvailable, options.sectionTree])

  return { ...lockState, refresh, isLocked: lockState.wholeFormLocked || lockState.hasGranularLocks }
}

export default useGranularDbLock
