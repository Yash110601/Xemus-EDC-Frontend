"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import RsdvShell from "@/components/rsdv/RsdvShell"
import SearchableSelect from "@/components/ui/searchable-select"
import DataPagination from "@/components/ui/data-pagination"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { authService, rsdvReviewService, studyService } from "@/lib/services"
import { resolveRouteMenuPermissions } from "@/lib/utils/menuRoutePermissions"
import { filterStudiesWithRemoteSdvEnabled } from "@/lib/utils/studySettingsRead"
import { RSDV_CARD, RSDV_EMPTY, RSDV_TABLE_WRAP, RSDV_TD, RSDV_TH, RSDV_TR } from "@/lib/rsdv/rsdvUi"
import { cn } from "@/lib/utils"
import { Download, History, Loader2, RefreshCw } from "lucide-react"

function parseStudyIdFromDescription(description) {
  if (!description) return null
  const match = String(description).match(/\(study\s+(\d+)\)/i)
  return match ? match[1] : null
}

const getStudyId = (study) => study?.studyId ?? study?.StudyId ?? study?.id ?? study?.Id ?? null

const getStudyLabel = (study) => {
  const protocol = study?.studyProtocolNumber ?? study?.StudyProtocolNumber ?? study?.protocolNumber ?? study?.name ?? ""
  const title = study?.studyTitle ?? study?.StudyTitle ?? ""
  if (protocol && title) return `${protocol} — ${title}`
  return protocol || title || `Study ${getStudyId(study) ?? ""}`
}

function formatDateTime(value) {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString()
}

function AuditTrailsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const routePerm = useMemo(
    () => resolveRouteMenuPermissions(authService.getMenu?.(), "/rsdv/audit-trails"),
    [],
  )

  const [studies, setStudies] = useState([])
  const [loadingStudies, setLoadingStudies] = useState(true)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedStudyId, setSelectedStudyId] = useState(() => searchParams.get("studyId") ?? "")
  const [search, setSearch] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const loadStudies = useCallback(async () => {
    setLoadingStudies(true)
    try {
      const res = await studyService.getStudiesForDropdown()
      if (!res?.isSuccess) {
        setStudies([])
        return
      }
      const allStudies = Array.isArray(res.data) ? res.data : []
      setStudies(await filterStudiesWithRemoteSdvEnabled(allStudies))
    } finally {
      setLoadingStudies(false)
    }
  }, [])

  const loadAudit = useCallback(async () => {
    setLoading(true)
    try {
      const res = await rsdvReviewService.getAuditLog({
        pageNumber,
        pageSize,
        studyId: selectedStudyId || undefined,
        search: search.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      })
      if (res?.isSuccess) {
        const data = res.data ?? {}
        setRows(Array.isArray(data.items) ? data.items : Array.isArray(data.rows) ? data.rows : [])
        setTotalCount(Number(data.totalCount ?? data.total ?? 0))
      } else {
        setRows([])
        setTotalCount(0)
      }
    } finally {
      setLoading(false)
    }
  }, [endDate, pageNumber, pageSize, search, selectedStudyId, startDate])

  useEffect(() => {
    void loadStudies()
  }, [loadStudies])

  useEffect(() => {
    if (!routePerm.canView) return
    void loadAudit()
  }, [loadAudit, routePerm.canView])

  const studyOptions = useMemo(
    () => [
      { value: "", label: "All RSDV-enabled studies" },
      ...studies.map((study) => ({
        value: String(getStudyId(study) ?? ""),
        label: getStudyLabel(study),
      })),
    ],
    [studies],
  )

  const handleStudyChange = (value) => {
    const next = String(value ?? "")
    setSelectedStudyId(next)
    setPageNumber(1)
    const params = new URLSearchParams(searchParams.toString())
    if (next) params.set("studyId", next)
    else params.delete("studyId")
    router.replace(`/rsdv/audit-trails?${params.toString()}`, { scroll: false })
  }

  const buildExportParams = useCallback(
    () => ({
      studyId: selectedStudyId || undefined,
      search: search.trim() || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
    [endDate, search, selectedStudyId, startDate],
  )

  const handleExport = useCallback(
    async () => {
      if (!routePerm.canExport && !routePerm.canView) return
      setExporting(true)
      try {
        await rsdvReviewService.exportAuditLog(buildExportParams())
        toast({
          title: "Export started",
          description: "Remote SDV audit log (CSV) download should begin shortly.",
          variant: "success",
        })
      } catch (error) {
        toast({
          title: "Export failed",
          description: error?.message || "Could not export audit log.",
          variant: "destructive",
        })
      } finally {
        setExporting(false)
      }
    },
    [buildExportParams, routePerm.canExport, routePerm.canView, toast],
  )

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  if (!routePerm.canView) {
    return (
      <RsdvShell title="Audit trails" description="Remote SDV review activity and change history.">
        <p className="text-sm text-slate-600">You do not have permission to view Remote SDV audit trails.</p>
      </RsdvShell>
    )
  }

  return (
    <RsdvShell
      title="Audit trails"
      description="Start review, annotations, and completion events recorded for remote SDV."
    >
      <div className={cn(RSDV_CARD, "mb-4 p-4")}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SearchableSelect
            value={selectedStudyId}
            onChange={handleStudyChange}
            options={studyOptions}
            placeholder={loadingStudies ? "Loading studies…" : "Study"}
            disabled={loadingStudies}
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search description…"
            className="rounded-xl"
          />
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-xl" />
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-xl" />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
          {(routePerm.canExport || routePerm.canView) ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={exporting}
                onClick={() => void handleExport()}
              >
                {exporting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
                Export CSV
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            disabled={loading}
            onClick={() => {
              setPageNumber(1)
              void loadAudit()
            }}
          >
            <RefreshCw className={cn("mr-1.5 h-4 w-4", loading && "animate-spin")} />
            Apply filters
          </Button>
        </div>
      </div>

      <div className={RSDV_CARD}>
        {loading && rows.length === 0 ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
          </div>
        ) : rows.length === 0 ? (
          <div className={RSDV_EMPTY}>
            <History className="h-10 w-10 text-slate-300" />
            <p className="font-medium text-slate-700">No audit entries found</p>
            <p className="text-xs text-slate-500">Try adjusting filters or perform a remote SDV review first.</p>
            <p className="text-xs text-slate-400">Shows StartReview, SaveAnnotation, and CompleteReview actions.</p>
          </div>
        ) : (
          <>
            <div className={RSDV_TABLE_WRAP}>
              <table className="min-w-[960px] w-full border-collapse text-left">
                <thead>
                  <tr>
                    <th className={RSDV_TH}>When</th>
                    <th className={RSDV_TH}>Action</th>
                    <th className={RSDV_TH}>Entity</th>
                    <th className={RSDV_TH}>Description</th>
                    <th className={RSDV_TH}>User</th>
                    <th className={RSDV_TH}>Study</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={String(row.id ?? row.auditTrailId ?? index)} className={RSDV_TR}>
                      <td className={RSDV_TD}>{formatDateTime(row.timestamp ?? row.createdAt ?? row.Timestamp)}</td>
                      <td className={RSDV_TD}>{row.action ?? row.Action ?? "—"}</td>
                      <td className={RSDV_TD}>{row.entityName ?? row.EntityName ?? "—"}</td>
                      <td className={cn(RSDV_TD, "max-w-md whitespace-pre-wrap")}>
                        {row.description ?? row.Description ?? "—"}
                      </td>
                      <td className={RSDV_TD}>{row.username ?? row.userName ?? row.Username ?? "—"}</td>
                      <td className={RSDV_TD}>
                        {row.studyId ?? row.StudyId ?? parseStudyIdFromDescription(row.description ?? row.Description) ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 px-4 py-3">
              <DataPagination
                currentPage={pageNumber}
                pageSize={pageSize}
                totalCount={totalCount}
                totalPages={totalPages}
                onPageChange={setPageNumber}
                onPageSizeChange={(size) => {
                  setPageSize(size)
                  setPageNumber(1)
                }}
                showPageSizeSelector
                itemName="entries"
              />
            </div>
          </>
        )}
      </div>
    </RsdvShell>
  )
}

function AuditTrailsFallback() {
  return (
    <RsdvShell title="Audit trails" description="Remote SDV review activity and change history.">
      <Skeleton className="h-32 rounded-2xl" />
      <Skeleton className="mt-4 h-64 rounded-2xl" />
    </RsdvShell>
  )
}

export default function RsdvAuditTrailsPage() {
  return (
    <Suspense fallback={<AuditTrailsFallback />}>
      <AuditTrailsContent />
    </Suspense>
  )
}
