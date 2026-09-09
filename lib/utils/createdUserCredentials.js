/**
 * Super Admin-only display of API-returned generated passwords (when SMTP may be off).
 */

export function isSuperAdminUser(user) {
  if (!user || typeof user !== "object") return false

  const code = String(user.roleCode ?? user.RoleCode ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
  const nameCompact = String(user.roleName ?? user.RoleName ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")

  return code === "SUPERADMIN" || nameCompact === "superadmin" || nameCompact.includes("superadmin")
}

export function extractGeneratedPassword(apiResponse) {
  const data = apiResponse?.data
  if (!data || typeof data !== "object") return ""

  const candidates = [
    data.generatedPassword,
    data.GeneratedPassword,
    data.plainPassword,
    data.PlainPassword,
    data.temporaryPassword,
    data.TemporaryPassword,
  ]

  for (const value of candidates) {
    const text = typeof value === "string" ? value.trim() : ""
    if (text) return text
  }

  return ""
}
