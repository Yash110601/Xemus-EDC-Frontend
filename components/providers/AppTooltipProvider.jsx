"use client"

import { TooltipProvider, TOOLTIP_DELAY_MS } from "@/components/ui/tooltip"

/**
 * App-wide tooltip provider — mount once in root layout.
 * All tooltips share the same Mac glass style via `MacTooltip` / `TooltipContent`.
 */
export default function AppTooltipProvider({ children }) {
  return (
    <TooltipProvider delayDuration={TOOLTIP_DELAY_MS} skipDelayDuration={0}>
      {children}
    </TooltipProvider>
  )
}
