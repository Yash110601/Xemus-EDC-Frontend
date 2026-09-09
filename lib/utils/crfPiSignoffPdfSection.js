import { PI_SIGNOFF_APPLY_ATTESTATION } from "@/lib/piSignoff/piSignoffAttestation"
import { resolveCrfPdfTheme } from "@/lib/utils/crfPdfTheme"

const MARGIN = 15
const PAGE_WIDTH = 210
const BODY_BOTTOM = 297 - MARGIN - 24

function formatSignedAt(value) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toISOString().replace("T", " ").slice(0, 19) + " UTC"
}

/**
 * @param {import('jspdf').jsPDF} doc
 * @param {number} y
 * @param {Record<string, unknown>|null|undefined} record
 * @param {(doc: import('jspdf').jsPDF) => number} renderNewPageHeader
 * @param {string} [themePreset]
 * @returns {number} next Y
 */
export function drawPiSignoffPdfSection(doc, y, record, renderNewPageHeader, themePreset = "mac-premium") {
  const theme = resolveCrfPdfTheme(themePreset)
  const tableWidth = PAGE_WIDTH - 2 * MARGIN
  const padding = 2
  const rowHeight = 7

  const ensureSpace = (need) => {
    if (y + need <= BODY_BOTTOM) return y
    doc.addPage()
    return renderNewPageHeader()
  }

  y = ensureSpace(12)
  doc.setDrawColor(...theme.colors.sectionBorder)
  doc.setFillColor(...theme.colors.sectionFill)
  doc.roundedRect(MARGIN, y, tableWidth, 7, 1.2, 1.2, "FD")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.setTextColor(48, 56, 76)
  doc.text("PRINCIPAL INVESTIGATOR SIGNATURE", MARGIN + 2.2, y + 4.8)
  doc.setTextColor(0, 0, 0)
  y += 9

  if (!record) {
    doc.setFont("helvetica", "italic")
    doc.setFontSize(8)
    doc.text("PI sign-off not recorded for this CRF.", MARGIN + 1, y + 4)
    return y + 8
  }

  const status = String(record.status ?? record.Status ?? "Pending").trim()
  const signedBy = String(record.signedBy ?? record.SignedBy ?? "—").trim() || "—"
  const signedAt = formatSignedAt(record.signedAt ?? record.SignedAt)
  const comment = String(record.comment ?? record.Comment ?? "").trim()
  const rows = [
    ["Status", status],
    ["Signed by", signedBy],
    ["Signed at", signedAt],
    ["Meaning of signature", PI_SIGNOFF_APPLY_ATTESTATION],
  ]
  if (comment) rows.push(["Comment", comment])

  doc.setDrawColor(...(theme.colors.tableBorder ?? theme.colors.cardBorder ?? theme.colors.sectionBorder))
  doc.setLineWidth(0.2)

  for (const [label, value] of rows) {
    y = ensureSpace(rowHeight + 2)
    doc.setFillColor(248, 250, 252)
    doc.rect(MARGIN, y, tableWidth * 0.32, rowHeight, "F")
    doc.setFillColor(255, 255, 255)
    doc.rect(MARGIN + tableWidth * 0.32, y, tableWidth * 0.68, rowHeight, "F")
    doc.rect(MARGIN, y, tableWidth, rowHeight)
    doc.line(MARGIN + tableWidth * 0.32, y, MARGIN + tableWidth * 0.32, y + rowHeight)

    doc.setFont("helvetica", "bold")
    doc.setFontSize(7.5)
    doc.text(label, MARGIN + padding, y + 4.6)
    doc.setFont("helvetica", "normal")
    const valueLines = doc.splitTextToSize(String(value), tableWidth * 0.68 - padding * 2)
    doc.text(valueLines.slice(0, 2), MARGIN + tableWidth * 0.32 + padding, y + 4.6)
    y += rowHeight
  }

  return y + 2
}
