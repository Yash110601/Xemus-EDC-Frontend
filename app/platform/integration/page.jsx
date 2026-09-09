"use client"

import { useCallback, useEffect, useState } from "react"
import PlatformShell from "@/components/platform/PlatformShell"
import { PLATFORM_GHOST_BTN, PLATFORM_PRIMARY_BTN_SM } from "@/lib/platform/platformUi"
import { useStudySiteContext } from "@/hooks/useStudySiteContext"
import platformService from "@/lib/services/platform.service"
import { Loader2 } from "lucide-react"

export default function PlatformIntegrationPage() {
  const { studyId } = useStudySiteContext()
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState("")
  const [events, setEvents] = useState([])
  const [total, setTotal] = useState(0)

  const load = useCallback(async () => {
    if (!studyId) return
    setLoading(true)
    const res = await platformService.getIntegrationEvents(studyId)
    if (res.isSuccess && res.data) {
      setEvents(res.data.items ?? res.data.Items ?? [])
      setTotal(res.data.totalCount ?? res.data.TotalCount ?? 0)
    }
    setLoading(false)
  }, [studyId])

  useEffect(() => {
    load()
  }, [load])

  const sendTest = async () => {
    if (!studyId) return
    setTesting(true)
    setMessage("")
    const res = await platformService.publishTestEvent(studyId)
    setTesting(false)
    if (res.isSuccess) {
      setMessage(`Test event recorded (${res.data?.status ?? "ok"}).`)
      load()
    } else {
      setMessage(res.message || "Test event failed.")
    }
  }

  return (
    <PlatformShell
      title="Integration hub"
      description="Outbound event log for enterprise listeners. Does not alter eCONSENT webhooks."
    >
      {!studyId ? (
        <p className="text-sm text-slate-600">Select a study to view integration events.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={sendTest}
              disabled={testing}
              className={`${PLATFORM_PRIMARY_BTN_SM} disabled:opacity-50`}
            >
              {testing ? "Sending…" : "Send test event"}
            </button>
            <button
              type="button"
              onClick={load}
              className={PLATFORM_GHOST_BTN}
            >
              Refresh
            </button>
            {message ? <span className="text-sm text-slate-600">{message}</span> : null}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading events…
            </div>
          ) : events.length === 0 ? (
            <p className="text-sm text-slate-500">No integration events yet ({total} total).</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th className="py-2 pr-4">Time (UTC)</th>
                    <th className="py-2 pr-4">Module</th>
                    <th className="py-2 pr-4">Event</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">HTTP</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id} className="border-b border-slate-100">
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {e.createdAtUtc ? new Date(e.createdAtUtc).toISOString().replace("T", " ").slice(0, 19) : "—"}
                      </td>
                      <td className="py-2 pr-4">{e.sourceModule}</td>
                      <td className="py-2 pr-4">{e.eventType}</td>
                      <td className="py-2 pr-4">{e.status}</td>
                      <td className="py-2 pr-4">{e.httpStatusCode ?? "—"}</td>
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
