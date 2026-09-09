"use client"

/**
 * Paged CRF Design dropdown — scroll loads page 2+ (pageSize 30).
 */

import AsyncLookupSelect from "@/components/ui/async-lookup-select"
import crfDesignService from "@/lib/services/crfDesign.service"
import { formatReportCrfDesignOptionLabel } from "@/lib/reports/reportPatientCascadeFilters"
import { DROPDOWN_PAGE_SIZE } from "@/lib/api/lookupLimits"
import { useCallback } from "react"

function resolveHasMore(res, page) {
  const pageNumber = res?.pageNumber ?? res?.data?.pageNumber ?? page
  const totalPages = res?.totalPages ?? res?.data?.totalPages
  const truncated = Boolean(res?.truncated ?? res?.data?.truncated)
  const totalCount = Number(res?.totalCount ?? res?.data?.totalCount)
  const pageSize = Number(res?.pageSize ?? res?.data?.pageSize) || DROPDOWN_PAGE_SIZE
  return Boolean(
    res?.hasMore ??
      res?.data?.hasMore ??
      (truncated ||
        (totalPages != null && Number(pageNumber) < Number(totalPages)) ||
        (Number.isFinite(totalCount) && totalCount > Number(pageNumber) * pageSize)),
  )
}

export default function CrfPagedSelect({
  studyId = null,
  value,
  onValueChange,
  selectedLabel = "",
  label = "CRF Design",
  required = false,
  disabled = false,
  placeholder = "All CRF Designs",
  searchPlaceholder = "Search CRF designs...",
  emptyOptionLabel = "All CRF Designs",
  emptyMessage = "No CRF designs found.",
  showRequiredError = false,
  requiredErrorMessage = "Please select a CRF design.",
  prefetch = true,
  reloadKey = "crf-paged-select",
  triggerClassName,
  contentClassName,
  className,
}) {
  const studyNum = parseInt(String(studyId ?? ""), 10)
  const studyOk = Number.isFinite(studyNum) && studyNum > 0

  const loadOptions = useCallback(
    async (q = "", { page = 1 } = {}) => {
      if (!studyOk) return { items: [], hasMore: false }
      const res = await crfDesignService.getCrfDesignsForDropdown(studyNum, {
        search: String(q || "").trim(),
        pageNumber: page,
        pageSize: DROPDOWN_PAGE_SIZE,
      })
      if (res?.isSuccess === false) {
        throw new Error(res?.message || "Failed to load CRF designs")
      }
      const items = res?.items || res?.data?.items || []
      return {
        items,
        pageNumber: res?.pageNumber ?? res?.data?.pageNumber ?? page,
        totalPages: res?.totalPages ?? res?.data?.totalPages,
        truncated: Boolean(res?.truncated ?? res?.data?.truncated),
        hasMore: resolveHasMore(res, page),
      }
    },
    [studyNum, studyOk],
  )

  return (
    <AsyncLookupSelect
      label={label}
      required={required}
      value={value}
      onValueChange={onValueChange}
      selectedLabel={selectedLabel}
      disabled={disabled || !studyOk}
      placeholder={!studyOk ? "Select Study first" : placeholder}
      searchPlaceholder={searchPlaceholder}
      showRequiredError={showRequiredError}
      requiredErrorMessage={requiredErrorMessage}
      loadOptions={loadOptions}
      getOptionValue={(c) => String(c.crfDesignId ?? c.id ?? "")}
      getOptionLabel={(c) => formatReportCrfDesignOptionLabel(c) || `CRF ${c.crfDesignId ?? c.id}`}
      prefetch={prefetch && studyOk}
      reloadKey={`${reloadKey}|${studyOk ? studyNum : "none"}`}
      emptyMessage={emptyMessage}
      emptyOptionLabel={emptyOptionLabel}
      triggerClassName={triggerClassName}
      contentClassName={contentClassName}
      className={className}
    />
  )
}
