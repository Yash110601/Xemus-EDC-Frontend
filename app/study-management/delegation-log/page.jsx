"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import SectionSkeleton from "@/components/ui/section-skeleton"
import SearchableSelect from "@/components/ui/searchable-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useStudySiteContext } from "@/hooks/useStudySiteContext"
import studyService from "@/lib/services/study.service"
import siteService from "@/lib/services/site.service"
import studyDelegationLogService from "@/lib/services/studyDelegationLog.service"
import studyUserService from "@/lib/services/studyUser.service"
import rolesService from "@/lib/services/roles.service"
import {
  fetchStudySettingsByStudyId,
  pickIsDelegationLogEnabled,
} from "@/lib/utils/studySettingsRead"
import PiSignoffPasswordDialog from "@/components/pi-signoff/PiSignoffPasswordDialog"
import { downloadDelegationLogCsv } from "@/lib/utils/delegationLogCsvExport"
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
import { Ban, ClipboardList, Download, FileText, Loader2, Pencil, Plus, ShieldCheck, UserCheck } from "lucide-react"

const EMPTY_FORM = {
  siteId: "",
  delegatedUserId: "",
  roleGuid: "",
  taskDescription: "",
  startDate: "",
  endDate: "",
  gcpTrainingCompletedDate: "",
  cvVersionDate: "",
  qualificationsSummary: "",
}

function studyUserLabel(user) {
  const name = [user?.firstName ?? user?.FirstName, user?.lastName ?? user?.LastName]
    .filter(Boolean)
    .join(" ")
    .trim()
  const email = user?.email ?? user?.Email ?? ""
  const id = user?.userId ?? user?.UserId ?? user?.id ?? user?.Id
  return name ? `${name}${email ? ` (${email})` : ""}` : email || `User ${id}`
}

function rowToForm(row) {
  return {
    siteId: String(row.siteId ?? row.SiteId ?? ""),
    delegatedUserId: String(row.delegatedUserId ?? row.DelegatedUserId ?? ""),
    roleGuid: String(row.roleGuid ?? row.RoleGuid ?? ""),
    taskDescription: row.taskDescription ?? row.TaskDescription ?? "",
    startDate: String(row.startDate ?? row.StartDate ?? "").slice(0, 10),
    endDate: row.endDate ?? row.EndDate ? String(row.endDate ?? row.EndDate).slice(0, 10) : "",
    gcpTrainingCompletedDate: row.gcpTrainingCompletedDate ?? row.GcpTrainingCompletedDate
      ? String(row.gcpTrainingCompletedDate ?? row.GcpTrainingCompletedDate).slice(0, 10)
      : "",
    cvVersionDate: row.cvVersionDate ?? row.CvVersionDate
      ? String(row.cvVersionDate ?? row.CvVersionDate).slice(0, 10)
      : "",
    qualificationsSummary: row.qualificationsSummary ?? row.QualificationsSummary ?? "",
  }
}

function buildEntryPayload(form, studyId, isActive = true) {
  return {
    studyId,
    siteId: parseInt(form.siteId, 10),
    delegatedUserId: parseInt(form.delegatedUserId, 10),
    roleGuid: form.roleGuid,
    taskDescription: form.taskDescription.trim(),
    startDate: form.startDate,
    endDate: form.endDate || null,
    gcpTrainingCompletedDate: form.gcpTrainingCompletedDate || null,
    cvVersionDate: form.cvVersionDate || null,
    qualificationsSummary: form.qualificationsSummary?.trim() || null,
    isActive,
  }
}

function buildSiteUserOptions(studyUsers, siteId) {
  return studyUsers
    .filter((su) => !siteId || String(su.siteId ?? su.SiteId) === String(siteId))
    .map((su) => {
      const userId = su.userId ?? su.UserId ?? su.id ?? su.Id
      return {
        value: String(userId),
        label: studyUserLabel(su),
      }
    })
    .filter((o) => o.value && o.value !== "undefined")
}

function validateDelegationForm(form) {
  if (!form.siteId) return "Site is required"
  if (!form.delegatedUserId) return "Delegated user is required"
  if (!form.roleGuid) return "Role is required"
  if (!form.taskDescription?.trim()) return "Task description is required"
  if (!form.startDate) return "Start date is required"
  return null
}

function DelegationEntryFields({ form, setForm, sites, siteUserOptions, roles }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <SearchableSelect
        value={form.siteId}
        onValueChange={(v) => setForm((p) => ({ ...p, siteId: v, delegatedUserId: "" }))}
        options={sites.map((s) => ({
          value: String(s.id ?? s.Id),
          label: s.siteName ?? s.SiteName ?? `Site ${s.id ?? s.Id}`,
        }))}
        placeholder="Site *"
      />
      <SearchableSelect
        value={form.delegatedUserId}
        onValueChange={(v) => setForm((p) => ({ ...p, delegatedUserId: v }))}
        options={siteUserOptions}
        placeholder="Delegated user *"
        disabled={!form.siteId}
      />
      <SearchableSelect
        value={form.roleGuid}
        onValueChange={(v) => setForm((p) => ({ ...p, roleGuid: v }))}
        options={roles.map((r) => ({
          value: String(r.roleGuid ?? r.RoleGuid ?? r.guid ?? r.Guid),
          label: r.name ?? r.Name ?? r.roleName,
        }))}
        placeholder="Role *"
      />
      <Input
        type="date"
        value={form.startDate}
        onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
        aria-label="Start date"
      />
      <Input
        type="date"
        value={form.endDate}
        onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
        aria-label="End date"
      />
      <Input
        className="md:col-span-2"
        placeholder="Task description *"
        value={form.taskDescription}
        onChange={(e) => setForm((p) => ({ ...p, taskDescription: e.target.value }))}
      />
      <Input
        className="md:col-span-2"
        placeholder="Qualifications / training summary (optional)"
        value={form.qualificationsSummary}
        onChange={(e) => setForm((p) => ({ ...p, qualificationsSummary: e.target.value }))}
      />
      <Input
        type="date"
        value={form.gcpTrainingCompletedDate}
        onChange={(e) => setForm((p) => ({ ...p, gcpTrainingCompletedDate: e.target.value }))}
        aria-label="GCP training date"
      />
      <Input
        type="date"
        value={form.cvVersionDate}
        onChange={(e) => setForm((p) => ({ ...p, cvVersionDate: e.target.value }))}
        aria-label="CV version date"
      />
    </div>
  )
}

function StudyDelegationLogPageContent() {
  const searchParams = useSearchParams()
  const { studyId: headerStudyId, ready: headerReady } = useStudySiteContext()
  const [studies, setStudies] = useState([])
  const [sites, setSites] = useState([])
  const [roles, setRoles] = useState([])
  const [studyUsers, setStudyUsers] = useState([])
  const [studyId, setStudyId] = useState("")
  const [siteFilter, setSiteFilter] = useState("")
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [isDelegationLogEnabled, setIsDelegationLogEnabled] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editOpen, setEditOpen] = useState(false)
  const [editRowId, setEditRowId] = useState(null)
  const [editForm, setEditForm] = useState(EMPTY_FORM)
  const [editIsActive, setEditIsActive] = useState(true)
  const [editSaving, setEditSaving] = useState(false)
  const [deactivateTarget, setDeactivateTarget] = useState(null)
  const [deactivating, setDeactivating] = useState(false)
  const [signTarget, setSignTarget] = useState(null)
  const [signSaving, setSignSaving] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)

  const queryStudyId = searchParams.get("studyId")

  const selectedStudyLabel = useMemo(() => {
    const match = studies.find((s) => String(s.id ?? s.Id) === String(studyId))
    return match?.studyProtocolNumber ?? match?.name ?? (studyId ? `Study ${studyId}` : "study")
  }, [studies, studyId])

  useEffect(() => {
    if (queryStudyId) setStudyId(String(queryStudyId))
    else if (headerReady && headerStudyId) setStudyId(String(headerStudyId))
  }, [headerReady, headerStudyId, queryStudyId])

  useEffect(() => {
    studyService.getStudiesForDropdown().then((res) => {
      if (res?.isSuccess && Array.isArray(res.data)) setStudies(res.data)
    })
    rolesService.getRolesForDropdown?.().then((res) => {
      const list = res?.data ?? res?.Data ?? []
      if (Array.isArray(list)) setRoles(list)
    })
  }, [])

  useEffect(() => {
    const numericId = parseInt(studyId, 10)
    if (!Number.isFinite(numericId) || numericId <= 0) {
      setIsDelegationLogEnabled(null)
      setRows([])
      return
    }
    let mounted = true
    setLoadingSettings(true)
    fetchStudySettingsByStudyId(numericId)
      .then((res) => {
        if (!mounted) return
        const data = res?.data ?? res
        setIsDelegationLogEnabled(pickIsDelegationLogEnabled(data))
      })
      .catch(() => {
        if (mounted) setIsDelegationLogEnabled(false)
      })
      .finally(() => {
        if (mounted) setLoadingSettings(false)
      })
    return () => {
      mounted = false
    }
  }, [studyId])

  useEffect(() => {
    if (!studyId) {
      setSites([])
      setStudyUsers([])
      return
    }
    siteService.getSitesForDropdown(studyId).then((res) => {
      const list = res?.data ?? res?.Data ?? []
      setSites(Array.isArray(list) ? list : [])
    })
    studyUserService.getStudyUsersByStudy(studyId).then((res) => {
      const list = res?.data ?? res?.Data ?? []
      setStudyUsers(Array.isArray(list) ? list : [])
    })
  }, [studyId])

  const siteUserOptions = useMemo(
    () => buildSiteUserOptions(studyUsers, form.siteId),
    [form.siteId, studyUsers],
  )

  const editSiteUserOptions = useMemo(
    () => buildSiteUserOptions(studyUsers, editForm.siteId),
    [editForm.siteId, studyUsers],
  )

  const loadEntries = useCallback(async () => {
    const numericId = parseInt(studyId, 10)
    if (!Number.isFinite(numericId) || numericId <= 0) {
      setRows([])
      return
    }
    if (isDelegationLogEnabled === false) {
      setRows([])
      return
    }
    if (isDelegationLogEnabled !== true) return

    setLoading(true)
    try {
      const res = await studyDelegationLogService.getEntries(
        numericId,
        siteFilter ? parseInt(siteFilter, 10) : null,
      )
      setRows(Array.isArray(res?.data) ? res.data : [])
    } catch (error) {
      toast.error(error?.message || "Failed to load delegation log")
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [isDelegationLogEnabled, siteFilter, studyId])

  useEffect(() => {
    void loadEntries()
  }, [loadEntries])

  const handleCreate = async () => {
    const numericStudyId = parseInt(studyId, 10)
    if (!Number.isFinite(numericStudyId) || numericStudyId <= 0) {
      toast.error("Study is required")
      return
    }
    if (!isDelegationLogEnabled) {
      toast.error("Enable delegation log in Study Settings for this study")
      return
    }
    const validationError = validateDelegationForm(form)
    if (validationError) {
      toast.error(validationError)
      return
    }
    setSaving(true)
    try {
      await studyDelegationLogService.createEntry(buildEntryPayload(form, numericStudyId, true))
      toast.success("Delegation entry added")
      setForm(EMPTY_FORM)
      await loadEntries()
    } catch (error) {
      toast.error(error?.message || "Save failed")
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (row) => {
    setEditRowId(row.id ?? row.Id)
    setEditForm(rowToForm(row))
    setEditIsActive(row.isActive ?? row.IsActive ?? true)
    setEditOpen(true)
  }

  const handleUpdate = async () => {
    const numericStudyId = parseInt(studyId, 10)
    if (!editRowId || !Number.isFinite(numericStudyId)) return
    const validationError = validateDelegationForm(editForm)
    if (validationError) {
      toast.error(validationError)
      return
    }
    setEditSaving(true)
    try {
      await studyDelegationLogService.updateEntry(editRowId, {
        id: editRowId,
        ...buildEntryPayload(editForm, numericStudyId, editIsActive),
      })
      toast.success("Delegation entry updated")
      setEditOpen(false)
      setEditRowId(null)
      await loadEntries()
    } catch (error) {
      toast.error(error?.message || "Update failed")
    } finally {
      setEditSaving(false)
    }
  }

  const handleDeactivateConfirm = async () => {
    const numericStudyId = parseInt(studyId, 10)
    const entryId = deactivateTarget?.id ?? deactivateTarget?.Id
    if (!entryId || !Number.isFinite(numericStudyId)) return
    setDeactivating(true)
    try {
      await studyDelegationLogService.deactivateEntry(entryId, numericStudyId)
      toast.success("Delegation entry deactivated")
      setDeactivateTarget(null)
      await loadEntries()
    } catch (error) {
      toast.error(error?.message || "Deactivate failed")
    } finally {
      setDeactivating(false)
    }
  }

  const handleExportCsv = () => {
    if (!rows.length) {
      toast.error("No entries to export")
      return
    }
    downloadDelegationLogCsv(rows, selectedStudyLabel)
    toast.success("Delegation log exported (CSV)")
  }

  const handleExportPdf = async () => {
    const numericStudyId = parseInt(studyId, 10)
    if (!Number.isFinite(numericStudyId) || !rows.length) {
      toast.error("No entries to export")
      return
    }
    setExportingPdf(true)
    try {
      await studyDelegationLogService.exportPdf(
        numericStudyId,
        siteFilter ? parseInt(siteFilter, 10) : null,
      )
      toast.success("Delegation log exported (PDF)")
    } catch (error) {
      toast.error(error?.message || "PDF export failed")
    } finally {
      setExportingPdf(false)
    }
  }

  const handleSignConfirm = async (password, _reason, comment) => {
    const numericStudyId = parseInt(studyId, 10)
    const entryId = signTarget?.id ?? signTarget?.Id
    if (!entryId || !Number.isFinite(numericStudyId)) return
    setSignSaving(true)
    try {
      await studyDelegationLogService.signEntry(entryId, {
        studyId: numericStudyId,
        password,
        comment,
      })
      toast.success("Delegation entry signed")
      setSignTarget(null)
      await loadEntries()
    } catch (error) {
      toast.error(error?.message || "Sign failed")
    } finally {
      setSignSaving(false)
    }
  }

  return (
    <DashboardLayout>
      <div className={REPORT_PAGE_SHELL_CLASS}>
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-indigo-600" />
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Delegation Log</h1>
              <p className="text-sm text-slate-600">
                ICH GCP delegation of authority — enabled per study in Study Settings
              </p>
            </div>
          </div>
          {isDelegationLogEnabled && rows.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleExportCsv}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={exportingPdf} onClick={() => void handleExportPdf()}>
                {exportingPdf ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                Export PDF
              </Button>
            </div>
          ) : null}
        </div>

        {studyId && !loadingSettings && isDelegationLogEnabled === false ? (
          <div className={`${REPORT_CARD_CLASS} p-6 mb-6 border-amber-200/80 bg-amber-50/60`}>
            <p className="text-sm font-semibold text-amber-900">Delegation log is not enabled for this study</p>
            <p className="mt-1 text-sm text-amber-800/90">
              Turn on <strong>Delegation log enabled</strong> in Study Settings to record delegated tasks for this study.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link href={`/study-management/study-settings?studyId=${encodeURIComponent(studyId)}`}>
                Open Study Settings
              </Link>
            </Button>
          </div>
        ) : null}

        <div className={`${REPORT_CARD_CLASS} p-6 mb-6 grid gap-4 md:grid-cols-3`}>
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Study *</label>
            <SearchableSelect
              value={studyId}
              onValueChange={setStudyId}
              options={studies.map((s) => ({
                value: String(s.id ?? s.Id),
                label: s.studyProtocolNumber ?? s.name ?? `Study ${s.id ?? s.Id}`,
              }))}
              placeholder="Select study"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700 mb-1.5 block">Filter by site</label>
            <SearchableSelect
              value={siteFilter}
              onValueChange={setSiteFilter}
              options={[
                { value: "", label: "All sites" },
                ...sites.map((s) => ({
                  value: String(s.id ?? s.Id),
                  label: s.siteName ?? s.SiteName ?? `Site ${s.id ?? s.Id}`,
                })),
              ]}
              placeholder="All sites"
            />
          </div>
        </div>

        {isDelegationLogEnabled ? (
          <div className={`${REPORT_CARD_CLASS} p-6 mb-6 space-y-4`}>
            <div className="flex items-center gap-2 text-slate-800 font-semibold">
              <Plus className="w-4 h-4" />
              Add delegation entry
            </div>
            <DelegationEntryFields
              form={form}
              setForm={setForm}
              sites={sites}
              siteUserOptions={siteUserOptions}
              roles={roles}
            />
            <Button type="button" className={REPORT_PRIMARY_BTN_CLASS} disabled={saving} onClick={() => void handleCreate()}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserCheck className="w-4 h-4 mr-2" />}
              Add entry
            </Button>
          </div>
        ) : null}

        <div className={REPORT_CARD_CLASS}>
          {loadingSettings ? (
            <SectionSkeleton variant="table" rows={4} />
          ) : loading ? (
            <SectionSkeleton variant="table" rows={6} />
          ) : (
            <div className={REPORT_TABLE_SCROLL_CLASS}>
              <table className="w-full text-sm">
                <thead>
                  <tr className={REPORT_TABLE_HEAD_ROW_CLASS}>
                    <th className={REPORT_TABLE_TH_CLASS}>Site</th>
                    <th className={REPORT_TABLE_TH_CLASS}>User</th>
                    <th className={REPORT_TABLE_TH_CLASS}>Role</th>
                    <th className={REPORT_TABLE_TH_CLASS}>Task</th>
                    <th className={REPORT_TABLE_TH_CLASS}>Start</th>
                    <th className={REPORT_TABLE_TH_CLASS}>End</th>
                    <th className={REPORT_TABLE_TH_CLASS}>PI sign</th>
                    <th className={REPORT_TABLE_TH_CLASS}>Status</th>
                    {isDelegationLogEnabled ? (
                      <th className={`${REPORT_TABLE_TH_CLASS} text-right`}>Actions</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className={REPORT_TABLE_BODY_CLASS}>
                  {rows.length === 0 ? (
                    <tr className={REPORT_TABLE_TR_CLASS}>
                      <td
                        colSpan={isDelegationLogEnabled ? 9 : 8}
                        className={`${REPORT_TABLE_TD_CLASS} text-center text-slate-500 py-8`}
                      >
                        No delegation entries for this study.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const isActive = row.isActive ?? row.IsActive
                      const isPiSigned = row.isPiSigned ?? row.IsPiSigned ?? Boolean(row.piSignedAt ?? row.PiSignedAt)
                      return (
                        <tr key={row.id ?? row.Id} className={REPORT_TABLE_TR_CLASS}>
                          <td className={REPORT_TABLE_TD_CLASS}>{row.siteName ?? row.SiteName ?? "—"}</td>
                          <td className={REPORT_TABLE_TD_CLASS}>
                            {row.delegatedUserName ?? row.DelegatedUserName ?? row.delegatedUserId}
                            {row.delegatedUserEmail ?? row.DelegatedUserEmail ? (
                              <span className="block text-xs text-slate-500">
                                {row.delegatedUserEmail ?? row.DelegatedUserEmail}
                              </span>
                            ) : null}
                          </td>
                          <td className={REPORT_TABLE_TD_CLASS}>{row.roleName ?? row.RoleName ?? "—"}</td>
                          <td className={REPORT_TABLE_TD_CLASS}>{row.taskDescription ?? row.TaskDescription}</td>
                          <td className={REPORT_TABLE_TD_CLASS}>
                            {String(row.startDate ?? row.StartDate ?? "").slice(0, 10)}
                          </td>
                          <td className={REPORT_TABLE_TD_CLASS}>
                            {row.endDate ?? row.EndDate ? String(row.endDate ?? row.EndDate).slice(0, 10) : "—"}
                          </td>
                          <td className={REPORT_TABLE_TD_CLASS}>
                            {isPiSigned ? (
                              <span className="text-emerald-700 text-xs">
                                {row.piSignedByName ?? row.PiSignedByName ?? "Signed"}
                                <span className="block text-slate-500">
                                  {String(row.piSignedAt ?? row.PiSignedAt ?? "").slice(0, 16).replace("T", " ")}
                                </span>
                              </span>
                            ) : (
                              <span className="text-amber-700 text-xs">Pending</span>
                            )}
                          </td>
                          <td className={REPORT_TABLE_TD_CLASS}>{isActive ? "Active" : "Inactive"}</td>
                          {isDelegationLogEnabled ? (
                            <td className={`${REPORT_TABLE_TD_CLASS} text-right whitespace-nowrap`}>
                              {!isPiSigned && isActive ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2 text-indigo-700"
                                  onClick={() => setSignTarget(row)}
                                  aria-label="PI sign delegation entry"
                                >
                                  <ShieldCheck className="w-4 h-4" />
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2"
                                onClick={() => openEdit(row)}
                                aria-label="Edit delegation entry"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              {isActive ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2 text-amber-700 hover:text-amber-800"
                                  onClick={() => setDeactivateTarget(row)}
                                  aria-label="Deactivate delegation entry"
                                >
                                  <Ban className="w-4 h-4" />
                                </Button>
                              ) : null}
                            </td>
                          ) : null}
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit delegation entry</DialogTitle>
            <DialogDescription>Update delegated task details. Does not change eCRF or user access.</DialogDescription>
          </DialogHeader>
          <DelegationEntryFields
            form={editForm}
            setForm={setEditForm}
            sites={sites}
            siteUserOptions={editSiteUserOptions}
            roles={roles}
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={editIsActive}
              onChange={(e) => setEditIsActive(e.target.checked)}
              className="rounded border-slate-300"
            />
            Active
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleUpdate()} disabled={editSaving}>
              {editSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deactivateTarget)} onOpenChange={(open) => !open && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate delegation entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This marks the delegation as inactive and sets an end date if missing. It does not remove the user from
              the study or block eCRF access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deactivating}
              onClick={(e) => {
                e.preventDefault()
                void handleDeactivateConfirm()
              }}
            >
              {deactivating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PiSignoffPasswordDialog
        open={Boolean(signTarget)}
        onOpenChange={(open) => !open && setSignTarget(null)}
        mode="apply"
        title="PI sign delegation entry"
        description="By entering your password, you confirm PI approval of this delegation record. This does not change eCRF access."
        confirmLabel="Sign delegation"
        loading={signSaving}
        showComment
        onConfirm={(password, comment) => void handleSignConfirm(password, comment)}
      />
    </DashboardLayout>
  )
}

export default function StudyDelegationLogPage() {
  return (
    <Suspense fallback={<DashboardLayout><SectionSkeleton variant="table" rows={6} /></DashboardLayout>}>
      <StudyDelegationLogPageContent />
    </Suspense>
  )
}
