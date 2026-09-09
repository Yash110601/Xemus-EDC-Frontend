"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import RsdvDocumentAnnotator from "@/components/rsdv/RsdvDocumentAnnotator"
import RsdvEcrfComparisonPanel from "@/components/rsdv/RsdvEcrfComparisonPanel"
import RsdvPatientContextMeta from "@/components/rsdv/RsdvPatientContextMeta"
import StudyAssistantPanel from "@/components/intelligence/StudyAssistantPanel"
import { useRsdvFieldLabelLookup } from "@/lib/rsdv/useRsdvFieldLabelLookup"
import { useStudyAiSettingsForStudy } from "@/lib/intelligence/useStudyAiSettings"
import { rsdvReviewService } from "@/lib/services"
import { cn } from "@/lib/utils"
import { ClipboardList, FileText, Loader2 } from "lucide-react"

export default function SplitReviewWorkspace({
  context,
  canEdit = false,
  allowReopen = false,
  canCreateQuery = false,
  canCloseQuery = false,
  onContextUpdated,
  onCompleted,
  className,
  layout = "default",
  showPatientMeta = true,
}) {
  const isFullscreen = layout === "fullscreen"
  const attachment = context?.attachment
  const displayPatientMeta = showPatientMeta && !isFullscreen
  const [mobilePane, setMobilePane] = useState("document")
  const [streamUrl, setStreamUrl] = useState(null)
  const [streamLoading, setStreamLoading] = useState(false)
  const [streamError, setStreamError] = useState(null)
  const [selectedCrfId, setSelectedCrfId] = useState(null)
  const [selectedFieldId, setSelectedFieldId] = useState("")
  const [selectedFieldLabel, setSelectedFieldLabel] = useState("")
  const [focusDocumentAnnotationId, setFocusDocumentAnnotationId] = useState(null)

  const crfRecords = context?.crfRecords ?? []
  const { resolveLabel } = useRsdvFieldLabelLookup(attachment?.studyId, crfRecords)
  const { isAiInsightEnabled } = useStudyAiSettingsForStudy(attachment?.studyId)

  useEffect(() => {
    setSelectedCrfId((current) => {
      if (current && crfRecords.some((crf) => crf.crfDataId === current)) return current
      return crfRecords[0]?.crfDataId ?? null
    })
  }, [attachment?.attachmentId, crfRecords])

  useEffect(() => {
    setSelectedFieldId("")
    setSelectedFieldLabel("")
    setFocusDocumentAnnotationId(null)
  }, [attachment?.attachmentId])

  const handleFieldSelect = useCallback((fieldId, fieldLabel) => {
    setSelectedFieldId(fieldId ?? "")
    setSelectedFieldLabel(fieldLabel ?? "")
  }, [])

  const handleJumpToField = useCallback(({ crfDataId, fieldId, fieldLabel }) => {
    if (crfDataId) setSelectedCrfId(crfDataId)
    if (fieldId) {
      setSelectedFieldId(fieldId)
      setSelectedFieldLabel(fieldLabel ?? fieldId)
    }
    setMobilePane("ecrf")
  }, [])

  const linkedField = useMemo(
    () => ({
      crfDataId: selectedCrfId,
      fieldId: selectedFieldId.trim() || null,
      fieldLabel: selectedFieldLabel.trim() || null,
    }),
    [selectedCrfId, selectedFieldId, selectedFieldLabel],
  )

  useEffect(() => {
    let revoked = false
    let objectUrl = null

    const load = async () => {
      const aid = attachment?.attachmentId
      if (!aid) return
      setStreamLoading(true)
      setStreamError(null)
      try {
        objectUrl = await rsdvReviewService.fetchStreamBlobUrl(aid)
        if (!revoked) setStreamUrl(objectUrl)
      } catch (error) {
        if (!revoked) setStreamError(error?.message || "Could not load document preview.")
      } finally {
        if (!revoked) setStreamLoading(false)
      }
    }

    void load()

    return () => {
      revoked = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setStreamUrl(null)
    }
  }, [attachment?.attachmentId])

  useEffect(() => {
    setMobilePane("document")
  }, [attachment?.attachmentId])

  const previewKind = useMemo(() => {
    const type = String(attachment?.contentType ?? "").toLowerCase()
    const name = String(attachment?.originalFileName ?? "").toLowerCase()
    if (type.includes("pdf") || name.endsWith(".pdf")) return "pdf"
    if (type.startsWith("image/")) return "image"
    if (type.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".csv")) return "text"
    if (type.includes("zip") || name.endsWith(".zip")) return "zip"
    if (type.includes("dicom") || name.endsWith(".dcm")) return "dicom"
    return "other"
  }, [attachment?.contentType, attachment?.originalFileName])

  if (!attachment) {
    return (
      <div
        className={cn(
          "flex flex-1 items-center justify-center text-sm text-slate-500",
          isFullscreen ? "bg-white" : "rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-8",
          className,
        )}
      >
        Select a queue item to open the split review workspace.
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col",
        isFullscreen ? "xl:flex-row xl:divide-x xl:divide-slate-200" : "gap-3 lg:flex-row",
        className,
      )}
    >
      {isFullscreen ? (
        <div className="flex shrink-0 border-b border-slate-200 bg-white xl:hidden">
          <button
            type="button"
            onClick={() => setMobilePane("document")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 border-b-2 px-3 py-2.5 text-xs font-semibold transition",
              mobilePane === "document"
                ? "border-emerald-600 text-emerald-800"
                : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            <FileText className="h-4 w-4" />
            Source document
          </button>
          <button
            type="button"
            onClick={() => setMobilePane("ecrf")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 border-b-2 px-3 py-2.5 text-xs font-semibold transition",
              mobilePane === "ecrf"
                ? "border-emerald-600 text-emerald-800"
                : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            <ClipboardList className="h-4 w-4" />
            eCRF compare
          </button>
        </div>
      ) : null}

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden bg-white",
          !isFullscreen && "min-h-[280px] rounded-2xl border border-slate-200/70 shadow-sm lg:max-w-[50%]",
          isFullscreen && mobilePane !== "document" && "hidden xl:flex",
          isFullscreen && "min-h-[42dvh] xl:min-h-0",
        )}
      >
        <div className="flex shrink-0 flex-col gap-2 border-b border-teal-100/80 bg-gradient-to-r from-teal-50/40 to-white px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{attachment.originalFileName}</p>
            <p className="text-[11px] font-medium text-teal-700">Source document</p>
          </div>
          {linkedField.fieldId ? (
            <p className="text-[11px] font-medium text-sky-700">
              Linking notes to field: {resolveLabel(linkedField)}
            </p>
          ) : null}
          {displayPatientMeta ? <RsdvPatientContextMeta row={attachment} variant="chips" /> : null}
        </div>
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-950/[0.03]">
          {streamLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" aria-label="Loading document" />
            </div>
          ) : streamError ? (
            <p className="flex flex-1 items-center justify-center px-4 text-center text-sm text-rose-700">{streamError}</p>
          ) : streamUrl && (previewKind === "image" || previewKind === "pdf") ? (
            <RsdvDocumentAnnotator
              attachment={attachment}
              streamUrl={streamUrl}
              previewKind={previewKind}
              fileName={attachment.originalFileName}
              attachmentId={attachment.attachmentId}
              context={context}
              canEdit={canEdit}
              canCreateQuery={canCreateQuery}
              linkedField={linkedField}
              crfRecords={crfRecords}
              focusAnnotationId={focusDocumentAnnotationId}
              onContextUpdated={onContextUpdated}
              onJumpToField={handleJumpToField}
              resolveFieldLabel={resolveLabel}
            />
          ) : streamUrl && previewKind === "text" ? (
            <iframe title="Source document" src={streamUrl} className="h-full min-h-0 w-full border-0 bg-white" />
          ) : streamUrl ? (
            <div className="flex flex-1 flex-col items-center justify-center space-y-2 px-4 text-center text-sm text-slate-600">
              <FileText className="h-10 w-10 text-slate-400" />
              <p>
                {previewKind === "zip"
                  ? "ZIP archives cannot be previewed inline."
                  : previewKind === "dicom"
                    ? "DICOM imaging files cannot be previewed inline."
                    : "Preview is not available for this file type."}
              </p>
              <a href={streamUrl} download={attachment.originalFileName} className="text-emerald-700 underline">
                Download to view
              </a>
            </div>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden bg-white",
          !isFullscreen && "min-h-[280px] rounded-2xl border border-slate-200/70 shadow-sm",
          isFullscreen && mobilePane !== "ecrf" && "hidden xl:flex",
          isFullscreen && "min-h-[42dvh] xl:min-h-0",
        )}
      >
        <RsdvEcrfComparisonPanel
          attachment={attachment}
          context={context}
          canEdit={canEdit}
          allowReopen={allowReopen}
          canCreateQuery={canCreateQuery}
          canCloseQuery={canCloseQuery}
          showPatientMeta={displayPatientMeta}
          selectedCrfId={selectedCrfId}
          onSelectedCrfIdChange={setSelectedCrfId}
          fieldId={selectedFieldId}
          fieldLabel={selectedFieldLabel}
          onFieldSelect={handleFieldSelect}
          onFocusDocumentAnnotation={setFocusDocumentAnnotationId}
          onContextUpdated={onContextUpdated}
          onCompleted={onCompleted}
          resolveFieldLabel={resolveLabel}
        />
      </div>

      <StudyAssistantPanel
        studyId={attachment?.studyId}
        patientEnrolmentId={attachment?.patientEnrolmentId}
        visitScheduleId={attachment?.visitScheduleId}
        crfDataId={selectedCrfId}
        enabled={isAiInsightEnabled}
      />
    </div>
  )
}
