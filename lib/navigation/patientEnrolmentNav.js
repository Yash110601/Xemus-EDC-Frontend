import { getStudyNavCatalogFallback } from "@/lib/navigation/studyNavCatalogFallback"

export const PATIENT_ENROLMENT_CREATE_NAV = {
  name: "Create Patient Enrolment",
  code: "PATIENT_ENROLMENT_CREATE",
  route: "/patient-enrolment/create",
  displayOrder: 1,
}

export const PATIENT_ENROLMENT_MANAGE_NAV = {
  name: "Manage Patient Enrolments",
  code: "PATIENT_ENROLMENT_MANAGE",
  route: "/patient-enrolment/manage",
  displayOrder: 2,
}

export const PATIENT_ENROLMENT_SUB_NAV = [
  PATIENT_ENROLMENT_CREATE_NAV,
  PATIENT_ENROLMENT_MANAGE_NAV,
]

const PATIENT_ENROLMENT_FEATURE_CODES = new Set(["PATIENT_ENROLMENT", "PATIENT_ENROLLMENT"])

export function isPatientEnrolmentMenuFeature(feature) {
  if (!feature || typeof feature !== "object") return false
  const code = String(feature.code ?? feature.Code ?? "")
    .trim()
    .toUpperCase()
  const route = String(feature.route ?? feature.Route ?? "")
    .trim()
    .toLowerCase()
  return PATIENT_ENROLMENT_FEATURE_CODES.has(code) || route === "/patient-enrolment"
}

export function patientEnrolmentMenuHasSubFeatureCode(menu, subFeatureCode) {
  if (!Array.isArray(menu) || !subFeatureCode) return false
  const feature = menu.find(isPatientEnrolmentMenuFeature)
  if (!feature) return false
  const codeUpper = String(subFeatureCode).trim().toUpperCase()
  const subs = feature.subFeatures ?? feature.SubFeatures ?? []
  return subs.some(
    (sf) =>
      String(sf.code ?? sf.Code ?? "")
        .trim()
        .toUpperCase() === codeUpper,
  )
}

function fallbackPatientEnrolmentSubFeatures() {
  const feature = getStudyNavCatalogFallback().find(isPatientEnrolmentMenuFeature)
  return feature?.subFeatures ?? feature?.SubFeatures ?? PATIENT_ENROLMENT_SUB_NAV
}

/**
 * Merge create/manage sub-features when login menu or nav catalog is stale.
 * @param {unknown} menu
 */
export function mergePatientEnrolmentSubFeaturesInMenu(menu) {
  if (!Array.isArray(menu)) return menu

  const fallbackSubs = fallbackPatientEnrolmentSubFeatures()
  if (!fallbackSubs.length) return menu

  return menu.map((feature) => {
    if (!isPatientEnrolmentMenuFeature(feature)) return feature

    const existing = feature.subFeatures ?? feature.SubFeatures ?? []
    const merged = [...existing]

    for (const sf of fallbackSubs) {
      const sfCode = String(sf.code ?? sf.Code ?? "")
        .trim()
        .toUpperCase()
      if (!sfCode) continue
      const already = merged.some(
        (item) =>
          String(item?.code ?? item?.Code ?? "")
            .trim()
            .toUpperCase() === sfCode,
      )
      if (!already) merged.push(sf)
    }

    merged.sort(
      (a, b) =>
        (a.displayOrder ?? a.DisplayOrder ?? 999) - (b.displayOrder ?? b.DisplayOrder ?? 999) ||
        String(a.name ?? a.Name ?? "").localeCompare(String(b.name ?? b.Name ?? "")),
    )

    return { ...feature, subFeatures: merged }
  })
}
