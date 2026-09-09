/**
 * Shared PDF/report metadata — name only (no role suffix).
 */

export function buildGeneratedByLabel(user = {}) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim()
  if (name) return name
  return user.username || user.loginName || user.email || "User"
}

export function buildPrintedInfoFromUser(user = {}, extras = {}) {
  return {
    generatedBy: buildGeneratedByLabel(user),
    generatedOn: new Date().toISOString(),
    ...extras,
  }
}

/** UTC stamp for PDF footers: 2026-05-22 04:39:15 UTC */
export function formatGeneratedUtc(value) {
  const d = value ? new Date(value) : new Date()
  if (Number.isNaN(d.getTime())) return "—"
  const pad = (n) => String(n).padStart(2, "0")
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`
}
