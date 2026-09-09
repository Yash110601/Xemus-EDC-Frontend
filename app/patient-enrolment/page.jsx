"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import PageLoader from "@/components/ui/page-loader"

export default function PatientEnrolmentPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/patient-enrolment/create")
  }, [router])

  return (
    <div className="min-h-[100dvh]">
      <PageLoader message="Opening patient enrolment..." />
      </div>
  )
}
