"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"

const STATUS_OPTIONS = [
  { value: "1", label: "Pending — revert achievement" },
  { value: "2", label: "Achieved — mark as achieved" },
  { value: "3", label: "Overridden — manual override" },
]

export default function PaymentRuleOverrideDialog({
  open,
  onOpenChange,
  rule,
  saving = false,
  onSubmit,
}) {
  const [status, setStatus] = useState("2")
  const [reason, setReason] = useState("")
  const [markEligible, setMarkEligible] = useState(true)

  useEffect(() => {
    if (!open) return
    setStatus("2")
    setReason("")
    setMarkEligible(true)
  }, [open, rule?.id])

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!String(reason).trim()) return
    onSubmit?.({
      status: Number(status),
      overrideReason: reason.trim(),
      markPaymentEligible: markEligible,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Override payment rule</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {rule ? (
            <p className="text-sm text-slate-600">
              Rule: <span className="font-semibold text-slate-900">{rule.ruleName}</span>
            </p>
          ) : null}

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">New status</label>
            <select
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Reason (required)</label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Approved by study manager"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={markEligible}
              onChange={(e) => setMarkEligible(e.target.checked)}
            />
            Mark payment eligible when achieved/overridden
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !reason.trim()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Apply override
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
