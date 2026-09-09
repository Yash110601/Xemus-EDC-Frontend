"use client"

import { useState, useEffect, useRef } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Plus, X, Type, Hash, Calendar, Clock, CheckSquare, Circle, List, Minus, Search, ChevronDown, Check } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { crfRuleService } from "@/lib/services"
import {
  createFieldLabelMap,
  replaceFieldIdsWithLabels,
  createLabelToIdMap,
  replaceRuleDisplayTokensWithIds,
  decodeHtmlEntities,
  normalizeRuleCategory,
  isDateRestrictionRule,
  DATE_RESTRICTION_RULE_MARKER,
  findUnresolvedRuleLabelTokens,
  buildRuleFieldMetaById,
  parseRuleExpressionToParts,
  serializeRuleExpressionParts,
  normalizeRuleExpressionLiterals,
  sanitizeRuleLiteralPartValue,
  finalizeRuleExpressionForApi,
} from "./ruleEvaluator"
import RuleExpressionChipEditor from "./RuleExpressionChipEditor"

const RuleCreationModal = ({ 
  open, 
  onClose, 
  control, 
  allControls = [],
  onRuleCreated,
  onRuleUpdated = null,
  editingRule = null,
  initialTargetTableColumn = null,
  initialTargetTableRow = null,
  crfId = null,
  studyId = null,
  onSaveCrf = null,
  ruleEngineTemplateId = null
}) => {
  const { toast } = useToast()
  const [ruleName, setRuleName] = useState("")
  const [ruleCategory, setRuleCategory] = useState("")
  const [ruleExpression, setRuleExpression] = useState("")
  const [expressionParts, setExpressionParts] = useState([])
  const [message, setMessage] = useState("")
  const [severity, setSeverity] = useState("Hard")
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  // For table controls: target cell by row + column (0-based) for per-cell rules
  const [targetTableColumn, setTargetTableColumn] = useState(null)
  const [targetTableRow, setTargetTableRow] = useState(null)
  // Optional: apply this same rule to additional fields (one rule → many targets). Backend may support targetFields array.
  const [additionalTargetIds, setAdditionalTargetIds] = useState([])
  // When true, show the list of fields for "Also apply this rule to". Collapsed by default; user checks to expand.
  const [showAlsoApplyTo, setShowAlsoApplyTo] = useState(false)
  const [targetsPickerOpen, setTargetsPickerOpen] = useState(false)
  const [availableFieldsSearch, setAvailableFieldsSearch] = useState("")
  // Snapshot of controls when modal opens so "Available Fields" always shows the fields used while designing the rule
  const [controlsForExpression, setControlsForExpression] = useState([])
  const isEditing = Boolean(editingRule?.id)
  const ruleNameInputRef = useRef(null)
  const ruleExpressionRef = useRef(null)
  const modalWasOpenRef = useRef(false)

  const baseRuleCategories = [
    { text: "Show Action", value: "show", apiValue: "Show" },
    { text: "Hide Action", value: "hide", apiValue: "Hide" },
    { text: "Disable Action", value: "disable", apiValue: "Disable" },
    { text: "Enable Action", value: "enable", apiValue: "Enable" },
    { text: "Compute Action", value: "compute", apiValue: "Compute" },
    { text: "Submit Action", value: "submit", apiValue: "Submit" },
    { text: "Retro Action", value: "retro", apiValue: "Retro" },
  ]
  const dateRestrictionCategory = { text: "Date Restriction", value: "date_restriction", apiValue: "DateRestriction" }

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
      "select": "OptionList",      // CrfControlType.OptionList = 9
      "hr": "Divider",             // CrfControlType.Divider = 10
      "table": "Table",            // CrfControlType.Table = 11
      "lab": "Lab",                // CrfControlType.Lab = 12
    }
    return typeMap[type] || "Label"
  }

  const normalizeRuleText = (value) =>
    String(value || "")
      .replace(/&gt;/g, ">")
      .replace(/&lt;/g, "<")
      .replace(/&amp;/g, "&")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')

  /** Compute: "Height Height" or "ctrl_a ctrl_a" → insert missing * between duplicate adjacent fields. */
  const fixMissingMultiplyBetweenDuplicateFields = (expression, labelToIdMap = {}) => {
    let result = normalizeRuleText(expression || "")
    const labels = Object.keys(labelToIdMap || {})
      .filter((label) => label && String(label).trim().length > 0)
      .sort((a, b) => b.length - a.length)
    labels.forEach((label) => {
      const escaped = String(label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      result = result.replace(new RegExp(`(${escaped})\\s+\\1`, "gi"), "$1 * $1")
    })
    result = result.replace(/\b(ctrl_[A-Za-z0-9_]+)\s+\1\b/g, "$1 * $1")
    return result
  }

  const validateRuleExpressionShape = (expression, category) => {
    const raw = normalizeRuleText(expression || "")
    if (!raw.trim()) return "Rule Expression is required."
    const isCompute = String(category || "").toLowerCase() === "compute"
    if (isCompute) {
      if (/\bctrl_[A-Za-z0-9_]+\s+ctrl_[A-Za-z0-9_]+\b/.test(raw)) {
        return 'Missing operator between fields. Use * between fields (example: Height * Height).'
      }
      const labelAdjacent = /\b([A-Za-z][A-Za-z0-9 ]{0,40})\s+\1\b/i.exec(raw)
      if (labelAdjacent) {
        return `Missing operator between "${labelAdjacent[1]}" fields. Click * or use: ${labelAdjacent[1]} * ${labelAdjacent[1]}`
      }
    }
    // Common authoring typo from operator row clicks: "-- \"Yes\"" instead of "== \"Yes\""
    if (/(^|[^A-Za-z0-9_])--\s*["']/.test(raw)) {
      return "Invalid operator '--'. Use == for comparisons, e.g. Field == \"Yes\"."
    }
    // Non-compute rule categories should be boolean conditions with a comparator.
    const needsComparator = ["show", "hide", "enable", "disable", "validation", "submit", "retro", "date_restriction"].includes(
      String(category || "").toLowerCase()
    )
    if (needsComparator && !/(===|!==|==|!=|>=|<=|>|<)/.test(raw)) {
      return "Rule expression must include a comparison operator (==, !=, >, >=, <, <=)."
    }
    return ""
  }

  const buildExtendedLabelToIdMap = (controls = []) => {
    const base = createLabelToIdMap(controls)
    const next = { ...base }
    controls.forEach((c) => {
      if (String(c?.type || "").toLowerCase() !== "table") return
      const tableId = String(c?.id || "").trim()
      if (!tableId) return
      const tableLabel = String(c?.label || c?.properties?.labelText || "").trim()
      const rows = Math.max(1, Number(c?.properties?.rows || 1))
      const cols = Math.max(1, Number(c?.properties?.columns || 1))
      const headers = Array.isArray(c?.properties?.columnHeaders) ? c.properties.columnHeaders : []
      for (let rowIdx = 0; rowIdx < rows; rowIdx++) {
        const rowLabel = `Row ${rowIdx + 1}`
        for (let colIdx = 0; colIdx < cols; colIdx++) {
          const header = String(headers[colIdx] != null && headers[colIdx] !== "" ? headers[colIdx] : `Column ${colIdx + 1}`).trim()
          const cellId = `${tableId}_row_${rowIdx}_col_${colIdx}`
          const variants = [
            `${tableLabel ? `${tableLabel} - ` : ""}${header} (${rowLabel})`,
            `${header} (${rowLabel})`,
          ]
          variants.forEach((variant) => {
            if (variant && !next[variant]) next[variant] = cellId
            const normalizedVariant = normalizeRuleText(variant)
            if (normalizedVariant && !next[normalizedVariant]) next[normalizedVariant] = cellId
          })
        }
      }
    })
    return next
  }

  const operators = [
    { label: "==", tooltip: "Equal (loose)" },
    { label: "===", tooltip: "Strict equal (same type and value)" },
    { label: "!=", tooltip: "Not Equal" },
    { label: ">", tooltip: "Greater Than" },
    { label: ">=", tooltip: "Greater Than Equal" },
    { label: "<", tooltip: "Less Than" },
    { label: "<=", tooltip: "Less Than Equal" },
    { label: "&&", tooltip: "And Operator" },
    { label: "||", tooltip: "Or Operator" },
    { label: "+", tooltip: "Add" },
    { label: "-", tooltip: "Subtract" },
    { label: "*", tooltip: "Multiply" },
    { label: "/", tooltip: "Divide" },
    { label: "(", tooltip: "Open Parenthesis" },
    { label: ")", tooltip: "Close Parenthesis" },
  ]

  // Reset form when modal closes; when opening, snapshot allControls so rule expression shows the same fields used while designing
  useEffect(() => {
    if (!open) {
      modalWasOpenRef.current = false
      setRuleName("")
      setRuleCategory("")
      setRuleExpression("")
      setExpressionParts([])
      setMessage("")
      setSeverity("Hard")
      setTargetTableColumn(null)
      setAdditionalTargetIds([])
      setShowAlsoApplyTo(false)
      setTargetsPickerOpen(false)
      setAvailableFieldsSearch("")
      setControlsForExpression([])
      setFieldErrors({})
    } else {
      const justOpened = !modalWasOpenRef.current
      modalWasOpenRef.current = true
      // Capture current controls when modal opens so Available Fields list is stable and shows design-time fields
      setControlsForExpression(allControls || [])
      if (justOpened && !editingRule) {
        setRuleExpression("")
        setExpressionParts([])
      }
    }
    if (open && editingRule) {
      setRuleName(editingRule.ruleName || "")
      const nextCategory = isDateRestrictionRule(editingRule)
        ? "date_restriction"
        : normalizeRuleCategory(editingRule.ruleCategory || editingRule.category || "")
      setRuleCategory(nextCategory)
      const rawExpression = editingRule.ruleExpression || editingRule.expression || ""
      const decoded = normalizeRuleExpressionLiterals(decodeHtmlEntities(rawExpression))
      const controlsForLabelMap = allControls && allControls.length ? allControls : controlsForExpression
      const fieldLabelMap = createFieldLabelMap(controlsForLabelMap)
      const displayExpression = replaceFieldIdsWithLabels(decoded, fieldLabelMap)
      setRuleExpression(displayExpression)
      const fieldMeta = buildRuleFieldMetaById(controlsForLabelMap)
      setExpressionParts(parseRuleExpressionToParts(displayExpression, fieldMeta))
      setMessage(editingRule.message || "")
      setSeverity(editingRule.severity || "Hard")
      // Parse targetField for table: "tableId_row_0_col_1" (cell) or "tableId_col_0" (legacy column)
      if (control?.type === "table" && editingRule.targetField && control?.id) {
        const tf = String(editingRule.targetField)
        const rowColMatch = tf.match(new RegExp(`^${control.id}_row_(\\d+)_col_(\\d+)$`))
        if (rowColMatch) {
          setTargetTableRow(parseInt(rowColMatch[1], 10))
          setTargetTableColumn(parseInt(rowColMatch[2], 10))
        } else if (tf.startsWith(control.id + "_col_")) {
          const colPart = tf.split("_col_")[1]
          const colNum = parseInt(colPart, 10)
          setTargetTableRow(null)
          setTargetTableColumn(!isNaN(colNum) ? colNum : null)
        } else {
          setTargetTableRow(null)
          setTargetTableColumn(null)
        }
      } else {
        setTargetTableRow(null)
        setTargetTableColumn(null)
      }
      // Parse targetField when editing: comma-separated means "also apply to" those ids; pre-fill and expand section
      const tf = editingRule.targetField ?? editingRule.targetFields
      if (typeof tf === "string" && tf.includes(",") && control?.id) {
        const ids = tf.split(",").map((s) => s.trim()).filter(Boolean)
        const primaryId =
          control?.type === "table" && control?.id && targetTableRow != null && targetTableColumn != null
            ? `${control.id}_row_${targetTableRow}_col_${targetTableColumn}`
            : control.id
        const others = ids.filter((id) => id !== primaryId)
        setAdditionalTargetIds(others)
        setShowAlsoApplyTo(others.length > 0)
      } else if (Array.isArray(tf) && tf.length > 0 && control?.id) {
        const primaryId =
          control?.type === "table" && control?.id && targetTableRow != null && targetTableColumn != null
            ? `${control.id}_row_${targetTableRow}_col_${targetTableColumn}`
            : control.id
        const others = tf.filter((id) => id !== primaryId)
        setAdditionalTargetIds(others)
        setShowAlsoApplyTo(others.length > 0)
      }
    } else if (control?.type === "table") {
      setTargetTableRow(initialTargetTableRow != null ? initialTargetTableRow : null)
      setTargetTableColumn(initialTargetTableColumn != null ? initialTargetTableColumn : null)
    }
  }, [open, editingRule, control?.type, control?.id, initialTargetTableColumn, initialTargetTableRow, allControls])


  const isComputeRuleCategory = String(ruleCategory || "").toLowerCase() === "compute"

  const appendExpressionPart = (part) => {
    if (!part) return
    setExpressionParts((prev) => [...prev, part])
    if (fieldErrors.ruleExpression) {
      setFieldErrors((prev) => ({ ...prev, ruleExpression: "" }))
    }
  }

  const handleOperatorClick = (op) => {
    const value = String(op || "").trim()
    if (!value) return
    appendExpressionPart({ kind: "operator", value })
  }

  const handleFieldClick = (fieldControl) => {
    const fieldLabel = fieldControl.label || fieldControl.properties?.labelText || fieldControl.id
    const labelText = String(fieldLabel || "").trim()
    const fieldId = String(fieldControl?.id || "").trim()
    if (!fieldId) return

    const nextFieldPart = {
      kind: "field",
      fieldId,
      label: labelText || fieldId,
      controlType: fieldControl.type,
    }

    if (isComputeRuleCategory) {
      setExpressionParts((prev) => {
        const last = prev[prev.length - 1]
        if (last?.kind === "field" && last.fieldId === fieldId) {
          return [...prev, { kind: "operator", value: "*" }, nextFieldPart]
        }
        return [...prev, nextFieldPart]
      })
      if (fieldErrors.ruleExpression) {
        setFieldErrors((prev) => ({ ...prev, ruleExpression: "" }))
      }
      return
    }

    appendExpressionPart(nextFieldPart)
  }

  const removeExpressionPartAt = (index) => {
    setExpressionParts((prev) => prev.filter((_, idx) => idx !== index))
  }

  const clearExpressionParts = () => {
    setExpressionParts([])
    setRuleExpression("")
  }

  const handleAddLiteralText = (value) => {
    const text = sanitizeRuleLiteralPartValue(value)
    if (!text) return
    appendExpressionPart({ kind: "literal", value: text })
  }

  const handleSave = async () => {
    console.log("handleSave called - Starting rule creation process")
    console.log("Current state:", { ruleName, ruleCategory, ruleExpression, crfId, studyId, control })
    
    // CRITICAL: Capture the control ID at the moment of rule creation
    // This ensures we use the correct control ID even if the control prop changes
    const currentControlId = control?.id
    const currentControlType = control?.type
    
    if (!currentControlId) {
      console.error("Cannot create rule: Control ID is missing")
      toast({
        title: "Validation Error",
        description: "Control ID is missing. Please select a control first.",
        variant: "destructive",
      })
      return
    }
    
    const nextErrors = {}
    if (!ruleName.trim()) nextErrors.ruleName = "Rule Name is required."
    if (!ruleCategory) nextErrors.ruleCategory = "Rule Category is required."
    const expressionTextForSave = finalizeRuleExpressionForApi(
      serializeRuleExpressionParts(expressionParts)
    )
    if (!expressionTextForSave) nextErrors.ruleExpression = "Rule Expression is required."

    // Check if rule category requires message
    const requiresMessage = !["hide", "show", "disable", "compute", "enable", "date_restriction"].includes(ruleCategory)
    if (requiresMessage && !message.trim()) nextErrors.message = "Rule Message is required."

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      const firstKey = Object.keys(nextErrors)[0]
      if (firstKey === "ruleName") ruleNameInputRef.current?.focus()
      if (firstKey === "ruleExpression") ruleExpressionRef.current?.focus()
      toast({
        title: "Validation Error",
        description: nextErrors[firstKey],
        variant: "destructive",
      })
      return
    }
    setFieldErrors({})

    const controlsForSave = controlsForExpression.length > 0 ? controlsForExpression : (allControls || [])
    const labelToIdMap = buildExtendedLabelToIdMap(controlsForSave)
    const normalizedRuleExpression = fixMissingMultiplyBetweenDuplicateFields(
      expressionTextForSave,
      labelToIdMap,
    )
    const expressionForApi = finalizeRuleExpressionForApi(
      replaceRuleDisplayTokensWithIds(normalizedRuleExpression, labelToIdMap)
    )
    const expressionShapeIssue = validateRuleExpressionShape(expressionForApi, ruleCategory)
    if (expressionShapeIssue) {
      toast({
        title: "Invalid Rule Expression",
        description: expressionShapeIssue,
        variant: "destructive",
      })
      return
    }
    const normalizedApiExpression = normalizeRuleText(expressionForApi)
    const unresolvedLabels = findUnresolvedRuleLabelTokens(normalizedApiExpression, labelToIdMap)
    if (unresolvedLabels.length > 0) {
      const preview = unresolvedLabels.slice(0, 3).join(", ")
      toast({
        title: "Invalid Rule Expression",
        description:
          unresolvedLabels.length === 1
            ? `Field label "${preview}" was not converted to a control ID. Click the field chip in Available Fields (do not type the label manually).`
            : `Some field labels were not converted to control IDs (${preview}${unresolvedLabels.length > 3 ? ", ..." : ""}). Click field chips in Available Fields instead of typing short labels like "1" or "2".`,
        variant: "destructive",
      })
      return
    }
    const expressionSyntaxProbe = decodeHtmlEntities(expressionForApi)
    const isComputeCategory = String(ruleCategory || "").toLowerCase() === "compute"
    if (!isComputeCategory) {
      try {
        // Syntax-only compile check (does not execute user expression).
        // Prevents saving malformed rules like extra ')' that later spam runtime errors.
        // Replace dynamic control IDs with literals before compile so parser validation
        // is independent of identifier formatting from generated ids.
        const parserSafeProbe = String(expressionSyntaxProbe || "")
          .replace(/\bctrl_[A-Za-z0-9_]+\b/g, "1")
          .trim()
        // eslint-disable-next-line no-new-func
        new Function(`return (${parserSafeProbe});`)
      } catch (syntaxError) {
        toast({
          title: "Invalid Rule Expression",
          description: `Rule expression has syntax error: ${syntaxError?.message || "Invalid expression"}. Please fix it before saving.`,
          variant: "destructive",
        })
        return
      }
    }

    // Validate required context
    if (!studyId) {
      console.warn("Cannot create rule: Study ID is missing. Please select a Study.")
      toast({
        title: "Validation Error",
        description: "Please select a Study before creating rules",
        variant: "destructive",
      })
      return
    }

    if (!control) {
      console.warn("Cannot create rule: Control is missing.")
      toast({
        title: "Validation Error",
        description: "No control selected for rule creation",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    
    // Auto-save CRF if it doesn't have an ID
    let currentCrfId = crfId
    if (!currentCrfId && onSaveCrf) {
      console.log("CRF ID is missing. Attempting to auto-save CRF...")
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
            description: "Cannot auto-save CRF. Please ensure Study, Visit, and CRF Name are selected/entered, then save the CRF manually before creating rules.",
            variant: "destructive",
          })
          setSaving(false)
          return
        }
      } catch (error) {
        console.error("Error auto-saving CRF:", error)
        toast({
          title: "Error",
          description: error.message || "Cannot auto-save CRF. Please ensure Study, Visit, and CRF Name are selected/entered, then save the CRF manually before creating rules.",
          variant: "destructive",
        })
        setSaving(false)
        return
      }
    } else if (!currentCrfId) {
      console.warn("Cannot create rule: CRF ID is missing and no save function provided.")
      toast({
        title: "Validation Error",
        description: "CRF Design must be saved before creating rules. Please save the CRF first.",
        variant: "destructive",
      })
      setSaving(false)
      return
    }

    try {
      // Find the selected category's API value
      const selectedCategory = [...baseRuleCategories, dateRestrictionCategory].find(cat => cat.value === ruleCategory)
      const categoryApiValue =
        ruleCategory === "date_restriction"
          ? "Validation"
          : selectedCategory?.apiValue || ruleCategory
      const normalizedMessage = message.trim()
      const messageForApi =
        ruleCategory === "date_restriction"
          ? normalizedMessage
            ? `${normalizedMessage} ${DATE_RESTRICTION_RULE_MARKER}`
            : DATE_RESTRICTION_RULE_MARKER
          : normalizedMessage

      // For table: target specific cell (targetField = tableId_row_R_col_C) for per-cell rules
      const normalizedTargetTableRow =
        currentControlType === "table" &&
        control?.properties?.addRow === true &&
        targetTableRow != null
          ? 0
          : targetTableRow

      const resolvedTargetField =
        currentControlType === "table" && normalizedTargetTableRow != null && targetTableColumn != null && !isNaN(normalizedTargetTableRow) && !isNaN(targetTableColumn)
          ? `${currentControlId}_row_${normalizedTargetTableRow}_col_${targetTableColumn}`
          : currentControlType === "table" && targetTableColumn != null && !isNaN(targetTableColumn)
          ? `${currentControlId}_col_${targetTableColumn}`
          : currentControlId

      let normalizedExpressionForApi = expressionForApi
      if (
        currentControlType === "table" &&
        targetTableRow != null &&
        targetTableColumn != null &&
        !isNaN(targetTableRow)
      ) {
        const rowTokenRegex = new RegExp(`${currentControlId}_row_${targetTableRow}_`, "g")
        normalizedExpressionForApi = normalizedExpressionForApi.replace(
          rowTokenRegex,
          `${currentControlId}_row_${normalizedTargetTableRow}_`
        )
      }

      // Static-table compatibility:
      // In some edit flows, display label "Row 1" can end up as `_row_1_` in expression
      // (one-based) while runtime table cells are zero-based (`_row_0_` for Row 1).
      // When we detect this mismatch against the selected target row, shift table row
      // tokens by -1 safely so each static row rule applies to its intended row.
      if (currentControlType === "table" && control?.properties?.addRow !== true) {
        const staticRows = Math.max(1, parseInt(control?.properties?.rows, 10) || 1)
        const rowTokenRegex = new RegExp(`${currentControlId}_row_(\\d+)_col_`, "g")
        const tokenMatches = [...normalizedExpressionForApi.matchAll(rowTokenRegex)]
        const rowIndexes = tokenMatches
          .map((m) => parseInt(m[1], 10))
          .filter((n) => Number.isFinite(n))
        if (rowIndexes.length > 0) {
          const hasZeroBasedToken = rowIndexes.some((n) => n === 0)
          const hasOutOfRangeToken = rowIndexes.some((n) => n >= staticRows)
          const targetRow = Number.isFinite(normalizedTargetTableRow) ? normalizedTargetTableRow : null
          const hasTargetExact = targetRow != null ? rowIndexes.some((n) => n === targetRow) : false
          const hasTargetPlusOne = targetRow != null ? rowIndexes.some((n) => n === targetRow + 1) : false
          const shouldShiftDownByOne =
            !hasZeroBasedToken &&
            ((targetRow != null && !hasTargetExact && hasTargetPlusOne) || hasOutOfRangeToken)

          if (shouldShiftDownByOne) {
            normalizedExpressionForApi = normalizedExpressionForApi.replace(
              new RegExp(`${currentControlId}_row_(\\d+)_`, "g"),
              (_, rawIdx) => {
                const nextIdx = Math.max(0, parseInt(rawIdx, 10) - 1)
                return `${currentControlId}_row_${nextIdx}_`
              }
            )
            console.info("[CRF Rules] static_table_row_index_normalized", {
              ruleName: ruleName.trim(),
              controlId: currentControlId,
              targetRow,
              originalRows: rowIndexes,
              staticRows,
              normalizedExpressionForApi,
            })
          }
        }
      }

      // One rule in DB: targetField = comma-separated control IDs (e.g. "id1,id2,id3")
      const targetIds = [resolvedTargetField, ...additionalTargetIds]
      const validTargetIds = new Set(controlsForSave.map((c) => c?.id).filter(Boolean))
      const invalidTargetIds = targetIds.filter((id) => !validTargetIds.has(id))
      if (invalidTargetIds.length > 0) {
        toast({
          title: "Invalid Rule Target",
          description: `Some target fields no longer exist on this CRF: ${invalidTargetIds.join(", ")}. Re-select targets and try again.`,
          variant: "destructive",
        })
        setSaving(false)
        return
      }

      // Root-cause guard: block saving compute/validation rules that reference stale source ctrl_* ids.
      // This prevents "rule saves successfully but never triggers" when expression points to removed/regenerated fields.
      const referencedFieldIds = [
        ...new Set(String(normalizedExpressionForApi || "").match(/\bctrl_[A-Za-z0-9_]+\b/g) || []),
      ]
      const missingReferencedIds = referencedFieldIds.filter((id) => !validTargetIds.has(id))
      if (missingReferencedIds.length > 0) {
        toast({
          title: "Invalid Rule Expression",
          description: `Expression references field ID(s) not present in this CRF: ${missingReferencedIds.slice(0, 3).join(", ")}${missingReferencedIds.length > 3 ? " ..." : ""}. Re-pick fields from Available Fields and save again.`,
          variant: "destructive",
        })
        setSaving(false)
        return
      }
      const targetFieldValue = targetIds.join(",")

      const expressionSentToApi = finalizeRuleExpressionForApi(normalizedExpressionForApi)

      const apiPayload = {
        crfId: currentCrfId,
        studyId: studyId,
        ruleName: ruleName.trim(),
        category: categoryApiValue,
        expression: expressionSentToApi,
        message: messageForApi,
        severity,
        targetField: targetFieldValue,
        trigger: "OnChange",
        controlType: mapControlType(currentControlType || "label"),
        ruleEngineTemplateId: ruleEngineTemplateId ? ruleEngineTemplateId : null,
      }

      let response
      if (isEditing && editingRule?.id) {
        // True edit: update existing rule instead of creating a new one
        response = await crfRuleService.updateCrfRule(editingRule.id, apiPayload)
      } else {
        response = await crfRuleService.createCrfRule(apiPayload)
      }

      // For new rules only: if backend rejects comma-separated targetField (e.g. "Validation failed"), fallback: create one rule per target
      if (!isEditing && !response?.isSuccess && targetIds.length > 1 && (response?.message?.toLowerCase().includes("validation") || response?.message === "Validation failed")) {
        const created = []
        for (const targetId of targetIds) {
          const singlePayload = { ...apiPayload, targetField: targetId }
          const res = await crfRuleService.createCrfRule(singlePayload)
          if (res?.isSuccess && res?.data) {
            created.push({ ...res.data, targetField: res.data.targetField ?? targetId })
          }
        }
        if (created.length > 0) {
          const first = created[0]
          const ruleData = {
            id: first.id || `rule_${Date.now()}`,
            ruleName: first.ruleName || ruleName.trim(),
            ruleCategory: ruleCategory,
            ruleExpression: first.expression || expressionSentToApi,
        message: (first.message || messageForApi).replace(DATE_RESTRICTION_RULE_MARKER, "").trim(),
            targetField: first.targetField ?? resolvedTargetField,
            createdAt: first.createdAt || new Date().toISOString(),
            updatedAt: first.updatedAt || new Date().toISOString(),
          }
          if (onRuleCreated && control) onRuleCreated(ruleData, null)
          toast({
            title: "Success",
            description: `Created ${created.length} rule(s) (one per field). Backend does not accept comma-separated targetField yet.`,
            variant: "default",
          })
          onClose()
          return
        }
      }

      if (!response) {
        throw new Error("No response received from API")
      }
      if (!response.isSuccess) {
        throw new Error(response.message || "Failed to create rule")
      }

      const data = response.data
      const ruleData = {
        id: data.id || editingRule?.id || `rule_${Date.now()}`,
        ruleName: data.ruleName || ruleName.trim(),
        ruleCategory: ruleCategory,
        ruleExpression: data.expression || expressionSentToApi,
        message: (data.message || messageForApi).replace(DATE_RESTRICTION_RULE_MARKER, "").trim(),
        targetField: data.targetField ?? targetFieldValue,
        createdAt: data.createdAt || editingRule?.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      }

      if (isEditing && onRuleUpdated) {
        onRuleUpdated(ruleData)
      } else if (onRuleCreated && control) {
        onRuleCreated(ruleData, null)
      }

      toast({
        title: "Success",
        description: isEditing
          ? "New rule saved and assigned. Previous rule kept in engine for future use."
          : targetIds.length > 1
            ? `1 rule created with ${targetIds.length} target field(s) (comma-separated in DB).`
            : "Rule created and assigned to control successfully!",
        duration: 6000,
      })

      onClose()
    } catch (error) {
      console.error("Error creating rule:", error)
      toast({
        title: "Save Failed",
        description: error.message || "Error saving rule. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const getControlIcon = (type) => {
    switch (type) {
      case "text":
        return <Type className="h-3.5 w-3.5 text-slate-500" />
      case "number":
        return <Hash className="h-3.5 w-3.5 text-slate-500" />
      case "date":
      case "ukunkdate":
        return <Calendar className="h-3.5 w-3.5 text-slate-500" />
      case "time":
        return <Clock className="h-3.5 w-3.5 text-slate-500" />
      case "checkbox":
        return <CheckSquare className="h-3.5 w-3.5 text-slate-500" />
      case "radio":
        return <Circle className="h-3.5 w-3.5 text-slate-500" />
      case "select":
        return <List className="h-3.5 w-3.5 text-slate-500" />
      case "hr":
        return <Minus className="h-3.5 w-3.5 text-slate-500" />
      default:
        return <Type className="h-3.5 w-3.5 text-slate-500" />
    }
  }

  const isDateTargetControl = (() => {
    if (control?.type === "date" || control?.type === "ukunkdate") return true
    if (control?.type !== "table") return false
    if (targetTableColumn == null || Number.isNaN(Number(targetTableColumn))) return false
    const normalizedRow =
      targetTableRow != null && !Number.isNaN(Number(targetTableRow))
        ? Number(targetTableRow)
        : null
    const columnTypes = Array.isArray(control?.properties?.columnTypes) ? control.properties.columnTypes : []
    const cellTypes = Array.isArray(control?.properties?.cellTypes) ? control.properties.cellTypes : []
    const cellType = normalizedRow != null ? cellTypes?.[normalizedRow]?.[targetTableColumn] : null
    const effectiveType = (cellType && cellType !== "empty" ? cellType : columnTypes[targetTableColumn]) || ""
    const normalizedEffectiveType = String(effectiveType).toLowerCase()
    return normalizedEffectiveType === "date" || normalizedEffectiveType === "ukunkdate"
  })()

  const ruleCategories = isDateTargetControl
    ? [...baseRuleCategories, dateRestrictionCategory]
    : baseRuleCategories
  const selectedCategoryVisible = ruleCategories.some((cat) => cat.value === ruleCategory)
  const ruleCategoriesForSelect = selectedCategoryVisible
    ? ruleCategories
    : ruleCategory === dateRestrictionCategory.value
      ? [...ruleCategories, dateRestrictionCategory]
      : ruleCategories

  // Use controls snapshot when modal opened so "Available Fields" shows the same fields used while designing the rule
  const controlsForList = controlsForExpression.length > 0 ? controlsForExpression : (allControls || [])
  // Include the field we're applying the rule to as well, so it can be referenced in the expression (e.g. compute, show/hide on self)
  const availableFields = controlsForList.filter(
    c => c.type !== "label" && 
    c.type !== "hr" && 
    c.type !== "table" &&
    (ruleCategory === "date_restriction" ? (c.type === "date" || c.type === "ukunkdate") : true)
  )
  const filteredAvailableFields = availableFields.filter((field) => {
    const fieldLabel = (field.label || field.properties?.labelText || "Unnamed Field").toLowerCase()
    return fieldLabel.includes((availableFieldsSearch || "").trim().toLowerCase())
  })

  const toggleAdditionalTarget = (targetId) => {
    setAdditionalTargetIds((prev) =>
      prev.includes(targetId) ? prev.filter((id) => id !== targetId) : [...prev, targetId]
    )
  }

  const primaryTargetField =
    control?.type === "table" && control?.id && targetTableRow != null && targetTableColumn != null
      ? `${control.id}_row_${targetTableRow}_col_${targetTableColumn}`
      : control?.type === "table" && control?.id && targetTableColumn != null
      ? `${control.id}_col_${targetTableColumn}`
      : (control?.id || null)

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent 
        side="right" 
        className="flex flex-col p-0 z-[100] border-l border-white/70 bg-white/85 backdrop-blur-xl w-[90vw] sm:w-[600px] lg:w-[700px] max-w-[90vw] sm:max-w-[600px] lg:max-w-[700px]"
      >
        <div className="flex flex-col h-full overflow-hidden bg-transparent">
          <SheetHeader className="px-5 pt-4 pb-3 border-b border-slate-200/80 bg-white/75 backdrop-blur-md">
            <SheetTitle className="text-xl font-semibold tracking-tight text-slate-900">
              {isEditing ? "Edit Rule" : "Create Rule"} for {control?.label || control?.properties?.labelText || "Control"}
            </SheetTitle>
            <SheetDescription className="text-sm text-slate-600 mt-1.5">
              {isEditing
                ? "Save as a new rule and assign it to this control. The previous rule is kept in the rule engine for future use."
                : "Create a rule that will be applied to this control. Rules can show/hide, enable/disable, or compute values dynamically."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-3 pb-20 relative">
            <div className="space-y-4 rounded-2xl border border-white/80 bg-white/70 p-4 shadow-[0_14px_34px_-24px_rgba(15,23,42,0.45)] backdrop-blur-md">
          {/* Rule Name */}
          <div>
            <Label className="text-sm font-medium mb-1 block">Rule Name <span className="text-red-500">*</span></Label>
            <Input
              ref={ruleNameInputRef}
              value={ruleName}
              onChange={(e) => {
                setRuleName(e.target.value)
                if (fieldErrors.ruleName) {
                  setFieldErrors((prev) => ({ ...prev, ruleName: "" }))
                }
              }}
              placeholder="Enter rule name"
              maxLength={200}
              className={`h-11 rounded-xl bg-white/90 focus-visible:ring-emerald-300 ${
                fieldErrors.ruleName ? "border-rose-400 focus-visible:ring-rose-200" : "border-slate-200/90"
              }`}
            />
            {fieldErrors.ruleName ? <p className="mt-1 text-xs text-rose-600">{fieldErrors.ruleName}</p> : null}
          </div>

          {/* Apply rule to: individual cell (table only; opened from a cell = per-cell rule) */}
          {control?.type === "table" && (() => {
            const row = targetTableRow
            const col = targetTableColumn
            const columnHeaders = control?.properties?.columnHeaders || []
            const columnTypes = control?.properties?.columnTypes || []
            const cellTypes = control?.properties?.cellTypes || []
            const cellType = (cellTypes[row] && cellTypes[row][col]) || columnTypes[col]
            const typeLabels = { date: "Date Picker", ukunkdate: "UK/UNK Date Picker", time: "Time Picker", text: "Text Box", number: "Number", select: "Option List", radio: "Option Button", checkbox: "Check Box", file: "File Upload", lab: "Lab", label: "Label" }
            const columnLabel = (columnHeaders[col] != null && columnHeaders[col] !== "") ? columnHeaders[col] : `Column ${(col ?? 0) + 1}`
            const typeLabel = (cellType && typeLabels[cellType]) || cellType || "—"
            const isCellTarget = row != null && col != null
            return (
              <>
                {isCellTarget && (
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 mb-2">
                    <p className="text-sm font-medium text-emerald-900">
                      Applying rule to: <span className="font-semibold">Row {(row ?? 0) + 1}, Column {(col ?? 0) + 1}</span> <span className="text-emerald-600">({columnLabel} — {typeLabel})</span>
                    </p>
                    <p className="text-xs text-emerald-700 mt-0.5">This rule will apply only to this cell. Other cells (e.g. Row 2, Column 1) have their own rules.</p>
                  </div>
                )}
                {!isCellTarget && (
                  <div>
                    <Label className="text-sm font-medium mb-1 block">Apply rule to</Label>
                    <Select
                      value={targetTableColumn === null ? "table" : `col_${targetTableColumn}`}
                      onValueChange={(v) => setTargetTableColumn(v === "table" ? null : parseInt(v.replace("col_", ""), 10))}
                    >
                    <SelectTrigger className="h-11 cursor-pointer w-full rounded-xl border-slate-200/90 bg-white/90">
                        <SelectValue placeholder="Whole table or column" />
                      </SelectTrigger>
                      <SelectContent className="z-[100] bg-white opacity-100 shadow-lg" position="popper">
                        <SelectItem value="table">Whole table</SelectItem>
                        {Array.from({ length: Math.max(1, control?.properties?.columns || 1) }).map((_, i) => {
                          const header = (control?.properties?.columnHeaders && control.properties.columnHeaders[i]) || `Column ${i + 1}`
                          return (
                            <SelectItem key={i} value={`col_${i}`}>
                              Column {i + 1}: {header}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500 mt-1">Choose whether this rule applies to the whole table or to a specific column.</p>
                  </div>
                )}
              </>
            )
          })()}

          {/* Also apply to (optional): one rule → multiple targets (including table cells). */}
          {control?.id && primaryTargetField && (() => {
            const otherControls = controlsForList.filter(c => {
              if (!c?.id || c.type === "label" || c.type === "hr") return false
              if (c.id === primaryTargetField) return false
              if (control?.type === "table") {
                // For table rule, allow applying same rule to multiple cells of this table.
                return c.id.startsWith(`${control.id}_row_`)
              }
              return c.id !== control.id
            })
            if (otherControls.length === 0) return null
            const allOtherIds = otherControls.map(c => c.id)
            return (
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <Checkbox
                    checked={showAlsoApplyTo}
                    onCheckedChange={(checked) => {
                      setShowAlsoApplyTo(!!checked)
                      if (!checked) setAdditionalTargetIds([])
                    }}
                    className="border-slate-300"
                  />
                  <span className="text-sm font-medium text-slate-700 group-hover:text-emerald-700">Also apply this rule to (optional)</span>
                </label>
                <p className="text-xs text-slate-500 pl-6">
                  {control?.type === "table"
                    ? "Same condition will apply to selected table cells too. One rule, multiple table boxes/cells."
                    : "Same condition will enable/disable these fields too. One rule, multiple targets."}
                </p>
                {showAlsoApplyTo && (
                  <div className="pl-6 space-y-2">
                    <Popover open={targetsPickerOpen} onOpenChange={setTargetsPickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setTargetsPickerOpen((prev) => !prev)}
                          className="h-10 w-full justify-between rounded-lg border-teal-200 bg-white text-sm font-normal text-slate-700 shadow-sm transition-all duration-150 hover:border-teal-300 hover:bg-teal-50/30 focus-visible:ring-2 focus-visible:ring-teal-200"
                        >
                          <span className="inline-flex min-w-0 items-center gap-2">
                            <Search className="h-3.5 w-3.5 text-teal-600" />
                            <span className="truncate">Search & select fields</span>
                          </span>
                          <span className="ml-2 inline-flex items-center gap-2">
                            {additionalTargetIds.length > 0 ? (
                              <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-md bg-teal-100 px-1.5 text-xs font-semibold text-teal-700">
                                {additionalTargetIds.length}
                              </span>
                            ) : null}
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="z-[220] w-[380px] border border-slate-200 bg-white p-0 shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
                        align="start"
                        sideOffset={6}
                        onWheelCapture={(e) => e.stopPropagation()}
                      >
                        <Command>
                          <CommandInput className="transition-colors duration-150" placeholder="Type to filter by field name..." />
                          <div className="flex items-center justify-between border-y border-slate-100 px-3 py-2 text-xs">
                            <span className="font-medium text-slate-500">{control?.type === "table" ? "Table cells" : "Form fields"}</span>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                className="text-teal-700 hover:text-teal-800"
                                onClick={() => setAdditionalTargetIds([...allOtherIds])}
                              >
                                Select all
                              </button>
                              <button
                                type="button"
                                className="text-slate-500 hover:text-slate-700"
                                onClick={() => setAdditionalTargetIds([])}
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                          <CommandList
                            className="max-h-64 overflow-y-auto overflow-x-hidden overscroll-contain scroll-smooth p-1"
                            onWheel={(e) => e.stopPropagation()}
                          >
                            {otherControls.map((c) => {
                              const label = c.properties?.labelText || c.label || c.id
                              const checked = additionalTargetIds.includes(c.id)
                              return (
                                <CommandItem
                                  key={c.id}
                                  value={`${label} ${c.id}`}
                                  onSelect={() => toggleAdditionalTarget(c.id)}
                                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 transition-colors duration-100 hover:bg-teal-50 data-[selected=true]:bg-teal-50/80"
                                >
                                  <span
                                    className={`h-4 w-4 rounded border ${checked ? "border-teal-600 bg-teal-600" : "border-slate-300 bg-white"} inline-flex items-center justify-center transition-all duration-150`}
                                  >
                                    {checked ? <Check className="h-3 w-3 text-white" /> : null}
                                  </span>
                                  <span className="truncate text-sm text-slate-800">{label}</span>
                                </CommandItem>
                              )
                            })}
                          </CommandList>
                          <div className="flex justify-end border-t border-slate-100 bg-slate-50/70 px-3 py-2">
                            <Button type="button" size="sm" className="bg-teal-600 transition-all duration-150 hover:bg-teal-700 hover:shadow-md" onClick={() => setTargetsPickerOpen(false)}>
                              Done
                            </Button>
                          </div>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <div className="text-xs text-slate-500">
                      {additionalTargetIds.length > 0
                        ? `${additionalTargetIds.length} field(s) selected`
                        : "No additional field selected"}
                    </div>
                    {additionalTargetIds.length > 0 && (
                      <div className="rounded-lg border border-dashed border-teal-200/90 bg-white/90 px-3 py-2.5">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          ALSO APPLIES TO {additionalTargetIds.length} FIELD{additionalTargetIds.length > 1 ? "S" : ""}
                        </p>
                        <div className="flex max-h-[120px] flex-wrap gap-1.5 overflow-y-auto pr-0.5">
                        {additionalTargetIds.map((id) => {
                          const c = otherControls.find((x) => x.id === id)
                          const label = c?.properties?.labelText || c?.label || id
                          return (
                            <span
                              key={id}
                              className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-teal-200 bg-teal-50 px-1.5 py-1 text-xs text-teal-950"
                              title={label}
                            >
                              {c ? getControlIcon(c.type) : null}
                              <span className="min-w-0 truncate max-w-[220px]">{label}</span>
                              <button
                                type="button"
                                onClick={() => toggleAdditionalTarget(id)}
                                className="rounded p-0.5 text-teal-600 hover:bg-teal-200/70"
                                aria-label={`Remove ${label}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          )
                        })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })()}

          {/* Rule Category */}
          <div>
            <Label className="text-sm font-medium mb-1 block">Rule Category <span className="text-red-500">*</span></Label>
            <Select
              value={ruleCategory}
              onValueChange={(value) => {
                setRuleCategory(value)
                if (fieldErrors.ruleCategory) {
                  setFieldErrors((prev) => ({ ...prev, ruleCategory: "" }))
                }
              }}
            >
              <SelectTrigger className={`h-11 cursor-pointer pointer-events-auto w-full rounded-xl bg-white/90 ${
                fieldErrors.ruleCategory ? "border-rose-400 focus-visible:ring-rose-200" : "border-slate-200/90"
              }`}>
                <SelectValue placeholder="Select rule category" />
              </SelectTrigger>
              <SelectContent className="z-[100] bg-white opacity-100 shadow-lg" position="popper">
                {ruleCategoriesForSelect.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.text}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.ruleCategory ? <p className="mt-1 text-xs text-rose-600">{fieldErrors.ruleCategory}</p> : null}
          </div>

          {/* Rule Expression Builder */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Rule Expression <span className="text-red-500">*</span></Label>
            
            {/* Available Fields */}
            {availableFields.length > 0 && (
              <div className="mb-3">
                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Label className="mb-0 text-xs text-slate-600 block">Available Fields:</Label>
                  <div className="relative w-full sm:max-w-[240px]">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={availableFieldsSearch}
                      onChange={(e) => setAvailableFieldsSearch(e.target.value)}
                      placeholder="Search fields..."
                      className="h-9 rounded-lg border-slate-200 bg-white pl-8 pr-8 text-sm"
                    />
                    {availableFieldsSearch ? (
                      <button
                        type="button"
                        onClick={() => setAvailableFieldsSearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        aria-label="Clear search"
                        title="Clear search"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 p-2 bg-slate-50/90 rounded-xl border border-slate-200 max-h-32 overflow-y-auto">
                  {filteredAvailableFields.map((field) => {
                    const fieldLabel = field.label || field.properties?.labelText || "Unnamed Field"
                    return (
                      <button
                        key={field.id}
                        type="button"
                        onClick={() => handleFieldClick(field)}
                        className="flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs hover:bg-emerald-50 hover:border-emerald-400 transition-colors"
                        title={`Click to add "${fieldLabel}" to expression`}
                      >
                        {getControlIcon(field.type)}
                        <span className="font-medium">{fieldLabel}</span>
                      </button>
                    )
                  })}
                  {filteredAvailableFields.length === 0 && (
                    <p className="w-full py-2 text-center text-xs text-slate-500">No fields found</p>
                  )}
                </div>
              </div>
            )}

            {/* Operators */}
            <div className="mb-3">
              <Label className="text-xs text-slate-600 mb-1 block">Operators:</Label>
              <div className="flex flex-wrap gap-2 p-2 bg-slate-50/90 rounded-xl border border-slate-200">
                {operators.map((op) => (
                  <button
                    key={op.label}
                    type="button"
                    onClick={() => handleOperatorClick(op.label)}
                    className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-mono hover:bg-emerald-50 hover:border-emerald-400 transition-colors"
                    title={op.tooltip}
                  >
                    {op.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Expression builder — chip UI for all rule categories */}
            <div ref={ruleExpressionRef}>
              <RuleExpressionChipEditor
                parts={expressionParts}
                onRemoveAt={removeExpressionPartAt}
                onClear={clearExpressionParts}
                onAddLiteral={handleAddLiteralText}
                hasError={Boolean(fieldErrors.ruleExpression)}
                emptyHint={
                  isComputeRuleCategory
                    ? "Build formulas with field chips and operators (e.g. w / (h * h) * 10000). Use Add text for numbers."
                    : "Click a field chip, then an operator (e.g. >=), then the other field. Use Add text for manual values."
                }
              />
            </div>
            {fieldErrors.ruleExpression ? (
              <p className="mt-1 text-xs text-rose-600">{fieldErrors.ruleExpression}</p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">
                All rule categories use round chips for fields/operators; manual text uses an amber chip.
                {isComputeRuleCategory
                  ? " Click the same field twice in a row to auto-insert multiply (*)."
                  : " For Yes/No type Yes or No only (no quote marks). Control IDs are saved automatically in the background."}
              </p>
            )}
          </div>

          {/* Message (for submit/retro rules) */}
          {["submit", "retro"].includes(ruleCategory) && (
            <div>
              <Label className="text-sm font-medium mb-1 block">Message <span className="text-red-500">*</span></Label>
              <Textarea
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value)
                  if (fieldErrors.message) {
                    setFieldErrors((prev) => ({ ...prev, message: "" }))
                  }
                }}
                placeholder="Enter error/warning message"
                maxLength={500}
                className={`rounded-xl bg-white/90 focus-visible:ring-emerald-300 ${
                  fieldErrors.message ? "border-rose-400 focus-visible:ring-rose-200" : "border-slate-200/90"
                }`}
              />
              {fieldErrors.message ? <p className="mt-1 text-xs text-rose-600">{fieldErrors.message}</p> : null}
            </div>
          )}

          {/* Severity */}
          <div>
            <Label className="text-sm font-medium mb-1 block">Severity</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger className="h-11 cursor-pointer pointer-events-auto w-full rounded-xl border-slate-200/90 bg-white/90">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[100] bg-white opacity-100 shadow-lg" position="popper">
                <SelectItem value="Hard">Hard</SelectItem>
                <SelectItem value="Soft">Soft</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1.5 rounded-lg bg-emerald-50/70 px-2.5 py-2 text-xs text-slate-600">
              <span className="font-medium text-slate-700">Hard:</span> real-time blocking validation before submit.
              {" "}
              <span className="font-medium text-slate-700">Soft:</span> non-blocking, used for query/warning flow.
            </p>
          </div>
            </div>
          </div>

          <SheetFooter className="px-5 py-3 border-t border-slate-200/80 bg-white/80 backdrop-blur-md sticky bottom-0 relative z-10 flex-shrink-0 gap-2.5">
            <Button 
              variant="outline" 
              onClick={onClose} 
              disabled={saving} 
              className="h-10 w-full sm:w-auto cursor-pointer pointer-events-auto rounded-xl border-slate-300 bg-white/90"
            >
              Cancel
            </Button>
            <Button 
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                console.log("Button clicked - calling handleSave")
                handleSave()
              }} 
              disabled={saving} 
              className="h-10 w-full sm:w-auto cursor-pointer pointer-events-auto rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-medium shadow-md hover:shadow-lg transition-all duration-200"
            >
              {saving ? "Saving..." : isEditing ? "Save as new & assign" : "Create & Assign Rule"}
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default RuleCreationModal
