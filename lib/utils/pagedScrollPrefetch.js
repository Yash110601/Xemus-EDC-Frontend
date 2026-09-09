/**
 * Shared infinite-scroll prefetch rules for paged dropdowns / sidebars.
 * One page per user scroll gesture — no chained parallel API calls.
 */

export const PAGED_SCROLL_PREFETCH_RATIO = 0.72
export const PAGED_SCROLL_MIN_DELTA_PX = 48
/** When list is shorter than viewport, allow sequential fill without scroll delta. */
export const PAGED_SCROLL_SHORT_LIST_RATIO = 0.98

/**
 * @param {HTMLElement | null | undefined} el
 * @param {number} lastPrefetchScrollTop -1 on fresh list
 */
export function shouldTriggerPagedScrollPrefetch(el, lastPrefetchScrollTop = -1) {
  if (!el) return false
  const scrollTop = el.scrollTop
  const ratio = (scrollTop + el.clientHeight) / Math.max(el.scrollHeight, 1)
  if (ratio < PAGED_SCROLL_PREFETCH_RATIO) return false

  const listFillsViewport = ratio < PAGED_SCROLL_SHORT_LIST_RATIO
  if (
    listFillsViewport &&
    lastPrefetchScrollTop >= 0 &&
    scrollTop < lastPrefetchScrollTop + PAGED_SCROLL_MIN_DELTA_PX
  ) {
    return false
  }
  return true
}

/** RAF-throttled scroll handler — returns cleanup for unmount. */
export function createRafThrottledScrollHandler(onScroll) {
  let rafId = null
  const handler = () => {
    if (rafId) return
    rafId = requestAnimationFrame(() => {
      rafId = null
      onScroll()
    })
  }
  handler.cancel = () => {
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }
  return handler
}

export function resetPagedScrollPrefetchTracking(lastPrefetchScrollTopRef, paginationInFlightRef) {
  if (lastPrefetchScrollTopRef) lastPrefetchScrollTopRef.current = -1
  if (paginationInFlightRef) paginationInFlightRef.current = false
}
