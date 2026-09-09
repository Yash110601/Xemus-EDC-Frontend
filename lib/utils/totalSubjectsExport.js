/**
 * Client-side Total Subjects export (CSV, HTML, Excel, PDF).
 * Pass `{ asAttachment: true }` to return `{ blob, fileName }` without downloading
 * (used by Send as Email).
 */

function siteLabel(site) {
  return String(site?.siteName || site?.SiteName || site?.name || "Site").trim() || "Site"
}

/**
 * Resolve Total Subjects series for a site.
 * Prefer patient-status breakdown when any status counts are present; otherwise fall back to
 * planned/enrolled/pending (status fields are often 0 when PatientStatus is unset).
 */
export function resolveTotalSubjectsCounts(site) {
  const planned = Number(site?.plannedPatients ?? site?.PlannedPatients ?? 0) || 0
  const totalEnrolled = Number(site?.enrolledPatients ?? site?.EnrolledPatients ?? 0) || 0
  const pending =
    Number(
      site?.pendingPatients ??
        site?.PendingPatients ??
        Math.max(0, planned - totalEnrolled),
    ) || 0
  const screenedStatus = Number(site?.screenedPatients ?? site?.ScreenedPatients ?? 0) || 0
  const screenFailed = Number(site?.screenFailedPatients ?? site?.ScreenFailedPatients ?? 0) || 0
  const enrolledStatus =
    Number(site?.enrolledInStatusPatients ?? site?.EnrolledInStatusPatients ?? 0) || 0
  const discontinued = Number(site?.discontinuedPatients ?? site?.DiscontinuedPatients ?? 0) || 0
  const completed = Number(site?.completedPatients ?? site?.CompletedPatients ?? 0) || 0

  const statusTotal =
    screenedStatus + screenFailed + enrolledStatus + discontinued + completed

  if (statusTotal > 0) {
    return {
      screened: screenedStatus,
      screenFailed,
      enrolled: enrolledStatus,
      discontinued,
      completed,
      planned,
      totalEnrolled,
    }
  }

  return {
    screened: pending,
    screenFailed: 0,
    enrolled: Math.max(0, totalEnrolled - completed),
    discontinued: 0,
    completed,
    planned,
    totalEnrolled,
  }
}

function siteStatusCounts(site) {
  const counts = resolveTotalSubjectsCounts(site)
  return {
    screened: counts.screened,
    screenFailed: counts.screenFailed,
    enrolled: counts.enrolled,
    discontinued: counts.discontinued,
    completed: counts.completed,
  }
}

export function buildTotalSubjectsRows(sites = []) {
  return (Array.isArray(sites) ? sites : []).map((site) => {
    const counts = siteStatusCounts(site)
    return {
      site: siteLabel(site),
      siteId: site?.siteId ?? site?.id ?? site?.SiteId ?? null,
      ...counts,
    }
  })
}

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  window.URL.revokeObjectURL(url)
  document.body.removeChild(link)
}

function stampDate() {
  return new Date().toISOString().slice(0, 10)
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function exportTotalSubjectsCsv(
  sites = [],
  filenamePrefix = "total-subjects",
  { asAttachment = false } = {},
) {
  const rows = buildTotalSubjectsRows(sites)
  const header = [
    "Site",
    "Screened",
    "Screen Failed",
    "Enrolled",
    "Discontinued",
    "Completed",
  ]
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        `"${String(row.site).replace(/"/g, '""')}"`,
        row.screened,
        row.screenFailed,
        row.enrolled,
        row.discontinued,
        row.completed,
      ].join(","),
    ),
  ]
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
  const stamp = stampDate()
  const fileName = `${filenamePrefix}-${stamp}.csv`
  if (asAttachment) return { blob, fileName, filename: fileName, success: true }
  downloadBlob(blob, fileName)
  return { success: true, filename: fileName, fileName, blob }
}

export function exportTotalSubjectsHtml(
  sites = [],
  filenamePrefix = "total-subjects",
  { asAttachment = false } = {},
) {
  const rows = buildTotalSubjectsRows(sites)
  const stamp = stampDate()
  const bodyRows =
    rows.length > 0
      ? rows
          .map(
            (row) => `<tr>
  <td>${escapeHtml(row.site)}</td>
  <td>${row.screened}</td>
  <td>${row.screenFailed}</td>
  <td>${row.enrolled}</td>
  <td>${row.discontinued}</td>
  <td>${row.completed}</td>
</tr>`,
          )
          .join("\n")
      : `<tr><td colspan="6">No site data available.</td></tr>`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Total Subjects</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; color: #0f172a; margin: 24px; }
    h1 { font-size: 1.35rem; margin: 0 0 4px; }
    .meta { color: #64748b; font-size: 0.85rem; margin-bottom: 16px; }
    table { border-collapse: collapse; width: 100%; max-width: 960px; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; font-size: 0.875rem; }
    th { background: #f8fafc; font-weight: 600; }
    td:not(:first-child) { text-align: right; font-variant-numeric: tabular-nums; }
  </style>
</head>
<body>
  <h1>Total Subjects</h1>
  <p class="meta">Generated ${escapeHtml(new Date().toLocaleString())}</p>
  <table>
    <thead>
      <tr>
        <th>Site</th>
        <th>Screened</th>
        <th>Screen Failed</th>
        <th>Enrolled</th>
        <th>Discontinued</th>
        <th>Completed</th>
      </tr>
    </thead>
    <tbody>
${bodyRows}
    </tbody>
  </table>
</body>
</html>`

  const blob = new Blob([html], { type: "text/html;charset=utf-8" })
  const fileName = `${filenamePrefix}-${stamp}.html`
  if (asAttachment) return { blob, fileName, filename: fileName, success: true }
  downloadBlob(blob, fileName)
  return { success: true, filename: fileName, fileName, blob }
}

export async function exportTotalSubjectsExcel(
  sites = [],
  filenamePrefix = "total-subjects",
  { asAttachment = false } = {},
) {
  const XLSX = await import("xlsx")
  const rows = buildTotalSubjectsRows(sites)
  const sheetRows = rows.map((row) => ({
    Site: row.site,
    Screened: row.screened,
    "Screen Failed": row.screenFailed,
    Enrolled: row.enrolled,
    Discontinued: row.discontinued,
    Completed: row.completed,
  }))
  const workbook = XLSX.utils.book_new()
  const sheet =
    sheetRows.length > 0
      ? XLSX.utils.json_to_sheet(sheetRows)
      : XLSX.utils.aoa_to_sheet([
          ["Site", "Screened", "Screen Failed", "Enrolled", "Discontinued", "Completed"],
        ])
  XLSX.utils.book_append_sheet(workbook, sheet, "Total Subjects")
  const stamp = stampDate()
  const fileName = `${filenamePrefix}-${stamp}.xlsx`
  if (asAttachment) {
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    return { blob, fileName, filename: fileName, success: true }
  }
  XLSX.writeFile(workbook, fileName)
  return { success: true, filename: fileName, fileName }
}

export async function exportTotalSubjectsPdf(
  sites = [],
  {
    pageSize = "A4",
    orientation = "landscape",
    filenamePrefix = "total-subjects",
    asAttachment = false,
  } = {},
) {
  const { jsPDF } = await import("jspdf")
  const rows = buildTotalSubjectsRows(sites)
  const orient = orientation === "portrait" ? "portrait" : "landscape"
  const format = String(pageSize || "A4").toLowerCase()
  const doc = new jsPDF({ orientation: orient, unit: "pt", format })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = Math.max(28, Math.min(48, pageWidth * 0.05))
  const usableWidth = pageWidth - margin * 2

  const colDefs = [
    { key: "site", label: "Site", weight: 2.4 },
    { key: "screened", label: "Screened", weight: 1 },
    { key: "screenFailed", label: "Screen Failed", weight: 1.15 },
    { key: "enrolled", label: "Enrolled", weight: 1 },
    { key: "discontinued", label: "Discontinued", weight: 1.15 },
    { key: "completed", label: "Completed", weight: 1 },
  ]
  const weightSum = colDefs.reduce((s, c) => s + c.weight, 0)
  const cols = colDefs.map((c) => ({
    ...c,
    width: (usableWidth * c.weight) / weightSum,
  }))

  let y = margin
  doc.setFontSize(16)
  doc.setTextColor(15, 23, 42)
  doc.text("Total Subjects", margin, y)
  y += 20
  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139)
  doc.text(
    `Generated ${new Date().toLocaleString()}  ·  ${String(pageSize)} · ${orient}`,
    margin,
    y,
  )
  y += 18

  doc.setFontSize(9)
  doc.setTextColor(15, 23, 42)
  let x = margin
  cols.forEach((col) => {
    doc.text(col.label, x, y)
    x += col.width
  })
  y += 10
  doc.setDrawColor(226, 232, 240)
  doc.line(margin, y, margin + usableWidth, y)
  y += 14

  const drawRow = (row) => {
    if (y > pageHeight - margin) {
      doc.addPage(format, orient)
      y = margin
    }
    x = margin
    cols.forEach((col) => {
      const value = col.key === "site" ? String(row.site) : String(row[col.key] ?? 0)
      const maxChars = Math.max(4, Math.floor(col.width / 5.2))
      doc.text(value.slice(0, maxChars), x, y)
      x += col.width
    })
    y += 16
  }

  if (rows.length === 0) {
    doc.text("No site data available.", margin, y)
  } else {
    rows.forEach(drawRow)
  }

  const stamp = stampDate()
  const fileName = `${filenamePrefix}-${stamp}.pdf`
  if (asAttachment) {
    const buffer = doc.output("arraybuffer")
    const blob = new Blob([buffer], { type: "application/pdf" })
    return { blob, fileName, filename: fileName, success: true }
  }
  doc.save(fileName)
  return { success: true, filename: fileName, fileName }
}
