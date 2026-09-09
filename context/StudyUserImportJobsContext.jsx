"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  CheckCircle,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Loader2,
  Mail,
  Minimize2,
  Upload,
  UserPlus,
  X,
  XCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import studyUserService from "@/lib/services/studyUser.service"
import authService from "@/lib/services/auth.service"
import { isSuperAdminUser } from "@/lib/utils/createdUserCredentials"
import { downloadStudyUserCredentialsCsv } from "@/lib/masters/studyUserImportCredentialsExport"
import { downloadStudyUserImportReportWorkbook } from "@/lib/masters/studyUserImportReportExport"

const StudyUserImportJobsContext = createContext(null)

const DONE_AUTO_DISMISS_MS = 12000

function generateId() {
  return `sui-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function formatImportProgress(progress) {
  if (!progress) return "Starting…"
  const {
    batchIndex,
    totalBatches,
    processedRows,
    totalRows,
    retrying,
    retryAttempt,
    successCount,
    failedCount,
    emailSentCount,
    emailFailedCount,
    phase,
  } = progress
  if (retrying) {
    return `Retrying batch ${batchIndex} (attempt ${retryAttempt + 1})…`
  }
  const created = Number.isFinite(successCount) ? ` · ${successCount} created` : ""
  const failed = Number.isFinite(failedCount) && failedCount > 0 ? ` · ${failedCount} failed` : ""
  const emails =
    Number.isFinite(emailSentCount) || Number.isFinite(emailFailedCount)
      ? ` · emails ${emailSentCount || 0} sent${emailFailedCount ? `, ${emailFailedCount} failed` : ""}`
      : ""
  if (phase === "email") {
    return `Sending credential emails · ${emailSentCount || 0} sent${emailFailedCount ? `, ${emailFailedCount} failed` : ""}`
  }
  if (totalBatches > 1) {
    return `Batch ${batchIndex} of ${totalBatches} · ${processedRows} / ${totalRows} processed${created}${failed}${emails}`
  }
  return `${processedRows} / ${totalRows} processed${created}${failed}${emails}`
}

function emailProgressPercent(progress, status) {
  const sent = progress?.emailSentCount ?? 0
  const failed = progress?.emailFailedCount ?? 0
  const total = progress?.emailTotal ?? progress?.newLoginCount ?? sent + failed
  if (status !== "running") return total > 0 ? 100 : 0
  if (total <= 0) return 0
  return Math.min(100, Math.round(((sent + failed) / total) * 100))
}

function resolveImportStatus(response) {
  if (response?.success) return "done"
  if (response?.partial && (response?.data?.successCount || 0) > 0) return "partial"
  return "error"
}

function progressPercent(progress, status) {
  if (status !== "running") return 100
  if (!progress) return 0
  if (progress.totalRows > 0) {
    return Math.min(100, Math.round((progress.processedRows / progress.totalRows) * 100))
  }
  return progress.percent || 0
}

export function StudyUserImportJobsProvider({ children }) {
  const [jobs, setJobs] = useState([])
  const [panelExpanded, setPanelExpanded] = useState(true)
  const jobsRef = useRef(jobs)
  jobsRef.current = jobs

  const dismissJob = useCallback((jobId) => {
    setJobs((prev) => prev.filter((j) => j.id !== jobId))
  }, [])

  const updateJob = useCallback((jobId, updates) => {
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, ...updates } : j)))
  }, [])

  const hasRunningImport = jobs.some((j) => j.status === "running")

  const startStudyUserImport = useCallback(
    ({ file, studyId, totalRows = 0, onComplete }) => {
      if (!file || !studyId) return false
      if (jobsRef.current.some((j) => j.status === "running")) return false

      const id = generateId()
      const rowCount = totalRows || 0

      setPanelExpanded(true)
      setJobs((prev) => [
        ...prev,
        {
          id,
          label: `Import ${rowCount > 0 ? rowCount.toLocaleString() : ""} CRC user${rowCount === 1 ? "" : "s"}`.trim(),
          status: "running",
          phase: "creating",
          detail: "Starting…",
          progress: {
            phase: "creating",
            processedRows: 0,
            totalRows: rowCount,
            successCount: 0,
            failedCount: 0,
            remainingRows: rowCount,
            emailSentCount: 0,
            emailFailedCount: 0,
            emailTotal: 0,
            emailRemaining: 0,
            percent: 0,
          },
        },
      ])

      void (async () => {
        try {
          const response = await studyUserService.importStudyUsersInBatches(file, studyId, {
            onProgress: (progress) => {
              const percent =
                progress?.phase === "email"
                  ? emailProgressPercent(progress, "running")
                  : progressPercent(progress, "running")
              updateJob(id, {
                phase: progress?.phase || "creating",
                detail: formatImportProgress(progress),
                progress: { ...progress, percent },
              })
            },
          })

          const status = resolveImportStatus(response)
          const successCount = response?.data?.successCount || 0
          const failedCount = response?.data?.failedCount || 0
          const emailSentCount = response?.data?.emailSentCount ?? response?.data?.EmailSentCount ?? 0
          const emailFailedCount = response?.data?.emailFailedCount ?? response?.data?.EmailFailedCount ?? 0
          const newUserCredentials = response?.data?.newUserCredentials || response?.data?.NewUserCredentials || []
          const emailResults = response?.data?.emailResults || response?.data?.EmailResults || []
          const failedRows = response?.data?.failedRows || response?.data?.FailedRows || []

          let detail = response?.message || "Import finished."
          if (status === "done" && failedCount === 0) {
            detail = `${successCount.toLocaleString()} user(s) created successfully.`
          } else if (status === "partial") {
            detail = `${successCount.toLocaleString()} created before import stopped. ${failedCount} failed.`
          } else if (failedCount > 0 && successCount > 0) {
            detail = `${successCount.toLocaleString()} successful, ${failedCount} failed.`
          }

          if (newUserCredentials.length > 0) {
            detail += ` ${newUserCredentials.length} new login(s).`
          }
          if (emailSentCount > 0 || emailFailedCount > 0) {
            detail += ` Emails: ${emailSentCount} sent${emailFailedCount ? `, ${emailFailedCount} failed` : ""}.`
          } else if (newUserCredentials.length > 0) {
            detail += " Export credentials if users did not receive email."
          }

          const totalRows = rowCount || response?.data?.totalRows || successCount + failedCount
          const finalProgress = {
            phase: "done",
            processedRows: totalRows,
            totalRows,
            successCount,
            failedCount,
            remainingRows: 0,
            emailSentCount,
            emailFailedCount,
            emailTotal: newUserCredentials.length,
            emailRemaining: 0,
            newLoginCount: newUserCredentials.length,
            percent: 100,
          }

          updateJob(id, {
            status,
            phase: "done",
            detail,
            progress: finalProgress,
            result: response,
            newUserCredentials,
            failedRows,
            emailResults,
            emailSentCount,
            emailFailedCount,
          })

          if (typeof onComplete === "function") {
            try {
              onComplete(response)
            } catch (e) {
              console.error("Study user import onComplete error:", e)
            }
          }

          if (status === "done" && failedCount === 0) {
            toast.success("CRC user import complete", {
              description: detail,
              duration: 6000,
              className: "border border-emerald-200/90 bg-emerald-50/95 text-slate-800 shadow-sm",
            })
          } else if (status === "partial") {
            toast.warning("CRC user import partially completed", {
              description: detail,
              duration: 7000,
              className: "border border-amber-200/90 bg-amber-50/95 text-slate-800 shadow-sm",
            })
          } else if (successCount > 0 && failedCount > 0) {
            toast.warning("Import finished with errors", {
              description: detail,
              duration: 7000,
              className: "border border-amber-200/90 bg-amber-50/95 text-slate-800 shadow-sm",
            })
          } else {
            toast.error("CRC user import failed", {
              description: detail,
              duration: 7000,
              className: "border border-red-200/90 bg-red-50/95 text-slate-800 shadow-sm",
            })
          }
        } catch (error) {
          console.error("Study user import error:", error)
          const msg = error?.message || "Import failed."
          updateJob(id, { status: "error", phase: "done", detail: msg, progress: null })
          toast.error("CRC user import failed", {
            description: msg,
            duration: 7000,
            className: "border border-red-200/90 bg-red-50/95 text-slate-800 shadow-sm",
          })
        }
      })()

      return true
    },
    [updateJob]
  )

  const doneDismissRef = useRef({})

  useEffect(() => {
    jobs.forEach((job) => {
      if (job.status !== "done") return
      if (job.newUserCredentials?.length > 0) return
      if (job.failedRows?.length > 0) return
      if (doneDismissRef.current[job.id]) return
      doneDismissRef.current[job.id] = setTimeout(() => {
        setJobs((prev) => prev.filter((j) => j.id !== job.id))
        delete doneDismissRef.current[job.id]
      }, DONE_AUTO_DISMISS_MS)
    })
  }, [jobs])

  useEffect(() => {
    return () => {
      Object.values(doneDismissRef.current).forEach(clearTimeout)
      doneDismissRef.current = {}
    }
  }, [])

  const value = {
    jobs,
    hasRunningImport,
    panelExpanded,
    setPanelExpanded,
    startStudyUserImport,
    dismissJob,
  }

  return (
    <StudyUserImportJobsContext.Provider value={value}>
      {children}
      <StudyUserImportJobsFloatingPopup />
    </StudyUserImportJobsContext.Provider>
  )
}

function StatChip({ label, value, tone = "slate" }) {
  const toneClass =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-800 border-emerald-100"
      : tone === "amber"
        ? "bg-amber-50 text-amber-900 border-amber-100"
        : tone === "sky"
          ? "bg-sky-50 text-sky-800 border-sky-100"
          : "bg-slate-50 text-slate-700 border-slate-100"

  return (
    <div className={cn("rounded-lg border px-2.5 py-1.5 text-center", toneClass)}>
      <p className="text-[10px] font-medium uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-sm font-bold tabular-nums">{value}</p>
    </div>
  )
}

function PhaseProgressBlock({ title, icon: Icon, progress, isActive, note, statLabels, percentOverride }) {
  const percent = percentOverride ?? progress?.percent ?? 0
  const showBar = isActive || percent > 0
  const doneLabel = statLabels?.done ?? "Done"
  const remainingLabel = statLabels?.remaining ?? "Remaining"
  const failedLabel = statLabels?.failed ?? "Failed"

  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3">
      <div className="mb-2 flex items-center gap-2">
        {isActive ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-600" />
        ) : (
          <Icon className="h-4 w-4 shrink-0 text-emerald-600" />
        )}
        <p className="text-xs font-semibold text-slate-800">{title}</p>
      </div>
      {progress ? (
        <div className="mb-2 grid grid-cols-3 gap-2">
          <StatChip
            label={doneLabel}
            value={(progress.successCount ?? progress.processedRows ?? 0).toLocaleString()}
            tone="emerald"
          />
          <StatChip
            label={remainingLabel}
            value={(progress.remainingRows ?? Math.max(0, (progress.totalRows || 0) - (progress.processedRows || 0))).toLocaleString()}
            tone="sky"
          />
          <StatChip label={failedLabel} value={(progress.failedCount ?? 0).toLocaleString()} tone="amber" />
        </div>
      ) : null}
      {showBar ? (
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}
      {note ? <p className="mt-2 text-[11px] leading-snug text-slate-500">{note}</p> : null}
    </div>
  )
}

function StudyUserImportJobRow({ job, showCredentialsExport, onDismiss, onExportCredentials, onExportReport }) {
  const isRunning = job.status === "running"
  const progress = job.progress
  const newLoginCount = progress?.newLoginCount ?? job.newUserCredentials?.length ?? 0
  const emailSent = progress?.emailSentCount ?? job.emailSentCount ?? 0
  const emailFailed = progress?.emailFailedCount ?? job.emailFailedCount ?? 0
  const emailTotal = progress?.emailTotal ?? newLoginCount
  const emailRemaining =
    progress?.emailRemaining ?? Math.max(0, emailTotal - emailSent - emailFailed)
  const emailPercent = emailProgressPercent(
    { ...progress, emailSentCount: emailSent, emailFailedCount: emailFailed, emailTotal },
    isRunning ? "running" : "done",
  )
  const emailProgress =
    emailTotal > 0 || emailSent > 0 || emailFailed > 0
      ? {
          successCount: emailSent,
          failedCount: emailFailed,
          remainingRows: emailRemaining,
          totalRows: emailTotal,
          processedRows: emailSent + emailFailed,
          percent: emailPercent,
        }
      : null
  const canExportReport = !isRunning && (job.failedRows?.length > 0 || job.newUserCredentials?.length > 0)

  return (
    <div
      className={cn(
        "rounded-xl border p-3 transition-all duration-300",
        isRunning && "border-slate-200 bg-white",
        job.status === "done" && "border-emerald-200 bg-emerald-50/40",
        job.status === "partial" && "border-amber-200 bg-amber-50/40",
        job.status === "error" && "border-red-200 bg-red-50/40",
      )}
    >
      <div className="mb-3 flex items-start gap-2">
        <div className="mt-0.5 shrink-0">
          {isRunning && <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />}
          {job.status === "done" && <CheckCircle className="h-4 w-4 text-emerald-600" />}
          {job.status === "partial" && <UserPlus className="h-4 w-4 text-amber-600" />}
          {job.status === "error" && <XCircle className="h-4 w-4 text-red-600" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{job.label}</p>
          {job.detail ? (
            <p className="mt-1 text-[11px] leading-snug text-slate-600">{job.detail}</p>
          ) : null}
        </div>
        {!isRunning && onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="space-y-2.5">
        <PhaseProgressBlock
          title="Phase 1 — Creating users"
          icon={UserPlus}
          progress={progress}
          isActive={isRunning && job.phase === "creating"}
          percentOverride={
            progress?.totalRows > 0
              ? Math.min(100, Math.round((progress.processedRows / progress.totalRows) * 100))
              : progress?.percent ?? 0
          }
        />
        <PhaseProgressBlock
          title="Phase 2 — Credential emails"
          icon={Mail}
          progress={emailProgress}
          isActive={isRunning && job.phase === "email"}
          statLabels={{ done: "Sent", remaining: "Remaining", failed: "Failed" }}
          percentOverride={emailPercent}
          note={
            isRunning && emailTotal === 0
              ? "Emails run after each batch when new logins are created."
              : emailTotal > 0
                ? isRunning
                  ? `Sending credentials for ${emailTotal} new login(s).`
                  : `${emailSent} sent${emailFailed ? `, ${emailFailed} failed` : ""}. Export report or credentials below.`
                : "No new login accounts in this import."
          }
        />
      </div>

      {canExportReport ? (
        <button
          type="button"
          onClick={onExportReport}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Download Excel report
        </button>
      ) : null}

      {showCredentialsExport && !isRunning && job.newUserCredentials?.length > 0 ? (
        <button
          type="button"
          onClick={onExportCredentials}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
        >
          <Download className="h-3.5 w-3.5" />
          Export {job.newUserCredentials.length} credential(s)
        </button>
      ) : null}

      {isRunning ? (
        <p className="mt-3 text-[10px] leading-snug text-slate-500">
          Keep this browser tab open. You may minimize this panel and continue working — progress stays in the corner.
        </p>
      ) : null}
    </div>
  )
}

function StudyUserImportJobsFloatingPopup() {
  const { jobs, dismissJob, panelExpanded, setPanelExpanded } = useContext(StudyUserImportJobsContext)
  const showCredentialsExport = isSuperAdminUser(authService.getUser())

  if (!jobs?.length) return null

  const runningJob = jobs.find((j) => j.status === "running")
  const primaryJob = runningJob || jobs[jobs.length - 1]
  const percent = progressPercent(primaryJob?.progress, primaryJob?.status)
  const processed = primaryJob?.progress?.processedRows ?? 0
  const total = primaryJob?.progress?.totalRows ?? 0

  const handleExportCredentials = (job) => {
    const stamp = new Date().toISOString().split("T")[0]
    downloadStudyUserCredentialsCsv(job.newUserCredentials, `study-user-credentials-${stamp}.csv`)
  }

  const handleExportReport = (job) => {
    const stamp = new Date().toISOString().split("T")[0]
    const data = job.result?.data || {}
    downloadStudyUserImportReportWorkbook(
      {
        summary: {
          totalRows: job.progress?.totalRows ?? data.totalRows ?? 0,
          successCount: job.progress?.successCount ?? data.successCount ?? 0,
          failedCount: job.progress?.failedCount ?? data.failedCount ?? 0,
          emailSentCount: job.emailSentCount ?? data.emailSentCount ?? data.EmailSentCount ?? 0,
          emailFailedCount: job.emailFailedCount ?? data.emailFailedCount ?? data.EmailFailedCount ?? 0,
          newLoginCount: job.newUserCredentials?.length ?? 0,
        },
        failedRows: job.failedRows || data.failedRows || data.FailedRows || [],
        newUserCredentials: job.newUserCredentials || [],
      },
      `crc-import-report-${stamp}.xlsx`,
    )
  }

  if (!panelExpanded) {
    return (
      <button
        type="button"
        onClick={() => setPanelExpanded(true)}
        className="fixed bottom-6 left-6 z-[10000] flex max-w-[min(18rem,calc(100vw-2rem))] items-center gap-3 rounded-2xl border border-emerald-200/90 bg-white/95 px-3.5 py-2.5 shadow-[0_16px_40px_-16px_rgba(15,23,42,0.35)] backdrop-blur-md transition hover:border-emerald-300"
        data-study-user-import-popup
        aria-live="polite"
        aria-label="Expand CRC user import progress"
      >
        {runningJob ? (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-emerald-600" />
        ) : (
          <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />
        )}
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-xs font-semibold text-slate-800">
            {runningJob ? "CRC import running" : "CRC import finished"}
          </p>
          <p className="text-[11px] tabular-nums text-slate-500">
            {total > 0 ? `${processed} / ${total} · ${percent}%` : primaryJob?.detail || "Tap to view"}
          </p>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 -rotate-90 text-slate-400" />
      </button>
    )
  }

  return (
    <div
      className="fixed bottom-6 left-6 z-[10000] flex w-[min(26rem,calc(100vw-2rem))] max-h-[min(80dvh,36rem)] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white/98 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.4)] backdrop-blur-md"
      data-study-user-import-popup
      aria-live="polite"
      aria-label="CRC user import progress"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-emerald-100/80 bg-gradient-to-r from-violet-50 via-emerald-50/70 to-teal-50/50 px-3.5 py-3">
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-800">
          <Upload className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="truncate">CRC bulk import</span>
        </span>
        <button
          type="button"
          onClick={() => setPanelExpanded(false)}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
          title="Minimize to corner (import continues in background)"
        >
          <Minimize2 className="h-3.5 w-3.5" />
          Minimize
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {jobs.map((job) => (
          <StudyUserImportJobRow
            key={job.id}
            job={job}
            showCredentialsExport={showCredentialsExport}
            onDismiss={job.status !== "running" ? () => dismissJob(job.id) : undefined}
            onExportCredentials={() => handleExportCredentials(job)}
            onExportReport={() => handleExportReport(job)}
          />
        ))}
      </div>
    </div>
  )
}

export function useStudyUserImportJobs() {
  const ctx = useContext(StudyUserImportJobsContext)
  if (!ctx) {
    throw new Error("useStudyUserImportJobs must be used within StudyUserImportJobsProvider")
  }
  return ctx
}
