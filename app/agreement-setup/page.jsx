"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import PageLoader from "@/components/ui/page-loader"

export default function AgreementSetupPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/agreement-setup/manage")
  }, [router])

  return (
    <div className="min-h-[100dvh]">
      <PageLoader message="Opening agreement setup..." />
    </div>
  )
}
