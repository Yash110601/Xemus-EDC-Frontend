/** CDASH Report — filter params + summary/field row normalization. */

export const CDASH_REPORT_INITIAL_FILTERS = {
  studyId: "",
  siteId: "",
  patientEnrolmentId: "",
  crfDesignId: "",
  visitScheduleId: "",
  search: "",
  isMapped: "",
  pageNumber: 1,
  pageSize: 50,
}

function pickDto(raw, ...keys) {
  if (!raw || typeof raw !== "object") return undefined
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null) return raw[key]
  }
  return undefined
}

function parsePositiveInt(value) {
  const n = parseInt(String(value ?? ""), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Shared report/export filters — visitScheduleId=0 means all visits (eCRF export parity). */
export function buildCdashReportApiParams(filters = {}) {
  const params = {}
  const studyId = parsePositiveInt(filters?.studyId)
  if (!studyId) return params

  params.studyId = studyId

  const visitScheduleIdNum = parseInt(String(filters?.visitScheduleId ?? ""), 10)
  if (Number.isFinite(visitScheduleIdNum) && visitScheduleIdNum > 0) {
    params.visitScheduleId = visitScheduleIdNum
  } else {
    params.visitScheduleId = 0
  }

  const siteId = parsePositiveInt(filters?.siteId)
  if (siteId) params.siteId = siteId

  const patientEnrolmentId = parsePositiveInt(filters?.patientEnrolmentId)
  if (patientEnrolmentId) params.patientEnrolmentId = patientEnrolmentId

  const crfDesignId = parsePositiveInt(filters?.crfDesignId)
  if (crfDesignId) params.crfDesignId = crfDesignId

  return params
}

/** Field report query params — paging + optional isMapped / search. */
export function buildCdashFieldReportApiParams(filters = {}) {
  const params = buildCdashReportApiParams(filters)

  const pageNumber = parseInt(String(filters.pageNumber ?? 1), 10)
  const pageSize = parseInt(String(filters.pageSize ?? 50), 10)
  params.pageNumber = Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1
  params.pageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 200) : 50

  const search = String(filters.search ?? "").trim()
  if (search) params.search = search

  const isMapped = String(filters.isMapped ?? "").trim()
  if (isMapped === "true" || isMapped === "false") {
    params.isMapped = isMapped === "true"
  }

  return params
}

/** Field detail CSV export — same filters as FieldReport grid (no pagination). */
export function buildCdashFieldReportExportParams(filters = {}) {
  return buildCdashMappingDetailExportParams(filters)
}

/** Detail CSV / ZIP detail file — same filters as field report without pagination. */
export function buildCdashMappingDetailExportParams(filters = {}) {
  const params = buildCdashReportApiParams(filters)

  const search = String(filters.search ?? "").trim()
  if (search) params.search = search

  const isMapped = String(filters.isMapped ?? "").trim()
  if (isMapped === "true" || isMapped === "false") {
    params.isMapped = isMapped === "true"
  }

  return params
}

/** ZIP export — summary filters + field-detail filters when provided. */
export function buildCdashMappingZipExportParams(filters = {}, { includeFieldDetailFilters = false } = {}) {
  if (!includeFieldDetailFilters) {
    return buildCdashReportApiParams(filters)
  }
  return buildCdashMappingDetailExportParams(filters)
}

export function normalizeCdashReportSummaryRow(raw) {
  if (!raw || typeof raw !== "object") return null
  return {
    crfDesignId: Number(pickDto(raw, "crfDesignId", "CrfDesignId") ?? 0),
    crfDesignName: String(
      pickDto(raw, "crfDesignName", "CrfDesignName", "crfName", "CrfName") ?? "",
    ).trim(),
    visitType: String(
      pickDto(
        raw,
        "visitTypeName",
        "VisitTypeName",
        "visitType",
        "VisitType",
        "visitName",
        "VisitName",
      ) ?? "",
    ).trim(),
    totalFields: Number(
      pickDto(raw, "totalFieldCount", "TotalFieldCount", "totalFields", "TotalFields") ?? 0,
    ),
    mappedFields: Number(
      pickDto(raw, "mappedFieldCount", "MappedFieldCount", "mappedFields", "MappedFields", "mapped", "Mapped") ?? 0,
    ),
    pendingFields: Number(
      pickDto(raw, "pendingFieldCount", "PendingFieldCount", "pendingFields", "PendingFields", "pending", "Pending") ?? 0,
    ),
  }
}

export function normalizeCdashFieldReportRow(raw) {
  if (!raw || typeof raw !== "object") return null
  const mappedRaw = pickDto(raw, "isMapped", "IsMapped")
  const fieldDisplayName = String(
    pickDto(raw, "fieldDisplayName", "FieldDisplayName") ?? "",
  ).trim()

  return {
    crfDesignName: String(pickDto(raw, "crfDesignName", "CrfDesignName") ?? "").trim(),
    visitTypeName: String(pickDto(raw, "visitTypeName", "VisitTypeName") ?? "").trim(),
    sectionName: String(pickDto(raw, "sectionName", "SectionName") ?? "").trim(),
    fieldDisplayName,
    isMapped: mappedRaw === true || mappedRaw === "true",
    domainCode: pickDto(raw, "domainCode", "DomainCode") ?? null,
    cdashVariableName: pickDto(raw, "cdashVariableName", "CdashVariableName") ?? null,
  }
}

export function normalizeCdashReportSummaryPayload(raw) {
  if (!raw) return { items: [] }
  if (Array.isArray(raw)) {
    return { items: raw.map(normalizeCdashReportSummaryRow).filter(Boolean) }
  }
  const itemsRaw = pickDto(raw, "items", "Items", "rows", "Rows") ?? []
  return {
    studyId: Number(pickDto(raw, "studyId", "StudyId") ?? 0),
    studyProtocolNumber: String(pickDto(raw, "studyProtocolNumber", "StudyProtocolNumber") ?? "").trim(),
    items: (Array.isArray(itemsRaw) ? itemsRaw : [])
      .map(normalizeCdashReportSummaryRow)
      .filter(Boolean),
  }
}

export function normalizeCdashFieldReportPage(response) {
  const data = response?.data?.data ?? response?.data ?? response?.Data ?? {}
  const itemsRaw = data.items ?? data.Items ?? []
  return {
    items: (Array.isArray(itemsRaw) ? itemsRaw : [])
      .map(normalizeCdashFieldReportRow)
      .filter(Boolean),
    pageNumber: Number(data.pageNumber ?? data.PageNumber ?? 1) || 1,
    pageSize: Number(data.pageSize ?? data.PageSize ?? 50) || 50,
    totalCount: Number(data.totalCount ?? data.TotalCount ?? 0) || 0,
    totalPages: Number(data.totalPages ?? data.TotalPages ?? 0) || 0,
  }
}

export function formatCdashMappedLabel(isMapped) {
  if (isMapped === true) return "Yes"
  if (isMapped === false) return "No"
  return "—"
}

export function isStudyCdashEnabledOnDto(study) {
  if (!study || typeof study !== "object") return null
  if (study.isCdashEnabled === true || study.IsCdashEnabled === true) return true
  if (study.isCdashEnabled === false || study.IsCdashEnabled === false) return false
  return null
}

export function toReportCell(value) {
  if (value === null || value === undefined || value === "") return "—"
  return String(value)
}

/** User-facing API error for CDASH report load/export. */
export function resolveCdashReportErrorMessage(res, fallback = "Request failed.") {
  const status = res?.statusCode ?? res?.httpStatus
  const message = String(res?.message ?? "").trim()
  if (status === 403) {
    return "You don't have permission to view CDASH report."
  }
  if (status === 400 && /cdash is not enabled/i.test(message)) {
    return "CDASH is not enabled for this study."
  }
  return message || fallback
}
