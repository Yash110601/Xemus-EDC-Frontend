/**
 * Hard caps for paged dropdown / list APIs (backend scale redesign).
 * Same old URLs — responses are ScalePagedResultDto: { items, pageNumber, pageSize, totalCount, totalPages, truncated }.
 * Do not request unbounded pageSize.
 */

export const DROPDOWN_PAGE_SIZE = 30
export const DROPDOWN_PAGE_SIZE_MAX = 30
export const LIST_PAGE_SIZE_MAX = 50
export const CRF_PAGE_DEFAULT = 30
export const CRF_PAGE_MAX = 50
export const DROPDOWN_SEARCH_DEBOUNCE_MS = 300
/** Prefetch next page when user scrolls past this many visible rows. */
export const DROPDOWN_PREFETCH_AT_INDEX = 20

/** @deprecated Use DROPDOWN_PAGE_SIZE */
export const LOOKUP_TAKE_DEFAULT = DROPDOWN_PAGE_SIZE
/** @deprecated Use DROPDOWN_PAGE_SIZE_MAX */
export const LOOKUP_TAKE_MAX = DROPDOWN_PAGE_SIZE_MAX
/** @deprecated Use DROPDOWN_PAGE_SIZE */
export const LOOKUP_TAKE_STUDIES = DROPDOWN_PAGE_SIZE
/** @deprecated Use DROPDOWN_PAGE_SIZE */
export const LOOKUP_TAKE_SITES = DROPDOWN_PAGE_SIZE
/** @deprecated Use DROPDOWN_PAGE_SIZE */
export const LOOKUP_TAKE_PATIENTS = DROPDOWN_PAGE_SIZE
/** @deprecated Use CRF_PAGE_DEFAULT */
export const CRF_ENTRY_PATIENTS_PAGE_DEFAULT = CRF_PAGE_DEFAULT
/** @deprecated Use CRF_PAGE_MAX */
export const CRF_ENTRY_PATIENTS_PAGE_MAX = CRF_PAGE_MAX
/** @deprecated Use DROPDOWN_SEARCH_DEBOUNCE_MS */
export const LOOKUP_SEARCH_DEBOUNCE_MS = DROPDOWN_SEARCH_DEBOUNCE_MS

export const CAP_ERROR_CODES = Object.freeze([
  "ListPageSizeExceeded",
  "LookupTakeExceeded",
  "StudiesDropdownTooLarge",
])

export function clampPageSize(pageSize, fallback = DROPDOWN_PAGE_SIZE, max = DROPDOWN_PAGE_SIZE_MAX) {
  const n = Number.parseInt(String(pageSize ?? fallback), 10)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(n, max)
}

/** @deprecated Prefer clampPageSize */
export function clampTake(take, fallback = DROPDOWN_PAGE_SIZE, max = DROPDOWN_PAGE_SIZE_MAX) {
  return clampPageSize(take, fallback, max)
}

/**
 * Normalize ScalePagedResultDto.
 * Prefer `data.items` (never treat paged payload as a bare array for paging).
 * hasMore = truncated || pageNumber < totalPages (do not guess from page length).
 * @returns {{ items: any[], pageNumber: number, pageSize: number, totalCount: number, totalPages: number, truncated: boolean, hasMore: boolean }}
 */
export function normalizePagedPayload(data) {
  if (Array.isArray(data)) {
    return {
      items: data,
      totalCount: data.length,
      pageNumber: 1,
      pageSize: data.length,
      totalPages: 1,
      truncated: false,
      hasMore: false,
    }
  }
  if (!data || typeof data !== "object") {
    return {
      items: [],
      totalCount: 0,
      pageNumber: 1,
      pageSize: 0,
      totalPages: 0,
      truncated: false,
      hasMore: false,
    }
  }
  const items =
    data.items ||
    data.Items ||
    data.results ||
    data.Results ||
    data.studies ||
    data.Studies ||
    data.patients ||
    data.Patients ||
    data.users ||
    data.Users ||
    data.sites ||
    data.Sites ||
    []
  const list = Array.isArray(items) ? items : []
  const pageNumber = Number(data.pageNumber ?? data.PageNumber ?? 1) || 1
  const pageSize = Number(data.pageSize ?? data.PageSize ?? list.length) || list.length
  const totalCount =
    Number(data.totalCount ?? data.TotalCount ?? data.totalRecords ?? data.TotalRecords ?? list.length) || 0
  const totalPages =
    Number(data.totalPages ?? data.TotalPages) ||
    (pageSize > 0 ? Math.ceil(totalCount / pageSize) : 0)
  const truncated = Boolean(data.truncated ?? data.Truncated ?? false)
  // Prefer explicit totals; also treat totalCount past this page as hasMore
  const hasMore =
    truncated ||
    (totalPages > 0 && pageNumber < totalPages) ||
    (totalCount > 0 && pageSize > 0 && pageNumber * pageSize < totalCount)
  return { items: list, totalCount, pageNumber, pageSize, totalPages, truncated, hasMore }
}

/** Normalize apiClient response — supports ScalePagedResultDto or legacy bare arrays in `data`. */
export function normalizeApiPagedResponse(res, page = 1) {
  const normalized = normalizePagedPayload(res?.data ?? res)
  return {
    items: normalized.items,
    pageNumber: normalized.pageNumber ?? page,
    totalPages: normalized.totalPages,
    truncated: normalized.truncated,
    hasMore: normalized.hasMore,
  }
}

/** @deprecated Prefer normalizePagedPayload — Lookup APIs removed */
export function normalizeLookupPayload(data) {
  const paged = normalizePagedPayload(data)
  return {
    items: paged.items,
    take: paged.pageSize,
    hasMore: paged.hasMore,
  }
}

export function isCapError(responseOrError) {
  const code =
    responseOrError?.errorCode ||
    responseOrError?.ErrorCode ||
    responseOrError?.code ||
    responseOrError?.data?.errorCode ||
    ""
  const msg = String(responseOrError?.message || responseOrError?.Message || "")
  if (CAP_ERROR_CODES.includes(String(code))) return true
  return /ListPageSizeExceeded|LookupTakeExceeded|StudiesDropdownTooLarge|pageSize|take/i.test(msg)
}

export function getCapErrorMessage(responseOrError) {
  const msg = String(responseOrError?.message || responseOrError?.Message || "").trim()
  if (msg) return msg
  return "Request exceeds allowed page size. Refine your search."
}
