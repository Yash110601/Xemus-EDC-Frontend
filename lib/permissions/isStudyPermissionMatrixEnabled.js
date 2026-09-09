/**
 * Platform kill-switch for study permission matrix runtime.
 * Per-study opt-in is controlled in Study Settings (`useStudyRolePermissionMatrix`).
 */
export function isStudyPermissionMatrixPlatformEnabled() {
  const raw = process.env.NEXT_PUBLIC_STUDY_PERMISSION_MATRIX_ENABLED
  if (raw === "false") return false
  return true
}

/** @deprecated Use isStudyPermissionMatrixPlatformEnabled — kept for admin UI labels. */
export function isStudyPermissionMatrixEnabled() {
  return isStudyPermissionMatrixPlatformEnabled()
}

/** When true, GetEffectivePermissions gates UI for a study with matrix enabled in Study Settings. */
export function isStudyPermissionEnforcementReady(
  matrixLoadedFromApi = false,
  studyUsesRolePermissionMatrix = false,
) {
  return (
    isStudyPermissionMatrixPlatformEnabled() &&
    studyUsesRolePermissionMatrix === true &&
    matrixLoadedFromApi
  )
}
