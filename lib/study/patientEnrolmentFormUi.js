import { cn } from "@/lib/utils"

export const PE_SHELL_CARD_CLASS =
  "overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-[0_20px_50px_-28px_rgba(15,23,42,0.16)] backdrop-blur-sm"

export const PE_TAB_BAR_CLASS =
  "flex overflow-x-auto border-b border-emerald-100/80 bg-gradient-to-r from-slate-50/90 via-emerald-50/40 to-teal-50/30"

export function peTabClass(active) {
  return cn(
    "relative flex-1 whitespace-nowrap px-5 py-3.5 text-sm font-semibold transition-all sm:px-6 sm:py-4 sm:text-base",
    active
      ? "bg-white/90 text-emerald-700"
      : "text-slate-600 hover:bg-white/50 hover:text-slate-800",
  )
}

export const PE_TAB_ACTIVE_BAR_CLASS =
  "absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500"

export const PE_PANEL_CLASS = "p-5 sm:p-6 lg:p-8"

export const PE_SECTION_HEADER_CLASS =
  "mb-6 flex items-center gap-3 border-b border-emerald-100/80 pb-4"

/** Use on every section after the first so form blocks don’t sit flush. */
export const PE_SECTION_FOLLOWING_CLASS =
  "mt-10 border-t border-slate-200/90 pt-8 sm:mt-12 sm:pt-10"

export const PE_SECTION_ICON_CLASS =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm shadow-emerald-900/10"

export const PE_FORM_GRID_CLASS = "grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6"

export const PE_LABEL_CLASS = "mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700"

export const PE_REQUIRED_CLASS = "text-emerald-600 font-bold"

export const PE_HINT_CLASS = "mt-1.5 text-xs font-medium text-slate-500"

export const PE_INPUT_CLASS =
  "w-full min-h-[48px] rounded-xl border border-slate-200 bg-white/90 px-4 py-3 text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"

export const PE_INPUT_ERROR_CLASS =
  "border-amber-300/90 bg-amber-50/40 focus:border-amber-500 focus:ring-amber-500/10"

export const PE_FOOTER_CLASS =
  "mt-8 flex flex-col-reverse gap-3 border-t border-slate-200/80 pt-6 sm:flex-row sm:justify-end sm:gap-4"

export const PE_BTN_CLEAR_CLASS =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"

export const PE_BTN_SUBMIT_CLASS =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-900/15 transition-all hover:from-emerald-700 hover:to-teal-700 hover:shadow-lg disabled:opacity-50"

export const PE_ALERT_SUCCESS_CLASS =
  "mb-5 flex items-center gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3"

export const PE_ALERT_ERROR_CLASS =
  "mb-5 flex items-center gap-3 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3"

export const PE_ALERT_WARN_CLASS =
  "mb-5 flex items-start gap-3 rounded-xl border border-amber-200/70 bg-amber-50/60 px-4 py-3"
