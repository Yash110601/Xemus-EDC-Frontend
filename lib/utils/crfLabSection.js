/**
 * CRF section typing for laboratory blocks (designer ↔ API ↔ HTML ↔ data entry).
 * Additive-only: omitting lab fields means a normal section — full backward compatibility.
 */

export const SECTION_TYPE_STANDARD = "standard"
export const SECTION_TYPE_LAB = "lab"
/** Study Completion Form — status sub-blocks inside one section (designer + data entry). */
export const SECTION_TYPE_STUDY_COMPLETION_STATUS = "studyCompletionStatus"
/** Lowercase token for comparisons (must match normalizeCrfSection typeToken). */
export const SECTION_TYPE_STUDY_COMPLETION_STATUS_TOKEN = "studycompletionstatus"

const EMPTY_CONTROLS = []

/**
 * Normalize a raw section from API, HTML hydrate, or local state into a canonical shape.
 * @param {Record<string, unknown> | null | undefined} section
 * @returns {{ id: string, name: string, controls: unknown[], sectionType?: string, labBinding?: { labFacilityId: string | null, labFacilityLabel: string } }}
 */
export function normalizeCrfSection(section) {
  if (!section || typeof section !== "object") {
    return {
      id: "section_unknown",
      name: "Section",
      controls: EMPTY_CONTROLS,
      sectionType: SECTION_TYPE_STANDARD,
    }
  }

  const id = section.id != null ? String(section.id) : `section_${Date.now()}`
  const name =
    typeof section.name === "string" && section.name.trim()
      ? section.name.trim()
      : "Untitled Section"
  const controls = Array.isArray(section.controls) ? section.controls : EMPTY_CONTROLS

  const rawType = section.sectionType ?? section.SectionType ?? section["section-type"]
  const typeToken = String(rawType ?? "")
    .trim()
    .toLowerCase()
  const isLab = typeToken === SECTION_TYPE_LAB
  const isStudyCompletionStatus = typeToken === SECTION_TYPE_STUDY_COMPLETION_STATUS_TOKEN

  if (isStudyCompletionStatus) {
    const sc = section.studyCompletionStatus ?? section.StudyCompletionStatus ?? {}
    const statusCodeRaw = sc.statusCode ?? sc.StatusCode
    const statusCode = Number.parseInt(String(statusCodeRaw ?? ""), 10)
    const statusLabel = String(sc.statusLabel ?? sc.StatusLabel ?? "").trim()
    const statusKey = String(sc.statusKey ?? sc.StatusKey ?? "").trim()
    const {
      sectionType: _stSc,
      SectionType: _StSc,
      studyCompletionStatus: _scOld,
      StudyCompletionStatus: _ScOld,
      ...restSc
    } = section
    const resolvedLabel = statusLabel || "Status"
    return {
      ...restSc,
      id,
      name: typeof section.name === "string" && section.name.trim() ? section.name.trim() : resolvedLabel,
      controls,
      sectionType: SECTION_TYPE_STUDY_COMPLETION_STATUS,
      studyCompletionStatus: {
        statusCode: Number.isFinite(statusCode) ? statusCode : null,
        statusKey,
        statusLabel: statusLabel || resolvedLabel,
      },
    }
  }

  if (!isLab) {
    const {
      sectionType: _st,
      SectionType: _St,
      labBinding: _lb,
      LabBinding: _Lb,
      ...rest
    } = section
    return {
      ...rest,
      id,
      name,
      controls,
      sectionType: SECTION_TYPE_STANDARD,
    }
  }

  const lb = section.labBinding ?? section.LabBinding ?? {}
  const labFacilityIdRaw = lb.labFacilityId ?? lb.LabFacilityId ?? null
  const labFacilityId =
    labFacilityIdRaw !== null && labFacilityIdRaw !== undefined && String(labFacilityIdRaw).trim() !== ""
      ? String(labFacilityIdRaw)
      : null
  const labFacilityLabelRaw = lb.labFacilityLabel ?? lb.LabFacilityLabel ?? ""
  const labFacilityLabel =
    typeof labFacilityLabelRaw === "string" ? labFacilityLabelRaw.trim() : String(labFacilityLabelRaw ?? "")

  const {
    sectionType: _st2,
    SectionType: _St2,
    labBinding: _lbOld,
    LabBinding: _LbOld,
    ...restLab
  } = section

  return {
    ...restLab,
    id,
    name,
    controls,
    sectionType: SECTION_TYPE_LAB,
    labBinding: {
      labFacilityId,
      labFacilityLabel,
    },
  }
}

/** @param {unknown[]} sections */
export function normalizeCrfSections(sections) {
  if (!Array.isArray(sections)) return []
  return sections.map(normalizeCrfSection)
}

export function createStandardSection({ id, name, controls = [] }) {
  return normalizeCrfSection({
    id,
    name,
    controls,
    sectionType: SECTION_TYPE_STANDARD,
  })
}

export function createLabSection({ id, name, controls = [] }) {
  return normalizeCrfSection({
    id,
    name,
    controls,
    sectionType: SECTION_TYPE_LAB,
    labBinding: {
      labFacilityId: null,
      labFacilityLabel: "",
    },
  })
}

export function sectionRequiresLabFacility(section) {
  const n = normalizeCrfSection(section)
  return n.sectionType === SECTION_TYPE_LAB
}

export function labSectionFacilityMissing(section) {
  const n = normalizeCrfSection(section)
  if (n.sectionType !== SECTION_TYPE_LAB) return false
  const id = n.labBinding?.labFacilityId
  return id == null || String(id).trim() === ""
}
