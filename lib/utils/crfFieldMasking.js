import { normalizeBoolForDesigner } from "@/lib/utils/crfDesignerConfigFromApi"

const MASK_PLACEHOLDER = "••••"
const SERVER_MASK_MARKERS = new Set(["***", "••••", "****"])

export function isServerMaskedValue(value) {
  if (value == null) return false
  const text = String(value).trim()
  return SERVER_MASK_MARKERS.has(text)
}

export function isControlMaskSensitive(control) {
  if (!control || typeof control !== "object") return false
  const props = control.properties ?? control.Properties ?? {}
  return (
    normalizeBoolForDesigner(props.maskSensitive ?? props.MaskSensitive) ||
    normalizeBoolForDesigner(props.dataMasking ?? props.DataMasking) ||
    normalizeBoolForDesigner(props.isMasked ?? props.IsMasked)
  )
}

/**
 * @param {unknown} value
 * @param {{ canViewMasked?: boolean, control?: object|null }} [options]
 */
export function formatCrfMaskedDisplayValue(value, options = {}) {
  const { canViewMasked = true, control = null } = options

  if (isServerMaskedValue(value)) {
    return canViewMasked ? value : MASK_PLACEHOLDER
  }

  if (canViewMasked || !isControlMaskSensitive(control)) {
    return value
  }
  if (value == null) return value
  const text = String(value).trim()
  if (!text) return value
  return MASK_PLACEHOLDER
}

export function maskLabelIfNeeded(label, control, canViewMasked) {
  if (canViewMasked || !isControlMaskSensitive(control)) return label
  return `${label || "Field"} (masked)`
}
