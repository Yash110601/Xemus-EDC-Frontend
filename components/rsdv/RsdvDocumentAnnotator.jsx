"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { crfQueryManagementService, rsdvReviewService } from "@/lib/services"
import { useStudyAiSettingsForStudy } from "@/lib/intelligence/useStudyAiSettings"
import AiSuggestionBanner from "@/components/intelligence/AiSuggestionBanner"
import { pickQueryIdFromResponse } from "@/lib/rsdv/rsdvQueryUtils"
import {
  MIN_DRAG_PX,
  normalizedToPixelRect,
  pixelRectToNormalized,
  statusBorderClass,
  statusLabel,
} from "@/lib/rsdv/documentAnnotationCoords"
import { cropElementRegionToBase64 } from "@/lib/rsdv/cropCanvasRegion"
import { fetchRsdvFieldRows } from "@/lib/rsdv/fetchRsdvFieldRows"
import { getPdfContainerWidth, renderPdfPageToCanvas } from "@/lib/rsdv/pdfPageRender"
import { RSDV_BTN_OUTLINE, RSDV_BTN_PRIMARY, RSDV_BTN_SECONDARY } from "@/lib/rsdv/rsdvUi"
import { cn } from "@/lib/utils"
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  MousePointer2,
  SquarePen,
  Trash2,
  X,
} from "lucide-react"

function AnnotationEditorPanel({
  open,
  draftComment,
  onDraftChange,
  onSave,
  onCancel,
  onResolve,
  onReopen,
  onDelete,
  saving,
  canEdit,
  canRaiseQuery = false,
  raisingQuery = false,
  onRaiseQuery,
  linkedQueryId = null,
  status,
  isOrphaned,
  isNew,
}) {
  if (!open) return null

  const resolved = String(status).toLowerCase() === "resolved"

  return (
    <div className="shrink-0 border-t border-slate-200 bg-white p-3 shadow-[0_-4px_16px_rgba(15,23,42,0.06)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-800">
          {isNew ? "New document note" : statusLabel(status, isOrphaned)}
        </p>
        <button type="button" onClick={onCancel} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {isOrphaned ? (
        <p className="mb-2 text-xs text-slate-500">
          This region may no longer match the document after a re-upload. You can still read or delete it.
        </p>
      ) : null}
      {linkedQueryId ? (
        <p className="mb-2 text-xs font-medium text-sky-700">Linked query #{linkedQueryId}</p>
      ) : null}
      <Textarea
        value={draftComment}
        onChange={(event) => onDraftChange(event.target.value)}
        placeholder="Describe the issue or observation…"
        rows={3}
        disabled={!canEdit || resolved || isOrphaned}
        className="mb-2 text-sm"
      />
      <div className="flex flex-wrap items-center gap-2">
        {canEdit && !resolved && !isOrphaned ? (
          <Button type="button" size="sm" className={RSDV_BTN_PRIMARY} disabled={saving} onClick={onSave}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
          </Button>
        ) : null}
        {canRaiseQuery && !linkedQueryId && !resolved && !isOrphaned ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={RSDV_BTN_SECONDARY}
            disabled={saving || raisingQuery}
            onClick={onRaiseQuery}
          >
            {raisingQuery ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <MessageSquarePlus className="mr-1 h-3.5 w-3.5" />
            )}
            Raise query
          </Button>
        ) : null}
        {canEdit && !isNew && !isOrphaned ? (
          resolved ? (
            <Button type="button" size="sm" variant="outline" className={RSDV_BTN_OUTLINE} disabled={saving} onClick={onReopen}>
              Reopen
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" className={RSDV_BTN_SECONDARY} disabled={saving} onClick={onResolve}>
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              Resolve
            </Button>
          )
        ) : null}
        {canEdit && !isNew ? (
          <Button type="button" size="sm" variant="ghost" className="text-rose-700 hover:text-rose-800" disabled={saving} onClick={onDelete}>
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Delete
          </Button>
        ) : null}
        {isNew ? (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function AnnotationLayer({
  annotations,
  pageNumber,
  contentWidth,
  contentHeight,
  annotateMode,
  canEdit,
  onSelect,
  selectedId,
  draftRect,
}) {
  if (!contentWidth || !contentHeight) return null

  const pageItems = annotations.filter((item) => (item.pageNumber ?? 1) === pageNumber)

  return (
    <div className="absolute inset-0">
      {pageItems.map((item) => {
        const rect = normalizedToPixelRect({
          xPct: item.xPct,
          yPct: item.yPct,
          widthPct: item.widthPct,
          heightPct: item.heightPct,
          contentWidth,
          contentHeight,
        })
        const isSelected = selectedId === item.id
        return (
          <button
            key={item.id ?? item.guid}
            type="button"
            title={item.commentText || "Document note"}
            className={cn(
              "absolute border-2 transition hover:brightness-110",
              statusBorderClass(item.status, item.isOrphaned),
              isSelected && "ring-2 ring-emerald-600 ring-offset-1",
              annotateMode ? "pointer-events-auto cursor-pointer" : "pointer-events-auto cursor-pointer",
            )}
            style={{
              left: rect.left,
              top: rect.top,
              width: Math.max(rect.width, MIN_DRAG_PX),
              height: Math.max(rect.height, MIN_DRAG_PX),
            }}
            onClick={(event) => {
              event.stopPropagation()
              onSelect(item)
            }}
          >
            <span className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-slate-700 shadow">
              <MessageSquare className="h-3 w-3" />
            </span>
          </button>
        )
      })}
      {draftRect ? (
        <div
          className="pointer-events-none absolute border-2 border-dashed border-sky-500 bg-sky-400/20"
          style={{
            left: draftRect.left,
            top: draftRect.top,
            width: draftRect.width,
            height: draftRect.height,
          }}
        />
      ) : null}
    </div>
  )
}

function useDragRect(enabled, contentWidth, contentHeight, onComplete) {
  const [draftRect, setDraftRect] = useState(null)
  const dragRef = useRef(null)

  const onPointerDown = useCallback(
    (event) => {
      if (!enabled || !contentWidth || !contentHeight) return
      if (event.button !== 0) return
      const bounds = event.currentTarget.getBoundingClientRect()
      const startX = event.clientX - bounds.left
      const startY = event.clientY - bounds.top
      dragRef.current = { startX, startY, bounds }

      const onMove = (moveEvent) => {
        const { startX: sx, startY: sy, bounds: b } = dragRef.current ?? {}
        if (!dragRef.current) return
        const currentX = moveEvent.clientX - b.left
        const currentY = moveEvent.clientY - b.top
        const left = Math.min(sx, currentX)
        const top = Math.min(sy, currentY)
        const width = Math.abs(currentX - sx)
        const height = Math.abs(currentY - sy)
        setDraftRect({ left, top, width, height })
      }

      const onUp = (upEvent) => {
        window.removeEventListener("pointermove", onMove)
        window.removeEventListener("pointerup", onUp)
        const { startX: sx, startY: sy, bounds: b } = dragRef.current ?? {}
        dragRef.current = null
        if (sx == null) return
        const currentX = upEvent.clientX - b.left
        const currentY = upEvent.clientY - b.top
        const left = Math.min(sx, currentX)
        const top = Math.min(sy, currentY)
        const width = Math.abs(currentX - sx)
        const height = Math.abs(currentY - sy)
        setDraftRect(null)
        if (width < MIN_DRAG_PX && height < MIN_DRAG_PX) return
        const normalized = pixelRectToNormalized({
          left,
          top,
          width,
          height,
          contentWidth,
          contentHeight,
        })
        if (normalized) onComplete(normalized, { left, top, width, height })
      }

      window.addEventListener("pointermove", onMove)
      window.addEventListener("pointerup", onUp)
    },
    [enabled, contentWidth, contentHeight, onComplete],
  )

  return { draftRect, onPointerDown, setDraftRect }
}

function ImageStage({ streamUrl, alt, pageNumber, annotations, annotateMode, canEdit, onSelect, selectedId, onDrawComplete, onCanvasReady }) {
  const stageRef = useRef(null)
  const [contentSize, setContentSize] = useState({ width: 0, height: 0 })

  const measure = useCallback(() => {
    const img = stageRef.current?.querySelector("img")
    if (!img) return
    setContentSize({ width: img.clientWidth, height: img.clientHeight })
  }, [])

  useEffect(() => {
    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [measure, streamUrl])

  useEffect(() => {
    const img = stageRef.current?.querySelector("img")
    if (img && onCanvasReady) onCanvasReady(img)
  }, [contentSize, streamUrl, onCanvasReady])

  const { draftRect, onPointerDown } = useDragRect(
    annotateMode && canEdit,
    contentSize.width,
    contentSize.height,
    onDrawComplete,
  )

  return (
    <div ref={stageRef} className="relative inline-block max-h-full max-w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={streamUrl}
        alt={alt}
        className="block max-h-[min(72dvh,900px)] max-w-full select-none"
        draggable={false}
        onLoad={measure}
      />
      <div
        className={cn(
          "absolute inset-0",
          annotateMode && canEdit ? "cursor-crosshair" : "cursor-default",
        )}
        onPointerDown={onPointerDown}
      >
        <AnnotationLayer
          annotations={annotations}
          pageNumber={pageNumber}
          contentWidth={contentSize.width}
          contentHeight={contentSize.height}
          annotateMode={annotateMode}
          canEdit={canEdit}
          onSelect={onSelect}
          selectedId={selectedId}
          draftRect={draftRect}
        />
      </div>
    </div>
  )
}

function PdfStage({
  streamUrl,
  pageNumber,
  onPageCount,
  zoom = 1,
  annotations,
  annotateMode,
  canEdit,
  onSelect,
  selectedId,
  onDrawComplete,
  onCanvasReady,
}) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [contentSize, setContentSize] = useState({ width: 0, height: 0 })
  const [containerWidth, setContainerWidth] = useState(0)
  const [pdfVersion, setPdfVersion] = useState(0)
  const pdfRef = useRef(null)
  const paintTokenRef = useRef(0)

  useEffect(() => {
    const el = wrapRef.current?.parentElement
    if (!el) return

    const updateWidth = () => {
      const width = el.clientWidth
      if (width > 0) setContainerWidth(width)
    }

    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    pdfRef.current = null
    setLoading(true)
    setError(null)

    async function loadPdf() {
      try {
        const pdfjs = await import("pdfjs-dist")
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
        }
        const task = pdfjs.getDocument(streamUrl)
        const pdf = await task.promise
        if (cancelled) return
        pdfRef.current = pdf
        onPageCount(pdf.numPages)
        setPdfVersion((value) => value + 1)
      } catch (err) {
        if (!cancelled) setError(err?.message || "Could not render PDF.")
        if (!cancelled) setLoading(false)
      }
    }

    void loadPdf()
    return () => {
      cancelled = true
    }
  }, [streamUrl, onPageCount])

  useEffect(() => {
    const pdf = pdfRef.current
    const canvas = canvasRef.current
    if (!pdf || !canvas || !containerWidth) return

    const token = ++paintTokenRef.current
    let cancelled = false
    setLoading(true)

    pdf
      .getPage(pageNumber)
      .then(async (page) => {
        if (cancelled || token !== paintTokenRef.current) return
        const width = getPdfContainerWidth(wrapRef.current)
        const size = await renderPdfPageToCanvas(page, canvas, { containerWidth: width, zoom })
        if (cancelled || token !== paintTokenRef.current) return
        setContentSize(size)
        setError(null)
      })
      .catch((err) => {
        if (cancelled || token !== paintTokenRef.current) return
        setError(err?.message || "Could not render page.")
      })
      .finally(() => {
        if (!cancelled && token === paintTokenRef.current) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [pageNumber, zoom, containerWidth, pdfVersion])

  useEffect(() => {
    if (canvasRef.current && onCanvasReady) onCanvasReady(canvasRef.current)
  }, [contentSize, onCanvasReady])

  const { draftRect, onPointerDown } = useDragRect(
    annotateMode && canEdit,
    contentSize.width,
    contentSize.height,
    onDrawComplete,
  )

  if (error) return <p className="px-4 text-center text-sm text-rose-700">{error}</p>

  const hasContent = contentSize.width > 0 && contentSize.height > 0

  return (
    <div ref={wrapRef} className="relative inline-block max-w-full">
      {loading && !hasContent ? (
        <div className="flex h-48 w-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      ) : null}
      <canvas ref={canvasRef} className="block bg-white shadow-sm" />
      {hasContent ? (
        <div
          className={cn("absolute inset-0", annotateMode && canEdit ? "cursor-crosshair" : "cursor-default")}
          style={{ width: contentSize.width, height: contentSize.height }}
          onPointerDown={onPointerDown}
        >
          <AnnotationLayer
            annotations={annotations}
            pageNumber={pageNumber}
            contentWidth={contentSize.width}
            contentHeight={contentSize.height}
            annotateMode={annotateMode}
            canEdit={canEdit}
            onSelect={onSelect}
            selectedId={selectedId}
            draftRect={draftRect}
          />
        </div>
      ) : null}
    </div>
  )
}

export default function RsdvDocumentAnnotator({
  attachment,
  streamUrl,
  previewKind,
  fileName,
  attachmentId,
  context,
  canEdit = false,
  canCreateQuery = false,
  linkedField = null,
  crfRecords = [],
  focusAnnotationId = null,
  onContextUpdated,
  onJumpToField,
  resolveFieldLabel,
}) {
  const { toast } = useToast()
  const [annotateMode, setAnnotateMode] = useState(false)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageCount, setPageCount] = useState(1)
  const [pdfZoom, setPdfZoom] = useState(1)
  const [selected, setSelected] = useState(null)
  const [pendingRegion, setPendingRegion] = useState(null)
  const [draftComment, setDraftComment] = useState("")
  const [saving, setSaving] = useState(false)
  const [raisingQuery, setRaisingQuery] = useState(false)
  const [aiMatchSuggestion, setAiMatchSuggestion] = useState(null)
  const [aiMatchLoading, setAiMatchLoading] = useState(false)
  const sourceElementRef = useRef(null)

  const handleCanvasReady = useCallback((element) => {
    sourceElementRef.current = element
  }, [])

  const { isAiRsdvVerifyEnabled } = useStudyAiSettingsForStudy(attachment?.studyId ?? context?.studyId)

  const isCompleted = String(context?.reviewStatus ?? "").toLowerCase() === "completed"
  const canAnnotate = canEdit && !isCompleted && (previewKind === "image" || previewKind === "pdf")
  const canRaiseQuery = canCreateQuery && canAnnotate
  const annotations = context?.documentAnnotations ?? []

  const openCount = useMemo(
    () => annotations.filter((item) => !item.isOrphaned && String(item.status).toLowerCase() !== "resolved").length,
    [annotations],
  )

  useEffect(() => {
    setPageNumber(1)
    setPdfZoom(1)
    setSelected(null)
    setPendingRegion(null)
    setDraftComment("")
    setAnnotateMode(false)
    setAiMatchSuggestion(null)
    setAiMatchLoading(false)
  }, [attachmentId, streamUrl])

  useEffect(() => {
    if (!focusAnnotationId) return
    const match = annotations.find((item) => String(item.id) === String(focusAnnotationId))
    if (!match) return
    setPageNumber(match.pageNumber ?? 1)
    setSelected(match)
    setDraftComment(match.commentText ?? "")
    setPendingRegion(null)
    setAnnotateMode(false)
  }, [focusAnnotationId, annotations])

  const ensureSession = useCallback(async () => {
    if (context?.reviewSessionId) return context
    if (!canEdit || !attachmentId) return null
    const res = await rsdvReviewService.startReview(attachmentId)
    if (res?.isSuccess && res.data) {
      onContextUpdated?.(res.data)
      return res.data
    }
    toast({
      title: "Could not start review",
      description: res?.message || "Start the review session before annotating.",
      variant: "destructive",
    })
    return null
  }, [attachmentId, canEdit, context, onContextUpdated, toast])

  const refreshContext = useCallback(async () => {
    if (!attachmentId) return
    const res = await rsdvReviewService.getContext(attachmentId)
    if (res?.isSuccess) onContextUpdated?.(res.data)
  }, [attachmentId, onContextUpdated])

  const handleDrawComplete = useCallback(
    async (normalized, pixelRect) => {
      setPendingRegion({ ...normalized, pixelRect })
      setSelected(null)
      setDraftComment("")
      setAiMatchSuggestion(null)

      if (!isAiRsdvVerifyEnabled || !attachmentId) return

      const studyId = attachment?.studyId ?? context?.attachment?.studyId ?? null
      if (!studyId) return

      setAiMatchLoading(true)
      try {
        const crfDataId = linkedField?.crfDataId ?? crfRecords?.[0]?.crfDataId ?? null
        const crfRecord =
          crfRecords.find((item) => item.crfDataId === crfDataId) ?? crfRecords?.[0] ?? null

        let extractedText = ""
        if (sourceElementRef.current && pixelRect) {
          const imageBase64 = cropElementRegionToBase64(sourceElementRef.current, pixelRect)
          if (imageBase64) {
            const scanRes = await rsdvReviewService.batchPageScan({
              studyId,
              attachmentId,
              pageNumber,
              imageBase64,
              regions: [
                {
                  xPct: normalized.xPct,
                  yPct: normalized.yPct,
                  widthPct: normalized.widthPct,
                  heightPct: normalized.heightPct,
                },
              ],
            })
            extractedText =
              scanRes?.data?.extractedText ??
              scanRes?.data?.ExtractedText ??
              scanRes?.data?.regions?.[0]?.extractedText ??
              ""
          }
        }

        const fieldRows = crfRecord
          ? await fetchRsdvFieldRows({
              studyId,
              crfDataId: crfRecord.crfDataId,
              crfDesignId: crfRecord.crfDesignId,
            })
          : []

        const res = await rsdvReviewService.suggestSourceMatch({
          studyId,
          attachmentId,
          reviewSessionId: context?.reviewSessionId ?? null,
          crfDataId,
          extractedText,
          fieldRows,
        })
        if (res?.isSuccess && res.data) setAiMatchSuggestion(res.data)
      } finally {
        setAiMatchLoading(false)
      }
    },
    [
      attachment?.studyId,
      attachmentId,
      context?.attachment?.studyId,
      context?.reviewSessionId,
      crfRecords,
      isAiRsdvVerifyEnabled,
      linkedField?.crfDataId,
      pageNumber,
    ],
  )

  const handleSelect = useCallback((item) => {
    setPendingRegion(null)
    setSelected(item)
    setDraftComment(item.commentText ?? "")
    if (item.fieldId && onJumpToField) {
      onJumpToField({
        crfDataId: item.crfDataId,
        fieldId: item.fieldId,
        fieldLabel: resolveFieldLabel
          ? resolveFieldLabel({
              crfDataId: item.crfDataId,
              fieldId: item.fieldId,
              fieldLabel: item.fieldLabel,
            })
          : item.fieldLabel || item.fieldId,
      })
    }
  }, [onJumpToField, resolveFieldLabel])

  const handleSaveNew = async () => {
    if (!pendingRegion || !draftComment.trim()) {
      toast({ title: "Comment required", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const active = await ensureSession()
      const sessionId = active?.reviewSessionId ?? context?.reviewSessionId
      if (!sessionId) return
      const payload = {
        reviewSessionId: sessionId,
        pageNumber,
        xPct: pendingRegion.xPct,
        yPct: pendingRegion.yPct,
        widthPct: pendingRegion.widthPct,
        heightPct: pendingRegion.heightPct,
        commentText: draftComment.trim(),
      }
      const crfDataId =
        linkedField?.crfDataId ??
        aiMatchSuggestion?.suggestedCrfDataId ??
        aiMatchSuggestion?.crfDataId ??
        null
      const fieldId = linkedField?.fieldId ?? aiMatchSuggestion?.suggestedFieldId ?? null
      const fieldLabel =
        linkedField?.fieldLabel ??
        aiMatchSuggestion?.suggestedFieldLabel ??
        (fieldId && resolveFieldLabel
          ? resolveFieldLabel({ crfDataId, fieldId, fieldLabel: aiMatchSuggestion?.suggestedFieldLabel })
          : fieldId)
      if (crfDataId) payload.crfDataId = crfDataId
      if (fieldId) payload.fieldId = fieldId
      if (fieldLabel) payload.fieldLabel = fieldLabel
      if (aiMatchSuggestion?.extractedText) payload.extractedSourceText = aiMatchSuggestion.extractedText
      if (aiMatchSuggestion?.confidence != null) payload.matchConfidence = aiMatchSuggestion.confidence
      if (aiMatchSuggestion?.matchStatus) payload.matchStatus = aiMatchSuggestion.matchStatus
      if (aiMatchSuggestion?.suggestionLogId) payload.aiSuggestionLogId = aiMatchSuggestion.suggestionLogId
      else if (aiMatchSuggestion?.SuggestionLogId) payload.aiSuggestionLogId = aiMatchSuggestion.SuggestionLogId

      const res = await rsdvReviewService.saveDocumentAnnotation(payload)
      if (res?.isSuccess) {
        toast({ title: "Document note saved", variant: "success" })
        setPendingRegion(null)
        setDraftComment("")
        setAiMatchSuggestion(null)
        await refreshContext()
      } else {
        toast({ title: "Save failed", description: res?.message, variant: "destructive" })
      }
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateComment = async () => {
    if (!selected?.id) return
    setSaving(true)
    try {
      const res = await rsdvReviewService.updateDocumentAnnotation({
        id: selected.id,
        commentText: draftComment.trim(),
      })
      if (res?.isSuccess) {
        toast({ title: "Note updated", variant: "success" })
        setSelected(res.data)
        await refreshContext()
      } else {
        toast({ title: "Update failed", description: res?.message, variant: "destructive" })
      }
    } finally {
      setSaving(false)
    }
  }

  const handleResolve = async (status) => {
    if (!selected?.id) return
    setSaving(true)
    try {
      const res = await rsdvReviewService.updateDocumentAnnotation({ id: selected.id, status })
      if (res?.isSuccess) {
        toast({ title: status === "resolved" ? "Note resolved" : "Note reopened", variant: "success" })
        setSelected(res.data)
        await refreshContext()
      } else {
        toast({ title: "Update failed", description: res?.message, variant: "destructive" })
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selected?.id) return
    setSaving(true)
    try {
      const res = await rsdvReviewService.deleteDocumentAnnotation(selected.id)
      if (res?.isSuccess) {
        toast({ title: "Note deleted", variant: "success" })
        setSelected(null)
        setDraftComment("")
        await refreshContext()
      } else {
        toast({ title: "Delete failed", description: res?.message, variant: "destructive" })
      }
    } finally {
      setSaving(false)
    }
  }

  const resolveQueryTarget = useCallback(() => {
    const crfDataId = selected?.crfDataId ?? linkedField?.crfDataId ?? null
    const fieldId = String(selected?.fieldId ?? linkedField?.fieldId ?? "").trim()
    const fieldLabel = String(selected?.fieldLabel ?? linkedField?.fieldLabel ?? fieldId).trim()
    const crf = crfRecords.find((item) => item.crfDataId === crfDataId) ?? null
    return { crfDataId, fieldId, fieldLabel, crf }
  }, [selected, linkedField, crfRecords])

  const handleRaiseQueryFromRegion = async () => {
    if (!canRaiseQuery || !attachment) return
    const { crfDataId, fieldId, fieldLabel, crf } = resolveQueryTarget()
    if (!crfDataId || !crf?.crfDesignId) {
      toast({
        title: "Select a CRF field",
        description: "Link a CRF and field on the eCRF panel before raising a query from this region.",
        variant: "destructive",
      })
      return
    }
    if (!fieldId) {
      toast({ title: "Field required", description: "Select an eCRF field to attach the query.", variant: "destructive" })
      return
    }
    if (!draftComment.trim()) {
      toast({ title: "Query text required", variant: "destructive" })
      return
    }

    setRaisingQuery(true)
    try {
      const active = await ensureSession()
      const sessionId = active?.reviewSessionId ?? context?.reviewSessionId
      if (!sessionId) return

      const res = await crfQueryManagementService.createManualGeneratedQuery({
        studyId: attachment.studyId,
        siteId: attachment.siteId,
        patientEnrolmentId: attachment.patientEnrolmentId,
        visitScheduleId: attachment.visitScheduleId,
        crfDesignId: crf.crfDesignId,
        crfDataId,
        fieldId,
        fieldLabel: fieldLabel || fieldId,
        queryText: draftComment.trim(),
        queryApproverComment: `Raised from RSDV document region (page ${pageNumber}).`,
      })

      if (!res?.isSuccess) {
        toast({
          title: "Query not created",
          description: res?.message || "Could not open query.",
          variant: "destructive",
        })
        return
      }

      const queryId = pickQueryIdFromResponse(res)
      if (!queryId) {
        toast({ title: "Query created", description: "Could not link query to document note.", variant: "destructive" })
        return
      }

      if (pendingRegion) {
        const saveRes = await rsdvReviewService.saveDocumentAnnotation({
          reviewSessionId: sessionId,
          pageNumber,
          xPct: pendingRegion.xPct,
          yPct: pendingRegion.yPct,
          widthPct: pendingRegion.widthPct,
          heightPct: pendingRegion.heightPct,
          commentText: draftComment.trim(),
          crfDataId,
          fieldId,
          queryId,
        })
        if (saveRes?.isSuccess) {
          toast({ title: "Query opened and linked to region", variant: "success" })
          setPendingRegion(null)
          setDraftComment("")
          setSelected(saveRes.data)
          await refreshContext()
        } else {
          toast({
            title: "Query opened",
            description: saveRes?.message || "Region note could not be saved with query link.",
            variant: "destructive",
          })
        }
        return
      }

      if (selected?.id) {
        const updateRes = await rsdvReviewService.updateDocumentAnnotation({
          id: selected.id,
          commentText: draftComment.trim(),
          crfDataId,
          fieldId,
          queryId,
        })
        if (updateRes?.isSuccess) {
          toast({ title: "Query opened and linked to region", variant: "success" })
          setSelected(updateRes.data)
          await refreshContext()
        } else {
          toast({
            title: "Query opened",
            description: updateRes?.message || "Could not link query to document note.",
            variant: "destructive",
          })
        }
      }
    } finally {
      setRaisingQuery(false)
    }
  }

  if (!streamUrl) return null

  if (previewKind !== "image" && previewKind !== "pdf") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center text-sm text-slate-600">
        <MessageSquare className="h-8 w-8 text-slate-400" />
        <p>On-page annotations are available for PDF and image documents only.</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-100 bg-white/90 px-3 py-2">
        <Button
          type="button"
          size="sm"
          variant={annotateMode ? "default" : "outline"}
          className={annotateMode ? RSDV_BTN_PRIMARY : RSDV_BTN_OUTLINE}
          disabled={!canAnnotate}
          onClick={() => setAnnotateMode((value) => !value)}
        >
          {annotateMode ? <SquarePen className="mr-1.5 h-3.5 w-3.5" /> : <MousePointer2 className="mr-1.5 h-3.5 w-3.5" />}
          {annotateMode ? "Draw region" : "Select"}
        </Button>
        {previewKind === "pdf" ? (
          <>
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1 py-0.5 text-xs">
              <button
                type="button"
                className="rounded p-1 hover:bg-white disabled:opacity-40"
                disabled={pageNumber <= 1}
                onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[4.5rem] text-center font-medium text-slate-700">
                Page {pageNumber} / {pageCount}
              </span>
              <button
                type="button"
                className="rounded p-1 hover:bg-white disabled:opacity-40"
                disabled={pageNumber >= pageCount}
                onClick={() => setPageNumber((p) => Math.min(pageCount, p + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1 py-0.5 text-xs">
              <button
                type="button"
                className="rounded px-1.5 py-1 font-semibold hover:bg-white disabled:opacity-40"
                disabled={pdfZoom <= 0.75}
                onClick={() => setPdfZoom((value) => Math.max(0.75, Math.round((value - 0.25) * 100) / 100))}
                title="Zoom out"
              >
                −
              </button>
              <button
                type="button"
                className="min-w-[3rem] rounded px-1.5 py-1 font-medium text-slate-700 hover:bg-white"
                onClick={() => setPdfZoom(1)}
                title="Fit to width"
              >
                {Math.round(pdfZoom * 100)}%
              </button>
              <button
                type="button"
                className="rounded px-1.5 py-1 font-semibold hover:bg-white disabled:opacity-40"
                disabled={pdfZoom >= 3}
                onClick={() => setPdfZoom((value) => Math.min(3, Math.round((value + 0.25) * 100) / 100))}
                title="Zoom in"
              >
                +
              </button>
            </div>
          </>
        ) : null}
        <span className="ml-auto text-[11px] font-medium text-slate-500">
          {openCount} open · {annotations.length} total
        </span>
        {isCompleted ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
            Locked
          </span>
        ) : null}
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-2">
        {previewKind === "image" ? (
          <ImageStage
            streamUrl={streamUrl}
            alt={fileName}
            pageNumber={1}
            annotations={annotations}
            annotateMode={annotateMode}
            canEdit={canAnnotate}
            onSelect={handleSelect}
            selectedId={selected?.id}
            onDrawComplete={handleDrawComplete}
            onCanvasReady={handleCanvasReady}
          />
        ) : (
          <PdfStage
            streamUrl={streamUrl}
            pageNumber={pageNumber}
            onPageCount={setPageCount}
            zoom={pdfZoom}
            annotations={annotations}
            annotateMode={annotateMode}
            canEdit={canAnnotate}
            onSelect={handleSelect}
            selectedId={selected?.id}
            onDrawComplete={handleDrawComplete}
            onCanvasReady={handleCanvasReady}
          />
        )}

      </div>

      {pendingRegion && isAiRsdvVerifyEnabled ? (
        <div className="shrink-0 border-t border-slate-100 px-3 py-2">
          <AiSuggestionBanner
            title="Verify AI — source match"
            loading={aiMatchLoading}
            confidence={aiMatchSuggestion?.confidence}
            matchStatus={aiMatchSuggestion?.matchStatus}
            rationale={aiMatchSuggestion?.rationale}
            extractedText={aiMatchSuggestion?.extractedText}
            suggestedLabel={aiMatchSuggestion?.suggestedFieldLabel}
            suggestedValue={aiMatchSuggestion?.ecrfValue}
            onAccept={() => {
              if (aiMatchSuggestion?.suggestedFieldId && onJumpToField) {
                onJumpToField({
                  crfDataId:
                    aiMatchSuggestion.suggestedCrfDataId ??
                    aiMatchSuggestion.crfDataId ??
                    linkedField?.crfDataId,
                  fieldId: aiMatchSuggestion.suggestedFieldId,
                  fieldLabel: aiMatchSuggestion.suggestedFieldLabel,
                })
              }
              if (aiMatchSuggestion?.rationale && !draftComment.trim()) {
                setDraftComment(String(aiMatchSuggestion.rationale))
              }
            }}
            onReject={() => setAiMatchSuggestion(null)}
            acceptLabel="Use suggestion"
          />
        </div>
      ) : null}

      <AnnotationEditorPanel
        open={Boolean(pendingRegion || selected)}
        draftComment={draftComment}
        onDraftChange={setDraftComment}
        onSave={pendingRegion ? handleSaveNew : handleUpdateComment}
        onCancel={() => {
          setPendingRegion(null)
          setSelected(null)
          setDraftComment("")
        }}
        onResolve={() => handleResolve("resolved")}
        onReopen={() => handleResolve("open")}
        onDelete={handleDelete}
        saving={saving}
        canEdit={canAnnotate}
        canRaiseQuery={canRaiseQuery}
        raisingQuery={raisingQuery}
        onRaiseQuery={() => void handleRaiseQueryFromRegion()}
        linkedQueryId={selected?.queryId ?? null}
        status={selected?.status ?? "open"}
        isOrphaned={Boolean(selected?.isOrphaned)}
        isNew={Boolean(pendingRegion)}
      />

      {annotateMode && canAnnotate && !pendingRegion && !selected ? (
        <p className="shrink-0 border-t border-slate-100 bg-amber-50/80 px-3 py-1.5 text-center text-[11px] text-amber-900">
          Click and drag on the document to highlight a region, then add your comment.
        </p>
      ) : null}
    </div>
  )
}
