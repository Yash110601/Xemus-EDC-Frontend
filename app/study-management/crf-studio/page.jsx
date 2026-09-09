"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import CrfStudioReviewPanel from "@/components/crf-studio/CrfStudioReviewPanel"
import SectionSkeleton from "@/components/ui/section-skeleton"
import SearchableSelect from "@/components/ui/searchable-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useStudySiteContext } from "@/hooks/useStudySiteContext"
import studyService from "@/lib/services/study.service"
import crfStudioService from "@/lib/services/crfStudio.service"
import crfDesignService from "@/lib/services/crfDesign.service"
import { downloadBundleJson, normalizeToImportBundlePayload } from "@/lib/utils/crfDesignerBundle"
import { buildCrfStudioExportBundles } from "@/lib/utils/crfStudioDraftToBundle"
import { parseCoverageReport } from "@/lib/utils/crfStudioPreview"
import {
  REPORT_CARD_CLASS,
  REPORT_PAGE_SHELL_CLASS,
  REPORT_PRIMARY_BTN_CLASS,
} from "@/lib/reports/studySitePatientReportUi"
import {
  CRF_STUDIO_REFERENCE_ACCEPT,
  CRF_STUDIO_REFERENCE_FILE_HINT,
  isAllowedCrfStudioReferenceFile,
} from "@/lib/utils/crfStudioReferenceFiles"
import {
  canRunCrfStudioExtraction,
  getCrfReferenceChecksum,
  getProtocolChecksum,
  mergeCrfStudioProjectList,
  normalizeCrfStudioProject,
} from "@/lib/utils/crfStudioProject"
import { toast } from "sonner"
import { Loader2, Play, Plus, Sparkles, Upload } from "lucide-react"
import { useStudyAiSettingsForStudy } from "@/lib/intelligence/useStudyAiSettings"
import { CRF_STUDIO_EXTRACTION_PASSES } from "@/lib/intelligence/xemusIntelligence"

function parsePasses(json) {
  try {
    const raw = typeof json === "string" ? JSON.parse(json || "[]") : json
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

function parseDraft(json) {
  try {
    return typeof json === "string" ? JSON.parse(json || "{}") : json || {}
  } catch {
    return {}
  }
}

function CrfStudioPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { selectedStudyId: contextStudyId } = useStudySiteContext()
  const initialStudyId = searchParams.get("studyId") || contextStudyId || ""

  const [studyId, setStudyId] = useState(initialStudyId)
  const [studies, setStudies] = useState([])
  const [loadingStudies, setLoadingStudies] = useState(true)
  const [projects, setProjects] = useState([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [projectName, setProjectName] = useState("")
  const [creating, setCreating] = useState(false)
  const [protocolFile, setProtocolFile] = useState(null)
  const [crfPdfFile, setCrfPdfFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadingCrfPdf, setUploadingCrfPdf] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [importingFormId, setImportingFormId] = useState(null)
  const [importingAll, setImportingAll] = useState(false)
  const protocolInputRef = useRef(null)
  const crfFileInputRef = useRef(null)
  const protocolUploadTaskRef = useRef(null)
  const crfUploadTaskRef = useRef(null)

  const selectedProject = useMemo(
    () => projects.find((p) => String(p.id) === String(selectedProjectId)) ?? null,
    [projects, selectedProjectId],
  )

  const { isAiCrfStudioEnabled } = useStudyAiSettingsForStudy(studyId)

  const extractionPasses = useMemo(
    () => parsePasses(selectedProject?.extractionPassesJson),
    [selectedProject?.extractionPassesJson],
  )

  const draftTree = useMemo(
    () => parseDraft(selectedProject?.draftTreeJson),
    [selectedProject?.draftTreeJson],
  )

  const exportBundles = useMemo(
    () =>
      selectedProject?.status === "ReadyForReview" || selectedProject?.status === "Published"
        ? buildCrfStudioExportBundles(draftTree, { projectName: selectedProject?.name })
        : [],
    [draftTree, selectedProject?.name, selectedProject?.status],
  )

  const loadProjects = useCallback(async (sid) => {
    if (!sid) {
      setProjects([])
      return
    }
    setLoadingProjects(true)
    try {
      const res = await crfStudioService.getProjectsByStudyId(sid)
      if (res?.isSuccess && Array.isArray(res.data)) {
        const rows = res.data.map((row) => normalizeCrfStudioProject(row))
        setProjects(rows)
        setSelectedProjectId((prev) => {
          if (prev && rows.some((p) => String(p.id) === String(prev))) return prev
          return rows[0]?.id ?? null
        })
      } else {
        setProjects([])
        if (res?.message) toast.error(res.message)
      }
    } finally {
      setLoadingProjects(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingStudies(true)
      try {
        const res = await studyService.getStudiesForDropdown()
        if (cancelled) return
        setStudies(Array.isArray(res?.data) ? res.data : [])
      } finally {
        if (!cancelled) setLoadingStudies(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (contextStudyId && !studyId) {
      setStudyId(String(contextStudyId))
    }
  }, [contextStudyId, studyId])

  useEffect(() => {
    void loadProjects(studyId)
  }, [studyId, loadProjects])

  const studyOptions = useMemo(
    () =>
      studies.map((s) => ({
        value: String(s.id ?? s.studyId),
        label: s.studyProtocolNumber || s.protocolNumber || s.name || `Study ${s.id}`,
      })),
    [studies],
  )

  const handleCreateProject = async () => {
    if (!studyId || !projectName.trim()) return
    setCreating(true)
    try {
      const res = await crfStudioService.createProject({ studyId, name: projectName.trim() })
      if (res?.isSuccess && res.data) {
        toast.success("CRF Studio project created")
        setProjectName("")
        await loadProjects(studyId)
        setSelectedProjectId(res.data.id ?? res.data.Id)
      } else {
        toast.error(res?.message || "Failed to create project")
      }
    } finally {
      setCreating(false)
    }
  }

  const uploadProtocolFile = useCallback(
    async (file) => {
      if (!selectedProject?.id || !studyId || !file) return false
      if (protocolUploadTaskRef.current) return protocolUploadTaskRef.current

      const task = (async () => {
        setUploading(true)
        try {
          const res = await crfStudioService.uploadProtocol({
            projectId: selectedProject.id,
            studyId,
            file,
          })
          if (res?.isSuccess) {
            toast.success("Protocol uploaded")
            setProtocolFile(null)
            if (protocolInputRef.current) protocolInputRef.current.value = ""
            if (res.data) {
              setProjects((prev) => mergeCrfStudioProjectList(prev, res.data))
            }
            await loadProjects(studyId)
            return true
          }
          toast.error(res?.message || "Upload failed")
          return false
        } finally {
          setUploading(false)
          protocolUploadTaskRef.current = null
        }
      })()

      protocolUploadTaskRef.current = task
      return task
    },
    [loadProjects, selectedProject?.id, studyId],
  )

  const uploadCrfReferenceFile = useCallback(
    async (file) => {
      if (!selectedProject?.id || !studyId || !file) return false
      if (!isAllowedCrfStudioReferenceFile(file)) {
        toast.error(`Unsupported file type. ${CRF_STUDIO_REFERENCE_FILE_HINT}`)
        return false
      }
      if (crfUploadTaskRef.current) return crfUploadTaskRef.current

      const task = (async () => {
        setUploadingCrfPdf(true)
        try {
          const res = await crfStudioService.uploadCrfPdf({
            projectId: selectedProject.id,
            studyId,
            file,
          })
          if (res?.isSuccess) {
            toast.success("CRF file uploaded")
            setCrfPdfFile(null)
            if (crfFileInputRef.current) crfFileInputRef.current.value = ""
            if (res.data) {
              setProjects((prev) => mergeCrfStudioProjectList(prev, res.data))
            }
            await loadProjects(studyId)
            return true
          }
          toast.error(res?.message || "CRF file upload failed")
          return false
        } finally {
          setUploadingCrfPdf(false)
          crfUploadTaskRef.current = null
        }
      })()

      crfUploadTaskRef.current = task
      return task
    },
    [loadProjects, selectedProject?.id, studyId],
  )

  const handleProtocolFileChange = (file) => {
    setProtocolFile(file)
    if (!file) return
    if (!selectedProject?.id) {
      toast.error("Select a project before uploading")
      return
    }
    void uploadProtocolFile(file)
  }

  const handleCrfFileChange = (file) => {
    setCrfPdfFile(file)
    if (!file) return
    if (!selectedProject?.id) {
      toast.error("Select a project before uploading")
      return
    }
    void uploadCrfReferenceFile(file)
  }

  const handleUploadProtocol = async () => {
    if (!protocolFile) return
    await uploadProtocolFile(protocolFile)
  }

  const handleUploadCrfPdf = async () => {
    if (!crfPdfFile) return
    await uploadCrfReferenceFile(crfPdfFile)
  }

  const handleStartExtraction = async () => {
    if (!selectedProject?.id || !studyId) return
    if (!isAiCrfStudioEnabled) {
      toast.error("Studio AI is disabled for this study. Enable it in Study Settings → YP Intelligence.")
      return
    }
    setExtracting(true)
    try {
      if (protocolFile) {
        const uploaded = await uploadProtocolFile(protocolFile)
        if (!uploaded) return
      }
      if (crfPdfFile) {
        const uploaded = await uploadCrfReferenceFile(crfPdfFile)
        if (!uploaded) return
      }

      const res = await crfStudioService.startExtraction(selectedProject.id, studyId)
      if (res?.isSuccess) {
        toast.success("Extraction pipeline completed")
        await loadProjects(studyId)
      } else {
        toast.error(res?.message || "Extraction failed")
      }
    } finally {
      setExtracting(false)
    }
  }

  const isAiProcessing = extracting

  const extractionReady = canRunCrfStudioExtraction(selectedProject)
  const hasPendingUploads = Boolean(protocolFile || crfPdfFile)
  const uploadInProgress = uploading || uploadingCrfPdf
  const canStartExtraction = extractionReady || hasPendingUploads
  const extractionBusy = extracting || uploadInProgress

  const handleDownloadBundle = (entry) => {
    const safeName = String(entry.formName || "crf")
      .replace(/[^a-z0-9-_]+/gi, "_")
      .slice(0, 80)
    downloadBundleJson(entry.bundle, `crf-studio_${safeName}_bundle.json`)
    toast.success(`Downloaded bundle for ${entry.formName}`)
  }

  const importBundleToStudy = async (entry) => {
    if (!studyId) {
      toast.error("Select a study first")
      return null
    }
    const payload = normalizeToImportBundlePayload(entry.bundle, {
      targetStudyId: studyId,
      includeRules: (entry.bundle.rules?.length || 0) > 0,
    })
    const result = await crfDesignService.importBundle(payload)
    const crfDesignId = result?.crfDesignId ?? result?.CrfDesignId
    if (crfDesignId && selectedProject?.id) {
      await crfStudioService.recordImport(selectedProject.id, {
        studyId,
        formId: entry.formId,
        formName: entry.formName,
        crfDesignId,
      })
      await loadProjects(studyId)
    }
    return { crfDesignId, formName: entry.formName }
  }

  const handleImportForm = async (entry) => {
    if (!entry?.bundle) return
    setImportingFormId(entry.formId)
    try {
      const result = await importBundleToStudy(entry)
      if (result?.crfDesignId) {
        toast.success(`"${result.formName}" imported — opening form designer`)
        router.push(
          `/ecrf-form-designer/manage?openCrfId=${result.crfDesignId}&studyId=${studyId}`,
        )
      } else {
        toast.error("Import completed but no CRF design ID was returned")
      }
    } catch (error) {
      toast.error(error?.message || "Import failed")
    } finally {
      setImportingFormId(null)
    }
  }

  const handleCoverageAcknowledged = async (acknowledged) => {
    if (!selectedProject?.id || !studyId) return
    const coverage = parseCoverageReport(selectedProject.coverageReportJson)
    try {
      await crfStudioService.saveDraft(selectedProject.id, {
        studyId,
        draftTreeJson: draftTree,
        coverageReportJson: { ...coverage, acknowledged },
      })
      await loadProjects(studyId)
    } catch {
      // non-blocking
    }
  }

  const handleImportAll = async () => {
    if (!exportBundles.length || !studyId) return
    setImportingAll(true)
    const created = []
    try {
      for (const entry of exportBundles) {
        const result = await importBundleToStudy(entry)
        if (result?.crfDesignId) created.push(result)
      }
      if (created.length) {
        toast.success(`Imported ${created.length} CRF design(s) — open Manage eCRF to review`)
      } else {
        toast.error("No CRF designs were created")
      }
    } catch (error) {
      toast.error(error?.message || "Bulk import failed")
    } finally {
      setImportingAll(false)
    }
  }

  return (
    <DashboardLayout>
      <div className={REPORT_PAGE_SHELL_CLASS}>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">CRF Studio</h1>
            <p className="mt-1 text-sm text-slate-600">
              Design from protocol → export bundle → import to create live CRF designs (same as form designer import).
            </p>
          </div>
          <Link
            href="/ecrf-form-designer/manage"
            className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            Open classic form designer →
          </Link>
        </div>

        <div className={`${REPORT_CARD_CLASS} mb-4 p-4`}>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Study
          </label>
          <SearchableSelect
            value={studyId}
            onChange={setStudyId}
            options={studyOptions}
            placeholder={loadingStudies ? "Loading studies…" : "Select study"}
            disabled={loadingStudies || studyOptions.length === 0}
            showSearch
            includeEmptyOption={false}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className={`${REPORT_CARD_CLASS} p-4`}>
            <h2 className="text-sm font-bold text-slate-900">Projects</h2>
            <p className="mt-1 text-xs text-slate-500">Super Admin only · isolated from live CRF designs</p>

            <div className="mt-3 flex gap-2">
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="New project name"
                disabled={!studyId || creating}
              />
              <Button
                type="button"
                className={REPORT_PRIMARY_BTN_CLASS}
                disabled={!studyId || creating || !projectName.trim()}
                onClick={() => void handleCreateProject()}
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>

            {loadingProjects ? (
              <div className="mt-4" role="status" aria-busy="true" aria-label="Loading projects">
                <SectionSkeleton variant="table" rows={3} />
              </div>
            ) : (
              <ul className="mt-4 space-y-2">
                {projects.length === 0 ? (
                  <li className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                    No CRF Studio projects for this study yet.
                  </li>
                ) : (
                  projects.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedProjectId(p.id)}
                        className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                          String(selectedProjectId) === String(p.id)
                            ? "border-emerald-500 bg-emerald-50/80"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <span className="font-semibold text-slate-900">{p.name}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">{p.status}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>

          <div className={`${REPORT_CARD_CLASS} p-4`}>
            <h2 className="text-sm font-bold text-slate-900">Protocol & extraction</h2>
            {!selectedProject ? (
              <p className="mt-3 text-sm text-slate-500">Select or create a project.</p>
            ) : (
              <div className="relative mt-3 space-y-4">
                {isAiProcessing ? (
                  <div
                    className="absolute inset-0 z-10 rounded-xl border border-emerald-100 bg-white/80 backdrop-blur-sm"
                    role="status"
                    aria-busy="true"
                    aria-label="AI processing"
                  >
                    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                      <div className="flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        AI processing…
                      </div>
                      <div className="w-full max-w-sm space-y-2">
                        <div className="h-2 w-full rounded-full bg-slate-200" />
                        <div className="h-2 w-5/6 rounded-full bg-slate-200" />
                        <div className="h-2 w-4/6 rounded-full bg-slate-200" />
                      </div>
                      <p className="text-xs text-slate-600">
                        Uploading documents and generating a draft CRF. Please don’t close this tab.
                      </p>
                    </div>
                  </div>
                ) : null}
                <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                  <p>
                    <span className="font-semibold text-slate-800">Protocol:</span>{" "}
                    {uploading && protocolFile ? (
                      <span className="text-emerald-700">Uploading {protocolFile.name}…</span>
                    ) : getProtocolChecksum(selectedProject) ? (
                      (selectedProject.protocolFileName ?? selectedProject.ProtocolFileName) || "Uploaded"
                    ) : protocolFile ? (
                      <span className="text-amber-700">Selected: {protocolFile.name}</span>
                    ) : (
                      "Not uploaded"
                    )}
                  </p>
                  {getProtocolChecksum(selectedProject) ? (
                    <p className="mt-1 truncate font-mono text-[10px]">
                      SHA-256: {getProtocolChecksum(selectedProject)}
                    </p>
                  ) : null}
                  <p className="mt-2">
                    <span className="font-semibold text-slate-800">CRF file:</span>{" "}
                    {uploadingCrfPdf && crfPdfFile ? (
                      <span className="text-emerald-700">Uploading {crfPdfFile.name}…</span>
                    ) : getCrfReferenceChecksum(selectedProject) ? (
                      (selectedProject.crfPdfFileName ?? selectedProject.CrfPdfFileName) || "Uploaded"
                    ) : crfPdfFile ? (
                      <span className="text-amber-700">Selected: {crfPdfFile.name}</span>
                    ) : (
                      "Not uploaded (optional)"
                    )}
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Protocol PDF</label>
                  <Input
                    ref={protocolInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    disabled={uploading || extracting}
                    onChange={(e) => handleProtocolFileChange(e.target.files?.[0] ?? null)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2 w-full"
                    disabled={uploading || !protocolFile}
                    onClick={() => void handleUploadProtocol()}
                  >
                    {uploading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    Upload protocol PDF
                  </Button>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    CRF file (optional)
                  </label>
                  <Input
                    ref={crfFileInputRef}
                    type="file"
                    accept={CRF_STUDIO_REFERENCE_ACCEPT}
                    disabled={uploadingCrfPdf || extracting}
                    onChange={(e) => handleCrfFileChange(e.target.files?.[0] ?? null)}
                  />
                  <p className="mt-1 text-[11px] text-slate-500">{CRF_STUDIO_REFERENCE_FILE_HINT}</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-2 w-full"
                    disabled={uploadingCrfPdf || !crfPdfFile}
                    onClick={() => void handleUploadCrfPdf()}
                  >
                    {uploadingCrfPdf ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    Upload CRF file
                  </Button>
                </div>

                <Button
                  type="button"
                  className={`${REPORT_PRIMARY_BTN_CLASS} w-full`}
                  disabled={extractionBusy || !canStartExtraction || !isAiCrfStudioEnabled}
                  title={
                    !isAiCrfStudioEnabled
                      ? "Enable Studio AI in Study Settings"
                      : extractionReady
                        ? "Run multi-pass extraction pipeline"
                        : hasPendingUploads
                          ? "Upload selected files and run extraction"
                          : "Choose a protocol PDF and/or CRF file first"
                  }
                  onClick={() => void handleStartExtraction()}
                >
                  {extracting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : uploadInProgress ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  {uploadInProgress && !extracting
                    ? "Uploading files…"
                    : extracting
                      ? "Running extraction…"
                      : isAiCrfStudioEnabled
                        ? "Run Studio AI extraction"
                        : "Studio AI disabled"}
                </Button>
                {!isAiCrfStudioEnabled ? (
                  <p className="text-center text-[11px] text-slate-600">
                    Enable Studio AI under Study Settings → YP Intelligence.
                  </p>
                ) : null}
                {!extractionReady && hasPendingUploads && !uploadInProgress ? (
                  <p className="text-center text-[11px] text-amber-700">
                    Files are selected — upload will start automatically, or click Run extraction.
                  </p>
                ) : null}

                {extractionPasses.length > 0 || extracting ? (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-slate-500">
                      <Sparkles className="h-3.5 w-3.5 text-violet-600" />
                      Extraction passes
                    </p>
                    <ul className="space-y-1">
                      {(extractionPasses.length
                        ? extractionPasses
                        : CRF_STUDIO_EXTRACTION_PASSES.map((p) => ({
                            pass: p.id,
                            name: p.label,
                            status: extracting ? "running" : "pending",
                          }))
                      ).map((pass) => (
                        <li
                          key={pass.pass ?? pass.id ?? pass.name}
                          className="flex items-center justify-between rounded-md border border-slate-100 px-2 py-1 text-xs"
                        >
                          <span>{pass.name || pass.label}</span>
                          <span className="font-medium capitalize text-slate-700">
                            {pass.status || "pending"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {selectedProject && (selectedProject.status === "ReadyForReview" || exportBundles.length > 0) ? (
          <CrfStudioReviewPanel
            studyId={studyId}
            project={selectedProject}
            draftTree={draftTree}
            exportBundles={exportBundles}
            coverageReportJson={selectedProject.coverageReportJson}
            onRefresh={() => loadProjects(studyId)}
            onCoverageAcknowledged={handleCoverageAcknowledged}
            onDownloadBundle={handleDownloadBundle}
            onImportForm={(entry) => void handleImportForm(entry)}
            onImportAll={() => void handleImportAll()}
            importingFormId={importingFormId}
            importingAll={importingAll}
          />
        ) : null}
      </div>
    </DashboardLayout>
  )
}

export default function CrfStudioPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className={REPORT_PAGE_SHELL_CLASS} role="status" aria-busy="true" aria-label="Loading CRF Studio">
            <SectionSkeleton variant="page" />
          </div>
        </DashboardLayout>
      }
    >
      <CrfStudioPageContent />
    </Suspense>
  )
}
