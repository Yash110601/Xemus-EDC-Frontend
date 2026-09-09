"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { PASSWORD_INPUT_IOS_PROPS } from "@/lib/login/loginUi"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { piSignoffAttestationForMode } from "@/lib/piSignoff/piSignoffAttestation"

/**
 * Re-authentication dialog for PI sign-off (21 CFR Part 11).
 */
export default function PiSignoffPasswordDialog({
  open,
  onOpenChange,
  mode = "apply",
  title = "Confirm PI sign-off",
  description,
  confirmLabel = "Confirm sign-off",
  loading = false,
  requireReason = false,
  showComment = false,
  commentValue = "",
  onCommentChange,
  commentPlaceholder = "Optional comment",
  reasonLabel = "Reason for revoke",
  reasonPlaceholder = "Required — explain why PI sign-off is being revoked",
  onConfirm,
}) {
  const [password, setPassword] = useState("")
  const [reason, setReason] = useState("")
  const [localComment, setLocalComment] = useState("")
  const [error, setError] = useState("")

  const attestation = description ?? piSignoffAttestationForMode(mode)
  const isSignMode = mode === "apply" || mode === "resign" || mode === "bulkApply"
  const shouldShowComment = showComment === true || (showComment !== false && isSignMode)

  useEffect(() => {
    if (open) {
      setLocalComment(String(commentValue ?? ""))
      return
    }
    setPassword("")
    setReason("")
    setLocalComment("")
    setError("")
  }, [open, commentValue])

  const handleCommentChange = (value) => {
    setLocalComment(value)
    onCommentChange?.(value)
  }

  const handleConfirm = async () => {
    const trimmed = String(password ?? "").trim()
    if (!trimmed) {
      setError("Password is required.")
      return
    }
    if (requireReason && !String(reason ?? "").trim()) {
      setError(`${reasonLabel} is required.`)
      return
    }
    setError("")
    try {
      await onConfirm?.(
        trimmed,
        String(reason ?? "").trim(),
        shouldShowComment ? String(localComment ?? "").trim() : String(commentValue ?? "").trim(),
      )
    } catch (err) {
      setError(err?.message || "Unable to verify password.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-slate-200 bg-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <p className="text-sm text-slate-600 leading-relaxed">{attestation}</p>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          {shouldShowComment ? (
            <div className="rounded-xl border border-slate-300 bg-white p-3 shadow-sm ring-1 ring-slate-200/90">
              <label htmlFor="pi-signoff-comment" className="text-sm font-semibold text-slate-900">
                Optional comment
              </label>
              <p className="mt-0.5 text-xs text-slate-600">Add a note for the audit trail if needed.</p>
              <Textarea
                id="pi-signoff-comment"
                value={localComment}
                disabled={loading}
                placeholder={commentPlaceholder}
                rows={3}
                className={cn(
                  "mt-2 min-h-[84px] resize-y rounded-lg border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 opacity-100 shadow-none",
                  "placeholder:text-slate-500 focus-visible:border-indigo-500 focus-visible:ring-4 focus-visible:ring-indigo-500/15",
                )}
                onChange={(e) => handleCommentChange(e.target.value)}
              />
            </div>
          ) : null}
          {requireReason ? (
            <div className="space-y-1.5">
              <label htmlFor="pi-signoff-reason" className="text-sm font-semibold text-slate-900">
                {reasonLabel} <span className="text-rose-500">*</span>
              </label>
              <Input
                id="pi-signoff-reason"
                value={reason}
                disabled={loading}
                placeholder={reasonPlaceholder}
                className="border-slate-300 bg-white text-slate-900 opacity-100 placeholder:text-slate-500"
                onChange={(e) => {
                  setReason(e.target.value)
                  if (error) setError("")
                }}
              />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <label htmlFor="pi-signoff-password" className="text-sm font-semibold text-slate-900">
              Password <span className="text-rose-500">*</span>
            </label>
            <Input
              id="pi-signoff-password"
              type="password"
              autoComplete="current-password"
              value={password}
              disabled={loading}
              placeholder="Enter your password"
              className="password-input-custom-toggle border-slate-300 bg-white text-slate-900 opacity-100 placeholder:text-slate-500"
              {...PASSWORD_INPUT_IOS_PROPS}
              onChange={(e) => {
                setPassword(e.target.value)
                if (error) setError("")
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) void handleConfirm()
              }}
            />
          </div>
          {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={loading} onClick={() => onOpenChange?.(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={loading} onClick={() => void handleConfirm()}>
            {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function PiSignoffPasswordField({ value, onChange, disabled = false, className = "" }) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label htmlFor="pi-signoff-inline-password" className="text-[11px] font-medium text-slate-600">
        Password <span className="text-rose-500">*</span>
      </label>
      <input
        id="pi-signoff-inline-password"
        type="password"
        autoComplete="current-password"
        value={value}
        disabled={disabled}
        placeholder="Required to sign off"
        className="password-input-custom-toggle w-full min-w-[10rem] rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </div>
  )
}
