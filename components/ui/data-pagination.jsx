"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Reusable Pagination Component
 * 
 * This component provides a complete pagination solution that can be used across
 * the entire application wherever data listings are displayed.
 * 
 
 * @param {Object} props
 * @param {number} props.currentPage - Current page number (1-indexed)
 * @param {number} props.pageSize - Number of items per page
 * @param {number} props.totalPages - Total number of pages
 * @param {number} props.totalCount - Total number of items
 * @param {Function} props.onPageChange - Callback when page changes: (pageNumber) => void
 * @param {Function} [props.onPageSizeChange] - Optional callback when page size changes: (pageSize) => void
 * @param {string} [props.itemName] - Name of items being paginated (e.g., "studies", "users") - defaults to "items"
 * @param {boolean} [props.showPageSizeSelector] - Whether to show page size selector (default: false)
 * @param {number[]} [props.pageSizeOptions] - Array of page size options (default: [10, 25, 50, 100])
 * @param {string} [props.className] - Additional CSS classes
 */
export default function DataPagination({
  currentPage,
  pageSize,
  totalPages,
  totalCount,
  onPageChange,
  onPageSizeChange,
  itemName = "items",
  showPageSizeSelector = false,
  pageSizeOptions = [10, 25, 50, 100],
  className = "",
}) {
  const safePageSize = Math.max(1, Math.floor(Number(pageSize)) || 10)
  const safeTotalPages = Math.max(0, Math.floor(Number(totalPages)) || 0)
  const safeTotalCount = Math.max(0, Math.floor(Number(totalCount)) || 0)
  const safeCurrentPage = Math.min(
    Math.max(1, Math.floor(Number(currentPage)) || 1),
    Math.max(1, safeTotalPages),
  )

  // Calculate display range
  const startItem = safeTotalCount === 0 ? 0 : (safeCurrentPage - 1) * safePageSize + 1
  const endItem = Math.min(safeCurrentPage * safePageSize, safeTotalCount)

  // Generate page numbers to display (max 5 pages)
  const getPageNumbers = () => {
    if (safeTotalPages <= 5) {
      return Array.from({ length: safeTotalPages }, (_, i) => i + 1)
    }

    if (safeCurrentPage <= 3) {
      return [1, 2, 3, 4, 5]
    }

    if (safeCurrentPage >= safeTotalPages - 2) {
      return [
        safeTotalPages - 4,
        safeTotalPages - 3,
        safeTotalPages - 2,
        safeTotalPages - 1,
        safeTotalPages,
      ]
    }

    return [
      safeCurrentPage - 2,
      safeCurrentPage - 1,
      safeCurrentPage,
      safeCurrentPage + 1,
      safeCurrentPage + 2,
    ]
  }

  const pageNumbers = getPageNumbers()

  if (safeTotalPages === 0) {
    return null
  }

  return (
    <div className={`bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}>
      {/* Page Info */}
      <div className="text-sm text-slate-600">
        Showing <span className="font-semibold text-slate-900">{startItem}</span> to{" "}
        <span className="font-semibold text-slate-900">{endItem}</span> of{" "}
        <span className="font-semibold text-slate-900">{safeTotalCount}</span> {itemName}
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center gap-2 flex-wrap justify-center">
        {/* Page Size Selector */}
        {showPageSizeSelector && onPageSizeChange && (
          <div className="flex items-center gap-2 mr-2">
            <label className="text-sm font-semibold text-slate-700 whitespace-nowrap">Per Page:</label>
            <select
              value={safePageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value))
                onPageChange(1) // Reset to first page when page size changes
              }}
              className="px-3 py-2 rounded-lg border-2 border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all appearance-none bg-white text-sm font-medium text-slate-700 hover:border-slate-400"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* First Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={safeCurrentPage === 1}
          className="px-3 py-2"
          title="First page"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </Button>

        {/* Previous Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))}
          disabled={safeCurrentPage === 1}
          className="px-3 py-2"
          title="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        {/* Page Numbers */}
        <div className="flex items-center gap-1">
          {pageNumbers.map((pageNum) => (
            <Button
              key={pageNum}
              variant={safeCurrentPage === pageNum ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(pageNum)}
              className={`px-3 py-2 min-w-[2.5rem] ${safeCurrentPage === pageNum
                ? "bg-gradient-to-r btn-brand-gradient text-white border-blue-600 "
                : ""
                }`}
            >
              {pageNum}
            </Button>
          ))}
        </div>

        {/* Next Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(safeTotalPages, safeCurrentPage + 1))}
          disabled={safeCurrentPage === safeTotalPages}
          className="px-3 py-2"
          title="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>

        {/* Last Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(safeTotalPages)}
          disabled={safeCurrentPage === safeTotalPages}
          className="px-3 py-2"
          title="Last page"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </Button>
      </div>
    </div>
  )
}

