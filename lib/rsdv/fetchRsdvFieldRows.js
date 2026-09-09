import { crfDataService, crfDesignService } from "@/lib/services"
import { buildRsdvCrfFieldRows } from "@/lib/rsdv/rsdvCrfFieldRows"

/**
 * Load eCRF field rows for RSDV Verify AI source matching.
 * @param {{ studyId: number, crfDataId: number, crfDesignId?: number }} params
 */
export async function fetchRsdvFieldRows({ studyId, crfDataId, crfDesignId }) {
  const sid = Number.parseInt(String(studyId ?? ""), 10)
  const dataId = Number.parseInt(String(crfDataId ?? ""), 10)
  const designId = Number.parseInt(String(crfDesignId ?? ""), 10)

  if (!Number.isFinite(sid) || sid <= 0 || !Number.isFinite(dataId) || dataId <= 0) {
    return []
  }

  const dataRes = await crfDataService.getCrfDataById(dataId, sid)
  if (!dataRes?.isSuccess || !dataRes.data) return []

  const detail = dataRes.data
  const resolvedDesignId = designId || detail.crfDesignId || detail.CrfDesignId
  let design = null

  if (Number.isFinite(resolvedDesignId) && resolvedDesignId > 0) {
    const designRes = await crfDesignService.getCrfDesignById(resolvedDesignId, sid)
    if (designRes?.isSuccess) design = designRes.data
  }

  const formData = detail.formData ?? detail.FormData ?? detail.formJson
  return buildRsdvCrfFieldRows(design, formData).map((row) => ({
    fieldId: row.fieldId,
    fieldLabel: row.label,
    value: row.value,
  }))
}
