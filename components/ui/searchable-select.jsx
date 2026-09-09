"use client"

import { useEffect, useId, useMemo, useState } from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

export default function SearchableSelect({
  value,
  options = [],
  onChange,
  onValueChange,
  placeholder = "Select...",
  disabled = false,
  className = "",
  showSearch = false,
  /** When `showSearch`, where to place the search glyph (`end` = project standard with chevron-right triggers). */
  searchIconPosition = "start",
  contentClassName = "",
  showChevron = true,
  openGroup = "",
  includeEmptyOption = true,
  /** Optional: custom label (e.g. UK/UNK icons in UK-UNK date picker). */
  renderOptionLabel,
  commandListClassName = "",
}) {
  const instanceId = useId()
  const lockEventName = "searchable-select:lock-open"
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const normalizedValue = String(value ?? "")
  const renderedOptions = useMemo(() => {
    if (!includeEmptyOption) return options
    const hasEmpty = options.some((opt) => String(opt?.value ?? "") === "")
    if (hasEmpty) return options
    return [{ value: "", label: placeholder }, ...options]
  }, [options, placeholder, includeEmptyOption])
  const selected = useMemo(
    () => renderedOptions.find((opt) => String(opt?.value ?? "") === normalizedValue),
    [renderedOptions, normalizedValue]
  )
  const filteredOptions = useMemo(() => {
    const q = String(searchQuery || "").trim().toLowerCase()
    if (!showSearch || !q) return renderedOptions
    return renderedOptions.filter((opt) => {
      const label = String(opt?.label ?? "").toLowerCase()
      const val = String(opt?.value ?? "").toLowerCase()
      return label.includes(q) || val.includes(q)
    })
  }, [renderedOptions, searchQuery, showSearch])

  useEffect(() => {
    if (!openGroup || typeof window === "undefined") return undefined
    const handleOpenLock = (event) => {
      const detail = event?.detail || {}
      if (detail.group !== openGroup) return
      if (detail.instanceId === instanceId) return
      setOpen(false)
    }
    window.addEventListener(lockEventName, handleOpenLock)
    return () => window.removeEventListener(lockEventName, handleOpenLock)
  }, [instanceId, openGroup])

  const formatLabel = (opt) => {
    if (!opt) return null
    if (typeof renderOptionLabel === "function") return renderOptionLabel(opt)
    return opt?.label ?? String(opt?.value ?? "")
  }

  const handleOpenChange = (nextOpen) => {
    if (disabled) return
    if (nextOpen && openGroup && typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(lockEventName, {
          detail: { group: openGroup, instanceId },
        }),
      )
    }
    if (!nextOpen) setSearchQuery("")
    setOpen(nextOpen)
  }

  const handleChange = onChange ?? onValueChange

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "w-full inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm shadow-[0_4px_14px_-10px_rgba(15,23,42,0.28)] transition-all focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-75",
            showChevron ? "justify-between" : "justify-start",
            className
          )}
          aria-expanded={open}
        >
          <span className={cn("min-w-0 flex-1 truncate text-left", selected ? "text-slate-800" : "text-slate-400")}>
            {selected ? formatLabel(selected) : placeholder}
          </span>
          {showChevron && <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-500" />}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        onWheelCapture={(event) => event.stopPropagation()}
        onTouchMoveCapture={(event) => event.stopPropagation()}
        className={cn(
          "z-[260] flex max-h-[min(70vh,480px)] min-w-[220px] w-[var(--radix-popover-trigger-width)] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 p-0 shadow-[0_18px_48px_-22px_rgba(15,23,42,0.45)] backdrop-blur-xl",
          contentClassName,
        )}
      >
        <Command
          className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent"
          shouldFilter={false}
        >
          {showSearch && (
            <div className="relative shrink-0 border-b border-slate-100">
              <CommandInput
                placeholder="Search option..."
                className="h-9 text-sm pr-8"
                iconPosition={searchIconPosition}
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label="Clear search"
                  title="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          )}
          <CommandList
            className={cn(
              "min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain scroll-smooth p-1",
              commandListClassName,
            )}
            onWheel={(event) => event.stopPropagation()}
          >
            {filteredOptions.length === 0 ? (
              <CommandEmpty className="py-6 text-xs text-slate-500">No option found.</CommandEmpty>
            ) : null}
            {filteredOptions.map((opt, idx) => {
              const optVal = String(opt?.value ?? "")
              if (opt.groupHeader) {
                return (
                  <div
                    key={`group-${optVal}-${idx}`}
                    className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400"
                  >
                    {opt?.label ?? ""}
                  </div>
                )
              }
              if (opt.disabled) {
                return (
                  <div
                    key={`disabled-${optVal}-${idx}`}
                    className="px-2.5 py-2 text-xs italic text-slate-500"
                  >
                    {opt?.label ?? ""}
                  </div>
                )
              }
              const isActive = normalizedValue === optVal
              const optKey = `${optVal}__${String(opt?.label ?? "")}__${idx}`
              return (
                <CommandItem
                  key={optKey}
                  value={`${opt?.label ?? ""} ${optVal}`}
                  title={
                    typeof opt?.title === "string" && opt.title.trim()
                      ? opt.title.trim()
                      : optVal
                        ? String(optVal)
                        : undefined
                  }
                  onSelect={() => {
                    setOpen(false)
                    requestAnimationFrame(() => handleChange?.(optVal))
                  }}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-emerald-50/90 text-emerald-700"
                      : "data-[selected=true]:bg-slate-100 text-slate-700"
                  )}
                >
                  <span className="whitespace-normal break-words leading-snug text-left">
                    {formatLabel(opt)}
                  </span>
                  <Check className={cn("h-4 w-4 text-emerald-600", isActive ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              )
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

