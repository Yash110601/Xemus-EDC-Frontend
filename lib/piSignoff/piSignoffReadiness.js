/** SPEC-SDVSIGN-001 — PI sign-off readiness + review order helpers */

import { normalizePiFieldSignoffSummary } from "./piFieldSignoff"

export const PI_REVIEW_ORDER = {
  SDV_BEFORE_SIGN: "sdv_before_sign",
  SIGN_BEFORE_SDV: "sign_before_sdv",
}

export const PI_SIGNOFF_GRANULARITY = {
  CRF_ONLY: "crf_only",
  FIELD_AND_CRF: "field_and_crf",
}

const DEFAULT_REVIEW_ORDER = PI_REVIEW_ORDER.SDV_BEFORE_SIGN

export function normalizeReviewOrder(raw) {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
  if (value === PI_REVIEW_ORDER.SIGN_BEFORE_SDV || value === "signbeforesdv") {
    return PI_REVIEW_ORDER.SIGN_BEFORE_SDV
  }
  if (value === PI_REVIEW_ORDER.SDV_BEFORE_SIGN || value === "sdvbeforsign") {
    return PI_REVIEW_ORDER.SDV_BEFORE_SIGN
  }
  return DEFAULT_REVIEW_ORDER
}

export function reviewOrderLabel(reviewOrder) {
  return normalizeReviewOrder(reviewOrder) === PI_REVIEW_ORDER.SIGN_BEFORE_SDV
    ? "PI sign-off before SDV"
    : "SDV before PI sign-off"
}

export function normalizePiReadiness(raw) {
  if (!raw || typeof raw !== "object") {
    return {
      isSdvVerified: false,
      hasOpenQueries: false,
      isReadyToSign: false,
      requiresResign: false,
      blockedReasons: [],
    }
  }

  const blockedReasons = Array.isArray(raw.blockedReasons ?? raw.BlockedReasons)
    ? (raw.blockedReasons ?? raw.BlockedReasons).map((r) => String(r ?? "").trim()).filter(Boolean)
    : []

  return {
    isSdvVerified: Boolean(raw.isSdvVerified ?? raw.IsSdvVerified),
    hasOpenQueries: Boolean(raw.hasOpenQueries ?? raw.HasOpenQueries),
    isReadyToSign: Boolean(raw.isReadyToSign ?? raw.IsReadyToSign),
    requiresResign: Boolean(raw.requiresResign ?? raw.RequiresResign),
    blockedReasons,
    fieldSignoff: normalizePiFieldSignoffSummary(raw.fieldSignoff ?? raw.FieldSignoff),
  }
}

export function normalizePiSignoffStatus(raw) {
  return String(raw ?? "")
    .trim()
    .replace(/_/g, " ")
}

export function isPiSignoffStatusVoided(status) {
  return /voided/i.test(String(status ?? ""))
}

export function isPiSignoffStatusSigned(status) {
  return /signed|complete|approved/i.test(String(status ?? "")) && !isPiSignoffStatusVoided(status)
}

export function isPiSignoffComplete(record) {
  if (!record) return false
  return isPiSignoffStatusSigned(record.status)
}

export function requiresPiResign(record) {
  if (!record) return false
  if (isPiSignoffStatusVoided(record.status)) return true
  return Boolean(record.readiness?.requiresResign)
}

export function shouldShowSdvBeforeSignGates(reviewOrder) {
  return normalizeReviewOrder(reviewOrder) === PI_REVIEW_ORDER.SDV_BEFORE_SIGN
}

export function normalizePiSignoffGranularity(raw) {
  if (raw === 1 || raw === "1") return PI_SIGNOFF_GRANULARITY.FIELD_AND_CRF
  if (raw === 0 || raw === "0") return PI_SIGNOFF_GRANULARITY.CRF_ONLY
  const value = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
  if (
    value === PI_SIGNOFF_GRANULARITY.FIELD_AND_CRF ||
    value === "fieldandcrf" ||
    value === "field_level" ||
    value === "fieldlevel"
  ) {
    return PI_SIGNOFF_GRANULARITY.FIELD_AND_CRF
  }
  return PI_SIGNOFF_GRANULARITY.CRF_ONLY
}

export function isFieldPiSignoffEnabled(granularity) {
  return normalizePiSignoffGranularity(granularity) === PI_SIGNOFF_GRANULARITY.FIELD_AND_CRF
}

export function piSignoffGranularityLabel(granularity) {
  return isFieldPiSignoffEnabled(granularity) ? "Field + CRF" : "Overall CRF only"
}
