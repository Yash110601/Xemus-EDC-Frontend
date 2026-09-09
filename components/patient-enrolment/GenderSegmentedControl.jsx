"use client"

import { cn } from "@/lib/utils"

const GENDER_OPTIONS = [
  { value: "Male", label: "Male", symbol: "♂" },
  { value: "Female", label: "Female", symbol: "♀" },
]

const SELECTED_CLASS =
  "border-emerald-500/70 bg-emerald-50/95 text-emerald-900 shadow-sm shadow-emerald-900/5 ring-2 ring-emerald-500/20"
const UNSELECTED_CLASS =
  "border-slate-200/90 bg-white/90 text-slate-600 hover:border-emerald-200/80 hover:bg-emerald-50/30"

export default function GenderSegmentedControl({
  name,
  value,
  onChange,
  error,
  className,
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div
        role="radiogroup"
        aria-label="Gender"
        aria-invalid={error ? true : undefined}
        className="grid grid-cols-2 gap-2 sm:gap-3"
      >
        {GENDER_OPTIONS.map((option) => {
          const selected = value === option.value
          return (
            <label
              key={option.value}
              className={cn(
                "relative flex min-h-[3rem] cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all duration-200",
                selected ? SELECTED_CLASS : UNSELECTED_CLASS,
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  selected ? "border-emerald-600" : "border-slate-300",
                )}
                aria-hidden
              >
                {selected ? <span className="h-2 w-2 rounded-full bg-emerald-600" /> : null}
              </span>
              <span className="text-[1.05rem] leading-none text-slate-500" aria-hidden>
                {option.symbol}
              </span>
              <span>{option.label}</span>
            </label>
          )
        })}
      </div>
      {error ? (
        <p className="flex items-center gap-1 text-xs text-amber-800">
          <span aria-hidden>⚠</span>
          {error}
        </p>
      ) : null}
    </div>
  )
}
