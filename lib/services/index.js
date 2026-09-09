/**
 * Services Index
 * Central export point for all services
 * This provides a clean, organized way to import services
 */

// Core API
export { default as apiClient } from "../api/client"
export { API_CONFIG, STORAGE_KEYS, HTTP_STATUS, ERROR_MESSAGES } from "../api/config"
export { default as logger } from "../api/logger"

// Services
export { default as systemService } from "./system.service"
export { default as authService } from "./auth.service"
export { default as userService } from "./user.service"
export { default as rolesService } from "./roles.service"
export { default as studyService } from "./study.service"
export { default as studySettingsService } from "./studySettings.service"
export { default as emailTemplateService } from "./emailTemplate.service"
export { default as studyPermissionService } from "./studyPermission.service"
export { default as studyPaymentRuleService } from "./studyPaymentRule.service"
export { default as piSignoffService } from "./piSignoff.service"
export { default as rsdvReviewService } from "./rsdvReview.service"
export { default as dbLockService } from "./dbLock.service"
export { default as siteService } from "./site.service"
export { default as studyUserService } from "./studyUser.service"
export { crfService } from "./crf.service"
export { default as patientEnrolmentService } from "./patientEnrolment.service"
export { default as permissionsService } from "./permissions.service"
export { default as dashboardService } from "./dashboard.service"
export { default as visitScheduleService } from "./visitSchedule.service"
export { default as crfDataService } from "./crfData.service"
export { default as crfDesignService } from "./crfDesign.service"
export { default as crfRuleService } from "./crfRule.service"
export { default as agreementService } from "./agreement.service"
export { default as userAgreementService } from "./userAgreement.service" // User agreement service for CRC users
export { default as cdashService } from "./cdash.service"
export { default as reportsService } from "./reports.service"
export { default as sdvReportService } from "./sdvReport.service"
export { default as piSignoffReportService } from "./piSignoffReport.service"
export { default as aiEntryReportService } from "./aiEntryReport.service"
export { default as xemusAiService } from "./xemusAi.service"
export { emailDeliveryReportService } from "./emailDeliveryReport.service"
export { default as cdiscExportService } from "./cdiscExport.service"
export { default as studySdtmMappingService } from "./studySdtmMapping.service"
export { default as geminiService } from "./gemini.service"
export { default as auditTrailWithReasonService } from "./auditTrailWithReason.service"
export { default as queryManagementAdapter } from "./queryManagement.adapter"
export { default as studyFinanceStatusService } from "./studyFinanceStatus.service"
export {
  default as visitAttachmentsService,
  preferAzureBlobSdkForVisitAttachment,
  VisitAttachmentUploadMode,
  VisitAttachmentType,
  VisitAttachmentStatus,
  VISIT_ATTACHMENT_NORMAL_MAX_BYTES,
  VISIT_ATTACHMENT_STANDARD_MAX_BYTES,
} from "./visitAttachments.service"
export { default as labManagementService } from "./labManagement.service"
export { default as terminologyCodingService } from "./terminologyCoding.service"
export { default as eConsentService } from "./eConsent.service"
export { default as platformService } from "./platform.service"
export { default as safetyService } from "./safety.service"

// Additional services can be added here as they are created
// export { default as clinicalDataService } from "./clinical-data.service"
// export { default as dataCaptureService } from "./data-capture.service"
// export { default as auditService } from "./audit.service"
// export { default as complianceService } from "./compliance.service"
// export { default as notificationService } from "./notification.service"

