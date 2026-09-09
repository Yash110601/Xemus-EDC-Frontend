/**
 * Build a ZIP of visit attachments, including only files up to maxBytesPerFile (default 10 MB).
 * Larger files are skipped so browser memory stays bounded.
 */

import JSZip from "jszip"
import visitAttachmentsService from "@/lib/services/visitAttachments.service"

/** Per-file limit for browser ZIP (bytes). */
export const VISIT_ATTACHMENT_ZIP_MAX_FILE_BYTES = 10 * 1024 * 1024

function idOf(att) {
  return att.attachmentId ?? att.id ?? att.guid
}

function sizeOf(att) {
  const n = att.fileSizeBytes ?? att.fileSize ?? att.FileSizeBytes
  if (n == null) return null
  const v = typeof n === "number" ? n : parseInt(String(n), 10)
  return Number.isFinite(v) ? v : null
}

function nameOf(att) {
  return att.originalFileName || att.fileName || att.name || `attachment-${idOf(att)}`
}

function hasFileExtension(fileName) {
  const s = String(fileName ?? "")
  return /\.[a-zA-Z0-9]{1,10}$/.test(s.trim())
}

function extensionFromContentType(contentType) {
  const ct = String(contentType ?? "").toLowerCase()
  if (!ct) return null
  if (ct.includes("pdf")) return "pdf"
  if (ct.includes("zip")) return "zip"
  if (ct.includes("mp4")) return "mp4"
  if (ct.includes("quicktime") || ct.includes("mov")) return "mov"
  if (ct.includes("jpeg")) return "jpg"
  if (ct.includes("jpg")) return "jpg"
  if (ct.includes("png")) return "png"
  if (ct.includes("image/")) {
    const sub = ct.split("image/")[1]?.trim()
    if (sub) return sub.replace(/[^a-z0-9]/gi, "")
  }
  return null
}

function extensionFromAttachmentDto(att) {
  // attachmentType: 1 Dicom, 2 Video, 3 Image, 4 Pdf (per backend spec)
  const type = att?.attachmentType ?? att?.AttachmentType
  const ct = att?.contentType ?? att?.ContentType

  const fromMime = extensionFromContentType(ct)
  if (fromMime) return fromMime

  if (type === 4) return "pdf"
  if (type === 2) return "mp4"
  if (type === 3) return "png"
  if (type === 1) {
    // DICOM sometimes arrives as .dcm and sometimes as zipped .zip
    return ct && String(ct).toLowerCase().includes("zip") ? "zip" : "dcm"
  }

  return null
}

/** Uploaded = 2 per VisitAttachmentStatus; allow missing status (treat as ready). */
function isUploaded(att) {
  const s = att.status ?? att.Status
  if (s == null) return true
  return s === 2 || s === "Uploaded"
}

function sanitizeEntryName(name, id) {
  const base = String(name || "file")
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120)
  return base || `file-${id}`
}

/**
 * @param {object[]} attachments - rows from visitAttachmentsService.list
 * @param {{ maxBytesPerFile?: number, onProgress?: (done: number, total: number) => void }} options
 * @returns {Promise<{ ok: true, blob: Blob, fileName: string, included: string[], skipped: object[] } | { ok: false, message: string, skipped?: object[] }>}
 */
export async function zipVisitAttachmentsUnderSize(attachments, options = {}) {
  const maxBytes = options.maxBytesPerFile ?? VISIT_ATTACHMENT_ZIP_MAX_FILE_BYTES
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return { ok: false, message: "No attachments to download." }
  }

  /** Skipped up-front (too large, not ready) — merged into final result for toasts */
  const skippedPre = []
  const candidates = attachments.filter((att) => {
    const id = idOf(att)
    if (!id) return false
    if (!isUploaded(att)) {
      skippedPre.push({ id: idOf(att), name: nameOf(att), reason: "not uploaded yet" })
      return false
    }
    const sz = sizeOf(att)
    if (sz != null && sz > maxBytes) {
      skippedPre.push({ id, name: nameOf(att), reason: "over 10 MB" })
      return false
    }
    return true
  })

  if (candidates.length === 0) {
    return {
      ok: false,
      message: "No attachments under 10 MB (or still uploading). Download larger files one by one.",
      skipped: skippedPre.length > 0 ? skippedPre : [],
    }
  }

  const zip = new JSZip()
  const usedNames = new Set()
  const included = []
  const skipped = []
  const total = candidates.length
  let done = 0

  for (const att of candidates) {
    const id = idOf(att)
    const declared = sizeOf(att)
    if (declared != null && declared > maxBytes) {
      skipped.push({ id, name: nameOf(att), reason: "over 10 MB" })
      continue
    }

    let res
    try {
      res = await visitAttachmentsService.downloadWithProgress(id)
    } catch {
      skipped.push({ id, name: nameOf(att), reason: "download error" })
      done += 1
      options.onProgress?.(done, total)
      continue
    }

    if (!res?.isSuccess || !res.blob) {
      skipped.push({ id, name: nameOf(att), reason: "download failed" })
      done += 1
      options.onProgress?.(done, total)
      continue
    }

    if (res.blob.size > maxBytes) {
      skipped.push({ id, name: nameOf(att), reason: "over 10 MB" })
      done += 1
      options.onProgress?.(done, total)
      continue
    }

    // Always prefer the original filename coming from the list DTO.
    // If it's missing an extension, append one using contentType/attachmentType.
    let rawName = nameOf(att)
    if (!hasFileExtension(rawName)) {
      const ext = extensionFromAttachmentDto(att)
      if (ext) rawName = `${rawName}.${ext}`
    }
    let entry = sanitizeEntryName(rawName, id)
    if (usedNames.has(entry)) {
      const dot = entry.lastIndexOf(".")
      const stem = dot > 0 ? entry.slice(0, dot) : entry
      const ext = dot > 0 ? entry.slice(dot) : ""
      entry = `${stem}_${id}${ext}`
    }
    usedNames.add(entry)
    zip.file(entry, res.blob)
    included.push(entry)
    done += 1
    options.onProgress?.(done, total)
  }

  if (included.length === 0) {
    return {
      ok: false,
      message: "Could not add any files to the ZIP. Try downloading individual files.",
      skipped: [...skippedPre, ...skipped],
    }
  }

  const blob = await zip.generateAsync({ type: "blob" })
  const stamp = new Date().toISOString().slice(0, 10)
  return {
    ok: true,
    blob,
    fileName: `visit-attachments-${stamp}.zip`,
    included,
    skipped: [...skippedPre, ...skipped],
  }
}

export function triggerZipDownload(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
