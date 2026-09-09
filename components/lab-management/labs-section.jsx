"use client"
/* eslint-disable react-hooks/set-state-in-effect -- paged lab master list & edit hydration */

import { useState, useEffect, useCallback, Suspense } from "react"
import { fetchIndianPincodeLocation } from "@/lib/utils/indianPincodeLookup"
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
import labManagementService from "@/lib/services/labManagement.service"
import { field, fieldStr } from "./lab-field-utils"
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
const CONTACT_MAX = 50
const ADDR_MAX = 500
const PINCODE_LEN = 6

const inputCls =
  "rounded-2xl border border-slate-200/85 bg-white/95 px-3.5 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] outline-none transition focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-400/25 dark:border-slate-600 dark:bg-slate-900/85"
const textareaCls =
  "flex min-h-[72px] w-full rounded-2xl border border-slate-200/85 bg-white/95 px-3 py-2 text-sm outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-400/25 dark:border-slate-600 dark:bg-slate-900/75"

function emptyForm() {
  return {
    name: "",
    description: "",
    contact: "",
    address: "",
    pincode: "",
    city: "",
    state: "",
    country: "",
  }
}

function LabsSectionInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const idFromUrl = searchParams.get("id")

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
  const [pinLookupLoading, setPinLookupLoading] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 400)
    return () => clearTimeout(t)
  }, [searchTerm])

  useEffect(() => {
    setPageNumber(1)
  }, [debouncedSearch, activeFilter])

  const isActiveParam = activeFilter === "all" ? null : activeFilter === "true"

  const fetchList = useCallback(async () => {
    setLoadingList(true)
    try {
      const res = await labManagementService.getLabsList(
        pageNumber,
        pageSize,
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
  }, [pageNumber, pageSize, debouncedSearch, isActiveParam])

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
        const res = await labManagementService.getLabById(modalEditId)
        if (cancelled) return
        const row = res.data
        if (res.isSuccess && row) {
          setEditForm({
            name: fieldStr(row, ["name", "labName", "Name", "LabName"], ""),
            description: fieldStr(row, ["description", "Description"], ""),
            contact: fieldStr(row, ["contact", "Contact"], ""),
            address: fieldStr(row, ["address", "Address"], ""),
            pincode: fieldStr(row, ["pincode", "pinCode", "PinCode"], ""),
            city: fieldStr(row, ["city", "City"], ""),
            state: fieldStr(row, ["state", "State"], ""),
            country: fieldStr(row, ["country", "Country"], ""),
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
    setEditForm(emptyForm())
    router.replace(pathname)
  }

  const openEdit = (id) => {
    const sid = String(id)
    setModalEditId(sid)
    setEditOpen(true)
    router.replace(`${pathname}?id=${encodeURIComponent(sid)}`)
  }

  const validate = (f) => {
    const name = f.name.trim()
    if (!name) return "Lab name is required."
    if (name.length > NAME_MAX) return `Name must be at most ${NAME_MAX} characters.`
    if (f.description.length > DESC_MAX) return `Description must be at most ${DESC_MAX} characters.`
    if (f.contact.length > CONTACT_MAX) return `Contact must be at most ${CONTACT_MAX} characters.`
    if (f.address.length > ADDR_MAX) return `Address must be at most ${ADDR_MAX} characters.`
    const pinDigits = String(f.pincode || "").replace(/\D/g, "")
    if (pinDigits.length > 0 && pinDigits.length < PINCODE_LEN) {
      return `Pin code must be ${PINCODE_LEN} digits or left blank.`
    }
    return null
  }

  const handlePincodeChange = useCallback((setF) => {
    return async (e) => {
      const raw = e.target.value
      const numericValue = raw.replace(/\D/g, "").slice(0, PINCODE_LEN)
      setF((x) => ({ ...x, pincode: numericValue }))
      if (numericValue.length === PINCODE_LEN) {
        setPinLookupLoading(true)
        try {
          const location = await fetchIndianPincodeLocation(numericValue)
          if (location) {
            setF((x) => ({
              ...x,
              state: location.state,
              city: location.city,
              country: location.country ? location.country : x.country,
            }))
          } else {
            setF((x) => ({ ...x, state: "", city: "" }))
          }
        } finally {
          setPinLookupLoading(false)
        }
      } else if (numericValue.length < PINCODE_LEN) {
        setF((x) => ({ ...x, state: "", city: "" }))
      }
    }
  }, [])

  const handleCreateSave = async () => {
    const err = validate(createForm)
    if (err) {
      labToastError(err)
      return
    }
    setSaving(true)
    try {
      const pinDigits = createForm.pincode.replace(/\D/g, "").slice(0, PINCODE_LEN)
      const body = {
        name: createForm.name.trim(),
        description: createForm.description.trim() || null,
        contact: createForm.contact.trim() || null,
        address: createForm.address.trim() || null,
        pincode: pinDigits.length === PINCODE_LEN ? pinDigits : null,
        city: createForm.city.trim() || null,
        state: createForm.state.trim() || null,
        country: createForm.country.trim() || null,
      }
      const res = await labManagementService.createLab(body)
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
    const err = validate(editForm)
    if (err) {
      labToastError(err)
      return
    }
    if (!modalEditId) return
    setSaving(true)
    try {
      const pinDigits = editForm.pincode.replace(/\D/g, "").slice(0, PINCODE_LEN)
      const body = {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        contact: editForm.contact.trim() || null,
        address: editForm.address.trim() || null,
        pincode: pinDigits.length === PINCODE_LEN ? pinDigits : null,
        city: editForm.city.trim() || null,
        state: editForm.state.trim() || null,
        country: editForm.country.trim() || null,
      }
      const res = await labManagementService.updateLab(modalEditId, body)
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
      const r = await labManagementService.exportLabsCsv(debouncedSearch || null, isActiveParam)
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
      const res = await labManagementService.updateLabStatus(id, nextActive)
      if (res.isSuccess) fetchList()
      else labToastError(res.message || "Status update failed")
    } finally {
      setStatusUpdating((s) => ({ ...s, [id]: false }))
    }
  }

  const renderChar = (cur, max) => (
    <p className="mt-1 text-xs font-medium text-slate-500">
      {cur.length} / {max}
    </p>
  )

  const formGrid = (f, setF) => (
    <div className="grid gap-5 md:grid-cols-2">
      {/* Row 1: Lab name | Contact */}
      <div>
        <LabFieldLabel required>Lab name</LabFieldLabel>
        <Input className={`mt-2 h-11 ${inputCls}`} value={f.name} maxLength={NAME_MAX} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} />
        {renderChar(f.name, NAME_MAX)}
      </div>
      <div>
        <LabFieldLabel>Contact</LabFieldLabel>
        <Input
          className={`mt-2 h-11 ${inputCls}`}
          value={f.contact}
          maxLength={CONTACT_MAX}
          onChange={(e) => setF((x) => ({ ...x, contact: e.target.value }))}
        />
        {renderChar(f.contact, CONTACT_MAX)}
      </div>
      {/* Row 2: Pin code | City */}
      <div>
        <LabFieldLabel>Pin code</LabFieldLabel>
        <div className="relative mt-2">
          <Input
            className={cn("h-11 pr-10", inputCls)}
            inputMode="numeric"
            autoComplete="postal-code"
            value={f.pincode}
            maxLength={PINCODE_LEN}
            onChange={(e) => {
              void handlePincodeChange(setF)(e)
            }}
            placeholder="Enter 6-digit PIN code"
            aria-busy={pinLookupLoading}
          />
          {pinLookupLoading ? (
            <Loader2
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400"
              aria-hidden
            />
          ) : null}
        </div>
        <p className="mt-1 text-xs font-medium text-slate-500">{(f.pincode || "").length} / {PINCODE_LEN}</p>
      </div>
      <div>
        <LabFieldLabel>City</LabFieldLabel>
        <Input
          className={`mt-2 h-11 ${inputCls}`}
          value={f.city}
          onChange={(e) => setF((x) => ({ ...x, city: e.target.value }))}
          placeholder="Auto-filled from PIN code"
        />
      </div>
      {/* Row 3: State | Country */}
      <div>
        <LabFieldLabel>State</LabFieldLabel>
        <Input
          className={`mt-2 h-11 ${inputCls}`}
          value={f.state}
          onChange={(e) => setF((x) => ({ ...x, state: e.target.value }))}
          placeholder="Auto-filled from PIN code"
        />
      </div>
      <div>
        <LabFieldLabel>Country</LabFieldLabel>
        <Input
          className={`mt-2 h-11 ${inputCls}`}
          value={f.country}
          onChange={(e) => setF((x) => ({ ...x, country: e.target.value }))}
          placeholder="Auto-filled from PIN code"
        />
      </div>
      {/* Row 4: Address (full width) */}
      <div className="md:col-span-2">
        <LabFieldLabel>Address</LabFieldLabel>
        <textarea
          className={`mt-2 ${textareaCls} min-h-[72px]`}
          value={f.address}
          maxLength={ADDR_MAX}
          onChange={(e) => setF((x) => ({ ...x, address: e.target.value }))}
        />
        {renderChar(f.address, ADDR_MAX)}
      </div>
      {/* Row 5: Description (full width) */}
      <div className="md:col-span-2">
        <LabFieldLabel>Description</LabFieldLabel>
        <textarea
          className={`mt-2 min-h-[88px] ${textareaCls}`}
          value={f.description}
          maxLength={DESC_MAX}
          onChange={(e) => setF((x) => ({ ...x, description: e.target.value }))}
        />
        {renderChar(f.description, DESC_MAX)}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <LabSectionModeTabs value={tab} onChange={setTab} />

      {tab === "create" && (
        <LabPanelCard
          title="New lab facility"
          subtitle="Lab master — contact and location fields follow backend length limits."
          icon={FileEdit}
        >
          <LabFormSection>
            {formGrid(createForm, setCreateForm)}
            <div className="flex flex-wrap gap-2 pt-4">
              <Button
                type="button"
                onClick={handleCreateSave}
                disabled={saving || pinLookupLoading}
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
                className="inline-flex items-center gap-2 rounded-xl border-2"
                onClick={() => setCreateForm(emptyForm())}
              >
                <span>Clear</span>
                <RotateCcw className="h-4 w-4 shrink-0" aria-hidden />
              </Button>
            </div>
          </LabFormSection>
        </LabPanelCard>
      )}

      {tab === "manage" && (
        <div className="space-y-5">
          <LabPanelCard title="Search & filters" subtitle="Same filters apply to the grid and CSV export." icon={Filter}>
            <div className="grid w-full grid-cols-1 items-end gap-x-6 gap-y-5 lg:grid-cols-[minmax(0,1fr)_13rem_auto]">
              <div className="min-w-0 space-y-2">
                <LabFieldLabel className="block w-full leading-tight">Search</LabFieldLabel>
                <div className="relative">
                  <Input
                    className={cn("h-11", labManageSearchInputPadClass, inputCls)}
                    placeholder="Search labs…"
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
            <LabTableSkeleton variant="labFacility" rows={8} title="Loading records" />
          ) : (
            <>
              <LabTableFrame>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[880px] border-collapse text-left text-sm">
                    <thead className={labManageGridTheadClass}>
                      <tr>
                        {["Name", "City", "Country", "Contact", "Status", "Action"].map((h) => (
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
                          <td colSpan={6} className="px-4 py-14 text-center text-sm font-medium text-slate-500">
                            No records found.
                          </td>
                        </tr>
                      ) : (
                        items.map((row) => {
                          const id = field(row, "id", "Id")
                          const active = Boolean(field(row, "isActive", "IsActive"))
                          const displayName = fieldStr(row, ["name", "labName", "Name", "LabName"])
                          return (
                            <tr key={id} className={labManageGridTrClass}>
                              <td className={labManageGridTd("font-semibold text-slate-900 dark:text-slate-100")}>
                                {displayName}
                              </td>
                              <td className={labManageGridTd()}>{fieldStr(row, ["city", "City"], "—")}</td>
                              <td className={labManageGridTd()}>{fieldStr(row, ["country", "Country"], "—")}</td>
                              <td className={labManageGridTd("max-w-[140px] truncate text-slate-600 dark:text-slate-400")}>
                                {fieldStr(row, ["contact", "Contact"], "—")}
                              </td>
                              <td className={labManageGridTd("text-center align-middle")}>
                                <LabStatusSwitchWithConfirm
                                  checked={active}
                                  busy={!!statusUpdating[id]}
                                  rowLabel={displayName || "This lab"}
                                  onConfirm={(nextActive) => applyStatusChange(row, nextActive)}
                                />
                              </td>
                              <td className={labManageGridTd("text-center align-middle")}>
                                <LabManageGridRowActions
                                  rowLabel={displayName || "This lab"}
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
        <DialogContent className={cn(labEditDialogContentClass, "max-h-[92vh] sm:max-w-2xl")}>
          <LabEditDialogHeader icon={FileEdit}>
            <DialogTitle className="text-xl font-semibold leading-snug tracking-tight text-slate-900 dark:text-slate-50">
              Edit Labs
            </DialogTitle>
          </LabEditDialogHeader>
          <LabEditDialogBody className="max-h-[min(58vh,560px)]">
            {loadingRecord && modalEditId ? (
              <LabEditFormSkeleton variant="facility" className="!px-0 !py-2" />
            ) : (
              <LabFormSection surface="modal">{formGrid(editForm, setEditForm)}</LabFormSection>
            )}
          </LabEditDialogBody>
          <DialogFooter className={labEditDialogFooterClass}>
            <Button type="button" variant="outline" className={labEditCancelButtonClass} onClick={closeEditModal}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleEditSave}
              disabled={saving || pinLookupLoading || (modalEditId ? loadingRecord : false)}
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

export default function LabsSection() {
  return (
    <Suspense fallback={<SectionSkeleton variant="labFacility" rows={8} title="Loading" className="py-4" />}>
      <LabsSectionInner />
    </Suspense>
  )
}
