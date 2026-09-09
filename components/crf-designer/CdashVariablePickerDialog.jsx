"use client"

import { useEffect, useRef, useState } from "react"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { searchPickerForControl } from "@/lib/cdash/cdashSuggestEngine"
import {
  formatCdashVariablePickerLabel,
  isCdashVariableSelectable,
} from "@/lib/cdash/normalizeVariable"
import { CDASH_IG_VERSION } from "@/lib/services/cdash.service"
import { cn } from "@/lib/utils"
import { Lock, Search, X } from "lucide-react"

export default function CdashVariablePickerDialog({
  open,
  onOpenChange,
  control,
  domains = [],
  domainCode = "",
  onDomainChange,
  initialSearch = "",
  selectedReferenceId = null,
  crfDesignId = null,
  draftAssignments = [],
  onSelect,
}) {
  const [search, setSearch] = useState("")
  const [variables, setVariables] = useState([])
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState(null)
  const debounceRef = useRef(null)
  const requestIdRef = useRef(0)
  const searchInputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setSearch(initialSearch || "")
    setFetchError(null)
    const t = setTimeout(() => searchInputRef.current?.focus(), 120)
    return () => clearTimeout(t)
  }, [open, initialSearch])

  useEffect(() => {
    if (!open || !domainCode) {
      setVariables([])
      setFetchError(null)
      return
    }

    const runSearch = () => {
      const reqId = ++requestIdRef.current
      setLoading(true)
      setFetchError(null)
      void searchPickerForControl(control, {
        domainCode,
        query: search,
        limit: 100,
        igVersion: CDASH_IG_VERSION,
        crfDesignId,
        draftAssignments,
      })
        .then((rows) => {
          if (reqId !== requestIdRef.current) return
          setVariables(rows)
        })
        .catch((err) => {
          if (reqId !== requestIdRef.current) return
          setVariables([])
          setFetchError(err?.message ?? "Could not load variables")
        })
        .finally(() => {
          if (reqId === requestIdRef.current) setLoading(false)
        })
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(runSearch, search.trim() ? 300 : 0)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [open, domainCode, search, control, crfDesignId, draftAssignments])

  const handlePick = (item) => {
    if (!isCdashVariableSelectable(item)) return
    onSelect?.(item)
    onOpenChange?.(false)
  }

  const handleClose = () => onOpenChange?.(false)
  const availableCount = variables.filter((item) => isCdashVariableSelectable(item)).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "sm:max-w-[420px] p-0 gap-0 overflow-hidden border-0",
          "rounded-2xl shadow-[0_24px_80px_-12px_rgba(15,23,42,0.28)]",
          "bg-white/95 backdrop-blur-xl ring-1 ring-slate-200/70",
        )}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="relative flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-slate-200/60 bg-gradient-to-b from-slate-50/90 to-white/40">
          <DialogHeader className="space-y-1 pr-2 text-left">
            <DialogTitle className="text-[15px] font-semibold tracking-tight text-slate-900">
              Select CDASH Variable
            </DialogTitle>
            <DialogDescription className="text-[11px] leading-relaxed text-slate-500">
              Variables already mapped in this CRF appear disabled with a reason.
            </DialogDescription>
          </DialogHeader>
          <DialogClose asChild>
            <button
              type="button"
              onClick={handleClose}
              className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100/90 text-slate-500 ring-1 ring-slate-200/80 hover:bg-slate-200/90 hover:scale-105 transition-all duration-200"
              aria-label="Close"
            >
              <X className="h-4 w-4" strokeWidth={2.25} />
            </button>
          </DialogClose>
        </div>

        <div className="px-5 py-4 space-y-3 bg-white/50">
          <div>
            <Label className="text-[11px] font-medium mb-1.5 block text-slate-600">Domain</Label>
            <Select value={domainCode || ""} onValueChange={onDomainChange}>
              <SelectTrigger className="h-9 text-xs sm:text-sm bg-white/90 rounded-xl cursor-pointer">
                <SelectValue placeholder="Select domain" />
              </SelectTrigger>
              <SelectContent className="z-[250] bg-white/98 shadow-xl rounded-xl max-h-[220px]">
                {domains.map((d) => {
                  const code = d.domainCode ?? d.DomainCode ?? d
                  return (
                    <SelectItem key={String(code)} value={String(code)} className="text-xs rounded-lg">
                      {String(code)}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[11px] font-medium mb-1.5 block text-slate-600">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <Input
                ref={searchInputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search variable…"
                disabled={!domainCode}
                className="h-9 pl-9 text-xs sm:text-sm rounded-xl bg-white/90"
              />
            </div>
          </div>
        </div>

        <div className="max-h-[min(340px,50vh)] overflow-y-auto px-3 py-2" aria-busy={loading}>
          {!domainCode ? (
            <p className="px-3 py-10 text-center text-xs text-slate-500">Select a domain first.</p>
          ) : loading && variables.length === 0 ? (
            <div className="space-y-2 px-1 py-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-11 w-full rounded-xl" />
              ))}
            </div>
          ) : fetchError ? (
            <p className="mx-1 my-4 text-center text-xs text-red-600">{fetchError}</p>
          ) : variables.length === 0 ? (
            <p className="px-3 py-10 text-center text-xs text-slate-500">No variables found.</p>
          ) : (
            <ul className="space-y-1">
              {variables.map((item) => {
                const selected =
                  selectedReferenceId != null && Number(selectedReferenceId) === item.id
                const selectable = isCdashVariableSelectable(item)
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={!selectable}
                      title={item.unavailableReason ?? undefined}
                      onClick={() => handlePick(item)}
                      className={cn(
                        "w-full text-left rounded-xl px-3 py-2.5 text-xs transition-all duration-200",
                        !selectable &&
                          "cursor-not-allowed bg-slate-100/80 text-slate-400 opacity-75",
                        selectable &&
                          selected &&
                          "bg-indigo-50/95 ring-1 ring-indigo-200/80 text-indigo-950",
                        selectable &&
                          !selected &&
                          "hover:bg-slate-50/95 hover:ring-1 hover:ring-slate-200/70 text-slate-800",
                      )}
                    >
                      <span className="flex items-start gap-2">
                        {!selectable ? (
                          <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                        ) : null}
                        <span className="min-w-0 flex-1">
                          {formatCdashVariablePickerLabel(item)}
                          {item.sdtmTarget ? (
                            <span className="block text-[10px] text-slate-400 mt-0.5">
                              SDTM: {item.sdtmTarget}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-slate-200/60 bg-slate-50/40">
          <p className="text-[10px] text-slate-400">
            {variables.length > 0
              ? `${availableCount} selectable · ${variables.length} shown`
              : ""}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={handleClose} className="h-8 rounded-xl text-xs">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
