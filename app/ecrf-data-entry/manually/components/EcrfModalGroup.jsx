"use client"

import { memo } from "react"
import { AlertTriangle, Loader2, Trash2 } from "lucide-react"

/**
 * Phase 3b-2 — Screening / randomized / delete-attachment / error modals.
 * Presentation-only: all business logic stays in `ECRFDataEntryPage` via stable callbacks.
 */
const EcrfModalGroup = memo(function EcrfModalGroup({
  submitConfirmModalOpen,
  onSubmitConfirmCancel,
  onSubmitConfirmSaveDraft,
  onSubmitConfirmContinue,
  showScreeningFailedModal,
  screeningFailedSubmitting,
  onScreeningFailedCancel,
  onScreeningFailedConfirm,
  showRandomizedEnrolledModal,
  onRandomizedNo,
  onRandomizedYes,
  pendingDeleteAttachment,
  deletingVisitAttachmentId,
  onDeleteAttachmentCancel,
  onDeleteAttachmentConfirm,
  errorModal,
  onErrorModalClose,
}) {
  return (
    <>
      {submitConfirmModalOpen && (
        <div className="fixed inset-0 z-[112] flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl ring-1 ring-slate-200/70 animate-in zoom-in-95 duration-200">
            <div className="px-6 pt-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 ring-4 ring-amber-100/60">
                <AlertTriangle className="h-7 w-7 text-amber-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Submit and lock this form?</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Submitting will lock data entry for this CRF. You can save as draft if you want to continue later.
              </p>
            </div>
            <div className="mx-6 mt-5 rounded-xl border border-amber-200/70 bg-amber-50/60 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-800">After this change</p>
              <p className="mt-1 text-xs text-amber-900/90">
                The CRF becomes submitted and locked. Use <span className="font-semibold">SAVE</span> if you need to continue editing later.
              </p>
            </div>
            <div className="mt-5 flex shrink-0 gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
              <button
                type="button"
                onClick={onSubmitConfirmCancel}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void onSubmitConfirmSaveDraft()}
                className="flex-1 rounded-xl border border-blue-200/70 bg-blue-50/85 px-5 py-2.5 text-sm font-semibold uppercase text-blue-700 shadow-sm transition-all duration-200 hover:border-blue-300/70 hover:bg-blue-100/90 whitespace-nowrap"
              >
                SAVE
              </button>
              <button
                type="button"
                onClick={() => void onSubmitConfirmContinue()}
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-gradient-to-r btn-brand-gradient px-5 py-2.5 text-sm font-semibold uppercase text-white shadow-md shadow-violet-300/40 transition-all duration-200  whitespace-nowrap"
              >
                SUBMIT & CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {showScreeningFailedModal && (
        <div
          className="fixed inset-0 z-[111] flex items-center justify-center overflow-y-auto overflow-x-hidden bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="screen-failed-title"
          aria-describedby="screen-failed-desc"
        >
          <div className="my-auto flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200/80 animate-in zoom-in-95 duration-200">
            <div className="shrink-0 px-6 pt-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 ring-4 ring-amber-100/60">
                <AlertTriangle className="h-8 w-8 text-amber-600" />
              </div>
              <h3 id="screen-failed-title" className="mb-1.5 text-xl font-bold text-slate-900">
                Mark patient as Screen Failed?
              </h3>
              <p id="screen-failed-desc" className="text-sm leading-relaxed text-slate-600">
                This is a protocol decision. Once confirmed, the patient will be excluded from further protocol visits.
              </p>
            </div>
            <div className="mx-6 mt-5 rounded-xl border border-amber-200/70 bg-amber-50/60 px-4 py-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-800">
                After this change
              </p>
              <ul className="space-y-1.5 text-xs text-amber-900/90">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" aria-hidden />
                  <span>
                    Patient status will change to <span className="font-semibold">Screen Failed</span>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" aria-hidden />
                  <span>Future protocol visits will be locked from data entry.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" aria-hidden />
                  <span>
                    Only <span className="font-semibold">Adverse Event</span> and{" "}
                    <span className="font-semibold">Concomitant Medication</span> entries remain accessible.
                  </span>
                </li>
              </ul>
            </div>
            <div className="mt-5 flex shrink-0 gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-4">
              <button
                type="button"
                disabled={screeningFailedSubmitting}
                onClick={() => void onScreeningFailedCancel()}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={screeningFailedSubmitting}
                onClick={() => void onScreeningFailedConfirm()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {screeningFailedSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Updating…
                  </>
                ) : (
                  "Mark Screen Failed"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRandomizedEnrolledModal && (
        <div className="fixed inset-0 z-[111] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="p-6">
              <p className="mb-4 text-sm text-slate-700">Is patient randomized/enrolled?</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => void onRandomizedNo()}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => void onRandomizedYes()}
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
                >
                  Yes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {pendingDeleteAttachment.open && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-[109] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-white/60 bg-white/90 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 border border-red-100">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-center text-lg font-bold text-slate-900">Delete attachment?</h3>
              <p className="mt-2 text-center text-sm text-slate-600 break-words">
                This action cannot be undone.
              </p>
              <p className="mt-1 text-center text-xs text-slate-500 break-all">
                {pendingDeleteAttachment.label}
              </p>
              <div className="mt-6 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onDeleteAttachmentCancel}
                  disabled={deletingVisitAttachmentId != null}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void onDeleteAttachmentConfirm()}
                  disabled={deletingVisitAttachmentId != null}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {deletingVisitAttachmentId != null ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {errorModal.open && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto overflow-x-hidden bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="my-auto flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl animate-in zoom-in-95 duration-200 max-h-[85vh]">
            <div className="shrink-0 px-6 pt-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="mb-1 text-xl font-bold text-slate-900">Error</h3>
            </div>
            <div className="max-h-[calc(85vh-12rem)] overflow-y-auto overflow-x-hidden px-6 pb-2 pt-2 custom-scrollbar">
              <p className="whitespace-pre-line text-left text-sm leading-relaxed text-slate-600">
                {errorModal.message}
              </p>
            </div>
            <div className="shrink-0 border-t border-slate-100/90 bg-white px-6 pb-6 pt-4">
              <button
                type="button"
                onClick={onErrorModalClose}
                className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
})

export default EcrfModalGroup
