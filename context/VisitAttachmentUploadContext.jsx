"use client"

import { createContext, useContext, useCallback, useState, useEffect, useRef } from "react"
import visitAttachmentsService, {
  preferAzureBlobSdkForVisitAttachment,
  VISIT_ATTACHMENT_NORMAL_MAX_BYTES,
} from "@/lib/services/visitAttachments.service"
import xemusAiService from "@/lib/services/xemusAi.service"
import { UploadCloud, CheckCircle, XCircle, Loader2, X, FileDown } from "lucide-react"

const VisitAttachmentUploadContext = createContext(null)

function generateId() {
  return `va-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i += 1
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

function formatSpeed(bytesPerSec) {
  if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return "—"
  return `${formatBytes(bytesPerSec)}/s`
}

export function VisitAttachmentUploadProvider({ children }) {
  const [jobs, setJobs] = useState([])

  const addDownloadJob = useCallback(async ({ attachmentId }) => {
    const id = generateId()
    const job = {
      id,
      fileName: `attachment-${attachmentId}`,
      progress: 0,
      loadedBytes: 0,
      totalBytes: 0,
      speedBps: 0,
      _lastLoadedBytes: 0,
      _lastTs: Date.now(),
      status: "downloading",
      error: null,
      kind: "download",
    }
    setJobs((prev) => [...prev, job])

    const updateProgress = ({ percent, loadedBytes, totalBytes }) => {
      const now = Date.now()
      setJobs((prev) =>
        prev.map((j) => {
          if (j.id !== id) return j
          const prevTs = j._lastTs || now
          const prevLoaded = j._lastLoadedBytes || 0
          const dt = Math.max(0.001, (now - prevTs) / 1000)
          const dBytes = Math.max(0, (loadedBytes ?? 0) - prevLoaded)
          const instant = dBytes / dt
          const speedBps = j.speedBps ? j.speedBps * 0.7 + instant * 0.3 : instant
          return {
            ...j,
            progress: percent ?? j.progress,
            loadedBytes: loadedBytes ?? j.loadedBytes,
            totalBytes: totalBytes ?? j.totalBytes,
            speedBps,
            _lastLoadedBytes: loadedBytes ?? j._lastLoadedBytes,
            _lastTs: now,
          }
        })
      )
    }

    try {
      const res = await visitAttachmentsService.downloadWithProgress(attachmentId, {
        onProgress: updateProgress,
      })
      if (!res?.isSuccess || !res.blob) {
        setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: "error", error: res?.message || "Download failed" } : j)))
        return { isSuccess: false, message: res?.message || "Download failed" }
      }

      // Trigger browser download
      const objectUrl = URL.createObjectURL(res.blob)
      const a = document.createElement("a")
      a.href = objectUrl
      a.download = res.fileName || `attachment-${attachmentId}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)

      const size = res.blob?.size ?? 0
      setJobs((prev) =>
        prev.map((j) =>
          j.id === id
            ? { ...j, status: "done", progress: 100, loadedBytes: size, totalBytes: size, fileName: res.fileName || j.fileName }
            : j
        )
      )
      return { isSuccess: true, message: "Download started." }
    } catch (e) {
      setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: "error", error: e.message || "Download failed" } : j)))
      return { isSuccess: false, message: e.message || "Download failed" }
    }
  }, [])

  const addJob = useCallback(
    async ({ file, studyId, patientEnrolmentId, visitScheduleId, crfDataId = null, onListRefresh }) => {
      const validation = visitAttachmentsService.validateFile(file)
      if (!validation.ok) {
        return { isSuccess: false, message: validation.message }
      }

      const id = generateId()
      const job = {
        id,
        fileName: file.name,
        progress: 0,
        loadedBytes: 0,
        totalBytes: file.size,
        speedBps: 0,
        _lastLoadedBytes: 0,
        _lastTs: Date.now(),
        status: "uploading",
        error: null,
        kind: "upload",
        studyId,
        patientEnrolmentId,
        visitScheduleId,
        onListRefresh,
      }
      setJobs((prev) => [...prev, job])

      const updateJob = (updates) => {
        setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...updates } : j)))
      }

      try {
        const initRes = await visitAttachmentsService.initUpload({
          studyId,
          patientEnrolmentId,
          visitScheduleId,
          crfDataId,
          attachmentType: validation.attachmentType,
          fileName: file.name,
          contentType: validation.contentType,
          fileSizeBytes: file.size,
        })
        if (!initRes.isSuccess || !initRes.data?.attachmentId) {
          updateJob({ status: "error", error: initRes.message || "Init failed" })
          return { isSuccess: false, message: initRes.message }
        }

        const { attachmentId, sasUrl, uploadMode, useApiUpload } = initRes.data
        const needsDirectSas = file.size > VISIT_ATTACHMENT_NORMAL_MAX_BYTES
        if (needsDirectSas && !sasUrl) {
          const msg =
            initRes.message ||
            "Large file upload requires Azure Blob Storage (SAS URL). Use a file ≤10 MB or configure AzureBlobStorage__ConnectionString on the API."
          updateJob({ status: "error", error: msg })
          return { isSuccess: false, message: msg }
        }
        const onUploadProgress = ({ percent, loadedBytes, totalBytes }) => {
          const now = Date.now()
          setJobs((prev) =>
            prev.map((j) => {
              if (j.id !== id) return j
              const prevTs = j._lastTs || now
              const prevLoaded = j._lastLoadedBytes || 0
              const dt = Math.max(0.001, (now - prevTs) / 1000)
              const dBytes = Math.max(0, (loadedBytes ?? 0) - prevLoaded)
              const instant = dBytes / dt
              const speedBps = j.speedBps ? j.speedBps * 0.7 + instant * 0.3 : instant
              return {
                ...j,
                progress: percent ?? j.progress,
                loadedBytes: loadedBytes ?? j.loadedBytes,
                totalBytes: totalBytes ?? j.totalBytes,
                speedBps,
                _lastLoadedBytes: loadedBytes ?? j._lastLoadedBytes,
                _lastTs: now,
              }
            }),
          )
        }

        if (file.size <= VISIT_ATTACHMENT_NORMAL_MAX_BYTES) {
          const apiRes = await visitAttachmentsService.uploadViaApi(attachmentId, file, {
            onProgress: onUploadProgress,
          })
          if (!apiRes.isSuccess) {
            updateJob({ status: "error", error: apiRes.message || "Upload failed" })
            return { isSuccess: false, message: apiRes.message }
          }
        } else {
          const shouldUseSdk = preferAzureBlobSdkForVisitAttachment(uploadMode, file.size)
          await visitAttachmentsService.uploadToSasUrl(sasUrl, file, {
            contentType: validation.contentType,
            onProgress: onUploadProgress,
            useAzureSdk: shouldUseSdk,
          })
        }

        const completeRes = await visitAttachmentsService.completeUpload(attachmentId, {
          finalFileSizeBytes: file.size,
          checksumSha256: null,
        })
        if (!completeRes.isSuccess) {
          updateJob({ status: "error", error: completeRes.message })
          return { isSuccess: false, message: completeRes.message }
        }

        updateJob({ status: "done", progress: 100 })
        if (typeof onListRefresh === "function") onListRefresh()

        if (studyId) {
          void xemusAiService
            .classifyDocument({ studyId, fileName: file.name })
            .then((res) => {
              const category = res?.data?.category ?? res?.data?.Category
              const confidence = res?.data?.confidence ?? res?.data?.Confidence
              if (res?.isSuccess && category) {
                updateJob({
                  suggestedCategory: category,
                  classificationConfidence: confidence,
                })
              }
            })
            .catch(() => {})
        }

        return { isSuccess: true, message: "Upload completed." }
      } catch (err) {
        updateJob({ status: "error", error: err.message || "Upload failed" })
        return { isSuccess: false, message: err.message }
      }
    },
    []
  )

  const dismissJob = useCallback((jobId) => {
    setJobs((prev) => prev.filter((j) => j.id !== jobId))
  }, [])

  const doneDismissTimeoutRef = useRef({})
  useEffect(() => {
    jobs.forEach((job) => {
      if (job.status !== "done") return
      if (doneDismissTimeoutRef.current[job.id]) return
      doneDismissTimeoutRef.current[job.id] = setTimeout(() => {
        setJobs((prev) => prev.filter((j) => j.id !== job.id))
        delete doneDismissTimeoutRef.current[job.id]
      }, 2000)
    })
    return () => {
      Object.values(doneDismissTimeoutRef.current).forEach(clearTimeout)
      doneDismissTimeoutRef.current = {}
    }
  }, [jobs])

  const value = { jobs, addJob, addDownloadJob, dismissJob }

  return (
    <VisitAttachmentUploadContext.Provider value={value}>
      {children}
      <VisitAttachmentUploadPopup />
    </VisitAttachmentUploadContext.Provider>
  )
}

function VisitAttachmentUploadPopup() {
  const { jobs, dismissJob } = useContext(VisitAttachmentUploadContext)
  if (!jobs || jobs.length === 0) return null

  return (
    <div
      className="fixed bottom-6 right-6 z-[9998] flex flex-col gap-2 w-[320px] max-w-[calc(100vw-2rem)]"
      data-visit-attachment-popup
    >
      <div className="rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
        <div className="px-3 py-2 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <UploadCloud className="w-4 h-4 text-emerald-600" />
            Visit attachments
          </span>
        </div>
        <div className="max-h-[240px] overflow-y-auto p-2">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100 mb-1 last:mb-0"
            >
              <div className="flex-shrink-0">
                {(job.status === "uploading" || job.status === "downloading") && (
                  <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                )}
                {job.status === "done" && (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                )}
                {job.status === "error" && (
                  <XCircle className="w-4 h-4 text-red-600" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-800 truncate" title={job.fileName}>
                  {job.fileName}
                </p>
                {(job.status === "uploading" || job.status === "downloading") && (
                  <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span className="tabular-nums">
                      {job.totalBytes > 0
                        ? `${job.progress ?? 0}% • ${formatBytes(job.loadedBytes)} / ${formatBytes(job.totalBytes)}`
                        : `${formatBytes(job.loadedBytes)} downloaded`}
                    </span>
                    <span className="tabular-nums">{formatSpeed(job.speedBps)}</span>
                  </div>
                )}
                {(job.status === "uploading" || job.status === "downloading") && (
                  <div className="mt-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                )}
                {job.status === "error" && job.error && (
                  <p className="text-xs text-red-600 mt-0.5 truncate">{job.error}</p>
                )}
                {job.status === "done" && job.suggestedCategory ? (
                  <p className="text-[11px] text-violet-700 mt-0.5 truncate" title="AI document classification">
                    AI type: {job.suggestedCategory}
                    {job.classificationConfidence != null
                      ? ` (${Math.round(Number(job.classificationConfidence) * 100)}%)`
                      : ""}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismissJob(job.id)}
                className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-700"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function useVisitAttachmentUpload() {
  const ctx = useContext(VisitAttachmentUploadContext)
  if (!ctx) throw new Error("useVisitAttachmentUpload must be used within VisitAttachmentUploadProvider")
  return ctx
}
