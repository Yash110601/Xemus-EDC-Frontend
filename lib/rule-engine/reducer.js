import { chooseWinningPatchCandidate } from "./conflictPolicy"

const DATE_COMPARE_REGEX = /\b(ctrl_[A-Za-z0-9_]+)\b\s*(>=|>|<=|<)\s*\b(ctrl_[A-Za-z0-9_]+)\b/g

function pushCandidate(bucket, fieldId, property, candidate) {
  if (!bucket[fieldId]) bucket[fieldId] = {}
  if (!bucket[fieldId][property]) bucket[fieldId][property] = []
  bucket[fieldId][property].push(candidate)
}

function deriveDateBoundPatches(rule) {
  const expression = String(rule?.conditionExpression || "")
  const out = []
  if (!expression) return out

  let match
  while ((match = DATE_COMPARE_REGEX.exec(expression)) !== null) {
    const left = String(match[1] || "").trim()
    const op = String(match[2] || "").trim()
    const right = String(match[3] || "").trim()
    if (!left || !right) continue
    if (op === ">=" || op === ">") {
      out.push({ targetFieldId: left, minFromFieldId: right })
    } else if (op === "<=" || op === "<") {
      out.push({ targetFieldId: left, maxFromFieldId: right })
    }
  }
  return out
}

function applyActionToCandidates(entry, candidateBucket, validationBucket) {
  const rule = entry?.rule
  const conditionMet = Boolean(entry?.conditionMet)
  const computedValue = entry?.computedValue
  if (!rule) return
  const targets = Array.isArray(rule?.targets) ? rule.targets : []
  const priority = Number.isFinite(Number(rule?.priority)) ? Number(rule.priority) : 0
  const order = Number.isFinite(Number(rule?.__compileOrder)) ? Number(rule.__compileOrder) : 0
  const mode = String(rule?.action?.payload?.mode || "").trim()

  if (mode === "show" || mode === "hide") {
    targets.forEach((t) => {
      const fieldId = String(t?.fieldId || "").trim()
      if (!fieldId) return
      const hidden = mode === "show" ? !conditionMet : conditionMet
      pushCandidate(candidateBucket, fieldId, "hidden", {
        value: hidden,
        ruleId: rule.id,
        priority,
        order,
      })
    })
    return
  }

  if (mode === "enable" || mode === "disable") {
    targets.forEach((t) => {
      const fieldId = String(t?.fieldId || "").trim()
      if (!fieldId) return
      const readonly = mode === "enable" ? !conditionMet : conditionMet
      pushCandidate(candidateBucket, fieldId, "readonly", {
        value: readonly,
        ruleId: rule.id,
        priority,
        order,
      })
    })
    return
  }

  if (mode === "validation" || mode === "submit" || mode === "retro") {
    targets.forEach((t) => {
      const fieldId = String(t?.fieldId || "").trim()
      if (!fieldId) return
      pushCandidate(candidateBucket, fieldId, "conditionallyRequired", {
        value: conditionMet,
        ruleId: rule.id,
        priority,
        order,
      })
      if (conditionMet && rule.message) {
        pushCandidate(candidateBucket, fieldId, "requiredIfMessage", {
          value: String(rule.message),
          ruleId: rule.id,
          priority,
          order,
        })
      }
    })

    if (!conditionMet && rule.message) {
      targets.forEach((t) => {
        const fieldId = String(t?.fieldId || "").trim()
        if (!fieldId) return
        if (!validationBucket[fieldId]) validationBucket[fieldId] = []
        validationBucket[fieldId].push(String(rule.message))
      })
    }
    return
  }

  if (mode === "compute") {
    const isComputedValueValid =
      computedValue != null &&
      !(typeof computedValue === "number" && Number.isNaN(computedValue))
    if (!isComputedValueValid) return

    targets.forEach((t) => {
      const fieldId = String(t?.fieldId || "").trim()
      if (!fieldId) return
      pushCandidate(candidateBucket, fieldId, "value", {
        value: computedValue,
        ruleId: rule.id,
        priority,
        order,
      })
    })
    return
  }

  if (mode === "date_restriction") {
    const datePatches = deriveDateBoundPatches(rule)
    datePatches.forEach((patch) => {
      const target = String(patch?.targetFieldId || "").trim()
      if (!target) return
      if (patch.minFromFieldId) {
        pushCandidate(candidateBucket, target, "minDateFromFieldId", {
          value: String(patch.minFromFieldId),
          ruleId: rule.id,
          priority,
          order,
        })
      }
      if (patch.maxFromFieldId) {
        pushCandidate(candidateBucket, target, "maxDateFromFieldId", {
          value: String(patch.maxFromFieldId),
          ruleId: rule.id,
          priority,
          order,
        })
      }
    })
    return
  }
}

/**
 * Boolean "restrictive" properties that follow OR-logic across multiple rules:
 * any rule asserting `true` makes the property `true`, regardless of priority
 * or compile order. This matches standard EDC semantics — if ANY rule says
 * "disable / hide / require this field", the field is locked / hidden /
 * required. A rule whose own condition is NOT met (and therefore emits
 * `false`) must never undo another rule's `true`.
 *
 * For audit traceability we still pick a single "winner" rule (the highest-
 * priority / earliest one asserting `true`) so `__meta` points at the rule
 * that actually decided the final value.
 */
const RESTRICTIVE_OR_PROPERTIES = new Set([
  "hidden",
  "readonly",
  "conditionallyRequired",
])

/**
 * Reduce evaluated rule outcomes into final deterministic patch envelopes.
 *
 * @param {Array<{ rule: Object, conditionMet: boolean }>} outcomes
 * @returns {{ fieldPatches: Record<string, Object>, validationPatches: Record<string, string[]> }}
 */
export function reduceRuleOutcomesToPatches(outcomes = []) {
  const candidateBucket = {}
  const validationBucket = {}

  outcomes.forEach((entry) => {
    if (!entry?.rule) return
    applyActionToCandidates(entry, candidateBucket, validationBucket)
  })

  const fieldPatches = {}
  Object.entries(candidateBucket).forEach(([fieldId, props]) => {
    const finalProps = {}
    Object.entries(props).forEach(([property, candidates]) => {
      if (RESTRICTIVE_OR_PROPERTIES.has(property)) {
        // OR-logic: only `true` assertions are considered. Pick the
        // highest-priority `true` candidate as the winner for `__meta`.
        const trueCandidates = candidates.filter((c) => c?.value === true)
        if (trueCandidates.length === 0) {
          // No rule asserted true → no patch. Field keeps its baseline
          // (designer default or other property channels), avoiding the
          // bug where a non-matching rule's `false` overrides another
          // rule's `true`.
          return
        }
        const winner = chooseWinningPatchCandidate(trueCandidates)
        if (!winner) return
        finalProps[property] = true
        finalProps.__meta = finalProps.__meta || {}
        finalProps.__meta[property] = {
          ruleId: winner.ruleId,
          priority: winner.priority,
          mergedWithOrLogic: true,
          contributingRuleCount: trueCandidates.length,
        }
        return
      }

      const winner = chooseWinningPatchCandidate(candidates)
      if (!winner) return
      finalProps[property] = winner.value
      finalProps.__meta = finalProps.__meta || {}
      finalProps.__meta[property] = {
        ruleId: winner.ruleId,
        priority: winner.priority,
      }
    })
    if (Object.keys(finalProps).length > 0) {
      fieldPatches[fieldId] = finalProps
    }
  })

  const validationPatches = {}
  Object.entries(validationBucket).forEach(([fieldId, messages]) => {
    validationPatches[fieldId] = [...new Set(messages)]
  })

  return {
    fieldPatches,
    validationPatches,
  }
}
