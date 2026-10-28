export const PLATFORM_PREVIEW_ENABLED =
  process.env.NEXT_PUBLIC_PLATFORM_PREVIEW === "true"

export const PLATFORM_CARD = "rounded-lg border border-slate-200 bg-white shadow-sm"
export const PLATFORM_CARD_PAD = "p-5"
export const PLATFORM_PAGE_SHELL = "mx-auto w-full max-w-6xl space-y-6 px-4 py-6"
export const PLATFORM_FIELD = "space-y-1.5"
export const PLATFORM_EMPTY = "rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500"

/** Match Xemus sidebar / APP_NAV_* soft lavender chrome. */
export const PLATFORM_ICON_CHIP =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EDE7F6] text-[#3D2F63]"
export const PLATFORM_PREVIEW_BANNER =
  "rounded-lg border border-[#DDD4F0] bg-[#EDE7F6]/70 px-4 py-3 text-sm text-[#3D2F63]"
export const PLATFORM_SUB_NAV =
  "inline-flex max-w-full flex-wrap gap-1 rounded-[11px] border border-[#E9EDF2] bg-[#F8FAFB] p-1"
export const PLATFORM_SUB_NAV_ITEM =
  "inline-flex min-h-[34px] items-center rounded-[9px] px-3 py-2 text-sm font-medium leading-none transition-colors"
export const PLATFORM_SUB_NAV_ITEM_ACTIVE =
  "bg-[#EDE7F6] font-semibold text-[#3D2F63] shadow-[inset_0_0_0_1px_#DDD4F0]"
export const PLATFORM_SUB_NAV_ITEM_INACTIVE =
  "text-[#46566B] hover:bg-[#F5F2FA] hover:text-[#101B2D]"
export const PLATFORM_PRIMARY_BTN =
  "rounded-md bg-[#7C6BB5] px-4 py-2 text-sm font-medium text-white hover:bg-[#3D2F63] disabled:opacity-50"
export const PLATFORM_PRIMARY_BTN_SM =
  "rounded-md bg-[#7C6BB5] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#3D2F63] disabled:opacity-50"
export const PLATFORM_SECONDARY_BTN =
  "rounded-md border border-[#DDD4F0] bg-white px-3 py-1.5 text-sm font-medium text-[#3D2F63] shadow-sm hover:bg-[#EDE7F6] disabled:opacity-50"
export const PLATFORM_GHOST_BTN =
  "rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
export const PLATFORM_OUTLINE_BTN =
  "rounded-md border border-[#7C6BB5] px-4 py-2 text-sm font-medium text-[#3D2F63] hover:bg-[#EDE7F6] disabled:opacity-50"
export const PLATFORM_PHASE_BANNER = "rounded-lg border border-[#DDD4F0] bg-[#EDE7F6] p-4"
export const PLATFORM_PHASE_BANNER_SOFT = "rounded-lg border border-[#DDD4F0] bg-[#EDE7F6]/70 p-4"
export const PLATFORM_PHASE_BANNER_TITLE = "text-sm font-medium text-[#3D2F63]"
export const PLATFORM_PHASE_BANNER_LABEL =
  "mb-2 text-xs font-medium uppercase tracking-wide text-[#3D2F63]"
export const PLATFORM_PHASE_BANNER_TEXT = "mt-1 text-xs text-[#46566B]"
export const PLATFORM_PHASE_BANNER_HINT = "mt-2 text-xs text-[#46566B]"
export const PLATFORM_LINK = "text-[#7C6BB5] hover:text-[#3D2F63] hover:underline"
export const PLATFORM_LINK_BTN = PLATFORM_LINK

export function isPlatformNavActive(pathname, href) {
  if (!pathname || !href) return false
  if (pathname === href) return true
  return pathname.startsWith(`${href}/`)
}

/** Admin-only tabs under Clinical Platform (modules, integration, SSO, roadmap). */
export const PLATFORM_ADMIN_NAV = [
  { href: "/platform/modules", label: "Modules", code: "PLATFORM_MODULES" },
  { href: "/platform/integration", label: "Integration hub", code: "PLATFORM_INTEGRATION" },
  { href: "/platform/sso", label: "SSO", code: "PLATFORM_SSO" },
  { href: "/platform/roadmap", label: "Roadmap", code: "PLATFORM_ROADMAP" },
]

/** Contextual sub-nav shown inside a module page (not global cross-module tabs). */
export const FEATURE_SUB_NAV = {
  SAFETY: [
    { href: "/platform/safety/reports", label: "SAE reports", code: "SAFETY_REPORTS" },
    { href: "/platform/safety/regulatory", label: "Regulatory inbox", code: "SAFETY_REGULATORY" },
  ],
}

export function getContextNavForPath(pathname) {
  if (!pathname?.startsWith("/platform")) return []

  if (
    pathname.startsWith("/platform/modules") ||
    pathname.startsWith("/platform/integration") ||
    pathname.startsWith("/platform/sso") ||
    pathname.startsWith("/platform/roadmap") ||
    pathname === "/platform"
  ) {
    return PLATFORM_ADMIN_NAV
  }
  if (pathname.startsWith("/platform/safety")) return FEATURE_SUB_NAV.SAFETY

  return []
}

export const ROADMAP_MODULES = [
  { code: "INTEGRATION_HUB", name: "Integration hub", phase: "Phase 0", note: "Outbound webhooks for enterprise listeners" },
  { code: "SSO", name: "SSO (SAML/OIDC)", phase: "Phase 0", note: "Enterprise login — config placeholder; password login unchanged" },
  { code: "IWRS_RTSM", name: "Enterprise IWRS (RTSM)", phase: "Phase 0", note: "Inbound RTSM webhooks from Enterprise IWRS (per-study toggle)" },
  { code: "SAFETY", name: "Safety / SAE", phase: "Phase 4", note: "SAE workflow with regulatory timers and overdue queue" },
]
