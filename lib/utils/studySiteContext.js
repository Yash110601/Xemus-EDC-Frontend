/** Shared study/site workspace context (header selection + localStorage). */

import { applyDashboardStudyContext } from "@/lib/dashboard/dashboardMetricLens"

export function readStudySiteFromStorage() {
  if (typeof window === "undefined") {
    return { studyId: null, siteId: null }
  }

  const studyParsed = Number.parseInt(String(localStorage.getItem("selectedStudyId") ?? ""), 10)
  const siteParsed = Number.parseInt(String(localStorage.getItem("selectedSiteId") ?? ""), 10)

  return {
    studyId: Number.isFinite(studyParsed) && studyParsed > 0 ? studyParsed : null,
    siteId: Number.isFinite(siteParsed) && siteParsed > 0 ? siteParsed : null,
  }
}

export function parseStudySiteEventDetail(detail = {}) {
  const next = {}

  if (Object.prototype.hasOwnProperty.call(detail, "studyId")) {
    const parsed = Number.parseInt(String(detail.studyId ?? ""), 10)
    next.studyId =
      detail.studyId == null || detail.studyId === "" || Number.isNaN(parsed) || parsed <= 0
        ? null
        : parsed
  }

  if (Object.prototype.hasOwnProperty.call(detail, "siteId")) {
    const parsed = Number.parseInt(String(detail.siteId ?? ""), 10)
    next.siteId =
      detail.siteId == null || detail.siteId === "" || Number.isNaN(parsed) || parsed <= 0
        ? null
        : parsed
  }

  return next
}

/** Update header workspace context from in-page study pickers. */
export function publishWorkspaceStudySiteSelection(studyId, siteId = null) {
  if (typeof window === "undefined") return

  if (studyId != null && studyId !== "") {
    localStorage.setItem("selectedStudyId", String(studyId))
  } else {
    localStorage.removeItem("selectedStudyId")
  }

  if (siteId != null && siteId !== "") {
    localStorage.setItem("selectedSiteId", String(siteId))
  } else {
    localStorage.removeItem("selectedSiteId")
  }

  window.dispatchEvent(
    new CustomEvent("studySiteChanged", {
      detail: {
        studyId: studyId != null && studyId !== "" ? Number(studyId) : null,
        siteId: siteId != null && siteId !== "" ? Number(siteId) : null,
      },
    }),
  )
}

/** Display label for the workspace study (protocol — title). */
export function formatWorkspaceStudyLabel(studyId) {
  if (!studyId) return ""
  if (typeof window === "undefined") return `Study #${studyId}`

  const { currentStudy } = readStudySiteHeaderStateFromStorage()
  const matches =
    currentStudy &&
    (currentStudy.studyId === studyId || String(currentStudy.studyId) === String(studyId))

  if (matches) {
    const protocol = (currentStudy.protocolNumber || "").trim()
    const title = (currentStudy.studyTitle || "").trim()
    if (protocol && title) return `${protocol} — ${title}`
    if (protocol) return protocol
    if (title) return title
  }

  const protocol = (localStorage.getItem("selectedStudy") || "").trim()
  const title = (localStorage.getItem("selectedStudyTitle") || "").trim()
  const savedId = localStorage.getItem("selectedStudyId")
  if (savedId && String(savedId) === String(studyId)) {
    if (protocol && title) return `${protocol} — ${title}`
    if (protocol) return protocol
    if (title) return title
  }

  return `Study #${studyId}`
}

/** Header chip shape from localStorage (for top-header sync). */
export function readStudySiteHeaderStateFromStorage() {
  if (typeof window === "undefined") {
    return { currentStudy: null, selectedSite: null }
  }

  const savedStudy = localStorage.getItem("selectedStudy")
  const savedStudyTitle = localStorage.getItem("selectedStudyTitle")
  const savedSite = localStorage.getItem("selectedSite")
  const savedStudyId = localStorage.getItem("selectedStudyId")
  const savedSiteId = localStorage.getItem("selectedSiteId")

  let currentStudy = null
  if (savedStudy && savedStudyId) {
    const parsedStudyId = Number.parseInt(savedStudyId, 10)
    if (Number.isFinite(parsedStudyId) && parsedStudyId > 0) {
      currentStudy = {
        protocolNumber: savedStudy,
        studyTitle: savedStudyTitle || "",
        studyId: parsedStudyId,
      }
    }
  }

  let selectedSite = null
  if (savedSite && savedSiteId) {
    const parsedSiteId = Number.parseInt(savedSiteId, 10)
    if (Number.isFinite(parsedSiteId) && parsedSiteId > 0) {
      selectedSite = {
        siteName: savedSite,
        id: parsedSiteId,
        siteId: parsedSiteId,
      }
    }
  }

  return { currentStudy, selectedSite }
}

/**
 * When user has exactly one assigned study and none selected, auto-select it so
 * per-study role permissions and sidebar matrix can apply.
 */
export async function autoSelectSingleAssignedStudy(fetchStudiesForDropdown) {
  if (typeof window === "undefined") return null

  const { studyId } = readStudySiteFromStorage()
  if (studyId) return studyId

  if (typeof fetchStudiesForDropdown !== "function") return null

  const res = await fetchStudiesForDropdown()
  const list = Array.isArray(res?.data) ? res.data : []
  if (list.length !== 1) return null

  const study = list[0]
  const selectedId = study?.studyId ?? study?.StudyId ?? study?.id ?? study?.Id
  if (!selectedId) return null

  applyDashboardStudyContext(study)
  return Number(selectedId)
}
