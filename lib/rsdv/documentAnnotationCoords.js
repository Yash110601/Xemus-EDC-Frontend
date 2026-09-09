/** Minimum normalized region size (fraction of page dimension). Matches backend validation. */
export const MIN_REGION_FRACTION = 0.005

/** Minimum drag distance in pixels before a region is accepted. */
export const MIN_DRAG_PX = 24

/**
 * Convert pointer rectangle (px) to normalized 0–1 coordinates relative to content box.
 */
export function pixelRectToNormalized({ left, top, width, height, contentWidth, contentHeight }) {
  if (!contentWidth || !contentHeight) return null
  const w = Math.max(width, MIN_DRAG_PX)
  const h = Math.max(height, MIN_DRAG_PX)
  let x = left
  let y = top
  if (x + w > contentWidth) x = Math.max(0, contentWidth - w)
  if (y + h > contentHeight) y = Math.max(0, contentHeight - h)

  const xPct = clamp01(x / contentWidth)
  const yPct = clamp01(y / contentHeight)
  const widthPct = clamp01(w / contentWidth)
  const heightPct = clamp01(h / contentHeight)

  if (widthPct < MIN_REGION_FRACTION || heightPct < MIN_REGION_FRACTION) return null
  if (xPct + widthPct > 1.000001 || yPct + heightPct > 1.000001) return null

  return { xPct, yPct, widthPct, heightPct }
}

/** Normalized coords → pixel rect for overlay rendering. */
export function normalizedToPixelRect({ xPct, yPct, widthPct, heightPct, contentWidth, contentHeight }) {
  return {
    left: xPct * contentWidth,
    top: yPct * contentHeight,
    width: widthPct * contentWidth,
    height: heightPct * contentHeight,
  }
}

export function clamp01(value) {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

export function statusBorderClass(status, isOrphaned) {
  if (isOrphaned) return "border-dashed border-slate-400 bg-slate-400/10"
  if (String(status).toLowerCase() === "resolved") return "border-emerald-500 bg-emerald-500/15"
  return "border-amber-500 bg-amber-500/15"
}

export function statusLabel(status, isOrphaned) {
  if (isOrphaned) return "Stale (document replaced)"
  if (String(status).toLowerCase() === "resolved") return "Resolved"
  return "Open"
}
