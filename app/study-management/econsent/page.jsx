"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/** Legacy Study Management route → enterprise eCONSENT forms. */
export default function LegacyEConsentRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const studyId = params.get("studyId")
    const qs = studyId ? `?studyId=${encodeURIComponent(studyId)}` : ""
    router.replace(`/econsent/forms${qs}`)
  }, [router])

  return null
}
