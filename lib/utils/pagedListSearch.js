/**
 * Shared local-first search helpers for paged study/site dropdowns.
 */

export function mergeUniqueById(prev, next, getId) {
  const seen = new Set(prev.map((x) => String(getId(x))))
  const out = [...prev]
  for (const item of next) {
    const id = String(getId(item) ?? "")
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(item)
  }
  return out
}

export function filterListByNeedle(list, needle, getSearchValues) {
  const q = String(needle || "").trim().toLowerCase()
  if (!q) return list
  return list.filter((item) =>
    getSearchValues(item).some((value) => String(value || "").toLowerCase().includes(q)),
  )
}
