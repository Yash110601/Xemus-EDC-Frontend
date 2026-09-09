"use client"

import { VIEWPORT_PAGE_SHELL_WITH_EMERALD_BG_CLASS, VIEWPORT_PANEL_SCROLL_CLASS } from "@/lib/ui/responsivePageUi"

import { useState, useEffect, useRef } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import DataPagination from "@/components/ui/data-pagination"
import SectionSkeleton from "@/components/ui/section-skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { siteService, studyService } from "@/lib/services"
import SiteAssignUsersModal from "@/components/site-configuration/SiteAssignUsersModal"
import { isValidEmail } from "@/lib/utils/emailValidation"
import {
  Building2,
  Calendar,
  Save,
  Send,
  X,
  Hash,
  User,
  Mail,
  Phone,
  MapPin,
  Edit,
  Search,
  FileText,
  Loader2,
  Download,
  Upload
} from "lucide-react"

export default function SiteConfigurationPage() {
  const [activeTab, setActiveTab] = useState("create")
  const [formData, setFormData] = useState({
    studyId: "",
    studyProtocolNumber: "",
    siteName: "",
    siteFullName: "",
    plannedPatients: "",
    investigatorName: "",
    frontlineInvestigatorCode: "",
    emailId: "",
    mobileNo: "",
    region: "",
    siteAddress: "",
    pincode: "",
    state: "",
    city: "",
    comments: "",
  })
  const [loadingLocation, setLoadingLocation] = useState(false)
  const [availableStudies, setAvailableStudies] = useState([])
  const [loadingStudies, setLoadingStudies] = useState(false)
  const [studySearchInput, setStudySearchInput] = useState("")
  const [isStudyDropdownOpen, setIsStudyDropdownOpen] = useState(false)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)
  const [sites, setSites] = useState([])
  const [editingSite, setEditingSite] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [editFormData, setEditFormData] = useState(null)
  const [editErrors, setEditErrors] = useState({})
  const [editLoading, setEditLoading] = useState(false)
  const [loadingSites, setLoadingSites] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState({})
  // Pagination state
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  // Protocol filter state
  const [selectedProtocolNumber, setSelectedProtocolNumber] = useState("")
  const [filterProtocolSearchInput, setFilterProtocolSearchInput] = useState("")
  const [isFilterProtocolDropdownOpen, setIsFilterProtocolDropdownOpen] = useState(false)
  // Selected protocol for sites card display
  const [selectedProtocolForSites, setSelectedProtocolForSites] = useState("")
  // Sites for selected protocol (for card display)
  const [selectedProtocolSites, setSelectedProtocolSites] = useState([])
  const [loadingProtocolSites, setLoadingProtocolSites] = useState(false)
  // Bulk upload state
  const [createStudyDropdownOpen, setCreateStudyDropdownOpen] = useState(false)
  const [createStudySearchInput, setCreateStudySearchInput] = useState("")
  const [bulkStudyId, setBulkStudyId] = useState("")
  const [bulkStudyDropdownOpen, setBulkStudyDropdownOpen] = useState(false)
  const [bulkStudySearchInput, setBulkStudySearchInput] = useState("")
  const [bulkImportFile, setBulkImportFile] = useState(null)
  const [bulkImportLoading, setBulkImportLoading] = useState(false)
  const [bulkDownloadLoading, setBulkDownloadLoading] = useState(false)
  const [bulkStudyError, setBulkStudyError] = useState("")
  const [siteAssignModal, setSiteAssignModal] = useState(null)
  const [bulkImportResult, setBulkImportResult] = useState(null) // { totalRows, successCount, failedCount, rows, failedRows } after import
  const [bulkImportResultPage, setBulkImportResultPage] = useState(1) // pagination: 10 rows per page
  const [exportSitesLoading, setExportSitesLoading] = useState(false)
  const [copiedGuidSiteId, setCopiedGuidSiteId] = useState(null)
  const hasFetchedStudiesRef = useRef(false)

  // Fetch location data from PIN code.
  //
  // Returns one of three shapes so callers can react correctly:
  //  - { state, city }            — success (one of the public APIs answered)
  //  - null                       — APIs answered but no PostOffice for this PIN (clear the fields)
  //  - { __failed: true }         — network / CORS / timeout failure (PRESERVE user's manual input)
  //
  // Why two endpoints: `api.postalpincode.in` is a free third-party API
  // with intermittent CORS / availability issues from some networks
  // (observed `TypeError: Failed to fetch` on localhost). When it fails
  // we fall back to `api.zippopotam.us/in/<pincode>` which is also a
  // free, CORS-permissive endpoint with reasonable India PIN coverage.
  // Both calls are guarded by a 5s `AbortController` timeout so a hung
  // call cannot lock the form UI.
  const fetchLocationFromPincode = async (pincode) => {
    if (!pincode || pincode.length !== 6 || !/^\d{6}$/.test(pincode)) {
      return null
    }

    const fetchWithTimeout = async (url, timeoutMs = 5000) => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const res = await fetch(url, { signal: controller.signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return await res.json()
      } finally {
        clearTimeout(timer)
      }
    }

    setLoadingLocation(true)
    let primaryNetworkFailed = false
    let fallbackNetworkFailed = false
    try {
      // Primary: api.postalpincode.in — richer District/Block coverage.
      try {
        const data = await fetchWithTimeout(
          `https://api.postalpincode.in/pincode/${pincode}`,
        )
        if (
          data &&
          data[0] &&
          data[0].Status === "Success" &&
          Array.isArray(data[0].PostOffice) &&
          data[0].PostOffice.length > 0
        ) {
          const po = data[0].PostOffice[0]
          return {
            state: po.State || "",
            city: po.District || po.Block || po.Name || "",
          }
        }
        // API answered cleanly but no PostOffice for this PIN — treat as "not found".
        if (data && data[0] && data[0].Status === "Error") {
          return null
        }
      } catch (primaryErr) {
        primaryNetworkFailed = true
        console.warn(
          "[PIN lookup] primary API failed, trying fallback:",
          primaryErr?.message || primaryErr,
        )
      }

      // Fallback: api.zippopotam.us — different vendor, CORS-permissive.
      try {
        const data = await fetchWithTimeout(
          `https://api.zippopotam.us/in/${pincode}`,
        )
        if (data && Array.isArray(data.places) && data.places.length > 0) {
          const p = data.places[0]
          return {
            state: p.state || "",
            city: p["place name"] || "",
          }
        }
        // 200 OK but no places — treat as "not found".
        return null
      } catch (fallbackErr) {
        fallbackNetworkFailed = true
        console.warn(
          "[PIN lookup] fallback API also failed:",
          fallbackErr?.message || fallbackErr,
        )
      }

      // Both endpoints failed at the network layer — return a sentinel so
      // the caller PRESERVES any manual input rather than clearing it.
      if (primaryNetworkFailed && fallbackNetworkFailed) {
        return { __failed: true }
      }
      return null
    } finally {
      setLoadingLocation(false)
    }
  }

  const handleInputChange = async (field, value, maxLength) => {
    if (maxLength && value.length > maxLength) return
    // Special handling for numeric fields
    if (field === "frontlineInvestigatorCode" || field === "mobileNo" || field === "plannedPatients" || field === "studyId") {
      // Allow only numbers or empty string
      if (value === "" || /^\d+$/.test(value)) {
        setFormData((prev) => ({ ...prev, [field]: value }))
      }
    } else if (field === "pincode") {
      // Only allow numeric input and limit to 6 digits
      const numericValue = value.replace(/\D/g, "").slice(0, 6)
      setFormData((prev) => ({ ...prev, [field]: numericValue }))
      
      // Fetch location when PIN code is 6 digits
      if (numericValue.length === 6) {
        const location = await fetchLocationFromPincode(numericValue)
        if (location && !location.__failed) {
          // Successful lookup with actual values.
          setFormData((prev) => ({
            ...prev,
            state: location.state,
            city: location.city,
          }))
        } else if (location === null) {
          // APIs answered but no record for this PIN — clear so the user
          // sees an empty field and either fixes the PIN or types
          // manually.
          setFormData((prev) => ({
            ...prev,
            state: "",
            city: "",
          }))
        }
        // location.__failed === true ⇒ network failure: preserve whatever
        // is already in state/city (manual entry or previous auto-fill).
      } else if (numericValue.length < 6) {
        // Clear state and city if PIN code is incomplete
        setFormData((prev) => ({
          ...prev,
          state: "",
          city: "",
        }))
      }
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }))
    }
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
    setLoading(true)

    const newErrors = {}
    if (!formData.studyId || formData.studyId === "") newErrors.studyId = "This field is required."
    if (!formData.studyProtocolNumber) newErrors.studyProtocolNumber = "This field is required."
    if (!formData.siteName) newErrors.siteName = "This field is required."
    if (!formData.siteFullName) newErrors.siteFullName = "This field is required."
    if (!formData.plannedPatients || parseInt(formData.plannedPatients) <= 0) newErrors.plannedPatients = "This field is required and must be greater than 0."
    if (!formData.investigatorName) newErrors.investigatorName = "This field is required."
    if (!formData.emailId) newErrors.emailId = "This field is required."
    else if (!isValidEmail(formData.emailId)) newErrors.emailId = "Please enter a valid email (e.g. first.last@example.com)."
    if (!formData.region) newErrors.region = "This field is required."
    if (!formData.siteAddress) newErrors.siteAddress = "This field is required."
    // Validate mobile number if provided (must be exactly 10 digits)
    if (formData.mobileNo && (formData.mobileNo.length !== 10 || !/^\d{10}$/.test(formData.mobileNo))) {
      newErrors.mobileNo = "Mobile No must be exactly 10 digits."
    }
    // Validate FrontlineInvestigatorCode if provided (must be greater than 0)
    if (formData.frontlineInvestigatorCode && parseInt(formData.frontlineInvestigatorCode) <= 0) {
      newErrors.frontlineInvestigatorCode = "Frontline Investigator Code must be greater than 0."
    }

    setErrors(newErrors)

    if (Object.keys(newErrors).length > 0) {
      setError("Please fill in all required fields")
      setLoading(false)
      return
    }

    try {
      const siteData = {
        StudyId: parseInt(formData.studyId),
        StudyProtocolNumber: formData.studyProtocolNumber,
        SiteName: formData.siteName,
        SiteFullName: formData.siteFullName,
        PlannedPatients: parseInt(formData.plannedPatients),
        InvestigatorName: formData.investigatorName,
        FrontlineInvestigatorCode: formData.frontlineInvestigatorCode ? parseInt(formData.frontlineInvestigatorCode) : null,
        EmailId: formData.emailId,
        MobileNo: formData.mobileNo ? parseInt(formData.mobileNo) : null,
        Region: formData.region,
        SiteAddress: formData.siteAddress,
        PinCode: formData.pincode || null,
        State: formData.state || null,
        City: formData.city || null,
        Comments: formData.comments || null,
      }

      const response = await siteService.createSite(siteData)

      if (response.isSuccess) {
        setSuccess(response.message || "Site created successfully!")
        const createdSiteId =
          response.data?.id ??
          response.data?.siteId ??
          response.data?.SiteId ??
          response.data?.data?.id ??
          null
        const studyLabel =
          availableStudies.find((s) => String(s.id ?? s.studyId) === String(formData.studyId))?.studyProtocolNumber ??
          formData.studyProtocolNumber ??
          ""
        if (createdSiteId && formData.studyId) {
          setSiteAssignModal({
            studyId: formData.studyId,
            siteId: createdSiteId,
            siteLabel: formData.siteName || formData.siteFullName || `Site ${createdSiteId}`,
            studyLabel,
          })
        }
        handleClear()
        if (activeTab === "manage") {
          fetchSites()
        } else if (action === "submit") {
          setActiveTab("manage")
        }
      } else {
        let errorMessage = response.message || "Failed to create site. Please try again."
        if (response.data) {
          if (typeof response.data === "string") {
            errorMessage = response.data
          } else if (typeof response.data === "object") {
            if (response.data.message) {
              errorMessage = response.data.message
            } else if (response.data.errors) {
              errorMessage = Object.values(response.data.errors).flat().join(", ")
            } else {
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
      setError("An error occurred while creating the site. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setFormData({
      studyId: "",
      studyProtocolNumber: "",
      siteName: "",
      siteFullName: "",
      plannedPatients: "",
      investigatorName: "",
      frontlineInvestigatorCode: "",
      emailId: "",
      mobileNo: "",
      region: "",
      siteAddress: "",
      pincode: "",
      state: "",
      city: "",
      comments: "",
    })
    setErrors({})
    setStudySearchInput("")
    setIsStudyDropdownOpen(false)
  }

  const handleDownloadSiteSample = async () => {
    if (!bulkStudyId) {
      setBulkStudyError("Please select a Study first.")
      setError("Please select a Study before downloading the sample.")
      setTimeout(() => { setError(""); setBulkStudyError("") }, 3000)
      return
    }
    setBulkDownloadLoading(true)
    setError("")
    setSuccess("")
    setBulkStudyError("")
    try {
      const response = await siteService.downloadSiteSampleCsv(parseInt(bulkStudyId))
      if (response.isSuccess) {
        setSuccess(response.message || "Sample file downloaded successfully.")
        setTimeout(() => setSuccess(""), 3000)
      } else {
        setError(response.message || "Failed to download sample file")
        setTimeout(() => setError(""), 3000)
      }
    } catch (err) {
      setError("Failed to download sample: " + (err.message || "Unknown error"))
      setTimeout(() => setError(""), 3000)
    } finally {
      setBulkDownloadLoading(false)
    }
  }

  const handleBulkImport = async () => {
    if (!bulkStudyId) {
      setBulkStudyError("Please select a Study first.")
      setError("Please select a Study before importing.")
      setTimeout(() => { setError(""); setBulkStudyError("") }, 3000)
      return
    }
    if (!bulkImportFile) {
      setError("Please select a CSV file to import")
      setTimeout(() => setError(""), 3000)
      return
    }
    setBulkImportLoading(true)
    setError("")
    setSuccess("")
    setBulkStudyError("")
    setBulkImportResult(null)
    try {
      const response = await siteService.importSites(bulkImportFile, parseInt(bulkStudyId))
      const apiData = response.data && typeof response.data === "object" ? response.data : null
      const totalRows = apiData?.totalRows ?? 0
      const successCount = apiData?.successCount ?? 0
      const failedCount = apiData?.failedCount ?? 0
      const hasFailedRows = failedCount > 0 && (apiData?.rows?.length > 0 || apiData?.failedRows?.length > 0)

      if (response.isSuccess) {
        setBulkImportResult(apiData)
        setBulkImportResultPage(1)
        if (failedCount === 0) {
          setSuccess(response.message || "Sites imported successfully!")
          setTimeout(() => setSuccess(""), 3000)
          setBulkImportFile(null)
          fetchSites()
        } else {
          setSuccess(response.message || `Import finished: ${successCount} successful, ${failedCount} failed`)
          setTimeout(() => setSuccess(""), 3000)
          if (hasFailedRows) {
            setError(`${failedCount} row(s) failed to import. See reasons below.`)
            setTimeout(() => setError(""), 3000)
          }
        }
      } else {
        setBulkImportResult(apiData)
        setBulkImportResultPage(1)
        setError(response.message || "Failed to import sites")
        if (hasFailedRows) {
          setError(response.message || `Import finished: 0 successful, ${failedCount} failed. See reasons below.`)
        }
        setTimeout(() => setError(""), 3000)
      }
    } catch (err) {
      setError("An error occurred while importing sites: " + (err.message || "Unknown error"))
      setTimeout(() => setError(""), 3000)
    } finally {
      setBulkImportLoading(false)
    }
  }

  const handleEditInputChange = async (field, value, maxLength) => {
    if (maxLength && value.length > maxLength) return
    // Special handling for numeric fields
    if (field === "frontlineInvestigatorCode" || field === "mobileNo" || field === "plannedPatients" || field === "studyId") {
      // Allow only numbers or empty string
      if (value === "" || /^\d+$/.test(value)) {
        setEditFormData((prev) => ({ ...prev, [field]: value }))
      }
    } else if (field === "pincode") {
      // Only allow numeric input and limit to 6 digits
      const numericValue = value.replace(/\D/g, "").slice(0, 6)
      setEditFormData((prev) => ({ ...prev, [field]: numericValue }))
      
      // Fetch location when PIN code is 6 digits
      if (numericValue.length === 6) {
        const location = await fetchLocationFromPincode(numericValue)
        if (location && !location.__failed) {
          // Successful lookup with actual values.
          setEditFormData((prev) => ({
            ...prev,
            state: location.state,
            city: location.city,
          }))
        } else if (location === null) {
          // APIs answered but no record for this PIN — clear so the user
          // sees an empty field and either fixes the PIN or types
          // manually.
          setEditFormData((prev) => ({
            ...prev,
            state: "",
            city: "",
          }))
        }
        // location.__failed === true ⇒ network failure: preserve manual
        // input in the edit form.
      } else if (numericValue.length < 6) {
        // Clear state and city if PIN code is incomplete
        setEditFormData((prev) => ({
          ...prev,
          state: "",
          city: "",
        }))
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

  const handleEditSite = (site) => {
    setEditingSite(site.id)
    // Fetch studies if not already loaded
    if (availableStudies.length === 0) {
      fetchStudies()
    }
    // Helper to get value from camelCase or PascalCase
    const getValue = (obj, ...keys) => {
      for (const key of keys) {
        if (obj[key] !== undefined) return obj[key]
      }
      return null
    }
    setEditFormData({
      ...site,
      studyId: getValue(site, 'studyId', 'StudyId') ? String(getValue(site, 'studyId', 'StudyId')) : "",
      studyProtocolNumber: getValue(site, 'studyProtocolNumber', 'StudyProtocolNumber') || "",
      siteName: getValue(site, 'siteName', 'SiteName') || "",
      siteFullName: getValue(site, 'siteFullName', 'SiteFullName') || "",
      plannedPatients: getValue(site, 'plannedPatients', 'PlannedPatients') ? String(getValue(site, 'plannedPatients', 'PlannedPatients')) : "",
      investigatorName: getValue(site, 'investigatorName', 'InvestigatorName') || "",
      frontlineInvestigatorCode: getValue(site, 'frontlineInvestigatorCode', 'FrontlineInvestigatorCode') ? String(getValue(site, 'frontlineInvestigatorCode', 'FrontlineInvestigatorCode')) : "",
      emailId: getValue(site, 'emailId', 'EmailId') || "",
      mobileNo: getValue(site, 'mobileNo', 'MobileNo') ? String(getValue(site, 'mobileNo', 'MobileNo')) : "",
      region: getValue(site, 'region', 'Region') || "",
      siteAddress: getValue(site, 'siteAddress', 'SiteAddress') || "",
      pincode: getValue(site, 'pincode', 'pinCode', 'PinCode') || "",
      state: getValue(site, 'state', 'State') || "",
      city: getValue(site, 'city', 'City') || "",
      comments: getValue(site, 'comments', 'Comments') || "",
    })
    setEditErrors({})
  }

  const handleCancelEdit = () => {
    setEditingSite(null)
    setEditFormData(null)
    setEditErrors({})
  }

  // Handle toggle site status
  const handleToggleStatus = async (siteId, currentStatus) => {
    // Prevent multiple clicks
    if (updatingStatus[siteId]) {
      return
    }

    try {
      setUpdatingStatus((prev) => ({ ...prev, [siteId]: true }))
      const newStatus = !currentStatus

      // Helper to get value from camelCase or PascalCase
      const getValue = (obj, ...keys) => {
        for (const key of keys) {
          if (obj[key] !== undefined) return obj[key]
        }
        return null
      }

      // Optimistically update UI immediately for instant feedback
      setSites((prev) =>
        prev.map((site) => {
          if (site.id === siteId) {
            return { ...site, isActive: newStatus, IsActive: newStatus }
          }
          return site
        })
      )

      // API Call: PUT /api/Sites/UpdateSiteStatus/{id}?isActive={isActive}
      const response = await siteService.updateSiteStatus(siteId, newStatus)

      if (response.isSuccess) {
        setSuccess(`Site status updated to ${newStatus ? "Active" : "Inactive"}`)
        setTimeout(() => setSuccess(""), 3000)
      } else {
        // Revert on error
        setSites((prev) =>
          prev.map((site) => {
            if (site.id === siteId) {
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
      setSites((prev) =>
        prev.map((site) => {
          if (site.id === siteId) {
            return { ...site, isActive: currentStatus, IsActive: currentStatus }
          }
          return site
        })
      )
      setError("An error occurred while updating site status")
      setTimeout(() => setError(""), 3000)
    } finally {
      setUpdatingStatus((prev) => ({ ...prev, [siteId]: false }))
    }
  }

  const handleExportSites = async () => {
    if (!selectedProtocolNumber) {
      setError("Please select a study protocol to export sites.")
      setTimeout(() => setError(""), 3000)
      return
    }
    const selectedStudy = availableStudies.find((s) => s.studyProtocolNumber === selectedProtocolNumber)
    if (!selectedStudy || !selectedStudy.studyId) {
      setError("Study not found. Please select a protocol again.")
      setTimeout(() => setError(""), 3000)
      return
    }
    setExportSitesLoading(true)
    setError("")
    setSuccess("")
    try {
      const response = await siteService.exportSites(selectedStudy.studyId, debouncedSearchTerm, null)
      if (response.isSuccess) {
        setSuccess(response.message || "Sites exported successfully.")
        setTimeout(() => setSuccess(""), 3000)
      } else {
        setError(response.message || "Failed to export sites")
        setTimeout(() => setError(""), 3000)
      }
    } catch (err) {
      setError("An error occurred while exporting sites.")
      setTimeout(() => setError(""), 3000)
    } finally {
      setExportSitesLoading(false)
    }
  }

  const handleCopyGuid = async (guid, siteId) => {
    if (!guid) return
    try {
      await navigator.clipboard.writeText(String(guid))
      setCopiedGuidSiteId(siteId)
      setTimeout(() => setCopiedGuidSiteId(null), 2000)
    } catch (_) {
      setError("Failed to copy GUID")
      setTimeout(() => setError(""), 3000)
    }
  }

  const handleUpdateSite = async (e) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setEditLoading(true)

    const newErrors = {}
    if (!editFormData.studyId || editFormData.studyId === "") newErrors.studyId = "This field is required."
    if (!editFormData.studyProtocolNumber) newErrors.studyProtocolNumber = "This field is required."
    if (!editFormData.siteName) newErrors.siteName = "This field is required."
    if (!editFormData.siteFullName) newErrors.siteFullName = "This field is required."
    if (!editFormData.plannedPatients || parseInt(editFormData.plannedPatients) <= 0) newErrors.plannedPatients = "This field is required and must be greater than 0."
    if (!editFormData.investigatorName) newErrors.investigatorName = "This field is required."
    if (!editFormData.emailId) newErrors.emailId = "This field is required."
    else if (!isValidEmail(editFormData.emailId)) newErrors.emailId = "Please enter a valid email (e.g. first.last@example.com)."
    if (!editFormData.region) newErrors.region = "This field is required."
    if (!editFormData.siteAddress) newErrors.siteAddress = "This field is required."
    // Validate mobile number if provided (must be exactly 10 digits)
    if (editFormData.mobileNo && (editFormData.mobileNo.length !== 10 || !/^\d{10}$/.test(editFormData.mobileNo))) {
      newErrors.mobileNo = "Mobile No must be exactly 10 digits."
    }
    // Validate FrontlineInvestigatorCode if provided (must be greater than 0)
    if (editFormData.frontlineInvestigatorCode && parseInt(editFormData.frontlineInvestigatorCode) <= 0) {
      newErrors.frontlineInvestigatorCode = "Frontline Investigator Code must be greater than 0."
    }

    setEditErrors(newErrors)

    if (Object.keys(newErrors).length > 0) {
      setEditLoading(false)
      return
    }

    try {
      const siteData = {
        StudyId: parseInt(editFormData.studyId),
        StudyProtocolNumber: editFormData.studyProtocolNumber,
        SiteName: editFormData.siteName,
        SiteFullName: editFormData.siteFullName,
        PlannedPatients: parseInt(editFormData.plannedPatients),
        InvestigatorName: editFormData.investigatorName,
        FrontlineInvestigatorCode: editFormData.frontlineInvestigatorCode ? parseInt(editFormData.frontlineInvestigatorCode) : null,
        EmailId: editFormData.emailId,
        MobileNo: editFormData.mobileNo ? parseInt(editFormData.mobileNo) : null,
        Region: editFormData.region,
        SiteAddress: editFormData.siteAddress,
        PinCode: editFormData.pincode || null,
        State: editFormData.state || null,
        City: editFormData.city || null,
        Comments: editFormData.comments || null,
      }

      const response = await siteService.updateSite(editingSite, siteData)

      if (response.isSuccess) {
        setSuccess(response.message || "Site updated successfully!")
        // Refresh sites list
        fetchSites()
        // Cancel edit mode
        handleCancelEdit()
      } else {
        setError(response.message || "Failed to update site. Please try again.")
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
      setError("An error occurred while updating the site. Please try again.")
    } finally {
      setEditLoading(false)
    }
  }


  // Handler for page size changes
  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize)
    setPageNumber(1) // Reset to first page when page size changes
  }

  // Debounce search term
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Reset to page 1 when search term changes
  useEffect(() => {
    if (activeTab === "manage") {
      setPageNumber(1)
    }
  }, [debouncedSearchTerm, activeTab])

  const fetchSites = async () => {
    setLoadingSites(true)
    try {
      // Find studyId from selected protocol number (backend requires studyId; calling without it returns 400)
      let studyIdForFilter = null
      if (selectedProtocolNumber) {
        const selectedStudy = availableStudies.find(
          (study) => study.studyProtocolNumber === selectedProtocolNumber
        )
        if (selectedStudy && selectedStudy.studyId) {
          studyIdForFilter = selectedStudy.studyId
        }
      }

      // Only call API when we have a valid studyId to avoid 400 Bad Request
      if (studyIdForFilter == null) {
        setSites([])
        setTotalCount(0)
        setTotalPages(0)
        setLoadingSites(false)
        return
      }

      const response = await siteService.getSitesList(pageNumber, pageSize, debouncedSearchTerm, studyIdForFilter, null)
      if (response?.isSuccess && response?.data) {
        // API returns { Items, PageNumber, PageSize, TotalCount, TotalPages }
        const data = response.data
        const list = Array.isArray(data)
          ? data
          : (data.items || data.Items || [])
        setSites(list)

        // Sync sites card with table data when filtering by protocol (avoid second GetSitesList with pageSize 100)
        if (selectedProtocolNumber) {
          setSelectedProtocolForSites(selectedProtocolNumber)
          setSelectedProtocolSites(list)
        }

        // Update pagination metadata
        if (data && typeof data === "object" && !Array.isArray(data)) {
          setTotalCount(data.totalCount || data.TotalCount || 0)
          setTotalPages(data.totalPages || data.TotalPages || 0)
        }
      } else {
        setSites([])
        setTotalCount(0)
        setTotalPages(0)
        if (selectedProtocolNumber) {
          setSelectedProtocolForSites(selectedProtocolNumber)
          setSelectedProtocolSites([])
        }
      }
    } catch (error) {
      setSites([])
      setTotalCount(0)
      setTotalPages(0)
      if (selectedProtocolNumber) {
        setSelectedProtocolForSites(selectedProtocolNumber)
        setSelectedProtocolSites([])
      }
    } finally {
      setLoadingSites(false)
    }
  }

  // Fetch sites for a specific protocol (for card display)
  const fetchSitesForProtocol = async (protocolNumber) => {
    if (!protocolNumber) {
      setSelectedProtocolSites([])
      return
    }
    
    setLoadingProtocolSites(true)
    try {
      const selectedStudy = availableStudies.find(
        (study) => study.studyProtocolNumber === protocolNumber
      )
      if (!selectedStudy || !selectedStudy.studyId) {
        setSelectedProtocolSites([])
        return
      }

      const response = await siteService.getSitesList(1, 100, "", selectedStudy.studyId, null)
      if (response?.isSuccess && response?.data) {
        const data = response.data
        const list = Array.isArray(data)
          ? data
          : (data.items || data.Items || [])
        setSelectedProtocolSites(list)
      } else {
        setSelectedProtocolSites([])
      }
    } catch (error) {
      setSelectedProtocolSites([])
    } finally {
      setLoadingProtocolSites(false)
    }
  }

  // Handle protocol selection from dropdown
  const handleProtocolSelectForSites = (protocolNumber) => {
    setSelectedProtocolForSites(protocolNumber)
    fetchSitesForProtocol(protocolNumber)
  }

  // Fetch studies for dropdown (uses GetStudiesForDropdown API) - only once per page load to reduce API calls
  const fetchStudies = async () => {
    if (hasFetchedStudiesRef.current) return
    hasFetchedStudiesRef.current = true
    setLoadingStudies(true)
    try {
      const response = await studyService.getStudiesForDropdown()
      if (response?.isSuccess && response?.data) {
        const list = Array.isArray(response.data)
          ? response.data
          : []
        setAvailableStudies(list)
      }
    } catch (error) {
      hasFetchedStudiesRef.current = false // allow retry on next tab switch if fetch failed
      // Error fetching studies
    } finally {
      setLoadingStudies(false)
    }
  }

  useEffect(() => {
    if (activeTab === "create" || activeTab === "manage" || activeTab === "bulk") {
      fetchStudies()
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab === "manage") {
      fetchSites()
    } else {
      // Clear sites card when switching away from manage tab
      setSelectedProtocolForSites("")
      setSelectedProtocolSites([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, pageNumber, pageSize, debouncedSearchTerm, selectedProtocolNumber, availableStudies])

  // Clear sites card on initial mount
  useEffect(() => {
    setSelectedProtocolForSites("")
    setSelectedProtocolSites([])
  }, [])

  return (
    <DashboardLayout>
      <div className={VIEWPORT_PAGE_SHELL_WITH_EMERALD_BG_CLASS}>
        {/* Main Container */}
        <div className="space-y-6">
          {/* Tabs */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex">
              <button
                onClick={() => {
                  setActiveTab("create")
                  setBulkImportResult(null)
                  setBulkImportFile(null)
                  setBulkStudyId("")
                  setSuccess("")
                  setError("")
                }}
                className={`flex-1 px-6 py-4 text-center font-semibold transition-all ${activeTab === "create"
                  ? "bg-gradient-to-r from-blue-50 to-emerald-50 text-blue-600 border-b-2 border-blue-600"
                  : "text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                  }`}
              >
                Create
              </button>
              <button
                onClick={() => setActiveTab("bulk")}
                className={`flex-1 px-6 py-4 text-center font-semibold transition-all ${activeTab === "bulk"
                  ? "bg-gradient-to-r from-blue-50 to-emerald-50 text-blue-600 border-b-2 border-blue-600"
                  : "text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                  }`}
              >
                Import Multiple
              </button>
              <button
                onClick={() => {
                  setActiveTab("manage")
                  setBulkImportResult(null)
                  setBulkImportFile(null)
                  setBulkStudyId("")
                  setSuccess("")
                  setError("")
                }}
                className={`flex-1 px-6 py-4 text-center font-semibold transition-all ${activeTab === "manage"
                  ? "bg-gradient-to-r from-blue-50 to-emerald-50 text-blue-600 border-b-2 border-blue-600"
                  : "text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                  }`}
              >
                Manage
              </button>
            </div>
          </div>

          {/* Content */}
          {activeTab === "bulk" ? (
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8">
              {success && (
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-bold">✓</span>
                  </div>
                  <p className="text-green-800 font-medium">{success}</p>
                  <button type="button" onClick={() => setSuccess("")} className="ml-auto text-green-600 hover:text-green-800">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
              {error && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-bold">!</span>
                  </div>
                  <p className="text-red-800 font-medium">{error}</p>
                  <button type="button" onClick={() => setError("")} className="ml-auto text-red-600 hover:text-red-800">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
              <div className="space-y-8">
                <div className="text-center sm:text-left">
                  <h3 className="text-xl font-bold text-slate-900">Import multiple sites</h3>
                  <p className="text-slate-600 mt-1 text-sm max-w-xl">
                    Add multiple sites at once by selecting a study, downloading the template, and uploading your filled CSV.
                  </p>
                </div>

                {/* Step 1: Select Study - same dropdown style as Manage "Filter by Study Protocol Number" */}
                <div className="relative pl-10 border-l-2 border-slate-200 border-solid ml-[11px]">
                  <div className="absolute left-0 top-0 -translate-x-1/2 w-6 h-6 rounded-full bg-blue-100 border-2 border-blue-500 flex items-center justify-center text-xs font-bold text-blue-700">
                    1
                  </div>
                  <div className="bg-slate-50/80 rounded-xl p-5 border border-slate-200">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Select study <span className="text-red-500">*</span>
                    </label>
                    <p className="text-xs text-slate-500 mb-3">Choose the study these sites will belong to.</p>
                    <div className="relative max-w-md">
                      <input
                        type="text"
                        value={bulkStudyDropdownOpen ? bulkStudySearchInput : (bulkStudyId ? (availableStudies.find(s => String(s.studyId) === String(bulkStudyId))?.studyProtocolNumber || `Study ${bulkStudyId}`) : "")}
                        onChange={(e) => {
                          setBulkStudySearchInput(e.target.value)
                          setBulkStudyDropdownOpen(true)
                        }}
                        onFocus={() => setBulkStudyDropdownOpen(true)}
                        placeholder="Select study protocol..."
                        className={`w-full px-4 py-3 rounded-lg border-2 outline-none transition-all bg-white text-slate-800 cursor-pointer ${!bulkStudyId ? "border-red-400 bg-red-50/50 ring-2 ring-red-300/60 animate-pulse focus:border-red-500 focus:ring-2 focus:ring-red-100" : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"}`}
                        disabled={loadingStudies}
                        readOnly={!bulkStudyDropdownOpen}
                        onClick={() => {
                          if (!bulkStudyDropdownOpen) {
                            setBulkStudySearchInput("")
                            setBulkStudyDropdownOpen(true)
                          }
                        }}
                      />
                      {!bulkStudyId && (
                        <p className="text-xs text-red-600 mt-1.5">Please select a study protocol number</p>
                      )}
                      {bulkStudyError && <p className="text-xs text-red-600 mt-1.5">{bulkStudyError}</p>}
                      {bulkStudyDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => {
                              setBulkStudyDropdownOpen(false)
                              setBulkStudySearchInput("")
                            }}
                          />
                          <div className="absolute z-20 w-full mt-1 bg-white border-2 border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                            {loadingStudies ? (
                              <div className="px-4 py-3 text-sm text-slate-500">Loading studies...</div>
                            ) : (
                              <>
                                <div className="p-2 border-b border-slate-200 sticky top-0 bg-white">
                                  <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                      type="text"
                                      value={bulkStudySearchInput}
                                      onChange={(e) => setBulkStudySearchInput(e.target.value)}
                                      placeholder="Search protocol..."
                                      className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </div>
                                </div>
                                {availableStudies
                                  .filter(study => {
                                    if (!bulkStudySearchInput) return true
                                    const searchLower = bulkStudySearchInput.toLowerCase()
                                    const protocolNumber = (study.studyProtocolNumber || "").toLowerCase()
                                    return protocolNumber.includes(searchLower)
                                  })
                                  .length === 0 ? (
                                  <div className="px-4 py-3 text-sm text-slate-500">No protocols found</div>
                                ) : (
                                  availableStudies
                                    .filter(study => {
                                      if (!bulkStudySearchInput) return true
                                      const searchLower = bulkStudySearchInput.toLowerCase()
                                      const protocolNumber = (study.studyProtocolNumber || "").toLowerCase()
                                      return protocolNumber.includes(searchLower)
                                    })
                                    .map((study) => (
                                      <div
                                        key={study.studyId}
                                        onClick={() => {
                                          setBulkStudyId(String(study.studyId))
                                          setBulkStudySearchInput("")
                                          setBulkStudyDropdownOpen(false)
                                          setBulkStudyError("")
                                          setError("")
                                        }}
                                        className={`px-4 py-2 cursor-pointer hover:bg-blue-50 transition-colors ${bulkStudyId === String(study.studyId) ? "bg-blue-100" : ""}`}
                                      >
                                        <div className="text-sm font-medium text-slate-900">
                                          {study.studyProtocolNumber || `Study ${study.studyId}`}
                                        </div>
                                      </div>
                                    ))
                                  )
                                }
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Step 2: Download template */}
                <div className="relative pl-10 border-l-2 border-slate-200 border-solid ml-[11px]">
                  <div className="absolute left-0 top-0 -translate-x-1/2 w-6 h-6 rounded-full bg-blue-100 border-2 border-blue-500 flex items-center justify-center text-xs font-bold text-blue-700">
                    2
                  </div>
                  <div className="bg-slate-50/80 rounded-xl p-5 border border-slate-200">
                    <h4 className="text-sm font-semibold text-slate-800 mb-3">Download template</h4>
                    <p className="text-xs text-slate-500 mb-4">Get the sample CSV, fill in your site details, and save.</p>
                    <button
                      type="button"
                      onClick={handleDownloadSiteSample}
                      disabled={bulkDownloadLoading || !bulkStudyId || loadingStudies}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white border-2 border-blue-200 text-blue-700 font-semibold hover:bg-blue-50 hover:border-blue-300 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {bulkDownloadLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      Download sample CSV
                    </button>
                  </div>
                </div>

                {/* Step 3: Upload & import */}
                <div className="relative pl-10 border-l-2 border-slate-200 border-solid ml-[11px]">
                  <div className="absolute left-0 top-0 -translate-x-1/2 w-6 h-6 rounded-full bg-blue-100 border-2 border-blue-500 flex items-center justify-center text-xs font-bold text-blue-700">
                    3
                  </div>
                  <div className="bg-slate-50/80 rounded-xl p-5 border border-slate-200 space-y-4">
                    <h4 className="text-sm font-semibold text-slate-800">Upload and import</h4>
                    <p className="text-xs text-slate-500">Choose your filled CSV file, then run the import.</p>
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-medium text-slate-700">CSV file</span>
                      <div className="flex items-center gap-3 flex-wrap">
                        <label
                          htmlFor="bulk-upload-csv"
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border-2 border-dashed border-slate-300 text-slate-600 text-sm font-medium hover:border-blue-400 hover:bg-blue-50/50 transition-colors cursor-pointer"
                        >
                          <FileText className="w-4 h-4 text-slate-400" />
                          {bulkImportFile ? bulkImportFile.name : "Choose file"}
                        </label>
                        <input
                          type="file"
                          accept=".csv"
                          onChange={(e) => {
                            setBulkImportFile(e.target.files?.[0] || null)
                            setBulkImportResult(null)
                          }}
                          className="sr-only"
                          id="bulk-upload-csv"
                        />
                        <label
                          htmlFor="bulk-upload-csv"
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border-2 border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 hover:border-slate-400 cursor-pointer transition-colors"
                        >
                          Browse
                        </label>
                      </div>
                    </div>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleBulkImport}
                        disabled={bulkImportLoading || !bulkStudyId || !bulkImportFile || loadingStudies}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r btn-brand-gradient text-white font-semibold  transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-md"
                      >
                        {bulkImportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {bulkImportLoading ? "Importing..." : "Import sites"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Import result: summary and failed rows (like user import) */}
                {bulkImportResult && (
                  <div className="mt-8 rounded-xl border-2 border-slate-200 bg-slate-50/50 overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-200 bg-white flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-800">Import result</h4>
                        <p className="text-sm text-slate-600 mt-1">
                          Total: {bulkImportResult.totalRows ?? 0} row(s) —{" "}
                          <span className="text-emerald-600 font-medium">{bulkImportResult.successCount ?? 0} successful</span>
                          {((bulkImportResult.failedCount ?? 0) > 0) && (
                            <>
                              , <span className="text-red-600 font-medium">{bulkImportResult.failedCount} failed</span>
                              {(bulkImportResult.failedRows?.length > 0 || (bulkImportResult.rows && bulkImportResult.rows.filter(r => !r.isSuccess).length > 0)) && (
                                <span className="text-slate-500"> (see reasons below)</span>
                              )}
                            </>
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setBulkImportResult(null)
                          setBulkImportResultPage(1)
                          setSuccess("")
                          setError("")
                        }}
                        className="shrink-0 px-4 py-2 rounded-lg border-2 border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 hover:border-slate-300 transition-all"
                      >
                        Clear
                      </button>
                    </div>
                    {((bulkImportResult.failedRows?.length > 0) || (bulkImportResult.rows && bulkImportResult.rows.filter(r => !r.isSuccess).length > 0)) && (() => {
                      const failedList = bulkImportResult.failedRows || bulkImportResult.rows?.filter(r => !r.isSuccess) || []
                      const perPage = 10
                      const totalPages = Math.max(Math.ceil(failedList.length / perPage), 1)
                      const page = Math.min(bulkImportResultPage, totalPages)
                      const paged = failedList.slice((page - 1) * perPage, page * perPage)
                      const start = failedList.length ? (page - 1) * perPage + 1 : 0
                      const end = Math.min(page * perPage, failedList.length)
                      return (
                        <div className="overflow-x-auto">
                          <div className="px-4 py-2 border-b border-slate-200 bg-slate-50/80 text-xs text-slate-600 flex items-center justify-between flex-wrap gap-2">
                            <span>Showing {start}–{end} of {failedList.length} failed rows (10 per page)</span>
                            {failedList.length > perPage && (
                              <span>Page {page} of {totalPages}</span>
                            )}
                          </div>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-slate-100 border-b border-slate-200">
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Row</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Site Name</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Email</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Reason</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-100">
                              {paged.map((row, idx) => {
                                const rowNum = row.rowNumber ?? row._RowNumber ?? (page - 1) * perPage + idx + 1
                                const siteName = row.siteName ?? row.rawData?.siteName ?? "—"
                                const email = row.emailId ?? row.rawData?.emailId ?? "—"
                                const reason = row.message ?? row._Errors ?? "Import failed"
                                return (
                                  <tr key={(page - 1) * perPage + idx} className="hover:bg-red-50/30">
                                    <td className="px-4 py-3 font-medium text-slate-600">{rowNum}</td>
                                    <td className="px-4 py-3 text-slate-800">{siteName}</td>
                                    <td className="px-4 py-3 text-slate-700">{email}</td>
                                    <td className="px-4 py-3">
                                      <div className="text-xs text-red-700 font-medium bg-red-50 border border-red-200 rounded px-2 py-1.5 max-w-md" title={reason}>
                                        {reason}
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                          {failedList.length > perPage && (
                            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
                              <button
                                type="button"
                                disabled={page <= 1}
                                onClick={() => setBulkImportResultPage((p) => Math.max(1, p - 1))}
                                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 font-medium"
                              >
                                Prev
                              </button>
                              <span className="font-medium">Page {page} of {totalPages}</span>
                              <button
                                type="button"
                                disabled={page >= totalPages}
                                onClick={() => setBulkImportResultPage((p) => Math.min(totalPages, p + 1))}
                                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 font-medium"
                              >
                                Next
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === "create" ? (
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8">
              {/* Success/Error Messages */}
              {success && (
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 flex items-center gap-3 mb-6">
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
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-center gap-3 mb-6">
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
              <form onSubmit={(e) => handleSubmit(e, "submit")}>
              <div className="space-y-8">
                {/* Section 1: Basic Information */}
                <div className="relative">
                  <div className="absolute -top-3 left-0 bg-gradient-to-r from-blue-500 to-emerald-500 text-white px-4 py-1 rounded-full text-xs font-bold flex items-center gap-2 shadow-md">
                    <Hash className="w-3 h-3" />
                    Basic Information
                  </div>
                  <div className="border-2 border-blue-200 rounded-xl p-6 bg-gradient-to-br from-blue-50/50 to-emerald-50/30 pt-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Study Selection - same dropdown style as Manage "Filter by Study Protocol Number" */}
                      <div className="relative">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Study <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={createStudyDropdownOpen ? createStudySearchInput : (formData.studyId ? (availableStudies.find(s => String(s.studyId) === String(formData.studyId))?.studyProtocolNumber || `Study ${formData.studyId}`) : "")}
                            onChange={(e) => {
                              setCreateStudySearchInput(e.target.value)
                              setCreateStudyDropdownOpen(true)
                            }}
                            onFocus={() => setCreateStudyDropdownOpen(true)}
                            placeholder="Select study protocol..."
                            className={`w-full px-4 py-3 rounded-lg border-2 outline-none transition-all bg-white text-slate-800 cursor-pointer ${!formData.studyId || errors.studyId ? "border-red-400 bg-red-50/50 ring-2 ring-red-300/60 animate-pulse focus:border-red-500 focus:ring-2 focus:ring-red-100" : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"}`}
                            disabled={loadingStudies}
                            readOnly={!createStudyDropdownOpen}
                            onClick={() => {
                              if (!createStudyDropdownOpen) {
                                setCreateStudySearchInput("")
                                setCreateStudyDropdownOpen(true)
                              }
                            }}
                          />
                          {(!formData.studyId || errors.studyId) && (
                            <p className="text-xs text-red-600 mt-1.5">Please select a study protocol number</p>
                          )}
                          {createStudyDropdownOpen && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => {
                                  setCreateStudyDropdownOpen(false)
                                  setCreateStudySearchInput("")
                                }}
                              />
                              <div className="absolute z-20 w-full mt-1 bg-white border-2 border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                                {loadingStudies ? (
                                  <div className="px-4 py-3 text-sm text-slate-500">Loading studies...</div>
                                ) : (
                                  <>
                                    <div className="p-2 border-b border-slate-200 sticky top-0 bg-white">
                                      <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                          type="text"
                                          value={createStudySearchInput}
                                          onChange={(e) => setCreateStudySearchInput(e.target.value)}
                                          placeholder="Search protocol..."
                                          className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      </div>
                                    </div>
                                    {availableStudies
                                      .filter(study => {
                                        if (!createStudySearchInput) return true
                                        const searchLower = createStudySearchInput.toLowerCase()
                                        const protocolNumber = (study.studyProtocolNumber || "").toLowerCase()
                                        return protocolNumber.includes(searchLower)
                                      })
                                      .length === 0 ? (
                                      <div className="px-4 py-3 text-sm text-slate-500">No protocols found</div>
                                    ) : (
                                      availableStudies
                                        .filter(study => {
                                          if (!createStudySearchInput) return true
                                          const searchLower = createStudySearchInput.toLowerCase()
                                          const protocolNumber = (study.studyProtocolNumber || "").toLowerCase()
                                          return protocolNumber.includes(searchLower)
                                        })
                                        .map((study) => (
                                          <div
                                            key={study.studyId}
                                            onClick={() => {
                                              handleInputChange("studyId", String(study.studyId))
                                              handleInputChange("studyProtocolNumber", study.studyProtocolNumber || "")
                                              setCreateStudySearchInput("")
                                              setCreateStudyDropdownOpen(false)
                                            }}
                                            className={`px-4 py-2 cursor-pointer hover:bg-blue-50 transition-colors ${formData.studyId === String(study.studyId) ? "bg-blue-100" : ""}`}
                                          >
                                            <div className="text-sm font-medium text-slate-900">
                                              {study.studyProtocolNumber || `Study ${study.studyId}`}
                                            </div>
                                          </div>
                                        ))
                                    )}
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Site Name */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Site Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.siteName}
                          onChange={(e) => handleInputChange("siteName", e.target.value, 200)}
                          className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${errors.siteName
                            ? "border-red-300 bg-red-50/50 focus:border-red-500"
                            : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 bg-white"
                            } outline-none`}
                          required
                          maxLength={200}
                        />
                        {errors.siteName && (
                          <p className="text-xs text-red-600 mt-1">{errors.siteName}</p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">{formData.siteName.length} / 200</p>
                      </div>

                      {/* Site Full Name */}
                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Site Full Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.siteFullName}
                          onChange={(e) => handleInputChange("siteFullName", e.target.value, 500)}
                          className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${errors.siteFullName
                            ? "border-red-300 bg-red-50/50 focus:border-red-500"
                            : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 bg-white"
                            } outline-none`}
                          required
                          maxLength={500}
                        />
                        {errors.siteFullName && (
                          <p className="text-xs text-red-600 mt-1">{errors.siteFullName}</p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">{formData.siteFullName.length} / 500</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Patient & Investigator Information */}
                <div className="relative">
                  <div className="absolute -top-3 left-0 bg-gradient-to-r from-teal-500 to-pink-500 text-white px-4 py-1 rounded-full text-xs font-bold flex items-center gap-2 shadow-md">
                    <User className="w-3 h-3" />
                    Patient & Investigator Information
                  </div>
                  <div className="border-2 border-teal-200 rounded-xl p-6 bg-gradient-to-br from-teal-50/50 to-pink-50/30 pt-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Planned Patients */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Planned Patients <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          value={formData.plannedPatients}
                          onChange={(e) => handleInputChange("plannedPatients", e.target.value)}
                          className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${errors.plannedPatients
                            ? "border-red-300 bg-red-50/50 focus:border-red-500"
                            : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 bg-white"
                            } outline-none`}
                          required
                        />
                        {errors.plannedPatients && (
                          <p className="text-xs text-red-600 mt-1">{errors.plannedPatients}</p>
                        )}
                      </div>

                      {/* Investigator Name */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Investigator Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.investigatorName}
                          onChange={(e) => handleInputChange("investigatorName", e.target.value, 200)}
                          className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${errors.investigatorName
                            ? "border-red-300 bg-red-50/50 focus:border-red-500"
                            : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 bg-white"
                            } outline-none`}
                          required
                          maxLength={200}
                        />
                        {errors.investigatorName && (
                          <p className="text-xs text-red-600 mt-1">{errors.investigatorName}</p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">{formData.investigatorName.length} / 200</p>
                      </div>

                      {/* Frontline Investigator Code */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Frontline Investigator Code
                        </label>
                        <input
                          type="number"
                          value={formData.frontlineInvestigatorCode}
                          onChange={(e) => handleInputChange("frontlineInvestigatorCode", e.target.value)}
                          className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${errors.frontlineInvestigatorCode
                            ? "border-red-300 bg-red-50/50 focus:border-red-500"
                            : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 bg-white"
                            } outline-none`}
                          min="1"
                          placeholder="Enter code (must be greater than 0)"
                        />
                        {errors.frontlineInvestigatorCode && (
                          <p className="text-xs text-red-600 mt-1">{errors.frontlineInvestigatorCode}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3: Contact Information */}
                <div className="relative">
                  <div className="absolute -top-3 left-0 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-1 rounded-full text-xs font-bold flex items-center gap-2 shadow-md">
                    <Mail className="w-3 h-3" />
                    Contact Information
                  </div>
                  <div className="border-2 border-green-200 rounded-xl p-6 bg-gradient-to-br from-green-50/50 to-emerald-50/30 pt-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Email Id */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Email Id <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          value={formData.emailId}
                          onChange={(e) => handleInputChange("emailId", e.target.value, 255)}
                          pattern="[a-zA-Z0-9._+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}"
                          title="e.g. first.last@example.com"
                          className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${errors.emailId
                            ? "border-red-300 bg-red-50/50 focus:border-red-500"
                            : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 bg-white"
                            } outline-none`}
                          required
                          maxLength={255}
                        />
                        {errors.emailId && (
                          <p className="text-xs text-red-600 mt-1">{errors.emailId}</p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">{formData.emailId.length} / 255</p>
                      </div>

                      {/* Mobile No. */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Mobile No.
                        </label>
                        <input
                          type="tel"
                          value={formData.mobileNo}
                          onChange={(e) => handleInputChange("mobileNo", e.target.value)}
                          className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${errors.mobileNo
                            ? "border-red-300 bg-red-50/50 focus:border-red-500"
                            : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 bg-white"
                            } outline-none`}
                          maxLength={10}
                          placeholder="10 digits (e.g., 1234567890)"
                        />
                        {errors.mobileNo && (
                          <p className="text-xs text-red-600 mt-1">{errors.mobileNo}</p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">{formData.mobileNo.length} / 10</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 4: Location Information */}
                <div className="relative">
                  <div className="absolute -top-3 left-0 bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-1 rounded-full text-xs font-bold flex items-center gap-2 shadow-md">
                    <MapPin className="w-3 h-3" />
                    Location Information
                  </div>
                  <div className="border-2 border-orange-200 rounded-xl p-6 bg-gradient-to-br from-orange-50/50 to-red-50/30 pt-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Region */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Region <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.region}
                          onChange={(e) => handleInputChange("region", e.target.value, 100)}
                          className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${errors.region
                            ? "border-red-300 bg-red-50/50 focus:border-red-500"
                            : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 bg-white"
                            } outline-none`}
                          required
                        />
                        {errors.region && (
                          <p className="text-xs text-red-600 mt-1">{errors.region}</p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">{formData.region.length} / 100</p>
                      </div>

                      {/* Pin Code */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Pin Code
                        </label>
                        <input
                          type="text"
                          value={formData.pincode}
                          onChange={(e) => handleInputChange("pincode", e.target.value)}
                          className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 bg-white outline-none transition-all"
                          placeholder="Enter 6-digit PIN code"
                          maxLength={6}
                          disabled={loadingLocation}
                        />
                        {loadingLocation && (
                          <p className="text-xs text-blue-600 mt-1">Fetching location...</p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">{formData.pincode.length} / 6</p>
                      </div>

                      {/* State — editable so the user can fill manually if PIN lookup fails (CORS / network). */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          State
                        </label>
                        <input
                          type="text"
                          value={formData.state}
                          onChange={(e) => handleInputChange("state", e.target.value, 100)}
                          className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 bg-white outline-none transition-all"
                          placeholder="Auto-filled from PIN code (or enter manually)"
                          maxLength={100}
                        />
                        <p className="text-xs text-slate-500 mt-1">{formData.state.length} / 100</p>
                      </div>

                      {/* City — editable so the user can fill manually if PIN lookup fails (CORS / network). */}
                      <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          City
                        </label>
                        <input
                          type="text"
                          value={formData.city}
                          onChange={(e) => handleInputChange("city", e.target.value, 100)}
                          className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 bg-white outline-none transition-all"
                          placeholder="Auto-filled from PIN code (or enter manually)"
                          maxLength={100}
                        />
                        <p className="text-xs text-slate-500 mt-1">{formData.city.length} / 100</p>
                      </div>

                      {/* Site Address */}
                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Site Address <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={formData.siteAddress}
                          onChange={(e) => handleInputChange("siteAddress", e.target.value, 1000)}
                          className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${errors.siteAddress
                            ? "border-red-300 bg-red-50/50 focus:border-red-500"
                            : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 bg-white"
                            } outline-none resize-none`}
                          rows={3}
                          required
                          maxLength={1000}
                        />
                        {errors.siteAddress && (
                          <p className="text-xs text-red-600 mt-1">{errors.siteAddress}</p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">{formData.siteAddress.length} / 1000</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 5: Additional Comments */}
                <div className="relative">
                  <div className="absolute -top-3 left-0 bg-gradient-to-r from-slate-500 to-slate-600 text-white px-4 py-1 rounded-full text-xs font-bold flex items-center gap-2 shadow-md">
                    <FileText className="w-3 h-3" />
                    Additional Comments
                  </div>
                  <div className="border-2 border-slate-200 rounded-xl p-6 bg-gradient-to-br from-slate-50/50 to-slate-50/30 pt-8">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Comments
                      </label>
                      <textarea
                        value={formData.comments}
                        onChange={(e) => handleInputChange("comments", e.target.value, 500)}
                        className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all resize-none bg-white"
                        rows={4}
                      />
                      <p className="text-xs text-slate-500 mt-1">{formData.comments.length} / 500</p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-4 pt-4 border-t border-slate-200">
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
            </div>
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

              {/* Filter and Search Bar */}
              <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Protocol Number Dropdown - required to view sites */}
                  <div className="relative">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Filter by Study Protocol Number <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={selectedProtocolNumber ? (availableStudies.find(s => s.studyProtocolNumber === selectedProtocolNumber)?.studyProtocolNumber || selectedProtocolNumber) : ""}
                        readOnly
                        placeholder="Select study protocol..."
                        className={`w-full px-4 py-3 rounded-lg border-2 outline-none transition-all bg-white text-slate-800 cursor-pointer ${!selectedProtocolNumber ? "border-red-400 bg-red-50/50 ring-2 ring-red-300/60 animate-pulse focus:border-red-500 focus:ring-2 focus:ring-red-100" : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"}`}
                        disabled={loadingStudies}
                        onClick={() => {
                          if (!isFilterProtocolDropdownOpen) {
                            setIsFilterProtocolDropdownOpen(true)
                          }
                        }}
                      />
                      {!selectedProtocolNumber && (
                        <p className="text-xs text-red-600 mt-1.5">Please select a study protocol number</p>
                      )}
                      {isFilterProtocolDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => {
                              setIsFilterProtocolDropdownOpen(false)
                              setFilterProtocolSearchInput("")
                            }}
                          />
                          <div className="absolute z-20 w-full mt-1 bg-white border-2 border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                            {loadingStudies ? (
                              <div className="px-4 py-3 text-sm text-slate-500">Loading studies...</div>
                            ) : (
                              <>
                                {/* Search inside dropdown */}
                                <div className="p-2 border-b border-slate-200 sticky top-0 bg-white">
                                  <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                      type="text"
                                      value={filterProtocolSearchInput}
                                      onChange={(e) => setFilterProtocolSearchInput(e.target.value)}
                                      placeholder="Search protocol..."
                                      className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </div>
                                </div>
                                {/* All Protocols Option */}
                                <div onClick={() => {
                                  setSelectedProtocolNumber("")
                                  setFilterProtocolSearchInput("")
                                  setIsFilterProtocolDropdownOpen(false)
                                  setPageNumber(1)
                                  // Clear sites card when selecting "All Protocols"
                                  setSelectedProtocolForSites("")
                                  setSelectedProtocolSites([])
                                }}
                                  className={`px-4 py-2 cursor-pointer hover:bg-blue-50 transition-colors ${selectedProtocolNumber === "" ? "bg-blue-100" : ""}`}
                                >
                                  <div className="text-sm font-medium text-slate-900">All Protocols</div>
                                </div>
                                {/* Filtered Studies */}
                                {availableStudies.filter(study => {
                                  if (!filterProtocolSearchInput) return true
                                  const searchLower = filterProtocolSearchInput.toLowerCase()
                                  const protocolNumber = (study.studyProtocolNumber || "").toLowerCase()
                                  return protocolNumber.includes(searchLower)
                                }).length === 0 ? (
                                  <div className="px-4 py-3 text-sm text-slate-500">No protocols found</div>
                                ) : (
                                  availableStudies
                                    .filter(study => {
                                      if (!filterProtocolSearchInput) return true
                                      const searchLower = filterProtocolSearchInput.toLowerCase()
                                      const protocolNumber = (study.studyProtocolNumber || "").toLowerCase()
                                      return protocolNumber.includes(searchLower)
                                    })
                                    .map((study) => (
                                      <div
                                        key={study.studyId}
                                        onClick={() => {
                                          const protocolNum = study.studyProtocolNumber || ""
                                          setSelectedProtocolNumber(protocolNum)
                                          setFilterProtocolSearchInput("")
                                          setIsFilterProtocolDropdownOpen(false)
                                          setPageNumber(1)
                                          // Sites card is filled from fetchSites() result (one API call with pageSize 10 only)
                                        }}
                                        className={`px-4 py-2 cursor-pointer hover:bg-blue-50 transition-colors ${selectedProtocolNumber === (study.studyProtocolNumber || "") ? "bg-blue-100" : ""}`}
                                      >
                                        <div className="text-sm font-medium text-slate-900">
                                          {study.studyProtocolNumber || `Study ${study.studyId}`}
                                        </div>
                                      </div>
                                    ))
                                )}
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="relative">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Search Sites
                    </label>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-lg border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all bg-white"
                        placeholder="Search sites by site name, investigator, email..."
                      />
                    </div>
                  </div>
                  {/* Clear & Export - Export at right corner */}
                  <div className="flex items-end justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm("")
                        setSelectedProtocolNumber("")
                        setFilterProtocolSearchInput("")
                        setPageNumber(1)
                        setSelectedProtocolForSites("")
                        setSelectedProtocolSites([])
                      }}
                      className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 hover:border-slate-300 transition-colors"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={handleExportSites}
                      disabled={exportSitesLoading || !selectedProtocolNumber}
                      title={!selectedProtocolNumber ? "Select a study protocol to export" : "Export sites as CSV"}
                      className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold hover:bg-emerald-100 hover:border-emerald-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {exportSitesLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      {exportSitesLoading ? "Exporting..." : "Export"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Sites Table */}
              {loadingSites ? (
                <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-12 text-center">
                  <SectionSkeleton title="Loading sites..." rows={7} variant="siteReport" />
                </div>
              ) : sites.length === 0 ? (
                <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-emerald-100 flex items-center justify-center mx-auto mb-4">
                    <Building2 className="w-8 h-8 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">No Sites Found</h2>
                  <p className="text-slate-600">
                    {selectedProtocolNumber
                      ? "No sites found for this protocol. Create your first site to get started."
                      : "Please select a study protocol number above to view sites."}
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200">
                        <tr>
                          <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">ID</th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">GUID</th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">STUDY PROTOCOL NUMBER</th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">SITE NAME</th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">SITE FULL NAME</th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">PLANNED PATIENTS</th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">INVESTIGATOR NAME</th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">EMAIL ID</th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">REGION</th>
                          <th className="px-4 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">STATUS</th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">ACTION</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-200">
                        {sites.map((site) => {
                          const siteId = site.id ?? site.Id ?? "—"
                          const rawGuid = site.guid ?? site.Guid ?? ""
                          const guidDisplay = rawGuid ? `${String(rawGuid).slice(0, 4)}..` : "—"
                          return (
                          <tr key={site.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className="text-sm font-mono text-slate-600">{siteId}</span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              {rawGuid ? (
                                <button
                                  type="button"
                                  onClick={() => handleCopyGuid(rawGuid, site.id)}
                                  title={`Click to copy: ${rawGuid}`}
                                  className="text-sm font-mono text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded transition-colors cursor-pointer inline-flex items-center gap-1.5"
                                >
                                  {guidDisplay}
                                  {copiedGuidSiteId === site.id && <span className="text-xs text-emerald-600 font-medium">Copied!</span>}
                                </button>
                              ) : (
                                <span className="text-sm font-mono text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                                  <FileText className="w-4 h-4 text-white" />
                                </div>
                                <div className="text-sm font-semibold text-slate-900">{site.studyProtocolNumber || "N/A"}</div>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-slate-900">{site.siteName || "N/A"}</div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="text-sm text-slate-900 max-w-xs truncate" title={site.siteFullName}>
                                {site.siteFullName || "N/A"}
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-slate-900">{site.plannedPatients || "N/A"}</div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-slate-900">{site.investigatorName || "N/A"}</div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-slate-900">{site.emailId || "N/A"}</div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm text-slate-900">{site.region || "N/A"}</div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-center">
                              <div className="flex items-center justify-center gap-3">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    const isActive = site.isActive !== undefined ? site.isActive : (site.IsActive !== undefined ? site.IsActive : true)
                                    handleToggleStatus(site.id, isActive)
                                  }}
                                  disabled={updatingStatus[site.id]}
                                  className={`relative inline-flex h-8 w-16 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer ${(site.isActive !== undefined ? site.isActive : (site.IsActive !== undefined ? site.IsActive : true))
                                    ? "bg-blue-600 hover:bg-blue-700"
                                    : "bg-slate-300 hover:bg-slate-400"
                                    }`}
                                >
                                  <span
                                    className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-200 ${(site.isActive !== undefined ? site.isActive : (site.IsActive !== undefined ? site.IsActive : true)) ? "translate-x-9" : "translate-x-1"
                                      }`}
                                  />
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleEditSite(site)}
                                  className="px-3 py-1.5 rounded-lg bg-teal-100 text-teal-700 hover:bg-teal-200 transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                                  title="Edit site"
                                >
                                  <Edit className="w-3.5 h-3.5" />
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
                      itemName="sites"
                      showPageSizeSelector={true}
                    />
                  )}
                </div>
              )}

              {/* Edit Site Modal */}
              {editingSite && editFormData && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
                  <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl my-8 border border-slate-100">
                    {/* Modal Header */}
                    <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-emerald-50 border-b border-slate-200 px-8 py-5 flex items-center justify-between z-10 rounded-t-3xl">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-bold text-slate-900">Edit Site: {editFormData.siteName}</h3>
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
                      <form onSubmit={handleUpdateSite} className="p-8">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <tbody className="divide-y divide-slate-200">
                              {/* Study ID */}
                              <tr>
                                <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700 w-1/4">
                                  Study <span className="text-red-500">*</span>
                                </td>
                                <td className="px-4 py-3 bg-white">
                                  <select
                                    value={editFormData.studyId || ""}
                                    onChange={(e) => {
                                      const selectedStudyId = e.target.value
                                      const selectedStudy = availableStudies.find(s => String(s.studyId) === selectedStudyId)
                                      if (selectedStudy) {
                                        handleEditInputChange("studyId", selectedStudyId)
                                        handleEditInputChange("studyProtocolNumber", selectedStudy.studyProtocolNumber || "")
                                      }
                                    }}
                                    className={`w-full px-3 py-2 rounded-lg border-2 transition-all text-sm ${editErrors.studyId
                                      ? "border-red-300 bg-red-50/50 focus:border-red-500"
                                      : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                      } outline-none bg-white text-slate-800`}
                                    disabled={loadingStudies}
                                    required
                                  >
                                    <option value="">-- Select Study --</option>
                                    {availableStudies.map((study) => (
                                      <option key={study.studyId} value={study.studyId}>
                                        {study.studyProtocolNumber || `Study ${study.studyId}`}
                                      </option>
                                    ))}
                                  </select>
                                  {editErrors.studyId && (
                                    <p className="text-xs text-red-600 mt-1">{editErrors.studyId}</p>
                                  )}
                                </td>
                              </tr>

                              {/* Study/Protocol Number */}
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
                                    maxLength={50}
                                  />
                                  {editErrors.studyProtocolNumber && (
                                    <p className="text-xs text-red-600 mt-1">{editErrors.studyProtocolNumber}</p>
                                  )}
                                  <p className="text-xs text-slate-500 mt-1">{editFormData.studyProtocolNumber.length} / 50</p>
                                </td>
                              </tr>

                              {/* Site Name */}
                              <tr>
                                <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">
                                  Site Name <span className="text-red-500">*</span>
                                </td>
                                <td className="px-4 py-3 bg-white">
                                  <input
                                    type="text"
                                    value={editFormData.siteName}
                                    onChange={(e) => handleEditInputChange("siteName", e.target.value, 200)}
                                    className={`w-full px-3 py-2 rounded-lg border-2 transition-all text-sm ${editErrors.siteName
                                      ? "border-red-300 bg-red-50/50 focus:border-red-500"
                                      : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                      } outline-none`}
                                    required
                                    maxLength={200}
                                  />
                                  {editErrors.siteName && (
                                    <p className="text-xs text-red-600 mt-1">{editErrors.siteName}</p>
                                  )}
                                  <p className="text-xs text-slate-500 mt-1">{editFormData.siteName.length} / 200</p>
                                </td>
                              </tr>

                              {/* Site Full Name */}
                              <tr>
                                <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">
                                  Site Full Name <span className="text-red-500">*</span>
                                </td>
                                <td className="px-4 py-3 bg-white">
                                  <input
                                    type="text"
                                    value={editFormData.siteFullName}
                                    onChange={(e) => handleEditInputChange("siteFullName", e.target.value, 500)}
                                    className={`w-full px-3 py-2 rounded-lg border-2 transition-all text-sm ${editErrors.siteFullName
                                      ? "border-red-300 bg-red-50/50 focus:border-red-500"
                                      : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                      } outline-none`}
                                    required
                                    maxLength={500}
                                  />
                                  {editErrors.siteFullName && (
                                    <p className="text-xs text-red-600 mt-1">{editErrors.siteFullName}</p>
                                  )}
                                  <p className="text-xs text-slate-500 mt-1">{editFormData.siteFullName.length} / 500</p>
                                </td>
                              </tr>

                              {/* Planned Patients */}
                              <tr>
                                <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">
                                  Planned Patients <span className="text-red-500">*</span>
                                </td>
                                <td className="px-4 py-3 bg-white">
                                  <input
                                    type="number"
                                    value={editFormData.plannedPatients}
                                    onChange={(e) => handleEditInputChange("plannedPatients", e.target.value)}
                                    className={`w-full px-3 py-2 rounded-lg border-2 transition-all text-sm ${editErrors.plannedPatients
                                      ? "border-red-300 bg-red-50/50 focus:border-red-500"
                                      : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                      } outline-none`}
                                    required
                                  />
                                  {editErrors.plannedPatients && (
                                    <p className="text-xs text-red-600 mt-1">{editErrors.plannedPatients}</p>
                                  )}
                                </td>
                              </tr>

                              {/* Investigator Name */}
                              <tr>
                                <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">
                                  Investigator Name <span className="text-red-500">*</span>
                                </td>
                                <td className="px-4 py-3 bg-white">
                                  <input
                                    type="text"
                                    value={editFormData.investigatorName}
                                    onChange={(e) => handleEditInputChange("investigatorName", e.target.value, 200)}
                                    className={`w-full px-3 py-2 rounded-lg border-2 transition-all text-sm ${editErrors.investigatorName
                                      ? "border-red-300 bg-red-50/50 focus:border-red-500"
                                      : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                      } outline-none`}
                                    required
                                    maxLength={200}
                                  />
                                  {editErrors.investigatorName && (
                                    <p className="text-xs text-red-600 mt-1">{editErrors.investigatorName}</p>
                                  )}
                                  <p className="text-xs text-slate-500 mt-1">{editFormData.investigatorName.length} / 200</p>
                                </td>
                              </tr>

                              {/* Frontline Investigator Code */}
                              <tr>
                                <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">
                                  Frontline Investigator Code
                                </td>
                                <td className="px-4 py-3 bg-white">
                                  <input
                                    type="number"
                                    value={editFormData.frontlineInvestigatorCode}
                                    onChange={(e) => handleEditInputChange("frontlineInvestigatorCode", e.target.value)}
                                    className={`w-full px-3 py-2 rounded-lg border-2 transition-all text-sm ${editErrors.frontlineInvestigatorCode
                                      ? "border-red-300 bg-red-50/50 focus:border-red-500"
                                      : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                      } outline-none`}
                                    min="1"
                                    placeholder="Enter code (must be greater than 0)"
                                  />
                                  {editErrors.frontlineInvestigatorCode && (
                                    <p className="text-xs text-red-600 mt-1">{editErrors.frontlineInvestigatorCode}</p>
                                  )}
                                </td>
                              </tr>

                              {/* Email Id */}
                              <tr>
                                <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">
                                  Email Id <span className="text-red-500">*</span>
                                </td>
                                <td className="px-4 py-3 bg-white">
                                  <input
                                    type="email"
                                    value={editFormData.emailId}
                                    onChange={(e) => handleEditInputChange("emailId", e.target.value, 255)}
                                    pattern="[a-zA-Z0-9._+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}"
                                    title="e.g. first.last@example.com"
                                    className={`w-full px-3 py-2 rounded-lg border-2 transition-all text-sm ${editErrors.emailId
                                      ? "border-red-300 bg-red-50/50 focus:border-red-500"
                                      : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                      } outline-none`}
                                    required
                                    maxLength={255}
                                  />
                                  {editErrors.emailId && (
                                    <p className="text-xs text-red-600 mt-1">{editErrors.emailId}</p>
                                  )}
                                  <p className="text-xs text-slate-500 mt-1">{editFormData.emailId.length} / 255</p>
                                </td>
                              </tr>

                              {/* Mobile No. */}
                              <tr>
                                <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">
                                  Mobile No.
                                </td>
                                <td className="px-4 py-3 bg-white">
                                  <input
                                    type="tel"
                                    value={editFormData.mobileNo}
                                    onChange={(e) => handleEditInputChange("mobileNo", e.target.value)}
                                    className={`w-full px-3 py-2 rounded-lg border-2 transition-all text-sm ${editErrors.mobileNo
                                      ? "border-red-300 bg-red-50/50 focus:border-red-500"
                                      : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                      } outline-none`}
                                    maxLength={10}
                                    placeholder="10 digits (e.g., 1234567890)"
                                  />
                                  {editErrors.mobileNo && (
                                    <p className="text-xs text-red-600 mt-1">{editErrors.mobileNo}</p>
                                  )}
                                  <p className="text-xs text-slate-500 mt-1">{editFormData.mobileNo.length} / 10</p>
                                </td>
                              </tr>

                              {/* Region */}
                              <tr>
                                <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">
                                  Region <span className="text-red-500">*</span>
                                </td>
                                <td className="px-4 py-3 bg-white">
                                  <input
                                    type="text"
                                    value={editFormData.region}
                                    onChange={(e) => handleEditInputChange("region", e.target.value, 100)}
                                    className={`w-full px-3 py-2 rounded-lg border-2 transition-all text-sm ${editErrors.region
                                      ? "border-red-300 bg-red-50/50 focus:border-red-500"
                                      : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                      } outline-none`}
                                    required
                                  />
                                  {editErrors.region && (
                                    <p className="text-xs text-red-600 mt-1">{editErrors.region}</p>
                                  )}
                                  <p className="text-xs text-slate-500 mt-1">{editFormData.region.length} / 100</p>
                                </td>
                              </tr>

                              {/* Pin Code */}
                              <tr>
                                <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">
                                  Pin Code
                                </td>
                                <td className="px-4 py-3 bg-white">
                                  <input
                                    type="text"
                                    value={editFormData.pincode || ""}
                                    onChange={(e) => handleEditInputChange("pincode", e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white outline-none transition-all text-sm"
                                    placeholder="Enter 6-digit PIN code"
                                    maxLength={6}
                                    disabled={loadingLocation}
                                  />
                                  {loadingLocation && (
                                    <p className="text-xs text-blue-600 mt-1">Fetching location...</p>
                                  )}
                                  <p className="text-xs text-slate-500 mt-1">{(editFormData.pincode || "").length} / 6</p>
                                </td>
                              </tr>

                              {/* State — editable so the user can fill manually if PIN lookup fails (CORS / network). */}
                              <tr>
                                <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">
                                  State
                                </td>
                                <td className="px-4 py-3 bg-white">
                                  <input
                                    type="text"
                                    value={editFormData.state || ""}
                                    onChange={(e) => handleEditInputChange("state", e.target.value, 100)}
                                    className="w-full px-3 py-2 rounded-lg border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white outline-none transition-all text-sm"
                                    placeholder="Auto-filled from PIN code (or enter manually)"
                                    maxLength={100}
                                  />
                                  <p className="text-xs text-slate-500 mt-1">{(editFormData.state || "").length} / 100</p>
                                </td>
                              </tr>

                              {/* City — editable so the user can fill manually if PIN lookup fails (CORS / network). */}
                              <tr>
                                <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">
                                  City
                                </td>
                                <td className="px-4 py-3 bg-white">
                                  <input
                                    type="text"
                                    value={editFormData.city || ""}
                                    onChange={(e) => handleEditInputChange("city", e.target.value, 100)}
                                    className="w-full px-3 py-2 rounded-lg border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white outline-none transition-all text-sm"
                                    placeholder="Auto-filled from PIN code (or enter manually)"
                                    maxLength={100}
                                  />
                                  <p className="text-xs text-slate-500 mt-1">{(editFormData.city || "").length} / 100</p>
                                </td>
                              </tr>

                              {/* Site Address */}
                              <tr>
                                <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">
                                  Site Address <span className="text-red-500">*</span>
                                </td>
                                <td className="px-4 py-3 bg-white">
                                  <textarea
                                    value={editFormData.siteAddress}
                                    onChange={(e) => handleEditInputChange("siteAddress", e.target.value, 1000)}
                                    className={`w-full px-3 py-2 rounded-lg border-2 transition-all text-sm ${editErrors.siteAddress
                                      ? "border-red-300 bg-red-50/50 focus:border-red-500"
                                      : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                      } outline-none resize-none`}
                                    rows={3}
                                    required
                                    maxLength={1000}
                                  />
                                  {editErrors.siteAddress && (
                                    <p className="text-xs text-red-600 mt-1">{editErrors.siteAddress}</p>
                                  )}
                                  <p className="text-xs text-slate-500 mt-1">{editFormData.siteAddress.length} / 1000</p>
                                </td>
                              </tr>

                              {/* Comments */}
                              <tr>
                                <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">
                                  Comments
                                </td>
                                <td className="px-4 py-3 bg-white">
                                  <textarea
                                    value={editFormData.comments}
                                    onChange={(e) => handleEditInputChange("comments", e.target.value, 500)}
                                    className="w-full px-3 py-2 rounded-lg border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all resize-none text-sm"
                                    rows={4}
                                  />
                                  <p className="text-xs text-slate-500 mt-1">{editFormData.comments.length} / 500</p>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex justify-end gap-4 pt-6 mt-6 border-t border-slate-200 sticky bottom-0 bg-white -mx-8 px-8 pb-6">
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            disabled={editLoading}
                            className="px-6 py-3 rounded-lg border-2 border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 hover:border-slate-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            <X className="w-4 h-4" />
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={editLoading}
                            className="px-6 py-3 rounded-lg bg-gradient-to-r btn-brand-gradient text-white font-semibold  transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            <Save className="w-4 h-4" />
                            {editLoading ? "Updating..." : "Update Site"}
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

      <SiteAssignUsersModal
        open={Boolean(siteAssignModal)}
        onClose={() => setSiteAssignModal(null)}
        studyId={siteAssignModal?.studyId}
        siteId={siteAssignModal?.siteId}
        siteLabel={siteAssignModal?.siteLabel}
        studyLabel={siteAssignModal?.studyLabel}
        onAssigned={() => {
          if (activeTab === "manage") fetchSites()
        }}
      />
    </DashboardLayout>
  )
}