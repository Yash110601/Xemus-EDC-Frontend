import { pickDtoField } from "@/lib/reports/reportRowDisplay"
import { pickIsPiSignoffRequired } from "@/lib/utils/studySettingsRead"

export function parseIsPiSignoffEnabledFromSettingsResponse(res) {
  const data = res?.data ?? res?.Data ?? null
  if (!data || typeof data !== "object") return false
  const root =
    data.studySetting && typeof data.studySetting === "object"
      ? { ...data.studySetting, ...data }
      : data
  return pickIsPiSignoffRequired(root)
}

export function normalizePiSignoffReportSummary(raw) {
  const data = raw ?? {}
  return {
    totalSubmittedCrfs: Number(pickDtoField(data, "totalSubmittedCrfs") ?? 0) || 0,
    piSignedCrfs: Number(pickDtoField(data, "piSignedCrfs") ?? 0) || 0,
    piPendingCrfs: Number(pickDtoField(data, "piPendingCrfs") ?? 0) || 0,
    piVoidedCrfs: Number(pickDtoField(data, "piVoidedCrfs") ?? 0) || 0,
    totalEligibleFields: Number(pickDtoField(data, "totalEligibleFields") ?? 0) || 0,
    piSignedFields: Number(pickDtoField(data, "piSignedFields") ?? 0) || 0,
    piPendingFields: Number(pickDtoField(data, "piPendingFields") ?? 0) || 0,
  }
}

export function normalizeSdvReportSummary(raw) {
  const data = raw ?? {}
  return {
    totalCrfs: Number(pickDtoField(data, "totalCrfs") ?? 0) || 0,
    totalFields: Number(pickDtoField(data, "totalFields") ?? 0) || 0,
    sdvApprovedFields: Number(pickDtoField(data, "sdvApprovedFields") ?? 0) || 0,
    sdvPendingFields: Number(pickDtoField(data, "sdvPendingFields") ?? 0) || 0,
    formSdvVerifiedCount: Number(pickDtoField(data, "formSdvVerifiedCount") ?? 0) || 0,
  }
}

export function getPiSignoffPatientIdDisplay(row) {
  const id = pickDtoField(row, "patientEnrolmentId")
  const initial = pickDtoField(row, "patientInitial")
  if (id != null && initial) return `${id} (${initial})`
  if (id != null) return String(id)
  return initial ? String(initial) : "-"
}
