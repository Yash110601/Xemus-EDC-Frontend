import { getGeminiApiBase, getGeminiOcrModel, getServerGeminiApiKey } from "@/lib/server/aiEnv"

function parseJsonFromModelText(text) {
  if (!text || typeof text !== "string") return null
  const trimmed = text.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fence ? fence[1].trim() : trimmed
  try {
    return JSON.parse(candidate)
  } catch {
    return null
  }
}

function normalizeVoiceResponse(parsed) {
  const arr = Array.isArray(parsed?.response)
    ? parsed.response
    : Array.isArray(parsed?.answers?.[0]?.response)
      ? parsed.answers[0].response
      : null
  if (!arr?.length) return null
  const out = {}
  for (const item of arr) {
    const id = item?.question_id
    const answer = item?.answer
    if (id !== undefined && id !== null && answer !== undefined && answer !== null) {
      out[String(id)] = typeof answer === "string" ? answer : String(answer)
    }
  }
  return Object.keys(out).length ? out : null
}

/**
 * Voice → form fields via Gemini (fallback when Tatva NER key is invalid).
 * Uses the same geminiApiKey as document upload.
 */
export async function runGeminiVoiceExtract(audioBlob, questions) {
  const apiKey = getServerGeminiApiKey()
  const model = getGeminiOcrModel()
  if (!apiKey) {
    return { ok: false, status: 500, body: { message: "Gemini API key is not configured for voice fallback." } }
  }

  const mimeType = String(audioBlob?.type || "audio/webm").trim() || "audio/webm"
  const buf = Buffer.from(await audioBlob.arrayBuffer())
  const base64 = buf.toString("base64")

  const prompt = [
    "You are a clinical form voice assistant.",
    "Listen to the audio, transcribe what the user said, and extract answers for each question below.",
    "Return JSON only:",
    '{ "transcription": "<full transcript>", "response": [ { "question_id": "<id>", "answer": "<value>" } ] }',
    "Use empty string for missing answers. Do not invent data.",
    "Questions:",
    JSON.stringify(questions),
  ].join("\n")

  const url = `${getGeminiApiBase()}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        },
      ],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
    }),
  })

  const raw = await res.text()
  let payload = null
  try {
    payload = raw ? JSON.parse(raw) : null
  } catch {
    payload = { message: raw }
  }

  if (!res.ok) {
    const errMsg =
      payload?.error?.message || payload?.message || `Gemini voice extract failed (HTTP ${res.status}).`
    return { ok: false, status: res.status, body: { message: errMsg } }
  }

  const textPart =
    payload?.candidates?.[0]?.content?.parts?.find((p) => typeof p?.text === "string")?.text ||
    payload?.candidates?.[0]?.content?.parts?.[0]?.text ||
    ""

  const parsed = parseJsonFromModelText(textPart) || payload
  const data = normalizeVoiceResponse(parsed)
  if (!data) {
    return { ok: false, status: 422, body: { message: "Gemini voice response format was invalid." } }
  }

  return {
    ok: true,
    status: 200,
    body: {
      transcription: parsed?.transcription || "",
      data,
      source: "gemini_voice_fallback",
    },
  }
}
