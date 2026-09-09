"use client"

import { useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Check, Copy, Link2, Loader2, Mail, MessageCircle, MessageSquare } from "lucide-react"

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "")
}

function buildShareMessage(inviteUrl, enrolmentId) {
  const who = enrolmentId != null ? ` (enrolment #${enrolmentId})` : ""
  return `Please review and complete your electronic informed consent${who}:\n\n${inviteUrl}`
}

/**
 * Share eCONSENT invite via WhatsApp, SMS, email, or copy link.
 */
export default function ShareConsentInviteDialog({
  open,
  onOpenChange,
  inviteUrl,
  contactEmail,
  contactMobile,
  enrolmentId,
  emailSent,
  expiresAt,
  preparing,
}) {
  const [copied, setCopied] = useState(false)
  const message = useMemo(
    () => buildShareMessage(inviteUrl || "", enrolmentId),
    [inviteUrl, enrolmentId],
  )
  const mobileDigits = digitsOnly(contactMobile)

  const copyLink = async () => {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      toast.success("Link copied")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Could not copy link")
    }
  }

  const openWhatsApp = () => {
    if (!inviteUrl) return
    const text = encodeURIComponent(message)
    const url = mobileDigits
      ? `https://wa.me/${mobileDigits}?text=${text}`
      : `https://wa.me/?text=${text}`
    window.open(url, "_blank", "noopener,noreferrer")
  }

  const openSms = () => {
    if (!inviteUrl) return
    const body = encodeURIComponent(message)
    // iOS uses &body=, Android often ?body= — dual form works broadly with sms:
    const href = mobileDigits
      ? `sms:${mobileDigits}?&body=${body}`
      : `sms:?&body=${body}`
    window.location.href = href
  }

  const openMail = () => {
    if (!inviteUrl) return
    const subject = encodeURIComponent("Electronic informed consent invitation")
    const body = encodeURIComponent(message)
    const to = contactEmail ? encodeURIComponent(contactEmail) : ""
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="bg-black/70 backdrop-blur-md"
        className="max-w-md rounded-2xl border-slate-200 bg-white opacity-100 shadow-2xl sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="text-slate-900">Share consent invite</DialogTitle>
          <DialogDescription className="text-slate-600">
            Send the participant link by WhatsApp, text message, or email — or copy the link.
            {emailSent ? " A server email was also sent." : null}
          </DialogDescription>
        </DialogHeader>

        {preparing ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            Preparing invite link…
          </div>
        ) : !inviteUrl ? (
          <p className="py-6 text-center text-sm text-amber-800">
            Invite link is not available. Try Share again.
          </p>
        ) : (
          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Invite link
              </label>
              <div className="flex gap-2">
                <Input readOnly value={inviteUrl} className="rounded-xl border-slate-200 text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 rounded-xl"
                  onClick={copyLink}
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              {expiresAt ? (
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Expires {new Date(expiresAt).toISOString().replace("T", " ").slice(0, 16)} UTC
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                type="button"
                onClick={openWhatsApp}
                className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-4 text-center transition-colors hover:border-emerald-300 hover:bg-emerald-50/50"
              >
                <span className="rounded-full bg-emerald-100 p-2.5 text-emerald-700">
                  <MessageCircle className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold text-slate-800">WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={openSms}
                className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-4 text-center transition-colors hover:border-sky-300 hover:bg-sky-50/50"
              >
                <span className="rounded-full bg-sky-100 p-2.5 text-sky-700">
                  <MessageSquare className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold text-slate-800">Text message</span>
              </button>

              <button
                type="button"
                onClick={openMail}
                className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-4 text-center transition-colors hover:border-indigo-300 hover:bg-indigo-50/50"
              >
                <span className="rounded-full bg-indigo-100 p-2.5 text-indigo-700">
                  <Mail className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold text-slate-800">Email</span>
              </button>

              <button
                type="button"
                onClick={copyLink}
                className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-4 text-center transition-colors hover:border-slate-400 hover:bg-slate-50"
              >
                <span className="rounded-full bg-slate-100 p-2.5 text-slate-700">
                  <Link2 className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold text-slate-800">
                  {copied ? "Copied" : "Copy link"}
                </span>
              </button>
            </div>

            {(contactEmail || contactMobile) && (
              <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {contactEmail ? (
                  <span>
                    Email on file: <strong className="text-slate-800">{contactEmail}</strong>
                  </span>
                ) : null}
                {contactEmail && contactMobile ? " · " : null}
                {contactMobile ? (
                  <span>
                    Mobile on file: <strong className="text-slate-800">{contactMobile}</strong>
                  </span>
                ) : null}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
