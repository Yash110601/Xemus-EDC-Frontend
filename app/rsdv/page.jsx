"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function RsdvIndexPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/rsdv/dashboard")
  }, [router])
  return null
}
