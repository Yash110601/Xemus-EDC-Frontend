/** Defaults and helpers for eCONSENT template builder (matches product create-template UX). */

export const CONSENT_TYPES = [
  {
    value: "Adult",
    label: "Adult informed consent",
    ageLabel: "18+ years",
    description: "Single adult participant step. Sections audience: Subject or All signers.",
    steps: ["Adult participant signs"],
  },
  {
    value: "DualParent",
    label: "Dual parent / LAR consent",
    ageLabel: "Child + parents",
    description: "Parent/LAR steps (and optional child assent). Use Parent / Child audiences on sections.",
    steps: ["Parent / LAR 1 signs", "Parent / LAR 2 signs", "Child assent (if required)"],
  },
  {
    value: "ChildAssent",
    label: "Child assent package",
    ageLabel: "Assent age band",
    description: "Child-friendly assent plus parent consent. Set section audiences accordingly.",
    steps: ["Child reads assent", "Parent / guardian signs"],
  },
]

export const AUDIENCE_OPTIONS = [
  { value: "All", label: "All signers" },
  { value: "Subject", label: "Subject (adult)" },
  { value: "Parent", label: "Parent / guardian" },
  { value: "ChildAssent", label: "Child assent" },
]

export const QUESTION_TYPES = [
  {
    value: "MultipleChoice",
    label: "Multiple choice (single answer)",
    description: "One correct option from a list.",
  },
  {
    value: "MultiSelect",
    label: "Multiple choice (select all that apply)",
    description: "Participant must select every correct option.",
  },
  {
    value: "TrueFalse",
    label: "True / False",
    description: "Fixed True and False options.",
  },
  {
    value: "YesNo",
    label: "Yes / No",
    description: "Fixed Yes and No options.",
  },
  {
    value: "Acknowledgment",
    label: "Acknowledgment (checkbox)",
    description: "Must check to confirm understanding — no scored options.",
  },
]

export function defaultsForQuestionType(questionType) {
  const type = questionType || "MultipleChoice"
  if (type === "TrueFalse") {
    return { options: ["True", "False"], correctIndex: 0, correctIndexes: [], requireAcknowledgment: false }
  }
  if (type === "YesNo") {
    return { options: ["Yes", "No"], correctIndex: 0, correctIndexes: [], requireAcknowledgment: false }
  }
  if (type === "Acknowledgment") {
    return { options: [], correctIndex: 0, correctIndexes: [], requireAcknowledgment: true }
  }
  if (type === "MultiSelect") {
    return { options: ["", "", "", ""], correctIndex: 0, correctIndexes: [0], requireAcknowledgment: false }
  }
  return { options: ["", "", "", ""], correctIndex: 0, correctIndexes: [], requireAcknowledgment: false }
}

export function newSectionId() {
  // Keep within signed 32-bit range — backend question/section Ids are ints.
  return (Date.now() % 1_000_000_000) + Math.floor(Math.random() * 1000)
}

/** Remap section/question ids to small sequential ints safe for API payloads. */
export function sanitizeContentForApi(sections = [], questions = []) {
  const sectionIdMap = new Map()
  const nextSections = (sections || []).map((s, index) => {
    const id = index + 1
    if (s?.id != null) sectionIdMap.set(s.id, id)
    return {
      ...s,
      id,
      sortOrder: index + 1,
    }
  })
  const nextQuestions = (questions || []).map((q, index) => {
    const showAfter =
      q?.showAfterSectionId != null && sectionIdMap.has(q.showAfterSectionId)
        ? sectionIdMap.get(q.showAfterSectionId)
        : null
    return {
      ...q,
      id: index + 1,
      showAfterSectionId: showAfter,
      correctIndex: Number(q.correctIndex) || 0,
      correctIndexes: Array.isArray(q.correctIndexes)
        ? q.correctIndexes.map((n) => Number(n)).filter((n) => Number.isFinite(n))
        : [],
    }
  })
  return { sections: nextSections, questions: nextQuestions }
}

export function newBlankQuestion(overrides = {}) {
  const questionType = overrides.questionType || "MultipleChoice"
  return {
    id: newSectionId(),
    questionType,
    signerRole: "Subject",
    showAfterSectionId: null,
    text: "",
    ...defaultsForQuestionType(questionType),
    ...overrides,
    questionType,
  }
}

export function makeStarterSections() {
  const introId = newSectionId()
  return {
    sections: [
      {
        id: introId,
        title: "Introduction",
        audience: "All",
        content: "Explain the purpose of the study, what participation involves, and that consent is voluntary.",
        sortOrder: 0,
      },
    ],
    questions: [
      newBlankQuestion({
        questionType: "MultipleChoice",
        text: "What is the main purpose of this study?",
        options: [
          "Routine care only",
          "To investigate the safety/effectiveness of a study treatment",
          "To sell my data",
          "To replace my doctor",
        ],
        correctIndex: 1,
      }),
      newBlankQuestion({
        questionType: "TrueFalse",
        text: "Participation in this study is voluntary and I may withdraw at any time.",
        correctIndex: 0,
      }),
      newBlankQuestion({
        questionType: "Acknowledgment",
        text: "I confirm that I have read and understand the information above.",
      }),
    ],
  }
}

export function statusBadge(statusDisplay, status) {
  const s = String(statusDisplay || status || "").toLowerCase()
  if (s === "approved" || s === "published") {
    return { label: "Approved", className: "bg-emerald-100 text-emerald-800" }
  }
  if (s === "retired") {
    return { label: "Retired", className: "bg-slate-200 text-slate-700" }
  }
  if (s === "irb review" || s === "submittedforirb") {
    return { label: "IRB Review", className: "bg-amber-100 text-amber-900" }
  }
  return { label: "Draft", className: "bg-slate-100 text-slate-600" }
}

export function isDraftVersion(version) {
  const s = String(version?.statusDisplay || version?.status || "").toLowerCase()
  return s === "draft"
}

export function isIrbReviewVersion(version) {
  const s = String(version?.statusDisplay || version?.status || "").toLowerCase()
  return s === "irb review" || s === "submittedforirb"
}

export function canPublishVersion(version) {
  const s = String(version?.statusDisplay || version?.status || "").toLowerCase()
  return s === "draft" || s === "irb review" || s === "submittedforirb"
}

/** Normalize visit schedule API payloads into { id, label, visitNo }. */
export function normalizeVisitScheduleOptions(raw) {
  let rows = raw?.data ?? raw?.Data ?? raw
  if (rows && !Array.isArray(rows)) {
    rows =
      rows.items ??
      rows.Items ??
      rows.records ??
      rows.Records ??
      rows.visitSchedules ??
      rows.VisitSchedules ??
      rows
  }
  if (!Array.isArray(rows)) return []

  return rows
    .map((v, index) => {
      if (typeof v === "string") {
        return { id: index + 1, label: v, visitNo: index + 1 }
      }
      const id = v?.id ?? v?.Id ?? v?.visitScheduleId ?? v?.VisitScheduleId
      if (id == null || id === "") return null
      const visitNo = v?.visitNo ?? v?.VisitNo ?? null
      const name =
        v?.visitName ??
        v?.VisitName ??
        v?.name ??
        v?.Name ??
        (visitNo != null ? `Visit ${visitNo}` : `Visit ${id}`)
      const label = visitNo != null ? `${visitNo}. ${name}` : String(name)
      return { id: Number(id), label, visitNo }
    })
    .filter((v) => v && Number.isFinite(v.id) && v.id > 0)
}
