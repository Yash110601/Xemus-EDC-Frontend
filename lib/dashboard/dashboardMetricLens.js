/**
 * Apply study/site selection app-wide (matches top-header StudySiteSelector behavior).
 */
export function applyDashboardStudyContext(study, site = null, { isAdmin = false } = {}) {
  if (typeof window === "undefined" || !study) return null

  const studyId = study.studyId ?? study.id ?? study.StudyId
  if (!studyId) return null

  const protocolNumber =
    study.studyProtocolNumber ||
    study.protocolNumber ||
    study.name ||
    study.projectName ||
    study.code ||
    `Study ${studyId}`
  const studyTitle = (study.studyTitle || study.StudyTitle || "").toString()

  if (!isAdmin) {
    localStorage.setItem("selectedStudy", protocolNumber)
    localStorage.setItem("selectedStudyId", String(studyId))
    localStorage.setItem("selectedStudyTitle", studyTitle)
  }

  window.dispatchEvent(new CustomEvent("studySelected", { detail: { studyId } }))

  let siteId = null
  if (site) {
    siteId = site.siteId ?? site.id ?? site.SiteId
    const siteName = site.siteName || site.SiteName || `Site ${siteId}`
    if (!isAdmin) {
      localStorage.setItem("selectedSite", siteName)
      localStorage.setItem("selectedSiteId", String(siteId))
    }
    window.dispatchEvent(new CustomEvent("studySiteChanged", { detail: { studyId, siteId } }))
  } else if (isAdmin) {
    window.dispatchEvent(new CustomEvent("studySiteChanged", { detail: { studyId, siteId: null } }))
  }

  return { studyId, siteId, protocolNumber, studyTitle }
}

export function isDashboardAdminUser(user) {
  const role = (user?.roleName || user?.roleCode || "").toString().trim().toUpperCase()
  return role === "ADMIN" || role === "SUPERADMIN" || role === "SUPER ADMIN"
}

export function isDashboardSuperAdminUser(user) {
  const code = (user?.roleCode ?? user?.RoleCode ?? "").toString().trim().toUpperCase()
  if (code === "SUPERADMIN") return true

  const name = (user?.roleName ?? user?.RoleName ?? "").toString().trim().toUpperCase()
  const compact = name.replace(/\s+/g, "")
  if (compact === "SUPERADMIN") return true
  return name.includes("SUPER") && name.includes("ADMIN")
}

function studyIdOf(study) {
  return study?.studyId ?? study?.id ?? study?.StudyId ?? null
}

function studyLabel(study) {
  const protocol =
    study?.studyProtocolNumber ||
    study?.protocolNumber ||
    study?.name ||
    study?.code ||
    (studyIdOf(study) ? `Study ${studyIdOf(study)}` : "Study")
  const title = study?.studyTitle || study?.StudyTitle || ""
  return { protocol, title, subtitle: title ? `${protocol} · ${title}` : protocol }
}

function normalizeStudies(assignedStudies, dashboardData) {
  const fromAssigned = Array.isArray(assignedStudies) ? assignedStudies : []
  const fromDashboard = dashboardData?.assignedStudySiteDetails?.studies
  const merged = fromAssigned.length > 0 ? fromAssigned : Array.isArray(fromDashboard) ? fromDashboard : []
  const seen = new Set()
  return merged.filter((s) => {
    const id = studyIdOf(s)
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })
}

function isStudyActive(study) {
  const v = study?.isActive ?? study?.IsActive
  return v === undefined || v === null ? true : Boolean(v)
}

function sitesForStudy(study) {
  return Array.isArray(study?.sites) ? study.sites : Array.isArray(study?.Sites) ? study.Sites : []
}

export const DASHBOARD_LENS_ACTIONS = {
  configureStudy: { id: "configureStudy", label: "Study setup", href: "/study-management/study-configuration" },
  siteConfig: { id: "siteConfig", label: "Sites", href: "/study-management/site-configuration" },
  patients: { id: "patients", label: "Patients", href: "/patient-enrolment" },
  visits: { id: "visits", label: "Visits", href: "/visit-configuration/manage" },
  ecrf: { id: "ecrf", label: "eCRF design", href: "/ecrf-form-designer/manage" },
  agreement: { id: "agreement", label: "Agreements", href: "/agreement-setup/manage" },
  users: { id: "users", label: "Users", href: "/masters/user-creation" },
  userReport: { id: "userReport", label: "User report", href: "/reports/export-user-details" },
  patientReport: { id: "patientReport", label: "Patient report", href: "/reports/export-patient-details" },
  studyReport: { id: "studyReport", label: "Study report", href: "/reports/export-study-details" },
  siteReport: { id: "siteReport", label: "Site report", href: "/reports/export-site-details" },
  visitReport: { id: "visitReport", label: "Visit report", href: "/reports/export-visit-details" },
  ecrfReport: { id: "ecrfReport", label: "eCRF report", href: "/reports/export-ecrf-details" },
  agreementReport: { id: "agreementReport", label: "Agreement report", href: "/reports/export-agreement-report" },
}

const LENS_META = {
  study: {
    title: "Studies",
    description: "Browse assigned studies and jump into configuration or enrolment.",
    primaryHref: "/study-management/study-configuration",
    primaryLabel: "Open study configuration",
    itemActions: ["configureStudy", "siteConfig", "patients", "studyReport"],
  },
  sites: {
    title: "Sites",
    description: "Every site across your studies — select one to continue in context.",
    primaryHref: "/study-management/site-configuration",
    primaryLabel: "Open site configuration",
    itemActions: ["siteConfig", "patients", "siteReport"],
  },
  agreement: {
    title: "Agreements",
    description: "Studies with agreement workflows — open setup or reports.",
    primaryHref: "/agreement-setup/manage",
    primaryLabel: "Agreement management",
    itemActions: ["agreement", "agreementReport", "configureStudy"],
  },
  visit: {
    title: "Visits",
    description: "Visit schedules and configuration per study.",
    primaryHref: "/visit-configuration/manage",
    primaryLabel: "Visit configuration",
    itemActions: ["visits", "visitReport", "patients"],
  },
  users: {
    title: "Users",
    description: "Role distribution and user management entry points.",
    primaryHref: "/masters/user-creation",
    primaryLabel: "User management",
    itemActions: ["users", "userReport"],
    isRoleLens: true,
  },
  ecrf: {
    title: "eCRF designs",
    description: "Form designs linked to your studies.",
    primaryHref: "/ecrf-form-designer/manage",
    primaryLabel: "eCRF form designer",
    itemActions: ["ecrf", "ecrfReport", "patients"],
  },
  patients: {
    title: "Enrolled patients",
    description: "Open patient enrolment in the right study context.",
    primaryHref: "/patient-enrolment",
    primaryLabel: "Patient enrolment",
    itemActions: ["patients", "patientReport", "visits"],
  },
  active: {
    title: "Active studies",
    description: "Currently active studies in your portfolio.",
    primaryHref: "/study-management/study-configuration",
    primaryLabel: "Manage active studies",
    itemActions: ["configureStudy", "patients", "studyReport"],
    filterActiveOnly: true,
  },
}

export function buildDashboardMetricLens(lensKey, context) {
  const meta = LENS_META[lensKey] || LENS_META.study
  const studies = normalizeStudies(context.assignedStudies, context.dashboardData)
  const filteredStudies = meta.filterActiveOnly ? studies.filter(isStudyActive) : studies

  if (meta.isRoleLens) {
    const roles = context.chartData?.usersByRole || []
    return {
      key: lensKey,
      ...meta,
      total: context.summaryCounts?.userTotal ?? roles.reduce((s, r) => s + (Number(r.value) || 0), 0),
      items: roles.map((role, index) => ({
        id: `role-${role.name}-${index}`,
        kind: "role",
        title: role.name || "Role",
        subtitle: `${role.value ?? 0} users`,
        meta: role.value ?? 0,
        study: null,
        site: null,
      })),
    }
  }

  if (lensKey === "sites") {
    const siteItems = []
    for (const study of filteredStudies) {
      for (const site of sitesForStudy(study)) {
        const siteId = site.siteId ?? site.id ?? site.SiteId
        if (!siteId) continue
        const { protocol, title } = studyLabel(study)
        siteItems.push({
          id: `site-${studyIdOf(study)}-${siteId}`,
          kind: "site",
          title: site.siteName || site.SiteName || `Site ${siteId}`,
          subtitle: title ? `${protocol} · ${title}` : protocol,
          meta: site.enrolledPatients != null ? `${site.enrolledPatients ?? 0} enrolled` : null,
          study,
          site,
        })
      }
    }
    return {
      key: lensKey,
      ...meta,
      total: siteItems.length,
      items: siteItems,
    }
  }

  const items = filteredStudies.map((study) => {
    const { protocol, title } = studyLabel(study)
    const siteCount = sitesForStudy(study).length
    return {
      id: `study-${studyIdOf(study)}`,
      kind: "study",
      title: protocol,
      subtitle: title || protocol,
      meta: siteCount > 0 ? `${siteCount} site${siteCount === 1 ? "" : "s"}` : null,
      study,
      site: null,
    }
  })

  return {
    key: lensKey,
    ...meta,
    total: items.length,
    items,
  }
}

export function getLensItemActions(lens) {
  const ids = lens?.itemActions || []
  return ids.map((id) => DASHBOARD_LENS_ACTIONS[id]).filter(Boolean)
}
