"use client"

import { useState, useEffect } from "react"
import { useDroppable } from "@dnd-kit/core"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import SearchableSelect from "@/components/ui/searchable-select"
import DatePicker from "@/components/ui/date-picker"
import UkUnkDatePicker from "@/components/ui/ukunk-date-picker"
import {
  normalizeIsoDateForBounds,
  resolveBoundIso,
  isUkUnkDateString,
} from "@/lib/utils/ukUnkDateCompare"
import TerminologyCodingInput from "@/components/ecrf/TerminologyCodingInput"
import { normalizeTerminologyCoding } from "@/lib/utils/terminologyCoding"
import { Trash2, Plus, FileText, Edit, CheckCircle, AlertTriangle, Link2 } from "lucide-react"
import { getCdashBadgeForFieldId, isTableCellMappableForCdash } from "@/lib/utils/cdashMappings"

function manualQueryStatusShortLabel(status) {
  const n = Number(status)
  if (n === 1) return "Open"
  if (n === 2) return "In process"
  if (n === 3) return "Closed"
  return "Active"
}

const TQ_OPEN = 1
const TQ_IN_PROCESS = 2
const TQ_CLOSED = 3

// Browser number inputs accept exponent notation ("e"/"E") by default.
// For clinical numeric entry we block that key path to keep plain numeric values only.
function blockNumberExponentKey(event) {
  if (event?.key === "e" || event?.key === "E") {
    event.preventDefault()
  }
}

function normalizeTableQueryStatus(s) {
  if (s === TQ_OPEN || s === "Open") return TQ_OPEN
  if (s === TQ_IN_PROCESS || s === "InProcess" || s === "In Process") return TQ_IN_PROCESS
  if (s === "SentBack" || s === "ReSubmitted") return TQ_IN_PROCESS
  if (s === 4 || s === "4") return TQ_CLOSED
  if (s === TQ_CLOSED || s === "Closed") return TQ_CLOSED
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : null
}

/** Badge dot on manual-query icon — matches non-table CRM query icons (page.jsx). */
function crmTableQueryIconBadgeClass(status) {
  const n = normalizeTableQueryStatus(status)
  if (n === TQ_OPEN) return "bg-sky-600"
  if (n === TQ_IN_PROCESS) return "bg-orange-600"
  if (n === TQ_CLOSED) return "bg-emerald-600"
  return "bg-emerald-600"
}

/**
 * CRM table cell manual-query button — same palette/shape as non-table `getCrmQueryIconButtonClass`
 * (rounded-full h-7 w-7, sky / orange / emerald / indigo) so table fields match regular fields.
 */
function crmTableQueryIconButtonClass(status) {
  const n = normalizeTableQueryStatus(status)
  if (n === TQ_OPEN) {
    return "relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-sky-500/90 bg-sky-50/95 text-sky-700 shadow-sm transition-colors hover:bg-sky-100/90"
  }
  if (n === TQ_IN_PROCESS) {
    return "relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-orange-500/90 bg-orange-50/95 text-orange-700 shadow-sm transition-colors hover:bg-orange-100/90"
  }
  if (n === TQ_CLOSED) {
    return "relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-500/90 bg-emerald-50/95 text-emerald-700 shadow-sm transition-colors hover:bg-emerald-100/90"
  }
  return "relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-200/90 bg-emerald-50/95 text-emerald-700 shadow-sm transition-colors hover:bg-emerald-100/90"
}

/** Compute date input min/max from control properties.
 * Supports both the newer dropdown-based `dateRestriction` (allowPast/allowFuture/onlyToday)
 * and the legacy flags: allowPastDates, allowFutureDates, currentDateOnly plus minDate/maxDate.
 */
function normalizeIsoDateString(raw) {
  return normalizeIsoDateForBounds(raw)
}

const tableDateTraceLastLoggedAt = new Map()

function logTableDateRestrictionTrace(payload, dedupeKey = "") {
  try {
    if (typeof window === "undefined") return
    const debugEnabled =
      window.localStorage?.getItem("crfRulesDebug") === "1" ||
      window.localStorage?.getItem("crfRulesDeepTrace") === "1" ||
      window.localStorage?.getItem("crfRulesTraceDatePicker") === "1"
    if (!debugEnabled) return
    const key =
      dedupeKey ||
      `${payload?.tableId || ""}|${payload?.cellKey || ""}|${payload?.minDateFromFieldId || ""}|${payload?.maxDateFromFieldId || ""}|${payload?.resolvedMinDate || ""}|${payload?.resolvedMaxDate || ""}`
    const now = Date.now()
    const last = tableDateTraceLastLoggedAt.get(key)
    if (last != null && now - last < 1000) return
    tableDateTraceLastLoggedAt.set(key, now)
    if (tableDateTraceLastLoggedAt.size > 600) tableDateTraceLastLoggedAt.clear()
    console.info("[CRF Rules][TableDateTrace]", payload)
  } catch {
    /* ignore diagnostics failures */
  }
}

const DATE_RESTRICTION_RULE_MARKER = "__DATE_RESTRICTION__"

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function normalizeRuleExpressionText(value) {
  return String(value || "")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
}

function buildTableCellLabelVariants(tableControl, rowIdx, colIdx) {
  const tableLabel = String(tableControl?.label || tableControl?.properties?.labelText || "").trim()
  const headers = Array.isArray(tableControl?.properties?.columnHeaders)
    ? tableControl.properties.columnHeaders
    : []
  const colLabel = String(headers[colIdx] != null && headers[colIdx] !== "" ? headers[colIdx] : `Column ${colIdx + 1}`).trim()
  const rowLabel = `Row ${Number(rowIdx) + 1}`
  const withTablePrefix = tableLabel ? `${tableLabel} - ${colLabel} (${rowLabel})` : `${colLabel} (${rowLabel})`
  const withoutTablePrefix = `${colLabel} (${rowLabel})`
  return [...new Set([withTablePrefix, withoutTablePrefix].filter(Boolean))]
}

function isDateRestrictionLikeRule(rule) {
  const category = String(rule?.category || rule?.ruleCategory || "").trim().toLowerCase()
  const message = String(rule?.message || "").trim()
  return (
    category === "date_restriction" ||
    category === "daterestriction" ||
    (category.includes("date") && category.includes("restrict")) ||
    message.includes(DATE_RESTRICTION_RULE_MARKER)
  )
}

function getDateBoundSourceFromExpression(expression, targetFieldId, boundType = "min", context = {}) {
  const expr = normalizeRuleExpressionText(expression)
  const target = String(targetFieldId || "").trim()
  if (!expr || !target) return ""
  const escTarget = escapeRegex(target)
  const idPattern = "(ctrl_[A-Za-z0-9_]+)"
  if (boundType === "min") {
    const targetLeft = expr.match(new RegExp(`\\b${escTarget}\\b\\s*(>=|>)\\s*\\b${idPattern}\\b`))
    if (targetLeft?.[2]) return String(targetLeft[2])
    const targetRight = expr.match(new RegExp(`\\b${idPattern}\\b\\s*(<=|<)\\s*\\b${escTarget}\\b`))
    if (targetRight?.[1]) return String(targetRight[1])
    return ""
  }
  const targetLeft = expr.match(new RegExp(`\\b${escTarget}\\b\\s*(<=|<)\\s*\\b${idPattern}\\b`))
  if (targetLeft?.[2]) return String(targetLeft[2])
  const targetRight = expr.match(new RegExp(`\\b${idPattern}\\b\\s*(>=|>)\\s*\\b${escTarget}\\b`))
  if (targetRight?.[1]) return String(targetRight[1])

  const targetLabelVariants = Array.isArray(context?.targetLabelVariants) ? context.targetLabelVariants : []
  const labelToFieldId = context?.labelToFieldId && typeof context.labelToFieldId === "object"
    ? context.labelToFieldId
    : {}
  const labelEntries = Object.entries(labelToFieldId)
    .map(([label, fieldId]) => [normalizeRuleExpressionText(label), String(fieldId || "").trim()])
    .filter(([label, fieldId]) => Boolean(label) && Boolean(fieldId))
  for (const rawTargetLabel of targetLabelVariants) {
    const targetLabel = normalizeRuleExpressionText(rawTargetLabel)
    if (!targetLabel) continue
    const escTargetLabel = escapeRegex(targetLabel)
    for (const [sourceLabel, sourceFieldId] of labelEntries) {
      const escSourceLabel = escapeRegex(sourceLabel)
      if (boundType === "min") {
        const targetLeftByLabel = new RegExp(`\\b${escTargetLabel}\\b\\s*(>=|>)\\s*\\b${escSourceLabel}\\b`).test(expr)
        const targetRightByLabel = new RegExp(`\\b${escSourceLabel}\\b\\s*(<=|<)\\s*\\b${escTargetLabel}\\b`).test(expr)
        if (targetLeftByLabel || targetRightByLabel) return sourceFieldId
      } else {
        const targetLeftByLabel = new RegExp(`\\b${escTargetLabel}\\b\\s*(<=|<)\\s*\\b${escSourceLabel}\\b`).test(expr)
        const targetRightByLabel = new RegExp(`\\b${escSourceLabel}\\b\\s*(>=|>)\\s*\\b${escTargetLabel}\\b`).test(expr)
        if (targetLeftByLabel || targetRightByLabel) return sourceFieldId
      }
    }
  }
  return ""
}

function getDateMinMax(properties, context = {}) {
  const today = new Date().toISOString().slice(0, 10)
  const minFromFieldId = String(properties?.minDateFromFieldId || "").trim()
  const maxFromFieldId = String(properties?.maxDateFromFieldId || "").trim()
  const resolveDateFromField = context?.resolveDateFromField
  const dynamicMin =
    minFromFieldId && typeof resolveDateFromField === "function"
      ? resolveBoundIso(resolveDateFromField(minFromFieldId), "min")
      : ""
  const dynamicMax =
    maxFromFieldId && typeof resolveDateFromField === "function"
      ? resolveBoundIso(resolveDateFromField(maxFromFieldId), "max")
      : ""

  // New model: single dateRestriction field
  const restriction = properties?.dateRestriction
  if (restriction === "onlyToday") {
    return { min: today, max: today }
  }
  if (restriction === "allowPast") {
    const max = dynamicMax || (properties?.maxDate != null ? properties.maxDate : today)
    const min = dynamicMin || (properties?.minDate != null ? properties.minDate : undefined)
    return { min, max }
  }
  if (restriction === "allowFuture") {
    const min = dynamicMin || (properties?.minDate != null ? properties.minDate : today)
    const max = dynamicMax || (properties?.maxDate != null ? properties.maxDate : undefined)
    return { min, max }
  }

  // Legacy model: boolean flags
  if (properties?.currentDateOnly) {
    return { min: today, max: today }
  }
  const min =
    dynamicMin ||
    (properties?.minDate != null
      ? properties.minDate
      : properties?.allowPastDates === false
        ? today
        : undefined)
  const max =
    dynamicMax ||
    (properties?.maxDate != null
      ? properties.maxDate
      : properties?.allowFutureDates === false
        ? today
        : undefined)
  return { min, max }
}

const UK_UNK_MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

function normalizeUkUnkMonthToken(rawMonth) {
  const token = String(rawMonth || "").trim().toUpperCase()
  if (!token) return ""
  if (token === "UNK") return "UNK"
  if (UK_UNK_MONTHS.includes(token)) return token
  if (/^\d{1,2}$/.test(token)) {
    const idx = Number(token)
    if (Number.isFinite(idx) && idx >= 1 && idx <= 12) return UK_UNK_MONTHS[idx - 1]
  }
  return ""
}

function normalizeUkUnkDayToken(rawDay) {
  const token = String(rawDay || "").trim().toUpperCase()
  if (!token) return ""
  if (token === "UK") return "UK"
  if (/^\d{1,2}$/.test(token)) {
    const n = Number(token)
    if (Number.isFinite(n) && n >= 1 && n <= 31) return String(n)
  }
  return ""
}

function parseUkUnkDateValue(rawValue) {
  const raw = String(rawValue || "").trim()
  if (!raw) return { day: "", month: "", year: "" }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [yyyy, mm, dd] = raw.split("-")
    return { day: normalizeUkUnkDayToken(dd), month: normalizeUkUnkMonthToken(mm), year: yyyy }
  }
  const [dayPart = "", monthPart = "", yearPart = ""] = raw.split("-")
  return {
    day: normalizeUkUnkDayToken(dayPart),
    month: normalizeUkUnkMonthToken(monthPart),
    year: /^\d{4}$/.test(String(yearPart || "").trim()) ? String(yearPart).trim() : "",
  }
}

function buildUkUnkDateValue(day, month, year) {
  if (!day && !month && !year) return ""
  return `${day || ""}-${month || ""}-${year || ""}`
}

function getUkUnkYearRange(properties = {}, minDate, maxDate) {
  const nowYear = new Date().getFullYear()
  const fallbackMin = nowYear - 120
  const fallbackMax = nowYear
  const parseYear = (raw) => {
    const text = String(raw || "").trim()
    if (!text) return null
    if (/^\d{4}$/.test(text)) return Number(text)
    const d = new Date(text)
    const y = d.getFullYear()
    return Number.isFinite(y) ? y : null
  }
  const minYear = parseYear(properties?.minYear) ?? parseYear(minDate) ?? fallbackMin
  const maxYear = parseYear(properties?.maxYear) ?? parseYear(maxDate) ?? fallbackMax
  if (maxYear < minYear) return { minYear: fallbackMin, maxYear: fallbackMax }
  return { minYear, maxYear }
}

// Drop zone for table cells in design mode (drag tools into columns)
const TableCellDropZone = ({ dropId, children, className = "" }) => {
  const { setNodeRef, isOver } = useDroppable({ id: dropId })
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[32px] ${isOver ? "ring-2 ring-dashed ring-emerald-500 bg-emerald-50 rounded" : ""} ${className}`}
    >
      {children}
    </div>
  )
}

const ControlRenderer = ({
  control,
  isViewMode = false,
  isPreviewMode = false,
  onValueChange,
  onInputClick,
  onTableColumnHeaderChange,
  onCellLabelChange,
  formValues = null,
  tableManualQueries = [],
  tableCellErrors = {},
  onOpenTableCellQuery,
  onRaiseTableCellQuery,
  tableEditableCellByFieldId = {},
  tableAuditCellEnabledByFieldId = {},
  tableAuditCellDirtyByFieldId = {},
  onOpenTableCellAudit,
  tableCellLabSoftWarnings = {},
  tableSdvVisibleByFieldId = {},
  tableSdvCheckedByFieldId = {},
  onToggleTableSdv,
  isCdashEnabled = false,
  cdashMappings = [],
}) => {
  if (!control) return null
  // Normalize type (API may return "CheckBox" / "Radio")
  const type = (control.type || "").toLowerCase()
  const controlWithType = { ...control, type }
  const isDesignMode = !isViewMode && !isPreviewMode

  const props = controlWithType.properties || control.properties || {}
  const labelPosition = props.labelPosition || "left"
  const labelText = props.labelText || controlWithType.label || control.label
  // Check if field is required (static or conditionally required)
  const isRequired = props.required || props.conditionallyRequired
  // In preview mode, controls should be interactive but not persist data
  // In view mode (non-preview), controls should be read-only
  // Rules can override readonly state. Normalize string flags from API/runtime.
  const readonlyFlag =
    props.readonly === true ||
    props.readonly === "true" ||
    props.readonly === 1 ||
    props.readonly === "1"
  const isReadonly = readonlyFlag || (isViewMode && !isPreviewMode)
  
  // Handle click on input fields to open rule modal (only in design mode)
  const handleInputClick = (e) => {
    if (!isPreviewMode && !isViewMode && onInputClick && 
        (type === "text" || type === "number" || type === "date" || type === "ukunkdate" ||
         type === "time" || type === "select" || type === "radio" || 
         type === "checkbox")) {
      e.stopPropagation()
      // Mark this as an input click
      onInputClick(control, { ...e, isInputClick: true })
    }
  }

  // State for interactive preview mode (values are not persisted)
  const defaultValueArray = props.defaultValue ? props.defaultValue.split(",").map(v => v.trim()).filter(v => v !== "") : []
  const [selectValue, setSelectValue] = useState(props.defaultValue || "")
  const [radioValue, setRadioValue] = useState(props.defaultValue || "")
  const [checkboxValues, setCheckboxValues] = useState(defaultValueArray || [])
  const [ukUnkDatePreviewValue, setUkUnkDatePreviewValue] = useState(props.defaultValue || "")

  // Inline edit state for table column headers (design mode)
  const [editingTableHeader, setEditingTableHeader] = useState({ controlId: null, colIdx: null })
  const [editingTableHeaderValue, setEditingTableHeaderValue] = useState("")

  // Reset state when control changes (for preview mode)
  useEffect(() => {
    if (isPreviewMode) {
      setSelectValue(props.defaultValue || "")
      setRadioValue(props.defaultValue || "")
      setUkUnkDatePreviewValue(props.defaultValue || "")
      const newDefaultArray = props.defaultValue ? props.defaultValue.split(",").map(v => v.trim()).filter(v => v !== "") : []
      setCheckboxValues(newDefaultArray)
    }
  }, [control.id, isPreviewMode])

  const handleCheckboxChange = (option, checked) => {
    if (checked) {
      setCheckboxValues(prev => [...prev, option])
    } else {
      setCheckboxValues(prev => prev.filter(v => v !== option))
    }
  }

  const isLabelAbove = labelPosition === "top" || type === "checkbox" || type === "radio" || type === "ukunkdate"
  const renderLabel = () => {
    if (!labelText || type === "label") return null

    // Keep question text dark; only the required asterisk uses accent red (matches eCRF manual entry heading style).
    return (
      <Label
        className={`font-medium text-slate-800 ${
          isLabelAbove ? "block mb-2" : "inline-block mr-2"
        }`}
      >
        {labelText}
        {isRequired && <span className="text-rose-500 ml-1">*</span>}
      </Label>
    )
  }

  const renderControl = () => {
    switch (type) {
      case "label":
        return (
          <span className={`text-base ${props.fontWeight === "bold" ? "font-bold" : ""} ${
            props.textDecoration === "underline" ? "underline" :
            props.textDecoration === "line-through" ? "line-through" :
            props.textDecoration === "overline" ? "overline" : ""
          }`}>
            {labelText || "Label"}
          </span>
        )

      case "text":
        if (props.multiline) {
        return (
          <Textarea
            placeholder={props.placeholder}
            defaultValue={props.defaultValue}
            readOnly={isReadonly}
            disabled={isReadonly}
            maxLength={props.maxLength}
            className="w-full"
            onChange={(e) => {
              if (onValueChange && isPreviewMode) {
                onValueChange(e.target.value)
              }
            }}
          />
        )
        }
        return (
          <Input
            type="text"
            placeholder={props.placeholder}
            defaultValue={props.defaultValue}
            readOnly={isReadonly}
            disabled={isReadonly}
            maxLength={props.maxLength}
            className="w-full"
            onChange={(e) => {
              if (onValueChange && isPreviewMode) {
                onValueChange(e.target.value)
              }
            }}
          />
        )

      case "number":
        {
          const scaleRaw = props.scale
          const scale = Number.isFinite(Number(scaleRaw)) ? Math.max(0, Number(scaleRaw)) : null
        return (
          <Input
            type="number"
            placeholder={props.placeholder}
            defaultValue={props.defaultValue}
            readOnly={isReadonly}
            disabled={isReadonly}
            min={props.min}
            max={props.max}
            step={scale != null ? Math.pow(10, -scale) : undefined}
            className="w-full"
            onKeyDown={blockNumberExponentKey}
            onChange={(e) => {
              if (onValueChange && isPreviewMode) {
                const raw = e.target.value
                if (raw === "") {
                  onValueChange(null)
                  return
                }
                const n = Number(raw)
                if (!Number.isFinite(n)) {
                  onValueChange(null)
                  return
                }
                const out = scale == null ? n : Number(n.toFixed(scale))
                onValueChange(out)
              }
            }}
          />
        )
        }

      case "date": {
        const { min, max } = getDateMinMax(props)
        return (
          <Input
            type="date"
            placeholder={props.placeholder}
            defaultValue={props.defaultValue}
            min={min}
            max={max}
            readOnly={isReadonly}
            className="w-full"
            onClick={handleInputClick}
          />
        )
      }
      case "ukunkdate": {
        const resolveDateFromField = (sourceFieldId) => {
          const sid = String(sourceFieldId || "").trim()
          if (!sid) return ""
          const raw = formValues?.[sid]
          if (raw == null || !String(raw).trim()) return ""
          const text = String(raw).trim()
          if (isUkUnkDateString(text)) return text
          return normalizeIsoDateString(text)
        }
        const { min, max } = getDateMinMax(props, { resolveDateFromField })
        const useFormValuesUkUnk = typeof formValues === "object" && formValues !== null && typeof onValueChange === "function"
        const currentValue = useFormValuesUkUnk ? (formValues[control.id] ?? "") : isPreviewMode ? ukUnkDatePreviewValue : props.defaultValue || ""
        const updateValue = (nextValue) => {
          if (useFormValuesUkUnk) {
            onValueChange(control.id, nextValue)
          } else if (isPreviewMode) {
            setUkUnkDatePreviewValue(nextValue)
            if (typeof onValueChange === "function") onValueChange(control.id, nextValue)
          }
        }
        return (
          <div onClick={handleInputClick}>
            <UkUnkDatePicker
              value={currentValue || ""}
              onChange={updateValue}
              disabled={isReadonly}
              minDate={min || undefined}
              maxDate={max || undefined}
            />
          </div>
        )
      }

      case "time":
        return (
          <Input
            type="time"
            placeholder={props.placeholder}
            defaultValue={props.defaultValue}
            readOnly={isReadonly}
            className="w-full"
          />
        )

      case "file":
        return (
          <div className="flex items-center gap-2">
            <Input
              type="file"
              readOnly={isReadonly}
              disabled={isReadonly}
              multiple={props.multiple}
              className="w-full"
            />
          </div>
        )

      case "select": {
        const options = props.csvValues
          ? props.csvValues.split(",").map(opt => opt.trim()).filter(opt => opt !== "")
          : []
        const shouldUseSearchableSelect = options.length > 7
        const searchableOptions = options.map((option) => ({
          value: String(option),
          label: String(option),
        }))
        const useFormValuesSelect = typeof formValues === "object" && formValues !== null && typeof onValueChange === "function"
        const selectFormValue = useFormValuesSelect ? (formValues[control.id] ?? "") : (isPreviewMode ? (selectValue ?? "") : "")
        const safeValue = selectFormValue === "" || selectFormValue == null ? "" : selectFormValue
        // Radix Select reserves empty string for "clear"; use a sentinel so SelectItem never has value=""
        const EMPTY_SELECT_VALUE = "__select_placeholder__"
        const displayValue = options.length > 0 && options.includes(safeValue) ? safeValue : EMPTY_SELECT_VALUE
        if (shouldUseSearchableSelect) {
          return (
            <div onClick={handleInputClick}>
              <SearchableSelect
                value={safeValue}
                options={searchableOptions}
                placeholder={props.placeholder || "Select..."}
                disabled={isReadonly}
                showSearch
                searchIconPosition="end"
                onChange={(next) => {
                  const out = next == null ? "" : String(next)
                  if (useFormValuesSelect && onValueChange) {
                    onValueChange(control.id, out)
                  } else if (isPreviewMode) {
                    setSelectValue(out)
                    if (onValueChange) onValueChange(control.id, out)
                  }
                }}
              />
            </div>
          )
        }
        return (
          <div onClick={handleInputClick}>
            <Select 
              disabled={isReadonly}
              value={displayValue}
              onValueChange={(value) => {
                const out = value === EMPTY_SELECT_VALUE ? "" : value
                if (useFormValuesSelect && onValueChange) {
                  onValueChange(control.id, out)
                } else if (isPreviewMode) {
                  setSelectValue(out)
                  if (onValueChange) onValueChange(control.id, out)
                }
              }}
            >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={props.placeholder || "Select..."} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY_SELECT_VALUE}>{props.placeholder || "Select..."}</SelectItem>
              {options.length > 0 ? (
                options.map((option, idx) => (
                  <SelectItem key={idx} value={option}>
                    {option}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="no-options" disabled>
                  No options available
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          </div>
        )
      }

      case "radio": {
        const radioOptions = props.csvValues
          ? props.csvValues.split(",").map(opt => opt.trim()).filter(opt => opt !== "")
          : ["Option 1"]
        
        // Ensure at least one option exists
        const finalRadioOptions = radioOptions.length > 0 ? radioOptions : ["Option 1"]
        
        const alignment = props.alignment === "vertical" ? "flex-col" : "flex-row gap-4"
        
        const useFormValuesRadio = typeof formValues === "object" && formValues !== null && typeof onValueChange === "function"
        const radioFormValue = useFormValuesRadio ? (formValues[control.id] ?? "") : undefined
        
        return (
          <div className={`flex ${alignment} gap-2`}>
            {finalRadioOptions.map((option, idx) => {
              // Keep radio input controlled across preview <-> view mode.
              // Otherwise React warns: controlled -> uncontrolled when we switch to `defaultChecked`.
              const checked = useFormValuesRadio ? radioFormValue === option : radioValue === option
              const inputProps = isPreviewMode
                ? {
                    checked,
                    onChange: (e) => {
                      const val = e.target.value
                      if (!useFormValuesRadio) setRadioValue(val)
                      if (onValueChange) onValueChange(control.id, val)
                    },
                  }
                : { checked, readOnly: true }
              
              return (
                <label key={idx} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name={`radio_${control.id}`}
                    value={option}
                    disabled={isReadonly}
                    className="w-4 h-4 text-emerald-600"
                    {...inputProps}
                  />
                  <span>{option}</span>
                </label>
              )
            })}
          </div>
        )
      }

      case "checkbox": {
        const checkboxOptions = props.csvValues
          ? props.csvValues.split(",").map(opt => opt.trim()).filter(opt => opt !== "")
          : ["Option 1"]
        
        // Ensure at least one option exists
        const finalCheckboxOptions = checkboxOptions.length > 0 ? checkboxOptions : ["Option 1"]
        
        const checkboxAlignment = props.alignment === "vertical" ? "flex-col" : "flex-row gap-4"
        
        // When formValues provided (E-CRF data entry), use controlled mode so rules/validation work
        const useFormValuesCheckbox = typeof formValues === "object" && formValues !== null && typeof onValueChange === "function"
        const checkboxFormVal = useFormValuesCheckbox ? (formValues[control.id] ?? "") : ""
        const checkboxFormArray = typeof checkboxFormVal === "string"
          ? checkboxFormVal.split(",").map(s => s.trim()).filter(Boolean)
          : Array.isArray(checkboxFormVal) ? checkboxFormVal : []
        const activeCheckboxValues = useFormValuesCheckbox ? checkboxFormArray : checkboxValues
        
        return (
          <div className={`flex ${checkboxAlignment} gap-2`}>
            {finalCheckboxOptions.map((option, idx) => {
              // Keep checkbox input controlled across preview <-> view mode.
              // Otherwise React warns: controlled -> uncontrolled when we switch to `defaultChecked`.
              const checked = activeCheckboxValues.includes(option)
              const inputProps = isPreviewMode
                ? {
                    checked,
                    onChange: (e) => {
                      if (!useFormValuesCheckbox) handleCheckboxChange(option, e.target.checked)
                      if (onValueChange) {
                        const updatedValues = e.target.checked
                          ? [...activeCheckboxValues, option]
                          : activeCheckboxValues.filter(v => v !== option)
                        onValueChange(control.id, updatedValues.join(','))
                      }
                    },
                  }
                : { checked, readOnly: true }
              
              return (
                <label key={idx} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    value={option}
                    disabled={isReadonly}
                    className="w-4 h-4 text-emerald-600"
                    {...inputProps}
                  />
                  <span>{option}</span>
                </label>
              )
            })}
          </div>
        )
      }

      case "hr":
        return <hr className="my-4 border-slate-300" />

      case "table": {
        const numCols = Math.max(1, props.columns || 1)
        const designRows = Math.max(1, props.rows || 1)
        const addRowEnabled = props.addRow === true
        const maxRows = Math.max(designRows, parseInt(props.maxRows, 10) || 10)
        const useFormValues = typeof formValues === "object" && formValues !== null && typeof onValueChange === "function"
        const rowCountKey = control.id + "_rowCount"
        const currentRowCountFromForm = useFormValues && addRowEnabled ? formValues[rowCountKey] : undefined
        const numRows = addRowEnabled && useFormValues
          ? Math.min(Math.max(1, Math.max(designRows, parseInt(currentRowCountFromForm, 10) || designRows)), maxRows)
          : designRows
        const columnHeaders = Array.isArray(props.columnHeaders) ? props.columnHeaders : []
        const columnTypes = Array.isArray(props.columnTypes) ? props.columnTypes : []
        const columnOptionValues = Array.isArray(props.columnOptionValues) ? props.columnOptionValues : []
        const columnTerminologyCoding = Array.isArray(props.columnTerminologyCoding)
          ? props.columnTerminologyCoding
          : []
        const columnDateRestrictions = Array.isArray(props.columnDateRestrictions) ? props.columnDateRestrictions : []
        const columnAlignment = Array.isArray(props.columnAlignment) ? props.columnAlignment : []
        const tableCellRuleProps = (props.tableCellRuleProps && typeof props.tableCellRuleProps === "object") ? props.tableCellRuleProps : {}
        const headerLabels = Array.from({ length: numCols }, (_, i) => columnHeaders[i] != null && columnHeaders[i] !== '' ? columnHeaders[i] : `Column ${i + 1}`)
        const requiredCellsList = (() => {
          if (Array.isArray(props.requiredCells) && props.requiredCells.length > 0) {
            return props.requiredCells.filter(c => c && c.row != null && c.col != null)
          }
          const legacy = props.requiredCell && typeof props.requiredCell === 'object' && props.requiredCell.row != null && props.requiredCell.col != null
          return legacy ? [{ row: props.requiredCell.row, col: props.requiredCell.col }] : []
        })()
        const mapTemplateRow = (rowIdx) =>
          addRowEnabled && useFormValues && rowIdx >= designRows ? 0 : rowIdx
        const isCellRequired = (rowIdx, colIdx) => {
          const templateRow = mapTemplateRow(rowIdx)
          return requiredCellsList.some((c) => c.row === templateRow && c.col === colIdx)
        }
        const requiredCol = requiredCellsList.length === 0 && props.requiredColumn != null && props.requiredColumn >= 0 && props.requiredColumn < numCols ? props.requiredColumn : null
        const requiredRow = requiredCellsList.length === 0 && props.requiredRow != null && props.requiredRow >= 0 && props.requiredRow < numRows ? props.requiredRow : null
        const cellTypes = Array.isArray(props.cellTypes) ? props.cellTypes : []
        const cellLabels = Array.isArray(props.cellLabels) ? props.cellLabels : []
        const getCellLabel = (rowIdx, colIdx) => {
          if (addRowEnabled && useFormValues && rowIdx >= designRows) return ""
          return (cellLabels[rowIdx] && cellLabels[rowIdx][colIdx] != null) ? String(cellLabels[rowIdx][colIdx]) : ""
        }
        const getCellType = (rowIdx, colIdx) => {
          const templateRow = addRowEnabled && useFormValues && rowIdx >= designRows ? 0 : rowIdx
          const cellOverride = cellTypes[templateRow]?.[colIdx]
          if (cellOverride && cellOverride !== 'empty') return cellOverride
          const t = columnTypes[colIdx]
          return (t && t !== 'empty') ? t : null
        }
        const getOptionsForColumn = (colIdx) => {
          const raw = columnOptionValues[colIdx]
          if (raw && typeof raw === 'string' && raw.trim()) {
            return raw.split(',').map(s => s.trim()).filter(Boolean)
          }
          return ["Option 1", "Option 2"]
        }
        const handleTableCellClick = (rowIdx, colIdx) => {
          if (isDesignMode && onInputClick) {
            onInputClick(control, { isInputClick: true, tableRowIndex: rowIdx, tableColumnIndex: colIdx })
          }
        }
        const cellId = (rowIdx, colIdx) => `${control.id}_row_${rowIdx}_col_${colIdx}`
        const getCellValue = (rowIdx, colIdx) => (useFormValues ? (formValues[cellId(rowIdx, colIdx)] ?? "") : undefined)
        const getCellRuleProps = (rowIdx, colIdx) => tableCellRuleProps[`${rowIdx}_${colIdx}`] || {}
        /**
         * Table cell readonly resolution.
         * Order: query-assigned unlock → form view/permission lock → per-cell enable/disable rules → table readonly.
         * Enable rules may unlock cells on editable drafts, but must NOT override view-only / submitted locks.
         */
        const resolveCellReadonly = (cellRuleProps, isCellUnlockedByQuery) => {
          if (isCellUnlockedByQuery) return false
          if (isViewMode && !isPreviewMode) return true
          if (typeof cellRuleProps?.readonly === "boolean") {
            return cellRuleProps.readonly
          }
          return isReadonly
        }
        const handleCellChange = (rowIdx, colIdx, value) => { if (onValueChange) onValueChange(cellId(rowIdx, colIdx), value) }
        const clearDependentDateCellsForRow = (rowIdx, changedColIdx) => {
          if (!onValueChange) return
          const changedCellId = cellId(rowIdx, changedColIdx)
          const tableRules = Array.isArray(control.properties?.rules) ? control.properties.rules : []
          const tableMinFromList = Array.isArray(control.properties?.columnDateMinFromField)
            ? control.properties.columnDateMinFromField
            : []
          const tableMaxFromList = Array.isArray(control.properties?.columnDateMaxFromField)
            ? control.properties.columnDateMaxFromField
            : []
          const tableCellMinFromMap =
            control.properties?.tableCellDateMinFromField &&
            typeof control.properties.tableCellDateMinFromField === "object"
              ? control.properties.tableCellDateMinFromField
              : {}
          const tableCellMaxFromMap =
            control.properties?.tableCellDateMaxFromField &&
            typeof control.properties.tableCellDateMaxFromField === "object"
              ? control.properties.tableCellDateMaxFromField
              : {}
          const mapSourceFieldIdToRow = (sourceFieldId) => {
            const normalized = String(sourceFieldId || "").trim()
            if (!normalized) return ""
            const mappedRowCell = normalized.replace(
              new RegExp(`^${control.id}_row_\\d+_`),
              `${control.id}_row_${rowIdx}_`
            )
            const legacyColMatch = normalized.match(new RegExp(`^${control.id}__col_(\\d+)$`))
            if (legacyColMatch) {
              const legacyColIdx = Number(legacyColMatch[1])
              if (!Number.isNaN(legacyColIdx)) {
                return `${control.id}_row_${rowIdx}_col_${legacyColIdx}`
              }
            }
            return mappedRowCell
          }
          const tableLabelToFieldId = {}
          for (let tableColIdx = 0; tableColIdx < numCols; tableColIdx += 1) {
            const currentRowFieldId = `${control.id}_row_${rowIdx}_col_${tableColIdx}`
            buildTableCellLabelVariants(control, rowIdx, tableColIdx).forEach((label) => {
              tableLabelToFieldId[label] = currentRowFieldId
            })
            if (rowIdx !== 0) {
              buildTableCellLabelVariants(control, 0, tableColIdx).forEach((label) => {
                tableLabelToFieldId[label] = currentRowFieldId
              })
            }
          }

          const dependentTargets = []
          for (let colIdx = 0; colIdx < numCols; colIdx += 1) {
            if (colIdx === changedColIdx) continue
            const colType = String(getCellType(rowIdx, colIdx) || "").toLowerCase()
            if (!colType.includes("date")) continue
            const cellKey = `${rowIdx}_${colIdx}`
            const templateCellKey =
              addRowEnabled && useFormValues && rowIdx >= designRows
                ? `0_${colIdx}`
                : cellKey
            const targetCellId = cellId(rowIdx, colIdx)
            const rawMinSourceId =
              tableCellMinFromMap[cellKey] ||
              tableCellMinFromMap[templateCellKey] ||
              tableMinFromList[colIdx] ||
              ""
            const rawMaxSourceId =
              tableCellMaxFromMap[cellKey] ||
              tableCellMaxFromMap[templateCellKey] ||
              tableMaxFromList[colIdx] ||
              ""
            const currentTargetFieldId = `${control.id}_row_${rowIdx}_col_${colIdx}`
            const templateTargetFieldId = `${control.id}_row_0_col_${colIdx}`
            const targetLabelVariants = [
              ...buildTableCellLabelVariants(control, rowIdx, colIdx),
              ...buildTableCellLabelVariants(control, 0, colIdx),
            ]
            const ruleBasedMinSourceId = (() => {
              for (const rule of tableRules) {
                if (!isDateRestrictionLikeRule(rule)) continue
                const expr = String(rule?.expression || rule?.ruleExpression || "")
                const fromCurrent = getDateBoundSourceFromExpression(expr, currentTargetFieldId, "min", {
                  targetLabelVariants,
                  labelToFieldId: tableLabelToFieldId,
                })
                if (fromCurrent) return fromCurrent
                const fromTemplate = getDateBoundSourceFromExpression(expr, templateTargetFieldId, "min", {
                  targetLabelVariants,
                  labelToFieldId: tableLabelToFieldId,
                })
                if (fromTemplate) return fromTemplate
              }
              return ""
            })()
            const ruleBasedMaxSourceId = (() => {
              for (const rule of tableRules) {
                if (!isDateRestrictionLikeRule(rule)) continue
                const expr = String(rule?.expression || rule?.ruleExpression || "")
                const fromCurrent = getDateBoundSourceFromExpression(expr, currentTargetFieldId, "max", {
                  targetLabelVariants,
                  labelToFieldId: tableLabelToFieldId,
                })
                if (fromCurrent) return fromCurrent
                const fromTemplate = getDateBoundSourceFromExpression(expr, templateTargetFieldId, "max", {
                  targetLabelVariants,
                  labelToFieldId: tableLabelToFieldId,
                })
                if (fromTemplate) return fromTemplate
              }
              return ""
            })()
            const mappedMinSourceId = mapSourceFieldIdToRow(rawMinSourceId || ruleBasedMinSourceId)
            const mappedMaxSourceId = mapSourceFieldIdToRow(rawMaxSourceId || ruleBasedMaxSourceId)
            // Directional dependency for clear-on-change:
            // clear target only when changed cell is the target's MIN source.
            // Do not use MAX source for clearing, otherwise rules like
            // "Resolution >= Onset" become bi-directional and clear both sides.
            if (mappedMinSourceId === changedCellId) {
              dependentTargets.push(targetCellId)
            }
          }

          dependentTargets.forEach((targetId) => {
            onValueChange(targetId, "")
          })
        }
        const renderTableCell = (cellType, rowIdx, colIdx) => {
          if (!cellType) return null
          const ukUnkContentClass = "!rounded-md !border-slate-200 !bg-white !p-1 !shadow-md !backdrop-blur-none"
          const cellVal = getCellValue(rowIdx, colIdx)
          const cellRuleProps = getCellRuleProps(rowIdx, colIdx)
          const currentCellFieldId = cellId(rowIdx, colIdx)
          const isCellUnlockedByQuery = Boolean(tableEditableCellByFieldId?.[currentCellFieldId])
          const isCellReadonly = resolveCellReadonly(cellRuleProps, isCellUnlockedByQuery)
          const inputClass = `w-full text-xs sm:text-sm h-8 px-2 py-1 border rounded focus:outline-none focus:ring-1 ${
            isCellUnlockedByQuery
              ? "border-sky-300 bg-sky-50/30 focus:ring-sky-200 focus:border-sky-400"
              : "border-slate-300 focus:ring-emerald-500 focus:border-emerald-500"
          }`
          const isCellHidden = !!cellRuleProps.hidden
          if (isCellHidden) return null
          const safeCellVal = cellVal === undefined || cellVal === null ? "" : cellVal
          const controlledProps = useFormValues ? { value: safeCellVal, onChange: (e) => handleCellChange(rowIdx, colIdx, e.target.type === "number" ? (e.target.value === "" ? null : parseFloat(e.target.value)) : e.target.type === "checkbox" ? (e.target.checked ? e.target.value : "") : e.target.value) } : {}
          switch (cellType) {
            case "text": {
              const cellTerminology = normalizeTerminologyCoding(columnTerminologyCoding[colIdx])
              const tcErrKey = `${rowIdx}_${colIdx}`
              const tcErrs = Array.isArray(tableCellErrors?.[tcErrKey]) ? tableCellErrors[tcErrKey] : []
              const hasTcErr = tcErrs.length > 0
              if (useFormValues && cellTerminology) {
                return (
                  <TerminologyCodingInput
                    dense
                    coding={cellTerminology}
                    value={safeCellVal}
                    onChange={(v) => handleCellChange(rowIdx, colIdx, v)}
                    disabled={isCellReadonly}
                    hasError={hasTcErr}
                  />
                )
              }
              return (
                <input
                  type="text"
                  className={inputClass}
                  placeholder=""
                  readOnly={isCellReadonly}
                  disabled={isCellReadonly}
                  {...controlledProps}
                />
              )
            }
            case "number":
              {
                const scaleRaw = control?.properties?.scale
                const scale = Number.isFinite(Number(scaleRaw)) ? Math.max(0, Number(scaleRaw)) : null
                const hasValue =
                  safeCellVal !== null && safeCellVal !== undefined && String(safeCellVal).trim() !== ""
                const displayValue =
                  scale == null
                    ? safeCellVal === null || safeCellVal === undefined ? "" : safeCellVal
                    : hasValue
                      ? Number(safeCellVal).toFixed(scale)
                      : ""

                return (
                  <input
                    type="number"
                    className={inputClass}
                    placeholder=""
                    readOnly={isCellReadonly}
                    disabled={isCellReadonly}
                    value={displayValue}
                    onKeyDown={blockNumberExponentKey}
                    onChange={(e) => {
                      if (!onValueChange) return
                      const raw = e.target.value
                      if (raw === "") {
                        handleCellChange(rowIdx, colIdx, null)
                        return
                      }
                      const n = Number(raw)
                      if (!Number.isFinite(n)) {
                        handleCellChange(rowIdx, colIdx, null)
                        return
                      }
                      const out = scale == null ? n : Number(n.toFixed(scale))
                      handleCellChange(rowIdx, colIdx, out)
                    }}
                  />
                )
              }
            case "date":
            case "ukunkdate": {
              const isUkUnkCell = String(cellType || "").toLowerCase() === "ukunkdate"
              // Table date / UK-UNK cells can override date restriction per column (same behavior as normal date field).
              const tableMinFromList = Array.isArray(control.properties?.columnDateMinFromField)
                ? control.properties.columnDateMinFromField
                : []
              const tableMaxFromList = Array.isArray(control.properties?.columnDateMaxFromField)
                ? control.properties.columnDateMaxFromField
                : []
              const tableCellMinFromMap =
                control.properties?.tableCellDateMinFromField &&
                typeof control.properties.tableCellDateMinFromField === "object"
                  ? control.properties.tableCellDateMinFromField
                  : {}
              const tableCellMaxFromMap =
                control.properties?.tableCellDateMaxFromField &&
                typeof control.properties.tableCellDateMaxFromField === "object"
                  ? control.properties.tableCellDateMaxFromField
                  : {}
              const cellKey = `${rowIdx}_${colIdx}`
              const templateCellKey =
                addRowEnabled && useFormValues && rowIdx >= designRows
                  ? `0_${colIdx}`
                  : cellKey
              const currentTargetFieldId = `${control.id}_row_${rowIdx}_col_${colIdx}`
              const templateTargetFieldId = `${control.id}_row_0_col_${colIdx}`
              const tableRules = Array.isArray(control.properties?.rules) ? control.properties.rules : []
              const tableLabelToFieldId = {}
              for (let tableColIdx = 0; tableColIdx < numCols; tableColIdx++) {
                const currentRowFieldId = `${control.id}_row_${rowIdx}_col_${tableColIdx}`
                buildTableCellLabelVariants(control, rowIdx, tableColIdx).forEach((label) => {
                  tableLabelToFieldId[label] = currentRowFieldId
                })
                if (rowIdx !== 0) {
                  buildTableCellLabelVariants(control, 0, tableColIdx).forEach((label) => {
                    tableLabelToFieldId[label] = currentRowFieldId
                  })
                }
              }
              const targetLabelVariants = [
                ...buildTableCellLabelVariants(control, rowIdx, colIdx),
                ...buildTableCellLabelVariants(control, 0, colIdx),
              ]
              const getRuleTargetIds = (rule) => {
                const rawTargetFields = rule?.targetFields ?? rule?.TargetFields
                if (Array.isArray(rawTargetFields) && rawTargetFields.length > 0) {
                  return rawTargetFields.map((id) => String(id || "").trim()).filter(Boolean)
                }
                const rawTargetField = rule?.targetField ?? rule?.TargetField ?? ""
                const tf = String(rawTargetField || "").trim()
                if (!tf) return []
                return tf.includes(",")
                  ? tf
                      .split(",")
                      .map((id) => String(id || "").trim())
                      .filter(Boolean)
                  : [tf]
              }
              const doesRuleTargetCurrentDateCell = (rule) => {
                const targetIds = getRuleTargetIds(rule)
                // Backward compatibility: some old rules rely on expression inference only.
                if (targetIds.length === 0) return true
                return targetIds.some((targetId) => {
                  if (!targetId) return false
                  if (targetId === currentTargetFieldId || targetId === templateTargetFieldId) return true
                  // Support legacy table target syntax: tableId__col_N
                  const legacyColMatch = targetId.match(new RegExp(`^${control.id}__col_(\\d+)$`))
                  if (!legacyColMatch) return false
                  const legacyColIdx = Number(legacyColMatch[1])
                  return Number.isFinite(legacyColIdx) && legacyColIdx === colIdx
                })
              }
              const ruleBasedMinSourceId = (() => {
                for (const rule of tableRules) {
                  if (!isDateRestrictionLikeRule(rule)) continue
                  if (!doesRuleTargetCurrentDateCell(rule)) continue
                  const expr = String(rule?.expression || rule?.ruleExpression || "")
                  const fromCurrent = getDateBoundSourceFromExpression(expr, currentTargetFieldId, "min", {
                    targetLabelVariants,
                    labelToFieldId: tableLabelToFieldId,
                  })
                  if (fromCurrent) return fromCurrent
                  const fromTemplate = getDateBoundSourceFromExpression(expr, templateTargetFieldId, "min", {
                    targetLabelVariants,
                    labelToFieldId: tableLabelToFieldId,
                  })
                  if (fromTemplate) return fromTemplate
                }
                return ""
              })()
              const ruleBasedMaxSourceId = (() => {
                for (const rule of tableRules) {
                  if (!isDateRestrictionLikeRule(rule)) continue
                  if (!doesRuleTargetCurrentDateCell(rule)) continue
                  const expr = String(rule?.expression || rule?.ruleExpression || "")
                  const fromCurrent = getDateBoundSourceFromExpression(expr, currentTargetFieldId, "max", {
                    targetLabelVariants,
                    labelToFieldId: tableLabelToFieldId,
                  })
                  if (fromCurrent) return fromCurrent
                  const fromTemplate = getDateBoundSourceFromExpression(expr, templateTargetFieldId, "max", {
                    targetLabelVariants,
                    labelToFieldId: tableLabelToFieldId,
                  })
                  if (fromTemplate) return fromTemplate
                }
                return ""
              })()
              const mapSourceFieldIdToRow = (sourceFieldId) => {
                const normalizedSource = String(sourceFieldId || "").trim()
                if (!normalizedSource) return ""
                // Standard table-cell ids: table_row_X_col_Y -> map to current row
                const mappedRowCell = normalizedSource.replace(
                  new RegExp(`^${control.id}_row_\\d+_`),
                  `${control.id}_row_${rowIdx}_`
                )
                // Legacy/prefixed ids: table__col_Y -> map to current row cell id
                const legacyColMatch = normalizedSource.match(
                  new RegExp(`^${control.id}__col_(\\d+)$`)
                )
                if (legacyColMatch) {
                  const legacyColIdx = Number(legacyColMatch[1])
                  if (!Number.isNaN(legacyColIdx)) {
                    return `${control.id}_row_${rowIdx}_col_${legacyColIdx}`
                  }
                }
                return mappedRowCell
              }
              const resolveDateFromField = (sourceFieldId) => {
                const mappedSource = mapSourceFieldIdToRow(sourceFieldId)
                if (!mappedSource || mappedSource === currentTargetFieldId) return ""
                const raw = formValues?.[mappedSource]
                if (raw == null || !String(raw).trim()) return ""
                const text = String(raw).trim()
                if (isUkUnkDateString(text)) return text
                return normalizeIsoDateString(text)
              }
              const tableDateProps = {
                ...(control.properties || {}),
                dateRestriction: columnDateRestrictions[colIdx] || control.properties?.dateRestriction || "",
                minDateFromFieldId:
                  tableCellMinFromMap[cellKey] ||
                  tableCellMinFromMap[templateCellKey] ||
                  ruleBasedMinSourceId ||
                  tableMinFromList[colIdx] ||
                  "",
                maxDateFromFieldId:
                  tableCellMaxFromMap[cellKey] ||
                  tableCellMaxFromMap[templateCellKey] ||
                  ruleBasedMaxSourceId ||
                  tableMaxFromList[colIdx] ||
                  "",
              }
              const { min, max } = getDateMinMax(tableDateProps, { resolveDateFromField })
              const mappedMinSource = mapSourceFieldIdToRow(
                String(tableDateProps.minDateFromFieldId || "").trim()
              )
              const mappedMaxSource = mapSourceFieldIdToRow(
                String(tableDateProps.maxDateFromFieldId || "").trim()
              )
              logTableDateRestrictionTrace(
                {
                  tableId: control.id,
                  rowIdx,
                  colIdx,
                  cellKey,
                  templateCellKey,
                  targetFieldId: currentTargetFieldId,
                  templateTargetFieldId,
                  dateRestriction: tableDateProps.dateRestriction || "",
                  minDateFromFieldId: tableDateProps.minDateFromFieldId || "",
                  maxDateFromFieldId: tableDateProps.maxDateFromFieldId || "",
                  mappedMinSourceFieldId: mappedMinSource,
                  mappedMaxSourceFieldId: mappedMaxSource,
                  mappedMinSourceRawValue: mappedMinSource ? formValues?.[mappedMinSource] : "",
                  mappedMaxSourceRawValue: mappedMaxSource ? formValues?.[mappedMaxSource] : "",
                  resolvedMinDate: min || "",
                  resolvedMaxDate: max || "",
                  ruleBasedMinSourceId,
                  ruleBasedMaxSourceId,
                },
                `${control.id}|${rowIdx}_${colIdx}|${min || ""}|${max || ""}`
              )
              const readonlyDisplayValue = (() => {
                if (!safeCellVal) return ""
                if (isUkUnkCell) return String(safeCellVal)
                const d = new Date(safeCellVal)
                if (Number.isNaN(d.getTime())) return String(safeCellVal)
                const dd = String(d.getDate()).padStart(2, "0")
                const mm = String(d.getMonth() + 1).padStart(2, "0")
                const yyyy = d.getFullYear()
                return `${dd}-${mm}-${yyyy}`
              })()
              if (isCellReadonly) {
                return (
                  <input
                    type="text"
                    value={readonlyDisplayValue}
                    readOnly
                    disabled
                    placeholder={isUkUnkCell ? "DD-MMM-YYYY" : "dd-mm-yyyy"}
                    className="w-full min-w-0 max-w-full h-8 px-2 py-1 text-xs sm:text-sm rounded-md border border-slate-300 bg-slate-100 cursor-not-allowed opacity-75"
                  />
                )
              }
              if (isUkUnkCell) {
                return (
                  <UkUnkDatePicker
                    value={safeCellVal || ""}
                    onChange={(nextValue) => {
                      handleCellChange(rowIdx, colIdx, nextValue)
                      clearDependentDateCellsForRow(rowIdx, colIdx)
                    }}
                    disabled={false}
                    minDate={min || undefined}
                    maxDate={max || undefined}
                    compact
                    className="h-8 !rounded-md px-2 text-[11px] sm:text-xs"
                  />
                )
              }
              return (
                <DatePicker
                  value={useFormValues ? (safeCellVal || null) : null}
                  onChange={(next) => {
                    handleCellChange(rowIdx, colIdx, next || "")
                    clearDependentDateCellsForRow(rowIdx, colIdx)
                  }}
                  disabled={false}
                  minDate={min || undefined}
                  maxDate={max || undefined}
                  placeholder="dd-mm-yyyy"
                  className="w-full min-w-0 max-w-full overflow-hidden h-8 px-2 py-1 text-xs sm:text-sm rounded-md border border-slate-300 bg-white focus-within:border-emerald-400 focus-within:ring-1 focus-within:ring-emerald-200 shadow-none"
                />
              )
            }
            case "time":
              return <input type="time" className={inputClass} readOnly={isCellReadonly} disabled={isCellReadonly} {...(useFormValues ? { value: safeCellVal || "", onChange: (e) => handleCellChange(rowIdx, colIdx, e.target.value) } : {})} />
            case "lab":
              return <input type="text" className={inputClass} placeholder="Lab value" readOnly={isCellReadonly} disabled={isCellReadonly} {...controlledProps} />
            case "file":
              return <input type="file" className="text-xs" readOnly={isCellReadonly} disabled={isCellReadonly} {...(useFormValues ? { onChange: (e) => handleCellChange(rowIdx, colIdx, e.target.files?.[0]?.name ?? "") } : {})} />
            case "select": {
              const opts = getOptionsForColumn(colIdx)
              const shouldUseSearchableCellSelect = opts.length > 7
              const searchableCellOptions = opts.map((opt) => ({
                value: String(opt),
                label: String(opt),
              }))
              const EMPTY_TABLE_SELECT_VALUE = "__table_select_placeholder__"
              const displayValue = safeCellVal === "" ? EMPTY_TABLE_SELECT_VALUE : String(safeCellVal)
              if (shouldUseSearchableCellSelect) {
                return (
                  <SearchableSelect
                    value={String(safeCellVal ?? "")}
                    options={searchableCellOptions}
                    placeholder="Select..."
                    disabled={isCellReadonly}
                    showSearch
                    searchIconPosition="end"
                    className="h-8 rounded-md border border-slate-300 px-2 py-1 text-xs sm:text-sm shadow-none"
                    contentClassName="z-[180]"
                    onChange={(next) => handleCellChange(rowIdx, colIdx, next == null ? "" : String(next))}
                  />
                )
              }
              return (
                <Select
                  value={useFormValues ? displayValue : EMPTY_TABLE_SELECT_VALUE}
                  onValueChange={(next) =>
                    handleCellChange(
                      rowIdx,
                      colIdx,
                      next === EMPTY_TABLE_SELECT_VALUE ? "" : next,
                    )
                  }
                  disabled={isCellReadonly}
                >
                  <SelectTrigger className="h-8 !w-full !min-w-0 max-w-full rounded-md border border-slate-300 bg-white px-2 text-xs sm:text-sm shadow-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-400">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent className="z-[180]">
                    <SelectItem value={EMPTY_TABLE_SELECT_VALUE}>Select...</SelectItem>
                    {opts.map((opt, idx) => (
                      <SelectItem key={idx} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            }
            case "radio": {
              const opts = getOptionsForColumn(colIdx)
              const align = columnAlignment[colIdx] || "horizontal"
              const flexClass = align === "vertical" ? "flex flex-col gap-2" : "flex flex-wrap gap-2"
              return (
                <div className={flexClass}>
                  {opts.map((opt, i) => {
                    const radioProps = useFormValues
                      ? { checked: safeCellVal === opt, onChange: () => handleCellChange(rowIdx, colIdx, opt) }
                      : { defaultChecked: false }
                    return (
                      <label key={i} className="flex items-center gap-1 cursor-pointer text-xs">
                        <input type="radio" name={`table_${control.id}_${rowIdx}_${colIdx}`} value={opt} disabled={isCellReadonly} className="w-3 h-3" {...radioProps} />
                        <span>{opt}</span>
                      </label>
                    )
                  })}
                </div>
              )
            }
            case "checkbox": {
              const opts = getOptionsForColumn(colIdx)
              const align = columnAlignment[colIdx] || "horizontal"
              const flexClass = align === "vertical" ? "flex flex-col gap-2" : "flex flex-wrap gap-2"
              const checkedSet = useFormValues && typeof safeCellVal === "string" ? new Set(safeCellVal.split(",").map(s => s.trim()).filter(Boolean)) : new Set()
              return (
                <div className={flexClass}>
                  {opts.map((opt, i) => {
                    const checkboxProps = useFormValues
                      ? { checked: checkedSet.has(opt), onChange: (e) => { const next = new Set(checkedSet); if (e.target.checked) next.add(opt); else next.delete(opt); handleCellChange(rowIdx, colIdx, [...next].join(",")) } }
                      : { defaultChecked: false }
                    return (
                      <label key={i} className="flex items-center gap-1 cursor-pointer text-xs">
                        <input type="checkbox" value={opt} disabled={isCellReadonly} className="w-3 h-3" {...checkboxProps} />
                        <span>{opt}</span>
                      </label>
                    )
                  })}
                </div>
              )
            }
            case "label": {
              const labelText = getCellLabel(rowIdx, colIdx)
              if (isDesignMode && onCellLabelChange) {
                return (
                  <input
                    type="text"
                    className={inputClass}
                    value={labelText}
                    onChange={(e) => onCellLabelChange(control, rowIdx, colIdx, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Label text"
                  />
                )
              }
              return <span className="block min-h-[2rem] py-1 text-slate-700">{labelText || "\u00a0"}</span>
            }
            default:
              return (
                <input
                  type="text"
                  className={inputClass}
                  placeholder=""
                  readOnly={isCellReadonly}
                  disabled={isCellReadonly}
                  {...controlledProps}
                />
              )
          }
        }
        const tableCellDropId = (rowIdx, colIdx) => `tablecell_${control.id}|${rowIdx}|${colIdx}`
        /**
         * CRF table layout (scroll + min column widths) lives only here — all entry surfaces use this component:
         * `app/ecrf-data-entry/manually/page.jsx`, `DesignerCanvas.jsx`, `CRFViewer.jsx`. No duplicate table markup elsewhere.
         */
        /** Readable column floor + horizontal scroll (icons share the row; avoid squishing controls). */
        const tableColMinClass = (idx) =>
          idx === 0
            ? "min-w-[128px] sm:min-w-[144px]"
            : "min-w-[108px] sm:min-w-[118px]"
        return (
          <div className="border border-slate-300 rounded-lg overflow-hidden">
            <div className="max-h-[min(400px,60vh)] max-w-full overflow-x-auto overflow-y-auto overscroll-x-contain overscroll-y-contain">
              <table className="w-max min-w-full border-collapse table-auto">
                <thead className="bg-slate-100 sticky top-0 z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.1)]">
                <tr>
                  {headerLabels.map((label, idx) => {
                    const isEditing = isDesignMode && onTableColumnHeaderChange && editingTableHeader?.controlId === control.id && editingTableHeader?.colIdx === idx
                    return (
                      <th
                        key={idx}
                        title={String(label ?? "")}
                        className={`border border-slate-300 p-2 text-left align-top ${tableColMinClass(idx)}`}
                      >
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingTableHeaderValue}
                            onChange={(e) => setEditingTableHeaderValue(e.target.value)}
                            onBlur={() => {
                              if (onTableColumnHeaderChange) {
                                onTableColumnHeaderChange(control, idx, editingTableHeaderValue.trim())
                              }
                              setEditingTableHeader({ controlId: null, colIdx: null })
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault()
                                if (onTableColumnHeaderChange) {
                                  onTableColumnHeaderChange(control, idx, editingTableHeaderValue.trim())
                                }
                                setEditingTableHeader({ controlId: null, colIdx: null })
                              }
                              if (e.key === "Escape") {
                                setEditingTableHeader({ controlId: null, colIdx: null })
                                setEditingTableHeaderValue("")
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full min-w-[60px] px-1.5 py-0.5 text-sm border border-emerald-400 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                            autoFocus
                          />
                        ) : (
                          <span
                            onClick={isDesignMode && onTableColumnHeaderChange ? () => {
                              setEditingTableHeader({ controlId: control.id, colIdx: idx })
                              setEditingTableHeaderValue(headerLabels[idx] || "")
                            } : undefined}
                            className={isDesignMode && onTableColumnHeaderChange ? "cursor-text hover:bg-emerald-50 rounded px-1 py-0.5 block min-h-[1.5rem]" : "block"}
                            title={isDesignMode && onTableColumnHeaderChange ? "Click to edit column name" : undefined}
                          >
                            {label}
                          </span>
                        )}
                      </th>
                    )
                  })}
                  {addRowEnabled && useFormValues && !isDesignMode && (
                    <th className="border border-slate-300 p-1 text-center align-top w-10" aria-label="Remove row" />
                  )}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: numRows }).map((_, rowIdx) => (
                  <tr key={rowIdx}>
                    {Array.from({ length: numCols }).map((_, colIdx) => {
                      const cellType = getCellType(rowIdx, colIdx)
                      const cellRuleProps = getCellRuleProps(rowIdx, colIdx)
                      const cellErrorList = Array.isArray(tableCellErrors?.[`${rowIdx}_${colIdx}`])
                        ? tableCellErrors[`${rowIdx}_${colIdx}`]
                        : []
                      const labSoftCellList = Array.isArray(tableCellLabSoftWarnings?.[`${rowIdx}_${colIdx}`])
                        ? tableCellLabSoftWarnings[`${rowIdx}_${colIdx}`]
                        : []
                      const hasLabSoftHint = labSoftCellList.length > 0
                      const hasCellError = cellErrorList.length > 0
                      const isConditionallyRequiredCell = !!cellRuleProps.conditionallyRequired
                      const isCellHiddenForUi = !!cellRuleProps.hidden
                      const currentCellFieldId = cellId(rowIdx, colIdx)
                      const isCellUnlockedByQuery = Boolean(tableEditableCellByFieldId?.[currentCellFieldId])
                      const isCellReadonlyForUi = resolveCellReadonly(cellRuleProps, isCellUnlockedByQuery)
                      const showQueryEditableHighlight = isCellUnlockedByQuery && !isCellReadonlyForUi
                      const isRequiredByTemplate =
                        requiredCellsList.length > 0
                          ? isCellRequired(rowIdx, colIdx)
                          : (requiredCol === colIdx) ||
                            (requiredRow === rowIdx && colIdx === 0) ||
                            (addRowEnabled && useFormValues && requiredRow === 0 && rowIdx >= designRows && colIdx === 0)
                      // Do not show required * / highlight when cell is hidden or not editable (e.g. enable/disable rules).
                      const showRequiredIndicator =
                        !isCellHiddenForUi &&
                        !isCellReadonlyForUi &&
                        (isRequiredByTemplate || isConditionallyRequiredCell)
                      const cellQueryFieldId = `${control.id}__col_${colIdx}__row_${rowIdx + 1}`
                      const flatCellQueryFieldId = `${control.id}_row_${rowIdx}_col_${colIdx}`
                      const cellManualQueries = Array.isArray(tableManualQueries)
                        ? tableManualQueries.filter((q) => {
                            const qFieldId = String(q?.fieldId || "")
                            return qFieldId === cellQueryFieldId || qFieldId === flatCellQueryFieldId
                          })
                        : []
                      const hasAuditIcon = Boolean(tableAuditCellEnabledByFieldId?.[currentCellFieldId])
                      const isAuditCellDirty = Boolean(tableAuditCellDirtyByFieldId?.[currentCellFieldId])
                      const latestQueryForCell =
                        cellManualQueries.length > 0
                          ? [...cellManualQueries].sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0))[0]
                          : null
                      const showTableSdv = Boolean(tableSdvVisibleByFieldId?.[currentCellFieldId])
                      const tableSdvChecked = Boolean(tableSdvCheckedByFieldId?.[currentCellFieldId])
                      const cdashCellBadge =
                        isDesignMode &&
                        isCdashEnabled &&
                        isTableCellMappableForCdash(controlWithType, rowIdx, colIdx)
                          ? getCdashBadgeForFieldId(cdashMappings, currentCellFieldId)
                          : null
                      const cellContent = (
                        <div className="flex items-start gap-1">
                          {isDesignMode && cdashCellBadge ? (
                            <span
                              className="pointer-events-none inline-flex h-[1.125rem] w-[1.125rem] flex-shrink-0 items-center justify-center rounded border border-indigo-200/80 bg-indigo-50 p-0.5 mt-1"
                              title={`CDASH mapped: ${cdashCellBadge} — click cell to edit in Properties`}
                              aria-label={`CDASH mapped: ${cdashCellBadge}`}
                            >
                              <Link2 className="h-2.5 w-2.5 text-indigo-600" aria-hidden />
                            </span>
                          ) : null}
                          {!isDesignMode && showTableSdv && (
                            <input
                              type="checkbox"
                              className={`h-4 w-4 rounded border cursor-pointer flex-shrink-0 mt-1 transition-all duration-200 ${
                                tableSdvChecked
                                  ? "border-emerald-500 accent-emerald-600 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]"
                                  : "border-slate-300 accent-emerald-600 hover:border-emerald-400"
                              }`}
                              checked={tableSdvChecked}
                              aria-label="SDV"
                              title="SDV"
                              onChange={(e) => onToggleTableSdv?.(currentCellFieldId, e.target.checked)}
                            />
                          )}
                          {showRequiredIndicator && (
                            <span className="text-red-500 text-xs flex-shrink-0 pt-1.5" title="Required">
                              *
                            </span>
                          )}
                          <div
                            className={`min-w-0 flex-1 ${isDesignMode ? "cursor-pointer" : ""}`}
                            onClick={isDesignMode ? (e) => { e.stopPropagation(); handleTableCellClick(rowIdx, colIdx) } : undefined}
                            onKeyDown={isDesignMode ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleTableCellClick(rowIdx, colIdx) } } : undefined}
                            role={isDesignMode ? "button" : undefined}
                            tabIndex={isDesignMode ? 0 : undefined}
                            title={isDesignMode ? "Click to select this cell (Row " + (rowIdx + 1) + ", Column " + (colIdx + 1) + ") and edit its rules" : undefined}
                          >
                            {renderTableCell(cellType, rowIdx, colIdx)}
                          </div>
                          {!isDesignMode && hasAuditIcon && (
                            <button
                              type="button"
                              className={`relative inline-flex shrink-0 self-start items-center justify-center h-7 w-7 overflow-hidden rounded-md border mt-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-200 ${
                                isAuditCellDirty
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                              }`}
                              title={
                                isAuditCellDirty
                                  ? "Click to add reason for this cell change"
                                  : "Cell has saved value from DB"
                              }
                              aria-label={
                                isAuditCellDirty
                                  ? "Add reason for this changed cell"
                                  : "Cell has saved value"
                              }
                              onClick={(e) => {
                                e.stopPropagation()
                                if (!isAuditCellDirty || typeof onOpenTableCellAudit !== "function") return
                                onOpenTableCellAudit({
                                  rowIdx,
                                  colIdx,
                                  fieldId: currentCellFieldId,
                                })
                              }}
                            >
                              {isAuditCellDirty ? (
                                <CheckCircle className="w-3 h-3" />
                              ) : (
                                <Edit className="w-3 h-3" />
                              )}
                            </button>
                          )}
                          {!isDesignMode && (() => {
                            const canOpenCellQuery =
                              latestQueryForCell && typeof onOpenTableCellQuery === "function"
                            const canRaiseCellQuery = typeof onRaiseTableCellQuery === "function"
                            if (!canOpenCellQuery && !canRaiseCellQuery) return null
                            const cellQueryBlockedByValidation = hasCellError
                            return (
                            <button
                              type="button"
                              disabled={cellQueryBlockedByValidation}
                              className={`relative inline-flex shrink-0 self-start items-center justify-center overflow-hidden mt-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-200 ${
                                cellQueryBlockedByValidation
                                  ? "h-7 w-7 rounded-full border border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                                  : latestQueryForCell
                                  ? crmTableQueryIconButtonClass(latestQueryForCell.status)
                                  : crmTableQueryIconButtonClass(null)
                              }`}
                              title={
                                cellQueryBlockedByValidation
                                  ? "Fix validation errors for this cell before opening or raising a query."
                                  : latestQueryForCell
                                  ? `Manual query — ${manualQueryStatusShortLabel(latestQueryForCell.status)}. Open details.`
                                  : "Raise query for this cell"
                              }
                              aria-label={
                                cellQueryBlockedByValidation
                                  ? "Query actions disabled until cell validation passes"
                                  : latestQueryForCell
                                  ? `Manual query ${manualQueryStatusShortLabel(latestQueryForCell.status)}`
                                  : "Raise query for this cell"
                              }
                              onClick={(e) => {
                                e.stopPropagation()
                                if (cellQueryBlockedByValidation) return
                                const cellValue = getCellValue(rowIdx, colIdx)
                                const rowLabel = getCellLabel(rowIdx, 0) || `Row ${rowIdx + 1}`
                                const columnLabel = headerLabels[colIdx] || `Column ${colIdx + 1}`
                                if (canOpenCellQuery) {
                                  onOpenTableCellQuery(latestQueryForCell)
                                  return
                                }
                                if (canRaiseCellQuery) {
                                  onRaiseTableCellQuery({
                                    rowIndex: rowIdx + 1,
                                    colIndex: colIdx,
                                    rowLabel,
                                    columnLabel,
                                    cellValue,
                                  })
                                }
                              }}
                            >
                              <FileText className="h-3.5 w-3.5" aria-hidden />
                              {latestQueryForCell && cellManualQueries.length > 1 && (
                                <span
                                  className={`absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-0.5 text-[9px] font-bold leading-none text-white ${crmTableQueryIconBadgeClass(
                                    latestQueryForCell.status,
                                  )}`}
                                >
                                  {cellManualQueries.length > 9 ? "9+" : cellManualQueries.length}
                                </span>
                              )}
                            </button>
                            )
                          })()}
                          {!isDesignMode && hasLabSoftHint && (
                            <span
                              className="relative inline-flex shrink-0 self-start items-center justify-center h-7 w-7 overflow-hidden rounded-full border border-amber-200/90 bg-amber-50/90 text-amber-800 mt-0.5 shadow-sm"
                              title={labSoftCellList.join(" ")}
                              role="img"
                              aria-label={labSoftCellList.join("; ")}
                            >
                              <AlertTriangle className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>
                      )
                      return (
                        <td
                          key={colIdx}
                          className={`border border-slate-300 p-2 min-h-[36px] align-top ${tableColMinClass(colIdx)} ${colIdx === 0 ? "break-words" : ""} ${showRequiredIndicator ? "bg-amber-50/50" : ""} ${hasCellError ? "bg-rose-50/40" : ""} ${showQueryEditableHighlight ? "bg-sky-50/35" : ""}`}
                        >
                          {isDesignMode ? (
                            <TableCellDropZone dropId={tableCellDropId(rowIdx, colIdx)}>
                              {cellContent}
                            </TableCellDropZone>
                          ) : (
                            <div className="space-y-1">
                              {cellContent}
                              {false && hasCellError && String(cellType || "").toLowerCase() !== "date" && (
                                <div className="space-y-0.5">
                                  {cellErrorList
                                    .filter((err) => !/\bis required\b/i.test(String(err || "")))
                                    .map((err, errIdx) => (
                                    <p key={errIdx} className="text-[10px] leading-snug text-rose-600">
                                      {String(err || "")}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      )
                    })}
                    {addRowEnabled && useFormValues && !isDesignMode && (
                      <td className="border border-slate-300 p-1 align-middle w-10 text-center">
                        {rowIdx > 0 ? (
                          <button
                            type="button"
                            onClick={() => onValueChange(control.id + "_removeRow", String(rowIdx))}
                            className="inline-flex items-center justify-center w-7 h-7 rounded text-slate-500 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-200"
                            title="Remove this row"
                            aria-label="Remove this row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              {addRowEnabled && useFormValues && !isDesignMode && numRows < maxRows && (
                <tfoot>
                  <tr>
                    <td colSpan={numCols + (addRowEnabled && useFormValues && !isDesignMode ? 1 : 0)} className="border border-slate-300 p-2 bg-slate-50/80">
                      <button
                        type="button"
                        onClick={() => onValueChange(rowCountKey, String(numRows + 1))}
                        className="inline-flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:ring-offset-1 rounded px-2 py-1"
                        aria-label="Add row"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add row</span>
                      </button>
                    </td>
                  </tr>
                </tfoot>
              )}
              </table>
            </div>
          </div>
        )
      }

      default:
        return <div className="text-slate-400">Unknown control type: {type}</div>
    }
  }

  // Checkbox and radio: always show label on top so it's above the options, not centered beside them
  const containerClass = isLabelAbove ? "flex flex-col gap-1" : "flex items-center gap-2"

  if (type === "label" || type === "hr" || type === "table") {
    return renderControl()
  }

  return (
    <div className={containerClass}>
      {(isLabelAbove || labelPosition === "left") && renderLabel()}
      <div className="flex items-center gap-2 flex-1">
        {props.prefix && (
          <span className="text-slate-600">{props.prefix}</span>
        )}
        <div className="flex-1">
          {renderControl()}
          {props.tooltip && (
            <p className="text-xs text-slate-500 mt-1">{props.tooltip}</p>
          )}
        </div>
        {props.postfix && (
          <span className="text-slate-600">{props.postfix}</span>
        )}
      </div>
    </div>
  )
}

export default ControlRenderer

