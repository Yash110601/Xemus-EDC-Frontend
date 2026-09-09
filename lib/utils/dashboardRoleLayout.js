/**
 * Dashboard layout profiles by role.
 *
 * Layouts:
 * - crc          → PI / CRC: hero Planned vs Actual + patient status + visit
 * - cra          → CRA / PM / Medical Monitor / Support: query + patient status panels
 * - endoscopist  → Endoscopist / Pathologist: planned vs actual + multi-CRF
 * - sponsor_pm   → Sponsor / CRM: full-width Patient Status
 * - admin        → Admin / Super Admin: full dashboard
 */

export const DASHBOARD_LAYOUT = Object.freeze({
  CRC: "crc",
  CRA: "cra",
  ENDOSCOPIST: "endoscopist",
  SPONSOR_PM: "sponsor_pm",
  ADMIN: "admin",
})

/** Role code or normalized role name → dashboard layout key */
const ROLE_TO_LAYOUT = Object.freeze({
  CRC: DASHBOARD_LAYOUT.CRC,
  PI: DASHBOARD_LAYOUT.CRC,
  PRINCIPALINVESTIGATOR: DASHBOARD_LAYOUT.CRC,

  CRA: DASHBOARD_LAYOUT.CRA,
  PM: DASHBOARD_LAYOUT.CRA,
  PROJECTMANAGER: DASHBOARD_LAYOUT.CRA,
  MM: DASHBOARD_LAYOUT.CRA,
  MEDICALMONITOR: DASHBOARD_LAYOUT.CRA,
  SUPPORT: DASHBOARD_LAYOUT.CRA,

  SPONSOR: DASHBOARD_LAYOUT.SPONSOR_PM,
  CRM: DASHBOARD_LAYOUT.SPONSOR_PM,

  ENDOSCOPIST: DASHBOARD_LAYOUT.ENDOSCOPIST,
  PATHOLOGIST: DASHBOARD_LAYOUT.ENDOSCOPIST,

  ADMIN: DASHBOARD_LAYOUT.ADMIN,
  SUPERADMIN: DASHBOARD_LAYOUT.ADMIN,
})

function normalizeRoleCode(user) {
  return (user?.roleCode ?? user?.RoleCode ?? "")
    .toString()
    .trim()
    .toUpperCase()
}

function normalizeRoleNameNoSpaces(user) {
  return (user?.roleName ?? user?.RoleName ?? user?.roleCode ?? user?.RoleCode ?? "")
    .toString()
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
}

function normalizeRoleNameUpper(user) {
  return (user?.roleName ?? user?.RoleName ?? user?.roleCode ?? user?.RoleCode ?? "")
    .toString()
    .trim()
    .toUpperCase()
}

/**
 * Resolve which dashboard layout profile applies.
 */
export function resolveDashboardLayoutKey(user) {
  const code = normalizeRoleCode(user)
  const nameNoSpaces = normalizeRoleNameNoSpaces(user)
  const nameUpper = normalizeRoleNameUpper(user)

  if (code && ROLE_TO_LAYOUT[code]) return ROLE_TO_LAYOUT[code]
  if (nameNoSpaces && ROLE_TO_LAYOUT[nameNoSpaces]) return ROLE_TO_LAYOUT[nameNoSpaces]

  if (nameUpper.includes("ENDOSCOPIST") || nameUpper.includes("PATHOLOGIST")) {
    return DASHBOARD_LAYOUT.ENDOSCOPIST
  }
  if (nameUpper.includes("PRINCIPAL") && nameUpper.includes("INVESTIGATOR")) {
    return DASHBOARD_LAYOUT.CRC
  }
  if (nameUpper.includes("PROJECT") && nameUpper.includes("MANAGER")) {
    return DASHBOARD_LAYOUT.CRA
  }
  if (nameUpper.includes("MEDICAL") && nameUpper.includes("MONITOR")) {
    return DASHBOARD_LAYOUT.CRA
  }
  if (nameUpper.includes("SPONSOR")) {
    return DASHBOARD_LAYOUT.SPONSOR_PM
  }
  if (nameUpper.includes("SUPER") && nameUpper.includes("ADMIN")) {
    return DASHBOARD_LAYOUT.ADMIN
  }
  if (nameUpper === "ADMIN" || nameUpper.includes("ADMIN")) {
    return DASHBOARD_LAYOUT.ADMIN
  }
  if (nameUpper.includes("CRM")) {
    return DASHBOARD_LAYOUT.SPONSOR_PM
  }
  if (nameUpper.includes("SUPPORT")) {
    return DASHBOARD_LAYOUT.CRA
  }

  return DASHBOARD_LAYOUT.ADMIN
}

/**
 * UI flags consumed by app/dashboard/page.jsx.
 * @param {object | null | undefined} user
 */
export function getDashboardRoleProfile(user) {
  const layoutKey = resolveDashboardLayoutKey(user)
  const isCrcOnly = layoutKey === DASHBOARD_LAYOUT.CRC
  const isCra = layoutKey === DASHBOARD_LAYOUT.CRA
  const isEndoscopistOrPathologist = layoutKey === DASHBOARD_LAYOUT.ENDOSCOPIST
  const isSponsorPmCombined = layoutKey === DASHBOARD_LAYOUT.SPONSOR_PM
  const isAdminFullDashboard = layoutKey === DASHBOARD_LAYOUT.ADMIN

  const roleCodeNorm = normalizeRoleCode(user)
  const roleNameNoSpaces = normalizeRoleNameNoSpaces(user)
  const roleNameUpper = normalizeRoleNameUpper(user)

  const isAdmin = roleCodeNorm === "ADMIN" || roleNameNoSpaces === "ADMIN"
  const isSuperAdmin = roleCodeNorm === "SUPERADMIN" || roleNameNoSpaces === "SUPERADMIN"
  const isCrm = roleCodeNorm === "CRM" || roleNameNoSpaces === "CRM" || roleNameUpper.includes("CRM")
  const isAdminOrSuperAdmin = isAdmin || isSuperAdmin

  const hideAllChartsExceptPlannedVsActual = isEndoscopistOrPathologist

  /** CRC hero — Sponsor uses full-width Patient Status instead */
  const isHeroPlannedVsActualLayout = isCrcOnly

  /** Sponsor + CRM: Patient Status chart full width (no Query Management side panel) */
  const showSponsorPatientStatusFull = isSponsorPmCombined

  /** Agreement KPI chip — Admin / Super Admin only */
  const showAgreementKpi = isAdminOrSuperAdmin

  /** CRC / CRA / Sponsor / CRM site-style KPIs — hide Total Users & admin-only pies */
  const isCrcSiteRole = isCrcOnly || isCra || isSponsorPmCombined

  const showQueryManagement =
    !isSponsorPmCombined &&
    (isAdminOrSuperAdmin ||
      isCrm ||
      isEndoscopistOrPathologist ||
      isCra ||
      isCrcOnly)

  const showCrcDashboardInsights = isCrcOnly
  const showCrcVisitChart = isCrcOnly

  return {
    layoutKey,
    isCrcOnly,
    isCra,
    isCrcSiteRole,
    isEndoscopistOrPathologist,
    isSponsorPmCombined,
    isAdminFullDashboard,
    isAdminOrSuperAdmin,
    hideAllChartsExceptPlannedVsActual,
    isHeroPlannedVsActualLayout,
    showSponsorPatientStatusFull,
    showAgreementKpi,
    showCraDashboardInsights: isCra,
    showCrcDashboardInsights,
    showCrcVisitChart,
    /** Admin / Super Admin also get Total Subjects (site status) chart */
    showAdminTotalSubjects: isAdminFullDashboard,
    showThirdChartRow: !isCrcOnly && !isCra && !isSponsorPmCombined,
    showQueryManagement,
  }
}

/**
 * Admin / Super Admin header uses compact funnel filter (not Study/Site boxes).
 * @param {{ roleName?: string, userRole?: string, roleCode?: string }} roles
 */
export function usesCompactStudySiteFilter({ roleName, userRole, roleCode } = {}) {
  const code = (roleCode ?? "").toString().trim().toUpperCase()
  if (code === "ADMIN" || code === "SUPERADMIN") return true

  const name = (roleName ?? userRole ?? "").toString().trim().toLowerCase()
  const compact = name.replace(/\s+/g, "")
  if (compact === "admin" || compact === "superadmin") return true
  if (name.includes("super admin") || name.includes("superadmin")) return true
  if (name.includes("admin")) return true

  return false
}

/** Pie chart colors — PI shares CRC; PM shares Sponsor */
export function getUsersByRoleChartColor(roleCode) {
  const code = (roleCode || "").toString().trim().toUpperCase()
  if (code === "CRC" || code === "PI") return "#06b6d4"
  if (code === "CRM") return "#8b5cf6"
  if (code === "MM") return "#0ea5e9"
  if (code === "SPONSOR" || code === "PM") return "#f59e0b"
  return "#6366f1"
}
