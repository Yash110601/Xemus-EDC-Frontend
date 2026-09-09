/**
 * Local AI keys — copy this file to aiKeys.local.js (gitignored) and fill values.
 * Used by lib/server/aiEnv.js when env vars are not set.
 *
 *   cp lib/config/aiKeys.local.example.js lib/config/aiKeys.local.js
 *
 * Never commit aiKeys.local.js.
 */
export const AI_KEYS = {
  /**
   * Tatva EvalusApiKey for voice/NER only (x-api-key on pm-tatva-agents-uat…/ner).
   * NOT the Google AQ.* key — ask Tatva/backend for UAT EvalusApiKey.
   */
  nerApiKey: "",
  /**
   * Google Gemini key (AQ.* or AIza*) — document upload OCR and voice fallback when NER key is wrong/missing.
   */
  geminiApiKey: "",
  /** Optional GCP project id (e.g. 95697001496) */
  gcpProjectId: "",
}
