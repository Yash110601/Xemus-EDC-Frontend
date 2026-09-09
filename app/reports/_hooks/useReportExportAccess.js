"use client"

import { useCallback, useMemo, useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { toast } from "sonner"
import { authService } from "@/lib/services"
import { resolveReportDefinition } from "@/lib/reports/reportRegistry"
import {
  logExportDenied,
  REPORT_EXPORT_DENIED_MESSAGE,
  resolveReportMenuPermissions,
} from "@/lib/reports/reportMenuPermissions"
import { useStudySiteContext } from "@/hooks/useStudySiteContext"
import useStudySitePermissions from "@/hooks/useStudySitePermissions"
import { coalesceStudyPermission, STUDY_PERMISSION } from "@/lib/permissions/coalesceStudyPermission"
import { buildNavModuleActionKey } from "@/lib/permissions/studyNavModuleKeys"
import { withStudyWorkspaceParams } from "@/lib/reports/withStudyWorkspaceParams"

const EMPTY_PERMISSIONS = {
  canExport: false,
  canView: false,
  source: "no-menu-match",
  matchedSubFeature: null,
  reportKey: null,
}

/**
 * Single entry point for report export permission on any report page.
 *
 * Permissions are resolved client-side only (after mount) to avoid
 * SSR/hydration mismatch — authService.getMenu() reads from localStorage
 * which is unavailable during server render.
 *
 * @param {string} [reportCode] - Optional menu/registry code override
 */
export function useReportExportAccess(reportCode) {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const { studyId, siteId, ready } = useStudySiteContext()
  const studyPerms = useStudySitePermissions(studyId, null)

  const withWorkspace = useCallback(
    (params = {}) => withStudyWorkspaceParams(params, { studyId, siteId }),
    [studyId, siteId],
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  const reportDef = useMemo(
    () => resolveReportDefinition(pathname, reportCode),
    [pathname, reportCode]
  )

  // Only resolve real permissions after mount to match server render (canExport=false)
  const permissions = useMemo(() => {
    if (!mounted) return EMPTY_PERMISSIONS
    return resolveReportMenuPermissions(authService.getMenu?.(), pathname, reportCode || reportDef?.code)
  }, [mounted, pathname, reportCode, reportDef?.code])

  const navViewKey = useMemo(
    () => (reportDef?.code ? buildNavModuleActionKey(reportDef.code, "view") : null),
    [reportDef?.code],
  )

  const navExportKey = useMemo(
    () => (reportDef?.code ? buildNavModuleActionKey(reportDef.code, "export") : null),
    [reportDef?.code],
  )

  const canExport = useMemo(() => {
    const matrixExport = navExportKey ? studyPerms.can(navExportKey) : null
    const legacyExport = coalesceStudyPermission(
      studyPerms.can(STUDY_PERMISSION.REPORT_EXPORT),
      permissions.canExport,
    )
    return coalesceStudyPermission(matrixExport, legacyExport)
  }, [
    studyPerms.can,
    studyPerms.matrixLoadedFromApi,
    studyPerms.permissions,
    permissions.canExport,
    navExportKey,
  ])

  const canView = useMemo(() => {
    const matrixView = navViewKey ? studyPerms.can(navViewKey) : null
    const legacyView = coalesceStudyPermission(
      studyPerms.can(STUDY_PERMISSION.REPORT_VIEW),
      permissions.canView,
    )
    return coalesceStudyPermission(matrixView, legacyView)
  }, [
    studyPerms.can,
    studyPerms.matrixLoadedFromApi,
    studyPerms.permissions,
    permissions.canView,
    navViewKey,
  ])

  const assertCanExport = useCallback(() => {
    if (canExport) return true
    logExportDenied(permissions, { pathname, action: "assertCanExport" })
    toast.error(REPORT_EXPORT_DENIED_MESSAGE)
    return false
  }, [pathname, permissions, canExport])

  /**
   * Runs export task only when permitted. Returns true if task ran.
   * @param {() => void | Promise<void>} task
   */
  const runExport = useCallback(
    async (task) => {
      if (!assertCanExport()) return false
      await task()
      return true
    },
    [assertCanExport]
  )

  return {
    canExport,
    canView,
    reportKey: permissions.reportKey || reportDef?.key || null,
    reportLabel: reportDef?.label || permissions.matchedSubFeature?.name || null,
    matchedSubFeature: permissions.matchedSubFeature,
    permissionSource: permissions.source,
    matrixEnforced: !studyPerms.useLegacyPermissions,
    studyId,
    siteId,
    ready,
    withWorkspace,
    assertCanExport,
    runExport,
  }
}
