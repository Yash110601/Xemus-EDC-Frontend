/**
 * Automated checks for system-site auto-assignment logic (no API auth required).
 * Run: node scripts/system-site-assignment.test.mjs
 */

import assert from "node:assert/strict"

const DEFAULT_PREFIX = "s-"

function getSiteLabel(site) {
  return String(site?.siteName ?? site?.SiteName ?? site?.siteFullName ?? site?.SiteFullName ?? "").trim()
}

function getSiteNumericId(site) {
  const id = site?.id ?? site?.siteId ?? site?.SiteId
  return id != null && String(id).trim() !== "" ? String(id) : ""
}

function siteMatchesSystemPrefix(site, prefix = DEFAULT_PREFIX) {
  const p = String(prefix ?? DEFAULT_PREFIX).toLowerCase()
  return getSiteLabel(site).toLowerCase().startsWith(p)
}

function systemSiteSortKey(name, prefix = DEFAULT_PREFIX) {
  const label = String(name ?? "").trim().toLowerCase()
  const p = String(prefix ?? DEFAULT_PREFIX).toLowerCase()
  if (!label.startsWith(p)) return Number.MAX_SAFE_INTEGER
  const suffix = label.slice(p.length)
  const n = Number.parseInt(suffix, 10)
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER
}

function sortSitesBySystemCode(sites = [], prefix = DEFAULT_PREFIX) {
  return [...sites].sort((a, b) => {
    const keyA = systemSiteSortKey(getSiteLabel(a), prefix)
    const keyB = systemSiteSortKey(getSiteLabel(b), prefix)
    if (keyA !== keyB) return keyA - keyB
    return getSiteLabel(a).localeCompare(getSiteLabel(b))
  })
}

function pickSystemSitesForImport(sites = [], prefix = DEFAULT_PREFIX) {
  const matching = sites.filter((site) => siteMatchesSystemPrefix(site, prefix))
  return sortSitesBySystemCode(matching, prefix)
}

function siteEntryHasUsers(entry) {
  const users =
    entry?.users ??
    entry?.Users ??
    entry?.studyUsers ??
    entry?.StudyUsers ??
    []
  return Array.isArray(users) && users.length > 0
}

function isSiteOccupied(site, assignedEntries = []) {
  if (siteEntryHasUsers(site)) return true
  const siteId = getSiteNumericId(site)
  if (!siteId) return false
  const match = assignedEntries.find(
    (entry) => String(entry?.siteId ?? entry?.SiteId ?? entry?.id ?? entry?.Id ?? "") === siteId,
  )
  return siteEntryHasUsers(match)
}

function pickNextAvailableSystemSite(sites = [], assignedEntries = [], prefix = DEFAULT_PREFIX) {
  let ordered = pickSystemSitesForImport(sites, prefix)
  if (ordered.length === 0 && assignedEntries.length > 0) {
    ordered = pickSystemSitesForImport(assignedEntries, prefix)
  }

  const allSites = ordered.map((site) => {
    const siteId = getSiteNumericId(site)
    const siteName = getSiteLabel(site) || siteId
    const occupied = isSiteOccupied(site, assignedEntries)
    return { siteId, siteName, occupied }
  })

  const nextIndex = allSites.findIndex((site) => site.siteId && !site.occupied)
  const next = nextIndex >= 0 ? allSites[nextIndex] : null

  return {
    siteId: next?.siteId ?? "",
    siteName: next?.siteName ?? "",
    allSites: allSites.map((site, index) => ({ ...site, isNext: index === nextIndex })),
  }
}

// --- tests ---
const mixedSites = [
  { id: 1, siteName: "Shree Ganesh Hospital" },
  { id: 2, siteName: "s-02" },
  { id: 3, siteName: "s-01" },
  { id: 4, siteName: "Another Clinic" },
]

const picked = pickSystemSitesForImport(mixedSites, "s-")
assert.deepEqual(
  picked.map((s) => s.siteName),
  ["s-01", "s-02"],
  "only s- prefixed sites, sorted",
)

const manualOnly = pickSystemSitesForImport([{ id: 9, siteName: "Shree Ganesh Hospital" }], "s-")
assert.equal(manualOnly.length, 0, "manual hospital excluded when no system sites")

const nextEmpty = pickNextAvailableSystemSite(mixedSites, [], "s-")
assert.equal(nextEmpty.siteName, "s-01", "first free system site is s-01")
assert.equal(nextEmpty.allSites.find((s) => s.isNext)?.siteName, "s-01")

const nextWithUsed = pickNextAvailableSystemSite(
  mixedSites,
  [{ siteId: 3, users: [{ id: 1 }] }],
  "s-",
)
assert.equal(nextWithUsed.siteName, "s-02", "s-01 occupied → next is s-02")

const allUsed = pickNextAvailableSystemSite(
  mixedSites,
  [
    { siteId: 3, users: [{}] },
    { siteId: 2, users: [{}] },
  ],
  "s-",
)
assert.equal(allUsed.siteId, "", "no site when all system sites used")

// --- template / CSV tests ---
const SITE_HEADER_KEYS = new Set([
  "siteid", "site id", "sitename", "site name", "sitecode", "site code", "site",
])

function normalizeHeader(h) {
  return String(h ?? "").trim().toLowerCase().replace(/\*/g, "")
}

function parseCsvLine(line, delimiter = ",") {
  const out = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') inQuotes = false
      else cur += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === delimiter) {
      out.push(cur)
      cur = ""
    } else cur += ch
  }
  out.push(cur)
  return out
}

function stripSiteColumnsFromStudyUserCsv(csvText) {
  const lines = String(csvText ?? "").split(/\r?\n|\r/).filter((l) => l.trim())
  if (lines.length < 1) return csvText
  const delimiter = ","
  const rawHeaders = parseCsvLine(lines[0], delimiter)
  const normalized = rawHeaders.map(normalizeHeader)
  const siteIndices = new Set()
  normalized.forEach((header, index) => {
    if (SITE_HEADER_KEYS.has(header)) siteIndices.add(index)
  })
  if (siteIndices.size === 0) return csvText
  const keepIndices = rawHeaders.map((_, index) => index).filter((index) => !siteIndices.has(index))
  const out = [keepIndices.map((index) => rawHeaders[index]).join(delimiter)]
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i], delimiter)
    out.push(keepIndices.map((index) => values[index] ?? "").join(delimiter))
  }
  return out.join("\n")
}

const apiCsv = "EmailId*,SiteName*,DoctorName*,NumberOfMilestones*\n" +
  "a@x.com,s-01,Dr A,2"
const stripped = stripSiteColumnsFromStudyUserCsv(apiCsv)
assert.ok(!stripped.includes("SiteName"), "site column removed from template")
assert.ok(stripped.includes("NumberOfMilestones"), "milestone column kept")
assert.ok(stripped.includes("Dr A"), "data rows preserved")

function buildTemplateHeaders(studyType) {
  const headers = [
    "EmailId*", "DoctorName*", "MobileNo", "MicrCode", "Address", "PinCode",
    "PanNumber", "NoOfPlannedPatients*", "TotalHonorariumAmount*",
    "Region", "City", "State",
  ]
  const insertIdx = headers.indexOf("TotalHonorariumAmount*") + 1
  if (studyType === "milestonePatient") headers.splice(insertIdx, 0, "NumberOfMilestones*")
  else if (studyType === "milestoneVisit") headers.splice(insertIdx, 0, "VisitAmounts*")
  return headers
}

const milestoneHeaders = buildTemplateHeaders("milestonePatient")
assert.ok(milestoneHeaders.includes("NumberOfMilestones*"), "milestone patient template has milestones")
assert.ok(!milestoneHeaders.some((h) => /site/i.test(h)), "no site column in system template")

console.log("✓ All system-site assignment tests passed")
console.log("  - Excludes manual sites (Shree Ganesh Hospital)")
console.log("  - Sorts s-01 before s-02")
console.log("  - Picks next unoccupied system site")
console.log("  - Returns empty when all system sites are used")
console.log("  - Strips SiteName from API CSV for system-site studies")
console.log("  - Milestone template includes NumberOfMilestones*")
