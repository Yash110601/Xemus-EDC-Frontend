"use client"

import { useState } from "react"
import { Check, Copy, KeyRound, X } from "lucide-react"

export default function CreatedUserCredentialsModal({ open, onClose, title, email, password, contextLabel }) {
  const [copiedField, setCopiedField] = useState(null)

  if (!open || !password) return null

  const handleCopy = async (text, field) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      setCopiedField(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="created-user-credentials-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
              <KeyRound className="h-5 w-5 text-amber-700" aria-hidden />
            </div>
            <div>
              <h2 id="created-user-credentials-title" className="text-lg font-semibold text-slate-900">
                {title || "User credentials"}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                SMTP email may not be configured. Copy and share these credentials securely with the user.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/80 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {contextLabel ? (
            <p className="text-sm font-medium text-slate-700">{contextLabel}</p>
          ) : null}

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Login email</p>
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="min-w-0 flex-1 break-all text-sm font-medium text-slate-900">{email || "—"}</p>
              {email ? (
                <button
                  type="button"
                  onClick={() => handleCopy(email, "email")}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  {copiedField === "email" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedField === "email" ? "Copied" : "Copy"}
                </button>
              ) : null}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">System-generated password</p>
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5">
              <p className="min-w-0 flex-1 break-all font-mono text-sm font-semibold text-slate-900">{password}</p>
              <button
                type="button"
                onClick={() => handleCopy(password, "password")}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
              >
                {copiedField === "password" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedField === "password" ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            The user will be asked to change this password on first login.
          </p>
        </div>

        <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
