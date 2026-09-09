import { getSectionsFromCrfDesign } from "@/lib/utils/crfPdfSectionsBuilder"

export const LOCK_LEVELS = {
  STUDY: "study",
  SITE: "site",
  CRF: "crf",
  SECTION: "section",
  FIELD: "field",
}

function controlLabel(control) {
  const label = control?.label ?? control?.properties?.label ?? control?.name
  if (label && String(label).trim()) return String(label).trim()
  return String(control?.id ?? "Field")
}

function isHiddenControl(control) {
  return Boolean(control?.properties?.hidden)
}

/**
 * Build visit → section → field tree from a CRF design payload.
 * @param {object|null} crfDesign
 * @returns {Array<{ sectionKey: string, sectionName: string, fields: Array<{ fieldKey: string, label: string, type: string }> }>}
 */
export function buildCrfLockSectionTree(crfDesign) {
  const sections = getSectionsFromCrfDesign(crfDesign)
  return sections
    .map((section) => {
      const sectionKey = String(section?.id ?? section?.sectionKey ?? "").trim()
      if (!sectionKey) return null
      const sectionName = String(section?.name ?? sectionKey).trim() || sectionKey
      const fields = (section?.controls ?? [])
        .filter((control) => control?.id && !isHiddenControl(control))
        .map((control) => ({
          fieldKey: String(control.id).trim(),
          label: controlLabel(control),
          type: String(control?.type ?? "").trim(),
        }))
        .filter((field) => field.fieldKey.startsWith("ctrl_"))
      return { sectionKey, sectionName, fields }
    })
    .filter(Boolean)
}

export function targetSelectionKey(target) {
  const level = String(target?.level ?? "").trim().toLowerCase()
  const sectionKey = String(target?.sectionKey ?? target?.SectionKey ?? "").trim()
  const fieldKey = String(target?.fieldKey ?? target?.FieldKey ?? "").trim()
  if (level === LOCK_LEVELS.SECTION && sectionKey) return `section:${sectionKey}`
  if (level === LOCK_LEVELS.FIELD && sectionKey && fieldKey) return `field:${sectionKey}:${fieldKey}`
  return ""
}

export function buildTargetFromSelectionKey(key) {
  const raw = String(key ?? "").trim()
  if (raw.startsWith("section:")) {
    return { level: LOCK_LEVELS.SECTION, sectionKey: raw.slice("section:".length), fieldKey: null }
  }
  if (raw.startsWith("field:")) {
    const parts = raw.slice("field:".length).split(":")
    const sectionKey = parts[0] ?? ""
    const fieldKey = parts.slice(1).join(":")
    return { level: LOCK_LEVELS.FIELD, sectionKey, fieldKey }
  }
  return null
}

/**
 * Expand locked targets into a set of field keys for eCRF read-only checks.
 * @param {{ isWholeCrfLocked?: boolean, lockedSectionKeys?: string[], lockedFieldKeys?: string[], sectionTree?: ReturnType<typeof buildCrfLockSectionTree> }} state
 * @returns {Set<string>|null} null = whole CRF locked; empty Set = nothing locked at field level
 */
export function expandLockedFieldKeys(state) {
  if (state?.isWholeCrfLocked) return null

  const lockedFields = new Set()
  const lockedSections = new Set((state?.lockedSectionKeys ?? []).map(String))

  for (const section of state?.sectionTree ?? []) {
    if (lockedSections.has(section.sectionKey)) {
      section.fields.forEach((field) => lockedFields.add(field.fieldKey))
    }
  }

  for (const key of state?.lockedFieldKeys ?? []) {
    lockedFields.add(String(key))
  }

  return lockedFields
}

export function isControlGranularLocked(controlId, sectionKey, granularLockState) {
  if (!granularLockState?.active) return false
  if (granularLockState.wholeFormLocked) return true

  const fieldKey = String(controlId ?? "").trim()
  const section = String(sectionKey ?? "").trim()

  if (granularLockState.lockedSectionKeys?.has(section)) return true
  return Boolean(granularLockState.lockedFieldKeys?.has(fieldKey))
}
