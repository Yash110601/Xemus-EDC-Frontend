import * as React from 'react'
import { cn } from '@/lib/utils'

type LoadingDotsProps = React.HTMLAttributes<HTMLDivElement> & {
  size?: 'sm' | 'md'
}

export function LoadingDots({ className, size = 'md', ...props }: LoadingDotsProps) {
  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2'

  return (
    <div className={cn('inline-flex items-center gap-1', className)} {...props}>
      <span className={cn(dotSize, 'rounded-full bg-emerald-500 animate-bounce')} />
      <span
        className={cn(dotSize, 'rounded-full bg-emerald-500 animate-bounce')}
        style={{ animationDelay: '0.15s' }}
      />
      <span
        className={cn(dotSize, 'rounded-full bg-emerald-500 animate-bounce')}
        style={{ animationDelay: '0.3s' }}
      />
    </div>
  )
}

