/** Shared visual tokens for the Remote SDV module. */

export const RSDV_PAGE_SHELL =
  "w-full min-w-0 p-3 sm:p-6 min-h-[calc(100dvh-var(--topbar-height,4.5625rem)-1.5rem)]"

export const RSDV_CARD =
  "overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_36px_-18px_rgba(15,23,42,0.16)]"

export const RSDV_CARD_PAD = `${RSDV_CARD} p-5 sm:p-6`

export const RSDV_SECTION_HEAD =
  "border-b border-slate-100 bg-gradient-to-r from-slate-50/90 via-white to-emerald-50/40 px-5 py-4 sm:px-6"

export const RSDV_TABLE_WRAP = "w-full overflow-x-auto"

export const RSDV_TH =
  "sticky top-0 z-10 whitespace-nowrap border-b border-slate-200 bg-slate-50/95 px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500 backdrop-blur"

export const RSDV_TD = "px-4 py-3 align-middle text-sm text-slate-700"

export const RSDV_TR = "border-b border-slate-100 transition-colors hover:bg-slate-50/80"

export const RSDV_EMPTY =
  "flex flex-col items-center justify-center gap-2 px-6 py-14 text-center text-sm text-slate-500"

/** Primary action — emerald brand. */
export const RSDV_BTN_PRIMARY =
  "rounded-xl bg-violet-600 text-white shadow-sm hover:bg-violet-700 focus-visible:ring-violet-500"

/** Secondary / outline — emerald tint. */
export const RSDV_BTN_SECONDARY =
  "rounded-xl border-emerald-300 bg-emerald-50 text-emerald-800 shadow-sm hover:bg-emerald-100 hover:text-emerald-900"

/** Neutral outline with hover. */
export const RSDV_BTN_OUTLINE =
  "rounded-xl border-slate-200 bg-white text-slate-700 shadow-sm hover:border-emerald-200 hover:bg-emerald-50/60 hover:text-emerald-800"

/** Query / action accent. */
export const RSDV_BTN_SKY = "rounded-xl bg-sky-600 text-white shadow-sm hover:bg-sky-700"

export const RSDV_COMPARE_TOOLBAR =
  "shrink-0 border-b border-emerald-100/90 bg-gradient-to-r from-emerald-50/95 via-white to-teal-50/40 px-3 py-3 shadow-[0_4px_24px_-12px_rgba(16,185,129,0.25)] sm:px-4"

export const RSDV_CONTEXT_FIELD_STYLES = {
  site: {
    card: "border-teal-200/90 bg-gradient-to-br from-teal-50 to-white shadow-sm",
    label: "text-teal-600",
    value: "text-teal-950",
  },
  patientId: {
    card: "border-blue-200/90 bg-gradient-to-br from-blue-50 to-white shadow-sm",
    label: "text-blue-600",
    value: "text-blue-950",
  },
  initial: {
    card: "border-violet-200/90 bg-gradient-to-br from-violet-50 to-white shadow-sm",
    label: "text-violet-600",
    value: "text-violet-950",
  },
  visit: {
    card: "border-amber-200/90 bg-gradient-to-br from-amber-50 to-white shadow-sm",
    label: "text-amber-700",
    value: "text-amber-950",
  },
}
