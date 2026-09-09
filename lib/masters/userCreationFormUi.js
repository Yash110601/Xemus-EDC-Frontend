import { cn } from "@/lib/utils"
import {
  MOBILE_TABLE_HINT_CLASS,
  MOBILE_TABLE_SCROLL_CLASS,
  PAGE_CANVAS_BLEED_CLASS,
  PAGE_CANVAS_PADDING_CLASS,
} from "@/lib/ui/responsivePageUi"

/** Page canvas — soft mesh behind the main card (matches original user-master look). */
export const USER_MASTER_PAGE_CANVAS_CLASS = cn(
  "w-full min-h-full bg-gradient-to-br from-blue-50/40 via-white to-emerald-50/35",
  PAGE_CANVAS_BLEED_CLASS,
  PAGE_CANVAS_PADDING_CLASS,
)

export const USER_MASTER_CARD_CLASS =
  "overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_20px_50px_-28px_rgba(15,23,42,0.18)]"

export const USER_MASTER_TAB_BAR_CLASS =
  "flex overflow-x-auto overscroll-x-contain border-b-2 border-slate-200 bg-slate-50/80 [-webkit-overflow-scrolling:touch]"

export function userMasterTabClass(active) {
  return cn(
    "relative shrink-0 whitespace-nowrap px-4 py-3 text-sm font-bold transition-all sm:px-6 sm:py-4 sm:text-base",
    active ? "bg-white text-emerald-600" : "text-slate-600 hover:bg-white/60 hover:text-slate-800",
  )
}

export const USER_MASTER_TAB_ACTIVE_BAR_CLASS =
  "absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r btn-brand-gradient"

export const USER_MASTER_PANEL_CLASS =
  "min-w-0 bg-gradient-to-br from-white via-white to-slate-50/50 p-4 sm:p-6 lg:p-8"

/** Horizontal scroll for wide manage/import tables inside the card. */
export const USER_MASTER_TABLE_SCROLL_CLASS = MOBILE_TABLE_SCROLL_CLASS

export const USER_MASTER_TABLE_HINT_CLASS = MOBILE_TABLE_HINT_CLASS

export const USER_MASTER_MANAGE_USERS_TABLE_CLASS = "w-full min-w-[1080px]"

export const USER_MASTER_MANAGE_CRC_TABLE_CLASS = "w-full min-w-[1200px]"

export const USER_MASTER_FORM_GRID_CLASS = "grid grid-cols-1 gap-6 md:grid-cols-2"

export const USER_MASTER_FORM_LABEL_CLASS = "mb-2.5 block text-sm font-semibold text-slate-700"

export const USER_MASTER_FORM_HINT_CLASS = "mt-1.5 text-xs font-medium text-slate-500"

export const USER_MASTER_FORM_INPUT_CLASS =
  "w-full min-h-[50px] rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"

export const USER_MASTER_FORM_SELECT_CLASS =
  "w-full min-h-[50px] rounded-xl border border-slate-300 bg-white px-4 py-3 shadow-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"

export const USER_MASTER_ALERT_SUCCESS_CLASS =
  "flex items-center gap-3 rounded-lg border-l-4 border-emerald-500 bg-gradient-to-r from-emerald-50 to-green-50 p-4 shadow-sm"

export const USER_MASTER_ALERT_ERROR_CLASS =
  "flex items-center gap-3 rounded-lg border-l-4 border-red-500 bg-gradient-to-r from-red-50 to-rose-50 p-4 shadow-sm"

export const USER_MASTER_ACTIONS_CLASS =
  "flex flex-col-reverse justify-end gap-4 border-t border-slate-200 pt-6 sm:flex-row"

export const USER_MASTER_BTN_CLEAR_CLASS =
  "rounded-xl border-2 border-slate-300 px-8 py-3 font-semibold text-slate-700 transition-all hover:border-slate-400 hover:bg-slate-50"

export const USER_MASTER_BTN_SUBMIT_CLASS =
  "rounded-xl bg-gradient-to-r btn-brand-gradient px-8 py-3 font-semibold text-white shadow-lg shadow-emerald-200 transition-all hover:shadow-xl hover:shadow-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
