import { normalizeMenuPermissions } from "@/lib/utils/menuRoutePermissions"
import { buildNavModuleActionKey } from "@/lib/permissions/studyNavModuleKeys"
import {
  getNavModuleActionDefs,
  resolveApplicableNavModuleActions,
} from "@/lib/permissions/navModuleApplicableActions"

/** Injected sidebar items that may not be in login menu yet — still configurable per study. */
const EXTRA_NAV_MODULE_ENTRIES = [
  { featureLabel: "Study Management", code: "PAYMENT_RULES", label: "Payment Rules", route: "/study-management/payment-rules" },
  { featureLabel: "Study Management", code: "STUDY_SDTM_MAPPING", label: "SDTM Field Mapping", route: "/study-management/sdtm-mapping" },
  { featureLabel: "Study Management", code: "STUDY_DELEGATION_LOG", label: "Delegation Log", route: "/study-management/delegation-log" },
  { featureLabel: "Study Management", code: "STUDY_DOCUMENTS", label: "Study documents", route: "/study-management/study-documents" },
  { featureLabel: "Reports", code: "PI_SIGNOFF_REPORT", label: "PI Sign-off Report", route: "/reports/pi-signoff-report" },
  { featureLabel: "Reports", code: "CDISC_EXPORT", label: "CDISC Export", route: "/reports/cdisc-export" },
  { featureLabel: "Reports", code: "CDASH_REPORT", label: "CDASH Report", route: "/reports/cdash" },
  { featureLabel: "Patient enrollment ", code: "PATIENT_ENROLMENT_CREATE", label: "Create Patient Enrolment", route: "/patient-enrolment/create" },
  { featureLabel: "Patient enrollment ", code: "PATIENT_ENROLMENT_MANAGE", label: "Manage Patient Enrolments", route: "/patient-enrolment/manage" },
  { featureLabel: "CRF Management", code: "VISIT_ATTACHMENTS", label: "Visit document attachments", route: "/ecrf-data-entry/manually" },
]

function pushMenuItemActions(target, seen, { code, label, featureLabel, route }) {
  const menuCode = String(code ?? "").trim()
  const itemLabel = String(label ?? menuCode).trim() || menuCode
  if (!menuCode) return

  const applicableActions = resolveApplicableNavModuleActions(menuCode, { route })
  const actionDefs = getNavModuleActionDefs(applicableActions)

  for (const action of actionDefs) {
    const key = buildNavModuleActionKey(menuCode, action.id)
    if (!key || seen.has(key)) continue
    seen.add(key)
    target.push({
      key,
      label: itemLabel,
      actionLabel: action.label,
      action: action.id,
      menuCode,
      featureLabel: featureLabel ?? null,
      applicableActions,
    })
  }
}

/**
 * Build per-menu View/Add/Edit/Delete/Export matrix groups from login menu.
 * @param {unknown} menu
 */
export function buildStudyNavModuleCatalogFromMenu(menu) {
  const features = normalizeMenuPermissions(menu)
  const groups = []
  const globalSeen = new Set()

  for (const feature of features) {
    const featureCode = feature?.code ?? feature?.Code ?? ""
    const featureName = feature?.name ?? feature?.Name ?? featureCode
    const permissions = []
    const seen = new Set()

    const subs = feature?.subFeatures ?? feature?.SubFeatures ?? []
    if (Array.isArray(subs)) {
      for (const sub of subs) {
        pushMenuItemActions(permissions, seen, {
          code: sub?.code ?? sub?.Code,
          label: sub?.name ?? sub?.Name,
          featureLabel: featureName,
          route: sub?.route ?? sub?.Route,
        })
      }
    }

    if (feature?.route) {
      pushMenuItemActions(permissions, seen, {
        code: featureCode,
        label: featureName,
        featureLabel: featureName,
        route: feature?.route ?? feature?.Route,
      })
    }

    for (const extra of EXTRA_NAV_MODULE_ENTRIES) {
      if (extra.featureLabel === featureName || extra.featureLabel === String(featureCode).toUpperCase()) {
        pushMenuItemActions(permissions, seen, extra)
      }
    }

    if (!permissions.length) continue

    for (const perm of permissions) {
      globalSeen.add(perm.key)
    }

    groups.push({
      id: `nav-${normalizeMenuCodeForId(featureCode)}`,
      label: featureName,
      permissions,
    })
  }

  const orphanExtras = []
  const orphanSeen = new Set()
  for (const extra of EXTRA_NAV_MODULE_ENTRIES) {
    const probeKey = buildNavModuleActionKey(extra.code, "view")
    if (probeKey && !globalSeen.has(probeKey)) {
      pushMenuItemActions(orphanExtras, orphanSeen, extra)
    }
  }

  if (orphanExtras.length) {
    groups.push({
      id: "nav-other",
      label: "Other modules",
      permissions: orphanExtras,
    })
  }

  return groups
}

function normalizeMenuCodeForId(code) {
  return String(code ?? "feature")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
}

export function flattenNavModuleCatalog(groups) {
  if (!Array.isArray(groups)) return []
  return groups.flatMap((group) => group.permissions ?? [])
}

export function buildStudyNavModuleCatalogFromFeaturesApi(featuresPayload) {
  const list = Array.isArray(featuresPayload) ? featuresPayload : []
  const pseudoMenu = list.map((feature) => ({
    code: feature?.code ?? feature?.Code,
    name: feature?.name ?? feature?.Name,
    route: feature?.route ?? feature?.Route ?? null,
    subFeatures: (feature?.subFeatures ?? feature?.SubFeatures ?? []).map((sf) => ({
      code: sf?.code ?? sf?.Code,
      name: sf?.name ?? sf?.Name,
      route: sf?.route ?? sf?.Route ?? null,
    })),
  }))
  return buildStudyNavModuleCatalogFromMenu(pseudoMenu)
}
