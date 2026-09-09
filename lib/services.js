/**
 * Services Module - Main Entry Point
 * 
 * This file maintains backward compatibility with existing imports
 * while using the new modular structure under the hood.
 * 
 * For new code, prefer importing from:
 * - @/lib/services/index.js (for organized imports)
 * - @/lib/services/{service-name}.service.js (for specific services)
 * 
 * @deprecated Direct imports from this file are still supported but
 *             consider using the modular structure for better organization
 */

// Re-export from new modular structure
export { default as apiClient, ApiClient } from "./api/client"
export { API_CONFIG, STORAGE_KEYS, HTTP_STATUS, ERROR_MESSAGES } from "./api/config"
export { default as logger } from "./api/logger"

// Re-export services
export { default as authService } from "./services/auth.service"
export { default as userService } from "./services/user.service"
export { default as rolesService } from "./services/roles.service"
export { default as permissionsService } from "./services/permissions.service"
export { default as studyService } from "./services/study.service"
export { default as studySettingsService } from "./services/studySettings.service"
export { default as emailTemplateService } from "./services/emailTemplate.service"
export { default as siteService } from "./services/site.service"
export { default as studyUserService } from "./services/studyUser.service"
export { crfService } from "./services/crf.service"
export { default as dashboardService } from "./services/dashboard.service"
export { default as reportsService } from "./services/reports.service"
export { default as patientEnrolmentService } from "./services/patientEnrolment.service"
export { default as visitScheduleService } from "./services/visitSchedule.service"
export { default as crfDataService } from "./services/crfData.service"
export { default as crfDesignService } from "./services/crfDesign.service"
export { default as crfRuleService } from "./services/crfRule.service"
export { default as crfQueryManagementService } from "./services/crfQueryManagement.service"
export { default as studyPermissionService } from "./services/studyPermission.service"
export { default as studyPaymentRuleService } from "./services/studyPaymentRule.service"
export { default as piSignoffService } from "./services/piSignoff.service"
export { default as rsdvReviewService } from "./services/rsdvReview.service"
export { default as dbLockService } from "./services/dbLock.service"
export { default as queryManagementAdapter } from "./services/queryManagement.adapter"
export { default as agreementService } from "./services/agreement.service"
export { default as userAgreementService } from "./services/userAgreement.service"
export { default as geminiService } from "./services/gemini.service"
export { default as visitAttachmentsService } from "./services/visitAttachments.service"
export { default as auditTrailWithReasonService } from "./services/auditTrailWithReason.service"
export { default as labManagementService } from "./services/labManagement.service"
export { default as eConsentService } from "./services/eConsent.service"
export { default as terminologyCodingService } from "./services/terminologyCoding.service"
export { default as xemusAiService } from "./services/xemusAi.service"

// Named exports from visit-attachments service (used by screens importing from "@/lib/services")
export {
  preferAzureBlobSdkForVisitAttachment,
  VisitAttachmentUploadMode,
  VisitAttachmentType,
  VisitAttachmentStatus,
  VISIT_ATTACHMENT_NORMAL_MAX_BYTES,
  VISIT_ATTACHMENT_STANDARD_MAX_BYTES,
} from "./services/visitAttachments.service"

// Legacy exports for backward compatibility
// These will be gradually migrated to the new structure
import apiClient from "./api/client"
import { API_CONFIG } from "./api/config"

// ==================== CLINICAL DATA SERVICES ====================
export const clinicalDataService = {
  async getAllTrials(page = 1, limit = 10) {
    return await apiClient.get(`/clinical-trials?page=${page}&limit=${limit}`)
  },

  async getTrialById(trialId) {
    return await apiClient.get(`/clinical-trials/${trialId}`)
  },

  async createTrial(trialData) {
    return await apiClient.post("/clinical-trials", trialData)
  },

  async updateTrial(trialId, trialData) {
    return await apiClient.put(`/clinical-trials/${trialId}`, trialData)
  },

  async deleteTrial(trialId) {
    return await apiClient.delete(`/clinical-trials/${trialId}`)
  },

  async searchTrials(searchParams) {
    const queryString = new URLSearchParams(searchParams).toString()
    return await apiClient.get(`/clinical-trials/search?${queryString}`)
  },
}

// ==================== DATA CAPTURE SERVICES ====================
export const dataCaptureService = {
  async captureData(captureData) {
    return await apiClient.post("/data-capture", captureData)
  },

  async getCapturedData(filters = {}) {
    const queryString = new URLSearchParams(filters).toString()
    return await apiClient.get(`/data-capture?${queryString}`)
  },

  async getCaptureById(captureId) {
    return await apiClient.get(`/data-capture/${captureId}`)
  },

  async updateCapture(captureId, captureData) {
    return await apiClient.put(`/data-capture/${captureId}`, captureData)
  },

  async deleteCapture(captureId) {
    return await apiClient.delete(`/data-capture/${captureId}`)
  },

  async validateData(captureId) {
    return await apiClient.post(`/data-capture/${captureId}/validate`)
  },
}

// ==================== AUDIT TRAIL SERVICES ====================
export const auditService = {
  async getAuditLogs(filters = {}) {
    const queryString = new URLSearchParams(filters).toString()
    return await apiClient.get(`/audit?${queryString}`)
  },

  async getAuditLogById(auditId) {
    return await apiClient.get(`/audit/${auditId}`)
  },

  async getAuditLogsByEntity(entityType, entityId) {
    return await apiClient.get(`/audit/${entityType}/${entityId}`)
  },
}

// ==================== COMPLIANCE SERVICES ====================
export const complianceService = {
  async getComplianceReport(reportType, filters = {}) {
    const queryString = new URLSearchParams(filters).toString()
    return await apiClient.get(`/compliance/${reportType}?${queryString}`)
  },

  async generateComplianceReport(reportData) {
    return await apiClient.post("/compliance/generate", reportData)
  },

  async getComplianceStatus(trialId) {
    return await apiClient.get(`/compliance/status/${trialId}`)
  },
}

// ==================== NOTIFICATION SERVICES ====================
export const notificationService = {
  async getNotifications(page = 1, limit = 20) {
    return await apiClient.get(`/notifications?page=${page}&limit=${limit}`)
  },

  async markAsRead(notificationId) {
    return await apiClient.patch(`/notifications/${notificationId}/read`)
  },

  async markAllAsRead() {
    return await apiClient.patch("/notifications/read-all")
  },

  async deleteNotification(notificationId) {
    return await apiClient.delete(`/notifications/${notificationId}`)
  },
}

// Export API_BASE_URL for backward compatibility
export const API_BASE_URL = API_CONFIG.BASE_URL
