"use client"

import { VIEWPORT_PAGE_SHELL_WITH_EMERALD_BG_CLASS, VIEWPORT_PANEL_SCROLL_CLASS } from "@/lib/ui/responsivePageUi"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { visitScheduleService, studyService } from "@/lib/services"
import { syncVisitPaymentRulesAfterVisitSave } from "@/lib/paymentRules/syncVisitPaymentRules"
import {
  CRF_DESIGNER_VISIT_OPTIONS,
  mapVisitTypeEnumToLabel,
  mapVisitTypeLabelToEnum,
} from "@/lib/visitTypes"
import DataPagination from "@/components/ui/data-pagination"
import SectionSkeleton from "@/components/ui/section-skeleton"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useStudySiteContext } from "@/hooks/useStudySiteContext"
import {
  FileText,
  Edit,
  Trash2,
  Loader2,
  Plus,
  Check,
  Hash,
  Save,
  BookOpen,
  Search,
  X as XIcon,
} from "lucide-react"

const STUDY_PLACEHOLDER_VALUE = "__study_placeholder__"
const VISIT_TYPE_PLACEHOLDER_VALUE = "__visit_type_placeholder__"

export default function VisitConfigurationManagePage() {
  const router = useRouter()
  const [visitSchedules, setVisitSchedules] = useState([])
  const [listLoading, setListLoading] = useState(false)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [isActiveFilter, setIsActiveFilter] = useState(null)
  const [updatingStatus, setUpdatingStatus] = useState({})
  const [deletingVisit, setDeletingVisit] = useState(null)
  const { studyId } = useStudySiteContext()
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [copiedItem, setCopiedItem] = useState(null) // Track what was copied (guid or visitNo)
  const [editingVisit, setEditingVisit] = useState(null)
  const [editFormData, setEditFormData] = useState({
    visitNo: "",
    visitName: "",
    visitType: "",
    duration: "",
    windowMin: "",
    windowMax: "",
    studyId: null,
  })
  const [editErrors, setEditErrors] = useState({})
  const [savingVisit, setSavingVisit] = useState(false)
  const [loadingEditVisit, setLoadingEditVisit] = useState(false)
  const [availableStudies, setAvailableStudies] = useState([])
  const [loadingStudies, setLoadingStudies] = useState(false)
  const [deleteConfirmVisit, setDeleteConfirmVisit] = useState(null) // { id, visitName }

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Reset to page 1 when search term or filter changes
  useEffect(() => {
    setPageNumber(1)
  }, [debouncedSearchTerm, isActiveFilter])

  // Handler for page size changes
  const handlePageSizeChange = useCallback((newPageSize) => {
    setPageSize(newPageSize)
    setPageNumber(1)
  }, [])

  // Fetch visit schedules
  const fetchVisitSchedules = useCallback(async () => {
    setListLoading(true)
    try {
      const response = await visitScheduleService.getVisitSchedulesList(
        pageNumber,
        pageSize,
        studyId, // Can be null to show all visits
        debouncedSearchTerm || null,
        isActiveFilter
      )

      if (response?.isSuccess && response?.data) {
        const data = response.data
        const list = Array.isArray(data)
          ? data
          : (data.items || data.Items || [])
        setVisitSchedules(list)

        // Update pagination metadata
        if (data && typeof data === "object" && !Array.isArray(data)) {
          setTotalCount(data.totalCount || data.TotalCount || 0)
          setTotalPages(data.totalPages || data.TotalPages || 0)
        }
      } else {
        setVisitSchedules([])
        setTotalCount(0)
        setTotalPages(0)
      }
    } catch (error) {
      setVisitSchedules([])
      setTotalCount(0)
      setTotalPages(0)
    } finally {
      setListLoading(false)
    }
  }, [pageNumber, pageSize, debouncedSearchTerm, isActiveFilter, studyId])

  // Fetch visit schedules when page changes or search changes
  useEffect(() => {
    fetchVisitSchedules()
  }, [fetchVisitSchedules])

  const handleClearFilters = () => {
    setSearchTerm("")
    setDebouncedSearchTerm("")
    setIsActiveFilter(null)
    setPageNumber(1)
  }

  // Handler for status toggle
  const handleToggleStatus = async (visitId, currentStatus) => {
    if (updatingStatus[visitId]) {
      return
    }

    const newStatus = !currentStatus
    setUpdatingStatus((prev) => ({ ...prev, [visitId]: true }))

    try {
      const response = await visitScheduleService.updateVisitScheduleStatus(visitId, newStatus)
      if (response.isSuccess) {
        // Update local state instead of refetching to avoid page refresh
        setVisitSchedules((prev) =>
          prev.map((visit) => {
            const id = visit.id || visit.Id
            if (id === visitId) {
              return {
                ...visit,
                isActive: newStatus,
                IsActive: newStatus,
              }
            }
            return visit
          })
        )
        setSuccess(response.message || `Visit schedule ${newStatus ? "activated" : "deactivated"} successfully!`)
        setTimeout(() => setSuccess(""), 3000)
      } else {
        setError(response.message || "Failed to update visit schedule status")
        setTimeout(() => setError(""), 3000)
      }
    } catch (error) {
      setError(error.message || "Failed to update visit schedule status")
      setTimeout(() => setError(""), 3000)
    } finally {
      setUpdatingStatus((prev) => {
        const newStatus = { ...prev }
        delete newStatus[visitId]
        return newStatus
      })
    }
  }

  // Open delete visit confirmation modal
  const handleDeleteVisit = (visitId, visitName) => {
    setDeleteConfirmVisit({ id: visitId, visitName: visitName || "this visit" })
  }

  // Perform delete after user confirms in modal
  const handleConfirmDeleteVisit = async () => {
    if (!deleteConfirmVisit) return
    const visitId = deleteConfirmVisit.id
    setDeleteConfirmVisit(null)

    try {
      setDeletingVisit(visitId)
      setError("")
      setSuccess("")

      const response = await visitScheduleService.deleteVisitSchedule(visitId)

      if (response.isSuccess) {
        setSuccess("Visit schedule deleted successfully!")
        setTimeout(() => setSuccess(""), 3000)
        fetchVisitSchedules()
      } else {
        setError(response.message || "Failed to delete visit schedule")
        setTimeout(() => setError(""), 3000)
      }
    } catch (error) {
      setError("An error occurred while deleting visit schedule")
      setTimeout(() => setError(""), 3000)
    } finally {
      setDeletingVisit(null)
    }
  }

  const formatVisitType = (visitType) => {
    if (visitType == null || visitType === "") return null
    const fromEnum = mapVisitTypeEnumToLabel(visitType)
    if (fromEnum) return fromEnum
    const fromLabel = mapVisitTypeEnumToLabel(mapVisitTypeLabelToEnum(visitType))
    if (fromLabel) return fromLabel
    return typeof visitType === "string" ? visitType : null
  }

  const handleCopyToClipboard = async (text, type, visitId) => {
    if (!text || text === "N/A") {
      return
    }

    try {
      await navigator.clipboard.writeText(text)
      setCopiedItem(`${type}-${visitId}`)
      setTimeout(() => {
        setCopiedItem(null)
      }, 2000)
    } catch (error) {
      console.error("Failed to copy to clipboard:", error)
    }
  }

  const enumToDisplayVisitType = (visitType) => formatVisitType(visitType) || ""

  const visitTypeOptions = CRF_DESIGNER_VISIT_OPTIONS

  // Fetch available studies
  const fetchStudies = async () => {
    setLoadingStudies(true)
    try {
      const response = await studyService.getStudiesForDropdown()
      if (response?.isSuccess && response?.data) {
        const list = Array.isArray(response.data) ? response.data : []
        setAvailableStudies(list)
      }
    } catch (error) {
      console.error("Error fetching studies:", error)
    } finally {
      setLoadingStudies(false)
    }
  }

  // Load visit schedule data for editing
  const loadVisitScheduleData = async (id) => {
    try {
      setLoadingEditVisit(true)
      setError("")
      const response = await visitScheduleService.getVisitScheduleById(id)
      
      if (response.isSuccess && response.data) {
        const visitSchedule = response.data
        
        // Map API response to form data and ALWAYS canonicalise to the exact
        // dropdown label (e.g. "Study Completion Form") regardless of what
        // shape the API returns: enum number (7, 8), stringified enum ("7"),
        // canonical label ("Visits"), concatenated label ("StudyCompletionForm")
        // or slug ("studycompletionform"). Previously string visitTypeIds were
        // used as-is, which silently broke pre-selection for any visit type
        // whose API string did not exactly match the dropdown label —
        // observed for the newly added Study Completion Form / Patient
        // Feedback Form types. enumToDisplayVisitType() routes through
        // formatVisitType() which handles every shape consistently.
        const candidateVisitTypeFields = [
          visitSchedule.visitTypeId,
          visitSchedule.visitTypeName,
          visitSchedule.visitType,
        ]
        let visitType = ""
        for (const candidate of candidateVisitTypeFields) {
          if (candidate == null || candidate === "") continue
          const canonical = enumToDisplayVisitType(candidate)
          if (canonical) {
            visitType = canonical
            break
          }
        }
        
        // Map all fields from API response - all fields are updatable
        // Note: windowMin and windowMax are required per DTO, default to "0" if null/undefined
        setEditFormData({
          visitNo: visitSchedule.visitNo !== undefined && visitSchedule.visitNo !== null ? String(visitSchedule.visitNo) : "1",
          visitName: visitSchedule.visitName || "",
          visitType: visitType,
          duration: visitSchedule.duration !== undefined && visitSchedule.duration !== null ? String(visitSchedule.duration) : "0",
          windowMin: visitSchedule.windowMin !== undefined && visitSchedule.windowMin !== null ? String(visitSchedule.windowMin) : "0",
          windowMax: visitSchedule.windowMax !== undefined && visitSchedule.windowMax !== null ? String(visitSchedule.windowMax) : "0",
          studyId: visitSchedule.studyId !== undefined && visitSchedule.studyId !== null ? visitSchedule.studyId : null,
        })
      } else {
        setError(response.message || "Failed to load visit schedule")
        setEditingVisit(null)
      }
    } catch (err) {
      setError(err.message || "Failed to load visit schedule")
      setEditingVisit(null)
    } finally {
      setLoadingEditVisit(false)
    }
  }

  const handleEditVisit = (visit) => {
    setEditingVisit(visit)
    setEditErrors({})
    setError("")
    setSuccess("")
    loadVisitScheduleData(visit.id)
    fetchStudies()
  }

  const handleCancelEdit = () => {
    setEditingVisit(null)
    setEditFormData({
      visitNo: "",
      visitName: "",
      visitType: "",
      duration: "",
      windowMin: "",
      windowMax: "",
      studyId: null,
    })
    setEditErrors({})
    setError("")
  }

  const handleEditInputChange = (field, value) => {
    // Special handling for numeric fields
    if (field === "duration" || field === "windowMin" || field === "windowMax" || field === "visitNo") {
      // Allow only numbers or empty string
      if (value === "" || /^\d+$/.test(value)) {
        setEditFormData((prev) => ({ ...prev, [field]: value }))
      }
    } else {
      setEditFormData((prev) => ({ ...prev, [field]: value }))
    }
    
    if (editErrors[field]) {
      setEditErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const handleUpdateVisit = async (e) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setSavingVisit(true)

    const newErrors = {}
    
    // Validate required fields
    if (!editFormData.studyId) {
      newErrors.studyId = "Study is required"
    }
    // Visit number is only required for "Visits" type
    if (editFormData.visitType === "Visits" && !editFormData.visitNo) {
      newErrors.visitNo = "Visit number is required"
    }
    if (!editFormData.visitName) {
      newErrors.visitName = "Visit name is required"
    }
    if (!editFormData.visitType) {
      newErrors.visitType = "Visit type is required"
    }
    if (!editFormData.duration) {
      newErrors.duration = "Duration is required"
    }

    setEditErrors(newErrors)

    if (Object.keys(newErrors).length > 0) {
      setError("Please fill in all required fields")
      setSavingVisit(false)
      return
    }

    try {
      // Prepare data matching UpdateVisitScheduleRequest DTO
      // All fields are required, windowMin and windowMax must be 0 or greater
      // Visit number is only required for "Visits" type
      const visitScheduleData = {
        studyId: editFormData.studyId,
        visitNo: editFormData.visitType === "Visits" ? (editFormData.visitNo || "1") : "0", // Only set visitNo for Visits type
        visitName: editFormData.visitName || "", // Ensure visitName is provided
        visitType: editFormData.visitType, // Will be mapped to visitTypeId enum (1-3) in service
        duration: editFormData.duration || "0", // Ensure duration is provided
        windowMin: editFormData.windowMin || "0", // Required, default to 0 if empty
        windowMax: editFormData.windowMax || "0", // Required, default to 0 if empty
      }
      
      const response = await visitScheduleService.updateVisitSchedule(editingVisit.id, visitScheduleData)

      if (response.isSuccess) {
        setSuccess("Visit schedule updated successfully!")
        void syncVisitPaymentRulesAfterVisitSave(editFormData.studyId).catch(() => {})
        setTimeout(() => {
          setSuccess("")
          handleCancelEdit()
          fetchVisitSchedules()
        }, 1500)
      } else {
        // Handle validation errors from backend
        const errorMessage = response.message || "Failed to update visit schedule"
        const errorDetails = response.data?.errors || response.errors || response.data
        
        // Check for Entity Framework tracking errors (backend issue)
        if (errorMessage && errorMessage.includes("cannot be tracked") && errorMessage.includes("already being tracked")) {
          setError("A database error occurred. The study is already in use. Please try again or contact support if the issue persists.")
        } else if (Array.isArray(errorDetails)) {
          setError(errorDetails.join(", ") || errorMessage)
        } else if (typeof errorDetails === "string") {
          setError(errorDetails)
        } else if (errorDetails && typeof errorDetails === "object") {
          // If errorDetails is an object, try to extract error messages
          const errorMessages = Object.values(errorDetails).flat().filter(Boolean)
          setError(errorMessages.length > 0 ? errorMessages.join(", ") : errorMessage)
        } else {
          setError(errorMessage)
        }
      }
    } catch (err) {
      // Handle unexpected errors
      const errorMessage = err?.response?.data?.message || err?.message || "Failed to update visit schedule"
      const errorDetails = err?.response?.data?.errors || err?.response?.data?.data?.errors
      
      // Check for Entity Framework tracking errors (backend issue)
      if (errorMessage && errorMessage.includes("cannot be tracked") && errorMessage.includes("already being tracked")) {
        setError("A database error occurred. The study is already in use. Please try again or contact support if the issue persists.")
      } else if (Array.isArray(errorDetails)) {
        setError(errorDetails.join(", ") || errorMessage)
      } else {
        setError(errorMessage)
      }
    } finally {
      setSavingVisit(false)
    }
  }

  const handleCreateNew = () => {
    router.push("/visit-configuration/create")
  }

  return (
    <DashboardLayout>
      <div className={VIEWPORT_PAGE_SHELL_WITH_EMERALD_BG_CLASS}>
        <div className="space-y-6">
          {/* Success/Error Messages */}
          {success && (
            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-bold">✓</span>
              </div>
              <p className="text-green-800 font-medium">{success}</p>
              <button
                onClick={() => setSuccess("")}
                className="ml-auto text-green-600 hover:text-green-800"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
          )}
          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-bold">!</span>
              </div>
              <p className="text-red-800 font-medium">{error}</p>
              <button
                onClick={() => setError("")}
                className="ml-auto text-red-600 hover:text-red-800"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Search and Filters - styled similar to CRF Filter Criteria */}
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Search className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-sm sm:text-lg font-bold text-slate-800">
                    Filter Criteria
                  </h2>
                </div>
                {(searchTerm || isActiveFilter !== null) && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <XIcon className="w-4 h-4" />
                    Clear Filters
                  </button>
                )}
              </div>
            </div>
            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="flex items-center gap-1 text-sm font-bold text-slate-700 mb-1">
                    Search
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Search visit schedules..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full h-10 pl-10 pr-4 rounded-lg border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-1 text-sm font-bold text-slate-700 mb-1">
                    Status
                  </label>
                  <Select
                    value={isActiveFilter === null ? "all" : isActiveFilter ? "active" : "inactive"}
                    onValueChange={(value) => {
                      setIsActiveFilter(value === "all" ? null : value === "active")
                    }}
                  >
                    <SelectTrigger className="w-full h-10 px-4 rounded-lg border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all bg-white text-sm">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-2 border-slate-200 rounded-lg shadow-lg">
                      <SelectItem value="all" className="text-sm">
                        All Status
                      </SelectItem>
                      <SelectItem value="active" className="text-sm">
                        Active Only
                      </SelectItem>
                      <SelectItem value="inactive" className="text-sm">
                        Inactive Only
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Clear Filters in same row */}
                <div className="flex justify-start md:justify-end">
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="px-4 py-2 text-sm font-semibold border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Visit Schedules Table - card style similar to CRF list */}
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
            <div className="bg-gradient-to-r from-slate-100 to-slate-50 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200">
              <h2 className="text-sm sm:text-lg font-bold text-slate-800">
                Visit Schedules {totalCount > 0 && `(${totalCount} total)`}
              </h2>
            </div>

            {listLoading ? (
              <SectionSkeleton title="Loading visit schedules..." rows={7} variant="visits" />
            ) : visitSchedules.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">No Visit Schedules Found</h2>
                <p className="text-slate-600 mb-6">Create your first visit schedule to get started.</p>
                <button
                  onClick={handleCreateNew}
                  className="px-6 py-3 rounded-lg bg-gradient-to-r btn-brand-gradient text-white font-semibold  transition-all shadow-md hover:shadow-lg flex items-center gap-2 mx-auto"
                >
                  <Plus className="w-5 h-5" />
                  Create Visit
                </button>
              </div>
            ) : (
              <div>
                <table className="w-full">
                  <thead className="bg-slate-50 border-b-2 border-slate-200">
                    <tr>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">VISIT NO</th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">STUDY</th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">VISIT NAME</th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">VISIT TYPE</th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">DURATION (DAYS)</th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">WINDOW PERIOD</th>
                      <th className="px-4 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">STATUS</th>
                      <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {visitSchedules.map((visit) => {
                      const isActive = visit.isActive !== undefined ? visit.isActive : (visit.IsActive !== undefined ? visit.IsActive : true)
                      const isUpdating = updatingStatus[visit.id || visit.Id]
                      
                      return (
                        <tr key={visit.id || visit.Id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span 
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const valueToCopy = visit.studyGuid || visit.studyGuid || visit.visitNo || visit.VisitNo
                                  const type = (visit.studyGuid || visit.studyGuid) ? "guid" : "visitNo"
                                  handleCopyToClipboard(valueToCopy, type, visit.id || visit.Id)
                                }}
                                className="group/guid relative inline-flex items-center justify-center px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 active:bg-emerald-200 transition-colors cursor-pointer"
                              >
                                {copiedItem === `guid-${visit.id || visit.Id}` || copiedItem === `visitNo-${visit.id || visit.Id}` ? (
                                  <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-600 flex-shrink-0" />
                                ) : (
                                  <Hash className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-500 flex-shrink-0" />
                                )}
                                <span className="truncate max-w-[200px] opacity-0 group-hover/guid:opacity-100 transition-opacity duration-200 absolute top-full left-0 ml-2 mt-1 whitespace-nowrap bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg z-50 pointer-events-none">
                                  {visit.studyGuid || visit.studyGuid || visit.visitNo || visit.VisitNo || "N/A"}
                                  <div className="absolute -top-1 left-4 w-2 h-2 bg-slate-900 rotate-45"></div>
                                </span>
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm text-slate-900">
                              {visit.studyProtocolNumber || "N/A"}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm text-slate-900">
                              {visit.visitName || visit.VisitName || "N/A"}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            {(() => {
                              const visitTypeDisplay = formatVisitType(visit.visitTypeId || visit.VisitTypeId || visit.visitType || visit.VisitType)
                              return visitTypeDisplay ? (
                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-teal-100 text-teal-700">
                                  {visitTypeDisplay}
                                </span>
                              ) : (
                                <span className="text-sm text-slate-400">N/A</span>
                              )
                            })()}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="text-sm text-slate-900">
                              {visit.duration !== undefined 
                                ? visit.duration 
                                : (visit.Duration !== undefined 
                                  ? visit.Duration 
                                  : "N/A")}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
                                Max: {visit.windowMax !== undefined ? visit.windowMax : (visit.WindowMax !== undefined ? visit.WindowMax : 0)}
                              </span>
                              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">
                                Min: {visit.windowMin !== undefined ? visit.windowMin : (visit.WindowMin !== undefined ? visit.WindowMin : 0)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-3">
                              <button 
                                type="button" 
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  handleToggleStatus(visit.id || visit.Id, isActive)
                                }}
                                disabled={isUpdating}
                                className={`relative inline-flex h-8 w-16 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer ${
                                  isActive
                                    ? "bg-blue-600 hover:bg-blue-700"
                                    : "bg-slate-300 hover:bg-slate-400"
                                }`}
                                onMouseDown={(e) => e.preventDefault()}
                              >
                                <span
                                  className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                                    isActive ? "translate-x-9" : "translate-x-1"
                                  }`}
                                />
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => handleEditVisit(visit)} 
                                className="px-3 py-1.5 rounded-lg bg-teal-100 text-teal-700 hover:bg-teal-200 transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                                title="Edit visit"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => handleDeleteVisit(visit.id || visit.Id, visit.visitName || visit.VisitName || `Visit ${visit.visitNo || visit.VisitNo}`)} 
                                disabled={deletingVisit === (visit.id || visit.Id)}
                                className="px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Delete visit"
                              >
                                {deletingVisit === (visit.id || visit.Id) ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {!listLoading && visitSchedules.length > 0 && totalPages > 0 && (
              <div className="px-4 sm:px-6 py-3 border-t border-slate-200 bg-slate-50/60">
                <DataPagination
                  currentPage={pageNumber}
                  pageSize={pageSize}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  onPageChange={setPageNumber}
                  onPageSizeChange={handlePageSizeChange}
                  itemName="visit schedules"
                  showPageSizeSelector={true}
                />
              </div>
            )}
          </div>
        </div>

        {/* Edit Visit Modal */}
        {editingVisit && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl my-8 border border-slate-100">
              {/* Modal Header */}
              <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-emerald-50 border-b border-slate-200 px-8 py-5 flex items-center justify-between z-10 rounded-t-3xl">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-slate-900">Edit Visit: {editingVisit.visitName || editingVisit.VisitName || `Visit ${editingVisit.visitNo || editingVisit.VisitNo}`}</h3>
                </div>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-white transition-all"
                >
                  <XIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className={VIEWPORT_PANEL_SCROLL_CLASS}>
                {loadingEditVisit ? (
                  <div className="space-y-4 p-8">
                    <Skeleton className="h-5 w-44 bg-slate-200/80" />
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <Skeleton className="h-10 w-full rounded-lg bg-slate-200/70" />
                      <Skeleton className="h-10 w-full rounded-lg bg-slate-200/70" />
                      <Skeleton className="h-10 w-full rounded-lg bg-slate-200/70" />
                      <Skeleton className="h-10 w-full rounded-lg bg-slate-200/70" />
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleUpdateVisit} className="p-8 space-y-6">
                    {/* Study Selection */}
                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                        <BookOpen className="w-4 h-4" />
                        Study <span className="text-red-500">*</span>
                      </label>
                      <Select
                        value={
                          editFormData.studyId != null && editFormData.studyId !== ""
                            ? String(editFormData.studyId)
                            : STUDY_PLACEHOLDER_VALUE
                        }
                        onValueChange={(v) =>
                          handleEditInputChange(
                            "studyId",
                            v === STUDY_PLACEHOLDER_VALUE ? null : parseInt(v, 10),
                          )
                        }
                        disabled={loadingStudies}
                      >
                        <SelectTrigger
                          className="h-auto w-full min-w-0 py-3"
                          aria-invalid={editErrors.studyId ? true : undefined}
                        >
                          <SelectValue placeholder="-- Select Study --" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={STUDY_PLACEHOLDER_VALUE}>-- Select Study --</SelectItem>
                          {availableStudies.map((study) => (
                            <SelectItem key={study.studyId} value={String(study.studyId)}>
                              {study.studyProtocolNumber || `Study ${study.studyId}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {editErrors.studyId && (
                        <p className="text-red-500 text-xs mt-1">{editErrors.studyId}</p>
                      )}
                    </div>
                    {/* Visit Type and Duration */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Visit Type <span className="text-red-500">*</span>
                        </label>
                        <Select
                          value={editFormData.visitType ? editFormData.visitType : VISIT_TYPE_PLACEHOLDER_VALUE}
                          onValueChange={(v) =>
                            handleEditInputChange("visitType", v === VISIT_TYPE_PLACEHOLDER_VALUE ? "" : v)
                          }
                        >
                          <SelectTrigger
                            className="h-auto w-full min-w-0 py-3"
                            aria-invalid={editErrors.visitType ? true : undefined}
                          >
                            <SelectValue placeholder="Select visit type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={VISIT_TYPE_PLACEHOLDER_VALUE}>Select visit type</SelectItem>
                            {visitTypeOptions.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {editErrors.visitType && (
                          <p className="text-red-500 text-xs mt-1">{editErrors.visitType}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Duration (Days) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={editFormData.duration}
                          onChange={(e) => handleEditInputChange("duration", e.target.value)}
                          placeholder="Enter duration in days"
                          className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${editErrors.duration
                            ? "border-red-300 bg-red-50/50 focus:border-red-500"
                            : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            } outline-none bg-white`}
                          required
                        />
                        {editErrors.duration && (
                          <p className="text-red-500 text-xs mt-1">{editErrors.duration}</p>
                        )}
                      </div>
                    </div>
                    {/* Visit Number and Name */}
                    <div className={`grid gap-6 ${editFormData.visitType === "Visits" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
                      {/* Visit Number - Only show for "Visits" type */}
                      {editFormData.visitType === "Visits" && (
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Visit Number <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={editFormData.visitNo}
                            onChange={(e) => handleEditInputChange("visitNo", e.target.value)}
                            placeholder="Enter visit number"
                            className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${editErrors.visitNo
                              ? "border-red-300 bg-red-50/50 focus:border-red-500"
                              : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                              } outline-none bg-white`}
                            required
                          />
                          {editErrors.visitNo && (
                            <p className="text-red-500 text-xs mt-1">{editErrors.visitNo}</p>
                          )}
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Visit Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={editFormData.visitName}
                          onChange={(e) => handleEditInputChange("visitName", e.target.value)}
                          placeholder="Enter visit name"
                          className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${editErrors.visitName
                            ? "border-red-300 bg-red-50/50 focus:border-red-500"
                            : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            } outline-none bg-white`}
                          required
                        />
                        {editErrors.visitName && (
                          <p className="text-red-500 text-xs mt-1">{editErrors.visitName}</p>
                        )}
                      </div>
                    </div>
                    {/* Window Min and Max */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Window Min (Days)
                        </label>
                        <input
                          type="text"
                          value={editFormData.windowMin}
                          onChange={(e) => handleEditInputChange("windowMin", e.target.value)}
                          placeholder="Enter window min"
                          className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Window Max (Days)
                        </label>
                        <input
                          type="text"
                          value={editFormData.windowMax}
                          onChange={(e) => handleEditInputChange("windowMax", e.target.value)}
                          placeholder="Enter window max"
                          className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none bg-white"
                        />
                      </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="px-6 py-2.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingVisit}
                        className="px-6 py-2.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-all font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingVisit ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            Save Changes
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Delete Visit Confirmation Modal */}
        {deleteConfirmVisit && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-red-200 overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white">Delete Visit</h3>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-slate-700">
                  Are you sure you want to delete visit <span className="font-semibold text-slate-900">"{deleteConfirmVisit.visitName}"</span>? This action cannot be undone.
                </p>
                <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmVisit(null)}
                    className="px-5 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeleteVisit}
                    disabled={deletingVisit === deleteConfirmVisit.id}
                    className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                  >
                    {deletingVisit === deleteConfirmVisit.id ? (
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
      </div>
    </DashboardLayout>
  )
}

