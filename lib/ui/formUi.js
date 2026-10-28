import { cn } from "@/lib/utils"

export const FORM_LABEL_CLASS =
  "text-[13px] font-semibold tracking-tight text-slate-700"

export const FORM_CONTROL_CLASS = cn(
  "h-11 w-full min-w-0 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-sm text-slate-900",
  "placeholder:text-slate-400 transition-all duration-200",
  "hover:border-slate-300 focus-visible:border-emerald-500/75 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-500/12"
)

export const FORM_CARD_CLASS = cn(
  "overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 shadow-[0_20px_55px_-32px_rgba(15,23,42,0.18)] backdrop-blur-xl"
)
