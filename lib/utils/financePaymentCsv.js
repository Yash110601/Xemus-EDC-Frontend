import { getRowPaymentRules } from "@/lib/utils/paymentRuleProgress"

export function normalizeCsvHeaderName(header) {
  return String(header ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

/**
 * Detect bulk payment CSV shape from header row.
 * @returns {"paymentRules" | "legacy" | "unknown"}
 */
export function detectPaymentCsvFormat(headers = []) {
  const names = headers.map(normalizeCsvHeaderName)
  const has = (name) => names.includes(name)

  if (has("sitepaymentruleprogressid")) return "paymentRules"
  if (has("sitemilestoneid") || has("sitevisitid")) return "legacy"
  if (has("id") && has("studyuserid")) return "paymentRules"
  return "unknown"
}

export function studyListUsesPaymentRules(rows) {
  return (rows ?? []).some((row) => getRowPaymentRules(row).length > 0)
}

/**
 * Client-side checks before POST ImportPaymentDetails.
 * Backend remains authoritative; this blocks obvious column mismatches.
 */
export function validatePaymentImportCsv({ headers, studyUsesPaymentRules }) {
  const warnings = []
  const errors = []
  const format = detectPaymentCsvFormat(headers)
  const names = headers.map(normalizeCsvHeaderName)

  if (!names.includes("studyuserid")) {
    errors.push("StudyUserId column is required on every row.")
  }

  if (studyUsesPaymentRules) {
    if (format === "legacy") {
      errors.push(
        "This study uses payment rules. CSV Id must be SitePaymentRuleProgressId — remove SiteMilestoneId / SiteVisitId and use Download payment template.",
      )
    } else if (format === "unknown") {
      warnings.push(
        "Expected Id (SitePaymentRuleProgressId) and StudyUserId. Download the payment template for column layout.",
      )
    }
  } else if (format === "paymentRules" && names.includes("sitepaymentruleprogressid")) {
    warnings.push(
      "This study has no payment rules configured yet. Run Migrate legacy or Apply template first if you intended rule-based payments.",
    )
  }

  return { format, warnings, errors }
}

export const PAYMENT_CSV_RULES_HINT =
  "Payment CSV: Id = SitePaymentRuleProgressId; StudyUserId required on every row. Use Download payment template."

export const PAYMENT_CSV_LEGACY_HINT =
  "Payment CSV: Id = SiteMilestoneId or SiteVisitId (legacy). Use Download payment template for column layout."
