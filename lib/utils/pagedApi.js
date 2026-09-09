/**
 * Normalize paged list payloads from ApiResponse (camelCase or PascalCase).
 */
export function unwrapPagedPayload(data) {
  if (!data || typeof data !== "object") {
    return { items: [], totalCount: 0, totalPages: 0 }
  }
  const items = data.items ?? data.Items ?? []
  const totalCount = data.totalCount ?? data.TotalCount ?? 0
  const totalPages = data.totalPages ?? data.TotalPages ?? 0
  return {
    items: Array.isArray(items) ? items : [],
    totalCount: Number(totalCount) || 0,
    totalPages: Number(totalPages) || 0,
  }
}
