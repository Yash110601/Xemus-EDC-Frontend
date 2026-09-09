/**
 * Client-side aggregates from query report rows (until dedicated dashboard API exists).
 */

function pickRowStatus(row) {
  const raw = row?.status ?? row?.Status ?? ""
  const normalized = String(raw).trim().toLowerCase()
  if (normalized.includes("closed")) return "closed"
  if (normalized.includes("process")) return "inProcess"
  if (normalized.includes("open")) return "open"
  return "other"
}

export function aggregateQueryReportRows(items = []) {
  const byStatus = { open: 0, inProcess: 0, closed: 0, other: 0 }
  const bySite = new Map()
  const byAge = { "0-7": 0, "8-14": 0, "15+": 0, unknown: 0 }
  const byType = { manual: 0, system: 0, other: 0 }

  for (const row of items) {
    const status = pickRowStatus(row)
    byStatus[status] = (byStatus[status] ?? 0) + 1

    const siteName = String(row?.siteName ?? row?.SiteName ?? "Unknown site").trim() || "Unknown site"
    bySite.set(siteName, (bySite.get(siteName) ?? 0) + 1)

    const ageDays = Number(row?.queryAgeDays ?? row?.QueryAgeDays ?? NaN)
    if (!Number.isFinite(ageDays)) byAge.unknown += 1
    else if (ageDays <= 7) byAge["0-7"] += 1
    else if (ageDays <= 14) byAge["8-14"] += 1
    else byAge["15+"] += 1

    const typeRaw = String(row?.queryType ?? row?.QueryType ?? "").toLowerCase()
    if (typeRaw.includes("manual")) byType.manual += 1
    else if (typeRaw.includes("system")) byType.system += 1
    else byType.other += 1
  }

  const siteBreakdown = [...bySite.entries()]
    .map(([siteName, count]) => ({ siteName, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  return {
    total: items.length,
    byStatus,
    byAge,
    byType,
    siteBreakdown,
  }
}
