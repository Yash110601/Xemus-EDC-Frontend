"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { FileArchive, FileDown, Loader2, CheckCircle, XCircle, X } from "lucide-react"
import { cn } from "@/lib/utils"
import reportsService from "@/lib/services/reports.service"
import {
  downloadEcrfDetailsPdfZip,
  ECRF_EXPORT_NO_DATA_CODE,
} from "@/lib/utils/ecrfDetailsPdfZipExport"

const ReportExportJobsContext = createContext(null)

const DONE_AUTO_DISMISS_MS = 8000

function generateId() {
  return `re-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function isZipKind(kind) {
  const k = (kind || "").toLowerCase()
  return k.includes("zip") || k.includes("pdf-zip")
}

export function ReportExportJobsProvider({ children }) {
  const [jobs, setJobs] = useState([])

  const dismissJob = useCallback((jobId) => {
    setJobs((prev) => prev.filter((j) => j.id !== jobId))
  }, [])

  const updateJob = useCallback((jobId, updates) => {
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, ...updates } : j)))
  }, [])

  /**
   * Generic background report export. `task(setDetail)` is awaited; call `setDetail(msg)` for progress text.
   * Success/error toasts + floating row use a soft visual style.
   */
  const startReportExport = useCallback(
    ({ kind, label, task }) => {
      if (typeof task !== "function") return

      const id = generateId()
      setJobs((prev) => [
        ...prev,
        {
          id,
          kind,
          label,
          status: "running",
          detail: "Starting…",
        },
      ])

      const setDetail = (msg) => {
        if (msg != null && msg !== "") updateJob(id, { detail: String(msg) })
      }

      void (async () => {
        try {
          await task(setDetail)
          updateJob(id, { status: "done", detail: "Complete — check your downloads folder" })
          const isAnnotatedBlankCrfPdf = (kind || "").toLowerCase() === "crf-annotated-pdf"
          toast.success(label, {
            description: isAnnotatedBlankCrfPdf
              ? "Annotated blank CRF downloaded successfully!"
              : "Your export finished. You can keep working — the file should appear in your downloads.",
            duration: 5500,
            className: isAnnotatedBlankCrfPdf
              ? "border border-emerald-200/90 bg-emerald-50/95 text-slate-800 shadow-sm"
              : "border border-emerald-200/90 bg-emerald-50/95 text-slate-800 shadow-sm",
          })
        } catch (e) {
          if (e?.code === ECRF_EXPORT_NO_DATA_CODE) {
            const msg =
              e?.message ||
              "No submitted CRF data found for selected filters. Try changing filters and export again."
            updateJob(id, { status: "done", detail: msg })
            toast.warning("No data to export", {
              description: msg,
              duration: 6000,
              className: "border border-amber-200/90 bg-amber-50/95 text-slate-800 shadow-sm",
            })
            return
          }
          console.error("Report export error:", e)
          const msg = e?.message || "Export failed."
          updateJob(id, { status: "error", detail: msg })
          toast.error("Export didn’t finish", {
            description: msg,
            duration: 6000,
            className: "border border-red-200/90 bg-red-50/95 text-slate-800 shadow-sm",
          })
        }
      })()
    },
    [updateJob]
  )

  const startEcrfCsvExport = useCallback(
    (params) =>
      startReportExport({
        kind: "ecrf-csv",
        label: "eCRF details (CSV)",
        task: async (setDetail) => {
          setDetail("Requesting file from server…")
          await reportsService.exportEcrfDetailsReport(params)
        },
      }),
    [startReportExport]
  )

  const startEcrfPdfZipExport = useCallback(
    (filters) =>
      startReportExport({
        kind: "ecrf-pdf-zip",
        label: "eCRF details (PDF ZIP)",
        task: async (setDetail) => {
          setDetail("Preparing ZIP…")
          await downloadEcrfDetailsPdfZip(filters, {
            onProgress: ({ message }) => {
              if (message) setDetail(message)
            },
          })
        },
      }),
    [startReportExport]
  )

  const doneDismissRef = useRef({})

  useEffect(() => {
    jobs.forEach((job) => {
      if (job.status !== "done") return
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
    startReportExport,
    startEcrfCsvExport,
    startEcrfPdfZipExport,
    dismissJob,
  }

  return (
    <ReportExportJobsContext.Provider value={value}>
      {children}
      <ReportExportJobsFloatingPopup />
    </ReportExportJobsContext.Provider>
  )
}

/** Shared card: job list + header (used by floating and inline layouts). */
function ReportExportJobsCard({ listMaxHeightClass = "max-h-[260px]" }) {
  const { jobs, dismissJob } = useContext(ReportExportJobsContext)
  if (!jobs?.length) return null

  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-lg shadow-slate-900/5">
      <div className="border-b border-emerald-100/80 bg-gradient-to-r from-sky-50 via-emerald-50/70 to-teal-50/50 px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <FileDown className="h-4 w-4 shrink-0 text-emerald-600" />
          Report export (background)
        </span>
      </div>
      <div className={cn("overflow-y-auto bg-white p-2.5", listMaxHeightClass)}>
        {jobs.map((job) => (
          <div
            key={job.id}
            className={cn(
              "mb-2 flex items-start gap-2 rounded-lg border p-2.5 last:mb-0 transition-all duration-300",
              job.status === "running" && "border-slate-200 bg-slate-50/80",
              job.status === "done" &&
                "border-emerald-200 bg-emerald-50/80 shadow-sm",
              job.status === "error" && "border-red-200 bg-red-50/70",
            )}
          >
            <div className="flex-shrink-0 mt-0.5">
              {job.status === "running" && (
                <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
              )}
              {job.status === "done" && <CheckCircle className="w-4 h-4 text-emerald-600" />}
              {job.status === "error" && <XCircle className="w-4 h-4 text-red-600" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-xs font-semibold text-slate-800">
                {isZipKind(job.kind) ? (
                  <FileArchive className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                ) : (
                  <FileDown className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                )}
                <span className="truncate">{job.label}</span>
              </p>
              {job.detail && (
                <p className="mt-1 break-words text-[11px] leading-snug text-slate-500">
                  {job.detail}
                </p>
              )}
            </div>
            {job.status !== "running" && (
              <button
                type="button"
                onClick={() => dismissJob(job.id)}
                className="flex-shrink-0 p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Fixed bottom-right — same jobs on every screen while the app stays loaded.
 * Lives in root layout provider, so client-side navigation does not clear running exports.
 */
function ReportExportJobsFloatingPopup() {
  const { jobs } = useContext(ReportExportJobsContext)
  if (!jobs?.length) return null

  return (
    <div
      className="fixed bottom-24 right-6 z-[10000] flex w-[320px] max-w-[calc(100vw-2rem)] flex-col gap-2"
      data-report-export-popup
      aria-live="polite"
      aria-label="Background report exports"
    >
      <ReportExportJobsCard />
    </div>
  )
}

/**
 * Inline panel for pages that embed export status in the layout (e.g. below filters).
 * Renders nothing when there are no jobs.
 */
export function ReportExportJobsInlinePanel({ className, listMaxHeightClass }) {
  const { jobs } = useContext(ReportExportJobsContext)
  if (!jobs?.length) return null

  return (
    <div
      className={cn(
        "w-full max-w-[min(320px,calc(100vw-3rem))] shrink-0",
        className,
      )}
      data-report-export-inline-panel
    >
      <ReportExportJobsCard
        listMaxHeightClass={listMaxHeightClass ?? "max-h-[260px]"}
      />
    </div>
  )
}

export function useReportExportJobs() {
  const ctx = useContext(ReportExportJobsContext)
  if (!ctx) {
    throw new Error("useReportExportJobs must be used within ReportExportJobsProvider")
  }
  return ctx
}
