/**
 * Deterministic conflict policy for field patch properties.
 *
 * Winner order:
 * 1) higher numeric priority wins
 * 2) if tie, lower compile order wins (older/stable first)
 * 3) if tie, lexical ruleId wins
 */
export function chooseWinningPatchCandidate(candidates = []) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null

  const sorted = [...candidates].sort((a, b) => {
    const pA = Number.isFinite(Number(a?.priority)) ? Number(a.priority) : 0
    const pB = Number.isFinite(Number(b?.priority)) ? Number(b.priority) : 0
    if (pA !== pB) return pB - pA

    const oA = Number.isFinite(Number(a?.order)) ? Number(a.order) : Number.MAX_SAFE_INTEGER
    const oB = Number.isFinite(Number(b?.order)) ? Number(b.order) : Number.MAX_SAFE_INTEGER
    if (oA !== oB) return oA - oB

    const idA = String(a?.ruleId || "")
    const idB = String(b?.ruleId || "")
    return idA.localeCompare(idB)
  })

  return sorted[0] || null
}
