/** Extract query ID from create-query API response. */
export function pickQueryIdFromResponse(res) {
  const data = res?.data
  if (!data || typeof data !== "object") return null
  const raw = data.id ?? data.Id ?? data.queryId ?? data.QueryId
  const parsed = Number.parseInt(String(raw ?? ""), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}
