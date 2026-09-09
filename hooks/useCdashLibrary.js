"use client"

import { useEffect, useState } from "react"
import { cdashLibraryStore } from "@/lib/cdash/cdashLibraryStore"
import { CDASH_IG_VERSION } from "@/lib/services/cdash.service"

/** Loads CDASH library status + domains via session store (preload small libraries). */
export function useCdashLibrary(enabled = false) {
  const [loading, setLoading] = useState(false)
  const [libraryReady, setLibraryReady] = useState(null)
  const [domains, setDomains] = useState([])

  useEffect(() => {
    if (!enabled) return
    let alive = true
    setLoading(true)
    void (async () => {
      try {
        await cdashLibraryStore.ensureLoaded(CDASH_IG_VERSION)
        if (!alive) return
        setLibraryReady(true)
        setDomains(cdashLibraryStore.getDomains(CDASH_IG_VERSION))
      } catch {
        if (!alive) return
        setLibraryReady(false)
        setDomains([])
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [enabled])

  return { loading, libraryReady, domains }
}
