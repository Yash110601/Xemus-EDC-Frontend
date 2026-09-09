export function formatDateForDisplay(dateString) {
  if (!dateString) return "N/A"
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return "N/A"
    const day = String(date.getDate()).padStart(2, "0")
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const year = date.getFullYear()
    return `${day}-${month}-${year}`
  } catch {
    return "N/A"
  }
}

export function convertDateToISO(dateString) {
  if (!dateString) return null
  if (dateString.includes("T") && dateString.includes("Z")) {
    return dateString
  }
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return null
  return date.toISOString()
}

export function convertISOToDateInput(dateString) {
  if (!dateString) return ""
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString
    }
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return ""
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  } catch {
    return ""
  }
}

export function resolveIsActive(value) {
  if (value === undefined || value === null) return false
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value === 1
  if (typeof value === "string") {
    const v = value.toLowerCase().trim()
    return v === "true" || v === "1" || v === "active"
  }
  return false
}
