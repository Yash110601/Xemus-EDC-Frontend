"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import DashboardLayout from "@/components/dashboard-layout"
import SectionSkeleton from "@/components/ui/section-skeleton"
import SearchableSelect from "@/components/ui/searchable-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useStudySiteContext } from "@/hooks/useStudySiteContext"
import studyService from "@/lib/services/study.service"
import studySdtmMappingService, { indexMappingsByField } from "@/lib/services/studySdtmMapping.service"
import {
  SDTM_DOMAIN_OPTIONS,
  buildFieldMappingKey,
  getVariablesForDomain,
} from "@/lib/cdisc/sdtmDomains"
import {
  REPORT_CARD_CLASS,
  REPORT_PAGE_SHELL_CLASS,
  REPORT_PRIMARY_BTN_CLASS,
  REPORT_TABLE_BODY_CLASS,
  REPORT_TABLE_HEAD_ROW_CLASS,
  REPORT_TABLE_SCROLL_CLASS,
  REPORT_TABLE_TD_CLASS,
  REPORT_TABLE_TH_CLASS,
  REPORT_TABLE_TR_CLASS,
} from "@/lib/reports/studySitePatientReportUi"
import { toast } from "sonner"
import { GitBranch, Loader2, Save, Search, Sparkles } from "lucide-react"
import CdiscExportSupportPanel from "@/components/cdisc/CdiscExportSupportPanel"

function emptyRowFromCatalog(item) {
  return {
    crfDesignId: item.crfDesignId ?? item.CrfDesignId,
    sectionKey: item.sectionKey ?? item.SectionKey,
    fieldKey: item.fieldKey ?? item.FieldKey,
    crfName: item.crfName ?? item.CrfName ?? "",
    sectionLabel: item.sectionLabel ?? item.SectionLabel ?? "",
    fieldLabel: item.fieldLabel ?? item.FieldLabel ?? "",
    controlType: item.controlType ?? item.ControlType ?? "",
    sdtmDomain: "",
    sdtmVariable: "",
    cdashVariable: "",
    codelist: "",
  }
}

export default function StudySdtmMappingPage() {
  const { studyId: headerStudyId, ready: headerReady } = useStudySiteContext()
  const [studies, setStudies] = useState([])
  const [studyId, setStudyId] = useState("")
  const [loadingStudies, setLoadingStudies] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [templates, setTemplates] = useState([])
  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [applyingTemplate, setApplyingTemplate] = useState(false)
  const [search, setSearch] = useState("")
  const [domainFilter, setDomainFilter] = useState("all")
  const [rows, setRows] = useState([])

  useEffect(() => {
    let mounted = true
    setLoadingStudies(true)
    studyService
      .getStudiesForDropdown()
      .then((response) => {
        if (!mounted) return
        if (response?.isSuccess && Array.isArray(response.data)) setStudies(response.data)
      })
      .finally(() => {
        if (mounted) setLoadingStudies(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!headerReady || !headerStudyId) return
    setStudyId(String(headerStudyId))
  }, [headerReady, headerStudyId])

  const loadMappings = useCallback(async (id) => {
    const numericId = parseInt(id, 10)
    if (!Number.isFinite(numericId) || numericId <= 0) {
      setRows([])
      return
    }
    setLoading(true)
    try {
      const response = await studySdtmMappingService.getMappings(numericId)
      const { catalog, mappings } = response.normalized ?? {}
      const indexed = indexMappingsByField(mappings)
      const merged = (catalog ?? []).map((item) => {
        const base = emptyRowFromCatalog(item)
        const key = buildFieldMappingKey(base.crfDesignId, base.sectionKey, base.fieldKey)
        const mapped = indexed.get(key)
        if (!mapped) return base
        return {
          ...base,
          sdtmDomain: mapped.sdtmDomain ?? "",
          sdtmVariable: mapped.sdtmVariable ?? "",
          cdashVariable: mapped.cdashVariable ?? "",
          codelist: mapped.codelist ?? "",
        }
      })
      setRows(merged)
    } catch (error) {
      toast.error(error?.message || "Failed to load SDTM mappings")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    studySdtmMappingService
      .listTemplates()
      .then((list) => {
        if (mounted) {
          setTemplates(list)
          const pilot = list.find((t) => (t.templateId ?? t.TemplateId) === "pilot-starter")
          if (pilot && !selectedTemplateId) {
            setSelectedTemplateId(pilot.templateId ?? pilot.TemplateId)
          }
        }
      })
      .catch(() => {
        if (mounted) setTemplates([])
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (studyId) loadMappings(studyId)
  }, [studyId, loadMappings])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (domainFilter !== "all" && row.sdtmDomain !== domainFilter) return false
      if (!q) return true
      const hay = [
        row.crfName,
        row.sectionLabel,
        row.fieldLabel,
        row.fieldKey,
        row.sdtmDomain,
        row.sdtmVariable,
      ]
        .join(" ")
        .toLowerCase()
      return hay.includes(q)
    })
  }, [domainFilter, rows, search])

  const mappedCount = useMemo(
    () => rows.filter((r) => r.sdtmDomain && r.sdtmVariable).length,
    [rows],
  )

  const updateRowByKey = (rowKey, patch) => {
    setRows((prev) =>
      prev.map((row) =>
        buildFieldMappingKey(row.crfDesignId, row.sectionKey, row.fieldKey) === rowKey
          ? { ...row, ...patch }
          : row,
      ),
    )
  }

  const handleApplyTemplate = async () => {
    const numericId = parseInt(studyId, 10)
    if (!Number.isFinite(numericId) || numericId <= 0) {
      toast.error("Study is required")
      return
    }
    if (!selectedTemplateId) {
      toast.error("Select a mapping template")
      return
    }
    setApplyingTemplate(true)
    try {
      const res = await studySdtmMappingService.applyTemplate({
        studyId: numericId,
        templateId: selectedTemplateId,
        replaceAll: false,
      })
      const count = res?.data?.mappedCount ?? res?.data?.MappedCount ?? 0
      toast.success(`Template applied (${count} field${count === 1 ? "" : "s"} mapped)`)
      await loadMappings(studyId)
    } catch (error) {
      toast.error(error?.message || "Template apply failed")
    } finally {
      setApplyingTemplate(false)
    }
  }

  const handleSave = async () => {
    const numericId = parseInt(studyId, 10)
    if (!Number.isFinite(numericId) || numericId <= 0) {
      toast.error("Study is required")
      return
    }
    setSaving(true)
    try {
      const mappings = rows
        .filter((r) => r.sdtmDomain && r.sdtmVariable)
        .map((r) => ({
          crfDesignId: r.crfDesignId,
          sectionKey: r.sectionKey,
          fieldKey: r.fieldKey,
          sdtmDomain: r.sdtmDomain,
          sdtmVariable: r.sdtmVariable,
          cdashVariable: r.cdashVariable || null,
          codelist: r.codelist || null,
        }))
      await studySdtmMappingService.saveMappings(numericId, mappings, { replaceAll: true })
      toast.success("SDTM mappings saved")
      await loadMappings(studyId)
    } catch (error) {
      toast.error(error?.message || "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardLayout>
      <div className={REPORT_PAGE_SHELL_CLASS}>
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <GitBranch className="w-6 h-6 text-indigo-600" />
              <h1 className="text-2xl font-bold text-slate-800">SDTM Field Mapping</h1>
            </div>
            <p className="text-sm text-slate-600 max-w-3xl">
            Map CRF fields to SDTM variables for AE, CM, LB, VS, MH, and other domains. DM is built from
            enrolment data and can be supplemented from mapped CRF fields; SV is auto-generated from visits.
            Apply <strong className="font-semibold text-slate-700">Pilot study starter</strong> for a quick
            Study 43 / Youthbless baseline, then save and export from CDISC Export.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/reports/cdisc-export">Open CDISC Export</Link>
            </Button>
            <Button
              type="button"
              className={REPORT_PRIMARY_BTN_CLASS}
              disabled={saving || !studyId}
              onClick={handleSave}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save mappings
                </>
              )}
            </Button>
          </div>
        </div>

        <div className={`${REPORT_CARD_CLASS} p-6 mb-6 space-y-4`}>
          <div className="flex flex-wrap items-end gap-3 pb-2 border-b border-slate-100">
            <div className="min-w-[220px] flex-1">
              <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Mapping template</label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose template…" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.templateId ?? t.TemplateId} value={t.templateId ?? t.TemplateId}>
                      {t.name ?? t.Name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={!studyId || !selectedTemplateId || applyingTemplate}
              onClick={() => void handleApplyTemplate()}
            >
              {applyingTemplate ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Applying…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Apply template
                </>
              )}
            </Button>
          </div>
          {selectedTemplateId ? (
            <p className="text-xs text-slate-500">
              {templates.find((t) => (t.templateId ?? t.TemplateId) === selectedTemplateId)?.description ??
                templates.find((t) => (t.templateId ?? t.TemplateId) === selectedTemplateId)?.Description ??
                "Matches CRF field labels by keyword and merges mappings into the matrix."}
            </p>
          ) : null}
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Study *</label>
              <SearchableSelect
                value={studyId}
                onValueChange={setStudyId}
                options={studies.map((s) => ({
                  value: String(s.studyId ?? s.id),
                  label: s.studyProtocolNumber || s.name || `Study ${s.studyId ?? s.id}`,
                }))}
                placeholder={loadingStudies ? "Loading studies…" : "Select study"}
                disabled={loadingStudies}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Search fields</label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="CRF, section, label, variable…"
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Domain filter</label>
              <Select value={domainFilter} onValueChange={setDomainFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All domains</SelectItem>
                  {SDTM_DOMAIN_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            {mappedCount} of {rows.length} fields mapped · Requires <code className="text-indigo-700">CDISC_EXPORT</code> Edit permission to save
          </p>
        </div>

        <div className={REPORT_CARD_CLASS}>
          {loading ? (
            <SectionSkeleton variant="table" />
          ) : !studyId ? (
            <div className="p-8 text-center text-slate-500 text-sm">Select a study to load CRF field catalog.</div>
          ) : filteredRows.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No CRF fields match the current filters.</div>
          ) : (
            <div className={REPORT_TABLE_SCROLL_CLASS}>
              <table className="w-full min-w-[960px]">
                <thead>
                  <tr className={REPORT_TABLE_HEAD_ROW_CLASS}>
                    <th className={REPORT_TABLE_TH_CLASS}>CRF</th>
                    <th className={REPORT_TABLE_TH_CLASS}>Section</th>
                    <th className={REPORT_TABLE_TH_CLASS}>Field</th>
                    <th className={REPORT_TABLE_TH_CLASS}>Type</th>
                    <th className={REPORT_TABLE_TH_CLASS}>SDTM domain</th>
                    <th className={REPORT_TABLE_TH_CLASS}>SDTM variable</th>
                    <th className={REPORT_TABLE_TH_CLASS}>CDASH</th>
                    <th className={REPORT_TABLE_TH_CLASS}>Codelist</th>
                  </tr>
                </thead>
                <tbody className={REPORT_TABLE_BODY_CLASS}>
                  {filteredRows.map((row) => {
                    const rowKey = buildFieldMappingKey(row.crfDesignId, row.sectionKey, row.fieldKey)
                    const vars = getVariablesForDomain(row.sdtmDomain)
                    return (
                      <tr key={rowKey} className={REPORT_TABLE_TR_CLASS}>
                        <td className={REPORT_TABLE_TD_CLASS}>{row.crfName}</td>
                        <td className={REPORT_TABLE_TD_CLASS}>{row.sectionLabel}</td>
                        <td className={REPORT_TABLE_TD_CLASS}>{row.fieldLabel || row.fieldKey}</td>
                        <td className={REPORT_TABLE_TD_CLASS}>{row.controlType}</td>
                        <td className={REPORT_TABLE_TD_CLASS}>
                          <Select
                            value={row.sdtmDomain || "none"}
                            onValueChange={(v) =>
                              updateRowByKey(rowKey, {
                                sdtmDomain: v === "none" ? "" : v,
                                sdtmVariable: "",
                              })
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">—</SelectItem>
                              {SDTM_DOMAIN_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.value}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className={REPORT_TABLE_TD_CLASS}>
                          {vars.length > 0 ? (
                            <Select
                              value={row.sdtmVariable || "none"}
                              onValueChange={(v) =>
                                updateRowByKey(rowKey, { sdtmVariable: v === "none" ? "" : v })
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="—" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">—</SelectItem>
                                {vars.map((v) => (
                                  <SelectItem key={v} value={v}>
                                    {v}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              value={row.sdtmVariable}
                              onChange={(e) =>
                                updateRowByKey(rowKey, { sdtmVariable: e.target.value.toUpperCase() })
                              }
                              className="h-8 text-xs uppercase"
                              disabled={!row.sdtmDomain}
                            />
                          )}
                        </td>
                        <td className={REPORT_TABLE_TD_CLASS}>
                          <Input
                            value={row.cdashVariable}
                            onChange={(e) =>
                              updateRowByKey(rowKey, { cdashVariable: e.target.value.toUpperCase() })
                            }
                            className="h-8 text-xs uppercase"
                          />
                        </td>
                        <td className={REPORT_TABLE_TD_CLASS}>
                          <Input
                            value={row.codelist}
                            onChange={(e) => updateRowByKey(rowKey, { codelist: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className={`${REPORT_CARD_CLASS} p-6 mt-6`}>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">CDISC support without membership</h2>
          <CdiscExportSupportPanel variant="compact" />
        </div>
      </div>
    </DashboardLayout>
  )
}
