/**
 * Study user CSV bulk import helpers — split large files into API-sized batches.
 */

import { normalizeImportCredentialsForGlobalIndex } from "./studyUserImportCredentialsExport"

/** Rows per API request (keeps each call under gateway timeout). */
export const STUDY_USER_IMPORT_BATCH_SIZE = 25

/** Retries per batch when gateway/proxy returns timeout (502/504). */
export const STUDY_USER_IMPORT_BATCH_RETRY_ATTEMPTS = 1

/** Pause before retrying a timed-out batch. */
export const STUDY_USER_IMPORT_BATCH_RETRY_DELAY_MS = 2000

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Upper bound for one upload; practical limit is CSV file size (50 MB). */
export const STUDY_USER_IMPORT_MAX_DATA_ROWS = 10000

/**
 * Split parsed CSV text into batch File objects (header + chunk rows each).
 */
export function splitCsvTextIntoBatchFiles(csvText, originalFileName, batchSize = STUDY_USER_IMPORT_BATCH_SIZE) {
  const lines = csvText.split(/\r?\n|\r/).filter((line) => line.trim())

  if (lines.length < 2) {
    throw new Error("CSV file must have at least a header row and one data row")
  }

  const header = lines[0]
  const dataLines = lines.slice(1)
  const batches = []
  const baseName = (originalFileName || "import").replace(/\.csv$/i, "")

  for (let i = 0; i < dataLines.length; i += batchSize) {
    const chunkLines = dataLines.slice(i, i + batchSize)
    const csvContent = [header, ...chunkLines].join("\n")
    const batchIndex = Math.floor(i / batchSize) + 1
    const file = new File([csvContent], `${baseName}-batch-${batchIndex}.csv`, { type: "text/csv" })
    batches.push({ file, startDataRowIndex: i, batchIndex, rowCount: chunkLines.length })
  }

  return { batches, totalRows: dataLines.length }
}

export function normalizeFailedRowsForGlobalIndex(failedRows, startDataRowIndex) {
  if (!Array.isArray(failedRows)) return []

  return failedRows.map((row) => {
    const rowNum = typeof row.rowNumber === "number" ? row.rowNumber : parseInt(row.rowNumber, 10)
    const safeRowNum = Number.isFinite(rowNum) ? rowNum : 2
    return {
      ...row,
      rowNumber: safeRowNum + startDataRowIndex,
    }
  })
}

export function mergeChunkImportData(chunkResults) {
  let totalRows = 0
  let successCount = 0
  let failedCount = 0
  let emailSentCount = 0
  let emailFailedCount = 0
  const failedRows = []
  const newUserCredentials = []
  const emailResults = []
  const errors = []
  let aborted = false
  let abortReason = null

  for (const chunk of chunkResults) {
    if (chunk.aborted) {
      aborted = true
      abortReason = chunk.abortReason || chunk.message || null
    }

    const data = chunk.data
    if (!data || typeof data !== "object") {
      if (chunk.message && !chunk.success) {
        errors.push(chunk.message)
      }
      continue
    }

    totalRows += data.totalRows || 0
    successCount += data.successCount || 0
    failedCount += data.failedCount || 0
    emailSentCount += data.emailSentCount ?? data.EmailSentCount ?? 0
    emailFailedCount += data.emailFailedCount ?? data.EmailFailedCount ?? 0

    const chunkFailed =
      data.failedRows || (Array.isArray(data.rows) ? data.rows.filter((r) => !r.isSuccess) : [])
    failedRows.push(...normalizeFailedRowsForGlobalIndex(chunkFailed, chunk.startDataRowIndex || 0))

    const chunkCredentials = data.newUserCredentials || data.NewUserCredentials || []
    if (Array.isArray(chunkCredentials) && chunkCredentials.length > 0) {
      newUserCredentials.push(
        ...normalizeImportCredentialsForGlobalIndex(chunkCredentials, chunk.startDataRowIndex || 0)
      )
    }

    const chunkEmailResults = data.emailResults || data.EmailResults || []
    if (Array.isArray(chunkEmailResults) && chunkEmailResults.length > 0) {
      emailResults.push(...chunkEmailResults)
    }
  }

  return {
    totalRows,
    successCount,
    failedCount,
    emailSentCount,
    emailFailedCount,
    failedRows,
    newUserCredentials,
    emailResults,
    errors,
    aborted,
    abortReason,
  }
}

/**
 * Map API failed-row messages onto the import preview table (global row numbers).
 */
export function applyFailedRowsToImportPreview(importPreview, failedRowsData) {
  if (!failedRowsData?.length || !importPreview?.length) return importPreview

  return importPreview.map((previewRow, index) => {
    const apiRow = failedRowsData.find((r) => {
      const rowNum = typeof r.rowNumber === "number" ? r.rowNumber : parseInt(r.rowNumber, 10)
      return rowNum === index + 2
    })

    const backendError = apiRow?.message || apiRow?.error
    if (apiRow && backendError) {
      return {
        ...previewRow,
        apiError: backendError,
        isFailed: true,
        rawData: apiRow.rawData || previewRow,
      }
    }

    return {
      ...previewRow,
      apiError: null,
      isFailed: false,
    }
  })
}

export function isImportTransportFatal(statusCode, message = "") {
  if (statusCode === 401 || statusCode === 403) return true
  if (statusCode === 502 || statusCode === 504) return true
  const lower = String(message).toLowerCase()
  return lower.includes("gateway timeout") || lower.includes("timed out")
}
