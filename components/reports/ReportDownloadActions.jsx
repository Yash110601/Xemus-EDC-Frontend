"use client"

import ReportDownloadDialog from "@/components/reports/ReportDownloadDialog"
import ReportExportGate from "@/components/reports/ReportExportGate"
import { useReportDownloadDialog } from "@/hooks/useReportDownloadDialog"
import { Button } from "@/components/ui/button"
import { Download, Loader2 } from "lucide-react"
import { useCallback } from "react"
import { toast } from "sonner"

/** Formats typically supported by backend report export endpoints (CSV/PDF). */
export const REPORT_CSV_PDF_FORMATS = ["csv", "pdf"]

/** eCRF details: CSV listing + PDF ZIP of submitted CRFs. */
export const REPORT_CSV_ZIP_FORMATS = ["csv", "zip"]

/** All format tiles (Total Subjects / client-side exports). */
export const REPORT_ALL_FORMATS = ["csv", "html", "excel", "pdf"]

/**
 * Drop-in Download button + format/email dialog for report pages.
 *
 * `onExport({ format, ... })` should run the existing export (job or await).
 * Formats not listed in `enabledFormats` appear as "Soon" in the dialog.
 */
export default function ReportDownloadActions({
  canExport,
  reportKey,
  assertCanExport,
  defaultSubject = "Report",
  defaultFormat = "pdf",
  enabledFormats = ["csv", "pdf"],
  disabled = false,
  busy = false,
  buttonLabel = "Download",
  buttonClassName = "bg-emerald-700 text-white hover:bg-emerald-800",
  onExport,
}) {
  const runExport = useCallback(
    async (opts) => {
      const { format } = opts || {}
      if (!enabledFormats.includes(format)) {
        toast.message("Format coming soon", {
          description: `${String(format || "").toUpperCase()} export is not available for this report yet.`,
        })
        return undefined
      }
      return onExport?.(opts)
    },
    [enabledFormats, onExport],
  )

  const { downloadOpen, setDownloadOpen, downloading, openDownload, handleDownload } =
    useReportDownloadDialog({
      assertCanExport,
      onExport: runExport,
      closeOnStart: true,
    })

  return (
    <>
      <ReportExportGate canExport={canExport} reportKey={reportKey}>
        <Button
          type="button"
          onClick={openDownload}
          disabled={disabled || busy || downloading}
          className={buttonClassName}
        >
          {busy || downloading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Download className="mr-2 h-4 w-4" aria-hidden />
          )}
          {buttonLabel}
        </Button>
      </ReportExportGate>
      <ReportDownloadDialog
        open={downloadOpen}
        onOpenChange={setDownloadOpen}
        title="Download"
        defaultSubject={defaultSubject}
        defaultFormat={
          enabledFormats.includes(defaultFormat) ? defaultFormat : enabledFormats[0] || "pdf"
        }
        enabledFormats={enabledFormats}
        canExport={canExport}
        downloading={downloading || busy}
        onDownload={handleDownload}
      />
    </>
  )
}
