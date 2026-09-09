"use client"

import { useCallback, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import xemusAiService from "@/lib/services/xemusAi.service"
import { Loader2, MessageCircle, Send, Sparkles, X } from "lucide-react"

/**
 * Floating study assistant chat (Insight AI).
 */
export default function StudyAssistantPanel({
  studyId,
  patientEnrolmentId = null,
  visitScheduleId = null,
  crfDataId = null,
  enabled = true,
  className,
}) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Ask about study requirements, CRF fields, or open queries for this context.",
    },
  ])
  const listRef = useRef(null)

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = listRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
  }, [])

  const handleSend = async () => {
    const question = input.trim()
    if (!question || !studyId || loading) return
    setInput("")
    setMessages((prev) => [...prev, { role: "user", text: question }])
    scrollToBottom()
    setLoading(true)
    try {
      const res = await xemusAiService.studyAssistant({
        studyId,
        question,
        patientEnrolmentId,
        visitScheduleId,
        crfDataId,
      })
      const answer =
        res?.data?.answer ??
        res?.data?.response ??
        res?.message ??
        "I could not generate a response right now."
      setMessages((prev) => [...prev, { role: "assistant", text: String(answer) }])
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: error?.message || "Study assistant is unavailable." },
      ])
    } finally {
      setLoading(false)
      scrollToBottom()
    }
  }

  if (!enabled) return null

  return (
    <div className={cn("pointer-events-none fixed bottom-5 right-5 z-[90]", className)}>
      {open ? (
        <div
          className="pointer-events-auto mb-3 flex w-[min(100vw-2rem,22rem)] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_20px_48px_-16px_rgba(15,23,42,0.35)]"
          role="dialog"
          aria-label="Study assistant"
        >
          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-violet-50 to-white px-3 py-2.5">
            <span className="flex items-center gap-2 text-sm font-semibold text-violet-900">
              <Sparkles className="h-4 w-4" />
              Study assistant
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close assistant"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div
            ref={listRef}
            className="max-h-64 space-y-2 overflow-y-auto px-3 py-3 text-sm"
            aria-live="polite"
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-xl px-2.5 py-2 leading-relaxed",
                  msg.role === "user"
                    ? "ml-6 bg-violet-600 text-white"
                    : "mr-4 bg-slate-50 text-slate-800 ring-1 ring-slate-200/60",
                )}
              >
                {msg.text}
              </div>
            ))}
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Thinking…
              </div>
            ) : null}
          </div>
          <div className="flex gap-2 border-t border-slate-100 p-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  void handleSend()
                }
              }}
              placeholder="Ask about this study…"
              disabled={loading}
              className="h-9 text-sm"
            />
            <Button
              type="button"
              size="icon"
              disabled={loading || !input.trim()}
              onClick={() => void handleSend()}
              className="h-9 w-9 shrink-0 bg-violet-700 hover:bg-violet-800"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-violet-700 text-white shadow-lg transition hover:bg-violet-800"
        aria-label={open ? "Close study assistant" : "Open study assistant"}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>
    </div>
  )
}
