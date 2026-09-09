"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import PageLoader from "@/components/ui/page-loader"

export default function EcrfFormDesignerPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/ecrf-form-designer/manage")
  }, [router])

  return (
    <div className="min-h-[100dvh]">
      <PageLoader message="Opening eCRF designer..." />
    </div>
  )
}
