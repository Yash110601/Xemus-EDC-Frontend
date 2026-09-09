import { cn } from "@/lib/utils"

/** Set to true when OTP sign-in should be offered on the login screen. */
export const OTP_LOGIN_ENABLED = false

export const LOGIN_PAGE_CLASS =
  "login-page-root fixed inset-0 flex overflow-hidden"

export const LOGIN_MAIN_CLASS =
  "login-main relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white"

export const LOGIN_PANEL_PADDING_X = "px-8 sm:px-12 lg:px-14 xl:px-16"

export const LOGIN_CONTENT_MAX_WIDTH = "w-full max-w-[380px]"

export const LOGIN_FORM_PANEL_CLASS = cn(
  "relative z-10 flex min-h-0 flex-1 flex-col justify-center overflow-y-auto py-12",
  LOGIN_PANEL_PADDING_X
)

export const LOGIN_FORM_INNER_CLASS = cn("login-form-enter", LOGIN_CONTENT_MAX_WIDTH)

export const LOGIN_CARD_CLASS = LOGIN_FORM_INNER_CLASS

export const LOGIN_LABEL_CLASS = "mb-2 block text-[13px] font-semibold tracking-[-0.01em] text-[#0f172a]"

export const LOGIN_INPUT_CLASS = cn(
  "h-[52px] rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 text-[15px] text-[#0f172a]",
  "placeholder:text-[#94a3b8] transition-all duration-200",
  "hover:border-[#cbd5e1] hover:bg-white",
  "focus-visible:border-[#0d9488] focus-visible:bg-white focus-visible:outline-none",
  "focus-visible:ring-4 focus-visible:ring-[#14b8a6]/15"
)

export const LOGIN_BTN_PRIMARY = cn(
  "login-btn-primary mt-3 h-[52px] w-full rounded-xl text-[15px] font-semibold tracking-[-0.01em] text-white",
  "transition-all duration-200",
  "hover:-translate-y-px hover:shadow-[0_12px_28px_-12px_rgba(15,39,68,0.55)]",
  "active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
)

export const LOGIN_BRAND_LINK_CLASS =
  "text-[13px] font-semibold text-[#0f766e] transition-colors hover:text-[#0d9488]"

export const LOGIN_BRAND_LINK_SUBTLE_CLASS =
  "font-semibold text-[#0f766e] underline-offset-2 hover:underline"

export const LOGIN_AUTH_TOGGLE_WRAP =
  "relative grid grid-cols-2 gap-1 rounded-xl border border-[#e2e8f0] bg-[#f1f5f9] p-1"

export const LOGIN_AUTH_TOGGLE_ACTIVE =
  "flex items-center justify-center gap-2 rounded-lg bg-white py-2.5 text-sm font-semibold text-[#0f172a] shadow-sm"

export const LOGIN_AUTH_TOGGLE_IDLE =
  "flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-[#64748b] transition-colors hover:text-[#334155]"

export const LOGIN_FORM_FOOTER_LINK_CLASS =
  "text-[12px] font-medium text-[#64748b] transition-colors hover:text-[#0f172a]"

export const PASSWORD_INPUT_IOS_PROPS = {
  autoCapitalize: "none",
  autoCorrect: "off",
  spellCheck: false,
}

export const PASSWORD_TOGGLE_BTN_CLASS =
  "absolute inset-y-0 right-0 z-10 flex w-12 touch-manipulation items-center justify-center text-[#94a3b8] transition-colors hover:text-[#475569]"
