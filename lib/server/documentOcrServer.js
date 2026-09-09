import {
  getGeminiApiBase,
  getGeminiOcrModel,
  getOcrFormFillUrl,
  getServerGeminiApiKey,
  getServerNerApiKey,
  getNerVoiceInferenceModel,
  shouldUseDirectGeminiOcrServer,
} from "@/lib/server/aiEnv"

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

function guessMimeType(file) {
  const type = String(file?.type || "").trim()
  if (type) return type
  const name = String(file?.name || "").toLowerCase()
  if (name.endsWith(".pdf")) return "application/pdf"
  if (name.endsWith(".png")) return "image/png"
  if (/\.jpe?g$/i.test(name)) return "image/jpeg"
  return "application/octet-stream"
}

async function fileToBase64(file) {
  const buf = Buffer.from(await file.arrayBuffer())
  return buf.toString("base64")
}

export async function runDirectGeminiOcr(file, questions) {
  const apiKey = getServerGeminiApiKey()
  const model = getGeminiOcrModel()
  if (!apiKey) {
    return { ok: false, status: 500, body: { message: "Gemini API key is not configured on server." } }
  }

  const mimeType = guessMimeType(file)
  const allowed = ["application/pdf", "image/png", "image/jpeg", "image/jpg"]
  if (!allowed.includes(mimeType)) {
    return { ok: false, status: 400, body: { message: "Unsupported file type. Use PDF, PNG, or JPEG." } }
  }

  const base64 = await fileToBase64(file)
  const prompt = [
    "You are a clinical form OCR assistant.",
    "Extract answers from the attached document for each question below.",
    "Return JSON only in this exact shape:",
    '{ "response": [ { "question_id": "<id>", "answer": "<value>" } ] }',
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
          parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }],
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
      payload?.error?.message || payload?.message || `Gemini OCR failed (HTTP ${res.status}).`
    return { ok: false, status: res.status, body: { message: errMsg, error: payload?.error } }
  }

  const textPart =
    payload?.candidates?.[0]?.content?.parts?.find((p) => typeof p?.text === "string")?.text ||
    payload?.candidates?.[0]?.content?.parts?.[0]?.text ||
    ""

  const parsed = parseJsonFromModelText(textPart) || payload
  return { ok: true, status: 200, body: parsed }
}

export async function runTatvaOcr(files, questions) {
  const nerKey = getServerNerApiKey()
  const formData = new FormData()
  files.forEach((file) => {
    formData.append("files", file, file.name || "uploaded_file")
  })
  formData.append("input_json", JSON.stringify(questions))
  formData.append("inference_model", getNerVoiceInferenceModel())

  const headers = {}
  if (nerKey) headers["x-api-key"] = nerKey

  const res = await fetch(getOcrFormFillUrl(), { method: "POST", headers, body: formData })
  const raw = await res.text()
  let body = null
  try {
    body = raw ? JSON.parse(raw) : null
  } catch {
    body = { message: raw }
  }

  return { ok: res.ok, status: res.status, body }
}

export async function runDocumentOcr(files, questions) {
  if (shouldUseDirectGeminiOcrServer() && files.length > 0) {
    return runDirectGeminiOcr(files[0], questions)
  }
  return runTatvaOcr(files, questions)
}
