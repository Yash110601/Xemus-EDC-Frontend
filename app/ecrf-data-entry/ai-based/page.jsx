"use client"

/**
 * AI-based eCRF Data Entry uses the same implementation as Manual eCRF Data Entry:
 * - Same study/site from localStorage and API (getPatientAndVisitDataForCrfDataEntry)
 * - Same patient list, visit list, and form selection
 * - Same CRF design loading, validation, rules, and save/update (Draft, Saved, Submitted)
 * - Same required fields and validation behavior
 *
 * This ensures parity; AI-specific features (e.g. AI-assisted fill) can be added here later.
 */
export { default } from "../manually/page"
