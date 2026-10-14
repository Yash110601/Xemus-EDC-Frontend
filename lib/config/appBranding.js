/**
 * Xemus app shell branding (login, sidebar, headers).
 * App shell branding (login, sidebar, headers). PDF / legal org details: orgBranding.js.
 */

export const APP_BRANDING = {
  productName: "Xemus",
  /** Shown on exported PDF headers/disclaimers (reports, CRF printouts). */
  pdfProductName: "Xemus EDC",
  tagline: "Healthtech Solutions for Clinical Trials",
  platformTitle: "Electronic Data Capture Platform",
  platformDescription: "Electronic Data Capture",
  badgeLabel: "Clinical Data Platform",
  loginOverline: "Electronic Data Capture",
  loginHeadline: "A Unified eClinical Platform Built To Simplify and Modernize Clinical Trials",
  loginSubheadline: "Secure, validated, audit-ready.",
  complianceLabels: ["21 CFR Part 11", "ICH GCP", "HIPAA", "GDPR"],
  /** Vector wordmark — preferred for UI (crisp, transparent). */
  logoPath: "/images/xemus-logo.svg",
  /** Same lockup for login / light panels. */
  loginLogoPath: "/images/xemus-logo.svg",
  /** Icon-only mark for compact chrome. */
  logoMarkPath: "/images/xemus-mark.svg",
  /** Raster fallback for PDF / email / places that prefer PNG. */
  logoRasterPath: "/images/xemus-logo-light.png",
  logoDarkPath: "/images/xemus-logo-dark.png",
  logoOnDarkPath: "/images/xemus-logo-on-dark.svg",
  logoAlt: "Xemus — Healthtech Solutions for Clinical Trials",
  copyright: "© 2026 Xemus",
  supportEmail: "info.solutions@xemus.com",
  supportUrl: "mailto:info.solutions@xemus.com",
  features: [
    { title: "21 CFR Part 11", description: "Audit trail & electronic signatures" },
    { title: "GCP aligned workflows", description: "Study conduct best practices" },
    { title: "Role-based access", description: "Granular permissions per site" },
  ],
}
