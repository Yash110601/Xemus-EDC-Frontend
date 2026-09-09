"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import SectionSkeleton from "@/components/ui/section-skeleton"
import { Eye, Edit, MoreVertical, ChevronDown, ChevronUp, Settings, ArrowUpDown, X, Search, FileText } from "lucide-react"

const RuleList = () => {
  const [rules, setRules] = useState([])
  const [searchQuery, setSearchQuery] = useState("")
  const [filters, setFilters] = useState({
    ruleName: "",
    ruleCategory: "",
    ruleMessage: "",
    versionNo: "",
    applyToAllSite: "",
    applyToSimilarActivity: "",
    similarActivityType: "",
    ruleStatus: "",
    performedBy: "",
  })
  const [expandedRows, setExpandedRows] = useState({})
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const columns = [
    { key: "action", label: "ACTION", filterable: false },
    { key: "ruleName", label: "RULE NAME", filterable: true },
    { key: "ruleCategory", label: "RULE CATEGORY", filterable: true },
    { key: "ruleMessage", label: "RULE MESSAGE", filterable: true },
    { key: "versionNo", label: "VERSION NO.", filterable: true },
    { key: "applyToAllSite", label: "APPLY TO ALL SITE", filterable: true },
    { key: "applyToSimilarActivity", label: "APPLY TO SIMILAR ACTIVITY", filterable: true },
    { key: "similarActivityType", label: "SIMILAR ACTIVITY TYPE", filterable: true },
    { key: "ruleStatus", label: "RULE STATUS", filterable: true },
    { key: "performedBy", label: "PERFORMED BY", filterable: true },
    { key: "performedOn", label: "PERFORMED ON", filterable: true },
  ]

  const filteredRules = rules.filter((rule) => {
    if (searchQuery) {
      const search = searchQuery.toLowerCase()
      return (
        rule.ruleName?.toLowerCase().includes(search) ||
        rule.ruleCategory?.toLowerCase().includes(search) ||
        rule.ruleMessage?.toLowerCase().includes(search) ||
        rule.performedBy?.toLowerCase().includes(search)
      )
    }

    // Apply column filters
    return Object.entries(filters).every(([key, value]) => {
      if (!value) return true
      const ruleValue = String(rule[key] || "").toLowerCase()
      return ruleValue.includes(value.toLowerCase())
    })
  })

  const toggleRow = (ruleId) => {
    setExpandedRows((prev) => ({
      ...prev,
      [ruleId]: !prev[ruleId],
    }))
  }

  return (
    <div className="h-full flex flex-col p-6 overflow-y-auto">
      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 outline-none transition-all bg-white text-slate-800 placeholder:text-slate-400"
            placeholder="Search by rule name, category, message, performed by..."
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
            Showing {filteredRules.length} result{filteredRules.length !== 1 ? "s" : ""} for "{searchQuery}"
          </p>
        )}
      </div>

      {/* Loading State */}
      {loading ? (
        <SectionSkeleton title="Loading rules..." rows={6} variant="permissions" />
      ) : filteredRules.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600 font-medium">
              {searchQuery ? "No rules found matching your search" : "No rules found"}
            </p>
            <p className="text-slate-500 text-sm mt-1">
              {searchQuery ? "Try a different search term" : "Create a new rule to get started"}
            </p>
          </div>
        </div>
      ) : (
        /* Rules Management Table */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-b-2 border-slate-200 sticky top-0">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className="px-4 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
                {/* Filter Row */}
                <tr className="bg-white border-b border-slate-200">
                  {columns.map((col) => (
                    <th key={`filter-${col.key}`} className="px-4 py-2">
                      {col.filterable ? (
                        <input
                          type="text"
                          placeholder="Search"
                          value={filters[col.key] || ""}
                          onChange={(e) =>
                            setFilters((prev) => ({ ...prev, [col.key]: e.target.value }))
                          }
                          className="w-full px-2 py-1.5 text-xs rounded border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
                        />
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredRules.map((rule) => (
                  <>
                    <tr key={rule.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                            title="More options"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {rule.hasVersions && (
                            <button
                              onClick={() => toggleRow(rule.id)}
                              className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                              title="View versions"
                            >
                              {expandedRows[rule.id] ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors">
                          {rule.ruleName || "N/A"}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
                          {rule.ruleCategory || "N/A"}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm text-slate-700 max-w-xs truncate" title={rule.ruleMessage}>
                          {rule.ruleMessage || "N/A"}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-900">{rule.versionNo || "N/A"}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-900">{rule.applyToAllSite || "N/A"}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-900">{rule.applyToSimilarActivity || "N/A"}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-900">{rule.similarActivityType || "N/A"}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-lg ${
                            rule.ruleStatus === "Published"
                              ? "bg-green-50 text-green-700 border border-green-100"
                              : "bg-yellow-50 text-yellow-700 border border-yellow-100"
                          }`}
                        >
                          {rule.ruleStatus || "Draft"}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-900">{rule.performedBy || "N/A"}</div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-900">{rule.performedOn || "N/A"}</div>
                      </td>
                    </tr>
                    {expandedRows[rule.id] && rule.versions && rule.versions.length > 0 && (
                      <tr>
                        <td colSpan={columns.length} className="px-0 py-0 bg-slate-50">
                          <div className="p-4">
                            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                              <table className="w-full">
                                <thead className="bg-slate-100 border-b border-slate-200">
                                  <tr>
                                    {columns.slice(1).map((col) => (
                                      <th
                                        key={col.key}
                                        className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider"
                                      >
                                        {col.label}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {rule.versions.map((version) => (
                                    <tr key={version.id} className="hover:bg-slate-50 transition-colors">
                                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                                        {version.ruleName || "N/A"}
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
                                          {version.ruleCategory || "N/A"}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="text-sm text-slate-700 max-w-xs truncate">
                                          {version.ruleMessage || "N/A"}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 text-sm text-slate-900">
                                        {version.versionNo || "N/A"}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-slate-900">
                                        {version.applyToAllSite || "N/A"}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-slate-900">
                                        {version.applyToSimilarActivity || "N/A"}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-slate-900">
                                        {version.similarActivityType || "N/A"}
                                      </td>
                                      <td className="px-4 py-3">
                                        <span
                                          className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-lg ${
                                            version.ruleStatus === "Published"
                                              ? "bg-green-50 text-green-700 border border-green-100"
                                              : "bg-yellow-50 text-yellow-700 border border-yellow-100"
                                          }`}
                                        >
                                          {version.ruleStatus || "Draft"}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-sm text-slate-900">
                                        {version.performedBy || "N/A"}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-slate-900">
                                        {version.performedOn || "N/A"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer with Publish and Pagination */}
          <div className="flex items-center justify-between p-4 border-t border-slate-200 bg-slate-50">
            <Button className="bg-gradient-to-r btn-brand-gradient ">
              Publish
            </Button>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-600">
                Showing {filteredRules.length} of {rules.length} rules
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => prev - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-slate-600 px-2">Page {currentPage}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={filteredRules.length <= 10}
                  onClick={() => setCurrentPage((prev) => prev + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RuleList

