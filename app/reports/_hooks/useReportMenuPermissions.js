"use client"

/**
 * @deprecated Prefer useReportExportAccess — provides assertCanExport, runExport, and registry integration.
 */
import { useReportExportAccess } from "@/app/reports/_hooks/useReportExportAccess"

export function useReportMenuPermissions(reportCode) {
  const access = useReportExportAccess(reportCode)
  return {
    canView: access.canView,
    canExport: access.canExport,
  }
}
