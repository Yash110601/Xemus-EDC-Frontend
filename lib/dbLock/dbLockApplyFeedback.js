/** User-facing copy for database lock apply/release failures (SPEC-SDVSIGN-003). */

export function formatDbLockFailure(res, action = "apply") {
  const status = res?.statusCode ?? res?.httpStatus ?? null
  const message =
    String(res?.message ?? res?.Message ?? "").trim() ||
    (action === "release" ? "Failed to release database lock." : "Failed to apply database lock.")

  const verb = action === "release" ? "release" : "apply"
  let title = action === "release" ? "Lock release failed" : "Lock apply failed"

  if (status === 400) {
    title = action === "release" ? "Cannot release database lock" : "Cannot apply database lock"
    const lower = message.toLowerCase()
    if (lower.includes("pi sign") || lower.includes("principal investigator")) {
      title = "PI sign-off required before database lock"
    } else if (lower.includes("quer")) {
      title = "Open queries block database lock"
    }
  }

  return { title, description: message, status }
}
