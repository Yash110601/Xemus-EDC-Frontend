"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import PageLoader from "@/components/ui/page-loader"

export default function VisitConfigurationPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/visit-configuration/manage")
  }, [router])

  return (
    <div className="min-h-[100dvh]">
      <PageLoader message="Opening visit configuration..." />
    </div>
  )
}
