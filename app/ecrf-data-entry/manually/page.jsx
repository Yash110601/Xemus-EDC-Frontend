"use client"

import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, memo, startTransition, useDeferredValue } from "react"
import { createPortal } from "react-dom"
import { usePathname } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { Search, RefreshCw, Minus, Eye, Edit, CheckCircle, AlertTriangle, AlertCircle, Clock, XCircle, ChevronLeft, ChevronRight, X, FileText, Loader2, ChevronDown, Mic, Upload, Square, UploadCloud, Send, Pause, Play, Paperclip, FileDown, File, FileArchive, MessageSquare, Trash2, LayoutGrid, ClipboardList, UserRound, Users, Shield, FileCheck } from "lucide-react"
import {
  authService,
  studyService,
  crfDesignService,
  crfDataService,
  auditTrailWithReasonService,
  patientEnrolmentService,
  crfRuleService,
  crfQueryManagementService,
  geminiService,
  visitAttachmentsService,
  labManagementService,
  eConsentService,
} from "@/lib/services"
import { PATIENT_STATUS_CODES } from "@/lib/services/patientEnrolment.service"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getDefaultCrfOrgMeta } from "@/lib/config/orgBranding"
import {
  isSdvConfigured,
  pickIsPiSignoffRequired,
  pickIsPiSignoffBulkEnabled,
  pickQueryRaiseRoleGuidsFromSettings,
  pickReviewOrderFromSettings,
  pickPiSignoffGranularityFromSettings,
  pickPiSignoffRoleGuidsFromSettings,
  pickSdvRoleGuidsFromSettings,
} from "@/lib/utils/studySettingsRead"
import {
  buildPiAuditFieldsForSave,
  extractPiMapsFromSavedFormData,
  getPiFieldKey,
} from "@/lib/piSignoff/piFieldSignoff"
import {
  PI_REVIEW_ORDER,
  isFieldPiSignoffEnabled,
  isPiSignoffComplete,
  shouldShowSdvBeforeSignGates,
} from "@/lib/piSignoff/piSignoffReadiness"
import piSignoffService from "@/lib/services/piSignoff.service"
import useStudyPermissionGates from "@/hooks/useStudyPermissionGates"
import { isStudyPermissionMatrixPlatformEnabled } from "@/lib/permissions/isStudyPermissionMatrixEnabled"
import {
  resolveMenuNodePermissions,
  resolveSubFeatureMenuPermissions,
} from "@/lib/utils/menuRoutePermissions"
import useStudyLockStatus from "@/hooks/useStudyLockStatus"
import useGranularDbLock from "@/hooks/useGranularDbLock"
import { generateCrfEntryPdf } from "@/lib/utils/crfEntryPdf"
import { buildPrintedInfoFromUser } from "@/lib/utils/reportGeneratedMeta"
import { CRF_PDF_DEFAULT_LAYOUT_OPTIONS } from "@/lib/utils/crfPdfTheme"
import { buildPdfSectionsForExport } from "@/lib/utils/crfPdfSectionsBuilder"
import { fetchCrfAuditTrailRows } from "@/lib/utils/fetchCrfAuditTrailRows"
import { normalizeBoolForDesigner } from "@/lib/utils/crfDesignerConfigFromApi"
import { toast } from "@/hooks/use-toast"
import { zipVisitAttachmentsUnderSize, triggerZipDownload } from "@/lib/utils/visitAttachmentsZipExport"
import { useRuleEvaluation } from "@/components/crf-designer/useRuleEvaluation"
import {
  evaluateRule,
  createFieldLabelMap,
  collectRuleLabelMatchKeys,
  createLabelToIdMap,
  getFormValues,
  applyRuleAction,
  createRuleDependencyIndex,
  crfDesignRuleShouldRunForDirtyFields,
  replaceFieldIdsWithLabels,
  replaceLabelsWithIds,
  decodeHtmlEntities,
  logCrfRule,
  isCrfRuleVerbose,
  isDesignerReadonly,
  normalizeRuleCategory,
  isDateRestrictionRule,
  DATE_RESTRICTION_RULE_MARKER,
  mergeRulePropsRestrictively,
  mergeRestrictiveBooleanProp,
  normalizeCrfRuleExpressionFields,
} from "@/components/crf-designer/ruleEvaluator"
import { evaluateRuleBatchWithWorkerEngine } from "@/components/crf-designer/ruleWorkerEngine"
import { validateControl, validateCRFForm } from "@/components/crf-designer/formValidation"
import { parseHtmlContent } from "@/components/crf-designer/parseHtmlContent"
import { CrfLabSectionBanner, CrfLabSectionTabAffix } from "@/components/crf-designer/CrfLabSectionBanner"
import { CrfLabSectionFacilityPicker } from "@/components/crf-designer/CrfLabSectionFacilityPicker"
import { mapDropdownItems } from "@/components/lab-management/lab-field-utils"
import { normalizeCrfSection, SECTION_TYPE_LAB } from "@/lib/utils/crfLabSection"
import { getLabNumericRangeSoftWarnings } from "@/lib/utils/crfLabRangeValidation"
import {
  normalizeIsoDateForBounds,
  resolveBoundIso,
  parseDateInterval,
  violatesMinDateBound,
  violatesMaxDateBound,
  evaluateDateRestrictionExpression,
  isUkUnkDateString,
} from "@/lib/utils/ukUnkDateCompare"
import ControlRenderer from "@/components/crf-designer/ControlRenderer"
import TerminologyCodingInput from "@/components/ecrf/TerminologyCodingInput"
import AiFillChoiceModal from "@/components/ecrf/AiFillChoiceModal"
import AiQualityHintsPanel from "@/components/intelligence/AiQualityHintsPanel"
import StudyAssistantPanel from "@/components/intelligence/StudyAssistantPanel"
import { useStudyAiSettings } from "@/lib/intelligence/useStudyAiSettings"
import { buildCaptureAiSuggestions } from "@/lib/intelligence/xemusIntelligence"
import { xemusAiService } from "@/lib/services"
import AiProcessingOverlay from "@/components/ecrf/AiProcessingOverlay"
import FillWithAiActionBar from "@/components/ecrf/FillWithAiActionBar"
import CrfQuerySummaryBadges from "@/components/ecrf/CrfQuerySummaryBadges"
import {
  getVisitQuerySummaryFromPatient,
  hasCrfQueryActivity,
  normalizeCrfQuerySummary,
} from "@/lib/utils/crfQuerySummary"
import {
  getCrfProgressStatusLabel,
  getVisitProgressFromPatient,
  hasCrfProgressData,
  normalizeCrfProgress,
} from "@/lib/utils/crfProgress"
import CrfProgressBar from "@/components/ecrf/CrfProgressBar"
import EcrfVisitWorkflowProgressBars from "@/components/ecrf/data-entry/EcrfVisitWorkflowProgressBars"
import EcrfDataEntryWorkspace from "@/components/ecrf/data-entry/EcrfDataEntryWorkspace"
import EcrfWorkspaceContextNotice from "@/components/ecrf/data-entry/EcrfWorkspaceContextNotice"
import EcrfMatrixFormPickerDialog from "@/components/ecrf/data-entry/EcrfMatrixFormPickerDialog"
import {
  isPatientReadyForBulkReview,
  visitCrfHasOpenQueries,
} from "@/lib/utils/ecrfVisitMatrixStatus"
import { computeVisitWorkflowProgressBestEffort, getPrimaryCrfDataIdForVisit } from "@/lib/utils/crfWorkflowProgress"
import {
  computeClientSectionProgress,
  mergeLiveSectionProgress,
} from "@/lib/utils/crfClientSectionProgress"
import CrfSectionProgressPanel from "@/components/ecrf/CrfSectionProgressPanel"
import EcrfSectionProgressList from "@/components/ecrf/data-entry/EcrfSectionProgressList"
import { useStudySiteContext } from "@/hooks/useStudySiteContext"
import useEConsentCrfGate from "@/hooks/useEConsentCrfGate"
import { usePatientIdentifierStudySettings } from "@/components/patient-enrolment/usePatientIdentifierStudySettings"
import StudyCompletionDataEntrySection from "@/components/ecrf/StudyCompletionDataEntrySection"
import {
  collectStudyCompletionFormFieldKeys,
  findStudyCompletionSectionByStatusCode,
  isStudyCompletionFormSectionList,
  isStudyCompletionFormVisit,
  resolveSectionsForDataEntry,
  resolveStudyCompletionGateForReopen,
  resolveStudyCompletionSubmitFromGate,
} from "@/lib/crfDesigner/studyCompletionFormDesigner"
import { safeEvaluateCompute } from "@/lib/utils/computeRuleMath"
import { applyDesignerDefaultValues } from "@/lib/utils/crfDesignerFormDefaults"
import {
  buildAiEntryFieldsForSave,
  clearAiEntry,
  extractAiEntryFlagsFromSavedFormData,
  markAiEntry,
  resolveCrfAiEntryTypeFromMode,
} from "@/lib/utils/crfAiEntry"
import { cn } from "@/lib/utils"
import { normalizeTerminologyCoding } from "@/lib/utils/terminologyCoding"
import {
  compileRulesToCanonicalIR,
  RuleRuntime,
  buildParityReport,
  createRuntimePerfTracker,
  downloadParityReportJson,
  readRuleRuntimeRolloutConfig,
  isRuleRuntimePilotAllowed,
  isRuleRuntimePrimaryAllowed,
  buildCompareModeStatus,
  buildPilotControlOverrides,
  applyValuePatchesToFormSlice,
  createMismatchSampler,
  setRuleRuntimeMode,
  clearRuleRuntimeMode,
  getRuleRuntimeModeConfig,
  evaluateRuntimeSlo,
  evaluateRuntimeStageSlo,
} from "@/lib/rule-engine"
import { useVisitAttachmentUpload } from "@/context/VisitAttachmentUploadContext"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import DatePicker from "@/components/ui/date-picker"
import SearchableSelect from "@/components/ui/searchable-select"
import UkUnkDatePicker from "@/components/ui/ukunk-date-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import MacSkeletonList from "@/components/ui/mac-skeleton-list"
import { getPatientStatusPendingVisitLockReason } from "@/lib/ecrf/patientStatusVisitAccess"
import {
  shouldShowVisitInManualDataEntry,
  sortVisitsForManualDataEntry,
  VISIT_TYPE,
  visitMatchesTypeEnum,
} from "@/lib/visitTypes"
import AuditReasonModal from "./components/AuditReasonModal"
import {
  QUERY_TYPE_SYSTEM,
  QUERY_TYPE_MANUAL,
  QUERY_STATUS_OPEN,
  QUERY_STATUS_IN_PROCESS,
  QUERY_STATUS_CLOSED,
  normalizeQueryType,
  normalizeQueryStatus,
  isQueryOpenStatus,
  isQueryClosedStatus,
  getQueryStatusLabel,
  isManualQueryType,
  isSystemQueryType,
  getQueryApproverComment,
  getCrfSubmitterComment,
  getQueryApproverUserId,
  getQueryAssignedToUserId,
  queryDtoPick,
  formatQueryGridScalar,
  formatQueryGridDate,
  queryGridTypeLabel,
  getQueryStatusPillClass,
  canCurrentUserCloseQuery,
  deriveExpectedActualAndBody,
  dedupeQueries,
  filterQueriesForControl,
  fieldRequiresReverificationAfterQueries,
  normalizeQueryFieldKey,
  resolveQueryFieldIdToFormFlatKey,
  toEcrfFieldDomId,
  queryFieldMatchesControl,
  getLiveQueryFieldValueRaw,
  stringifyQueryActualValue,
  normalizeQueryChoiceOptions,
  stripQueryFieldDecorators,
  getDisplaySectionsFromSelectedForm,
  findControlForQueryField,
  normalizeQueryFieldIdForTableColumnLookup,
  renderQueryActualReadOnlyByControl,
} from "./lib/crfQueryReviewUi"
import EcrfModalGroup from "./components/EcrfModalGroup"
import CrfSaveSuccessPopup from "./components/CrfSaveSuccessPopup"
import EcrfQueryReviewPanels from "./components/EcrfQueryReviewPanels"
import EcrfPiSignoffPanel from "./components/EcrfPiSignoffPanel"
import PiSignoffPasswordDialog from "@/components/pi-signoff/PiSignoffPasswordDialog"
import PiSignoffVisitBadge from "@/components/pi-signoff/PiSignoffVisitBadge"
import useStudyPiPendingSummary from "@/hooks/useStudyPiPendingSummary"
import EcrfDbLockBanner from "./components/EcrfDbLockBanner"
import EcrfSectionTabs from "./components/EcrfSectionTabs"
import EcrfSectionStepperFooter from "./components/EcrfSectionStepperFooter"
import EcrfCrfBody from "./components/EcrfCrfBody"
import { useEcrfEntryStore } from "./store/useEcrfEntryStore"
import { useDataEntryControlVirtualizer } from "./hooks/useDataEntryControlVirtualizer"
import useAuditRetryQueue from "./hooks/useAuditRetryQueue"
import useAuditReasonCore from "./hooks/useAuditReasonCore"
import useCrfSavePipeline from "./hooks/useCrfSavePipeline"

const UK_UNK_MONTH_OPTIONS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]

/**
 * CRA reviewer role GUID — authoritative identifier for "user can perform SDV".
 *
 * Why a GUID instead of the role code/name string?
 * - Backend role names vary ("CRA", "Clinical Research Associate", "CRA-Reviewer")
 *   so a substring check on `roleCode || roleName` was missing real CRA users.
 * - Role GUIDs are stable and unambiguous across environments seeded from the
 *   same identity store. Compared lowercase (matches `normalizeGuidValue`).
 *
 * Used as the primary signal for `isCraReviewer`; the substring check is kept
 * as a backward-compat fallback so legacy users with `roleCode === "CRA"` still
 * work even if their `roleGuid` is missing on the user object.
 */
const CRA_ROLE_GUID = "6dc990ae-5ba9-4d6c-a02b-20416f9c868a"

const SDV_ELIGIBLE_CONTROL_TYPES = new Set([
  "table",
  "text",
  "textbox",
  "textarea",
  "number",
  "email",
  "tel",
  "phone",
  "select",
  "dropdown",
  "radio",
  "checkbox",
  "date",
  "datetime",
  "time",
  "ukunkdate",
])

const normalizeUkUnkMonthToken = (rawMonth) => {
  const token = String(rawMonth || "").trim().toUpperCase()
  if (!token) return ""
  if (token === "UNK") return "UNK"
  if (UK_UNK_MONTH_OPTIONS.includes(token)) return token
  if (/^\d{1,2}$/.test(token)) {
    const idx = Number(token)
    if (Number.isFinite(idx) && idx >= 1 && idx <= 12) return UK_UNK_MONTH_OPTIONS[idx - 1]
  }
  return ""
}

const normalizeUkUnkDayToken = (rawDay) => {
  const token = String(rawDay || "").trim().toUpperCase()
  if (!token) return ""
  if (token === "UK") return "UK"
  if (/^\d{1,2}$/.test(token)) {
    const n = Number(token)
    if (Number.isFinite(n) && n >= 1 && n <= 31) return String(n)
  }
  return ""
}

const parseUkUnkDateParts = (rawValue) => {
  const raw = String(rawValue || "").trim()
  if (!raw) return { day: "", month: "", year: "" }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [yyyy, mm, dd] = raw.split("-")
    return {
      day: normalizeUkUnkDayToken(dd),
      month: normalizeUkUnkMonthToken(mm),
      year: yyyy,
    }
  }
  const [dayPart = "", monthPart = "", yearPart = ""] = raw.split("-")
  return {
    day: normalizeUkUnkDayToken(dayPart),
    month: normalizeUkUnkMonthToken(monthPart),
    year: /^\d{4}$/.test(String(yearPart || "").trim()) ? String(yearPart).trim() : "",
  }
}

const buildUkUnkDateFromParts = (day, month, year) => {
  if (!day && !month && !year) return ""
  return `${day || ""}-${month || ""}-${year || ""}`
}

const CRF_FIELD_STATE = Object.freeze({
  NOT_RENDERED: "NOT_RENDERED",
  RENDERED_EMPTY: "RENDERED_EMPTY",
  FILLED: "FILLED",
  HIDDEN_BY_RULE: "HIDDEN_BY_RULE",
})

/** Same rules as `useCrfSavePipeline` — used when building save payload in this module. */
const normalizeGenderForControlApplicability = (raw) => {
  const s = String(raw || "").trim().toLowerCase()
  if (!s) return ""
  if (s === "m" || s === "male") return "male"
  if (s === "f" || s === "female") return "female"
  if (s === "both" || s === "all" || s === "any") return "both"
  return s
}

const isControlApplicableForPatientGenderForSavePayload = (control, patient) => {
  const controlGender = normalizeGenderForControlApplicability(control?.properties?.genderSpecific || "both")
  if (!controlGender || controlGender === "both") return true
  const patientGender = normalizeGenderForControlApplicability(patient?.gender)
  if (!patientGender) return true
  return controlGender === patientGender
}

const PATIENT_STATUS_NAME_BY_CODE = {
  1: "Screening",
  2: "Enrolled",
  3: "Randomized",
  4: "On Treatment",
  5: "Follow-up",
  6: "Withdrawn",
  7: "Lost to Follow-Up",
  8: "Discontinued",
  9: "Completed",
}

const getPatientStatusLabel = (name, code) => {
  const trimmed = String(name || "").trim()
  if (trimmed) return trimmed
  const n = Number(code)
  return Number.isFinite(n) ? (PATIENT_STATUS_NAME_BY_CODE[n] || "") : ""
}

const getPatientStatusBadgeClass = (statusCode, isSelected) => {
  if (isSelected) return "border-white/45 bg-white/20 text-white"
  const code = Number(statusCode)
  if (code === 9) return "border-emerald-200 bg-emerald-50 text-emerald-700"
  if (code === 7 || code === 8) return "border-rose-200 bg-rose-50 text-rose-700"
  if (code === 4 || code === 5) return "border-amber-200 bg-amber-50 text-amber-700"
  return "border-emerald-200 bg-emerald-50 text-emerald-700"
}

const getPatientStatusCode = (patient) => {
  const n = Number(patient?.currentStatusCode ?? patient?.patientStatusCode)
  return Number.isFinite(n) ? n : null
}

const TERMINAL_STATUS_TRANSITIONS = [
  PATIENT_STATUS_CODES.DISCONTINUED,
  PATIENT_STATUS_CODES.WITHDRAWN,
  PATIENT_STATUS_CODES.LOST_TO_FOLLOW_UP,
  PATIENT_STATUS_CODES.DEATH,
  PATIENT_STATUS_CODES.COMPLETED,
]

const getManualStatusTransitions = (patient) => {
  const code = getPatientStatusCode(patient)
  if (code == null || code === PATIENT_STATUS_CODES.SCREENING || code === PATIENT_STATUS_CODES.RANDOMIZED_ENROLLED) {
    return [PATIENT_STATUS_CODES.ON_TREATMENT]
  }
  // Match PatientStatusService: screen-failed enrolments cannot go to On Treatment (re-screen instead).
  if (code === PATIENT_STATUS_CODES.SCREEN_FAILED) {
    return TERMINAL_STATUS_TRANSITIONS
  }
  if (code === PATIENT_STATUS_CODES.ON_TREATMENT) {
    return TERMINAL_STATUS_TRANSITIONS
  }
  return []
}

const canShowManualStatusAction = (patient) => {
  const code = getPatientStatusCode(patient)
  // No status yet (not started) — still allow moving to On Treatment when status workflow is on.
  if (code == null) return true
  return getManualStatusTransitions(patient).length > 0
}

const EMPTY_FORM_DATA_SLICE = Object.freeze({})

/**
 * Stable empties for the per-render table-row prefix index. Returning the same
 * frozen object/array reference when there is nothing to compute prevents
 * `React.memo`'d table consumers from seeing a "new" `{}` prop on every parent
 * keystroke — i.e. avoids per-table O(N) re-renders for keystrokes in
 * unrelated controls.
 */
const EMPTY_TABLE_KEY_MAP = Object.freeze({})
const EMPTY_TABLE_ROW_INDEX = Object.freeze({
  allKeysByTable: EMPTY_TABLE_KEY_MAP,
  populatedKeysByTable: EMPTY_TABLE_KEY_MAP,
})

const getCrmQueryIconButtonClass = (status) => {
  const n = normalizeQueryStatus(status)
  if (n === QUERY_STATUS_OPEN) {
    return "relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-sky-500/90 bg-sky-50/95 text-sky-700 shadow-sm transition-colors hover:bg-sky-100/90"
  }
  if (n === QUERY_STATUS_IN_PROCESS) {
    return "relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-orange-500/90 bg-orange-50/95 text-orange-700 shadow-sm transition-colors hover:bg-orange-100/90"
  }
  if (n === QUERY_STATUS_CLOSED) {
    return "relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-500/90 bg-emerald-50/95 text-emerald-700 shadow-sm transition-colors hover:bg-emerald-100/90"
  }
  return "relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-200/90 bg-emerald-50/95 text-emerald-700 shadow-sm transition-colors hover:bg-emerald-100/90"
}

const getCrmQueryIconBadgeClass = (status) => {
  const n = normalizeQueryStatus(status)
  if (n === QUERY_STATUS_OPEN) return "bg-sky-600"
  if (n === QUERY_STATUS_IN_PROCESS) return "bg-orange-600"
  if (n === QUERY_STATUS_CLOSED) return "bg-emerald-600"
  return "bg-emerald-600"
}

/** Field card ring for assigned submitter — aligns with `getCrmQueryIconButtonClass` (open / in process / closed). */
const getSubmitterQueryFieldCardToneClasses = (status) => {
  const n = normalizeQueryStatus(status)
  if (n === QUERY_STATUS_OPEN) {
    return "border-sky-400/90 bg-sky-50/45 ring-1 ring-sky-300/55 shadow-[0_8px_22px_-14px_rgba(14,165,233,0.22)]"
  }
  if (n === QUERY_STATUS_IN_PROCESS) {
    return "border-orange-400/90 bg-orange-50/45 ring-1 ring-orange-300/55 shadow-[0_8px_22px_-14px_rgba(249,115,22,0.2)]"
  }
  if (n === QUERY_STATUS_CLOSED) {
    return "border-emerald-400/85 bg-emerald-50/35 ring-1 ring-violet-300/45 shadow-[0_8px_22px_-14px_rgba(16,185,129,0.18)]"
  }
  return "border-emerald-200/85 bg-emerald-50/30 ring-1 ring-emerald-200/45"
}

const pickLatestQuery = (queries) => {
  if (!Array.isArray(queries) || queries.length === 0) return null
  return [...queries].sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0))[0]
}

const resolveFormForPatientQuery = (forms, queryRow, patient) => {
  if (!Array.isArray(forms) || forms.length === 0) return null

  const crfDataId = queryDtoPick(queryRow, "crfDataId", "CrfDataId")
  const crfDesignId = queryDtoPick(queryRow, "crfDesignId", "CrfDesignId")

  if (crfDataId) {
    const byCrfData = forms.find((f) => String(f.crfDataId) === String(crfDataId))
    if (byCrfData) return byCrfData

    const entry = (patient?.visitCrfData || []).find((v) => String(v?.crfDataId) === String(crfDataId))
    const rowNumber = toPositiveRowNumber(entry?.rowNumber)
    const designId = entry?.crfDesignId ?? entry?.crfDesignID ?? crfDesignId
    if (rowNumber) {
      const byRow = forms.find(
        (f) =>
          toPositiveRowNumber(f?.repeatableRowNumber) === rowNumber &&
          (!designId || String(f.crfDesignId) === String(designId)),
      )
      if (byRow) return byRow
    }
  }

  if (crfDesignId) {
    const designMatches = forms.filter((f) => String(f.crfDesignId) === String(crfDesignId))
    if (designMatches.length === 1) return designMatches[0]
    if (designMatches.length > 1 && crfDataId) {
      const withData = designMatches.find((f) => String(f.crfDataId) === String(crfDataId))
      if (withData) return withData
    }
  }

  return forms.length === 1 ? forms[0] : null
}

const stableStringifyRuleOverrides = (value) => {
  try {
    return JSON.stringify(value || {})
  } catch {
    return ""
  }
}

/** Stable stringify for per-control error maps (sorted keys) so validation bailouts do not thrash. */
const stableStringifyValidationSlice = (slice) => {
  if (slice == null) return "null"
  if (typeof slice !== "object") {
    try {
      return JSON.stringify(slice)
    } catch {
      return ""
    }
  }
  try {
    const keys = Object.keys(slice).sort()
    const norm = {}
    keys.forEach((k) => {
      norm[k] = slice[k]
    })
    return JSON.stringify(norm)
  } catch {
    return ""
  }
}

/** Props CRF-level rules may set — never persist full `control.properties` (huge + slow JSON compare). */
const CRF_RULE_OVERRIDE_PROP_KEYS = [
  "hidden",
  "readonly",
  "conditionallyRequired",
  "requiredIfCondition",
  "requiredIfMessage",
  "computedValue",
  "isComputed",
  "submitRule",
  "tableCellRuleProps",
]

const slimCrfRuleControlOverrides = (controlsToUpdate) => {
  if (!controlsToUpdate || typeof controlsToUpdate !== "object") return {}
  const out = {}
  for (const id of Object.keys(controlsToUpdate)) {
    const ctrl = controlsToUpdate[id]
    const full = ctrl?.properties
    if (!full || typeof full !== "object") continue
    const slimProps = {}
    for (const k of CRF_RULE_OVERRIDE_PROP_KEYS) {
      if (Object.prototype.hasOwnProperty.call(full, k)) slimProps[k] = full[k]
    }
    if (Object.keys(slimProps).length > 0) {
      out[id] = { id: ctrl.id || id, properties: slimProps }
    }
  }
  return out
}

/** Queries visible to the current user (submitter or reviewer). */
const filterQueriesForCurrentUser = (queries, loggedInUserId, { scopeToCurrentUser = true } = {}) => {
  if (!Array.isArray(queries)) return []
  if (!scopeToCurrentUser) {
    return queries.filter((q) => q?.isDeleted !== true && q?.IsDeleted !== true)
  }
  if (!loggedInUserId) return queries
  return queries.filter((q) => {
    const submittedBy = parseInt(String(getQueryAssignedToUserId(q) ?? ""), 10)
    const reviewerBy = parseInt(String(getQueryApproverUserId(q) ?? ""), 10)
    return (
      (Number.isFinite(submittedBy) && submittedBy === loggedInUserId) ||
      (Number.isFinite(reviewerBy) && reviewerBy === loggedInUserId)
    )
  })
}

const fieldIdMatchesControl = (fieldId, controlId) => {
  const fid = String(fieldId || "")
  const cid = String(controlId || "")
  return fid === cid || fid.startsWith(`${cid}__col_`) || fid.startsWith(`${cid}_row_`)
}

const normalizeGenderValue = (raw) => {
  const v = String(raw || "").trim().toLowerCase()
  if (!v) return ""
  if (v === "m" || v === "male") return "male"
  if (v === "f" || v === "female") return "female"
  return v
}

const addDaysToIsoDate = (isoDate, days) => {
  const normalized = normalizeIsoDateForBounds(isoDate)
  if (!normalized) return ""
  const [yyyy, mm, dd] = normalized.split("-").map((x) => Number(x))
  if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return ""
  const dt = new Date(yyyy, mm - 1, dd)
  if (Number.isNaN(dt.getTime())) return ""
  dt.setDate(dt.getDate() + Number(days || 0))
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, "0")
  const d = String(dt.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

const isVisitDateRestrictionDebugEnabled = () => {
  if (typeof window === "undefined") return true
  try {
    const raw = window.localStorage?.getItem("visitDateRestrictionDebug")
    if (raw == null) return false
    const v = String(raw).trim().toLowerCase()
    return v === "1" || v === "true" || v === "yes"
  } catch {
    return true
  }
}

const logVisitDateRestrictionDebug = (event, payload = {}) => {
  if (!isVisitDateRestrictionDebugEnabled()) return
  console.info("[VisitDateRestriction]", { event, ...payload })
}

const isComputeRuleDebugEnabled = () => {
  if (typeof window === "undefined") return false
  try {
    const raw = window.localStorage?.getItem("crfComputeDebug")
    if (raw == null) return false
    const v = String(raw).trim().toLowerCase()
    return v === "1" || v === "true" || v === "yes"
  } catch {
    return false
  }
}

const shouldTraceComputeRuleById = (ruleId) => {
  if (!isComputeRuleDebugEnabled()) return false
  try {
    if (typeof window === "undefined") return false
    const raw = window.localStorage?.getItem("crfComputeTraceRuleIds")
    if (!raw) return true
    const allow = new Set(
      String(raw)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    )
    if (allow.size === 0) return true
    return allow.has(String(ruleId ?? ""))
  } catch {
    return false
  }
}

const logComputeRuleDebug = (event, payload = {}) => {
  if (!shouldTraceComputeRuleById(payload?.ruleId)) return
  console.info("[CRFComputeDebug]", { event, ...payload })
}

const sanitizeRuleMessageText = (raw) =>
  String(raw || "")
    .split(DATE_RESTRICTION_RULE_MARKER)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim()

const dateFieldRenderTraceState = new Map()

const logDateFieldRenderTrace = (payload = {}) => {
  try {
    if (typeof window === "undefined") return
    const enabled =
      window.localStorage?.getItem("crfRulesDebug") === "1" ||
      window.localStorage?.getItem("crfRulesTraceDatePicker") === "1"
    if (!enabled) return
    const key = `${payload?.controlId || ""}|${payload?.readonly}|${payload?.disabled}|${payload?.value || ""}`
    const prev = dateFieldRenderTraceState.get(payload?.controlId || "")
    if (prev === key) return
    dateFieldRenderTraceState.set(payload?.controlId || "", key)
    if (dateFieldRenderTraceState.size > 200) dateFieldRenderTraceState.clear()
    console.info("[CRF Rules][DateRenderTrace]", payload)
  } catch {
    /* ignore diagnostics errors */
  }
}

const DEEP_TRACE_DEDUPE_WINDOW_MS = 1200
const deepTraceLastLoggedAt = new Map()

const deepTraceLog = (eventName, payload = {}, dedupeKey = "") => {
  try {
    if (typeof window === "undefined") return
    const explicitEnabled = window.localStorage?.getItem("crfRulesDeepTrace") === "1"
    const hasRuleList = Boolean(window.localStorage?.getItem("crfRulesDeepTraceRuleIds"))
    if (!explicitEnabled && !hasRuleList) return
    const key = dedupeKey || `${eventName}|${payload?.ruleId ?? ""}|${payload?.targetId ?? ""}|${payload?.cellKey ?? ""}`
    const now = Date.now()
    const last = deepTraceLastLoggedAt.get(key)
    if (last != null && now - last < DEEP_TRACE_DEDUPE_WINDOW_MS) return
    deepTraceLastLoggedAt.set(key, now)
    if (deepTraceLastLoggedAt.size > 800) deepTraceLastLoggedAt.clear()
    console.info(`[CRF Rules][DeepTrace] ${eventName}`, payload)
  } catch {
    /* ignore diagnostics failure */
  }
}

// Cache localStorage lookup once per page session so the keystroke-path
// (handleFormInputChange + rAF telemetry chain) does not hit localStorage on
// every input change. Devs toggle this flag and refresh the page anyway.
let __ecrfPerfTraceCached
const isEcrfPerfTraceEnabled = () => {
  if (__ecrfPerfTraceCached !== undefined) return __ecrfPerfTraceCached
  try {
    if (typeof window === "undefined") {
      __ecrfPerfTraceCached = false
      return false
    }
    __ecrfPerfTraceCached =
      window.localStorage?.getItem("ecrfPerfTrace") === "1"
    return __ecrfPerfTraceCached
  } catch {
    __ecrfPerfTraceCached = false
    return false
  }
}

const isEcrfDataEntryDebugEnabled = () => {
  try {
    if (typeof window === "undefined") return false
    return window.localStorage?.getItem("ecrfDataEntryDebug") === "1"
  } catch {
    return false
  }
}

/**
 * Memoised single-value `ControlRenderer` wrapper for the data-entry page.
 *
 * Why this exists (perf): the data-entry page renders 50-200+ controls per
 * CRF. The bare `ControlRenderer` receives the WHOLE form's `formValues` as
 * a prop, so every keystroke / click in any field invalidates the prop
 * reference for EVERY control and React re-runs each control's renderer
 * (for radio / checkbox especially that means re-rendering every option in
 * every other field). On large forms that produced 2-5s lag between
 * click and the visible "selected" paint.
 *
 * This wrapper passes a narrow `{ [control.id]: controlValue }` slice
 * instead, and is wrapped in `React.memo` so the default shallow compare
 * skips re-render when `control` (reference-stable for non-overridden
 * controls), `controlValue`, the boolean flags and the `onValueChange`
 * reference (stabilised in the page via `useCallback` + ref) are
 * unchanged.
 *
 * Safe usage: ONLY for control types where `ControlRenderer` reads a
 * single key from `formValues` — confirmed for radio, checkbox, select,
 * ukunkdate (see `components/crf-designer/ControlRenderer.jsx`). Do NOT
 * use for table controls; those legitimately read many keys (row/column
 * cells + row count) and require a different memoisation strategy.
 */
const MemoizedSingleValueControlRenderer = memo(
  function MemoizedSingleValueControlRendererBase({
    control,
    controlValue,
    isViewMode,
    isPreviewMode,
    onValueChange,
  }) {
    const narrowFormValues = useMemo(
      () => ({ [control?.id]: controlValue }),
      [control?.id, controlValue],
    )
    return (
      <ControlRenderer
        control={control}
        isViewMode={isViewMode}
        isPreviewMode={isPreviewMode}
        formValues={narrowFormValues}
        onValueChange={onValueChange}
      />
    )
  },
)

const shouldDeepTraceRule = (ruleId) => {
  const id = String(ruleId ?? "")
  if (!id) return false
  try {
    if (typeof window === "undefined") return false
    if (window.localStorage?.getItem("crfRulesDeepTrace") === "1") return true
    const raw = window.localStorage?.getItem("crfRulesDeepTraceRuleIds")
    if (!raw) return false
    return String(raw)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .includes(id)
  } catch {
    return false
  }
}

const shouldShowControlForPatientGender = (control, selectedPatient) => {
  const controlGender = normalizeGenderValue(control?.properties?.genderSpecific || "both")
  if (!controlGender || controlGender === "both") return true
  const patientGender = normalizeGenderValue(selectedPatient?.gender)
  if (!patientGender) return true
  return controlGender === patientGender
}

const normalizeComputedValueForTargetControl = (rawValue, targetControl) => {
  if (!targetControl) return rawValue
  const targetType = String(targetControl.type || "").toLowerCase()
  if (targetType !== "number") return rawValue
  const scaleRaw = targetControl?.properties?.scale
  const scale = Number.isFinite(Number(scaleRaw)) ? Math.max(0, Number(scaleRaw)) : null
  const numeric =
    typeof rawValue === "number"
      ? rawValue
      : typeof rawValue === "string" && rawValue.trim() !== ""
      ? Number(rawValue)
      : NaN
  if (!Number.isFinite(numeric)) return rawValue
  if (scale == null) return numeric
  // Respect "After Decimal Point" from designer for compute outputs (e.g. BMI -> 2 digits).
  return Number(numeric.toFixed(scale))
}

/**
 * Enforce designer "After Decimal Point" for manual number inputs.
 * - Keeps typing-friendly raw values like "1." / "-" unmodified.
 * - Otherwise rounds to `properties.scale` and returns a string for React `input[type=number]`.
 */
const normalizeManualNumberInputForScale = (rawValue, scaleRaw) => {
  const scale = Number.isFinite(Number(scaleRaw)) ? Math.max(0, Number(scaleRaw)) : null
  if (scale == null) return rawValue

  const raw = rawValue == null ? "" : rawValue
  const s = typeof raw === "string" ? raw : String(raw)
  const trimmed = s.trim()
  if (trimmed === "") return ""
  if (trimmed === "-" || trimmed.endsWith(".")) return s // preserve partial user typing

  // If there is no decimal point or decimals already <= scale, keep as user typed (no auto ".0").
  const dotIdx = trimmed.indexOf(".")
  if (dotIdx === -1) return s
  const fractionalLen = trimmed.length - dotIdx - 1
  if (fractionalLen <= scale) return s

  const numeric = Number(trimmed)
  if (!Number.isFinite(numeric)) return rawValue
  return numeric.toFixed(scale)
}

const parseAutoValueMapRules = (rulesText) => {
  const raw = String(rulesText || "")
  if (!raw.trim()) return {}
  const out = {}
  const chunks = raw
    .replace(/\r/g, "\n")
    .split(/\n|,/g)
    .map((part) => part.trim())
    .filter(Boolean)
  chunks.forEach((line) => {
    const match = line.match(/^(.+?)\s*(?:=>|->)\s*(.*)$/)
    if (!match) return
    const source = String(match[1] || "").trim()
    const target = String(match[2] || "").trim()
    if (!source) return
    out[source] = target
  })
  return out
}

// -------------------------
// Multi-CRF safety helpers
// -------------------------
// Centralize key normalization + matching so single-CRF and multi-CRF never diverge.
const ECRF_ENTRY_DEBUG = process.env.NEXT_PUBLIC_ECRF_ENTRY_DEBUG === "true"
const ecrfDebug = (...args) => {
  if (!ECRF_ENTRY_DEBUG) return
  // Prefix helps search logs quickly during debugging.
  console.log("[ECRF_ENTRY_DEBUG]", ...args)
}

const toScheduleKey = (scheduleId) => {
  if (scheduleId === undefined || scheduleId === null || scheduleId === "") return null
  return String(scheduleId)
}

const toDesignKey = (crfDesignId) => {
  if (crfDesignId === undefined || crfDesignId === null || crfDesignId === "") return "unknown"
  return String(crfDesignId)
}

const normalizeCrfStatusCode = (rawStatus) => {
  const normalized = (rawStatus ?? "").toString().trim().toLowerCase()
  if (normalized === "3" || normalized === "submitted" || normalized === "completed" || normalized === "locked") return 3
  if (normalized === "2" || normalized === "saved" || normalized === "inprogress" || normalized === "inprocess") return 2
  if (normalized === "1" || normalized === "draft" || normalized === "notstarted" || normalized === "pending") return 1
  return 1
}

const isBlockingSeverity = (severity) => {
  const normalized = (severity || "").toString().trim().toUpperCase()
  return normalized === "HARD" || normalized === "BLOCKING"
}

const isSoftSeverity = (severity) => {
  const normalized = (severity || "").toString().trim().toUpperCase()
  return normalized === "SOFT" || normalized === "WARNING"
}

/**
 * Only these categories should block submit when severity is HARD/BLOCKING.
 * Display-action categories (show/hide/enable/disable/compute) should never block submit.
 */
const isSubmitBlockingCategory = (category) => {
  const normalized = (category || "").toString().trim().toLowerCase()
  return normalized === "validation" || normalized === "submit" || normalized === "retro"
}

const isDateRestrictionCategory = (category) => {
  const normalized = (category || "").toString().trim().toLowerCase()
  return (
    normalized === "date_restriction" ||
    normalized === "daterestriction" ||
    normalized === "date restriction"
  )
}

const normalizePath = (value) => {
  const path = (value || "").toString().trim().toLowerCase()
  if (!path) return ""
  return path.startsWith("/") ? path : `/${path}`
}

/**
 * Query "Actual value" validation must stay aligned with CRF data entry:
 * - Resolve the field's control through the same sections + `getRuleAwareControl` as the grid.
 * - Run `validateControl` only (see `validateQueryModalActualValue` below).
 * New min/max/required/designer validation rules belong in `formValidation.js` / control props / rule pipeline —
 * no separate query-modal validators.
 *
 * Form flat keys use `tableId_row_R_col_C`; design lookup uses `tableId__col_C__row_R`.
 */
const resolveEvaluatedControlForQueryField = (
  selectedForm,
  currentFormSections,
  queryFieldId,
  getRuleAwareControl,
) => {
  const rawFid = String(queryFieldId || "").trim()
  if (!selectedForm || !rawFid || typeof getRuleAwareControl !== "function") return null
  const lookupId = normalizeQueryFieldIdForTableColumnLookup(rawFid)
  const queryFieldControl = findControlForQueryField(selectedForm, lookupId)
  const baseFieldId = stripQueryFieldDecorators(lookupId)
  const controlsFlat =
    (Array.isArray(currentFormSections) && currentFormSections.length > 0
      ? currentFormSections.flatMap((s) => (Array.isArray(s?.controls) ? s.controls : []))
      : []) || (Array.isArray(selectedForm?.section?.controls) ? selectedForm.section.controls : [])
  const sectionControl = controlsFlat.find((c) => String(c?.id || "") === baseFieldId)
  if (!sectionControl) return queryFieldControl
  const evaluated = getRuleAwareControl(sectionControl)
  const isTableCell =
    /(_row_\d+_col_\d+$)|(__col_\d+__row_\d+$)/.test(rawFid) &&
    String(sectionControl.type || "").toLowerCase() === "table" &&
    queryFieldControl
  if (!isTableCell) return evaluated || queryFieldControl
  return {
    ...evaluated,
    type: queryFieldControl.type,
    properties: {
      ...(evaluated?.properties || {}),
      ...(queryFieldControl?.properties || {}),
    },
  }
}

/** Single entry point for query Actual-value validation; delegates to `validateControl` (shared with CRF). */
const validateQueryModalActualValue = ({
  fieldId,
  draftValue,
  formSlice,
  selectedForm,
  currentFormSections,
  getRuleAwareControl,
  patientGender,
}) => {
  const fid = String(fieldId || "").trim()
  if (!fid || !selectedForm) return { isValid: true, errors: [] }
  const control = resolveEvaluatedControlForQueryField(
    selectedForm,
    currentFormSections,
    fid,
    getRuleAwareControl,
  )
  if (!control) return { isValid: true, errors: [] }
  const allFormValues = { ...(formSlice || {}), [fid]: draftValue }
  return validateControl(control, draftValue, allFormValues, {
    skipDateRestrictionValidation: true,
    patientGender,
  })
}

/** Match `ControlRenderer` number field: block "e" scientific notation in clinical numeric entry. */
const blockQueryNumberExponentKey = (event) => {
  if (event?.key === "e" || event?.key === "E") {
    event.preventDefault()
  }
}

const renderQueryActualEditorByControl = ({ control, value, onChange, disabled = false }) => {
  const type = String(control?.type || "").toLowerCase()
  const v = String(value ?? "")
  const props = control?.properties || {}
  const opts = normalizeQueryChoiceOptions(control)

  if ((type === "select" || type === "dropdown") && opts.length > 0) {
    return (
      <SearchableSelect
        disabled={disabled}
        value={v}
        onChange={(nextVal) => onChange(nextVal ?? "")}
        placeholder={control?.properties?.placeholder || "Select..."}
        options={opts.map((opt) => ({
          value: String(opt.value),
          label: opt.label,
        }))}
        className="border-slate-300 focus:border-emerald-400 focus:ring-emerald-100/70"
      />
    )
  }

  if ((type === "radio" || type === "checkbox") && opts.length > 0) {
    const runtimeId = "__query_actual__"
    const runtimeControl = {
      ...control,
      id: runtimeId,
      type: type === "checkbox" ? "checkbox" : "radio",
      properties: {
        ...(control?.properties || {}),
        options: opts.map((opt) => ({ value: String(opt.value), label: opt.label })),
      },
    }
    const runtimeValue =
      type === "checkbox"
        ? v
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean)
        : v
    return (
      <div className="mt-1">
        <ControlRenderer
          control={runtimeControl}
          isViewMode={disabled}
          isPreviewMode={!disabled}
          formValues={{ [runtimeId]: runtimeValue }}
          onValueChange={(_fieldId, next) => {
            if (type === "checkbox") {
              if (Array.isArray(next)) {
                onChange(next.map((x) => String(x)).join(", "))
                return
              }
              onChange(String(next ?? ""))
              return
            }
            onChange(stringifyQueryActualValue(next))
          }}
        />
      </div>
    )
  }

  if (type === "ukunkdate") {
    return (
      <UkUnkDatePicker
        value={v}
        onChange={(next) => onChange(next || "")}
        disabled={disabled}
        className="border-slate-300 focus-within:border-emerald-400 focus-within:ring-emerald-100/70"
      />
    )
  }

  if (type === "date") {
    return (
      <DatePicker
        value={v || null}
        onChange={(next) => onChange(next || "")}
        disabled={disabled}
        placeholder={control?.properties?.placeholder || "dd-mm-yyyy"}
        className="border-slate-300 focus-within:border-emerald-400 focus-within:ring-emerald-100/70"
      />
    )
  }

  if (type === "textarea") {
    return (
      <textarea
        rows={Number(props.rows) > 0 ? Number(props.rows) : 3}
        value={v}
        disabled={disabled}
        maxLength={props.maxLength ? Number(props.maxLength) : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 resize-none disabled:opacity-60"
        placeholder={props.placeholder || "Actual value in CRF"}
        aria-label="Actual value"
      />
    )
  }

  if (type === "number") {
    const scaleRaw = props.scale
    const scale = Number.isFinite(Number(scaleRaw)) ? Math.max(0, Number(scaleRaw)) : null
    const min = props.min !== null && props.min !== undefined && props.min !== "" ? props.min : undefined
    const max = props.max !== null && props.max !== undefined && props.max !== "" ? props.max : undefined
    const step = scale != null ? 10 ** -scale : undefined
    return (
      <input
        type="number"
        value={v}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        placeholder={props.placeholder || "Actual value in CRF"}
        onKeyDown={blockQueryNumberExponentKey}
        onChange={(e) => {
          const raw = e.target.value
          if (raw === "") {
            onChange("")
            return
          }
          const n = Number(raw)
          if (!Number.isFinite(n)) {
            onChange("")
            return
          }
          const out = scale == null ? raw : String(Number(n.toFixed(scale)))
          onChange(out)
        }}
        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 disabled:opacity-60"
        aria-label="Actual value"
      />
    )
  }

  if (type === "datetime" || type === "time") {
    const htmlType = type === "datetime" ? "datetime-local" : "time"
    return (
      <input
        type={htmlType}
        value={v}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 disabled:opacity-60"
        aria-label="Actual value"
      />
    )
  }

  return (
    <input
      type="text"
      value={v}
      disabled={disabled}
      maxLength={props.maxLength ? Number(props.maxLength) : undefined}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 disabled:opacity-60"
      placeholder={props.placeholder || "Actual value in CRF"}
      aria-label="Actual value"
    />
  )
}

/** Read-only: current CRF value for query modal (user edits the field on the form, not here). */

const safeDecode = (v) => {
  const s = v == null ? "" : String(v)
  if (!s) return ""
  try {
    return decodeHtmlEntities(s)
  } catch {
    return s
  }
}

// Backend/DB can sometimes treat values containing "<...>" as HTML and strip part of it.
// We escape angle brackets before saving, then decode on load so UI stays unchanged.
const encodeAngleBracketsForBackend = (v) => {
  if (v == null) return v
  if (typeof v !== "string") return v
  // Fast path: avoid allocations for most values.
  if (!v.includes("<") && !v.includes(">")) return v
  return v.replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

const hasSdvAuditPayloadValue = (value) => {
  if (value == null) return false
  if (typeof value === "string") return value.trim() !== ""
  if (typeof value === "number") return Number.isFinite(value)
  if (typeof value === "object") return Object.keys(value).length > 0
  return true
}

/** Standard SDV audit keys on every field node — null until backend sets them on CRA approve. */
const buildSdvAuditFieldsForSave = ({ auditMeta, sdvFieldKey }) => {
  const meta = auditMeta?.[sdvFieldKey]
  const at = meta?.sdvApprovedAt
  const by = meta?.sdvApprovedBy
  return {
    sdvApprovedAt: hasSdvAuditPayloadValue(at) ? at : null,
    sdvApprovedBy: hasSdvAuditPayloadValue(by) ? by : null,
  }
}

/** Deep-clone formData JSON and set isSdvApproved on every control-like node. */
const stampAllFieldsSdvApproved = (rawFormData) => {
  let parsed = rawFormData
  try {
    if (typeof parsed === "string") parsed = JSON.parse(parsed)
  } catch {
    return rawFormData
  }
  if (!parsed || typeof parsed !== "object") return rawFormData

  const walk = (node) => {
    if (node == null || typeof node !== "object") return node
    if (Array.isArray(node)) return node.map(walk)
    const out = {}
    for (const [key, value] of Object.entries(node)) {
      out[key] = walk(value)
    }
    const hasValue = Object.prototype.hasOwnProperty.call(out, "value")
    const hasIdOrLabel =
      Object.prototype.hasOwnProperty.call(out, "id") ||
      Object.prototype.hasOwnProperty.call(out, "label")
    const alreadySdv = Object.prototype.hasOwnProperty.call(out, "isSdvApproved")
    if (alreadySdv || (hasValue && hasIdOrLabel)) {
      out.isSdvApproved = true
    }
    return out
  }

  return walk(parsed)
}

/**
 * Reads isSdvApproved (+ optional audit meta) from saved nested/flat API formData.
 */
const extractSdvMapsFromSavedFormData = (rawFormData, formRuntimeId, getSdvFieldKeyFn) => {
  const selections = {}
  const approvals = {}
  const auditMeta = {}
  if (!rawFormData || formRuntimeId == null || typeof getSdvFieldKeyFn !== "function") {
    return { selections, approvals, auditMeta }
  }
  let parsed = rawFormData
  try {
    if (typeof parsed === "string") parsed = JSON.parse(parsed)
  } catch {
    return { selections, approvals, auditMeta }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { selections, approvals, auditMeta }
  }

  const visitField = (fieldId, raw) => {
    if (!fieldId || raw == null || typeof raw !== "object" || Array.isArray(raw)) return
    const k = getSdvFieldKeyFn(formRuntimeId, fieldId)
    if (Object.prototype.hasOwnProperty.call(raw, "isSdvApproved")) {
      const ok = Boolean(raw.isSdvApproved)
      selections[k] = ok
      approvals[k] = ok
    }
    const meta = {}
    if (Object.prototype.hasOwnProperty.call(raw, "sdvApprovedAt")) {
      meta.sdvApprovedAt = raw.sdvApprovedAt
    }
    if (Object.prototype.hasOwnProperty.call(raw, "sdvApprovedBy")) {
      meta.sdvApprovedBy = raw.sdvApprovedBy
    }
    if (Object.keys(meta).length > 0) auditMeta[k] = meta
  }

  const topKeys = Object.keys(parsed)
  const looksFlat = topKeys.some((k) => String(k || "").startsWith("ctrl_"))
  if (looksFlat) {
    topKeys.forEach((fid) => visitField(fid, parsed[fid]))
    return { selections, approvals, auditMeta }
  }
  topKeys.forEach((sectionKey) => {
    const section = parsed[sectionKey]
    if (!section || typeof section !== "object" || Array.isArray(section)) return
    Object.keys(section).forEach((fid) => visitField(fid, section[fid]))
  })
  return { selections, approvals, auditMeta }
}

/** Map query fieldId (flat or table cell) to parent control id for SDV/PI state keys. */
const resolveControlIdFromQueryFieldId = (fieldId) => {
  const flat = String(resolveQueryFieldIdToFormFlatKey(fieldId) || fieldId || "").trim()
  if (!flat) return ""
  const rowIdx = flat.indexOf("_row_")
  return rowIdx >= 0 ? flat.slice(0, rowIdx) : flat
}

const toRequiredQueryText = (v, fallback = "N/A") => {
  const t = safeDecode(v).replace(/\s+/g, " ").trim()
  return t || fallback
}

const resolveEcrfPermission = (menuPermissions, pathname) => {
  // Fallback to old behavior when permission payload is unavailable.
  if (!Array.isArray(menuPermissions) || menuPermissions.length === 0) {
    return { canView: true, canAdd: true, canEdit: true, canDelete: true, canExport: true }
  }

  const currentPath = normalizePath(pathname)
  const candidates = []
  const isManualPath = currentPath.includes("/ecrf-data-entry/manually")
  const isAiPath = currentPath.includes("/ecrf-data-entry/ai-based")

  // Prefer explicit sub-feature by code when route mapping is missing/inconsistent.
  if (isManualPath || isAiPath) {
    const matchedByCode = []
    menuPermissions.forEach((feature) => {
      if (!Array.isArray(feature?.subFeatures)) return
      feature.subFeatures.forEach((subFeature) => {
        const code = String(subFeature?.code || "").toUpperCase()
        if (isManualPath && code.includes("MANUALLY")) {
          matchedByCode.push(subFeature)
        }
        if (isAiPath && code.includes("AI")) {
          matchedByCode.push(subFeature)
        }
      })
    })
    if (matchedByCode.length > 0) {
      return resolveMenuNodePermissions(matchedByCode[0])
    }
  }

  menuPermissions.forEach((feature) => {
    const featureRoute = normalizePath(feature?.route)
    const featureMatch =
      featureRoute &&
      (currentPath === featureRoute ||
        currentPath.startsWith(`${featureRoute}/`) ||
        featureRoute.startsWith(`${currentPath}/`))
    if (featureMatch) candidates.push({ node: feature, routeLen: featureRoute.length, priority: 1 })

    if (Array.isArray(feature?.subFeatures)) {
      feature.subFeatures.forEach((subFeature) => {
        const subRoute = normalizePath(subFeature?.route)
        const subMatch =
          subRoute &&
          (currentPath === subRoute ||
            currentPath.startsWith(`${subRoute}/`) ||
            subRoute.startsWith(`${currentPath}/`))
        if (subMatch) candidates.push({ node: subFeature, routeLen: subRoute.length, priority: 2 })
      })
    }
  })

  const sorted = candidates.sort((a, b) => b.priority - a.priority || b.routeLen - a.routeLen)
  const picked = sorted[0]?.node

  if (!picked) {
    return { canView: true, canAdd: true, canEdit: true, canDelete: true, canExport: true }
  }

  return resolveMenuNodePermissions(picked)
}

const normalizeRoleCodeOrName = (value) => (value || "").toString().trim().toUpperCase()
const normalizeGuidValue = (value) => {
  const raw = (value || "").toString().trim()
  if (!raw) return ""
  const lowered = raw.toLowerCase()
  if (lowered === "00000000-0000-0000-0000-000000000000") return ""
  return lowered
}

const normalizeSettingLookupKey = (value) =>
  (value || "").toString().trim().toLowerCase().replace(/[^a-z0-9]/g, "")

const readCaseInsensitiveKey = (obj, lookupKey) => {
  if (!obj || typeof obj !== "object") return undefined
  const target = normalizeSettingLookupKey(lookupKey)
  if (!target) return undefined
  for (const [k, v] of Object.entries(obj)) {
    if (normalizeSettingLookupKey(k) === target) return v
  }
  return undefined
}

const readStudySettingValue = (payload, wantedKey) => {
  if (!payload || !wantedKey) return undefined
  const wantedNormalized = normalizeSettingLookupKey(wantedKey)
  if (!wantedNormalized) return undefined

  const direct =
    readCaseInsensitiveKey(payload, wantedKey) ??
    readCaseInsensitiveKey(payload?.studySetting, wantedKey)
  if (direct !== undefined) return direct

  const candidates = [
    ...(Array.isArray(payload?.studySettings) ? payload.studySettings : []),
    ...(Array.isArray(payload?.studySetting?.studySettings) ? payload.studySetting.studySettings : []),
    ...(Array.isArray(payload?.settings) ? payload.settings : []),
    ...(Array.isArray(payload?.studySetting?.settings) ? payload.studySetting.settings : []),
  ]
  for (const item of candidates) {
    if (!item || typeof item !== "object") continue
    const keyCandidate =
      item?.settingKey ??
      item?.SettingKey ??
      item?.key ??
      item?.Key ??
      item?.settingName ??
      item?.SettingName ??
      item?.name ??
      item?.Name ??
      item?.code ??
      item?.Code
    if (normalizeSettingLookupKey(keyCandidate) !== wantedNormalized) continue
    const val =
      item?.settingValue ??
      item?.SettingValue ??
      item?.value ??
      item?.Value ??
      item?.data ??
      item?.Data
    if (val !== undefined) return val
  }

  return undefined
}

const getRowBasedCrfAccess = (roleCodeOrName, rowNumber, isMultiCrfEnabled) => {
  if (!isMultiCrfEnabled) {
    return { canView: true, canEdit: true }
  }

  const role = normalizeRoleCodeOrName(roleCodeOrName)
  const row = Number(rowNumber)

  if (role === "ENDOSCOPIST") {
    // Endoscopist: row 1/2 can view+edit, row 3 should not be visible.
    if (row === 1 || row === 2) return { canView: true, canEdit: true }
    return { canView: false, canEdit: false }
  }

  if (role === "PATHOLOGIST") {
    // Pathologist: row 1 view-only, row 3 view+edit, row 2 hidden.
    if (row === 1) return { canView: true, canEdit: false }
    if (row === 3) return { canView: true, canEdit: true }
    return { canView: false, canEdit: false }
  }

  return { canView: true, canEdit: true }
}

/** Submitter user id on CrfData (used so TSI who submitted can correct data after submit). */
const getCrfRecordSubmitterUserId = (d) => {
  if (!d || typeof d !== "object") return null
  const raw =
    d.submittedByUserId ??
    d.SubmittedByUserId ??
    d.submittedBy ??
    d.SubmittedBy ??
    d.createdByUserId ??
    d.CreatedByUserId
  const n = parseInt(String(raw ?? ""), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

// visitCrfInfoByDesignId can be either:
// 1) nested: { [crfDesignId]: { crfDataId, status, crfDesignId, crfFormType } }
// 2) legacy single object: { crfDataId, status, crfDesignId, crfFormType }
const resolveCrfDataSlotForDesign = (visitCrfInfoByDesignId, crfDesignId) => {
  if (!visitCrfInfoByDesignId || typeof visitCrfInfoByDesignId !== "object") return null

  const designKey = toDesignKey(crfDesignId)

  // Nested match
  const directMatch = visitCrfInfoByDesignId?.[designKey]
  if (directMatch) return directMatch

  // Legacy match
  if (
    visitCrfInfoByDesignId.crfDesignId != null &&
    String(visitCrfInfoByDesignId.crfDesignId) === String(crfDesignId)
  ) {
    return visitCrfInfoByDesignId
  }

  // Single-CRF fallback for nested payloads stored under only one key (often "unknown")
  const keys = Object.keys(visitCrfInfoByDesignId)
  if (keys.length === 1) {
    const onlyVal = visitCrfInfoByDesignId[keys[0]]
    ecrfDebug("Single-slot fallback", { crfDesignId, onlyKey: keys[0] })
    if (onlyVal && typeof onlyVal === "object") return onlyVal
  }

  return null
}

/** Per-patient visit → design → CRF row metadata for form open / status chips. */
const buildPatientVisitCrfMap = (visitCrfDataList = []) => {
  const map = {}
  ;(visitCrfDataList || []).forEach((vcd) => {
    const scheduleKey = toScheduleKey(vcd?.visitScheduleId)
    if (!scheduleKey) return
    const designId = vcd.crfDesignId ?? vcd.crfDesignID ?? null
    const designKey = toDesignKey(designId)
    if (!map[scheduleKey]) map[scheduleKey] = {}
    map[scheduleKey][designKey] = {
      crfDataId: vcd.crfDataId,
      status: vcd.status,
      crfDesignId: designId,
      crfFormType: vcd.crfFormType,
      rowNumber: vcd.rowNumber ?? null,
      isSdvVerify: Boolean(vcd.isSdvVerify ?? vcd.IsSdvVerify),
      querySummary: normalizeCrfQuerySummary(vcd.querySummary ?? vcd.QuerySummary),
      progress: normalizeCrfProgress(vcd.progress ?? vcd.Progress),
    }
  })
  return map
}

const deriveVisitStatusFromCrfInfo = (visitCrfInfoByDesignId) => {
  if (!visitCrfInfoByDesignId || typeof visitCrfInfoByDesignId !== "object") return { status: "pending", progress: 0 }

  // Detect legacy single-object structure
  const isLegacy =
    visitCrfInfoByDesignId.crfDesignId != null &&
    (visitCrfInfoByDesignId.status != null || "status" in visitCrfInfoByDesignId)

  const values = isLegacy
    ? [visitCrfInfoByDesignId]
    : Object.values(visitCrfInfoByDesignId).filter(
        (v) => v && typeof v === "object" && ("status" in v || "crfDataId" in v)
      )

  const statuses = values.map((x) => (x?.status ?? "").toString().toLowerCase())
  const totalForms = values.length
  if (totalForms === 0) return { status: "pending", progress: 0 }

  const isSubmitted = (s) => s === "submitted" || s === "3"
  const isDraftOrSaved = (s) => s === "draft" || s === "saved" || s === "2" || s === "1"

  const completedCount = statuses.filter(isSubmitted).length
  const inProgressCount = statuses.filter(isDraftOrSaved).length

  if (completedCount === totalForms) {
    return { status: "completed", progress: 100 }
  }

  if (completedCount > 0 || inProgressCount > 0) {
    const progress = Math.round(((completedCount * 100) + (inProgressCount * 50)) / totalForms)
    return { status: "inprocess", progress }
  }

  return { status: "pending", progress: 0 }
}

/** Skip CRF-level rules whose targets are not on this form (other CRFs / deleted controls) — avoids full eval + console spam. */
function ruleTargetsExistOnForm(allControls, effectiveTargets, targetIds) {
  const list = Array.isArray(allControls) ? allControls : []
  const controlIds = new Set(list.map((c) => c.id))
  const ids =
    effectiveTargets && effectiveTargets.length > 0
      ? effectiveTargets.map((x) => x.targetId).filter(Boolean)
      : (targetIds || []).filter(Boolean)
  if (ids.length === 0) return true
  for (const id of ids) {
    if (controlIds.has(id)) return true
    const m = String(id).match(/^(.*)_row_\d+_col_\d+$/)
    if (m && controlIds.has(m[1])) {
      const tc = list.find((c) => c.id === m[1])
      if (tc && String(tc.type || "").toLowerCase() === "table") return true
    }
  }
  return false
}

function normalizeRuleTargetToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/[\s_-]+/g, "")
}

/**
 * Some designer payloads can send target fields by label/name instead of ctrl_* id.
 * Resolve those aliases to concrete control ids so compute/show/hide rules still apply.
 */
function resolveRuleTargetIdsOnForm(allControls, rawTargetIds) {
  const controls = Array.isArray(allControls) ? allControls : []
  const inputIds = Array.isArray(rawTargetIds) ? rawTargetIds : []
  if (inputIds.length === 0) return []

  const byAlias = new Map()
  controls.forEach((control) => {
    const id = String(control?.id || "").trim()
    if (!id) return
    const aliases = [
      id,
      control?.label,
      control?.properties?.labelText,
      control?.name,
      control?.properties?.name,
      control?.properties?.fieldName,
      control?.properties?.key,
    ]
    aliases.forEach((alias) => {
      const token = normalizeRuleTargetToken(alias)
      if (!token || byAlias.has(token)) return
      byAlias.set(token, id)
    })
  })

  const resolved = []
  inputIds.forEach((raw) => {
    const rawText = String(raw || "").trim()
    if (!rawText) return
    if (rawText.startsWith("ctrl_")) {
      resolved.push(rawText)
      return
    }
    const tableCellMatch = rawText.match(/^(.*)_row_(\d+)_col_(\d+)$/)
    if (tableCellMatch) {
      const mappedBaseId =
        byAlias.get(normalizeRuleTargetToken(tableCellMatch[1])) || tableCellMatch[1]
      resolved.push(`${mappedBaseId}_row_${tableCellMatch[2]}_col_${tableCellMatch[3]}`)
      return
    }
    const mapped = byAlias.get(normalizeRuleTargetToken(rawText)) || rawText
    resolved.push(mapped)
  })

  return [...new Set(resolved.filter(Boolean))]
}

/** Visit types the user may add repeatedly from manual data entry (aligned with visit schedule enum 4 / 5). */
const REPEATABLE_ENTRY_VISIT_ENUM = { unscheduled: 4, adverse: 5 }
const REPEATABLE_ENTRY_VISIT_LABEL = {
  unscheduled: "Unscheduled Visit",
  adverse: "Adverse Event",
}

function normalizeRepeatableToken(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "")
}

function getRepeatableKindFromValue(value) {
  const t = normalizeRepeatableToken(value)
  if (!t) return null
  if (t === "4" || t.includes("unscheduled")) return "unscheduled"
  if (t === "5" || t.includes("adverseevent") || (t.includes("adverse") && t.includes("event"))) return "adverse"
  return null
}

function toPositiveRowNumber(value) {
  const n = parseInt(String(value ?? ""), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function parseSavedRowNumberEntries(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (item == null) return null
      if (typeof item === "object") {
        const rowNumber = toPositiveRowNumber(item?.rowNumber)
        const crfDataId = parseInt(String(item?.crfDataId ?? ""), 10)
        return {
          rowNumber,
          crfDataId: Number.isFinite(crfDataId) && crfDataId > 0 ? crfDataId : null,
          crfDesignId: item?.crfDesignId ?? item?.crfDesignID ?? null,
        }
      }
      return {
        rowNumber: toPositiveRowNumber(item),
        crfDataId: null,
        crfDesignId: null,
      }
    })
    .filter((x) => x?.rowNumber != null)
}

/** Collapse visitType / crfFormType / name for matching API enums and strings (e.g. UnscheduledVisit, AdverseEvent). */
function visitRepeatableKindFingerprint(visit) {
  const parts = [visit?.visitType, visit?.crfFormType, visit?.name]
  return parts
    .map((x) => String(x ?? "").trim().toLowerCase().replace(/[\s_-]+/g, ""))
    .filter(Boolean)
}

function visitMatchesRepeatableEntryEnum(visit, enumVal) {
  const n = Number(visit?.visitType)
  if (Number.isFinite(n) && n === enumVal) return true
  const fp = visitRepeatableKindFingerprint(visit)
  if (fp.length === 0) return false
  if (enumVal === REPEATABLE_ENTRY_VISIT_ENUM.unscheduled) {
    return fp.some((t) => t === "4" || t.includes("unscheduled"))
  }
  if (enumVal === REPEATABLE_ENTRY_VISIT_ENUM.adverse) {
    return fp.some((t) => t === "5" || t.includes("adverseevent") || (t.includes("adverse") && t.includes("event")))
  }
  return false
}

const normalizeVisitDateRestrictionFormType = (raw) => {
  const token = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "")
  if (!token) return ""
  if (token === "screening" || token === "1") return "screening"
  if (token === "baseline" || token === "2") return "baseline"
  if (token === "visits" || token === "visit" || token === "3") return "visits"
  return token
}

const isVisitDateRestrictionFormTypeAllowed = (raw) => {
  const normalized = normalizeVisitDateRestrictionFormType(raw)
  return normalized === "screening" || normalized === "baseline" || normalized === "visits"
}

const isVisitDateIdentifierControl = (control) => {
  if (Boolean(control?.properties?.isVisitDate)) return true
  const rawLabel = control?.properties?.labelText || control?.label || ""
  const normalized = String(rawLabel)
    .trim()
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
  return (
    normalized === "visit date identifier" ||
    normalized === "date of patient's visit" ||
    normalized === "date of patients visit"
  )
}

const resolveVisitPrimaryDateRestrictionMinDate = ({
  enabled,
  visitPrimaryVisitDatesBySchedule,
  selectedVisit,
}) => {
  if (!enabled) return ""
  const selectedScheduleKey = toScheduleKey(selectedVisit?.visitScheduleId)
  if (!selectedScheduleKey) return ""
  const row = visitPrimaryVisitDatesBySchedule?.[selectedScheduleKey] || null
  const rawDate =
    row?.prevovisitPrimaryVisitDate ??
    row?.previousVisitPrimaryVisitDate ??
    row?.prevVisitPrimaryVisitDate ??
    null
  // Business rule: selected visit date must be AFTER previous primary visit date.
  // So if previous date is 2026-04-27, earliest allowed is 2026-04-28.
  return addDaysToIsoDate(rawDate, 1)
}

const hasVisitDateChainRowForSchedule = (chainMap, visitScheduleId) => {
  const key = toScheduleKey(visitScheduleId)
  if (!key) return false
  return Boolean(chainMap?.[key])
}

/**
 * Phase 3b-1 — Extracted memoized panel for manual + system query review modals.
 *
 * Defined as a module-level sibling of `ECRFDataEntryPage` so it has access to
 * the module-level helper functions (getQueryStatusPillClass, deriveExpectedActualAndBody, etc.)
 * without needing imports, while still gaining a `React.memo` render boundary.
 *
 * Why a memoized child here:
 * - Parent re-renders on every keystroke. Without this boundary the query review
 *   modal JSX (~400 lines, multiple IIFEs computing derived state) was rebuilt
 *   on every keystroke even when neither review modal is open.
 * - With React.memo + shallow prop compare, this entire subtree skips re-render
 *   when its specific props (review objects, drafts, errors) are unchanged.
 *
 * No behavior change: this is a literal extraction. Every conditional branch,
 * derived-state computation, click handler, and class string is preserved.
 */

export default function ECRFDataEntryPage() {
  // React Compiler opt-in (Next 16, annotation mode in `next.config.mjs`).
  // Lets the compiler auto-memoize the heavy render tree of this page.
  // To debug compiler bailouts, watch the dev console for warnings.
  // To temporarily disable on this component, replace with `'use no memo'`.
  "use memo"
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [selectedVisit, setSelectedVisit] = useState(null)
  const [selectedForm, setSelectedForm] = useState(null) // Selected form/section
  const [patients, setPatients] = useState([])
  const [loadingPatients, setLoadingPatients] = useState(false)

  // Study and Site from localStorage
  const { studyId, siteId } = useStudySiteContext()
  const { randomizationNumberEnabled } = usePatientIdentifierStudySettings(studyId)
  const eConsentCrfGate = useEConsentCrfGate(studyId)
  const eConsentBlocksSelectedPatient =
    eConsentCrfGate.isEConsentRequired &&
    Boolean(selectedPatient?.id) &&
    !eConsentCrfGate.isPatientEligible(selectedPatient.id)

  // Available forms/sections per visit
  const [availableFormsByVisit, setAvailableFormsByVisit] = useState({}) // { visitId: [forms] }
  const [loadingFormsByVisit, setLoadingFormsByVisit] = useState({}) // { visitId: boolean }
  const [showFormDropdown, setShowFormDropdown] = useState(null) // visitId for which dropdown is open

  // Store visit CRF data from patient list (for status calculation)
  const [visitCrfDataMap, setVisitCrfDataMap] = useState({}) // { visitScheduleId: { crfDataId, status, crfDesignId } }
  const visitCrfDataMapRef = useRef({})
  const applyVisitCrfDataMap = useCallback((mapOrUpdater) => {
    setVisitCrfDataMap((prev) => {
      const next =
        typeof mapOrUpdater === "function" ? mapOrUpdater(prev) : mapOrUpdater || {}
      visitCrfDataMapRef.current = next
      return next
    })
  }, [])
  // Dedicated visit-wise primary/previous primary date chain from new API.
  const [visitPrimaryVisitDatesBySchedule, setVisitPrimaryVisitDatesBySchedule] = useState({})
  const [isVisitDateChainLoading, setIsVisitDateChainLoading] = useState(false)
  const visitDateChainPendingCountRef = useRef(0)

  // Form data state - stores user input for each form
  const [formData, setFormData] = useState({}) // { formId: { controlId: value } }
  /**
   * Set before `setFormData` from a single field: `[controlId]` so control-level + CRF rules re-run only for related rules.
   * `['*']` or leaving null after effect = full rule pass (load, AI batch, table row ops, compute writes).
   * Consumed at start of the CRF-design rules effect (useRuleEvaluation reads the same ref during render first).
   */
  const dataEntryRuleDirtyKeysRef = useRef(null)
  const realtimeValidationDebounceRef = useRef(null)
  // Per-control coalesce for the radio/optionbutton fast-path so that a
  // burst of rapid clicks on the SAME control collapses into ONE commit
  // (last value wins) instead of queuing one `setTimeout(0)` macrotask
  // per click. Each backlogged commit ran its own `startTransition` →
  // `setFormData` → rule-evaluation chain; on a large CRF that backlog
  // saturated the renderer process and Edge killed the tab with
  // "This page couldn't load". Map<controlId, { tid, latestValue }>.
  const radioFastPathCommitTimersRef = useRef(new Map())
  // Snapshot of which controls were rule-hidden on the previous rule cycle,
  // scoped to a (formId, formSectionLayoutKey). Used by the
  // "rule_show_reapply_defaults" effect to detect hidden -> visible
  // transitions instead of re-firing setFormData on every rule cycle
  // (which under rapid radio clicks compounds with Radix composeRefs and
  // hits React's "Maximum update depth exceeded" guard).
  const previouslyHiddenControlIdsRef = useRef({ formId: null, layoutKey: null, hiddenIds: null })
  /** Baseline for clear-on-hide — skip bootstrap pass so loaded API values are not wiped. */
  const previouslyHiddenForClearRef = useRef({ formId: null, layoutKey: null, hiddenIds: null })
  /** Snapshot of rule-readonly controls — only clear values on enable→readonly transitions, not on load. */
  const previouslyRuleReadonlyControlIdsRef = useRef({
    formId: null,
    layoutKey: null,
    readonlyIds: null,
    tableCellIds: null,
  })
  /** Re-seed hide/readonly transition baselines after API hydrate or form switch. */
  const resetRuleTransitionBaselineRefs = useCallback(() => {
    previouslyHiddenForClearRef.current = { formId: null, layoutKey: null, hiddenIds: null }
    previouslyHiddenControlIdsRef.current = { formId: null, layoutKey: null, hiddenIds: null }
    previouslyRuleReadonlyControlIdsRef.current = {
      formId: null,
      layoutKey: null,
      readonlyIds: null,
      tableCellIds: null,
    }
  }, [])
  const ecrfPerfTraceSessionRef = useRef(`sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`)
  const ecrfPerfTraceSeqRef = useRef(0)
  const ecrfPerfLastScrollLogRef = useRef(0)
  const ecrfPerfLastUiIntentRef = useRef({ type: "unknown", atMs: 0, detail: "" })
  const lastStudySiteScopeRef = useRef(null)
  const formDataRef = useRef(formData)
  const selectedFormRef = useRef(selectedForm)
  const [currentFormStatus, setCurrentFormStatus] = useState(null) // Current status of the form being edited
  const [saving, setSaving] = useState(false) // Loading state for save operations
  const [sdvVerifySaving, setSdvVerifySaving] = useState(false)
  const [allVisitsSdvSaving, setAllVisitsSdvSaving] = useState(false)
  const [allVisitsPiSaving, setAllVisitsPiSaving] = useState(false)
  const [allVisitsPiDialog, setAllVisitsPiDialog] = useState({
    open: false,
    patient: null,
    entries: [],
  })
  const [piFieldSignoffSaving, setPiFieldSignoffSaving] = useState(false)
  const [piFieldPasswordDialog, setPiFieldPasswordDialog] = useState({
    open: false,
    sectionIds: [],
    mode: "apply",
  })
  const saveRequestInFlightRef = useRef(false)

  const logEcrfPerf = useCallback((event, payload = {}) => {
    if (!isEcrfPerfTraceEnabled()) return
    const nowMs = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()
    ecrfPerfTraceSeqRef.current += 1
    console.info("[ECRF PerfTrace]", {
      session: ecrfPerfTraceSessionRef.current,
      seq: ecrfPerfTraceSeqRef.current,
      tsMs: Math.round(nowMs),
      event,
      formId: selectedFormRef.current?.id ?? null,
      ...payload,
    })
  }, [])
  
  // Validation errors state - stores validation errors for each control
  const [validationErrors, setValidationErrors] = useState({}) // { formId: { controlId: [errors] } }

  // Phase 3c-2: mirror validation errors into thin store for future per-control subscribers.
  useEffect(() => {
    useEcrfEntryStore.getState().setValidationErrors(validationErrors)
  }, [validationErrors])
  
  // CRF-level rules state - stores CRF-level rule messages
  const [crfRuleMessages, setCrfRuleMessages] = useState([]) // Array of rule messages
  // CRF queries for current record (manual + system) — loaded from API when CRM reviewer is in review context.
  const [crfQueriesFromApi, setCrfQueriesFromApi] = useState([])
  /** All CRF queries for selected patient (study + site + patientEnrolmentId) — right-panel grid. */
  const [patientQueriesList, setPatientQueriesList] = useState([])
  const [loadingPatientQueriesList, setLoadingPatientQueriesList] = useState(false)
  const [patientQuerySearch, setPatientQuerySearch] = useState("")
  const [patientQueryPage, setPatientQueryPage] = useState(1)
  const [patientQueryVisitScheduleId, setPatientQueryVisitScheduleId] = useState(null)
  /** Bumps so handleSaveCrfData (defined above list loaders) can refresh the queries grid. */
  const [patientQueriesRefreshTick, setPatientQueriesRefreshTick] = useState(0)
  /** Primary patient-area view: visits list vs patient-wise query grid. */
  const [patientMainTab, setPatientMainTab] = useState("visits")
  const [crmSystemQueryReview, setCrmSystemQueryReview] = useState(null)
  const [manualQueryReview, setManualQueryReview] = useState(null)
  const [manualReviewerCommentDraft, setManualReviewerCommentDraft] = useState("")
  const [manualSubmittedCommentDraft, setManualSubmittedCommentDraft] = useState("")
  /** Inline validation for query modal "Actual value" (same rules as CRF via validateControl). */
  const [manualQueryActualErrors, setManualQueryActualErrors] = useState([])
  const [systemQueryActualErrors, setSystemQueryActualErrors] = useState([])
  const [queryModalSaving, setQueryModalSaving] = useState(false)
  const [systemQueryCommentDraft, setSystemQueryCommentDraft] = useState("")
  const [systemQuerySubmitterCommentDraft, setSystemQuerySubmitterCommentDraft] = useState("")
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const [crfProgressDetail, setCrfProgressDetail] = useState(null)
  const [loadingCrfProgress, setLoadingCrfProgress] = useState(false)
  const [visitSectionProgressByVisitId, setVisitSectionProgressByVisitId] = useState({})
  const [queryDraft, setQueryDraft] = useState({
    fieldId: "",
    fieldLabel: "",
    controlType: "",
    isTableQuery: false,
    controlOptions: [],
    tableColumnIndex: "",
    tableColumnLabel: "",
    tableRowIndex: "",
    tableRowLabel: "",
    tableColumnOptions: [],
    tableRowOptions: [],
    expectedCondition: "",
    actualValue: "",
    queryText: "",
    reviewerComment: "",
  })

  // Cache for CRF data to prevent duplicate API calls
  const crfDataCacheRef = useRef({}) // { patientId: { data: [...], timestamp: number } }
  const crfDataByIdCacheRef = useRef({}) // { `${studyId}_${crfDataId}`: { data, timestamp } }
  const crfFormLoadGenerationRef = useRef(0)
  const handleFormSelectRef = useRef(null)
  const crfDesignPayloadCacheRef = useRef({}) // { `${studyId}_${designId}`: designPayload }
  const crfRulesCacheRef = useRef({}) // { `${studyId}_${designId}`: rules[] }
  const visitFormsTemplateCacheRef = useRef({}) // { `${studyId}_${visitId}`: form[] without patient crf meta }
  const fetchFormsForVisitInFlightRef = useRef({}) // { visitId: Promise<form[]> }
  const fetchingCrfDataRef = useRef(false) // Prevent concurrent CRF data fetches
  const lastSelectedPatientRef = useRef(null) // Track last selected patient to prevent duplicate processing
  const isProcessingPatientRef = useRef(false) // Prevent concurrent patient processing
  const selectedPatientRef = useRef(null) // Sync patient for async handlers before React re-renders
  const pendingOpenQueriesTabRef = useRef(false) // Open query tab after auto-selecting a patient
  const pendingQueryVisitScheduleIdRef = useRef(null) // Visit filter when opening queries from a matrix cell
  const pendingQueryFieldNavigationRef = useRef(null) // Scroll/highlight after opening CRF from query grid
  const queryFieldNavigationClearTimeoutRef = useRef(null)
  const [navigatedQueryFieldKey, setNavigatedQueryFieldKey] = useState(null)
  const repeatableOpenSyncSignatureRef = useRef(null) // Prevent duplicate sync fetches for open repeatable groups
  const prefetchedVisitSectionProgressRef = useRef(new Set())

  // Visit schedules fetched from API
  const [visits, setVisits] = useState([])
  const [loadingVisits, setLoadingVisits] = useState(false)
  const [addingRepeatableVisitKind, setAddingRepeatableVisitKind] = useState(null)
  const [recentlyAddedVisitId, setRecentlyAddedVisitId] = useState(null)
  const addedVisitHighlightTimeoutRef = useRef(null)
  const [pendingRepeatableRowsByPatient, setPendingRepeatableRowsByPatient] = useState({})

  // Error message state
  const [errorMessage, setErrorMessage] = useState("")
  const [mobilePatientPanelOpen, setMobilePatientPanelOpen] = useState(true)
  const [matrixStatusFilter, setMatrixStatusFilter] = useState("all")
  const [matrixVisitFilter, setMatrixVisitFilter] = useState("all")

  // Modal states (used by save/update actions)
  const [errorModal, setErrorModal] = useState({ open: false, message: "" })
  const [auditReasonModal, setAuditReasonModal] = useState({
    open: false,
    status: null,
    options: null,
    changedFields: [],
    mode: "save",
    pendingSectionId: null,
    verificationContext: null,
  })
  const [auditReasonModalVisible, setAuditReasonModalVisible] = useState(false)
  const [auditReasonModalClosing, setAuditReasonModalClosing] = useState(false)
  const [optimisticControlValues, setOptimisticControlValues] = useState({})
  const optimisticControlValuesRef = useRef(optimisticControlValues)
  const [auditChangeReason, setAuditChangeReason] = useState("")
  const [recentAuditSyncedFields, setRecentAuditSyncedFields] = useState({})
  const auditSyncedFadeTimeoutRef = useRef(null)
  const auditSyncedClearTimeoutRef = useRef(null)
  const lastAuditTouchedFieldRef = useRef({ formId: null, controlId: "" })
  const auditReasonDebugRef = useRef(false)
  // "Light audit" fields: user must explicitly unlock with pencil, then confirm with check.
  const [auditLightEditModeById, setAuditLightEditModeById] = useState({})
  const [auditLightDirtyById, setAuditLightDirtyById] = useState({})
  const [savingAuditReason, setSavingAuditReason] = useState(false)

  // Smooth open/close for the reason modal (avoid unmount flicker).
  useEffect(() => {
    if (auditReasonModal?.open) {
      setAuditReasonModalVisible(true)
      setAuditReasonModalClosing(false)
      return
    }
    if (auditReasonModalVisible) {
      setAuditReasonModalVisible(false)
      setAuditReasonModalClosing(false)
    }
  }, [auditReasonModal?.open, auditReasonModalVisible])

  const [formAuditBaselineById, setFormAuditBaselineById] = useState({})
  const [preCapturedAuditReason, setPreCapturedAuditReason] = useState("")
  const [lastVisitModal, setLastVisitModal] = useState({
    open: false,
    step: 1,
    completedYes: null,
    selectedStatusCode: null,
    submitting: false,
  })
  /** Study Completion Form gateway — choices apply on Submit only (status API then CRF save). */
  const [studyCompletionEntryGate, setStudyCompletionEntryGate] = useState({
    completedStudy: null,
    terminalStatusCode: null,
  })
  const [showScreeningFailedModal, setShowScreeningFailedModal] = useState(false)
  const [showRandomizedEnrolledModal, setShowRandomizedEnrolledModal] = useState(false)
  /** Disables modal buttons while updatePatientStatus is in flight, avoiding double-confirm. */
  const [screeningFailedSubmitting, setScreeningFailedSubmitting] = useState(false)
  const [submitPopupFlow, setSubmitPopupFlow] = useState({
    active: false,
    showRandomizedAfterScreening: false,
    totalSteps: 1,
  })
  /** Global confirm before submit (after validation): submit locks editing; user can save draft instead. Runs before screening / last-visit / audit chain. */
  const [submitConfirmModalOpen, setSubmitConfirmModalOpen] = useState(false)
  const [saveSuccessPopup, setSaveSuccessPopup] = useState({
    open: false,
    title: "",
    description: "",
  })

  const closeSaveSuccessPopup = useCallback(() => {
    setSaveSuccessPopup((prev) => ({ ...prev, open: false }))
  }, [])

  // Close submit confirmation when scope changes so no stale overlay blocks list/navigation actions.
  useEffect(() => {
    setSubmitConfirmModalOpen(false)
  }, [studyId, siteId, selectedPatient?.id, selectedVisit?.visitScheduleId, selectedForm?.id])

  // Active section tab in data entry form (when form has multiple sections - show tabs like designer preview)
  const [activeDataEntrySectionId, setActiveDataEntrySectionId] = useState(null)
  const [highlightSectionErrors, setHighlightSectionErrors] = useState(false)
  const [loadingSelectedCrfForm, setLoadingSelectedCrfForm] = useState(false)
  const currentRenderFormValues = useMemo(() => {
    if (!selectedForm?.id || loadingSelectedCrfForm) return {}
    return {
      ...(formData[selectedForm.id] || {}),
      ...optimisticControlValues,
    }
  }, [selectedForm?.id, formData, optimisticControlValues, loadingSelectedCrfForm])
  /** Section tab buttons (multi-section CRF) — keep active tab scrolled into view in overflow-x bar */
  const sectionTabButtonRefs = useRef(new Map())
  // Stable section-tab button ref callback. Previously the ref was
  // declared inline at the JSX site, which created a fresh function
  // on every render — forcing React to detach + attach on each render
  // and adding commit-phase ref churn that compounded with any Radix
  // composeRefs cascade. With a single useCallback identity, React
  // attaches the ref once per mount and re-uses it across re-renders.
  // The button passes its section id via data-section-id, and React 19
  // ref-cleanup returns the unmount handler that deletes the map entry.
  const setSectionTabButtonRef = useCallback((el) => {
    if (!el) return undefined
    const id = el.dataset?.sectionId
    if (!id) return undefined
    sectionTabButtonRefs.current.set(id, el)
    return () => {
      sectionTabButtonRefs.current.delete(id)
    }
  }, [])
  /** Full-page CRF modal body (`overflow-y-auto`) — reset scroll when section changes */
  const dataEntryCrfScrollContainerRef = useRef(null)
  const [dataEntryControlRenderLimit, setDataEntryControlRenderLimit] = useState(140)
  const [isMultiCrfAllowedPerVisitType, setIsMultiCrfAllowedPerVisitType] = useState(true)
  const [isPatientStatusEnabled, setIsPatientStatusEnabled] = useState(false)
  const [isVisitDateRestrictionEnabled, setIsVisitDateRestrictionEnabled] = useState(false)
  const [isPiSignoffRequired, setIsPiSignoffRequired] = useState(false)
  const [isPiSignoffBulkEnabled, setIsPiSignoffBulkEnabled] = useState(false)
  const [piReviewOrder, setPiReviewOrder] = useState(PI_REVIEW_ORDER.SDV_BEFORE_SIGN)
  const [piSignoffGranularity, setPiSignoffGranularity] = useState("crf_only")
  const [queryRaiseRoleGuidsByStudy, setQueryRaiseRoleGuidsByStudy] = useState([])
  const [sdvRoleGuidsByStudy, setSdvRoleGuidsByStudy] = useState([])
  const [piSignoffRoleGuidsByStudy, setPiSignoffRoleGuidsByStudy] = useState([])
  const [isStudySettingsLoading, setIsStudySettingsLoading] = useState(true)
  const [studySettingsResolvedStudyId, setStudySettingsResolvedStudyId] = useState(null)
  const [isFormReadOnlyByPermission, setIsFormReadOnlyByPermission] = useState(false)
  /** Submitter id from last getCrfDataById load (for TSI post-submit correction). */
  const [crfSubmittedByUserId, setCrfSubmittedByUserId] = useState(null)

  // AI-based route: show voice + upload fill (Gemini) when study enables Capture AI
  const pathname = usePathname()
  const isAiBasedRoute = pathname?.includes("ai-based") ?? false
  const {
    isAiEntryEnabled,
    isAiQualityHintsEnabled,
    isAiInsightEnabled,
    loading: aiSettingsLoading,
  } = useStudyAiSettings()
  const isAIMode = isAiBasedRoute && isAiEntryEnabled && !aiSettingsLoading
  const ecrfPermission = useMemo(
    () => resolveEcrfPermission(authService.getMenu?.(), pathname),
    [pathname],
  )
  const visitAttachmentPermission = useMemo(() => {
    const dedicated = resolveSubFeatureMenuPermissions(
      authService.getMenu?.(),
      "VISIT_ATTACHMENTS",
    )
    if (dedicated.found) {
      return dedicated
    }
    // Legacy fallback until VISIT_ATTACHMENTS sub-feature is seeded in role permissions.
    return {
      found: false,
      canView: ecrfPermission.canView,
      canAdd: ecrfPermission.canAdd,
      canEdit: false,
      canDelete: ecrfPermission.canDelete,
      canExport: false,
    }
  }, [pathname, ecrfPermission])
  const userRoleCodeOrName = useMemo(() => {
    const u = authService.getUser?.() || {}
    return normalizeRoleCodeOrName(u?.roleCode || u?.roleName)
  }, [])
  const loggedInUserRoleGuid = useMemo(() => {
    const u = authService.getUser?.() || {}
    return normalizeGuidValue(u?.roleGuid ?? u?.RoleGuid)
  }, [])
  const {
    gates: studyPermGates,
    loading: studyPermsLoading,
    matrixLoadedFromApi,
    useLegacyPermissions,
    studyUsesRolePermissionMatrix,
    permissions: studyEffectivePermissions,
    permissionMeta: studyPermissionMeta,
  } = useStudyPermissionGates(studyId, siteId, {
    menuCanView: ecrfPermission.canView,
    menuCanEdit: ecrfPermission.canAdd || ecrfPermission.canEdit,
    userRoleGuid: loggedInUserRoleGuid,
    queryRaiseRoleGuids: queryRaiseRoleGuidsByStudy,
    sdvRoleGuids: sdvRoleGuidsByStudy,
    piSignoffRoleGuids: piSignoffRoleGuidsByStudy,
  })
  const {
    getVisitPiCounts,
    items: piPendingItems,
    reload: reloadPiPendingSummary,
  } = useStudyPiPendingSummary(studyId, {
    enabled: isPiSignoffRequired && Boolean(studyId),
  })
  const { isLocked: isStudyDbLocked, lockMeta: studyDbLockMeta } = useStudyLockStatus(
    studyId,
    siteId,
    selectedForm?.crfDataId,
  )
  const [isPiSigned, setIsPiSigned] = useState(false)
  const [piSignoffRefreshToken, setPiSignoffRefreshToken] = useState(0)

  const handlePiSignoffGranularityFromRecord = useCallback((granularity) => {
    if (!granularity) return
    setPiSignoffGranularity((prev) => (prev === granularity ? prev : granularity))
  }, [])

  useEffect(() => {
    setIsPiSigned(false)
  }, [selectedForm?.crfDataId])
  const isCrmReviewer = useMemo(
    () => (userRoleCodeOrName || "").toUpperCase().includes("CRM"),
    [userRoleCodeOrName]
  )
  // CRA detection — role GUID is the authoritative source (`CRA_ROLE_GUID`),
  // with the historic role-code/name substring check kept as a backward-compat
  // fallback for legacy users whose `roleGuid` is not yet on the user payload.
  const isCraReviewer = useMemo(() => {
    if (loggedInUserRoleGuid && loggedInUserRoleGuid === CRA_ROLE_GUID) return true
    const role = (userRoleCodeOrName || "").toUpperCase().replace(/\s+/g, "")
    return role === "CRA" || role.includes("CRA")
  }, [loggedInUserRoleGuid, userRoleCodeOrName])
  /** Site CRC / coordinator — table audit pencils should not appear on submitted CRFs (same UX as CRA). */
  const isCrcReviewer = useMemo(() => {
    // Authoritative CRA-GUID short-circuit — keeps `isCrcReviewer` consistent
    // with the new GUID-primary CRA detection (a CRA user must never be
    // classified as CRC even when role-name strings overlap).
    if (loggedInUserRoleGuid && loggedInUserRoleGuid === CRA_ROLE_GUID) return false
    const role = (userRoleCodeOrName || "").toUpperCase()
    const compact = role.replace(/\s+/g, "")
    if (compact.includes("CRA")) return false
    return role.includes("CRC") || compact === "CRC"
  }, [loggedInUserRoleGuid, userRoleCodeOrName])
  const currentFormStatusForSdv = Number.parseInt(String(currentFormStatus ?? ""), 10)
  const canVerifySdvForStudy = studyPermGates.canVerifySdv
  const canShowSdvPerField =
    canVerifySdvForStudy &&
    isSdvConfigured(sdvRoleGuidsByStudy) &&
    !isStudySettingsLoading &&
    (currentFormStatusForSdv === 2 || currentFormStatusForSdv === 3)
  const canShowPiPerField =
    isPiSignoffRequired &&
    isFieldPiSignoffEnabled(piSignoffGranularity) &&
    studyPermGates.canPiSignoff &&
    !isStudySettingsLoading &&
    currentFormStatusForSdv === 3
  const [sdvSelectionsByField, setSdvSelectionsByField] = useState({})
  const [sdvApprovedByField, setSdvApprovedByField] = useState({})
  const [piSelectionsByField, setPiSelectionsByField] = useState({})
  const [piSignedByField, setPiSignedByField] = useState({})
  /** Latest SDV verification flags for saves (avoid stale closures when firing save after Verify). */
  const sdvApprovedByFieldRef = useRef({})
  const sdvSelectionsByFieldRef = useRef({})
  const piSignedByFieldRef = useRef({})
  const piAuditMetaByFieldRef = useRef({})
  /** Backend sdvApprovedAt / sdvApprovedBy per field — round-trip on edit; null placeholders only on first create. */
  const sdvAuditMetaByFieldRef = useRef({})
  const getSdvFieldKey = useCallback((formId, controlId) => `${String(formId || "")}::${String(controlId || "")}`, [])
  const hasAnyMeaningfulValue = useCallback((value) => {
    if (value == null) return false
    if (Array.isArray(value)) return value.some((v) => hasAnyMeaningfulValue(v))
    if (typeof value === "object") return Object.values(value).some((v) => hasAnyMeaningfulValue(v))
    const s = String(value).trim()
    return s !== "" && s !== "undefined" && s !== "null"
  }, [])
  const hasSdvValueForControl = useCallback(
    (formId, controlId, controlValue, isTableControl) => {
      const currentFormSlice = formData?.[formId] || {}
      if (isTableControl) {
        const tablePrefix = `${controlId}_row_`
        const tableKeys = Object.keys(currentFormSlice).filter((k) =>
          String(k).startsWith(tablePrefix),
        )
        if (tableKeys.length === 0) return false
        return tableKeys.some((k) => hasAnyMeaningfulValue(currentFormSlice[k]))
      }
      return hasAnyMeaningfulValue(controlValue)
    },
    [formData, hasAnyMeaningfulValue],
  )

  /**
   * Per-render index of the current form slice's table-row keys, grouped by
   * the parent table control id. Built in a single O(N) pass over the slice
   * (where N = total keys in the active form's data).
   *
   * Used by table renderers to replace per-table O(N) IIFEs (which were
   * scanning the entire form slice on EVERY render of EVERY table on every
   * keystroke — the dominant render cost on small CRFs).
   *
   * Resulting access pattern: O(1) lookup per table → O(M) per table where M
   * is only that table's row keys, instead of scanning all unrelated controls'
   * keys.
   */
  const tableRowKeyIndexForCurrentForm = useMemo(() => {
    const formId = selectedForm?.id
    if (!formId) return EMPTY_TABLE_ROW_INDEX
    const slice = formData?.[formId]
    if (!slice || typeof slice !== "object") return EMPTY_TABLE_ROW_INDEX
    const allKeysByTable = {}
    const populatedKeysByTable = {}
    const tableRowKeyPattern = /^(.+?)_row_\d+_col_\d+$/
    const keys = Object.keys(slice)
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i]
      const match = tableRowKeyPattern.exec(key)
      if (!match) continue
      const tableId = match[1]
      if (!allKeysByTable[tableId]) allKeysByTable[tableId] = []
      allKeysByTable[tableId].push(key)
      if (hasAnyMeaningfulValue(slice[key])) {
        if (!populatedKeysByTable[tableId]) populatedKeysByTable[tableId] = []
        populatedKeysByTable[tableId].push(key)
      }
    }
    return { allKeysByTable, populatedKeysByTable }
  }, [selectedForm?.id, formData, hasAnyMeaningfulValue])

  const getSdvEligibleControlIdsAcrossForm = useCallback(() => {
    if (!canShowSdvPerField || !selectedForm?.id) return []
    const currentFormSlice = formData?.[selectedForm.id] || {}
    const out = []
    // Inline equivalent of `sectionsWithContentForDataEntry` to avoid referencing
    // a later-initialized const (TDZ) inside this early callback.
    const displaySections =
      selectedForm?.crfDesign?.sections && selectedForm.crfDesign.sections.length > 0
        ? selectedForm.crfDesign.sections
        : selectedForm?.section
          ? [selectedForm.section]
          : []
    const sections = resolveSectionsForDataEntry(displaySections)

    ;(sections || []).forEach((section) => {
      ;(section?.controls || []).forEach((control) => {
        const evaluatedControl = getRuleAwareControl(control)
        if (!shouldShowControlForPatientGender(evaluatedControl, selectedPatient)) return
        if (evaluatedControl?.properties?.hidden) return
        const controlTypeLower = String(evaluatedControl?.type || "").toLowerCase()
        if (!SDV_ELIGIBLE_CONTROL_TYPES.has(controlTypeLower)) return
        const controlIdStr = String(control?.id || "").trim()
        if (!controlIdStr) return
        if (controlTypeLower === "table") {
          const prefix = `${controlIdStr}_row_`
          Object.keys(currentFormSlice).forEach((k) => {
            const key = String(k || "")
            if (!key.startsWith(prefix)) return
            if (hasAnyMeaningfulValue(currentFormSlice[key])) out.push(key)
          })
          return
        }
        if (
          hasSdvValueForControl(
            selectedForm.id,
            controlIdStr,
            currentFormSlice?.[control.id] ?? "",
            false,
          )
        ) {
          out.push(controlIdStr)
        }
      })
    })
    return [...new Set(out)]
  }, [
    canShowSdvPerField,
    selectedForm?.id,
    formData,
    selectedPatient,
    hasAnyMeaningfulValue,
    hasSdvValueForControl,
  ])

  const setSdvChecked = useCallback(
    (formId, controlId, checked) => {
      const key = getSdvFieldKey(formId, controlId)
      const normalizedChecked = Boolean(checked)
      setSdvSelectionsByField((prev) => ({ ...prev, [key]: normalizedChecked }))
      if (!normalizedChecked) {
        setSdvApprovedByField((prev) => {
          const next = { ...prev, [key]: false }
          sdvApprovedByFieldRef.current = next
          return next
        })
      }
    },
    [getSdvFieldKey],
  )
  useEffect(() => {
    sdvApprovedByFieldRef.current = sdvApprovedByField
  }, [sdvApprovedByField])
  useEffect(() => {
    sdvSelectionsByFieldRef.current = sdvSelectionsByField
  }, [sdvSelectionsByField])
  useEffect(() => {
    piSignedByFieldRef.current = piSignedByField
  }, [piSignedByField])
  const mergeSdvStateFromSavedFormData = useCallback((rawFormData, formRuntimeId) => {
    const sdvLoaded = extractSdvMapsFromSavedFormData(rawFormData, formRuntimeId, getSdvFieldKey)
    setSdvSelectionsByField((prev) => ({ ...prev, ...sdvLoaded.selections }))
    setSdvApprovedByField((prev) => {
      const next = { ...prev, ...sdvLoaded.approvals }
      sdvApprovedByFieldRef.current = next
      return next
    })
    sdvAuditMetaByFieldRef.current = {
      ...sdvAuditMetaByFieldRef.current,
      ...sdvLoaded.auditMeta,
    }
    return sdvLoaded
  }, [getSdvFieldKey])

  /**
   * AI FormData flags (ref-only — save payload). Session yellow highlight is separate UI state.
   * AI fill must not bypass audit / validation / save pipeline; it only writes field values.
   */
  const aiEntryFlagsByFieldIdRef = useRef({})
  const [aiSessionHighlightByFieldId, setAiSessionHighlightByFieldId] = useState(() => ({}))

  const clearAiSessionHighlights = useCallback(() => {
    setAiSessionHighlightByFieldId({})
  }, [])

  const clearAiEntryFlags = useCallback(() => {
    aiEntryFlagsByFieldIdRef.current = {}
    setAiSessionHighlightByFieldId({})
  }, [])

  const mergeAiEntryFlagsFromSavedFormData = useCallback(
    (rawFormData, formRuntimeId) => {
      const loaded = extractAiEntryFlagsFromSavedFormData(rawFormData)
      const keyed = {}
      Object.keys(loaded).forEach((fieldId) => {
        const key = getSdvFieldKey(formRuntimeId, fieldId)
        if (key && !key.startsWith("::") && !key.endsWith("::")) keyed[key] = loaded[fieldId]
      })
      aiEntryFlagsByFieldIdRef.current = {
        ...aiEntryFlagsByFieldIdRef.current,
        ...keyed,
      }
      return keyed
    },
    [getSdvFieldKey],
  )

  /** After save response: keep persisted flags for next save; drop session highlight. */
  const syncAiEntryFlagsFromSavedFormData = useCallback(
    (rawFormData, formRuntimeId) => {
      mergeAiEntryFlagsFromSavedFormData(rawFormData, formRuntimeId)
      clearAiSessionHighlights()
    },
    [mergeAiEntryFlagsFromSavedFormData, clearAiSessionHighlights],
  )

  const clearAiEntryFlagForField = useCallback(
    (fieldId, formRuntimeId = selectedForm?.id) => {
      const key = getSdvFieldKey(formRuntimeId, fieldId)
      if (!key || key.startsWith("::") || key.endsWith("::")) return
      const current = aiEntryFlagsByFieldIdRef.current?.[key]
      if (current?.isAiBasedEntry) {
        aiEntryFlagsByFieldIdRef.current = {
          ...aiEntryFlagsByFieldIdRef.current,
          [key]: clearAiEntry(),
        }
      }
      setAiSessionHighlightByFieldId((prev) => {
        if (!prev?.[key]) return prev
        const next = { ...prev }
        delete next[key]
        return next
      })
    },
    [getSdvFieldKey, selectedForm?.id],
  )

  const refreshSdvStateFromServer = useCallback(
    async (crfDataId, formRuntimeId) => {
      const parsedCrfDataId = Number.parseInt(String(crfDataId ?? ""), 10)
      const sid = Number.parseInt(String(studyId ?? ""), 10)
      if (
        !Number.isFinite(parsedCrfDataId) ||
        parsedCrfDataId <= 0 ||
        !Number.isFinite(sid) ||
        sid <= 0 ||
        formRuntimeId == null
      ) {
        return
      }
      const res = await crfDataService.getCrfDataById(parsedCrfDataId, sid)
      if (res?.isSuccess && res.data?.formData) {
        mergeSdvStateFromSavedFormData(res.data.formData, formRuntimeId)
      }
    },
    [studyId, mergeSdvStateFromSavedFormData],
  )

  const mergePiStateFromSavedFormData = useCallback((rawFormData, formRuntimeId) => {
    const piLoaded = extractPiMapsFromSavedFormData(rawFormData, formRuntimeId, getPiFieldKey)
    setPiSelectionsByField((prev) => ({ ...prev, ...piLoaded.selections }))
    setPiSignedByField((prev) => {
      const next = { ...prev, ...piLoaded.signed }
      piSignedByFieldRef.current = next
      return next
    })
    piAuditMetaByFieldRef.current = {
      ...piAuditMetaByFieldRef.current,
      ...piLoaded.auditMeta,
    }
    return piLoaded
  }, [])

  const setPiChecked = useCallback((formId, controlId, checked) => {
    const key = getPiFieldKey(formId, controlId)
    const normalizedChecked = Boolean(checked)
    setPiSelectionsByField((prev) => ({ ...prev, [key]: normalizedChecked }))
    if (!normalizedChecked) {
      setPiSignedByField((prev) => {
        const next = { ...prev, [key]: false }
        piSignedByFieldRef.current = next
        return next
      })
    }
  }, [])

  useEffect(() => {
    // Do not persist SDV checks in memory/cache across study/patient/visit/form switches.
    // Fresh context should start with a clean SDV state.
    setSdvSelectionsByField({})
    setSdvApprovedByField({})
    sdvApprovedByFieldRef.current = {}
    sdvAuditMetaByFieldRef.current = {}
    setPiSelectionsByField({})
    setPiSignedByField({})
    piSignedByFieldRef.current = {}
    piAuditMetaByFieldRef.current = {}
  }, [studyId, selectedPatient?.id, selectedVisit?.visitScheduleId, selectedForm?.id])

  useEffect(() => {
    clearAiEntryFlags()
  }, [studyId, selectedPatient?.id, selectedVisit?.visitScheduleId, selectedForm?.id, clearAiEntryFlags])

  useEffect(() => () => clearAiEntryFlags(), [clearAiEntryFlags])

  // Save success without formData in response still clears session highlight.
  useEffect(() => {
    if (!lastSavedAt) return
    clearAiSessionHighlights()
  }, [lastSavedAt, clearAiSessionHighlights])

  const loggedInUserId = useMemo(() => {
    const u = authService.getUser?.() || {}
    const raw = u?.id ?? u?.userId ?? u?.UserId
    const parsed = parseInt(String(raw ?? ""), 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }, [])
  const isTsiRole = useMemo(() => (userRoleCodeOrName || "").includes("TSI"), [userRoleCodeOrName])
  /** TSI who originally submitted this CRF may edit fields and use Save (status 2) to persist without re-submit flow. */
  const canTsiEditSubmittedCrf = useMemo(() => {
    if (!isTsiRole || currentFormStatus !== 3) return false
    if (!loggedInUserId || crfSubmittedByUserId == null) return false
    return Number(loggedInUserId) === Number(crfSubmittedByUserId)
  }, [isTsiRole, currentFormStatus, loggedInUserId, crfSubmittedByUserId])
  const isSubmittedFormLocked = currentFormStatus === 3 && !canTsiEditSubmittedCrf
  /** Hide per-cell audit (pencil / check) in tables for CRA always, and for CRC on submitted locked CRFs. */
  const suppressTableCellAuditChrome = isCraReviewer || (isCrcReviewer && isSubmittedFormLocked)
  const hasAnySavePermission = studyPermGates.canEditCrf
  const canViewCrf = studyPermGates.canViewCrf
  const isStudyPermissionCheckPending = studyPermsLoading && !matrixLoadedFromApi
  const studyMatrixBlocksCrfView =
    !useLegacyPermissions && studyEffectivePermissions?.["crf.view"] !== true
  const menuBlocksCrfView = !ecrfPermission.canView
  const canRespondToQueries = studyPermGates.canRespondQuery
  const canCloseQueriesByMatrix = studyPermGates.canCloseQuery
  const canEditExistingCrf = ecrfPermission.canEdit
  const canCreateCrf = ecrfPermission.canAdd
  const canViewVisitAttachments = Boolean(visitAttachmentPermission.canView)
  const canUploadVisitAttachments = Boolean(visitAttachmentPermission.canAdd)
  const canDeleteVisitAttachments = Boolean(visitAttachmentPermission.canDelete)
  const isDbLockReadOnly = isStudyDbLocked && !studyPermGates.canApplyDbLock
  const isPiSignedReadOnly = isPiSignoffRequired && isPiSigned
  const isPermissionLockedForDataEntry =
    isFormReadOnlyByPermission ||
    !hasAnySavePermission ||
    !canViewCrf ||
    isDbLockReadOnly ||
    isPiSignedReadOnly ||
    eConsentBlocksSelectedPatient
  const isFormInteractionLocked = (isPermissionLockedForDataEntry || isSubmittedFormLocked) && !canTsiEditSubmittedCrf
  // CRM query workflow: allow only on submitted CRF rows.
  // Do not enable on merely permission-locked saved/draft rows.
  const canWorkOnQueries = currentFormStatus === 3
  /**
   * eCRF data-entry must show all query rows for the selected CRF so site users
   * can always see raised queries, regardless of assignment.
   * Note: edit/close permissions are still enforced by existing owner checks.
   */
  const shouldScopeQueriesToCurrentUser = false
  const isStudySettingsResolvedForCurrentStudy = useMemo(() => {
    const sid = Number.parseInt(String(studyId ?? ""), 10)
    const resolvedSid = Number.parseInt(String(studySettingsResolvedStudyId ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0) return true
    return Number.isFinite(resolvedSid) && resolvedSid > 0 && resolvedSid === sid
  }, [studyId, studySettingsResolvedStudyId])
  const canRaiseManualQueries =
    canWorkOnQueries &&
    !isStudySettingsLoading &&
    isStudySettingsResolvedForCurrentStudy &&
    studyPermGates.canCreateQuery
  const visitPrimaryDateRestrictionMinDate = useMemo(() => {
    return resolveVisitPrimaryDateRestrictionMinDate({
      enabled: isVisitDateRestrictionEnabled,
      visitPrimaryVisitDatesBySchedule,
      selectedVisit,
    })
  }, [
    isVisitDateRestrictionEnabled,
    visitPrimaryVisitDatesBySchedule,
    selectedVisit?.visitScheduleId,
    selectedVisit?.crfFormType,
    selectedVisit?.visitType,
    selectedVisit?.name,
  ])
  const isVisitDateRestrictionContextActive = useMemo(() => {
    if (!isVisitDateRestrictionEnabled) return false
    return Boolean(toScheduleKey(selectedVisit?.visitScheduleId))
  }, [
    isVisitDateRestrictionEnabled,
    selectedVisit?.visitScheduleId,
  ])
  const sdvConfiguredForCurrentStudy = useMemo(() => {
    return (
      isSdvConfigured(sdvRoleGuidsByStudy) &&
      !isStudySettingsLoading &&
      isStudySettingsResolvedForCurrentStudy
    )
  }, [sdvRoleGuidsByStudy, isStudySettingsLoading, isStudySettingsResolvedForCurrentStudy])
  const selectedVisitScheduleKeyForDateRestriction = useMemo(
    () => toScheduleKey(selectedVisit?.visitScheduleId),
    [selectedVisit?.visitScheduleId]
  )
  const hasVisitDateChainForSelectedVisit = useMemo(() => {
    if (!isVisitDateRestrictionContextActive) return true
    if (!selectedVisitScheduleKeyForDateRestriction) return false
    return Boolean(
      visitPrimaryVisitDatesBySchedule?.[selectedVisitScheduleKeyForDateRestriction]
    )
  }, [
    isVisitDateRestrictionContextActive,
    selectedVisitScheduleKeyForDateRestriction,
    visitPrimaryVisitDatesBySchedule,
  ])
  useEffect(() => {
    const chainRow =
      selectedVisitScheduleKeyForDateRestriction
        ? visitPrimaryVisitDatesBySchedule?.[selectedVisitScheduleKeyForDateRestriction] || null
        : null
    logVisitDateRestrictionDebug("restriction_state_snapshot", {
      selectedVisitId: selectedVisit?.visitId ?? null,
      selectedVisitScheduleId: selectedVisit?.visitScheduleId ?? null,
      selectedVisitScheduleKeyForDateRestriction,
      isStudySettingsLoading,
      isStudySettingsResolvedForCurrentStudy,
      isVisitDateRestrictionEnabled,
      isVisitDateRestrictionContextActive,
      isVisitDateChainLoading,
      hasVisitDateChainForSelectedVisit,
      resolvedMinDateExclusive: visitPrimaryDateRestrictionMinDate || "",
      chainPrevDate: chainRow?.prevovisitPrimaryVisitDate ?? null,
    })
  }, [
    selectedVisit?.visitId,
    selectedVisit?.visitScheduleId,
    selectedVisitScheduleKeyForDateRestriction,
    isStudySettingsLoading,
    isStudySettingsResolvedForCurrentStudy,
    isVisitDateRestrictionEnabled,
    isVisitDateRestrictionContextActive,
    isVisitDateChainLoading,
    hasVisitDateChainForSelectedVisit,
    visitPrimaryDateRestrictionMinDate,
    visitPrimaryVisitDatesBySchedule,
  ])

  const sectionsWithContentForDataEntry = useMemo(() => {
    const displaySections =
      selectedForm?.crfDesign?.sections && selectedForm.crfDesign.sections.length > 0
        ? selectedForm.crfDesign.sections
        : selectedForm?.section
          ? [selectedForm.section]
          : []
    return resolveSectionsForDataEntry(displaySections)
  }, [selectedForm])

  const isStudyCompletionDataEntry = useMemo(
    () => isStudyCompletionFormSectionList(sectionsWithContentForDataEntry),
    [sectionsWithContentForDataEntry],
  )

  /** Study Completion visit (type 8) — SUBMIT & CLOSE + CLOSE only; no draft Save. */
  const isStudyCompletionVisitEntry = useMemo(() => {
    if (visitMatchesTypeEnum(selectedVisit, VISIT_TYPE.STUDY_COMPLETION_FORM)) return true
    if (
      isStudyCompletionFormVisit(
        selectedVisit?.visitType ??
          selectedVisit?.crfFormType ??
          selectedVisit?.visitName ??
          selectedForm?.crfFormType,
      )
    ) {
      return true
    }
    return isStudyCompletionDataEntry
  }, [
    isStudyCompletionDataEntry,
    selectedVisit,
    selectedForm?.crfFormType,
  ])

  const studyCompletionActiveSection = useMemo(() => {
    if (!isStudyCompletionDataEntry) return null
    if (studyCompletionEntryGate.completedStudy !== false) return null
    const code = studyCompletionEntryGate.terminalStatusCode
    if (code == null) return null
    return findStudyCompletionSectionByStatusCode(sectionsWithContentForDataEntry, code)
  }, [
    isStudyCompletionDataEntry,
    studyCompletionEntryGate.completedStudy,
    studyCompletionEntryGate.terminalStatusCode,
    sectionsWithContentForDataEntry,
  ])

  const studyCompletionGateHydratedForFormRef = useRef(null)

  useEffect(() => {
    studyCompletionGateHydratedForFormRef.current = null
    setStudyCompletionEntryGate({ completedStudy: null, terminalStatusCode: null })
  }, [selectedForm?.id, selectedVisit?.visitScheduleId, selectedPatient?.id])

  /** After load: restore Yes/No + terminal status so submitted/revisited forms show saved answers. */
  useEffect(() => {
    if (!isStudyCompletionVisitEntry || !selectedForm?.id || loadingSelectedCrfForm) return
    const formKey = String(selectedForm.id)
    if (studyCompletionGateHydratedForFormRef.current === formKey) return

    const slice = formData[selectedForm.id]
    if (slice === undefined) return

    const gate = resolveStudyCompletionGateForReopen(
      selectedPatient,
      sectionsWithContentForDataEntry,
      slice || {},
    )
    studyCompletionGateHydratedForFormRef.current = formKey
    setStudyCompletionEntryGate(gate)
  }, [
    isStudyCompletionVisitEntry,
    selectedForm?.id,
    loadingSelectedCrfForm,
    sectionsWithContentForDataEntry,
    selectedPatient?.currentStatusCode,
    selectedPatient?.patientStatusCode,
    formData,
  ])

  const dataEntryActiveSectionControlCount = useMemo(() => {
    if (isStudyCompletionDataEntry) {
      return studyCompletionActiveSection?.controls?.length ?? 0
    }
    const sections = sectionsWithContentForDataEntry
    if (!sections.length) return 0
    const effectiveActiveId =
      activeDataEntrySectionId && sections.some((s) => s.id === activeDataEntrySectionId)
        ? activeDataEntrySectionId
        : (sections[0]?.id ?? null)
    const activeSection = sections.find((s) => s.id === effectiveActiveId) ?? sections[0]
    return activeSection?.controls?.length ?? 0
  }, [
    isStudyCompletionDataEntry,
    studyCompletionActiveSection,
    sectionsWithContentForDataEntry,
    activeDataEntrySectionId,
  ])

  const useTanstackDataEntryVirtual = dataEntryActiveSectionControlCount > 160

  const dataEntryControlVirtualizerState = useDataEntryControlVirtualizer({
    enabled: useTanstackDataEntryVirtual,
    controlCount: dataEntryActiveSectionControlCount,
    scrollElementRef: dataEntryCrfScrollContainerRef,
  })

  /** Clear all status-block field values so switching Discontinued / Withdrawn / etc. does not reuse prior entries. */
  const clearStudyCompletionFormFields = useCallback(() => {
    const formId = selectedForm?.id
    if (!formId || !isStudyCompletionVisitEntry) return
    const slice = formData[formId] || {}
    const keys = collectStudyCompletionFormFieldKeys(sectionsWithContentForDataEntry, slice)
    if (!keys.size) return

    setFormData((prev) => {
      const nextSlice = { ...(prev[formId] || {}) }
      keys.forEach((k) => delete nextSlice[k])
      return { ...prev, [formId]: nextSlice }
    })
    setValidationErrors((prev) => {
      const nextErrs = { ...(prev[formId] || {}) }
      keys.forEach((k) => delete nextErrs[k])
      return { ...prev, [formId]: nextErrs }
    })
    setOptimisticControlValues((prev) => {
      const next = { ...prev }
      let changed = false
      keys.forEach((k) => {
        if (Object.prototype.hasOwnProperty.call(next, k)) {
          delete next[k]
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [
    selectedForm?.id,
    isStudyCompletionVisitEntry,
    sectionsWithContentForDataEntry,
    formData,
  ])

  const handleStudyCompletionTerminalStatusChange = useCallback(
    (code) => {
      studyCompletionGateHydratedForFormRef.current = String(selectedForm?.id ?? "")
      clearStudyCompletionFormFields()
      setStudyCompletionEntryGate((prev) => ({
        ...prev,
        terminalStatusCode: code,
      }))
    },
    [clearStudyCompletionFormFields, selectedForm?.id],
  )

  const handleStudyCompletionCompletedStudyChange = useCallback(
    (yes) => {
      studyCompletionGateHydratedForFormRef.current = String(selectedForm?.id ?? "")
      clearStudyCompletionFormFields()
      setStudyCompletionEntryGate({
        completedStudy: yes,
        terminalStatusCode: null,
      })
    },
    [clearStudyCompletionFormFields, selectedForm?.id],
  )

  const getStudyCompletionSubmitContext = useCallback(
    () => resolveStudyCompletionSubmitFromGate(sectionsWithContentForDataEntry, studyCompletionEntryGate),
    [sectionsWithContentForDataEntry, studyCompletionEntryGate],
  )

  const applyStudyCompletionStatusBeforeSubmit = useCallback(async () => {
    const ctx = resolveStudyCompletionSubmitFromGate(
      sectionsWithContentForDataEntry,
      studyCompletionEntryGate,
    )
    if (ctx.gateError) {
      return { ok: false, message: ctx.gateError }
    }
    if (!studyId || !selectedPatient?.id) {
      return { ok: false, message: "Study or patient is missing." }
    }
    try {
      const res = await patientEnrolmentService.updatePatientStatus(studyId, selectedPatient.id, {
        newStatusCode: ctx.statusCode,
        reason: null,
      })
      if (!res?.isSuccess) {
        return { ok: false, message: res?.message || "Could not update patient status." }
      }
      const updatedCode = res?.data?.currentStatusCode
      const updatedName = res?.data?.currentStatusName
      if (updatedCode != null || updatedName) {
        setPatients((prev) =>
          prev.map((p) =>
            p.id === selectedPatient.id
              ? {
                  ...p,
                  currentStatusCode: updatedCode ?? p.currentStatusCode,
                  currentStatusName: updatedName ?? p.currentStatusName,
                  patientStatusCode: updatedCode ?? p.patientStatusCode,
                  patientStatusName: updatedName ?? p.patientStatusName,
                }
              : p,
          ),
        )
        setSelectedPatient((prev) =>
          prev
            ? {
                ...prev,
                currentStatusCode: updatedCode ?? prev.currentStatusCode,
                currentStatusName: updatedName ?? prev.currentStatusName,
                patientStatusCode: updatedCode ?? prev.patientStatusCode,
                patientStatusName: updatedName ?? prev.patientStatusName,
              }
            : prev,
        )
      }
      return { ok: true }
    } catch (e) {
      console.error("[StudyCompletion] status update error:", e)
      return { ok: false, message: e?.message || "Failed to update patient status." }
    }
  }, [
    sectionsWithContentForDataEntry,
    studyCompletionEntryGate,
    studyId,
    selectedPatient?.id,
  ])

  const sectionIdByControlId = useMemo(() => {
    const map = new Map()
    sectionsWithContentForDataEntry.forEach((section) => {
      ;(section?.controls || []).forEach((control) => {
        if (control?.id != null) map.set(String(control.id), String(section.id))
      })
    })
    return map
  }, [sectionsWithContentForDataEntry])

  const controlLabelById = useMemo(() => {
    const map = new Map()
    sectionsWithContentForDataEntry.forEach((section) => {
      ;(section?.controls || []).forEach((control) => {
        if (control?.id == null) return
        const label =
          control?.properties?.labelText ||
          control?.label ||
          control?.name ||
          String(control.id)
        map.set(String(control.id), String(label))
      })
    })
    return map
  }, [sectionsWithContentForDataEntry])
  const controlById = useMemo(() => {
    const map = new Map()
    sectionsWithContentForDataEntry.forEach((section) => {
      ;(section?.controls || []).forEach((control) => {
        if (control?.id == null) return
        map.set(String(control.id), control)
      })
    })
    return map
  }, [sectionsWithContentForDataEntry])

  const formatAuditFieldLabel = useCallback((fieldName) => {
    const key = String(fieldName || "").trim()
    if (!key) return ""
    const direct = controlLabelById.get(key)
    if (direct) return direct
    const tableCellMatch = key.match(/^(.*)_row_(\d+)_col_(\d+)$/)
    if (!tableCellMatch) return key
    const tableId = String(tableCellMatch[1] || "")
    const row = Number.parseInt(tableCellMatch[2] || "0", 10) + 1
    const colIndex = Number.parseInt(tableCellMatch[3] || "0", 10)
    const tableControl = controlById.get(tableId)
    const tableLabel =
      String(
        tableControl?.properties?.labelText ||
        tableControl?.label ||
        tableControl?.name ||
        tableId,
      ).trim() || tableId
    const headers = Array.isArray(tableControl?.properties?.columnHeaders)
      ? tableControl.properties.columnHeaders
      : []
    const colLabel =
      String(headers?.[colIndex] ?? `Column ${colIndex + 1}`).trim() || `Column ${colIndex + 1}`
    return `${tableLabel} - ${colLabel} (row ${row})`
  }, [controlLabelById, controlById])

  // Generic audit-light enablement:
  // Only show edit/✓ + reason popup for fields that:
  // 1) belong to the currently active CRF design, AND
  // 2) are from a persisted CRF record, AND
  // 3) have a non-empty baseline value loaded from the DB.
  const auditLightLogControlIds = useMemo(() => {
    const out = new Set()
    const formId = selectedForm?.id
    if (!formId) return out

    const baseline = formAuditBaselineById?.[formId]
    if (!baseline?.hasPersistedRecord) return out

    // Limit to controls present in the current CRF design so we don't accidentally
    // enable audit UI for stale baseline keys.
    const designControlIds = new Set()
    ;(sectionsWithContentForDataEntry || []).forEach((section) => {
      ;(section?.controls || []).forEach((control) => {
        if (control?.id == null) return
        // Include table controls so table-cell keys (tableId_row_X_col_Y) participate
        // in change detection/reason-capture eligibility.
        designControlIds.add(String(control.id))
      })
    })

    const baselineValues =
      baseline?.values && typeof baseline.values === "object" ? baseline.values : {}

    const normalizeBaselineValue = (v) => {
      if (v == null) return ""
      if (typeof v === "object") {
        // API baseline usually comes as: { value: "...", label: "..." }
        if ("value" in v) return String(v?.value ?? "")
        if ("label" in v) return String(v?.label ?? "")
        return String(v)
      }
      return typeof v === "string" || typeof v === "number" ? String(v) : String(v)
    }

    Object.entries(baselineValues).forEach(([controlIdStr, rawVal]) => {
      const key = String(controlIdStr || "")
      const belongsToCurrentDesign =
        designControlIds.has(key) ||
        Array.from(designControlIds).some((designId) => key.startsWith(`${designId}_row_`))
      if (!belongsToCurrentDesign) return
      const normalized = String(normalizeBaselineValue(rawVal) ?? "").trim()
      if (normalized !== "") out.add(key)
    })

    return out
  }, [selectedForm?.id, sectionsWithContentForDataEntry, formAuditBaselineById])

  useEffect(() => {
    setAuditLightEditModeById({})
    setAuditLightDirtyById({})
    lastAuditTouchedFieldRef.current = { formId: selectedForm?.id ?? null, controlId: "" }
  }, [selectedForm?.id])

  useEffect(() => {
    // Dev-only audit debug logs to avoid slow console spam in production-like runs.
    try {
      auditReasonDebugRef.current = Boolean(window?.localStorage?.getItem("crfAuditReasonDebug") === "1")
    } catch {
      auditReasonDebugRef.current = false
    }
  }, [])

  const summarizeValidationBySection = useCallback((errorMap) => {
    const counts = {}
    Object.entries(errorMap || {}).forEach(([fieldId, errs]) => {
      const messages = Array.isArray(errs) ? errs.filter(Boolean) : (errs ? [errs] : [])
      if (messages.length === 0) return
      const normalizedFieldId = String(fieldId || "")
      const tableMatch = normalizedFieldId.match(/^(.*)_row_\d+_col_\d+$/)
      const rootControlId = tableMatch ? tableMatch[1] : normalizedFieldId
      const sectionId = sectionIdByControlId.get(String(rootControlId))
      if (!sectionId) return
      counts[sectionId] = (counts[sectionId] || 0) + messages.length
    })
    const orderedInvalidSectionIds = sectionsWithContentForDataEntry
      .map((section) => String(section.id))
      .filter((sectionId) => Number(counts[sectionId] || 0) > 0)
    const total = Object.values(counts).reduce((sum, n) => sum + Number(n || 0), 0)
    return {
      counts,
      orderedInvalidSectionIds,
      firstInvalidSectionId: orderedInvalidSectionIds[0] || null,
      total,
    }
  }, [sectionIdByControlId, sectionsWithContentForDataEntry])

  const sectionValidationSummary = useMemo(
    () => summarizeValidationBySection(validationErrors[selectedForm?.id] || {}),
    [summarizeValidationBySection, validationErrors, selectedForm?.id],
  )
  /**
   * Deferred copy of `sectionValidationSummary` for the (non-critical) section
   * tab error-count chip. Lets the caret keep painting at 60 fps while error
   * counts catch up after a brief pause — i.e. the chip lags ~16ms behind
   * keystrokes instead of forcing the tab strip to re-render synchronously on
   * every key. The inline per-field error UI still uses the immediate value.
   */
  const deferredSectionValidationSummary = useDeferredValue(sectionValidationSummary)
  const isLastDataEntrySection = useMemo(() => {
    if (isStudyCompletionDataEntry) return true
    if (!Array.isArray(sectionsWithContentForDataEntry) || sectionsWithContentForDataEntry.length === 0) return true
    const activeId = String(activeDataEntrySectionId ?? sectionsWithContentForDataEntry[0]?.id ?? "")
    const activeIndex = sectionsWithContentForDataEntry.findIndex((s) => String(s?.id) === activeId)
    if (activeIndex < 0) return false
    return activeIndex === sectionsWithContentForDataEntry.length - 1
  }, [isStudyCompletionDataEntry, sectionsWithContentForDataEntry, activeDataEntrySectionId])

  /** Footer prev/next — same navigation contract as section tabs (audit prompt, scroll-into-view). */
  const dataEntrySectionStepper = useMemo(() => {
    if (isStudyCompletionDataEntry) {
      return {
        show: false,
        prevId: null,
        nextId: null,
        positionLabel: "",
        prevTooltip: "",
        nextTooltip: "",
      }
    }
    const sections = sectionsWithContentForDataEntry
    if (!Array.isArray(sections) || sections.length <= 1) {
      return {
        show: false,
        prevId: null,
        nextId: null,
        positionLabel: "",
        prevTooltip: "",
        nextTooltip: "",
      }
    }
    const activeId = String(activeDataEntrySectionId ?? sections[0]?.id ?? "")
    let activeIndex = sections.findIndex((s) => String(s?.id) === activeId)
    if (activeIndex < 0) activeIndex = 0
    const prevSection = activeIndex > 0 ? sections[activeIndex - 1] : null
    const nextSection = activeIndex < sections.length - 1 ? sections[activeIndex + 1] : null
    const sectionTitle = (s) => {
      const raw = String(s?.name ?? "").trim()
      return raw || "Section"
    }
    return {
      show: true,
      prevId: prevSection?.id ?? null,
      nextId: nextSection?.id ?? null,
      positionLabel: `${activeIndex + 1}/${sections.length}`,
      prevTooltip: prevSection ? `Previous: ${sectionTitle(prevSection)}` : "First section",
      nextTooltip: nextSection ? `Next: ${sectionTitle(nextSection)}` : "Last section",
    }
  }, [isStudyCompletionDataEntry, sectionsWithContentForDataEntry, activeDataEntrySectionId])

  const {
    normalizeAuditFieldValue,
    computeChangedAuditFields,
    promptAuditReasonCaptureIfNeeded,
    handleAuditReasonBlurCapture,
  } = useAuditReasonCore({
    auditReasonModalOpen: Boolean(auditReasonModal?.open),
    preCapturedAuditReason,
    formData,
    formAuditBaselineById,
    auditLightLogControlIds,
    auditLightDirtyById,
    setAuditChangeReason,
    setAuditReasonModal,
    selectedFormId: selectedForm?.id,
    lastAuditTouchedFieldRef,
    auditReasonDebugRef,
  })

  /** Last saved snapshot (audit baseline) or query-captured actual — not unsaved CRF edits. */
  const getPersistedActualValueForQueryField = useCallback(
    (query, formId) => {
      const fieldId = String(query?.fieldId || "").trim()
      const flatKey = resolveQueryFieldIdToFormFlatKey(fieldId)
      if (!fieldId || !flatKey || !formId) return ""
      const baselineEntry = formAuditBaselineById?.[formId]
      const baselineValues =
        baselineEntry?.values && typeof baselineEntry.values === "object" ? baselineEntry.values : {}
      if (Object.prototype.hasOwnProperty.call(baselineValues, flatKey)) {
        const raw = baselineValues[flatKey]
        const norm = normalizeAuditFieldValue(raw)
        if (String(norm ?? "").trim() !== "") return raw
      }
      const { actual: parsedActual } = deriveExpectedActualAndBody(query)
      const snap = query?.actualValue ?? parsedActual
      if (snap !== undefined && snap !== null && String(snap).trim() !== "") return snap
      return ""
    },
    [formAuditBaselineById, normalizeAuditFieldValue],
  )

  const scheduleAuditReasonPrompt = useCallback((formId, options = {}) => {
    if (!formId) return
    const run = () => {
      void promptAuditReasonCaptureIfNeeded(formId, options)
    }
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(run)
      return
    }
    setTimeout(run, 0)
  }, [promptAuditReasonCaptureIfNeeded])

  const selectedPatientIdKey = String(selectedPatient?.id ?? "")
  const repeatableTemplateByKind = useMemo(() => ({
    unscheduled: visits.find((v) => visitMatchesRepeatableEntryEnum(v, REPEATABLE_ENTRY_VISIT_ENUM.unscheduled)) || null,
    adverse: visits.find((v) => visitMatchesRepeatableEntryEnum(v, REPEATABLE_ENTRY_VISIT_ENUM.adverse)) || null,
  }), [visits])

  const selectedPatientRepeatableRowsByKind = useMemo(() => {
    const out = { unscheduled: [], adverse: [] }
    const rowsFromSaved = Array.isArray(selectedPatient?.visitCrfData) ? selectedPatient.visitCrfData : []
    rowsFromSaved.forEach((row) => {
      const kind =
        getRepeatableKindFromValue(row?.crfFormType) ||
        getRepeatableKindFromValue(row?.visitType) ||
        getRepeatableKindFromValue(row?.visitName)
      if (!kind) return
      // Preferred source from backend: savedRowNumbers (ordered list of persisted row numbers).
      const savedRows = parseSavedRowNumberEntries(row?.savedRowNumbers).map((x) => x.rowNumber)
      if (savedRows.length > 0) {
        out[kind].push(...savedRows)
      } else {
        // Backward-compatible fallback when savedRowNumbers is not present yet.
        const rn = toPositiveRowNumber(row?.rowNumber)
        if (rn) out[kind].push(rn)
      }
    })
    const pending = pendingRepeatableRowsByPatient[selectedPatientIdKey] || {}
    ;["unscheduled", "adverse"].forEach((kind) => {
      const merged = [...out[kind], ...(Array.isArray(pending[kind]) ? pending[kind] : [])]
      out[kind] = [...new Set(merged)].sort((a, b) => a - b)
    })
    return out
  }, [selectedPatient?.visitCrfData, pendingRepeatableRowsByPatient, selectedPatientIdKey])

  const repeatableRowCrfDataIdIndex = useMemo(() => {
    const idx = new Map()
    const list = Array.isArray(selectedPatient?.visitCrfData) ? selectedPatient.visitCrfData : []
    list.forEach((entry) => {
      const kind =
        getRepeatableKindFromValue(entry?.crfFormType) ||
        getRepeatableKindFromValue(entry?.visitType) ||
        getRepeatableKindFromValue(entry?.visitName)
      if (!kind) return
      const designKey = toDesignKey(entry?.crfDesignId ?? entry?.crfDesignID ?? null)
      const topRow = toPositiveRowNumber(entry?.rowNumber)
      const topCrfDataId = parseInt(String(entry?.crfDataId ?? ""), 10)
      if (topRow != null && Number.isFinite(topCrfDataId) && topCrfDataId > 0) {
        idx.set(`${kind}:${topRow}:${designKey}`, topCrfDataId)
      }
      parseSavedRowNumberEntries(entry?.savedRowNumbers).forEach((saved) => {
        if (saved?.crfDataId == null) return
        const savedDesignKey = toDesignKey(saved?.crfDesignId ?? entry?.crfDesignId ?? entry?.crfDesignID ?? null)
        idx.set(`${kind}:${saved.rowNumber}:${savedDesignKey}`, saved.crfDataId)
      })
    })
    return idx
  }, [selectedPatient?.visitCrfData])

  const resolveRepeatableRowCrfDataId = useCallback(
    (kind, rowNumber, crfDesignId) => {
      const row = toPositiveRowNumber(rowNumber)
      if (!kind || row == null) return null
      const designKey = toDesignKey(crfDesignId ?? null)
      const exact = repeatableRowCrfDataIdIndex.get(`${kind}:${row}:${designKey}`)
      if (exact != null) return exact
      for (const [k, v] of repeatableRowCrfDataIdIndex.entries()) {
        const [kKind, kRow] = k.split(":")
        if (kKind === kind && String(kRow) === String(row)) return v
      }
      return null
    },
    [repeatableRowCrfDataIdIndex],
  )

  const enrichVisitFormsWithCrfMeta = useCallback(
    (forms, visit, patientOverride) => {
      const patient = patientOverride ?? selectedPatientRef.current ?? selectedPatient
      const visitCrfMap = visitCrfDataMapRef.current ?? visitCrfDataMap
      if (!Array.isArray(forms) || forms.length === 0) return []
      if (!patient) {
        return forms.map((form) => ({
          ...form,
          status: form.status || "notstarted",
          crfDataId: form.crfDataId ?? null,
        }))
      }

      const visitScheduleId = visit?.visitScheduleId
      if (!visitScheduleId) {
        return forms.map((form) => ({
          ...form,
          status: form.status || "notstarted",
          crfDataId: form.crfDataId ?? null,
        }))
      }

      const scheduleKey = toScheduleKey(visitScheduleId)
      const visitCrfInfoByDesignId = scheduleKey ? visitCrfMap[scheduleKey] : null

      return forms.map((form) => {
        const next = { ...form }
        let matched = resolveCrfDataSlotForDesign(visitCrfInfoByDesignId, form.crfDesignId)

        if (visit?.isRepeatableGroup) {
          const wantedRow = toPositiveRowNumber(form?.repeatableRowNumber)
          const wantedKind = form?.repeatableKind || visit?.repeatableKind
          const list = Array.isArray(patient?.visitCrfData) ? patient.visitCrfData : []
          matched =
            list.find((entry) => {
              const entryKind =
                getRepeatableKindFromValue(entry?.crfFormType) ||
                getRepeatableKindFromValue(entry?.visitType) ||
                getRepeatableKindFromValue(entry?.visitName)
              const entryRow = toPositiveRowNumber(entry?.rowNumber)
              const entryDesignId = entry?.crfDesignId ?? entry?.crfDesignID ?? null
              return (
                entryKind === wantedKind &&
                entryRow === wantedRow &&
                toDesignKey(entryDesignId) === toDesignKey(form.crfDesignId)
              )
            }) || matched
          const rowCrfDataId = resolveRepeatableRowCrfDataId(wantedKind, wantedRow, form?.crfDesignId)
          if (rowCrfDataId != null) {
            matched = {
              ...(matched || {}),
              crfDataId: rowCrfDataId,
              status: matched?.status ?? "Saved",
            }
          }
        }

        if (matched) {
          const statusCode = normalizeCrfStatusCode(matched.status)
          if (statusCode === 3) next.status = "completed"
          else if (statusCode === 1 || statusCode === 2) next.status = "inprogress"
          else next.status = "notstarted"
          next.crfDataId = matched.crfDataId
          next.isSdvVerify = Boolean(
            matched.isSdvVerify ?? matched.IsSdvVerify ?? form.isSdvVerify ?? form.IsSdvVerify,
          )
        } else {
          next.status = "notstarted"
          next.crfDataId = null
          next.isSdvVerify = false
        }
        return next
      })
    },
    [selectedPatient, visitCrfDataMap, resolveRepeatableRowCrfDataId],
  )

  const resolveCrfDataIdForFormContext = useCallback(
    (form, visit, patientOverride) => {
      const patient = patientOverride ?? selectedPatientRef.current ?? selectedPatient
      const visitCrfMap = visitCrfDataMapRef.current ?? visitCrfDataMap
      const fromForm = parseInt(String(form?.crfDataId ?? ""), 10)
      if (Number.isFinite(fromForm) && fromForm > 0) return fromForm

      const scheduleKey = toScheduleKey(visit?.visitScheduleId)
      const visitCrfInfoByDesignId = scheduleKey ? visitCrfMap[scheduleKey] : null
      const matched = resolveCrfDataSlotForDesign(visitCrfInfoByDesignId, form?.crfDesignId)
      const fromMap = parseInt(String(matched?.crfDataId ?? ""), 10)
      if (Number.isFinite(fromMap) && fromMap > 0) return fromMap

      const rowNum = toPositiveRowNumber(form?.repeatableRowNumber ?? visit?.repeatableRowNumber)
      const kind = form?.repeatableKind ?? visit?.repeatableKind
      if (rowNum != null && kind) {
        const fromRepeatable = resolveRepeatableRowCrfDataId(kind, rowNum, form?.crfDesignId)
        if (fromRepeatable != null) return fromRepeatable

        const list = Array.isArray(patient?.visitCrfData) ? patient.visitCrfData : []
        const found = list.find((entry) => {
          const entryKind =
            getRepeatableKindFromValue(entry?.crfFormType) ||
            getRepeatableKindFromValue(entry?.visitType) ||
            getRepeatableKindFromValue(entry?.visitName)
          const entryRow = toPositiveRowNumber(entry?.rowNumber)
          const entryDesignKey = toDesignKey(entry?.crfDesignId ?? entry?.crfDesignID ?? null)
          return (
            entryKind === kind &&
            entryRow === rowNum &&
            entryDesignKey === toDesignKey(form?.crfDesignId)
          )
        })
        const fromList = parseInt(String(found?.crfDataId ?? ""), 10)
        if (Number.isFinite(fromList) && fromList > 0) return fromList
      }

      if (scheduleKey && patient?.visitCrfData) {
        const list = Array.isArray(patient.visitCrfData) ? patient.visitCrfData : []
        const found = list.find((entry) => {
          const entrySchedule = toScheduleKey(entry?.visitScheduleId)
          if (entrySchedule !== scheduleKey) return false
          const entryDesignKey = toDesignKey(entry?.crfDesignId ?? entry?.crfDesignID ?? null)
          return entryDesignKey === toDesignKey(form?.crfDesignId)
        })
        const fromPatientGrid = parseInt(String(found?.crfDataId ?? ""), 10)
        if (Number.isFinite(fromPatientGrid) && fromPatientGrid > 0) return fromPatientGrid
      }

      return null
    },
    [selectedPatient, visitCrfDataMap, resolveRepeatableRowCrfDataId],
  )

  const visibleVisits = useMemo(() => {
    const nonRepeatable = visits.filter(
      (v) =>
        !visitMatchesRepeatableEntryEnum(v, REPEATABLE_ENTRY_VISIT_ENUM.unscheduled) &&
        !visitMatchesRepeatableEntryEnum(v, REPEATABLE_ENTRY_VISIT_ENUM.adverse) &&
        shouldShowVisitInManualDataEntry(v),
    )
    const repeatableGroups = []
    ;["unscheduled", "adverse"].forEach((kind) => {
      const template = repeatableTemplateByKind[kind]
      if (!template) return
      const rowNumbers = selectedPatientRepeatableRowsByKind[kind] || []
      if (rowNumbers.length === 0) return
      repeatableGroups.push({
        ...template,
        id: `repeatable-group:${kind}`,
        name: REPEATABLE_ENTRY_VISIT_LABEL[kind],
        order: 1000 + (kind === "unscheduled" ? 0 : 500),
        visitNo: 1000 + (kind === "unscheduled" ? 0 : 500),
        isRepeatableGroup: true,
        repeatableKind: kind,
        repeatableRowNumbers: rowNumbers,
        templateVisitId: template.id,
      })
    })
    return [...nonRepeatable, ...repeatableGroups]
  }, [visits, repeatableTemplateByKind, selectedPatientRepeatableRowsByKind])

  const sortedVisibleVisits = useMemo(() => {
    return sortVisitsForManualDataEntry(visibleVisits)
  }, [visibleVisits])

  const getVisitById = useCallback(
    (visitId) => visibleVisits.find((v) => String(v.id) === String(visitId)) || null,
    [visibleVisits],
  )

  /** Study master visit list must define Unscheduled / Adverse before we offer “Add Visit Type” (matches API visitType / crfFormType). */
  const studySupportsAddUnscheduledVisit = useMemo(
    () => Boolean(repeatableTemplateByKind.unscheduled),
    [repeatableTemplateByKind],
  )
  const studySupportsAddAdverseVisit = useMemo(
    () => Boolean(repeatableTemplateByKind.adverse),
    [repeatableTemplateByKind],
  )
  const showAddVisitTypeControl =
    Boolean(hasAnySavePermission && studyId && (studySupportsAddUnscheduledVisit || studySupportsAddAdverseVisit))

  const handleAddRepeatableVisitSchedule = useCallback(
    async (kind) => {
      const baseLabel = REPEATABLE_ENTRY_VISIT_LABEL[kind]
      if (!baseLabel || !repeatableTemplateByKind[kind] || !selectedPatientIdKey) return
      setAddingRepeatableVisitKind(kind)
      let nextRowNumber = null
      setPendingRepeatableRowsByPatient((prev) => {
        const bucket = prev[selectedPatientIdKey] || {}
        const existingRows = selectedPatientRepeatableRowsByKind[kind] || []
        const currentPendingRows = Array.isArray(bucket[kind]) ? bucket[kind] : []
        const merged = [...new Set([...existingRows, ...currentPendingRows])]
        const nextRow = (merged.length > 0 ? Math.max(...merged) : 0) + 1
        nextRowNumber = nextRow
        return {
          ...prev,
          [selectedPatientIdKey]: {
            ...bucket,
            [kind]: [...currentPendingRows, nextRow],
          },
        }
      })
      setAvailableFormsByVisit((prev) => {
        const next = { ...prev }
        const groupVisitId = `repeatable-group:${kind}`
        const existingForms = Array.isArray(prev[groupVisitId]) ? prev[groupVisitId] : []
        const isGroupOpen = String(showFormDropdown || "") === groupVisitId
        const templateVisit = repeatableTemplateByKind[kind]
        // Smooth UX: if the repeatable group is already expanded and forms are loaded,
        // append the next row instantly so user does not see a temporary empty state.
        if (existingForms.length > 0 && nextRowNumber != null) {
          const firstTemplateByDesign = new Map()
          existingForms.forEach((form) => {
            const designKey = toDesignKey(form?.crfDesignId ?? null)
            if (!firstTemplateByDesign.has(designKey)) {
              firstTemplateByDesign.set(designKey, form)
            }
          })
          const appendedRowForms = Array.from(firstTemplateByDesign.values()).map((form) => {
            const baseFormId = String(form?.id || "").split("__rn_")[0] || String(form?.id || "")
            return {
              ...form,
              id: `${baseFormId}__rn_${nextRowNumber}`,
              sectionName: `${baseLabel} ${nextRowNumber}.0`,
              repeatableRowNumber: nextRowNumber,
              repeatableKind: kind,
              crfDataId: null,
              status: "notstarted",
            }
          })
          next[groupVisitId] = [...existingForms, ...appendedRowForms].sort((a, b) => {
            const aRow = toPositiveRowNumber(a?.repeatableRowNumber) ?? 0
            const bRow = toPositiveRowNumber(b?.repeatableRowNumber) ?? 0
            if (aRow !== bRow) return aRow - bRow
            return String(a?.crfName || a?.sectionName || "").localeCompare(String(b?.crfName || b?.sectionName || ""))
          })
        } else if (isGroupOpen && nextRowNumber != null && templateVisit) {
          // If card is open but cache is empty, still inject one optimistic row immediately
          // so UI never flashes blank while background sync resolves canonical forms.
          const crfDesigns = Array.isArray(templateVisit.crfDesigns) && templateVisit.crfDesigns.length > 0
            ? templateVisit.crfDesigns
            : [{
              crfDesignId: templateVisit.crfDesignId ?? null,
              crfName: templateVisit.crfName || templateVisit.name || baseLabel,
              rowNumber: 1,
            }]
          next[groupVisitId] = crfDesigns
            .map((d, idx) => {
              const designId = d?.crfDesignId ?? d?.crfDesignID ?? d?.id ?? null
              const designLabel = d?.crfName || d?.name || templateVisit.crfName || templateVisit.name || baseLabel
              return {
                id: `optimistic_${kind}_${toDesignKey(designId) || idx}__rn_${nextRowNumber}`,
                name: designLabel,
                crfName: designLabel,
                crfDesignId: designId,
                sectionName: `${baseLabel} ${nextRowNumber}.0`,
                status: "notstarted",
                crfDataId: null,
                canView: true,
                canEdit: true,
                repeatableRowNumber: nextRowNumber,
                repeatableKind: kind,
                visitId: groupVisitId,
              }
            })
        } else {
          delete next[groupVisitId]
        }
        return next
      })
      toast({
        title: "Visit row added",
        description: `${baseLabel} added. Save this CRF row to persist it.`,
      })
      const groupVisitId = `repeatable-group:${kind}`
      // UX rule: "Add Visit Type" should immediately show the new row in UI.
      // Always move to list mode, open the relevant repeatable section, and sync forms in-place.
      setSelectedVisit(null)
      setShowFormDropdown(groupVisitId)
      setTimeout(() => {
        void fetchFormsForVisit(groupVisitId, true)
      }, 0)
      setAddingRepeatableVisitKind(null)
      const shouldAutoScrollForKind = kind === "unscheduled" || kind === "adverse"
      if (shouldAutoScrollForKind) {
        setRecentlyAddedVisitId(groupVisitId)
        if (addedVisitHighlightTimeoutRef.current) {
          clearTimeout(addedVisitHighlightTimeoutRef.current)
        }
        addedVisitHighlightTimeoutRef.current = window.setTimeout(() => {
          setRecentlyAddedVisitId((prev) => (prev === groupVisitId ? null : prev))
        }, 1400)

        // Smooth scroll the visits panel to the end so newly added repeatable rows are immediately visible.
        const tryScrollVisitsListToEnd = () => {
          if (typeof document === "undefined") return false
          const listNode = document.querySelector('[data-manual-visits-scroll="true"]')
          if (!listNode) return false
          listNode.scrollTo({ top: listNode.scrollHeight, behavior: "smooth" })
          return true
        }
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (tryScrollVisitsListToEnd()) return
            window.setTimeout(() => {
              tryScrollVisitsListToEnd()
            }, 120)
          })
        })
      }
    },
    [repeatableTemplateByKind, selectedPatientIdKey, selectedPatientRepeatableRowsByKind],
  )

  useEffect(() => {
    return () => {
      if (addedVisitHighlightTimeoutRef.current) {
        clearTimeout(addedVisitHighlightTimeoutRef.current)
      }
    }
  }, [])

  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [showAIFillModal, setShowAIFillModal] = useState(false)
  const [aiReviewMode, setAiReviewMode] = useState(false)
  const [aiReviewSuggestions, setAiReviewSuggestions] = useState([])
  const [aiReviewSourceSnippet, setAiReviewSourceSnippet] = useState("")
  const [aiReviewMeta, setAiReviewMeta] = useState(null)
  const [aiQualityHints, setAiQualityHints] = useState([])
  const [aiQualityHintsLoading, setAiQualityHintsLoading] = useState(false)
  const [showRecordingModal, setShowRecordingModal] = useState(false)
  const [recordingElapsed, setRecordingElapsed] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [uploadDragActive, setUploadDragActive] = useState(false)
  const [aiProcessingMode, setAiProcessingMode] = useState("upload")
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const mediaStreamRef = useRef(null)
  const aiFileInputRef = useRef(null)
  const recordingStartTimeRef = useRef(0)
  const recordingPausedAtRef = useRef(0)
  const recordingPausedTotalRef = useRef(0)
  const recordingSubmitOnEndRef = useRef(false)
  // Form schema from Tatva API (GET form-schema?study_id=...) for NER - when available we send this as "questions"
  const [formSchemaQuestions, setFormSchemaQuestions] = useState(null)

  const [visitAttachmentList, setVisitAttachmentList] = useState([])
  const [loadingVisitAttachments, setLoadingVisitAttachments] = useState(false)
  const [deletingVisitAttachmentId, setDeletingVisitAttachmentId] = useState(null)
  const [pendingDeleteAttachment, setPendingDeleteAttachment] = useState({
    open: false,
    id: null,
    label: "",
  })
  const [visitAttachmentsZipLoading, setVisitAttachmentsZipLoading] = useState(false)
  const visitAttachmentFileInputRef = useRef(null)
  const visitZipBusyRef = useRef(false)
  const visitAttachmentUploadMaxBytesRef = useRef(null) // null = normal limits; otherwise enforce max bytes (e.g. 10 MB)
  const visitAttachmentUploadMinBytesRef = useRef(null) // null = no min check; otherwise enforce min bytes (for large option)

  // Background upload/download jobs (small bottom-right popup).
  const { addJob, addDownloadJob } = useVisitAttachmentUpload()

  const showVisitAttachmentsMenu = useMemo(
    () =>
      canViewVisitAttachments &&
      (canUploadVisitAttachments || canDeleteVisitAttachments || visitAttachmentList.length > 0),
    [
      canViewVisitAttachments,
      canUploadVisitAttachments,
      canDeleteVisitAttachments,
      visitAttachmentList.length,
    ],
  )

  // Full-page CRF modal: single scroll region — prevent body + inner both scrolling
  useEffect(() => {
    if (!selectedVisit || !selectedForm) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [selectedVisit, selectedForm])

  useEffect(() => {
    let alive = true
    const toBool = (raw) => {
      const normalized = String(raw ?? "").trim().toLowerCase()
      return raw === true || raw === 1 || normalized === "true" || normalized === "1" || normalized === "yes"
    }
    const loadStudySettings = async () => {
      if (!studyId) {
        if (alive) {
          setIsMultiCrfAllowedPerVisitType(true)
          setIsPatientStatusEnabled(false)
          setIsVisitDateRestrictionEnabled(false)
          setIsPiSignoffRequired(false)
          setIsPiSignoffBulkEnabled(false)
          setPiReviewOrder(PI_REVIEW_ORDER.SDV_BEFORE_SIGN)
          setPiSignoffGranularity("crf_only")
          setQueryRaiseRoleGuidsByStudy([])
          setSdvRoleGuidsByStudy([])
          setIsStudySettingsLoading(false)
          setStudySettingsResolvedStudyId(null)
        }
        return
      }
      if (alive) {
        setIsStudySettingsLoading(true)
        setStudySettingsResolvedStudyId(null)
      }
      logVisitDateRestrictionDebug("study_settings_fetch_start", { studyId })
      try {
        const res = await studyService.getStudySettings(studyId)
        if (!alive) return
        const payload = res?.data || {}
        const rawMultiCrf =
          payload?.isMultiCrfAllowedPerVisitType ??
          payload?.IsMultiCrfAllowedPerVisitType ??
          payload?.studySetting?.isMultiCrfAllowedPerVisitType ??
          payload?.studySetting?.IsMultiCrfAllowedPerVisitType
        const rawPatientStatus =
          payload?.isPatientStatusEnabled ??
          payload?.IsPatientStatusEnabled ??
          payload?.studySetting?.isPatientStatusEnabled ??
          payload?.studySetting?.IsPatientStatusEnabled
        const rawVisitDateRestriction =
          payload?.isVisitDateRestriction ??
          payload?.IsVisitDateRestriction ??
          payload?.studySetting?.isVisitDateRestriction ??
          payload?.studySetting?.IsVisitDateRestriction
        // Single source of truth for SDV: sdvRoleGuids (empty = SDV off for study).
        const settingsRoot = {
          ...(payload?.studySetting && typeof payload.studySetting === "object" ? payload.studySetting : {}),
          ...payload,
        }
        setIsMultiCrfAllowedPerVisitType(toBool(rawMultiCrf))
        setIsPatientStatusEnabled(toBool(rawPatientStatus))
        setIsVisitDateRestrictionEnabled(toBool(rawVisitDateRestriction))
        setIsPiSignoffRequired(pickIsPiSignoffRequired(settingsRoot))
        setIsPiSignoffBulkEnabled(
          pickIsPiSignoffRequired(settingsRoot) && pickIsPiSignoffBulkEnabled(settingsRoot),
        )
        setPiReviewOrder(pickReviewOrderFromSettings(settingsRoot))
        setPiSignoffGranularity(pickPiSignoffGranularityFromSettings(settingsRoot))
        setQueryRaiseRoleGuidsByStudy(pickQueryRaiseRoleGuidsFromSettings(settingsRoot))
        setSdvRoleGuidsByStudy(pickSdvRoleGuidsFromSettings(settingsRoot))
        setPiSignoffRoleGuidsByStudy(pickPiSignoffRoleGuidsFromSettings(settingsRoot))
        setStudySettingsResolvedStudyId(Number.parseInt(String(studyId), 10))
        logVisitDateRestrictionDebug("study_settings_fetch_success", {
          studyId,
          isVisitDateRestrictionEnabled: toBool(rawVisitDateRestriction),
          rawVisitDateRestriction,
        })
      } finally {
        if (alive) setIsStudySettingsLoading(false)
      }
    }
    loadStudySettings()
    return () => {
      alive = false
    }
  }, [studyId])

  // Fetch patient enrolments from API (only when user is on this page – avoids prefetch triggering call on Patient enrollment etc.)
  useEffect(() => {
    const isOnThisPage =
      pathname === "/ecrf-data-entry" ||
      pathname?.startsWith("/ecrf-data-entry/manually") ||
      pathname?.startsWith("/ecrf-data-entry/ai-based")
    if (!isOnThisPage) return

    const fetchPatientEnrolments = async () => {
      const siteOk =
        siteId != null &&
        siteId !== "" &&
        !Number.isNaN(Number(siteId)) &&
        Number(siteId) > 0
      if (!studyId || !siteOk) {
        setPatients([])
        setLoadingPatients(false)
        return
      }

      try {
        setLoadingPatients(true)
        const response = await crfDataService.getPatientAndVisitDataForCrfDataEntry(
          studyId,
          siteId
        )

        if (response.isSuccess && response.data) {
          // Extract patientList and visitList from response
          const patientList = response.data.patientList || []
          const visitList = response.data.visitList || []

          // Store visitList for later use when patient is selected
          // Map visits to the format expected by the component
          const mappedVisits = visitList.map((visit, index) => ({
            id: visit.visitScheduleId?.toString() || `visit-${index}`,
            name: visit.visitName || `Visit ${visit.visitNo ?? index + 1}`,
            configListOrder: index,
            order: visit.visitNo ?? null,
            visitNo: visit.visitNo ?? null,
            visitScheduleId: visit.visitScheduleId, // IMPORTANT: Keep visitScheduleId for matching with visitCrfData
            visitGuid: visit.visitGuid,
            visitType: visit.visitType,
            crfFormType: visit.crfFormType ?? visit.CrfFormType ?? null,
            duration: visit.duration,
            windowMin: visit.windowMin,
            windowMax: visit.windowMax,
            crfDesignId: visit.crfDesignId,
            crfName: visit.crfName,
            crfGuid: visit.crfGuid,
            // Backend may return multiple CRF designs for the same visit (e.g. Screening has 3 CRFs).
            // We keep them so user can select which CRF form to open.
            crfDesigns: Array.isArray(visit.crfDesigns)
              ? visit.crfDesigns
                  .slice()
                  .sort((a, b) => (Number(a?.rowNumber) || 0) - (Number(b?.rowNumber) || 0))
              : [],
          }))

          // Preserve visit-configuration creation order (visitScheduleId), not visitNo sorting.
          setVisits(sortVisitsForManualDataEntry(mappedVisits))

          // visitCrfDataMap is per selected patient — built in handlePatientSelect, not from all patients here.
          applyVisitCrfDataMap({})

          // Map patients to component format
          const mappedPatients = patientList.map((item) => {
            // Initialize visits as pending (will be updated when visit data is available)
            const visits = {}
            mappedVisits.forEach(visit => {
              visits[visit.id] = { status: "pending", progress: 0 }
            })

            // Determine overall status based on Baseline and Screening visits only
            let overallStatus = "pending"

            // Check if patient has visitCrfData and extract status from Baseline/Screening only
            if (item.visitCrfData && Array.isArray(item.visitCrfData)) {
              // Filter only Baseline and Screening visits
              const baselineScreeningData = item.visitCrfData.filter(vcd => {
                const visitName = (vcd.visitName || vcd.crfFormType || "").toLowerCase()
                return visitName === "baseline" || visitName === "screening"
              })

              // Determine status from Baseline and Screening visits
              if (baselineScreeningData.length > 0) {
                // Check if all are submitted
                const allSubmitted = baselineScreeningData.every(vcd =>
                  vcd.status === "Submitted" || vcd.status === 3
                )
                // Check if any are submitted
                const anySubmitted = baselineScreeningData.some(vcd =>
                  vcd.status === "Submitted" || vcd.status === 3
                )
                // Check if any are saved
                const anySaved = baselineScreeningData.some(vcd =>
                  vcd.status === "Saved" || vcd.status === 2
                )

                if (allSubmitted) {
                  overallStatus = "completed"
                } else if (anySubmitted || anySaved) {
                  overallStatus = "inprocess"
                } else {
                  // Check if any have draft status
                  const anyDraft = baselineScreeningData.some(vcd =>
                    vcd.status === "Draft" || vcd.status === 1
                  )
                  overallStatus = anyDraft ? "inprocess" : "pending"
                }
              }
            }

            const displayPatientId =
              String(item.screeningNo ?? item.ScreeningNo ?? "").trim() ||
              String(item.usubjid ?? item.Usubjid ?? "").trim() ||
              `PID-${item.patientId}`

            return {
              id: item.patientId,
              patientId: displayPatientId,
              screeningNo: String(item.screeningNo ?? item.ScreeningNo ?? "").trim(),
              randomizationNumber: String(
                item.randomizationNumber ?? item.RandomizationNumber ?? "",
              ).trim(),
              usubjid: String(item.usubjid ?? item.Usubjid ?? "").trim(),
              patientGuid: item.patientGuid,
              initial: item.initial || "",
              gender: item.gender || "",
              dataCaptureDate: item.dataCaptureDate || "",
              patientStatusCode: item.patientStatusCode ?? null,
              patientStatusName: getPatientStatusLabel(item.patientStatusName, item.patientStatusCode),
              currentStatusCode:
                item.currentStatusCode ??
                item.patientStatusCode ??
                item.statusCode ??
                null,
              currentStatusName: getPatientStatusLabel(
                item.currentStatusName ?? item.patientStatusName ?? item.statusName ?? "",
                item.currentStatusCode ?? item.patientStatusCode ?? item.statusCode,
              ),
              status: overallStatus,
              visits: visits,
              visitCrfData: (item.visitCrfData || []).map((vcd) => ({
                ...vcd,
                isSdvVerify: Boolean(vcd.isSdvVerify ?? vcd.IsSdvVerify),
                querySummary: normalizeCrfQuerySummary(vcd.querySummary ?? vcd.QuerySummary),
                progress: normalizeCrfProgress(vcd.progress ?? vcd.Progress),
              })),
              querySummary: normalizeCrfQuerySummary(item.querySummary ?? item.QuerySummary),
              progress: normalizeCrfProgress(item.progress ?? item.Progress),
            }
          })

          setPatients(mappedPatients)

          setSelectedPatient((prev) => {
            if (!prev?.id) return prev
            const refreshed = mappedPatients.find((p) => p.id === prev.id)
            return refreshed ? { ...prev, ...refreshed } : prev
          })
        } else {
          setPatients([])
          toast({
            title: "Could not load patient grid",
            description:
              response?.message ||
              (response?.statusCode === 500
                ? "Server error loading CRF data. The API may need a backend update — contact support or retry."
                : "Failed to load patients and visits for this study/site."),
            variant: "destructive",
            duration: 5000,
          })
        }
      } catch (error) {
        console.error("Error fetching patient and visit data:", error)
        setPatients([])
        toast({
          title: "Could not load patient grid",
          description: error?.message || "Network or server error while loading CRF data entry grid.",
          variant: "destructive",
          duration: 5000,
        })
      } finally {
        setLoadingPatients(false)
      }
    }

    fetchPatientEnrolments()
  }, [pathname, studyId, siteId])

  // When study/site are cleared (header "X"), drop stale selection and visits — same scope as patient list fetch.
  useEffect(() => {
    const siteOk =
      siteId != null &&
      siteId !== "" &&
      !Number.isNaN(Number(siteId)) &&
      Number(siteId) > 0
    const currentScopeKey = studyId && siteOk ? `${studyId}:${Number(siteId)}` : null
    const previousScopeKey = lastStudySiteScopeRef.current
    const scopeChanged = Boolean(previousScopeKey && currentScopeKey && previousScopeKey !== currentScopeKey)
    const scopeCleared = !currentScopeKey
    if (!scopeChanged && !scopeCleared) {
      lastStudySiteScopeRef.current = currentScopeKey
      return
    }
    setSelectedPatient(null)
    setSelectedVisit(null)
    setSelectedForm(null)
    setCurrentFormStatus(null)
    setFormData({})
    setAvailableFormsByVisit({})
    setLoadingFormsByVisit({})
    setShowFormDropdown(null)
    setVisits([])
    applyVisitCrfDataMap({})
    setVisitPrimaryVisitDatesBySchedule({})
    setPendingRepeatableRowsByPatient({})
    setValidationErrors({})
    setCrfRuleMessages([])
    setCrfRuleControlOverrides({})
    setPatients([])
    crfDesignPayloadCacheRef.current = {}
    crfRulesCacheRef.current = {}
    visitFormsTemplateCacheRef.current = {}
    crfDataByIdCacheRef.current = {}
    fetchFormsForVisitInFlightRef.current = {}
    lastSelectedPatientRef.current = null
    isProcessingPatientRef.current = false
    selectedPatientRef.current = null
    lastStudySiteScopeRef.current = currentScopeKey
  }, [studyId, siteId])

  useEffect(() => {
    if (!selectedPatient?.id) return
    const stillExists = patients.some((p) => p?.id === selectedPatient.id)
    if (stillExists) return
    setSelectedPatient(null)
    setSelectedVisit(null)
    setSelectedForm(null)
    setCurrentFormStatus(null)
    setFormData({})
    setAvailableFormsByVisit({})
    setLoadingFormsByVisit({})
    setShowFormDropdown(null)
    setValidationErrors({})
    setCrfRuleMessages([])
    setCrfRuleControlOverrides({})
    setVisitAttachmentList([])
    setVisitPrimaryVisitDatesBySchedule({})
    lastSelectedPatientRef.current = null
    isProcessingPatientRef.current = false
    selectedPatientRef.current = null
  }, [patients, selectedPatient?.id])

  const filteredPatients = patients.filter(patient =>
    patient.patientId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.screeningNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.randomizationNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.initial.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const matrixVisitColumns = useMemo(() => {
    const cols = visits.filter(
      (v) =>
        shouldShowVisitInManualDataEntry(v) &&
        !visitMatchesRepeatableEntryEnum(v, REPEATABLE_ENTRY_VISIT_ENUM.unscheduled) &&
        !visitMatchesRepeatableEntryEnum(v, REPEATABLE_ENTRY_VISIT_ENUM.adverse),
    )
    return sortVisitsForManualDataEntry(cols)
  }, [visits])

  const refreshVisitPrimaryVisitDateChainForPatient = useCallback(
    async (patientId) => {
      const studyNum = Number.parseInt(String(studyId ?? ""), 10)
      const siteNum = Number.parseInt(String(siteId ?? ""), 10)
      const patientNum = Number.parseInt(String(patientId ?? ""), 10)
      if (
        !Number.isFinite(studyNum) ||
        studyNum <= 0 ||
        !Number.isFinite(siteNum) ||
        siteNum <= 0 ||
        !Number.isFinite(patientNum) ||
        patientNum <= 0
      ) {
        logVisitDateRestrictionDebug("chain_fetch_skipped_invalid_scope", {
          studyId,
          siteId,
          patientId,
        })
        return
      }
      visitDateChainPendingCountRef.current += 1
      setIsVisitDateChainLoading(true)
      logVisitDateRestrictionDebug("chain_fetch_start", {
        studyId: studyNum,
        siteId: siteNum,
        patientId: patientNum,
        pendingCount: visitDateChainPendingCountRef.current,
      })
      try {
        const dateChainResponse = await crfDataService.getPatientVisitPrimaryVisitDates(
          studyNum,
          siteNum,
          patientNum
        )
        if (!dateChainResponse?.isSuccess) return
        const rows = Array.isArray(dateChainResponse?.data)
          ? dateChainResponse.data
          : Array.isArray(dateChainResponse?.data?.items)
            ? dateChainResponse.data.items
            : []
        const nextBySchedule = {}
        rows.forEach((row) => {
          const scheduleKey = toScheduleKey(row?.visitScheduleId)
          if (!scheduleKey) return
          nextBySchedule[scheduleKey] = {
            visitScheduleId: row?.visitScheduleId ?? null,
            visitNo: row?.visitNo ?? null,
            visitName: row?.visitName ?? null,
            visitType: row?.visitType ?? null,
            crfDataId: row?.crfDataId ?? null,
            primaryVisitDate: row?.primaryVisitDate ?? null,
            prevovisitPrimaryVisitDate:
              row?.prevovisitPrimaryVisitDate ??
              row?.previousVisitPrimaryVisitDate ??
              row?.prevVisitPrimaryVisitDate ??
              null,
          }
        })
        setVisitPrimaryVisitDatesBySchedule(nextBySchedule)
        logVisitDateRestrictionDebug("chain_fetch_success", {
          patientId: patientNum,
          rowCount: rows.length,
          scheduleKeys: Object.keys(nextBySchedule),
        })
      } finally {
        visitDateChainPendingCountRef.current = Math.max(0, visitDateChainPendingCountRef.current - 1)
        if (visitDateChainPendingCountRef.current === 0) {
          setIsVisitDateChainLoading(false)
        }
        logVisitDateRestrictionDebug("chain_fetch_end", {
          patientId: patientNum,
          pendingCount: visitDateChainPendingCountRef.current,
        })
      }
    },
    [studyId, siteId]
  )

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "bg-green-500"
      case "inprocess":
        return "bg-orange-500"
      case "pending":
        return "bg-red-500"
      default:
        return "bg-gray-400"
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case "inprocess":
        return <Clock className="w-4 h-4 text-orange-600" />
      case "pending":
        return <XCircle className="w-4 h-4 text-red-600" />
      default:
        return null
    }
  }

  const handlePatientSelect = async (patient) => {
    if (!patient?.id) return

    selectedPatientRef.current = patient

    // Prevent duplicate processing if same patient clicked again or already processing
    if (isProcessingPatientRef.current || lastSelectedPatientRef.current === patient?.id) {
      if (!selectedPatient?.id) {
        setSelectedPatient(patient)
      }
      try {
        applyVisitCrfDataMap(buildPatientVisitCrfMap(patient?.visitCrfData))
      } catch (e) {
        applyVisitCrfDataMap({})
      }
      console.log("Skipping duplicate patient selection:", patient?.id)
      return
    }

    isProcessingPatientRef.current = true
    lastSelectedPatientRef.current = patient?.id

    setSelectedPatient(patient)
    setMobilePatientPanelOpen(false)
    setVisitPrimaryVisitDatesBySchedule({})
    // Build visit->CRF map for the selected patient (so visit statuses are correct per patient)
    try {
      applyVisitCrfDataMap(buildPatientVisitCrfMap(patient?.visitCrfData))
    } catch (e) {
      applyVisitCrfDataMap({})
    }
    setSelectedVisit(null)
    setSelectedForm(null)
    setCurrentFormStatus(null)
    setFormData({})
    setAvailableFormsByVisit({})
    setShowFormDropdown(null)

    // Clear cache for previous patient
    Object.keys(crfDataCacheRef.current).forEach(key => {
      if (!key.startsWith(`${patient.id}_`)) {
        delete crfDataCacheRef.current[key]
      }
    })

    // DON'T fetch CRF data when patient is clicked
    // CRF data will be fetched only when:
    // 1. User clicks on a visit (to load forms and check status)
    // 2. After saving CRF data (to refresh status)
    // This prevents unnecessary GetCrfDataList API calls on patient selection

    void refreshVisitPrimaryVisitDateChainForPatient(patient?.id)
    void prefetchPatientCrfDataRecords(patient)
    isProcessingPatientRef.current = false
  }

  const handleAddVisitTypeForPatient = async (patient, kind) => {
    if (!patient?.id || (kind !== "unscheduled" && kind !== "adverse")) return
    isProcessingPatientRef.current = false
    lastSelectedPatientRef.current = null
    await handlePatientSelect(patient)
    await handleAddRepeatableVisitSchedule(kind)
  }

  // Fetch CRF data once per patient (cached)
  const fetchCrfDataForPatient = async (patientEnrolmentId, studyId) => {
    // Check cache first
    const cacheKey = `${patientEnrolmentId}_${studyId}`
    const cached = crfDataCacheRef.current[cacheKey]
    const now = Date.now()

    // Use cache if less than 30 seconds old
    if (cached && (now - cached.timestamp) < 30000) {
      console.log("Using cached CRF data for patient:", patientEnrolmentId)
      return cached.data
    }

    // Prevent concurrent calls
    if (fetchingCrfDataRef.current) {
      console.log("CRF data fetch already in progress, skipping...")
      return null
    }

    fetchingCrfDataRef.current = true
    try {
      console.log("Fetching CRF data for patient:", patientEnrolmentId)
      const response = await crfDataService.getCrfDataList(
        1, // pageNumber
        100, // pageSize - get all
        studyId,
        patientEnrolmentId,
        null, // crfDesignId
        null, // status
        true // isActive
      )

      if (response.isSuccess && response.data?.items) {
        // Cache the data
        crfDataCacheRef.current[cacheKey] = {
          data: response.data.items,
          timestamp: now
        }
        return response.data.items
      }
      return []
    } catch (error) {
      console.error("Error fetching CRF data for patient:", error)
      return []
    } finally {
      fetchingCrfDataRef.current = false
    }
  }

  /** Re-fetch patient row from grid API so visitCrfData / crfDataId match DB after save. */
  const syncPatientVisitCrfFromGrid = useCallback(
    async (patientEnrolmentId) => {
      const siteOk =
        siteId != null &&
        siteId !== "" &&
        !Number.isNaN(Number(siteId)) &&
        Number(siteId) > 0
      if (!studyId || !siteOk || !patientEnrolmentId) return null

      try {
        const response = await crfDataService.getPatientAndVisitDataForCrfDataEntry(studyId, siteId)
        if (!response?.isSuccess || !response?.data?.patientList) return null

        const row = response.data.patientList.find(
          (p) => String(p.patientId) === String(patientEnrolmentId),
        )
        if (!row) return null

        const visitCrfData = (row.visitCrfData || []).map((vcd) => ({
          ...vcd,
          isSdvVerify: Boolean(vcd.isSdvVerify ?? vcd.IsSdvVerify),
          querySummary: normalizeCrfQuerySummary(vcd.querySummary ?? vcd.QuerySummary),
          progress: normalizeCrfProgress(vcd.progress ?? vcd.Progress),
        }))

        setPatients((prev) =>
          prev.map((p) => (p.id === patientEnrolmentId ? { ...p, visitCrfData } : p)),
        )
        setSelectedPatient((prev) => {
          if (prev?.id === patientEnrolmentId) {
            const updated = { ...prev, visitCrfData }
            selectedPatientRef.current = updated
            return updated
          }
          return prev
        })
        applyVisitCrfDataMap(buildPatientVisitCrfMap(visitCrfData))
        return visitCrfData
      } catch (error) {
        console.error("Error syncing patient visit CRF data from grid:", error)
        return null
      }
    },
    [studyId, siteId, applyVisitCrfDataMap],
  )

  const loadCrfDataRecordById = useCallback(
    async (crfDataId) => {
      const id = parseInt(String(crfDataId ?? ""), 10)
      const sid = parseInt(String(studyId ?? ""), 10)
      if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(sid) || sid <= 0) return null

      const cacheKey = `${sid}_${id}`
      const cached = crfDataByIdCacheRef.current[cacheKey]
      const now = Date.now()
      if (cached && now - cached.timestamp < 120000) {
        return cached.data
      }

      const response = await crfDataService.getCrfDataById(id, sid)
      if (response?.isSuccess && response?.data) {
        crfDataByIdCacheRef.current[cacheKey] = {
          data: response.data,
          timestamp: now,
        }
        return response.data
      }
      return null
    },
    [studyId],
  )

  const invalidateCrfDataByIdCache = useCallback(
    (crfDataId) => {
      const id = parseInt(String(crfDataId ?? ""), 10)
      const sid = parseInt(String(studyId ?? ""), 10)
      if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(sid) || sid <= 0) return
      delete crfDataByIdCacheRef.current[`${sid}_${id}`]
    },
    [studyId],
  )

  const cloneVisitFormsTemplate = useCallback((forms) => {
    if (typeof structuredClone === "function") return structuredClone(forms)
    return JSON.parse(JSON.stringify(forms))
  }, [])

  const extractRulesFromApiResponse = useCallback((data) => {
    if (Array.isArray(data)) return data
    if (data?.items && Array.isArray(data.items)) return data.items
    if (data?.data && Array.isArray(data.data)) return data.data
    return []
  }, [])

  const runPrefetchInBatches = useCallback(async (items, batchSize, worker) => {
    const list = Array.isArray(items) ? items : []
    if (list.length === 0) return
    const size = Math.max(1, Number(batchSize) || 1)
    for (let i = 0; i < list.length; i += size) {
      await Promise.all(list.slice(i, i + size).map((item) => worker(item)))
    }
  }, [])

  const prefetchCrfRulesForDesign = useCallback(
    async (designId) => {
      const id = Number(designId)
      const sid = Number(studyId)
      if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(sid) || sid <= 0) return
      const cacheKey = `${sid}_${id}`
      if (Array.isArray(crfRulesCacheRef.current[cacheKey]) && crfRulesCacheRef.current[cacheKey].length > 0) {
        return
      }
      try {
        const rulesResponse = await crfRuleService.getCrfRulesByCrfId(id)
        if (rulesResponse?.isSuccess && rulesResponse?.data) {
          const rules = extractRulesFromApiResponse(rulesResponse.data)
          if (rules.length > 0) {
            crfRulesCacheRef.current[cacheKey] = rules
          }
        }
      } catch (error) {
        console.warn(`Prefetch rules failed for CRF design ${id}:`, error)
      }
    },
    [studyId, extractRulesFromApiResponse],
  )

  const prefetchPatientCrfDataRecords = useCallback(
    (patient) => {
      const ids = [
        ...new Set(
          (Array.isArray(patient?.visitCrfData) ? patient.visitCrfData : [])
            .map((row) => parseInt(String(row?.crfDataId ?? ""), 10))
            .filter((id) => Number.isFinite(id) && id > 0),
        ),
      ]
      if (ids.length === 0) return
      void runPrefetchInBatches(ids, 4, (crfDataId) => loadCrfDataRecordById(crfDataId))
    },
    [loadCrfDataRecordById, runPrefetchInBatches],
  )

  // Fetch CRF designs for the selected visit
  const getVisitCrfDesignIds = useCallback((visit) => {
    if (!visit) return []

    const visitCrfDesigns = Array.isArray(visit.crfDesigns) ? visit.crfDesigns : []
    const idsFromArray = visitCrfDesigns
      .slice()
      .sort((a, b) => (Number(a?.rowNumber) || 0) - (Number(b?.rowNumber) || 0))
      .map((d) => d?.crfDesignId ?? d?.crfDesignID ?? d?.id)
      .map((x) => Number.parseInt(String(x ?? ""), 10))
      .filter((n) => Number.isFinite(n) && n > 0)

    if (idsFromArray.length > 0) {
      return [...new Set(idsFromArray)]
    }

    const fallback = Number.parseInt(String(visit.crfDesignId ?? ""), 10)
    return Number.isFinite(fallback) && fallback > 0 ? [fallback] : []
  }, [])

  const fetchCrfDesignPayloadsForVisit = useCallback(async (visit) => {
    if (!visit || !studyId) return []
    const designIds = getVisitCrfDesignIds(visit)
    if (designIds.length === 0) return []

    // Reuse design payloads after first fetch for this study.
    const cachedPayloadByDesignId = new Map()
    const missingDesignIds = []

    designIds.forEach((designId) => {
      const cacheKey = `${studyId}_${designId}`
      const cached = crfDesignPayloadCacheRef.current[cacheKey]
      if (cached === undefined) {
        missingDesignIds.push(designId)
      } else if (cached) {
        cachedPayloadByDesignId.set(designId, cached)
      }
      // cached === null → previously failed; skip refetch for this session
    })

    if (missingDesignIds.length > 0) {
      const designResponses = await Promise.all(
        missingDesignIds.map(async (designId) => {
          try {
            const response = await crfDesignService.getCrfDesignById(designId, studyId)
            return { designId, response }
          } catch (err) {
            console.warn(`CRF design ${designId} unavailable for visit ${visit?.name ?? visit?.id}:`, err?.message || err)
            return { designId, response: null }
          }
        }),
      )

      designResponses.forEach(({ designId, response }) => {
        const cacheKey = `${studyId}_${designId}`
        if (response?.isSuccess && response?.data) {
          crfDesignPayloadCacheRef.current[cacheKey] = response.data
          cachedPayloadByDesignId.set(designId, response.data)
        } else {
          // Negative-cache so study-wide prefetch does not spam the same missing design.
          crfDesignPayloadCacheRef.current[cacheKey] = null
        }
      })
    }

    // Preserve backend sequence order (rowNumber via designIds source).
    return designIds
      .map((designId) => cachedPayloadByDesignId.get(designId))
      .filter(Boolean)
  }, [studyId, getVisitCrfDesignIds])

  const prefetchStudyCrfDesignsForVisits = useCallback(
    async (visitList) => {
      if (!studyId || !Array.isArray(visitList) || visitList.length === 0) return
      await runPrefetchInBatches(visitList, 3, async (visit) => {
        try {
          await fetchCrfDesignPayloadsForVisit(visit)
        } catch (error) {
          console.warn(`Prefetch CRF design failed for visit ${visit?.name ?? visit?.id}:`, error)
        }
      })
      const designIds = new Set()
      visitList.forEach((visit) => {
        getVisitCrfDesignIds(visit).forEach((designId) => designIds.add(designId))
      })
      await runPrefetchInBatches([...designIds], 4, (designId) => prefetchCrfRulesForDesign(designId))
    },
    [studyId, getVisitCrfDesignIds, fetchCrfDesignPayloadsForVisit, prefetchCrfRulesForDesign, runPrefetchInBatches],
  )

  useEffect(() => {
    if (!studyId || !Array.isArray(visits) || visits.length === 0) return
    void prefetchStudyCrfDesignsForVisits(visits)
  }, [studyId, visits, prefetchStudyCrfDesignsForVisits])

  const finalizeVisitFormsLoad = useCallback(
    async (visitId, forms, silentLoad) => {
      setAvailableFormsByVisit((prev) => ({ ...prev, [visitId]: forms }))

      if (!silentLoad) {
        const visit = getVisitById(visitId)
        const expectedCrfCount =
          isMultiCrfAllowedPerVisitType && Array.isArray(visit?.crfDesigns) && visit.crfDesigns.length > 0
            ? visit.crfDesigns.length
            : visit?.crfDesignId
              ? 1
              : 0

        if (visit?.isRepeatableGroup) {
          setShowFormDropdown(visitId)
        } else if (expectedCrfCount > 1) {
          setShowFormDropdown(visitId)
        } else if (forms.length === 1) {
          if (handleFormSelectRef.current) {
            await handleFormSelectRef.current(forms[0], visitId)
          }
        } else if (forms.length > 1) {
          setShowFormDropdown(visitId)
        } else {
          console.warn("No forms found for visit:", visitId)
          setShowFormDropdown(visitId)
        }
      }
      return forms
    },
    [getVisitById, isMultiCrfAllowedPerVisitType],
  )

  const fetchFormsForVisit = async (visitId, silentLoad = false, providedCrfDesigns = null) => {
    if (!visitId) {
      console.warn("Missing visitId:", { visitId })
      return []
    }

    // If forms already loaded for this visit, refresh CRF metadata from patient grid (don't serve stale crfDataId).
    if (availableFormsByVisit[visitId] && availableFormsByVisit[visitId].length > 0) {
      const visitMeta = getVisitById(visitId)
      const patientForEnrich = selectedPatientRef.current ?? selectedPatient
      const enriched = enrichVisitFormsWithCrfMeta(availableFormsByVisit[visitId], visitMeta, patientForEnrich)
      setAvailableFormsByVisit((prev) => ({ ...prev, [visitId]: enriched }))
      if (!silentLoad) {
        setShowFormDropdown(visitId)
      }
      return enriched
    }

    const visitKey = String(visitId)
    const inFlight = fetchFormsForVisitInFlightRef.current[visitKey]
    if (inFlight) {
      return inFlight
    }

    const loader = (async () => {
      const templateKey = studyId ? `${studyId}_${visitId}` : null
      const cachedTemplate = templateKey ? visitFormsTemplateCacheRef.current[templateKey] : null
      if (cachedTemplate?.length && !providedCrfDesigns) {
        try {
          if (!silentLoad) {
            setLoadingFormsByVisit((prev) => ({ ...prev, [visitId]: true }))
          }
          const visitMeta = getVisitById(visitId)
          const patientForEnrich = selectedPatientRef.current ?? selectedPatient
          const forms = enrichVisitFormsWithCrfMeta(
            cloneVisitFormsTemplate(cachedTemplate),
            visitMeta,
            patientForEnrich,
          )
          return await finalizeVisitFormsLoad(visitId, forms, silentLoad)
        } finally {
          if (!silentLoad) {
            setLoadingFormsByVisit((prev) => ({ ...prev, [visitId]: false }))
          }
        }
      }

    try {
      if (!silentLoad) {
        setLoadingFormsByVisit(prev => ({ ...prev, [visitId]: true }))
      }

      let crfDesigns = []

      // Use provided CRF designs if available (from GetCrfDesignsByStudyId call)
      if (providedCrfDesigns && providedCrfDesigns.length > 0) {
        crfDesigns = providedCrfDesigns
      } else {
        // Fallback: resolve all CRF designs for the visit (multi-CRF safe)
        const visit = getVisitById(visitId)
        const designSourceVisit =
          visit?.isRepeatableGroup && visit?.templateVisitId
            ? visits.find((v) => String(v.id) === String(visit.templateVisitId))
            : visit
        if (designSourceVisit && studyId) {
          try {
            crfDesigns = await fetchCrfDesignPayloadsForVisit(designSourceVisit)
          } catch (error) {
            console.error("Error fetching CRF designs from API:", error)
          }
        } else if (designSourceVisit && !studyId) {
          console.log("Study is missing; cannot fetch CRF designs")
        } else if (designSourceVisit && getVisitCrfDesignIds(designSourceVisit).length === 0) {
          // Visit exists but has no CRF design assigned
          console.log(`Visit ${designSourceVisit.name} has no CRF design assigned`)
        }
      }

      const forms = []
      const visitMeta = getVisitById(visitId)
      const rowDesignSourceVisit =
        visitMeta?.isRepeatableGroup && visitMeta?.templateVisitId
          ? visits.find((v) => String(v.id) === String(visitMeta.templateVisitId))
          : visitMeta
      const rowNumberByDesignKey = new Map(
        (Array.isArray(rowDesignSourceVisit?.crfDesigns) ? rowDesignSourceVisit.crfDesigns : []).map((d) => [
          toDesignKey(d?.crfDesignId ?? d?.crfDesignID ?? d?.id),
          Number(d?.rowNumber) || null,
        ])
      )

      if (isEcrfDataEntryDebugEnabled()) {
        console.log("Parsed CRF Designs:", crfDesigns)
      }

      // Parse each CRF design and extract sections
      // Use Promise.all to fetch rules for each CRF design in parallel
      const formsWithRules = await Promise.all(
        crfDesigns.map(async (crfDesign) => {
          const resolvedDesignId = crfDesign?.id ?? crfDesign?.crfDesignId ?? crfDesign?.crfDesignID ?? null
          if (resolvedDesignId == null) {
            ecrfDebug("Skipping CRF design without id", crfDesign)
            return null
          }

          // Get sections from the design object
          let sections = []
          try {
            // Prefer parsing from htmlContent when available so postfix, cellLabels, and other
            // designer-only props are included. Else use sections from API (saved field-wise in DB
            // when we send sections in save payload; includes postfix/prefix per control).
            if (crfDesign.htmlContent) {
              sections = parseHtmlContent(crfDesign.htmlContent)
              if (isEcrfDataEntryDebugEnabled()) {
                console.log(`Parsed ${sections.length} sections from HTML content for CRF Design ${resolvedDesignId}`)
              }
              // If backend stripped table-only props from HTML, fill from API sections so
              // date restrictions / labels still work in data entry.
              if (crfDesign.sections && Array.isArray(crfDesign.sections)) {
                const apiControlsById = new Map()
                crfDesign.sections.forEach(sec => {
                  (sec.controls || []).forEach(c => {
                    if (c?.id) apiControlsById.set(c.id, c)
                  })
                })
                sections = sections.map(sec => ({
                  ...sec,
                  controls: (sec.controls || []).map(c => {
                    if (!c?.id) return c
                    const apiControl = apiControlsById.get(c.id)
                    const apiProps = apiControl?.properties || {}
                    if (!apiProps || typeof apiProps !== "object") return c
                    const isTable = String(c.type || "").toLowerCase() === "table"
                    const hasLabels = Array.isArray(c.properties?.cellLabels) && c.properties.cellLabels.some(row => Array.isArray(row) && row.some(cell => cell != null && cell !== ""))
                    const hasDateRestrictions = Array.isArray(c.properties?.columnDateRestrictions) && c.properties.columnDateRestrictions.length > 0
                    const hasGenderSpecific = Boolean(c.properties?.genderSpecific)
                    const needsTableMerge = isTable && (!hasLabels || !hasDateRestrictions)
                    const needsGenderMerge = !hasGenderSpecific && Boolean(apiProps.genderSpecific)
                    const hasAutoSrc = String(c.properties?.autoValueMapSourceFieldId || "").trim()
                    const hasAutoRules = String(c.properties?.autoValueMapRules || "").trim()
                    const apiAutoSrc = String(apiProps.autoValueMapSourceFieldId || "").trim()
                    const apiAutoRules = String(apiProps.autoValueMapRules || "").trim()
                    const needsAutoMapMerge = !hasAutoSrc && Boolean(apiAutoSrc)
                    const needsAutoRulesMerge = !hasAutoRules && Boolean(apiAutoRules)
                    const needsReadonlyMerge =
                      isDesignerReadonly(apiProps) && !isDesignerReadonly(c.properties)
                    const apiDefault = apiProps.defaultValue
                    const hasDesignerDefault =
                      apiDefault !== undefined &&
                      apiDefault !== null &&
                      String(apiDefault).trim() !== ""
                    const needsDefaultMerge =
                      hasDesignerDefault &&
                      (c.properties?.defaultValue === undefined ||
                        c.properties?.defaultValue === null ||
                        String(c.properties?.defaultValue).trim() === "")
                    if (
                      !needsTableMerge &&
                      !needsGenderMerge &&
                      !needsAutoMapMerge &&
                      !needsAutoRulesMerge &&
                      !needsReadonlyMerge &&
                      !needsDefaultMerge
                    ) {
                      return c
                    }
                    return {
                      ...c,
                      properties: {
                        ...c.properties,
                        ...(isTable && !hasLabels ? { cellLabels: apiProps.cellLabels } : {}),
                        ...(isTable && !hasDateRestrictions ? { columnDateRestrictions: apiProps.columnDateRestrictions } : {}),
                        ...(!hasGenderSpecific && apiProps.genderSpecific ? { genderSpecific: apiProps.genderSpecific } : {}),
                        ...(needsAutoMapMerge ? { autoValueMapSourceFieldId: apiProps.autoValueMapSourceFieldId } : {}),
                        ...(needsAutoRulesMerge ? { autoValueMapRules: apiProps.autoValueMapRules } : {}),
                        ...(needsReadonlyMerge
                          ? { readonly: true, designerReadonly: true }
                          : {}),
                        ...(needsDefaultMerge ? { defaultValue: apiDefault } : {}),
                      }
                    }
                  })
                }))
              }
            } else if (crfDesign.sections && Array.isArray(crfDesign.sections)) {
              sections = crfDesign.sections
            }
          } catch (e) {
            console.error("Error getting CRF design sections:", e, crfDesign)
            sections = []
          }

          console.log(`CRF Design ${resolvedDesignId || 'unknown'} - Sections found:`, sections.length)
          // Helpful debug: log any controls that have prefix/postfix so we can compare with designer
          try {
            const debugControls = sections
              .flatMap(s => s.controls || [])
              .filter(c => c?.properties?.postfix || c?.properties?.prefix)
            if (debugControls.length > 0) {
              if (isEcrfDataEntryDebugEnabled()) {
                console.log("Data-entry load - controls with prefix/postfix:", debugControls)
              }
            } else {
              console.log("Data-entry load - no controls with prefix/postfix found in sections")
            }
          } catch (logErr) {
            console.warn("Failed to log prefix/postfix controls:", logErr)
          }

          // Fetch rules for this CRF design if not already included
          const rulesCacheKey = `${studyId}_${resolvedDesignId}`
          let rules = crfDesign.rules || crfRulesCacheRef.current[rulesCacheKey] || []
          if (!rules.length) {
            try {
              if (isEcrfDataEntryDebugEnabled()) {
                console.log(`Fetching rules for CRF Design ${resolvedDesignId} from API...`)
              }
              const rulesResponse = await crfRuleService.getCrfRulesByCrfId(resolvedDesignId)
              if (rulesResponse.isSuccess && rulesResponse.data) {
                rules = extractRulesFromApiResponse(rulesResponse.data)
                if (rules.length > 0) {
                  crfRulesCacheRef.current[rulesCacheKey] = rules
                }
                console.log(`Fetched ${rules.length} rules for CRF Design ${resolvedDesignId}`)
                
                // Verify that rules have expression field (API should now return it)
                if (rules.length > 0) {
                  const firstRule = rules[0]
                  if (!firstRule.expression && !firstRule.ruleExpression) {
                    console.warn(`Warning: Rule ${firstRule.id} is missing expression field. API should return 'expression' field.`)
                    console.warn('Rule structure:', Object.keys(firstRule))
                  } else {
                    if (isEcrfDataEntryDebugEnabled()) {
                      console.log(`✓ Rules include expression field (API updated successfully)`)
                    }
                  }
                }
              }
            } catch (error) {
              console.error(`Error fetching rules for CRF Design ${resolvedDesignId}:`, error)
              rules = []
            }
          } else {
            console.log(`Using ${rules.length} rules from CRF Design response for ${resolvedDesignId}`)
          }

          // Combine all sections into one form (one form per visit)
          if (sections.length > 0) {
            // Safety filter: execute only active, non-deleted rules from API payload.
            const runtimeRules = (rules || [])
              .filter((rule) => {
                const isActiveRaw = rule?.isActive ?? rule?.IsActive
                const isDeletedRaw = rule?.isDeleted ?? rule?.IsDeleted
                const isActive = isActiveRaw == null ? true : Boolean(isActiveRaw)
                const isDeleted = isDeletedRaw == null ? false : Boolean(isDeletedRaw)
                return isActive && !isDeleted
              })
              .map(normalizeCrfRuleExpressionFields)
            if (runtimeRules.length !== (rules || []).length) {
              console.log(
                `CRF Design ${resolvedDesignId} - filtered inactive/deleted rules: ${rules.length} -> ${runtimeRules.length}`,
              )
            }

            // Merge all sections into a single form
            const allControls = []
            sections.forEach((section) => {
              if (section.controls && Array.isArray(section.controls)) {
                allControls.push(...section.controls)
              }
            })

            // Map rules to controls based on targetField or targetFields (one rule can target multiple fields)
            // Rules need to be attached to control.properties.rules for rule evaluation to work
            const controlsWithRules = allControls.map(control => {
              const controlId = String(control?.id || "").trim()
              // Find all rules that target this control (single targetField or multiple targetFields)
              const controlRules = runtimeRules
                .filter(rule => {
                  const targetField = String(rule?.targetField ?? "").trim()
                  const targetFields = Array.isArray(rule?.targetFields)
                    ? rule.targetFields.map((v) => String(v || "").trim()).filter(Boolean)
                    : []
                  if (targetField && targetField === controlId) return true
                  if (targetFields.length > 0 && targetFields.includes(controlId)) return true
                  // targetField can be comma-separated (e.g. "id1,id2,id3") = one rule, multiple targets
                  if (typeof rule.targetField === "string" && rule.targetField.includes(",")) {
                    const ids = rule.targetField.split(",").map(s => s.trim()).filter(Boolean)
                    if (ids.includes(controlId)) return true
                    if (String(control.type || "").toLowerCase() === "table" && ids.some(id => id.startsWith(controlId + "_row_") || id.startsWith(controlId + "_col_"))) return true
                  }
                  if (String(control.type || "").toLowerCase() === "table" && typeof rule.targetField === "string") {
                    const tf = String(rule.targetField || "")
                    if (tf.startsWith(controlId + "_row_") || tf.startsWith(controlId + "_col_")) return true
                  }
                  return false
                })
                .map(rule => {
                  // API now returns 'expression' field - use it directly
                  // Keep fallback for backward compatibility during transition
                  const expression = rule.expression || rule.ruleExpression || ""
                  
                  // Log warning if expression is still missing (API might not be updated yet)
                  if (!expression) {
                    console.warn(`Rule ${rule.id} (${rule.ruleName}) is missing expression field. API should return 'expression' field.`)
                    console.warn('Available rule fields:', Object.keys(rule))
                  }
                  return {
                    id: rule.id,
                    ruleName: rule.ruleName || "",
                    ruleCategory: rule.category?.toLowerCase() || "",
                    ruleExpression: expression,
                    message: rule.message || "",
                    category: rule.category,
                    severity: rule.severity,
                    trigger: rule.trigger,
                    controlType: rule.controlType
                    ,
                    targetField: rule.targetField,
                    targetFields: rule.targetFields
                  }
                })
              
              // Attach rules to control properties
              if (controlRules.length > 0) {
                if (isEcrfDataEntryDebugEnabled()) {
                  console.log(`Mapped ${controlRules.length} rule(s) to control: ${control.id} (${control.label || control.properties?.labelText || 'unnamed'})`)
                }
                return {
                  ...control,
                  properties: {
                    ...control.properties,
                    rules: controlRules
                  }
                }
              }
              
              return control
            })

            // Create a single form with all sections combined
            const rowNumber = rowNumberByDesignKey.get(toDesignKey(resolvedDesignId)) ?? null
            const rowAccess = getRowBasedCrfAccess(
              userRoleCodeOrName,
              rowNumber,
              isMultiCrfAllowedPerVisitType
            )
            return {
              id: `${resolvedDesignId}_combined`,
              crfDesignId: resolvedDesignId,
              rowNumber,
              canView: rowAccess.canView,
              canEdit: rowAccess.canEdit,
              crfDesignName: crfDesign.crfName || crfDesign.name || "Unnamed CRF",
              sectionId: sections[0]?.id || "section_1",
              sectionName: sections[0]?.name || "Form",
              section: {
                id: sections[0]?.id || "section_1",
                name: sections[0]?.name || "Form",
                controls: controlsWithRules // All controls with rules attached
              },
              crfDesign: {
                id: resolvedDesignId,
                name: crfDesign.name,
                rules: runtimeRules, // Include only active, non-deleted rules
                sections: sections, // Include all sections for rule evaluation
                isScreenFailedCrf: normalizeBoolForDesigner(
                  crfDesign.isScreenFailedCrf ?? crfDesign.IsScreenFailedCrf,
                ),
                isRandomizedEnrolledCrf: normalizeBoolForDesigner(
                  crfDesign.isRandomizedEnrolledCrf ?? crfDesign.IsRandomizedEnrolledCrf,
                ),
              },
              visitId: visitId
            }
          }
          return null
        })
      )

      // Filter out null forms
      const validForms = formsWithRules
        .filter((form) => form !== null)
        .filter((form) => form.canView !== false)
      forms.push(...validForms)

      console.log("Available forms:", forms)

      // Expand repeatable rows under one visit card (e.g. Adverse Event -> 1.0, 2.0).
      if (visitMeta?.isRepeatableGroup) {
        const groupRows = Array.isArray(visitMeta?.repeatableRowNumbers) ? visitMeta.repeatableRowNumbers : []
        const kind = visitMeta?.repeatableKind
        const expanded = []
        groupRows.forEach((rn) => {
          validForms.forEach((form) => {
            expanded.push({
              ...form,
              id: `${form.id}__rn_${rn}`,
              sectionName: `${REPEATABLE_ENTRY_VISIT_LABEL[kind] || visitMeta?.name || "Visit"} ${rn}.0`,
              repeatableRowNumber: rn,
              repeatableKind: kind,
            })
          })
        })
        forms.length = 0
        forms.push(...expanded)
      }

      // Attach saved/submitted CRF row metadata from the selected patient's grid data.
      if (studyId && forms.length > 0) {
        visitFormsTemplateCacheRef.current[`${studyId}_${visitId}`] = cloneVisitFormsTemplate(forms)
      }

      const patientForEnrich = selectedPatientRef.current ?? selectedPatient
      if (patientForEnrich && studyId && forms.length > 0) {
        const visit = getVisitById(visitId)
        const enriched = enrichVisitFormsWithCrfMeta(forms, visit, patientForEnrich)
        forms.length = 0
        forms.push(...enriched)
      } else {
        forms.forEach((form) => {
          form.status = "notstarted"
          form.crfDataId = null
        })
      }

      return await finalizeVisitFormsLoad(visitId, forms, silentLoad)
    } catch (error) {
      console.error("Error fetching forms for visit:", error)
      return []
    } finally {
      setLoadingFormsByVisit(prev => ({ ...prev, [visitId]: false }))
    }
    })()

    fetchFormsForVisitInFlightRef.current[visitKey] = loader
    try {
      return await loader
    } finally {
      if (fetchFormsForVisitInFlightRef.current[visitKey] === loader) {
        delete fetchFormsForVisitInFlightRef.current[visitKey]
      }
    }
  }

  // Dummy CRF designs for testing
  const getDummyCrfDesigns = (visitId) => {
    const visitName = getVisitById(visitId)?.name || visitId

    return [
      {
        id: `dummy_crf_${visitId}_1`,
        name: `${visitName} - Demographics Form`,
        crfName: `${visitName} - Demographics Form`,
        htmlContent: JSON.stringify({
          sections: [
            {
              id: "section_demographics",
              name: "Demographics",
              controls: [
                {
                  id: "ctrl_age",
                  type: "number",
                  label: "Age",
                  properties: {
                    labelText: "Age (years)",
                    required: true,
                    placeholder: "Enter age",
                    tooltip: "Patient's age in years"
                  }
                },
                {
                  id: "ctrl_gender",
                  type: "select",
                  label: "Gender",
                  properties: {
                    labelText: "Gender",
                    required: true,
                    options: [
                      { value: "male", label: "Male" },
                      { value: "female", label: "Female" },
                      { value: "other", label: "Other" }
                    ]
                  }
                },
                {
                  id: "ctrl_height",
                  type: "number",
                  label: "Height",
                  properties: {
                    labelText: "Height (cm)",
                    placeholder: "Enter height in cm",
                    tooltip: "Patient's height in centimeters"
                  }
                },
                {
                  id: "ctrl_weight",
                  type: "number",
                  label: "Weight",
                  properties: {
                    labelText: "Weight (kg)",
                    placeholder: "Enter weight in kg",
                    tooltip: "Patient's weight in kilograms"
                  }
                }
              ]
            }
          ]
        })
      },
      {
        id: `dummy_crf_${visitId}_2`,
        name: `${visitName} - Vital Signs Form`,
        crfName: `${visitName} - Vital Signs Form`,
        htmlContent: JSON.stringify({
          sections: [
            {
              id: "section_vital_signs",
              name: "Vital Signs",
              controls: [
                {
                  id: "ctrl_blood_pressure",
                  type: "text",
                  label: "Blood Pressure",
                  properties: {
                    labelText: "Blood Pressure (mmHg)",
                    required: true,
                    placeholder: "120/80",
                    tooltip: "Systolic/Diastolic blood pressure"
                  }
                },
                {
                  id: "ctrl_heart_rate",
                  type: "number",
                  label: "Heart Rate",
                  properties: {
                    labelText: "Heart Rate (bpm)",
                    required: true,
                    placeholder: "72",
                    tooltip: "Heart rate in beats per minute"
                  }
                },
                {
                  id: "ctrl_temperature",
                  type: "number",
                  label: "Temperature",
                  properties: {
                    labelText: "Temperature (°F)",
                    placeholder: "98.6",
                    tooltip: "Body temperature in Fahrenheit"
                  }
                },
                {
                  id: "ctrl_respiratory_rate",
                  type: "number",
                  label: "Respiratory Rate",
                  properties: {
                    labelText: "Respiratory Rate (per minute)",
                    placeholder: "16",
                    tooltip: "Breaths per minute"
                  }
                }
              ]
            }
          ]
        })
      },
      {
        id: `dummy_crf_${visitId}_3`,
        name: `${visitName} - Medical History Form`,
        crfName: `${visitName} - Medical History Form`,
        htmlContent: JSON.stringify({
          sections: [
            {
              id: "section_medical_history",
              name: "Medical History",
              controls: [
                {
                  id: "ctrl_allergies",
                  type: "textarea",
                  label: "Allergies",
                  properties: {
                    labelText: "Known Allergies",
                    placeholder: "List any known allergies",
                    rows: 3,
                    tooltip: "Enter all known allergies"
                  }
                },
                {
                  id: "ctrl_medications",
                  type: "textarea",
                  label: "Current Medications",
                  properties: {
                    labelText: "Current Medications",
                    placeholder: "List current medications",
                    rows: 4,
                    tooltip: "Enter all current medications"
                  }
                },
                {
                  id: "ctrl_medical_conditions",
                  type: "textarea",
                  label: "Medical Conditions",
                  properties: {
                    labelText: "Past Medical History",
                    placeholder: "List any medical conditions",
                    rows: 4,
                    tooltip: "Enter past medical conditions"
                  }
                }
              ]
            }
          ]
        })
      }
    ]
  }

  const handleVisitSelect = async (visitId, e) => {
    const patientForVisit = selectedPatientRef.current ?? selectedPatient
    if (!patientForVisit) {
      console.warn("No patient selected")
      return
    }

    // Prevent event bubbling
    if (e) {
      e.stopPropagation()
    }

    const visitForLock = getVisitById(visitId)
    const visitLockReason = getSequentialVisitLockReason(visitForLock)
    if (visitLockReason) {
      return
    }

    // Prevent repeated network calls while current visit click is already loading.
    if (loadingFormsByVisit?.[visitId]) {
      return
    }
    // Visit-date chain refreshes in background — do not block visit/form open.
    void refreshVisitPrimaryVisitDateChainForPatient(patientForVisit?.id)

    // If dropdown is already open for this visit, close it
    if (showFormDropdown === visitId) {
      setShowFormDropdown(null)
      return
    }

    // Find visit metadata early so cached behavior respects backend multi-CRF intent.
    const visit = getVisitById(visitId)
    const sequenceLockReason = getSequentialVisitLockReason(visit)
    if (sequenceLockReason) {
      setErrorMessage(sequenceLockReason)
      setTimeout(() => setErrorMessage(""), 2600)
      return
    }
    const expectedCrfCount = isMultiCrfAllowedPerVisitType && Array.isArray(visit?.crfDesigns) && visit.crfDesigns.length > 0
      ? visit.crfDesigns.length
      : (visit?.crfDesignId ? 1 : 0)

    // If forms are already loaded for this visit, refresh CRF row metadata then open (avoids stale crfDataId after save/refresh).
    if (availableFormsByVisit?.[visitId] && availableFormsByVisit[visitId].length > 0) {
      const cachedForms = enrichVisitFormsWithCrfMeta(availableFormsByVisit[visitId], visit, patientForVisit)
      setAvailableFormsByVisit((prev) => ({ ...prev, [visitId]: cachedForms }))
      if (visit?.isRepeatableGroup) {
        // For Unscheduled/Adverse repeatable groups, always show row list first (1.0, 2.0, ...).
        setShowFormDropdown(visitId)
      } else if (expectedCrfCount > 1) {
        setShowFormDropdown(visitId)
      } else if (cachedForms.length === 1) {
        if (handleFormSelectRef.current) {
          await handleFormSelectRef.current(cachedForms[0], visitId)
        }
      } else {
        setShowFormDropdown(visitId)
      }
      return
    }

    // Call GetCrfDesignById when visit is clicked.
    // Backend may return multiple CRF designs for the same visit (e.g. 3 Screening CRFs).
    if (visit && studyId) {
      try {
        setLoadingFormsByVisit(prev => ({ ...prev, [visitId]: true }))
        // Expand the visit row immediately for multi-CRF / repeatable so Select Form shows loading inline.
        if (visit?.isRepeatableGroup || expectedCrfCount > 1) {
          setShowFormDropdown(visitId)
        }

        const finalDesignIds = getVisitCrfDesignIds(visit)
        if (finalDesignIds.length === 0) {
          const errorMsg = `Visit ${visit.name} has no CRF design assigned`
          console.warn(errorMsg)
          setErrorMessage(errorMsg)
          setAvailableFormsByVisit(prev => ({ ...prev, [visitId]: [] }))
          setTimeout(() => setErrorMessage(""), 3000)
          return
        }

        const crfDesigns = await fetchCrfDesignPayloadsForVisit(visit)

        if (crfDesigns.length === 0) {
          const errorMsg = `No CRF design payloads found for visit ${visit.name}`
          console.warn(errorMsg)
          setErrorMessage(errorMsg)
          setAvailableFormsByVisit(prev => ({ ...prev, [visitId]: [] }))
          setTimeout(() => setErrorMessage(""), 3000)
          return
        }

        // Now fetch forms for this visit using all CRF designs payloads.
        // If multiple forms exist, the UI will show the dropdown with each CRF name.
        await fetchFormsForVisit(visitId, false, crfDesigns)
      } catch (error) {
        console.error("Error fetching CRF designs for visit:", error)
        const errorMsg = `Error loading CRF designs for visit ${visit?.name ?? ""}`
        setErrorMessage(errorMsg)
        setAvailableFormsByVisit(prev => ({ ...prev, [visitId]: [] }))
        setTimeout(() => setErrorMessage(""), 3000)
      } finally {
        setLoadingFormsByVisit(prev => ({ ...prev, [visitId]: false }))
      }
    } else {
      // No visit found or no studyId
      console.warn("Cannot fetch CRF design: missing visit or studyId")
      await fetchFormsForVisit(visitId)
    }
  }

  // Keep open repeatable groups in sync while rows are being added.
  // This prevents "close and reopen" to see the latest row.
  useEffect(() => {
    const openVisitId = String(showFormDropdown || "")
    if (!openVisitId.startsWith("repeatable-group:")) return
    const visitMeta = getVisitById(openVisitId)
    if (!visitMeta?.isRepeatableGroup) return
    const expectedRows = (Array.isArray(visitMeta.repeatableRowNumbers) ? visitMeta.repeatableRowNumbers : [])
      .map((n) => toPositiveRowNumber(n))
      .filter(Boolean)
    if (expectedRows.length === 0) return

    const formsForOpenVisit = Array.isArray(availableFormsByVisit?.[openVisitId])
      ? availableFormsByVisit[openVisitId]
      : []
    const renderedRows = new Set(
      formsForOpenVisit
        .map((f) => toPositiveRowNumber(f?.repeatableRowNumber))
        .filter(Boolean),
    )
    const hasAllRowsRendered = expectedRows.every((rn) => renderedRows.has(rn))
    if (hasAllRowsRendered) {
      repeatableOpenSyncSignatureRef.current = null
      return
    }

    const syncSignature = `${openVisitId}|expected:${expectedRows.join(",")}|rendered:${[...renderedRows].join(",")}`
    if (repeatableOpenSyncSignatureRef.current === syncSignature) return
    repeatableOpenSyncSignatureRef.current = syncSignature

    void fetchFormsForVisit(openVisitId, true).finally(() => {
      if (repeatableOpenSyncSignatureRef.current === syncSignature) {
        repeatableOpenSyncSignatureRef.current = null
      }
    })
  }, [showFormDropdown, availableFormsByVisit, getVisitById, fetchFormsForVisit])

  const handleFormSelect = async (form, visitId) => {
    if (form?.canView === false) return
    const patientForForm = selectedPatientRef.current ?? selectedPatient
    const consentLock = eConsentCrfGate.getPatientLockReason(patientForForm?.id)
    if (consentLock) {
      toast({
        title: "eCONSENT required",
        description: consentLock,
        variant: "destructive",
        duration: 5000,
      })
      return
    }
    const loadGeneration = ++crfFormLoadGenerationRef.current
    setLoadingSelectedCrfForm(true)
    setOptimisticControlValues({})
    resetRuleTransitionBaselineRefs()

    const visit = getVisitById(visitId)
    const visitData = {
      patient: patientForForm,
      visitId: visitId,
      visitName: visit?.name || visitId,
      visitScheduleId: visit?.visitScheduleId,
      visitType: visit?.visitType ?? null,
      crfFormType: visit?.crfFormType ?? null,
      order: visit?.order ?? visit?.visitNo ?? null,
      visitNo: visit?.visitNo ?? visit?.order ?? null,
      isRepeatableInstance: Boolean(visit?.isRepeatableGroup),
      repeatableKind: form?.repeatableKind ?? visit?.repeatableKind ?? null,
      repeatableRowNumber: toPositiveRowNumber(form?.repeatableRowNumber ?? visit?.repeatableRowNumber),
    }

    // Visit-date chain refreshes in background — never block CRF field hydration.
    void refreshVisitPrimaryVisitDateChainForPatient(patientForForm?.id)

    const resolvedCrfDataId = resolveCrfDataIdForFormContext(form, visitData, patientForForm)
    const crfDataLoadPromise =
      resolvedCrfDataId && studyId ? loadCrfDataRecordById(resolvedCrfDataId) : Promise.resolve(null)
    const formWithCrfMeta = resolvedCrfDataId
      ? { ...form, crfDataId: resolvedCrfDataId }
      : form

    const hasExistingCrfData = Boolean(resolvedCrfDataId)
    const hasRolePermissionForForm = hasExistingCrfData ? canEditExistingCrf : canCreateCrf
    const canEditThisForm = formWithCrfMeta?.canEdit !== false && hasRolePermissionForForm
    setIsFormReadOnlyByPermission(!canEditThisForm)
    setCrfSubmittedByUserId(null)
    setSelectedForm(formWithCrfMeta)
    setShowFormDropdown(null)
    setSelectedVisit(visitData)

    let baselineValues = {}
    let hasPersistedRecord = hasExistingCrfData

    try {
      if (resolvedCrfDataId && studyId) {
        const existingData = await crfDataLoadPromise
        if (loadGeneration !== crfFormLoadGenerationRef.current) return

        if (existingData) {
          setCrfSubmittedByUserId(getCrfRecordSubmitterUserId(existingData))
          setCurrentFormStatus(normalizeCrfStatusCode(existingData.status))
          const loadedIsSdvVerify = Boolean(existingData.isSdvVerify ?? existingData.IsSdvVerify)
          setSelectedForm((prev) =>
            prev && String(prev.id) === String(formWithCrfMeta.id)
              ? { ...prev, isSdvVerify: loadedIsSdvVerify }
              : prev,
          )

          const flattenedFormData = flattenCrfFormData(existingData.formData)
          const withRowCounts = hydrateFormDataWithDesignerDefaults(flattenedFormData, formWithCrfMeta, {
            onlyMissing: true,
          })

          setFormData((prev) => ({
            ...prev,
            [formWithCrfMeta.id]: withRowCounts,
          }))
          resetRuleTransitionBaselineRefs()
          baselineValues = { ...withRowCounts }
          hasPersistedRecord = true

          mergeSdvStateFromSavedFormData(existingData.formData, formWithCrfMeta.id)
          mergeAiEntryFlagsFromSavedFormData(existingData.formData, formWithCrfMeta.id)
          mergePiStateFromSavedFormData(existingData.formData, formWithCrfMeta.id)

          setTimeout(() => {
            if (loadGeneration !== crfFormLoadGenerationRef.current) return
            if (validateAllControls) {
              validateAllControls(formWithCrfMeta, withRowCounts)
            }
          }, 200)
        } else {
          setCrfSubmittedByUserId(null)
          setCurrentFormStatus(1)
          const emptyWithDefaults = hydrateFormDataWithDesignerDefaults({}, formWithCrfMeta, {
            onlyMissing: false,
          })
          setFormData((prev) => ({
            ...prev,
            [formWithCrfMeta.id]: emptyWithDefaults,
          }))
          setValidationErrors((prev) => ({
            ...prev,
            [formWithCrfMeta.id]: {},
          }))
          baselineValues = {}
          hasPersistedRecord = false
        }
      } else {
        setCurrentFormStatus(1)
        const initialWithDefaults = hydrateFormDataWithDesignerDefaults({}, formWithCrfMeta, {
          onlyMissing: false,
        })
        setFormData((prev) => ({
          ...prev,
          [formWithCrfMeta.id]: initialWithDefaults,
        }))
        setValidationErrors((prev) => ({
          ...prev,
          [formWithCrfMeta.id]: {},
        }))
        baselineValues = { ...initialWithDefaults }
        hasPersistedRecord = false
      }

      if (loadGeneration !== crfFormLoadGenerationRef.current) return

      setCrfRuleMessages([])
      setFormAuditBaselineById((prev) => ({
        ...prev,
        [formWithCrfMeta.id]: {
          values: baselineValues,
          hasPersistedRecord,
        },
      }))
    } catch (error) {
      if (loadGeneration !== crfFormLoadGenerationRef.current) return
      console.error("Error loading CRF form:", error)
      setCrfSubmittedByUserId(null)
      setCurrentFormStatus(1)
      const fallbackValues = hydrateFormDataWithDesignerDefaults({}, formWithCrfMeta, {
        onlyMissing: false,
      })
      setFormData((prev) => ({
        ...prev,
        [formWithCrfMeta.id]: fallbackValues,
      }))
      setValidationErrors((prev) => ({
        ...prev,
        [formWithCrfMeta.id]: {},
      }))
      setFormAuditBaselineById((prev) => ({
        ...prev,
        [formWithCrfMeta.id]: {
          values: {},
          hasPersistedRecord: false,
        },
      }))
    } finally {
      if (loadGeneration === crfFormLoadGenerationRef.current) {
        setLoadingSelectedCrfForm(false)
      }
    }
  }
  handleFormSelectRef.current = handleFormSelect

  const studySiteHeaderLabel = useMemo(() => {
    if (typeof window === "undefined") return ""
    const proto = localStorage.getItem("selectedStudy")
    const site = localStorage.getItem("selectedSite")
    if (proto && site) return `${proto} (${site})`
    if (proto) return proto
    if (studyId) return `Study ${studyId}`
    return ""
  }, [studyId, siteId])

  const loadVisitAttachmentsMenu = useCallback(async () => {
    if (!studyId || !selectedPatient?.id || !selectedVisit?.visitScheduleId) {
      setVisitAttachmentList([])
      return
    }
    setLoadingVisitAttachments(true)
    try {
      const res = await visitAttachmentsService.list(studyId, selectedPatient.id, selectedVisit.visitScheduleId)
      setVisitAttachmentList(res.isSuccess && Array.isArray(res.data) ? res.data : [])
    } catch {
      setVisitAttachmentList([])
    } finally {
      setLoadingVisitAttachments(false)
    }
  }, [studyId, selectedPatient?.id, selectedVisit?.visitScheduleId])

  // Keep attachment data ready without tying async state updates to dropdown open/close lifecycle.
  useEffect(() => {
    if (!selectedForm || !selectedVisit || !selectedPatient || !studyId) {
      setVisitAttachmentList([])
      setLoadingVisitAttachments(false)
      return
    }
    void loadVisitAttachmentsMenu()
  }, [
    studyId,
    selectedPatient?.id,
    selectedVisit?.visitScheduleId,
    selectedForm?.crfDataId,
    loadVisitAttachmentsMenu,
  ])

  const handleDeleteVisitAttachment = useCallback((attachmentId, attachmentLabel = "") => {
    const aid = Number(attachmentId)
    if (!Number.isFinite(aid) || aid <= 0) {
      toast({
        title: "Delete failed",
        description: "Invalid attachment id.",
        variant: "destructive",
        duration: 2500,
      })
      return
    }
    setPendingDeleteAttachment({
      open: true,
      id: aid,
      label: attachmentLabel || `Attachment ${aid}`,
    })
  }, [])

  const confirmDeleteVisitAttachment = useCallback(async () => {
    const aid = Number(pendingDeleteAttachment?.id)
    const attachmentLabel = pendingDeleteAttachment?.label || ""
    if (!Number.isFinite(aid) || aid <= 0) {
      setPendingDeleteAttachment({ open: false, id: null, label: "" })
      return
    }

    setDeletingVisitAttachmentId(aid)
    try {
      const res = await visitAttachmentsService.deleteAttachment(aid)
      if (res?.isSuccess) {
        toast({
          title: "Attachment deleted",
          description: attachmentLabel ? `${attachmentLabel} removed.` : "Attachment removed.",
          duration: 2200,
        })
        await loadVisitAttachmentsMenu()
      } else {
        toast({
          title: "Delete failed",
          description: res?.message || "Could not delete attachment.",
          variant: "destructive",
          duration: 3200,
        })
      }
    } catch (e) {
      toast({
        title: "Delete failed",
        description: e?.message || "Could not delete attachment.",
        variant: "destructive",
        duration: 3200,
      })
    } finally {
      setDeletingVisitAttachmentId(null)
      setPendingDeleteAttachment({ open: false, id: null, label: "" })
    }
  }, [loadVisitAttachmentsMenu, pendingDeleteAttachment?.id, pendingDeleteAttachment?.label])

  const handleDownloadVisitAttachmentsZip = useCallback(async () => {
    if (loadingVisitAttachments || visitAttachmentList.length === 0 || visitZipBusyRef.current) return
    visitZipBusyRef.current = true
    setVisitAttachmentsZipLoading(true)
    try {
      const result = await zipVisitAttachmentsUnderSize(visitAttachmentList)
      if (!result.ok) {
        toast({
          title: "ZIP not created",
          description: result.message,
          variant: "destructive",
          duration: 3500,
        })
        return
      }
      triggerZipDownload(result.blob, result.fileName)
      const nSkip = result.skipped?.length ?? 0
      const skipPart =
        nSkip > 0 ? ` ${nSkip} skipped (over 10 MB each or failed).` : ""
      toast({
        title: "ZIP downloaded",
        description: `${result.included.length} file(s) packed.${skipPart}`,
        duration: 3000,
      })
    } catch (e) {
      toast({
        title: "ZIP failed",
        description: e?.message || "Could not build ZIP.",
        variant: "destructive",
        duration: 3000,
      })
    } finally {
      visitZipBusyRef.current = false
      setVisitAttachmentsZipLoading(false)
    }
  }, [visitAttachmentList, loadingVisitAttachments])

  const handleExportCurrentFormPdf = useCallback(async (pdfMode = "filled") => {
    if (!selectedForm || !selectedVisit) return
    const mode = pdfMode === "blank" ? "blank" : "filled"
    const includeAuditTrail = pdfMode === "filled-with-audit"
    try {
      const crfDesign = selectedForm.crfDesign || {
        sections: selectedForm.section ? [selectedForm.section] : [],
      }
      const rawVals = formData[selectedForm.id] || {}
      const sections = buildPdfSectionsForExport(crfDesign, rawVals, mode)
      const crfName =
        selectedForm.crfDesignName || selectedForm.sectionName || selectedForm.name || "CRF"
      let studyNo =
        (typeof window !== "undefined" && localStorage.getItem("selectedStudy")) ||
        (studyId ? `Study-${studyId}` : "")
      const siteNo =
        (typeof window !== "undefined" && localStorage.getItem("selectedSite")) ||
        (siteId ? `Site-${siteId}` : "")
      let studyTitle =
        (typeof window !== "undefined" && localStorage.getItem("selectedStudyTitle")) ||
        (typeof window !== "undefined" && localStorage.getItem("selectedStudy")) ||
        (studyId ? `Study-${studyId}` : "")

      // If localStorage does not have study metadata (common for admin/super-admin sessions),
      // fetch by studyId so PDF always shows real protocol + title.
      const looksLikeFallbackStudy = (v) => /^study-\d+$/i.test(String(v || "").trim())
      if (studyId && (!studyNo || !studyTitle || looksLikeFallbackStudy(studyNo) || looksLikeFallbackStudy(studyTitle))) {
        try {
          const studyResp = await studyService.getStudyById(studyId)
          const studyData = studyResp?.data || {}
          const apiProtocol = studyData?.studyProtocolNumber || studyData?.protocolNumber || studyData?.name || ""
          const apiTitle = studyData?.studyTitle || ""

          if (!studyNo || looksLikeFallbackStudy(studyNo)) {
            studyNo = apiProtocol || `Study-${studyId}`
          }
          if (!studyTitle || looksLikeFallbackStudy(studyTitle)) {
            studyTitle = apiTitle || apiProtocol || `Study-${studyId}`
          }
        } catch (e) {
          // Keep existing fallback values on API failure.
        }
      }

      const crfMeta = {
        ...getDefaultCrfOrgMeta(),
        studyNo,
        studyTitle,
        siteNo,
        investigatorCode: "",
        investigatorName: "",
      }
      const patient = {
        patientId: selectedVisit.patient?.patientId ?? "",
        initial: selectedVisit.patient?.initial ?? "",
        name: selectedVisit.patient?.name ?? "",
      }
      const visit = {
        visitDate: "",
        visitName: selectedVisit.visitName ?? "",
      }
      let auditTrailRows = null
      if (includeAuditTrail) {
        if (!studyId) {
          toast({
            title: "Audit trail export unavailable",
            description: "Study context is required to load audit trail.",
            variant: "destructive",
            duration: 3000,
          })
          return
        }
        const crfDataIdNum = Number.parseInt(String(selectedForm?.crfDataId ?? ""), 10)
        const auditFilters = {
          studyId: String(studyId),
          module: "ECRF",
        }
        if (siteId) auditFilters.siteId = String(siteId)
        if (selectedPatient?.id) auditFilters.patientId = String(selectedPatient.id)
        if (selectedVisit?.visitScheduleId) auditFilters.visitId = String(selectedVisit.visitScheduleId)
        if (selectedForm?.crfDesignId) auditFilters.crfId = String(selectedForm.crfDesignId)
        if (Number.isFinite(crfDataIdNum) && crfDataIdNum > 0) {
          auditFilters.crfDataId = String(crfDataIdNum)
        }
        auditTrailRows = await fetchCrfAuditTrailRows(auditFilters)
      }

      let piSignoffRecord = undefined
      if (mode === "filled" && isPiSignoffRequired) {
        const crfDataIdNum = Number.parseInt(String(selectedForm?.crfDataId ?? ""), 10)
        if (Number.isFinite(crfDataIdNum) && crfDataIdNum > 0) {
          try {
            const piRes = await piSignoffService.getByCrfDataId(crfDataIdNum)
            piSignoffRecord = piRes?.data ?? null
          } catch {
            piSignoffRecord = null
          }
        } else {
          piSignoffRecord = null
        }
      }

      const u = authService.getUser?.() || {}
      const printedInfo = buildPrintedInfoFromUser(u)

      const safeCrf = (crfName || "CRF").replace(/[^a-zA-Z0-9-_]/g, "_")
      const filename = `CRF_${safeCrf}_${
        mode === "blank" ? "blank" : includeAuditTrail ? "with-data-audit" : "with-data"
      }.pdf`
      await generateCrfEntryPdf({
        crfMeta,
        patient,
        visit,
        sections,
        printedInfo,
        showDates: true,
        pdfMode: mode,
        layoutOptions: {
          ...CRF_PDF_DEFAULT_LAYOUT_OPTIONS,
          showSubjectIdentity: mode === "filled",
        },
        filename,
        crfName,
        auditTrailRows: includeAuditTrail ? auditTrailRows : null,
        piSignoffRecord,
      })
      const auditCount = Array.isArray(auditTrailRows) ? auditTrailRows.length : 0
      toast({
        title: "PDF downloaded",
        description:
          mode === "blank"
            ? "Blank CRF template exported."
            : includeAuditTrail
              ? `CRF with data and audit trail exported (${auditCount} audit ${auditCount === 1 ? "entry" : "entries"}).`
              : "CRF exported with current data.",
        duration: 2500,
      })
    } catch (e) {
      console.error(e)
      toast({
        title: "PDF export failed",
        description: e?.message || "Could not generate PDF.",
        variant: "destructive",
        duration: 2000,
      })
    }
  }, [selectedForm, selectedVisit, selectedPatient, formData, studyId, siteId])

  const handleVisitAttachmentUploadPick = useCallback(() => {
    visitAttachmentUploadMaxBytesRef.current = null
    visitAttachmentUploadMinBytesRef.current = null
    visitAttachmentFileInputRef.current?.click()
  }, [])

  const handleVisitAttachmentUploadPickUnder10Mb = useCallback(() => {
    visitAttachmentUploadMaxBytesRef.current = 10 * 1024 * 1024
    visitAttachmentUploadMinBytesRef.current = null
    visitAttachmentFileInputRef.current?.click()
  }, [])

  const handleVisitAttachmentUploadPickLarge = useCallback(() => {
    // Large: must be strictly greater than 10MB
    visitAttachmentUploadMaxBytesRef.current = null
    visitAttachmentUploadMinBytesRef.current = 10 * 1024 * 1024 + 1
    visitAttachmentFileInputRef.current?.click()
  }, [])

  const handleVisitAttachmentFileChange = useCallback(
    async (e) => {
      const file = e.target.files?.[0]
      e.target.value = ""
      if (!file || !studyId || !selectedPatient?.id || !selectedVisit?.visitScheduleId) {
        toast({
          title: "Cannot upload",
          description: "Missing study, patient, or visit.",
          variant: "destructive",
          duration: 2000,
        })
        return
      }
      const maxBytes = visitAttachmentUploadMaxBytesRef.current
      visitAttachmentUploadMaxBytesRef.current = null
      const minBytes = visitAttachmentUploadMinBytesRef.current
      visitAttachmentUploadMinBytesRef.current = null

      const v = visitAttachmentsService.validateFile(file, maxBytes)
      if (!v.ok) {
        toast({ title: "Invalid file", description: v.message, variant: "destructive", duration: 2000 })
        return
      }

      if (minBytes != null && Number.isFinite(minBytes) && file.size < minBytes) {
        toast({
          title: "File too small",
          description: "Choose “Upload <=10MB only” for files of 10 MB or less.",
          variant: "destructive",
          duration: 2000,
        })
        return
      }
      // Run upload in background (context popup + progress).
      // We intentionally do NOT await it, so user can keep working in parallel.
      void addJob({
        file,
        studyId,
        patientEnrolmentId: selectedPatient.id,
        visitScheduleId: selectedVisit.visitScheduleId,
        crfDataId: selectedForm?.crfDataId || null,
        onListRefresh: loadVisitAttachmentsMenu,
      }).then((res) => {
        if (!res?.isSuccess) {
          toast({
            title: "Upload failed",
            description: res?.message || "Could not upload file.",
            variant: "destructive",
            duration: 2000,
          })
        }
      })
    },
    [studyId, selectedPatient?.id, selectedVisit?.visitScheduleId, selectedForm?.crfDataId, loadVisitAttachmentsMenu, addJob]
  )

  // Get current form sections for rule evaluation (memoized to prevent infinite loops)
  // CRITICAL: Use section.controls - it has rules attached (controlsWithRules). crfDesign.sections has raw controls WITHOUT rules.
  // Rules are mapped in form building (lines 531-572) to section.controls, so use that for rule evaluation.
  const currentFormSections = useMemo(() => {
    if (!selectedForm) return []
    if (selectedForm.section?.controls && selectedForm.section.controls.length > 0) {
      return [{
        id: selectedForm.sectionId || selectedForm.section.id,
        name: selectedForm.sectionName || selectedForm.section.name,
        controls: selectedForm.section.controls // Has rules attached
      }]
    }
    if (selectedForm.crfDesign?.sections && Array.isArray(selectedForm.crfDesign.sections) && selectedForm.crfDesign.sections.length > 0) {
      return selectedForm.crfDesign.sections
    }
    return []
  }, [selectedForm?.id, selectedForm?.section, selectedForm?.crfDesign?.sections])

  const lockSectionTree = useMemo(
    () =>
      currentFormSections
        .map((section) => ({
          sectionKey: String(section.id ?? "").trim(),
          sectionName: String(section.name ?? section.id ?? "Section"),
          fields: (section.controls ?? [])
            .filter((control) => control?.id && String(control.id).startsWith("ctrl_"))
            .map((control) => ({
              fieldKey: String(control.id),
              label: String(control.label ?? control.id),
              type: String(control.type ?? ""),
            })),
        }))
        .filter((section) => section.sectionKey),
    [currentFormSections],
  )

  const granularDbLock = useGranularDbLock(studyId, siteId, selectedForm?.crfDataId, {
    sectionTree: lockSectionTree,
  })

  const isControlDbLocked = useCallback(
    (controlId, sectionId) => {
      if (isDbLockReadOnly) return true
      if (!granularDbLock.hasGranularLocks && !granularDbLock.wholeFormLocked) return false
      if (granularDbLock.wholeFormLocked) return true
      const sectionKey = String(sectionId ?? activeDataEntrySectionId ?? selectedForm?.sectionId ?? "")
      if (granularDbLock.lockedSectionKeys.has(sectionKey)) return true
      return granularDbLock.lockedFieldKeys.has(String(controlId ?? "").trim())
    },
    [
      isDbLockReadOnly,
      granularDbLock,
      activeDataEntrySectionId,
      selectedForm?.sectionId,
    ],
  )

  const currentFormSectionsRef = useRef(currentFormSections)

  /** Stable primitive for effects — avoids re-running when `section` wrapper object identity flips each render. */
  const formSectionLayoutKey = useMemo(() => {
    if (!selectedForm) return ""
    if (selectedForm.crfDesign?.sections?.length > 0) {
      return selectedForm.crfDesign.sections
        .map(
          (s) =>
            `${s.id ?? ""}:${(s.controls || [])
              .map((c) => c.id)
              .join(",")}`
        )
        .join("|")
    }
    const sec = selectedForm.section
    return `s:${selectedForm.sectionId || sec?.id || ""}:${(sec?.controls || [])
      .map((c) => c.id)
      .join(",")}`
  }, [
    selectedForm?.id,
    selectedForm?.sectionId,
    selectedForm?.section?.id,
    selectedForm?.section?.controls,
    selectedForm?.crfDesign?.sections,
  ])

  // When form modal opens or form layout changes, set active section tab to first section
  useEffect(() => {
    if (!selectedForm) {
      setActiveDataEntrySectionId(null)
      return
    }
    const sections = selectedForm.crfDesign?.sections && selectedForm.crfDesign.sections.length > 0
      ? selectedForm.crfDesign.sections.filter(s => s.controls?.length > 0)
      : (selectedForm.section?.controls?.length ? [selectedForm.section] : [])

    const pendingFieldId = pendingQueryFieldNavigationRef.current?.fieldId
    if (pendingFieldId) {
      const targetSection = sections.find((section) =>
        (section?.controls || []).some((control) => queryFieldMatchesControl(pendingFieldId, control?.id)),
      )
      if (targetSection?.id) {
        setActiveDataEntrySectionId(targetSection.id)
        return
      }
    }

    setActiveDataEntrySectionId(sections[0]?.id ?? null)
  }, [selectedForm?.id, formSectionLayoutKey])

  useEffect(() => {
    return () => {
      if (auditSyncedClearTimeoutRef.current) {
        clearTimeout(auditSyncedClearTimeoutRef.current)
      }
      if (auditSyncedFadeTimeoutRef.current) {
        clearTimeout(auditSyncedFadeTimeoutRef.current)
      }
      if (queryFieldNavigationClearTimeoutRef.current) {
        clearTimeout(queryFieldNavigationClearTimeoutRef.current)
      }
    }
  }, [])

  const handleSectionTabChange = useCallback((sectionId, navOptions = {}) => {
    if (!sectionId || String(sectionId) === String(activeDataEntrySectionId)) return
    const skipAuditPrompt = Boolean(navOptions.skipAuditPrompt)
    const touched = lastAuditTouchedFieldRef.current
    const triggerControlId =
      touched?.formId === selectedForm?.id ? String(touched?.controlId || "") : ""
    if (
      !skipAuditPrompt &&
      selectedForm?.id &&
      promptAuditReasonCaptureIfNeeded(selectedForm.id, {
        pendingSectionId: sectionId,
        triggerControlId,
        preferTriggerField: true,
      })
    ) {
      return
    }
    setActiveDataEntrySectionId(sectionId)
  }, [activeDataEntrySectionId, selectedForm?.id, promptAuditReasonCaptureIfNeeded])

  // Keep the active section tab visible inside the horizontal overflow strip (many CRF sections).
  useLayoutEffect(() => {
    if (loadingSelectedCrfForm) return
    const sections = sectionsWithContentForDataEntry
    if (!Array.isArray(sections) || sections.length <= 1) return
    const effectiveId =
      activeDataEntrySectionId && sections.some((s) => String(s?.id) === String(activeDataEntrySectionId))
        ? String(activeDataEntrySectionId)
        : String(sections[0]?.id ?? "")
    if (!effectiveId) return
    const tabEl = sectionTabButtonRefs.current.get(effectiveId)
    if (!tabEl || typeof tabEl.scrollIntoView !== "function") return
    tabEl.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    })
  }, [
    activeDataEntrySectionId,
    sectionsWithContentForDataEntry,
    loadingSelectedCrfForm,
  ])

  // Tabs or footer next/prev change the active section but keep scroll position on the flex
  // scroll container — user stays “mid page” (img 3). Jump to top of the CRF body for each section.
  useLayoutEffect(() => {
    if (!activeDataEntrySectionId) return
    const el = dataEntryCrfScrollContainerRef.current
    if (!el) return
    if (pendingQueryFieldNavigationRef.current) return
    el.scrollTop = 0
    if (typeof el.scrollLeft === "number") el.scrollLeft = 0
  }, [activeDataEntrySectionId])

  const focusPendingQueryField = useCallback(() => {
    const pending = pendingQueryFieldNavigationRef.current
    if (!pending?.fieldId || !selectedForm || loadingSelectedCrfForm) return

    const fieldId = String(pending.fieldId)
    const flatKey = resolveQueryFieldIdToFormFlatKey(fieldId)
    const controlId = resolveControlIdFromQueryFieldId(fieldId)
    const sections = getDisplaySectionsFromSelectedForm(selectedForm)
    const targetSection = sections.find((section) =>
      (section?.controls || []).some((control) => queryFieldMatchesControl(fieldId, control?.id)),
    )
    const targetSectionId = targetSection?.id ?? null

    if (targetSectionId && String(targetSectionId) !== String(activeDataEntrySectionId)) {
      setActiveDataEntrySectionId(targetSectionId)
      return
    }

    const scrollTargetId = flatKey.includes("_row_")
      ? toEcrfFieldDomId(controlId)
      : toEcrfFieldDomId(flatKey || controlId)
    const fieldEl = scrollTargetId ? document.getElementById(scrollTargetId) : null
    if (!fieldEl) return

    const scrollContainer = dataEntryCrfScrollContainerRef.current
    if (scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect()
      const fieldRect = fieldEl.getBoundingClientRect()
      const nextTop =
        scrollContainer.scrollTop +
        (fieldRect.top - containerRect.top) -
        Math.max(0, (containerRect.height - fieldRect.height) / 2)
      scrollContainer.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" })
    } else {
      fieldEl.scrollIntoView({ behavior: "smooth", block: "center" })
    }

    setNavigatedQueryFieldKey(flatKey || controlId)
    if (queryFieldNavigationClearTimeoutRef.current) {
      clearTimeout(queryFieldNavigationClearTimeoutRef.current)
    }
    queryFieldNavigationClearTimeoutRef.current = setTimeout(() => {
      setNavigatedQueryFieldKey(null)
      queryFieldNavigationClearTimeoutRef.current = null
    }, 3200)
    pendingQueryFieldNavigationRef.current = null
  }, [selectedForm, loadingSelectedCrfForm, activeDataEntrySectionId])

  useLayoutEffect(() => {
    focusPendingQueryField()
  }, [focusPendingQueryField, activeDataEntrySectionId, loadingSelectedCrfForm, selectedForm?.id])

  useEffect(() => {
    setDataEntryControlRenderLimit(140)
  }, [selectedForm?.id, activeDataEntrySectionId])

  // Get current form data for rule evaluation (memoized to prevent infinite loops)
  const currentFormData = useMemo(() => {
    if (!selectedForm) return EMPTY_FORM_DATA_SLICE
    const slice = formData[selectedForm.id]
    return slice != null ? slice : EMPTY_FORM_DATA_SLICE
  }, [selectedForm?.id, formData])
  const autoValueMapConfigs = useMemo(() => {
    const controls = currentFormSections.flatMap((s) => (Array.isArray(s?.controls) ? s.controls : []))
    return controls
      .filter((control) => {
        const type = String(control?.type || "").toLowerCase()
        if (type !== "text") return false
        return Boolean(control?.properties?.autoValueMapSourceFieldId)
      })
      .map((control) => ({
        targetId: String(control?.id || "").trim(),
        sourceId: String(control?.properties?.autoValueMapSourceFieldId || "").trim(),
        ...(() => {
          const rulesMap = parseAutoValueMapRules(control?.properties?.autoValueMapRules || "")
          return {
            rulesMap,
            defaultValue: String(rulesMap?.default ?? rulesMap?.DEFAULT ?? ""),
          }
        })(),
      }))
      .filter((cfg) => cfg.targetId && cfg.sourceId)
  }, [currentFormSections])

  // Stable key from source fields only — avoids re-mapping on unrelated edits (would wipe manual Grade edits)
  const autoMapDrivingSignature =
    selectedForm?.id && autoValueMapConfigs.length > 0
      ? [...autoValueMapConfigs]
          .sort((a, b) => String(a.targetId).localeCompare(String(b.targetId)))
          .map((cfg) => {
            const raw = currentFormData?.[cfg.sourceId]
            return `${cfg.sourceId}\x1e${String(raw ?? "").trim()}`
          })
          .join("\x1f")
      : ""

  const deferredRuleFormData = useDeferredValue(currentFormData)
  // Rules must read the same values the UI shows. A deferred snapshot + extra timeout made
  // control/CRF rules and compute feel ~1–2s behind after each change (especially selects).
  const [crfRuleControlOverrides, setCrfRuleControlOverrides] = useState({})
  const [ruleRuntimePilotOverrides, setRuleRuntimePilotOverrides] = useState({})
  const [ruleRuntimePrimaryActive, setRuleRuntimePrimaryActive] = useState(false)
  const crfOverridesValidationSig = useMemo(
    () => stableStringifyRuleOverrides(crfRuleControlOverrides),
    [crfRuleControlOverrides]
  )
  const { 
    evaluatedControls, 
    updateFormValue: updateRuleFormValue,
    getEvaluatedControl
  } = useRuleEvaluation(currentFormSections, deferredRuleFormData, {
    dirtyKeysRef: dataEntryRuleDirtyKeysRef,
  })

  // Dropdown → Read Only target: map source option value into target (designer auto-value map).
  useEffect(() => {
    if (!selectedForm?.id) return
    if (!Array.isArray(autoValueMapConfigs) || autoValueMapConfigs.length === 0) return
    setFormData((prev) => {
      const currentForForm = prev[selectedForm.id] || {}
      let changed = false
      const nextForForm = { ...currentForForm }
      const ruleSyncUpdates = []
      autoValueMapConfigs.forEach((cfg) => {
        const sourceRaw = currentForForm?.[cfg.sourceId]
        const sourceKey = String(sourceRaw ?? "").trim()
        const mappedValue =
          sourceKey && Object.prototype.hasOwnProperty.call(cfg.rulesMap, sourceKey)
            ? cfg.rulesMap[sourceKey]
            : cfg.defaultValue
        if (nextForForm[cfg.targetId] !== mappedValue) {
          nextForForm[cfg.targetId] = mappedValue
          changed = true
          ruleSyncUpdates.push({ targetId: cfg.targetId, mappedValue })
        }
      })
      if (!changed) return prev
      if (ruleSyncUpdates.length > 0) {
        queueMicrotask(() => {
          ruleSyncUpdates.forEach(({ targetId, mappedValue }) => {
            updateRuleFormValue(targetId, mappedValue)
          })
        })
      }
      return { ...prev, [selectedForm.id]: nextForForm }
    })
  }, [autoValueMapConfigs, selectedForm?.id, autoMapDrivingSignature, updateRuleFormValue])

  // Fallback safety: infer real-time date bounds from CRF submit/validation-like expressions
  // (e.g. EndDate >= StartDate) so picker restriction still works even if column mapping was missed.
  const inferredDateBoundsByControl = useMemo(() => {
    const rules = Array.isArray(selectedForm?.crfDesign?.rules) ? selectedForm.crfDesign.rules : []
    const controls = currentFormSections.flatMap((s) =>
      Array.isArray(s?.controls) ? s.controls : [],
    )
    if (rules.length === 0 || controls.length === 0) return {}
    const labelToIdMap = createLabelToIdMap(controls)
    const controlById = new Map(controls.map((c) => [c.id, c]))
    const isDateFieldId = (fieldId) => {
      const direct = controlById.get(fieldId)
      if (direct) return String(direct.type || "").toLowerCase().includes("date")
      const m = String(fieldId || "").match(/^(.*)_row_(\d+)_col_(\d+)$/)
      if (!m) return false
      const table = controlById.get(m[1])
      if (!table || String(table.type || "").toLowerCase() !== "table") return false
      const colIdx = parseInt(m[3], 10)
      if (Number.isNaN(colIdx)) return false
      const colTypes = Array.isArray(table.properties?.columnTypes) ? table.properties.columnTypes : []
      return String(colTypes[colIdx] || "").toLowerCase().includes("date")
    }
    const out = {}
    rules.forEach((rule) => {
      const normalizedCategory = normalizeRuleCategory(
        rule?.category ?? rule?.ruleCategory ?? rule?.Category
      )
      if (!(normalizedCategory === "date_restriction" || isDateRestrictionRule(rule))) return
      const expressionRaw = String(rule?.expression || rule?.ruleExpression || "")
      const expression = replaceLabelsWithIds(decodeHtmlEntities(expressionRaw), labelToIdMap)
      if (!expression) return
      const comparisons = [...expression.matchAll(/\b(ctrl_[A-Za-z0-9_]+)\b\s*(>=|>|<=|<)\s*\b(ctrl_[A-Za-z0-9_]+)\b/g)]
      if (shouldDeepTraceRule(rule?.id)) {
        deepTraceLog("inferred_bounds_scan", {
          ruleId: rule?.id,
          category: rule?.category || rule?.ruleCategory,
          expressionRaw,
          expressionNormalized: expression,
          comparisons: comparisons.map((m) => ({
            left: m?.[1],
            op: m?.[2],
            right: m?.[3],
          })),
        }, `bounds_scan|${String(rule?.id ?? "")}|${expression}`)
      }
      if (comparisons.length === 0) return
      comparisons.forEach((match) => {
        const leftId = String(match[1] || "")
        const op = String(match[2] || "")
        const rightId = String(match[3] || "")
        if (!isDateFieldId(leftId) || !isDateFieldId(rightId)) return
        const targetId = leftId
        const sourceId = rightId
        const targetTableCell = targetId.match(/^(.*)_row_(\d+)_col_(\d+)$/)
        if (targetTableCell) {
          const tableId = targetTableCell[1]
          const rowIdx = parseInt(targetTableCell[2], 10)
          const colIdx = parseInt(targetTableCell[3], 10)
          if (Number.isNaN(rowIdx) || Number.isNaN(colIdx)) return
          const cellKey = `${rowIdx}_${colIdx}`
          const existing = out[tableId] || {}
          const nextMin = { ...(existing.tableCellDateMinFromField || {}) }
          const nextMax = { ...(existing.tableCellDateMaxFromField || {}) }
          if ((op === ">=" || op === ">") && !nextMin[cellKey]) nextMin[cellKey] = sourceId
          if ((op === "<=" || op === "<") && !nextMax[cellKey]) nextMax[cellKey] = sourceId
          out[tableId] = {
            ...existing,
            tableCellDateMinFromField: nextMin,
            tableCellDateMaxFromField: nextMax,
          }
          return
        }
        const existing = out[targetId] || {}
        if ((op === ">=" || op === ">") && !existing.minDateFromFieldId) {
          existing.minDateFromFieldId = sourceId
        }
        if ((op === "<=" || op === "<") && !existing.maxDateFromFieldId) {
          existing.maxDateFromFieldId = sourceId
        }
        out[targetId] = existing
      })
    })
    const tracedRuleIds = new Set(
      rules
        .map((r) => String(r?.id ?? ""))
        .filter((rid) => shouldDeepTraceRule(rid))
    )
    if (tracedRuleIds.size > 0) {
      deepTraceLog("inferred_bounds_result", {
        tracedRuleIds: [...tracedRuleIds],
        inferredDateBoundsByControl: out,
      }, `bounds_result|${[...tracedRuleIds].join(",")}`)
    }
    return out
  }, [selectedForm?.id, selectedForm?.crfDesign?.rules, currentFormSections])

  const getRuleAwareControl = useCallback(
    (control) => {
      if (!control) return control
      const baseEvaluated = getEvaluatedControl(control.id) || control
      const crfOverride = crfRuleControlOverrides[control.id]
      const inferredDateBounds = inferredDateBoundsByControl[control.id]
      const pilotOverride = ruleRuntimePilotOverrides[control.id]
      if (!crfOverride && !inferredDateBounds && !pilotOverride) return baseEvaluated
      const staticDesignerReadonly = isDesignerReadonly(control?.properties)
      const legacyProps = {
        ...(baseEvaluated.properties || {}),
        ...(crfOverride?.properties || {}),
        ...(inferredDateBounds || {}),
      }
      const runtimeProps = {
        ...(baseEvaluated.properties || {}),
        ...(pilotOverride?.properties || {}),
        ...(inferredDateBounds || {}),
      }
      const mergedProps = {
        ...(ruleRuntimePrimaryActive ? runtimeProps : legacyProps),
      }
      if (staticDesignerReadonly) {
        mergedProps.readonly = true
      }
      return {
        ...baseEvaluated,
        ...pilotOverride,
        properties: mergedProps,
      }
    },
    [
      getEvaluatedControl,
      crfRuleControlOverrides,
      inferredDateBoundsByControl,
      ruleRuntimePilotOverrides,
      ruleRuntimePrimaryActive,
    ]
  )

  const crfSdvProgress = useMemo(() => {
    if (!canShowSdvPerField || !selectedForm?.id) {
      return { total: 0, done: 0, allDone: false, anySelected: false, allSelected: false }
    }
    const formId = selectedForm.id
    const eligible = getSdvEligibleControlIdsAcrossForm()
    const total = eligible.length
    const done = eligible.filter((controlIdStr) =>
      Boolean(sdvApprovedByField[getSdvFieldKey(formId, controlIdStr)]),
    ).length
    const selectedCount = eligible.filter((controlIdStr) =>
      Boolean(sdvSelectionsByField[getSdvFieldKey(formId, controlIdStr)]),
    ).length
    const allDone =
      Boolean(selectedForm?.isSdvVerify ?? selectedForm?.IsSdvVerify) ||
      (total > 0 && done === total)
    return {
      total,
      done,
      allDone,
      anySelected: selectedCount > 0,
      allSelected: total > 0 && selectedCount === total,
      eligible,
    }
  }, [
    canShowSdvPerField,
    selectedForm?.id,
    selectedForm?.isSdvVerify,
    selectedForm?.IsSdvVerify,
    getSdvEligibleControlIdsAcrossForm,
    sdvApprovedByField,
    sdvSelectionsByField,
    getSdvFieldKey,
    getRuleAwareControl,
  ])

  const getRuleAwareControlRef = useRef(getRuleAwareControl)

  /**
   * Pre-computed evaluated-control map for the current form's controls.
   *
   * Without this memo, every render of the CRF body called `getRuleAwareControl(control)`
   * once per control (object-spread merge of base + override + inferred-date-bounds +
   * pilot/legacy props). On a 100-control CRF that was ~500 allocations per render
   * on every keystroke — even when no rule had actually changed.
   *
   * The memo rebuilds ONLY when `currentFormSections` change (form switch / section
   * layout change) or when `getRuleAwareControl` identity changes (which it does
   * only when rule overrides or runtime mode flips — not on every keystroke).
   *
   * Render-time consumers do `evaluatedControlsByIdForCurrentForm[control.id]` →
   * O(1) lookup. Falls back to `getRuleAwareControl(control)` if a control is
   * unexpectedly missing (defensive — shouldn't happen).
   */
  const evaluatedControlsByIdForCurrentForm = useMemo(() => {
    const map = {}
    if (!Array.isArray(currentFormSections) || currentFormSections.length === 0) return map
    for (let s = 0; s < currentFormSections.length; s += 1) {
      const section = currentFormSections[s]
      const controls = Array.isArray(section?.controls) ? section.controls : []
      for (let c = 0; c < controls.length; c += 1) {
        const control = controls[c]
        const id = control?.id
        if (id == null) continue
        map[id] = getRuleAwareControl(control)
      }
    }
    return map
  }, [currentFormSections, getRuleAwareControl])

  // Query Actual value: debounced UI errors + save guard use `validateQueryModalActualValue` → `validateControl` (same as CRF).
  // Single effect, fixed-size deps (avoids React HMR hook-index mismatch). Refs supply latest slice / sections / getRuleAwareControl inside the timer.
  //
  // Narrow trigger signature: re-fire ONLY when the value of the field that the
  // active query review targets actually changes — NOT on every keystroke
  // anywhere in `formData` / `optimisticControlValues`. Using whole objects as
  // deps + non-idempotent `setErrors([])` previously caused "Maximum update
  // depth exceeded" because each render produced a new `[]` reference, which
  // re-rendered, and any cascade (rule engine, auto-value-map, StrictMode)
  // re-fired this effect.
  const queryReviewActualValuesSig = useMemo(() => {
    const formId = selectedForm?.id
    if (!formId) return "noform"
    const fd = formData || {}
    const opt = optimisticControlValues || {}
    const sigFor = (review) => {
      if (!review) return "_"
      const fid = String(review.fieldId || "").trim()
      if (!fid) return "_"
      const v = getLiveQueryFieldValueRaw(fid, formId, fd, opt)
      return `${fid}=${v == null ? "" : String(v)}`
    }
    return `${sigFor(manualQueryReview)}||${sigFor(crmSystemQueryReview)}`
  }, [
    manualQueryReview,
    crmSystemQueryReview,
    selectedForm?.id,
    formData,
    optimisticControlValues,
  ])

  useEffect(() => {
    const timers = []
    // Idempotent clear: avoid creating a fresh `[]` reference when the slice
    // is already empty — that was the root cause of the render loop.
    const clearErrorsIfNeeded = (setErrors) => {
      setErrors((prev) => (Array.isArray(prev) && prev.length === 0 ? prev : []))
    }
    const schedule = (review, setErrors) => {
      if (!review) {
        clearErrorsIfNeeded(setErrors)
        return
      }
      const submittedBy = Number(getQueryAssignedToUserId(review))
      const isSubmittedOwner = Number.isFinite(submittedBy) && loggedInUserId === submittedBy
      const isClosed = isQueryClosedStatus(review.status)
      const sf = selectedFormRef.current
      if (!isSubmittedOwner || isClosed || !sf?.id) {
        clearErrorsIfNeeded(setErrors)
        return
      }
      const fieldId = String(review.fieldId || "").trim()
      if (!fieldId) {
        clearErrorsIfNeeded(setErrors)
        return
      }
      const formId = sf.id
      const tid = window.setTimeout(() => {
        const fd = formDataRef.current || {}
        const formSlice = fd && formId ? fd[formId] || {} : {}
        const optimistic = optimisticControlValuesRef.current || {}
        const draftValue = getLiveQueryFieldValueRaw(fieldId, formId, fd, optimistic)
        const { errors } = validateQueryModalActualValue({
          fieldId,
          draftValue,
          formSlice,
          selectedForm: sf,
          currentFormSections: currentFormSectionsRef.current,
          getRuleAwareControl: getRuleAwareControlRef.current,
          patientGender: selectedPatient?.gender,
        })
        const nextErrs = Array.isArray(errors) ? errors : []
        setErrors((prev) => {
          if (prev.length === nextErrs.length && prev.every((e, i) => e === nextErrs[i])) return prev
          return nextErrs
        })
      }, 70)
      timers.push(tid)
    }
    schedule(manualQueryReview, setManualQueryActualErrors)
    schedule(crmSystemQueryReview, setSystemQueryActualErrors)
    return () => {
      timers.forEach((id) => window.clearTimeout(id))
    }
  }, [
    manualQueryReview,
    crmSystemQueryReview,
    selectedForm?.id,
    loggedInUserId,
    selectedPatient?.gender,
    crfOverridesValidationSig,
    formSectionLayoutKey,
    queryReviewActualValuesSig,
  ])

  // Validate all controls in the form (defined after hook to use getEvaluatedControl)
  const validateAllControls = useCallback((form, formDataToValidate) => {
    if (!form || !form.section?.controls) return
    
    const allErrors = {}
    const allControls = form.section.controls
    
    allControls.forEach(control => {
      const evaluatedControl = getRuleAwareControl(control)
      if (!shouldShowControlForPatientGender(evaluatedControl, selectedPatient)) return
      // Skip hidden controls
      if (evaluatedControl.properties?.hidden) return
      
      const value = formDataToValidate[control.id]
      const validation = validateControl(evaluatedControl, value, formDataToValidate, {
        skipDateRestrictionValidation: true,
        patientGender: selectedPatient?.gender,
      })
      
      if (!validation.isValid) {
        allErrors[control.id] = validation.errors
      }
    })
    
    setValidationErrors((prev) => {
      const prevSlice = prev[form.id]
      try {
        if (
          prevSlice === allErrors ||
          stableStringifyValidationSlice(prevSlice) === stableStringifyValidationSlice(allErrors)
        ) {
          return prev
        }
      } catch {
        /* ignore */
      }
      return { ...prev, [form.id]: allErrors }
    })
  }, [getRuleAwareControl, selectedPatient])

  const validateAllControlsRef = useRef(validateAllControls)
  const runtimePerfTrackerRef = useRef(createRuntimePerfTracker())
  const mismatchSamplerRef = useRef(createMismatchSampler())
  const ruleRuntimeWarmTimerRef = useRef(null)
  const ruleRuntimeColdIdleRef = useRef(null)
  const ruleRuntimeAsyncCycleRef = useRef(0)
  const ruleRuntimeRenderRafRef = useRef(null)
  const ruleRuntimeStageSamplesRef = useRef({
    evaluate: [],
    apply: [],
    render: [],
  })
  const ruleRuntimePrefetchCacheRef = useRef(new Map())
  const appendRuntimeStageSample = useCallback((stage, sample) => {
    const key = String(stage || "").trim().toLowerCase()
    if (!key) return
    const bucket = ruleRuntimeStageSamplesRef.current?.[key]
    if (!Array.isArray(bucket)) return
    bucket.push({
      durationMs: Number(sample?.durationMs || 0),
      budgetMs: Number(sample?.budgetMs || 0),
      pass: Boolean(sample?.pass),
      deltaMs: Number(sample?.deltaMs || 0),
      at: new Date().toISOString(),
      formId: selectedForm?.id || null,
      studyId: studyId || null,
      trigger: sample?.trigger || null,
    })
    if (bucket.length > 600) {
      bucket.splice(0, bucket.length - 600)
    }
  }, [selectedForm?.id, studyId])

  // Phase-1 rule-runtime shadow mode:
  // compile and evaluate impacted rules without changing current legacy behavior.
  const ruleRuntimeShadow = useMemo(() => {
    const rawRules = Array.isArray(selectedForm?.crfDesign?.rules) ? selectedForm.crfDesign.rules : []
    const compiled = compileRulesToCanonicalIR(rawRules)
    return {
      runtime: new RuleRuntime({ rules: compiled.rules }),
      diagnostics: compiled.diagnostics,
    }
  }, [selectedForm?.id, selectedForm?.crfDesign?.rules])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.__crfRuleRuntimeSetMode = (mode, options = {}) => setRuleRuntimeMode(mode, options)
    window.__crfRuleRuntimeClearMode = () => clearRuleRuntimeMode()
    window.__crfRuleRuntimeGetMode = () => getRuleRuntimeModeConfig()
    window.__crfRuleRuntimeGetLastLikelyNextFields = () =>
      Array.isArray(window.__crfRuleRuntimeLastLikelyNextFields)
        ? window.__crfRuleRuntimeLastLikelyNextFields
        : []
    window.__crfRuleRuntimeGetPrefetchCache = () => {
      const out = {}
      ruleRuntimePrefetchCacheRef.current.forEach((value, key) => {
        out[key] = value
      })
      return out
    }
    window.__crfRuleRuntimeClearPrefetchCache = () => {
      ruleRuntimePrefetchCacheRef.current.clear()
      return true
    }
    window.__crfRuleRuntimeGetLastSlo = () => window.__crfRuleRuntimeLastSlo || null
    window.__crfRuleRuntimeGetLastStageSlo = () => window.__crfRuleRuntimeLastStageSlo || null
    window.__crfRuleRuntimeGetStageSamples = () => ({
      evaluate: [...(ruleRuntimeStageSamplesRef.current?.evaluate || [])],
      apply: [...(ruleRuntimeStageSamplesRef.current?.apply || [])],
      render: [...(ruleRuntimeStageSamplesRef.current?.render || [])],
    })
    window.__crfRuleRuntimeClearStageSamples = () => {
      ruleRuntimeStageSamplesRef.current = { evaluate: [], apply: [], render: [] }
      return true
    }
    window.__crfRuleRuntimeDownloadStageSamples = () =>
      downloadParityReportJson(
        {
          formId: window.__crfRuleRuntimeLastParityReport?.formId || null,
          stageSamples: window.__crfRuleRuntimeGetStageSamples(),
        },
        {
          prefix: `crf-rule-runtime-stage-samples-form-${String(
            window.__crfRuleRuntimeLastParityReport?.formId || "unknown"
          )}`,
        }
      )
    window.__crfRuleRuntimeGetPerfSummary = () =>
      runtimePerfTrackerRef.current?.summary?.() || {
        sampleCount: 0,
        p50Ms: 0,
        p95Ms: 0,
        maxMs: 0,
        avgMs: 0,
        avgImpactedRules: 0,
        avgPatchFields: 0,
      }
    window.__crfRuleRuntimeAssertSlo = () => {
      const snapshots = window.__crfRuleRuntimeLastSlo || {}
      const entries = Object.entries(snapshots)
      if (entries.length === 0) return { pass: false, reason: "NO_SLO_DATA", failed: [] }
      const failed = entries
        .filter(([, value]) => value && value.pass === false)
        .map(([trigger, value]) => ({
          trigger,
          durationMs: value?.durationMs ?? null,
          budgetMs: value?.budgetMs ?? null,
          deltaMs: value?.deltaMs ?? null,
        }))
      return { pass: failed.length === 0, failed, totalChecks: entries.length }
    }
  }, [])

  useEffect(() => () => {
    if (ruleRuntimeWarmTimerRef.current) {
      window.clearTimeout(ruleRuntimeWarmTimerRef.current)
      ruleRuntimeWarmTimerRef.current = null
    }
    if (ruleRuntimeColdIdleRef.current && typeof window !== "undefined") {
      const cancelIdle = window.cancelIdleCallback
      if (typeof cancelIdle === "function") {
        cancelIdle(ruleRuntimeColdIdleRef.current)
      } else {
        window.clearTimeout(ruleRuntimeColdIdleRef.current)
      }
      ruleRuntimeColdIdleRef.current = null
    }
    if (ruleRuntimeRenderRafRef.current && typeof window !== "undefined") {
      window.cancelAnimationFrame(ruleRuntimeRenderRafRef.current)
      ruleRuntimeRenderRafRef.current = null
    }
  }, [])

  useEffect(() => {
    try {
      if (typeof window === "undefined") return
      const rolloutConfig = readRuleRuntimeRolloutConfig()
      const shadowEnabled = rolloutConfig.shadowEnabled
      const pilotEnabled = rolloutConfig.pilotEnabled
      if (!shadowEnabled && !pilotEnabled) return
      const runtime = ruleRuntimeShadow?.runtime
      if (!runtime) return
      const formSlice =
        deferredRuleFormData && typeof deferredRuleFormData === "object" ? deferredRuleFormData : {}
      const dirtyKeys = Array.isArray(dataEntryRuleDirtyKeysRef.current)
        ? dataEntryRuleDirtyKeysRef.current.filter(Boolean)
        : []
      const changedKeys = dirtyKeys.includes("*")
        ? Object.keys(formSlice)
        : (dirtyKeys.length > 0 ? dirtyKeys : Object.keys(formSlice))
      const resolveChangedFieldKind = (fieldId) => {
        const fid = String(fieldId || "").trim()
        if (!fid) return ""
        const allControls = currentFormSections?.flatMap((s) => s.controls || []) || []
        const direct = allControls.find((c) => String(c?.id || "") === fid)
        if (direct) return String(direct?.type || "").trim().toLowerCase()
        const cellMatch = fid.match(/^(.*)_row_(\d+)_col_(\d+)$/)
        if (!cellMatch) return ""
        const tableId = cellMatch[1]
        const colIdx = parseInt(cellMatch[3], 10)
        if (Number.isNaN(colIdx)) return ""
        const table = allControls.find((c) => String(c?.id || "") === tableId)
        const colTypes = Array.isArray(table?.properties?.columnTypes) ? table.properties.columnTypes : []
        return String(colTypes[colIdx] || "").trim().toLowerCase()
      }
      const isSingleDiscreteLikeChange =
        changedKeys.length === 1 &&
        (() => {
          const kind = resolveChangedFieldKind(changedKeys[0])
          return kind === "radio" || kind === "optionbutton" || kind === "checkbox" || kind === "select"
        })()
      const debugShadowLogsEnabled = window.localStorage?.getItem("crfRulesDebug") === "1"
      // Fast lane: skip expensive shadow/compare telemetry for single radio toggles.
      // Main CRF rule pipeline still runs and updates behavior.
      if (isSingleDiscreteLikeChange && !rolloutConfig.pilotEnabled) return
      const uiIntent = ecrfPerfLastUiIntentRef.current || { type: "unknown" }
      const trigger =
        uiIntent.type === "keyboard"
          ? "change"
          : uiIntent.type === "mouse"
            ? "change"
            : uiIntent.type === "submit"
              ? "submit"
              : "change"
      const allControls = currentFormSections?.flatMap((s) => s.controls || []) || []
      const fieldLabelMap = createFieldLabelMap(allControls)
      const runtimeEvalStartedAt =
        typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()
      const result = runtime.evaluate({
        changedFieldIds: changedKeys,
        trigger,
        formValues: formSlice,
        evaluateExpression: (rule, values) =>
          evaluateRule(rule?.conditionExpression || "", values, {}, {
            source: "rule-runtime-shadow",
            ruleId: rule?.id,
          }),
        evaluateCompute: (rule, values) =>
          safeEvaluateCompute(rule?.conditionExpression || "", values, fieldLabelMap, {
            rule,
            allControls,
          }),
      })
      if (typeof window !== "undefined") {
        const likelyNextFields = Array.isArray(result?.meta?.likelyNextFields)
          ? result.meta.likelyNextFields
          : []
        window.__crfRuleRuntimeLastLikelyNextFields = likelyNextFields
        const nextCache = new Map()
        likelyNextFields.slice(0, 24).forEach((fieldId) => {
          const fid = String(fieldId || "").trim()
          if (!fid) return
          nextCache.set(fid, {
            value: formSlice?.[fid] ?? null,
            at: new Date().toISOString(),
            source: "predictive-precompute",
          })
        })
        ruleRuntimePrefetchCacheRef.current = nextCache
      }
      const runtimeFieldPatches = result?.fieldPatches || {}
      const comparableProps = [
        "hidden",
        "readonly",
        "minDateFromFieldId",
        "maxDateFromFieldId",
        "conditionallyRequired",
        "requiredIfMessage",
      ]
      const parityReport = buildParityReport({
        runtimeFieldPatches,
        allControls,
        getEvaluatedControl,
        crfRuleControlOverrides,
        inferredDateBoundsByControl,
        comparableProps,
      })
      const runtimeEvalFinishedAt =
        typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()
      const runtimeEvalMs = Math.max(0, runtimeEvalFinishedAt - runtimeEvalStartedAt)
      const evalStageSlo = evaluateRuntimeStageSlo("evaluate", runtimeEvalMs)
      appendRuntimeStageSample("evaluate", evalStageSlo)
      const changeSlo = evaluateRuntimeSlo(trigger, runtimeEvalMs)
      runtimePerfTrackerRef.current.record(
        runtimeEvalMs,
        Number(result?.meta?.impactedRuleCount || (Array.isArray(result?.traces) ? result.traces.length : 0)),
        Object.keys(runtimeFieldPatches).length
      )
      const perfSummary = runtimePerfTrackerRef.current.summary()
      const compareStatus = buildCompareModeStatus(parityReport, {
        mismatchWarnThreshold: rolloutConfig.mismatchWarnThreshold,
      })
      const selectedFormId = String(selectedForm?.id || "")
      const primaryShouldApply = isRuleRuntimePrimaryAllowed(rolloutConfig, {
        formId: selectedFormId,
        studyId: String(studyId || ""),
      })
      const primaryBlockedByCompareFail =
        primaryShouldApply &&
        rolloutConfig.autoFallbackOnCompareFail &&
        compareStatus.severity === "fail"
      const runtimeApplyEnabled = (rolloutConfig.pilotEnabled || primaryShouldApply) && !primaryBlockedByCompareFail
      setRuleRuntimePrimaryActive(primaryShouldApply && !primaryBlockedByCompareFail)

      if (compareStatus.severity !== "pass") {
        mismatchSamplerRef.current.record(
          {
            formId: selectedForm?.id || null,
            studyId: studyId || null,
            parity: parityReport,
            compareStatus,
            diagnostics: ruleRuntimeShadow?.diagnostics || [],
          },
          rolloutConfig.mismatchSampleRate
        )
      }

      if (shadowEnabled && debugShadowLogsEnabled) {
        console.info("[RuleRuntime][Shadow]", {
          formId: selectedForm?.id || null,
          diagnostics: ruleRuntimeShadow?.diagnostics || [],
          fieldPatches: runtimeFieldPatches,
          validationPatches: result?.validationPatches || {},
          parity: parityReport,
          compareStatus,
          rollout: {
            pilotEnabled: rolloutConfig.pilotEnabled,
            primaryShouldApply,
            primaryBlockedByCompareFail,
            runtimeApplyEnabled,
          },
          perf: {
            cycleMs: Number(runtimeEvalMs.toFixed(2)),
            ...perfSummary,
          },
          slo: changeSlo,
          stageSlo: {
            evaluate: evalStageSlo,
          },
          traces: result?.traces || [],
        })
        window.__crfRuleRuntimeLastParityReport = {
          formId: selectedForm?.id || null,
          parity: parityReport,
          perf: {
            cycleMs: Number(runtimeEvalMs.toFixed(2)),
            ...perfSummary,
          },
          slo: changeSlo,
          stageSlo: {
            evaluate: evalStageSlo,
          },
          compareStatus,
          rollout: {
            pilotEnabled: rolloutConfig.pilotEnabled,
            primaryShouldApply,
            primaryBlockedByCompareFail,
            runtimeApplyEnabled,
          },
          generatedAt: new Date().toISOString(),
        }
        window.__crfRuleRuntimeDownloadLastParityReport = () =>
          downloadParityReportJson(window.__crfRuleRuntimeLastParityReport, {
            prefix: `crf-rule-runtime-parity-form-${String(selectedForm?.id || "unknown")}`,
          })
        window.__crfRuleRuntimeFlushMismatchSamples = () => mismatchSamplerRef.current.flush()
        window.__crfRuleRuntimeGetMismatchSamples = () => mismatchSamplerRef.current.getBuffered()
        window.__crfRuleRuntimeSetMode = (mode, options = {}) => setRuleRuntimeMode(mode, options)
        window.__crfRuleRuntimeClearMode = () => clearRuleRuntimeMode()
        window.__crfRuleRuntimeGetMode = () => getRuleRuntimeModeConfig()
      }

      if (typeof window !== "undefined") {
        window.__crfRuleRuntimeLastSlo = { change: changeSlo }
        window.__crfRuleRuntimeLastStageSlo = {
          ...(window.__crfRuleRuntimeLastStageSlo || {}),
          evaluate: evalStageSlo,
        }
      }

      const runTierPass = async (tierTrigger, cycleToken) => {
        if (cycleToken !== ruleRuntimeAsyncCycleRef.current) return
        const shouldUseWorkerEval = tierTrigger === "background" || tierTrigger === "idle"
        let workerEvalMap = null
        if (shouldUseWorkerEval) {
          const jobs = (Array.isArray(runtime?.rules) ? runtime.rules : [])
            .filter((rule) => {
              if (!rule || rule.enabled === false) return false
              const mode = String(rule?.action?.payload?.mode || "").trim().toLowerCase()
              if (mode === "compute") return false
              return Boolean(String(rule?.conditionExpression || "").trim())
            })
            .map((rule) => ({
              key: `rr:${String(rule?.id || "")}`,
              expression: String(rule?.conditionExpression || ""),
            }))
          if (jobs.length > 0) {
            const workerOut = await evaluateRuleBatchWithWorkerEngine(
              jobs,
              formSlice,
              {},
              { preferWorker: true }
            )
            if (cycleToken !== ruleRuntimeAsyncCycleRef.current) return
            workerEvalMap = workerOut && typeof workerOut === "object" ? workerOut : {}
          }
        }
        const startedAt =
          typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()
        const tierResult = runtime.evaluate({
          changedFieldIds: changedKeys,
          trigger: tierTrigger,
          formValues: formSlice,
          evaluateExpression: (rule, values) =>
            workerEvalMap
              ? Boolean(workerEvalMap[`rr:${String(rule?.id || "")}`])
              : evaluateRule(rule?.conditionExpression || "", values, {}, {
                source: "rule-runtime-shadow",
                ruleId: rule?.id,
              }),
          evaluateCompute: (rule, values) =>
            safeEvaluateCompute(rule?.conditionExpression || "", values, fieldLabelMap, {
              rule,
              allControls,
            }),
        })
        const finishedAt =
          typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()
        const ms = Math.max(0, finishedAt - startedAt)
        const slo = evaluateRuntimeSlo(tierTrigger, ms)
        if (typeof window !== "undefined") {
          const prev = window.__crfRuleRuntimeLastSlo || {}
          window.__crfRuleRuntimeLastSlo = { ...prev, [tierTrigger]: slo }
        }
      if (shadowEnabled && debugShadowLogsEnabled) {
          console.info(`[RuleRuntime][${String(tierTrigger).toUpperCase()}]`, {
            perf: { cycleMs: Number(ms.toFixed(2)) },
            slo,
            meta: tierResult?.meta || {},
          })
        }
      }

      const asyncCycleToken = ++ruleRuntimeAsyncCycleRef.current
      if (ruleRuntimeWarmTimerRef.current) {
        window.clearTimeout(ruleRuntimeWarmTimerRef.current)
      }
      ruleRuntimeWarmTimerRef.current = window.setTimeout(() => {
        runTierPass("background", asyncCycleToken).catch(() => {
          // Warm tier pass is best effort only.
        })
      }, 90)

      if (ruleRuntimeColdIdleRef.current) {
        const cancelIdle = window.cancelIdleCallback
        if (typeof cancelIdle === "function") {
          cancelIdle(ruleRuntimeColdIdleRef.current)
        } else {
          window.clearTimeout(ruleRuntimeColdIdleRef.current)
        }
        ruleRuntimeColdIdleRef.current = null
      }
      const requestIdle = window.requestIdleCallback
      if (typeof requestIdle === "function") {
        ruleRuntimeColdIdleRef.current = requestIdle(
          () => {
            runTierPass("idle", asyncCycleToken).catch(() => {
              // Cold tier pass is best effort only.
            })
          },
          { timeout: 260 }
        )
      } else {
        ruleRuntimeColdIdleRef.current = window.setTimeout(() => {
          runTierPass("idle", asyncCycleToken).catch(() => {
            // Cold tier pass is best effort only.
          })
        }, 260)
      }

      const pilotShouldApply = isRuleRuntimePilotAllowed(rolloutConfig, {
        formId: selectedFormId,
        studyId: String(studyId || ""),
      })
      if (!runtimeApplyEnabled || (!pilotShouldApply && !primaryShouldApply)) {
        startTransition(() => {
          setRuleRuntimePilotOverrides((prev) => {
            if (!prev || Object.keys(prev).length === 0) return prev
            return {}
          })
        })
        return
      }

      const applyStartedAt =
        typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()
      const nextPilotOverrides = buildPilotControlOverrides(runtimeFieldPatches, comparableProps)
      startTransition(() => {
        setRuleRuntimePilotOverrides(nextPilotOverrides)
      })
      if (rolloutConfig.applyValuesEnabled && selectedForm?.id) {
        if (Object.keys(runtimeFieldPatches).length > 0) {
          startTransition(() => {
            setFormData((prev) => {
              const prevSlice = prev[selectedForm.id] || {}
              const { changed, nextSlice } = applyValuePatchesToFormSlice(prevSlice, runtimeFieldPatches)
              if (!changed) return prev
              return {
                ...prev,
                [selectedForm.id]: nextSlice,
              }
            })
          })
        }
      }
      const applyFinishedAt =
        typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()
      const applyStageMs = Math.max(0, applyFinishedAt - applyStartedAt)
      const applyStageSlo = evaluateRuntimeStageSlo("apply", applyStageMs)
      appendRuntimeStageSample("apply", applyStageSlo)
      if (typeof window !== "undefined") {
        window.__crfRuleRuntimeLastStageSlo = {
          ...(window.__crfRuleRuntimeLastStageSlo || {}),
          apply: applyStageSlo,
        }
      }
      if (typeof window !== "undefined") {
        const renderProbeStartedAt =
          typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()
        if (ruleRuntimeRenderRafRef.current) {
          window.cancelAnimationFrame(ruleRuntimeRenderRafRef.current)
        }
        ruleRuntimeRenderRafRef.current = window.requestAnimationFrame(() => {
          const renderProbeFinishedAt =
            typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()
          const renderStageMs = Math.max(0, renderProbeFinishedAt - renderProbeStartedAt)
          const renderStageSlo = evaluateRuntimeStageSlo("render", renderStageMs)
          appendRuntimeStageSample("render", renderStageSlo)
          window.__crfRuleRuntimeLastStageSlo = {
            ...(window.__crfRuleRuntimeLastStageSlo || {}),
            render: renderStageSlo,
          }
        })
      }
    } catch {
      // Shadow mode should never block data-entry flow.
    }
  }, [
    selectedForm?.id,
    deferredRuleFormData,
    ruleRuntimeShadow,
    currentFormSections,
    getEvaluatedControl,
    crfRuleControlOverrides,
    inferredDateBoundsByControl,
    studyId,
    appendRuntimeStageSample,
  ])

  // Build once-per-form rule dependency index so dirty-field filtering is O(1)-ish per rule.
  const crfDesignRuleDependencyIndex = useMemo(() => {
    const rules = Array.isArray(selectedForm?.crfDesign?.rules) ? selectedForm.crfDesign.rules : []
    const byId = new Map()
    const byIndex = []
    rules.forEach((rule, idx) => {
      let targetIds = []
      if (Array.isArray(rule?.targetFields) && rule.targetFields.length > 0) {
        targetIds = rule.targetFields.map(String)
      } else if (rule?.targetField) {
        const tf = String(rule.targetField)
        targetIds = tf.includes(",") ? tf.split(",").map((s) => s.trim()).filter(Boolean) : [tf]
      }
      const dep = createRuleDependencyIndex(rule?.expression || rule?.ruleExpression || "", targetIds)
      byIndex[idx] = dep
      if (rule?.id != null) byId.set(rule.id, dep)
    })
    return { byId, byIndex }
  }, [selectedForm?.id, selectedForm?.crfDesign?.rules])

  const crfRuleEvalRunIdRef = useRef(0)

  // Re-evaluate rules when form data changes
  useEffect(() => {
    if (!selectedForm || currentFormSections.length === 0) {
      dataEntryRuleDirtyKeysRef.current = null
      return
    }
    // Snapshot dirty keys BEFORE clearing so CRF-design rule evaluation can also run incrementally.
    const dirtyKeysSnapshot = Array.isArray(dataEntryRuleDirtyKeysRef.current)
      ? [...dataEntryRuleDirtyKeysRef.current]
      : null

    const runId = ++crfRuleEvalRunIdRef.current
    let cancelled = false

    const run = async () => {
      const runStartedAt =
        typeof performance !== "undefined" && performance.now
          ? performance.now()
          : Date.now()
      logEcrfPerf("rule_cycle_start", {
        runId,
        dirtyKeys: dirtyKeysSnapshot,
      })
      // Evaluate CRF-level rules and apply actions to target fields
      if (!(selectedForm.crfDesign?.rules && Array.isArray(selectedForm.crfDesign.rules))) {
        setCrfRuleControlOverrides((prev) => {
          if (!prev || Object.keys(prev).length === 0) return prev
          return {}
        })
        dataEntryRuleDirtyKeysRef.current = null
        return
      }

      const allControls = selectedForm.section?.controls || []
      const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms))
      const resolveDirtyInputKind = (dirtyKey) => {
        if (!dirtyKey || dirtyKey === "*") return ""
        const direct = allControls.find((c) => c.id === dirtyKey)
        if (direct) return String(direct.type || "").toLowerCase()
        const cellMatch = String(dirtyKey).match(/^(.*)_row_(\d+)_col_(\d+)$/)
        if (!cellMatch) return ""
        const tableId = cellMatch[1]
        const colIdx = parseInt(cellMatch[3], 10)
        if (Number.isNaN(colIdx)) return ""
        const table = allControls.find((c) => c.id === tableId && String(c.type || "").toLowerCase() === "table")
        if (!table) return ""
        const colTypes = Array.isArray(table.properties?.columnTypes) ? table.properties.columnTypes : []
        return String(colTypes[colIdx] || "text").toLowerCase()
      }
      // Ultra-fast UX: for discrete controls we intentionally defer heavy rule pass
      // so input click/render feedback stays instant.
      // Tightened windows so rule-driven UI updates (readonly toggles, computed values,
      // conditionally-required highlights) feel real-time. `optimisticControlValues`
      // already paints the click instantly, and the rule pass runs in startTransition,
      // so these timings keep clicks snappy while making rules visibly faster.
      if (
        Array.isArray(dirtyKeysSnapshot) &&
        dirtyKeysSnapshot.length === 1 &&
        dirtyKeysSnapshot[0] !== "*"
      ) {
        const dirtyKind = resolveDirtyInputKind(dirtyKeysSnapshot[0])
        const textLikeKinds = new Set(["text", "number", "lab", "textarea"])
        const highPriorityDiscrete = new Set(["radio", "optionbutton", "checkbox", "select"])
        const otherDiscreteKinds = new Set(["date", "ukunkdate", "time"])
        const coalesceMs = textLikeKinds.has(dirtyKind)
          ? 24
          : highPriorityDiscrete.has(dirtyKind)
            ? 70
            : otherDiscreteKinds.has(dirtyKind)
              ? 18
              : 12
        if (coalesceMs > 0) {
          await sleep(coalesceMs)
          if (cancelled || runId !== crfRuleEvalRunIdRef.current) return
        }
      }
      const dirtyKeySet = new Set((dirtyKeysSnapshot || []).map((k) => String(k || "").trim()).filter(Boolean))
      const dirtyBaseKeySet = new Set(
        [...dirtyKeySet]
          .map((id) => {
            const m = String(id).match(/^(.+)_row_\d+_col_\d+$/)
            return m?.[1] ? String(m[1]) : null
          })
          .filter(Boolean),
      )
      const isSingleRadioDirty =
        Array.isArray(dirtyKeysSnapshot) &&
        dirtyKeysSnapshot.length === 1 &&
        dirtyKeysSnapshot[0] !== "*" &&
        (() => {
          const kind = resolveDirtyInputKind(dirtyKeysSnapshot[0])
          return kind === "radio" || kind === "optionbutton"
        })()
      const controlLookup = new Map(allControls.map((control) => [control.id, control]))
      const fieldLabelMap = createFieldLabelMap(allControls)
      // CRITICAL: Use getFormValues to ensure ALL field IDs are included, even if empty
      // This prevents "is not defined" errors when field IDs in expressions aren't in formData yet
      const allFormValuesForRules = getFormValues(allControls, deferredRuleFormData, { useControlDefaults: false })

      const messages = []
      // Track which controls need to be updated with rule actions
      const controlsToUpdate = {}
      const preparedRules = []
      const expressionJobs = []
      const tracedRuleIds = (() => {
        try {
          if (typeof window === "undefined") return null
          const raw = window.localStorage?.getItem("crfRulesTraceRuleIds")
          if (!raw) return null
          const set = new Set(
            String(raw)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          )
          return set.size > 0 ? set : null
        } catch {
          return null
        }
      })()
      const shouldTraceRule = (ruleId) => {
        const id = String(ruleId ?? "")
        return tracedRuleIds ? tracedRuleIds.has(id) : false
      }
      const shouldTraceTableRuleTargets = (() => {
        try {
          if (typeof window === "undefined") return false
          return (
            window.localStorage?.getItem("crfRulesDebug") === "1" ||
            window.localStorage?.getItem("crfRulesTraceTableTargets") === "1"
          )
        } catch {
          return false
        }
      })()
      const shouldTraceRadioRules = (() => {
        try {
          if (typeof window === "undefined") return false
          return (
            window.localStorage?.getItem("crfRulesDebug") === "1" ||
            window.localStorage?.getItem("crfRulesTraceRadio") === "1"
          )
        } catch {
          return false
        }
      })()

      const designRules = Array.isArray(selectedForm?.crfDesign?.rules)
        ? selectedForm.crfDesign.rules
        : []
      const controlComputeRules = allControls.flatMap((control) => {
        const rawRules = Array.isArray(control?.properties?.rules) ? control.properties.rules : []
        return rawRules
          .map((rule, idx) => {
            const category = normalizeRuleCategory(rule?.category ?? rule?.ruleCategory ?? rule?.Category)
            if (category !== "compute") return null
            const expr = String(rule?.expression ?? rule?.ruleExpression ?? "").trim()
            if (!expr) return null
            const targetField = String(rule?.targetField ?? "").trim() || String(control?.id || "").trim()
            if (!targetField) return null
            return {
              ...rule,
              category: rule?.category ?? rule?.ruleCategory ?? "Compute",
              targetField,
              __fromControlRule: true,
              __controlId: control?.id ?? null,
              __syntheticRuleKey: `ctrl_compute:${String(control?.id || "")}:${idx}:${targetField}`,
            }
          })
          .filter(Boolean)
      })
      const seenRuleKeys = new Set()
      const runtimeRulePool = []
      ;[...designRules, ...controlComputeRules].forEach((rule) => {
        const key = String(
          rule?.id ??
            rule?.ruleId ??
            rule?.__syntheticRuleKey ??
            `${rule?.targetField || ""}|${rule?.expression || rule?.ruleExpression || ""}|${rule?.category || rule?.ruleCategory || ""}`
        )
        if (!key || seenRuleKeys.has(key)) return
        seenRuleKeys.add(key)
        runtimeRulePool.push(rule)
      })
      runtimeRulePool.forEach((rule, ruleIdx) => {
        const normalizedCategory = normalizeRuleCategory(
          rule?.category ?? rule?.ruleCategory ?? rule?.Category
        )
        const ruleExpressionRaw = rule?.expression ?? rule?.ruleExpression ?? rule?.Expression ?? ""
        const targetFieldRaw = rule?.targetField ?? rule?.TargetField ?? ""
        const targetFieldsRaw = rule?.targetFields ?? rule?.TargetFields ?? null
        const hasTableCellTarget =
          (typeof targetFieldRaw === "string" && /_row_\d+_col_\d+/.test(targetFieldRaw)) ||
          (Array.isArray(targetFieldsRaw) && targetFieldsRaw.some((t) => /_row_\d+_col_\d+/.test(String(t || ""))))
        const precompiledDep =
          (!rule?.__fromControlRule && rule?.id != null
            ? crfDesignRuleDependencyIndex.byId.get(rule.id)
            : crfDesignRuleDependencyIndex.byIndex[ruleIdx]) || null
        if (normalizedCategory !== "compute" && isSingleRadioDirty && precompiledDep) {
          const directMatch = (precompiledDep.referencedIds || []).some((id) =>
            dirtyKeySet.has(String(id || "").trim()),
          )
          const baseMatch = (precompiledDep.referencedBaseIds || []).some((id) =>
            dirtyBaseKeySet.has(String(id || "").trim()) || dirtyKeySet.has(String(id || "").trim()),
          )
          if (!directMatch && !baseMatch) return
        }
        if (
          normalizedCategory !== "compute" &&
          !hasTableCellTarget &&
          dirtyKeysSnapshot &&
          dirtyKeysSnapshot.length > 0 &&
          !crfDesignRuleShouldRunForDirtyFields(
            rule,
            dirtyKeysSnapshot,
            controlLookup,
            precompiledDep
          )
        ) {
          return
        }
        try {
          // Resolve target IDs first so diagnostics include targets in the same evaluateRule() log line
          let targetIds = []
          if (Array.isArray(targetFieldsRaw) && targetFieldsRaw.length > 0) {
            targetIds = targetFieldsRaw
          } else if (targetFieldRaw) {
            const tf = String(targetFieldRaw)
            targetIds = tf.includes(",") ? tf.split(",").map(s => s.trim()).filter(Boolean) : [tf]
          }
          targetIds = resolveRuleTargetIdsOnForm(allControls, targetIds)

          const baseExpression = String(ruleExpressionRaw || "")
          const targetContexts = []
          targetIds.forEach((targetId) => {
            const rowColMatch = String(targetId).match(/^(.*)_row_(\d+)_col_(\d+)$/)
            if (!rowColMatch) {
              targetContexts.push({ targetId, expression: baseExpression })
              return
            }
            const tableId = rowColMatch[1]
            const templateRowIdx = parseInt(rowColMatch[2], 10)
            const colIdx = parseInt(rowColMatch[3], 10)
            const tableControl = allControls.find(c => c.id === tableId && String(c.type || "").toLowerCase() === "table")
            const addRowEnabled = Boolean(tableControl?.properties?.addRow)
            const designRows = Math.max(1, Number(tableControl?.properties?.rows || 1))
            if (!tableControl || Number.isNaN(templateRowIdx) || Number.isNaN(colIdx) || !addRowEnabled || templateRowIdx !== 0 || designRows !== 1) {
              targetContexts.push({ targetId, expression: baseExpression })
              return
            }
            const rowCountKey = `${tableId}_rowCount`
            const rowCountFromForm = parseInt(deferredRuleFormData?.[rowCountKey], 10)
            const tableRowCount =
              !Number.isNaN(rowCountFromForm) && rowCountFromForm > 0
                ? Math.max(designRows, rowCountFromForm)
                : designRows
            for (let rowIdx = 0; rowIdx < tableRowCount; rowIdx++) {
              // Backward-compatible dynamic row expansion:
              // - Current rules should use row_0 template when addRow=true and designRows=1
              // - Older rules may still contain row_1/row_2 tokens in expression
              // In single-template-row dynamic tables, force same-row mapping by replacing
              // ANY row token for this table to the current row index.
              const rowTokenRegex =
                designRows === 1
                  ? new RegExp(`${tableId}_row_\\d+_`, "g")
                  : new RegExp(`${tableId}_row_${templateRowIdx}_`, "g")
              targetContexts.push({
                targetId: `${tableId}_row_${rowIdx}_col_${colIdx}`,
                expression: String(baseExpression).replace(rowTokenRegex, `${tableId}_row_${rowIdx}_`),
              })
            }
          })
          const effectiveTargets = targetContexts.length > 0 ? targetContexts : targetIds.map((targetId) => ({ targetId, expression: baseExpression }))

          if (!ruleTargetsExistOnForm(allControls, effectiveTargets, targetIds)) {
            return
          }

          const crfRuleLogMeta = {
            log: "crf-design",
            source: "ecrf-data-entry:crfDesign.rules-effect",
            ruleId: rule.id,
            ruleName: rule.ruleName || rule.name,
            ruleCategory: normalizedCategory,
            targetFieldIds: effectiveTargets.map((ctx) => ctx.targetId),
          }
          const category = normalizedCategory
          const isDateRestrictionCategoryRule =
            category === "date_restriction" || isDateRestrictionRule(rule)

          if (category === "compute") {
            logComputeRuleDebug("compute_rule_source", {
              ruleId: rule?.id ?? rule?.__syntheticRuleKey ?? null,
              source: rule?.__fromControlRule ? "control.properties.rules" : "crfDesign.rules",
              controlId: rule?.__controlId ?? null,
              targetIds: effectiveTargets.map((ctx) => ctx.targetId),
              expression: String(baseExpression || "").slice(0, 240),
            })
          }

          preparedRules.push({
            rule,
            ruleIdx,
            category,
            baseExpression,
            targetIds,
            effectiveTargets,
            crfRuleLogMeta,
            isDateRestrictionCategoryRule,
          })
          // Compute rules can contain full JS blocks and must not be parsed by boolean evaluator.
          // Date restriction uses interval-aware evaluator (ISO + UK/UNK), not generic string compare.
          if (category !== "compute" && !isDateRestrictionCategoryRule) {
            expressionJobs.push({
              key: `r:${ruleIdx}:base`,
              expression: baseExpression,
            })
            effectiveTargets.forEach(({ expression }, targetIdx) => {
              if (expression !== baseExpression) {
                expressionJobs.push({
                  key: `r:${ruleIdx}:t:${targetIdx}`,
                  expression,
                })
              }
            })
          }
        } catch (error) {
          console.error(`Error preparing CRF-level rule ${rule.id}:`, error)
        }
      })

      const uniqueJobs = []
      const seen = new Set()
      expressionJobs.forEach((job) => {
        const k = `${job.key}|${job.expression}`
        if (seen.has(k)) return
        seen.add(k)
        uniqueJobs.push(job)
      })
      const evaluatedExpressionMap = await evaluateRuleBatchWithWorkerEngine(
        uniqueJobs,
        allFormValuesForRules,
        fieldLabelMap
      )
      if (cancelled || runId !== crfRuleEvalRunIdRef.current) return

      const orderedPreparedRules = [...preparedRules].sort((a, b) => {
        const aId = Number.parseInt(String(a?.rule?.id ?? ""), 10)
        const bId = Number.parseInt(String(b?.rule?.id ?? ""), 10)
        const aHasId = Number.isFinite(aId)
        const bHasId = Number.isFinite(bId)
        if (aHasId && bHasId) return aId - bId
        if (aHasId) return -1
        if (bHasId) return 1
        return 0
      })

      orderedPreparedRules.forEach(
        ({
          rule,
          ruleIdx,
          category,
          baseExpression,
          targetIds,
          effectiveTargets,
          crfRuleLogMeta,
          isDateRestrictionCategoryRule,
        }) => {
        try {
          const ruleMessageCategory = normalizeRuleCategory(rule.category || rule.ruleCategory || rule.Category)
          const isRuleSubmitBlocking = isSubmitBlockingCategory(ruleMessageCategory)
          const ruleMessageText = sanitizeRuleMessageText(
            rule.message || rule.expression || rule.ruleExpression || ""
          )
          const pushedRuleMessageKeys = new Set()
          const evaluateDateRestrictionForExpr = (expr) => {
            const intervalResult = evaluateDateRestrictionExpression(expr, allFormValuesForRules)
            if (intervalResult !== null) return intervalResult
            return evaluateRule(expr, allFormValuesForRules, fieldLabelMap, {
              ...crfRuleLogMeta,
              source: "ecrf-data-entry:date-restriction-fallback",
            })
          }
          const conditionMet =
            category === "compute"
              ? false
              : isDateRestrictionCategoryRule
                ? evaluateDateRestrictionForExpr(baseExpression)
                : Boolean(evaluatedExpressionMap[`r:${ruleIdx}:base`])
          if (category !== "compute") {
            effectiveTargets.forEach(({ targetId, expression }, targetIdx) => {
            if (!targetId) return
            const conditionMetForTarget = isDateRestrictionCategoryRule
              ? evaluateDateRestrictionForExpr(expression)
              : expression === baseExpression
                ? conditionMet
                : Boolean(evaluatedExpressionMap[`r:${ruleIdx}:t:${targetIdx}`])
              if (shouldDeepTraceRule(rule?.id)) {
                const referencedIds = [
                  ...new Set(String(expression || "").match(/\bctrl_[A-Za-z0-9_]+\b/g) || []),
                ]
                const referencedValues = {}
                referencedIds.forEach((id) => {
                  referencedValues[id] = allFormValuesForRules?.[id]
                })
                deepTraceLog("condition_eval", {
                  ruleId: rule?.id,
                  ruleName: rule?.ruleName || rule?.name,
                  category,
                  targetId,
                  expression,
                  conditionMetForTarget,
                  referencedValues,
                }, `condition|${String(rule?.id ?? "")}|${String(targetId)}|${String(conditionMetForTarget)}`)
              }
              if (shouldTraceTableRuleTargets && /_row_\d+_col_\d+$/.test(String(targetId))) {
                const referencedIds = [
                  ...new Set(String(expression || "").match(/\bctrl_[A-Za-z0-9_]+\b/g) || []),
                ]
                const referencedValues = {}
                referencedIds.forEach((id) => {
                  referencedValues[id] = allFormValuesForRules?.[id]
                })
                logCrfRule("info", "rule_target_resolution_trace", {
                  ruleId: rule.id,
                  ruleName: rule.ruleName || rule.name,
                  category,
                  targetId,
                  source: "ecrf-data-entry:table-target",
                  expression,
                  conditionMetForTarget,
                  referencedValues,
                })
              }
              if (shouldTraceRadioRules) {
                const referencedIds = [
                  ...new Set(String(expression || "").match(/\bctrl_[A-Za-z0-9_]+\b/g) || []),
                ]
                const radioSourceIds = referencedIds.filter((id) => {
                  const sourceControl = controlLookup.get(String(id))
                  const sourceType = String(sourceControl?.type || sourceControl?.properties?.controlType || "").toLowerCase()
                  return sourceType === "radio" || sourceType === "optionbutton"
                })
                if (radioSourceIds.length > 0) {
                  const referencedValues = {}
                  referencedIds.forEach((id) => {
                    referencedValues[id] = allFormValuesForRules?.[id]
                  })
                  logCrfRule("info", "radio_rule_eval_trace", {
                    ruleId: rule.id,
                    ruleName: rule.ruleName || rule.name,
                    category,
                    targetId,
                    expression,
                    conditionMetForTarget,
                    radioSourceIds,
                    referencedValues,
                    source: "ecrf-data-entry:radio-rule-trace",
                  })
                }
              }
              if (shouldTraceRule(rule?.id) && !conditionMetForTarget) {
                logCrfRule("info", "rule_trace_condition", {
                  ruleId: rule.id,
                  targetId,
                  expression,
                  conditionMetForTarget,
                  sourceValueSnapshot: allFormValuesForRules,
                })
              }
            const targetControl = allControls.find(c => String(c?.id || "").trim() === String(targetId || "").trim())
            if (targetControl) {
              const currentEvaluated = getEvaluatedControl(targetId) || targetControl
              const ruleAction = applyRuleAction(rule, targetControl, conditionMetForTarget)
              const staticDesignerReadonly = isDesignerReadonly(targetControl?.properties)
              if (!controlsToUpdate[targetId]) {
                controlsToUpdate[targetId] = {
                  ...currentEvaluated,
                  properties: { ...currentEvaluated.properties }
                }
              }
              // Restrictive Wins merge — see mergeRulePropsRestrictively in
              // ruleEvaluator.js. When two CRF-level rules target the same
              // field (e.g. via "Also applies to" overlap), each rule's
              // `ruleAction` contains both fired-true assertions and
              // side-effect false defaults. A shallow spread used to let
              // the later rule's `readonly: false` clobber the earlier
              // rule's `readonly: true`; this helper OR-merges restrictive
              // booleans so any true assertion sticks.
              controlsToUpdate[targetId].properties = mergeRulePropsRestrictively(
                controlsToUpdate[targetId].properties,
                ruleAction,
                { ruleCategory: category },
              )
              if (staticDesignerReadonly) {
                controlsToUpdate[targetId].properties.readonly = true
              }
              if (isCrfRuleVerbose()) {
                logCrfRule("log", "rule_action_applied", {
                  ruleId: rule.id,
                  ruleCategory: rule.category || rule.ruleCategory,
                  targetFieldId: targetId,
                  conditionMet: conditionMetForTarget,
                  action: ruleAction,
                  ruleExpression: rule.expression || rule.ruleExpression,
                })
              }
              if (shouldTraceRadioRules) {
                const referencedIds = [
                  ...new Set(String(expression || "").match(/\bctrl_[A-Za-z0-9_]+\b/g) || []),
                ]
                const radioSourceIds = referencedIds.filter((id) => {
                  const sourceControl = controlLookup.get(String(id))
                  const sourceType = String(sourceControl?.type || sourceControl?.properties?.controlType || "").toLowerCase()
                  return sourceType === "radio" || sourceType === "optionbutton"
                })
                if (radioSourceIds.length > 0) {
                  logCrfRule("info", "radio_rule_action_trace", {
                    ruleId: rule.id,
                    targetId,
                    conditionMetForTarget,
                    readonlyAfterApply: controlsToUpdate[targetId]?.properties?.readonly,
                    hiddenAfterApply: controlsToUpdate[targetId]?.properties?.hidden,
                    radioSourceIds,
                    source: "ecrf-data-entry:radio-rule-action",
                  })
                }
              }
            } else {
              // Table cell-level target (e.g. ctrl_table_row_0_col_1): apply action on parent table as cell override.
              const rowColMatch = String(targetId).match(/^(.*)_row_(\d+)_col_(\d+)$/)
              if (!rowColMatch) {
                logCrfRule("warn", "rule_target_not_found", {
                  ruleId: rule.id,
                  targetFieldId: targetId,
                  hint: "No control with this id on the form section; rule action was skipped.",
                })
                return
              }
              const tableId = rowColMatch[1]
              const rowIdx = parseInt(rowColMatch[2], 10)
              const colIdx = parseInt(rowColMatch[3], 10)
              const tableControl = allControls.find(c => c.id === tableId && String(c.type || "").toLowerCase() === "table")
              if (!tableControl || Number.isNaN(rowIdx) || Number.isNaN(colIdx)) {
                logCrfRule("warn", "rule_table_cell_unresolved", {
                  ruleId: rule.id,
                  targetFieldId: targetId,
                  tableId,
                  rowIdx,
                  colIdx,
                })
                return
              }

              const currentEvaluatedTable = getEvaluatedControl(tableId) || tableControl
              // Evaluate enable/disable semantics against the concrete target cell id, not parent table id.
              // This prevents "whole table trigger" behavior while still producing cell-level readonly/hidden.
              const syntheticTargetCellControl = {
                ...currentEvaluatedTable,
                id: targetId,
                type: "table-cell",
              }
              const ruleAction = applyRuleAction(rule, syntheticTargetCellControl, conditionMetForTarget)
              if (!controlsToUpdate[tableId]) {
                controlsToUpdate[tableId] = {
                  ...currentEvaluatedTable,
                  properties: { ...currentEvaluatedTable.properties }
                }
              }

              const cellKey = `${rowIdx}_${colIdx}`
              const existingCellMap = controlsToUpdate[tableId].properties.tableCellRuleProps || {}
              const nextCellMap = { ...existingCellMap }
              const prevCellProps = nextCellMap[cellKey] || {}
              // Restrictive Wins merge for cell-level rule outcomes:
              // If ANY rule in this pass marks a cell readonly / hidden /
              // conditionallyRequired = true, that wins. Non-firing rules
              // emitting `false` must never lower the bar. This mirrors
              // mergeRulePropsRestrictively used for whole-control props
              // and matches standard EDC semantics.
              const mergedReadonly =
                ruleAction.readonly !== undefined
                  ? mergeRestrictiveBooleanProp(prevCellProps.readonly, ruleAction.readonly, {
                      ruleCategory: category,
                      propKey: "readonly",
                    })
                  : Boolean(prevCellProps.readonly)
              const mergedHidden =
                ruleAction.hidden !== undefined
                  ? mergeRestrictiveBooleanProp(prevCellProps.hidden, ruleAction.hidden, {
                      ruleCategory: category,
                      propKey: "hidden",
                    })
                  : Boolean(prevCellProps.hidden)
              const mergedConditionallyRequired =
                ruleAction.conditionallyRequired !== undefined
                  ? Boolean(prevCellProps.conditionallyRequired) || Boolean(ruleAction.conditionallyRequired)
                  : Boolean(prevCellProps.conditionallyRequired)
              nextCellMap[cellKey] = {
                ...prevCellProps,
                ...(ruleAction.readonly !== undefined ? { readonly: mergedReadonly } : {}),
                ...(ruleAction.hidden !== undefined ? { hidden: mergedHidden } : {}),
                ...(ruleAction.conditionallyRequired !== undefined ? { conditionallyRequired: mergedConditionallyRequired } : {}),
                ...(ruleAction.requiredIfMessage !== undefined ? { requiredIfMessage: ruleAction.requiredIfMessage } : {}),
              }
              if (shouldDeepTraceRule(rule?.id)) {
                deepTraceLog("table_cell_action", {
                  ruleId: rule?.id,
                  tableId,
                  cellKey,
                  conditionMetForTarget,
                  ruleAction,
                  prevCellProps,
                  nextCellProps: nextCellMap[cellKey],
                }, `cell_action|${String(rule?.id ?? "")}|${String(tableId)}|${String(cellKey)}|${String(conditionMetForTarget)}`)
              }
              if (shouldTraceRule(rule?.id) && !conditionMetForTarget) {
                logCrfRule("info", "rule_trace_cell_action", {
                  ruleId: rule.id,
                  tableId,
                  cellKey,
                  conditionMetForTarget,
                  ruleAction,
                  previousCellProps: prevCellProps,
                  nextCellProps: nextCellMap[cellKey],
                })
              }
              controlsToUpdate[tableId].properties = {
                ...controlsToUpdate[tableId].properties,
                tableCellRuleProps: nextCellMap,
              }
            }
            if (isRuleSubmitBlocking && ruleMessageText) {
              // Date restriction rule expressions are authored as "VALID when conditionMet is true".
              // So we must emit the blocking message only when conditionMet is false.
              const isDateRestriction =
                ruleMessageCategory === "date_restriction" || isDateRestrictionRule(rule)
              const shouldEmitBlockingMessage = isDateRestriction
                ? !conditionMetForTarget
                : ruleMessageCategory === "submit" || ruleMessageCategory === "retro"
                  ? !conditionMetForTarget
                  : Boolean(conditionMetForTarget)
              if (shouldEmitBlockingMessage) {
                const targetKey = String(targetId || "base")
                if (!pushedRuleMessageKeys.has(targetKey)) {
                  pushedRuleMessageKeys.add(targetKey)
                  messages.push({
                    ruleId: rule.id,
                    message: replaceFieldIdsWithLabels(ruleMessageText, fieldLabelMap),
                    severity: rule.severity || "SOFT",
                    category: isDateRestriction
                      ? "date_restriction"
                      : (rule.category || rule.ruleCategory),
                    isDateRestriction,
                    targetField: targetId || rule.targetField || rule.targetFields || null,
                  })
                }
              }
            }
            })
          }

          // Handle Compute Action rules: evaluate numeric result and write to target field(s)
          // Do not gate compute on evaluateRule truthiness: ternary mappings return "" when no branch
          // matches, and Boolean("") is false — that would skip safeEvaluateCompute entirely.
          if (category === "compute" && targetIds.length > 0) {
            const computeSourceIds = [
              ...new Set(String(rule.expression || rule.ruleExpression || "").match(/\bctrl_[A-Za-z0-9_]+\b/g) || []),
            ]
            const computedValueRaw = safeEvaluateCompute(
              rule.expression || rule.ruleExpression,
              allFormValuesForRules,
              fieldLabelMap,
              {
                rule,
                allControls,
                targetIds,
              }
            )

            // Allow compute rules to write BOTH numeric and string results.
            // Previously we blocked non-numeric strings via Number.isNaN(...) which broke select/text autofill.
            const isValidComputeResult =
              computedValueRaw != null &&
              !(
                typeof computedValueRaw === "number" &&
                Number.isNaN(computedValueRaw)
              )
            logComputeRuleDebug("compute_eval_result", {
              ruleId: rule?.id ?? rule?.__syntheticRuleKey ?? null,
              targetIds,
              source: rule?.__fromControlRule ? "control.properties.rules" : "crfDesign.rules",
              sourceSnapshot: computeSourceIds.map((sid) => ({
                id: sid,
                present: Object.prototype.hasOwnProperty.call(allFormValuesForRules || {}, sid),
                value: allFormValuesForRules?.[sid],
              })),
              computedValueRaw,
              computedType: typeof computedValueRaw,
              isValidComputeResult,
            })

            if (isValidComputeResult) {
              const computedValuesByTarget = {}
              targetIds.forEach((id) => {
                const targetControl = allControls.find((c) => c.id === id)
                computedValuesByTarget[id] = normalizeComputedValueForTargetControl(computedValueRaw, targetControl)
              })

              // Check if any target field actually needs updating to avoid infinite loops.
              let needsUpdate = false
              targetIds.forEach(id => {
                const currentFlatValue = currentFormData[id]
                const currentRuleValue = allFormValuesForRules[id]
                const nextValue = computedValuesByTarget[id]
                if (currentFlatValue !== nextValue || currentRuleValue !== nextValue) {
                  needsUpdate = true
                }
              })
              logComputeRuleDebug("compute_apply_decision", {
                ruleId: rule?.id ?? rule?.__syntheticRuleKey ?? null,
                targetIds,
                needsUpdate,
                nextValues: computedValuesByTarget,
              })

              if (!needsUpdate) {
                // Nothing changed; skip updates to prevent re-triggering this effect.
                // Still continue to next rule.
              } else {
                // Update formData so UI shows the computed value.
                // Guard against infinite loops by only updating when value actually changes.
                setFormData(prev => {
                  const currentForForm = prev[selectedForm.id] || {}
                  let changed = false
                  const nextForForm = { ...currentForForm }
                  targetIds.forEach(id => {
                    const nextValue = computedValuesByTarget[id]
                    if (nextForForm[id] !== nextValue) {
                      nextForForm[id] = nextValue
                      changed = true
                    }
                  })
                  if (!changed) {
                    return prev
                  }
                  return { ...prev, [selectedForm.id]: nextForForm }
                })

                // Inform rule engine about the new value so subsequent rules see it
                targetIds.forEach(id => {
                  updateRuleFormValue(id, computedValuesByTarget[id])
                })
              }
            }
          }
          
          // For blocking categories, messages are emitted per evaluated target above
          // so dynamic table rows are handled independently.
        } catch (error) {
          console.error(`Error evaluating CRF-level rule ${rule.id}:`, error)
        }
      })

      // Note: The useRuleEvaluation hook will automatically re-evaluate when formData changes
      // CRF-level rules are applied above and will be merged when the hook re-runs
      // The evaluated controls will be updated in the next render cycle
      
      setCrfRuleMessages((prev) => {
        try {
          if (JSON.stringify(prev) === JSON.stringify(messages)) return prev
        } catch {
          /* ignore */
        }
        return messages
      })
      setCrfRuleControlOverrides((prev) => {
        const slimNext = slimCrfRuleControlOverrides(controlsToUpdate)
        const prevSig = stableStringifyRuleOverrides(prev)
        const nextSig = stableStringifyRuleOverrides(slimNext)
        logEcrfPerf("rule_overrides_update", {
          runId,
          changed: prevSig !== nextSig,
          nextControlCount: Object.keys(slimNext || {}).length,
        })
        return prevSig === nextSig ? prev : slimNext
      })
      const runEndedAt =
        typeof performance !== "undefined" && performance.now
          ? performance.now()
          : Date.now()
      logEcrfPerf("rule_cycle_end", {
        runId,
        durationMs: Math.round(runEndedAt - runStartedAt),
        messageCount: messages.length,
      })
      // Clear after CRF-level rule pass; both control-level and CRF-level have consumed this change-set.
      dataEntryRuleDirtyKeysRef.current = null
    }
    run()
    return () => {
      cancelled = true
    }
    // Do not call validateAllControls from this effect (even via queueMicrotask): it updates
    // validation state while rule-derived props are still settling and can cause "Maximum update depth"
    // when combined with rapid scroll/re-render. Full-form validation is debounced separately below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedForm?.id, deferredRuleFormData, currentFormSections.length, crfDesignRuleDependencyIndex])

  // Debounced full-form validation after values + CRF overrides settle (avoids update-depth loops).
  useEffect(() => {
    const form = selectedFormRef.current
    if (!form?.id || !form.section?.controls?.length) return
    const tid = window.setTimeout(() => {
      const f = selectedFormRef.current
      if (!f?.id || f.id !== form.id || !f.section?.controls?.length) return
      const slice = formDataRef.current[f.id]
      if (!slice || typeof slice !== "object" || Object.keys(slice).length === 0) return
      validateAllControlsRef.current?.(f, slice)
    }, 320)
    return () => window.clearTimeout(tid)
  }, [selectedForm?.id, formData, crfOverridesValidationSig])

  // When a control is hidden by rule, clear its stored value(s) so stale data does not reappear
  // when user toggles conditions back (especially dynamic table rows/cells).
  // Only clear on hidden transitions — NOT on the first rule pass after form load (bootstrap),
  // otherwise persisted API values are wiped while controls are still visible.
  useEffect(() => {
    if (!selectedForm?.id) {
      previouslyHiddenForClearRef.current = { formId: null, layoutKey: null, hiddenIds: null }
      return
    }
    const displaySections =
      selectedForm.crfDesign?.sections?.length > 0
        ? selectedForm.crfDesign.sections
        : selectedForm.section
          ? [selectedForm.section]
          : []
    const allControls = displaySections.flatMap((s) => s.controls || [])
    if (!Array.isArray(allControls) || allControls.length === 0) return

    const currentlyHidden = new Set(
      allControls
        .filter((control) => {
          const evaluated = getRuleAwareControl(control)
          return Boolean(evaluated?.properties?.hidden)
        })
        .map((control) => control.id),
    )

    const prevClearSnapshot = previouslyHiddenForClearRef.current
    const sameClearContext =
      prevClearSnapshot.formId === selectedForm.id &&
      prevClearSnapshot.layoutKey === formSectionLayoutKey
    previouslyHiddenForClearRef.current = {
      formId: selectedForm.id,
      layoutKey: formSectionLayoutKey,
      hiddenIds: currentlyHidden,
    }
    if (!sameClearContext || prevClearSnapshot.hiddenIds == null) return

    const newlyHiddenControlIds = []
    currentlyHidden.forEach((controlId) => {
      if (!prevClearSnapshot.hiddenIds.has(controlId)) newlyHiddenControlIds.push(controlId)
    })
    if (newlyHiddenControlIds.length === 0) return

    logEcrfPerf("hidden_controls_detected", {
      count: newlyHiddenControlIds.length,
      sample: newlyHiddenControlIds.slice(0, 6),
    })

    setFormData((prev) => {
      const currentForForm = prev[selectedForm.id] || {}
      if (!currentForForm || Object.keys(currentForForm).length === 0) return prev
      const nextForForm = { ...currentForForm }
      let changed = false

      newlyHiddenControlIds.forEach((controlId) => {
        Object.keys(nextForForm).forEach((k) => {
          if (k === controlId || k.startsWith(`${controlId}_`)) {
            delete nextForForm[k]
            changed = true
          }
        })
      })

      if (!changed) return prev
      return { ...prev, [selectedForm.id]: nextForForm }
    })

    setValidationErrors((prev) => {
      const errsForForm = prev?.[selectedForm.id] || {}
      if (!errsForForm || Object.keys(errsForForm).length === 0) return prev
      const nextErrs = { ...errsForForm }
      let changed = false
      newlyHiddenControlIds.forEach((controlId) => {
        Object.keys(nextErrs).forEach((k) => {
          if (k === controlId || k.startsWith(`${controlId}_`)) {
            delete nextErrs[k]
            changed = true
          }
        })
      })
      if (!changed) return prev
      return { ...prev, [selectedForm.id]: nextErrs }
    })
  }, [selectedForm?.id, formSectionLayoutKey, crfOverridesValidationSig, getRuleAwareControl])

  // Counterpart to the "clear-on-hide" effect above: when a control with a
  // designer-configured default value transitions from rule-HIDDEN to
  // rule-VISIBLE, re-apply the designer default so pre-filled
  // text/number/date guidance survives hide -> show cycles.
  //
  // Why transition-based (and not "every cycle"): firing setFormData on
  // every rule cycle re-runs the rule pipeline, which re-fires this
  // effect, which under rapid radio clicks compounds with Radix's
  // composed-ref chain (TooltipTrigger > button > Slot) and trips
  // React's "Maximum update depth exceeded" guard (the runaway
  // safelyDetachRef -> setRef -> dispatchSetState loop). By gating on
  // an actual hidden -> visible transition we limit setFormData to the
  // rare frame where it is semantically needed; steady state = zero
  // writes.
  //
  // Why this is needed at all: the clear-on-hide effect intentionally
  // deletes any formData entry for rule-hidden controls. Without this
  // counterpart, the default applied at form-load time is permanently
  // lost on the first rule-driven hide, leaving the field empty when
  // later revealed.
  //
  // Safety:
  //  - Only operates on controls that JUST became visible this cycle
  //    (never resurrects values on still-hidden or unchanged-visible
  //    fields, including user-entered values).
  //  - Only fills slots whose existing value is null / undefined / empty
  //    (user-entered values are preserved by onlyMissing:true).
  //  - Discrete option control types (radio/checkbox/select/dropdown) are
  //    already skipped inside applyDesignerDefaultValues, so this cannot
  //    revive the "Yes by default" regression.
  //  - Uses applyDesignerDefaultValues directly (not the row-count
  //    hydrator) so dynamic-table row counts remain stable mid-session.
  //  - Wraps the setFormData inside startTransition so the resulting
  //    render is deprioritized; urgent radio-click commits stay ahead
  //    of the queue.
  useEffect(() => {
    if (!selectedForm?.id) {
      previouslyHiddenControlIdsRef.current = { formId: null, layoutKey: null, hiddenIds: null }
      return
    }
    const displaySections =
      selectedForm.crfDesign?.sections?.length > 0
        ? selectedForm.crfDesign.sections
        : selectedForm.section
          ? [selectedForm.section]
          : []
    if (!Array.isArray(displaySections) || displaySections.length === 0) return

    const allControls = displaySections.flatMap((s) => s.controls || [])
    if (allControls.length === 0) return

    // Build the CURRENT hidden set from the latest rule evaluation.
    const currentlyHidden = new Set()
    allControls.forEach((control) => {
      const evaluated = getRuleAwareControlRef.current?.(control) || control
      if (evaluated?.properties?.hidden) currentlyHidden.add(control.id)
    })

    // Snapshot the previous-cycle's hidden set, then immediately update
    // the ref so the NEXT cycle compares against the right baseline.
    const prevSnapshot = previouslyHiddenControlIdsRef.current
    const sameContext =
      prevSnapshot.formId === selectedForm.id &&
      prevSnapshot.layoutKey === formSectionLayoutKey
    previouslyHiddenControlIdsRef.current = {
      formId: selectedForm.id,
      layoutKey: formSectionLayoutKey,
      hiddenIds: currentlyHidden,
    }
    // First run on this (form, layout) — no transitions to detect; we
    // only seeded the ref for the next cycle.
    if (!sameContext || prevSnapshot.hiddenIds == null) return

    // Find controls that WERE hidden last cycle but are visible now.
    const newlyVisibleIds = []
    prevSnapshot.hiddenIds.forEach((id) => {
      if (!currentlyHidden.has(id)) newlyVisibleIds.push(id)
    })
    if (newlyVisibleIds.length === 0) return

    // Build a sections payload filtered to ONLY newly-visible controls so
    // applyDesignerDefaultValues touches no other field.
    const newlyVisibleSet = new Set(newlyVisibleIds)
    const newlyVisibleSections = displaySections.map((section) => ({
      ...section,
      controls: (section.controls || []).filter((c) => newlyVisibleSet.has(c.id)),
    }))
    const newlyVisibleFormShape = {
      ...selectedForm,
      crfDesign: selectedForm.crfDesign
        ? { ...selectedForm.crfDesign, sections: newlyVisibleSections }
        : selectedForm.crfDesign,
      section: newlyVisibleSections[0],
    }

    startTransition(() => {
      setFormData((current) => {
        const currentForForm = current[selectedForm.id] || {}
        const withDefaults = applyDesignerDefaultValues(
          { ...currentForForm },
          newlyVisibleFormShape,
          { onlyMissing: true },
        )
        let changed = false
        for (const key of Object.keys(withDefaults)) {
          if (withDefaults[key] !== currentForForm[key]) {
            changed = true
            break
          }
        }
        if (!changed) return current
        logEcrfPerf("rule_show_reapply_defaults", {
          formId: selectedForm.id,
          newlyVisibleIds,
          appliedKeys: Object.keys(withDefaults).filter(
            (k) => withDefaults[k] !== currentForForm[k],
          ),
        })
        return { ...current, [selectedForm.id]: withDefaults }
      })
    })
  }, [selectedForm?.id, formSectionLayoutKey, crfOverridesValidationSig])

  // When a control/cell becomes rule-readonly, clear stored value(s) so stale
  // selections do not remain after a rule transition. Readonly fields must still
  // DISPLAY persisted values on load — bootstrap pass only seeds the snapshot.
  useEffect(() => {
    if (!selectedForm?.id) {
      previouslyRuleReadonlyControlIdsRef.current = {
        formId: null,
        layoutKey: null,
        readonlyIds: null,
        tableCellIds: null,
      }
      return
    }
    if (!crfRuleControlOverrides || typeof crfRuleControlOverrides !== "object") return

    const rawControlsById = new Map(
      (currentFormSections?.flatMap((s) => s.controls || []) ||
        selectedForm?.section?.controls ||
        []
      ).map((c) => [String(c?.id || ""), c]),
    )

    const currentlyReadonlyIds = new Set()
    const currentlyReadonlyTableCellIds = new Set()

    Object.entries(crfRuleControlOverrides).forEach(([controlId, override]) => {
      const props = override?.properties || {}
      if (props.readonly === true) {
        const rawControl = rawControlsById.get(String(controlId))
        if (!isDesignerReadonly(rawControl?.properties)) {
          currentlyReadonlyIds.add(controlId)
        }
      }
      const cellMap = props.tableCellRuleProps
      if (!cellMap || typeof cellMap !== "object") return
      Object.entries(cellMap).forEach(([cellKey, cellProps]) => {
        if (!cellProps || cellProps.readonly !== true) return
        const m = String(cellKey).match(/^(\d+)_(\d+)$/)
        if (!m) return
        const rowIdx = Number(m[1])
        const colIdx = Number(m[2])
        if (Number.isNaN(rowIdx) || Number.isNaN(colIdx)) return
        currentlyReadonlyTableCellIds.add(`${controlId}_row_${rowIdx}_col_${colIdx}`)
      })
    })

    const prevReadonlySnapshot = previouslyRuleReadonlyControlIdsRef.current
    const sameReadonlyContext =
      prevReadonlySnapshot.formId === selectedForm.id &&
      prevReadonlySnapshot.layoutKey === formSectionLayoutKey
    previouslyRuleReadonlyControlIdsRef.current = {
      formId: selectedForm.id,
      layoutKey: formSectionLayoutKey,
      readonlyIds: currentlyReadonlyIds,
      tableCellIds: currentlyReadonlyTableCellIds,
    }
    if (!sameReadonlyContext || prevReadonlySnapshot.readonlyIds == null) return

    const newlyReadonlyControlIds = []
    currentlyReadonlyIds.forEach((controlId) => {
      if (!prevReadonlySnapshot.readonlyIds.has(controlId)) newlyReadonlyControlIds.push(controlId)
    })
    const newlyReadonlyTableCellIds = []
    currentlyReadonlyTableCellIds.forEach((cellId) => {
      if (!prevReadonlySnapshot.tableCellIds?.has(cellId)) newlyReadonlyTableCellIds.push(cellId)
    })

    if (newlyReadonlyControlIds.length === 0 && newlyReadonlyTableCellIds.length === 0) return

    logEcrfPerf("disabled_controls_detected", {
      controlCount: newlyReadonlyControlIds.length,
      tableCellCount: newlyReadonlyTableCellIds.length,
      sampleControls: newlyReadonlyControlIds.slice(0, 4),
      sampleCells: newlyReadonlyTableCellIds.slice(0, 4),
    })

    setFormData((prev) => {
      const currentForForm = prev[selectedForm.id] || {}
      if (!currentForForm || Object.keys(currentForForm).length === 0) return prev
      const nextForForm = { ...currentForForm }
      let changed = false

      newlyReadonlyControlIds.forEach((controlId) => {
        Object.keys(nextForForm).forEach((k) => {
          if (k === controlId || k.startsWith(`${controlId}_`)) {
            delete nextForForm[k]
            changed = true
          }
        })
      })

      newlyReadonlyTableCellIds.forEach((cellId) => {
        if (Object.prototype.hasOwnProperty.call(nextForForm, cellId)) {
          delete nextForForm[cellId]
          changed = true
        }
      })

      if (!changed) return prev
      return { ...prev, [selectedForm.id]: nextForForm }
    })

    setValidationErrors((prev) => {
      const errsForForm = prev?.[selectedForm.id] || {}
      if (!errsForForm || Object.keys(errsForForm).length === 0) return prev
      const nextErrs = { ...errsForForm }
      let changed = false

      newlyReadonlyControlIds.forEach((controlId) => {
        Object.keys(nextErrs).forEach((k) => {
          if (k === controlId || k.startsWith(`${controlId}_`)) {
            delete nextErrs[k]
            changed = true
          }
        })
      })

      newlyReadonlyTableCellIds.forEach((cellId) => {
        if (Object.prototype.hasOwnProperty.call(nextErrs, cellId)) {
          delete nextErrs[cellId]
          changed = true
        }
      })

      if (!changed) return prev
      return { ...prev, [selectedForm.id]: nextErrs }
    })
  }, [
    selectedForm?.id,
    formSectionLayoutKey,
    crfRuleControlOverrides,
    currentFormSections,
    selectedForm?.section?.controls,
  ])

  // When a source date changes (date restriction rules), clear dependent date values
  // that are now outside min/max bounds so stale invalid dates are not retained.
  // Applies to both normal date controls and table date cells.
  useEffect(() => {
    if (!selectedForm?.id) return
    const allControls = currentFormSections?.flatMap((s) => s.controls || []) || []
    if (allControls.length === 0) return

    const dateControls = allControls.filter((control) =>
      String(control?.type || "").toLowerCase().includes("date")
    )
    const tableControls = allControls.filter(
      (control) => String(control?.type || "").toLowerCase() === "table"
    )
    if (dateControls.length === 0 && tableControls.length === 0) return

    const currentForForm = currentFormData || {}
    const outOfRangeControlIds = []
    const outOfRangeTableCellIds = []
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`

    const mapTableSourceFieldId = (tableId, rowIdx, sourceFieldId) => {
      const normalizedSource = String(sourceFieldId || "").trim()
      if (!normalizedSource) return ""
      const mappedRowCell = normalizedSource.replace(
        new RegExp(`^${tableId}_row_\\d+_`),
        `${tableId}_row_${rowIdx}_`
      )
      const legacyColMatch = normalizedSource.match(new RegExp(`^${tableId}__col_(\\d+)$`))
      if (legacyColMatch) {
        const legacyColIdx = Number(legacyColMatch[1])
        if (!Number.isNaN(legacyColIdx)) {
          return `${tableId}_row_${rowIdx}_col_${legacyColIdx}`
        }
      }
      return mappedRowCell
    }

    dateControls.forEach((control) => {
      const evaluatedControl = getRuleAwareControl(control)
      const props = evaluatedControl?.properties || {}
      const controlId = control?.id
      if (!controlId) return
      if (props.readonly === true || props.hidden === true) return

      if (!parseDateInterval(currentForForm[controlId])) return

      const dateRestriction =
        props.dateRestriction ||
        (props.currentDateOnly
          ? "onlyToday"
          : props.allowPastDates === false
            ? "allowFuture"
            : props.allowFutureDates === false
              ? "allowPast"
              : "")

      let minBound = resolveBoundIso(props.minDate, "min")
      let maxBound = resolveBoundIso(props.maxDate, "max")
      const dynamicMinBound = resolveBoundIso(
        currentForForm[String(props.minDateFromFieldId || "").trim()],
        "min",
      )
      const dynamicMaxBound = resolveBoundIso(
        currentForForm[String(props.maxDateFromFieldId || "").trim()],
        "max",
      )
      if (dynamicMinBound) minBound = dynamicMinBound
      if (dynamicMaxBound) maxBound = dynamicMaxBound

      if (dateRestriction === "allowPast") {
        maxBound = maxBound || todayStr
      } else if (dateRestriction === "allowFuture") {
        minBound = minBound || todayStr
      } else if (dateRestriction === "onlyToday") {
        minBound = todayStr
        maxBound = todayStr
      }

      const isBeforeMin = Boolean(minBound) && violatesMinDateBound(currentForForm[controlId], minBound)
      const isAfterMax = Boolean(maxBound) && violatesMaxDateBound(currentForForm[controlId], maxBound)
      if (isBeforeMin || isAfterMax) {
        outOfRangeControlIds.push(controlId)
      }
    })

    tableControls.forEach((tableControl) => {
      const evaluatedTable = getRuleAwareControl(tableControl)
      const tableProps = evaluatedTable?.properties || {}
      const tableId = tableControl?.id
      if (!tableId) return
      if (tableProps.readonly === true || tableProps.hidden === true) return

      const designRows = Math.max(1, Number(tableProps.rows || 1))
      const addRowEnabled = tableProps.addRow === true
      const maxRows = Math.max(designRows, parseInt(tableProps.maxRows, 10) || 10)
      const rowCountKey = `${tableId}_rowCount`
      const currentRowCount = Math.max(1, parseInt(currentForForm[rowCountKey], 10) || designRows)
      const numRows = addRowEnabled ? Math.min(currentRowCount, maxRows) : designRows

      const columnTypes = Array.isArray(tableProps.columnTypes) ? tableProps.columnTypes : []
      const columnDateRestrictions = Array.isArray(tableProps.columnDateRestrictions)
        ? tableProps.columnDateRestrictions
        : []
      const tableMinFromList = Array.isArray(tableProps.columnDateMinFromField)
        ? tableProps.columnDateMinFromField
        : []
      const tableMaxFromList = Array.isArray(tableProps.columnDateMaxFromField)
        ? tableProps.columnDateMaxFromField
        : []
      const tableCellMinFromMap =
        tableProps.tableCellDateMinFromField &&
        typeof tableProps.tableCellDateMinFromField === "object"
          ? tableProps.tableCellDateMinFromField
          : {}
      const tableCellMaxFromMap =
        tableProps.tableCellDateMaxFromField &&
        typeof tableProps.tableCellDateMaxFromField === "object"
          ? tableProps.tableCellDateMaxFromField
          : {}
      const cellRuleProps =
        tableProps.tableCellRuleProps && typeof tableProps.tableCellRuleProps === "object"
          ? tableProps.tableCellRuleProps
          : {}

      for (let rowIdx = 0; rowIdx < numRows; rowIdx += 1) {
        for (let colIdx = 0; colIdx < columnTypes.length; colIdx += 1) {
          const colType = String(columnTypes[colIdx] || "").toLowerCase()
          if (!colType.includes("date")) continue

          const cellKey = `${rowIdx}_${colIdx}`
          const templateCellKey = addRowEnabled && rowIdx >= designRows ? `0_${colIdx}` : cellKey
          const cellId = `${tableId}_row_${rowIdx}_col_${colIdx}`
          const cellProps = cellRuleProps[cellKey] || {}
          if (cellProps.readonly === true || cellProps.hidden === true) continue

          if (!parseDateInterval(currentForForm[cellId])) continue

          const dateRestriction =
            columnDateRestrictions[colIdx] ||
            tableProps.dateRestriction ||
            (tableProps.currentDateOnly
              ? "onlyToday"
              : tableProps.allowPastDates === false
                ? "allowFuture"
                : tableProps.allowFutureDates === false
                  ? "allowPast"
                  : "")

          let minBound = resolveBoundIso(tableProps.minDate, "min")
          let maxBound = resolveBoundIso(tableProps.maxDate, "max")
          const rawMinSourceId =
            tableCellMinFromMap[cellKey] ||
            tableCellMinFromMap[templateCellKey] ||
            tableMinFromList[colIdx] ||
            ""
          const rawMaxSourceId =
            tableCellMaxFromMap[cellKey] ||
            tableCellMaxFromMap[templateCellKey] ||
            tableMaxFromList[colIdx] ||
            ""
          const mappedMinSourceId = mapTableSourceFieldId(tableId, rowIdx, rawMinSourceId)
          const mappedMaxSourceId = mapTableSourceFieldId(tableId, rowIdx, rawMaxSourceId)
          const dynamicMinBound =
            mappedMinSourceId && mappedMinSourceId !== cellId
              ? resolveBoundIso(currentForForm[mappedMinSourceId], "min")
              : ""
          const dynamicMaxBound =
            mappedMaxSourceId && mappedMaxSourceId !== cellId
              ? resolveBoundIso(currentForForm[mappedMaxSourceId], "max")
              : ""
          if (dynamicMinBound) minBound = dynamicMinBound
          if (dynamicMaxBound) maxBound = dynamicMaxBound

          if (dateRestriction === "allowPast") {
            maxBound = maxBound || todayStr
          } else if (dateRestriction === "allowFuture") {
            minBound = minBound || todayStr
          } else if (dateRestriction === "onlyToday") {
            minBound = todayStr
            maxBound = todayStr
          }

          const isBeforeMin = Boolean(minBound) && violatesMinDateBound(currentForForm[cellId], minBound)
          const isAfterMax = Boolean(maxBound) && violatesMaxDateBound(currentForForm[cellId], maxBound)
          if (isBeforeMin || isAfterMax) {
            outOfRangeTableCellIds.push(cellId)
          }
        }
      }
    })

    if (outOfRangeControlIds.length === 0 && outOfRangeTableCellIds.length === 0) return

    setFormData((prev) => {
      const prevSlice = prev[selectedForm.id] || {}
      let changed = false
      const nextSlice = { ...prevSlice }
      outOfRangeControlIds.forEach((controlId) => {
        if (nextSlice[controlId] !== "") {
          nextSlice[controlId] = ""
          changed = true
        }
      })
      outOfRangeTableCellIds.forEach((cellId) => {
        if (nextSlice[cellId] !== "") {
          nextSlice[cellId] = ""
          changed = true
        }
      })
      if (!changed) return prev
      return {
        ...prev,
        [selectedForm.id]: nextSlice,
      }
    })

    setValidationErrors((prev) => {
      const errsForForm = prev?.[selectedForm.id] || {}
      if (!errsForForm || Object.keys(errsForForm).length === 0) return prev
      const nextErrs = { ...errsForForm }
      let changed = false
      outOfRangeControlIds.forEach((controlId) => {
        if (Object.prototype.hasOwnProperty.call(nextErrs, controlId)) {
          delete nextErrs[controlId]
          changed = true
        }
      })
      outOfRangeTableCellIds.forEach((cellId) => {
        if (Object.prototype.hasOwnProperty.call(nextErrs, cellId)) {
          delete nextErrs[cellId]
          changed = true
        }
      })
      if (!changed) return prev
      return { ...prev, [selectedForm.id]: nextErrs }
    })
  }, [selectedForm?.id, currentFormSections, currentFormData, getRuleAwareControl])

  /** True when this flat/cell field key has an open manual or system query assigned to the current user. */
  const canInlineEditControlForOpenAssignedQuery = useCallback(
    (controlKey) => {
      if (!canWorkOnQueries) return false
      const key = String(controlKey || "").trim()
      if (!key) return false
      const uid = Number(loggedInUserId)
      if (!Number.isFinite(uid)) return false
      const queries = Array.isArray(crfQueriesFromApi) ? crfQueriesFromApi : []
      for (let i = 0; i < queries.length; i++) {
        const q = queries[i]
        if (!q || isQueryClosedStatus(q.status) || !isQueryOpenStatus(q.status)) continue
        if (!isManualQueryType(q) && !isSystemQueryType(q)) continue
        const qfid = String(q.fieldId || "").trim()
        const qFlatKey = resolveQueryFieldIdToFormFlatKey(qfid)
        if (qfid !== key && qFlatKey !== key) continue
        if (Number(getQueryAssignedToUserId(q)) !== uid) continue
        return true
      }
      return false
    },
    [canWorkOnQueries, crfQueriesFromApi, loggedInUserId],
  )

  // Stable reference for input-change handler.
  //
  // The real implementation below is recreated on every render (so it
  // can capture latest state via closure). Memoised control rows
  // (`MemoizedSingleValueControlRenderer` for radio / checkbox) require a
  // reference-stable callback to avoid forced re-renders. We expose a
  // never-changing wrapper that funnels through this ref so memoisation
  // works AND every invocation still calls the freshest closure.
  const handleFormInputChangeRef = useRef(null)
  const stableOnValueChange = useCallback((fieldId, value) => {
    handleFormInputChangeRef.current?.(fieldId, value)
  }, [])

  // Handle form input changes with real-time validation
  const handleFormInputChange = (controlId, value) => {
    if (!selectedForm) return
    // Flatten sections once per keystroke and reuse — was being computed twice
    // (readonly guard + type fast-path) on every keystroke for large CRFs.
    const flattenedFormControls =
      currentFormSections?.flatMap((s) => s.controls || []) ||
      selectedForm?.section?.controls ||
      []
    const rawControlForGuard = flattenedFormControls.find(
      (c) => String(c?.id || "") === String(controlId || "").trim(),
    )
    if (isDesignerReadonly(rawControlForGuard?.properties)) {
      return
    }
    // Hard guard: permission-locked or submitted-locked users cannot mutate — except assigned submitter
    // correcting a value for their own open manual/system query (same as query popup).
    if (isPermissionLockedForDataEntry) {
      return
    }
    const activeSectionKey = String(
      activeDataEntrySectionId ?? selectedForm?.sectionId ?? selectedForm?.section?.id ?? "",
    )
    if (isControlDbLocked(String(controlId || "").trim(), activeSectionKey)) {
      return
    }
    if (isFormInteractionLocked) {
      if (
        !(
          canTsiEditSubmittedCrf ||
          (isSubmittedFormLocked &&
            canInlineEditControlForOpenAssignedQuery(String(controlId || "").trim()))
        )
      ) {
        return
      }
    }
    const controlKey = String(controlId || "").trim()
    const isInlineQueryCorrectionEdit =
      isSubmittedFormLocked &&
      canInlineEditControlForOpenAssignedQuery(controlKey)
    const changedControlForFastPath = flattenedFormControls.find((c) => c?.id === controlId)
    const changedTypeForFastPath = String(
      getRuleAwareControl(changedControlForFastPath)?.type || changedControlForFastPath?.type || "",
    )
      .trim()
      .toLowerCase()
    const isRadioLikeFastPath =
      changedTypeForFastPath === "radio" || changedTypeForFastPath === "optionbutton"
    const currentFormSlice = formData?.[selectedForm.id] || {}
    const didPrimaryFieldValueChange = currentFormSlice?.[controlId] !== value
    const resetSdvForFields = (fieldIds) => {
      const formId = selectedForm?.id
      const normalizedFieldIds = Array.isArray(fieldIds)
        ? [...new Set(fieldIds.map((fid) => String(fid || "").trim()).filter(Boolean))]
        : []
      if (!formId || normalizedFieldIds.length === 0) return
      setSdvSelectionsByField((prev) => {
        let changed = false
        const next = { ...prev }
        normalizedFieldIds.forEach((fid) => {
          const key = getSdvFieldKey(formId, fid)
          if (!Object.prototype.hasOwnProperty.call(next, key) || next[key] !== false) {
            next[key] = false
            changed = true
          }
        })
        return changed ? next : prev
      })
      setSdvApprovedByField((prev) => {
        let changed = false
        const next = { ...prev }
        normalizedFieldIds.forEach((fid) => {
          const key = getSdvFieldKey(formId, fid)
          if (!Object.prototype.hasOwnProperty.call(next, key) || next[key] !== false) {
            next[key] = false
            changed = true
          }
        })
        if (changed) sdvApprovedByFieldRef.current = next
        return changed ? next : prev
      })
    }

    // Ultra-fast radio path: commit value immediately and skip heavy scans.
    if (isRadioLikeFastPath) {
      if (didPrimaryFieldValueChange) {
        resetSdvForFields([controlId])
        clearAiEntryFlagForField(controlId)
      }
      if (
        controlKey &&
        !controlKey.endsWith("_rowCount") &&
        !controlKey.endsWith("_removeRow") &&
        !isInlineQueryCorrectionEdit
      ) {
        lastAuditTouchedFieldRef.current = {
          formId: selectedForm.id,
          controlId: controlKey,
        }
        setRecentAuditSyncedFields((prev) => {
          if (!prev || typeof prev !== "object") return prev
          if (!Object.prototype.hasOwnProperty.call(prev, controlKey)) return prev
          const next = { ...prev }
          delete next[controlKey]
          return next
        })

        // Keep audit-reason dirty tracking parity with non-radio controls.
        // Without this, radio/optionbutton edits bypass reason capture on save.
        const baseline = formAuditBaselineById?.[selectedForm.id]
        if (baseline?.hasPersistedRecord) {
          const baselineValues = baseline?.values && typeof baseline.values === "object" ? baseline.values : {}
          const prevSlice = formData?.[selectedForm.id] ?? {}

          const baselineOldRaw = baselineValues?.[controlKey]
          const uiOldRaw = prevSlice?.[controlKey]

          const baselineOld = normalizeAuditFieldValue(baselineOldRaw)
          const uiOld = normalizeAuditFieldValue(uiOldRaw)
          const newValue = normalizeAuditFieldValue(value)

          const hasBaselineValue = String(baselineOld ?? "").trim() !== ""
          const effectiveOldValue = hasBaselineValue ? baselineOld : uiOld
          const hasEffectiveOldValue = String(effectiveOldValue ?? "").trim() !== ""

          if (!hasEffectiveOldValue) {
            setAuditLightDirtyById((prev) => {
              if (!prev || typeof prev !== "object") return prev
              if (!Object.prototype.hasOwnProperty.call(prev, controlKey)) return prev
              const next = { ...prev }
              delete next[controlKey]
              return next
            })
          } else {
            // Identity bail: only allocate a new map when the dirty-state actually
            // flips. Without this, every rapid radio click produced a new object
            // even when the boolean was unchanged — which propagated through
            // downstream selectors and contributed to Radix Tooltip ref churn
            // ("Maximum update depth exceeded" during safelyDetachRef).
            const nextDirty = effectiveOldValue !== newValue
            setAuditLightDirtyById((prev) => {
              const prevMap = prev && typeof prev === "object" ? prev : {}
              const prevDirty = Boolean(prevMap[controlKey])
              if (prevDirty === nextDirty && Object.prototype.hasOwnProperty.call(prevMap, controlKey)) {
                return prev
              }
              return { ...prevMap, [controlKey]: nextDirty }
            })
          }
        }
      }
      if (preCapturedAuditReason) setPreCapturedAuditReason("")
      // Paint selection instantly so the radio "selected" frame lands before
      // any heavy rule work — this is the snappy UX win.
      //
      // Identity bail: if the user re-clicks the same value (or rapid-fires the
      // same option), don't allocate a fresh object. New object identity ripples
      // through downstream memos and can cascade Radix Tooltip ref setters into
      // a render storm under high click rate.
      setOptimisticControlValues((prev) => {
        if (prev && prev[controlId] === value) return prev
        return { ...prev, [controlId]: value }
      })

      // Coalesce rapid clicks on the SAME control into a SINGLE commit.
      //
      // Previously every click queued its own `setTimeout(() => startTransition(commit), 0)`,
      // and rapid clicks (50+ in a second on a large CRF) saturated the
      // renderer with backlogged transitions → tab crash ("This page
      // couldn't load"). With per-control coalescing, the latest value
      // is captured in the timer's closure (and refreshed below) so the
      // last click wins, which is the only semantics a radio caller
      // actually expects.
      const commitTimers = radioFastPathCommitTimersRef.current
      const formIdAtScheduleTime = selectedForm.id
      const existing = commitTimers.get(controlId)
      if (existing?.tid != null) {
        existing.latestValue = value
        existing.formId = formIdAtScheduleTime
        return
      }
      const timerEntry = { tid: null, latestValue: value, formId: formIdAtScheduleTime }
      timerEntry.tid = window.setTimeout(() => {
        const nextValue = timerEntry.latestValue
        const targetFormId = timerEntry.formId
        commitTimers.delete(controlId)
        startTransition(() => {
          dataEntryRuleDirtyKeysRef.current = [controlId]
          setFormData((prev) => {
            const prevSlice = prev[targetFormId] || {}
            if (prevSlice[controlId] === nextValue) return prev
            return {
              ...prev,
              [targetFormId]: {
                ...prevSlice,
                [controlId]: nextValue,
              },
            }
          })
          setOptimisticControlValues((prev) => {
            if (!Object.prototype.hasOwnProperty.call(prev, controlId)) return prev
            const next = { ...prev }
            delete next[controlId]
            return next
          })
        })
      }, 0)
      commitTimers.set(controlId, timerEntry)
      return
    }

    if (auditReasonDebugRef.current) {
      try {
        console.log("[AuditReason][input-change]", {
          formId: selectedForm?.id,
          controlId,
          nextValue: value,
          preCapturedAuditReason: String(preCapturedAuditReason || ""),
        })
      } catch {}
    }
    if (
      controlKey &&
      !controlKey.endsWith("_rowCount") &&
      !controlKey.endsWith("_removeRow") &&
      !isInlineQueryCorrectionEdit
    ) {
        lastAuditTouchedFieldRef.current = {
          formId: selectedForm.id,
          controlId: controlKey,
        }

        // If user starts editing again, remove the previous "Synced" success highlight immediately.
        setRecentAuditSyncedFields((prev) => {
          if (!prev || typeof prev !== "object") return prev
          if (!Object.prototype.hasOwnProperty.call(prev, controlKey)) return prev
          const next = { ...prev }
          delete next[controlKey]
          return next
        })

        // Track "dirty" vs persisted baseline for fields that had saved data.
        const baseline = formAuditBaselineById?.[selectedForm.id]
        if (baseline?.hasPersistedRecord) {
          const baselineValues = baseline?.values && typeof baseline.values === "object" ? baseline.values : {}
          const prevSlice = formData?.[selectedForm.id] ?? {}

          const baselineOldRaw = baselineValues?.[controlKey]
          const uiOldRaw = prevSlice?.[controlKey]

          const baselineOld = normalizeAuditFieldValue(baselineOldRaw)
          const uiOld = normalizeAuditFieldValue(uiOldRaw)

          const hasBaselineValue = String(baselineOld ?? "").trim() !== ""
          const effectiveOldValue = hasBaselineValue ? baselineOld : uiOld

          // Only start "light-audit dirty" if the field actually had a non-empty value from persisted data.
          // If baseline key is missing but the UI shows a value, uiOld acts as the persisted baseline signal.
          const hasEffectiveOldValue = String(effectiveOldValue ?? "").trim() !== ""
          if (!hasEffectiveOldValue) {
            setAuditLightDirtyById((prev) => {
              if (!prev || typeof prev !== "object") return prev
              if (!Object.prototype.hasOwnProperty.call(prev, controlKey)) return prev
              const next = { ...prev }
              delete next[controlKey]
              return next
            })
          } else {
            const newValue = normalizeAuditFieldValue(value)
            setAuditLightDirtyById((prev) => ({
              ...prev,
              [controlKey]: effectiveOldValue !== newValue,
            }))
          }
        }
      }
    if (preCapturedAuditReason) setPreCapturedAuditReason("")
    const shouldDebugTableDateDeps = (() => {
      try {
        if (typeof window === "undefined") return false
        return window.localStorage?.getItem("crfTableDateDebug") === "1"
      } catch {
        return false
      }
    })()
    const changeAtMs =
      typeof performance !== "undefined" && performance.now
        ? performance.now()
        : Date.now()
    const uiIntent = ecrfPerfLastUiIntentRef.current || { type: "unknown", atMs: 0, detail: "" }
    logEcrfPerf("input_change", {
      controlId,
      valueType: value == null ? "nullish" : Array.isArray(value) ? "array" : typeof value,
      intentType: uiIntent?.type || "unknown",
      intentDetail: uiIntent?.detail || "",
      sinceIntentMs: uiIntent?.atMs ? Math.round(changeAtMs - uiIntent.atMs) : null,
      valuePreview:
        typeof value === "string"
          ? value.slice(0, 40)
          : typeof value === "number" || typeof value === "boolean"
            ? value
            : value == null
              ? ""
              : "[object]",
    })

    // Dynamic table: remove row (any row except first); shift rows below up
    if (typeof controlId === "string" && controlId.endsWith("_removeRow")) {
      const baseId = controlId.replace(/_removeRow$/, "")
      const rowIndex = parseInt(value, 10)
      if (Number.isNaN(rowIndex) || rowIndex < 1) return // keep at least row 0
      const allControls = currentFormSections?.flatMap((s) => s.controls || []) || selectedForm?.section?.controls || []
      const control = allControls.find((c) => c.id === baseId)
      const numCols = control?.properties?.columns ?? 1
      const fieldsToResetSdv = [baseId]
      const rowCountKey = baseId + "_rowCount"
      const currentCount = Math.max(1, parseInt(currentFormSlice[rowCountKey], 10) || 1)
      for (let r = 0; r < currentCount; r++) {
        for (let col = 0; col < numCols; col++) {
          fieldsToResetSdv.push(`${baseId}_row_${r}_col_${col}`)
        }
      }
      resetSdvForFields(fieldsToResetSdv)
      dataEntryRuleDirtyKeysRef.current = ["*"]
      setFormData((prev) => {
        const form = prev[selectedForm.id] || {}
        const rowCountKey = baseId + "_rowCount"
        const currentCount = Math.max(1, parseInt(form[rowCountKey], 10) || 1)
        if (currentCount <= 1 || rowIndex >= currentCount) return prev
        const next = { ...form }
        next[rowCountKey] = String(currentCount - 1)
        for (let col = 0; col < numCols; col++) {
          delete next[baseId + "_row_" + rowIndex + "_col_" + col]
        }
        for (let r = rowIndex + 1; r < currentCount; r++) {
          for (let col = 0; col < numCols; col++) {
            const fromKey = baseId + "_row_" + r + "_col_" + col
            const toKey = baseId + "_row_" + (r - 1) + "_col_" + col
            next[toKey] = form[fromKey] ?? ""
            delete next[fromKey]
          }
        }
        return { ...prev, [selectedForm.id]: next }
      })
      logEcrfPerf("table_remove_row", {
        controlId,
        rowIndex,
      })
      return
    }

    const immediateTableDependentClears = []
    if (typeof controlId === "string") {
      const cellMatch = controlId.match(/^(.*)_row_(\d+)_col_(\d+)$/)
      if (cellMatch) {
        const tableId = cellMatch[1]
        const rowIdx = Number(cellMatch[2])
        const changedColIdx = Number(cellMatch[3])
        if (!Number.isNaN(rowIdx) && !Number.isNaN(changedColIdx)) {
          const allControls =
            currentFormSections?.flatMap((s) => s.controls || []) ||
            selectedForm?.section?.controls ||
            []
          const tableControl = allControls.find(
            (c) => c.id === tableId && String(c.type || "").toLowerCase() === "table"
          )
          if (tableControl) {
            const evaluatedTable = getRuleAwareControl(tableControl)
            const tableProps = evaluatedTable?.properties || {}
            const columnTypes = Array.isArray(tableProps.columnTypes) ? tableProps.columnTypes : []
            const cellTypes = Array.isArray(tableProps.cellTypes) ? tableProps.cellTypes : []
            const designRows = Math.max(1, Number(tableProps.rows || 1))
            const addRowEnabled = tableProps.addRow === true
            /** Keep in sync with ControlRenderer table `getCellType` (template row + per-cell overrides). */
            const numCols = Math.max(1, Number(tableProps.columns || 1))
            const getResolvedCellTypeForTableCell = (r, c) => {
              const templateRow = addRowEnabled && r >= designRows ? 0 : r
              const cellOverride = cellTypes[templateRow]?.[c]
              if (cellOverride && cellOverride !== "empty") {
                return String(cellOverride).toLowerCase()
              }
              const t = columnTypes[c]
              return String(t && t !== "empty" ? t : "").toLowerCase()
            }
            const tableMinFromList = Array.isArray(tableProps.columnDateMinFromField)
              ? tableProps.columnDateMinFromField
              : []
            const tableMaxFromList = Array.isArray(tableProps.columnDateMaxFromField)
              ? tableProps.columnDateMaxFromField
              : []
            const tableCellMinFromMap =
              tableProps.tableCellDateMinFromField &&
              typeof tableProps.tableCellDateMinFromField === "object"
                ? tableProps.tableCellDateMinFromField
                : {}
            const tableCellMaxFromMap =
              tableProps.tableCellDateMaxFromField &&
              typeof tableProps.tableCellDateMaxFromField === "object"
                ? tableProps.tableCellDateMaxFromField
                : {}
            const changedColType = getResolvedCellTypeForTableCell(rowIdx, changedColIdx)
            const isChangedCellDate = changedColType.includes("date")
            const hasDateDependencyConfig =
              tableMinFromList.some((v) => String(v || "").trim()) ||
              tableMaxFromList.some((v) => String(v || "").trim()) ||
              Object.keys(tableCellMinFromMap).length > 0 ||
              Object.keys(tableCellMaxFromMap).length > 0 ||
              String(tableProps.dateRestriction || "").trim() !== "" ||
              Array.isArray(tableProps.rules)
            if (shouldDebugTableDateDeps) {
              console.log("[TableDateDependency] changed table cell", {
                changedControlId: controlId,
                tableId,
                rowIdx,
                changedColIdx,
                changedColType,
                isChangedCellDate,
                hasDateDependencyConfig,
                tableMinFromList,
                tableMaxFromList,
                tableCellMinFromMap,
                tableCellMaxFromMap,
              })
            }
            const mapSourceFieldIdToRow = (sourceFieldId) => {
              const normalized = String(sourceFieldId || "").trim()
              if (!normalized) return ""
              const mappedRowCell = normalized.replace(
                new RegExp(`^${tableId}_row_\\d+_`),
                `${tableId}_row_${rowIdx}_`
              )
              const legacyColMatch = normalized.match(new RegExp(`^${tableId}__col_(\\d+)$`))
              if (legacyColMatch) {
                const legacyColIdx = Number(legacyColMatch[1])
                if (!Number.isNaN(legacyColIdx)) {
                  return `${tableId}_row_${rowIdx}_col_${legacyColIdx}`
                }
              }
              return mappedRowCell
            }

            for (let colIdx = 0; colIdx < numCols; colIdx += 1) {
              const colType = getResolvedCellTypeForTableCell(rowIdx, colIdx)
              if (!colType.includes("date")) continue
              if (colIdx === changedColIdx) continue
              const cellKey = `${rowIdx}_${colIdx}`
              const templateCellKey = addRowEnabled && rowIdx >= designRows ? `0_${colIdx}` : cellKey
              const targetCellId = `${tableId}_row_${rowIdx}_col_${colIdx}`
              const rawMinSourceId =
                tableCellMinFromMap[cellKey] ||
                tableCellMinFromMap[templateCellKey] ||
                tableMinFromList[colIdx] ||
                ""
              const rawMaxSourceId =
                tableCellMaxFromMap[cellKey] ||
                tableCellMaxFromMap[templateCellKey] ||
                tableMaxFromList[colIdx] ||
                ""
              const mappedMinSourceId = mapSourceFieldIdToRow(rawMinSourceId)
              const mappedMaxSourceId = mapSourceFieldIdToRow(rawMaxSourceId)
              if (shouldDebugTableDateDeps) {
                console.log("[TableDateDependency] evaluate dependent candidate", {
                  changedControlId: controlId,
                  targetCellId,
                  rawMinSourceId,
                  rawMaxSourceId,
                  mappedMinSourceId,
                  mappedMaxSourceId,
                  matchesChangedControl:
                    mappedMinSourceId === controlId,
                })
              }
              // Directional dependency only: clear target when changed source is MIN bound source.
              // Avoid MAX-bound clear here to prevent bi-directional wipes.
              if (mappedMinSourceId === controlId) {
                immediateTableDependentClears.push(targetCellId)
              }
            }

            // Directional behavior only: clear explicit rule-dependent targets.
            // Do not auto-clear sibling date fields when dependency cannot be resolved.
          }
        }
      }
    }

    const immediateNormalDependentClears = []
    if (typeof controlId === "string" && !controlId.includes("_row_")) {
      const allControls =
        currentFormSections?.flatMap((s) => s.controls || []) ||
        selectedForm?.section?.controls ||
        []
      const changedControl = allControls.find((c) => c.id === controlId)
      const changedControlType = String(
        getRuleAwareControl(changedControl)?.type || changedControl?.type || ""
      ).toLowerCase()
      const isChangedControlDate = changedControlType.includes("date")
      if (isChangedControlDate) {
        allControls.forEach((targetControl) => {
          const targetId = targetControl?.id
          if (!targetId || targetId === controlId) return
          if (String(targetId).includes("_row_")) return
          const targetType = String(
            getRuleAwareControl(targetControl)?.type || targetControl?.type || ""
          ).toLowerCase()
          if (!targetType.includes("date")) return
          const targetProps = getRuleAwareControl(targetControl)?.properties || {}
          const minSourceId = String(targetProps.minDateFromFieldId || "").trim()
          // Directional dependency only: source change clears target when source is target MIN source.
          if (minSourceId === controlId) {
            immediateNormalDependentClears.push(targetId)
          }
        })
      }
    }

    const uniqueImmediateTableDependentClears = [...new Set(immediateTableDependentClears)]
    const uniqueImmediateNormalDependentClears = [...new Set(immediateNormalDependentClears)]
    const immediateDependentClears = [
      ...uniqueImmediateTableDependentClears,
      ...uniqueImmediateNormalDependentClears,
    ]
    const uniqueImmediateDependentClears = [...new Set(immediateDependentClears)]
    // Only clear SDV for fields whose stored value actually changes here: primary edit and/or
    // dependent clears. Do not reset the primary cell when only a bogus dependent set fired.
    const sdvResetFieldIds = []
    if (didPrimaryFieldValueChange) sdvResetFieldIds.push(controlId)
    uniqueImmediateDependentClears.forEach((depId) => {
      if (depId && depId !== controlId) sdvResetFieldIds.push(depId)
    })
    if (sdvResetFieldIds.length > 0) {
      resetSdvForFields(sdvResetFieldIds)
    }
    if (shouldDebugTableDateDeps && typeof controlId === "string" && controlId.includes("_row_")) {
      console.log("[TableDateDependency] final dependent clear set", {
        changedControlId: controlId,
        changedValue: value,
        dependentClears: uniqueImmediateTableDependentClears,
      })
    }

    dataEntryRuleDirtyKeysRef.current =
      uniqueImmediateDependentClears.length > 0
        ? [controlId, ...uniqueImmediateDependentClears]
        : [controlId]
    if (didPrimaryFieldValueChange) {
      clearAiEntryFlagForField(controlId)
      uniqueImmediateDependentClears.forEach((depCellId) => clearAiEntryFlagForField(depCellId))
    }
    const nextFormSlice = {
      ...(formData[selectedForm.id] || {}),
      [controlId]: value,
    }
    uniqueImmediateDependentClears.forEach((depCellId) => {
      if (depCellId !== controlId) nextFormSlice[depCellId] = ""
    })

    setFormData((prev) => {
      const prevSlice = prev[selectedForm.id] || {}
      if (prevSlice[controlId] === value) return prev
      return {
        ...prev,
        [selectedForm.id]: (() => {
          const nextSlice = {
            ...prevSlice,
            [controlId]: value,
          }
          uniqueImmediateDependentClears.forEach((depCellId) => {
            if (depCellId !== controlId) nextSlice[depCellId] = ""
          })
          return nextSlice
        })(),
      }
    })
    if (uniqueImmediateDependentClears.length > 0) {
      setValidationErrors((prev) => {
        const prevForForm = prev[selectedForm.id] || {}
        if (Object.keys(prevForForm).length === 0) return prev
        const nextForForm = { ...prevForForm }
        let changed = false
        uniqueImmediateDependentClears.forEach((depCellId) => {
          if (Object.prototype.hasOwnProperty.call(nextForForm, depCellId)) {
            delete nextForForm[depCellId]
            changed = true
          }
        })
        if (!changed) return prev
        return {
          ...prev,
          [selectedForm.id]: nextForForm,
        }
      })
    }
    // Skip scheduling rAF telemetry frames on every keystroke when perf
    // trace is disabled (the default in production). This keeps the
    // keystroke path cheap and removes 2 rAF callbacks per input change.
    if (
      isEcrfPerfTraceEnabled() &&
      typeof window !== "undefined" &&
      window.requestAnimationFrame
    ) {
      window.requestAnimationFrame(() => {
        const firstPaintAt =
          typeof performance !== "undefined" && performance.now
            ? performance.now()
            : Date.now()
        logEcrfPerf("input_to_first_paint", {
          controlId,
          latencyMs: Math.round(firstPaintAt - changeAtMs),
          sinceIntentMs: uiIntent?.atMs ? Math.round(firstPaintAt - uiIntent.atMs) : null,
        })
        window.requestAnimationFrame(() => {
          const settledPaintAt =
            typeof performance !== "undefined" && performance.now
              ? performance.now()
              : Date.now()
          logEcrfPerf("input_to_settled_paint", {
            controlId,
            latencyMs: Math.round(settledPaintAt - changeAtMs),
            sinceIntentMs: uiIntent?.atMs ? Math.round(settledPaintAt - uiIntent.atMs) : null,
          })
        })
      })
    }
    
    // Real-time validation for this control
    if (selectedForm.section?.controls) {
      const control = selectedForm.section.controls.find(c => c.id === controlId)
      if (control) {
        // Get evaluated control (with rules applied)
        const evaluatedControl = getEvaluatedControl(controlId) || control
        const allFormValues = nextFormSlice
        const runValidationUpdate = () => {
          const validation = validateControl(evaluatedControl, value, allFormValues, {
            skipDateRestrictionValidation: true,
            patientGender: selectedPatient?.gender,
          })
          setValidationErrors((prev) => {
            const prevForForm = prev[selectedForm.id] || {}
            const prevErrors = prevForForm[controlId] || []
            const nextErrors = validation.errors || []
            if (JSON.stringify(prevErrors) === JSON.stringify(nextErrors)) return prev
            return {
              ...prev,
              [selectedForm.id]: {
                ...prevForForm,
                [controlId]: nextErrors,
              },
            }
          })
        }
        // Keep text input smooth but responsive while typing.
        // Tighter debounce (40 ms) lets inline error/required feedback feel real-time
        // while still coalescing rapid keystrokes so we never validate per-character.
        const textLikeTypes = new Set(["text", "number", "lab", "textarea"])
        const controlType = String(evaluatedControl?.type || control?.type || "").toLowerCase()
        if (textLikeTypes.has(controlType)) {
          if (realtimeValidationDebounceRef.current) {
            window.clearTimeout(realtimeValidationDebounceRef.current)
          }
          realtimeValidationDebounceRef.current = window.setTimeout(() => {
            runValidationUpdate()
          }, 40)
        } else {
          runValidationUpdate()
        }
      }
    }

    // NOTE: CRF-level rules are evaluated in the form-level effect tied to formData.
    // Avoid re-running the same expensive rule pass here to keep selects/date picks snappy.

    }

  // Keep the always-latest-closure refs wired AFTER commit, never during
  // render.
  //
  // IMPORTANT: this MUST run as a `useLayoutEffect` (or `useEffect`)
  // after commit, NOT inline during render. Writing to a ref during the
  // render phase looks innocent (ref mutations don't re-render the
  // current component), but in React 19 + Strict Mode dev the render
  // phase runs TWICE per commit, and any concurrent component that
  // observes the ref between those two renders (e.g. through a
  // composed-ref / `useImperativeHandle` chain) can see a half-updated
  // value, call `setState` from its ref callback, and we end up in a
  // "Maximum update depth exceeded" loop whose stack looks like
  // `safelyDetachRef → composeRefs.map(setRef) → dispatchSetState → ...`.
  // Under rapid radio clicking on large CRFs that loop manifested as a
  // hard browser-tab crash ("This page couldn't load") because Edge's
  // renderer-watchdog killed the runaway render cycle.
  //
  // `useLayoutEffect` runs synchronously after the DOM is committed but
  // before the browser paints, so all consumers (timers / event handlers
  // / debounced validation that fire AFTER paint) read a fully committed
  // closure.
  useLayoutEffect(() => {
    handleFormInputChangeRef.current = handleFormInputChange
    formDataRef.current = formData
    selectedFormRef.current = selectedForm
    optimisticControlValuesRef.current = optimisticControlValues
    currentFormSectionsRef.current = currentFormSections
    getRuleAwareControlRef.current = getRuleAwareControl
    validateAllControlsRef.current = validateAllControls
  })

  useEffect(() => {
    return () => {
      if (realtimeValidationDebounceRef.current) {
        window.clearTimeout(realtimeValidationDebounceRef.current)
      }
      // Drop any pending coalesced radio commits on unmount so we don't
      // call setState on a stale/unmounted page.
      const commitTimers = radioFastPathCommitTimersRef.current
      if (commitTimers && commitTimers.size > 0) {
        commitTimers.forEach((entry) => {
          if (entry?.tid != null) window.clearTimeout(entry.tid)
        })
        commitTimers.clear()
      }
    }
  }, [])

  const ruleMessageIndex = useMemo(() => {
    const toTargets = (targetField) => {
      if (!targetField) return []
      return Array.isArray(targetField)
        ? targetField.map((v) => String(v).trim()).filter(Boolean)
        : String(targetField).split(",").map((v) => v.trim()).filter(Boolean)
    }
    const addToMapSet = (map, key, message) => {
      const k = String(key || "").trim()
      if (!k || !message) return
      if (!map.has(k)) map.set(k, new Set())
      map.get(k).add(message)
    }

    const softByControl = new Map()
    const softGlobal = new Set()
    const blockingByControl = new Map()
    const blockingByFieldId = new Map()
    const blockingGlobal = new Set()

    ;(crfRuleMessages || []).forEach((msg) => {
      const text = String(msg?.message || "").trim()
      if (!text) return
      const targets = toTargets(msg?.targetField)

      if (isSoftSeverity(msg?.severity)) {
        if (targets.length === 0) {
          softGlobal.add(text)
        } else {
          targets.forEach((targetId) => {
            addToMapSet(softByControl, targetId, text)
            const tableCellMatch = String(targetId).match(/^(.*)_row_\d+_col_\d+$/)
            if (tableCellMatch?.[1]) addToMapSet(softByControl, tableCellMatch[1], text)
          })
        }
      }

      const isBlocking =
        isBlockingSeverity(msg?.severity) &&
        isSubmitBlockingCategory(msg?.category) &&
        !isDateRestrictionCategory(msg?.category) &&
        !Boolean(msg?.isDateRestriction)
      if (!isBlocking) return
      if (targets.length === 0) {
        blockingGlobal.add(text)
      } else {
        targets.forEach((targetId) => {
          addToMapSet(blockingByFieldId, targetId, text)
          addToMapSet(blockingByControl, targetId, text)
          const tableCellMatch = String(targetId).match(/^(.*)_row_\d+_col_\d+$/)
          if (tableCellMatch?.[1]) addToMapSet(blockingByControl, tableCellMatch[1], text)
        })
      }
    })

    return {
      softByControl,
      softGlobal,
      blockingByControl,
      blockingByFieldId,
      blockingGlobal,
    }
  }, [
    crfRuleMessages,
    isSoftSeverity,
    isBlockingSeverity,
    isSubmitBlockingCategory,
    isDateRestrictionCategory,
  ])

  const activeSectionNormalizedForRanges = useMemo(() => {
    const list = sectionsWithContentForDataEntry || []
    if (!list.length) return normalizeCrfSection(null)
    const eff =
      activeDataEntrySectionId && list.some((s) => String(s?.id) === String(activeDataEntrySectionId))
        ? activeDataEntrySectionId
        : list[0]?.id
    const sec = list.find((s) => String(s?.id) === String(eff || ""))
    return normalizeCrfSection(sec)
  }, [sectionsWithContentForDataEntry, activeDataEntrySectionId])

  const [labFacilityEntryOverrideBySectionId, setLabFacilityEntryOverrideBySectionId] = useState({})
  const [dataEntryLabOptions, setDataEntryLabOptions] = useState([])
  const [dataEntryLabsLoading, setDataEntryLabsLoading] = useState(false)

  const dataEntryHasLabSection = useMemo(
    () =>
      (sectionsWithContentForDataEntry || []).some(
        (s) => normalizeCrfSection(s).sectionType === SECTION_TYPE_LAB,
      ),
    [sectionsWithContentForDataEntry],
  )

  useEffect(() => {
    setLabFacilityEntryOverrideBySectionId({})
  }, [selectedForm?.id])

  useEffect(() => {
    if (!dataEntryHasLabSection) return
    let cancelled = false
    ;(async () => {
      setDataEntryLabsLoading(true)
      try {
        const res = await labManagementService.getLabsDropdown()
        if (cancelled) return
        const items = mapDropdownItems(res).filter((x) => x.id !== undefined && x.id !== null)
        setDataEntryLabOptions(items.map((x) => ({ id: String(x.id), name: String(x.name || "") })))
      } catch {
        if (!cancelled) setDataEntryLabOptions([])
      } finally {
        if (!cancelled) setDataEntryLabsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [dataEntryHasLabSection, selectedForm?.id])

  const labFacilityEntryBindingChange = useCallback((normalizedSection, next) => {
    const sid = normalizedSection?.id != null ? String(normalizedSection.id) : ""
    if (!sid) return
    const designIdRaw = normalizedSection.labBinding?.labFacilityId
    const designStr = designIdRaw != null && String(designIdRaw).trim() !== "" ? String(designIdRaw).trim() : ""
    const nextIdRaw = next?.labFacilityId
    const nextStr = nextIdRaw != null && String(nextIdRaw).trim() !== "" ? String(nextIdRaw).trim() : ""

    setLabFacilityEntryOverrideBySectionId((prev) => {
      const copy = { ...prev }
      if (nextStr === "" || nextStr === designStr) {
        delete copy[sid]
        return copy
      }
      copy[sid] = {
        labFacilityId: nextStr,
        labFacilityLabel: typeof next?.labFacilityLabel === "string" ? next.labFacilityLabel.trim() : "",
      }
      return copy
    })
  }, [])

  /** Resolved facility for active section — entry override wins, else design-time binding */
  const labFacilityIdForEntryRanges = useMemo(() => {
    if (activeSectionNormalizedForRanges.sectionType !== SECTION_TYPE_LAB) return ""
    const sid = activeSectionNormalizedForRanges.id != null ? String(activeSectionNormalizedForRanges.id) : ""
    const o = sid ? labFacilityEntryOverrideBySectionId[sid] : null
    const fromOv = o?.labFacilityId
    const fid =
      fromOv != null && String(fromOv).trim() !== ""
        ? String(fromOv).trim()
        : activeSectionNormalizedForRanges.labBinding?.labFacilityId
    return fid != null && String(fid).trim() !== "" ? String(fid).trim() : ""
  }, [activeSectionNormalizedForRanges, labFacilityEntryOverrideBySectionId])

  const [labRangeRowsForEntry, setLabRangeRowsForEntry] = useState([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (!labFacilityIdForEntryRanges) {
        setLabRangeRowsForEntry([])
        return
      }
      const raw = labFacilityIdForEntryRanges
      const n = Number(raw)
      const labIdArg = Number.isFinite(n) && String(n) === raw ? n : raw
      try {
        const res = await labManagementService.getLabRangeAssignmentsList(1, 2000, labIdArg, null, true)
        if (cancelled) return
        if (res.isSuccess && res.data) {
          setLabRangeRowsForEntry(Array.isArray(res.data.items) ? res.data.items : [])
        } else {
          setLabRangeRowsForEntry([])
        }
      } catch {
        if (!cancelled) setLabRangeRowsForEntry([])
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [labFacilityIdForEntryRanges])

  const patientLabRangeContext = useMemo(() => {
    if (!selectedPatient) return null
    return {
      gender: selectedPatient.gender ?? selectedPatient.Gender,
      age: selectedPatient.age ?? selectedPatient.Age,
      dateOfBirth:
        selectedPatient.dateOfBirth ?? selectedPatient.DateOfBirth ?? selectedPatient.dob ?? selectedPatient.DOB,
    }
  }, [selectedPatient])

  const getSoftWarningsForControl = useCallback(
    (controlId, currentValue, propertiesForLab = null) => {
      const normalizedValue = typeof currentValue === "string" ? currentValue.trim() : currentValue
      if (normalizedValue === "" || normalizedValue === null || normalizedValue === undefined) return []
      const scoped = ruleMessageIndex.softByControl.get(String(controlId || "").trim()) || new Set()
      let merged = [...new Set([...ruleMessageIndex.softGlobal, ...scoped])]
      const labId = propertiesForLab?.labTestId ?? propertiesForLab?.LabTestId
      if (
        labId &&
        String(labId).trim() !== "" &&
        labFacilityIdForEntryRanges &&
        labRangeRowsForEntry.length &&
        patientLabRangeContext
      ) {
        const extras = getLabNumericRangeSoftWarnings(
          propertiesForLab,
          currentValue,
          labRangeRowsForEntry,
          patientLabRangeContext,
        )
        merged = [...new Set([...merged, ...extras])]
      }
      return merged
    },
    [
      ruleMessageIndex,
      labFacilityIdForEntryRanges,
      labRangeRowsForEntry,
      patientLabRangeContext,
    ],
  )

  /** Table cells: keyed `${row}_${col}`, values are warning strings (lab reference range hints). */
  const buildLabSoftWarningsForTableControl = useCallback(
    (tableControlEvaluated, tp, renderedRowCount) => {
      const out = {}
      if (
        activeSectionNormalizedForRanges.sectionType !== SECTION_TYPE_LAB ||
        !labFacilityIdForEntryRanges ||
        !labRangeRowsForEntry.length ||
        !patientLabRangeContext
      ) {
        return out
      }
      const p = tp || {}
      const cellLabTestIds = Array.isArray(p.cellLabTestIds) ? p.cellLabTestIds : []
      const numCols = Math.max(1, Number(p.columns || 1))
      const columnTypes = Array.isArray(p.columnTypes) ? p.columnTypes : []
      const cellTypes = Array.isArray(p.cellTypes) ? p.cellTypes : []
      const designRows = Math.max(1, Number(p.rows || 1))
      const addRow = p.addRow === true
      const rowCountKey = `${tableControlEvaluated?.id}_rowCount`
      const fv = typeof currentRenderFormValues === "object" && currentRenderFormValues ? currentRenderFormValues : {}
      const rowCountFromForm = addRow ? parseInt(fv[rowCountKey], 10) : NaN
      const fallbackRows =
        addRow && !Number.isNaN(rowCountFromForm) && rowCountFromForm > 0
          ? Math.max(designRows, rowCountFromForm)
          : designRows
      const numRows =
        renderedRowCount != null && Number(renderedRowCount) > 0 ? Number(renderedRowCount) : fallbackRows
      const getCellTypeLocal = (rowIdx, colIdx) => {
        const templateRow = addRow && rowIdx >= designRows ? 0 : rowIdx
        const cellOverride = cellTypes[templateRow]?.[colIdx]
        if (cellOverride && cellOverride !== "empty") return String(cellOverride).toLowerCase()
        const ct = columnTypes[colIdx]
        return ct && ct !== "empty" ? String(ct).toLowerCase() : "text"
      }
      for (let r = 0; r < numRows; r += 1) {
        for (let c = 0; c < numCols; c += 1) {
          const ct = getCellTypeLocal(r, c)
          if (!["text", "number", "lab"].includes(ct)) continue
          const tidRaw = cellLabTestIds[r]?.[c]
          if (tidRaw == null || String(tidRaw).trim() === "") continue
          const fieldId = `${tableControlEvaluated.id}_row_${r}_col_${c}`
          const cellVal = fv[fieldId]
          const msgs = getLabNumericRangeSoftWarnings({ labTestId: tidRaw }, cellVal, labRangeRowsForEntry, patientLabRangeContext)
          if (msgs.length) out[`${r}_${c}`] = msgs
        }
      }
      return out
    },
    [
      activeSectionNormalizedForRanges,
      labFacilityIdForEntryRanges,
      labRangeRowsForEntry,
      patientLabRangeContext,
      currentRenderFormValues,
    ],
  )

  const getBlockingRuleErrorsForControl = (controlId, currentValue) => {
    const normalizedValue = typeof currentValue === "string" ? currentValue.trim() : currentValue
    if (normalizedValue === "" || normalizedValue === null || normalizedValue === undefined) return []
    const scoped = ruleMessageIndex.blockingByControl.get(String(controlId || "").trim()) || new Set()
    return [...new Set([...ruleMessageIndex.blockingGlobal, ...scoped])]
  }

  const getBlockingRuleErrorsForFieldId = (fieldId) => {
    const fid = String(fieldId || "").trim()
    if (!fid) return []
    return [...(ruleMessageIndex.blockingByFieldId.get(fid) || new Set())]
  }

  // All controls from all sections (for AI field descriptions)
  const allFormControlsForAI = useMemo(() => {
    if (!currentFormSections?.length) return []
    return currentFormSections.flatMap((s) => s.controls || [])
  }, [currentFormSections])

  const aiFieldDescriptions = useMemo(
    () => geminiService.buildFieldDescriptions(allFormControlsForAI),
    [allFormControlsForAI]
  )

  const activeSectionControlsForAI = useMemo(() => {
    const sections = sectionsWithContentForDataEntry
    if (!sections?.length) return allFormControlsForAI
    const effectiveActiveId =
      activeDataEntrySectionId && sections.some((s) => String(s?.id) === String(activeDataEntrySectionId))
        ? activeDataEntrySectionId
        : sections[0]?.id
    const activeSection = sections.find((s) => String(s?.id) === String(effectiveActiveId)) ?? sections[0]
    const controls = activeSection?.controls || []
    return controls.length > 0 ? controls : allFormControlsForAI
  }, [sectionsWithContentForDataEntry, activeDataEntrySectionId, allFormControlsForAI])

  const aiQuestionsFromControls = useMemo(
    () => geminiService.buildAiQuestionsFromControls(activeSectionControlsForAI),
    [activeSectionControlsForAI]
  )

  useEffect(() => {
    if (!isEcrfPerfTraceEnabled()) return
    logEcrfPerf("session_start", {
      pathname: typeof window !== "undefined" ? window.location?.pathname : "",
    })
    const onKeyDown = (event) => {
      const nowMs = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()
      const detail = `${event?.key || ""}`.slice(0, 24)
      ecrfPerfLastUiIntentRef.current = { type: "keyboard", atMs: nowMs, detail }
      logEcrfPerf("ui_intent", {
        source: "keyboard",
        key: detail,
      })
    }
    const onPointerDown = (event) => {
      const nowMs = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()
      const detail = `${event?.target?.tagName || "unknown"}`.slice(0, 24)
      ecrfPerfLastUiIntentRef.current = { type: "mouse", atMs: nowMs, detail }
      logEcrfPerf("ui_intent", {
        source: "mouse",
        targetTag: detail,
      })
    }
    const onScroll = () => {
      const now = Date.now()
      if (now - ecrfPerfLastScrollLogRef.current < 220) return
      ecrfPerfLastScrollLogRef.current = now
      logEcrfPerf("scroll", {
        y: typeof window !== "undefined" ? window.scrollY : 0,
      })
    }
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", onKeyDown, true)
      window.addEventListener("pointerdown", onPointerDown, true)
      window.addEventListener("scroll", onScroll, { passive: true })
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("keydown", onKeyDown, true)
        window.removeEventListener("pointerdown", onPointerDown, true)
        window.removeEventListener("scroll", onScroll)
      }
      logEcrfPerf("session_end")
    }
  }, [logEcrfPerf])

  // Questions for NER: prefer form-schema from Tatva API (old contract), else use field descriptions (converted to questions in service)
  const nerQuestions = aiQuestionsFromControls.length
    ? aiQuestionsFromControls
    : formSchemaQuestions?.length
      ? formSchemaQuestions
      : aiFieldDescriptions

  // Fetch form-schema when studyId is available (for NER old API alignment)
  useEffect(() => {
    if (!studyId || !isAIMode) return
    let cancelled = false
    geminiService.getFormSchema(studyId).then(({ isSuccess, questions }) => {
      if (!cancelled && isSuccess && Array.isArray(questions) && questions.length > 0) {
        setFormSchemaQuestions(questions)
      } else if (!cancelled) {
        setFormSchemaQuestions(null)
      }
    })
    return () => { cancelled = true }
  }, [studyId, isAIMode])

  // Apply AI-extracted data to form (batch merge into formData, then validate).
  // Same gates as manual entry: locked forms cannot fill; audit dirty + validation still apply.
  const handleAIFillFormData = useCallback(
    (extractedData, meta = {}) => {
      if (!selectedForm || isFormInteractionLocked) return
      if (!extractedData || typeof extractedData !== "object") return
      const expanded = geminiService.expandAiExtractedDataForControls(
        extractedData,
        allFormControlsForAI,
      )
      const normalized = geminiService.remapAiTableDataToPreferredControls(
        expanded,
        allFormControlsForAI,
        activeSectionControlsForAI.map((c) => c?.id).filter(Boolean),
      )
      if (Object.keys(normalized).length === 0) return
      dataEntryRuleDirtyKeysRef.current = ["*"]
      const formId = selectedForm.id
      const prevSlice = formData[formId] || {}
      const merged = { ...prevSlice, ...normalized }
      setFormData((prev) => ({
        ...prev,
        [formId]: merged,
      }))
      Object.keys(normalized).forEach((controlId) => updateRuleFormValue(controlId, normalized[controlId]))
      if (selectedForm.section?.controls && validateAllControls) {
        validateAllControls(selectedForm, merged)
      }

      const baseline = formAuditBaselineById?.[formId]
      if (baseline?.hasPersistedRecord) {
        const baselineValues =
          baseline?.values && typeof baseline.values === "object" ? baseline.values : {}
        setAuditLightDirtyById((prev) => {
          const next = { ...(prev && typeof prev === "object" ? prev : {}) }
          let changed = false
          Object.keys(normalized).forEach((fieldId) => {
            const controlKey = String(fieldId || "").trim()
            if (!controlKey || controlKey.endsWith("_rowCount") || controlKey.endsWith("_removeRow")) {
              return
            }
            const baselineOld = normalizeAuditFieldValue(baselineValues?.[controlKey])
            const uiOld = normalizeAuditFieldValue(prevSlice?.[controlKey])
            const hasBaselineValue = String(baselineOld ?? "").trim() !== ""
            const effectiveOldValue = hasBaselineValue ? baselineOld : uiOld
            const hasEffectiveOldValue = String(effectiveOldValue ?? "").trim() !== ""
            if (!hasEffectiveOldValue) {
              if (Object.prototype.hasOwnProperty.call(next, controlKey)) {
                delete next[controlKey]
                changed = true
              }
              return
            }
            const newValue = normalizeAuditFieldValue(normalized[fieldId])
            const nextDirty = effectiveOldValue !== newValue
            if (next[controlKey] !== nextDirty) {
              next[controlKey] = nextDirty
              changed = true
            }
          })
          return changed ? next : prev
        })
        if (preCapturedAuditReason) setPreCapturedAuditReason("")
      }

      const entryType = resolveCrfAiEntryTypeFromMode(meta?.mode)
      if (entryType) {
        const flag = markAiEntry(entryType)
        const nextFlags = { ...aiEntryFlagsByFieldIdRef.current }
        const nextHighlight = {}
        Object.keys(normalized).forEach((fieldId) => {
          const key = getSdvFieldKey(formId, fieldId)
          if (!key || key.startsWith("::") || key.endsWith("::")) return
          nextFlags[key] = flag
          nextHighlight[key] = true
        })
        aiEntryFlagsByFieldIdRef.current = nextFlags
        setAiSessionHighlightByFieldId((prev) => ({ ...prev, ...nextHighlight }))
      }
    },
    [
      selectedForm,
      isFormInteractionLocked,
      formData,
      formAuditBaselineById,
      normalizeAuditFieldValue,
      preCapturedAuditReason,
      updateRuleFormValue,
      validateAllControls,
      allFormControlsForAI,
      activeSectionControlsForAI,
      getSdvFieldKey,
    ]
  )

  const openAiReviewModal = useCallback(
    (extractedData, meta = {}) => {
      if (!selectedForm || isFormInteractionLocked) return
      const expanded = geminiService.expandAiExtractedDataForControls(
        extractedData,
        allFormControlsForAI,
      )
      const normalized = geminiService.remapAiTableDataToPreferredControls(
        expanded,
        allFormControlsForAI,
        activeSectionControlsForAI.map((c) => c?.id).filter(Boolean),
      )
      if (Object.keys(normalized).length === 0) return
      const suggestions = buildCaptureAiSuggestions(
        normalized,
        allFormControlsForAI,
        meta?.rawResponseItems,
      )
      setAiReviewSuggestions(suggestions)
      setAiReviewSourceSnippet(meta?.transcription || meta?.sourceSnippet || "")
      setAiReviewMeta({ normalized, ...meta })
      setAiReviewMode(true)
      setShowAIFillModal(true)
    },
    [
      selectedForm,
      isFormInteractionLocked,
      allFormControlsForAI,
      activeSectionControlsForAI,
    ],
  )

  const applyAiReviewSelection = useCallback(
    async (selectedRows, acceptedAll = false) => {
      if (!aiReviewMeta?.normalized || !selectedRows?.length) {
        setAiReviewMode(false)
        setShowAIFillModal(false)
        setAiReviewSuggestions([])
        return
      }
      const patch = {}
      selectedRows.forEach((row) => {
        if (row?.fieldId != null && aiReviewMeta.normalized[row.fieldId] !== undefined) {
          patch[row.fieldId] = aiReviewMeta.normalized[row.fieldId]
        }
      })
      handleAIFillFormData(patch, aiReviewMeta)

      const entityId = selectedForm?.crfDataId ?? selectedForm?.id ?? null
      const formId = selectedForm?.id

      const recordRow = async (row, accepted) => {
        if (!studyId || !row?.fieldId) return
        try {
          const res = await xemusAiService.recordCaptureAcceptance({
            studyId: Number(studyId),
            fieldId: row.fieldId,
            accepted,
            confidence: row.confidence,
            entityId: entityId ? Number(entityId) : undefined,
          })
          const logId = res?.data?.id ?? res?.data?.Id
          if (accepted && logId && formId) {
            const key = getSdvFieldKey(formId, row.fieldId)
            if (key && !key.startsWith("::") && !key.endsWith("::")) {
              const prev = aiEntryFlagsByFieldIdRef.current[key] || {}
              aiEntryFlagsByFieldIdRef.current[key] = {
                ...prev,
                isAiBasedEntry: true,
                aiConfidence: row.confidence,
                aiSuggestionLogId: logId,
              }
            }
          }
        } catch {
          /* non-blocking audit */
        }
      }

      if (studyId) {
        await Promise.allSettled(selectedRows.map((row) => recordRow(row, true)))
        if (!acceptedAll && aiReviewSuggestions.length > selectedRows.length) {
          const rejected = aiReviewSuggestions.filter(
            (s) => !selectedRows.some((r) => r.fieldId === s.fieldId),
          )
          await Promise.allSettled(rejected.map((row) => recordRow(row, false)))
        }
      }

      setAiReviewMode(false)
      setShowAIFillModal(false)
      setAiReviewSuggestions([])
      setAiReviewMeta(null)
      toast({
        title: "AI fields applied",
        description: `${selectedRows.length} field(s) merged into the form.`,
        variant: "success",
      })
    },
    [aiReviewMeta, aiReviewSuggestions, handleAIFillFormData, selectedForm, studyId],
  )

  const handleAiReviewReject = useCallback(async () => {
    if (studyId && aiReviewSuggestions.length) {
      const entityId = selectedForm?.crfDataId ?? selectedForm?.id ?? null
      await Promise.allSettled(
        aiReviewSuggestions.map((row) =>
          xemusAiService.recordCaptureAcceptance({
            studyId: Number(studyId),
            fieldId: row.fieldId,
            accepted: false,
            confidence: row.confidence,
            entityId: entityId ? Number(entityId) : undefined,
          }),
        ),
      )
    }
    setAiReviewMode(false)
    setShowAIFillModal(false)
    setAiReviewSuggestions([])
    setAiReviewMeta(null)
  }, [aiReviewSuggestions, selectedForm, studyId])

  // Voice: MediaRecorder → audio blob → NER API (audio_file + questions) → apply to form
  const handleVoiceFill = useCallback(async () => {
    if (!selectedForm || isSubmittedFormLocked) return
    setAiError("")

    const hasMedia = typeof window !== "undefined" && navigator.mediaDevices && navigator.mediaDevices.getUserMedia
    if (!hasMedia) {
      setAiError("Microphone access is not supported in this browser.")
      return
    }

    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop()
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop())
        mediaStreamRef.current = null
      }
      mediaRecorderRef.current = null
      setIsRecording(false)
      setShowRecordingModal(false)
      return
    }

    audioChunksRef.current = []
    recordingStartTimeRef.current = Date.now()
    recordingPausedTotalRef.current = 0
    recordingSubmitOnEndRef.current = false
    setRecordingElapsed(0)
    setIsPaused(false)
    setShowRecordingModal(true)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mpeg"
      const recorder = new MediaRecorder(stream, { mimeType })

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop())
          mediaStreamRef.current = null
        }
        mediaRecorderRef.current = null
        setIsRecording(false)
        setShowRecordingModal(false)

        if (!recordingSubmitOnEndRef.current) return
        const chunks = audioChunksRef.current
        if (!chunks.length) {
          setAiError("No audio recorded. Please try again.")
          return
        }
        const blob = new Blob(chunks, { type: mimeType })
        setAiError("")
        setAiProcessingMode("voice")
        setAiLoading(true)
        setTimeout(async () => {
          try {
            const result = await geminiService.extractFormDataFromAudioBlob(blob, nerQuestions)
            if (result.isSuccess && result.data) {
              openAiReviewModal(result.data, {
                mode: "voice",
                transcription: result.transcription,
                timings: result.timings,
                rawResponseItems: result.rawResponseItems,
              })
            } else {
              setAiError(result.message || "Could not extract form data from audio.")
            }
          } catch (e) {
            setAiError(e?.message || "Voice fill failed.")
          } finally {
            setAiLoading(false)
          }
        }, 0)
      }

      recorder.onerror = (e) => {
        setAiError("Recording error. Please try again.")
      }

      mediaRecorderRef.current = recorder
      recorder.start(1000)
      setIsRecording(true)
    } catch (err) {
      setShowRecordingModal(false)
      setAiError(err?.name === "NotAllowedError" ? "Microphone access denied." : "Could not access microphone.")
    }
  }, [selectedForm, isSubmittedFormLocked, isRecording, nerQuestions, openAiReviewModal])

  // Timer for recording modal (exclude paused duration)
  useEffect(() => {
    if (!showRecordingModal || !isRecording || isPaused) return
    const interval = setInterval(() => {
      const elapsed = Math.floor(
        (Date.now() - recordingStartTimeRef.current - recordingPausedTotalRef.current) / 1000
      )
      setRecordingElapsed(elapsed)
    }, 1000)
    return () => clearInterval(interval)
  }, [showRecordingModal, isRecording, isPaused])

  const handleRecordingSend = useCallback(() => {
    recordingSubmitOnEndRef.current = true
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const handleRecordingPause = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause()
      recordingPausedAtRef.current = Date.now()
      setIsPaused(true)
    }
  }, [])

  const handleRecordingResume = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      recordingPausedTotalRef.current += Date.now() - recordingPausedAtRef.current
      mediaRecorderRef.current.resume()
      setIsPaused(false)
    }
  }, [])

  const handleRecordingClose = useCallback(() => {
    recordingSubmitOnEndRef.current = false
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop()
      } catch (_) {}
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop())
      mediaStreamRef.current = null
    }
    mediaRecorderRef.current = null
    setIsRecording(false)
    setShowRecordingModal(false)
  }, [])

  // Open AI modal and start voice (when user clicks "Start Speaking" in modal)
  const handleStartSpeakingFromModal = useCallback(() => {
    setShowAIFillModal(false)
    handleVoiceFill()
  }, [handleVoiceFill])

  const MAX_UPLOAD_MB = 10
  const ACCEPT_UPLOAD = ".pdf,.png,.jpeg,.jpg,.jpe,image/png,image/jpeg,image/jpg,application/pdf"

  // Upload file: validate and send to NER, then fill form (used by both input and drag-drop)
  const processUploadFile = useCallback(
    async (file) => {
      if (!file || !selectedForm || isSubmittedFormLocked) return
      const maxBytes = MAX_UPLOAD_MB * 1024 * 1024
      if (file.size > maxBytes) {
        setAiError(`File size must be under ${MAX_UPLOAD_MB}MB.`)
        return
      }
      const allowed = ["application/pdf", "image/png", "image/jpeg", "image/jpg"]
      if (!allowed.includes(file.type) && !/\.(pdf|png|jpe?g)$/i.test(file.name)) {
        setAiError("Please upload PDF, PNG, JPEG or JPG only.")
        return
      }
      setShowAIFillModal(false)
      setAiError("")
      setAiProcessingMode("upload")
      setAiLoading(true)
      // Defer API call so React commits loading state and processing overlay shows
      setTimeout(async () => {
        try {
          const result = await geminiService.extractFormDataFromFile(file, nerQuestions)
          if (result.isSuccess && result.data) {
            openAiReviewModal(result.data, {
              mode: "upload",
              timings: result.timings,
              rawResponseItems: result.rawResponseItems,
            })
          } else {
            setAiError(result.message || "Could not extract form data from file.")
          }
        } catch (err) {
          setAiError(err?.message || "Upload fill failed.")
        } finally {
          setAiLoading(false)
        }
      }, 0)
    },
    [selectedForm, isSubmittedFormLocked, nerQuestions, openAiReviewModal]
  )

  const handleUploadFill = useCallback(
    (e) => {
      const file = e?.target?.files?.[0]
      if (file) processUploadFile(file)
      e.target.value = ""
    },
    [processUploadFile]
  )

  const handleUploadDrop = useCallback(
    (e) => {
      e.preventDefault()
      setUploadDragActive(false)
      const file = e.dataTransfer?.files?.[0]
      if (file) processUploadFile(file)
    },
    [processUploadFile]
  )
  const handleUploadDragOver = useCallback((e) => {
    e.preventDefault()
    setUploadDragActive(true)
  }, [])
  const handleUploadDragLeave = useCallback((e) => {
    e.preventDefault()
    setUploadDragActive(false)
  }, [])

  // Normalize API formData into flat { controlId: value } for input binding.
  // Supports:
  // - Nested: { section_1: { ctrl_x: { value: "26", label: "Age" } } }
  // - Flat:   { ctrl_x: "26" } OR { ctrl_x: { value: "26", label: "Age" } }
  const flattenCrfFormData = (rawFormData) => {
    if (!rawFormData) return {}

    let parsed = rawFormData
    try {
      if (typeof parsed === "string") parsed = JSON.parse(parsed)
    } catch {
      return {}
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}

    const result = {}
    const absorbControlValue = (controlId, rawValue) => {
      const key = String(controlId || "").trim()
      if (!key.startsWith("ctrl_")) return
      if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue) && rawValue.value !== undefined) {
        const vv = rawValue.value
        result[key] = typeof vv === "string" ? decodeHtmlEntities(vv) : vv
      } else if (rawValue !== null && rawValue !== undefined) {
        result[key] = typeof rawValue === "string" ? decodeHtmlEntities(rawValue) : rawValue
      }
    }

    Object.keys(parsed).forEach((topKey) => {
      const entry = parsed[topKey]
      if (String(topKey).startsWith("ctrl_")) {
        absorbControlValue(topKey, entry)
        return
      }
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return
      Object.keys(entry).forEach((controlId) => {
        absorbControlValue(controlId, entry[controlId])
      })
    })

    return result
  }

  // When loading saved JSON: set _rowCount for dynamic tables from saved row keys if not present (so row count restores per user).
  const deriveDynamicTableRowCounts = (flatData, form) => {
    if (!flatData || typeof flatData !== "object") return flatData
    const sections = form?.crfDesign?.sections && Array.isArray(form.crfDesign.sections) && form.crfDesign.sections.length > 0
      ? form.crfDesign.sections
      : (form?.section?.controls?.length ? [form.section] : [])
    const controls = sections.flatMap((s) => s.controls || [])
    controls.forEach((control) => {
      if (control.type !== "table" || !control.properties?.addRow) return
      const cid = control.id
      if (!cid) return
      const rowCountKey = cid + "_rowCount"
      if (flatData[rowCountKey] != null && flatData[rowCountKey] !== "") return
      let maxRow = -1
      Object.keys(flatData).forEach((k) => {
        const m = k.match(new RegExp("^" + cid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "_row_(\\d+)_col_"))
        if (m) maxRow = Math.max(maxRow, parseInt(m[1], 10))
      })
      flatData[rowCountKey] = String(maxRow + 1)
    })
    return flatData
  }

  const hydrateFormDataWithDesignerDefaults = useCallback((flatData, form, { onlyMissing = false } = {}) => {
    if (!form) return flatData || {}
    const withDefaults = applyDesignerDefaultValues(flatData || {}, form, { onlyMissing })
    return deriveDynamicTableRowCounts({ ...withDefaults }, form)
  }, [])

  // Build nested JSON for save + explicit field-state index (hybrid persistence):
  // {
  //   nestedFormData: { section_1: { ctrl_x: { value, state, ... } } },
  //   fieldStateIndex: [{ fieldInstanceId, id, state, rendered }]
  // }
  const buildNestedFormDataForSave = (flatData, form, options = {}) => {
    const safeFlatData = flatData && typeof flatData === "object" ? flatData : {}

    // Prefer CRF design sections; fall back to single section on form
    const sections =
      form?.crfDesign?.sections &&
      Array.isArray(form.crfDesign.sections) &&
      form.crfDesign.sections.length > 0
        ? form.crfDesign.sections
        : form?.section?.controls?.length
          ? [form.section]
          : []

    const nested = {}
    const fieldStateIndex = []
    const seenFieldStateKeys = new Set()
    const designVersionId = String(form?.crfDesign?.versionId ?? form?.crfDesignVersionId ?? "").trim()

    const buildFieldInstanceId = (controlOrCellId) => {
      const fid = String(controlOrCellId || "").trim()
      if (!fid) return ""
      return designVersionId ? `${designVersionId}:${fid}` : fid
    }

    const toFieldState = ({ control, rawValue, isRendered, isRuleHidden }) => {
      if (isRuleHidden) return CRF_FIELD_STATE.HIDDEN_BY_RULE
      if (!isRendered) return CRF_FIELD_STATE.NOT_RENDERED
      return hasAnyMeaningfulValue(rawValue) ? CRF_FIELD_STATE.FILLED : CRF_FIELD_STATE.RENDERED_EMPTY
    }

    const pushFieldStateIndex = (id, state, rendered) => {
      const safeId = String(id || "").trim()
      if (!safeId) return
      const dedupeKey = `${safeId}|${state}|${rendered ? 1 : 0}`
      if (seenFieldStateKeys.has(dedupeKey)) return
      seenFieldStateKeys.add(dedupeKey)
      fieldStateIndex.push({
        fieldInstanceId: buildFieldInstanceId(safeId),
        id: safeId,
        state,
        rendered: Boolean(rendered),
      })
    }

    const getLabel = (control) => {
      return (
        control.label ||
        control.title ||
        control.questionText ||
        control.name ||
        control?.properties?.label ||
        control?.properties?.questionText ||
        control?.properties?.text ||
        control.id
      )
    }

    const getTableCellFriendlyLabel = (control, flatKey) => {
      if (!control || !flatKey || !flatKey.startsWith(`${control.id}_row_`)) return flatKey

      const m = flatKey.match(/_row_(\d+)_col_(\d+)$/)
      if (!m) return flatKey

      const rowIdx = parseInt(m[1], 10)
      const colIdx = parseInt(m[2], 10)
      if (!Number.isFinite(rowIdx) || !Number.isFinite(colIdx)) return flatKey

      const props = control?.properties || {}
      const colHeaders = Array.isArray(props.columnHeaders) ? props.columnHeaders : []
      const cellLabels = Array.isArray(props.cellLabels) ? props.cellLabels : []
      const controlLabel = getLabel(control)
      const rowLabel = cellLabels?.[rowIdx]?.[0] || `Row ${rowIdx + 1}`
      const colLabel = colHeaders?.[colIdx] || `Column ${colIdx + 1}`

      return `${controlLabel} | ${rowLabel} | ${colLabel} (row_${rowIdx}_col_${colIdx})`
    }

    const addFieldNode = ({ sectionId, control, id, rawValue, label, isRendered, isRuleHidden }) => {
      const safeSectionId = String(sectionId || "section_1")
      if (!nested[safeSectionId]) nested[safeSectionId] = {}
      const state = toFieldState({ control, rawValue, isRendered, isRuleHidden })
      const normalizedValue = rawValue === undefined ? null : rawValue
      const valueToSave =
        typeof normalizedValue === "string"
          ? encodeAngleBracketsForBackend(normalizedValue)
          : normalizedValue
      const sdvFieldKey = getSdvFieldKey(form?.id, id)
      nested[safeSectionId][id] = {
        fieldInstanceId: buildFieldInstanceId(id),
        id,
        value: valueToSave,
        state,
        label,
        isSdvApproved: Boolean(sdvApprovedByFieldRef.current?.[sdvFieldKey]),
        ...buildSdvAuditFieldsForSave({
          auditMeta: sdvAuditMetaByFieldRef.current,
          sdvFieldKey,
        }),
        ...buildAiEntryFieldsForSave(
          aiEntryFlagsByFieldIdRef.current?.[getSdvFieldKey(form?.id, id)],
        ),
        ...(options.includePiSignoff
          ? {
              isPiSigned: Boolean(piSignedByFieldRef.current?.[getPiFieldKey(form?.id, id)]),
              ...buildPiAuditFieldsForSave({
                auditMeta: piAuditMetaByFieldRef.current,
                piFieldKey: getPiFieldKey(form?.id, id),
              }),
            }
          : {}),
      }
      pushFieldStateIndex(id, state, isRendered && !isRuleHidden)
    }

    const flatKeys = Object.keys(safeFlatData)
    sections.forEach((section, index) => {
      const sectionId = section.id || `section_${index + 1}`
      const controls = section.controls || []
      controls.forEach((control) => {
        const controlId = String(control?.id || "").trim()
        if (!controlId) return
        const evaluatedControl = getRuleAwareControl(control)
        const ruleHidden = Boolean(evaluatedControl?.properties?.hidden)
        const renderedByGender = isControlApplicableForPatientGenderForSavePayload(evaluatedControl, selectedPatient)
        const isRendered = renderedByGender
        const isRuleHidden = ruleHidden && renderedByGender

        // Always emit base control node so backend can distinguish empty vs not-rendered.
        const controlRawValue = Object.prototype.hasOwnProperty.call(safeFlatData, controlId)
          ? safeFlatData[controlId]
          : null
        addFieldNode({
          sectionId,
          control: evaluatedControl,
          id: controlId,
          rawValue: controlRawValue,
          label: getLabel(control),
          isRendered,
          isRuleHidden,
        })

        // Dynamic table: keep explicit row keys (rowCount, row_N_col_M) for cells currently in form slice.
        flatKeys.forEach((k) => {
          if (k === controlId) return
          if (!k.startsWith(`${controlId}_`)) return
          const raw = safeFlatData[k]
          const labelForKey =
            String(control.type || "").toLowerCase() === "table"
              ? getTableCellFriendlyLabel(control, k)
              : k
          const cellMatch = k.match(/_row_(\d+)_col_(\d+)$/)
          let cellRuleHidden = isRuleHidden
          if (cellMatch) {
            const rowIdx = Number.parseInt(cellMatch[1], 10)
            const colIdx = Number.parseInt(cellMatch[2], 10)
            const cellRule =
              evaluatedControl?.properties?.tableCellRuleProps?.[`${rowIdx}_${colIdx}`]
            if (cellRule?.hidden) cellRuleHidden = true
          }
          addFieldNode({
            sectionId,
            control: evaluatedControl,
            id: k,
            rawValue: raw,
            label: labelForKey,
            isRendered,
            isRuleHidden: cellRuleHidden && renderedByGender,
          })
        })
      })
    })

    // Fallback: if no sections/controls matched, put everything into section_1
    if (Object.keys(nested).length === 0) {
      const sectionId = "section_1"
      nested[sectionId] = {}
      Object.keys(safeFlatData).forEach((controlId) => {
        const value = safeFlatData[controlId]
        addFieldNode({
          sectionId,
          control: null,
          id: controlId,
          rawValue: value,
          label: controlId,
          isRendered: true,
          isRuleHidden: false,
        })
      })
    }

    return {
      nestedFormData: nested,
      fieldStateIndex,
    }
  }

  const handleLastVisitConfirm = async (completedYes, selectedStatusCode = null) => {
    if (!studyId || !selectedPatient?.id) return
    const code = completedYes ? PATIENT_STATUS_CODES.COMPLETED : selectedStatusCode
    if (code == null) return
    setLastVisitModal((prev) => ({ ...prev, submitting: true }))
    try {
      const res = await patientEnrolmentService.updatePatientStatus(studyId, selectedPatient.id, {
        newStatusCode: code,
        reason: null,
      })
      if (!res?.isSuccess) {
        toast({
          title: "Status update failed",
          description: res?.message || "Could not update patient status.",
          variant: "destructive",
        })
        setLastVisitModal((prev) => ({ ...prev, submitting: false }))
        return
      }

      const updatedCode = res?.data?.currentStatusCode
      const updatedName = res?.data?.currentStatusName
      if (updatedCode != null || updatedName) {
        setPatients((prev) =>
          prev.map((p) =>
            p.id === selectedPatient.id
              ? {
                  ...p,
                  currentStatusCode: updatedCode ?? p.currentStatusCode,
                  currentStatusName: updatedName ?? p.currentStatusName,
                  patientStatusCode: updatedCode ?? p.patientStatusCode,
                  patientStatusName: updatedName ?? p.patientStatusName,
                }
              : p,
          ),
        )
        setSelectedPatient((prev) =>
          prev
            ? {
                ...prev,
                currentStatusCode: updatedCode ?? prev.currentStatusCode,
                currentStatusName: updatedName ?? prev.currentStatusName,
                patientStatusCode: updatedCode ?? prev.patientStatusCode,
                patientStatusName: updatedName ?? prev.patientStatusName,
              }
            : prev,
        )
      }

      setLastVisitModal({ open: false, step: 1, completedYes: null, selectedStatusCode: null, submitting: false })
      await handleSaveCrfData(3, { skipLastVisitCheck: true, skipSubmitConfirm: true })
    } catch (e) {
      console.error("Last visit status update error:", e)
      toast({ title: "Error", description: e?.message || "Failed to update status.", variant: "destructive" })
      setLastVisitModal((prev) => ({ ...prev, submitting: false }))
    }
  }

  const { isAuditStatusRetryable, isNoChangeAuditError, enqueueAuditRetryBatch } = useAuditRetryQueue({
    saveFieldChange: (payload) => auditTrailWithReasonService.saveFieldChange(payload),
    onRetryExhausted: () => {
      toast({
        title: "Some audit entries failed",
        description:
          "A few field-change audit records could not be synced after retries. Please save once again to retry.",
        variant: "destructive",
        duration: 4200,
      })
    },
  })

  const persistFieldAuditTrail = useCallback(
    async (changes, reasonText, finalizedCrfDataId) => {
      const normalizedReason = String(reasonText || "").trim()
      const auditChanges = Array.isArray(changes) ? changes : []
      const parsedCrfDataId = Number.parseInt(String(finalizedCrfDataId ?? ""), 10)
      if (auditChanges.length === 0 || !Number.isFinite(parsedCrfDataId) || parsedCrfDataId <= 0) {
        return { attempted: 0, failed: 0 }
      }

      const studyIdNum = Number.parseInt(String(studyId ?? ""), 10)
      const siteIdNum = Number.parseInt(String(siteId ?? ""), 10)
      const patientIdNum = Number.parseInt(String(selectedPatient?.id ?? ""), 10)
      const visitIdNum = Number.parseInt(String(selectedVisit?.visitScheduleId ?? ""), 10)
      const crfIdNum = Number.parseInt(String(selectedForm?.crfDesignId ?? ""), 10)
      const controls = Array.isArray(selectedForm?.section?.controls) ? selectedForm.section.controls : []
      const controlById = new Map(controls.map((c) => [String(c?.id || ""), c]))
      const fieldLabelMap = createFieldLabelMap(selectedForm?.section?.controls || [])
      const getAuditFieldDisplayName = (fieldKey) => {
        const key = String(fieldKey || "").trim()
        if (!key) return ""
        const tableCellMatch = key.match(/^(.*)_row_(\d+)_col_(\d+)$/)
        if (tableCellMatch) {
          const baseControlId = String(tableCellMatch[1] || "")
          const rowIndex = Number.parseInt(String(tableCellMatch[2] || ""), 10)
          const colIndex = Number.parseInt(String(tableCellMatch[3] || ""), 10)
          const baseControl = controlById.get(baseControlId) || null
          const tableLabel = String(
            baseControl?.label || baseControl?.properties?.labelText || baseControlId || "Table",
          ).trim()
          const columnCandidates = Array.isArray(baseControl?.properties?.columns)
            ? baseControl.properties.columns
            : Array.isArray(baseControl?.properties?.tableColumns)
              ? baseControl.properties.tableColumns
              : []
          const colMeta = columnCandidates[colIndex] || null
          const columnLabel = String(
            colMeta?.label || colMeta?.name || colMeta?.header || "",
          ).trim()
          const rowLabel = Number.isFinite(rowIndex) ? `row ${rowIndex + 1}` : "row ?"
          const colLabel = columnLabel || (Number.isFinite(colIndex) ? `column ${colIndex + 1}` : "column ?")
          return `${tableLabel} (${rowLabel}, ${colLabel})-(${key})`
        }
        const label = String(fieldLabelMap?.[key] || "").trim()
        if (!label) return key
        return `${label}-(${key})`
      }

      const auditPayloads = auditChanges.map((change) => ({
          entityType: 1,
          entityId: String(parsedCrfDataId),
          crfDataId: parsedCrfDataId,
          fieldName: getAuditFieldDisplayName(change.fieldName),
          oldValue: change.oldValue ?? "",
          newValue: change.newValue ?? "",
          reason: normalizedReason || undefined,
          studyId: Number.isFinite(studyIdNum) ? studyIdNum : undefined,
          siteId: Number.isFinite(siteIdNum) ? siteIdNum : undefined,
          patientId: Number.isFinite(patientIdNum) ? patientIdNum : undefined,
          visitId: Number.isFinite(visitIdNum) ? visitIdNum : undefined,
          crfId: Number.isFinite(crfIdNum) ? crfIdNum : undefined,
          changedAtClientUtc: new Date().toISOString(),
        }))
      const auditCalls = auditPayloads.map((payload) => auditTrailWithReasonService.saveFieldChange(payload))

      const auditResults = await Promise.allSettled(auditCalls)
      const failedPayloads = []
      const retriableEntries = []
      auditResults.forEach((result, idx) => {
        if (result.status === "fulfilled" && result.value?.isSuccess) return
        const statusCode = result.status === "fulfilled" ? result.value?.statusCode || result.value?.httpStatus : 0
        const message = result.status === "fulfilled" ? result.value?.message : result.reason?.message
        if (isNoChangeAuditError(statusCode, message)) {
          // Backend blocks no-change events with 400; treat these as safely ignored.
          return
        }
        const payload = auditPayloads[idx]
        if (!payload) return
        failedPayloads.push(payload)
        if (isAuditStatusRetryable(statusCode)) {
          retriableEntries.push({ payload, retryCount: 0 })
        }
      })
      if (retriableEntries.length > 0) {
        enqueueAuditRetryBatch(retriableEntries)
      }
      return {
        attempted: auditCalls.length,
        failed: failedPayloads.length,
      }
    },
    [
      studyId,
      siteId,
      selectedPatient?.id,
      selectedVisit?.visitScheduleId,
      selectedForm?.crfDesignId,
      enqueueAuditRetryBatch,
      isAuditStatusRetryable,
      isNoChangeAuditError,
    ],
  )

  const resolveExistingCrfDataIdForSave = useCallback(() => {
    return resolveCrfDataIdForFormContext(selectedForm, selectedVisit, selectedPatient)
  }, [resolveCrfDataIdForFormContext, selectedForm, selectedVisit, selectedPatient])

  const handleApplyPiFieldSignoffs = useCallback(
    async (sectionControlIds = [], password = "") => {
      if (piFieldSignoffSaving || !canShowPiPerField) return false
      const trimmedPassword = String(password ?? "").trim()
      if (!trimmedPassword) {
        toast({
          title: "Password required",
          description: "Enter your account password to save field PI sign-off.",
          variant: "destructive",
        })
        return false
      }
      const crfDataId = resolveExistingCrfDataIdForSave()
      if (!crfDataId) {
        toast({
          title: "Save required",
          description: "Save and submit the CRF first, then sign fields for PI sign-off.",
          variant: "destructive",
        })
        return false
      }
      const formId = selectedForm?.id
      const nextSigned = { ...piSignedByFieldRef.current }
      sectionControlIds.forEach((controlIdStr) => {
        const key = getPiFieldKey(formId, controlIdStr)
        nextSigned[key] = Boolean(piSelectionsByField[key])
      })
      piSignedByFieldRef.current = nextSigned
      setPiSignedByField(nextSigned)

      const flatSlice = formData?.[formId] || {}
      const { nestedFormData } = buildNestedFormDataForSave(flatSlice, selectedForm, {
        includePiSignoff: true,
      })

      setPiFieldSignoffSaving(true)
      try {
        const sid = Number.parseInt(String(studyId ?? ""), 10)
        const res = await piSignoffService.applyFieldSignoffs({
          studyId: Number.isFinite(sid) && sid > 0 ? sid : undefined,
          crfDataId,
          password: trimmedPassword,
          formData: JSON.stringify(nestedFormData),
        })
        if (res?.isSuccess) {
          toast({ title: "Field PI sign-off saved", variant: "success" })
          mergePiStateFromSavedFormData(nestedFormData, formId)
          setPiSignoffRefreshToken((t) => t + 1)
          if (res?.data?.status) {
            setIsPiSigned(/signed/i.test(String(res.data.status)) && !/voided/i.test(String(res.data.status)))
          }
          return true
        }
        toast({
          title: "Field PI sign-off failed",
          description: res?.message || "Unable to save field PI sign-off.",
          variant: "destructive",
        })
        return false
      } finally {
        setPiFieldSignoffSaving(false)
      }
    },
    [
      piFieldSignoffSaving,
      canShowPiPerField,
      resolveExistingCrfDataIdForSave,
      selectedForm,
      formData,
      piSelectionsByField,
      studyId,
      buildNestedFormDataForSave,
      mergePiStateFromSavedFormData,
    ],
  )

  const handleRevokePiFieldSignoffs = useCallback(
    async (sectionControlIds = [], password = "", reason = "") => {
      if (piFieldSignoffSaving || !canShowPiPerField) return false
      const trimmedPassword = String(password ?? "").trim()
      const trimmedReason = String(reason ?? "").trim()
      if (!trimmedPassword) {
        toast({
          title: "Password required",
          description: "Enter your account password to revoke field PI sign-off.",
          variant: "destructive",
        })
        return false
      }
      if (!trimmedReason) {
        toast({
          title: "Reason required",
          description: "Enter a reason for revoking field PI sign-off.",
          variant: "destructive",
        })
        return false
      }
      const crfDataId = resolveExistingCrfDataIdForSave()
      if (!crfDataId) return false

      const formId = selectedForm?.id
      const nextSigned = { ...piSignedByFieldRef.current }
      let anyRevoked = false
      sectionControlIds.forEach((controlIdStr) => {
        const key = getPiFieldKey(formId, controlIdStr)
        if (!nextSigned[key]) return
        nextSigned[key] = false
        anyRevoked = true
      })
      if (anyRevoked) {
        setPiSelectionsByField((prev) => {
          const next = { ...prev }
          sectionControlIds.forEach((controlIdStr) => {
            next[getPiFieldKey(formId, controlIdStr)] = false
          })
          return next
        })
      }
      if (!anyRevoked) {
        toast({
          title: "No signed fields selected",
          description: "Select PI-signed fields in this section to revoke.",
          variant: "destructive",
        })
        return false
      }
      piSignedByFieldRef.current = nextSigned
      setPiSignedByField(nextSigned)

      const flatSlice = formData?.[formId] || {}
      const { nestedFormData } = buildNestedFormDataForSave(flatSlice, selectedForm, {
        includePiSignoff: true,
      })

      setPiFieldSignoffSaving(true)
      try {
        const sid = Number.parseInt(String(studyId ?? ""), 10)
        const res = await piSignoffService.revokeFieldSignoffs({
          studyId: Number.isFinite(sid) && sid > 0 ? sid : undefined,
          crfDataId,
          password: trimmedPassword,
          reason: trimmedReason,
          formData: JSON.stringify(nestedFormData),
        })
        if (res?.isSuccess) {
          toast({ title: "Field PI sign-off revoked", variant: "success" })
          mergePiStateFromSavedFormData(nestedFormData, formId)
          setPiSignoffRefreshToken((t) => t + 1)
          return true
        }
        toast({
          title: "Field PI revoke failed",
          description: res?.message || "Unable to revoke field PI sign-off.",
          variant: "destructive",
        })
        return false
      } finally {
        setPiFieldSignoffSaving(false)
      }
    },
    [
      piFieldSignoffSaving,
      canShowPiPerField,
      resolveExistingCrfDataIdForSave,
      selectedForm,
      formData,
      studyId,
      buildNestedFormDataForSave,
      mergePiStateFromSavedFormData,
      getPiFieldKey,
    ],
  )

  const handleSdvFieldCheckboxChange = useCallback(
    (formId, controlIdStr, checked) => {
      const key = getSdvFieldKey(formId, controlIdStr)
      const normalizedChecked = Boolean(checked)
      if (
        !normalizedChecked &&
        Boolean(sdvApprovedByFieldRef.current?.[key]) &&
        resolveExistingCrfDataIdForSave()
      ) {
        setAuditChangeReason("")
        setAuditReasonModal({
          open: true,
          status: null,
          options: null,
          changedFields: [
            {
              fieldName: controlIdStr,
              oldValue: "SDV verified",
              newValue: "SDV cleared",
            },
          ],
          mode: "sdv_revoke",
          pendingSectionId: null,
          verificationContext: { formId, controlIdStr },
        })
        return
      }
      setSdvChecked(formId, controlIdStr, normalizedChecked)
    },
    [getSdvFieldKey, resolveExistingCrfDataIdForSave, setSdvChecked],
  )

  const handlePiFieldCheckboxChange = useCallback(
    (formId, controlIdStr, checked) => {
      const key = getPiFieldKey(formId, controlIdStr)
      const normalizedChecked = Boolean(checked)
      if (
        !normalizedChecked &&
        Boolean(piSignedByFieldRef.current?.[key]) &&
        resolveExistingCrfDataIdForSave()
      ) {
        setPiFieldPasswordDialog({
          open: true,
          sectionIds: [controlIdStr],
          mode: "revoke",
        })
        return
      }
      setPiChecked(formId, controlIdStr, normalizedChecked)
    },
    [getPiFieldKey, resolveExistingCrfDataIdForSave, setPiChecked],
  )

  const { handleSaveCrfData } = useCrfSavePipeline({
    saveRequestInFlightRef,
    selectedForm,
    selectedPatient,
    studyId,
    selectedVisit,
    isCraReviewer,
    canTsiEditSubmittedCrf,
    currentFormStatus,
    setErrorModal,
    isFormReadOnlyByPermission,
    canEditExistingCrf,
    canCreateCrf,
    canViewEcrfManual: Boolean(ecrfPermission.canView),
    isSdvConfiguredForStudy: sdvConfiguredForCurrentStudy,
    canPerformSdvForStudy: canVerifySdvForStudy,
    formData,
    getRuleAwareControl,
    validateControl,
    setValidationErrors,
    summarizeValidationBySection,
    setHighlightSectionErrors,
    sectionsWithContentForDataEntry,
    selectedFormId: selectedForm?.id,
    crfRuleMessages,
    isBlockingSeverity,
    isSubmitBlockingCategory,
    isDateRestrictionCategory,
    replaceFieldIdsWithLabels,
    createFieldLabelMap,
    toRequiredQueryText,
    setSubmitPopupFlow,
    setShowScreeningFailedModal,
    setShowRandomizedEnrolledModal,
    isPatientStatusEnabled,
    visits,
    setLastVisitModal,
    isStudyCompletionDataEntry: isStudyCompletionVisitEntry,
    getStudyCompletionSubmitContext,
    applyStudyCompletionStatusBeforeSubmit,
    setSubmitConfirmModalOpen,
    computeChangedAuditFields,
    preCapturedAuditReason,
    setAuditChangeReason,
    setAuditReasonModal,
    setSaving,
    buildNestedFormDataForSave,
    getRepeatableKindFromValue,
    toPositiveRowNumber,
    resolveRepeatableRowCrfDataId,
    toDesignKey,
    auditReasonDebugRef,
    crfDataService,
    persistFieldAuditTrail,
    toast,
    setSaveSuccessPopup,
    isSoftSeverity,
    eConsentBlocksSave: eConsentBlocksSelectedPatient,
    eConsentBlockMessage: eConsentCrfGate.blockMessage,
    eConsentService,
    siteId,
    currentFormSections,
    stringifyQueryActualValue,
    crfQueryManagementService,
    setCurrentFormStatus,
    setSelectedForm,
    setFormAuditBaselineById,
    setPreCapturedAuditReason,
    crfDataCacheRef,
    invalidateCrfDataByIdCache,
    fetchCrfDataForPatient,
    syncPatientVisitCrfFromGrid,
    setPatientQueriesRefreshTick,
    fetchFormsForVisit,
    toScheduleKey,
    setVisitCrfDataMap: applyVisitCrfDataMap,
    setSelectedPatient,
    setPatients,
    setAvailableFormsByVisit,
    setLastSavedAt,
    setShowFormDropdown,
    setSelectedVisit,
    syncSdvAuditMetaFromSavedFormData: mergeSdvStateFromSavedFormData,
    syncAiEntryFlagsFromSavedFormData,
    resolveExistingCrfDataIdForSave,
  })

  const closeAuditReasonModal = useCallback(() => {
    if (savingAuditReason) return
    if (auditReasonDebugRef.current) {
      try {
        console.log("[AuditReason][modal-close]", {
          mode: auditReasonModal?.mode,
          changedCount: auditReasonModal?.changedFields?.length || 0,
          selectedFormId: selectedForm?.id,
        })
      } catch {}
    }
    const shouldRollbackChanges =
      Boolean(auditReasonModal?.open) &&
      Array.isArray(auditReasonModal?.changedFields) &&
      auditReasonModal?.mode !== "sdv_revoke"
    if (shouldRollbackChanges && selectedForm?.id) {
      const formId = selectedForm.id
      const baselineValues = formAuditBaselineById?.[formId]?.values || {}
      const changedFieldNames = auditReasonModal.changedFields
        .map((entry) => String(entry?.fieldName || "").trim())
        .filter(Boolean)
      if (changedFieldNames.length > 0) {
        setFormData((prev) => {
          const prevSlice = prev?.[formId] || {}
          const nextSlice = { ...prevSlice }
          changedFieldNames.forEach((fieldName) => {
            if (Object.prototype.hasOwnProperty.call(baselineValues, fieldName)) {
              nextSlice[fieldName] = baselineValues[fieldName]
            } else {
              delete nextSlice[fieldName]
            }
          })
          return {
            ...prev,
            [formId]: nextSlice,
          }
        })
      }

      // Lock fields again when user cancels.
      setAuditLightEditModeById((prev) => {
        const next = { ...prev }
        changedFieldNames.forEach((k) => {
          next[k] = false
        })
        return next
      })
      setAuditLightDirtyById((prev) => {
        const next = { ...prev }
        changedFieldNames.forEach((k) => {
          delete next[k]
        })
        return next
      })
    }
    setPreCapturedAuditReason("")
    setAuditReasonModal({
      open: false,
      status: null,
      options: null,
      changedFields: [],
      mode: "save",
      pendingSectionId: null,
      verificationContext: null,
    })
    setAuditChangeReason("")
  }, [savingAuditReason, auditReasonModal, selectedForm?.id, formAuditBaselineById])

  const confirmAuditReasonAndContinueSave = useCallback(async () => {
    if (!auditReasonModal?.open || savingAuditReason) return
    const reasonText = String(auditChangeReason || "").trim()
    if (auditReasonDebugRef.current) {
      try {
        console.log("[AuditReason][modal-confirm]", {
          mode: auditReasonModal?.mode,
          changedCount: auditReasonModal?.changedFields?.length || 0,
          reasonLength: reasonText.length,
          pendingSectionId: auditReasonModal?.pendingSectionId || null,
        })
      } catch {}
    }
    if (!reasonText) {
      toast({
        title: "Reason required",
        description: "Please provide a reason for editing previously saved CRF data.",
        variant: "destructive",
      })
      return
    }
    setSavingAuditReason(true)
    try {
    const effectiveChangedFields = Array.isArray(auditReasonModal?.changedFields) ? auditReasonModal.changedFields : []
    const nextStatus = auditReasonModal.status
    const nextOptions = auditReasonModal.options || {}
    const pendingSectionId = auditReasonModal.pendingSectionId
    const modalMode = auditReasonModal.mode || "save"
    const verificationContext = auditReasonModal.verificationContext
    setAuditReasonModal({
      open: false,
      status: null,
      options: null,
      changedFields: [],
      mode: "save",
      pendingSectionId: null,
      verificationContext: null,
    })
    if (modalMode === "sdv_revoke") {
      const formId = verificationContext?.formId
      const controlIdStr = verificationContext?.controlIdStr
      if (formId && controlIdStr) {
        const sdvKey = getSdvFieldKey(formId, controlIdStr)
        const nextApprovals = { ...sdvApprovedByFieldRef.current, [sdvKey]: false }
        sdvApprovedByFieldRef.current = nextApprovals
        setSdvApprovedByField(nextApprovals)
        setSdvSelectionsByField((prev) => ({ ...prev, [sdvKey]: false }))
      }
      const existingCrfDataId = Number.parseInt(String(selectedForm?.crfDataId ?? ""), 10)
      if (
        Number.isFinite(existingCrfDataId) &&
        existingCrfDataId > 0 &&
        effectiveChangedFields.length > 0
      ) {
        const auditResult = await persistFieldAuditTrail(
          effectiveChangedFields,
          reasonText,
          existingCrfDataId,
        )
        if (auditResult.failed > 0) {
          toast({
            title: "Reason saved, audit partially failed",
            description: "SDV was cleared but some audit entries could not be stored.",
            variant: "destructive",
            duration: 4200,
          })
        }
      }
      const sdvSaveStatus =
        canTsiEditSubmittedCrf && currentFormStatus === 3
          ? 2
          : currentFormStatus === 1
            ? 1
            : 2
      await handleSaveCrfData(sdvSaveStatus, {
        skipLastVisitCheck: true,
        skipPreSubmitPopups: true,
        skipAuditReasonPrompt: true,
        keepFormOpen: true,
        sdvApprovalSave: true,
        auditReason: reasonText,
        pendingAuditChanges: [],
      })
      await refreshSdvStateFromServer(selectedForm?.crfDataId, verificationContext?.formId ?? selectedForm?.id)
      setAuditChangeReason("")
      toast({
        title: "SDV cleared",
        description: "Field SDV verification was removed with audit reason recorded.",
        variant: "success",
        duration: 2000,
      })
      return
    }
    if (modalMode === "capture_only") {
      const activeChanges = effectiveChangedFields
      const existingCrfDataId = Number.parseInt(String(selectedForm?.crfDataId ?? ""), 10)
      if (Number.isFinite(existingCrfDataId) && existingCrfDataId > 0 && activeChanges.length > 0) {
        const auditResult = await persistFieldAuditTrail(activeChanges, reasonText, existingCrfDataId)
        if (auditResult.failed > 0) {
          toast({
            title: "Reason saved, audit partially failed",
            description: "Some audit entries could not be stored. Please save once to retry remaining entries.",
            variant: "destructive",
            duration: 4200,
          })
        }
        // Persist the edited values right away so reopening form doesn't show old values.
        const autoSaveStatus =
          canTsiEditSubmittedCrf && currentFormStatus === 3
            ? 2
            : currentFormStatus === 1
              ? 1
              : 2
        await handleSaveCrfData(autoSaveStatus, {
          skipLastVisitCheck: true,
          skipPreSubmitPopups: true,
          skipAuditReasonPrompt: true,
          keepFormOpen: true,
          skipPostSaveRefetch: true,
          auditReason: reasonText,
          // Audit already sent above in capture flow; avoid duplicate events.
          pendingAuditChanges: [],
        })
        const lightChangedKeys = activeChanges
          .map((entry) => String(entry?.fieldName || "").trim())
          .filter(Boolean)
        if (lightChangedKeys.length > 0) {
          setAuditLightEditModeById((prev) => {
            const next = { ...prev }
            lightChangedKeys.forEach((k) => {
              next[k] = false
            })
            return next
          })
          setAuditLightDirtyById((prev) => {
            const next = { ...prev }
            lightChangedKeys.forEach((k) => {
              delete next[k]
            })
            return next
          })
        }
        const syncedFieldMap = activeChanges.reduce((acc, entry) => {
          const key = String(entry?.fieldName || "")
          if (!key) return acc
          acc[key] = "active"
          return acc
        }, {})
        setRecentAuditSyncedFields(syncedFieldMap)
        if (auditSyncedFadeTimeoutRef.current) {
          clearTimeout(auditSyncedFadeTimeoutRef.current)
        }
        if (auditSyncedClearTimeoutRef.current) {
          clearTimeout(auditSyncedClearTimeoutRef.current)
        }
        auditSyncedFadeTimeoutRef.current = setTimeout(() => {
          setRecentAuditSyncedFields((prev) =>
            Object.keys(prev || {}).reduce((acc, key) => {
              acc[key] = "fading"
              return acc
            }, {}),
          )
          auditSyncedFadeTimeoutRef.current = null
        }, 2400)
        auditSyncedClearTimeoutRef.current = setTimeout(() => {
          setRecentAuditSyncedFields({})
          auditSyncedClearTimeoutRef.current = null
        }, 3200)
        toast({
          title: "Reason and value saved",
          description: "Your update was saved without leaving this form.",
          variant: "success",
          duration: 1000,
        })
      } else {
        setPreCapturedAuditReason(reasonText)
      }
      setAuditChangeReason("")
      if (pendingSectionId) handleSectionTabChange(pendingSectionId, { skipAuditPrompt: true })
      return
    }
    await handleSaveCrfData(nextStatus, {
      ...nextOptions,
      ...(Number(nextStatus) === 3 ? { skipSubmitConfirm: true } : {}),
      pendingAuditChanges: effectiveChangedFields,
      skipAuditReasonPrompt: true,
      auditReason: reasonText,
    })
    // After full save, lock light-audit fields again.
    const lightChangedKeys = effectiveChangedFields
      .map((entry) => String(entry?.fieldName || "").trim())
      .filter(Boolean)
    if (lightChangedKeys.length > 0) {
      setAuditLightEditModeById((prev) => {
        const next = { ...prev }
        lightChangedKeys.forEach((k) => {
          next[k] = false
        })
        return next
      })
      setAuditLightDirtyById((prev) => {
        const next = { ...prev }
        lightChangedKeys.forEach((k) => delete next[k])
        return next
      })
    }
    setAuditChangeReason("")
    } finally {
      setSavingAuditReason(false)
    }
  }, [
    auditReasonModal,
    auditChangeReason,
    savingAuditReason,
    selectedForm?.crfDataId,
    currentFormStatus,
    canTsiEditSubmittedCrf,
    handleSectionTabChange,
    handleSaveCrfData,
    persistFieldAuditTrail,
    auditLightLogControlIds,
    getSdvFieldKey,
    toast,
    refreshSdvStateFromServer,
    selectedForm?.id,
  ])

  const handleAllVisitsSdv = useCallback(
    async (patient) => {
      const target = patient ?? selectedPatient ?? selectedPatientRef.current
      if (!target?.id || allVisitsSdvSaving) return
      if (!canVerifySdvForStudy || !sdvConfiguredForCurrentStudy) {
        toast({
          title: "SDV not available",
          description: "You do not have SDV verify permission for this study.",
          variant: "destructive",
        })
        return
      }

      const readiness = isPatientReadyForBulkReview(target, matrixVisitColumns)
      if (!readiness.ready) {
        toast({
          title: readiness.reason === "open_queries" ? "Resolve queries first" : "Visits not complete",
          description:
            readiness.reason === "open_queries"
              ? "Close or resolve open queries, then re-SDV — same as the per-CRF flow."
              : "All visits must be fully filled before All visits SDV.",
          variant: "destructive",
        })
        return
      }

      const sid = Number.parseInt(String(studyId ?? ""), 10)
      if (!Number.isFinite(sid) || sid <= 0) return

      let blockedByQueries = 0
      const entries = (Array.isArray(target.visitCrfData) ? target.visitCrfData : []).filter((vcd) => {
        const crfDataId = Number.parseInt(String(vcd?.crfDataId ?? ""), 10)
        if (!Number.isFinite(crfDataId) || crfDataId <= 0) return false
        if (Boolean(vcd?.isSdvVerify ?? vcd?.IsSdvVerify)) return false
        if (visitCrfHasOpenQueries(vcd)) {
          blockedByQueries += 1
          return false
        }
        const statusCode = normalizeCrfStatusCode(vcd?.status)
        return statusCode === 2 || statusCode === 3
      })

      if (entries.length === 0) {
        toast({
          title: "Nothing to SDV",
          description:
            blockedByQueries > 0
              ? "Pending CRFs still have open queries. Resolve them, then re-SDV."
              : "No Saved/Submitted CRFs are pending SDV for this patient’s visits.",
        })
        return
      }

      const confirmed =
        typeof window === "undefined" ||
        window.confirm(
          `Mark SDV done for ${entries.length} CRF(s) across all visits for ${target.patientId || "this patient"}?`,
        )
      if (!confirmed) return

      setAllVisitsSdvSaving(true)
      let okCount = 0
      let failCount = 0
      try {
        for (const entry of entries) {
          const crfDataId = Number.parseInt(String(entry.crfDataId ?? ""), 10)
          try {
            const existing = await crfDataService.getCrfDataById(crfDataId, sid)
            if (!existing?.isSuccess || !existing?.data) {
              failCount += 1
              continue
            }
            const record = existing.data
            const statusCode = normalizeCrfStatusCode(record.status ?? entry.status)
            const stampedFormData = stampAllFieldsSdvApproved(record.formData)
            const response = await crfDataService.updateCrfData(crfDataId, {
              formData: stampedFormData,
              status: statusCode,
              isSdvVerify: true,
              comment: record.comment ?? record.Comment ?? undefined,
              primaryVisitDate: record.primaryVisitDate ?? record.PrimaryVisitDate ?? undefined,
              rowNumber: record.rowNumber ?? record.RowNumber ?? entry.rowNumber ?? undefined,
            })
            if (response?.isSuccess) okCount += 1
            else failCount += 1
          } catch {
            failCount += 1
          }
        }

        await syncPatientVisitCrfFromGrid(target.id)

        if (okCount > 0 && failCount === 0) {
          toast({
            title: "All visits SDV done",
            description: `SDV verified for ${okCount} CRF(s) across this patient’s visits.`,
          })
        } else if (okCount > 0) {
          toast({
            title: "Partial SDV complete",
            description: `Verified ${okCount} CRF(s); ${failCount} failed. Check permissions or retry.`,
            variant: "destructive",
          })
        } else {
          toast({
            title: "All visits SDV failed",
            description: "Could not verify SDV for pending CRFs. Check permissions and try again.",
            variant: "destructive",
          })
        }
      } finally {
        setAllVisitsSdvSaving(false)
      }
    },
    [
      selectedPatient,
      allVisitsSdvSaving,
      canVerifySdvForStudy,
      sdvConfiguredForCurrentStudy,
      matrixVisitColumns,
      studyId,
      toast,
      syncPatientVisitCrfFromGrid,
    ],
  )

  const collectAllVisitsPiEntries = useCallback(
    (patient) => {
      const target = patient ?? selectedPatient ?? selectedPatientRef.current
      if (!target?.id) {
        return { target: null, entries: [], blockedBySdv: 0, blockedByQueries: 0 }
      }

      const patientKey = String(target.id)
      const sdvBeforeSign = shouldShowSdvBeforeSignGates(piReviewOrder)
      const sdvByCrfDataId = new Map()
      const openQueryByCrfDataId = new Map()
      for (const vcd of Array.isArray(target.visitCrfData) ? target.visitCrfData : []) {
        const crfDataId = Number.parseInt(String(vcd?.crfDataId ?? ""), 10)
        if (!Number.isFinite(crfDataId) || crfDataId <= 0) continue
        sdvByCrfDataId.set(crfDataId, Boolean(vcd?.isSdvVerify ?? vcd?.IsSdvVerify))
        openQueryByCrfDataId.set(crfDataId, visitCrfHasOpenQueries(vcd))
      }

      let blockedBySdv = 0
      let blockedByQueries = 0
      const entries = []
      for (const row of Array.isArray(piPendingItems) ? piPendingItems : []) {
        const rowPatient = String(row?.patientEnrolmentId ?? row?.patientId ?? "").trim()
        if (!rowPatient || rowPatient !== patientKey) continue
        const crfDataId = Number.parseInt(String(row?.crfDataId ?? ""), 10)
        if (!Number.isFinite(crfDataId) || crfDataId <= 0) continue
        if (isPiSignoffComplete(row)) continue

        const hasOpenQueries =
          Boolean(row?.readiness?.hasOpenQueries) || Boolean(openQueryByCrfDataId.get(crfDataId))
        if (hasOpenQueries) {
          blockedByQueries += 1
          continue
        }

        if (sdvBeforeSign) {
          const sdvDone = sdvByCrfDataId.has(crfDataId)
            ? sdvByCrfDataId.get(crfDataId)
            : Boolean(row?.readiness?.isSdvVerified)
          if (!sdvDone) {
            blockedBySdv += 1
            continue
          }
        }
        entries.push({ crfDataId, row })
      }

      // Fallback when pending queue is empty/unavailable: Submitted CRFs on the patient grid.
      if (entries.length === 0 && (!Array.isArray(piPendingItems) || piPendingItems.length === 0)) {
        for (const vcd of Array.isArray(target.visitCrfData) ? target.visitCrfData : []) {
          const crfDataId = Number.parseInt(String(vcd?.crfDataId ?? ""), 10)
          if (!Number.isFinite(crfDataId) || crfDataId <= 0) continue
          if (normalizeCrfStatusCode(vcd?.status) !== 3) continue
          if (visitCrfHasOpenQueries(vcd)) {
            blockedByQueries += 1
            continue
          }
          if (sdvBeforeSign && !Boolean(vcd?.isSdvVerify ?? vcd?.IsSdvVerify)) {
            blockedBySdv += 1
            continue
          }
          entries.push({ crfDataId, row: vcd })
        }
      }

      return { target, entries, blockedBySdv, blockedByQueries }
    },
    [selectedPatient, piPendingItems, piReviewOrder],
  )

  const handleAllVisitsPi = useCallback(
    (patient) => {
      if (allVisitsPiSaving || allVisitsSdvSaving) return
      if (!studyPermGates.canPiSignoff || !isPiSignoffRequired) {
        toast({
          title: "PI sign-off not available",
          description: "You do not have PI sign-off permission for this study, or PI is not required.",
          variant: "destructive",
        })
        return
      }
      if (!isPiSignoffBulkEnabled) {
        toast({
          title: "Bulk PI sign-off is off",
          description:
            "Turn on Site bulk sign-off in Study Settings to sign multiple ready CRFs at once from eCRF.",
          variant: "destructive",
        })
        return
      }

      const target = patient ?? selectedPatient ?? selectedPatientRef.current
      if (!target?.id) return

      // Bulk (study setting): sign only CRFs that pass readiness — do not require all visits 100% filled.
      const { entries, blockedBySdv, blockedByQueries } = collectAllVisitsPiEntries(target)

      if (entries.length === 0) {
        const blockedParts = []
        if (blockedByQueries > 0) {
          blockedParts.push(`${blockedByQueries} with open queries (resolve, then re-SDV)`)
        }
        if (blockedBySdv > 0) {
          blockedParts.push(`${blockedBySdv} still need SDV / re-SDV`)
        }
        toast({
          title: "Nothing to sign",
          description:
            blockedParts.length > 0
              ? `No CRF(s) ready for PI: ${blockedParts.join("; ")}.`
              : "No pending Submitted CRFs need PI sign-off for this patient’s visits.",
        })
        return
      }

      const confirmed =
        typeof window === "undefined" ||
        window.confirm(
          `Apply PI sign-off for ${entries.length} ready CRF(s) for ${target.patientId || "this patient"}?${
            blockedBySdv > 0 || blockedByQueries > 0
              ? `\n\n(${[
                  blockedByQueries > 0 ? `${blockedByQueries} skipped — open queries` : null,
                  blockedBySdv > 0 ? `${blockedBySdv} skipped — SDV/re-SDV required` : null,
                ]
                  .filter(Boolean)
                  .join("; ")}.)`
              : ""
          }`,
        )
      if (!confirmed) return

      setAllVisitsPiDialog({ open: true, patient: target, entries })
    },
    [
      allVisitsPiSaving,
      allVisitsSdvSaving,
      studyPermGates.canPiSignoff,
      isPiSignoffRequired,
      isPiSignoffBulkEnabled,
      selectedPatient,
      collectAllVisitsPiEntries,
      toast,
    ],
  )

  const confirmAllVisitsPi = useCallback(
    async (password, comment) => {
      const trimmedPassword = String(password ?? "").trim()
      if (!trimmedPassword) return false

      const target = allVisitsPiDialog.patient
      const entries = Array.isArray(allVisitsPiDialog.entries) ? allVisitsPiDialog.entries : []
      if (!target?.id || entries.length === 0 || allVisitsPiSaving) return false

      const sid = Number.parseInt(String(studyId ?? ""), 10)
      if (!Number.isFinite(sid) || sid <= 0) return false

      setAllVisitsPiSaving(true)
      let okCount = 0
      let failCount = 0
      let skippedCount = 0
      let blockedCount = 0
      const trimmedComment = String(comment ?? "").trim()
      try {
        for (const entry of entries) {
          const crfDataId = Number.parseInt(String(entry?.crfDataId ?? ""), 10)
          if (!Number.isFinite(crfDataId) || crfDataId <= 0) {
            failCount += 1
            continue
          }
          try {
            const existing = await piSignoffService.getByCrfDataId(crfDataId)
            if (existing?.isSuccess && isPiSignoffComplete(existing.data)) {
              skippedCount += 1
              continue
            }
            const readiness = existing?.data?.readiness
            if (existing?.isSuccess && readiness && readiness.isReadyToSign === false) {
              blockedCount += 1
              continue
            }
            const res = await piSignoffService.applySignoff({
              studyId: sid,
              crfDataId,
              password: trimmedPassword,
              ...(trimmedComment ? { comment: trimmedComment } : {}),
            })
            if (res?.isSuccess) okCount += 1
            else failCount += 1
          } catch {
            failCount += 1
          }
        }

        await Promise.all([
          syncPatientVisitCrfFromGrid(target.id),
          typeof reloadPiPendingSummary === "function" ? reloadPiPendingSummary() : Promise.resolve(),
        ])
        setPiSignoffRefreshToken((t) => t + 1)

        if (okCount > 0 && failCount === 0 && blockedCount === 0) {
          toast({
            title: "Bulk PI sign-off done",
            description: `PI sign-off applied for ${okCount} ready CRF(s)${
              skippedCount > 0 ? ` (${skippedCount} already signed)` : ""
            }.`,
          })
        } else if (okCount > 0) {
          toast({
            title: "Partial PI sign-off",
            description: `Signed ${okCount} CRF(s); ${failCount} failed${
              blockedCount > 0 ? `; ${blockedCount} blocked (queries/SDV)` : ""
            }${skippedCount > 0 ? `; ${skippedCount} already signed` : ""}.`,
            variant: "destructive",
          })
        } else if (skippedCount > 0 && failCount === 0 && blockedCount === 0) {
          toast({
            title: "Already signed",
            description: `All ${skippedCount} CRF(s) were already PI signed.`,
          })
        } else if (blockedCount > 0 && failCount === 0) {
          toast({
            title: "PI blocked",
            description:
              "CRFs are not ready (open queries or SDV/re-SDV required). Resolve queries, re-SDV, then retry.",
            variant: "destructive",
          })
        } else {
          toast({
            title: "Bulk PI sign-off failed",
            description: "Could not apply PI sign-off. Check password, SDV order, and permissions.",
            variant: "destructive",
          })
        }

        return okCount > 0 || (skippedCount > 0 && failCount === 0 && blockedCount === 0)
      } finally {
        setAllVisitsPiSaving(false)
      }
    },
    [
      allVisitsPiDialog.patient,
      allVisitsPiDialog.entries,
      allVisitsPiSaving,
      studyId,
      syncPatientVisitCrfFromGrid,
      reloadPiPendingSummary,
      toast,
    ],
  )

  const currentCrfDataId = useMemo(() => selectedForm?.crfDataId ?? null, [selectedForm])

  const refreshCrfProgressDetail = useCallback(async () => {
    const crfDataIdNum = Number.parseInt(String(currentCrfDataId ?? ""), 10)
    const studyIdNum = Number.parseInt(String(studyId ?? ""), 10)
    if (!Number.isFinite(crfDataIdNum) || crfDataIdNum <= 0 || !Number.isFinite(studyIdNum) || studyIdNum <= 0) {
      setCrfProgressDetail(null)
      return
    }

    setLoadingCrfProgress(true)
    try {
      const res = await crfDataService.getCrfProgress(crfDataIdNum, studyIdNum)
      if (res?.isSuccess && res.data) {
        setCrfProgressDetail(normalizeCrfProgress(res.data))
      } else {
        setCrfProgressDetail(null)
      }
    } catch {
      setCrfProgressDetail(null)
    } finally {
      setLoadingCrfProgress(false)
    }
  }, [currentCrfDataId, studyId])

  useEffect(() => {
    void refreshCrfProgressDetail()
  }, [refreshCrfProgressDetail, lastSavedAt])

  const activeDataEntrySectionForProgress = useMemo(() => {
    const sections = sectionsWithContentForDataEntry
    if (!Array.isArray(sections) || sections.length === 0) return null
    const effectiveId =
      activeDataEntrySectionId &&
      sections.some((section) => String(section?.id) === String(activeDataEntrySectionId))
        ? activeDataEntrySectionId
        : sections[0]?.id
    return sections.find((section) => String(section?.id) === String(effectiveId)) ?? sections[0] ?? null
  }, [sectionsWithContentForDataEntry, activeDataEntrySectionId])

  const liveActiveSectionProgress = useMemo(() => {
    if (!selectedForm?.id || !activeDataEntrySectionForProgress) return null
    return computeClientSectionProgress({
      sectionId: activeDataEntrySectionForProgress.id,
      controls: activeDataEntrySectionForProgress.controls || [],
      formValues: currentRenderFormValues,
      evaluatedControlsById: evaluatedControlsByIdForCurrentForm,
      patient: selectedPatient,
      hasMeaningfulValue: hasAnyMeaningfulValue,
    })
  }, [
    selectedForm?.id,
    activeDataEntrySectionForProgress,
    currentRenderFormValues,
    evaluatedControlsByIdForCurrentForm,
    selectedPatient,
    hasAnyMeaningfulValue,
  ])

  const displayCrfProgressDetail = useMemo(() => {
    if (!liveActiveSectionProgress) return crfProgressDetail
    return mergeLiveSectionProgress(crfProgressDetail, liveActiveSectionProgress)
  }, [crfProgressDetail, liveActiveSectionProgress])

  const loadVisitSectionProgress = useCallback(
    async (visitId) => {
      if (!visitId || !studyId) return

      const visit = getVisitById(visitId)
      const gridProgress = selectedPatient
        ? getVisitProgressFromPatient(selectedPatient, visit?.visitScheduleId ?? visitId)
        : null
      const forms = availableFormsByVisit[visitId] || []
      const primaryForm = forms.find((form) => form?.crfDataId) || forms[0]
      const crfDataId =
        getPrimaryCrfDataIdForVisit({ visit, visitCrfDataMap, formsForVisit: forms }) ?? primaryForm?.crfDataId

      if (gridProgress?.sections?.length) {
        setVisitSectionProgressByVisitId((prev) => ({
          ...prev,
          [visitId]: {
            loading: false,
            progress: gridProgress,
            formSections: primaryForm?.crfDesign?.sections || [],
            formLabel: primaryForm?.crfDesignName || null,
          },
        }))
        return
      }

      if (!crfDataId) {
        setVisitSectionProgressByVisitId((prev) => ({
          ...prev,
          [visitId]: {
            loading: false,
            progress: gridProgress,
            formSections: primaryForm?.crfDesign?.sections || [],
            formLabel: primaryForm?.crfDesignName || null,
          },
        }))
        return
      }

      setVisitSectionProgressByVisitId((prev) => ({
        ...prev,
        [visitId]: {
          loading: true,
          progress: gridProgress,
          formSections: primaryForm?.crfDesign?.sections || [],
          formLabel: primaryForm?.crfDesignName || null,
        },
      }))

      try {
        const studyIdNum = Number.parseInt(String(studyId), 10)
        const res = await crfDataService.getCrfProgress(crfDataId, studyIdNum)
        if (res?.isSuccess && res.data) {
          setVisitSectionProgressByVisitId((prev) => ({
            ...prev,
            [visitId]: {
              loading: false,
              progress: normalizeCrfProgress(res.data),
              formSections: primaryForm?.crfDesign?.sections || [],
              formLabel: primaryForm?.crfDesignName || null,
            },
          }))
        } else {
          setVisitSectionProgressByVisitId((prev) => ({
            ...prev,
            [visitId]: {
              loading: false,
              progress: gridProgress,
              formSections: primaryForm?.crfDesign?.sections || [],
              formLabel: primaryForm?.crfDesignName || null,
            },
          }))
        }
      } catch {
        setVisitSectionProgressByVisitId((prev) => ({
          ...prev,
          [visitId]: {
            loading: false,
            progress: gridProgress,
            formSections: primaryForm?.crfDesign?.sections || [],
            formLabel: primaryForm?.crfDesignName || null,
          },
        }))
      }
    },
    [studyId, availableFormsByVisit, selectedPatient, getVisitById, visitCrfDataMap],
  )

  useEffect(() => {
    prefetchedVisitSectionProgressRef.current = new Set()
    setVisitSectionProgressByVisitId({})
  }, [selectedPatient?.id])

  useEffect(() => {
    if (!selectedPatient?.id || selectedVisit) return
    for (const visit of sortedVisibleVisits) {
      const visitId = visit?.id
      if (!visitId) continue

      const gridProgress = getVisitProgressFromPatient(
        selectedPatient,
        visit.visitScheduleId ?? visitId,
      )
      if (!gridProgress?.sections?.length) continue

      setVisitSectionProgressByVisitId((prev) => {
        if (prev[visitId]?.progress?.sections?.length) return prev
        return {
          ...prev,
          [visitId]: {
            loading: false,
            progress: gridProgress,
            formSections: [],
            formLabel: null,
          },
        }
      })
    }
  }, [selectedPatient?.id, selectedVisit, sortedVisibleVisits, selectedPatient])

  useEffect(() => {
    if (!showFormDropdown) return
    void loadVisitSectionProgress(showFormDropdown)
  }, [showFormDropdown, availableFormsByVisit, loadVisitSectionProgress])

  useEffect(() => {
    if (!showFormDropdown || !lastSavedAt) return
    void loadVisitSectionProgress(showFormDropdown)
  }, [lastSavedAt, showFormDropdown, loadVisitSectionProgress])

  /** Resolve visit display name for query grid (visitScheduleId → visitName from study visit list). */
  const patientQueryGridVisitNameByScheduleId = useMemo(() => {
    const m = new Map()
    for (const v of visits || []) {
      const sid = v?.visitScheduleId
      if (sid == null || sid === "") continue
      m.set(String(sid), v.name || "—")
    }
    return m
  }, [visits])

  /** Resolve CRF display name for query grid (crfDesignId → name from visit CRF designs / loaded forms). */
  const patientQueryGridCrfNameByDesignId = useMemo(() => {
    const m = new Map()
    for (const v of visits || []) {
      const designs = Array.isArray(v?.crfDesigns) ? v.crfDesigns : []
      for (const d of designs) {
        const id = d?.crfDesignId ?? d?.crfDesignID ?? d?.id
        if (id == null || id === "") continue
        const name = d?.crfName ?? d?.name ?? d?.designName ?? d?.crfDesignName
        if (name) m.set(String(id), String(name))
      }
    }
    for (const forms of Object.values(availableFormsByVisit || {})) {
      if (!Array.isArray(forms)) continue
      for (const f of forms) {
        const id = f?.crfDesignId
        if (id == null || id === "") continue
        const key = String(id)
        if (!m.has(key) && f.crfDesignName) m.set(key, String(f.crfDesignName))
      }
    }
    return m
  }, [visits, availableFormsByVisit])

  const PATIENT_QUERY_PAGE_SIZE = 10

  const patientQueryFilteredRows = useMemo(() => {
    if (!Array.isArray(patientQueriesList) || patientQueriesList.length === 0) return []

    let rows = patientQueriesList
    if (patientQueryVisitScheduleId != null && patientQueryVisitScheduleId !== "") {
      const visitKey = String(patientQueryVisitScheduleId)
      rows = rows.filter((row) => {
        const rowVisitId = queryDtoPick(row, "visitScheduleId", "VisitScheduleId")
        return rowVisitId != null && String(rowVisitId) === visitKey
      })
    }

    const term = patientQuerySearch.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((row) => {
      const pieces = []
      pieces.push(queryDtoPick(row, "fieldLabel", "FieldLabel"))
      pieces.push(queryDtoPick(row, "queryText", "QueryText"))
      pieces.push(queryDtoPick(row, "expectedCondition", "ExpectedCondition"))
      pieces.push(queryDtoPick(row, "actualValue", "ActualValue"))
      pieces.push(queryDtoPick(row, "queryRaisedByUserName", "QueryRaisedByUserName"))
      pieces.push(queryDtoPick(row, "queryAssignedToUserName", "QueryAssignedToUserName"))
      const vsidRaw = queryDtoPick(row, "visitScheduleId", "VisitScheduleId")
      const vsidStr = vsidRaw != null && vsidRaw !== "" ? String(vsidRaw) : ""
      if (vsidStr && patientQueryGridVisitNameByScheduleId.has(vsidStr)) {
        pieces.push(patientQueryGridVisitNameByScheduleId.get(vsidStr))
      }
      const didRaw = queryDtoPick(row, "crfDesignId", "CrfDesignId")
      const didStr = didRaw != null && didRaw !== "" ? String(didRaw) : ""
      if (didStr && patientQueryGridCrfNameByDesignId.has(didStr)) {
        pieces.push(patientQueryGridCrfNameByDesignId.get(didStr))
      }
      const haystack = pieces
        .map((p) => (p == null ? "" : String(p)))
        .join(" ")
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [
    patientQueriesList,
    patientQuerySearch,
    patientQueryVisitScheduleId,
    patientQueryGridVisitNameByScheduleId,
    patientQueryGridCrfNameByDesignId,
  ])

  const patientQueryTotalPages = useMemo(() => {
    if (patientQueryFilteredRows.length === 0) return 1
    return Math.max(1, Math.ceil(patientQueryFilteredRows.length / PATIENT_QUERY_PAGE_SIZE))
  }, [patientQueryFilteredRows.length])

  const patientQueryPageSafe = useMemo(
    () => Math.min(Math.max(patientQueryPage, 1), patientQueryTotalPages),
    [patientQueryPage, patientQueryTotalPages],
  )

  const patientQueryPageRows = useMemo(() => {
    if (patientQueryFilteredRows.length === 0) return []
    const start = (patientQueryPageSafe - 1) * PATIENT_QUERY_PAGE_SIZE
    const end = start + PATIENT_QUERY_PAGE_SIZE
    return patientQueryFilteredRows.slice(start, end)
  }, [patientQueryFilteredRows, patientQueryPageSafe])

  const refreshCrfQueries = useCallback(async () => {
    if (!currentCrfDataId || !canWorkOnQueries) {
      setCrfQueriesFromApi([])
      return
    }
    const res = await crfQueryManagementService.getQueryListByCrfDataId(currentCrfDataId)
    if (res?.isSuccess && Array.isArray(res.data)) {
      const filtered = dedupeQueries(
        filterQueriesForCurrentUser(res.data, loggedInUserId, {
          scopeToCurrentUser: shouldScopeQueriesToCurrentUser,
        }),
      )
      setCrfQueriesFromApi(filtered)
    } else {
      setCrfQueriesFromApi([])
    }
  }, [currentCrfDataId, canWorkOnQueries, loggedInUserId, shouldScopeQueriesToCurrentUser])

  const clearLocalVerificationForQueryField = useCallback(
    (fieldId) => {
      const formId = selectedForm?.id
      if (!formId || !fieldId) return
      const controlId = resolveControlIdFromQueryFieldId(fieldId)
      if (!controlId) return
      const sdvKey = getSdvFieldKey(formId, controlId)
      const piKey = getPiFieldKey(formId, controlId)

      setSdvApprovedByField((prev) => {
        if (!prev[sdvKey]) return prev
        const next = { ...prev, [sdvKey]: false }
        sdvApprovedByFieldRef.current = next
        return next
      })
      setSdvSelectionsByField((prev) => {
        if (!prev[sdvKey]) return prev
        return { ...prev, [sdvKey]: false }
      })
      setPiSignedByField((prev) => {
        if (!prev[piKey]) return prev
        const next = { ...prev, [piKey]: false }
        piSignedByFieldRef.current = next
        return next
      })
      setPiSelectionsByField((prev) => {
        if (!prev[piKey]) return prev
        return { ...prev, [piKey]: false }
      })
      if (sdvAuditMetaByFieldRef.current[sdvKey]) {
        const nextAudit = { ...sdvAuditMetaByFieldRef.current }
        delete nextAudit[sdvKey]
        sdvAuditMetaByFieldRef.current = nextAudit
      }
      if (piAuditMetaByFieldRef.current[piKey]) {
        const nextPiAudit = { ...piAuditMetaByFieldRef.current }
        delete nextPiAudit[piKey]
        piAuditMetaByFieldRef.current = nextPiAudit
      }
    },
    [selectedForm?.id, getSdvFieldKey, getPiFieldKey],
  )

  /** After query create/close: clear local SDV/PI for the field; do not reload stale flags from API. */
  const syncVerificationStateAfterQueryChange = useCallback(
    async (queriedFieldId) => {
      if (queriedFieldId) {
        clearLocalVerificationForQueryField(queriedFieldId)
      }
      setPiSignoffRefreshToken((t) => t + 1)
    },
    [clearLocalVerificationForQueryField],
  )

  /** Header query pills: grid summary first, then patient query list when loaded. */
  const headerPatientQueryCounts = useMemo(() => {
    const fromGrid = normalizeCrfQuerySummary(selectedPatient?.querySummary)

    if (!loadingPatientQueriesList && Array.isArray(patientQueriesList) && patientQueriesList.length > 0) {
      let open = 0
      let inProcess = 0
      let closed = 0
      for (const q of patientQueriesList) {
        const s = normalizeQueryStatus(q?.status)
        if (s === QUERY_STATUS_OPEN) open++
        else if (s === QUERY_STATUS_IN_PROCESS) inProcess++
        else if (s === QUERY_STATUS_CLOSED) closed++
      }
      return { open, inProcess, closed }
    }

    if (hasCrfQueryActivity(fromGrid)) {
      return { open: fromGrid.open, inProcess: fromGrid.inProcess, closed: fromGrid.closed }
    }

    if (!loadingPatientQueriesList) {
      return { open: 0, inProcess: 0, closed: 0 }
    }

    return { open: fromGrid.open, inProcess: fromGrid.inProcess, closed: fromGrid.closed }
  }, [selectedPatient?.querySummary, patientQueriesList, loadingPatientQueriesList])

  const selectedPatientQuerySummary = useMemo(
    () => normalizeCrfQuerySummary(selectedPatient?.querySummary),
    [selectedPatient?.querySummary],
  )

  const loadPatientQueriesList = useCallback(async () => {
    const sid = parseInt(String(studyId ?? ""), 10)
    const site = parseInt(String(siteId ?? ""), 10)
    const pid = parseInt(String(selectedPatient?.id ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0 || !Number.isFinite(site) || site <= 0 || !Number.isFinite(pid) || pid <= 0) {
      setPatientQueriesList([])
      return
    }
    setLoadingPatientQueriesList(true)
    try {
      const res = await crfQueryManagementService.getQueryListByStudySitePatient({
        studyId: sid,
        siteId: site,
        patientEnrolmentId: pid,
      })
      const raw = res?.isSuccess && Array.isArray(res.data) ? res.data : []
      // Patient-wise list: show all rows from GetQueryListByStudySitePatient (API guide), not CRM user scope.
      const rows = dedupeQueries(raw.filter((r) => r?.isDeleted !== true && r?.IsDeleted !== true))
      const sorted = [...rows].sort(
        (a, b) => Number(b?.id ?? b?.queryId ?? 0) - Number(a?.id ?? a?.queryId ?? 0),
      )
      setPatientQueriesList(sorted)
    } catch {
      setPatientQueriesList([])
    } finally {
      setLoadingPatientQueriesList(false)
    }
  }, [studyId, siteId, selectedPatient?.id])

  useEffect(() => {
    void loadPatientQueriesList()
  }, [loadPatientQueriesList, patientQueriesRefreshTick])

  useEffect(() => {
    if (pendingOpenQueriesTabRef.current) {
      pendingOpenQueriesTabRef.current = false
      setPatientMainTab("queries")
      if (pendingQueryVisitScheduleIdRef.current != null) {
        setPatientQueryVisitScheduleId(pendingQueryVisitScheduleIdRef.current)
        pendingQueryVisitScheduleIdRef.current = null
      }
    } else {
      setPatientMainTab("visits")
      setPatientQueryVisitScheduleId(null)
    }
    setPatientQuerySearch("")
    setPatientQueryPage(1)
  }, [selectedPatient?.id])

  useEffect(() => {
    if (patientMainTab === "queries" && selectedPatient?.id) {
      setPatientQueriesRefreshTick((t) => t + 1)
    }
  }, [patientMainTab, selectedPatient?.id])

  useEffect(() => {
    setPatientQueryPage(1)
  }, [patientQuerySearch, patientQueriesList.length])

  useEffect(() => {
    setQueryDraft({
      fieldId: "",
      fieldLabel: "",
      controlType: "",
        isTableQuery: false,
      controlOptions: [],
      tableColumnIndex: "",
      tableColumnLabel: "",
      tableRowIndex: "",
      tableRowLabel: "",
      tableColumnOptions: [],
      tableRowOptions: [],
      expectedCondition: "",
      actualValue: "",
      queryText: "",
      reviewerComment: "",
    })
  }, [selectedForm?.id])

  useEffect(() => {
    void refreshCrfQueries()
  }, [refreshCrfQueries])

  useEffect(() => {
    if (crmSystemQueryReview) {
      setSystemQueryCommentDraft(getQueryApproverComment(crmSystemQueryReview) || "")
      setSystemQuerySubmitterCommentDraft(getCrfSubmitterComment(crmSystemQueryReview) || "")
    } else {
      setSystemQueryCommentDraft("")
      setSystemQuerySubmitterCommentDraft("")
    }
  }, [crmSystemQueryReview])

  useEffect(() => {
    if (manualQueryReview) {
      setManualReviewerCommentDraft(getQueryApproverComment(manualQueryReview) || "")
      setManualSubmittedCommentDraft(getCrfSubmitterComment(manualQueryReview) || "")
    } else {
      setManualReviewerCommentDraft("")
      setManualSubmittedCommentDraft("")
    }
  }, [manualQueryReview])

  const openManualQueryDraft = useCallback(
    (fieldId, fieldLabel, actualValueRaw, options = {}) => {
      if (!canRaiseManualQueries) return
      setQueryDraft({
        fieldId: String(fieldId || ""),
        fieldLabel: String(fieldLabel || fieldId || ""),
        controlType: String(options?.controlType || ""),
        isTableQuery: Boolean(options?.isTableQuery),
        controlOptions: Array.isArray(options?.controlOptions) ? options.controlOptions : [],
        tableColumnIndex:
          options?.preselectedTableColumnIndex !== undefined &&
          options?.preselectedTableColumnIndex !== null
            ? String(options.preselectedTableColumnIndex)
            : "",
        tableColumnLabel: String(options?.preselectedTableColumnLabel || ""),
        tableRowIndex: String(options?.preselectedTableRowIndex || ""),
        tableRowLabel: String(options?.preselectedTableRowLabel || ""),
        tableColumnOptions: Array.isArray(options?.tableColumnOptions) ? options.tableColumnOptions : [],
        tableRowOptions: Array.isArray(options?.tableRowOptions) ? options.tableRowOptions : [],
        expectedCondition: "",
        actualValue: stringifyQueryActualValue(actualValueRaw),
        queryText: "",
        reviewerComment: "",
      })
    },
    [canRaiseManualQueries]
  )

  const cancelManualQueryDraft = useCallback(() => {
    setQueryDraft({
      fieldId: "",
      fieldLabel: "",
      controlType: "",
      isTableQuery: false,
      controlOptions: [],
      tableColumnIndex: "",
      tableColumnLabel: "",
      tableRowIndex: "",
      tableRowLabel: "",
      tableColumnOptions: [],
      tableRowOptions: [],
      expectedCondition: "",
      actualValue: "",
      queryText: "",
      reviewerComment: "",
    })
  }, [])

  const createManualFieldQuery = useCallback(async () => {
    if (!canRaiseManualQueries) return
    if (!currentCrfDataId) {
      toast({
        title: "Cannot create query",
        description: "CRF data id is missing for this form.",
        variant: "destructive",
        duration: 2500,
      })
      return
    }
    const expectedCondition = (queryDraft.expectedCondition || "").trim()
    // Note: `queryDraft.queryText` (the free-text "Query details" textarea) is
    // intentionally NOT consumed here — it is no longer part of the API
    // QueryText body. The textarea remains in the modal as an optional
    // local note; if a future requirement needs it sent (e.g. to a separate
    // backend field), re-introduce it explicitly at that time.
    const reviewerComment = (queryDraft.reviewerComment || "").trim()
    const baseFieldId = (queryDraft.fieldId || "").trim()
    const baseFieldLabel = (queryDraft.fieldLabel || "").trim() || baseFieldId
    let fieldId = baseFieldId
    let fieldLabel = baseFieldLabel
    let actualValue = (queryDraft.actualValue || "").trim()

    if (queryDraft.isTableQuery) {
      const columnIdx = parseInt(String(queryDraft.tableColumnIndex || ""), 10)
      if (Number.isNaN(columnIdx) || columnIdx < 0) {
        toast({
          title: "Select table column",
          description: "Please select which table column this query is for.",
          variant: "destructive",
          duration: 2600,
        })
        return
      }
      const columnLabel =
        queryDraft.tableColumnLabel ||
        queryDraft.tableColumnOptions?.find((opt) => Number(opt?.index) === columnIdx)?.label ||
        `Column ${columnIdx + 1}`
      const rowNumber = parseInt(String(queryDraft.tableRowIndex || ""), 10)
      if (Number.isNaN(rowNumber) || rowNumber <= 0) {
        toast({
          title: "Select table row",
          description: "Please select which table row this query is for.",
          variant: "destructive",
          duration: 2600,
        })
        return
      }

      const rowLabel =
        queryDraft.tableRowLabel ||
        queryDraft.tableRowOptions?.find((opt) => Number(opt?.index) === rowNumber)?.label ||
        `Row ${rowNumber}`
      // Keep query fieldId aligned with saved CRF flat keys for table cells.
      // Example: tableId_row_0_col_1 (not decorated tableId__col_1__row_1).
      fieldId = `${baseFieldId}_row_${rowNumber - 1}_col_${columnIdx}`
      fieldLabel = `${baseFieldLabel} > ${columnLabel} > ${rowLabel}`

      if (!actualValue) {
        const rawCellValue = (formData[selectedForm?.id] || {})[`${baseFieldId}_row_${rowNumber - 1}_col_${columnIdx}`]
        actualValue = stringifyQueryActualValue(rawCellValue)
      }
    }

    // QueryText sent to the API is built from Expected / Actual only (see
    // `composedQueryText` below). Require at least an Expected condition so
    // the API payload's QueryText is never empty. The free-text "Query
    // details" textarea (`queryText` local var) is no longer part of the API
    // QueryText body, so it is optional here.
    if (!fieldId || !fieldLabel || !expectedCondition) {
      toast({
        title: "Missing details",
        description: "Expected condition is required to raise a query.",
        variant: "destructive",
        duration: 2800,
      })
      return
    }

    const targetFieldKey = normalizeQueryFieldKey(fieldId)
    const alreadyOpenForTarget = crfQueriesFromApi.some(
      (q) =>
        isManualQueryType(q) &&
        isQueryOpenStatus(q.status) &&
        normalizeQueryFieldKey(q.fieldId) === targetFieldKey
    )
    if (alreadyOpenForTarget) {
      toast({
        title: "Query already open",
        description: `An open manual query already exists for ${fieldLabel}.`,
        variant: "destructive",
        duration: 2400,
      })
      return
    }

    const studyIdNum = parseInt(String(studyId ?? ""), 10)
    const siteIdNum = parseInt(String(siteId ?? ""), 10)
    const patientEnrolmentIdNum = parseInt(String(selectedPatient?.id ?? ""), 10)
    const visitScheduleIdNum = parseInt(String(selectedVisit?.visitScheduleId ?? ""), 10)
    const crfDesignIdNum = parseInt(String(selectedForm?.crfDesignId ?? ""), 10)
    const crfDataIdNum = parseInt(String(currentCrfDataId ?? ""), 10)

    if (
      ![studyIdNum, siteIdNum, patientEnrolmentIdNum, visitScheduleIdNum, crfDesignIdNum, crfDataIdNum].every(
        (n) => Number.isFinite(n) && n > 0
      )
    ) {
      toast({
        title: "Missing context",
        description: "Study, site, patient, visit, CRF design, and CRF data must be valid before raising a query.",
        variant: "destructive",
        duration: 3200,
      })
      return
    }

    const safeFieldId = fieldId.slice(0, 200)
    const safeFieldLabel = fieldLabel.slice(0, 300)
    // QueryText sent to the API contains ONLY the structured Expected / Actual
    // delta — the free-text "Query details" textarea content (`queryText`
    // local var) is intentionally NOT concatenated here. It is treated as an
    // explanatory note that does not belong inside the formal QueryText body.
    const queryDetailsText = String(queryDraft.queryText || "").trim()
    const composedQueryText = [
      expectedCondition && `Expected: ${expectedCondition}`,
      actualValue && `Actual: ${actualValue}`,
      queryDetailsText && `Details: ${queryDetailsText}`,
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 8000)

    const payload = {
      studyId: studyIdNum,
      siteId: siteIdNum,
      patientEnrolmentId: patientEnrolmentIdNum,
      visitScheduleId: visitScheduleIdNum,
      crfDesignId: crfDesignIdNum,
      crfDataId: crfDataIdNum,
      fieldId: safeFieldId,
      fieldLabel: safeFieldLabel,
      expectedCondition: expectedCondition || null,
      actualValue: actualValue || null,
      queryText: composedQueryText,
      queryApproverComment: reviewerComment || null,
    }

    const res = await crfQueryManagementService.createManualGeneratedQuery(payload)
    if (res?.isSuccess && res.data) {
      cancelManualQueryDraft()
      toast({
        title: "Query raised",
        description: `Manual query created for ${safeFieldLabel}.`,
        variant: "success",
        duration: 2200,
      })
      await refreshCrfQueries()
      await loadPatientQueriesList()
      await syncVerificationStateAfterQueryChange(safeFieldId)
    } else {
      const msg = res?.message || (Array.isArray(res?.errors) ? res.errors.join(", ") : null) || "Failed to create manual query"
      toast({
        title: "Query not created",
        description: typeof msg === "string" ? msg : "Request failed",
        variant: "destructive",
        duration: 4000,
      })
    }
  }, [
    canRaiseManualQueries,
    currentCrfDataId,
    queryDraft,
    formData,
    selectedForm?.id,
    studyId,
    siteId,
    selectedPatient?.id,
    selectedVisit?.visitScheduleId,
    selectedForm?.crfDesignId,
    cancelManualQueryDraft,
    crfQueriesFromApi,
    refreshCrfQueries,
    loadPatientQueriesList,
    syncVerificationStateAfterQueryChange,
  ])

  /** System + manual submitter: UpdateSubmittedUserComment; reviewer: UpdateReviewer. */
  const saveSystemQueryComment = useCallback(async () => {
    if (!crmSystemQueryReview) return
    const queryId = Number(crmSystemQueryReview.id ?? crmSystemQueryReview.queryId)
    if (!Number.isFinite(queryId) || queryId <= 0) return
    if (isQueryClosedStatus(crmSystemQueryReview.status)) {
      toast({
        title: "Query already closed",
        description: "Comments cannot be updated on a closed query.",
        variant: "destructive",
        duration: 3000,
      })
      return
    }

    const submittedBy = Number(getQueryAssignedToUserId(crmSystemQueryReview))
    const isSubmittedOwner = Number.isFinite(submittedBy) && loggedInUserId === submittedBy

    if (isSubmittedOwner) {
      if (!canRespondToQueries) {
        toast({
          title: "Not allowed",
          description: "Your role does not have permission to respond to queries.",
          variant: "destructive",
          duration: 3000,
        })
        return
      }
    } else if (!canCloseQueriesByMatrix && !studyPermGates.canCreateQuery) {
      toast({
        title: "Not allowed",
        description: "Your role does not have permission to update this query.",
        variant: "destructive",
        duration: 3000,
      })
      return
    }

    const fieldId = String(crmSystemQueryReview.fieldId || "").trim()
    const formId = selectedForm?.id
    const liveRaw =
      fieldId && formId
        ? getLiveQueryFieldValueRaw(fieldId, formId, formData, optimisticControlValues)
        : undefined
    const persistedRaw =
      fieldId && formId ? getPersistedActualValueForQueryField(crmSystemQueryReview, formId) : ""
    const persistedTrim = String(stringifyQueryActualValue(persistedRaw) ?? "").trim()
    const newActualTrim = String(stringifyQueryActualValue(liveRaw) ?? "").trim()
    const valueChanged = isSubmittedOwner && fieldId && newActualTrim !== persistedTrim
    const newActualForApiString = newActualTrim
    const actualValueForApi = valueChanged && fieldId ? newActualForApiString : null
    const correctedFieldValueForApi = valueChanged && fieldId ? newActualForApiString : null

    if (isSubmittedOwner && valueChanged && fieldId && selectedForm?.id) {
      const formSlice = formData?.[selectedForm.id] || {}
      const check = validateQueryModalActualValue({
        fieldId,
        draftValue: liveRaw,
        formSlice,
        selectedForm,
        currentFormSections,
        getRuleAwareControl,
        patientGender: selectedPatient?.gender,
      })
      if (!check.isValid) {
        const errs = check.errors || []
        setSystemQueryActualErrors(errs)
        toast({
          title: "Cannot save",
          description: errs[0] || "Actual value is not valid for this field.",
          variant: "destructive",
          duration: 4000,
        })
        return
      }
    }

    setQueryModalSaving(true)
    try {
      let res
      if (isSubmittedOwner) {
        res = await crfQueryManagementService.updateSubmittedUserComment({
          queryId,
          crfSubmitterComment: (systemQuerySubmitterCommentDraft || "").trim(),
          actualValue: actualValueForApi,
          correctedFieldValue: correctedFieldValueForApi,
        })
      } else {
        res = await crfQueryManagementService.updateReviewer({
          queryId,
          queryApproverComment: (systemQueryCommentDraft || "").trim() || null,
        })
      }

      if (res?.isSuccess) {
        if (isSubmittedOwner && valueChanged && fieldId && selectedForm?.id) {
          handleFormInputChange(fieldId, liveRaw !== undefined ? liveRaw : newActualForApiString)
          setFormAuditBaselineById((prev) => {
            const cur = prev[selectedForm.id] || { values: {}, hasPersistedRecord: false }
            return {
              ...prev,
              [selectedForm.id]: {
                ...cur,
                hasPersistedRecord: true,
                values: {
                  ...cur.values,
                  [fieldId]: liveRaw !== undefined ? liveRaw : newActualForApiString,
                },
              },
            }
          })
        }
        toast({
          title: "Query saved successfully",
          description: "Your query update has been saved.",
          variant: "success",
          duration: 2000,
        })
        const queriedFieldId = crmSystemQueryReview?.fieldId
        setCrmSystemQueryReview(null)
        await refreshCrfQueries()
        await loadPatientQueriesList()
        await syncVerificationStateAfterQueryChange(queriedFieldId)
      } else {
        toast({
          title: "Save failed",
          description: res?.message || "Could not save",
          variant: "destructive",
          duration: 3500,
        })
      }
    } finally {
      setQueryModalSaving(false)
    }
  }, [
    crmSystemQueryReview,
    loggedInUserId,
    systemQueryCommentDraft,
    systemQuerySubmitterCommentDraft,
    formData,
    optimisticControlValues,
    selectedForm,
    currentFormSections,
    getRuleAwareControl,
    selectedPatient?.gender,
    refreshCrfQueries,
    loadPatientQueriesList,
    syncVerificationStateAfterQueryChange,
    handleFormInputChange,
    getPersistedActualValueForQueryField,
    setFormAuditBaselineById,
    canRespondToQueries,
    canCloseQueriesByMatrix,
    studyPermGates.canCreateQuery,
  ])

  const closeSystemQueryFromReviewer = useCallback(async () => {
    if (!crmSystemQueryReview?.id) return
    if (!canCloseQueriesByMatrix) {
      toast({
        title: "Not allowed",
        description: "Your role does not have permission to close queries.",
        variant: "destructive",
        duration: 3000,
      })
      return
    }
    if (!canCurrentUserCloseQuery(crmSystemQueryReview, loggedInUserId)) {
      toast({
        title: "Not allowed",
        description: "You are not allowed to close this query.",
        variant: "destructive",
        duration: 3000,
      })
      return
    }
    const res = await crfQueryManagementService.updateStatus({
      queryId: crmSystemQueryReview.id,
      status: QUERY_STATUS_CLOSED,
    })
    if (res?.isSuccess) {
      const queriedFieldId = crmSystemQueryReview?.fieldId
      setCrmSystemQueryReview(null)
      toast({ title: "Query closed", variant: "success", duration: 2000 })
      await refreshCrfQueries()
      await loadPatientQueriesList()
      await syncVerificationStateAfterQueryChange(queriedFieldId)
    } else {
      toast({
        title: "Close failed",
        description: res?.message || "Could not close query",
        variant: "destructive",
        duration: 3500,
      })
    }
  }, [crmSystemQueryReview, refreshCrfQueries, loadPatientQueriesList, loggedInUserId, canCloseQueriesByMatrix, syncVerificationStateAfterQueryChange])

  const saveManualQueryComment = useCallback(async () => {
    if (!manualQueryReview) return
    const queryId = Number(manualQueryReview.id ?? manualQueryReview.queryId)
    if (!Number.isFinite(queryId) || queryId <= 0) return
    if (isQueryClosedStatus(manualQueryReview.status)) {
      toast({
        title: "Query already closed",
        description: "Comments cannot be updated on a closed query.",
        variant: "destructive",
        duration: 3000,
      })
      return
    }

    const submittedBy = Number(getQueryAssignedToUserId(manualQueryReview))
    const isSubmittedOwner = Number.isFinite(submittedBy) && loggedInUserId === submittedBy

    if (isSubmittedOwner) {
      if (!canRespondToQueries) {
        toast({
          title: "Not allowed",
          description: "Your role does not have permission to respond to queries.",
          variant: "destructive",
          duration: 3000,
        })
        return
      }
    } else if (!canCloseQueriesByMatrix && !studyPermGates.canCreateQuery) {
      toast({
        title: "Not allowed",
        description: "Your role does not have permission to update this query.",
        variant: "destructive",
        duration: 3000,
      })
      return
    }

    const fieldId = String(manualQueryReview.fieldId || "").trim()
    const formId = selectedForm?.id
    const liveRaw =
      fieldId && formId
        ? getLiveQueryFieldValueRaw(fieldId, formId, formData, optimisticControlValues)
        : undefined
    const persistedRaw =
      fieldId && formId ? getPersistedActualValueForQueryField(manualQueryReview, formId) : ""
    const persistedTrim = String(stringifyQueryActualValue(persistedRaw) ?? "").trim()
    const newActualTrim = String(stringifyQueryActualValue(liveRaw) ?? "").trim()
    const valueChanged = isSubmittedOwner && fieldId && newActualTrim !== persistedTrim
    const newActualForApiString = newActualTrim
    /** Query snapshot + CrfData field patch (server uses query.fieldId); null when unchanged vs last saved. */
    const actualValueForApi = valueChanged && fieldId ? newActualForApiString : null
    const correctedFieldValueForApi = valueChanged && fieldId ? newActualForApiString : null

    if (isSubmittedOwner && valueChanged && fieldId && selectedForm?.id) {
      const formSlice = formData?.[selectedForm.id] || {}
      const check = validateQueryModalActualValue({
        fieldId,
        draftValue: liveRaw,
        formSlice,
        selectedForm,
        currentFormSections,
        getRuleAwareControl,
        patientGender: selectedPatient?.gender,
      })
      if (!check.isValid) {
        const errs = check.errors || []
        setManualQueryActualErrors(errs)
        toast({
          title: "Cannot save",
          description: errs[0] || "Actual value is not valid for this field.",
          variant: "destructive",
          duration: 4000,
        })
        return
      }
    }

    setQueryModalSaving(true)
    try {
      // API split:
      // - queryApproverComment -> UpdateReviewer
      // - UpdateSubmittedUserComment: crfSubmitterComment + actualValue (query snapshot) + correctedFieldValue (CrfData patch)
      let res
      if (isSubmittedOwner) {
        res = await crfQueryManagementService.updateSubmittedUserComment({
          queryId,
          crfSubmitterComment: (manualSubmittedCommentDraft || "").trim(),
          actualValue: actualValueForApi,
          correctedFieldValue: correctedFieldValueForApi,
        })
      } else {
        res = await crfQueryManagementService.updateReviewer({
          queryId,
          queryApproverComment: (manualReviewerCommentDraft || "").trim(),
        })
      }

      if (res?.isSuccess) {
        if (valueChanged && fieldId && selectedForm?.id) {
          handleFormInputChange(fieldId, liveRaw !== undefined ? liveRaw : newActualForApiString)
          setFormAuditBaselineById((prev) => {
            const cur = prev[selectedForm.id] || { values: {}, hasPersistedRecord: false }
            return {
              ...prev,
              [selectedForm.id]: {
                ...cur,
                hasPersistedRecord: true,
                values: {
                  ...cur.values,
                  [fieldId]: liveRaw !== undefined ? liveRaw : newActualForApiString,
                },
              },
            }
          })
        }
        toast({
          title: "Query saved successfully",
          description: "Your query update has been saved.",
          variant: "success",
          duration: 2000,
        })
        const queriedFieldId = manualQueryReview?.fieldId
        setManualQueryReview(null)
        await refreshCrfQueries()
        await loadPatientQueriesList()
        await syncVerificationStateAfterQueryChange(queriedFieldId)
      } else {
        toast({
          title: "Save failed",
          description: res?.message || "Could not save comment",
          variant: "destructive",
          duration: 3200,
        })
      }
    } finally {
      setQueryModalSaving(false)
    }
  }, [
    manualQueryReview,
    loggedInUserId,
    manualSubmittedCommentDraft,
    manualReviewerCommentDraft,
    formData,
    optimisticControlValues,
    selectedForm,
    currentFormSections,
    getRuleAwareControl,
    selectedPatient?.gender,
    refreshCrfQueries,
    loadPatientQueriesList,
    syncVerificationStateAfterQueryChange,
    handleFormInputChange,
    getPersistedActualValueForQueryField,
    setFormAuditBaselineById,
  ])

  const closeManualQueryFromReviewer = useCallback(async () => {
    if (!manualQueryReview) return
    const queryId = Number(manualQueryReview.id ?? manualQueryReview.queryId)
    if (!Number.isFinite(queryId) || queryId <= 0) return
    if (!canCloseQueriesByMatrix) {
      toast({
        title: "Not allowed",
        description: "Your role does not have permission to close queries.",
        variant: "destructive",
        duration: 3000,
      })
      return
    }
    if (!canCurrentUserCloseQuery(manualQueryReview, loggedInUserId)) {
      toast({
        title: "Not allowed",
        description: "You are not allowed to close this query.",
        variant: "destructive",
        duration: 3000,
      })
      return
    }
    const res = await crfQueryManagementService.updateStatus({
      queryId,
      status: QUERY_STATUS_CLOSED,
    })
    if (res?.isSuccess) {
      const queriedFieldId = manualQueryReview?.fieldId
      toast({ title: "Query closed", variant: "success", duration: 2000 })
      setManualQueryReview(null)
      await refreshCrfQueries()
      await loadPatientQueriesList()
      await syncVerificationStateAfterQueryChange(queriedFieldId)
    } else {
      toast({
        title: "Close failed",
        description: res?.message || "Could not close query",
        variant: "destructive",
        duration: 3200,
      })
    }
  }, [manualQueryReview, loggedInUserId, refreshCrfQueries, loadPatientQueriesList, canCloseQueriesByMatrix, syncVerificationStateAfterQueryChange])

  const handleScreeningFailedCancel = useCallback(async () => {
    setShowScreeningFailedModal(false)
    if (submitPopupFlow.active && submitPopupFlow.showRandomizedAfterScreening) {
      setSubmitPopupFlow((prev) => ({ ...prev, showRandomizedAfterScreening: false }))
      setShowRandomizedEnrolledModal(true)
      return
    }
    if (submitPopupFlow.active) {
      setSubmitPopupFlow({ active: false, showRandomizedAfterScreening: false, totalSteps: 1 })
      await handleSaveCrfData(3, { skipPreSubmitPopups: true, skipSubmitConfirm: true })
    }
  }, [submitPopupFlow, handleSaveCrfData])

  const handleScreeningFailedConfirm = useCallback(async () => {
    if (!studyId || !selectedPatient?.id) {
      toast({
        title: "Status update failed",
        description: "Study or patient is missing.",
        variant: "destructive",
      })
      setShowScreeningFailedModal(false)
      setSubmitPopupFlow({ active: false, showRandomizedAfterScreening: false, totalSteps: 1 })
      return
    }
    setScreeningFailedSubmitting(true)
    try {
      const res = await patientEnrolmentService.updatePatientStatus(studyId, selectedPatient.id, {
        newStatusCode: PATIENT_STATUS_CODES.SCREEN_FAILED,
        reason: null,
      })
      if (!res?.isSuccess) {
        toast({
          title: "Status update failed",
          description: res?.message || "Could not update patient status.",
          variant: "destructive",
        })
        setShowScreeningFailedModal(false)
        setSubmitPopupFlow({ active: false, showRandomizedAfterScreening: false, totalSteps: 1 })
        return
      }
      const updatedCode = res?.data?.currentStatusCode ?? PATIENT_STATUS_CODES.SCREEN_FAILED
      const updatedName = res?.data?.currentStatusName ?? "Screen Failed"
      setPatients((prev) =>
        prev.map((p) =>
          p.id === selectedPatient.id
            ? {
                ...p,
                currentStatusCode: updatedCode,
                currentStatusName: updatedName,
                patientStatusCode: updatedCode,
                patientStatusName: updatedName,
              }
            : p,
        ),
      )
      setSelectedPatient((prev) =>
        prev
          ? {
              ...prev,
              currentStatusCode: updatedCode,
              currentStatusName: updatedName,
              patientStatusCode: updatedCode,
              patientStatusName: updatedName,
            }
          : prev,
      )
      setShowScreeningFailedModal(false)
      if (submitPopupFlow.active && submitPopupFlow.showRandomizedAfterScreening) {
        setSubmitPopupFlow((prev) => ({ ...prev, showRandomizedAfterScreening: false }))
        setShowRandomizedEnrolledModal(true)
        return
      }
      if (submitPopupFlow.active) {
        setSubmitPopupFlow({ active: false, showRandomizedAfterScreening: false, totalSteps: 1 })
        await handleSaveCrfData(3, { skipPreSubmitPopups: true, skipSubmitConfirm: true })
      }
    } finally {
      setScreeningFailedSubmitting(false)
    }
  }, [studyId, selectedPatient, submitPopupFlow, handleSaveCrfData])

  const handleRandomizedNo = useCallback(async () => {
    setShowRandomizedEnrolledModal(false)
    if (submitPopupFlow.active) {
      setSubmitPopupFlow({ active: false, showRandomizedAfterScreening: false, totalSteps: 1 })
      await handleSaveCrfData(3, { skipPreSubmitPopups: true, skipSubmitConfirm: true })
    }
  }, [submitPopupFlow, handleSaveCrfData])

  const handleRandomizedYes = useCallback(async () => {
    setShowRandomizedEnrolledModal(false)
    if (!studyId || !selectedPatient?.id) {
      toast({
        title: "Status update failed",
        description: "Study or patient is missing.",
        variant: "destructive",
      })
      setSubmitPopupFlow({ active: false, showRandomizedAfterScreening: false, totalSteps: 1 })
      return
    }
    const res = await patientEnrolmentService.updatePatientStatus(studyId, selectedPatient.id, {
      newStatusCode: PATIENT_STATUS_CODES.RANDOMIZED_ENROLLED,
      reason: null,
    })
    if (!res?.isSuccess) {
      toast({
        title: "Status update failed",
        description: res?.message || "Could not update patient status.",
        variant: "destructive",
      })
      setSubmitPopupFlow({ active: false, showRandomizedAfterScreening: false, totalSteps: 1 })
      return
    }
    const updatedCode = res?.data?.currentStatusCode ?? PATIENT_STATUS_CODES.RANDOMIZED_ENROLLED
    const updatedName = res?.data?.currentStatusName ?? "Randomized/Enrolled"
    setPatients((prev) =>
      prev.map((p) =>
        p.id === selectedPatient.id
          ? {
              ...p,
              currentStatusCode: updatedCode,
              currentStatusName: updatedName,
              patientStatusCode: updatedCode,
              patientStatusName: updatedName,
            }
          : p,
      ),
    )
    setSelectedPatient((prev) =>
      prev
        ? {
            ...prev,
            currentStatusCode: updatedCode,
            currentStatusName: updatedName,
            patientStatusCode: updatedCode,
            patientStatusName: updatedName,
          }
        : prev,
    )
    if (submitPopupFlow.active) {
      setSubmitPopupFlow({ active: false, showRandomizedAfterScreening: false, totalSteps: 1 })
      await handleSaveCrfData(3, { skipPreSubmitPopups: true, skipSubmitConfirm: true })
    }
  }, [studyId, selectedPatient, submitPopupFlow, handleSaveCrfData])

  const handleSubmitConfirmCancel = useCallback(() => {
    setSubmitConfirmModalOpen(false)
  }, [])

  const handleSubmitConfirmSaveDraft = useCallback(async () => {
    setSubmitConfirmModalOpen(false)
    await handleSaveCrfData(2, {
      keepFormOpen: true,
      skipPreSubmitPopups: true,
      skipSubmitConfirm: true,
    })
  }, [handleSaveCrfData])

  const handleSubmitConfirmContinue = useCallback(async () => {
    setSubmitConfirmModalOpen(false)
    await handleSaveCrfData(3, { skipSubmitConfirm: true })
  }, [handleSaveCrfData])

  useEffect(() => {
    if (!submitConfirmModalOpen || !isAiQualityHintsEnabled || !selectedForm?.crfDataId) {
      if (!submitConfirmModalOpen) setAiQualityHints([])
      return
    }
    let alive = true
    setAiQualityHintsLoading(true)
    xemusAiService
      .analyzeCrfQuality({ crfDataId: selectedForm.crfDataId, studyId: Number(studyId) || undefined })
      .then((res) => {
        if (!alive) return
        const hints = res?.data?.hints ?? res?.data ?? []
        setAiQualityHints(Array.isArray(hints) ? hints : [])
      })
      .finally(() => {
        if (alive) setAiQualityHintsLoading(false)
      })
    return () => {
      alive = false
    }
  }, [submitConfirmModalOpen, isAiQualityHintsEnabled, selectedForm?.crfDataId, studyId])

  const handleErrorModalClose = useCallback(() => {
    setErrorModal({ open: false, message: "" })
  }, [])

  const handleDeleteAttachmentCancel = useCallback(() => {
    setPendingDeleteAttachment({ open: false, id: null, label: "" })
  }, [])

  // Keep Back and Close behavior identical for the CRF full-screen view.
  const handleCloseCrfView = useCallback(() => {
    clearAiEntryFlags()
    setSelectedVisit(null)
    setSelectedForm(null)
    setIsFormReadOnlyByPermission(false)
    setCrfSubmittedByUserId(null)
    setCurrentFormStatus(null)
    setShowFormDropdown(null)
  }, [clearAiEntryFlags])

  // Calculate visit status and progress using a single source of truth
  const calculateVisitStatus = (visitId) => {
    // Always use visitCrfData from patient list response so that
    // collapsed and expanded views show identical progress values.
    const visit = getVisitById(visitId)
    if (visit?.isRepeatableGroup) {
      const entries = Array.isArray(selectedPatient?.visitCrfData) ? selectedPatient.visitCrfData : []
      const wantedRows = new Set((visit.repeatableRowNumbers || []).map((n) => toPositiveRowNumber(n)).filter(Boolean))
      const matchedEntries = entries.filter((row) => {
        const kind = getRepeatableKindFromValue(row?.crfFormType) || getRepeatableKindFromValue(row?.visitType)
        const rn = toPositiveRowNumber(row?.rowNumber)
        return kind === visit.repeatableKind && rn != null && wantedRows.has(rn)
      })
      if (matchedEntries.length === 0) return { status: "pending", progress: 0 }
      let completed = 0
      let inProcess = 0
      matchedEntries.forEach((m) => {
        const s = normalizeCrfStatusCode(m?.status)
        if (s === 3) completed += 1
        else if (s === 1 || s === 2) inProcess += 1
      })
      if (completed === matchedEntries.length) return { status: "completed", progress: 100 }
      if (completed > 0 || inProcess > 0) return { status: "inprocess", progress: Math.round((completed / matchedEntries.length) * 100) || 50 }
      return { status: "pending", progress: 0 }
    }
    if (visit && visit.visitScheduleId) {
      const scheduleKey = toScheduleKey(visit.visitScheduleId)
      const visitCrfInfoByDesignId = scheduleKey ? visitCrfDataMap[scheduleKey] : null
      return deriveVisitStatusFromCrfInfo(visitCrfInfoByDesignId)
    }

    // Default: no forms loaded and no CRF data found
    return { status: "pending", progress: 0 }
  }

  const getSequentialVisitLockReason = useCallback(
    (visit) => {
      if (!visit) return ""

      const visitCardStatus = calculateVisitStatus(visit.id)?.status

      // Pending visits only — terminal patient statuses may open AE + Concomitant Medication only.
      const patientStatusLock = getPatientStatusPendingVisitLockReason(
        selectedPatient,
        visit,
        visitCardStatus,
      )
      if (patientStatusLock) return patientStatusLock

      if (visit.isRepeatableGroup) return ""

      // Study Completion Form — unlock only after Screening visit is fully submitted.
      if (visitMatchesTypeEnum(visit, VISIT_TYPE.STUDY_COMPLETION_FORM)) {
        const screeningVisit = sortedVisibleVisits.find(
          (v) => v && !v.isRepeatableGroup && visitMatchesTypeEnum(v, VISIT_TYPE.SCREENING),
        )
        if (screeningVisit) {
          const screeningStatus = calculateVisitStatus(screeningVisit.id)
          if (screeningStatus?.status !== "completed") {
            return `Complete ${screeningVisit.name || "Screening"} submission first to unlock ${visit.name || "Study Completion Form"}.`
          }
        }
        return ""
      }

      if (!isVisitDateRestrictionEnabled) return ""
      const thisType = normalizeVisitDateRestrictionFormType(
        visit?.visitType ?? visit?.crfFormType ?? visit?.name
      )
      if (!isVisitDateRestrictionFormTypeAllowed(thisType)) return ""

      const sequencedVisits = sortedVisibleVisits.filter((v) => {
        if (!v || v.isRepeatableGroup) return false
        const t = normalizeVisitDateRestrictionFormType(v?.visitType ?? v?.crfFormType ?? v?.name)
        return isVisitDateRestrictionFormTypeAllowed(t)
      })
      const idx = sequencedVisits.findIndex((v) => String(v?.id) === String(visit?.id))
      if (idx <= 0) return ""
      const previousVisit = sequencedVisits[idx - 1]
      const previousStatus = calculateVisitStatus(previousVisit?.id)
      if (previousStatus?.status === "completed") return ""
      return `Complete ${previousVisit?.name || "previous visit"} submission first to unlock ${visit?.name || "this visit"}.`
    },
    [
      isVisitDateRestrictionEnabled,
      sortedVisibleVisits,
      selectedPatient?.currentStatusCode,
      selectedPatient?.patientStatusCode,
      selectedPatient?.currentStatusName,
      selectedPatient?.patientStatusName,
      visitCrfDataMap,
      selectedPatient?.visitCrfData,
    ]
  )

  const handleMatrixCellClick = async (patient, visit) => {
    if (!patient?.id || !visit?.id) return
    if (loadingPatients) return

    const consentLock = eConsentCrfGate.getPatientLockReason(patient.id)
    if (consentLock) {
      toast({
        title: "Visit locked",
        description: consentLock,
        variant: "destructive",
        duration: 5000,
      })
      return
    }

    // Filling a CRF must stay on Visits — never inherit a stale "open queries" intent.
    pendingOpenQueriesTabRef.current = false
    pendingQueryVisitScheduleIdRef.current = null
    setPatientQueryVisitScheduleId(null)
    setPatientMainTab("visits")

    if (String(selectedPatient?.id) !== String(patient.id)) {
      isProcessingPatientRef.current = false
      lastSelectedPatientRef.current = null
      await handlePatientSelect(patient)
    } else {
      selectedPatientRef.current = patient
    }

    await handleVisitSelect(visit.id)
  }

  const handleMatrixCellQueryClick = async (patient, visit) => {
    const scheduleId = visit?.visitScheduleId ?? visit?.id
    if (!patient?.id || scheduleId == null || scheduleId === "") return

    if (String(selectedPatient?.id) === String(patient.id)) {
      setPatientQueryVisitScheduleId(scheduleId)
      setPatientQueryPage(1)
      setPatientMainTab("queries")
      return
    }

    pendingQueryVisitScheduleIdRef.current = scheduleId
    pendingOpenQueriesTabRef.current = true
    isProcessingPatientRef.current = false
    lastSelectedPatientRef.current = null
    await handlePatientSelect(patient)
  }

  const handlePatientQueryRowNavigate = async (queryRow) => {
    const visitScheduleId = queryDtoPick(queryRow, "visitScheduleId", "VisitScheduleId")
    const fieldId = queryDtoPick(queryRow, "fieldId", "FieldId")
    if (!selectedPatient?.id) {
      toast({
        title: "Select a patient",
        description: "Choose a patient before opening a queried field.",
        duration: 3000,
      })
      return
    }
    if (!visitScheduleId || !fieldId) {
      toast({
        title: "Cannot open field",
        description: "This query is missing visit or field details.",
        variant: "destructive",
        duration: 3000,
      })
      return
    }

    const visit = sortedVisibleVisits.find(
      (v) => String(v.visitScheduleId ?? v.id) === String(visitScheduleId),
    )
    if (!visit?.id) {
      toast({
        title: "Visit not found",
        description: "Could not locate the visit for this query.",
        variant: "destructive",
        duration: 3000,
      })
      return
    }

    const visitLockReason = getSequentialVisitLockReason(visit)
    if (visitLockReason) {
      toast({
        title: "Visit locked",
        description: visitLockReason,
        variant: "destructive",
        duration: 3500,
      })
      return
    }

    pendingQueryFieldNavigationRef.current = { fieldId: String(fieldId) }
    setPatientMainTab("visits")
    setShowFormDropdown(null)

    const forms = await fetchFormsForVisit(visit.id, true)
    const targetForm = resolveFormForPatientQuery(forms, queryRow, selectedPatient)
    if (!targetForm) {
      pendingQueryFieldNavigationRef.current = null
      toast({
        title: "CRF not found",
        description: "Could not locate the CRF form for this query.",
        variant: "destructive",
        duration: 3000,
      })
      return
    }

    await handleFormSelect(targetForm, visit.id)
  }

  const handleRefresh = () => {
    // Refresh patient data
    window.location.reload()
  }

  const handleManualPatientStatusChange = useCallback(
    async (patient, newStatusCode) => {
      if (!studyId || !patient?.id || !newStatusCode) {
        toast({
          title: "Status update failed",
          description: "Missing study/patient/status.",
          variant: "destructive",
        })
        return
      }

      console.log("[PatientStatusFlow] manual change request", {
        studyId,
        patientEnrolmentId: patient.id,
        fromStatusCode: patient?.currentStatusCode ?? patient?.patientStatusCode ?? null,
        toStatusCode: newStatusCode,
      })

      const res = await patientEnrolmentService.updatePatientStatus(studyId, patient.id, {
        newStatusCode,
        reason: null,
      })

      if (!res?.isSuccess) {
        console.warn("[PatientStatusFlow] manual change failed", {
          studyId,
          patientEnrolmentId: patient.id,
          toStatusCode: newStatusCode,
          message: res?.message,
        })
        toast({
          title: "Status update failed",
          description: res?.message || "Could not update patient status.",
          variant: "destructive",
        })
        return
      }

      const updatedCode = res?.data?.currentStatusCode ?? newStatusCode
      const updatedName = getPatientStatusLabel(
        res?.data?.currentStatusName,
        updatedCode,
      )

      setPatients((prev) =>
        prev.map((p) =>
          p.id === patient.id
            ? {
                ...p,
                currentStatusCode: updatedCode,
                currentStatusName: updatedName,
                patientStatusCode: updatedCode,
                patientStatusName: updatedName,
              }
            : p,
        ),
      )
      setSelectedPatient((prev) =>
        prev?.id === patient.id
          ? {
              ...prev,
              currentStatusCode: updatedCode,
              currentStatusName: updatedName,
              patientStatusCode: updatedCode,
              patientStatusName: updatedName,
            }
          : prev,
      )

      console.log("[PatientStatusFlow] manual change success", {
        studyId,
        patientEnrolmentId: patient.id,
        toStatusCode: updatedCode,
        toStatusName: updatedName,
      })
      toast({
        title: "Status updated",
        description: res?.message || `Patient status set to ${updatedName}.`,
        variant: "success",
      })
    },
    [studyId],
  )

  return (
    <DashboardLayout hideChrome={Boolean(selectedVisit && selectedForm)}>
      <div
        className={cn(
          "flex w-full min-w-0",
          selectedVisit && selectedForm
            ? "h-[100dvh] min-h-0"
            : "flex max-lg:min-h-[calc(100dvh-var(--topbar-height,4.5625rem)-1.5rem)] max-lg:max-h-[calc(100dvh-var(--topbar-height,4.5625rem)-1.5rem)] min-h-0 flex-col overflow-hidden lg:min-h-[calc(100dvh-var(--topbar-height,4.5625rem)-3rem)] lg:max-h-[calc(100dvh-var(--topbar-height,4.5625rem)-3rem)]",
        )}
      >
        {!(selectedVisit && selectedForm) ? (
          <div className="flex min-h-0 w-full flex-1 flex-col gap-3 overflow-hidden">
            <EcrfWorkspaceContextNotice studyId={studyId} siteId={siteId} />
            {eConsentCrfGate.isEConsentRequired ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                eCONSENT is required for this study. Visit cells stay locked until that patient&apos;s consent is{" "}
                <strong>Approved</strong> under eCONSENT → Subjects.
              </div>
            ) : null}

            <EcrfDataEntryWorkspace
              className="min-h-0 flex-1"
              patients={filteredPatients}
              visitColumns={matrixVisitColumns}
              selectedPatient={selectedPatient}
              selectedVisitId={selectedVisit?.id ?? showFormDropdown}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              loadingPatients={loadingPatients}
              loadingFormsByVisit={loadingFormsByVisit}
              formsByVisit={availableFormsByVisit}
              expandedVisitId={showFormDropdown}
              getVisitLockReason={(patient, visit) => {
                const consentLock = eConsentCrfGate.getPatientLockReason(patient?.id)
                if (consentLock) return consentLock
                if (String(selectedPatient?.id) !== String(patient.id)) return ""
                return getSequentialVisitLockReason(visit) || ""
              }}
              onPatientSelect={(patient) => {
                isProcessingPatientRef.current = false
                lastSelectedPatientRef.current = null
                void handlePatientSelect(patient)
              }}
              onClearPatient={() => {
                setSelectedPatient(null)
                selectedPatientRef.current = null
                lastSelectedPatientRef.current = null
                setPatientMainTab("visits")
                setPatientQueryVisitScheduleId(null)
              }}
              onVisitClick={(patient, visit) => {
                void handleMatrixCellClick(patient, visit)
              }}
              onFormSelect={(form, visit) => {
                void handleFormSelect(form, visit?.id ?? showFormDropdown)
              }}
              onVisitQueryClick={(patient, visit) => {
                void handleMatrixCellQueryClick(patient, visit)
              }}
              onLockedTap={(reason) => {
                toast({
                  title: "Visit locked",
                  description: reason,
                  variant: "destructive",
                  duration: 4000,
                })
              }}
              onRefresh={handleRefresh}
              patientMainTab={patientMainTab}
              onPatientMainTabChange={setPatientMainTab}
              showAddVisitType={showAddVisitTypeControl}
              addVisitTypeLoading={Boolean(addingRepeatableVisitKind)}
              supportsUnscheduledVisit={studySupportsAddUnscheduledVisit}
              supportsAdverseVisit={studySupportsAddAdverseVisit}
              onAddVisitType={(patient, kind) => {
                void handleAddVisitTypeForPatient(patient, kind)
              }}
              canAllVisitsSdv={Boolean(canVerifySdvForStudy && sdvConfiguredForCurrentStudy)}
              allVisitsSdvLoading={allVisitsSdvSaving}
              onAllVisitsSdv={(patient) => {
                void handleAllVisitsSdv(patient)
              }}
              canAllVisitsPi={Boolean(
                studyPermGates.canPiSignoff && isPiSignoffRequired && isPiSignoffBulkEnabled,
              )}
              allVisitsPiLoading={allVisitsPiSaving}
              onAllVisitsPi={(patient) => {
                handleAllVisitsPi(patient)
              }}
              getVisitPiCounts={getVisitPiCounts}
              isPatientStatusEnabled={isPatientStatusEnabled}
              canChangePatientStatus={canShowManualStatusAction}
              getPatientStatusChangeOptions={getManualStatusTransitions}
              getPatientStatusOptionLabel={(code) => getPatientStatusLabel("", code)}
              onPatientStatusChange={(patient, code) => {
                void handleManualPatientStatusChange(patient, code)
              }}
              queryPanelProps={
                selectedPatient
                  ? {
                      filteredCount: patientQueryFilteredRows.length,
                      pageRows: patientQueryPageRows,
                      pageSize: PATIENT_QUERY_PAGE_SIZE,
                      pageSafe: patientQueryPageSafe,
                      totalPages: patientQueryTotalPages,
                      search: patientQuerySearch,
                      onSearchChange: setPatientQuerySearch,
                      loading: loadingPatientQueriesList,
                      onPageChange: setPatientQueryPage,
                      visitNameByScheduleId: patientQueryGridVisitNameByScheduleId,
                      crfNameByDesignId: patientQueryGridCrfNameByDesignId,
                      visitFilterLabel:
                        patientQueryVisitScheduleId != null
                          ? patientQueryGridVisitNameByScheduleId.get(
                              String(patientQueryVisitScheduleId),
                            ) || "Selected visit"
                          : null,
                      onClearVisitFilter: () => setPatientQueryVisitScheduleId(null),
                      onQueryRowClick: (row) => {
                        void handlePatientQueryRowNavigate(row)
                      },
                      queryCounts: headerPatientQueryCounts,
                    }
                  : null
              }
              emptyMessage={
                !studyId
                  ? "Select a study and site from the header to load patients."
                  : siteId == null ||
                      siteId === "" ||
                      Number.isNaN(Number(siteId)) ||
                      Number(siteId) <= 0
                    ? "Select a site from the header to load patients for this study."
                    : "No patients match your filters."
              }
            />

            <EcrfMatrixFormPickerDialog
              open={false}
              visitName={(() => {
                const visitMeta = getVisitById(showFormDropdown)
                if (visitMeta?.name) return visitMeta.name
                const groupId = String(showFormDropdown || "")
                if (groupId.startsWith("repeatable-group:")) {
                  const kind = groupId.split(":")[1]
                  return REPEATABLE_ENTRY_VISIT_LABEL[kind] || "Visit"
                }
                return "Visit"
              })()}
              patientLabel={(() => {
                const patient = selectedPatient ?? selectedPatientRef.current
                return patient ? `${patient.patientId} (${patient.initial})` : ""
              })()}
              forms={showFormDropdown ? availableFormsByVisit[showFormDropdown] || [] : []}
              loading={Boolean(showFormDropdown && loadingFormsByVisit?.[showFormDropdown])}
              onSelect={(form) => handleFormSelect(form, showFormDropdown)}
              onClose={() => setShowFormDropdown(null)}
            />
          </div>
        ) : null}

        {/* Full Page CRF Form Modal — portaled so fixed positioning covers the full viewport */}
        {selectedVisit &&
          selectedForm &&
          typeof document !== "undefined" &&
          createPortal(
          <div className="fixed inset-0 z-[100] flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-black/50 backdrop-blur-sm transition-opacity duration-200 ease-in-out">
            {/* CRF Header */}
            <div className="sticky top-0 z-30 flex shrink-0 flex-col gap-2 border-b border-white/15 bg-gradient-to-r from-emerald-600/95 to-teal-600/95 px-3 py-2.5 shadow-[0_10px_26px_-16px_rgba(15,23,42,0.75)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-3.5">
              <div className="flex min-w-0 items-center gap-2 sm:gap-4">
                <button
                  onClick={handleCloseCrfView}
                  className="shrink-0 rounded-xl p-2 transition-colors hover:bg-white/20"
                  aria-label="Close form"
                >
                  <ChevronRight className="h-5 w-5 rotate-180 text-white" />
                </button>
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold tracking-tight text-white sm:text-lg md:text-xl">
                    {selectedVisit.visitName ||
                      selectedForm.sectionName ||
                      selectedForm.crfDesignName ||
                      selectedForm.name ||
                      "eCRF"}
                  </h2>
                  <p className="mt-0.5 truncate text-[11px] text-white/80 sm:text-xs md:text-sm">
                    Patient: {selectedVisit.patient?.patientId ?? "—"} ({selectedVisit.patient?.initial ?? "—"})
                    {randomizationNumberEnabled &&
                    String(
                      selectedVisit.patient?.randomizationNumber ??
                        selectedPatient?.randomizationNumber ??
                        "",
                    ).trim() ? (
                      <>
                        {" • "}
                        Rand:{" "}
                        {String(
                          selectedVisit.patient?.randomizationNumber ??
                            selectedPatient?.randomizationNumber ??
                            "",
                        ).trim()}
                      </>
                    ) : null}
                    {" • "}
                    <span className="inline-flex items-center gap-1">
                      <UserRound className="w-3.5 h-3.5" />
                      Gender: {selectedPatient?.gender || selectedVisit?.patient?.gender || "Not set"}
                    </span>
                  </p>
                  {canShowSdvPerField && crfSdvProgress.total > 0 ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {crfSdvProgress.allDone ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/35 bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                          <Shield className="h-3 w-3" aria-hidden />
                          SDV done
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-white/95">
                          <Shield className="h-3 w-3" aria-hidden />
                          SDV {crfSdvProgress.done}/{crfSdvProgress.total} fields
                        </span>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
                {showVisitAttachmentsMenu && (
                  <>
                    <input
                      type="file"
                      ref={visitAttachmentFileInputRef}
                      className="hidden"
                      onChange={handleVisitAttachmentFileChange}
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/12 hover:bg-white/18 text-white text-sm font-medium border border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition-colors duration-200"
                      >
                        <Paperclip className="w-4 h-4 shrink-0 opacity-95" />
                        <span className="hidden sm:inline">Visit Attachments</span>
                        <ChevronDown className="w-4 h-4 opacity-85 shrink-0" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        sideOffset={8}
                        className="z-[110] w-72 max-h-[min(22rem,70vh)] overflow-y-auto rounded-2xl border border-slate-200/80 bg-white/90 p-1.5 shadow-[0_12px_48px_-12px_rgba(15,23,42,0.3),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-2xl"
                      >
                        {canUploadVisitAttachments ? (
                          <>
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault()
                                handleVisitAttachmentUploadPickLarge()
                              }}
                              className="cursor-pointer flex flex-col items-stretch gap-0.5 rounded-xl py-2.5 px-2.5 focus:bg-emerald-50/90 data-[highlighted]:bg-emerald-50/90"
                            >
                              <span className="flex items-center gap-2.5 font-medium text-slate-800">
                                <UploadCloud className="w-4 h-4 text-emerald-600 shrink-0" />
                                Upload &gt;10MB (large)
                              </span>
                              <span className="pl-7 text-[11px] leading-snug text-slate-500">
                                For files above 10 MB
                              </span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault()
                                handleVisitAttachmentUploadPickUnder10Mb()
                              }}
                              className="cursor-pointer flex flex-col items-stretch gap-0.5 rounded-xl py-2.5 px-2.5 focus:bg-emerald-50/90 data-[highlighted]:bg-emerald-50/90"
                            >
                              <span className="flex items-center gap-2.5 font-medium text-slate-800">
                                <UploadCloud className="w-4 h-4 text-emerald-600 shrink-0" />
                                Upload &lt;=10MB only
                              </span>
                              <span className="pl-7 text-[11px] leading-snug text-slate-500">
                                Each file max 10 MB (others: use normal upload).
                              </span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="my-1 bg-slate-200/70" />
                          </>
                        ) : null}
                        {loadingVisitAttachments ? (
                          <div className="px-3 py-6 text-sm text-slate-500 flex flex-col items-center gap-2">
                            <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
                            Loading attachments…
                          </div>
                        ) : visitAttachmentList.length === 0 ? (
                          <div className="px-3 py-6 text-center text-xs text-slate-400 font-medium">
                            No attachments yet
                          </div>
                        ) : (
                          visitAttachmentList.map((att) => {
                            const aid = att.attachmentId ?? att.id
                            const label =
                              att.originalFileName ||
                              att.fileName ||
                              att.name ||
                              `Attachment ${aid}`
                            return (
                              <div
                                key={aid}
                                className="rounded-xl py-2 px-2.5 text-slate-700 flex items-center justify-between gap-3 min-w-0 hover:bg-slate-100/90"
                              >
                                <span className="flex items-center gap-2 min-w-0">
                                  <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                                  <span className="truncate min-w-0 text-sm">{label}</span>
                                </span>
                                <span className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => void addDownloadJob({ attachmentId: aid })}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-200/70 bg-emerald-50/80 text-emerald-700 hover:bg-emerald-100 transition-colors"
                                    title="Download attachment"
                                  >
                                    <FileDown className="w-3.5 h-3.5" />
                                  </button>
                                  {canDeleteVisitAttachments ? (
                                    <button
                                      type="button"
                                      onClick={() => void handleDeleteVisitAttachment(aid, label)}
                                      disabled={deletingVisitAttachmentId === aid}
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-rose-200/70 bg-rose-50/80 text-rose-700 hover:bg-rose-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                      title="Delete attachment"
                                    >
                                      {deletingVisitAttachmentId === aid ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <Trash2 className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  ) : null}
                                </span>
                              </div>
                            )
                          })
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
                {ecrfPermission.canExport && (
                  <DropdownMenu>
                      <DropdownMenuTrigger
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/12 hover:bg-white/18 text-white text-sm font-medium border border-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] transition-colors duration-200"
                      >
                        <FileDown className="w-4 h-4 shrink-0 opacity-95" />
                        <span className="hidden sm:inline">Export CRF PDF</span>
                        <ChevronDown className="w-4 h-4 opacity-85 shrink-0" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        sideOffset={8}
                        className="z-[110] min-w-[17.5rem] rounded-2xl border border-slate-200/80 bg-white/90 p-1.5 shadow-[0_12px_48px_-12px_rgba(15,23,42,0.3),inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-2xl"
                      >
                        <DropdownMenuLabel className="px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                          Current form
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault()
                            void handleExportCurrentFormPdf("filled")
                          }}
                          className="cursor-pointer flex flex-col items-stretch gap-0.5 rounded-xl py-2.5 px-2.5 my-0.5 focus:bg-emerald-50/90 data-[highlighted]:bg-emerald-50/90"
                        >
                          <span className="flex items-center gap-2.5 font-medium text-slate-800">
                            <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                            With data
                          </span>
                          <span className="pl-7 text-[11px] leading-snug text-slate-500">
                            Filled PDF with values on screen
                          </span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault()
                            void handleExportCurrentFormPdf("blank")
                          }}
                          className="cursor-pointer flex flex-col items-stretch gap-0.5 rounded-xl py-2.5 px-2.5 my-0.5 focus:bg-emerald-50/90 data-[highlighted]:bg-emerald-50/90"
                        >
                          <span className="flex items-center gap-2.5 font-medium text-slate-800">
                            <File className="w-4 h-4 text-emerald-600 shrink-0" />
                            Blank
                          </span>
                          <span className="pl-7 text-[11px] leading-snug text-slate-500">
                            Empty template (labels & structure only)
                          </span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="my-1.5 bg-slate-200/80" />
                        <DropdownMenuLabel className="px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                          Audit trail
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault()
                            void handleExportCurrentFormPdf("filled-with-audit")
                          }}
                          className="cursor-pointer flex flex-col items-stretch gap-0.5 rounded-xl py-2.5 px-2.5 my-0.5 focus:bg-emerald-50/90 data-[highlighted]:bg-emerald-50/90"
                        >
                          <span className="flex items-center gap-2.5 font-medium text-slate-800">
                            <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
                            With data
                          </span>
                          <span className="pl-7 text-[11px] leading-snug text-slate-500">
                            Filled CRF plus field audit history (old/new values and reason)
                          </span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                )}
                <button
                  type="button"
                  onClick={handleCloseCrfView}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  aria-label="Close form"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-slate-50 to-slate-100/70">
              <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
              <div
                ref={dataEntryCrfScrollContainerRef}
                className="min-h-0 flex-1 overflow-y-auto overscroll-y-auto px-4 py-4 touch-pan-y sm:px-6 sm:py-5"
              >
                {isStudyPermissionCheckPending ? (
                  <div
                    className="mx-auto max-w-lg space-y-3 rounded-2xl border border-slate-200/80 bg-white/90 p-6"
                    role="status"
                    aria-busy="true"
                    aria-label="Checking study permissions"
                  >
                    <div className="mx-auto h-4 w-40 animate-pulse rounded bg-slate-200" />
                    <div className="mx-auto h-3 w-full max-w-sm animate-pulse rounded bg-slate-100" />
                    <div className="mx-auto h-3 w-full max-w-xs animate-pulse rounded bg-slate-100" />
                  </div>
                ) : !canViewCrf ? (
                  <div
                    className="mx-auto max-w-lg rounded-2xl border border-red-200/80 bg-red-50/90 p-6 text-center text-sm text-red-900"
                    role="alert"
                  >
                    <p className="font-semibold">CRF view not permitted</p>
                    {studyMatrixBlocksCrfView ? (
                      <p className="mt-2 text-red-800/90">
                        Study permission matrix denied <code className="text-xs">crf.view</code> for this study/site.
                        Enable <strong>View CRF</strong> for the effective role under{" "}
                        <strong>Study Management → Study Role Permissions</strong>, then confirm the user’s study/site
                        assignment role in <strong>Masters → User Creation</strong> matches that matrix column.
                      </p>
                    ) : menuBlocksCrfView ? (
                      <p className="mt-2 text-red-800/90">
                        Global menu permission denied <strong>View</strong> on eCRF data entry for your login role.
                        Enable <strong>View</strong> for the eCRF / Manually sub-feature under{" "}
                        <strong>Masters → Role Permission</strong> for CRC — study role permissions only apply when
                        runtime matrix enforcement is enabled on UAT.
                      </p>
                    ) : (
                      <p className="mt-2 text-red-800/90">
                        Access was denied by combined menu and study permission checks. See details below.
                      </p>
                    )}
                    {!studyUsesRolePermissionMatrix && (
                      <p className="mt-2 text-xs text-amber-900/90">
                        This study uses global Role Permission for eCRF. Enable{" "}
                        <strong>Use study role permission matrix</strong> under Study Settings to apply the study
                        matrix here.
                      </p>
                    )}
                    {studyUsesRolePermissionMatrix && !isStudyPermissionMatrixPlatformEnabled() && (
                      <p className="mt-2 text-xs text-amber-900/90">
                        Study matrix is enabled for this study, but the platform flag{" "}
                        <code className="text-xs">NEXT_PUBLIC_STUDY_PERMISSION_MATRIX_ENABLED=false</code> blocks
                        runtime enforcement.
                      </p>
                    )}
                    {(studyPermissionMeta?.roleName || studyId || siteId) && (
                      <div className="mt-4 rounded-xl border border-red-200/60 bg-white/70 px-4 py-3 text-left text-xs text-red-900/90">
                        {studyPermissionMeta?.roleName ? (
                          <p>
                            <span className="font-semibold">Effective role at this site:</span>{" "}
                            {studyPermissionMeta.roleName}
                          </p>
                        ) : (
                          <p>
                            <span className="font-semibold">Site assignment:</span> No study role was resolved for
                            the selected site. Confirm the user is assigned to this site in{" "}
                            <strong>Masters → User Creation</strong> with a study role (not only a login role).
                          </p>
                        )}
                        {(studyId || siteId) && (
                          <p className="mt-1 text-red-800/80">
                            Context: study {studyId ?? "—"}
                            {siteId ? `, site ${siteId}` : ", no site selected"}
                          </p>
                        )}
                        {studyPermissionMeta?.roleName && (
                          <p className="mt-2 text-red-800/80">
                            Enable <strong>View CRF</strong> for <strong>{studyPermissionMeta.roleName}</strong> in
                            the permission matrix — toggling a different role column will not apply to this user.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                <>
              <div
                className="mx-auto w-full max-w-7xl"
              >
                {/* Study/Site Info */}
                <div
                  className={cn(
                    "mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2",
                    randomizationNumberEnabled ? "lg:grid-cols-4" : "lg:grid-cols-3",
                  )}
                >
                  <div className="bg-white/80 backdrop-blur-sm rounded-lg border-2 border-slate-200/60 p-3 min-w-0">
                    <p className="text-xs font-semibold text-slate-500 mb-1">STUDY/SITE</p>
                    <p className="text-sm font-bold text-slate-900 break-words">
                      {studySiteHeaderLabel || `Study ${studyId ?? ""}`}
                    </p>
                  </div>
                  <div className="bg-white/80 backdrop-blur-sm rounded-lg border-2 border-slate-200/60 p-3 min-w-0">
                    <p className="text-xs font-semibold text-slate-500 mb-1">SCREENING NO/PATIENT ID</p>
                    <p className="text-sm font-bold text-slate-900 break-words">
                      {selectedVisit.patient?.patientId ?? "—"} ({selectedVisit.patient?.initial ?? "—"})
                    </p>
                  </div>
                  {randomizationNumberEnabled ? (
                    <div className="bg-white/80 backdrop-blur-sm rounded-lg border-2 border-slate-200/60 p-3 min-w-0">
                      <p className="text-xs font-semibold text-slate-500 mb-1">RANDOMIZATION NO</p>
                      <p className="text-sm font-bold text-slate-900 break-words">
                        {String(
                          selectedVisit.patient?.randomizationNumber ??
                            selectedPatient?.randomizationNumber ??
                            "",
                        ).trim() || "—"}
                      </p>
                    </div>
                  ) : null}
                  <div className="bg-white/80 backdrop-blur-sm rounded-lg border-2 border-slate-200/60 p-3 min-w-0">
                    <p className="text-xs font-semibold text-slate-500 mb-1">EVENT/VISIT</p>
                    <p className="text-sm font-bold text-slate-900 break-words">{selectedVisit.visitName}</p>
                  </div>
                </div>

                {currentCrfDataId ? (
                  <CrfSectionProgressPanel
                    progress={displayCrfProgressDetail}
                    formSections={sectionsWithContentForDataEntry}
                    activeSectionId={
                      activeDataEntrySectionId &&
                      sectionsWithContentForDataEntry.some(
                        (section) => String(section?.id) === String(activeDataEntrySectionId),
                      )
                        ? activeDataEntrySectionId
                        : sectionsWithContentForDataEntry[0]?.id ?? null
                    }
                    loading={loadingCrfProgress && !displayCrfProgressDetail}
                    className="mb-6"
                  />
                ) : null}

                <EcrfDbLockBanner
                  isLocked={isStudyDbLocked || granularDbLock.hasGranularLocks}
                  canApplyDbLock={studyPermGates.canApplyDbLock}
                  lockMeta={studyDbLockMeta}
                  hasPartialFieldLock={
                    granularDbLock.hasGranularLocks && !granularDbLock.wholeFormLocked
                  }
                />
                <EcrfPiSignoffPanel
                  studyId={studyId}
                  crfDataId={currentCrfDataId}
                  canPiSignoff={studyPermGates.canPiSignoff}
                  isPiSignoffRequired={isPiSignoffRequired}
                  isFieldPiSignoffEnabled={isFieldPiSignoffEnabled(piSignoffGranularity)}
                  onPiSignoffGranularityChange={handlePiSignoffGranularityFromRecord}
                  currentFormStatus={currentFormStatus}
                  onSignedChange={setIsPiSigned}
                  refreshToken={piSignoffRefreshToken}
                />

                {/* CRF Form - Tabs like designer preview when multiple sections, else single section */}
                <div className="space-y-3">
                  {(() => {
                    const sectionsWithContent = sectionsWithContentForDataEntry
                    const hasFormContent = sectionsWithContent.length > 0
                    const hasMultipleSections =
                      !isStudyCompletionDataEntry && sectionsWithContent.length > 1
                    const hasStudyCompletionSubSections =
                      isStudyCompletionDataEntry && sectionsWithContent.length > 0
                    const effectiveActiveId = activeDataEntrySectionId && sectionsWithContent.some(s => s.id === activeDataEntrySectionId)
                      ? activeDataEntrySectionId
                      : (sectionsWithContent[0]?.id ?? null)
                    const activeSectionData = isStudyCompletionDataEntry
                      ? studyCompletionActiveSection
                      : sectionsWithContent.find(s => s.id === effectiveActiveId) ?? sectionsWithContent[0]
                    const showStudyCompletionFieldGrid =
                      isStudyCompletionDataEntry && studyCompletionActiveSection != null
                    const showStandardFieldGrid =
                      !isStudyCompletionDataEntry && Boolean(activeSectionData || sectionsWithContent[0])

                    if (!hasFormContent) return (
                      <div className="text-center py-12">
                        <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                        <p className="text-slate-600">No form fields available</p>
                      </div>
                    )
                    return (
                      <div className="space-y-4">
                        {loadingSelectedCrfForm && (
                          <div
                            role="status"
                            aria-busy="true"
                            aria-label="Loading CRF sections"
                            className="rounded-2xl border border-slate-200/75 bg-white p-4 shadow-[0_16px_32px_-22px_rgba(15,23,42,0.45)]"
                          >
                            <div className="animate-pulse space-y-4">
                              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                                {Array.from({ length: Math.max(2, Math.min(5, sectionsWithContent.length || 3)) }).map((_, idx) => (
                                  <div key={`crf-tab-skel-${idx}`} className="h-9 w-28 rounded-xl bg-slate-200/90" />
                                ))}
                              </div>
                              <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                                {Array.from({ length: Math.max(6, Math.min(12, (activeSectionData?.controls?.length || 6))) }).map((_, idx) => (
                                  <div key={`crf-field-skel-${idx}`} className="col-span-12 sm:col-span-6 space-y-2 rounded-xl border border-slate-200/70 bg-slate-50/75 p-3">
                                    <div className="h-3 w-40 rounded bg-slate-200/90" />
                                    <div className="h-10 w-full rounded-md bg-slate-200/90" />
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Study Completion — gateway only (no outcome fields yet) */}
                        {!loadingSelectedCrfForm &&
                          hasStudyCompletionSubSections &&
                          !showStudyCompletionFieldGrid && (
                          <div className="rounded-2xl border border-slate-200/75 bg-white/95 p-4 shadow-[0_16px_32px_-22px_rgba(15,23,42,0.45)]">
                            <StudyCompletionDataEntrySection
                              blocks={sectionsWithContent}
                              completedStudy={studyCompletionEntryGate.completedStudy}
                              terminalStatusCode={studyCompletionEntryGate.terminalStatusCode}
                              disabled={isPermissionLockedForDataEntry || currentFormStatus === 3}
                              onCompletedStudyChange={handleStudyCompletionCompletedStudyChange}
                              onTerminalStatusChange={handleStudyCompletionTerminalStatusChange}
                            />
                          </div>
                        )}

                        {/* Standard CRF — top-level section tabs */}
                        {!loadingSelectedCrfForm && hasMultipleSections && sectionsWithContent && sectionsWithContent.length > 0 && (
                          <EcrfSectionTabs
                            sectionsWithContent={sectionsWithContent}
                            effectiveActiveId={effectiveActiveId}
                            deferredSectionValidationSummary={deferredSectionValidationSummary}
                            highlightSectionErrors={highlightSectionErrors}
                            setSectionTabButtonRef={setSectionTabButtonRef}
                            onSectionTabChange={handleSectionTabChange}
                          />
                        )}

                        {/* Render only the active section's grid of controls */}
                        <EcrfCrfBody>
                        {!loadingSelectedCrfForm &&
                          (showStudyCompletionFieldGrid || showStandardFieldGrid) &&
                          activeSectionData && (
                          (() => {
                            const sectionControls = (activeSectionData || sectionsWithContent[0])?.controls || []
                            const virtualizationEnabled = sectionControls.length > 160
                            const useTanstackVirtual =
                              virtualizationEnabled && dataEntryControlVirtualizerState.enabled
                            const controlsToRender = useTanstackVirtual
                              ? dataEntryControlVirtualizerState.virtualItems.map(
                                  (vi) => sectionControls[vi.index],
                                )
                              : virtualizationEnabled
                                ? sectionControls.slice(0, dataEntryControlRenderLimit)
                                : sectionControls
                            const hasMoreControls =
                              virtualizationEnabled &&
                              !useTanstackVirtual &&
                              controlsToRender.length < sectionControls.length
                            const sdvEligibleControlIdsInSection = canShowSdvPerField
                              ? sectionControls.reduce((acc, control) => {
                                  // Pre-computed eval map: O(1) lookup instead of per-control object-spread merge.
                                  const evaluatedControl =
                                    evaluatedControlsByIdForCurrentForm[control.id] || getRuleAwareControl(control)
                                  if (!shouldShowControlForPatientGender(evaluatedControl, selectedPatient)) return acc
                                  if (evaluatedControl.properties?.hidden) return acc
                                  const controlTypeLower = String(evaluatedControl.type || "").toLowerCase()
                                  if (!SDV_ELIGIBLE_CONTROL_TYPES.has(controlTypeLower)) return acc
                                  const controlIdStr = String(control.id)
                                  const isTableControl = controlTypeLower === "table"
                                  if (isTableControl) {
                                    // O(M) via the per-render prefix index instead of an O(N) scan
                                    // of the whole form slice for every table on every render.
                                    const populated = tableRowKeyIndexForCurrentForm.populatedKeysByTable[controlIdStr]
                                    if (populated && populated.length > 0) {
                                      for (let i = 0; i < populated.length; i += 1) acc.push(populated[i])
                                    }
                                    return acc
                                  }
                                  const optimisticValue = optimisticControlValues?.[control.id]
                                  const controlValue =
                                    optimisticValue !== undefined
                                      ? optimisticValue
                                      : currentRenderFormValues?.[control.id] ?? ""
                                  if (
                                    hasSdvValueForControl(
                                      selectedForm?.id,
                                      controlIdStr,
                                      controlValue,
                                      isTableControl,
                                    )
                                  ) {
                                    acc.push(controlIdStr)
                                  }
                                  return acc
                                }, [])
                              : []
                            const hasSectionSdvControls = sdvEligibleControlIdsInSection.length > 0
                            const sectionSdvAllChecked =
                              hasSectionSdvControls &&
                              sdvEligibleControlIdsInSection.every((controlIdStr) =>
                                Boolean(
                                  sdvSelectionsByField[getSdvFieldKey(selectedForm?.id, controlIdStr)],
                                ),
                              )
                            const sectionSdvAnyChecked = sdvEligibleControlIdsInSection.some((controlIdStr) =>
                              Boolean(sdvSelectionsByField[getSdvFieldKey(selectedForm?.id, controlIdStr)]),
                            )
                            const sectionSdvAnyApproved = sdvEligibleControlIdsInSection.some((controlIdStr) =>
                              Boolean(sdvApprovedByField[getSdvFieldKey(selectedForm?.id, controlIdStr)]),
                            )
                            const piEligibleControlIdsInSection = canShowPiPerField
                              ? sdvEligibleControlIdsInSection
                              : []
                            const hasSectionPiControls = piEligibleControlIdsInSection.length > 0
                            const piFieldBlockedBySdv = (controlIdStr) =>
                              shouldShowSdvBeforeSignGates(piReviewOrder) &&
                              !sdvApprovedByField[getSdvFieldKey(selectedForm?.id, controlIdStr)]
                            const sectionPiAllChecked =
                              hasSectionPiControls &&
                              piEligibleControlIdsInSection.every((controlIdStr) =>
                                Boolean(
                                  piSelectionsByField[getPiFieldKey(selectedForm?.id, controlIdStr)],
                                ),
                              )
                            const sectionPiAnyChecked = piEligibleControlIdsInSection.some((controlIdStr) =>
                              Boolean(piSelectionsByField[getPiFieldKey(selectedForm?.id, controlIdStr)]),
                            )
                            const sectionPiSignedChecked = piEligibleControlIdsInSection.some((controlIdStr) => {
                              const key = getPiFieldKey(selectedForm?.id, controlIdStr)
                              return (
                                Boolean(piSelectionsByField[key]) &&
                                Boolean(piSignedByField[key])
                              )
                            })
                            const piSignBusy = piFieldSignoffSaving || saving
                            const piFieldSignTooltipText = !sectionPiAnyChecked
                              ? "Check PI boxes on fields you approve, then use Sign fields to save."
                              : piSignBusy
                                ? "Saving field PI sign-off…"
                                : "Save PI sign-off for checked fields in this section."
                            const sdvVerifyBusy = sdvVerifySaving || saving
                            const verifySdvTooltipText = !sectionSdvAnyChecked
                              ? "Check the SDV boxes on fields you approve, then use Verify to approve SDV for those checked fields."
                              : sdvVerifyBusy
                                ? "Saving SDV approve for checked fields…"
                                : sectionSdvAnyApproved
                                  ? "SDV approve update: refreshes approval for checked fields and saves again."
                                  : "SDV approve: saves approval for checked fields (Source Data Verification) to the database."
                            return (
                              <>
                                <div
                                  className="rounded-2xl border border-slate-200/75 bg-white/95 p-4 shadow-[0_16px_32px_-22px_rgba(15,23,42,0.45)]"
                                >
                                  {isStudyCompletionDataEntry && hasStudyCompletionSubSections && (
                                    <StudyCompletionDataEntrySection
                                      blocks={sectionsWithContent}
                                      className="mb-4 border-b border-slate-200/80 pb-4"
                                      completedStudy={studyCompletionEntryGate.completedStudy}
                                      terminalStatusCode={studyCompletionEntryGate.terminalStatusCode}
                                      disabled={isPermissionLockedForDataEntry || currentFormStatus === 3}
                                      onCompletedStudyChange={handleStudyCompletionCompletedStudyChange}
                                      onTerminalStatusChange={handleStudyCompletionTerminalStatusChange}
                                    />
                                  )}
                                  <div
                                    className={`mb-2 flex flex-wrap items-start gap-3 ${hasSectionSdvControls || hasSectionPiControls ? "justify-between" : ""}`}
                                  >
                                    <div className={`min-w-0 ${hasSectionSdvControls || hasSectionPiControls ? "flex-1" : ""}`}>
                                      {!isStudyCompletionDataEntry && (
                                        <CrfLabSectionBanner
                                          section={activeSectionData}
                                          variant="entry"
                                          className={hasSectionSdvControls ? "!mb-0" : undefined}
                                        />
                                      )}
                                    </div>
                                    {hasSectionSdvControls && (
                                    <div className="flex shrink-0 justify-end self-start">
                                      <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-200/85 bg-white/80 p-1 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_10px_24px_-16px_rgba(15,23,42,0.3)] backdrop-blur-xl">
                                        <button
                                          type="button"
                                          className={`inline-flex h-8 items-center rounded-xl px-3.5 text-[11px] font-semibold tracking-[-0.01em] transition-all duration-150 ${
                                            sectionSdvAllChecked
                                              ? "border border-emerald-400/70 bg-gradient-to-b from-emerald-500 to-emerald-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_4px_10px_-7px_rgba(5,150,105,0.55)]"
                                              : "border border-transparent bg-white/70 text-emerald-800 hover:border-emerald-200/80 hover:bg-emerald-50/75 active:translate-y-px"
                                          }`}
                                          onClick={() =>
                                            setSdvSelectionsByField((prev) => {
                                              const next = { ...prev }
                                              sdvEligibleControlIdsInSection.forEach((controlIdStr) => {
                                                next[getSdvFieldKey(selectedForm?.id, controlIdStr)] = true
                                              })
                                              return next
                                            })
                                          }
                                          disabled={sdvVerifyBusy}
                                        >
                                          Select all SDV
                                        </button>
                                        <button
                                          type="button"
                                          className={`inline-flex h-8 items-center rounded-xl px-3.5 text-[11px] font-semibold tracking-[-0.01em] transition-all duration-150 ${
                                            sectionSdvAnyChecked
                                              ? "border border-transparent text-slate-700 hover:border-slate-200/80 hover:bg-slate-100/80 active:translate-y-px"
                                              : "cursor-not-allowed text-emerald-300/90"
                                          }`}
                                          onClick={() =>
                                            {
                                              setSdvSelectionsByField((prev) => {
                                                const next = { ...prev }
                                                sdvEligibleControlIdsInSection.forEach((controlIdStr) => {
                                                  next[getSdvFieldKey(selectedForm?.id, controlIdStr)] = false
                                                })
                                                return next
                                              })
                                              setSdvApprovedByField((prev) => {
                                                const next = { ...prev }
                                                sdvEligibleControlIdsInSection.forEach((controlIdStr) => {
                                                  next[getSdvFieldKey(selectedForm?.id, controlIdStr)] = false
                                                })
                                                sdvApprovedByFieldRef.current = next
                                                return next
                                              })
                                            }
                                          }
                                          disabled={!sectionSdvAnyChecked || sdvVerifyBusy}
                                        >
                                          Clear
                                        </button>
                                        {/* SDV Verify: native title in place of Radix Tooltip — same hint, no setTrigger composeRefs path. */}
                                        <span
                                          className={`inline-flex rounded-[10px] ${
                                            !sectionSdvAnyChecked || sdvVerifyBusy ? "cursor-default" : ""
                                          }`}
                                        >
                                        <button
                                          type="button"
                                          title={verifySdvTooltipText}
                                          className={`inline-flex h-8 min-w-[5.5rem] items-center justify-center gap-1.5 rounded-xl px-3.5 text-[11px] font-semibold tracking-[-0.015em] transition-[box-shadow,transform,background,color,border-color] duration-150 ${
                                            sectionSdvAnyChecked && !sdvVerifyBusy
                                              ? "border border-sky-300/80 bg-gradient-to-b from-sky-50 to-blue-100/85 text-sky-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_6px_14px_-10px_rgba(2,132,199,0.55)] outline-none hover:border-sky-400/80 hover:from-sky-100 hover:to-blue-100 focus-visible:ring-2 focus-visible:ring-sky-300/50 active:translate-y-px"
                                              : "pointer-events-none cursor-not-allowed border border-black/[0.06] bg-black/[0.025] text-slate-400"
                                          }`}
                                          onClick={async () => {
                                            if (sdvVerifyBusy) return
                                            if (!resolveExistingCrfDataIdForSave()) {
                                              toast({
                                                title: "Save required",
                                                description:
                                                  "Save the CRF first. Then use Verify to store SDV verification in the database.",
                                                variant: "destructive",
                                              })
                                              return
                                            }
                                            const formId = selectedForm?.id
                                            const submitted = currentFormStatus === 3
                                            const saveStatus = submitted ? 2 : [1, 2].includes(currentFormStatus) ? currentFormStatus : 2
                                            const sdvVerifySaveOptions = {
                                              skipLastVisitCheck: true,
                                              skipPreSubmitPopups: true,
                                              skipSubmitConfirm: true,
                                              skipAuditReasonPrompt: true,
                                              keepFormOpen: true,
                                              skipPostSaveRefetch: true,
                                              sdvApprovalSave: true,
                                            }
                                            const checkedInSection = sdvEligibleControlIdsInSection.filter(
                                              (controlIdStr) =>
                                                Boolean(
                                                  sdvSelectionsByField[
                                                    getSdvFieldKey(formId, controlIdStr)
                                                  ],
                                                ),
                                            )
                                            const needsClearBeforeRestamp = checkedInSection.some(
                                              (controlIdStr) =>
                                                Boolean(
                                                  sdvApprovedByFieldRef.current[
                                                    getSdvFieldKey(formId, controlIdStr)
                                                  ],
                                                ),
                                            )

                                            setSdvVerifySaving(true)
                                            try {
                                              if (needsClearBeforeRestamp) {
                                                const clearedApproved = {
                                                  ...sdvApprovedByFieldRef.current,
                                                }
                                                const clearedMeta = {
                                                  ...sdvAuditMetaByFieldRef.current,
                                                }
                                                checkedInSection.forEach((controlIdStr) => {
                                                  const key = getSdvFieldKey(formId, controlIdStr)
                                                  clearedApproved[key] = false
                                                  delete clearedMeta[key]
                                                })
                                                sdvApprovedByFieldRef.current = clearedApproved
                                                setSdvApprovedByField(clearedApproved)
                                                sdvAuditMetaByFieldRef.current = clearedMeta
                                                await handleSaveCrfData(saveStatus, {
                                                  ...sdvVerifySaveOptions,
                                                  isSdvVerify: false,
                                                })
                                              }

                                              const nextApproved = {
                                                ...sdvApprovedByFieldRef.current,
                                              }
                                              sdvEligibleControlIdsInSection.forEach((controlIdStr) => {
                                                const key = getSdvFieldKey(formId, controlIdStr)
                                                nextApproved[key] = Boolean(sdvSelectionsByField[key])
                                              })
                                              const sdvEligibleControlIdsForWholeCrf =
                                                getSdvEligibleControlIdsAcrossForm()
                                              const isSdvVerify = Boolean(
                                                sdvEligibleControlIdsForWholeCrf.length > 0 &&
                                                  sdvEligibleControlIdsForWholeCrf.every(
                                                    (controlIdStr) =>
                                                      Boolean(
                                                        sdvSelectionsByField[
                                                          getSdvFieldKey(formId, controlIdStr)
                                                        ],
                                                      ),
                                                  ),
                                              )
                                              sdvApprovedByFieldRef.current = nextApproved
                                              setSdvApprovedByField(nextApproved)
                                              const nextSdvAuditMeta = {
                                                ...sdvAuditMetaByFieldRef.current,
                                              }
                                              sdvEligibleControlIdsInSection.forEach((controlIdStr) => {
                                                const key = getSdvFieldKey(formId, controlIdStr)
                                                if (!nextApproved[key]) return
                                                delete nextSdvAuditMeta[key]
                                              })
                                              sdvAuditMetaByFieldRef.current = nextSdvAuditMeta

                                              await handleSaveCrfData(saveStatus, {
                                                ...sdvVerifySaveOptions,
                                                isSdvVerify,
                                              })
                                              await refreshSdvStateFromServer(
                                                selectedForm?.crfDataId,
                                                formId,
                                              )
                                            } finally {
                                              setSdvVerifySaving(false)
                                            }
                                          }}
                                          disabled={!sectionSdvAnyChecked || sdvVerifyBusy}
                                          aria-disabled={!sectionSdvAnyChecked || sdvVerifyBusy}
                                          aria-busy={sdvVerifyBusy}
                                          aria-label={
                                            sdvVerifyBusy
                                              ? "Verifying SDV, please wait"
                                              : !sectionSdvAnyChecked
                                                ? "Verify SDV (select at least one SDV checkbox)"
                                                : "Verify SDV"
                                          }
                                        >
                                          {sdvVerifyBusy ? (
                                            <>
                                              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                                              Verifying…
                                            </>
                                          ) : (
                                            "Verify"
                                          )}
                                        </button>
                                        </span>
                                        </div>
                                    </div>
                                    )}
                                    {hasSectionPiControls && (
                                    <div className="flex shrink-0 justify-end self-start">
                                      <div className="inline-flex items-center gap-1 rounded-2xl border border-indigo-200/85 bg-white/80 p-1 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_10px_24px_-16px_rgba(79,70,229,0.25)] backdrop-blur-xl">
                                        <button
                                          type="button"
                                          className={`inline-flex h-8 items-center rounded-xl px-3.5 text-[11px] font-semibold tracking-[-0.01em] transition-all duration-150 ${
                                            sectionPiAllChecked
                                              ? "border border-indigo-400/70 bg-gradient-to-b from-indigo-500 to-indigo-600 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_4px_10px_-7px_rgba(79,70,229,0.55)]"
                                              : "border border-transparent bg-white/70 text-indigo-800 hover:border-indigo-200/80 hover:bg-indigo-50/75 active:translate-y-px"
                                          }`}
                                          onClick={() =>
                                            setPiSelectionsByField((prev) => {
                                              const next = { ...prev }
                                              piEligibleControlIdsInSection.forEach((controlIdStr) => {
                                                if (piFieldBlockedBySdv(controlIdStr)) return
                                                next[getPiFieldKey(selectedForm?.id, controlIdStr)] = true
                                              })
                                              return next
                                            })
                                          }
                                          disabled={piSignBusy || isPiSignedReadOnly}
                                        >
                                          Select all PI
                                        </button>
                                        <button
                                          type="button"
                                          className={`inline-flex h-8 items-center rounded-xl px-3.5 text-[11px] font-semibold tracking-[-0.01em] transition-all duration-150 ${
                                            sectionPiAnyChecked
                                              ? "border border-transparent text-slate-700 hover:border-slate-200/80 hover:bg-slate-100/80 active:translate-y-px"
                                              : "cursor-not-allowed text-indigo-300/90"
                                          }`}
                                          onClick={() => {
                                            setPiSelectionsByField((prev) => {
                                              const next = { ...prev }
                                              piEligibleControlIdsInSection.forEach((controlIdStr) => {
                                                next[getPiFieldKey(selectedForm?.id, controlIdStr)] = false
                                              })
                                              return next
                                            })
                                            setPiSignedByField((prev) => {
                                              const next = { ...prev }
                                              piEligibleControlIdsInSection.forEach((controlIdStr) => {
                                                next[getPiFieldKey(selectedForm?.id, controlIdStr)] = false
                                              })
                                              piSignedByFieldRef.current = next
                                              return next
                                            })
                                          }}
                                          disabled={!sectionPiAnyChecked || piSignBusy || isPiSignedReadOnly}
                                        >
                                          Clear
                                        </button>
                                        <span
                                          className={`inline-flex rounded-[10px] ${
                                            !sectionPiAnyChecked || piSignBusy || isPiSignedReadOnly ? "cursor-default" : ""
                                          }`}
                                        >
                                          <button
                                            type="button"
                                            title={piFieldSignTooltipText}
                                            className={`inline-flex h-8 min-w-[5.5rem] items-center justify-center gap-1.5 rounded-xl px-3.5 text-[11px] font-semibold tracking-[-0.015em] transition-[box-shadow,transform,background,color,border-color] duration-150 ${
                                              sectionPiAnyChecked && !piSignBusy && !isPiSignedReadOnly
                                                ? "border border-indigo-300/80 bg-gradient-to-b from-indigo-50 to-violet-100/85 text-indigo-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_6px_14px_-10px_rgba(79,70,229,0.55)] outline-none hover:border-indigo-400/80 hover:from-indigo-100 hover:to-violet-100 focus-visible:ring-2 focus-visible:ring-indigo-300/50 active:translate-y-px"
                                                : "pointer-events-none cursor-not-allowed border border-black/[0.06] bg-black/[0.025] text-slate-400"
                                            }`}
                                            onClick={() =>
                                              setPiFieldPasswordDialog({
                                                open: true,
                                                sectionIds: piEligibleControlIdsInSection,
                                                mode: "apply",
                                              })
                                            }
                                          >
                                            {piSignBusy ? (
                                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                              <FileCheck className="h-3.5 w-3.5" />
                                            )}
                                            Sign fields
                                          </button>
                                        </span>
                                        <span
                                          className={`inline-flex rounded-[10px] ${
                                            !sectionPiSignedChecked || piSignBusy || isPiSignedReadOnly
                                              ? "cursor-default"
                                              : ""
                                          }`}
                                        >
                                          <button
                                            type="button"
                                            title="Revoke PI sign-off on checked fields that are already signed"
                                            className={`inline-flex h-8 min-w-[5.5rem] items-center justify-center gap-1.5 rounded-xl px-3.5 text-[11px] font-semibold tracking-[-0.015em] transition-[box-shadow,transform,background,color,border-color] duration-150 ${
                                              sectionPiSignedChecked && !piSignBusy && !isPiSignedReadOnly
                                                ? "border border-amber-300/80 bg-gradient-to-b from-amber-50 to-orange-100/85 text-amber-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] hover:border-amber-400/80 active:translate-y-px"
                                                : "pointer-events-none cursor-not-allowed border border-black/[0.06] bg-black/[0.025] text-slate-400"
                                            }`}
                                            onClick={() =>
                                              setPiFieldPasswordDialog({
                                                open: true,
                                                sectionIds: piEligibleControlIdsInSection.filter(
                                                  (controlIdStr) => {
                                                    const key = getPiFieldKey(
                                                      selectedForm?.id,
                                                      controlIdStr,
                                                    )
                                                    return (
                                                      Boolean(piSelectionsByField[key]) &&
                                                      Boolean(piSignedByField[key])
                                                    )
                                                  },
                                                ),
                                                mode: "revoke",
                                              })
                                            }
                                          >
                                            Revoke fields
                                          </button>
                                        </span>
                                      </div>
                                    </div>
                                    )}
                                  </div>
                                  {(() => {
                                    const secForLab = activeSectionData || sectionsWithContent[0]
                                    const ln = normalizeCrfSection(secForLab)
                                    if (ln.sectionType !== SECTION_TYPE_LAB) return null
                                    return (
                                      <CrfLabSectionFacilityPicker
                                        section={secForLab}
                                        labOptions={dataEntryLabOptions}
                                        loadingLabs={dataEntryLabsLoading}
                                        valueLabFacilityId={labFacilityIdForEntryRanges}
                                        onChangeBinding={(binding) =>
                                          labFacilityEntryBindingChange(ln, binding)
                                        }
                                      />
                                    )
                                  })()}
                                  <div
                                    className={useTanstackVirtual ? "relative w-full" : undefined}
                                    style={
                                      useTanstackVirtual
                                        ? { height: dataEntryControlVirtualizerState.totalSize }
                                        : undefined
                                    }
                                  >
                                  <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                            {controlsToRender.map((control, controlRenderIndex) => {
                              const virtualRow = useTanstackVirtual
                                ? dataEntryControlVirtualizerState.virtualItems[controlRenderIndex]
                                : null
                              const virtualPositionStyle = virtualRow
                                ? {
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    width: "100%",
                                    transform: `translateY(${virtualRow.start}px)`,
                                  }
                                : undefined
                        // Pre-computed eval map: O(1) lookup per control instead of an
                        // object-spread merge on every render of every control. Fallback to
                        // direct call only if the map is missing the id (defensive).
                        const evaluatedControl =
                          evaluatedControlsByIdForCurrentForm[control.id] || getRuleAwareControl(control)
                        if (!shouldShowControlForPatientGender(evaluatedControl, selectedPatient)) {
                          return null
                        }

                        // Skip if control is hidden by rule
                        if (evaluatedControl.properties?.hidden) {
                          return null
                        }

                        // Divider (hr): render only the line, no label
                        const controlTypeLower = (evaluatedControl.type || "").toLowerCase()
                        if (controlTypeLower === "hr") {
                          return (
                            <div
                              key={control.id}
                              className="col-span-full md:col-span-12"
                              style={virtualPositionStyle}
                            >
                              <hr className="my-4 border-slate-300" />
                            </div>
                          )
                        }

                        // Col-span from controlSize (same as DesignerCanvas / CRFViewer): 2,4,6,8,10,12
                        const colSpanMap = { 2: "col-span-2", 4: "col-span-4", 6: "col-span-6", 8: "col-span-8", 10: "col-span-10", 12: "col-span-12" }
                        const controlSize = evaluatedControl.controlSize ?? control.controlSize ?? 12
                        const colSpanClass = `${colSpanMap[controlSize] || "col-span-12"} max-md:col-span-12`

                        // Get the value for this control (always defined so inputs stay controlled)
                        const optimisticValue = optimisticControlValues?.[control.id]
                        const controlValue =
                          optimisticValue !== undefined
                            ? optimisticValue
                            : currentRenderFormValues?.[control.id] ?? ""
                        
                        // Get validation + submit-rule blocking errors for this control
                        const controlValidationErrors = validationErrors[selectedForm.id]?.[control.id] || []
                        const controlRuleBlockingErrors = getBlockingRuleErrorsForControl(control.id, controlValue)
                        const controlErrors = [...new Set([...(controlValidationErrors || []), ...(controlRuleBlockingErrors || [])])]
                        const isDateControlForErrors = String(evaluatedControl.type || "").toLowerCase().includes("date")
                        // Never show inline rule messages for date controls; keep only visual highlight.
                        const controlErrorsToShow = isDateControlForErrors
                          ? []
                          : controlErrors.filter((err) => !/\bis required\b/i.test(String(err || "")))
                        const controlErrorsForDateStyling = isDateControlForErrors
                          ? controlErrors.filter((err) => /\bis required\b/i.test(String(err || "")))
                          : controlErrors
                        const hasErrors = controlErrorsForDateStyling.length > 0
                        const showInlineErrorMessages = controlErrorsToShow.length > 0
                        const isTableControl = (evaluatedControl.type || "").toLowerCase() === "table"
                        /** Block raising a new manual query until the field passes validation (same errors as under the input). */
                        const disableRaiseManualQueryForValidation =
                          !isTableControl && controlErrors.length > 0
                        const tableCellErrors = (() => {
                          if (!isTableControl) return {}
                          const errsForForm = validationErrors[selectedForm.id] || {}
                          const out = {}
                          const pushCellErrors = (fieldId, nextErrors) => {
                            const m = String(fieldId || "").match(new RegExp(`^${control.id}_row_(\\d+)_col_(\\d+)$`))
                            if (!m) return
                            const cellKey = `${m[1]}_${m[2]}`
                            const prev = Array.isArray(out[cellKey]) ? out[cellKey] : []
                            const merged = [...new Set([...(prev || []), ...(nextErrors || [])].filter(Boolean))]
                            if (merged.length > 0) out[cellKey] = merged
                          }
                          Object.entries(errsForForm).forEach(([fieldId, errs]) => {
                            const valErrs = Array.isArray(errs) ? errs : []
                            const ruleErrs = getBlockingRuleErrorsForFieldId(fieldId)
                            const merged = [...new Set([...(valErrs || []), ...(ruleErrs || [])])]
                            pushCellErrors(fieldId, merged)
                          })
                          // Also include rule-targeted table cell messages even when validationErrors has no key yet.
                          ;(crfRuleMessages || [])
                            .filter((msg) => isBlockingSeverity(msg?.severity))
                            .filter((msg) => isSubmitBlockingCategory(msg?.category))
                            .forEach((msg) => {
                              const msgText = String(msg?.message || "").trim()
                              if (!msgText) return
                              const tf = msg?.targetField
                              const targets = Array.isArray(tf)
                                ? tf.map((v) => String(v).trim()).filter(Boolean)
                                : String(tf || "").split(",").map((v) => v.trim()).filter(Boolean)
                              targets.forEach((targetId) => {
                                pushCellErrors(targetId, [msgText])
                              })
                            })
                          return out
                        })()

                        // Determine if field is required (static or conditional)
                        const isRequired = evaluatedControl.properties?.required || evaluatedControl.properties?.conditionallyRequired

                        // Disabled when rule sets readonly or form is submitted (see isFieldDisabled below after query context).
                        // Normalize boolean-like readonly values from API/runtime.
                        const readonlyFlag =
                          evaluatedControl.properties?.readonly === true ||
                          evaluatedControl.properties?.readonly === "true" ||
                          evaluatedControl.properties?.readonly === 1 ||
                          evaluatedControl.properties?.readonly === "1"

                        const fieldLabel = evaluatedControl.properties?.labelText || evaluatedControl.label || "Unlabeled Field"
                        // Radio/checkbox use ControlRenderer, which already renders the field label above options
                        // (and styles required labels in red). Skip the page-level heading to avoid duplicate lines.
                        const controlRendererShowsFieldHeading =
                          controlTypeLower === "radio" || controlTypeLower === "checkbox"
                        const controlIdStr = String(control.id)
                        const isSdvEligibleControl = SDV_ELIGIBLE_CONTROL_TYPES.has(controlTypeLower)
                        const hasFieldValueForSdv = hasSdvValueForControl(
                          selectedForm?.id,
                          controlIdStr,
                          controlValue,
                          isTableControl,
                        )
                        const sdvChecked = Boolean(
                          sdvSelectionsByField[getSdvFieldKey(selectedForm?.id, controlIdStr)]
                        )
                        const sdvApproved = Boolean(
                          sdvApprovedByField[getSdvFieldKey(selectedForm?.id, controlIdStr)]
                        )
                        const piChecked = Boolean(
                          piSelectionsByField[getPiFieldKey(selectedForm?.id, controlIdStr)]
                        )
                        const piSigned = Boolean(
                          piSignedByField[getPiFieldKey(selectedForm?.id, controlIdStr)]
                        )
                        const useCrmDbQueries = canWorkOnQueries
                        const crmManualQueriesForField = useCrmDbQueries
                          ? filterQueriesForControl(crfQueriesFromApi, control.id, {
                              queryType: QUERY_TYPE_MANUAL,
                            })
                          : []
                        const openManualQueriesForField = crmManualQueriesForField.filter((q) =>
                          isQueryOpenStatus(q.status)
                        )
                        const manualQueryBadgeCount = openManualQueriesForField.length
                        const latestManualQueryForField = pickLatestQuery(
                          openManualQueriesForField.length > 0
                            ? openManualQueriesForField
                            : crmManualQueriesForField
                        )
                        const hasOpenManualQuery = openManualQueriesForField.length > 0
                        const latestOpenQuery = pickLatestQuery(openManualQueriesForField)
                        const latestApproverComment = latestOpenQuery ? String(getQueryApproverComment(latestOpenQuery) || "").trim() : ""
                        const latestSubmitterComment = latestOpenQuery ? String(getCrfSubmitterComment(latestOpenQuery) || "").trim() : ""
                        const isLatestAssignedUser = latestOpenQuery
                          ? Number(getQueryAssignedToUserId(latestOpenQuery)) === Number(loggedInUserId)
                          : false
                        const isLatestApproverUser = latestOpenQuery
                          ? Number(getQueryApproverUserId(latestOpenQuery)) === Number(loggedInUserId)
                          : false
                        /** Compact dot + icon only; full meaning in title/aria (no long labels). */
                        let manualActivityIndicator = null
                        if (hasOpenManualQuery && latestOpenQuery && !isQueryClosedStatus(latestOpenQuery.status)) {
                          if (isLatestAssignedUser && latestApproverComment && !latestSubmitterComment) {
                            manualActivityIndicator = {
                              dotClass: "bg-red-500",
                              icon: AlertTriangle,
                              iconClass: "text-red-600",
                              borderClass: "border-red-200/80",
                              title: "Action required: reviewer commented — add your response.",
                              ariaLabel: "Action required on manual query",
                            }
                          } else if (isLatestApproverUser && latestSubmitterComment) {
                            manualActivityIndicator = {
                              dotClass: "bg-emerald-500",
                              icon: MessageSquare,
                              iconClass: "text-emerald-700",
                              borderClass: "border-emerald-200/80",
                              title: "Submitter responded — review and close if resolved.",
                              ariaLabel: "Submitter responded to manual query",
                            }
                          } else if (isLatestAssignedUser && latestSubmitterComment) {
                            manualActivityIndicator = {
                              dotClass: "bg-sky-500",
                              icon: Send,
                              iconClass: "text-sky-700",
                              borderClass: "border-sky-200/80",
                              title: "Your response was sent to the reviewer.",
                              ariaLabel: "Response sent to reviewer",
                            }
                          }
                        }
                        const crmSystemQueriesForField = useCrmDbQueries
                          ? filterQueriesForControl(crfQueriesFromApi, control.id, {
                              queryType: QUERY_TYPE_SYSTEM,
                            })
                          : []
                        const openSystemQueriesForField = crmSystemQueriesForField.filter((q) =>
                          isQueryOpenStatus(q.status)
                        )
                        const latestOpenSystemQueryForField = pickLatestQuery(openSystemQueriesForField)
                        const hasOpenFieldQuery =
                          openManualQueriesForField.length > 0 || openSystemQueriesForField.length > 0
                        const allFieldQueries = [...crmManualQueriesForField, ...crmSystemQueriesForField]
                        const sdvFieldKey = getSdvFieldKey(selectedForm?.id, controlIdStr)
                        const piFieldKey = getPiFieldKey(selectedForm?.id, controlIdStr)
                        const needsResdv = fieldRequiresReverificationAfterQueries(allFieldQueries, {
                          approved: sdvApproved,
                        })
                        const needsResign = fieldRequiresReverificationAfterQueries(allFieldQueries, {
                          approved: piSigned,
                        })
                        const sdvApprovedEffective = sdvApproved && !needsResdv
                        const piSignedEffective = piSigned && !needsResign
                        const piBlockedBySdv =
                          shouldShowSdvBeforeSignGates(piReviewOrder) && isSdvEligibleControl && hasFieldValueForSdv && !sdvApprovedEffective
                        const isSdvMarked = canShowSdvPerField && isSdvEligibleControl && hasFieldValueForSdv && sdvApprovedEffective
                        const isPiMarked = canShowPiPerField && isSdvEligibleControl && hasFieldValueForSdv && piSignedEffective
                        /** Assigned submitter may correct non-table fields on submitted CRF while a query is open. */
                        const canBypassSubmitLockForQueryCorrection =
                          canWorkOnQueries &&
                          !isTableControl &&
                          ((latestOpenQuery &&
                            !isQueryClosedStatus(latestOpenQuery.status) &&
                            Number(getQueryAssignedToUserId(latestOpenQuery)) === Number(loggedInUserId)) ||
                            (latestOpenSystemQueryForField &&
                              !isQueryClosedStatus(latestOpenSystemQueryForField.status) &&
                              Number(getQueryAssignedToUserId(latestOpenSystemQueryForField)) ===
                                Number(loggedInUserId)))
                        const isFieldDisabled =
                          readonlyFlag ||
                          isControlDbLocked(
                            controlIdStr,
                            activeDataEntrySectionId ?? selectedForm?.sectionId ?? selectedForm?.section?.id,
                          ) ||
                          (isFormInteractionLocked && !canBypassSubmitLockForQueryCorrection)
                        const uidForQueryHighlight = Number(loggedInUserId)
                        const submitterQueryHighlightStatus = (() => {
                          if (!canBypassSubmitLockForQueryCorrection || !Number.isFinite(uidForQueryHighlight)) {
                            return null
                          }
                          if (
                            latestOpenQuery &&
                            !isQueryClosedStatus(latestOpenQuery.status) &&
                            Number(getQueryAssignedToUserId(latestOpenQuery)) === uidForQueryHighlight
                          ) {
                            return latestOpenQuery.status
                          }
                          if (
                            latestOpenSystemQueryForField &&
                            !isQueryClosedStatus(latestOpenSystemQueryForField.status) &&
                            Number(getQueryAssignedToUserId(latestOpenSystemQueryForField)) ===
                              uidForQueryHighlight
                          ) {
                            return latestOpenSystemQueryForField.status
                          }
                          return null
                        })()
                        const latestSystemQueryForField = pickLatestQuery(crmSystemQueriesForField)
                        /** Table submit-lock override: only queried assigned cells are editable (not the whole table). */
                        const tableEditableCellsByFieldId = (() => {
                          if (
                            !isTableControl ||
                            !isSubmittedFormLocked ||
                            !canWorkOnQueries ||
                            isPermissionLockedForDataEntry
                          ) {
                            return {}
                          }
                          const assignedUserId = Number(loggedInUserId)
                          if (!Number.isFinite(assignedUserId)) return {}
                          const out = {}
                          const markEditable = (q) => {
                            if (!q || isQueryClosedStatus(q.status)) return
                            if (Number(getQueryAssignedToUserId(q)) !== assignedUserId) return
                            const flatFieldId = resolveQueryFieldIdToFormFlatKey(q.fieldId)
                            if (!flatFieldId || !flatFieldId.startsWith(`${controlIdStr}_row_`)) return
                            out[flatFieldId] = true
                          }
                          openManualQueriesForField.forEach(markEditable)
                          openSystemQueriesForField.forEach(markEditable)
                          return out
                        })()
                        const isQueryableControl = !["label", "hr"].includes((evaluatedControl.type || "").toLowerCase())
                        const tableColumnCount = Math.max(1, Number(evaluatedControl.properties?.columns || 1))
                        const tableColumnHeaders = Array.isArray(evaluatedControl.properties?.columnHeaders)
                          ? evaluatedControl.properties.columnHeaders
                          : []
                        const tableCellLabels = Array.isArray(evaluatedControl.properties?.cellLabels)
                          ? evaluatedControl.properties.cellLabels
                          : []
                        const tableDesignRows = Math.max(1, Number(evaluatedControl.properties?.rows || 1))
                        const addRowEnabled = Boolean(evaluatedControl.properties?.addRow)
                        const rowCountKey = `${control.id}_rowCount`
                        const rowCountFromForm = addRowEnabled ? parseInt((formData[selectedForm?.id] || {})[rowCountKey], 10) : NaN
                        const tableRowCount =
                          addRowEnabled && !Number.isNaN(rowCountFromForm) && rowCountFromForm > 0
                            ? Math.max(tableDesignRows, rowCountFromForm)
                            : tableDesignRows
                        const tableCellLabSoftWarningsMap = isTableControl
                          ? buildLabSoftWarningsForTableControl(
                              evaluatedControl,
                              evaluatedControl.properties,
                              tableRowCount,
                            )
                          : {}
                        const softWarnings = !isTableControl
                          ? getSoftWarningsForControl(control.id, controlValue, evaluatedControl.properties)
                          : []
                        const hasSystemQueryRisk = useCrmDbQueries
                          ? crmSystemQueriesForField.length > 0
                          : softWarnings.length > 0 ||
                            (isTableControl && Object.keys(tableCellLabSoftWarningsMap).length > 0)
                        const tableColumnOptions = isTableControl
                          ? Array.from({ length: tableColumnCount }, (_, idx) => ({
                            index: idx,
                            label:
                              tableColumnHeaders[idx] != null && tableColumnHeaders[idx] !== ""
                                ? String(tableColumnHeaders[idx])
                                : `Column ${idx + 1}`,
                          }))
                          : []
                        const tableColumnTypes = isTableControl
                          ? (Array.isArray(evaluatedControl?.properties?.columnTypes) ? evaluatedControl.properties.columnTypes : [])
                          : []
                        const tableColumnOptionValues = isTableControl
                          ? (Array.isArray(evaluatedControl?.properties?.columnOptionValues) ? evaluatedControl.properties.columnOptionValues : [])
                          : []
                        const controlChoiceOptions = !isTableControl
                          ? normalizeQueryChoiceOptions(evaluatedControl)
                          : []
                        const tableRowOptions = isTableControl
                          ? Array.from({ length: tableRowCount }, (_, idx) => {
                            const rowOneBased = idx + 1
                            const firstCellLabelRaw = tableCellLabels?.[idx]?.[0]
                            const rowLabel =
                              firstCellLabelRaw != null && String(firstCellLabelRaw).trim() !== ""
                                ? String(firstCellLabelRaw).trim()
                                : `Row ${rowOneBased}`
                            return { index: rowOneBased, label: rowLabel }
                          })
                          : []
                        const syncState = recentAuditSyncedFields?.[String(control.id)] || null
                        const isRecentlyAuditSynced = Boolean(syncState)
                        const isSyncFading = syncState === "fading"
                        const hasPersistedRecord = Boolean(
                          formAuditBaselineById?.[selectedForm?.id]?.hasPersistedRecord,
                        )
                        const baselineValuesForControl = formAuditBaselineById?.[selectedForm?.id]?.values || {}
                        const baselineValRaw = baselineValuesForControl?.[controlIdStr]
                        // Show audit icon only when baseline/persisted value truly exists from API.
                        const baselineCandidateRaw = baselineValRaw
                        const baselineHasValue = (() => {
                          if (!isTableControl) {
                            return String(normalizeAuditFieldValue(baselineCandidateRaw) ?? "").trim() !== ""
                          }
                          const tablePrefix = `${controlIdStr}_row_`
                          const keys = Object.keys(baselineValuesForControl || {}).filter((k) =>
                            String(k).startsWith(tablePrefix),
                          )
                          if (keys.length === 0) return false
                          return keys.some((k) => {
                            const v = normalizeAuditFieldValue(baselineValuesForControl?.[k])
                            return String(v ?? "").trim() !== ""
                          })
                        })()
                        const auditPolicyEnabled = hasPersistedRecord && baselineHasValue
                        const auditDirty = Boolean(auditLightDirtyById?.[controlIdStr])
                        const isLightDirty = auditPolicyEnabled && auditDirty
                        // Global behavior: user can edit directly; no mandatory "unlock" click.
                        // Keep lock only while reason modal is open.
                        const auditLocked = auditPolicyEnabled && Boolean(auditReasonModal?.open)
                        const inputLocked = isFieldDisabled || auditLocked

                        const isAiFilledField = Boolean(
                          aiSessionHighlightByFieldId?.[getSdvFieldKey(selectedForm?.id, controlIdStr)],
                        )
                        const navigatedFlatKey = navigatedQueryFieldKey
                          ? resolveQueryFieldIdToFormFlatKey(navigatedQueryFieldKey)
                          : ""
                        const isQueryNavigationHighlight = Boolean(
                          navigatedFlatKey &&
                            (navigatedFlatKey === controlIdStr ||
                              navigatedFlatKey.startsWith(`${controlIdStr}_row_`) ||
                              queryFieldMatchesControl(navigatedQueryFieldKey, controlIdStr)),
                        )

                        return (
                          <div
                            key={control.id}
                            id={toEcrfFieldDomId(controlIdStr)}
                            style={virtualPositionStyle}
                            className={`${colSpanClass} min-w-0 rounded-xl border p-3 shadow-[0_6px_16px_-12px_rgba(15,23,42,0.35)] backdrop-blur-[1px] space-y-2 transition-all duration-700 ${
                              isQueryNavigationHighlight
                                ? "border-amber-400/90 bg-amber-50/55 ring-2 ring-amber-300/65 shadow-[0_10px_24px_-14px_rgba(245,158,11,0.35)]"
                                : isAiFilledField
                                ? "border-amber-200/80 bg-amber-50/30 ring-1 ring-amber-200/50"
                                : isPiMarked
                                ? "border-indigo-200/80 bg-indigo-50/12 shadow-[0_8px_18px_-16px_rgba(79,70,229,0.24)]"
                                : isSdvMarked
                                ? "border-emerald-200/80 bg-emerald-50/12 shadow-[0_8px_18px_-16px_rgba(16,185,129,0.24)]"
                                : submitterQueryHighlightStatus != null
                                  ? getSubmitterQueryFieldCardToneClasses(submitterQueryHighlightStatus)
                                  : isLightDirty
                                ? "border-emerald-300/80 bg-emerald-50/30"
                                : isRecentlyAuditSynced
                                ? isSyncFading
                                  ? "border-emerald-200/70 bg-emerald-50/20 opacity-80"
                                  : "border-emerald-300/80 bg-emerald-50/40 opacity-100"
                                : "border-slate-200/70 bg-slate-50/70"
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0 flex items-center gap-2">
                                  {canShowSdvPerField && !isTableControl && isSdvEligibleControl && hasFieldValueForSdv && (
                                    // Native title attribute instead of Radix Tooltip.
                                    // `hasFieldValueForSdv` flips on every value change, which would
                                    // mount/unmount a Radix Tooltip and feed its internal `setTrigger`
                                    // useState through composeRefs cleanup — a known cascade source for
                                    // "Maximum update depth exceeded" inside safelyDetachRef under rapid
                                    // radio clicks on saved CRFs. Native title gives the same UX value
                                    // without the Radix ref/state machine.
                                    <input
                                      type="checkbox"
                                      className={`h-4 w-4 rounded border cursor-pointer flex-shrink-0 transition-all duration-200 ${
                                        sdvApprovedEffective
                                          ? "border-emerald-500 accent-emerald-600 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]"
                                          : sdvChecked
                                            ? "border-emerald-400 accent-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]"
                                            : "border-slate-300 accent-emerald-600 hover:border-emerald-400"
                                      }`}
                                      checked={sdvChecked}
                                      // SDV must remain interactive even when form is submitted/locked.
                                      disabled={false}
                                      aria-label="SDV"
                                      title={
                                        needsResdv && hasOpenFieldQuery
                                          ? "Re-SDV required — open query on this field"
                                          : needsResdv
                                            ? "Re-SDV required — verify field again after query resolution"
                                            : "SDV"
                                      }
                                      onChange={(e) =>
                                        handleSdvFieldCheckboxChange(
                                          selectedForm?.id,
                                          controlIdStr,
                                          e.target.checked,
                                        )
                                      }
                                    />
                                  )}
                                  {canShowPiPerField && !isTableControl && isSdvEligibleControl && hasFieldValueForSdv && (
                                    <input
                                      type="checkbox"
                                      className={`h-4 w-4 rounded border cursor-pointer flex-shrink-0 transition-all duration-200 ${
                                        piChecked
                                          ? "border-indigo-500 accent-indigo-600 shadow-[0_0_0_3px_rgba(79,70,229,0.18)]"
                                          : "border-slate-300 accent-indigo-600 hover:border-indigo-400"
                                      }`}
                                      checked={piChecked}
                                      disabled={piBlockedBySdv || isPiSignedReadOnly || piFieldSignoffSaving}
                                      aria-label="PI sign-off"
                                      title={
                                        piBlockedBySdv
                                          ? "Field SDV approval is required before PI sign-off."
                                          : needsResign && hasOpenFieldQuery
                                            ? "Re-sign required — open query on this field"
                                            : needsResign
                                              ? "Re-sign required — sign field again after query resolution"
                                              : "PI sign-off"
                                      }
                                      onChange={(e) =>
                                        handlePiFieldCheckboxChange(
                                          selectedForm?.id,
                                          controlIdStr,
                                          e.target.checked,
                                        )
                                      }
                                    />
                                  )}
                                  {!controlRendererShowsFieldHeading ? (
                                    <label className="block text-sm font-semibold text-slate-700">
                                      {fieldLabel}
                                      {isRequired && <span className="text-rose-500 ml-1">*</span>}
                                    </label>
                                  ) : (
                                    <span className="min-w-0 flex-1 shrink" aria-hidden="true" />
                                  )}
                                </div>
                                <div className="flex max-w-[55%] flex-wrap items-center justify-end gap-2 flex-shrink-0">
                                  {isRecentlyAuditSynced && (
                                    <span
                                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold transition-all duration-700 ${
                                        isSyncFading
                                          ? "border-emerald-100 bg-emerald-50/40 text-emerald-500 opacity-70"
                                          : "border-emerald-200 bg-emerald-50 text-emerald-700 opacity-100"
                                      }`}
                                    >
                                      <CheckCircle className="h-3 w-3" />
                                      Synced
                                    </span>
                                  )}
                                  {!isCraReviewer && !isCrmReviewer && !isSubmittedFormLocked && auditPolicyEnabled && (
                                    <div className="flex items-center gap-1">
                                      {/*
                                        Audit indicator uses a native <button title="..."> instead of a
                                        Radix Tooltip. Every field card renders this; Radix Tooltip's
                                        internal `setTrigger` useState (passed via composeRefs) becomes
                                        a setState target inside the commit-phase cleanup. With hundreds
                                        of these in a section under rapid radio clicks, the React
                                        scheduler exceeds MAX_UPDATE_COUNT inside safelyDetachRef.
                                        Native title attribute gives the same hover hint without the
                                        Radix state/ref machinery — UX value preserved, crash source
                                        removed.
                                      */}
                                      <button
                                        type="button"
                                        data-audit-transition="audit-light-action"
                                        onClick={() =>
                                          void scheduleAuditReasonPrompt(selectedForm?.id, {
                                            triggerControlId: controlIdStr,
                                            preferTriggerField: true,
                                            onlyTriggerField: !auditDirty,
                                          })
                                        }
                                        className={
                                          auditDirty
                                            ? "inline-flex h-7 w-7 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-50"
                                            : "inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                                        }
                                        aria-label={auditDirty ? "Add reason" : "Edit value"}
                                        title={
                                          auditDirty
                                            ? "Click ✓ to add reason for this change"
                                            : "Edit directly; ✓ appears after change"
                                        }
                                      >
                                        {auditDirty ? (
                                          <CheckCircle className="h-3.5 w-3.5" />
                                        ) : (
                                          <Edit className="h-3 w-3" />
                                        )}
                                      </button>
                                    </div>
                                  )}
                                </div>
                                {canWorkOnQueries && isQueryableControl && !isTableControl && (
                                  <div className="flex items-center gap-2">
                                    {useCrmDbQueries && latestSystemQueryForField && (
                                      <button
                                        type="button"
                                        disabled={disableRaiseManualQueryForValidation}
                                        onClick={() => {
                                          if (disableRaiseManualQueryForValidation) return
                                          setCrmSystemQueryReview(latestSystemQueryForField)
                                        }}
                                        className={`${getCrmQueryIconButtonClass(latestSystemQueryForField.status)}${
                                          disableRaiseManualQueryForValidation
                                            ? " opacity-45 cursor-not-allowed"
                                            : ""
                                        }`}
                                        title={
                                          disableRaiseManualQueryForValidation
                                            ? "Fix validation errors on this field before opening the query."
                                            : `System query — ${getQueryStatusLabel(latestSystemQueryForField.status)} (${crmSystemQueriesForField.length}). Click for details.`
                                        }
                                        aria-label={`System query ${getQueryStatusLabel(latestSystemQueryForField.status)}, count ${crmSystemQueriesForField.length}`}
                                      >
                                        <AlertTriangle className="h-3.5 w-3.5" />
                                        {crmSystemQueriesForField.length > 1 && (
                                          <span
                                            className={`absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-0.5 text-[9px] font-bold leading-none text-white ${getCrmQueryIconBadgeClass(latestSystemQueryForField.status)}`}
                                          >
                                            {crmSystemQueriesForField.length > 9 ? "9+" : crmSystemQueriesForField.length}
                                          </span>
                                        )}
                                      </button>
                                    )}
                                    {!useCrmDbQueries && softWarnings.length > 0 && (
                                      <span
                                        className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-amber-200/90 bg-amber-50/90 text-amber-800 shadow-sm"
                                        title={`System query risk (${softWarnings.length})`}
                                        role="img"
                                        aria-label={`System query risk, count ${softWarnings.length}`}
                                      >
                                        <AlertTriangle className="h-3.5 w-3.5" />
                                        {softWarnings.length > 1 && (
                                          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-amber-600 px-0.5 text-[9px] font-bold leading-none text-white">
                                            {softWarnings.length > 9 ? "9+" : softWarnings.length}
                                          </span>
                                        )}
                                      </span>
                                    )}
                                    {latestManualQueryForField && (
                                      <button
                                        type="button"
                                        disabled={disableRaiseManualQueryForValidation}
                                        onClick={() => {
                                          if (disableRaiseManualQueryForValidation) return
                                          setManualQueryReview(latestManualQueryForField)
                                        }}
                                        className={`${getCrmQueryIconButtonClass(latestManualQueryForField.status)}${
                                          disableRaiseManualQueryForValidation
                                            ? " opacity-45 cursor-not-allowed"
                                            : ""
                                        }`}
                                        title={
                                          disableRaiseManualQueryForValidation
                                            ? "Fix validation errors on this field before opening the query."
                                            : `Manual query — ${getQueryStatusLabel(latestManualQueryForField.status)} (${manualQueryBadgeCount} open). Click for details.`
                                        }
                                        aria-label={`Manual query ${getQueryStatusLabel(latestManualQueryForField.status)}, open count ${manualQueryBadgeCount}`}
                                      >
                                        <FileText className="h-3.5 w-3.5" />
                                        {manualQueryBadgeCount > 0 && (
                                        <span
                                          className={`absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-0.5 text-[9px] font-bold leading-none text-white ${getCrmQueryIconBadgeClass(latestManualQueryForField.status)}`}
                                        >
                                          {manualQueryBadgeCount > 9 ? "9+" : manualQueryBadgeCount}
                                        </span>
                                        )}
                                      </button>
                                    )}
                                    {manualActivityIndicator && (() => {
                                      const ActIcon = manualActivityIndicator.icon
                                      return (
                                        <span
                                          className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-full border bg-white/95 px-1.5 shadow-sm ${manualActivityIndicator.borderClass}`}
                                          title={manualActivityIndicator.title}
                                          role="img"
                                          aria-label={manualActivityIndicator.ariaLabel}
                                        >
                                          <span
                                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${manualActivityIndicator.dotClass}`}
                                            aria-hidden
                                          />
                                          <ActIcon className={`h-3.5 w-3.5 shrink-0 ${manualActivityIndicator.iconClass}`} aria-hidden />
                                        </span>
                                      )
                                    })()}
                                    {canRaiseManualQueries && (() => {
                                      const raiseManualQueryButtonDisabled =
                                        (hasOpenManualQuery && !isTableControl) ||
                                        disableRaiseManualQueryForValidation
                                      // Native title instead of Radix Tooltip. This button renders once
                                      // per editable control per CRC reviewer — under rapid radio clicks
                                      // any cascade from its Tooltip's `setTrigger` useState (via
                                      // composeRefs cleanup) compounded with rule-driven mount/unmount
                                      // and produced "Maximum update depth exceeded" inside
                                      // safelyDetachRef. The hover hint is preserved via the title.
                                      const raiseQueryTitle = disableRaiseManualQueryForValidation
                                        ? "Fix validation errors on this field before opening or raising a query."
                                        : hasOpenManualQuery && hasSystemQueryRisk
                                        ? "Both present: system query + manual open query"
                                        : hasOpenManualQuery
                                        ? isTableControl
                                          ? "Manual query exists for this table. You can still add for another column/row."
                                          : "Manual query already raised for this field"
                                        : hasSystemQueryRisk
                                          ? useCrmDbQueries
                                            ? "Open system query on this field — use Review link below to comment or close."
                                            : "System query risk detected. You can also raise a manual query."
                                          : "Raise manual reviewer query for this field"
                                      return (
                                        <span className="inline-flex">
                                          <button
                                            type="button"
                                            disabled={raiseManualQueryButtonDisabled}
                                            onClick={() =>
                                              openManualQueryDraft(
                                                control.id,
                                                fieldLabel,
                                                controlValue,
                                                isTableControl
                                                  ? { controlType: "table", tableColumnOptions }
                                                  : {
                                                    controlType: evaluatedControl.type || "",
                                                    controlOptions: controlChoiceOptions,
                                                  }
                                              )
                                            }
                                            className={`rounded-md border px-1.5 py-1 transition-colors ${
                                              raiseManualQueryButtonDisabled
                                                ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                                                : hasOpenManualQuery && hasSystemQueryRisk
                                                  ? "border-teal-300/80 bg-teal-50/90 text-teal-700 hover:bg-teal-100"
                                                  : hasOpenManualQuery
                                                    ? "border-emerald-300/80 bg-emerald-50/90 text-emerald-700 hover:bg-emerald-100"
                                                    : hasSystemQueryRisk
                                                      ? "border-amber-300/80 bg-amber-50/90 text-amber-700 hover:bg-amber-100"
                                                      : "border-emerald-300/80 bg-emerald-50/90 text-emerald-700 hover:bg-emerald-100"
                                            }`}
                                            aria-label="Raise query"
                                            title={raiseQueryTitle}
                                          >
                                            {hasOpenManualQuery && hasSystemQueryRisk ? (
                                              <AlertTriangle className="w-3.5 h-3.5" />
                                            ) : hasOpenManualQuery ? (
                                              <Clock className="w-3.5 h-3.5" />
                                            ) : hasSystemQueryRisk ? (
                                              <AlertTriangle className="w-3.5 h-3.5" />
                                            ) : (
                                              <FileText className="w-3.5 h-3.5" />
                                            )}
                                          </button>
                                        </span>
                                      )
                                    })()}
                                  </div>
                                )}
                              </div>
                              {useCrmDbQueries && openSystemQueriesForField.length > 0 && (
                                <div className="mt-1 space-y-1.5 rounded-lg border border-amber-200/80 bg-amber-50/70 p-2">
                                  {openSystemQueriesForField.map((q) => (
                                    <div key={q.id} className="text-[11px] text-amber-900">
                                      <p className="font-semibold text-amber-950">System-generated query</p>
                                      <p className="text-amber-900 whitespace-pre-wrap">{q.queryText}</p>
                                      {getQueryApproverComment(q) && (
                                        <p className="text-slate-700 mt-0.5">Reviewer note: {getQueryApproverComment(q)}</p>
                                      )}
                                      <button
                                        type="button"
                                        disabled={disableRaiseManualQueryForValidation}
                                        onClick={() => {
                                          if (disableRaiseManualQueryForValidation) return
                                          setCrmSystemQueryReview(q)
                                        }}
                                        title={
                                          disableRaiseManualQueryForValidation
                                            ? "Fix validation errors on this field before opening the query."
                                            : undefined
                                        }
                                        className={`mt-1 text-xs font-semibold underline ${
                                          disableRaiseManualQueryForValidation
                                            ? "cursor-not-allowed text-slate-400 no-underline"
                                            : "text-emerald-700"
                                        }`}
                                      >
                                        Comment / close query
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            {isTableControl && (
                              <ControlRenderer
                                control={evaluatedControl}
                                isViewMode={
                                  isFormInteractionLocked
                                }
                                isPreviewMode={
                                  !isFormInteractionLocked
                                }
                                formValues={currentRenderFormValues}
                                  tableCellLabSoftWarnings={tableCellLabSoftWarningsMap}
                                  tableCellErrors={tableCellErrors}
                                  tableSdvVisibleByFieldId={(() => {
                                    if (!(canShowSdvPerField && isTableControl)) return EMPTY_TABLE_KEY_MAP
                                    // O(M) lookup using the per-render prefix index — replaces the
                                    // previous O(N) scan of every form-slice key per table per render.
                                    const populated = tableRowKeyIndexForCurrentForm.populatedKeysByTable[controlIdStr]
                                    if (!populated || populated.length === 0) return EMPTY_TABLE_KEY_MAP
                                    const out = {}
                                    for (let i = 0; i < populated.length; i += 1) {
                                      out[populated[i]] = true
                                    }
                                    return out
                                  })()}
                                  tableSdvCheckedByFieldId={(() => {
                                    if (!(canShowSdvPerField && isTableControl)) return EMPTY_TABLE_KEY_MAP
                                    const allKeys = tableRowKeyIndexForCurrentForm.allKeysByTable[controlIdStr]
                                    if (!allKeys || allKeys.length === 0) return EMPTY_TABLE_KEY_MAP
                                    const out = {}
                                    const formId = selectedForm?.id
                                    for (let i = 0; i < allKeys.length; i += 1) {
                                      const k = allKeys[i]
                                      out[k] = Boolean(sdvSelectionsByField[getSdvFieldKey(formId, k)])
                                    }
                                    return out
                                  })()}
                                  onToggleTableSdv={(fieldId, checked) =>
                                    setSdvChecked(selectedForm?.id, String(fieldId || ""), Boolean(checked))
                                  }
                                  tableAuditCellEnabledByFieldId={
                                    suppressTableCellAuditChrome
                                      ? {}
                                      : (() => {
                                          const out = {}
                                          const prefix = `${controlIdStr}_row_`
                                          Object.entries(baselineValuesForControl || {}).forEach(([k, raw]) => {
                                            const key = String(k || "")
                                            if (!key.startsWith(prefix)) return
                                            const val = String(normalizeAuditFieldValue(raw) ?? "").trim()
                                            if (val) out[key] = true
                                          })
                                          return out
                                        })()
                                  }
                                  tableAuditCellDirtyByFieldId={suppressTableCellAuditChrome ? {} : (auditLightDirtyById || {})}
                                  onOpenTableCellAudit={
                                    suppressTableCellAuditChrome
                                      ? undefined
                                      : ({ fieldId }) =>
                                          void scheduleAuditReasonPrompt(selectedForm?.id, {
                                            triggerControlId: String(fieldId || ""),
                                            preferTriggerField: true,
                                          })
                                  }
                                onValueChange={(fieldId, value) => handleFormInputChange(fieldId, value)}
                                tableManualQueries={crmManualQueriesForField}
                                tableEditableCellByFieldId={tableEditableCellsByFieldId}
                                onOpenTableCellQuery={
                                  canWorkOnQueries
                                    ? (query) => setManualQueryReview(query)
                                    : undefined
                                }
                                onRaiseTableCellQuery={
                                  canRaiseManualQueries
                                    ? ({ rowIndex, colIndex, rowLabel, columnLabel, cellValue }) => {
                                        const selectedColumnType = String(tableColumnTypes[colIndex] || "text").toLowerCase()
                                        const selectedColumnRawOptions = tableColumnOptionValues[colIndex]
                                        const selectedColumnOptions =
                                          typeof selectedColumnRawOptions === "string" && selectedColumnRawOptions.trim()
                                            ? selectedColumnRawOptions
                                                .split(",")
                                                .map((s) => s.trim())
                                                .filter(Boolean)
                                                .map((opt) => ({ value: opt, label: opt }))
                                            : []
                                        openManualQueryDraft(
                                          control.id,
                                          fieldLabel,
                                          cellValue ?? "",
                                          {
                                            controlType: selectedColumnType,
                                            isTableQuery: true,
                                            controlOptions: selectedColumnOptions,
                                            tableColumnOptions,
                                            tableRowOptions,
                                            preselectedTableColumnIndex: colIndex,
                                            preselectedTableColumnLabel: columnLabel || "",
                                            preselectedTableRowIndex: rowIndex,
                                            preselectedTableRowLabel: rowLabel || "",
                                          }
                                        )
                                      }
                                    : undefined
                                }
                              />
                            )}
                            {evaluatedControl.type === "lab" && (
                              <div>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={controlValue}
                                    onChange={(e) => handleFormInputChange(control.id, e.target.value)}
                                    placeholder={evaluatedControl.properties?.placeholder || ""}
                                    maxLength={evaluatedControl.properties?.maxLength}
                                    min={evaluatedControl.properties?.min}
                                    max={evaluatedControl.properties?.max}
                                    readOnly={inputLocked}
                                    disabled={inputLocked}
                                    className={`w-full px-4 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-all bg-white ${
                                      hasErrors 
                                        ? "border-rose-200 focus:border-rose-400 focus:ring-rose-100/70" 
                                        : "border-slate-200 focus:border-emerald-400 focus:ring-emerald-100/70"
                                    } ${
                                      inputLocked
                                        ? "bg-slate-100 cursor-not-allowed opacity-75" 
                                        : ""
                                    }`}
                                  />
                                  {evaluatedControl.properties?.postfix && (
                                    <span className="text-slate-600 text-sm whitespace-nowrap">
                                      {evaluatedControl.properties.postfix}
                                    </span>
                                  )}
                                </div>
                                {showInlineErrorMessages && hasErrors && (
                                  <div className="mt-1 space-y-0.5">
                                    {controlErrorsToShow.map((error, idx) => (
                                      <p key={idx} className="text-xs text-rose-600 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" />
                                        {error}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            {evaluatedControl.type === "text" && (
                              <div>
                                <div className="flex items-center gap-2">
                                  {normalizeTerminologyCoding(evaluatedControl.properties?.terminologyCoding) ? (
                                    <div className="flex-1 min-w-0">
                                      <TerminologyCodingInput
                                        value={controlValue}
                                        onChange={(v) => handleFormInputChange(control.id, v)}
                                        coding={evaluatedControl.properties?.terminologyCoding}
                                        placeholder={evaluatedControl.properties?.placeholder || ""}
                                        maxLength={evaluatedControl.properties?.maxLength}
                                        disabled={inputLocked}
                                        hasError={hasErrors}
                                      />
                                    </div>
                                  ) : (
                                    <input
                                      type="text"
                                      value={controlValue}
                                      onChange={(e) => handleFormInputChange(control.id, e.target.value)}
                                      placeholder={evaluatedControl.properties?.placeholder || ""}
                                      maxLength={evaluatedControl.properties?.maxLength}
                                      min={evaluatedControl.properties?.min}
                                      max={evaluatedControl.properties?.max}
                                      readOnly={inputLocked}
                                      disabled={inputLocked}
                                      className={`w-full px-4 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-all bg-white ${
                                        hasErrors 
                                          ? "border-rose-200 focus:border-rose-400 focus:ring-rose-100/70" 
                                          : "border-slate-200 focus:border-emerald-400 focus:ring-emerald-100/70"
                                      } ${
                                        inputLocked
                                          ? "bg-slate-100 cursor-not-allowed opacity-75" 
                                          : ""
                                      }`}
                                    />
                                  )}
                                  {evaluatedControl.properties?.postfix && (
                                    <span className="text-slate-600 text-sm whitespace-nowrap">
                                      {evaluatedControl.properties.postfix}
                                    </span>
                                  )}
                                </div>
                                {showInlineErrorMessages && hasErrors && (
                                  <div className="mt-1 space-y-0.5">
                                    {controlErrorsToShow.map((error, idx) => (
                                      <p key={idx} className="text-xs text-rose-600 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" />
                                        {error}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            {evaluatedControl.type === "number" && (
                              <div>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={normalizeManualNumberInputForScale(
                                      controlValue,
                                      evaluatedControl.properties?.scale
                                    )}
                                    onKeyDown={(e) => {
                                      const key = e.key
                                      const ctrl = e.ctrlKey || e.metaKey
                                      const allowedNavKeys = [
                                        "Backspace",
                                        "Delete",
                                        "Tab",
                                        "Escape",
                                        "Enter",
                                        "ArrowLeft",
                                        "ArrowRight",
                                        "ArrowUp",
                                        "ArrowDown",
                                        "Home",
                                        "End",
                                      ]
                                      if (ctrl || allowedNavKeys.includes(key)) return

                                      const isDigit = /^[0-9]$/.test(key)
                                      const scale = Number.isFinite(Number(evaluatedControl.properties?.scale))
                                        ? Math.max(0, Number(evaluatedControl.properties?.scale))
                                        : null
                                      if (isDigit) return
                                      if (key === "." && scale !== 0) {
                                        const current = String(e.currentTarget?.value ?? "")
                                        if (!current.includes(".")) return
                                      }

                                      if (key === "e" || key === "E") {
                                        e.preventDefault()
                                        return
                                      }
                                      e.preventDefault()
                                    }}
                                    onChange={(e) => {
                                      let raw = String(e.target.value ?? "")
                                      const scale = Number.isFinite(Number(evaluatedControl.properties?.scale))
                                        ? Math.max(0, Number(evaluatedControl.properties?.scale))
                                        : null
                                      // Keep digits and a single decimal separator; block exponent/special chars.
                                      raw = raw.replace(/[^0-9.]/g, "")
                                      const firstDot = raw.indexOf(".")
                                      if (firstDot !== -1) {
                                        raw =
                                          raw.slice(0, firstDot + 1) +
                                          raw.slice(firstDot + 1).replace(/\./g, "")
                                      }
                                      if (scale === 0) {
                                        raw = raw.replace(/\./g, "")
                                      } else if (scale != null && firstDot !== -1) {
                                        const [intPart, fracPart = ""] = raw.split(".")
                                        raw = `${intPart}.${fracPart.slice(0, scale)}`
                                      }
                                      const nextVal = normalizeManualNumberInputForScale(
                                        raw,
                                        evaluatedControl.properties?.scale
                                      )
                                      handleFormInputChange(control.id, nextVal)
                                    }}
                                    placeholder={evaluatedControl.properties?.placeholder || ""}
                                    min={evaluatedControl.properties?.min}
                                    max={evaluatedControl.properties?.max}
                                    step={evaluatedControl.properties?.step || "any"}
                                    readOnly={inputLocked}
                                    disabled={inputLocked}
                                    className={`w-full px-4 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-all bg-white ${
                                      hasErrors 
                                        ? "border-rose-200 focus:border-rose-400 focus:ring-rose-100/70" 
                                        : "border-slate-200 focus:border-emerald-400 focus:ring-emerald-100/70"
                                    } ${
                                      inputLocked
                                        ? "bg-slate-100 cursor-not-allowed opacity-75" 
                                        : ""
                                    }`}
                                  />
                                  {evaluatedControl.properties?.postfix && (
                                    <span className="text-slate-600 text-sm whitespace-nowrap">
                                      {evaluatedControl.properties.postfix}
                                    </span>
                                  )}
                                </div>
                                {showInlineErrorMessages && hasErrors && (
                                  <div className="mt-1 space-y-0.5">
                                    {controlErrorsToShow.map((error, idx) => (
                                      <p key={idx} className="text-xs text-rose-600 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" />
                                        {error}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            {String(evaluatedControl.type || "").toLowerCase().includes("date") && (() => {
                              const props = evaluatedControl.properties || {}
                              const controlTypeLower = String(evaluatedControl.type || "").toLowerCase()
                              const today = new Date()
                              const yyyy = today.getFullYear()
                              const mm = String(today.getMonth() + 1).padStart(2, "0")
                              const dd = String(today.getDate()).padStart(2, "0")
                              const todayStr = `${yyyy}-${mm}-${dd}`

                              // Prefer new dropdown-based restriction if present; otherwise derive from legacy flags
                              const dateRestriction =
                                props.dateRestriction ||
                                (props.currentDateOnly
                                  ? "onlyToday"
                                  : props.allowPastDates === false
                                  ? "allowFuture"
                                  : props.allowFutureDates === false
                                  ? "allowPast"
                                  : "")

                              let minDate = resolveBoundIso(props.minDate, "min") || props.minDate || ""
                              let maxDate = resolveBoundIso(props.maxDate, "max") || props.maxDate || ""
                              const resolveDynamicBoundForPicker = (sourceFieldId, role) => {
                                const sid = String(sourceFieldId || "").trim()
                                if (!sid) return ""
                                const raw = currentFormData?.[sid]
                                if (raw == null || !String(raw).trim()) return ""
                                const text = String(raw).trim()
                                if (isUkUnkDateString(text)) return text
                                return resolveBoundIso(text, role)
                              }
                              const dynamicMinDate = resolveDynamicBoundForPicker(
                                props.minDateFromFieldId,
                                "min",
                              )
                              const dynamicMaxDate = resolveDynamicBoundForPicker(
                                props.maxDateFromFieldId,
                                "max",
                              )
                              if (dynamicMinDate) minDate = dynamicMinDate
                              if (dynamicMaxDate) maxDate = dynamicMaxDate
                              const visitDateRestrictionMin = isVisitDateIdentifierControl(evaluatedControl)
                                ? normalizeIsoDateForBounds(visitPrimaryDateRestrictionMinDate)
                                : ""
                              const blockVisitDateUntilChainReady =
                                isVisitDateIdentifierControl(evaluatedControl) &&
                                (
                                  isStudySettingsLoading ||
                                  !isStudySettingsResolvedForCurrentStudy ||
                                  (
                                    isVisitDateRestrictionEnabled &&
                                    (
                                      isVisitDateChainLoading ||
                                      !selectedVisitScheduleKeyForDateRestriction ||
                                      !hasVisitDateChainForSelectedVisit
                                    )
                                  )
                                )
                              if (isVisitDateIdentifierControl(evaluatedControl)) {
                                logVisitDateRestrictionDebug("date_field_render_gate", {
                                  selectedVisitScheduleId: selectedVisit?.visitScheduleId ?? null,
                                  isStudySettingsLoading,
                                  isStudySettingsResolvedForCurrentStudy,
                                  isVisitDateRestrictionEnabled,
                                  isVisitDateChainLoading,
                                  hasVisitDateChainForSelectedVisit,
                                  resolvedMinDateExclusive: visitDateRestrictionMin || "",
                                  blocked: blockVisitDateUntilChainReady,
                                })
                              }
                              if (visitDateRestrictionMin) {
                                minDate =
                                  minDate && minDate > visitDateRestrictionMin
                                    ? minDate
                                    : visitDateRestrictionMin
                                // Visit primary-date restriction window:
                                // selected visit date must be strictly AFTER previous visit date
                                // and must not be in the future.
                                maxDate = maxDate && maxDate < todayStr ? maxDate : todayStr
                              }

                              if (dateRestriction === "allowPast") {
                                maxDate = maxDate || todayStr
                              } else if (dateRestriction === "allowFuture") {
                                minDate = minDate || todayStr
                              } else if (dateRestriction === "onlyToday") {
                                minDate = todayStr
                                maxDate = todayStr
                              }

                              logDateFieldRenderTrace({
                                controlId: control.id,
                                label: evaluatedControl.properties?.labelText || evaluatedControl.label || "",
                                readonly: Boolean(evaluatedControl.properties?.readonly),
                                disabled: Boolean(isFieldDisabled),
                                value: controlValue || "",
                                minDate: minDate || "",
                                maxDate: maxDate || "",
                              })

                              if (controlTypeLower === "ukunkdate") {
                                const triggerClass = `${
                                  hasErrors
                                    ? "border-rose-300 focus-within:border-rose-400 focus-within:ring-rose-100/70"
                                    : "border-slate-300 focus-within:border-emerald-400 focus-within:ring-emerald-100/70"
                                } ${inputLocked ? "bg-slate-100 cursor-not-allowed opacity-75" : ""}`
                                return (
                                  <UkUnkDatePicker
                                    value={controlValue || ""}
                                    onChange={(next) => handleFormInputChange(control.id, next)}
                                    disabled={inputLocked || blockVisitDateUntilChainReady}
                                    minDate={minDate || undefined}
                                    maxDate={maxDate || undefined}
                                    className={triggerClass}
                                  />
                                )
                              }

                              return (
                                <div>
                                  <DatePicker
                                    value={controlValue || null}
                                    onChange={(next) => {
                                      const value = next || ""
                                      if (
                                        visitDateRestrictionMin &&
                                        value &&
                                        value < visitDateRestrictionMin
                                      ) {
                                        handleFormInputChange(control.id, visitDateRestrictionMin)
                                        return
                                      }
                                      if (visitDateRestrictionMin && value && value > todayStr) {
                                        handleFormInputChange(control.id, todayStr)
                                        return
                                      }
                                      if (dateRestriction === "onlyToday" && value && value !== todayStr) {
                                        handleFormInputChange(control.id, todayStr)
                                        return
                                      }
                                      handleFormInputChange(control.id, value)
                                    }}
                                    minDate={minDate || undefined}
                                    maxDate={maxDate || undefined}
                                    disabled={inputLocked || blockVisitDateUntilChainReady}
                                    placeholder={evaluatedControl.properties?.placeholder || "dd-mm-yyyy"}
                                    className={`${
                                      hasErrors
                                        ? "border-rose-200 focus-within:border-rose-400 focus-within:ring-rose-100/70"
                                        : "border-slate-200 focus-within:border-emerald-400 focus-within:ring-emerald-100/70"
                                    } ${
                                      inputLocked
                                        ? "bg-slate-100 cursor-not-allowed opacity-75"
                                        : ""
                                    }`}
                                  />
                                  {showInlineErrorMessages && hasErrors && (
                                    <div className="mt-1 space-y-0.5">
                                      {controlErrorsToShow.map((error, idx) => (
                                        <p
                                          key={idx}
                                          className="text-xs text-rose-600 flex items-center gap-1"
                                        >
                                          <AlertTriangle className="w-3 h-3" />
                                          {error}
                                        </p>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            })()}
                            {evaluatedControl.type === "textarea" && (
                              <div>
                                <textarea
                                  rows={evaluatedControl.properties?.rows || 4}
                                  value={controlValue}
                                  onChange={(e) => handleFormInputChange(control.id, e.target.value)}
                                  placeholder={evaluatedControl.properties?.placeholder || ""}
                                  maxLength={evaluatedControl.properties?.maxLength}
                                  readOnly={inputLocked}
                                  disabled={inputLocked}
                                  className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-2 transition-all bg-white resize-none ${
                                    hasErrors 
                                      ? "border-rose-200 focus:border-rose-400 focus:ring-rose-100/70" 
                                      : "border-slate-200 focus:border-emerald-400 focus:ring-emerald-100/70"
                                  } ${
                                    inputLocked
                                      ? "bg-slate-100 cursor-not-allowed opacity-75" 
                                      : ""
                                  }`}
                                />
                                {showInlineErrorMessages && hasErrors && (
                                  <div className="mt-1 space-y-0.5">
                                    {controlErrorsToShow.map((error, idx) => (
                                      <p key={idx} className="text-xs text-rose-600 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" />
                                        {error}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            {evaluatedControl.type === "select" && (
                              <div>
                                <SearchableSelect
                                  value={controlValue}
                                  onChange={(nextVal) => handleFormInputChange(control.id, nextVal)}
                                  disabled={inputLocked}
                                  placeholder={evaluatedControl.properties?.placeholder || "Select..."}
                                  options={(evaluatedControl.properties?.options || []).map((option) => ({
                                    value: option?.value,
                                    label: option?.label ?? option?.value,
                                  }))}
                                  className={`${
                                    hasErrors 
                                      ? "border-rose-200 focus:border-rose-400 focus:ring-rose-100/70" 
                                      : "border-slate-200 focus:border-emerald-400 focus:ring-emerald-100/70"
                                  } ${
                                    inputLocked
                                      ? "bg-slate-100 cursor-not-allowed opacity-75" 
                                      : ""
                                  }`}
                                />
                                {showInlineErrorMessages && hasErrors && (
                                  <div className="mt-1 space-y-0.5">
                                    {controlErrorsToShow.map((error, idx) => (
                                      <p key={idx} className="text-xs text-rose-600 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" />
                                        {error}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            {(evaluatedControl.type === "radio" || evaluatedControl.type === "Radio" || evaluatedControl.type === "checkbox" || evaluatedControl.type === "CheckBox") && (
                              // Memoised on (control, controlValue, view/preview, onValueChange).
                              // This skips reconciliation of THIS control's
                              // radio/checkbox options when an unrelated
                              // field changes elsewhere in the form. For
                              // large CRFs with many option-based fields
                              // this is the single biggest "click-to-paint"
                              // perf win because React no longer rebuilds
                              // every other control's option list per
                              // keystroke/click.
                              <MemoizedSingleValueControlRenderer
                                control={evaluatedControl}
                                controlValue={currentRenderFormValues?.[evaluatedControl.id]}
                                isViewMode={isFormInteractionLocked}
                                isPreviewMode={!isFormInteractionLocked}
                                onValueChange={stableOnValueChange}
                              />
                            )}
                            {!useCrmDbQueries && softWarnings.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {softWarnings.map((warning, idx) => (
                                  <div key={`${control.id}-soft-${idx}`} className="text-xs text-amber-700 flex items-start gap-1.5">
                                    <AlertTriangle className="w-3 h-3 text-amber-600 mt-0.5 flex-shrink-0" />
                                    <p>
                                      <span className="inline-flex rounded-full bg-amber-100 border border-amber-200 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 mr-1.5 align-middle">
                                        System-generated
                                      </span>
                                      {warning}
                                      {" "}
                                      <span className="text-red-600">
                                        If you enter an incorrect value, the system will generate a query upon submission.
                                      </span>
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                            {evaluatedControl.properties?.tooltip && (
                              <p className="text-xs text-slate-500">{evaluatedControl.properties.tooltip}</p>
                            )}
                          </div>
                        )
                      })}
                                </div>
                                </div>
                                </div>
                                {hasMoreControls && (
                                  <div className="mt-3 flex items-center justify-center">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDataEntryControlRenderLimit((prev) =>
                                          Math.min(sectionControls.length, prev + 80)
                                        )
                                      }
                                      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                    >
                                      Load more fields ({controlsToRender.length}/{sectionControls.length})
                                    </button>
                                  </div>
                                )}
                              </>
                            )
                          })()
                        )}
                        </EcrfCrfBody>
                      </div>
                    )
                  })()}
                </div>
              </div>
              </>
                )}
              </div>
              {isAIMode &&
                !isSubmittedFormLocked &&
                hasAnySavePermission &&
                !isFormReadOnlyByPermission && (
                  <FillWithAiActionBar
                    placement="rail"
                    compact
                    onOpen={() => setShowAIFillModal(true)}
                    loading={aiLoading}
                    error={aiError || null}
                  />
                )}
            {/* Action Buttons — outside scroll region so mobile can scroll form up/down reliably */}
            <div className="z-20 flex shrink-0 flex-col gap-2 border-t border-slate-200/80 bg-gradient-to-r from-white/95 via-slate-50/95 to-white/95 py-3 pl-5 pr-[max(1.25rem,calc(4.5rem+env(safe-area-inset-right,0px)))] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] shadow-[0_-12px_30px_-22px_rgba(15,23,42,0.38)] backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:pr-[max(1.25rem,calc(5rem+env(safe-area-inset-right,0px)))]">
              {isAiQualityHintsEnabled && (aiQualityHintsLoading || aiQualityHints.length > 0) ? (
                <AiQualityHintsPanel
                  hints={aiQualityHints}
                  loading={aiQualityHintsLoading && submitConfirmModalOpen}
                  className="mx-0 mb-1 sm:col-span-full"
                />
              ) : null}
              {/* Status Badge */}
              <div className="flex min-w-0 flex-wrap items-center gap-2 sm:max-w-[58%]">
                {currentFormStatus && (
                  <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${currentFormStatus === 1 ? "bg-slate-100 text-slate-700" :
                    currentFormStatus === 2 ? "bg-blue-100 text-blue-700" :
                      "bg-green-100 text-green-700"
                    }`}>
                    {currentFormStatus === 1
                      ? "Draft"
                      : currentFormStatus === 2
                      ? "Saved"
                      : canTsiEditSubmittedCrf
                      ? "Submitted"
                      : "Submitted (Locked)"}
                  </div>
                )}
                <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                      Saving changes...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                      {lastSavedAt
                        ? `Last saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                        : currentFormStatus === 3
                        ? canTsiEditSubmittedCrf
                          ? "Submitted. Save to store corrections"
                          : "Submitted and locked"
                        : "Ready to save"}
                    </>
                  )}
                </div>
                {currentFormStatus === 3 && !canTsiEditSubmittedCrf && (
                  <div className="basis-full text-sm text-slate-600 italic">
                    This form has been submitted and is locked for editing.
                  </div>
                )}
                {isPiSignedReadOnly && (
                  <div className="basis-full text-sm text-emerald-800 italic">
                    PI sign-off complete — CRF is read-only.
                  </div>
                )}
                {isDbLockReadOnly && (
                  <div className="basis-full text-sm text-amber-800 italic">
                    Study database lock is active — CRF is read-only.
                  </div>
                )}
                {currentFormStatus !== 3 && !hasAnySavePermission && !canTsiEditSubmittedCrf && !isDbLockReadOnly && (
                  <div className="basis-full text-sm text-slate-600 italic">
                    You do not have permission to save or edit this CRF.
                  </div>
                )}
              </div>

              {/* Action Buttons - TSI submitter on submitted CRF: Save only; else save/submit (draft status may still be used internally) */}
              <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-3 sm:w-auto sm:max-w-[42%]">
                <EcrfSectionStepperFooter
                  dataEntrySectionStepper={dataEntrySectionStepper}
                  onSectionTabChange={handleSectionTabChange}
                />
                {canTsiEditSubmittedCrf && canEditExistingCrf && !isStudyCompletionVisitEntry && (
                  <>
                    <p className="hidden sm:block text-xs text-slate-600 max-w-xs leading-snug">
                      Edit fields as needed, then Save. For query threads, use the field icons (document / status).
                    </p>
                    <button
                      type="button"
                      onClick={() => handleSaveCrfData(2)}
                      disabled={saving}
                      className="px-5 py-2.5 text-sm font-semibold text-blue-700 bg-blue-50/85 border border-blue-200/70 rounded-xl hover:bg-blue-100/90 hover:border-blue-300/70 shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "SAVE"
                      )}
                    </button>
                  </>
                )}
                {isStudyCompletionVisitEntry &&
                  hasAnySavePermission &&
                  !isFormReadOnlyByPermission &&
                  !canTsiEditSubmittedCrf &&
                  currentFormStatus !== 3 &&
                  (canCreateCrf || canEditExistingCrf) &&
                  isLastDataEntrySection && (
                  <button
                    type="button"
                    onClick={() => handleSaveCrfData(3)}
                    disabled={saving}
                    className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r btn-brand-gradient rounded-xl  shadow-md shadow-violet-300/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "SUBMIT & CLOSE"
                    )}
                  </button>
                )}
                {!isStudyCompletionVisitEntry &&
                  !canTsiEditSubmittedCrf &&
                  currentFormStatus !== 3 &&
                  hasAnySavePermission &&
                  !isFormReadOnlyByPermission && (
                  <>
                    {(canCreateCrf || canEditExistingCrf) && (
                      <>
                        <button
                          onClick={() => handleSaveCrfData(2, { keepFormOpen: true })}
                          disabled={saving}
                          className="px-5 py-2.5 text-sm font-semibold text-blue-700 bg-blue-50/85 border border-blue-200/70 rounded-xl hover:bg-blue-100/90 hover:border-blue-300/70 shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {saving ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            "SAVE"
                          )}
                        </button>
                        {isLastDataEntrySection && (
                          <button
                            onClick={() => handleSaveCrfData(3)}
                            disabled={saving}
                            title=""
                            className="px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r btn-brand-gradient rounded-xl  shadow-md shadow-violet-300/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {saving ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Submitting...
                              </>
                            ) : (
                              "SUBMIT & CLOSE"
                            )}
                          </button>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
              </div>
            </div>

            {/* Small popup for manual query raise (CRM) */}
            {canRaiseManualQueries && queryDraft.fieldId && (
              <div className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-950/35 backdrop-blur-[2px] p-4 animate-in fade-in-0 duration-150">
                <div className="w-full max-w-xl rounded-2xl border border-emerald-200/70 bg-white/95 backdrop-blur-xl shadow-[0_28px_80px_-24px_rgba(30,41,59,0.6),inset_0_1px_0_rgba(255,255,255,0.8)] animate-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-emerald-100/80 bg-gradient-to-r from-emerald-50/80 to-teal-50/80 px-4 py-3 rounded-t-2xl">
                    <div>
                      <p className="text-sm font-semibold text-emerald-900">Raise Manual Query</p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Field: <span className="font-semibold text-slate-800">{queryDraft.fieldLabel}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={cancelManualQueryDraft}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/55 bg-white/25 text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_6px_20px_-14px_rgba(15,23,42,0.2)] backdrop-blur-md transition-colors hover:bg-white/40 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/50 focus-visible:ring-offset-1"
                      aria-label="Close"
                      title="Close"
                    >
                      <X className="h-4 w-4" strokeWidth={2.25} />
                    </button>
                  </div>
                  <div className="space-y-3 px-4 py-4">
                    {queryDraft.controlType === "table" && (
                      <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/60 p-3">
                        <p className="text-[11px] font-semibold text-emerald-800">Table target</p>
                        <p className="mt-1 text-xs text-slate-700">
                          Row: <span className="font-semibold">{queryDraft.tableRowLabel || `Row ${queryDraft.tableRowIndex || "—"}`}</span>
                          {" • "}
                          Column: <span className="font-semibold">{queryDraft.tableColumnLabel || (queryDraft.tableColumnIndex !== "" ? `Column ${Number(queryDraft.tableColumnIndex) + 1}` : "—")}</span>
                        </p>
                        <p className="mt-1 text-[11px] text-slate-600">
                          This query is linked to this exact table cell.
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold text-slate-600">Expected value</label>
                        {(() => {
                          const type = String(queryDraft.controlType || "").toLowerCase()
                          const opts = Array.isArray(queryDraft.controlOptions) ? queryDraft.controlOptions : []
                          if ((type === "select" || type === "dropdown") && opts.length > 0) {
                            return (
                              <Select
                                value={queryDraft.expectedCondition || "__query_expected_placeholder__"}
                                onValueChange={(val) =>
                                  setQueryDraft((prev) => ({
                                    ...prev,
                                    expectedCondition: val === "__query_expected_placeholder__" ? "" : val,
                                  }))
                                }
                              >
                                <SelectTrigger className="mt-1 w-full rounded-md border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400">
                                  <SelectValue placeholder="Select expected value" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__query_expected_placeholder__">Select…</SelectItem>
                                  {opts.map((opt, idx) => (
                                    <SelectItem key={`${opt.value}-${idx}`} value={String(opt.value)}>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )
                          }
                          if (type === "radio" && opts.length > 0) {
                            return (
                              <div className="mt-1 flex flex-wrap gap-2 rounded-md border border-slate-300 bg-white px-2 py-2">
                                {opts.map((opt, idx) => {
                                  const val = String(opt.value)
                                  const selected = String(queryDraft.expectedCondition || "") === val
                                  return (
                                    <button
                                      key={`${val}-${idx}`}
                                      type="button"
                                      onClick={() =>
                                        setQueryDraft((prev) => ({ ...prev, expectedCondition: val }))
                                      }
                                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                                        selected
                                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                          : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:text-emerald-700"
                                      }`}
                                    >
                                      {opt.label}
                                    </button>
                                  )
                                })}
                              </div>
                            )
                          }
                          if (type === "checkbox" && opts.length > 0) {
                            const selected = new Set(
                              String(queryDraft.expectedCondition || "")
                                .split(",")
                                .map((x) => x.trim())
                                .filter(Boolean),
                            )
                            return (
                              <div className="mt-1 grid grid-cols-1 gap-1.5 rounded-md border border-slate-300 bg-white px-2 py-2">
                                {opts.map((opt, idx) => {
                                  const val = String(opt.value)
                                  const checked = selected.has(val)
                                  return (
                                    <label key={`${val}-${idx}`} className="inline-flex items-center gap-2 text-xs text-slate-700">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(e) => {
                                          const next = new Set(selected)
                                          if (e.target.checked) next.add(val)
                                          else next.delete(val)
                                          setQueryDraft((prev) => ({
                                            ...prev,
                                            expectedCondition: Array.from(next).join(", "),
                                          }))
                                        }}
                                      />
                                      <span>{opt.label}</span>
                                    </label>
                                  )
                                })}
                              </div>
                            )
                          }
                          if (type === "date") {
                            return (
                              <input
                                type="date"
                                value={queryDraft.expectedCondition}
                                onChange={(e) =>
                                  setQueryDraft((prev) => ({ ...prev, expectedCondition: e.target.value }))
                                }
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
                              />
                            )
                          }
                          if (type === "datetime") {
                            return (
                              <input
                                type="datetime-local"
                                value={queryDraft.expectedCondition}
                                onChange={(e) =>
                                  setQueryDraft((prev) => ({ ...prev, expectedCondition: e.target.value }))
                                }
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
                              />
                            )
                          }
                          if (type === "time") {
                            return (
                              <input
                                type="time"
                                value={queryDraft.expectedCondition}
                                onChange={(e) =>
                                  setQueryDraft((prev) => ({ ...prev, expectedCondition: e.target.value }))
                                }
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
                              />
                            )
                          }
                          if (type === "number") {
                            return (
                              <input
                                type="number"
                                value={queryDraft.expectedCondition}
                                onChange={(e) =>
                                  setQueryDraft((prev) => ({ ...prev, expectedCondition: e.target.value }))
                                }
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
                                placeholder="Enter expected numeric value"
                              />
                            )
                          }
                          if (type === "textarea") {
                            return (
                              <textarea
                                rows={2}
                                value={queryDraft.expectedCondition}
                                onChange={(e) =>
                                  setQueryDraft((prev) => ({ ...prev, expectedCondition: e.target.value }))
                                }
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 resize-none"
                                placeholder="Enter expected value"
                              />
                            )
                          }
                          return (
                            <input
                              value={queryDraft.expectedCondition}
                              onChange={(e) =>
                                setQueryDraft((prev) => ({ ...prev, expectedCondition: e.target.value }))
                              }
                              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400"
                              placeholder="Enter expected value"
                            />
                          )
                        })()}
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600">Actual value</label>
                        <input
                          value={queryDraft.actualValue}
                          readOnly
                          className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none"
                          placeholder="Auto-captured from CRF"
                        />
                        <p className="mt-1 text-[11px] text-slate-500">
                          Auto-captured from the current CRF control to avoid typo mismatch.
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600">
                        Query details <span className="font-normal text-slate-400">(optional, local note)</span>
                      </label>
                      <textarea
                        rows={2}
                        value={queryDraft.queryText}
                        onChange={(e) =>
                          setQueryDraft((prev) => ({ ...prev, queryText: e.target.value }))
                        }
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 resize-none"
                        placeholder="Optional local note. Not sent in QueryText — only Expected and Actual are sent."
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600">Reviewer comment</label>
                      <textarea
                        rows={2}
                        value={queryDraft.reviewerComment}
                        onChange={(e) =>
                          setQueryDraft((prev) => ({ ...prev, reviewerComment: e.target.value }))
                        }
                        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 resize-none"
                        placeholder="Comment for submitter on how to fix."
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-3">
                    <button
                      type="button"
                      onClick={cancelManualQueryDraft}
                      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={createManualFieldQuery}
                      className="rounded-md bg-gradient-to-r from-violet-600 to-purple-500 px-3 py-2 text-xs font-semibold text-white hover:from-violet-700 hover:to-purple-600 shadow-sm"
                    >
                      Raise Query
                    </button>
                  </div>
                </div>
              </div>
            )}

            <EcrfQueryReviewPanels
              canWorkOnQueries={canWorkOnQueries}
              canRespondToQueries={canRespondToQueries}
              canCloseQueriesByMatrix={canCloseQueriesByMatrix}
              canCreateQuery={studyPermGates.canCreateQuery}
              canViewMaskedData={studyPermGates.canViewMaskedData}
              manualQueryReview={manualQueryReview}
              setManualQueryReview={setManualQueryReview}
              manualQueryActualErrors={manualQueryActualErrors}
              manualReviewerCommentDraft={manualReviewerCommentDraft}
              setManualReviewerCommentDraft={setManualReviewerCommentDraft}
              manualSubmittedCommentDraft={manualSubmittedCommentDraft}
              setManualSubmittedCommentDraft={setManualSubmittedCommentDraft}
              saveManualQueryComment={saveManualQueryComment}
              closeManualQueryFromReviewer={closeManualQueryFromReviewer}
              crmSystemQueryReview={crmSystemQueryReview}
              setCrmSystemQueryReview={setCrmSystemQueryReview}
              systemQueryActualErrors={systemQueryActualErrors}
              systemQueryCommentDraft={systemQueryCommentDraft}
              setSystemQueryCommentDraft={setSystemQueryCommentDraft}
              systemQuerySubmitterCommentDraft={systemQuerySubmitterCommentDraft}
              setSystemQuerySubmitterCommentDraft={setSystemQuerySubmitterCommentDraft}
              saveSystemQueryComment={saveSystemQueryComment}
              closeSystemQueryFromReviewer={closeSystemQueryFromReviewer}
              loggedInUserId={loggedInUserId}
              selectedForm={selectedForm}
              formData={formData}
              optimisticControlValues={optimisticControlValues}
              queryModalSaving={queryModalSaving}
              getPersistedActualValueForQueryField={getPersistedActualValueForQueryField}
            />
          </div>,
          document.body,
        )}
      </div>

      <AiFillChoiceModal
        open={showAIFillModal}
        onClose={() => {
          if (aiReviewMode) void handleAiReviewReject()
          else setShowAIFillModal(false)
        }}
        onStartSpeaking={handleStartSpeakingFromModal}
        aiLoading={aiLoading}
        uploadDragActive={uploadDragActive}
        onUploadDrop={handleUploadDrop}
        onUploadDragOver={handleUploadDragOver}
        onUploadDragLeave={handleUploadDragLeave}
        onUploadChange={handleUploadFill}
        fileInputRef={aiFileInputRef}
        acceptUpload={ACCEPT_UPLOAD}
        maxUploadMb={MAX_UPLOAD_MB}
        reviewMode={aiReviewMode}
        suggestions={aiReviewSuggestions}
        sourceSnippet={aiReviewSourceSnippet}
        onAcceptAll={(rows) => void applyAiReviewSelection(rows, true)}
        onAcceptSelected={(rows) => void applyAiReviewSelection(rows, false)}
        onRejectReview={() => void handleAiReviewReject()}
      />

      {/* Recording panel - corner floating so user can read CRF while speaking */}
      {showRecordingModal && (
        <div className="fixed bottom-6 right-6 z-[105] flex flex-col items-end gap-0 pointer-events-none">
          <div className="pointer-events-auto bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden relative text-white border border-slate-700/80">
            <button
              type="button"
              onClick={handleRecordingClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors z-10"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6 pt-10">
              <h3 className="text-lg font-semibold text-center text-white mb-6">
                Speak the details you want to fill in the form
              </h3>

              <div className="flex items-center justify-center gap-6 mb-6">
                <span className="text-2xl font-mono tabular-nums text-white">
                  {Math.floor(recordingElapsed / 60)}:{(recordingElapsed % 60).toString().padStart(2, "0")}
                </span>
                <div className="flex items-center gap-1 h-8 items-end">
                  {[6, 12, 8, 14, 10, 16, 8, 14, 10, 12, 8, 10].map((h, i) => (
                    <div
                      key={i}
                      className="w-1 bg-white rounded-full animate-pulse"
                      style={{
                        height: `${h * 2}px`,
                        animationDelay: `${i * 80}ms`,
                        animationDuration: "600ms",
                      }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={isPaused ? handleRecordingResume : handleRecordingPause}
                    className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
                    aria-label={isPaused ? "Resume" : "Pause"}
                  >
                    {isPaused ? (
                      <Play className="w-5 h-5 text-white" fill="currentColor" />
                    ) : (
                      <Pause className="w-5 h-5 text-white" fill="currentColor" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleRecordingSend}
                    className="w-12 h-12 rounded-full bg-white hover:bg-slate-100 flex items-center justify-center transition-colors text-slate-800"
                    aria-label="Send"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <p className="text-center text-sm text-white/80">
                {isPaused ? "Paused" : "Listening..."}
              </p>
            </div>
          </div>
        </div>
      )}

      <AiProcessingOverlay open={aiLoading} mode={aiProcessingMode} />

      <CrfSaveSuccessPopup
        open={saveSuccessPopup.open}
        title={saveSuccessPopup.title}
        description={saveSuccessPopup.description}
        onClose={closeSaveSuccessPopup}
      />

      <EcrfModalGroup
        submitConfirmModalOpen={submitConfirmModalOpen}
        onSubmitConfirmCancel={handleSubmitConfirmCancel}
        onSubmitConfirmSaveDraft={handleSubmitConfirmSaveDraft}
        onSubmitConfirmContinue={handleSubmitConfirmContinue}
        showScreeningFailedModal={showScreeningFailedModal}
        screeningFailedSubmitting={screeningFailedSubmitting}
        onScreeningFailedCancel={handleScreeningFailedCancel}
        onScreeningFailedConfirm={handleScreeningFailedConfirm}
        showRandomizedEnrolledModal={showRandomizedEnrolledModal}
        onRandomizedNo={handleRandomizedNo}
        onRandomizedYes={handleRandomizedYes}
        pendingDeleteAttachment={pendingDeleteAttachment}
        deletingVisitAttachmentId={deletingVisitAttachmentId}
        onDeleteAttachmentCancel={handleDeleteAttachmentCancel}
        onDeleteAttachmentConfirm={confirmDeleteVisitAttachment}
        errorModal={errorModal}
        onErrorModalClose={handleErrorModalClose}
      />

      <AuditReasonModal
        visible={auditReasonModalVisible}
        modalState={auditReasonModal}
        reasonText={auditChangeReason}
        onReasonChange={setAuditChangeReason}
        onClose={closeAuditReasonModal}
        onConfirm={() => void confirmAuditReasonAndContinueSave()}
        saving={savingAuditReason}
        formatFieldLabel={formatAuditFieldLabel}
      />

      <PiSignoffPasswordDialog
        open={allVisitsPiDialog.open}
        onOpenChange={(open) => {
          if (!open && !allVisitsPiSaving) {
            setAllVisitsPiDialog({ open: false, patient: null, entries: [] })
          }
        }}
        mode="bulkApply"
        title="Confirm bulk PI sign-off"
        description={`Re-authenticate to apply PI sign-off for ${
          Array.isArray(allVisitsPiDialog.entries) ? allVisitsPiDialog.entries.length : 0
        } ready CRF(s) for ${allVisitsPiDialog.patient?.patientId || "this patient"}.`}
        confirmLabel="Sign all ready"
        showComment
        loading={allVisitsPiSaving}
        onConfirm={async (password, _reason, comment) => {
          const ok = await confirmAllVisitsPi(password, comment)
          if (ok) setAllVisitsPiDialog({ open: false, patient: null, entries: [] })
        }}
      />

      <PiSignoffPasswordDialog
        open={piFieldPasswordDialog.open}
        onOpenChange={(open) => {
          if (!open) setPiFieldPasswordDialog({ open: false, sectionIds: [], mode: "apply" })
        }}
        mode={piFieldPasswordDialog.mode === "revoke" ? "fieldRevoke" : "field"}
        title={
          piFieldPasswordDialog.mode === "revoke"
            ? "Confirm field PI revoke"
            : "Confirm field PI sign-off"
        }
        confirmLabel={piFieldPasswordDialog.mode === "revoke" ? "Revoke fields" : "Sign fields"}
        requireReason={piFieldPasswordDialog.mode === "revoke"}
        reasonLabel="Reason for field revoke"
        loading={piFieldSignoffSaving}
        onConfirm={async (password, reason) => {
          const ok =
            piFieldPasswordDialog.mode === "revoke"
              ? await handleRevokePiFieldSignoffs(
                  piFieldPasswordDialog.sectionIds,
                  password,
                  reason,
                )
              : await handleApplyPiFieldSignoffs(piFieldPasswordDialog.sectionIds, password)
          if (ok) setPiFieldPasswordDialog({ open: false, sectionIds: [], mode: "apply" })
        }}
      />

      <StudyAssistantPanel
        studyId={studyId ? Number(studyId) : null}
        patientEnrolmentId={selectedPatient?.id ?? selectedPatient?.patientEnrolmentId}
        visitScheduleId={selectedVisit?.id ?? selectedVisit?.visitScheduleId}
        crfDataId={selectedForm?.crfDataId}
        enabled={isAiInsightEnabled && Boolean(selectedForm)}
      />

    </DashboardLayout>
  )
}
