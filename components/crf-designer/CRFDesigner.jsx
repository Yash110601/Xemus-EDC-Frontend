"use client"

import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import { DndContext, DragOverlay, pointerWithin, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from "@dnd-kit/sortable"
import ToolsPanel from "./ToolsPanel"
import DesignerCanvas, { SECTION_TAB_SORTABLE_ID_PREFIX } from "./DesignerCanvas"
import PropertiesPanel from "./PropertiesPanel"
import CRFConfiguration from "./CRFConfiguration"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Save, Send, X, Eye, Copy, Undo2, Redo2, Download, Upload, Loader2, Search } from "lucide-react"
import { crfDesignService, crfRuleService } from "@/lib/services"
import CRFViewer from "./CRFViewer"
import { useToast } from "@/hooks/use-toast"
import { fetchStudySettingsByStudyId, pickIsCdashEnabled } from "@/lib/utils/studySettingsRead"
import {
  buildCdashMappingsSavePayload,
  normalizeCdashMappingsFromApi,
  validateCdashMappingsUniquePerCrf,
  findDesignerControlByFieldId,
} from "@/lib/utils/cdashMappings"
import { resolveDesignerControlLabel } from "@/lib/cdash/controlProfile"
import RuleCreationModal from "./RuleCreationModal"
import { studyService, siteService } from "@/lib/services"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { parseHtmlContent } from "./parseHtmlContent"
import { buildCrfDesignerConfigFromApi } from "@/lib/utils/crfDesignerConfigFromApi"
import {
  normalizeCrfSection,
  normalizeCrfSections,
  createStandardSection,
  createLabSection,
} from "@/lib/utils/crfLabSection"
import {
  CRF_DESIGNER_VISIT_OPTIONS,
  mapCrfDesignerVisitToEnum,
  crfFormTypeToDesignerVisitLabel,
} from "@/lib/visitTypes"
import {
  canAddControlsInStudyCompletionDesigner,
  createStudyCompletionStatusSection,
  findStudyCompletionSectionByStatusCode,
  getStudyCompletionStatusLabel,
  isStudyCompletionFormVisit,
  isStudyCompletionStatusSection,
  serializeStudyCompletionSectionForPayload,
  validateStudyCompletionDesignerSections,
} from "@/lib/crfDesigner/studyCompletionFormDesigner"
import StudyCompletionDesignerPanel from "./StudyCompletionDesignerPanel"
import { SECTION_TYPE_STUDY_COMPLETION_STATUS } from "@/lib/utils/crfLabSection"
import {
  findSectionIdByControlId,
  parseDropzoneDroppableId,
  resolveSectionIdFromDropTarget,
} from "@/lib/crfDesigner/designerDropzone"
import CrfDesignerTransferDialog from "./CrfDesignerTransferDialog"
import {
  collectRulesForExport,
  rulesToDesignerState,
  mapRulesOntoSections,
  mapApiRulesOntoSections,
  findFirstControlWithRules,
  resolveTableCellSelectionFromRules,
  normalizeCrfRuleFromApi,
  findControlInSections,
} from "@/lib/utils/crfDesignerRulesTransfer"
import {
  countBundleRules,
  downloadBundleJson,
  normalizeToImportBundlePayload,
} from "@/lib/utils/crfDesignerBundle"

// Generate unique ID
const generateId = () => `ctrl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

/** Avoid @dnd-kit SSR hydration mismatch (DndDescribedBy-* ids differ server vs client). */
function CrfDesignerDndSkeleton() {
  return (
    <div
      className="flex h-full min-h-0 bg-slate-50"
      role="status"
      aria-busy="true"
      aria-label="Loading form designer"
    >
      <div className="w-48 flex-shrink-0 border-r border-slate-200 bg-white p-3 space-y-2">
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="h-8 rounded-md bg-slate-100/90 animate-pulse" />
        ))}
      </div>
      <div className="flex-1 flex flex-col min-h-0 gap-3 p-4">
        <div className="h-24 rounded-xl border border-slate-200 bg-white animate-pulse" />
        <div className="flex-1 min-h-[280px] rounded-xl border border-slate-200 bg-white animate-pulse" />
      </div>
      <div className="w-64 flex-shrink-0 border-l border-slate-200 bg-white p-4">
        <div className="h-full min-h-[200px] rounded-xl bg-slate-100/90 animate-pulse" />
      </div>
    </div>
  )
}

// Escape dynamic values when we generate HTML strings for CRF controls.
// This prevents labels/values like "Yes – occasionally (<once/week)" from being treated as HTML tags.
const escapeHtml = (v) => {
  const s = v == null ? "" : String(v)
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

const CRFDesigner = ({ initialCRF = null, onSave, onCancel }) => {
  const { toast } = useToast()
  const [dndReady, setDndReady] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const [selectedControl, setSelectedControl] = useState(null)
  const [sections, setSections] = useState(() =>
    normalizeCrfSections([{ id: "section_1", name: "Section 1", controls: [] }])
  )
  const [activeSection, setActiveSection] = useState("section_1")
  // Tools and Properties panels are always visible (static) for better UX
  const [isSaving, setIsSaving] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)

  const parentLabSectionForSelection = useMemo(() => {
    if (!selectedControl?.id || previewMode) return null
    const sec = sections.find((s) => (s.controls || []).some((c) => c.id === selectedControl.id))
    return sec ? normalizeCrfSection(sec) : null
  }, [sections, selectedControl, previewMode])
  const [showRuleModal, setShowRuleModal] = useState(false)
  const [ruleModalControl, setRuleModalControl] = useState(null)
  const [editingRule, setEditingRule] = useState(null)
  const [selectedRuleTemplateId, setSelectedRuleTemplateId] = useState(null)
  const [initialTargetTableColumn, setInitialTargetTableColumn] = useState(null)
  const [initialTargetTableRow, setInitialTargetTableRow] = useState(null)
  const [selectedTableColumnForRules, setSelectedTableColumnForRules] = useState(null) // When set with row, Properties shows rules for this cell only
  const [selectedTableRowForRules, setSelectedTableRowForRules] = useState(null)
  const [crfRules, setCrfRules] = useState([]) // CRF-level rules
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [transferIncludeRules, setTransferIncludeRules] = useState(true)
  const [transferRuleCount, setTransferRuleCount] = useState(0)
  const [transferLoading, setTransferLoading] = useState(false)
  const [transferImportMethod, setTransferImportMethod] = useState("api")
  const pendingImportDataRef = useRef(null)
  
  // Track current CRF ID - updated after auto-save
  const [currentCrfId, setCurrentCrfId] = useState(initialCRF?.id || null)
  
  // Study and Visit selection state
  const [selectedStudy, setSelectedStudy] = useState(null)
  const [selectedVisit, setSelectedVisit] = useState("")
  const [availableStudies, setAvailableStudies] = useState([])
  const [loadingStudies, setLoadingStudies] = useState(false)
  const [studySearch, setStudySearch] = useState("")
  const [isCdashEnabledForStudy, setIsCdashEnabledForStudy] = useState(false)
  const [cdashMappings, setCdashMappings] = useState([])
  const cdashMappingsDirtyRef = useRef(false)
  const [copiedControlTemplate, setCopiedControlTemplate] = useState(() => {
    if (typeof window === "undefined") return null
    try {
      const raw = window.localStorage.getItem("crf-designer:controlClipboard:v1")
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })
  
  // Refs to prevent duplicate API calls
  const studiesFetchedRef = useRef(false)
  const crfLoadedRef = useRef(false)
  const importedStudyIdRef = useRef(null)

  useEffect(() => {
    const studyId = selectedStudy ? selectedStudy.studyId || selectedStudy.id : null
    if (!studyId) {
      setIsCdashEnabledForStudy(false)
      return
    }
    let alive = true
    fetchStudySettingsByStudyId(Number(studyId))
      .then((res) => {
        if (!alive) return
        setIsCdashEnabledForStudy(
          res?.isSuccess && res.data ? pickIsCdashEnabled(res.data) : false,
        )
      })
      .catch(() => {
        if (alive) setIsCdashEnabledForStudy(false)
      })
    return () => {
      alive = false
    }
  }, [selectedStudy])

  const visitOptions = CRF_DESIGNER_VISIT_OPTIONS

  const getStudyDisplayName = useCallback((study) => {
    if (!study) return ""
    if (typeof study === "string") return study
    return (
      study.studyProtocolNumber ||
      study.protocolNumber ||
      study.name ||
      study.studyName ||
      `Study ${study.studyId || study.id || ""}`
    )
  }, [])

  const filteredStudies = useMemo(() => {
    const q = studySearch.trim().toLowerCase()
    if (!q) return availableStudies
    return availableStudies.filter((study) => {
      const displayName = getStudyDisplayName(study).toLowerCase()
      const idText = String(study.studyId ?? study.id ?? "").toLowerCase()
      return displayName.includes(q) || idText.includes(q)
    })
  }, [availableStudies, studySearch, getStudyDisplayName])

  const getCrfFormTypeEnum = (visitName) => mapCrfDesignerVisitToEnum(visitName)

  const studyCompletionDesignerMode = useMemo(
    () => isStudyCompletionFormVisit(selectedVisit),
    [selectedVisit],
  )

  // Study Completion: remove stray standard "Section 1" so only status blocks remain.
  useEffect(() => {
    if (!studyCompletionDesignerMode) return
    setSections((prev) => {
      const norm = normalizeCrfSections(prev)
      if (!norm.some((s) => !isStudyCompletionStatusSection(s))) return prev
      const next = norm.filter(isStudyCompletionStatusSection)
      saveToHistory(next)
      return next
    })
  }, [studyCompletionDesignerMode])

  useEffect(() => {
    if (!studyCompletionDesignerMode) return
    const active = sections.find((s) => s.id === activeSection)
    if (active && isStudyCompletionStatusSection(active)) return
    const first = sections.find(isStudyCompletionStatusSection)
    setActiveSection(first?.id ?? "")
  }, [studyCompletionDesignerMode, sections, activeSection])

  const designerControlsDropEnabled = useMemo(
    () =>
      canAddControlsInStudyCompletionDesigner(
        studyCompletionDesignerMode,
        sections,
        activeSection,
      ),
    [studyCompletionDesignerMode, sections, activeSection],
  )

  // Generate HTML content from CRF structure
  const generateHtmlContent = (crfStructure) => {
    let html = '<div class="crf-form">\n'
    
    if (crfStructure.sections && crfStructure.sections.length > 0) {
      crfStructure.sections.forEach((section) => {
        const ns = normalizeCrfSection(section)
        const sectionTypeAttr =
          ns.sectionType === "lab"
            ? "lab"
            : ns.sectionType === SECTION_TYPE_STUDY_COMPLETION_STATUS
              ? SECTION_TYPE_STUDY_COMPLETION_STATUS
              : "standard"
        let sectionOpen = `  <div class="crf-section" data-section-id="${escapeHtml(ns.id)}" data-section-type="${sectionTypeAttr}"`
        if (sectionTypeAttr === SECTION_TYPE_STUDY_COMPLETION_STATUS && ns.studyCompletionStatus) {
          const sc = ns.studyCompletionStatus
          const code = sc.statusCode
          if (code != null && String(code).trim() !== "") {
            sectionOpen += ` data-study-completion-status-code="${escapeHtml(String(code))}"`
          }
          const sk = sc.statusKey || ""
          const sl = sc.statusLabel || ""
          if (String(sk).trim() !== "") {
            sectionOpen += ` data-study-completion-status-key="${escapeHtml(String(sk))}"`
          }
          if (String(sl).trim() !== "") {
            sectionOpen += ` data-study-completion-status-label="${escapeHtml(String(sl))}"`
          }
        }
        if (sectionTypeAttr === "lab" && ns.labBinding) {
          const lid = ns.labBinding.labFacilityId
          const lname = ns.labBinding.labFacilityLabel || ""
          if (lid != null && String(lid).trim() !== "") {
            sectionOpen += ` data-lab-facility-id="${escapeHtml(String(lid))}"`
          }
          if (String(lname).trim() !== "") {
            sectionOpen += ` data-lab-facility-label="${escapeHtml(String(lname))}"`
          }
        }
        sectionOpen += `>\n`
        html += sectionOpen
        html += `    <h3 class="section-title">${escapeHtml(ns.name || "Untitled Section")}</h3>\n`
        html += '    <div class="section-controls">\n'
        
        if (section.controls && section.controls.length > 0) {
          section.controls.forEach((control) => {
            const props = control.properties || {}
            const labelText = props.labelText || control.label || 'Unlabeled Field'
            const required = props.required ? 'required' : ''
            const readonly = props.readonly ? 'readonly' : ''
            const placeholder = props.placeholder || ''
            // Preserve 0 when exporting so import shows zero correctly (defaultValue || '' would drop 0)
            const controlId = control.id
            const defaultValue = (props.defaultValue !== undefined && props.defaultValue !== null && props.defaultValue !== '')
              ? String(props.defaultValue)
              : (props.defaultValue === 0 || props.defaultValue === '0' ? '0' : '')
            const controlSize = control.controlSize || 12
            
            // Save all properties as data attributes for full restoration
            let dataAttributes = `data-control-id="${controlId}" data-control-type="${control.type}"`
            if (props.tooltip) dataAttributes += ` data-tooltip="${props.tooltip.replace(/"/g, '&quot;')}"`
            if (props.prefix) dataAttributes += ` data-prefix="${String(props.prefix).replace(/"/g, '&quot;')}"`
            if (props.postfix) dataAttributes += ` data-postfix="${String(props.postfix).replace(/"/g, '&quot;')}"`
            if (props.labelPosition) dataAttributes += ` data-label-position="${props.labelPosition}"`
            if (props.fontWeight) dataAttributes += ` data-font-weight="${props.fontWeight}"`
            if (props.textDecoration) dataAttributes += ` data-text-decoration="${props.textDecoration}"`
            if (props.multiline) dataAttributes += ` data-multiline="true"`
            if (props.scale !== undefined) dataAttributes += ` data-scale="${props.scale}"`
            if (props.dateRestriction) dataAttributes += ` data-date-restriction="${props.dateRestriction}"`
            if (props.isVisitDate) dataAttributes += ` data-is-visit-date="true"`
            if (props.minDateFromFieldId) dataAttributes += ` data-date-min-from-field="${String(props.minDateFromFieldId).replace(/"/g, '&quot;')}"`
            if (props.maxDateFromFieldId) dataAttributes += ` data-date-max-from-field="${String(props.maxDateFromFieldId).replace(/"/g, '&quot;')}"`
            if (props.genderSpecific) dataAttributes += ` data-gender-specific="${String(props.genderSpecific).toLowerCase()}"`
            const terminologyCodingHtml = (
              control.type === 'text'
                ? String(props.terminologyCoding || '').trim().toLowerCase()
                : ''
            )
            if (terminologyCodingHtml === 'meddra' || terminologyCodingHtml === 'whodd') {
              dataAttributes += ` data-terminology-coding="${terminologyCodingHtml}"`
            }
            if (props.labTestId != null && String(props.labTestId).trim() !== "") {
              dataAttributes += ` data-lab-test-id="${escapeHtml(String(props.labTestId))}"`
            }
            if (props.labTestLabel != null && String(props.labTestLabel).trim() !== "") {
              dataAttributes += ` data-lab-test-label="${escapeHtml(String(props.labTestLabel))}"`
            }
            // eCRF + round-trip: persist dropdown→text mapping in HTML (DB may strip unknown JSON props on controls).
            const avSrc = props.autoValueMapSourceFieldId != null ? String(props.autoValueMapSourceFieldId).trim() : ""
            if (avSrc) {
              dataAttributes += ` data-auto-value-map-source="${avSrc.replace(/"/g, '&quot;')}"`
            }
            if (props.autoValueMapRules != null && String(props.autoValueMapRules).trim() !== "") {
              dataAttributes += ` data-auto-value-map-rules="${encodeURIComponent(String(props.autoValueMapRules))}"`
            }
            if (props.readonly) {
              dataAttributes += ` data-readonly="true"`
            }
            if (props.defaultValue !== undefined && props.defaultValue !== null && String(props.defaultValue).trim() !== "") {
              dataAttributes += ` data-default-value="${escapeHtml(String(props.defaultValue))}"`
            }

            html += `      <div class="control-wrapper" ${dataAttributes} style="width: ${(controlSize / 12) * 100}%;">\n`
            html += `        <label class="control-label" for="${controlId}">${labelText}${props.required ? ' <span class="required">*</span>' : ''}</label>\n`
            
            switch (control.type) {
              case 'text':
                html += `        <input type="text" id="${controlId}" name="${controlId}" class="form-control" ${required} ${readonly} placeholder="${placeholder}" value="${defaultValue}" ${props.maxLength ? `maxlength="${props.maxLength}"` : ''} />\n`
                break
              case 'number':
                html += `        <input type="number" id="${controlId}" name="${controlId}" class="form-control" ${required} ${readonly} placeholder="${placeholder}" value="${defaultValue}" ${props.min !== null && props.min !== undefined ? `min="${props.min}"` : ''} ${props.max !== null && props.max !== undefined ? `max="${props.max}"` : ''} ${props.scale !== undefined ? `step="${Math.pow(10, -props.scale)}"` : ''} />\n`
                break
              case 'textarea':
                html += `        <textarea id="${controlId}" name="${controlId}" class="form-control" ${required} ${readonly} placeholder="${placeholder}" ${props.maxLength ? `maxlength="${props.maxLength}"` : ''} ${props.multiline ? 'rows="4"' : ''}>${defaultValue}</textarea>\n`
                break
              case 'dropdown':
              case 'select':
                html += `        <select id="${controlId}" name="${controlId}" class="form-control" ${required} ${readonly}`
                // Save dataSource and csvValues as data attributes for restoration
                if (props.dataSource) {
                  html += ` data-source="${props.dataSource}"`
                }
                if (props.csvValues) {
                  html += ` data-csv-values="${props.csvValues.replace(/"/g, '&quot;')}"`
                }
                if (props.multiple !== undefined) {
                  html += ` data-multiple="${props.multiple}"`
                }
                html += `>\n`
                
                // Convert csvValues to options array if csvValues exists
                let optionsArray = []
                if (props.csvValues && typeof props.csvValues === 'string') {
                  // Convert comma-separated string to options array
                  optionsArray = props.csvValues.split(',').map(opt => opt.trim()).filter(opt => opt !== '').map(opt => ({
                    value: opt,
                    label: opt
                  }))
                } else if (props.options && Array.isArray(props.options)) {
                  // Use existing options array
                  optionsArray = props.options
                }
                
                // Generate option elements
                if (optionsArray.length > 0) {
                  optionsArray.forEach((option) => {
                    const optionValue = typeof option === 'string' ? option : option.value
                    const optionLabel = typeof option === 'string' ? option : option.label
                    const safeValue = escapeHtml(optionValue)
                    const safeLabel = escapeHtml(optionLabel)
                    html += `          <option value="${safeValue}" ${defaultValue === optionValue ? 'selected' : ''}>${safeLabel}</option>\n`
                  })
                }
                html += '        </select>\n'
                break
              case 'radio':
                // Convert csvValues to options array if csvValues exists
                let radioOptionsArray = []
                if (props.csvValues && typeof props.csvValues === 'string') {
                  radioOptionsArray = props.csvValues.split(',').map(opt => opt.trim()).filter(opt => opt !== '').map(opt => ({
                    value: opt,
                    label: opt
                  }))
                } else if (props.options && Array.isArray(props.options)) {
                  radioOptionsArray = props.options
                }
                
                // Save csvValues and alignment as data attributes
                if (radioOptionsArray.length > 0) {
                  html += `        <div class="radio-group" data-alignment="${props.alignment || 'horizontal'}"`
                  if (props.csvValues) {
                    html += ` data-csv-values="${props.csvValues.replace(/"/g, '&quot;')}"`
                  }
                  html += `>\n`
                  radioOptionsArray.forEach((option, index) => {
                    const optionValue = typeof option === 'string' ? option : option.value
                    const optionLabel = typeof option === 'string' ? option : option.label
                    const radioId = `${controlId}_${index}`
                    html += `          <div class="radio-option">\n`
                    html += `            <input type="radio" id="${escapeHtml(radioId)}" name="${escapeHtml(controlId)}" value="${escapeHtml(optionValue)}" ${defaultValue === optionValue ? 'checked' : ''} ${required} />\n`
                    html += `            <label for="${escapeHtml(radioId)}">${escapeHtml(optionLabel)}</label>\n`
                    html += '          </div>\n'
                  })
                  html += '        </div>\n'
                }
                break
              case 'checkbox':
                // Check if it's a checkbox group (has csvValues) or single checkbox
                if (props.csvValues && typeof props.csvValues === 'string') {
                  // Checkbox group
                  let checkboxOptionsArray = props.csvValues.split(',').map(opt => opt.trim()).filter(opt => opt !== '').map(opt => ({
                    value: opt,
                    label: opt
                  }))
                  
                  html += `        <div class="checkbox-group" data-alignment="${props.alignment || 'horizontal'}"`
                  if (props.csvValues) {
                    html += ` data-csv-values="${props.csvValues.replace(/"/g, '&quot;')}"`
                  }
                  html += `>\n`
                  checkboxOptionsArray.forEach((option, index) => {
                    const optionValue = typeof option === 'string' ? option : option.value
                    const optionLabel = typeof option === 'string' ? option : option.label
                    const checkboxId = `${controlId}_${index}`
                    html += `          <div class="checkbox-option">\n`
                    html += `            <input type="checkbox" id="${escapeHtml(checkboxId)}" name="${escapeHtml(controlId)}" value="${escapeHtml(optionValue)}" ${defaultValue === optionValue ? 'checked' : ''} />\n`
                    html += `            <label for="${escapeHtml(checkboxId)}">${escapeHtml(optionLabel)}</label>\n`
                    html += '          </div>\n'
                  })
                  html += '        </div>\n'
                } else {
                  // Single checkbox
                  html += `        <input type="checkbox" id="${controlId}" name="${controlId}" class="form-control" ${defaultValue ? 'checked' : ''} />\n`
                }
                break
              case 'date': {
                const todayExport = new Date().toISOString().slice(0, 10)
                let dateMin = props.minDate
                let dateMax = props.maxDate
                if (props.currentDateOnly) {
                  dateMin = todayExport
                  dateMax = todayExport
                } else {
                  if (props.allowPastDates === false) dateMin = dateMin || todayExport
                  if (props.allowFutureDates === false) dateMax = dateMax || todayExport
                }
                html += `        <input type="date" id="${controlId}" name="${controlId}" class="form-control" ${required} ${readonly} value="${defaultValue}"`
                if (dateMin) html += ` min="${dateMin}"`
                if (dateMax) html += ` max="${dateMax}"`
                html += ` />\n`
                break
              }
              case 'ukunkdate': {
                html += `        <input type="text" id="${controlId}" name="${controlId}" class="form-control ukunk-date-control" data-control-type="ukunkdate" ${required} ${readonly} placeholder="${placeholder || "Select Day / Month / Year"}" value="${defaultValue}" />\n`
                break
              }
              case 'time':
                html += `        <input type="time" id="${controlId}" name="${controlId}" class="form-control" ${required} ${readonly} value="${defaultValue}" />\n`
                break
              case 'file':
                html += `        <input type="file" id="${controlId}" name="${controlId}" class="form-control" ${required} ${readonly}`
                if (props.accept) {
                  html += ` accept="${props.accept}"`
                }
                if (props.multiple) {
                  html += ` multiple`
                }
                html += ` />\n`
                break
              case 'label':
                // Label control - just display text
                html += `        <div class="label-control" id="${controlId}">${labelText}</div>\n`
                break
              case 'hr':
              case 'divider':
                // Divider/HR control
                html += `        <hr id="${controlId}" class="divider-control" />\n`
                break
              case 'table':
                // Table control - save columns, rows, headers, types, and per-cell types (cellTypes) so preview/load shows correct controls
                const columns = props.columns || 1
                const rows = props.rows || 1
                const columnHeaders = props.columnHeaders && Array.isArray(props.columnHeaders) ? props.columnHeaders : []
                const requiredColumn = props.requiredColumn != null && props.requiredColumn >= 0 ? props.requiredColumn : ''
                const requiredRow = props.requiredRow != null && props.requiredRow >= 0 ? props.requiredRow : ''
                const columnTypes = props.columnTypes && Array.isArray(props.columnTypes) ? props.columnTypes : []
                const columnTypesStr = columnTypes.slice(0, columns).map(t => (t || 'text').replace(/,/g, '')).join(',')
                const columnAlignment = props.columnAlignment && Array.isArray(props.columnAlignment) ? props.columnAlignment : []
                const cellTypes = props.cellTypes && Array.isArray(props.cellTypes) ? props.cellTypes : []
                const columnOptionValues = props.columnOptionValues && Array.isArray(props.columnOptionValues) ? props.columnOptionValues : []
                const columnDateRestrictions = props.columnDateRestrictions && Array.isArray(props.columnDateRestrictions) ? props.columnDateRestrictions : []
                const columnTerminologyCoding = props.columnTerminologyCoding && Array.isArray(props.columnTerminologyCoding) ? props.columnTerminologyCoding : []
                const columnDateMinFromField = props.columnDateMinFromField && Array.isArray(props.columnDateMinFromField) ? props.columnDateMinFromField : []
                const columnDateMaxFromField = props.columnDateMaxFromField && Array.isArray(props.columnDateMaxFromField) ? props.columnDateMaxFromField : []
                const cellLabels = props.cellLabels && Array.isArray(props.cellLabels) ? props.cellLabels : []
                const cellLabTestIds = props.cellLabTestIds && Array.isArray(props.cellLabTestIds) ? props.cellLabTestIds : []
                const cellLabTestLabels = props.cellLabTestLabels && Array.isArray(props.cellLabTestLabels) ? props.cellLabTestLabels : []
                const requiredCells = props.requiredCells && Array.isArray(props.requiredCells)
                  ? props.requiredCells.filter(c => c && c.row != null && c.col != null)
                  : []
                const addRow = props.addRow === true
                const maxRows = props.maxRows != null && props.maxRows >= 1 ? Math.min(999, parseInt(props.maxRows, 10)) : 10
                const cellTypesEnc = cellTypes.length ? encodeURIComponent(JSON.stringify(cellTypes)) : ''
                const columnAlignmentEnc = columnAlignment.length ? encodeURIComponent(JSON.stringify(columnAlignment)) : ''
                const columnOptionValuesEnc = columnOptionValues.length ? encodeURIComponent(JSON.stringify(columnOptionValues)) : ''
                const columnDateRestrictionsEnc = columnDateRestrictions.length ? encodeURIComponent(JSON.stringify(columnDateRestrictions)) : ''
                const columnTerminologyCodingEnc = columnTerminologyCoding.length ? encodeURIComponent(JSON.stringify(columnTerminologyCoding)) : ''
                const columnDateMinFromFieldEnc = columnDateMinFromField.length ? encodeURIComponent(JSON.stringify(columnDateMinFromField)) : ''
                const columnDateMaxFromFieldEnc = columnDateMaxFromField.length ? encodeURIComponent(JSON.stringify(columnDateMaxFromField)) : ''
                const cellLabelsEnc = cellLabels.length ? encodeURIComponent(JSON.stringify(cellLabels)) : ''
                const cellLabTestIdsEnc = cellLabTestIds.length ? encodeURIComponent(JSON.stringify(cellLabTestIds)) : ''
                const cellLabTestLabelsEnc = cellLabTestLabels.length ? encodeURIComponent(JSON.stringify(cellLabTestLabels)) : ''
                const requiredCellsEnc = requiredCells.length ? encodeURIComponent(JSON.stringify(requiredCells)) : ''
                html += `        <table id="${controlId}" class="table-control" data-columns="${columns}" data-rows="${rows}" data-required-column="${requiredColumn}" data-required-row="${requiredRow}" data-add-row="${addRow ? 'true' : 'false'}" data-max-rows="${maxRows}" data-column-types="${columnTypesStr}"${cellTypesEnc ? ` data-cell-types="${cellTypesEnc}"` : ''}${columnAlignmentEnc ? ` data-column-alignment="${columnAlignmentEnc}"` : ''}${columnOptionValuesEnc ? ` data-column-option-values="${columnOptionValuesEnc}"` : ''}${columnDateRestrictionsEnc ? ` data-column-date-restrictions="${columnDateRestrictionsEnc}"` : ''}${columnTerminologyCodingEnc ? ` data-column-terminology-coding="${columnTerminologyCodingEnc}"` : ''}${columnDateMinFromFieldEnc ? ` data-column-date-min-from-field="${columnDateMinFromFieldEnc}"` : ''}${columnDateMaxFromFieldEnc ? ` data-column-date-max-from-field="${columnDateMaxFromFieldEnc}"` : ''}${cellLabelsEnc ? ` data-cell-labels="${cellLabelsEnc}"` : ''}${cellLabTestIdsEnc ? ` data-cell-lab-test-ids="${cellLabTestIdsEnc}"` : ''}${cellLabTestLabelsEnc ? ` data-cell-lab-test-labels="${cellLabTestLabelsEnc}"` : ''}${requiredCellsEnc ? ` data-required-cells="${requiredCellsEnc}"` : ''}>\n`
                // Embed in HTML comment so backend cannot strip it; parseHtmlContent reads this if data-* attrs are missing
                if (cellTypes.length || columnAlignment.length || columnOptionValues.length || columnDateRestrictions.length || columnTerminologyCoding.length || columnDateMinFromField.length || columnDateMaxFromField.length || cellLabels.length || cellLabTestIds.length || cellLabTestLabels.length || requiredCells.length || addRow) {
                  try {
                    const tableDataEnc = encodeURIComponent(JSON.stringify({ cellTypes, columnAlignment, columnOptionValues, columnDateRestrictions, columnTerminologyCoding, columnDateMinFromField, columnDateMaxFromField, cellLabels, cellLabTestIds, cellLabTestLabels, requiredCells, addRow, maxRows }))
                    if (tableDataEnc) html += `          <!-- crf-table-data:${tableDataEnc} -->\n`
                  } catch (_) {}
                }
                html += `          <thead>\n`
                html += `            <tr>\n`
                for (let i = 0; i < columns; i++) {
                  const headerText = (columnHeaders[i] != null && columnHeaders[i] !== '') ? columnHeaders[i] : `Column ${i + 1}`
                  const reqStar = (props.requiredColumn === i) ? ' *' : ''
                  html += `              <th>${headerText}${reqStar}</th>\n`
                }
                html += `            </tr>\n`
                html += `          </thead>\n`
                html += `          <tbody>\n`
                for (let i = 0; i < rows; i++) {
                  html += `            <tr>\n`
                  for (let j = 0; j < columns; j++) {
                    html += `              <td></td>\n`
                  }
                  html += `            </tr>\n`
                }
                html += `          </tbody>\n`
                html += `        </table>\n`
                break
              case 'lab':
                // Lab control - similar to text but for lab values
                html += `        <input type="text" id="${controlId}" name="${controlId}" class="form-control lab-control" ${required} ${readonly} placeholder="${placeholder}" value="${defaultValue}" ${props.maxLength ? `maxlength="${props.maxLength}"` : ''} />\n`
                break
              default:
                html += `        <input type="text" id="${controlId}" name="${controlId}" class="form-control" ${required} ${readonly} placeholder="${placeholder}" value="${defaultValue}" />\n`
            }
            
            if (props.tooltip) {
              html += `        <small class="control-tooltip">${props.tooltip}</small>\n`
            }
            
            html += '      </div>\n'
          })
        }
        
        html += '    </div>\n'
        html += '  </div>\n'
      })
    }
    
    html += '</div>'
    return html
  }

  // Undo/Redo state
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  // CRF Configuration state
  const [crfConfig, setCrfConfig] = useState({
    name: "",
    group: "",
    category: "",
    description: "",
    remarks: "",
    isFinalPrint: "",
    isScreenFailedCrf: false,
    isRandomizedEnrolledCrf: false,
    isStratificationCrf: false,
    activityRights: []
  })

  // Auto-expand config panel if name is not filled (initialize after crfConfig)
  const [showConfigPanel, setShowConfigPanel] = useState(true) // Start expanded when name is empty

  // Auto-expand config panel if name is not filled
  useEffect(() => {
    const isNameFilled = crfConfig.name && crfConfig.name.trim() !== ""
    if (!isNameFilled && !showConfigPanel) {
      setShowConfigPanel(true)
    }
  }, [crfConfig.name, showConfigPanel])

  // Save state to history
  const saveToHistory = useCallback((newSections, newConfig = null) => {
    const state = {
      sections: JSON.parse(JSON.stringify(newSections)),
      config: newConfig ? JSON.parse(JSON.stringify(newConfig)) : crfConfig
    }
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1)
      newHistory.push(state)
      // Keep only last 50 states
      if (newHistory.length > 50) newHistory.shift()
      return newHistory
    })
    setHistoryIndex(prev => Math.min(prev + 1, 49))
  }, [historyIndex, crfConfig, crfRules])

  // Undo/Redo handlers
  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1]
      setSections(prevState.sections)
      setCrfConfig(prevState.config)
      setHistoryIndex(prev => prev - 1)
      toast({
        title: "Undone",
        description: "Last action has been undone"
      })
    }
  }

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1]
      setSections(nextState.sections)
      setCrfConfig(nextState.config)
      if (nextState.rules) setCrfRules(nextState.rules)
      setHistoryIndex(prev => prev + 1)
      toast({
        title: "Redone",
        description: "Action has been redone"
      })
    }
  }

  // Duplicate control
  const handleDuplicateControl = (controlId) => {
    const section = sections.find(s => s.controls.some(c => c.id === controlId))
    if (!section) return

    const control = section.controls.find(c => c.id === controlId)
    if (!control) return

    const duplicatedControl = {
      ...JSON.parse(JSON.stringify(control)),
      id: generateId(),
      label: `${control.label} (Copy)`
    }

    const controlIndex = section.controls.indexOf(control)
    const newControls = [...section.controls]
    newControls.splice(controlIndex + 1, 0, duplicatedControl)

    updateSectionControls(section.id, newControls)
    setSelectedControl(duplicatedControl)
    toast({
      title: "Control Duplicated",
      description: "Control has been duplicated successfully"
    })
  }

  const refreshSelectedControlFromSections = (nextSections) => {
    if (!selectedControl?.id) return
    const refreshed = findControlInSections(nextSections, selectedControl.id)
    if (refreshed) setSelectedControl(refreshed)
  }

  const selectControlWithRulesAfterImport = (control, nextSections) => {
    if (!control) {
      refreshSelectedControlFromSections(nextSections)
      return
    }
    const section = nextSections.find((s) => (s.controls || []).some((c) => c.id === control.id))
    if (section?.id) setActiveSection(section.id)
    setSelectedControl(control)
    if (control.type === "table") {
      const cell = resolveTableCellSelectionFromRules(control)
      if (cell) {
        setSelectedTableRowForRules(cell.row)
        setSelectedTableColumnForRules(cell.col)
      } else {
        setSelectedTableRowForRules(null)
        setSelectedTableColumnForRules(null)
      }
    }
  }

  const loadCrfWithRulesIntoDesigner = async (crfData, { rules: prefetchedRules = null } = {}) => {
    if (!crfData) return

    const loadedConfig = buildCrfDesignerConfigFromApi(crfData, crfData.config)
    setCdashMappings(normalizeCdashMappingsFromApi(crfData))
    cdashMappingsDirtyRef.current = false
    let loadedSections = []
    if (crfData.sections?.length > 0) {
      loadedSections = normalizeCrfSections(crfData.sections)
    } else if (crfData.htmlContent) {
      loadedSections = normalizeCrfSections(parseHtmlContent(crfData.htmlContent))
    } else {
      loadedSections = normalizeCrfSections([{ id: "section_1", name: "Section 1", controls: [] }])
    }

    let apiRules = []
    if (crfData.id) {
      try {
        const rulesResponse = await crfRuleService.getCrfRulesByCrfId(crfData.id)
        if (rulesResponse?.isSuccess && Array.isArray(rulesResponse.data)) {
          apiRules = rulesResponse.data
        }
      } catch (error) {
        console.warn("Could not load CRF rules after import", error)
      }
    }

    const bundleRules = Array.isArray(crfData.rules) ? crfData.rules : []
    const fallbackRules = Array.isArray(prefetchedRules) ? prefetchedRules : []
    const rulesForMap =
      apiRules.length > 0
        ? apiRules
        : fallbackRules.length > 0
          ? fallbackRules
          : bundleRules.length > 0
            ? bundleRules
            : []

    const sectionsWithRules =
      rulesForMap.length > 0 ? mapApiRulesOntoSections(loadedSections, rulesForMap) : loadedSections

    setCrfConfig(loadedConfig)
    setSections(sectionsWithRules)
    setActiveSection(sectionsWithRules[0]?.id || "section_1")
    setCrfRules(
      (apiRules.length > 0 ? apiRules : rulesForMap)
        .map(normalizeCrfRuleFromApi)
        .filter(Boolean),
    )

    if (crfData.id) setCurrentCrfId(crfData.id)
    if (crfData.crfFormType) setSelectedVisit(crfFormTypeToDesignerVisitLabel(crfData.crfFormType))

    const controlWithRules = findFirstControlWithRules(sectionsWithRules)
    selectControlWithRulesAfterImport(controlWithRules, sectionsWithRules)
  }

  const resolveExportRules = async () => {
    let apiRules = []
    const crfIdForExport = currentCrfId || initialCRF?.id
    if (crfIdForExport) {
      try {
        const rulesResponse = await crfRuleService.getCrfRulesByCrfId(crfIdForExport)
        if (rulesResponse?.isSuccess && Array.isArray(rulesResponse.data)) {
          apiRules = rulesResponse.data
        }
      } catch (error) {
        console.warn("CRF export: could not refresh rules from API", error)
      }
    }
    return collectRulesForExport(apiRules.length > 0 ? apiRules : crfRules, sections)
  }

  const openExportDialog = async () => {
    const crfIdForExport = currentCrfId || initialCRF?.id
    const studyIdForExport = selectedStudy?.studyId || selectedStudy?.id
    let count = collectRulesForExport(crfRules, sections).length
    if (crfIdForExport && studyIdForExport) {
      try {
        const preview = await crfDesignService.exportBundle(crfIdForExport, studyIdForExport, { includeRules: true })
        count = preview?.meta?.ruleCount ?? preview?.rules?.length ?? count
      } catch {
        // Fall back to local rule count when API preview is unavailable.
      }
    }
    setTransferRuleCount(count)
    setTransferIncludeRules(true)
    setExportDialogOpen(true)
  }

  const buildLocalBundleForExport = async () => {
    const exportedRules = transferIncludeRules ? await resolveExportRules() : []
    const crfStructure = {
      config: crfConfig,
      sections,
      rules: exportedRules,
    }
    const htmlContent = generateHtmlContent(crfStructure)
    return {
      meta: {
        bundleVersion: 1,
        exportedAt: new Date().toISOString(),
        includeRules: transferIncludeRules,
        ruleCount: exportedRules.length,
        sourceStudyId: selectedStudy ? (selectedStudy.studyId ?? selectedStudy.id) : null,
        sourceStudyProtocolNumber: selectedStudy?.studyProtocolNumber ?? selectedStudy?.name ?? null,
        sourceCrfDesignId: currentCrfId || initialCRF?.id || null,
        sourceCrfDesignName: crfConfig.name || "CRF",
      },
      design: {
        name: crfConfig.name || "CRF",
        description: crfConfig.description || "",
        htmlContent,
        remarks: crfConfig.remarks || "",
        isFinalPrint: Boolean(crfConfig.isFinalPrint),
        status: "Draft",
        crfFormType: selectedVisit ? getCrfFormTypeEnum(selectedVisit) : null,
        isScreenFailedCrf: Boolean(crfConfig.isScreenFailedCrf),
        isRandomizedEnrolledCrf: Boolean(crfConfig.isRandomizedEnrolledCrf),
        isStratificationCrf: Boolean(crfConfig.isStratificationCrf),
      },
      rules: transferIncludeRules ? exportedRules : [],
      exportVersion: 2,
      config: crfConfig,
      sections,
      visit: selectedVisit || null,
      crfFormType: selectedVisit ? getCrfFormTypeEnum(selectedVisit) : null,
    }
  }

  const handleExportConfirm = async () => {
    setTransferLoading(true)
    try {
      const crfIdForExport = currentCrfId || initialCRF?.id
      const studyIdForExport = selectedStudy?.studyId || selectedStudy?.id
      let bundle
      if (crfIdForExport && studyIdForExport) {
        bundle = await crfDesignService.exportBundle(crfIdForExport, studyIdForExport, {
          includeRules: transferIncludeRules,
        })
      } else {
        bundle = await buildLocalBundleForExport()
      }
      const fileName = `${crfConfig.name || bundle?.design?.name || "crf"}-bundle-${Date.now()}.json`
      downloadBundleJson(bundle, fileName)
      setExportDialogOpen(false)
      const ruleCount = bundle?.meta?.ruleCount ?? bundle?.rules?.length ?? 0
      toast({
        title: "Bundle exported",
        description: transferIncludeRules && ruleCount > 0
          ? `CRF bundle downloaded with ${ruleCount} rule${ruleCount === 1 ? "" : "s"}.`
          : "CRF structure bundle downloaded successfully.",
      })
    } catch (error) {
      toast({
        title: "Export Failed",
        description: error?.message || "Could not export CRF bundle.",
        variant: "destructive",
      })
    } finally {
      setTransferLoading(false)
    }
  }

  const applyImportedCrfData = (importedData, importRules) => {
    const apiDesign = importedData?.design
    const isApiBundle = Boolean(apiDesign && importedData?.meta?.bundleVersion)
    let nextSections = null

    if (isApiBundle) {
      setCrfConfig((prev) => ({
        ...prev,
        name: apiDesign.name || prev.name,
        description: apiDesign.description || prev.description || "",
        remarks: apiDesign.remarks || prev.remarks || "",
        isFinalPrint: apiDesign.isFinalPrint ?? prev.isFinalPrint,
        isScreenFailedCrf: apiDesign.isScreenFailedCrf ?? prev.isScreenFailedCrf,
        isRandomizedEnrolledCrf: apiDesign.isRandomizedEnrolledCrf ?? prev.isRandomizedEnrolledCrf,
        isStratificationCrf: apiDesign.isStratificationCrf ?? prev.isStratificationCrf,
      }))
      if (apiDesign.crfFormType != null) {
        setSelectedVisit(crfFormTypeToDesignerVisitLabel(apiDesign.crfFormType))
      }
      if (apiDesign.htmlContent) {
        const parsed = parseHtmlContent(apiDesign.htmlContent)
        if (parsed?.length) {
          const norm = normalizeCrfSections(parsed)
          const bundleRules = importRules ? (importedData.rules || []) : []
          nextSections =
            importRules && bundleRules.length > 0 ? mapApiRulesOntoSections(norm, bundleRules) : norm
          setSections(nextSections)
          setActiveSection(nextSections[0]?.id || "section_1")
          if (importRules && bundleRules.length > 0) {
            setCrfRules(bundleRules.map(normalizeCrfRuleFromApi).filter(Boolean))
          }
        }
      }
    } else {
      if (importedData.config) setCrfConfig(importedData.config)

      const importedRules = importRules
        ? collectRulesForExport(importedData.rules || [], importedData.sections || [])
        : []

      if (importedData.sections && importedData.sections.length > 0) {
        const norm = normalizeCrfSections(importedData.sections)
        nextSections =
          importRules && importedRules.length > 0 ? mapApiRulesOntoSections(norm, importedRules) : norm
        setSections(nextSections)
        setActiveSection(nextSections[0]?.id || "section_1")
      }

      if (importRules && importedRules.length > 0) {
        setCrfRules(importedRules.map(normalizeCrfRuleFromApi).filter(Boolean))
      }

      if (importedData.visit && visitOptions.includes(importedData.visit)) {
        setSelectedVisit(importedData.visit)
      } else if (importedData.crfFormType !== undefined && importedData.crfFormType !== null) {
        setSelectedVisit(crfFormTypeToDesignerVisitLabel(importedData.crfFormType))
      }
      if (importedData.studyId != null) {
        const study = availableStudies.find((s) => (s.studyId ?? s.id) == importedData.studyId)
        if (study) {
          setSelectedStudy(study)
        } else {
          importedStudyIdRef.current = importedData.studyId
        }
      }
    }

    if (nextSections) {
      selectControlWithRulesAfterImport(findFirstControlWithRules(nextSections), nextSections)
    }
    return nextSections
  }

  const handleImport = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".json"
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const importedData = JSON.parse(event.target.result)
          pendingImportDataRef.current = importedData
          const ruleCount = countBundleRules(importedData)
          const defaultIncludeRules =
            importedData.includeRules !== false &&
            importedData.meta?.includeRules !== false &&
            ruleCount > 0
          setTransferRuleCount(ruleCount)
          setTransferIncludeRules(defaultIncludeRules)
          setTransferImportMethod(selectedStudy ? "api" : "designer")
          setImportDialogOpen(true)
        } catch (error) {
          toast({
            title: "Import Failed",
            description: "Invalid file format. Please check the file and try again.",
            variant: "destructive",
          })
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const handleImportConfirm = async () => {
    const importedData = pendingImportDataRef.current
    if (!importedData) {
      setImportDialogOpen(false)
      return
    }

    if (transferImportMethod === "api") {
      const targetStudyId = selectedStudy?.studyId || selectedStudy?.id
      if (!targetStudyId) {
        toast({
          title: "Study required",
          description: "Select a target study before importing the bundle.",
          variant: "destructive",
        })
        return
      }

      setTransferLoading(true)
      try {
        let htmlContent = importedData?.design?.htmlContent || importedData?.htmlContent || ""
        const crfFormType =
          importedData?.design?.crfFormType ??
          importedData?.crfFormType ??
          (importedData?.visit ? getCrfFormTypeEnum(importedData.visit) : getCrfFormTypeEnum(selectedVisit))

        if (!htmlContent?.trim() && importedData?.sections?.length) {
          htmlContent = generateHtmlContent({
            config: importedData.config || {},
            sections: importedData.sections,
            rules: importedData.rules || [],
          })
        }

        const payload = normalizeToImportBundlePayload(importedData, {
          targetStudyId,
          includeRules: transferIncludeRules,
          htmlContent,
          crfFormType,
        })
        const result = await crfDesignService.importBundle(payload)
        const importedCrfId = result?.crfDesignId ?? result?.CrfDesignId
        if (importedCrfId) {
          crfLoadedRef.current = `${importedCrfId}_${targetStudyId}`
          const designResp = await crfDesignService.getCrfDesignById(importedCrfId, targetStudyId)
          if (designResp?.isSuccess && designResp.data) {
            const bundleRulesForMap = transferIncludeRules
              ? (importedData?.rules || payload?.bundle?.rules || [])
              : []
            await loadCrfWithRulesIntoDesigner(designResp.data, {
              rules: bundleRulesForMap.length > 0 ? bundleRulesForMap : null,
            })
          }
        }
        pendingImportDataRef.current = null
        setImportDialogOpen(false)
        toast({
          title: "Bundle imported",
          description: `CRF loaded (ID ${importedCrfId}) with ${result?.rulesCreated ?? 0} rule(s) on server.`,
          variant: "success",
        })
        if (onSave) onSave()
      } catch (error) {
        toast({
          title: "Import Failed",
          description: error?.message || "Could not import CRF bundle to study.",
          variant: "destructive",
        })
      } finally {
        setTransferLoading(false)
      }
      return
    }

    applyImportedCrfData(importedData, transferIncludeRules)
    pendingImportDataRef.current = null
    setImportDialogOpen(false)
    toast({
      title: "Loaded in designer",
      description: transferIncludeRules && transferRuleCount > 0
        ? `CRF loaded with ${transferRuleCount} rule${transferRuleCount === 1 ? "" : "s"}. Save to persist.`
        : "CRF structure loaded in designer.",
    })
  }

  // Update currentCrfId when initialCRF changes
  useEffect(() => {
    if (initialCRF?.id) {
      setCurrentCrfId(initialCRF.id)
    }
  }, [initialCRF?.id])

  // CRITICAL: Update selectedControl when sections change (e.g., after rules are loaded)
  // This ensures that when editing a CRF, the selected control shows its assigned rules
  useEffect(() => {
    if (selectedControl?.id) {
      // Find the control in current sections state (which has the latest rules)
      const section = sections.find(s => s.controls.some(c => c.id === selectedControl.id))
      const currentControl = section?.controls.find(c => c.id === selectedControl.id)
      
      if (currentControl) {
        // Only update if the control's rules have changed
        const currentRules = currentControl.properties?.rules || []
        const selectedRules = selectedControl.properties?.rules || []
        
        // Compare rule IDs to detect changes
        const currentRuleIds = currentRules.map(r => r.id).sort().join(',')
        const selectedRuleIds = selectedRules.map(r => r.id).sort().join(',')
        
        if (currentRuleIds !== selectedRuleIds) {
          console.log("Updating selectedControl with latest rules from sections")
          console.log("Previous rules:", selectedRuleIds)
          console.log("Current rules:", currentRuleIds)
          setSelectedControl(currentControl)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]) // Only depend on sections to avoid infinite loops

  // Load initial CRF if provided and initialize history
  useEffect(() => {
    // Prevent duplicate calls - only load once per initialCRF
    const crfKey = initialCRF?.id ? `${initialCRF.id}_${initialCRF.studyId}` : 'new'
    if (crfLoadedRef.current === crfKey) {
      return
    }
    
    const loadInitialCRF = async () => {
      if (initialCRF) {
        crfLoadedRef.current = crfKey
        let crfData = initialCRF
        
        // CRITICAL: Don't fetch if sections are already available (handleEdit already fetched it)
        // Only fetch if we truly don't have the data
        if (initialCRF.id && (!initialCRF.sections || initialCRF.sections.length === 0) && !initialCRF.htmlContent) {
          try {
            // Try to fetch full CRF data if we have studyId
            if (initialCRF.studyId) {
              console.log("Fetching full CRF data (sections missing)...")
              const response = await crfDesignService.getCrfDesignById(initialCRF.id, initialCRF.studyId)
              if (response.isSuccess && response.data) {
                const fullCRF = response.data
                crfData = {
                  ...initialCRF,
                  ...fullCRF,
                  studyId: fullCRF.studyId || initialCRF.studyId,
                  crfFormType: fullCRF.crfFormType || initialCRF.crfFormType
                }
              }
            }
          } catch (error) {
            console.error("Error fetching full CRF data:", error)
            crfLoadedRef.current = null // Reset on error to allow retry
          }
        } else {
          console.log("Using provided CRF data (sections/htmlContent already available)")
        }

        // Set study if available
        if (crfData.studyId && availableStudies.length > 0) {
          const study = availableStudies.find(s => (s.studyId || s.id) === crfData.studyId)
          if (study) {
            setSelectedStudy(study)
          }
        }

        // Set visit based on crfFormType enum or string
        if (crfData.crfFormType) {
          setSelectedVisit(crfFormTypeToDesignerVisitLabel(crfData.crfFormType))
        }

        const loadedConfig = buildCrfDesignerConfigFromApi(crfData, crfData.config)
        setCdashMappings(normalizeCdashMappingsFromApi(crfData))
        cdashMappingsDirtyRef.current = false
        
        // Parse sections from HTML content if sections are not available
        let loadedSections = []
        if (crfData.sections && crfData.sections.length > 0) {
          // Use sections directly if available
          loadedSections = crfData.sections
        } else if (crfData.htmlContent) {
          // Parse HTML content to extract sections
          loadedSections = parseHtmlContent(crfData.htmlContent)
          // If backend strips table-only props in HTML, recover from sections payload when available.
          if (crfData.sections && Array.isArray(crfData.sections)) {
            const apiControlsById = new Map()
            crfData.sections.forEach(sec => {
              ;(sec.controls || []).forEach(ctrl => {
                if (ctrl?.id) apiControlsById.set(ctrl.id, ctrl)
              })
            })
            loadedSections = loadedSections.map(sec => ({
              ...sec,
              controls: (sec.controls || []).map(ctrl => {
                if (!ctrl?.id) return ctrl
                const apiControl = apiControlsById.get(ctrl.id)
                if (!apiControl?.properties) return ctrl
                const isTable = String(ctrl?.type || "").toLowerCase() === "table"
                const hasColumnDateRestrictions =
                  Array.isArray(ctrl.properties?.columnDateRestrictions) &&
                  ctrl.properties.columnDateRestrictions.length > 0
                const hasColumnTerminologyCoding =
                  Array.isArray(ctrl.properties?.columnTerminologyCoding) &&
                  ctrl.properties.columnTerminologyCoding.some((x) => x && String(x).trim())
                const hasTerminologyCoding = Boolean(ctrl.properties?.terminologyCoding)
                const hasGenderSpecific = Boolean(ctrl.properties?.genderSpecific)
                if ((isTable && hasColumnDateRestrictions) && hasGenderSpecific) return ctrl
                return {
                  ...ctrl,
                  properties: {
                    ...ctrl.properties,
                    ...(isTable && !hasColumnDateRestrictions
                      ? { columnDateRestrictions: apiControl.properties.columnDateRestrictions || [] }
                      : {}),
                    ...(isTable && !hasColumnTerminologyCoding
                      ? { columnTerminologyCoding: apiControl.properties.columnTerminologyCoding || [] }
                      : {}),
                    ...(!hasTerminologyCoding && apiControl.properties?.terminologyCoding
                      ? { terminologyCoding: apiControl.properties.terminologyCoding }
                      : {}),
                    ...(!hasGenderSpecific && apiControl.properties.genderSpecific
                      ? { genderSpecific: apiControl.properties.genderSpecific }
                      : {}),
                  },
                }
              }),
            }))
          }
          if (loadedSections.length === 0) {
            // Fallback to empty section if parsing fails
            loadedSections = normalizeCrfSections([
              { id: "section_1", name: "Section 1", controls: [] },
            ])
          }
        } else {
          // Default empty section
          loadedSections = normalizeCrfSections([
            { id: "section_1", name: "Section 1", controls: [] },
          ])
        }

        loadedSections = normalizeCrfSections(loadedSections)

        setCrfConfig(loadedConfig)
        setSections(loadedSections)
        setActiveSection(loadedSections[0].id)

        let finalSections = loadedSections
        let loadedRules = []
        if (crfData.id) {
          try {
            const rulesResponse = await crfRuleService.getCrfRulesByCrfId(crfData.id)
            if (rulesResponse?.isSuccess && Array.isArray(rulesResponse.data) && rulesResponse.data.length > 0) {
              finalSections = mapApiRulesOntoSections(loadedSections, rulesResponse.data)
              loadedRules = rulesResponse.data.map(normalizeCrfRuleFromApi).filter(Boolean)
              setSections(finalSections)
              setCrfRules(loadedRules)
            } else if (crfData.rules?.length) {
              finalSections = mapApiRulesOntoSections(loadedSections, crfData.rules)
              loadedRules = crfData.rules.map(normalizeCrfRuleFromApi).filter(Boolean)
              setSections(finalSections)
              setCrfRules(loadedRules)
            }
          } catch (error) {
            console.error("Error fetching and mapping rules:", error)
            if (crfData.rules?.length) {
              finalSections = mapApiRulesOntoSections(loadedSections, crfData.rules)
              loadedRules = crfData.rules.map(normalizeCrfRuleFromApi).filter(Boolean)
              setSections(finalSections)
              setCrfRules(loadedRules)
            }
          }
        } else if (crfData.rules?.length) {
          finalSections = mapApiRulesOntoSections(loadedSections, crfData.rules)
          loadedRules = crfData.rules.map(normalizeCrfRuleFromApi).filter(Boolean)
          setSections(finalSections)
          setCrfRules(loadedRules)
        }

        refreshSelectedControlFromSections(finalSections)
        const controlWithRules = findFirstControlWithRules(finalSections)
        if (controlWithRules && !selectedControl?.id) {
          selectControlWithRulesAfterImport(controlWithRules, finalSections)
        }

        // Initialize history with loaded state (using final sections with mapped rules)
        setHistory([{
          sections: JSON.parse(JSON.stringify(finalSections)),
          config: JSON.parse(JSON.stringify(loadedConfig)),
          rules: JSON.parse(JSON.stringify(loadedRules))
        }])
        setHistoryIndex(0)
      } else {
        // Initialize history with default state
        setHistory([
          {
            sections: JSON.parse(
              JSON.stringify(
                normalizeCrfSections([
                  { id: "section_1", name: "Section 1", controls: [] },
                ]),
              ),
            ),
            config: JSON.parse(JSON.stringify(crfConfig)),
            rules: [],
          },
        ])
        setHistoryIndex(0)
      }
    }

    // Load initial CRF (only when initialCRF changes, not when availableStudies changes)
    loadInitialCRF()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCRF?.id, initialCRF?.studyId]) // Only depend on CRF ID and studyId, not availableStudies

  // Fetch studies on mount (only once)
  useEffect(() => {
    // Prevent duplicate calls
    if (studiesFetchedRef.current) {
      return
    }
    
    const fetchStudies = async () => {
      studiesFetchedRef.current = true
      setLoadingStudies(true)
      try {
        const response = await studyService.getStudiesForDropdown()
        if (response?.isSuccess && response?.data) {
          const list = Array.isArray(response.data) ? response.data : []
          setAvailableStudies(list)
        }
      } catch (error) {
        console.error("Error fetching studies:", error)
        studiesFetchedRef.current = false // Reset on error to allow retry
      } finally {
        setLoadingStudies(false)
      }
    }
    fetchStudies()
  }, [])

  // Restore study from imported CRF when studies finish loading (import may happen before studies load)
  useEffect(() => {
    if (availableStudies.length === 0 || importedStudyIdRef.current == null) return
    const study = availableStudies.find(s => (s.studyId ?? s.id) == importedStudyIdRef.current)
    if (study) {
      setSelectedStudy(study)
      importedStudyIdRef.current = null
    }
  }, [availableStudies])

  // CRITICAL: Set study and visit when studies load and we have pending data from initialCRF
  useEffect(() => {
    // Only run if we have studies loaded and initialCRF data
    if (availableStudies.length === 0 || !initialCRF) {
      return
    }

    // If study is not selected but we have studyId from initialCRF, set it
    if (!selectedStudy && initialCRF.studyId) {
      const study = availableStudies.find(s => (s.studyId || s.id) === initialCRF.studyId)
      if (study) {
        console.log("Setting study from initialCRF after studies loaded:", study)
        setSelectedStudy(study)
      }
    }

    // If visit is not selected but we have crfFormType from initialCRF, set it
    if (!selectedVisit && initialCRF.crfFormType) {
      const visitName = crfFormTypeToDesignerVisitLabel(initialCRF.crfFormType)
      if (selectedStudy || (initialCRF.studyId && availableStudies.find(s => (s.studyId || s.id) === initialCRF.studyId))) {
        console.log("Setting visit from initialCRF after studies loaded:", visitName)
        setSelectedVisit(visitName)
      }
    }
  }, [availableStudies, initialCRF?.studyId, initialCRF?.crfFormType, selectedStudy, selectedVisit])

  // Reset visit when study changes (but preserve if we're loading initialCRF)
  useEffect(() => {
    // Don't reset visit if we're in the middle of loading initialCRF
    if (!selectedStudy && !initialCRF) {
      setSelectedVisit("")
    }
  }, [selectedStudy, initialCRF])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    setDndReady(true)
  }, [])

  const handleDragStart = (event) => {
    setActiveId(event.active.id)
    const activeData = event.active?.data?.current
    if (activeData?.sectionId) {
      setActiveSection(activeData.sectionId)
      return
    }
    const controlSectionId = findSectionIdByControlId(sections, event.active.id)
    if (controlSectionId) {
      setActiveSection(controlSectionId)
    }
  }

  // Check if CRF Configuration is valid (at least name is filled)
  const isConfigValid = 
    crfConfig.name && crfConfig.name.trim() !== "" &&
    selectedStudy &&
    selectedVisit && selectedVisit.trim() !== ""

  const handleDragEnd = (event) => {
    const { active, over } = event

    if (!over) {
      setActiveId(null)
      return
    }

    const activeStr = String(active.id)
    const overStr = String(over.id)
    // Section tab reorder — uses dedicated sortable ids; allowed even when CRF config is incomplete.
    if (
      activeStr.startsWith(SECTION_TAB_SORTABLE_ID_PREFIX) &&
      overStr.startsWith(SECTION_TAB_SORTABLE_ID_PREFIX)
    ) {
      const fromId = activeStr.slice(SECTION_TAB_SORTABLE_ID_PREFIX.length)
      const toId = overStr.slice(SECTION_TAB_SORTABLE_ID_PREFIX.length)
      if (fromId && toId && fromId !== toId) {
        setSections((prev) => {
          const oldIndex = prev.findIndex((s) => s.id === fromId)
          const newIndex = prev.findIndex((s) => s.id === toId)
          if (oldIndex === -1 || newIndex === -1) return prev
          const next = arrayMove(prev, oldIndex, newIndex)
          saveToHistory(next)
          return next
        })
      }
      setActiveId(null)
      return
    }

    // Prevent drag and drop if CRF Configuration is not filled
    if (!isConfigValid) {
      setActiveId(null)
      // Determine which fields are missing
      const missingFields = []
      if (!crfConfig.name || crfConfig.name.trim() === "") {
        missingFields.push("Name")
      }
      if (!selectedStudy) {
        missingFields.push("Study")
      }
      if (!selectedVisit || selectedVisit.trim() === "") {
        missingFields.push("Visit")
      }
      
      toast({
        title: "Configuration Required",
        description: `Please fill in the CRF Configuration (${missingFields.join(", ")} ${missingFields.length === 1 ? "is" : "are"} required) before adding controls.`,
        variant: "destructive"
      })
      return
    }

    // If dragging from tools panel
    if (typeof active.id === 'string' && active.id.startsWith('tool_')) {
      if (studyCompletionDesignerMode && !designerControlsDropEnabled) {
        toast({
          title: "Status block required",
          description:
            "Add a patient status block (Discontinued, Withdrawn, Lost to follow-up, or Death) and select its tab before adding fields.",
          variant: "destructive",
        })
        setActiveId(null)
        return
      }
      const toolType = active.id.replace('tool_', '')
      const overStr = over.id.toString()
      if (overStr.startsWith('tablecell_')) {
        handleDropOnTableCell(toolType, overStr)
        setActiveId(null)
        return
      }
      const targetSectionId = resolveSectionIdFromDropTarget(sections, over, activeSection)
      if (!targetSectionId) {
        setActiveId(null)
        return
      }
      if (
        studyCompletionDesignerMode &&
        !canAddControlsInStudyCompletionDesigner(studyCompletionDesignerMode, sections, targetSectionId)
      ) {
        toast({
          title: "Activate status block",
          description: "Click the status block or chip first, then drop the tool there.",
          variant: "destructive",
        })
        setActiveId(null)
        return
      }
      setActiveSection(targetSectionId)
      addControlToSection(targetSectionId, toolType, over.id)
    }
    // Reorder within the section that owns the dragged control
    else {
      const sourceSectionId = findSectionIdByControlId(sections, active.id)
      if (!sourceSectionId) {
        setActiveId(null)
        return
      }
      setActiveSection(sourceSectionId)
      const section = sections.find((s) => s.id === sourceSectionId)
      if (!section) {
        setActiveId(null)
        return
      }

      const overStr = String(over.id)
      const dropParsed = parseDropzoneDroppableId(overStr)
      const isDropzone = dropParsed != null || overStr.startsWith("dropzone")
      const isOverControl = section.controls.some((c) => c.id === over.id)

      if (!isDropzone && !isOverControl) {
        setActiveId(null)
        return
      }

      const targetSectionId = resolveSectionIdFromDropTarget(sections, over, sourceSectionId)
      if (targetSectionId !== sourceSectionId) {
        setActiveId(null)
        return
      }

      const oldIndex = section.controls.findIndex((c) => c.id === active.id)
      if (oldIndex === -1) {
        setActiveId(null)
        return
      }

      let newIndex
      if (isDropzone && dropParsed) {
        newIndex = dropParsed.index
      } else if (isDropzone) {
        newIndex = Number.parseInt(overStr.replace("dropzone_", ""), 10)
        if (Number.isNaN(newIndex)) newIndex = 0
      } else {
        const overControl = section.controls.find((c) => c.id === over.id)
        newIndex = section.controls.indexOf(overControl)
        if (newIndex < oldIndex) {
          // insert before
        } else {
          newIndex += 1
        }
      }

      if (newIndex !== oldIndex) {
        const newControls = arrayMove(section.controls, oldIndex, newIndex)
        updateSectionControls(sourceSectionId, newControls)
      }
    }

    setActiveId(null)
  }

  const handleDropOnTableCell = (toolType, tableCellDropId) => {
    if (toolType === "table") {
      toast({
        title: "Not allowed",
        description: "Cannot add a table inside a table.",
        variant: "destructive"
      })
      return
    }
    const parts = tableCellDropId.split("|")
    if (parts.length !== 3) return
    const tableId = parts[0].replace(/^tablecell_/, "")
    const rowIdx = parseInt(parts[1], 10)
    const colIdx = parseInt(parts[2], 10)
    if (Number.isNaN(rowIdx) || rowIdx < 0 || Number.isNaN(colIdx) || colIdx < 0) return

    const section = sections.find(s => s.controls.some(c => c.id === tableId))
    if (!section) return
    const tableControl = section.controls.find(c => c.id === tableId)
    if (!tableControl || tableControl.type !== "table") return

    const props = tableControl.properties || {}
    const numCols = Math.max(1, props.columns || 1)
    const numRows = Math.max(1, props.rows || 1)
    const columnOptionValues = Array.isArray(props.columnOptionValues) ? [...props.columnOptionValues] : []
    while (columnOptionValues.length < numCols) columnOptionValues.push("")
    if (toolType === "select" || toolType === "radio" || toolType === "checkbox") {
      columnOptionValues[colIdx] = "Option 1, Option 2"
    }

    // Per-cell types: only the dropped cell gets this control type (not the whole column)
    let cellTypes = Array.isArray(props.cellTypes) ? props.cellTypes.map(r => Array.isArray(r) ? [...r] : []) : []
    while (cellTypes.length <= rowIdx) cellTypes.push([])
    while (cellTypes[rowIdx].length <= colIdx) cellTypes[rowIdx].push("")
    cellTypes[rowIdx][colIdx] = toolType

    const updatedControls = section.controls.map(c =>
      c.id === tableId
        ? { ...c, properties: { ...props, cellTypes, columnOptionValues } }
        : c
    )
    updateSectionControls(section.id, updatedControls)
    const toolLabel = toolType.charAt(0).toUpperCase() + toolType.slice(1)
    toast({
      title: "Cell updated",
      description: `Row ${rowIdx + 1}, Column ${colIdx + 1} set to ${toolLabel}.`
    })
  }

  const addControlToSection = (sectionId, controlType, targetId) => {
    if (studyCompletionDesignerMode && !canAddControlsInStudyCompletionDesigner(studyCompletionDesignerMode, sections, sectionId)) {
      return
    }
    const section = sections.find(s => s.id === sectionId)
    if (!section) return

    const newControl = createControl(controlType)

    let insertIndex = 0
    const targetStr = targetId.toString()
    const dropParsed = parseDropzoneDroppableId(targetStr)
    if (dropParsed) {
      if (dropParsed.sectionId && dropParsed.sectionId !== sectionId) {
        return
      }
      insertIndex = dropParsed.index
    } else if (targetStr.startsWith("dropzone_")) {
      insertIndex = Number.parseInt(targetStr.replace("dropzone_", ""), 10)
      if (Number.isNaN(insertIndex)) insertIndex = 0
    } else {
      // Dropped on a control: id is control.id (e.g. ctrl_xxx), not control_xxx
      const targetControl = section.controls.find(c => c.id === targetId)
      if (targetControl) {
        insertIndex = section.controls.indexOf(targetControl) + 1
      }
    }

    const newControls = [...section.controls]
    newControls.splice(insertIndex, 0, newControl)
    updateSectionControls(sectionId, newControls)
  }

  const createControl = (type) => {
    const baseControl = {
      id: generateId(),
      type,
      label: `${type.charAt(0).toUpperCase() + type.slice(1)} Field`,
      controlSize: 6, // Default to 50% width (col-md-6)
      properties: getDefaultProperties(type)
    }
    return baseControl
  }

  const getDefaultProperties = (type) => {
    const defaults = {
      labelText: "",
      labelPosition: "left",
      required: false,
      readonly: false,
      placeholder: "",
      tooltip: "",
      defaultValue: "",
      genderSpecific: "both"
    }

    switch (type) {
      case "text":
        return { ...defaults, maxLength: 500, multiline: false }
      case "number":
        return { ...defaults, min: null, max: null, scale: 0 }
      case "date":
        return { ...defaults, randomizationScreening: "" }
      case "ukunkdate":
        return { ...defaults, randomizationScreening: "" }
      case "time":
        return { ...defaults }
      case "select":
        return { ...defaults, multiple: false, dataSource: "", csvValues: "" }
      case "radio":
      case "checkbox":
        return { ...defaults, alignment: "horizontal" }
      case "file":
        return { ...defaults, multiple: false }
      case "table":
        return {
          ...defaults,
          columns: 4,
          rows: 1,
          columnHeaders: ["Column 1", "Column 2", "Column 3", "Column 4"],
          columnTypes: ["text", "text", "text", "text"],
          cellTypes: [],
          columnOptionValues: [],
          columnDateRestrictions: [],
          columnTerminologyCoding: [],
          columnDateReferenceTypes: [],
          requiredColumn: null,
          requiredRow: null,
          requiredCells: [],
          addRow: false,
          maxRows: 10
        }
      default:
        return defaults
    }
  }

  const updateSectionControls = (sectionId, controls, saveHistory = true) => {
    setSections(prev => {
      const updated = prev.map(s =>
        s.id === sectionId ? { ...s, controls } : s
      )
      if (saveHistory) saveToHistory(updated)
      return updated
    })
  }

  const getControlClipboardKind = useCallback((control) => {
    const t = String(control?.type || "").toLowerCase().trim()
    if (!t) return ""
    if (t === "text" || t === "textarea" || t === "number" || t === "select" || t === "radio" || t === "checkbox" || t === "lab" || t === "time" || t === "table") return t
    if (t.includes("date")) return t === "ukunkdate" ? "ukunkdate" : "date"
    return ""
  }, [])

  const handleCopyControlValue = useCallback((control) => {
    const kind = getControlClipboardKind(control)
    if (!kind || !control) {
      toast({
        title: "Copy unavailable",
        description: "This control type is not supported.",
        variant: "destructive",
      })
      return
    }
    const payload = {
      control: JSON.parse(JSON.stringify(control)),
      sourceControlId: String(control?.id || ""),
      sourceLabel: String(control?.properties?.labelText || control?.label || "").trim() || "Field",
      copiedAt: Date.now(),
    }
    const clipboardText = JSON.stringify({
      evalusControlClipboard: true,
      label: payload.sourceLabel,
      copiedAt: payload.copiedAt,
    })
    const persistPayload = () => {
      if (typeof window === "undefined") return
      try {
        window.localStorage.setItem("crf-designer:controlClipboard:v1", JSON.stringify(payload))
      } catch {
        // Ignore storage write failures.
      }
    }
    // Persist immediately so rapid paste always gets latest copied field.
    persistPayload()
    setCopiedControlTemplate(payload)
    const fallbackCopy = () => {
      // Already persisted above; keep this path silent.
    }
    const legacyClipboardCopy = () => {
      if (typeof document === "undefined") return false
      try {
        const textarea = document.createElement("textarea")
        textarea.value = clipboardText
        textarea.setAttribute("readonly", "true")
        textarea.style.position = "fixed"
        textarea.style.opacity = "0"
        textarea.style.left = "-9999px"
        document.body.appendChild(textarea)
        textarea.select()
        textarea.setSelectionRange(0, textarea.value.length)
        const copied = Boolean(document.execCommand("copy"))
        document.body.removeChild(textarea)
        return copied
      } catch {
        return false
      }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(clipboardText)
        .then(() => {
          // Already persisted above; keep this path silent.
        })
        .catch(() => {
          fallbackCopy()
        })
      return
    }
    if (legacyClipboardCopy()) {
      return
    }
    fallbackCopy()
  }, [getControlClipboardKind, toast])

  const handlePasteCopiedControl = useCallback(() => {
    if (previewMode) return false
    let template = copiedControlTemplate
    if (typeof window !== "undefined") {
      let storageTemplate = null
      try {
        const raw = window.localStorage.getItem("crf-designer:controlClipboard:v1")
        storageTemplate = raw ? JSON.parse(raw) : null
      } catch {
        storageTemplate = null
      }
      // Prefer whichever payload is newer (fixes stale closure/state paste after rapid copy).
      if (storageTemplate?.control && template?.control) {
        template = (Number(storageTemplate.copiedAt || 0) >= Number(template.copiedAt || 0))
          ? storageTemplate
          : template
      } else if (storageTemplate?.control) {
        template = storageTemplate
      }
    }
    if (!template?.control) {
      toast({
        title: "Paste unavailable",
        description: "Copy a field first.",
        variant: "destructive",
      })
      return false
    }
    const sectionId = activeSection || sections[0]?.id
    const section = sections.find((s) => s.id === sectionId)
    if (!section) return false

    const base = JSON.parse(JSON.stringify(template.control))
    const pastedControl = {
      ...base,
      id: generateId(),
      label: `${base.label || base.properties?.labelText || "Field"} (Copy)`,
    }
    const newControls = [...(section.controls || []), pastedControl]
    updateSectionControls(section.id, newControls)
    setSelectedControl(pastedControl)
    return true
  }, [activeSection, copiedControlTemplate, previewMode, sections, toast, updateSectionControls])

  const handleControlClick = (control, event) => {
    // Table cell click: select that cell (row + column) so rules are per-cell, not per-column
    const isTableCellClick = control.type === "table" && event?.tableRowIndex != null && event?.tableColumnIndex != null
    if (isTableCellClick) {
      const section = sections.find(s => s.controls.some(c => c.id === control.id))
      if (section?.id) setActiveSection(section.id)
      const currentControl = section?.controls.find(c => c.id === control.id) || control
      setSelectedControl(currentControl)
      setSelectedTableRowForRules(event.tableRowIndex)
      setSelectedTableColumnForRules(event.tableColumnIndex)
      return
    }

    // Non-table: open rule modal when clicking on an input field
    const openRuleModal = event?.isInputClick &&
      control.type !== "label" &&
      control.type !== "hr"
    if (openRuleModal) {
      setRuleModalControl(control)
      setInitialTargetTableColumn(null)
      setSelectedRuleTemplateId(null)
      setShowRuleModal(true)
      return
    }

    // CRITICAL: Get the control from current sections state to ensure it has the latest rules
    // This ensures that when editing a CRF, the control has all its assigned rules
    const section = sections.find(s => s.controls.some(c => c.id === control.id))
    const currentControl = section?.controls.find(c => c.id === control.id) || control
    
    // Regular click - select control (use currentControl from sections to get rules)
    if (section?.id) {
      setActiveSection(section.id)
    }
    setSelectedControl(currentControl)
    if (currentControl?.type === "table") {
      setSelectedTableColumnForRules(null)
      setSelectedTableRowForRules(null)
    }
  }

  // Open rule modal for any control (create new rule). For table, only when a cell (row+col) is selected (via "+ Create" in Properties).
  const handleOpenRuleModal = (control, ruleTemplateId = null) => {
    if (!control || control.type === "label" || control.type === "hr") return
    if (control.type === "table") {
      if (selectedTableRowForRules == null || selectedTableColumnForRules == null) return
      setRuleModalControl(control)
      setInitialTargetTableRow(selectedTableRowForRules)
      setInitialTargetTableColumn(selectedTableColumnForRules)
      setEditingRule(null)
      setSelectedRuleTemplateId(ruleTemplateId || null)
      setShowRuleModal(true)
      return
    }
    setRuleModalControl(control)
    setEditingRule(null)
    setSelectedRuleTemplateId(ruleTemplateId || null)
    setShowRuleModal(true)
  }

  // Open rule modal to edit an existing assigned rule
  const handleEditRule = (rule) => {
    if (selectedControl && rule) {
      setRuleModalControl(selectedControl)
      setEditingRule(rule)
      setSelectedRuleTemplateId(null)
      setShowRuleModal(true)
    }
  }

  const handleRuleCreated = (ruleData, replacedRuleId = null) => {
    if (!ruleModalControl) return

    const section = sections.find(s => s.controls.some(c => c.id === ruleModalControl.id))
    if (!section) return

    const control = section.controls.find(c => c.id === ruleModalControl.id)
    if (!control) return

    const currentRules = control.properties?.rules || []
    // When editing: replace the old rule with the new one (old rule kept in engine for future use; only new rule assigned)
    const rulesWithoutReplaced = replacedRuleId
      ? currentRules.filter(r => r.id !== replacedRuleId)
      : currentRules
    const updatedRules = [...rulesWithoutReplaced, {
      id: ruleData.id,
      ruleName: ruleData.ruleName,
      ruleCategory: ruleData.ruleCategory,
      ruleExpression: ruleData.ruleExpression,
      message: ruleData.message,
      targetField: ruleData.targetField,
    }]

    // Update control with new rule
    handleControlUpdate(control.id, {
      properties: {
        ...control.properties,
        rules: updatedRules
      }
    })

    // Update selectedControl to show the new rule immediately
    // Get the updated control from sections after update
    const updatedControl = {
      ...control,
      properties: {
        ...control.properties,
        rules: updatedRules
      }
    }
    setSelectedControl(updatedControl)

    toast({
      title: "Rule Assigned",
      description: `Rule "${ruleData.ruleName}" has been assigned to ${control.label || control.properties?.labelText || "control"}`,
      variant: "success",
      className: "border-emerald-300 bg-gradient-to-br from-emerald-50 via-green-50 to-emerald-50 text-emerald-900 shadow-lg shadow-emerald-200/30",
    })
  }

  const handleRuleUpdated = (ruleData) => {
    if (!ruleModalControl) return

    const section = sections.find(s => s.controls.some(c => c.id === ruleModalControl.id))
    if (!section) return

    const control = section.controls.find(c => c.id === ruleModalControl.id)
    if (!control) return

    const currentRules = control.properties?.rules || []
    const updatedRules = currentRules.map(r => r.id === ruleData.id ? ruleData : r)

    handleControlUpdate(control.id, {
      properties: {
        ...control.properties,
        rules: updatedRules
      }
    })

    const updatedControl = {
      ...control,
      properties: {
        ...control.properties,
        rules: updatedRules
      }
    }
    setSelectedControl(updatedControl)
    setEditingRule(null)
  }

  // Get all controls from all sections for the rule modal and rules panel.
  // Expands table controls into virtual per-cell controls so table cells appear in "Available Fields" for rule expressions.
  const getAllControls = () => {
    const allControls = []
    sections.forEach(section => {
      if (section.controls && Array.isArray(section.controls)) {
        section.controls.forEach(control => {
          if (control.type === "table" && control.id) {
            const props = control.properties || {}
            const numRows = Math.max(1, props.rows || 1)
            const numCols = Math.max(1, props.columns || 1)
            const columnHeaders = Array.isArray(props.columnHeaders) ? props.columnHeaders : []
            const columnTypes = Array.isArray(props.columnTypes) ? props.columnTypes : []
            const cellTypes = Array.isArray(props.cellTypes) ? props.cellTypes : []
            const tableLabel = control.label || control.properties?.labelText || "Table"
            for (let r = 0; r < numRows; r++) {
              for (let c = 0; c < numCols; c++) {
                const cellType = (cellTypes[r] && cellTypes[r][c]) || columnTypes[c] || "text"
                const colHeader = (columnHeaders[c] != null && columnHeaders[c] !== "") ? columnHeaders[c] : `Column ${c + 1}`
                allControls.push({
                  id: `${control.id}_row_${r}_col_${c}`,
                  type: cellType,
                  label: `${tableLabel} - ${colHeader} (Row ${r + 1})`,
                  properties: { labelText: `${tableLabel} - ${colHeader} (Row ${r + 1})` },
                })
              }
            }
          } else {
            allControls.push(control)
          }
        })
      }
    })
    return allControls
  }

  // Handle rules panel changes
  const handleRulesChange = (newRules) => {
    setCrfRules(newRules)
    saveToHistory(sections, crfConfig, newRules)
  }

  const handleControlUpdate = (controlId, updates) => {
    const section = sections.find(s => s.controls.some(c => c.id === controlId))
    if (!section) return

    const nextProps = updates?.properties
    const wantsVisitDateIdentifier =
      nextProps &&
      Object.prototype.hasOwnProperty.call(nextProps, "isVisitDate") &&
      Boolean(nextProps.isVisitDate)
    if (wantsVisitDateIdentifier) {
      const conflicting = sections
        .flatMap((s) => s.controls || [])
        .find(
          (c) =>
            c.id !== controlId &&
            c.type === "date" &&
            Boolean(c?.properties?.isVisitDate),
        )
      if (conflicting) {
        toast({
          title: "Only one visit date allowed",
          description: `Visit date is already assigned to "${conflicting.label || conflicting.properties?.labelText || conflicting.id}".`,
          variant: "destructive",
        })
        return
      }
    }

    updateSectionControls(section.id, section.controls.map(c =>
      c.id === controlId ? { ...c, ...updates } : c
    ))

    if (selectedControl?.id === controlId) {
      setSelectedControl(prev => ({ ...prev, ...updates }))
    }
  }

  const handleTableColumnHeaderChange = (control, colIdx, newLabel) => {
    if (!control || control.type !== "table" || colIdx < 0) return
    const props = control.properties || {}
    const numCols = Math.max(1, props.columns || 1)
    const columnHeaders = Array.isArray(props.columnHeaders) ? [...props.columnHeaders] : []
    while (columnHeaders.length < numCols) columnHeaders.push("")
    columnHeaders[colIdx] = typeof newLabel === "string" ? newLabel : ""
    handleControlUpdate(control.id, {
      properties: { ...props, columnHeaders }
    })
  }

  const handleCellLabelChange = (control, rowIdx, colIdx, value) => {
    if (!control || control.type !== "table" || rowIdx < 0 || colIdx < 0) return
    const props = control.properties || {}
    const numRows = Math.max(1, props.rows || 1)
    const numCols = Math.max(1, props.columns || 1)
    let cellLabels = Array.isArray(props.cellLabels) ? props.cellLabels.map(r => Array.isArray(r) ? [...r] : []) : []
    while (cellLabels.length <= rowIdx) cellLabels.push([])
    while (cellLabels[rowIdx].length <= colIdx) cellLabels[rowIdx].push("")
    cellLabels[rowIdx][colIdx] = typeof value === "string" ? value : ""
    handleControlUpdate(control.id, {
      properties: { ...props, cellLabels }
    })
  }

  const handleControlDelete = async (controlId) => {
    const section = sections.find(s => s.controls.some(c => c.id === controlId))
    if (!section) return

    const control = section.controls.find(c => c.id === controlId)
    const controlLabel = control?.label || "Control"
    const parseRuleTargets = (rule) => {
      const ids = []
      if (Array.isArray(rule?.targetFields)) ids.push(...rule.targetFields.map(String))
      if (typeof rule?.targetField === "string") {
        if (rule.targetField.includes(",")) {
          ids.push(...rule.targetField.split(",").map((s) => s.trim()).filter(Boolean))
        } else if (rule.targetField.trim()) {
          ids.push(rule.targetField.trim())
        }
      }
      return [...new Set(ids)]
    }
    const isTargetingControl = (targetId) =>
      targetId === controlId || targetId.startsWith(`${controlId}_`)

    const dependentRules = []
    sections.forEach((sec) => {
      ;(sec.controls || []).forEach((ctrl) => {
        const rules = ctrl?.properties?.rules || []
        rules.forEach((rule) => {
          const targets = parseRuleTargets(rule)
          if (targets.some(isTargetingControl)) {
            dependentRules.push({
              ownerControlId: ctrl.id,
              ownerControlLabel: ctrl.label || ctrl.properties?.labelText || ctrl.id,
              rule,
            })
          }
        })
      })
    })

    const dependentRuleIds = [...new Set(dependentRules.map((r) => r.rule?.id).filter((id) => id !== undefined && id !== null))]
    if (dependentRuleIds.length > 0) {
      const allowDelete = window.confirm(
        `This field has ${dependentRuleIds.length} linked rule(s). Delete those rules first and then delete "${controlLabel}"?`
      )
      if (!allowDelete) return

      const studyIdForDelete = selectedStudy ? (selectedStudy.studyId || selectedStudy.id) : null
      if (studyIdForDelete) {
        const persistedRuleIds = dependentRuleIds.filter((id) => Number.isFinite(Number(id)))
        const deleteResults = await Promise.allSettled(
          persistedRuleIds.map((id) => crfRuleService.deleteCrfRule(id, studyIdForDelete))
        )
        const failedDeletes = deleteResults.filter(
          (r) => r.status === "rejected" || !r.value?.isSuccess
        )
        if (failedDeletes.length > 0) {
          toast({
            title: "Rule cleanup warning",
            description: `Failed to delete ${failedDeletes.length} linked rule(s) from server. Please retry after save.`,
            variant: "destructive",
          })
        }
      }
    }

    const cleanedSections = sections.map((sec) => ({
      ...sec,
      controls: (sec.controls || [])
        .filter((c) => c.id !== controlId)
        .map((c) => {
          const rules = c?.properties?.rules || []
          const filteredRules = rules.filter((rule) => {
            const targets = parseRuleTargets(rule)
            return !targets.some(isTargetingControl)
          })
          if (filteredRules.length === rules.length) return c
          return {
            ...c,
            properties: {
              ...(c.properties || {}),
              rules: filteredRules,
            },
          }
        }),
    }))
    setSections(cleanedSections)
    saveToHistory(cleanedSections)

    if (selectedControl?.id === controlId) {
      setSelectedControl(null)
    }

    toast({
      title: "Control Deleted",
      description: dependentRuleIds.length > 0
        ? `${controlLabel} has been deleted with ${dependentRuleIds.length} linked rule(s).`
        : `${controlLabel} has been deleted`
    })
  }

  const handleVisitChange = (value) => {
    const wasStudyCompletion = isStudyCompletionFormVisit(selectedVisit)
    const isStudyCompletion = isStudyCompletionFormVisit(value)
    setSelectedVisit(value)

    if (wasStudyCompletion === isStudyCompletion) return

    const normalized = normalizeCrfSections(sections)
    let nextSections
    if (isStudyCompletion) {
      nextSections = normalized.filter(isStudyCompletionStatusSection)
    } else {
      const standardOnly = normalized.filter((s) => !isStudyCompletionStatusSection(s))
      nextSections =
        standardOnly.length > 0
          ? standardOnly
          : normalizeCrfSections([
              createStandardSection({
                id: `section_${Date.now()}`,
                name: "Section 1",
                controls: [],
              }),
            ])
    }

    saveToHistory(nextSections)
    setSections(nextSections)
    setActiveSection((prevActive) => {
      if (nextSections.some((s) => s.id === prevActive)) return prevActive
      return nextSections[0]?.id || ""
    })
  }

  const handleAddStudyCompletionStatusSection = (statusCode) => {
    const code = Number(statusCode)
    if (!Number.isFinite(code)) return

    const existing = findStudyCompletionSectionByStatusCode(sections, code)
    if (existing) {
      setActiveSection(existing.id)
      toast({
        title: "Status block exists",
        description: `${getStudyCompletionStatusLabel(code)} is already in the form below — switched to that block.`,
      })
      return
    }

    const newSection = createStudyCompletionStatusSection({ statusCode: code })
    setSections((prev) => {
      const statusOnly = normalizeCrfSections(prev).filter(isStudyCompletionStatusSection)
      const updated = [...statusOnly, newSection]
      saveToHistory(updated)
      return updated
    })
    setActiveSection(newSection.id)
    toast({
      title: "Status block added",
      description: `Now drag fields from the left into the ${getStudyCompletionStatusLabel(code)} block below.`,
    })
  }

  const handleAddSection = () => {
    if (studyCompletionDesignerMode) {
      toast({
        title: "Use status blocks",
        description:
          "Study Completion Form uses patient status blocks. Choose a status above, then add fields inside that block.",
        variant: "destructive",
      })
      return
    }
    const newSection = createStandardSection({
      id: `section_${Date.now()}`,
      name: `Section ${sections.length + 1}`,
      controls: [],
    })
    setSections((prev) => {
      const updated = [...prev, newSection]
      saveToHistory(updated)
      return updated
    })
    setActiveSection(newSection.id)
    toast({
      title: "Section Added",
      description: "New section has been added",
    })
  }

  const handleAddLabSection = () => {
    if (studyCompletionDesignerMode) {
      toast({
        title: "Not available",
        description: "Laboratory sections are not used for Study Completion Form.",
        variant: "destructive",
      })
      return
    }
    const labOrdinal = sections.filter((s) => normalizeCrfSection(s).sectionType === "lab").length + 1
    const newSection = createLabSection({
      id: `section_${Date.now()}`,
      name: `Laboratory (${labOrdinal})`,
      controls: [],
    })
    setSections((prev) => {
      const updated = [...prev, newSection]
      saveToHistory(updated)
      return updated
    })
    setActiveSection(newSection.id)
    toast({
      title: "Laboratory Section Added",
      description: "Add fields as usual. The lab facility is selected during eCRF data entry.",
    })
  }

  const handleSectionRename = (sectionId, newName) => {
    if (!newName || newName.trim() === "") {
      toast({
        title: "Invalid Name",
        description: "Section name cannot be empty",
        variant: "destructive"
      })
      return
    }
    const target = sections.find((s) => s.id === sectionId)
    if (target && isStudyCompletionStatusSection(target)) {
      toast({
        title: "Name locked",
        description: "Study Completion status block names follow the selected patient status.",
        variant: "destructive",
      })
      return
    }
    setSections(prev => {
      const updated = prev.map(s =>
        s.id === sectionId ? { ...s, name: newName.trim() } : s
      )
      saveToHistory(updated)
      return updated
    })
  }

  const handleDeleteSection = (sectionId) => {
    if (!studyCompletionDesignerMode && sections.length <= 1) {
      toast({
        title: "Cannot Delete",
        description: "Cannot delete the last section",
        variant: "destructive"
      })
      return
    }

    const section = sections.find(s => s.id === sectionId)
    const sectionName = section?.name || "Section"

    setSections(prev => {
      const updated = prev.filter(s => s.id !== sectionId)
      saveToHistory(updated)
      return updated
    })

    if (activeSection === sectionId) {
      const remainingSections = sections.filter(s => s.id !== sectionId)
      setActiveSection(remainingSections[0]?.id || "")
    }

    toast({
      title: "Section Deleted",
      description: `${sectionName} has been deleted`
    })
  }

  const resolveCdashFieldLabel = useCallback(
    (fieldInstanceId) => {
      const control = findDesignerControlByFieldId(sections, fieldInstanceId)
      if (control) return resolveDesignerControlLabel(control)
      return String(fieldInstanceId ?? "").trim() || "Field"
    },
    [sections],
  )

  const handleSave = async () => {
    // Validation
    if (!selectedStudy) {
      const errorMsg = "Please select a Study"
      toast({
        title: "Validation Error",
        description: errorMsg,
        variant: "destructive",
      })
      throw new Error(errorMsg)
    }

    if (!selectedVisit || selectedVisit.trim() === "") {
      const errorMsg = "Please select a Visit"
      toast({
        title: "Validation Error",
        description: errorMsg,
        variant: "destructive",
      })
      throw new Error(errorMsg)
    }

    if (!crfConfig.name || crfConfig.name.trim() === "") {
      const errorMsg = "Please enter CRF Name"
      toast({
        title: "Validation Error",
        description: errorMsg,
        variant: "destructive",
      })
      throw new Error(errorMsg)
    }

    // Global guard: at most one date field can be marked as Visit Date Identifier.
    const visitDateTaggedControls = sections
      .flatMap((s) => s.controls || [])
      .filter(
        (c) =>
          c.type === "date" &&
          Boolean(c?.properties?.isVisitDate),
      )
    if (visitDateTaggedControls.length > 1) {
      const names = visitDateTaggedControls
        .slice(0, 3)
        .map((c) => c.label || c.properties?.labelText || c.id)
        .join(", ")
      const overflow = visitDateTaggedControls.length > 3 ? ` +${visitDateTaggedControls.length - 3} more` : ""
      const errorMsg = `Only one date field can be marked as Visit Date Identifier. Found: ${names}${overflow}`
      toast({
        title: "Validation Error",
        description: errorMsg,
        variant: "destructive",
      })
      throw new Error(errorMsg)
    }

    if (studyCompletionDesignerMode) {
      const scValidation = validateStudyCompletionDesignerSections(sections)
      if (!scValidation.ok) {
        const errorMsg = scValidation.message || "Invalid Study Completion Form layout."
        toast({
          title: "Validation Error",
          description: errorMsg,
          variant: "destructive",
        })
        throw new Error(errorMsg)
      }
    }

    setIsSaving(true)
    try {
      // Prepare CRF structure data (sections, controls, rules)
      const crfStructure = {
        id: currentCrfId || initialCRF?.id || null,
        config: crfConfig,
        sections: sections.map((s) => {
          const ns = normalizeCrfSection(s)
          const controls = (s.controls || []).map((c) => ({
            id: c.id,
            type: c.type,
            label: c.label,
            controlSize: c.controlSize,
            properties: {
              ...c.properties,
              rules: c.properties?.rules || [],
            },
          }))
          if (ns.sectionType === "lab") {
            return {
              id: ns.id,
              name: ns.name,
              sectionType: "lab",
              labBinding: {
                labFacilityId: ns.labBinding?.labFacilityId ?? null,
                labFacilityLabel: ns.labBinding?.labFacilityLabel ?? "",
              },
              controls,
            }
          }
          if (ns.sectionType === SECTION_TYPE_STUDY_COMPLETION_STATUS) {
            return serializeStudyCompletionSectionForPayload({ ...ns, controls })
          }
          return {
            id: ns.id,
            name: ns.name,
            sectionType: "standard",
            controls,
          }
        }),
        rules: crfRules || [],
        complexRules: [],
        createdAt: initialCRF?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      // Transform to C# API format
      const studyId = selectedStudy.studyId || selectedStudy.id
      
      // Generate HTML content from CRF structure
      const htmlContent = generateHtmlContent(crfStructure)

      // Sections with full control properties (postfix, prefix, cellLabels, etc.) so backend
      // can store them field-wise and return in getCrfDesignById for eCRF data entry.
      const sectionsForPayload = crfStructure.sections.map((s) => {
        const base = {
          id: s.id,
          name: s.name,
          controls: s.controls.map((c) => ({
            id: c.id,
            type: c.type,
            label: c.label,
            controlSize: c.controlSize,
            properties: { ...c.properties },
          })),
        }
        if (s.sectionType === "lab" && s.labBinding) {
          return {
            ...base,
            sectionType: "lab",
            labBinding: {
              labFacilityId: s.labBinding.labFacilityId ?? null,
              labFacilityLabel: s.labBinding.labFacilityLabel ?? "",
            },
          }
        }
        if (s.sectionType === SECTION_TYPE_STUDY_COMPLETION_STATUS) {
          return {
            ...base,
            sectionType: SECTION_TYPE_STUDY_COMPLETION_STATUS,
            studyCompletionStatus: s.studyCompletionStatus,
          }
        }
        return base
      })

      // Helpful debug: see postfix/prefix for key fields (e.g. Age) at save time
      const debugPostfixControls = sectionsForPayload
        .flatMap(s => s.controls)
        .filter(c => c.properties?.postfix || c.properties?.prefix)
      console.log("CRF Save - controls with prefix/postfix:", debugPostfixControls)
      
      const requestPayload = {
        studyId: studyId,
        name: crfConfig.name,
        description: crfConfig.description || "",
        htmlContent: htmlContent, // Actual HTML content instead of JSON
        sections: sectionsForPayload, // Field-wise structure for DB; ensures postfix etc. in data entry
        remarks: crfConfig.remarks || "",
        isFinalPrint:
          crfConfig.isFinalPrint === "Y" ||
          crfConfig.isFinalPrint === "Yes" ||
          crfConfig.isFinalPrint === true,
        isScreenFailedCrf: Boolean(crfConfig.isScreenFailedCrf),
        isRandomizedEnrolledCrf: Boolean(crfConfig.isRandomizedEnrolledCrf),
        isStratificationCrf: Boolean(crfConfig.isStratificationCrf),
        status: "Draft",
        crfFormType: getCrfFormTypeEnum(selectedVisit), // Map visit name to enum value (1=Screening, 2=Baseline, 3=Visits)
      }

      if (cdashMappingsDirtyRef.current) {
        const cdashDuplicateError = validateCdashMappingsUniquePerCrf(
          cdashMappings,
          resolveCdashFieldLabel,
        )
        if (cdashDuplicateError) {
          toast({
            title: "CDASH mapping conflict",
            description: cdashDuplicateError,
            variant: "destructive",
          })
          setIsSaving(false)
          return null
        }
        requestPayload.cdashMappings = buildCdashMappingsSavePayload(cdashMappings)
      }

      // Log the payload (for debugging)
      console.log("CRF Design Request Payload:", requestPayload)

      let response
      // Use currentCrfId if available, otherwise fallback to initialCRF?.id
      const crfIdToUse = currentCrfId || initialCRF?.id
      if (crfIdToUse) {
        // Update existing CRF Design
        response = await crfDesignService.updateCrfDesign(crfIdToUse, requestPayload)
      } else {
        // Create new CRF Design directly - backend will handle duplicate errors
        response = await crfDesignService.createCrfDesign(requestPayload)
        
        // NOTE: Removed GetCrfDesignsList call to avoid unnecessary API calls during rule assignment
        // If create fails with duplicate error, show error message instead of searching
        // User should save CRF manually first before assigning rules
        if (!response.isSuccess && response.message && response.message.includes("already exists")) {
          console.log("Create failed due to duplicate - user should save CRF manually first")
          // Don't call GetCrfDesignsList - just return the error
          // This prevents unnecessary API calls when assigning rules
        }
      }

      if (response.isSuccess) {
          cdashMappingsDirtyRef.current = false
          // Update currentCrfId state if we created a new CRF or got an ID
          if (response.data?.id) {
            setCurrentCrfId(response.data.id)
            console.log("CRF ID updated in state:", response.data.id)
          }
          
          toast({
            title: "Success",
            description: currentCrfId || initialCRF?.id ? "CRF Design updated successfully!" : "CRF Design created successfully!",
            variant: "success",
            duration: 10000 // Keep visible longer for user confirmation
          })
          if (onSave) onSave()
          // Return the saved CRF data with ID
          return response.data
        } else {
        // Show backend error message directly
        const errorMessage = response.message || "Failed to save CRF Design"
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        })
        // Don't throw error here to prevent duplicate toast messages
        return null
      }
    } catch (error) {
      console.error("Error saving CRF Design:", error)
      // Show error message for network errors or other exceptions
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred while saving CRF Design",
        variant: "destructive",
      })
      return null
    } finally {
      setIsSaving(false)
    }
  }

  const handleSubmit = async () => {
    // Validation
    if (!crfConfig.name || crfConfig.name.trim() === "") {
      toast({
        title: "Validation Error",
        description: "Please enter CRF Name",
        variant: "destructive",
      })
      return
    }

    if (!selectedStudy) {
      toast({
        title: "Validation Error",
        description: "Please select a Study",
        variant: "destructive",
      })
      return
    }

    if (!selectedVisit || selectedVisit.trim() === "") {
      toast({
        title: "Validation Error",
        description: "Please select a Visit",
        variant: "destructive",
      })
      return
    }

    // First save (this includes all rules in the payload)
    let savedCrfId = null
    try {
      const savedCrf = await handleSave()
      if (!savedCrf || !savedCrf.id) {
        toast({
          title: "Error",
          description: "CRF Design must be saved before submitting",
          variant: "destructive"
        })
        return
      }
      savedCrfId = savedCrf.id
    } catch (error) {
      console.error("Error in handleSave:", error)
      // Error is already handled in handleSave, so we just return here
      return
    }

    // Then update status to finalize/submit
    // Use savedCrfId from handleSave() or fallback to currentCrfId or initialCRF?.id
    const crfIdToSubmit = savedCrfId || currentCrfId || initialCRF?.id
    if (!crfIdToSubmit) {
      toast({
        title: "Error",
        description: "CRF Design must be saved before submitting",
        variant: "destructive",
      })
      return
    }

    try {
      // Update status to finalize (set IsFinalPrint to true)
      const statusRequest = {
        IsActive: true,
        IsFinalPrint: true
      }
      const response = await crfDesignService.updateCrfDesignStatus(crfIdToSubmit, statusRequest)

      if (response.isSuccess) {
        toast({
          title: "Success",
          description: "CRF Design submitted successfully!",
          variant: "success",
          duration: 10000 // Keep visible longer for user confirmation
        })
        if (onSave) onSave()
      } else {
        throw new Error(response.message || "Failed to submit CRF Design")
      }
    } catch (error) {
      console.error("Error submitting CRF Design:", error)
      toast({
        title: "Error",
        description: "Error submitting CRF Design: " + (error.message || "Unknown error"),
        variant: "destructive",
      })
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger shortcuts when typing in inputs
      const isTypingTarget = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable

      // Ctrl+Shift+V (or Cmd+Shift+V) should paste copied field even when focus is inside inputs.
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "v" && !previewMode) {
        e.preventDefault()
        handlePasteCopiedControl()
        return
      }

      if (isTypingTarget) return

      // Ctrl+S or Cmd+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault()
        handleSave()
        return
      }
      // Delete key to delete selected control
      if (e.key === "Delete" && selectedControl && !previewMode) {
        handleControlDelete(selectedControl.id)
        return
      }
      // Ctrl+Z or Cmd+Z to undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
        return
      }
      // Ctrl+Shift+Z or Cmd+Shift+Z to redo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault()
        handleRedo()
        return
      }
      // Ctrl+D or Cmd+D to duplicate
      if ((e.ctrlKey || e.metaKey) && e.key === "d" && selectedControl && !previewMode) {
        e.preventDefault()
        handleDuplicateControl(selectedControl.id)
        return
      }
      // Ctrl+V or Cmd+V to paste copied field
      if ((e.ctrlKey || e.metaKey) && e.key === "v" && !previewMode) {
        e.preventDefault()
        handlePasteCopiedControl()
        return
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedControl, previewMode, handlePasteCopiedControl])

  if (!dndReady) {
    return <CrfDesignerDndSkeleton />
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      autoScroll={{ threshold: { x: 0, y: 0.2 } }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full min-h-0 w-full min-w-0 flex-col bg-slate-50 lg:flex-row">
        {/* Tools Panel - static, fixed left; only inner list scrolls */}
        {!previewMode && (
          <div className="flex w-full shrink-0 flex-col overflow-hidden border-b border-slate-200 bg-white min-h-0 max-h-44 lg:max-h-none lg:h-full lg:w-44 lg:border-b-0 lg:border-r xl:w-48">
            <ToolsPanel disabled={!isConfigValid || !designerControlsDropEnabled} />
          </div>
        )}

        {/* Main Canvas Area - only this center column scrolls (canvas section) */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {/* CRF Configuration - separate section, always shown in design mode */}
          {!previewMode && (
            <section className="bg-slate-50/80 border-b border-slate-200" aria-label="CRF Configuration">
              <div className="bg-white border-b border-slate-200">
                <CRFConfiguration
                config={crfConfig}
                onChange={setCrfConfig}
                isOpen={showConfigPanel}
                onToggle={() => setShowConfigPanel(!showConfigPanel)}
                actionButtons={
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button
                      onClick={handleUndo}
                      variant="outline"
                      size="sm"
                      disabled={historyIndex <= 0}
                      title="Undo (Ctrl+Z)"
                      className="h-7 px-2 flex-shrink-0"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      onClick={handleRedo}
                      variant="outline"
                      size="sm"
                      disabled={historyIndex >= history.length - 1}
                      title="Redo (Ctrl+Shift+Z)"
                      className="h-7 px-2 flex-shrink-0"
                    >
                      <Redo2 className="w-3.5 h-3.5" />
                    </Button>
                    <div className="w-px h-5 bg-slate-300 mx-0.5 flex-shrink-0" />
                    <Button
                      onClick={openExportDialog}
                      variant="outline"
                      size="sm"
                      title="Export CRF to JSON (optional rules for UAT → PROD)"
                      className="h-7 px-2 flex-shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      onClick={handleImport}
                      variant="outline"
                      size="sm"
                      title="Import CRF from JSON"
                      className="h-7 px-2 flex-shrink-0"
                    >
                      <Upload className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      onClick={() => setPreviewMode(!previewMode)}
                      variant="outline"
                      size="sm"
                      className="h-7 px-3 text-xs flex-shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1.5" />
                      Preview
                    </Button>
                    <div className="w-px h-5 bg-slate-300 mx-0.5 flex-shrink-0" />
                    <Button 
                      onClick={handleSave} 
                      size="sm" 
                      disabled={isSaving} 
                      variant="outline"
                      className="h-8 px-4 text-sm font-medium border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400 flex-shrink-0 transition-all"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          Save
                        </>
                      )}
                    </Button>
                    <Button 
                      onClick={handleSubmit} 
                      size="sm" 
                      disabled={isSaving} 
                      className="h-8 px-5 text-sm font-semibold bg-gradient-to-r btn-brand-gradient  text-white shadow-md hover:shadow-lg flex-shrink-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Submit
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => {
                        const clear = () => {
                          const fresh = normalizeCrfSections([
                            { id: "section_1", name: "Section 1", controls: [] },
                          ])
                          setSections(fresh)
                          setActiveSection("section_1")
                          setSelectedControl(null)
                          setCrfRules([])
                          saveToHistory(fresh, crfConfig, [])
                          toast({
                            title: "Cleared",
                            description: "All sections, controls, and rules have been cleared",
                          })
                        }
                        clear()
                      }}
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 flex-shrink-0"
                      title="Clear all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                }
              />
              </div>
              {/* Study and Visit (same section as CRF Configuration) */}
              <div className="bg-white border-b border-slate-200 relative z-10">
                <div className="flex items-center gap-4 px-4 py-3 border-b border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-2 flex-1">
                  <Label className="text-sm font-semibold text-slate-700 whitespace-nowrap">Study <span className="text-red-500">*</span>:</Label>
                  <Select
                    value={selectedStudy ? (selectedStudy.studyId || selectedStudy.id || "").toString() : ""}
                    onValueChange={(value) => {
                      const study = availableStudies.find(s => (s.studyId || s.id || "").toString() === value)
                      setSelectedStudy(study || null)
                      setSelectedVisit("") // Reset visit when study changes
                      setStudySearch("")
                    }}
                    disabled={loadingStudies}
                  >
                    <SelectTrigger className="w-[250px] h-8 text-xs">
                      <SelectValue placeholder={loadingStudies ? "Loading..." : "Select Study"} />
                    </SelectTrigger>
                    <SelectContent className="!bg-white opacity-100 border-slate-200 shadow-lg p-0">
                      <div className="p-2 border-b border-slate-200 sticky top-0 bg-white z-10">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          <Input
                            type="text"
                            placeholder="Search studies..."
                            value={studySearch}
                            onChange={(e) => setStudySearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            className="h-8 pl-8 text-xs border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                          />
                        </div>
                      </div>
                      <div className="max-h-[280px] overflow-y-auto py-1">
                        {filteredStudies.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-slate-500">No studies match your search.</p>
                        ) : (
                          filteredStudies.map((study) => {
                            const studyId = (study.studyId || study.id || "").toString()
                            return (
                              <SelectItem
                                key={studyId}
                                value={studyId}
                                className="hover:bg-emerald-50 focus:bg-emerald-50 text-xs"
                              >
                                {getStudyDisplayName(study)}
                              </SelectItem>
                            )
                          })
                        )}
                      </div>
                    </SelectContent>
                  </Select>
                  </div>

                  {selectedStudy && (
                    <div className="flex items-center gap-2 flex-1">
                      <Label className="text-sm font-semibold text-slate-700 whitespace-nowrap">Visit <span className="text-red-500">*</span>:</Label>
                      <Select
                        value={selectedVisit}
                        onValueChange={handleVisitChange}
                        disabled={!selectedStudy}
                      >
                        <SelectTrigger className="w-[250px] h-8 text-xs">
                          <SelectValue placeholder="Select Visit" />
                        </SelectTrigger>
                        <SelectContent className="!bg-white opacity-100 border-slate-200 shadow-lg">
                          {visitOptions.map((visit) => (
                            <SelectItem key={visit} value={visit} className="hover:bg-emerald-50 focus:bg-emerald-50">
                              {visit}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Action Buttons for Preview Mode */}
          {previewMode && (
            <div className="bg-white border-b border-slate-200 px-4 py-2 flex gap-2">
              <Button
                onClick={() => setPreviewMode(false)}
                variant="default"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Eye className="w-4 h-4 mr-2" />
                Exit Preview
              </Button>
            </div>
          )}

          {/* Designer Canvas or Preview - only this section scrolls */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-x-none">
            {previewMode ? (
              <CRFViewer
                crfData={{
                  config: crfConfig,
                  sections: sections,
                  rules: crfRules // Pass rules to viewer for evaluation
                }}
                onEdit={null}
                isPreviewMode={true}
              />
            ) : (
              <div className="p-4">
                {studyCompletionDesignerMode ? (
                  <StudyCompletionDesignerPanel
                    sections={sections}
                    activeSection={activeSection}
                    configReady={isConfigValid}
                    onAddStatusSection={handleAddStudyCompletionStatusSection}
                    onActivateSection={setActiveSection}
                  />
                ) : null}
                <DesignerCanvas
                  sections={sections}
                  activeSection={activeSection}
                  onSectionChange={setActiveSection}
                  onSectionAdd={handleAddSection}
                  onSectionAddLab={handleAddLabSection}
                  onSectionDelete={handleDeleteSection}
                  onSectionRename={handleSectionRename}
                  onControlClick={handleControlClick}
                  onControlDoubleClick={handleOpenRuleModal}
                  onControlUpdate={handleControlUpdate}
                  onControlDelete={handleControlDelete}
                  onControlDuplicate={handleDuplicateControl}
                  onCopyControlValue={handleCopyControlValue}
                  onTableColumnHeaderChange={handleTableColumnHeaderChange}
                  onCellLabelChange={handleCellLabelChange}
                  selectedControl={selectedControl}
                  isConfigValid={isConfigValid}
                  studyCompletionMode={studyCompletionDesignerMode}
                  controlsDropEnabled={designerControlsDropEnabled}
                  isCdashEnabled={isCdashEnabledForStudy}
                  cdashMappings={cdashMappings}
                />
              </div>
            )}
          </div>
        </div>

        {/* Properties Panel - static, fixed right; only inner content scrolls */}
        {!previewMode && !showRuleModal && (
          <div className="flex w-full shrink-0 flex-col overflow-hidden border-t border-slate-200 bg-white min-h-0 max-h-[38vh] lg:h-full lg:max-h-none lg:w-56 lg:border-l lg:border-t-0 xl:w-64">
            <PropertiesPanel
              control={selectedControl}
              parentLabSection={parentLabSectionForSelection}
              selectedTableColumnForRules={selectedTableColumnForRules}
              selectedTableRowForRules={selectedTableRowForRules}
              allControls={getAllControls()}
              onUpdate={handleControlUpdate}
              onClose={undefined}
              onOpenRuleModal={handleOpenRuleModal}
              onEditRule={handleEditRule}
              crfId={currentCrfId || initialCRF?.id || null}
              studyId={selectedStudy ? (selectedStudy.studyId || selectedStudy.id) : null}
              isCdashEnabled={isCdashEnabledForStudy}
              cdashMappings={cdashMappings}
              onCdashMappingsChange={setCdashMappings}
              onCdashMappingsDirty={() => {
                cdashMappingsDirtyRef.current = true
              }}
              getCdashFieldLabel={resolveCdashFieldLabel}
              onSaveCrf={async () => {
                // Auto-save CRF if it doesn't have an ID
                // Check if required fields are present before attempting save
                if (!selectedStudy) {
                  console.warn("Cannot auto-save: Study not selected")
                  return null
                }
                if (!selectedVisit || selectedVisit.trim() === "") {
                  console.warn("Cannot auto-save: Visit not selected")
                  return null
                }
                if (!crfConfig.name || crfConfig.name.trim() === "") {
                  console.warn("Cannot auto-save: CRF Name not provided")
                  return null
                }
                try {
                  const savedCrf = await handleSave()
                  // Update currentCrfId state if we got a new ID
                  if (savedCrf?.id) {
                    setCurrentCrfId(savedCrf.id)
                    console.log("CRF auto-saved, ID updated in state:", savedCrf.id)
                  }
                  return savedCrf?.id || null
                } catch (error) {
                  console.error("Error auto-saving CRF:", error)
                  return null
                }
              }}
            />
          </div>
        )}

        {/* Drag Overlay */}
        <DragOverlay>
          {activeId && typeof activeId === 'string' && activeId.startsWith('tool_') ? (
            <div className="bg-white border-2 border-emerald-500 rounded-lg p-3 shadow-lg">
              {activeId.replace('tool_', '').toUpperCase()}
            </div>
          ) : null}
        </DragOverlay>
      </div>

      {/* Rule Creation Modal */}
      <RuleCreationModal
        open={showRuleModal}
        onClose={() => {
          setShowRuleModal(false)
          setRuleModalControl(null)
          setEditingRule(null)
          setSelectedRuleTemplateId(null)
          setInitialTargetTableColumn(null)
          setInitialTargetTableRow(null)
        }}
        control={ruleModalControl}
        initialTargetTableRow={initialTargetTableRow}
        initialTargetTableColumn={initialTargetTableColumn}
        editingRule={editingRule}
        allControls={getAllControls()}
        onRuleCreated={handleRuleCreated}
        onRuleUpdated={handleRuleUpdated}
        crfId={currentCrfId || initialCRF?.id || null}
        studyId={selectedStudy ? (selectedStudy.studyId || selectedStudy.id) : null}
        ruleEngineTemplateId={selectedRuleTemplateId}
        onSaveCrf={async () => {
          // Auto-save CRF if it doesn't have an ID
          // Check if required fields are present before attempting save
          if (!selectedStudy) {
            console.warn("Cannot auto-save: Study not selected")
            return null
          }
          if (!selectedVisit || selectedVisit.trim() === "") {
            console.warn("Cannot auto-save: Visit not selected")
            return null
          }
          if (!crfConfig.name || crfConfig.name.trim() === "") {
            console.warn("Cannot auto-save: CRF Name not provided")
            return null
          }
          
          try {
            const savedCrf = await handleSave()
            // Update currentCrfId state if we got a new ID
            if (savedCrf?.id) {
              setCurrentCrfId(savedCrf.id)
              console.log("CRF auto-saved, ID updated in state:", savedCrf.id)
            }
            return savedCrf?.id || null
          } catch (error) {
            console.error("Error auto-saving CRF:", error)
            return null
          }
        }}
      />

      <CrfDesignerTransferDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        mode="export"
        includeRules={transferIncludeRules}
        onIncludeRulesChange={setTransferIncludeRules}
        ruleCount={transferRuleCount}
        onConfirm={handleExportConfirm}
        loading={transferLoading}
      />

      <CrfDesignerTransferDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        mode="import"
        includeRules={transferIncludeRules}
        onIncludeRulesChange={setTransferIncludeRules}
        ruleCount={transferRuleCount}
        importMethod={transferImportMethod}
        onImportMethodChange={setTransferImportMethod}
        canImportToStudy={Boolean(selectedStudy?.studyId || selectedStudy?.id)}
        onConfirm={handleImportConfirm}
        loading={transferLoading}
      />
    </DndContext>
  )
}

export default CRFDesigner

