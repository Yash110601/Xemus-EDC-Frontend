"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { crfQueryManagementService, rsdvReviewService } from "@/lib/services"
import { useStudyAiSettingsForStudy } from "@/lib/intelligence/useStudyAiSettings"
import {
  formatQueryGridDate,
  getCrfSubmitterComment,
  getQueryApproverComment,
  getQueryStatusLabel,
  getQueryStatusPillClass,
  isQueryClosedStatus,
  isQueryOpenStatus,
  QUERY_STATUS_CLOSED,
  queryDtoPick,
} from "@/app/ecrf-data-entry/manually/lib/crfQueryReviewUi"
import RsdvPatientContextMeta from "@/components/rsdv/RsdvPatientContextMeta"
import RsdvCrfFieldValuesPanel from "@/components/rsdv/RsdvCrfFieldValuesPanel"
import { pickQueryIdFromResponse } from "@/lib/rsdv/rsdvQueryUtils"
import { resolveRsdvFieldLabel } from "@/lib/rsdv/useRsdvFieldLabelLookup"
import {
  RSDV_BTN_OUTLINE,
  RSDV_BTN_PRIMARY,
  RSDV_BTN_SECONDARY,
  RSDV_BTN_SKY,
} from "@/lib/rsdv/rsdvUi"
import { cn } from "@/lib/utils"
import {
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  History,
  Layers,
  Loader2,
  MessageSquarePlus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Trash2,
} from "lucide-react"

const HIGHLIGHT_COLORS = [
  { id: "amber", label: "Amber", className: "bg-amber-200" },
  { id: "rose", label: "Rose", className: "bg-rose-200" },
  { id: "sky", label: "Sky", className: "bg-sky-200" },
  { id: "lime", label: "Lime", className: "bg-lime-200" },
]

const TABS = [
  { id: "queries", label: "Queries", icon: ClipboardList },
  { id: "findings", label: "Findings", icon: Layers },
  { id: "notes", label: "RSDV notes", icon: StickyNote },
  { id: "activity", label: "Activity", icon: History },
]

function buildEcrfLink({ studyId, siteId, patientEnrolmentId, visitScheduleId, crfDesignId }) {
  const params = new URLSearchParams()
  if (studyId) params.set("studyId", String(studyId))
  if (siteId) params.set("siteId", String(siteId))
  if (patientEnrolmentId) params.set("patientId", String(patientEnrolmentId))
  if (visitScheduleId) params.set("visitId", String(visitScheduleId))
  if (crfDesignId) params.set("crfDesignId", String(crfDesignId))
  return `/ecrf-data-entry/manually?${params.toString()}`
}

function SelectedFieldBanner({ fieldId, fieldLabel, onClear }) {
  if (!fieldId && !fieldLabel) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 bg-white px-2 py-2 text-xs text-slate-500">
        Select a field from eCRF field values above.
      </p>
    )
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2">
      <p className="text-sm font-medium text-slate-900">{fieldLabel || fieldId}</p>
      <button type="button" onClick={onClear} className="shrink-0 text-xs font-medium text-slate-500 hover:text-slate-800">
        Clear
      </button>
    </div>
  )
}

export default function RsdvEcrfComparisonPanel({
  attachment,
  context,
  canEdit = false,
  allowReopen = false,
  canCreateQuery = false,
  canCloseQuery = false,
  showPatientMeta = true,
  selectedCrfId: selectedCrfIdProp = null,
  onSelectedCrfIdChange,
  fieldId: fieldIdProp = "",
  fieldLabel: fieldLabelProp = "",
  onFieldSelect,
  onFocusDocumentAnnotation,
  onContextUpdated,
  onCompleted,
  resolveFieldLabel,
}) {
  const { toast } = useToast()
  const labelFor = useCallback(
    (item) =>
      resolveFieldLabel
        ? resolveFieldLabel({
            crfDataId: item?.crfDataId,
            fieldId: item?.fieldId,
            fieldLabel: item?.fieldLabel,
          })
        : resolveRsdvFieldLabel(new Map(), {
            crfDataId: item?.crfDataId,
            fieldId: item?.fieldId,
            fieldLabel: item?.fieldLabel,
          }),
    [resolveFieldLabel],
  )
  const queryLabelFor = useCallback(
    (row) =>
      labelFor({
        crfDataId: queryDtoPick(row, "crfDataId", "CrfDataId"),
        fieldId: queryDtoPick(row, "fieldId", "FieldId"),
        fieldLabel: queryDtoPick(row, "fieldLabel", "FieldLabel"),
      }),
    [labelFor],
  )
  const [activeTab, setActiveTab] = useState("queries")
  const [selectedCrfIdLocal, setSelectedCrfIdLocal] = useState(null)
  const [fieldIdLocal, setFieldIdLocal] = useState("")
  const [fieldLabelLocal, setFieldLabelLocal] = useState("")
  const selectedCrfId = selectedCrfIdProp ?? selectedCrfIdLocal
  const setSelectedCrfId = onSelectedCrfIdChange ?? setSelectedCrfIdLocal
  const fieldId = fieldIdProp || fieldIdLocal
  const fieldLabel = fieldLabelProp || fieldLabelLocal
  const [queries, setQueries] = useState([])
  const [loadingQueries, setLoadingQueries] = useState(false)
  const [queryActionId, setQueryActionId] = useState(null)
  const [editingFieldNoteId, setEditingFieldNoteId] = useState(null)
  const [editingFieldNoteText, setEditingFieldNoteText] = useState("")
  const [fieldNoteActionId, setFieldNoteActionId] = useState(null)
  const [queryText, setQueryText] = useState("")
  const [suggestingQuery, setSuggestingQuery] = useState(false)
  const { isAiQueryCopilotEnabled } = useStudyAiSettingsForStudy(attachment?.studyId)
  const [reviewerComment, setReviewerComment] = useState("")
  const [commentText, setCommentText] = useState("")
  const [highlightColor, setHighlightColor] = useState("amber")
  const [reviewComment, setReviewComment] = useState(context?.reviewComment ?? "")
  const [saving, setSaving] = useState(false)
  const [raisingQuery, setRaisingQuery] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false)
  const [reopening, setReopening] = useState(false)

  const handleFieldInput = useCallback(
    (nextFieldId, nextFieldLabel) => {
      if (onFieldSelect) onFieldSelect(nextFieldId, nextFieldLabel)
      else {
        setFieldIdLocal(nextFieldId ?? "")
        setFieldLabelLocal(nextFieldLabel ?? "")
      }
    },
    [onFieldSelect],
  )

  const isCompleted = context?.reviewStatus === "completed"
  const crfRecords = context?.crfRecords ?? []
  const annotations = context?.annotations ?? []
  const documentAnnotations = context?.documentAnnotations ?? []
  const completionReadiness = context?.completionReadiness ?? null
  const rsdvMarksSdvOnComplete = Boolean(context?.rsdvMarksSdvOnComplete)
  const rsdvRequireResolvedFindings = Boolean(context?.rsdvRequireResolvedFindings)
  const pendingSdvCount = completionReadiness?.crfDataIdsPendingSdvMark?.length ?? 0
  const canCompleteReview = completionReadiness?.canComplete !== false
  const canWriteReview = canEdit && !isCompleted
  const canOpenQuery = canCreateQuery && canWriteReview
  const showReadOnlyHint = !canWriteReview
  const showQueryReadOnlyHint = canWriteReview && !canOpenQuery

  const selectedCrf = useMemo(
    () => crfRecords.find((crf) => crf.crfDataId === selectedCrfId) ?? null,
    [crfRecords, selectedCrfId],
  )

  useEffect(() => {
    if (crfRecords.length && !selectedCrfId) {
      setSelectedCrfId(crfRecords[0]?.crfDataId ?? null)
    }
  }, [crfRecords, selectedCrfId])

  useEffect(() => {
    setReviewComment(context?.reviewComment ?? "")
  }, [context?.reviewComment])

  const loadQueries = useCallback(async () => {
    const studyId = attachment?.studyId
    const siteId = attachment?.siteId
    const patientEnrolmentId = attachment?.patientEnrolmentId
    const visitScheduleId = attachment?.visitScheduleId
    if (!studyId || !siteId || !patientEnrolmentId) {
      setQueries([])
      return
    }

    setLoadingQueries(true)
    try {
      const res = await crfQueryManagementService.getQueryListByStudySitePatient({
        studyId,
        siteId,
        patientEnrolmentId,
      })
      const rows = Array.isArray(res?.data) ? res.data : []
      const forVisit = visitScheduleId
        ? rows.filter((row) => {
            const vsid = queryDtoPick(row, "visitScheduleId", "VisitScheduleId")
            return String(vsid) === String(visitScheduleId)
          })
        : rows
      setQueries(forVisit)
    } finally {
      setLoadingQueries(false)
    }
  }, [attachment?.patientEnrolmentId, attachment?.siteId, attachment?.studyId, attachment?.visitScheduleId])

  useEffect(() => {
    void loadQueries()
  }, [loadQueries])

  const crfScopedQueries = useMemo(() => {
    if (!selectedCrfId) return queries
    return queries.filter((row) => {
      const crfDataId = queryDtoPick(row, "crfDataId", "CrfDataId")
      return !crfDataId || String(crfDataId) === String(selectedCrfId)
    })
  }, [queries, selectedCrfId])

  const findings = useMemo(() => {
    const rows = [
      ...annotations.map((item) => ({
        key: `field-${item.id ?? item.guid}`,
        kind: "field",
        createdAt: item.createdAt,
        item,
      })),
      ...documentAnnotations.map((item) => ({
        key: `doc-${item.id ?? item.guid}`,
        kind: "document",
        createdAt: item.createdAt,
        item,
      })),
    ]
    return rows.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return bTime - aTime
    })
  }, [annotations, documentAnnotations])

  const ensureSession = useCallback(async () => {
    if (context?.reviewSessionId) return context
    if (!canEdit || !attachment?.attachmentId) return null
    const res = await rsdvReviewService.startReview(attachment.attachmentId)
    if (res?.isSuccess && res.data) {
      onContextUpdated?.(res.data)
      return res.data
    }
    toast({
      title: "Could not start review",
      description: res?.message || "Try again or contact support.",
      variant: "destructive",
    })
    return null
  }, [attachment?.attachmentId, canEdit, context, onContextUpdated, toast])

  const handleSuggestQuery = async () => {
    if (!isAiQueryCopilotEnabled || !attachment?.attachmentId) return
    if (!fieldId.trim()) {
      toast({ title: "Select a field", description: "Choose a field before suggesting query text.", variant: "destructive" })
      return
    }
    setSuggestingQuery(true)
    try {
      const res = await rsdvReviewService.suggestQuery({
        attachmentId: attachment.attachmentId,
        crfDataId: selectedCrfId,
        fieldId: fieldId.trim(),
        fieldLabel: fieldLabel || fieldId,
        fieldValue: "",
        commentText: reviewerComment.trim() || undefined,
      })
      if (res?.isSuccess && res.data) {
        if (res.data.queryText) setQueryText(String(res.data.queryText))
        if (res.data.reviewerComment) setReviewerComment(String(res.data.reviewerComment))
        toast({ title: "Query draft ready", description: "Edit before opening the query.", variant: "success" })
      } else {
        toast({ title: "Suggest unavailable", description: res?.message, variant: "destructive" })
      }
    } finally {
      setSuggestingQuery(false)
    }
  }

  const handleRaiseQuery = async () => {
    if (!canCreateQuery || !canEdit || isCompleted) return
    if (!selectedCrfId || !selectedCrf) {
      toast({ title: "Select a CRF", description: "Choose a CRF before raising a query.", variant: "destructive" })
      return
    }
    if (!fieldId.trim()) {
      toast({ title: "Field ID required", variant: "destructive" })
      return
    }
    if (!queryText.trim()) {
      toast({ title: "Query text required", variant: "destructive" })
      return
    }

    setRaisingQuery(true)
    try {
      await ensureSession()
      const res = await crfQueryManagementService.createManualGeneratedQuery({
        studyId: attachment.studyId,
        siteId: attachment.siteId,
        patientEnrolmentId: attachment.patientEnrolmentId,
        visitScheduleId: attachment.visitScheduleId,
        crfDesignId: selectedCrf.crfDesignId,
        crfDataId: selectedCrfId,
        fieldId: fieldId.trim(),
        fieldLabel: fieldLabel.trim() || fieldId.trim(),
        queryText: queryText.trim(),
        queryApproverComment: reviewerComment.trim() || null,
      })
      if (res?.isSuccess) {
        const queryId = pickQueryIdFromResponse(res)
        const active = await ensureSession()
        const sessionId = active?.reviewSessionId ?? context?.reviewSessionId
        if (sessionId && queryId) {
          const noteRes = await rsdvReviewService.saveAnnotation({
            reviewSessionId: sessionId,
            crfDataId: selectedCrfId,
            fieldId: fieldId.trim(),
            fieldLabel: fieldLabel.trim() || fieldId.trim(),
            annotationType: "comment",
            highlightColor: "rose",
            commentText: queryText.trim(),
            queryId,
          })
          if (noteRes?.isSuccess) {
            const refreshed = await rsdvReviewService.getContext(attachment.attachmentId)
            if (refreshed?.isSuccess) onContextUpdated?.(refreshed.data)
          }
        }

        toast({ title: "Query opened", variant: "success" })
        setQueryText("")
        setReviewerComment("")
        await loadQueries()
        setActiveTab("queries")
      } else {
        toast({
          title: "Query not created",
          description: res?.message || "Could not open query.",
          variant: "destructive",
        })
      }
    } finally {
      setRaisingQuery(false)
    }
  }

  const handleCloseQuery = async (row) => {
    if (!canCloseQuery || !canEdit) return
    const queryId = Number(row?.id ?? row?.queryId)
    if (!Number.isFinite(queryId) || queryId <= 0) return
    if (isQueryClosedStatus(row?.status ?? row?.Status)) return

    setQueryActionId(queryId)
    try {
      const res = await crfQueryManagementService.updateStatus({
        queryId,
        status: QUERY_STATUS_CLOSED,
      })
      if (res?.isSuccess) {
        toast({ title: "Query closed", variant: "success" })
        const linkedDocNotes = documentAnnotations.filter(
          (item) => Number(item.queryId) === queryId,
        )
        if (linkedDocNotes.length > 0 && attachment?.attachmentId) {
          await Promise.all(
            linkedDocNotes.map((item) =>
              rsdvReviewService.updateDocumentAnnotation({
                id: item.id,
                status: "resolved",
              }),
            ),
          )
          const refreshed = await rsdvReviewService.getContext(attachment.attachmentId)
          if (refreshed?.isSuccess) onContextUpdated?.(refreshed.data)
        }
        await loadQueries()
      } else {
        toast({
          title: "Close failed",
          description: res?.message || "Query could not be closed.",
          variant: "destructive",
        })
      }
    } finally {
      setQueryActionId(null)
    }
  }

  const handleSaveAnnotation = async () => {
    if (!canEdit || isCompleted) return
    if (!fieldId.trim() || !commentText.trim()) {
      toast({ title: "Field ID and comment required", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const active = await ensureSession()
      const sessionId = active?.reviewSessionId ?? context?.reviewSessionId
      if (!sessionId || !selectedCrfId) return

      const res = await rsdvReviewService.saveAnnotation({
        reviewSessionId: sessionId,
        crfDataId: selectedCrfId,
        fieldId: fieldId.trim(),
        fieldLabel: fieldLabel.trim() || fieldId.trim(),
        annotationType: "comment",
        highlightColor,
        commentText: commentText.trim(),
      })

      if (res?.isSuccess) {
        toast({ title: "RSDV note saved", variant: "success" })
        setCommentText("")
        const refreshed = await rsdvReviewService.getContext(attachment.attachmentId)
        if (refreshed?.isSuccess) onContextUpdated?.(refreshed.data)
        setActiveTab("notes")
      } else {
        toast({
          title: "Save failed",
          description: res?.message || "Note could not be saved.",
          variant: "destructive",
        })
      }
    } finally {
      setSaving(false)
    }
  }

  const executeComplete = async ({ confirmMarkSdv = false } = {}) => {
    setCompleting(true)
    try {
      const active = await ensureSession()
      const sessionId = active?.reviewSessionId ?? context?.reviewSessionId
      if (!sessionId) return

      const res = await rsdvReviewService.completeReview({
        reviewSessionId: sessionId,
        reviewComment: reviewComment.trim() || null,
        confirmMarkSdv,
      })

      if (res?.isSuccess) {
        toast({ title: "Review completed", variant: "success" })
        onContextUpdated?.(res.data)
        onCompleted?.()
        setCompleteConfirmOpen(false)
      } else {
        toast({
          title: "Complete failed",
          description: res?.message || "Review could not be completed.",
          variant: "destructive",
        })
      }
    } finally {
      setCompleting(false)
    }
  }

  const handleComplete = async () => {
    if (!canEdit || isCompleted) return

    if (rsdvRequireResolvedFindings && completionReadiness && !completionReadiness.canComplete) {
      toast({
        title: "Cannot complete review",
        description:
          completionReadiness.blockedReasons?.join(" ") ||
          "Resolve open document notes and queries before completing.",
        variant: "destructive",
      })
      return
    }

    if (rsdvMarksSdvOnComplete && pendingSdvCount > 0) {
      setCompleteConfirmOpen(true)
      return
    }

    await executeComplete()
  }

  const handleReopenReview = async () => {
    if (!allowReopen || !context?.reviewSessionId) return
    setReopening(true)
    try {
      const res = await rsdvReviewService.reopenReview(context.reviewSessionId)
      if (res?.isSuccess) {
        toast({ title: "Review reopened", variant: "success" })
        onContextUpdated?.(res.data)
      } else {
        toast({
          title: "Reopen failed",
          description: res?.message || "Review could not be reopened.",
          variant: "destructive",
        })
      }
    } finally {
      setReopening(false)
    }
  }

  const handleUpdateFieldNote = async (noteId) => {
    if (!canWriteReview || !noteId || !editingFieldNoteText.trim()) return
    setFieldNoteActionId(noteId)
    try {
      const res = await rsdvReviewService.updateFieldAnnotation({
        id: noteId,
        commentText: editingFieldNoteText.trim(),
      })
      if (res?.isSuccess) {
        toast({ title: "Note updated", variant: "success" })
        setEditingFieldNoteId(null)
        setEditingFieldNoteText("")
        const refreshed = await rsdvReviewService.getContext(attachment.attachmentId)
        if (refreshed?.isSuccess) onContextUpdated?.(refreshed.data)
      } else {
        toast({ title: "Update failed", description: res?.message, variant: "destructive" })
      }
    } finally {
      setFieldNoteActionId(null)
    }
  }

  const handleDeleteFieldNote = async (noteId) => {
    if (!canWriteReview || !noteId) return
    setFieldNoteActionId(noteId)
    try {
      const res = await rsdvReviewService.deleteFieldAnnotation(noteId)
      if (res?.isSuccess) {
        toast({ title: "Note deleted", variant: "success" })
        const refreshed = await rsdvReviewService.getContext(attachment.attachmentId)
        if (refreshed?.isSuccess) onContextUpdated?.(refreshed.data)
      } else {
        toast({ title: "Delete failed", description: res?.message, variant: "destructive" })
      }
    } finally {
      setFieldNoteActionId(null)
    }
  }

  const handleFindingActivate = (finding) => {
    if (finding.kind === "document") {
      const item = finding.item
      if (item.fieldId || item.crfDataId) {
        handleFieldInput(item.fieldId, labelFor(item))
        if (item.crfDataId) setSelectedCrfId(item.crfDataId)
      }
      onFocusDocumentAnnotation?.(item.id)
      return
    }

    const item = finding.item
    if (item.crfDataId) setSelectedCrfId(item.crfDataId)
    handleFieldInput(item.fieldId, labelFor(item))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 space-y-2 border-b border-emerald-100/80 bg-gradient-to-r from-slate-50/80 to-emerald-50/30 px-3 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">eCRF comparison</p>
          <p className="text-[11px] text-slate-500">
            Queries, CRC/CRA comments, and RSDV notes for this study, visit, and patient.
          </p>
        </div>
        {showPatientMeta ? <RsdvPatientContextMeta row={attachment} variant="cards" /> : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="space-y-0">
          <div className="space-y-2 border-b border-slate-100 p-3">
        {crfRecords.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">No CRF records for this visit yet.</p>
        ) : (
          crfRecords.map((crf) => {
            const selected = selectedCrfId === crf.crfDataId
            return (
              <div
                key={crf.crfDataId}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-xl border px-3 py-2",
                  selected ? "border-emerald-300 bg-emerald-50/60" : "border-slate-200 bg-slate-50/60",
                )}
              >
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSelectedCrfId(crf.crfDataId)}>
                  <p className="truncate text-sm font-medium text-slate-900">
                    {crf.crfDesignName || `CRF #${crf.crfDataId}`}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Status: {crf.status || "—"}
                    {crf.submittedAt ? ` · Submitted ${new Date(crf.submittedAt).toLocaleString()}` : ""}
                    {crf.isSdvVerify ? " · SDV verified" : ""}
                  </p>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  {crf.isSdvVerify ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
                      <ShieldCheck className="h-3 w-3" />
                      SDV
                    </span>
                  ) : null}
                  <Button asChild size="sm" variant="outline" className={cn(RSDV_BTN_SECONDARY)}>
                  <Link
                    href={buildEcrfLink({
                      studyId: attachment.studyId,
                      siteId: attachment.siteId,
                      patientEnrolmentId: attachment.patientEnrolmentId,
                      visitScheduleId: attachment.visitScheduleId,
                      crfDesignId: crf.crfDesignId,
                    })}
                    target="_blank"
                  >
                    <ExternalLink className="mr-1 h-3.5 w-3.5" />
                    Open
                  </Link>
                </Button>
                </div>
              </div>
            )
          })
        )}
          </div>

          {selectedCrf ? (
            <div className="border-b border-slate-100 p-3">
              <RsdvCrfFieldValuesPanel
                studyId={attachment.studyId}
                crfDataId={selectedCrfId}
                crfDesignId={selectedCrf.crfDesignId}
                selectedFieldId={fieldId}
                onFieldSelect={handleFieldInput}
              />
            </div>
          ) : null}

          <div className="sticky top-0 z-10 flex gap-1 border-b border-slate-100 bg-white/95 px-2 py-1.5 backdrop-blur-sm">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all",
              activeTab === id
                ? "bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500/30"
                : "border border-slate-200 bg-white text-slate-600 shadow-sm hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {id === "findings" && findings.length > 0 ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0 text-[10px] font-bold",
                  activeTab === id ? "bg-white/25 text-white" : "bg-emerald-100 text-emerald-700",
                )}
              >
                {findings.length}
              </span>
            ) : null}
            {id === "queries" && crfScopedQueries.length > 0 ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0 text-[10px] font-bold",
                  activeTab === id ? "bg-white/25 text-white" : "bg-sky-100 text-sky-700",
                )}
              >
                {crfScopedQueries.length}
              </span>
            ) : null}
          </button>
        ))}
          </div>

          <div className="p-3">
        {activeTab === "queries" ? (
          <div className="space-y-3">
            {loadingQueries ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
              </div>
            ) : crfScopedQueries.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                No queries for this visit{selectedCrf ? ` / CRF` : ""}. Open a query below if a discrepancy is found.
              </p>
            ) : (
              crfScopedQueries.map((row) => {
                const queryId = row?.id ?? row?.queryId
                const status = row?.status ?? row?.Status
                const craComment = getQueryApproverComment(row)
                const crcComment = getCrfSubmitterComment(row)
                const canClose = canCloseQuery && canEdit && isQueryOpenStatus(status)

                return (
                  <div key={String(row?.guid ?? queryId)} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">
                          #{queryId} · {queryLabelFor(row) || "Field"}
                        </p>
                        <p className="mt-1 text-slate-700">{queryDtoPick(row, "queryText", "QueryText") || "—"}</p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          getQueryStatusPillClass(status),
                        )}
                      >
                        {getQueryStatusLabel(status)}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-2 text-[11px] text-slate-600 sm:grid-cols-2">
                      <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                        <p className="font-semibold text-slate-500">CRA / reviewer</p>
                        <p className="mt-0.5 whitespace-pre-wrap">{craComment || "—"}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                        <p className="font-semibold text-slate-500">CRC / site response</p>
                        <p className="mt-0.5 whitespace-pre-wrap">{crcComment || "—"}</p>
                      </div>
                    </div>
                    <p className="mt-2 text-[10px] text-slate-400">
                      Raised {formatQueryGridDate(row?.createdAt ?? row?.CreatedAt)}
                      {(row?.closedAt ?? row?.ClosedAt)
                        ? ` · Closed ${formatQueryGridDate(row?.closedAt ?? row?.ClosedAt)}`
                        : ""}
                    </p>
                    {canClose ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={cn("mt-2", RSDV_BTN_OUTLINE)}
                        disabled={queryActionId === queryId}
                        onClick={() => void handleCloseQuery(row)}
                      >
                        {queryActionId === queryId ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        Close query
                      </Button>
                    ) : null}
                  </div>
                )
              })
            )}

            {canOpenQuery ? (
              <div className="space-y-2 rounded-xl border border-sky-200/80 bg-gradient-to-br from-sky-50/80 to-white p-3 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-sky-700">Open query</p>
                <SelectedFieldBanner
                  fieldId={fieldId}
                  fieldLabel={fieldLabel}
                  onClear={() => handleFieldInput("", "")}
                />
                <textarea
                  value={queryText}
                  onChange={(e) => setQueryText(e.target.value)}
                  placeholder="Query text (discrepancy vs source document)…"
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                />
                <textarea
                  value={reviewerComment}
                  onChange={(e) => setReviewerComment(e.target.value)}
                  placeholder="CRA reviewer comment (optional)…"
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                />
                {isAiQueryCopilotEnabled ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={suggestingQuery || !fieldId.trim()}
                    onClick={() => void handleSuggestQuery()}
                    className={RSDV_BTN_OUTLINE}
                  >
                    {suggestingQuery ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1 h-3.5 w-3.5" />
                    )}
                    Suggest query
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  disabled={raisingQuery}
                  onClick={() => void handleRaiseQuery()}
                  className={RSDV_BTN_SKY}
                >
                  {raisingQuery ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                  Open query
                </Button>
              </div>
            ) : showReadOnlyHint ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2.5 text-xs text-amber-900">
                {isCompleted
                  ? "This review is completed — queries and notes are read-only."
                  : "You have view-only access for RSDV review. Ask an admin for Edit on RSDV Review or query-create permission for this study/site."}
              </div>
            ) : showQueryReadOnlyHint ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2.5 text-xs text-amber-900">
                You can add RSDV notes on the Notes tab, but query creation is not enabled for your role on this study/site.
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "findings" ? (
          <div className="space-y-3">
            {findings.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                No findings yet. Add document region notes or field notes during review.
              </p>
            ) : (
              findings.map((finding) => {
                const item = finding.item
                const isDocument = finding.kind === "document"
                return (
                  <button
                    key={finding.key}
                    type="button"
                    onClick={() => handleFindingActivate(finding)}
                    className={cn(
                      "w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/40",
                      isDocument ? "border-teal-200/80 bg-teal-50/30" : "border-slate-200 bg-white",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-slate-900">
                        {isDocument
                          ? `Document · Page ${item.pageNumber ?? 1}`
                          : labelFor(item)}
                      </p>
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        {isDocument ? "Region" : "Field"}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-3 text-slate-600">{item.commentText}</p>
                    {item.fieldId ? (
                      <p className="mt-1 text-[11px] font-medium text-sky-700">Linked field: {labelFor(item)}</p>
                    ) : null}
                    {item.queryId ? (
                      <p className="mt-1 text-[11px] font-medium text-sky-700">Linked query #{item.queryId}</p>
                    ) : null}
                    {item.createdAt ? (
                      <p className="mt-1 text-[10px] text-slate-400">{formatQueryGridDate(item.createdAt)}</p>
                    ) : null}
                  </button>
                )
              })
            )}
          </div>
        ) : null}

        {activeTab === "notes" ? (
          <div className="space-y-3">
            {documentAnnotations.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-teal-700">Document region notes</p>
                {documentAnnotations.map((item) => (
                  <div
                    key={`doc-${item.id ?? item.guid}`}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-sm",
                      item.isOrphaned ? "border-dashed border-slate-300 bg-slate-50" : "border-teal-200/80 bg-teal-50/40",
                    )}
                  >
                    <p className="font-medium text-slate-900">
                      Page {item.pageNumber ?? 1}
                      <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        {item.isOrphaned ? "Stale" : String(item.status ?? "open")}
                      </span>
                    </p>
                    <p className="mt-1 text-slate-600">{item.commentText}</p>
                    {item.fieldId ? (
                      <p className="mt-1 text-[11px] font-medium text-sky-700">Linked field: {labelFor(item)}</p>
                    ) : null}
                    {item.queryId ? (
                      <p className="mt-1 text-[11px] font-medium text-sky-700">Linked query #{item.queryId}</p>
                    ) : null}
                    {item.createdAt ? (
                      <p className="mt-1 text-[10px] text-slate-400">{formatQueryGridDate(item.createdAt)}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {annotations.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                {documentAnnotations.length > 0
                  ? "No RSDV field notes yet for this document."
                  : "No RSDV notes yet for this document."}
              </p>
            ) : (
              annotations.map((item) => {
                const noteId = item.id
                const isEditing = editingFieldNoteId === noteId
                return (
                  <div key={item.id ?? item.guid} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                    <p className="font-medium text-slate-900">
                      {labelFor(item)}
                      {item.highlightColor ? (
                        <span
                          className={cn(
                            "ml-2 inline-block h-2.5 w-2.5 rounded-full align-middle",
                            HIGHLIGHT_COLORS.find((c) => c.id === item.highlightColor)?.className ?? "bg-amber-200",
                          )}
                        />
                      ) : null}
                    </p>
                    {isEditing ? (
                      <textarea
                        value={editingFieldNoteText}
                        onChange={(e) => setEditingFieldNoteText(e.target.value)}
                        rows={2}
                        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                      />
                    ) : (
                      <p className="mt-1 text-slate-600">{item.commentText}</p>
                    )}
                    {item.queryId ? (
                      <p className="mt-1 text-[11px] font-medium text-sky-700">Linked query #{item.queryId}</p>
                    ) : null}
                    {item.createdAt ? (
                      <p className="mt-1 text-[10px] text-slate-400">{formatQueryGridDate(item.createdAt)}</p>
                    ) : null}
                    {canWriteReview && noteId ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {isEditing ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              className={RSDV_BTN_SECONDARY}
                              disabled={fieldNoteActionId === noteId}
                              onClick={() => void handleUpdateFieldNote(noteId)}
                            >
                              Save
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingFieldNoteId(null)
                                setEditingFieldNoteText("")
                              }}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className={RSDV_BTN_OUTLINE}
                              onClick={() => {
                                setEditingFieldNoteId(noteId)
                                setEditingFieldNoteText(item.commentText ?? "")
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-rose-700 hover:text-rose-800"
                              disabled={fieldNoteActionId === noteId}
                              onClick={() => void handleDeleteFieldNote(noteId)}
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" />
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                )
              })
            )}

            {canWriteReview ? (
              <div className="space-y-2 rounded-xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 to-white p-3 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Add RSDV field note</p>
                <SelectedFieldBanner
                  fieldId={fieldId}
                  fieldLabel={fieldLabel}
                  onClear={() => handleFieldInput("", "")}
                />
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Internal RSDV note (does not replace a formal query)…"
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                />
                <div className="flex flex-wrap items-center gap-2">
                  {HIGHLIGHT_COLORS.map((color) => (
                    <button
                      key={color.id}
                      type="button"
                      title={color.label}
                      onClick={() => setHighlightColor(color.id)}
                      className={cn(
                        "h-6 w-6 rounded-full ring-2 ring-offset-1",
                        color.className,
                        highlightColor === color.id ? "ring-emerald-500" : "ring-transparent",
                      )}
                    />
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    disabled={saving}
                    onClick={() => void handleSaveAnnotation()}
                    className={cn("ml-auto", RSDV_BTN_SECONDARY)}
                  >
                    {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <MessageSquarePlus className="mr-1 h-4 w-4" />}
                    Save note
                  </Button>
                </div>
                <div className="space-y-2 border-t border-emerald-100/80 pt-2">
                  {rsdvRequireResolvedFindings && completionReadiness && !canCompleteReview ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-900">
                      <p className="font-semibold">Completion blocked</p>
                      <ul className="mt-1 list-inside list-disc space-y-0.5">
                        {(completionReadiness.blockedReasons ?? []).map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {rsdvMarksSdvOnComplete && pendingSdvCount > 0 ? (
                    <div className="rounded-lg border border-sky-200 bg-sky-50/90 px-3 py-2 text-xs text-sky-900">
                      Completing will mark {pendingSdvCount} submitted CRF
                      {pendingSdvCount === 1 ? "" : "s"} as SDV-verified.
                    </div>
                  ) : null}
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Review summary (optional)</label>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Overall review comment…"
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                  />
                  <Button
                    type="button"
                    disabled={completing || (rsdvRequireResolvedFindings && !canCompleteReview)}
                    onClick={() => void handleComplete()}
                    className={cn("w-full", RSDV_BTN_PRIMARY)}
                  >
                    {completing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    Mark review complete
                  </Button>
                </div>
              </div>
            ) : showReadOnlyHint ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2.5 text-xs text-amber-900">
                {isCompleted
                  ? "This review is completed — queries and notes are read-only."
                  : "You have view-only access for RSDV review. Ask an admin for Edit on RSDV Review or query-create permission for this study/site."}
              </div>
            ) : null}

            {isCompleted ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                <p className="font-semibold">Review completed</p>
                {reviewComment ? <p className="mt-1">{reviewComment}</p> : null}
                {allowReopen ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={cn("mt-2", RSDV_BTN_OUTLINE)}
                    disabled={reopening}
                    onClick={() => void handleReopenReview()}
                  >
                    {reopening ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="mr-1 h-3.5 w-3.5" />
                    )}
                    Reopen review
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "activity" ? (
          <div className="space-y-3 text-sm">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="font-semibold text-slate-900">Review session</p>
              <p className="mt-1 text-slate-600 capitalize">Status: {(context?.reviewStatus ?? "pending").replace(/_/g, " ")}</p>
              <p className="mt-1 text-[11px] text-slate-500">
                Audit entries for start review, annotations, query actions, and completion are recorded under{" "}
                <span className="font-medium">RSDV_MGMT</span> for this study.
              </p>
            </div>
            {annotations.map((item) => (
              <div key={`act-${item.id ?? item.guid}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">RSDV annotation</p>
                <p className="mt-1 font-medium text-slate-900">{labelFor(item)}</p>
                <p className="mt-0.5 text-slate-600">{item.commentText}</p>
                {item.queryId ? (
                  <p className="mt-0.5 text-[11px] font-medium text-sky-700">Linked query #{item.queryId}</p>
                ) : null}
                <p className="mt-1 text-[10px] text-slate-400">{formatQueryGridDate(item.createdAt)}</p>
              </div>
            ))}
            {crfScopedQueries.map((row) => (
              <div key={`act-q-${row?.guid ?? row?.id}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">CRF query #{row?.id ?? row?.queryId}</p>
                <p className="mt-1 text-slate-600">{getQueryStatusLabel(row?.status ?? row?.Status)} · {queryLabelFor(row) || "Field"}</p>
                <p className="mt-1 text-[10px] text-slate-400">
                  {formatQueryGridDate(row?.createdAt ?? row?.CreatedAt)}
                  {(row?.closedAt ?? row?.ClosedAt) ? ` → ${formatQueryGridDate(row?.closedAt ?? row?.ClosedAt)}` : ""}
                </p>
              </div>
            ))}
          </div>
        ) : null}
          </div>
        </div>
      </div>
      <AlertDialog open={completeConfirmOpen} onOpenChange={setCompleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark CRFs as SDV-verified?</AlertDialogTitle>
            <AlertDialogDescription>
              Completing this remote SDV review will set SDV verification on {pendingSdvCount} submitted
              visit CRF{pendingSdvCount === 1 ? "" : "s"}. This uses the same SDV flag as manual verification
              in eCRF data entry. Reopening the review will revert only CRFs marked by this session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={completing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={completing}
              onClick={(event) => {
                event.preventDefault()
                void executeComplete({ confirmMarkSdv: true })
              }}
            >
              {completing ? "Completing…" : "Complete and mark SDV"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
