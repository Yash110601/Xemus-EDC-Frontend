/**
 * Capture AI facade — inference via gemini.service; governed audit via xemusAi.service.
 */

import geminiService from "@/lib/services/gemini.service"
import xemusAiService from "@/lib/services/xemusAi.service"

export async function runCaptureInferenceFromAudio(audioBlob, questions, options = {}) {
  return geminiService.extractFormDataFromAudioBlob(audioBlob, questions, options)
}

export async function runCaptureInferenceFromFile(file, questions, options = {}) {
  return geminiService.extractFormDataFromFile(file, questions, options)
}

export async function runCaptureInferenceFromTranscript(transcript, questions) {
  return geminiService.extractFormDataFromTranscript(transcript, questions)
}

/** Record human accept/reject; returns suggestion log id for form save provenance. */
export async function recordCaptureReview({
  studyId,
  fieldId,
  accepted,
  confidence,
  entityId,
  requestJson,
}) {
  const res = await xemusAiService.recordCaptureAcceptance({
    studyId,
    fieldId,
    accepted,
    confidence,
    entityId,
    requestJson,
  })
  return res?.data?.id ?? res?.data?.Id ?? null
}

export { geminiService, xemusAiService }
