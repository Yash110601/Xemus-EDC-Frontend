"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { crfDataService, crfDesignService } from "@/lib/services"
import { buildRsdvCrfFieldRows } from "@/lib/rsdv/rsdvCrfFieldRows"
import { cn } from "@/lib/utils"
import { Loader2, Search } from "lucide-react"

export default function RsdvCrfFieldValuesPanel({
  studyId,
  crfDataId,
  crfDesignId,
  selectedFieldId,
  onFieldSelect,
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [fieldRows, setFieldRows] = useState([])
  const [filter, setFilter] = useState("")

  const loadFields = useCallback(async () => {
    const sid = Number.parseInt(String(studyId ?? ""), 10)
    const dataId = Number.parseInt(String(crfDataId ?? ""), 10)
    const designId = Number.parseInt(String(crfDesignId ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0 || !Number.isFinite(dataId) || dataId <= 0) {
      setFieldRows([])
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [dataRes, designRes] = await Promise.all([
        crfDataService.getCrfDataById(dataId, sid),
        Number.isFinite(designId) && designId > 0
          ? crfDesignService.getCrfDesignById(designId, sid)
          : Promise.resolve(null),
      ])

      if (!dataRes?.isSuccess || !dataRes.data) {
        setFieldRows([])
        setError(dataRes?.message || "Could not load CRF data.")
        return
      }

      const detail = dataRes.data
      let design = designRes?.isSuccess ? designRes.data : null
      const resolvedDesignId = designId || detail.crfDesignId || detail.CrfDesignId
      if (!design && resolvedDesignId) {
        const fallbackDesign = await crfDesignService.getCrfDesignById(resolvedDesignId, sid)
        if (fallbackDesign?.isSuccess) design = fallbackDesign.data
      }

      const formData = detail.formData ?? detail.FormData ?? detail.formJson
      setFieldRows(buildRsdvCrfFieldRows(design, formData))
    } catch (loadError) {
      setFieldRows([])
      setError(loadError?.message || "Could not load eCRF field values.")
    } finally {
      setLoading(false)
    }
  }, [crfDataId, crfDesignId, studyId])

  useEffect(() => {
    void loadFields()
  }, [loadFields])

  const filteredRows = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return fieldRows
    return fieldRows.filter((row) => {
      const haystack = `${row.label} ${row.fieldId} ${row.value} ${row.section}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [fieldRows, filter])

  const groupedRows = useMemo(() => {
    const groups = new Map()
    for (const row of filteredRows) {
      const key = row.section || "General"
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(row)
    }
    return [...groups.entries()]
  }, [filteredRows])

  if (!crfDataId) {
    return (
      <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">Select a CRF to view submitted field values.</p>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">eCRF field values</p>
        {fieldRows.length > 0 ? (
          <span className="text-[10px] text-slate-400">{fieldRows.length} fields</span>
        ) : null}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter fields…"
          className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2 text-sm"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
        </div>
      ) : error ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : filteredRows.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
          {fieldRows.length === 0 ? "No field values found for this CRF." : "No fields match your filter."}
        </p>
      ) : (
        <div className="max-h-48 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
          {groupedRows.map(([sectionName, rows]) => (
            <div key={sectionName}>
              <p className="sticky top-0 bg-white px-1 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                {sectionName}
              </p>
              <div className="space-y-1">
                {rows.map((row) => {
                  const selected = selectedFieldId && String(selectedFieldId) === String(row.fieldId)
                  return (
                    <button
                      key={row.fieldId}
                      type="button"
                      onClick={() => onFieldSelect?.(row.fieldId, row.label)}
                      className={cn(
                        "w-full rounded-lg border px-2 py-1.5 text-left text-xs transition-colors",
                        selected
                          ? "border-emerald-300 bg-emerald-50/80"
                          : "border-transparent hover:border-slate-200 hover:bg-slate-50",
                      )}
                    >
                      <p className="font-medium text-slate-900">{row.label}</p>
                      <p className="mt-0.5 line-clamp-2 text-slate-600">{row.value}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
