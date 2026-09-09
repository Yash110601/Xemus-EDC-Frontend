/** Resolve API row fields that may be camelCase or PascalCase. */
export function field(row, ...keys) {
  if (!row) return undefined
  for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && row[k] !== "") return row[k]
  }
  return undefined
}

export function fieldStr(row, keys, fallback = "—") {
  const v = field(row, ...keys)
  return v !== undefined && v !== null && String(v) !== "" ? String(v) : fallback
}

export function mapDropdownItems(res) {
  if (!res?.isSuccess || !res.data) return []
  const raw = res.data
  const list = Array.isArray(raw) ? raw : raw.items ?? raw.Items ?? []
  if (!Array.isArray(list)) return []
  return list.map((x) => ({
    id: x.id ?? x.Id,
    name: x.name ?? x.Name ?? "",
  }))
}
