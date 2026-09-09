import {
  getAuditTrailReasonChangedByLabel,
  pickDtoField,
  toReportDisplay,
} from "@/lib/reports/reportRowDisplay"
import { resolveCrfPdfTheme } from "@/lib/utils/crfPdfTheme"

const MARGIN = 15
const PAGE_WIDTH = 210
const BODY_BOTTOM = 297 - MARGIN - 24

const AUDIT_COLUMNS = [
  { key: "fieldName", label: "Field Name", widthPct: 0.24 },
  { key: "oldValue", label: "Old Value", widthPct: 0.14 },
  { key: "newValue", label: "New Value", widthPct: 0.14 },
  { key: "reason", label: "Reason", widthPct: 0.22 },
  { key: "changedAtUtc", label: "Changed At (UTC)", widthPct: 0.14 },
  { key: "changedBy", label: "Changed By", widthPct: 0.12 },
]

function formatAuditCell(row, key) {
  if (key === "changedBy") return getAuditTrailReasonChangedByLabel(row)
  return toReportDisplay(pickDtoField(row, key))
}

function getColWidths(tableWidth) {
  return AUDIT_COLUMNS.map((c) => tableWidth * c.widthPct)
}

function measureAuditRowHeight(doc, row, colWidths, padding, fontSize) {
  doc.setFont("helvetica", "normal")
  doc.setFontSize(fontSize)
  let maxLines = 1
  AUDIT_COLUMNS.forEach((col, i) => {
    const text = formatAuditCell(row, col.key)
    const w = Math.max(8, colWidths[i] - padding * 2)
    const lines = doc.splitTextToSize(text, w).length
    maxLines = Math.max(maxLines, lines)
  })
  return Math.max(7, padding * 2 + maxLines * 3.8)
}

/**
 * @param {import('jspdf').jsPDF} doc
 * @param {number} y
 * @param {Array<Record<string, unknown>>} rows
 * @param {(doc: import('jspdf').jsPDF) => number} renderNewPageHeader
 * @param {string} [themePreset]
 * @returns {number} next Y
 */
export function drawAuditTrailPdfSection(doc, y, rows, renderNewPageHeader, themePreset = "mac-premium") {
  const theme = resolveCrfPdfTheme(themePreset)
  const tableWidth = PAGE_WIDTH - 2 * MARGIN
  const colWidths = getColWidths(tableWidth)
  const padding = 1.4
  const fontSize = 7
  const headerFontSize = 7.5
  const safeRows = Array.isArray(rows) ? rows : []

  const drawSectionBanner = () => {
    doc.setDrawColor(...theme.colors.sectionBorder)
    doc.setFillColor(...theme.colors.sectionFill)
    doc.roundedRect(MARGIN, y, tableWidth, 7, 1.2, 1.2, "FD")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.setTextColor(48, 56, 76)
    doc.text("AUDIT TRAIL (WITH REASON)", MARGIN + 2.2, y + 4.8)
    doc.setTextColor(0, 0, 0)
    return y + 9
  }

  y = drawSectionBanner()

  if (safeRows.length === 0) {
    doc.setFont("helvetica", "italic")
    doc.setFontSize(8)
    doc.text("No audit trail entries found for this CRF.", MARGIN + 1, y + 4)
    return y + 8
  }

  const drawHeaderRow = () => {
    const headerH = 7
    let x = MARGIN
    AUDIT_COLUMNS.forEach((col, i) => {
      doc.setDrawColor(...theme.colors.sectionBorder)
      doc.setFillColor(...theme.colors.sectionFill)
      doc.rect(x, y, colWidths[i], headerH, "FD")
      doc.rect(x, y, colWidths[i], headerH)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(headerFontSize)
      const lines = doc.splitTextToSize(col.label, Math.max(6, colWidths[i] - padding * 2))
      doc.text(lines, x + padding, y + padding + 2.2)
      x += colWidths[i]
    })
    return y + headerH
  }

  const ensureSpace = (needed) => {
    if (y + needed <= BODY_BOTTOM) return y
    doc.addPage()
    y = typeof renderNewPageHeader === "function" ? renderNewPageHeader() : y
    y = drawSectionBanner()
    y = drawHeaderRow()
    return y
  }

  y = drawHeaderRow()

  safeRows.forEach((row, rowIndex) => {
    const rowH = measureAuditRowHeight(doc, row, colWidths, padding, fontSize)
    y = ensureSpace(rowH)

    let x = MARGIN
    AUDIT_COLUMNS.forEach((col, i) => {
      const text = formatAuditCell(row, col.key)
      doc.setDrawColor(...theme.colors.sectionBorder)
      doc.setFillColor(rowIndex % 2 === 0 ? 255 : 252, rowIndex % 2 === 0 ? 255 : 253, rowIndex % 2 === 0 ? 255 : 254)
      doc.rect(x, y, colWidths[i], rowH, "FD")
      doc.rect(x, y, colWidths[i], rowH)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(fontSize)
      const lines = doc.splitTextToSize(text, Math.max(6, colWidths[i] - padding * 2))
      doc.text(lines, x + padding, y + padding + 2)
      x += colWidths[i]
    })
    y += rowH
  })

  return y
}
