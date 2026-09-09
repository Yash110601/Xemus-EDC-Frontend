"use client"

import { useDroppable } from "@dnd-kit/core"
import { SortableContext, useSortable, rectSortingStrategy, horizontalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  Plus,
  X,
  GripVertical,
  Copy,
  CopyPlus,
  Edit2,
  Check,
  FlaskConical,
  ChevronDown,
  LayoutGrid,
  Clipboard,
  ClipboardCheck,
  Link2,
} from "lucide-react"
import ControlRenderer from "./ControlRenderer"
import { useState } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CrfLabSectionTabAffix } from "./CrfLabSectionBanner"
import { CrfStudyCompletionSectionCanvasBanner, CrfStudyCompletionSectionTabAffix } from "./CrfStudyCompletionSectionAffix"
import {
  SECTION_TYPE_LAB,
  SECTION_TYPE_STUDY_COMPLETION_STATUS,
  normalizeCrfSection,
} from "@/lib/utils/crfLabSection"
import { isStudyCompletionStatusSection } from "@/lib/crfDesigner/studyCompletionFormDesigner"
import { buildDropzoneDroppableId } from "@/lib/crfDesigner/designerDropzone"
import { getCdashBadgeForControl, isControlMappableForCdash } from "@/lib/utils/cdashMappings"

/** Must match prefix checked in CRFDesigner.handleDragEnd for section-tab reorder. */
export const SECTION_TAB_SORTABLE_ID_PREFIX = "section_tab:"

const VALID_CONTROL_SIZES = [2, 4, 6, 8, 10, 12]

function normalizeControlSize(size) {
  const parsed = Number(size)
  if (!Number.isFinite(parsed)) return 12
  if (VALID_CONTROL_SIZES.includes(parsed)) return parsed
  return VALID_CONTROL_SIZES.reduce((best, candidate) =>
    Math.abs(candidate - parsed) < Math.abs(best - parsed) ? candidate : best
  )
}

function getControlColSpanClass(controlSize) {
  const normalized = normalizeControlSize(controlSize)
  const classMap = {
    2: "col-span-2",
    4: "col-span-4",
    6: "col-span-6",
    8: "col-span-8",
    10: "col-span-10",
    12: "col-span-12",
  }
  return classMap[normalized] || "col-span-12"
}

/** Columns free on the last grid row after laying out controls (for inline drop target). */
function getTrailingGridSpan(controls) {
  if (!controls?.length) return 12
  let rowUsed = 0
  for (const control of controls) {
    const span = normalizeControlSize(control?.controlSize)
    if (rowUsed > 0 && rowUsed + span > 12) rowUsed = 0
    rowUsed += span
    if (rowUsed >= 12) rowUsed = rowUsed % 12
  }
  return rowUsed === 0 ? 12 : 12 - rowUsed
}

const DropZone = ({ id, sectionId, children, disabled = false, studyCompletionLook = false, compact = false }) => {
  const slotIndex = Number(id) || 0
  const droppableId = buildDropzoneDroppableId(sectionId, slotIndex)
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: { sectionId, type: "dropzone", slotIndex },
    disabled: disabled,
  })

  const shellClass = studyCompletionLook
    ? disabled
      ? "border-teal-200/80 bg-teal-50/25 border-dashed"
      : isOver
        ? "border-teal-500 bg-teal-50/70 border-dashed ring-1 ring-teal-300/50"
        : "border-teal-300/90 bg-teal-50/40 border-dashed"
    : disabled
      ? "border-amber-300 bg-amber-50/50"
      : isOver
        ? "border-emerald-500 bg-emerald-50"
        : "border-slate-300 border-transparent"

  return (
    <div
      ref={setNodeRef}
      className={`${compact ? "min-h-10" : "min-h-20"} border-2 rounded-lg p-2 transition-colors ${shellClass}`}
    >
      {children}
    </div>
  )
}

const StudyCompletionDropHint = ({ isActive, isConfigValid, sectionName, onActivate }) => {
  if (!isConfigValid) {
    return (
      <p className="py-8 text-center text-sm text-amber-800">
        Complete CRF configuration (Name, Study, Visit) first
      </p>
    )
  }
  return (
    <div
      className={`py-8 text-center ${!isActive ? "cursor-pointer" : ""}`}
      onClick={
        !isActive
          ? (e) => {
              e.stopPropagation()
              onActivate?.()
            }
          : undefined
      }
      onKeyDown={
        !isActive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onActivate?.()
              }
            }
          : undefined
      }
      role={!isActive ? "button" : undefined}
      tabIndex={!isActive ? 0 : undefined}
    >
      <p className={`text-sm ${isActive ? "font-medium text-teal-800" : "text-slate-600"}`}>
        Drop control here
      </p>
      {isActive ? (
        <p className="mt-1 text-xs text-slate-500">Drag tools from the left into this sub-section</p>
      ) : (
        <p className="mt-1 text-xs text-teal-700">Click here to activate · {sectionName}</p>
      )}
    </div>
  )
}

async function copyDesignerText(text, evt) {
  if (evt) {
    evt.stopPropagation()
    evt.preventDefault()
  }
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* ignore */
  }
}

const SortableControl = ({
  control,
  sectionId,
  sectionName = "",
  showFieldSectionLabel = false,
  onClick,
  onDoubleClick,
  onDelete,
  onDuplicate,
  onTableColumnHeaderChange,
  onCellLabelChange,
  onCopyControlValue,
  selectedControl,
  isCdashEnabled = false,
  cdashMappings = [],
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: control.id,
    data: { control, sectionId, type: "control" }
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const isSelected = selectedControl?.id === control.id
  const isCopySupported = !["label", "hr", "divider", "file"].includes(String(control?.type || "").toLowerCase())

  const assignedRuleCount = Array.isArray(control.properties?.rules)
    ? control.properties.rules.length
    : 0
  const cdashBadge =
    isCdashEnabled && isControlMappableForCdash(control)
      ? getCdashBadgeForControl(control, cdashMappings)
      : null
  const isVisitDateIdentifier = control.type === "date" && Boolean(control?.properties?.isVisitDate)

  const colSpanClass = getControlColSpanClass(control.controlSize)
  const fieldLabel = String(control?.label || control?.properties?.labelText || "").trim()
  const typeLabel = String(control?.type || "control")
  const showChrome = isSelected
  const chromeClass = showChrome
    ? "opacity-100 pointer-events-auto"
    : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
  const nativeTitleHover = [
    fieldLabel ? `Label: ${fieldLabel}` : `Type: ${typeLabel}`,
    `Control ID: ${control.id}`,
    `Section ID: ${sectionId}`,
    "Hover for actions and section / control IDs",
  ].join("\n")
  const hasTopChrome = assignedRuleCount > 0

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-designer-control-id={control.id}
      data-designer-section-id={sectionId}
      title={nativeTitleHover}
      className={`relative group min-w-0 w-full pb-1 max-md:col-span-12 ${isSelected ? "rounded-lg ring-2 ring-slate-400" : ""} ${colSpanClass}`}
    >
      <div
        className={`relative h-full w-full min-w-0 border bg-white px-4 pb-4 pt-7 transition-colors rounded-lg ${
          isVisitDateIdentifier
            ? "border-teal-300/90 ring-1 ring-teal-200/80 hover:border-teal-400"
            : "border-slate-200 hover:border-slate-300"
        }`}
        onClick={(e) => onClick(control, e)}
        onDoubleClick={(e) => {
          if (onDoubleClick && control.type !== "label" && control.type !== "hr" && control.type !== "table") {
            e.stopPropagation()
            onDoubleClick(control)
          }
        }}
      >
        <div
          {...listeners}
          {...attributes}
          className="absolute left-2 top-2 z-10 p-0.5 bg-slate-100 hover:bg-slate-200 cursor-grab active:cursor-grabbing rounded border border-slate-200"
          title="Drag to reorder"
        >
          <GripVertical className="w-3.5 h-3.5 text-slate-500" />
        </div>

        <div
          className={`absolute -top-6 right-0 z-30 flex items-center gap-0.5 transition-opacity duration-150 ${chromeClass}`}
        >
          {onCopyControlValue && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                if (!isCopySupported) return
                onCopyControlValue(control)
              }}
              className={`rounded border bg-white p-0.5 shadow-sm ${isCopySupported ? "border-slate-200 text-slate-500 hover:text-slate-700" : "border-slate-200 text-slate-300 cursor-not-allowed"}`}
              title="Copy field"
              aria-label="Copy field"
            >
              <Copy className="h-3 w-3" />
            </button>
          )}
          {onDuplicate && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDuplicate(control.id)
              }}
              className="rounded border border-emerald-200 bg-white p-0.5 text-emerald-600 shadow-sm hover:text-emerald-700"
              title="Duplicate"
              aria-label="Duplicate"
            >
              <CopyPlus className="h-3 w-3" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(control.id)
            }}
            className="rounded border border-rose-200 bg-white p-0.5 text-rose-600 shadow-sm hover:text-rose-700"
            title="Remove"
            aria-label="Remove"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        {hasTopChrome ? (
          <div className="absolute top-2 right-2 z-20 flex items-center justify-end pointer-events-none">
            <span
              className="pointer-events-auto inline-flex shrink-0 items-center gap-0.5 rounded-full border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-slate-700 shadow-sm"
              title={`${assignedRuleCount} rule${assignedRuleCount === 1 ? "" : "s"} assigned — open properties to edit`}
            >
              <FlaskConical className="h-3 w-3 shrink-0 text-slate-600" aria-hidden />
              {assignedRuleCount}
            </span>
          </div>
        ) : null}
        {cdashBadge ? (
          <span
            className="pointer-events-none absolute left-2 top-8 z-10 inline-flex h-[1.375rem] w-[1.375rem] items-center justify-center rounded border border-indigo-200/80 bg-indigo-50 p-0.5 shadow-sm"
            title={`CDASH mapped: ${cdashBadge} — open properties to edit`}
            aria-label={`CDASH mapped: ${cdashBadge}`}
          >
            <Link2 className="h-3 w-3 text-indigo-600" aria-hidden />
          </span>
        ) : null}
        <ControlRenderer
          control={control}
          onInputClick={(control, e) => {
            if (control.type !== "label" && control.type !== "hr") {
              onClick(control, { ...e, isInputClick: true })
            }
          }}
          onTableColumnHeaderChange={onTableColumnHeaderChange}
          onCellLabelChange={onCellLabelChange}
          isCdashEnabled={isCdashEnabled}
          cdashMappings={cdashMappings}
        />
        {isVisitDateIdentifier && (
          <p className="mt-1 text-[10px] font-medium text-teal-700 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            Primary Visit Date
          </p>
        )}
      </div>

      <div
        className={`absolute -bottom-3 left-2 right-0 z-20 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9px] text-slate-400 transition-opacity duration-150 ${chromeClass}`}
        title={nativeTitleHover}
      >
        <span className="shrink-0 font-medium text-slate-400">Ctrl</span>
        <span className="min-w-0 max-w-[42%] truncate font-mono" title={control.id}>
          {control.id}
        </span>
        <button
          type="button"
          onClick={(e) => copyDesignerText(control.id, e)}
          className="shrink-0 rounded p-0.5 hover:bg-slate-100 hover:text-slate-600"
          title="Copy control ID"
          aria-label="Copy control ID"
        >
          <Clipboard className="h-2.5 w-2.5" />
        </button>
        <span className="shrink-0 text-slate-300" aria-hidden>
          ·
        </span>
        <span className="shrink-0 font-medium text-slate-400">Sec</span>
        <span className="min-w-0 max-w-[32%] truncate font-mono" title={String(sectionId)}>
          {sectionId}
        </span>
        <button
          type="button"
          onClick={(e) => copyDesignerText(String(sectionId), e)}
          className="shrink-0 rounded p-0.5 hover:bg-slate-100 hover:text-slate-600"
          title="Copy section ID"
          aria-label="Copy section ID"
        >
          <Clipboard className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  )
}

const SortableSectionTab = ({
  section,
  sectionsLength,
  activeSection,
  editingSection,
  editSectionName,
  setEditSectionName,
  onSectionChange,
  onSectionDelete,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  studyCompletionMode = false,
}) => {
  const isActiveTab = activeSection === section.id
  const statusSection = isStudyCompletionStatusSection(section)
  const sortableId = `${SECTION_TAB_SORTABLE_ID_PREFIX}${section.id}`
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: sortableId,
    data: { type: "section_tab", sectionId: section.id },
    disabled: editingSection === section.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-1 px-4 py-2 rounded-t-lg font-medium transition-colors whitespace-nowrap ${
        isActiveTab
          ? "bg-gradient-to-r from-teal-500 to-fuchsia-600 text-white shadow-sm"
          : "bg-slate-100 text-slate-700 hover:bg-teal-50"
      }`}
    >
      {editingSection === section.id ? (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={editSectionName}
            onChange={(e) => setEditSectionName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveEdit(section.id)
              if (e.key === "Escape") onCancelEdit()
            }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white text-slate-900 px-2 py-1 rounded text-sm min-w-[100px] border border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            autoFocus
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onSaveEdit(section.id)
            }}
            className="hover:bg-white/20 rounded p-0.5"
          >
            <Check className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onCancelEdit()
            }}
            className="hover:bg-white/20 rounded p-0.5"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            {...listeners}
            {...attributes}
            className={`shrink-0 rounded p-1 border transition-colors cursor-grab active:cursor-grabbing touch-none ${
              isActiveTab
                ? "border-white/25 bg-white/10 text-white hover:bg-white/15"
                : "border-slate-200/80 bg-white text-slate-500 hover:bg-white hover:text-slate-700"
            }`}
            title="Drag to reorder section"
            aria-label={`Reorder section ${section.name}`}
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => onSectionChange(section.id)} className="flex items-center gap-1 min-w-0">
            <CrfLabSectionTabAffix section={section} />
            <CrfStudyCompletionSectionTabAffix section={section} />
            <span className="truncate">{section.name}</span>
          </button>
          {!statusSection ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onStartEdit(section)
              }}
              className={`rounded p-0.5 opacity-75 group-hover:opacity-100 transition ${
                isActiveTab
                  ? "text-white/80 hover:text-white hover:bg-white/15"
                  : "text-slate-500 hover:text-slate-800 hover:bg-white"
              }`}
              title="Rename section"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          ) : null}
          {(sectionsLength > 1 || studyCompletionMode) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onSectionDelete(section.id)
              }}
              className={`rounded p-0.5 transition ${
                isActiveTab
                  ? "text-white/80 hover:text-white hover:bg-white/15"
                  : "text-rose-500/90 hover:text-rose-700 hover:bg-rose-50"
              }`}
              title="Delete section"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </>
      )}
    </div>
  )
}

const DesignerCanvas = ({
  sections,
  activeSection,
  onSectionChange,
  onSectionAdd,
  onSectionAddLab,
  onSectionDelete,
  onSectionRename,
  onControlClick,
  onControlDoubleClick,
  onControlDelete,
  onControlDuplicate,
  onCopyControlValue,
  onTableColumnHeaderChange,
  onCellLabelChange,
  selectedControl,
  isConfigValid = true,
  studyCompletionMode = false,
  controlsDropEnabled = true,
  isCdashEnabled = false,
  cdashMappings = [],
}) => {
  const activeSectionData = sections.find((s) => s.id === activeSection)
  const normalizedActiveSection = activeSectionData
    ? normalizeCrfSection(activeSectionData)
    : null
  const labSectionActive = normalizedActiveSection?.sectionType === SECTION_TYPE_LAB
  const studyCompletionSectionActive =
    normalizedActiveSection?.sectionType === SECTION_TYPE_STUDY_COMPLETION_STATUS
  const dropEnabled = isConfigValid && controlsDropEnabled
  const activeTrailingDropClass = getControlColSpanClass(
    getTrailingGridSpan(activeSectionData?.controls)
  )
  const studyCompletionSections = studyCompletionMode
    ? sections.filter(isStudyCompletionStatusSection)
    : []
  const [editingSection, setEditingSection] = useState(null)
  const [editSectionName, setEditSectionName] = useState("")

  const handleStartEdit = (section) => {
    setEditingSection(section.id)
    setEditSectionName(section.name)
  }

  const handleSaveEdit = (sectionId) => {
    if (editSectionName.trim()) {
      onSectionRename(sectionId, editSectionName.trim())
    }
    setEditingSection(null)
    setEditSectionName("")
  }

  const handleCancelEdit = () => {
    setEditingSection(null)
    setEditSectionName("")
  }

  return (
    <div className="h-full bg-white p-6">
      {!studyCompletionMode ? (
      <div className="flex flex-col gap-1 mb-3">
        <p className="text-[11px] text-slate-500 px-0.5">
          Drag the grip on the left of a section tab to change section order.
        </p>
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto overflow-y-hidden flex-nowrap overscroll-x-contain">
          <SortableContext
            items={sections.map((s) => `${SECTION_TAB_SORTABLE_ID_PREFIX}${s.id}`)}
            strategy={horizontalListSortingStrategy}
          >
            {sections.map((section) => (
              <SortableSectionTab
                key={section.id}
                section={section}
                sectionsLength={sections.length}
                activeSection={activeSection}
                editingSection={editingSection}
                editSectionName={editSectionName}
                setEditSectionName={setEditSectionName}
                onSectionChange={onSectionChange}
                onSectionDelete={onSectionDelete}
                onStartEdit={handleStartEdit}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={handleCancelEdit}
                studyCompletionMode={studyCompletionMode}
              />
            ))}
          </SortableContext>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-teal-300/85 bg-white/92 px-3 py-1.5 text-xs font-semibold text-teal-800 shadow-[0_4px_14px_-10px_rgba(139,92,246,0.55),inset_0_1px_0_rgba(255,255,255,0.9)] transition-colors hover:border-teal-400 hover:bg-teal-50/70 sm:px-3.5 sm:text-sm"
            >
              <Plus className="h-3.5 w-3.5 shrink-0 text-teal-700" aria-hidden />
              <span className="whitespace-nowrap">Add section</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-teal-600/90" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sideOffset={8}
            className="z-[100] min-w-[17.5rem] rounded-2xl border border-slate-200/80 bg-white/95 p-1.5 shadow-[0_12px_48px_-12px_rgba(15,23,42,0.3),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-2xl"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <DropdownMenuLabel className="px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
              Section type
            </DropdownMenuLabel>
            <DropdownMenuItem
              className="cursor-pointer flex flex-col items-stretch gap-0.5 rounded-xl px-2.5 py-2.5 my-0.5 focus:bg-emerald-50/90 data-[highlighted]:bg-emerald-50/90"
              onSelect={() => onSectionAdd()}
            >
              <span className="flex items-center gap-2 font-medium text-slate-800">
                <LayoutGrid className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                Standard section
              </span>
              <span className="pl-6 text-[11px] leading-snug text-slate-500">
                Typical visit fields — text, dates, tables, options, etc.
              </span>
            </DropdownMenuItem>
            {typeof onSectionAddLab === "function" ? (
              <DropdownMenuItem
                className="cursor-pointer flex flex-col items-stretch gap-0.5 rounded-xl px-2.5 py-2.5 my-0.5 focus:bg-teal-50/90 data-[highlighted]:bg-teal-50/90"
                onSelect={() => onSectionAddLab()}
              >
                <span className="flex items-center gap-2 font-medium text-slate-800">
                  <FlaskConical className="h-4 w-4 shrink-0 text-teal-600" aria-hidden />
                  Laboratory section
                </span>
                <span className="pl-6 text-[11px] leading-snug text-slate-500">
                  Structured for lab capture; facility is picked during eCRF data entry for reference ranges.
                </span>
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>
      ) : null}

      {/* Section Content */}
      {studyCompletionMode ? (
        studyCompletionSections.length === 0 ? (
          <div className="rounded-lg border border-dashed border-teal-300 bg-teal-50/30 px-6 py-12 text-center text-sm text-slate-600">
            Use <span className="font-semibold">Add block</span> in the Study Completion bar above — sub-sections
            stack here (one per status).
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-[11px] text-slate-500">
              All status blocks live in one form area, stacked top to bottom. Click a block to add fields there.
            </p>
            {studyCompletionSections.map((section) => {
              const isActive = activeSection === section.id
              const blockDropEnabled = dropEnabled && isActive
              const sectionTrailingDropClass = getControlColSpanClass(
                getTrailingGridSpan(section.controls)
              )
              const activateBlock = () => {
                if (!isActive) onSectionChange(section.id)
              }
              return (
                <div
                  key={section.id}
                  role="group"
                  aria-label={`${section.name} status block`}
                  className={`rounded-lg border p-4 transition-shadow ${
                    isActive
                      ? "border-teal-500 bg-white shadow-[0_0_0_2px_rgba(13,148,136,0.2)]"
                      : "border-teal-200/80 bg-slate-50/40 cursor-pointer hover:border-teal-400 hover:bg-teal-50/30"
                  }`}
                  onClick={activateBlock}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSectionChange(section.id)
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-700/80">
                        Patient status
                      </p>
                      <h3 className="text-lg font-semibold text-slate-900">{section.name}</h3>
                      {isActive ? (
                        <p className="mt-0.5 text-xs font-medium text-teal-700">Adding fields here</p>
                      ) : (
                        <p className="mt-0.5 text-xs text-slate-500">Click to add fields to this block</p>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSectionDelete(section.id)
                      }}
                      className="shrink-0 rounded p-1.5 text-rose-500 hover:bg-rose-50"
                      title="Remove status block"
                      aria-label={`Remove ${section.name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                  <SortableContext items={section.controls.map((c) => c.id)} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-12 gap-4 items-stretch">
                      {section.controls.length === 0 ? (
                        <div className="col-span-12">
                          <DropZone
                            id={0}
                            sectionId={section.id}
                            disabled={!blockDropEnabled}
                            studyCompletionLook
                          >
                            <StudyCompletionDropHint
                              isActive={isActive}
                              isConfigValid={isConfigValid}
                              sectionName={section.name}
                              onActivate={activateBlock}
                            />
                          </DropZone>
                        </div>
                      ) : (
                        <>
                          {section.controls.map((control) => (
                            <SortableControl
                              key={control.id}
                              control={control}
                              sectionId={section.id}
                              sectionName={section.name}
                              showFieldSectionLabel={studyCompletionMode}
                              onClick={onControlClick}
                              onDoubleClick={onControlDoubleClick}
                              onDelete={onControlDelete}
                              onDuplicate={onControlDuplicate}
                              onCopyControlValue={onCopyControlValue}
                              onTableColumnHeaderChange={onTableColumnHeaderChange}
                              onCellLabelChange={onCellLabelChange}
                              selectedControl={selectedControl}
                              isCdashEnabled={isCdashEnabled}
                              cdashMappings={cdashMappings}
                            />
                          ))}
                          <div className={`${sectionTrailingDropClass} max-md:col-span-12`}>
                            <DropZone
                              id={section.controls.length}
                              sectionId={section.id}
                              disabled={!blockDropEnabled}
                              studyCompletionLook
                              compact
                            >
                              <StudyCompletionDropHint
                                isActive={isActive}
                                isConfigValid={isConfigValid}
                                sectionName={section.name}
                                onActivate={activateBlock}
                              />
                            </DropZone>
                          </div>
                        </>
                      )}
                    </div>
                  </SortableContext>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : activeSectionData ? (
        <div
          className={`bg-white rounded-lg border p-4 min-h-[400px] ${
            labSectionActive
              ? "border-teal-300 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.12)] dark:border-teal-800"
              : studyCompletionSectionActive
                ? "border-teal-300 shadow-[inset_0_0_0_1px_rgba(13,148,136,0.12)]"
                : "border-slate-200"
          }`}
        >
          <CrfStudyCompletionSectionCanvasBanner section={activeSectionData} />
          {labSectionActive && (
            <p className="mb-4 rounded-lg border border-teal-100 bg-teal-50/40 px-3 py-2 text-xs text-teal-900/90 dark:border-teal-900/45 dark:bg-teal-950/30 dark:text-teal-200/90">
              Laboratory section fields are laid out here. The{' '}
              <span className="font-semibold">lab facility</span> is chosen only during{' '}
              <span className="font-semibold">eCRF data entry</span>, so reference ranges apply to the facility
              selected at capture time.
            </p>
          )}
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">{activeSectionData.name}</h3>
            <p className="text-xs text-slate-500">
              Drag to reorder. Hover or click a field for compact actions — field size matches preview.
            </p>
          </div>

          <SortableContext
            items={activeSectionData.controls.map(c => c.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-12 gap-4 items-stretch">
              {activeSectionData.controls.length === 0 ? (
                <div className="col-span-12">
                  <DropZone id={0} sectionId={activeSection} disabled={!dropEnabled}>
                    {!dropEnabled ? (
                      <div className="text-center py-8">
                        <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4">
                          <p className="text-amber-800 font-semibold mb-2">
                            ⚠ CRF Configuration Required
                          </p>
                          <p className="text-sm text-amber-700">
                            {studyCompletionMode && isConfigValid
                              ? "Add a patient status block above, then drag tools here."
                              : "Please fill in the CRF Configuration (Name, Study, and Visit are required) before adding controls."}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-slate-400 py-8">
                        Drag and drop controls here or click to add
                      </div>
                    )}
                  </DropZone>
                </div>
              ) : (
                <>
                  {activeSectionData.controls.map((control, index) => (
                    <SortableControl
                      key={control.id}
                      control={control}
                      sectionId={activeSection}
                      sectionName={activeSectionData?.name || ""}
                      onClick={onControlClick}
                      onDoubleClick={onControlDoubleClick}
                      onDelete={onControlDelete}
                      onDuplicate={onControlDuplicate}
                      onCopyControlValue={onCopyControlValue}
                      onTableColumnHeaderChange={onTableColumnHeaderChange}
                      onCellLabelChange={onCellLabelChange}
                      selectedControl={selectedControl}
                      isCdashEnabled={isCdashEnabled}
                      cdashMappings={cdashMappings}
                    />
                  ))}
                  <div className={`${activeTrailingDropClass} max-md:col-span-12`}>
                    <DropZone id={activeSectionData.controls.length} sectionId={activeSection} disabled={!dropEnabled} compact>
                      <div className="flex h-full min-h-[2.5rem] items-center justify-center text-center text-slate-400 text-sm">
                        Drop control here
                      </div>
                    </DropZone>
                  </div>
                </>
              )}
            </div>
          </SortableContext>
        </div>
      ) : null}
    </div>
  )
}

export default DesignerCanvas

