"use client"

import React, { useEffect, useRef } from "react"
import { useState } from "react"
import { usePathname } from "next/navigation"
import StudySiteSelector from "./study-site-selector"
import StudySiteContextBar from "./StudySiteContextBar"
import { dashboardService } from "@/lib/services"
import { X, Menu } from "lucide-react"
import { usesCompactStudySiteFilter } from "@/lib/utils/dashboardRoleLayout"
import { readStudySiteHeaderStateFromStorage } from "@/lib/utils/studySiteContext"
import { APP_HEADER_CLASS } from "@/lib/ui/appShellClasses"
import { cn } from "@/lib/utils"

export default function TopHeader({
  studyNumber,
  userName,
  roleName,
  userRole,
  roleCode,
  isCollapsed = false,
  roleReady = true,
  enableLayoutTransitions = false,
  isMobileViewport = false,
  onOpenMobileNav,
}) {
  const pathname = usePathname()
  const [showStudySiteSelector, setShowStudySiteSelector] = useState(false)
  const [initialTab, setInitialTab] = useState("study") // "study" or "site"
  const [currentStudy, setCurrentStudy] = useState(null)
  const [selectedSite, setSelectedSite] = useState(null)
  const [showStudyInfo, setShowStudyInfo] = useState(false)
  const [studyInfo, setStudyInfo] = useState(null)
  const [loadingStudyInfo, setLoadingStudyInfo] = useState(false)
  const dropdownRef = useRef(null)

  const isAdmin =
    roleReady &&
    usesCompactStudySiteFilter({ roleName, userRole, roleCode })

  // On eCRF data entry (manually), highlight filter when study or site not selected (all roles)
  const isOnEcrfManually = pathname?.includes("/ecrf-data-entry/manually") ?? false
  const needsStudyHighlight = isOnEcrfManually && !currentStudy
  const needsSiteHighlight = isOnEcrfManually && !selectedSite

  const macClearButtonClass =
    "relative flex h-10 w-10 items-center justify-center rounded-[11px] border border-[#E9EDF2] bg-white text-[#7C8A9B] transition-colors hover:border-[#DBE2E9] hover:bg-[#F8FAFB] hover:text-[#46566B]"

  const clearStudySiteSelection = () => {
    setCurrentStudy(null)
    setSelectedSite(null)
    if (typeof window !== "undefined") {
      localStorage.removeItem("selectedStudy")
      localStorage.removeItem("selectedStudyId")
      localStorage.removeItem("selectedStudyTitle")
      localStorage.removeItem("selectedSite")
      localStorage.removeItem("selectedSiteId")
      window.dispatchEvent(new CustomEvent("studySelected", {
        detail: { studyId: null }
      }))
      window.dispatchEvent(new CustomEvent("studySiteChanged", {
        detail: { studyId: null, siteId: null }
      }))
    }
  }

  // Restore study/site context from localStorage (all roles — needed for scoped dashboard API calls).
  useEffect(() => {
    if (typeof window === "undefined") return

    const syncFromStorage = () => {
      const { currentStudy: study, selectedSite: site } = readStudySiteHeaderStateFromStorage()
      setCurrentStudy(study)
      setSelectedSite(site)
    }

    syncFromStorage()

    window.addEventListener("studySelected", syncFromStorage)
    window.addEventListener("studySiteChanged", syncFromStorage)
  return () => {
      window.removeEventListener("studySelected", syncFromStorage)
      window.removeEventListener("studySiteChanged", syncFromStorage)
    }
  }, [])

  // Fetch study info when dropdown opens
  useEffect(() => {
    if (showStudyInfo && currentStudy?.studyId) {
      fetchStudyInfo(currentStudy.studyId)
    }
  }, [showStudyInfo, currentStudy?.studyId])

  // Close panel when clicking outside (optional - can be removed if you want it to stay open)
  // useEffect(() => {
  //   const handleClickOutside = (event) => {
  //     if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
  //       setShowStudyInfo(false)
  //     }
  //   }

  //   if (showStudyInfo) {
  //     document.addEventListener("mousedown", handleClickOutside)
  //     return () => document.removeEventListener("mousedown", handleClickOutside)
  //   }
  // }, [showStudyInfo])

  const fetchStudyInfo = async (studyId) => {
    try {
      setLoadingStudyInfo(true)
      const response = await dashboardService.getDashboard(studyId)
      if (response && response.isSuccess && response.data?.studyInfo) {
        setStudyInfo(response.data.studyInfo)
      }
    } catch (error) {
      console.error("Error fetching study info:", error)
    } finally {
      setLoadingStudyInfo(false)
    }
  }

  // Inline left mirrors `left-64/left-16` and prevents a brief gap right after
  // login if the Tailwind class hasn't been applied yet on the first paint.
  const topHeaderInlineStyle = isMobileViewport
    ? { left: 0 }
    : {
        left: isCollapsed ? "var(--sidebar-width-collapsed, 4.875rem)" : "var(--sidebar-width, 17rem)",
      }

  return (
    <div
      style={topHeaderInlineStyle}
      className={cn(
        "app-top-header-shell fixed top-0 right-0 z-40",
        isMobileViewport
          ? "left-0"
          : isCollapsed
            ? "left-[4.875rem]"
            : "left-[17rem]",
        enableLayoutTransitions ? "transition-[left] duration-300" : "transition-none"
      )}
    >
      {/* Main Header */}
      <header className={cn(APP_HEADER_CLASS, "justify-between gap-3 px-3 sm:px-6")}>
        <div className="flex min-w-0 items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={() => onOpenMobileNav?.()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] border border-[#E9EDF2] bg-white text-[#46566B] transition-colors hover:border-[#DBE2E9] hover:bg-[#F8FAFB]"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
        {/* Right Section - Study, Site Boxes, Search and Menu - show nothing until role is loaded */}
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-2.5">
          {roleReady && (
            <>
              <StudySiteContextBar
                study={currentStudy}
                site={selectedSite}
                isOpen={showStudySiteSelector}
                needsStudy={needsStudyHighlight}
                needsSite={needsSiteHighlight}
                className="min-w-0 max-w-full"
                onStudyClick={() => {
                  setInitialTab("study")
                  setShowStudySiteSelector(true)
                }}
                onSiteClick={() => {
                  setInitialTab("site")
                  setShowStudySiteSelector(true)
                }}
              />
              {(currentStudy || selectedSite) && (
                <button
                  type="button"
                  onClick={clearStudySiteSelection}
                  className={cn(macClearButtonClass, "flex h-10 w-10 shrink-0 items-center justify-center p-0 sm:h-auto sm:w-auto sm:px-3")}
                  title="Clear Study & Site"
                  aria-label="Clear Study and Site"
                >
                  <X className="w-4 h-4" strokeWidth={2.25} />
                </button>
              )}
            </>
          )}
        </div>
      </header>

      {/* Study Site Selector Sidebar */}
      <StudySiteSelector
        isOpen={showStudySiteSelector}
        onClose={() => setShowStudySiteSelector(false)}
        currentStudy={currentStudy}
        currentSite={selectedSite}
        initialTab={initialTab}
        onStudySelect={(study, site) => {
          const protocolNumber = study.studyProtocolNumber || study.name || study.projectName || study.code || studyNumber
          const studyId = study.studyId || study.id

          setCurrentStudy({
            protocolNumber,
            studyTitle: study.studyTitle,
            studyId: studyId
          })

          if (typeof window !== "undefined") {
            localStorage.setItem("selectedStudy", protocolNumber)
            localStorage.setItem("selectedStudyId", String(studyId))
            localStorage.setItem("selectedStudyTitle", (study.studyTitle || "").toString())
            window.dispatchEvent(new CustomEvent("studySelected", {
              detail: { studyId }
            }))
          }

          // If site is also selected, save it
          if (site) {
            const siteId = site.id || site.siteId
            const siteName = site.siteName || site.SiteName || `Site ${siteId}`

            setSelectedSite({
              siteName,
              id: siteId,
              siteId: siteId
            })

            if (typeof window !== "undefined") {
              localStorage.setItem("selectedSite", siteName)
              localStorage.setItem("selectedSiteId", String(siteId))
              window.dispatchEvent(new CustomEvent("studySiteChanged", {
                detail: { studyId, siteId }
              }))
            }
          } else if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("studySiteChanged", {
              detail: { studyId, siteId: null }
            }))
          }
        }}
        onSiteSelect={(study, site) => {
          // When only site is changed, preserve the current study
          if (study && site && currentStudy) {
            const protocolNumber = currentStudy.protocolNumber || study.studyProtocolNumber || study.name || study.projectName || study.code || studyNumber
            const studyId = currentStudy.studyId || study.studyId || study.id

            // Keep the current study, only update the site
            const siteId = site.id || site.siteId
            const siteName = site.siteName || site.SiteName || `Site ${siteId}`

            setSelectedSite({
              siteName,
              id: siteId,
              siteId: siteId
            })

            if (typeof window !== "undefined") {
              localStorage.setItem("selectedSite", siteName)
              localStorage.setItem("selectedSiteId", String(siteId))
              window.dispatchEvent(new CustomEvent("studySiteChanged", {
                detail: { studyId, siteId }
              }))
            }
          }
        }}
      />

    </div>
  )
}
