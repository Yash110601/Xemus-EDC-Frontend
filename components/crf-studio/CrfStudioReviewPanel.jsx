"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import CRFViewer from "@/components/crf-designer/CRFViewer"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { REPORT_CARD_CLASS, REPORT_PRIMARY_BTN_CLASS } from "@/lib/reports/studySitePatientReportUi"
import crfStudioService from "@/lib/services/crfStudio.service"
import { bundleEntryToPreviewCrfData, parseCoverageReport } from "@/lib/utils/crfStudioPreview"
import { AlertTriangle, Download, Eye, FileText, Import, Loader2, Plus, Save, X } from "lucide-react"
import { toast } from "sonner"

function slugId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function normalizeFieldsWithSectionId(fields = [], sections = []) {
  const list = Array.isArray(fields) ? fields : []
  const sectionIds = new Set(
    (Array.isArray(sections) ? sections : [])
      .map((s) => String(s?.id || ""))
      .filter(Boolean),
  )
  return list.map((f, idx) => {
    const id = f?.id != null ? String(f.id) : `field_${idx}`
    const fromField = f?.sectionId != null ? String(f.sectionId) : null
    const fromSection =
      Array.isArray(sections) && sections.length
        ? sections.find((s) =>
            Array.isArray(s?.fields) ? s.fields.some((sf) => String(sf?.id) === id) : false,
          )
        : null
    const sectionId = fromField && sectionIds.has(fromField) ? fromField : fromSection?.id ?? ""
    return { ...f, id, sectionId: sectionId ? String(sectionId) : "" }
  })
}

function buildSectionsPayload({ sections, fields }) {
  const safeSections = (Array.isArray(sections) ? sections : [])
    .map((s, idx) => ({
      id: s?.id ? String(s.id) : `section_${idx}`,
      name: String(s?.name || s?.title || `Section ${idx + 1}`),
    }))
    .filter((s) => s.id && s.name)

  const bySectionId = Object.fromEntries(safeSections.map((s) => [String(s.id), []]))
  const unmapped = []
  for (const f of Array.isArray(fields) ? fields : []) {
    const sid = String(f?.sectionId || "")
    if (sid && bySectionId[sid]) bySectionId[sid].push({ ...f, sectionId: sid })
    else unmapped.push({ ...f, sectionId: "" })
  }

  return {
    sections: safeSections.map((s) => ({
      id: s.id,
      name: s.name,
      fields: bySectionId[s.id] || [],
    })),
    unmappedCount: unmapped.length,
  }
}

function DraftTreeList({ draftTree, selectedFormId, onSelectForm }) {
  const visits = Array.isArray(draftTree?.visits) ? draftTree.visits : []
  const forms = Array.isArray(draftTree?.forms) ? draftTree.forms : []
  const visitNameById = useMemo(
    () => Object.fromEntries(visits.map((v) => [String(v.id), v.name])),
    [visits],
  )

  if (!forms.length) {
    return <p className="text-sm text-slate-500">No forms in draft yet.</p>
  }

  return (
    <ul className="space-y-2">
      {forms.map((form) => {
        const fields = form.fields || form.controls || []
        const isSelected = String(selectedFormId) === String(form.id)
        return (
          <li key={String(form.id)}>
            <button
              type="button"
              onClick={() => onSelectForm(form.id)}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                isSelected ? "border-emerald-500 bg-emerald-50/80" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <span className="font-semibold text-slate-900">{form.name || "Untitled form"}</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Visit: {visitNameById[form.visitId] || form.visitName || "—"} · {fields.length} field(s)
                {form.sourcePage != null ? ` · p.${form.sourcePage}` : ""}
              </span>
            </button>
            {isSelected && fields.length > 0 ? (
              <ul className="mt-2 space-y-1 border-l-2 border-emerald-200 pl-3">
                {fields.map((field) => (
                  <li key={String(field.id || field.label)} className="text-xs text-slate-600">
                    <span className="font-medium text-slate-800">{field.label || field.name}</span>
                    {field.type ? ` · ${field.type}` : ""}
                    {field.required ? " · required" : ""}
                    {field.sourcePage != null ? ` · p.${field.sourcePage}` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

export default function CrfStudioReviewPanel({
  studyId,
  project,
  draftTree,
  exportBundles,
  coverageReportJson,
  onRefresh,
  onCoverageAcknowledged,
  onDownloadBundle,
  onImportForm,
  onImportAll,
  importingFormId,
  importingAll,
}) {
  const [pdfUrl, setPdfUrl] = useState(null)
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [selectedFormId, setSelectedFormId] = useState(exportBundles[0]?.formId ?? null)
  const [previewEntry, setPreviewEntry] = useState(null)
  const [coverageAck, setCoverageAck] = useState(false)
  const [builderOpen, setBuilderOpen] = useState(false)
  const [builderSaving, setBuilderSaving] = useState(false)
  const [builderSections, setBuilderSections] = useState([])
  const [builderFields, setBuilderFields] = useState([])

  const coverage = useMemo(() => parseCoverageReport(coverageReportJson), [coverageReportJson])
  const hasUnmapped = coverage.unmappedAssessments.length > 0
  const importBlocked = hasUnmapped && !coverageAck

  const selectedEntry = useMemo(
    () => exportBundles.find((e) => String(e.formId) === String(selectedFormId)) ?? exportBundles[0] ?? null,
    [exportBundles, selectedFormId],
  )

  const selectedForm = useMemo(() => {
    const forms = Array.isArray(draftTree?.forms) ? draftTree.forms : []
    return forms.find((f) => String(f.id) === String(selectedFormId)) ?? forms[0] ?? null
  }, [draftTree?.forms, selectedFormId])

  const previewCrfData = useMemo(
    () => (previewEntry ? bundleEntryToPreviewCrfData(previewEntry) : null),
    [previewEntry],
  )

  const loadPdf = useCallback(async () => {
    if (!project?.id || !studyId || !project.protocolChecksumSha256) return
    setLoadingPdf(true)
    try {
      const res = await crfStudioService.downloadProtocol(project.id, studyId)
      if (res?.isSuccess && res.blobUrl) {
        setPdfUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return res.blobUrl
        })
      } else {
        toast.error(res?.message || "Could not load protocol PDF")
      }
    } finally {
      setLoadingPdf(false)
    }
  }, [project?.id, project?.protocolChecksumSha256, studyId])

  useEffect(() => {
    void loadPdf()
    return () => {
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
    }
  }, [loadPdf])

  useEffect(() => {
    setCoverageAck(coverage.acknowledged)
  }, [coverage.acknowledged, project?.id])

  const handleCoverageChange = (checked) => {
    setCoverageAck(checked)
    onCoverageAcknowledged?.(checked)
  }

  useEffect(() => {
    if (!builderOpen) return
    const form = selectedForm
    const existingSections = Array.isArray(form?.sections) ? form.sections : []
    const existingFields =
      Array.isArray(form?.fields) ? form.fields : Array.isArray(form?.controls) ? form.controls : []

    const normalizedSections = existingSections.length
      ? existingSections.map((s, idx) => ({
          id: s?.id ? String(s.id) : `section_${idx}`,
          name: String(s?.name || s?.title || `Section ${idx + 1}`),
        }))
      : [{ id: "section_main", name: String(form?.name || "Main") }]

    setBuilderSections(normalizedSections)
    setBuilderFields(normalizeFieldsWithSectionId(existingFields, existingSections))
  }, [builderOpen, selectedForm])

  const updateFieldSection = (fieldId, sectionId) => {
    setBuilderFields((prev) =>
      prev.map((f) => (String(f.id) === String(fieldId) ? { ...f, sectionId: String(sectionId || "") } : f)),
    )
  }

  const handleAddSection = () => {
    setBuilderSections((prev) => [...prev, { id: slugId("section"), name: `Section ${prev.length + 1}` }])
  }

  const handleRenameSection = (sectionId, name) => {
    setBuilderSections((prev) => prev.map((s) => (String(s.id) === String(sectionId) ? { ...s, name } : s)))
  }

  const handleDeleteSection = (sectionId) => {
    setBuilderSections((prev) => prev.filter((s) => String(s.id) !== String(sectionId)))
    setBuilderFields((prev) =>
      prev.map((f) => (String(f.sectionId) === String(sectionId) ? { ...f, sectionId: "" } : f)),
    )
  }

  const handleSaveBuilder = async () => {
    if (!project?.id || !studyId || !selectedForm) return
    setBuilderSaving(true)
    try {
      const { sections, unmappedCount } = buildSectionsPayload({
        sections: builderSections,
        fields: builderFields,
      })
      const forms = Array.isArray(draftTree?.forms) ? draftTree.forms : []
      const nextForms = forms.map((f) => {
        if (String(f.id) !== String(selectedForm.id)) return f
        const baseFields = Array.isArray(f.fields) ? f.fields : Array.isArray(f.controls) ? f.controls : []
        const mergedFields = baseFields.map((bf, idx) => {
          const id = bf?.id != null ? String(bf.id) : `field_${idx}`
          const updated = builderFields.find((x) => String(x.id) === id)
          return updated ? { ...bf, sectionId: updated.sectionId } : bf
        })
        return { ...f, fields: mergedFields, sections }
      })

      const nextDraftTree = { ...(draftTree || {}), forms: nextForms }
      const res = await crfStudioService.saveDraft(project.id, { studyId, draftTreeJson: nextDraftTree })
      if (!res?.isSuccess) {
        toast.error(res?.message || "Failed to save sections")
        return
      }
      toast.success(
        unmappedCount ? `Saved sections (unmapped fields: ${unmappedCount})` : "Saved sections",
      )
      setBuilderOpen(false)
      await onRefresh?.()
    } finally {
      setBuilderSaving(false)
    }
  }

  return (
    <div className={`${REPORT_CARD_CLASS} mt-4 p-4`}>
      <h2 className="text-sm font-bold text-slate-900">Review draft</h2>
      <p className="mt-1 text-xs text-slate-500">
        Protocol PDF and extracted forms — preview before import. Does not change existing CRF designs until you import.
      </p>

      {hasUnmapped || coverage.note ? (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-950">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Coverage report</p>
              <p className="mt-1">
                Mapped sections: <strong>{coverage.mappedSectionCount}</strong>
              </p>
              {hasUnmapped ? (
                <p className="mt-1">
                  Unmapped: {coverage.unmappedAssessments.join(", ")}
                </p>
              ) : null}
              {coverage.note ? <p className="mt-1 text-amber-800">{coverage.note}</p> : null}
              {hasUnmapped ? (
                <label className="mt-2 flex cursor-pointer items-center gap-2">
                  <Checkbox checked={coverageAck} onCheckedChange={handleCoverageChange} />
                  <span>I reviewed unmapped items and still want to import</span>
                </label>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Protocol PDF</p>
            {loadingPdf ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
          </div>
          {pdfUrl ? (
            <iframe
              title={project?.protocolFileName || "Protocol PDF"}
              src={pdfUrl}
              className="h-[420px] w-full rounded-lg border border-slate-200 bg-white"
            />
          ) : (
            <div
              className="flex h-[420px] items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-500"
              role="status"
              aria-busy={loadingPdf}
            >
              {project?.protocolFileName ? "Loading PDF…" : "Upload a protocol PDF to review"}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Extracted forms</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!selectedForm}
              onClick={() => setBuilderOpen(true)}
            >
              Edit sections
            </Button>
          </div>
          <DraftTreeList
            draftTree={draftTree}
            selectedFormId={selectedFormId}
            onSelectForm={setSelectedFormId}
          />
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Export & import</p>
        {exportBundles.length === 0 ? (
          <p className="text-sm text-slate-500">Run extraction to generate importable forms.</p>
        ) : (
          <ul className="space-y-2">
            {exportBundles.map((entry) => {
              const isImporting = importingFormId === entry.formId
              return (
                <li
                  key={String(entry.formId)}
                  className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{entry.formName}</p>
                    <p className="text-xs text-slate-500">Visit: {entry.visitLabel}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewEntry(entry)}
                    >
                      <Eye className="mr-1.5 h-3.5 w-3.5" />
                      Preview
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => onDownloadBundle(entry)}>
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Export JSON
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className={REPORT_PRIMARY_BTN_CLASS}
                      disabled={!studyId || isImporting || importingAll || importBlocked}
                      title={importBlocked ? "Acknowledge coverage report before import" : undefined}
                      onClick={() => onImportForm(entry)}
                    >
                      {isImporting ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Import className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Import to study
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {exportBundles.length > 1 ? (
          <Button
            type="button"
            className={`${REPORT_PRIMARY_BTN_CLASS} mt-3`}
            disabled={importingAll || !studyId || importBlocked}
            onClick={onImportAll}
          >
            {importingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Import className="mr-2 h-4 w-4" />}
            Import all to study
          </Button>
        ) : null}
      </div>

      <p className="mt-3 flex items-center gap-1 text-xs text-slate-500">
        <FileText className="h-3.5 w-3.5" />
        Import creates a new draft CRF in Manage eCRF — existing designs are not modified.
      </p>

      <Dialog open={Boolean(previewEntry)} onOpenChange={(open) => !open && setPreviewEntry(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview — {previewEntry?.formName}</DialogTitle>
          </DialogHeader>
          {previewCrfData ? (
            <CRFViewer crfData={previewCrfData} isPreviewMode />
          ) : (
            <p className="text-sm text-slate-500">Nothing to preview for this form.</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Section Builder — {selectedForm?.name || "Form"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sections</p>
                <Button type="button" size="sm" variant="outline" onClick={handleAddSection}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add section
                </Button>
              </div>
              <div className="mt-2 space-y-2">
                {builderSections.map((s) => (
                  <div key={String(s.id)} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center gap-2">
                      <input
                        value={s.name}
                        onChange={(e) => handleRenameSection(s.id, e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                        placeholder="Section name"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="text-slate-500 hover:text-slate-900"
                        onClick={() => handleDeleteSection(s.id)}
                        title="Delete section"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Fields: {builderFields.filter((f) => String(f.sectionId) === String(s.id)).length}
                    </p>
                  </div>
                ))}
                {builderSections.length === 0 ? (
                  <p className="text-sm text-slate-500">Add at least one section to assign fields.</p>
                ) : null}
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fields</p>
                <p className="text-xs text-slate-500">
                  Unassigned: {builderFields.filter((f) => !f.sectionId).length}
                </p>
              </div>
              <div className="mt-2 space-y-2">
                {builderFields.map((f) => (
                  <div key={String(f.id)} className="rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {f.label || f.name || "Field"}
                          {f.required ? <span className="ml-1 text-amber-600">*</span> : null}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {f.type ? `Type: ${f.type}` : "Type: —"}
                          {f.sourcePage != null ? ` · p.${f.sourcePage}` : ""}
                        </p>
                      </div>
                      <div className="min-w-[220px]">
                        <Select value={String(f.sectionId || "")} onValueChange={(v) => updateFieldSection(f.id, v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Assign to section" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Unassigned</SelectItem>
                            {builderSections.map((s) => (
                              <SelectItem key={String(s.id)} value={String(s.id)}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
                {builderFields.length === 0 ? (
                  <p className="text-sm text-slate-500">No fields available for this form yet.</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setBuilderOpen(false)} disabled={builderSaving}>
              Cancel
            </Button>
            <Button
              type="button"
              className={REPORT_PRIMARY_BTN_CLASS}
              disabled={builderSaving || !builderSections.length}
              onClick={handleSaveBuilder}
            >
              {builderSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save sections
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
