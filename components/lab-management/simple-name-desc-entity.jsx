"use client"
/* eslint-disable react-hooks/set-state-in-effect -- paged lists: reset page on filter change & fetch when deps update */

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
import { cn } from "@/lib/utils"
import { field, fieldStr } from "./lab-field-utils"
import {
  LabFormSection,
  LabFieldLabel,
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

const NAME_MAX = 100
const DESC_MAX = 500

const fieldClass =
  "rounded-2xl border border-slate-200/85 bg-white/95 px-3.5 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] outline-none transition focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-400/25 dark:border-slate-600 dark:bg-slate-900/85"
const textareaClass =
  "mt-2 flex min-h-[108px] w-full rounded-2xl border border-slate-200/85 bg-white/95 px-3 py-2.5 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] outline-none transition focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-400/25 dark:border-slate-600 dark:bg-slate-900/75"

function emptyForm() {
  return { name: "", description: "" }
}

/**
 * @param {object} props
 * @param {string} props.nameLabel - e.g. "Unit name"
 * @param {string} [props.sectionTitle] - Page shell title (e.g. "Lab units"); edit modal shows `Edit ${sectionTitle}`.
 * @param {object} props.api - { getList, getById, create, update, updateStatus, exportCsv }
 */
export default function SimpleNameDescEntity({ nameLabel, sectionTitle, api }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const idFromUrl = searchParams.get("id")

  const entityShort = useMemo(
    () => nameLabel.replace(/\s*name\s*$/i, "").trim() || "Record",
    [nameLabel]
  )

  const [tab, setTab] = useState("create")
  const [createForm, setCreateForm] = useState(emptyForm)
  const [editOpen, setEditOpen] = useState(false)
  const [modalEditId, setModalEditId] = useState(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [loadingRecord, setLoadingRecord] = useState(false)
  const [saving, setSaving] = useState(false)

  const [items, setItems] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [activeFilter, setActiveFilter] = useState("all")
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState({})

  const editDialogHeading = useMemo(() => {
    const st = sectionTitle?.trim()
    if (st) return `Edit ${st}`
    if (loadingRecord && modalEditId) return `Edit ${entityShort}`
    if (editForm.name.trim()) return `Edit: ${editForm.name.trim()}`
    return `Edit ${entityShort}`
  }, [sectionTitle, loadingRecord, modalEditId, entityShort, editForm.name])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 400)
    return () => clearTimeout(t)
  }, [searchTerm])

  useEffect(() => {
    setPageNumber(1)
  }, [debouncedSearch, activeFilter])

  const isActiveParam =
    activeFilter === "all" ? null : activeFilter === "true"

  const fetchList = useCallback(async () => {
    setLoadingList(true)
    try {
      const res = await api.getList(pageNumber, pageSize, debouncedSearch || null, isActiveParam)
      if (res.isSuccess && res.data) {
        setItems(res.data.items || [])
        setTotalCount(res.data.totalCount ?? 0)
        setTotalPages(res.data.totalPages ?? 0)
      } else {
        setItems([])
        setTotalCount(0)
        setTotalPages(0)
        labToastError(res.message || "Failed to load list")
      }
    } catch (e) {
      setItems([])
      labToastError(e.message)
    } finally {
      setLoadingList(false)
    }
  }, [api, pageNumber, pageSize, debouncedSearch, isActiveParam])

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
        const res = await api.getById(modalEditId)
        if (cancelled) return
        const row = res.data
        if (res.isSuccess && row) {
          setEditForm({
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
  }, [editOpen, modalEditId, api])

  const closeEditModal = () => {
    setEditOpen(false)
    setModalEditId(null)
    setEditForm(emptyForm())
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
    if (!name) {
      labToastError("Name is required.")
      return
    }
    if (name.length > NAME_MAX) {
      labToastError(`Name must be at most ${NAME_MAX} characters.`)
      return
    }
    if (createForm.description.length > DESC_MAX) {
      labToastError(`Description must be at most ${DESC_MAX} characters.`)
      return
    }
    setSaving(true)
    try {
      const body = { name, description: createForm.description.trim() || null }
      const res = await api.create(body)
      if (res.isSuccess) {
        labToastSuccess("Created successfully.")
        setCreateForm(emptyForm())
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
    if (!name) {
      labToastError("Name is required.")
      return
    }
    if (name.length > NAME_MAX) {
      labToastError(`Name must be at most ${NAME_MAX} characters.`)
      return
    }
    if (editForm.description.length > DESC_MAX) {
      labToastError(`Description must be at most ${DESC_MAX} characters.`)
      return
    }
    if (!modalEditId) return
    setSaving(true)
    try {
      const body = { name, description: editForm.description.trim() || null }
      const res = await api.update(modalEditId, body)
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
      const r = await api.exportCsv(debouncedSearch || null, isActiveParam)
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
      const res = await api.updateStatus(id, nextActive)
      if (res.isSuccess) fetchList()
      else labToastError(res.message || "Status update failed")
    } finally {
      setStatusUpdating((s) => ({ ...s, [id]: false }))
    }
  }

  const createClear = () => setCreateForm(emptyForm())

  return (
    <div className="space-y-6">
      <LabSectionModeTabs value={tab} onChange={setTab} />

      {tab === "create" && (
        <LabPanelCard
          title="New record"
          subtitle="Required fields are marked. Values are trimmed on save."
          icon={FileEdit}
        >
          <LabFormSection>
            <div className="space-y-5">
              <div>
                <LabFieldLabel required>{nameLabel}</LabFieldLabel>
                <Input
                  className={`mt-2 h-11 ${fieldClass}`}
                  value={createForm.name}
                  maxLength={NAME_MAX}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={`Enter ${nameLabel.toLowerCase()}`}
                />
                <p className="mt-1 text-xs font-medium text-slate-500">
                  {createForm.name.length} / {NAME_MAX}
                </p>
              </div>
              <div>
                <LabFieldLabel>Description</LabFieldLabel>
                <textarea
                  className={textareaClass}
                  value={createForm.description}
                  maxLength={DESC_MAX}
                  onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description"
                />
                <p className="mt-1 text-xs font-medium text-slate-500">
                  {createForm.description.length} / {DESC_MAX}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  onClick={handleCreateSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 font-semibold text-white shadow-md hover:bg-emerald-700"
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
                  onClick={createClear}
                  className="inline-flex items-center gap-2 rounded-xl border-2"
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
            subtitle="Filters apply to the grid and CSV export."
            icon={Filter}
          >
            <div className="grid w-full grid-cols-1 items-end gap-x-6 gap-y-5 lg:grid-cols-[minmax(0,1fr)_13rem_auto]">
              <div className="min-w-0 space-y-2">
                <LabFieldLabel className="block w-full leading-tight">Search</LabFieldLabel>
                <div className="relative">
                  <Input
                    className={cn("h-11", labManageSearchInputPadClass, fieldClass)}
                    placeholder="Search by name or description…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <Search className={labManageSearchIconClass} aria-hidden />
                </div>
              </div>
              <LabStatusFilterSelect value={activeFilter} onChange={setActiveFilter} />
              <div className="flex w-full shrink-0 justify-stretch pb-0.5 lg:w-auto lg:justify-end">
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
            <LabTableSkeleton variant="labSimpleMaster" rows={8} title="Loading records" />
          ) : (
            <>
              <LabTableFrame>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                    <thead className={labManageGridTheadClass}>
                      <tr>
                        <th className={labManageGridTh()}>Name</th>
                        <th className={labManageGridTh()}>Description</th>
                        <th className={labManageGridTh("text-center")}>Status</th>
                        <th className={labManageGridTh("text-center")}>Action</th>
                      </tr>
                    </thead>
                    <tbody className={labManageGridTbodyClass}>
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-14 text-center text-sm font-medium text-slate-500">
                            No records found.
                          </td>
                        </tr>
                      ) : (
                        items.map((row) => {
                          const id = field(row, "id", "Id")
                          const active = Boolean(field(row, "isActive", "IsActive"))
                          const rowLabel = fieldStr(row, ["name", "Name"], "This record")
                          return (
                            <tr key={id} className={labManageGridTrClass}>
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
        <DialogContent
          className={cn(labEditDialogContentClass, "max-h-[90vh] sm:max-w-lg")}
        >
          <LabEditDialogHeader icon={FileEdit}>
            <DialogTitle className="text-xl font-semibold leading-snug tracking-tight text-slate-900 dark:text-slate-50">
              {editDialogHeading}
            </DialogTitle>
          </LabEditDialogHeader>
          <LabEditDialogBody className="max-h-[min(60vh,520px)]">
            {loadingRecord && modalEditId ? (
              <LabEditFormSkeleton variant="simple" className="!px-0 !py-2" />
            ) : (
              <LabFormSection surface="modal">
                <div className="space-y-5">
                  <div>
                    <LabFieldLabel required>{nameLabel}</LabFieldLabel>
                    <Input
                      className={`mt-2 h-11 ${fieldClass}`}
                      value={editForm.name}
                      maxLength={NAME_MAX}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder={`Enter ${nameLabel.toLowerCase()}`}
                    />
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      {editForm.name.length} / {NAME_MAX}
                    </p>
                  </div>
                  <div>
                    <LabFieldLabel>Description</LabFieldLabel>
                    <textarea
                      className={textareaClass}
                      value={editForm.description}
                      maxLength={DESC_MAX}
                      onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Optional description"
                    />
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      {editForm.description.length} / {DESC_MAX}
                    </p>
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

export function SimpleNameDescEntitySuspense(props) {
  return (
    <Suspense
      fallback={
        <SectionSkeleton variant="labSimpleMaster" rows={8} title="Loading" className="py-4" />
      }
    >
      <SimpleNameDescEntity {...props} />
    </Suspense>
  )
}
