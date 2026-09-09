/**
 * Sub-features that exist for Role Permissions / API gates but must not appear as sidebar links.
 * Example: VISIT_ATTACHMENTS controls upload on eCRF Manually — same route, not a separate screen.
 */
const SIDEBAR_HIDDEN_SUB_FEATURE_CODES = new Set(["VISIT_ATTACHMENTS"])

export function isSidebarNavHiddenSubFeature(node) {
  const code = String(node?.code ?? node?.Code ?? "")
    .trim()
    .toUpperCase()
  return SIDEBAR_HIDDEN_SUB_FEATURE_CODES.has(code)
}
