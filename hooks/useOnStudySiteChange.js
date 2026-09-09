"use client"

import { useEffect } from "react"

/**
 * Run callback when workspace study/site changes (header selector).
 */
export function useOnStudySiteChange(callback) {
  useEffect(() => {
    if (typeof callback !== "function") return undefined

    const handler = () => {
      callback()
    }

    window.addEventListener("studySiteChanged", handler)
    window.addEventListener("studySelected", handler)
    return () => {
      window.removeEventListener("studySiteChanged", handler)
      window.removeEventListener("studySelected", handler)
    }
  }, [callback])
}

export default useOnStudySiteChange
