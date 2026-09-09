/**
 * Central visit-type registry — keep aligned with backend VisitType / CrfFormType enum.
 * Use for visit configuration, CRF designer mapping, and manual data entry visibility/sort.
 */

export const VISIT_TYPE = Object.freeze({
  SCREENING: 1,
  BASELINE: 2,
  VISITS: 3,
  UNSCHEDULED_VISIT: 4,
  ADVERSE_EVENT: 5,
  CONCOMITANT_MEDICATION: 6,
  PATIENT_FEEDBACK_FORM: 7,
  STUDY_COMPLETION_FORM: 8,
})

/** @type {{ enum: number, label: string, slug: string, hideInDataEntryWhenNoMappedCrf?: boolean, manualEntrySortBand?: number }[]} */
export const VISIT_TYPE_DEFINITIONS = [
  { enum: VISIT_TYPE.SCREENING, label: "Screening", slug: "screening", manualEntrySortBand: 0 },
  { enum: VISIT_TYPE.BASELINE, label: "Baseline", slug: "baseline", manualEntrySortBand: 0 },
  { enum: VISIT_TYPE.VISITS, label: "Visits", slug: "visits", manualEntrySortBand: 0 },
  { enum: VISIT_TYPE.UNSCHEDULED_VISIT, label: "Unscheduled Visit", slug: "unscheduledvisit", manualEntrySortBand: 0 },
  { enum: VISIT_TYPE.ADVERSE_EVENT, label: "Adverse Event", slug: "adverseevent", manualEntrySortBand: 0 },
  {
    enum: VISIT_TYPE.CONCOMITANT_MEDICATION,
    label: "Concomitant Medication",
    slug: "concomitantmedication",
    manualEntrySortBand: 2,
  },
  {
    enum: VISIT_TYPE.PATIENT_FEEDBACK_FORM,
    label: "Patient Feedback Form",
    slug: "patientfeedbackform",
    hideInDataEntryWhenNoMappedCrf: true,
    manualEntrySortBand: 1,
  },
  {
    enum: VISIT_TYPE.STUDY_COMPLETION_FORM,
    label: "Study Completion Form",
    slug: "studycompletionform",
    hideInDataEntryWhenNoMappedCrf: true,
    manualEntrySortBand: 1,
  },
]

const MAX_VISIT_TYPE_ENUM = Math.max(...VISIT_TYPE_DEFINITIONS.map((d) => d.enum))

/** Labels shown in CRF Designer / visit configuration dropdowns (standard order). */
export const CRF_DESIGNER_VISIT_OPTIONS = VISIT_TYPE_DEFINITIONS.map((d) => d.label)

const LABEL_TO_ENUM = Object.fromEntries(VISIT_TYPE_DEFINITIONS.map((d) => [d.label, d.enum]))
const ENUM_TO_LABEL = Object.fromEntries(VISIT_TYPE_DEFINITIONS.map((d) => [d.enum, d.label]))
const SLUG_TO_ENUM = Object.fromEntries(VISIT_TYPE_DEFINITIONS.map((d) => [d.slug, d.enum]))

export function normalizeVisitTypeToken(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "")
}

/**
 * @param {string|number|null|undefined} visitType
 * @returns {number|null}
 */
export function mapVisitTypeLabelToEnum(visitType) {
  if (visitType == null || visitType === "") return null

  if (typeof visitType === "number") return visitType

  const parsed = parseInt(visitType, 10)
  if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= MAX_VISIT_TYPE_ENUM) return parsed

  if (typeof visitType === "string" && LABEL_TO_ENUM[visitType]) {
    return LABEL_TO_ENUM[visitType]
  }

  const normalized = normalizeVisitTypeToken(visitType)
  if (SLUG_TO_ENUM[normalized] != null) return SLUG_TO_ENUM[normalized]
  if (normalized === "visit") return VISIT_TYPE.VISITS
  if (normalized.includes("adverse") && normalized.includes("event")) return VISIT_TYPE.ADVERSE_EVENT

  return null
}

/**
 * @param {number|string|null|undefined} enumVal
 * @returns {string|null}
 */
export function mapVisitTypeEnumToLabel(enumVal) {
  if (enumVal == null || enumVal === "") return null
  const num = typeof enumVal === "number" ? enumVal : parseInt(enumVal, 10)
  if (!Number.isNaN(num) && ENUM_TO_LABEL[num]) return ENUM_TO_LABEL[num]
  return null
}

/**
 * @param {{ visitType?: unknown, crfFormType?: unknown, name?: unknown }|null|undefined} visit
 * @param {number} enumVal
 */
export function visitMatchesTypeEnum(visit, enumVal) {
  const n = Number(visit?.visitType ?? visit?.crfFormType)
  if (Number.isFinite(n) && n === enumVal) return true

  const def = VISIT_TYPE_DEFINITIONS.find((d) => d.enum === enumVal)
  if (!def) return false

  const tokens = [visit?.visitType, visit?.crfFormType, visit?.name]
    .map(normalizeVisitTypeToken)
    .filter(Boolean)

  if (tokens.length === 0) return false
  return tokens.some((t) => t === String(enumVal) || t.includes(def.slug))
}

/** True when the study visit has at least one CRF design mapped (array or legacy single id). */
export function visitHasMappedCrfs(visit) {
  if (!visit) return false
  const designs = Array.isArray(visit.crfDesigns) ? visit.crfDesigns : []
  if (designs.length > 0) return true
  const id = visit.crfDesignId ?? visit.crfDesignID
  if (id == null || id === "") return false
  const n = Number(id)
  return Number.isFinite(n) && n > 0
}

/**
 * Manual data entry: hide visit types that require CRF mapping when none exist (AC #2).
 * @param {{ visitType?: unknown, crfFormType?: unknown, name?: unknown, crfDesigns?: unknown[], crfDesignId?: unknown }|null|undefined} visit
 */
export function shouldShowVisitInManualDataEntry(visit) {
  if (!visit) return false
  const gated = VISIT_TYPE_DEFINITIONS.filter((d) => d.hideInDataEntryWhenNoMappedCrf)
  for (const def of gated) {
    if (visitMatchesTypeEnum(visit, def.enum) && !visitHasMappedCrfs(visit)) {
      return false
    }
  }
  return true
}

/**
 * Sort bands for patient visit list (repeatable groups always last).
 * @param {{ isRepeatableGroup?: boolean, visitType?: unknown, crfFormType?: unknown, name?: unknown }|null|undefined} visit
 */
export function getManualDataEntryVisitSortBand(visit) {
  if (visit?.isRepeatableGroup) return 3

  for (const def of VISIT_TYPE_DEFINITIONS) {
    if (def.manualEntrySortBand != null && visitMatchesTypeEnum(visit, def.enum)) {
      return def.manualEntrySortBand
    }
  }
  return 0
}

/**
 * Manual data entry / matrix: preserve visit-configuration creation order.
 * Primary key is visitScheduleId (monotonic per study); fallback is API list index.
 */
export function compareVisitsForManualDataEntry(a, b) {
  const aRepeatable = Boolean(a?.isRepeatableGroup)
  const bRepeatable = Boolean(b?.isRepeatableGroup)
  if (aRepeatable !== bRepeatable) return aRepeatable ? 1 : -1

  const scheduleA = Number(a?.visitScheduleId ?? a?.id ?? 0)
  const scheduleB = Number(b?.visitScheduleId ?? b?.id ?? 0)
  if (scheduleA > 0 && scheduleB > 0 && scheduleA !== scheduleB) {
    return scheduleA - scheduleB
  }

  const listA = Number(a?.configListOrder)
  const listB = Number(b?.configListOrder)
  if (Number.isFinite(listA) && Number.isFinite(listB) && listA !== listB) {
    return listA - listB
  }

  const visitNoA = a?.visitNo ?? a?.order
  const visitNoB = b?.visitNo ?? b?.order
  if (visitNoA != null && visitNoB != null && visitNoA !== visitNoB) {
    return Number(visitNoA) - Number(visitNoB)
  }

  return String(a?.name ?? "").localeCompare(String(b?.name ?? ""), undefined, { sensitivity: "base" })
}

export function sortVisitsForManualDataEntry(visits = []) {
  return [...visits].sort(compareVisitsForManualDataEntry)
}

/**
 * @param {string} labelOrSlug
 * @returns {number}
 */
export function mapCrfDesignerVisitToEnum(labelOrSlug) {
  return mapVisitTypeLabelToEnum(labelOrSlug) ?? VISIT_TYPE.SCREENING
}

/** Resolve API crfFormType (number or string) to CRF Designer visit dropdown label. */
export function crfFormTypeToDesignerVisitLabel(crfFormType) {
  const fromEnum = mapVisitTypeEnumToLabel(crfFormType)
  if (fromEnum) return fromEnum
  if (typeof crfFormType === "string" && crfFormType.trim()) return crfFormType.trim()
  return mapVisitTypeEnumToLabel(VISIT_TYPE.SCREENING) || "Screening"
}

/** Display label for CRF list / PDF headers (unknown types keep fallback). */
export function getCrfFormTypeDisplayLabel(crfFormType, fallback = "Unknown") {
  const fromEnum = mapVisitTypeEnumToLabel(crfFormType)
  if (fromEnum) return fromEnum
  const fromSlug = mapVisitTypeEnumToLabel(mapVisitTypeLabelToEnum(crfFormType))
  if (fromSlug) return fromSlug
  if (typeof crfFormType === "string" && crfFormType.trim()) return crfFormType.trim()
  return fallback
}
