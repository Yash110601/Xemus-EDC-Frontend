"use client"

import { useCallback, useEffect, useState } from "react"
import DataPagination from "@/components/ui/data-pagination"
import SearchableSelect from "@/components/ui/searchable-select"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { dbLockService } from "@/lib/services"
import { buildReleasePayloadFromLockRow } from "@/lib/dbLock/normalizeLocksList"
import { cn } from "@/lib/utils"
import { Loader2, Lock, RefreshCw, Unlock } from "lucide-react"

const LEVEL_FILTER_OPTIONS = [
  { value: "", label: "All levels" },
  { value: "site", label: "Site" },
  { value: "crf", label: "CRF" },
  { value: "section", label: "Section" },
  { value: "field", label: "Field" },
]

const LEVEL_BADGE_CLASS = {
  study: "bg-rose-100 text-rose-900",
  site: "bg-amber-100 text-amber-900",
  crf: "bg-indigo-100 text-indigo-900",
  section: "bg-sky-100 text-sky-900",
  field: "bg-violet-100 text-violet-900",
}

function formatDate(value) {
  if (!value) return "—"
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString()
}

function formatTargetLabel(row) {
  if (row.level === "field" && row.fieldLabel) return row.fieldLabel
  if (row.level === "section" && row.sectionLabel) return row.sectionLabel
  if (row.level === "crf") {
    const parts = [row.visitTypeName, row.crfDesignName].filter(Boolean)
    return parts.length ? parts.join(" · ") : row.crfDataId ? `CRF ${row.crfDataId}` : "—"
  }
  if (row.level === "site") return row.siteName || (row.siteId ? `Site ${row.siteId}` : "—")
  return "—"
}

function TableSkeleton() {
  return (
    <div className="space-y-2 p-4" role="status" aria-busy="true" aria-label="Loading active locks">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full rounded-lg bg-slate-200/60" />
      ))}
    </div>
  )
}

export default function ActiveLocksTable({
  studyId,
  siteOptions = [],
  canApply = false,
  refreshToken = 0,
  onRowClick,
  onReleased,
}) {
  const { toast } = useToast()
  const [listSiteId, setListSiteId] = useState("")
  const [listLevel, setListLevel] = useState("")
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize] = useState(20)
  const [loading, setLoading] = useState(false)
  const [releasingId, setReleasingId] = useState(null)
  const [releasingStudy, setReleasingStudy] = useState(false)
  const [apiReady, setApiReady] = useState(true)
  const [studyLock, setStudyLock] = useState(null)
  const [items, setItems] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loadError, setLoadError] = useState("")

  const loadList = useCallback(async () => {
    const sid = Number.parseInt(String(studyId ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0) {
      setStudyLock(null)
      setItems([])
      setTotalCount(0)
      setTotalPages(0)
      setLoadError("")
      return
    }

    setLoading(true)
    setLoadError("")
    try {
      const res = await dbLockService.getLocksList(sid, {
        siteId: listSiteId || undefined,
        level: listLevel || undefined,
        pageNumber,
        pageSize,
      })
      setApiReady(res?.statusCode !== 404 && res?.statusCode !== 501)
      if (res?.isSuccess && res.data) {
        setStudyLock(res.data.studyLock ?? null)
        setItems(Array.isArray(res.data.items) ? res.data.items : [])
        setTotalCount(res.data.totalCount ?? 0)
        setTotalPages(res.data.totalPages ?? 0)
        return
      }

      // Fallback: study-wide lock still lives on Studies.IsLocked when list API is denied or empty
      const statusRes = await dbLockService.getLockStatus(sid)
      if (statusRes?.isSuccess && statusRes.data?.isLocked) {
        setStudyLock({
          studyId: sid,
          level: "study",
          isLocked: true,
          lockedAt: statusRes.data.lockedAt ?? null,
          lockedBy: statusRes.data.lockedBy ?? null,
          lockedByName: "",
        })
        setItems([])
        setTotalCount(0)
        setTotalPages(0)
        if (!res?.isSuccess && res?.message) {
          setLoadError(res.message)
        }
        return
      }

      setStudyLock(null)
      setItems([])
      setTotalCount(0)
      setTotalPages(0)
      if (!res?.isSuccess) {
        setLoadError(res?.message || "Could not load active locks for this study.")
      }
    } finally {
      setLoading(false)
    }
  }, [studyId, listSiteId, listLevel, pageNumber, pageSize])

  useEffect(() => {
    setPageNumber(1)
  }, [studyId, listSiteId, listLevel])

  useEffect(() => {
    void loadList()
  }, [loadList, refreshToken])

  const handleRelease = async (row, releaseKey) => {
    const sid = Number.parseInt(String(studyId ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0) return

    setReleasingId(releaseKey)
    try {
      const payload = buildReleasePayloadFromLockRow(row, sid)
      const res = await dbLockService.releaseLock(payload)
      if (res?.isSuccess) {
        toast({ title: "Lock released", variant: "success" })
        onReleased?.()
        await loadList()
        window.dispatchEvent(new CustomEvent("studySiteChanged"))
      } else {
        toast({ title: "Release failed", description: res?.message, variant: "destructive" })
      }
    } finally {
      setReleasingId(null)
    }
  }

  const handleReleaseStudy = async () => {
    if (!studyLock) return
    setReleasingStudy(true)
    try {
      const sid = Number.parseInt(String(studyId ?? ""), 10)
      const res = await dbLockService.releaseLock({ studyId: sid, level: "study" })
      if (res?.isSuccess) {
        toast({ title: "Study lock released", variant: "success" })
        onReleased?.()
        await loadList()
        window.dispatchEvent(new CustomEvent("studySiteChanged"))
      } else {
        toast({ title: "Release failed", description: res?.message, variant: "destructive" })
      }
    } finally {
      setReleasingStudy(false)
    }
  }

  const siteFilterOptions = [{ value: "", label: "All sites" }, ...siteOptions]

  const levelFilterOptions = LEVEL_FILTER_OPTIONS.map((opt) => ({
    value: opt.value,
    label: opt.label,
  }))

  const hasStudyLock = Boolean(studyLock?.isLocked)
  const hasRows = items.length > 0
  const isEmpty = !hasStudyLock && !hasRows && !loading

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-end gap-3 border-b border-slate-200/70 px-4 py-4 md:px-5">
        <div className="min-w-[180px] flex-1">
          <SearchableSelect
            label="Site filter"
            placeholder="All sites"
            options={siteFilterOptions}
            value={listSiteId}
            onChange={setListSiteId}
            disabled={!studyId}
          />
        </div>
        <div className="min-w-[160px] flex-1">
          <SearchableSelect
            label="Level filter"
            placeholder="All levels"
            options={levelFilterOptions}
            value={listLevel}
            onChange={setListLevel}
            disabled={!studyId}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!studyId || loading}
          onClick={() => void loadList()}
          className="mb-0.5"
        >
          <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="flex flex-1 flex-col p-4 md:p-5">
        {!studyId ? (
          <p className="text-sm text-slate-600">Select a study to view active locks.</p>
        ) : !apiReady ? (
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm text-slate-600">
            Active locks list API is not available yet. Deploy the backend{" "}
            <code className="text-xs">GetLocksList</code> endpoint and refresh.
          </div>
        ) : loading && !hasStudyLock && !hasRows ? (
          <TableSkeleton />
        ) : isEmpty ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">No active locks for this study with the current filters.</p>
            {loadError ? (
              <p className="text-sm text-amber-800 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                {loadError}
              </p>
            ) : null}
          </div>
        ) : (
          <>
            {loadError ? (
              <p className="mb-3 text-sm text-amber-800 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                {loadError}
              </p>
            ) : null}
            {hasStudyLock ? (
              <div className="mb-4 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Study-wide lock active</p>
                      <p className="mt-1 text-xs text-slate-600">
                        {studyLock.lockedByName ? `Locked by ${studyLock.lockedByName}` : null}
                        {studyLock.lockedAt ? ` · ${formatDate(studyLock.lockedAt)}` : null}
                      </p>
                      <p className="mt-1 text-xs text-amber-900">
                        All sites and CRFs are locked. Granular rows are hidden while study lock is on.
                      </p>
                    </div>
                  </div>
                  {canApply ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={releasingStudy}
                      onClick={() => void handleReleaseStudy()}
                    >
                      {releasingStudy ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : (
                        <Unlock className="mr-1.5 h-4 w-4" />
                      )}
                      Release study lock
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {hasRows ? (
              <div className="overflow-auto rounded-xl border border-slate-200/80">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-3 py-2.5">Level</th>
                      <th className="px-3 py-2.5">Site</th>
                      <th className="px-3 py-2.5">Patient</th>
                      <th className="px-3 py-2.5">Target</th>
                      <th className="px-3 py-2.5">Locked by</th>
                      <th className="px-3 py-2.5">Locked at</th>
                      <th className="px-3 py-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => {
                      const releaseKey = row.id ?? `${row.level}-${row.crfDataId}-${row.sectionKey}-${row.fieldKey}`
                      const clickable = Boolean(onRowClick && row.crfDataId)
                      return (
                        <tr
                          key={releaseKey}
                          className={cn(
                            "border-t border-slate-100",
                            clickable && "cursor-pointer hover:bg-slate-50/80",
                          )}
                          onClick={clickable ? () => onRowClick(row) : undefined}
                          onKeyDown={
                            clickable
                              ? (e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault()
                                    onRowClick(row)
                                  }
                                }
                              : undefined
                          }
                          tabIndex={clickable ? 0 : undefined}
                          role={clickable ? "button" : undefined}
                        >
                          <td className="px-3 py-2.5">
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                                LEVEL_BADGE_CLASS[row.level] ?? "bg-slate-100 text-slate-700",
                              )}
                            >
                              {row.level || "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">{row.siteName || (row.siteId ? `Site ${row.siteId}` : "—")}</td>
                          <td className="px-3 py-2.5">{row.patientIdentifier || "—"}</td>
                          <td className="px-3 py-2.5">
                            <span className="block max-w-[220px] truncate" title={formatTargetLabel(row)}>
                              {formatTargetLabel(row)}
                            </span>
                            {row.level === "field" && row.sectionLabel ? (
                              <span className="block text-xs text-slate-500">{row.sectionLabel}</span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5">{row.lockedByName || "—"}</td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-600">
                            {formatDate(row.lockedAt)}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {canApply ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={releasingId === releaseKey}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void handleRelease(row, releaseKey)
                                }}
                              >
                                {releasingId === releaseKey ? (
                                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                ) : (
                                  <Unlock className="mr-1.5 h-4 w-4" />
                                )}
                                Release
                              </Button>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : hasStudyLock ? (
              <p className="text-sm text-slate-600">No granular lock rows — study lock covers everything.</p>
            ) : null}

            {totalPages > 0 ? (
              <DataPagination
                currentPage={pageNumber}
                pageSize={pageSize}
                totalPages={totalPages}
                totalCount={totalCount}
                onPageChange={setPageNumber}
                itemName="locks"
                className="rounded-b-xl border border-t-0 border-slate-200/80"
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
