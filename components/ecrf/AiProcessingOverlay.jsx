"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { FileText, Mic } from "lucide-react"
import { cn } from "@/lib/utils"

const MIN_VISIBLE_MS = 900

const VOICE_STATUS = [
  "Understanding your recording",
  "Matching details to CRF fields",
  "Preparing values for your review",
]

const UPLOAD_STATUS = [
  "Reading your document",
  "Matching details to CRF fields",
  "Preparing values for your review",
]

const STATUS_CYCLE_MS = 2800

function ProcessingOrb({ mode }) {
  const Icon = mode === "voice" ? Mic : FileText
  return (
    <div className="relative mx-auto mb-7 flex h-[5rem] w-[5rem] items-center justify-center">
      <span
        className="ai-processing-orb-halo absolute inset-0 rounded-[1.15rem] bg-teal-400/15"
        aria-hidden
      />
      <span
        className="ai-processing-orb-halo-delayed absolute inset-2 rounded-[1rem] border border-teal-200/50 bg-gradient-to-br from-teal-50/80 to-emerald-50/40"
        aria-hidden
      />
      <span
        className={cn(
          "relative flex h-[3.35rem] w-[3.35rem] items-center justify-center rounded-[0.9rem]",
          "bg-gradient-to-b from-teal-500 via-teal-600 to-emerald-700",
          "shadow-[0_10px_32px_-8px_rgba(99,102,241,0.5),inset_0_1px_0_rgba(255,255,255,0.4)]",
        )}
      >
        <Icon className="h-[1.35rem] w-[1.35rem] text-white" strokeWidth={2} aria-hidden />
      </span>
    </div>
  )
}

/** Apple-style activity — no progress line. */
function ActivityDots() {
  return (
    <div
      className="mt-6 flex items-center justify-center gap-2"
      role="progressbar"
      aria-valuetext="Processing"
    >
      <span className="ai-breathe-dot h-2 w-2 rounded-full bg-teal-500" aria-hidden />
      <span className="ai-breathe-dot-2 h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
      <span className="ai-breathe-dot-3 h-2 w-2 rounded-full bg-teal-400" aria-hidden />
    </div>
  )
}

export default function AiProcessingOverlay({ open = false, mode = "upload" }) {
  const statusLines = mode === "voice" ? VOICE_STATUS : UPLOAD_STATUS
  const [mounted, setMounted] = useState(false)
  const [statusIndex, setStatusIndex] = useState(0)
  const [statusVisible, setStatusVisible] = useState(true)
  const openedAtRef = useRef(0)
  const fadeTimerRef = useRef(null)

  useEffect(() => {
    if (open) {
      openedAtRef.current = Date.now()
      setMounted(true)
      setStatusIndex(0)
      setStatusVisible(true)
      return undefined
    }
    if (!mounted) return undefined
    const elapsed = Date.now() - openedAtRef.current
    const remain = Math.max(0, MIN_VISIBLE_MS - elapsed)
    const t = window.setTimeout(() => setMounted(false), remain)
    return () => window.clearTimeout(t)
  }, [open, mounted])

  useEffect(() => {
    if (!mounted || !open) return undefined
    const interval = window.setInterval(() => {
      setStatusVisible(false)
      if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current)
      fadeTimerRef.current = window.setTimeout(() => {
        setStatusIndex((i) => (i + 1) % statusLines.length)
        setStatusVisible(true)
      }, 240)
    }, STATUS_CYCLE_MS)
    return () => {
      window.clearInterval(interval)
      if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current)
    }
  }, [mounted, open, statusLines.length])

  if (!mounted || typeof document === "undefined") return null

  const statusText = statusLines[statusIndex]

  const content = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/25 p-5 backdrop-blur-xl animate-in fade-in duration-300"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Processing your input"
    >
      <div
        className={cn(
          "w-full max-w-[21rem] rounded-[1.5rem] bg-white px-8 pb-8 pt-9 text-center",
          "shadow-[0_0_0_1px_rgba(15,23,42,0.05),0_32px_72px_-28px_rgba(15,23,42,0.32)]",
          "animate-in zoom-in-95 duration-400 ease-out",
        )}
      >
        <ProcessingOrb mode={mode} />

        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Filling your CRF</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
          {mode === "voice"
            ? "From your voice. This usually takes a few moments."
            : "From your file. This usually takes a few moments."}
        </p>

        <p
          className={cn(
            "mt-6 min-h-[1.35rem] text-[13px] font-medium tracking-tight text-teal-700 transition-opacity duration-300",
            statusVisible ? "opacity-100" : "opacity-0",
          )}
        >
          {statusText}
        </p>

        <ActivityDots />

        <p className="mt-6 text-[11px] leading-relaxed text-slate-400">
          Keep this form open until filling completes
        </p>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
