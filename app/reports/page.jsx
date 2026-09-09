"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { authService } from "@/lib/services"
import useWorkspaceStudyId from "@/hooks/useWorkspaceStudyId"
import useStudySitePermissions from "@/hooks/useStudySitePermissions"
import { resolveVisibleReportRoutes } from "@/lib/reports/resolveVisibleReportRoutes"

/**
 * Reports index: redirect to first report allowed by study matrix (when ON) or global menu.
 */
export default function ReportsPage() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const workspaceStudyId = useWorkspaceStudyId()
  const {
    can,
    permissions,
    matrixLoadedFromApi,
    studyUsesRolePermissionMatrix,
  } = useStudySitePermissions(workspaceStudyId, null)

  const matrixActive = Boolean(studyUsesRolePermissionMatrix && matrixLoadedFromApi)

  useEffect(() => {
    setMounted(true)
  }, [])

  const visibleReports = useMemo(() => {
    if (!mounted) return []
    return resolveVisibleReportRoutes({
      loginMenu: authService.getMenu?.(),
      matrixActive,
      can,
      permissions,
    })
  }, [mounted, matrixActive, can, permissions])

  useEffect(() => {
    if (!mounted) return
    const firstRoute = visibleReports[0]?.href
    if (firstRoute) {
      router.replace(firstRoute)
    }
  }, [mounted, router, visibleReports])

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-slate-500">Loading…</p>
      </div>
    )
  }

  if (!visibleReports.length) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-slate-500">No reports available for your account on this study.</p>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <p className="text-slate-500">Redirecting to Reports…</p>
    </div>
  )
}
