/** Shared visual tokens for the eCONSENT module (aligned with report/settings chrome). */

export const EC_PAGE_SHELL =
  "w-full min-w-0 p-3 sm:p-6 min-h-[calc(100dvh-var(--topbar-height,4.5625rem)-1.5rem)]"

export const EC_CARD =
  "overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_36px_-18px_rgba(15,23,42,0.16)]"

export const EC_CARD_PAD = `${EC_CARD} p-5 sm:p-6`

export const EC_SECTION_HEAD =
  "border-b border-slate-100 bg-gradient-to-r from-slate-50/90 via-white to-emerald-50/40 px-5 py-4 sm:px-6"

export const EC_LABEL = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500"

export const EC_FIELD =
  "w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-500"

export const EC_CHECK_ROW =
  "flex items-start gap-3 rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 text-sm font-medium text-slate-800 transition-colors hover:border-emerald-200 hover:bg-emerald-50/40"

export const EC_TABLE_WRAP = "w-full overflow-x-auto"

export const EC_TH =
  "sticky top-0 z-10 whitespace-nowrap border-b border-slate-200 bg-slate-50/95 px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500 backdrop-blur"

export const EC_TD = "px-4 py-3 align-middle text-sm text-slate-700"

export const EC_TR = "border-b border-slate-100 transition-colors hover:bg-slate-50/80"

export const EC_EMPTY =
  "flex flex-col items-center justify-center gap-2 px-6 py-14 text-center text-sm text-slate-500"

export const EC_BADGE_BASE =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"

export function econsentStatusBadge(status) {
  const s = String(status || "").toLowerCase()
  if (s.includes("approved") || s === "published") {
    return `${EC_BADGE_BASE} bg-emerald-100 text-emerald-800`
  }
  if (s.includes("pending") || s.includes("progress") || s.includes("draft")) {
    return `${EC_BADGE_BASE} bg-amber-100 text-amber-900`
  }
  if (s.includes("reject") || s.includes("declin") || s.includes("withdraw")) {
    return `${EC_BADGE_BASE} bg-rose-100 text-rose-800`
  }
  return `${EC_BADGE_BASE} bg-slate-100 text-slate-700`
}

export const MODULE_NAV = [
  { href: "/econsent/forms", label: "Consent forms", hint: "Templates & versions" },
  { href: "/econsent/rules", label: "Rules", hint: "Jurisdiction & assignment" },
  { href: "/econsent/setup", label: "Setup", hint: "OTP · photo · signature" },
  { href: "/econsent/subjects", label: "Subjects", hint: "Invite & approve" },
  { href: "/econsent/audit", label: "Audit", hint: "Event history" },
]
