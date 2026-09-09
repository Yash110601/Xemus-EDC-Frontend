"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import PlatformShell from "@/components/platform/PlatformShell"
import {
  PLATFORM_LINK,
  PLATFORM_LINK_BTN,
  PLATFORM_PHASE_BANNER_SOFT,
  PLATFORM_PHASE_BANNER_LABEL,
  PLATFORM_PRIMARY_BTN,
} from "@/lib/platform/platformUi"
import { useStudySiteContext } from "@/hooks/useStudySiteContext"
import safetyService from "@/lib/services/safety.service"
import { searchMeddraIndications } from "@/lib/services/terminologyCoding.service"
import { Loader2 } from "lucide-react"

const CAUSALITY_OPTIONS = [
  { value: "notrelated", label: "Not related" },
  { value: "possible", label: "Possible" },
  { value: "probable", label: "Probable" },
  { value: "related", label: "Related" },
]

const OUTCOME_OPTIONS = [
  { value: "unknown", label: "Unknown" },
  { value: "recovered", label: "Recovered" },
  { value: "recovering", label: "Recovering" },
  { value: "notrecovered", label: "Not recovered" },
  { value: "fatal", label: "Fatal" },
]

function toDateInput(value) {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ""
  return d.toISOString().slice(0, 10)
}

function formatUtc(value) {
  if (!value) return "—"
  return new Date(value).toISOString().replace("T", " ").slice(0, 16)
}

export default function SafetyReportDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { studyId } = useStudySiteContext()
  const reportId = Number(params.reportId)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [report, setReport] = useState(null)
  const [guidance, setGuidance] = useState([])
  const [meddraQuery, setMeddraQuery] = useState("")
  const [meddraHits, setMeddraHits] = useState([])
  const [reviewNotes, setReviewNotes] = useState("")

  const [form, setForm] = useState({
    eventTerm: "",
    onsetDate: "",
    awarenessDate: "",
    narrative: "",
    meddraPtCode: "",
    meddraPtTerm: "",
    causalityAssessment: "possible",
    outcome: "unknown",
    isSerious: true,
  })

  const load = useCallback(async () => {
    if (!reportId) return
    setLoading(true)
    const res = await safetyService.getReportById(reportId)
    if (!res.isSuccess) {
      setMessage(res.message || "Failed to load report.")
      setLoading(false)
      return
    }
    const data = res.data
    setReport(data)
    setForm({
      eventTerm: data.eventTerm || "",
      onsetDate: toDateInput(data.onsetDate),
      awarenessDate: toDateInput(data.awarenessDate),
      narrative: data.narrative || "",
      meddraPtCode: data.meddraPtCode || "",
      meddraPtTerm: data.meddraPtTerm || "",
      causalityAssessment: data.causalityAssessment || "possible",
      outcome: data.outcome || "unknown",
      isSerious: data.isSerious !== false,
    })
    setMeddraQuery(data.meddraPtTerm || "")
    if (studyId) {
      const gRes = await safetyService.getPhaseGuidance(studyId)
      if (gRes.isSuccess) setGuidance(Array.isArray(gRes.data) ? gRes.data : [])
    }
    setLoading(false)
  }, [reportId, studyId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (meddraQuery.trim().length < 2) {
      setMeddraHits([])
      return
    }
    const timer = setTimeout(async () => {
      const res = await searchMeddraIndications(meddraQuery, { pageSize: 8 })
      setMeddraHits(res.ok ? res.items : [])
    }, 300)
    return () => clearTimeout(timer)
  }, [meddraQuery])

  const isDraft = report?.status === "draft"

  const saveDraft = async (e) => {
    e.preventDefault()
    if (!report || !studyId || !isDraft) return
    setSaving(true)
    setMessage("")
    const res = await safetyService.saveReport({
      id: report.id,
      studyId,
      patientEnrolmentId: report.patientEnrolmentId,
      isSerious: form.isSerious,
      eventTerm: form.eventTerm || null,
      onsetDate: form.onsetDate || null,
      awarenessDate: form.awarenessDate || null,
      narrative: form.narrative || null,
      meddraPtCode: form.meddraPtCode || null,
      meddraPtTerm: form.meddraPtTerm || null,
      causalityAssessment: form.causalityAssessment,
      outcome: form.outcome,
    })
    setSaving(false)
    setMessage(res.isSuccess ? "Draft saved." : res.message || "Save failed.")
    if (res.isSuccess) load()
  }

  const workflow = async (action) => {
    setMessage("")
    let res
    if (action === "submit") res = await safetyService.submitReport(reportId)
    else if (action === "review") res = await safetyService.startReview(reportId, reviewNotes || "Medical review started")
    else res = await safetyService.closeReport(reportId, reviewNotes || "Case closed")
    setMessage(res.isSuccess ? `Report ${action} successful.` : res.message || "Action failed.")
    if (res.isSuccess) load()
  }

  const selectMeddra = (hit) => {
    setForm((f) => ({ ...f, meddraPtCode: hit.code, meddraPtTerm: hit.display.split(" — ")[0] || hit.display }))
    setMeddraQuery(hit.display.split(" — ")[0] || hit.display)
    setMeddraHits([])
  }

  return (
    <PlatformShell
      title={report ? `SAE: ${report.eventTerm || "Untitled"}` : "SAE report"}
      description="Full SAE detail — MedDRA coding, causality, outcome, and regulatory workflow."
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : !report ? (
        <p className="text-sm text-slate-500">{message || "Report not found."}</p>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link href="/platform/safety/reports" className={PLATFORM_LINK}>
              ← Back to SAE reports
            </Link>
            <span className="text-slate-400">|</span>
            <span>
              Subject: <strong>{report.screeningNo || `#${report.patientEnrolmentId}`}</strong>
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize">{report.status}</span>
            {report.isRegulatoryOverdue ? (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Overdue</span>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="text-xs text-slate-500">24h regulatory due</p>
              <p className={report.isRegulatoryOverdue ? "font-medium text-red-600" : "text-slate-800"}>
                {formatUtc(report.regulatoryDueAtUtc)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="text-xs text-slate-500">Submitted</p>
              <p>{formatUtc(report.submittedAtUtc)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="text-xs text-slate-500">Closed</p>
              <p>{formatUtc(report.closedAtUtc)}</p>
            </div>
          </div>

          {guidance.length > 0 ? (
            <div className={PLATFORM_PHASE_BANNER_SOFT}>
              <p className={PLATFORM_PHASE_BANNER_LABEL}>
                Phase guidance ({guidance[0]?.studyPhaseLabel})
              </p>
              <ul className="space-y-2 text-sm text-slate-700">
                {guidance.map((g) => (
                  <li key={g.code}>
                    <strong>{g.title}</strong> — {g.description}
                    {g.reportingNotes ? <span className="block text-xs text-slate-500">{g.reportingNotes}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <form onSubmit={saveDraft} className="space-y-4 rounded-lg border border-slate-200 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm md:col-span-2">
                <span className="text-slate-600">Event term (verbatim)</span>
                <input
                  disabled={!isDraft}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  value={form.eventTerm}
                  onChange={(e) => setForm((f) => ({ ...f, eventTerm: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">Onset date</span>
                <input
                  disabled={!isDraft}
                  type="date"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  value={form.onsetDate}
                  onChange={(e) => setForm((f) => ({ ...f, onsetDate: e.target.value }))}
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">Awareness date</span>
                <input
                  disabled={!isDraft}
                  type="date"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  value={form.awarenessDate}
                  onChange={(e) => setForm((f) => ({ ...f, awarenessDate: e.target.value }))}
                />
              </label>
              <label className="relative block text-sm md:col-span-2">
                <span className="text-slate-600">MedDRA Preferred Term</span>
                <input
                  disabled={!isDraft}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  placeholder="Search MedDRA…"
                  value={meddraQuery}
                  onChange={(e) => setMeddraQuery(e.target.value)}
                />
                {isDraft && meddraHits.length > 0 ? (
                  <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
                    {meddraHits.map((hit) => (
                      <li key={hit.uid}>
                        <button
                          type="button"
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-[#E7F6EF]"
                          onClick={() => selectMeddra(hit)}
                        >
                          {hit.display}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {form.meddraPtCode ? (
                  <p className="mt-1 text-xs text-slate-500">PT code: {form.meddraPtCode}</p>
                ) : null}
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">Causality</span>
                <select
                  disabled={!isDraft}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  value={form.causalityAssessment}
                  onChange={(e) => setForm((f) => ({ ...f, causalityAssessment: e.target.value }))}
                >
                  {CAUSALITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">Outcome</span>
                <select
                  disabled={!isDraft}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  value={form.outcome}
                  onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))}
                >
                  {OUTCOME_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm md:col-span-2">
                <input
                  disabled={!isDraft}
                  type="checkbox"
                  checked={form.isSerious}
                  onChange={(e) => setForm((f) => ({ ...f, isSerious: e.target.checked }))}
                />
                Serious adverse event
              </label>
              <label className="block text-sm md:col-span-2">
                <span className="text-slate-600">Narrative</span>
                <textarea
                  disabled={!isDraft}
                  rows={5}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
                  value={form.narrative}
                  onChange={(e) => setForm((f) => ({ ...f, narrative: e.target.value }))}
                />
              </label>
            </div>

            {isDraft ? (
              <button
                type="submit"
                disabled={saving}
                className={PLATFORM_PRIMARY_BTN}
              >
                {saving ? "Saving…" : "Save draft"}
              </button>
            ) : null}
          </form>

          {report.reviewNotes ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="text-xs text-slate-500">Review notes</p>
              <p>{report.reviewNotes}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-end gap-3 border-t border-slate-200 pt-4">
            {report.status === "draft" ? (
              <button
                type="button"
                onClick={() => workflow("submit")}
                className={PLATFORM_PRIMARY_BTN}
              >
                Submit report
              </button>
            ) : null}
            {report.status === "submitted" ? (
              <button
                type="button"
                onClick={() => workflow("review")}
                className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
              >
                Start review
              </button>
            ) : null}
            {report.status === "submitted" || report.status === "underreview" ? (
              <button
                type="button"
                onClick={() => workflow("close")}
                className={PLATFORM_PRIMARY_BTN}
              >
                Close case
              </button>
            ) : null}
            {(report.status === "submitted" || report.status === "underreview") && (
              <input
                placeholder="Review notes (optional)"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
              />
            )}
            {report.status === "closed" ? (
              <button
                type="button"
                onClick={() => router.push("/platform/safety/reports")}
                className={`text-sm ${PLATFORM_LINK_BTN}`}
              >
                Return to list
              </button>
            ) : null}
          </div>

          {message ? <p className="text-sm text-slate-600">{message}</p> : null}
        </div>
      )}
    </PlatformShell>
  )
}
