"use client"
/* eslint-disable react-hooks/set-state-in-effect -- range grid fetch & dropdown bootstrap */

import { useState, useEffect, useCallback, useMemo, Suspense } from "react"
import DataPagination from "@/components/ui/data-pagination"
import SectionSkeleton from "@/components/ui/section-skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Plus, Trash2, Loader2, Search, FileDown, Filter, Layers, Check, FileEdit } from "lucide-react"
import SearchableSelect from "@/components/ui/searchable-select"
import labManagementService from "@/lib/services/labManagement.service"
import { field, fieldStr, mapDropdownItems } from "./lab-field-utils"
import {
  LabFieldLabel,
  LabFormSection,
  LabPanelCard,
  LabTableFrame,
  LabTableSkeleton,
  LabStatusFilterSelect,
  LabStatusSwitchWithConfirm,
  LabSectionModeTabs,
  LabEditFormSkeleton,
  LabEditDialogHeader,
  LabEditDialogBody,
  labEditDialogContentClass,
  labEditDialogFooterClass,
  labEditCancelButtonClass,
  labEditPrimaryButtonClass,
  labManageGridTheadClass,
  labManageGridTh,
  labManageGridTbodyClass,
  labManageGridTrClass,
  labManageGridTd,
  labManageSearchIconClass,
  labManageSearchInputPadClass,
  labExportCsvButtonClass,
  LabManageGridRowActions,
} from "./lab-ui"
import { labToastError, labToastSuccess } from "./lab-toast"
import { cn } from "@/lib/utils"

const GENDERS = ["Male", "Female", "Both"]
const GENDER_SELECT_OPTIONS = GENDERS.map((g) => ({ value: g, label: g }))

/** Match Labs / Tests edit dialogs — taller controls, avoids cramped modal body */
const rangeEditSelectCls =
  "mt-2 flex h-11 w-full cursor-pointer rounded-2xl border border-slate-200/85 bg-white/95 px-3.5 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] outline-none transition focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-400/25 dark:border-slate-600 dark:bg-slate-900/85"

const rangeEditInputCls =
  "mt-2 h-11 rounded-2xl border border-slate-200/85 bg-white/95 px-3.5 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] outline-none transition focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-400/25 dark:border-slate-600 dark:bg-slate-900/85"

function newRow(seq) {
  return {
    key: `r-${Date.now()}-${seq}`,
    labCategoryId: "",
    labTestId: "",
    gender: "Both",
    ageFrom: 18,
    ageTo: 65,
    referenceRangeLow: "",
    referenceRangeHigh: "",
    labUnitId: "",
    startDate: "",
    expiryDate: "",
    sequenceNo: seq,
  }
}

function LabRangeAssignmentsSectionInner() {
  const [tab, setTab] = useState("create")

  const [labs, setLabs] = useState([])
  const [categories, setCategories] = useState([])
  const [units, setUnits] = useState([])
  const [testsByRow, setTestsByRow] = useState({}) // key -> options

  const [batchLabId, setBatchLabId] = useState("")
  const [rows, setRows] = useState([newRow(1)])
  const [savingBatch, setSavingBatch] = useState(false)

  const [items, setItems] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState("all")
  const [scopeLabId, setScopeLabId] = useState("")
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState({})

  const [editOpen, setEditOpen] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [editTests, setEditTests] = useState([])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 400)
    return () => clearTimeout(t)
  }, [searchTerm])

  useEffect(() => {
    setPageNumber(1)
  }, [debouncedSearch, activeFilter, scopeLabId])

  const isActiveParam = activeFilter === "all" ? null : activeFilter === "true"

  const loadDropdowns = useCallback(async () => {
    const [lr, cr, ur] = await Promise.all([
      labManagementService.getLabsDropdown(),
      labManagementService.getLabCategoriesDropdown(),
      labManagementService.getLabUnitsDropdown(),
    ])
    setLabs(mapDropdownItems(lr))
    setCategories(mapDropdownItems(cr))
    setUnits(mapDropdownItems(ur))
  }, [])

  useEffect(() => {
    loadDropdowns()
  }, [loadDropdowns])

  const labSelectOptions = useMemo(
    () => labs.map((l) => ({ value: String(l.id), label: l.name || String(l.id) })),
    [labs],
  )

  const labMasterTriggerClass = cn(
    "h-11 min-h-[2.75rem] justify-between rounded-2xl border-2 border-slate-200/90 bg-white px-3.5 text-sm font-medium shadow-sm dark:border-slate-600 dark:bg-slate-900",
  )

  const categorySelectOptions = useMemo(
    () => categories.map((c) => ({ value: String(c.id), label: c.name || String(c.id) })),
    [categories],
  )
  const unitSelectOptions = useMemo(
    () => units.map((u) => ({ value: String(u.id), label: u.name || String(u.id) })),
    [units],
  )

  const batchRowSearchableClass =
    "h-8 min-h-8 w-full min-w-[108px] max-w-[176px] rounded-lg border border-slate-200/90 bg-white px-1.5 text-left text-xs font-medium shadow-sm focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 dark:border-slate-600 dark:bg-slate-900"

  const loadTestsForCategory = async (categoryId) => {
    if (!categoryId) return []
    const res = await labManagementService.getLabTestsDropdown(Number(categoryId))
    return mapDropdownItems(res)
  }

  const fetchList = useCallback(async () => {
    setLoadingList(true)
    try {
      const res = await labManagementService.getLabRangeAssignmentsList(
        pageNumber,
        pageSize,
        scopeLabId ? Number(scopeLabId) : null,
        debouncedSearch || null,
        isActiveParam
      )
      if (res.isSuccess && res.data) {
        setItems(res.data.items || [])
        setTotalCount(res.data.totalCount ?? 0)
        setTotalPages(res.data.totalPages ?? 0)
      } else {
        setItems([])
        labToastError(res.message || "Failed to load list")
      }
    } catch (e) {
      setItems([])
      labToastError(e.message)
    } finally {
      setLoadingList(false)
    }
  }, [pageNumber, pageSize, debouncedSearch, isActiveParam, scopeLabId])

  useEffect(() => {
    if (tab === "manage") fetchList()
  }, [tab, fetchList])

  const updateRow = (key, patch) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  const handleCategoryChange = async (rowKey, categoryId) => {
    updateRow(rowKey, { labCategoryId: categoryId, labTestId: "" })
    const opts = await loadTestsForCategory(categoryId)
    setTestsByRow((m) => ({ ...m, [rowKey]: opts }))
  }

  const addRow = () => {
    setRows((prev) => [...prev, newRow(prev.length + 1)])
  }

  const removeRow = (key) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)))
  }

  const handleBatchSave = async () => {
    if (!batchLabId) {
      labToastError("Select a lab before saving.")
      return
    }
    const labId = Number(batchLabId)
    const assignments = []
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      if (!r.labCategoryId || !r.labTestId || !r.labUnitId) {
        labToastError(`Row ${i + 1}: category, test, and unit are required.`)
        return
      }
      const low = r.referenceRangeLow === "" ? NaN : Number(r.referenceRangeLow)
      const high = r.referenceRangeHigh === "" ? NaN : Number(r.referenceRangeHigh)
      if (Number.isNaN(low) || Number.isNaN(high)) {
        labToastError(`Row ${i + 1}: reference range must be numeric.`)
        return
      }
      assignments.push({
        labTestId: Number(r.labTestId),
        labCategoryId: Number(r.labCategoryId),
        gender: r.gender,
        ageFrom: Number(r.ageFrom),
        ageTo: Number(r.ageTo),
        referenceRangeLow: low,
        referenceRangeHigh: high,
        labUnitId: Number(r.labUnitId),
        startDate: r.startDate || null,
        expiryDate: r.expiryDate || null,
        sequenceNo: i + 1,
      })
    }

    setSavingBatch(true)
    try {
      const res = await labManagementService.createLabRangeAssignmentsBatch({
        labId,
        assignments,
      })
      if (res.isSuccess) {
        labToastSuccess("Range assignments saved.")
        setRows([newRow(1)])
        setBatchLabId("")
        setTab("manage")
        fetchList()
      } else {
        labToastError(res.message || "Batch save failed.")
      }
    } catch (e) {
      labToastError(e.message)
    } finally {
      setSavingBatch(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const r = await labManagementService.exportLabRangeAssignmentsCsv(
        scopeLabId ? Number(scopeLabId) : null,
        debouncedSearch || null,
        isActiveParam
      )
      if (!r.isSuccess) labToastError(r.message || "Export failed")
    } catch (e) {
      labToastError(e.message)
    } finally {
      setExporting(false)
    }
  }

  const applyStatusChange = async (row, nextActive) => {
    const id = field(row, "id", "Id")
    if (id == null) return
    setStatusUpdating((s) => ({ ...s, [id]: true }))
    try {
      const res = await labManagementService.updateLabRangeAssignmentStatus(id, nextActive)
      if (res.isSuccess) fetchList()
      else labToastError(res.message || "Status update failed")
    } finally {
      setStatusUpdating((s) => ({ ...s, [id]: false }))
    }
  }

  const openEdit = async (row) => {
    const id = field(row, "id", "Id")
    if (id == null) return
    setEditId(id)
    setEditOpen(true)
    setEditLoading(true)
    setEditForm(null)
    try {
      const res = await labManagementService.getLabRangeAssignmentById(id)
      const d = res.data
      if (res.isSuccess && d) {
        const catId = field(d, "labCategoryId", "LabCategoryId")
        setEditForm({
          labCategoryId: catId != null ? String(catId) : "",
          labTestId: String(field(d, "labTestId", "LabTestId") ?? ""),
          gender: fieldStr(d, ["gender", "Gender"], "Both"),
          ageFrom: field(d, "ageFrom", "AgeFrom") ?? 0,
          ageTo: field(d, "ageTo", "AgeTo") ?? 0,
          referenceRangeLow: field(d, "referenceRangeLow", "ReferenceRangeLow") ?? "",
          referenceRangeHigh: field(d, "referenceRangeHigh", "ReferenceRangeHigh") ?? "",
          labUnitId: String(field(d, "labUnitId", "LabUnitId") ?? ""),
          startDate: (field(d, "startDate", "StartDate") || "").toString().slice(0, 10),
          expiryDate: (field(d, "expiryDate", "ExpiryDate") || "").toString().slice(0, 10),
          sequenceNo: field(d, "sequenceNo", "SequenceNo") ?? 1,
        })
        if (catId) {
          const opts = await loadTestsForCategory(String(catId))
          setEditTests(opts)
        } else {
          setEditTests([])
        }
      }
    } finally {
      setEditLoading(false)
    }
  }

  const saveEdit = async () => {
    if (!editForm || editId == null) return
    setEditSaving(true)
    try {
      const low = editForm.referenceRangeLow === "" ? NaN : Number(editForm.referenceRangeLow)
      const high = editForm.referenceRangeHigh === "" ? NaN : Number(editForm.referenceRangeHigh)
      if (Number.isNaN(low) || Number.isNaN(high)) {
        labToastError("Reference range must be numeric.")
        return
      }
      const body = {
        labTestId: Number(editForm.labTestId),
        labCategoryId: Number(editForm.labCategoryId),
        gender: editForm.gender,
        ageFrom: Number(editForm.ageFrom),
        ageTo: Number(editForm.ageTo),
        referenceRangeLow: low,
        referenceRangeHigh: high,
        labUnitId: Number(editForm.labUnitId),
        startDate: editForm.startDate || null,
        expiryDate: editForm.expiryDate || null,
        sequenceNo: Number(editForm.sequenceNo) || 1,
      }
      const res = await labManagementService.updateLabRangeAssignment(editId, body)
      if (res.isSuccess) {
        setEditOpen(false)
        labToastSuccess("Assignment updated.")
        fetchList()
      } else {
        labToastError(res.message || "Update failed.")
      }
    } catch (e) {
      labToastError(e.message)
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <LabSectionModeTabs value={tab} onChange={setTab} />

      {tab === "create" && (
        <LabPanelCard
          title="Batch entry"
          subtitle="Choose the lab, add one or more rows, then save in a single transaction."
          icon={Layers}
        >
          <LabFormSection>
          <div className="space-y-5">
          <div className="max-w-md">
            <LabFieldLabel required>Lab</LabFieldLabel>
            <div className="mt-2">
              <SearchableSelect
                value={batchLabId}
                onChange={setBatchLabId}
                options={labSelectOptions}
                placeholder="Select lab"
                showSearch
                searchIconPosition="end"
                openGroup="lab-range-batch-lab"
                className={labMasterTriggerClass}
              />
            </div>
          </div>

          <LabTableFrame>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-b border-slate-200/90 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:border-slate-700 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-emerald-950/40 dark:text-slate-300">
                <tr>
                  <th className="px-2 py-2">Category</th>
                  <th className="px-2 py-2">Test</th>
                  <th className="px-2 py-2">Gender</th>
                  <th className="px-2 py-2">Age</th>
                  <th className="px-2 py-2">Ref low</th>
                  <th className="px-2 py-2">Ref high</th>
                  <th className="px-2 py-2">Unit</th>
                  <th className="px-2 py-2">Start</th>
                  <th className="px-2 py-2">Expiry</th>
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="min-w-[120px] px-2 py-2 align-top">
                      <SearchableSelect
                        value={String(r.labCategoryId ?? "")}
                        onChange={(v) => handleCategoryChange(r.key, v)}
                        options={categorySelectOptions}
                        placeholder="—"
                        showSearch
                        searchIconPosition="end"
                        openGroup={`lab-range-batch-cat-${r.key}`}
                        className={batchRowSearchableClass}
                        contentClassName="min-w-[220px]"
                      />
                    </td>
                    <td className="min-w-[128px] px-2 py-2 align-top">
                      <SearchableSelect
                        value={String(r.labTestId ?? "")}
                        onChange={(v) => updateRow(r.key, { labTestId: v })}
                        options={(testsByRow[r.key] || []).map((t) => ({
                          value: String(t.id),
                          label: t.name || String(t.id),
                        }))}
                        placeholder="—"
                        showSearch
                        searchIconPosition="end"
                        disabled={!r.labCategoryId}
                        openGroup={`lab-range-batch-test-${r.key}`}
                        className={batchRowSearchableClass}
                        contentClassName="min-w-[220px]"
                      />
                    </td>
                    <td className="min-w-[100px] px-2 py-2 align-top">
                      <SearchableSelect
                        value={r.gender}
                        onChange={(v) => updateRow(r.key, { gender: v })}
                        options={GENDER_SELECT_OPTIONS}
                        includeEmptyOption={false}
                        placeholder="Gender"
                        showSearch={false}
                        openGroup={`lab-range-batch-gender-${r.key}`}
                        className={cn(batchRowSearchableClass, "max-w-[112px]")}
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          className="h-8 w-14 text-xs"
                          value={r.ageFrom}
                          onChange={(e) => updateRow(r.key, { ageFrom: Number(e.target.value) })}
                        />
                        <Input
                          type="number"
                          className="h-8 w-14 text-xs"
                          value={r.ageTo}
                          onChange={(e) => updateRow(r.key, { ageTo: Number(e.target.value) })}
                        />
                      </div>
                    </td>
                    <td className="px-2 py-2 align-top">
                      <Input
                        className="h-8 w-20 text-xs"
                        value={r.referenceRangeLow}
                        onChange={(e) => updateRow(r.key, { referenceRangeLow: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <Input
                        className="h-8 w-20 text-xs"
                        value={r.referenceRangeHigh}
                        onChange={(e) => updateRow(r.key, { referenceRangeHigh: e.target.value })}
                      />
                    </td>
                    <td className="min-w-[112px] px-2 py-2 align-top">
                      <SearchableSelect
                        value={String(r.labUnitId ?? "")}
                        onChange={(v) => updateRow(r.key, { labUnitId: v })}
                        options={unitSelectOptions}
                        placeholder="—"
                        showSearch
                        searchIconPosition="end"
                        openGroup={`lab-range-batch-unit-${r.key}`}
                        className={batchRowSearchableClass}
                        contentClassName="min-w-[220px]"
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <Input
                        type="date"
                        className="h-8 w-[132px] text-xs"
                        value={r.startDate}
                        onChange={(e) => updateRow(r.key, { startDate: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <Input
                        type="date"
                        className="h-8 w-[132px] text-xs"
                        value={r.expiryDate}
                        onChange={(e) => updateRow(r.key, { expiryDate: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 rounded-lg bg-rose-100 text-rose-700 shadow-sm hover:bg-rose-200 hover:text-rose-900 dark:bg-rose-950/50 dark:text-rose-200 dark:hover:bg-rose-900/75"
                        onClick={() => removeRow(r.key)}
                        aria-label="Remove row"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </LabTableFrame>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="inline-flex items-center gap-2 rounded-xl border-2"
              onClick={addRow}
            >
              <span>Add row</span>
              <Plus className="h-4 w-4 shrink-0" aria-hidden />
            </Button>
            <Button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 shadow-md hover:bg-emerald-700"
              onClick={handleBatchSave}
              disabled={savingBatch}
            >
              {savingBatch ? (
                <>
                  <span>Save batch</span>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                </>
              ) : (
                <>
                  <span>Save batch</span>
                  <Check className="h-4 w-4 shrink-0" aria-hidden />
                </>
              )}
            </Button>
          </div>
          </div>
          </LabFormSection>
        </LabPanelCard>
      )}

      {tab === "manage" && (
      <div className="space-y-5">
          <LabPanelCard
            title="Search & filters"
            subtitle="Optional lab scope narrows the grid and export."
            icon={Filter}
          >
            <div className="grid w-full grid-cols-1 items-end gap-x-6 gap-y-5 xl:grid-cols-[minmax(0,1fr)_minmax(10rem,12rem)_13rem_auto]">
              <div className="min-w-0 space-y-2">
                <LabFieldLabel className="block w-full leading-tight">Search</LabFieldLabel>
                <div className="relative">
                  <Input
                    className={cn(
                      "h-11 rounded-xl border-2 border-slate-200/90 pl-3.5 text-sm shadow-sm focus-visible:border-emerald-400 dark:border-slate-600 dark:bg-slate-900",
                      labManageSearchInputPadClass,
                    )}
                    placeholder="Search assignments…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <Search className={labManageSearchIconClass} aria-hidden />
                </div>
              </div>
              <div className="w-full min-w-0 space-y-2 sm:max-w-[280px] xl:w-auto">
                <LabFieldLabel className="block w-full leading-tight">Lab scope</LabFieldLabel>
                <SearchableSelect
                  value={scopeLabId}
                  onChange={setScopeLabId}
                  options={labSelectOptions}
                  placeholder="All labs"
                  showSearch
                  searchIconPosition="end"
                  openGroup="lab-range-manage-scope"
                  className={cn(labMasterTriggerClass, "w-full max-w-full")}
                />
              </div>
              <LabStatusFilterSelect value={activeFilter} onChange={setActiveFilter} />
              <div className="flex w-full shrink-0 justify-stretch pb-0.5 xl:w-auto xl:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className={cn(labExportCsvButtonClass, "inline-flex w-full items-center sm:w-auto")}
                  disabled={exporting}
                  onClick={handleExport}
                >
                  <span>Export CSV</span>
                  {exporting ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  ) : (
                    <FileDown className="h-4 w-4 shrink-0" aria-hidden />
                  )}
                </Button>
              </div>
            </div>
          </LabPanelCard>

          {loadingList ? (
            <LabTableSkeleton variant="labRange" rows={8} title="Loading records" />
          ) : (
            <>
              <LabTableFrame>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[960px] border-collapse text-left text-sm">
                    <thead className={labManageGridTheadClass}>
                      <tr>
                        {["Lab", "Test", "Gender", "Age", "Range", "Status", "Action"].map((h) => (
                          <th
                            key={h}
                            className={labManageGridTh(
                              "px-3 py-4",
                              h === "Status" && "text-center",
                              h === "Action" && "text-center",
                            )}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className={labManageGridTbodyClass}>
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-14 text-center text-sm font-medium text-slate-500">
                            No records found.
                          </td>
                        </tr>
                      ) : (
                        items.map((row) => {
                          const id = field(row, "id", "Id")
                          const active = Boolean(field(row, "isActive", "IsActive"))
                          const low = field(row, "referenceRangeLow", "ReferenceRangeLow")
                          const high = field(row, "referenceRangeHigh", "ReferenceRangeHigh")
                          return (
                            <tr key={id} className={labManageGridTrClass}>
                              <td className={labManageGridTd("px-3 text-slate-800 dark:text-slate-200")}>
                                {fieldStr(row, ["labName", "LabName"], "—")}
                              </td>
                              <td className={labManageGridTd("px-3 font-semibold text-slate-900 dark:text-slate-100")}>
                                {fieldStr(row, ["labTestName", "testName", "LabTestName"], "—")}
                              </td>
                              <td className={labManageGridTd("px-3")}>{fieldStr(row, ["gender", "Gender"], "—")}</td>
                              <td className={labManageGridTd("px-3 text-xs text-slate-600 dark:text-slate-400")}>
                                {field(row, "ageFrom", "AgeFrom")}–{field(row, "ageTo", "AgeTo")}
                              </td>
                              <td className={labManageGridTd("px-3 text-xs text-slate-600 dark:text-slate-400")}>
                                {low} – {high}
                              </td>
                              <td className={labManageGridTd("px-3 text-center align-middle")}>
                                <LabStatusSwitchWithConfirm
                                  checked={active}
                                  busy={!!statusUpdating[id]}
                                  rowLabel={fieldStr(row, ["labTestName", "testName", "LabTestName"], "This assignment")}
                                  onConfirm={(nextActive) => applyStatusChange(row, nextActive)}
                                />
                              </td>
                              <td className={labManageGridTd("px-3 text-center align-middle")}>
                                <LabManageGridRowActions
                                  rowLabel={fieldStr(
                                    row,
                                    ["labTestName", "testName", "LabTestName"],
                                    "This assignment",
                                  )}
                                  statusBusy={!!statusUpdating[id]}
                                  onEdit={() => openEdit(row)}
                                />
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </LabTableFrame>

              <DataPagination
                currentPage={pageNumber}
                pageSize={pageSize}
                totalPages={totalPages}
                totalCount={totalCount}
                onPageChange={setPageNumber}
                onPageSizeChange={(n) => {
                  setPageSize(n)
                  setPageNumber(1)
                }}
                showPageSizeSelector
                itemName="records"
              />
            </>
          )}
      </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent
          className={cn(
            labEditDialogContentClass,
            "flex max-h-[min(92vh,800px)] w-full flex-col sm:max-w-xl",
          )}
        >
          <LabEditDialogHeader icon={FileEdit}>
            <DialogTitle className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              Edit Lab range assignment
            </DialogTitle>
          </LabEditDialogHeader>

          <LabEditDialogBody fill>
            {editLoading || !editForm ? (
              <LabEditFormSkeleton variant="range" className="!px-0 pb-2" />
            ) : (
              <LabFormSection surface="modal">
                <div className="grid gap-4 sm:gap-5">
                  <div>
                    <LabFieldLabel>Category</LabFieldLabel>
                    <select
                      className={rangeEditSelectCls}
                      value={editForm.labCategoryId}
                      onChange={async (e) => {
                        const v = e.target.value
                        setEditForm((f) => ({ ...f, labCategoryId: v, labTestId: "" }))
                        const opts = await loadTestsForCategory(v)
                        setEditTests(opts)
                      }}
                    >
                      <option value="">—</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <LabFieldLabel>Test</LabFieldLabel>
                    <select
                      className={rangeEditSelectCls}
                      value={editForm.labTestId}
                      onChange={(e) => setEditForm((f) => ({ ...f, labTestId: e.target.value }))}
                      disabled={!editForm.labCategoryId}
                    >
                      <option value="">—</option>
                      {editTests.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <LabFieldLabel>Gender</LabFieldLabel>
                    <select
                      className={rangeEditSelectCls}
                      value={editForm.gender}
                      onChange={(e) => setEditForm((f) => ({ ...f, gender: e.target.value }))}
                    >
                      {GENDERS.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                    <div>
                      <LabFieldLabel>Age from</LabFieldLabel>
                      <Input
                        type="number"
                        className={rangeEditInputCls}
                        value={editForm.ageFrom}
                        onChange={(e) => setEditForm((f) => ({ ...f, ageFrom: Number(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <LabFieldLabel>Age to</LabFieldLabel>
                      <Input
                        type="number"
                        className={rangeEditInputCls}
                        value={editForm.ageTo}
                        onChange={(e) => setEditForm((f) => ({ ...f, ageTo: Number(e.target.value) }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                    <div>
                      <LabFieldLabel>Ref low</LabFieldLabel>
                      <Input
                        className={rangeEditInputCls}
                        value={editForm.referenceRangeLow}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, referenceRangeLow: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <LabFieldLabel>Ref high</LabFieldLabel>
                      <Input
                        className={rangeEditInputCls}
                        value={editForm.referenceRangeHigh}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, referenceRangeHigh: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <LabFieldLabel>Unit</LabFieldLabel>
                    <select
                      className={rangeEditSelectCls}
                      value={editForm.labUnitId}
                      onChange={(e) => setEditForm((f) => ({ ...f, labUnitId: e.target.value }))}
                    >
                      <option value="">—</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                    <div>
                      <LabFieldLabel>Start</LabFieldLabel>
                      <Input
                        type="date"
                        className={rangeEditInputCls}
                        value={editForm.startDate}
                        onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <LabFieldLabel>Expiry</LabFieldLabel>
                      <Input
                        type="date"
                        className={rangeEditInputCls}
                        value={editForm.expiryDate}
                        onChange={(e) => setEditForm((f) => ({ ...f, expiryDate: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="pb-1">
                    <LabFieldLabel>Sequence</LabFieldLabel>
                    <Input
                      type="number"
                      className={rangeEditInputCls}
                      value={editForm.sequenceNo}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, sequenceNo: Number(e.target.value) }))
                      }
                    />
                  </div>
                </div>
              </LabFormSection>
            )}
          </LabEditDialogBody>

          <DialogFooter className={labEditDialogFooterClass}>
            <Button
              type="button"
              variant="outline"
              className={labEditCancelButtonClass}
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={labEditPrimaryButtonClass}
              onClick={saveEdit}
              disabled={editSaving || editLoading}
            >
              {editSaving ? (
                <>
                  <span>Save</span>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                </>
              ) : (
                <>
                  <span>Save</span>
                  <Check className="h-4 w-4 shrink-0" aria-hidden />
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function LabRangeAssignmentsSection() {
  return (
    <Suspense fallback={<SectionSkeleton variant="labRange" rows={8} title="Loading" className="py-4" />}>
      <LabRangeAssignmentsSectionInner />
    </Suspense>
  )
}
