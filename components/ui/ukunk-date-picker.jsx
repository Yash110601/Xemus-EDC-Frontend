"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, X } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  isUkUnkPartsWithinBounds,
  isUkUnkValueWithinBounds,
  isUkUnkYearWithinBounds,
  parseYearFromDateLike,
} from "@/lib/utils/ukUnkDateCompare"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import SearchableSelect from "@/components/ui/searchable-select"

const UK_UNK_MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

const normalizeMonth = (raw) => {
  const token = String(raw || "").trim().toUpperCase()
  if (!token) return ""
  if (token === "UNK") return "UNK"
  if (UK_UNK_MONTHS.includes(token)) return token
  const n = Number.parseInt(token, 10)
  if (Number.isFinite(n) && n >= 1 && n <= 12) return UK_UNK_MONTHS[n - 1]
  return token
}

const parseUkUnkDate = (value) => {
  const text = String(value || "").trim()
  if (!text) return { day: "", month: "", year: "" }
  const [day = "", month = "", year = ""] = text.split("-")
  return {
    day: String(day || "").trim().toUpperCase(),
    month: normalizeMonth(month),
    year: String(year || "").trim().toUpperCase(),
  }
}

const buildUkUnkDate = (day, month, year) => {
  const d = String(day || "").trim().toUpperCase()
  const m = normalizeMonth(month)
  const y = String(year || "").trim().toUpperCase()
  if (!d && !m && !y) return ""
  return `${d}-${m}-${y}`
}

/** Same completeness rules as `formValidation.js` — all three parts from allowed tokens. */
const isUkUnkTripleComplete = (parts) => {
  const day = String(parts?.day || "").trim()
  const month = String(parts?.month || "").trim()
  const year = String(parts?.year || "").trim()
  if (!day || !month || !year) return false
  const normalizedDay = day.toUpperCase()
  const normalizedMonth = month.toUpperCase()
  const dayValid =
    normalizedDay === "UK" || (/^\d+$/.test(day) && Number(day) >= 1 && Number(day) <= 31)
  const monthValid =
    normalizedMonth === "UNK" ||
    UK_UNK_MONTHS.includes(normalizedMonth)
  const yearValid = /^\d{4}$/.test(year)
  return dayValid && monthValid && yearValid
}

export default function UkUnkDatePicker({
  value = "",
  onChange,
  disabled = false,
  minDate,
  maxDate,
  className = "",
  compact = false,
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(() => parseUkUnkDate(value))
  const draftRef = useRef(draft)

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  useEffect(() => {
    if (open) return
    const next = parseUkUnkDate(value)
    draftRef.current = next
    setDraft(next)
  }, [value, open])

  // When source field changes min/max, clear stored value if it is now out of range (same as Date Picker flow).
  useEffect(() => {
    if (!value || disabled) return
    if (isUkUnkValueWithinBounds(value, minDate, maxDate)) return
    onChange?.("")
    const empty = { day: "", month: "", year: "" }
    draftRef.current = empty
    setDraft(empty)
  }, [value, minDate, maxDate, disabled, onChange])

  const hasBounds = Boolean(minDate || maxDate)

  const nowYear = new Date().getFullYear()
  const minYear = parseYearFromDateLike(minDate) ?? nowYear - 120
  const maxYear = parseYearFromDateLike(maxDate) ?? nowYear
  const safeMinYear = Math.min(minYear, maxYear)
  const safeMaxYear = Math.max(minYear, maxYear)
  const cappedMaxYear = Math.min(safeMaxYear, nowYear)
  const cappedMinYear = Math.min(safeMinYear, cappedMaxYear)

  const allDayOptions = useMemo(
    () => [...Array.from({ length: 31 }, (_, i) => String(i + 1)), "UK"],
    [],
  )
  const allMonthOptions = useMemo(() => [...UK_UNK_MONTHS, "UNK"], [])

  const yearOptions = useMemo(() => {
    const candidates = []
    for (let y = cappedMaxYear; y >= cappedMinYear; y -= 1) candidates.push(String(y))
    const py = draft.year
    if (py && /^\d{4}$/.test(py) && Number(py) > cappedMaxYear && !candidates.includes(py)) {
      candidates.unshift(py)
    }
    if (!hasBounds) return candidates
    return candidates.filter((y) => isUkUnkYearWithinBounds(y, minDate, maxDate))
  }, [cappedMinYear, cappedMaxYear, draft.year, hasBounds, minDate, maxDate])

  const monthOptions = useMemo(() => {
    if (!hasBounds || !draft.year) return allMonthOptions
    return allMonthOptions.filter((m) =>
      isUkUnkPartsWithinBounds(draft.day, m, draft.year, minDate, maxDate),
    )
  }, [allMonthOptions, draft.day, draft.year, hasBounds, minDate, maxDate])

  const dayOptions = useMemo(() => {
    if (!hasBounds || !draft.year) return allDayOptions
    return allDayOptions.filter((d) =>
      isUkUnkPartsWithinBounds(d, draft.month, draft.year, minDate, maxDate),
    )
  }, [allDayOptions, draft.month, draft.year, hasBounds, minDate, maxDate])

  // Drop day/month/year selections that became invalid after min/max or parent field changed.
  useEffect(() => {
    let next = { ...draftRef.current }
    let changed = false
    if (next.year && yearOptions.length > 0 && !yearOptions.includes(next.year)) {
      next = { day: "", month: "", year: "" }
      changed = true
    } else if (next.month && monthOptions.length > 0 && !monthOptions.includes(next.month)) {
      next = { ...next, month: "", day: "" }
      changed = true
    } else if (next.day && dayOptions.length > 0 && !dayOptions.includes(next.day)) {
      next = { ...next, day: "" }
      changed = true
    }
    if (!changed) return
    draftRef.current = next
    setDraft(next)
    if (isUkUnkTripleComplete(next)) {
      const built = buildUkUnkDate(next.day, next.month, next.year)
      if (!isUkUnkValueWithinBounds(built, minDate, maxDate)) onChange?.("")
    } else if (String(value || "").trim()) {
      onChange?.("")
    }
  }, [yearOptions, monthOptions, dayOptions, minDate, maxDate, value, onChange])

  const commitIfValid = (nextDraft) => {
    if (!isUkUnkTripleComplete(nextDraft)) return
    const built = buildUkUnkDate(nextDraft.day, nextDraft.month, nextDraft.year)
    if (!isUkUnkValueWithinBounds(built, minDate, maxDate)) return
    onChange?.(built)
  }

  const normalizeDraftWithinBounds = (draftParts, changedPart) => {
    let next = { ...draftParts }
    if (!hasBounds) return next
    if (isUkUnkPartsWithinBounds(next.day, next.month, next.year, minDate, maxDate)) return next
    if (changedPart === "year" || changedPart === "month") {
      next = { ...next, day: "" }
      if (isUkUnkPartsWithinBounds(next.day, next.month, next.year, minDate, maxDate)) return next
      if (changedPart === "year") {
        next = { ...next, month: "" }
        if (isUkUnkPartsWithinBounds(next.day, next.month, next.year, minDate, maxDate)) return next
      }
    }
    return null
  }

  const updatePart = (part, nextValue) => {
    const cur = draftRef.current
    const rawDraft = {
      day: part === "day" ? nextValue : cur.day,
      month: part === "month" ? nextValue : cur.month,
      year: part === "year" ? nextValue : cur.year,
    }
    const nextDraft = normalizeDraftWithinBounds(rawDraft, part)
    if (!nextDraft) return
    draftRef.current = nextDraft
    setDraft(nextDraft)
    commitIfValid(nextDraft)
  }

  const handleOpenChange = (next) => {
    if (next) {
      const initial = parseUkUnkDate(value)
      draftRef.current = initial
      setDraft(initial)
      setOpen(true)
      return
    }
    const d = draftRef.current
    if (isUkUnkTripleComplete(d)) {
      const built = buildUkUnkDate(d.day, d.month, d.year)
      if (!isUkUnkValueWithinBounds(built, minDate, maxDate)) {
        onChange?.("")
        const empty = { day: "", month: "", year: "" }
        draftRef.current = empty
        setDraft(empty)
      } else if (built !== String(value ?? "").trim()) {
        onChange?.(built)
      }
    } else {
      const prev = parseUkUnkDate(value)
      if (isUkUnkTripleComplete(prev)) {
        const prevBuilt = buildUkUnkDate(prev.day, prev.month, prev.year)
        if (isUkUnkValueWithinBounds(prevBuilt, minDate, maxDate)) {
          onChange?.(prevBuilt)
          draftRef.current = prev
          setDraft(prev)
        } else {
          onChange?.("")
          const empty = { day: "", month: "", year: "" }
          draftRef.current = empty
          setDraft(empty)
        }
      } else {
        onChange?.("")
        const empty = { day: "", month: "", year: "" }
        draftRef.current = empty
        setDraft(empty)
      }
    }
    setOpen(false)
  }

  const placeholderLabel = compact ? "DD-MMM-YYYY" : "Day-Month-Year"
  const triggerLabel = useMemo(() => {
    if (!open) {
      return value ? String(value) : placeholderLabel
    }
    if (isUkUnkTripleComplete(draft)) {
      return buildUkUnkDate(draft.day, draft.month, draft.year)
    }
    return placeholderLabel
  }, [open, value, draft, placeholderLabel])

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          title={triggerLabel !== placeholderLabel ? triggerLabel : undefined}
          className={cn(
            "w-full inline-flex items-center justify-between rounded-md border border-slate-300 bg-white px-2 py-2 text-left text-xs sm:text-sm shadow-none focus:outline-none focus:ring-1 focus:ring-emerald-200 focus:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-75",
            className,
          )}
        >
          <span className={cn("truncate", triggerLabel !== placeholderLabel ? "text-slate-800" : "text-slate-400")}>
            {triggerLabel}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className={cn(
          "z-[260] rounded-xl border border-slate-200 bg-white p-3 shadow-lg",
          compact ? "w-[300px]" : "w-[330px]",
        )}
      >
        <div className="mb-2 flex items-center justify-end">
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close UK/UNK picker"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className={cn("grid grid-cols-3 items-stretch", compact ? "gap-1" : "gap-2")}>
          <SearchableSelect
            openGroup="ukunk-popup-parts"
            value={draft.day || ""}
            onChange={(next) => updatePart("day", next)}
            placeholder="DD"
            showSearch={false}
            includeEmptyOption={false}
            disabled={disabled}
            contentClassName="!min-w-[130px] !w-[var(--radix-popover-trigger-width)] !rounded-lg"
            className={cn(
              "w-full rounded-md border border-slate-300 bg-white px-2 focus:ring-1 focus:ring-emerald-200 focus:border-emerald-400",
              compact ? "h-8 text-xs" : "h-8.5 text-sm",
            )}
            options={dayOptions.map((d) => ({ value: d, label: d }))}
          />
          <SearchableSelect
            openGroup="ukunk-popup-parts"
            value={draft.month || ""}
            onChange={(next) => updatePart("month", next)}
            placeholder="MMM"
            showSearch={false}
            includeEmptyOption={false}
            disabled={disabled}
            contentClassName="!min-w-[130px] !w-[var(--radix-popover-trigger-width)] !rounded-lg"
            className={cn(
              "w-full rounded-md border border-slate-300 bg-white px-2 focus:ring-1 focus:ring-emerald-200 focus:border-emerald-400",
              compact ? "h-8 text-xs" : "h-8.5 text-sm",
            )}
            options={monthOptions.map((m) => ({ value: m, label: m }))}
          />
          <SearchableSelect
            openGroup="ukunk-popup-parts"
            value={draft.year || ""}
            onChange={(next) => updatePart("year", next)}
            placeholder="YYYY"
            showSearch={false}
            includeEmptyOption={false}
            disabled={disabled}
            contentClassName="!min-w-[130px] !w-[var(--radix-popover-trigger-width)] !rounded-lg"
            className={cn(
              "w-full rounded-md border border-slate-300 bg-white px-2 focus:ring-1 focus:ring-emerald-200 focus:border-emerald-400",
              compact ? "h-8 text-xs" : "h-8.5 text-sm",
            )}
            options={yearOptions.map((y) => ({ value: y, label: y }))}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
