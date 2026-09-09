import apiClient from "../api/client"
import { API_CONFIG } from "../api/config"
import logger from "../api/logger"
import { normalizePaymentRuleProgress } from "../utils/paymentRuleProgress"
import { enumNameToValue } from "../utils/paymentRuleEnums"
import { normalizeVisitScheduleIds, parseVisitScheduleIdsFromRule } from "../utils/paymentRuleVisitScheduleIds"

function pick(raw, ...keys) {
  if (!raw || typeof raw !== "object") return undefined
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null) return raw[key]
  }
  return undefined
}

function normalizeRule(raw) {
  if (!raw || typeof raw !== "object") return null
  return {
    id: pick(raw, "id", "Id"),
    studyId: pick(raw, "studyId", "StudyId"),
    ruleName: pick(raw, "ruleName", "RuleName") ?? "",
    sequenceNo: Number(pick(raw, "sequenceNo", "SequenceNo") ?? 0),
    triggerCategory: enumNameToValue(pick(raw, "triggerCategory", "TriggerCategory")),
    triggerCategoryName: pick(raw, "triggerCategoryName", "TriggerCategoryName") ?? "",
    triggerMetric: enumNameToValue(pick(raw, "triggerMetric", "TriggerMetric")),
    triggerMetricName: pick(raw, "triggerMetricName", "TriggerMetricName") ?? "",
    visitScheduleId: pick(raw, "visitScheduleId", "VisitScheduleId") ?? null,
    visitScheduleName: pick(raw, "visitScheduleName", "VisitScheduleName") ?? null,
    visitScheduleIds: parseVisitScheduleIdsFromRule(raw),
    visitScheduleNames: Array.isArray(raw?.visitScheduleNames)
      ? raw.visitScheduleNames
      : Array.isArray(raw?.VisitScheduleNames)
        ? raw.VisitScheduleNames
        : [],
    operator: enumNameToValue(pick(raw, "operator", "Operator")),
    targetType: enumNameToValue(pick(raw, "targetType", "TargetType")),
    targetValue: Number(pick(raw, "targetValue", "TargetValue") ?? 0),
    paymentAmount: Number(pick(raw, "paymentAmount", "PaymentAmount") ?? 0),
    paymentModel: enumNameToValue(pick(raw, "paymentModel", "PaymentModel")),
    completionLevel: enumNameToValue(pick(raw, "completionLevel", "CompletionLevel")),
    denominatorSource: enumNameToValue(pick(raw, "denominatorSource", "DenominatorSource")),
    patientFilterJson: pick(raw, "patientFilterJson", "PatientFilterJson") ?? null,
    prerequisiteRuleId: pick(raw, "prerequisiteRuleId", "PrerequisiteRuleId") ?? null,
    requiresAgreementSigned: Boolean(pick(raw, "requiresAgreementSigned", "RequiresAgreementSigned") ?? true),
    achievementPolicy: enumNameToValue(pick(raw, "achievementPolicy", "AchievementPolicy")),
    isAutoCalculate: Boolean(pick(raw, "isAutoCalculate", "IsAutoCalculate") ?? true),
    isActive: Boolean(pick(raw, "isActive", "IsActive") ?? true),
    createdAt: pick(raw, "createdAt", "CreatedAt"),
    updatedAt: pick(raw, "updatedAt", "UpdatedAt"),
  }
}

function normalizeCatalog(raw) {
  const root = raw?.data ?? raw ?? {}
  const metricsRaw = root.metrics ?? root.Metrics ?? []
  const metrics = (Array.isArray(metricsRaw) ? metricsRaw : []).map((item) => ({
    metric: enumNameToValue(pick(item, "metric", "Metric")),
    name: pick(item, "name", "Name") ?? "",
    category: enumNameToValue(pick(item, "category", "Category")),
    requiresVisitSchedule: Boolean(
      pick(item, "requiresVisitSchedule", "RequiresVisitSchedule") ?? false,
    ),
  }))

  const toOptions = (list, prefix = "") =>
    (Array.isArray(list) ? list : []).map((entry, index) => {
      const value = enumNameToValue(entry)
      return {
        value: value ?? index + 1,
        label: typeof entry === "string" ? entry.replace(/([a-z])([A-Z])/g, "$1 $2") : String(entry),
      }
    })

  return {
    metrics,
    triggerCategories: toOptions(root.triggerCategories ?? root.TriggerCategories ?? []),
    targetTypes: toOptions(root.targetTypes ?? root.TargetTypes ?? []),
    operators: toOptions(root.operators ?? root.Operators ?? []),
  }
}

function extractRuleList(response) {
  const data = response?.data
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.items)) return data.items
  if (Array.isArray(data?.Items)) return data.Items
  return []
}

function toSavePayload(payload) {
  const triggerMetric = Number(payload.triggerMetric)
  const visitScheduleIds =
    triggerMetric === 10
      ? normalizeVisitScheduleIds(payload.visitScheduleIds ?? parseVisitScheduleIdsFromRule(payload))
      : []

  return {
    ruleName: String(payload.ruleName ?? "").trim(),
    sequenceNo: Number(payload.sequenceNo ?? 1),
    triggerCategory: Number(payload.triggerCategory),
    triggerMetric,
    visitScheduleId:
      payload.visitScheduleId != null && payload.visitScheduleId !== ""
        ? Number(payload.visitScheduleId)
        : null,
    visitScheduleIds: visitScheduleIds.length > 0 ? visitScheduleIds : null,
    operator: Number(payload.operator ?? 1),
    targetType: Number(payload.targetType ?? 2),
    targetValue: Number(payload.targetValue ?? 0),
    paymentAmount: Number(payload.paymentAmount ?? 0),
    paymentModel: Number(payload.paymentModel ?? 2),
    completionLevel: Number(payload.completionLevel ?? 1),
    denominatorSource: Number(payload.denominatorSource ?? 1),
    patientFilterJson: payload.patientFilterJson ?? null,
    prerequisiteRuleId:
      payload.prerequisiteRuleId != null && payload.prerequisiteRuleId !== ""
        ? Number(payload.prerequisiteRuleId)
        : null,
    requiresAgreementSigned: Boolean(payload.requiresAgreementSigned ?? true),
    achievementPolicy: Number(payload.achievementPolicy ?? 1),
    isAutoCalculate: Boolean(payload.isAutoCalculate ?? true),
    isActive: Boolean(payload.isActive ?? true),
  }
}

class StudyPaymentRuleService {
  async getCatalog() {
    try {
      const response = await apiClient.get(API_CONFIG.ENDPOINTS.PAYMENT_RULES.CATALOG)
      if (response?.isSuccess) {
        return { ...response, data: normalizeCatalog(response) }
      }
      return { ...response, data: normalizeCatalog({}) }
    } catch (error) {
      logger.error("Payment rules catalog fetch failed", error)
      return { isSuccess: false, statusCode: error?.statusCode || 500, data: normalizeCatalog({}) }
    }
  }

  async listByStudy(studyId, { includeInactive = false } = {}) {
    const sid = Number.parseInt(String(studyId ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0) {
      return { isSuccess: false, statusCode: 400, data: [], message: "Study ID is required" }
    }
    try {
      const response = await apiClient.get(
        API_CONFIG.ENDPOINTS.PAYMENT_RULES.LIST(sid, includeInactive),
      )
      const items = extractRuleList(response).map(normalizeRule).filter(Boolean)
      return { ...response, data: items }
    } catch (error) {
      logger.error("Payment rules list fetch failed", error)
      return { isSuccess: false, statusCode: error?.statusCode || 500, data: [], message: error.message }
    }
  }

  async getById(studyId, ruleId) {
    const sid = Number.parseInt(String(studyId ?? ""), 10)
    const rid = Number.parseInt(String(ruleId ?? ""), 10)
    try {
      const response = await apiClient.get(API_CONFIG.ENDPOINTS.PAYMENT_RULES.BY_ID(sid, rid))
      if (response?.isSuccess && response.data) {
        return { ...response, data: normalizeRule(response.data) }
      }
      return { ...response, data: null }
    } catch (error) {
      logger.error("Payment rule fetch failed", error)
      return { isSuccess: false, statusCode: error?.statusCode || 500, data: null, message: error.message }
    }
  }

  async create(studyId, payload) {
    const sid = Number.parseInt(String(studyId ?? ""), 10)
    try {
      return await apiClient.post(API_CONFIG.ENDPOINTS.PAYMENT_RULES.CREATE(sid), toSavePayload(payload))
    } catch (error) {
      logger.error("Payment rule create failed", error)
      return { isSuccess: false, statusCode: error?.statusCode || 500, message: error.message }
    }
  }

  async update(studyId, ruleId, payload) {
    const sid = Number.parseInt(String(studyId ?? ""), 10)
    const rid = Number.parseInt(String(ruleId ?? ""), 10)
    try {
      return await apiClient.put(
        API_CONFIG.ENDPOINTS.PAYMENT_RULES.UPDATE(sid, rid),
        toSavePayload(payload),
      )
    } catch (error) {
      logger.error("Payment rule update failed", error)
      return { isSuccess: false, statusCode: error?.statusCode || 500, message: error.message }
    }
  }

  async delete(studyId, ruleId) {
    const sid = Number.parseInt(String(studyId ?? ""), 10)
    const rid = Number.parseInt(String(ruleId ?? ""), 10)
    try {
      return await apiClient.delete(API_CONFIG.ENDPOINTS.PAYMENT_RULES.DELETE(sid, rid))
    } catch (error) {
      logger.error("Payment rule delete failed", error)
      return { isSuccess: false, statusCode: error?.statusCode || 500, message: error.message }
    }
  }

  async applyTemplate(studyId, { studyType = null, force = false } = {}) {
    const sid = Number.parseInt(String(studyId ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0) {
      return { isSuccess: false, statusCode: 400, data: [], message: "Study ID is required" }
    }
    const body = { force: Boolean(force) }
    if (studyType != null && studyType !== "") {
      body.studyType = Number(studyType)
    }
    try {
      const response = await apiClient.post(API_CONFIG.ENDPOINTS.PAYMENT_RULES.APPLY_TEMPLATE(sid), body)
      const items = extractRuleList(response).map(normalizeRule).filter(Boolean)
      return { ...response, data: items }
    } catch (error) {
      logger.error("Payment rule template apply failed", error)
      return { isSuccess: false, statusCode: error?.statusCode || 500, data: [], message: error.message }
    }
  }

  async getProgress(studyId, siteId = null) {
    const sid = Number.parseInt(String(studyId ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0) {
      return { isSuccess: false, statusCode: 400, data: [], message: "Study ID is required" }
    }
    try {
      const response = await apiClient.get(API_CONFIG.ENDPOINTS.PAYMENT_RULES.PROGRESS(sid, siteId))
      const items = extractRuleList(response).length
        ? extractRuleList(response)
        : Array.isArray(response?.data)
          ? response.data
          : []
      return {
        ...response,
        data: items.map(normalizePaymentRuleProgress).filter(Boolean),
      }
    } catch (error) {
      logger.error("Payment rule progress fetch failed", error)
      return { isSuccess: false, statusCode: error?.statusCode || 500, data: [], message: error.message }
    }
  }

  async recalculate(studyId, siteId = null) {
    const sid = Number.parseInt(String(studyId ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0) {
      return { isSuccess: false, statusCode: 400, data: [], message: "Study ID is required" }
    }
    try {
      const response = await apiClient.post(API_CONFIG.ENDPOINTS.PAYMENT_RULES.RECALCULATE(sid, siteId), {})
      const items = extractRuleList(response).length
        ? extractRuleList(response)
        : Array.isArray(response?.data)
          ? response.data
          : []
      return {
        ...response,
        data: items.map(normalizePaymentRuleProgress).filter(Boolean),
      }
    } catch (error) {
      logger.error("Payment rule recalculate failed", error)
      return { isSuccess: false, statusCode: error?.statusCode || 500, data: [], message: error.message }
    }
  }

  async overrideProgress(studyId, progressId, payload) {
    const sid = Number.parseInt(String(studyId ?? ""), 10)
    const pid = Number.parseInt(String(progressId ?? ""), 10)
    try {
      const response = await apiClient.post(
        API_CONFIG.ENDPOINTS.PAYMENT_RULES.OVERRIDE(sid, pid),
        {
          status: Number(payload.status),
          overrideReason: payload.overrideReason?.trim() || null,
          markPaymentEligible: Boolean(payload.markPaymentEligible ?? true),
        },
      )
      if (response?.isSuccess && response.data) {
        return { ...response, data: normalizePaymentRuleProgress(response.data) }
      }
      return response
    } catch (error) {
      logger.error("Payment rule override failed", error)
      return { isSuccess: false, statusCode: error?.statusCode || 500, message: error.message }
    }
  }

  async migrateLegacy(studyId) {
    const sid = Number.parseInt(String(studyId ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0) {
      return { isSuccess: false, statusCode: 400, message: "Study ID is required" }
    }
    try {
      return await apiClient.post(API_CONFIG.ENDPOINTS.PAYMENT_RULES.MIGRATE_LEGACY(sid), {})
    } catch (error) {
      logger.error("Payment rule legacy migrate failed", error)
      return { isSuccess: false, statusCode: error?.statusCode || 500, message: error.message }
    }
  }
}

export default new StudyPaymentRuleService()
