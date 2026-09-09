/**
 * App timezone display (IST / Asia/Kolkata).
 *
 * API returns ISO with offset (e.g. 2026-07-15T15:00:00+05:30).
 * Format the wall clock for the app zone — do not treat as UTC and convert again.
 */

export const DEFAULT_TIME_CONTEXT = Object.freeze({
  displayName: "IST",
  timeZoneId: "Asia/Kolkata",
  offset: "+05:30",
})

function pad2(n) {
  return String(n).padStart(2, "0")
}

/** Module cache — also mirrored in AppTimeContext React state. */
let cachedTimeContext = { ...DEFAULT_TIME_CONTEXT }

export function getAppTimeContext() {
  return cachedTimeContext
}

export function minutesToOffsetLabel(minutes) {
  const n = Number(minutes)
  if (!Number.isFinite(n)) return null
  const sign = n < 0 ? "-" : "+"
  const abs = Math.abs(Math.trunc(n))
  const hh = pad2(Math.floor(abs / 60))
  const mm = pad2(abs % 60)
  return `${sign}${hh}:${mm}`
}

export function setAppTimeContext(partial) {
  if (!partial || typeof partial !== "object") return cachedTimeContext
  const fromMinutes = minutesToOffsetLabel(
    partial.utcOffsetMinutes ?? partial.UtcOffsetMinutes ?? partial.offsetMinutes,
  )
  const next = {
    displayName:
      String(partial.displayName ?? partial.DisplayName ?? cachedTimeContext.displayName).trim() ||
      DEFAULT_TIME_CONTEXT.displayName,
    timeZoneId:
      String(partial.timeZoneId ?? partial.TimeZoneId ?? cachedTimeContext.timeZoneId).trim() ||
      DEFAULT_TIME_CONTEXT.timeZoneId,
    offset: normalizeOffsetLabel(
      partial.offset ??
        partial.Offset ??
        partial.utcOffset ??
        partial.UtcOffset ??
        fromMinutes ??
        cachedTimeContext.offset,
    ),
  }
  cachedTimeContext = next
  return cachedTimeContext
}

export function normalizeOffsetLabel(raw) {
  const s = String(raw ?? "").trim()
  if (!s) return DEFAULT_TIME_CONTEXT.offset
  if (s === "Z" || s === "z") return "+00:00"
  const m = s.match(/^([+-])(\d{2}):?(\d{2})$/)
  if (m) return `${m[1]}${m[2]}:${m[3]}`
  // e.g. "+530" / "330" minutes already handled via minutesToOffsetLabel
  const asMinutes = Number(s)
  if (Number.isFinite(asMinutes) && Math.abs(asMinutes) <= 18 * 60) {
    return minutesToOffsetLabel(asMinutes) || DEFAULT_TIME_CONTEXT.offset
  }
  return DEFAULT_TIME_CONTEXT.offset
}

export function getAppTimeDisplayName() {
  return getAppTimeContext().displayName || DEFAULT_TIME_CONTEXT.displayName
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

function formatWallClockParts(y, mo, d, h, mi, withSeconds = false, se = 0) {
  const hour = Number(h)
  const ampm = hour >= 12 ? "PM" : "AM"
  const h12 = hour % 12 || 12
  let text = `${Number(d)} ${MONTH_SHORT[Number(mo) - 1]} ${y}, ${pad2(h12)}:${pad2(mi)}`
  if (withSeconds) text += `:${pad2(se)}`
  text += ` ${ampm}`
  return text
}

function formatDateParts(y, mo, d) {
  return `${pad2(Number(d))}-${MONTH_SHORT[Number(mo) - 1]}-${y}`
}

/** Column header helper: "Timestamp (IST)" */
export function columnLabelWithTz(baseLabel, displayName = getAppTimeContext().displayName) {
  const name = String(displayName || "IST").trim() || "IST"
  const base = String(baseLabel || "").trim()
  if (!base) return name
  if (/\(\s*IST\s*\)|\(\s*UTC\s*\)/i.test(base)) {
    return base.replace(/\(\s*(IST|UTC)\s*\)/i, `(${name})`)
  }
  return `${base} (${name})`
}

/**
 * Format API instant/datetime for grids.
 * @param {unknown} value
 * @param {{ timeZoneId?: string, displayName?: string, offset?: string, withSeconds?: boolean, includeTzSuffix?: boolean }} [opts]
 */
export function formatAppDateTime(value, opts = {}) {
  if (value == null || value === "") return "—"
  if (value instanceof Date) {
    return formatInstantInAppZone(value, opts)
  }

  const raw = String(value).trim()
  if (!raw) return "—"

  // Date-only: never shift by timezone
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [, y, mo, d] = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    return formatDateParts(y, mo, d)
  }

  const ctx = getAppTimeContext()
  const appOffset = normalizeOffsetLabel(opts.offset || ctx.offset)
  const withSeconds = Boolean(opts.withSeconds)

  const m = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/i,
  )
  if (m) {
    const [, y, mo, d, h, mi, se = "0", tzRaw] = m
    const tz = tzRaw ? normalizeOffsetLabel(tzRaw === "Z" || tzRaw === "z" ? "Z" : tzRaw) : ""

    // Offset present and matches app zone → show wall-clock parts (no convert)
    if (tz && tz !== "+00:00" && tz === appOffset) {
      const text = formatWallClockParts(y, mo, d, h, mi, withSeconds, Number(se))
      return opts.includeTzSuffix ? `${text} ${ctx.displayName}` : text
    }

    // Explicit offset or Z → convert once into app timeZoneId
    if (tz) {
      const dObj = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"))
      if (!Number.isNaN(dObj.getTime())) {
        return formatInstantInAppZone(dObj, opts)
      }
    }

    // Legacy no-TZ → treat as already wall clock in app zone
    const text = formatWallClockParts(y, mo, d, h, mi, withSeconds, Number(se))
    return opts.includeTzSuffix ? `${text} ${ctx.displayName}` : text
  }

  // Fallback Date parse → format in app zone once
  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) {
    return formatInstantInAppZone(parsed, opts)
  }

  return raw
}

function formatInstantInAppZone(date, opts = {}) {
  const ctx = getAppTimeContext()
  const timeZoneId = opts.timeZoneId || ctx.timeZoneId || DEFAULT_TIME_CONTEXT.timeZoneId
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timeZoneId,
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: opts.withSeconds ? "2-digit" : undefined,
      hour12: true,
    }).formatToParts(date)

    const map = Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, p.value]))
    const day = String(Number(map.day))
    const month = map.month
    const year = map.year
    const hour = map.hour
    const minute = map.minute
    const dayPeriod = (map.dayPeriod || "").toUpperCase()
    let text = `${day} ${month} ${year}, ${hour}:${minute}`
    if (dayPeriod) text += ` ${dayPeriod}`
    if (opts.withSeconds && map.second) text += `:${map.second}`
    if (opts.includeTzSuffix) text += ` ${opts.displayName || ctx.displayName}`
    return text
  } catch {
    try {
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(date)
    } catch {
      return "—"
    }
  }
}

/** Date-only display (YYYY-MM-DD or date part of ISO). No TZ shift. */
export function formatAppDateOnly(value) {
  if (value == null || value === "") return "—"
  const raw = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const y = raw.slice(0, 4)
    const mo = raw.slice(5, 7)
    const d = raw.slice(8, 10)
    return formatDateParts(y, mo, d)
  }
  return formatAppDateTime(value)
}

/**
 * Date-picker day → API bounds in app offset (do not send UTC Z midnight).
 * Backend treats these as IST business day and converts to UTC for DB.
 */
export function dateInputToAppDayStartIso(dateStr, offset = getAppTimeContext().offset) {
  const raw = String(dateStr || "").trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  return `${raw}T00:00:00.000${normalizeOffsetLabel(offset)}`
}

export function dateInputToAppDayEndIso(dateStr, offset = getAppTimeContext().offset) {
  const raw = String(dateStr || "").trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  return `${raw}T23:59:59.999${normalizeOffsetLabel(offset)}`
}

/** Last N calendar days as YYYY-MM-DD in the app timezone (for date inputs). */
export function getAppDateRangeLastDays(days = 7) {
  const ctx = getAppTimeContext()
  const now = new Date()
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: ctx.timeZoneId,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  const toDate = fmt.format(now) // YYYY-MM-DD
  const start = new Date(now.getTime() - Math.max(0, days) * 24 * 60 * 60 * 1000)
  const fromDate = fmt.format(start)
  return { fromDate, toDate }
}

/**
 * Calendar day key (YYYY-MM-DD) in the app timezone — for dashboard/chart day buckets.
 * Date-only strings are returned as-is (no shift).
 */
export function getAppCalendarDateKey(value) {
  if (value == null || value === "") return null
  if (typeof value === "string") {
    const raw = value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
    if (/^\d{4}-\d{2}-\d{2}/.test(raw) && raw.length === 10) return raw.slice(0, 10)
  }
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  const ctx = getAppTimeContext()
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ctx.timeZoneId,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d)
}

/**
 * Report/API filter date: send yyyy-MM-dd (business calendar day). Do not send UTC Z.
 * Accepts Date, ISO string, or yyyy-MM-dd.
 */
export function toApiDateOnlyParam(value) {
  if (value == null || value === "") return null
  if (typeof value === "string") {
    const m = value.trim().match(/^(\d{4}-\d{2}-\d{2})/)
    if (m) return m[1]
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return getAppCalendarDateKey(parsed)
    return null
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // new Date("yyyy-MM-dd") → UTC midnight; preserve that calendar date
    const isUtcMidnight =
      value.getUTCHours() === 0 &&
      value.getUTCMinutes() === 0 &&
      value.getUTCSeconds() === 0 &&
      value.getUTCMilliseconds() === 0
    if (isUtcMidnight) {
      return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`
    }
    return getAppCalendarDateKey(value)
  }
  return null
}
