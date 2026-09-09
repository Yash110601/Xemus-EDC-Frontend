"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import eConsentService from "@/lib/services/eConsent.service"
import {
  downloadConsentHtmlFromDocument,
  downloadConsentPdfFromDocument,
} from "@/lib/econsent/downloadConsentDocument"
import { toast } from "sonner"
import { Download, Loader2, Share2, Upload } from "lucide-react"

/**
 * CRC view of signed / in-progress subject consent with PDF/HTML download and party contacts.
 */
export default function ViewConsentDialog({ open, onOpenChange, subjectConsentId, onInviteParty }) {
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [savingPartyId, setSavingPartyId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [edits, setEdits] = useState({})
  const [wetInkBusy, setWetInkBusy] = useState(false)

  const reload = async () => {
    if (!subjectConsentId) return
    const res = await eConsentService.getSubjectDetail(subjectConsentId)
    if (res?.isSuccess && res.data) {
      setDetail(res.data)
      const parties = res.data.partyDetails || res.data.PartyDetails || []
      const next = {}
      for (const p of parties) {
        const id = p.id ?? p.Id
        next[id] = {
          displayName: p.displayName || p.DisplayName || "",
          contactEmail: p.contactEmail || p.ContactEmail || "",
          contactMobile: p.contactMobile || p.ContactMobile || "",
        }
      }
      setEdits(next)
    } else {
      setDetail(null)
      toast.error(res?.message || "Could not load consent")
    }
  }

  useEffect(() => {
    if (!open || !subjectConsentId) {
      setDetail(null)
      setEdits({})
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        await reload()
      } catch {
        if (!cancelled) {
          setDetail(null)
          toast.error("Could not load consent")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, subjectConsentId])

  const handleDownload = async (format = "pdf") => {
    if (!subjectConsentId) return
    setDownloading(true)
    try {
      const res = await eConsentService.getSubjectDocument(subjectConsentId)
      if (!res?.isSuccess || !res.data) {
        toast.error(res?.message || "Document not available")
        return
      }
      if (format === "html") {
        downloadConsentHtmlFromDocument(res.data)
        toast.success("Consent HTML downloaded")
      } else {
        downloadConsentPdfFromDocument(res.data)
        toast.success("Consent PDF downloaded")
      }
    } catch {
      toast.error("Download failed")
    } finally {
      setDownloading(false)
    }
  }

  const saveParty = async (partyId) => {
    const draft = edits[partyId]
    if (!draft) return
    setSavingPartyId(partyId)
    try {
      const res = await eConsentService.updatePartyContact(subjectConsentId, partyId, {
        displayName: draft.displayName || null,
        contactEmail: draft.contactEmail || null,
        contactMobile: draft.contactMobile || null,
      })
      if (res?.isSuccess) {
        toast.success("Party contact updated")
        await reload()
      } else toast.error(res?.message || "Update failed")
    } catch {
      toast.error("Update failed")
    } finally {
      setSavingPartyId(null)
    }
  }

  const parties = detail?.partyDetails || detail?.PartyDetails || []
  const sections = detail?.sections || detail?.Sections || []
  const contentHtml = detail?.contentHtml || detail?.ContentHtml || ""
  const canDownload = Boolean(detail?.canDownload ?? detail?.CanDownload)
  const status = detail?.status || detail?.Status || ""
  const canEditContacts = ["PendingInvite", "InProgress"].includes(status)
  const isWetInk = Boolean(detail?.isWetInk ?? detail?.IsWetInk)
  const hasArchival = Boolean(detail?.hasArchivalCopy ?? detail?.HasArchivalCopy)
  const canDownloadArchival = Boolean(detail?.canDownloadArchival ?? detail?.CanDownloadArchival)
  const canDownloadWetInk = Boolean(detail?.canDownloadWetInk ?? detail?.CanDownloadWetInk)
  const canUploadWetInk = ["PendingInvite", "InProgress", "PendingSiteVerification"].includes(status)

  const handleWetInkUpload = async (file) => {
    if (!file || !subjectConsentId) return
    setWetInkBusy(true)
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = String(reader.result || "")
          const comma = result.indexOf(",")
          resolve(comma >= 0 ? result.slice(comma + 1) : result)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const res = await eConsentService.uploadWetInk(subjectConsentId, {
        fileName: file.name,
        contentType: file.type || "application/pdf",
        fileBase64: base64,
        markReadyForVerification: true,
        notes: "Uploaded from site console",
      })
      if (res?.isSuccess) {
        toast.success("Wet-ink scan uploaded — ready for site verification")
        await reload()
      } else toast.error(res?.message || "Wet-ink upload failed")
    } catch {
      toast.error("Wet-ink upload failed")
    } finally {
      setWetInkBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="bg-black/70 backdrop-blur-md"
        className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden rounded-2xl border-slate-200 bg-white p-0 opacity-100 sm:max-w-3xl"
      >
        <DialogHeader className="border-b border-slate-100 px-6 py-4 text-left">
          <DialogTitle className="text-slate-900">
            {detail?.formName || detail?.FormName || "Consent record"}
          </DialogTitle>
          <DialogDescription className="text-slate-600">
            Version {detail?.versionLabel || detail?.VersionLabel || "—"} · Enrolment #
            {detail?.patientEnrolmentId ?? detail?.PatientEnrolmentId ?? "—"} · {status || "—"}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
              Loading consent…
            </div>
          ) : !detail ? (
            <p className="py-10 text-center text-sm text-slate-600">No consent details available.</p>
          ) : (
            <div className="space-y-6">
              {(isWetInk || hasArchival || canUploadWetInk) && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm">
                  <h3 className="mb-1 text-sm font-semibold text-slate-900">Hybrid / archival</h3>
                  {isWetInk ? (
                    <p className="text-xs text-slate-600">
                      Wet-ink on file: {detail?.wetInkFileName || detail?.WetInkFileName || "scan"}
                      {(detail?.wetInkUploadedAt || detail?.WetInkUploadedAt) &&
                        ` · ${String(detail?.wetInkUploadedAt || detail?.WetInkUploadedAt)}`}
                    </p>
                  ) : null}
                  {hasArchival ? (
                    <p className="mt-1 text-xs text-emerald-800">
                      Certified archive stored
                      {(detail?.archivalSha256 || detail?.ArchivalSha256)
                        ? ` · SHA-256 ${(detail?.archivalSha256 || detail?.ArchivalSha256).slice(0, 16)}…`
                        : ""}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {canDownloadArchival ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-lg"
                        disabled={downloading}
                        onClick={async () => {
                          setDownloading(true)
                          try {
                            const res = await eConsentService.downloadArchival(subjectConsentId)
                            if (res?.isSuccess) toast.success("Archival copy downloaded")
                            else toast.error(res?.message || "Download failed")
                          } finally {
                            setDownloading(false)
                          }
                        }}
                      >
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        Archival copy
                      </Button>
                    ) : null}
                    {canDownloadWetInk ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-lg"
                        disabled={downloading}
                        onClick={async () => {
                          setDownloading(true)
                          try {
                            const res = await eConsentService.downloadWetInk(subjectConsentId)
                            if (res?.isSuccess) toast.success("Wet-ink scan downloaded")
                            else toast.error(res?.message || "Download failed")
                          } finally {
                            setDownloading(false)
                          }
                        }}
                      >
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        Wet-ink scan
                      </Button>
                    ) : null}
                  </div>
                  {canUploadWetInk ? (
                    <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-emerald-800">
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        className="hidden"
                        disabled={wetInkBusy}
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          e.target.value = ""
                          if (f) void handleWetInkUpload(f)
                        }}
                      />
                      {wetInkBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                      {isWetInk ? "Replace wet-ink scan" : "Upload wet-ink PDF / image"}
                    </label>
                  ) : null}
                </div>
              )}

              {sections.length > 0 ? (
                sections.map((s) => (
                  <section key={s.id ?? s.Id}>
                    <h3 className="mb-2 text-sm font-semibold text-slate-900">{s.title || s.Title}</h3>
                    <div
                      className="prose prose-sm max-w-none text-slate-800"
                      dangerouslySetInnerHTML={{
                        __html: String(s.content || s.Content || "").includes("<")
                          ? s.content || s.Content
                          : `<p>${s.content || s.Content || ""}</p>`,
                      }}
                    />
                  </section>
                ))
              ) : (
                <div
                  className="prose prose-sm max-w-none text-slate-800"
                  dangerouslySetInnerHTML={{ __html: contentHtml || "<p>No content.</p>" }}
                />
              )}

              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Parties & contacts</h3>
                <div className="space-y-3">
                  {parties.length === 0 ? (
                    <p className="text-sm text-slate-500">No parties recorded.</p>
                  ) : (
                    parties.map((p) => {
                      const id = p.id ?? p.Id
                      const sig = p.signatureData || p.SignatureData
                      const draft = edits[id] || {}
                      const role = p.role || p.Role
                      return (
                        <div
                          key={id}
                          className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 space-y-2"
                        >
                          <p className="text-sm font-semibold text-slate-900">
                            {role}
                            {draft.displayName ? ` — ${draft.displayName}` : ""}
                          </p>
                          <p className="text-xs text-slate-500">
                            {p.signStatus || p.SignStatus}
                            {(p.signedAt || p.SignedAt) &&
                              ` · ${new Date(p.signedAt || p.SignedAt).toISOString().replace("T", " ").slice(0, 16)} UTC`}
                          </p>
                          {canEditContacts && role !== "Investigator" ? (
                            <div className="grid gap-2 sm:grid-cols-3">
                              <Input
                                placeholder="Display name"
                                value={draft.displayName || ""}
                                onChange={(e) =>
                                  setEdits((prev) => ({
                                    ...prev,
                                    [id]: { ...prev[id], displayName: e.target.value },
                                  }))
                                }
                              />
                              <Input
                                placeholder="Email"
                                value={draft.contactEmail || ""}
                                onChange={(e) =>
                                  setEdits((prev) => ({
                                    ...prev,
                                    [id]: { ...prev[id], contactEmail: e.target.value },
                                  }))
                                }
                              />
                              <Input
                                placeholder="Mobile"
                                value={draft.contactMobile || ""}
                                onChange={(e) =>
                                  setEdits((prev) => ({
                                    ...prev,
                                    [id]: { ...prev[id], contactMobile: e.target.value },
                                  }))
                                }
                              />
                              <div className="sm:col-span-3 flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg"
                                  disabled={savingPartyId === id}
                                  onClick={() => saveParty(id)}
                                >
                                  {savingPartyId === id ? (
                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                  ) : null}
                                  Save contact
                                </Button>
                                {onInviteParty ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="rounded-lg"
                                    onClick={() => onInviteParty(subjectConsentId, id)}
                                  >
                                    <Share2 className="mr-1.5 h-3.5 w-3.5" />
                                    Invite this party
                                  </Button>
                                ) : null}
                                {(p.signStatus || p.SignStatus) !== "Signed" ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="rounded-lg"
                                    disabled={savingPartyId === id}
                                    onClick={async () => {
                                      const attestorName = window.prompt("Staff name attesting identity in clinic:")
                                      if (!attestorName?.trim()) return
                                      setSavingPartyId(id)
                                      try {
                                        const res = await eConsentService.attestIdentity(subjectConsentId, id, {
                                          attestorName: attestorName.trim(),
                                        })
                                        if (res?.isSuccess) {
                                          toast.success("Identity attested in clinic")
                                          await reload()
                                        } else toast.error(res?.message || "Attestation failed")
                                      } finally {
                                        setSavingPartyId(null)
                                      }
                                    }}
                                  >
                                    Attest identity
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                          ) : null}
                          {sig?.startsWith?.("data:image") ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={sig} alt="Signature" className="mt-2 max-h-24 max-w-[280px]" />
                          ) : null}
                          {(p.photoData || p.PhotoData)?.startsWith?.("data:image") ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.photoData || p.PhotoData}
                              alt="Photo evidence"
                              className="mt-2 max-h-32 max-w-[280px] rounded border border-slate-200"
                            />
                          ) : null}
                          {(p.videoData || p.VideoData)?.startsWith?.("data:video") ||
                          (p.videoData || p.VideoData)?.startsWith?.("data:") ? (
                            // eslint-disable-next-line jsx-a11y/media-has-caption
                            <video
                              controls
                              className="mt-2 max-h-40 max-w-[320px] rounded border border-slate-200"
                              src={p.videoData || p.VideoData}
                            />
                          ) : null}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={!canDownload || downloading || loading}
            onClick={() => handleDownload("html")}
          >
            {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            HTML
          </Button>
          <Button
            type="button"
            className="rounded-xl bg-emerald-700 text-white hover:bg-emerald-800"
            disabled={!canDownload || downloading || loading}
            onClick={() => handleDownload("pdf")}
          >
            {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Download PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
