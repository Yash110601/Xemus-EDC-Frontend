"use client"

import { useState, useMemo, useEffect } from "react"
import { ChevronDown, ChevronUp, ArrowUpDown, Search, ChevronLeft, ChevronRight } from "lucide-react"

export default function PivotTable({ 
  data = [], 
  columns = [], 
  rows = [], 
  values = [],
  itemsPerPage = 10,
  enablePagination = true,
  enableSearch = true,
  maxRows = 1000 // Limit for client-side processing
}) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [expandedRows, setExpandedRows] = useState(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [searchTerm, setSearchTerm] = useState("")

  // Generate pivot data
  const pivotData = useMemo(() => {
    if (!data || data.length === 0) return []

    const grouped = {}
    
    data.forEach((item) => {
      const rowKey = rows.map(r => item[r] || 'N/A').join('|')
      const colKey = columns.map(c => item[c] || 'N/A').join('|')
      
      if (!grouped[rowKey]) {
        grouped[rowKey] = {}
      }
      
      if (!grouped[rowKey][colKey]) {
        grouped[rowKey][colKey] = { count: 0, values: [] }
      }
      
      grouped[rowKey][colKey].count++
      values.forEach(v => {
        if (item[v] !== undefined && item[v] !== null) {
          grouped[rowKey][colKey].values.push(parseFloat(item[v]) || 0)
        }
      })
    })

    // Convert to array format
    return Object.entries(grouped).map(([rowKey, cols]) => {
      const rowValues = rowKey.split('|')
      const result = {
        _rowKey: rowKey,
        _rowValues: rowValues,
        ...cols
      }
      return result
    })
  }, [data, columns, rows, values])

  // Get unique column keys
  const columnKeys = useMemo(() => {
    const keys = new Set()
    pivotData.forEach(row => {
      Object.keys(row).forEach(key => {
        if (!key.startsWith('_')) {
          keys.add(key)
        }
      })
    })
    return Array.from(keys)
  }, [pivotData])

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const sortedData = useMemo(() => {
    let result = [...pivotData]
    
    // Apply sorting
    if (sortConfig.key) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key]?.count || 0
        const bVal = b[sortConfig.key]?.count || 0
        
        if (sortConfig.direction === 'asc') {
          return aVal - bVal
        }
        return bVal - aVal
      })
    }
    
    // Apply search filter
    if (searchTerm && searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase().trim()
      result = result.filter(row => {
        return row._rowValues.some(val => 
          String(val).toLowerCase().includes(term)
        )
      })
    }
    
    return result
  }, [pivotData, sortConfig, searchTerm])

  // Pagination
  const totalPages = Math.ceil(sortedData.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedData = enablePagination 
    ? sortedData.slice(startIndex, endIndex)
    : sortedData

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  const toggleRow = (rowKey) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(rowKey)) {
        newSet.delete(rowKey)
      } else {
        newSet.add(rowKey)
      }
      return newSet
    })
  }

  const calculateTotal = (colKey) => {
    return pivotData.reduce((sum, row) => {
      return sum + (row[colKey]?.count || 0)
    }, 0)
  }

  const calculateGrandTotal = () => {
    return columnKeys.reduce((sum, colKey) => sum + calculateTotal(colKey), 0)
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <p>No data available for pivot table</p>
      </div>
    )
  }

  // Warn if data exceeds recommended limit
  const dataCount = data.length
  const showWarning = dataCount > maxRows

  return (
    <div className="space-y-4">
      {/* Search and Info Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {enableSearch && (
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search studies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        )}
        
        <div className="flex items-center gap-4 text-sm text-slate-600">
          {showWarning && (
            <span className="text-amber-600 font-medium">
              ⚠️ Large dataset ({dataCount.toLocaleString()} records) - Consider server-side filtering
            </span>
          )}
          <span className="font-medium">
            Showing {paginatedData.length} of {sortedData.length} results
            {enablePagination && ` (Page ${currentPage} of ${totalPages})`}
          </span>
        </div>
      </div>

      {/* Pagination Controls */}
      {enablePagination && totalPages > 1 && (
        <div className="flex items-center justify-between bg-slate-50 px-4 py-2 rounded-lg">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-1 px-3 py-1 rounded hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>
          
          <div className="flex items-center gap-2">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum
              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (currentPage <= 3) {
                pageNum = i + 1
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = currentPage - 2 + i
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-3 py-1 rounded transition-colors ${
                    currentPage === pageNum
                      ? 'bg-violet-600 text-white font-semibold'
                      : 'hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {pageNum}
                </button>
              )
            })}
          </div>
          
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1 px-3 py-1 rounded hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
      <table className="w-full border-collapse bg-white rounded-lg shadow-sm">
        <thead className="bg-gradient-to-r from-emerald-50 to-teal-50">
          <tr>
            {rows.map((row, idx) => (
              <th
                key={idx}
                className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 sticky left-0 bg-gradient-to-r from-emerald-50 to-teal-50 z-10"
              >
                {row}
              </th>
            ))}
            {columnKeys.map((colKey) => (
              <th
                key={colKey}
                className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 cursor-pointer hover:bg-emerald-100 transition-colors"
                onClick={() => handleSort(colKey)}
              >
                <div className="flex items-center justify-center gap-1">
                  {colKey}
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
            ))}
            <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 bg-slate-100">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {paginatedData.map((row, rowIdx) => {
            const rowTotal = columnKeys.reduce((sum, colKey) => sum + (row[colKey]?.count || 0), 0)
            const isExpanded = expandedRows.has(row._rowKey)
            
            return (
              <tr
                key={rowIdx}
                className="hover:bg-slate-50 transition-colors"
              >
                {row._rowValues.map((val, idx) => (
                  <td
                    key={idx}
                    className="px-4 py-3 text-sm text-slate-700 border-r border-slate-100 sticky left-0 bg-white z-5"
                  >
                    {idx === 0 && rows.length > 1 && (
                      <button
                        onClick={() => toggleRow(row._rowKey)}
                        className="mr-2 text-slate-400 hover:text-slate-600"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronUp className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    {val}
                  </td>
                ))}
                {columnKeys.map((colKey) => (
                  <td
                    key={colKey}
                    className="px-4 py-3 text-sm text-center text-slate-700 border-r border-slate-100"
                  >
                    {row[colKey]?.count || 0}
                  </td>
                ))}
                <td className="px-4 py-3 text-sm text-center font-semibold text-slate-900 bg-slate-50">
                  {rowTotal}
                </td>
              </tr>
            )
          })}
          <tr className="bg-gradient-to-r from-emerald-50 to-teal-50 font-bold">
            <td
              colSpan={rows.length}
              className="px-4 py-3 text-sm text-slate-900 border-r border-slate-200"
            >
              Grand Total
            </td>
            {columnKeys.map((colKey) => (
              <td
                key={colKey}
                className="px-4 py-3 text-sm text-center text-slate-900 border-r border-slate-200"
              >
                {calculateTotal(colKey)}
              </td>
            ))}
            <td className="px-4 py-3 text-sm text-center text-slate-900 bg-emerald-100">
              {calculateGrandTotal()}
            </td>
          </tr>
        </tbody>
      </table>
      </div>

      {/* Bottom Pagination */}
      {enablePagination && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="px-3 py-1 rounded hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            First
          </button>
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-1 px-3 py-1 rounded hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            Prev
          </button>
          <span className="px-4 py-1 text-sm text-slate-600">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1 px-3 py-1 rounded hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 rounded hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            Last
          </button>
        </div>
      )}
    </div>
  )
}

