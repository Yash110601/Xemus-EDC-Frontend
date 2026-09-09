/**
 * Query Management Adapter (frontend mock)
 * Keeps reviewer-query workflow decoupled from backend readiness.
 */

const queryStoreByCrfDataId = new Map()

const clone = (value) => JSON.parse(JSON.stringify(value))

class QueryManagementAdapter {
  async listManualQueries({ crfDataId }) {
    const key = String(crfDataId || "")
    if (!key) return []
    return clone(queryStoreByCrfDataId.get(key) || [])
  }

  async createManualQuery(payload) {
    const key = String(payload?.crfDataId || "")
    if (!key) {
      return {
        isSuccess: false,
        message: "crfDataId is required",
        data: null,
      }
    }
    const existing = queryStoreByCrfDataId.get(key) || []
    const next = [...existing, payload]
    queryStoreByCrfDataId.set(key, next)
    return {
      isSuccess: true,
      message: "Manual query created",
      data: clone(payload),
    }
  }

  async updateManualQueryStatus({ crfDataId, queryId, status, reviewerClosureComment = "" }) {
    const key = String(crfDataId || "")
    const list = queryStoreByCrfDataId.get(key) || []
    const idx = list.findIndex((x) => x.id === queryId)
    if (idx < 0) {
      return {
        isSuccess: false,
        message: "Query not found",
        data: null,
      }
    }
    const updated = {
      ...list[idx],
      status,
      reviewerClosureComment,
      updatedAt: new Date().toISOString(),
    }
    const next = [...list]
    next[idx] = updated
    queryStoreByCrfDataId.set(key, next)
    return {
      isSuccess: true,
      message: "Query status updated",
      data: clone(updated),
    }
  }
}

export default new QueryManagementAdapter()
