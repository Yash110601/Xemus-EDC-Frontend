/**
 * Server-side AI env (runtime — Azure Container App / local aiKeys.local.js).
 * Priority: aiKeys.local.js (gitignored) → NER_API_KEY / GEMINI_API_KEY → NEXT_PUBLIC_* fallback.
 */

import { loadLocalAiKeys, pickLocalKey } from "../config/loadLocalAiKeys.js"

function localAiKeys() {
  return loadLocalAiKeys()
}

/** Tatva NER x-api-key only — Google AQ./AIza keys belong in GEMINI_API_KEY, not here. */
function isGoogleAiKey(value) {
  const key = String(value || "").trim()
  return key.startsWith("AQ.") || key.startsWith("AIza")
}

export function getServerNerApiKey() {
  const local = localAiKeys()
  const raw = String(
    pickLocalKey(local, "nerApiKey") ||
      process.env.NER_API_KEY ||
      process.env.NEXT_PUBLIC_NER_API_KEY ||
      "",
  ).trim()
  if (isGoogleAiKey(raw)) return ""
  return raw
}

export function getServerGeminiApiKey() {
  const local = localAiKeys()
  return String(
    pickLocalKey(local, "geminiApiKey") ||
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      "",
  ).trim()
}

export function getGcpProjectId() {
  const local = localAiKeys()
  return String(pickLocalKey(local, "gcpProjectId") || process.env.GCP_PROJECT_ID || "").trim()
}

export function getNerApiBaseUrl() {
  return (
    process.env.NER_API_URL ||
    process.env.NEXT_PUBLIC_NER_API_URL ||
    "https://pm-tatva-agents-uat.tatvacare.in/api/v1/evalus"
  ).replace(/\/$/, "")
}

export function getOcrFormFillUrl() {
  return (
    process.env.OCR_FORM_FILL_URL ||
    process.env.NEXT_PUBLIC_OCR_FORM_FILL_URL ||
    "https://pm-rx-digitization-gpt-uat.tatvacare.in/ocr_form_fill_gemini"
  )
}

export function getGeminiOcrModel() {
  return String(
    process.env.GEMINI_OCR_MODEL ||
      process.env.NEXT_PUBLIC_GEMINI_OCR_MODEL ||
      "gemini-3.1-flash-lite",
  ).trim()
}

export function getGeminiApiBase() {
  return (
    process.env.GEMINI_API_BASE ||
    process.env.NEXT_PUBLIC_GEMINI_API_BASE ||
    "https://generativelanguage.googleapis.com/v1beta"
  ).replace(/\/$/, "")
}

export function shouldUseDirectGeminiOcrServer() {
  const key = getServerGeminiApiKey()
  if (!key) return false
  const flag = process.env.USE_DIRECT_GEMINI_OCR ?? process.env.NEXT_PUBLIC_USE_DIRECT_GEMINI_OCR
  if (flag === "false") return false
  return flag === "true" || key.startsWith("AIza") || key.startsWith("AQ.")
}

export function getNerVoiceTranscriptionModel() {
  return (
    process.env.NER_VOICE_TRANSCRIPTION_MODEL ||
    process.env.NEXT_PUBLIC_NER_VOICE_TRANSCRIPTION_MODEL ||
    "azure_openai"
  )
}

export function getNerVoiceInferenceModel() {
  return (
    process.env.NER_VOICE_INFERENCE_MODEL ||
    process.env.NEXT_PUBLIC_NER_VOICE_INFERENCE_MODEL ||
    "azure_openai"
  )
}
