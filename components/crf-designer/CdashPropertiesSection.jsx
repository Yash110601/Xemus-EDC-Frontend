"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  buildCdashDraftAssignments,
  applyDraftAvailabilityToSuggestions,
  clearCdashMapping,
  findCdashMappingByFieldId,
  findCdashVariableConflict,
  formatCdashVariableConflictMessage,
  getCdashBadgeForControl,
  resolveControlFieldInstanceId,
  upsertCdashMapping,
} from "@/lib/utils/cdashMappings"
import { formatCdashVariableOption, isCdashVariableSelectable } from "@/lib/cdash/normalizeVariable"
import { extractDomainHint, isGenericDesignerFieldLabel, resolveDesignerControlLabel } from "@/lib/cdash/controlProfile"
import { formatDesignerControlIdShort, designerControlIdTitle } from "@/lib/utils/designerIdDisplay"
import { toMappingDraft } from "@/lib/cdash/cdashConfidence"
import { useCdashLibrary } from "@/hooks/useCdashLibrary"
import { useCdashSuggestions } from "@/hooks/useCdashSuggestions"
import CdashSuggestionRow from "./CdashSuggestionRow"
import CdashVariablePickerDialog from "./CdashVariablePickerDialog"
import { useToast } from "@/hooks/use-toast"
import { Link2, Loader2, Search, Sparkles, X, ChevronDown, ChevronUp } from "lucide-react"

export default function CdashPropertiesSection({
  control,
  studyId,
  crfDesignId = null,
  mappings = [],
  getFieldLabel = null,
  onChange,
  onDirty,
  disabled = false,
}) {
  const { toast } = useToast()
  const fieldInstanceId = useMemo(() => resolveControlFieldInstanceId(control), [control])
  const controlLabel = useMemo(() => resolveDesignerControlLabel(control), [control])
  const genericLabelHint = useMemo(() => isGenericDesignerFieldLabel(controlLabel), [controlLabel])
  const shortFieldId = useMemo(() => formatDesignerControlIdShort(fieldInstanceId), [fieldInstanceId])

  const currentMapping = useMemo(
    () => findCdashMappingByFieldId(mappings, fieldInstanceId),
    [mappings, fieldInstanceId],
  )
  const badge = useMemo(() => getCdashBadgeForControl(control, mappings), [control, mappings])

  const draftAssignments = useMemo(
    () => buildCdashDraftAssignments(mappings, fieldInstanceId, getFieldLabel),
    [fieldInstanceId, getFieldLabel, mappings],
  )

  const hasCrfDesignId = Number(crfDesignId) > 0

  const suggestOptions = useMemo(
    () => ({
      crfDesignId: hasCrfDesignId ? crfDesignId : null,
      draftAssignments,
    }),
    [crfDesignId, draftAssignments, hasCrfDesignId],
  )

  const { loading: libraryLoading, libraryReady, domains } = useCdashLibrary(true)
  const {
    suggestions,
    loading: suggestLoading,
    error: suggestError,
    hasFetched,
    fetchSuggestions,
    dismissSuggestions,
  } = useCdashSuggestions(control, studyId, libraryReady, suggestOptions)

  const displaySuggestions = useMemo(
    () => applyDraftAvailabilityToSuggestions(suggestions, draftAssignments, fieldInstanceId),
    [suggestions, draftAssignments, fieldInstanceId],
  )

  const assertCanAssignVariable = useCallback(
    ({ cdashReferenceDataId, cdashVariableName }) => {
      const conflict = findCdashVariableConflict(mappings, {
        fieldInstanceId,
        cdashReferenceDataId,
        cdashVariableName,
      })
      if (!conflict) return true
      const otherLabel =
        (typeof getFieldLabel === "function"
          ? getFieldLabel(conflict.fieldInstanceId)
          : null) || conflict.variableLabel || conflict.fieldInstanceId
      toast({
        title: "CDASH variable already mapped",
        description: formatCdashVariableConflictMessage(
          cdashVariableName || conflict.cdashVariableName,
          otherLabel,
        ),
        variant: "destructive",
      })
      return false
    },
    [fieldInstanceId, getFieldLabel, mappings, toast],
  )

  const [pickerOpen, setPickerOpen] = useState(false)
  const [showSuggestPanel, setShowSuggestPanel] = useState(false)
  const [expanded, setExpanded] = useState(() => !currentMapping?.cdashVariableName)

  const isMapped = Boolean(currentMapping?.cdashVariableName)

  useEffect(() => {
    setExpanded(!isMapped)
    setShowSuggestPanel(false)
    dismissSuggestions()
  }, [fieldInstanceId, isMapped, dismissSuggestions])

  const domainCode = currentMapping?.domainCode || ""
  const domainHint = useMemo(() => extractDomainHint(fieldInstanceId), [fieldInstanceId])

  const patchMapping = useCallback(
    (patch) => {
      onDirty?.()
      onChange?.(
        upsertCdashMapping(mappings, {
          ...currentMapping,
          fieldInstanceId,
          ...patch,
        }),
      )
    },
    [currentMapping, fieldInstanceId, mappings, onChange, onDirty],
  )

  const applySuggestion = useCallback(
    (suggestion) => {
      if (suggestion?.isAvailable === false) return
      const draft = toMappingDraft(suggestion, fieldInstanceId)
      if (!draft) return
      if (
        !assertCanAssignVariable({
          cdashReferenceDataId: draft.cdashReferenceDataId,
          cdashVariableName: draft.cdashVariableName,
        })
      ) {
        return
      }
      patchMapping({
        cdashReferenceDataId: draft.cdashReferenceDataId,
        cdashVariableName: draft.cdashVariableName,
        domainCode: draft.domainCode,
        variableLabel: draft.variableLabel,
      })
      setShowSuggestPanel(false)
      dismissSuggestions()
    },
    [assertCanAssignVariable, fieldInstanceId, patchMapping, dismissSuggestions],
  )

  const applyVariableItem = useCallback(
    (item) => {
      if (!item?.id || !isCdashVariableSelectable(item)) return
      if (
        !assertCanAssignVariable({
          cdashReferenceDataId: Number(item.id),
          cdashVariableName: item.variableName,
        })
      ) {
        return
      }
      patchMapping({
        cdashReferenceDataId: Number(item.id),
        cdashVariableName: String(item.variableName ?? "").trim(),
        domainCode: String(item.domainCode ?? domainCode ?? domainHint).trim(),
        variableLabel: String(item.label ?? "").trim(),
      })
      setShowSuggestPanel(false)
      dismissSuggestions()
    },
    [assertCanAssignVariable, domainCode, domainHint, patchMapping, dismissSuggestions],
  )

  const handleSuggest = async () => {
    setShowSuggestPanel(true)
    await fetchSuggestions()
  }

  const handleSkip = () => {
    setShowSuggestPanel(false)
    dismissSuggestions()
  }

  const handleClear = () => {
    onDirty?.()
    onChange?.(clearCdashMapping(mappings, fieldInstanceId))
    setShowSuggestPanel(false)
    dismissSuggestions()
  }

  const variableDisplay = currentMapping?.cdashVariableName
    ? formatCdashVariableOption({
        variableName: currentMapping.cdashVariableName,
        label: currentMapping.variableLabel,
        dataType: "",
      })
    : ""

  if (libraryLoading) {
    return (
      <section className="border-t border-slate-200 pt-4 mt-4 space-y-3" aria-busy="true">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-full rounded-md" />
      </section>
    )
  }

  if (libraryReady === false) {
    return (
      <section className="border-t border-slate-200 pt-4 mt-4">
        <p className="text-[11px] text-amber-800 bg-amber-50 rounded-lg px-3 py-2 ring-1 ring-amber-200/70">
          CDASH library is not loaded. Contact your administrator.
        </p>
      </section>
    )
  }

  return (
    <>
      <section className="border-t border-slate-200 pt-3 mt-3" aria-label="CDASH Mapping">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex w-full items-center justify-between mb-2 gap-2 text-left"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Link2 className="w-4 h-4 text-indigo-600 shrink-0" />
            <Label className="text-xs font-semibold text-slate-900 cursor-pointer">CDASH Mapping</Label>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {badge ? (
              <span className="inline-flex items-center rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-800">
                {badge}
              </span>
            ) : null}
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </div>
        </button>

        {!expanded && isMapped ? (
          <p className="text-[10px] text-slate-500 mb-1 truncate">{variableDisplay}</p>
        ) : null}

        {expanded ? (
        <>
        <p className="text-[10px] text-slate-500 mb-2">
          Mapping for:{" "}
          <span className="font-medium text-slate-700">{controlLabel || "Untitled"}</span>
          <span className="font-mono text-slate-400" title={designerControlIdTitle(fieldInstanceId)}>
            {" "}({shortFieldId})
          </span>
        </p>

        {genericLabelHint && !isMapped ? (
          <p className="text-[10px] text-slate-500 mb-2 rounded-lg bg-slate-50 px-2.5 py-1.5 ring-1 ring-slate-200/60">
            Use a specific label (e.g. Date of Birth, AE Start Date) for better CDASH matches.
          </p>
        ) : null}

        <div className="space-y-2.5">
          <div>
            <Label className="text-xs font-medium mb-1.5 block text-slate-700">Domain</Label>
            <Select
              value={domainCode || domainHint || ""}
              onValueChange={(value) => {
                patchMapping({
                  domainCode: value,
                  cdashReferenceDataId: null,
                  cdashVariableName: "",
                  variableLabel: "",
                })
              }}
              disabled={disabled || domains.length === 0}
            >
              <SelectTrigger className="text-xs sm:text-sm h-9 w-full cursor-pointer">
                <SelectValue placeholder="Select domain" />
              </SelectTrigger>
              <SelectContent className="z-[100] bg-white shadow-lg max-h-[240px]">
                {domains.map((d) => {
                  const code = d.domainCode ?? d.DomainCode ?? d
                  return (
                    <SelectItem key={String(code)} value={String(code)}>
                      {String(code)}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-medium mb-1.5 block text-slate-700">CDASH Variable</Label>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => setPickerOpen(true)}
              className="h-9 w-full justify-start text-xs sm:text-sm font-normal text-slate-700"
            >
              {variableDisplay || "Search manually…"}
            </Button>
          </div>

          {!currentMapping?.cdashVariableName ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || suggestLoading || !studyId}
              onClick={() => void handleSuggest()}
              className="h-8 w-full text-xs hover:bg-indigo-50 hover:border-indigo-200"
            >
              {suggestLoading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-3.5 w-3.5 text-indigo-600" />
              )}
              Suggest CDASH (optional)
            </Button>
          ) : null}

          {showSuggestPanel && suggestLoading ? (
            <div className="space-y-2" aria-busy="true">
              <Skeleton className="h-14 w-full rounded-lg" />
            </div>
          ) : null}

          {showSuggestPanel && hasFetched && !suggestLoading && displaySuggestions.length > 0 ? (
            <div className="space-y-2 rounded-xl bg-slate-50/60 ring-1 ring-slate-200/60 p-2">
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide px-0.5">
                Suggested (optional)
              </p>
              {displaySuggestions.slice(0, 3).map((row) => (
                <CdashSuggestionRow
                  key={row.variable.id}
                  suggestion={row}
                  disabled={disabled}
                  compact
                  onUse={applySuggestion}
                />
              ))}
              <div className="flex gap-1.5 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() => setPickerOpen(true)}
                  className="h-7 flex-1 text-[10px]"
                >
                  <Search className="mr-1 h-3 w-3" />
                  Search manually
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  onClick={handleSkip}
                  className="h-7 text-[10px] text-slate-500"
                >
                  Skip
                </Button>
              </div>
            </div>
          ) : null}

          {showSuggestPanel && hasFetched && !suggestLoading && displaySuggestions.length === 0 ? (
            <div className="rounded-xl bg-slate-50/60 ring-1 ring-slate-200/60 p-3 space-y-2">
              <p className="text-[11px] text-slate-600">
                No available matches — variables may already be mapped elsewhere. Search manually or skip.
              </p>
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() => setPickerOpen(true)}
                  className="h-7 flex-1 text-[10px]"
                >
                  Search manually
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  onClick={handleSkip}
                  className="h-7 text-[10px] text-slate-500"
                >
                  Skip — no mapping
                </Button>
              </div>
            </div>
          ) : null}

          {suggestError ? (
            <p className="text-[11px] text-red-700 bg-red-50 rounded-lg px-2.5 py-2">{suggestError}</p>
          ) : null}

          {badge ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={handleClear}
              className="h-8 w-full text-xs text-slate-600 hover:text-red-600 hover:border-red-200"
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Remove mapping
            </Button>
          ) : null}

          {!hasFetched && !isMapped ? (
            <p className="text-[10px] text-slate-400">
              Each CDASH variable can map to only one field in this CRF. Suggest is optional — map manually or skip until Save.
            </p>
          ) : null}
        </div>
        </>
        ) : null}
      </section>

      <CdashVariablePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        control={control}
        domains={domains}
        domainCode={domainCode || domainHint || ""}
        crfDesignId={hasCrfDesignId ? crfDesignId : null}
        draftAssignments={draftAssignments}
        onDomainChange={(value) => {
          patchMapping({
            domainCode: value,
            cdashReferenceDataId: null,
            cdashVariableName: "",
            variableLabel: "",
          })
        }}
        initialSearch={currentMapping?.cdashVariableName || ""}
        selectedReferenceId={currentMapping?.cdashReferenceDataId}
        onSelect={applyVariableItem}
      />
    </>
  )
}
