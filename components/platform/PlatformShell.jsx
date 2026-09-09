"use client"

import { useEffect, useMemo, useState } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { useWorkspaceStudyLabel } from "@/hooks/useWorkspaceStudyLabel"
import { studyService } from "@/lib/services"
import { useStudySiteContext } from "@/hooks/useStudySiteContext"
import { applyDashboardStudyContext } from "@/lib/dashboard/dashboardMetricLens"
import SearchableSelect from "@/components/ui/searchable-select"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Layers, Loader2 } from "lucide-react"
import {
  getContextNavForPath,
  isPlatformNavActive,
  PLATFORM_CARD,
  PLATFORM_CARD_PAD,
  PLATFORM_ICON_CHIP,
  PLATFORM_PAGE_SHELL,
  PLATFORM_PREVIEW_BANNER,
  PLATFORM_PREVIEW_ENABLED,
  PLATFORM_SUB_NAV,
  PLATFORM_SUB_NAV_ITEM,
  PLATFORM_SUB_NAV_ITEM_ACTIVE,
  PLATFORM_SUB_NAV_ITEM_INACTIVE,
} from "@/lib/platform/platformUi"
import { cn } from "@/lib/utils"

function studyOptionId(study) {
  return study?.studyId ?? study?.StudyId ?? study?.id ?? study?.Id ?? null
}

function studyOptionLabel(study) {
  const protocol =
    study?.studyProtocolNumber ||
    study?.protocolNumber ||
    study?.name ||
    study?.projectName ||
    study?.code
  const title = study?.studyTitle || study?.StudyTitle
  const id = studyOptionId(study)
  if (protocol && title) return `${protocol} — ${title}`
  if (protocol) return String(protocol)
  if (title) return String(title)
  return id ? `Study #${id}` : "Study"
}

export default function PlatformShell({ title, description, children }) {
  const pathname = usePathname()
  const contextNav = useMemo(() => getContextNavForPath(pathname), [pathname])
  const { studyId, ready: workspaceReady } = useStudySiteContext()
  const studyLabel = useWorkspaceStudyLabel(studyId)
  const [studies, setStudies] = useState([])
  const [loadingStudies, setLoadingStudies] = useState(false)

  useEffect(() => {
    if (studyId || !workspaceReady) return
    let alive = true
    setLoadingStudies(true)
    studyService
      .getStudiesForDropdown()
      .then((res) => {
        if (!alive) return
        const rows = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []
        setStudies(rows)
      })
      .catch(() => {
        if (alive) setStudies([])
      })
      .finally(() => {
        if (alive) setLoadingStudies(false)
      })
    return () => {
      alive = false
    }
  }, [studyId, workspaceReady])

  const studyOptions = useMemo(
    () =>
      studies
        .map((s) => {
          const id = studyOptionId(s)
          if (!id) return null
          return { value: String(id), label: studyOptionLabel(s) }
        })
        .filter(Boolean),
    [studies],
  )

  if (!PLATFORM_PREVIEW_ENABLED) {
    return (
      <DashboardLayout>
        <div className={PLATFORM_PAGE_SHELL}>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
            Clinical Platform preview is disabled. Set{" "}
            <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_PLATFORM_PREVIEW=true</code> in{" "}
            <code className="rounded bg-amber-100 px-1">.env.local</code> to access enterprise modules.
            Existing EDC behavior is unchanged.
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className={PLATFORM_PAGE_SHELL}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className={PLATFORM_ICON_CHIP}>
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
              {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
            </div>
          </div>
          {studyLabel ? (
            <span className="text-sm text-slate-500">Study: {studyLabel}</span>
          ) : loadingStudies ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          ) : studyOptions.length ? (
            <div className="w-full sm:w-72">
              <SearchableSelect
                placeholder="Select study…"
                options={studyOptions}
                value=""
                onChange={(val) => {
                  const study = studies.find((s) => String(studyOptionId(s)) === String(val))
                  if (study) applyDashboardStudyContext(study)
                }}
              />
            </div>
          ) : null}
        </div>

        <div className={PLATFORM_PREVIEW_BANNER}>
          Preview module — all enterprise flags default <strong>off</strong>. No changes to EDC, eCRF,
          queries, or eCONSENT until you explicitly enable modules for a study.
        </div>

        {contextNav.length > 1 ? (
          <nav className={PLATFORM_SUB_NAV} aria-label="Platform section">
            {contextNav.map((item) => {
              const active = isPlatformNavActive(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    PLATFORM_SUB_NAV_ITEM,
                    active ? PLATFORM_SUB_NAV_ITEM_ACTIVE : PLATFORM_SUB_NAV_ITEM_INACTIVE,
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        ) : null}

        <div className={cn(PLATFORM_CARD, PLATFORM_CARD_PAD)}>{children}</div>
      </div>
    </DashboardLayout>
  )
}
