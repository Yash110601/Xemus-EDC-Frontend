/** Parse visit schedule IDs from payment rule API payloads. */
export function parseVisitScheduleIdsFromRule(rule) {
  if (!rule || typeof rule !== "object") return []

  const direct =
    rule.visitScheduleIds ??
    rule.VisitScheduleIds ??
    rule.requiredVisitScheduleIds ??
    rule.RequiredVisitScheduleIds

  if (Array.isArray(direct)) {
    return direct.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
  }

  const json =
    rule.requiredVisitScheduleIdsJson ??
    rule.RequiredVisitScheduleIdsJson ??
    rule.patientFilterJson ??
    rule.PatientFilterJson

  if (typeof json === "string" && json.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(json)
      if (Array.isArray(parsed)) {
        return parsed.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
      }
    } catch {
      return []
    }
  }

  return []
}

export function normalizeVisitScheduleIds(ids = []) {
  return [...new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0))].sort(
    (a, b) => a - b,
  )
}

export function visitScheduleIdsEqual(a = [], b = []) {
  const left = normalizeVisitScheduleIds(a)
  const right = normalizeVisitScheduleIds(b)
  if (left.length !== right.length) return false
  return left.every((id, index) => id === right[index])
}
