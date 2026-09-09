"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown, ChevronRight, Lock } from "lucide-react"
import { cn } from "@/lib/utils"
import { buildTargetFromSelectionKey } from "@/lib/dbLock/crfLockTree"

/**
 * @param {{
 *   sectionTree: Array<{ sectionKey: string, sectionName: string, fields: Array<{ fieldKey: string, label: string }> }>,
 *   lockedSelectionKeys: Set<string>,
 *   selectedKeys: Set<string>,
 *   onSelectionChange: (keys: Set<string>) => void,
 *   readOnly?: boolean,
 *   disabled?: boolean,
 *   wholeCrfLocked?: boolean,
 * }} props
 */
export default function CrfLockTargetTree({
  sectionTree,
  lockedSelectionKeys,
  selectedKeys,
  onSelectionChange,
  readOnly = false,
  disabled = false,
  wholeCrfLocked = false,
}) {
  const [expandedSections, setExpandedSections] = useState(() => new Set(sectionTree.map((s) => s.sectionKey)))

  useEffect(() => {
    setExpandedSections(new Set(sectionTree.map((section) => section.sectionKey)))
  }, [sectionTree])

  const totalFieldCount = useMemo(
    () => sectionTree.reduce((sum, section) => sum + (section.fields?.length ?? 0), 0),
    [sectionTree],
  )

  const toggleSectionExpand = (sectionKey) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(sectionKey)) next.delete(sectionKey)
      else next.add(sectionKey)
      return next
    })
  }

  const toggleKey = (key, checked) => {
    if (readOnly || disabled) return
    const next = new Set(selectedKeys)
    if (checked) next.add(key)
    else next.delete(key)
    onSelectionChange(next)
  }

  const toggleSectionSelection = (section, checked) => {
    if (readOnly || disabled) return
    const next = new Set(selectedKeys)
    const sectionKey = `section:${section.sectionKey}`
    if (checked) {
      next.add(sectionKey)
      section.fields.forEach((field) => next.delete(`field:${section.sectionKey}:${field.fieldKey}`))
    } else {
      next.delete(sectionKey)
    }
    onSelectionChange(next)
  }

  const sectionSummary = useMemo(() => {
    const map = {}
    for (const section of sectionTree) {
      const sectionSel = `section:${section.sectionKey}`
      const lockedCount = section.fields.filter((field) =>
        lockedSelectionKeys.has(`field:${section.sectionKey}:${field.fieldKey}`),
      ).length
      map[section.sectionKey] = {
        sectionLocked: lockedSelectionKeys.has(sectionSel) || wholeCrfLocked,
        lockedFieldCount: wholeCrfLocked ? section.fields.length : lockedCount,
      }
    }
    return map
  }, [sectionTree, lockedSelectionKeys, wholeCrfLocked])

  if (!sectionTree.length) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-500">
        Select patient and visit to load all sections and fields for this CRF.
      </p>
    )
  }

  const selectAllFields = () => {
    if (readOnly || disabled || wholeCrfLocked) return
    const next = new Set(selectedKeys)
    for (const section of sectionTree) {
      for (const field of section.fields ?? []) {
        const fieldSelKey = `field:${section.sectionKey}:${field.fieldKey}`
        if (!lockedSelectionKeys.has(`section:${section.sectionKey}`) && !lockedSelectionKeys.has(fieldSelKey)) {
          next.add(fieldSelKey)
        }
      }
    }
    onSelectionChange(next)
  }

  const clearSelection = () => {
    if (readOnly || disabled) return
    onSelectionChange(new Set())
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-slate-200/80 bg-white/90",
        (disabled || wholeCrfLocked) && "opacity-80",
      )}
      role="tree"
      aria-label="CRF lock target tree"
    >
      {wholeCrfLocked ? (
        <div className="border-b border-amber-200/80 bg-amber-50/70 px-4 py-2 text-xs font-medium text-amber-900">
          Whole CRF is locked — all sections and fields are read-only on eCRF.
        </div>
      ) : !readOnly ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-3 py-2">
          <p className="text-xs text-slate-600">
            {sectionTree.length} section{sectionTree.length === 1 ? "" : "s"} · {totalFieldCount} field
            {totalFieldCount === 1 ? "" : "s"}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectAllFields}
              disabled={disabled || wholeCrfLocked}
              className="text-xs font-medium text-amber-800 hover:underline disabled:opacity-50"
            >
              Select all fields
            </button>
            <button
              type="button"
              onClick={clearSelection}
              disabled={disabled || selectedKeys.size === 0}
              className="text-xs font-medium text-slate-600 hover:underline disabled:opacity-50"
            >
              Clear selection
            </button>
          </div>
        </div>
      ) : null}

      <ul className="divide-y divide-slate-100">
        {sectionTree.map((section) => {
          const sectionSelKey = `section:${section.sectionKey}`
          const isExpanded = expandedSections.has(section.sectionKey)
          const summary = sectionSummary[section.sectionKey]
          const sectionSelected = selectedKeys.has(sectionSelKey)
          const sectionLocked = summary?.sectionLocked

          return (
            <li key={section.sectionKey} role="treeitem" aria-expanded={isExpanded}>
              <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50/80">
                <button
                  type="button"
                  onClick={() => toggleSectionExpand(section.sectionKey)}
                  className="rounded p-0.5 text-slate-500 hover:bg-slate-100"
                  aria-label={isExpanded ? "Collapse section" : "Expand section"}
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>

                {!readOnly ? (
                  <input
                    type="checkbox"
                    checked={sectionSelected}
                    disabled={disabled || sectionLocked}
                    onChange={(e) => toggleSectionSelection(section, e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    aria-label={`Select section ${section.sectionName}`}
                  />
                ) : null}

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{section.sectionName}</p>
                  <p className="text-[11px] text-slate-500">{section.fields.length} fields</p>
                </div>

                {sectionLocked ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
                    <Lock className="h-3 w-3" />
                    Locked
                  </span>
                ) : summary?.lockedFieldCount > 0 ? (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                    {summary.lockedFieldCount} field{summary.lockedFieldCount === 1 ? "" : "s"} locked
                  </span>
                ) : null}
              </div>

              {isExpanded ? (
                <ul className="border-t border-slate-100 bg-slate-50/40 pb-2 pl-10 pr-3 pt-1">
                  {section.fields.map((field) => {
                    const fieldSelKey = `field:${section.sectionKey}:${field.fieldKey}`
                    const fieldLocked =
                      wholeCrfLocked ||
                      lockedSelectionKeys.has(sectionSelKey) ||
                      lockedSelectionKeys.has(fieldSelKey)
                    const fieldSelected = selectedKeys.has(fieldSelKey)

                    return (
                      <li key={field.fieldKey} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                        {!readOnly ? (
                          <input
                            type="checkbox"
                            checked={fieldSelected}
                            disabled={disabled || fieldLocked || sectionSelected}
                            onChange={(e) => toggleKey(fieldSelKey, e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                            aria-label={`Select field ${field.label}`}
                          />
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-slate-800">{field.label}</p>
                          <p className="truncate font-mono text-[10px] text-slate-400">{field.fieldKey}</p>
                        </div>
                        {fieldLocked ? (
                          <Lock className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
                        ) : null}
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function selectionKeysToTargets(selectedKeys) {
  return Array.from(selectedKeys)
    .map(buildTargetFromSelectionKey)
    .filter(Boolean)
}
