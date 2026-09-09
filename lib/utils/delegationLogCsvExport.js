function escapeCsvCell(value) {
  const text = String(value ?? "")
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function formatDate(value) {
  if (!value) return ""
  return String(value).slice(0, 10)
}

/**
 * Client-side CSV export for delegation log rows (no API — does not affect study workflow).
 */
export function downloadDelegationLogCsv(rows, studyLabel = "study") {
  const headers = ["Site", "User", "Email", "Role", "Task", "Start Date", "End Date", "GCP Training", "CV Date", "PI Signed", "PI Signed By", "Status"]
  const lines = [
    headers.join(","),
    ...(rows ?? []).map((row) =>
      [
        row.siteName ?? row.SiteName,
        row.delegatedUserName ?? row.DelegatedUserName,
        row.delegatedUserEmail ?? row.DelegatedUserEmail,
        row.roleName ?? row.RoleName,
        row.taskDescription ?? row.TaskDescription,
        formatDate(row.startDate ?? row.StartDate),
        formatDate(row.endDate ?? row.EndDate),
        formatDate(row.gcpTrainingCompletedDate ?? row.GcpTrainingCompletedDate),
        formatDate(row.cvVersionDate ?? row.CvVersionDate),
        row.isPiSigned ?? row.IsPiSigned ?? row.piSignedAt ?? row.PiSignedAt ? "Yes" : "No",
        row.piSignedByName ?? row.PiSignedByName ?? "",
        row.isActive ?? row.IsActive ? "Active" : "Inactive",
      ]
        .map(escapeCsvCell)
        .join(","),
    ),
  ]

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  const safeStudy = String(studyLabel).replace(/[^\w-]+/g, "_").slice(0, 48) || "study"
  anchor.href = url
  anchor.download = `delegation-log-${safeStudy}-${new Date().toISOString().slice(0, 10)}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}
