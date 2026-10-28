"use client"

import { memo } from "react"
import { AlertTriangle, X } from "lucide-react"
import {
  canCurrentUserCloseQuery,
  deriveExpectedActualAndBody,
  findControlForQueryField,
  getLiveQueryFieldValueRaw,
  getQueryAssignedToUserId,
  getQueryStatusLabel,
  getQueryStatusPillClass,
  isQueryClosedStatus,
  isSystemQueryType,
  normalizeQueryFieldIdForTableColumnLookup,
  renderQueryActualReadOnlyByControl,
  stringifyQueryActualValue,
} from "../lib/crfQueryReviewUi"
import { formatCrfMaskedDisplayValue } from "@/lib/utils/crfFieldMasking"

const EcrfQueryReviewPanels = memo(function EcrfQueryReviewPanels({
  canWorkOnQueries,
  canRespondToQueries = true,
  canCloseQueriesByMatrix = true,
  canCreateQuery = true,
  canViewMaskedData = true,
  manualQueryReview,
  setManualQueryReview,
  manualQueryActualErrors,
  manualReviewerCommentDraft,
  setManualReviewerCommentDraft,
  manualSubmittedCommentDraft,
  setManualSubmittedCommentDraft,
  saveManualQueryComment,
  closeManualQueryFromReviewer,
  crmSystemQueryReview,
  setCrmSystemQueryReview,
  systemQueryActualErrors,
  systemQueryCommentDraft,
  setSystemQueryCommentDraft,
  systemQuerySubmitterCommentDraft,
  setSystemQuerySubmitterCommentDraft,
  saveSystemQueryComment,
  closeSystemQueryFromReviewer,
  loggedInUserId,
  selectedForm,
  formData,
  optimisticControlValues,
  queryModalSaving,
  getPersistedActualValueForQueryField,
}) {
  const maskDisplay = (rawValue, control) =>
    formatCrfMaskedDisplayValue(stringifyQueryActualValue(rawValue), {
      canViewMasked: canViewMaskedData,
      control,
    })

  return (
    <>
      {/* Manual query details (read-only, Mac-style sheet) */}
      {canWorkOnQueries && manualQueryReview && (
        <div className="fixed inset-0 z-[66] flex items-center justify-center bg-slate-950/35 backdrop-blur-[2px] p-3 animate-in fade-in-0 duration-150">
          <div className="w-full max-w-[34rem] rounded-2xl border border-emerald-200/80 bg-white/95 backdrop-blur-xl shadow-[0_26px_70px_-34px_rgba(15,23,42,0.85)] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-emerald-100/80 bg-gradient-to-r from-emerald-50/90 via-slate-50/80 to-teal-50/80 px-4 py-3 rounded-t-2xl">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-slate-900">Manual query details</p>
                <p className="text-xs text-slate-600">
                  Field:{" "}
                  <span className="font-semibold text-slate-900">
                    {manualQueryReview.fieldLabel || "—"}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getQueryStatusPillClass(manualQueryReview.status)}`}
                >
                  {getQueryStatusLabel(manualQueryReview.status)}
                </span>
                <button
                  type="button"
                  onClick={() => setManualQueryReview(null)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/55 bg-white/25 text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_6px_20px_-14px_rgba(15,23,42,0.2)] backdrop-blur-md transition-colors hover:bg-white/40 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/50 focus-visible:ring-offset-1"
                  aria-label="Close"
                  title="Close"
                >
                  <X className="h-4 w-4" strokeWidth={2.25} />
                </button>
              </div>
            </div>
            {(() => {
              const { expected, actual, body } = deriveExpectedActualAndBody(manualQueryReview)
              const queryFieldControl = findControlForQueryField(
                selectedForm,
                normalizeQueryFieldIdForTableColumnLookup(manualQueryReview?.fieldId),
              )
              const submittedBy = Number(getQueryAssignedToUserId(manualQueryReview))
              const isSubmittedOwner =
                Number.isFinite(submittedBy) && loggedInUserId === submittedBy
              const isClosed = isQueryClosedStatus(manualQueryReview.status)
              const isReviewerOwner = canCurrentUserCloseQuery(
                manualQueryReview,
                loggedInUserId
              )
              const canEditReviewerComment =
                isReviewerOwner && !isClosed && (canCloseQueriesByMatrix || canCreateQuery)
              const canEditSubmittedComment = isSubmittedOwner && !isClosed && canRespondToQueries
              const canEditActualFromQuery = canEditSubmittedComment
              const canSaveAnyComment = canEditReviewerComment || canEditSubmittedComment
              const fieldIdVal = String(manualQueryReview.fieldId || "").trim()
              const persistedRawForOld = getPersistedActualValueForQueryField(
                manualQueryReview,
                selectedForm?.id,
              )
              const liveRawForNew = getLiveQueryFieldValueRaw(
                fieldIdVal,
                selectedForm?.id,
                formData,
                optimisticControlValues,
              )
              const oldValueTrim = String(stringifyQueryActualValue(persistedRawForOld) ?? "").trim()
              const newValueTrim = String(stringifyQueryActualValue(liveRawForNew) ?? "").trim()
              const valueChangedForActualSave =
                isSubmittedOwner && fieldIdVal && newValueTrim !== oldValueTrim
              const actualSaveBlocked =
                queryModalSaving ||
                (canEditActualFromQuery &&
                  valueChangedForActualSave &&
                  manualQueryActualErrors.length > 0)
              return (
                <div className="space-y-3 px-4 py-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">
                      Expected value
                    </label>
                    <div className="mt-1 rounded-md border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs text-slate-800 min-h-[32px] flex items-center">
                      {expected || "—"}
                    </div>
                  </div>
                  <div
                    className={`rounded-xl p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ${
                      canEditActualFromQuery && manualQueryActualErrors.length > 0
                        ? "border border-rose-300/90 bg-rose-50/40 ring-1 ring-rose-200/70"
                        : "border border-slate-200/80 bg-slate-50/60"
                    }`}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500">
                      Actual value
                    </p>
                    {canEditActualFromQuery ? (
                      <div className="mt-2 space-y-2">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start">
                          <div className="min-w-0 space-y-1">
                            <label className="text-xs font-semibold text-slate-600">Old value</label>
                            <div className="mt-0.5 min-w-0">
                              {queryFieldControl ? (
                                renderQueryActualReadOnlyByControl(queryFieldControl, persistedRawForOld)
                              ) : (
                                <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 min-h-[40px] flex items-center font-mono tabular-nums break-all">
                                  {oldValueTrim === "" ? "—" : maskDisplay(persistedRawForOld, queryFieldControl)}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="min-w-0 space-y-1">
                            <label className="text-xs font-semibold text-slate-600">New value</label>
                            <div className="mt-0.5 min-w-0">
                              {queryFieldControl ? (
                                renderQueryActualReadOnlyByControl(queryFieldControl, liveRawForNew)
                              ) : (
                                <div className="rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-900 min-h-[40px] flex items-center font-mono tabular-nums break-all">
                                  {newValueTrim === "" ? "—" : maskDisplay(liveRawForNew, queryFieldControl)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        {manualQueryActualErrors.length > 0 && (
                          <ul className="space-y-0.5 text-xs text-rose-700" role="alert">
                            {manualQueryActualErrors.map((err, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <AlertTriangle
                                  className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-90"
                                  aria-hidden
                                />
                                <span>{err}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : (
                      <div className="mt-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 min-h-[32px] flex items-center">
                        {canViewMaskedData || !queryFieldControl
                          ? actual || "—"
                          : maskDisplay(actual, queryFieldControl) || "—"}
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                    <label className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500">
                      Query details
                    </label>
                    <div className="mt-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {body || "—"}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">
                      Reviewer comment
                    </label>
                    <textarea
                      rows={2}
                      value={manualReviewerCommentDraft}
                      onChange={(e) => setManualReviewerCommentDraft(e.target.value)}
                      readOnly={!canEditReviewerComment}
                      className={`mt-1 w-full rounded-md border px-3 py-2 text-sm resize-none ${
                        !canEditReviewerComment
                          ? "border-slate-200 bg-slate-50/80 text-slate-500"
                          : "border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
                      }`}
                      placeholder="Reviewer note"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">
                      Submitted user comment
                    </label>
                    <textarea
                      rows={2}
                      value={manualSubmittedCommentDraft}
                      onChange={(e) => setManualSubmittedCommentDraft(e.target.value)}
                      readOnly={!canEditSubmittedComment}
                      className={`mt-1 w-full rounded-md border px-3 py-2 text-sm resize-none ${
                        !canEditSubmittedComment
                          ? "border-slate-200 bg-slate-50/80 text-slate-500"
                          : "border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
                      }`}
                      placeholder="Submitted user note"
                    />
                  </div>
                  <div className="flex items-center justify-end pt-1">
                    {!isClosed && canSaveAnyComment && (
                      <>
                        <button
                          type="button"
                          disabled={actualSaveBlocked}
                          onClick={() => void saveManualQueryComment()}
                          className="rounded-md border border-emerald-300/80 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60 disabled:pointer-events-none"
                        >
                          {queryModalSaving ? "Saving…" : "Save comment"}
                        </button>
                        {isReviewerOwner && canCloseQueriesByMatrix && (
                          <button
                            type="button"
                            disabled={queryModalSaving}
                            onClick={() => void closeManualQueryFromReviewer()}
                            className="ml-2 rounded-md bg-gradient-to-r from-amber-600 to-orange-600 px-3 py-2 text-xs font-semibold text-white hover:from-amber-700 hover:to-orange-700 shadow-sm disabled:opacity-60 disabled:pointer-events-none"
                          >
                            Close query
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* System-generated query: same APIs as manual — submitter UpdateSubmittedUserComment, reviewer UpdateReviewer */}
      {canWorkOnQueries && crmSystemQueryReview && isSystemQueryType(crmSystemQueryReview) && (
        <div className="fixed inset-0 z-[66] flex items-center justify-center bg-slate-950/35 backdrop-blur-[2px] p-3 animate-in fade-in-0 duration-150">
          <div className="w-full max-w-[34rem] rounded-2xl border border-amber-200/80 bg-white/95 backdrop-blur-xl shadow-[0_24px_64px_-30px_rgba(30,41,59,0.65),inset_0_1px_0_rgba(255,255,255,0.8)] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-amber-100/80 bg-gradient-to-r from-amber-50/90 to-orange-50/80 px-4 py-3 rounded-t-2xl">
              <div>
                <p className="text-sm font-semibold text-amber-950">System-generated query</p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Field: <span className="font-semibold text-slate-800">{crmSystemQueryReview.fieldLabel}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCrmSystemQueryReview(null)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/55 bg-white/25 text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_6px_20px_-14px_rgba(15,23,42,0.2)] backdrop-blur-md transition-colors hover:bg-white/40 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/55 focus-visible:ring-offset-1"
                aria-label="Close"
                title="Close"
              >
                <X className="h-4 w-4" strokeWidth={2.25} />
              </button>
            </div>
            {(() => {
              const { expected, actual, body } = deriveExpectedActualAndBody(crmSystemQueryReview)
              const queryFieldControl = findControlForQueryField(
                selectedForm,
                normalizeQueryFieldIdForTableColumnLookup(crmSystemQueryReview?.fieldId),
              )
              const submittedBy = Number(getQueryAssignedToUserId(crmSystemQueryReview))
              const isSubmittedOwner =
                Number.isFinite(submittedBy) && loggedInUserId === submittedBy
              const isClosed = isQueryClosedStatus(crmSystemQueryReview.status)
              const isReviewerOwner = canCurrentUserCloseQuery(crmSystemQueryReview, loggedInUserId)
              const canEditReviewerComment =
                isReviewerOwner && !isClosed && (canCloseQueriesByMatrix || canCreateQuery)
              const canEditSubmittedComment = isSubmittedOwner && !isClosed && canRespondToQueries
              const canEditActualFromQuery = canEditSubmittedComment
              const canSaveAnyComment = canEditReviewerComment || canEditSubmittedComment
              const sysFieldIdVal = String(crmSystemQueryReview.fieldId || "").trim()
              const sysPersistedRawForOld = getPersistedActualValueForQueryField(
                crmSystemQueryReview,
                selectedForm?.id,
              )
              const sysLiveRawForNew = getLiveQueryFieldValueRaw(
                sysFieldIdVal,
                selectedForm?.id,
                formData,
                optimisticControlValues,
              )
              const sysOldValueTrim = String(stringifyQueryActualValue(sysPersistedRawForOld) ?? "").trim()
              const sysNewValueTrim = String(stringifyQueryActualValue(sysLiveRawForNew) ?? "").trim()
              const sysValueChangedForActualSave =
                isSubmittedOwner && sysFieldIdVal && sysNewValueTrim !== sysOldValueTrim
              const sysActualSaveBlocked =
                queryModalSaving ||
                (canEditActualFromQuery &&
                  sysValueChangedForActualSave &&
                  systemQueryActualErrors.length > 0)
              return (
                <div className="space-y-3 px-4 py-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Expected value</label>
                    <div className="mt-1 rounded-md border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs text-slate-800 min-h-[32px] flex items-center">
                      {expected || "—"}
                    </div>
                  </div>
                  <div
                    className={`rounded-xl p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ${
                      canEditActualFromQuery && systemQueryActualErrors.length > 0
                        ? "border border-rose-300/90 bg-rose-50/40 ring-1 ring-rose-200/70"
                        : "border border-amber-200/80 bg-amber-50/55"
                    }`}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-amber-700/90">
                      Actual value
                    </p>
                    {canEditActualFromQuery ? (
                      <div className="mt-2 space-y-2">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start">
                          <div className="min-w-0 space-y-1">
                            <label className="text-xs font-semibold text-slate-600">Old value</label>
                            <div className="mt-0.5 min-w-0">
                              {queryFieldControl ? (
                                renderQueryActualReadOnlyByControl(queryFieldControl, sysPersistedRawForOld)
                              ) : (
                                <div className="rounded-md border border-amber-200/90 bg-white px-3 py-2 text-sm text-slate-900 min-h-[40px] flex items-center font-mono tabular-nums break-all">
                                  {sysOldValueTrim === "" ? "—" : maskDisplay(sysPersistedRawForOld, queryFieldControl)}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="min-w-0 space-y-1">
                            <label className="text-xs font-semibold text-slate-600">New value</label>
                            <div className="mt-0.5 min-w-0">
                              {queryFieldControl ? (
                                renderQueryActualReadOnlyByControl(queryFieldControl, sysLiveRawForNew)
                              ) : (
                                <div className="rounded-md border border-amber-200/90 bg-white px-3 py-2 text-sm text-slate-900 min-h-[40px] flex items-center font-mono tabular-nums break-all">
                                  {sysNewValueTrim === "" ? "—" : maskDisplay(sysLiveRawForNew, queryFieldControl)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        {systemQueryActualErrors.length > 0 && (
                          <ul className="space-y-0.5 text-xs text-rose-700" role="alert">
                            {systemQueryActualErrors.map((err, i) => (
                              <li key={i} className="flex items-start gap-1.5">
                                <AlertTriangle
                                  className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-90"
                                  aria-hidden
                                />
                                <span>{err}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : (
                      <div className="mt-1 rounded-md border border-amber-100/90 bg-white px-3 py-1.5 text-xs text-slate-800 min-h-[32px] flex items-center">
                        {canViewMaskedData || !queryFieldControl
                          ? actual || "—"
                          : maskDisplay(actual, queryFieldControl) || "—"}
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl border border-amber-200/80 bg-amber-50/55 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                    <label className="text-[11px] font-semibold uppercase tracking-[0.04em] text-amber-700/90">Query message</label>
                    <div className="mt-1 rounded-md border border-amber-100/90 bg-white px-3 py-2 text-sm text-slate-800 whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {body || "—"}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Reviewer comment</label>
                    <textarea
                      rows={2}
                      value={systemQueryCommentDraft}
                      onChange={(e) => setSystemQueryCommentDraft(e.target.value)}
                      readOnly={!canEditReviewerComment}
                      className={`mt-1 w-full rounded-md border px-3 py-2 text-sm resize-none ${
                        !canEditReviewerComment
                          ? "border-slate-200 bg-slate-50/80 text-slate-500"
                          : "border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
                      }`}
                      placeholder="Reviewer note"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-600">Submitted user comment</label>
                    <textarea
                      rows={2}
                      value={systemQuerySubmitterCommentDraft}
                      onChange={(e) => setSystemQuerySubmitterCommentDraft(e.target.value)}
                      readOnly={!canEditSubmittedComment}
                      className={`mt-1 w-full rounded-md border px-3 py-2 text-sm resize-none ${
                        !canEditSubmittedComment
                          ? "border-slate-200 bg-slate-50/80 text-slate-500"
                          : "border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
                      }`}
                      placeholder="Submitted user note"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setCrmSystemQueryReview(null)}
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    {!isClosed && canSaveAnyComment && (
                      <>
                        <button
                          type="button"
                          disabled={sysActualSaveBlocked}
                          onClick={() => void saveSystemQueryComment()}
                          className="rounded-md border border-emerald-300/80 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60 disabled:pointer-events-none"
                        >
                          {queryModalSaving ? "Saving…" : "Save comment"}
                        </button>
                        {isReviewerOwner && canCloseQueriesByMatrix && (
                          <button
                            type="button"
                            disabled={queryModalSaving}
                            onClick={() => void closeSystemQueryFromReviewer()}
                            className="rounded-md bg-gradient-to-r from-amber-600 to-orange-600 px-3 py-2 text-xs font-semibold text-white hover:from-amber-700 hover:to-orange-700 shadow-sm disabled:opacity-60 disabled:pointer-events-none"
                          >
                            Close query
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </>
  )
})

export default EcrfQueryReviewPanels
