/**
 * Compute-rule math helpers (eCRF data entry).
 * Ensures + - * / use numeric operands (not string concatenation on +).
 */

import {
  collectRuleLabelMatchKeys,
  decodeHtmlEntities,
} from "@/components/crf-designer/ruleEvaluator"

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** Plain numeric text from number inputs / scores (not VAS bands like "0-4 mm"). */
export const isPlainNumericStringForCompute = (s) => {
  const t = String(s ?? "").trim()
  return /^\+?-?\d+(?:\.\d+)?$/.test(t)
}

/** Unwrap { value, label } select payloads so compute matches stored option value. */
export const unwrapFormValueForCompute = (raw) => {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    if (Object.prototype.hasOwnProperty.call(raw, "value") || Object.prototype.hasOwnProperty.call(raw, "label")) {
      return raw.value ?? raw.label ?? null
    }
  }
  return raw
}

const isEmptySelectSentinelForCompute = (s) => {
  const t = String(s).trim()
  if (!t) return true
  if (t === "__select_placeholder__") return true
  return /^select\.{3}$/i.test(t)
}

/**
 * Token embedded into a compute expression for one form cell.
 * Empty -> null (caller uses `undefined`). Numeric strings -> unquoted numbers for all math ops.
 */
export const literalForComputeEmbed = (raw) => {
  const value = unwrapFormValueForCompute(raw)
  if (value === undefined || value === null || value === "") return null
  if (typeof value === "string" && isEmptySelectSentinelForCompute(value)) return null
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (typeof value === "boolean") return value ? "true" : "false"
  if (typeof value === "bigint") return String(value)
  if (typeof value === "string") {
    const s = value.trim()
    if (isPlainNumericStringForCompute(s)) {
      const n = Number(s)
      if (Number.isFinite(n)) return String(n)
    }
    const m = s.match(/^(-?\d+(?:\.\d+)?)\s*[-]\s*(-?\d+(?:\.\d+)?)\b(.*)$/)
    if (m) {
      const rest = (m[3] || "").trim()
      if (/[a-zA-Z]/.test(rest)) {
        return JSON.stringify(String(value))
      }
      if (rest === "" || /^[\s().,/°%-]+$/.test(rest)) {
        const n = Number(m[1])
        return Number.isFinite(n) ? String(n) : JSON.stringify(String(value))
      }
    }
    return JSON.stringify(String(value))
  }
  try {
    return JSON.stringify(value)
  } catch {
    return null
  }
}

/** Legacy embeds used JSON quotes around numbers — coerce to bare operand for + - * /. */
export const embedComputeOperandToken = (lit) => {
  if (lit == null) return "undefined"
  const t = String(lit).trim()
  const quoted = t.match(/^["'](-?\d+(?:\.\d+)?)["']$/)
  if (quoted) return quoted[1]
  return t
}

const quoteUnquotedRangeComparisonLiterals = (s) => {
  const tail = String.raw`(?:\s+[A-Za-z%°][\w%.°/]*(?:\s*\([^)]*\))?|[A-Za-z%°][\w%.°/]*(?:\s*\([^)]*\))?)`
  const re = new RegExp(
    `(===?)\\s*(\\d+)\\s*-\\s*(\\d+)(${tail})(?=\\s*[\\)\\?:&|,]|\\s*$)`,
    "gi",
  )
  return s.replace(re, (_, op, lo, hi, tailRaw) => {
    const raw = String(tailRaw)
    const hadLeadingSpace = /^\s/.test(raw)
    const t = raw.replace(/^\s+/, "").trimEnd()
    const label = t ? (hadLeadingSpace ? `${lo}-${hi} ${t}` : `${lo}-${hi}${t}`) : `${lo}-${hi}`
    return `${op} ${JSON.stringify(label)}`
  })
}

/** Unquote digit-only string literals so + is never string concat. Skips non-numeric quoted text. */
export const normalizeQuotedNumericLiteralsInComputeExpr = (expr) =>
  String(expr || "").replace(/(["'])(-?\d+(?:\.\d+)?)\1/g, (_, _q, num) => num)

/**
 * Evaluate a compute expression (+ - * / and parentheses).
 * @param {string} expression
 * @param {Record<string, unknown>} formValues
 * @param {Record<string, string>} fieldLabelMap
 * @param {object} [options]
 */
export const safeEvaluateCompute = (expression, formValues, fieldLabelMap, options = {}) => {
  if (!expression || !expression.trim()) return null

  let expr = decodeHtmlEntities(expression.trim())
  expr = quoteUnquotedRangeComparisonLiterals(expr)

  const ctrlIdRe = /\b(ctrl_[a-zA-Z0-9_]+)\b/g
  const ctrlIds = new Set()
  let match
  while ((match = ctrlIdRe.exec(expr)) !== null) {
    ctrlIds.add(match[1])
  }

  const missingCtrlIds = []
  ctrlIds.forEach((id) => {
    const lit = literalForComputeEmbed(formValues?.[id])
    if (lit == null) missingCtrlIds.push(id)
    const embed = embedComputeOperandToken(lit)
    const re = new RegExp("\\b" + escapeRegex(id) + "\\b", "g")
    expr = expr.replace(re, embed)
  })

  if (missingCtrlIds.length > 0 && options?.allControls?.length > 0) {
    const allControls = Array.isArray(options.allControls) ? options.allControls : []
    const targetIds = Array.isArray(options?.targetIds)
      ? options.targetIds.map((x) => String(x || "").trim()).filter(Boolean)
      : []
    const targetSet = new Set(targetIds)
    const targetLabels = allControls
      .filter((c) => targetSet.has(String(c?.id || "").trim()))
      .map((c) => String(c?.label || c?.properties?.labelText || "").trim())
      .filter(Boolean)
    const hintText = [options?.rule?.ruleName, options?.rule?.name, targetLabels.join(" ")]
      .map((x) => String(x || "").toLowerCase())
      .join(" ")
    const hintTokens = new Set(
      hintText
        .split(/[^a-z0-9]+/g)
        .map((t) => t.trim())
        .filter((t) => t.length >= 3),
    )
    const candidates = allControls
      .filter((c) => {
        const id = String(c?.id || "").trim()
        if (!id || !id.startsWith("ctrl_")) return false
        if (targetSet.has(id)) return false
        return literalForComputeEmbed(formValues?.[id]) != null
      })
      .map((c) => {
        const id = String(c?.id || "").trim()
        const label = String(c?.label || c?.properties?.labelText || "").trim().toLowerCase()
        const tokens = label.split(/[^a-z0-9]+/g).map((t) => t.trim()).filter(Boolean)
        let overlap = 0
        tokens.forEach((t) => {
          if (hintTokens.has(t)) overlap += 1
        })
        return { id, label, overlap, lit: literalForComputeEmbed(formValues?.[id]) }
      })
      .sort((a, b) => b.overlap - a.overlap)

    if (candidates.length > 0 && candidates[0].overlap > 0) {
      missingCtrlIds.forEach((missingId) => {
        const chosen = candidates[0]
        if (!chosen?.lit) return
        const re = new RegExp("\\b" + escapeRegex(missingId) + "\\b", "g")
        expr = expr.replace(re, embedComputeOperandToken(chosen.lit))
      })
    }
  }

  Object.entries(fieldLabelMap || {}).forEach(([id, label]) => {
    if (!label) return
    const lit = literalForComputeEmbed(formValues?.[id])
    const embed = embedComputeOperandToken(lit)
    const variants = collectRuleLabelMatchKeys(String(label))
      .map((v) => String(v || "").trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
    variants.forEach((variant) => {
      const re = new RegExp("\\b" + escapeRegex(variant) + "\\b", "g")
      expr = expr.replace(re, embed)
    })
  })

  expr = normalizeQuotedNumericLiteralsInComputeExpr(expr)

  try {
    // eslint-disable-next-line no-new-func
    const result = new Function(`return (${expr});`)()
    if (typeof result === "string") {
      return result.trim()
    }
    if (typeof result === "number") {
      if (!Number.isFinite(result)) return null
      return result
    }
    const asNumber = Number(result)
    if (!Number.isFinite(asNumber)) return null
    return asNumber
  } catch {
    return null
  }
}
