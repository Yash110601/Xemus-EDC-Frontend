/**
 * Xemus CDISC export support matrix (no CDISC membership required).
 * Describes what the product generates today vs what still needs manual mapping or licensed specs.
 */

export const CDISC_MEMBERSHIP_NOTE =
  "Official SDTMIG/CDASH IG content and CDISC Library API require CDISC membership. Xemus uses standard variable names and custom builders for pilot/internal use."

export const CDISC_EXPORT_DOMAIN_SUPPORT = [
  {
    domain: "DM",
    label: "Demographics",
    status: "auto",
    source: "Patient enrolment + optional CRF mappings",
    variables: "STUDYID, USUBJID, SUBJID, BRTHDTC, AGE, SEX, SITEID, ARMCD, …",
    notes: "Auto-filled from enrolment (DOB, gender, screening no.). Map CRF fields to DM variables to supplement.",
  },
  {
    domain: "SV",
    label: "Subject Visits",
    status: "auto",
    source: "Visit schedules + CRF visit dates",
    variables: "VISITNUM, VISIT, SVSTDTC, …",
    notes: "One row per subject × visit from captured CRF data.",
  },
  {
    domain: "AE",
    label: "Adverse Events",
    status: "mapped",
    source: "SDTM Field Mapping → export",
    variables: "AETERM, AESTDTC, AEENDTC, AESEV, …",
    notes: "Use Pilot study starter or General — AE + CM template.",
  },
  {
    domain: "CM",
    label: "Concomitant Medications",
    status: "mapped",
    source: "SDTM Field Mapping → export",
    variables: "CMTRT, CMSTDTC, CMENDTC, …",
    notes: null,
  },
  {
    domain: "LB",
    label: "Laboratory",
    status: "mapped",
    source: "SDTM Field Mapping → export",
    variables: "LBTEST, LBORRES, LBDTC, …",
    notes: "Lab CRF integration can feed mapped fields.",
  },
  {
    domain: "VS",
    label: "Vital Signs",
    status: "mapped",
    source: "SDTM Field Mapping → export",
    variables: "VSTEST, VSORRES, VSDTC, …",
    notes: null,
  },
  {
    domain: "MH",
    label: "Medical History",
    status: "mapped",
    source: "SDTM Field Mapping → export",
    variables: "MHTERM, MHSTDTC, MHENDTC, …",
    notes: "Included in Pilot study starter template.",
  },
  {
    domain: "EX",
    label: "Exposure",
    status: "mapped",
    source: "Manual mapping only",
    variables: "EXTRT, EXSTDTC, EXDOSE, …",
    notes: "No built-in keyword template yet.",
  },
  {
    domain: "DS",
    label: "Disposition",
    status: "partial",
    source: "Manual mapping; patient status not auto-mapped",
    variables: "DSTERM, DSSTDTC, …",
    notes: "Map disposition CRF fields manually.",
  },
  {
    domain: "QS",
    label: "Questionnaires",
    status: "mapped",
    source: "Manual mapping only",
    variables: "QSTEST, QSORRES, QSDTC, …",
    notes: "Map questionnaire CRF fields manually.",
  },
  {
    domain: "SC",
    label: "Subject Characteristics",
    status: "mapped",
    source: "Manual mapping only",
    variables: "SCTEST, SCORRES, …",
    notes: null,
  },
  {
    domain: "PE / EG / SU / CE / DA / CO",
    label: "Other clinical domains",
    status: "mapped",
    source: "Manual mapping only",
    variables: "Domain-specific",
    notes: "Supported in mapping UI when you assign domain + variable.",
  },
]

export const CDISC_FORMAT_SUPPORT = [
  { format: "sdtm", label: "SDTM CSV (ZIP)", status: "supported", detail: "DM + SV auto; mapped domains as separate CSV files." },
  { format: "sdtm_xpt", label: "SDTM SAS XPT", status: "supported", detail: "Same datasets in transport (.xpt) format." },
  { format: "odm", label: "ODM 1.3.2", status: "supported", detail: "Clinical snapshot XML from CRF metadata + data." },
  { format: "define", label: "Define-XML 2.1", status: "partial", detail: "Metadata shell; not full SDTMIG-compliant define without licensed specs." },
  { format: "acrf", label: "Annotated CRF (PDF)", status: "supported", detail: "Mapping reference from Study → SDTM Field Mapping." },
  { format: "adam", label: "ADaM ADSL", status: "partial", detail: "Basic subject-level analysis dataset." },
  { format: "package", label: "Submission package", status: "partial", detail: "ODM + SDTM + define.xml ZIP for internal handoff." },
  { format: "package_regulatory", label: "Extended regulatory package", status: "partial", detail: "Adds XPT, aCRF PDF, ADSL; validate externally before submission." },
]

export const CDISC_STATUS_META = {
  auto: { label: "Auto-generated", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  mapped: { label: "Via field mapping", className: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  partial: { label: "Partial", className: "bg-amber-100 text-amber-900 border-amber-200" },
  supported: { label: "Supported", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
}

export const PILOT_STUDY_WORKFLOW = [
  "Open Study Management → SDTM Field Mapping and select your study.",
  "Choose template Pilot study starter (DM + AE/CM/LB/VS/MH) and click Apply template.",
  "Review auto-matched rows; fill gaps manually for unmapped CRF fields.",
  "Save mappings, then Reports → CDISC Export to download SDTM or submission package.",
  "Run structural validation on the export page; use Pinnacle 21 / OpenCDS before regulatory submission.",
]
