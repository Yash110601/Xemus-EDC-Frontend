import { LOCK_LEVELS, targetSelectionKey } from "@/lib/dbLock/crfLockTree"

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function normalizeTarget(raw) {
  if (!raw || typeof raw !== "object") return null
  const level = String(raw.level ?? raw.Level ?? "").trim().toLowerCase()
  const sectionKey = String(raw.sectionKey ?? raw.SectionKey ?? "").trim()
  const fieldKey = String(raw.fieldKey ?? raw.FieldKey ?? "").trim()
  if (!level) return null
  if (level === LOCK_LEVELS.SECTION && !sectionKey) return null
  if (level === LOCK_LEVELS.FIELD && (!sectionKey || !fieldKey)) return null
  return {
    level,
    sectionKey: sectionKey || null,
    fieldKey: level === LOCK_LEVELS.FIELD ? fieldKey : null,
    selectionKey: targetSelectionKey({ level, sectionKey, fieldKey }),
  }
}

/**
 * Normalize GET /DatabaseLock/GetCrfStructure response for the lock UI.
 */
export function normalizeCrfStructureResponse(raw, studyId, crfDataId) {
  const payload = raw?.data ?? raw ?? {}
  const sections = asArray(payload.sections ?? payload.Sections).map((section) => ({
    sectionKey: section.sectionKey ?? section.SectionKey ?? "",
    sectionName: section.sectionLabel ?? section.SectionLabel ?? section.sectionKey ?? "",
    fields: asArray(section.fields ?? section.Fields).map((field) => ({
      fieldKey: field.fieldKey ?? field.FieldKey ?? "",
      label: field.fieldLabel ?? field.FieldLabel ?? field.fieldKey ?? "",
      type: "",
      isLocked: Boolean(field.isLocked ?? field.IsLocked),
    })),
    isLocked: Boolean(section.isLocked ?? section.IsLocked),
  }))

  const targets = asArray(payload.lockedTargets ?? payload.LockedTargets)
    .map(normalizeTarget)
    .filter(Boolean)

  const lockedSelectionKeys = new Set(targets.map((target) => target.selectionKey).filter(Boolean))
  const lockedSectionKeys = new Set()
  const lockedFieldKeys = new Set()

  for (const target of targets) {
    if (target.level === LOCK_LEVELS.SECTION && target.sectionKey) {
      lockedSectionKeys.add(target.sectionKey)
    }
    if (target.level === LOCK_LEVELS.FIELD && target.fieldKey) {
      lockedFieldKeys.add(target.fieldKey)
    }
  }

  // Reflect effective lock flags from structure tree (cascade + persisted rows).
  if (!Boolean(payload.isWholeCrfLocked ?? payload.IsWholeCrfLocked)) {
    for (const section of sections) {
      if (section.isLocked) {
        lockedSectionKeys.add(section.sectionKey)
        lockedSelectionKeys.add(`section:${section.sectionKey}`)
      }
      for (const field of section.fields) {
        if (field.isLocked && !section.isLocked) {
          lockedFieldKeys.add(field.fieldKey)
          lockedSelectionKeys.add(`field:${section.sectionKey}:${field.fieldKey}`)
        }
      }
    }
  }

  return {
    studyId: payload.studyId ?? payload.StudyId ?? studyId,
    crfDataId: payload.crfDataId ?? payload.CrfDataId ?? crfDataId,
    crfDesignId: payload.crfDesignId ?? payload.CrfDesignId ?? null,
    crfDesignName: payload.crfDesignName ?? payload.CrfDesignName ?? "",
    visitTypeName: payload.visitTypeName ?? payload.VisitTypeName ?? "",
    patientIdentifier: payload.patientIdentifier ?? payload.PatientIdentifier ?? "",
    siteId: payload.siteId ?? payload.SiteId ?? null,
    isWholeCrfLocked: Boolean(payload.isWholeCrfLocked ?? payload.IsWholeCrfLocked),
    cascadeLocked: {
      study: Boolean(payload.isStudyLocked ?? payload.IsStudyLocked),
      site: Boolean(payload.isSiteLocked ?? payload.IsSiteLocked),
    },
    sectionTree: sections.map(({ sectionKey, sectionName, fields }) => ({
      sectionKey,
      sectionName,
      fields: fields.map(({ fieldKey, label, type }) => ({ fieldKey, label, type })),
    })),
    targets,
    lockedSelectionKeys,
    lockedSectionKeys,
    lockedFieldKeys,
    granularSupported: true,
  }
}

/** @deprecated use normalizeCrfStructureResponse */
export function normalizeLockTargetsResponse(raw, studyId) {
  return normalizeCrfStructureResponse(raw, studyId, raw?.crfDataId ?? raw?.CrfDataId ?? null)
}
