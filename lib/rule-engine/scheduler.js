import { normalizeRuleTier } from "./tiering"

function triggerToAllowedTiers(trigger = "change") {
  const t = String(trigger || "change").trim().toLowerCase()
  if (t === "submit") return new Set(["hot", "warm", "cold"])
  if (t === "background") return new Set(["warm", "cold"])
  if (t === "idle") return new Set(["cold"])
  // default: change/typing/select/date etc
  return new Set(["hot", "warm"])
}

/**
 * Filter rule ids by tier for current trigger.
 */
export function selectRuleIdsForTrigger(ruleIds = [], ruleById = new Map(), trigger = "change") {
  const allowed = triggerToAllowedTiers(trigger)
  const selected = []
  ruleIds.forEach((ruleId) => {
    const rule = ruleById.get(String(ruleId || ""))
    if (!rule) return
    const tier = normalizeRuleTier(rule?.action?.payload?.tier, "warm")
    if (!allowed.has(tier)) return
    selected.push(String(ruleId))
  })
  return selected
}
