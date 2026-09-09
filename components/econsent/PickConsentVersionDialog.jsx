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
import eConsentService from "@/lib/services/eConsent.service"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

/**
 * Pick a published consent form version when a study has more than one.
 * If only one version exists, confirms immediately with that id.
 */
export default function PickConsentVersionDialog({
  open,
  onOpenChange,
  studyId,
  title = "Select consent version",
  description = "This study has more than one published consent. Choose which version to assign.",
  confirmLabel = "Continue",
  showAmendmentReason = false,
  onConfirm,
}) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [options, setOptions] = useState([])
  const [selectedId, setSelectedId] = useState("")
  const [amendmentReason, setAmendmentReason] = useState("")

  useEffect(() => {
    if (!open || !studyId) {
      setOptions([])
      setSelectedId("")
      setAmendmentReason("")
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await eConsentService.getPublishedVersions(studyId)
        const rows = Array.isArray(res?.data) ? res.data : []
        if (cancelled) return
        setOptions(rows)
        if (rows.length === 1) {
          const only = String(rows[0].formVersionId ?? rows[0].FormVersionId)
          setSelectedId(only)
        } else {
          setSelectedId("")
        }
      } catch {
        if (!cancelled) {
          setOptions([])
          toast.error("Could not load consent versions")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, studyId])

  const handleConfirm = async () => {
    if (!selectedId) {
      toast.error("Select a consent version")
      return
    }
    setSaving(true)
    try {
      await onConfirm?.(Number(selectedId), options, amendmentReason.trim() || null)
      onOpenChange(false)
    } catch (err) {
      toast.error(err?.message || "Could not continue")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="bg-black/70 backdrop-blur-md"
        className="max-w-md rounded-2xl border-slate-200 bg-white opacity-100 sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle className="text-slate-900">{title}</DialogTitle>
          <DialogDescription className="text-slate-600">{description}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            Loading versions…
          </div>
        ) : options.length === 0 ? (
          <p className="py-6 text-center text-sm text-amber-800">
            No published consent forms found. Publish a consent template first.
          </p>
        ) : (
          <div className="space-y-3">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Consent version
            </label>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="">Select…</option>
              {options.map((opt) => {
                const id = opt.formVersionId ?? opt.FormVersionId
                const label =
                  opt.label ||
                  opt.Label ||
                  `${opt.formName || opt.FormName} · v${opt.versionLabel || opt.VersionLabel}`
                return (
                  <option key={id} value={String(id)}>
                    {label}
                  </option>
                )
              })}
            </select>
            {showAmendmentReason ? (
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Amendment / reconsent reason
                </label>
                <textarea
                  className="min-h-[72px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
                  value={amendmentReason}
                  onChange={(e) => setAmendmentReason(e.target.value)}
                  placeholder="Optional — stored in the audit trail"
                />
              </div>
            ) : null}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-xl bg-emerald-700 text-white hover:bg-emerald-800"
            disabled={loading || saving || !selectedId || options.length === 0}
            onClick={handleConfirm}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
