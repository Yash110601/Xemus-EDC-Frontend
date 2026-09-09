"use client"

import { VIEWPORT_PAGE_SHELL_WITH_EMERALD_BG_CLASS, VIEWPORT_PANEL_SCROLL_CLASS } from "@/lib/ui/responsivePageUi"

import { useState, useEffect, useRef } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import { studyService } from "@/lib/services"
import {
  convertStudyCRFTypeToFormValue,
  getStudyCRFTypeLabel,
  getStudyCRFTypeValue,
  getStudyDesignValue,
  getStudyPhaseValue,
  getStudyRowValue,
  getStudyTypeValue,
  resolveStudyEnumFromApi,
  studyEnumApiValueToFormSelect,
  validateStudyEnumPayload,
} from "@/lib/utils/studyFormEnums"
import { invalidateAccessibleStudiesCache } from "@/lib/utils/studySettingsRead"
import DataPagination from "@/components/ui/data-pagination"
import StudyManageSkeleton from "@/components/ui/study-manage-skeleton"
import {
  FileText,
  Calendar,
  Save,
  Send,
  X,
  Hash,
  BookOpen,
  Pill,
  Building2,
  FlaskConical,
  ClipboardList,
  FileCode,
  Edit,
  Search,
  Upload,
  File,
  Eye,
  Trash2,
  Loader2
} from "lucide-react"
import DatePicker from "@/components/ui/date-picker"

export default function StudyConfigurationPage() {
  const [activeTab, setActiveTab] = useState("create")
  const [formData, setFormData] = useState({
    studyProtocolNumber: "",
    studyTitle: "",
    nameOfDrug: "",
    tentativeStudyStartDate: "",
    studyDesign: "",
    comments: "",
    studyInitiationDate: "",
    sponsor: "",
    tentativeStudyEndDate: "",
    studyPhase: "",
    studyShortTitle: "",
    studyCRFType: "",
    studyType: "",
    userCreationPostfix: "",
  })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)
  const [studies, setStudies] = useState([])
  const [editingStudy, setEditingStudy] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [editFormData, setEditFormData] = useState(null)
  const [editErrors, setEditErrors] = useState({})
  const [editLoading, setEditLoading] = useState(false)
  const [ecLetterFile, setEcLetterFile] = useState(null)
  const [protocolFile, setProtocolFile] = useState(null)
  const [existingEcLetter, setExistingEcLetter] = useState(null)
  const [existingProtocol, setExistingProtocol] = useState(null)
  const ecLetterFileInputRef = useRef(null)
  const protocolFileInputRef = useRef(null)
  // Pagination state
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [isActiveFilter, setIsActiveFilter] = useState(null)
  const [updatingStatus, setUpdatingStatus] = useState({})
  const [deletingStudy, setDeletingStudy] = useState(null)
  const [viewingDocument, setViewingDocument] = useState(null)
  const [manageLoading, setManageLoading] = useState(false)
  // Helper function to convert date string to ISO format for API
  // .NET Core expects ISO 8601 format: YYYY-MM-DDTHH:mm:ss.fffZ
  const convertDateToISO = (dateString) => {
    if (!dateString) return null;
    // If it's already in ISO format, return as is
    if (dateString.includes('T') && dateString.includes('Z')) {
      return dateString;
    }
    // Convert date input (YYYY-MM-DD) to ISO 8601 format
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  };

  // Helper function to convert ISO date string to YYYY-MM-DD format for date inputs
  const convertISOToDateInput = (dateString) => {
    if (!dateString) return "";
    try {
      // If it's already in YYYY-MM-DD format, return as is
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString;
      }
      // Parse ISO date string and convert to YYYY-MM-DD
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "";
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (error) {
      return "";
    }
  };

  // Helper function to format date for display in dd-mm-yyyy format
  const formatDateForDisplay = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "N/A";
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (error) {
      return "N/A";
    }
  };

  const handleInputChange = (field, value, maxLength) => {
    if (maxLength && value.length > maxLength) return
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const handleSubmit = async (e, action) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    const newErrors = {}
    if (!formData.studyProtocolNumber) newErrors.studyProtocolNumber = "This field is required."
    if (!formData.studyTitle) newErrors.studyTitle = "This field is required."
    if (!formData.tentativeStudyStartDate) newErrors.tentativeStudyStartDate = "This field is required."
    if (!formData.studyInitiationDate) newErrors.studyInitiationDate = "This field is required."
    if (!formData.studyShortTitle) newErrors.studyShortTitle = "This field is required."
    if (!formData.studyCRFType) newErrors.studyCRFType = "This field is required."
    if (!formData.studyType) newErrors.studyType = "This field is required."
    if (!formData.studyDesign) newErrors.studyDesign = "This field is required."
    if (!formData.studyPhase) newErrors.studyPhase = "This field is required."

    setErrors(newErrors)

    if (Object.keys(newErrors).length > 0) {
      setError("Please fill in all required fields")
      return
    }

    try {
      setLoading(true)

      const studyData = {
        NameOfDrug: formData.nameOfDrug,
        StudyShortTitle: formData.studyShortTitle,
        StudyCRFType: getStudyCRFTypeValue(formData.studyCRFType),
        StudyProtocolNumber: formData.studyProtocolNumber,
        StudyTitle: formData.studyTitle,
        Sponsor: formData.sponsor,
        TentativeStudyStartDate: convertDateToISO(formData.tentativeStudyStartDate),
        StudyInitiationDate: convertDateToISO(formData.studyInitiationDate),
        StudyType: getStudyTypeValue(formData.studyType),
        StudyDesign: getStudyDesignValue(formData.studyDesign),
        StudyPhase: getStudyPhaseValue(formData.studyPhase),
      }
      if (ecLetterFile) {
        studyData.ECLetterDocument = ecLetterFile
      }
      if (protocolFile) {
        studyData.ProtocolDocument = protocolFile
      }
      if (formData.tentativeStudyEndDate) {
        studyData.TentativeStudyEndDate = convertDateToISO(formData.tentativeStudyEndDate)
      }
      if (formData.userCreationPostfix) {
        studyData.UserCreationPostfix = formData.userCreationPostfix
      }
      if (formData.comments && formData.comments.trim()) {
        studyData.Comments = formData.comments.trim()
      }

      const enumValidationMessage = validateStudyEnumPayload(studyData)
      if (enumValidationMessage) {
        setError(enumValidationMessage)
        setLoading(false)
        return
      }

      const response = await studyService.createStudy(studyData)

      if (response.isSuccess) {
        setSuccess(response.message || "Study created successfully!")
        handleClear()
        // Reset to first page to see the new study
        setPageNumber(1)
        // Always switch to manage tab and fetch studies
        if (activeTab !== "manage") {
          setActiveTab("manage")
        }
        // Fetch studies - this will be called by useEffect when activeTab changes,
        // but we also call it explicitly to ensure it happens immediately
        await fetchStudies()
        // Clear success message after 5 seconds
        setTimeout(() => {
          setSuccess("")
        }, 5000)
      } else {
        let errorMessage = response.message || "Failed to create study."

        // If response.data contains error details, try to extract them
        if (response.data) {
          if (typeof response.data === "string") {
            errorMessage = response.data
          } else if (typeof response.data === "object") {
            // Check for common error response formats
            if (response.data.message) {
              errorMessage = response.data.message
            } else if (response.data.errors) {
              errorMessage = Object.values(response.data.errors).flat().join(", ")
            } else {
              // Map field-specific errors
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
                setErrors(apiErrors)
                errorMessage = "Please correct the errors below."
              }
            }
          }
        }

        setError(errorMessage)
      }
    } catch (error) {
      setError("An error occurred while creating the study. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (field, file) => {
    if (field === "ecLetter") {
      setEcLetterFile(file)
      if (errors.ecLetterFile) {
        setErrors((prev) => {
          const newErrors = { ...prev }
          delete newErrors.ecLetterFile
          return newErrors
        })
      }
    } else if (field === "protocol") {
      setProtocolFile(file)
      if (errors.protocolFile) {
        setErrors((prev) => {
          const newErrors = { ...prev }
          delete newErrors.protocolFile
          return newErrors
        })
      }
    }
  }

  // Handle toggle site status
  // Handle viewing document via API
  const handleViewDocument = async (documentUrl, documentName) => {
    if (!documentUrl) {
      setError("Document URL is required")
      setTimeout(() => setError(""), 3000)
      return
    }

    try {
      setViewingDocument(documentUrl)
      const response = await studyService.viewStudyDocumentByUrl(documentUrl, false)
      
      if (!response.isSuccess) {
        setError(response.message || "Failed to view document")
        setTimeout(() => setError(""), 3000)
      }
      // If successful, the service method will open the document in a new tab
    } catch (error) {
      setError("An error occurred while viewing the document")
      setTimeout(() => setError(""), 3000)
    } finally {
      setViewingDocument(null)
    }
  }

  const handleToggleStatus = async (studyId, currentStatus) => {
    // Prevent multiple clicks
    if (updatingStatus[studyId]) {
      return
    }

    try {
      setUpdatingStatus((prev) => ({ ...prev, [studyId]: true }))
      const newStatus = !currentStatus

      // Helper to get value from camelCase or PascalCase
      const getValue = (obj, ...keys) => {
        for (const key of keys) {
          if (obj[key] !== undefined) return obj[key]
        }
        return null
      }

      // Optimistically update UI immediately for instant feedback
      setStudies((prev) =>
        prev.map((site) => {
          const rowId = getStudyRowValue(site, "id", "Id")
          if (rowId === studyId) {
            return { ...site, isActive: newStatus, IsActive: newStatus }
          }
          return site
        })
      )

      // API Call: PUT /api/Sites/UpdateSiteStatus/{id}?isActive={isActive}
      const response = await studyService.updateStudyStatus(studyId, newStatus)

      if (response.isSuccess) {
        setSuccess(`Site status updated to ${newStatus ? "Active" : "Inactive"}`)
        setTimeout(() => setSuccess(""), 3000)
      } else {
        // Revert on error
        setStudies((prev) =>
          prev.map((site) => {
            const rowId = getStudyRowValue(site, "id", "Id")
            if (rowId === studyId) {
              return { ...site, isActive: currentStatus, IsActive: currentStatus }
            }
            return site
          })
        )
        setError(response.message || "Failed to update site status")
        setTimeout(() => setError(""), 3000)
      }
    } catch (error) {
      // Revert on error
      setStudies((prev) =>
        prev.map((site) => {
          const rowId = getStudyRowValue(site, "id", "Id")
          if (rowId === studyId) {
            return { ...site, isActive: currentStatus, IsActive: currentStatus }
          }
          return site
        })
      )
      setError("An error occurred while updating site status")
      setTimeout(() => setError(""), 3000)
    } finally {
      setUpdatingStatus((prev) => ({ ...prev, [studyId]: false }))
    }
  }

  const handleDeleteStudy = async (studyId, studyLabel) => {
    if (!studyId) {
      setError("Invalid study selected for delete.")
      setTimeout(() => setError(""), 3000)
      return
    }

    const confirmed = window.confirm(
      `Delete study "${studyLabel}"? This will remove it from the study list.`
    )
    if (!confirmed) return

    setError("")
    setSuccess("")
    setDeletingStudy(studyId)

    try {
      const response = await studyService.deleteStudy(studyId)
      if (response.isSuccess) {
        setSuccess(response.message || "Study deleted successfully!")
        invalidateAccessibleStudiesCache()
        if (editingStudy === studyId) {
          handleCancelEdit()
        }
        await fetchStudies()
        setTimeout(() => setSuccess(""), 3000)
      } else {
        setError(response.message || "Failed to delete study.")
        setTimeout(() => setError(""), 3000)
      }
    } catch (deleteError) {
      setError("An error occurred while deleting the study.")
      setTimeout(() => setError(""), 3000)
    } finally {
      setDeletingStudy(null)
    }
  }

  const handleClear = () => {
    setFormData({
      studyProtocolNumber: "",
      studyTitle: "",
      nameOfDrug: "",
      tentativeStudyStartDate: "",
      studyDesign: "",
      comments: "",
      studyInitiationDate: "",
      sponsor: "",
      tentativeStudyEndDate: "",
      studyPhase: "",
      studyShortTitle: "",
      studyCRFType: "",
      studyType: "",
      userCreationPostfix: "",
    })
    setErrors({})
    setEcLetterFile(null)
    setProtocolFile(null)
    // Reset file input elements
    if (ecLetterFileInputRef.current) {
      ecLetterFileInputRef.current.value = ""
    }
    if (protocolFileInputRef.current) {
      protocolFileInputRef.current.value = ""
    }
  }

  const handleEditInputChange = (field, value, maxLength) => {
    if (maxLength && value.length > maxLength) return
    setEditFormData((prev) => ({ ...prev, [field]: value }))
    if (editErrors[field]) {
      setEditErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }
  const isStudySelectEmpty = (value) => value === undefined || value === null || value === ""

  const handleEditStudy = (study) => {
    setError("")
    setSuccess("")
    setEcLetterFile(null)
    setProtocolFile(null)

    const studyId = getStudyRowValue(study, "id", "Id")
    setEditingStudy(studyId)

    const documents = study.documents || study.Documents || []
    const ecLetterDoc = documents.find(doc => {
      const docTypeId = getStudyRowValue(doc, 'documentTypeId', 'DocumentTypeId')
      return docTypeId === 1 || docTypeId === "1" || docTypeId === "ECLetter" || docTypeId === "ecLetter"
    })
    const protocolDoc = documents.find(doc => {
      const docTypeId = getStudyRowValue(doc, 'documentTypeId', 'DocumentTypeId')
      return docTypeId === 2 || docTypeId === "2" || docTypeId === "Protocol" || docTypeId === "protocol"
    })

    const studyTypeValue = resolveStudyEnumFromApi(study, "studyType")
    const studyDesignValue = resolveStudyEnumFromApi(study, "studyDesign")
    const studyPhaseValue = resolveStudyEnumFromApi(study, "studyPhase")

    const formData = {
      studyProtocolNumber: getStudyRowValue(study, "studyProtocolNumber", "StudyProtocolNumber") ?? "",
      studyTitle: getStudyRowValue(study, "studyTitle", "StudyTitle") ?? "",
      studyShortTitle: getStudyRowValue(study, "studyShortTitle", "StudyShortTitle") ?? "",
      nameOfDrug: getStudyRowValue(study, "nameOfDrug", "NameOfDrug") ?? "",
      sponsor: getStudyRowValue(study, "sponsor", "Sponsor") ?? "",
      comments: getStudyRowValue(study, "comments", "Comments") ?? "",
      userCreationPostfix: getStudyRowValue(study, "userCreationPostfix", "UserCreationPostfix") ?? "",
      tentativeStudyStartDate: convertISOToDateInput(getStudyRowValue(study, 'tentativeStudyStartDate', 'TentativeStudyStartDate')),
      studyInitiationDate: convertISOToDateInput(getStudyRowValue(study, 'studyInitiationDate', 'StudyInitiationDate')),
      tentativeStudyEndDate: convertISOToDateInput(getStudyRowValue(study, 'tentativeStudyEndDate', 'TentativeStudyEndDate')),
      studyCRFType: convertStudyCRFTypeToFormValue(getStudyRowValue(study, 'studyCRFType', 'StudyCRFType', 'studyCRFTypeName')),
      studyType: studyEnumApiValueToFormSelect(studyTypeValue, "studyType"),
      studyDesign: studyEnumApiValueToFormSelect(studyDesignValue, "studyDesign"),
      studyPhase: studyEnumApiValueToFormSelect(studyPhaseValue, "studyPhase"),
    }

    setEditFormData(formData)

    // Set existing documents
    setExistingEcLetter(ecLetterDoc || null)
    setExistingProtocol(protocolDoc || null)
    setEditErrors({})
    // Reset file input refs
    if (ecLetterFileInputRef.current) {
      ecLetterFileInputRef.current.value = ""
    }
    if (protocolFileInputRef.current) {
      protocolFileInputRef.current.value = ""
    }
  }

  const handleCancelEdit = () => {
    setEditingStudy(null)
    setEditFormData(null)
    setEditErrors({})
    setEcLetterFile(null)
    setProtocolFile(null)
    setExistingEcLetter(null)
    setExistingProtocol(null)
    // Reset file input refs
    if (ecLetterFileInputRef.current) {
      ecLetterFileInputRef.current.value = ""
    }
    if (protocolFileInputRef.current) {
      protocolFileInputRef.current.value = ""
    }
  }

  const handleUpdateStudy = async (e) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setEditLoading(true)

    const newErrors = {}
    if (!editFormData.studyProtocolNumber) newErrors.studyProtocolNumber = "This field is required."
    if (!editFormData.studyTitle) newErrors.studyTitle = "This field is required."
    if (!editFormData.tentativeStudyStartDate) newErrors.tentativeStudyStartDate = "This field is required."
    if (!editFormData.studyShortTitle) newErrors.studyShortTitle = "This field is required."
    if (isStudySelectEmpty(editFormData.studyCRFType)) newErrors.studyCRFType = "This field is required."
    if (isStudySelectEmpty(editFormData.studyType)) newErrors.studyType = "This field is required."
    if (isStudySelectEmpty(editFormData.studyDesign)) newErrors.studyDesign = "This field is required."
    if (isStudySelectEmpty(editFormData.studyPhase)) newErrors.studyPhase = "This field is required."
    if (!editFormData.studyInitiationDate) newErrors.studyInitiationDate = "This field is required."

    setEditErrors(newErrors)

    if (Object.keys(newErrors).length > 0) {
      setError("Please fill in all required fields.")
      setEditLoading(false)
      return
    }

    const studyId = editingStudy ?? getStudyRowValue(editFormData, "id", "Id")
    if (!studyId) {
      setError("Invalid study selected. Please close and open edit again.")
      setEditLoading(false)
      return
    }

    try {
      const studyData = {
        NameOfDrug: editFormData.nameOfDrug,
        StudyShortTitle: editFormData.studyShortTitle,
        StudyCRFType: getStudyCRFTypeValue(editFormData.studyCRFType),
        StudyProtocolNumber: editFormData.studyProtocolNumber,
        StudyTitle: editFormData.studyTitle,
        Sponsor: editFormData.sponsor,
        TentativeStudyStartDate: convertDateToISO(editFormData.tentativeStudyStartDate),
        StudyInitiationDate: convertDateToISO(editFormData.studyInitiationDate),
        StudyType: getStudyTypeValue(editFormData.studyType),
        StudyDesign: getStudyDesignValue(editFormData.studyDesign),
        StudyPhase: getStudyPhaseValue(editFormData.studyPhase),
      }

      // Add optional fields if they exist
      if (editFormData.tentativeStudyEndDate) {
        studyData.TentativeStudyEndDate = convertDateToISO(editFormData.tentativeStudyEndDate)
      }
      if (editFormData.userCreationPostfix) {
        studyData.UserCreationPostfix = editFormData.userCreationPostfix
      }
      if (editFormData.comments && editFormData.comments.trim()) {
        studyData.Comments = editFormData.comments.trim()
      }
      if (ecLetterFile) {
        studyData.ECLetterDocument = ecLetterFile
      }
      if (protocolFile) {
        studyData.ProtocolDocument = protocolFile
      }

      const enumValidationMessage = validateStudyEnumPayload(studyData)
      if (enumValidationMessage) {
        setError(enumValidationMessage)
        setEditLoading(false)
        return
      }

      const response = await studyService.updateStudy(studyId, studyData)

      if (response.isSuccess) {
        setSuccess(response.message || "Study updated successfully!")
        invalidateAccessibleStudiesCache()
        // Refresh studies list
        fetchStudies()
        // Cancel edit mode
        handleCancelEdit()
      } else {
        setError(response.message || "Failed to update study. Please try again.")
        // Map API errors if present
        if (response.data && typeof response.data === "object") {
          const apiErrors = {}
          Object.keys(response.data).forEach((key) => {
            const formField = key.charAt(0).toLowerCase() + key.slice(1)
            apiErrors[formField] = response.data[key]
          })
          if (Object.keys(apiErrors).length > 0) {
            setEditErrors(apiErrors)
          }
        }
      }
    } catch (error) {
      setError("An error occurred while updating the study. Please try again.")
    } finally {
      setEditLoading(false)
    }
  }

  const fetchStudies = async () => {
    setManageLoading(true)
    try {
      const response = await studyService.getStudiesList(pageNumber, pageSize, debouncedSearchTerm, isActiveFilter)
      if (response?.isSuccess && response?.data) {
        // API returns { items, pageNumber, pageSize, totalCount, totalPages }
        const data = response.data
        const list = Array.isArray(data)
          ? data
          : (data.items || data.Items || [])
        
        // Debug: Log first study structure to see document structure
        if (list.length > 0 && process.env.NODE_ENV === 'development') {
          console.log('First study structure:', {
            id: list[0].id || list[0].Id,
            studyProtocolNumber: list[0].studyProtocolNumber || list[0].StudyProtocolNumber,
            hasDocuments: !!list[0].documents,
            hasDocumentsPascal: !!list[0].Documents,
            documentsLength: (list[0].documents || list[0].Documents || []).length,
            allKeys: Object.keys(list[0] || {}),
            documentsSample: list[0].documents || list[0].Documents || 'not found'
          })
        }
        
        setStudies(list)

        // Update pagination metadata
        if (data && typeof data === "object" && !Array.isArray(data)) {
          setTotalCount(data.totalCount || data.TotalCount || 0)
          setTotalPages(data.totalPages || data.TotalPages || 0)
        }
      } else {
        setStudies([])
        setTotalCount(0)
        setTotalPages(0)
      }
    } catch (error) {
      setStudies([])
      setTotalCount(0)
      setTotalPages(0)
    } finally {
      setManageLoading(false)
    }
  }

  // Debounce search term
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Handler for page size changes
  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize)
    setPageNumber(1) // Reset to first page when page size changes
  }

  // Reset to page 1 when search term or filter changes
  useEffect(() => {
    if (activeTab === "manage") {
      setPageNumber(1)
    }
  }, [debouncedSearchTerm, isActiveFilter, activeTab])

  // Fetch studies when tab changes, page changes, or search changes
  useEffect(() => {
    if (activeTab === "manage") {
      fetchStudies()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, pageNumber, pageSize, debouncedSearchTerm, isActiveFilter])

  return (
    <DashboardLayout>
      <div className={VIEWPORT_PAGE_SHELL_WITH_EMERALD_BG_CLASS}>
        {/* Main Container */}
        <div className="space-y-6">
          {/* Tabs */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex">
              <button
                onClick={() => setActiveTab("create")}
                className={`flex-1 px-6 py-4 text-sm font-semibold transition-all relative ${activeTab === "create"
                  ? "text-blue-600 bg-blue-50/50"
                  : "text-slate-600 hover:text-blue-900 hover:bg-blue-50"
                  }`}
              >
                Create Study
                {activeTab === "create" && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r btn-brand-gradient" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("manage")}
                className={`flex-1 px-6 py-4 text-sm font-semibold transition-all relative ${activeTab === "manage"
                  ? "text-blue-600 bg-blue-50/50"
                  : "text-slate-600 hover:text-blue-900 hover:bg-blue-50"
                  }`}
              >
                Manage Studies
                {activeTab === "manage" && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r btn-brand-gradient" />
                )}
              </button>
            </div>
          </div>

          {/* Form Content */}
          {activeTab === "create" ? (
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Success/Error Messages */}
              {success && (
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-bold">✓</span>
                  </div>
                  <p className="text-green-800 font-medium">{success}</p>
                  <button
                    type="button"
                    onClick={() => setSuccess("")}
                    className="ml-auto text-green-600 hover:text-green-800"
                  >
                    <X className="w-5 h-5" />
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
                    type="button"
                    onClick={() => setError("")}
                    className="ml-auto text-red-600 hover:text-red-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
              {/* Section 1: Basic Information */}
              <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                    <Hash className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Basic Information</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                      Study <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.studyProtocolNumber}
                      onChange={(e) => handleInputChange("studyProtocolNumber", e.target.value, 50)}
                      className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${errors.studyProtocolNumber
                        ? "border-red-300 bg-red-50/50 focus:border-red-500"
                        : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        } outline-none`}
                      placeholder="Enter study/protocol number"
                      required
                    />
                    {errors.studyProtocolNumber && (
                      <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                        <span>⚠</span> {errors.studyProtocolNumber}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 mt-1.5 font-medium">
                      {formData.studyProtocolNumber.length} / 50 characters
                    </p>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                      Study Short Title (For TLF Files) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.studyShortTitle}
                      onChange={(e) => handleInputChange("studyShortTitle", e.target.value, 50)}
                      className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${errors.studyShortTitle
                        ? "border-red-300 bg-red-50/50 focus:border-red-500"
                        : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        } outline-none`}
                      placeholder="Enter short title"
                      required
                    />
                    {errors.studyShortTitle && (
                      <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                        <span>⚠</span> {errors.studyShortTitle}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 mt-1.5 font-medium">
                      {formData.studyShortTitle.length} / 50 characters
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                      <BookOpen className="w-4 h-4" /> Study Title <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={formData.studyTitle}
                      onChange={(e) => handleInputChange("studyTitle", e.target.value, 500)}
                      className={`w-full px-4 py-3 rounded-lg border-2 transition-all resize-none ${errors.studyTitle
                        ? "border-red-300 bg-red-50/50 focus:border-red-500"
                        : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        } outline-none`}
                      placeholder="Enter study title"
                      rows={3}
                      required
                    />
                    {errors.studyTitle && (
                      <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                        <span>⚠</span> {errors.studyTitle}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 mt-1.5 font-medium">
                      {formData.studyTitle.length} / 500 characters
                    </p>
                  </div>
                </div>
              </div>

              {/* Section 2: Drug & Sponsor Information */}
              <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
                    <Pill className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Drug & Sponsor Information</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                      Name of Drug
                    </label>
                    <input
                      type="text"
                      value={formData.nameOfDrug}
                      onChange={(e) => handleInputChange("nameOfDrug", e.target.value, 200)}
                      className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${errors.nameOfDrug
                        ? "border-red-300 bg-red-50/50 focus:border-red-500"
                        : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        } outline-none`}
                      placeholder="Enter drug name"
                    />
                    {errors.nameOfDrug && (
                      <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                        <span>⚠</span> {errors.nameOfDrug}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                      <Building2 className="w-4 h-4" /> Sponsor
                    </label>
                    <input
                      type="text"
                      value={formData.sponsor}
                      onChange={(e) => handleInputChange("sponsor", e.target.value, 200)}
                      className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${errors.sponsor
                        ? "border-red-300 bg-red-50/50 focus:border-red-500"
                        : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        } outline-none`}
                      placeholder="Enter sponsor name"
                    />
                    {errors.sponsor && (
                      <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                        <span>⚠</span> {errors.sponsor}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 3: Dates & Timeline */}
              <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Dates & Timeline</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                      Study Initiation Date <span className="text-red-500">*</span>
                    </label>
                  <DatePicker
                    value={formData.studyInitiationDate || null}
                    onChange={(val) => handleInputChange("studyInitiationDate", val || "")}
                    className={`px-4 py-3 ${
                      errors.studyInitiationDate
                        ? "border-red-300 bg-red-50/50 focus-visible:border-red-500"
                        : "border-slate-200 focus-visible:border-blue-500 focus-visible:ring-blue-100"
                    }`}
                  />
                    {errors.studyInitiationDate && (
                      <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                        <span>⚠</span> {errors.studyInitiationDate}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                      Tentative Study Start Date <span className="text-red-500">*</span>
                    </label>
                  <DatePicker
                    value={formData.tentativeStudyStartDate || null}
                    onChange={(val) => handleInputChange("tentativeStudyStartDate", val || "")}
                    className={`px-4 py-3 ${
                      errors.tentativeStudyStartDate
                        ? "border-red-300 bg-red-50/50 focus-visible:border-red-500"
                        : "border-slate-200 focus-visible:border-blue-500 focus-visible:ring-blue-100"
                    }`}
                  />
                    {errors.tentativeStudyStartDate && (
                      <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                        <span>⚠</span> {errors.tentativeStudyStartDate}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                      Tentative Study End Date
                    </label>
                  <DatePicker
                    value={formData.tentativeStudyEndDate || null}
                    onChange={(val) => handleInputChange("tentativeStudyEndDate", val || "")}
                    className="px-4 py-3 border-slate-200 focus-visible:border-blue-500 focus-visible:ring-blue-100"
                  />
                  </div>
                </div>
              </div>

              {/* Section 4: Study Details */}
              <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                    <FlaskConical className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Study Details</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                      Study Design <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={formData.studyDesign}
                        onChange={(e) => handleInputChange("studyDesign", e.target.value)}
                        className={`w-full px-4 py-3 rounded-lg border-2 transition-all appearance-none bg-white ${errors.studyDesign
                          ? "border-red-300 bg-red-50/50 focus:border-red-500"
                          : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                          } outline-none`}
                        required
                      >
                        <option value="">-- Select Study Design --</option>
                        <option value="1">Randomized</option>
                        <option value="2">Non-Randomized</option>
                        <option value="3">Open Label</option>
                        <option value="4">Double Blind</option>
                        <option value="5">Single Blind</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    {errors.studyDesign && (
                      <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                        <span>⚠</span> {errors.studyDesign}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                      Study Phase <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={formData.studyPhase}
                        onChange={(e) => handleInputChange("studyPhase", e.target.value)}
                        className={`w-full px-4 py-3 rounded-lg border-2 transition-all appearance-none bg-white ${errors.studyPhase
                          ? "border-red-300 bg-red-50/50 focus:border-red-500"
                          : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                          } outline-none`}
                        required
                      >
                        <option value="">-- Select Study Phase --</option>
                        <option value="0">Phase0</option>
                        <option value="1">PhaseI</option>
                        <option value="2">PhaseII</option>
                        <option value="3">PhaseIII</option>
                        <option value="6">PhaseIIIA</option>
                        <option value="7">PhaseIIIB</option>
                        <option value="4">PhaseIV</option>
                        <option value="5">PostMarketing</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    {errors.studyPhase && (
                      <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                        <span>⚠</span> {errors.studyPhase}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                      <FileCode className="w-4 h-4" /> Study CRF Type <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={formData.studyCRFType}
                        onChange={(e) => handleInputChange("studyCRFType", e.target.value)}
                        className={`w-full px-4 py-3 rounded-lg border-2 transition-all appearance-none bg-white ${errors.studyCRFType
                          ? "border-red-300 bg-red-50/50 focus:border-red-500"
                          : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                          } outline-none`}
                        required
                      >
                        <option value="">-- Select CRF Type --</option>
                        <option value="0">PMS</option>
                        <option value="1">Clinical Trial</option>
                        <option value="2">Observational</option>
                        <option value="3">RWE</option>
                        <option value="4">Investigator Initiated Study</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    {errors.studyType && (
                      <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                        <span>⚠</span> {errors.studyType}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                      Study Type <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        value={formData.studyType}
                        onChange={(e) => handleInputChange("studyType", e.target.value)}
                        className={`w-full px-4 py-3 rounded-lg border-2 transition-all appearance-none bg-white ${errors.studyType
                          ? "border-red-300 bg-red-50/50 focus:border-red-500"
                          : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                          } outline-none`}
                        required
                      >
                        <option value="">-- Select Study Type --</option>
                        <option value="1">Normal</option>
                        <option value="2">Milestone(Patient wise)</option>
                        <option value="3">Milestone(visit wise)</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    {errors.studyType && (
                      <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                        <span>⚠</span> {errors.studyType}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 5: Document Uploads */}
              <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Document Uploads</h2>
                </div>
                <p className="text-sm text-slate-500 mb-4">EC Letter and Protocol are optional. You can upload them now or add them later when editing the study.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                      <File className="w-4 h-4" /> Upload EC Letter <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <div className="relative">
                      <input
                        ref={ecLetterFileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => handleFileChange("ecLetter", e.target.files[0])}
                        className={`w-full px-4 py-3 rounded-lg border-2 transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer ${errors.ecLetterFile
                          ? "border-red-300 bg-red-50/50 focus:border-red-500"
                          : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                          } outline-none`}
                      />
                    </div>
                    {errors.ecLetterFile && (
                      <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                        <span>⚠</span> {errors.ecLetterFile}
                      </p>
                    )}
                    {ecLetterFile && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                        <FileText className="w-4 h-4" />
                        <span>{ecLetterFile.name}</span>
                        <span className="text-xs text-slate-400">
                          ({(ecLetterFile.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                      <File className="w-4 h-4" /> Upload Protocol <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <div className="relative">
                      <input
                        ref={protocolFileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => handleFileChange("protocol", e.target.files[0])}
                        className={`w-full px-4 py-3 rounded-lg border-2 transition-all file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer ${errors.protocolFile
                          ? "border-red-300 bg-red-50/50 focus:border-red-500"
                          : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                          } outline-none`}
                      />
                    </div>
                    {errors.protocolFile && (
                      <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                        <span>⚠</span> {errors.protocolFile}
                      </p>
                    )}
                    {protocolFile && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                        <FileText className="w-4 h-4" />
                        <span>{protocolFile.name}</span>
                        <span className="text-xs text-slate-400">
                          ({(protocolFile.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 6: Additional Comments */}
              <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center">
                    <ClipboardList className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Additional Comments</h2>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Comments</label>
                  <textarea
                    value={formData.comments}
                    onChange={(e) => handleInputChange("comments", e.target.value, 500)}
                    className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all resize-none"
                    placeholder="Enter any additional comments or notes"
                    rows={4}
                  />
                  <p className="text-xs text-slate-500 mt-1.5 font-medium">
                    {formData.comments.length} / 500 characters
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
                <div className="flex justify-end gap-4">
                  <button
                    type="button"
                    onClick={handleClear}
                    disabled={loading}
                    className="px-6 py-3 rounded-lg border-2 border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 hover:border-slate-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Clear
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-3 rounded-lg bg-gradient-to-r btn-brand-gradient text-white font-semibold  transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    {loading ? "Submitting..." : "Submit"}
                  </button>
                </div>
              </div>
            </form>
          ) : (
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
                    <X className="w-5 h-5" />
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
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* Search Bar and Filters */}
              <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 rounded-lg border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                      placeholder="Search studies by protocol number, title, or sponsor..."
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-semibold text-slate-700 whitespace-nowrap">Status:</label>
                    <select
                      value={isActiveFilter === null ? "" : isActiveFilter.toString()}
                      onChange={(e) => {
                        const value = e.target.value
                        setIsActiveFilter(value === "" ? null : value === "true")
                        setPageNumber(1)
                      }}
                      className="px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all appearance-none bg-white"
                    >
                      <option value="">All</option>
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Studies Table */}
              {manageLoading && studies.length === 0 ? (
                <StudyManageSkeleton />
              ) : studies.length === 0 ? (
                <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-emerald-100 flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">No Studies Found</h2>
                  <p className="text-slate-600">Create your first study to get started.</p>
                </div>
              ) : (
                <div className="relative bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                  <div className={`overflow-x-auto transition-opacity duration-150 ${manageLoading ? "opacity-65" : "opacity-100"}`}>
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b-2 border-slate-200">
                        <tr>
                          <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">STUDY PROTOCOL NUMBER</th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">SHORT TITLE</th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">STUDY TITLE</th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">DRUG NAME</th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">SPONSOR</th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">STUDY PHASE</th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">CRF TYPE</th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">STUDY DESIGN</th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">TYPE OF STUDY</th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">START DATE</th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">INITIATION DATE</th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">END DATE</th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">EC Letter</th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Protocol</th>
                          <th className="px-4 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">STATUS</th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">ACTION</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-200">
                        {studies.map((study) => {
                          const studyId = getStudyRowValue(study, "id", "Id")
                          const studyProtocolLabel =
                            getStudyRowValue(study, "studyProtocolNumber", "StudyProtocolNumber") ||
                            getStudyRowValue(study, "studyShortTitle", "StudyShortTitle") ||
                            "Study"
                          const isActive =
                            study.isActive !== undefined
                              ? study.isActive
                              : study.IsActive !== undefined
                                ? study.IsActive
                                : true

                          return (
                          <tr key={studyId ?? studyProtocolLabel} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                                  <FileText className="w-4 h-4 text-white" />
                                </div>
                                <div className="text-sm font-semibold text-slate-900">{study.studyProtocolNumber || "N/A"}</div>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-slate-900">{study.studyShortTitle || "N/A"}</div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-sm text-slate-900 max-w-xs truncate" title={study.studyTitle}>
                                {study.studyTitle || "N/A"}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-slate-900">{study.nameOfDrug || "N/A"}</div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-slate-900">{study.sponsor || "N/A"}</div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              {study.studyPhaseName ? (
                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-teal-100 text-teal-700">
                                  {study.studyPhaseName}
                                </span>
                              ) : (
                                <span className="text-sm text-slate-400">N/A</span>
                              )}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              {getStudyCRFTypeLabel(study.studyCRFType ?? study.studyCRFTypeName) ? (
                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
                                  {getStudyCRFTypeLabel(study.studyCRFType ?? study.studyCRFTypeName)}
                                </span>
                              ) : (
                                <span className="text-sm text-slate-400">N/A</span>
                              )}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-slate-900">{study.studyDesignName || "N/A"}</div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-slate-900">{study.studyTypeName || "N/A"}</div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-slate-600">{formatDateForDisplay(study.tentativeStudyStartDate)}</div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-slate-600">{formatDateForDisplay(study.studyInitiationDate)}</div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-slate-600">{formatDateForDisplay(study.tentativeStudyEndDate)}</div>
                            </td>
                            <td className="px-4 py-4">
                              {(() => {
                                // Helper to get value from camelCase or PascalCase
                                const getValue = (obj, ...keys) => {
                                  for (const key of keys) {
                                    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key]
                                  }
                                  return null
                                }
                                
                                // Get documents array from study
                                const documents = Array.isArray(study.documents) ? study.documents : (Array.isArray(study.Documents) ? study.Documents : [])
                                
                                if (documents.length === 0) {
                                  return <span className="text-xs text-slate-400">No document</span>
                                }
                                
                                // Find EC Letter document (documentTypeId === "ECLetter")
                                const ecLetterDoc = documents.find(doc => {
                                  const docTypeId = getValue(doc, 'documentTypeId', 'DocumentTypeId', 'typeId', 'TypeId', 'documentType', 'DocumentType')
                                  // Check for both string and numeric values
                                  return docTypeId === 'ECLetter' || docTypeId === 1 || docTypeId === '1'
                                })
                                
                                if (!ecLetterDoc) {
                                  return <span className="text-xs text-slate-400">No document</span>
                                }
                                
                                const docUrl = getValue(ecLetterDoc, 'documentUrl', 'DocumentUrl', 'url', 'Url', 'fileUrl', 'FileUrl', 'blobUrl', 'BlobUrl')
                                const docName = getValue(ecLetterDoc, 'documentName', 'DocumentName', 'name', 'Name', 'fileName', 'FileName') || 'EC Letter'
                                
                                if (!docUrl) {
                                  return <span className="text-xs text-slate-400">No document</span>
                                }
                                
                                return (
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleViewDocument(docUrl, docName)}
                                      disabled={viewingDocument === docUrl}
                                      className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                      title="View EC Letter"
                                    >
                                      {viewingDocument === docUrl ? (
                                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                      ) : (
                                        <FileText className="w-4 h-4" />
                                      )}
                                    </button>
                                  </div>
                                )
                              })()}
                            </td>
                            <td className="px-4 py-4">
                              {(() => {
                                // Helper to get value from camelCase or PascalCase
                                const getValue = (obj, ...keys) => {
                                  for (const key of keys) {
                                    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key]
                                  }
                                  return null
                                }
                                
                                // Get documents array from study
                                const documents = Array.isArray(study.documents) ? study.documents : (Array.isArray(study.Documents) ? study.Documents : [])
                                
                                if (documents.length === 0) {
                                  return <span className="text-xs text-slate-400">No document</span>
                                }
                                
                                // Find Protocol document (documentTypeId === "Protocol")
                                const protocolDoc = documents.find(doc => {
                                  const docTypeId = getValue(doc, 'documentTypeId', 'DocumentTypeId', 'typeId', 'TypeId', 'documentType', 'DocumentType')
                                  // Check for both string and numeric values
                                  return docTypeId === 'Protocol' || docTypeId === 2 || docTypeId === '2'
                                })
                                
                                if (!protocolDoc) {
                                  return <span className="text-xs text-slate-400">No document</span>
                                }
                                
                                const docUrl = getValue(protocolDoc, 'documentUrl', 'DocumentUrl', 'url', 'Url', 'fileUrl', 'FileUrl', 'blobUrl', 'BlobUrl')
                                const docName = getValue(protocolDoc, 'documentName', 'DocumentName', 'name', 'Name', 'fileName', 'FileName') || 'Protocol'
                                
                                if (!docUrl) {
                                  return <span className="text-xs text-slate-400">No document</span>
                                }
                                
                                return (
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleViewDocument(docUrl, docName)}
                                      disabled={viewingDocument === docUrl}
                                      className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                      title="View Protocol document"
                                    >
                                      {viewingDocument === docUrl ? (
                                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                      ) : (
                                        <FileText className="w-4 h-4" />
                                      )}
                                    </button>
                                  </div>
                                )
                              })()}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-center">
                              <div className="flex items-center justify-center gap-3">
                                <button type="button" onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    handleToggleStatus(studyId, isActive)
                                  }}
                                  disabled={updatingStatus[studyId]}
                                  className={`relative inline-flex h-8 w-16 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer ${isActive
                                    ? "bg-blue-600 hover:bg-blue-700"
                                    : "bg-slate-300 hover:bg-slate-400"
                                    }`}>
                                  <span
                                    className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-200 ${isActive ? "translate-x-9" : "translate-x-1"
                                      }`}
                                  />
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <button onClick={() => handleEditStudy(study)} className="px-3 py-1.5 rounded-lg bg-teal-100 text-teal-700 hover:bg-teal-200 transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer" title="Edit study">
                                  <Edit className="w-3.5 h-3.5 " />
                                </button>
                                <button
                                  onClick={() => handleDeleteStudy(studyId, studyProtocolLabel)}
                                  disabled={deletingStudy === studyId}
                                  className="px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Delete study"
                                >
                                  {deletingStudy === studyId ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )})}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination */}
                  {totalPages > 0 && (
                    <DataPagination
                      currentPage={pageNumber}
                      pageSize={pageSize}
                      totalPages={totalPages}
                      totalCount={totalCount}
                      onPageChange={setPageNumber}
                      onPageSizeChange={handlePageSizeChange}
                      itemName="studies"
                      showPageSizeSelector={true}
                    />
                  )}
                  {manageLoading && (
                    <div className="absolute inset-0 z-20 bg-white/55 backdrop-blur-[1px] pointer-events-none">
                      <div className="h-full w-full p-4">
                        <div className="h-full w-full rounded-xl border border-slate-200/70 bg-white/60 p-4">
                          <div className="grid grid-cols-6 gap-3">
                            {Array.from({ length: 12 }).map((_, idx) => (
                              <div key={idx} className="h-3.5 rounded bg-slate-200/80 animate-pulse" />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Edit Study Modal */}
              {editingStudy && editFormData && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
                  <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl my-8 border border-slate-100">
                    {/* Modal Header */}
                    <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-emerald-50 border-b border-slate-200 px-8 py-5 flex items-center justify-between z-10 rounded-t-3xl">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-bold text-slate-900">Edit Study: {editFormData.studyProtocolNumber}</h3>
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
                      <form onSubmit={handleUpdateStudy} className="p-8">
                        {(error || success) && (
                          <div className="mb-6 space-y-3">
                            {error && (
                              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                                  <span className="text-white text-sm font-bold">!</span>
                                </div>
                                <p className="text-red-800 font-medium">{error}</p>
                              </div>
                            )}
                            {success && (
                              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                                  <span className="text-white text-sm font-bold">✓</span>
                                </div>
                                <p className="text-green-800 font-medium">{success}</p>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <tbody className="divide-y divide-slate-200">
                              {/* Study Protocol Number */}
                              <tr>
                                <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700 w-1/4">
                                  Study <span className="text-red-500">*</span>
                                </td>
                                <td className="px-4 py-3 bg-white">
                                  <input
                                    type="text"
                                    value={editFormData.studyProtocolNumber}
                                    onChange={(e) => handleEditInputChange("studyProtocolNumber", e.target.value, 50)}
                                    className={`w-full px-3 py-2 rounded-lg border-2 transition-all text-sm ${editErrors.studyProtocolNumber
                                      ? "border-red-300 bg-red-50/50 focus:border-red-500"
                                      : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                      } outline-none`}
                                    required
                                  />
                                  {editErrors.studyProtocolNumber && (
                                    <p className="text-xs text-red-600 mt-1">{editErrors.studyProtocolNumber}</p>
                                  )}
                                  <p className="text-xs text-slate-500 mt-1">{(editFormData.studyProtocolNumber ?? "").length} / 50</p>
                                </td>
                              </tr>

                              {/* Study Title */}
                              <tr>
                                <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">
                                  Study Title <span className="text-red-500">*</span>
                                </td>
                                <td className="px-4 py-3 bg-white">
                                  <textarea
                                    value={editFormData.studyTitle}
                                    onChange={(e) => handleEditInputChange("studyTitle", e.target.value, 1000)}
                                    className={`w-full px-3 py-2 rounded-lg border-2 transition-all resize-none text-sm ${editErrors.studyTitle
                                      ? "border-red-300 bg-red-50/50 focus:border-red-500"
                                      : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                      } outline-none`}
                                    rows={2}
                                    required
                                  />
                                  {editErrors.studyTitle && (
                                    <p className="text-xs text-red-600 mt-1">{editErrors.studyTitle}</p>
                                  )}
                                  <p className="text-xs text-slate-500 mt-1">{(editFormData.studyTitle ?? "").length} / 1000</p>
                                </td>
                              </tr>

                              {/* Study Short Title */}
                              <tr>
                                <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">
                                  Study Short Title (For TLF Files) <span className="text-red-500">*</span>
                                </td>
                                <td className="px-4 py-3 bg-white">
                                  <input
                                    type="text"
                                    value={editFormData.studyShortTitle}
                                    onChange={(e) => handleEditInputChange("studyShortTitle", e.target.value, 20)}
                                    className={`w-full px-3 py-2 rounded-lg border-2 transition-all text-sm ${editErrors.studyShortTitle
                                      ? "border-red-300 bg-red-50/50 focus:border-red-500"
                                      : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                      } outline-none`}
                                    required
                                  />
                                  {editErrors.studyShortTitle && (
                                    <p className="text-xs text-red-600 mt-1">{editErrors.studyShortTitle}</p>
                                  )}
                                  <p className="text-xs text-slate-500 mt-1">{(editFormData.studyShortTitle ?? "").length} / 20</p>
                                </td>
                              </tr>

                              {/* Name of Drug */}
                              <tr>
                                <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">
                                  Name of Drug
                                </td>
                                <td className="px-4 py-3 bg-white">
                                  <input
                                    type="text"
                                    value={editFormData.nameOfDrug}
                                    onChange={(e) => handleEditInputChange("nameOfDrug", e.target.value, 100)}
                                    className={`w-full px-3 py-2 rounded-lg border-2 transition-all text-sm ${editErrors.nameOfDrug
                                      ? "border-red-300 bg-red-50/50 focus:border-red-500"
                                      : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                      } outline-none`}
                                  />
                                  {editErrors.nameOfDrug && (
                                    <p className="text-xs text-red-600 mt-1">{editErrors.nameOfDrug}</p>
                                  )}
                                </td>
                              </tr>

                              {/* Sponsor */}
                              <tr>
                                <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">
                                  Sponsor
                                </td>
                                <td className="px-4 py-3 bg-white">
                                  <input
                                    type="text"
                                    value={editFormData.sponsor}
                                    onChange={(e) => handleEditInputChange("sponsor", e.target.value, 100)}
                                    className={`w-full px-3 py-2 rounded-lg border-2 transition-all text-sm ${editErrors.sponsor
                                      ? "border-red-300 bg-red-50/50 focus:border-red-500"
                                      : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                      } outline-none`}
                                  />
                                  {editErrors.sponsor && (
                                    <p className="text-xs text-red-600 mt-1">{editErrors.sponsor}</p>
                                  )}
                                </td>
                              </tr>

                              {/* Tentative Study Start Date */}
                              <tr>
                                <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">
                                  Tentative Study Start Date <span className="text-red-500">*</span>
                                </td>
                                <td className="px-4 py-3 bg-white">
                                  <div className="relative">
                                    <input
                                      type="date"
                                      value={editFormData.tentativeStudyStartDate}
                                      onChange={(e) => handleEditInputChange("tentativeStudyStartDate", e.target.value)}
                                      className={`w-full px-3 py-2 pr-10 rounded-lg border-2 transition-all text-sm ${editErrors.tentativeStudyStartDate
                                        ? "border-red-300 bg-red-50/50 focus:border-red-500"
                                        : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        } outline-none`}
                                      required
                                    />
                                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                  </div>
                                  {editErrors.tentativeStudyStartDate && (
                                    <p className="text-xs text-red-600 mt-1">{editErrors.tentativeStudyStartDate}</p>
                                  )}
                                </td>
                              </tr>

                              {/* Study Initiation Date */}
                              <tr>
                                <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">
                                  Study Initiation Date <span className="text-red-500">*</span>
                                </td>
                                <td className="px-4 py-3 bg-white">
                                  <div className="relative">
                                    <input
                                      type="date"
                                      value={editFormData.studyInitiationDate}
                                      onChange={(e) => handleEditInputChange("studyInitiationDate", e.target.value)}
                                      className={`w-full px-3 py-2 pr-10 rounded-lg border-2 transition-all text-sm ${editErrors.studyInitiationDate
                                        ? "border-red-300 bg-red-50/50 focus:border-red-500"
                                        : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        } outline-none`}
                                      required
                                    />
                                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                  </div>
                                  {editErrors.studyInitiationDate && (
                                    <p className="text-xs text-red-600 mt-1">{editErrors.studyInitiationDate}</p>
                                  )}
                                </td>
                              </tr>

                              {/* Tentative Study End Date */}
                              <tr>
                                <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">
                                  Tentative Study End Date
                                </td>
                                <td className="px-4 py-3 bg-white">
                                  <div className="relative">
                                    <input
                                      type="date"
                                      value={editFormData.tentativeStudyEndDate}
                                      onChange={(e) => handleEditInputChange("tentativeStudyEndDate", e.target.value)}
                                      className="w-full px-3 py-2 pr-10 rounded-lg border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                                    />
                                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                  </div>
                                </td>
                              </tr>

                              {/* Study Design */}
                              <tr>
                                <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">
                                  Study Design <span className="text-red-500">*</span>
                                </td>
                                <td className="px-4 py-3 bg-white">
                                  <div className="relative">
                                    <select
                                      value={editFormData?.studyDesign || ""}
                                      onChange={(e) => handleEditInputChange("studyDesign", e.target.value)}
                                      className={`w-full px-3 py-2 rounded-lg border-2 transition-all appearance-none bg-white text-sm ${editErrors.studyDesign
                                        ? "border-red-300 bg-red-50/50 focus:border-red-500"
                                        : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        } outline-none`}
                                      required
                                    >
                                      <option value="">-- Select Study Design --</option>
                                      <option value="1">Randomized</option>
                                      <option value="2">Non-Randomized</option>
                                      <option value="3">Open Label</option>
                                      <option value="4">Double Blind</option>
                                      <option value="5">Single Blind</option>
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </div>
                                  </div>
                                  {editErrors.studyDesign && (
                                    <p className="text-xs text-red-600 mt-1">{editErrors.studyDesign}</p>
                                  )}
                                </td>
                              </tr>

                              {/* Study Phase */}
                              <tr>
                                <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">
                                  Study Phase <span className="text-red-500">*</span>
                                </td>
                                <td className="px-4 py-3 bg-white">
                                  <div className="relative">
                                    <select
                                      value={editFormData?.studyPhase || ""}
                                      onChange={(e) => handleEditInputChange("studyPhase", e.target.value)}
                                      className={`w-full px-3 py-2 rounded-lg border-2 transition-all appearance-none bg-white text-sm ${editErrors.studyPhase
                                        ? "border-red-300 bg-red-50/50 focus:border-red-500"
                                        : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        } outline-none`}
                                      required
                                    >
                                      <option value="">-- Select Study Phase --</option>
                                      <option value="0">Phase0</option>
                                      <option value="1">PhaseI</option>
                                      <option value="2">PhaseII</option>
                                      <option value="3">PhaseIII</option>
                                      <option value="6">PhaseIIIA</option>
                                      <option value="7">PhaseIIIB</option>
                                      <option value="4">PhaseIV</option>
                                      <option value="5">PostMarketing</option>
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </div>
                                  </div>
                                  {editErrors.studyPhase && (
                                    <p className="text-xs text-red-600 mt-1">{editErrors.studyPhase}</p>
                                  )}
                                </td>
                              </tr>
                              {/* Study CRF Type */}
                              <tr>
                                <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">
                                  Study CRF Type <span className="text-red-500">*</span>
                                </td>
                                <td className="px-4 py-3 bg-white">
                                  <div className="relative">
                                    <select value={editFormData.studyCRFType} onChange={(e) => handleEditInputChange("studyCRFType", e.target.value)}
                                      className={`w-full px-3 py-2 rounded-lg border-2 transition-all appearance-none bg-white text-sm ${editErrors.studyCRFType
                                        ? "border-red-300 bg-red-50/50 focus:border-red-500"
                                        : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        } outline-none`}
                                      required >
                                      <option value="">-- Select CRF Type --</option>
                                      <option value="0">PMS</option>
                                      <option value="1">Clinical Trial</option>
                                      <option value="2">Observational</option>
                                      <option value="3">RWE</option>
                                      <option value="4">Investigator Initiated Study</option>
                                    </select>

                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </div>
                                  </div>
                                  {editErrors.studyCRFType && (
                                    <p className="text-xs text-red-600 mt-1">{editErrors.studyCRFType}</p>
                                  )}
                                </td>
                              </tr>

                              {/* Type of Study */}
                              <tr>
                                <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">
                                  Type of Study <span className="text-red-500">*</span>
                                </td>
                                <td className="px-4 py-3 bg-white">
                                  <div className="relative">
                                    <select
                                      value={editFormData?.studyType || ""}
                                      onChange={(e) => handleEditInputChange("studyType", e.target.value)}
                                      className={`w-full px-3 py-2 rounded-lg border-2 transition-all appearance-none bg-white text-sm ${editErrors.studyType
                                        ? "border-red-300 bg-red-50/50 focus:border-red-500"
                                        : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        } outline-none`}
                                      required
                                    >
                                      <option value="">-- Select Study Type --</option>
                                      <option value="1">Normal</option>
                                      <option value="2">Milestone(Patient wise)</option>
                                      <option value="3">Milestone(visit wise)</option>
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </div>
                                  </div>
                                  {editErrors.studyType && (
                                    <p className="text-xs text-red-600 mt-1">{editErrors.studyType}</p>
                                  )}
                                </td>
                              </tr>

                              {/* EC Letter Document Upload */}
                              <tr>
                                <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">
                                  EC Letter Document
                                </td>
                                <td className="px-4 py-3 bg-white">
                                  <div className="relative">
                                    <input
                                      type="file"
                                      accept=".pdf,.doc,.docx"
                                      onChange={(e) => handleFileChange("ecLetter", e.target.files[0])}
                                      className="w-full px-3 py-2 rounded-lg border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer text-sm"
                                    />
                                  </div>
                                  {existingEcLetter && !ecLetterFile && (
                                    <div className="mt-2 flex items-center gap-2 text-xs">
                                      <FileText className="w-3 h-3 text-blue-600" />
                                      <a
                                        href={existingEcLetter.documentUrl || existingEcLetter.DocumentUrl || existingEcLetter.documenturl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                      >
                                        {existingEcLetter.documentName || existingEcLetter.DocumentName || existingEcLetter.documentname || 'EC Letter'}
                                      </a>
                                      <span className="text-slate-400">(Current)</span>
                                    </div>
                                  )}
                                  {ecLetterFile && (
                                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                                      <FileText className="w-3 h-3" />
                                      <span>{ecLetterFile.name}</span>
                                      <span className="text-xs text-slate-400">
                                        ({(ecLetterFile.size / 1024 / 1024).toFixed(2)} MB)
                                      </span>
                                      <span className="text-blue-600">(New)</span>
                                    </div>
                                  )}
                                  <p className="text-xs text-slate-500 mt-1">Leave empty to keep existing document</p>
                                </td>
                              </tr>

                              {/* Protocol Document Upload */}
                              <tr>
                                <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">
                                  Protocol Document
                                </td>
                                <td className="px-4 py-3 bg-white">
                                  <div className="relative">
                                    <input
                                      ref={protocolFileInputRef}
                                      type="file"
                                      accept=".pdf,.doc,.docx"
                                      onChange={(e) => handleFileChange("protocol", e.target.files[0])}
                                      className="w-full px-3 py-2 rounded-lg border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer text-sm"
                                    />
                                  </div>
                                  {existingProtocol && !protocolFile && (
                                    <div className="mt-2 flex items-center gap-2 text-xs">
                                      <FileText className="w-3 h-3 text-blue-600" />
                                      <a
                                        href={existingProtocol.documentUrl || existingProtocol.DocumentUrl || existingProtocol.documenturl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                      >
                                        {existingProtocol.documentName || existingProtocol.DocumentName || existingProtocol.documentname || 'Protocol'}
                                      </a>
                                      <span className="text-slate-400">(Current)</span>
                                    </div>
                                  )}
                                  {protocolFile && (
                                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                                      <FileText className="w-3 h-3" />
                                      <span>{protocolFile.name}</span>
                                      <span className="text-xs text-slate-400">
                                        ({(protocolFile.size / 1024 / 1024).toFixed(2)} MB)
                                      </span>
                                      <span className="text-blue-600">(New)</span>
                                    </div>
                                  )}
                                  <p className="text-xs text-slate-500 mt-1">Leave empty to keep existing document</p>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex justify-end gap-4 pt-6 mt-6 border-t border-slate-200 sticky bottom-0 bg-white -mx-8 px-8 pb-6">
                          <button type="button" onClick={handleCancelEdit} disabled={editLoading}
                            className="px-6 py-3 rounded-lg border-2 border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 hover:border-slate-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                            <X className="w-4 h-4" />
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={editLoading}
                            className="px-6 py-3 rounded-lg bg-gradient-to-r btn-brand-gradient text-white font-semibold  transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            <Save className="w-4 h-4" />
                            {editLoading ? "Updating..." : "Update Study"}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}