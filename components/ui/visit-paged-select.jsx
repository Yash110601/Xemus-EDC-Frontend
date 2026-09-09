"use client"

/**
 * Paged Visit Schedule dropdown — scroll loads page 2+ (pageSize 30).
 */

import AsyncLookupSelect from "@/components/ui/async-lookup-select"
import visitScheduleService from "@/lib/services/visitSchedule.service"
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

export default function VisitPagedSelect({
  studyId = null,
  crfDesignId = null,
  value,
  onValueChange,
  selectedLabel = "",
  label = "Visit Schedule",
  required = false,
  disabled = false,
  placeholder = "All Visit Schedules",
  searchPlaceholder = "Search visits...",
  emptyOptionLabel = "All Visit Schedules",
  emptyMessage = "No visit schedules found.",
  showRequiredError = false,
  requiredErrorMessage = "Please select a visit schedule.",
  prefetch = true,
  reloadKey = "visit-paged-select",
  triggerClassName,
  contentClassName,
  className,
}) {
  const studyNum = parseInt(String(studyId ?? ""), 10)
  const studyOk = Number.isFinite(studyNum) && studyNum > 0
  const crfNum = parseInt(String(crfDesignId ?? ""), 10)
  const crfFilter = Number.isFinite(crfNum) && crfNum > 0 ? crfNum : null

  const loadOptions = useCallback(
    async (q = "", { page = 1 } = {}) => {
      if (!studyOk) return { items: [], hasMore: false }
      const res = await visitScheduleService.getVisitSchedulesForDropdown(studyNum, crfFilter, {
        search: String(q || "").trim(),
        pageNumber: page,
        pageSize: DROPDOWN_PAGE_SIZE,
      })
      if (res?.isSuccess === false) {
        throw new Error(res?.message || "Failed to load visit schedules")
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
    [studyNum, studyOk, crfFilter],
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
      getOptionValue={(v) => String(v.visitScheduleId ?? v.id ?? "")}
      getOptionLabel={(v) => v.name || v.visitName || v.visitScheduleName || `Visit ${v.id ?? v.visitScheduleId}`}
      prefetch={prefetch && studyOk}
      reloadKey={`${reloadKey}|${studyOk ? studyNum : "none"}|${crfFilter ?? "all"}`}
      emptyMessage={emptyMessage}
      emptyOptionLabel={emptyOptionLabel}
      triggerClassName={triggerClassName}
      contentClassName={contentClassName}
      className={className}
    />
  )
}
