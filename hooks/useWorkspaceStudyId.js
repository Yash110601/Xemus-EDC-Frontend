"use client"

import { useEffect, useState } from "react"
import { useStudySettings } from "@/context/StudySettingsContext"
import { readStudySiteFromStorage } from "@/lib/utils/studySiteContext"

/**
 * Resolved header study id — StudySettingsProvider plus localStorage fallback
 * (needed before async provider load / auto-select completes).
 */
export function useWorkspaceStudyId() {
  const ctx = useStudySettings()
  const [storageStudyId, setStorageStudyId] = useState(() => readStudySiteFromStorage().studyId)

  useEffect(() => {
    const sync = () => setStorageStudyId(readStudySiteFromStorage().studyId)
    sync()
    window.addEventListener("studySelected", sync)
    window.addEventListener("studySiteChanged", sync)
    window.addEventListener("storage", sync)
    return () => {
      window.removeEventListener("studySelected", sync)
      window.removeEventListener("studySiteChanged", sync)
      window.removeEventListener("storage", sync)
    }
  }, [])

  return ctx?.studyId ?? storageStudyId ?? null
}

export default useWorkspaceStudyId
