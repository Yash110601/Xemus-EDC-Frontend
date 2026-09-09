/** Common SDTM domains and variables for mapping UI (SDTMIG 3.4 subset). */

export const SDTM_DOMAIN_OPTIONS = [
  { value: "DM", label: "DM — Demographics (auto + CRF supplement)" },
  { value: "SV", label: "SV — Subject Visits (auto-generated on export)" },
  { value: "AE", label: "AE — Adverse Events" },
  { value: "CM", label: "CM — Concomitant Medications" },
  { value: "LB", label: "LB — Laboratory" },
  { value: "VS", label: "VS — Vital Signs" },
  { value: "MH", label: "MH — Medical History" },
  { value: "EX", label: "EX — Exposure" },
  { value: "DS", label: "DS — Disposition" },
  { value: "PE", label: "PE — Physical Exam" },
  { value: "EG", label: "EG — ECG" },
  { value: "QS", label: "QS — Questionnaires" },
  { value: "SC", label: "SC — Subject Characteristics" },
  { value: "SU", label: "SU — Substance Use" },
  { value: "CE", label: "CE — Clinical Events" },
  { value: "DA", label: "DA — Drug Accountability" },
  { value: "CO", label: "CO — Comments" },
]

export const SDTM_VARIABLES_BY_DOMAIN = {
  DM: ["SUBJID", "RFSTDTC", "RFENDTC", "SITEID", "BRTHDTC", "AGE", "AGEU", "SEX", "RACE", "ETHNIC", "ARMCD", "ARM", "COUNTRY", "DMDTC", "DMDY"],
  SV: ["VISITNUM", "VISIT", "VISITDY", "SVSTDTC", "SVENDTC", "SVUPDES"],
  AE: ["AETERM", "AESTDTC", "AEENDTC", "AESEV", "AEREL", "AEOUT", "AESER", "AEDECOD"],
  CM: ["CMTRT", "CMSTDTC", "CMENDTC", "CMDOSE", "CMDOSU", "CMROUTE", "CMINDC"],
  LB: ["LBTESTCD", "LBTEST", "LBORRES", "LBORRESU", "LBSTRESC", "LBSTRESN", "LBDTC", "LBNRIND"],
  VS: ["VSTESTCD", "VSTEST", "VSORRES", "VSORRESU", "VSDTC", "VSLOC"],
  MH: ["MHTERM", "MHDTC", "MHSTDTC", "MHENDTC", "MHCAT"],
  EX: ["EXTRT", "EXSTDTC", "EXENDTC", "EXDOSE", "EXDOSU", "EXROUTE"],
  DS: ["DSTERM", "DSDECOD", "DSSTDTC", "DSSCAT"],
  PE: ["PETESTCD", "PETEST", "PEORRES", "PEDTC"],
  EG: ["EGTESTCD", "EGTEST", "EGORRES", "EGDTC"],
  QS: ["QSTESTCD", "QSTEST", "QSORRES", "QSDTC"],
  SC: ["SCTESTCD", "SCTEST", "SCORRES"],
  SU: ["SUTRT", "SUSTDTC", "SUENDTC"],
  CE: ["CETERM", "CESTDTC", "CEENDTC"],
  DA: ["DATESTCD", "DAORRES", "DADTC"],
  CO: ["COVAL", "CODTC"],
}

export function getVariablesForDomain(domain) {
  const key = String(domain || "").trim().toUpperCase()
  return SDTM_VARIABLES_BY_DOMAIN[key] || []
}

export function buildFieldMappingKey(crfDesignId, sectionKey, fieldKey) {
  return `${crfDesignId}|${sectionKey}|${fieldKey}`
}
