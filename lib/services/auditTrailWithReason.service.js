import apiClient from "../api/client"
import logger from "../api/logger"

class AuditTrailWithReasonService {
  async saveFieldChange(payload) {
    try {
      const response = await apiClient.post("/AuditTrailWithReason/field-change", payload)
      if (!response?.isSuccess) {
        logger.error("Save audit trail with reason failed", {
          statusCode: response?.statusCode,
          message: response?.message,
          data: response?.data,
        })
      }
      return response
    } catch (error) {
      logger.error("Save audit trail with reason failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error?.message || "Failed to save audit trail with reason",
      }
    }
  }
}

export default new AuditTrailWithReasonService()
