import apiClient from "../api/client"
import { API_CONFIG, STORAGE_KEYS } from "../api/config"
import logger from "../api/logger"

const EP = API_CONFIG.ENDPOINTS.RSDV_REVIEW

function pickTrimmedString(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue
    const text = String(value).trim()
    if (text) return text
  }
  return null
}

function normalizeQueueItem(raw) {
  if (!raw || typeof raw !== "object") return null
  const patientEnrolmentId = raw.patientEnrolmentId ?? raw.PatientEnrolmentId ?? null
  return {
    attachmentId: raw.attachmentId ?? raw.AttachmentId ?? null,
    attachmentGuid: raw.attachmentGuid ?? raw.AttachmentGuid ?? null,
    studyId: raw.studyId ?? raw.StudyId ?? null,
    siteId: raw.siteId ?? raw.SiteId ?? null,
    siteName: pickTrimmedString(
      raw.siteName,
      raw.SiteName,
      raw.site?.siteName,
      raw.Site?.SiteName,
    ),
    patientEnrolmentId,
    patientId: pickTrimmedString(raw.patientId, raw.PatientId) ?? (patientEnrolmentId != null ? String(patientEnrolmentId) : null),
    patientInitial: pickTrimmedString(
      raw.patientInitial,
      raw.PatientInitial,
      raw.initial,
      raw.Initial,
    ),
    visitScheduleId: raw.visitScheduleId ?? raw.VisitScheduleId ?? null,
    visitName: raw.visitName ?? raw.VisitName ?? null,
    visitNo: raw.visitNo ?? raw.VisitNo ?? null,
    crfDataId: raw.crfDataId ?? raw.CrfDataId ?? null,
    originalFileName: raw.originalFileName ?? raw.OriginalFileName ?? "",
    contentType: raw.contentType ?? raw.ContentType ?? "",
    fileSizeBytes: raw.fileSizeBytes ?? raw.FileSizeBytes ?? 0,
    attachmentType: raw.attachmentType ?? raw.AttachmentType ?? "",
    uploadedAt: raw.uploadedAt ?? raw.UploadedAt ?? null,
    reviewStatus: raw.reviewStatus ?? raw.ReviewStatus ?? "pending",
    reviewSessionId: raw.reviewSessionId ?? raw.ReviewSessionId ?? null,
    completedAt: raw.completedAt ?? raw.CompletedAt ?? null,
  }
}

function normalizeAnnotation(raw) {
  if (!raw || typeof raw !== "object") return null
  return {
    id: raw.id ?? raw.Id ?? null,
    guid: raw.guid ?? raw.Guid ?? null,
    crfDataId: raw.crfDataId ?? raw.CrfDataId ?? null,
    fieldId: raw.fieldId ?? raw.FieldId ?? "",
    fieldLabel: raw.fieldLabel ?? raw.FieldLabel ?? "",
    annotationType: raw.annotationType ?? raw.AnnotationType ?? "comment",
    highlightColor: raw.highlightColor ?? raw.HighlightColor ?? null,
    commentText: raw.commentText ?? raw.CommentText ?? "",
    queryId: raw.queryId ?? raw.QueryId ?? null,
    createdAt: raw.createdAt ?? raw.CreatedAt ?? null,
  }
}

function normalizeDocumentAnnotation(raw) {
  if (!raw || typeof raw !== "object") return null
  return {
    id: raw.id ?? raw.Id ?? null,
    guid: raw.guid ?? raw.Guid ?? null,
    pageNumber: raw.pageNumber ?? raw.PageNumber ?? 1,
    xPct: Number(raw.xPct ?? raw.XPct ?? 0),
    yPct: Number(raw.yPct ?? raw.YPct ?? 0),
    widthPct: Number(raw.widthPct ?? raw.WidthPct ?? 0),
    heightPct: Number(raw.heightPct ?? raw.HeightPct ?? 0),
    commentText: raw.commentText ?? raw.CommentText ?? "",
    status: raw.status ?? raw.Status ?? "open",
    isOrphaned: Boolean(raw.isOrphaned ?? raw.IsOrphaned),
    crfDataId: raw.crfDataId ?? raw.CrfDataId ?? null,
    fieldId: raw.fieldId ?? raw.FieldId ?? null,
    queryId: raw.queryId ?? raw.QueryId ?? null,
    createdAt: raw.createdAt ?? raw.CreatedAt ?? null,
    updatedAt: raw.updatedAt ?? raw.UpdatedAt ?? null,
  }
}

function normalizeCrfSummary(raw) {
  if (!raw || typeof raw !== "object") return null
  return {
    crfDataId: raw.crfDataId ?? raw.CrfDataId ?? null,
    crfDesignId: raw.crfDesignId ?? raw.CrfDesignId ?? null,
    crfDesignName: raw.crfDesignName ?? raw.CrfDesignName ?? null,
    status: raw.status ?? raw.Status ?? "",
    isSdvVerify: Boolean(raw.isSdvVerify ?? raw.IsSdvVerify),
    submittedAt: raw.submittedAt ?? raw.SubmittedAt ?? null,
  }
}

function normalizeCompletionReadiness(raw) {
  if (!raw || typeof raw !== "object") return null
  return {
    canComplete: Boolean(raw.canComplete ?? raw.CanComplete),
    openDocumentNotesCount: parseCount(raw.openDocumentNotesCount ?? raw.OpenDocumentNotesCount),
    openQueriesCount: parseCount(raw.openQueriesCount ?? raw.OpenQueriesCount),
    blockedReasons: (raw.blockedReasons ?? raw.BlockedReasons ?? [])
      .map((item) => String(item ?? "").trim())
      .filter(Boolean),
    crfDataIdsPendingSdvMark: (raw.crfDataIdsPendingSdvMark ?? raw.CrfDataIdsPendingSdvMark ?? [])
      .map((id) => Number.parseInt(String(id ?? ""), 10))
      .filter((id) => Number.isFinite(id) && id > 0),
  }
}

function normalizeContext(envelope) {
  const root = envelope?.data ?? envelope ?? {}
  const attachment = normalizeQueueItem(root.attachment ?? root.Attachment ?? root)
  const annotations = (root.annotations ?? root.Annotations ?? [])
    .map(normalizeAnnotation)
    .filter(Boolean)
  const documentAnnotations = (root.documentAnnotations ?? root.DocumentAnnotations ?? [])
    .map(normalizeDocumentAnnotation)
    .filter(Boolean)
  const crfRecords = (root.crfRecords ?? root.CrfRecords ?? [])
    .map(normalizeCrfSummary)
    .filter(Boolean)

  return {
    attachment,
    reviewSessionId: root.reviewSessionId ?? root.ReviewSessionId ?? attachment?.reviewSessionId ?? null,
    reviewStatus: root.reviewStatus ?? root.ReviewStatus ?? attachment?.reviewStatus ?? "pending",
    reviewComment: root.reviewComment ?? root.ReviewComment ?? null,
    allowRsdvReopen: Boolean(root.allowRsdvReopen ?? root.AllowRsdvReopen),
    rsdvMarksSdvOnComplete: Boolean(root.rsdvMarksSdvOnComplete ?? root.RsdvMarksSdvOnComplete),
    rsdvRequireResolvedFindings: Boolean(
      root.rsdvRequireResolvedFindings ?? root.RsdvRequireResolvedFindings,
    ),
    completionReadiness: normalizeCompletionReadiness(
      root.completionReadiness ?? root.CompletionReadiness,
    ),
    crfRecords,
    annotations,
    documentAnnotations,
  }
}

function parseCount(value, fallback = 0) {
  const n = Number.parseInt(String(value ?? ""), 10)
  return Number.isFinite(n) ? n : fallback
}

/** Unwrap ApiResponse payload (handles optional double-nested data). */
function unwrapRsdvPayload(response) {
  let root = response?.data ?? {}
  if (!root || typeof root !== "object") return {}
  const nested = root.data ?? root.Data
  const hasCounts =
    root.pendingCount != null ||
    root.PendingCount != null ||
    root.inProgressCount != null ||
    root.InProgressCount != null ||
    root.completedCount != null ||
    root.CompletedCount != null ||
    root.items != null ||
    root.Items != null
  if (nested != null && typeof nested === "object" && !hasCounts) {
    root = nested
  }
  return root
}

function normalizeSummaryResponse(response) {
  const root = unwrapRsdvPayload(response)
  const isRemoteSdvEnabled = Boolean(
    root.isRemoteSdvEnabled ?? root.IsRemoteSdvEnabled ?? response?.isRemoteSdvEnabled,
  )
  const pendingCount = parseCount(root.pendingCount ?? root.PendingCount)
  const inProgressCount = parseCount(root.inProgressCount ?? root.InProgressCount)
  const completedCount = parseCount(root.completedCount ?? root.CompletedCount)
  const openCount = parseCount(
    root.openCount ?? root.OpenCount,
    pendingCount + inProgressCount,
  )
  return {
    isRemoteSdvEnabled,
    pendingCount,
    inProgressCount,
    completedCount,
    openCount,
  }
}

function normalizeQueueResponse(response) {
  const root = unwrapRsdvPayload(response)
  const isRemoteSdvEnabled = Boolean(
    root.isRemoteSdvEnabled ?? root.IsRemoteSdvEnabled ?? response?.isRemoteSdvEnabled,
  )
  const items = (root.items ?? root.Items ?? [])
    .map(normalizeQueueItem)
    .filter(Boolean)
  const pendingCount = parseCount(root.pendingCount ?? root.PendingCount)
  const inProgressCount = parseCount(root.inProgressCount ?? root.InProgressCount)
  const completedCount = parseCount(root.completedCount ?? root.CompletedCount)
  const openCount = parseCount(
    root.openCount ?? root.OpenCount ?? root.pendingCount ?? root.PendingCount,
    pendingCount + inProgressCount,
  )
  return {
    isRemoteSdvEnabled,
    items,
    pendingCount,
    inProgressCount,
    completedCount,
    openCount,
  }
}

function openAttachmentIds(items) {
  return new Set(
    (Array.isArray(items) ? items : [])
      .map((row) => row?.attachmentId)
      .filter((id) => id != null)
      .map(String),
  )
}

/** Build dashboard counts from queue responses when GetSummary is unavailable. */
async function buildSummaryFromQueue(service, studyId) {
  const [openRes, completedRes] = await Promise.all([
    service.getQueue(studyId),
    service.getQueue(studyId, { status: "completed" }),
  ])

  if (!openRes?.isSuccess && !completedRes?.isSuccess) {
    return {
      isSuccess: false,
      isRemoteSdvEnabled: false,
      pendingCount: 0,
      inProgressCount: 0,
      completedCount: 0,
      openCount: 0,
      data: null,
      message: openRes?.message || completedRes?.message || "Could not load RSDV summary",
    }
  }

  const openItems = Array.isArray(openRes?.data) ? openRes.data : []
  const completedItems = Array.isArray(completedRes?.data) ? completedRes.data : []
  const openIds = openAttachmentIds(openItems)

  const statusFilterSupported =
    completedRes?.isSuccess &&
    (parseCount(completedRes.completedCount) > 0 ||
      completedItems.length === 0 ||
      completedItems.every((row) => !openIds.has(String(row.attachmentId))))

  const hasServerSplitCounts =
    openRes?.inProgressCount !== undefined ||
    openRes?.completedCount !== undefined ||
    openRes?.openCount !== undefined

  let pendingCount
  let inProgressCount
  let completedCount

  if (hasServerSplitCounts) {
    pendingCount = parseCount(openRes.pendingCount)
    inProgressCount = parseCount(openRes.inProgressCount)
    completedCount = parseCount(
      openRes.completedCount ?? completedRes.completedCount,
      statusFilterSupported ? completedItems.length : 0,
    )
  } else {
    inProgressCount = openItems.filter(
      (row) => String(row.reviewStatus ?? "").toLowerCase() === "in_progress",
    ).length
    pendingCount = Math.max(0, openItems.length - inProgressCount)
    completedCount = statusFilterSupported ? completedItems.length : 0
  }

  const normalized = {
    isRemoteSdvEnabled: Boolean(openRes?.isRemoteSdvEnabled ?? completedRes?.isRemoteSdvEnabled),
    pendingCount,
    inProgressCount,
    completedCount,
    openCount: pendingCount + inProgressCount,
  }

  return {
    isSuccess: true,
    ...normalized,
    data: normalized,
  }
}

class RsdvReviewService {
  async getSummary(studyId) {
    const sid = Number.parseInt(String(studyId ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0) {
      return { isSuccess: false, statusCode: 400, data: null, message: "Study ID is required" }
    }
    try {
      const response = await apiClient.get(EP.GET_SUMMARY(sid))
      if (response?.isSuccess) {
        const normalized = normalizeSummaryResponse(response)
        return { ...response, ...normalized, data: normalized }
      }
      if (
        response?.httpStatus === 404 ||
        response?.statusCode === 404 ||
        response?.httpStatus === 403 ||
        response?.statusCode === 403
      ) {
        logger.warn("RSDV GetSummary unavailable — falling back to GetQueue", { studyId: sid, statusCode: response?.statusCode })
        return buildSummaryFromQueue(this, sid)
      }
      return buildSummaryFromQueue(this, sid)
    } catch (error) {
      if (
        error?.httpStatus === 404 ||
        error?.statusCode === 404 ||
        error?.httpStatus === 403 ||
        error?.statusCode === 403
      ) {
        logger.warn("RSDV GetSummary unavailable — falling back to GetQueue", { studyId: sid, statusCode: error?.statusCode })
        return buildSummaryFromQueue(this, sid)
      }
      logger.error("RSDV summary fetch failed", error)
      return buildSummaryFromQueue(this, sid)
    }
  }

  async getQueue(studyId, options = {}) {
    const sid = Number.parseInt(String(studyId ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0) {
      return { isSuccess: false, statusCode: 400, data: [], message: "Study ID is required" }
    }
    const status = options.status ?? options.Status ?? null
    try {
      const response = await apiClient.get(EP.GET_QUEUE(sid, { status }))
      if (response?.isSuccess) {
        const normalized = normalizeQueueResponse(response)
        return { ...response, ...normalized, data: normalized.items }
      }
      return {
        ...response,
        isRemoteSdvEnabled: false,
        pendingCount: 0,
        inProgressCount: 0,
        completedCount: 0,
        openCount: 0,
        data: [],
      }
    } catch (error) {
      logger.error("RSDV queue fetch failed", error)
      return { isSuccess: false, statusCode: error?.statusCode || 500, data: [], message: error.message }
    }
  }

  async getContext(attachmentId) {
    const id = Number.parseInt(String(attachmentId ?? ""), 10)
    if (!Number.isFinite(id) || id <= 0) {
      return { isSuccess: false, statusCode: 400, data: null, message: "Attachment ID is required" }
    }
    try {
      const response = await apiClient.get(EP.GET_CONTEXT(id))
      if (response?.isSuccess) {
        return { ...response, data: normalizeContext(response) }
      }
      return { ...response, data: null }
    } catch (error) {
      logger.error("RSDV context fetch failed", error)
      return { isSuccess: false, statusCode: error?.statusCode || 500, data: null, message: error.message }
    }
  }

  async startReview(attachmentId) {
    try {
      const response = await apiClient.post(EP.START, { attachmentId: Number(attachmentId) })
      if (response?.isSuccess) {
        return { ...response, data: normalizeContext(response) }
      }
      return response
    } catch (error) {
      logger.error("RSDV start review failed", error)
      return { isSuccess: false, statusCode: error?.statusCode || 500, data: null, message: error.message }
    }
  }

  async saveAnnotation(payload) {
    try {
      const response = await apiClient.post(EP.SAVE_ANNOTATION, payload)
      if (response?.isSuccess && response.data) {
        return { ...response, data: normalizeAnnotation(response.data) }
      }
      return response
    } catch (error) {
      logger.error("RSDV save annotation failed", error)
      return { isSuccess: false, statusCode: error?.statusCode || 500, data: null, message: error.message }
    }
  }

  async saveDocumentAnnotation(payload) {
    try {
      const response = await apiClient.post(EP.SAVE_DOCUMENT_ANNOTATION, payload)
      if (response?.isSuccess && response.data) {
        return { ...response, data: normalizeDocumentAnnotation(response.data) }
      }
      return response
    } catch (error) {
      logger.error("RSDV save document annotation failed", error)
      return { isSuccess: false, statusCode: error?.statusCode || 500, data: null, message: error.message }
    }
  }

  async updateDocumentAnnotation(payload) {
    try {
      const response = await apiClient.put(EP.UPDATE_DOCUMENT_ANNOTATION, payload)
      if (response?.isSuccess && response.data) {
        return { ...response, data: normalizeDocumentAnnotation(response.data) }
      }
      return response
    } catch (error) {
      logger.error("RSDV update document annotation failed", error)
      return { isSuccess: false, statusCode: error?.statusCode || 500, data: null, message: error.message }
    }
  }

  async deleteDocumentAnnotation(annotationId) {
    try {
      const id = Number.parseInt(String(annotationId ?? ""), 10)
      if (!Number.isFinite(id) || id <= 0) {
        return { isSuccess: false, statusCode: 400, data: null, message: "Annotation ID is required" }
      }
      return await apiClient.delete(EP.DELETE_DOCUMENT_ANNOTATION(id))
    } catch (error) {
      logger.error("RSDV delete document annotation failed", error)
      return { isSuccess: false, statusCode: error?.statusCode || 500, data: null, message: error.message }
    }
  }

  async updateFieldAnnotation(payload) {
    try {
      const response = await apiClient.put(EP.UPDATE_FIELD_ANNOTATION, payload)
      if (response?.isSuccess && response.data) {
        return { ...response, data: normalizeAnnotation(response.data) }
      }
      return response
    } catch (error) {
      logger.error("RSDV update field annotation failed", error)
      return { isSuccess: false, statusCode: error?.statusCode || 500, data: null, message: error.message }
    }
  }

  async deleteFieldAnnotation(annotationId) {
    try {
      const id = Number.parseInt(String(annotationId ?? ""), 10)
      if (!Number.isFinite(id) || id <= 0) {
        return { isSuccess: false, statusCode: 400, data: null, message: "Annotation ID is required" }
      }
      return await apiClient.delete(EP.DELETE_FIELD_ANNOTATION(id))
    } catch (error) {
      logger.error("RSDV delete field annotation failed", error)
      return { isSuccess: false, statusCode: error?.statusCode || 500, data: null, message: error.message }
    }
  }

  async reopenReview(reviewSessionId) {
    try {
      const response = await apiClient.post(EP.REOPEN, { reviewSessionId: Number(reviewSessionId) })
      if (response?.isSuccess) {
        return { ...response, data: normalizeContext(response) }
      }
      return response
    } catch (error) {
      logger.error("RSDV reopen review failed", error)
      return { isSuccess: false, statusCode: error?.statusCode || 500, data: null, message: error.message }
    }
  }

  async completeReview(payload) {
    try {
      const response = await apiClient.post(EP.COMPLETE, payload)
      if (response?.isSuccess) {
        return { ...response, data: normalizeContext(response) }
      }
      return response
    } catch (error) {
      logger.error("RSDV complete review failed", error)
      return { isSuccess: false, statusCode: error?.statusCode || 500, data: null, message: error.message }
    }
  }

  async getAuditLog(params = {}) {
    try {
      const {
        pageNumber = 1,
        pageSize = 20,
        studyId,
        action,
        search,
        startDate,
        endDate,
      } = params

      const queryParams = new URLSearchParams({
        pageNumber: String(pageNumber),
        pageSize: String(pageSize),
      })

      if (studyId) queryParams.set("studyId", String(studyId))
      if (action) queryParams.set("action", String(action))
      if (search) queryParams.set("search", String(search))
      if (startDate) queryParams.set("startDate", new Date(startDate).toISOString())
      if (endDate) queryParams.set("endDate", new Date(endDate).toISOString())

      const response = await apiClient.get(`${EP.GET_AUDIT_LOG}?${queryParams.toString()}`)
      if (response?.isSuccess) {
        return response
      }
      return {
        isSuccess: false,
        statusCode: response?.statusCode || 500,
        data: null,
        message: response?.message || "Could not load RSDV audit log.",
      }
    } catch (error) {
      logger.error("RSDV audit log fetch failed", error)
      return { isSuccess: false, statusCode: error?.statusCode || 500, data: null, message: error.message }
    }
  }

  async exportAuditLog(params = {}) {
    const { studyId, action, search, startDate, endDate } = params
    const queryParams = new URLSearchParams()
    if (studyId) queryParams.set("studyId", String(studyId))
    if (action) queryParams.set("action", String(action))
    if (search) queryParams.set("search", String(search))
    if (startDate) queryParams.set("startDate", new Date(startDate).toISOString())
    if (endDate) queryParams.set("endDate", new Date(endDate).toISOString())

    const token =
      typeof window !== "undefined"
        ? localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) || sessionStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
        : null

    const url = `${API_CONFIG.BASE_URL}${EP.EXPORT_AUDIT_LOG}?${queryParams.toString()}`
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      throw new Error(errorData.message || `Export failed (${res.status})`)
    }

    const blob = await res.blob()
    const contentDisposition = res.headers.get("Content-Disposition")
    let filename = `rsdv-audit-log-${new Date().toISOString().slice(0, 10)}.csv`
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?(.+)"?/i)
      if (match) filename = match[1].replace(/"/g, "")
    }

    const objectUrl = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = objectUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    window.URL.revokeObjectURL(objectUrl)
    document.body.removeChild(link)
    return { isSuccess: true, filename }
  }

  /** Fetch document bytes with auth for inline preview (object URL). Caller should revoke URL when done. */
  async fetchStreamBlobUrl(attachmentId) {
    const id = Number.parseInt(String(attachmentId ?? ""), 10)
    if (!Number.isFinite(id) || id <= 0) return null

    const token =
      typeof window !== "undefined"
        ? localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) || sessionStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
        : null

    const url = `${API_CONFIG.BASE_URL}${EP.STREAM(id)}`
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) throw new Error(`Stream failed (${res.status})`)
    const blob = await res.blob()
    return URL.createObjectURL(blob)
  }

  /** Verify AI — suggest source region ↔ eCRF field match. */
  async suggestSourceMatch(payload = {}) {
    try {
      const response = await apiClient.post(
        API_CONFIG.ENDPOINTS.XEMUS_AI.SUGGEST_SOURCE_MATCH,
        payload,
      )
      return response
    } catch (error) {
      logger.error("RSDV suggestSourceMatch failed", error)
      return { isSuccess: false, statusCode: error?.statusCode || 500, data: null, message: error.message }
    }
  }

  /** Verify AI — draft query text from field/document context. */
  async suggestQuery(payload = {}) {
    try {
      const response = await apiClient.post(API_CONFIG.ENDPOINTS.XEMUS_AI.SUGGEST_QUERY, payload)
      return response
    } catch (error) {
      logger.error("RSDV suggestQuery failed", error)
      return { isSuccess: false, statusCode: error?.statusCode || 500, data: null, message: error.message }
    }
  }

  /** Verify AI — OCR cropped page region(s). */
  async batchPageScan(payload = {}) {
    try {
      const response = await apiClient.post(
        API_CONFIG.ENDPOINTS.XEMUS_AI.BATCH_PAGE_SCAN,
        payload,
      )
      return response
    } catch (error) {
      logger.error("RSDV batchPageScan failed", error)
      return { isSuccess: false, statusCode: error?.statusCode || 500, data: null, message: error.message }
    }
  }
}

export default new RsdvReviewService()
