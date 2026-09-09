/**
 * Shared paged study loaders for AsyncLookupSelect / StudyPagedSelect.
 */
import studyService from "@/lib/services/study.service"
import { DROPDOWN_PAGE_SIZE, normalizeApiPagedResponse } from "@/lib/api/lookupLimits"

/**
 * GetStudiesForDropdown — general study picker.
 * @param {string} [q]
 * @param {{ page?: number, studyType?: number|null, pageSize?: number }} [meta]
 */
export async function loadPagedStudyDropdownOptions(
  q = "",
  { page = 1, studyType = null, pageSize = DROPDOWN_PAGE_SIZE } = {},
) {
  const res = await studyService.getStudiesForDropdown(studyType, {
    search: String(q || "").trim(),
    pageNumber: page,
    pageSize,
  })
  if (res?.isSuccess === false) {
    throw new Error(res?.message || "Failed to load studies")
  }
  return normalizeApiPagedResponse(res, page)
}

/**
 * GetAccessibleStudies with financeEnabledOnly — Study Finance Status picker.
 * Returns only studies with finance module enabled.
 * @param {string} [q]
 * @param {{ page?: number, pageSize?: number, filter?: number }} [meta]
 */
export async function loadPagedFinanceEnabledStudyOptions(
  q = "",
  { page = 1, pageSize = DROPDOWN_PAGE_SIZE, filter = 1 } = {},
) {
  const res = await studyService.getAccessibleStudies({
    filter,
    search: String(q || "").trim(),
    pageNumber: page,
    pageSize,
    financeEnabledOnly: true,
  })
  if (res?.isSuccess === false) {
    throw new Error(res?.message || "Failed to load finance-enabled studies")
  }
  return normalizeApiPagedResponse(res, page)
}
