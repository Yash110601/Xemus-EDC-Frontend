"use client"

import { isReportPermissionDebugEnabled } from "@/lib/reports/reportPermissionDebug"

/**
 * Renders export actions only when role menu grants Export.
 * Wrap CSV / PDF / ZIP buttons — do not duplicate `{canExport && ...}` per page.
 *
 * @example
 * <ReportExportGate canExport={canExport} reportKey={reportKey}>
 *   <Button onClick={handleExportCsv}>Export CSV</Button>
 * </ReportExportGate>
 */
export default function ReportExportGate({ canExport, reportKey, children, className }) {
  if (!canExport) {
    if (isReportPermissionDebugEnabled() && reportKey) {
      return (
        <span
          className="sr-only"
          data-report-export-gate="denied"
          data-report-key={reportKey}
        />
      )
    }
    return null
  }

  if (!children) return null

  return (
    <div
      className={className || "contents"}
      data-report-export-gate="allowed"
      data-report-key={reportKey || undefined}
    >
      {children}
    </div>
  )
}
