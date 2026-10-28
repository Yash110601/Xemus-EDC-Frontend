"use client"

import { useEffect, useMemo, useState } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { useStudyEConsentRequired } from "@/hooks/useStudyEConsentRequired"
import { useWorkspaceStudyLabel } from "@/hooks/useWorkspaceStudyLabel"
import { studyService } from "@/lib/services"
import { applyDashboardStudyContext } from "@/lib/dashboard/dashboardMetricLens"
import SearchableSelect from "@/components/ui/searchable-select"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileSignature, Loader2 } from "lucide-react"
import {
  EC_CARD,
  EC_CARD_PAD,
  EC_EMPTY,
  EC_FIELD,
  EC_PAGE_SHELL,
  MODULE_NAV,
} from "@/lib/econsent/econsentUi"
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

function EConsentShellInner({ title, description, children }) {
  const pathname = usePathname()
  const { studyId, isEConsentRequired, loading } = useStudyEConsentRequired()
  const studyLabel = useWorkspaceStudyLabel(studyId)
  const [studies, setStudies] = useState([])
  const [loadingStudies, setLoadingStudies] = useState(false)

  useEffect(() => {
    if (studyId) return
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
  }, [studyId])

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

  const handleStudyPick = (value) => {
    const id = String(value || "")
    const study = studies.find((s) => String(studyOptionId(s)) === id)
    if (!study) return
    applyDashboardStudyContext(study)
  }

  return (
    <div className={EC_PAGE_SHELL}>
      <header className="mb-5 sm:mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex items-start gap-3">
            <div className="mt-0.5 shrink-0 rounded-xl bg-emerald-100 p-2.5 text-emerald-700">
              <FileSignature className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700/80">
                eCONSENT
              </p>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
              {description ? (
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">{description}</p>
              ) : null}
            </div>
          </div>
          {studyId ? (
            <div className="rounded-xl border border-slate-200/80 bg-white px-3 py-2 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Study</p>
              <p className="max-w-[280px] truncate text-sm font-semibold text-slate-900">
                {studyLabel || `Study #${studyId}`}
              </p>
            </div>
          ) : null}
        </div>

        {!loading && studyId ? (
          <nav
            className="mt-5 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/90 p-1.5 shadow-sm backdrop-blur"
            aria-label="eCONSENT sections"
          >
            {MODULE_NAV.map((link) => {
              const active = pathname === link.href || pathname?.startsWith(`${link.href}/`)
              return (
                <Link
                  key={link.href}
                  href={`${link.href}?studyId=${encodeURIComponent(studyId)}`}
                  className={cn(
                    "min-w-[7.5rem] flex-1 rounded-xl px-3 py-2.5 text-center transition-all",
                    active
                      ? "bg-violet-600 text-white shadow-md shadow-violet-900/15"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                  )}
                >
                  <span className="block text-xs font-semibold sm:text-sm">{link.label}</span>
                  <span
                    className={cn(
                      "mt-0.5 hidden text-[10px] sm:block",
                      active ? "text-emerald-50/90" : "text-slate-400",
                    )}
                  >
                    {link.hint}
                  </span>
                </Link>
              )
            })}
          </nav>
        ) : null}
      </header>

      {loading ? (
        <div className={`${EC_CARD} flex items-center justify-center gap-2 p-10 text-slate-600`}>
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
          <span className="text-sm font-medium">Loading study context…</span>
        </div>
      ) : null}

      {!loading && studyId && isEConsentRequired === false ? (
        <div className="mb-5 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50/40 px-5 py-4">
          <p className="text-sm font-semibold text-amber-950">eCONSENT is not required for this study yet</p>
          <p className="mt-1 text-sm text-amber-900/80">
            You can still configure forms and rules. Turn on <strong>eCONSENT required</strong> in Study
            Settings to enforce consent before enrollment / eCRF.
          </p>
          <Link
            href={`/study-management/study-settings?studyId=${encodeURIComponent(studyId)}`}
            className="mt-2 inline-block text-sm font-semibold text-emerald-800 hover:text-emerald-950"
          >
            Open Study Settings →
          </Link>
        </div>
      ) : null}

      {!loading && studyId ? children : null}

      {!loading && !studyId ? (
        <div className={EC_CARD_PAD}>
          <div className={EC_EMPTY}>
            <div className="mb-2 rounded-2xl bg-emerald-50 p-4 text-emerald-700">
              <FileSignature className="h-8 w-8" />
            </div>
            <p className="text-base font-semibold text-slate-900">Select a study to manage eCONSENT</p>
            <p className="max-w-md text-sm text-slate-500">
              Choose a study below, or use the study selector in the top header.
            </p>
            <div className="mt-4 w-full max-w-lg text-left">
              {loadingStudies ? (
                <div className="flex items-center justify-center gap-2 py-3 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading studies…
                </div>
              ) : (
                <SearchableSelect
                  value=""
                  options={studyOptions}
                  onChange={handleStudyPick}
                  placeholder="Search and select study"
                  showSearch
                  searchIconPosition="end"
                  includeEmptyOption
                  className={EC_FIELD}
                  contentClassName="z-[180]"
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function EConsentShell({ title, description, children }) {
  return (
    <DashboardLayout>
      <EConsentShellInner title={title} description={description}>
        {children}
      </EConsentShellInner>
    </DashboardLayout>
  )
}
