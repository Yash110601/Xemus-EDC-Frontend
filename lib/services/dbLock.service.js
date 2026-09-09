import apiClient from "../api/client"
import { API_CONFIG } from "../api/config"
import logger from "../api/logger"
import { normalizeCrfStructureResponse } from "../dbLock/normalizeLockTargets"
import { normalizeLocksListResponse } from "../dbLock/normalizeLocksList"
import studyService from "./study.service"

function normalizeLockStatus(raw, studyId) {
  if (!raw || typeof raw !== "object") {
    return {
      studyId,
      siteId: null,
      crfDataId: null,
      isLocked: false,
      level: "study",
      source: "default",
      message: "",
    }
  }

  const level = String(raw.level ?? raw.Level ?? "study")

  return {
    studyId: raw.studyId ?? raw.StudyId ?? studyId,
    siteId: raw.siteId ?? raw.SiteId ?? null,
    crfDataId: raw.crfDataId ?? raw.CrfDataId ?? null,
    isLocked: Boolean(raw.isLocked ?? raw.IsLocked ?? raw.locked ?? raw.Locked),
    level,
    lockedAt: raw.lockedAt ?? raw.LockedAt ?? null,
    lockedBy: raw.lockedBy ?? raw.LockedBy ?? null,
    source: "api",
    message: raw.message ?? raw.Message ?? "",
  }
}

class DbLockService {
  async getLockStatus(studyId, scope = {}) {
    const sid = Number.parseInt(String(studyId ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0) {
      return { isSuccess: false, statusCode: 400, data: null, message: "Study ID is required" }
    }

    const siteId = scope.siteId ?? scope.SiteId
    const crfDataId = scope.crfDataId ?? scope.CrfDataId

    try {
      const response = await apiClient.get(
        API_CONFIG.ENDPOINTS.DB_LOCK.GET_STATUS(sid, { siteId, crfDataId }),
      )
      if (response?.isSuccess && response.data != null) {
        return { ...response, data: normalizeLockStatus(response.data, sid) }
      }
      if (!response?.isSuccess) {
        return response
      }
    } catch (error) {
      logger.debug("Database lock status API error", error)
    }

    try {
      const studyRes = await studyService.getStudyById(sid)
      const study = studyRes?.data ?? {}
      const isLocked = Boolean(study.isLocked ?? study.IsLocked)
      return {
        isSuccess: true,
        statusCode: 200,
        data: {
          studyId: sid,
          siteId: siteId ?? null,
          crfDataId: crfDataId ?? null,
          isLocked,
          level: "study",
          source: "study",
          message: isLocked ? "Study is locked (database lock)." : "",
        },
        message: "",
      }
    } catch (error) {
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to read lock status",
      }
    }
  }

  async getCrfStructure(studyId, crfDataId) {
    const sid = Number.parseInt(String(studyId ?? ""), 10)
    const cid = Number.parseInt(String(crfDataId ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0 || !Number.isFinite(cid) || cid <= 0) {
      return { isSuccess: false, statusCode: 400, data: null, message: "Study ID and CRF data ID are required" }
    }

    try {
      const response = await apiClient.get(API_CONFIG.ENDPOINTS.DB_LOCK.GET_CRF_STRUCTURE(sid, cid))
      if (response?.isSuccess) {
        return {
          ...response,
          data: normalizeCrfStructureResponse(response, sid, cid),
          granularApiAvailable: true,
        }
      }
      return response
    } catch (error) {
      logger.error("Database lock CRF structure failed", error)
      return {
        isSuccess: false,
        statusCode: error?.statusCode || error?.httpStatus || 500,
        data: null,
        message: error.message || "Failed to load CRF lock structure",
        granularApiAvailable: false,
      }
    }
  }

  async getLocksList(studyId, options = {}) {
    const sid = Number.parseInt(String(studyId ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0) {
      return { isSuccess: false, statusCode: 400, data: null, message: "Study ID is required" }
    }

    try {
      const response = await apiClient.get(API_CONFIG.ENDPOINTS.DB_LOCK.GET_LOCKS_LIST(sid, options))
      if (response?.isSuccess) {
        return {
          ...response,
          data: normalizeLocksListResponse(response),
        }
      }
      return response
    } catch (error) {
      logger.error("Database lock list failed", error)
      return {
        isSuccess: false,
        statusCode: error?.statusCode || error?.httpStatus || 500,
        data: null,
        message: error.message || "Failed to load active locks",
      }
    }
  }

  /** @deprecated alias for getCrfStructure */
  async getLockTargets(studyId, scope = {}) {
    const crfDataId = scope.crfDataId ?? scope.CrfDataId
    return this.getCrfStructure(studyId, crfDataId)
  }

  async applyLock(payload) {
    try {
      return await apiClient.post(API_CONFIG.ENDPOINTS.DB_LOCK.APPLY, payload)
    } catch (error) {
      logger.error("Database lock apply failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || error.httpStatus || 500,
        data: null,
        message: error.message || "Failed to apply database lock",
      }
    }
  }

  async releaseLock(payload) {
    try {
      return await apiClient.post(API_CONFIG.ENDPOINTS.DB_LOCK.RELEASE, payload)
    } catch (error) {
      logger.error("Database lock release failed", error)
      return {
        isSuccess: false,
        statusCode: error?.statusCode || error.httpStatus || 500,
        data: null,
        message: error.message || "Failed to release database lock",
      }
    }
  }

  async applyLockTargets(payload) {
    const studyId = payload.studyId
    const crfDataId = payload.crfDataId

    if (payload?.wholeCrf) {
      return this.applyLock({ studyId, crfDataId, level: "crf" })
    }

    const targets = Array.isArray(payload?.targets) ? payload.targets : []
    return this.applyLock({ studyId, crfDataId, targets })
  }

  async releaseLockTargets(payload) {
    const studyId = payload.studyId
    const crfDataId = payload.crfDataId

    if (payload?.wholeCrf) {
      return this.releaseLock({ studyId, crfDataId, level: "crf" })
    }

    const targets = Array.isArray(payload?.targets) ? payload.targets : []
    return this.releaseLock({ studyId, crfDataId, targets })
  }
}

export default new DbLockService()
