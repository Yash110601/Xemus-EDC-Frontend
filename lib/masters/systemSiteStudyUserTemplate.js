/**
 * CSV template + helpers for bulk Doctor/CRC import when study uses system site creation.
 * Sites (s-01, s-02, …) are auto-assigned by row order — no Site column in the template.
 */

import { DEFAULT_SYSTEM_SITE_PREFIX } from "@/lib/utils/systemSiteNaming"

const BASE_TEMPLATE_HEADERS = [
  "EmailId*",
  "DoctorName*",
  "MobileNo",
  "MicrCode",
  "Address",
  "PinCode",
  "PanNumber",
  "NoOfPlannedPatients*",
  "TotalHonorariumAmount*",
  "Region",
  "City",
  "State",
]

const SITE_HEADER_KEYS = new Set([
  "siteid",
  "site id",
  "sitename",
  "site name",
  "sitecode",
  "site code",
  "site",
])

const PAYMENT_HEADER_KEYS = new Set([
  "totalhonorariumamount",
  "total payment amount",
  "totalpaymentamount",
  "visitamounts",
  "visit amounts",
])

function isPaymentAmountHeader(normalizedHeader) {
  if (!normalizedHeader) return false
  if (PAYMENT_HEADER_KEYS.has(normalizedHeader)) return true
  if (/^ms\d+_amount$/.test(normalizedHeader)) return true
  if (/^vs\d+_amount$/.test(normalizedHeader)) return true
  return false
}

function filterCsvColumns(csvText, shouldDropHeader) {
  const lines = String(csvText ?? "")
    .split(/\r?\n|\r/)
    .filter((line) => line.trim())
  if (lines.length < 1) return csvText

  const delimiter = detectDelimiter(lines[0])
  const rawHeaders = parseCsvLine(lines[0], delimiter)
  const normalized = rawHeaders.map(normalizeHeader)

  const dropIndices = new Set()
  normalized.forEach((header, index) => {
    if (shouldDropHeader(header)) dropIndices.add(index)
  })

  if (dropIndices.size === 0) return csvText

  const keepIndices = rawHeaders.map((_, index) => index).filter((index) => !dropIndices.has(index))
  const out = [keepIndices.map((index) => rawHeaders[index]).map(escapeCsvCell).join(delimiter)]

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i], delimiter)
    out.push(
      keepIndices
        .map((index) => values[index] ?? "")
        .map(escapeCsvCell)
        .join(delimiter),
    )
  }

  return out.join("\n")
}

function escapeCsvCell(value) {
  const s = String(value ?? "")
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function getSiteLabel(site) {
  return String(
    site?.siteName ??
      site?.SiteName ??
      site?.siteFullName ??
      site?.SiteFullName ??
      site?.siteCode ??
      site?.SiteCode ??
      "",
  ).trim()
}

function getSiteNumericId(site) {
  const id = site?.id ?? site?.siteId ?? site?.SiteId
  return id != null && String(id).trim() !== "" ? String(id) : ""
}

/** Extract trailing digits for s-01 style sort. */
function systemSiteSortKey(name, prefix = DEFAULT_SYSTEM_SITE_PREFIX) {
  const label = String(name ?? "").trim().toLowerCase()
  const p = String(prefix ?? DEFAULT_SYSTEM_SITE_PREFIX).toLowerCase()
  if (!label.startsWith(p)) return Number.MAX_SAFE_INTEGER
  const suffix = label.slice(p.length)
  const n = Number.parseInt(suffix, 10)
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER
}

export function sortSitesBySystemCode(sites = [], prefix = DEFAULT_SYSTEM_SITE_PREFIX) {
  return [...(Array.isArray(sites) ? sites : [])].sort((a, b) => {
    const keyA = systemSiteSortKey(getSiteLabel(a), prefix)
    const keyB = systemSiteSortKey(getSiteLabel(b), prefix)
    if (keyA !== keyB) return keyA - keyB
    return getSiteLabel(a).localeCompare(getSiteLabel(b))
  })
}

export function siteMatchesSystemPrefix(site, prefix = DEFAULT_SYSTEM_SITE_PREFIX) {
  const p = String(prefix ?? DEFAULT_SYSTEM_SITE_PREFIX).toLowerCase()
  return getSiteLabel(site).toLowerCase().startsWith(p)
}

/** Only sites created with system naming (e.g. s-01, s-02). Manual sites are excluded. */
export function pickSystemSitesForImport(sites = [], prefix = DEFAULT_SYSTEM_SITE_PREFIX) {
  const list = Array.isArray(sites) ? sites : []
  const matching = list.filter((site) => siteMatchesSystemPrefix(site, prefix))
  return sortSitesBySystemCode(matching, prefix)
}

export function resolveSiteIdFromNameOrCode(rawValue, sites = []) {
  const needle = String(rawValue ?? "").trim().toLowerCase()
  if (!needle || !Array.isArray(sites) || sites.length === 0) return ""

  const match = sites.find((site) => {
    const candidates = [
      site?.siteName,
      site?.SiteName,
      site?.siteFullName,
      site?.SiteFullName,
      site?.id,
      site?.siteId,
      site?.SiteId,
    ]
    return candidates.some((c) => String(c ?? "").trim().toLowerCase() === needle)
  })

  if (!match) return ""
  return getSiteNumericId(match)
}

/** Row 1 → first system site, row 2 → second, etc. */
export function assignSystemSiteForImportRow(rowIndex, sites = [], prefix = DEFAULT_SYSTEM_SITE_PREFIX) {
  const ordered = pickSystemSitesForImport(sites, prefix)
  const site = ordered[rowIndex]
  if (!site) return { siteId: "", siteName: "" }
  return {
    siteId: getSiteNumericId(site),
    siteName: getSiteLabel(site),
  }
}

/** Single entry: next site = same index as existing study-user count. */
export function assignSystemSiteForSingleEntry(
  sites = [],
  existingUserCount = 0,
  prefix = DEFAULT_SYSTEM_SITE_PREFIX,
) {
  return assignSystemSiteForImportRow(existingUserCount, sites, prefix)
}

export function extractStudyUserCount(usersPayload) {
  return extractStudyUsersList(usersPayload).length
}

export function extractStudyUsersList(usersPayload) {
  if (Array.isArray(usersPayload)) return usersPayload
  if (usersPayload && typeof usersPayload === "object") {
    const nested =
      usersPayload.items ??
      usersPayload.Items ??
      usersPayload.studyUsers ??
      usersPayload.StudyUsers ??
      usersPayload.data
    if (Array.isArray(nested)) return nested
  }
  return []
}

export function isApiSuccess(response) {
  return Boolean(response?.isSuccess || response?.success)
}

export function normalizeSitesList(sitesRes) {
  if (!isApiSuccess(sitesRes)) return []
  const data = sitesRes.data
  return Array.isArray(data) ? data : (data?.items || data?.Items || [])
}

export function normalizeAssignedSitesList(assignedRes) {
  if (!isApiSuccess(assignedRes)) return []
  const payload = assignedRes.data
  if (Array.isArray(payload)) return payload
  return payload?.sites ?? payload?.Sites ?? payload?.data?.sites ?? payload?.data?.Sites ?? []
}

function siteEntryHasUsers(entry) {
  if (!entry || typeof entry !== "object") return false
  const users =
    entry.users ??
    entry.Users ??
    entry.studyUsers ??
    entry.StudyUsers ??
    entry.assignedUsers ??
    entry.AssignedUsers ??
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

/** First system site without an assigned CRC; includes full site list for UI. */
export function pickNextAvailableSystemSite(sites = [], assignedEntries = [], prefix = DEFAULT_SYSTEM_SITE_PREFIX) {
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
    allSites: allSites.map((site, index) => ({
      ...site,
      isNext: index === nextIndex,
    })),
    availableCount: allSites.length,
    usedCount: allSites.filter((site) => site.occupied).length,
  }
}

export function resolveImportStudyType(defaultStudyType, study) {
  const normalized = String(defaultStudyType ?? "").trim()
  if (normalized === "milestonePatient" || normalized === "milestoneVisit" || normalized === "normal") {
    return normalized
  }

  const raw = study?.studyType ?? study?.StudyType ?? study?.study_type ?? study?.type
  if (raw === 2 || raw === "2" || String(raw).toLowerCase() === "milestone") return "milestonePatient"
  if (raw === 3 || raw === "3" || String(raw).toLowerCase() === "visit") return "milestoneVisit"
  return "normal"
}

function buildTemplateHeaders(studyType = "normal", sitePaymentEnabled = true) {
  const headers = BASE_TEMPLATE_HEADERS.filter(
    (header) => sitePaymentEnabled || header !== "TotalHonorariumAmount*",
  )
  const insertIdx = sitePaymentEnabled
    ? headers.indexOf("TotalHonorariumAmount*") + 1
    : headers.indexOf("NoOfPlannedPatients*") + 1

  if (studyType === "milestonePatient") {
    headers.splice(insertIdx, 0, "NumberOfMilestones*")
  } else if (studyType === "milestoneVisit" && sitePaymentEnabled) {
    headers.splice(insertIdx, 0, "VisitAmounts*")
  }

  return headers
}

export function buildSystemSiteStudyUserTemplateCsv(studyType = "normal", sitePaymentEnabled = true) {
  const headers = buildTemplateHeaders(studyType, sitePaymentEnabled)
  const headerLine = headers.join(",")

  const baseRowOne = [
    "doctor1@example.com",
    "Dr Example One",
    "9876543210",
    "",
    "Site address line",
    "400001",
    "ABCDE1234F",
    "10",
  ]
  const baseRowTwo = [
    "doctor2@example.com",
    "Dr Example Two",
    "9876543211",
    "",
    "Site address line",
    "400002",
    "ABCDE1235F",
    "10",
  ]

  if (sitePaymentEnabled) {
    baseRowOne.push("50000")
    baseRowTwo.push("50000")
  }

  const tail = ["West", "Mumbai", "Maharashtra"]
  const tailTwo = ["West", "Pune", "Maharashtra"]

  let exampleRows
  if (studyType === "milestonePatient") {
    exampleRows = [
      [...baseRowOne, "2", ...tail],
      [...baseRowTwo, "2", ...tailTwo],
    ]
  } else if (studyType === "milestoneVisit" && sitePaymentEnabled) {
    exampleRows = [
      [...baseRowOne, "25000,25000", ...tail],
      [...baseRowTwo, "20000,30000", ...tailTwo],
    ]
  } else {
    exampleRows = [
      [...baseRowOne, ...tail],
      [...baseRowTwo, ...tailTwo],
    ]
  }

  const lines = [headerLine, ...exampleRows.map((row) => row.map(escapeCsvCell).join(","))]
  return lines.join("\n")
}

/** Remove SiteId / SiteName columns from API sample CSV for system-site studies. */
export function stripSiteColumnsFromStudyUserCsv(csvText) {
  return filterCsvColumns(csvText, (header) => SITE_HEADER_KEYS.has(header))
}

/** Remove honorarium / milestone / visit amount columns when site payment is disabled. */
export function stripPaymentColumnsFromStudyUserCsv(csvText) {
  return filterCsvColumns(csvText, isPaymentAmountHeader)
}

export function downloadSystemSiteStudyUserTemplateCsv(
  studyLabel = "study",
  studyType = "normal",
  csvText = null,
  sitePaymentEnabled = true,
) {
  if (typeof window === "undefined") return false

  const csv =
    csvText ||
    buildSystemSiteStudyUserTemplateCsv(studyType, sitePaymentEnabled)
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = window.URL.createObjectURL(blob)
  const safeLabel = String(studyLabel || "study")
    .replace(/[^\w.-]+/g, "_")
    .slice(0, 40)
  const a = document.createElement("a")
  a.href = url
  a.download = `study-users-system-sites-${safeLabel}-${new Date().toISOString().split("T")[0]}.csv`
  document.body.appendChild(a)
  a.click()
  window.URL.revokeObjectURL(url)
  document.body.removeChild(a)
  return true
}

function parseCsvLine(line, delimiter = ",") {
  const result = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim())
      current = ""
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

function detectDelimiter(firstLine) {
  const commaSplit = parseCsvLine(firstLine, ",")
  if (commaSplit.length === 1 && firstLine.includes(";")) return ";"
  return ","
}

function normalizeHeader(header) {
  return String(header ?? "")
    .replace(/\*/g, "")
    .toLowerCase()
    .trim()
}

/**
 * Prepend SiteId* for API import — one system site per row (row order).
 */
export function injectSiteIdsIntoStudyUserCsv(csvText, siteIds = []) {
  const lines = String(csvText ?? "")
    .split(/\r?\n|\r/)
    .filter((line) => line.trim())
  if (lines.length < 2) return csvText

  const delimiter = detectDelimiter(lines[0])
  const rawHeaders = parseCsvLine(lines[0], delimiter)
  const normalized = rawHeaders.map(normalizeHeader)
  const hasSiteColumn = normalized.some((h) => SITE_HEADER_KEYS.has(h))

  if (hasSiteColumn) return csvText

  const newHeaders = ["SiteId*", ...rawHeaders]
  const out = [newHeaders.map(escapeCsvCell).join(delimiter)]

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i], delimiter)
    const siteId = String(siteIds[i - 1] ?? "").trim()
    out.push([siteId, ...values].map(escapeCsvCell).join(delimiter))
  }

  return out.join("\n")
}
