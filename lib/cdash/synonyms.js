/** Optional synonym boosts — not required for matching; engine works without these. */

export const CDASH_SYNONYMS = {
  dob: ["brthdtc", "birth"],
  gender: ["sex"],
  bp: ["vsorres", "vstest", "blood pressure"],
  hr: ["vsorres", "pulse", "heart rate"],
  ae: ["aeterm", "aeyn"],
  med: ["cmtrt", "cmyn"],
}

export function synonymBoost(label, variable) {
  const normalizedLabel = String(label ?? "").toLowerCase()
  const variableName = String(variable?.variableName ?? "").toLowerCase()
  for (const [key, targets] of Object.entries(CDASH_SYNONYMS)) {
    if (!normalizedLabel.includes(key)) continue
    if (targets.some((target) => variableName.includes(target) || normalizedLabel.includes(target))) {
      return 15
    }
  }
  return 0
}
