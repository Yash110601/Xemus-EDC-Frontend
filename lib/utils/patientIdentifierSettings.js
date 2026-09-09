import { DEFAULT_SCREENING_NUMBER_MASK } from "@/lib/utils/patientIdentifierSettingsOverlay"

export { DEFAULT_SCREENING_NUMBER_MASK }

/**
 * Preview how the next screening / SUBJID may look for a study mask.
 * @param {string} mask
 * @param {{ study?: string, site?: string, seq?: number }} context
 */
export function previewScreeningNumberMask(mask, context = {}) {
  const template = String(mask || DEFAULT_SCREENING_NUMBER_MASK).trim() || DEFAULT_SCREENING_NUMBER_MASK
  const study = String(context.study ?? "STUDY").trim() || "STUDY"
  const site = String(context.site ?? "101").trim() || "101"
  const seq = Math.max(1, Number.parseInt(String(context.seq ?? 1), 10) || 1)

  return template.replace(/\{SEQ:(\d+)\}/gi, (_, width) => {
    const pad = Math.max(1, Number.parseInt(width, 10) || 3)
    return String(seq).padStart(pad, "0")
  }).replace(/\{STUDY\}/gi, study)
    .replace(/\{SITE\}/gi, site)
    .replace(/\{SUBJID\}/gi, `S-${site}-${String(seq).padStart(3, "0")}`)
}
