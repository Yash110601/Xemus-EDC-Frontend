"use client"

/**
 * Paged Site dropdown — scroll loads page 2+, search uses GetSitesForDropdown.
 */

import AsyncLookupSelect from "@/components/ui/async-lookup-select"
import siteService from "@/lib/services/site.service"
import { DROPDOWN_PAGE_SIZE, normalizeApiPagedResponse } from "@/lib/api/lookupLimits"
import { useCallback } from "react"

export default function SitePagedSelect({
  studyId = null,
  value,
  onValueChange,
  selectedLabel = "",
  label = "Site",
  required = false,
  disabled = false,
  placeholder = "Select Site",
  searchPlaceholder = "Search sites...",
  emptyOptionLabel = "All Sites",
  emptyMessage = "No sites found.",
  showRequiredError = false,
  requiredErrorMessage = "Please select a site.",
  prefetch = true,
  reloadKey = "site-paged-select",
  triggerClassName,
  contentClassName,
  className,
}) {
  const studyNum = parseInt(String(studyId ?? ""), 10)
  const studyOk = Number.isFinite(studyNum) && studyNum > 0

  const loadOptions = useCallback(
    async (q = "", { page = 1 } = {}) => {
      if (!studyOk) return { items: [], hasMore: false }
      const res = await siteService.getSitesForDropdown(studyNum, {
        search: String(q || "").trim(),
        pageNumber: page,
        pageSize: DROPDOWN_PAGE_SIZE,
      })
      if (res?.isSuccess === false) {
        throw new Error(res?.message || "Failed to load sites")
      }
      return normalizeApiPagedResponse(res, page)
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
      getOptionValue={(site) => String(site.siteId ?? site.id ?? "")}
      getOptionLabel={(site) => {
        const id = site.siteId ?? site.id
        const code = site.siteCode || site.code || ""
        const name = site.siteName || site.name || ""
        const labelText = code && name ? `${code} - ${name}` : name || code || `Site ${id}`
        return id ? `${labelText}` : labelText
      }}
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
