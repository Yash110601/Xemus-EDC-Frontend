/**
 * Export newly created study-user credentials from bulk import (Super Admin).
 */

function csvEscape(value) {
  const text = String(value ?? "")
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function normalizeImportCredentials(credentials) {
  if (!Array.isArray(credentials)) return []

  return credentials
    .map((cred) => ({
      rowNumber: cred.rowNumber ?? cred.RowNumber ?? "",
      doctorName: cred.doctorName ?? cred.DoctorName ?? "",
      email: cred.email ?? cred.Email ?? "",
      username: cred.username ?? cred.Username ?? cred.email ?? cred.Email ?? "",
      generatedPassword: cred.generatedPassword ?? cred.GeneratedPassword ?? "",
      emailSent: cred.emailSent ?? cred.EmailSent ?? null,
      emailError: cred.emailError ?? cred.EmailError ?? "",
    }))
    .filter((cred) => cred.email && cred.generatedPassword)
}

export function normalizeImportCredentialsForGlobalIndex(credentials, startDataRowIndex = 0) {
  if (!Array.isArray(credentials)) return []

  return credentials
    .map((cred) => {
      const rowNum = cred.rowNumber ?? cred.RowNumber
      const parsed = typeof rowNum === "number" ? rowNum : parseInt(rowNum, 10)
      const globalRow = Number.isFinite(parsed) ? parsed + startDataRowIndex : startDataRowIndex + 2

      return {
        rowNumber: globalRow,
        doctorName: cred.doctorName ?? cred.DoctorName ?? "",
        email: cred.email ?? cred.Email ?? "",
        username: cred.username ?? cred.Username ?? cred.email ?? cred.Email ?? "",
        generatedPassword: cred.generatedPassword ?? cred.GeneratedPassword ?? "",
        emailSent: cred.emailSent ?? cred.EmailSent ?? null,
        emailError: cred.emailError ?? cred.EmailError ?? "",
      }
    })
    .filter((cred) => cred.email && cred.generatedPassword)
}

export function downloadStudyUserCredentialsCsv(credentials, filename = "study-user-credentials.csv") {
  const rows = normalizeImportCredentials(credentials)
  if (!rows.length) return false

  const header = ["Row", "Doctor Name", "Email", "Username", "Generated Password"]
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.rowNumber,
        csvEscape(row.doctorName),
        csvEscape(row.email),
        csvEscape(row.username),
        csvEscape(row.generatedPassword),
      ].join(",")
    ),
  ]

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  window.URL.revokeObjectURL(url)
  document.body.removeChild(anchor)
  return true
}
