const VALID_TIERS = new Set(["hot", "warm", "cold"])

export function normalizeRuleTier(rawTier, fallbackTier = "warm") {
  const normalized = String(rawTier || "").trim().toLowerCase()
  if (VALID_TIERS.has(normalized)) return normalized
  return VALID_TIERS.has(fallbackTier) ? fallbackTier : "warm"
}

export function defaultTierForRuleMode(mode) {
  const normalizedMode = String(mode || "").trim().toLowerCase()
  if (normalizedMode === "show" || normalizedMode === "hide") return "hot"
  if (normalizedMode === "enable" || normalizedMode === "disable") return "hot"
  if (normalizedMode === "date_restriction") return "hot"
  if (normalizedMode === "compute") return "warm"
  if (normalizedMode === "validation") return "warm"
  if (normalizedMode === "submit" || normalizedMode === "retro") return "cold"
  return "warm"
}
