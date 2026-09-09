/**
 * Rule expression literal quoting — shared by designer save and crfRule API service.
 * Table cell rules (ctrl_x_row_0_col_N == Option) must send quoted strings to the API.
 */

export function sanitizeRuleLiteralPartValue(raw) {
  let text = String(raw ?? "").trim()
  if (!text) return ""

  for (let pass = 0; pass < 4 && text; pass += 1) {
    const wrappedDouble = text.startsWith('"') && text.endsWith('"')
    const wrappedSingle = text.startsWith("'") && text.endsWith("'")
    if (wrappedDouble || wrappedSingle) {
      text = text.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'").trim()
      continue
    }
    if (text.startsWith('\\"') && text.endsWith('\\"') && text.length >= 4) {
      text = text.slice(2, -2).trim()
      continue
    }
    break
  }

  if (/^yes$/i.test(text)) return "Yes"
  if (/^no$/i.test(text)) return "No"
  if (/^true$/i.test(text)) return "true"
  if (/^false$/i.test(text)) return "false"
  return text
}

/** Quote bare comparison literals: == Resolved → == "Resolved" */
export function normalizeRuleExpressionLiterals(expression) {
  if (expression == null || typeof expression !== "string") return ""
  let out = String(expression).trim()
  if (!out) return out

  out = out.replace(
    /(===|==|!==|!=)\s*"\\"([A-Za-z0-9._ -]+)\\""/g,
    (_match, op, inner) => `${op} "${String(inner).trim()}"`
  )

  out = out.replace(
    /(===|==|!==|!=)\s+\b(yes|no)\b(?=\s|$|[&|)])/gi,
    (_match, op, word) => {
      const norm = word.toLowerCase() === "yes" ? "Yes" : "No"
      return `${op} "${norm}"`
    }
  )

  out = out.replace(
    /(===|==|!==|!=)\s*([A-Za-z][A-Za-z0-9._ -]*)(?=\s|$|[&|)])/g,
    (match, op, word) => {
      const text = String(word || "").trim()
      if (!text) return match
      if (/^ctrl_/i.test(text)) return `${op} ${text}`
      if (/^-?\d+(\.\d+)?$/.test(text)) return `${op} ${text}`
      if (/^(true|false)$/i.test(text)) return `${op} "${text.toLowerCase()}"`
      if (/^yes$/i.test(text)) return `${op} "Yes"`
      if (/^no$/i.test(text)) return `${op} "No"`
      return `${op} "${text}"`
    }
  )

  return out
}

export function serializeRuleLiteralForApi(value) {
  const text = sanitizeRuleLiteralPartValue(value)
  if (!text) return ""
  if (/^-?\d+(\.\d+)?$/.test(text)) return text
  const escaped = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  return `"${escaped}"`
}

export function finalizeRuleExpressionForApi(expression) {
  return normalizeRuleExpressionLiterals(String(expression ?? "").trim())
}
