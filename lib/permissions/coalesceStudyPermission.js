/**
 * Merge matrix permission with legacy check.
 * `matrixResolved === null` → use legacy (enforcement off or API not ready).
 */
export function coalesceStudyPermission(matrixResolved, legacyValue) {
  if (matrixResolved === null || matrixResolved === undefined) {
    return Boolean(legacyValue)
  }
  return Boolean(matrixResolved)
}

/** Permission keys used at runtime (§4.2). */
export const STUDY_PERMISSION = Object.freeze({
  MODULE_CRF_SHOW: "module.crf.show",
  MODULE_REPORTS_SHOW: "module.reports.show",
  MODULE_DBLOCK_SHOW: "module.dblock.show",
  CRF_VIEW: "crf.view",
  CRF_EDIT: "crf.edit",
  QUERY_CREATE: "query.create",
  QUERY_RESPOND: "query.respond",
  QUERY_CLOSE: "query.close",
  SDV_VERIFY: "sdv.verify",
  RSDV_REVIEW: "rsdv.review",
  PI_SIGNOFF: "pi.signoff",
  DATA_MASKING_VIEW: "data.masking.view",
  REPORT_VIEW: "report.view",
  REPORT_EXPORT: "report.export",
  DBLOCK_VIEW: "dblock.view",
  DBLOCK_APPLY: "dblock.apply",
})
