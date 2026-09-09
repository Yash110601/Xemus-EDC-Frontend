"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

function LegacyRsdvRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const qs = searchParams?.toString?.() ?? ""
    router.replace(qs ? `/rsdv/review?${qs}` : "/rsdv/review")
  }, [router, searchParams])

  return null
}

export default function LegacyStudyMgmtRsdvPage() {
  return (
    <Suspense fallback={null}>
      <LegacyRsdvRedirect />
    </Suspense>
  )
}
