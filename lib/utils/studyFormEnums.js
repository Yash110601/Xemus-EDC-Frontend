/**
 * Study form ↔ API enum mapping (matches Pr.Edc.Domain.Enums).
 * Single source of truth for Study Configuration create/update payloads.
 */

export const STUDY_OPTIONAL_TEXT_API_FIELDS = new Set(["NameOfDrug", "Sponsor", "Comments"])

const STUDY_TYPE_MAP = {
  Normal: 1,
  "Milestone(Patient wise)": 2,
  "Milestone(visit wise)": 3,
  Milestone: 2,
  Baseline: 3,
  Visit: 3,
}

const STUDY_DESIGN_MAP = {
  Randomized: 1,
  "Non-Randomized": 2,
  NonRandomized: 2,
  "Open Label": 3,
  OpenLabel: 3,
  "Double Blind": 4,
  DoubleBlind: 4,
  "Single Blind": 5,
  SingleBlind: 5,
}

const STUDY_PHASE_MAP = {
  Phase0: 0,
  PhaseI: 1,
  PhaseII: 2,
  PhaseIII: 3,
  PhaseIV: 4,
  PostMarketing: 5,
  PhaseIIIA: 6,
  PhaseIIIB: 7,
}

const STUDY_CRF_TYPE_MAP = {
  PMS: 0,
  "Clinical Trial": 1,
  ClinicalTrial: 1,
  Observational: 2,
  RWE: 3,
  "Investigator Initiated Study": 4,
  InvestigatorInitiatedStudy: 4,
}

function mapByName(value, mapping) {
  const trimmed = String(value).trim()
  if (mapping[trimmed] !== undefined) return mapping[trimmed]
  const lower = trimmed.toLowerCase()
  for (const [key, val] of Object.entries(mapping)) {
    if (key.toLowerCase() === lower) return val
  }
  return null
}

export function getStudyRowValue(obj, ...keys) {
  for (const key of keys) {
    if (obj?.[key] !== undefined && obj?.[key] !== null) {
      return obj[key]
    }
  }
  return null
}

export function getStudyTypeValue(studyType) {
  if (studyType === undefined || studyType === null || studyType === "") return null
  if (!Number.isNaN(Number(studyType))) {
    const num = Number(studyType)
    return num >= 1 && num <= 3 ? num : null
  }
  return mapByName(studyType, STUDY_TYPE_MAP)
}

export function getStudyDesignValue(studyDesign) {
  if (studyDesign === undefined || studyDesign === null || studyDesign === "") return null
  if (!Number.isNaN(Number(studyDesign))) {
    const num = Number(studyDesign)
    return num >= 1 && num <= 5 ? num : null
  }
  return mapByName(studyDesign, STUDY_DESIGN_MAP)
}

export function getStudyPhaseValue(studyPhase) {
  if (studyPhase === undefined || studyPhase === null || studyPhase === "") return null
  if (!Number.isNaN(Number(studyPhase))) {
    const num = Number(studyPhase)
    return num >= 0 && num <= 7 ? num : null
  }
  return STUDY_PHASE_MAP[studyPhase] ?? mapByName(studyPhase, STUDY_PHASE_MAP)
}

export function getStudyCRFTypeValue(studyCRFType) {
  if (studyCRFType === undefined || studyCRFType === null || studyCRFType === "") return null
  if (!Number.isNaN(Number(studyCRFType))) {
    const num = Number(studyCRFType)
    return num >= 0 && num <= 4 ? num : null
  }
  return STUDY_CRF_TYPE_MAP[studyCRFType] ?? mapByName(studyCRFType, STUDY_CRF_TYPE_MAP)
}

export function getStudyCRFTypeLabel(value) {
  if (value === undefined || value === null || value === "") return ""
  const num = typeof value === "number" ? value : Number.isNaN(Number(value)) ? -1 : Number(value)
  const labels = {
    0: "PMS",
    1: "Clinical Trial",
    2: "Observational",
    3: "RWE",
    4: "Investigator Initiated Study",
  }
  if (num >= 0 && num <= 4) return labels[num]
  const nameLabels = {
    PMS: "PMS",
    ClinicalTrial: "Clinical Trial",
    Observational: "Observational",
    RWE: "RWE",
    InvestigatorInitiatedStudy: "Investigator Initiated Study",
  }
  if (typeof value === "string" && nameLabels[value]) return nameLabels[value]
  if (typeof value === "string") return value
  return ""
}

export function convertStudyCRFTypeToFormValue(value) {
  if (value === undefined || value === null || value === "") return ""
  if (typeof value === "number" && value >= 0 && value <= 4) return String(value)
  if (!Number.isNaN(value) && value !== "") {
    const num = Number(value)
    if (num >= 0 && num <= 4) return String(num)
  }
  const nameToValue = {
    PMS: "0",
    "Clinical Trial": "1",
    ClinicalTrial: "1",
    Observational: "2",
    RWE: "3",
    "Investigator Initiated Study": "4",
    InvestigatorInitiatedStudy: "4",
  }
  return nameToValue[value] ?? ""
}

function isValidEnumNumeric(type, num) {
  if (Number.isNaN(num)) return false
  if (type === "studyPhase") return num >= 0 && num <= 7
  if (type === "studyDesign") return num >= 1 && num <= 5
  if (type === "studyType") return num >= 1 && num <= 3
  return false
}

/** API value (number or name) → select option value string for edit/create forms. */
export function studyEnumApiValueToFormSelect(value, type = "studyType") {
  if (value === null || value === undefined || value === "") return ""

  if (typeof value === "number") {
    return isValidEnumNumeric(type, value) ? String(value) : ""
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim()
    if (!Number.isNaN(Number(trimmedValue)) && trimmedValue !== "") {
      const num = parseInt(trimmedValue, 10)
      if (isValidEnumNumeric(type, num)) return trimmedValue
    }

    if (type === "studyType") {
      const mapped = mapByName(trimmedValue, {
        Normal: "1",
        "Milestone(Patient wise)": "2",
        "Milestone(visit wise)": "3",
        Milestone: "2",
        Visit: "3",
        Baseline: "3",
      })
      return mapped != null ? String(mapped) : ""
    }
    if (type === "studyDesign") {
      const mapped = mapByName(trimmedValue, {
        Randomized: "1",
        "Non-Randomized": "2",
        NonRandomized: "2",
        "Open Label": "3",
        OpenLabel: "3",
        "Double Blind": "4",
        DoubleBlind: "4",
        "Single Blind": "5",
        SingleBlind: "5",
      })
      return mapped != null ? String(mapped) : ""
    }
    if (type === "studyPhase") {
      const mapped = mapByName(trimmedValue, {
        Phase0: "0",
        "Phase 0": "0",
        PhaseI: "1",
        "Phase I": "1",
        PhaseII: "2",
        "Phase II": "2",
        PhaseIII: "3",
        "Phase III": "3",
        PhaseIIIA: "6",
        "Phase IIIA": "6",
        PhaseIIIB: "7",
        "Phase IIIB": "7",
        PhaseIV: "4",
        "Phase IV": "4",
        PostMarketing: "5",
        "Post-Marketing": "5",
        "Post Marketing": "5",
      })
      return mapped != null ? String(mapped) : ""
    }
  }

  return ""
}

/** Prefer numeric enum from API; fall back to enum member or display name. */
export function resolveStudyEnumFromApi(study, type) {
  const configs = {
    studyType: {
      numericKeys: ["studyType", "StudyType", "studyTypeId"],
      nameKeys: ["studyTypeName", "StudyTypeName"],
    },
    studyDesign: {
      numericKeys: ["studyDesign", "StudyDesign", "studyDesignId"],
      nameKeys: ["studyDesignName", "StudyDesignName"],
    },
    studyPhase: {
      numericKeys: ["studyPhase", "StudyPhase", "studyPhaseId"],
      nameKeys: ["studyPhaseName", "StudyPhaseName"],
    },
  }

  const config = configs[type]
  if (!config) return null

  const raw = getStudyRowValue(study, ...config.numericKeys)
  const displayName = getStudyRowValue(study, ...config.nameKeys)

  if (raw !== null && raw !== undefined && raw !== "") {
    const num = Number(raw)
    if (!Number.isNaN(num) && isValidEnumNumeric(type, num)) {
      return raw
    }
    if (studyEnumApiValueToFormSelect(raw, type)) {
      return raw
    }
  }

  if (displayName !== null && displayName !== undefined && displayName !== "") {
    if (studyEnumApiValueToFormSelect(displayName, type)) {
      return displayName
    }
  }

  return raw ?? displayName
}

export function validateStudyEnumPayload(payload) {
  const missingStudyType = payload.StudyType === undefined || payload.StudyType === null
  const missingStudyDesign = payload.StudyDesign === undefined || payload.StudyDesign === null
  const missingStudyPhase = payload.StudyPhase === undefined || payload.StudyPhase === null
  const missingStudyCrfType = payload.StudyCRFType === undefined || payload.StudyCRFType === null

  if (missingStudyType || missingStudyDesign || missingStudyPhase || missingStudyCrfType) {
    return "Please select valid Study Type, Study Design, Study Phase, and Study CRF Type."
  }
  return null
}
