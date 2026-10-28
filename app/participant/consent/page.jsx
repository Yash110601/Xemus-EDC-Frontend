"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import eConsentService from "@/lib/services/eConsent.service"
import { BrandLogo } from "@/components/brand-logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { APP_BRANDING } from "@/lib/config/appBranding"
import { downloadConsentPdfFromDocument } from "@/lib/econsent/downloadConsentDocument"
import { econsentStatusBadge } from "@/lib/econsent/econsentUi"
import { toEmbedUrl, sectionHasRequiredVideo } from "@/lib/econsent/consentSectionMedia"
import { cn } from "@/lib/utils"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSignature,
  Loader2,
  ShieldCheck,
} from "lucide-react"

function formatPartyRole(role) {
  if (!role) return "Participant"
  return String(role).replace(/([A-Z])/g, " $1").trim()
}

function normalizeSectionContent(raw) {
  const text = String(raw || "").trim()
  if (!text || text.toUpperCase() === "NA" || text.toUpperCase() === "N/A") return ""
  if (text.includes("<")) return text
  return `<p>${text}</p>`
}

function ConsentStepper({ step, maxStep, hasQuiz }) {
  const steps = hasQuiz
    ? [
        { key: 0, label: "Read consent" },
        { key: 1, label: "Knowledge check" },
        { key: 2, label: "Sign & submit" },
      ]
    : [
        { key: 0, label: "Read consent" },
        { key: 1, label: "Sign & submit" },
      ]

  return (
    <div className="mt-4 flex items-center gap-2 sm:gap-3">
      {steps.map((item, idx) => {
        const active = step === item.key
        const done = step > item.key
        return (
          <div key={item.key} className="flex min-w-0 flex-1 items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
                done && "bg-violet-600 text-white",
                active && !done && "bg-emerald-100 text-emerald-800 ring-2 ring-violet-500/30",
                !active && !done && "bg-slate-100 text-slate-400",
              )}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
            </div>
            <div className="min-w-0 hidden sm:block">
              <p
                className={cn(
                  "truncate text-xs font-semibold",
                  active ? "text-emerald-900" : done ? "text-slate-700" : "text-slate-400",
                )}
              >
                {item.label}
              </p>
            </div>
            {idx < steps.length - 1 ? (
              <div
                className={cn(
                  "mx-1 hidden h-0.5 flex-1 rounded-full sm:block",
                  step > item.key ? "bg-emerald-400" : "bg-slate-200",
                )}
              />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function ConsentSectionMedia({ section, onWatched }) {
  const url = section?.videoUrl || section?.VideoUrl
  if (!url) return null
  const mediaType = (section?.mediaType || section?.MediaType || "Video").toLowerCase()
  const requireWatch = Boolean(section?.requireVideoWatch ?? section?.RequireVideoWatch)
  const embed = mediaType === "embed" || /youtube|youtu.be|vimeo/.test(url) ? toEmbedUrl(url) : null

  const markWatched = () => {
    if (requireWatch) onWatched?.(section.id ?? section.Id)
  }

  if (embed) {
    return (
      <div className="mb-4 overflow-hidden rounded-xl border border-slate-200/80 bg-black/5 shadow-sm">
        <iframe
          title={section.title || section.Title || "Consent video"}
          src={embed}
          className="aspect-video w-full max-w-2xl"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          onLoad={markWatched}
        />
        {requireWatch ? (
          <p className="bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
            Please watch this video before continuing.
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-slate-200/80 shadow-sm">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        controls
        className="w-full max-w-2xl"
        src={url}
        onEnded={markWatched}
        onPlay={requireWatch ? undefined : markWatched}
      />
      {requireWatch ? (
        <p className="px-3 py-2 text-xs text-amber-800 bg-amber-50">Watch the full video to continue.</p>
      ) : null}
    </div>
  )
}

function SignaturePad({ onChange }) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const sizeRef = useRef({ width: 520, height: 160 })

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const width = Math.max(container.clientWidth, 280)
    const height = Math.max(Math.round(width * 0.31), 120)
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
    sizeRef.current = { width, height }
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    const ctx = canvas.getContext("2d")
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.strokeStyle = "#0f172a"
    ctx.lineWidth = 2
    ctx.lineCap = "round"
  }, [])

  useEffect(() => {
    setupCanvas()
    const container = containerRef.current
    if (!container || typeof ResizeObserver === "undefined") return undefined
    const observer = new ResizeObserver(() => setupCanvas())
    observer.observe(container)
    return () => observer.disconnect()
  }, [setupCanvas])

  const pos = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const start = (e) => {
    drawing.current = true
    const ctx = canvasRef.current.getContext("2d")
    const p = pos(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }

  const move = (e) => {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext("2d")
    const p = pos(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }

  const end = () => {
    drawing.current = false
    onChange?.(canvasRef.current.toDataURL("image/png"))
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    const { width, height } = sizeRef.current
    ctx.clearRect(0, 0, width, height)
    onChange?.("")
  }

  return (
    <div ref={containerRef} className="w-full">
      <canvas
        ref={canvasRef}
        className="w-full max-w-full touch-none rounded-xl border-2 border-dashed border-slate-300 bg-white"
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <button type="button" className="mt-2 text-xs font-medium text-slate-500 hover:text-slate-700" onClick={clear}>
        Clear signature
      </button>
    </div>
  )
}

function ParticipantConsentInner() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") || ""

  const [data, setData] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(0) // 0 read, 1 quiz, 2 sign
  const [signerName, setSignerName] = useState("")
  const [acknowledged, setAcknowledged] = useState(false)
  const [otpCode, setOtpCode] = useState("")
  const [otpSending, setOtpSending] = useState(false)
  const [otpHint, setOtpHint] = useState("")
  const [signatureData, setSignatureData] = useState("")
  const [signatureMeaning, setSignatureMeaning] = useState("")
  const [photoData, setPhotoData] = useState("")
  const [videoData, setVideoData] = useState("")
  const [watchedSections, setWatchedSections] = useState(() => new Set())
  const [answers, setAnswers] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [doneMessage, setDoneMessage] = useState("")

  const load = useCallback(async () => {
    if (!token) {
      setError("Missing consent token.")
      setLoading(false)
      return
    }
    setLoading(true)
    setError("")
    const res = await eConsentService.getPublicByToken(token)
    if (res?.isSuccess && res.data) {
      setData(res.data)
      if (res.data.defaultSignatureMeaning || res.data.DefaultSignatureMeaning) {
        setSignatureMeaning(res.data.defaultSignatureMeaning || res.data.DefaultSignatureMeaning)
      }
      const status = res.data.status || ""
      if (
        !res.data.canSubmit &&
        (status === "PendingSiteVerification" || status === "Approved") &&
        (res.data.canDownloadDocument || res.data.CanDownloadDocument)
      ) {
        setDoneMessage(
          status === "Approved"
            ? "This consent was approved by the study site. You can download your signed copy below."
            : "Your consent was submitted and is awaiting site verification. You can download your signed copy below.",
        )
      }
    } else setError(res?.message || "Unable to load consent.")
    setLoading(false)
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (typeof document === "undefined") return
    let link = document.querySelector('link[rel="manifest"][data-econsent]')
    if (!link) {
      link = document.createElement("link")
      link.rel = "manifest"
      link.href = "/econsent-manifest.webmanifest"
      link.setAttribute("data-econsent", "1")
      document.head.appendChild(link)
    }
    let theme = document.querySelector('meta[name="theme-color"][data-econsent]')
    if (!theme) {
      theme = document.createElement("meta")
      theme.name = "theme-color"
      theme.content = "#0f766e"
      theme.setAttribute("data-econsent", "1")
      document.head.appendChild(theme)
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/econsent-sw.js").catch(() => {})
    }
  }, [])

  const sections = data?.sections || data?.Sections || []
  const questions = data?.questions || data?.Questions || []
  const formName = data?.formName || data?.FormName || "Informed consent"
  const versionLabel = data?.versionLabel || data?.VersionLabel || "—"
  const status = data?.status || data?.Status || ""
  const currentPartyRole = data?.currentPartyRole || data?.CurrentPartyRole
  const contentHtml = data?.contentHtml || data?.ContentHtml || ""
  const hasQuiz = questions.length > 0
  const canDownload = Boolean(data?.canDownloadDocument ?? data?.CanDownloadDocument)
  const requiredVideos = sections.filter(sectionHasRequiredVideo)
  const allVideosWatched = requiredVideos.every((s) => watchedSections.has(s.id ?? s.Id))

  const maxStep = useMemo(() => {
    if (!data?.canSubmit) return 0
    if (hasQuiz) return 2
    return 1
  }, [data?.canSubmit, hasQuiz])

  const handleDownload = async () => {
    if (!token) return
    setDownloading(true)
    setError("")
    try {
      const res = await eConsentService.getPublicDocument(token)
      if (res?.isSuccess && res.data) {
        downloadConsentPdfFromDocument(res.data)
      } else setError(res?.message || "Download failed")
    } catch {
      setError("Download failed")
    } finally {
      setDownloading(false)
    }
  }

  const handleSendOtp = async (channel = "auto") => {
    if (!token) return
    setOtpSending(true)
    setError("")
    setOtpHint("")
    try {
      const res = await eConsentService.issuePublicOtp(token, channel)
      if (res?.isSuccess && res.data) {
        setOtpHint(
          res.data.message ||
            (res.data.sent
              ? `Code sent via ${res.data.channel || channel} to ${res.data.maskedDestination || "your contact"}`
              : "Could not deliver code — contact the study site"),
        )
      } else setError(res?.message || "Could not send verification code")
    } catch {
      setError("Could not send verification code")
    } finally {
      setOtpSending(false)
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError("")
    const quizAnswers = Object.entries(answers).map(([questionId, value]) => {
      const qid = Number(questionId)
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return {
          questionId: qid,
          selectedIndex: Number(value.selectedIndex ?? 0),
          selectedIndexes: Array.isArray(value.selectedIndexes) ? value.selectedIndexes : undefined,
          selectedBool: value.selectedBool ?? undefined,
        }
      }
      if (Array.isArray(value)) {
        return {
          questionId: qid,
          selectedIndex: value[0] ?? 0,
          selectedIndexes: value,
        }
      }
      if (typeof value === "boolean") {
        return {
          questionId: qid,
          selectedIndex: value ? 1 : 0,
          selectedBool: value,
        }
      }
      return {
        questionId: qid,
        selectedIndex: Number(value),
      }
    })
    const res = await eConsentService.submitPublic({
      token,
      signerName,
      acknowledged,
      signatureData: signatureData || null,
      signatureMeaning: signatureMeaning || null,
      otpCode: otpCode || null,
      photoData: photoData || null,
      videoData: videoData || null,
      quizAnswers,
    })
    if (res?.isSuccess) {
      setData(res.data)
      setDoneMessage(
        res.data?.status === "PendingSiteVerification"
          ? "Thank you. Your consent was submitted and is awaiting site verification."
          : "Thank you. Please wait for the next signer, or contact the study site.",
      )
    } else setError(res?.message || "Submit failed")
    setSubmitting(false)
  }

  const handleDecline = async () => {
    if (!window.confirm("Decline this consent? You will not be eligible for the study.")) return
    setSubmitting(true)
    setError("")
    const res = await eConsentService.declinePublic({ token })
    if (res?.isSuccess) {
      setData(res.data)
      setDoneMessage("You declined consent. Please contact the study site if this was a mistake.")
    } else setError(res?.message || "Decline failed")
    setSubmitting(false)
  }

  return (
    <div className="min-h-[100dvh] touch-manipulation bg-[radial-gradient(ellipse_at_top,_#ecfdf5_0%,_#f8fafc_45%,_#f1f5f9_100%)]">
      <header className="sticky top-0 z-20 border-b border-emerald-900/10 bg-white/95 backdrop-blur-md safe-area-pt safe-area-px">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3.5 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo className="h-9 w-auto shrink-0 sm:h-10" />
            <div className="min-w-0">
              <p className="truncate text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                {APP_BRANDING?.productName || "Company"}
              </p>
              <p className="truncate text-xs text-slate-500">Electronic informed consent</p>
            </div>
          </div>
          <div className="hidden items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 sm:flex">
            <ShieldCheck className="h-3.5 w-3.5" />
            Secure session
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-28 pt-6 sm:pb-8 sm:pt-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200/80 bg-white/80 px-6 py-16 text-center shadow-sm backdrop-blur-sm">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <p className="text-sm font-medium text-slate-600">Loading your consent document…</p>
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3.5 text-sm text-amber-950 shadow-sm">
            {error}
          </div>
        ) : null}

        {doneMessage ? (
          <div className="overflow-hidden rounded-2xl border border-emerald-200/80 bg-white shadow-[0_12px_40px_-20px_rgba(16,185,129,0.35)]">
            <div className="border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50/80 px-6 py-5">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-emerald-600 p-2 text-white">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Consent recorded</h2>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{doneMessage}</p>
                </div>
              </div>
            </div>
            {canDownload ? (
              <div className="px-6 py-4">
                <Button
                  type="button"
                  className="h-11 rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 px-5 font-semibold text-white shadow-md shadow-violet-900/15 hover:from-violet-700 hover:to-purple-600"
                  disabled={downloading}
                  onClick={handleDownload}
                >
                  {downloading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Download signed copy (PDF)
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {data && !loading && !doneMessage ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_16px_48px_-24px_rgba(15,23,42,0.28)]">
            <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 via-white to-emerald-50/50 px-5 py-5 sm:px-6 sm:py-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-200/80">
                    <FileSignature className="h-3.5 w-3.5" />
                    Informed consent
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.65rem]">{formName}</h1>
                  <p className="mt-1.5 text-sm text-slate-600">
                    Version {versionLabel}
                    {currentPartyRole ? ` · Signing as ${formatPartyRole(currentPartyRole)}` : ""}
                  </p>
                </div>
                {status ? (
                  <span className={cn(econsentStatusBadge(status), "shrink-0 text-xs")}>{status}</span>
                ) : null}
              </div>
              {data.canSubmit ? (
                <>
                  <ConsentStepper step={step} maxStep={maxStep} hasQuiz={hasQuiz} />
                  <p className="mt-3 text-xs font-medium text-slate-500 sm:hidden">
                    Step {step + 1} of {maxStep + 1}:{" "}
                    {step === 0 ? "Read consent" : step === 1 && hasQuiz ? "Knowledge check" : "Sign & submit"}
                  </p>
                </>
              ) : null}
            </div>

            {step === 0 ? (
              <div className="space-y-5 px-5 py-6 sm:px-6 sm:py-7">
                {sections.length > 0 ? (
                  sections.map((s, index) => {
                    const html = normalizeSectionContent(s.content || s.Content)
                    const title = s.title || s.Title || `Section ${index + 1}`
                    return (
                      <article
                        key={s.id ?? s.Id ?? index}
                        className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 sm:p-5 overflow-x-auto break-words"
                      >
                        <h2 className="mb-3 text-base font-semibold text-slate-900 sm:text-lg">{title}</h2>
                        <ConsentSectionMedia
                          section={s}
                          onWatched={(id) => setWatchedSections((prev) => new Set([...prev, id]))}
                        />
                        {html ? (
                          <div
                            className="prose prose-sm max-w-none text-slate-800 prose-headings:text-slate-900 prose-p:leading-relaxed prose-li:my-1"
                            dangerouslySetInnerHTML={{ __html: html }}
                          />
                        ) : (
                          <p className="text-sm italic text-slate-500">No additional text for this section.</p>
                        )}
                      </article>
                    )
                  })
                ) : contentHtml ? (
                  <article className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 sm:p-5">
                    <div
                      className="prose prose-sm max-w-none text-slate-800 prose-headings:text-slate-900 prose-p:leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: contentHtml }}
                    />
                  </article>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-10 text-center">
                    <FileSignature className="mx-auto mb-3 h-8 w-8 text-slate-400" />
                    <p className="text-sm font-medium text-slate-700">Consent content is not available yet.</p>
                    <p className="mt-1 text-xs text-slate-500">Please contact your study site for assistance.</p>
                  </div>
                )}

                {requiredVideos.length > 0 && !allVideosWatched ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Watch all required videos before continuing.
                  </p>
                ) : null}
              </div>
            ) : null}

            {step === 1 && hasQuiz ? (
              <div className="space-y-4 px-5 py-6 sm:px-6 sm:py-7">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
                  <p className="text-sm font-medium text-emerald-900">Knowledge check</p>
                  <p className="mt-0.5 text-xs text-emerald-800/80">
                    Answer each question to confirm you understand the consent information.
                  </p>
                </div>
                {questions.map((q, idx) => {
                  const qId = q.id ?? q.Id
                  const qText = q.text ?? q.Text
                  const type = q.questionType || q.QuestionType || "MultipleChoice"
                  const options =
                    type === "TrueFalse"
                      ? q.options?.length || q.Options?.length
                        ? q.options || q.Options
                        : ["True", "False"]
                      : type === "YesNo"
                        ? q.options?.length || q.Options?.length
                          ? q.options || q.Options
                          : ["Yes", "No"]
                        : q.options || q.Options || []

                  if (type === "Acknowledgment") {
                    const checked = Boolean(answers[qId]?.selectedBool ?? answers[qId] === true)
                    return (
                      <div
                        key={qId}
                        className={cn(
                          "rounded-xl border p-4 transition-colors sm:p-5",
                          checked ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200/80 bg-white",
                        )}
                      >
                        <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-800">
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            checked={checked}
                            onChange={(e) =>
                              setAnswers((prev) => ({
                                ...prev,
                                [qId]: { selectedBool: e.target.checked, selectedIndex: e.target.checked ? 1 : 0 },
                              }))
                            }
                          />
                          <span className="font-semibold text-slate-900">
                            {idx + 1}. {qText}
                          </span>
                        </label>
                      </div>
                    )
                  }

                  if (type === "MultiSelect") {
                    const selected = Array.isArray(answers[qId]?.selectedIndexes)
                      ? answers[qId].selectedIndexes
                      : Array.isArray(answers[qId])
                        ? answers[qId]
                        : []
                    return (
                      <div key={qId} className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5">
                        <p className="text-sm font-semibold text-slate-900">
                          {idx + 1}. {qText}
                        </p>
                        <p className="mb-3 mt-1 text-xs text-slate-500">Select all that apply</p>
                        <div className="space-y-2">
                          {options.map((opt, optIdx) => (
                            <label
                              key={optIdx}
                              className={cn(
                                "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                                selected.includes(optIdx)
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                                  : "border-slate-200 bg-slate-50/50 text-slate-800 hover:border-slate-300",
                              )}
                            >
                              <input
                                type="checkbox"
                                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                checked={selected.includes(optIdx)}
                                onChange={(e) => {
                                  const set = new Set(selected)
                                  if (e.target.checked) set.add(optIdx)
                                  else set.delete(optIdx)
                                  const next = [...set].sort((a, b) => a - b)
                                  setAnswers((prev) => ({
                                    ...prev,
                                    [qId]: { selectedIndexes: next, selectedIndex: next[0] ?? 0 },
                                  }))
                                }}
                              />
                              <span>
                                {String.fromCharCode(65 + optIdx)}. {opt}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  }

                  const selectedIndex =
                    typeof answers[qId] === "object" && answers[qId] != null
                      ? Number(answers[qId].selectedIndex)
                      : Number(answers[qId])

                  return (
                    <div key={qId} className="rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5">
                      <p className="mb-3 text-sm font-semibold text-slate-900">
                        {idx + 1}. {qText}
                      </p>
                      <div className="space-y-2">
                        {options.map((opt, optIdx) => (
                          <label
                            key={optIdx}
                            className={cn(
                              "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                              selectedIndex === optIdx
                                ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                                : "border-slate-200 bg-slate-50/50 text-slate-800 hover:border-slate-300",
                            )}
                          >
                            <input
                              type="radio"
                              name={`q-${qId}`}
                              className="mt-0.5 h-4 w-4 border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              checked={selectedIndex === optIdx}
                              onChange={() =>
                                setAnswers((prev) => ({
                                  ...prev,
                                  [qId]: { selectedIndex: optIdx },
                                }))
                              }
                            />
                            <span>
                              {String.fromCharCode(65 + optIdx)}. {opt}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : null}

            {((step === 1 && !hasQuiz) || (step === 2 && hasQuiz)) && data.canSubmit ? (
              <div className="space-y-5 border-t border-slate-100 bg-slate-50/60 px-5 py-6 sm:px-6 sm:py-7">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
                  <p className="text-sm font-medium text-emerald-900">Sign & submit</p>
                  <p className="mt-0.5 text-xs text-emerald-800/80">
                    Confirm your identity and provide your signature to complete consent.
                  </p>
                </div>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-4 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                  />
                  <span>I have read and understand this consent information, and I agree to participate.</span>
                </label>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Full legal name</label>
                  <Input
                    className="h-11 rounded-xl border-slate-200 bg-white"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Type your full name"
                  />
                </div>
                {data.allowPhoto ? (
                  <div>
                    <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Photo ID (optional)</label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) {
                          setPhotoData("")
                          return
                        }
                        const reader = new FileReader()
                        reader.onload = () => setPhotoData(String(reader.result || ""))
                        reader.readAsDataURL(file)
                      }}
                    />
                  </div>
                ) : null}
                {data.allowVideo ? (
                  <div>
                    <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Video confirmation</label>
                    <Input
                      type="file"
                      accept="video/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) {
                          setVideoData("")
                          return
                        }
                        if (file.size > 10 * 1024 * 1024) {
                          setError("Video must be 10 MB or smaller.")
                          setVideoData("")
                          return
                        }
                        const reader = new FileReader()
                        reader.onload = () => setVideoData(String(reader.result || ""))
                        reader.readAsDataURL(file)
                      }}
                    />
                    <p className="mt-1 text-xs text-slate-500">Short video clip confirming identity (max 10 MB).</p>
                  </div>
                ) : null}
                {data.allowOtp && !(data.identityAlreadyAttested || data.IdentityAlreadyAttested) ? (
                  <div>
                    <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Verification code</label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <Input
                        className="h-11 w-full rounded-xl border-slate-200 bg-white sm:max-w-xs"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="6-digit code"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 flex-1 rounded-xl sm:flex-none"
                          disabled={otpSending}
                          onClick={() => handleSendOtp("email")}
                        >
                          {otpSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Email code
                        </Button>
                        {data.allowSmsOtp ? (
                          <Button
                            type="button"
                            variant="outline"
                            className="h-11 flex-1 rounded-xl sm:flex-none"
                            disabled={otpSending}
                            onClick={() => handleSendOtp("sms")}
                          >
                            SMS code
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    {otpHint ? <p className="mt-1.5 text-xs text-emerald-700">{otpHint}</p> : null}
                    {data.identityAlreadyAttested || data.IdentityAlreadyAttested ? (
                      <p className="mt-1.5 text-xs text-slate-600">Site staff already attested your identity in clinic.</p>
                    ) : null}
                  </div>
                ) : data.identityAlreadyAttested || data.IdentityAlreadyAttested ? (
                  <p className="text-sm text-emerald-800 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                    Identity verified in clinic — OTP not required.
                  </p>
                ) : null}
                {data.allowSignature ? (
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Signature meaning (intent)</label>
                    <textarea
                      className="min-h-[72px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      value={signatureMeaning}
                      onChange={(e) => setSignatureMeaning(e.target.value)}
                    />
                    <label className="mb-1.5 mt-4 block text-sm font-semibold text-slate-700">Signature</label>
                    <SignaturePad onChange={setSignatureData} />
                  </div>
                ) : null}
              </div>
            ) : null}

            {data.canSubmit || data.canDecline ? (
              <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/90 bg-white/95 px-4 py-3 shadow-[0_-8px_32px_-12px_rgba(15,23,42,0.18)] backdrop-blur-md safe-area-pb safe-area-px sm:static sm:border-t sm:border-slate-100 sm:bg-slate-50/80 sm:px-6 sm:py-4 sm:shadow-none">
                <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
                  <div className="flex w-full gap-2 sm:w-auto sm:flex-none">
                    {step > 0 ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 rounded-xl border-slate-300 px-4"
                        onClick={() => setStep((s) => s - 1)}
                      >
                        <ArrowLeft className="mr-1.5 h-4 w-4" />
                        Back
                      </Button>
                    ) : null}
                    {step < maxStep ? (
                      <Button
                        type="button"
                        className="h-11 flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 px-5 font-semibold text-white shadow-md shadow-violet-900/15 hover:from-violet-700 hover:to-purple-600 sm:flex-none"
                        onClick={() => setStep((s) => s + 1)}
                        disabled={
                          (step === 0 && !allVideosWatched) ||
                          (step === 1 && hasQuiz && questions.some((q) => answers[q.id ?? q.Id] == null))
                        }
                      >
                        Continue
                        <ArrowRight className="ml-1.5 h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        className="h-11 flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 px-5 font-semibold text-white shadow-md shadow-violet-900/15 hover:from-violet-700 hover:to-purple-600 sm:flex-none"
                        onClick={handleSubmit}
                        disabled={
                          submitting ||
                          !acknowledged ||
                          !signerName.trim() ||
                          (data.allowSignature && !signatureData) ||
                          (data.allowOtp &&
                            !(data.identityAlreadyAttested || data.IdentityAlreadyAttested) &&
                            String(otpCode).trim().length < 4)
                        }
                      >
                        {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Submit consent
                      </Button>
                    )}
                  </div>
                  {data.canDecline ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full rounded-xl border-slate-300 px-4 text-slate-700 sm:w-auto"
                      onClick={handleDecline}
                      disabled={submitting}
                    >
                      Decline
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </main>
    </div>
  )
}

export default function ParticipantConsentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[radial-gradient(ellipse_at_top,_#ecfdf5_0%,_#f8fafc_45%,_#f1f5f9_100%)] text-slate-600">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <p className="text-sm font-medium">Loading consent…</p>
        </div>
      }
    >
      <ParticipantConsentInner />
    </Suspense>
  )
}
