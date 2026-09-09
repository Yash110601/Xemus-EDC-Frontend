"use client"

import { useCallback, useEffect, useRef } from "react"
import {
  createRafThrottledScrollHandler,
  PAGED_SCROLL_SHORT_LIST_RATIO,
  resetPagedScrollPrefetchTracking,
  shouldTriggerPagedScrollPrefetch,
} from "@/lib/utils/pagedScrollPrefetch"

/**
 * Shared scroll prefetch for paged lists (sidebar, AsyncLookupSelect, etc.).
 * Uses a ref for the prefetch callback so scroll handlers never go stale.
 */
export function usePagedScrollPrefetch({ onPrefetch, enabled = true } = {}) {
  const scrollContainerRef = useRef(null)
  const lastPrefetchScrollTopRef = useRef(-1)
  const paginationInFlightRef = useRef(false)
  const onPrefetchRef = useRef(onPrefetch)
  const enabledRef = useRef(enabled)
  const scrollHandlerRef = useRef(null)

  useEffect(() => {
    onPrefetchRef.current = onPrefetch
  }, [onPrefetch])

  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  if (!scrollHandlerRef.current) {
    scrollHandlerRef.current = createRafThrottledScrollHandler(() => {
      if (!enabledRef.current) return
      const el = scrollContainerRef.current
      if (!el || !shouldTriggerPagedScrollPrefetch(el, lastPrefetchScrollTopRef.current)) return
      const scrollTop = el.scrollTop
      lastPrefetchScrollTopRef.current = scrollTop
      onPrefetchRef.current?.({ scrollTop, element: el })
    })
  }

  const handleScroll = useCallback((e) => {
    scrollContainerRef.current = e?.currentTarget ?? scrollContainerRef.current
    scrollHandlerRef.current?.()
  }, [])

  const resetPrefetchTracking = useCallback(() => {
    resetPagedScrollPrefetchTracking(lastPrefetchScrollTopRef, paginationInFlightRef)
  }, [])

  const maybePrefetchIfShortList = useCallback((hasMore) => {
    if (!hasMore) return
    requestAnimationFrame(() => {
      const el = scrollContainerRef.current
      if (!el) return
      const ratio = (el.scrollTop + el.clientHeight) / Math.max(el.scrollHeight, 1)
      if (ratio >= PAGED_SCROLL_SHORT_LIST_RATIO) {
        lastPrefetchScrollTopRef.current = -1
        scrollHandlerRef.current?.()
      }
    })
  }, [])

  useEffect(() => {
    return () => scrollHandlerRef.current?.cancel?.()
  }, [])

  return {
    scrollContainerRef,
    lastPrefetchScrollTopRef,
    paginationInFlightRef,
    handleScroll,
    resetPrefetchTracking,
    maybePrefetchIfShortList,
  }
}
