/**
 * Normalizes API/UI rule category strings to canonical lowercase keys.
 * Lives under lib/ so Node scripts and the rule engine avoid importing the full ruleEvaluator.
 */
export const normalizeRuleCategory = (rawCategory) => {
  const normalized = (rawCategory ?? "").toString().trim().toLowerCase()
  if (!normalized) return ""
  if (normalized === "show" || normalized.includes("show")) return "show"
  if (normalized === "hide" || normalized.includes("hide")) return "hide"
  if (normalized === "disable" || normalized.includes("disable")) return "disable"
  if (normalized === "enable" || normalized.includes("enable")) return "enable"
  if (normalized === "compute" || normalized.includes("compute")) return "compute"
  if (
    normalized === "date_restriction" ||
    normalized === "daterestriction" ||
    normalized === "date restriction" ||
    (normalized.includes("date") && normalized.includes("restrict"))
  ) {
    return "date_restriction"
  }
  if (normalized === "validation" || normalized.includes("validation")) return "validation"
  if (normalized === "submit" || normalized.includes("submit")) return "submit"
  if (normalized === "retro" || normalized.includes("retro")) return "retro"
  return normalized
}
