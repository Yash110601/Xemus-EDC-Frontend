/**
 * UK/UNK partial-date interval utilities for CRF date-restriction bounds.
 * Format: DAY-MONTH-YEAR (e.g. 15-JAN-2024, UK-UNK-2024).
 *
 * Comparison policy (conservative, clinically safe):
 * - Min bound violation: current interval's latest day is still before the bound's earliest day.
 * - Max bound violation: current interval's earliest day is after the bound's latest day.
 */

const UK_UNK_MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
]

const MONTH_INDEX = Object.fromEntries(UK_UNK_MONTHS.map((m, i) => [m, i + 1]))

const pad2 = (n) => String(n).padStart(2, "0")

const daysInMonth = (year, month1Based) => {
  if (!Number.isFinite(year) || !Number.isFinite(month1Based)) return 31
  return new Date(year, month1Based, 0).getDate()
}

const toIso = (year, month1Based, day) =>
  `${year}-${pad2(month1Based)}-${pad2(day)}`

const isUkUnkDateDebugEnabled = () => {
  if (typeof window === "undefined") return false
  try {
    const v = String(window.localStorage?.getItem("ukUnkDateBoundsDebug") || "").trim().toLowerCase()
    return v === "1" || v === "true" || v === "yes"
  } catch {
    return false
  }
}

export const logUkUnkDateBoundsDebug = (event, payload = {}) => {
  if (!isUkUnkDateDebugEnabled()) return
  console.info("[UkUnkDateBounds]", { event, ...payload })
}

/** True when value looks like DAY-MONTH-YEAR (UK/UNK tokens or numeric day). */
export const isUkUnkDateString = (raw) => {
  const text = String(raw || "").trim()
  if (!text) return false
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return false
  const parts = text.split("-")
  if (parts.length !== 3) return false
  const [day, month, year] = parts.map((p) => String(p || "").trim().toUpperCase())
  if (!/^\d{4}$/.test(year)) return false
  const dayOk = day === "UK" || (/^\d+$/.test(day) && Number(day) >= 1 && Number(day) <= 31)
  const monthOk = month === "UNK" || UK_UNK_MONTHS.includes(month)
  return dayOk && monthOk
}

const parseIsoOrDmyToInterval = (text) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return { minIso: text, maxIso: text, exact: true, kind: "iso" }
  }
  const dmyMatch = text.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (dmyMatch) {
    const day = Number(dmyMatch[1])
    const month = Number(dmyMatch[2])
    const year = Number(dmyMatch[3])
    const d = new Date(year, month - 1, day)
    if (Number.isNaN(d.getTime())) return null
    const iso = toIso(d.getFullYear(), d.getMonth() + 1, d.getDate())
    return { minIso: iso, maxIso: iso, exact: true, kind: "dmy" }
  }
  const parsed = new Date(text)
  if (!Number.isNaN(parsed.getTime())) {
    const iso = toIso(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate())
    return { minIso: iso, maxIso: iso, exact: true, kind: "date" }
  }
  return null
}

const parseUkUnkTripleToInterval = (dayRaw, monthRaw, yearRaw) => {
  const day = String(dayRaw || "").trim().toUpperCase()
  const month = String(monthRaw || "").trim().toUpperCase()
  const year = String(yearRaw || "").trim().toUpperCase()
  if (!day || !month || !year || !/^\d{4}$/.test(year)) return null

  const y = Number(year)
  let minMonth = 1
  let maxMonth = 12
  let minDay = 1
  let maxDay = 31

  if (month === "UNK") {
    // Any month in year.
  } else if (MONTH_INDEX[month]) {
    const mi = MONTH_INDEX[month]
    minMonth = maxMonth = mi
    maxDay = daysInMonth(y, mi)
    minDay = 1
  } else {
    return null
  }

  if (day === "UK") {
    minDay = 1
    if (month !== "UNK") {
      maxDay = daysInMonth(y, minMonth)
    }
  } else if (/^\d+$/.test(day)) {
    const d = Number(day)
    if (d < 1 || d > 31) return null
    if (month === "UNK") {
      minMonth = 1
      maxMonth = 12
      minDay = d
      maxDay = d
    } else {
      const capped = Math.min(d, daysInMonth(y, minMonth))
      minDay = maxDay = capped
    }
  } else {
    return null
  }

  const minIso = toIso(y, minMonth, minDay)
  const maxIso = toIso(y, maxMonth, maxDay)
  return {
    minIso,
    maxIso,
    exact: minIso === maxIso,
    kind: "ukunk",
  }
}

/**
 * Parse any supported date value into { minIso, maxIso, exact, kind } or null.
 */
export const parseDateInterval = (raw) => {
  if (raw === null || raw === undefined) return null
  const text = String(raw).trim()
  if (!text) return null

  const isoInterval = parseIsoOrDmyToInterval(text)
  if (isoInterval) return isoInterval

  if (isUkUnkDateString(text)) {
    const [day, month, year] = text.split("-")
    return parseUkUnkTripleToInterval(day, month, year)
  }

  return null
}

/**
 * Legacy helper: single ISO for exact dates; empty for partial/unknown UK/UNK.
 * Preserves existing ISO + dd-mm-yyyy behavior for non-UK/UNK values.
 */
export const normalizeIsoDateForBounds = (raw) => {
  const interval = parseDateInterval(raw)
  if (!interval) return ""
  if (interval.exact) return interval.minIso
  return ""
}

/**
 * Resolve a bound value for min/max picker and restriction checks.
 * role: "min" -> earliest allowed day; "max" -> latest allowed day.
 */
export const resolveBoundIso = (raw, role = "min") => {
  const interval = parseDateInterval(raw)
  if (!interval) return ""
  return role === "max" ? interval.maxIso : interval.minIso
}

export const violatesMinDateBound = (currentRaw, minBoundRaw) => {
  const current = parseDateInterval(currentRaw)
  const bound = parseDateInterval(minBoundRaw)
  if (!current || !bound) return false
  return current.maxIso < bound.minIso
}

export const violatesMaxDateBound = (currentRaw, maxBoundRaw) => {
  const current = parseDateInterval(currentRaw)
  const bound = parseDateInterval(maxBoundRaw)
  if (!current || !bound) return false
  return current.minIso > bound.maxIso
}

/**
 * Build the selectable interval for partial UK/UNK parts (empty day → UK, empty month → UNK).
 */
export const buildIntervalFromUkUnkParts = (day, month, year) => {
  const y = String(year || "").trim()
  if (!/^\d{4}$/.test(y)) return null
  const dRaw = String(day || "").trim().toUpperCase()
  const mRaw = String(month || "").trim().toUpperCase()
  const d = dRaw || "UK"
  let m = mRaw || "UNK"
  if (m !== "UNK" && !MONTH_INDEX[m]) {
    const n = Number.parseInt(m, 10)
    if (Number.isFinite(n) && n >= 1 && n <= 12) m = UK_UNK_MONTHS[n - 1]
    else if (!mRaw) m = "UNK"
    else return null
  }
  return parseUkUnkTripleToInterval(d, m, y)
}

export const isUkUnkPartsWithinBounds = (day, month, year, minDate, maxDate) => {
  if (!minDate && !maxDate) return true
  const interval = buildIntervalFromUkUnkParts(day, month, year)
  if (!interval) return true
  const minBound = resolveBoundIso(minDate, "min")
  const maxBound = resolveBoundIso(maxDate, "max")
  if (minBound && interval.maxIso < minBound) return false
  if (maxBound && interval.minIso > maxBound) return false
  return true
}

/** True when calendar year Y can contain at least one allowed UK/UNK date. */
export const isUkUnkYearWithinBounds = (year, minDate, maxDate) => {
  const y = String(year || "").trim()
  if (!/^\d{4}$/.test(y)) return true
  const minBound = resolveBoundIso(minDate, "min")
  const maxBound = resolveBoundIso(maxDate, "max")
  const yearNum = Number(y)
  if (minBound) {
    const lastDay = toIso(yearNum, 12, daysInMonth(yearNum, 12))
    if (lastDay < minBound) return false
  }
  if (maxBound) {
    const firstDay = toIso(yearNum, 1, 1)
    if (firstDay > maxBound) return false
  }
  return true
}

export const isUkUnkValueWithinBounds = (value, minDate, maxDate) => {
  const text = String(value || "").trim()
  if (!text) return true
  if (minDate && violatesMinDateBound(text, minDate)) return false
  if (maxDate && violatesMaxDateBound(text, maxDate)) return false
  return true
}

/**
 * Compare two date values with >= > <= < (interval semantics).
 * Returns null when either side cannot be parsed (caller should skip).
 */
export const compareDateValues = (leftRaw, op, rightRaw) => {
  const left = parseDateInterval(leftRaw)
  const right = parseDateInterval(rightRaw)
  if (!left || !right) return null

  const opNorm = String(op || "").trim()
  switch (opNorm) {
    case ">=":
      // At least one date in left can be on/after the earliest date in right.
      return left.maxIso >= right.minIso
    case ">":
      return left.minIso > right.maxIso
    case "<=":
      return left.minIso <= right.maxIso
    case "<":
      return left.maxIso < right.minIso
    case "===":
    case "==":
      return left.minIso === right.minIso && left.maxIso === right.maxIso
    case "!==":
    case "!=":
      return left.minIso !== right.minIso || left.maxIso !== right.maxIso
    default:
      return null
  }
}

/** Year for UkUnkDatePicker dropdown limits. */
const decodeHtmlEntities = (value) =>
  String(value || "")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")

/**
 * Evaluate date-restriction boolean expressions (ctrl_a >= ctrl_b, &&, ||, parens).
 * Returns null when expression is not safely evaluable (caller may fall back).
 */
export const evaluateDateRestrictionExpression = (expression, formValues = {}) => {
  let expr = decodeHtmlEntities(expression).replace(/\s+/g, " ").trim()
  if (!expr || !/\bctrl_/.test(expr)) return null

  const comparisons = [
    ...expr.matchAll(/\b(ctrl_[A-Za-z0-9_]+)\b\s*(>=|<=|===|!==|==|!=|>|<)\s*\b(ctrl_[A-Za-z0-9_]+)\b/g),
  ]
  if (comparisons.length === 0) return null

  for (const match of comparisons) {
    const [full, leftId, op, rightId] = match
    const leftVal = formValues[leftId]
    const rightVal = formValues[rightId]
    const cmp = compareDateValues(leftVal, op, rightVal)
    if (cmp === null) {
      logUkUnkDateBoundsDebug("restriction_skip_unparsed", { leftId, op, rightId, leftVal, rightVal })
      return null
    }
    expr = expr.replace(full, cmp ? "true" : "false")
  }

  const remainder = expr.replace(/\btrue\b/g, "").replace(/\bfalse\b/g, "").trim()
  if (!/^[()&|\s!]+$/.test(remainder)) return null

  try {
    // eslint-disable-next-line no-new-func
    return Boolean(Function(`"use strict"; return (${expr});`)())
  } catch {
    return null
  }
}

export const parseYearFromDateLike = (value) => {
  const interval = parseDateInterval(value)
  if (interval) {
    const y = Number(String(interval.minIso || "").slice(0, 4))
    if (Number.isFinite(y)) return y
  }
  const text = String(value || "").trim()
  if (/^\d{4}$/.test(text)) return Number(text)
  return null
}
