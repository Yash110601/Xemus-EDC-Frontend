"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import SectionSkeleton from "@/components/ui/section-skeleton"
import SearchableSelect from "@/components/ui/searchable-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { useStudySiteContext } from "@/hooks/useStudySiteContext"
import studyService from "@/lib/services/study.service"
import studyDocumentService from "@/lib/services/studyDocument.service"
import {
  filterStudiesWithStudyDocumentsEnabled,
} from "@/lib/utils/studySettingsRead"
import {
  REPORT_CARD_CLASS,
  REPORT_PAGE_SHELL_CLASS,
  REPORT_PRIMARY_BTN_CLASS,
  REPORT_TABLE_BODY_CLASS,
  REPORT_TABLE_HEAD_ROW_CLASS,
  REPORT_TABLE_SCROLL_CLASS,
  REPORT_TABLE_TD_CLASS,
  REPORT_TABLE_TH_CLASS,
  REPORT_TABLE_TR_CLASS,
} from "@/lib/reports/studySitePatientReportUi"
import { toast } from "sonner"
import { FileText, Loader2, Plus, Trash2, Upload } from "lucide-react"

function docRowLabel(row) {
  return (
    row?.displayName ??
    row?.DisplayName ??
    row?.documentName ??
    row?.DocumentName ??
    "Document"
  )
}

function StudyDocumentsPageContent() {
  const searchParams = useSearchParams()
  const { selectedStudyId: contextStudyId } = useStudySiteContext()
  const initialStudyId = searchParams.get("studyId") || contextStudyId || ""

  const [studyId, setStudyId] = useState(initialStudyId)
  const [studies, setStudies] = useState([])
  const [loadingStudies, setLoadingStudies] = useState(true)
  const [documents, setDocuments] = useState([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingStudies(true)
      try {
        const res = await studyService.getStudiesForDropdown()
        if (cancelled) return
        if (!res?.isSuccess) {
          setStudies([])
          setStudyId("")
          return
        }
        const allStudies = Array.isArray(res.data) ? res.data : []
        const enabledStudies = await filterStudiesWithStudyDocumentsEnabled(allStudies)
        if (cancelled) return

        setStudies(enabledStudies)

        const enabledIds = new Set(enabledStudies.map((s) => String(s.id ?? s.Id)))
        if (studyId && enabledIds.has(String(studyId))) return
        if (initialStudyId && enabledIds.has(String(initialStudyId))) {
          setStudyId(String(initialStudyId))
          return
        }
        if (enabledStudies.length === 1) {
          setStudyId(String(enabledStudies[0].id ?? enabledStudies[0].Id))
          return
        }
        setStudyId("")
      } finally {
        if (!cancelled) setLoadingStudies(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [initialStudyId])

  const isStudyDocumentsEnabled = useMemo(() => {
    if (!studyId || loadingStudies) return false
    return studies.some((s) => String(s.id ?? s.Id) === String(studyId))
  }, [studyId, studies, loadingStudies])

  const loadDocuments = useCallback(async () => {
    const numericId = parseInt(studyId, 10)
    if (!Number.isFinite(numericId)) return
    setLoadingDocs(true)
    try {
      const res = await studyDocumentService.getCustomDocuments(numericId)
      if (res?.isSuccess) {
        setDocuments(Array.isArray(res.data) ? res.data : [])
      } else {
        setDocuments([])
        if (res?.message) toast.error(res.message)
      }
    } finally {
      setLoadingDocs(false)
    }
  }, [studyId])

  useEffect(() => {
    if (studyId && isStudyDocumentsEnabled) {
      void loadDocuments()
    } else {
      setDocuments([])
    }
  }, [studyId, isStudyDocumentsEnabled, loadDocuments])

  const selectedStudyLabel = useMemo(() => {
    const match = studies.find((s) => String(s.id ?? s.Id) === String(studyId))
    return match?.studyProtocolNumber ?? match?.name ?? (studyId ? `Study ${studyId}` : "")
  }, [studies, studyId])

  const handleUpload = async () => {
    const numericId = parseInt(studyId, 10)
    if (!Number.isFinite(numericId)) {
      toast.error("Select a study first")
      return
    }
    if (!displayName.trim()) {
      toast.error("Enter a document name (e.g. User Manual)")
      return
    }
    if (!file) {
      toast.error("Choose a file to upload")
      return
    }

    setUploading(true)
    try {
      const res = await studyDocumentService.uploadCustomDocument({
        studyId: numericId,
        displayName: displayName.trim(),
        file,
      })
      if (res?.isSuccess) {
        toast.success("Document uploaded")
        setDisplayName("")
        setFile(null)
        const input = document.getElementById("study-doc-file-input")
        if (input) input.value = ""
        await loadDocuments()
      } else {
        toast.error(res?.message || "Upload failed")
      }
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    const id = deleteTarget?.id ?? deleteTarget?.Id
    if (!id) return
    setDeleting(true)
    try {
      const res = await studyDocumentService.deleteDocument(id)
      if (res?.isSuccess) {
        toast.success("Document removed")
        setDeleteTarget(null)
        await loadDocuments()
      } else {
        toast.error(res?.message || "Delete failed")
      }
    } finally {
      setDeleting(false)
    }
  }

  return (
    <DashboardLayout>
      <div className={REPORT_PAGE_SHELL_CLASS}>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-emerald-600" />
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Study Documents</h1>
              <p className="text-sm text-slate-600">
                Upload user manuals and guides — visible to roles configured in Study Settings
              </p>
            </div>
          </div>
        </div>

        {!loadingStudies && studies.length === 0 ? (
          <div className={`${REPORT_CARD_CLASS} mb-6 border-slate-200 p-6`}>
            <p className="text-sm font-semibold text-slate-800">No studies with documents enabled</p>
            <p className="mt-1 text-sm text-slate-600">
              Enable <strong>Study documents enabled</strong> in Study Settings for at least one study to upload manuals
              here.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href="/study-management/study-settings">Open Study Settings</Link>
            </Button>
          </div>
        ) : null}

        <div className={`${REPORT_CARD_CLASS} mb-6 grid gap-4 p-6 md:grid-cols-2`}>
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">Study *</label>
            <SearchableSelect
              value={studyId}
              onValueChange={setStudyId}
              options={studies.map((s) => ({
                value: String(s.id ?? s.Id),
                label: s.studyProtocolNumber ?? s.name ?? `Study ${s.id ?? s.Id}`,
              }))}
              placeholder={
                loadingStudies
                  ? "Loading studies…"
                  : studies.length === 0
                    ? "No studies with documents enabled"
                    : "Select study"
              }
              disabled={loadingStudies || studies.length === 0}
            />
            <p className="mt-1 text-xs text-slate-500">
              Only studies with Study documents enabled in Study Settings appear here.
            </p>
          </div>
        </div>

        {studyId && isStudyDocumentsEnabled && (
          <>
            <div className={`${REPORT_CARD_CLASS} mb-6 p-6`}>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-800">
                <Plus className="h-5 w-5 text-emerald-600" />
                Add document
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Document name *</label>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. User Manual, Training Guide"
                    className="h-10 rounded-xl"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">File *</label>
                  <Input
                    id="study-doc-file-input"
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="h-10 rounded-xl file:mr-3"
                  />
                  <p className="mt-1 text-xs text-slate-500">PDF, DOC, or DOCX</p>
                </div>
              </div>
              <Button
                type="button"
                className={`mt-4 ${REPORT_PRIMARY_BTN_CLASS}`}
                disabled={uploading}
                onClick={() => void handleUpload()}
              >
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Upload document
              </Button>
              <p className="mt-3 text-xs text-slate-500">
                EC Letter and Protocol are uploaded from{" "}
                <Link href="/study-management/study-configuration" className="text-emerald-700 underline">
                  Study configuration
                </Link>
                . Demo video URL is set in Study Settings.
              </p>
            </div>

            <div className={REPORT_CARD_CLASS}>
              <div className="border-b border-slate-100 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-800">
                  Uploaded documents
                  {selectedStudyLabel ? (
                    <span className="ml-2 text-sm font-normal text-slate-500">— {selectedStudyLabel}</span>
                  ) : null}
                </h2>
              </div>
              <div className={REPORT_TABLE_SCROLL_CLASS}>
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className={REPORT_TABLE_HEAD_ROW_CLASS}>
                      <th className={REPORT_TABLE_TH_CLASS}>Name</th>
                      <th className={REPORT_TABLE_TH_CLASS}>File</th>
                      <th className={REPORT_TABLE_TH_CLASS}>Uploaded</th>
                      <th className={REPORT_TABLE_TH_CLASS}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className={REPORT_TABLE_BODY_CLASS}>
                    {loadingDocs ? (
                      <tr>
                        <td colSpan={4} className={`${REPORT_TABLE_TD_CLASS} py-10 text-center text-slate-500`}>
                          <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                        </td>
                      </tr>
                    ) : documents.length === 0 ? (
                      <tr>
                        <td colSpan={4} className={`${REPORT_TABLE_TD_CLASS} py-10 text-center text-slate-500`}>
                          No custom documents yet. Upload a user manual or guide above.
                        </td>
                      </tr>
                    ) : (
                      documents.map((row) => {
                        const id = row.id ?? row.Id
                        const uploadedAt = row.uploadedAt ?? row.UploadedAt
                        return (
                          <tr key={id} className={REPORT_TABLE_TR_CLASS}>
                            <td className={REPORT_TABLE_TD_CLASS}>{docRowLabel(row)}</td>
                            <td className={REPORT_TABLE_TD_CLASS}>{row.documentName ?? row.DocumentName}</td>
                            <td className={REPORT_TABLE_TD_CLASS}>
                              {uploadedAt ? new Date(uploadedAt).toLocaleDateString() : "—"}
                            </td>
                            <td className={REPORT_TABLE_TD_CLASS}>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={() => setDeleteTarget(row)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove document?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove &quot;{deleteTarget ? docRowLabel(deleteTarget) : ""}&quot; from this study. Users will no longer
              see it on the dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
              onClick={(e) => {
                e.preventDefault()
                void handleDelete()
              }}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}

export default function StudyDocumentsPage() {
  return (
    <Suspense fallback={<SectionSkeleton title="Study Documents" rows={6} />}>
      <StudyDocumentsPageContent />
    </Suspense>
  )
}
