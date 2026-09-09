/**
 * Crop a region from a canvas or image element and return base64 JPEG (no data-URL prefix).
 * @param {HTMLCanvasElement | HTMLImageElement} element
 * @param {{ x: number, y: number, width: number, height: number }} pixelRect
 */
export function cropElementRegionToBase64(element, pixelRect, mimeType = "image/jpeg", quality = 0.92) {
  if (!element || !pixelRect) return null

  const sx = Math.max(0, Math.round(pixelRect.x ?? 0))
  const sy = Math.max(0, Math.round(pixelRect.y ?? 0))
  const sw = Math.max(1, Math.round(pixelRect.width ?? 1))
  const sh = Math.max(1, Math.round(pixelRect.height ?? 1))

  const canvas = document.createElement("canvas")
  canvas.width = sw
  canvas.height = sh
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  ctx.drawImage(element, sx, sy, sw, sh, 0, 0, sw, sh)
  const dataUrl = canvas.toDataURL(mimeType, quality)
  const comma = dataUrl.indexOf(",")
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
}
