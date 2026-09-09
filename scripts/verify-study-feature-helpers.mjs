#!/usr/bin/env node
/**
 * Quick local checks for PI sign-off settings helpers (no API auth required).
 * Run: node scripts/verify-study-feature-helpers.mjs
 */

const toStudySettingBool = (raw) => {
  const normalized = String(raw ?? "").trim().toLowerCase()
  return raw === true || raw === 1 || normalized === "true" || normalized === "1" || normalized === "yes"
}

const pickIsPiSignoffRequired = (payload) => {
  if (!payload || typeof payload !== "object") return false
  const raw =
    payload.isPiSignoffRequired ??
    payload.IsPiSignoffRequired ??
    payload.studySetting?.isPiSignoffRequired ??
    payload.studySetting?.IsPiSignoffRequired
  return toStudySettingBool(raw)
}

let failed = 0
function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg)
    failed += 1
  } else {
    console.log("OK:", msg)
  }
}

assert(toStudySettingBool(true) === true, "toStudySettingBool(true)")
assert(toStudySettingBool("1") === true, "toStudySettingBool('1')")
assert(toStudySettingBool(false) === false, "toStudySettingBool(false)")

assert(pickIsPiSignoffRequired({ isPiSignoffRequired: true }) === true, "camelCase true")
assert(pickIsPiSignoffRequired({ IsPiSignoffRequired: true }) === true, "PascalCase true")
assert(pickIsPiSignoffRequired({ isPiSignoffRequired: false }) === false, "explicit false")
assert(pickIsPiSignoffRequired(null) === false, "null payload defaults false")
assert(
  pickIsPiSignoffRequired({ studySetting: { isPiSignoffRequired: true } }) === true,
  "nested studySetting",
)

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`)
  process.exit(1)
}
console.log("\nAll helper checks passed.")
