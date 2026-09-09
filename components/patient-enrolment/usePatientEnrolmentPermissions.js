"use client"

import { useMemo } from "react"
import { usePathname } from "next/navigation"
import { authService } from "@/lib/services"
import { resolveRouteMenuPermissions } from "@/lib/utils/menuRoutePermissions"

function normalizeRole(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
}

export function usePatientEnrolmentPermissions() {
  const pathname = usePathname()
  const currentUser = authService.getUser()
  const role = normalizeRole(currentUser?.roleName)
  const roleCode = normalizeRole(currentUser?.roleCode)

  const isSuperAdmin = role === "SUPERADMIN" || roleCode === "SUPERADMIN"
  const isAdminOrSuperAdmin = role === "ADMIN" || role === "SUPERADMIN"

  const routePerm = useMemo(
    () => resolveRouteMenuPermissions(authService.getMenu?.(), pathname),
    [pathname],
  )

  return {
    isSuperAdmin,
    isAdminOrSuperAdmin,
    canEditEnrolment: isAdminOrSuperAdmin || routePerm.canEdit,
    canDeleteEnrolment: isSuperAdmin,
    canExportEnrolment: isAdminOrSuperAdmin || routePerm.canExport,
  }
}
