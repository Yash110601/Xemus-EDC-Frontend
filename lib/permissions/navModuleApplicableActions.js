import { REPORT_REGISTRY } from "@/lib/reports/reportRegistry"
import { NAV_MODULE_ACTIONS } from "@/lib/permissions/studyNavModuleKeys"

const REPORT_MENU_CODES = new Set(
  REPORT_REGISTRY.map((report) =>
    String(report.code ?? "")
      .trim()
      .toUpperCase(),
  ),
)

const ACTION_SETS = Object.freeze({
  viewOnly: ["view"],
  viewEdit: ["view", "edit"],
  viewAddEdit: ["view", "add", "edit"],
  viewExport: ["view", "export"],
  viewEditExport: ["view", "edit", "export"],
  viewAddEditExport: ["view", "add", "edit", "export"],
  fullCrud: ["view", "add", "edit", "delete"],
})

/** Menu codes mapped to actions the application actually uses on that screen. */
const MENU_ACTION_OVERRIDES = Object.freeze({
  DASHBOARD: ACTION_SETS.viewOnly,
  QUERY_DASHBOARD: ACTION_SETS.viewOnly,

  ECRF: ACTION_SETS.viewAddEditExport,
  ECRF_DATA_ENTRY: ACTION_SETS.viewAddEditExport,
  CRF_DATA_ENTRY: ACTION_SETS.viewAddEditExport,
  MANUAL_DATA_ENTRY: ACTION_SETS.viewAddEditExport,
  VISIT_ATTACHMENTS: ["view", "add", "delete"],

  PATIENT_ENROLMENT: ACTION_SETS.viewEditExport,
  PATIENT_ENROLLMENT: ACTION_SETS.viewEditExport,
  PATIENT_ENROLMENT_CREATE: ACTION_SETS.viewAddEdit,
  PATIENT_ENROLMENT_MANAGE: ACTION_SETS.viewEditExport,

  STUDY_SETTINGS: ACTION_SETS.viewAddEdit,
  STUDY_ROLE_PERMISSIONS: ACTION_SETS.viewAddEdit,
  DATABASE_LOCK: ACTION_SETS.viewEdit,
  DB_LOCK: ACTION_SETS.viewEdit,
  PI_SIGNOFF: ACTION_SETS.viewEdit,
  PAYMENT_RULES: ACTION_SETS.viewEdit,
  STUDY_SDTM_MAPPING: ACTION_SETS.viewEdit,
  STUDY_DELEGATION_LOG: ACTION_SETS.viewEdit,
  STUDY_DOCUMENTS: ACTION_SETS.viewAddEdit,

  USER_CREATION: ACTION_SETS.fullCrud,
  USER_MGMT: ACTION_SETS.fullCrud,
  STUDY_CREATION: ACTION_SETS.fullCrud,
  SITE_CREATION: ACTION_SETS.fullCrud,
  ROLE_PERMISSION: ACTION_SETS.viewEdit,

  CRF_DESIGNER: ACTION_SETS.viewAddEdit,
  CRF_FORM_DESIGNER: ACTION_SETS.viewAddEdit,

  LAB_UNITS: ACTION_SETS.fullCrud,
  LAB_CATEGORIES: ACTION_SETS.fullCrud,
  LAB_TESTS: ACTION_SETS.fullCrud,
  LABS: ACTION_SETS.fullCrud,
  LAB_RANGE_ASSIGNMENTS: ACTION_SETS.viewAddEdit,

  QUERY_MGMT: ACTION_SETS.viewAddEdit,
})

function normalizeMenuCode(menuCode) {
  return String(menuCode ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "")
}

function normalizeRoute(route) {
  const path = String(route ?? "")
    .trim()
    .toLowerCase()
  if (!path) return ""
  const withSlash = path.startsWith("/") ? path : `/${path}`
  return withSlash.replace(/\/$/, "")
}

/**
 * Actions that exist in the app for a sidebar module (not every screen has Add/Delete/Export).
 * @param {string} menuCode
 * @param {{ route?: string }} [options]
 * @returns {string[]}
 */
export function resolveApplicableNavModuleActions(menuCode, { route } = {}) {
  const code = normalizeMenuCode(menuCode)
  if (!code) return [...ACTION_SETS.viewOnly]

  if (MENU_ACTION_OVERRIDES[code]) return [...MENU_ACTION_OVERRIDES[code]]
  if (REPORT_MENU_CODES.has(code)) return [...ACTION_SETS.viewExport]

  const path = normalizeRoute(route)
  if (path === "/dashboard" || path.endsWith("/dashboard")) return [...ACTION_SETS.viewOnly]
  if (path.startsWith("/reports/")) return [...ACTION_SETS.viewExport]
  if (path.startsWith("/ecrf-data-entry")) return [...ACTION_SETS.viewAddEditExport]
  if (path === "/patient-enrolment/create") return [...ACTION_SETS.viewAddEdit]
  if (path === "/patient-enrolment/manage") return [...ACTION_SETS.viewEditExport]
  if (path.startsWith("/patient-enrolment")) return [...ACTION_SETS.viewEditExport]

  return [...ACTION_SETS.viewAddEdit]
}

export function getNavModuleActionDefs(actionIds = []) {
  const allowed = new Set(actionIds)
  return NAV_MODULE_ACTIONS.filter((action) => allowed.has(action.id))
}

export function formatNavModuleActionLegend(actionIds = []) {
  return getNavModuleActionDefs(actionIds)
    .map((action) => action.label)
    .join(" · ")
}
