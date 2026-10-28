"use client"

import { useEffect, useLayoutEffect, useState, useRef, useMemo } from "react"
import { useRouter, usePathname } from "next/navigation"
import {
  authService,
  dashboardService,
  visitScheduleService,
  userService,
  studyService,
  userAgreementService,
} from "@/lib/services"
import studyDocumentService from "@/lib/services/studyDocument.service"
import { loadImageAsBlobUrl } from "@/lib/utils/imageLoader"
import { StudyFilter } from "@/lib/api/config"
import DashboardLayout from "@/components/dashboard-layout"
import PageLoader from "@/components/ui/page-loader"
import DashboardPageSkeleton from "@/components/ui/dashboard-page-skeleton"
import DashboardCommandHero from "@/components/dashboard/DashboardCommandHero"
import DashboardMetricStrip from "@/components/dashboard/DashboardMetricStrip"
import DashboardMetricLensPortal from "@/components/dashboard/DashboardMetricLensPortal"
import DashboardStudySiteInfoCard from "@/components/dashboard/DashboardStudySiteInfoCard"
import DashboardChartSection, { DashboardChartBadge } from "@/components/dashboard/DashboardChartCard"
import ReportDownloadDialog from "@/components/reports/ReportDownloadDialog"
import {
  exportTotalSubjectsCsv,
  exportTotalSubjectsHtml,
  exportTotalSubjectsExcel,
  exportTotalSubjectsPdf,
} from "@/lib/utils/totalSubjectsExport"
import { extractDashboardSiteRows } from "@/lib/utils/dashboardSiteRows"
import { toast } from "sonner"
import { resolveDashboardStudySiteInfo } from "@/lib/dashboard/resolveDashboardStudySiteInfo"
import { useStudySiteContext } from "@/hooks/useStudySiteContext"
import useStudyPiPendingSummary from "@/hooks/useStudyPiPendingSummary"
import { useStudyAiSettingsForStudy } from "@/lib/intelligence/useStudyAiSettings"
import AiMonitoringSummaryCard from "@/components/intelligence/AiMonitoringSummaryCard"
import { isDashboardAdminUser, isDashboardSuperAdminUser } from "@/lib/dashboard/dashboardMetricLens"
import {
  DASHBOARD_SHELL_CLASS,
  DASHBOARD_BENTO_CLASS,
  DASHBOARD_CRA_GRID_CLASS,
  DASHBOARD_CRC_ENROLLMENT_GRID_CLASS,
  DASHBOARD_CRC_PAIR_CHART_CLASS,
  DASHBOARD_STUDIO_HERO_CLASS,
  DASHBOARD_STUDIO_HERO_MAIN_CLASS,
  DASHBOARD_STUDIO_HERO_SIDE_CLASS,
  DASHBOARD_STUDIO_BODY_CLASS,
  DASHBOARD_STUDIO_STACK_CLASS,
  DASHBOARD_STUDIO_RAIL_CLASS,
  DASHBOARD_STUDIO_GROUP_CLASS,
  DASHBOARD_STUDIO_GROUP_DIVIDER_CLASS,
} from "@/lib/ui/dashboardUi"
import { 
  ReportsExportedChart,
  ScreeningBaselineVisitChart,
  StudyOpenCloseChart,
  CRFDataEntryChart,
  StudyCountsBarChart,
  MultiCrfRoleProgressBarChart,
  QueryManagementPieChart,
  StudyCountsPieChart,
  UserCountsPieChart,
  SitePatientEnrollmentBarChart,
} from "@/components/dashboard-charts"
import { cn } from "@/lib/utils"
import { useCountAnimation } from "@/hooks/useCountAnimation"
import { useStudyAgreementEnabled } from "@/hooks/useStudyAgreementEnabled"
import { useStudySettings } from "@/context/StudySettingsContext"
import {
  fetchStudySettingsByStudyId,
  getCachedStudySettings,
  userCanViewStudyDocuments,
  resolveIsAgreementEnabled,
  pickIsAgreementEnabledFromStudiesList,
  pickIsAgreementSignedFromStudiesList,
} from "@/lib/utils/studySettingsRead"
import {
  getDashboardRoleProfile,
  getUsersByRoleChartColor,
} from "@/lib/utils/dashboardRoleLayout"
import {
  Users,
  ClipboardCheck,
  Activity,
  UserCheck,
  Calendar,
  Download,
  MapPin,
  Search,
  X,
  FileText,
  FileCheck,
  Mic,
  Bot,
  ChevronDown,
} from "lucide-react"

/** Module-level — survives Dashboard page remounts when sidebar is clicked repeatedly. */
let dashboardSessionSnapshot = {
  studyKey: null,
  dashboardData: null,
  additionalCounts: null,
}

export default function DashboardPage() {
  const router = useRouter()
  const pathname = usePathname()
  const { studyId: agreementGateStudyId, isAgreementEnabled } = useStudyAgreementEnabled()
  const { studyId: headerStudyId } = useStudySiteContext()
  const {
    pendingCount: piPendingCrfs,
    isPiSignoffRequired: piSignoffEnabledOnStudy,
  } = useStudyPiPendingSummary(headerStudyId, { enabled: Boolean(headerStudyId) })
  const { isAiInsightEnabled } = useStudyAiSettingsForStudy(headerStudyId)
  const studySettingsCtx = useStudySettings()
  const DASHBOARD_CACHE_PREFIX = "dashboardCache_v1_"
  const DASHBOARD_CACHE_MAX_AGE_MS = 300000 // 5 minutes
  const SKELETON_DELAY_MS = 200 // reduce noticeable skeleton flicker on fast navigations

  const getStudyCacheKey = () => {
    if (typeof window === "undefined") return "null"
    const id = localStorage.getItem("selectedStudyId")
    return id ? String(parseInt(id, 10)) : "null"
  }

  const applyDashboardSessionSnapshot = (studyKey, data, counts) => {
    if (!data) return
    dashboardSessionSnapshot = {
      studyKey,
      dashboardData: data,
      additionalCounts: counts ?? dashboardSessionSnapshot.additionalCounts,
    }
  }

  const restoreDashboardFromSessionOrCache = () => {
    const studyKey = getStudyCacheKey()
    const snap = dashboardSessionSnapshot
    if (snap.studyKey === studyKey && snap.dashboardData) {
      dashboardDataRef.current = snap.dashboardData
      setDashboardData(snap.dashboardData)
      if (snap.additionalCounts) setAdditionalCounts(snap.additionalCounts)
      setLoading(false)
      return true
    }
    const cached = readDashboardCache()
    if (cached?.dashboardData) {
      dashboardDataRef.current = cached.dashboardData
      setDashboardData(cached.dashboardData)
      if (cached?.additionalCounts) setAdditionalCounts(cached.additionalCounts)
      applyDashboardSessionSnapshot(studyKey, cached.dashboardData, cached.additionalCounts)
      setLoading(false)
      return true
    }
    return false
  }

  const getStudyIdForCache = () => {
    if (typeof window === "undefined") return null
    const id = localStorage.getItem("selectedStudyId")
    return id ? parseInt(id, 10) : null
  }

  const getDashboardCacheKey = (studyId) => `${DASHBOARD_CACHE_PREFIX}${studyId === null ? "null" : studyId}`

  const readDashboardCache = () => {
    if (typeof window === "undefined") return null
    try {
      const studyId = getStudyIdForCache()
      const key = getDashboardCacheKey(studyId)
      const raw = localStorage.getItem(key)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      if (!parsed?.cachedAt) return null
      if (Date.now() - parsed.cachedAt > DASHBOARD_CACHE_MAX_AGE_MS) return null
      return parsed
    } catch {
      return null
    }
  }

  const [user, setUser] = useState(null)

  // Important: keep initial render identical on server+client to avoid hydration mismatch.
  // We'll hydrate cached dashboard data only after mount.
  const [dashboardData, setDashboardData] = useState(null)
  const [additionalCounts, setAdditionalCounts] = useState({
    agreementCount: 0,
    visitCount: 0,
    ecrfCount: 0,
  })
  const [loading, setLoading] = useState(true)
  const [totalSubjectsDownloadOpen, setTotalSubjectsDownloadOpen] = useState(false)
  const [totalSubjectsDownloading, setTotalSubjectsDownloading] = useState(false)
  const [hasHydrated, setHasHydrated] = useState(false)
  const [showSkeleton, setShowSkeleton] = useState(false)
  const skeletonTimeoutRef = useRef(null)
  const dashboardDataRef = useRef(dashboardData)

  const [assignedStudies, setAssignedStudies] = useState([])
  const [activeMetricLens, setActiveMetricLens] = useState(null)
  // Removed unused patient-related state - patient count comes from dashboard API statistics
  const [profileImageUrl, setProfileImageUrl] = useState(null) // Blob URL for user profile image
  const [downloadDocLoading, setDownloadDocLoading] = useState(false)
  const [documentResources, setDocumentResources] = useState(null)
  const [loadingDocumentResources, setLoadingDocumentResources] = useState(false)
  const [downloadDocError, setDownloadDocError] = useState(null)
  const [multiCrfRoleProgress, setMultiCrfRoleProgress] = useState(null)
  const [multiCrfRoleProgressError, setMultiCrfRoleProgressError] = useState("")
  const [downloadDropdownOpen, setDownloadDropdownOpen] = useState(false)
  const [downloadDropdownPosition, setDownloadDropdownPosition] = useState(null)
  const downloadDropdownRef = useRef(null)
  const downloadButtonRef = useRef(null)
  const fetchDataTimeoutRef = useRef(null) // Debounce ref for fetchData
  const fetchDataRef = useRef(null) // Latest fetchData closure for route revisits
  const lastFetchedStudyIdRef = useRef(undefined) // Track last fetched studyId to prevent duplicates (undefined = not fetched yet)
  const isFetchingRef = useRef(false) // Prevent concurrent calls
  const prevPathnameRef = useRef(pathname)
  const [preferredSiteId, setPreferredSiteId] = useState(null)
  const [activeStudyId, setActiveStudyId] = useState(null)

  const readActiveStudyId = () => {
    if (typeof window === "undefined") return null
    const raw = localStorage.getItem("selectedStudyId")
    const parsed = raw ? parseInt(raw, 10) : 0
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }

  const readPreferredSiteId = () => {
    if (typeof window === "undefined") return null
    const raw = localStorage.getItem("selectedSiteId")
    const parsed = raw ? parseInt(raw, 10) : 0
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }

  useEffect(() => {
    setActiveStudyId(readActiveStudyId())
    setPreferredSiteId(readPreferredSiteId())

    const onStudySiteChanged = (event) => {
      const studyId = event?.detail?.studyId
      if (studyId !== undefined) {
        const parsed = parseInt(studyId, 10)
        setActiveStudyId(Number.isFinite(parsed) && parsed > 0 ? parsed : null)
      } else {
        setActiveStudyId(readActiveStudyId())
      }

      const siteId = event?.detail?.siteId
      if (siteId != null && Number(siteId) > 0) {
        setPreferredSiteId(Number(siteId))
        return
      }
      setPreferredSiteId(readPreferredSiteId())
    }

    window.addEventListener("studySiteChanged", onStudySiteChanged)
    window.addEventListener("studySelected", onStudySiteChanged)
    return () => {
      window.removeEventListener("studySiteChanged", onStudySiteChanged)
      window.removeEventListener("studySelected", onStudySiteChanged)
    }
  }, [])

  useEffect(() => {
    dashboardDataRef.current = dashboardData
  }, [dashboardData])

  // Hydrate before paint so rapid Dashboard clicks don't stack skeleton panels.
  useLayoutEffect(() => {
    restoreDashboardFromSessionOrCache()
    setHasHydrated(true)
  }, [])

  useEffect(() => {
    if (!hasHydrated) {
      setShowSkeleton(false)
      if (skeletonTimeoutRef.current) clearTimeout(skeletonTimeoutRef.current)
      skeletonTimeoutRef.current = null
      return
    }

    if (!loading) {
      setShowSkeleton(false)
      if (skeletonTimeoutRef.current) clearTimeout(skeletonTimeoutRef.current)
      skeletonTimeoutRef.current = null
      return
    }

    // Only show the skeleton if loading persists long enough.
    setShowSkeleton(false)
    if (skeletonTimeoutRef.current) clearTimeout(skeletonTimeoutRef.current)
    skeletonTimeoutRef.current = setTimeout(() => {
      setShowSkeleton(true)
    }, SKELETON_DELAY_MS)

    return () => {
      if (skeletonTimeoutRef.current) clearTimeout(skeletonTimeoutRef.current)
      skeletonTimeoutRef.current = null
    }
  }, [loading, hasHydrated])

  // Load profile image using common utility function
  const loadProfileImage = async (documentUrl) => {
    if (!documentUrl) {
      return
    }

    // Revoke previous blob URL if exists
    if (profileImageUrl) {
      window.URL.revokeObjectURL(profileImageUrl)
    }

    // Use common utility function to load image
    const { blobUrl, error } = await loadImageAsBlobUrl(documentUrl)
    
    if (error) {
      // Silently fail - just don't show the image
      console.warn("Failed to load profile image:", error)
      setProfileImageUrl(null)
      return
    }

    if (blobUrl) {
      setProfileImageUrl(blobUrl)
    }
  }
  
  // Fetch user profile to get profile photo URL
  const fetchUserProfile = async () => {
    try {
      const currentUser = authService.getUser()
      if (currentUser) {
        const photoUrl = currentUser.profilePhotoUrl || currentUser.profileImage || currentUser.profileImageUrl || null
        if (photoUrl) {
          await loadProfileImage(photoUrl)
        }
      }
    } catch (error) {
      // Silently fail - just don't show the image
      console.warn("Failed to fetch user profile for image:", error)
    }
  }

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      router.push("/login")
      return
    }

    const currentUser = authService.getUser()
    setUser(currentUser)

    const getStudyId = () => {
      if (typeof window === "undefined") return null
      const id = localStorage.getItem("selectedStudyId")
      return id ? parseInt(id, 10) : null
    }

    const fetchRoleProgressData = async (studyId, currentUser) => {
      try {
        const roleCode = (currentUser?.roleCode || "").toString().trim().toUpperCase()
        const roleName = (currentUser?.roleName || roleCode).toString().trim().toUpperCase()
        const isEndoOrPatho =
          roleCode === "ENDOSCOPIST" ||
          roleCode === "PATHOLOGIST" ||
          roleName.includes("ENDOSCOPIST") ||
          roleName.includes("PATHOLOGIST")

        if (!(isEndoOrPatho && Number.isFinite(studyId) && studyId > 0)) {
          setMultiCrfRoleProgress(null)
          setMultiCrfRoleProgressError("")
          return
        }

        const settings =
          studySettingsCtx?.studyId === studyId && studySettingsCtx?.data != null
            ? studySettingsCtx.data
            : (await fetchStudySettingsByStudyId(studyId))?.data || {}
        const rawMulti =
          settings?.isMultiCrfAllowedPerVisitType ??
          settings?.IsMultiCrfAllowedPerVisitType ??
          settings?.studySetting?.isMultiCrfAllowedPerVisitType ??
          settings?.studySetting?.IsMultiCrfAllowedPerVisitType
        const rawNorm = String(rawMulti ?? "").toLowerCase()
        const isMultiCrfEnabled =
          rawMulti === true ||
          rawMulti === 1 ||
          rawNorm === "true" ||
          rawNorm === "1" ||
          rawNorm === "yes"

        if (!isMultiCrfEnabled) {
          setMultiCrfRoleProgress(null)
          setMultiCrfRoleProgressError("")
          return
        }

        const selectedSiteIdRaw = typeof window !== "undefined" ? localStorage.getItem("selectedSiteId") : null
        const selectedSiteId = selectedSiteIdRaw ? parseInt(selectedSiteIdRaw, 10) : 0
        const siteId = Number.isFinite(selectedSiteId) && selectedSiteId > 0 ? selectedSiteId : 0

        const roleProgressRes = await dashboardService.getMultiCrfRoleProgress(studyId, siteId)
        if (roleProgressRes?.isSuccess && roleProgressRes?.data) {
          setMultiCrfRoleProgress(roleProgressRes.data)
          setMultiCrfRoleProgressError("")
        } else {
          setMultiCrfRoleProgress(null)
          const statusCode = roleProgressRes?.statusCode
          if (statusCode === 400) setMultiCrfRoleProgressError("Multi-CRF role progress is not enabled for this study.")
          else if (statusCode === 403) setMultiCrfRoleProgressError("You do not have permission to view role progress.")
          else if (statusCode === 404) setMultiCrfRoleProgressError("Study/Site not found for role progress.")
          else if (statusCode === 500) setMultiCrfRoleProgressError("Unable to load role progress right now.")
          else setMultiCrfRoleProgressError(roleProgressRes?.message || "Unable to load role progress right now.")
        }
      } catch {
        setMultiCrfRoleProgress(null)
        setMultiCrfRoleProgressError("")
      }
    }

    const applyDashboardCacheIfNeeded = () => {
      if (dashboardDataRef.current != null) return true
      const cached = readDashboardCache()
      if (!cached?.dashboardData) return false
      dashboardDataRef.current = cached.dashboardData
      setDashboardData(cached.dashboardData)
      if (cached?.additionalCounts) setAdditionalCounts(cached.additionalCounts)
      setLoading(false)
      return true
    }

    const fetchData = async (studyId, siteId = readPreferredSiteId()) => {
      // Prevent duplicate calls for the same studyId (including null)
      // But allow initial fetch even if studyId is null
      const studyIdKey = studyId === null ? "null" : studyId
      const siteIdKey = siteId == null ? "null" : siteId
      const fetchKey = `${studyIdKey}:${siteIdKey}`
      const lastFetchedKey =
        lastFetchedStudyIdRef.current === null
          ? "null"
          : lastFetchedStudyIdRef.current === undefined
            ? undefined
            : lastFetchedStudyIdRef.current
      
      // Allow fetch if: not currently fetching AND (never fetched before OR scope changed)
      const shouldSkip = isFetchingRef.current || (lastFetchedKey !== undefined && lastFetchedKey === fetchKey)
      
      if (shouldSkip) {
        if (dashboardDataRef.current != null || applyDashboardCacheIfNeeded()) {
          setLoading(false)
        }
        console.log("Skipping duplicate dashboard fetch for studyId:", studyId, "siteId:", siteId)
        return
      }

      isFetchingRef.current = true
      lastFetchedStudyIdRef.current = fetchKey
      const hasCachedOrLoadedData = applyDashboardCacheIfNeeded()
      if (!hasCachedOrLoadedData) setLoading(true)
      try {
        // Dashboard data is expected to be scoped to the current user and selected study (studyId)
        const res = await dashboardService.getDashboard(studyId, siteId)

        const nextDashboardData = res?.isSuccess ? res.data : null
        setDashboardData(nextDashboardData)

        let nextAdditionalCounts = additionalCounts
        // Update additional counts after dashboard data is loaded
        if (res?.isSuccess && res.data?.statistics) {
          const statistics = res.data.statistics
          nextAdditionalCounts = {
            agreementCount: statistics.agreementCount || 0,
            visitCount: statistics.visitCount || 0,
            ecrfCount: statistics.crfDesignCount || 0,
          }
          setAdditionalCounts(nextAdditionalCounts)
        }

        // Cache core dashboard data to avoid skeleton flicker on quick navigations.
        if (typeof window !== "undefined" && res?.isSuccess && nextDashboardData) {
          try {
            const cacheKey = getDashboardCacheKey(studyId)
            localStorage.setItem(
              cacheKey,
              JSON.stringify({
                cachedAt: Date.now(),
                dashboardData: nextDashboardData,
                additionalCounts: nextAdditionalCounts,
              })
            )
            applyDashboardSessionSnapshot(
              studyId === null ? "null" : String(studyId),
              nextDashboardData,
              nextAdditionalCounts
            )
          } catch {
            // Cache is a best-effort optimization; ignore failures.
          }
        }

        // Allow dashboard UI to render as soon as core data is ready.
        // Role-progress card can load independently in background.
        setLoading(false)
        fetchRoleProgressData(studyId, currentUser)
      } catch {
        setDashboardData(null)
        setMultiCrfRoleProgress(null)
        setMultiCrfRoleProgressError("")
        setLoading(false)
      } finally {
        isFetchingRef.current = false
      }
    }

    fetchDataRef.current = fetchData
    fetchData(getStudyId(), readPreferredSiteId())
    fetchAssignedStudies()
    fetchUserProfile() // Fetch user profile image

    const handler = (e) => {
      const studyId = e.detail?.studyId !== undefined ? e.detail.studyId : getStudyId()
      const siteId =
        e.detail?.siteId != null && Number(e.detail.siteId) > 0
          ? Number(e.detail.siteId)
          : readPreferredSiteId()
      
      // Clear any pending timeout to reset the debounce
      if (fetchDataTimeoutRef.current) {
        clearTimeout(fetchDataTimeoutRef.current)
        fetchDataTimeoutRef.current = null
      }
      
      // Debounce to batch multiple events (studySelected + studySiteChanged)
      // This ensures when both events fire (like on clear), only one API call happens
      fetchDataTimeoutRef.current = setTimeout(() => {
        const studyIdKey = studyId === null ? "null" : studyId
        const siteIdKey = siteId == null ? "null" : siteId
        const fetchKey = `${studyIdKey}:${siteIdKey}`
        const currentKey = lastFetchedStudyIdRef.current

        if (fetchKey !== currentKey || !isFetchingRef.current) {
          fetchData(studyId, siteId)
        }
        fetchDataTimeoutRef.current = null
      }, 200) // 200ms debounce to batch both events
    }
    window.addEventListener("studySiteChanged", handler)
    window.addEventListener("studySelected", handler) // Also listen to studySelected event
    return () => {
      fetchDataRef.current = null
      window.removeEventListener("studySiteChanged", handler)
      window.removeEventListener("studySelected", handler)
      if (fetchDataTimeoutRef.current) {
        clearTimeout(fetchDataTimeoutRef.current)
        fetchDataTimeoutRef.current = null
      }
    }
  }, [router])

  // Re-entering /dashboard from another route: restore session/cache before skeleton shows.
  useLayoutEffect(() => {
    const prev = prevPathnameRef.current
    if (pathname === prev) return
    prevPathnameRef.current = pathname
    if (pathname !== "/dashboard") return
    if (restoreDashboardFromSessionOrCache()) return
    if (dashboardDataRef.current != null) {
      setLoading(false)
      return
    }
    if (!fetchDataRef.current || isFetchingRef.current) return
    lastFetchedStudyIdRef.current = undefined
    fetchDataRef.current(getStudyIdForCache())
  }, [pathname])

  // Cleanup: Revoke blob URLs when component unmounts or profileImageUrl changes
  useEffect(() => {
    return () => {
      if (profileImageUrl) {
        window.URL.revokeObjectURL(profileImageUrl)
      }
    }
  }, [profileImageUrl])

  // Fetch assigned studies for summary counts
  const fetchAssignedStudies = async () => {
    try {
      const response = await studyService.getAccessibleStudiesWithSites(StudyFilter.Active)
      if (response && response.isSuccess && response.data) {
        setAssignedStudies(Array.isArray(response.data) ? response.data : [])
      }
    } catch (error) {
      console.error("Error fetching assigned studies:", error)
      setAssignedStudies([])
    }
  }

  // Fetch additional counts (now using statistics from dashboard API)
  const fetchAdditionalCounts = async () => {
    try {
      // All counts are now coming from dashboard API statistics
      const statistics = dashboardData?.statistics || {}

      setAdditionalCounts({
        agreementCount: statistics.agreementCount || 0,
        visitCount: statistics.visitCount || 0,
        ecrfCount: statistics.crfDesignCount || 0,
      })
    } catch (error) {
      // Handle error silently
    }
  }

  // Calculate summary counts from API data (chart totals for Visit when API doesn't provide them)
  const calculateSummaryCounts = () => {
    const statistics = dashboardData?.statistics || {}
    const sbv = chartData?.screeningBaselineVisit || []
    const visitFromChart = sbv.reduce((s, r) => s + (Number(r.visit) || 0), 0)
    return {
      studyCount: statistics.totalStudies || 0,
      activeStudies: statistics.activeStudies || 0,
      siteCount: statistics.siteCount || 0,
      patientCount: statistics.totalPatients || 0,
      agreementCount: statistics.agreementCount || 0,
      visitCount: statistics.visitCount ?? visitFromChart,
      ecrfCount: statistics.crfDesignCount || 0,
    }
  }

  // Removed fetchPatients function - patient count comes from dashboard API statistics
  // Patients list is not displayed on dashboard, so no need to fetch it

  // Transform API response data for charts
  const transformData = (data) => {
    // Generate monthly data for last 6 months
    const generateMonthlyData = () => {
      const currentDate = new Date()
      const months = []
      for (let i = 5; i >= 0; i--) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
        months.push(date.toLocaleString('default', { month: 'short', year: 'numeric' }))
      }
      return months
    }
    
    const months = generateMonthlyData()

    // Generate dummy data for Reports Exported
    const reportsExported = data?.reportsExported?.monthlyData && data.reportsExported.monthlyData.length > 0
      ? data.reportsExported.monthlyData
      : months.map((month, idx) => ({
          month,
          count: 15 + idx * 5 + Math.floor(Math.random() * 10),
        }))

    // Screening, Baseline, Visit: use only API data (user-scoped). When none, show zeros. Chart shows Visit only.
    const screeningBaselineVisit = data?.screeningBaselineVisit?.monthlyData && data.screeningBaselineVisit.monthlyData.length > 0
      ? data.screeningBaselineVisit.monthlyData
      : months.map((month) => ({
          month,
          screening: 0,
          baseline: 0,
          visit: 0,
        }))

    // Generate dummy data for Study Open/Close
    const studyOpenClose = data?.studyOpenClose?.monthlyData && data.studyOpenClose.monthlyData.length > 0
      ? data.studyOpenClose.monthlyData
      : months.map((month, idx) => ({
          month,
          opened: 3 + idx + Math.floor(Math.random() * 3),
          closed: 1 + Math.floor(idx / 2) + Math.floor(Math.random() * 2),
        }))

    // Generate dummy data for CRF Data Entry
    const crfDataEntry = data?.crfDataEntry && data.crfDataEntry.length > 0
      ? data.crfDataEntry
      : [
          { name: "Manual", value: 120 + Math.floor(Math.random() * 50), color: "#6366f1" },
          { name: "AI", value: 85 + Math.floor(Math.random() * 40), color: "#8b5cf6" },
          { name: "VoiceToText", value: 45 + Math.floor(Math.random() * 30), color: "#10b981" },
        ]

    // Transform trends data from trendAnalysis or generate dummy
    const trendsData = data?.trendAnalysis?.monthlyData && data.trendAnalysis.monthlyData.length > 0
      ? data.trendAnalysis.monthlyData.map((item) => ({
          month: item.month || "",
          studies: item.totalStudies || 0,
          sites: item.activeSites || 0,
          patients: item.totalPatients || 0,
        }))
      : months.map((month, idx) => ({
          month,
          studies: 5 + idx * 2 + Math.floor(Math.random() * 3),
          sites: 15 + idx * 3 + Math.floor(Math.random() * 5),
          patients: 50 + idx * 10 + Math.floor(Math.random() * 15),
        }))

    // Planned vs Actual: monthlyTrend (legacy) or monthlyData (current API)
    const plannedVsActualMonthly =
      (Array.isArray(data?.plannedVsActual?.monthlyTrend) && data.plannedVsActual.monthlyTrend.length > 0
        ? data.plannedVsActual.monthlyTrend
        : null) ||
      (Array.isArray(data?.plannedVsActual?.monthlyData) && data.plannedVsActual.monthlyData.length > 0
        ? data.plannedVsActual.monthlyData
        : null)
    const studiesByMonth = plannedVsActualMonthly
      ? plannedVsActualMonthly.map((item) => ({
          month: item.month || "",
          planned: item.plannedPatients ?? item.planned ?? 0,
          actual: item.enrolledPatients ?? item.actual ?? 0,
          completed: item.completedPatients ?? item.completed ?? 0,
        }))
      : months.map((month) => ({
          month,
          planned: 0,
          actual: 0,
        }))

    // Get totalUsers from statistics
    const totalUsers = data?.statistics?.totalUsers || 0

    return {
      // Study Status Pie Chart data (not used but kept for compatibility)
      studiesByStatus: [
        {
          name: "Active",
          value: data?.studyStatusCounts?.active || 0,
          color: "#10b981",
        },
        {
          name: "Locked",
          value: data?.studyStatusCounts?.pending || 0,
          color: "#f59e0b",
        },
        {
          name: "Completed",
          value: data?.studyStatusCounts?.completed || 0,
          color: "#8b5cf6",
        },
      ],
      // Users by Role Pie Chart data (not used but kept for compatibility)
      usersByRole:
        data?.usersByRole?.roleCounts && data.usersByRole.roleCounts.length > 0
          ? data.usersByRole.roleCounts.map((role) => ({
              name: role.roleName || role.roleCode,
              value: role.count || 0,
              color: getUsersByRoleChartColor(role.roleCode),
            }))
          : [],
      // Total users from statistics (for center label in pie chart)
      totalUsers: totalUsers,
      // Planned vs Actual Bar Chart data with dummy data
      studiesByMonth,
      // Trends data for line chart with dummy data
      trendsByMonth: trendsData,
      // Charts data with dummy data
      reportsExported,
      screeningBaselineVisit,
      studyOpenClose,
      crfDataEntry,
    }
  }

  
  const chartData = transformData(dashboardData)

  // Totals for Visit (from API statistics or sum of chart data)
  const sbvChart = chartData?.screeningBaselineVisit || []
  const stats = dashboardData?.statistics || {}
  const visitTotal = stats.visitCount ?? sbvChart.reduce((s, r) => s + (Number(r.visit) || 0), 0)

  // Title-case name for display (e.g. "yash" -> "Yash", "yash patil" -> "Yash Patil")
  const toDisplayName = (str) => {
    if (!str || typeof str !== "string") return "User"
    const trimmed = str.trim()
    if (!trimmed) return "User"
    return trimmed.split(/\s+/).map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ")
  }
  const displayName = toDisplayName(user?.firstName || user?.username || user?.loginName || "User")

  const {
    isCrcOnly,
    isCra,
    isCrcSiteRole,
    isEndoscopistOrPathologist,
    hideAllChartsExceptPlannedVsActual,
    isHeroPlannedVsActualLayout,
    showCraDashboardInsights,
    showCrcDashboardInsights,
    showCrcVisitChart,
    showSponsorPatientStatusFull,
    showAdminTotalSubjects,
    showThirdChartRow,
    showQueryManagement: shouldShowQueryManagement,
    showAgreementKpi: roleShowAgreementKpi,
  } = getDashboardRoleProfile(user)

  const showAgreementKpi =
    roleShowAgreementKpi &&
    !(agreementGateStudyId && isAgreementEnabled === false)
  const showTotalUsersKpi = !isCrcSiteRole && !hideAllChartsExceptPlannedVsActual

  const getSelectedStudyId = () => {
    if (typeof window === "undefined") return null
    const id = localStorage.getItem("selectedStudyId")
    return id ? parseInt(id, 10) : null
  }

  // Documents: show only when login user's roleGuid is in studyDocShowRoleGuids for the selected study.
  const canShowDocuments = (() => {
    const selectedStudyId = getSelectedStudyId()
    if (!selectedStudyId) return false

    const settingsData =
      studySettingsCtx?.studyId === selectedStudyId
        ? studySettingsCtx?.data
        : getCachedStudySettings(selectedStudyId)?.data ?? null

    return userCanViewStudyDocuments(user, settingsData)
  })()

  useEffect(() => {
    const studyId = headerStudyId || getSelectedStudyId()
    if (!canShowDocuments || !studyId) {
      setDocumentResources(null)
      return
    }

    let cancelled = false
    ;(async () => {
      setLoadingDocumentResources(true)
      try {
        const res = await studyDocumentService.getDocumentResources(studyId)
        if (!cancelled) {
          setDocumentResources(res?.isSuccess ? res.data : null)
        }
      } finally {
        if (!cancelled) setLoadingDocumentResources(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [canShowDocuments, headerStudyId, studySettingsCtx?.studyId, studySettingsCtx?.data, user])

  const studyInfo = dashboardData?.studyInfo
  const statistics = dashboardData?.statistics || {}
  const summaryCounts = calculateSummaryCounts()
  const userTotal = statistics.totalUsers || 0

  // Query donut counts for "Query Management" card.
  // Backend contract (guide):
  // - data.queryStatusCounts (study-wise, when studyId provided)
  // - data.systemQueryStatusCounts (system-wise, may be undefined)
  const queryStatusCounts =
    dashboardData?.queryStatusCounts ??
    dashboardData?.data?.queryStatusCounts ??
    dashboardData?.statistics?.queryStatusCounts ??
    null
  const systemQueryStatusCounts =
    dashboardData?.systemQueryStatusCounts ??
    dashboardData?.data?.systemQueryStatusCounts ??
    dashboardData?.statistics?.systemQueryStatusCounts ??
    null
  const totalEnrolledPatients = Number(multiCrfRoleProgress?.totalEnrolledPatients || 0)
  const totalPlannedPatients = Number(multiCrfRoleProgress?.totalPlannedPatients || 0)
  const endoSubmitted = Number(multiCrfRoleProgress?.endoscopistSubmittedPatients || 0)
  const pathoSubmitted = Number(multiCrfRoleProgress?.pathologistSubmittedPatients || 0)

  const craSitePatientRows = extractDashboardSiteRows(dashboardData)

  const totalSubjectsSites = useMemo(() => {
    const siteFilter = Number(preferredSiteId)
    if (!Number.isFinite(siteFilter) || siteFilter <= 0) return craSitePatientRows
    return craSitePatientRows.filter(
      (site) => Number(site?.siteId ?? site?.SiteId ?? site?.id) === siteFilter,
    )
  }, [craSitePatientRows, preferredSiteId])

  const totalSubjectsChartSiteId = preferredSiteId

  const plannedVsActualSummary = (() => {
    const pva = dashboardData?.plannedVsActual || {}
    const months = chartData?.studiesByMonth || []
    const plannedFromApi = Number(pva.totalPlannedPatients ?? pva.plannedPatients ?? NaN)
    const enrolledFromApi = Number(
      pva.totalEnrolledPatients ??
        pva.enrolledPatients ??
        dashboardData?.studyInfo?.enrolledPatients ??
        NaN,
    )
    const plannedFromSites = craSitePatientRows.reduce(
      (sum, site) => sum + (Number(site?.plannedPatients) || 0),
      0,
    )
    const enrolledFromSites = craSitePatientRows.reduce(
      (sum, site) => sum + (Number(site?.enrolledPatients) || 0),
      0,
    )
    const planned =
      Number.isFinite(plannedFromApi) && plannedFromApi >= 0
        ? plannedFromApi
        : plannedFromSites > 0
          ? plannedFromSites
          : months.reduce((max, row) => Math.max(max, Number(row.planned) || 0), 0)
    const enrolled =
      Number.isFinite(enrolledFromApi) && enrolledFromApi >= 0
        ? enrolledFromApi
        : enrolledFromSites > 0
          ? enrolledFromSites
          : Number(statistics.patientCount ?? summaryCounts.patientCount ?? 0) ||
            months.reduce((sum, row) => sum + (Number(row.actual) || 0), 0)
    const completedFromApi = Number(
      pva.totalCompletedPatients ?? pva.completedPatients ?? NaN,
    )
    const completedFromSites = craSitePatientRows.reduce(
      (sum, site) => sum + (Number(site?.completedPatients) || 0),
      0,
    )
    const completed =
      Number.isFinite(completedFromApi) && completedFromApi >= 0
        ? completedFromApi
        : completedFromSites > 0
          ? completedFromSites
          : months.reduce((sum, row) => sum + (Number(row.completed) || 0), 0)
    return { planned, enrolled, completed }
  })()

  const craPatientStatusSummary = (() => {
    const rows = totalSubjectsSites
    const pending = rows.reduce(
      (sum, site) => sum + (Number(site?.pendingPatients) || 0),
      0,
    )
    const screened = rows.reduce(
      (sum, site) =>
        sum +
        (Number(site?.screenedPatients ?? site?.ScreenedPatients ?? site?.pendingPatients) || 0),
      0,
    )
    const screenFailed = rows.reduce(
      (sum, site) => sum + (Number(site?.screenFailedPatients ?? site?.ScreenFailedPatients) || 0),
      0,
    )
    const discontinued = rows.reduce(
      (sum, site) =>
        sum + (Number(site?.discontinuedPatients ?? site?.DiscontinuedPatients) || 0),
      0,
    )
    const enrolledInStatus = rows.reduce(
      (sum, site) =>
        sum +
        (Number(
          site?.enrolledInStatusPatients ??
            site?.EnrolledInStatusPatients ??
            site?.enrolledPatients,
        ) || 0),
      0,
    )
    const completedFromSites = rows.reduce(
      (sum, site) => sum + (Number(site?.completedPatients) || 0),
      0,
    )
    return {
      planned: plannedVsActualSummary.planned,
      enrolled: enrolledInStatus > 0 ? enrolledInStatus : plannedVsActualSummary.enrolled,
      pending,
      completed:
        preferredSiteId
          ? completedFromSites
          : plannedVsActualSummary.completed,
      screened,
      screenFailed,
      discontinued,
    }
  })()

  const handleTotalSubjectsDownload = async ({
    format,
    pageSize,
    orientation,
    asAttachment = false,
  }) => {
    setTotalSubjectsDownloading(true)
    try {
      let result
      if (format === "csv") {
        result = exportTotalSubjectsCsv(totalSubjectsSites, "total-subjects", { asAttachment })
        if (!asAttachment) toast.success("Total Subjects CSV downloaded")
      } else if (format === "html") {
        result = exportTotalSubjectsHtml(totalSubjectsSites, "total-subjects", { asAttachment })
        if (!asAttachment) toast.success("Total Subjects HTML downloaded")
      } else if (format === "excel") {
        result = await exportTotalSubjectsExcel(totalSubjectsSites, "total-subjects", {
          asAttachment,
        })
        if (!asAttachment) toast.success("Total Subjects Excel downloaded")
      } else if (format === "pdf") {
        result = await exportTotalSubjectsPdf(totalSubjectsSites, {
          pageSize,
          orientation,
          asAttachment,
        })
        if (!asAttachment) toast.success("Total Subjects PDF downloaded")
      } else {
        toast.message("Format coming soon")
        return undefined
      }
      if (!asAttachment) setTotalSubjectsDownloadOpen(false)
      return result
    } finally {
      setTotalSubjectsDownloading(false)
    }
  }

  const totalSubjectsDownloadAction = (
    <button
      type="button"
      onClick={() => setTotalSubjectsDownloadOpen(true)}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-900"
    >
      <Download className="h-3.5 w-3.5" aria-hidden />
      Download
    </button>
  )

  const assignedStudyCount =
    Array.isArray(assignedStudies) && assignedStudies.length > 0
      ? assignedStudies.length
      : summaryCounts.studyCount

  const assignedSiteCount = (() => {
    if (!Array.isArray(assignedStudies) || assignedStudies.length === 0) {
      return summaryCounts.siteCount
    }
    const seen = new Set()
    let count = 0
    for (const study of assignedStudies) {
      const sites = Array.isArray(study?.sites)
        ? study.sites
        : Array.isArray(study?.Sites)
          ? study.Sites
          : []
      for (const site of sites) {
        const id = site?.siteId ?? site?.SiteId ?? site?.id
        const parsed = Number.parseInt(String(id ?? ""), 10)
        if (Number.isFinite(parsed) && parsed > 0 && !seen.has(parsed)) {
          seen.add(parsed)
          count += 1
        }
      }
    }
    return count > 0 ? count : summaryCounts.siteCount
  })()

  const craQueryTotal =
    Number(queryStatusCounts?.totalQueries ?? 0) ||
    Number(queryStatusCounts?.open ?? 0) +
      Number(queryStatusCounts?.inProcess ?? 0) +
      Number(queryStatusCounts?.closed ?? 0)
  const showCraQueryPanel = craQueryTotal > 0
  const showCrcQueryPanel = isCrcOnly && shouldShowQueryManagement && showCraQueryPanel
  /** Full-width patient status (MM no queries / Sponsor) — show more sites per page */
  const patientStatusSitesPerPage =
    showSponsorPatientStatusFull ||
    (showCrcDashboardInsights && !showCrcQueryPanel) ||
    (showCraDashboardInsights && !showCraQueryPanel)
      ? 5
      : 3

  // Count animations - only play once per session
  const animatedStudyCount = useCountAnimation(summaryCounts.studyCount, 2000, "dashboard_study_count")
  const animatedSiteCount = useCountAnimation(summaryCounts.siteCount, 2000, "dashboard_site_count")
  const animatedAssignedStudyCount = useCountAnimation(
    assignedStudyCount,
    2000,
    "dashboard_assigned_study_count",
  )
  const animatedAssignedSiteCount = useCountAnimation(
    assignedSiteCount,
    2000,
    "dashboard_assigned_site_count",
  )
  const animatedAgreementCount = useCountAnimation(summaryCounts.agreementCount, 2000, "dashboard_agreement_count")
  const animatedVisitCount = useCountAnimation(summaryCounts.visitCount, 2000, "dashboard_visit_count")
  const animatedEcrfCount = useCountAnimation(summaryCounts.ecrfCount, 2000, "dashboard_ecrf_count")
  const animatedPatientCount = useCountAnimation(summaryCounts.patientCount, 2000, "dashboard_patient_count")
  const animatedUserCount = useCountAnimation(userTotal, 2000, "dashboard_user_count")

  const studyTitle =
    studyInfo?.studyName ||
    studyInfo?.protocolNumber ||
    studyInfo?.name ||
    null
  const roleLabel = user?.roleName || user?.roleCode || null

  const dashboardStudySiteInfo = useMemo(
    () =>
      resolveDashboardStudySiteInfo({
        dashboardData,
        assignedStudies,
        studyId: activeStudyId,
        siteId: preferredSiteId,
      }),
    [dashboardData, assignedStudies, activeStudyId, preferredSiteId],
  )

  const showStudySiteInfoPanel = Boolean(activeStudyId) && dashboardStudySiteInfo.hasContent

  const enableMetricLens = !isCrcOnly

  const kpiMetrics = isCrcOnly
    ? [
        { key: "study", label: "Assigned Studies", value: animatedAssignedStudyCount },
        { key: "sites", label: "Assigned Sites", value: animatedAssignedSiteCount },
        { key: "patients", label: "Enrolled Patients", value: animatedPatientCount },
        { key: "visit", label: "Visits", value: animatedVisitCount },
        { key: "ecrf", label: "eCRF Designs", value: animatedEcrfCount },
        ...(piSignoffEnabledOnStudy
          ? [{ key: "piPending", label: "PI Pending CRFs", value: piPendingCrfs }]
          : []),
      ]
    : [
        { key: "study", label: "Studies", value: animatedStudyCount },
        { key: "sites", label: "Sites", value: animatedSiteCount },
        ...(showAgreementKpi
          ? [{ key: "agreement", label: "Agreements", value: animatedAgreementCount }]
          : []),
        { key: "visit", label: "Visits", value: animatedVisitCount },
        ...(showTotalUsersKpi
          ? [{ key: "users", label: "Users", value: animatedUserCount }]
          : []),
        { key: "ecrf", label: "eCRF Designs", value: animatedEcrfCount },
        { key: "patients", label: "Enrolled Patients", value: animatedPatientCount },
        ...(piSignoffEnabledOnStudy
          ? [{ key: "piPending", label: "PI Pending CRFs", value: piPendingCrfs }]
          : []),
        { key: "active", label: "Active Studies", value: summaryCounts.activeStudies },
      ]

  const metricLensContext = useMemo(
    () => ({
      assignedStudies,
      dashboardData,
      chartData,
      summaryCounts: { ...summaryCounts, userTotal },
    }),
    [assignedStudies, dashboardData, chartData, summaryCounts, userTotal]
  )

  const isDashboardAdmin = isDashboardAdminUser(user)
  const isDashboardSuperAdmin = isDashboardSuperAdminUser(user)

  const formatDate = (dateString) => {
    if (!dateString) return "N/A"
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return "N/A"
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()
      return `${day}-${month}-${year}`
    } catch {
      return "N/A"
    }
  }

  const handleDownloadResource = async (documentId) => {
    const studyId = getSelectedStudyId()
    if (!studyId || !documentId) {
      setDownloadDocError("Please select a study first.")
      return
    }
    setDownloadDropdownOpen(false)
    setDownloadDocError(null)
    setDownloadDocLoading(true)
    try {
      const result = await studyDocumentService.downloadAccessibleDocument(studyId, documentId)
      if (!result.isSuccess) {
        setDownloadDocError(result.message || "Download failed.")
      }
    } finally {
      setDownloadDocLoading(false)
    }
  }

  const handleOpenDemoVideo = () => {
    const url = documentResources?.demoVideoUrl ?? documentResources?.DemoVideoUrl
    if (!url) return
    setDownloadDropdownOpen(false)
    window.open(url, "_blank", "noopener,noreferrer")
  }

  // Legacy fallback when resources API unavailable
  const handleDownloadDocument = async (documentType) => {
    const studyId = getSelectedStudyId()
    if (!studyId) {
      setDownloadDocError("Please select a study first.")
      return
    }
    setDownloadDropdownOpen(false)
    setDownloadDocError(null)
    setDownloadDocLoading(true)
    try {
      const result = await studyService.downloadDocument(studyId, documentType)
      if (!result.isSuccess) {
        setDownloadDocError(result.message || "Download failed.")
      }
    } finally {
      setDownloadDocLoading(false)
    }
  }

  // Agreement row is separate from studyDocShowRoleGuids — requires "Agreement enabled" in Study Settings.
  const showAgreementInDocuments = (() => {
    const selectedStudyId = getSelectedStudyId()
    if (!selectedStudyId) return false

    if (studySettingsCtx?.studyId === selectedStudyId) {
      if (studySettingsCtx.isAgreementEnabled === true) return true
      if (studySettingsCtx.isAgreementEnabled === false) return false
    }

    if (agreementGateStudyId === selectedStudyId) {
      if (isAgreementEnabled === true) return true
      if (isAgreementEnabled === false) return false
    }

    if (pickIsAgreementEnabledFromStudiesList(selectedStudyId) === true) return true

    const settingsData = getCachedStudySettings(selectedStudyId)?.data ?? null
    return resolveIsAgreementEnabled(selectedStudyId, settingsData) === true
  })()

  const handleDownloadAgreement = async () => {
    const studyId = getSelectedStudyId()
    if (!studyId) {
      setDownloadDocError("Please select a study first.")
      return
    }
    if (!showAgreementInDocuments) {
      setDownloadDocError("Agreement is disabled for the selected study in Study Settings.")
      return
    }
    const isSigned = pickIsAgreementSignedFromStudiesList(studyId)
    if (isSigned === false) {
      setDownloadDropdownOpen(false)
      setDownloadDocError(
        "Agreement is not signed yet. Please complete the agreement popup after login, then download again.",
      )
      return
    }
    setDownloadDropdownOpen(false)
    setDownloadDocError(null)
    setDownloadDocLoading(true)
    try {
      const result = await userAgreementService.downloadAgreementPdf(studyId)
      if (!result.isSuccess) {
        setDownloadDocError(result.message || "Agreement download failed.")
      }
    } finally {
      setDownloadDocLoading(false)
    }
  }

  // Position dropdown from button and close on click outside or scroll (dropdown is portaled to body)
  useEffect(() => {
    if (!downloadDropdownOpen) {
      setDownloadDropdownPosition(null)
      return
    }
    const updatePosition = () => {
      if (downloadButtonRef.current) {
        const rect = downloadButtonRef.current.getBoundingClientRect()
        setDownloadDropdownPosition({
          top: rect.bottom + 4,
          left: Math.max(8, rect.right - 200),
        })
      }
    }
    updatePosition()
    const handleClickOutside = (e) => {
      const isOnButtonOrProfile = downloadDropdownRef.current?.contains(e.target)
      const isOnPortaledDropdown = e.target.closest?.("[data-download-dropdown]")
      if (!isOnButtonOrProfile && !isOnPortaledDropdown) {
        setDownloadDropdownOpen(false)
      }
    }
    const handleScroll = () => setDownloadDropdownOpen(false)
    document.addEventListener("click", handleClickOutside)
    window.addEventListener("scroll", handleScroll, true)
    window.addEventListener("resize", updatePosition)
    return () => {
      document.removeEventListener("click", handleClickOutside)
      window.removeEventListener("scroll", handleScroll, true)
      window.removeEventListener("resize", updatePosition)
    }
  }, [downloadDropdownOpen])

  const showLoadingShell = loading && dashboardData == null

  return (
    <DashboardLayout>
      {showLoadingShell ? (
        showSkeleton ? (
          <DashboardPageSkeleton />
        ) : (
          <div className="min-h-[calc(100dvh-5.25rem)]" aria-hidden="true" />
        )
      ) : (
      <div
        className={
          showCraDashboardInsights
            ? "flex min-h-[calc(100dvh-5.25rem)] flex-col gap-4"
            : DASHBOARD_SHELL_CLASS
        }
      >
        <div ref={downloadDropdownRef} className="shrink-0">
          <DashboardCommandHero
            displayName={displayName}
            roleName={roleLabel}
            studyTitle={showStudySiteInfoPanel ? null : studyTitle}
            studySiteInfo={
              showStudySiteInfoPanel ? (
                <DashboardStudySiteInfoCard info={dashboardStudySiteInfo} embedded />
              ) : null
            }
            profileImageUrl={profileImageUrl}
            canShowDocuments={canShowDocuments}
            downloadDocLoading={downloadDocLoading}
            downloadDropdownOpen={downloadDropdownOpen}
            setDownloadDropdownOpen={setDownloadDropdownOpen}
            downloadButtonRef={downloadButtonRef}
            downloadDropdownPosition={downloadDropdownPosition}
            getSelectedStudyId={getSelectedStudyId}
            onDownloadDocument={handleDownloadDocument}
            onDownloadResource={handleDownloadResource}
            onOpenDemoVideo={handleOpenDemoVideo}
            documentResources={documentResources}
            loadingDocumentResources={loadingDocumentResources}
            onDownloadAgreement={handleDownloadAgreement}
            showAgreementInDocuments={showAgreementInDocuments}
          >
            <DashboardMetricStrip
              metrics={kpiMetrics}
              interactive={enableMetricLens}
              activeLensKey={enableMetricLens ? activeMetricLens : null}
              onMetricClick={enableMetricLens ? (key) => setActiveMetricLens(key) : undefined}
            />
          </DashboardCommandHero>
        </div>

        {enableMetricLens ? (
          <DashboardMetricLensPortal
            open={Boolean(activeMetricLens)}
            lensKey={activeMetricLens}
            onClose={() => setActiveMetricLens(null)}
            context={metricLensContext}
            isAdmin={isDashboardAdmin}
            isSuperAdmin={isDashboardSuperAdmin}
          />
        ) : null}

        {canShowDocuments && downloadDocError && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2">
            <p className="text-sm text-red-700">{downloadDocError}</p>
            <button
              type="button"
              onClick={() => setDownloadDocError(null)}
              className="rounded p-1 text-red-500 hover:text-red-700"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="space-y-6">
        {showCrcDashboardInsights && (
          <div className="space-y-6">
            <div className={DASHBOARD_CRC_ENROLLMENT_GRID_CLASS}>
              <DashboardChartSection
                title="Planned vs Actual"
                icon={Calendar}
                fill
                className={cn("xl:col-span-7", DASHBOARD_CRC_PAIR_CHART_CLASS)}
                badges={
                  <>
                    <DashboardChartBadge label="Planned" value={plannedVsActualSummary.planned} tone="sky" />
                    <DashboardChartBadge label="Actual" value={plannedVsActualSummary.enrolled} tone="violet" />
                    <DashboardChartBadge label="Completed" value={plannedVsActualSummary.completed} tone="violet" />
                  </>
                }
                bodyClassName="flex min-h-0 flex-1 flex-col p-4 sm:p-5"
              >
                <StudyCountsBarChart data={chartData} size="fill" />
              </DashboardChartSection>

              <DashboardChartSection
                title="Total Subjects"
                icon={UserCheck}
                fill
                className={cn(
                  "xl:col-span-5",
                  "flex min-h-[clamp(420px,52vh,640px)] flex-col",
                )}
                badges={
                  <>
                    <DashboardChartBadge label="Enrolled" value={craPatientStatusSummary.enrolled} tone="violet" />
                    <DashboardChartBadge label="Screened" value={craPatientStatusSummary.screened} tone="sky" />
                    <DashboardChartBadge label="Completed" value={craPatientStatusSummary.completed} tone="violet" />
                  </>
                }
                actions={totalSubjectsDownloadAction}
                bodyClassName="flex min-h-0 flex-1 flex-col p-4 sm:p-5"
              >
                <SitePatientEnrollmentBarChart
                  sites={totalSubjectsSites}
                  size="fill"
                  sitesPerPage={patientStatusSitesPerPage}
                  preferredSiteId={totalSubjectsChartSiteId}
                  variant="totalSubjects"
                />
              </DashboardChartSection>
            </div>

            {(showCrcQueryPanel || showCrcVisitChart) && (
              <div
                className={cn(
                  "grid grid-cols-1 gap-5 lg:gap-6",
                  showCrcQueryPanel && showCrcVisitChart && "lg:grid-cols-2",
                )}
              >
                {showCrcQueryPanel && (
                  <DashboardChartSection
                    title="Query Management"
                    icon={Search}
                    fill
                    className={DASHBOARD_CRC_PAIR_CHART_CLASS}
                    badges={<DashboardChartBadge label="Total" value={craQueryTotal} tone="amber" />}
                    bodyClassName="flex min-h-0 flex-1 flex-col p-4 sm:p-5"
                  >
                    <QueryManagementPieChart
                      counts={queryStatusCounts}
                      systemCounts={systemQueryStatusCounts}
                      size="fill"
                    />
                  </DashboardChartSection>
                )}

                {showCrcVisitChart && (
                  <DashboardChartSection
                    title="Visit"
                    icon={Calendar}
                    fill
                    className={DASHBOARD_CRC_PAIR_CHART_CLASS}
                    badges={<DashboardChartBadge label="Visit" value={visitTotal} tone="violet" />}
                    bodyClassName="flex min-h-0 flex-1 flex-col p-4 sm:p-5"
                  >
                    <ScreeningBaselineVisitChart data={chartData} />
                  </DashboardChartSection>
                )}
              </div>
            )}
          </div>
        )}

        {showCraDashboardInsights && (
          <div className={DASHBOARD_CRA_GRID_CLASS}>
            {showCraQueryPanel && (
              <DashboardChartSection
                title="Query Management"
                icon={Search}
                fill
                className="min-h-[clamp(300px,42vh,520px)]"
                badges={<DashboardChartBadge label="Total" value={craQueryTotal} tone="amber" />}
                bodyClassName="flex min-h-0 flex-1 flex-col p-4"
              >
                <QueryManagementPieChart
                  counts={queryStatusCounts}
                  systemCounts={systemQueryStatusCounts}
                  size="fill"
                />
              </DashboardChartSection>
            )}

            <DashboardChartSection
              title="Total Subjects"
              icon={UserCheck}
              fill
              className="min-h-[clamp(480px,62vh,780px)]"
              badges={
                <>
                  <DashboardChartBadge label="Enrolled" value={craPatientStatusSummary.enrolled} tone="violet" />
                  <DashboardChartBadge label="Screened" value={craPatientStatusSummary.screened} tone="sky" />
                  <DashboardChartBadge label="Completed" value={craPatientStatusSummary.completed} tone="violet" />
                </>
              }
              actions={totalSubjectsDownloadAction}
              bodyClassName="flex min-h-0 flex-1 flex-col p-4"
            >
              <SitePatientEnrollmentBarChart
                sites={totalSubjectsSites}
                size="fill"
                sitesPerPage={patientStatusSitesPerPage}
                preferredSiteId={totalSubjectsChartSiteId}
                variant="totalSubjects"
              />
            </DashboardChartSection>
          </div>
        )}

        {isAiInsightEnabled && headerStudyId ? (
          <AiMonitoringSummaryCard
            studyId={headerStudyId}
            siteId={
              typeof window !== "undefined"
                ? parseInt(localStorage.getItem("selectedSiteId") || "", 10) || undefined
                : undefined
            }
            enabled={isAiInsightEnabled}
            className="mb-4"
          />
        ) : null}

        {showSponsorPatientStatusFull && (
          <DashboardChartSection
            title="Total Subjects"
            icon={UserCheck}
            fill
            className="min-h-[clamp(520px,68vh,880px)]"
            badges={
              <>
                <DashboardChartBadge label="Enrolled" value={craPatientStatusSummary.enrolled} tone="violet" />
                <DashboardChartBadge label="Screened" value={craPatientStatusSummary.screened} tone="sky" />
                <DashboardChartBadge label="Completed" value={craPatientStatusSummary.completed} tone="violet" />
              </>
            }
            actions={totalSubjectsDownloadAction}
            bodyClassName="flex min-h-0 flex-1 flex-col p-4"
          >
            <SitePatientEnrollmentBarChart
              sites={totalSubjectsSites}
              size="fill"
              sitesPerPage={patientStatusSitesPerPage}
              preferredSiteId={totalSubjectsChartSiteId}
              variant="totalSubjects"
            />
          </DashboardChartSection>
        )}

        {showAdminTotalSubjects && (
          <div className="space-y-6">
            <div className={DASHBOARD_STUDIO_HERO_CLASS}>
              <DashboardChartSection
                title="Total Subjects"
                icon={UserCheck}
                fill
                variant="panel"
                className={DASHBOARD_STUDIO_HERO_MAIN_CLASS}
                badges={
                  <>
                    <DashboardChartBadge label="Enrolled" value={craPatientStatusSummary.enrolled} tone="violet" />
                    <DashboardChartBadge label="Screened" value={craPatientStatusSummary.screened} tone="sky" />
                    <DashboardChartBadge label="Completed" value={craPatientStatusSummary.completed} tone="violet" />
                  </>
                }
                actions={totalSubjectsDownloadAction}
                bodyClassName="flex min-h-0 flex-1 flex-col"
              >
                <SitePatientEnrollmentBarChart
                  sites={totalSubjectsSites}
                  size="fill"
                  sitesPerPage={5}
                  preferredSiteId={totalSubjectsChartSiteId}
                  variant="totalSubjects"
                />
              </DashboardChartSection>

              <DashboardChartSection
                title="CRF Data Entry"
                icon={FileText}
                fill
                variant="panel"
                className={DASHBOARD_STUDIO_HERO_SIDE_CLASS}
                bodyClassName="flex min-h-0 flex-1 flex-col"
              >
                <CRFDataEntryChart data={chartData} />
              </DashboardChartSection>
            </div>

            <div className={DASHBOARD_STUDIO_BODY_CLASS}>
              <div className={DASHBOARD_STUDIO_STACK_CLASS}>
                <div className={DASHBOARD_STUDIO_GROUP_CLASS}>
                  <DashboardChartSection
                    title="Visit"
                    icon={Calendar}
                    variant="embedded"
                    badges={<DashboardChartBadge label="Visit" value={visitTotal} tone="violet" />}
                  >
                    <ScreeningBaselineVisitChart data={chartData} />
                  </DashboardChartSection>
                  <div className={DASHBOARD_STUDIO_GROUP_DIVIDER_CLASS} aria-hidden />
                  <DashboardChartSection title="Study Open/Close" icon={ClipboardCheck} variant="embedded">
                    <StudyOpenCloseChart data={chartData} />
                  </DashboardChartSection>
                  <div className={DASHBOARD_STUDIO_GROUP_DIVIDER_CLASS} aria-hidden />
                  <DashboardChartSection title="Reports Exported" icon={Download} variant="embedded">
                    <ReportsExportedChart data={chartData} />
                  </DashboardChartSection>
                </div>
              </div>

              <div className={DASHBOARD_STUDIO_RAIL_CLASS}>
                <DashboardChartSection title="Users by Role" icon={Users} variant="rail">
                  <UserCountsPieChart data={chartData} />
                </DashboardChartSection>
                <DashboardChartSection title="Study Status" icon={ClipboardCheck} variant="rail">
                  <StudyCountsPieChart data={chartData} />
                </DashboardChartSection>
                {!isHeroPlannedVsActualLayout && (
                  <DashboardChartSection title="Planned vs Actual" icon={Calendar} variant="rail">
                    <StudyCountsBarChart data={chartData} />
                  </DashboardChartSection>
                )}
                {shouldShowQueryManagement && (
                  <DashboardChartSection title="Query Management" icon={Search} variant="rail">
                    <QueryManagementPieChart
                      counts={queryStatusCounts}
                      systemCounts={systemQueryStatusCounts}
                    />
                  </DashboardChartSection>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Non-admin chart rows (CRC/CRA/sponsor/endoscopist paths keep prior composition) */}
        {!showAdminTotalSubjects && !hideAllChartsExceptPlannedVsActual && !isCra && !isCrcOnly && (
          <div className={DASHBOARD_BENTO_CLASS}>
            <DashboardChartSection
              title="Visit"
              icon={Calendar}
              className={isCrcOnly ? "lg:col-span-12" : "lg:col-span-6"}
              badges={<DashboardChartBadge label="Visit" value={visitTotal} tone="violet" />}
            >
              <ScreeningBaselineVisitChart data={chartData} />
            </DashboardChartSection>
            {!isCrcOnly && (
              <DashboardChartSection title="Study Open/Close" icon={ClipboardCheck} className="lg:col-span-6">
                <StudyOpenCloseChart data={chartData} />
              </DashboardChartSection>
            )}
          </div>
        )}

        {!showAdminTotalSubjects && !hideAllChartsExceptPlannedVsActual && !isCrcSiteRole && (
          <div className={DASHBOARD_BENTO_CLASS}>
            <DashboardChartSection title="Reports Exported" icon={Download} className="lg:col-span-6">
              <ReportsExportedChart data={chartData} />
            </DashboardChartSection>
            <DashboardChartSection title="CRF Data Entry" icon={FileText} className="lg:col-span-6">
              <CRFDataEntryChart data={chartData} />
            </DashboardChartSection>
          </div>
        )}

        {!showAdminTotalSubjects && showThirdChartRow && (
          <div className={DASHBOARD_BENTO_CLASS}>
            {!hideAllChartsExceptPlannedVsActual && !isCrcSiteRole && (
              <DashboardChartSection title="Users by Role" icon={Users} className="lg:col-span-4">
                <UserCountsPieChart data={chartData} />
              </DashboardChartSection>
            )}

            {!hideAllChartsExceptPlannedVsActual && !isCrcSiteRole && (
              <DashboardChartSection title="Study Status" icon={ClipboardCheck} className="lg:col-span-4">
                <StudyCountsPieChart data={chartData} />
              </DashboardChartSection>
            )}

            {!isHeroPlannedVsActualLayout && (
              <DashboardChartSection
                title="Planned vs Actual"
                icon={Calendar}
                className={
                  hideAllChartsExceptPlannedVsActual
                    ? shouldShowQueryManagement
                      ? "lg:col-span-6"
                      : "lg:col-span-12"
                    : "lg:col-span-4"
                }
                badges={
                  hideAllChartsExceptPlannedVsActual && multiCrfRoleProgress ? (
                    <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-700">
                      Live
                    </span>
                  ) : null
                }
              >
                {hideAllChartsExceptPlannedVsActual && multiCrfRoleProgress ? (
                  <div className="space-y-3.5">
                    <MultiCrfRoleProgressBarChart
                      planned={totalPlannedPatients}
                      enrolled={totalEnrolledPatients}
                      endoscopist={endoSubmitted}
                      pathologist={pathoSubmitted}
                    />
                    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                      <div className="rounded-xl border border-sky-200/80 bg-sky-50/85 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-600">Planned</p>
                        <p className="mt-0.5 text-sm font-semibold text-sky-900">{totalPlannedPatients}</p>
                      </div>
                      <div className="rounded-xl border border-violet-200/80 bg-violet-50/85 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-600">Enrolled</p>
                        <p className="mt-0.5 text-sm font-semibold text-violet-900">{totalEnrolledPatients}</p>
                      </div>
                      <div className="rounded-xl border border-teal-200/80 bg-teal-50/85 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-600">Endoscopist</p>
                        <p className="mt-0.5 text-sm font-semibold text-teal-900">{endoSubmitted}</p>
                      </div>
                      <div className="rounded-xl border border-rose-200/80 bg-rose-50/85 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-600">Pathologist</p>
                        <p className="mt-0.5 text-sm font-semibold text-rose-900">{pathoSubmitted}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <StudyCountsBarChart data={chartData} />
                )}
                {hideAllChartsExceptPlannedVsActual && multiCrfRoleProgressError && (
                  <p className="mt-3 text-xs text-red-600">{multiCrfRoleProgressError}</p>
                )}
              </DashboardChartSection>
            )}

            {shouldShowQueryManagement && (
              <DashboardChartSection
                title="Query Management"
                icon={Search}
                className={
                  hideAllChartsExceptPlannedVsActual ? "lg:col-span-6" : "lg:col-span-4"
                }
              >
                <QueryManagementPieChart counts={queryStatusCounts} systemCounts={systemQueryStatusCounts} />
              </DashboardChartSection>
            )}
          </div>
        )}
        </div>

      </div>
      )}

      <ReportDownloadDialog
        open={totalSubjectsDownloadOpen}
        onOpenChange={setTotalSubjectsDownloadOpen}
        title="Download"
        defaultSubject="Total Subjects"
        defaultFormat="pdf"
        downloading={totalSubjectsDownloading}
        onDownload={handleTotalSubjectsDownload}
      />
    </DashboardLayout>
  )
}
