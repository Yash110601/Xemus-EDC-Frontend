import { formatSimpleRuleSummary } from "@/lib/utils/paymentRuleSimpleTriggers"

export function sortActivePaymentRules(rules = []) {
  return [...rules]
    .filter((rule) => rule && rule.isActive !== false)
    .sort((a, b) => (Number(a.sequenceNo) || 0) - (Number(b.sequenceNo) || 0))
}

export function hasActivePaymentRules(rules = []) {
  return sortActivePaymentRules(rules).length > 0
}

export function getPaymentRuleHintForStep(rules, stepNo, visitSchedules = []) {
  const sorted = sortActivePaymentRules(rules)
  if (sorted.length === 0) return null

  const step = Number(stepNo) || 0
  const rule = sorted[step - 1] ?? sorted.find((item) => Number(item.sequenceNo) === step)
  if (!rule) return null

  const ruleName = String(rule.ruleName || "").trim()
  if (ruleName) return ruleName

  const summary = formatSimpleRuleSummary(rule, visitSchedules)
  return summary && summary !== "—" ? summary : null
}

/** Bracket suffix for milestone/visit step labels, e.g. " (First patient enrolled)". */
export function milestoneLabelSuffix(stepNo, rules, visitSchedules = []) {
  const hint = getPaymentRuleHintForStep(rules, stepNo, visitSchedules)
  return hint ? ` (${hint})` : ""
}
