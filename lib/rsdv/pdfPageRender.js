/** Available width for PDF fit (parent scroll area, not the canvas wrapper). */
export function getPdfContainerWidth(wrapElement) {
  if (!wrapElement) return 800
  const parent = wrapElement.parentElement
  const width = parent?.clientWidth ?? wrapElement.clientWidth ?? 0
  return width > 0 ? width : 800
}

/** Fit-to-width scale with optional zoom multiplier. */
export function computePdfDisplayScale(pageWidthAtScale1, containerWidth, zoom = 1) {
  if (!pageWidthAtScale1 || !containerWidth) return 1
  const fitScale = containerWidth / pageWidthAtScale1
  return Math.min(3, Math.max(0.75, fitScale * zoom))
}

/**
 * Render a PDF.js page to canvas at sharp DPI (devicePixelRatio-aware).
 * Returns CSS layout dimensions used for annotation overlays.
 */
export async function renderPdfPageToCanvas(page, canvas, { containerWidth, zoom = 1 } = {}) {
  if (!page || !canvas) return { width: 0, height: 0 }

  const unscaled = page.getViewport({ scale: 1 })
  const displayScale = computePdfDisplayScale(unscaled.width, containerWidth, zoom)
  const viewport = page.getViewport({ scale: displayScale })
  const outputScale = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1

  const layoutWidth = Math.floor(viewport.width)
  const layoutHeight = Math.floor(viewport.height)

  canvas.width = Math.floor(viewport.width * outputScale)
  canvas.height = Math.floor(viewport.height * outputScale)
  canvas.style.width = `${layoutWidth}px`
  canvas.style.height = `${layoutHeight}px`

  const ctx = canvas.getContext("2d")
  if (!ctx) return { width: layoutWidth, height: layoutHeight }

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null

  await page.render({
    canvasContext: ctx,
    viewport,
    transform,
  }).promise

  return { width: layoutWidth, height: layoutHeight }
}
