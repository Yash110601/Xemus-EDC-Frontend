/**
 * Read study settings for any user with study access (CRC, reports, admin).
 * Primary: GET /api/Studies/{studyId}/settings (summary projection).
 * Fallback: GET /api/StudySettings/GetStudySettingsByStudyId/{studyId}
 *
 * One API call per studyId — deduped in-flight + memory + sessionStorage cache.
 */

import { StudyFilter } from "@/lib/api/config"
import { normalizePiSignoffGranularity } from "@/lib/piSignoff/piSignoffReadiness"
import {
  DEFAULT_SCREENING_NUMBER_MASK,
  mergePatientIdentifierSettingsOverlay,
} from "@/lib/utils/patientIdentifierSettingsOverlay"
import { mergeStudyDocumentsSettingsOverlay } from "@/lib/utils/studyDocumentsSettingsOverlay"
import { mergeSystemSiteSettingsOverlay } from "@/lib/utils/systemSiteSettingsOverlay"
import { studyService, studySettingsService } from "@/lib/services"

const CACHE_TTL_MS = 5 * 60 * 1000
/** v4: invalidate summaries cached before bulk PI sign-off was returned from API. */
const SESSION_PREFIX = "studySettingsSummary_v4_"
const EMPTY_GUID = "00000000-0000-0000-0000-000000000000"

/** @type {Map<string, { result: object, ts: number }>} */
const memoryCache = new Map()
/** @type {Map<string, Promise<object>>} */
const inFlight = new Map()

export const toStudySettingBool = (raw) => {
  const normalized = String(raw ?? "").trim().toLowerCase()
  return raw === true || raw === 1 || normalized === "true" || normalized === "1" || normalized === "yes"
}

export const pickIsAgreementEnabled = (payload) => {
  if (!payload || typeof payload !== "object") return false
  const raw =
    payload.isAgreementEnabled ??
    payload.IsAgreementEnabled ??
    payload.studySetting?.isAgreementEnabled ??
    payload.studySetting?.IsAgreementEnabled
  return toStudySettingBool(raw)
}

/** When false, honorarium amount fields/columns are hidden. Defaults true if unset (legacy studies). */
export const pickIsSitePaymentEnabled = (payload) => {
  if (!payload || typeof payload !== "object") return true
  const raw =
    payload.isSitePaymentEnabled ??
    payload.IsSitePaymentEnabled ??
    payload.studySetting?.isSitePaymentEnabled ??
    payload.studySetting?.IsSitePaymentEnabled
  if (raw === undefined || raw === null) return true
  return toStudySettingBool(raw)
}

export const pickIsRemoteSdvEnabled = (payload) => {
  if (!payload || typeof payload !== "object") return false
  const raw =
    payload.isRemoteSdvEnabled ??
    payload.IsRemoteSdvEnabled ??
    payload.studySetting?.isRemoteSdvEnabled ??
    payload.studySetting?.IsRemoteSdvEnabled
  return toStudySettingBool(raw)
}

export const pickAllowRsdvReopen = (payload) => {
  if (!payload || typeof payload !== "object") return false
  const raw =
    payload.allowRsdvReopen ??
    payload.AllowRsdvReopen ??
    payload.studySetting?.allowRsdvReopen ??
    payload.studySetting?.AllowRsdvReopen
  return toStudySettingBool(raw)
}

/** When true, completing an RSDV session marks submitted visit CRFs as SDV-verified. */
export const pickRsdvMarksSdvOnComplete = (payload) => {
  if (!payload || typeof payload !== "object") return false
  const raw =
    payload.rsdvMarksSdvOnComplete ??
    payload.RsdvMarksSdvOnComplete ??
    payload.studySetting?.rsdvMarksSdvOnComplete ??
    payload.studySetting?.RsdvMarksSdvOnComplete
  return toStudySettingBool(raw)
}

/** When true, RSDV completion is blocked while open document notes or visit queries exist. */
export const pickRsdvRequireResolvedFindings = (payload) => {
  if (!payload || typeof payload !== "object") return false
  const raw =
    payload.rsdvRequireResolvedFindings ??
    payload.RsdvRequireResolvedFindings ??
    payload.studySetting?.rsdvRequireResolvedFindings ??
    payload.studySetting?.RsdvRequireResolvedFindings
  return toStudySettingBool(raw)
}

export const pickIsPiSignoffRequired = (payload) => {
  if (!payload || typeof payload !== "object") return false
  const raw =
    payload.isPiSignoffRequired ??
    payload.IsPiSignoffRequired ??
    payload.studySetting?.isPiSignoffRequired ??
    payload.studySetting?.IsPiSignoffRequired
  return toStudySettingBool(raw)
}

export const pickIsPiSignoffEmailNotificationsEnabled = (payload) => {
  if (!payload || typeof payload !== "object") return false
  const raw =
    payload.isPiSignoffEmailNotificationsEnabled ??
    payload.IsPiSignoffEmailNotificationsEnabled ??
    payload.studySetting?.isPiSignoffEmailNotificationsEnabled ??
    payload.studySetting?.IsPiSignoffEmailNotificationsEnabled
  return toStudySettingBool(raw)
}

export const pickIsPiSignoffBulkEnabled = (payload) => {
  if (!payload || typeof payload !== "object") return false
  const raw =
    payload.isPiSignoffBulkEnabled ??
    payload.IsPiSignoffBulkEnabled ??
    payload.studySetting?.isPiSignoffBulkEnabled ??
    payload.studySetting?.IsPiSignoffBulkEnabled
  return toStudySettingBool(raw)
}

export const pickIsDelegationLogEnabled = (payload) => {
  if (!payload || typeof payload !== "object") return false
  const raw =
    payload.isDelegationLogEnabled ??
    payload.IsDelegationLogEnabled ??
    payload.studySetting?.isDelegationLogEnabled ??
    payload.studySetting?.IsDelegationLogEnabled
  return toStudySettingBool(raw)
}

export const pickIsEConsentRequired = (payload) => {
  if (!payload || typeof payload !== "object") return false
  const raw =
    payload.isEConsentRequired ??
    payload.IsEConsentRequired ??
    payload.studySetting?.isEConsentRequired ??
    payload.studySetting?.IsEConsentRequired
  return toStudySettingBool(raw)
}

/** Study-level CDASH export & mapping feature flag. */
export const pickIsCdashEnabled = (payload) => {
  if (!payload || typeof payload !== "object") return false
  const raw =
    payload.isCdashEnabled ??
    payload.IsCdashEnabled ??
    payload.studySetting?.isCdashEnabled ??
    payload.studySetting?.IsCdashEnabled
  return toStudySettingBool(raw)
}

const pickAiSettingFlag = (payload, camelKey, pascalKey) => {
  if (!payload || typeof payload !== "object") return false
  const raw =
    payload[camelKey] ??
    payload[pascalKey] ??
    payload.studySetting?.[camelKey] ??
    payload.studySetting?.[pascalKey]
  return toStudySettingBool(raw)
}

/** Master toggle — when false, all YP Intelligence sub-modules are off. */
export const pickIsXemusIntelligenceEnabled = (payload) =>
  pickAiSettingFlag(payload, "isXemusIntelligenceEnabled", "IsXemusIntelligenceEnabled")

export const pickIsAiEntryEnabled = (payload) =>
  pickAiSettingFlag(payload, "isAiEntryEnabled", "IsAiEntryEnabled")

export const pickIsAiRsdvVerifyEnabled = (payload) =>
  pickAiSettingFlag(payload, "isAiRsdvVerifyEnabled", "IsAiRsdvVerifyEnabled")

export const pickIsAiQueryCopilotEnabled = (payload) =>
  pickAiSettingFlag(payload, "isAiQueryCopilotEnabled", "IsAiQueryCopilotEnabled")

export const pickIsAiCrfStudioEnabled = (payload) =>
  pickAiSettingFlag(payload, "isAiCrfStudioEnabled", "IsAiCrfStudioEnabled")

export const pickIsAiQualityHintsEnabled = (payload) =>
  pickAiSettingFlag(payload, "isAiQualityHintsEnabled", "IsAiQualityHintsEnabled")

export const pickIsAiCodingAssistEnabled = (payload) =>
  pickAiSettingFlag(payload, "isAiCodingAssistEnabled", "IsAiCodingAssistEnabled")

export const pickIsAiInsightEnabled = (payload) =>
  pickAiSettingFlag(payload, "isAiInsightEnabled", "IsAiInsightEnabled")

export const pickIsAiConsentAssistEnabled = (payload) =>
  pickAiSettingFlag(payload, "isAiConsentAssistEnabled", "IsAiConsentAssistEnabled")

/** All AI flags in one object for hooks and study settings UI. */
export const pickStudyAiSettings = (payload) => ({
  isXemusIntelligenceEnabled: pickIsXemusIntelligenceEnabled(payload),
  isAiEntryEnabled: pickIsAiEntryEnabled(payload),
  isAiRsdvVerifyEnabled: pickIsAiRsdvVerifyEnabled(payload),
  isAiQueryCopilotEnabled: pickIsAiQueryCopilotEnabled(payload),
  isAiCrfStudioEnabled: pickIsAiCrfStudioEnabled(payload),
  isAiQualityHintsEnabled: pickIsAiQualityHintsEnabled(payload),
  isAiCodingAssistEnabled: pickIsAiCodingAssistEnabled(payload),
  isAiInsightEnabled: pickIsAiInsightEnabled(payload),
  isAiConsentAssistEnabled: pickIsAiConsentAssistEnabled(payload),
})

export const pickIsStudyDocumentsEnabled = (payload) => {
  if (!payload || typeof payload !== "object") return false
  const raw =
    payload.isStudyDocumentsEnabled ??
    payload.IsStudyDocumentsEnabled ??
    payload.studySetting?.isStudyDocumentsEnabled ??
    payload.studySetting?.IsStudyDocumentsEnabled
  return toStudySettingBool(raw)
}

export const pickDemoVideoUrlFromSettings = (payload) => {
  if (!payload || typeof payload !== "object") return ""
  const raw =
    payload.demoVideoUrl ??
    payload.DemoVideoUrl ??
    payload.studySetting?.demoVideoUrl ??
    payload.studySetting?.DemoVideoUrl
  return typeof raw === "string" ? raw.trim() : ""
}

export const pickUseStudyRolePermissionMatrix = (payload) => {
  if (!payload || typeof payload !== "object") return false
  const raw =
    payload.useStudyRolePermissionMatrix ??
    payload.UseStudyRolePermissionMatrix ??
    payload.studySetting?.useStudyRolePermissionMatrix ??
    payload.studySetting?.UseStudyRolePermissionMatrix
  return toStudySettingBool(raw)
}

export const pickIsSystemSiteCreationEnabled = (payload) => {
  if (!payload || typeof payload !== "object") return false
  const raw =
    payload.isSystemSiteCreationEnabled ??
    payload.IsSystemSiteCreationEnabled ??
    payload.studySetting?.isSystemSiteCreationEnabled ??
    payload.studySetting?.IsSystemSiteCreationEnabled
  return toStudySettingBool(raw)
}

export const pickIsSystemSiteNamingCustomizable = (payload) => {
  if (!payload || typeof payload !== "object") return false
  const raw =
    payload.isSystemSiteNamingCustomizable ??
    payload.IsSystemSiteNamingCustomizable ??
    payload.studySetting?.isSystemSiteNamingCustomizable ??
    payload.studySetting?.IsSystemSiteNamingCustomizable
  return toStudySettingBool(raw)
}

export const pickSystemSiteCountFromSettings = (payload) => {
  if (!payload || typeof payload !== "object") return 0
  const raw =
    payload.systemSiteCount ??
    payload.SystemSiteCount ??
    payload.studySetting?.systemSiteCount ??
    payload.studySetting?.SystemSiteCount
  const n = Number.parseInt(String(raw ?? ""), 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export const pickSystemSiteNamePrefixFromSettings = (payload) => {
  if (!payload || typeof payload !== "object") return ""
  const raw =
    payload.systemSiteNamePrefix ??
    payload.SystemSiteNamePrefix ??
    payload.studySetting?.systemSiteNamePrefix ??
    payload.studySetting?.SystemSiteNamePrefix
  const s = String(raw ?? "").trim()
  return s
}

export const pickIsScreeningNumberEnabled = (payload) => {
  if (!payload || typeof payload !== "object") return false
  const raw =
    payload.isScreeningNumberEnabled ??
    payload.IsScreeningNumberEnabled ??
    payload.studySetting?.isScreeningNumberEnabled ??
    payload.studySetting?.IsScreeningNumberEnabled
  return toStudySettingBool(raw)
}

export const pickIsScreeningNumberMaskCustomizable = (payload) => {
  if (!payload || typeof payload !== "object") return false
  const raw =
    payload.isScreeningNumberMaskCustomizable ??
    payload.IsScreeningNumberMaskCustomizable ??
    payload.studySetting?.isScreeningNumberMaskCustomizable ??
    payload.studySetting?.IsScreeningNumberMaskCustomizable
  return toStudySettingBool(raw)
}

export const pickScreeningNumberMaskFromSettings = (payload) => {
  if (!payload || typeof payload !== "object") return DEFAULT_SCREENING_NUMBER_MASK
  const raw =
    payload.screeningNumberMask ??
    payload.ScreeningNumberMask ??
    payload.studySetting?.screeningNumberMask ??
    payload.studySetting?.ScreeningNumberMask
  const s = String(raw ?? "").trim()
  return s || DEFAULT_SCREENING_NUMBER_MASK
}

export const pickIsRandomizationNumberEnabled = (payload) => {
  if (!payload || typeof payload !== "object") return false
  const raw =
    payload.isRandomizationNumberEnabled ??
    payload.IsRandomizationNumberEnabled ??
    payload.studySetting?.isRandomizationNumberEnabled ??
    payload.studySetting?.IsRandomizationNumberEnabled
  return toStudySettingBool(raw)
}

export const pickRequireSdvForPaymentRules = (payload) => {
  if (!payload || typeof payload !== "object") return false
  const raw =
    payload.requireSdvForPaymentRules ??
    payload.RequireSdvForPaymentRules ??
    payload.studySetting?.requireSdvForPaymentRules ??
    payload.studySetting?.RequireSdvForPaymentRules
  return toStudySettingBool(raw)
}

const isValidRoleGuid = (guid) => {
  const value = String(guid ?? "").trim()
  return Boolean(value) && value.toLowerCase() !== EMPTY_GUID
}

/** Parse role GUID CSV / array from API (study doc, query raise, SDV). */
export const parseRoleGuidArray = (raw) => {
  if (Array.isArray(raw)) {
    return [...new Set(raw.map((g) => String(g ?? "").trim()).filter(isValidRoleGuid))]
  }
  const text = String(raw ?? "").trim()
  if (!text) return []
  return [
    ...new Set(
      text
        .split(/[,;]+/)
        .map((part) => part.trim())
        .filter(isValidRoleGuid),
    ),
  ]
}

/** @deprecated Use parseRoleGuidArray */
export const parseStudyDocShowRoleGuids = parseRoleGuidArray

export const userRoleMatchesAnyGuid = (userRoleGuid, allowedGuids = []) => {
  const user = String(userRoleGuid ?? "").trim().toLowerCase()
  if (!user) return false
  const list = Array.isArray(allowedGuids) ? allowedGuids : []
  if (!list.length) return false
  return list.some((g) => String(g ?? "").trim().toLowerCase() === user)
}

/** Empty queryRaiseRoleGuids → legacy open access (BE + FE). */
export const canUserRaiseQueries = (userRoleGuid, queryRaiseRoleGuids = []) => {
  const list = Array.isArray(queryRaiseRoleGuids) ? queryRaiseRoleGuids : []
  if (!list.length) return true
  return userRoleMatchesAnyGuid(userRoleGuid, list)
}

export const canRaiseOrCloseQuery = canUserRaiseQueries

/** SDV is on for a study only when sdvRoleGuids has at least one role. */
export const isSdvConfigured = (sdvRoleGuids = []) => {
  const list = Array.isArray(sdvRoleGuids) ? sdvRoleGuids : []
  return list.length > 0
}

/** Empty sdvRoleGuids → SDV off; user must be in configured roles. */
export const canUserVerifySdv = (userRoleGuid, sdvRoleGuids = []) => {
  if (!isSdvConfigured(sdvRoleGuids)) return false
  return userRoleMatchesAnyGuid(userRoleGuid, sdvRoleGuids)
}

export const canPerformSdv = canUserVerifySdv

export const pickQueryRaiseRoleGuidsFromSettings = (studySettingsData) => {
  if (!studySettingsData || typeof studySettingsData !== "object") return []
  const fromArray = parseRoleGuidArray(
    studySettingsData.queryRaiseRoleGuids ?? studySettingsData.QueryRaiseRoleGuids,
  )
  if (fromArray.length) return fromArray
  const legacy = String(
    studySettingsData.queryRaiseRoleGuid ?? studySettingsData.QueryRaiseRoleGuid ?? "",
  ).trim()
  return isValidRoleGuid(legacy) ? [legacy] : []
}

export const pickSdvRoleGuidsFromSettings = (studySettingsData) => {
  if (!studySettingsData || typeof studySettingsData !== "object") return []
  return parseRoleGuidArray(studySettingsData.sdvRoleGuids ?? studySettingsData.SdvRoleGuids)
}

export const pickRsdvRoleGuidsFromSettings = (studySettingsData) => {
  if (!studySettingsData || typeof studySettingsData !== "object") return []
  return parseRoleGuidArray(studySettingsData.rsdvRoleGuids ?? studySettingsData.RsdvRoleGuids)
}

export const isRsdvConfigured = (rsdvRoleGuids = [], sdvRoleGuids = []) => {
  const rsdv = Array.isArray(rsdvRoleGuids) ? rsdvRoleGuids : []
  const sdv = Array.isArray(sdvRoleGuids) ? sdvRoleGuids : []
  return rsdv.length > 0 || sdv.length > 0
}

/** Empty rsdv + sdv role lists → off; explicit rsdv list checked first, else SDV roles. */
export const canUserRsdvReview = (userRoleGuid, rsdvRoleGuids = [], sdvRoleGuids = []) => {
  const rsdv = Array.isArray(rsdvRoleGuids) ? rsdvRoleGuids : []
  if (rsdv.length > 0) return userRoleMatchesAnyGuid(userRoleGuid, rsdv)
  return canUserVerifySdv(userRoleGuid, sdvRoleGuids)
}

export const pickPiSignoffRoleGuidsFromSettings = (studySettingsData) => {
  if (!studySettingsData || typeof studySettingsData !== "object") return []

  const fromGuids = parseRoleGuidArray(
    studySettingsData.piSignoffRoleGuids ??
      studySettingsData.PiSignoffRoleGuids ??
      studySettingsData.studySetting?.piSignoffRoleGuids ??
      studySettingsData.studySetting?.PiSignoffRoleGuids,
  )
  if (fromGuids.length) return fromGuids

  const roles =
    studySettingsData.piSignoffRoles ??
    studySettingsData.PiSignoffRoles ??
    studySettingsData.studySetting?.piSignoffRoles ??
    studySettingsData.studySetting?.PiSignoffRoles

  if (!Array.isArray(roles)) return []

  return [
    ...new Set(
      roles
        .map((role) => role?.guid ?? role?.Guid ?? role?.roleGuid ?? role?.RoleGuid ?? role?.id ?? role?.Id)
        .map((g) => String(g ?? "").trim())
        .filter(isValidRoleGuid),
    ),
  ]
}

/** PI sign-off roles configured when isPiSignoffRequired and at least one role GUID. */
export const isPiSignoffRolesConfigured = (piSignoffRoleGuids = []) => {
  const list = Array.isArray(piSignoffRoleGuids) ? piSignoffRoleGuids : []
  return list.length > 0
}

/** Empty piSignoffRoleGuids → legacy permission matrix / menu fallback. */
export const canUserPiSignoff = (userRoleGuid, piSignoffRoleGuids = []) => {
  if (!isPiSignoffRolesConfigured(piSignoffRoleGuids)) return null
  return userRoleMatchesAnyGuid(userRoleGuid, piSignoffRoleGuids)
}

/** SPEC-SDVSIGN-001 — sdv_before_sign (default) | sign_before_sdv */
export const pickReviewOrderFromSettings = (studySettingsData) => {
  if (!studySettingsData || typeof studySettingsData !== "object") return "sdv_before_sign"
  const raw =
    studySettingsData.reviewOrder ??
    studySettingsData.ReviewOrder ??
    studySettingsData.sdvReviewOrder ??
    studySettingsData.SdvReviewOrder
  const value = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
  if (value === "sign_before_sdv" || value === "signbeforesdv") return "sign_before_sdv"
  return "sdv_before_sign"
}

/** crf_only (default) | field_and_crf — field PI before CRF sign-off */
export const pickPiSignoffGranularityFromSettings = (studySettingsData) => {
  if (!studySettingsData || typeof studySettingsData !== "object") return "crf_only"
  const raw =
    studySettingsData.piSignoffGranularity ??
    studySettingsData.PiSignoffGranularity ??
    studySettingsData.studySetting?.piSignoffGranularity ??
    studySettingsData.studySetting?.PiSignoffGranularity
  return normalizePiSignoffGranularity(raw)
}

/** Fallback when login payload has roleCode/roleName but no roleGuid (common for CRC). */
const ROLE_CODE_TO_GUID = {
  SUPERADMIN: "CC673149-53C0-4D0D-9285-0546FE9FC778",
  ADMIN: "87CC4709-E50E-4240-89FF-7FEB1DC280D0",
  CRM: "7B471F82-1401-4A42-816A-4ADCF6516DD5",
  CRC: "68E40698-5349-46F9-8C6C-AFB008A9A634",
  SPONSOR: "E2F65C78-9972-4833-931A-BD7BF199A291",
  CRA: "6DC990AE-5BA9-4D6C-A02B-20416F9C868A",
  SUPPORT: "AACB64D3-38A7-4BFA-A180-D80B192F3517",
  ENDOSCOPIST: "085A9022-2881-4624-B3FE-A8DFC2F30425",
  PATHOLOGIST: "F7089B8A-53AF-4736-8B2C-DB61306C995F",
  PI: "F0015883-ADD5-4AF4-A1BB-23C547B2B58C",
  PRINCIPALINVESTIGATOR: "F0015883-ADD5-4AF4-A1BB-23C547B2B58C",
  PM: "88C60A5E-DC29-4347-B803-85E4F27F72C1",
  PROJECTMANAGER: "88C60A5E-DC29-4347-B803-85E4F27F72C1",
}

export const getUserRoleGuid = (user) => {
  const guid =
    user?.roleGuid ??
    user?.RoleGuid ??
    user?.role?.guid ??
    user?.role?.Guid ??
    user?.role?.roleGuid ??
    user?.role?.RoleGuid
  const value = String(guid ?? "").trim()
  if (isValidRoleGuid(value)) return value

  const roleKey = String(user?.roleCode ?? user?.RoleCode ?? user?.roleName ?? user?.RoleName ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
  return ROLE_CODE_TO_GUID[roleKey] || ""
}

export const resolveUserRoleGuid = getUserRoleGuid

/** API may return studyDocShowRoleGuids[] or legacy studyDocShowRoleGuid CSV string. */
export const pickStudyDocShowRoleGuidsFromSettings = (studySettingsData) => {
  if (!studySettingsData || typeof studySettingsData !== "object") return []
  return parseStudyDocShowRoleGuids(
    studySettingsData.studyDocShowRoleGuids ??
      studySettingsData.StudyDocShowRoleGuids ??
      studySettingsData.studyDocShowRoleGuid ??
      studySettingsData.StudyDocShowRoleGuid,
  )
}

/**
 * True when study settings lists this user's role in studyDocShowRoleGuids.
 * Empty list → no access. Matches roleGuid or roleCode/roleName (e.g. CRC).
 */
export const userCanViewStudyDocuments = (user, studySettingsData) => {
  if (!studySettingsData || typeof studySettingsData !== "object") return false
  if (!pickIsStudyDocumentsEnabled(studySettingsData)) return false
  const userGuid = getUserRoleGuid(user)
  if (!userGuid) return false
  const allowed = pickStudyDocShowRoleGuidsFromSettings(studySettingsData)
  if (!allowed.length) return false
  const userNorm = userGuid.toLowerCase()
  return allowed.some((g) => g.toLowerCase() === userNorm)
}

/** Keep only studies with Study documents enabled in Study Settings. */
export async function filterStudiesWithStudyDocumentsEnabled(studies) {
  if (!Array.isArray(studies) || studies.length === 0) return []

  const results = await Promise.all(
    studies.map(async (study) => {
      const id = study?.id ?? study?.Id ?? study?.studyId ?? study?.StudyId
      const numericId = Number.parseInt(String(id), 10)
      if (!Number.isFinite(numericId) || numericId <= 0) return null

      try {
        const settings = await fetchStudySettingsByStudyId(numericId)
        if (pickIsStudyDocumentsEnabled(settings?.data ?? settings)) {
          return study
        }
      } catch {
        /* skip study on settings read failure */
      }
      return null
    }),
  )

  return results.filter(Boolean)
}

/** Keep only studies with Remote SDV enabled in Study Settings. */
export async function filterStudiesWithRemoteSdvEnabled(studies) {
  if (!Array.isArray(studies) || studies.length === 0) return []

  const results = await Promise.all(
    studies.map(async (study) => {
      const id = study?.id ?? study?.Id ?? study?.studyId ?? study?.StudyId
      const numericId = Number.parseInt(String(id), 10)
      if (!Number.isFinite(numericId) || numericId <= 0) return null

      try {
        const settings = await fetchStudySettingsByStudyId(numericId)
        if (pickIsRemoteSdvEnabled(settings?.data ?? settings)) {
          return study
        }
      } catch {
        /* skip study on settings read failure */
      }
      return null
    }),
  )

  return results.filter(Boolean)
}

export const hasStudySettingsSummary = (data) => {
  if (data == null || typeof data !== "object") return false
  const id = data.studyId ?? data.StudyId ?? data.id ?? data.Id
  if (id !== undefined && id !== null && String(id).trim() !== "") return true
  return (
    data.isPatientStatusEnabled !== undefined ||
    data.IsPatientStatusEnabled !== undefined ||
    data.isAgreementEnabled !== undefined ||
    data.IsAgreementEnabled !== undefined ||
    data.isSitePaymentEnabled !== undefined ||
    data.IsSitePaymentEnabled !== undefined ||
    data.queryRaiseRoleGuids !== undefined ||
    data.QueryRaiseRoleGuids !== undefined ||
    data.sdvRoleGuids !== undefined ||
    data.SdvRoleGuids !== undefined ||
    data.reviewOrder !== undefined ||
    data.ReviewOrder !== undefined ||
    data.piSignoffGranularity !== undefined ||
    data.PiSignoffGranularity !== undefined ||
    data.studyDocShowRoleGuids !== undefined ||
    data.StudyDocShowRoleGuids !== undefined ||
    data.useStudyRolePermissionMatrix !== undefined ||
    data.UseStudyRolePermissionMatrix !== undefined ||
    data.isCdashEnabled !== undefined ||
    data.IsCdashEnabled !== undefined
  )
}

const STUDIES_LIST_KEY = "studiesList"
const STUDIES_LIST_TIME_KEY = "studiesListTime"

/** Drop cached accessible-studies list so agreement gate re-reads API flags. */
export function invalidateAccessibleStudiesCache() {
  if (typeof window === "undefined") return
  localStorage.removeItem(STUDIES_LIST_KEY)
  localStorage.removeItem(STUDIES_LIST_TIME_KEY)
}

/** Always fetch accessible studies and refresh localStorage (no TTL shortcut). */
export async function fetchAccessibleStudiesListFresh() {
  if (typeof window === "undefined") return []
  try {
    const response = await studyService.getAccessibleStudiesWithSites(StudyFilter.Active)
    if (response?.isSuccess && response.data) {
      const studies = Array.isArray(response.data) ? response.data : []
      localStorage.setItem(STUDIES_LIST_KEY, JSON.stringify(studies))
      localStorage.setItem(STUDIES_LIST_TIME_KEY, String(Date.now()))
      return studies
    }
  } catch (e) {
    console.warn("[studySettingsRead] fetchAccessibleStudiesListFresh failed", e)
  }
  return readStudiesListFromCache()
}

/**
 * Use cached accessible studies when fresh; otherwise fetch from API.
 * Keeps agreement gate responsive after study/site selection.
 */
export async function ensureAccessibleStudiesList({ maxAgeMs = 120_000 } = {}) {
  if (typeof window === "undefined") return []
  const cached = readStudiesListFromCache()
  const cachedAt = Number.parseInt(localStorage.getItem(STUDIES_LIST_TIME_KEY) || "0", 10)
  if (cached.length > 0 && Number.isFinite(cachedAt) && Date.now() - cachedAt < maxAgeMs) {
    return cached
  }
  return fetchAccessibleStudiesListFresh()
}

function readStudiesListFromCache() {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STUDIES_LIST_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function findStudyInAccessibleList(studyId) {
  const numericId = Number.parseInt(String(studyId), 10)
  if (!Number.isFinite(numericId) || numericId <= 0) return null
  return (
    readStudiesListFromCache().find((s) => {
      const id = s?.id ?? s?.Id ?? s?.studyId ?? s?.StudyId
      return Number.parseInt(String(id), 10) === numericId
    }) ?? null
  )
}

/** From GET accessible studies — used when settings summary has no agreement flag. */
export function pickIsAgreementEnabledFromStudiesList(studyId) {
  const study = findStudyInAccessibleList(studyId)
  if (!study) return null
  const raw = study.isAgreementEnabled ?? study.IsAgreementEnabled
  if (raw === undefined || raw === null) return null
  return toStudySettingBool(raw)
}

export function pickIsAgreementSignedFromStudiesList(studyId) {
  const study = findStudyInAccessibleList(studyId)
  if (!study) return null
  const raw = study.isAgreementSigned ?? study.IsAgreementSigned
  if (raw === undefined || raw === null) return null
  return toStudySettingBool(raw)
}

/**
 * Agreement enabled for a study.
 * Accessible studies list wins when true (CRC assignment API).
 * Settings API used when list missing or both agree disabled.
 */
export function resolveIsAgreementEnabled(studyId, settingsData) {
  const fromList = pickIsAgreementEnabledFromStudiesList(studyId)
  if (fromList === true) return true

  if (settingsData != null && typeof settingsData === "object") {
    const hasExplicit =
      settingsData.isAgreementEnabled !== undefined ||
      settingsData.IsAgreementEnabled !== undefined
    if (hasStudySettingsSummary(settingsData) && hasExplicit) {
      const fromSettings = pickIsAgreementEnabled(settingsData)
      if (fromSettings === false) return false
      if (fromSettings === true) return true
    }
  }

  if (fromList !== null) return fromList

  if (settingsData != null && hasStudySettingsSummary(settingsData)) {
    return pickIsAgreementEnabled(settingsData)
  }

  return null
}

/** CDASH enabled for a study (settings API only). */
export function resolveIsCdashEnabled(studyId, settingsData) {
  if (settingsData != null && hasStudySettingsSummary(settingsData)) {
    return pickIsCdashEnabled(settingsData)
  }
  return null
}

function hasBulkPiSignoffFlagInPayload(data) {
  if (!data || typeof data !== "object") return false
  return (
    Object.prototype.hasOwnProperty.call(data, "isPiSignoffBulkEnabled") ||
    Object.prototype.hasOwnProperty.call(data, "IsPiSignoffBulkEnabled") ||
    Object.prototype.hasOwnProperty.call(data.studySetting ?? {}, "isPiSignoffBulkEnabled") ||
    Object.prototype.hasOwnProperty.call(data.studySetting ?? {}, "IsPiSignoffBulkEnabled")
  )
}

/** Drop cached rows saved before API returned bulk PI sign-off (field absent while PI is on). */
function isStaleStudySettingsCacheResult(result) {
  const data = result?.data
  if (!data || typeof data !== "object") return false
  if (!pickIsPiSignoffRequired(data)) return false
  return !hasBulkPiSignoffFlagInPayload(data)
}

function readSessionEntry(studyKey) {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(`${SESSION_PREFIX}${studyKey}`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.ts || Date.now() - parsed.ts > CACHE_TTL_MS) {
      sessionStorage.removeItem(`${SESSION_PREFIX}${studyKey}`)
      return null
    }
    if (isStaleStudySettingsCacheResult(parsed.result)) {
      sessionStorage.removeItem(`${SESSION_PREFIX}${studyKey}`)
      return null
    }
    return parsed.result
  } catch {
    return null
  }
}

function writeSessionEntry(studyKey, result) {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(
      `${SESSION_PREFIX}${studyKey}`,
      JSON.stringify({ ts: Date.now(), result }),
    )
  } catch {
    /* quota or private mode */
  }
}

function normalizeStudySettingsApiResult(res, source) {
  if (!res?.isSuccess) return null
  const data = res.data ?? null
  return {
    isSuccess: true,
    data: data === undefined ? null : data,
    statusCode: res.statusCode ?? res.httpStatus,
    message: res.message,
    source,
  }
}

async function fetchSummarySettings(numericId) {
  const res = await studyService.getStudySettings(numericId)
  return { res, normalized: normalizeStudySettingsApiResult(res, "studies") }
}

async function fetchFullSettings(numericId) {
  const res = await studySettingsService.getByStudyId(numericId)
  return { res, normalized: normalizeStudySettingsApiResult(res, "studySettings") }
}

async function requestStudySettingsFromApi(numericId, { preferFullEndpoint = false } = {}) {
  const [primary, fallback] = preferFullEndpoint
    ? [fetchFullSettings, fetchSummarySettings]
    : [fetchSummarySettings, fetchFullSettings]

  const primaryResult = await primary(numericId)
  if (primaryResult.normalized) return primaryResult.normalized

  const fallbackResult = await fallback(numericId)
  if (fallbackResult.normalized) return fallbackResult.normalized

  const primaryRes = primaryResult.res
  const fallbackRes = fallbackResult.res
  const statusCode =
    primaryRes?.statusCode ??
    primaryRes?.httpStatus ??
    fallbackRes?.statusCode ??
    fallbackRes?.httpStatus

  return {
    isSuccess: false,
    data: null,
    statusCode,
    message: primaryRes?.message || fallbackRes?.message || "Failed to fetch study settings",
    source: preferFullEndpoint ? "studySettings" : "studies",
    attemptedSources: preferFullEndpoint ? ["studySettings", "studies"] : ["studies", "studySettings"],
  }
}

export function mergeAllStudySettingsOverlays(studyId, data) {
  if (!data || typeof data !== "object") return data
  return mergeStudyDocumentsSettingsOverlay(
    studyId,
    mergePatientIdentifierSettingsOverlay(
      studyId,
      mergeSystemSiteSettingsOverlay(studyId, data),
    ),
  )
}

function withOptionalStudySettingsOverlays(studyId, result, skipOverlays = false) {
  if (skipOverlays || result?.data == null) return result
  return {
    ...result,
    data: mergeAllStudySettingsOverlays(studyId, result.data),
  }
}

/**
 * @returns {Promise<{ isSuccess: boolean, data: object|null, statusCode?: number, message?: string, source?: string }>}
 */
export async function fetchStudySettingsByStudyId(
  studyId,
  {
    forceRefresh = false,
    preferFullEndpoint = false,
    skipSystemSiteOverlay = false,
    skipOverlays = false,
  } = {},
) {
  const skipAllOverlays = skipOverlays || skipSystemSiteOverlay
  const numericId = Number.parseInt(String(studyId), 10)
  if (!Number.isFinite(numericId) || numericId <= 0) {
    return { isSuccess: false, data: null, message: "Invalid study ID" }
  }

  const key = String(numericId)

  if (!forceRefresh) {
    const mem = memoryCache.get(key)
    if (mem && Date.now() - mem.ts < CACHE_TTL_MS) {
      if (isStaleStudySettingsCacheResult(mem.result)) {
        memoryCache.delete(key)
        if (typeof window !== "undefined") {
          sessionStorage.removeItem(`${SESSION_PREFIX}${key}`)
        }
      } else if (mem.result?.data != null) {
        return withOptionalStudySettingsOverlays(numericId, mem.result, skipAllOverlays)
      } else if (mem.result) {
        return mem.result
      }
    }
    const sessionResult = readSessionEntry(key)
    if (sessionResult) {
      const merged = withOptionalStudySettingsOverlays(numericId, sessionResult, skipAllOverlays)
      memoryCache.set(key, { result: merged, ts: Date.now() })
      return merged
    }
  }

  const existing = inFlight.get(key)
  if (existing) return existing

  const promise = requestStudySettingsFromApi(numericId, { preferFullEndpoint })
    .then((result) => {
      if (result?.isSuccess && result.data != null) {
        const stored = {
          ...result,
          data: mergeAllStudySettingsOverlays(numericId, result.data),
        }
        memoryCache.set(key, { result: stored, ts: Date.now() })
        writeSessionEntry(key, stored)
        return withOptionalStudySettingsOverlays(numericId, result, skipAllOverlays)
      }
      if (result?.isSuccess) {
        memoryCache.set(key, { result, ts: Date.now() })
        writeSessionEntry(key, result)
      }
      return result
    })
    .finally(() => {
      inFlight.delete(key)
    })

  inFlight.set(key, promise)
  return promise
}

/** Read cached settings without triggering API (null if not cached). */
export function getCachedStudySettings(studyId) {
  const numericId = Number.parseInt(String(studyId), 10)
  const key = String(numericId)
  if (!key || key === "NaN") return null
  const mem = memoryCache.get(key)
  const result = mem && Date.now() - mem.ts < CACHE_TTL_MS ? mem.result : readSessionEntry(key)
  if (!result) return null
  if (result.data != null) {
    return {
      ...result,
      data: mergeAllStudySettingsOverlays(numericId, result.data),
    }
  }
  return result
}

export function clearStudySettingsCache(studyId) {
  if (studyId != null && String(studyId).trim() !== "") {
    const key = String(studyId)
    memoryCache.delete(key)
    inFlight.delete(key)
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(`${SESSION_PREFIX}${key}`)
    }
  } else {
    memoryCache.clear()
    inFlight.clear()
    if (typeof window !== "undefined") {
      Object.keys(sessionStorage).forEach((k) => {
        if (k.startsWith(SESSION_PREFIX)) sessionStorage.removeItem(k)
      })
    }
  }
}
