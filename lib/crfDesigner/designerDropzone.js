/** Unique droppable ids per section (avoids dropzone_0 collision across status blocks). */
export const DROPZONE_ID_SEP = "__dz__"

/**
 * @param {string} sectionId
 * @param {number} slotIndex
 */
export function buildDropzoneDroppableId(sectionId, slotIndex) {
  return `dropzone${DROPZONE_ID_SEP}${sectionId}${DROPZONE_ID_SEP}${slotIndex}`
}

/**
 * @param {string|number} droppableId
 * @returns {{ sectionId: string | null, index: number } | null}
 */
export function parseDropzoneDroppableId(droppableId) {
  const str = String(droppableId ?? "")
  if (str.includes(DROPZONE_ID_SEP)) {
    const parts = str.split(DROPZONE_ID_SEP)
    if (parts.length < 3) return null
    const index = Number.parseInt(parts[parts.length - 1], 10)
    const sectionId = parts.slice(1, -1).join(DROPZONE_ID_SEP)
    return { sectionId, index: Number.isNaN(index) ? 0 : index }
  }
  if (str.startsWith("dropzone_")) {
    const index = Number.parseInt(str.replace("dropzone_", ""), 10)
    return { sectionId: null, index: Number.isNaN(index) ? 0 : index }
  }
  return null
}

/**
 * @param {unknown[]} sections
 * @param {{ id?: string | number, data?: { current?: { sectionId?: string } } }} over
 * @param {string | null | undefined} fallbackSectionId
 */
export function resolveSectionIdFromDropTarget(sections, over, fallbackSectionId) {
  const overData = over?.data?.current
  if (overData?.sectionId) return overData.sectionId

  const parsed = parseDropzoneDroppableId(String(over?.id ?? ""))
  if (parsed?.sectionId) return parsed.sectionId

  const overId = over?.id
  if (overId != null && typeof overId === "string" && !overId.startsWith("tool_")) {
    const sec = (sections || []).find((s) => (s.controls || []).some((c) => c.id === overId))
    if (sec?.id) return sec.id
  }

  return fallbackSectionId ?? null
}

/**
 * @param {unknown[]} sections
 * @param {string | number} controlId
 */
export function findSectionIdByControlId(sections, controlId) {
  const sec = (sections || []).find((s) => (s.controls || []).some((c) => c.id === controlId))
  return sec?.id ?? null
}
