/**
 * Generate a system PDF for blank CRF (no browser print).
 * Each page includes: Study & CRF description in header, Created by & Created date in footer.
 */

import { jsPDF } from "jspdf"

const MARGIN = 20
const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const HEADER_HEIGHT = 38
const FOOTER_HEIGHT = 18
const BODY_TOP = MARGIN + HEADER_HEIGHT
const BODY_BOTTOM = PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT
const LINE_HEIGHT = 6
const LABEL_LINE_GAP = 4
const SECTION_GAP = 10

function getLabel(control) {
  const props = control?.properties || {}
  return props.labelText || control?.label || "Field"
}

function formatCreatedAt(createdAt) {
  if (!createdAt) return "—"
  try {
    return new Date(createdAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return String(createdAt)
  }
}

/**
 * Draw header (study, CRF, description) on current page.
 */
function drawHeader(doc, crfData) {
  const studyProtocol = crfData.studyProtocolNumber || crfData.study?.protocolNumber || "—"
  const crfName = crfData.config?.name || crfData.name || "Unnamed CRF"
  const crfDescription = crfData.config?.description || crfData.description || ""
  const studyDescription = crfData.studyDescription || crfData.study?.description || ""

  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.text("Study: " + studyProtocol, MARGIN, MARGIN + 5)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  if (studyDescription) {
    const studyLines = doc.splitTextToSize(studyDescription, PAGE_WIDTH - 2 * MARGIN)
    doc.text(studyLines, MARGIN, MARGIN + 11)
  }
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.text("CRF: " + crfName, MARGIN, MARGIN + 20)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  if (crfDescription) {
    const descLines = doc.splitTextToSize(crfDescription, PAGE_WIDTH - 2 * MARGIN)
    doc.text(descLines, MARGIN, MARGIN + 26)
  }
  doc.setDrawColor(200, 200, 200)
  doc.line(MARGIN, BODY_TOP - 4, PAGE_WIDTH - MARGIN, BODY_TOP - 4)
}

/**
 * Draw footer (created by, created date) on current page.
 */
function drawFooter(doc, crfData) {
  const createdBy = crfData.createdBy || "—"
  const createdDate = formatCreatedAt(crfData.createdAt)
  const y = PAGE_HEIGHT - MARGIN - 8
  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(100, 100, 100)
  doc.text("Created by: " + createdBy, MARGIN, y)
  doc.text("Created date: " + createdDate, PAGE_WIDTH - MARGIN - doc.getTextWidth("Created date: " + createdDate), y)
  doc.setTextColor(0, 0, 0)
  doc.setDrawColor(200, 200, 200)
  doc.line(MARGIN, PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT + 2, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT + 2)
}

/**
 * Generate and download a blank CRF PDF (system-generated, no browser print).
 * @param {Object} crfData - Full CRF with sections, config, studyProtocolNumber, createdBy, createdAt
 * @param {string} [filename] - Optional download filename
 */
export function generateBlankCrfPdf(crfData, filename) {
  if (!crfData) return

  const doc = new jsPDF({ unit: "mm", format: "a4" })
  const studyProtocol = (crfData.studyProtocolNumber || "CRF").replace(/[^a-zA-Z0-9-_]/g, "_")
  const crfName = (crfData.config?.name || crfData.name || "Blank").replace(/[^a-zA-Z0-9-_]/g, "_")
  const defaultName = `Blank_CRF_${studyProtocol}_${crfName}.pdf`
  const finalFilename = filename || defaultName

  let y = BODY_TOP
  const sections = crfData.sections || []

  for (let sIdx = 0; sIdx < sections.length; sIdx++) {
    const section = sections[sIdx]
    const sectionName = section.name || "Section"
    const controls = section.controls || []

    // Section title
    if (y > BODY_BOTTOM - 15) {
      doc.addPage()
      y = BODY_TOP
    }
    doc.setFontSize(11)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(40, 40, 40)
    doc.text(sectionName, MARGIN, y)
    y += SECTION_GAP

    for (let cIdx = 0; cIdx < controls.length; cIdx++) {
      const control = controls[cIdx]
      if (control?.properties?.hidden === true) continue

      const label = getLabel(control)
      const required = control?.properties?.required || control?.properties?.conditionallyRequired
      const labelText = label + (required ? " *" : "")

      if (y > BODY_BOTTOM - 12) {
        doc.addPage()
        y = BODY_TOP
      }

      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(0, 0, 0)
      const lines = doc.splitTextToSize(labelText, PAGE_WIDTH - 2 * MARGIN - 60)
      doc.text(lines, MARGIN, y)
      y += lines.length * LINE_HEIGHT + 2
      doc.setDrawColor(180, 180, 180)
      doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
      y += LABEL_LINE_GAP + LINE_HEIGHT
    }

    y += SECTION_GAP
  }

  // Add header and footer to every page
  const pageCount = doc.internal.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    drawHeader(doc, crfData)
    drawFooter(doc, crfData)
  }

  doc.save(finalFilename)
}

export default generateBlankCrfPdf
