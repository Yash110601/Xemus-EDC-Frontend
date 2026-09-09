import { NextResponse } from "next/server"
import { getNerApiBaseUrl, getServerGeminiApiKey, getServerNerApiKey } from "@/lib/server/aiEnv"
import { requireBearerAuth } from "@/lib/server/aiRouteAuth"
import { runGeminiVoiceExtract } from "@/lib/server/voiceExtractServer"

function toTatvaNerShape(fallbackBody) {
  const responseArray = Object.entries(fallbackBody.data || {}).map(([question_id, answer]) => ({
    question_id,
    answer,
  }))
  return {
    transcription: fallbackBody.transcription || "",
    answers: [{ response: responseArray }],
    source: fallbackBody.source || "gemini_voice_fallback",
  }
}

async function tryGeminiVoiceFallback(formData) {
  if (!(formData instanceof FormData)) {
    return { error: "Voice request must include multipart audio_file." }
  }
  if (!getServerGeminiApiKey()) {
    return {
      error:
        "GEMINI_API_KEY is not configured on the UAT server. Set GEMINI_API_KEY in Azure Container App pr-edc-fe-uat (same Google key as local geminiApiKey), or add GitHub secret NEXT_PUBLIC_GEMINI_API_KEY for Docker build.",
    }
  }

  const audioFile = formData.get("audio_file")
  const questionsRaw = formData.get("questions")
  if (!(audioFile instanceof Blob) || audioFile.size === 0) {
    return { error: "audio_file is missing or empty." }
  }
  if (!questionsRaw) {
    return { error: "questions JSON is missing." }
  }

  let questions
  try {
    questions = JSON.parse(String(questionsRaw))
  } catch {
    return { error: "Invalid questions JSON." }
  }

  const fallback = await runGeminiVoiceExtract(audioFile, questions)
  if (!fallback.ok || !fallback.body?.data) {
    return {
      error: fallback.body?.message || "Gemini voice fallback failed.",
    }
  }
  return { shaped: toTatvaNerShape(fallback.body) }
}

export async function POST(request) {
  const denied = requireBearerAuth(request)
  if (denied) return denied

  const contentType = request.headers.get("content-type") || ""
  const isMultipart = contentType.includes("multipart/form-data")

  let body
  if (isMultipart) {
    body = await request.formData()
  } else {
    body = await request.text()
  }

  const key = getServerNerApiKey()
  if (!key) {
    if (isMultipart) {
      const fallback = await tryGeminiVoiceFallback(body)
      if (fallback.shaped) return NextResponse.json(fallback.shaped)
      return NextResponse.json(
        { statusCode: 500, message: fallback.error || "Voice fill failed." },
        { status: 500 },
      )
    }
    return NextResponse.json(
      {
        statusCode: 500,
        message:
          "NER API key not configured. For voice, set GEMINI_API_KEY in Azure (pr-edc-fe-uat) or NER_API_KEY (Tatva EvalusApiKey). Local: lib/config/aiKeys.local.js.",
      },
      { status: 500 },
    )
  }

  const url = `${getNerApiBaseUrl()}/ner`
  const headers = { "x-api-key": key }
  if (!isMultipart) {
    headers["Content-Type"] = "application/json"
  }

  const upstream = await fetch(url, { method: "POST", headers, body })
  const raw = await upstream.text()

  if (!upstream.ok && upstream.status === 401 && isMultipart) {
    const fallback = await tryGeminiVoiceFallback(body)
    if (fallback.shaped) return NextResponse.json(fallback.shaped)
  }

  return new NextResponse(raw, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/json",
    },
  })
}
