"use client"

import { useCallback, useState } from "react"
import Link from "next/link"
import DashboardLayout from "@/components/dashboard-layout"
import SdvReportFilters from "@/components/reports/SdvReportFilters"
import ReportExportGate from "@/components/reports/ReportExportGate"
import ReportDownloadDialog from "@/components/reports/ReportDownloadDialog"
import { Button } from "@/components/ui/button"
import SectionSkeleton from "@/components/ui/section-skeleton"
import { useCdiscExportFilters } from "@/app/reports/_hooks/useCdiscExportFilters"
import { useReportExportAccess } from "@/app/reports/_hooks/useReportExportAccess"
import { useReportDownloadDialog } from "@/hooks/useReportDownloadDialog"
import cdiscExportService, { CDISC_EXPORT_FORMATS } from "@/lib/services/cdiscExport.service"
import {
  REPORT_CARD_CLASS,
  REPORT_FILTER_HEADER_CLASS,
  REPORT_HEADER_ICON_WRAP_CLASS,
  REPORT_PAGE_SHELL_CLASS,
  REPORT_PRIMARY_BTN_CLASS,
} from "@/lib/reports/studySitePatientReportUi"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  FileCode2,
  FileDown,
  FileText,
  Filter,
  Info,
  Loader2,
  Package,
  ShieldCheck,
  X,
} from "lucide-react"
import CdiscExportSupportPanel from "@/components/cdisc/CdiscExportSupportPanel"

const FORMAT_ICONS = {
  package_regulatory: Package,
  package: Package,
  odm: FileCode2,
  sdtm: Archive,
  sdtm_xpt: Archive,
  define: FileCode2,
  acrf: FileText,
  adam: Archive,
}

function ValidationPanel({ report, loading }) {
  if (loading) return <SectionSkeleton variant="table" rows={4} />

  if (!report) {
    return (
      <p className="text-sm text-slate-500">
        Run structural validation before handoff. Full FDA/EMA checks require Pinnacle 21 or OpenCDS.
      </p>
    )
  }

  const issues = Array.isArray(report.issues ?? report.Issues) ? report.issues ?? report.Issues : []
  const isValid = report.isValid ?? report.IsValid

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {isValid ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        ) : (
          <AlertTriangle className="h-5 w-5 text-amber-600" />
        )}
        <span className={cn("font-semibold text-sm", isValid ? "text-emerald-800" : "text-amber-900")}>
          {isValid ? "Package passed structural checks" : "Validation issues found"}
        </span>
        <span className="text-xs text-slate-500">({report.validator ?? report.Validator ?? "structural-v1"})</span>
      </div>
      {report.pinnacle21Note ?? report.Pinnacle21Note ? (
        <p className="text-xs text-slate-500 leading-relaxed">{report.pinnacle21Note ?? report.Pinnacle21Note}</p>
      ) : null}
      {issues.length > 0 ? (
        <ul className="max-h-48 overflow-y-auto space-y-1.5 text-sm">
          {issues.map((issue, idx) => (
            <li
              key={`${issue.code ?? issue.Code}-${idx}`}
              className={cn(
                "rounded-md border px-2.5 py-1.5",
                String(issue.severity ?? issue.Severity).toLowerCase() === "error"
                  ? "border-red-200 bg-red-50/80 text-red-900"
                  : "border-amber-200 bg-amber-50/80 text-amber-900",
              )}
            >
              <span className="font-medium">{issue.code ?? issue.Code}</span> — {issue.message ?? issue.Message}
              {issue.location ?? issue.Location ? (
                <span className="block text-xs opacity-80 mt-0.5">{issue.location ?? issue.Location}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export default function CdiscExportPage() {
  const { canExport, assertCanExport, withWorkspace } = useReportExportAccess("CDISC_EXPORT")
  const [exportingFormat, setExportingFormat] = useState(null)
  const [validating, setValidating] = useState(false)
  const [validationReport, setValidationReport] = useState(null)
  const [useAsyncExport, setUseAsyncExport] = useState(true)
  const [dialogSubject, setDialogSubject] = useState("CDISC Export")
  const [pendingCdiscFormat, setPendingCdiscFormat] = useState(null)

  const {
    filters,
    studies,
    sites,
    patients,
    visits,
    crfForms,
    loadingStudies,
    loadingCascade,
    studyRequiredError,
    setStudyRequiredError,
    studySearch,
    setStudySearch,
    siteSearch,
    setSiteSearch,
    patientSearch,
    setPatientSearch,
    visitSearch,
    setVisitSearch,
    crfSearch,
    setCrfSearch,
    hasStudySelected,
    hasSiteSelected,
    hasPatientSelected,
    hasVisitSelected,
    hasActiveFilters,
    handleFilterChange,
    clearFilters,
  } = useCdiscExportFilters()

  const buildFilterPayload = useCallback(() => {
    const studyId = parseInt(filters.studyId, 10)
    return {
      studyId,
      siteId: filters.siteId || undefined,
      patientEnrolmentId: filters.patientEnrolmentId || undefined,
      visitScheduleId: filters.visitScheduleId || undefined,
      crfDesignId: filters.crfDesignId || undefined,
    }
  }, [filters])

  const ensureStudy = useCallback(() => {
    const studyId = parseInt(filters.studyId, 10)
    if (!Number.isFinite(studyId) || studyId <= 0) {
      setStudyRequiredError(true)
      toast.error("Study is required")
      return null
    }
    return studyId
  }, [filters.studyId, setStudyRequiredError])

  const handleValidate = useCallback(async () => {
    if (!ensureStudy()) return
    setValidating(true)
    try {
      const report = await cdiscExportService.validatePackage(withWorkspace(buildFilterPayload()), "package")
      setValidationReport(report)
      toast.success(report?.isValid || report?.IsValid ? "Validation passed" : "Validation completed with issues")
    } catch (error) {
      toast.error(error?.message || "Validation failed")
    } finally {
      setValidating(false)
    }
  }, [buildFilterPayload, ensureStudy, withWorkspace])

  const handleExport = useCallback(
    async (format) => {
      if (!ensureStudy()) return

      try {
        assertCanExport()
      } catch (error) {
        toast.error(error?.message || "Export not permitted")
        return
      }

      setExportingFormat(format)
      try {
        const asyncForFormat = useAsyncExport && format === "package" && !filters.patientEnrolmentId
        await cdiscExportService.exportCdisc(withWorkspace(buildFilterPayload()), format, { useAsync: asyncForFormat })
        toast.success(asyncForFormat ? "CDISC export job completed" : "CDISC export downloaded")
      } catch (error) {
        toast.error(error?.message || "Export failed")
      } finally {
        setExportingFormat(null)
      }
    },
    [assertCanExport, buildFilterPayload, ensureStudy, filters.patientEnrolmentId, useAsyncExport, withWorkspace],
  )

  const { downloadOpen, setDownloadOpen, downloading, openDownload, handleDownload } =
    useReportDownloadDialog({
      assertCanExport,
      onExport: async () => {
        if (!pendingCdiscFormat) {
          toast.error("Select a CDISC package to download.")
          return
        }
        await handleExport(pendingCdiscFormat)
      },
      closeOnStart: true,
    })

  const openCdiscDownload = useCallback(
    (item) => {
      if (!ensureStudy()) return
      setPendingCdiscFormat(item.key)
      setDialogSubject(item.label || "CDISC Export")
      openDownload()
    },
    [ensureStudy, openDownload],
  )

  const cdiscDialogFormats = pendingCdiscFormat === "acrf" ? ["pdf"] : ["csv"]
  const cdiscDefaultFormat = pendingCdiscFormat === "acrf" ? "pdf" : "csv"

  return (
    <DashboardLayout>
      <div className={REPORT_PAGE_SHELL_CLASS}>
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className={REPORT_HEADER_ICON_WRAP_CLASS}>
              <Package className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">CDISC Export</h1>
              <p className="text-slate-600 text-sm">
                Regulatory submission exports: ODM, SDTM (DM/SV + mapped domains), Define-XML, and full package
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/study-management/sdtm-mapping">Configure SDTM mapping</Link>
            </Button>
          </div>
        </div>

        <div className={cn(REPORT_CARD_CLASS, "mb-6")}>
          <div className={REPORT_FILTER_HEADER_CLASS}>
            <div className="flex items-center gap-2 text-slate-700 font-medium">
              <Filter className="w-4 h-4" />
              Export scope
            </div>
            {hasActiveFilters ? (
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="text-slate-600">
                <X className="w-4 h-4 mr-1" />
                Clear filters
              </Button>
            ) : null}
          </div>

          {loadingStudies && studies.length === 0 ? (
            <SectionSkeleton variant="filters" />
          ) : (
            <SdvReportFilters
              filters={filters}
              onFilterChange={handleFilterChange}
              studies={studies}
              sites={sites}
              patients={patients}
              visits={visits}
              crfForms={crfForms}
              loadingStudies={loadingStudies}
              loadingCascade={loadingCascade}
              studyRequiredError={studyRequiredError}
              studySearch={studySearch}
              onStudySearchChange={setStudySearch}
              siteSearch={siteSearch}
              onSiteSearchChange={setSiteSearch}
              patientSearch={patientSearch}
              onPatientSearchChange={setPatientSearch}
              visitSearch={visitSearch}
              onVisitSearchChange={setVisitSearch}
              crfSearch={crfSearch}
              onCrfSearchChange={setCrfSearch}
              hasStudySelected={hasStudySelected}
              hasSiteSelected={hasSiteSelected}
              hasPatientSelected={hasPatientSelected}
              hasVisitSelected={hasVisitSelected}
              showFieldSdvFilter={false}
              studyAllOptionLabel={null}
            />
          )}
        </div>

        <div className={cn(REPORT_CARD_CLASS, "mb-6 p-6")}>
          <div className="flex items-center gap-2 mb-4">
            <Info className="h-5 w-5 text-indigo-600" />
            <h2 className="font-semibold text-slate-800">What Xemus exports without CDISC membership</h2>
          </div>
          <CdiscExportSupportPanel variant="full" />
        </div>

        <ReportExportGate canExport={canExport}>
          <div className={cn(REPORT_CARD_CLASS, "mb-6 p-6")}>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-indigo-600" />
                <div>
                  <h2 className="font-semibold text-slate-800">Schema validation (Phase 3)</h2>
                  <p className="text-sm text-slate-600">Structural pre-check before Pinnacle 21 / OpenCDS submission QA</p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={validating || Boolean(exportingFormat)}
                onClick={() => void handleValidate()}
              >
                {validating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Validating…
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 mr-2" />
                    Validate package
                  </>
                )}
              </Button>
            </div>
            <ValidationPanel report={validationReport} loading={validating} />
          </div>

          <label className="flex items-center gap-2 mb-4 text-sm text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              className="rounded border-slate-300"
              checked={useAsyncExport}
              onChange={(e) => setUseAsyncExport(e.target.checked)}
            />
            Use background export job for full submission package (recommended for large studies)
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            {CDISC_EXPORT_FORMATS.map((item) => {
              const Icon = FORMAT_ICONS[item.key] ?? FileDown
              const isRunning = exportingFormat === item.key
              const isRecommended = item.key === "package"

              return (
                <div
                  key={item.key}
                  className={cn(
                    REPORT_CARD_CLASS,
                    "p-6 flex flex-col gap-4",
                    isRecommended && "ring-1 ring-indigo-200/80",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-semibold text-slate-800">{item.label}</h2>
                      <p className="text-sm text-slate-600 mt-1">{item.description}</p>
                      {isRecommended ? (
                        <p className="text-xs text-indigo-600 mt-2 font-medium">
                          Recommended for regulatory submission handoff
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    type="button"
                    className={cn(REPORT_PRIMARY_BTN_CLASS, "w-full sm:w-auto self-start")}
                    disabled={!canExport || Boolean(exportingFormat) || downloading}
                    onClick={() => openCdiscDownload(item)}
                  >
                    {isRunning ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Exporting…
                      </>
                    ) : (
                      <>
                        <FileDown className="w-4 h-4 mr-2" />
                        Download
                      </>
                    )}
                  </Button>
                </div>
              )
            })}
          </div>

          <p className="text-xs text-slate-500 mt-4 max-w-3xl">
            Exports include Saved and Submitted CRF data only (draft entries excluded). DM and SV are always included.
            Apply mapping templates on{" "}
            <Link href="/study-management/sdtm-mapping" className="text-indigo-600 underline underline-offset-2">
              SDTM Field Mapping
            </Link>{" "}
            before export. CRF Designer and rules are not affected.
          </p>
        </ReportExportGate>

        <ReportDownloadDialog
          open={downloadOpen}
          onOpenChange={(open) => {
            setDownloadOpen(open)
            if (!open) setPendingCdiscFormat(null)
          }}
          title="Download"
          defaultSubject={dialogSubject}
          defaultFormat={cdiscDefaultFormat}
          enabledFormats={cdiscDialogFormats}
          canExport={canExport}
          downloading={downloading || Boolean(exportingFormat)}
          onDownload={handleDownload}
        />
      </div>
    </DashboardLayout>
  )
}
