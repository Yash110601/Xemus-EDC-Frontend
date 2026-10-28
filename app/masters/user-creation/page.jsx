"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import DashboardLayout from "@/components/dashboard-layout"
import DataPagination from "@/components/ui/data-pagination"
import SectionSkeleton from "@/components/ui/section-skeleton"
import AssignUserModal from "@/components/assign-user-modal"
import { Eye, EyeOff, User, Mail, Phone, Edit, FilePen, X, Loader2, Plus, Trash2, Delete, Upload, Download, CheckCircle, RotateCw, UserPlus, Copy, Check, Hash, Filter, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import SearchableSelect from "@/components/ui/searchable-select"
import {
  userService,
  rolesService,
  studyUserService,
  siteService,
  studyService,
  authService,
  studyPaymentRuleService,
  visitScheduleService,
} from "@/lib/services"
import { isValidEmail } from "@/lib/utils/emailValidation"
import { toast as toastCustom } from "@/hooks/use-toast"
import { getMaxSitesPerStudyForRole, validateSiteSelectionForRole } from "@/lib/permissions/studySiteAssignmentRules"
import {
  clearStudySettingsCache,
  fetchStudySettingsByStudyId,
  pickIsSitePaymentEnabled,
} from "@/lib/utils/studySettingsRead"
import { readSystemSiteSettingsOverlay, resolveSystemSiteModeForStudy } from "@/lib/utils/systemSiteSettingsOverlay"
import { ensureSystemSitesForStudy } from "@/lib/utils/systemSiteProvision"
import {
  USER_MASTER_ALERT_ERROR_CLASS,
  USER_MASTER_ALERT_SUCCESS_CLASS,
  USER_MASTER_ACTIONS_CLASS,
  USER_MASTER_BTN_CLEAR_CLASS,
  USER_MASTER_BTN_SUBMIT_CLASS,
  USER_MASTER_CARD_CLASS,
  USER_MASTER_FORM_GRID_CLASS,
  USER_MASTER_FORM_HINT_CLASS,
  USER_MASTER_FORM_INPUT_CLASS,
  USER_MASTER_FORM_LABEL_CLASS,
  USER_MASTER_FORM_SELECT_CLASS,
  USER_MASTER_PAGE_CANVAS_CLASS,
  USER_MASTER_PANEL_CLASS,
  USER_MASTER_TAB_ACTIVE_BAR_CLASS,
  USER_MASTER_TAB_BAR_CLASS,
  USER_MASTER_MANAGE_CRC_TABLE_CLASS,
  USER_MASTER_MANAGE_USERS_TABLE_CLASS,
  USER_MASTER_TABLE_SCROLL_CLASS,
  USER_MASTER_TABLE_HINT_CLASS,
  userMasterTabClass,
} from "@/lib/masters/userCreationFormUi"
import { MODAL_SCROLL_BODY_CLASS } from "@/lib/ui/responsivePageUi"
import { cn } from "@/lib/utils"
import {
  STUDY_USER_IMPORT_BATCH_SIZE,
  STUDY_USER_IMPORT_MAX_DATA_ROWS,
  applyFailedRowsToImportPreview,
} from "@/lib/masters/studyUserCsvImport"
import { downloadStudyUserCredentialsCsv } from "@/lib/masters/studyUserImportCredentialsExport"
import {
  assignSystemSiteForImportRow,
  assignSystemSiteForSingleEntry,
  downloadSystemSiteStudyUserTemplateCsv,
  extractStudyUserCount,
  extractStudyUsersList,
  injectSiteIdsIntoStudyUserCsv,
  normalizeAssignedSitesList,
  normalizeSitesList,
  pickNextAvailableSystemSite,
  pickSystemSitesForImport,
  resolveImportStudyType,
  resolveSiteIdFromNameOrCode,
  stripPaymentColumnsFromStudyUserCsv,
  stripSiteColumnsFromStudyUserCsv,
} from "@/lib/masters/systemSiteStudyUserTemplate"
import {
  formatHonorariumAmount,
  normalizeUserStudyAssignments,
  studyTypeToLabel,
} from "@/lib/masters/userStudyAssignments"
import { useStudyUserImportJobs } from "@/context/StudyUserImportJobsContext"
import CreatedUserCredentialsModal from "@/components/masters/created-user-credentials-modal"
import { extractGeneratedPassword, isSuperAdminUser } from "@/lib/utils/createdUserCredentials"
import { fetchAllVisitSchedulesForStudy } from "@/lib/utils/visitScheduleList"
import {
  hasActivePaymentRules,
  milestoneLabelSuffix,
} from "@/lib/masters/studyPaymentRuleMilestoneLabels"

const INDIA_PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/

function getSiteRecordId(site) {
  const id = site?.id ?? site?.siteId ?? site?.SiteId
  return id != null && String(id).trim() !== "" ? String(id) : ""
}

function isValidSiteIdForSubmit(siteId) {
  const numeric = Number.parseInt(String(siteId ?? ""), 10)
  return Number.isFinite(numeric) && numeric > 0
}
const normalizePanInput = (value = "") => value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10)
const isValidIndianPan = (value = "") => INDIA_PAN_REGEX.test(normalizePanInput(value))
const getPanInlineError = (value = "") => {
  const normalized = normalizePanInput(value)
  if (!normalized) return ""
  if (!isValidIndianPan(normalized)) return "Enter valid PAN format: ABCDE1234F"
  return ""
}

export default function UserCreationPage() {
  const [activeTab, setActiveTab] = useState("create")
  const [doctorUserType, setDoctorUserType] = useState("normal") // normal, milestonePatient, milestoneVisit
  const [formData, setFormData] = useState({
    username: "",
    firstName: "",
    lastName: "",
    employeeNo: "",
    email: "",
    phoneNumber: "",
    roleGuid: "",
    roleName: "",
    isTestAccount: false,
  })

  // Available roles for selection

  const [availableRoles, setAvailableRoles] = useState([])
  const [loadingRoles, setLoadingRoles] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // Manage Users State (application users)
  const [users, setUsers] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [editingUser, setEditingUser] = useState(null)

  // Pagination state for Manage Users
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  // Manage CRC Users State (StudyUsers grid)
  const [crcUsers, setCrcUsers] = useState([])
  const [crcSearchQuery, setCrcSearchQuery] = useState("")
  const [crcLoadingUsers, setCrcLoadingUsers] = useState(false)
  const [crcPageNumber, setCrcPageNumber] = useState(1)
  const [crcPageSize, setCrcPageSize] = useState(10)
  const [crcTotalPages, setCrcTotalPages] = useState(0)
  const [crcTotalCount, setCrcTotalCount] = useState(0)
  const [crcFilterStudyId, setCrcFilterStudyId] = useState("")
  const [crcFilterStatus, setCrcFilterStatus] = useState("all") // all | active | inactive
  const [crcFilterStudies, setCrcFilterStudies] = useState([])
  const [crcFilterStudySearchInput, setCrcFilterStudySearchInput] = useState("") // Search inside Study dropdown panel only
  const [crcStatusConfirm, setCrcStatusConfirm] = useState(null) // { id, isActive, name }
  const [editFormData, setEditFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    roleGuid: "",
    roleName: "",
    isActive: true,
  })
  const [updatingStatus, setUpdatingStatus] = useState({})
  const [deletingUser, setDeletingUser] = useState(null)
  const [deleteConfirmUser, setDeleteConfirmUser] = useState(null) // { id, userName } for custom delete modal
  const [resetPasswordConfirmUser, setResetPasswordConfirmUser] = useState(null) // { id, userName } for reset password modal
  const [resettingPassword, setResettingPassword] = useState(null)
  const [assigningUser, setAssigningUser] = useState(null)
  const [editLoading, setEditLoading] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [copiedItem, setCopiedItem] = useState(null) // Track what was copied (email or phone)
  const [assignFormData, setAssignFormData] = useState({
    userId: null,
    studyId: "",
    siteId: "",
    siteIds: [], // For multiple site selection (CRM role)
  })
  const [assigningUserRole, setAssigningUserRole] = useState("") // Store user's role for conditional UI
  const [assigningUserRoleGuid, setAssigningUserRoleGuid] = useState("")
  const [selectedAssignments, setSelectedAssignments] = useState({}) // For checkbox component: {studyId: {selected: boolean, sites: {siteId: boolean}}}
  const [assignSearchQuery, setAssignSearchQuery] = useState("") // Search query for assign modal
  // Edit Study User (assignment details) - for Manage Users > Edit
  const [userAssignments, setUserAssignments] = useState([]) // StudyUser assignments for user being edited
  const [userAssignmentsLoading, setUserAssignmentsLoading] = useState(false)
  const [editingStudyUser, setEditingStudyUser] = useState(null) // { id, studyId, siteId, studyName?, siteName? } when modal open
  const [studyUserEditForm, setStudyUserEditForm] = useState(null) // Form data for UpdateStudyUser modal
  const [studyUserEditLoading, setStudyUserEditLoading] = useState(false)
  /**
   * Modal-scoped validation/save error for the "Edit user details (study/site)" modal.
   * Kept separate from the page-level `error` so the banner renders INSIDE the modal
   * (above the action row), instead of leaking onto the underlying CRC users page
   * where it would be hidden by the modal backdrop and stay stale after close.
   */
  const [studyUserEditError, setStudyUserEditError] = useState("")
  // State for doctor form dropdowns (still used in doctor form section)
  const [selectedStudyDisplayName, setSelectedStudyDisplayName] = useState("")
  const [studySearchInput, setStudySearchInput] = useState("")
  const [isStudyDropdownOpen, setIsStudyDropdownOpen] = useState(false)
  const [siteSearchInput, setSiteSearchInput] = useState("")
  const [isSiteDropdownOpen, setIsSiteDropdownOpen] = useState(false)

  // Doctor/CRC User Creation State
  const [doctorFormData, setDoctorFormData] = useState({
    doctorName: "",
    MicrCode: "",
    address: "",
    pinCode: "",
    sapVendorCode: "",
    emailId: "",
    mobileNo: "",
    pan: "",
    noOfPlannedPatients: "",
    totalPaymentAmount: "",
    region: "",
    division: "",
    area: "",
    hq: "",
    zone: "",
    speciality: "",
    studyId: "", // Single study selection
    siteId: "", // Single site selection
    City: "",
    State: "",
    GstNo: "",
    numberOfMilestones: 1, // For patient-wise milestone
    milestones: [], // For patient-wise milestone
    visitAmounts: [], // For visit-wise milestone
    isTestAccount: false,
  })
  const [studies, setStudies] = useState([])
  const [allStudies, setAllStudies] = useState([]) // Store all studies
  const [loadingStudies, setLoadingStudies] = useState(false)
  const [cachedStudiesList, setCachedStudiesList] = useState([]) // Cached studies list (same for all users)
  const [assignModalStudies, setAssignModalStudies] = useState([]) // Studies for assign modal (with sites and assignment status)
  const [sites, setSites] = useState([])
  const [loadingSites, setLoadingSites] = useState(false)
  const [doctorSystemSitesAutoAssign, setDoctorSystemSitesAutoAssign] = useState(false)
  const [doctorAutoSiteLabel, setDoctorAutoSiteLabel] = useState("")
  const [doctorSystemSiteCapacity, setDoctorSystemSiteCapacity] = useState({ used: 0, total: 0 })
  const [doctorLoading, setDoctorLoading] = useState(false)
  const [doctorError, setDoctorError] = useState("")
  const [doctorSuccess, setDoctorSuccess] = useState("")
  const [doctorStudyPaymentRules, setDoctorStudyPaymentRules] = useState({ rules: [], visitSchedules: [] })
  const [editStudyPaymentRules, setEditStudyPaymentRules] = useState({ rules: [], visitSchedules: [] })
  const [doctorSitePaymentEnabled, setDoctorSitePaymentEnabled] = useState(true)
  const [studyUserEditSitePaymentEnabled, setStudyUserEditSitePaymentEnabled] = useState(true)
  const [studySitePaymentMap, setStudySitePaymentMap] = useState({})
  const [importMode, setImportMode] = useState(false) // false = single, true = import
  const [importedData, setImportedData] = useState([])
  const [importFile, setImportFile] = useState(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importPreview, setImportPreview] = useState([])
  const [missingColumns, setMissingColumns] = useState([])
  const [csvUploadKey, setCsvUploadKey] = useState(0) // key to reset file input on Clear
  const [defaultStudyType, setDefaultStudyType] = useState("normal")
  const [defaultStudyId, setDefaultStudyId] = useState("")
  const [defaultStudySystemSitesEnabled, setDefaultStudySystemSitesEnabled] = useState(false)
  const [defaultStudySitePaymentEnabled, setDefaultStudySitePaymentEnabled] = useState(true)
  const { startStudyUserImport, hasRunningImport } = useStudyUserImportJobs()
  const [loadingLocation, setLoadingLocation] = useState(false)
  const [createdCredentials, setCreatedCredentials] = useState(null)
  const [importCredentials, setImportCredentials] = useState([])
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  useEffect(() => {
    setIsSuperAdmin(isSuperAdminUser(authService.getUser()))
  }, [])

  // Fetch roles from API on component mount
  useEffect(() => {
    const fetchRoles = async () => {
      setLoadingRoles(true)
      try {
        const response = await rolesService.getRolesDropdown()
        if ((response.isSuccess || response.success) && response.data && Array.isArray(response.data)) {
          // Extract name property from each role object
          const roles = response.data;
          setAvailableRoles(roles);
        }
      } catch (error) {
        // Error fetching roles
      } finally {
        setLoadingRoles(false)
      }
    }

    fetchRoles()
  }, [])

  // Dropdown roles: backend returns all roles, but UI may hide restricted roles by actor.
  // Backend still must enforce permissions/validation on submit.
  const filteredRoles = useMemo(() => {
    if (!Array.isArray(availableRoles)) return []
    const hiddenRoleNames = new Set()
    const currentUser = authService.getUser()
    const currentRoleNormalized = (currentUser?.roleName || "")
      .toString()
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "")
    const isCurrentUserSuperAdmin = currentRoleNormalized === "SUPERADMIN"
    const isCurrentUserAdmin = currentRoleNormalized === "ADMIN"

    // In this dropdown, keep CRC hidden for everyone.
    hiddenRoleNames.add("CRC")
    // CRA should be visible only for Super Admin.
    if (!isCurrentUserSuperAdmin) hiddenRoleNames.add("CRA")

    if (isCurrentUserAdmin) {
      hiddenRoleNames.add("ADMIN")
      hiddenRoleNames.add("SUPERADMIN")
      hiddenRoleNames.add("PRINCIPALINVESTIGATOR")
      hiddenRoleNames.add("INVESTIGATOR")
      hiddenRoleNames.add("PROJECTMANAGER")
    }

    return availableRoles.filter((role) => {
      const roleName = (role?.name || "")
        .toString()
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "")
      return roleName && !hiddenRoleNames.has(roleName)
    })
  }, [availableRoles])

  // Only Super Admin can change user role in Edit User

  // Memoized filtered studies for search dropdown (for assign modal)
  const filteredStudiesForSearch = useMemo(() => {
    const studiesToFilter = showAssignModal ? assignModalStudies : studies
    if (!studySearchInput) return studiesToFilter
    const searchLower = studySearchInput.toLowerCase()
    return studiesToFilter.filter(study => {
      const protocolNumber = (study.studyProtocolNumber || "").toLowerCase()
      const title = (study.studyTitle || "").toLowerCase()
      return protocolNumber.includes(searchLower) || title.includes(searchLower)
    })
  }, [studies, assignModalStudies, studySearchInput, showAssignModal])

  // Memoized filtered sites for search dropdown
  const filteredSitesForSearch = useMemo(() => {
    if (!siteSearchInput) return sites
    const searchLower = siteSearchInput.toLowerCase()
    return sites.filter(site => {
      const siteName = (site.siteName || "").toLowerCase()
      const siteFullName = (site.siteFullName || "").toLowerCase()
      return siteName.includes(searchLower) || siteFullName.includes(searchLower)
    })
  }, [sites, siteSearchInput])

  // State for studies in import mode (filtered by defaultStudyType)
  const [importModeStudies, setImportModeStudies] = useState([])

  // Memoized filtered studies for default study dropdown based on study type
  const filteredStudiesForDefault = useMemo(() => {
    // In import mode, use importModeStudies if available, otherwise use studies
    if (importMode && importModeStudies.length > 0) {
      return importModeStudies
    }
    // Fallback to studies or allStudies
    return studies.length > 0 ? studies : (allStudies.length > 0 ? allStudies : [])
  }, [importMode, importModeStudies, studies, allStudies])

  // Handler for page size changes (Manage Users)
  const handlePageSizeChange = useCallback((newPageSize) => {
    setPageSize(newPageSize)
    setPageNumber(1) // Reset to first page when page size changes
  }, [])

  // Handler for page size changes (CRC Users)
  const handleCrcPageSizeChange = useCallback((newPageSize) => {
    setCrcPageSize(newPageSize)
    setCrcPageNumber(1)
  }, [])

  // Debounce search query (Manage Users)
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Debounce search query (CRC Users)
  const [crcDebouncedSearchQuery, setCrcDebouncedSearchQuery] = useState(crcSearchQuery)

  useEffect(() => {
    const timer = setTimeout(() => {
      setCrcDebouncedSearchQuery(crcSearchQuery)
    }, 500)
    return () => clearTimeout(timer)
  }, [crcSearchQuery])

  // Reset to page 1 when search query changes
  useEffect(() => {
    if (activeTab === "manage") {
      setPageNumber(1)
    }
  }, [debouncedSearchQuery, activeTab])

  useEffect(() => {
    if (activeTab === "crcManage") {
      setCrcPageNumber(1)
    }
  }, [crcDebouncedSearchQuery, activeTab, crcFilterStudyId, crcFilterStatus])

  // Fetch users from backend API
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true)
    try {
      const response = await userService.getAllUsers(pageNumber, pageSize, debouncedSearchQuery)
      if (response.isSuccess && response.data) {
        // API returns { items, pageNumber, pageSize, totalCount, totalPages }
        const data = response.data
        const usersList = Array.isArray(data)
          ? data
          : (data.items || data.Items || [])
        setUsers(usersList)

        // Update pagination metadata
        if (data && typeof data === "object" && !Array.isArray(data)) {
          setTotalCount(data.totalCount || data.TotalCount || 0)
          setTotalPages(data.totalPages || data.TotalPages || 0)
        }
      } else {
        setUsers([])
        setTotalCount(0)
        setTotalPages(0)
        setError(response.message || "Failed to fetch users")
        setTimeout(() => setError(""), 3000)
      }
    } catch (error) {
      setUsers([])
      setTotalCount(0)
      setTotalPages(0)
      setError("An error occurred while fetching users")
      setTimeout(() => setError(""), 3000)
    } finally {
      setLoadingUsers(false)
    }
  }, [pageNumber, pageSize, debouncedSearchQuery])

  // Fetch CRC (Study) users from backend API
  const fetchCrcUsers = useCallback(async () => {
    setCrcLoadingUsers(true)
    try {
      const studyIdParam =
        crcFilterStudyId && crcFilterStudyId !== "all"
          ? parseInt(crcFilterStudyId, 10)
          : null
      let isActiveParam = null
      if (crcFilterStatus === "active") isActiveParam = true
      if (crcFilterStatus === "inactive") isActiveParam = false

      const response = await studyUserService.getPagedStudyUsers(
        crcPageNumber,
        crcPageSize,
        crcDebouncedSearchQuery || "",
        studyIdParam,
        null,
        isActiveParam
      )

      if ((response.isSuccess || response.success) && response.data) {
        const data = response.data
        const list = Array.isArray(data)
          ? data
          : (data.items || data.Items || data.studyUsers || data.StudyUsers || data.list || data.List || [])

        setCrcUsers(list || [])

        if (data && typeof data === "object" && !Array.isArray(data)) {
          setCrcTotalCount(data.totalCount || data.TotalCount || list.length || 0)
          setCrcTotalPages(data.totalPages || data.TotalPages || 0)
        } else {
          setCrcTotalCount(list.length || 0)
          setCrcTotalPages(1)
        }
      } else {
        setCrcUsers([])
        setCrcTotalCount(0)
        setCrcTotalPages(0)
        setError(response.message || "Failed to fetch CRC users")
        setTimeout(() => setError(""), 3000)
      }
    } catch (error) {
      setCrcUsers([])
      setCrcTotalCount(0)
      setCrcTotalPages(0)
      setError("An error occurred while fetching CRC users")
      setTimeout(() => setError(""), 3000)
    } finally {
      setCrcLoadingUsers(false)
    }
  }, [crcPageNumber, crcPageSize, crcDebouncedSearchQuery, crcFilterStudyId, crcFilterStatus])

  const refreshStudySitePaymentFlags = useCallback(async (studyIds) => {
    const ids = [...new Set((studyIds || []).map((id) => String(id)).filter(Boolean))]
    if (!ids.length) return
    const entries = await Promise.all(
      ids.map(async (id) => {
        try {
          const res = await fetchStudySettingsByStudyId(id, { preferFullEndpoint: true })
          return [id, pickIsSitePaymentEnabled(res?.data ?? res)]
        } catch {
          return [id, true]
        }
      }),
    )
    setStudySitePaymentMap((prev) => ({ ...prev, ...Object.fromEntries(entries) }))
  }, [])

  useEffect(() => {
    const ids = crcUsers.map((u) => u.studyId ?? u.StudyId).filter(Boolean)
    if (ids.length) void refreshStudySitePaymentFlags(ids)
  }, [crcUsers, refreshStudySitePaymentFlags])

  const showCrcHonorariumColumn = useMemo(() => {
    if (crcFilterStudyId && crcFilterStudyId !== "all") {
      return studySitePaymentMap[String(crcFilterStudyId)] !== false
    }
    return crcUsers.some((u) => {
      const sid = String(u.studyId ?? u.StudyId ?? "")
      if (!sid) return true
      return studySitePaymentMap[sid] !== false
    })
  }, [crcUsers, crcFilterStudyId, studySitePaymentMap])

  // Fetch studies for CRC filter dropdown (once)
  const fetchCrcFilterStudies = useCallback(async () => {
    try {
      const response = await studyService.getStudiesForDropdown()
      if (response?.isSuccess && response?.data) {
        const data = response.data
        const list = Array.isArray(data) ? data : (data.items || data.Items || [])
        setCrcFilterStudies(list || [])
      }
    } catch (error) {
      console.error("Error fetching studies for CRC filter:", error)
    }
  }, [])

  // Fetch and cache studies list (same for all users) - called once
  const fetchAndCacheStudiesList = useCallback(async () => {
    // If already cached, don't fetch again
    if (cachedStudiesList.length > 0) {
      return
    }

    setLoadingStudies(true)
    try {
      // Fetch all accessible studies with sites (without assignment status)
      // API: GET /api/Studies/GetAccessibleStudiesWithSites?filter=1 (Active studies)
      const response = await studyService.getAccessibleStudiesWithSites(1)
      
      if (response?.isSuccess && response?.data) {
        const data = response.data
        const list = Array.isArray(data)
          ? data
          : (data?.items || data?.Items || [])
        // Cache the studies list (same for all users)
        setCachedStudiesList(list)
      }
    } catch (error) {
      console.error("Error fetching and caching studies list:", error)
    } finally {
      setLoadingStudies(false)
    }
  }, [cachedStudiesList.length])

  // Fetch users when switching to manage tab, page changes, or search changes
  useEffect(() => {
    if (activeTab === "manage") {
      fetchUsers()
    }
  }, [activeTab, fetchUsers])

  // Fetch CRC users when switching to CRC manage tab, page changes, or search changes
  useEffect(() => {
    if (activeTab === "crcManage") {
      fetchCrcUsers()
      if (crcFilterStudies.length === 0) {
        fetchCrcFilterStudies()
      }
    }
  }, [activeTab, fetchCrcUsers, crcFilterStudies.length, fetchCrcFilterStudies])

  // Fetch and cache studies list once when component mounts or when assign modal might be used
  useEffect(() => {
    // Pre-fetch studies list so it's ready when user opens assign modal
    if (cachedStudiesList.length === 0) {
      fetchAndCacheStudiesList()
    }
  }, [cachedStudiesList.length, fetchAndCacheStudiesList]) // Run once on mount or when cache is empty

  const resolveAutoSystemSiteForStudy = useCallback(async (studyId) => {
    const numericId = Number.parseInt(String(studyId ?? ""), 10)
    if (!Number.isFinite(numericId) || numericId <= 0) return null

    const settingsRes = await fetchStudySettingsByStudyId(numericId, {
      preferFullEndpoint: true,
      forceRefresh: true,
    })
    const settingsData = settingsRes?.data ?? {}
    let siteMode = resolveSystemSiteModeForStudy(numericId, settingsData)

    const overlay = readSystemSiteSettingsOverlay(numericId)
    if ((!siteMode.enabled || !siteMode.autoAssign) && overlay?.isSystemSiteCreationEnabled === true) {
      siteMode = {
        enabled: true,
        autoAssign: !Boolean(overlay.isSystemSiteNamingCustomizable),
        namingCustomizable: Boolean(overlay.isSystemSiteNamingCustomizable),
        prefix: String(overlay.systemSiteNamePrefix || "s-").trim() || "s-",
        siteCount: Math.max(0, Number.parseInt(String(overlay.systemSiteCount ?? ""), 10) || 0),
      }
    }

    if (!siteMode.enabled || !siteMode.autoAssign) return null

    const prefix = siteMode.prefix || "s-"
    const configuredSiteCount =
      siteMode.siteCount > 0 ? siteMode.siteCount : siteMode.enabled ? 10 : 0

    const selectedStudy =
      studies.find((s) => String(s.studyId) === String(numericId)) ||
      allStudies.find((s) => String(s.studyId) === String(numericId))
    const studyProtocolNumber =
      selectedStudy?.studyProtocolNumber || selectedStudy?.protocolNumber || ""

    let sitesRes = await siteService.getSitesByStudy(numericId)
    let sitesList = normalizeSitesList(sitesRes)

    const usersRes = await studyUserService.getStudyUsersByStudy(numericId)
    const orderedBefore = pickSystemSitesForImport(sitesList, prefix)
    const systemSiteIds = new Set(
      orderedBefore.map((site) => getSiteRecordId(site)).filter(Boolean),
    )
    const usersOnSystemSites = extractStudyUsersList(usersRes?.data).filter((user) =>
      systemSiteIds.has(String(user?.siteId ?? user?.SiteId ?? "")),
    )

    const assignedRes = await studyUserService.getAssignedSitesWithUsersForStudy(numericId)
    const assignedEntries = normalizeAssignedSitesList(assignedRes)
    let result = pickNextAvailableSystemSite(sitesList, assignedEntries, prefix)

    if (!result.siteId) {
      const nextIndex = usersOnSystemSites.length + 1
      if (nextIndex > configuredSiteCount) {
        return {
          siteId: "",
          siteName: "",
          availableCount: configuredSiteCount,
          usedCount: usersOnSystemSites.length,
          allSites: [],
          prefix,
          lastError: "",
        }
      }

      const { sitesList: provisionedList, lastError } = await ensureSystemSitesForStudy(siteService, {
        studyId: numericId,
        siteCount: configuredSiteCount,
        provisionUpTo: nextIndex,
        prefix,
        isNamingCustomizable: siteMode.namingCustomizable,
        studyProtocolNumber,
        studyService,
      })
      sitesList = provisionedList
      result = pickNextAvailableSystemSite(sitesList, assignedEntries, prefix)

      if (!result.siteId) {
        const assignment = assignSystemSiteForSingleEntry(
          sitesList,
          usersOnSystemSites.length,
          prefix,
        )
        result = {
          siteId: assignment.siteId,
          siteName: assignment.siteName,
          allSites: pickSystemSitesForImport(sitesList, prefix).map((site, index) => {
            const siteId = getSiteRecordId(site)
            const siteName = String(
              site?.siteName ??
                site?.SiteName ??
                site?.siteFullName ??
                site?.SiteFullName ??
                siteId,
            )
            return {
              siteId,
              siteName,
              occupied: index < usersOnSystemSites.length,
              isNext: index === usersOnSystemSites.length,
            }
          }),
          availableCount: configuredSiteCount,
          usedCount: usersOnSystemSites.length,
        }
        return { ...result, prefix, lastError }
      }

      return { ...result, prefix, lastError }
    }

    return {
      ...result,
      availableCount: configuredSiteCount,
      usedCount: usersOnSystemSites.length,
      prefix,
      lastError: "",
    }
  }, [studies, allStudies])

  const resetCreateUserForm = useCallback(() => {
    setFormData({
      username: "",
      firstName: "",
      lastName: "",
      employeeNo: "",
      email: "",
      phoneNumber: "",
      roleName: "",
      roleGuid: "",
      isTestAccount: false,
    })
  }, [])

  // Fetch studies for assign modal - merge cached studies with assignment status for specific user
  const fetchStudiesForAssign = async (userId, userRoleForAssign = "", userRoleGuidForAssign = "") => {
    if (!userId) {
      console.error("User ID is required to fetch study site assignments")
      setAssignModalStudies([])
      setSelectedAssignments({})
      return
    }

    setLoadingStudies(true)
    try {
      // First, ensure we have cached studies list
      if (cachedStudiesList.length === 0) {
        await fetchAndCacheStudiesList()
      }

      // Fetch assignment status for this specific user
      // API: GET /api/Studies/GetAccessibleStudiesWithSitesAndAssignments?targetUserId={userId}
      const response = await studyService.getAccessibleStudiesWithSitesAndAssignments(userId)
      
      // Handle response structure: { success: true, message: "...", data: [...] }
      if (response?.isSuccess || response?.success) {
        const assignmentData = response.data
        // API returns: [{ id, studyProtocolNumber, isAlreadyAssigned, sites: [{ id, siteName, isAlreadyAssigned }] }]
        const assignmentList = Array.isArray(assignmentData)
          ? assignmentData
          : (assignmentData?.items || assignmentData?.Items || [])
        
        // Create a map of assignment status by study ID and site ID for quick lookup
        const assignmentMap = new Map()
        assignmentList.forEach((study) => {
          const studyId = String(study.id || study.studyId)
          const siteMap = new Map()
          if (study.sites && Array.isArray(study.sites)) {
            study.sites.forEach((site) => {
              const siteId = String(site.id || site.siteId)
              siteMap.set(siteId, {
                isAlreadyAssigned: site.isAlreadyAssigned === true || site.isAssigned === true || site.IsAlreadyAssigned === true,
                roleGuid: site.roleGuid ?? site.RoleGuid ?? study.roleGuid ?? study.RoleGuid ?? null,
                roleName: site.roleName ?? site.RoleName ?? study.roleName ?? study.RoleName ?? null,
              })
            })
          }
          assignmentMap.set(studyId, {
            isAlreadyAssigned: study.isAlreadyAssigned === true || study.isAssigned === true || study.IsAlreadyAssigned === true,
            roleGuid: study.roleGuid ?? study.RoleGuid ?? null,
            roleName: study.roleName ?? study.RoleName ?? null,
            sites: siteMap,
          })
        })

        // Merge cached studies list with assignment status
        const mergedList = cachedStudiesList.map((study) => {
          const studyId = String(study.id || study.studyId)
          const assignment = assignmentMap.get(studyId)
          
          // Merge study with assignment status
          const mergedStudy = {
            ...study,
            isAlreadyAssigned: assignment?.isAlreadyAssigned || false,
            assignmentRoleGuid: assignment?.roleGuid ?? null,
            assignmentRoleName: assignment?.roleName ?? null,
          }

          // Merge sites with assignment status
          if (study.sites && Array.isArray(study.sites)) {
            mergedStudy.sites = study.sites.map((site) => {
              const siteId = String(site.id || site.siteId)
              const siteAssignment = assignment?.sites?.get(siteId)
              return {
                ...site,
                isAlreadyAssigned: siteAssignment?.isAlreadyAssigned || false
              }
            })
          }

          return mergedStudy
        })

        setAssignModalStudies(mergedList)
        
        // Auto-populate selectedAssignments for items where isAlreadyAssigned: true
        // CRC: one site per study (pre-select only first assigned). Other roles: pre-select all assigned sites.
        const isCrc = (userRoleForAssign || "").toLowerCase().includes("crc")
        const initialAssignments = {}
        mergedList.forEach((study) => {
          const studyId = String(study.id || study.studyId)
          const sitesObj = {}
          const assignment = assignmentMap.get(studyId)

          if (study.sites && Array.isArray(study.sites)) {
            study.sites.forEach((site) => {
              const siteId = String(site.id || site.siteId)
              if (site.isAlreadyAssigned === true || site.isAssigned === true || site.IsAlreadyAssigned === true) {
                sitesObj[siteId] = true
              }
            })
            // CRC only: keep only the first assigned site per study
            if (isCrc && Object.keys(sitesObj).length > 1) {
              const firstKey = Object.keys(sitesObj)[0]
              Object.keys(sitesObj).forEach(k => { if (k !== firstKey) delete sitesObj[k] })
            }
          }

          const isStudyAssigned = study.isAlreadyAssigned === true || study.isAssigned === true || study.IsAlreadyAssigned === true
          if (isStudyAssigned || Object.keys(sitesObj).length > 0) {
            const fallbackRoleGuid =
              userRoleGuidForAssign ||
              String(assignment?.roleGuid ?? "").trim() ||
              String(
                availableRoles.find(
                  (r) =>
                    String(r.name ?? r.roleName ?? "")
                      .trim()
                      .toLowerCase() === String(userRoleForAssign ?? "").trim().toLowerCase(),
                )?.guid ??
                  availableRoles.find(
                    (r) =>
                      String(r.name ?? r.roleName ?? "")
                        .trim()
                        .toLowerCase() === String(userRoleForAssign ?? "").trim().toLowerCase(),
                  )?.roleGuid ??
                  "",
              ).trim()
            initialAssignments[studyId] = {
              selected: true,
              sites: sitesObj,
              roleGuid: fallbackRoleGuid,
              roleName: assignment?.roleName ?? userRoleForAssign ?? "",
            }
          }
        })
        // Set the initial assignments - this will auto-check the checkboxes
        console.log("Auto-checking assignments:", initialAssignments)
        setSelectedAssignments(initialAssignments)
      } else {
        // Handle error responses - use cached list without assignment status
        if (response?.statusCode === 404) {
          // User not found - use cached list without assignment status
          setAssignModalStudies(cachedStudiesList)
          setSelectedAssignments({})
        } else {
          // On error, use cached list without assignment status
          setAssignModalStudies(cachedStudiesList)
          setSelectedAssignments({})
          console.error("Error fetching study site assignments:", response?.message || "Unknown error")
        }
      }
    } catch (error) {
      console.error("Error fetching studies for assign:", error)
      // On error, use cached list without assignment status
      setAssignModalStudies(cachedStudiesList)
      setSelectedAssignments({})
    } finally {
      setLoadingStudies(false)
    }
  }

  // Fetch studies with optional studyType filter
  const fetchStudies = async (studyTypeFilter = null) => {
    setLoadingStudies(true)
    try {
      // Map doctorUserType to studyType enum value
      // StudyType enum: Normal = 1, Milestone = 2, Visit = 3
      let studyType = null
      if (studyTypeFilter === "normal") {
        studyType = 1 // Normal - fetch only Normal studies
      } else if (studyTypeFilter === "milestonePatient") {
        studyType = 2 // Milestone - fetch only Milestone studies
      } else if (studyTypeFilter === "milestoneVisit") {
        studyType = 3 // Visit - fetch only Visit studies
      }
      // If studyTypeFilter is null, fetch all studies (studyType = null)
      
      const response = await studyService.getStudiesForDropdown(studyType)
      if (response?.isSuccess && response?.data) {
        const data = response.data
        const list = Array.isArray(data)
          ? data
          : (data.items || data.Items || [])
        setStudies(list) // Set filtered studies directly from backend
        
        // Store in allStudies when fetching all (studyType === null)
        if (studyType === null) {
          setAllStudies(list)
        }
      }
    } catch (error) {
      // Failed to fetch studies
      console.error("Error fetching studies:", error)
    } finally {
      setLoadingStudies(false)
    }
  }

  // Fetch studies when doctor tab is active or when study type changes
  useEffect(() => {
    if (activeTab === "doctor") {
      // Fetch studies based on current doctorUserType (default is "normal" which maps to studyType=1)
      fetchStudies(doctorUserType)
      // Clear selected studies when type changes
      handleDoctorInputChange("studyId", "")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorUserType, activeTab])

  // Memoize the combined study list to avoid dependency array issues
  const availableStudies = useMemo(() => {
    return Array.isArray(allStudies) && allStudies.length > 0 ? allStudies : (Array.isArray(studies) ? studies : [])
  }, [allStudies, studies])

  // Sync default study and study type from main form selection when in import mode
  useEffect(() => {
    if (importMode && doctorFormData.studyId) {
      // Find the selected study
      const selectedStudy = availableStudies.find(
        s => String(s.studyId) === String(doctorFormData.studyId)
      )
      
      if (selectedStudy) {
        // Set default study ID
        setDefaultStudyId(String(selectedStudy.studyId))
        
        // Determine study type from the study object or fallback to doctorUserType
        const studyType = selectedStudy.studyType || selectedStudy.study_type || selectedStudy.type || selectedStudy.StudyType
        if (studyType === 1 || studyType === "1" || studyType === "Normal") {
          setDefaultStudyType("normal")
        } else if (studyType === 2 || studyType === "2" || studyType === "Milestone") {
          setDefaultStudyType("milestonePatient")
        } else if (studyType === 3 || studyType === "3" || studyType === "Visit") {
          setDefaultStudyType("milestoneVisit")
        } else {
          // Fallback to doctorUserType if study type not found in study object
          setDefaultStudyType(doctorUserType || "normal")
        }
      }
    }
  }, [importMode, doctorFormData.studyId, doctorUserType, availableStudies])

  useEffect(() => {
    let cancelled = false
    const studyId = doctorFormData.studyId
    const isMilestoneType = doctorUserType === "milestonePatient" || doctorUserType === "milestoneVisit"
    if (!studyId || !isMilestoneType) {
      setDoctorStudyPaymentRules({ rules: [], visitSchedules: [] })
      return undefined
    }

    ;(async () => {
      const [rulesRes, visitSchedules] = await Promise.all([
        studyPaymentRuleService.listByStudy(studyId),
        fetchAllVisitSchedulesForStudy(studyId, visitScheduleService),
      ])
      if (cancelled) return
      setDoctorStudyPaymentRules({
        rules: rulesRes?.isSuccess && Array.isArray(rulesRes.data) ? rulesRes.data : [],
        visitSchedules: Array.isArray(visitSchedules) ? visitSchedules : [],
      })
    })()

    return () => {
      cancelled = true
    }
  }, [doctorFormData.studyId, doctorUserType])

  useEffect(() => {
    let cancelled = false
    const studyId = doctorFormData.studyId
    if (!studyId) {
      setDoctorSitePaymentEnabled(true)
      return undefined
    }

    ;(async () => {
      try {
        const settingsRes = await fetchStudySettingsByStudyId(studyId, {
          preferFullEndpoint: true,
          forceRefresh: true,
        })
        if (!cancelled) {
          setDoctorSitePaymentEnabled(pickIsSitePaymentEnabled(settingsRes?.data ?? settingsRes))
        }
      } catch {
        if (!cancelled) setDoctorSitePaymentEnabled(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [doctorFormData.studyId])

  useEffect(() => {
    let cancelled = false
    const studyId = studyUserEditForm?.studyId
    const isMilestoneType =
      studyUserEditForm?.studyType === "milestonePatient" ||
      studyUserEditForm?.studyType === "milestoneVisit"
    if (!editingStudyUser || !studyId || !isMilestoneType) {
      setEditStudyPaymentRules({ rules: [], visitSchedules: [] })
      return undefined
    }

    ;(async () => {
      const [rulesRes, visitSchedules] = await Promise.all([
        studyPaymentRuleService.listByStudy(studyId),
        fetchAllVisitSchedulesForStudy(studyId, visitScheduleService),
      ])
      if (cancelled) return
      setEditStudyPaymentRules({
        rules: rulesRes?.isSuccess && Array.isArray(rulesRes.data) ? rulesRes.data : [],
        visitSchedules: Array.isArray(visitSchedules) ? visitSchedules : [],
      })
    })()

    return () => {
      cancelled = true
    }
  }, [editingStudyUser, studyUserEditForm?.studyId, studyUserEditForm?.studyType])

  // Fetch studies for import mode based on defaultStudyType
  useEffect(() => {
    // Only run if in import mode
    if (!importMode) {
      return
    }

    // If no study type selected, clear studies
    if (!defaultStudyType) {
      setImportModeStudies([])
      return
    }

    // Fetch studies based on defaultStudyType
    const fetchImportStudies = async () => {
      setLoadingStudies(true)
      try {
        // Map defaultStudyType to studyType enum value
        let studyType = null
        if (defaultStudyType === "normal") {
          studyType = 1 // Normal
        } else if (defaultStudyType === "milestonePatient") {
          studyType = 2 // Milestone
        } else if (defaultStudyType === "milestoneVisit") {
          studyType = 3 // Visit
        }
        
        const response = await studyService.getStudiesForDropdown(studyType)
        if (response?.isSuccess && response?.data) {
          const data = response.data
          const list = Array.isArray(data)
            ? data
            : (data.items || data.Items || [])
          setImportModeStudies(list)
        } else {
          setImportModeStudies([])
        }
      } catch (error) {
        console.error("Error fetching studies for import mode:", error)
        setImportModeStudies([])
      } finally {
        setLoadingStudies(false)
      }
    }
    
    fetchImportStudies()
  }, [importMode, defaultStudyType])

  // Fetch sites by study ID
  const fetchSitesForDoctorForm = useCallback(async (studyId, siteMode = null) => {
    const numericId = Number.parseInt(String(studyId ?? ""), 10)
    if (!Number.isFinite(numericId) || numericId <= 0) {
      setSites([])
      return
    }
    setLoadingSites(true)
    try {
      const response = await siteService.getSitesByStudy(numericId)
      if ((response.isSuccess || response.success) && response.data) {
        let sitesList = Array.isArray(response.data)
          ? response.data
          : (response.data.items || response.data.Items || [])
        if (siteMode?.enabled && siteMode?.namingCustomizable && siteMode?.prefix) {
          sitesList = pickSystemSitesForImport(sitesList, siteMode.prefix)
        }
        setSites(sitesList)
      } else {
        setSites([])
      }
    } catch {
      setSites([])
    } finally {
      setLoadingSites(false)
    }
  }, [])

  const fetchSitesByStudy = useCallback(async (studyId) => {
    if (!studyId) {
      setSites([])
      return
    }
    setLoadingSites(true)
    try {
      const response = await siteService.getSitesByStudy(parseInt(studyId))
      if ((response.isSuccess || response.success) && response.data) {
        const sitesList = Array.isArray(response.data)
          ? response.data
          : (response.data.items || response.data.Items || [])
        setSites(sitesList)
      } else {
        setSites([])
      }
    } catch (error) {
      setSites([])
    } finally {
      setLoadingSites(false)
    }
  }, [])

  const fetchSitesByStudyRef = useRef(fetchSitesByStudy)
  fetchSitesByStudyRef.current = fetchSitesByStudy

  useEffect(() => {
    if (!defaultStudyId) {
      setDefaultStudySystemSitesEnabled(false)
      setDefaultStudySitePaymentEnabled(true)
      return undefined
    }
    let cancelled = false
    const studyId = defaultStudyId
    ;(async () => {
      try {
        const settingsRes = await fetchStudySettingsByStudyId(studyId, {
          preferFullEndpoint: true,
          forceRefresh: true,
        })
        if (cancelled) return
        const settingsData = settingsRes?.data ?? {}
        setDefaultStudySitePaymentEnabled(pickIsSitePaymentEnabled(settingsData))
        const siteMode = resolveSystemSiteModeForStudy(studyId, settingsData)
        setDefaultStudySystemSitesEnabled(siteMode.enabled)
        if (siteMode.autoAssign && !cancelled) {
          await fetchSitesByStudyRef.current(studyId)
        }
      } catch {
        if (!cancelled) setDefaultStudySystemSitesEnabled(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [defaultStudyId])

  // Re-apply auto site when Study Settings are saved for the currently selected CRC study
  useEffect(() => {
    const onStudySettingsUpdated = (event) => {
      const updatedStudyId = event?.detail?.studyId
      if (updatedStudyId == null) return
      clearStudySettingsCache(updatedStudyId)
      if (String(doctorFormData.studyId) !== String(updatedStudyId)) return

      void (async () => {
        const settingsRes = await fetchStudySettingsByStudyId(updatedStudyId, {
          preferFullEndpoint: true,
          forceRefresh: true,
        })
        const siteMode = resolveSystemSiteModeForStudy(updatedStudyId, settingsRes?.data ?? {})
        if (siteMode.autoAssign) {
          setDoctorSystemSitesAutoAssign(true)
          const autoSite = await resolveAutoSystemSiteForStudy(updatedStudyId)
          setDoctorSystemSiteCapacity({
            used: autoSite?.usedCount ?? 0,
            total: autoSite?.availableCount ?? 0,
          })
          if (autoSite?.siteId) {
            setDoctorAutoSiteLabel(autoSite.siteName || autoSite.siteId)
            setDoctorFormData((prev) => ({ ...prev, siteId: autoSite.siteId }))
          } else {
            setDoctorAutoSiteLabel("")
            setDoctorFormData((prev) => ({ ...prev, siteId: "" }))
          }
        } else {
          setDoctorSystemSitesAutoAssign(false)
          setDoctorAutoSiteLabel("")
          setDoctorSystemSiteCapacity({ used: 0, total: 0 })
          await fetchSitesForDoctorForm(updatedStudyId, siteMode)
        }
      })()
    }

    window.addEventListener("studySettingsUpdated", onStudySettingsUpdated)
    return () => window.removeEventListener("studySettingsUpdated", onStudySettingsUpdated)
  }, [doctorFormData.studyId, resolveAutoSystemSiteForStudy, fetchSitesForDoctorForm])

  // Initialize milestones when number of milestones changes (but don't auto-calculate)
  useEffect(() => {
    if (doctorUserType === "milestonePatient" && doctorFormData.numberOfMilestones > 0) {
      const numMilestones = parseInt(doctorFormData.numberOfMilestones) || 1
      const currentMilestones = doctorFormData.milestones || []
      
      // Only initialize if the number of milestones changed
      if (currentMilestones.length !== numMilestones) {
        const newMilestones = Array.from({ length: numMilestones }, (_, index) => {
          // Preserve existing milestone data if available
          return currentMilestones[index] || { milestoneNo: index + 1, patients: 0, amount: 0 }
        })
        setDoctorFormData((prev) => ({ ...prev, milestones: newMilestones }))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorFormData.numberOfMilestones, doctorUserType])

  const handleInputChange = (field, value, maxLength) => {
    // First Name and Last Name: allow only letters and spaces (no numbers)
    if (field === "firstName" || field === "lastName") {
      value = value.replace(/[^a-zA-Z\s]/g, "")
    }
    if (maxLength != null && value.length > maxLength) value = value.slice(0, maxLength)
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (error) setError("")
    if (success) setSuccess("")
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    const nameOnlyRegex = /^[a-zA-Z\s]+$/
    if (!formData.firstName?.trim()) {
      setError("First name is required.")
      return
    }
    if (!nameOnlyRegex.test(formData.firstName.trim())) {
      setError("First name must contain only letters.")
      return
    }
    if (!formData.lastName?.trim()) {
      setError("Last name is required.")
      return
    }
    if (!nameOnlyRegex.test(formData.lastName.trim())) {
      setError("Last name must contain only letters.")
      return
    }
    if (!formData.roleGuid) {
      setError("Please select a user role")
      return
    }
    if (!formData.email?.trim()) {
      setError("Email is required.")
      return
    }
    if (!isValidEmail(formData.email)) {
      setError("Please enter a valid email (e.g. abc@gmail.com).")
      return
    }

    try {
      setLoading(true)

      // Prepare data for API (matching RegisterRequest structure)
      const userData = {
        username: formData.username,
        FirstName: formData.firstName,
        LastName: formData.lastName || null,
        Email: formData.email,
        PhoneNumber: formData.phoneNumber || null,
        RoleGuid: formData.roleGuid,
      }

      if (isSuperAdmin && formData.isTestAccount) {
        userData.IsTestAccount = true
      }

      // API Call: POST /Users/CreateUser
      const response = await userService.createUser(userData)

      if (response.isSuccess) {
        const successMessage = response.message || "User created successfully!"
        setSuccess(successMessage)
        if (isSuperAdmin) {
          const generatedPassword = extractGeneratedPassword(response)
          if (generatedPassword) {
            setCreatedCredentials({
              title: "User created",
              email: formData.email,
              password: generatedPassword,
              contextLabel: `${formData.firstName} ${formData.lastName || ""}`.trim(),
            })
          }
        }
        toastCustom({
          title: "Success",
          description: successMessage,
          variant: "success",
          duration: 4000,
        })
        resetCreateUserForm()
        // Refresh users list if on manage tab
        if (activeTab === "manage") {
          fetchUsers()
        }
      } else {
        setError(response.message || "Failed to create user. Please try again.")
      }
    } catch (error) {
      setError("An error occurred while creating the user. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // Handle toggle user status
  const handleToggleStatus = async (userId, currentStatus) => {
    // Prevent multiple clicks
    if (updatingStatus[userId]) {
      return
    }

    try {
      setUpdatingStatus((prev) => ({ ...prev, [userId]: true }))
      const newStatus = !currentStatus

      // Optimistically update UI immediately for instant feedback
      setUsers((prev) =>
        prev.map((user) => (user.id === userId ? { ...user, isActive: newStatus } : user))
      )

      // API Call: PATCH /api/user/{userId}/status
      const response = await userService.updateUserStatus(userId, newStatus)

      if (response.isSuccess) {
        setSuccess(`User status updated to ${newStatus ? "Active" : "Inactive"}`)
        setTimeout(() => setSuccess(""), 3000)
      } else {
        // Revert on error
        setUsers((prev) =>
          prev.map((user) => (user.id === userId ? { ...user, isActive: currentStatus } : user))
        )
        setError(response.message || "Failed to update user status")
        setTimeout(() => setError(""), 3000)
      }
    } catch (error) {
      // Revert on error
      setUsers((prev) =>
        prev.map((user) => (user.id === userId ? { ...user, isActive: currentStatus } : user))
      )
      setError("An error occurred while updating user status")
      setTimeout(() => setError(""), 3000)
    } finally {
      setUpdatingStatus((prev) => ({ ...prev, [userId]: false }))
    }
  }
  // Handle edit user
  const handleEditUser = async (user) => {
    setEditingUser(user)
    setError("") // Clear any previous errors when opening edit modal
    setSuccess("") // Clear any previous success messages
    let matchedRoleGuid = ""
    let matchedRoleName = user.roleName || ""

    if (user.roleGuid) {
      // Try to find by roleGuid first
      const roleByGuid = availableRoles.find((role) => role.guid === user.roleGuid)
      if (roleByGuid) {
        matchedRoleGuid = roleByGuid.guid
        matchedRoleName = roleByGuid.name
      }
    }

    if (!matchedRoleGuid && user.roleName) {
      // If not found by guid, try to find by roleName
      const roleByName = availableRoles.find((role) => role.name === user.roleName)
      if (roleByName) {
        matchedRoleGuid = roleByName.guid
        matchedRoleName = roleByName.name
      }
    }

    const rawPhone = user.phoneNumber || user.mobileNo || ""
    let digits = rawPhone.replace(/\D/g, "")
    if (digits.startsWith("91")) digits = digits.slice(2)
    const phoneOnly = digits.slice(0, 10)
    setEditFormData({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      emailId: user.emailId || "",
      mobileNo: user.mobileNo || "",
      userRole: user.roleName || "",
      email: user.email || "",
      username: user.username || "",
      phoneNumber: phoneOnly,
      roleName: matchedRoleName,
      roleGuid: matchedRoleGuid,
    })
    setUserAssignments([])
    setEditingStudyUser(null)
    setStudyUserEditForm(null)
    if (user.id) {
      setUserAssignmentsLoading(true)
      try {
        const res = await studyUserService.getUserStudySiteAssignments(user.id)
        setUserAssignments(normalizeUserStudyAssignments(res))
      } catch {
        setUserAssignments([])
      } finally {
        setUserAssignmentsLoading(false)
      }
    }
  }

  // Open Edit Study User Details modal (load by StudyUser id)
  const handleOpenEditStudyUser = async (assignment) => {
    if (!assignment?.id) return
    setEditingStudyUser({
      ...assignment,
      studyTypeLabel: assignment.studyTypeLabel || studyTypeToLabel(assignment.studyType),
    })
    setStudyUserEditForm(null)
    setStudyUserEditSitePaymentEnabled(true)
    // Clear any previous validation/save error so a fresh modal open starts clean.
    setStudyUserEditError("")
    try {
      const res = await studyUserService.getStudyUserById(assignment.id)
      const d = res?.data || res
      if (!d) {
        setError("Failed to load assignment details.")
        return
      }
      const studyTypeRaw = d.studyType ?? d.StudyType ?? null

      // Map milestones / visit amounts from API
      const mappedMilestones = Array.isArray(d.milestones)
        ? d.milestones.map((m) => ({
            milestoneNo: m.milestoneNo ?? m.MilestoneNo ?? 0,
            noOfPatients: m.noOfPatients ?? m.NoOfPatients ?? 0,
            amount: m.amount ?? m.Amount ?? 0,
            name: m.name ?? m.Name ?? "",
          }))
        : Array.isArray(d.Milestones)
        ? d.Milestones.map((m) => ({
            milestoneNo: m.milestoneNo ?? m.MilestoneNo ?? 0,
            noOfPatients: m.noOfPatients ?? m.NoOfPatients ?? 0,
            amount: m.amount ?? m.Amount ?? 0,
            name: m.name ?? m.Name ?? "",
          }))
        : []

      const mappedVisitAmounts = Array.isArray(d.visitAmounts)
        ? d.visitAmounts.map((v) => ({
            visitNo: v.visitNo ?? v.VisitNo ?? "",
            amount: v.amount ?? v.Amount ?? 0,
            name: v.name ?? v.Name ?? "",
          }))
        : Array.isArray(d.VisitAmounts)
        ? d.VisitAmounts.map((v) => ({
            visitNo: v.visitNo ?? v.VisitNo ?? "",
            amount: v.amount ?? v.Amount ?? 0,
            name: v.name ?? v.Name ?? "",
          }))
        : []

      // Determine study type:
      // 1/2/3 or "Normal"/"Milestone"/"Visit" from API when available,
      // otherwise infer from milestones / visitAmounts
      let studyType = null
      if (
        studyTypeRaw === 1 ||
        studyTypeRaw === "1" ||
        String(studyTypeRaw).toLowerCase() === "normal"
      ) {
        studyType = "normal"
      } else if (
        studyTypeRaw === 2 ||
        studyTypeRaw === "2" ||
        String(studyTypeRaw).toLowerCase() === "milestone"
      ) {
        studyType = "milestonePatient"
      } else if (
        studyTypeRaw === 3 ||
        studyTypeRaw === "3" ||
        String(studyTypeRaw).toLowerCase() === "visit"
      ) {
        studyType = "milestoneVisit"
      }
      else if (mappedVisitAmounts.length > 0) studyType = "milestoneVisit"
      else if (mappedMilestones.length > 0) studyType = "milestonePatient"
      else studyType = "normal"

      const editStudyId = d.studyId ?? d.StudyId ?? assignment.studyId ?? null
      if (editStudyId) {
        try {
          const settingsRes = await fetchStudySettingsByStudyId(editStudyId, { preferFullEndpoint: true })
          setStudyUserEditSitePaymentEnabled(pickIsSitePaymentEnabled(settingsRes?.data ?? settingsRes))
        } catch {
          setStudyUserEditSitePaymentEnabled(true)
        }
      } else {
        setStudyUserEditSitePaymentEnabled(true)
      }

      setStudyUserEditForm({
        doctorName: d.doctorName ?? d.DoctorName ?? "",
        micrCode: d.micrCode ?? d.MicrCode ?? "",
        address: d.address ?? d.Address ?? "",
        pinCode: d.pinCode ?? d.PinCode ?? "",
        city: d.city ?? d.City ?? "",
        state: d.state ?? d.State ?? "",
        gstNo: d.gstNo ?? d.GstNo ?? "",
        sapVendorCode: d.sapVendorCode ?? d.SapVendorCode ?? "",
        emailId: d.emailId ?? d.EmailId ?? "",
        mobileNo: d.mobileNo ?? d.MobileNo ?? "",
        panNumber: normalizePanInput(d.panNumber ?? d.PanNumber ?? ""),
        noOfPlannedPatients: d.noOfPlannedPatients ?? d.NoOfPlannedPatients ?? "",
        totalHonorariumAmount:
          d.totalHonorariumAmount ?? d.totalPaymentAmount ?? d.TotalHonorariumAmount ?? "",
        region: d.region ?? d.Region ?? "",
        division: d.division ?? d.Division ?? "",
        area: d.area ?? d.Area ?? "",
        hq: d.hq ?? d.Hq ?? d.HQ ?? "",
        zone: d.zone ?? d.Zone ?? "",
        speciality: d.speciality ?? d.Speciality ?? d.specialty ?? d.Specialty ?? "",
        siteId: d.siteId ?? d.SiteId ?? null,
        studyId: d.studyId ?? d.StudyId ?? null,
        studyType,
        milestones: mappedMilestones,
        visitAmounts: mappedVisitAmounts,
      })
    } catch {
      setError("Failed to load assignment details.")
      setEditingStudyUser(null)
    }
  }

  const handleCloseEditStudyUser = () => {
    setEditingStudyUser(null)
    setStudyUserEditForm(null)
    setStudyUserEditSitePaymentEnabled(true)
    // Always reset the modal-scoped error on close so re-opening the modal
    // (or another row) never starts with a leftover banner from the prior session.
    setStudyUserEditError("")
  }

  // Save Study User (UpdateStudyUser API)
  const handleSaveStudyUserEdit = async (e) => {
    e.preventDefault()
    if (studyUserEditLoading) return
    if (!editingStudyUser?.id || !studyUserEditForm) return
    setStudyUserEditLoading(true)
    // Clear the modal-scoped error (page-level `error` is not used here so
    // the banner stays inside the modal where the user is looking).
    setStudyUserEditError("")
    try {
      // Basic required validation
      const requiredFields = ["doctorName", "address", "pinCode", "emailId", "panNumber"]
      for (const f of requiredFields) {
        if (!String(studyUserEditForm[f] ?? "").trim()) {
          setStudyUserEditError("Please fill all required fields in assignment details.")
          setStudyUserEditLoading(false)
          return
        }
      }
      if (!isValidIndianPan(studyUserEditForm.panNumber)) {
        toastCustom({
          title: "Error",
          description: "PAN Number must be valid format (e.g. ABCDE1234F).",
          variant: "destructive",
          duration: 3000,
        })
        setStudyUserEditLoading(false)
        return
      }

      const plannedPatients = studyUserEditForm.noOfPlannedPatients != null && studyUserEditForm.noOfPlannedPatients !== ""
        ? parseInt(studyUserEditForm.noOfPlannedPatients, 10)
        : 0
      const totalAmount = studyUserEditForm.totalHonorariumAmount != null && studyUserEditForm.totalHonorariumAmount !== ""
        ? parseFloat(studyUserEditForm.totalHonorariumAmount)
        : 0

      if (!plannedPatients || plannedPatients < 1) {
        setStudyUserEditError("No. of planned patients must be a valid number.")
        setStudyUserEditLoading(false)
        return
      }

      if (studyUserEditSitePaymentEnabled && (!totalAmount || totalAmount < 0)) {
        setStudyUserEditError("Total honorarium amount must be a valid number.")
        setStudyUserEditLoading(false)
        return
      }

      // Determine study type for validation
      let studyType = studyUserEditForm.studyType
      if (!studyType) {
        if ((studyUserEditForm.milestones || []).length > 0 && (studyUserEditForm.visitAmounts || []).length === 0) {
          studyType = "milestonePatient"
        } else if ((studyUserEditForm.visitAmounts || []).length > 0) {
          studyType = "milestoneVisit"
        } else {
          studyType = "normal"
        }
      }

      // Milestone patient-wise validation
      if (studyType === "milestonePatient") {
        if ((studyUserEditForm.milestones || []).length === 0) {
          setStudyUserEditError("At least one milestone is required for Milestone (Patient Wise) studies.")
          setStudyUserEditLoading(false)
          return
        }
        const milestonePatientsTotal = (studyUserEditForm.milestones || []).reduce(
          (sum, m) => sum + (parseInt(m.noOfPatients, 10) || 0),
          0
        )
        const milestoneAmountTotal = (studyUserEditForm.milestones || []).reduce(
          (sum, m) => sum + (parseFloat(m.amount) || 0),
          0
        )
        if (milestonePatientsTotal !== plannedPatients) {
          setStudyUserEditError("Total milestone patients must equal No. of planned patients.")
          setStudyUserEditLoading(false)
          return
        }
        if (studyUserEditSitePaymentEnabled && milestoneAmountTotal !== totalAmount) {
          setStudyUserEditError("Total milestone amount must equal total honorarium amount.")
          setStudyUserEditLoading(false)
          return
        }
      }

      // Milestone visit-wise validation
      if (studyType === "milestoneVisit") {
        if ((studyUserEditForm.visitAmounts || []).length === 0) {
          setStudyUserEditError("At least one visit amount is required for Milestone (Visit Wise) studies.")
          setStudyUserEditLoading(false)
          return
        }
        const visitAmountTotal = (studyUserEditForm.visitAmounts || []).reduce(
          (sum, v) => sum + (parseFloat(v.amount) || 0),
          0
        )
        if (studyUserEditSitePaymentEnabled && visitAmountTotal !== totalAmount) {
          setStudyUserEditError("Total visit amount must equal total honorarium amount.")
          setStudyUserEditLoading(false)
          return
        }
      }

      // Keep studyId fixed to the original value from the assignment/GET.
      const studyIdFromAssignment =
        editingStudyUser?.studyId ??
        editingStudyUser?.StudyId ??
        studyUserEditForm.studyId

      const payload = {
        doctorName: studyUserEditForm.doctorName || "",
        micrCode: studyUserEditForm.micrCode != null && studyUserEditForm.micrCode !== ""
          ? parseInt(studyUserEditForm.micrCode, 10)
          : null,
        address: studyUserEditForm.address || "",
        pinCode: studyUserEditForm.pinCode || "",
        city: studyUserEditForm.city || "",
        state: studyUserEditForm.state || "",
        gstNo: studyUserEditForm.gstNo || "",
        sapVendorCode: studyUserEditForm.sapVendorCode || "",
        emailId: studyUserEditForm.emailId || "",
        mobileNo: studyUserEditForm.mobileNo != null && studyUserEditForm.mobileNo !== ""
          ? parseInt(studyUserEditForm.mobileNo, 10)
          : null,
        panNumber: normalizePanInput(studyUserEditForm.panNumber || ""),
        noOfPlannedPatients: studyUserEditForm.noOfPlannedPatients != null && studyUserEditForm.noOfPlannedPatients !== "" ? parseInt(studyUserEditForm.noOfPlannedPatients, 10) : 0,
        totalHonorariumAmount: studyUserEditSitePaymentEnabled
          ? studyUserEditForm.totalHonorariumAmount != null && studyUserEditForm.totalHonorariumAmount !== ""
            ? parseFloat(studyUserEditForm.totalHonorariumAmount)
            : 0
          : 0,
        region: studyUserEditForm.region || "",
        division: studyUserEditForm.division || "",
        area: studyUserEditForm.area || "",
        hq: studyUserEditForm.hq || "",
        zone: studyUserEditForm.zone || "",
        speciality: studyUserEditForm.speciality || "",
        siteId: studyUserEditForm.siteId != null ? parseInt(studyUserEditForm.siteId, 10) : 0,
        studyId: studyIdFromAssignment != null ? parseInt(studyIdFromAssignment, 10) : 0,
        milestones:
          studyType === "milestonePatient"
            ? (studyUserEditForm.milestones || []).map((m) => ({
                milestoneNo: m.milestoneNo != null ? parseInt(m.milestoneNo, 10) : 0,
                noOfPatients: m.noOfPatients != null ? parseInt(m.noOfPatients, 10) : 0,
                amount: studyUserEditSitePaymentEnabled ? (m.amount != null ? parseFloat(m.amount) : 0) : 0,
                name: m.name || "",
              }))
            : [],
        visitAmounts:
          studyType === "milestoneVisit"
            ? (studyUserEditForm.visitAmounts || []).map((v) => ({
                visitNo: String(v.visitNo ?? ""),
                amount: studyUserEditSitePaymentEnabled ? (v.amount != null ? parseFloat(v.amount) : 0) : 0,
                name: v.name || "",
              }))
            : [],
      }
      const res = await studyUserService.updateStudyUser(editingStudyUser.id, payload)
      if (res?.isSuccess || res?.success) {
        // If we are editing from Manage Users assignment section (editingUser present),
        // keep the existing assignment success flow.
        if (editingUser?.id) {
          const successMessage = "Assignment details updated successfully."
          setSuccess(successMessage)
          toastCustom({
            title: "Success",
            description: successMessage,
            variant: "success",
              duration: 3000,
          })
          setTimeout(() => setSuccess(""), 3000)
          handleCloseEditStudyUser()
          const listRes = await studyUserService.getUserStudySiteAssignments(editingUser.id)
          setUserAssignments(normalizeUserStudyAssignments(listRes))
        } else {
          // Editing from Manage CRC Users grid
          toastCustom({
            title: "Success",
            description: "CRC user updated successfully.",
            variant: "success",
              duration: 3000,
          })
          handleCloseEditStudyUser()
          // Refresh CRC users list so grid reflects latest values
          fetchCrcUsers()
        }
      } else {
        setStudyUserEditError(res?.message || "Failed to update assignment details.")
      }
    } catch {
      setStudyUserEditError("Failed to update assignment details.")
    } finally {
      setStudyUserEditLoading(false)
    }
  }

  // Open CRC edit from CRC users grid
  const handleEditCrcUser = (studyUser) => {
    if (!studyUser) return
    const id = studyUser.id ?? studyUser.studyUserId ?? studyUser.StudyUserId
    if (!id) return
    const assignmentLike = {
      id,
      studyId: studyUser.studyId ?? studyUser.StudyId ?? null,
      siteId: studyUser.siteId ?? studyUser.SiteId ?? null,
      studyName:
        studyUser.studyProtocolNumber ||
        studyUser.studyName ||
        studyUser.studyTitle ||
        "",
      siteName: studyUser.siteName || studyUser.siteFullName || "",
      studyType: studyUser.studyType ?? studyUser.StudyType ?? null,
      studyTypeLabel: studyTypeToLabel(studyUser.studyType ?? studyUser.StudyType ?? null),
      totalHonorariumAmount:
        studyUser.totalHonorariumAmount ??
        studyUser.TotalHonorariumAmount ??
        studyUser.totalPaymentAmount ??
        null,
    }
    handleOpenEditStudyUser(assignmentLike)
  }

  // Toggle CRC StudyUser active / inactive
  const handleToggleCrcStatus = async (studyUserId, currentStatus) => {
    if (!studyUserId) return
    // Optimistic UI update
    setCrcUsers((prev) =>
      prev.map((u) =>
        (u.id ?? u.studyUserId ?? u.StudyUserId) === studyUserId ? { ...u, isActive: !currentStatus } : u
      )
    )
    try {
      const res = await studyUserService.updateStudyUserStatus(studyUserId, !currentStatus)
      if (!(res?.isSuccess || res?.success)) {
        // Revert on error
        setCrcUsers((prev) =>
          prev.map((u) =>
            (u.id ?? u.studyUserId ?? u.StudyUserId) === studyUserId ? { ...u, isActive: currentStatus } : u
          )
        )
        setError(res?.message || "Failed to update CRC user status.")
        setTimeout(() => setError(""), 3000)
      } else {
        toastCustom({
          title: "Success",
          description: "CRC user status updated successfully.",
          variant: "success",
          duration: 3000,
        })
      }
    } catch {
      setCrcUsers((prev) =>
        prev.map((u) =>
          (u.id ?? u.studyUserId ?? u.StudyUserId) === studyUserId ? { ...u, isActive: currentStatus } : u
        )
      )
      setError("Failed to update CRC user status.")
      setTimeout(() => setError(""), 3000)
    }
  }

  const handleClearCrcFilters = () => {
    setCrcSearchQuery("")
    setCrcFilterStudyId("")
    setCrcFilterStatus("all")
    setCrcFilterStudySearchInput("")
    setCrcPageNumber(1)
  }

  // Handle save edited user
  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editingUser) return

    // Validation: First Name and Last Name required, characters only (letters and spaces)
    const nameOnlyRegex = /^[a-zA-Z\s]+$/
    const firstNameTrim = (editFormData.firstName || "").trim()
    const lastNameTrim = (editFormData.lastName || "").trim()
    if (!firstNameTrim) {
      setError("First name is required.")
      return
    }
    if (!nameOnlyRegex.test(firstNameTrim)) {
      setError("First name must contain only letters.")
      return
    }
    if (!lastNameTrim) {
      setError("Last name is required.")
      return
    }
    if (!nameOnlyRegex.test(lastNameTrim)) {
      setError("Last name must contain only letters.")
      return
    }
    if (!(editFormData.email || "").trim()) {
      setError("Email is required.")
      return
    }
    if (!isValidEmail(editFormData.email)) {
      setError("Please enter a valid email (e.g. abc@gmail.com).")
      return
    }
    // Phone number: if provided, must be exactly 10 digits
    const phoneTrim = (editFormData.phoneNumber || "").trim()
    if (phoneTrim && (phoneTrim.length !== 10 || !/^\d{10}$/.test(phoneTrim))) {
      setError("Phone number must be exactly 10 digits.")
      return
    }

    try {
      setEditLoading(true)
      setError("")
      setSuccess("")

      // Only Super Admin can change role; others keep the existing role
      const payload = { ...editFormData }
      if (!isSuperAdmin) {
        payload.roleGuid = editingUser.roleGuid ?? payload.roleGuid
        payload.roleName = editingUser.roleName ?? payload.roleName
      }

      // API Call: PUT /api/user/{userId}
      const response = await userService.updateUser(editingUser.id, payload)

      if (response.isSuccess) {
        // Refresh users from API to get latest data
        await fetchUsers()
        const successMessage = "User updated successfully!"
        setSuccess(successMessage)
        toastCustom({
          title: "Success",
          description: successMessage,
          variant: "success",
          duration: 3000,
        })
        setEditingUser(null)
        setTimeout(() => setSuccess(""), 3000)
      } else {
        // Extract error message from response
        const errorMessage = response.message || response.data?.message || "Failed to update user"
        setError(errorMessage)
        // Keep error visible for 5 seconds
        setTimeout(() => setError(""), 3000)
      }
    } catch (error) {
      setError("An error occurred while updating user")
    } finally {
      setEditLoading(false)
    }
  }

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditingUser(null)
    setUserAssignments([])
    setEditingStudyUser(null)
    setStudyUserEditForm(null)
    setEditFormData({
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      roleGuid: "",
      roleName: "",
      isActive: true,
    })
    setError("")
  }

  // Handle delete user (opens custom confirm modal)
  const openDeleteConfirm = (userId, userName) => {
    setDeleteConfirmUser({ id: userId, userName: (userName || "this user").trim() || "this user" })
  }

  // Perform delete after user confirms in modal
  const handleConfirmDeleteUser = async () => {
    if (!deleteConfirmUser) return
    const { id: userId } = deleteConfirmUser
    setDeleteConfirmUser(null)

    try {
      setDeletingUser(userId)
      setError("")
      setSuccess("")

      const response = await userService.deleteUser(userId)

      if (response.isSuccess) {
        setSuccess("User deleted successfully!")
        setTimeout(() => setSuccess(""), 3000)
        await fetchUsers()
      } else {
        setError(response.message || "Failed to delete user")
        setTimeout(() => setError(""), 3000)
      }
    } catch (error) {
      setError("An error occurred while deleting user")
      setTimeout(() => setError(""), 3000)
    } finally {
      setDeletingUser(null)
    }
  }

  // Handle copy to clipboard
  const handleCopyToClipboard = async (text, type, userId) => {
    if (!text || text === "N/A") {
      return
    }

    try {
      await navigator.clipboard.writeText(text)
      setCopiedItem(`${type}-${userId}`)
      const typeLabels = {
        email: "Email",
        phone: "Phone number",
        guid: "GUID"
      }
      setSuccess(`${typeLabels[type] || "Text"} copied to clipboard!`)
      setTimeout(() => {
        setCopiedItem(null)
        setSuccess("")
      }, 2000)
    } catch (error) {
      console.error("Failed to copy:", error)
      setError("Failed to copy to clipboard")
      setTimeout(() => setError(""), 3000)
    }
  }

  // Open reset password confirmation modal
  const handleResetPassword = (userId, userName) => {
    setResetPasswordConfirmUser({ id: userId, userName: (userName || "this user").trim() || "this user" })
  }

  // Perform reset password after user confirms in modal
  const handleConfirmResetPassword = async () => {
    if (!resetPasswordConfirmUser) return
    const { id: userId, userName } = resetPasswordConfirmUser
    setResetPasswordConfirmUser(null)

    try {
      setResettingPassword(userId)
      setError("")
      setSuccess("")

      const response = await userService.resetUserPassword(userId)

      if (response.isSuccess) {
        setSuccess(`Password reset successful! New password has been sent to ${userName}'s email.`)
        setTimeout(() => setSuccess(""), 3000)
      } else {
        setError(response.message || "Failed to reset password")
        setTimeout(() => setError(""), 3000)
      }
    } catch (error) {
      setError("An error occurred while resetting password")
      setTimeout(() => setError(""), 3000)
    } finally {
      setResettingPassword(null)
    }
  }

  // Handle assign user
  const handleAssignUser = (user) => {
    const userId = user.id
    setAssignFormData({
      userId: userId,
      studyId: "",
      siteId: "",
      siteIds: [],
    })
    setAssigningUserRole(user.roleName || "")
    setAssigningUserRoleGuid(String(user.roleGuid ?? user.RoleGuid ?? "").trim())
    // Don't reset selectedAssignments here - let fetchStudiesForAssign populate it with already assigned items
    setAssignSearchQuery("") // Reset search
    setShowAssignModal(true)
    setError("")
    // Ensure cached studies list is available, then fetch assignment status for this user
    // This will auto-populate selectedAssignments with already assigned items
    if (cachedStudiesList.length === 0) {
      // Fetch and cache studies first, then fetch assignment status
      fetchAndCacheStudiesList().then(() => {
        fetchStudiesForAssign(userId, user.roleName || "", user.roleGuid || user.RoleGuid || "")
      })
    } else {
      // Use cached studies list and fetch only assignment status
      fetchStudiesForAssign(userId, user.roleName || "", user.roleGuid || user.RoleGuid || "")
    }
  }

  // Handle save assign - process checkbox selections (Batch API call)
  const handleSaveAssign = async () => {
    // Get all selected studies
    const selectedStudies = Object.entries(selectedAssignments)
      .filter(([_, data]) => data.selected)
      .map(([studyId, _]) => studyId)

    if (selectedStudies.length === 0) {
      setError("Please select at least one study")
      setTimeout(() => setError(""), 3000)
      return
    }

    const resolveRoleNameForStudyAssign = (studyId) => {
      const studyData = selectedAssignments[studyId]
      const roleGuid = String(studyData?.roleGuid ?? assigningUserRoleGuid ?? "").trim()
      if (roleGuid) {
        const match = availableRoles.find((role) => {
          const id = String(role.guid ?? role.roleGuid ?? role.id ?? "").trim()
          return id === roleGuid
        })
        if (match) return String(match.name ?? match.roleName ?? "").trim()
      }
      return assigningUserRole
    }

    for (const studyId of selectedStudies) {
      const roleNameForStudy = resolveRoleNameForStudyAssign(studyId)
      const studyData = selectedAssignments[studyId]
      const selectedSiteIds = Object.entries(studyData?.sites || {})
        .filter(([_, selected]) => selected)
        .map(([siteId]) => siteId)
      if (selectedSiteIds.length === 0) continue
      const maxForStudy = getMaxSitesPerStudyForRole(roleNameForStudy)
      if (maxForStudy !== 1) continue
      if (selectedSiteIds.length !== 1) {
        setError("For CRC/PI roles, each study must have exactly one site selected.")
        setTimeout(() => setError(""), 5000)
        return
      }
      const result = validateSiteSelectionForRole(roleNameForStudy, selectedSiteIds)
      if (!result.valid) {
        setError(result.message || "Invalid site selection for role.")
        setTimeout(() => setError(""), 5000)
        return
      }
    }

    try {
      setAssigningUser(assignFormData.userId)
      setError("")
      setSuccess("")

      // API expects: { userId, assignments: [{ studyId, siteIds, roleGuid? }] }
      const assignments = selectedStudies.map((studyId) => {
        const studyData = selectedAssignments[studyId]
        const selectedSiteIds = Object.entries(studyData.sites || {})
          .filter(([_, selected]) => selected)
          .map(([siteId, _]) => parseInt(siteId))
          .filter(id => !isNaN(id))

        const roleGuid = String(studyData?.roleGuid ?? assigningUserRoleGuid ?? "").trim()

        return {
          studyId: parseInt(studyId),
          siteIds: selectedSiteIds,
          ...(roleGuid ? { roleGuid } : {}),
        }
      })

      // Single API call for all assignments
      const response = await studyUserService.assignBatchStudiesAndSites(
        assignFormData.userId,
        assignments
      )

      if (response.isSuccess) {
        const successMessage = `User assigned to ${selectedStudies.length} study(s) successfully!`
        setSuccess(successMessage)
        toastCustom({
          title: "Success",
          description: successMessage,
          variant: "success",
          duration: 3000,
        })
        setTimeout(() => setSuccess(""), 3000)
        setShowAssignModal(false)
        setSelectedAssignments({})
        window.dispatchEvent(new CustomEvent("studySiteChanged"))
        await fetchUsers()
      } else {
        setError(response.message || "Failed to assign user to studies")
        setTimeout(() => setError(""), 3000)
      }
    } catch (error) {
      setError("An error occurred while assigning user")
      setTimeout(() => setError(""), 3000)
    } finally {
      setAssigningUser(null)
    }
  }

  // Handle doctor form input change
  // Fetch location data from PIN code
  const fetchLocationFromPincode = async (pincode) => {
    if (!pincode || pincode.length !== 6 || !/^\d{6}$/.test(pincode)) {
      return null
    }

    try {
      setLoadingLocation(true)
      // Using a public API for Indian PIN codes
      const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`)
      const data = await response.json()
      
      if (data && data[0] && data[0].Status === "Success" && data[0].PostOffice && data[0].PostOffice.length > 0) {
        const postOffice = data[0].PostOffice[0]
        return {
          state: postOffice.State || "",
          city: postOffice.District || postOffice.Block || postOffice.Name || "",
        }
      }
      return null
    } catch (error) {
      console.error("Error fetching location from PIN code:", error)
      return null
    } finally {
      setLoadingLocation(false)
    }
  }

  const handleDoctorInputChange = async (field, value) => {
    // Handle studyId (single select)
    if (field === "studyId") {
      setDoctorFormData((prev) => ({ ...prev, [field]: value, siteId: "" }))
      setSiteSearchInput("")
      setIsSiteDropdownOpen(false)
      setDoctorAutoSiteLabel("")
      setDoctorSystemSiteCapacity({ used: 0, total: 0 })

      if (value) {
        const settingsRes = await fetchStudySettingsByStudyId(value, {
          preferFullEndpoint: true,
          forceRefresh: true,
        })
        const settingsData = settingsRes?.data ?? {}
        setDoctorSitePaymentEnabled(pickIsSitePaymentEnabled(settingsData))
        const siteMode = resolveSystemSiteModeForStudy(value, settingsData)

        if (siteMode.autoAssign) {
          setDoctorSystemSitesAutoAssign(true)
          const autoSite = await resolveAutoSystemSiteForStudy(value)
          setDoctorSystemSiteCapacity({
            used: autoSite?.usedCount ?? 0,
            total: autoSite?.availableCount ?? 0,
          })
          if (autoSite?.siteId) {
            setDoctorAutoSiteLabel(autoSite.siteName || autoSite.siteId)
            setDoctorFormData((prev) => ({ ...prev, studyId: value, siteId: autoSite.siteId }))
          } else {
            setDoctorAutoSiteLabel("")
          }
        } else {
          setDoctorSystemSitesAutoAssign(false)
          await fetchSitesForDoctorForm(value, siteMode)
        }
      } else {
        setDoctorSystemSitesAutoAssign(false)
        setSites([])
        setDoctorSitePaymentEnabled(true)
      }
      return
    }
    
    // Handle siteId (single select)
    if (field === "siteId") {
      setDoctorFormData((prev) => ({ ...prev, [field]: value }))
      setSiteSearchInput("")
      setIsSiteDropdownOpen(false)
      return
    }
    
    // If PIN code is changed, fetch location data
    if (field === "pinCode") {
      // Only allow numeric input and limit to 6 digits
      const numericValue = value.replace(/\D/g, "").slice(0, 6)
      setDoctorFormData((prev) => ({ ...prev, [field]: numericValue }))
      
      // Fetch location when PIN code is 6 digits
      if (numericValue.length === 6) {
        const location = await fetchLocationFromPincode(numericValue)
        if (location) {
          setDoctorFormData((prev) => ({
            ...prev,
            State: location.state,
            City: location.city,
          }))
        } else {
          // Clear state and city if location not found
          setDoctorFormData((prev) => ({
            ...prev,
            State: "",
            City: "",
          }))
        }
      } else if (numericValue.length < 6) {
        // Clear state and city if PIN code is incomplete
        setDoctorFormData((prev) => ({
          ...prev,
          State: "",
          City: "",
        }))
      }
    } else if (field === "pan") {
      const panValue = normalizePanInput(value)
      setDoctorFormData((prev) => ({ ...prev, [field]: panValue }))
    } else {
      // For number fields, ensure integer values
      if (field === "totalPaymentAmount" || field === "noOfPlannedPatients" || field === "MicrCode") {
        const intValue = value === "" ? "" : parseInt(value) || 0
        setDoctorFormData((prev) => ({ ...prev, [field]: intValue < 0 ? 0 : intValue }))
      } else {
        setDoctorFormData((prev) => ({ ...prev, [field]: value }))
      }
    }
    
    if (doctorError) setDoctorError("")
    if (doctorSuccess) setDoctorSuccess("")
  }

  // Handle milestone field changes
  const handleMilestoneChange = (index, field, value) => {
    setDoctorFormData((prev) => {
      const newMilestones = [...prev.milestones]
      newMilestones[index] = {
        ...newMilestones[index],
        [field]: parseInt(value) || 0, // Always use parseInt for integer-only
      }
      return { ...prev, milestones: newMilestones }
    })
    if (doctorError) setDoctorError("")
  }

  // Handle doctor form submit
  const handleDoctorSubmit = async (e) => {
    e.preventDefault()
    setDoctorError("")
    setDoctorSuccess("")

    // Validation - matching backend requirements
    if (!doctorFormData.doctorName) {
      setDoctorError("Doctor Name is required")
      return
    }
    if (!doctorFormData.address) {
      setDoctorError("Address is required")
      return
    }
    if (!doctorFormData.pinCode) {
      setDoctorError("Pin Code is required")
      return
    }
    if (!doctorFormData.emailId) {
      setDoctorError("Email is required")
      return
    }
    if (!isValidEmail(doctorFormData.emailId)) {
      setDoctorError("Please enter a valid email (e.g. abc@gmail.com).")
      return
    }
    if (!doctorFormData.pan) {
      setDoctorError("PAN Number is required")
      return
    }
    if (!isValidIndianPan(doctorFormData.pan)) {
      toastCustom({
        title: "Error",
        description: "PAN Number must be valid format (e.g. ABCDE1234F).",
        variant: "destructive",
        duration: 3000,
      })
      return
    }
    if (!doctorFormData.studyId) {
      setDoctorError("Study must be selected")
      return
    }

    let siteIdForSubmit = doctorFormData.siteId

    const settingsRes = await fetchStudySettingsByStudyId(doctorFormData.studyId, {
      preferFullEndpoint: true,
      forceRefresh: true,
    })
    const siteMode = resolveSystemSiteModeForStudy(doctorFormData.studyId, settingsRes?.data ?? {})

    if (siteMode.autoAssign) {
      if (!isValidSiteIdForSubmit(siteIdForSubmit)) {
        const autoSite = await resolveAutoSystemSiteForStudy(doctorFormData.studyId)
        if (autoSite?.siteId && isValidSiteIdForSubmit(autoSite.siteId)) {
          siteIdForSubmit = autoSite.siteId
        } else if (autoSite && autoSite.availableCount > 0) {
          setDoctorError("All system sites are already assigned. Add more sites in Study Settings.")
          return
        } else {
          setDoctorError(
            autoSite?.lastError ||
              "Could not create or assign a system site (s-01, s-02, …). Open Study Settings, enable system site creation, save, then re-select this study.",
          )
          return
        }
      }
    } else if (!isValidSiteIdForSubmit(siteIdForSubmit)) {
      setDoctorError("Site must be selected")
      return
    }

    if (!doctorFormData.noOfPlannedPatients || parseInt(doctorFormData.noOfPlannedPatients) <= 0) {
      setDoctorError("Number of Planned Patients must be greater than 0")
      return
    }
    if (doctorSitePaymentEnabled && (!doctorFormData.totalPaymentAmount || parseInt(doctorFormData.totalPaymentAmount) < 0)) {
      setDoctorError("Total Payment Amount must be greater than or equal to 0")
      return
    }
    // Validate mobile number if provided (must be exactly 10 digits)
    if (doctorFormData.mobileNo && (doctorFormData.mobileNo.length !== 10 || !/^\d{10}$/.test(doctorFormData.mobileNo))) {
      setDoctorError("Mobile No must be exactly 10 digits")
      return
    }
    // Validate milestones for patient-wise type
    if (doctorUserType === "milestonePatient") {
      const numMilestones = parseInt(doctorFormData.numberOfMilestones, 10)
      if (doctorFormData.numberOfMilestones === "" || doctorFormData.numberOfMilestones == null || isNaN(numMilestones) || numMilestones < 1) {
        setDoctorError("Number of Milestones is required (enter a positive number)")
        return
      }
      if (!doctorFormData.milestones || doctorFormData.milestones.length === 0) {
        setDoctorError("Please configure milestone details")
        return
      }
      const totalPatients = parseInt(doctorFormData.noOfPlannedPatients) || 0
      const totalAmount = parseInt(doctorFormData.totalPaymentAmount) || 0
      const milestonePatientsTotal = doctorFormData.milestones.reduce(
        (sum, m) => sum + (parseInt(m.patients) || 0),
        0
      )
      const milestoneAmountTotal = doctorFormData.milestones.reduce(
        (sum, m) => sum + (parseInt(m.amount) || 0),
        0
      )

      if (milestonePatientsTotal !== totalPatients) {
        setDoctorError(
          `Total milestone patients (${milestonePatientsTotal}) must equal planned patients (${totalPatients}).`
        )
        return
      }
      if (doctorSitePaymentEnabled && milestoneAmountTotal !== totalAmount) {
        setDoctorError(
          `Total milestone amount (${milestoneAmountTotal}) must equal total payment amount (${totalAmount}).`
        )
        return
      }
    }
    // Validate visit amounts for visit-wise type
    if (doctorUserType === "milestoneVisit") {
      if (!doctorFormData.visitAmounts || doctorFormData.visitAmounts.length === 0) {
        setDoctorError("Please add at least one visit amount")
        return
      }
      const totalAmount = parseInt(doctorFormData.totalPaymentAmount) || 0
      const visitAmountTotal = doctorFormData.visitAmounts.reduce(
        (sum, v) => sum + (parseInt(v.amount) || 0),
        0
      )

      if (doctorSitePaymentEnabled && visitAmountTotal !== totalAmount) {
        setDoctorError(
          `Total visit amount (${visitAmountTotal}) must equal total payment amount (${totalAmount}).`
        )
        return
      }
    }

    try {
      setDoctorLoading(true)
      const studyTypeMap = {
        normal: 1,
        milestonePatient: 2,
        milestoneVisit: 3,
      }

      const submitData = {
        StudyId: doctorFormData.studyId ? parseInt(doctorFormData.studyId) : null,
        SiteId: siteIdForSubmit ? parseInt(siteIdForSubmit, 10) : null,
        DoctorName: doctorFormData.doctorName,
        MicrCode: doctorFormData.MicrCode ? parseInt(doctorFormData.MicrCode) : null,
        Address: doctorFormData.address,
        PinCode: doctorFormData.pinCode,
        SapVendorCode: doctorFormData.sapVendorCode || null,
        EmailId: doctorFormData.emailId,
        MobileNo: doctorFormData.mobileNo ? parseInt(doctorFormData.mobileNo) : null,
        PanNumber: normalizePanInput(doctorFormData.pan),
        NoOfPlannedPatients: parseInt(doctorFormData.noOfPlannedPatients),
        totalHonorariumAmount: doctorSitePaymentEnabled
          ? parseInt(doctorFormData.totalPaymentAmount) || 0
          : 0,
        Region: doctorFormData.region || null,
        Division: doctorFormData.division || null,
        Area: doctorFormData.area || null,
        Hq: doctorFormData.hq || null,
        Zone: doctorFormData.zone || null,
        Speciality: doctorFormData.speciality || null,
        City: doctorFormData.City || null,
        State: doctorFormData.State || null,
        GstNo: doctorFormData.GstNo || null,
        StudyType: studyTypeMap[doctorUserType] ?? 0,
      }

      if (isSuperAdmin && doctorFormData.isTestAccount) {
        submitData.IsTestAccount = true
      }

      // Add milestones for Milestone type
      if (doctorUserType === "milestonePatient" && doctorFormData.milestones.length > 0) {
        submitData.Milestones = doctorFormData.milestones.map((m, index) => ({
          MilestoneNo: index + 1,
          NoOfPatients: m.patients || 0,
          Amount: doctorSitePaymentEnabled ? (m.amount || 0) : 0,
        }))
      }

      // Add visit amounts for Visit type
      if (doctorUserType === "milestoneVisit" && doctorFormData.visitAmounts.length > 0) {
        submitData.VisitAmounts = doctorFormData.visitAmounts.map((v) => ({
          VisitNo: String(v.visitNumber || ""),
          Amount: doctorSitePaymentEnabled ? (v.amount || 0) : 0,
        }))
      }

      // API Call: POST /StudyUsers/CreateStudyUser
      const response = await studyUserService.createStudyUser(submitData)

      if (response.isSuccess) {
        const successMessage = response.message || "Doctor/CRC user created successfully!"
        setDoctorSuccess(successMessage)
        if (isSuperAdmin) {
          const generatedPassword = extractGeneratedPassword(response)
          if (generatedPassword) {
            setCreatedCredentials({
              title: "CRC user created",
              email: doctorFormData.emailId,
              password: generatedPassword,
              contextLabel: doctorFormData.doctorName || "New CRC user",
            })
          }
        }
        toastCustom({
          title: "Success",
          description: successMessage,
          variant: "success",
          duration: 3000,
        })
        setTimeout(() => {
          setDoctorFormData({
            doctorName: "",
            MicrCode: "",
            address: "",
            pinCode: "",
            sapVendorCode: "",
            emailId: "",
            mobileNo: "",
            pan: "",
            noOfPlannedPatients: "",
            totalPaymentAmount: "",
            region: "",
            division: "",
            area: "",
            hq: "",
            zone: "",
            speciality: "",
            studyId: "",
            siteId: "",
            City: "",
            State: "",
            GstNo: "",
            numberOfMilestones: 1,
            milestones: [],
            visitAmounts: [],
            isTestAccount: false,
          })
          setDoctorUserType("normal")
          setSites([])
          // Refresh CRC users grid if user is on Manage CRC Users tab
          if (activeTab === "crcManage") {
            fetchCrcUsers()
          }
        }, 2000)
      } else {
        setDoctorError(response.message || "Failed to create doctor/CRC user. Please try again.")
      }
    } catch (error) {
      setDoctorError("An error occurred while creating the doctor/CRC user")
    } finally {
      setDoctorLoading(false)
    }
  }

  // Add visit amount for visit-wise milestone
  const handleAddVisitAmount = () => {
    setDoctorFormData((prev) => ({
      ...prev,
      visitAmounts: [...prev.visitAmounts, { visitNumber: prev.visitAmounts.length + 1, amount: 0 }],
    }))
  }

  // Remove visit amount
  const handleRemoveVisitAmount = (index) => {
    setDoctorFormData((prev) => {
      const newVisitAmounts = prev.visitAmounts.filter((_, i) => i !== index)
      // Update visit numbers to be sequential
      return {
        ...prev,
        visitAmounts: newVisitAmounts.map((visit, i) => ({
          ...visit,
          visitNumber: i + 1,
        })),
      }
    })
  }

  // Update visit amount
  const handleVisitAmountChange = (index, field, value) => {
    setDoctorFormData((prev) => ({
      ...prev,
      visitAmounts: prev.visitAmounts.map((visit, i) =>
        i === index ? { ...visit, [field]: parseInt(value) || 0 } : visit
      ),
    }))
  }

  // Handle file upload and parse CSV
  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    // Validate default settings are set
    if (!defaultStudyId) {
      setDoctorError("Please select a default study before uploading the file")
      event.target.value = "" // Reset file input
      return
    }

    if (!defaultStudyType) {
      setDoctorError("Please select a default study type before uploading the file")
      event.target.value = "" // Reset file input
      return
    }

    // File validation as per API requirements
    // 1. Check file extension
    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith(".csv")) {
      setDoctorError("File type '.csv' is not allowed. Allowed types: .csv")
      event.target.value = "" // Reset file input
      return
    }

    // 2. Check MIME type
    const allowedMimeTypes = ["text/csv", "application/csv", "text/plain", "application/vnd.ms-excel"]
    if (file.type && !allowedMimeTypes.includes(file.type)) {
      // Some browsers may not set MIME type correctly, so we'll allow if type is empty
      if (file.type !== "") {
        setDoctorError(`File type '${file.type}' is not allowed. Allowed types: text/csv`)
        event.target.value = "" // Reset file input
        return
      }
    }

    // 3. Check file size (50 MB = 50 * 1024 * 1024 bytes)
    const maxFileSize = 50 * 1024 * 1024 // 50 MB
    if (file.size > maxFileSize) {
      setDoctorError("File size exceeds maximum allowed size of 50 MB")
      event.target.value = "" // Reset file input
      return
    }

    setImportLoading(true)
    setDoctorError("")

    try {
      const text = await file.text()
      // Handle different line endings (CRLF, LF, CR)
      const lines = text.split(/\r?\n|\r/).filter((line) => line.trim())

      if (lines.length < 2) {
        setDoctorError("CSV file must have at least a header row and one data row")
        setImportLoading(false)
        return
      }

      // Row cap protects the browser; large files are sent to the API in small batches.
      const maxDataRows = STUDY_USER_IMPORT_MAX_DATA_ROWS
      const dataRowCount = lines.length - 1 // Exclude header row
      if (dataRowCount > maxDataRows) {
        setDoctorError(`Maximum ${maxDataRows.toLocaleString()} data rows are allowed per import. Found ${dataRowCount.toLocaleString()}. Split into multiple files or contact support for larger loads.`)
        setImportLoading(false)
        event.target.value = "" // Reset file input
        return
      }

      // Parse CSV (handle quoted values); delimiter can be "," or ";" (Excel in some locales)
      const parseCSVLine = (line, delimiter = ",") => {
        const result = []
        let current = ""
        let inQuotes = false

        for (let i = 0; i < line.length; i++) {
          const char = line[i]
          if (char === '"') {
            inQuotes = !inQuotes
          } else if (char === delimiter && !inQuotes) {
            result.push(current.trim())
            current = ""
          } else {
            current += char
          }
        }
        result.push(current.trim())
        return result
      }

      // Detect delimiter: if first line has only one column and contains ";", use semicolon
      let delimiter = ","
      const firstLine = lines[0]
      const commaSplit = parseCSVLine(firstLine, ",")
      if (commaSplit.length === 1 && firstLine.includes(";")) {
        delimiter = ";"
      }

      // Parse headers and normalize them (remove asterisks, handle case variations)
      const rawHeaders = parseCSVLine(lines[0], delimiter)
      if (!rawHeaders || rawHeaders.length === 0) {
        throw new Error("CSV file must have a header row")
      }

      const headers = rawHeaders.map((h) => {
        if (!h) return ""
        return h.replace(/\*/g, "").toLowerCase().trim()
      }).filter(h => h !== "")

      if (headers.length === 0) {
        throw new Error("No valid headers found in CSV file")
      }

      const settingsRes = defaultStudyId
        ? await fetchStudySettingsByStudyId(defaultStudyId, { preferFullEndpoint: true })
        : null
      const siteMode = defaultStudyId
        ? resolveSystemSiteModeForStudy(defaultStudyId, settingsRes?.data ?? {})
        : { enabled: false, autoAssign: false, prefix: "s-" }
      const systemSitesEnabled = siteMode.enabled
      const systemSitePrefix = siteMode.prefix || "s-"
      setDefaultStudySystemSitesEnabled(systemSitesEnabled)

      let sitesForImport = sites
      if (systemSitesEnabled && defaultStudyId) {
        if (!Array.isArray(sitesForImport) || sitesForImport.length === 0) {
          const sitesRes = await siteService.getSitesByStudy(parseInt(defaultStudyId, 10))
          if (sitesRes?.isSuccess) {
            sitesForImport = Array.isArray(sitesRes.data)
              ? sitesRes.data
              : (sitesRes.data?.items || sitesRes.data?.Items || [])
          }
        }
      }

      const data = []

      for (let i = 1; i < lines.length; i++) {
        let values = parseCSVLine(lines[i], delimiter)
        // Pad or trim to match header count so we don't drop rows (e.g. trailing empty columns)
        if (values.length < headers.length) {
          values = [...values, ...Array(headers.length - values.length).fill("")]
        } else if (values.length > headers.length) {
          values = values.slice(0, headers.length)
        }

        const row = {}
        headers.forEach((header, index) => {
          if (header) {
            row[header] = (values[index] || "").trim()
          }
        })
        data.push(row)
      }

      // Map CSV columns to form fields
      const mappedData = data.map((row, index) => {
        const studyType = (row["study type"] || row["studytype"] || row["type"] || defaultStudyType || "normal").toLowerCase()
        const numberOfMilestones = parseInt(row["number of milestones"] || row["numberofmilestones"] || row["milestones"] || "1") || 1
        // Handle "NoOfPlannedPatients*" (with or without space) and variations
        const noOfPlannedPatients = parseInt(
          row["noofplannedpatients"] || 
          row["no of planned patients"] || 
          row["no. of planned patients"] || 
          row["patients"] || 
          "0"
        ) || 0
        // Handle "TotalHonorariumAmount*" and variations
        const totalPaymentAmount = parseInt(
          row["totalhonorariumamount"] || 
          row["Total Payment Amount"] || 
          row["totalPaymentAmount"] || 
          row["amount"] || 
          "0"
        ) || 0

        // Calculate milestones for patient-wise type
        let milestones = []
        if (studyType === "milestonepatient" || studyType === "milestone(patient wise)") {
          if (noOfPlannedPatients > 0 && totalPaymentAmount > 0 && numberOfMilestones > 0) {
            const patientsPerMilestone = Math.floor(noOfPlannedPatients / numberOfMilestones)
            const amountPerMilestone = totalPaymentAmount / numberOfMilestones
            const remainderPatients = noOfPlannedPatients % numberOfMilestones

            milestones = Array.from({ length: numberOfMilestones }, (_, i) => ({
              milestoneNo: i + 1,
              patients: i === 0 ? patientsPerMilestone + remainderPatients : patientsPerMilestone,
              amount: amountPerMilestone,
            }))
          }
        }

        // Parse visit amounts for visit-wise type (comma-separated or multiple columns)
        let visitAmounts = []
        if (studyType === "milestonevisit" || studyType === "milestone(visit wise)") {
          const visitAmountsStr = row["visit amounts"] || row["visitamounts"] || row["visits"] || ""
          if (visitAmountsStr) {
            visitAmounts = visitAmountsStr.split(",").map((amt, idx) => ({
              visitNumber: idx + 1,
              amount: parseFloat(amt.trim()) || 0,
            }))
          }
        }

        return {
          id: `import-${index}`,
          siteName: (() => {
            const fromCsv =
              row["sitename"] ||
              row["site name"] ||
              row["sitecode"] ||
              row["site code"] ||
              ""
            if (fromCsv) return fromCsv
            if (systemSitesEnabled && siteMode.autoAssign) {
              return assignSystemSiteForImportRow(index, sitesForImport, systemSitePrefix).siteName
            }
            return ""
          })(),
          siteId: (() => {
            const fromId = row["siteid"] || row["site id"] || row["site"] || ""
            if (fromId) return fromId
            const fromName =
              row["sitename"] ||
              row["site name"] ||
              row["sitecode"] ||
              row["site code"] ||
              ""
            if (fromName) return resolveSiteIdFromNameOrCode(fromName, sitesForImport) || fromName
            if (systemSitesEnabled && siteMode.autoAssign) {
              return assignSystemSiteForImportRow(index, sitesForImport, systemSitePrefix).siteId
            }
            return ""
          })(),
          emailId: row["emailid"] || row["email id"] || row["email"] || "",
          mobileNo: row["mobileno"] || row["mobile no"] || row["mobile"] || row["phone"] || "",
          doctorName: row["doctorname"] || row["doctor name"] || row["name"] || "",
          MicrCode: row["micrcode"] || row["micr code"] || row["code"] || "",
          pinCode: row["pincode"] || row["pin code"] || row["pin"] || "",
          State: row["state"] || "",
          City: row["city"] || "",
          address: row["address"] || "",
          pan: row["pannumber"] || row["pan"] || "",
          GstNo: row["gstno"] || "",
          sapVendorCode: row["sapvendorcode"] || row["sap vendor code"] || row["sap code"] || "",
          noOfPlannedPatients: noOfPlannedPatients.toString(),
          totalPaymentAmount: totalPaymentAmount.toString(),
          region: row["region"] || "",
          division: row["division"] || "",
          area: row["area"] || "",
          hq: row["hq"] || "",
          zone: row["zone"] || "",
          speciality: row["speciality"] || row["specialty"] || "",
          studyId: row["study id"] || row["studyid"] || row["study"] || defaultStudyId || "",
          studyType: studyType === "milestonepatient" || studyType === "milestone(patient wise)"
            ? "milestonePatient"
            : studyType === "milestonevisit" || studyType === "milestone(visit wise)"
              ? "milestoneVisit"
              : defaultStudyType || "normal",
          numberOfMilestones: numberOfMilestones,
          milestones: milestones,
          visitAmounts: visitAmounts,
        }
      })

      // Don't check for missing fields during upload - only show data preview
      if (mappedData.length === 0) {
        setDoctorError("No valid data rows found in CSV file. Please check the file format.")
        setImportLoading(false)
        return
      }

      if (siteMode.autoAssign) {
        const maxSlots = siteMode.siteCount > 0 ? siteMode.siteCount : 10
        if (mappedData.length > maxSlots) {
          setDoctorError(
            `This file has ${mappedData.length} row(s) but only ${maxSlots} system site slot(s) are configured in Study Settings.`,
          )
          setImportLoading(false)
          event.target.value = ""
          return
        }

        const importStudy =
          studies.find((s) => String(s.studyId) === String(defaultStudyId)) ||
          allStudies.find((s) => String(s.studyId) === String(defaultStudyId))
        const prov = await ensureSystemSitesForStudy(siteService, {
          studyId: parseInt(defaultStudyId, 10),
          siteCount: maxSlots,
          provisionUpTo: mappedData.length,
          prefix: systemSitePrefix,
          studyProtocolNumber: importStudy?.studyProtocolNumber || importStudy?.protocolNumber || "",
          studyService,
        })
        sitesForImport = prov.sitesList

        mappedData.forEach((row, index) => {
          const assignment = assignSystemSiteForImportRow(index, sitesForImport, systemSitePrefix)
          row.siteId = assignment.siteId
          row.siteName = assignment.siteName
        })

        const missingSiteRows = mappedData.filter((row) => !row.siteId)
        if (missingSiteRows.length > 0) {
          setDoctorError(
            prov.lastError ||
              "Could not create system sites for import. Check Study Settings and try again.",
          )
          setImportLoading(false)
          event.target.value = ""
          return
        }
        const enrichedCsv = injectSiteIdsIntoStudyUserCsv(
          text,
          mappedData.map((row) => row.siteId),
        )
        setImportFile(new File([enrichedCsv], file.name, { type: "text/csv" }))
      } else {
        setImportFile(file)
      }

      setImportPreview(mappedData)
      setImportedData(mappedData)
      setMissingColumns([]) // Clear any previous missing columns errors
      setDoctorSuccess(`Successfully imported ${mappedData.length} record(s)`)
      setTimeout(() => setDoctorSuccess(""), 3000)
    } catch (error) {
      console.error("CSV parsing error:", error)
      setDoctorError(`Failed to parse CSV file: ${error.message || "Please check the file format and ensure it matches the template."}`)
    } finally {
      setImportLoading(false)
    }
  }

  const applyBulkImportResult = useCallback((response) => {
    const hasResultData = response.data && typeof response.data === "object"
    const failedCount = hasResultData ? response.data.failedCount || 0 : 0
    const successCount = hasResultData ? response.data.successCount || 0 : 0
    const failedRowsData = hasResultData ? response.data.failedRows || [] : []
    const newUserCredentials = hasResultData ? response.data.newUserCredentials || [] : []

    if (isSuperAdmin && newUserCredentials.length > 0) {
      setImportCredentials(newUserCredentials)
    }

    const updatePreviewWithErrors = () => {
      if (failedCount > 0 && failedRowsData.length > 0) {
        setImportPreview((prev) => {
          if (!prev?.length) return prev
          return applyFailedRowsToImportPreview(prev, failedRowsData)
        })
        setImportedData((prev) => {
          if (!prev?.length) return prev
          return applyFailedRowsToImportPreview(prev, failedRowsData)
        })
      }
    }

    if (response.success) {
      const successMessage = response.message || "Study users imported successfully!"
      updatePreviewWithErrors()

      if (failedCount > 0) {
        setDoctorError(`${failedCount} row(s) failed to import. Please check the errors below.`)
      }

      if (response.errors?.length > 0) {
        setDoctorError(response.errors.join("; "))
      }

      if (hasResultData && failedCount === 0 && !(isSuperAdmin && newUserCredentials.length > 0)) {
        setDoctorSuccess(successMessage)
        setTimeout(() => {
          setImportPreview([])
          setImportedData([])
          setImportFile(null)
          setImportMode(false)
          setDoctorSuccess("")
          setMissingColumns([])
        }, 5000)
      } else {
        setDoctorSuccess(successMessage)
        if (!(isSuperAdmin && newUserCredentials.length > 0)) {
          setTimeout(() => setDoctorSuccess(""), 5000)
        }
      }
    } else {
      let errorMessage = response.message || "Failed to import study users"

      if (response.statusCode === 400) {
        if (errorMessage.includes("Study ID is required")) {
          errorMessage = "Study ID is required"
        } else if (errorMessage.includes("CSV file is required")) {
          errorMessage = "CSV file is required"
        }
      } else if (response.statusCode === 401) {
        errorMessage = "Unauthorized. Please log in again."
      } else if (response.statusCode === 403) {
        errorMessage = response.message || "You do not have permission to create study users"
      } else if (response.statusCode === 500) {
        errorMessage = response.message || "An error occurred while processing your request"
      }

      updatePreviewWithErrors()

      if (response.partial && successCount > 0) {
        setDoctorSuccess(`Partially imported: ${successCount} user(s) created before import stopped.`)
      }

      if (hasResultData && failedCount > 0) {
        errorMessage = response.message || `Import finished: ${successCount} successful, ${failedCount} failed`
      }

      setDoctorError(errorMessage)
    }
  }, [isSuperAdmin])

  // Start bulk creation in background (chunked API calls; user can navigate away)
  const handleBulkCreate = useCallback(() => {
    if (!importFile) {
      setDoctorError("No file to import")
      return
    }

    if (!defaultStudyId) {
      setDoctorError("Please select a default study for import")
      return
    }

    if (hasRunningImport) {
      setDoctorError("An import is already running in the background. Please wait for it to finish.")
      return
    }

    const rowCount = importPreview.length
    const started = startStudyUserImport({
      file: importFile,
      studyId: defaultStudyId,
      totalRows: rowCount,
      onComplete: applyBulkImportResult,
    })

    if (!started) {
      setDoctorError("Could not start import. Another import may already be running.")
      return
    }

    setDoctorError("")
    setDoctorSuccess(
      `Import started (${rowCount.toLocaleString()} users). Use the progress popup — minimize it to the corner to keep working while import runs.`
    )
    setTimeout(() => setDoctorSuccess(""), 8000)
  }, [
    importFile,
    defaultStudyId,
    importPreview.length,
    hasRunningImport,
    startStudyUserImport,
    applyBulkImportResult,
  ])

  // Clear import state so user can upload a new file for next batch
  const handleClearImport = () => {
    setImportPreview([])
    setImportedData([])
    setImportFile(null)
    setImportCredentials([])
    setMissingColumns([])
    setDoctorSuccess("")
    setDoctorError("")
    setCsvUploadKey((k) => k + 1)
  }

  const handleExportImportCredentials = () => {
    const stamp = new Date().toISOString().split("T")[0]
    const downloaded = downloadStudyUserCredentialsCsv(
      importCredentials,
      `study-user-credentials-${stamp}.csv`
    )
    if (downloaded) {
      setDoctorSuccess(`Downloaded credentials for ${importCredentials.length} new user(s).`)
      setTimeout(() => setDoctorSuccess(""), 5000)
    }
  }

  // Download CSV template — system-site studies omit site column (auto-assigned); others use API template (SiteId*)
  const downloadTemplate = async () => {
    if (!defaultStudyId) {
      setDoctorError("Please select a Default Study before downloading the template")
      setTimeout(() => setDoctorError(""), 3000)
      return
    }

    try {
      setImportLoading(true)
      setDoctorError("")

      const settingsRes = await fetchStudySettingsByStudyId(defaultStudyId, {
        preferFullEndpoint: true,
        forceRefresh: true,
      })
      const siteMode = resolveSystemSiteModeForStudy(defaultStudyId, settingsRes?.data ?? {})
      const sitePaymentEnabled = pickIsSitePaymentEnabled(settingsRes?.data ?? settingsRes)
      setDefaultStudySitePaymentEnabled(sitePaymentEnabled)
      setDefaultStudySystemSitesEnabled(siteMode.enabled)

      if (siteMode.autoAssign) {
        const selectedStudy = filteredStudiesForDefault.find(
          (s) => String(s.studyId || s.code) === String(defaultStudyId),
        )
        const importStudyType = resolveImportStudyType(defaultStudyType, selectedStudy)
        const studyLabel = selectedStudy?.studyProtocolNumber || `study-${defaultStudyId}`

        let templateCsv = null
        const sampleRes = await studyUserService.fetchStudyUserSampleCsvText(parseInt(defaultStudyId, 10))
        if (sampleRes?.isSuccess && sampleRes.data) {
          templateCsv = stripSiteColumnsFromStudyUserCsv(sampleRes.data)
          if (!sitePaymentEnabled) {
            templateCsv = stripPaymentColumnsFromStudyUserCsv(templateCsv)
          }
        }

        const ok = downloadSystemSiteStudyUserTemplateCsv(
          studyLabel,
          importStudyType,
          templateCsv,
          sitePaymentEnabled,
        )
        if (ok) {
          const typeHint =
            importStudyType === "milestonePatient"
              ? " Includes NumberOfMilestones* for patient-wise milestone studies."
              : importStudyType === "milestoneVisit"
                ? " Includes VisitAmounts* (comma-separated) for visit-wise milestone studies."
                : ""
          setDoctorSuccess(
            `System-site template downloaded. Sites auto-assigned by row order (s-01, s-02, …).${typeHint}`,
          )
          setTimeout(() => setDoctorSuccess(""), 4000)
        } else {
          setDoctorError("Failed to download system-site template")
          setTimeout(() => setDoctorError(""), 3000)
        }
        return
      }

      const response = await studyUserService.downloadSampleCsv(parseInt(defaultStudyId, 10))

      if (response.isSuccess || response.success) {
        setDoctorSuccess("Template downloaded successfully!")
        setTimeout(() => setDoctorSuccess(""), 3000)
      } else {
        setDoctorError(response.message || "Failed to download template")
        setTimeout(() => setDoctorError(""), 3000)
      }
    } catch (error) {
      setDoctorError("Failed to download template: " + (error.message || "Unknown error"))
      setTimeout(() => setDoctorError(""), 3000)
    } finally {
      setImportLoading(false)
    }
  }


  return (
    <DashboardLayout>
      <div className={USER_MASTER_PAGE_CANVAS_CLASS}>
        <div className={USER_MASTER_CARD_CLASS}>
          {/* Tabs */}
          <div className={USER_MASTER_TAB_BAR_CLASS}>
            <button
              type="button"
              onClick={() => setActiveTab("create")}
              className={userMasterTabClass(activeTab === "create")}
            >
              Create User
              {activeTab === "create" ? <div className={USER_MASTER_TAB_ACTIVE_BAR_CLASS} aria-hidden /> : null}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("doctor")}
              className={userMasterTabClass(activeTab === "doctor")}
            >
              Create CRC User
              {activeTab === "doctor" ? <div className={USER_MASTER_TAB_ACTIVE_BAR_CLASS} aria-hidden /> : null}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("manage")}
              className={userMasterTabClass(activeTab === "manage")}
            >
              Manage Users
              {activeTab === "manage" ? <div className={USER_MASTER_TAB_ACTIVE_BAR_CLASS} aria-hidden /> : null}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("crcManage")}
              className={userMasterTabClass(activeTab === "crcManage")}
            >
              Manage CRC Users
              {activeTab === "crcManage" ? <div className={USER_MASTER_TAB_ACTIVE_BAR_CLASS} aria-hidden /> : null}
            </button>
          </div>

          {/* Form Content */}
          <div className={USER_MASTER_PANEL_CLASS}>
            {activeTab === "create" ? (
              <form onSubmit={handleSubmit} className="space-y-8">
                {success ? (
                  <div className={USER_MASTER_ALERT_SUCCESS_CLASS} role="status">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500">
                      <CheckCircle className="h-3 w-3 text-white" aria-hidden />
                    </div>
                    <p className="text-sm font-semibold text-emerald-700">{success}</p>
                  </div>
                ) : null}

                {error ? (
                  <div className={USER_MASTER_ALERT_ERROR_CLASS} role="alert">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500">
                      <X className="h-3 w-3 text-white" aria-hidden />
                    </div>
                    <p className="text-sm font-semibold text-red-700">{error}</p>
                  </div>
                ) : null}

                <div className="space-y-6">
                  <div className={USER_MASTER_FORM_GRID_CLASS}>
                    <div>
                      <label className={USER_MASTER_FORM_LABEL_CLASS} htmlFor="create-user-role">
                        Select User Role <span className="text-red-500">*</span>
                      </label>
                      <SearchableSelect
                        value={String(formData.roleGuid || "")}
                        options={filteredRoles.map((role) => ({
                          value: String(role.guid || ""),
                          label: String(role.name || ""),
                        }))}
                        onChange={(val) => {
                          const selectedRole = filteredRoles.find((role) => String(role.guid) === String(val))
                          setFormData((prev) => ({
                            ...prev,
                            roleGuid: val,
                            roleName: selectedRole ? selectedRole.name : "",
                          }))
                        }}
                        placeholder={loadingRoles ? "Loading roles..." : "-- Select Role --"}
                        disabled={loadingRoles}
                        showSearch
                        searchIconPosition="end"
                        className={USER_MASTER_FORM_SELECT_CLASS}
                        contentClassName="z-[180]"
                      />
                    </div>

                    <div>
                      <label className={USER_MASTER_FORM_LABEL_CLASS} htmlFor="create-user-employee-no">
                        Employee No
                      </label>
                      <input
                        id="create-user-employee-no"
                        type="text"
                        value={formData.employeeNo}
                        onChange={(e) => handleInputChange("employeeNo", e.target.value, 20)}
                        className={USER_MASTER_FORM_INPUT_CLASS}
                        placeholder="Enter employee number"
                        autoComplete="off"
                      />
                      <p className={USER_MASTER_FORM_HINT_CLASS}>{formData.employeeNo.length} / 20</p>
                    </div>
                  </div>

                  <div className={USER_MASTER_FORM_GRID_CLASS}>
                    <div>
                      <label className={USER_MASTER_FORM_LABEL_CLASS} htmlFor="create-user-first-name">
                        First Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="create-user-first-name"
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => handleInputChange("firstName", e.target.value, 50)}
                        className={USER_MASTER_FORM_INPUT_CLASS}
                        placeholder="Enter first name"
                        required
                        autoComplete="given-name"
                      />
                      <p className={USER_MASTER_FORM_HINT_CLASS}>{formData.firstName.length} / 50</p>
                    </div>

                    <div>
                      <label className={USER_MASTER_FORM_LABEL_CLASS} htmlFor="create-user-last-name">
                        Last Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="create-user-last-name"
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => handleInputChange("lastName", e.target.value, 50)}
                        className={USER_MASTER_FORM_INPUT_CLASS}
                        placeholder="Enter last name"
                        autoComplete="family-name"
                      />
                      <p className={USER_MASTER_FORM_HINT_CLASS}>{formData.lastName.length} / 50</p>
                    </div>
                  </div>

                  <div className={USER_MASTER_FORM_GRID_CLASS}>
                    <div>
                      <label className={USER_MASTER_FORM_LABEL_CLASS} htmlFor="create-user-email">
                        Email Id <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="create-user-email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value, 50)}
                        pattern="[a-zA-Z0-9._+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}"
                        title="e.g. abc@gmail.com"
                        className={USER_MASTER_FORM_INPUT_CLASS}
                        placeholder="e.g. abc@gmail.com"
                        required
                        autoComplete="email"
                      />
                      <p className={USER_MASTER_FORM_HINT_CLASS}>{formData.email.length} / 50</p>
                    </div>

                    <div>
                      <label className={USER_MASTER_FORM_LABEL_CLASS} htmlFor="create-user-phone">
                        Phone Number
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
                        <input
                          id="create-user-phone"
                          type="tel"
                          value={formData.phoneNumber}
                          onChange={(e) => handleInputChange("phoneNumber", e.target.value, 10)}
                          className={`${USER_MASTER_FORM_INPUT_CLASS} pl-12`}
                          placeholder="1234567890"
                          autoComplete="tel"
                          inputMode="numeric"
                        />
                      </div>
                      <p className={USER_MASTER_FORM_HINT_CLASS}>{formData.phoneNumber.length} / 10</p>
                    </div>
                  </div>

                  {isSuperAdmin ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <Label htmlFor="create-user-test-account" className="text-sm font-semibold text-slate-800">
                            Test account
                          </Label>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            Excludes this user from finance reporting when assigned as a CRC investigator.
                          </p>
                        </div>
                        <Switch
                          id="create-user-test-account"
                          checked={formData.isTestAccount}
                          onCheckedChange={(checked) =>
                            setFormData((prev) => ({ ...prev, isTestAccount: checked === true }))
                          }
                        />
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className={USER_MASTER_ACTIONS_CLASS}>
                  <button
                    type="button"
                    onClick={resetCreateUserForm}
                    className={USER_MASTER_BTN_CLEAR_CLASS}
                  >
                    Clear
                  </button>
                  <button type="submit" disabled={loading} className={USER_MASTER_BTN_SUBMIT_CLASS}>
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Creating User...
                      </span>
                    ) : (
                      "Create User"
                    )}
                  </button>
                </div>
              </form>
            ) : activeTab === "doctor" ? (
              <div className="space-y-8">
                {/* Mode Toggle */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-slate-700">Creation Mode</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setImportMode(false)
                          setImportPreview([])
                          setImportedData([])
                          setImportFile(null)
                          setMissingColumns([])
                        }}
                        className={`px-6 py-2 rounded-lg border-2 transition-all text-sm font-semibold ${!importMode
                          ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                          : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                          }`}
                      >
                        Single Entry
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportMode(true)}
                        className={`px-6 py-2 rounded-lg border-2 transition-all text-sm font-semibold ${importMode
                          ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                          : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                          }`}
                      >
                        Import Multiple
                      </button>
                    </div>
                  </div>
                </div>

                {/* Import Mode */}
                {importMode ? (
                  <div className="space-y-6">
                    {/* Success Message */}
                    {doctorSuccess && (
                      <div className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 border-l-4 border-emerald-500 rounded-lg shadow-sm flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <p className="text-sm font-semibold text-emerald-700">{doctorSuccess}</p>
                      </div>
                    )}

                    {isSuperAdmin && importCredentials.length > 0 && importPreview.length === 0 ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-amber-900">
                              {importCredentials.length} new login credential(s) ready to export
                            </p>
                            <p className="mt-1 text-xs text-amber-800">
                              Download the CSV and share passwords securely. They are not shown in Manage Users.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleExportImportCredentials}
                            className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 shadow-sm hover:bg-amber-100"
                          >
                            <Download className="h-4 w-4" />
                            Export credentials CSV
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {/* Error Message - Hide if missing columns (shown in preview section instead) */}
                    {doctorError && missingColumns.length === 0 && (() => {
                      let errorData = null
                      try {
                        errorData = JSON.parse(doctorError)
                      } catch (e) {
                        // Not JSON, treat as plain string
                      }
                      
                      return (
                        <div className="p-4 bg-gradient-to-r from-red-50 to-rose-50 border-l-4 border-red-500 rounded-lg shadow-sm">
                          <div className="flex items-start gap-3">
                            <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                            <div className="flex-1">
                              {errorData && errorData.additionalErrors && errorData.additionalErrors.length > 0 ? (
                                <div className="space-y-3">
                                  <p className="text-sm font-semibold text-red-700 mb-2">{errorData.message || "Import failed"}</p>
                                  <div className="mt-3 pt-3 border-t border-red-200">
                                    <p className="text-xs font-semibold text-red-600 mb-1">Additional errors:</p>
                                    <ul className="list-disc list-inside space-y-1">
                                      {errorData.additionalErrors.map((err, idx) => (
                                        <li key={idx} className="text-xs text-red-700">{err}</li>
                                      ))}
                                    </ul>
                      </div>
                                </div>
                              ) : (
                                <p className="text-sm font-semibold text-red-700 whitespace-pre-line">{doctorError}</p>
                    )}
                            </div>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Default Study Type and Study Selection - MANDATORY */}
                    <div className="bg-emerald-50 rounded-xl p-6 border-2 border-emerald-300">
                      <div className="flex items-center gap-2 mb-4">
                        <h3 className="text-lg font-semibold text-slate-900">Default Settings for Import</h3>
                        <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded">REQUIRED</span>
                      </div>
                      <p className="text-sm text-slate-600 mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <strong>⚠️ Important:</strong> {doctorFormData.studyId 
                          ? "Default settings are auto-filled from the study selected above. You can upload your CSV file now."
                          : "You must select both Default Study Type and Default Study before uploading your CSV file."}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2.5">
                            Default Study Type <span className="text-red-500">*</span>
                            {doctorFormData.studyId && (
                              <span className="ml-2 text-xs text-slate-500 font-normal">(Auto-filled from selected study)</span>
                            )}
                          </label>
                          <select
                            value={defaultStudyType}
                            onChange={(e) => {
                              if (doctorFormData.studyId) return // Prevent changes if study is selected in main form
                              const newStudyType = e.target.value
                              setDefaultStudyType(newStudyType)
                              
                              // Clear default study if it doesn't match the new study type
                              if (defaultStudyId) {
                                // Check if current selected study matches the new type
                                const currentStudy = (allStudies.length > 0 ? allStudies : studies).find(
                                  s => String(s.studyId) === defaultStudyId
                                )
                                if (currentStudy) {
                                  const studyType = currentStudy.studyType || currentStudy.study_type || currentStudy.type || currentStudy.StudyType
                                  let targetStudyType = null
                                  if (newStudyType === "normal") {
                                    targetStudyType = 1
                                  } else if (newStudyType === "milestonePatient") {
                                    targetStudyType = 2
                                  } else if (newStudyType === "milestoneVisit") {
                                    targetStudyType = 3
                                  }
                                  
                                  // Clear if study type doesn't match
                                  if (targetStudyType !== null && studyType !== targetStudyType && studyType !== String(targetStudyType)) {
                                    setDefaultStudyId("")
                                  }
                                } else {
                                  setDefaultStudyId("")
                                }
                              }
                              
                              // Apply to all imported rows if any exist
                              if (importPreview.length > 0) {
                                setImportPreview((prev) =>
                                  prev.map((row) => ({ ...row, studyType: newStudyType }))
                                )
                                setImportedData((prev) =>
                                  prev.map((row) => ({ ...row, studyType: newStudyType }))
                                )
                              }
                            }}
                            className={`w-full px-4 py-3 rounded-xl border-2 focus:ring-4 focus:ring-emerald-100 outline-none transition-all ${
                              doctorFormData.studyId 
                                ? "bg-slate-50 text-slate-600 cursor-not-allowed border-slate-200" 
                                : "bg-white text-slate-800"
                            } ${!defaultStudyType ? "border-red-300 focus:border-red-500" : "border-slate-300 focus:border-emerald-500"}`}
                            disabled={!!doctorFormData.studyId}
                            required
                          >
                            <option value="">-- Select Study Type --</option>
                            <option value="normal">Normal</option>
                            <option value="milestonePatient">Milestone (Patient Wise)</option>
                            <option value="milestoneVisit">Milestone (Visit Wise)</option>
                          </select>
                          <p className="text-xs text-slate-500 mt-2">
                            {doctorFormData.studyId 
                              ? "Auto-filled from the study selected above" 
                              : "This will be applied to all imported rows if not specified in CSV"}
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2.5">
                            Default Study <span className="text-red-500">*</span>
                            {doctorFormData.studyId && (
                              <span className="ml-2 text-xs text-slate-500 font-normal">(Auto-filled from selected study)</span>
                            )}
                          </label>
                          <select
                            value={defaultStudyId}
                            onChange={(e) => {
                              if (doctorFormData.studyId) return // Prevent changes if study is selected in main form
                              setDefaultStudyId(e.target.value)
                              // Apply to all imported rows if any exist
                              if (importPreview.length > 0) {
                                setImportPreview((prev) =>
                                  prev.map((row) => ({ ...row, studyId: e.target.value }))
                                )
                                setImportedData((prev) =>
                                  prev.map((row) => ({ ...row, studyId: e.target.value }))
                                )
                              }
                            }}
                            className={`w-full px-4 py-3 rounded-xl border-2 focus:ring-4 focus:ring-emerald-100 outline-none transition-all ${
                              doctorFormData.studyId 
                                ? "bg-slate-50 text-slate-600 cursor-not-allowed border-slate-200" 
                                : "bg-white text-slate-800"
                            } ${!defaultStudyId ? "border-red-300 focus:border-red-500" : "border-slate-300 focus:border-emerald-500"}`}
                            disabled={loadingStudies || !defaultStudyType || !!doctorFormData.studyId}
                            required
                          >
                            <option value="">-- Select Study --</option>
                            {filteredStudiesForDefault.map((study) => (
                              <option key={study.studyId} value={study.studyId || study.code}>
                                {study.studyProtocolNumber}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-slate-500 mt-2">
                            {doctorFormData.studyId 
                              ? "Auto-filled from the study selected above" 
                              : "This will be applied to all imported rows if not specified in CSV"}
                          </p>
                          {loadingStudies && (
                            <p className="text-xs text-slate-500 mt-2">Loading studies...</p>
                          )}
                        </div>
                      </div>
                      {importPreview.length > 0 && (
                        <div className="mt-4 p-3 bg-white rounded-lg border border-emerald-200">
                          <p className="text-sm text-emerald-700">
                            <strong>Note:</strong> Default settings have been applied to all {importPreview.length} imported row(s).
                            You can still edit individual rows in the preview table below.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* File Upload Section */}
                    <div className="bg-white rounded-xl p-6 border border-slate-200">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">Import CSV File</h3>
                          <p className="text-sm text-slate-600 mt-1">
                            Upload a CSV file with multiple Doctor/CRC user records (up to{" "}
                            {STUDY_USER_IMPORT_MAX_DATA_ROWS.toLocaleString()} rows). Imports run in the
                            background in batches of {STUDY_USER_IMPORT_BATCH_SIZE} so you can keep working.
                          </p>
                          {defaultStudySystemSitesEnabled ? (
                            <p className="mt-2 text-xs font-medium text-teal-800">
                              System sites enabled — no site column needed (row 1 → <strong>s-01</strong>, row 2 →{" "}
                              <strong>s-02</strong>, …).
                              {defaultStudyType === "milestonePatient" ? (
                                <>
                                  {" "}
                                  Milestone study: include <strong>NumberOfMilestones*</strong> in the template.
                                </>
                              ) : null}
                              {defaultStudyType === "milestoneVisit" ? (
                                <>
                                  {" "}
                                  Milestone study: include <strong>VisitAmounts*</strong> (comma-separated amounts).
                                </>
                              ) : null}
                            </p>
                          ) : (
                            <p className="mt-2 text-xs text-slate-500">
                              Manual sites — template uses <strong>SiteId*</strong> (numeric site id).
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={downloadTemplate}
                          disabled={!defaultStudyId || importLoading}
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-semibold ${
                            !defaultStudyId || importLoading
                              ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                              : "bg-slate-100 text-slate-700 hover:bg-blue-50"
                          }`}
                        >
                          {importLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Downloading...
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4" />
                              Download Template
                            </>
                          )}
                        </button>
                      </div>

                      <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${!defaultStudyId || !defaultStudyType
                        ? "border-red-300 bg-red-50/30 cursor-not-allowed"
                        : "border-slate-300 hover:border-emerald-400"
                        }`}>
                        <input
                          key={`csv-upload-${csvUploadKey}`}
                          type="file"
                          accept=".csv"
                          onChange={handleFileUpload}
                          className="hidden"
                          id="csv-upload"
                          disabled={importLoading || !defaultStudyId || !defaultStudyType}
                        />
                        <label
                          htmlFor="csv-upload"
                          className={`flex flex-col items-center gap-4 ${!defaultStudyId || !defaultStudyType ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                            }`}
                        >
                          {importLoading ? (
                            <>
                              <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
                              <p className="text-slate-600 font-medium">Processing file...</p>
                            </>
                          ) : (
                            <>
                              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                                <Upload className="w-8 h-8 text-emerald-600" />
                              </div>
                              <div>
                                {!defaultStudyId || !defaultStudyType ? (
                                  <>
                                    <p className="text-red-600 font-semibold mb-1">
                                      Please select Default Settings above first
                                    </p>
                                    <p className="text-sm text-red-500">Default Study Type and Study are required</p>
                                  </>
                                ) : (
                                  <>
                                    <p className="text-slate-900 font-semibold mb-1">
                                      Click to upload or drag and drop
                                    </p>
                                    <p className="text-sm text-slate-500">CSV file only</p>
                                  </>
                                )}
                              </div>
                              {importFile && (
                                <p className="text-sm text-emerald-600 font-medium">
                                  Selected: {importFile.name}
                                </p>
                              )}
                            </>
                          )}
                        </label>
                      </div>
                    </div>

                    {/* Preview Section */}
                    {(importPreview.length > 0 || missingColumns.length > 0) && (
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        {/* Missing Columns Alert */}
                        {missingColumns.length > 0 && (
                          <div className="p-6 bg-gradient-to-r from-red-50 to-rose-50 border-b-2 border-red-300">
                            <div className="flex items-start justify-between gap-3 mb-4">
                              <div className="flex items-start gap-3 flex-1">
                                <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </div>
                                <div className="flex-1">
                                  <h4 className="text-base font-semibold text-red-700 mb-3">Missing Required Columns in CSV File</h4>
                                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                    {missingColumns.map((column, index) => (
                                      <div key={index} className="px-3 py-2 bg-red-100 border border-red-300 rounded-md">
                                        <p className="text-xs font-medium text-red-800">{column}</p>
                                      </div>
                                    ))}
                                  </div>
                                  <p className="text-xs text-red-600 mt-3">
                                    Please add these columns to your CSV file and try importing again.
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={handleClearImport}
                                className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-slate-300 text-slate-600 font-semibold hover:bg-white hover:border-slate-400 transition-all"
                              >
                                <RotateCw className="w-4 h-4" />
                                Clear
                              </button>
                            </div>
                          </div>
                        )}
                        
                        {importPreview.length > 0 && (
                          <>
                        <div className="p-6 border-b border-slate-200">
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                              <h3 className="text-lg font-semibold text-slate-900">Preview Imported Data</h3>
                              <div className="flex items-center gap-4 mt-1">
                                <p className="text-sm text-slate-600">
                                  {importPreview.length} record(s) imported
                                </p>
                                {importPreview.filter(row => row.isFailed === true).length > 0 && (
                                  <p className="text-sm text-red-600 font-semibold">
                                    {importPreview.filter(row => row.isFailed === true).length} row(s) failed (see reason below)
                                  </p>
                                )}
                                {importPreview.filter(row => row.missingFields && row.missingFields.length > 0).length > 0 && (
                                  <p className="text-sm text-red-600 font-semibold">
                                    {importPreview.filter(row => row.missingFields && row.missingFields.length > 0).length} row(s) with missing fields
                                  </p>
                                )}
                                {importPreview.filter(row => !row.isFailed && (!row.missingFields || row.missingFields.length === 0)).length > 0 && (
                                  <p className="text-sm text-emerald-600 font-semibold">
                                    {importPreview.filter(row => !row.isFailed && (!row.missingFields || row.missingFields.length === 0)).length} row(s) complete
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={handleClearImport}
                                disabled={hasRunningImport}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border-2 border-slate-300 text-slate-600 font-semibold hover:bg-slate-50 hover:border-slate-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <RotateCw className="w-4 h-4" />
                                Clear
                              </button>
                              <button
                                type="button"
                                onClick={handleBulkCreate}
                                disabled={hasRunningImport || !defaultStudyId}
                                className="px-6 py-3 bg-gradient-to-r btn-brand-gradient text-white font-semibold rounded-lg  transition-all shadow-lg shadow-violet-200 hover:shadow-xl hover:shadow-violet-300 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {hasRunningImport
                                  ? "Import running in background…"
                                  : `Create ${importPreview.length} Users`}
                              </button>
                            </div>
                          </div>
                        </div>

                        {isSuperAdmin && importCredentials.length > 0 ? (
                          <div className="border-b border-amber-200 bg-amber-50 px-6 py-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-amber-900">
                                  {importCredentials.length} new login account(s) created
                                </p>
                                <p className="mt-1 text-xs text-amber-800">
                                  SMTP may be off — export credentials and share them securely. Passwords are not stored in Manage Users.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={handleExportImportCredentials}
                                className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 shadow-sm hover:bg-amber-100"
                              >
                                <Download className="h-4 w-4" />
                                Export credentials CSV
                              </button>
                            </div>
                          </div>
                        ) : null}

                        <div className={`${USER_MASTER_TABLE_SCROLL_CLASS} max-h-[600px] overflow-y-auto`}>
                          <table className={USER_MASTER_MANAGE_CRC_TABLE_CLASS}>
                            <thead className="bg-slate-50 sticky top-0">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Row</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Doctor Name</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Email</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Mobile</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Address</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Pin Code</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">PAN</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Region</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Patients</th>
                                {defaultStudySitePaymentEnabled ? (
                                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Amount</th>
                                ) : null}
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Site</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Missing Fields</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Status</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-100">
                              {importPreview.map((row, index) => {
                                // Use missingFields from API response if available, otherwise check frontend data
                                const hasMissingFields = row.missingFields && row.missingFields.length > 0
                                const isFailed = row.isFailed === true
                                
                                // Helper to check if a field is in missingFields array
                                const isFieldMissing = (fieldName) => {
                                  if (!hasMissingFields) return false
                                  return row.missingFields.some(f => 
                                    f.toLowerCase() === fieldName.toLowerCase() ||
                                    f.toLowerCase().replace(/\s+/g, '') === fieldName.toLowerCase().replace(/\s+/g, '')
                                  )
                                }
                                
                                return (
                                  <tr key={row.id || index} className={`hover:bg-slate-50 ${hasMissingFields || isFailed ? "bg-red-50/30" : ""}`}>
                                    <td className="px-4 py-3 text-sm font-medium text-slate-600">{index + 1}</td>
                                    <td className={`px-4 py-3 text-sm ${isFieldMissing("DoctorName") ? "text-red-600 font-semibold" : "text-slate-900"}`}>
                                      {row.doctorName || "—"}
                                    </td>
                                    <td className={`px-4 py-3 text-sm ${isFieldMissing("EmailId") ? "text-red-600 font-semibold" : "text-slate-700"}`}>
                                      {row.emailId || "—"}
                                    </td>
                                  <td className="px-4 py-3 text-sm text-slate-700">{row.mobileNo || "—"}</td>
                                    <td className={`px-4 py-3 text-sm ${isFieldMissing("Address") ? "text-red-600 font-semibold" : "text-slate-700"}`}>
                                      {row.address || "—"}
                                    </td>
                                    <td className={`px-4 py-3 text-sm ${isFieldMissing("PinCode") ? "text-red-600 font-semibold" : "text-slate-700"}`}>
                                      {row.pinCode || "—"}
                                    </td>
                                    <td className={`px-4 py-3 text-sm ${isFieldMissing("PanNumber") ? "text-red-600 font-semibold" : "text-slate-700"}`}>
                                      {row.pan || "—"}
                                    </td>
                                    <td className={`px-4 py-3 text-sm ${isFieldMissing("Region") ? "text-red-600 font-semibold" : "text-slate-700"}`}>
                                      {row.region || "—"}
                                    </td>
                                    <td className={`px-4 py-3 text-sm ${isFieldMissing("NoOfPlannedPatients") ? "text-red-600 font-semibold" : "text-slate-700"}`}>
                                      {row.noOfPlannedPatients || "—"}
                                    </td>
                                    {defaultStudySitePaymentEnabled ? (
                                      <td className={`px-4 py-3 text-sm ${isFieldMissing("TotalHonorariumAmount") ? "text-red-600 font-semibold" : "text-slate-700"}`}>
                                        {row.totalPaymentAmount ? `₹${parseInt(row.totalPaymentAmount).toLocaleString()}` : "—"}
                                      </td>
                                    ) : null}
                                    <td className={`px-4 py-3 text-sm ${isFieldMissing("SiteId") ? "text-red-600 font-semibold" : "text-slate-700"}`}>
                                      {row.siteName || row.siteId || "—"}
                                    </td>
                                    <td className="px-4 py-3">
                                      {isFailed && row.apiError ? (
                                        <div className="text-xs text-red-700 font-medium bg-red-50 border border-red-200 rounded px-2 py-1.5" title={row.apiError}>
                                          {row.apiError}
                                        </div>
                                      ) : hasMissingFields ? (
                                        <div className="flex flex-wrap gap-1">
                                          {row.missingFields.slice(0, 3).map((field, idx) => (
                                            <span key={idx} className="px-2 py-1 text-xs bg-red-100 text-red-700 border border-red-300 rounded">
                                              {field}
                                            </span>
                                          ))}
                                          {row.missingFields.length > 3 && (
                                            <span className="px-2 py-1 text-xs bg-red-100 text-red-700 border border-red-300 rounded">
                                              +{row.missingFields.length - 3}
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-xs text-emerald-600 font-medium">✓ Complete</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      {!hasMissingFields && !isFailed && (defaultStudyId || row.studyId) ? (
                                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                                      ) : (
                                        <X className="w-5 h-5 text-red-500" />
                                      )}
                                    </td>
                                </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                        {!defaultStudyId && (
                          <div className="p-4 bg-amber-50 border-t border-amber-200">
                            <p className="text-sm text-amber-700">
                              <strong>Note:</strong> Please select a default study above before creating users.
                            </p>
                          </div>
                        )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Single Entry Form */
                  <form onSubmit={handleDoctorSubmit} className="space-y-8">
                    {/* Success Message */}
                    {doctorSuccess && (
                      <div className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 border-l-4 border-emerald-500 rounded-lg shadow-sm flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <p className="text-sm font-semibold text-emerald-700">{doctorSuccess}</p>
                      </div>
                    )}

                    {/* Error Message - Hide if missing columns (shown in preview section instead) */}
                    {doctorError && missingColumns.length === 0 && (() => {
                      let errorData = null
                      try {
                        errorData = JSON.parse(doctorError)
                      } catch (e) {
                        // Not JSON, treat as plain string
                      }
                      
                      return (
                        <div className="p-4 bg-gradient-to-r from-red-50 to-rose-50 border-l-4 border-red-500 rounded-lg shadow-sm">
                          <div className="flex items-start gap-3">
                            <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                            <div className="flex-1">
                              {errorData && errorData.additionalErrors && errorData.additionalErrors.length > 0 ? (
                                <div className="space-y-3">
                                  <p className="text-sm font-semibold text-red-700 mb-2">{errorData.message || "Import failed"}</p>
                                  <div className="mt-3 pt-3 border-t border-red-200">
                                    <p className="text-xs font-semibold text-red-600 mb-1">Additional errors:</p>
                                    <ul className="list-disc list-inside space-y-1">
                                      {errorData.additionalErrors.map((err, idx) => (
                                        <li key={idx} className="text-xs text-red-700">{err}</li>
                                      ))}
                                    </ul>
                      </div>
                                </div>
                              ) : (
                                <p className="text-sm font-semibold text-red-700 whitespace-pre-line">{doctorError}</p>
                    )}
                            </div>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Study Type Selection */}
                    <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                      <label className="block text-sm font-semibold text-slate-700 mb-4">
                        Study Type <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button
                          type="button"
                          onClick={() => {
                            setDoctorUserType("normal")
                            handleDoctorInputChange("studyId", "") // Clear selected studies
                          }}
                          className={`px-6 py-3 rounded-lg border-2 transition-all text-sm font-semibold ${doctorUserType === "normal"
                            ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                            : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                            }`}
                        >
                          Normal
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDoctorUserType("milestonePatient")
                            handleDoctorInputChange("studyId", "") // Clear selected studies
                          }}
                          className={`px-6 py-3 rounded-lg border-2 transition-all text-sm font-semibold ${doctorUserType === "milestonePatient"
                            ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                            : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                            }`}
                        >
                          Milestone (Patient Wise)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDoctorUserType("milestoneVisit")
                            handleDoctorInputChange("studyId", "") // Clear selected studies
                          }}
                          className={`px-6 py-3 rounded-lg border-2 transition-all text-sm font-semibold ${doctorUserType === "milestoneVisit"
                            ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                            : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                            }`}
                        >
                          Milestone (Visit Wise)
                        </button>
                      </div>
                    </div>

                    {/* Common Fields */}
                    <div className="space-y-6">
                      {/* Study and Site Selection - Above Doctor Name */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Study Selection - Single Select Dropdown */}
                        <div className="relative">
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Study <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={studySearchInput || (doctorFormData.studyId ? studies.find(s => s.studyId === parseInt(doctorFormData.studyId))?.studyProtocolNumber || `Study ${doctorFormData.studyId}` : "")}
                              onChange={(e) => {
                                setStudySearchInput(e.target.value)
                                setIsStudyDropdownOpen(e.target.value.length > 0)
                              }}
                              onFocus={() => {
                                if (!isStudyDropdownOpen) {
                                  setIsStudyDropdownOpen(true)
                                }
                              }}
                              className={`w-full px-4 py-3 rounded-lg border-2 focus:ring-4 focus:ring-blue-100 outline-none bg-white transition-all ${
                                !doctorFormData.studyId
                                  ? "border-red-300 focus:border-red-500"
                                  : "border-slate-200 focus:border-blue-500"
                              }`}
                              placeholder="Select study..."
                              disabled={loadingStudies}
                            />
                            {isStudyDropdownOpen && (
                              <>
                                <div
                                  className="fixed inset-0 z-10"
                                  onClick={() => {
                                    setIsStudyDropdownOpen(false)
                                    setStudySearchInput("")
                                  }}
                                />
                                <div 
                                  className="absolute z-20 w-full mt-1 bg-white border-2 border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {loadingStudies ? (
                                    <div className="px-4 py-3 text-sm text-slate-500">Loading studies...</div>
                                  ) : studies.length === 0 ? (
                                    <div className="px-4 py-3 text-sm text-slate-500">No studies available</div>
                                  ) : (
                                    <div>
                                      {studies
                                        .filter(study => 
                                          !studySearchInput || 
                                          study.studyProtocolNumber?.toLowerCase().includes(studySearchInput.toLowerCase()) ||
                                          String(study.studyId).includes(studySearchInput)
                                        )
                                        .map((study) => (
                                          <div
                                            key={study.studyId}
                                            onClick={() => {
                                              handleDoctorInputChange("studyId", String(study.studyId))
                                              setIsStudyDropdownOpen(false)
                                              setStudySearchInput("")
                                            }}
                                            className={`px-4 py-2 cursor-pointer hover:bg-blue-50 transition-colors ${doctorFormData.studyId === String(study.studyId) ? "bg-blue-100" : ""}`}
                                          >
                                            <div className="text-sm font-medium text-slate-900">
                                              {study.studyProtocolNumber || `Study ${study.studyId}`}
                                            </div>
                                          </div>
                                        ))}
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Site — hidden when system sites auto-assign; manual pick when customizable or normal study */}
                        {doctorSystemSitesAutoAssign && doctorFormData.studyId ? (
                          !doctorAutoSiteLabel ? (
                            <div>
                              <label className="block text-sm font-semibold text-slate-700 mb-2">
                                System site
                              </label>
                              <div className="w-full rounded-lg border-2 border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-amber-900">
                                {doctorSystemSiteCapacity.total > 0 &&
                                doctorSystemSiteCapacity.used >= doctorSystemSiteCapacity.total ? (
                                  <span>All system sites are in use.</span>
                                ) : (
                                  <span>
                                    No system sites found. Save Study Settings with system site creation
                                    enabled.
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : null
                        ) : (
                        <div className="relative">
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Select Site <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={siteSearchInput || (doctorFormData.siteId ? (() => {
                                const selected = sites.find((s) => getSiteRecordId(s) === String(doctorFormData.siteId))
                                return selected?.siteName || selected?.siteFullName || `Site ${doctorFormData.siteId}`
                              })() : "")}
                              onChange={(e) => {
                                setSiteSearchInput(e.target.value)
                                setIsSiteDropdownOpen(e.target.value.length > 0)
                              }}
                              onFocus={() => {
                                if (!isSiteDropdownOpen && doctorFormData.studyId) {
                                  setIsSiteDropdownOpen(true)
                                }
                              }}
                              className={`w-full px-4 py-3 rounded-lg border-2 focus:ring-4 focus:ring-blue-100 outline-none bg-white transition-all ${
                                !doctorFormData.siteId
                                  ? "border-red-300 focus:border-red-500"
                                  : "border-slate-200 focus:border-blue-500"
                              }`}
                              placeholder={!doctorFormData.studyId ? "Please select study first" : "Select site..."}
                              disabled={loadingSites || !doctorFormData.studyId}
                            />
                            {isSiteDropdownOpen && doctorFormData.studyId && (
                              <>
                                <div
                                  className="fixed inset-0 z-10"
                                  onClick={() => {
                                    setIsSiteDropdownOpen(false)
                                    setSiteSearchInput("")
                                  }}
                                />
                                <div 
                                  className="absolute z-20 w-full mt-1 bg-white border-2 border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {loadingSites ? (
                                    <div className="px-4 py-3 text-sm text-slate-500">Loading sites...</div>
                                  ) : sites.length === 0 ? (
                                    <div className="px-4 py-3 text-sm text-slate-500">No sites available</div>
                                  ) : (
                                    <div>
                                      {sites
                                        .filter(site => 
                                          !siteSearchInput || 
                                          site.siteName?.toLowerCase().includes(siteSearchInput.toLowerCase()) ||
                                          site.siteFullName?.toLowerCase().includes(siteSearchInput.toLowerCase()) ||
                                          getSiteRecordId(site).includes(siteSearchInput)
                                        )
                                        .map((site) => {
                                          const siteRecordId = getSiteRecordId(site)
                                          return (
                                          <div
                                            key={siteRecordId}
                                            onClick={() => {
                                              handleDoctorInputChange("siteId", siteRecordId)
                                              setIsSiteDropdownOpen(false)
                                              setSiteSearchInput("")
                                            }}
                                            className={`px-4 py-2 cursor-pointer hover:bg-blue-50 transition-colors ${doctorFormData.siteId === siteRecordId ? "bg-blue-100" : ""}`}
                                          >
                                            <div className="text-sm font-medium text-slate-900">
                                              {site.siteName || site.siteFullName || `Site ${siteRecordId}`}
                                            </div>
                                          </div>
                                        )})}
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                            
                          </div>
                          {loadingSites && (
                            <p className="text-xs text-slate-500 mt-2">Loading sites...</p>
                          )}
                          {!doctorFormData.studyId && (
                            <p className="text-xs text-slate-500 mt-2">Please select a study first</p>
                          )}
                        </div>
                        )}
                      </div>
  
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2.5">
                            Email ID <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="email"
                            value={doctorFormData.emailId}
                            onChange={(e) => handleDoctorInputChange("emailId", e.target.value)}
                            pattern="[a-zA-Z0-9._+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}"
                            title="e.g. abc@gmail.com"
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none transition-all bg-white text-slate-800"
                            placeholder="e.g. abc@gmail.com"
                            required
                            maxLength={255}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2.5">
                            Mobile No. <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="tel"
                            value={doctorFormData.mobileNo}
                            onChange={(e) => handleDoctorInputChange("mobileNo", e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none transition-all bg-white text-slate-800"
                            placeholder="10 digit mobile number"
                            maxLength={10}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2.5">
                            Doctor Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={doctorFormData.doctorName}
                            onChange={(e) => handleDoctorInputChange("doctorName", e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none transition-all bg-white text-slate-800"
                            placeholder="Enter doctor name"
                            required
                            maxLength={200}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2.5">
                            MICR Code
                          </label>
                          <input
                            type="number"
                            value={doctorFormData.MicrCode}
                            onChange={(e) => handleDoctorInputChange("MicrCode", e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none transition-all bg-white text-slate-800 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder="Enter MICR Code"
                            min="1"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2.5">
                            PIN Code <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={doctorFormData.pinCode}
                              onChange={(e) => handleDoctorInputChange("pinCode", e.target.value)}
                              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none transition-all bg-white text-slate-800"
                              placeholder="Enter 6-digit PIN code"
                              maxLength={6}
                              pattern="[0-9]{6}"
                              required
                            />
                            {loadingLocation && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                              </div>
                            )}
                          </div>
                          {doctorFormData.pinCode.length === 6 && !loadingLocation && (
                            <p className="text-xs text-slate-500 mt-1">
                              {doctorFormData.State && doctorFormData.City 
                                ? `📍 ${doctorFormData.City}, ${doctorFormData.State}`
                                : "Location not found for this PIN code"}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2.5">State</label>
                          <input
                            type="text"
                            value={doctorFormData.State}
                            onChange={(e) => handleDoctorInputChange("State", e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none transition-all bg-white text-slate-800"
                            placeholder="Enter State"
                            maxLength={100}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2.5">
                            City
                          </label>
                          <input
                            type="text"
                            value={doctorFormData.City}
                            onChange={(e) => handleDoctorInputChange("City", e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none transition-all bg-white text-slate-800"
                            placeholder="Enter City"
                            maxLength={100}
                          />
                        </div>
                         <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2.5">
                          Address <span className="text-red-500">*</span>
                        </label>
                        <input
                          value={doctorFormData.address}
                          onChange={(e) => handleDoctorInputChange("address", e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none transition-all bg-white text-slate-800"
                          placeholder="Enter address"
                          required
                          maxLength={100}
                        />
                      </div>

                      </div>
                   
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2.5">
                            PAN <span className="text-red-500">*</span>
                          </label>
                          {(() => {
                            const panError = getPanInlineError(doctorFormData.pan)
                            return (
                              <>
                                <input
                                  type="text"
                                  value={doctorFormData.pan}
                                  onChange={(e) => handleDoctorInputChange("pan", e.target.value)}
                                  className={`w-full px-4 py-3 rounded-xl border focus:border-emerald-500 focus:ring-4 outline-none transition-all bg-white text-slate-800 uppercase ${
                                    panError
                                      ? "border-red-400 focus:ring-red-100"
                                      : "border-slate-300 focus:ring-emerald-100"
                                  }`}
                                  placeholder="ABCDE1234F"
                                  maxLength={10}
                                  required
                                  aria-invalid={!!panError}
                                />
                                <p className={`text-xs mt-1 ${panError ? "text-red-600" : "text-slate-500"}`}>
                                  {panError || "Format: ABCDE1234F"}
                                </p>
                              </>
                            )
                          })()}
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2.5">GstNo</label>
                          <input
                            type="text"
                            value={doctorFormData.GstNo}
                            onChange={(e) => handleDoctorInputChange("GstNo", e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none transition-all bg-white text-slate-800"
                            placeholder="Enter GstNo"
                            maxLength={15}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2.5">SAP Vendor Code</label>
                          <input
                            type="text"
                            value={doctorFormData.sapVendorCode}
                            onChange={(e) => handleDoctorInputChange("sapVendorCode", e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none transition-all bg-white text-slate-800"
                            placeholder="Enter SAP vendor code"
                            maxLength={50}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2.5">Area</label>
                          <input
                            type="text"
                            value={doctorFormData.area}
                            onChange={(e) => handleDoctorInputChange("area", e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none transition-all bg-white text-slate-800"
                            placeholder="Enter area (optional)"
                            maxLength={100}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2.5">HQ</label>
                          <input
                            type="text"
                            value={doctorFormData.hq}
                            onChange={(e) => handleDoctorInputChange("hq", e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none transition-all bg-white text-slate-800"
                            placeholder="Enter HQ (optional)"
                            maxLength={100}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2.5">Zone</label>
                          <input
                            type="text"
                            value={doctorFormData.zone}
                            onChange={(e) => handleDoctorInputChange("zone", e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none transition-all bg-white text-slate-800"
                            placeholder="Enter zone (optional)"
                            maxLength={100}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2.5">Speciality</label>
                          <input
                            type="text"
                            value={doctorFormData.speciality}
                            onChange={(e) => handleDoctorInputChange("speciality", e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none transition-all bg-white text-slate-800"
                            placeholder="Enter speciality (optional)"
                            maxLength={100}
                          />
                        </div>
                      </div>

                      <div className={`grid grid-cols-1 ${doctorSitePaymentEnabled ? "md:grid-cols-2" : ""} gap-6`}>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2.5">
                            No. of Planned Patients <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            value={doctorFormData.noOfPlannedPatients}
                            onChange={(e) => handleDoctorInputChange("noOfPlannedPatients", e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none transition-all bg-white text-slate-800 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder="Enter number of planned patients"
                            min="1"
                            step="1"
                            required
                          />
                        </div>

                        {doctorSitePaymentEnabled ? (
                          <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2.5">
                              Total Payment Amount <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="number"
                              value={doctorFormData.totalPaymentAmount}
                              onChange={(e) => handleDoctorInputChange("totalPaymentAmount", e.target.value)}
                              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none transition-all bg-white text-slate-800 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              placeholder="Enter Total Payment Amount"
                              min="0"
                              step="1"
                              required
                            />
                          </div>
                        ) : null}
                      </div>

                      
                      {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2.5">
                            Region <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={doctorFormData.region}
                            onChange={(e) => handleDoctorInputChange("region", e.target.value)}
                            required
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none transition-all bg-white text-slate-800"
                            placeholder="Enter region"
                            maxLength={100}
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-slate-700 mb-2.5">Division</label>
                          <input
                            type="text"
                            value={doctorFormData.division}
                            onChange={(e) => handleDoctorInputChange("division", e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none transition-all bg-white text-slate-800"
                            placeholder="Enter division"
                            maxLength={100}
                          />
                        </div>
                      </div> */}
                    </div>

                    {/* Milestone Patient Wise Fields */}
                    {doctorUserType === "milestonePatient" && (
                      <div className="bg-emerald-50 rounded-xl p-6 border border-emerald-200">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">Milestone Configuration (Patient Wise)</h3>

                        {hasActivePaymentRules(doctorStudyPaymentRules.rules) && (
                          <p className="text-xs text-emerald-900 bg-emerald-100/70 rounded-lg px-3 py-2 mb-4 border border-emerald-200/80">
                            Payment rules for this study are shown in brackets next to each milestone.
                          </p>
                        )}

                        <div className="mb-6">
                          <label className="block text-sm font-semibold text-slate-700 mb-2.5">
                            Number of Milestones <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={doctorFormData.numberOfMilestones === "" || doctorFormData.numberOfMilestones == null ? "" : doctorFormData.numberOfMilestones}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/\D/g, "").slice(0, 5)
                              if (raw === "") {
                                handleDoctorInputChange("numberOfMilestones", "")
                                return
                              }
                              const num = Math.max(1, parseInt(raw, 10) || 1)
                              handleDoctorInputChange("numberOfMilestones", num)
                            }}
                            placeholder="Enter number (e.g. 1, 2, 3…)"
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none transition-all bg-white text-slate-800"
                          />
                          <p className="text-xs text-slate-500 mt-2">
                            Enter patients and amounts for each milestone manually. Totals should not exceed the values above.
                          </p>
                        </div>

                        {doctorFormData.milestones.length > 0 && (
                          <div className="space-y-4">
                            <h4 className="text-sm font-semibold text-slate-700">Milestone Details</h4>
                            {(() => {
                              const totalPatients = parseInt(doctorFormData.noOfPlannedPatients) || 0
                              const totalAmount = parseInt(doctorFormData.totalPaymentAmount) || 0
                              const milestonePatientsTotal = doctorFormData.milestones.reduce((sum, m) => sum + (parseInt(m.patients) || 0), 0)
                              const milestoneAmountTotal = doctorFormData.milestones.reduce((sum, m) => sum + (parseInt(m.amount) || 0), 0)
                              const patientsExceeded = milestonePatientsTotal > totalPatients
                              const amountExceeded = milestoneAmountTotal > totalAmount
                              
                              return (
                                <div className="space-y-4">
                                  {doctorFormData.milestones.map((milestone, index) => (
                                    <div
                                      key={milestone.milestoneNo || `milestone-${index}`}
                                      className={`bg-white rounded-lg p-4 border border-slate-200 grid grid-cols-1 ${doctorSitePaymentEnabled ? "md:grid-cols-2" : ""} gap-4`}
                                    >
                                      <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1.5">
                                          Patients in Milestone {index + 1}
                                          {milestoneLabelSuffix(
                                            milestone.milestoneNo || index + 1,
                                            doctorStudyPaymentRules.rules,
                                            doctorStudyPaymentRules.visitSchedules,
                                          )}{" "}
                                          <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                          type="number"
                                          value={milestone.patients || ""}
                                          onChange={(e) => handleMilestoneChange(index, "patients", e.target.value)}
                                          className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all bg-white text-slate-800 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                          placeholder="Enter patients"
                                          min="0"
                                          step="1"
                                        />
                                      </div>
                                      {doctorSitePaymentEnabled ? (
                                        <div>
                                          <label className="block text-xs font-medium text-slate-600 mb-1.5">
                                            Amount for Milestone {index + 1}
                                            {milestoneLabelSuffix(
                                              milestone.milestoneNo || index + 1,
                                              doctorStudyPaymentRules.rules,
                                              doctorStudyPaymentRules.visitSchedules,
                                            )}{" "}
                                            <span className="text-red-500">*</span>
                                          </label>
                                          <input
                                            type="number"
                                            value={milestone.amount || ""}
                                            onChange={(e) => handleMilestoneChange(index, "amount", e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all bg-white text-slate-800 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            placeholder="Enter amount"
                                            min="0"
                                            step="1"
                                          />
                                        </div>
                                      ) : null}
                                    </div>
                                  ))}
                                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="text-slate-600">Total Milestone Patients:</span>
                                      <span className={`font-semibold ${patientsExceeded ? "text-red-600" : "text-slate-800"}`}>
                                        {milestonePatientsTotal} / {totalPatients}
                                      </span>
                                    </div>
                                    {doctorSitePaymentEnabled ? (
                                      <div className="flex items-center justify-between text-xs mt-2">
                                        <span className="text-slate-600">Total Milestone Amount:</span>
                                        <span className={`font-semibold ${amountExceeded ? "text-red-600" : "text-slate-800"}`}>
                                          {milestoneAmountTotal.toFixed(2)} / {totalAmount.toFixed(2)}
                                        </span>
                                      </div>
                                    ) : null}
                                    {patientsExceeded && (
                                      <p className="text-xs text-red-600 mt-2 font-medium">
                                        ⚠ Total milestone patients exceeds planned patients
                                      </p>
                                    )}
                                    {doctorSitePaymentEnabled && amountExceeded && (
                                      <p className="text-xs text-red-600 mt-2 font-medium">
                                        ⚠ Total milestone amount exceeds total payment amount
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )
                            })()}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Milestone Visit Wise Fields */}
                    {doctorUserType === "milestoneVisit" && doctorSitePaymentEnabled && (
                      <div className="bg-emerald-50 rounded-xl p-6 border border-emerald-200">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">Milestone Configuration (Visit Wise)</h3>

                        {hasActivePaymentRules(doctorStudyPaymentRules.rules) && (
                          <p className="text-xs text-emerald-900 bg-emerald-100/70 rounded-lg px-3 py-2 mb-4 border border-emerald-200/80">
                            Payment rules for this study are shown in brackets next to each visit step.
                          </p>
                        )}

                        <div className="mb-4">
                          <p className="text-sm text-slate-700 mb-3">
                            Add visit amounts manually. Total visit amounts should not exceed the total payment amount above.
                          </p>
                        </div>

                        {doctorFormData.visitAmounts.length > 0 && (
                          <div className="space-y-3">
                            {doctorFormData.visitAmounts.map((visit, index) => (
                              <div
                                key={visit.visitNumber || `visit-${index}`}
                                className="bg-white rounded-lg p-4 border border-slate-200 flex items-center gap-4"
                              >
                                <div className="flex-1">
                                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                                    Amount for Visit {visit.visitNumber}
                                    {milestoneLabelSuffix(
                                      visit.visitNumber || index + 1,
                                      doctorStudyPaymentRules.rules,
                                      doctorStudyPaymentRules.visitSchedules,
                                    )}{" "}
                                    <span className="text-red-500">*</span>
                                  </label>
                                  <input
                                    type="number"
                                    value={visit.amount || ""}
                                    onChange={(e) =>
                                      handleVisitAmountChange(index, "amount", e.target.value)
                                    }
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all bg-white text-slate-800 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    placeholder="Enter amount"
                                    min="0"
                                    step="1"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveVisitAmount(index)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                            {(() => {
                              const totalAmount = parseFloat(doctorFormData.totalPaymentAmount) || 0
                              const visitAmountTotal = doctorFormData.visitAmounts.reduce((sum, v) => sum + (parseFloat(v.amount) || 0), 0)
                              const amountExceeded = visitAmountTotal > totalAmount
                              
                              return (
                                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-600">Total Visit Amount:</span>
                                    <span className={`font-semibold ${amountExceeded ? "text-red-600" : "text-slate-800"}`}>
                                      {visitAmountTotal.toFixed(2)} / {totalAmount.toFixed(2)}
                                    </span>
                                  </div>
                                  {amountExceeded && (
                                    <p className="text-xs text-red-600 mt-2 font-medium">
                                      ⚠ Total visit amount exceeds total payment amount
                                    </p>
                                  )}
                                </div>
                              )
                            })()}
                          </div>
                        )}
                        <button
                            type="button"
                            onClick={handleAddVisitAmount}
                            className="inline-flex items-center gap-2 px-4 py-2 mt-4 bg-violet-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-semibold"
                          >
                            <Plus className="w-4 h-4" />
                            Add Visit Amount
                          </button> 
                      </div>
                    )}

                    {isSuperAdmin && !importMode ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <Label htmlFor="create-crc-test-account" className="text-sm font-semibold text-slate-800">
                              Test account
                            </Label>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              Applies only when a new login is created for this email. Excluded from finance listing and daily email CRC counts.
                            </p>
                          </div>
                          <Switch
                            id="create-crc-test-account"
                            checked={doctorFormData.isTestAccount}
                            onCheckedChange={(checked) =>
                              setDoctorFormData((prev) => ({ ...prev, isTestAccount: checked === true }))
                            }
                          />
                        </div>
                      </div>
                    ) : null}

                    <div className="flex justify-end gap-4 pt-6 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => {
                          setDoctorFormData({
                            doctorName: "",
                            MicrCode: "",
                            address: "",
                            pinCode: "",
                            sapVendorCode: "",
                            emailId: "",
                            mobileNo: "",
                            pan: "",
                            noOfPlannedPatients: "",
                            totalPaymentAmount: "",
                            region: "",
                            division: "",
                            area: "",
                            hq: "",
                            zone: "",
                            speciality: "",
                            studyId: "",
                            siteId: "",
                            City: "",
                            State: "",
                            GstNo: "",
                            numberOfMilestones: 1,
                            milestones: [],
                            visitAmounts: [],
                            isTestAccount: false,
                          })
                          setDoctorUserType("normal")
                        }}
                        className="px-8 py-3 rounded-xl border-2 border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 hover:border-slate-400 transition-all"
                      >
                        Clear
                      </button>
                      <button
                        type="submit"
                        disabled={doctorLoading}
                        className="px-8 py-3 rounded-xl bg-gradient-to-r btn-brand-gradient text-white font-semibold  transition-all shadow-lg shadow-violet-200 hover:shadow-xl hover:shadow-violet-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {doctorLoading ? "Creating..." : "Create CRC User"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : activeTab === "manage" ? (
              <div>
                {/* Search Bar */}
                <div className="mb-6">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg
                        className="h-5 w-5 text-slate-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none transition-all bg-white text-slate-800 placeholder:text-slate-400"
                      placeholder="Search by GUID, name, email, mobile, role, employee no, username..."
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                  {searchQuery && (
                    <p className="text-xs text-slate-500 mt-2">
                      Showing {users.length} result{users.length !== 1 ? "s" : ""} for "{searchQuery}"
                    </p>
                  )}
                </div>

                {/* Loading State */}
                {loadingUsers ? (
                  <SectionSkeleton title="Loading users..." rows={7} variant="users" />
                ) : users.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <User className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-600 font-medium">
                        {searchQuery ? "No users found matching your search" : "No users found"}
                      </p>
                      <p className="text-slate-500 text-sm mt-1">
                        {searchQuery ? "Try a different search term" : "Create a new user to get started"}
                      </p>
                    </div>
                  </div>
                ) : (
                  /* User Management Table */
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <p className={USER_MASTER_TABLE_HINT_CLASS}>Swipe horizontally to see all columns</p>
                    <div className={USER_MASTER_TABLE_SCROLL_CLASS}>
                      <table className={USER_MASTER_MANAGE_USERS_TABLE_CLASS}>
                        <thead className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-b-2 border-slate-200">
                          <tr>
                            <th className="px-3 sm:px-5 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                              ID
                            </th>
                            <th className="px-3 sm:px-5 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                              Name
                            </th>
                            <th className="px-3 sm:px-5 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                              Role
                            </th>
                            <th className="px-3 sm:px-5 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                              Email id
                            </th>
                            <th className="px-3 sm:px-5 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                              Phone no.
                            </th>
                            <th className="px-3 sm:px-5 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-3 sm:px-5 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                          {users.map((user) => {
                            const isCrcRole = (user.roleName || "").toLowerCase().includes("crc")
                            return (
                            <tr key={user.guid} className="hover:bg-emerald-50/30 transition-all duration-150 group">
                              {/* ID = GUID */}
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm font-mono text-slate-700">
                                <button
                                  type="button"
                                  title={user.guid || "N/A"}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (user.guid) {
                                      handleCopyToClipboard(user.guid, "guid", user.id)
                                    }
                                  }}
                                  className="truncate inline-flex max-w-[180px] items-center gap-1 text-left hover:text-emerald-600 focus:outline-none"
                                >
                                  <span className="truncate">{user.guid || "N/A"}</span>
                                  {copiedItem === `guid-${user.id}` && (
                                    <span className="text-[10px] text-emerald-600 font-semibold">Copied</span>
                                  )}
                                </button>
                              </td>
                              {/* Name */}
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2 sm:gap-3">
                                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center flex-shrink-0">
                                    <User className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                                  </div>
                                  <div>
                                    <div className="text-xs sm:text-sm font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors">
                                      {user.firstName} {user.lastName}
                                    </div>
                                    {(user.isTestAccount || user.IsTestAccount) ? (
                                      <span className="inline-flex mt-1 items-center rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 border border-amber-200">
                                        Test
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              </td>
                              {/* Role */}
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                                <div className="text-xs sm:text-sm font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors">
                                  {user.roleName}
                                </div>
                              </td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <span 
                                    title={user.email || "No email - Click to copy"} 
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleCopyToClipboard(user.email, "email", user.id)
                                    }}
                                    className="group/email relative inline-flex items-center justify-center px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 active:bg-emerald-200 transition-colors cursor-pointer"
                                  >
                                    {copiedItem === `email-${user.id}` ? (
                                      <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-600 flex-shrink-0" />
                                    ) : (
                                      <Mail className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-500 flex-shrink-0" />
                                    )}
                                    <span className="truncate max-w-[200px] opacity-0 group-hover/email:opacity-100 transition-opacity duration-200 absolute top-full left-1/2 -translate-x-1/2 mt-1 whitespace-nowrap bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg z-50 pointer-events-none">
                                      {user.email || "N/A"}
                                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
                                    </span>
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                                <span 
                                  title={user.phoneNumber || "No phone number - Click to copy"} 
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleCopyToClipboard(user.phoneNumber, "phone", user.id)
                                  }}
                                  className="group/phone relative inline-flex items-center justify-center px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100 active:bg-emerald-200 transition-colors cursor-pointer"
                                >
                                  {copiedItem === `phone-${user.id}` ? (
                                    <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-600 flex-shrink-0" />
                                  ) : (
                                    <Phone className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-500 flex-shrink-0" />
                                  )}
                                  <span className="truncate opacity-0 group-hover/phone:opacity-100 transition-opacity duration-200 absolute top-full left-1/2 -translate-x-1/2 mt-1 whitespace-nowrap bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg z-50 pointer-events-none">
                                    {user.phoneNumber || "N/A"}
                                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
                                  </span>
                                </span>
                              </td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      handleToggleStatus(user.id, user.isActive)
                                    }}
                                    disabled={updatingStatus[user.id]}
                                    className={`relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer ${user.isActive
                                      ? "bg-violet-600 hover:bg-violet-700"
                                      : "bg-slate-300 hover:bg-slate-400"
                                      }`}
                                  >
                                    <span
                                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${user.isActive ? "translate-x-9" : "translate-x-1"
                                        }`}
                                    />
                                  </button>
                                </div>
                              </td>
                              <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  {/* Update/Edit - Blue (hidden for CRC users unless Super Admin) */}
                                  {(!isCrcRole || isSuperAdmin) && (
                                    <button
                                      type="button"
                                      onClick={() => handleEditUser(user)}
                                      className="inline-flex items-center px-2 py-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                      title="Update user"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                  )}
                                  {/* Delete - Red */}
                                  <button
                                    type="button"
                                    onClick={() => openDeleteConfirm(user.id, `${user.firstName} ${user.lastName}`)}
                                    disabled={deletingUser === user.id}
                                    className="inline-flex items-center px-2 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Delete user"
                                  >
                                    {deletingUser === user.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </button>
                                  {/* Reset - Orange (Super Admin only) */}
                                  {isSuperAdmin && (
                                    <button
                                      type="button"
                                      onClick={() => handleResetPassword(user.id, `${user.firstName} ${user.lastName}`)}
                                      disabled={resettingPassword === user.id}
                                      className="inline-flex items-center px-2 py-2 text-orange-600 hover:text-orange-800 hover:bg-orange-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="Reset password"
                                    >
                                      {resettingPassword === user.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <RotateCw className="w-4 h-4" />
                                      )}
                                    </button>
                                  )}
                                  {/* Assign - Green (hidden for Admin/Super Admin and CRC; backend assigns all studies & sites by default for those) */}
                                  {(() => {
                                    const roleLower = (user.roleName || "").toLowerCase()
                                    const isAdminOrSuperAdmin = roleLower === "admin" || roleLower.includes("super admin")
                                    const isCrc = roleLower === "crc"
                                    return !isAdminOrSuperAdmin && !isCrc
                                  })() && (
                                    <button
                                      type="button"
                                      onClick={() => handleAssignUser(user)}
                                      disabled={assigningUser === user.id}
                                      className="inline-flex items-center px-2 py-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="Assign to study/site"
                                    >
                                      {assigningUser === user.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <UserPlus className="w-4 h-4" />
                                      )}
                                    </button>
                                  )}
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
                        itemName="users"
                        showPageSizeSelector={true}
                      />
                    )}
                  </div>
                )}

                {/* Success/Error Messages (hide generic bar for assignment-edit success) */}
                {activeTab !== "crcManage" &&
                  success &&
                  success !== "Assignment details updated successfully." && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-emerald-50 to-green-50 border-l-4 border-emerald-500 rounded-lg shadow-sm flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-emerald-700">{success}</p>
                  </div>
                )}
                {activeTab !== "crcManage" && error && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-red-50 to-rose-50 border-l-4 border-red-500 rounded-lg shadow-sm flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-red-700">{error}</p>
                  </div>
                )}
              </div>
            ) : (
              // Manage CRC Users tab
              <div className="relative">
                {/* Header and Create button */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                      Manage CRC Users
                    </h2>
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setActiveTab("doctor")}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-semibold shadow-md hover:bg-emerald-700 transition-colors self-start sm:self-auto"
                    >
                      <Plus className="w-4 h-4" />
                      Create CRC User
                    </button>
                  </div>
                </div>

                {/* Filter Criteria card + filters (aligned with export-study-details / project standard) */}
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden mb-6">
                  <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 px-4 sm:px-6 py-4 border-b border-slate-200">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Filter className="w-5 h-5 text-emerald-600" />
                        <h2 className="text-lg font-bold text-slate-800">Filter Criteria</h2>
                      </div>
                      {(crcSearchQuery || crcFilterStudyId || crcFilterStatus !== "all") && (
                        <button
                          type="button"
                          onClick={handleClearCrcFilters}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                          Clear Filters
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="p-4 sm:p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Study filter - Select with Search studies... inside panel (same as export-study-details) */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                      Study <span className="text-red-500">*</span>
                    </label>
                    {(() => {
                      const crcStudyList = crcFilterStudies.length > 0 ? crcFilterStudies : allStudies.length > 0 ? allStudies : studies
                      const displayName = (s) =>
                        s.studyProtocolNumber ||
                        s.studyTitle ||
                        s.protocolNumber ||
                        s.name ||
                        s.studyName ||
                        `Study ${s.studyId || s.id}`
                      const filteredStudies = crcStudyList.filter((study) => {
                        if (!crcFilterStudySearchInput.trim()) return true
                        const q = crcFilterStudySearchInput.toLowerCase()
                        return displayName(study).toLowerCase().includes(q)
                      })
                      return (
                        <Select
                          value={crcFilterStudyId || "all"}
                          onValueChange={(value) => {
                            setCrcFilterStudyId(value === "all" ? "" : value)
                            setCrcFilterStudySearchInput("")
                          }}
                        >
                          <SelectTrigger className="w-full border-2 border-slate-200 rounded-xl bg-white hover:bg-emerald-50/50 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition-all px-4 py-3 h-auto text-sm shadow-sm data-[state=open]:border-emerald-500">
                            <SelectValue placeholder="Select Study" />
                          </SelectTrigger>
                          <SelectContent className="bg-white border-2 border-slate-200 rounded-xl shadow-lg">
                            <div className="p-3 border-b border-slate-200 sticky top-0 bg-white z-10 rounded-t-xl">
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                <Input
                                  type="text"
                                  placeholder="Search studies..."
                                  value={crcFilterStudySearchInput}
                                  onChange={(e) => setCrcFilterStudySearchInput(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => e.stopPropagation()}
                                  className="pl-10 border-2 border-slate-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                                />
                              </div>
                            </div>
                            <div className="max-h-[280px] overflow-y-auto">
                              <SelectItem
                                value="all"
                                className="px-4 py-2 data-[highlighted]:bg-emerald-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer"
                              >
                                All studies
                              </SelectItem>
                              {filteredStudies.map((study) => {
                                const id = study.studyId || study.id
                                const label = displayName(study)
                                return (
                                  <SelectItem
                                    key={id}
                                    value={String(id)}
                                    className="px-4 py-2 data-[highlighted]:bg-emerald-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer"
                                  >
                                    {label}
                                  </SelectItem>
                                )
                              })}
                            </div>
                          </SelectContent>
                        </Select>
                      )
                    })()}
                  </div>

                  {/* Status filter - same Select design as Study (no search needed; few options) */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                      Status
                    </label>
                    <Select
                      value={crcFilterStatus}
                      onValueChange={(value) => setCrcFilterStatus(value)}
                    >
                      <SelectTrigger className="w-full border-2 border-slate-200 rounded-xl bg-white hover:bg-emerald-50/50 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition-all px-4 py-3 h-auto text-sm shadow-sm data-[state=open]:border-emerald-500">
                        <SelectValue placeholder="Select Status" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-2 border-slate-200 rounded-xl shadow-lg">
                        <SelectItem
                          value="all"
                          className="px-4 py-2 data-[highlighted]:bg-emerald-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer"
                        >
                          All
                        </SelectItem>
                        <SelectItem
                          value="active"
                          className="px-4 py-2 data-[highlighted]:bg-emerald-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer"
                        >
                          Active
                        </SelectItem>
                        <SelectItem
                          value="inactive"
                          className="px-4 py-2 data-[highlighted]:bg-emerald-50 data-[highlighted]:text-slate-900 text-sm font-medium text-slate-900 cursor-pointer"
                        >
                          Inactive
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Search */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Search
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <svg
                          className="h-5 w-5 text-slate-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                      </div>
                      <input
                        type="text"
                        value={crcSearchQuery}
                        onChange={(e) => setCrcSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none transition-all bg-white text-slate-800 placeholder:text-slate-400"
                        placeholder="Search by name, email, mobile..."
                      />
                      {crcSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setCrcSearchQuery("")}
                          className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                  </div>
                </div>

                {crcSearchQuery && (
                  <p className="text-xs text-slate-500 mb-4">
                    Showing {crcUsers.length} result
                    {crcUsers.length !== 1 ? "s" : ""} for "{crcSearchQuery}"
                  </p>
                )}

                {/* CRC Status Confirmation Modal */}
                {crcStatusConfirm && (
                  <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
                      <div className="bg-[#4F8CFF] px-6 py-4 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-white/30 flex items-center justify-center shadow-sm">
                          <span className="text-white text-lg font-bold">!</span>
                        </div>
                        <h3 className="text-lg font-bold text-white">Change CRC Status</h3>
                      </div>
                      <div className="px-6 pt-5 pb-6 space-y-4 bg-white">
                        <p className="text-slate-700">
                          Are you sure you want to set this CRC user as{" "}
                          <span className="font-semibold">
                            {crcStatusConfirm.isActive ? "Inactive" : "Active"}
                          </span>
                          ?
                        </p>
                        {crcStatusConfirm.name && (
                          <p className="text-sm text-slate-500">
                            User: <span className="font-medium text-slate-800">{crcStatusConfirm.name}</span>
                          </p>
                        )}
                        <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end pt-2">
                          <button
                            type="button"
                            onClick={() => setCrcStatusConfirm(null)}
                            className="inline-flex items-center justify-center px-6 py-2.5 rounded-full border border-slate-200 bg-white text-slate-600 text-sm font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const { id, isActive } = crcStatusConfirm
                              setCrcStatusConfirm(null)
                              await handleToggleCrcStatus(id, isActive)
                            }}
                            className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 shadow-md transition-all"
                          >
                            Confirm
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Loading / Empty / Table */}
                {crcLoadingUsers ? (
                  <SectionSkeleton title="Loading CRC users..." rows={7} variant="crcUsers" />
                ) : crcUsers.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <User className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-600 font-medium">
                        {crcSearchQuery ? "No CRC users found matching your search" : "No CRC users found"}
                      </p>
                      <p className="text-slate-500 text-sm mt-1">
                        {crcSearchQuery ? "Try a different search term" : "Create a new CRC user to get started"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <p className={USER_MASTER_TABLE_HINT_CLASS}>Swipe horizontally to see all columns</p>
                    <div className={USER_MASTER_TABLE_SCROLL_CLASS}>
                      <table className={USER_MASTER_MANAGE_CRC_TABLE_CLASS}>
                        <thead className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-b-2 border-slate-200">
                          <tr>
                            <th className="px-3 sm:px-5 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                              ID
                            </th>
                            <th className="px-3 sm:px-5 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                              Study (Protocol No.)
                            </th>
                            <th className="px-3 sm:px-5 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                              Study Type
                            </th>
                            <th className="px-3 sm:px-5 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                              Site
                            </th>
                            <th className="px-3 sm:px-5 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                              Name
                            </th>
                            <th className="px-3 sm:px-5 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                              Email
                            </th>
                            <th className="px-3 sm:px-5 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                              Mobile
                            </th>
                            {showCrcHonorariumColumn ? (
                              <th className="px-3 sm:px-5 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                                Honorarium
                              </th>
                            ) : null}
                            <th className="px-3 sm:px-5 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-3 sm:px-5 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {crcUsers.map((item) => {
                            const id = item.id ?? item.studyUserId ?? item.StudyUserId
                            const studyProtocolNo =
                              item.studyProtocolNumber ||
                              item.studyTitle ||
                              item.studyName ||
                              (item.studyId || item.StudyId ? `Study ${item.studyId || item.StudyId}` : "N/A")
                            const siteName =
                              item.siteName ||
                              item.siteFullName ||
                              (item.siteId || item.SiteId ? `Site ${item.siteId || item.SiteId}` : "N/A")
                            const name = item.doctorName || item.DoctorName || "N/A"
                            const email =
                              item.emailId ||
                              item.EmailId ||
                              item.email ||
                              item.Email ||
                              "N/A"
                            const mobile =
                              item.mobileNo ||
                              item.MobileNo ||
                              item.phoneNumber ||
                              item.PhoneNumber ||
                              ""
                            const studyTypeRaw = item.studyType ?? item.StudyType ?? null
                            const studyTypeLabel = studyTypeToLabel(studyTypeRaw)
                            const honorarium =
                              item.totalHonorariumAmount ??
                              item.TotalHonorariumAmount ??
                              item.totalPaymentAmount ??
                              null
                            const isActive =
                              item.isActive !== undefined
                                ? item.isActive
                                : item.IsActive !== undefined
                                  ? item.IsActive
                                  : true

                            return (
                              <tr key={id || `${studyProtocolNo}-${siteName}-${name}`} className="hover:bg-slate-50 transition-colors">
                                {/* ID */}
                                <td className="px-3 sm:px-5 py-3 whitespace-nowrap text-xs font-mono text-slate-700">
                                  {id || "-"}
                                </td>
                                {/* Study (Protocol No.) */}
                                <td className="px-3 sm:px-5 py-3 whitespace-nowrap text-sm text-slate-800">
                                  {studyProtocolNo}
                                </td>
                                {/* Study Type */}
                                <td className="px-3 sm:px-5 py-3 whitespace-nowrap text-xs font-semibold text-slate-700">
                                  {studyTypeLabel}
                                </td>
                                {/* Site */}
                                <td className="px-3 sm:px-5 py-3 whitespace-nowrap text-sm text-slate-800">
                                  {siteName}
                                </td>
                                <td className="px-3 sm:px-5 py-3 whitespace-nowrap text-sm text-slate-800">
                                  {name}
                                </td>
                                <td className="px-3 sm:px-5 py-3 whitespace-nowrap text-sm text-slate-800">
                                  {email}
                                </td>
                                <td className="px-3 sm:px-5 py-3 whitespace-nowrap text-sm text-slate-800">
                                  {mobile || "N/A"}
                                </td>
                                {showCrcHonorariumColumn ? (
                                  <td className="px-3 sm:px-5 py-3 whitespace-nowrap text-sm text-slate-800 tabular-nums">
                                    {studySitePaymentMap[String(item.studyId ?? item.StudyId ?? "")] !== false
                                      ? formatHonorariumAmount(honorarium)
                                      : "—"}
                                  </td>
                                ) : null}
                                {/* Status toggle column (blue switch like Manage Users) */}
                                <td className="px-3 sm:px-5 py-3 whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCrcStatusConfirm({
                                        id,
                                        isActive,
                                        name,
                                      })
                                    }
                                    className={`relative inline-flex h-8 w-16 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-100 cursor-pointer shadow-sm ${
                                      isActive ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-300 hover:bg-slate-400"
                                    }`}
                                  >
                                    <span
                                      className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                                        isActive ? "translate-x-9" : "translate-x-1"
                                      }`}
                                    />
                                  </button>
                                </td>
                                {/* Actions (Edit only) */}
                                <td className="px-3 sm:px-5 py-3 whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => handleEditCrcUser(item)}
                                    className="inline-flex items-center px-3 py-1.5 rounded-lg bg-teal-100 text-teal-700 hover:bg-teal-200 transition-all text-xs font-medium"
                                  >
                                    <FilePen className="w-3.5 h-3.5 mr-1" />
                                    Edit & update
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    {crcTotalPages > 0 && (
                      <DataPagination
                        currentPage={crcPageNumber}
                        pageSize={crcPageSize}
                        totalPages={crcTotalPages}
                        totalCount={crcTotalCount}
                        onPageChange={setCrcPageNumber}
                        onPageSizeChange={handleCrcPageSizeChange}
                        itemName="CRC users"
                        showPageSizeSelector={true}
                      />
                    )}
                  </div>
                )}

                {/* Success/Error Messages */}
                {success && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-emerald-50 to-green-50 border-l-4 border-emerald-500 rounded-lg shadow-sm flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-emerald-700">{success}</p>
                  </div>
                )}
                {error && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-red-50 to-rose-50 border-l-4 border-red-500 rounded-lg shadow-sm flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-red-700">{error}</p>
                  </div>
                )}
              </div>
            )}

            {/* Edit User Modal */}
            {editingUser && (
              <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl shadow-slate-900/15 w-full max-w-3xl my-4 sm:my-8 animate-in zoom-in-95 duration-200 border border-slate-300 overflow-hidden">
                  {/* Modal Header */}
                  <div className="sticky top-0 bg-gradient-to-r from-sky-100 via-emerald-200 to-sky-100 px-4 sm:px-8 py-4 sm:py-5 flex items-center justify-between z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                        <User className="w-5 h-5 text-emerald-500" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900">Edit User</h3>
                    </div>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="w-9 h-9 rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-all"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Error Message - outside scroll area so always visible when saving fails */}
                  {error && (
                    <div className="px-4 sm:px-8 pt-4 bg-white border-b border-red-200/50 shrink-0">
                      <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 shadow-sm">
                        <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                        <p className="text-sm font-semibold text-red-700">{error}</p>
                      </div>
                    </div>
                  )}

                  {/* Modal Body */}
                  <div className={cn(MODAL_SCROLL_BODY_CLASS, "bg-gradient-to-b from-slate-50/50 to-white")}>
                    <form onSubmit={handleSaveEdit} className="p-4 sm:p-8 space-y-4 sm:space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                        <div className="p-4 rounded-xl bg-white border border-emerald-100/80 shadow-sm">
                          <label className="block text-sm font-semibold text-emerald-900 mb-2.5">
                            First Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={editFormData.firstName}
                            onChange={(e) => {
                              const v = e.target.value.replace(/[^a-zA-Z\s]/g, "")
                              setEditFormData((prev) => ({ ...prev, firstName: v }))
                            }}
                            className="w-full px-4 py-3 rounded-lg border-2 border-emerald-100 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25 outline-none transition-all bg-white text-slate-800 placeholder:text-slate-400"
                            placeholder="Characters only"
                            required
                          />
                          <p className="text-xs text-emerald-600/80 mt-1">Characters only</p>
                        </div>

                        <div className="p-4 rounded-xl bg-white border border-emerald-100/80 shadow-sm">
                          <label className="block text-sm font-semibold text-emerald-900 mb-2.5">
                            Last Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={editFormData.lastName}
                            onChange={(e) => {
                              const v = e.target.value.replace(/[^a-zA-Z\s]/g, "")
                              setEditFormData((prev) => ({ ...prev, lastName: v }))
                            }}
                            className="w-full px-4 py-3 rounded-lg border-2 border-emerald-100 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25 outline-none transition-all bg-white text-slate-800 placeholder:text-slate-400"
                            placeholder="Characters only"
                            required
                          />
                          <p className="text-xs text-emerald-600/80 mt-1">Characters only</p>
                        </div>
                        <div className="p-4 rounded-xl bg-white border border-emerald-100/80 shadow-sm">
                          <label className="block text-sm font-semibold text-emerald-900 mb-2.5">
                            Email <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400" />
                            <input
                              type="email"
                              value={editFormData.email}
                              onChange={(e) =>
                                setEditFormData((prev) => ({ ...prev, email: e.target.value }))
                              }
                              pattern="[a-zA-Z0-9._+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}"
                              title="e.g. abc@gmail.com"
                              className="w-full pl-10 pr-4 py-3 rounded-lg border-2 border-emerald-100 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25 outline-none transition-all bg-white text-slate-800 placeholder:text-slate-400"
                              placeholder="e.g. abc@gmail.com"
                              required
                            />
                          </div>
                        </div>
                        <div className="p-4 rounded-xl bg-white border border-emerald-100/80 shadow-sm">
                          <label className="block text-sm font-semibold text-emerald-900 mb-2.5">
                            Phone Number
                          </label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400" />
                            <input
                              type="tel"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={10}
                              value={editFormData.phoneNumber}
                              onChange={(e) => {
                                const v = e.target.value.replace(/\D/g, "").slice(0, 10)
                                setEditFormData((prev) => ({ ...prev, phoneNumber: v }))
                              }}
                              className="w-full pl-10 pr-4 py-3 rounded-lg border-2 border-emerald-100 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25 outline-none transition-all bg-white text-slate-800 placeholder:text-slate-400"
                              placeholder="10-digit phone number"
                            />
                            <div className="text-xs text-emerald-600/80 mt-1">{(editFormData.phoneNumber || "").length} / 10</div>
                          </div>
                        </div>

                        <div className="p-4 rounded-xl bg-white border border-emerald-100/80 shadow-sm md:col-span-2">
                          <label className="block text-sm font-semibold text-emerald-900 mb-2.5">
                            User Role <span className="text-red-500">*</span>
                            {!isSuperAdmin && (
                              <span className="text-emerald-600/80 font-normal text-xs ml-1">(only Super Admin can change)</span>
                            )}
                          </label>
                          {isSuperAdmin ? (
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400 pointer-events-none z-10" />
                              <select
                                value={editFormData.roleGuid || ""}
                                onChange={(e) => {
                                  const val = e.target.value || ""
                                  const selectedRole = filteredRoles.find(r => r.guid === val) || (val === editFormData.roleGuid ? { guid: editFormData.roleGuid, name: editFormData.roleName } : null)
                                  setEditFormData((prev) => ({
                                    ...prev,
                                    roleGuid: val,
                                    roleName: selectedRole?.name || ""
                                  }))
                                }}
                                className="w-full pl-10 pr-10 py-3 rounded-lg border-2 border-emerald-100 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25 outline-none transition-all bg-white text-slate-800 appearance-none cursor-pointer"
                                required
                              >
                                <option value="">-- Select Role --</option>
                                {(() => {
                                  const opts = filteredRoles.filter(r => r.guid && r.name)
                                  const hasCurrent = opts.some(r => r.guid === editFormData.roleGuid)
                                  if (editFormData.roleGuid && editFormData.roleName && !hasCurrent) {
                                    opts.push({ guid: editFormData.roleGuid, name: editFormData.roleName })
                                  }
                                  return opts.map((role) => (
                                    <option key={role.guid} value={role.guid}>
                                      {role.name}
                                    </option>
                                  ))
                                })()}
                              </select>
                              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 pl-4 py-3 rounded-lg border-2 border-emerald-100 bg-emerald-50/80 text-emerald-800">
                              <User className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                              <span className="font-semibold">{editFormData.roleName || editingUser?.roleName || "—"}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Assignment details (Study User) - Show for CRC/CRA so they can edit study/site details */}
                      {(() => {
                        const roleName = (editFormData.roleName || editingUser?.roleName || "").toLowerCase()
                        const isCrcOrCra = roleName.includes("crc") || roleName.includes("cra")
                        if (!isCrcOrCra) return null
                        return (
                          userAssignmentsLoading ? (
                            <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
                              <div className="space-y-2">
                                <Skeleton className="h-4 w-48 bg-emerald-200/70" />
                                <Skeleton className="h-9 w-full rounded-lg bg-emerald-200/60" />
                                <Skeleton className="h-9 w-4/5 rounded-lg bg-emerald-200/60" />
                              </div>
                            </div>
                          ) : (
                            <div className="p-4 rounded-xl bg-white border border-emerald-100/80 shadow-sm">
                              <h4 className="text-sm font-semibold text-emerald-900 mb-1">Study assignments — edit amounts</h4>
                              <p className="text-xs text-slate-600 mb-3">
                                Each study has its own honorarium. Open <strong>Edit & update</strong> for the study you want to change (Normal, Milestone patient-wise, or Visit-wise).
                              </p>
                              {userAssignments.length > 0 ? (
                                <ul className="space-y-2">
                                  {userAssignments.map((a) => (
                                    <li
                                      key={a.id || `${a.studyId}-${a.siteId}`}
                                      className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-3 px-3 rounded-lg bg-slate-50 border border-slate-200"
                                    >
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium text-slate-800 truncate">
                                          {a.studyName || `Study ${a.studyId || ""}`} — {a.siteName || `Site ${a.siteId || ""}`}
                                        </p>
                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                                          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
                                            {a.studyTypeLabel || studyTypeToLabel(a.studyType)}
                                          </span>
                                          <span>
                                            Honorarium:{" "}
                                            <span className="font-semibold text-slate-800 tabular-nums">
                                              {formatHonorariumAmount(a.totalHonorariumAmount)}
                                            </span>
                                          </span>
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditStudyUser(a)}
                                        className="shrink-0 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors"
                                      >
                                        Edit & update
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-sm text-slate-500 py-2">No assignment details found. Assign this user to a study/site first, then you can edit details here.</p>
                              )}
                            </div>
                          )
                        )
                      })()}

                      {/* Modal Footer */}
                      <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 sm:pt-6 border-t border-emerald-100 sticky bottom-0 bg-white -mx-4 sm:-mx-8 px-4 sm:px-8 pb-4 sm:pb-6">
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="px-6 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all text-sm"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={editLoading}
                          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 text-white font-semibold hover:from-violet-700 hover:to-purple-600 transition-all shadow-lg shadow-violet-300/40 hover:shadow-xl hover:shadow-violet-400/50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          {editLoading ? (
                            <span className="flex items-center gap-2">
                              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Saving...
                            </span>
                          ) : (
                            "Save Changes"
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* Edit Study User Details Modal - UpdateStudyUser/{id} */}
            {editingStudyUser && studyUserEditForm && (
              <div className="fixed inset-0 bg-emerald-950/40 backdrop-blur-sm z-[105] flex items-center justify-center p-2 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl shadow-emerald-900/5 w-full max-w-4xl my-6 max-h-[92dvh] flex flex-col border border-emerald-100 overflow-hidden">
                  <div className="sticky top-0 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500 px-4 sm:px-6 py-4 flex items-center justify-between z-10 shrink-0">
                    <div className="min-w-0 pr-3">
                      <h3 className="text-lg font-bold text-white">Edit & update amounts</h3>
                      <p className="text-xs text-white/90 mt-0.5 truncate">
                        {editingStudyUser?.studyName || `Study ${editingStudyUser?.studyId || ""}`} — {editingStudyUser?.siteName || `Site ${editingStudyUser?.siteId || ""}`}
                        {" · "}
                        {editingStudyUser?.studyTypeLabel || studyTypeToLabel(studyUserEditForm.studyType)}
                      </p>
                    </div>
                    <button type="button" onClick={handleCloseEditStudyUser} className="w-9 h-9 rounded-lg flex items-center justify-center text-white/80 hover:bg-white/20 shrink-0">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <form onSubmit={handleSaveStudyUserEdit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-4">
                      <h4 className="text-sm font-semibold text-emerald-900">
                        {studyUserEditSitePaymentEnabled ? "Payment & amounts" : "Planned patients"}
                      </h4>
                      <div className={`grid grid-cols-1 ${studyUserEditSitePaymentEnabled ? "sm:grid-cols-2" : ""} gap-4`}>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            No. of planned patients <span className="text-red-500">*</span>
                          </label>
                          <input type="text" inputMode="numeric" value={studyUserEditForm.noOfPlannedPatients ?? ""} onChange={(e) => setStudyUserEditForm((prev) => ({ ...prev, noOfPlannedPatients: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-emerald-500 text-sm bg-white" />
                        </div>
                        {studyUserEditSitePaymentEnabled ? (
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Total honorarium amount <span className="text-red-500">*</span>
                            </label>
                            <input type="text" inputMode="decimal" value={studyUserEditForm.totalHonorariumAmount ?? ""} onChange={(e) => setStudyUserEditForm((prev) => ({ ...prev, totalHonorariumAmount: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-emerald-500 text-sm bg-white" />
                          </div>
                        ) : null}
                      </div>
                      {studyUserEditSitePaymentEnabled && studyUserEditForm.studyType === "normal" && (
                        <p className="text-xs text-slate-600">
                          Normal study: update total honorarium above. Milestone and visit breakdowns are not used.
                        </p>
                      )}
                    </div>
                    <details className="rounded-xl border border-slate-200 bg-white">
                      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">
                        Profile & contact details
                      </summary>
                      <div className="px-4 pb-4 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {["doctorName", "address", "pinCode", "city", "state", "gstNo", "sapVendorCode", "emailId", "mobileNo", "panNumber", "region", "division", "area", "hq", "zone", "speciality"].map((field) => (
                        <div key={field}>
                          <label className="block text-xs font-semibold text-slate-700 mb-1 capitalize">
                            {field.replace(/([A-Z])/g, " $1").trim()}
                            {["doctorName", "address", "pinCode", "emailId", "panNumber"].includes(field) && (
                              <span className="text-red-500 ml-0.5">*</span>
                            )}
                          </label>
                          {(() => {
                            const panError = field === "panNumber" ? getPanInlineError(studyUserEditForm[field] ?? "") : ""
                            return (
                              <>
                                <input
                                  type={field === "emailId" ? "email" : field === "mobileNo" || field === "micrCode" ? "text" : "text"}
                                  inputMode={field === "mobileNo" || field === "pinCode" ? "numeric" : "text"}
                                  value={studyUserEditForm[field] ?? ""}
                                  onChange={(e) =>
                                    setStudyUserEditForm((prev) => ({
                                      ...prev,
                                      [field]: field === "panNumber" ? normalizePanInput(e.target.value) : e.target.value,
                                    }))
                                  }
                                  maxLength={field === "panNumber" ? 10 : undefined}
                                  style={field === "panNumber" ? { textTransform: "uppercase" } : undefined}
                                  aria-invalid={field === "panNumber" ? !!panError : undefined}
                                  className={`w-full px-3 py-2 rounded-lg border focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm ${
                                    field === "panNumber" && panError ? "border-red-400" : "border-slate-200"
                                  }`}
                                />
                                {field === "panNumber" && (
                                  <p className={`text-xs mt-1 ${panError ? "text-red-600" : "text-slate-500"}`}>
                                    {panError || "Format: ABCDE1234F"}
                                  </p>
                                )}
                              </>
                            )
                          })()}
                        </div>
                      ))}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Micr code
                        </label>
                        <input type="text" inputMode="numeric" value={studyUserEditForm.micrCode ?? ""} onChange={(e) => setStudyUserEditForm((prev) => ({ ...prev, micrCode: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-emerald-500 text-sm" />
                      </div>
                    </div>
                      </div>
                    </details>
                    {/* Milestones - only for Milestone (Patient Wise) */}
                    {studyUserEditForm.studyType === "milestonePatient" && (
                      <div className="bg-emerald-50 rounded-xl p-4 sm:p-5 border border-emerald-200 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-slate-800">
                            Milestone Configuration (Patient Wise)
                          </h4>
                          <button
                            type="button"
                            onClick={() =>
                              setStudyUserEditForm((prev) => ({
                                ...prev,
                                milestones: [
                                  ...(prev.milestones || []),
                                  {
                                    milestoneNo: (prev.milestones?.length || 0) + 1,
                                    noOfPatients: 0,
                                    amount: 0,
                                    name: "",
                                  },
                                ],
                              }))
                            }
                            className="inline-flex items-center px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-sm"
                          >
                            + Add Milestone
                          </button>
                        </div>
                        {hasActivePaymentRules(editStudyPaymentRules.rules) && (
                          <p className="text-xs text-emerald-900 bg-emerald-100/70 rounded-lg px-3 py-2 border border-emerald-200/80">
                            Payment rules for this study are shown in brackets next to each milestone.
                          </p>
                        )}
                        <div className="space-y-3">
                          {(studyUserEditForm.milestones || []).map((m, i) => (
                            <div
                              key={i}
                              className="bg-white rounded-lg border border-slate-200 px-4 py-3"
                            >
                              <p className="text-xs font-medium text-slate-600 mb-2">
                                Milestone {m.milestoneNo || i + 1}
                                {milestoneLabelSuffix(
                                  m.milestoneNo || i + 1,
                                  editStudyPaymentRules.rules,
                                  editStudyPaymentRules.visitSchedules,
                                )}
                              </p>
                              <div className="grid grid-cols-12 gap-2 sm:gap-3 items-center">
                                <div className="col-span-2 sm:col-span-1">
                                  <input
                                    placeholder="No."
                                    type="text"
                                    inputMode="numeric"
                                    className="w-full px-2 py-1.5 rounded-md border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-xs"
                                    value={m.milestoneNo ?? ""}
                                    onChange={(e) =>
                                      setStudyUserEditForm((prev) => ({
                                        ...prev,
                                        milestones:
                                          prev.milestones?.map((x, j) =>
                                            j === i ? { ...x, milestoneNo: e.target.value } : x
                                          ) || [],
                                      }))
                                    }
                                  />
                                </div>
                                <div className="col-span-4 sm:col-span-4">
                                  <input
                                    placeholder="Patients"
                                    type="text"
                                    inputMode="numeric"
                                    className="w-full px-2 py-1.5 rounded-md border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-xs"
                                    value={m.noOfPatients ?? ""}
                                    onChange={(e) =>
                                      setStudyUserEditForm((prev) => ({
                                        ...prev,
                                        milestones:
                                          prev.milestones?.map((x, j) =>
                                            j === i ? { ...x, noOfPatients: e.target.value } : x
                                          ) || [],
                                      }))
                                    }
                                  />
                                </div>
                                {studyUserEditSitePaymentEnabled ? (
                                  <div className="col-span-4 sm:col-span-4">
                                    <input
                                      placeholder="Amount"
                                      type="text"
                                      inputMode="decimal"
                                      className="w-full px-2 py-1.5 rounded-md border border-slate-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-xs"
                                      value={m.amount ?? ""}
                                      onChange={(e) =>
                                        setStudyUserEditForm((prev) => ({
                                          ...prev,
                                          milestones:
                                            prev.milestones?.map((x, j) =>
                                              j === i ? { ...x, amount: e.target.value } : x
                                            ) || [],
                                        }))
                                      }
                                    />
                                  </div>
                                ) : null}
                                <div className="col-span-2 flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setStudyUserEditForm((prev) => ({
                                        ...prev,
                                        milestones: prev.milestones?.filter((_, j) => j !== i) || [],
                                      }))
                                    }
                                    className="p-1.5 text-red-600 hover:text-red-700"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                          {(() => {
                            const totalPatients =
                              studyUserEditForm.noOfPlannedPatients != null &&
                              studyUserEditForm.noOfPlannedPatients !== ""
                                ? parseInt(studyUserEditForm.noOfPlannedPatients, 10) || 0
                                : 0
                            const totalAmount =
                              studyUserEditForm.totalHonorariumAmount != null &&
                              studyUserEditForm.totalHonorariumAmount !== ""
                                ? parseFloat(studyUserEditForm.totalHonorariumAmount) || 0
                                : 0
                            const milestonePatientsTotal = (studyUserEditForm.milestones || []).reduce(
                              (sum, m) => sum + (parseInt(m.noOfPatients, 10) || 0),
                              0
                            )
                            const milestoneAmountTotal = (studyUserEditForm.milestones || []).reduce(
                              (sum, m) => sum + (parseFloat(m.amount) || 0),
                              0
                            )
                            const patientsExceeded = milestonePatientsTotal > totalPatients
                            const amountExceeded = milestoneAmountTotal > totalAmount

                            return (
                              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-2 mt-2">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-slate-600">Total Milestone Patients:</span>
                                  <span
                                    className={`font-semibold ${
                                      patientsExceeded ? "text-red-600" : "text-slate-800"
                                    }`}
                                  >
                                    {milestonePatientsTotal} / {totalPatients}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-slate-600">Total Milestone Amount:</span>
                                  <span
                                    className={`font-semibold ${
                                      amountExceeded ? "text-red-600" : "text-slate-800"
                                    }`}
                                  >
                                    {milestoneAmountTotal.toFixed(2)} / {totalAmount.toFixed(2)}
                                  </span>
                                </div>
                                {patientsExceeded && (
                                  <p className="text-xs text-red-600 mt-1 font-medium">
                                    ⚠ Total milestone patients exceeds planned patients
                                  </p>
                                )}
                                {amountExceeded && (
                                  <p className="text-xs text-red-600 mt-1 font-medium">
                                    ⚠ Total milestone amount exceeds total honorarium amount
                                  </p>
                                )}
                              </div>
                            )
                          })()}
                        </div>
                      </div>
                    )}
                    {/* Visit amounts - only for Milestone (Visit Wise) */}
                    {studyUserEditForm.studyType === "milestoneVisit" && studyUserEditSitePaymentEnabled && (
                      <div className="bg-emerald-50 rounded-xl p-6 border border-emerald-200">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4">
                          Milestone Configuration (Visit Wise)
                        </h3>
                        {hasActivePaymentRules(editStudyPaymentRules.rules) && (
                          <p className="text-xs text-emerald-900 bg-emerald-100/70 rounded-lg px-3 py-2 mb-4 border border-emerald-200/80">
                            Payment rules for this study are shown in brackets next to each visit step.
                          </p>
                        )}
                        <div className="mb-4">
                          <p className="text-sm text-slate-700 mb-3">
                            Add visit amounts manually. Total visit amounts should not exceed the total honorarium amount above.
                          </p>
                        </div>
                        {(studyUserEditForm.visitAmounts || []).length > 0 && (
                          <div className="space-y-3">
                            {(studyUserEditForm.visitAmounts || []).map((v, i) => (
                              <div
                                key={i}
                                className="bg-white rounded-lg p-4 border border-slate-200 flex items-center gap-4"
                              >
                                <div className="flex-1">
                                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                                    Amount for Visit {v.visitNo || i + 1}
                                    {milestoneLabelSuffix(
                                      v.visitNo || i + 1,
                                      editStudyPaymentRules.rules,
                                      editStudyPaymentRules.visitSchedules,
                                    )}{" "}
                                    <span className="text-red-500">*</span>
                                  </label>
                                  <input
                                    type="number"
                                    value={v.amount || ""}
                                    onChange={(e) =>
                                      setStudyUserEditForm((prev) => ({
                                        ...prev,
                                        visitAmounts:
                                          prev.visitAmounts?.map((x, j) =>
                                            j === i ? { ...x, amount: e.target.value } : x
                                          ) || [],
                                      }))
                                    }
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all bg-white text-slate-800 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    placeholder="Enter amount"
                                    min="0"
                                    step="1"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setStudyUserEditForm((prev) => ({
                                      ...prev,
                                      visitAmounts: prev.visitAmounts?.filter((_, j) => j !== i) || [],
                                    }))
                                  }
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                            {(() => {
                              const totalAmount =
                                studyUserEditForm.totalHonorariumAmount != null &&
                                studyUserEditForm.totalHonorariumAmount !== ""
                                  ? parseFloat(studyUserEditForm.totalHonorariumAmount)
                                  : 0
                              const visitAmountTotal = (studyUserEditForm.visitAmounts || []).reduce(
                                (sum, v) => sum + (parseFloat(v.amount) || 0),
                                0
                              )
                              const amountExceeded = visitAmountTotal > totalAmount

                              return (
                                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-600">Total Visit Amount:</span>
                                    <span
                                      className={`font-semibold ${
                                        amountExceeded ? "text-red-600" : "text-slate-800"
                                      }`}
                                    >
                                      {visitAmountTotal.toFixed(2)} / {totalAmount.toFixed(2)}
                                    </span>
                                  </div>
                                  {amountExceeded && (
                                    <p className="text-xs text-red-600 mt-2 font-medium">
                                      ⚠ Total visit amount exceeds total honorarium amount
                                    </p>
                                  )}
                                </div>
                              )
                            })()}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setStudyUserEditForm((prev) => ({
                              ...prev,
                              visitAmounts: [
                                ...(prev.visitAmounts || []),
                                { visitNo: ((prev.visitAmounts?.length || 0) + 1).toString(), amount: 0, name: "" },
                              ],
                            }))
                          }
                          className="inline-flex items-center gap-2 px-4 py-2 mt-4 bg-violet-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-semibold"
                        >
                          <Plus className="w-4 h-4" />
                          Add Visit Amount
                        </button>
                      </div>
                    )}
                    {studyUserEditError && (
                      <div
                        role="alert"
                        aria-live="assertive"
                        className="mt-2 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 shadow-sm"
                      >
                        <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                        <p className="text-sm font-semibold text-red-700 leading-snug">{studyUserEditError}</p>
                      </div>
                    )}
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                      <button type="button" onClick={handleCloseEditStudyUser} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 text-sm">Cancel</button>
                      <button type="submit" disabled={studyUserEditLoading} className="px-4 py-2 rounded-lg bg-violet-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50 text-sm">
                        {studyUserEditLoading ? "Saving..." : "Save updates"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Delete User Confirmation Modal */}
            {deleteConfirmUser && (
              <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-red-200 overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                      <Trash2 className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Delete User</h3>
                  </div>
                  <div className="p-6 space-y-4">
                    <p className="text-slate-700">
                      Are you sure you want to delete user <span className="font-semibold text-slate-900">"{deleteConfirmUser.userName}"</span>? This action cannot be undone.
                    </p>
                    <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmUser(null)}
                        className="px-5 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmDeleteUser}
                        disabled={deletingUser === deleteConfirmUser.id}
                        className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                      >
                        {deletingUser === deleteConfirmUser.id ? (
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

            {/* Reset Password Confirmation Modal */}
            {resetPasswordConfirmUser && (
              <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-red-200 overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                      <RotateCw className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Reset Password</h3>
                  </div>
                  <div className="p-6 space-y-4">
                    <p className="text-slate-700">
                      Are you sure you want to reset password for user <span className="font-semibold text-slate-900">"{resetPasswordConfirmUser.userName}"</span>? A new password will be sent to their email.
                    </p>
                    <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => setResetPasswordConfirmUser(null)}
                        className="px-5 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmResetPassword}
                        disabled={resettingPassword === resetPasswordConfirmUser.id}
                        className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                      >
                        {resettingPassword === resetPasswordConfirmUser.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Resetting...
                          </>
                        ) : (
                          "Reset Password"
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Assign User Modal - Checkbox Component */}
            <AssignUserModal
              show={showAssignModal}
              onClose={() => {
                setShowAssignModal(false)
                setAssignFormData({ userId: null, studyId: "", siteId: "", siteIds: [] })
                setAssigningUserRole("")
                setAssigningUserRoleGuid("")
                setSelectedAssignments({})
                setAssignSearchQuery("")
              }}
              userId={assignFormData.userId}
              studies={assignModalStudies}
              loading={loadingStudies}
              selectedAssignments={selectedAssignments}
              onAssignmentsChange={setSelectedAssignments}
              onSave={handleSaveAssign}
              saving={assigningUser === assignFormData.userId}
              searchQuery={assignSearchQuery}
              onSearchChange={setAssignSearchQuery}
              userRole={assigningUserRole}
              availableRoles={availableRoles}
              defaultRoleGuid={assigningUserRoleGuid}
            />
          </div>
        </div>
      </div>

      <CreatedUserCredentialsModal
        open={Boolean(createdCredentials)}
        onClose={() => setCreatedCredentials(null)}
        title={createdCredentials?.title}
        email={createdCredentials?.email}
        password={createdCredentials?.password}
        contextLabel={createdCredentials?.contextLabel}
      />
    </DashboardLayout>
  )
}
