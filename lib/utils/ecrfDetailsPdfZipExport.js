/**
 * Bulk eCRF PDF export as ZIP: one folder per patient, one PDF per submitted CRF only (filled data).
 * Honors the same filter dimensions as the CSV export where the CRF Data API supports them.
 */

import JSZip from "jszip"
import {
  authService,
  crfDataService,
  crfDesignService,
  visitAttachmentsService,
  siteService,
  studyService,
} from "@/lib/services"
import reportsService from "@/lib/services/reports.service"
import piSignoffService from "@/lib/services/piSignoff.service"
import { fetchStudySettingsByStudyId, pickIsPiSignoffRequired } from "@/lib/utils/studySettingsRead"
import { buildEcrfDetailsPdfBundlePayload } from "@/lib/utils/ecrfDetailsExportParams"
import { getDefaultCrfOrgMeta } from "@/lib/config/orgBranding"
import { generateCrfEntryPdfBlob } from "@/lib/utils/crfEntryPdf"
import { buildPrintedInfoFromUser } from "@/lib/utils/reportGeneratedMeta"
import { CRF_PDF_DEFAULT_LAYOUT_OPTIONS } from "@/lib/utils/crfPdfTheme"
import {
  buildPdfSectionsForExport,
  flattenCrfFormData,
} from "@/lib/utils/crfPdfSectionsBuilder"
import {
  VISIT_ATTACHMENT_ZIP_MAX_FILE_BYTES,
} from "@/lib/utils/visitAttachmentsZipExport"
import {
  mapVisitTypeEnumToLabel,
  mapVisitTypeLabelToEnum,
} from "@/lib/visitTypes"

/**
 * Canonicalise any visit-type identifier coming from a CRF data record
 * (enum number, stringified enum, canonical label, concatenated label or
 * slug) to the same label the on-screen system shows — e.g. "Study
 * Completion Form" for enum 8, "Patient Feedback Form" for enum 7. Returns
 * an empty string if no candidate resolves to a known visit type so the
 * caller can fall through to its own fallback.
 */
function resolveVisitTypeLabelFromRecord(record) {
  if (!record || typeof record !== "object") return ""
  const candidates = [
    record.visitTypeId,
    record.VisitTypeId,
    record.visitType,
    record.VisitType,
    record.visitTypeName,
    record.VisitTypeName,
    record.crfFormType,
    record.CrfFormType,
  ]
  for (const c of candidates) {
    if (c == null || c === "") continue
    const fromEnum = mapVisitTypeEnumToLabel(c)
    if (fromEnum) return fromEnum
    const fromLabelOrSlug = mapVisitTypeEnumToLabel(mapVisitTypeLabelToEnum(c))
    if (fromLabelOrSlug) return fromLabelOrSlug
  }
  return ""
}

/** Browser-side cap (~1 CRF = 2 API calls + jsPDF + ZIP RAM). Increase only if you accept long tabs / memory spikes. For very large studies use backend bulk export. */
export const ECRF_PDF_ZIP_MAX_RECORDS = 1000
export const ECRF_EXPORT_NO_DATA_CODE = "ECRF_EXPORT_NO_DATA"

/** Matches manual entry: 1=Draft, 2=Saved, 3=Submitted */
const CRF_STATUS_SUBMITTED = 3

/**
 * @param {object} r — list row or getCrfDataById payload
 * @returns {boolean}
 */
function isSubmittedCrfRecord(r) {
  if (!r || typeof r !== "object") return false
  const raw = r.status ?? r.statusValue ?? r.crfDataStatus ?? r.formStatus
  const n = (r.statusName ?? r.statusText ?? r.crfStatus ?? "").toString().trim().toLowerCase()
  if (raw === CRF_STATUS_SUBMITTED || raw === String(CRF_STATUS_SUBMITTED)) return true
  if (typeof raw === "string" && raw.trim().toLowerCase() === "submitted") return true
  if (n === "submitted") return true
  return false
}

function sanitizePathSegment(s, fallback = "unknown") {
  const raw = (s == null || s === "" ? fallback : String(s))
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
  return raw.slice(0, 80) || fallback
}

/** PDF filename: keep spaces/hyphens like UI; strip only Windows-forbidden chars. */
function sanitizeWindowsFileName(name, maxLen = 180) {
  const raw = String(name ?? "export")
    .replace(/[/\\?%*:|"<>]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim()
  const base = raw.slice(0, maxLen).replace(/[.\s]+$/, "")
  return base || "export"
}

function isUploadedVisitAttachment(att) {
  const s = att?.status ?? att?.Status
  if (s == null) return true // be permissive if backend doesn't send status
  return s === 2 || s === "Uploaded"
}

function getVisitAttachmentId(att) {
  return att?.attachmentId ?? att?.id ?? att?.guid ?? null
}

function getVisitAttachmentSizeBytes(att) {
  const n = att?.fileSizeBytes ?? att?.fileSize ?? att?.FileSizeBytes ?? null
  if (n == null) return null
  const v = typeof n === "number" ? n : parseInt(String(n), 10)
  return Number.isFinite(v) ? v : null
}

function hasFileExtension(fileName) {
  const s = String(fileName ?? "")
  return /\.[a-zA-Z0-9]{1,10}$/.test(s.trim())
}

function extensionFromContentType(contentType) {
  const ct = String(contentType ?? "").toLowerCase()
  if (!ct) return null
  if (ct.includes("pdf")) return "pdf"
  if (ct.includes("zip")) return "zip"
  if (ct.includes("mp4")) return "mp4"
  if (ct.includes("quicktime") || ct.includes("mov")) return "mov"
  if (ct.includes("jpeg")) return "jpg"
  if (ct.includes("jpg")) return "jpg"
  if (ct.includes("png")) return "png"
  if (ct.includes("image/")) {
    const sub = ct.split("image/")[1]?.trim()
    if (sub) return sub.replace(/[^a-z0-9]/gi, "")
  }
  return null
}

function extensionFromAttachmentDto(att) {
  // attachmentType: 1 Dicom, 2 Video, 3 Image, 4 Pdf (per backend spec)
  const type = att?.attachmentType ?? att?.AttachmentType
  const ct = att?.contentType ?? att?.ContentType

  const fromMime = extensionFromContentType(ct)
  if (fromMime) return fromMime

  if (type === 4) return "pdf"
  if (type === 2) return "mp4"
  if (type === 3) return "png"
  if (type === 1) {
    return ct && String(ct).toLowerCase().includes("zip") ? "zip" : "dcm"
  }
  return null
}

/** Let the browser paint / handle input between heavy PDF steps (export feels "background"). */
async function yieldToMain() {
  await new Promise((resolve) => {
    if (typeof requestAnimationFrame !== "undefined") {
      requestAnimationFrame(() => resolve())
    } else {
      setTimeout(resolve, 0)
    }
  })
}

function printedInfoFromAuth(extras = {}) {
  const currentUser = authService.getUser?.() || null
  return buildPrintedInfoFromUser(currentUser, extras)
}

/**
 * Normalize bundle payload from API (PascalCase / nested `data` variants).
 * @param {object} raw — apiClient `data` field or nested envelope
 */
/**
 * Top-level ZIP folder for study: always prefer **protocol / study number** (clinical convention).
 */
function studyFolderSegmentFromStudyObject(study, studyIdFallback) {
  const proto =
    study?.studyProtocolNumber ??
    study?.StudyProtocolNumber ??
    study?.protocolNumber ??
    study?.ProtocolNumber ??
    study?.studyProtocolNo ??
    study?.protocolNo ??
    study?.studyNumber ??
    study?.studyNo
  if (proto != null && String(proto).trim() !== "") {
    // Prefer protocol number with a stable prefix for CRA-friendly ZIP paths.
    return sanitizePathSegment(`study-${String(proto).trim()}`, `study-${studyIdFallback}`)
  }
  const title =
    study?.studyTitle ??
    study?.StudyTitle ??
    study?.title ??
    study?.studyName ??
    study?.name
  if (title != null && String(title).trim() !== "") {
    return sanitizePathSegment(`study-${String(title).trim()}`, `study-${studyIdFallback}`)
  }
  if (studyIdFallback != null && studyIdFallback > 0) {
    return sanitizePathSegment(`study-${studyIdFallback}`, "study")
  }
  return "study"
}

/**
 * Site folder: **site name** first for CRA-friendly paths; codes/IDs as fallback.
 */
function siteFolderSegmentFromRecord(record, siteDefaults, filterSiteId) {
  const raw =
    record?.siteName ||
    record?.SiteName ||
    record?.siteFullName ||
    record?.SiteFullName ||
    record?.site?.siteName ||
    record?.site?.siteFullName ||
    siteDefaults?.siteName ||
    siteDefaults?.SiteName ||
    siteDefaults?.siteFullName ||
    siteDefaults?.SiteFullName ||
    record?.siteCode ||
    record?.siteNumber ||
    siteDefaults?.siteCode ||
    siteDefaults?.siteNumber ||
    (record?.siteId != null ? `SiteID_${record.siteId}` : null) ||
    (Number.isFinite(filterSiteId) && filterSiteId > 0 ? `SiteID_${filterSiteId}` : null)
  if (raw == null || String(raw).trim() === "") return "site"
  return sanitizePathSegment(`site-${String(raw).trim()}`, "site")
}

/** Pull study/site hints embedded on CRF list/detail rows (bundle or legacy). */
function mergeStudySiteHintsFromRecords(records, study, siteDefaults) {
  const nextStudy = { ...study }
  const nextSite = { ...siteDefaults }
  const sample = records.slice(0, 12)
  for (const r of sample) {
    const sp =
      r?.studyProtocolNumber ??
      r?.StudyProtocolNumber ??
      r?.studyProtocolNo ??
      r?.protocolNumber ??
      r?.ProtocolNumber ??
      r?.protocolNo
    if (sp && !nextStudy.studyProtocolNumber && !nextStudy.protocolNumber) {
      nextStudy.studyProtocolNumber = sp
    }
    const sn =
      r?.siteName ??
      r?.SiteName ??
      r?.site?.siteName ??
      r?.siteFullName ??
      r?.SiteFullName ??
      r?.site?.siteFullName
    if (sn && !nextSite.siteName && !nextSite.siteFullName) {
      nextSite.siteName = sn
    }
  }
  return { study: nextStudy, siteDefaults: nextSite }
}

/**
 * When bundle omits study/site DTOs, load once for path + PDF header (minimal round-trips).
 */
async function resolveStudyAndSiteForZipExport(studyId, filterSiteId, studyDetails, siteDetails, records) {
  let study = { ...(studyDetails && typeof studyDetails === "object" ? studyDetails : {}) }
  let siteDefaults = { ...(siteDetails && typeof siteDetails === "object" ? siteDetails : {}) }

  const hinted = mergeStudySiteHintsFromRecords(records, study, siteDefaults)
  study = hinted.study
  siteDefaults = hinted.siteDefaults

  const missingStudyMeta = !(
    study.studyProtocolNumber ||
    study.StudyProtocolNumber ||
    study.protocolNumber ||
    study.ProtocolNumber ||
    study.studyNo ||
    study.studyNumber
  ) || !(
    study.studyTitle ||
    study.StudyTitle ||
    study.title ||
    study.studyName ||
    study.name
  )

  if (missingStudyMeta && studyId) {
    const res = await studyService.getStudyById(studyId)
    const d = res?.data
    if (res?.isSuccess && d && typeof d === "object") {
      study = { ...study, ...d }
    }
  }

  const needSiteFromApi =
    Number.isFinite(filterSiteId) &&
    filterSiteId > 0 &&
    !(siteDefaults.siteName || siteDefaults.siteFullName)
  if (needSiteFromApi) {
    const res = await siteService.getSiteById(filterSiteId)
    const d = res?.data
    if (res?.isSuccess && d && typeof d === "object") {
      siteDefaults = { ...siteDefaults, ...d }
    }
  }

  const studyFolder = studyFolderSegmentFromStudyObject(study, studyId)
  return { study, siteDefaults, studyFolder }
}

function normalizeEcrfExportBundle(raw) {
  if (!raw || typeof raw !== "object") {
    return {
      records: [],
      designsById: {},
      study: {},
      site: {},
      visitsById: {},
      meta: {},
    }
  }
  let b = raw
  if (
    b.data &&
    typeof b.data === "object" &&
    (Array.isArray(b.data.records) ||
      Array.isArray(b.data.Records) ||
      b.data.designsById ||
      b.data.DesignsById)
  ) {
    b = b.data
  }
  const records = b.records ?? b.Records ?? b.items ?? b.Items ?? []
  return {
    records: Array.isArray(records) ? records : [],
    designsById: b.designsById ?? b.DesignsById ?? {},
    study: b.study ?? b.Study ?? {},
    site: b.site ?? b.Site ?? {},
    visitsById: b.visitsById ?? b.VisitsById ?? {},
    meta: b.meta ?? b.Meta ?? {},
  }
}

/** Build a readable error from normalized apiClient failure (ASP.NET ProblemDetails + API envelope). */
function formatEcrfBundleApiError(bundleRes) {
  const parts = []
  if (bundleRes?.httpStatus != null) parts.push(`HTTP ${bundleRes.httpStatus}`)
  if (bundleRes?.title && bundleRes.title !== bundleRes?.message) parts.push(String(bundleRes.title))
  if (bundleRes?.message) parts.push(String(bundleRes.message))
  if (bundleRes?.detail) parts.push(String(bundleRes.detail))
  if (bundleRes?.traceId) parts.push(`TraceId: ${bundleRes.traceId}`)
  if (Array.isArray(bundleRes?.errors) && bundleRes.errors.length > 0) {
    const e = bundleRes.errors.filter(Boolean).join("; ")
    if (e) parts.push(e)
  }
  return parts.filter(Boolean).join(" — ") || "Failed to generate eCRF export bundle."
}

/** Paginated GetCrfDataList for submitted CRFs only (status = 3). */
async function fetchAllSubmittedCrfListRows(studyId, patientEnrolmentId, crfDesignId, onProgress) {
  const pageSize = 100
  let pageNumber = 1
  const all = []
  while (true) {
    onProgress?.({
      phase: "legacy-list",
      message: `Loading submitted CRF list (page ${pageNumber})…`,
    })
    const res = await crfDataService.getCrfDataList(
      pageNumber,
      pageSize,
      studyId,
      patientEnrolmentId ?? null,
      crfDesignId ?? null,
      CRF_STATUS_SUBMITTED,
      true
    )
    if (!res?.isSuccess || !res.data) break
    const items = res.data.items || res.data.Items || []
    all.push(...items)
    const totalPages = res.data.totalPages ?? res.data.TotalPages
    if (items.length < pageSize) break
    if (totalPages != null && pageNumber >= totalPages) break
    pageNumber += 1
    if (pageNumber > 500) break
    if (all.length > ECRF_PDF_ZIP_MAX_RECORDS) break
  }
  return all
}

/**
 * When bundle POST is missing or fails: list + get-by-id + design-by-id (same outcome as pre-bundle clients).
 */
async function loadEcrfExportViaLegacyApis(filters, studyId, onProgress) {
  const patientEnrolmentId = filters.patientEnrolmentId ? parseInt(String(filters.patientEnrolmentId), 10) : null
  const crfDesignFilter = filters.crfDesignId ? parseInt(String(filters.crfDesignId), 10) : null
  const visitScheduleFilter = filters.visitScheduleId ? parseInt(String(filters.visitScheduleId), 10) : null
  const siteFilter = filters.siteId ? parseInt(String(filters.siteId), 10) : null

  const listRows = await fetchAllSubmittedCrfListRows(
    studyId,
    Number.isFinite(patientEnrolmentId) && patientEnrolmentId > 0 ? patientEnrolmentId : null,
    Number.isFinite(crfDesignFilter) && crfDesignFilter > 0 ? crfDesignFilter : null,
    onProgress
  )

  let rows = listRows.filter((r) => isSubmittedCrfRecord(r))

  if (Number.isFinite(visitScheduleFilter) && visitScheduleFilter > 0) {
    rows = rows.filter((r) => {
      const vid = r.visitScheduleId ?? r.visitSchedule?.id ?? r.visitScheduleID
      return vid != null && parseInt(String(vid), 10) === visitScheduleFilter
    })
  }
  if (Number.isFinite(siteFilter) && siteFilter > 0) {
    rows = rows.filter((r) => {
      const sid = r.siteId ?? r.site?.id ?? r.siteID
      return sid != null && parseInt(String(sid), 10) === siteFilter
    })
  }

  if (rows.length > ECRF_PDF_ZIP_MAX_RECORDS) {
    throw new Error(
      `Too many CRF records for browser export (${rows.length}). Max ${ECRF_PDF_ZIP_MAX_RECORDS}. Narrow filters.`
    )
  }

  const designIds = [
    ...new Set(
      rows
        .map((r) => r.crfDesignId ?? r.crfDesignID ?? r.crfDesign?.id)
        .filter((id) => id != null && parseInt(String(id), 10) > 0)
        .map((id) => parseInt(String(id), 10))
    ),
  ]

  const designsById = {}
  for (let i = 0; i < designIds.length; i += 1) {
    const did = designIds[i]
    onProgress?.({
      phase: "legacy-design",
      message: `Loading CRF design ${i + 1} / ${designIds.length}…`,
    })
    const dres = await crfDesignService.getCrfDesignById(did, studyId)
    if (dres?.isSuccess && dres?.data) {
      designsById[String(did)] = dres.data
    }
    await yieldToMain()
  }

  const records = []
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]
    const crfDataId = row?.crfDataId ?? row?.crfDataID ?? row?.id
    if (!crfDataId) continue

    onProgress?.({
      phase: "legacy-detail",
      message: `Loading CRF data ${i + 1} / ${rows.length}…`,
      current: i + 1,
      total: rows.length,
    })

    const detailRes = await crfDataService.getCrfDataById(crfDataId, studyId)
    if (!detailRes?.isSuccess || !detailRes?.data) continue

    const detail = detailRes.data
    records.push({
      ...row,
      ...detail,
      crfDataId: detail.crfDataId ?? detail.id ?? crfDataId,
      formData: detail.formData ?? detail.formJson ?? row.formData ?? row.form,
    })
    await yieldToMain()
  }

  return {
    records,
    designsById,
    study: {},
    site: {},
    visitsById: {},
    meta: { totalRecords: records.length },
  }
}

/** @param {object} filters — same shape as export-ecrf-details page state */
export async function downloadEcrfDetailsPdfZip(filters, { onProgress } = {}) {
  const studyId = filters.studyId ? parseInt(filters.studyId, 10) : NaN
  if (!studyId || studyId <= 0) {
    throw new Error("Please select a study to export PDFs.")
  }

  const filterCrfDesignId = filters.crfDesignId ? parseInt(String(filters.crfDesignId), 10) : NaN
  const filterSiteId = filters.siteId ? parseInt(String(filters.siteId), 10) : NaN

  let isPiSignoffRequiredForStudy = false
  try {
    const settingsRes = await fetchStudySettingsByStudyId(studyId)
    isPiSignoffRequiredForStudy = pickIsPiSignoffRequired(settingsRes?.data ?? settingsRes)
  } catch {
    isPiSignoffRequiredForStudy = false
  }

  onProgress?.({ phase: "bundle", message: "Requesting eCRF export bundle…" })
  const payload = buildEcrfDetailsPdfBundlePayload(filters)

  let bundleRes = null
  try {
    bundleRes = await reportsService.exportEcrfDetailsExportBundle(payload)
  } catch (e) {
    bundleRes = { isSuccess: false, message: e?.message || String(e), data: null, httpStatus: 0 }
    if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
      console.warn("[eCRF PDF ZIP] Bundle request threw; will try legacy APIs.", e)
    }
  }

  let bundle = null
  if (bundleRes?.isSuccess && bundleRes?.data != null) {
    try {
      bundle = normalizeEcrfExportBundle(bundleRes.data)
    } catch (normErr) {
      bundle = null
      if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
        console.warn("[eCRF PDF ZIP] Bundle payload could not be normalized; trying legacy APIs.", normErr)
      }
    }
  } else if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
    console.warn("[eCRF PDF ZIP] Bundle unavailable or empty:", bundleRes)
  }

  let records = bundle?.records ?? []
  let designsById = bundle?.designsById ?? {}
  let studyDetails = bundle?.study ?? {}
  let siteDetails = bundle?.site ?? {}
  let visitsById = bundle?.visitsById ?? {}

  if (!Array.isArray(records) || records.length === 0) {
    onProgress?.({
      phase: "legacy",
      message: "Using per-record CRF APIs (bundle not available or returned no rows)…",
    })
    try {
      const legacy = await loadEcrfExportViaLegacyApis(filters, studyId, onProgress)
      records = legacy.records
      designsById = legacy.designsById
      studyDetails = legacy.study
      siteDetails = legacy.site
      visitsById = legacy.visitsById
    } catch (legacyErr) {
      const bundleMsg =
        bundleRes && !bundleRes.isSuccess ? formatEcrfBundleApiError(bundleRes) : "Bundle export unavailable."
      throw new Error(
        `${bundleMsg} Legacy export also failed: ${legacyErr?.message || String(legacyErr)}`
      )
    }
  }

  if (records.length === 0) {
    const bundleMsg =
      bundleRes && !bundleRes.isSuccess ? formatEcrfBundleApiError(bundleRes) : "No rows returned from bundle."
    const noDataError = new Error(
      `${bundleMsg} No submitted CRF data found for the selected filters (legacy list empty).`
    )
    noDataError.code = ECRF_EXPORT_NO_DATA_CODE
    throw noDataError
  }

  const totalRecords =
    bundle?.meta?.totalRecords ?? bundle?.meta?.TotalRecords ?? records.length
  if (totalRecords > ECRF_PDF_ZIP_MAX_RECORDS) {
    throw new Error(
      `Too many CRF records for browser export (${totalRecords}). Max ${ECRF_PDF_ZIP_MAX_RECORDS}. Narrow filters (site, patient, visit, or CRF design), or use a server-side bulk export.`
    )
  }

  onProgress?.({ phase: "meta", message: "Resolving study / site names for folders…" })
  await yieldToMain()
  const resolved = await resolveStudyAndSiteForZipExport(
    studyId,
    filterSiteId,
    studyDetails,
    siteDetails,
    records
  )
  studyDetails = resolved.study
  siteDetails = resolved.siteDefaults
  const studyFolderSegment = resolved.studyFolder

  const crfMeta = {
    ...getDefaultCrfOrgMeta(),
    studyNo:
      studyDetails?.studyProtocolNumber ||
      studyDetails?.StudyProtocolNumber ||
      studyDetails?.protocolNumber ||
      studyDetails?.ProtocolNumber ||
      studyDetails?.studyNo ||
      studyDetails?.name ||
      "",
    studyTitle:
      studyDetails?.studyTitle ||
      studyDetails?.StudyTitle ||
      studyDetails?.title ||
      studyDetails?.studyName ||
      studyDetails?.name ||
      "",
    siteNo:
      siteDetails?.siteNumber ||
      siteDetails?.siteNo ||
      siteDetails?.siteCode ||
      siteDetails?.siteName ||
      siteDetails?.SiteName ||
      siteDetails?.siteFullName ||
      siteDetails?.SiteFullName ||
      "",
    investigatorCode:
      siteDetails?.investigatorCode || siteDetails?.frontlineInvestigatorCode || "",
    investigatorName:
      siteDetails?.investigatorName || siteDetails?.frontlineInvestigatorName || siteDetails?.piName || "",
  }

  const zip = new JSZip()
  const printedInfo = printedInfoFromAuth()
  /** Avoid duplicate paths when one visit has multiple CRF designs */
  const usedPdfEntryKeys = new Set()
  const usedAttachmentEntryKeys = new Set()
  const visitAttachmentsListCache = new Map() // key: `${patientEnrolmentId}-${visitScheduleId}` => attachments[]
  const attachmentBlobCache = new Map() // key: attachmentId => { blob, fileName }
  let done = 0
  let pdfsAdded = 0

  for (const record of records) {
    await yieldToMain()

    const crfDataId = record?.crfDataId ?? record?.crfDataID ?? record?.id
    if (!crfDataId) {
      done += 1
      continue
    }

    if (!isSubmittedCrfRecord(record)) {
      done += 1
      continue
    }

    const designId =
      record?.crfDesignId ??
      record?.crfDesign?.id ??
      (Number.isFinite(filterCrfDesignId) && filterCrfDesignId > 0 ? filterCrfDesignId : null)
    if (!designId) {
      done += 1
      continue
    }

    const crfDesign = designsById[String(designId)] ?? designsById[designId]
    if (!crfDesign) {
      done += 1
      continue
    }

    onProgress?.({
      phase: "pdf",
      message: `Generating PDFs… ${done + 1} / ${records.length}`,
      current: done + 1,
      total: records.length,
    })

    const flat = flattenCrfFormData(record?.formData ?? record?.formJson ?? record?.form)
    const sections = buildPdfSectionsForExport(crfDesign, flat, "filled")

    const crfName =
      crfDesign.crfName || crfDesign.name || crfDesign.designName || crfDesign.config?.name || "CRF"

    const rowVisitScheduleId = record?.visitScheduleId ?? record?.visitSchedule?.id ?? null
    // Resolve the visit label the same way the on-screen system does so the
    // exported PDF shows e.g. "Study Completion Form" (enum 8) /
    // "Patient Feedback Form" (enum 7) instead of "Visit_<id>" when the
    // record lacks an explicit visitName (legacy API path, or rows where
    // only visitTypeId / crfFormType is populated).
    const derivedVisitTypeLabel = resolveVisitTypeLabelFromRecord(record)
    const visitName =
      record?.visitName ||
      (rowVisitScheduleId != null ? visitsById[String(rowVisitScheduleId)] : null) ||
      derivedVisitTypeLabel ||
      (rowVisitScheduleId != null ? `Visit_${rowVisitScheduleId}` : "Visit")

    const patientInitial = record?.patientInitial || record?.initial || ""
    const patientIdLabel =
      record?.patientDisplayId ||
      record?.patientDisplayID ||
      (record?.patientEnrolmentId != null ? `PID-${record.patientEnrolmentId}` : "Patient")

    const patientDisplayName =
      (record?.patientName || record?.name || "").trim() || patientInitial || "NA"

    const patient = {
      patientId: patientIdLabel,
      initial: patientInitial,
      name: record?.patientName || record?.name || "",
    }

    const visit = {
      visitDate:
        record?.visitDate || record?.actualVisitDate || record?.plannedVisitDate || record?.createdAt || "",
      visitName,
    }

    // ZIP layout: Protocol/study → Site name → Patient → Visit → PDF (CRA-friendly)
    const siteSegment = siteFolderSegmentFromRecord(record, siteDetails, filterSiteId)
    // Use only the stable patient identifier to avoid trailing `_NA` in ZIP folder names.
    const patientSegment = sanitizePathSegment(`patient-${patientIdLabel}`, "patient")
    const visitSegment = sanitizePathSegment(visitName, "Visit")

    const pathPrefix = [studyFolderSegment, siteSegment, patientSegment, visitSegment].join("/")

    const crfFolderSegment = sanitizePathSegment(
      `${sanitizeWindowsFileName(crfName)}_${crfDataId}`,
      "CRF"
    )
    const crfEntryPathPrefix = `${pathPrefix}/${crfFolderSegment}`

    let pdfFileName = `${sanitizeWindowsFileName(crfName)}_${crfDataId}.pdf`
    let pdfEntryKey = `${crfEntryPathPrefix}/${pdfFileName}`
    if (usedPdfEntryKeys.has(pdfEntryKey)) {
      pdfFileName = `${sanitizeWindowsFileName(`${crfName}_${visitName}_${crfDataId}`)}.pdf`
      pdfEntryKey = `${crfEntryPathPrefix}/${pdfFileName}`
    }
    usedPdfEntryKeys.add(pdfEntryKey)

    try {
      let piSignoffRecord = undefined
      if (isPiSignoffRequiredForStudy && Number.isFinite(crfDataId) && crfDataId > 0) {
        try {
          const piRes = await piSignoffService.getByCrfDataId(crfDataId)
          piSignoffRecord = piRes?.data ?? null
        } catch {
          piSignoffRecord = null
        }
      }

      const blob = await generateCrfEntryPdfBlob({
        crfMeta,
        patient,
        visit,
        sections,
        printedInfo,
        showDates: true,
        pdfMode: "filled",
        layoutOptions: {
          ...CRF_PDF_DEFAULT_LAYOUT_OPTIONS,
          showSubjectIdentity: true,
        },
        crfName,
        piSignoffRecord,
      })
      zip.file(`${crfEntryPathPrefix}/${pdfFileName}`, blob)
      pdfsAdded += 1
    } catch (e) {
      console.error("PDF export failed for CRF data", crfDataId, e)
    }

    // Attachments: include only <= 10 MB per file inside each CRF folder.
    // This uses visit attachments list by (patientEnrolmentId, visitScheduleId).
    try {
      const patientEnrolmentId =
        record?.patientEnrolmentId ??
        record?.patientEnrolmentID ??
        record?.patientEnrolmentid ??
        null
      const rowVisitScheduleId =
        record?.visitScheduleId ?? record?.visitSchedule?.id ?? null

      if (patientEnrolmentId != null && rowVisitScheduleId != null) {
        const pid = parseInt(String(patientEnrolmentId), 10)
        const vsid = parseInt(String(rowVisitScheduleId), 10)
        if (Number.isFinite(pid) && pid > 0 && Number.isFinite(vsid) && vsid > 0) {
          const listKey = `${pid}-${vsid}`
          let visitAttachments = visitAttachmentsListCache.get(listKey)
          if (!visitAttachments) {
            onProgress?.({
              phase: "attachments",
              message: `Adding attachments (≤10MB) … ${pid}/${vsid}`,
            })
            const listRes = await visitAttachmentsService.list(studyId, pid, vsid)
            visitAttachments = listRes?.isSuccess && Array.isArray(listRes.data) ? listRes.data : []
            visitAttachmentsListCache.set(listKey, visitAttachments)
            await yieldToMain()
          }

          const attachmentsUnderLimit = visitAttachments.filter((att) => {
            const aid = getVisitAttachmentId(att)
            if (!aid) return false
            if (!isUploadedVisitAttachment(att)) return false
            const sz = getVisitAttachmentSizeBytes(att)
            // Only include when size is known and <= limit (avoid downloading huge blobs).
            return sz != null && sz <= VISIT_ATTACHMENT_ZIP_MAX_FILE_BYTES
          })

          const attachmentsDir = `${crfEntryPathPrefix}/attachments`
          for (const att of attachmentsUnderLimit) {
            const attachmentId = getVisitAttachmentId(att)
            if (!attachmentId) continue

            let cached = attachmentBlobCache.get(String(attachmentId))
            if (!cached) {
              const dl = await visitAttachmentsService.downloadWithProgress(attachmentId)
              if (!dl?.isSuccess || !dl?.blob) continue
              if (dl.blob.size > VISIT_ATTACHMENT_ZIP_MAX_FILE_BYTES) continue
              // Prefer the original filename from list DTO for stable ZIP naming.
              cached = {
                blob: dl.blob,
                fileName: att.originalFileName || dl.fileName || att.fileName || att.name,
              }
              attachmentBlobCache.set(String(attachmentId), cached)
            }

            const candidateName =
              cached.fileName ||
              att.originalFileName ||
              att.fileName ||
              att.name ||
              `attachment-${attachmentId}`
            const finalName =
              hasFileExtension(candidateName) ? candidateName : `${candidateName}.${extensionFromAttachmentDto(att) || "file"}`
            let entryName = sanitizeWindowsFileName(finalName)
            let entryKey = `${attachmentsDir}/${entryName}`
            if (usedAttachmentEntryKeys.has(entryKey)) {
              entryName = `${sanitizeWindowsFileName(finalName)}_${attachmentId}`
              entryKey = `${attachmentsDir}/${entryName}`
            }
            usedAttachmentEntryKeys.add(entryKey)
            zip.file(entryKey, cached.blob)
          }
          await yieldToMain()
        }
      }
    } catch (e) {
      // Attachments are optional; keep main PDF export working.
      console.error("Attachment inclusion failed", e)
    }

    done += 1
    await yieldToMain()
  }

  if (pdfsAdded === 0) {
    throw new Error(
      "No PDF files were generated. Check that submitted CRF rows include design snapshots and form data, then try again."
    )
  }

  onProgress?.({ phase: "zip", message: "Building ZIP…" })
  await yieldToMain()
  const zipBlob = await zip.generateAsync({ type: "blob" })
  const url = URL.createObjectURL(zipBlob)
  const a = document.createElement("a")
  a.href = url
  a.download = `ecrf-details-pdfs-${new Date().toISOString().slice(0, 10)}.zip`
  document.body.appendChild(a)
  a.click()
  URL.revokeObjectURL(url)
  document.body.removeChild(a)
}
