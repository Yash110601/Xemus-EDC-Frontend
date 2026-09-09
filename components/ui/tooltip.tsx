'use client'

import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'

import { cn } from '@/lib/utils'

/** Default hover delay — macOS-like, not instant. */
export const TOOLTIP_DELAY_MS = 320

/** Shared glass tooltip surface used app-wide. */
export const MAC_TOOLTIP_CONTENT_CLASS =
  'z-[120] w-fit min-w-[8rem] max-w-[min(28rem,92vw)] rounded-xl border border-white/70 bg-white/90 px-3.5 py-2.5 text-xs text-slate-700 backdrop-blur-xl shadow-[0_12px_34px_-16px_rgba(15,23,42,0.42),inset_0_1px_0_rgba(255,255,255,0.85)] ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2'

function TooltipProvider({
  delayDuration = TOOLTIP_DELAY_MS,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

/** Root only — wrap app once with `TooltipProvider`. */
function Tooltip({
  delayDuration,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root> & {
  delayDuration?: number
}) {
  return (
    <TooltipPrimitive.Root
      data-slot="tooltip"
      delayDuration={delayDuration ?? TOOLTIP_DELAY_MS}
      {...props}
    />
  )
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 8,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(MAC_TOOLTIP_CONTENT_CLASS, className)}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

type MacTooltipProps = {
  title?: React.ReactNode
  description?: React.ReactNode
  hint?: React.ReactNode
  children: React.ReactNode
  side?: React.ComponentProps<typeof TooltipPrimitive.Content>['side']
  align?: React.ComponentProps<typeof TooltipPrimitive.Content>['align']
  delayDuration?: number
  sideOffset?: number
  contentClassName?: string
  asChild?: boolean
  disabled?: boolean
}

/**
 * Standard app tooltip — title + optional description + hint (User Manual style).
 * Use for icon buttons, header controls, and collapsed sidebar labels.
 */
function MacTooltip({
  title,
  description,
  hint,
  children,
  side = 'bottom',
  align = 'center',
  delayDuration,
  sideOffset = 8,
  contentClassName,
  asChild = true,
  disabled = false,
}: MacTooltipProps) {
  const hasContent = Boolean(title || description || hint)
  if (disabled || !hasContent) return children

  return (
    <Tooltip delayDuration={delayDuration}>
      <TooltipTrigger asChild={asChild}>{children}</TooltipTrigger>
      <TooltipContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        className={contentClassName}
      >
        {title ? (
          <p className="text-[12px] font-semibold leading-snug tracking-tight text-slate-900">
            {title}
          </p>
        ) : null}
        {description ? (
          <p className="mt-0.5 text-[11px] font-normal leading-snug text-slate-500 break-words">
            {description}
          </p>
        ) : null}
        {hint ? (
          <p className="mt-1.5 text-[10px] font-normal leading-snug text-slate-400">{hint}</p>
        ) : null}
      </TooltipContent>
    </Tooltip>
  )
}

type AppTooltipProps = {
  content: React.ReactNode
  children: React.ReactNode
  side?: React.ComponentProps<typeof TooltipPrimitive.Content>['side']
  align?: React.ComponentProps<typeof TooltipPrimitive.Content>['align']
  delayDuration?: number
  sideOffset?: number
  contentClassName?: string
  asChild?: boolean
  disabled?: boolean
}

/**
 * Single-line / truncation tooltip — same Mac surface, plain body text.
 */
function AppTooltip({
  content,
  children,
  side = 'top',
  align = 'start',
  delayDuration,
  sideOffset = 8,
  contentClassName,
  asChild = true,
  disabled = false,
}: AppTooltipProps) {
  if (disabled || content === null || content === undefined || content === '') {
    return children
  }

  return (
    <Tooltip delayDuration={delayDuration}>
      <TooltipTrigger asChild={asChild}>{children}</TooltipTrigger>
      <TooltipContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'whitespace-pre-wrap break-words text-[11px] font-normal leading-relaxed text-slate-800',
          contentClassName,
        )}
      >
        {content}
      </TooltipContent>
    </Tooltip>
  )
}

export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  MacTooltip,
  AppTooltip,
}
