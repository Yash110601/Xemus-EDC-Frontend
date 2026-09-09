/**
 * Manual eCRF — which visit types are startable when the visit card is still Pending,
 * based on patient participation status.
 */

import { PATIENT_STATUS_CODES } from "@/lib/services/patientEnrolment.service"
import { VISIT_TYPE, visitMatchesTypeEnum } from "@/lib/visitTypes"

/** Terminal / post-enrolment statuses: only AE + Concomitant Medication pending visits may open. */
const PENDING_VISIT_AE_CONMED_ONLY_STATUSES = Object.freeze(
  new Set([
    PATIENT_STATUS_CODES.SCREEN_FAILED,
    PATIENT_STATUS_CODES.DISCONTINUED,
    PATIENT_STATUS_CODES.WITHDRAWN,
    PATIENT_STATUS_CODES.LOST_TO_FOLLOW_UP,
    PATIENT_STATUS_CODES.DEATH,
  ]),
)

/**
 * @param {{ visitType?: unknown, crfFormType?: unknown, name?: unknown, isRepeatableGroup?: boolean, repeatableKind?: string|null }|null|undefined} visit
 */
export function isAdverseEventOrConcomitantVisit(visit) {
  if (!visit) return false
  if (visit.isRepeatableGroup) {
    const kind = String(visit.repeatableKind || "").toLowerCase()
    return kind === "adverse"
  }
  return (
    visitMatchesTypeEnum(visit, VISIT_TYPE.ADVERSE_EVENT) ||
    visitMatchesTypeEnum(visit, VISIT_TYPE.CONCOMITANT_MEDICATION)
  )
}

/**
 * @param {number|null|undefined} patientStatusCode
 * @param {unknown} visit
 */
export function isVisitAllowedForPatientStatusWhenPending(patientStatusCode, visit) {
  const code = Number(patientStatusCode)
  if (!Number.isFinite(code) || !PENDING_VISIT_AE_CONMED_ONLY_STATUSES.has(code)) {
    return true
  }
  return isAdverseEventOrConcomitantVisit(visit)
}

/**
 * Lock reason when visit row is Pending and patient status restricts visit types.
 * @param {{ currentStatusCode?: unknown, patientStatusCode?: unknown, currentStatusName?: string, patientStatusName?: string }|null|undefined} patient
 * @param {unknown} visit
 * @param {"pending"|"inprocess"|"completed"|string} visitCardStatus from calculateVisitStatus().status
 * @returns {string} empty when visit may open
 */
export function getPatientStatusPendingVisitLockReason(patient, visit, visitCardStatus) {
  if (String(visitCardStatus || "").toLowerCase() !== "pending") return ""
  if (!visit) return ""

  const patientCode = Number(
    patient?.currentStatusCode ?? patient?.patientStatusCode ?? patient?.CurrentStatusCode,
  )
  if (!Number.isFinite(patientCode) || !PENDING_VISIT_AE_CONMED_ONLY_STATUSES.has(patientCode)) {
    return ""
  }

  if (isVisitAllowedForPatientStatusWhenPending(patientCode, visit)) {
    return ""
  }

  const statusLabel =
    String(patient?.currentStatusName ?? patient?.patientStatusName ?? "").trim() ||
    "this patient status"

  return `Only Adverse Event and Concomitant Medication visits can be started while the patient status is ${statusLabel}.`
}
