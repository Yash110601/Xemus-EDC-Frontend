import { studyPaymentRuleService, studyService } from "@/lib/services"
import { getStudyTypeValue } from "@/lib/utils/studyFormEnums"
import { STUDY_TYPE } from "@/lib/utils/paymentRuleEnums"

/**
 * After visit schedule save, seed visit-based payment rules when the study has none yet.
 * Backend ApplyTemplate with force=false is a no-op when rules already exist.
 */
export async function syncVisitPaymentRulesAfterVisitSave(studyId) {
  const sid = Number.parseInt(String(studyId ?? ""), 10)
  if (!Number.isFinite(sid) || sid <= 0) return { skipped: true, reason: "invalid_study" }

  const studyRes = await studyService.getStudyById(sid)
  const study = studyRes?.data ?? studyRes
  const studyType = getStudyTypeValue(
    study?.studyType ?? study?.StudyType ?? study?.studyTypeName ?? study?.StudyTypeName,
  )
  if (studyType !== STUDY_TYPE.VISIT) {
    return { skipped: true, reason: "not_visit_study", studyType }
  }

  const res = await studyPaymentRuleService.applyTemplate(sid, {
    studyType: STUDY_TYPE.VISIT,
    force: false,
  })
  return { skipped: false, studyType, ...res }
}
