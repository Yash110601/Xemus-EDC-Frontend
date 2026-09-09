/**
 * Email Template Service — per-study scheduled study update emails.
 */

import apiClient from "../api/client"
import { API_CONFIG } from "../api/config"
import logger from "../api/logger"

function pickField(obj, ...keys) {
  if (!obj) return undefined
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key]
  }
  return undefined
}

class EmailTemplateService {
  async getDefaultContent() {
    try {
      return await apiClient.get(API_CONFIG.ENDPOINTS.EMAIL_TEMPLATES.DEFAULT_CONTENT)
    } catch (error) {
      logger.error("Get default email template content failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || error.httpStatus || 500,
        data: null,
        message: error.message || "Failed to load default email template",
      }
    }
  }

  async getByStudyId(studyId) {
    try {
      if (!studyId) {
        return {
          isSuccess: false,
          statusCode: 400,
          data: null,
          message: "Study ID is required",
        }
      }
      return await apiClient.get(API_CONFIG.ENDPOINTS.EMAIL_TEMPLATES.BY_STUDY(studyId))
    } catch (error) {
      logger.error("Get email template by study failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || error.httpStatus || 500,
        data: null,
        message: error.message || "Failed to fetch email template",
      }
    }
  }

  async create(payload) {
    try {
      return await apiClient.post(API_CONFIG.ENDPOINTS.EMAIL_TEMPLATES.CREATE, payload)
    } catch (error) {
      logger.error("Create email template failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || error.httpStatus || 500,
        data: null,
        message: error.message || "Failed to create email template",
      }
    }
  }

  async update(id, payload) {
    try {
      if (!id) {
        return {
          isSuccess: false,
          statusCode: 400,
          data: null,
          message: "Template ID is required",
        }
      }
      return await apiClient.put(API_CONFIG.ENDPOINTS.EMAIL_TEMPLATES.UPDATE(id), payload)
    } catch (error) {
      logger.error("Update email template failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || error.httpStatus || 500,
        data: null,
        message: error.message || "Failed to update email template",
      }
    }
  }

  async preview(payload) {
    try {
      return await apiClient.post(API_CONFIG.ENDPOINTS.EMAIL_TEMPLATES.PREVIEW, payload)
    } catch (error) {
      logger.error("Preview email template failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || error.httpStatus || 500,
        data: null,
        message: error.message || "Failed to preview email",
      }
    }
  }

  async getSendHistory(studyId, pageNumber = 1, pageSize = 10) {
    try {
      if (!studyId) {
        return {
          isSuccess: false,
          statusCode: 400,
          data: null,
          message: "Study ID is required",
        }
      }
      return await apiClient.get(
        API_CONFIG.ENDPOINTS.EMAIL_TEMPLATES.HISTORY_BY_STUDY(studyId, pageNumber, pageSize),
      )
    } catch (error) {
      logger.error("Get email send history failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || error.httpStatus || 500,
        data: null,
        message: error.message || "Failed to fetch send history",
      }
    }
  }

  async sendNow(studyId, force = true) {
    try {
      if (!studyId) {
        return {
          isSuccess: false,
          statusCode: 400,
          data: null,
          message: "Study ID is required",
        }
      }
      return await apiClient.post(API_CONFIG.ENDPOINTS.DAILY_STUDY_UPDATE.SEND(studyId, force))
    } catch (error) {
      logger.error("Send study email now failed", error)
      return {
        isSuccess: false,
        statusCode: error.statusCode || error.httpStatus || 500,
        data: null,
        message: error.message || "Failed to send email",
      }
    }
  }

  /** Normalize API DTO to form-friendly shape. */
  mapTemplateToForm(data) {
    if (!data) return null
    return {
      templateId: pickField(data, "id", "Id"),
      recipients: pickField(data, "recipients", "Recipients") || "",
      ccRecipients: pickField(data, "ccRecipients", "CcRecipients") || "",
      bccRecipients: pickField(data, "bccRecipients", "BccRecipients") || "",
      scheduleMode: Number(pickField(data, "scheduleMode", "ScheduleMode") ?? 0),
      intervalDays: pickField(data, "intervalDays", "IntervalDays") ?? 15,
      weeklyDayOfWeek: pickField(data, "weeklyDayOfWeek", "WeeklyDayOfWeek") ?? 1,
      monthlyDayOfMonth: pickField(data, "monthlyDayOfMonth", "MonthlyDayOfMonth") ?? 1,
      onceSendAtUtc: pickField(data, "onceSendAtUtc", "OnceSendAtUtc") || null,
      scheduleAnchorType: Number(pickField(data, "scheduleAnchorType", "ScheduleAnchorType") ?? 1),
      timeSlot: pickField(data, "timeSlot", "TimeSlot") || "09:00",
      timeZoneId: pickField(data, "timeZoneId", "TimeZoneId") || "India Standard Time",
      attachFinanceStatusReport: Boolean(
        pickField(data, "attachFinanceStatusReport", "AttachFinanceStatusReport"),
      ),
      isActive: pickField(data, "isActive", "IsActive") !== false,
      lastSentUtc: pickField(data, "lastSentUtc", "LastSentUtc"),
      nextScheduledRunUtc: pickField(data, "nextScheduledRunUtc", "NextScheduledRunUtc"),
    }
  }
}

export default new EmailTemplateService()
