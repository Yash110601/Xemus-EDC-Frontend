"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { ArrowRight, Command, Search, Sparkles, X } from "lucide-react"
import {
  applyDashboardStudyContext,
  buildDashboardMetricLens,
  getLensItemActions,
} from "@/lib/dashboard/dashboardMetricLens"
import { getDashboardMetricTheme } from "@/lib/dashboard/dashboardMetricThemes"
import { cn } from "@/lib/utils"

export default function DashboardMetricLensPortal({
  open,
  lensKey,
  onClose,
  context,
  isAdmin = false,
  isSuperAdmin = false,
}) {
  const router = useRouter()
  const searchRef = useRef(null)
  const [query, setQuery] = useState("")
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [expandedId, setExpandedId] = useState(null)

  const showPathwayReveal = isSuperAdmin
  const theme = getDashboardMetricTheme(lensKey)

  const lens = useMemo(
    () => (lensKey ? buildDashboardMetricLens(lensKey, context) : null),
    [lensKey, context]
  )

  const filteredItems = useMemo(() => {
    if (!lens?.items) return []
    const q = query.trim().toLowerCase()
    if (!q) return lens.items
    return lens.items.filter(
      (item) =>
        item.title?.toLowerCase().includes(q) ||
        String(item.subtitle || "").toLowerCase().includes(q)
    )
  }, [lens, query])

  const actions = useMemo(() => (lens ? getLensItemActions(lens) : []), [lens])

  useEffect(() => {
    if (!open) {
      setQuery("")
      setFocusedIndex(0)
      setExpandedId(null)
      return
    }
    const t = window.setTimeout(() => searchRef.current?.focus(), 120)
    return () => window.clearTimeout(t)
  }, [open, lensKey])

  useEffect(() => {
    setFocusedIndex(0)
    setExpandedId(null)
  }, [query, lensKey])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setFocusedIndex((i) => Math.min(i + 1, Math.max(filteredItems.length - 1, 0)))
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setFocusedIndex((i) => Math.max(i - 1, 0))
      }
      if (e.key === "Enter" && filteredItems[focusedIndex] && showPathwayReveal) {
        e.preventDefault()
        setExpandedId((prev) =>
          prev === filteredItems[focusedIndex].id ? null : filteredItems[focusedIndex].id
        )
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, filteredItems, focusedIndex, onClose, showPathwayReveal])

  const navigateWithContext = useCallback(
    (href, item) => {
      if (item?.study) {
        applyDashboardStudyContext(item.study, item.site, { isAdmin })
      }
      onClose()
      router.push(href)
    },
    [isAdmin, onClose, router]
  )

  if (!open || !lens || typeof document === "undefined") return null

  return createPortal(
    <div
      className="novera-metric-lens fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="metric-lens-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/25 backdrop-blur-sm"
        aria-label="Close lens"
        onClick={onClose}
      />

      <div
        className={cn(
          "novera-metric-lens__panel relative flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-white/80 bg-white/95 shadow-[0_40px_100px_-40px_rgba(15,23,42,0.28)] sm:max-h-[85dvh] sm:rounded-3xl",
          `novera-metric-lens--${theme.accent}`
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90",
            theme.portalWash
          )}
        />
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-12 h-40 w-40 rounded-full bg-white/50 blur-3xl" />

        <div className="relative shrink-0 border-b border-slate-200/70 px-5 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div
                className={cn(
                  "mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em]",
                  theme.portalAccentText
                )}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {theme.lensLabel}
              </div>
              <h2 id="metric-lens-title" className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                {lens.title}
              </h2>
              <p className="mt-1 text-sm text-slate-600">{lens.description}</p>
              <p className="mt-2 text-xs text-slate-500">
                <span className={cn("font-semibold tabular-nums", theme.portalAccentText)}>{lens.total}</span>{" "}
                {lens.key === "sites" ? "sites" : lens.isRoleLens ? "roles" : "records"}
                {showPathwayReveal ? " · ↑↓ navigate · Enter expand" : " · ↑↓ navigate"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white/80 text-slate-500 shadow-sm transition-colors hover:bg-white hover:text-slate-800"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter studies, sites, roles…"
              className="w-full rounded-xl border border-slate-200/80 bg-white/90 py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200/80"
            />
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
              <Command className="mb-3 h-8 w-8 opacity-40" />
              <p className="text-sm font-medium">No matches for your filter</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {filteredItems.map((item, index) => {
                const isFocused = index === focusedIndex
                const isExpanded = showPathwayReveal && expandedId === item.id
                const showActions = showPathwayReveal ? isExpanded : true

                return (
                  <li key={item.id}>
                    <div
                      className={cn(
                        "group rounded-2xl border border-slate-200/70 bg-white/70 transition-all duration-200",
                        isFocused || isExpanded
                          ? cn(theme.portalItemActive, "shadow-sm")
                          : "hover:border-slate-300/80 hover:bg-white hover:shadow-sm"
                      )}
                    >
                      {showPathwayReveal ? (
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                          className="w-full rounded-2xl px-4 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80"
                          aria-expanded={isExpanded}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-900">{item.title}</p>
                              {item.subtitle ? (
                                <p className="mt-0.5 truncate text-xs text-slate-500">{item.subtitle}</p>
                              ) : null}
                            </div>
                            {item.meta != null && item.meta !== "" ? (
                              <span
                                className={cn(
                                  "shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium tabular-nums",
                                  theme.portalBadge
                                )}
                              >
                                {item.meta}
                              </span>
                            ) : null}
                          </div>
                          {!isExpanded ? (
                            <p className="mt-2 text-[11px] text-slate-400 opacity-0 transition-opacity group-hover:opacity-100">
                              Click to reveal pathways →
                            </p>
                          ) : null}
                        </button>
                      ) : (
                        <div className="px-4 py-3.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-900">{item.title}</p>
                              {item.subtitle ? (
                                <p className="mt-0.5 truncate text-xs text-slate-500">{item.subtitle}</p>
                              ) : null}
                            </div>
                            {item.meta != null && item.meta !== "" ? (
                              <span
                                className={cn(
                                  "shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium tabular-nums",
                                  theme.portalBadge
                                )}
                              >
                                {item.meta}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      )}

                      {showActions ? (
                        <div
                          className={cn(
                            "flex flex-wrap gap-2 px-4 pb-3.5",
                            showPathwayReveal ? "border-t border-slate-200/60 pt-3" : "pt-1",
                          )}
                        >
                          {actions.map((action) => (
                            <button
                              key={action.id}
                              type="button"
                              onClick={() => navigateWithContext(action.href, item)}
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                                theme.portalChip
                              )}
                            >
                              {action.label}
                              <ArrowRight className="h-3 w-3 opacity-70" />
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="relative shrink-0 border-t border-slate-200/70 bg-white/60 px-5 py-4 backdrop-blur-sm sm:px-6">
          <button
            type="button"
            onClick={() => {
              onClose()
              router.push(lens.primaryHref)
            }}
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-[1.01] active:scale-[0.99] sm:w-auto sm:px-6",
              theme.portalCta
            )}
          >
            {lens.primaryLabel}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
