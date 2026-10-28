"use client"

import { memo, useCallback, useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, FileCheck, Loader2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import PiSignoffReadinessBadges, { PiSignoffBlockedReasons } from "@/components/pi-signoff/PiSignoffReadinessBadges"
import piSignoffService, { isPiSignoffComplete } from "@/lib/services/piSignoff.service"
import {
  isFieldPiSignoffEnabled,
  isPiSignoffStatusVoided,
  piSignoffGranularityLabel,
  requiresPiResign,
  reviewOrderLabel,
} from "@/lib/piSignoff/piSignoffReadiness"
import { piFieldSignoffProgressLabel } from "@/lib/piSignoff/piFieldSignoff"
import PiSignoffPasswordDialog from "@/components/pi-signoff/PiSignoffPasswordDialog"
import PiSignoffSignatureBlock from "@/components/pi-signoff/PiSignoffSignatureBlock"

function EcrfPiSignoffPanel({
  studyId,
  crfDataId,
  canPiSignoff = false,
  isPiSignoffRequired = false,
  isFieldPiSignoffEnabled: fieldPiSignoffEnabledProp = false,
  onPiSignoffGranularityChange,
  currentFormStatus,
  onSignedChange,
  refreshToken = 0,
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [comment, setComment] = useState("")
  const [passwordDialog, setPasswordDialog] = useState({ open: false, mode: "apply" })
  const [record, setRecord] = useState(null)

  const isSubmitted = currentFormStatus === 3
  const dataId = Number.parseInt(String(crfDataId ?? ""), 10)
  const isSigned = isPiSignoffComplete(record)
  const isVoided = isPiSignoffStatusVoided(record?.status)
  const needsResign = requiresPiResign(record)
  const reviewOrder = record?.reviewOrder
  const recordGranularity = record?.piSignoffGranularity
  const fieldPiSignoffEnabled = isFieldPiSignoffEnabled(recordGranularity ?? fieldPiSignoffEnabledProp)
  const readiness = record?.readiness ?? {}
  const canApplySignoff = Boolean(readiness.isReadyToSign) && !isSigned

  const refresh = useCallback(async () => {
    if (!isPiSignoffRequired || !isSubmitted || !Number.isFinite(dataId) || dataId <= 0) {
      setRecord(null)
      onSignedChange?.(false)
      return
    }
    setLoading(true)
    try {
      const res = await piSignoffService.getByCrfDataId(dataId)
      const next = res?.data ?? null
      setRecord(next)
      if (next?.piSignoffGranularity) {
        onPiSignoffGranularityChange?.(next.piSignoffGranularity)
      }
      onSignedChange?.(isPiSignoffComplete(next))
    } finally {
      setLoading(false)
    }
  }, [refreshToken, isPiSignoffRequired, isSubmitted, dataId, onSignedChange, onPiSignoffGranularityChange])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleApply = async (submittedPassword, applyComment = comment) => {
    if (!Number.isFinite(dataId) || dataId <= 0 || !canApplySignoff) return false
    const trimmedPassword = String(submittedPassword ?? "").trim()
    if (!trimmedPassword) return false
    const trimmedComment = String(applyComment ?? "").trim()
    setSaving(true)
    try {
      const sid = Number.parseInt(String(studyId ?? ""), 10)
      const res = await piSignoffService.applySignoff({
        studyId: Number.isFinite(sid) && sid > 0 ? sid : undefined,
        crfDataId: dataId,
        password: trimmedPassword,
        ...(trimmedComment ? { comment: trimmedComment } : {}),
      })
      if (res?.isSuccess) {
        toast({ title: "PI sign-off recorded", variant: "success" })
        setComment("")
        await refresh()
        return true
      }
      toast({
        title: "PI sign-off failed",
        description: res?.message || "Unable to apply sign-off.",
        variant: "destructive",
      })
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleRevoke = async (submittedPassword, revokeReason) => {
    if (!Number.isFinite(dataId) || dataId <= 0) return false
    const trimmedPassword = String(submittedPassword ?? "").trim()
    if (!trimmedPassword) return false
    const trimmedReason = String(revokeReason ?? "").trim()
    if (!trimmedReason) return false
    setSaving(true)
    try {
      const sid = Number.parseInt(String(studyId ?? ""), 10)
      const res = await piSignoffService.revokeSignoff({
        studyId: Number.isFinite(sid) && sid > 0 ? sid : undefined,
        crfDataId: dataId,
        password: trimmedPassword,
        reason: trimmedReason,
      })
      if (res?.isSuccess) {
        toast({ title: "PI sign-off revoked", variant: "success" })
        await refresh()
        return true
      }
      toast({
        title: "Revoke failed",
        description: res?.message || "Unable to revoke sign-off.",
        variant: "destructive",
      })
      return false
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordConfirm = async (submittedPassword, extraReason, extraComment) => {
    if (passwordDialog.mode === "revoke") {
      const ok = await handleRevoke(submittedPassword, extraReason)
      if (ok) setPasswordDialog({ open: false, mode: "apply" })
      return
    }
    const ok = await handleApply(submittedPassword, extraComment)
    if (ok) setPasswordDialog({ open: false, mode: "apply" })
  }

  if (!isPiSignoffRequired) return null
  if (!isSubmitted || !Number.isFinite(dataId) || dataId <= 0) return null

  const statusLabel = String(record?.status ?? "Pending").trim()
  const panelTone = isSigned
    ? "border-emerald-200/80 bg-gradient-to-r from-emerald-50/90 via-white/90 to-teal-50/80"
    : needsResign || isVoided
      ? "border-amber-200/80 bg-gradient-to-r from-amber-50/90 via-white/90 to-orange-50/70"
      : "border-indigo-200/80 bg-gradient-to-r from-indigo-50/90 via-white/90 to-violet-50/80"

  return (
    <div
      className={`mb-3 rounded-xl border px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] ${panelTone}`}
      role="status"
      aria-label="PI sign-off"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <div
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              isSigned
                ? "bg-emerald-100 text-emerald-700"
                : needsResign || isVoided
                  ? "bg-amber-100 text-amber-800"
                  : "bg-indigo-100 text-indigo-700"
            }`}
          >
            {needsResign || isVoided ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <FileCheck className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">PI sign-off</p>
            {reviewOrder ? (
              <p className="text-[11px] text-slate-500">
                {reviewOrderLabel(reviewOrder)}
                {recordGranularity ? ` · ${piSignoffGranularityLabel(recordGranularity)}` : ""}
              </p>
            ) : recordGranularity ? (
              <p className="text-[11px] text-slate-500">{piSignoffGranularityLabel(recordGranularity)}</p>
            ) : null}
            {loading ? (
              <p className="text-xs text-slate-600">Loading sign-off status…</p>
            ) : (
              <>
                <p className="text-xs text-slate-600">
                  Status:{" "}
                  <span
                    className={`font-semibold ${
                      isSigned ? "text-emerald-700" : needsResign || isVoided ? "text-amber-800" : "text-amber-700"
                    }`}
                  >
                    {statusLabel}
                  </span>
                  {record?.signedBy ? ` · ${record.signedBy}` : ""}
                  {record?.signedAt ? ` · ${new Date(record.signedAt).toLocaleString()}` : ""}
                </p>
                {(needsResign || isVoided) && (
                  <p className="mt-1 text-xs font-medium text-amber-900">
                    Re-sign required — CRF data changed after PI sign-off. Apply a new sign-off when prerequisites are
                    met.
                  </p>
                )}
                {isSigned && (
                  <p className="mt-1 text-xs font-medium text-emerald-800">
                    CRF is read-only after PI sign-off. Server blocks further mutations.
                  </p>
                )}
                <PiSignoffReadinessBadges
                  record={record}
                  reviewOrder={reviewOrder}
                  isFieldPiSignoffEnabled={fieldPiSignoffEnabled}
                />
                {fieldPiSignoffEnabled && readiness.fieldSignoff?.totalEligible > 0 ? (
                  <p className="mt-1 text-xs font-medium text-indigo-900">
                    Field sign-off: {piFieldSignoffProgressLabel(readiness.fieldSignoff)}
                    {readiness.fieldSignoff.allFieldsSigned ? " · ready for CRF sign-off" : ""}
                  </p>
                ) : null}
                <PiSignoffBlockedReasons reasons={readiness.blockedReasons} />
                {record?.comment ? (
                  <p className="mt-1 text-xs text-slate-600">Comment: {record.comment}</p>
                ) : null}
                {(isSigned || isVoided || needsResign) && !loading ? (
                  <PiSignoffSignatureBlock record={record} />
                ) : null}
              </>
            )}
          </div>
        </div>

        {!canPiSignoff && !loading && !isSigned && !needsResign && !isVoided && (
          <p className="text-xs text-slate-600">PI sign-off actions require the <code className="text-[11px]">pi.signoff</code> permission.</p>
        )}

        {canPiSignoff && !loading && (
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            {!isSigned ? (
              <Button
                type="button"
                size="sm"
                disabled={saving || !canApplySignoff}
                onClick={() => {
                  setComment("")
                  setPasswordDialog({ open: true, mode: "apply" })
                }}
                className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50"
                title={
                  !canApplySignoff && readiness.blockedReasons?.length
                    ? readiness.blockedReasons.join("; ")
                    : undefined
                }
              >
                {saving ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                )}
                {needsResign || isVoided ? "Re-sign CRF" : "Sign off CRF"}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => setPasswordDialog({ open: true, mode: "revoke" })}
              >
                {saving ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                )}
                Revoke sign-off
              </Button>
            )}
          </div>
        )}

        {isSigned && !canPiSignoff && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Signed
          </span>
        )}
      </div>

      <PiSignoffPasswordDialog
        open={passwordDialog.open}
        onOpenChange={(open) => {
          if (!open) setPasswordDialog({ open: false, mode: "apply" })
        }}
        mode={
          passwordDialog.mode === "revoke"
            ? "revoke"
            : needsResign || isVoided
              ? "resign"
              : "apply"
        }
        title={
          passwordDialog.mode === "revoke"
            ? "Confirm revoke PI sign-off"
            : needsResign || isVoided
              ? "Confirm PI re-sign"
              : "Confirm PI sign-off"
        }
        confirmLabel={
          passwordDialog.mode === "revoke"
            ? "Revoke sign-off"
            : needsResign || isVoided
              ? "Re-sign CRF"
              : "Sign off CRF"
        }
        requireReason={passwordDialog.mode === "revoke"}
        commentValue={comment}
        onCommentChange={setComment}
        loading={saving}
        onConfirm={handlePasswordConfirm}
      />
    </div>
  )
}

export default memo(EcrfPiSignoffPanel)
