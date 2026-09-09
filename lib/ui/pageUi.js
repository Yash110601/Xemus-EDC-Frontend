import { cn } from "@/lib/utils"

/** Standard authenticated page shell — glass card on mesh background. */
export const PAGE_SHELL_CLASS = "novera-page-shell w-full max-w-full space-y-6"

export const PAGE_HEADER_CLASS = cn(
  "novera-page-header relative overflow-hidden rounded-2xl border border-white/60",
  "bg-gradient-to-br from-white/95 via-white/90 to-emerald-50/40 px-6 py-5",
  "shadow-[0_16px_48px_-28px_rgba(15,23,42,0.12)] backdrop-blur-xl"
)

export const PAGE_CARD_CLASS = cn(
  "novera-page-card overflow-hidden rounded-2xl border border-slate-200/70",
  "bg-white/90 shadow-[0_20px_55px_-32px_rgba(15,23,42,0.15)] backdrop-blur-sm ring-1 ring-white/80"
)

export const PAGE_CARD_HEADER_CLASS =
  "border-b border-slate-200/60 bg-gradient-to-r from-slate-50/90 via-white to-emerald-50/30 px-5 py-4"

export const PAGE_TABLE_WRAP_CLASS = "novera-table-wrap overflow-hidden rounded-xl border border-slate-200/70"

export const PAGE_PRIMARY_BTN = "btn-brand-gradient rounded-xl text-white shadow-md shadow-emerald-900/15"
