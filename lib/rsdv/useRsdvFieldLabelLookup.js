"use client"

import { useCallback, useEffect, useState } from "react"
import { crfDataService, crfDesignService } from "@/lib/services"
import { buildRsdvCrfFieldRows } from "@/lib/rsdv/rsdvCrfFieldRows"

function isControlId(value) {
  return typeof value === "string" && /^ctrl_\d+_/i.test(value.trim())
}

/** Resolve a human-readable field label from stored metadata or CRF design lookup. */
export function resolveRsdvFieldLabel(lookup, { crfDataId, fieldId, fieldLabel } = {}) {
  const stored = String(fieldLabel ?? "").trim()
  if (stored && !isControlId(stored)) return stored

  const id = String(fieldId ?? "").trim()
  if (!id) return stored || "—"

  const dataId = crfDataId ?? null
  if (dataId) {
    const scoped = lookup.get(`${dataId}|${id}`)
    if (scoped) return scoped
  }

  return lookup.get(id) || stored || id
}

export function useRsdvFieldLabelLookup(studyId, crfRecords) {
  const [lookup, setLookup] = useState(() => new Map())

  useEffect(() => {
    let cancelled = false
    const sid = Number.parseInt(String(studyId ?? ""), 10)
    const records = Array.isArray(crfRecords) ? crfRecords : []

    if (!Number.isFinite(sid) || sid <= 0 || records.length === 0) {
      setLookup(new Map())
      return
    }

    async function load() {
      const next = new Map()

      await Promise.all(
        records.map(async (crf) => {
          const dataId = crf.crfDataId ?? crf.CrfDataId
          const designId = crf.crfDesignId ?? crf.CrfDesignId
          if (!dataId) return

          try {
            const [dataRes, designRes] = await Promise.all([
              crfDataService.getCrfDataById(dataId, sid),
              designId ? crfDesignService.getCrfDesignById(designId, sid) : Promise.resolve(null),
            ])

            if (!dataRes?.isSuccess || !dataRes.data) return

            let design = designRes?.isSuccess ? designRes.data : null
            const resolvedDesignId = designId || dataRes.data.crfDesignId || dataRes.data.CrfDesignId
            if (!design && resolvedDesignId) {
              const fallback = await crfDesignService.getCrfDesignById(resolvedDesignId, sid)
              if (fallback?.isSuccess) design = fallback.data
            }

            const formData = dataRes.data.formData ?? dataRes.data.FormData ?? dataRes.data.formJson
            for (const row of buildRsdvCrfFieldRows(design, formData)) {
              next.set(`${dataId}|${row.fieldId}`, row.label)
              if (!next.has(row.fieldId)) next.set(row.fieldId, row.label)
            }
          } catch {
            // Ignore individual CRF load failures; other records may still resolve.
          }
        }),
      )

      if (!cancelled) setLookup(next)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [studyId, crfRecords])

  const resolveLabel = useCallback((target) => resolveRsdvFieldLabel(lookup, target), [lookup])

  return { resolveLabel, lookup }
}
