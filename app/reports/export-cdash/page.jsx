"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/** Legacy route — CDASH Report lives at /reports/cdash */
export default function ExportCdashRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/reports/cdash")
  }, [router])

  return null
}
