"use client"

import Link from "next/link"
import { Home, ArrowLeft } from "lucide-react"

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 px-4 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-600">404</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Page not found</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600">
        This link does not match a screen in Company. Use the menu to open a module, or return to the
        dashboard.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/dashboard"
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
        >
          <Home className="h-4 w-4" />
          Go to dashboard
        </Link>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Go back
        </button>
      </div>
    </div>
  )
}
