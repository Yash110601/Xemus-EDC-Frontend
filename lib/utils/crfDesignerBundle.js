/**
 * Portable CRF design bundle (API v1 + designer JSON v2) for UAT → PROD promotion.
 */

import { mapCategoryToApi } from "@/lib/utils/crfDesignerRulesTransfer"
import { collectRulesForExport, normalizePortableRule } from "@/lib/utils/crfDesignerRulesTransfer"

const CATEGORY_API_VALUES = new Set([
  "Show", "Hide", "Enable", "Disable", "Compute", "Validation", "Submit", "Retro", "DateRestriction",
])

const CRF_FORM_TYPE_BY_NUMBER = {
  1: "Screening",
  2: "Baseline",
  3: "Visits",
  4: "UnscheduledVisit",
  5: "AdverseEvent",
  6: "ConcomitantMedication",
  7: "PatientFeedbackForm",
  8: "StudyCompletionForm",
}

export function resolveCrfFormTypeForBundle(value) {
  if (value == null || value === "") return null
  if (typeof value === "number" && CRF_FORM_TYPE_BY_NUMBER[value]) return CRF_FORM_TYPE_BY_NUMBER[value]
  const parsed = Number.parseInt(String(value), 10)
  if (Number.isFinite(parsed) && CRF_FORM_TYPE_BY_NUMBER[parsed]) return CRF_FORM_TYPE_BY_NUMBER[parsed]
  return String(value)
}

export function normalizeRuleForBundle(rule) {
  const portable = normalizePortableRule(rule)
  const category = CATEGORY_API_VALUES.has(portable.category)
    ? portable.category
    : mapCategoryToApi(portable.category)
  return {
    exportKey: rule?.exportKey ?? rule?.id?.toString?.() ?? null,
    ruleName: portable.ruleName,
    category,
    expression: portable.expression,
    message: portable.message,
    severity: portable.severity || "Hard",
    targetField: portable.targetField || "",
    trigger: portable.trigger || "OnChange",
    controlType: portable.controlType || "Label",
    isActive: rule?.isActive !== false,
  }
}

/** Normalize API bundle or legacy designer JSON v2 into ImportBundle request shape. */
export function normalizeToImportBundlePayload(raw, {
  targetStudyId,
  includeRules = true,
  htmlContent = "",
  crfFormType = null,
  designNameOverride = null,
} = {}) {
  if (!targetStudyId) throw new Error("Target study is required for bundle import.")

  let bundle = raw
  if (raw?.bundle?.design) {
    bundle = raw.bundle
  } else if (raw?.meta?.bundleVersion && raw?.design) {
    bundle = raw
  } else if (raw?.exportVersion || raw?.config || raw?.sections) {
    const rules = includeRules ? collectRulesForExport(raw.rules || [], raw.sections || []) : []
    const config = raw.config || {}
    bundle = {
      meta: {
        bundleVersion: 1,
        includeRules,
        ruleCount: rules.length,
        exportedAt: raw.exportedAt || new Date().toISOString(),
      },
      design: {
        name: config.name || "Imported CRF",
        description: config.description || "",
        htmlContent: htmlContent || raw.design?.htmlContent || "",
        remarks: config.remarks || "",
        isFinalPrint: Boolean(config.isFinalPrint),
        status: "Draft",
        crfFormType: resolveCrfFormTypeForBundle(crfFormType ?? raw.crfFormType),
        isScreenFailedCrf: Boolean(config.isScreenFailedCrf),
        isRandomizedEnrolledCrf: Boolean(config.isRandomizedEnrolledCrf),
        isStratificationCrf: Boolean(config.isStratificationCrf),
      },
      rules: rules.map(normalizeRuleForBundle),
    }
  }

  if (!bundle?.design?.name) throw new Error("Invalid bundle: design name is missing.")
  if (!bundle.design.htmlContent?.trim()) {
    throw new Error("Invalid bundle: htmlContent is required. Save or export from a saved CRF.")
  }
  if (!bundle.design.crfFormType) {
    throw new Error("Invalid bundle: visit / crfFormType is required.")
  }

  return {
    targetStudyId: Number(targetStudyId),
    importMode: "createNew",
    includeRules,
    rulesImportMode: "replaceAll",
    designNameOverride: designNameOverride || null,
    bundle: {
      meta: bundle.meta || { bundleVersion: 1, includeRules, ruleCount: bundle.rules?.length || 0 },
      design: {
        ...bundle.design,
        crfFormType: resolveCrfFormTypeForBundle(bundle.design.crfFormType),
      },
      rules: includeRules ? (bundle.rules || []).map(normalizeRuleForBundle) : [],
    },
  }
}

export function downloadBundleJson(bundle, fileName) {
  const payload = bundle?.meta ? bundle : { meta: { bundleVersion: 1 }, ...bundle }
  const dataStr = JSON.stringify(payload, null, 2)
  const blob = new Blob([dataStr], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function isApiBundleFormat(raw) {
  return Boolean(raw?.meta?.bundleVersion && raw?.design)
}

export function countBundleRules(raw) {
  if (raw?.meta?.ruleCount != null) return Number(raw.meta.ruleCount) || 0
  if (raw?.bundle?.rules) return raw.bundle.rules.length
  if (raw?.rules) return collectRulesForExport(raw.rules, raw.sections || []).length
  return 0
}
