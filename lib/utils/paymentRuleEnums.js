/** Maps API enum names / ints for study payment rules (Phase 1). */

export const PAYMENT_TRIGGER_METRIC = {
  ENROLLMENT_STARTED: 1,
  ENROLLMENT_COMPLETED: 2,
  ENROLLMENT_PERCENTAGE: 3,
  SCREENING_COMPLETED: 4,
  BASELINE_COMPLETED: 5,
  SCREENING_AND_BASELINE_COMPLETED: 6,
  VISIT_COMPLETED: 7,
  STUDY_COMPLETE: 8,
  CUSTOM: 9,
  VISITS_COMBINED_COMPLETED: 10,
}

export const PAYMENT_TRIGGER_CATEGORY = {
  ENROLLMENT: 1,
  SCREENING: 2,
  BASELINE: 3,
  VISIT: 4,
  DOCUMENT: 5,
  STUDY_COMPLETE: 6,
  CUSTOM: 7,
}

export const PAYMENT_RULE_OPERATOR = {
  GREATER_THAN_OR_EQUAL: 1,
  EQUAL: 2,
  GREATER_THAN: 3,
  LESS_THAN_OR_EQUAL: 4,
}

export const PAYMENT_TARGET_TYPE = {
  COUNT: 1,
  PERCENTAGE: 2,
  BOOLEAN: 3,
  CUSTOM: 4,
}

export const PAYMENT_MODEL = {
  LUMP_SUM: 1,
  SITE_AGGREGATE: 2,
  PER_PATIENT: 3,
}

export const PAYMENT_COMPLETION_LEVEL = {
  SUBMITTED: 1,
  SDV_VERIFIED: 2,
  PI_SIGNED: 3,
  QUERIES_CLOSED: 4,
}

export const PAYMENT_DENOMINATOR_SOURCE = {
  PLANNED_PATIENTS: 1,
  ENROLLED: 2,
  ACTIVE_ELIGIBLE: 3,
}

export const STUDY_TYPE = {
  NORMAL: 1,
  MILESTONE: 2,
  VISIT: 3,
}

const ENUM_NAME_TO_VALUE = {
  GreaterThanOrEqual: 1,
  Equal: 2,
  GreaterThan: 3,
  LessThanOrEqual: 4,
  Count: 1,
  Percentage: 2,
  Boolean: 3,
  Custom: 4,
  Enrollment: 1,
  Screening: 2,
  Baseline: 3,
  Visit: 4,
  Document: 5,
  StudyComplete: 6,
  LumpSum: 1,
  SiteAggregate: 2,
  PerPatient: 3,
  Submitted: 1,
  SdvVerified: 2,
  PiSigned: 3,
  QueriesClosed: 4,
  PlannedPatients: 1,
  Enrolled: 2,
  ActiveEligible: 3,
}

export function enumNameToValue(name) {
  if (name == null || name === "") return null
  if (typeof name === "number" && Number.isFinite(name)) return name
  const key = String(name).trim()
  if (ENUM_NAME_TO_VALUE[key] != null) return ENUM_NAME_TO_VALUE[key]
  const num = Number.parseInt(key, 10)
  return Number.isFinite(num) ? num : null
}

export function formatEnumLabel(name) {
  if (name == null || name === "") return "—"
  return String(name)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
}

export function operatorLabel(value) {
  const map = {
    1: ">=",
    2: "=",
    3: ">",
    4: "<=",
  }
  return map[Number(value)] ?? formatEnumLabel(value)
}

export function targetTypeLabel(value) {
  const map = {
    1: "Count",
    2: "Percentage",
    3: "Boolean",
    4: "Custom",
  }
  return map[Number(value)] ?? formatEnumLabel(value)
}

export function paymentModelLabel(value) {
  const map = {
    1: "Lump sum",
    2: "Site aggregate",
    3: "Per patient",
  }
  return map[Number(value)] ?? formatEnumLabel(value)
}

export function completionLevelLabel(value) {
  const map = {
    1: "CRF submitted",
    2: "SDV verified",
    3: "PI signed",
    4: "Queries closed",
  }
  return map[Number(value)] ?? formatEnumLabel(value)
}

/** Build select options from API catalog completion level names. */
export function completionLevelOptionsFromCatalog(catalog) {
  const names = catalog?.completionLevels ?? []
  if (!Array.isArray(names) || names.length === 0) {
    return Object.entries({
      1: "CRF submitted",
      2: "SDV verified",
      3: "PI signed",
      4: "Queries closed",
    }).map(([value, label]) => ({ value, label }))
  }
  return names
    .map((name) => {
      const value = enumNameToValue(name)
      if (value == null) return null
      return { value: String(value), label: completionLevelLabel(value) }
    })
    .filter(Boolean)
}

export function studyTypeLabel(value) {
  const map = {
    1: "Normal",
    2: "Milestone",
    3: "Visit",
  }
  return map[Number(value)] ?? "Study"
}
