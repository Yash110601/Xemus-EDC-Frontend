"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { searchTerminology } from "@/lib/services/terminologyCoding.service"
import {
  normalizeTerminologyCoding,
  splitTerminologyLabelAndCode,
  formatTerminologyLookupSelection,
} from "@/lib/utils/terminologyCoding"
import { cn } from "@/lib/utils"
import { ChevronDown, Loader2, Sparkles, X } from "lucide-react"
import { useStudyAiSettings } from "@/lib/intelligence/useStudyAiSettings"
import xemusAiService from "@/lib/services/xemusAi.service"

function mergeByUid(prev, next) {
  const seen = new Set(prev.map((r) => String(r.uid || r.code)))
  const out = [...prev]
  for (const r of next || []) {
    const k = String(r.uid || r.code)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(r)
  }
  return out
}

/**
 * Text field with dictionary lookup styled like a dropdown (M/W badge + chevron trigger).
 *
 * @param {object} props
 * @param {string} props.value
 * @param {(next: string) => void} props.onChange
 * @param {'meddra' | 'whodd' | string} props.coding
 * @param {boolean} [props.disabled]
 * @param {string} [props.placeholder]
 * @param {number} [props.maxLength]
 * @param {boolean} [props.hasError]
 * @param {boolean} [props.dense] — compact for table cells
 * @param {string} [props.inputClassName] — only used when terminology mode is off (plain text fallback)
 */
export default function TerminologyCodingInput({
  value,
  onChange,
  coding,
  disabled = false,
  placeholder = "",
  maxLength,
  hasError = false,
  dense = false,
  inputClassName = "",
}) {
  const mode = normalizeTerminologyCoding(coding)
  const badge = mode === "whodd" ? "W" : "M"
  const dictionaryTitle = mode === "whodd" ? "WHO‑DD" : "MedDRA"
  const minChars = mode === "whodd" ? 1 : 2
  const lookupAria =
    mode === "whodd"
      ? "Open WHO‑DD drug lookup. Search and select — preferred name and ATC or drug code fill this field as Name (code)."
      : "Open MedDRA indication lookup. Search and select — preferred term and MedDRA code fill this field as Name (code)."

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [results, setResults] = useState([])
  const [searchError, setSearchError] = useState("")
  const [meddraPaging, setMeddraPaging] = useState(null)
  const [fieldFocused, setFieldFocused] = useState(false)
  const searchFieldRef = useRef(null)
  const { isAiCodingAssistEnabled } = useStudyAiSettings()
  const [aiSuggestions, setAiSuggestions] = useState([])
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false)

  useEffect(() => {
    if (!open || !mode) return
    const t = requestAnimationFrame(() => {
      searchFieldRef.current?.focus()
    })
    return () => cancelAnimationFrame(t)
  }, [open, mode])

  useEffect(() => {
    if (!open || !mode) return
    const q = String(query || "").trim()
    let cancelled = false
    const t = setTimeout(() => {
      if (q.length < minChars) {
        if (!cancelled) {
          setResults([])
          setSearchError("")
          setLoading(false)
          setMeddraPaging(null)
        }
        return
      }
      setLoading(true)
      setSearchError("")
      setMeddraPaging(null)

      searchTerminology(q, mode, { pageNumber: 1, pageSize: 50 })
        .then((res) => {
          if (cancelled) return
          if (!res.ok) {
            setResults([])
            setSearchError(res.message || "Search failed")
            return
          }
          setResults(Array.isArray(res.items) ? res.items : [])
          if (mode === "meddra" && res.meta) {
            setMeddraPaging(res.meta)
          }
        })
        .catch(() => {
          if (cancelled) return
          setResults([])
          setSearchError("Search failed")
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 320)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [open, mode, query, minChars])

  const loadMoreMeddra = useCallback(() => {
    if (mode !== "meddra" || loadingMore || !meddraPaging) return
    const q = String(query || "").trim()
    if (q.length < minChars) return
    const nextPg = Number(meddraPaging.pageNumber) + 1
    if (nextPg > Number(meddraPaging.totalPages || 1)) return

    setLoadingMore(true)
    setSearchError("")
    searchTerminology(q, mode, { pageNumber: nextPg, pageSize: meddraPaging.pageSize || 50 })
      .then((res) => {
        if (!res.ok) {
          setSearchError(res.message || "Could not load more")
          return
        }
        setResults((prev) => mergeByUid(prev, Array.isArray(res.items) ? res.items : []))
        if (res.meta) setMeddraPaging(res.meta)
      })
      .catch(() => {
        setSearchError("Could not load more")
      })
      .finally(() => setLoadingMore(false))
  }, [mode, loadingMore, meddraPaging, query, minChars])

  const framedInputClass =
    String(inputClassName || "").trim() !== ""
      ? `${inputClassName} ${disabled ? "bg-slate-100 cursor-not-allowed opacity-75" : ""}`.trim()
      : cn(
          "w-full px-4 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-all bg-white",
          hasError
            ? "border-rose-200 focus:border-rose-400 focus:ring-rose-100/70"
            : "border-slate-200 focus:border-emerald-400 focus:ring-emerald-100/70",
          disabled && "bg-slate-100 cursor-not-allowed opacity-75",
          dense && "!py-1.5 !text-xs !rounded-md px-2",
        )

  if (!mode) {
    return (
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        readOnly={disabled}
        disabled={disabled}
        className={framedInputClass}
      />
    )
  }

  const shellClass = dense
    ? cn(
        "flex w-full min-w-0 items-stretch overflow-hidden bg-white rounded-md border border-slate-300 shadow-sm",
        hasError &&
          "border-rose-300 focus-within:ring-rose-100 focus-within:ring-1 focus-within:border-rose-400",
        !hasError &&
          "focus-within:border-emerald-400 focus-within:ring-1 focus-within:ring-emerald-500/25",
        disabled && "opacity-75 cursor-not-allowed bg-slate-50",
      )
    : cn(
        "flex w-full min-w-0 items-stretch overflow-hidden rounded-xl border bg-white shadow-sm transition-[box-shadow,border-color]",
        hasError
          ? cn(
              "border-rose-200",
              !disabled &&
                "focus-within:border-rose-400 focus-within:ring-2 focus-within:ring-rose-100/70",
            )
          : cn(
              /* Light blue treatment similar to UkUnk-style fields */
              "border-emerald-200/70",
              !disabled &&
                "focus-within:border-emerald-400 focus-within:shadow-[0_0_0_3px_rgba(129,140,248,0.22)]",
            ),
        disabled && "cursor-not-allowed bg-slate-100/90",
      )

  function renderPopover() {
    const popHint =
      minChars <= 1
        ? "Type at least 1 character to search."
        : "Type at least 2 characters to search."

    return (
      <PopoverContent
        align="end"
        sideOffset={8}
        className={cn(
          "z-[160] rounded-xl border border-slate-200 bg-white p-0 shadow-xl",
          dense ? "w-[min(20rem,calc(100vw-1.5rem))]" : "w-[min(24rem,calc(100vw-2rem))]",
        )}
      >
        <div className="border-b border-slate-100 px-3 py-2.5 pr-10 relative">
          <p className="text-sm font-semibold text-slate-800 tracking-tight">
            {mode === "whodd" ? "WHO‑DD drug lookup" : "MedDRA indication lookup"}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-slate-500">
            Search below, then tap a row —{" "}
            <span className="font-medium text-slate-700">name and code fill the field</span> as{" "}
            <span className="font-medium text-slate-700">Name (code)</span>; the code is highlighted when the field is
            not being edited.
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-2 top-2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close lookup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {isAiCodingAssistEnabled ? (
          <div className="border-b border-slate-100 px-3 py-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={aiSuggestLoading || disabled}
              className="h-8 w-full text-xs"
              onClick={async () => {
                const verbatim = String(query || value || "").trim()
                if (!verbatim) return
                setAiSuggestLoading(true)
                setAiSuggestions([])
                try {
                  const res = await xemusAiService.suggestCoding({
                    verbatim,
                    dictionary: mode === "whodd" ? "WHODD" : "MedDRA",
                  })
                  const list = res?.data?.suggestions ?? res?.data ?? []
                  setAiSuggestions(Array.isArray(list) ? list.slice(0, 3) : [])
                } finally {
                  setAiSuggestLoading(false)
                }
              }}
            >
              {aiSuggestLoading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              )}
              AI suggest coding
            </Button>
            {aiSuggestions.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {aiSuggestions.map((s, i) => (
                  <li key={s.code ?? i}>
                    <button
                      type="button"
                      className="w-full rounded-md border border-violet-100 bg-violet-50/50 px-2 py-1.5 text-left text-xs hover:bg-violet-50"
                      onClick={() => {
                        onChange(
                          formatTerminologyLookupSelection(
                            { code: s.code, display: s.term ?? s.display },
                            maxLength,
                          ),
                        )
                        setOpen(false)
                        setAiSuggestions([])
                      }}
                    >
                      <span className="font-medium">{s.term ?? s.display}</span>
                      {s.code ? <span className="ml-1 text-violet-700">({s.code})</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-2 p-3">
          <input
            ref={searchFieldRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mode === "whodd" ? "Search by drug name…" : "Search indication text…"}
            maxLength={mode === "whodd" ? 150 : 255}
            enterKeyHint="search"
            className={cn(
              "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm",
              "placeholder:text-slate-400 outline-none transition-[border-color,box-shadow]",
              "focus-visible:border-emerald-400 focus-visible:ring-2 focus-visible:ring-emerald-100",
            )}
          />

          <div
            className={cn(
              "max-h-52 overflow-y-auto space-y-1.5 rounded-lg border border-slate-100 bg-slate-50/40 p-1.5",
            )}
          >
            {loading && (
              <div className="flex items-center gap-2 px-2 py-3 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                Searching…
              </div>
            )}
            {!loading && searchError && (
              <p className="px-2 py-2 text-xs text-rose-600">{searchError}</p>
            )}
            {!loading &&
              !searchError &&
              query.trim().length >= minChars &&
              results.length === 0 && (
                <p className="px-2 py-2 text-xs text-slate-500">No matches for that search.</p>
              )}
            {!loading &&
              results.map((row) => {
                const codeStr = row.code != null ? String(row.code) : ""
                const displayStr = row.display && String(row.display).trim() ? String(row.display).trim() : ""
                const namePart = displayStr && displayStr !== codeStr ? displayStr : ""
                return (
                  <button
                    key={row.uid || `${row.code}-${row.display}`}
                    type="button"
                    className={cn(
                      "w-full rounded-lg border border-slate-100 bg-white px-2.5 py-2 text-left text-xs",
                      "transition-colors hover:border-emerald-200 hover:bg-emerald-50/60",
                    )}
                    onClick={() => {
                      onChange(formatTerminologyLookupSelection(row, maxLength))
                      setOpen(false)
                      setQuery("")
                    }}
                  >
                    <span className="block leading-snug text-slate-800">
                      {namePart ? (
                        <>
                          <span className="font-medium text-slate-800">{namePart}</span>
                          {codeStr ? (
                            <span className="ml-0.5 inline font-mono text-[13px] font-semibold text-emerald-900">
                              {" "}
                              <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 ring-1 ring-emerald-200/80">
                                ({codeStr})
                              </span>
                            </span>
                          ) : null}
                        </>
                      ) : codeStr ? (
                        <span className="inline font-mono text-[13px] font-semibold text-emerald-900">
                          <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 ring-1 ring-emerald-200/80">
                            ({codeStr})
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </span>
                  </button>
                )
              })}
          </div>

          {mode === "meddra" && meddraPaging && Number(meddraPaging.totalCount) > 0 && (
            <p className="text-[11px] text-slate-500">
              Showing {results.length} of {meddraPaging.totalCount}
              {Number(meddraPaging.totalPages) > 1
                ? ` — page ${meddraPaging.pageNumber}/${meddraPaging.totalPages}`
                : ""}
            </p>
          )}

          {mode === "meddra" &&
            meddraPaging &&
            Number(meddraPaging.pageNumber) < Number(meddraPaging.totalPages) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-full text-xs"
                disabled={loadingMore || loading}
                onClick={() => loadMoreMeddra()}
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Loading…
                  </>
                ) : (
                  "Load next page"
                )}
              </Button>
            )}

          {String(query || "").trim().length < minChars && (
            <p className="text-[11px] text-slate-500">{popHint}</p>
          )}
        </div>
      </PopoverContent>
    )
  }

  return (
    <div
      className={shellClass}
      role="group"
      aria-label={`${dictionaryTitle} coded text field — type a code, or use lookup to fill name and code as Name (code).`}
    >
      {/* Dictionary badge — label, not the only action */}
      <div
        className={cn(
          "flex shrink-0 flex-col items-center justify-center border-r border-slate-200/90 bg-gradient-to-b from-emerald-50 to-emerald-50/70",
          dense ? "w-8 px-0" : "w-11 px-1",
        )}
        title={`${dictionaryTitle} — coded value`}
      >
        <span
          className={cn(
            "font-bold leading-none text-emerald-800",
            dense ? "text-[11px]" : "text-sm",
          )}
        >
          {badge}
        </span>
        {!dense && (
          <span className="mt-0.5 max-w-[2.75rem] truncate text-[9px] font-medium uppercase tracking-wide text-emerald-600/90">
            {mode === "whodd" ? "WHO‑DD" : "MedDRA"}
          </span>
        )}
      </div>

      <div className="relative min-w-0 flex-1">
        {(() => {
          if (fieldFocused) return null
          const { label, code } = splitTerminologyLabelAndCode(value)
          if (!code || !label) return null
          return (
            <div
              className={cn(
                "pointer-events-none absolute inset-0 flex min-w-0 items-center overflow-hidden text-left",
                dense ? "px-2 py-1 text-xs" : "px-3 py-2.5 text-sm",
              )}
              aria-hidden
            >
              <span className="min-w-0 truncate text-slate-900">{label}</span>
              <span className="shrink-0 font-mono font-semibold text-emerald-900 dark:text-emerald-100">
                {" "}
                <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[0.8125rem] ring-1 ring-emerald-200/85 dark:bg-emerald-950/55 dark:ring-emerald-800/80">
                  ({code})
                </span>
              </span>
            </div>
          )
        })()}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFieldFocused(true)}
          onBlur={() => setFieldFocused(false)}
          placeholder={
            placeholder ||
            (mode === "whodd" ? "Code or lookup — saves as Name (code)" : "Code or lookup — saves as Name (code)")
          }
          maxLength={maxLength}
          readOnly={disabled}
          disabled={disabled}
          className={cn(
            "min-w-0 w-full border-0 bg-transparent shadow-none outline-none ring-0",
            "placeholder:text-slate-400 focus:ring-0",
            dense ? "px-2 py-1 text-xs" : "px-3 py-2.5 text-sm",
            !fieldFocused && splitTerminologyLabelAndCode(value).code
              ? "text-transparent caret-slate-900 selection:text-slate-900 selection:bg-emerald-200/50 dark:selection:bg-emerald-900/50"
              : "text-slate-900",
          )}
        />
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label={lookupAria}
            aria-expanded={open}
            title={lookupAria}
            className={cn(
              "flex shrink-0 items-center justify-center border-l border-slate-200 bg-slate-50/90 text-slate-600",
              "transition-colors hover:bg-emerald-50 hover:text-emerald-800",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-300",
              disabled && "pointer-events-none opacity-50",
              dense ? "w-8" : "w-10",
            )}
          >
            <ChevronDown className={cn("opacity-80", dense ? "h-3.5 w-3.5" : "h-4 w-4")} />
          </button>
        </PopoverTrigger>
        {renderPopover()}
      </Popover>
    </div>
  )
}
