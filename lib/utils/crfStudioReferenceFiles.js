/** Matches backend AppConstants.CrfStudioReferenceFileExtensions */
export const CRF_STUDIO_REFERENCE_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".tif",
  ".tiff",
  ".bmp",
  ".mp4",
  ".mov",
  ".dcm",
  ".zip",
]

export const CRF_STUDIO_REFERENCE_ACCEPT = [
  ...CRF_STUDIO_REFERENCE_EXTENSIONS,
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/*",
  "video/mp4",
  "video/quicktime",
].join(",")

export function isAllowedCrfStudioReferenceFile(file) {
  if (!file?.name) return false
  const ext = String(file.name).toLowerCase().match(/\.[^.]+$/)?.[0] ?? ""
  return CRF_STUDIO_REFERENCE_EXTENSIONS.includes(ext)
}

export const CRF_STUDIO_REFERENCE_FILE_HINT =
  "PDF, Word, images (JPG/PNG), video (MP4/MOV), or DICOM (.dcm/.zip)"
