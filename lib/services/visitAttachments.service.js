/**
 * Visit Attachments Service
 * Init upload → PUT to SAS URL (browser) → Complete. List, Download, Delete.
 *
 * Backend: /api/visit-attachments (BASE_URL includes /api). ApiResponse: { success, message, data, errors }.
 */

import apiClient from "../api/client"
import { API_CONFIG, STORAGE_KEYS } from "../api/config"
import logger from "../api/logger"

const EP = API_CONFIG.ENDPOINTS.VISIT_ATTACHMENTS
const BASE = API_CONFIG.BASE_URL

/** @enum {number} Matches .NET VisitAttachmentType */
export const VisitAttachmentType = {
  Dicom: 1,
  Video: 2,
  Image: 3,
  Pdf: 4,
}

/**
 * Matches backend VisitAttachmentUploadMode (init response `uploadMode`).
 * Normal: &lt;10 MB — simple PUT often enough. Standard/Large: prefer chunked Azure SDK in browser.
 */
export const VisitAttachmentUploadMode = {
  Normal: 1,
  Standard: 2,
  Large: 3,
}

/** Below this size, tier is Normal (aligned with backend). */
export const VISIT_ATTACHMENT_NORMAL_MAX_BYTES = 10 * 1024 * 1024

/** Upper bound for Standard tier before Large (aligned with backend). */
export const VISIT_ATTACHMENT_STANDARD_MAX_BYTES = 200 * 1024 * 1024

/**
 * Whether to use @azure/storage-blob for PUT (chunked, more reliable for mid/large files).
 * @param {number|string|null|undefined} uploadMode — from init `data.uploadMode`
 * @param {number} fileSizeBytes
 */
export function preferAzureBlobSdkForVisitAttachment(uploadMode, fileSizeBytes) {
  const size = Number(fileSizeBytes) || 0
  const modeRaw = uploadMode == null || uploadMode === "" ? NaN : Number(uploadMode)

  if (!Number.isFinite(modeRaw) || modeRaw < 1) {
    return size >= VISIT_ATTACHMENT_NORMAL_MAX_BYTES
  }
  if (modeRaw === VisitAttachmentUploadMode.Standard || modeRaw === VisitAttachmentUploadMode.Large) {
    return true
  }
  if (modeRaw === VisitAttachmentUploadMode.Normal) {
    return size >= VISIT_ATTACHMENT_NORMAL_MAX_BYTES
  }
  return size >= VISIT_ATTACHMENT_NORMAL_MAX_BYTES
}

/** @enum {number} Matches .NET VisitAttachmentStatus (list responses) */
export const VisitAttachmentStatus = {
  Pending: 0,
  Uploading: 1,
  Uploaded: 2,
  Failed: 3,
  Deleted: 4,
}

/** @deprecated Use VisitAttachmentType — kept for any legacy string imports */
export const AttachmentType = VisitAttachmentType

function visitAttachmentEndpointsReady() {
  return EP && typeof EP.INIT === "string" && EP.INIT.length > 0
}

const EXT_TO_TYPE = {
  ".dcm": VisitAttachmentType.Dicom,
  ".zip": VisitAttachmentType.Dicom,
  ".mp4": VisitAttachmentType.Video,
  ".mov": VisitAttachmentType.Video,
  ".jpg": VisitAttachmentType.Image,
  ".jpeg": VisitAttachmentType.Image,
  ".png": VisitAttachmentType.Image,
  ".pdf": VisitAttachmentType.Pdf,
}

/** @returns {number} VisitAttachmentType */
function getAttachmentTypeFromFileName(fileName) {
  const ext = (fileName || "").toLowerCase().replace(/.*\./, ".")
  return EXT_TO_TYPE[ext] ?? null
}

class VisitAttachmentsService {
  /**
   * Init upload – returns { attachmentId, sasUrl, uploadMode, blobPath, expiresOnUtc }.
   * @param {{ studyId: number, patientEnrolmentId: number, visitScheduleId: number, crfDataId?: number|null, attachmentType: number, fileName: string, contentType: string, fileSizeBytes: number }} body
   */
  async initUpload(body) {
    try {
      if (!visitAttachmentEndpointsReady()) {
        return {
          isSuccess: false,
          message:
            "Visit attachments API is not configured (missing ENDPOINTS.VISIT_ATTACHMENTS).",
          data: null,
        }
      }
      const payload = {
        studyId: body.studyId,
        patientEnrolmentId: body.patientEnrolmentId,
        visitScheduleId: body.visitScheduleId,
        crfDataId: body.crfDataId ?? null,
        attachmentType: body.attachmentType,
        fileName: body.fileName,
        contentType: body.contentType,
        fileSizeBytes: body.fileSizeBytes,
      }
      const res = await apiClient.post(EP.INIT, payload)
      if (!res.isSuccess) return { isSuccess: false, message: res.message || "Init failed", data: null }
      return { isSuccess: true, data: res.data, message: res.message }
    } catch (e) {
      logger.error("Visit attachments init failed", e)
      return { isSuccess: false, message: e.message || "Init failed", data: null }
    }
  }

  /**
   * Upload via API (≤10 MB). Avoids Azure Blob CORS from the browser.
   * onProgress: { percent, loadedBytes, totalBytes }.
   */
  async uploadViaApi(attachmentId, file, options = {}) {
    const { onProgress } = options
    if (typeof window === "undefined") return { isSuccess: false, message: "Not in browser" }
    try {
      if (!visitAttachmentEndpointsReady()) {
        return { isSuccess: false, message: "Visit attachments API is not configured." }
      }
      if (file.size > VISIT_ATTACHMENT_NORMAL_MAX_BYTES) {
        return {
          isSuccess: false,
          message: "Files over 10 MB must use direct storage upload (requires Azure CORS).",
        }
      }
      const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
      const url = `${BASE}${EP.UPLOAD(attachmentId)}`
      const formData = new FormData()
      formData.append("file", file, file.name)

      const xhr = new XMLHttpRequest()
      return await new Promise((resolve, reject) => {
        xhr.upload.addEventListener("progress", (e) => {
          if (typeof onProgress !== "function") return
          const loaded = e.loaded ?? 0
          const total = e.lengthComputable ? e.total : file.size
          onProgress({
            percent: total > 0 ? Math.round((loaded / total) * 100) : 0,
            loadedBytes: loaded,
            totalBytes: total,
          })
        })
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({ isSuccess: true })
            return
          }
          let message = `Upload failed: ${xhr.status}`
          try {
            const body = JSON.parse(xhr.responseText || "{}")
            message = body?.message || body?.Message || message
          } catch {
            if (xhr.responseText) message = xhr.responseText
          }
          if (xhr.status === 404) {
            resolve({
              isSuccess: false,
              notFound: true,
              message:
                "Server upload API is not deployed yet (404). Deploy the latest backend to UAT (POST /api/visit-attachments/{id}/upload), then retry.",
            })
            return
          }
          reject(new Error(message))
        })
        xhr.addEventListener("error", () => reject(new Error("Upload failed")))
        xhr.addEventListener("abort", () => reject(new Error("Upload aborted")))
        xhr.open("POST", url)
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`)
        xhr.send(formData)
      })
    } catch (e) {
      logger.error("Visit attachment API upload failed", e)
      return { isSuccess: false, message: e.message || "Upload failed" }
    }
  }

  /**
   * Upload file to Azure SAS URL (not the API host — CORS must be on the storage account).
   * onProgress: { percent, loadedBytes, totalBytes }.
   * useAzureSdk: true for Standard/Large tiers or big files (see preferAzureBlobSdkForVisitAttachment).
   */
  async uploadToSasUrl(sasUrl, file, options = {}) {
    const { onProgress, useAzureSdk = false, contentType: overrideContentType } = options
    const contentType = overrideContentType || file.type || "application/octet-stream"
    try {
      if (useAzureSdk) {
        const { BlockBlobClient } = await import("@azure/storage-blob")
        const blob = new BlockBlobClient(sasUrl)
        const blockSize = 8 * 1024 * 1024 // 8MB
        const concurrency = 4
        try {
          await blob.uploadBrowserData(file, {
          blockSize,
          concurrency,
          onProgress: (ev) => {
            if (typeof onProgress === "function") {
              onProgress({
                percent: Math.round((ev.loadedBytes / file.size) * 100),
                loadedBytes: ev.loadedBytes,
                totalBytes: file.size,
              })
            }
          },
          blobHTTPHeaders: { blobContentType: contentType },
        })
        } catch (sdkErr) {
          const msg = String(sdkErr?.message || sdkErr || "")
          if (/cors|failed to fetch|network/i.test(msg)) {
            throw new Error(
              "Upload blocked: Azure storage CORS is not configured for this app URL. Use files ≤10 MB (API upload) or ask DevOps to enable CORS on the storage account.",
            )
          }
          throw sdkErr
        }
        return { isSuccess: true }
      }

      const xhr = new XMLHttpRequest()
      return new Promise((resolve, reject) => {
        xhr.upload.addEventListener("progress", (e) => {
          if (typeof onProgress !== "function") return
          const loaded = e.loaded ?? 0
          // Some SAS PUT responses don't provide a computable total (`lengthComputable=false`).
          // Fall back to the local file size so we can still render real-time progress.
          const total = e.lengthComputable ? e.total : file.size
          onProgress({
            percent: total > 0 ? Math.round((loaded / total) * 100) : 0,
            loadedBytes: loaded,
            totalBytes: total,
          })
        })
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve({ isSuccess: true })
          else reject(new Error(`Upload failed: ${xhr.status}`))
        })
        xhr.addEventListener("error", () =>
          reject(
            new Error(
              "Upload blocked: Azure storage CORS is not configured for this app URL. Use files ≤10 MB (API upload) or ask DevOps to enable CORS on the storage account.",
            ),
          ),
        )
        xhr.addEventListener("abort", () => reject(new Error("Upload aborted")))
        xhr.open("PUT", sasUrl)
        xhr.setRequestHeader("x-ms-blob-type", "BlockBlob")
        xhr.setRequestHeader("Content-Type", contentType)
        if (file.size != null && Number.isFinite(file.size)) {
          xhr.setRequestHeader("Content-Length", String(file.size))
        }
        xhr.send(file)
      })
    } catch (e) {
      logger.error("Upload to SAS failed", e)
      return { isSuccess: false, message: e.message }
    }
  }

  /**
   * Complete upload after file is in blob.
   * @param {number|string} attachmentId
   * @param {{ finalFileSizeBytes?: number, checksumSha256?: string|null }} body
   */
  async completeUpload(attachmentId, body = {}) {
    try {
      if (!visitAttachmentEndpointsReady()) {
        return { isSuccess: false, message: "Visit attachments API is not configured." }
      }
      const res = await apiClient.post(EP.COMPLETE(attachmentId), body)
      return { isSuccess: res.isSuccess, message: res.message || (res.isSuccess ? "Completed" : "Complete failed") }
    } catch (e) {
      logger.error("Visit attachments complete failed", e)
      return { isSuccess: false, message: e.message || "Complete failed" }
    }
  }

  /**
   * List attachments for a visit.
   */
  async list(studyId, patientEnrolmentId, visitScheduleId) {
    try {
      if (!visitAttachmentEndpointsReady()) {
        return { isSuccess: false, data: [], message: "Visit attachments API is not configured." }
      }
      const q = new URLSearchParams({
        studyId: String(studyId),
        patientEnrolmentId: String(patientEnrolmentId),
        visitScheduleId: String(visitScheduleId),
      })
      const res = await apiClient.get(`${EP.LIST}?${q.toString()}`)
      if (!res.isSuccess) return { isSuccess: false, data: [], message: res.message }
      const raw = res.data
      const items = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : []
      return { isSuccess: true, data: items, message: res.message }
    } catch (e) {
      logger.error("Visit attachments list failed", e)
      return { isSuccess: false, data: [], message: e.message }
    }
  }

  /**
   * Download attachment – triggers browser download.
   */
  async download(attachmentId) {
    if (typeof window === "undefined") return { isSuccess: false, message: "Not in browser" }
    try {
      if (!visitAttachmentEndpointsReady()) {
        return { isSuccess: false, message: "Visit attachments API is not configured." }
      }
      const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
      const url = `${BASE}${EP.DOWNLOAD(attachmentId)}`
      const res = await fetch(url, {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) {
        const text = await res.text()
        return { isSuccess: false, message: text || `Download failed: ${res.status}` }
      }
      const blob = await res.blob()
      const disposition = res.headers.get("Content-Disposition") || ""
      const match = disposition.match(/filename="?([^";]+)"?/)
      const fileName = match ? match[1].trim() : `attachment-${attachmentId}`
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = objectUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)
      return { isSuccess: true, message: "Download started." }
    } catch (e) {
      logger.error("Visit attachment download failed", e)
      return { isSuccess: false, message: e.message || "Download failed" }
    }
  }

  /**
   * Parse API JSON error body from an XHR blob response (download failures return JSON, not a file).
   */
  async parseDownloadErrorMessage(blob, status) {
    const fallback = `Download failed: ${status}`
    if (!blob || typeof blob.text !== "function") return fallback
    try {
      const text = (await blob.text()).trim()
      if (!text) return fallback
      try {
        const json = JSON.parse(text)
        return (
          json.message ||
          json.Message ||
          (Array.isArray(json.errors) && json.errors[0]) ||
          fallback
        )
      } catch {
        return text.length < 300 ? text : fallback
      }
    } catch {
      return fallback
    }
  }

  /**
   * Download attachment with progress (XHR). Useful for global popup UI.
   * onProgress receives: { percent, loadedBytes, totalBytes }.
   */
  async downloadWithProgress(attachmentId, options = {}) {
    const { onProgress } = options
    if (typeof window === "undefined") return { isSuccess: false, message: "Not in browser" }
    try {
      if (!visitAttachmentEndpointsReady()) {
        return { isSuccess: false, message: "Visit attachments API is not configured." }
      }
      const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
      const url = `${BASE}${EP.DOWNLOAD(attachmentId)}`
      const xhr = new XMLHttpRequest()
      xhr.responseType = "blob"
      return await new Promise((resolve) => {
        xhr.addEventListener("progress", (e) => {
          if (typeof onProgress !== "function") return
          const loaded = e.loaded || 0
          // Some backends/SAS responses don't provide `e.total` as computable.
          // Fall back to Content-Length header if present so the UI can show
          // "loaded / total" just like upload.
          let total = e.lengthComputable ? e.total : 0
          if ((!total || total <= 0) && typeof xhr.getResponseHeader === "function") {
            const headerTotal = parseInt(xhr.getResponseHeader("Content-Length") || "", 10)
            if (Number.isFinite(headerTotal) && headerTotal > 0) total = headerTotal
          }
          onProgress({
            percent: total > 0 ? Math.round((loaded / total) * 100) : 0,
            loadedBytes: loaded,
            totalBytes: total,
          })
        })
        xhr.addEventListener("load", async () => {
          if (xhr.status < 200 || xhr.status >= 300) {
            const message = await this.parseDownloadErrorMessage(xhr.response, xhr.status)
            resolve({ isSuccess: false, message })
            return
          }
          const disposition = xhr.getResponseHeader("Content-Disposition") || ""
          const match = disposition.match(/filename=\"?([^\";]+)\"?/)
          const fileName = match ? match[1].trim() : `attachment-${attachmentId}`
          resolve({ isSuccess: true, blob: xhr.response, fileName })
        })
        xhr.addEventListener("error", () =>
          resolve({ isSuccess: false, message: "Download failed" })
        )
        xhr.addEventListener("abort", () =>
          resolve({ isSuccess: false, message: "Download aborted" })
        )
        xhr.open("GET", url)
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`)
        xhr.send()
      })
    } catch (e) {
      logger.error("Visit attachment downloadWithProgress failed", e)
      return { isSuccess: false, message: e.message || "Download failed" }
    }
  }

  /**
   * Delete attachment (soft-delete + blob cleanup).
   */
  async deleteAttachment(attachmentId) {
    try {
      if (!visitAttachmentEndpointsReady()) {
        return { isSuccess: false, message: "Visit attachments API is not configured." }
      }
      const res = await apiClient.delete(EP.DELETE(attachmentId))
      return { isSuccess: res.isSuccess, message: res.message || (res.isSuccess ? "Deleted" : "Delete failed") }
    } catch (e) {
      logger.error("Visit attachment delete failed", e)
      return { isSuccess: false, message: e.message || "Delete failed" }
    }
  }

  /**
   * @param {File} file
   * @param {number|null|undefined} maxBytesOverride - if provided, enforce this max size (bytes).
   * @returns {{ ok: true, attachmentType: number, contentType: string } | { ok: false, message: string }}
   */
  validateFile(file, maxBytesOverride = undefined) {
    const maxBytes =
      maxBytesOverride == null ? 2 * 1024 * 1024 * 1024 : maxBytesOverride
    if (file.size > maxBytes) {
      if (maxBytesOverride != null) {
        const mb = Math.round((maxBytesOverride / (1024 * 1024)) * 10) / 10
        return { ok: false, message: `File size must be ${mb} MB or less.` }
      }
      return { ok: false, message: "File size must be 2 GB or less." }
    }
    const attachmentType = getAttachmentTypeFromFileName(file.name)
    if (attachmentType == null) {
      return {
        ok: false,
        message:
          "File type not allowed. Use .dcm/.zip (DICOM), .mp4/.mov (video), .jpg/.jpeg/.png (image), or .pdf.",
      }
    }
    return {
      ok: true,
      attachmentType,
      contentType: file.type || "application/octet-stream",
    }
  }
}

export default new VisitAttachmentsService()
/** @returns {number|null} VisitAttachmentType or null if extension not allowed */
export function getAttachmentType(fileName) {
  return getAttachmentTypeFromFileName(fileName)
}
