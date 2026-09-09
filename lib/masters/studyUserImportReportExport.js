/**
 * Export CRC bulk import results as a single Excel workbook (Summary, Success, Failed, Combined).
 */

import * as XLSX from "xlsx"
import { normalizeImportCredentials } from "./studyUserImportCredentialsExport"

function normalizeFailedRowForExport(row) {
  if (!row || typeof row !== "object") return { rowNumber: "", error: "Unknown error" }

  const flat = {}
  for (const [key, value] of Object.entries(row)) {
    const label =
      key === "rowNumber"
        ? "Row"
        : key === "error" || key === "message"
          ? "Error"
          : key
    flat[label] = value ?? ""
  }

  if (!flat.Row && (row.rowNumber != null || row.RowNumber != null)) {
    flat.Row = row.rowNumber ?? row.RowNumber
  }
  if (!flat.Error && (row.error || row.message || row.Message)) {
    flat.Error = row.error || row.message || row.Message
  }

  return flat
}

function buildSuccessRows(credentials) {
  return normalizeImportCredentials(credentials).map((row) => ({
    Row: row.rowNumber,
    "Doctor Name": row.doctorName,
    Email: row.email,
    Username: row.username,
    "Generated Password": row.generatedPassword,
    "Email Sent": row.emailSent === true ? "Yes" : row.emailSent === false ? "No" : "",
    "Email Error": row.emailError || "",
    Status: "Success (new login)",
  }))
}

function buildCombinedRows({ failedRows = [], credentials = [] }) {
  const failed = failedRows.map((row) => ({
    ...normalizeFailedRowForExport(row),
    Status: "Failed",
  }))
  const success = buildSuccessRows(credentials).map((row) => ({
    Row: row.Row,
    "Doctor Name": row["Doctor Name"],
    Email: row.Email,
    Error: "",
    Status: row.Status,
    "Email Sent": row["Email Sent"],
    "Email Error": row["Email Error"],
  }))
  return [...failed, ...success]
}

function appendSheet(workbook, rows, sheetName, emptyMessage = "No rows") {
  const sheet =
    rows.length > 0
      ? XLSX.utils.json_to_sheet(rows)
      : XLSX.utils.aoa_to_sheet([[emptyMessage]])
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName)
}

/**
 * @param {{
 *   summary?: { totalRows?: number, successCount?: number, failedCount?: number, emailSentCount?: number, emailFailedCount?: number, newLoginCount?: number },
 *   failedRows?: Array<object>,
 *   newUserCredentials?: Array<object>,
 * }} payload
 * @param {string} [filename]
 */
export function downloadStudyUserImportReportWorkbook(payload, filename) {
  const failedRows = Array.isArray(payload?.failedRows) ? payload.failedRows : []
  const credentials = Array.isArray(payload?.newUserCredentials) ? payload.newUserCredentials : []
  const summary = payload?.summary || {}

  const workbook = XLSX.utils.book_new()

  const summaryRows = [
    ["CRC Bulk Import Report"],
    ["Generated", new Date().toLocaleString()],
    [],
    ["Metric", "Value"],
    ["Total rows processed", summary.totalRows ?? 0],
    ["Successful users", summary.successCount ?? 0],
    ["Failed rows", summary.failedCount ?? 0],
    ["New logins created", summary.newLoginCount ?? credentials.length],
    ["Credential emails sent", summary.emailSentCount ?? 0],
    ["Credential emails failed", summary.emailFailedCount ?? 0],
  ]
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows), "Summary")

  appendSheet(workbook, buildSuccessRows(credentials), "Success", "No new login accounts in this import")
  appendSheet(
    workbook,
    failedRows.map(normalizeFailedRowForExport),
    "Failed",
    "No failed rows",
  )
  appendSheet(
    workbook,
    buildCombinedRows({ failedRows, credentials }),
    "Combined",
    "No import rows to display",
  )

  const stamp = new Date().toISOString().split("T")[0]
  const safeName = filename || `crc-import-report-${stamp}.xlsx`
  XLSX.writeFile(workbook, safeName)
  return true
}
