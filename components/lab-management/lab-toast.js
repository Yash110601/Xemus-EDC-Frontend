/**
 * Lab Management — lightweight Sonner toasts (single slot replaces previous → no stacked duplicates).
 * Default ~1.5s auto-dismiss.
 */
import { toast } from "sonner"

/** Default duration (ms) */
export const LAB_TOAST_DURATION_MS = 1500

/** One visible lab toast at a time — new success/error replaces the last */
const TOAST_ID = "lab-feedback"

const base = {
  position: "top-right",
  duration: LAB_TOAST_DURATION_MS,
  id: TOAST_ID,
}

/**
 * @param {string} message
 * @param {number} [duration]
 */
export function labToastSuccess(message, duration = LAB_TOAST_DURATION_MS) {
  toast.success(message, { ...base, duration })
}

/**
 * @param {string} message
 * @param {number} [duration]
 */
export function labToastError(message, duration = LAB_TOAST_DURATION_MS) {
  toast.error(message, { ...base, duration })
}
