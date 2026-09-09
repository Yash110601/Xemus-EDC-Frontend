/**
 * Patient Visit CRF Status report — CSV export only (GET /api/PatientVisitCrfStatusReport/Export).
 * Auth: Bearer token. Feature: CRF_DATA + Export.
 */

import { API_CONFIG } from "../api/config"

/**
 * @param {{ studyId: string|number, siteId?: string|number, visitScheduleId?: string|number, patientEnrolmentId?: string|number, search?: string }} filters
 * @returns {URLSearchParams}
 */
export function buildPatientVisitCrfStatusExportQuery(filters = {}) {
  const params = new URLSearchParams()
  const studyId = parseInt(String(filters.studyId ?? ""), 10)
  if (!Number.isFinite(studyId) || studyId <= 0) {
    throw new Error("Study is required.")
  }
  params.set("studyId", String(studyId))

  const siteId = parseInt(String(filters.siteId ?? ""), 10)
  if (Number.isFinite(siteId) && siteId > 0) {
    params.set("siteId", String(siteId))
  }

  const visitScheduleId = parseInt(String(filters.visitScheduleId ?? ""), 10)
  if (Number.isFinite(visitScheduleId) && visitScheduleId > 0) {
    params.set("visitScheduleId", String(visitScheduleId))
  }

  const patientEnrolmentId = parseInt(String(filters.patientEnrolmentId ?? ""), 10)
  if (Number.isFinite(patientEnrolmentId) && patientEnrolmentId > 0) {
    params.set("patientEnrolmentId", String(patientEnrolmentId))
  }

  const search = String(filters.search ?? "").trim()
  if (search) {
    params.set("search", search)
  }

  return params
}

function parseFilenameFromContentDisposition(headerValue) {
  if (!headerValue) return null
  const star = /filename\*=UTF-8''([^;]+)/i.exec(headerValue)
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].replace(/(^")|("$)/g, ""))
    } catch {
      return star[1]
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(headerValue)
  return plain?.[1] ?? null
}

class PatientVisitCrfStatusReportService {
  /**
   * Downloads CSV. On non-OK: parses JSON envelope when Content-Type is JSON.
   * @param {{ studyId: string|number, siteId?: string|number, visitScheduleId?: string|number, patientEnrolmentId?: string|number, search?: string }} filters
   */
  async exportPatientVisitCrfStatusReport(filters = {}) {
    const token = localStorage.getItem("authToken")
    const query = buildPatientVisitCrfStatusExportQuery(filters)
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PATIENT_VISIT_CRF_STATUS_REPORT.EXPORT}?${query.toString()}`

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const contentType = response.headers.get("content-type") ?? ""

    if (!response.ok) {
      if (contentType.includes("application/json")) {
        const body = await response.json().catch(() => ({}))
        const msg = body.message || body.Message || `Export failed (${response.status})`
        const err = new Error(msg)
        err.errors = body.errors || body.Errors
        throw err
      }
      throw new Error(`Export failed (${response.status})`)
    }

    const blob = await response.blob()
    const dispo = response.headers.get("content-disposition") ?? ""
    const fromHeader = parseFilenameFromContentDisposition(dispo)
    const fallback = `patient-visit-crf-status-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "")}.xlsx`
    const fileName = fromHeader || fallback

    const downloadUrl = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = downloadUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(downloadUrl)
    return { success: true, filename: fileName }
  }
}

export default new PatientVisitCrfStatusReportService()
