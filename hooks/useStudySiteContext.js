"use client"

import { useCallback, useEffect, useState } from "react"
import { parseStudySiteEventDetail, readStudySiteFromStorage } from "@/lib/utils/studySiteContext"

/**
 * Workspace study/site from header + localStorage.
 * Listens to studySiteChanged / studySelected and storage updates.
 */
export function useStudySiteContext() {
  const [studyId, setStudyId] = useState(null)
  const [siteId, setSiteId] = useState(null)
  const [ready, setReady] = useState(false)

  const applyContext = useCallback((partial) => {
    if (Object.prototype.hasOwnProperty.call(partial, "studyId")) {
      setStudyId(partial.studyId ?? null)
    }
    if (Object.prototype.hasOwnProperty.call(partial, "siteId")) {
      setSiteId(partial.siteId ?? null)
    }
  }, [])

  useEffect(() => {
    applyContext(readStudySiteFromStorage())
    setReady(true)

    const onContextEvent = (event) => {
      applyContext(parseStudySiteEventDetail(event?.detail || {}))
    }

    const onStorage = (event) => {
      if (event.key === "selectedStudyId" || event.key === "selectedSiteId") {
        applyContext(readStudySiteFromStorage())
      }
    }

    window.addEventListener("studySiteChanged", onContextEvent)
    window.addEventListener("studySelected", onContextEvent)
    window.addEventListener("storage", onStorage)

    return () => {
      window.removeEventListener("studySiteChanged", onContextEvent)
      window.removeEventListener("studySelected", onContextEvent)
      window.removeEventListener("storage", onStorage)
    }
  }, [applyContext])

  return { studyId, siteId, ready }
}
