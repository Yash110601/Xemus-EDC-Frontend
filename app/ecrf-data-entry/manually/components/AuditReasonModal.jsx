"use client"

import { CheckCircle, Loader2 } from "lucide-react"

export default function AuditReasonModal({
  visible,
  modalState,
  reasonText,
  onReasonChange,
  onClose,
  onConfirm,
  saving,
  formatFieldLabel,
}) {
  if (!visible) return null

  const changedFields = Array.isArray(modalState?.changedFields) ? modalState.changedFields : []
  const isCaptureOnly = modalState?.mode === "capture_only"

  return (
    <div className="fixed inset-0 z-[112] flex items-center justify-center overflow-y-auto overflow-x-hidden bg-black/50 p-4 backdrop-blur-0">
      <div className="my-auto flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl max-h-[82vh]">
        <div className="shrink-0 border-b border-slate-100/90 px-5 py-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            <h3 className="text-sm font-semibold text-slate-900">Reason Required for Field Update</h3>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            {isCaptureOnly
              ? "You edited saved CRF data. Add a reason to continue."
              : "You changed previously saved CRF data. Add a reason to continue and store audit trail."}
          </p>
        </div>
        <div className="max-h-[calc(82vh-12rem)] overflow-y-auto overflow-x-hidden px-5 py-3 custom-scrollbar space-y-3">
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 py-1.5 text-xs text-emerald-800">
            Changed fields: <span className="font-semibold">{changedFields.length}</span>
          </div>
          <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 custom-scrollbar">
            <ul className="space-y-2 text-xs text-slate-700">
              {changedFields.slice(0, 25).map((entry) => (
                <li key={`audit-change-${entry.fieldName}`} className="rounded-md border border-slate-200 bg-white/90 p-2">
                  <p className="font-medium text-slate-800 break-all">
                    {formatFieldLabel(entry.fieldName) || entry.fieldName}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 break-all">
                    Old: <span className="font-medium text-slate-700">{String(entry.oldValue ?? "") || "—"}</span>
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 break-all">
                    New: <span className="font-medium text-slate-700">{String(entry.newValue ?? "") || "—"}</span>
                  </p>
                </li>
              ))}
              {changedFields.length > 25 && (
                <li className="text-slate-500">...and {changedFields.length - 25} more</li>
              )}
            </ul>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">
              Reason for change
            </label>
            <textarea
              value={reasonText}
              onChange={(e) => onReasonChange(e.target.value)}
              rows={3}
              placeholder="Example: Corrected after source verification."
              className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>
        </div>
        <div className="shrink-0 border-t border-slate-100/90 bg-white px-5 pb-4 pt-3">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-all duration-75 hover:-translate-y-[1px] hover:bg-slate-50 hover:shadow-sm active:translate-y-0 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r btn-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-md shadow-violet-300/40 transition-all duration-75 hover:-translate-y-[1px]  hover:shadow-lg active:translate-y-0 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isCaptureOnly ? "Save Reason" : "Continue Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
