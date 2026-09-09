import { getSdvPatientIdDisplay } from "@/lib/reports/sdvReportDisplay"
import { pickDtoField } from "@/lib/reports/reportRowDisplay"

function pickTrimmedString(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue
    const text = String(value).trim()
    if (text) return text
  }
  return null
}

/** Site label — matches SDV report `siteName` column. */
export function getRsdvSiteDisplay(row) {
  if (!row || typeof row !== "object") return "—"
  const site = pickTrimmedString(
    row.siteName,
    row.SiteName,
    row.site?.siteName,
    row.Site?.SiteName,
    row.site?.name,
  )
  return site || "—"
}

/** Patient ID — uses enrolment ID like SDV report. */
export function getRsdvPatientIdDisplay(row) {
  const id = getSdvPatientIdDisplay(row)
  return id === "-" ? "—" : id
}

/** Patient initial — separate from patient ID (SDV report Initial column). */
export function getRsdvInitialDisplay(row) {
  if (!row || typeof row !== "object") return "—"
  const initial = pickTrimmedString(
    row.patientInitial,
    row.PatientInitial,
    row.initial,
    row.Initial,
  )
  return initial || "—"
}

export function formatRsdvVisitLabel(row) {
  if (!row || typeof row !== "object") return "—"
  const name = pickTrimmedString(row.visitName, row.VisitName)
  const no = pickDtoField(row, "visitNo", "VisitNo")
  if (name && no != null && no !== "") return `${name} (#${no})`
  if (name) return name
  if (no != null && no !== "") return `Visit ${no}`
  return "—"
}

export function formatRsdvUploadedAt(value) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString()
}

export const RSDV_STATUS_TABS = [
  { id: "pending", label: "Pending" },
  { id: "in_progress", label: "In progress" },
  { id: "completed", label: "Completed" },
]

export function normalizeRsdvStatusFilter(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
  if (normalized === "inprogress" || normalized === "ongoing") return "in_progress"
  if (normalized === "complete") return "completed"
  if (RSDV_STATUS_TABS.some((tab) => tab.id === normalized)) return normalized
  return "pending"
}

export function getRsdvStatusLabel(status) {
  switch (normalizeRsdvStatusFilter(status)) {
    case "in_progress":
      return "In progress"
    case "completed":
      return "Completed"
    default:
      return "Pending"
  }
}

export function getRsdvStatusBadgeClass(status) {
  switch (normalizeRsdvStatusFilter(status)) {
    case "in_progress":
      return "border-sky-200 bg-sky-50 text-sky-800"
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-800"
    default:
      return "border-amber-200 bg-amber-50 text-amber-900"
  }
}

export function getRsdvQueueEmptyMessage(statusFilter) {
  switch (normalizeRsdvStatusFilter(statusFilter)) {
    case "in_progress":
      return "No documents are currently in progress."
    case "completed":
      return "No completed reviews yet."
    default:
      return "No pending documents awaiting review."
  }
}

/** @deprecated Prefer labeled fields via getRsdvPatientIdDisplay + getRsdvInitialDisplay */
export function formatRsdvPatientLabel(row) {
  const pid = getRsdvPatientIdDisplay(row)
  const initial = getRsdvInitialDisplay(row)
  if (pid !== "—" && initial !== "—") return `${pid} (${initial})`
  if (pid !== "—") return pid
  if (initial !== "—") return initial
  return "—"
}

export function getRsdvContextFields(row, { includeVisit = true } = {}) {
  const fields = [
    { key: "site", label: "Site", value: getRsdvSiteDisplay(row) },
    { key: "patientId", label: "Patient ID", value: getRsdvPatientIdDisplay(row) },
    { key: "initial", label: "Initial", value: getRsdvInitialDisplay(row) },
  ]
  if (includeVisit) {
    fields.push({ key: "visit", label: "Visit", value: formatRsdvVisitLabel(row) })
  }
  return fields
}
