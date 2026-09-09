import { authService } from "@/lib/services"
import { pickDtoField, toReportDisplay } from "@/lib/reports/reportRowDisplay"
import { resolveReportMenuPermissions } from "@/lib/reports/reportMenuPermissions"
import { formatAppDateTime } from "@/lib/utils/appDateTime"
import { CRF_AI_ENTRY_TYPE } from "@/lib/utils/crfAiEntry"

const AI_ENTRY_REPORT_CODE = "AI_ENTRY_REPORT"

/** Menu permissions for AI_ENTRY_REPORT (View / Export). */
export function resolveAiEntryReportMenuPermissions() {
  return resolveReportMenuPermissions(
    authService.getMenu?.(),
    "/reports/ai-entry-report",
    AI_ENTRY_REPORT_CODE,
  )
}

export function formatAiEntryAtUtc(value) {
  if (value === null || value === undefined) return "-"
  const text = formatAppDateTime(value)
  return text === "—" ? "-" : text
}

export function formatAiEntryTypeLabel(value) {
  const raw = String(value ?? "").trim()
  if (!raw) return "-"
  if (/^1$|^voicetotext$/i.test(raw) || raw === CRF_AI_ENTRY_TYPE.VoiceToText) {
    return "Voice To Text"
  }
  if (/^2$|^fileupload$/i.test(raw) || raw === CRF_AI_ENTRY_TYPE.FileUpload) {
    return "File Upload"
  }
  return raw
}

/** @deprecated Use validateReportPatientCascadeFilters from reportPatientCascadeFilters */
export { validateReportPatientCascadeFilters as validateAiEntryReportFilterCascade } from "@/lib/reports/reportPatientCascadeFilters"

export function formatAiEntryBooleanLabel(value) {
  if (value === true || value === 1 || String(value).toLowerCase() === "true") return "Yes"
  if (value === false || value === 0 || String(value).toLowerCase() === "false") return "No"
  return toReportDisplay(value)
}

export function getAiEntryByLabel(row) {
  if (!row || typeof row !== "object") return "-"
  const name = row.aiEntryByName ?? row.AiEntryByName
  if (toReportDisplay(name) !== "-") return name
  const id = row.aiEntryBy ?? row.AiEntryBy ?? row.aiEntryByUserId ?? row.AiEntryByUserId
  return toReportDisplay(id)
}

export function getAiPatientIdDisplay(row) {
  return toReportDisplay(pickDtoField(row, "patientEnrolmentId"))
}
