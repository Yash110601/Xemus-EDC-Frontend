"use client"

import { Suspense } from "react"
import { Loader2 } from "lucide-react"

function EConsentLayoutFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-2 p-8 text-sm text-slate-600">
      <Loader2 className="h-4 w-4 animate-spin text-emerald-600" aria-hidden />
      Loading eCONSENT…
    </div>
  )
}

export default function EConsentLayout({ children }) {
  return <Suspense fallback={<EConsentLayoutFallback />}>{children}</Suspense>
}
