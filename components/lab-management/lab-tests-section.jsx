"use client"
/* eslint-disable react-hooks/set-state-in-effect -- paged lists & dropdown bootstrap */

import { useState, useEffect, useCallback, useMemo, Suspense } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import DataPagination from "@/components/ui/data-pagination"
import SectionSkeleton from "@/components/ui/section-skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, Search, FileDown, Filter, FileEdit, Check, RotateCcw } from "lucide-react"
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

const NAME_MAX = 100
const DESC_MAX = 500

const selClass =
  "flex h-11 w-full rounded-2xl border border-slate-200/85 bg-white/95 px-3.5 text-sm font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] outline-none transition focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-400/25 dark:border-slate-600 dark:bg-slate-900/85"
const inpClass =
  "h-11 rounded-2xl border border-slate-200/85 bg-white/95 px-3.5 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] outline-none transition focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-400/25 dark:border-slate-600 dark:bg-slate-900/85"
const taClass =
  "mt-2 flex min-h-[100px] w-full rounded-2xl border border-slate-200/85 bg-white/95 px-3 py-2.5 text-sm outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-400/25 dark:border-slate-600 dark:bg-slate-900/75"

function emptyTestForm() {
  return { labCategoryId: "", name: "", description: "" }
}

function LabTestsSectionInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const idFromUrl = searchParams.get("id")

  const [tab, setTab] = useState("create")
  const [createForm, setCreateForm] = useState(emptyTestForm)
  const [editOpen, setEditOpen] = useState(false)
  const [modalEditId, setModalEditId] = useState(null)
  const [editForm, setEditForm] = useState(emptyTestForm)
  const [categories, setCategories] = useState([])
  const [loadingRecord, setLoadingRecord] = useState(false)
  const [saving, setSaving] = useState(false)

  const [items, setItems] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState({})

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 400)
    return () => clearTimeout(t)
  }, [searchTerm])

  useEffect(() => {
    setPageNumber(1)
  }, [debouncedSearch, activeFilter, categoryFilter])

  const isActiveParam = activeFilter === "all" ? null : activeFilter === "true"

  const loadCategories = useCallback(async () => {
    const res = await labManagementService.getLabCategoriesDropdown()
    setCategories(mapDropdownItems(res))
  }, [])

  const categorySelectOptions = useMemo(
    () => categories.map((c) => ({ value: String(c.id), label: c.name || String(c.id) })),
    [categories],
  )

  const categoryTriggerClass = cn(
    selClass,
    "h-11 min-h-[2.75rem] justify-between py-0 text-left font-medium",
  )

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  const fetchList = useCallback(async () => {
    setLoadingList(true)
    try {
      const res = await labManagementService.getLabTestsList(
        pageNumber,
        pageSize,
        debouncedSearch || null,
        isActiveParam,
        categoryFilter ? Number(categoryFilter) : null
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
  }, [pageNumber, pageSize, debouncedSearch, isActiveParam, categoryFilter])

  useEffect(() => {
    if (tab === "manage") fetchList()
  }, [tab, fetchList])

  useEffect(() => {
    if (!idFromUrl) return
    setTab("manage")
    setModalEditId(idFromUrl)
    setEditOpen(true)
  }, [idFromUrl])

  useEffect(() => {
    if (!editOpen || !modalEditId) return
    let cancelled = false
    ;(async () => {
      setLoadingRecord(true)
      try {
        const res = await labManagementService.getLabTestById(modalEditId)
        if (cancelled) return
        const row = res.data
        if (res.isSuccess && row) {
          setEditForm({
            labCategoryId: String(field(row, "labCategoryId", "LabCategoryId") ?? ""),
            name: fieldStr(row, ["name", "Name"], ""),
            description: fieldStr(row, ["description", "Description"], ""),
          })
        }
      } finally {
        if (!cancelled) setLoadingRecord(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [editOpen, modalEditId])

  const closeEditModal = () => {
    setEditOpen(false)
    setModalEditId(null)
    setEditForm(emptyTestForm())
    router.replace(pathname)
  }

  const openEdit = (id) => {
    const sid = String(id)
    setModalEditId(sid)
    setEditOpen(true)
    router.replace(`${pathname}?id=${encodeURIComponent(sid)}`)
  }

  const handleCreateSave = async () => {
    const name = createForm.name.trim()
    const labCategoryId = createForm.labCategoryId ? Number(createForm.labCategoryId) : null
    if (!labCategoryId) {
      labToastError("Lab category is required.")
      return
    }
    if (!name) {
      labToastError("Test name is required.")
      return
    }
    setSaving(true)
    try {
      const body = {
        labCategoryId,
        name,
        description: createForm.description.trim() || null,
      }
      const res = await labManagementService.createLabTest(body)
      if (res.isSuccess) {
        labToastSuccess("Created successfully.")
        setCreateForm(emptyTestForm())
        fetchList()
      } else {
        labToastError(res.message || "Save failed.")
      }
    } catch (e) {
      labToastError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleEditSave = async () => {
    const name = editForm.name.trim()
    const labCategoryId = editForm.labCategoryId ? Number(editForm.labCategoryId) : null
    if (!labCategoryId) {
      labToastError("Lab category is required.")
      return
    }
    if (!name) {
      labToastError("Test name is required.")
      return
    }
    if (!modalEditId) return
    setSaving(true)
    try {
      const body = {
        labCategoryId,
        name,
        description: editForm.description.trim() || null,
      }
      const res = await labManagementService.updateLabTest(modalEditId, body)
      if (res.isSuccess) {
        labToastSuccess("Updated successfully.")
        closeEditModal()
        fetchList()
      } else {
        labToastError(res.message || "Save failed.")
      }
    } catch (e) {
      labToastError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const r = await labManagementService.exportLabTestsCsv(
        debouncedSearch || null,
        isActiveParam,
        categoryFilter ? Number(categoryFilter) : null
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
      const res = await labManagementService.updateLabTestStatus(id, nextActive)
      if (res.isSuccess) fetchList()
      else labToastError(res.message || "Status update failed")
    } finally {
      setStatusUpdating((s) => ({ ...s, [id]: false }))
    }
  }

  const categoryNameForRow = (row) =>
    fieldStr(row, ["labCategoryName", "categoryName", "LabCategoryName"], "—")

  return (
    <div className="space-y-6">
      <LabSectionModeTabs value={tab} onChange={setTab} />

      {tab === "create" && (
        <LabPanelCard
          title="New lab test"
          subtitle="Pick a category first — test names are unique within the category."
          icon={FileEdit}
        >
          <LabFormSection>
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                <div className="space-y-2">
                  <LabFieldLabel required>Lab category</LabFieldLabel>
                  <SearchableSelect
                    value={createForm.labCategoryId}
                    onChange={(v) => setCreateForm((f) => ({ ...f, labCategoryId: v }))}
                    options={categorySelectOptions}
                    placeholder="Select category"
                    showSearch
                    searchIconPosition="end"
                    openGroup="lab-tests-create"
                    className={categoryTriggerClass}
                  />
                </div>
                <div className="space-y-2">
                  <LabFieldLabel required>Test name</LabFieldLabel>
                  <Input
                    className={inpClass}
                    value={createForm.name}
                    maxLength={NAME_MAX}
                    onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Enter test name"
                  />
                  <p className="text-xs font-medium text-slate-500">{createForm.name.length} / {NAME_MAX}</p>
                </div>
              </div>
              <div>
                <LabFieldLabel>Description</LabFieldLabel>
                <textarea
                  className={taClass}
                  value={createForm.description}
                  maxLength={DESC_MAX}
                  onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                />
                <p className="mt-1 text-xs font-medium text-slate-500">{createForm.description.length} / {DESC_MAX}</p>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  onClick={handleCreateSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 font-semibold text-white shadow-md hover:bg-emerald-700"
                >
                  {saving ? (
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
                <Button
                  type="button"
                  variant="outline"
                  className="inline-flex items-center gap-2 rounded-xl border-2"
                  onClick={() => setCreateForm(emptyTestForm())}
                >
                  <span>Clear</span>
                  <RotateCcw className="h-4 w-4 shrink-0" aria-hidden />
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
            subtitle="Lab category and test name (search) apply to the list and CSV export."
            icon={Filter}
          >
            <div className="grid w-full grid-cols-1 items-end gap-x-4 gap-y-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_13rem_auto]">
              <div className="min-w-0 space-y-2">
                <LabFieldLabel className="block w-full leading-tight">Lab category</LabFieldLabel>
                <SearchableSelect
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  options={categorySelectOptions}
                  placeholder="All categories"
                  showSearch
                  searchIconPosition="end"
                  openGroup="lab-tests-manage"
                  className={categoryTriggerClass}
                />
              </div>
              <div className="min-w-0 space-y-2">
                <LabFieldLabel className="block w-full leading-tight">Test name</LabFieldLabel>
                <div className="relative">
                  <Input
                    className={cn(inpClass, labManageSearchInputPadClass)}
                    placeholder="Search by test name…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <Search className={labManageSearchIconClass} aria-hidden />
                </div>
              </div>
              <LabStatusFilterSelect
                value={activeFilter}
                onChange={setActiveFilter}
                className="w-full min-w-0 lg:w-full"
              />
              <div className="flex w-full min-w-0 justify-stretch pb-0.5 lg:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className={cn(labExportCsvButtonClass, "inline-flex w-full shrink-0 items-center lg:w-auto")}
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
            <LabTableSkeleton variant="labTestMaster" rows={8} title="Loading records" />
          ) : (
            <>
              <LabTableFrame>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                    <thead className={labManageGridTheadClass}>
                      <tr>
                        {["Category", "Test", "Description", "Status", "Action"].map((h) => (
                          <th
                            key={h}
                            className={labManageGridTh(
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
                          <td colSpan={5} className="px-4 py-14 text-center text-sm font-medium text-slate-500">
                            No records found.
                          </td>
                        </tr>
                      ) : (
                        items.map((row) => {
                          const id = field(row, "id", "Id")
                          const active = Boolean(field(row, "isActive", "IsActive"))
                          const rowLabel = fieldStr(row, ["name", "Name"], "This test")
                          return (
                            <tr key={id} className={labManageGridTrClass}>
                              <td className={labManageGridTd("text-slate-800 dark:text-slate-200")}>
                                {categoryNameForRow(row)}
                              </td>
                              <td className={labManageGridTd("font-semibold text-slate-900 dark:text-slate-100")}>
                                {fieldStr(row, ["name", "Name"])}
                              </td>
                              <td className={labManageGridTd("max-w-xs truncate text-slate-600 dark:text-slate-400")}>
                                {fieldStr(row, ["description", "Description"], "—")}
                              </td>
                              <td className={labManageGridTd("text-center align-middle")}>
                                <LabStatusSwitchWithConfirm
                                  checked={active}
                                  busy={!!statusUpdating[id]}
                                  rowLabel={rowLabel}
                                  onConfirm={(nextActive) => applyStatusChange(row, nextActive)}
                                />
                              </td>
                              <td className={labManageGridTd("text-center align-middle")}>
                                <LabManageGridRowActions
                                  rowLabel={rowLabel}
                                  statusBusy={!!statusUpdating[id]}
                                  onEdit={() => openEdit(id)}
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

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          if (!open) closeEditModal()
        }}
      >
        <DialogContent className={cn(labEditDialogContentClass, "max-h-[90vh] sm:max-w-xl")}>
          <LabEditDialogHeader icon={FileEdit}>
            <DialogTitle className="text-xl font-semibold leading-snug tracking-tight text-slate-900 dark:text-slate-50">
              Edit Lab tests
            </DialogTitle>
          </LabEditDialogHeader>
          <LabEditDialogBody className="max-h-[min(58vh,520px)]">
            {loadingRecord && modalEditId ? (
              <LabEditFormSkeleton variant="labTest" className="!px-0 !py-2" />
            ) : (
              <LabFormSection surface="modal">
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                    <div className="space-y-2">
                      <LabFieldLabel required>Lab category</LabFieldLabel>
                      <SearchableSelect
                        value={editForm.labCategoryId}
                        onChange={(v) => setEditForm((f) => ({ ...f, labCategoryId: v }))}
                        options={categorySelectOptions}
                        placeholder="Select category"
                        showSearch
                        searchIconPosition="end"
                        openGroup="lab-tests-edit"
                        className={categoryTriggerClass}
                      />
                    </div>
                    <div className="space-y-2">
                      <LabFieldLabel required>Test name</LabFieldLabel>
                      <Input
                        className={inpClass}
                        value={editForm.name}
                        maxLength={NAME_MAX}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Enter test name"
                      />
                      <p className="text-xs font-medium text-slate-500">{editForm.name.length} / {NAME_MAX}</p>
                    </div>
                  </div>
                  <div>
                    <LabFieldLabel>Description</LabFieldLabel>
                    <textarea
                      className={taClass}
                      value={editForm.description}
                      maxLength={DESC_MAX}
                      onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                    />
                    <p className="mt-1 text-xs font-medium text-slate-500">{editForm.description.length} / {DESC_MAX}</p>
                  </div>
                </div>
              </LabFormSection>
            )}
          </LabEditDialogBody>
          <DialogFooter className={labEditDialogFooterClass}>
            <Button type="button" variant="outline" className={labEditCancelButtonClass} onClick={closeEditModal}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleEditSave}
              disabled={saving || (modalEditId ? loadingRecord : false)}
              className={labEditPrimaryButtonClass}
            >
              {saving ? (
                <>
                  <span>Update</span>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                </>
              ) : (
                <>
                  <span>Update</span>
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

export default function LabTestsSection() {
  return (
    <Suspense fallback={<SectionSkeleton variant="labTestMaster" rows={8} title="Loading" className="py-4" />}>
      <LabTestsSectionInner />
    </Suspense>
  )
}
