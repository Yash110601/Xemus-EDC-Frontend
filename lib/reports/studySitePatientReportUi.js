/** Shared Tailwind class strings for Study/Site/Patient report filters (matches audit-trail-with-reason). */

import { PATIENT_STATUS_CODES } from "@/lib/services/patientEnrolment.service"

/** Participation status labels (API patientStatusCode 1–9). */
export const PATIENT_PARTICIPATION_STATUS_NAME_BY_CODE = {
  [PATIENT_STATUS_CODES.SCREENING]: "Screening",
  [PATIENT_STATUS_CODES.SCREEN_FAILED]: "Screen Failed",
  [PATIENT_STATUS_CODES.RANDOMIZED_ENROLLED]: "Randomized / Enrolled",
  [PATIENT_STATUS_CODES.ON_TREATMENT]: "On Treatment",
  [PATIENT_STATUS_CODES.DISCONTINUED]: "Discontinued",
  [PATIENT_STATUS_CODES.WITHDRAWN]: "Withdrawn",
  [PATIENT_STATUS_CODES.LOST_TO_FOLLOW_UP]: "Lost to Follow-Up",
  [PATIENT_STATUS_CODES.DEATH]: "Death",
  [PATIENT_STATUS_CODES.COMPLETED]: "Completed",
}

/** Optional `patientStatus` query filter for patient-details report. */
export const PATIENT_STATUS_FILTER_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: String(PATIENT_STATUS_CODES.SCREENING), label: "Screening" },
  { value: String(PATIENT_STATUS_CODES.SCREEN_FAILED), label: "Screen Failed" },
  { value: String(PATIENT_STATUS_CODES.RANDOMIZED_ENROLLED), label: "Randomized / Enrolled" },
  { value: String(PATIENT_STATUS_CODES.ON_TREATMENT), label: "On Treatment" },
  { value: String(PATIENT_STATUS_CODES.DISCONTINUED), label: "Discontinued" },
  { value: String(PATIENT_STATUS_CODES.WITHDRAWN), label: "Withdrawn" },
  { value: String(PATIENT_STATUS_CODES.LOST_TO_FOLLOW_UP), label: "Lost to Follow-Up" },
  { value: String(PATIENT_STATUS_CODES.DEATH), label: "Death" },
  { value: String(PATIENT_STATUS_CODES.COMPLETED), label: "Completed" },
]

/** Display label for participation status from API row fields. */
export function getPatientParticipationStatusLabel(patient) {
  if (!patient) return null
  const name = String(patient.patientStatusName || "").trim()
  if (name) return name
  const code = Number(patient.patientStatusCode)
  if (Number.isFinite(code) && code > 0) {
    return PATIENT_PARTICIPATION_STATUS_NAME_BY_CODE[code] || `Status ${code}`
  }
  return null
}

export const REPORT_SELECT_TRIGGER_CLASS =
  "w-full border-2 border-slate-200 rounded-lg bg-white hover:bg-blue-50 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all px-4 py-3 shadow-sm"
export const REPORT_SELECT_CONTENT_CLASS = "bg-white border-2 border-slate-200 rounded-2xl shadow-xl p-2"
export const REPORT_SELECT_ITEM_CLASS =
  "px-4 py-2.5 rounded-lg data-[highlighted]:bg-emerald-50 data-[highlighted]:text-slate-900 data-[state=checked]:bg-emerald-100 data-[state=checked]:text-emerald-900 text-sm font-medium text-slate-900 cursor-pointer transition-colors"
export const REPORT_SELECT_SEARCH_INPUT_CLASS =
  "pl-10 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white"
/** Scrollable list body inside report filter dropdowns (Patient Details Report standard). */
export const REPORT_SELECT_SCROLL_LIST_CLASS = "max-h-[300px] overflow-y-auto"
export const REPORT_INPUT_CLASS = "border-2 border-slate-200 rounded-xl"

/** Study row label — same resolution order as Patient Details Report. */
export function getStudyFilterDisplayName(study) {
  if (!study) return ""
  if (typeof study === "string") return study
  const studyId = study.studyId ?? study.id
  return (
    study.studyProtocolNumber ||
    study.protocolNumber ||
    study.name ||
    study.studyName ||
    (studyId != null ? `Study ${studyId}` : "")
  )
}

/** 5-column filter row (Query Management Report). */
export const REPORT_FILTER_GRID_CLASS =
  "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-5"

/** 4-column filter row (Audit Trail With Reason — fills row, no empty 5th slot). */
export const REPORT_FILTER_GRID_4_CLASS =
  "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5"

/** 3-column filter row (Patient Details Report — two rows of three). */
export const REPORT_FILTER_GRID_3_CLASS =
  "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
export const REPORT_FILTER_FIELD_CLASS = "space-y-2 min-w-0"

/** Glass results panel + scroll region for dense data grids. */
export const REPORT_PREMIUM_PANEL_CLASS =
  "overflow-hidden rounded-2xl border border-slate-200/70 bg-white/75 shadow-[0_8px_36px_-18px_rgba(15,23,42,0.18)] backdrop-blur-md ring-1 ring-white/60"
export const REPORT_PREMIUM_PANEL_HEADER_CLASS =
  "border-b border-slate-200/70 bg-gradient-to-r from-slate-50/95 via-white/90 to-emerald-50/30 px-4 py-3"
export const REPORT_PREMIUM_TABLE_SCROLL_CLASS =
  "max-h-[min(640px,calc(100dvh-var(--topbar-height,4.5625rem)-16rem))] overflow-auto overscroll-auto"
export const REPORT_PREMIUM_TH_CLASS =
  "sticky top-0 z-20 h-10 whitespace-nowrap border-b border-slate-200/90 bg-gradient-to-b from-white via-slate-50/98 to-slate-100/95 px-3 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-600 backdrop-blur-md"
export const REPORT_PREMIUM_TD_CLASS = "h-11 max-h-11 px-3 align-middle text-[11px] text-slate-700"

/** Standard report page shell (Audit Log, Patient Details, SDV Report). */
export const REPORT_PAGE_BG_CLASS =
  "bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50"

export const REPORT_PAGE_SHELL_CLASS =
  "w-full min-w-0 p-3 sm:p-6 min-h-[calc(100dvh-var(--topbar-height,4.5625rem)-1.5rem)]"

export const REPORT_PAGE_SHELL_WITH_BG_CLASS = `${REPORT_PAGE_SHELL_CLASS} ${REPORT_PAGE_BG_CLASS}`

export const REPORT_FILTER_BODY_CLASS = "p-4 sm:p-6"

export const REPORT_PAGE_HEADER_TITLE_CLASS =
  "text-xl sm:text-3xl font-bold text-slate-800 mb-0.5 sm:mb-1"

export const REPORT_MOBILE_TABLE_HINT = "Swipe horizontally to view all columns"
export const REPORT_HEADER_ICON_WRAP_CLASS = "shrink-0 rounded-xl bg-emerald-100 p-2.5 text-emerald-700"
export const REPORT_CARD_CLASS = "bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden"
export const REPORT_FILTER_HEADER_CLASS =
  "border-b border-slate-200/60 bg-gradient-to-r from-emerald-50/50 via-white to-slate-50/80 px-4 py-3 sm:px-6 sm:py-4"

export const REPORT_FILTER_TOOLBAR_CLASS =
  "flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
export const REPORT_RESULTS_HEADER_CLASS =
  "bg-gradient-to-r from-slate-100 to-slate-50 px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200"
export const REPORT_TABLE_SCROLL_CLASS =
  "w-full max-w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] max-h-[min(640px,calc(100dvh-var(--topbar-height,4.5625rem)-18rem))] overflow-y-auto overscroll-y-auto"
export const REPORT_TABLE_HEAD_ROW_CLASS = "bg-gradient-to-r from-slate-100 to-slate-50 sticky top-0 z-10"
export const REPORT_TABLE_TH_CLASS =
  "px-3 py-3 text-left text-[11px] font-bold text-slate-700 uppercase tracking-wide border-b-2 border-slate-200"
export const REPORT_TABLE_BODY_CLASS = "bg-white divide-y divide-slate-100"
export const REPORT_TABLE_TR_CLASS = "hover:bg-slate-50 transition-colors"
export const REPORT_TABLE_TD_CLASS = "px-4 py-3 text-sm text-slate-700 align-middle"
export const REPORT_PRIMARY_BTN_CLASS =
  "btn-brand-gradient text-white shadow-md"
export const REPORT_VIEW_SEGMENT_WRAP_CLASS =
  "inline-flex rounded-xl border border-slate-200/90 bg-white/90 p-1 shadow-sm backdrop-blur-sm"
export const REPORT_VIEW_SEGMENT_ACTIVE_CLASS =
  "btn-brand-gradient rounded-lg text-white shadow-sm"
export const REPORT_VIEW_SEGMENT_IDLE_CLASS =
  "rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"

export const STUDY_SITE_PATIENT_INITIAL_FILTERS = {
  search: "",
  studyId: "",
  siteId: "",
  patientId: "",
  dateFrom: "",
  dateTo: "",
  pageNumber: 1,
  pageSize: 50,
}

/** Standard report grid page-size dropdown (matches Audit Trail With Reason, etc.). */
export const REPORT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

/** Query Management Report — extends study/site/patient filters with CRF query report API fields. */
export const CRF_QUERY_REPORT_INITIAL_FILTERS = {
  ...STUDY_SITE_PATIENT_INITIAL_FILTERS,
  queryAgeFilter: "All",
  pageSize: 10,
}

export const CRF_QUERY_AGE_FILTER_OPTIONS = [
  { value: "All", label: "All ages" },
  { value: "Within1CalendarDay", label: "Within 1 calendar day" },
  { value: "Within7CalendarDays", label: "Within 7 calendar days" },
  { value: "Within15CalendarDays", label: "Within 15 calendar days" },
  { value: "Within30CalendarDays", label: "Within 30 calendar days" },
]

/** SDV Report — cascading study → site → patient → visit → CRF. */
export const SDV_REPORT_INITIAL_FILTERS = {
  search: "",
  studyId: "",
  siteId: "",
  patientEnrolmentId: "",
  visitScheduleId: "",
  crfDesignId: "",
  isSdvApproved: "",
  pageNumber: 1,
  pageSize: 10,
}

export const SDV_REPORT_FIELD_APPROVED_OPTIONS = [
  { value: "", label: "All" },
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
]

/** PI Sign-off Report — same cascade as SDV; submitted CRFs only. */
export const PI_SIGNOFF_REPORT_INITIAL_FILTERS = {
  search: "",
  studyId: "",
  siteId: "",
  patientEnrolmentId: "",
  visitScheduleId: "",
  crfDesignId: "",
  piSignoffStatus: "",
  pageNumber: 1,
  pageSize: 10,
}

export const PI_SIGNOFF_REPORT_STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "signed", label: "Signed" },
  { value: "voided", label: "Voided" },
]

/** AI Entry Report — cascading study → site → patient → visit → CRF + AI type/date. */
export const AI_ENTRY_REPORT_INITIAL_FILTERS = {
  search: "",
  studyId: "",
  siteId: "",
  patientEnrolmentId: "",
  visitScheduleId: "",
  crfDesignId: "",
  crfStatus: "",
  isAiBasedEntry: "",
  aiEntryType: "",
  aiEntryFromUtc: "",
  aiEntryToUtc: "",
  pageNumber: 1,
  pageSize: 50,
}

export const AI_ENTRY_REPORT_CRF_STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "2", label: "Saved" },
  { value: "3", label: "Submitted" },
]

export const AI_ENTRY_REPORT_TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "1", label: "Voice To Text" },
  { value: "2", label: "File Upload" },
]

/** Email Delivery Report — dates applied in page (last 7 days IST default). */
export const EMAIL_DELIVERY_REPORT_INITIAL_FILTERS = {
  fromDate: "",
  toDate: "",
  emailType: "",
  status: "",
  deliveryOutcome: "",
  provider: "",
  studyId: "",
  siteId: "",
  userId: "",
  toContains: "",
  createdByContains: "",
  pageNumber: 1,
  pageSize: 20,
}
