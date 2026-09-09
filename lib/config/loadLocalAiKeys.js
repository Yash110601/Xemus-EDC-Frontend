import { createRequire } from "module"
import { fileURLToPath } from "url"
import path from "path"

const require = createRequire(fileURLToPath(import.meta.url))

let cached = undefined

/**
 * Optional gitignored module: lib/config/aiKeys.local.js
 * @returns {{ nerApiKey?: string, geminiApiKey?: string, gcpProjectId?: string } | null}
 */
export function loadLocalAiKeys() {
  if (cached !== undefined) return cached
  try {
    const mod = require("./aiKeys.local.js")
    const keys = mod?.AI_KEYS ?? mod?.default?.AI_KEYS ?? mod?.default ?? null
    cached = keys && typeof keys === "object" ? keys : null
  } catch {
    cached = null
  }
  return cached
}

export function pickLocalKey(keys, field) {
  const value = keys?.[field]
  return typeof value === "string" ? value.trim() : ""
}
