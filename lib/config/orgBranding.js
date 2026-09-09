/**
 * Organization branding — single source of truth for CRF PDF headers, exports, and legal copy.
 */
import { APP_BRANDING } from "@/lib/config/appBranding"

const ORG_ADDRESS_SINGLE_LINE =
  "First Floor, E-83, Pushpdeep, Saraspur, Ahmedabad, Gujarat, India — 380018"

export const ORG_BRANDING = {
  orgName: APP_BRANDING.productName,
  orgDisplayName: APP_BRANDING.productName,
  orgShortName: APP_BRANDING.productName,
  orgAddressSingleLine: ORG_ADDRESS_SINGLE_LINE,
  orgAddress:
    "First Floor, E-83, Pushpdeep, Saraspur,\nAhmedabad, Gujarat, India — 380018",
  /** Prefer raster for PDF/canvas exports (SVG may not embed reliably). */
  logoPath: APP_BRANDING.logoRasterPath || APP_BRANDING.logoPath,
  contactEmail: APP_BRANDING.supportEmail,
}

/** Default org fields for CRF PDF export flows. */
export function getDefaultCrfOrgMeta() {
  return {
    orgName: ORG_BRANDING.orgDisplayName,
    orgAddress: ORG_BRANDING.orgAddress,
    logoUrl: ORG_BRANDING.logoPath,
    orgLogoUrl: ORG_BRANDING.logoPath,
  }
}
