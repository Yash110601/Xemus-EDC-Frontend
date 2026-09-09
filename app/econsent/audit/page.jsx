"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import EConsentShell from "@/components/econsent/EConsentShell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useStudyEConsentRequired } from "@/hooks/useStudyEConsentRequired"
import eConsentService from "@/lib/services/eConsent.service"
import {
  EC_CARD,
  EC_EMPTY,
  EC_FIELD,
  EC_LABEL,
  EC_SECTION_HEAD,
  EC_TABLE_WRAP,
  EC_TD,
  EC_TH,
  EC_TR,
  econsentStatusBadge,
} from "@/lib/econsent/econsentUi"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"

function EConsentAuditContent() {
  const { studyId } = useStudyEConsentRequired()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [eventType, setEventType] = useState("")
  const [fromUtc, setFromUtc] = useState("")
  const [toUtc, setToUtc] = useState("")

  const load = useCallback(async () => {
    if (!studyId) return
    setLoading(true)
    try {
      const res = await eConsentService.getAudit(studyId, {
        eventType: eventType || undefined,
        fromUtc: fromUtc ? new Date(fromUtc).toISOString() : undefined,
        toUtc: toUtc ? new Date(toUtc).toISOString() : undefined,
        take: 500,
      })
      if (res?.isSuccess && Array.isArray(res.data)) setRows(res.data)
      else {
        setRows([])
        toast.error(res?.message || "Failed to load audit log")
      }
    } catch {
      setRows([])
      toast.error("Failed to load audit log")
    } finally {
      setLoading(false)
    }
  }, [studyId, eventType, fromUtc, toUtc])

  useEffect(() => {
    void load()
  }, [load])

  const eventTypes = useMemo(() => {
    const set = new Set(rows.map((r) => r.eventType).filter(Boolean))
    return [...set].sort()
  }, [rows])

  const exportCsv = async () => {
    const res = await eConsentService.exportAudit(studyId, {
      eventType: eventType || undefined,
      fromUtc: fromUtc ? new Date(fromUtc).toISOString() : undefined,
      toUtc: toUtc ? new Date(toUtc).toISOString() : undefined,
    })
    if (!res?.isSuccess || !res.data?.csv) {
      // Fallback to client CSV of loaded rows
      const header = ["WhenUtc", "Event", "Actor", "Message"]
      const lines = [
        header.join(","),
        ...rows.map((r) =>
          [
            r.createdAt ? new Date(r.createdAt).toISOString() : "",
            r.eventType || "",
            r.actorName || (r.actorUserId ? `#${r.actorUserId}` : ""),
            String(r.message || "").replaceAll('"', '""'),
          ]
            .map((v) => `"${v}"`)
            .join(","),
        ),
      ]
      const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `econsent-audit-study-${studyId}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      return
    }
    const blob = new Blob([res.data.csv], { type: res.data.contentType || "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = res.data.fileName || `econsent-audit-study-${studyId}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <EConsentShell
      title="Audit trail"
      description="Participant and staff events for invite, sign, approve, reject, and form publish."
    >
      <div className="space-y-4">
        <div className={`${EC_CARD} grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 sm:px-5`}>
          <div>
            <label className={EC_LABEL}>Event type</label>
            <select className={EC_FIELD} value={eventType} onChange={(e) => setEventType(e.target.value)}>
              <option value="">All events</option>
              {eventTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              {!eventTypes.includes("PartySigned") ? <option value="PartySigned">PartySigned</option> : null}
              {!eventTypes.includes("Approved") ? <option value="Approved">Approved</option> : null}
              {!eventTypes.includes("InviteSent") ? <option value="InviteSent">InviteSent</option> : null}
              {!eventTypes.includes("OtpIssued") ? <option value="OtpIssued">OtpIssued</option> : null}
              {!eventTypes.includes("Reassigned") ? <option value="Reassigned">Reassigned</option> : null}
            </select>
          </div>
          <div>
            <label className={EC_LABEL}>From (local)</label>
            <Input type="datetime-local" className={EC_FIELD} value={fromUtc} onChange={(e) => setFromUtc(e.target.value)} />
          </div>
          <div>
            <label className={EC_LABEL}>To (local)</label>
            <Input type="datetime-local" className={EC_FIELD} value={toUtc} onChange={(e) => setToUtc(e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => void load()}>
              Apply
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={rows.length === 0}
              onClick={exportCsv}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              CSV
            </Button>
          </div>
        </div>

        <div className={EC_CARD}>
          <div className={EC_SECTION_HEAD}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">eCONSENT events</h2>
                <p className="mt-0.5 text-xs text-slate-500">Newest events first · timestamps in UTC</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                {loading ? "…" : `${rows.length} event${rows.length === 1 ? "" : "s"}`}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 p-8 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> Loading audit…
            </div>
          ) : rows.length === 0 ? (
            <div className={EC_EMPTY}>
              <p className="font-medium text-slate-700">No audit events yet</p>
              <p>Create forms, invite subjects, or publish versions to populate this log.</p>
            </div>
          ) : (
            <div className={EC_TABLE_WRAP}>
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr>
                    <th className={EC_TH}>When (UTC)</th>
                    <th className={EC_TH}>Event</th>
                    <th className={EC_TH}>Actor</th>
                    <th className={EC_TH}>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className={EC_TR}>
                      <td className={`${EC_TD} whitespace-nowrap text-slate-500`}>
                        {r.createdAt ? new Date(r.createdAt).toISOString().replace("T", " ").slice(0, 19) : "—"}
                      </td>
                      <td className={EC_TD}>
                        <span className={econsentStatusBadge(r.eventType)}>{r.eventType}</span>
                      </td>
                      <td className={EC_TD}>{r.actorName || (r.actorUserId ? `#${r.actorUserId}` : "—")}</td>
                      <td className={`${EC_TD} text-slate-600`}>{r.message || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </EConsentShell>
  )
}

function EConsentAuditFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-2 p-8 text-sm text-slate-600">
      <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> Loading audit trail…
    </div>
  )
}

export default function EConsentAuditPage() {
  return (
    <Suspense fallback={<EConsentAuditFallback />}>
      <EConsentAuditContent />
    </Suspense>
  )
}
