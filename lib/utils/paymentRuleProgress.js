/** Normalize SitePaymentRuleProgressDto from API (finance list + progress endpoints). */

import {
  resolveCrcMilestoneAmount,
  resolveCrcMilestonePatientCount,
} from "@/lib/utils/paymentRuleCrcAmount"

function pick(raw, ...keys) {
  if (!raw || typeof raw !== "object") return undefined
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null) return raw[key]
  }
  return undefined
}

export function normalizePaymentRuleProgress(raw) {
  if (!raw || typeof raw !== "object") return null
  const status = Number(pick(raw, "status", "Status") ?? 1)
  const eligibility = Number(pick(raw, "paymentEligibilityStatus", "PaymentEligibilityStatus") ?? 1)
  return {
    id: pick(raw, "id", "Id"),
    studyPaymentRuleDefinitionId: pick(raw, "studyPaymentRuleDefinitionId", "StudyPaymentRuleDefinitionId"),
    siteId: pick(raw, "siteId", "SiteId"),
    ruleName: pick(raw, "ruleName", "RuleName") ?? "",
    sequenceNo: Number(pick(raw, "sequenceNo", "SequenceNo") ?? 0),
    paymentAmount: Number(pick(raw, "paymentAmount", "PaymentAmount") ?? 0),
    paymentAmountFromCrcMilestone: Boolean(
      pick(raw, "paymentAmountFromCrcMilestone", "PaymentAmountFromCrcMilestone"),
    ),
    referenceNoOfPatients:
      pick(raw, "referenceNoOfPatients", "ReferenceNoOfPatients") != null
        ? Number(pick(raw, "referenceNoOfPatients", "ReferenceNoOfPatients"))
        : null,
    status,
    statusName: pick(raw, "statusName", "StatusName") ?? "",
    achievedAt: pick(raw, "achievedAt", "AchievedAt") ?? null,
    calculatedNumerator: Number(pick(raw, "calculatedNumerator", "CalculatedNumerator") ?? 0),
    calculatedDenominator: Number(pick(raw, "calculatedDenominator", "CalculatedDenominator") ?? 0),
    progressPercentage:
      pick(raw, "progressPercentage", "ProgressPercentage") != null
        ? Number(pick(raw, "progressPercentage", "ProgressPercentage"))
        : null,
    paymentEligibilityStatus: eligibility,
    paymentEligibilityStatusName:
      pick(raw, "paymentEligibilityStatusName", "PaymentEligibilityStatusName") ?? "",
    paymentStatus: pick(raw, "paymentStatus", "PaymentStatus") ?? "Unpaid",
    chequeNumber: pick(raw, "chequeNumber", "ChequeNumber") ?? null,
    documentNumber: pick(raw, "documentNumber", "DocumentNumber") ?? null,
    dateOfIssue: pick(raw, "dateOfIssue", "DateOfIssue") ?? null,
    chequeReceivedDate: pick(raw, "chequeReceivedDate", "ChequeReceivedDate") ?? null,
    overrideReason: pick(raw, "overrideReason", "OverrideReason") ?? null,
    overrideAt: pick(raw, "overrideAt", "OverrideAt") ?? null,
  }
}

export function enrichPaymentRuleWithCrcAmount(rule, crcMilestones = []) {
  if (!rule) return null

  if (rule.paymentAmountFromCrcMilestone) {
    return {
      ...rule,
      referenceNoOfPatients:
        rule.referenceNoOfPatients ?? resolveCrcMilestonePatientCount(rule, crcMilestones),
    }
  }

  if (Number(rule.paymentAmount ?? 0) > 0) return rule

  const crcAmount = resolveCrcMilestoneAmount(rule, crcMilestones)
  if (crcAmount <= 0) return rule

  return {
    ...rule,
    paymentAmount: crcAmount,
    paymentAmountFromCrcMilestone: true,
    referenceNoOfPatients: resolveCrcMilestonePatientCount(rule, crcMilestones),
  }
}

export function getRowPaymentRules(row) {
  const list = row?.paymentRules ?? row?.PaymentRules ?? []
  const milestones = row?.milestones ?? row?.Milestones ?? []
  if (!Array.isArray(list)) return []
  return list
    .map(normalizePaymentRuleProgress)
    .filter(Boolean)
    .map((rule) => enrichPaymentRuleWithCrcAmount(rule, milestones))
}

export function achievementStatusTone(statusName, status) {
  const label = String(statusName ?? "").toLowerCase()
  const code = Number(status)
  if (label.includes("achieved") || code === 2) return "emerald"
  if (label.includes("overridden") || code === 3) return "amber"
  if (label.includes("revoked") || code === 4) return "slate"
  return "sky"
}

export function eligibilityTone(statusName, status) {
  const label = String(statusName ?? "").toLowerCase()
  const code = Number(status)
  if (label.includes("eligible") && !label.includes("not") || code === 2) return "emerald"
  if (label.includes("paid") || code === 3) return "indigo"
  return "slate"
}

export function formatProgressPercent(rule) {
  if (rule?.progressPercentage != null && Number.isFinite(Number(rule.progressPercentage))) {
    return `${Math.round(Number(rule.progressPercentage))}%`
  }
  const denom = Number(rule?.calculatedDenominator ?? 0)
  const num = Number(rule?.calculatedNumerator ?? 0)
  if (denom > 0) return `${Math.round((num / denom) * 100)}%`
  return "—"
}
