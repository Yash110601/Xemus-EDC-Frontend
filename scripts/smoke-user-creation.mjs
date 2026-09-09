/**
 * Browser smoke test for /masters/user-creation (no login — checks runtime errors on load/redirect).
 * Run: node scripts/smoke-user-creation.mjs
 */
import { chromium } from "playwright"

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3000"
const TARGET = `${BASE}/masters/user-creation`

const errors = []
const pageErrors = []

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
const page = await context.newPage()

page.on("pageerror", (err) => pageErrors.push(String(err.message || err)))
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text())
})

const response = await page.goto(TARGET, { waitUntil: "networkidle", timeout: 60000 })
const status = response?.status() ?? 0
const finalUrl = page.url()

await page.waitForTimeout(2000)

const bodyText = await page.locator("body").innerText().catch(() => "")

await browser.close()

const critical = [...pageErrors, ...errors].filter(
  (line) =>
    /fetchSitesByStudy|createUserStudyId|createUserStudies|before initialization/i.test(line),
)

console.log("=== User Creation smoke test ===")
console.log(`Target:     ${TARGET}`)
console.log(`HTTP:       ${status}`)
console.log(`Final URL:  ${finalUrl}`)
console.log(`On login:   ${/login/i.test(finalUrl)}`)
console.log(`Page text:  ${bodyText.slice(0, 120).replace(/\s+/g, " ")}...`)
console.log(`Console errors: ${errors.length}`)
console.log(`Page errors:    ${pageErrors.length}`)

if (critical.length > 0) {
  console.error("\n❌ Critical runtime errors:")
  critical.forEach((e) => console.error("  -", e))
  process.exit(1)
}

if (errors.length > 0 || pageErrors.length > 0) {
  console.log("\nOther console/page errors (non-critical):")
  ;[...pageErrors, ...errors].slice(0, 8).forEach((e) => console.log("  -", e.slice(0, 200)))
}

if (status >= 500) {
  console.error(`\n❌ Server error HTTP ${status}`)
  process.exit(1)
}

console.log("\n✓ No critical runtime errors on page load/redirect")
