/**
 * Paged study loader — CDASH-enabled studies only when flag is present on DTO.
 */
import { loadPagedStudyDropdownOptions } from "@/lib/utils/loadPagedStudyDropdownOptions"
import { isStudyCdashEnabledOnDto } from "@/lib/reports/cdashReportDisplay"

export async function loadPagedCdashEnabledStudyOptions(q = "", meta = {}) {
  const result = await loadPagedStudyDropdownOptions(q, meta)
  const items = (result.items || []).filter((study) => {
    const flag = isStudyCdashEnabledOnDto(study)
    return flag !== false
  })
  return {
    ...result,
    items,
  }
}
