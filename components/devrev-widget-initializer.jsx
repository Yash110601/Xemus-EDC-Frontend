"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { DEVREV_WIDGET_ENABLED } from "@/lib/config/supportWidget"

const DEVREV_APP_ID =
  "DvRvStPZG9uOmNvcmU6ZHZydi1pbi0xOmRldm8vMktvb3FrQnlQUDpwbHVnX3NldHRpbmcvMV9ffHxfXzIwMjUtMDctMjIgMTA6MjA6NDUuODE2MzQyOTU1ICswMDAwIFVUQw==xlxendsDvRv"

export default function DevRevWidgetInitializer() {
  const pathname = usePathname()

  // Show support widget only on main landing pages; hide on inner workflows (e.g. eCRF entry).
  useEffect(() => {
    if (!DEVREV_WIDGET_ENABLED || typeof window === "undefined") return

    const isMainPage = pathname === "/" || pathname === "/dashboard"

    const applyRouteVisibility = () => {
      const widgetIframes = document.querySelectorAll(
        'iframe[data-drid="PLUG_LAUNCHER_IFRAME"], iframe[src*="devrev"], iframe[src*="plug-platform"]',
      )
      widgetIframes.forEach((iframe) => {
        if (!(iframe instanceof HTMLElement)) return
        iframe.style.display = isMainPage ? "block" : "none"
        iframe.style.visibility = isMainPage ? "visible" : "hidden"
        iframe.style.pointerEvents = isMainPage ? "auto" : "none"
      })

      // Always collapse panel on route changes to avoid edge-cases with stale open state.
      if (typeof window.plugSDK?.toggleWidget === "function") {
        try {
          window.plugSDK.toggleWidget(false)
        } catch {}
      }
    }

    applyRouteVisibility()
    const retryTimer = setTimeout(applyRouteVisibility, 350)
    return () => clearTimeout(retryTimer)
  }, [pathname])

  useEffect(() => {
    if (!DEVREV_WIDGET_ENABLED || typeof window === "undefined") return

    let cancelled = false
    let retryTimer = null

    const tryInit = () => {
      if (cancelled) return
      if (window.__devrevPlugInitialized) return

      if (typeof window.plugSDK?.init !== "function") {
        retryTimer = setTimeout(tryInit, 300)
        return
      }

      try {
        window.plugSDK.init({ app_id: DEVREV_APP_ID })
        window.__devrevPlugInitialized = true
      } catch {
        // Retry on transient SDK load timing issues.
        retryTimer = setTimeout(tryInit, 500)
      }
    }

    tryInit()

    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [])

  return null
}

