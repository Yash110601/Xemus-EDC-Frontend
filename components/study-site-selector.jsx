"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { studyService } from "@/lib/services"
import { StudyFilter } from "@/lib/api/config"
import { X, Search, Check, Plus, Minus, ChevronRight, Building2, MapPin } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

/** List-shaped skeletons matching iOS-light card list */
function StudySiteSelectorListSkeleton({ label = "Loading" }) {
  const widthsTitle = ["w-[48%]", "w-[58%]", "w-[44%]", "w-[62%]", "w-[50%]", "w-[55%]"]
  const widthsSub = ["w-[90%]", "w-[72%]", "w-[85%]", "w-[68%]", "w-[88%]", "w-[76%]"]
  return (
    <div className="space-y-2.5" role="status" aria-busy="true" aria-label={label}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="flex w-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/85 p-3.5 shadow-sm"
        >
          <Skeleton className="h-10 w-10 shrink-0 rounded-xl bg-slate-200/90" />
          <div className="min-w-0 flex-1 space-y-2 py-0.5">
            <div className="flex items-center gap-2 pr-1">
              <Skeleton className={`h-4 rounded-lg bg-slate-200/90 ${widthsTitle[i % widthsTitle.length]}`} />
              <Skeleton className="ml-auto h-5 w-16 shrink-0 rounded-full bg-slate-200/80" />
            </div>
            <Skeleton className={`h-3 rounded-md bg-slate-200/70 ${widthsSub[i % widthsSub.length]}`} />
          </div>
          <Skeleton className="h-4 w-4 shrink-0 rounded-sm bg-slate-200/70" />
        </div>
      ))}
    </div>
  )
}

export default function StudySiteSelector({ isOpen, onClose, onStudySelect, onSiteSelect, currentStudy, currentSite, initialTab = "study" }) {
  const [activeTab, setActiveTab] = useState("study") // Always start with "study"
  const [searchQuery, setSearchQuery] = useState("")
  const [studies, setStudies] = useState([])
  const [sites, setSites] = useState([])
  const [filteredSites, setFilteredSites] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedStudy, setSelectedStudy] = useState(currentStudy)
  const [selectedSite, setSelectedSite] = useState(currentSite)
  const [expandedStudyId, setExpandedStudyId] = useState(null) // Track which study shows add/minus buttons
  const [showSitePanel, setShowSitePanel] = useState(false) // Track if site panel should be visible

  // Sync with props when they change
  useEffect(() => {
    if (currentStudy) {
      setSelectedStudy(currentStudy)
    }
    if (currentSite) {
      setSelectedSite(currentSite)
    }
  }, [currentStudy, currentSite])
  
  // Listen for clear events from outside (when clear button is clicked in header)
  useEffect(() => {
    if (typeof window === "undefined") return
    
    const handleStudyCleared = (e) => {
      // Only clear if studyId is explicitly null (clear button was clicked)
      if (e.detail?.studyId === null || e.detail?.studyId === undefined) {
        setSelectedStudy(null)
        setSelectedSite(null)
        setSites([])
        setFilteredSites([])
        setShowSitePanel(false)
        setActiveTab("study")
        setSearchQuery("")
        setExpandedStudyId(null)
      }
    }
    
    window.addEventListener("studySelected", handleStudyCleared)
    window.addEventListener("studySiteChanged", handleStudyCleared)
    
    return () => {
      window.removeEventListener("studySelected", handleStudyCleared)
      window.removeEventListener("studySiteChanged", handleStudyCleared)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchStudies()
      setSearchQuery("") // Reset search
      setExpandedStudyId(null) // Reset expanded study
      
      // If initialTab is "site" and we have a current study, show site panel directly
      if (initialTab === "site" && currentStudy) {
        setSelectedStudy(currentStudy)
        setShowSitePanel(true)
        setActiveTab("site")
      } else {
        setActiveTab("study") // Start with study tab
        setShowSitePanel(false) // Reset site panel visibility
      }
      
      // Ensure selectedStudy is set from currentStudy when opening
      if (currentStudy && !selectedStudy) {
        setSelectedStudy(currentStudy)
      }
      // Ensure selectedSite is set from currentSite when opening
      if (currentSite && !selectedSite) {
        setSelectedSite(currentSite)
      }
      // Prevent body scroll when sidebar is open
      document.body.style.overflow = "hidden"
    } else {
      // Restore body scroll when sidebar is closed
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialTab])

  useEffect(() => {
    if (isOpen && searchQuery) {
      const timeoutId = setTimeout(() => {
        fetchStudies()
      }, 300)
      return () => clearTimeout(timeoutId)
    } else if (isOpen && !searchQuery) {
      fetchStudies()
    }
  }, [searchQuery])

  // Create a stable reference for study IDs to avoid dependency array issues
  const studiesIdsString = useMemo(() => {
    return studies.map(s => s.studyId || s.id).join(',')
  }, [studies])

  useEffect(() => {
    if (isOpen && studies.length > 0) {
      const studyToUse = selectedStudy || currentStudy
      if (studyToUse) {
        const studyId = studyToUse.studyId || studyToUse.id
        const study = studies.find(s => (s.studyId || s.id) === studyId)
        if (study) {
          const sitesList = study.sites || study.Sites || []
          setSites(sitesList)
          setFilteredSites(sitesList)
          // Always update selectedStudy with the full study object from the API
          // This ensures we have all the fields needed (studyProtocolNumber, studyTitle, etc.)
          if (study && (!selectedStudy || !selectedStudy.studyProtocolNumber)) {
            setSelectedStudy(study)
          }
          
          // If initialTab is "site" and we have sites, ensure site panel is visible
          if (initialTab === "site" && sitesList.length > 0) {
            setShowSitePanel(true)
            setActiveTab("site")
          }
        }
      }
    }
  }, [
    isOpen, 
    selectedStudy?.studyId ?? selectedStudy?.id ?? null, 
    currentStudy?.studyId ?? currentStudy?.id ?? null, 
    studiesIdsString,
    initialTab
  ])

  // Filter sites based on search query
  useEffect(() => {
    if (activeTab === "site" && searchQuery) {
      const searchLower = searchQuery.toLowerCase()
      const filtered = sites.filter(site => {
        const siteName = (site.siteName || site.SiteName || "").toLowerCase()
        const siteCode = (site.siteCode || site.SiteCode || "").toLowerCase()
        return siteName.includes(searchLower) || siteCode.includes(searchLower)
      })
      setFilteredSites(filtered)
    } else if (activeTab === "site") {
      setFilteredSites(sites)
    }
  }, [searchQuery, activeTab, sites])

  const fetchStudies = async () => {
    try {
      setLoading(true)
      const response = await studyService.getAccessibleStudiesWithSites(StudyFilter.Active)
      if (response && response.isSuccess && response.data) {
        let studiesList = Array.isArray(response.data) ? response.data : []
        
        if (searchQuery) {
          const searchLower = searchQuery.toLowerCase()
          studiesList = studiesList.filter(study => {
            const protocolNumber = (study.studyProtocolNumber || "").toLowerCase()
            const title = (study.studyTitle || "").toLowerCase()
            return protocolNumber.includes(searchLower) || title.includes(searchLower)
          })
        }
        
        setStudies(studiesList)
      }
    } catch (error) {
      console.error("Error fetching studies:", error)
      setStudies([])
    } finally {
      setLoading(false)
    }
  }

  const handleStudyClick = (study) => {
    const studyId = study.studyId || study.id
    // Toggle expanded state - show add/minus buttons
    if (expandedStudyId === studyId) {
      setExpandedStudyId(null) // Collapse if already expanded
    } else {
      setExpandedStudyId(studyId) // Expand to show add/minus buttons
      setSelectedStudy(study)
    }
  }

  const handleAddStudy = (study) => {
    const studyId = study.studyId || study.id
    setSelectedStudy(study)
    setExpandedStudyId(null) // Hide add/minus buttons
    setSearchQuery("") // Reset search when switching to sites
    
    // Load sites for this study
    const foundStudy = studies.find(s => (s.studyId || s.id) === studyId)
    if (foundStudy) {
      const sitesList = foundStudy.sites || foundStudy.Sites || []
      setSites(sitesList)
      setFilteredSites(sitesList)
    }
    
    // Show site panel and switch to site tab
    setShowSitePanel(true)
    setActiveTab("site")
  }

  const handleRemoveStudy = (study) => {
    const studyId = study.studyId || study.id
    if (selectedStudy && (selectedStudy.studyId || selectedStudy.id) === studyId) {
      setSelectedStudy(null)
      setSites([])
      setShowSitePanel(false)
      setActiveTab("study")
    }
    setExpandedStudyId(null)
  }

  const handleSiteClick = (site) => {
    setSelectedSite(site)
    // Use selectedStudy if available, otherwise find the full study object from studies array
    let studyToUse = selectedStudy
    if (!studyToUse && currentStudy) {
      // Find the full study object from the studies array
      const studyId = currentStudy.studyId || currentStudy.id
      studyToUse = studies.find(s => (s.studyId || s.id) === studyId)
    }
    
    // Immediately apply the selection and close
    if (studyToUse) {
      onStudySelect(studyToUse, site)
      onClose()
    } else if (onSiteSelect && currentStudy) {
      // Fallback to onSiteSelect if available
      onSiteSelect(currentStudy, site)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex overflow-hidden">
      {/* Backdrop — macOS-like light glass veil (white/cream, no dark dim) */}
      <div
        className="fixed inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.46)_0%,rgba(250,245,235,0.38)_100%)] backdrop-blur-[1.5px] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar — iOS light glass */}
      <div
        className="relative ml-auto flex h-[100dvh] w-[min(23rem,100vw)] max-w-full flex-col overflow-hidden rounded-l-[1.6rem] border-l border-slate-200/80 bg-gradient-to-b from-white/98 via-slate-50/95 to-white/97 shadow-[0_0_0_1px_rgba(99,102,241,0.08),-22px_0_58px_-24px_rgba(15,23,42,0.18)] backdrop-blur-2xl backdrop-saturate-150 animate-in slide-in-from-right-3 fade-in duration-300"
        role="dialog"
        aria-modal="true"
        aria-labelledby="study-site-selector-title"
      >
        {/* Header */}
        <div className="relative z-10 flex items-center justify-between border-b border-slate-200/85 bg-white/80 px-4 py-3.5 backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-2">
            {activeTab === "site" && selectedStudy && (
              <button
                type="button"
                onClick={() => setActiveTab("study")}
                className="mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition-all duration-200 hover:bg-emerald-50 hover:text-emerald-700 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/80 focus-visible:ring-offset-2"
                title="Back to studies"
              >
                <ChevronRight className="h-4 w-4 rotate-180" aria-hidden />
              </button>
            )}
            <div className="min-w-0">
              <h2
                id="study-site-selector-title"
                className="truncate text-[17px] font-semibold tracking-tight text-slate-900"
              >
                Select Study & Site
              </h2>
              {activeTab === "site" && selectedStudy && (
                <p className="mt-0.5 truncate text-xs font-semibold tracking-wide text-emerald-600/90">
                  {selectedStudy.studyProtocolNumber || selectedStudy.name || "Selected Study"}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition-all duration-200 hover:bg-emerald-50 hover:text-emerald-700 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/80 focus-visible:ring-offset-2"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Tabs — outlined Study pill, or Study/Site segmented when site step is open */}
        <div className="px-3 pt-2.5">
          {!showSitePanel ? (
            <div className="rounded-xl border-2 border-emerald-200 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-700">
              Study
            </div>
          ) : (
            <div className="flex rounded-2xl bg-slate-100/95 p-1 ring-1 ring-slate-200/80">
              <button
                type="button"
                onClick={() => {
                  setActiveTab("study")
                  setSearchQuery("")
                }}
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/80 focus-visible:ring-offset-2 ${
                  activeTab === "study"
                    ? "bg-white text-slate-700 shadow-sm ring-1 ring-slate-200"
                    : "text-slate-600 hover:bg-white/90 hover:text-emerald-700"
                }`}
              >
                Study
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("site")
                  setSearchQuery("")
                }}
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/80 focus-visible:ring-offset-2 ${
                  activeTab === "site"
                    ? "bg-gradient-to-r from-emerald-500 via-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-950/30"
                    : "text-slate-600 hover:bg-white/90 hover:text-emerald-700"
                }`}
              >
                Site
              </button>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="px-3 pb-2.5 pt-2.5">
          <div className="relative rounded-xl border border-slate-200 bg-white transition-all duration-200 focus-within:border-emerald-300 focus-within:ring-2 focus-within:ring-emerald-200/60">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="text"
              placeholder={activeTab === "study" ? "Search studies…" : "Search sites…"}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                if (activeTab === "study") {
                  fetchStudies()
                }
              }}
              className="w-full rounded-xl border-0 bg-transparent py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
            />
          </div>
        </div>

        {/* Content */}
        <div className="custom-scrollbar flex-1 overflow-y-auto overflow-x-hidden bg-white/35 px-2.5 pb-3.5 pt-1">
          {loading ? (
            <StudySiteSelectorListSkeleton
              label={activeTab === "study" ? "Loading studies" : "Loading sites"}
            />
          ) : activeTab === "study" ? (
            <div className="space-y-2.5">
              {studies.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <Building2 className="mb-3 h-12 w-12 text-slate-300" strokeWidth={1.25} />
                  <p className="mb-1 text-sm font-semibold tracking-tight text-slate-600">No studies found</p>
                  <p className="max-w-[14rem] text-xs leading-relaxed text-slate-400">
                    {searchQuery ? "Try a different search term." : "No studies available."}
                  </p>
                </div>
              ) : (
                studies.map((study) => {
                  const studyId = study.studyId || study.id
                  const isSelected = selectedStudy && (selectedStudy.studyId || selectedStudy.id) === studyId
                  const isExpanded = expandedStudyId === studyId
                  const sitesCount = (study.sites || study.Sites || []).length
                  return (
                    <div
                      key={studyId}
                      className={`w-full overflow-hidden rounded-2xl border transform-gpu transition-all duration-200 hover:scale-[1.03] ${
                        isSelected
                          ? "border-emerald-400/65 bg-emerald-50/75 shadow-[0_12px_30px_-14px_rgba(99,102,241,0.32)] ring-1 ring-violet-300/50"
                          : "border-slate-200/85 bg-white/92 hover:border-emerald-400 hover:bg-emerald-50/35 hover:shadow-md"
                      } ${isExpanded ? "shadow-md" : "shadow-sm"}`}
                      style={{ transformOrigin: "center", willChange: "transform" }}
                    >
                      <button
                        type="button"
                        onClick={() => handleStudyClick(study)}
                        className={`w-full rounded-2xl p-3.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/80 focus-visible:ring-inset ${
                          isExpanded ? "bg-emerald-50/35" : "hover:bg-slate-50/80"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                                isSelected
                                  ? "bg-emerald-100 text-emerald-600"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              <Building2 className="h-5 w-5" strokeWidth={1.5} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-semibold tracking-tight text-slate-900">
                                  {study.studyProtocolNumber || study.name || "N/A"}
                                </p>
                                {sitesCount > 0 && (
                                  <span
                                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                      isSelected
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    {sitesCount} {sitesCount === 1 ? "site" : "sites"}
                                  </span>
                                )}
                              </div>
                              {study.studyTitle && (
                                <p className="mt-1 truncate text-xs leading-snug text-slate-500">
                                  {study.studyTitle}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {isSelected && !isExpanded && (
                              <Check className="h-5 w-5 text-emerald-600" strokeWidth={2} />
                            )}
                            <ChevronRight
                              className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
                                isExpanded ? "rotate-90 text-emerald-500" : ""
                              }`}
                            />
                          </div>
                        </div>
                      </button>
                      
                      {/* Add/Minus buttons - shown when study is expanded */}
                      {isExpanded && (
                        <div className="flex items-center gap-2 border-t border-slate-200/90 bg-white/96 p-3 backdrop-blur-sm animate-in slide-in-from-top-1 duration-200">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleAddStudy(study)
                            }}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r btn-brand-gradient px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200  hover:shadow-md active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/80 focus-visible:ring-offset-2"
                          >
                            <Plus className="h-4 w-4" strokeWidth={2} />
                            Select Site
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveStudy(study)
                            }}
                            className="flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 transition-all duration-200 hover:bg-slate-200 hover:shadow-sm active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/80 focus-visible:ring-offset-2"
                          >
                            <Minus className="h-4 w-4" strokeWidth={2} />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredSites.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <MapPin className="mb-3 h-12 w-12 text-slate-300" strokeWidth={1.25} />
                  <p className="mb-1 text-sm font-semibold tracking-tight text-slate-600">No sites found</p>
                  <p className="max-w-[14rem] text-xs leading-relaxed text-slate-400">
                    {searchQuery ? "Try a different search term." : "No sites available for this study."}
                  </p>
                </div>
              ) : (
                filteredSites.map((site) => {
                  const siteId = site.id || site.siteId
                  const isSelected = selectedSite && (selectedSite.id || selectedSite.siteId) === siteId
                  return (
                    <button
                      type="button"
                      key={siteId}
                      onClick={() => handleSiteClick(site)}
                      className={`w-full rounded-2xl border p-3.5 text-left transform-gpu transition-all duration-200 hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/80 focus-visible:ring-inset ${
                        isSelected
                          ? "border-emerald-400/65 bg-emerald-50/80 shadow-[0_12px_28px_-14px_rgba(99,102,241,0.32)] ring-1 ring-violet-300/50"
                          : "border-slate-200/85 bg-white/92 hover:border-emerald-400 hover:bg-emerald-50/35 hover:shadow-md"
                      }`}
                      style={{ transformOrigin: "center", willChange: "transform" }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                              isSelected
                                ? "bg-emerald-100 text-emerald-600"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            <MapPin className="h-5 w-5" strokeWidth={1.5} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold tracking-tight text-slate-900">
                              {site.siteName || site.SiteName || `Site ${siteId}`}
                            </p>
                            {site.siteCode && (
                              <p className="mt-0.5 truncate text-xs text-slate-500">
                                Code: {site.siteCode}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {isSelected && (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 ring-1 ring-emerald-200/80">
                              <Check className="h-4 w-4" strokeWidth={2.25} />
                            </div>
                          )}
                          <ChevronRight
                            className={`h-4 w-4 transition-colors ${
                              isSelected ? "text-emerald-500" : "text-slate-400"
                            }`}
                            aria-hidden
                          />
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

