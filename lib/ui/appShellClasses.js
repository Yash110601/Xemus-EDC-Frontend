/**
 * NoveraRM app shell — light clinical platform chrome (sidebar + header).
 * Dashboard page content uses separate tokens in lib/ui/dashboardUi.js.
 */

export const APP_SIDEBAR_CLASS =
  "app-sidebar novera-sidebar relative flex h-[100dvh] w-[17rem] shrink-0 flex-col overflow-hidden border-r border-[#E9EDF2] bg-white text-[#46566B]"

export const APP_SIDEBAR_COLLAPSED_CLASS = "w-[4.875rem]"

export const APP_HEADER_CLASS =
  "app-top-header novera-header flex h-[4.5625rem] items-center justify-between gap-4 border-b border-[#E9EDF2] bg-white px-6 shadow-none"

export const APP_MAIN_CLASS =
  "app-main-area novera-main flex min-h-[100dvh] min-w-0 max-w-full flex-col overflow-x-hidden"

export const APP_PAGE_WRAP_CLASS =
  "novera-page-wrap flex w-full min-w-0 max-w-full flex-1 flex-col"

/** Full-height workspace inside DashboardLayout (designer, data entry, etc.). */
export const APP_VIEWPORT_WORKSPACE_CLASS =
  "flex min-h-0 min-w-0 w-full flex-1 flex-col"

/** Inactive top-level nav row */
export const APP_NAV_ITEM =
  "group relative flex w-full items-center gap-3 rounded-[11px] border-none bg-transparent px-[11px] py-[9px] text-left text-[13.5px] font-medium leading-none tracking-[-0.01em] text-[#46566B] transition-colors duration-150 hover:bg-[#F2F5F8]"

/** Active nav row */
export const APP_NAV_ITEM_ACTIVE =
  "group relative flex w-full items-center gap-3 rounded-[11px] border-none bg-[#E7F6EF] px-[11px] py-[9px] text-left text-[13.5px] font-semibold leading-none tracking-[-0.01em] text-[#0C7E52]"

export const APP_NAV_PARENT =
  "group relative flex w-full items-center justify-between gap-2 rounded-[11px] border-none bg-transparent px-[11px] py-[9px] text-left text-[13.5px] font-medium leading-none tracking-[-0.01em] text-[#46566B] transition-colors duration-150 hover:bg-[#F2F5F8]"

export const APP_NAV_PARENT_ACTIVE =
  "group relative flex w-full items-center justify-between gap-2 rounded-[11px] border-none bg-[#F2F5F8] px-[11px] py-[9px] text-left text-[13.5px] font-medium leading-none tracking-[-0.01em] text-[#101B2D]"

export const APP_NAV_ICON =
  "flex h-[31px] w-[31px] shrink-0 items-center justify-center rounded-[9px] bg-[#F0F3F6] text-[#7C8A9B] transition-colors duration-150 [&>svg]:h-[17px] [&>svg]:w-[17px]"

export const APP_NAV_ICON_ACTIVE =
  "flex h-[31px] w-[31px] shrink-0 items-center justify-center rounded-[9px] bg-[#10A269] text-white shadow-[0_5px_12px_-4px_rgba(16,162,105,0.55)] [&>svg]:h-[17px] [&>svg]:w-[17px]"

export const APP_NAV_ACCENT_BAR =
  "pointer-events-none absolute -left-3 top-1/2 h-[21px] w-[3px] -translate-y-1/2 rounded-r bg-[#10A269]"

export const APP_NAV_CHEVRON =
  "ml-auto flex h-[15px] w-[15px] shrink-0 items-center justify-center text-[#8A98A8] transition-transform duration-200 group-hover:text-[#46566B]"

export const APP_NAV_SUB_WRAP =
  "nav-sub-rail relative my-1 space-y-0 before:absolute before:bottom-[7px] before:left-6 before:top-[3px] before:w-0.5 before:rounded before:bg-[#DBE2E9]"

export const APP_NAV_SUB_ITEM =
  "group relative flex w-full items-center gap-[13px] rounded-[9px] border-none bg-transparent py-[7px] pl-[21px] pr-2.5 text-left text-[13px] font-normal leading-none tracking-[-0.004em] text-[#8A98A8] transition-colors hover:bg-[#F2F5F8] hover:text-[#46566B]"

export const APP_NAV_SUB_ITEM_ACTIVE =
  "group relative flex w-full items-center gap-[13px] rounded-[9px] border-none bg-[#E7F6EF] py-[7px] pl-[21px] pr-2.5 text-left text-[13px] font-semibold leading-none tracking-[-0.004em] text-[#0C7E52]"

export const APP_NAV_SUB_NODE =
  "z-[1] h-[7px] w-[7px] shrink-0 rounded-full border-2 border-[#DBE2E9] bg-white transition-colors group-hover:border-[#8A98A8]"

export const APP_NAV_SUB_NODE_ACTIVE =
  "border-[#10A269] bg-[#10A269] shadow-[0_0_0_3px_#E7F6EF]"

export const APP_SIDEBAR_BRAND =
  "novera-sidebar-brand relative z-[1] flex min-h-[4.5625rem] shrink-0 items-center justify-between gap-2.5 border-b border-[#E9EDF2] px-[18px] py-5"

export const APP_SIDEBAR_USER_CARD =
  "group flex w-full items-center gap-[11px] rounded-none border-0 bg-transparent px-4 py-3.5 text-left transition-colors hover:bg-[#F8FAFB]"

export const APP_CHIP_STUDY_SELECTED =
  "rounded-xl border border-[#D2EEE0] bg-[#E7F6EF] ring-1 ring-[#D2EEE0]/80"

export const APP_CHIP_SITE_SELECTED =
  "rounded-xl border border-[#D2EEE0] bg-[#E7F6EF] ring-1 ring-[#D2EEE0]/80"

export const APP_PRIMARY_BTN =
  "inline-flex items-center justify-center rounded-xl bg-[#10A269] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#0C7E52] disabled:opacity-50"
