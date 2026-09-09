import reportsService from "@/lib/services/reports.service"

const DEFAULT_PAGE_SIZE = 200
const MAX_PAGES = 100

/**
 * Loads all audit-trail-with-reason rows for the given filters (paginated).
 * @param {Record<string, string|number>} filters - studyId, siteId, patientId, visitId, crfId, crfDataId, module, etc.
 */
export async function fetchCrfAuditTrailRows(filters = {}) {
  const pageSize = DEFAULT_PAGE_SIZE
  const all = []
  let pageNumber = 1
  let totalCount = 0

  while (pageNumber <= MAX_PAGES) {
    const response = await reportsService.getAuditTrailWithReasonReport({
      ...filters,
      pageNumber,
      pageSize,
    })
    const data = response?.data || {}
    const items = Array.isArray(data?.items) ? data.items : []
    totalCount = Number(data?.totalCount || 0)
    all.push(...items)
    if (items.length < pageSize || all.length >= totalCount) break
    pageNumber += 1
  }

  return all
}
