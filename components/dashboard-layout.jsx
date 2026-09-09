"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { authService, studyService } from "@/lib/services"
import { StudyFilter } from "@/lib/api/config"
import {
  getCrcAgreementStatusFromCache,
  isCrcUser,
  markAgreementSignedForStudy,
  resolveCrcAgreementStatus,
} from "@/lib/utils/crcAgreementFlow"
import {
  ensureAccessibleStudiesList,
  invalidateAccessibleStudiesCache,
} from "@/lib/utils/studySettingsRead"
import {
  autoSelectSingleAssignedStudy,
  readStudySiteFromStorage,
} from "@/lib/utils/studySiteContext"
import { StudySettingsProvider } from "@/context/StudySettingsContext"
import StudyPermissionFeedback from "@/components/study-permission-feedback"
import Sidebar from "./sidebar"
import TopHeader from "./top-header"
import UserAgreementModal from "./user-agreement-modal"
import { APP_MAIN_CLASS, APP_PAGE_WRAP_CLASS } from "@/lib/ui/appShellClasses"
import { useMobileShell } from "@/lib/ui/useMobileShell"

function getSidebarWidthVar(isCollapsed) {
  return isCollapsed
    ? "var(--sidebar-width-collapsed, 4.875rem)"
    : "var(--sidebar-width, 17rem)"
}

function DashboardLayoutInner({ children, studyNumber, userName, roleName, userRole, hideChrome = false }) {
  const router = useRouter()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [user, setUser] = useState(null)
  const [isMounted, setIsMounted] = useState(false)
  const [showAgreementModal, setShowAgreementModal] = useState(false)
  const [selectedStudyId, setSelectedStudyId] = useState(null)
  const [agreementSigned, setAgreementSigned] = useState(false)
  const [layoutTransitionsEnabled, setLayoutTransitionsEnabled] = useState(false)
  const handleSidebarCollapseToggle = useCallback(() => {
    setLayoutTransitionsEnabled(true)
    setIsCollapsed((prev) => !prev)
  }, [])
  const [agreementData, setAgreementData] = useState(null) // Store agreement data to pass to modal
  const [agreementRequiredForStudy, setAgreementRequiredForStudy] = useState(false)
  // Initialize studies list from localStorage if available
  const initializeStudiesList = () => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("studiesList")
      const cachedTime = localStorage.getItem("studiesListTime")
      if (cached && cachedTime) {
        const cacheAge = Date.now() - parseInt(cachedTime, 10)
        // Use cache if less than 5 minutes old
        if (cacheAge < 300000) {
          try {
            return JSON.parse(cached)
          } catch (e) {
            console.error("Error parsing cached studies list:", e)
          }
        }
      }
    }
    return []
  }

  const [studiesList, setStudiesList] = useState(initializeStudiesList) // Store studies list with isAgreementSigned flag
  const studiesListRef = useRef(studiesList) // Ref for stable access in callbacks without triggering effect deps
  const checkingRef = useRef(false) // Prevent duplicate calls
  const agreementCheckGenRef = useRef(0) // Ignore stale async agreement results
  const lastCheckedStudyIdRef = useRef(null) // Track last checked study ID
  const pendingCheckRef = useRef(null) // Track pending check timeout
  const fetchingStudiesRef = useRef(false) // Prevent duplicate fetchStudiesList calls
  const lastFetchTimeRef = useRef(typeof window !== "undefined" ? parseInt(localStorage.getItem("studiesListTime") || "0", 10) : 0) // Track last fetch time to prevent rapid calls
  const studiesLengthRef = useRef(studiesList?.length ?? 0) // Track length for fetchStudiesList skip logic without deps
  const isMountedRef = useRef(false)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      checkingRef.current = false
      lastCheckedStudyIdRef.current = null
      if (pendingCheckRef.current) {
        clearTimeout(pendingCheckRef.current)
        pendingCheckRef.current = null
      }
    }
  }, [])
  useEffect(() => {
    studiesListRef.current = studiesList
    studiesLengthRef.current = studiesList?.length ?? 0
  }, [studiesList])

  // Fetch studies list to get isAgreementSigned flag
  const fetchStudiesList = useCallback(async ({ force = false } = {}) => {
    // Prevent duplicate calls - if already fetching, return
    if (fetchingStudiesRef.current) {
      console.log("Already fetching studies list, skipping...")
      return
    }

    // Check if we already have data and it's recent (within last 30 seconds)
    const now = Date.now()
    if (!force && studiesLengthRef.current > 0 && (now - lastFetchTimeRef.current) < 30000) {
      console.log("Studies list already available, skipping fetch...")
      return
    }

    // Check localStorage first (never when force — agreement gate needs fresh API flags)
    if (!force && typeof window !== "undefined") {
      const cached = localStorage.getItem("studiesList")
      const cachedTime = localStorage.getItem("studiesListTime")
      if (cached && cachedTime) {
        const cacheAge = now - parseInt(cachedTime, 10)
        // Use cache if less than 30 seconds old
        if (cacheAge < 30000) {
          try {
            const cachedStudies = JSON.parse(cached)
            studiesLengthRef.current = cachedStudies?.length ?? 0
            if (isMountedRef.current) setStudiesList(cachedStudies)
            lastFetchTimeRef.current = now
            console.log("Using cached studies list")
            return
          } catch (e) {
            console.error("Error parsing cached studies list:", e)
          }
        }
      }
    }

    fetchingStudiesRef.current = true
    try {
      console.log("Fetching studies list...")
      const response = await studyService.getAccessibleStudiesWithSites(StudyFilter.Active)
      if (response && response.isSuccess && response.data) {
        const studies = Array.isArray(response.data) ? response.data : []
        studiesLengthRef.current = studies.length
        if (isMountedRef.current) setStudiesList(studies)
        lastFetchTimeRef.current = Date.now()
        // Store in localStorage for quick access
        if (typeof window !== "undefined") {
          localStorage.setItem("studiesList", JSON.stringify(studies))
          localStorage.setItem("studiesListTime", String(Date.now()))
        }
        console.log("Studies list fetched successfully")
      }
    } catch (error) {
      console.error("Error fetching studies list:", error)
      // Try to get from localStorage if API fails
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem("studiesList")
        if (cached) {
          try {
            const parsed = JSON.parse(cached)
            studiesLengthRef.current = parsed?.length ?? 0
            if (isMountedRef.current) setStudiesList(parsed)
          } catch (e) {
            console.error("Error parsing cached studies list:", e)
          }
        }
      }
    } finally {
      fetchingStudiesRef.current = false
    }
  }, [])

  const refreshStudiesForAgreement = useCallback(async () => {
    const studies = await ensureAccessibleStudiesList()
    studiesLengthRef.current = studies?.length ?? 0
    lastFetchTimeRef.current = Date.now()
    if (isMountedRef.current) setStudiesList(studies)
    return studies
  }, [])

  const applyAgreementCacheFastPath = useCallback((studyId) => {
    const cached = getCrcAgreementStatusFromCache(studyId)
    if (cached.showModal) {
      setAgreementRequiredForStudy(true)
      setAgreementSigned(false)
      setShowAgreementModal(true)
      return
    }
    if (!cached.isTentative) {
      setAgreementRequiredForStudy(cached.agreementRequired)
      setAgreementSigned(cached.agreementSigned)
      setShowAgreementModal(false)
      setAgreementData(null)
    }
  }, [])

  const checkAgreementStatus = useCallback(
    async (studyId) => {
      const stillMounted = () => isMountedRef.current

      if (!studyId) {
        if (!stillMounted()) return
        setAgreementRequiredForStudy(false)
        setAgreementSigned(true)
        setShowAgreementModal(false)
        setAgreementData(null)
        return
      }

      if (checkingRef.current && lastCheckedStudyIdRef.current === studyId) return

      applyAgreementCacheFastPath(studyId)

      checkingRef.current = true
      const checkGen = ++agreementCheckGenRef.current

      try {
        const status = await resolveCrcAgreementStatus(studyId, {
          refreshStudiesList: refreshStudiesForAgreement,
        })

        if (!stillMounted() || checkGen !== agreementCheckGenRef.current) return

        setAgreementRequiredForStudy(status.agreementRequired)
        setAgreementSigned(status.agreementSigned)
        setAgreementData(status.agreementData)
        setShowAgreementModal(status.showModal)
      } catch (error) {
        console.error("[dashboard-layout] agreement check failed", error)
        if (stillMounted() && checkGen === agreementCheckGenRef.current) {
          setAgreementRequiredForStudy(true)
          setAgreementSigned(false)
          setShowAgreementModal(true)
        }
      } finally {
        if (checkGen === agreementCheckGenRef.current) {
          checkingRef.current = false
          lastCheckedStudyIdRef.current = studyId
        }
      }
    },
    [applyAgreementCacheFastPath, refreshStudiesForAgreement],
  )

  // Any route wrapped in this layout requires a stored auth token (same as /dashboard).
  // Run once on mount only — `pathname` in deps caused extra redirects/re-renders with some clients.
  useEffect(() => {
    if (typeof window === "undefined") return
    if (authService.isAuthenticated()) return
    const path = window.location.pathname || "/dashboard"
    const search = window.location.search || ""
    const redirectTarget = encodeURIComponent(`${path}${search}`)
    router.replace(`/login?redirect=${redirectTarget}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  // Initial mount effect - fetch studies and check agreement
  useEffect(() => {
    if (typeof window !== "undefined" && !authService.isAuthenticated()) {
      return
    }

    let alive = true

    const userData = authService.getUser()

    if (userData?.isPasswordChangeRequired) {
      window.location.href = "/force-change-password"
      return
    }

    if (
      typeof window !== "undefined" &&
      authService.isAuthenticated() &&
      userData &&
      !authService.hasRequiredRoleAssignment(userData)
    ) {
      authService.logout().then(() => {
        window.location.replace("/login?reason=no-role")
      })
      return
    }

    if (!alive || !isMountedRef.current) return

    setUser(userData)
    setIsMounted(true)

    if (isCrcUser(userData, userRole)) {
      ;(async () => {
        let studyId = readStudySiteFromStorage().studyId

        if (!studyId) {
          studyId = await autoSelectSingleAssignedStudy(() =>
            studyService.getStudiesForDropdown(),
          )
        }

        if (studyId) {
          setSelectedStudyId(studyId)
          applyAgreementCacheFastPath(studyId)
          await checkAgreementStatus(studyId)
        }
      })()
    }

    return () => {
      alive = false
    }
  }, [fetchStudiesList, checkAgreementStatus, applyAgreementCacheFastPath, userRole])

  // Listen for study selection changes from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return

    const userData = authService.getUser()
    if (!isCrcUser(userData, userRole)) return

    const handleStorageChange = (e) => {
      // Handle cross-tab storage events
      if (e && e.key === "selectedStudyId") {
        const newStudyId = e.newValue ? parseInt(e.newValue, 10) : null
        if (newStudyId && newStudyId !== selectedStudyId) {
          // Clear any pending checks
          if (pendingCheckRef.current) {
            clearTimeout(pendingCheckRef.current)
            pendingCheckRef.current = null
          }
          setSelectedStudyId(newStudyId)
          lastCheckedStudyIdRef.current = null
          applyAgreementCacheFastPath(newStudyId)
          checkAgreementStatus(newStudyId)
        }
      }
    }

    // Custom event listener for same-tab changes with debounce
    const handleStudySelectionChange = (e) => {
      const newStudyId = Number.parseInt(String(e.detail?.studyId ?? ""), 10)
      if (!Number.isFinite(newStudyId) || newStudyId <= 0) return
      if (newStudyId === selectedStudyId && lastCheckedStudyIdRef.current === newStudyId) return

      if (pendingCheckRef.current) {
        clearTimeout(pendingCheckRef.current)
        pendingCheckRef.current = null
      }

      setSelectedStudyId(newStudyId)
      lastCheckedStudyIdRef.current = null
      applyAgreementCacheFastPath(newStudyId)

      // Coalesce studySelected + studySiteChanged into one check (next tick, no visible delay)
      pendingCheckRef.current = setTimeout(async () => {
        if (!isMountedRef.current) {
          pendingCheckRef.current = null
          return
        }
        await checkAgreementStatus(newStudyId)
        pendingCheckRef.current = null
      }, 0)
    }

    // Listen for storage events (cross-tab)
    window.addEventListener("storage", handleStorageChange)

    // Listen for custom event (same-tab)
    window.addEventListener("studySelected", handleStudySelectionChange)
    window.addEventListener("studySiteChanged", handleStudySelectionChange)

    // Remove interval - rely only on events
    // The interval was causing unnecessary checks

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener("studySelected", handleStudySelectionChange)
      window.removeEventListener("studySiteChanged", handleStudySelectionChange)
      if (pendingCheckRef.current) {
        clearTimeout(pendingCheckRef.current)
        pendingCheckRef.current = null
      }
    }
  }, [selectedStudyId, userRole, checkAgreementStatus, applyAgreementCacheFastPath, fetchStudiesList])

  // Re-check agreement when study settings change (e.g. agreement enabled) without re-login
  useEffect(() => {
    if (typeof window === "undefined") return
    const userData = authService.getUser()
    if (!isCrcUser(userData, userRole)) return

    const onStudySettingsUpdated = (e) => {
      const studyId = Number.parseInt(String(e?.detail?.studyId ?? ""), 10)
      if (!Number.isFinite(studyId) || studyId <= 0) return
      invalidateAccessibleStudiesCache()
      const activeId = selectedStudyId ?? Number.parseInt(localStorage.getItem("selectedStudyId") || "", 10)
      if (activeId === studyId) {
        lastCheckedStudyIdRef.current = null
        checkAgreementStatus(studyId)
      }
    }

    window.addEventListener("studySettingsUpdated", onStudySettingsUpdated)
    return () => window.removeEventListener("studySettingsUpdated", onStudySettingsUpdated)
  }, [selectedStudyId, userRole, checkAgreementStatus])

  // Refresh layout user when profile is updated (so sidebar/header and re-opened profile modal show latest data)
  useEffect(() => {
    if (typeof window === "undefined") return
    const handleProfileUpdated = () => {
      const freshUser = authService.getUser()
      if (freshUser) setUser(freshUser)
    }
    window.addEventListener("profileUpdated", handleProfileUpdated)
    return () => window.removeEventListener("profileUpdated", handleProfileUpdated)
  }, [])


  const handleAgreementSigned = (studyId) => {
    markAgreementSignedForStudy(studyId)
    setAgreementSigned(true)
    setShowAgreementModal(false)
    setAgreementRequiredForStudy(true)
  }

  // Title-case name for display (e.g. "yash" -> "Yash", "yash patil" -> "Yash Patil")
  const toDisplayName = (str) => {
    if (!str || typeof str !== "string") return ""
    return str.trim().split(/\s+/).map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ")
  }
  // Use props if provided, otherwise use user data from authService
  // Only use user data after component has mounted to prevent hydration mismatch
  // During SSR and initial client render, use empty strings to ensure consistency
  const rawUserName = userName || (isMounted && user ? (user?.firstName || user?.username || user?.loginName) : "")
  const displayUserName = toDisplayName(rawUserName) || rawUserName
  const displayRoleName = roleName || (isMounted && user ? (user?.roleName || "") : "")
  const displayUserRole = userRole || (isMounted && user ? (user?.roleName || "") : "")

  // Determine if user is CRC
  const isCRC = isCrcUser(user, displayUserRole || displayRoleName)

  const shouldBlockAccess =
    isCRC && selectedStudyId && agreementRequiredForStudy && !agreementSigned && !showAgreementModal

  const {
    isMobileViewport,
    mobileNavOpen,
    openMobileNav,
    closeMobileNav,
  } = useMobileShell()

  const mainOffsetClass = hideChrome
    ? ""
    : `pt-[4.5625rem] max-lg:ml-0 ${isCollapsed ? "lg:ml-[4.875rem]" : "lg:ml-[17rem]"}`
  const mainTransitionClass = layoutTransitionsEnabled ? "transition-[margin-left,width,max-width] duration-300" : "transition-none"
  const sidebarWidthVar = getSidebarWidthVar(isCollapsed)
  // Inline layout style as a non-async fallback for the Tailwind classes above.
  // Prevents a brief white gap between sidebar and content right after login,
  // which can otherwise occur in dev-mode if `ml-64` paints one frame before
  // sidebar `w-64`. Values are kept in sync with the className above so CSS
  // transitions still drive the collapse/expand animation.
  const mainInlineStyle = hideChrome
    ? undefined
    : isMobileViewport
      ? {
          marginLeft: 0,
          paddingTop: "var(--topbar-height, 4.5625rem)",
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          boxSizing: "border-box",
        }
      : {
          marginLeft: sidebarWidthVar,
          paddingTop: "var(--topbar-height, 4.5625rem)",
          width: `calc(100% - ${sidebarWidthVar})`,
          maxWidth: `calc(100% - ${sidebarWidthVar})`,
          minWidth: 0,
          boxSizing: "border-box",
        }

  return (
    <div className="min-h-[100dvh] min-w-0">
      {!hideChrome && (
        <>
          {mobileNavOpen ? (
            <button
              type="button"
              className="fixed inset-0 z-40 bg-slate-900/45 backdrop-blur-[1px] lg:hidden"
              onClick={closeMobileNav}
              aria-label="Close navigation menu"
            />
          ) : null}
          <Sidebar
            isCollapsed={isCollapsed}
            setIsCollapsed={handleSidebarCollapseToggle}
            userName={displayUserName}
            roleName={displayRoleName}
            enableLayoutTransitions={layoutTransitionsEnabled}
            isMobileViewport={isMobileViewport}
            mobileNavOpen={mobileNavOpen}
            onMobileNavClose={closeMobileNav}
          />
          <TopHeader
            studyNumber={studyNumber}
            userName={displayUserName}
            roleName={displayRoleName}
            userRole={displayUserRole}
            roleCode={user?.roleCode ?? user?.RoleCode}
            isCollapsed={isCollapsed}
            roleReady={isMounted && !!user}
            enableLayoutTransitions={layoutTransitionsEnabled}
            isMobileViewport={isMobileViewport}
            onOpenMobileNav={openMobileNav}
          />
        </>
      )}
      <main style={mainInlineStyle} className={`${mainOffsetClass} ${mainTransitionClass} ${APP_MAIN_CLASS} main-app-background`}>
        <div
          className={`${
            hideChrome ? "p-0" : `${APP_PAGE_WRAP_CLASS} p-3 sm:p-4 lg:p-6`
          } min-h-0 min-w-0 w-full overflow-x-hidden`}
        >
          {shouldBlockAccess ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg max-w-md">
                  <p className="text-amber-800 font-semibold">Agreement Required</p>
                  <p className="text-amber-700 mt-2">Please complete the agreement to access this page.</p>
                </div>
              </div>
            </div>
          ) : (
            children
          )}
        </div>
      </main>

      {/* Agreement Modal */}
      {showAgreementModal && selectedStudyId && (
        <UserAgreementModal
          studyId={selectedStudyId}
          onAgreementSigned={handleAgreementSigned}
          isOpen={showAgreementModal}
          initialAgreementData={agreementData} // Pass data to avoid duplicate fetch
        />
      )}
    </div>
  )
}

export default function DashboardLayout(props) {
  return (
    <StudySettingsProvider>
      <StudyPermissionFeedback />
      <DashboardLayoutInner {...props} />
    </StudySettingsProvider>
  )
}
