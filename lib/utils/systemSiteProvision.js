/**
 * Ensure numbered system sites (s-01, …) exist for a study before CRC auto-assign.
 * Creates sites on demand up to provisionUpTo (not the full capacity in one shot).
 */

import { formatSystemSiteCode } from "@/lib/utils/systemSiteNaming"
import {
  getSiteLabel,
  normalizeSitesList,
  pickSystemSitesForImport,
} from "@/lib/masters/systemSiteStudyUserTemplate"

function getExistingSystemSiteNames(sites, prefix) {
  return new Set(
    pickSystemSitesForImport(sites, prefix).map((site) => getSiteLabel(site).toLowerCase()),
  )
}

async function fetchStudyProtocolNumber(studyService, studyId) {
  if (!studyService?.getStudyById) return ""
  try {
    const res = await studyService.getStudyById(studyId)
    if (!res?.isSuccess && !res?.success) return ""
    const data = res.data ?? {}
    return String(
      data.studyProtocolNumber ??
        data.StudyProtocolNumber ??
        data.protocolNumber ??
        data.ProtocolNumber ??
        "",
    ).trim()
  } catch {
    return ""
  }
}

async function createSystemSiteAtIndex(
  siteService,
  {
    studyId,
    index,
    maxCount,
    prefix,
    studyProtocolNumber,
    studyService,
    existingNames,
  },
) {
  const code = formatSystemSiteCode(index, maxCount, prefix)
  if (existingNames.has(code.toLowerCase())) return ""

  const protocol =
    String(studyProtocolNumber ?? "").trim() ||
    (await fetchStudyProtocolNumber(studyService, studyId)) ||
    `Study-${studyId}`

  const createRes = await siteService.createSite({
    StudyId: studyId,
    StudyProtocolNumber: protocol,
    SiteName: code,
    SiteFullName: code,
    PlannedPatients: 10,
    InvestigatorName: "System Site",
    EmailId: `systemsite${studyId}${index}@mailinator.com`,
    Region: "West",
    SiteAddress: "Auto-generated system site",
    PinCode: "400001",
  })

  if (createRes?.isSuccess) {
    existingNames.add(code.toLowerCase())
    return ""
  }

  return (
    createRes?.message ||
    createRes?.data?.message ||
    `Failed to create site ${code}`
  )
}

/**
 * @param {number|null} options.provisionUpTo - Create only sites 1..provisionUpTo (on demand).
 *   When omitted, provisions the full siteCount (legacy; avoid for new flows).
 * @returns {{ sitesList: array, systemSiteCount: number, lastError: string }}
 */
export async function ensureSystemSitesForStudy(
  siteService,
  {
    studyId,
    siteCount,
    provisionUpTo = null,
    prefix = "s-",
    isNamingCustomizable = false,
    studyProtocolNumber = "",
    studyService = null,
  } = {},
) {
  const numericStudyId = Number.parseInt(String(studyId ?? ""), 10)
  const maxCount = Math.max(0, Number.parseInt(String(siteCount ?? ""), 10) || 0)
  let lastError = ""

  if (!Number.isFinite(numericStudyId) || numericStudyId <= 0) {
    return { sitesList: [], systemSiteCount: 0, lastError: "Invalid study id" }
  }

  let sitesRes = await siteService.getSitesByStudy(numericStudyId)
  let sitesList = normalizeSitesList(sitesRes)
  let systemSites = pickSystemSitesForImport(sitesList, prefix)

  if (maxCount <= 0) {
    return { sitesList, systemSiteCount: systemSites.length, lastError: "" }
  }

  const parsedProvisionUpTo =
    provisionUpTo != null
      ? Math.max(0, Number.parseInt(String(provisionUpTo ?? ""), 10) || 0)
      : maxCount
  const targetCount = Math.min(maxCount, parsedProvisionUpTo)

  if (systemSites.length >= targetCount) {
    return { sitesList, systemSiteCount: systemSites.length, lastError: "" }
  }

  const existingNames = getExistingSystemSiteNames(sitesList, prefix)

  for (let index = 1; index <= targetCount; index += 1) {
    const code = formatSystemSiteCode(index, maxCount, prefix)
    if (existingNames.has(code.toLowerCase())) continue

    const createError = await createSystemSiteAtIndex(siteService, {
      studyId: numericStudyId,
      index,
      maxCount,
      prefix,
      studyProtocolNumber,
      studyService,
      existingNames,
    })
    if (createError) {
      lastError = createError
    }
  }

  sitesRes = await siteService.getSitesByStudy(numericStudyId)
  sitesList = normalizeSitesList(sitesRes)
  systemSites = pickSystemSitesForImport(sitesList, prefix)

  return {
    sitesList,
    systemSiteCount: systemSites.length,
    lastError: systemSites.length > 0 ? "" : lastError,
  }
}
