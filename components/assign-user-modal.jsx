"use client"

import { useMemo, useState, useEffect, useCallback } from "react"
import { X, UserPlus, Loader2, CheckCircle, ChevronRight, MapPin, Search } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { getMaxSitesPerStudyForRole } from "@/lib/permissions/studySiteAssignmentRules"
import { isStudyPermissionMatrixEnabled } from "@/lib/permissions/isStudyPermissionMatrixEnabled"

function resolveRoleNameFromGuid(availableRoles, roleGuid) {
  if (!roleGuid) return ""
  const guid = String(roleGuid).trim().toLowerCase()
  const match = (availableRoles || []).find((role) => {
    const id = String(role.guid ?? role.roleGuid ?? role.id ?? "").trim().toLowerCase()
    return id && id === guid
  })
  return String(match?.name ?? match?.roleName ?? "").trim()
}

function resolveRoleGuidFromName(availableRoles, roleName) {
  if (!roleName) return ""
  const target = String(roleName).trim().toLowerCase()
  const match = (availableRoles || []).find((role) => {
    const name = String(role.name ?? role.roleName ?? "").trim().toLowerCase()
    return name === target
  })
  return String(match?.guid ?? match?.roleGuid ?? match?.id ?? "").trim()
}

/**
 * Assign User Modal Component
 * World-class UX design with master-detail layout:
 * - Left: Studies list
 * - Right: Sites panel (appears when study is selected)
 */
export default function AssignUserModal({
    show,
    onClose,
    userId,
    studies,
    loading,
    selectedAssignments,
    onAssignmentsChange,
    onSave,
    saving,
    searchQuery,
    onSearchChange,
    userRole = "", // fallback when per-study role not set
    availableRoles = [],
    defaultRoleGuid = "",
    enablePerStudyRole = isStudyPermissionMatrixEnabled(),
}) {
    // Track which study is currently selected to show its sites in right panel
    const [selectedStudyId, setSelectedStudyId] = useState(null)
    const [siteSearchQuery, setSiteSearchQuery] = useState("")

    const getRoleNameForStudy = useCallback(
        (studyIdStr) => {
            if (!enablePerStudyRole) return userRole
            const roleGuid =
                selectedAssignments[studyIdStr]?.roleGuid ||
                defaultRoleGuid ||
                resolveRoleGuidFromName(availableRoles, userRole)
            return resolveRoleNameFromGuid(availableRoles, roleGuid) || userRole
        },
        [enablePerStudyRole, userRole, selectedAssignments, defaultRoleGuid, availableRoles],
    )

    const selectedStudyRoleName = useMemo(() => {
        if (!selectedStudyId) return userRole
        return getRoleNameForStudy(String(selectedStudyId))
    }, [selectedStudyId, getRoleNameForStudy, userRole])

    const maxSitesPerStudy = useMemo(
        () => getMaxSitesPerStudyForRole(selectedStudyRoleName),
        [selectedStudyRoleName],
    )
    const isSingleSiteRole = maxSitesPerStudy === 1

    // Auto-select first study with selected sites on load
    useEffect(() => {
        if (studies.length > 0 && !selectedStudyId) {
            // Find first study that has selected sites
            const studyWithSites = studies.find(study => {
                const studyId = String(study.id || study.studyId)
                return selectedAssignments[studyId]?.selected && 
                       Object.values(selectedAssignments[studyId]?.sites || {}).some(Boolean)
            })
            
            if (studyWithSites) {
                setSelectedStudyId(String(studyWithSites.id || studyWithSites.studyId))
            } else {
                // Otherwise select first study that is selected
                const firstSelected = studies.find(study => {
                    const studyId = String(study.id || study.studyId)
                    return selectedAssignments[studyId]?.selected
                })
                if (firstSelected) {
                    setSelectedStudyId(String(firstSelected.id || firstSelected.studyId))
                }
            }
        }
    }, [studies, selectedAssignments, selectedStudyId])

    // Filter studies based on search query
    const filteredStudies = useMemo(() => {
        if (!searchQuery) return studies
        const searchLower = searchQuery.toLowerCase()
        return studies.filter(study => {
            const protocolNumber = (study.studyProtocolNumber || "").toLowerCase()
            const title = (study.studyTitle || "").toLowerCase()
            return protocolNumber.includes(searchLower) || title.includes(searchLower)
        })
    }, [studies, searchQuery])

    // Get currently selected study
    const selectedStudy = useMemo(() => {
        if (!selectedStudyId) return null
        return studies.find(study => String(study.id || study.studyId) === selectedStudyId)
    }, [studies, selectedStudyId])

    // Filter sites for selected study
    const filteredSites = useMemo(() => {
        if (!selectedStudy) return []
        const sitesList = selectedStudy.sites || selectedStudy.Sites || []
        if (!siteSearchQuery) return sitesList
        
        const searchLower = siteSearchQuery.toLowerCase()
        return sitesList.filter(site => {
            const siteName = (site.siteName || "").toLowerCase()
            const siteFullName = (site.siteFullName || "").toLowerCase()
            return siteName.includes(searchLower) || siteFullName.includes(searchLower)
        })
    }, [selectedStudy, siteSearchQuery])

    // Count selected studies
    const selectedStudiesCount = Object.values(selectedAssignments).filter(s => s.selected).length

    // Handle study selection (for showing sites panel)
    const handleStudyClick = (studyId) => {
        const studyIdStr = String(studyId)
        setSelectedStudyId(studyIdStr)
        setSiteSearchQuery("") // Reset site search when switching studies
    }

    // Handle study checkbox toggle
    // Single-site roles (CRC/PI): one site per study. Others: auto-select all sites when study is checked.
    const handleStudyToggle = (studyId, checked, sitesList) => {
        const studyIdStr = String(studyId)
        const studyRoleName = getRoleNameForStudy(studyIdStr)
        const singleSite = getMaxSitesPerStudyForRole(studyRoleName) === 1
        onAssignmentsChange(prev => {
            if (checked) {
                const roleGuid =
                    prev[studyIdStr]?.roleGuid ||
                    defaultRoleGuid ||
                    resolveRoleGuidFromName(availableRoles, userRole) ||
                    ""
                if (singleSite) {
                    return {
                        ...prev,
                        [studyIdStr]: {
                            ...prev[studyIdStr],
                            selected: true,
                            roleGuid,
                            sites: {}
                        }
                    }
                }
                // Non-CRC/PI: auto-select all sites
                const sitesObj = {}
                sitesList?.forEach(site => {
                    const siteId = String(site.id || site.siteId)
                    sitesObj[siteId] = true
                })
                return {
                    ...prev,
                    [studyIdStr]: {
                        ...prev[studyIdStr],
                        selected: true,
                        roleGuid,
                        sites: sitesObj
                    }
                }
            } else {
                return {
                    ...prev,
                    [studyIdStr]: {
                        ...prev[studyIdStr],
                        selected: false,
                        sites: {}
                    }
                }
            }
        })
        if (checked) setSelectedStudyId(studyIdStr)
    }

    const handleStudyRoleChange = (studyId, roleGuid) => {
        const studyIdStr = String(studyId)
        onAssignmentsChange(prev => ({
            ...prev,
            [studyIdStr]: {
                ...prev[studyIdStr],
                roleGuid: String(roleGuid ?? ""),
            },
        }))
    }

    const handleStudyWideToggle = (studyId, checked) => {
        const studyIdStr = String(studyId)
        onAssignmentsChange(prev => ({
            ...prev,
            [studyIdStr]: {
                ...prev[studyIdStr],
                selected: true,
                studyWideOnly: checked,
                sites: checked ? {} : (prev[studyIdStr]?.sites ?? {}),
            },
        }))
        if (checked) setSelectedStudyId(studyIdStr)
    }

    // Handle site checkbox toggle — single-site roles: one selection per study; others: multiple
    const handleSiteToggle = (studyId, siteId, checked, sitesList) => {
        const studyIdStr = String(studyId)
        const siteIdStr = String(siteId)
        onAssignmentsChange(prev => {
            let updatedSites
            if (checked && isSingleSiteRole) {
                updatedSites = { [siteIdStr]: true }
            } else if (checked) {
                updatedSites = { ...prev[studyIdStr]?.sites, [siteIdStr]: true }
            } else {
                updatedSites = { ...prev[studyIdStr]?.sites, [siteIdStr]: false }
            }
            const selectedSitesCount = Object.values(updatedSites).filter(Boolean).length
            return {
                ...prev,
                [studyIdStr]: {
                    selected: selectedSitesCount > 0,
                    ...prev[studyIdStr],
                    sites: updatedSites
                }
            }
        })
    }

    // Select all / deselect all sites for a study (non-CRC only)
    const handleSelectAllSites = (studyId, sitesList, checked) => {
        const studyIdStr = String(studyId)
        const sitesObj = {}
        if (checked) {
            sitesList.forEach(site => {
                sitesObj[String(site.id || site.siteId)] = true
            })
        }
        onAssignmentsChange(prev => ({
            ...prev,
            [studyIdStr]: {
                selected: checked,
                ...prev[studyIdStr],
                sites: sitesObj
            }
        }))
    }

    // Early return AFTER all hooks are called
    if (!show) return null

    const selectedStudyIdStr = selectedStudyId ? String(selectedStudyId) : null
    const selectedStudyData = selectedStudyIdStr ? selectedAssignments[selectedStudyIdStr] : null
    const selectedSitesCount = selectedStudyData ? Object.values(selectedStudyData.sites || {}).filter(Boolean).length : 0
    const totalSitesCount = selectedStudy ? (selectedStudy.sites || selectedStudy.Sites || []).length : 0

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-7xl h-[90vh] my-4 sm:my-8 animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col">
                {/* Modal Header */}
                <div className="sticky top-0 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-slate-200 px-6 py-5 flex items-center justify-between z-20 rounded-t-2xl sm:rounded-t-3xl flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg">
                            <UserPlus className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-slate-900">Assign Studies & Sites</h3>
                            <p className="text-sm text-slate-600 mt-0.5">
                                {enablePerStudyRole
                                    ? "Select studies, role per study, and sites to assign"
                                    : isSingleSiteRole
                                    ? "Select studies and one site per study (CRC / PI roles)"
                                    : "Select studies and sites to assign to this user"}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-10 h-10 rounded-full hover:bg-white/80 flex items-center justify-center transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-600" />
                    </button>
                </div>

                {/* Main Content - Split Layout */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left Panel - Studies List */}
                    <div className="w-1/2 border-r border-slate-200 flex flex-col bg-slate-50/30">
                        {/* Search Bar */}
                        <div className="p-4 border-b border-slate-200 bg-white flex-shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => onSearchChange(e.target.value)}
                                    placeholder="Search studies..."
                                    className="w-full px-4 py-2.5 pl-10 rounded-lg border-2 border-slate-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none bg-white transition-all text-sm"
                                />
                            </div>
                        </div>

                        {/* Studies List */}
                        <div className="flex-1 overflow-y-auto p-4">
                            {loading ? (
                                <div className="space-y-3 py-4">
                                    {Array.from({ length: 6 }).map((_, idx) => (
                                        <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3">
                                            <div className="flex items-center gap-2">
                                                <Skeleton className="h-5 w-5 rounded bg-slate-200/80" />
                                                <Skeleton className="h-4 w-40 bg-slate-200/80" />
                                            </div>
                                            <Skeleton className="mt-2 h-3.5 w-24 bg-slate-200/70" />
                                        </div>
                                    ))}
                                </div>
                            ) : filteredStudies.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                                        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    <p className="text-slate-600 font-medium">No studies found</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {filteredStudies.map((study) => {
                                        const studyId = String(study.id || study.studyId)
                                        const sitesList = study.sites || study.Sites || []
                                        const isStudySelected = selectedAssignments[studyId]?.selected || false
                                        const isStudyAlreadyAssigned = study.isAlreadyAssigned === true || study.isAssigned === true || study.IsAlreadyAssigned === true
                                        const isActive = selectedStudyId === studyId
                                        const selectedSitesCountForStudy = Object.values(selectedAssignments[studyId]?.sites || {}).filter(Boolean).length

                                        return (
                                            <div
                                                key={studyId}
                                                onClick={() => handleStudyClick(studyId)}
                                                className={`group cursor-pointer rounded-xl border-2 transition-all duration-200 ${
                                                    isActive
                                                        ? "border-green-500 bg-green-50 shadow-md"
                                                        : isStudySelected
                                                        ? "border-green-300 bg-green-50/50 hover:border-green-400"
                                                        : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                                                }`}
                                            >
                                                <div className="p-4 flex items-start gap-3">
                                                    <div 
                                                        className="flex items-center pt-0.5" 
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isStudySelected}
                                                            onChange={(e) => handleStudyToggle(studyId, e.target.checked, sitesList)}
                                                            className="w-5 h-5 rounded border-2 border-slate-300 text-green-600 focus:ring-2 focus:ring-green-500 focus:ring-offset-0 cursor-pointer"
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-2 mb-1">
                                                            <h4 className={`text-base font-bold break-words ${
                                                                isActive ? "text-green-900" : "text-slate-900"
                                                            }`}>
                                                                {study.studyProtocolNumber || study.studyTitle || `Study ${studyId}`}
                                                            </h4>
                                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                                {isStudyAlreadyAssigned && (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold whitespace-nowrap">
                                                                        <CheckCircle className="w-3 h-3" />
                                                                        Assigned
                                                                    </span>
                                                                )}
                                                                {isActive && (
                                                                    <ChevronRight className="w-5 h-5 text-green-600" />
                                                                )}
                                                            </div>
                                                        </div>
                                                        {study.studyTitle && study.studyProtocolNumber && (
                                                            <p className="text-sm text-slate-600 mb-2 line-clamp-1">{study.studyTitle}</p>
                                                        )}
                                                        <div className="flex items-center gap-3 text-xs text-slate-500">
                                                            <span className="inline-flex items-center gap-1">
                                                                <MapPin className="w-3.5 h-3.5" />
                                                                {sitesList.length} {sitesList.length === 1 ? "site" : "sites"}
                                                            </span>
                                                            {selectedAssignments[studyId]?.studyWideOnly && (
                                                                <span className="text-sky-600 font-medium">Study-wide</span>
                                                            )}
                                                            {isStudySelected && selectedSitesCountForStudy > 0 && (
                                                                <span className="text-green-600 font-medium">
                                                                    {selectedSitesCountForStudy} selected
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Panel - Sites List (Only visible when study is selected) */}
                    <div className={`w-1/2 flex flex-col transition-all duration-300 ${
                        selectedStudy ? "opacity-100" : "opacity-0 pointer-events-none"
                    }`}>
                        {selectedStudy ? (
                            <>
                                {/* Sites Header */}
                                <div className="p-4 border-b border-slate-200 bg-white flex-shrink-0">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <h4 className="text-lg font-bold text-slate-900">
                                                {selectedStudy.studyProtocolNumber || selectedStudy.studyTitle || `Study ${selectedStudyId}`}
                                            </h4>
                                        <p className="text-sm text-slate-600 mt-0.5">
                                            {totalSitesCount} {totalSitesCount === 1 ? "site" : "sites"} available
                                            {isSingleSiteRole ? " — select one per study" : ""}
                                            </p>
                                        </div>
                                        {selectedSitesCount > 0 && (
                                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
                                                {isSingleSiteRole ? `${selectedSitesCount}/1 selected` : `${selectedSitesCount} selected`}
                                            </span>
                                        )}
                                    </div>
                                    
                                    {enablePerStudyRole && availableRoles.length > 0 && (
                                        <div className="mb-3">
                                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                                                Role for this study
                                                {selectedStudyData?.roleName ? (
                                                    <span className="ml-2 font-normal normal-case text-slate-500">
                                                        (assigned: {selectedStudyData.roleName})
                                                    </span>
                                                ) : null}
                                            </label>
                                            <select
                                                value={
                                                    selectedStudyData?.roleGuid ||
                                                    defaultRoleGuid ||
                                                    resolveRoleGuidFromName(availableRoles, userRole) ||
                                                    ""
                                                }
                                                onChange={(e) => handleStudyRoleChange(selectedStudyId, e.target.value)}
                                                className="w-full rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
                                            >
                                                <option value="">— Select role —</option>
                                                {availableRoles.map((role) => {
                                                    const id = String(role.guid ?? role.roleGuid ?? role.id ?? "")
                                                    const label = String(role.name ?? role.roleName ?? "Role")
                                                    return (
                                                        <option key={id} value={id}>
                                                            {label}
                                                        </option>
                                                    )
                                                })}
                                            </select>
                                        </div>
                                    )}

                                    <label className="mb-3 flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-700">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(selectedStudyData?.studyWideOnly)}
                                            onChange={(e) => handleStudyWideToggle(selectedStudyId, e.target.checked)}
                                            className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                                        />
                                        Study-wide access (no specific site)
                                    </label>

                                    {/* Site Search */}
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="text"
                                            value={siteSearchQuery}
                                            onChange={(e) => setSiteSearchQuery(e.target.value)}
                                            placeholder="Search sites..."
                                            className="w-full px-4 py-2 pl-9 rounded-lg border-2 border-slate-200 focus:border-green-500 focus:ring-2 focus:ring-green-100 outline-none bg-white transition-all text-sm"
                                        />
                                    </div>
                                </div>

                                {/* Sites List */}
                                <div className="flex-1 overflow-y-auto p-4 bg-slate-50/30">
                                    {filteredSites.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12">
                                            <MapPin className="w-12 h-12 text-slate-300 mb-4" />
                                            <p className="text-slate-600 font-medium">
                                                {siteSearchQuery ? "No sites found" : "No sites available"}
                                            </p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="mb-3 flex items-center justify-between">
                                                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                                                    {isSingleSiteRole ? "Select one site" : "Select sites"}
                                                </p>
                                                {!isSingleSiteRole && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const allSelected = filteredSites.every(site => {
                                                                const sid = String(site.id || site.siteId)
                                                                return selectedAssignments[selectedStudyIdStr]?.sites?.[sid] === true
                                                            })
                                                            handleSelectAllSites(selectedStudyIdStr, filteredSites, !allSelected)
                                                        }}
                                                        className="text-xs font-medium text-green-600 hover:text-green-700 hover:underline px-2 py-1 rounded hover:bg-green-50 transition-colors"
                                                    >
                                                        {filteredSites.every(site => {
                                                            const sid = String(site.id || site.siteId)
                                                            return selectedAssignments[selectedStudyIdStr]?.sites?.[sid] === true
                                                        }) ? "Deselect All" : "Select All"}
                                                    </button>
                                                )}
                                            </div>

                                            {/* Sites Grid */}
                                            <div className="grid grid-cols-1 gap-2">
                                                {filteredSites.map((site) => {
                                                    const siteId = String(site.id || site.siteId)
                                                    const isSiteSelected = selectedAssignments[selectedStudyIdStr]?.sites?.[siteId] || false
                                                    const isSiteAlreadyAssigned = site.isAlreadyAssigned === true || site.isAssigned === true || site.IsAlreadyAssigned === true

                                                    return (
                                                        <label
                                                            key={siteId}
                                                            className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                                                isSiteSelected
                                                                    ? "border-green-500 bg-green-50 shadow-sm"
                                                                    : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-blue-50"
                                                            }`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isSiteSelected}
                                                                onChange={(e) => handleSiteToggle(selectedStudyIdStr, siteId, e.target.checked, filteredSites)}
                                                                className="w-4 h-4 rounded border-2 border-slate-300 text-green-600 focus:ring-2 focus:ring-green-500 focus:ring-offset-0 flex-shrink-0"
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <span className="text-sm font-medium text-slate-900 block">
                                                                    {site.siteName || site.siteFullName || `Site ${siteId}`}
                                                                </span>
                                                                {site.siteFullName && site.siteName !== site.siteFullName && (
                                                                    <span className="text-xs text-slate-500 block mt-0.5">
                                                                        {site.siteFullName}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {isSiteAlreadyAssigned && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-semibold flex-shrink-0">
                                                                    <CheckCircle className="w-3 h-3" />
                                                                    Assigned
                                                                </span>
                                                            )}
                                                        </label>
                                                    )
                                                })}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center bg-slate-50/30">
                                <div className="text-center">
                                    <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                                        <MapPin className="w-10 h-10 text-slate-400" />
                                    </div>
                                    <p className="text-slate-600 font-medium text-lg mb-1">Select a study</p>
                                    <p className="text-slate-500 text-sm">Choose a study from the left to view and assign sites</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-3 rounded-b-2xl sm:rounded-b-3xl flex-shrink-0">
                    <div className="text-sm text-slate-600">
                        {selectedStudiesCount > 0 && (
                            <span className="font-medium text-green-600">
                                {selectedStudiesCount} {selectedStudiesCount === 1 ? "study" : "studies"} selected
                            </span>
                        )}
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 sm:flex-none px-6 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 hover:border-slate-400 transition-all text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={onSave}
                            disabled={saving || selectedStudiesCount === 0}
                            className="flex-1 sm:flex-none px-6 py-2.5 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold hover:from-green-700 hover:to-emerald-700 transition-all shadow-md shadow-green-200/50 hover:shadow-lg hover:shadow-green-300/50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                            {saving ? (
                                <span className="flex items-center gap-2 justify-center">
                                    <Loader2 className="animate-spin h-4 w-4" />
                                    Assigning...
                                </span>
                            ) : (
                                "Assign User"
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
