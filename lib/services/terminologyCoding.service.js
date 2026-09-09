/**
 * MedDRA / WHO‑DD search — wired to MeddraWhoddLookupController (ApiResponse&lt;T&gt;).
 */

import apiClient from "../api/client"
import { API_CONFIG } from "../api/config"
import { normalizeTerminologyCoding } from "../utils/terminologyCoding"

const EP = API_CONFIG.ENDPOINTS.MEDDRA_WHODD_LOOKUP

/**
 * @param {Record<string, unknown>} item — MeddraIndicationSearchItemDto
 */
function mapMeddraIndicationHit(item) {
  if (!item || typeof item !== "object") return null
  const code = item.code ?? item.Code
  if (code === undefined || code === null) return null
  const name = String(item.name ?? item.Name ?? "").trim()
  const indication = String(item.indication ?? item.Indication ?? "").trim()
  const subtitle = indication && indication !== name ? indication : ""
  const display = [name || null, subtitle || null].filter(Boolean).join(" — ") || String(code)
  const id = item.id ?? item.Id
  return {
    uid: id != null ? `meddra:${id}:${code}` : `meddra:${code}`,
    code: String(code),
    display,
  }
}

/**
 * @param {Record<string, unknown>} item — WhoddDrugSearchItemDto
 */
function mapWhoddDrugHit(item) {
  if (!item || typeof item !== "object") return null
  const drugCode = item.drugCode ?? item.DrugCode
  const atcRaw = item.atcCode ?? item.AtcCode ?? item.ATCCode
  const atc = atcRaw != null ? String(atcRaw).trim() : ""
  const drugName = String(item.drugName ?? item.DrugName ?? "").trim()

  const stored =
    atc !== ""
      ? atc
      : drugCode !== undefined && drugCode !== null
        ? String(drugCode)
        : ""

  if (!stored) return null

  const bits = []
  if (drugName) bits.push(drugName)
  if (atc !== "") bits.push(`ATC ${atc}`)
  else if (drugCode !== undefined && drugCode !== null) bits.push(`Drug code ${drugCode}`)

  const id = item.id ?? item.Id
  const display = bits.join(" · ") || stored

  return {
    uid: id != null ? `whodd:${id}:${stored}` : `whodd:${stored}`,
    code: stored,
    display,
  }
}

/** @template T @param {unknown[]} rows @param {(row: Record<string, unknown>) => T | null} mapRow */
function dedupeStable(rows, mapRow) {
  const out = []
  const seen = new Set()
  for (const raw of rows) {
    const row = mapRow(typeof raw === "object" && raw != null ? /** @type {Record<string, unknown>} */ (raw) : {})
    if (!row) continue
    const key =
      typeof row.code === "string" && typeof row.uid === "string"
        ? row.uid
        : String(row.code)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}

/**
 * MedDRA indication search — paged (`search` ≥2 chars, max 255 per backend).
 * @param {string} query
 * @param {{ pageNumber?: number; pageSize?: number }} [options]
 */
export async function searchMeddraIndications(query, options = {}) {
  const search = String(query || "").trim()
  if (search.length === 0) {
    return { ok: true, items: [], message: "", meta: null }
  }
  if (search.length < 2) {
    return { ok: true, items: [], message: "", meta: null }
  }

  const pageNumber = Math.max(1, Number(options.pageNumber) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(options.pageSize) || 50))

  const qs = new URLSearchParams({
    search,
    pageNumber: String(pageNumber),
    pageSize: String(pageSize),
  })

  try {
    const res = await apiClient.get(`${EP.MEDDRA_INDICATIONS}?${qs}`)
    const msg = String(res?.message || res?.detail || "").trim()
    const httpBad = typeof res?.httpStatus === "number" && res.httpStatus >= 400
    const apiFail = res?.isSuccess === false

    if (!res || httpBad || apiFail) {
      return {
        ok: false,
        items: [],
        message: msg || "MedDRA search failed",
        meta: null,
      }
    }

    const dto =
      res?.data !== undefined && typeof res.data === "object" && !Array.isArray(res.data)
        ? res.data
        : {}
    const rawItems =
      Array.isArray(dto.items) ? dto.items : Array.isArray(dto.Items) ? dto.Items : []

    const meta = {
      pageNumber: Number(dto.pageNumber ?? dto.PageNumber ?? pageNumber) || pageNumber,
      pageSize: Number(dto.pageSize ?? dto.PageSize ?? pageSize) || pageSize,
      totalCount: Number(dto.totalCount ?? dto.TotalCount ?? 0) || 0,
      totalPages: Number(dto.totalPages ?? dto.TotalPages ?? 1) || 1,
    }

    return {
      ok: true,
      items: dedupeStable(rawItems, mapMeddraIndicationHit),
      message: "",
      meta,
    }
  } catch {
    return { ok: false, items: [], message: "MedDRA search failed", meta: null }
  }
}

/**
 * WHO‑DD drug search (top ~50 rows, relevance order — no paging params).
 */
export async function searchWhoddDrugs(query) {
  const search = String(query || "").trim()
  if (search.length < 1) {
    return { ok: true, items: [], message: "", meta: null }
  }

  const qs = new URLSearchParams({ search })

  try {
    const res = await apiClient.get(`${EP.WHODD_DRUGS}?${qs}`)
    const msg = String(res?.message || res?.detail || "").trim()
    const httpBad = typeof res?.httpStatus === "number" && res.httpStatus >= 400
    const apiFail = res?.isSuccess === false

    if (!res || httpBad || apiFail) {
      return {
        ok: false,
        items: [],
        message: msg || "WHO‑DD search failed",
        meta: null,
      }
    }

    const body = res?.data
    let rawItems = []
    if (Array.isArray(body)) {
      rawItems = body
    } else if (body && typeof body === "object") {
      rawItems = Array.isArray(body.items)
        ? body.items
        : Array.isArray(body.Items)
          ? body.Items
          : []
    }

    return {
      ok: true,
      items: dedupeStable(rawItems, mapWhoddDrugHit),
      message: "",
      meta: null,
    }
  } catch {
    return { ok: false, items: [], message: "WHO‑DD search failed", meta: null }
  }
}

/** Legacy name — prefers ATC when returned, else WHO‑DD drug code. */
export async function searchWhoddAtc(query) {
  return searchWhoddDrugs(query)
}

/** @deprecated use searchMeddraIndications */
export async function searchMeddra(query, options = {}) {
  return searchMeddraIndications(query, options)
}

/**
 * @param {string} query
 * @param {'meddra' | 'whodd' | string} coding
 * @param {{ pageNumber?: number; pageSize?: number }} [paging] — MedDRA only
 */
export async function searchTerminology(query, coding, paging = {}) {
  const mode = normalizeTerminologyCoding(coding)
  if (!mode) return { ok: true, items: [], message: "", meta: null }
  if (mode === "whodd") return searchWhoddDrugs(query)
  return searchMeddraIndications(query, paging)
}

const terminologyCodingService = {
  searchMeddraIndications,
  searchWhoddDrugs,
  searchWhoddAtc,
  searchMeddra,
  searchTerminology,
}

export default terminologyCodingService
