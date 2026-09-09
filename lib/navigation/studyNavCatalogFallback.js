/**
 * Bundled nav catalog when GET StudyPermissions/GetNavModuleCatalog is unavailable
 * (e.g. UAT API not yet deployed). Keep in sync with Features/SubFeatures in DB.
 */
import catalog from "./studyNavCatalogFallback.json"

export function getStudyNavCatalogFallback() {
  return Array.isArray(catalog) ? catalog : []
}
