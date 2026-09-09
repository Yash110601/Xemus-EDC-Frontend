"use client"

import { useState, useEffect, useRef } from "react"
import { crfDesignService, studyService } from "@/lib/services"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import DataPagination from "@/components/ui/data-pagination"
import SectionSkeleton from "@/components/ui/section-skeleton"
import { LoadingDots } from "@/components/ui/loading-dots"
import { Eye, Edit, Trash2, Plus, Search, Loader2, FileText, Clock, User, Hash, FileCheck, Printer, Download, PowerOff, AlertTriangle } from "lucide-react"
import { useRouter } from "next/navigation"
import { buildCrfDesignerConfigFromApi } from "@/lib/utils/crfDesignerConfigFromApi"
import { getCrfFormTypeDisplayLabel } from "@/lib/visitTypes"
import { getStudyFilterDisplayName } from "@/lib/reports/studySitePatientReportUi"
import { downloadBundleJson } from "@/lib/utils/crfDesignerBundle"
import { useToast } from "@/hooks/use-toast"

const CRFList = ({ onView, onEdit, onCreateNew, onPrintBlank, studyId = null, onStudyChange }) => {
  const router = useRouter()
  const { toast } = useToast()
  const [exportingBundleId, setExportingBundleId] = useState(null)
  const [crfs, setCrfs] = useState([])
  const [loading, setLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [loadError, setLoadError] = useState("")
  const [deactivateConfirmCrf, setDeactivateConfirmCrf] = useState(null) // { id, name }
  const [deactivatingCrf, setDeactivatingCrf] = useState(null)
  const [deleteModalCrf, setDeleteModalCrf] = useState(null) // { id, name, studyId }
  const [deleteEligibility, setDeleteEligibility] = useState(null)
  const [deleteEligibilityLoading, setDeleteEligibilityLoading] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState("")
  const [deletingCrf, setDeletingCrf] = useState(null)
  const [activeStatusFilter, setActiveStatusFilter] = useState("all")
  const [studies, setStudies] = useState([])
  const [loadingStudies, setLoadingStudies] = useState(false)
  const [studySearch, setStudySearch] = useState("")

  useEffect(() => {
    setPageNumber(1)
  }, [searchQuery, activeStatusFilter])

  // Use a ref to prevent duplicate calls during rapid state changes
  const loadingRef = useRef(false)
  const previousStudyIdRef = useRef(studyId)
  
  useEffect(() => {
    // Prevent duplicate calls if already loading
    if (loadingRef.current) {
      return
    }
    
    // Debounce to prevent multiple rapid calls
    const timer = setTimeout(() => {
      loadingRef.current = true
      loadCRFs().finally(() => {
        loadingRef.current = false
      })
    }, 150)
    
    return () => {
      clearTimeout(timer)
    }
  }, [searchQuery, pageNumber, pageSize, studyId, activeStatusFilter])

  // When study filter changes, reset to first page
  useEffect(() => {
    setPageNumber(1)
  }, [studyId])

  // Load studies for dropdown (same source as reports page)
  useEffect(() => {
    let mounted = true
    setLoadingStudies(true)

    const loadStudies = async () => {
      try {
        const response = await studyService.getStudiesForDropdown()
        if (!mounted) return
        if (response.isSuccess && response.data) {
          let studiesData = response.data || []
          setStudies(normalizeStudiesDropdown(studiesData))
        } else {
          setStudies([])
        }
      } catch (error) {
        console.error("Error loading studies for CRF list:", error)
        if (mounted) {
          setStudies([])
        }
      } finally {
        if (mounted) {
          setLoadingStudies(false)
        }
      }
    }

    loadStudies()

    return () => {
      mounted = false
    }
  }, [])

  // Expose refresh function via ref or prop if needed
  // For now, component will refresh when key changes from parent

  const handleClearFilters = () => {
    setSearchQuery("")
    setActiveStatusFilter("all")
    if (onStudyChange) {
      onStudyChange(null)
    }
  }

  const resolveIsActiveFilter = () => {
    if (activeStatusFilter === "active") return true
    if (activeStatusFilter === "inactive") return false
    return null
  }

  const normalizeStudiesDropdown = (studiesData) => {
    if (!Array.isArray(studiesData)) return []
    if (studiesData.length > 0 && typeof studiesData[0] === "string") {
      return studiesData.map((name, index) => ({
        studyId: index + 1,
        id: index + 1,
        studyProtocolNumber: name,
        name,
      }))
    }
    return studiesData
  }

  const resolveStudyProtocolNumber = (crf, studiesSource = studies) => {
    const studyId = Number(crf?.studyId)
    if (Number.isFinite(studyId)) {
      const match = studiesSource.find((study) => Number(study.studyId ?? study.id) === studyId)
      const label = getStudyFilterDisplayName(match)
      if (label) return label
    }
    return crf?.studyProtocolNumber || crf?.study?.protocolNumber || "—"
  }

  const refreshStudiesDropdown = async () => {
    try {
      const response = await studyService.getStudiesForDropdown()
      if (response.isSuccess && response.data) {
        setStudies(normalizeStudiesDropdown(response.data))
      }
    } catch (error) {
      console.error("Error refreshing studies for CRF list:", error)
    }
  }

  const loadCRFs = async () => {
    const isStudyChanged = previousStudyIdRef.current !== studyId
    const hasExistingData = crfs && crfs.length > 0
    setLoadError("")
    setLoading(isStudyChanged || !hasExistingData)
    setIsRefreshing(!isStudyChanged && hasExistingData)
    try {
      const [response] = await Promise.all([
        Promise.race([
          crfDesignService.getCrfDesignsList(
            pageNumber,
            pageSize,
            studyId ?? null,
            searchQuery || null,
            resolveIsActiveFilter(),
          ),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Request timed out while loading CRF designs.")), 12000),
          ),
        ]),
        refreshStudiesDropdown(),
      ])

      if (response.isSuccess && response.data) {
        // API returns { items, totalCount, pageNumber, pageSize, totalPages }
        const data = response.data
        const items = Array.isArray(data) ? data : (data.items || data.Items || [])
        
        // Extract pagination info
        if (!Array.isArray(data)) {
          setTotalCount(data.totalCount || data.TotalCount || items.length)
          setTotalPages(data.totalPages || data.TotalPages || Math.ceil((data.totalCount || data.TotalCount || items.length) / pageSize))
        } else {
          // If API returns array, we don't have pagination info
          setTotalCount(items.length)
          setTotalPages(1)
        }
        
        // Transform API response to match component expectations
        const transformedCrfs = items.map(item => {
          // Parse HtmlContent if it exists (contains the CRF structure)
          // Note: htmlContent is now HTML, not JSON, so we need to fetch full data when editing
          let crfStructure = null
          if (item.htmlContent) {
            try {
              // Try parsing as JSON first (for backward compatibility)
              crfStructure = JSON.parse(item.htmlContent)
            } catch (e) {
              // If it's HTML, we'll fetch full data when editing
              console.warn("HtmlContent is HTML, not JSON. Will fetch full data on edit.")
            }
          }

          return {
            id: item.id,
            studyId: item.studyId,
            studyProtocolNumber: item.studyProtocolNumber || item.study?.protocolNumber || "—",
            crfFormType: item.crfFormType, // Store enum value (1, 2, or 3)
            name: item.name,
            description: item.description,
            status: item.status || "Draft",
            isActive: item.isActive !== false,
            remarks: item.remarks,
            isFinalPrint: item.isFinalPrint,
            config: buildCrfDesignerConfigFromApi(item, crfStructure?.config),
            sections: crfStructure?.sections || [],
            rules: crfStructure?.rules || [],
            createdAt: item.createdAt,
            createdBy: (() => {
              // Try multiple possible field names and structures
              if (item.createdBy) {
                if (typeof item.createdBy === 'string') return item.createdBy
                if (item.createdBy.name) return item.createdBy.name
                if (item.createdBy.firstName && item.createdBy.lastName) {
                  return `${item.createdBy.firstName} ${item.createdBy.lastName}`.trim()
                }
                if (item.createdBy.firstName) return item.createdBy.firstName
                if (item.createdBy.fullName) return item.createdBy.fullName
              }
              if (item.createdByUser) {
                if (typeof item.createdByUser === 'string') return item.createdByUser
                if (item.createdByUser.name) return item.createdByUser.name
                if (item.createdByUser.firstName && item.createdByUser.lastName) {
                  return `${item.createdByUser.firstName} ${item.createdByUser.lastName}`.trim()
                }
                if (item.createdByUser.firstName) return item.createdByUser.firstName
              }
              if (item.createdByName) return item.createdByName
              if (item.createdByFullName) return item.createdByFullName
              return "—"
            })(),
            updatedAt: item.updatedAt
          }
        })

        setCrfs(transformedCrfs)
      } else {
        setLoadError(response?.message || "Unable to load CRF Designs.")
        setCrfs([])
        setTotalCount(0)
        setTotalPages(0)
      }
    } catch (error) {
      console.error("Error loading CRF Designs:", error)
      setLoadError(error?.message || "Unable to load CRF Designs.")
      setCrfs([])
      setTotalCount(0)
      setTotalPages(0)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
      previousStudyIdRef.current = studyId
    }
  }

  const handlePageChange = (newPage) => {
    setPageNumber(newPage)
    // Scroll to top of table
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize)
    setPageNumber(1) // Reset to first page when page size changes
  }

  const openDeactivateConfirm = (crf) => {
    setDeactivateConfirmCrf({ id: crf.id, name: crf.name || "this CRF Design" })
  }

  const handleExportBundle = async (crf) => {
    const crfStudyId = crf.studyId || studyId
    if (!crf?.id || !crfStudyId) {
      toast({
        title: "Export unavailable",
        description: "CRF study context is missing.",
        variant: "destructive",
      })
      return
    }
    try {
      setExportingBundleId(crf.id)
      const bundle = await crfDesignService.exportBundle(crf.id, crfStudyId, { includeRules: true })
      const fileName = `${crf.name || crf.config?.name || "crf"}-bundle-${Date.now()}.json`
      downloadBundleJson(bundle, fileName)
      const ruleCount = bundle?.meta?.ruleCount ?? bundle?.rules?.length ?? 0
      toast({
        title: "Bundle exported",
        description: ruleCount > 0
          ? `Downloaded CRF + ${ruleCount} rule${ruleCount === 1 ? "" : "s"}.`
          : "CRF bundle downloaded.",
      })
    } catch (error) {
      toast({
        title: "Export failed",
        description: error?.message || "Could not export CRF bundle.",
        variant: "destructive",
      })
    } finally {
      setExportingBundleId(null)
    }
  }

  const handleConfirmDeactivate = async () => {
    if (!deactivateConfirmCrf) return
    const crfId = deactivateConfirmCrf.id
    setDeactivateConfirmCrf(null)

    try {
      setDeactivatingCrf(crfId)
      const statusRequest = { IsActive: false }
      const response = await crfDesignService.updateCrfDesignStatus(crfId, statusRequest)

      if (response.isSuccess) {
        toast({
          title: "CRF deactivated",
          description: "This CRF is hidden from data entry but remains in the list.",
        })
        loadCRFs()
      } else {
        toast({
          title: "Deactivate failed",
          description: response.message || "Could not deactivate CRF design.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error deactivating CRF Design:", error)
      toast({
        title: "Deactivate failed",
        description: error.message || "Could not deactivate CRF design.",
        variant: "destructive",
      })
    } finally {
      setDeactivatingCrf(null)
    }
  }

  const openDeleteModal = async (crf) => {
    const crfStudyId = crf.studyId ?? studyId
    if (!crf?.id || crfStudyId == null) {
      toast({
        title: "Delete unavailable",
        description: "Study context is required to delete this CRF.",
        variant: "destructive",
      })
      return
    }

    setDeleteModalCrf({
      id: crf.id,
      name: crf.name || crf.config?.name || "this CRF Design",
      studyId: crfStudyId,
    })
    setDeleteConfirmName("")
    setDeleteEligibility(null)
    setDeleteEligibilityLoading(true)

    try {
      const eligibility = await crfDesignService.getDeleteEligibility(crf.id, crfStudyId)
      setDeleteEligibility(eligibility)
    } catch (error) {
      toast({
        title: "Could not check delete eligibility",
        description: error.message || "Try again or contact support.",
        variant: "destructive",
      })
      setDeleteModalCrf(null)
    } finally {
      setDeleteEligibilityLoading(false)
    }
  }

  const closeDeleteModal = () => {
    if (deletingCrf) return
    setDeleteModalCrf(null)
    setDeleteEligibility(null)
    setDeleteConfirmName("")
  }

  const handleConfirmDelete = async () => {
    if (!deleteModalCrf) return
    const canDelete = deleteEligibility?.canDelete ?? deleteEligibility?.CanDelete
    if (!canDelete) return
    const expectedName = (deleteEligibility.crfDesignName || deleteModalCrf.name || "").trim()
    if (deleteConfirmName.trim() !== expectedName) return

    try {
      setDeletingCrf(deleteModalCrf.id)
      await crfDesignService.deleteCrfDesign(deleteModalCrf.id, deleteModalCrf.studyId)
      toast({
        title: "CRF deleted",
        description: `"${expectedName}" was permanently removed from this study.`,
      })
      setDeleteModalCrf(null)
      setDeleteEligibility(null)
      setDeleteConfirmName("")
      loadCRFs()
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error.message || "Could not delete CRF design.",
        variant: "destructive",
      })
    } finally {
      setDeletingCrf(null)
    }
  }

  const getCrfFormTypeLabel = (crfFormType) => getCrfFormTypeDisplayLabel(crfFormType, "Unknown")

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      })
    } catch {
      return dateString
    }
  }

  return (
    <>
      <div className="w-full min-w-0 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <FileText className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Manage eCRF</h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
              View and manage your CRF designs
            </p>
          </div>
        </div>
        {onCreateNew && (
          <Button
            onClick={onCreateNew}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New CRF
          </Button>
        )}
      </div>

      {/* Filters Section - styled like reports filter card */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-emerald-600" />
              <h2 className="text-sm sm:text-lg font-bold text-slate-800">
                Filter Criteria
              </h2>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-5 items-end">
            {/* Study dropdown */}
            <div className="space-y-2">
              <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                Study
              </label>
              <Select
                value={studyId ? String(studyId) : "all"}
                onValueChange={(value) => {
                  const nextId = value === "all" ? null : parseInt(value, 10)
                  if (onStudyChange) {
                    onStudyChange(nextId)
                  }
                }}
                disabled={loadingStudies}
              >
                <SelectTrigger className="h-10 w-full border-2 border-slate-200 rounded-lg bg-white hover:bg-blue-50 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all px-3 shadow-sm">
                  <SelectValue
                    placeholder={loadingStudies ? "Loading studies..." : "All Studies"}
                  />
                </SelectTrigger>
                <SelectContent className="bg-white border-2 border-slate-200 rounded-lg shadow-lg">
                  {/* Search inside dropdown */}
                  <div className="p-2 border-b border-slate-200 sticky top-0 bg-white z-10">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <Input
                        type="text"
                        placeholder="Search studies..."
                        value={studySearch}
                        onChange={(e) => setStudySearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="pl-7 h-8 text-xs"
                      />
                    </div>
                  </div>
                  <SelectItem value="all" className="px-4 py-2 text-xs font-medium text-slate-900 cursor-pointer data-[highlighted]:bg-blue-50 data-[highlighted]:text-slate-900 data-[state=checked]:bg-emerald-50 data-[state=checked]:text-emerald-700">
                    All Studies
                  </SelectItem>
                  <div className="max-h-64 overflow-y-auto">
                    {studies
                      .filter((study) => {
                        if (!studySearch.trim()) return true
                        const searchLower = studySearch.toLowerCase()
                        const displayName = (
                          study.studyProtocolNumber ||
                          study.protocolNumber ||
                          study.name ||
                          study.studyName ||
                          (typeof study === "string" ? study : null) ||
                          `Study ${study.studyId || study.id}`
                        ).toLowerCase()
                        return displayName.includes(searchLower)
                      })
                      .map((study) => {
                        const id = study.studyId || study.id
                        const displayName =
                          study.studyProtocolNumber ||
                          study.protocolNumber ||
                          study.name ||
                          study.studyName ||
                          (typeof study === "string" ? study : null) ||
                          `Study ${id}`
                        return (
                          <SelectItem
                            key={id}
                            value={String(id)}
                            className="px-4 py-2 text-xs font-medium text-slate-900 cursor-pointer data-[highlighted]:bg-blue-50 data-[highlighted]:text-slate-900 data-[state=checked]:bg-emerald-50 data-[state=checked]:text-emerald-700"
                          >
                            {displayName}
                          </SelectItem>
                        )
                      })}
                  </div>
                </SelectContent>
              </Select>
            </div>

            {/* Search box */}
            <div className="space-y-2">
              <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search by name, description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 border-2 border-slate-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                Active status
              </label>
              <Select value={activeStatusFilter} onValueChange={setActiveStatusFilter}>
                <SelectTrigger className="h-10 w-full border-2 border-slate-200 rounded-lg bg-white hover:bg-blue-50 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all px-3 shadow-sm">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent className="bg-white border-2 border-slate-200 rounded-lg shadow-lg">
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active only</SelectItem>
                  <SelectItem value="inactive">Inactive only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clear Filters button in same row */}
            <div className="flex justify-start md:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={handleClearFilters}
                className="border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* CRF List Table - card style similar to reports */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-100 to-slate-50 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200">
          <h2 className="text-sm sm:text-lg font-bold text-slate-800">
            CRF Designs {totalCount > 0 && `(${totalCount} total)`}
          </h2>
        </div>

        {loading ? (
          <SectionSkeleton title="Loading CRFs..." rows={6} variant="studyReport" />
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <FileText className="w-16 h-16 text-red-200 mb-4" />
            <p className="text-slate-700 text-lg font-semibold mb-2">Unable to load CRFs</p>
            <p className="text-slate-500 text-sm mb-6">{loadError}</p>
            <Button onClick={loadCRFs} variant="outline" className="border-red-200 text-red-600 hover:bg-red-50">
              Retry
            </Button>
          </div>
        ) : crfs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <FileText className="w-16 h-16 text-slate-300 mb-4" />
            <p className="text-slate-600 text-lg font-medium mb-2">No CRFs found</p>
            <p className="text-slate-500 text-sm mb-6">
              {searchQuery ? "Try adjusting your search criteria" : "Create your first CRF design to get started"}
            </p>
            {onCreateNew && (
              <Button onClick={onCreateNew} variant="outline" className="border-emerald-200 text-emerald-600 hover:bg-emerald-50">
                <Plus className="w-4 h-4 mr-2" />
                Create Your First CRF
              </Button>
            )}
          </div>
        ) : (
          <div className="relative">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
              <thead className="bg-gradient-to-r from-slate-50 to-emerald-50/30 border-b-2 border-slate-200 sticky top-0 z-20 backdrop-blur-sm">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Study Protocol
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider hidden md:table-cell">
                    Description
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Form Type
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider hidden xl:table-cell">
                    Created
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider hidden lg:table-cell">
                    Created By
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {crfs.map((crf) => (
                  <tr 
                    key={crf.id}
                    onClick={() => onView && onView(crf)}
                    className="hover:bg-blue-50 cursor-pointer"
                  >
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-slate-400" />
                        <div className="text-sm font-medium text-slate-900">
                          {resolveStudyProtocolNumber(crf)}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-emerald-100 rounded-md flex-shrink-0">
                          <FileText className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 truncate max-w-[200px] sm:max-w-none">
                            {crf.config?.name || crf.name || "Unnamed CRF"}
                          </div>
                          {crf.config?.description && (
                            <div className="text-xs text-slate-500 truncate max-w-[200px] md:hidden mt-0.5">
                              {crf.config.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-slate-600 hidden md:table-cell">
                      <div className="max-w-xs truncate">
                        {crf.config?.description || crf.description || "—"}
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 w-fit">
                          {crf.status || "Draft"}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium w-fit ${
                          crf.isActive !== false
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-800"
                        }`}>
                          {crf.isActive !== false ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                        {getCrfFormTypeLabel(crf.crfFormType)}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-slate-500 hidden xl:table-cell">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatDate(crf.createdAt)}</span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-slate-600 hidden lg:table-cell">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="max-w-xs truncate">{crf.createdBy || "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {onView && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              onView(crf)
                            }}
                            className="h-8 w-8 p-0 border-slate-300 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700"
                            title="View CRF"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        )}
                        {onEdit && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              onEdit(crf)
                            }}
                            className="h-8 w-8 p-0 border-slate-300 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700"
                            title="Edit CRF"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                        {onPrintBlank && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              onPrintBlank(crf)
                            }}
                            className="h-8 w-8 p-0 border-slate-300 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700"
                            title="Download annotated blank CRF PDF"
                          >
                            <Printer className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={exportingBundleId === crf.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleExportBundle(crf)
                          }}
                          className="h-8 w-8 p-0 border-slate-300 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700"
                          title="Export CRF bundle (structure + rules) for UAT → PROD"
                        >
                          {exportingBundleId === crf.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            openDeactivateConfirm(crf)
                          }}
                          className="h-8 w-8 p-0 text-amber-700 border-amber-200 hover:bg-amber-50 hover:border-amber-300"
                          title="Deactivate CRF (hide from data entry)"
                        >
                          <PowerOff className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            openDeleteModal(crf)
                          }}
                          className="h-8 w-8 p-0 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                          title="Permanently delete CRF"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            {isRefreshing && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
                <div className="flex items-center gap-2 text-slate-600 text-sm">
                  <span>Updating</span>
                  <LoadingDots size="sm" />
                </div>
              </div>
            )}
          </div>
        )}

          {/* Pagination */}
          {!loading && crfs.length > 0 && totalPages > 0 && (
            <div className="px-4 sm:px-6 py-3 border-t border-slate-200 bg-slate-50/60">
              <DataPagination
                currentPage={pageNumber}
                pageSize={pageSize}
                totalPages={totalPages}
                totalCount={totalCount}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                itemName="CRFs"
                showPageSizeSelector={true}
                pageSizeOptions={[10, 25, 50, 100]}
              />
            </div>
          )}
        </div>
      </div>

      {deactivateConfirmCrf && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-amber-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-amber-600 px-6 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <PowerOff className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-bold text-white">Deactivate CRF Design</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-700">
                Deactivate <span className="font-semibold text-slate-900">"{deactivateConfirmCrf.name}"</span>?
              </p>
              <p className="text-sm text-slate-500">
                The CRF will be hidden from eCRF data entry but remains in this list. You can re-activate it later from study configuration if needed.
              </p>
              <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setDeactivateConfirmCrf(null)}
                  className="px-5 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeactivate}
                  disabled={deactivatingCrf === deactivateConfirmCrf.id}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 text-white font-semibold hover:bg-amber-700 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {deactivatingCrf === deactivateConfirmCrf.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deactivating...
                    </>
                  ) : (
                    "Deactivate"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteModalCrf && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-red-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-bold text-white">Permanently delete CRF</h3>
            </div>
            <div className="p-6 space-y-4" role="dialog" aria-labelledby="delete-crf-title">
              {deleteEligibilityLoading ? (
                <div className="space-y-3" role="status" aria-busy="true" aria-label="Checking delete eligibility">
                  <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" />
                  <div className="h-4 bg-slate-100 rounded animate-pulse w-full" />
                  <div className="h-10 bg-slate-100 rounded animate-pulse w-full" />
                </div>
              ) : (
                <>
                  <p className="text-slate-700">
                    Delete <span className="font-semibold text-slate-900">"{deleteModalCrf.name}"</span> from this study?
                  </p>

                  {!(deleteEligibility?.canDelete ?? deleteEligibility?.CanDelete) ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                      <div className="flex items-start gap-2 text-amber-900">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                        <p className="text-sm font-semibold">This CRF cannot be deleted</p>
                      </div>
                      <ul className="text-sm text-amber-900/90 list-disc pl-5 space-y-1">
                        {(deleteEligibility?.blockers || deleteEligibility?.Blockers || []).map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                      {(deleteEligibility?.patientDataCount ?? deleteEligibility?.PatientDataCount ?? 0) > 0 && (
                        <p className="text-xs text-amber-800 pt-1">
                          Patient data entries: {deleteEligibility?.patientDataCount ?? deleteEligibility?.PatientDataCount}
                        </p>
                      )}
                      <p className="text-xs text-amber-800">
                        Use <strong>Deactivate</strong> instead to hide this CRF from data entry.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 space-y-1">
                        <p>This permanently removes the CRF design, its rules, and SDTM field mappings from the study.</p>
                        {(deleteEligibility?.ruleCount ?? deleteEligibility?.RuleCount ?? 0) > 0 && (
                          <p>{deleteEligibility?.ruleCount ?? deleteEligibility?.RuleCount} rule(s) will be removed.</p>
                        )}
                        <p className="text-xs text-slate-500">Patient data and audit history are preserved when entries already exist — delete is only allowed when none exist.</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">
                          Type <span className="font-semibold">{deleteEligibility?.crfDesignName || deleteEligibility?.CrfDesignName || deleteModalCrf.name}</span> to confirm
                        </label>
                        <Input
                          value={deleteConfirmName}
                          onChange={(e) => setDeleteConfirmName(e.target.value)}
                          placeholder="CRF name"
                          className="h-10 border-2 border-slate-200"
                          autoComplete="off"
                        />
                      </div>
                    </>
                  )}
                </>
              )}

              <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  disabled={Boolean(deletingCrf)}
                  className="px-5 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={
                    deleteEligibilityLoading ||
                    deletingCrf === deleteModalCrf.id ||
                    !(deleteEligibility?.canDelete ?? deleteEligibility?.CanDelete) ||
                    deleteConfirmName.trim() !== (deleteEligibility?.crfDesignName || deleteEligibility?.CrfDesignName || deleteModalCrf.name || "").trim()
                  }
                  className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                >
                  {deletingCrf === deleteModalCrf.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete permanently"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default CRFList

