"use client"

import { create } from "zustand"

/**
 * Phase 3c-2 — Thin per-slice store (smallest slice first: validation errors).
 * Parent `ECRFDataEntryPage` remains source of truth during migration; this store
 * mirrors `validationErrors` so future `ControlRow` subscribers can read one field
 * without re-rendering the god-component.
 */
export const useEcrfEntryStore = create((set) => ({
  validationErrors: {},
  validationErrorsSig: "",
  setValidationErrors: (validationErrors) =>
    set({
      validationErrors: validationErrors || {},
      validationErrorsSig: stableValidationSig(validationErrors),
    }),
}))

function stableValidationSig(slice) {
  if (slice == null) return "null"
  if (typeof slice !== "object") {
    try {
      return JSON.stringify(slice)
    } catch {
      return ""
    }
  }
  try {
    const keys = Object.keys(slice).sort()
    const norm = {}
    keys.forEach((k) => {
      norm[k] = slice[k]
    })
    return JSON.stringify(norm)
  } catch {
    return ""
  }
}
