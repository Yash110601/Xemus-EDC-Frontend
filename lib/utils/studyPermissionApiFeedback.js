import { isStudyPermissionMatrixEnabled } from "@/lib/permissions/isStudyPermissionMatrixEnabled"

export const STUDY_PERMISSION_DENIED_EVENT = "studyPermissionDenied"

/**
 * Dispatch global permission-denied feedback (403) when matrix enforcement is ON.
 * @param {{ statusCode?: number, httpStatus?: number, message?: string, detail?: string }} response
 */
export function notifyStudyPermissionDenied(response) {
  if (!isStudyPermissionMatrixEnabled()) return false
  const status = response?.httpStatus ?? response?.statusCode
  if (status !== 403) return false

  const message =
    String(response?.message ?? response?.detail ?? "").trim() ||
    "You do not have permission for this action."

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(STUDY_PERMISSION_DENIED_EVENT, { detail: { message, statusCode: 403 } }),
    )
  }
  return true
}

/**
 * Show toast-friendly message when API returns permission error.
 * @param {{ isSuccess?: boolean, statusCode?: number, httpStatus?: number, message?: string }} response
 * @returns {boolean} true if handled as permission denial
 */
export function handleStudyPermissionApiResponse(response) {
  if (response?.isSuccess !== false) return false
  const status = response?.httpStatus ?? response?.statusCode
  if (status !== 403 && status !== 400) return false
  const msg = String(response?.message ?? "")
  if (status === 403 || /permission|forbidden|not allowed|locked|sign.?off|mask/i.test(msg)) {
    return notifyStudyPermissionDenied({ ...response, message: msg || response?.message })
  }
  return false
}
