"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function EConsentIndexPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/econsent/forms")
  }, [router])
  return null
}
