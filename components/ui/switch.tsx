'use client'

import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'

import { cn } from '@/lib/utils'

/**
 * iOS / admin-table style toggle: bright blue when on, light gray track when off,
 * white thumb with clear separation (readable on white table cells app-wide).
 */
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-slate-300/90 bg-slate-200 shadow-inner transition-colors outline-none',
        'data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:shadow-none',
        'data-[state=unchecked]:border-slate-300 data-[state=unchecked]:bg-slate-200',
        'dark:border-slate-500 dark:bg-slate-600 dark:data-[state=checked]:border-blue-500 dark:data-[state=checked]:bg-blue-500 dark:data-[state=unchecked]:bg-slate-600',
        'focus-visible:ring-[3px] focus-visible:ring-blue-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none block size-5 shrink-0 rounded-full bg-white shadow-md ring-0 transition-transform',
          'data-[state=unchecked]:translate-x-[3px]',
          /* w-12 (48px) track, 20px thumb, ~3px end padding */
          'data-[state=checked]:translate-x-[22px]',
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
