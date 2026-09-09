/**
 * Study role permission matrix API (§4).
 */

import apiClient from "../api/client"
import { API_CONFIG } from "../api/config"
import logger from "../api/logger"
import { ALL_STUDY_PERMISSION_KEYS } from "@/lib/permissions/studyPermissionKeys"
import { isNavModulePermissionKey } from "@/lib/permissions/studyNavModuleKeys"

function normalizeMatrixPayload(raw) {
  if (!raw || typeof raw !== "object") return {}

  const matrixRaw = raw.matrix ?? raw.Matrix
  if (matrixRaw && typeof matrixRaw === "object" && !Array.isArray(matrixRaw)) {
    const normalized = {}
    for (const [key, value] of Object.entries(matrixRaw)) {
      const roleKey = String(key ?? "").trim().toLowerCase()
      if (!roleKey) continue
      normalized[roleKey] = { ...(value ?? {}) }
    }
    return normalized
  }

  const rolesRaw = raw.roles ?? raw.Roles ?? raw
  if (Array.isArray(rolesRaw)) {
    const matrix = {}
    for (const row of rolesRaw) {
      const roleGuid = String(row?.roleGuid ?? row?.RoleGuid ?? "")
        .trim()
        .toLowerCase()
      if (!roleGuid) continue
      const permissions = row?.permissions ?? row?.Permissions ?? {}
      matrix[roleGuid] = { ...permissions }
    }
    return matrix
  }

  if (typeof rolesRaw === "object") {
    return { ...rolesRaw }
  }

  return {}
}

function normalizeMatrixMeta(raw) {
  if (!raw || typeof raw !== "object") {
    return { source: "default", isPersisted: false, roles: [] }
  }
  const roles = raw.roles ?? raw.Roles ?? []
  const source = String(raw.source ?? raw.Source ?? "default").trim() || "default"
  const isPersisted = Boolean(
    raw.isPersisted ??
      raw.IsPersisted ??
      (source.toLowerCase() === "persisted" || source.toLowerCase() === "saved"),
  )
  return {
    source,
    isPersisted,
    roles: Array.isArray(roles) ? roles : [],
  }
}

/** Map API permission keys to catalog keys (handles casing / missing dots from serializers). */
export function normalizeEffectivePermissionMap(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null
  }

  const catalogSet = new Set(ALL_STUDY_PERMISSION_KEYS)
  const normalized = {}

  for (const [key, value] of Object.entries(raw)) {
    const trimmed = String(key ?? "").trim()
    if (!trimmed) continue

    if (catalogSet.has(trimmed)) {
      normalized[trimmed] = Boolean(value)
      continue
    }

    const lower = trimmed.toLowerCase()
    const catalogMatch = ALL_STUDY_PERMISSION_KEYS.find(
      (catalogKey) => catalogKey.toLowerCase() === lower,
    )
    if (catalogMatch) {
      normalized[catalogMatch] = Boolean(value)
      continue
    }

    const compact = lower.replace(/[^a-z]/g, "")
    const compactMatch = ALL_STUDY_PERMISSION_KEYS.find(
      (catalogKey) => catalogKey.replace(/[^a-z]/g, "") === compact,
    )
    if (compactMatch) {
      normalized[compactMatch] = Boolean(value)
      continue
    }

    if (isNavModulePermissionKey(trimmed)) {
      normalized[trimmed] = Boolean(value)
    }
  }

  for (const catalogKey of ALL_STUDY_PERMISSION_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(normalized, catalogKey)) {
      normalized[catalogKey] = false
    }
  }

  return normalized
}

function extractEffectivePermissionsFromPayload(raw) {
  if (!raw || typeof raw !== "object") {
    return { permissions: null, meta: {} }
  }

  const permissionsRaw = raw.permissions ?? raw.Permissions
  if (permissionsRaw && typeof permissionsRaw === "object" && !Array.isArray(permissionsRaw)) {
    return { permissions: normalizeEffectivePermissionMap(permissionsRaw), meta: raw }
  }

  const hasPermissionKeys = Object.keys(raw).some((key) => String(key).includes("."))
  if (hasPermissionKeys) {
    return { permissions: normalizeEffectivePermissionMap(raw), meta: {} }
  }

  return { permissions: null, meta: raw }
}

class StudyPermissionService {
  async getPermissionCatalog() {
    try {
      return await apiClient.get(API_CONFIG.ENDPOINTS.STUDY_PERMISSIONS.GET_CATALOG)
    } catch (error) {
      logger.warn("Study permission catalog fetch failed", error)
      return {
        isSuccess: false,
        statusCode: error?.statusCode || 404,
        data: null,
        message: error.message || "Permission catalog API not available",
      }
    }
  }

  /** Full app nav tree (routes + codes) for study-matrix sidebar — not filtered by global role. */
  async getNavModuleCatalog() {
    try {
      return await apiClient.get(API_CONFIG.ENDPOINTS.STUDY_PERMISSIONS.GET_NAV_MODULE_CATALOG)
    } catch (error) {
      logger.warn("Study nav module catalog fetch failed", error)
      return {
        isSuccess: false,
        statusCode: error?.statusCode || 404,
        data: null,
        message: error.message || "Navigation catalog API not available",
      }
    }
  }

  /**
   * GET matrix for study. Returns { matrix, source, isPersisted, roles } from API only.
   */
  async getRolePermissionMatrix(studyId) {
    const numericId = Number.parseInt(String(studyId ?? ""), 10)
    if (!Number.isFinite(numericId) || numericId <= 0) {
      return {
        isSuccess: false,
        statusCode: 400,
        matrix: {},
        source: "default",
        isPersisted: false,
        roles: [],
        message: "Study ID is required",
      }
    }

    try {
      const response = await apiClient.get(API_CONFIG.ENDPOINTS.STUDY_PERMISSIONS.GET_MATRIX(numericId))
      const raw = response?.data ?? (response?.isSuccess ? response : null)
      if (response?.isSuccess && raw) {
        const meta = normalizeMatrixMeta(raw)
        const matrix = normalizeMatrixPayload(raw)
        return {
          isSuccess: true,
          statusCode: response.statusCode ?? 200,
          matrix,
          source: meta.source,
          isPersisted: meta.isPersisted,
          roles: meta.roles,
          message: response.message ?? "",
        }
      }

      return {
        isSuccess: false,
        statusCode: response?.statusCode ?? 404,
        matrix: {},
        source: "default",
        isPersisted: false,
        roles: [],
        message: response?.message || "Permission matrix API not available.",
      }
    } catch (error) {
      logger.warn("Study permission matrix fetch failed", error)
      return {
        isSuccess: false,
        statusCode: error?.statusCode || 404,
        matrix: {},
        source: "default",
        isPersisted: false,
        roles: [],
        message: "Permission matrix API not available.",
      }
    }
  }

  async saveRolePermissionMatrix(studyId, matrix) {
    const numericId = Number.parseInt(String(studyId ?? ""), 10)
    if (!Number.isFinite(numericId) || numericId <= 0) {
      return {
        isSuccess: false,
        statusCode: 400,
        data: null,
        message: "Study ID is required",
      }
    }

    const payload = {
      studyId: numericId,
      matrix: matrix ?? {},
    }

    const saveTimeout = parseInt(process.env.NEXT_PUBLIC_STUDY_MATRIX_SAVE_TIMEOUT || "120000", 10)

    try {
      return await apiClient.put(API_CONFIG.ENDPOINTS.STUDY_PERMISSIONS.SAVE_MATRIX(numericId), payload, {
        timeout: saveTimeout,
        maxRetries: 0,
      })
    } catch (error) {
      logger.error("Save study permission matrix failed", error)
      return {
        isSuccess: false,
        statusCode: error?.statusCode || 500,
        data: null,
        message: error.message || "Failed to save permission matrix",
      }
    }
  }

  /** Effective permissions for runtime. Returns null data when enforcement not ready (404). */
  async getEffectivePermissions(studyId, siteId = null) {
    const numericStudyId = Number.parseInt(String(studyId ?? ""), 10)
    if (!Number.isFinite(numericStudyId) || numericStudyId <= 0) {
      return {
        isSuccess: false,
        statusCode: 400,
        data: null,
        enforcementReady: false,
        message: "Study ID is required",
      }
    }

    try {
      const response = await apiClient.get(
        API_CONFIG.ENDPOINTS.STUDY_PERMISSIONS.GET_EFFECTIVE(numericStudyId, siteId),
      )
      const raw = response?.data ?? (response?.isSuccess ? response : null)
      if (response?.isSuccess && raw) {
        const { permissions, meta } = extractEffectivePermissionsFromPayload(raw)
        const payload = { ...meta, ...raw }
        const enforcementReady = Boolean(
          payload?.enforcementReady ?? payload?.EnforcementReady ?? permissions != null,
        )
        return {
          ...response,
          enforcementReady,
          roleGuid: payload?.roleGuid ?? payload?.RoleGuid ?? null,
          roleName: payload?.roleName ?? payload?.RoleName ?? null,
          permissionSource: payload?.source ?? payload?.Source ?? null,
          data: permissions,
        }
      }
      return {
        isSuccess: false,
        statusCode: response?.statusCode ?? 404,
        data: null,
        enforcementReady: false,
        message: response?.message || "Effective permissions API not available",
      }
    } catch (error) {
      return {
        isSuccess: false,
        statusCode: error?.statusCode || 404,
        data: null,
        enforcementReady: false,
        message: error.message || "Effective permissions API not available",
      }
    }
  }
}

export default new StudyPermissionService()
