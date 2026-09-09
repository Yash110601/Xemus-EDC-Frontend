import { getActiveApiBaseUrl, resolveBackendUrl } from "./deployEnv.js"

/**
 * API Configuration Module – single source for backend URL and API settings.
 * This frontend connects to a separate .NET Core 8 backend API.
 *
 * Local dev: copy .env.example → .env.local (always local backend / EdcLocal).
 * Do not configure UAT API or UAT database credentials in this repo.
 */
export {
  API_BACKEND_URLS,
  getActiveApiBaseUrl,
  getDeployTarget,
  resolveBackendUrl,
  resolveBrowserApiBaseUrl,
  shouldUseDevApiProxy,
} from "./deployEnv.js"

export const RESOLVED_BACKEND_URL = resolveBackendUrl()
export const CURRENT_BACKEND_URL = resolveBackendUrl()

export const API_CONFIG = {
  BASE_URL: RESOLVED_BACKEND_URL,

  // API Version (for future versioning support)
  VERSION: process.env.NEXT_PUBLIC_API_VERSION || "v1",

  // Request timeout in milliseconds
  TIMEOUT: parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || "30000", 10),

  // Maximum number of retry attempts
  MAX_RETRIES: parseInt(process.env.NEXT_PUBLIC_API_MAX_RETRIES || "3", 10),

  // Retry delay in milliseconds
  RETRY_DELAY: parseInt(process.env.NEXT_PUBLIC_API_RETRY_DELAY || "1000", 10),

  // Enable/disable request logging
  ENABLE_LOGGING: process.env.NEXT_PUBLIC_API_LOGGING === "true" || false,

  // Content type for requests
  CONTENT_TYPE: "application/json",

  // NER / form-schema (Tatva Evalus - EvalusResponseApiUrl / EvalusFormSchemaApiUrl)
  NER_API_BASE_URL:
    process.env.NEXT_PUBLIC_NER_API_URL || "https://pm-tatva-agents-uat.tatvacare.in/api/v1/evalus",
  // Document OCR form fill (EvalusOCRFormFill) - separate endpoint from NER
  OCR_FORM_FILL_URL:
    process.env.NEXT_PUBLIC_OCR_FORM_FILL_URL || "https://pm-rx-digitization-gpt-uat.tatvacare.in/ocr_form_fill_gemini",
  // Tatva x-api-key — set in .env.local (dev) or Docker build-arg (UAT/PROD)
  NER_API_KEY: process.env.NEXT_PUBLIC_NER_API_KEY || "",
  NER_VOICE_TRANSCRIPTION_MODEL:
    process.env.NEXT_PUBLIC_NER_VOICE_TRANSCRIPTION_MODEL || "azure_openai",
  NER_VOICE_INFERENCE_MODEL:
    process.env.NEXT_PUBLIC_NER_VOICE_INFERENCE_MODEL || "azure_openai",
  // Google Gemini — document upload OCR (set via env; never hardcode in Git)
  GEMINI_API_KEY: process.env.NEXT_PUBLIC_GEMINI_API_KEY || "",
  GEMINI_OCR_MODEL: process.env.NEXT_PUBLIC_GEMINI_OCR_MODEL || "gemini-3.1-flash-lite",
  GEMINI_API_BASE:
    process.env.NEXT_PUBLIC_GEMINI_API_BASE || "https://generativelanguage.googleapis.com/v1beta",

  // Endpoints configuration
  ENDPOINTS: {
    SYSTEM: {
      TIME_CONTEXT: "/system/time-context",
    },
    AUTH: {
      // Use the .NET Core auth routes (as exposed in Swagger: /api/Auth/...)
      BASE: "/Auth",
      LOGIN: "/Auth/login",
      REGISTER: "/Auth/register",
      LOGOUT: "/Auth/logout",
      REFRESH_TOKEN: "/Auth/refresh",
      FORGOT_PASSWORD: "/Auth/forgot-password",
      RESET_PASSWORD: "/Auth/reset-password",
      SEND_OTP: "/Auth/send-otp",
      LOGIN_WITH_OTP: "/Auth/login-with-otp",
      RESET_PASSWORD_WITH_OTP: "/Auth/reset-password-with-otp",
      CHANGE_PASSWORD: "/Auth/change-password",
    },
    ROLES: {
      BASE: "/Roles",
      ROLESLIST: "/Roles/GetRolesList",
      Roles: "/Roles/GetRolesForDropdown",
      CREATE: "/Roles/CreateRole",
    },
    USER: {
      BASE: "/Users/GetUsersList",
      CREATE: "/Users/CreateUser",
      PROFILE: "/Users/profile",
      CHANGE_PASSWORD: "/Users/change-password",
      EDITBY_ID: (id) => `/Users/GetUserById/${id}`,
      UPDATE: (id) => `/Users/UpdateUser/${id}`,
      DELETEBY_ID: (id) => `/Users/DeleteUser/${id}`,
      UPDATE_STATUS: (id, isActive) => `/Users/UpdateUserStatus/${id}?isActive=${isActive}`,
      RESET_PASSWORD: (id) => `/Users/ResetPassword/${id}`,
      RESET_USER_PASSWORD: "/Users/ResetUserPassword",
      ASSIGN_TO_STUDY: (id) => `/Users/AssignToStudy/${id}`,
    },
    CLINICAL_TRIALS: {
      BASE: "/clinical-trials",
      BY_ID: (id) => `/clinical-trials/${id}`,
      SEARCH: "/clinical-trials/search",
    },
    DATA_CAPTURE: {
      BASE: "/data-capture",
      BY_ID: (id) => `/data-capture/${id}`,
      VALIDATE: (id) => `/data-capture/${id}/validate`,
    },
    AUDIT: {
      BASE: "/audit",
      BY_ID: (id) => `/audit/${id}`,
      BY_ENTITY: (type, id) => `/audit/${type}/${id}`,
    },
    COMPLIANCE: {
      BASE: "/compliance",
      STATUS: (id) => `/compliance/status/${id}`,
      GENERATE: "/compliance/generate",
    },
    DASHBOARD: {
      BASE: "/Dashboard",
      GET_DASHBOARD: (studyId, siteId = null) => {
        const params = new URLSearchParams()
        if (studyId) params.set("studyId", String(studyId))
        if (siteId) params.set("siteId", String(siteId))
        const query = params.toString()
        return query ? `/Dashboard?${query}` : "/Dashboard"
      },
      MULTI_CRF_ROLE_PROGRESS: "/Dashboard/multi-crf-role-progress",
    },
    PROFILE: {
      BASE: "/Profile",
      UPDATE_PROFILE: "/Profile/UpdateProfile",
    },
    NOTIFICATIONS: {
      BASE: "/notifications",
      BY_ID: (id) => `/notifications/${id}`,
      MARK_READ: (id) => `/notifications/${id}/read`,
      MARK_ALL_READ: "/notifications/read-all",
    },
    STUDIES: {
      BASE: "/Studies",
      CREATE: "/Studies/CreateStudy",
      GET_LIST: "/Studies/GetStudiesList",
      GET_ACCESSIBLE_WITH_SITES: "/Studies/GetAccessibleStudiesWithSites",
      GET_ACCESSIBLE_WITH_SITES_AND_ASSIGNMENTS: "/Studies/GetAccessibleStudiesWithSitesAndAssignments",
      GET_DROPDOWN: "/Studies/GetStudiesForDropdown",
      GET_SETTINGS: (studyId) => `/Studies/${studyId}/settings`,
      PATIENT_STATUS: (studyId, patientEnrolmentId) =>
        `/Studies/${studyId}/patients/${patientEnrolmentId}/status`,
      BY_ID: (id) => `/Studies/GetStudyById/${id}`,
      UPDATE: (id) => `/Studies/UpdateStudy/${id}`,
      UPDATE_STATUS: (id) => `/Studies/UpdateStudyStatus/${id}`,
      DELETE: (id) => `/Studies/DeleteStudy/${id}`,
      VIEW_DOCUMENT: "/Studies/Documents/ViewByUrl",
      /** GET /api/Studies/DownloadDocument/{studyId}/{documentType} — documentType: 1 = ECLetter, 2 = Protocol */
      DOWNLOAD_DOCUMENT: (studyId, documentType) => `/Studies/DownloadDocument/${studyId}/${documentType}`,
      DOCUMENT_RESOURCES: (studyId) => `/Studies/${studyId}/document-resources`,
      DOWNLOAD_ACCESSIBLE_DOCUMENT: (studyId, documentId) =>
        `/Studies/DownloadAccessibleDocument/${studyId}/${documentId}`,
    },
    STUDY_DOCUMENTS: {
      GET_CUSTOM: (studyId) => `/StudyDocuments/GetCustomDocumentsByStudyId/${studyId}`,
      UPLOAD: "/StudyDocuments/UploadDocument",
      DELETE: (id) => `/StudyDocuments/DeleteDocument/${id}`,
    },
    CRF_STUDIO: {
      GET_PROJECTS: (studyId) => `/CrfStudio/GetProjectsByStudyId/${studyId}`,
      GET_PROJECT: (projectId, studyId) => `/CrfStudio/GetProject/${projectId}?studyId=${studyId}`,
      CREATE_PROJECT: "/CrfStudio/CreateProject",
      UPLOAD_PROTOCOL: (projectId) => `/CrfStudio/UploadProtocol/${projectId}`,
      DOWNLOAD_PROTOCOL: (projectId, studyId) =>
        `/CrfStudio/DownloadProtocol/${projectId}?studyId=${studyId}`,
      START_EXTRACTION: (projectId, studyId) => `/CrfStudio/StartExtraction/${projectId}?studyId=${studyId}`,
      SAVE_DRAFT: (projectId) => `/CrfStudio/SaveDraft/${projectId}`,
      UPLOAD_CRF_PDF: (projectId) => `/CrfStudio/UploadCrfPdf/${projectId}`,
      DOWNLOAD_CRF_PDF: (projectId, studyId) => `/CrfStudio/DownloadCrfPdf/${projectId}?studyId=${studyId}`,
      RECORD_IMPORT: (projectId) => `/CrfStudio/RecordImport/${projectId}`,
    },
    /** Study payment rules — Phase 1 config CRUD + templates */
    PAYMENT_RULES: {
      CATALOG: "/PaymentRules/Catalog",
      LIST: (studyId, includeInactive = false) => {
        const params = new URLSearchParams()
        if (includeInactive) params.set("includeInactive", "true")
        const qs = params.toString()
        return `/Studies/${studyId}/PaymentRules${qs ? `?${qs}` : ""}`
      },
      BY_ID: (studyId, ruleId) => `/Studies/${studyId}/PaymentRules/${ruleId}`,
      CREATE: (studyId) => `/Studies/${studyId}/PaymentRules`,
      UPDATE: (studyId, ruleId) => `/Studies/${studyId}/PaymentRules/${ruleId}`,
      DELETE: (studyId, ruleId) => `/Studies/${studyId}/PaymentRules/${ruleId}`,
      APPLY_TEMPLATE: (studyId) => `/Studies/${studyId}/PaymentRules/ApplyTemplate`,
      PROGRESS: (studyId, siteId) => {
        const params = new URLSearchParams()
        if (siteId != null && siteId !== "") params.set("siteId", String(siteId))
        const qs = params.toString()
        return `/Studies/${studyId}/PaymentRules/Progress${qs ? `?${qs}` : ""}`
      },
      RECALCULATE: (studyId, siteId) => {
        const params = new URLSearchParams()
        if (siteId != null && siteId !== "") params.set("siteId", String(siteId))
        const qs = params.toString()
        return `/Studies/${studyId}/PaymentRules/Recalculate${qs ? `?${qs}` : ""}`
      },
      OVERRIDE: (studyId, progressId) =>
        `/Studies/${studyId}/PaymentRules/Progress/${progressId}/Override`,
      MIGRATE_LEGACY: (studyId) => `/Studies/${studyId}/PaymentRules/MigrateLegacy`,
    },
    STUDY_SETTINGS: {
      GET_BY_STUDY: (studyId) => `/StudySettings/GetStudySettingsByStudyId/${studyId}`,
      CREATE: "/StudySettings/CreateStudySettings",
      UPDATE: (studyId) => `/StudySettings/UpdateStudySettings/${studyId}`,
    },
    EMAIL_TEMPLATES: {
      DEFAULT_CONTENT: "/EmailTemplates/DefaultContent",
      BY_STUDY: (studyId) => `/EmailTemplates/ByStudy/${studyId}`,
      BY_ID: (id) => `/EmailTemplates/${id}`,
      CREATE: "/EmailTemplates",
      UPDATE: (id) => `/EmailTemplates/${id}`,
      DELETE: (id) => `/EmailTemplates/${id}`,
      PREVIEW: "/EmailTemplates/Preview",
      HISTORY_BY_STUDY: (studyId, pageNumber = 1, pageSize = 10) => {
        const params = new URLSearchParams({
          pageNumber: String(pageNumber),
          pageSize: String(pageSize),
        })
        return `/EmailTemplates/History/ByStudy/${studyId}?${params.toString()}`
      },
    },
    DAILY_STUDY_UPDATE: {
      SEND: (studyId, force = true) => {
        const params = new URLSearchParams()
        if (studyId != null && studyId !== "") params.set("studyId", String(studyId))
        if (force) params.set("force", "true")
        const qs = params.toString()
        return `/DailyStudyUpdate/Send${qs ? `?${qs}` : ""}`
      },
    },
    /** §4 role matrix — preview + runtime effective permissions. */
    STUDY_PERMISSIONS: {
      GET_CATALOG: "/StudyPermissions/GetPermissionCatalog",
      GET_NAV_MODULE_CATALOG: "/StudyPermissions/GetNavModuleCatalog",
      GET_MATRIX: (studyId) => `/StudyPermissions/GetRolePermissionMatrix/${studyId}`,
      SAVE_MATRIX: (studyId) => `/StudyPermissions/SaveRolePermissionMatrix/${studyId}`,
      GET_EFFECTIVE: (studyId, siteId) => {
        const params = new URLSearchParams({ studyId: String(studyId) })
        if (siteId != null && siteId !== "") params.set("siteId", String(siteId))
        return `/StudyPermissions/GetEffectivePermissions?${params.toString()}`
      },
    },
    /** PI sign-off — forward-compatible; falls back when API not deployed. */
    PI_SIGNOFF: {
      GET_PENDING: (studyId) => `/PiSignoff/GetPending/${studyId}`,
      GET_BY_CRF_DATA: (crfDataId) => `/PiSignoff/GetByCrfDataId/${crfDataId}`,
      APPLY: "/PiSignoff/Apply",
      APPLY_BULK: "/PiSignoff/ApplyBulk",
      REVOKE: "/PiSignoff/Revoke",
      APPLY_FIELD_SIGNOFFS: "/PiSignoff/ApplyFieldSignoffs",
      REVOKE_FIELD_SIGNOFFS: "/PiSignoff/RevokeFieldSignoffs",
    },
    /** Remote SDV review — visit document vs eCRF split workspace. Feature: RSDV_REVIEW */
    RSDV_REVIEW: {
      GET_SUMMARY: (studyId) => `/RsdvReview/GetSummary/${studyId}`,
      GET_QUEUE: (studyId, options = {}) => {
        const status = options.status ?? options.Status
        const siteId = options.siteId ?? options.SiteId
        const patientEnrolmentId = options.patientEnrolmentId ?? options.PatientEnrolmentId
        const search = options.search ?? options.Search
        const params = new URLSearchParams()
        if (status) params.set("status", String(status))
        if (siteId != null && siteId !== "") params.set("siteId", String(siteId))
        if (patientEnrolmentId != null && patientEnrolmentId !== "") {
          params.set("patientEnrolmentId", String(patientEnrolmentId))
        }
        if (search) params.set("search", String(search))
        const qs = params.toString()
        return qs ? `/RsdvReview/GetQueue/${studyId}?${qs}` : `/RsdvReview/GetQueue/${studyId}`
      },
      GET_CONTEXT: (attachmentId) => `/RsdvReview/GetContext/${attachmentId}`,
      START: "/RsdvReview/StartReview",
      SAVE_ANNOTATION: "/RsdvReview/SaveAnnotation",
      UPDATE_FIELD_ANNOTATION: "/RsdvReview/UpdateFieldAnnotation",
      DELETE_FIELD_ANNOTATION: (annotationId) => `/RsdvReview/DeleteFieldAnnotation/${annotationId}`,
      SAVE_DOCUMENT_ANNOTATION: "/RsdvReview/SaveDocumentAnnotation",
      UPDATE_DOCUMENT_ANNOTATION: "/RsdvReview/UpdateDocumentAnnotation",
      DELETE_DOCUMENT_ANNOTATION: (annotationId) => `/RsdvReview/DeleteDocumentAnnotation/${annotationId}`,
      COMPLETE: "/RsdvReview/CompleteReview",
      REOPEN: "/RsdvReview/ReopenReview",
      GET_AUDIT_LOG: "/RsdvReview/GetAuditLog",
      EXPORT_AUDIT_LOG: "/RsdvReview/ExportAuditLog",
      STREAM: (attachmentId) => `/RsdvReview/${attachmentId}/stream`,
    },
    /** Database lock — study / site / CRF cascade + granular section/field targets. */
    DB_LOCK: {
      GET_STATUS: (studyId, options = {}) => {
        const params = new URLSearchParams()
        const siteId = options.siteId ?? options.SiteId
        const crfDataId = options.crfDataId ?? options.CrfDataId
        if (siteId != null && siteId !== "") params.set("siteId", String(siteId))
        if (crfDataId != null && crfDataId !== "") params.set("crfDataId", String(crfDataId))
        const qs = params.toString()
        return qs
          ? `/DatabaseLock/GetStatus/${studyId}?${qs}`
          : `/DatabaseLock/GetStatus/${studyId}`
      },
      GET_CRF_STRUCTURE: (studyId, crfDataId) =>
        `/DatabaseLock/GetCrfStructure/${studyId}/${crfDataId}`,
      GET_LOCKS_LIST: (studyId, options = {}) => {
        const params = new URLSearchParams()
        const siteId = options.siteId ?? options.SiteId
        const level = options.level ?? options.Level
        const pageNumber = options.pageNumber ?? options.PageNumber ?? 1
        const pageSize = options.pageSize ?? options.PageSize ?? 20
        if (siteId != null && siteId !== "") params.set("siteId", String(siteId))
        if (level != null && level !== "" && level !== "all") params.set("level", String(level))
        params.set("pageNumber", String(pageNumber))
        params.set("pageSize", String(Math.min(Number(pageSize) || 20, 100)))
        return `/DatabaseLock/GetLocksList/${studyId}?${params.toString()}`
      },
      APPLY: "/DatabaseLock/Apply",
      RELEASE: "/DatabaseLock/Release",
    },
    SITES: {
      BASE: "/Sites",
      CREATE: "/Sites/CreateSite",
      GET_LIST: "/Sites/GetSitesList",
      BY_ID: (id) => `/Sites/GetSiteById/${id}`,
      UPDATE: (id) => `/Sites/UpdateSite/${id}`,
      BY_STUDY: (studyId) => `/Sites/GetSitesByStudy/${studyId}`,
      UPDATE_STATUS: (id, isActive) => `/Sites/UpdateSiteStatus/${id}?isActive=${isActive}`,
      DOWNLOAD_SAMPLE_CSV: "/Sites/DownloadSiteSampleCsv",
      IMPORT: "/Sites/ImportSites",
      EXPORT: "/Sites/Export",
      BULK_CREATE_SYSTEM_SITES: "/Sites/BulkCreateSystemSites",
    },
    STUDY_USERS: {
      BASE: "/StudyUsers",
      CREATE: "/StudyUsers/CreateStudyUser",
      UPDATE: (id) => `/StudyUsers/UpdateStudyUser/${id}`,
      BY_ID: (id) => `/StudyUsers/GetStudyUserById/${id}`,
      BY_STUDY: (studyId) => `/StudyUsers/GetStudyUsersByStudy/${studyId}`,
      BY_SITE: (siteId) => `/StudyUsers/GetStudyUsersBySite/${siteId}`,
      GET_PAGED: "/StudyUsers/GetPagedStudyUsers",
      UPDATE_STATUS: (id) => `/StudyUsers/UpdateStudyUserStatus/${id}`,
      IMPORT: "/StudyUsers/ImportStudyUsers",
      DOWNLOAD_TEMPLATE: "/StudyUsers/DownloadStudyUserSampleCsv",
      ASSIGN_STUDY_AND_SITES: "/StudyUsers/AssignStudyAndSites",
      GET_USER_STUDY_SITE_ASSIGNMENTS: (userId) =>
        `/StudyUsers/GetUserStudySiteAssignments/${userId}`,
      GET_ASSIGNED_SITES_WITH_USERS_FOR_STUDY: "/StudyUsers/GetAssignedSitesWithUsersForStudy",
    },
    STUDY_FINANCE_STATUS: {
      BASE: "/StudyFinanceStatus",
      SUMMARY: "/StudyFinanceStatus/StudyFinanceStatuscount",
      LIST: "/StudyFinanceStatus/StudyFinanceStatuslist",
      EXPORT: "/StudyFinanceStatus/Export",
      EXPORT_ZIP: "/StudyFinanceStatus/ExportAgreementsZip",
    },
    STUDY_PAYMENTS: {
      BASE: "/StudyPayments",
      PAYMENT_DETAILS: "/StudyPayments/PaymentDetails",
      EXPORT_PAYMENT_TEMPLATE: "/StudyPayments/ExportPaymentTemplate",
      IMPORT_PAYMENT_DETAILS: "/StudyPayments/ImportPaymentDetails",
    },
    CRF: {
      BASE: "/crf",
      LIST: "/crf/list",
      GET: (id) => `/crf/${id}`,
      SAVE: "/crf/save",
      SUBMIT: (id) => `/crf/submit/${id}`,
      DELETE: (id) => `/crf/${id}`,
    },
    CRF_DATA: {
      BASE: "/CrfData",
      GET_LIST: "/CrfData/GetCrfDataList",
      GET_BY_ID: (id) => `/CrfData/GetById/${id}`,
      GET_PATIENT_AND_VISIT_DATA: "/CrfData/GetPatientAndVisitDataForCrfDataEntry",
      GET_CRF_PROGRESS: (crfDataId, studyId) =>
        `/CrfData/GetCrfProgress/${crfDataId}?studyId=${studyId}`,
      GET_PATIENT_VISIT_PRIMARY_VISIT_DATES: "/CrfData/GetPatientVisitPrimaryVisitDates",
      CREATE: "/CrfData/Create",
      UPDATE: (id) => `/CrfData/Update/${id}`,
      UPDATE_STATUS: (id) => `/CrfData/UpdateCrfDataStatus/${id}`,
      EXPORT: "/CrfData/Export",
    },
    CRF_DESIGNS: {
      BASE: "/CrfDesigns",
      GET_LIST: "/CrfDesigns/GetCrfDesignsList",
      GET_BY_ID: (id) => `/CrfDesigns/GetCrfDesignById/${id}`,
      CREATE: "/CrfDesigns/CreateCrfDesign",
      UPDATE: (id) => `/CrfDesigns/UpdateCrfDesign/${id}`,
      UPDATE_STATUS: (id) => `/CrfDesigns/UpdateCrfDesignStatus/${id}`,
      GET_BY_STUDY_ID: (studyId) => `/CrfDesigns/GetCrfDesignsByStudyId/${studyId}`,
      EXPORT: "/CrfDesigns/Export",
      EXPORT_BUNDLE: (id) => `/CrfDesigns/ExportBundle/${id}`,
      IMPORT_BUNDLE: "/CrfDesigns/ImportBundle",
      DELETE: (id) => `/CrfDesigns/DeleteCrfDesign/${id}`,
      DELETE_ELIGIBILITY: (id) => `/CrfDesigns/GetCrfDesignDeleteEligibility/${id}`,
    },
    CRF_RULES: {
      BASE: "/CrfRules",
      GET_LIST: "/CrfRules/GetCrfRulesList",
      GET_BY_ID: (id) => `/CrfRules/GetCrfRuleById/${id}`,
      CREATE: "/CrfRules/CreateCrfRule",
      UPDATE: (id) => `/CrfRules/UpdateCrfRule/${id}`,
      UPDATE_STATUS: (id) => `/CrfRules/UpdateCrfRuleStatus/${id}`,
      GET_BY_CRF_ID: (crfId) => `/CrfRules/GetCrfRulesByCrfId/${crfId}`,
      GET_BY_STUDY_ID: (studyId) => `/CrfRules/GetCrfRulesByStudyId/${studyId}`,
      DELETE: (id) => `/CrfRules/DeleteCrfRule/${id}`,
      EXPORT: "/CrfRules/Export",
    },
    CRF_QUERY_MANAGEMENT: {
      BASE: "/CrfQueryManagement",
      CREATE_SYSTEM_GENERATED_QUERY: "/CrfQueryManagement/CreateSystemGeneratedQuery",
      CREATE_MANUAL_GENERATED_QUERY: "/CrfQueryManagement/CreateManualGeneratedQuery",
      GET_QUERY_LIST_BY_CRF_DATA_ID: (crfDataId) =>
        `/CrfQueryManagement/GetQueryListByCrfDataId/${crfDataId}`,
      GET_QUERY_LIST_BY_STUDY_SITE_PATIENT: "/CrfQueryManagement/GetQueryListByStudySitePatient",
      UPDATE_REVIEWER: "/CrfQueryManagement/UpdateReviewer",
      UPDATE_SUBMITTED_USER_COMMENT: "/CrfQueryManagement/UpdateSubmittedUserComment",
      UPDATE_STATUS: "/CrfQueryManagement/UpdateStatus",
      /** GET paged JSON — camelCase query params; see crfQueryManagement.service buildCrfQueryReportParams */
      REPORT: "/CrfQueryManagement/Report",
      REPORT_EXPORT: "/CrfQueryManagement/Report/Export",
      GET_DASHBOARD_SUMMARY: "/CrfQueryManagement/GetDashboardSummary",
    },
    RULE_ENGINE: {
      BASE: "/RuleEngine",
      GET_ALL: "/RuleEngine/GetAll",
    },
    PATIENT_ENROLMENTS: {
      BASE: "/PatientEnrolments",
      CREATE: "/PatientEnrolments/Create",
      UPDATE: (id) => `/PatientEnrolments/Update/${id}`,
      UPDATE_STATUS: (id) => `/PatientEnrolments/UpdateStatus/${id}`,
      BY_ID: (id) => `/PatientEnrolments/GetById/${id}`,
      GET_LIST: "/PatientEnrolments/GetList",
      EXPORT: "/PatientEnrolments/Export",
    },
    /** Patient visit × CRF status — CSV only via GET …/Export (no JSON list). */
    PATIENT_VISIT_CRF_STATUS_REPORT: {
      EXPORT: "/PatientVisitCrfStatusReport/Export",
    },
    /** SDV report — visit summary, field-level list, CSV/PDF export. Feature: SDV_REPORT */
    SDV_REPORT: {
      BASE: "/SdvReport",
      VISIT_SUMMARY: "/SdvReport/visit-summary",
      EXPORT: "/SdvReport/export",
      FILTER_OPTIONS: "/SdvReport/filter-options",
    },
    /** PI sign-off report — visit summary with completion counts. Feature: PI_SIGNOFF_REPORT */
    PI_SIGNOFF_REPORT: {
      VISIT_SUMMARY: "/PiSignoffReport/visit-summary",
      FILTER_OPTIONS: "/PiSignoffReport/filter-options",
      EXPORT: "/PiSignoffReport/export",
    },
    /** Email delivery report — ACS/SMTP submit + webhook delivery status. Feature: EMAIL_DELIVERY_REPORT */
    EMAIL_DELIVERY_REPORT: {
      BASE: "/email/delivery-report",
      EXPORT: "/email/delivery-report/export",
    },
    /** AI entry report — field grid, visit summary, export. Feature: AI_ENTRY_REPORT */
    AI_ENTRY_REPORT: {
      BASE: "/AiEntryReport",
      VISIT_SUMMARY: "/AiEntryReport/visit-summary",
      EXPORT: "/AiEntryReport/export",
    },
    /** YP Intelligence — governed AI layer (suggest-only, audit logged). */
    XEMUS_AI: {
      SUGGEST_SOURCE_MATCH: "/RsdvReview/SuggestSourceMatch",
      SUGGEST_QUERY: "/RsdvReview/SuggestQuery",
      ANALYZE_CRF_QUALITY: "/XemusAi/AnalyzeCrfQuality",
      SUGGEST_CODING: "/XemusAi/SuggestCoding",
      GENERATE_MONITORING_SUMMARY: "/XemusAi/GenerateMonitoringSummary",
      STUDY_ASSISTANT: "/XemusAi/StudyAssistant",
      GENERATE_CONSENT_QUESTIONS: "/XemusAi/GenerateConsentQuestions",
      RECORD_ACCEPTANCE: "/XemusAi/RecordAcceptance",
      RECORD_CAPTURE_ACCEPTANCE: "/XemusAi/RecordCaptureAcceptance",
      LOG_SUGGESTION: "/XemusAi/LogSuggestion",
      CLASSIFY_DOCUMENT: "/XemusAi/ClassifyDocument",
      BATCH_PAGE_SCAN: "/RsdvReview/BatchPageScan",
      OVERSIGHT_REPORT: "/AiOversightReport",
      OVERSIGHT_EXPORT: "/AiOversightReport/export",
    },
    /** CDASH reference library + mapping report exports. */
    CDASH: {
      LIBRARY_STATUS: "/Cdash/LibraryStatus",
      DOMAINS: "/Cdash/Domains",
      VARIABLES: "/Cdash/Variables",
      EXPORT: "/Cdash/Export",
      EXPORT_SUBMITTED_DATA: "/Cdash/ExportSubmittedData",
      REPORT_SUMMARY: "/Cdash/ReportSummary",
      FIELD_REPORT: "/Cdash/FieldReport",
      EXPORT_MAPPING_SUMMARY_CSV: "/Cdash/ExportMappingSummaryCsv",
      EXPORT_MAPPING_DETAIL_CSV: "/Cdash/ExportMappingDetailCsv",
      EXPORT_FIELD_REPORT_CSV: "/Cdash/ExportFieldReportCsv",
      EXPORT_MAPPING_REPORT_ZIP: "/Cdash/ExportMappingReportZip",
      SUGGEST: "/Cdash/Suggest",
    },
    /** CDISC regulatory export — ODM, SDTM, Define-XML, submission package. Feature: CDISC_EXPORT */
    CDISC_EXPORT: {
      FILTER_OPTIONS: "/CdiscExport/filter-options",
      EXPORT: "/CdiscExport/export",
      VALIDATE: "/CdiscExport/validate",
      EXPORT_JOBS: "/CdiscExport/export-jobs",
      EXPORT_JOB_STATUS: (jobId) => `/CdiscExport/export-jobs/${jobId}/status`,
      EXPORT_JOB_DOWNLOAD: (jobId) => `/CdiscExport/export-jobs/${jobId}/download`,
    },
    /** Study SDTM field mapping — CRF field → SDTM domain/variable. Feature: CDISC_EXPORT */
    STUDY_SDTM_MAPPING: {
      BASE: "/StudySdtmMapping",
      TEMPLATES: "/StudySdtmMapping/templates",
      APPLY_TEMPLATE: "/StudySdtmMapping/apply-template",
    },
    /** ICH GCP delegation of authority log. Feature: STUDY_SETTINGS */
    STUDY_DELEGATION_LOG: {
      BASE: "/StudyDelegationLog",
      BY_ID: (id) => `/StudyDelegationLog/${id}`,
    },
    /** Enterprise eCONSENT module. Feature: ECONSENT */
    ECONSENT: {
      JURISDICTIONS: "/EConsent/jurisdictions",
      FORMS: "/EConsent/forms",
      FORM_BY_ID: (id) => `/EConsent/forms/${id}`,
      ASSIGNMENTS: "/EConsent/assignments",
      ASSIGNMENT_BY_ID: (id) => `/EConsent/assignments/${id}`,
      AUDIT: "/EConsent/audit",
      SETUP: "/EConsent/setup",
      SUBJECTS: "/EConsent/subjects",
      PUBLISHED_VERSIONS: "/EConsent/published-versions",
      SUBJECT_BY_ID: (id) => `/EConsent/subjects/${id}`,
      SUBJECT_DOCUMENT: (id) => `/EConsent/subjects/${id}/document`,
      SUBJECT_ARCHIVAL: (id) => `/EConsent/subjects/${id}/archival`,
      SUBJECT_WET_INK_DOWNLOAD: (id) => `/EConsent/subjects/${id}/wet-ink/download`,
      SUBJECT_REASSIGN: (id) => `/EConsent/subjects/${id}/reassign`,
      ELIGIBILITY: "/EConsent/eligibility",
      VERSION_CONTENT: (versionId) => `/EConsent/versions/${versionId}/content`,
      VERSION_PUBLISH: (versionId) => `/EConsent/versions/${versionId}/publish`,
      VERSION_SUBMIT_IRB: (versionId) => `/EConsent/versions/${versionId}/submit-irb`,
      VERSION_IRB_APPROVAL: (versionId) => `/EConsent/versions/${versionId}/irb-approval`,
      VERSION_RETIRE: (versionId) => `/EConsent/versions/${versionId}/retire`,
      VERSIONS_COMPARE: "/EConsent/versions/compare",
      SUBJECT_INVITE: (id) => `/EConsent/subjects/${id}/invite`,
      SUBJECT_APPROVE: (id) => `/EConsent/subjects/${id}/approve`,
      SUBJECT_WET_INK: (id) => `/EConsent/subjects/${id}/wet-ink`,
      SUBJECT_REJECT: (id) => `/EConsent/subjects/${id}/reject`,
      SUBJECT_WITHDRAW: (id) => `/EConsent/subjects/${id}/withdraw`,
      SUBJECT_PARTY: (id, partyId) => `/EConsent/subjects/${id}/parties/${partyId}`,
      SUBJECT_ATTEST: (id, partyId) => `/EConsent/subjects/${id}/parties/${partyId}/attest-identity`,
      SUBJECT_COUNTERSIGN: (id) => `/EConsent/subjects/${id}/countersign`,
      PUBLIC_BY_TOKEN: "/EConsent/public/by-token",
      PUBLIC_DOCUMENT: "/EConsent/public/document",
      PUBLIC_OTP: "/EConsent/public/otp",
      PUBLIC_SUBMIT: "/EConsent/public/submit",
      PUBLIC_DECLINE: "/EConsent/public/decline",
      AUDIT_EXPORT: "/EConsent/audit/export",
    },
    /** Enterprise clinical platform (preview — no impact on EDC until study flags enabled). Feature: PLATFORM */
    PLATFORM: {
      MODULES: "/Platform/modules",
      SAVE_MODULES: "/Platform/modules",
      SSO: "/Platform/sso",
      SAVE_SSO: "/Platform/sso",
      INTEGRATION_EVENTS: "/Platform/integration/events",
      INTEGRATION_TEST: "/Platform/integration/test",
      ROADMAP: "/Platform/roadmap",
    },
    /** Safety / SAE. Feature: SAFETY — gated by platform IsSafetyEnabled */
    SAFETY: {
      REPORTS: "/Safety/reports",
      REPORTS_OVERDUE: "/Safety/reports/overdue",
      REPORT_BY_ID: (id) => `/Safety/reports/${id}`,
      SAVE_REPORT: "/Safety/reports",
      SUBMIT: (id) => `/Safety/reports/${id}/submit`,
      REVIEW: (id) => `/Safety/reports/${id}/review`,
      CLOSE: (id) => `/Safety/reports/${id}/close`,
      PHASE_GUIDANCE: "/Safety/phase-guidance",
    },
    PERMISSIONS: {
      BASE: "/Permissions",
      GET_ALL_FEATURES_WITH_SUBFEATURES: "/Permissions/GetAllFeaturesAndSubFeatures",
      GET_ROLE_PERMISSIONS: (roleGuid) => `/Permissions/GetRolePermissions/${roleGuid}`,
      SAVE_ROLE_PERMISSIONS: "/Permissions/SaveRolePermissions",
    },
    VISIT_SCHEDULES: {
      BASE: "/VisitSchedules",
      GET_LIST: "/VisitSchedules/GetVisitSchedulesList",
      BY_ID: (id) => `/VisitSchedules/GetVisitScheduleById/${id}`,
      BY_STUDY: (studyId) => `/VisitSchedules/GetVisitSchedulesByStudyId/${studyId}`,
      GET_DROPDOWN: (studyId) => `/VisitSchedules/GetVisitSchedulesForDropdown/${studyId}`,
      CREATE_BATCH: "/VisitSchedules/CreateVisitScheduleBatch",
      UPDATE: (id) => `/VisitSchedules/UpdateVisitSchedule/${id}`,
      UPDATE_STATUS: (id, isActive) => `/VisitSchedules/UpdateVisitScheduleStatus/${id}?isActive=${isActive}`,
    },
    AGREEMENTS: {
      BASE: "/Agreements",
      CREATE: "/Agreements",
      GET_LIST: "/Agreements/GetAgreementsList",
      BY_ID: (id) => `/Agreements/${id}`,
      UPDATE: (id) => `/Agreements/${id}`,
      DELETE: (id) => `/Agreements/${id}`,
      ACTIVE_BY_STUDY: (studyId) => `/Agreements/Active/${studyId}`,
    },
    /**
     * Visit attachments — prefix on API host is `/api/visit-attachments` (BASE_URL already ends with `/api`).
     * Auth: Bearer + JSON on POST. See visitAttachments.service.js for enums (types 1–4, upload mode 1–2).
     */
    VISIT_ATTACHMENTS: {
      BASE: "/visit-attachments",
      INIT: "/visit-attachments/init",
      UPLOAD: (attachmentId) => `/visit-attachments/${attachmentId}/upload`,
      COMPLETE: (attachmentId) => `/visit-attachments/${attachmentId}/complete`,
      LIST: "/visit-attachments",
      DOWNLOAD: (attachmentId) => `/visit-attachments/${attachmentId}/download`,
      DELETE: (attachmentId) => `/visit-attachments/${attachmentId}`,
    },
    REPORTS: {
      BASE: "/Reports",
      STUDY_DETAILS: "/Reports/study-details",
      STUDY_DETAILS_EXPORT: "/Reports/study-details/export",
      SITE_DETAILS: "/Reports/site-details",
      SITE_DETAILS_EXPORT: "/Reports/site-details/export",
      AGREEMENT_DETAILS: "/Reports/agreement-details",
      AGREEMENT_DETAILS_EXPORT: "/Reports/agreement-details/export",
      PATIENT_DETAILS: "/Reports/patient-details",
      PATIENT_DETAILS_EXPORT: "/Reports/patient-details/export",
      AUDIT_LOG: "/Reports/audit-log",
      AUDIT_LOG_EXPORT: "/Reports/export-audit-log",
      AUDIT_TRAIL: "/Reports/audit-trail",
      AUDIT_TRAIL_EXPORT: "/Reports/export-audit-trail",
      AUDIT_TRAIL_WITH_REASON: "/Reports/audit-trail-with-reason",
      AUDIT_TRAIL_WITH_REASON_EXPORT: "/Reports/export-audit-trail-with-reason",
      VISIT_DETAILS: "/Reports/visit-details",
      VISIT_DETAILS_EXPORT: "/Reports/visit-details/export",
      ECRF_DETAILS_EXPORT: "/Reports/ecrf-details/export",
      /** POST JSON body — browser PDF ZIP bundle (single round-trip). Backend: POST /api/Reports/ecrf-details-export-bundle */
      ECRF_DETAILS_EXPORT_BUNDLE: "/Reports/ecrf-details-export-bundle",
      /** Same contract as ECRF_DETAILS_EXPORT_BUNDLE (alias route on some APIs). */
      ECRF_DETAILS_EXPORT_BUNDLE_ALT: "/Reports/ecrf-details-pdf-export-bundle",
      /** POST multipart — email a generated report file as attachment */
      SEND_EXPORT_EMAIL: "/Reports/send-export-email",
      USER_DETAILS: "/Reports/user-details",
      USER_DETAILS_EXPORT: "/Reports/user-details/export",
    },
    USER_AGREEMENTS: {
      BASE: "/UserAgreement",
      GET_AGREEMENT_DATA_BY_STUDY_ID: (studyId) => `/UserAgreement/GetAgreementDataByStudyId/${studyId}`,
      SEND_AGREEMENT_OTP: "/UserAgreement/SendAgreementOtp",
      VERIFY_AGREEMENT_OTP: "/UserAgreement/VerifyAgreementOtp",
      SIGN_AGREEMENT: "/UserAgreement/SignAgreement",
      DOWNLOAD_AGREEMENT_PDF: (studyId) => `/UserAgreement/DownloadAgreementPdf/${studyId}`,
      DOWNLOAD_AGREEMENT_PDF_FOR_USER: (studyId, userId) =>
        `/UserAgreement/DownloadAgreementPdfForUser?studyId=${studyId}&userId=${userId}`,
    },
    AI: {
      BASE: "/AI",
      EXTRACT_FORM_DATA: "/AI/ExtractFormData",
    },
    /** Lab Management — Pr.Edc.API controllers (Authorize + ApiResponse) */
    /**
     * MedDRA & WHO‑DD lookup — MeddraWhoddLookupController ([Authorize], ApiResponse&lt;T&gt;).
     * GET .../MeddraWhoddLookup/meddra/indications?search=&pageNumber=&pageSize=
     * GET .../MeddraWhoddLookup/whodd/drugs?search=
     */
    MEDDRA_WHODD_LOOKUP: {
      MEDDRA_INDICATIONS: "/MeddraWhoddLookup/meddra/indications",
      WHODD_DRUGS: "/MeddraWhoddLookup/whodd/drugs",
    },
    LAB_MANAGEMENT: {
      LAB_UNITS: {
        LIST: "/LabUnits/GetLabUnitsList",
        BY_ID: (id) => `/LabUnits/GetLabUnitById/${id}`,
        CREATE: "/LabUnits/CreateLabUnit",
        UPDATE: (id) => `/LabUnits/UpdateLabUnit/${id}`,
        UPDATE_STATUS: (id) => `/LabUnits/UpdateLabUnitStatus/${id}`,
        EXPORT: "/LabUnits/Export",
        DROPDOWN: "/LabUnits/GetLabUnitsForDropdown",
      },
      LAB_CATEGORIES: {
        LIST: "/LabCategories/GetLabCategoriesList",
        BY_ID: (id) => `/LabCategories/GetLabCategoryById/${id}`,
        CREATE: "/LabCategories/CreateLabCategory",
        UPDATE: (id) => `/LabCategories/UpdateLabCategory/${id}`,
        UPDATE_STATUS: (id) => `/LabCategories/UpdateLabCategoryStatus/${id}`,
        EXPORT: "/LabCategories/Export",
        DROPDOWN: "/LabCategories/GetLabCategoriesForDropdown",
      },
      LAB_TESTS: {
        LIST: "/LabTests/GetLabTestsList",
        SEARCH: "/LabTests/SearchLabTests",
        BY_ID: (id) => `/LabTests/GetLabTestById/${id}`,
        CREATE: "/LabTests/CreateLabTest",
        UPDATE: (id) => `/LabTests/UpdateLabTest/${id}`,
        UPDATE_STATUS: (id) => `/LabTests/UpdateLabTestStatus/${id}`,
        EXPORT: "/LabTests/Export",
        DROPDOWN: "/LabTests/GetLabTestsForDropdown",
      },
      LABS: {
        LIST: "/Labs/GetLabsList",
        BY_ID: (id) => `/Labs/GetLabById/${id}`,
        CREATE: "/Labs/CreateLab",
        UPDATE: (id) => `/Labs/UpdateLab/${id}`,
        UPDATE_STATUS: (id) => `/Labs/UpdateLabStatus/${id}`,
        EXPORT: "/Labs/Export",
        DROPDOWN: "/Labs/GetLabsForDropdown",
      },
      LAB_RANGE_ASSIGNMENTS: {
        LIST: "/LabRangeAssignments/GetLabRangeAssignmentsList",
        BY_ID: (id) => `/LabRangeAssignments/GetLabRangeAssignmentById/${id}`,
        CREATE_BATCH: "/LabRangeAssignments/CreateLabRangeAssignmentsBatch",
        UPDATE: (id) => `/LabRangeAssignments/UpdateLabRangeAssignment/${id}`,
        UPDATE_STATUS: (id) => `/LabRangeAssignments/UpdateLabRangeAssignmentStatus/${id}`,
        EXPORT: "/LabRangeAssignments/Export",
      },
    },
  },
}

// Storage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: "authToken",
  USER: "user",
  REFRESH_TOKEN: "refreshToken",
  MENU: "menu",
}

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
}

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: "Network error occurred. Please check your connection.",
  TIMEOUT: "Request timeout. Please try again.",
  UNAUTHORIZED: "You are not authorized to perform this action.",
  NOT_FOUND: "The requested resource was not found.",
  SERVER_ERROR: "An error occurred on the server. Please try again later.",
  UNKNOWN_ERROR: "An unexpected error occurred.",
}

// Study Filter Enum (matches backend Pr.Edc.Application.Enums.StudyFilter)
export const StudyFilter = {
  Active: 1,
  Locked: 2,
}

