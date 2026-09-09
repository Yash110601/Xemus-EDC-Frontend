/**
 * Laboratory result vs reference range — soft validation helpers for eCRF data entry.
 * Uses Lab Range Assignment rows (already scoped to a lab facility on the section).
 */

import { field, fieldStr } from "@/components/lab-management/lab-field-utils"

/**
 * @param {unknown[]} rows API lab range assignment rows
 * @returns {{ id: string, name: string }[]}
 */
export function buildLabTestOptionsFromAssignmentRows(rows) {
  if (!Array.isArray(rows)) return []
  const byId = new Map()
  for (const row of rows) {
    const tid = field(row, "labTestId", "LabTestId")
    if (tid == null || tid === "") continue
    const sid = String(tid)
    if (byId.has(sid)) continue
    const name = fieldStr(
      row,
      ["labTestName", "LabTestName", "testName", "TestName", "Name", "name"],
      `Test ${sid}`,
    )
    byId.set(sid, { id: sid, name })
  }
  return [...byId.values()].sort((a, b) =>
    String(a.name).localeCompare(String(b.name), undefined, { sensitivity: "base" }),
  )
}

export function getPatientAgeYearsApprox(patient) {
  if (!patient || typeof patient !== "object") return null
  const raw = patient.age ?? patient.Age ?? patient.ageInYears
  if (raw != null && String(raw).trim() !== "") {
    const n = Number(raw)
    if (Number.isFinite(n)) return n
  }
  const dob = patient.dateOfBirth ?? patient.dob ?? patient.DateOfBirth ?? patient.DOB
  if (!dob) return null
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return null
  const yrs = (Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  return Math.max(0, Math.floor(yrs))
}

function normalizeGenderToken(g) {
  const s = String(g ?? "")
    .trim()
    .toLowerCase()
  if (!s || s === "both" || s === "all") return "both"
  if (s.startsWith("f")) return "female"
  if (s.startsWith("m")) return "male"
  return s
}

function genderBandMatches(row, patientGender) {
  const rgRaw = field(row, "gender", "Gender", "ApplicableGender")
  const rg = normalizeGenderToken(rgRaw !== undefined && rgRaw !== null ? rgRaw : "Both")
  if (rg === "both") return true
  const pg = normalizeGenderToken(patientGender ?? "")
  if (!pg) return true
  return rg === pg
}

function ageBandMatches(row, ageYears) {
  if (ageYears == null || !Number.isFinite(ageYears)) return true
  const from = Number(field(row, "ageFrom", "AgeFrom"))
  const to = Number(field(row, "ageTo", "AgeTo"))
  if (!Number.isFinite(from) && !Number.isFinite(to)) return true
  const lo = Number.isFinite(from) ? from : -Infinity
  const hi = Number.isFinite(to) ? to : Infinity
  return ageYears >= lo && ageYears <= hi
}

function rowLooksActive(row) {
  const a = row?.isActive ?? row?.IsActive
  if (a === false || a === 0 || a === "0" || String(a).toLowerCase() === "false") return false
  return true
}

/**
 * Pick best assignment row for a test given patient demographics.
 * Falls back to the first gender/age-compatible row, then first row for test id.
 * @returns {unknown | null}
 */
export function pickAssignmentRowForPatient(assignmentRows, labTestId, patient) {
  if (!assignmentRows?.length || !labTestId) return null
  const tid = String(labTestId)
  const candidates = assignmentRows.filter((row) => {
    if (!rowLooksActive(row)) return false
    const rowTid = field(row, "labTestId", "LabTestId")
    return rowTid != null && String(rowTid) === tid
  })
  if (candidates.length === 0) return null
  const age = getPatientAgeYearsApprox(patient)
  const pg = patient?.gender ?? patient?.Gender ?? ""
  const scored = candidates
    .map((row) => {
      const gm = genderBandMatches(row, pg)
      const am = ageBandMatches(row, age)
      const score = (gm ? 2 : 0) + (am ? 1 : 0)
      return { row, score, gm, am }
    })
    .sort((a, b) => b.score - a.score)
  return scored[0]?.row ?? candidates[0]
}

function parseRefBoundary(val) {
  if (val == null || val === "") return null
  const n = Number(String(val).trim().replace(",", "."))
  return Number.isFinite(n) ? n : null
}

/**
 * @returns {string[]} soft warning strings (may be empty)
 */
export function getLabNumericRangeSoftWarnings(controlProps, rawValue, assignmentRows, patient) {
  const props = controlProps || {}
  const labTestId = props.labTestId ?? props.LabTestId
  if (!labTestId || rawValue === null || rawValue === undefined || String(rawValue).trim() === "") {
    return []
  }
  if (!Array.isArray(assignmentRows) || assignmentRows.length === 0) return []

  const n = Number(String(rawValue).trim().replace(",", "."))
  if (!Number.isFinite(n)) return []

  const row = pickAssignmentRowForPatient(assignmentRows, String(labTestId), patient)
  if (!row) return []

  const low = parseRefBoundary(field(row, "referenceRangeLow", "ReferenceRangeLow"))
  const high = parseRefBoundary(field(row, "referenceRangeHigh", "ReferenceRangeHigh"))
  if (low == null && high == null) return []

  const unit = fieldStr(row, ["labUnitSymbol", "unitSymbol", "Unit"], "").trim()

  const rangeFmt =
    low != null && high != null ? `${low} – ${high}` : low != null ? `≥ ${low}` : `≤ ${high}`

  if (low != null && high != null) {
    if (n + 1e-9 < low) {
      return [
        `Value is below configured reference (${rangeFmt}${unit ? ` ${unit}` : ""}) for linked lab test.`,
      ]
    }
    if (n - 1e-9 > high) {
      return [
        `Value is above configured reference (${rangeFmt}${unit ? ` ${unit}` : ""}) for linked lab test.`,
      ]
    }
    return []
  }
  if (low != null && n + 1e-9 < low) {
    return [`Value is below configured reference (${rangeFmt}${unit ? ` ${unit}` : ""}).`]
  }
  if (high != null && n - 1e-9 > high) {
    return [`Value is above configured reference (${rangeFmt}${unit ? ` ${unit}` : ""}).`]
  }
  return []
}
