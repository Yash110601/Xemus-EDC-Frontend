"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import DashboardChartSection, { DashboardChartBadge } from "@/components/dashboard/DashboardChartCard"
import { SitePatientEnrollmentBarChart } from "@/components/dashboard-charts"
import ReportDownloadDialog from "@/components/reports/ReportDownloadDialog"
import ReportExportGate from "@/components/reports/ReportExportGate"
import { useReportExportAccess } from "@/app/reports/_hooks/useReportExportAccess"
import { useStudySiteContext } from "@/hooks/useStudySiteContext"
import { dashboardService } from "@/lib/services"
import studyService from "@/lib/services/study.service"
import siteService from "@/lib/services/site.service"
import {
  exportTotalSubjectsCsv,
  exportTotalSubjectsHtml,
  exportTotalSubjectsExcel,
  exportTotalSubjectsPdf,
  resolveTotalSubjectsCounts,
} from "@/lib/utils/totalSubjectsExport"
import { extractDashboardSiteRows } from "@/lib/utils/dashboardSiteRows"
import {
  REPORT_CARD_CLASS,
  REPORT_FILTER_BODY_CLASS,
  REPORT_FILTER_FIELD_CLASS,
  REPORT_FILTER_GRID_3_CLASS,
  REPORT_FILTER_HEADER_CLASS,
  REPORT_FILTER_TOOLBAR_CLASS,
  REPORT_PAGE_SHELL_CLASS,
  REPORT_SELECT_CONTENT_CLASS,
  REPORT_SELECT_ITEM_CLASS,
  REPORT_SELECT_SEARCH_INPUT_CLASS,
  REPORT_SELECT_TRIGGER_CLASS,
  getStudyFilterDisplayName,
} from "@/lib/reports/studySitePatientReportUi"
import { Download, Filter, Loader2, Search, UserCheck, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export default function ExportDashboardPage() {
  const { canExport, assertCanExport, reportKey } = useReportExportAccess()
  const { studyId: workspaceStudyId, siteId: workspaceSiteId, ready } = useStudySiteContext()

  const [filters, setFilters] = useState({ studyId: "", siteId: "" })
  const [appliedFilters, setAppliedFilters] = useState({ studyId: "", siteId: "" })
  const [studyRequiredError, setStudyRequiredError] = useState(false)

  const [studies, setStudies] = useState([])
  const [loadingStudies, setLoadingStudies] = useState(false)
  const [siteOptions, setSiteOptions] = useState([])
  const [loadingSiteOptions, setLoadingSiteOptions] = useState(false)
  const [studySearch, setStudySearch] = useState("")
  const [siteSearch, setSiteSearch] = useState("")

  const [loading, setLoading] = useState(false)
  const [sites, setSites] = useState([])
  const [downloadOpen, setDownloadOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const seededFromWorkspaceRef = useRef(false)

  // Prefill from header study/site once ready
  useEffect(() => {
    if (!ready || seededFromWorkspaceRef.current) return
    const studyNum = Number(workspaceStudyId)
    const siteNum = Number(workspaceSiteId)
    if (!Number.isFinite(studyNum) || studyNum <= 0) return
    seededFromWorkspaceRef.current = true
    const next = {
      studyId: String(studyNum),
      siteId: Number.isFinite(siteNum) && siteNum > 0 ? String(siteNum) : "",
    }
    setFilters(next)
    setAppliedFilters(next)
    setHasSearched(true)
  }, [ready, workspaceStudyId, workspaceSiteId])

  useEffect(() => {
    let mounted = true
    setLoadingStudies(true)
    ;(async () => {
      try {
        const response = await studyService.getStudiesForDropdown()
        if (!mounted) return
        if (response?.isSuccess && response.data) {
          let studiesData = response.data || []
          if (Array.isArray(studiesData) && studiesData.length > 0 && typeof studiesData[0] === "string") {
            studiesData = studiesData.map((name, index) => ({
              studyId: index + 1,
              id: index + 1,
              studyProtocolNumber: name,
              name,
            }))
          }
          setStudies(studiesData)
        } else {
          toast.error(response?.message || "Failed to load studies")
        }
      } catch (error) {
        if (mounted) {
          console.error("Failed to load studies:", error)
          toast.error("Failed to load studies")
        }
      } finally {
        if (mounted) setLoadingStudies(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!filters.studyId) {
      setSiteOptions([])
      setLoadingSiteOptions(false)
      return
    }

    const studyIdNum = parseInt(filters.studyId, 10)
    if (!Number.isFinite(studyIdNum) || studyIdNum <= 0) {
      setSiteOptions([])
      setLoadingSiteOptions(false)
      return
    }

    let cancelled = false
    setLoadingSiteOptions(true)

    ;(async () => {
      try {
        const response = await siteService.getSitesForDropdown(studyIdNum)
        if (cancelled) return
        if (response?.isSuccess && response.data) {
          let sitesData = response.data || []
          if (Array.isArray(sitesData) && sitesData.length > 0 && typeof sitesData[0] === "string") {
            sitesData = sitesData.map((name, index) => ({
              siteId: index + 1,
              id: index + 1,
              siteName: name,
              name,
            }))
          }
          setSiteOptions(sitesData)
        } else {
          setSiteOptions([])
          toast.error(response?.message || "Failed to load sites")
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load sites:", error)
          setSiteOptions([])
          toast.error("Failed to load sites")
        }
      } finally {
        if (!cancelled) setLoadingSiteOptions(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [filters.studyId])

  const loadDashboardSites = useCallback(async (studyIdValue, siteIdValue) => {
    const studyNum = Number(studyIdValue)
    if (!Number.isFinite(studyNum) || studyNum <= 0) {
      setSites([])
      return
    }
    setLoading(true)
    try {
      const siteNum = Number(siteIdValue)
      const response = await dashboardService.getDashboard(
        studyNum,
        Number.isFinite(siteNum) && siteNum > 0 ? siteNum : null,
      )
      if (!response?.isSuccess) {
        toast.error(response?.message || "Failed to load dashboard data")
        setSites([])
        return
      }
      let rows = extractDashboardSiteRows(response?.data)
      if (Number.isFinite(siteNum) && siteNum > 0) {
        rows = rows.filter((site) => Number(site?.siteId ?? site?.SiteId ?? site?.id) === siteNum)
      }
      setSites(rows)
    } catch (error) {
      console.error("Export dashboard load failed:", error)
      toast.error(error?.message || "Failed to load dashboard data")
      setSites([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!hasSearched || !appliedFilters.studyId) return
    void loadDashboardSites(appliedFilters.studyId, appliedFilters.siteId)
  }, [hasSearched, appliedFilters.studyId, appliedFilters.siteId, loadDashboardSites])

  const summary = useMemo(() => {
    let enrolled = 0
    let screened = 0
    let completed = 0
    for (const site of sites) {
      const counts = resolveTotalSubjectsCounts(site)
      enrolled += counts.enrolled
      screened += counts.screened
      completed += counts.completed
    }
    return { enrolled, screened, completed }
  }, [sites])

  const hasActiveFilters = Boolean(filters.studyId || filters.siteId)

  const handleFilterChange = (key, value) => {
    setFilters((prev) => {
      if (key === "studyId") {
        setStudyRequiredError(false)
        return { studyId: value, siteId: "" }
      }
      return { ...prev, [key]: value }
    })
  }

  const handleApplyFilters = () => {
    if (!filters.studyId) {
      setStudyRequiredError(true)
      toast.error("Please select a study")
      return
    }
    setStudyRequiredError(false)
    setAppliedFilters({ ...filters })
    setHasSearched(true)
  }

  const handleClearFilters = () => {
    setFilters({ studyId: "", siteId: "" })
    setAppliedFilters({ studyId: "", siteId: "" })
    setSites([])
    setHasSearched(false)
    setStudyRequiredError(false)
    setStudySearch("")
    setSiteSearch("")
  }

  const handleDownload = async ({ format, pageSize, orientation, asAttachment = false }) => {
    if (!assertCanExport()) return undefined
    setDownloading(true)
    try {
      let result
      if (format === "csv") {
        result = exportTotalSubjectsCsv(sites, "dashboard-total-subjects", { asAttachment })
        if (!asAttachment) toast.success("Total Subjects CSV downloaded")
      } else if (format === "html") {
        result = exportTotalSubjectsHtml(sites, "dashboard-total-subjects", { asAttachment })
        if (!asAttachment) toast.success("Total Subjects HTML downloaded")
      } else if (format === "excel") {
        result = await exportTotalSubjectsExcel(sites, "dashboard-total-subjects", {
          asAttachment,
        })
        if (!asAttachment) toast.success("Total Subjects Excel downloaded")
      } else if (format === "pdf") {
        result = await exportTotalSubjectsPdf(sites, {
          pageSize,
          orientation,
          filenamePrefix: "dashboard-total-subjects",
          asAttachment,
        })
        if (!asAttachment) toast.success("Total Subjects PDF downloaded")
      } else {
        toast.message("Format coming soon")
        return undefined
      }
      if (!asAttachment) setDownloadOpen(false)
      return result
    } finally {
      setDownloading(false)
    }
  }

  const selectTriggerClass = cn(REPORT_SELECT_TRIGGER_CLASS, "!w-full min-w-0 max-w-full")
  const preferredSiteId = Number(appliedFilters.siteId) > 0 ? Number(appliedFilters.siteId) : null

  return (
    <DashboardLayout>
      <div className={REPORT_PAGE_SHELL_CLASS}>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-100 p-2">
              <Download className="h-6 w-6 text-emerald-600" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Dashboard Export</h1>
              <p className="text-sm text-slate-600">
                Filter by study and site, then download Total Subjects analytics.
              </p>
            </div>
          </div>
          <ReportExportGate canExport={canExport} reportKey={reportKey}>
            <Button
              type="button"
              onClick={() => setDownloadOpen(true)}
              disabled={!hasSearched || !appliedFilters.studyId || loading}
              className="bg-emerald-700 text-white hover:bg-emerald-800"
            >
              <Download className="mr-2 h-4 w-4" aria-hidden />
              Download
            </Button>
          </ReportExportGate>
        </div>

        <div className={cn(REPORT_CARD_CLASS, "mb-6")}>
          <div className={REPORT_FILTER_HEADER_CLASS}>
            <div className={REPORT_FILTER_TOOLBAR_CLASS}>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-emerald-700" aria-hidden />
                <h2 className="text-sm font-semibold text-slate-800">Filters</h2>
              </div>
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClearFilters}
                  className="border-slate-200"
                >
                  <X className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Clear Filters
                </Button>
              ) : null}
            </div>
          </div>

          <div className={REPORT_FILTER_BODY_CLASS}>
            <div className={REPORT_FILTER_GRID_3_CLASS}>
              <div className={REPORT_FILTER_FIELD_CLASS}>
                <label className="text-sm font-bold text-slate-700">
                  Study <span className="text-red-600">*</span>
                </label>
                <Select
                  value={filters.studyId || "all"}
                  onValueChange={(v) => handleFilterChange("studyId", v === "all" ? "" : v)}
                  disabled={loadingStudies}
                >
                  <SelectTrigger
                    className={cn(
                      selectTriggerClass,
                      (!filters.studyId || studyRequiredError) &&
                        "border-red-300 focus:border-red-500 focus:ring-red-100",
                    )}
                  >
                    <SelectValue
                      placeholder={loadingStudies ? "Loading studies..." : "Select Study"}
                    />
                  </SelectTrigger>
                  <SelectContent className={REPORT_SELECT_CONTENT_CLASS}>
                    <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          type="text"
                          value={studySearch}
                          onChange={(e) => setStudySearch(e.target.value)}
                          placeholder="Search studies..."
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          className={REPORT_SELECT_SEARCH_INPUT_CLASS}
                        />
                      </div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      <SelectItem value="all" className={REPORT_SELECT_ITEM_CLASS}>
                        Select Study
                      </SelectItem>
                      {studies
                        .filter((study) => {
                          if (!studySearch.trim()) return true
                          const s = studySearch.toLowerCase()
                          return getStudyFilterDisplayName(study).toLowerCase().includes(s)
                        })
                        .map((study) => {
                          const id = study.studyId || study.id
                          if (!id) return null
                          return (
                            <SelectItem
                              key={id}
                              value={String(id)}
                              className={REPORT_SELECT_ITEM_CLASS}
                            >
                              {getStudyFilterDisplayName(study)}
                            </SelectItem>
                          )
                        })}
                    </div>
                  </SelectContent>
                </Select>
                {studyRequiredError && !filters.studyId ? (
                  <p className="text-xs font-medium text-red-600">Study is required</p>
                ) : null}
              </div>

              <div className={REPORT_FILTER_FIELD_CLASS}>
                <label className="text-sm font-bold text-slate-700">Site</label>
                <Select
                  value={filters.siteId || "all"}
                  onValueChange={(v) => handleFilterChange("siteId", v === "all" ? "" : v)}
                  disabled={!filters.studyId}
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue
                      placeholder={
                        !filters.studyId
                          ? "Select Study first"
                          : loadingSiteOptions
                            ? "Loading sites..."
                            : "All Sites"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className={REPORT_SELECT_CONTENT_CLASS}>
                    <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          type="text"
                          value={siteSearch}
                          onChange={(e) => setSiteSearch(e.target.value)}
                          placeholder="Search sites..."
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          className={REPORT_SELECT_SEARCH_INPUT_CLASS}
                        />
                      </div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      <SelectItem value="all" className={REPORT_SELECT_ITEM_CLASS}>
                        All Sites
                      </SelectItem>
                      {siteOptions
                        .filter((site) => {
                          if (!siteSearch.trim()) return true
                          const s = siteSearch.toLowerCase()
                          const name = String(site.siteName || site.name || "").toLowerCase()
                          return name.includes(s)
                        })
                        .map((site) => {
                          const id = site.siteId || site.id
                          if (!id) return null
                          return (
                            <SelectItem
                              key={id}
                              value={String(id)}
                              className={REPORT_SELECT_ITEM_CLASS}
                            >
                              {site.siteName || site.name || `Site ${id}`}
                            </SelectItem>
                          )
                        })}
                    </div>
                  </SelectContent>
                </Select>
              </div>

              <div className={cn(REPORT_FILTER_FIELD_CLASS, "flex items-end")}>
                <Button
                  type="button"
                  onClick={handleApplyFilters}
                  className="h-11 w-full bg-emerald-700 text-white hover:bg-emerald-800"
                >
                  <Search className="mr-2 h-4 w-4" aria-hidden />
                  Search
                </Button>
              </div>
            </div>
          </div>
        </div>

        {!hasSearched ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
            Select a study (and optionally a site), then click Search to load Total Subjects.
          </div>
        ) : (
          <DashboardChartSection
            title="Total Subjects"
            icon={UserCheck}
            fill
            className="min-h-[clamp(520px,70vh,900px)]"
            badges={
              <>
                <DashboardChartBadge label="Enrolled" value={summary.enrolled} tone="emerald" />
                <DashboardChartBadge label="Screened" value={summary.screened} tone="sky" />
                <DashboardChartBadge label="Completed" value={summary.completed} tone="violet" />
              </>
            }
            actions={
              <ReportExportGate canExport={canExport} reportKey={reportKey}>
                <button
                  type="button"
                  onClick={() => setDownloadOpen(true)}
                  disabled={loading}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900 disabled:opacity-50"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  Download
                </button>
              </ReportExportGate>
            }
            bodyClassName="flex min-h-0 flex-1 flex-col p-4 sm:p-5"
          >
            {loading ? (
              <div className="flex min-h-[240px] flex-1 items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" aria-hidden />
                Loading chart…
              </div>
            ) : (
              <SitePatientEnrollmentBarChart
                sites={sites}
                size="fill"
                sitesPerPage={4}
                preferredSiteId={preferredSiteId}
                variant="totalSubjects"
              />
            )}
          </DashboardChartSection>
        )}
      </div>

      <ReportDownloadDialog
        open={downloadOpen}
        onOpenChange={setDownloadOpen}
        title="Download"
        defaultSubject="Total Subjects"
        defaultFormat="pdf"
        canExport={canExport}
        downloading={downloading}
        onDownload={handleDownload}
      />
    </DashboardLayout>
  )
}
