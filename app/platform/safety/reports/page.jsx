"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import PlatformShell from "@/components/platform/PlatformShell"
import { PLATFORM_LINK, PLATFORM_LINK_BTN, PLATFORM_PRIMARY_BTN } from "@/lib/platform/platformUi"
import { useStudySiteContext } from "@/hooks/useStudySiteContext"
import safetyService from "@/lib/services/safety.service"
import { Loader2 } from "lucide-react"

const DEFAULT_FORM = {
  patientEnrolmentId: "",
  eventTerm: "",
  onsetDate: "",
  awarenessDate: "",
  narrative: "",
  meddraPtCode: "",
  meddraPtTerm: "",
}

function formatUtc(value) {
  if (!value) return "—"
  return new Date(value).toISOString().replace("T", " ").slice(0, 16)
}

export default function SafetyReportsPage() {
  const { studyId, siteId } = useStudySiteContext()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [reports, setReports] = useState([])
  const [form, setForm] = useState(DEFAULT_FORM)

  const load = useCallback(async () => {
    if (!studyId) return
    setLoading(true)
    const res = await safetyService.getReports(studyId, siteId)
    if (res.isSuccess) setReports(Array.isArray(res.data) ? res.data : [])
    setLoading(false)
  }, [studyId, siteId])

  useEffect(() => {
    load()
  }, [load])

  const overdueCount = reports.filter((r) => r.isRegulatoryOverdue).length

  const createDraft = async (e) => {
    e.preventDefault()
    if (!studyId) return
    setMessage("")
    const res = await safetyService.saveReport({
      studyId,
      patientEnrolmentId: Number(form.patientEnrolmentId),
      isSerious: true,
      eventTerm: form.eventTerm || null,
      onsetDate: form.onsetDate || null,
      awarenessDate: form.awarenessDate || null,
      narrative: form.narrative || null,
      meddraPtCode: form.meddraPtCode || null,
      meddraPtTerm: form.meddraPtTerm || null,
      causalityAssessment: "possible",
      outcome: "unknown",
    })
    if (res.isSuccess) {
      setMessage("Draft SAE report created.")
      setForm(DEFAULT_FORM)
      load()
    } else {
      setMessage(res.message || "Failed to create report.")
    }
  }

  const workflow = async (reportId, action) => {
    setMessage("")
    let res
    if (action === "submit") res = await safetyService.submitReport(reportId)
    else if (action === "review") res = await safetyService.startReview(reportId, "Medical review started")
    else res = await safetyService.closeReport(reportId, "Case closed")
    setMessage(res.isSuccess ? `Report ${action} successful.` : res.message || "Action failed.")
    if (res.isSuccess) load()
  }

  return (
    <PlatformShell
      title="SAE reports"
      description="Serious adverse event workflow (Draft → Submitted → Review → Closed). Parallel to AE eCRF — does not modify data entry."
    >
      {!studyId ? (
        <p className="text-sm text-slate-600">Select a study from the workspace header.</p>
      ) : (
        <div className="space-y-6">
          {overdueCount > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-50 p-4">
              <div>
                <p className="text-sm font-medium text-red-800">{overdueCount} overdue SAE report{overdueCount === 1 ? "" : "s"}</p>
                <p className="text-xs text-red-600">Past the 24-hour regulatory reporting window.</p>
              </div>
              <Link
                href="/platform/safety/regulatory"
                className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800"
              >
                Open regulatory inbox
              </Link>
            </div>
          ) : null}

          <form onSubmit={createDraft} className="grid gap-3 rounded-lg border border-slate-100 bg-slate-50 p-4 md:grid-cols-2">
            <input
              required
              type="number"
              min={1}
              placeholder="Patient enrolment ID"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.patientEnrolmentId}
              onChange={(e) => setForm((f) => ({ ...f, patientEnrolmentId: e.target.value }))}
            />
            <input
              placeholder="Event term (verbatim)"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2"
              value={form.eventTerm}
              onChange={(e) => setForm((f) => ({ ...f, eventTerm: e.target.value }))}
            />
            <input
              type="date"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.onsetDate}
              onChange={(e) => setForm((f) => ({ ...f, onsetDate: e.target.value }))}
            />
            <input
              type="date"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={form.awarenessDate}
              onChange={(e) => setForm((f) => ({ ...f, awarenessDate: e.target.value }))}
            />
            <textarea
              placeholder="Narrative (optional)"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2"
              rows={3}
              value={form.narrative}
              onChange={(e) => setForm((f) => ({ ...f, narrative: e.target.value }))}
            />
            <button
              type="submit"
              className={`${PLATFORM_PRIMARY_BTN} md:col-span-2 md:w-fit`}
            >
              Create draft SAE
            </button>
          </form>

          {message ? <p className="text-sm text-slate-600">{message}</p> : null}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : reports.length === 0 ? (
            <p className="text-sm text-slate-500">No SAE reports yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th className="py-2 pr-4">Subject</th>
                    <th className="py-2 pr-4">Event</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">24h due</th>
                    <th className="py-2 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="py-2 pr-4">{r.screeningNo || `#${r.patientEnrolmentId}`}</td>
                      <td className="py-2 pr-4">
                        <Link href={`/platform/safety/reports/${r.id}`} className={PLATFORM_LINK}>
                          {r.eventTerm || "Untitled"}
                        </Link>
                        {r.isRegulatoryOverdue ? (
                          <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            Overdue
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-4 capitalize">{r.status}</td>
                      <td className="py-2 pr-4">
                        {r.regulatoryDueAtUtc ? (
                          <span className={r.isRegulatoryOverdue ? "font-medium text-red-600" : "text-slate-600"}>
                            {formatUtc(r.regulatoryDueAtUtc)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="space-x-2 py-2 pr-4">
                        <Link href={`/platform/safety/reports/${r.id}`} className={PLATFORM_LINK}>
                          {r.status === "draft" ? "Edit" : "View"}
                        </Link>
                        {r.status === "draft" ? (
                          <button type="button" className={PLATFORM_LINK_BTN} onClick={() => workflow(r.id, "submit")}>
                            Submit
                          </button>
                        ) : null}
                        {r.status === "submitted" ? (
                          <button type="button" className={PLATFORM_LINK_BTN} onClick={() => workflow(r.id, "review")}>
                            Review
                          </button>
                        ) : null}
                        {r.status === "submitted" || r.status === "underreview" ? (
                          <button type="button" className={PLATFORM_LINK_BTN} onClick={() => workflow(r.id, "close")}>
                            Close
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </PlatformShell>
  )
}
