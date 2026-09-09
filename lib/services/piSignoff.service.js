import apiClient from "../api/client"
import { API_CONFIG } from "../api/config"
import logger from "../api/logger"
import {
  isPiSignoffComplete,
  normalizePiReadiness,
  normalizePiSignoffGranularity,
  normalizePiSignoffStatus,
  normalizeReviewOrder,
} from "../piSignoff/piSignoffReadiness"

export { isPiSignoffComplete } from "../piSignoff/piSignoffReadiness"

function normalizeSignoffRecord(raw) {
  if (!raw || typeof raw !== "object") return null
  const readiness = normalizePiReadiness(raw.readiness ?? raw.Readiness)
  return {
    crfDataId: raw.crfDataId ?? raw.CrfDataId ?? null,
    studyId: raw.studyId ?? raw.StudyId ?? null,
    status: normalizePiSignoffStatus(
      raw.status ?? raw.Status ?? raw.signoffStatus ?? raw.SignoffStatus ?? "Pending",
    ),
    signedAt: raw.signedAt ?? raw.SignedAt ?? null,
    signedBy: raw.signedBy ?? raw.SignedBy ?? raw.signedByUserName ?? raw.SignedByUserName ?? null,
    comment: raw.comment ?? raw.Comment ?? null,
    reviewOrder: normalizeReviewOrder(raw.reviewOrder ?? raw.ReviewOrder),
    piSignoffGranularity: normalizePiSignoffGranularity(
      raw.piSignoffGranularity ?? raw.PiSignoffGranularity,
    ),
    readiness,
    patientEnrolmentId: raw.patientEnrolmentId ?? raw.PatientEnrolmentId ?? null,
    patientId: raw.patientId ?? raw.PatientId ?? raw.patientEnrolmentId ?? raw.PatientEnrolmentId ?? null,
    patientInitial: raw.patientInitial ?? raw.PatientInitial ?? null,
    siteId: raw.siteId ?? raw.SiteId ?? null,
    siteName: raw.siteName ?? raw.SiteName ?? null,
    visitScheduleId: raw.visitScheduleId ?? raw.VisitScheduleId ?? null,
    visitName: raw.visitName ?? raw.VisitName ?? null,
    visitNo: raw.visitNo ?? raw.VisitNo ?? null,
    crfDesignId: raw.crfDesignId ?? raw.CrfDesignId ?? null,
    crfDesignName: raw.crfDesignName ?? raw.CrfDesignName ?? null,
    submittedAt: raw.submittedAt ?? raw.SubmittedAt ?? null,
  }
}

function extractPendingItems(envelope) {
  if (Array.isArray(envelope)) return envelope
  if (!envelope || typeof envelope !== "object") return []

  const nested = envelope.data ?? envelope.Data
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const fromNested = extractPendingItems(nested)
    if (fromNested.length) return fromNested
  }

  const list =
    envelope.items ??
    envelope.Items ??
    envelope.pendingItems ??
    envelope.PendingItems ??
    envelope.pending ??
    envelope.Pending ??
    null

  return Array.isArray(list) ? list : []
}

function normalizePendingResponse(response) {
  const root = response?.data ?? {}
  const envelope =
    root && typeof root === "object" && !Array.isArray(root)
      ? root
      : {}

  const reviewOrder = normalizeReviewOrder(
    envelope.reviewOrder ??
      envelope.ReviewOrder ??
      response?.reviewOrder ??
      response?.ReviewOrder,
  )

  const piSignoffGranularity = normalizePiSignoffGranularity(
    envelope.piSignoffGranularity ??
      envelope.PiSignoffGranularity ??
      response?.piSignoffGranularity ??
      response?.PiSignoffGranularity,
  )

  const isPiSignoffRequired = toStudySettingBool(
    envelope.isPiSignoffRequired ??
      envelope.IsPiSignoffRequired ??
      response?.isPiSignoffRequired ??
      response?.IsPiSignoffRequired,
  )

  const isPiSignoffBulkEnabled = toStudySettingBool(
    envelope.isPiSignoffBulkEnabled ??
      envelope.IsPiSignoffBulkEnabled ??
      response?.isPiSignoffBulkEnabled ??
      response?.IsPiSignoffBulkEnabled,
  )

  const items = extractPendingItems(envelope)
    .map((raw) => {
      const record = normalizeSignoffRecord(raw)
      if (!record) return null
      const recordGranularity = raw?.piSignoffGranularity ?? raw?.PiSignoffGranularity
      if (recordGranularity != null && String(recordGranularity).trim() !== "") {
        record.piSignoffGranularity = normalizePiSignoffGranularity(recordGranularity)
      } else if (!record.piSignoffGranularity || record.piSignoffGranularity === "crf_only") {
        record.piSignoffGranularity = piSignoffGranularity
      }
      return record
    })
    .filter(Boolean)
  const pendingPatientCount = Number.parseInt(
    String(
      envelope.pendingPatientCount ??
        envelope.PendingPatientCount ??
        response?.pendingPatientCount ??
        response?.PendingPatientCount ??
        "",
    ),
    10,
  )
  const distinctPatients = items
    .map((item) => item.patientEnrolmentId ?? item.patientId)
    .filter((id) => id != null && String(id).trim() !== "")
  const resolvedPatientCount =
    Number.isFinite(pendingPatientCount) && pendingPatientCount > 0
      ? pendingPatientCount
      : new Set(distinctPatients).size

  return { reviewOrder, piSignoffGranularity, isPiSignoffRequired, isPiSignoffBulkEnabled, items, pendingPatientCount: resolvedPatientCount }
}

function toStudySettingBool(raw) {
  const normalized = String(raw ?? "").trim().toLowerCase()
  return raw === true || raw === 1 || normalized === "true" || normalized === "1" || normalized === "yes"
}

class PiSignoffService {
  async getPendingByStudy(studyId) {
    const sid = Number.parseInt(String(studyId ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0) {
      return { isSuccess: false, statusCode: 400, data: [], message: "Study ID is required" }
    }
    try {
      const response = await apiClient.get(API_CONFIG.ENDPOINTS.PI_SIGNOFF.GET_PENDING(sid))
      if (response?.isSuccess) {
        const { reviewOrder, piSignoffGranularity, isPiSignoffRequired, isPiSignoffBulkEnabled, items, pendingPatientCount } =
          normalizePendingResponse(response)
        return {
          ...response,
          reviewOrder,
          piSignoffGranularity,
          isPiSignoffRequired,
          isPiSignoffBulkEnabled,
          pendingPatientCount,
          data: items,
        }
      }
      return {
        ...response,
        reviewOrder: normalizeReviewOrder(),
        piSignoffGranularity: normalizePiSignoffGranularity(),
        isPiSignoffRequired: false,
        isPiSignoffBulkEnabled: false,
        pendingPatientCount: 0,
        data: [],
      }
    } catch (error) {
      logger.error("PI sign-off pending fetch failed", error)
      return { isSuccess: false, statusCode: error?.statusCode || 500, data: [], message: error.message }
    }
  }

  async getByCrfDataId(crfDataId) {
    const id = Number.parseInt(String(crfDataId ?? ""), 10)
    if (!Number.isFinite(id) || id <= 0) {
      return { isSuccess: false, statusCode: 400, data: null, message: "CRF data ID is required" }
    }
    try {
      const response = await apiClient.get(API_CONFIG.ENDPOINTS.PI_SIGNOFF.GET_BY_CRF_DATA(id))
      if (response?.isSuccess && response.data) {
        return { ...response, data: normalizeSignoffRecord(response.data) }
      }
      return { ...response, data: null }
    } catch (error) {
      return { isSuccess: false, statusCode: error?.statusCode || 500, data: null, message: error.message }
    }
  }

  async applySignoff(payload) {
    try {
      return await apiClient.post(API_CONFIG.ENDPOINTS.PI_SIGNOFF.APPLY, payload)
    } catch (error) {
      logger.error("PI sign-off apply failed", error)
      return {
        isSuccess: false,
        statusCode: error?.statusCode || 500,
        data: null,
        message: error.message || "Failed to apply PI sign-off",
      }
    }
  }

  async applyBulkSignoff(payload) {
    try {
      return await apiClient.post(API_CONFIG.ENDPOINTS.PI_SIGNOFF.APPLY_BULK, payload)
    } catch (error) {
      logger.error("PI bulk sign-off apply failed", error)
      return {
        isSuccess: false,
        statusCode: error?.statusCode || 500,
        data: null,
        message: error.message || "Failed to apply bulk PI sign-off",
      }
    }
  }

  async revokeSignoff(payload) {
    try {
      return await apiClient.post(API_CONFIG.ENDPOINTS.PI_SIGNOFF.REVOKE, payload)
    } catch (error) {
      logger.error("PI sign-off revoke failed", error)
      return {
        isSuccess: false,
        statusCode: error?.statusCode || 500,
        data: null,
        message: error.message || "Failed to revoke PI sign-off",
      }
    }
  }

  async applyFieldSignoffs(payload) {
    try {
      const response = await apiClient.post(API_CONFIG.ENDPOINTS.PI_SIGNOFF.APPLY_FIELD_SIGNOFFS, payload)
      if (response?.isSuccess && response.data) {
        return { ...response, data: normalizeSignoffRecord(response.data) }
      }
      return { ...response, data: null }
    } catch (error) {
      logger.error("Field PI sign-off apply failed", error)
      return {
        isSuccess: false,
        statusCode: error?.statusCode || 500,
        data: null,
        message: error.message || "Failed to save field PI sign-off",
      }
    }
  }

  async revokeFieldSignoffs(payload) {
    try {
      const response = await apiClient.post(API_CONFIG.ENDPOINTS.PI_SIGNOFF.REVOKE_FIELD_SIGNOFFS, payload)
      if (response?.isSuccess && response.data) {
        return { ...response, data: normalizeSignoffRecord(response.data) }
      }
      return { ...response, data: null }
    } catch (error) {
      logger.error("Field PI sign-off revoke failed", error)
      return {
        isSuccess: false,
        statusCode: error?.statusCode || 500,
        data: null,
        message: error.message || "Failed to revoke field PI sign-off",
      }
    }
  }
}

export default new PiSignoffService()
