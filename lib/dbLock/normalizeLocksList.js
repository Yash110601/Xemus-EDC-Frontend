function pick(raw, ...keys) {
  if (!raw || typeof raw !== "object") return null
  for (const key of keys) {
    if (raw[key] != null && raw[key] !== "") return raw[key]
  }
  return null
}

export function normalizeLockListItem(raw) {
  if (!raw || typeof raw !== "object") return null

  return {
    id: pick(raw, "id", "Id"),
    level: String(pick(raw, "level", "Level") ?? "").toLowerCase(),
    studyId: pick(raw, "studyId", "StudyId"),
    siteId: pick(raw, "siteId", "SiteId"),
    siteName: String(pick(raw, "siteName", "SiteName") ?? ""),
    crfDataId: pick(raw, "crfDataId", "CrfDataId"),
    crfDesignId: pick(raw, "crfDesignId", "CrfDesignId"),
    crfDesignName: String(pick(raw, "crfDesignName", "CrfDesignName") ?? ""),
    patientIdentifier: String(pick(raw, "patientIdentifier", "PatientIdentifier") ?? ""),
    visitTypeName: String(pick(raw, "visitTypeName", "VisitTypeName") ?? ""),
    sectionKey: String(pick(raw, "sectionKey", "SectionKey") ?? ""),
    sectionLabel: String(pick(raw, "sectionLabel", "SectionLabel") ?? ""),
    fieldKey: String(pick(raw, "fieldKey", "FieldKey") ?? ""),
    fieldLabel: String(pick(raw, "fieldLabel", "FieldLabel") ?? ""),
    isLocked: Boolean(pick(raw, "isLocked", "IsLocked") ?? true),
    lockedAt: pick(raw, "lockedAt", "LockedAt"),
    lockedBy: pick(raw, "lockedBy", "LockedBy"),
    lockedByName: String(pick(raw, "lockedByName", "LockedByName") ?? ""),
  }
}

export function normalizeStudyLockSummary(raw) {
  if (!raw || typeof raw !== "object") return null
  const isLocked = Boolean(pick(raw, "isLocked", "IsLocked"))
  if (!isLocked) return null

  return {
    studyId: pick(raw, "studyId", "StudyId"),
    level: "study",
    isLocked: true,
    lockedAt: pick(raw, "lockedAt", "LockedAt"),
    lockedBy: pick(raw, "lockedBy", "LockedBy"),
    lockedByName: String(pick(raw, "lockedByName", "LockedByName") ?? ""),
  }
}

export function normalizeLocksListResponse(raw) {
  const data = raw?.data ?? raw ?? {}
  const rawItems = Array.isArray(data.items)
    ? data.items
    : Array.isArray(data.Items)
      ? data.Items
      : []

  const items = rawItems.map(normalizeLockListItem).filter(Boolean)

  return {
    studyLock: normalizeStudyLockSummary(data.studyLock ?? data.StudyLock),
    items,
    pageNumber: Number(data.pageNumber ?? data.PageNumber ?? 1) || 1,
    pageSize: Number(data.pageSize ?? data.PageSize ?? 20) || 20,
    totalCount: Number(data.totalCount ?? data.TotalCount ?? items.length) || 0,
    totalPages: Number(data.totalPages ?? data.TotalPages ?? 1) || 1,
  }
}

/** Map a list row (or studyLock summary) to POST /DatabaseLock/Release body. */
export function buildReleasePayloadFromLockRow(row, studyId) {
  const sid = Number.parseInt(String(studyId ?? row?.studyId ?? ""), 10)
  const level = String(row?.level ?? "").toLowerCase()
  const payload = { studyId: sid, level }

  if (level === "site") {
    payload.siteId = row.siteId
  }
  if (level === "crf" || level === "section" || level === "field") {
    payload.crfDataId = row.crfDataId
  }
  if (level === "section" || level === "field") {
    payload.sectionKey = row.sectionKey
  }
  if (level === "field") {
    payload.fieldKey = row.fieldKey
  }

  return payload
}
