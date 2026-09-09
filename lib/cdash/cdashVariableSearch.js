/**
 * Manual CDASH variable search — GET /Variables with availability (edit + create flows).
 */

import cdashService, { CDASH_IG_VERSION } from "@/lib/services/cdash.service"
import { toMappableControl } from "./controlProfile"
import { extractCdashVariables } from "./normalizeVariable"
import { applyDraftAvailabilityToVariables } from "@/lib/utils/cdashMappings"

export async function searchCdashVariablesForField(
  control,
  {
    domainCode,
    query,
    limit = 100,
    igVersion = CDASH_IG_VERSION,
    crfDesignId = null,
    draftAssignments = [],
  } = {},
) {
  const mappable = typeof control?.fieldInstanceId === "string" ? control : toMappableControl(control)
  const fieldInstanceId = String(mappable?.fieldInstanceId ?? "").trim()
  const designId = Number(crfDesignId)
  const hasDesignId = Number.isFinite(designId) && designId > 0

  const res = await cdashService.getVariables({
    igVersion,
    domainCode: domainCode || undefined,
    search: query || undefined,
    pageNumber: 1,
    pageSize: Math.min(limit, 200),
    crfDesignId: hasDesignId ? designId : undefined,
    fieldInstanceId: fieldInstanceId || undefined,
  })

  if (!res?.isSuccess) {
    throw new Error(res?.message || "Could not load CDASH variables")
  }

  let items = extractCdashVariables(res)

  if (!hasDesignId && Array.isArray(draftAssignments) && draftAssignments.length > 0) {
    items = applyDraftAvailabilityToVariables(items, draftAssignments, fieldInstanceId)
  }

  return items
}
