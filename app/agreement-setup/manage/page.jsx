"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import DataPagination from "@/components/ui/data-pagination"
import SectionSkeleton from "@/components/ui/section-skeleton"
import { agreementService } from "@/lib/services"
import { stashAgreementEditPrefill } from "@/lib/utils/agreementEditPrefill"
import {
  X,
  FileText,
  Edit,
  Trash2,
  Loader2,
  Search,
  Plus,
} from "lucide-react"

export default function AgreementManagePage() {
  const router = useRouter()
  const [agreements, setAgreements] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loadingAgreements, setLoadingAgreements] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const hasLoadedOnceRef = useRef(false)
  const [deletingAgreement, setDeletingAgreement] = useState(null)
  const [deleteConfirmAgreement, setDeleteConfirmAgreement] = useState(null) // { id, name }
  const [updatingStatus, setUpdatingStatus] = useState({})
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const formatDateForDisplay = (dateString) => {
    if (!dateString) return "N/A"
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return "N/A"
      const day = String(date.getDate()).padStart(2, "0")
      const month = String(date.getMonth() + 1).padStart(2, "0")
      const year = date.getFullYear()
      return `${day}-${month}-${year}`
    } catch {
      return "N/A"
    }
  }

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const handlePageSizeChange = useCallback((newPageSize) => {
    setPageSize(newPageSize)
    setPageNumber(1)
  }, [])

  useEffect(() => {
    setPageNumber(1)
  }, [debouncedSearchTerm])

  const fetchAgreements = useCallback(async () => {
    const isInitialLoad = !hasLoadedOnceRef.current
    try {
      if (isInitialLoad) {
        setLoadingAgreements(true)
      } else {
        setIsRefreshing(true)
      }
      setError("")
      const response = await agreementService.getAgreementsList(
        pageNumber,
        pageSize,
        debouncedSearchTerm || null,
        null,
        null
      )
      if (response.isSuccess && response.data) {
        setAgreements(response.data.items || [])
        setTotalCount(response.data.totalCount || 0)
        setTotalPages(response.data.totalPages || 0)
      } else {
        setError(response.message || "Failed to fetch agreements")
        setAgreements([])
        setTotalCount(0)
        setTotalPages(0)
      }
    } catch (err) {
      setError(err.message || "Failed to fetch agreements")
      setAgreements([])
      setTotalCount(0)
      setTotalPages(0)
    } finally {
      hasLoadedOnceRef.current = true
      setLoadingAgreements(false)
      setIsRefreshing(false)
    }
  }, [pageNumber, pageSize, debouncedSearchTerm])

  useEffect(() => {
    fetchAgreements()
  }, [fetchAgreements])

  const handleEditAgreement = (agreement) => {
    stashAgreementEditPrefill(agreement)
    router.push(`/agreement-setup/create?id=${agreement.id}`)
  }

  const handleDeleteAgreement = (id, name) => {
    setDeleteConfirmAgreement({ id, name: name || "this agreement" })
  }

  const handleConfirmDeleteAgreement = async () => {
    if (!deleteConfirmAgreement) return
    const { id, name } = deleteConfirmAgreement
    setDeleteConfirmAgreement(null)
    try {
      setDeletingAgreement(id)
      setError("")
      const response = await agreementService.deleteAgreement(id)
      if (response.isSuccess) {
        setSuccess(`Agreement "${name}" deleted successfully!`)
        setTimeout(() => setSuccess(""), 3000)
        fetchAgreements()
      } else {
        setError(response.message || "Failed to delete agreement. Please try again.")
        setTimeout(() => setError(""), 3000)
      }
    } catch (err) {
      setError(err.message || "Failed to delete agreement. Please try again.")
      setTimeout(() => setError(""), 3000)
    } finally {
      setDeletingAgreement(null)
    }
  }

  const handleToggleStatus = async (agreementId, currentStatus) => {
    if (updatingStatus[agreementId]) return
    try {
      setUpdatingStatus((prev) => ({ ...prev, [agreementId]: true }))
      const newStatus = !currentStatus
      setAgreements((prev) =>
        prev.map((item) =>
          item.id === agreementId ? { ...item, isActive: newStatus } : item
        )
      )
      await new Promise((resolve) => setTimeout(resolve, 300))
      setSuccess(`Agreement status updated to ${newStatus ? "Active" : "Inactive"}`)
      setTimeout(() => setSuccess(""), 3000)
    } catch (err) {
      setAgreements((prev) =>
        prev.map((item) =>
          item.id === agreementId ? { ...item, isActive: currentStatus } : item
        )
      )
      setError(err.message || "Failed to update agreement status. Please try again.")
      setTimeout(() => setError(""), 3000)
    } finally {
      setUpdatingStatus((prev) => ({ ...prev, [agreementId]: false }))
    }
  }

  const handleCreateNew = () => {
    router.push("/agreement-setup/create")
  }

  const handleClearFilters = () => {
    setSearchTerm("")
    setDebouncedSearchTerm("")
    setPageNumber(1)
  }

  return (
    <DashboardLayout>
      <div className="w-full p-4 sm:p-6 space-y-6">
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

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <FileText className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Manage Agreements
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                View and manage sponsor agreements
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCreateNew}
            className="px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold text-sm shadow-md hover:bg-emerald-700 transition-colors inline-flex items-center gap-2 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Create New Agreement
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-emerald-600" />
                <h2 className="text-sm sm:text-lg font-bold text-slate-800">
                  Filter Criteria
                </h2>
              </div>
              {searchTerm && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                  Clear Filters
                </button>
              )}
            </div>
          </div>
          <div className="p-4 sm:p-6">
            <div className="space-y-2">
              <label className="flex items-center gap-1 text-sm font-bold text-slate-700">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-lg border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                  placeholder="Search agreements by company name..."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/60 bg-white/80 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] backdrop-blur-xl">
          {isRefreshing && (
            <div className="absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden bg-emerald-100">
              <div className="agreement-refresh-bar h-full w-1/3 rounded-full bg-emerald-500" />
            </div>
          )}

          {loadingAgreements && !hasLoadedOnceRef.current ? (
            <SectionSkeleton title="Loading agreements..." rows={6} variant="agreements" />
          ) : agreements.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <FileText className="mx-auto mb-4 h-14 w-14 text-slate-300" />
              <p className="font-medium text-slate-600">No agreements found</p>
              <p className="mt-1 text-sm text-slate-500">
                {searchTerm ? "Try a different search term." : "Create your first agreement to get started."}
              </p>
            </div>
          ) : (
            <>
            <div className={`bg-gradient-to-r from-slate-100/90 to-slate-50/90 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200/80 transition-opacity duration-200 ${isRefreshing ? "opacity-70" : ""}`}>
              <h2 className="text-sm sm:text-lg font-bold text-slate-800">
                Agreements {totalCount > 0 && `(${totalCount} total)`}
              </h2>
            </div>
            <div className={`overflow-x-auto transition-opacity duration-200 ${isRefreshing ? "opacity-70" : ""}`}>
              <table className="w-full">
                <thead className="bg-slate-50 border-b-2 border-slate-200">
                  <tr>
                    <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Study
                    </th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      COMPANY NAME
                    </th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      TAGLINE
                    </th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      CREATED DATE
                    </th>
                    <th className="px-4 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">
                      STATUS
                    </th>
                    <th className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                      ACTION
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {agreements.map((agreement) => {
                    const isActive =
                      agreement.isActive !== undefined ? agreement.isActive : true
                    return (
                      <tr
                        key={agreement.id}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                              <FileText className="w-4 h-4 text-white" />
                            </div>
                            <div className="text-sm font-semibold text-slate-900">
                              {agreement.guid}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-slate-900">
                            {agreement.studyProtocolNumber}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-slate-900">
                            {agreement.companyName}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-600">
                            {agreement.tagline || "N/A"}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-600">
                            {formatDateForDisplay(agreement.createdAt)}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleToggleStatus(agreement.id, isActive)
                              }}
                              disabled={updatingStatus[agreement.id]}
                              className={`relative inline-flex h-8 w-16 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer ${
                                isActive
                                  ? "bg-blue-600 hover:bg-blue-700"
                                  : "bg-slate-300 hover:bg-slate-400"
                              }`}
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
                              type="button"
                              onClick={() => handleEditAgreement(agreement)}
                              className="px-3 py-1.5 rounded-lg bg-teal-100 text-teal-700 hover:bg-teal-200 transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer"
                              title="Edit agreement"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteAgreement(agreement.id, agreement.companyName)
                              }
                              disabled={deletingAgreement === agreement.id}
                              className="px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Delete agreement"
                            >
                              {deletingAgreement === agreement.id ? (
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
            {agreements.length > 0 && totalPages > 0 && (
              <div className="border-t border-slate-200/80 bg-slate-50/60 px-4 py-3 sm:px-6">
                <DataPagination
                  currentPage={pageNumber}
                  pageSize={pageSize}
                  totalPages={totalPages}
                  totalCount={totalCount}
                  onPageChange={setPageNumber}
                  onPageSizeChange={handlePageSizeChange}
                  itemName="agreements"
                  showPageSizeSelector={true}
                />
              </div>
            )}
            </>
          )}
        </div>

        {deleteConfirmAgreement && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-red-200 overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white">Delete Agreement</h3>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-slate-700">
                  Are you sure you want to delete the agreement for{" "}
                  <span className="font-semibold text-slate-900">
                    "{deleteConfirmAgreement.name}"
                  </span>
                  ?
                </p>
                <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmAgreement(null)}
                    className="px-5 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeleteAgreement}
                    disabled={deletingAgreement === deleteConfirmAgreement.id}
                    className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                  >
                    {deletingAgreement === deleteConfirmAgreement.id ? (
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

