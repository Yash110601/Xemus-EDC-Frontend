/**
 * CDISC regulatory export — ODM, SDTM, Define-XML, submission package.
 * GET /api/CdiscExport/filter-options | /export | POST /validate | /export-jobs
 */

import { API_CONFIG } from "../api/config"
import apiClient from "../api/client"
import logger from "../api/logger"
import { normalizeSdvFilterOptionsResponse } from "../reports/sdvReportFilterOptions"
import { buildSdvFilterOptionsQueryParams } from "./sdvReport.service"

export const CDISC_EXPORT_FORMATS = [
  { key: "package_regulatory", label: "Extended regulatory package", description: "ODM + SDTM CSV/XPT + define + aCRF PDF + ADaM ADSL (ZIP)" },
  { key: "package", label: "Full submission package", description: "ODM + SDTM + define.xml (ZIP)" },
  { key: "odm", label: "ODM clinical snapshot", description: "CDISC ODM 1.3.2 XML" },
  { key: "sdtm", label: "SDTM datasets", description: "DM + SV domains (ZIP)" },
  { key: "sdtm_xpt", label: "SDTM SAS XPT", description: "SDTM domains in .xpt transport format (ZIP)" },
  { key: "define", label: "Define-XML", description: "Define-XML 2.1 metadata" },
  { key: "acrf", label: "Annotated CRF (aCRF)", description: "SDTM mapping reference PDF" },
  { key: "adam", label: "ADaM ADSL", description: "Subject-level analysis dataset (ZIP)" },
]

/** Use async job queue when study-wide export may exceed sync timeout. */
export const CDISC_ASYNC_EXPORT_THRESHOLD = 500

export function buildCdiscExportQueryParams(filters = {}) {
  const params = buildSdvFilterOptionsQueryParams(filters)
  if (filters.crfDesignId) {
    params.set("crfDesignId", String(filters.crfDesignId))
  }
  return params
}

function triggerBrowserDownload(blob, fileName) {
  const downloadUrl = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = downloadUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(downloadUrl)
}

class CdiscExportService {
  async getFilterOptions(params = {}) {
    try {
      const query = buildSdvFilterOptionsQueryParams(params)
      const endpoint = `${API_CONFIG.ENDPOINTS.CDISC_EXPORT.FILTER_OPTIONS}?${query.toString()}`
      const response = await apiClient.get(endpoint)
      if (response?.isSuccess) {
        return { ...response, normalized: normalizeSdvFilterOptionsResponse(response) }
      }
      throw new Error(response?.message || "Failed to load filter options")
    } catch (error) {
      logger.error("CDISC export getFilterOptions failed", error)
      throw error
    }
  }

  async validatePackage(filters = {}, format = "package") {
    try {
      const query = buildCdiscExportQueryParams(filters)
      query.set("format", format)
      const endpoint = `${API_CONFIG.ENDPOINTS.CDISC_EXPORT.VALIDATE}?${query.toString()}`
      const response = await apiClient.post(endpoint, {})
      if (response?.isSuccess) return response.data ?? response.Data
      throw new Error(response?.message || "Validation failed")
    } catch (error) {
      logger.error("CDISC validatePackage failed", error)
      throw error
    }
  }

  async exportCdisc(filters = {}, format = "package", { useAsync = false } = {}) {
    if (useAsync) {
      return this.exportCdiscAsync(filters, format)
    }

    const token = localStorage.getItem("authToken")
    const query = buildCdiscExportQueryParams(filters)
    query.set("format", format)
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CDISC_EXPORT.EXPORT}?${query.toString()}`

    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    })

    const contentType = response.headers.get("content-type") ?? ""

    if (!response.ok) {
      if (contentType.includes("application/json")) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.message || body.Message || `Export failed (${response.status})`)
      }
      throw new Error(`Export failed (${response.status})`)
    }

    const blob = await response.blob()
    const dispo = response.headers.get("content-disposition") ?? ""
    const star = /filename\*=UTF-8''([^;]+)/i.exec(dispo)
    const plain = /filename="?([^";]+)"?/i.exec(dispo)
    const fromHeader = star?.[1] ? decodeURIComponent(star[1]) : plain?.[1]
    const ext = format === "odm" || format === "define" ? "xml" : format === "acrf" ? "pdf" : "zip"
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "")
    const fileName = fromHeader || `cdisc-export-${format}-${stamp}.${ext}`
    triggerBrowserDownload(blob, fileName)
  }

  async exportCdiscAsync(filters = {}, format = "package") {
    const studyId = Number(filters.studyId)
    const body = {
      studyId,
      format,
      siteId: filters.siteId ? Number(filters.siteId) : null,
      visitScheduleId: filters.visitScheduleId ? Number(filters.visitScheduleId) : null,
      patientEnrolmentId: filters.patientEnrolmentId ? Number(filters.patientEnrolmentId) : null,
      crfDesignId: filters.crfDesignId ? Number(filters.crfDesignId) : null,
    }

    const enqueueRes = await apiClient.post(API_CONFIG.ENDPOINTS.CDISC_EXPORT.EXPORT_JOBS, body)
    const jobId = enqueueRes?.data?.jobId ?? enqueueRes?.data?.JobId ?? enqueueRes?.Data?.jobId
    if (!enqueueRes?.isSuccess || !jobId) {
      throw new Error(enqueueRes?.message || "Failed to queue export job")
    }

    const token = localStorage.getItem("authToken")
    const maxAttempts = 120
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      const statusRes = await apiClient.get(API_CONFIG.ENDPOINTS.CDISC_EXPORT.EXPORT_JOB_STATUS(jobId))
      const status = String(statusRes?.data?.status ?? statusRes?.data?.Status ?? "").toLowerCase()
      if (status === "failed") {
        throw new Error(statusRes?.data?.errorMessage || statusRes?.data?.ErrorMessage || "Export job failed")
      }
      if (status === "completed") {
        const downloadUrl = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CDISC_EXPORT.EXPORT_JOB_DOWNLOAD(jobId)}`
        const response = await fetch(downloadUrl, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) throw new Error(`Download failed (${response.status})`)
        const blob = await response.blob()
        const fileName =
          statusRes?.data?.fileName ??
          statusRes?.data?.FileName ??
          `cdisc-export-${format}.zip`
        triggerBrowserDownload(blob, fileName)
        return { jobId, status: "completed" }
      }
    }
    throw new Error("Export job timed out")
  }
}

export default new CdiscExportService()
