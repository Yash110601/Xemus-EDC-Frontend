"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import PageLoader from "@/components/ui/page-loader"

export default function ECRFDataEntryPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to manually page by default
    router.replace("/ecrf-data-entry/manually")
  }, [router])

  return (
    <div className="min-h-[100dvh]">
      <PageLoader message="Opening eCRF data entry..." />
    </div>
  )
}

