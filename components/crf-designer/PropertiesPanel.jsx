"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Minus, Plus, FlaskConical, Trash2, Loader2, Pencil } from "lucide-react"
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
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { crfRuleService, labManagementService } from "@/lib/services"
import { normalizeCrfSection, SECTION_TYPE_LAB } from "@/lib/utils/crfLabSection"
import { buildLabTestOptionsFromAssignmentRows } from "@/lib/utils/crfLabRangeValidation"
import { useToast } from "@/hooks/use-toast"
import {
  createFieldLabelMap,
  replaceFieldIdsWithLabels,
  decodeHtmlEntities,
  getRuleCategoryDisplayLabel,
} from "./ruleEvaluator"
import { normalizeTerminologyCoding } from "@/lib/utils/terminologyCoding"
import SearchableSelect from "@/components/ui/searchable-select"
import CdashPropertiesSection from "./CdashPropertiesSection"
import { resolveCdashTargetControl } from "@/lib/utils/cdashMappings"

/** Built-in rule: when Eligibility is No, freeze CRF (disable all fields with this rule). Use control label "Eligibility" to avoid partial-match errors. */
const BUILTIN_ELIGIBILITY_FREEZE_RULE = {
  id: "builtin_eligibility_freeze",
  ruleName: "Freeze CRF when not eligible",
  ruleCategory: "disable",
  ruleExpression: 'Eligibility == "No"',
  expression: 'Eligibility == "No"',
  message: "",
  category: "Disable",
  description: "When user selects No for eligibility, this control becomes read-only. Set the Yes/No control label to exactly: Eligibility",
}

/** Built-in rule: show "If Other, Please Specify" when user selects "Other" in Body Part Where Applied. Attach to the specify field. */
const BUILTIN_SHOW_WHEN_OTHER_BODYPART_RULE = {
  id: "builtin_show_when_other_bodypart",
  ruleName: "Show when Other selected (Body Part)",
  ruleCategory: "show",
  ruleExpression: 'Body Part Where Applied.indexOf("Other") >= 0',
  expression: 'Body Part Where Applied.indexOf("Other") >= 0',
  message: "",
  category: "Show",
  description: "Attach to 'If Other, Please Specify' so it shows only when user selects Other in Body Part Where Applied. Set that checkbox label to: Body Part Where Applied",
}

/** Built-in rule: show specify field when user selects "Any Other Specify" in Adverse Event Observed. Attach to the specify field. */
const BUILTIN_SHOW_WHEN_OTHER_ADVERSE_EVENT_RULE = {
  id: "builtin_show_when_other_adverse_event",
  ruleName: "Show when Any Other Specify selected (Adverse Event)",
  ruleCategory: "show",
  ruleExpression: 'Adverse Event Observed.indexOf("Any Other Specify") >= 0',
  expression: 'Adverse Event Observed.indexOf("Any Other Specify") >= 0',
  message: "",
  category: "Show",
  description: "Attach to the specify field so it shows only when user selects Any Other Specify in Adverse Event Observed. Set that control label to: Adverse Event Observed",
}

const BUILTIN_RULES = [BUILTIN_ELIGIBILITY_FREEZE_RULE, BUILTIN_SHOW_WHEN_OTHER_BODYPART_RULE, BUILTIN_SHOW_WHEN_OTHER_ADVERSE_EVENT_RULE]

/** Parse compact mapping textarea (comma / newline); keys include default/DEFAULT reserved. */
function parseCompactAutoMapRules(rulesText) {
  const raw = String(rulesText || "")
  if (!raw.trim()) return {}
  const out = {}
  raw
    .replace(/\r/g, "\n")
    .split(/\n|,/g)
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((line) => {
      const match = line.match(/^(.+?)\s*(?:=>|->)\s*(.*)$/)
      if (!match) return
      const source = String(match[1] || "").trim()
      const target = String(match[2] || "").trim()
      if (!source) return
      out[source] = target
    })
  return out
}

/** Option values for a designer select match ControlRenderer csvValues split (excluding placeholder row). */
function selectCsvOptionKeys(sourceControl) {
  const csv = sourceControl?.properties?.csvValues
  if (typeof csv !== "string" || !csv.trim()) return []
  return [...new Set(csv.split(",").map((s) => s.trim()).filter(Boolean))]
}

/** When choosing a source dropdown: pre-fill left-hand keys from that field's options; preserve RHS where keys align. */
function buildAutoMapScaffoldFromSelect(existingRulesText, sourceControl) {
  const keys = selectCsvOptionKeys(sourceControl)
  const prev = parseCompactAutoMapRules(existingRulesText)
  const defaultRhs =
    typeof prev.default === "string"
      ? prev.default
      : typeof prev.DEFAULT === "string"
        ? prev.DEFAULT
        : ""

  if (keys.length === 0) {
    return String(existingRulesText || "").trim()
  }

  const lines = []
  keys.forEach((key) => {
    const rhs = Object.prototype.hasOwnProperty.call(prev, key) ? String(prev[key] ?? "") : ""
    lines.push(`${key}=>${rhs}`)
  })
  lines.push(`default=>${defaultRhs}`)
  return lines.join(",\n")
}

function resizeStringMatrix2D(source, rows, cols, fill = "") {
  const src = Array.isArray(source) ? source : []
  const out = []
  for (let r = 0; r < rows; r++) {
    const prev = Array.isArray(src[r]) ? src[r] : []
    const row = []
    for (let c = 0; c < cols; c++) {
      const v = prev[c]
      row.push(v != null && String(v).trim() !== "" ? String(v) : fill)
    }
    out.push(row)
  }
  return out
}

// Map control types to API format (matching CrfControlType enum)
const mapControlType = (type) => {
  const typeMap = {
    "label": "Label",           // CrfControlType.Label = 1
    "text": "TextBox",          // CrfControlType.TextBox = 2
    "number": "NumberBox",       // CrfControlType.NumberBox = 3
    "date": "DatePicker",        // CrfControlType.DatePicker = 4
    "ukunkdate": "DatePicker",   // Stored as DatePicker-compatible type
    "time": "TimePicker",        // CrfControlType.TimePicker = 5
    "file": "FileUploader",      // CrfControlType.FileUploader = 6
    "checkbox": "CheckBox",      // CrfControlType.CheckBox = 7
    "radio": "OptionButton",     // CrfControlType.OptionButton = 8
    "select": "OptionList",       // CrfControlType.OptionList = 9
    "hr": "Divider",             // CrfControlType.Divider = 10
    "table": "Table",            // CrfControlType.Table = 11
    "lab": "Lab",                // CrfControlType.Lab = 12
  }
  return typeMap[type] || "Label"
}

const PropertiesPanel = ({ control, parentLabSection = null, selectedTableColumnForRules = null, selectedTableRowForRules = null, allControls = [], onUpdate, onClose, onOpenRuleModal, onEditRule = null, crfId = null, studyId = null, onSaveCrf = null, isCdashEnabled = false, cdashMappings = [], onCdashMappingsChange = null, onCdashMappingsDirty = null, cdashMappingDisabled = false, getCdashFieldLabel = null }) => {
  const { toast } = useToast()
  const parentNormForLab = useMemo(
    () => (parentLabSection ? normalizeCrfSection(parentLabSection) : null),
    [parentLabSection],
  )
  const labFacilityIdForPanel =
    parentNormForLab?.sectionType === SECTION_TYPE_LAB && parentNormForLab.labBinding?.labFacilityId
      ? String(parentNormForLab.labBinding.labFacilityId).trim()
      : ""
  const [labAssignmentRows, setLabAssignmentRows] = useState([])
  const [loadingLabAssignments, setLoadingLabAssignments] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!labFacilityIdForPanel) {
        setLabAssignmentRows([])
        return
      }
      setLoadingLabAssignments(true)
      try {
        const raw = labFacilityIdForPanel
        const n = Number(raw)
        const labIdArg = Number.isFinite(n) && String(n) === raw ? n : raw
        const res = await labManagementService.getLabRangeAssignmentsList(1, 2000, labIdArg, null, true)
        if (cancelled) return
        if (res.isSuccess && res.data) {
          setLabAssignmentRows(Array.isArray(res.data.items) ? res.data.items : [])
        } else {
          setLabAssignmentRows([])
        }
      } catch {
        if (!cancelled) setLabAssignmentRows([])
      } finally {
        if (!cancelled) setLoadingLabAssignments(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [labFacilityIdForPanel])

  const labTestChoices = useMemo(
    () => buildLabTestOptionsFromAssignmentRows(labAssignmentRows),
    [labAssignmentRows],
  )

  const [availableRules, setAvailableRules] = useState([])
  const [selectedRuleId, setSelectedRuleId] = useState("")
  const [selectedTemplateId, setSelectedTemplateId] = useState(null) // Track selected template for rule creation
  const [loadingRules, setLoadingRules] = useState(true)
  const [savingRule, setSavingRule] = useState(false)
  const [processingRuleId, setProcessingRuleId] = useState(null) // Track which rule is being processed to prevent duplicates
  const [addRequiredCellRow, setAddRequiredCellRow] = useState(null)
  const [addRequiredCellCol, setAddRequiredCellCol] = useState(null)

  // Ref to prevent duplicate API calls
  const rulesFetchedRef = useRef(false)
  
  // Load available rules from API (only once)
  useEffect(() => {
    // Prevent duplicate calls
    if (rulesFetchedRef.current) {
      return
    }
    
    const fetchRules = async () => {
      rulesFetchedRef.current = true
      setLoadingRules(true)
      try {
        const response = await crfRuleService.getAllRuleEngineTemplates()
        if (response.isSuccess && response.data) {
          // Map API response to match the expected format
          const mappedRules = response.data.map(rule => ({
            id: rule.id,
            ruleName: rule.ruleName,
            ruleCategory: rule.category?.toLowerCase() || "",
            ruleExpression: rule.expression || "", // Extract expression from API response
            expression: rule.expression || "", // Also store as expression for direct access
            message: rule.message || "",
            category: rule.category,
            severity: rule.severity,
            trigger: rule.trigger,
            controlType: rule.controlType,
            description: rule.description,
          }))
          setAvailableRules([...BUILTIN_RULES, ...mappedRules])
        } else {
          // 404 or other error: backend may not have RuleEngine/GetAll (e.g. on UAT) – use built-in rules only
          if (response.httpStatus === 404 || response.statusCode === 404) {
            console.info("Rule templates API not available (404), using built-in rules only.")
          } else {
            console.warn("Failed to fetch rules:", response.message)
          }
          setAvailableRules([...BUILTIN_RULES])
          rulesFetchedRef.current = false // Reset on error to allow retry
        }
      } catch (error) {
        // 404 / network: use built-in rules only so UI still works
        const is404 = error?.message?.includes("404") || error?.httpStatus === 404
        if (is404) {
          console.info("Rule templates API not available, using built-in rules only.")
        } else {
          console.error("Error loading rules:", error)
        }
        setAvailableRules([...BUILTIN_RULES])
        rulesFetchedRef.current = false // Reset on error to allow retry
      } finally {
        setLoadingRules(false)
      }
    }

    fetchRules()
  }, [])

  const cdashTargetControl = useMemo(() => {
    if (!control || !isCdashEnabled) return null
    const tableCellSelected =
      control.type === "table" &&
      selectedTableRowForRules != null &&
      selectedTableColumnForRules != null
    return resolveCdashTargetControl(
      control,
      tableCellSelected ? selectedTableRowForRules : null,
      tableCellSelected ? selectedTableColumnForRules : null,
    )
  }, [control, isCdashEnabled, selectedTableRowForRules, selectedTableColumnForRules])

  if (!control) {
    return (
      <div className="h-full min-h-0 flex flex-col bg-white">
        <div className="p-3 sm:p-4 flex-shrink-0 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-emerald-50/30">
          <h3 className="font-semibold text-slate-900 text-sm sm:text-base">Properties</h3>
        </div>
        <div className="flex-1 min-h-0 flex items-center justify-center p-6 text-center">
          <div className="max-w-xs">
            <p className="text-slate-500 text-sm sm:text-base mb-2">
              Select a control to edit its properties
            </p>
            <p className="text-slate-400 text-xs">
              Click on any form control in the canvas to view and modify its properties
            </p>
          </div>
        </div>
      </div>
    )
  }

  const props = control.properties || {}
  
  // Get currently assigned rules for THIS control only
  // Rules are stored per control in control.properties.rules
  // Each control has its own unique ID, so rules are isolated per control
  const allAssignedRules = props.rules || []
  // For tables: when a cell (row+col) is selected, show only rules for that cell (per-cell, not per-column)
  const isTableCellSelected = control?.type === "table" && selectedTableRowForRules != null && selectedTableColumnForRules != null
  const cellTargetField = isTableCellSelected ? `${control.id}_row_${selectedTableRowForRules}_col_${selectedTableColumnForRules}` : null
  const ruleTargets = (rule) => {
    const targets = []
    if (Array.isArray(rule?.targetFields)) targets.push(...rule.targetFields)
    if (typeof rule?.targetField === "string") {
      if (rule.targetField.includes(",")) {
        targets.push(...rule.targetField.split(",").map((s) => s.trim()).filter(Boolean))
      } else {
        targets.push(rule.targetField.trim())
      }
    }
    return [...new Set(targets)]
  }
  const assignedRules = control?.type === "table" && isTableCellSelected
    ? allAssignedRules.filter((rule) => ruleTargets(rule).includes(cellTargetField))
    : allAssignedRules
  
  // Get current control's type in API format for filtering
  // When a table cell is selected, use the cell's type (the drag-dropped tool type), not Table
  const selectedCellTypeRaw = (() => {
    if (control?.type !== "table" || !isTableCellSelected) return null
    const props = control.properties || {}
    const columnTypes = Array.isArray(props.columnTypes) ? props.columnTypes : []
    const cellTypes = Array.isArray(props.cellTypes) ? props.cellTypes : []
    const row = selectedTableRowForRules ?? 0
    const col = selectedTableColumnForRules ?? 0
    let t = cellTypes[row]?.[col]
    if (!t || t === "empty") t = columnTypes[col] ?? "text"
    return t
  })()
  const effectiveControlType = isTableCellSelected && selectedCellTypeRaw != null
    ? mapControlType(selectedCellTypeRaw)
    : mapControlType(control?.type || "label")
  
  // Filter available rules by control type - only show rules compatible with this control (or selected cell's type)
  // Always include built-in rules so they can be assigned to any control
  const filteredAvailableRules = availableRules.filter(rule => {
    if (BUILTIN_RULES.some(br => br.id === rule.id)) return true
    if (rule.controlType) {
      return rule.controlType === effectiveControlType
    }
    return true
  })

  const normalDateFieldOptions = (allControls || [])
    .filter((c) => c && c.id && (c.type === "date" || c.type === "ukunkdate") && c.id !== control.id)
    .map((c) => ({
      id: c.id,
      label: c.label || c.properties?.labelText || c.id,
    }))
  const dropdownSourceFieldOptions = (allControls || [])
    .filter((c) => c && c.id && c.id !== control?.id && String(c.type || "").toLowerCase() === "select")
    .map((c) => {
      const suffix = String(c.id).slice(-8)
      const fullId = String(c.id)
      return {
        value: c.id,
        label: `${c.label || c.properties?.labelText || "Dropdown"} (${suffix})`,
        title: `Full control ID (use for rules / API / mapping):\n${fullId}\n\nShort suffix (${suffix}) matches the end of this id.`,
      }
    })
  const otherVisitDateControl = (allControls || []).find(
    (c) =>
      c &&
      c.id &&
      c.id !== control?.id &&
      c.type === "date" &&
      Boolean(c?.properties?.isVisitDate),
  )
  const canSetVisitDateIdentifier = !otherVisitDateControl || Boolean(props?.isVisitDate)

  const handlePropertyChange = (field, value) => {
    onUpdate(control.id, {
      properties: {
        ...props,
        [field]: value
      }
    })
  }

  const handleSizeChange = (delta) => {
    const newSize = Math.max(2, Math.min(12, (control.controlSize || 6) + delta))
    onUpdate(control.id, {
      controlSize: newSize
    })
  }

  const renderLabSectionTestLink = (hostType) => {
    if (!labFacilityIdForPanel || parentNormForLab?.sectionType !== SECTION_TYPE_LAB) return null
    if (!["text", "number", "lab"].includes(hostType)) return null
    const curId = props.labTestId != null ? String(props.labTestId) : ""
    return (
      <div className="border-t border-teal-200 bg-teal-50/40 pt-3 mt-3 rounded-lg px-2 pb-2 space-y-2">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-3.5 h-3.5 text-teal-600 shrink-0" />
          <span className="text-xs font-semibold text-teal-900">Lab test (reference range hint)</span>
        </div>
        <p className="text-[10px] text-slate-600 leading-snug">
          Link this field to a test configured for this lab facility. Entered numeric values get soft range warnings during data entry.
        </p>
        {loadingLabAssignments ? (
          <Skeleton className="h-9 w-full" />
        ) : labTestChoices.length === 0 ? (
          <p className="text-[10px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
            No active range assignments for this lab. Add them in Lab Management (Range assignments).
          </p>
        ) : (
          <div>
            <Label className="text-xs text-slate-500 block mb-1">Linked lab test</Label>
            <Select
              value={curId ? curId : "none"}
              onValueChange={(v) => {
                if (v === "none") {
                  handlePropertyChange("labTestId", "")
                  handlePropertyChange("labTestLabel", "")
                } else {
                  handlePropertyChange("labTestId", v)
                  const opt = labTestChoices.find((o) => o.id === v)
                  handlePropertyChange("labTestLabel", opt?.name || "")
                }
              }}
            >
              <SelectTrigger className="text-xs sm:text-sm h-9 w-full cursor-pointer">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent className="z-[100] bg-white opacity-100 shadow-lg">
                <SelectItem value="none" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">
                  None
                </SelectItem>
                {labTestChoices.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id} className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">
                    {opt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    )
  }

  const renderLabSectionTestLinkForTableCell = (row, col, cellType) => {
    if (!labFacilityIdForPanel || parentNormForLab?.sectionType !== SECTION_TYPE_LAB) return null
    if (!["text", "number", "lab"].includes(cellType)) return null
    const nr = Math.max(1, props.rows || 1)
    const nc = Math.max(1, props.columns || 1)
    const ids = resizeStringMatrix2D(props.cellLabTestIds, nr, nc, "")
    const curId = ids[row]?.[col] != null && String(ids[row][col]).trim() !== "" ? String(ids[row][col]) : ""
    const applyBinding = (nextId, nextLabel) => {
      const nextIds = resizeStringMatrix2D(props.cellLabTestIds, nr, nc, "")
      const nextLbs = resizeStringMatrix2D(props.cellLabTestLabels, nr, nc, "")
      nextIds[row][col] = nextId ? String(nextId) : ""
      nextLbs[row][col] = nextLabel ? String(nextLabel) : ""
      onUpdate(control.id, {
        properties: {
          ...props,
          cellLabTestIds: nextIds,
          cellLabTestLabels: nextLbs,
        },
      })
    }
    return (
      <div className="border-t border-teal-200 bg-teal-50/40 pt-3 mt-3 rounded-lg px-2 pb-2 space-y-2">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-3.5 h-3.5 text-teal-600 shrink-0" />
          <span className="text-xs font-semibold text-teal-900">Lab test — selected cell</span>
        </div>
        <p className="text-[10px] text-slate-600 leading-snug">
          Row {row + 1}, column {col + 1} ({cellType}). Soft range hints apply to this cell during data entry.
        </p>
        {loadingLabAssignments ? (
          <Skeleton className="h-9 w-full" />
        ) : labTestChoices.length === 0 ? (
          <p className="text-[10px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
            No active range assignments for this lab. Add them in Lab Management (Range assignments).
          </p>
        ) : (
          <div>
            <Label className="text-xs text-slate-500 block mb-1">Linked lab test</Label>
            <Select
              value={curId ? curId : "none"}
              onValueChange={(v) => {
                if (v === "none") applyBinding("", "")
                else {
                  const opt = labTestChoices.find((o) => o.id === v)
                  applyBinding(v, opt?.name || "")
                }
              }}
            >
              <SelectTrigger className="text-xs sm:text-sm h-9 w-full cursor-pointer">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent className="z-[100] bg-white opacity-100 shadow-lg">
                <SelectItem value="none" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">
                  None
                </SelectItem>
                {labTestChoices.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id} className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">
                    {opt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    )
  }

  const renderProperties = () => {
    const commonProps = (
      <>
        {/* Label Text */}
        {control.type !== "hr" && (
          <div>
            <Label className="text-xs font-medium mb-1.5 block text-slate-700">Label Text</Label>
            <Input
              value={props.labelText ?? control.label ?? ""}
              onChange={(e) => {
                const value = e.target.value
                // Single update so canvas and properties stay in sync (avoids stale state)
                onUpdate(control.id, {
                  label: value,
                  properties: { ...props, labelText: value },
                })
              }}
              maxLength={3000}
              placeholder="Enter label text"
              className="text-xs sm:text-sm h-9"
            />
          </div>
        )}

        {/* Label Position */}
        {control.type !== "label" && control.type !== "hr" && (
          <div>
            <Label className="text-xs font-medium mb-1.5 block text-slate-700">Label Position</Label>
            <Select
              value={props.labelPosition || "left"}
              onValueChange={(value) => handlePropertyChange("labelPosition", value)}
            >
              <SelectTrigger className="text-xs sm:text-sm h-9 w-full cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[100] bg-white opacity-100 shadow-lg">
                <SelectItem value="left" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Left</SelectItem>
                <SelectItem value="top" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Top</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Control Size */}
        <div>
          <Label className="text-xs font-medium mb-1.5 block text-slate-700">Control Size</Label>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSizeChange(-2)}
              disabled={(control.controlSize || 6) <= 2}
              className="h-9 w-9 p-0 flex-shrink-0 hover:bg-emerald-50 hover:border-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Minus className="w-4 h-4" />
            </Button>
            <Input
              value={control.controlSize || 6}
              readOnly
              className="text-center flex-1 min-w-[60px] h-9 text-sm font-semibold text-slate-700 bg-slate-50"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSizeChange(2)}
              disabled={(control.controlSize || 6) >= 12}
              className="h-9 w-9 p-0 flex-shrink-0 hover:bg-emerald-50 hover:border-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-4 h-4" />
            </Button>
            <span className="text-xs sm:text-sm text-slate-600 font-medium flex-shrink-0">
              ({(control.controlSize || 6) * (100 / 12)}%)
            </span>
          </div>
        </div>

        {/* Tooltip */}
        {control.type !== "hr" && (
          <div>
            <Label className="text-xs font-medium mb-1.5 block text-slate-700">Tooltip</Label>
            <Input
              value={props.tooltip || ""}
              onChange={(e) => handlePropertyChange("tooltip", e.target.value)}
              maxLength={200}
              placeholder="Enter tooltip"
              className="text-xs sm:text-sm h-9"
            />
          </div>
        )}

        {/* Required */}
        {control.type !== "hr" && control.type !== "label" && (
          <div>
            <Label className="text-xs font-medium mb-1.5 block text-slate-700">Required</Label>
            <Select
              value={props.required ? "required" : "not-required"}
              onValueChange={(value) => handlePropertyChange("required", value === "required")}
            >
              <SelectTrigger className="text-xs sm:text-sm h-9 w-full cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[100] bg-white opacity-100 shadow-lg">
                <SelectItem value="not-required" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Not Required</SelectItem>
                <SelectItem value="required" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Required</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Read Only */}
        {control.type !== "hr" && control.type !== "label" && (
          <div>
            <Label className="text-xs font-medium mb-1.5 block text-slate-700">Read Only</Label>
            <Select
              value={props.readonly ? "readonly" : "editable"}
              onValueChange={(value) => {
                const isRo = value === "readonly"
                // Single atomic update: avoid stale-props overwrite when toggling both flags.
                onUpdate(control.id, {
                  properties: {
                    ...props,
                    readonly: isRo,
                    designerReadonly: isRo,
                  },
                })
              }}
            >
              <SelectTrigger className="text-xs sm:text-sm h-9 w-full cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[100] bg-white opacity-100 shadow-lg">
                <SelectItem value="editable" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Editable</SelectItem>
                <SelectItem value="readonly" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Read Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Gender-specific visibility */}
        {control.type !== "hr" && control.type !== "label" && (
          <div>
            <Label className="text-xs font-medium mb-1.5 block text-slate-700">Gender Specific Options</Label>
            <Select
              value={(props.genderSpecific || "both").toLowerCase()}
              onValueChange={(value) => handlePropertyChange("genderSpecific", value)}
            >
              <SelectTrigger className="text-xs sm:text-sm h-9 w-full cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[100] bg-white opacity-100 shadow-lg">
                <SelectItem value="both" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Both</SelectItem>
                <SelectItem value="male" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Male</SelectItem>
                <SelectItem value="female" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Default Value */}
        {control.type !== "hr" && control.type !== "label" && (
          <div>
            <Label className="text-xs font-medium mb-1.5 block text-slate-700">Default Value</Label>
            <Input
              value={props.defaultValue || ""}
              onChange={(e) => handlePropertyChange("defaultValue", e.target.value)}
              maxLength={1000}
              placeholder="Enter default value"
              className="text-xs sm:text-sm h-9"
            />
          </div>
        )}

        {/* Rules Section */}
        {control.type !== "hr" && control.type !== "label" && (
          <div className="border-t border-slate-200 pt-4 mt-4">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <Label className="text-xs font-semibold text-slate-900">Rules</Label>
              </div>
              {control.type === "table" && !isTableCellSelected && (
                <p className="text-xs text-slate-500 mb-2 w-full">Rules apply to individual cells. Click a cell (row + column) in the table to see or assign rules for that cell only.</p>
              )}
              {control.type === "table" && isTableCellSelected && (
                <p className="text-xs text-emerald-600 font-medium mb-2">Showing rules for Row {selectedTableRowForRules + 1}, Column {selectedTableColumnForRules + 1}</p>
              )}
              {onOpenRuleModal && !(control.type === "table" && !isTableCellSelected) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // When creating manually (via Create button), always pass null for template ID
                    // This ensures RuleEngineTemplateId will be null in the API payload
                    onOpenRuleModal(control, null)
                    // Clear selected template ID since we're creating manually
                    setSelectedTemplateId(null)
                  }}
                  className="h-7 px-3 text-xs flex items-center gap-1.5 hover:bg-emerald-50 hover:border-emerald-300 transition-colors"
                  title="Create new rule for this control"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Create</span>
                </Button>
              )}
            </div>
            
            {/* Assign New Rule - only when a cell is selected for tables (rules are per cell) */}
            {!(control.type === "table" && !isTableCellSelected) && (
            <div className="mb-3">
              {availableRules.length > 0 ? (
              <Select
                value={selectedRuleId}
                onValueChange={async (value) => {
                  if (value && value !== "none") {
                    const rule = availableRules.find(r => r.id === value)
                    if (rule) {
                      // Prevent duplicate API calls - check if this rule is already being processed
                      if (processingRuleId === rule.id || savingRule) {
                        console.log("Rule is already being processed, skipping duplicate call")
                        setSelectedRuleId("")
                        return
                      }
                      
                      // CRITICAL: Capture the control ID and target field at the moment of rule assignment
                      const currentControlId = control?.id
                      const isTableCell = control?.type === "table" && isTableCellSelected
                      const targetFieldForRule = isTableCell
                        ? `${currentControlId}_row_${selectedTableRowForRules}_col_${selectedTableColumnForRules}`
                        : currentControlId
                      
                      if (!currentControlId) {
                        console.error("Cannot assign rule: Control ID is missing")
                        toast({
                          title: "Error",
                          description: "Control ID is missing. Please select a control first.",
                          variant: "destructive",
                        })
                        setSelectedRuleId("")
                        return
                      }
                      
                      // Store the template ID for potential use when creating new rules
                      setSelectedTemplateId(rule.id)
                      
                      const currentRules = props.rules || []
                      if (!currentRules.find(r => r.id === rule.id)) {
                        // Built-in rules: add locally only (no API template id)
                        if (BUILTIN_RULES.some(br => br.id === rule.id)) {
                          const localRule = {
                            id: rule.id,
                            ruleName: rule.ruleName,
                            ruleCategory: rule.ruleCategory,
                            ruleExpression: rule.ruleExpression || rule.expression,
                            message: rule.message || "",
                            targetField: targetFieldForRule,
                          }
                          handlePropertyChange("rules", [...currentRules, localRule])
                          toast({
                            title: "Rule Assigned",
                            description: rule.id === BUILTIN_SHOW_WHEN_OTHER_BODYPART_RULE.id
                              ? `"${rule.ruleName}" has been assigned. This field will show when "Other" is selected in Body Part Where Applied.`
                              : rule.id === BUILTIN_SHOW_WHEN_OTHER_ADVERSE_EVENT_RULE.id
                                ? `"${rule.ruleName}" has been assigned. This field will show when "Any Other Specify" is selected in Adverse Event Observed.`
                                : `"${rule.ruleName}" has been assigned. When eligibility is No, this field will be read-only.`,
                            variant: "success",
                          })
                          setSelectedRuleId("")
                          return
                        }

                        // Debug logging
                        console.log("=== Rule Selection Debug ===")
                        console.log("studyId:", studyId)
                        console.log("currentControlId (captured):", currentControlId)
                        console.log("control?.id (from props):", control?.id)
                        console.log("crfId:", crfId)
                        console.log("onSaveCrf:", typeof onSaveCrf)
                        console.log("rule:", rule)
                        
                        // Save the rule via API - auto-save CRF if needed
                        if (studyId && currentControlId) {
                          console.log("Condition met: studyId and control.id exist, proceeding with API call...")
                          setProcessingRuleId(rule.id) // Mark this rule as being processed
                          setSavingRule(true)
                          try {
                            // Auto-save CRF ONLY if it doesn't have an ID - do NOT call if ID already exists
                            let currentCrfId = crfId
                            // Strict check: only auto-save if crfId is null, undefined, or empty string
                            if ((!currentCrfId || currentCrfId === null || currentCrfId === "") && onSaveCrf) {
                              console.log("CRF ID is missing. Attempting to auto-save CRF before creating rule...")
                              try {
                                const savedCrfId = await onSaveCrf()
                                if (savedCrfId) {
                                  currentCrfId = savedCrfId
                                  console.log("CRF auto-saved successfully. New CRF ID:", savedCrfId)
                                  toast({
                                    title: "CRF Auto-Saved",
                                    description: "CRF Design has been saved automatically before creating the rule.",
                                  })
                                } else {
                                  toast({
                                    title: "Validation Error",
                                    description: "Cannot auto-save CRF. Please ensure Study, Visit, and CRF Name are selected/entered, then save the CRF manually before assigning rules.",
                                    variant: "destructive",
                                  })
                                  setSavingRule(false)
                                  setSelectedRuleId("")
                                  return
                                }
                              } catch (error) {
                                console.error("Error auto-saving CRF:", error)
                                toast({
                                  title: "Error",
                                  description: error.message || "Cannot auto-save CRF. Please ensure Study, Visit, and CRF Name are selected/entered, then save the CRF manually before assigning rules.",
                                  variant: "destructive",
                                  className: "animate-in slide-in-from-top-5 duration-500",
                                })
                                setSavingRule(false)
                                setSelectedRuleId("")
                                return
                              }
                            } else if (!currentCrfId || currentCrfId === null || currentCrfId === "") {
                              console.warn("Cannot create rule: CRF ID is missing and no save function provided.")
                              toast({
                                title: "Validation Error",
                                description: "CRF Design must be saved before assigning rules. Please save the CRF first.",
                                variant: "destructive",
                                className: "animate-in slide-in-from-top-5 duration-500",
                              })
                              setSavingRule(false)
                              setSelectedRuleId("")
                              return
                            }
                            
                            // If CRF ID already exists, proceed directly to create rule - NO need to call UpdateCrfDesign
                            console.log("=== Rule Assignment Flow ===")
                            console.log("CRF ID exists:", currentCrfId, "- Proceeding directly to create rule without updating CRF")
                            console.log("Only calling CreateCrfRule API - NO CreateCrfDesign or UpdateCrfDesign calls")
                            console.log("Using captured control ID:", currentControlId)

                            // Map rule template to API payload format
                            // Extract expression - check both expression and ruleExpression fields
                            const ruleExpression = rule.expression || rule.ruleExpression || ""
                            
                            if (!ruleExpression || ruleExpression.trim() === "") {
                              console.warn("Rule template has no expression:", rule)
                              toast({
                                title: "Validation Error",
                                description: "Selected rule template does not have an expression. Please select a different rule or create a new one.",
                                variant: "destructive",
                                className: "animate-in slide-in-from-top-5 duration-500",
                              })
                              setSavingRule(false)
                              setSelectedRuleId("")
                              return
                            }

                            const apiPayload = {
                              crfId: currentCrfId,
                              studyId: studyId,
                              ruleName: rule.ruleName || `Rule for ${control?.label || control?.properties?.labelText || currentControlId}`,
                              category: rule.category || "Validation",
                              expression: ruleExpression.trim(), // Use extracted expression
                              message: rule.message || "",
                              severity: rule.severity || "Hard",
                              targetField: targetFieldForRule, // Table cell: controlId_row_R_col_C; else control ID
                              trigger: rule.trigger || "OnChange",
                              controlType: effectiveControlType, // Cell type when table cell selected (e.g. DatePicker), else control type
                              ruleEngineTemplateId: rule.id || 0, // Use the template ID, default to 0 if not available
                            }
                            
                            console.log("=== Rule Assignment Payload ===")
                            console.log("targetField (captured control ID):", currentControlId)
                            console.log("Full payload:", JSON.stringify(apiPayload, null, 2))

                            console.log("=== Creating CRF Rule from template ===")
                            console.log("Payload:", JSON.stringify(apiPayload, null, 2))
                            console.log("API Endpoint:", "/api/CrfRules/CreateCrfRule")
                            const response = await crfRuleService.createCrfRule(apiPayload)
                            
                            console.log("=== API Response ===")
                            console.log("Response:", JSON.stringify(response, null, 2))

                            if (response.isSuccess && response.data) {
                              // For table cells always use targetFieldForRule so the rule shows for this cell (API may return table id only)
                              const savedRule = {
                                id: response.data.id,
                                ruleName: response.data.ruleName || rule.ruleName,
                                ruleCategory: rule.ruleCategory || rule.category?.toLowerCase() || "validation",
                                ruleExpression: response.data.expression || rule.ruleExpression || rule.expression || "",
                                message: response.data.message || rule.message || "",
                                targetField: isTableCell ? targetFieldForRule : (response.data.targetField ?? targetFieldForRule),
                              }

                              handlePropertyChange("rules", [...currentRules, savedRule])
                              
                              toast({
                                title: "Rule Assigned",
                                description: `Rule "${savedRule.ruleName}" has been saved and assigned to this control.`,
                                variant: "success",
                                className: "border-emerald-300 bg-gradient-to-br from-emerald-50 via-green-50 to-emerald-50 text-emerald-900 shadow-lg shadow-emerald-200/30",
                              })
                            } else if (response.httpStatus === 404 || (response.message && String(response.message).includes("404"))) {
                              // UAT/backend may not have CreateCrfRule – add rule locally so user can continue
                              const localRule = {
                                id: `local_${rule.id}_${targetFieldForRule}_${Date.now()}`,
                                ruleName: rule.ruleName,
                                ruleCategory: rule.ruleCategory || rule.category?.toLowerCase() || "validation",
                                ruleExpression: rule.ruleExpression || rule.expression || "",
                                message: rule.message || "",
                                targetField: targetFieldForRule,
                              }
                              handlePropertyChange("rules", [...currentRules, localRule])
                              toast({
                                title: "Rule added locally",
                                description: "Rule was added to this control. Save the CRF to keep it. (Server endpoint may not be available on this environment.)",
                                variant: "default",
                              })
                            } else {
                              throw new Error(response.message || "Failed to save rule")
                            }
                          } catch (error) {
                            console.error("Error saving rule:", error)
                            // For table cells still add rule locally so it shows in UI (backend may not accept cell targetField yet)
                            if (isTableCell) {
                              const localRule = {
                                id: `local_${rule.id}_${targetFieldForRule}_${Date.now()}`,
                                ruleName: rule.ruleName,
                                ruleCategory: rule.ruleCategory || rule.category?.toLowerCase() || "validation",
                                ruleExpression: rule.expression || rule.ruleExpression || "",
                                message: rule.message || "",
                                targetField: targetFieldForRule,
                              }
                              handlePropertyChange("rules", [...currentRules, localRule])
                              toast({
                                title: "Rule added for this cell",
                                description: "Rule is assigned in the form design. If backend does not support table-cell targets yet, save the CRF to keep the assignment.",
                                variant: "default",
                              })
                            } else {
                              toast({
                                title: "Error",
                                description: error.message || "Failed to save rule. Please try again.",
                                variant: "destructive",
                                className: "animate-in slide-in-from-top-5 duration-500",
                              })
                            }
                          } finally {
                            setSavingRule(false)
                            setProcessingRuleId(null) // Clear processing flag
                          }
                        } else {
                          // If no studyId or control.id, just add locally (for backward compatibility)
                          console.warn("Cannot save rule via API - missing studyId or control.id")
                          console.log("studyId:", studyId, "control?.id:", control?.id)
                          handlePropertyChange("rules", [...currentRules, {
                            id: rule.id,
                            ruleName: rule.ruleName,
                            ruleCategory: rule.ruleCategory,
                            ruleExpression: rule.ruleExpression,
                            message: rule.message,
                            targetField: targetFieldForRule,
                          }])
                          toast({
                            title: "Rule Added Locally",
                            description: "Rule added to control but not saved to database. Please ensure Study is selected and control is valid.",
                            variant: "default",
                          })
                        }
                      }
                    }
                    setSelectedRuleId("")
                  } else {
                    setSelectedTemplateId(null)
                  }
                }}
              >
                  <SelectTrigger 
                  className="text-xs h-9 w-full cursor-pointer pointer-events-auto border-slate-300 hover:border-emerald-400 focus:border-emerald-500 transition-colors"
                  disabled={savingRule}
                >
                  <SelectValue placeholder={savingRule ? "Saving rule..." : "Select a rule to assign"} />
                </SelectTrigger>
                  <SelectContent className="z-[100] bg-white opacity-100 shadow-lg">
                    <SelectItem value="none" className="text-xs cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">
                      -- Select Rule --
                    </SelectItem>
                    {filteredAvailableRules
                      .filter(rule => !assignedRules.find(r => r.id === rule.id))
                      .map((rule) => (
                        <SelectItem 
                          key={rule.id} 
                          value={rule.id}
                          className="text-xs cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50"
                        >
                          <div className="flex flex-col gap-0.5 py-0.5">
                            <span className="font-medium">{rule.ruleName}</span>
                            <span className="text-[10px] text-slate-500 capitalize">
                              {getRuleCategoryDisplayLabel(rule)}
                            </span>
                          </div>
                    </SelectItem>
                  ))}
                    {filteredAvailableRules.filter(rule => assignedRules.find(r => r.id === rule.id)).length > 0 && (
                      <div className="px-2 py-1.5 border-t border-slate-200 mt-1">
                        <p className="text-[10px] text-slate-500 font-medium">
                          {filteredAvailableRules.filter(rule => assignedRules.find(r => r.id === rule.id)).length} rule(s) already assigned — use Create to add a new rule
                        </p>
                      </div>
                    )}
                </SelectContent>
              </Select>
              ) : loadingRules ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center">
                  <div className="w-full space-y-2">
                    <Skeleton className="h-3.5 w-28 bg-slate-200/80" />
                    <Skeleton className="h-3.5 w-40 bg-slate-200/70" />
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-xs text-slate-500 text-center">
                  No rules available. Create rules in Rule Designer first.
                </p>
                </div>
              )}
            </div>
            )}

            {/* Assigned Rules List - for table, only show when a cell is selected (rules are per cell) */}
            {control.type === "table" && isTableCellSelected && assignedRules.length === 0 && (
              <p className="text-xs text-slate-500 py-2">No rules assigned to this cell.</p>
            )}
            {!(control.type === "table" && !isTableCellSelected) && assignedRules.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-slate-600">
                    {control.type === "table" && isTableCellSelected
                      ? `Assigned Rules for Row ${selectedTableRowForRules + 1}, Col ${selectedTableColumnForRules + 1} (${assignedRules.length})`
                      : `Assigned Rules (${assignedRules.length})`}
                  </Label>
                </div>
                {assignedRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="group p-3 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg text-xs hover:border-emerald-300 hover:shadow-sm transition-all duration-200"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <FlaskConical className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <div className="font-semibold text-emerald-900 truncate">
                          {rule.ruleName}
                        </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-medium capitalize">
                            {getRuleCategoryDisplayLabel(rule)}
                          </span>
                          {control?.type === "table" && rule.targetField && control?.id && (() => {
                            const tf = String(rule.targetField)
                            const rowColMatch = tf.match(new RegExp(`^${control.id}_row_(\\d+)_col_(\\d+)$`))
                            if (rowColMatch) {
                              return (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 text-[10px] font-medium">
                                  Row {parseInt(rowColMatch[1], 10) + 1}, Col {parseInt(rowColMatch[2], 10) + 1}
                                </span>
                              )
                            }
                            const colMatch = tf.startsWith(control.id + "_col_") && tf.split("_col_")[1]
                            const colNum = colMatch != null ? parseInt(colMatch, 10) : NaN
                            return !isNaN(colNum) ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 text-[10px] font-medium">
                                Column {colNum + 1}
                              </span>
                            ) : null
                          })()}
                        </div>
                        <div className="mt-2 p-2 bg-white/70 border border-emerald-100 rounded text-[10px] font-mono text-slate-700 break-all max-h-20 overflow-y-auto">
                          <span className="font-semibold text-slate-600">Expression: </span>
                          {(() => {
                            const raw = rule.ruleExpression || rule.expression || ""
                            const decoded = decodeHtmlEntities(raw)
                            const fieldLabelMap = createFieldLabelMap(allControls)
                            return replaceFieldIdsWithLabels(decoded, fieldLabelMap) || raw
                          })()}
                        </div>
                        {rule.message && (
                          <div className="mt-1.5 p-1.5 bg-amber-50 border border-amber-200 rounded text-[10px] text-slate-700">
                            <span className="font-semibold text-amber-800">Message: </span>
                            <span className="text-amber-900">{rule.message}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {onEditRule && (
                          <button
                            onClick={() => onEditRule(rule)}
                            className="text-emerald-600 hover:text-emerald-800 p-1.5 rounded-md hover:bg-emerald-50 transition-colors group-hover:opacity-100 opacity-70"
                            title="Edit rule"
                            aria-label="Edit rule"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        <button
                        onClick={async () => {
                          // CRITICAL: Delete rule from API if it has an ID (saved rule)
                          // Only delete from local state if it's a local-only rule
                          if (rule.id && studyId) {
                            try {
                              console.log("=== Deleting Rule from API ===")
                              console.log("Rule ID:", rule.id)
                              console.log("Study ID:", studyId)
                              
                              const deleteResponse = await crfRuleService.deleteCrfRule(rule.id, studyId)
                              
                              if (deleteResponse.isSuccess) {
                                console.log("Rule deleted successfully from API")
                                // Remove from full rules list (allAssignedRules), not just filtered view
                                const updatedRules = allAssignedRules.filter(r => r.id !== rule.id)
                                handlePropertyChange("rules", updatedRules)
                                
                                toast({
                                  title: "Rule Deleted",
                                  description: `Rule "${rule.ruleName}" has been removed from this control.`,
                                })
                              } else {
                                throw new Error(deleteResponse.message || "Failed to delete rule")
                              }
                            } catch (error) {
                              console.error("Error deleting rule from API:", error)
                              toast({
                                title: "Error",
                                description: error.message || "Failed to delete rule from server. It may still appear after reload.",
                                variant: "destructive",
                              })
                              // Still remove from local state even if API call fails
                              const updatedRules = allAssignedRules.filter(r => r.id !== rule.id)
                              handlePropertyChange("rules", updatedRules)
                            }
                          } else {
                            // Local-only rule (not saved to API yet) - just remove from local state
                            console.log("Removing local-only rule (not saved to API)")
                            const updatedRules = allAssignedRules.filter(r => r.id !== rule.id)
                            handlePropertyChange("rules", updatedRules)
                            
                            toast({
                              title: "Rule Removed",
                              description: `Rule "${rule.ruleName}" has been removed.`,
                            })
                          }
                        }}
                        className="text-red-500 hover:text-red-700 p-1.5 rounded-md hover:bg-red-50 transition-colors group-hover:opacity-100 opacity-70"
                        title="Remove rule"
                        aria-label="Remove rule"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </>
    )

    switch (control.type) {
      case "label":
        return (
          <>
            {commonProps}
            <div className="border-t border-slate-200 pt-4 mt-4">
            <div>
                <Label className="text-xs font-medium mb-1.5 block text-slate-700">Font Weight</Label>
              <Select
                value={props.fontWeight || "normal"}
                onValueChange={(value) => handlePropertyChange("fontWeight", value === "normal" ? "" : value)}
              >
                  <SelectTrigger className="text-xs sm:text-sm h-9 w-full cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                  <SelectContent className="z-[100] bg-white opacity-100 shadow-lg">
                    <SelectItem value="normal" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Normal</SelectItem>
                    <SelectItem value="bold" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Bold</SelectItem>
                </SelectContent>
              </Select>
            </div>
              <div className="mt-3">
                <Label className="text-xs font-medium mb-1.5 block text-slate-700">Text Decoration</Label>
              <Select
                value={props.textDecoration || "none"}
                onValueChange={(value) => handlePropertyChange("textDecoration", value === "none" ? "" : value)}
              >
                  <SelectTrigger className="text-xs sm:text-sm h-9 w-full cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                  <SelectContent className="z-[100] bg-white opacity-100 shadow-lg">
                    <SelectItem value="none" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">None</SelectItem>
                    <SelectItem value="underline" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Underline</SelectItem>
                    <SelectItem value="line-through" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Strike out</SelectItem>
                    <SelectItem value="overline" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Overline</SelectItem>
                </SelectContent>
              </Select>
              </div>
            </div>
          </>
        )

      case "text":
        return (
          <>
            {commonProps}
            <div className="border-t border-slate-200 pt-4 mt-4 space-y-3">
            <div>
                <Label className="text-xs font-medium mb-1.5 block text-slate-700">Multiline</Label>
              <Select
                value={props.multiline ? "multiline" : "single-line"}
                onValueChange={(value) => handlePropertyChange("multiline", value === "multiline")}
              >
                  <SelectTrigger className="text-xs sm:text-sm h-9 w-full cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                  <SelectContent className="z-[100] bg-white opacity-100 shadow-lg">
                    <SelectItem value="single-line" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Single Line</SelectItem>
                    <SelectItem value="multiline" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Multiline</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block text-slate-700">
                Terminology coding (eCRF)
              </Label>
              <Select
                value={
                  normalizeTerminologyCoding(props.terminologyCoding) === "meddra"
                    ? "meddra"
                    : normalizeTerminologyCoding(props.terminologyCoding) === "whodd"
                      ? "whodd"
                      : "none"
                }
                onValueChange={(value) =>
                  handlePropertyChange("terminologyCoding", value === "none" ? "" : value)
                }
              >
                <SelectTrigger className="text-xs sm:text-sm h-9 w-full cursor-pointer">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent className="z-[100] bg-white opacity-100 shadow-lg">
                  <SelectItem value="none" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">
                    None
                  </SelectItem>
                  <SelectItem value="meddra" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">
                    MedDRA (lookup saves term + code)
                  </SelectItem>
                  <SelectItem value="whodd" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">
                    WHODrug / ATC (lookup saves name + code)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">
                Data entry shows M or W; lookup fills <span className="font-medium text-slate-600">Name (code)</span>{" "}
                (code chip when not editing).
              </p>
            </div>
            <div>
                <Label className="text-xs font-medium mb-1.5 block text-slate-700">Max Length</Label>
              <Input
                type="number"
                value={props.maxLength || 500}
                onChange={(e) => handlePropertyChange("maxLength", parseInt(e.target.value))}
                min={1}
                  className="text-xs sm:text-sm h-9"
              />
            </div>
            <div>
                <Label className="text-xs font-medium mb-1.5 block text-slate-700">Placeholder</Label>
              <Input
                value={props.placeholder || ""}
                onChange={(e) => handlePropertyChange("placeholder", e.target.value)}
                maxLength={30}
                  placeholder="Enter placeholder text"
                  className="text-xs sm:text-sm h-9"
              />
            </div>
            <div>
                <Label className="text-xs font-medium mb-1.5 block text-slate-700">Postfix</Label>
              <Input
                value={props.postfix || ""}
                onChange={(e) => handlePropertyChange("postfix", e.target.value)}
                maxLength={30}
                  placeholder="Enter postfix text"
                  className="text-xs sm:text-sm h-9"
              />
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 space-y-3">
                <Label className="text-xs font-medium text-emerald-900">
                  Set value from dropdown mapping
                </Label>
                <div>
                  <Label className="text-xs font-medium mb-1.5 block text-slate-700">
                    Source dropdown field
                  </Label>
                  <SearchableSelect
                    value={props.autoValueMapSourceFieldId || ""}
                    options={dropdownSourceFieldOptions}
                    onChange={(value) => {
                      const sourceId = String(value || "").trim()
                      if (!sourceId) {
                        handlePropertyChange("autoValueMapSourceFieldId", "")
                        return
                      }
                      const sourceControl = (allControls || []).find(
                        (c) => String(c?.id || "") === sourceId,
                      )
                      const nextRules =
                        sourceControl && String(sourceControl?.type || "").toLowerCase() === "select"
                          ? buildAutoMapScaffoldFromSelect(
                              props.autoValueMapRules || "",
                              sourceControl,
                            )
                          : props.autoValueMapRules || ""
                      onUpdate(control.id, {
                        properties: {
                          ...props,
                          autoValueMapSourceFieldId: sourceId,
                          autoValueMapRules: nextRules,
                        },
                      })
                      if (
                        sourceControl &&
                        String(sourceControl?.type || "").toLowerCase() === "select" &&
                        selectCsvOptionKeys(sourceControl).length === 0
                      ) {
                        toast({
                          title: "No dropdown options yet",
                          description:
                            "Add Comma Separated Values on the source dropdown first — then pick it again here to scaffold mapping rows.",
                          variant: "destructive",
                        })
                      }
                    }}
                    placeholder="Select source dropdown..."
                    showSearch
                    contentClassName="z-[260]"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Choosing a source auto-fills mapping keys from that dropdown’s option list — you only type what to display after{" "}
                    <span className="font-medium">=&gt;</span>.
                    If multiple Score fields exist, use the id suffix in brackets.
                  </p>
                </div>
                <div>
                  <Label className="text-xs font-medium mb-1.5 block text-slate-700">
                    Value mapping (compact)
                  </Label>
                  <Textarea
                    value={props.autoValueMapRules || ""}
                    onChange={(e) => handlePropertyChange("autoValueMapRules", e.target.value)}
                    placeholder={`0=>, 1=>, 2=>, default=>`}
                    className="text-xs min-h-[90px]"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Auto-filled keys from source CSV; comma or newline. Example:{" "}
                    <span className="font-medium">1=&gt;A, 2=&gt;B, default=&gt;</span>
                  </p>
                  {props.autoValueMapSourceFieldId ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-1.5 h-7 text-[11px]"
                      onClick={() => {
                        const sourceControl = (allControls || []).find(
                          (c) => String(c?.id || "") === String(props.autoValueMapSourceFieldId || ""),
                        )
                        if (!sourceControl) return
                        handlePropertyChange(
                          "autoValueMapRules",
                          buildAutoMapScaffoldFromSelect(props.autoValueMapRules || "", sourceControl),
                        )
                      }}
                    >
                      Reload keys from source dropdown
                    </Button>
                  ) : null}
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium mb-1.5 block text-slate-700">
                  Dynamic Min Date (from field)
                </Label>
                <Select
                  value={props.minDateFromFieldId || "none"}
                  onValueChange={(value) =>
                    handlePropertyChange("minDateFromFieldId", value === "none" ? "" : value)
                  }
                >
                  <SelectTrigger className="text-xs sm:text-sm h-9 w-full cursor-pointer">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent className="z-[100] bg-white opacity-100 shadow-lg">
                    <SelectItem value="none" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">
                      None
                    </SelectItem>
                    {normalDateFieldOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id} className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-medium mb-1.5 block text-slate-700">
                  Dynamic Max Date (from field)
                </Label>
                <Select
                  value={props.maxDateFromFieldId || "none"}
                  onValueChange={(value) =>
                    handlePropertyChange("maxDateFromFieldId", value === "none" ? "" : value)
                  }
                >
                  <SelectTrigger className="text-xs sm:text-sm h-9 w-full cursor-pointer">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent className="z-[100] bg-white opacity-100 shadow-lg">
                    <SelectItem value="none" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">
                      None
                    </SelectItem>
                    {normalDateFieldOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id} className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {renderLabSectionTestLink("text")}
          </>
        )

      case "number":
        return (
          <>
            {commonProps}
            <div className="border-t border-slate-200 pt-4 mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
            <div>
                  <Label className="text-xs font-medium mb-1.5 block text-slate-700">Min</Label>
              <Input
                type="number"
                value={props.min || ""}
                onChange={(e) => handlePropertyChange("min", e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="Min value"
                    className="text-xs sm:text-sm h-9"
              />
            </div>
            <div>
                  <Label className="text-xs font-medium mb-1.5 block text-slate-700">Max</Label>
              <Input
                type="number"
                value={props.max || ""}
                onChange={(e) => handlePropertyChange("max", e.target.value ? parseFloat(e.target.value) : null)}
                    placeholder="Max value"
                    className="text-xs sm:text-sm h-9"
              />
                </div>
            </div>
            <div>
                <Label className="text-xs font-medium mb-1.5 block text-slate-700">After Decimal Point</Label>
              <Input
                type="number"
                value={props.scale || 0}
                onChange={(e) => handlePropertyChange("scale", parseInt(e.target.value))}
                min={0}
                max={10}
                  className="text-xs sm:text-sm h-9"
              />
            </div>
            <div>
                <Label className="text-xs font-medium mb-1.5 block text-slate-700">Placeholder</Label>
              <Input
                value={props.placeholder || ""}
                onChange={(e) => handlePropertyChange("placeholder", e.target.value)}
                maxLength={30}
                  placeholder="Enter placeholder text"
                  className="text-xs sm:text-sm h-9"
              />
            </div>
            <div>
                <Label className="text-xs font-medium mb-1.5 block text-slate-700">Postfix</Label>
              <Input
                value={props.postfix || ""}
                onChange={(e) => handlePropertyChange("postfix", e.target.value)}
                maxLength={30}
                  placeholder="Enter postfix text"
                  className="text-xs sm:text-sm h-9"
              />
              </div>
            </div>
            {renderLabSectionTestLink("number")}
          </>
        )

      case "lab":
        return (
          <>
            {commonProps}
            {renderLabSectionTestLink("lab")}
          </>
        )

      case "date":
        return (
          <>
            {commonProps}
            <div className="border-t border-slate-200 pt-4 mt-4 space-y-3">
              <div>
                <Label className="text-xs font-medium mb-1.5 block text-slate-700">
                  Visit Date Identifier
                </Label>
                <Select
                  value={props.isVisitDate ? "yes" : "no"}
                  onValueChange={(value) => {
                    if (value === "yes" && !canSetVisitDateIdentifier) {
                      toast({
                        title: "Only one visit date allowed",
                        description: `Already assigned to ${otherVisitDateControl?.label || otherVisitDateControl?.properties?.labelText || otherVisitDateControl?.id}.`,
                        variant: "destructive",
                      })
                      return
                    }
                    handlePropertyChange("isVisitDate", value === "yes")
                  }}
                >
                  <SelectTrigger className="text-xs sm:text-sm h-9 w-full cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[100] bg-white opacity-100 shadow-lg">
                    <SelectItem value="no" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">
                      No
                    </SelectItem>
                    <SelectItem
                      value="yes"
                      disabled={!canSetVisitDateIdentifier}
                      className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Yes (Primary Visit Date)
                    </SelectItem>
                  </SelectContent>
                </Select>
                {!canSetVisitDateIdentifier && (
                  <p className="mt-1 text-[11px] text-amber-700">
                    One field already uses this identifier:{" "}
                    <span className="font-medium">
                      {otherVisitDateControl?.label || otherVisitDateControl?.properties?.labelText || otherVisitDateControl?.id}
                    </span>
                  </p>
                )}
              </div>
              <div>
                <Label className="text-xs font-medium mb-1.5 block text-slate-700">
                  Date Selection Rule
                </Label>
                <Select
                  value={props.dateRestriction || "none"}
                  onValueChange={(value) =>
                    handlePropertyChange(
                      "dateRestriction",
                      value === "none" ? "" : value
                    )
                  }
                >
                  <SelectTrigger className="text-xs sm:text-sm h-9 w-full cursor-pointer">
                    <SelectValue placeholder="No restriction" />
                  </SelectTrigger>
                  <SelectContent className="z-[100] bg-white opacity-100 shadow-lg">
                    <SelectItem
                      value="none"
                      className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50"
                    >
                      No restriction
                    </SelectItem>
                    <SelectItem
                      value="allowPast"
                      className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50"
                    >
                      Allow past dates only
                    </SelectItem>
                    <SelectItem
                      value="allowFuture"
                      className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50"
                    >
                      Allow future dates only
                    </SelectItem>
                    <SelectItem
                      value="onlyToday"
                      className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50"
                    >
                      Only current date
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        )

      case "ukunkdate":
        return (
          <>
            {commonProps}
          </>
        )

      case "select":
        return (
          <>
            {commonProps}
            <div className="border-t border-slate-200 pt-4 mt-4 space-y-3">
            <div>
                <Label className="text-xs font-medium mb-1.5 block text-slate-700">Data Source</Label>
              <Select
                value={props.dataSource || "none"}
                onValueChange={(value) => handlePropertyChange("dataSource", value === "none" ? "" : value)}
              >
                  <SelectTrigger className="text-xs sm:text-sm h-9 w-full cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                  <SelectContent className="z-[100] bg-white opacity-100 shadow-lg">
                    <SelectItem value="none" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">None</SelectItem>
                    <SelectItem value="csv" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Comma Separated Values</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {props.dataSource === "csv" && (
              <div>
                  <Label className="text-xs font-medium mb-1.5 block text-slate-700">Comma Separated Values</Label>
                  <Textarea
                  value={props.csvValues || ""}
                  onChange={(e) => handlePropertyChange("csvValues", e.target.value)}
                  maxLength={2000}
                  placeholder="Option 1, Option 2, Option 3"
                    className="text-xs sm:text-sm min-h-[80px] resize-y"
                    rows={3}
                />
              </div>
            )}
            <div>
                <Label className="text-xs font-medium mb-1.5 block text-slate-700">Multiple</Label>
              <Select
                value={props.multiple ? "multiple" : "single"}
                onValueChange={(value) => handlePropertyChange("multiple", value === "multiple")}
              >
                  <SelectTrigger className="text-xs sm:text-sm h-9 w-full cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                  <SelectContent className="z-[100] bg-white opacity-100 shadow-lg">
                    <SelectItem value="single" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Single</SelectItem>
                    <SelectItem value="multiple" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Multiple</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
                <Label className="text-xs font-medium mb-1.5 block text-slate-700">Placeholder</Label>
              <Input
                value={props.placeholder || ""}
                onChange={(e) => handlePropertyChange("placeholder", e.target.value)}
                maxLength={30}
                  placeholder="Enter placeholder text"
                  className="text-xs sm:text-sm h-9"
              />
              </div>
            </div>
          </>
        )

      case "radio":
      case "checkbox":
        return (
          <>
            {commonProps}
            <div className="border-t border-slate-200 pt-4 mt-4 space-y-3">
            <div>
                <Label className="text-xs font-medium mb-1.5 block text-slate-700">Direction</Label>
              <Select
                value={props.alignment || "horizontal"}
                onValueChange={(value) => handlePropertyChange("alignment", value)}
              >
                  <SelectTrigger className="text-xs sm:text-sm h-9 w-full cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                  <SelectContent className="z-[100] bg-white opacity-100 shadow-lg">
                    <SelectItem value="horizontal" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Horizontal</SelectItem>
                    <SelectItem value="vertical" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Vertical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
                <Label className="text-xs font-medium mb-1.5 block text-slate-700">Options (Comma Separated)</Label>
                <Textarea
                value={props.csvValues || "Option 1"}
                onChange={(e) => handlePropertyChange("csvValues", e.target.value)}
                placeholder="Option 1, Option 2, Option 3"
                  className="text-xs sm:text-sm min-h-[80px] resize-y"
                  rows={3}
              />
              </div>
            </div>
          </>
        )

      case "file":
        return (
          <>
            {commonProps}
            <div className="border-t border-slate-200 pt-4 mt-4">
            <div>
                <Label className="text-xs font-medium mb-1.5 block text-slate-700">Multiple</Label>
              <Select
                value={props.multiple ? "multiple" : "single"}
                onValueChange={(value) => handlePropertyChange("multiple", value === "multiple")}
              >
                  <SelectTrigger className="text-xs sm:text-sm h-9 w-full cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                  <SelectContent className="z-[100] bg-white opacity-100 shadow-lg">
                    <SelectItem value="single" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Single</SelectItem>
                    <SelectItem value="multiple" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Multiple</SelectItem>
                </SelectContent>
              </Select>
              </div>
            </div>
          </>
        )

      case "table":
        const numColumns = Math.max(1, props.columns || 1)
        const columnHeaders = Array.isArray(props.columnHeaders) ? props.columnHeaders : []
        const paddedHeaders = Array.from({ length: numColumns }, (_, i) => columnHeaders[i] ?? `Column ${i + 1}`)
        return (
          <>
            {commonProps}
            <div className="border-t border-slate-200 pt-4 mt-4 space-y-3">
            <div>
                <Label className="text-xs font-medium mb-1.5 block text-slate-700">Table Type</Label>
              <Select
                value={props.addRow ? "Y" : "N"}
                onValueChange={(value) => handlePropertyChange("addRow", value === "Y")}
              >
                  <SelectTrigger className="text-xs sm:text-sm h-9 w-full cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                  <SelectContent className="z-[100] bg-white opacity-100 shadow-lg">
                    <SelectItem value="N" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Fixed Table</SelectItem>
                    <SelectItem value="Y" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Dynamic Table</SelectItem>
                </SelectContent>
              </Select>
            </div>
              <div className="grid grid-cols-2 gap-3">
            <div>
                  <Label className="text-xs font-medium mb-1.5 block text-slate-700">Rows</Label>
              <Input
                type="number"
                value={props.rows || 1}
                onChange={(e) => {
                  const newRows = Math.max(1, parseInt(e.target.value) || 1)
                  const newRequiredRow = (props.requiredRow != null && props.requiredRow >= newRows) ? null : props.requiredRow
                  onUpdate(control.id, {
                    properties: {
                      ...props,
                      rows: newRows,
                      ...(newRequiredRow !== props.requiredRow ? { requiredRow: newRequiredRow } : {})
                    }
                  })
                }}
                min={1}
                    className="text-xs sm:text-sm h-9"
              />
            </div>
            <div>
                  <Label className="text-xs font-medium mb-1.5 block text-slate-700">Columns</Label>
              <Input
                type="number"
                value={props.columns || 1}
                onChange={(e) => {
                  const newCols = parseInt(e.target.value) || 1
                  const n = Math.max(1, Math.min(20, newCols))
                  const current = Array.isArray(props.columnHeaders) ? props.columnHeaders : []
                  const nextHeaders = Array.from({ length: n }, (_, i) => current[i] ?? `Column ${i + 1}`)
                  const newRequired = (props.requiredColumn != null && props.requiredColumn >= n) ? null : props.requiredColumn
                  const currentTypes = Array.isArray(props.columnTypes) ? props.columnTypes : []
                  const nextTypes = Array.from({ length: n }, (_, i) => currentTypes[i] ?? 'text')
                  const currentAlign = Array.isArray(props.columnAlignment) ? props.columnAlignment : []
                  const nextAlignment = Array.from({ length: n }, (_, i) => currentAlign[i] ?? 'horizontal')
                  const currentDateRestrictions = Array.isArray(props.columnDateRestrictions) ? props.columnDateRestrictions : []
                  const nextDateRestrictions = Array.from({ length: n }, (_, i) => currentDateRestrictions[i] ?? '')
                  const currentTerminology = Array.isArray(props.columnTerminologyCoding) ? props.columnTerminologyCoding : []
                  const nextTerminology = Array.from({ length: n }, (_, i) => currentTerminology[i] ?? "")
                  onUpdate(control.id, {
                    properties: {
                      ...props,
                      columns: n,
                      columnHeaders: nextHeaders,
                      columnTypes: nextTypes,
                      columnAlignment: nextAlignment,
                      columnDateRestrictions: nextDateRestrictions,
                      columnTerminologyCoding: nextTerminology,
                      ...(newRequired !== props.requiredColumn ? { requiredColumn: newRequired } : {})
                    }
                  })
                }}
                min={1}
                max={20}
                    className="text-xs sm:text-sm h-9"
              />
                </div>
            </div>
            <p className="text-xs text-slate-500">Click column headers in the table to edit their names. Drag tools from the toolbox into table cells to set control types.</p>
            {/* When a typed column is selected: show same properties as corresponding normal control */}
            {(() => {
              const columnTypes = Array.isArray(props.columnTypes) ? props.columnTypes : []
              const cellTypes = Array.isArray(props.cellTypes) ? props.cellTypes : []
              const types = Array.from({ length: numColumns }, (_, colIdx) => {
                for (let r = 0; r < (cellTypes.length || 0); r++) {
                  const t = cellTypes[r]?.[colIdx]
                  if (t && t !== 'empty') return t
                }
                return columnTypes[colIdx] ?? 'text'
              })
              const optionColumns = types
                .map((t, idx) => (t === 'select' || t === 'radio' || t === 'checkbox' ? idx : -1))
                .filter(i => i >= 0)
              const dateColumns = types
                .map((t, idx) => (t === 'date' ? idx : -1))
                .filter(i => i >= 0)
              const optionValues = Array.isArray(props.columnOptionValues) ? props.columnOptionValues : []
              const dateRestrictions = Array.isArray(props.columnDateRestrictions) ? props.columnDateRestrictions : []
              const columnAlignment = Array.isArray(props.columnAlignment) ? props.columnAlignment : []

              const col = selectedTableColumnForRules
              const isOptionColumn = col != null && (types[col] === 'select' || types[col] === 'radio' || types[col] === 'checkbox')
              const isDateColumn = col != null && types[col] === 'date'
              const isTextColumn = col != null && types[col] === 'text'

              if (isOptionColumn) {
                const typeLabel = types[col] === 'select' ? 'Option List' : types[col] === 'radio' ? 'Option Button' : 'Check Box'
                const colRequired = props.requiredColumn === col
                const colAlignment = columnAlignment[col] || 'horizontal'
                return (
                  <div className="border-t border-slate-200 pt-4 mt-4 space-y-3">
                    <p className="text-xs font-medium text-slate-700">Column — {paddedHeaders[col] || `Column ${col + 1}`} ({typeLabel})</p>
                    <div>
                      <Label className="text-xs font-medium mb-1.5 block text-slate-700">Label Text</Label>
                      <Input
                        value={paddedHeaders[col] ?? ''}
                        onChange={(e) => {
                          const current = Array.isArray(props.columnHeaders) ? [...props.columnHeaders] : []
                          const next = Array.from({ length: numColumns }, (_, i) => current[i] ?? `Column ${i + 1}`)
                          next[col] = e.target.value
                          handlePropertyChange("columnHeaders", next)
                        }}
                        placeholder="Column label"
                        className="text-xs sm:text-sm h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium mb-1.5 block text-slate-700">Required</Label>
                      <Select
                        value={colRequired ? "required" : "not-required"}
                        onValueChange={(v) => {
                          if (v === "required") handlePropertyChange("requiredColumn", col)
                          else if (props.requiredColumn === col) handlePropertyChange("requiredColumn", null)
                        }}
                      >
                        <SelectTrigger className="text-xs sm:text-sm h-9 w-full cursor-pointer">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[100] bg-white opacity-100 shadow-lg">
                          <SelectItem value="not-required" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Not Required</SelectItem>
                          <SelectItem value="required" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Required</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {(types[col] === 'radio' || types[col] === 'checkbox') && (
                      <div>
                        <Label className="text-xs font-medium mb-1.5 block text-slate-700">Direction</Label>
                        <Select
                          value={colAlignment}
                          onValueChange={(value) => {
                            const current = Array.isArray(props.columnAlignment) ? [...props.columnAlignment] : []
                            const next = Array.from({ length: numColumns }, (_, i) => current[i] ?? 'horizontal')
                            next[col] = value
                            handlePropertyChange("columnAlignment", next)
                          }}
                        >
                          <SelectTrigger className="text-xs sm:text-sm h-9 w-full cursor-pointer">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="z-[100] bg-white opacity-100 shadow-lg">
                            <SelectItem value="horizontal" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Horizontal</SelectItem>
                            <SelectItem value="vertical" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Vertical</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div>
                      <Label className="text-xs font-medium mb-1.5 block text-slate-700">Options (Comma Separated)</Label>
                      <Textarea
                        value={optionValues[col] ?? ''}
                        onChange={(e) => {
                          const current = Array.isArray(props.columnOptionValues) ? [...props.columnOptionValues] : []
                          const next = Array.from({ length: numColumns }, (_, i) => current[i] ?? '')
                          next[col] = e.target.value
                          handlePropertyChange("columnOptionValues", next)
                        }}
                        placeholder="Option 1, Option 2, Option 3"
                        className="text-xs sm:text-sm min-h-[80px] resize-y"
                        rows={3}
                      />
                    </div>
                  </div>
                )
              }

              if (isDateColumn) {
                const dateRestriction = dateRestrictions[col] || "none"
                const colRequired = props.requiredColumn === col
                return (
                  <div className="border-t border-slate-200 pt-4 mt-4 space-y-3">
                    <p className="text-xs font-medium text-slate-700">Column — {paddedHeaders[col] || `Column ${col + 1}`} (Date Picker)</p>
                    <div>
                      <Label className="text-xs font-medium mb-1.5 block text-slate-700">Label Text</Label>
                      <Input
                        value={paddedHeaders[col] ?? ''}
                        onChange={(e) => {
                          const current = Array.isArray(props.columnHeaders) ? [...props.columnHeaders] : []
                          const next = Array.from({ length: numColumns }, (_, i) => current[i] ?? `Column ${i + 1}`)
                          next[col] = e.target.value
                          handlePropertyChange("columnHeaders", next)
                        }}
                        placeholder="Column label"
                        className="text-xs sm:text-sm h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium mb-1.5 block text-slate-700">Required</Label>
                      <Select
                        value={colRequired ? "required" : "not-required"}
                        onValueChange={(v) => {
                          if (v === "required") handlePropertyChange("requiredColumn", col)
                          else if (props.requiredColumn === col) handlePropertyChange("requiredColumn", null)
                        }}
                      >
                        <SelectTrigger className="text-xs sm:text-sm h-9 w-full cursor-pointer">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[100] bg-white opacity-100 shadow-lg">
                          <SelectItem value="not-required" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Not Required</SelectItem>
                          <SelectItem value="required" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Required</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs font-medium mb-1.5 block text-slate-700">Date Selection Rule</Label>
                      <Select
                        value={dateRestriction}
                        onValueChange={(value) => {
                          const current = Array.isArray(props.columnDateRestrictions) ? [...props.columnDateRestrictions] : []
                          const next = Array.from({ length: numColumns }, (_, i) => current[i] ?? "")
                          next[col] = value === "none" ? "" : value
                          handlePropertyChange("columnDateRestrictions", next)
                        }}
                      >
                        <SelectTrigger className="text-xs sm:text-sm h-9 w-full cursor-pointer">
                          <SelectValue placeholder="No restriction" />
                        </SelectTrigger>
                        <SelectContent className="z-[100] bg-white opacity-100 shadow-lg">
                          <SelectItem value="none" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">No restriction</SelectItem>
                          <SelectItem value="allowPast" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Allow past dates only</SelectItem>
                          <SelectItem value="allowFuture" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Allow future dates only</SelectItem>
                          <SelectItem value="onlyToday" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Only current date</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )
              }

              if (isTextColumn) {
                const columnTerminologyCoding = Array.isArray(props.columnTerminologyCoding)
                  ? props.columnTerminologyCoding
                  : []
                const tcRaw = columnTerminologyCoding[col] || ""
                const tcSelect =
                  normalizeTerminologyCoding(tcRaw) === "meddra"
                    ? "meddra"
                    : normalizeTerminologyCoding(tcRaw) === "whodd"
                      ? "whodd"
                      : "none"
                const colRequired = props.requiredColumn === col
                return (
                  <div className="border-t border-slate-200 pt-4 mt-4 space-y-3">
                    <p className="text-xs font-medium text-slate-700">
                      Column — {paddedHeaders[col] || `Column ${col + 1}`} (Text Box)
                    </p>
                    <div>
                      <Label className="text-xs font-medium mb-1.5 block text-slate-700">Label Text</Label>
                      <Input
                        value={paddedHeaders[col] ?? ""}
                        onChange={(e) => {
                          const current = Array.isArray(props.columnHeaders) ? [...props.columnHeaders] : []
                          const next = Array.from({ length: numColumns }, (_, i) => current[i] ?? `Column ${i + 1}`)
                          next[col] = e.target.value
                          handlePropertyChange("columnHeaders", next)
                        }}
                        placeholder="Column label"
                        className="text-xs sm:text-sm h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium mb-1.5 block text-slate-700">Required</Label>
                      <Select
                        value={colRequired ? "required" : "not-required"}
                        onValueChange={(v) => {
                          if (v === "required") handlePropertyChange("requiredColumn", col)
                          else if (props.requiredColumn === col) handlePropertyChange("requiredColumn", null)
                        }}
                      >
                        <SelectTrigger className="text-xs sm:text-sm h-9 w-full cursor-pointer">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[100] bg-white opacity-100 shadow-lg">
                          <SelectItem value="not-required" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Not Required</SelectItem>
                          <SelectItem value="required" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Required</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs font-medium mb-1.5 block text-slate-700">
                        Terminology coding (eCRF)
                      </Label>
                      <Select
                        value={tcSelect}
                        onValueChange={(value) => {
                          const current = Array.isArray(props.columnTerminologyCoding)
                            ? [...props.columnTerminologyCoding]
                            : []
                          const next = Array.from({ length: numColumns }, (_, i) => current[i] ?? "")
                          next[col] = value === "none" ? "" : value
                          handlePropertyChange("columnTerminologyCoding", next)
                        }}
                      >
                        <SelectTrigger className="text-xs sm:text-sm h-9 w-full cursor-pointer">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent className="z-[100] bg-white opacity-100 shadow-lg">
                          <SelectItem value="none" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">
                            None
                          </SelectItem>
                          <SelectItem value="meddra" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">
                            MedDRA (term + code)
                          </SelectItem>
                          <SelectItem value="whodd" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">
                            WHODrug / ATC (name + code)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500 mt-1">
                        Applies to this text column across all rows (M/W search on data entry).
                      </p>
                    </div>
                  </div>
                )
              }

              if (optionColumns.length === 0 && dateColumns.length === 0) return null
              return (
                <div>
                  <Label className="text-xs font-medium mb-1.5 block text-slate-700">Column settings</Label>
                  <p className="text-xs text-slate-500 mb-2">Click a column in the table to edit full per-column properties. Quick edit for option columns below:</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {optionColumns.map((colIdx) => {
                      const typeLabel = types[colIdx] === 'select' ? 'Option List' : types[colIdx] === 'radio' ? 'Option Button' : 'Check Box'
                      return (
                        <div key={colIdx} className="flex flex-col gap-1">
                          <span className="text-xs text-slate-600 font-medium">Col {colIdx + 1} ({paddedHeaders[colIdx] || `Column ${colIdx + 1}`}) — {typeLabel}</span>
                          <Input
                            value={optionValues[colIdx] ?? ''}
                            onChange={(e) => {
                              const current = Array.isArray(props.columnOptionValues) ? [...props.columnOptionValues] : []
                              const next = Array.from({ length: numColumns }, (_, i) => current[i] ?? '')
                              next[colIdx] = e.target.value
                              handlePropertyChange("columnOptionValues", next)
                            }}
                            placeholder="Option 1, Option 2, Option 3"
                            className="text-xs sm:text-sm h-9"
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
            {selectedTableRowForRules != null && selectedTableColumnForRules != null && (
              <div>
                <Label className="text-xs font-medium mb-1.5 block text-slate-700">Required (selected cell)</Label>
                {(() => {
                  const row = selectedTableRowForRules
                  const col = selectedTableColumnForRules
                  const list = Array.isArray(props.requiredCells)
                    ? [...props.requiredCells]
                    : (props.requiredCell && typeof props.requiredCell === "object" && props.requiredCell.row != null && props.requiredCell.col != null
                      ? [props.requiredCell]
                      : [])
                  const isRequiredCell = list.some(c => c && c.row === row && c.col === col)
                  return (
                    <>
                      <Select
                        value={isRequiredCell ? "required" : "not-required"}
                        onValueChange={(v) => {
                          const next = list.filter(c => !(c && c.row === row && c.col === col))
                          if (v === "required") next.push({ row, col })
                          handlePropertyChange("requiredCells", next)
                        }}
                      >
                        <SelectTrigger className="text-xs sm:text-sm h-9 w-full cursor-pointer">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="z-[100] bg-white opacity-100 shadow-lg">
                          <SelectItem value="not-required" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Not Required</SelectItem>
                          <SelectItem value="required" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Required</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500 mt-1">
                        Row {row + 1}, {paddedHeaders[col] || `Col ${col + 1}`} now behaves like a normal field required toggle.
                      </p>
                    </>
                  )
                })()}
              </div>
            )}
            {selectedTableRowForRules != null && selectedTableColumnForRules != null && (() => {
              let ct = props.cellTypes?.[selectedTableRowForRules]?.[selectedTableColumnForRules]
              const columnTypesTbl = Array.isArray(props.columnTypes) ? props.columnTypes : []
              if (!ct || ct === "empty") ct = columnTypesTbl[selectedTableColumnForRules] ?? "text"
              return renderLabSectionTestLinkForTableCell(
                selectedTableRowForRules,
                selectedTableColumnForRules,
                ct,
              )
            })()}
            <div>
              <Label className="text-xs font-medium mb-1.5 block text-slate-700">Required column</Label>
              <Select
                value={props.requiredColumn != null && props.requiredColumn >= 0 ? String(props.requiredColumn) : "none"}
                onValueChange={(v) => handlePropertyChange("requiredColumn", v === "none" ? null : parseInt(v, 10))}
              >
                <SelectTrigger className="text-xs sm:text-sm h-9 w-full cursor-pointer">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent className="z-[100] bg-white opacity-100 shadow-lg">
                  <SelectItem value="none" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">None</SelectItem>
                  {Array.from({ length: numColumns }, (_, i) => (
                    <SelectItem key={i} value={String(i)} className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">
                      {paddedHeaders[i] || `Column ${i + 1}`} {i === 0 ? "(first)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">Only the selected column will be marked as required.</p>
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block text-slate-700">Required row</Label>
              <Select
                value={props.requiredRow != null && props.requiredRow >= 0 ? String(props.requiredRow) : "none"}
                onValueChange={(v) => handlePropertyChange("requiredRow", v === "none" ? null : parseInt(v, 10))}
              >
                <SelectTrigger className="text-xs sm:text-sm h-9 w-full cursor-pointer">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent className="z-[100] bg-white opacity-100 shadow-lg">
                  <SelectItem value="none" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">None</SelectItem>
                  {Array.from({ length: Math.max(1, props.rows || 1) }, (_, i) => (
                    <SelectItem key={i} value={String(i)} className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">
                      Row {i + 1} {i === 0 ? "(first)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">Only the selected row will be marked as required.</p>
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block text-slate-700">Required cells (multiple choice)</Label>
              <p className="text-xs text-slate-500 mb-2">Mark one or more specific cells as required (e.g. Row 2+3 and Col 3+4). Add each cell below.</p>
              {(() => {
                const list = Array.isArray(props.requiredCells) ? props.requiredCells : (props.requiredCell && typeof props.requiredCell === 'object' && props.requiredCell.row != null && props.requiredCell.col != null ? [props.requiredCell] : [])
                const addCell = (row, col) => {
                  const next = Array.isArray(props.requiredCells) ? [...props.requiredCells] : (props.requiredCell ? [props.requiredCell] : [])
                  if (next.some(c => c.row === row && c.col === col)) return
                  next.push({ row, col })
                  handlePropertyChange("requiredCells", next)
                }
                const removeCell = (idx) => {
                  const next = (Array.isArray(props.requiredCells) ? [...props.requiredCells] : []).filter((_, i) => i !== idx)
                  handlePropertyChange("requiredCells", next.length ? next : [])
                }
                return (
                  <div className="space-y-2">
                    <div className="max-h-32 overflow-y-auto space-y-1.5">
                      {list.map((cell, idx) => (
                        <div key={`${cell.row}-${cell.col}-${idx}`} className="flex items-center justify-between gap-2 text-xs bg-slate-50 rounded px-2 py-1.5 border border-slate-200">
                          <span className="text-slate-700">Row {cell.row + 1}, {paddedHeaders[cell.col] || `Col ${cell.col + 1}`}</span>
                          <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-500 hover:text-red-600" onClick={() => removeCell(idx)} aria-label="Remove">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-slate-500 block mb-1">Row</Label>
                        <Select
                          value={addRequiredCellRow != null ? String(addRequiredCellRow) : "none"}
                          onValueChange={(v) => setAddRequiredCellRow(v === "none" ? null : parseInt(v, 10))}
                        >
                          <SelectTrigger className="text-xs sm:text-sm h-9 w-full cursor-pointer">
                            <SelectValue placeholder="Row" />
                          </SelectTrigger>
                          <SelectContent className="z-[100] bg-white opacity-100 shadow-lg">
                            <SelectItem value="none" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">—</SelectItem>
                            {Array.from({ length: Math.max(1, props.rows || 1) }, (_, i) => (
                              <SelectItem key={i} value={String(i)} className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">Row {i + 1}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-500 block mb-1">Column</Label>
                        <Select
                          value={addRequiredCellCol != null ? String(addRequiredCellCol) : "none"}
                          onValueChange={(v) => setAddRequiredCellCol(v === "none" ? null : parseInt(v, 10))}
                        >
                          <SelectTrigger className="text-xs sm:text-sm h-9 w-full cursor-pointer">
                            <SelectValue placeholder="Column" />
                          </SelectTrigger>
                          <SelectContent className="z-[100] bg-white opacity-100 shadow-lg">
                            <SelectItem value="none" className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">—</SelectItem>
                            {Array.from({ length: numColumns }, (_, i) => (
                              <SelectItem key={i} value={String(i)} className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50">{paddedHeaders[i] || `Col ${i + 1}`}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => { const r = addRequiredCellRow ?? 0; const c = addRequiredCellCol ?? 0; addCell(r, c); setAddRequiredCellRow(null); setAddRequiredCellCol(null); }} disabled={addRequiredCellRow == null && addRequiredCellCol == null}>
                      <Plus className="w-3.5 h-3.5 mr-1.5" /> Add required cell
                    </Button>
                  </div>
                )
              })()}
            </div>
            {props.addRow && (
              <div>
                  <Label className="text-xs font-medium mb-1.5 block text-slate-700">Maximum Rows</Label>
                <Input
                  type="number"
                  value={props.maxRows || 1}
                  onChange={(e) => handlePropertyChange("maxRows", parseInt(e.target.value))}
                  min={1}
                  max={200}
                    className="text-xs sm:text-sm h-9"
                />
              </div>
            )}
            </div>
          </>
        )

      default:
        return commonProps
    }
  }

  return (
    <div className="h-full min-h-0 flex flex-col bg-white">
      <div className="p-3 sm:p-4 flex-shrink-0 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-emerald-50/30 z-10">
        <h3 className="font-semibold text-slate-900 text-sm sm:text-base">Properties</h3>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide p-3 sm:p-4 space-y-3 sm:space-y-4">
        <div className="pb-2 border-b border-slate-100">
          <Label className="text-xs font-medium text-slate-500 mb-1 block">Control Type</Label>
          {control.type === "table" && isTableCellSelected ? (() => {
            const props = control.properties || {}
            const columnTypes = Array.isArray(props.columnTypes) ? props.columnTypes : []
            const cellTypes = Array.isArray(props.cellTypes) ? props.cellTypes : []
            const row = selectedTableRowForRules ?? 0
            const col = selectedTableColumnForRules ?? 0
            let cellType = cellTypes[row]?.[col]
            if (!cellType || cellType === "empty") cellType = columnTypes[col] ?? "text"
            const cellTypeLabels = { date: "Date Picker", ukunkdate: "UK/UNK Date Picker", time: "Time Picker", text: "Text Box", number: "Number", select: "Option List", radio: "Option Button", checkbox: "Check Box", file: "File Upload", lab: "Lab", label: "Label" }
            const cellTypeLabel = cellTypeLabels[cellType] || cellType
            const colTc = normalizeTerminologyCoding((props.columnTerminologyCoding || [])[col])
            return (
              <>
                <p className="text-sm font-semibold text-emerald-700">{cellTypeLabel}</p>
                <p className="text-xs text-slate-500 mt-0.5">Table cell (Row {row + 1}, Col {col + 1})</p>
                {cellType === "text" && colTc === "meddra" && (
                  <p className="text-xs text-emerald-600 mt-0.5 font-medium">Dictionary: MedDRA (M — Name (code) in field)</p>
                )}
                {cellType === "text" && colTc === "whodd" && (
                  <p className="text-xs text-emerald-600 mt-0.5 font-medium">Dictionary: WHODrug ATC (W — Name (code) in field)</p>
                )}
              </>
            )
          })() : (
            <>
              <p className="text-sm font-semibold capitalize text-emerald-700">
                {control.type === "text" ? "Text Box" : control.type}
              </p>
              {control.type === "text" && normalizeTerminologyCoding(control.properties?.terminologyCoding) === "meddra" && (
                <p className="text-xs text-emerald-600 mt-0.5 font-medium">Dictionary: MedDRA (M — Name (code) in field)</p>
              )}
              {control.type === "text" && normalizeTerminologyCoding(control.properties?.terminologyCoding) === "whodd" && (
                <p className="text-xs text-emerald-600 mt-0.5 font-medium">Dictionary: WHODrug ATC (W — Name (code) in field)</p>
              )}
            </>
          )}
        </div>
        {renderProperties()}
        {isCdashEnabled && control?.type === "table" && !isTableCellSelected ? (
          <p className="text-xs text-slate-500 mt-3 px-0.5">
            CDASH mapping applies to individual table cells. Click a cell (row + column) in the table to map a CDASH variable for that cell.
          </p>
        ) : null}
        {isCdashEnabled && cdashTargetControl ? (
          <CdashPropertiesSection
            control={cdashTargetControl}
            studyId={studyId}
            crfDesignId={crfId}
            mappings={cdashMappings}
            getFieldLabel={getCdashFieldLabel}
            onChange={onCdashMappingsChange}
            onDirty={onCdashMappingsDirty}
            disabled={cdashMappingDisabled}
          />
        ) : null}
      </div>
    </div>
  )
}

export default PropertiesPanel

