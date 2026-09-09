'use client'

import * as React from 'react'
import { Calendar as CalendarIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'

type DatePickerProps = {
  value?: string | null
  onChange?: (value: string | null) => void
  placeholder?: string
  disabled?: boolean
  minDate?: string
  maxDate?: string
  className?: string
  disableFuture?: boolean
}

function formatDisplay(value?: string | null) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}-${month}-${year}`
}

function toLocalDateString(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateInputAsLocal(value?: string | null) {
  if (!value) return null
  const raw = String(value).trim()
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const year = Number(isoMatch[1])
    const month = Number(isoMatch[2])
    const day = Number(isoMatch[3])
    const d = new Date(year, month - 1, day)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

export default function DatePicker({
  value,
  onChange,
  placeholder = 'dd-mm-yyyy',
  disabled,
  minDate,
  maxDate,
  className,
  disableFuture = false,
}: DatePickerProps) {
  const today = React.useMemo(() => new Date(), [])
  const [open, setOpen] = React.useState(false)
  const lastMonthNavAtRef = React.useRef(0)

  const selectedDate = React.useMemo(() => {
    const d = parseDateInputAsLocal(value)
    return d ?? undefined
  }, [value])

  const displayMonth = React.useMemo(() => {
    if (selectedDate) return selectedDate
    return today
  }, [selectedDate, today])

  const minDateObj = React.useMemo(() => {
    return parseDateInputAsLocal(minDate)
  }, [minDate])

  const maxDateObj = React.useMemo(() => {
    return parseDateInputAsLocal(maxDate)
  }, [maxDate])

  // Keep year/month navigation fast (especially for DOB): allow direct dropdown jumps.
  const calendarStartMonth = React.useMemo(() => {
    if (minDateObj) return minDateObj
    return new Date(1900, 0, 1)
  }, [minDateObj])

  const calendarEndMonth = React.useMemo(() => {
    if (maxDateObj) return maxDateObj
    if (disableFuture) return today
    return new Date(today.getFullYear() + 10, 11, 31)
  }, [maxDateObj, disableFuture, today])

  const isDateDisabled = React.useCallback((date: Date) => {
    if (disableFuture && date > today) return true
    if (minDateObj && date < minDateObj) return true
    if (maxDateObj && date > maxDateObj) return true
    return false
  }, [disableFuture, today, minDateObj, maxDateObj])

  React.useEffect(() => {
    if (disabled && open) {
      setOpen(false)
    }
  }, [disabled, open])

  return (
    <Popover open={open} onOpenChange={(nextOpen) => {
      if (disabled) {
        setOpen(false)
        return
      }
      setOpen(nextOpen)
    }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'w-full min-w-0 flex items-center justify-between rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 transition-all outline-none focus-visible:border-emerald-500 focus-visible:ring-4 focus-visible:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-70',
            className,
          )}
        >
          <span className={cn("block min-w-0 truncate whitespace-nowrap", value ? '' : 'text-slate-400')}>
            {value ? formatDisplay(value) : placeholder}
          </span>
          <CalendarIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={8}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="z-[140] p-0 rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden data-[state=open]:animate-none data-[state=closed]:animate-none"
      >
        <div className="bg-white">
          <Calendar
            mode="single"
            selected={selectedDate}
            defaultMonth={displayMonth}
            captionLayout="dropdown"
            startMonth={calendarStartMonth}
            endMonth={calendarEndMonth}
            onMonthChange={() => {
              // Guard against incidental select events right after month/year navigation.
              lastMonthNavAtRef.current = Date.now()
            }}
            toDate={disableFuture ? today : undefined}
            disabled={isDateDisabled}
            onSelect={(date) => {
              if (disabled) return
              if (Date.now() - lastMonthNavAtRef.current < 120) return
              if (!onChange) return
              if (!date) {
                onChange(null)
                return
              }
              // Close immediately for snappy UX, then run upstream state updates
              // on next frame so heavy rule/validation work does not block the close.
              setOpen(false)
              const nextValue = toLocalDateString(date)
              if (typeof window !== 'undefined' && window.requestAnimationFrame) {
                window.requestAnimationFrame(() => onChange(nextValue))
              } else {
                onChange(nextValue)
              }
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

