"use client"

import { useEffect } from "react"

/**
 * Prevents mouse wheel from changing number input values app-wide.
 * Users can only change values by typing; scrolling over a focused number input won't change it.
 */
export default function DisableNumberInputScroll() {
  useEffect(() => {
    const handleWheel = (e: Event) => {
      const target = e.target as HTMLElement
      if (target?.tagName === "INPUT" && (target as HTMLInputElement).type === "number") {
        e.preventDefault()
      }
    }
    document.addEventListener("wheel", handleWheel, { passive: false } as EventListenerOptions)
    return () => document.removeEventListener("wheel", handleWheel)
  }, [])
  return null
}
