"use client"

import { useVirtualizer } from "@tanstack/react-virtual"

/**
 * Phase 3c-1 — Scroll-linked virtualization for huge sections (replaces manual
 * `dataEntryControlRenderLimit` slice + "Load more" for sections with 160+ controls).
 */
export function useDataEntryControlVirtualizer({
  enabled,
  controlCount,
  scrollElementRef,
  estimateSize = 132,
  overscan = 6,
}) {
  const virtualizer = useVirtualizer({
    count: enabled ? controlCount : 0,
    getScrollElement: () => scrollElementRef?.current ?? null,
    estimateSize: () => estimateSize,
    overscan,
  })

  if (!enabled || controlCount === 0) {
    return {
      enabled: false,
      virtualizer: null,
      virtualItems: [],
      totalSize: 0,
    }
  }

  return {
    enabled: true,
    virtualizer,
    virtualItems: virtualizer.getVirtualItems(),
    totalSize: virtualizer.getTotalSize(),
  }
}
