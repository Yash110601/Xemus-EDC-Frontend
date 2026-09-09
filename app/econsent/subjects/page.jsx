"use client"

import { useCallback, useEffect, useState } from "react"
import EConsentShell from "@/components/econsent/EConsentShell"
import ShareConsentInviteDialog from "@/components/econsent/ShareConsentInviteDialog"
import ViewConsentDialog from "@/components/econsent/ViewConsentDialog"
import PickConsentVersionDialog from "@/components/econsent/PickConsentVersionDialog"
import CountersignConsentDialog from "@/components/econsent/CountersignConsentDialog"
import { Button } from "@/components/ui/button"
import { useStudyEConsentRequired } from "@/hooks/useStudyEConsentRequired"
import eConsentService from "@/lib/services/eConsent.service"
import { downloadConsentPdfFromDocument } from "@/lib/econsent/downloadConsentDocument"
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
import { toast } from "sonner"
import { Check, Download, Eye, FileUp, Loader2, PenLine, RefreshCw, Share2, X } from "lucide-react"

const SIGNED_STATUSES = new Set([
  "PendingSiteVerification",
  "Approved",
  "InProgress",
  "Withdrawn",
])

const REASSIGN_STATUSES = new Set([
  "PendingSiteVerification",
  "Approved",
  "Rejected",
  "Declined",
  "Expired",
  "Withdrawn",
])

export default function EConsentSubjectsPage() {
  const { studyId } = useStudyEConsentRequired()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState("")
  const [busyId, setBusyId] = useState(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [sharePreparing, setSharePreparing] = useState(false)
  const [sharePayload, setSharePayload] = useState({
    inviteUrl: "",
    contactEmail: "",
    contactMobile: "",
    enrolmentId: null,
    emailSent: false,
    expiresAt: null,
  })
  const [viewOpen, setViewOpen] = useState(false)
  const [viewId, setViewId] = useState(null)
  const [pickVersionOpen, setPickVersionOpen] = useState(false)
  const [reassignRow, setReassignRow] = useState(null)
  const [countersignOpen, setCountersignOpen] = useState(false)
  const [countersignId, setCountersignId] = useState(null)

  const load = useCallback(async () => {
    if (!studyId) return
    setLoading(true)
    try {
      const res = await eConsentService.getSubjects(studyId, statusFilter || undefined)
      if (res?.isSuccess && Array.isArray(res.data)) setRows(res.data)
      else {
        setRows([])
        toast.error(res?.message || "Failed to load consent subjects")
      }
    } catch {
      setRows([])
      toast.error("Failed to load consent subjects")
    } finally {
      setLoading(false)
    }
  }, [studyId, statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  const openShare = async (row, partyId = null) => {
    setBusyId(row.id)
    setSharePreparing(true)
    setSharePayload({
      inviteUrl: "",
      contactEmail: "",
      contactMobile: "",
      enrolmentId: row.patientEnrolmentId,
      emailSent: false,
      expiresAt: null,
    })
    setShareOpen(true)

    const prepare = async () => eConsentService.sendInvite(row.id, partyId)

    try {
      let res = await prepare()
      const networkFail =
        !res?.isSuccess &&
        (/failed to fetch|network error|load failed|networkerror/i.test(String(res?.message || "")) ||
          res?.statusCode === 0 ||
          res?.httpStatus === 0)

      if (networkFail) {
        await new Promise((r) => setTimeout(r, 900))
        res = await prepare()
      }

      if (res?.isSuccess && res.data) {
        setSharePayload({
          inviteUrl: res.data.inviteUrl || "",
          contactEmail: res.data.contactEmail || "",
          contactMobile: res.data.contactMobile || "",
          enrolmentId: row.patientEnrolmentId,
          emailSent: Boolean(res.data.emailSent),
          expiresAt: res.data.inviteTokenExpiresAt || null,
        })
        if (res.data.emailSent) toast.success("Invite email sent")
        else if (res.data.inviteUrl) toast.message("Invite link ready to share")
        await load()
      } else {
        const msg = res?.message || "Could not prepare invite"
        toast.error(
          /failed to fetch|network error/i.test(msg)
            ? "API not reachable. Confirm the backend is running on localhost:5154, then try again."
            : msg,
        )
        setShareOpen(false)
      }
    } catch (err) {
      toast.error(
        /failed to fetch|network error/i.test(String(err?.message || ""))
          ? "API not reachable. Confirm the backend is running on localhost:5154, then try again."
          : "Could not prepare invite",
      )
      setShareOpen(false)
    } finally {
      setSharePreparing(false)
      setBusyId(null)
    }
  }

  const runAction = async (id, action) => {
    setBusyId(id)
    try {
      let res
      if (action === "approve") res = await eConsentService.approve(id)
      else res = await eConsentService.reject(id)

      if (res?.isSuccess) {
        if (action === "approve") toast.success("Consent approved — subject is study-eligible")
        else toast.success("Consent rejected")
        await load()
      } else toast.error(res?.message || "Action failed")
    } catch {
      toast.error("Action failed")
    } finally {
      setBusyId(null)
    }
  }

  const downloadPdf = async (row) => {
    setBusyId(row.id)
    try {
      const res = await eConsentService.getSubjectDocument(row.id)
      if (!res?.isSuccess || !res.data) {
        toast.error(res?.message || "Document not available yet")
        return
      }
      downloadConsentPdfFromDocument(res.data)
      toast.success("Consent PDF downloaded")
    } catch {
      toast.error("Download failed")
    } finally {
      setBusyId(null)
    }
  }

  const reassign = (row) => {
    setReassignRow(row)
    setPickVersionOpen(true)
  }

  const confirmReassign = async (formVersionId, _options, amendmentReason) => {
    if (!reassignRow?.id) return
    setBusyId(reassignRow.id)
    try {
      const res = await eConsentService.reassignSubject(
        reassignRow.id,
        formVersionId,
        amendmentReason,
      )
      if (res?.isSuccess && res.data) {
        toast.success(res.message || "Consent reassigned — share the new invite")
        await load()
        await openShare(res.data)
      } else {
        toast.error(res?.message || "Reassign failed")
        throw new Error(res?.message || "Reassign failed")
      }
    } finally {
      setBusyId(null)
      setReassignRow(null)
    }
  }

  return (
    <EConsentShell
      title="Subject consents"
      description="Share invites, review signed consent, download PDF, approve, or reassign."
    >
      <div className="space-y-4">
        <div className={`${EC_CARD} flex flex-wrap items-end gap-3 p-4 sm:px-5`}>
          <div className="min-w-[200px]">
            <label className={EC_LABEL}>Status filter</label>
            <select
              className={EC_FIELD}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="PendingInvite">Pending invite</option>
              <option value="InProgress">In progress</option>
              <option value="PendingSiteVerification">Pending site verification</option>
              <option value="Approved">Approved</option>
              <option value="Declined">Declined</option>
              <option value="Rejected">Rejected</option>
              <option value="Withdrawn">Withdrawn</option>
            </select>
          </div>
          <p className="pb-2 text-xs text-slate-500">
            {loading ? "Refreshing…" : `${rows.length} consent record${rows.length === 1 ? "" : "s"}`}
          </p>
        </div>

        <div className={EC_CARD}>
          <div className={EC_SECTION_HEAD}>
            <h2 className="text-sm font-semibold text-slate-900">Consent queue</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              View signed packets, download PDF anytime, and reassign for a new invite when needed.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 p-8 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-600" /> Loading subjects…
            </div>
          ) : rows.length === 0 ? (
            <div className={EC_EMPTY}>
              <p className="font-medium text-slate-700">No subject consents yet</p>
              <p>Enrol a patient with eCONSENT enabled to create a pending invite.</p>
            </div>
          ) : (
            <div className={EC_TABLE_WRAP}>
              <table className="w-full min-w-[820px]">
                <thead>
                  <tr>
                    <th className={EC_TH}>Enrolment</th>
                    <th className={EC_TH}>Jurisdiction</th>
                    <th className={EC_TH}>Age</th>
                    <th className={EC_TH}>Status</th>
                    <th className={EC_TH}>Parties</th>
                    <th className={EC_TH}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const busy = busyId === r.id
                    const canShare = ["PendingInvite", "InProgress"].includes(r.status)
                    const canApprove = r.status === "PendingSiteVerification"
                    const canWithdraw = ["Approved", "PendingSiteVerification", "InProgress", "PendingInvite"].includes(
                      r.status,
                    )
                    const canCountersign =
                      r.status === "InProgress" &&
                      (r.parties || []).some(
                        (p) => p.role === "Investigator" && p.signStatus !== "Signed",
                      )
                    const canReject = !["Approved", "Rejected", "Declined", "Withdrawn", "Expired"].includes(
                      r.status,
                    )
                    const canView = true
                    const canDownload = SIGNED_STATUSES.has(r.status)
                    const canReassign = REASSIGN_STATUSES.has(r.status)
                    const canWetInk = ["PendingInvite", "InProgress", "PendingSiteVerification"].includes(r.status)
                    return (
                      <tr key={r.id} className={EC_TR}>
                        <td className={`${EC_TD} font-semibold text-slate-900`}>{r.patientEnrolmentId}</td>
                        <td className={EC_TD}>{r.jurisdictionCode}</td>
                        <td className={EC_TD}>{r.subjectAgeAtConsent ?? "—"}</td>
                        <td className={EC_TD}>
                          <span className={econsentStatusBadge(r.status)}>{r.status}</span>
                        </td>
                        <td className={`${EC_TD} max-w-[220px] text-xs text-slate-500`}>
                          {(r.parties || []).map((p) => `${p.role}:${p.signStatus}`).join(", ") || "—"}
                        </td>
                        <td className={EC_TD}>
                          <div className="flex flex-wrap gap-1.5">
                            {canView ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-lg"
                                disabled={busy}
                                onClick={() => {
                                  setViewId(r.id)
                                  setViewOpen(true)
                                }}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                View
                              </Button>
                            ) : null}
                            {canDownload ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-lg"
                                disabled={busy}
                                onClick={() => downloadPdf(r)}
                              >
                                {busy ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Download className="h-3.5 w-3.5" />
                                )}
                                PDF
                              </Button>
                            ) : null}
                            {canShare ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="brand"
                                className="rounded-lg"
                                disabled={busy}
                                onClick={() => openShare(r)}
                              >
                                {busy ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Share2 className="h-3.5 w-3.5" />
                                )}
                                Share invite
                              </Button>
                            ) : null}
                            {canWetInk ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-lg"
                                disabled={busy}
                                onClick={() => {
                                  setViewId(r.id)
                                  setViewOpen(true)
                                }}
                              >
                                <FileUp className="h-3.5 w-3.5" />
                                Wet-ink
                              </Button>
                            ) : null}
                            {canReassign ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-lg"
                                disabled={busy}
                                onClick={() => reassign(r)}
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                                Reassign
                              </Button>
                            ) : null}
                            {canCountersign ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-lg"
                                disabled={busy}
                                onClick={() => {
                                  setCountersignId(r.id)
                                  setCountersignOpen(true)
                                }}
                              >
                                <PenLine className="h-3.5 w-3.5" />
                                Countersign
                              </Button>
                            ) : null}
                            {canWithdraw ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-lg border-amber-200 text-amber-800 hover:bg-amber-50"
                                disabled={busy}
                                onClick={async () => {
                                  const reasonCode =
                                    window.prompt(
                                      "Withdrawal reason code (SubjectRequest, Safety, ProtocolAmendment, LostToFollowUp, Other):",
                                      "SubjectRequest",
                                    ) || "SubjectRequest"
                                  const notes = window.prompt("Optional notes:") || null
                                  setBusyId(r.id)
                                  try {
                                    const res = await eConsentService.withdraw(r.id, { reasonCode, notes })
                                    if (res?.isSuccess) {
                                      toast.success("Consent withdrawn")
                                      await load()
                                    } else toast.error(res?.message || "Withdraw failed")
                                  } finally {
                                    setBusyId(null)
                                  }
                                }}
                              >
                                Withdraw
                              </Button>
                            ) : null}
                            {canApprove ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-lg"
                                disabled={busy}
                                onClick={() => runAction(r.id, "approve")}
                              >
                                <Check className="h-3.5 w-3.5" />
                                Approve
                              </Button>
                            ) : null}
                            {canReject ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-lg border-rose-200 text-rose-700 hover:bg-rose-50"
                                disabled={busy}
                                onClick={() => runAction(r.id, "reject")}
                              >
                                <X className="h-3.5 w-3.5" />
                                Reject
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ShareConsentInviteDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        preparing={sharePreparing}
        inviteUrl={sharePayload.inviteUrl}
        contactEmail={sharePayload.contactEmail}
        contactMobile={sharePayload.contactMobile}
        enrolmentId={sharePayload.enrolmentId}
        emailSent={sharePayload.emailSent}
        expiresAt={sharePayload.expiresAt}
      />

      <ViewConsentDialog
        open={viewOpen}
        onOpenChange={setViewOpen}
        subjectConsentId={viewId}
        onInviteParty={async (consentId, partyId) => {
          setViewOpen(false)
          await openShare({ id: consentId, patientEnrolmentId: null }, partyId)
        }}
      />

      <PickConsentVersionDialog
        open={pickVersionOpen}
        onOpenChange={(open) => {
          setPickVersionOpen(open)
          if (!open) setReassignRow(null)
        }}
        studyId={studyId}
        title="Reassign consent"
        description="Choose which published consent version to assign. The current record is withdrawn and kept for audit."
        confirmLabel="Reassign"
        showAmendmentReason
        onConfirm={confirmReassign}
      />

      <CountersignConsentDialog
        open={countersignOpen}
        onOpenChange={(open) => {
          setCountersignOpen(open)
          if (!open) setCountersignId(null)
        }}
        subjectConsentId={countersignId}
        onDone={load}
      />
    </EConsentShell>
  )
}
