"use client"

import { VIEWPORT_PANEL_SCROLL_CLASS } from "@/lib/ui/responsivePageUi"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import patientEnrolmentService from "@/lib/services/patientEnrolment.service"
import eConsentService from "@/lib/services/eConsent.service"
import ShareConsentInviteDialog from "@/components/econsent/ShareConsentInviteDialog"
import DataPagination from "@/components/ui/data-pagination"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { useStudySiteContext } from "@/hooks/useStudySiteContext"
import { useStudyEConsentRequiredForStudy } from "@/hooks/useStudyEConsentRequired"
import DatePicker from "@/components/ui/date-picker"
import GenderSegmentedControl from "@/components/patient-enrolment/GenderSegmentedControl"
import PatientEnrolmentPageShell from "@/components/patient-enrolment/PatientEnrolmentPageShell"
import { usePatientEnrolmentPermissions } from "@/components/patient-enrolment/usePatientEnrolmentPermissions"
import { usePatientIdentifierStudySettings } from "@/components/patient-enrolment/usePatientIdentifierStudySettings"
import { useStudyIwrsRtsmEnabled } from "@/components/patient-enrolment/useStudyIwrsRtsmEnabled"
import IwrsEnrolmentLinkBanner from "@/components/patient-enrolment/IwrsEnrolmentLinkBanner"
import platformService from "@/lib/services/platform.service"
import {
  buildIwrsSyncIndex,
  lookupIwrsSync,
} from "@/lib/platform/iwrsEnrolmentSync"
import {
  PE_ALERT_ERROR_CLASS,
  PE_ALERT_SUCCESS_CLASS,
  PE_BTN_CLEAR_CLASS,
  PE_BTN_SUBMIT_CLASS,
  PE_FOOTER_CLASS,
  PE_FORM_GRID_CLASS,
  PE_HINT_CLASS,
  PE_INPUT_CLASS,
  PE_INPUT_ERROR_CLASS,
  PE_LABEL_CLASS,
  PE_PANEL_CLASS,
  PE_REQUIRED_CLASS,
  PE_SECTION_FOLLOWING_CLASS,
  PE_SECTION_HEADER_CLASS,
  PE_SECTION_ICON_CLASS,
  PE_SHELL_CARD_CLASS,
} from "@/lib/study/patientEnrolmentFormUi"
import { econsentStatusBadge } from "@/lib/econsent/econsentUi"
import {
  convertDateToISO,
  convertISOToDateInput,
  formatDateForDisplay,
  resolveIsActive,
} from "@/lib/study/patientEnrolmentUtils"
import { cn } from "@/lib/utils"
import { unwrapPagedPayload } from "@/lib/utils/pagedApi"
import {
  Edit,
  X,
  Calendar,
  Search,
  Users,
  Save,
  Trash2,
  Loader2,
  Download,
  Plus,
  FileSignature,
  Link2,
} from "lucide-react"
import Link from "next/link"

export default function PatientEnrolmentManageView() {
  const router = useRouter()
  const { toast } = useToast()
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [editingPatient, setEditingPatient] = useState(null)
  const [editFormData, setEditFormData] = useState(null)
  const [editErrors, setEditErrors] = useState({})
  const [editLoading, setEditLoading] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState({})
  const [deletingPatient, setDeletingPatient] = useState(null)
  const [deleteConfirmPatient, setDeleteConfirmPatient] = useState(null) // { id, patientIdentifier }
  const [rejectConfirmPatient, setRejectConfirmPatient] = useState(null) // { id, initial }
  const [rejectingPatient, setRejectingPatient] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [sharePreparing, setSharePreparing] = useState(false)
  const [consentResendBusy, setConsentResendBusy] = useState(false)
  const [sharePayload, setSharePayload] = useState({
    inviteUrl: "",
    contactEmail: "",
    contactMobile: "",
    enrolmentId: null,
    emailSent: false,
    expiresAt: null,
  })

  const { canEditEnrolment, canDeleteEnrolment, canExportEnrolment } = usePatientEnrolmentPermissions()
  const { studyId, siteId } = useStudySiteContext()
  const { screeningEnabled } = usePatientIdentifierStudySettings(studyId)
  const { iwrsEnabled } = useStudyIwrsRtsmEnabled(studyId)
  const { isEConsentRequired } = useStudyEConsentRequiredForStudy(studyId)
  const eConsentOn = isEConsentRequired === true
  const tableColumnCount = 7 + (screeningEnabled ? 1 : 0) + (eConsentOn ? 5 : 0) + (iwrsEnabled ? 1 : 0)

  const [patients, setPatients] = useState([])
  const [iwrsSyncIndex, setIwrsSyncIndex] = useState(() => new Map())
  const [listLoading, setListLoading] = useState(false)
  const [listError, setListError] = useState("")
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [searchTerm, setSearchTerm] = useState("")

  // Filter states for Manage tab
  const [filters, setFilters] = useState({
    screeningNo: "",
    patientId: "",
    dataCaptureDate: "",
    initial: "",
    gender: "",
    performedBy: "",
    performedOn: "",
  })

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch patient enrolments list
  const fetchPatientEnrolments = useCallback(async () => {
    if (!studyId) {
      return
    }

    try {
      setListLoading(true)
      setListError("")
      const response = await patientEnrolmentService.getPatientEnrolmentsList(
        studyId,
        siteId,
        pageNumber,
        pageSize,
        debouncedSearchTerm?.trim() || null,
      )

      if (response.isSuccess && response.data) {
        const paged = unwrapPagedPayload(response.data)
        const mappedPatients = paged.items.map(mapPatientEnrolmentListItem)

        setPatients(mappedPatients)
        setTotalCount(paged.totalCount)
        setTotalPages(paged.totalPages)
      } else {
        setPatients([])
        setTotalCount(0)
        setTotalPages(0)
        setListError(response.message || "Could not load patient enrolments.")
      }
    } catch (error) {
      setPatients([])
      setTotalCount(0)
      setTotalPages(0)
      setListError(error?.message || "Could not load patient enrolments.")
    } finally {
      setListLoading(false)
    }
  }, [studyId, siteId, pageNumber, pageSize, debouncedSearchTerm])

  // Handler for page size changes
  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize)
    setPageNumber(1) // Reset to first page when page size changes
  }

  useEffect(() => {
    setPageNumber(1)
  }, [debouncedSearchTerm])

  useEffect(() => {
    if (studyId) {
      fetchPatientEnrolments()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber, pageSize, debouncedSearchTerm, studyId, siteId])

  useEffect(() => {
    const numericId = Number.parseInt(String(studyId ?? ""), 10)
    if (!iwrsEnabled || !Number.isFinite(numericId) || numericId <= 0) {
      setIwrsSyncIndex(new Map())
      return undefined
    }

    let cancelled = false
    platformService.getIntegrationEvents(numericId, 1, 200).then((res) => {
      if (cancelled) return
      const items = res?.isSuccess
        ? res.data?.items ?? res.data?.Items ?? []
        : []
      setIwrsSyncIndex(buildIwrsSyncIndex(Array.isArray(items) ? items : []))
    })

    return () => {
      cancelled = true
    }
  }, [studyId, iwrsEnabled])

  const handleClearManageFilters = () => {
    setSearchTerm("")
    setListError("")
    setFilters({
      screeningNo: "",
      patientId: "",
      dataCaptureDate: "",
      initial: "",
      gender: "",
      performedBy: "",
      performedOn: "",
    })
    setPageNumber(1)
  }

  // Filter patients based on filter values (client-side filtering for now)
  const filteredPatients = patients.filter((patient) => {
    return Object.entries(filters).every(([key, value]) => {
      if (!value) return true
      const needle = String(value).toLowerCase()

      if (key === "patientId" || key === "screeningNo") {
        const haystack = [
          patient.screeningNo,
          patient.usubjid,
          patient.patientId,
          patient.id != null ? `PID-${patient.id}` : "",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        return haystack.includes(needle)
      }

      const patientValue = String(patient[key] || "").toLowerCase()
      return patientValue.includes(needle)
    })
  })

  // Handle Edit
  const handleEdit = (patient) => {
    if (!canEditEnrolment) {
      toast({
        title: "Not authorized",
        description: "You do not have permission to edit patient enrolments.",
        variant: "destructive",
        duration: 3000,
      })
      return
    }
    setEditingPatient(patient.id)
    setEditFormData({
      ...patient,
      dataCaptureDate: convertISOToDateInput(patient.dataCaptureDate),
      dateOfBirth: convertISOToDateInput(patient.dateOfBirth),
    })
    setEditErrors({})
    setError("")
    setSuccess("")
  }

  const handleEditInputChange = (field, value, maxLength) => {
    const nextValue =
      field === "initial"
        ? String(value || "")
            .toUpperCase()
            .replace(/[^A-Z]/g, "")
            .slice(0, maxLength || 3)
        : value
    if (maxLength && String(nextValue).length > maxLength) return
    setEditFormData((prev) => ({ ...prev, [field]: nextValue }))
    if (editErrors[field]) {
      setEditErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    if (!canEditEnrolment) {
      toast({
        title: "Not authorized",
        description: "You do not have permission to edit patient enrolments.",
        variant: "destructive",
        duration: 3000,
      })
      return
    }
    setEditErrors({})
    setError("")
    setSuccess("")

    const newErrors = {}
    if (!editFormData.initial) newErrors.initial = "This field is required."
    if (!editFormData.gender) newErrors.gender = "This field is required."

    // Validate data capture date: cannot be in the future
    if (editFormData.dataCaptureDate) {
      const selected = new Date(editFormData.dataCaptureDate)
      const today = new Date()
      selected.setHours(0, 0, 0, 0)
      today.setHours(0, 0, 0, 0)
      if (selected > today) {
        newErrors.dataCaptureDate = "Data capture date cannot be in the future."
      }
    }

    setEditErrors(newErrors)

    if (Object.keys(newErrors).length > 0) {
      setError("Please fill in all required fields")
      return
    }

    try {
      setEditLoading(true)

      // Prepare request data matching UpdatePatientEnrolmentRequest DTO
      const requestData = {
        StudyId: studyId,
        SiteId: siteId,
        ScreeningNo: editFormData.screeningNo || "",
        PatientId: editFormData.patientId || "",
        Initial: editFormData.initial,
        Gender: editFormData.gender,
        DataCaptureDate: convertDateToISO(editFormData.dataCaptureDate),
      }

      const response = await patientEnrolmentService.updatePatientEnrolment(
        editingPatient,
        requestData
      )

      if (response.isSuccess) {
        setSuccess("Patient enrolment updated successfully!")
        // Refresh studies list
        fetchPatientEnrolments()
        // Cancel edit mode
        handleCancelEdit()
      } else {
        setError(response.message || "Failed to update patient enrolment. Please try again.")
        // Map API errors if present
        if (response.data && typeof response.data === "object") {
          const apiErrors = {}
          Object.keys(response.data).forEach((key) => {
            const formField = key.charAt(0).toLowerCase() + key.slice(1)
            if (Array.isArray(response.data[key])) {
              apiErrors[formField] = response.data[key][0]
            } else {
              apiErrors[formField] = response.data[key]
            }
          })
          if (Object.keys(apiErrors).length > 0) {
            setEditErrors(apiErrors)
          }
        }
      }
    } catch (error) {
      setError("An error occurred while updating the patient enrolment. Please try again.")
    } finally {
      setEditLoading(false)
    }
  }

  // Handle toggle patient enrolment status
  const handleToggleStatus = async (patientId, currentStatus) => {
    // Prevent multiple clicks
    if (updatingStatus[patientId]) {
      return
    }

    try {
      setUpdatingStatus((prev) => ({ ...prev, [patientId]: true }))
      const newStatus = !currentStatus

      // Optimistically update UI immediately for instant feedback
      setPatients((prev) =>
        prev.map((patient) => {
          if (patient.id === patientId) {
            return { ...patient, isActive: newStatus, IsActive: newStatus }
          }
          return patient
        })
      )

      // API Call: PUT /api/PatientEnrolments/UpdateStatus/{id}?isActive={isActive}
      const response = await patientEnrolmentService.updatePatientEnrolmentStatus(patientId, newStatus)

      if (response.isSuccess) {
        const msg = `Patient enrolment status updated to ${newStatus ? "Active" : "Inactive"}`
        setSuccess(msg)
        toast({
          title: msg,
          variant: "success",
          duration: 3000,
        })
        setTimeout(() => setSuccess(""), 3000)
      } else {
        // Revert on error
        setPatients((prev) =>
          prev.map((patient) => {
            if (patient.id === patientId) {
              return { ...patient, isActive: currentStatus, IsActive: currentStatus }
            }
            return patient
          })
        )
        const msg = response.message || "Failed to update patient enrolment status"
        setError(msg)
        toast({
          title: msg,
          variant: "destructive",
          duration: 3000,
        })
        setTimeout(() => setError(""), 3000)
      }
    } catch (error) {
      // Revert on error
      setPatients((prev) =>
        prev.map((patient) => {
          if (patient.id === patientId) {
            return { ...patient, isActive: currentStatus, IsActive: currentStatus }
          }
          return patient
        })
      )
      const msg = "An error occurred while updating patient enrolment status"
      setError(msg)
      toast({
        title: msg,
        variant: "destructive",
        duration: 3000,
      })
      setTimeout(() => setError(""), 3000)
    } finally {
      setUpdatingStatus((prev) => ({ ...prev, [patientId]: false }))
    }
  }

  // Open delete patient confirmation modal
  const handleDeletePatient = (patientId, patientIdentifier) => {
    if (!canDeleteEnrolment) {
      toast({
        title: "Not authorized",
        description: "Only Super Admin can delete patient enrolments.",
        variant: "destructive",
        duration: 3000,
      })
      return
    }
    setDeleteConfirmPatient({ id: patientId, patientIdentifier: patientIdentifier || "this patient" })
  }

  // Perform delete after user confirms in modal
  const handleConfirmDeletePatient = async () => {
    if (!deleteConfirmPatient) return
    if (!canDeleteEnrolment) {
      toast({
        title: "Not authorized",
        description: "Only Super Admin can delete patient enrolments.",
        variant: "destructive",
        duration: 3000,
      })
      setDeleteConfirmPatient(null)
      return
    }
    const patientId = deleteConfirmPatient.id
    setDeleteConfirmPatient(null)

    try {
      setDeletingPatient(patientId)
      setError("")
      setSuccess("")

      const response = await patientEnrolmentService.deletePatientEnrolment(patientId)

      if (response.isSuccess) {
        setSuccess("Patient enrolment deleted successfully!")
        setTimeout(() => setSuccess(""), 3000)
        fetchPatientEnrolments()
      } else {
        setError(response.message || "Failed to delete patient enrolment")
        setTimeout(() => setError(""), 3000)
      }
    } catch (error) {
      setError("An error occurred while deleting patient enrolment")
      setTimeout(() => setError(""), 3000)
    } finally {
      setDeletingPatient(null)
    }
  }

  // Open reject patient confirmation modal
  const handleReject = (patient) => {
    setRejectConfirmPatient({ id: patient.id, initial: patient.initial || "this patient" })
  }

  // Perform reject after user confirms in modal
  const handleConfirmReject = async () => {
    if (!rejectConfirmPatient) return
    const patientId = rejectConfirmPatient.id
    setRejectConfirmPatient(null)

    try {
      setRejectingPatient(patientId)
      setError("")
      setSuccess("")

      const response = await patientEnrolmentService.updatePatientEnrolmentStatus(patientId, false)

      if (response.isSuccess) {
        setSuccess("Patient enrolment rejected successfully!")
        setTimeout(() => setSuccess(""), 3000)
        await fetchPatientEnrolments()
      } else {
        setError(response.message || "Failed to reject patient enrolment")
        setTimeout(() => setError(""), 3000)
      }
    } catch (error) {
      setError("An error occurred while rejecting the patient enrolment")
      setTimeout(() => setError(""), 3000)
    } finally {
      setRejectingPatient(null)
    }
  }

  const handleCancelEdit = () => {
    setEditingPatient(null)
    setEditFormData(null)
    setEditErrors({})
    setError("")
    setSuccess("")
    setShareOpen(false)
  }

  const handleResendConsentInvite = async () => {
    if (!studyId || !editingPatient) return
    setConsentResendBusy(true)
    setSharePreparing(true)
    setSharePayload({
      inviteUrl: "",
      contactEmail: editFormData?.contactEmail || "",
      contactMobile: editFormData?.contactMobile || "",
      enrolmentId: editingPatient,
      emailSent: false,
      expiresAt: null,
    })
    setShareOpen(true)

    try {
      const listRes = await eConsentService.getSubjects(studyId)
      if (!listRes?.isSuccess || !Array.isArray(listRes.data)) {
        toast({
          title: "Could not load consent record",
          description: listRes?.message || "Check that the API is running.",
          variant: "destructive",
        })
        setShareOpen(false)
        return
      }

      const subject = listRes.data.find(
        (row) => String(row.patientEnrolmentId ?? row.PatientEnrolmentId) === String(editingPatient),
      )
      if (!subject) {
        toast({
          title: "No eCONSENT record",
          description: "Assign consent under eCONSENT → Subjects first.",
          variant: "destructive",
        })
        setShareOpen(false)
        return
      }

      const subjectId = subject.id ?? subject.Id
      const res = await eConsentService.sendInvite(subjectId)
      if (res?.isSuccess && res.data) {
        setSharePayload({
          inviteUrl: res.data.inviteUrl || "",
          contactEmail: res.data.contactEmail || editFormData?.contactEmail || "",
          contactMobile: res.data.contactMobile || editFormData?.contactMobile || "",
          enrolmentId: editingPatient,
          emailSent: Boolean(res.data.emailSent),
          expiresAt: res.data.inviteTokenExpiresAt || null,
        })
        toast({
          title: res.data.emailSent ? "Invite email sent" : "Invite link ready",
          description: res.data.emailSent
            ? "The participant should receive the consent link shortly."
            : "Copy or share the link from the dialog.",
        })
      } else {
        toast({
          title: "Could not prepare invite",
          description: res?.message || "Try again or use eCONSENT → Subjects.",
          variant: "destructive",
        })
        setShareOpen(false)
      }
    } catch {
      toast({
        title: "Could not prepare invite",
        description: "Check your connection and try again.",
        variant: "destructive",
      })
      setShareOpen(false)
    } finally {
      setSharePreparing(false)
      setConsentResendBusy(false)
    }
  }

  // Handle export patient enrolments
  const handleExport = async () => {
    if (!studyId) {
      setError("Please select a study from the header menu to export patient enrolments.")
      setTimeout(() => setError(""), 3000)
      return
    }
    if (!canExportEnrolment) {
      toast({
        title: "Not authorized",
        description: "You do not have permission to export patient enrolments.",
        variant: "destructive",
        duration: 3000,
      })
      return
    }

    try {
      setExporting(true)
      setError("")
      setSuccess("")

      const response = await patientEnrolmentService.exportPatientEnrolments(studyId, siteId)

      if (response.isSuccess) {
        setSuccess("Patient enrolments exported successfully!")
        setTimeout(() => setSuccess(""), 3000)
      } else {
        setError(response.message || "Failed to export patient enrolments")
        setTimeout(() => setError(""), 3000)
      }
    } catch (error) {
      setError("An error occurred while exporting patient enrolments")
      setTimeout(() => setError(""), 3000)
    } finally {
      setExporting(false)
    }
  }

  return (
    <PatientEnrolmentPageShell
      title="Manage patient enrolments"
      description="Search, edit, export, and update status for enrolled patients."
    >
      <div className={PE_SHELL_CARD_CLASS}>
        <div className={cn(PE_PANEL_CLASS, "space-y-6")}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={() => router.push("/patient-enrolment/create")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-900/15 transition hover:from-violet-700 hover:to-purple-600"
            >
              <Plus className="h-4 w-4" />
              Create patient enrolment
            </button>
          </div>

          {iwrsEnabled ? <IwrsEnrolmentLinkBanner /> : null}

          {success && (
            <div className={PE_ALERT_SUCCESS_CLASS}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">
                ✓
              </div>
              <p className="flex-1 font-medium text-emerald-900">{success}</p>
              <button type="button" onClick={() => setSuccess("")} className="text-emerald-700 hover:text-emerald-900">
                <X className="h-5 w-5" />
              </button>
            </div>
          )}
          {error && (
            <div className={PE_ALERT_ERROR_CLASS}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-white">
                !
              </div>
              <p className="flex-1 font-medium text-amber-900">{error}</p>
              <button type="button" onClick={() => setError("")} className="text-amber-700 hover:text-amber-900">
                <X className="h-5 w-5" />
              </button>
            </div>
          )}

              {/* Search / Filters card styled like CRF Filter Criteria */}
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Search className="w-5 h-5 text-emerald-600" />
                      <h2 className="text-sm sm:text-lg font-bold text-slate-800">
                        Filter Criteria
                      </h2>
                    </div>
                    {(searchTerm ||
                      Object.values(filters).some((v) => v)) && (
                      <button
                        type="button"
                        onClick={handleClearManageFilters}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4" />
                        Clear Filters
                      </button>
                    )}
                  </div>
                </div>
                <div className="p-4 sm:p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-1 text-sm font-bold text-slate-700 mb-1">
                        Search
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className={cn(PE_INPUT_CLASS, "pl-11")}
                          placeholder="Search patient enrolments by initial..."
                        />
                      </div>
                    </div>
                    <div>
                      <label className="flex items-center gap-1 text-sm font-bold text-slate-700 mb-1">
                        Screening No
                      </label>
                      <input
                        type="text"
                        value={filters.screeningNo}
                        onChange={(e) =>
                          setFilters((prev) => ({ ...prev, screeningNo: e.target.value }))
                        }
                        className={PE_INPUT_CLASS}
                        placeholder="Filter by screening no..."
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleExport}
                      disabled={exporting || !studyId || !canExportEnrolment}
                      className="px-4 py-2.5 rounded-lg bg-gradient-to-r btn-brand-gradient text-white font-semibold  transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                      title={
                        canExportEnrolment
                          ? "Export patient enrolments to CSV"
                          : "You do not have permission to export"
                      }
                    >
                      {exporting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Exporting...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          <span>Export</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Patient Enrolments Table card */}
              {filteredPatients.length === 0 && !listLoading ? (
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 p-12 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 mx-auto mb-4">
                    <Users className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">No Patient Enrolments Found</h2>
                  <p className="text-slate-600">
                    {listError
                      ? listError
                      : !studyId
                        ? "Please select a study and site from the header menu to view patient enrolments."
                        : !siteId
                          ? "Please select a site from the header menu to view patient enrolments."
                          : Object.values(filters).some(Boolean)
                            ? "No patients match the current filters. Clear filters to see all enrolments."
                            : "No patient enrolments yet. Create your first enrolment to get started."}
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
                  <div className="bg-gradient-to-r from-slate-100 to-slate-50 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200">
                    <h2 className="text-sm sm:text-lg font-bold text-slate-800">
                      Patient Enrolments {totalCount > 0 && `(${totalCount} total)`}
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b-2 border-slate-200">
                        <tr>
                          {screeningEnabled ? (
                            <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                              SUBJECT ID
                            </th>
                          ) : null}
                          <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">INITIAL</th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">GENDER</th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">DATA CAPTURE DATE</th>
                          {eConsentOn ? (
                            <>
                              <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">DOB</th>
                              <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">EMAIL</th>
                              <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">MOBILE</th>
                              <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">JURISDICTION</th>
                              <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">CONSENT</th>
                            </>
                          ) : null}
                          <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">PERFORMED BY</th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">PERFORMED ON</th>
                          {iwrsEnabled ? (
                            <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                              IWRS
                            </th>
                          ) : null}
                          <th className="px-4 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">STATUS</th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">ACTION</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-200">
                        {listLoading ? (
                          <tr>
                            <td colSpan={tableColumnCount} className="px-4 py-8 text-center">
                              <div className="space-y-3">
                                <div className="h-4 w-40 rounded bg-slate-200/80 mx-auto" />
                                <div className="overflow-hidden rounded-xl border border-slate-200/80">
                                  {Array.from({ length: 4 }).map((_, idx) => (
                                    <div key={idx} className="grid grid-cols-7 gap-3 border-b border-slate-100 px-3 py-3 last:border-b-0">
                                      <Skeleton className="h-3.5 bg-slate-200/80" />
                                      <Skeleton className="h-3.5 bg-slate-200/80" />
                                      <Skeleton className="h-3.5 bg-slate-200/80" />
                                      <Skeleton className="h-3.5 bg-slate-200/80" />
                                      <Skeleton className="h-3.5 bg-slate-200/80" />
                                      <Skeleton className="h-3.5 bg-slate-200/80" />
                                      <Skeleton className="h-3.5 bg-slate-200/80" />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredPatients.map((patient) => (
                            <tr key={patient.id} className="hover:bg-slate-50 transition-colors">
                              {screeningEnabled ? (
                                <td className="px-4 py-4 whitespace-nowrap">
                                  <div className="text-sm font-semibold text-slate-900">
                                    {patient.screeningNo || patient.usubjid || `PID-${patient.id}`}
                                  </div>
                                </td>
                              ) : null}
                              <td className="px-4 py-4 whitespace-nowrap">
                                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs">
                                  {patient.initial || "N/A"}
                                </span>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                {patient.gender ? (
                                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
                                    {patient.gender}
                                  </span>
                                ) : (
                                  <span className="text-sm text-slate-400">N/A</span>
                                )}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="text-sm text-slate-600">{formatDateForDisplay(patient.dataCaptureDate)}</div>
                              </td>
                              {eConsentOn ? (
                                <>
                                  <td className="px-4 py-4 whitespace-nowrap">
                                    <div className="text-sm text-slate-600">
                                      {patient.dateOfBirth ? formatDateForDisplay(patient.dateOfBirth) : "—"}
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap">
                                    <div className="max-w-[160px] truncate text-sm text-slate-600" title={patient.contactEmail || ""}>
                                      {patient.contactEmail || "—"}
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap">
                                    <div className="text-sm text-slate-600">{patient.contactMobile || "—"}</div>
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap">
                                    <div className="text-sm text-slate-600">{patient.jurisdictionCode || "—"}</div>
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap">
                                    {patient.consentStatus ? (
                                      <span className={econsentStatusBadge(patient.consentStatus)}>{patient.consentStatus}</span>
                                    ) : (
                                      <span className="text-sm text-slate-400">Not assigned</span>
                                    )}
                                  </td>
                                </>
                              ) : null}
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="text-sm text-slate-600">{patient.performedBy || "N/A"}</div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="text-sm text-slate-600">{patient.performedOn || "N/A"}</div>
                              </td>
                              {iwrsEnabled ? (
                                <td className="px-4 py-4 whitespace-nowrap">
                                  {(() => {
                                    const sync = lookupIwrsSync(iwrsSyncIndex, {
                                      enrolmentId: patient.id,
                                      screeningNo: patient.screeningNo,
                                      usubjid: patient.usubjid,
                                      patientId: patient.patientId,
                                    })
                                    if (sync) {
                                      return (
                                        <div className="flex flex-col gap-0.5">
                                          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-900">
                                            <Link2 className="h-3 w-3" aria-hidden />
                                            {sync.label}
                                          </span>
                                          <span className="text-[10px] text-slate-500">
                                            Match:{" "}
                                            {patient.screeningNo ||
                                              patient.usubjid ||
                                              patient.patientId ||
                                              "—"}
                                          </span>
                                          {patient.randomizationNumber ? (
                                            <span className="text-[10px] text-slate-500">
                                              Rand: {patient.randomizationNumber}
                                            </span>
                                          ) : null}
                                        </div>
                                      )
                                    }
                                    return (
                                      <div className="flex flex-col gap-0.5">
                                        <span className="inline-flex w-fit rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                          Awaiting IWRS
                                        </span>
                                        <span className="text-[10px] text-slate-500">
                                          Use Subject ID in IWRS
                                        </span>
                                      </div>
                                    )
                                  })()}
                                </td>
                              ) : null}
                              <td className="px-4 py-4 whitespace-nowrap text-center">
                                <div className="flex items-center justify-center gap-3">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      const isActive = resolveIsActive(patient.isActive ?? patient.IsActive)
                                      handleToggleStatus(patient.id, isActive)
                                    }}
                                    disabled={updatingStatus[patient.id]}
                                    className={`relative inline-flex h-8 w-16 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer ${(resolveIsActive(patient.isActive ?? patient.IsActive))
                                      ? "bg-violet-600 hover:bg-violet-700"
                                      : "bg-slate-300 hover:bg-slate-400"
                                      }`}
                                  >
                                    <span
                                      className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-200 ${(resolveIsActive(patient.isActive ?? patient.IsActive)) ? "translate-x-9" : "translate-x-1"
                                        }`}
                                    />
                                  </button>
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  {canEditEnrolment && (
                                    <button
                                      onClick={() => handleEdit(patient)}
                                      className="px-3 py-1.5 rounded-lg bg-teal-100 text-teal-700 hover:bg-teal-200 transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                                      title="Edit patient"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {canDeleteEnrolment && (
                                    <button
                                      onClick={() => handleDeletePatient(patient.id, patient.initial)}
                                      disabled={deletingPatient === patient.id}
                                      className="px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="Delete patient"
                                    >
                                      {deletingPatient === patient.id ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <Trash2 className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination */}
                  {totalPages > 0 && (
                    <div className="px-4 sm:px-6 py-3 border-t border-slate-200 bg-slate-50/60">
                      <DataPagination
                        currentPage={pageNumber}
                        pageSize={pageSize}
                        totalPages={totalPages}
                        totalCount={totalCount}
                        onPageChange={setPageNumber}
                        onPageSizeChange={handlePageSizeChange}
                        itemName="patient enrolments"
                        showPageSizeSelector={true}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

      {/* Edit Patient Modal */}
        {editingPatient && editFormData && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl my-8 border border-slate-100">
              {/* Modal Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-3xl border-b border-emerald-100/80 bg-gradient-to-r from-emerald-50 via-teal-50/80 to-emerald-50 px-6 py-5 sm:px-8">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-slate-900">Edit Patient Enrolment: {editFormData.initial || "Patient"}</h3>
                </div>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-white transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className={VIEWPORT_PANEL_SCROLL_CLASS}>
                <form onSubmit={handleEditSubmit} className="p-8">
                  {/* Success/Error Messages */}
                  {success && (
                    <div className={cn(PE_ALERT_SUCCESS_CLASS, "mb-6")}>
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white">✓</div>
                      <p className="font-medium text-emerald-900">{success}</p>
                    </div>
                  )}
                  {error && (
                    <div className={cn(PE_ALERT_ERROR_CLASS, "mb-6")}>
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-white">!</div>
                      <p className="font-medium text-amber-900">{error}</p>
                    </div>
                  )}

                  <div className={PE_FORM_GRID_CLASS}>
                    {screeningEnabled && (editFormData.screeningNo || editFormData.usubjid) ? (
                      <div className="md:col-span-2">
                        <label className={PE_LABEL_CLASS}>Subject ID (screening / SUBJID)</label>
                        <input
                          type="text"
                          value={editFormData.screeningNo || editFormData.usubjid || ""}
                          readOnly
                          disabled
                          className={cn(PE_INPUT_CLASS, "cursor-not-allowed bg-slate-50 text-slate-600")}
                        />
                        <p className={PE_HINT_CLASS}>Auto-assigned — cannot be edited.</p>
                      </div>
                    ) : null}

                    <div>
                      <label className={PE_LABEL_CLASS}>
                        Initial <span className={PE_REQUIRED_CLASS}>*</span>
                      </label>
                      <input
                        type="text"
                        value={editFormData.initial}
                        onChange={(e) => handleEditInputChange("initial", e.target.value, 3)}
                        className={cn(PE_INPUT_CLASS, "text-sm", editErrors.initial && PE_INPUT_ERROR_CLASS)}
                        placeholder="Enter initial"
                        required
                      />
                      {editErrors.initial && (
                        <p className="mt-1 text-xs text-amber-800">{editErrors.initial}</p>
                      )}
                      <p className={PE_HINT_CLASS}>{editFormData.initial.length} / 3</p>
                    </div>

                    <div>
                      <label className={PE_LABEL_CLASS}>
                        Gender <span className={PE_REQUIRED_CLASS}>*</span>
                      </label>
                      <GenderSegmentedControl
                        name="editGender"
                        value={editFormData.gender}
                        onChange={(next) => handleEditInputChange("gender", next)}
                        error={editErrors.gender}
                      />
                    </div>

                    <div>
                      <label className={PE_LABEL_CLASS}>
                        <Calendar className="h-4 w-4 text-emerald-600" />
                        Data capture date
                      </label>
                      <DatePicker
                        value={editFormData.dataCaptureDate || null}
                        onChange={(value) => {
                          setEditErrors((prev) => {
                            const next = { ...prev }
                            delete next.dataCaptureDate
                            return next
                          })
                          handleEditInputChange("dataCaptureDate", value || "")
                        }}
                        placeholder="dd-mm-yyyy"
                        disableFuture
                        className={editErrors.dataCaptureDate ? PE_INPUT_ERROR_CLASS : ""}
                      />
                      {editErrors.dataCaptureDate && (
                        <p className="mt-1 text-xs text-amber-800">{editErrors.dataCaptureDate}</p>
                      )}
                    </div>
                  </div>

                  {eConsentOn ? (
                    <div className={cn(PE_SECTION_FOLLOWING_CLASS, "mt-6")}>
                      <div className={PE_SECTION_HEADER_CLASS}>
                        <div className={PE_SECTION_ICON_CLASS}>
                          <FileSignature className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h4 className="text-base font-bold text-slate-900">eCONSENT</h4>
                          <p className="text-xs text-slate-500">
                            Contact and consent details captured at enrolment. Manage consent workflow under{" "}
                            <Link
                              href={`/econsent/subjects?studyId=${encodeURIComponent(studyId || "")}`}
                              className="font-semibold text-emerald-800 hover:text-emerald-950"
                            >
                              eCONSENT → Subjects
                            </Link>
                            .
                          </p>
                        </div>
                      </div>

                      <div className={PE_FORM_GRID_CLASS}>
                        <div className="md:max-w-md">
                          <label className={PE_LABEL_CLASS}>Date of birth</label>
                          <input
                            type="text"
                            readOnly
                            disabled
                            value={editFormData.dateOfBirth ? formatDateForDisplay(editFormData.dateOfBirth) : "—"}
                            className={cn(PE_INPUT_CLASS, "cursor-not-allowed bg-slate-50 text-slate-600")}
                          />
                        </div>
                        <div>
                          <label className={PE_LABEL_CLASS}>Jurisdiction</label>
                          <input
                            type="text"
                            readOnly
                            disabled
                            value={editFormData.jurisdictionCode || "—"}
                            className={cn(PE_INPUT_CLASS, "cursor-not-allowed bg-slate-50 text-slate-600")}
                          />
                        </div>
                        <div>
                          <label className={PE_LABEL_CLASS}>Email</label>
                          <input
                            type="text"
                            readOnly
                            disabled
                            value={editFormData.contactEmail || "—"}
                            className={cn(PE_INPUT_CLASS, "cursor-not-allowed bg-slate-50 text-slate-600")}
                          />
                        </div>
                        <div>
                          <label className={PE_LABEL_CLASS}>Mobile</label>
                          <input
                            type="text"
                            readOnly
                            disabled
                            value={editFormData.contactMobile || "—"}
                            className={cn(PE_INPUT_CLASS, "cursor-not-allowed bg-slate-50 text-slate-600")}
                          />
                        </div>
                        <div>
                          <label className={PE_LABEL_CLASS}>Consent status</label>
                          <div className="mt-1">
                            {editFormData.consentStatus ? (
                              <span className={econsentStatusBadge(editFormData.consentStatus)}>
                                {editFormData.consentStatus}
                              </span>
                            ) : (
                              <span className="text-sm text-slate-500">Not assigned</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => void handleResendConsentInvite()}
                          disabled={
                            consentResendBusy ||
                            !editFormData.contactEmail?.trim() ||
                            !editFormData.contactMobile?.trim()
                          }
                          className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {consentResendBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Share2 className="h-4 w-4" />
                          )}
                          Resend consent invite
                        </button>
                        {!editFormData.contactEmail?.trim() || !editFormData.contactMobile?.trim() ? (
                          <p className="text-xs text-slate-500">Email and mobile are required to share the invite.</p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {/* Modal Footer */}
                  <div className={cn(PE_FOOTER_CLASS, "sticky bottom-0 -mx-8 bg-white px-8 pb-6")}>
                    <button type="button" onClick={handleCancelEdit} disabled={editLoading} className={PE_BTN_CLEAR_CLASS}>
                      <X className="h-4 w-4" />
                      Cancel
                    </button>
                    <button type="submit" disabled={editLoading} className={PE_BTN_SUBMIT_CLASS}>
                      <Save className="h-4 w-4" />
                      {editLoading ? "Updating..." : "Update patient"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Delete Patient Confirmation Modal */}
        {deleteConfirmPatient && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-red-200 overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white">Delete Patient</h3>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-slate-700">
                  Are you sure you want to delete patient <span className="font-semibold text-slate-900">"{deleteConfirmPatient.patientIdentifier}"</span>? This action cannot be undone.
                </p>
                <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmPatient(null)}
                    className="px-5 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeletePatient}
                    disabled={deletingPatient === deleteConfirmPatient.id}
                    className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                  >
                    {deletingPatient === deleteConfirmPatient.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      "Delete"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reject Patient Confirmation Modal */}
        {rejectConfirmPatient && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-red-200 overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <X className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white">Reject Patient</h3>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-slate-700">
                  Are you sure you want to reject patient <span className="font-semibold text-slate-900">"{rejectConfirmPatient.initial}"</span>?
                </p>
                <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setRejectConfirmPatient(null)}
                    className="px-5 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmReject}
                    disabled={rejectingPatient === rejectConfirmPatient.id}
                    className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                  >
                    {rejectingPatient === rejectConfirmPatient.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Rejecting...
                      </>
                    ) : (
                      "Reject"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        <ShareConsentInviteDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          inviteUrl={sharePayload.inviteUrl}
          contactEmail={sharePayload.contactEmail}
          contactMobile={sharePayload.contactMobile}
          enrolmentId={sharePayload.enrolmentId}
          emailSent={sharePayload.emailSent}
          expiresAt={sharePayload.expiresAt}
          preparing={sharePreparing}
        />
    </PatientEnrolmentPageShell>
  )
}

function mapPatientEnrolmentListItem(item) {
  const id = item.id ?? item.Id
  const screeningNo = String(item.screeningNo ?? item.ScreeningNo ?? "").trim()
  const usubjid = String(item.usubjid ?? item.Usubjid ?? "").trim()
  const legacyPatientId = String(item.patientId ?? item.PatientId ?? "").trim()
  const displayPatientId =
    screeningNo || usubjid || legacyPatientId || (id != null ? `PID-${id}` : "")

  return {
    id,
    screeningNo,
    patientId: displayPatientId,
    usubjid,
    randomizationNumber: item.randomizationNumber ?? item.RandomizationNumber ?? "",
    dataCaptureDate: item.dataCaptureDate ?? item.DataCaptureDate ?? "",
    initial: item.initial ?? item.Initial ?? "",
    gender: item.gender ?? item.Gender ?? "",
    performedBy: item.performedBy ?? item.PerformedBy ?? "",
    performedOn: item.performedOn ?? item.PerformedOn ?? "",
    isActive: resolveIsActive(item.isActive ?? item.IsActive),
    dateOfBirth: item.dateOfBirth ?? item.DateOfBirth ?? "",
    jurisdictionCode: item.jurisdictionCode ?? item.JurisdictionCode ?? "",
    contactEmail: item.contactEmail ?? item.ContactEmail ?? "",
    contactMobile: item.contactMobile ?? item.ContactMobile ?? "",
    consentStatus: item.consentStatus ?? item.ConsentStatus ?? "",
  }
}
