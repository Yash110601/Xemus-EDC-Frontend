/**
 * Study Completion Form (visit / crfFormType = 8) — designer-only rules.
 * Isolated from standard CRF designer flows; do not import from data-entry except read helpers.
 */

import { PATIENT_STATUS_CODES } from "@/lib/services/patientEnrolment.service"
import { mapCrfDesignerVisitToEnum, VISIT_TYPE } from "@/lib/visitTypes"
import {
  normalizeCrfSection,
  SECTION_TYPE_STUDY_COMPLETION_STATUS,
  SECTION_TYPE_STUDY_COMPLETION_STATUS_TOKEN,
} from "@/lib/utils/crfLabSection"

/** Single parent section label in eCRF data entry (status blocks are sub-sections). */
export const STUDY_COMPLETION_DATA_ENTRY_PARENT_NAME = "Study Completion"

/** Terminal patient statuses allowed as Study Completion sub-blocks (matches PATIENT_STATUS_CODES). */
export const STUDY_COMPLETION_STATUS_OPTIONS = Object.freeze([
  {
    code: PATIENT_STATUS_CODES.DISCONTINUED,
    key: "DISCONTINUED",
    label: "Discontinued",
  },
  {
    code: PATIENT_STATUS_CODES.WITHDRAWN,
    key: "WITHDRAWN",
    label: "Withdrawn",
  },
  {
    code: PATIENT_STATUS_CODES.LOST_TO_FOLLOW_UP,
    key: "LOST_TO_FOLLOW_UP",
    label: "Lost to Follow-Up",
  },
  {
    code: PATIENT_STATUS_CODES.DEATH,
    key: "DEATH",
    label: "Death",
  },
])

const STATUS_LABEL_BY_CODE = Object.fromEntries(
  STUDY_COMPLETION_STATUS_OPTIONS.map((o) => [o.code, o.label]),
)

/**
 * @param {string|number|null|undefined} visitNameOrEnum
 */
export function isStudyCompletionFormVisit(visitNameOrEnum) {
  return mapCrfDesignerVisitToEnum(visitNameOrEnum) === VISIT_TYPE.STUDY_COMPLETION_FORM
}

/**
 * True when every section is a Study Completion status sub-block (not separate top-level sections).
 * @param {unknown[]} sections normalized sections
 */
export function isStudyCompletionFormSectionList(sections) {
  const list = Array.isArray(sections) ? sections : []
  if (list.length === 0) return false
  return list.every(isStudyCompletionStatusSection)
}

/**
 * @param {unknown[]} sections
 */
export function sortStudyCompletionStatusSections(sections) {
  const orderMap = new Map(STUDY_COMPLETION_STATUS_OPTIONS.map((o, i) => [o.code, i]))
  return [...(Array.isArray(sections) ? sections : [])].sort((a, b) => {
    const ca = getStudyCompletionStatusCode(a) ?? 99
    const cb = getStudyCompletionStatusCode(b) ?? 99
    return (orderMap.get(ca) ?? 99) - (orderMap.get(cb) ?? 99)
  })
}

/**
 * Data entry: keep all status sub-sections (even empty). Other visits: only sections with fields.
 * @param {unknown[]} displaySections raw sections from CRF design
 */
export function resolveSectionsForDataEntry(displaySections) {
  const normalized = (displaySections || []).map((s) => normalizeCrfSection(s))
  if (isStudyCompletionFormSectionList(normalized)) {
    return sortStudyCompletionStatusSections(normalized.filter(isStudyCompletionStatusSection))
  }
  return normalized.filter((s) => Array.isArray(s?.controls) && s.controls.length > 0)
}

/**
 * @param {unknown} section
 */
export function isStudyCompletionStatusSection(section) {
  if (!section || typeof section !== "object") return false
  const raw =
    section.sectionType ??
    section.SectionType ??
    section["section-type"]
  return (
    String(raw ?? "")
      .trim()
      .toLowerCase() === SECTION_TYPE_STUDY_COMPLETION_STATUS_TOKEN
  )
}

/**
 * @param {unknown} section
 * @returns {number|null}
 */
export function getStudyCompletionStatusCode(section) {
  if (!isStudyCompletionStatusSection(section)) return null
  const binding = section.studyCompletionStatus ?? section.StudyCompletionStatus ?? {}
  const n = Number(binding.statusCode ?? binding.StatusCode)
  return Number.isFinite(n) ? n : null
}

/**
 * @param {unknown[]} sections
 * @returns {number[]}
 */
export function getUsedStudyCompletionStatusCodes(sections) {
  if (!Array.isArray(sections)) return []
  return sections
    .map(getStudyCompletionStatusCode)
    .filter((c) => c != null)
}

/**
 * @param {unknown[]} sections
 */
export function getAvailableStudyCompletionStatusOptions(sections) {
  const used = new Set(getUsedStudyCompletionStatusCodes(sections))
  return STUDY_COMPLETION_STATUS_OPTIONS.filter((o) => !used.has(o.code))
}

/**
 * @param {unknown[]} sections
 * @param {number} statusCode
 */
/**
 * All flat form keys for Study Completion status blocks (includes dynamic table cell keys).
 * @param {unknown[]} sections
 * @param {Record<string, unknown>} [formSlice]
 * @returns {Set<string>}
 */
export function collectStudyCompletionFormFieldKeys(sections, formSlice = {}) {
  const keys = new Set()
  for (const sec of Array.isArray(sections) ? sections : []) {
    if (!isStudyCompletionStatusSection(sec)) continue
    for (const c of sec.controls || []) {
      const id = String(c?.id ?? "").trim()
      if (!id) continue
      keys.add(id)
      if (String(c?.type || "").toLowerCase() === "table") {
        const prefix = `${id}_row_`
        Object.keys(formSlice || {}).forEach((k) => {
          if (String(k).startsWith(prefix)) keys.add(k)
        })
      }
    }
  }
  return keys
}

export function findStudyCompletionSectionByStatusCode(sections, statusCode) {
  const code = Number(statusCode)
  if (!Number.isFinite(code)) return null
  return (Array.isArray(sections) ? sections : []).find(
    (s) => isStudyCompletionStatusSection(s) && getStudyCompletionStatusCode(s) === code,
  )
}

/**
 * @param {number} statusCode
 */
export function getStudyCompletionStatusLabel(statusCode) {
  return STATUS_LABEL_BY_CODE[Number(statusCode)] || "Status"
}

function hasStudyCompletionSavedFieldValue(value) {
  if (value == null) return false
  if (typeof value === "boolean") return true
  if (Array.isArray(value)) return value.length > 0
  return String(value).trim() !== ""
}

/**
 * Re-open submitted/saved form: restore Yes/No from patient status.
 * @param {Record<string, unknown>|null|undefined} patient
 * @returns {{ completedStudy: boolean, terminalStatusCode: number|null }|null}
 */
export function deriveStudyCompletionGateFromPatient(patient) {
  const code = Number(
    patient?.currentStatusCode ??
      patient?.patientStatusCode ??
      patient?.CurrentStatusCode ??
      patient?.PatientStatusCode,
  )
  if (!Number.isFinite(code)) return null
  if (code === PATIENT_STATUS_CODES.COMPLETED) {
    return { completedStudy: true, terminalStatusCode: null }
  }
  if (STUDY_COMPLETION_STATUS_OPTIONS.some((o) => o.code === code)) {
    return { completedStudy: false, terminalStatusCode: code }
  }
  return null
}

/**
 * Fallback when patient status is not terminal yet: pick status block with saved field data.
 * @param {unknown[]} sections
 * @param {Record<string, unknown>} formSlice
 * @returns {{ completedStudy: boolean, terminalStatusCode: number|null }|null}
 */
export function deriveStudyCompletionGateFromFormData(sections, formSlice = {}) {
  let bestCode = null
  let bestCount = 0
  for (const sec of Array.isArray(sections) ? sections : []) {
    if (!isStudyCompletionStatusSection(sec)) continue
    const code = getStudyCompletionStatusCode(sec)
    if (code == null) continue
    const keys = collectStudyCompletionFormFieldKeys([sec], formSlice)
    let count = 0
    keys.forEach((k) => {
      if (hasStudyCompletionSavedFieldValue(formSlice[k])) count += 1
    })
    if (count > bestCount) {
      bestCount = count
      bestCode = code
    }
  }
  if (bestCode == null || bestCount === 0) return null
  return { completedStudy: false, terminalStatusCode: bestCode }
}

/**
 * @param {Record<string, unknown>|null|undefined} patient
 * @param {unknown[]} sections
 * @param {Record<string, unknown>} [formSlice]
 */
export function resolveStudyCompletionGateForReopen(patient, sections, formSlice = {}) {
  return (
    deriveStudyCompletionGateFromPatient(patient) ||
    deriveStudyCompletionGateFromFormData(sections, formSlice) || {
      completedStudy: null,
      terminalStatusCode: null,
    }
  )
}

/**
 * Resolve patient status + controls to validate on submit (data entry gateway).
 * @param {unknown[]} sections normalized study-completion sections
 * @param {{ completedStudy: boolean|null, terminalStatusCode: number|null }} gate
 * @returns {{ gateError?: string, statusCode?: number, controls: unknown[] }}
 */
export function resolveStudyCompletionSubmitFromGate(sections, gate) {
  const completedStudy = gate?.completedStudy
  if (completedStudy !== true && completedStudy !== false) {
    return { gateError: "Please answer: Did patient complete study?", controls: [] }
  }
  if (completedStudy === true) {
    return {
      statusCode: PATIENT_STATUS_CODES.COMPLETED,
      controls: [],
    }
  }
  const code = Number(gate?.terminalStatusCode)
  if (!Number.isFinite(code)) {
    return { gateError: "Please select a patient status.", controls: [] }
  }
  const block = findStudyCompletionSectionByStatusCode(sections, code)
  if (!block) {
    return {
      gateError: `${getStudyCompletionStatusLabel(code)} is not configured in this form design.`,
      controls: [],
    }
  }
  return {
    statusCode: code,
    controls: Array.isArray(block.controls) ? block.controls : [],
  }
}

/**
 * @param {{ statusCode: number, id?: string, controls?: unknown[] }} params
 */
export function createStudyCompletionStatusSection({ statusCode, id, controls = [] }) {
  const code = Number(statusCode)
  const opt = STUDY_COMPLETION_STATUS_OPTIONS.find((o) => o.code === code)
  const label = opt?.label ?? getStudyCompletionStatusLabel(code)
  return {
    id: id || `section_sc_${code}_${Date.now()}`,
    name: label,
    controls: Array.isArray(controls) ? controls : [],
    sectionType: SECTION_TYPE_STUDY_COMPLETION_STATUS,
    studyCompletionStatus: {
      statusCode: code,
      statusKey: opt?.key ?? "",
      statusLabel: label,
    },
  }
}

/**
 * @param {unknown[]} sections
 * @returns {{ ok: boolean, message?: string }}
 */
export function validateStudyCompletionDesignerSections(sections) {
  const list = Array.isArray(sections) ? sections : []
  if (list.length === 0) {
    return { ok: false, message: "Add at least one patient status block before saving." }
  }
  const codes = []
  for (const sec of list) {
    if (!isStudyCompletionStatusSection(sec)) {
      return {
        ok: false,
        message: "Study Completion Form CRFs can only contain status blocks (Discontinued, Withdrawn, Lost to follow-up, Death).",
      }
    }
    const code = getStudyCompletionStatusCode(sec)
    if (code == null || !STATUS_LABEL_BY_CODE[code]) {
      return { ok: false, message: "Each status block must have a valid patient status." }
    }
    if (codes.includes(code)) {
      return {
        ok: false,
        message: `Duplicate status block: ${getStudyCompletionStatusLabel(code)}. Only one section per status is allowed.`,
      }
    }
    codes.push(code)
  }
  return { ok: true }
}

/**
 * @param {boolean} studyCompletionMode
 * @param {unknown[]} sections
 * @param {string|null|undefined} activeSectionId
 */
export function canAddControlsInStudyCompletionDesigner(studyCompletionMode, sections, activeSectionId) {
  if (!studyCompletionMode) return true
  if (!activeSectionId) return false
  const active = (sections || []).find((s) => s?.id === activeSectionId)
  return isStudyCompletionStatusSection(active)
}

/**
 * Serialize section for API / HTML (additive fields only).
 * @param {Record<string, unknown>} section normalized section
 */
export function serializeStudyCompletionSectionForPayload(section) {
  const code = getStudyCompletionStatusCode(section)
  const binding = section.studyCompletionStatus || {}
  return {
    id: section.id,
    name: section.name,
    sectionType: SECTION_TYPE_STUDY_COMPLETION_STATUS,
    studyCompletionStatus: {
      statusCode: code,
      statusKey: binding.statusKey ?? "",
      statusLabel: binding.statusLabel ?? getStudyCompletionStatusLabel(code),
    },
    controls: section.controls,
  }
}
