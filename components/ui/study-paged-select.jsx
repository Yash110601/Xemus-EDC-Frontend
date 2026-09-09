"use client"

/**
 * Standard paged Study dropdown — scroll loads page 2+.
 * Default: GetStudiesForDropdown. Finance: GetAccessibleStudies?financeEnabledOnly=true.
 */

import AsyncLookupSelect from "@/components/ui/async-lookup-select"
import { getStudyFilterDisplayName } from "@/lib/reports/studySitePatientReportUi"
import {
  loadPagedFinanceEnabledStudyOptions,
  loadPagedStudyDropdownOptions,
} from "@/lib/utils/loadPagedStudyDropdownOptions"
import { loadPagedCdashEnabledStudyOptions } from "@/lib/utils/loadPagedCdashEnabledStudyOptions"
import { useCallback } from "react"

export default function StudyPagedSelect({
  value,
  onValueChange,
  selectedLabel = "",
  studyType = null,
  /** When true, uses GetAccessibleStudies with financeEnabledOnly (finance module studies only). */
  financeEnabledOnly = false,
  /** When true, filters to studies with isCdashEnabled !== false on the DTO. */
  cdashEnabledOnly = false,
  /** Optional Set/array of study id strings — keeps only matching rows (e.g. Listing Study Type intersect). */
  allowedStudyIds = null,
  label = "Study",
  required = false,
  disabled = false,
  placeholder = "Search and select a study...",
  searchPlaceholder = "Search protocol...",
  showRequiredError = false,
  requiredErrorMessage = "Please select a study.",
  prefetch = true,
  reloadKey = "study-paged-select",
  triggerClassName,
  contentClassName,
  className,
  compact = false,
  emptyOptionLabel = "",
  emptyMessage = "No studies found. Try another search.",
}) {
  const loadOptions = useCallback(
    async (q, meta) => {
      const result = cdashEnabledOnly
        ? await loadPagedCdashEnabledStudyOptions(q, meta)
        : financeEnabledOnly
          ? await loadPagedFinanceEnabledStudyOptions(q, meta)
          : await loadPagedStudyDropdownOptions(q, { ...meta, studyType })

      if (!allowedStudyIds) return result

      const allow =
        allowedStudyIds instanceof Set
          ? allowedStudyIds
          : new Set(
              (Array.isArray(allowedStudyIds) ? allowedStudyIds : [])
                .map((id) => String(id))
                .filter(Boolean),
            )

      return {
        ...result,
        items: (result.items || []).filter((study) => {
          const id = study?.studyId ?? study?.id
          return id != null && allow.has(String(id))
        }),
      }
    },
    [studyType, financeEnabledOnly, cdashEnabledOnly, allowedStudyIds],
  )

  const allowKey =
    allowedStudyIds == null
      ? "all"
      : allowedStudyIds instanceof Set
        ? `set-${allowedStudyIds.size}`
        : `arr-${Array.isArray(allowedStudyIds) ? allowedStudyIds.length : 0}`

  return (
    <AsyncLookupSelect
      label={label}
      required={required}
      value={value}
      onValueChange={onValueChange}
      selectedLabel={selectedLabel}
      disabled={disabled}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      showRequiredError={showRequiredError}
      requiredErrorMessage={requiredErrorMessage}
      loadOptions={loadOptions}
      getOptionValue={(study) => String(study.studyId ?? study.id ?? "")}
      getOptionLabel={(study) =>
        study.studyProtocolNumber || getStudyFilterDisplayName(study)
      }
      prefetch={prefetch}
      reloadKey={`${reloadKey}|${cdashEnabledOnly ? "cdash" : financeEnabledOnly ? "fin" : "std"}|${studyType ?? "all"}|${allowKey}`}
      emptyMessage={emptyMessage}
      emptyOptionLabel={emptyOptionLabel}
      triggerClassName={triggerClassName}
      contentClassName={contentClassName}
      className={className}
      compact={compact}
    />
  )
}
