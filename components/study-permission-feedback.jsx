"use client"

import { useEffect } from "react"
import { toast } from "sonner"
import { STUDY_PERMISSION_DENIED_EVENT } from "@/lib/utils/studyPermissionApiFeedback"

/** Listens for global 403 permission events when matrix enforcement is ON. */
export default function StudyPermissionFeedback() {
  useEffect(() => {
    const onDenied = (event) => {
      const message = event?.detail?.message || "You do not have permission for this action."
      toast.error(message)
    }
    window.addEventListener(STUDY_PERMISSION_DENIED_EVENT, onDenied)
    return () => window.removeEventListener(STUDY_PERMISSION_DENIED_EVENT, onDenied)
  }, [])

  return null
}
