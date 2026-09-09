"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { isStudyPermissionMatrixPlatformEnabled } from "@/lib/permissions/isStudyPermissionMatrixEnabled"
import { resolveStudyPermission } from "@/lib/permissions/resolveStudyPermission"
import { STUDY_PERMISSION } from "@/lib/permissions/coalesceStudyPermission"
import studyPermissionService from "@/lib/services/studyPermission.service"
import useStudyRolePermissionMode from "@/hooks/useStudyRolePermissionMode"

function parsePositiveInt(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function shouldTryStudyLevelFallback(siteId, permissions, meta) {
  const scopedSiteId = parsePositiveInt(siteId)
  if (!scopedSiteId) return false
  if (meta?.roleName) return false
  if (!permissions) return true
  return permissions[STUDY_PERMISSION.CRF_VIEW] !== true
}

function applyEffectiveResponse(res) {
  if (!res?.isSuccess || res.enforcementReady === false || res.data == null) {
    return null
  }

  return {
    permissions: res.data,
    meta: {
      roleGuid: res.roleGuid ?? null,
      roleName: res.roleName ?? null,
      source: res.permissionSource ?? null,
    },
  }
}

/**
 * Study/site permission hook — uses study matrix when Study Settings opt-in is ON; else legacy menu.
 */
export function useStudySitePermissions(studyId, siteId = null) {
  const platformEnabled = isStudyPermissionMatrixPlatformEnabled()
  const { enabled: studyUsesRolePermissionMatrix, loading: studyModeLoading } =
    useStudyRolePermissionMode(studyId)
  const [loading, setLoading] = useState(false)
  const [permissions, setPermissions] = useState(null)
  const [matrixLoadedFromApi, setMatrixLoadedFromApi] = useState(false)
  const [permissionMeta, setPermissionMeta] = useState(null)
  const studyIdRef = useRef(studyId)
  const activeStudyRef = useRef(null)
  studyIdRef.current = studyId

  const refresh = useCallback(async () => {
    if (!platformEnabled || !studyUsesRolePermissionMatrix) {
      setPermissions(null)
      setMatrixLoadedFromApi(false)
      setPermissionMeta(null)
      return
    }

    const sid = Number.parseInt(String(studyId ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0) {
      activeStudyRef.current = null
      setPermissions(null)
      setMatrixLoadedFromApi(false)
      setPermissionMeta(null)
      return
    }

    setLoading(true)

    const studyChanged = activeStudyRef.current != null && activeStudyRef.current !== sid
    activeStudyRef.current = sid

    if (studyChanged) {
      setPermissions(null)
      setMatrixLoadedFromApi(false)
      setPermissionMeta(null)
    }

    try {
      const scopedSiteId = parsePositiveInt(siteId)
      let res = await studyPermissionService.getEffectivePermissions(sid, scopedSiteId)
      let resolved = applyEffectiveResponse(res)

      if (
        resolved &&
        shouldTryStudyLevelFallback(scopedSiteId, resolved.permissions, resolved.meta)
      ) {
        const studyLevelRes = await studyPermissionService.getEffectivePermissions(sid, null)
        const studyLevel = applyEffectiveResponse(studyLevelRes)
        if (studyLevel?.permissions?.[STUDY_PERMISSION.CRF_VIEW] === true) {
          resolved = {
            permissions: studyLevel.permissions,
            meta: {
              ...studyLevel.meta,
              resolvedScope: "study",
              siteScopeDenied: true,
            },
          }
        }
      }

      if (resolved) {
        setPermissions(resolved.permissions)
        setMatrixLoadedFromApi(true)
        setPermissionMeta(resolved.meta)
      } else {
        setPermissions(null)
        setMatrixLoadedFromApi(false)
        setPermissionMeta(null)
      }
    } finally {
      setLoading(false)
    }
  }, [platformEnabled, studyUsesRolePermissionMatrix, studyId, siteId])

  useEffect(() => {
    if (studyModeLoading) return
    void refresh()
  }, [refresh, studyModeLoading])

  useEffect(() => {
    if (!platformEnabled || !studyUsesRolePermissionMatrix) return undefined
    const onContextChange = () => {
      void refresh()
    }
    const onMatrixUpdated = (event) => {
      const detailSid = Number.parseInt(String(event?.detail?.studyId ?? ""), 10)
      const sid = Number.parseInt(String(studyIdRef.current ?? ""), 10)
      if (!Number.isFinite(detailSid) || detailSid !== sid) return
      void refresh()
    }
    window.addEventListener("studySiteChanged", onContextChange)
    window.addEventListener("studyPermissionMatrixUpdated", onMatrixUpdated)
    return () => {
      window.removeEventListener("studySiteChanged", onContextChange)
      window.removeEventListener("studyPermissionMatrixUpdated", onMatrixUpdated)
    }
  }, [platformEnabled, studyUsesRolePermissionMatrix, refresh])

  const can = useCallback(
    (permissionKey) =>
      resolveStudyPermission(permissionKey, permissions, {
        matrixLoadedFromApi,
        studyUsesRolePermissionMatrix,
      }),
    [permissions, matrixLoadedFromApi, studyUsesRolePermissionMatrix],
  )

  const useLegacyPermissions = useMemo(
    () => !platformEnabled || !studyUsesRolePermissionMatrix || !matrixLoadedFromApi,
    [platformEnabled, studyUsesRolePermissionMatrix, matrixLoadedFromApi],
  )

  return {
    enabled: platformEnabled && studyUsesRolePermissionMatrix,
    studyUsesRolePermissionMatrix,
    studyModeLoading,
    useLegacyPermissions,
    loading: loading || studyModeLoading,
    permissions,
    permissionMeta,
    matrixLoadedFromApi,
    can,
    refresh,
  }
}

export default useStudySitePermissions
