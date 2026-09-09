/**
 * CDASH library cache + search — scales from UAT seed (~23) to full CDASHIG.
 * Source of truth is always GET /api/Cdash/Variables — never hardcode variable lists.
 */

import cdashService, { CDASH_IG_VERSION } from "@/lib/services/cdash.service"
import { extractCdashVariables } from "./normalizeVariable"

const SMALL_LIBRARY_PAGE_SIZE = 200
const PRELOAD_DOMAIN_COUNT_MAX = 10

class CdashLibraryStore {
  constructor() {
    this.cacheByIg = new Map()
    this.fullyLoadedByIg = new Map()
    this.domainCache = new Map()
    this.statusCache = new Map()
    this.ensurePromises = new Map()
  }

  async getStatus(igVersion = CDASH_IG_VERSION) {
    if (this.statusCache.has(igVersion)) return this.statusCache.get(igVersion)
    const res = await cdashService.getLibraryStatus(igVersion)
    const status = {
      hasSeedData: Boolean(res?.data?.hasSeedData ?? res?.data?.HasSeedData),
      domainCount: Number(res?.data?.domainCount ?? res?.data?.DomainCount ?? 0),
    }
    this.statusCache.set(igVersion, status)
    return status
  }

  async loadDomains(igVersion = CDASH_IG_VERSION) {
    if (this.domainCache.has(igVersion)) return this.domainCache.get(igVersion)
    const res = await cdashService.getDomains(igVersion)
    const list = res?.data ?? res?.Data ?? []
    const domains = Array.isArray(list) ? list : []
    this.domainCache.set(igVersion, domains)
    return domains
  }

  async loadAllPages(igVersion = CDASH_IG_VERSION) {
    const merged = []
    let pageNumber = 1
    while (pageNumber <= 20) {
      const res = await cdashService.getVariables({
        igVersion,
        pageNumber,
        pageSize: SMALL_LIBRARY_PAGE_SIZE,
      })
      const batch = extractCdashVariables(res)
      merged.push(...batch)
      if (batch.length < SMALL_LIBRARY_PAGE_SIZE) break
      pageNumber += 1
    }
    this.cacheByIg.set(igVersion, merged)
    this.fullyLoadedByIg.set(igVersion, true)
    return merged
  }

  async isSmallLibrary(igVersion = CDASH_IG_VERSION) {
    const res = await cdashService.getVariables({
      igVersion,
      pageNumber: 1,
      pageSize: SMALL_LIBRARY_PAGE_SIZE,
    })
    const firstPage = extractCdashVariables(res)
    return firstPage.length < SMALL_LIBRARY_PAGE_SIZE
  }

  async ensureLoaded(igVersion = CDASH_IG_VERSION) {
    if (this.ensurePromises.has(igVersion)) return this.ensurePromises.get(igVersion)

    const promise = (async () => {
      const status = await this.getStatus(igVersion)
      if (!status.hasSeedData) {
        throw new Error("CDASH library not loaded")
      }
      await this.loadDomains(igVersion)
      if (this.fullyLoadedByIg.get(igVersion)) return

      const shouldPreload =
        status.domainCount > 0 &&
        status.domainCount <= PRELOAD_DOMAIN_COUNT_MAX &&
        (await this.isSmallLibrary(igVersion))

      if (shouldPreload) {
        await this.loadAllPages(igVersion)
      }
    })()

    this.ensurePromises.set(igVersion, promise)
    try {
      await promise
    } finally {
      this.ensurePromises.delete(igVersion)
    }
  }

  getAllCached(igVersion = CDASH_IG_VERSION) {
    if (!this.fullyLoadedByIg.get(igVersion)) return null
    return this.cacheByIg.get(igVersion) ?? []
  }

  getDomains(igVersion = CDASH_IG_VERSION) {
    return this.domainCache.get(igVersion) ?? []
  }

  isFullyLoaded(igVersion = CDASH_IG_VERSION) {
    return Boolean(this.fullyLoadedByIg.get(igVersion))
  }

  filterCached(igVersion, { domainCode, query, limit = 50 } = {}) {
    const all = this.getAllCached(igVersion) ?? []
    const q = String(query ?? "").trim().toLowerCase()
    const domain = String(domainCode ?? "").trim().toUpperCase()
    return all
      .filter((row) => {
        if (domain && row.domainCode.toUpperCase() !== domain) return false
        if (!q) return true
        const haystack = `${row.variableName} ${row.label ?? ""} ${row.questionText ?? ""}`.toLowerCase()
        return haystack.includes(q)
      })
      .slice(0, limit)
  }

  async search(igVersion = CDASH_IG_VERSION, { domainCode, query, limit = 50 } = {}) {
    if (this.isFullyLoaded(igVersion)) {
      return this.filterCached(igVersion, { domainCode, query, limit })
    }

    const res = await cdashService.getVariables({
      igVersion,
      domainCode: domainCode || undefined,
      search: query || undefined,
      pageNumber: 1,
      pageSize: Math.min(limit, 200),
    })
    return extractCdashVariables(res)
  }

  invalidate(igVersion = CDASH_IG_VERSION) {
    this.cacheByIg.delete(igVersion)
    this.fullyLoadedByIg.delete(igVersion)
    this.domainCache.delete(igVersion)
    this.statusCache.delete(igVersion)
    this.ensurePromises.delete(igVersion)
  }
}

export const cdashLibraryStore = new CdashLibraryStore()
