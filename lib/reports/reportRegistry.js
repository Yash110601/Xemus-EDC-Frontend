/**
 * Central catalog of report pages.
 * Add a new report here once — route + menu code — then use useReportExportAccess() on the page.
 *
 * Menu codes must match Role Permission sub-features (backend / role-permission screen).
 */

/** @typedef {{ key: string, route: string, code: string, label: string }} ReportDefinition */

/** @type {ReportDefinition[]} */
export const REPORT_REGISTRY = [
  { key: "audit-log", route: "/reports/audit-log", code: "AUDIT_LOG", label: "Audit log" },
  { key: "audit-trail", route: "/reports/audit-trail", code: "AUDIT_TRAIL", label: "Audit trail" },
  {
    key: "audit-trail-with-reason",
    route: "/reports/audit-trail-with-reason",
    code: "AUDIT_TRAIL_WITH_REASON",
    label: "Audit trail with reason",
  },
  {
    key: "study-details",
    route: "/reports/export-study-details",
    code: "STUDY_DETAILS_REPORT",
    label: "Study details",
  },
  {
    key: "site-details",
    route: "/reports/export-site-details",
    code: "SITE_DETAILS_REPORT",
    label: "Site details",
  },
  {
    key: "patient-details",
    route: "/reports/export-patient-details",
    code: "PATIENT_DETAILS_REPORT",
    label: "Patient details",
  },
  {
    key: "visit-details",
    route: "/reports/export-visit-details",
    code: "VISIT_DETAILS_REPORT",
    label: "Visit details",
  },
  {
    key: "agreement-report",
    route: "/reports/export-agreement-report",
    code: "AGREEMENT_REPORT",
    label: "Agreement report",
  },
  {
    key: "user-details",
    route: "/reports/export-user-details",
    code: "USER_DETAILS_REPORT",
    label: "User details",
  },
  {
    key: "ecrf-details",
    route: "/reports/export-ecrf-details",
    code: "ECRF_DETAILS_REPORT",
    label: "eCRF details",
  },
  {
    key: "finance-report",
    route: "/reports/export-finance-report",
    code: "FINANCE_REPORT",
    label: "Finance report",
  },
  {
    key: "patient-status",
    route: "/reports/patient-status-report",
    code: "PATIENT_STATUS_REPORT",
    label: "Patient status",
  },
  {
    key: "query-management",
    route: "/reports/query-management-report",
    code: "QUERY_MANAGEMENT_REPORT",
    label: "Query management",
  },
  {
    key: "query-dashboard",
    route: "/reports/query-dashboard",
    code: "QUERY_DASHBOARD",
    label: "Query dashboard",
  },
  { key: "sdv-report", route: "/reports/sdv-report", code: "SDV_REPORT", label: "SDV report" },
  {
    key: "pi-signoff-report",
    route: "/reports/pi-signoff-report",
    code: "PI_SIGNOFF_REPORT",
    label: "PI sign-off report",
  },
  {
    key: "cdisc-export",
    route: "/reports/cdisc-export",
    code: "CDISC_EXPORT",
    label: "CDISC export",
  },
  {
    key: "cdash-report",
    route: "/reports/cdash",
    code: "CDASH_REPORT",
    label: "CDASH Report",
  },
  {
    key: "ai-entry-report",
    route: "/reports/ai-entry-report",
    code: "AI_ENTRY_REPORT",
    label: "AI Entry Report",
  },
  {
    key: "ai-oversight-report",
    route: "/reports/ai-oversight-report",
    code: "AI_OVERSIGHT_REPORT",
    label: "AI Oversight Report",
  },
  {
    key: "email-delivery-report",
    route: "/reports/email-delivery-report",
    code: "EMAIL_DELIVERY_REPORT",
    label: "Email Delivery Report",
  },
]

const normalizePath = (value) => {
  const path = (value || "").toString().trim().toLowerCase()
  if (!path) return ""
  return path.startsWith("/") ? path : `/${path}`
}

const normalizeCode = (value) =>
  (value || "").toString().trim().toUpperCase().replace(/\s+/g, "_")

/**
 * @param {string} [pathname]
 * @param {string} [codeOverride]
 * @returns {ReportDefinition | null}
 */
export function resolveReportDefinition(pathname, codeOverride) {
  const currentPath = normalizePath(pathname)
  const codeUpper = codeOverride ? normalizeCode(codeOverride) : ""

  if (codeUpper) {
    const byCode = REPORT_REGISTRY.find((r) => normalizeCode(r.code) === codeUpper)
    if (byCode) return byCode
  }

  if (!currentPath) return null

  let best = null
  for (const report of REPORT_REGISTRY) {
    const reportRoute = normalizePath(report.route)
    const matches =
      currentPath === reportRoute ||
      currentPath.startsWith(`${reportRoute}/`) ||
      reportRoute.startsWith(`${currentPath}/`)
    if (!matches) continue
    if (!best || reportRoute.length > normalizePath(best.route).length) {
      best = report
    }
  }

  return best
}

export function getReportByKey(key) {
  return REPORT_REGISTRY.find((r) => r.key === key) || null
}
