/**
 * Build CRFViewer preview payload from a CRF Studio export bundle entry.
 */

import { parseHtmlContent } from "@/components/crf-designer/parseHtmlContent"
import { normalizeCrfSections } from "@/lib/utils/crfLabSection"

export function bundleEntryToPreviewCrfData(entry) {
  const design = entry?.bundle?.design
  if (!design?.htmlContent?.trim()) return null

  const sections = normalizeCrfSections(parseHtmlContent(design.htmlContent))
  return {
    config: {
      name: design.name || entry.formName || "Preview",
      description: design.description || "",
      remarks: design.remarks || "",
      isFinalPrint: Boolean(design.isFinalPrint),
      isScreenFailedCrf: Boolean(design.isScreenFailedCrf),
      isRandomizedEnrolledCrf: Boolean(design.isRandomizedEnrolledCrf),
      isStratificationCrf: Boolean(design.isStratificationCrf),
    },
    sections,
    rules: entry.bundle?.rules || [],
    crfFormType: design.crfFormType,
    visit: design.crfFormType,
  }
}

export function parseCoverageReport(json) {
  try {
    const raw = typeof json === "string" ? JSON.parse(json || "{}") : json || {}
    return {
      mappedSectionCount: Number(raw.mappedSectionCount) || 0,
      unmappedAssessments: Array.isArray(raw.unmappedAssessments) ? raw.unmappedAssessments : [],
      acknowledged: Boolean(raw.acknowledged),
      note: raw.note ? String(raw.note) : "",
    }
  } catch {
    return { mappedSectionCount: 0, unmappedAssessments: [], acknowledged: false, note: "" }
  }
}
