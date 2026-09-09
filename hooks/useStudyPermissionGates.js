"use client"

import { useMemo } from "react"
import useStudySitePermissions from "@/hooks/useStudySitePermissions"
import { coalesceStudyPermission, STUDY_PERMISSION } from "@/lib/permissions/coalesceStudyPermission"
import {
  canUserRaiseQueries,
  canUserVerifySdv,
  canUserRsdvReview,
  canUserPiSignoff,
} from "@/lib/utils/studySettingsRead"

/**
 * Study/site permission gates — dynamic per study + site via GetEffectivePermissions.
 *
 * When NEXT_PUBLIC_STUDY_PERMISSION_MATRIX_ENABLED is true and the API returns
 * enforcement-ready data, each gate uses that study/site matrix only (no role-name overrides).
 * When enforcement is off or the API is not ready, legacy menu + study-settings checks apply.
 *
 * @param {string|number|null} studyId
 * @param {string|number|null} siteId
 * @param {{
 *   menuCanView?: boolean,
 *   menuCanEdit?: boolean,
 *   menuCanExport?: boolean,
 *   userRoleGuid?: string|null,
 *   queryRaiseRoleGuids?: string[],
 *   sdvRoleGuids?: string[],
 *   rsdvRoleGuids?: string[],
 *   piSignoffRoleGuids?: string[],
 * }} [legacy]
 */
export function useStudyPermissionGates(studyId, siteId, legacy = {}) {
  const studyPerms = useStudySitePermissions(studyId, siteId)
  const can = studyPerms.can

  const gates = useMemo(() => {
    const menuCanView = legacy.menuCanView !== false
    const menuCanEdit = Boolean(legacy.menuCanEdit)
    const menuCanExport = Boolean(legacy.menuCanExport)
    const userRoleGuid = legacy.userRoleGuid ?? null
    const queryRaiseRoleGuids = legacy.queryRaiseRoleGuids ?? []
    const sdvRoleGuids = legacy.sdvRoleGuids ?? []
    const rsdvRoleGuids = legacy.rsdvRoleGuids ?? []
    const piSignoffRoleGuids = legacy.piSignoffRoleGuids ?? []

    const legacyCanRaiseQuery = canUserRaiseQueries(userRoleGuid, queryRaiseRoleGuids)
    const legacyCanVerifySdv = canUserVerifySdv(userRoleGuid, sdvRoleGuids)
    const legacyCanRsdvReview = canUserRsdvReview(userRoleGuid, rsdvRoleGuids, sdvRoleGuids)
    const legacyCanPiSignoffFromRoles = canUserPiSignoff(userRoleGuid, piSignoffRoleGuids)
    const legacyCanPiSignoff =
      legacyCanPiSignoffFromRoles === null ? menuCanEdit : legacyCanPiSignoffFromRoles
    const legacyCanEditCrf = menuCanEdit
    const legacyCanViewCrf = menuCanView !== false && Boolean(menuCanView)

    return {
      canViewCrf: coalesceStudyPermission(can(STUDY_PERMISSION.CRF_VIEW), legacyCanViewCrf),
      canEditCrf: coalesceStudyPermission(can(STUDY_PERMISSION.CRF_EDIT), legacyCanEditCrf),
      canCreateQuery: coalesceStudyPermission(can(STUDY_PERMISSION.QUERY_CREATE), legacyCanRaiseQuery),
      canRespondQuery: coalesceStudyPermission(can(STUDY_PERMISSION.QUERY_RESPOND), true),
      canCloseQuery: coalesceStudyPermission(can(STUDY_PERMISSION.QUERY_CLOSE), legacyCanRaiseQuery),
      canVerifySdv: coalesceStudyPermission(can(STUDY_PERMISSION.SDV_VERIFY), legacyCanVerifySdv),
      canRsdvReview: coalesceStudyPermission(can(STUDY_PERMISSION.RSDV_REVIEW), legacyCanRsdvReview),
      canPiSignoff: coalesceStudyPermission(can(STUDY_PERMISSION.PI_SIGNOFF), legacyCanPiSignoff),
      canViewMaskedData: coalesceStudyPermission(can(STUDY_PERMISSION.DATA_MASKING_VIEW), false),
      canViewReport: coalesceStudyPermission(can(STUDY_PERMISSION.REPORT_VIEW), menuCanView),
      canExportReport: coalesceStudyPermission(can(STUDY_PERMISSION.REPORT_EXPORT), menuCanExport),
      canViewDbLock: coalesceStudyPermission(can(STUDY_PERMISSION.DBLOCK_VIEW), false),
      canApplyDbLock: coalesceStudyPermission(can(STUDY_PERMISSION.DBLOCK_APPLY), false),
    }
  }, [
    can,
    legacy.menuCanView,
    legacy.menuCanEdit,
    legacy.menuCanExport,
    legacy.userRoleGuid,
    legacy.queryRaiseRoleGuids,
    legacy.sdvRoleGuids,
    legacy.rsdvRoleGuids,
    legacy.piSignoffRoleGuids,
    studyPerms.matrixLoadedFromApi,
    studyPerms.permissions,
    studyPerms.studyUsesRolePermissionMatrix,
  ])

  return {
    ...studyPerms,
    gates,
  }
}

export default useStudyPermissionGates
