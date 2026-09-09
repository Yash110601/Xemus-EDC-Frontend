"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

/** Tailwind `lg` breakpoint — sidebar is docked at `lg` and above. */
export const MOBILE_SHELL_MEDIA_QUERY = "(max-width: 1023px)"

export function useMobileShell() {
  const pathname = usePathname()
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_SHELL_MEDIA_QUERY)
    const onChange = () => setIsMobileViewport(mq.matches)
    onChange()
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!isMobileViewport || !mobileNavOpen) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isMobileViewport, mobileNavOpen])

  return {
    isMobileViewport,
    mobileNavOpen,
    openMobileNav: () => setMobileNavOpen(true),
    closeMobileNav: () => setMobileNavOpen(false),
    toggleMobileNav: () => setMobileNavOpen((open) => !open),
  }
}
