/** Shared viewport-safe page shells (mobile / tablet / desktop). */

export const VIEWPORT_PAGE_MIN_HEIGHT_CLASS =
  "min-h-[calc(100dvh-var(--topbar-height,4.5625rem)-1.5rem)]"

export const VIEWPORT_PAGE_SHELL_CLASS =
  `w-full min-w-0 p-3 sm:p-6 ${VIEWPORT_PAGE_MIN_HEIGHT_CLASS}`

export const VIEWPORT_PAGE_SHELL_BG_CLASS =
  "bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50"

export const VIEWPORT_PAGE_SHELL_WITH_BG_CLASS =
  `${VIEWPORT_PAGE_SHELL_CLASS} ${VIEWPORT_PAGE_SHELL_BG_CLASS}`

export const VIEWPORT_PAGE_SHELL_EMERALD_BG_CLASS =
  "bg-gradient-to-br from-slate-50 via-blue-50/30 to-emerald-50/40"

export const VIEWPORT_PAGE_SHELL_WITH_EMERALD_BG_CLASS =
  `${VIEWPORT_PAGE_SHELL_CLASS} ${VIEWPORT_PAGE_SHELL_EMERALD_BG_CLASS}`

/** Scrollable panel below filters/header on data-heavy pages. */
export const VIEWPORT_PANEL_SCROLL_CLASS =
  "max-h-[calc(100dvh-var(--topbar-height,4.5625rem)-16rem)] overflow-y-auto overscroll-y-auto"

/** Modal / drawer body — safe-area friendly. */
export const MODAL_SCROLL_BODY_CLASS =
  "max-h-[calc(100dvh-12rem)] sm:max-h-[calc(100dvh-14rem)] overflow-y-auto overscroll-y-auto pb-[max(0.75rem,env(safe-area-inset-bottom))]"

export const MODAL_FOOTER_SAFE_CLASS =
  "pb-[max(0.75rem,env(safe-area-inset-bottom))]"

/** Bleed page canvas to layout padding edges (matches layout p-3 sm:p-4 lg:p-6). */
export const PAGE_CANVAS_BLEED_CLASS =
  "-mx-3 -mt-3 -mb-3 sm:-mx-4 sm:-mt-4 sm:-mb-4 lg:-mx-6 lg:-mt-6 lg:-mb-6"

export const PAGE_CANVAS_PADDING_CLASS = "p-3 sm:p-4 lg:p-6"

/** Contain wide tables inside cards on phone/tablet (touch-friendly horizontal scroll). */
export const MOBILE_TABLE_SCROLL_CLASS =
  "w-full max-w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]"

export const MOBILE_TABLE_HINT_CLASS =
  "border-b border-slate-100 bg-slate-50/90 px-3 py-1.5 text-[11px] text-slate-500 md:hidden"

export const PAGE_TOOLBAR_ROW_CLASS =
  "flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
