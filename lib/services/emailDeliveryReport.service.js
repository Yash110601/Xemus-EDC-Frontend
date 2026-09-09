/**
 * Email Delivery Report
 * GET /api/email/delivery-report
 * GET /api/email/delivery-report/export — same filters, no paging (CSV, max 5k rows)
 * Bind: data.items.items + data.items.totalCount + data.items.totalPages
 */

import { API_CONFIG } from "../api/config"
import apiClient from "../api/client"
import logger from "../api/logger"
import {
  dateInputToUtcEndIso,
  dateInputToUtcStartIso,
} from "../reports/emailDeliveryReportDisplay"

const MAX_PAGE_SIZE = 100

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

/**
 * @param {Record<string, unknown>} filters
 * @param {{ includePaging?: boolean }} [options]
 */
export function buildEmailDeliveryReportQueryParams(filters = {}, options = {}) {
  const { includePaging = true } = options
  const params = new URLSearchParams()

  const fromUtc =
    filters.fromUtc ||
    dateInputToUtcStartIso(filters.fromDate) ||
    null
  if (fromUtc) params.set("fromUtc", String(fromUtc))

  const toUtc = filters.toUtc || dateInputToUtcEndIso(filters.toDate) || null
  if (toUtc) params.set("toUtc", String(toUtc))

  const emailType = String(filters.emailType ?? "").trim()
  if (emailType) params.set("emailType", emailType)

  const status = String(filters.status ?? "").trim()
  if (status) params.set("status", status)

  const deliveryOutcome = String(filters.deliveryOutcome ?? filters.deliveryStatus ?? "").trim()
  if (deliveryOutcome) params.set("deliveryOutcome", deliveryOutcome)

  const provider = String(filters.provider ?? "").trim()
  if (provider) params.set("provider", provider)

  const studyId = parseInt(String(filters.studyId ?? ""), 10)
  if (Number.isFinite(studyId) && studyId > 0) {
    params.set("studyId", String(studyId))
  }

  const siteId = parseInt(String(filters.siteId ?? ""), 10)
  if (Number.isFinite(siteId) && siteId > 0) {
    params.set("siteId", String(siteId))
  }

  const userId = parseInt(String(filters.userId ?? ""), 10)
  if (Number.isFinite(userId) && userId > 0) {
    params.set("userId", String(userId))
  }

  const toContains = String(filters.toContains ?? "").trim()
  if (toContains) params.set("toContains", toContains)

  const createdByContains = String(filters.createdByContains ?? "").trim()
  if (createdByContains) params.set("createdByContains", createdByContains)

  if (includePaging) {
    const pageNumber = parseInt(String(filters.pageNumber ?? 1), 10)
    params.set(
      "pageNumber",
      String(Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1),
    )

    const pageSize = parseInt(String(filters.pageSize ?? 20), 10)
    const capped =
      Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, MAX_PAGE_SIZE) : 20
    params.set("pageSize", String(capped))
  }

  return params
}

/**
 * Normalizes nested page payload:
 * data.items.items / data.items.totalCount / data.items.totalPages
 */
export function normalizeEmailDeliveryReportPage(response) {
  const data = response?.data ?? response?.Data ?? {}
  const pageBucket = data.items ?? data.Items ?? data

  if (Array.isArray(pageBucket)) {
    return {
      items: pageBucket,
      pageNumber: Number(data.pageNumber ?? data.PageNumber ?? 1) || 1,
      pageSize: Number(data.pageSize ?? data.PageSize ?? pageBucket.length) || 20,
      totalCount: Number(data.totalCount ?? data.TotalCount ?? pageBucket.length) || 0,
      totalPages: Number(data.totalPages ?? data.TotalPages ?? 1) || 1,
    }
  }

  const items = pageBucket?.items ?? pageBucket?.Items ?? []
  return {
    items: Array.isArray(items) ? items : [],
    pageNumber:
      Number(
        pageBucket?.pageNumber ??
          pageBucket?.PageNumber ??
          data.pageNumber ??
          data.PageNumber ??
          1,
      ) || 1,
    pageSize:
      Number(
        pageBucket?.pageSize ??
          pageBucket?.PageSize ??
          data.pageSize ??
          data.PageSize ??
          20,
      ) || 20,
    totalCount: Number(pageBucket?.totalCount ?? pageBucket?.TotalCount ?? 0) || 0,
    totalPages: Number(pageBucket?.totalPages ?? pageBucket?.TotalPages ?? 0) || 0,
  }
}

/**
 * Map API client failures to actionable FE messages (path/UI unchanged).
 * @param {{ isSuccess?: boolean, message?: string, httpStatus?: number, statusCode?: number }} response
 */
function toDeliveryReportLoadError(response) {
  const status = Number(response?.httpStatus ?? response?.statusCode ?? NaN)
  const raw = String(response?.message || "").trim()
  const base = API_CONFIG.BASE_URL

  if (status === 0 || /network error/i.test(raw)) {
    return new Error(
      `Cannot reach Email Delivery API at ${base}. Confirm the .NET API is running (Swagger: ${String(base).replace(/\/api\/?$/, "")}/swagger) and restart npm run dev after changing .env.local.`,
    )
  }
  if (status === 401) {
    return new Error("Authentication required. Please sign in again.")
  }
  if (status === 403) {
    return new Error(
      raw || "You don't have permission to view Email Delivery Report (EMAIL_DELIVERY_REPORT).",
    )
  }
  if (status === 404) {
    return new Error(
      `Email delivery report endpoint not found on ${base}. Backend may be missing GET /api/email/delivery-report — update/restart API or point FE to UAT (NEXT_PUBLIC_DEPLOY_TARGET=uat).`,
    )
  }
  if (status === 408 || /timeout/i.test(raw)) {
    return new Error("Email delivery report timed out. Try a shorter date range or retry.")
  }
  return new Error(raw || "Failed to load email delivery report")
}

class EmailDeliveryReportService {
  async getDeliveryReport(filters = {}) {
    try {
      const query = buildEmailDeliveryReportQueryParams(filters)
      const endpoint = `${API_CONFIG.ENDPOINTS.EMAIL_DELIVERY_REPORT.BASE}?${query.toString()}`
      const response = await apiClient.get(endpoint)
      if (response?.isSuccess) {
        return response
      }
      throw toDeliveryReportLoadError(response || {})
    } catch (error) {
      logger.error("getDeliveryReport failed", {
        message: error?.message,
        statusCode: error?.statusCode ?? error?.httpStatus,
        baseUrl: API_CONFIG.BASE_URL,
      })
      // Normalize plain API envelopes that slipped through as thrown objects
      if (error && typeof error === "object" && error.isSuccess === false && !(error instanceof Error)) {
        throw toDeliveryReportLoadError(error)
      }
      throw error
    }
  }

  /**
   * CSV export — same filters as grid, no pageNumber/pageSize.
   * GET /api/email/delivery-report/export?...
   * Permission: EMAIL_DELIVERY_REPORT Export
   * File: email-delivery-report-yyyyMMddHHmmss.csv (UTF-8 BOM); cap 5,000 rows
   */
  async exportDeliveryReport(filters = {}) {
    const token = localStorage.getItem("authToken")
    const query = buildEmailDeliveryReportQueryParams(filters, { includePaging: false })
    const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.EMAIL_DELIVERY_REPORT.EXPORT}?${query.toString()}`

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
        throw new Error(msg)
      }
      throw new Error(`Export failed (${response.status})`)
    }

    const blob = await response.blob()
    const dispo = response.headers.get("content-disposition") ?? ""
    const fromHeader = parseFilenameFromContentDisposition(dispo)

    // Fallback matches backend: email-delivery-report-yyyyMMddHHmmss.csv
    const now = new Date()
    const pad = (n) => String(n).padStart(2, "0")
    const stamp =
      `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
      `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    const fileName = fromHeader || `email-delivery-report-${stamp}.csv`

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

  normalizePage(response) {
    return normalizeEmailDeliveryReportPage(response)
  }
}

export const emailDeliveryReportService = new EmailDeliveryReportService()
export default emailDeliveryReportService
