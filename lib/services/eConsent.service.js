import apiClient from "@/lib/api/client"
import { API_CONFIG, getActiveApiBaseUrl, STORAGE_KEYS } from "@/lib/api/config"
import logger from "@/lib/api/logger"

const EP = API_CONFIG.ENDPOINTS.ECONSENT

async function publicFetch(path, options = {}) {
  const base = (getActiveApiBaseUrl() || API_CONFIG.BASE_URL || "").replace(/\/$/, "")
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json || typeof json !== "object") {
      return {
        isSuccess: false,
        message: json?.message || json?.Message || `Request failed (${res.status})`,
        data: null,
      }
    }

    const isSuccess =
      json.isSuccess !== undefined
        ? json.isSuccess
        : json.success !== undefined
          ? json.success
          : json.Success !== undefined
            ? json.Success
            : res.ok

    return {
      isSuccess: Boolean(isSuccess),
      statusCode: json.statusCode ?? res.status,
      message: json.message ?? json.Message ?? (isSuccess ? "Request successful" : "Request failed"),
      data: json.data !== undefined ? json.data : json.Data !== undefined ? json.Data : null,
      errors: json.errors ?? json.Errors ?? [],
    }
  } catch (error) {
    logger.error("eConsent publicFetch failed", error)
    return { isSuccess: false, message: error.message, data: null }
  }
}

class EConsentService {
  async getJurisdictions(studyId) {
    try {
      return await apiClient.get(`${EP.JURISDICTIONS}?studyId=${encodeURIComponent(studyId)}`)
    } catch (error) {
      logger.error("eConsent getJurisdictions failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async saveJurisdiction(body) {
    try {
      return await apiClient.post(EP.JURISDICTIONS, body)
    } catch (error) {
      logger.error("eConsent saveJurisdiction failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async getForms(studyId) {
    try {
      return await apiClient.get(`${EP.FORMS}?studyId=${encodeURIComponent(studyId)}`)
    } catch (error) {
      logger.error("eConsent getForms failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async createForm(body) {
    try {
      return await apiClient.post(EP.FORMS, body)
    } catch (error) {
      logger.error("eConsent createForm failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async deleteForm(formId) {
    try {
      return await apiClient.delete(EP.FORM_BY_ID(formId))
    } catch (error) {
      logger.error("eConsent deleteForm failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async saveVersionContent(versionId, body) {
    try {
      return await apiClient.put(EP.VERSION_CONTENT(versionId), body)
    } catch (error) {
      logger.error("eConsent saveVersionContent failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async publishVersion(versionId) {
    try {
      return await apiClient.post(EP.VERSION_PUBLISH(versionId), {})
    } catch (error) {
      logger.error("eConsent publishVersion failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async submitVersionForIrb(versionId) {
    try {
      return await apiClient.post(EP.VERSION_SUBMIT_IRB(versionId), {})
    } catch (error) {
      logger.error("eConsent submitVersionForIrb failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async recordIrbApproval(versionId, body) {
    try {
      return await apiClient.post(EP.VERSION_IRB_APPROVAL(versionId), body || {})
    } catch (error) {
      logger.error("eConsent recordIrbApproval failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async retireVersion(versionId, reason) {
    try {
      return await apiClient.post(EP.VERSION_RETIRE(versionId), { reason: reason || null })
    } catch (error) {
      logger.error("eConsent retireVersion failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async compareVersions(leftVersionId, rightVersionId) {
    try {
      const q = new URLSearchParams({
        leftVersionId: String(leftVersionId),
        rightVersionId: String(rightVersionId),
      })
      return await apiClient.get(`${EP.VERSIONS_COMPARE}?${q.toString()}`)
    } catch (error) {
      logger.error("eConsent compareVersions failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async getAssignments(studyId) {
    try {
      return await apiClient.get(`${EP.ASSIGNMENTS}?studyId=${encodeURIComponent(studyId)}`)
    } catch (error) {
      logger.error("eConsent getAssignments failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async saveAssignment(body) {
    try {
      return await apiClient.post(EP.ASSIGNMENTS, body)
    } catch (error) {
      logger.error("eConsent saveAssignment failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async deleteAssignment(id) {
    try {
      return await apiClient.delete(EP.ASSIGNMENT_BY_ID(id))
    } catch (error) {
      logger.error("eConsent deleteAssignment failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async getAudit(studyId, { eventType, fromUtc, toUtc, take } = {}) {
    try {
      const q = new URLSearchParams({ studyId: String(studyId) })
      if (take) q.set("take", String(take))
      if (eventType) q.set("eventType", eventType)
      if (fromUtc) q.set("fromUtc", fromUtc)
      if (toUtc) q.set("toUtc", toUtc)
      return await apiClient.get(`${EP.AUDIT}?${q.toString()}`)
    } catch (error) {
      logger.error("eConsent getAudit failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async exportAudit(studyId, { eventType, fromUtc, toUtc } = {}) {
    try {
      const q = new URLSearchParams({ studyId: String(studyId) })
      if (eventType) q.set("eventType", eventType)
      if (fromUtc) q.set("fromUtc", fromUtc)
      if (toUtc) q.set("toUtc", toUtc)
      return await apiClient.get(`${EP.AUDIT_EXPORT}?${q.toString()}`)
    } catch (error) {
      logger.error("eConsent exportAudit failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async getSetup(studyId) {
    try {
      return await apiClient.get(`${EP.SETUP}?studyId=${encodeURIComponent(studyId)}`)
    } catch (error) {
      logger.error("eConsent getSetup failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async saveSetup(body) {
    try {
      return await apiClient.put(EP.SETUP, body)
    } catch (error) {
      logger.error("eConsent saveSetup failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async getSubjects(studyId, status) {
    try {
      const q = new URLSearchParams({ studyId: String(studyId) })
      if (status) q.set("status", status)
      return await apiClient.get(`${EP.SUBJECTS}?${q.toString()}`)
    } catch (error) {
      logger.error("eConsent getSubjects failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async getPublishedVersions(studyId) {
    try {
      const q = new URLSearchParams({ studyId: String(studyId) })
      return await apiClient.get(`${EP.PUBLISHED_VERSIONS}?${q.toString()}`)
    } catch (error) {
      logger.error("eConsent getPublishedVersions failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async getSubjectDetail(subjectConsentId) {
    try {
      return await apiClient.get(EP.SUBJECT_BY_ID(subjectConsentId))
    } catch (error) {
      logger.error("eConsent getSubjectDetail failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async getSubjectDocument(subjectConsentId) {
    try {
      return await apiClient.get(EP.SUBJECT_DOCUMENT(subjectConsentId))
    } catch (error) {
      logger.error("eConsent getSubjectDocument failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async downloadSubjectFile(endpoint, fallbackName = "download.pdf") {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) : null
      const base = (getActiveApiBaseUrl() || API_CONFIG.BASE_URL || "").replace(/\/$/, "")
      const url = `${base}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/pdf,application/octet-stream,*/*",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }))
        return { isSuccess: false, message: err.message || "Download failed" }
      }
      const blob = await res.blob()
      const cd = res.headers.get("Content-Disposition") || ""
      const match = cd.match(/filename="?([^";]+)"?/)
      const fileName = match ? match[1].trim() : fallbackName
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = objectUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
      return { isSuccess: true }
    } catch (error) {
      logger.error("eConsent downloadSubjectFile failed", error)
      return { isSuccess: false, message: error.message }
    }
  }

  async downloadArchival(subjectConsentId) {
    return this.downloadSubjectFile(EP.SUBJECT_ARCHIVAL(subjectConsentId), "econsent-archive.pdf")
  }

  async downloadWetInk(subjectConsentId) {
    return this.downloadSubjectFile(EP.SUBJECT_WET_INK_DOWNLOAD(subjectConsentId), "wet-ink.pdf")
  }

  async reassignSubject(subjectConsentId, formVersionId = null, amendmentReason = null) {
    try {
      const body = {}
      if (formVersionId != null) body.formVersionId = Number(formVersionId)
      if (amendmentReason) body.amendmentReason = String(amendmentReason).trim()
      return await apiClient.post(EP.SUBJECT_REASSIGN(subjectConsentId), body)
    } catch (error) {
      logger.error("eConsent reassignSubject failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async sendInvite(subjectConsentId, partyId = null) {
    try {
      const q = partyId != null ? `?partyId=${encodeURIComponent(partyId)}` : ""
      return await apiClient.post(`${EP.SUBJECT_INVITE(subjectConsentId)}${q}`, {})
    } catch (error) {
      logger.error("eConsent sendInvite failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async updatePartyContact(subjectConsentId, partyId, body) {
    try {
      return await apiClient.put(EP.SUBJECT_PARTY(subjectConsentId, partyId), body)
    } catch (error) {
      logger.error("eConsent updatePartyContact failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async countersign(subjectConsentId, body) {
    try {
      return await apiClient.post(EP.SUBJECT_COUNTERSIGN(subjectConsentId), body)
    } catch (error) {
      logger.error("eConsent countersign failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async approve(subjectConsentId) {
    try {
      return await apiClient.post(EP.SUBJECT_APPROVE(subjectConsentId), {})
    } catch (error) {
      logger.error("eConsent approve failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async uploadWetInk(subjectConsentId, body) {
    try {
      return await apiClient.post(EP.SUBJECT_WET_INK(subjectConsentId), body)
    } catch (error) {
      logger.error("eConsent uploadWetInk failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async reject(subjectConsentId, reason) {
    try {
      const q = reason ? `?reason=${encodeURIComponent(reason)}` : ""
      return await apiClient.post(`${EP.SUBJECT_REJECT(subjectConsentId)}${q}`, {})
    } catch (error) {
      logger.error("eConsent reject failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async withdraw(subjectConsentId, { reasonCode, notes } = {}) {
    try {
      return await apiClient.post(EP.SUBJECT_WITHDRAW(subjectConsentId), {
        reasonCode: reasonCode || "SubjectRequest",
        notes: notes || null,
      })
    } catch (error) {
      logger.error("eConsent withdraw failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async attestIdentity(subjectConsentId, partyId, { attestorName, notes } = {}) {
    try {
      return await apiClient.post(EP.SUBJECT_ATTEST(subjectConsentId, partyId), {
        attestorName,
        notes: notes || null,
      })
    } catch (error) {
      logger.error("eConsent attestIdentity failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async getEligibility(studyId, patientEnrolmentId) {
    try {
      const q = new URLSearchParams({
        studyId: String(studyId),
        patientEnrolmentId: String(patientEnrolmentId),
      })
      return await apiClient.get(`${EP.ELIGIBILITY}?${q.toString()}`)
    } catch (error) {
      logger.error("eConsent getEligibility failed", error)
      return { isSuccess: false, message: error.message, data: null }
    }
  }

  async getPublicByToken(token) {
    return publicFetch(`${EP.PUBLIC_BY_TOKEN}?token=${encodeURIComponent(token)}`)
  }

  async getPublicDocument(token) {
    return publicFetch(`${EP.PUBLIC_DOCUMENT}?token=${encodeURIComponent(token)}`)
  }

  async issuePublicOtp(token, channel = "auto") {
    return publicFetch(EP.PUBLIC_OTP, {
      method: "POST",
      body: JSON.stringify({ token, channel }),
    })
  }

  async submitPublic(body) {
    return publicFetch(EP.PUBLIC_SUBMIT, { method: "POST", body: JSON.stringify(body) })
  }

  async declinePublic(body) {
    return publicFetch(EP.PUBLIC_DECLINE, { method: "POST", body: JSON.stringify(body) })
  }
}

const eConsentService = new EConsentService()
export default eConsentService
