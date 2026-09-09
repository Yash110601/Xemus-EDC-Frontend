"use client"

/**
 * Async paged select for legacy dropdown APIs (ScalePagedResultDto).
 * Local-first search on cached rows; API search only when no local hit.
 * Prefetch next page at ~72% scroll — one page at a time (shared pagedScrollPrefetch).
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { Check, ChevronDown, Loader2, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { MacTooltip } from "@/components/ui/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import {
  DROPDOWN_PAGE_SIZE,
  DROPDOWN_SEARCH_DEBOUNCE_MS,
  getCapErrorMessage,
  isCapError,
} from "@/lib/api/lookupLimits"
import { usePagedScrollPrefetch } from "@/lib/hooks/usePagedScrollPrefetch"
import { filterListByNeedle, mergeUniqueById } from "@/lib/utils/pagedListSearch"

/**
 * @param {object} props
 * @param {(q: string, meta?: { page: number }) => Promise<{ items: any[], hasMore?: boolean, pageNumber?: number, totalPages?: number, truncated?: boolean } | any[]>} props.loadOptions
 */
export default function AsyncLookupSelect({
  label,
  required = false,
  value,
  onValueChange,
  disabled = false,
  placeholder = "Select",
  searchPlaceholder = "Type to search...",
  showRequiredError = false,
  requiredErrorMessage = "This field is required.",
  triggerClassName,
  contentClassName = "",
  className,
  loadOptions,
  getOptionValue,
  getOptionLabel,
  selectedLabel: selectedLabelProp = "",
  debounceMs = DROPDOWN_SEARCH_DEBOUNCE_MS,
  emptyMessage = "No results. Try another search.",
  hasMoreMessage = "",
  reloadKey = "",
  prefetch = true,
  /** Optional first row to clear selection (e.g. "All Users") */
  emptyOptionLabel = "",
  /** Compact toolbar style (e.g. eCRF designer Study row) — matches original SelectTrigger look */
  compact = false,
  /** @deprecated Scroll uses shared 72% ratio; kept for API compatibility */
  prefetchAtIndex: _prefetchAtIndex,
}) {
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")
  const [debouncedQ, setDebouncedQ] = useState("")
  const [items, setItems] = useState([])
  const [displayItems, setDisplayItems] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState("")
  const [selectedLabel, setSelectedLabel] = useState(selectedLabelProp || "")
  const [apiSearchActive, setApiSearchActive] = useState(false)
  const [listElVersion, setListElVersion] = useState(0)

  const reqIdRef = useRef(0)
  const selectedCacheRef = useRef(null)
  const loadMoreLockRef = useRef(false)
  const tryLoadMoreRef = useRef(() => {})
  const itemsRef = useRef([])
  const apiSearchActiveRef = useRef(false)
  const lastApiQRef = useRef("")
  const hasMoreRef = useRef(false)
  const pageRef = useRef(1)
  const debouncedQRef = useRef("")
  const prevReloadKeyRef = useRef(reloadKey)
  const openRef = useRef(false)
  const skipSearchReloadRef = useRef(false)
  const loadingRef = useRef(false)
  const loadingMoreRef = useRef(false)
  const loadMoreSentinelRef = useRef(null)

  const {
    scrollContainerRef,
    paginationInFlightRef,
    handleScroll,
    resetPrefetchTracking,
    maybePrefetchIfShortList,
  } = usePagedScrollPrefetch({
    onPrefetch: () => tryLoadMoreRef.current?.(),
    enabled: open,
  })

  const bindListRef = useCallback(
    (el) => {
      scrollContainerRef.current = el
      if (el) setListElVersion((v) => v + 1)
    },
    [scrollContainerRef],
  )

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    apiSearchActiveRef.current = apiSearchActive
  }, [apiSearchActive])

  useEffect(() => {
    hasMoreRef.current = hasMore
  }, [hasMore])

  useEffect(() => {
    pageRef.current = page
  }, [page])

  useEffect(() => {
    debouncedQRef.current = debouncedQ
  }, [debouncedQ])

  useEffect(() => {
    openRef.current = open
  }, [open])

  useEffect(() => {
    loadingRef.current = loading
  }, [loading])

  useEffect(() => {
    loadingMoreRef.current = loadingMore
  }, [loadingMore])

  useEffect(() => {
    if (selectedLabelProp) setSelectedLabel(selectedLabelProp)
  }, [selectedLabelProp])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchValue.trim()), debounceMs)
    return () => clearTimeout(t)
  }, [searchValue, debounceMs])

  const mergeUnique = useCallback(
    (prev, next) => mergeUniqueById(prev, next, getOptionValue),
    [getOptionValue],
  )

  const filterLocal = useCallback(
    (list, q) =>
      filterListByNeedle(list, q, (it) => [
        getOptionLabel(it),
        getOptionValue(it),
      ]),
    [getOptionLabel, getOptionValue],
  )

  const runLoad = useCallback(
    async (q, pageNum, { append } = { append: false }) => {
      if (typeof loadOptions !== "function") return
      const reqId = ++reqIdRef.current
      if (append) setLoadingMore(true)
      else setLoading(true)
      setError("")
      try {
        const result = await loadOptions(q, { page: pageNum })
        if (reqId !== reqIdRef.current) return
        const list = Array.isArray(result) ? result : result?.items || []
        // Backend contract: truncated || pageNumber < totalPages (no page-length guessing)
        let more = false
        if (!Array.isArray(result)) {
          if (result?.hasMore != null) {
            more = Boolean(result.hasMore)
          } else {
            more =
              result?.truncated === true ||
              (result?.pageNumber != null &&
                result?.totalPages != null &&
                Number(result.pageNumber) < Number(result.totalPages))
          }
          const pageSizeHint = Number(result?.pageSize) || DROPDOWN_PAGE_SIZE
          const totalCount = Number(result?.totalCount)
          const totalPages = Number(result?.totalPages)
          if (!more && Number.isFinite(totalCount) && totalCount > pageNum * pageSizeHint) {
            more = true
          }
          // Incomplete page meta from some list APIs — keep paging until a short/empty page
          if (
            !more &&
            (!Number.isFinite(totalPages) || totalPages <= 0) &&
            (!Number.isFinite(totalCount) || totalCount <= 0) &&
            list.length >= pageSizeHint
          ) {
            more = true
          }
        } else if (list.length >= DROPDOWN_PAGE_SIZE) {
          more = true
        }

        if (append) {
          const prev = itemsRef.current
          const merged = mergeUnique(prev, list)
          if (merged.length === prev.length || list.length === 0) {
            more = false
            setItems(prev)
            itemsRef.current = prev
          } else {
            setItems(merged)
            itemsRef.current = merged
            const pageSizeHint = Number(result?.pageSize) || DROPDOWN_PAGE_SIZE
            if (list.length < pageSizeHint) more = false
          }
        } else {
          setItems(list)
          itemsRef.current = list
          resetPrefetchTracking()
        }
        setHasMore(more)
        hasMoreRef.current = more
        setPage(pageNum)
        pageRef.current = pageNum
        lastApiQRef.current = q

        if (!append && more) {
          maybePrefetchIfShortList(more)
        }

        if (value) {
          const match = list.find((it) => String(getOptionValue(it)) === String(value))
          if (match) {
            selectedCacheRef.current = match
            setSelectedLabel(getOptionLabel(match))
          }
        }
      } catch (e) {
        if (reqId !== reqIdRef.current) return
        if (!append) {
          setItems([])
          itemsRef.current = []
        }
        setHasMore(false)
        setError(isCapError(e) ? getCapErrorMessage(e) : e?.message || "Failed to load options")
      } finally {
        if (reqId === reqIdRef.current) {
          setLoading(false)
          setLoadingMore(false)
          loadMoreLockRef.current = false
        }
      }
    },
    [getOptionLabel, getOptionValue, loadOptions, maybePrefetchIfShortList, mergeUnique, resetPrefetchTracking, value],
  )

  // Initial / open / reloadKey: load page 1 (empty search)
  useEffect(() => {
    const reloadKeyChanged = prevReloadKeyRef.current !== reloadKey
    prevReloadKeyRef.current = reloadKey

    if (reloadKeyChanged) {
      setItems([])
      itemsRef.current = []
      setDisplayItems([])
      setPage(1)
      pageRef.current = 1
      setHasMore(false)
      hasMoreRef.current = false
      setApiSearchActive(false)
      apiSearchActiveRef.current = false
      lastApiQRef.current = ""
      setSearchValue("")
      setDebouncedQ("")
      resetPrefetchTracking()
    }

    if (!open && !prefetch) return

    if (!open && prefetch) {
      if (!reloadKey && reloadKey !== 0) return
      if (reloadKeyChanged || itemsRef.current.length === 0) {
        runLoad("", 1, { append: false })
      }
      return
    }

    if (open && (reloadKeyChanged || itemsRef.current.length === 0)) {
      resetPrefetchTracking()
      runLoad("", 1, { append: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefetch, reloadKey])

  // Debounced search: local-first, then API if no local hits
  useEffect(() => {
    const q = debouncedQ
    if (!q) {
      setApiSearchActive(false)
      setDisplayItems(itemsRef.current)
      if (skipSearchReloadRef.current) {
        skipSearchReloadRef.current = false
        lastApiQRef.current = ""
        return
      }
      // Reload base list only when clearing search while dropdown is still open
      if ((apiSearchActiveRef.current || lastApiQRef.current) && openRef.current) {
        runLoad("", 1, { append: false })
      }
      lastApiQRef.current = ""
      return
    }

    const localHits = filterLocal(itemsRef.current, q)
    if (localHits.length > 0) {
      setApiSearchActive(false)
      setDisplayItems(localHits)
      return
    }

    // No local match → API search (replace list)
    setApiSearchActive(true)
    runLoad(q, 1, { append: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ])

  // Keep display in sync when items change (API append / replace)
  useEffect(() => {
    if (!debouncedQ) {
      setDisplayItems(items)
      return
    }
    if (apiSearchActive) {
      setDisplayItems(items)
      return
    }
    setDisplayItems(filterLocal(items, debouncedQ))
  }, [items, debouncedQ, apiSearchActive, filterLocal])

  const tryLoadMore = useCallback(() => {
    if (
      !hasMoreRef.current ||
      loadingRef.current ||
      loadingMoreRef.current ||
      loadMoreLockRef.current ||
      paginationInFlightRef.current
    ) {
      return
    }

    paginationInFlightRef.current = true
    loadMoreLockRef.current = true
    const searchForApi = apiSearchActiveRef.current ? debouncedQRef.current : ""
    runLoad(searchForApi, pageRef.current + 1, { append: true }).finally(() => {
      paginationInFlightRef.current = false
    })
  }, [paginationInFlightRef, runLoad])

  useEffect(() => {
    tryLoadMoreRef.current = tryLoadMore
  }, [tryLoadMore])

  // Reliable load-more: when sentinel enters viewport (scroll near bottom)
  useEffect(() => {
    if (!open || !hasMore || loading || loadingMore) return
    const sentinel = loadMoreSentinelRef.current
    const root = scrollContainerRef.current
    if (!sentinel || !root || typeof IntersectionObserver === "undefined") return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          tryLoadMoreRef.current?.()
        }
      },
      { root, rootMargin: "120px", threshold: 0 },
    )
    observer.observe(sentinel)
    // If already at bottom (or short list), kick once after paint
    requestAnimationFrame(() => {
      if (!hasMoreRef.current || loadingRef.current || loadingMoreRef.current) return
      const ratio = (root.scrollTop + root.clientHeight) / Math.max(root.scrollHeight, 1)
      if (ratio >= 0.72) tryLoadMoreRef.current?.()
    })
    return () => observer.disconnect()
  }, [open, hasMore, loading, loadingMore, displayItems.length, listElVersion, scrollContainerRef])

  const handleSelect = (optValue, item) => {
    if (!optValue) {
      selectedCacheRef.current = null
      setSelectedLabel("")
      onValueChange?.("", null)
      skipSearchReloadRef.current = true
      apiSearchActiveRef.current = false
      lastApiQRef.current = ""
      setApiSearchActive(false)
      setOpen(false)
      setSearchValue("")
      return
    }
    selectedCacheRef.current = item
    setSelectedLabel(getOptionLabel(item))
    onValueChange?.(optValue, item)
    skipSearchReloadRef.current = true
    apiSearchActiveRef.current = false
    lastApiQRef.current = ""
    setApiSearchActive(false)
    setOpen(false)
    setSearchValue("")
  }

  const triggerText = value
    ? selectedLabel ||
      (selectedCacheRef.current ? getOptionLabel(selectedCacheRef.current) : "") ||
      ""
    : emptyOptionLabel || ""

  const listForRender = (() => {
    const list = [...displayItems]
    const sel = selectedCacheRef.current
    if (value && sel && String(getOptionValue(sel)) === String(value)) {
      if (!list.some((it) => String(getOptionValue(it)) === String(value))) {
        list.unshift(sel)
      }
    }
    return list
  })()

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <label className="text-sm font-medium text-slate-700">
          {label} {required ? <span className="text-red-500">*</span> : null}
        </label>
      ) : null}
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (disabled) return
          setOpen(next)
          if (next) setSearchValue("")
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-expanded={open}
            className={cn(
              compact
                ? cn(
                    // Match project SelectTrigger (rounded-xl, border-2, indigo open/focus ring)
                    "flex h-8 min-h-8 w-full items-center justify-between gap-2 rounded-xl border-2 border-slate-200 bg-white px-3 text-xs text-slate-900 shadow-xs outline-none transition-all",
                    "focus-visible:border-indigo-500 focus-visible:ring-4 focus-visible:ring-indigo-100",
                    open && "border-indigo-500 bg-white ring-4 ring-indigo-100",
                  )
                : "flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition duration-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100",
              showRequiredError && required && !value && "border-red-200 bg-red-50/40 ring-1 ring-red-100",
              disabled && "cursor-not-allowed opacity-60",
              triggerClassName,
            )}
          >
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-left",
                triggerText ? "text-slate-800" : "text-slate-400",
              )}
            >
              {triggerText || placeholder}
            </span>
            <ChevronDown className="size-4 shrink-0 text-slate-500 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={compact ? 4 : 6}
          className={cn(
            // Width must match trigger — do not force min-w-[280px] (breaks compact 250px designer row)
            "z-[260] w-[var(--radix-popover-trigger-width)] min-w-[var(--radix-popover-trigger-width)] overflow-hidden bg-white p-0",
            compact
              ? "rounded-xl border-2 border-slate-200 shadow-xl"
              : "rounded-xl border-2 border-slate-200 shadow-xl",
            contentClassName,
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="bg-white">
            <div className={cn("sticky top-0 z-10 border-b border-slate-200 bg-white", compact ? "p-2" : "p-2")}>
              <div className="relative">
                <Search
                  className={cn(
                    "pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400",
                    compact ? "h-3.5 w-3.5" : "h-4 w-4",
                  )}
                />
                <Input
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder={searchPlaceholder}
                  className={cn(
                    "border border-slate-200 bg-white pl-8 pr-8",
                    compact
                      ? "h-8 rounded-xl text-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      : "h-9 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100",
                  )}
                  onKeyDown={(e) => e.stopPropagation()}
                  autoFocus
                />
                {searchValue ? (
                  <MacTooltip title="Clear search" side="top">
                    <button
                      type="button"
                      onClick={() => setSearchValue("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                      aria-label="Clear search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </MacTooltip>
                ) : null}
              </div>
            </div>
            <div
              ref={bindListRef}
              className={cn(
                "overflow-y-auto overscroll-contain",
                compact ? "max-h-[280px] py-1" : "max-h-60",
              )}
              onScroll={handleScroll}
              role="listbox"
            >
              {loading ? (
                <div
                  className={cn(
                    "flex items-center justify-center gap-2 text-slate-500",
                    compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm",
                  )}
                >
                  <Loader2 className={cn("animate-spin", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
                  Loading…
                </div>
              ) : error ? (
                <div
                  className={cn(
                    "font-medium text-red-600",
                    compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm",
                  )}
                >
                  {error}
                </div>
              ) : listForRender.length === 0 && !emptyOptionLabel ? (
                <div className={cn("text-slate-500", compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm")}>
                  {emptyMessage}
                </div>
              ) : (
                <>
                  {emptyOptionLabel ? (
                    <button
                      type="button"
                      role="option"
                      aria-selected={!value}
                      onClick={() => handleSelect("", null)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 text-left transition-colors",
                        compact
                          ? cn(
                              "px-3 py-1.5 text-xs",
                              !value ? "bg-indigo-50 text-slate-900" : "text-slate-900 hover:bg-indigo-50",
                            )
                          : cn(
                              "px-4 py-2 text-sm font-medium",
                              !value ? "bg-blue-100 text-slate-900" : "text-slate-900 hover:bg-blue-50",
                            ),
                      )}
                    >
                      {emptyOptionLabel}
                    </button>
                  ) : null}
                  {listForRender.length === 0 ? (
                    <div className={cn("text-slate-500", compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm")}>
                      {emptyMessage}
                    </div>
                  ) : (
                listForRender.map((item, idx) => {
                  const optValue = String(getOptionValue(item) ?? "")
                  if (!optValue) return null
                  const isActive = String(value ?? "") === optValue
                  return (
                    <button
                      key={`${optValue}__${idx}`}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onClick={() => handleSelect(optValue, item)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 text-left transition-colors",
                        compact
                          ? cn(
                              "px-3 py-1.5 text-xs",
                              isActive ? "bg-indigo-50 text-slate-900" : "text-slate-900 hover:bg-indigo-50",
                            )
                          : cn(
                              "px-4 py-2 text-sm",
                              isActive ? "bg-blue-100 text-slate-900" : "text-slate-900 hover:bg-blue-50",
                            ),
                      )}
                    >
                      <span
                        className={cn(
                          "whitespace-normal break-words leading-snug",
                          !compact && "font-medium",
                        )}
                      >
                        {getOptionLabel(item)}
                      </span>
                      <Check
                        className={cn(
                          "shrink-0",
                          compact ? "h-3.5 w-3.5 text-indigo-600" : "h-4 w-4 text-blue-600",
                          isActive ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </button>
                  )
                })
                  )}
                </>
              )}
              {loadingMore ? (
                <div className="flex items-center justify-center gap-2 px-3 py-2 text-xs text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading more…
                </div>
              ) : null}
              {!loading && !error && hasMore ? (
                <div ref={loadMoreSentinelRef} className="h-4 w-full shrink-0" aria-hidden />
              ) : null}
              {!loading && !error && hasMore && !loadingMore && hasMoreMessage ? (
                <div className="border-t border-slate-100 bg-white px-3 py-2 text-center text-[11px] text-slate-500">
                  {hasMoreMessage}
                </div>
              ) : null}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {showRequiredError && required && !value ? (
        <p className="text-xs font-medium text-red-600">{requiredErrorMessage}</p>
      ) : null}
    </div>
  )
}
