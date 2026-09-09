"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import PageLoader from "@/components/ui/page-loader"

export default function StudyManagementPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/study-management/study-configuration")
  }, [router])

  return (
    <div className="min-h-[100dvh]">
      <PageLoader message="Opening study management..." />
    </div>
  )
}
