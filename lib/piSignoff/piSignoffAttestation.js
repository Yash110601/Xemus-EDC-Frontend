/** 21 CFR Part 11 — PI electronic signature attestation copy (study-configurable later). */

export const PI_SIGNOFF_APPLY_ATTESTATION =
  "By entering my password, I confirm that I have reviewed this Case Report Form and the data recorded herein are complete and accurate to the best of my knowledge."

export const PI_SIGNOFF_REVOKE_ATTESTATION =
  "By entering my password, I confirm that I am revoking the PI sign-off on this CRF. A reason is required for audit."

export const PI_SIGNOFF_RESIGN_ATTESTATION =
  "By entering my password, I confirm that I have re-reviewed this CRF after data changes and apply a new PI sign-off."

export const PI_FIELD_SIGNOFF_ATTESTATION =
  "By entering my password, I confirm that I have reviewed the selected field(s) and the recorded values are complete and accurate."

export const PI_FIELD_SIGNOFF_REVOKE_ATTESTATION =
  "By entering my password, I confirm that I am revoking PI sign-off on the selected field(s). A reason is required for audit."

export const PI_SIGNOFF_BULK_APPLY_ATTESTATION =
  "By entering my password, I confirm that I have reviewed the ready submitted CRFs at this site and apply PI sign-off to each. Each CRF is audited separately; forms that are not ready will be skipped."

export function piSignoffAttestationForMode(mode = "apply") {
  if (mode === "bulkApply") return PI_SIGNOFF_BULK_APPLY_ATTESTATION
  if (mode === "revoke") return PI_SIGNOFF_REVOKE_ATTESTATION
  if (mode === "resign") return PI_SIGNOFF_RESIGN_ATTESTATION
  if (mode === "field") return PI_FIELD_SIGNOFF_ATTESTATION
  if (mode === "fieldRevoke") return PI_FIELD_SIGNOFF_REVOKE_ATTESTATION
  return PI_SIGNOFF_APPLY_ATTESTATION
}
