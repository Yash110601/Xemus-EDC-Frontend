import { authService } from "@/lib/services"
import { pickDtoField, toReportDisplay } from "@/lib/reports/reportRowDisplay"
import { resolveReportMenuPermissions } from "@/lib/reports/reportMenuPermissions"

const SDV_REPORT_CODE = "SDV_REPORT"

/** Menu permissions for SDV_REPORT (View / Export). */
export function resolveSdvReportMenuPermissions() {
  return resolveReportMenuPermissions(
    authService.getMenu?.(),
    "/reports/sdv-report",
    SDV_REPORT_CODE
  )
}

import { pickSdvRoleGuidsFromSettings, isSdvConfigured } from "@/lib/utils/studySettingsRead"

/** Study settings — SDV is configured when sdvRoleGuids is non-empty. */
export function parseIsSdvConfiguredFromSettingsResponse(res) {
  const payload = res?.data
  if (!payload || typeof payload !== "object") return false
  const data = {
    ...(payload?.studySetting && typeof payload.studySetting === "object" ? payload.studySetting : {}),
    ...payload,
  }
  return isSdvConfigured(pickSdvRoleGuidsFromSettings(data))
}

/** @deprecated Use parseIsSdvConfiguredFromSettingsResponse — isSdvEnabled removed from API. */
export function parseIsSdvEnabledFromSettingsResponse(res) {
  return parseIsSdvConfiguredFromSettingsResponse(res)
}

/** Display SDV approved timestamp with UTC suffix (API values are UTC). */
export function formatSdvApprovedAtUtc(value) {
  if (value === null || value === undefined) return "-"
  const text = String(value).trim()
  if (!text) return "-"
  if (/utc/i.test(text)) return text
  return `${text} UTC`
}

export function formatSdvYesNo(value) {
  if (value === true) return "Yes"
  if (value === false) return "No"
  return "-"
}

export function getSdvApprovedByLabel(row) {
  if (!row || typeof row !== "object") return "-"
  const name = row.sdvApprovedByName ?? row.SdvApprovedByName
  if (toReportDisplay(name) !== "-") return name
  const id = row.sdvApprovedByUserId ?? row.SdvApprovedByUserId
  return toReportDisplay(id)
}

export function getSdvPatientIdDisplay(row) {
  const id = pickDtoField(row, "patientEnrolmentId")
  return toReportDisplay(id)
}

/**
 * CRF dropdown options for a single visit (from visit row or GetById detail).
 * @param {Record<string, unknown>|null|undefined} visit
 * @param {Array<Record<string, unknown>>} [allCrfDesigns] — study list for name fallback
 */
export function getCrfDesignOptionsForVisit(visit, allCrfDesigns = []) {
  if (!visit || typeof visit !== "object") return []

  const fromArray = Array.isArray(visit.crfDesigns) ? visit.crfDesigns : []
  if (fromArray.length > 0) {
    return fromArray
      .map((d) => {
        const id = d?.crfDesignId ?? d?.id ?? d?.CrfDesignId
        const n = Number(id)
        if (!Number.isFinite(n) || n <= 0) return null
        const name = d?.crfName ?? d?.name ?? d?.CrfName
        return {
          crfDesignId: n,
          id: n,
          crfName: name,
          name: name || `CRF ${n}`,
        }
      })
      .filter(Boolean)
  }

  const singleRaw = visit.crfDesignId ?? visit.crfDesignID ?? visit.CrfDesignId
  const singleId = Number(singleRaw)
  if (!Number.isFinite(singleId) || singleId <= 0) return []

  const match = allCrfDesigns.find((c) => Number(c.crfDesignId ?? c.id) === singleId)
  if (match) return [match]

  const legacyName = visit.crfName ?? visit.CrfName ?? visit.name
  return [
    {
      crfDesignId: singleId,
      id: singleId,
      crfName: legacyName,
      name: legacyName || `CRF ${singleId}`,
    },
  ]
}

export function getSdvFieldCountsDisplay(row) {
  const total = pickDtoField(row, "totalFields")
  const approved = pickDtoField(row, "sdvApprovedFields")
  const pending = pickDtoField(row, "sdvPendingFields")
  if (total === undefined && approved === undefined && pending === undefined) return "-"
  return `${toReportDisplay(total)} / ${toReportDisplay(approved)} / ${toReportDisplay(pending)}`
}
