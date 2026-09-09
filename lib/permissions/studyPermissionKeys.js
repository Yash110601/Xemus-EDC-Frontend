/**
 * Study/site permission keys for the role matrix (§4.2).
 * Functional actions only — per-menu visibility uses dynamic module.nav.{code} keys.
 */

export const STUDY_NAV_MODULE_GROUP_META = Object.freeze({
  id: "modules",
  label: "Module permissions (per study)",
  description:
    "Per-module actions that exist in the app (View, Add, Edit, Delete, Export as applicable). View also controls sidebar visibility when the study matrix is ON.",
})

export const STUDY_PERMISSION_GROUPS = Object.freeze([
  {
    id: "crf",
    label: "CRF",
    permissions: [
      { key: "crf.view", label: "View CRF" },
      { key: "crf.edit", label: "Edit CRF" },
    ],
  },
  {
    id: "query",
    label: "Queries",
    permissions: [
      { key: "query.create", label: "Create query" },
      { key: "query.respond", label: "Respond to query" },
      { key: "query.close", label: "Close query" },
    ],
  },
  {
    id: "sdv",
    label: "SDV",
    permissions: [{ key: "sdv.verify", label: "SDV verify" }],
  },
  {
    id: "rsdv",
    label: "Remote SDV",
    permissions: [{ key: "rsdv.review", label: "Remote SDV review" }],
  },
  {
    id: "pi",
    label: "PI",
    permissions: [{ key: "pi.signoff", label: "PI sign-off" }],
  },
  {
    id: "data",
    label: "Data",
    permissions: [{ key: "data.masking.view", label: "View masked data" }],
  },
  {
    id: "reports",
    label: "Reports",
    permissions: [
      { key: "report.view", label: "View reports" },
      { key: "report.export", label: "Export reports" },
    ],
  },
  {
    id: "lock",
    label: "Database lock",
    permissions: [
      { key: "dblock.view", label: "View lock status" },
      { key: "dblock.apply", label: "Apply / release lock" },
    ],
  },
])

export const STUDY_FUNCTIONAL_PERMISSION_GROUPS = STUDY_PERMISSION_GROUPS

/** Flat list of functional permission keys (excludes dynamic module.nav.*). */
export const ALL_STUDY_PERMISSION_KEYS = STUDY_PERMISSION_GROUPS.flatMap((group) =>
  group.permissions.map((item) => item.key),
)

export function getStudyPermissionLabel(key) {
  for (const group of STUDY_PERMISSION_GROUPS) {
    const match = group.permissions.find((item) => item.key === key)
    if (match) return match.label
  }
  return key
}
