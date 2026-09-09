const PREFILL_KEY = "agreement_edit_prefill"

export function stashAgreementEditPrefill(agreement) {
  if (!agreement?.id) return
  try {
    sessionStorage.setItem(
      PREFILL_KEY,
      JSON.stringify({
        id: agreement.id,
        studyId: agreement.studyId ?? null,
        companyName: agreement.companyName ?? "",
        tagline: agreement.tagline ?? "",
        studyProtocolNumber: agreement.studyProtocolNumber ?? "",
      })
    )
  } catch {
    // ignore storage errors
  }
}

export function readAgreementEditPrefill(agreementId) {
  if (!agreementId) return null
  try {
    const raw = sessionStorage.getItem(PREFILL_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (String(data?.id) !== String(agreementId)) return null
    return data
  } catch {
    return null
  }
}

export function clearAgreementEditPrefill() {
  try {
    sessionStorage.removeItem(PREFILL_KEY)
  } catch {
    // ignore
  }
}
