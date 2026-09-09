/**
 * Payment rule definitions are study-wide (when to pay).
 * Per-CRC amounts live on User Creation milestone rows — matched by step / milestone no.
 */

export function findCrcMilestoneForRuleStep(crcMilestones = [], sequenceNo) {
  const step = Number(sequenceNo)
  if (!Number.isFinite(step) || step < 1 || !Array.isArray(crcMilestones)) return null

  const byNo = crcMilestones.find((m) => Number(m?.milestoneNo ?? m?.MilestoneNo) === step)
  if (byNo) return byNo

  const sorted = [...crcMilestones].sort(
    (a, b) => Number(a?.milestoneNo ?? a?.MilestoneNo ?? 0) - Number(b?.milestoneNo ?? b?.MilestoneNo ?? 0),
  )
  return sorted[step - 1] ?? null
}

export function resolveCrcMilestoneAmount(paymentRule, crcMilestones = []) {
  const ruleAmount = Number(paymentRule?.paymentAmount ?? 0)
  if (ruleAmount > 0) return ruleAmount

  const milestone = findCrcMilestoneForRuleStep(crcMilestones, paymentRule?.sequenceNo)
  return Number(milestone?.amount ?? milestone?.Amount ?? 0)
}

export function resolveCrcMilestonePatientCount(paymentRule, crcMilestones = []) {
  const milestone = findCrcMilestoneForRuleStep(crcMilestones, paymentRule?.sequenceNo)
  const count = milestone?.noOfPatients ?? milestone?.NoOfPatients
  return count != null && count !== "" ? Number(count) : null
}
