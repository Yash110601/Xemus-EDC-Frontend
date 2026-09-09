"use client"

import { useEffect, useState } from "react"
import { formatWorkspaceStudyLabel } from "@/lib/utils/studySiteContext"

function workspaceStudyLabelFallback(studyId) {
  return studyId ? `Study #${studyId}` : ""
}

/** Live protocol / title label for the header-selected study. */
export function useWorkspaceStudyLabel(studyId) {
  const fallback = workspaceStudyLabelFallback(studyId)
  // Keep SSR and the first client paint identical; localStorage is read after mount.
  const [label, setLabel] = useState(fallback)

  useEffect(() => {
    const sync = () => setLabel(formatWorkspaceStudyLabel(studyId) || fallback)
    sync()
    window.addEventListener("studySelected", sync)
    window.addEventListener("studySiteChanged", sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener("studySelected", sync)
      window.removeEventListener("studySiteChanged", sync)
      window.removeEventListener("storage", sync)
    }
  }, [studyId, fallback])

  return label
}
