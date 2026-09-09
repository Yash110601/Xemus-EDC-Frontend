"use client"

/**
 * Standard report filter dropdown (Patient Details Report pattern).
 * Sticky search header + max-h scroll list + shared Select classes from studySitePatientReportUi.
 */

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  REPORT_FILTER_FIELD_CLASS,
  REPORT_SELECT_CONTENT_CLASS,
  REPORT_SELECT_ITEM_CLASS,
  REPORT_SELECT_SCROLL_LIST_CLASS,
  REPORT_SELECT_SEARCH_INPUT_CLASS,
  REPORT_SELECT_TRIGGER_CLASS,
} from "@/lib/reports/studySitePatientReportUi"

const selectTriggerClass = cn(REPORT_SELECT_TRIGGER_CLASS, "!w-full min-w-0 max-w-full")

export default function ReportFilterSelect({
  label,
  required = false,
  value,
  onValueChange,
  disabled = false,
  placeholder = "Select",
  showSearch = true,
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Search...",
  allOptionLabel = null,
  showRequiredError = false,
  requiredErrorMessage = "Study is required.",
  triggerClassName,
  children,
}) {
  const resolvedValue =
    value && String(value).trim() !== "" ? String(value) : allOptionLabel ? "all" : undefined

  return (
    <div className={REPORT_FILTER_FIELD_CLASS}>
      {label ? (
        <label className="text-sm font-bold text-slate-700">
          {label} {required ? <span className="text-red-600">*</span> : null}
        </label>
      ) : null}
      <Select
        value={resolvedValue}
        onValueChange={(v) => onValueChange(v === "all" ? "" : v)}
        disabled={disabled}
      >
        <SelectTrigger
          className={cn(
            selectTriggerClass,
            triggerClassName,
            required && !value && "border-red-300 focus:border-red-500 focus:ring-red-100",
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className={REPORT_SELECT_CONTENT_CLASS}>
          {showSearch ? (
            <div className="p-3 border-b border-slate-200 sticky top-0 bg-white z-10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchValue}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  className={REPORT_SELECT_SEARCH_INPUT_CLASS}
                />
              </div>
            </div>
          ) : null}
          <div className={REPORT_SELECT_SCROLL_LIST_CLASS}>
            {allOptionLabel ? (
              <SelectItem value="all" className={REPORT_SELECT_ITEM_CLASS}>
                {allOptionLabel}
              </SelectItem>
            ) : null}
            {children}
          </div>
        </SelectContent>
      </Select>
      {showRequiredError && required && !value ? (
        <p className="text-xs text-red-600 font-medium">{requiredErrorMessage}</p>
      ) : null}
    </div>
  )
}
