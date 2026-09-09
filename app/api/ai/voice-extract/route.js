import { NextResponse } from "next/server"
import { requireBearerAuth } from "@/lib/server/aiRouteAuth"
import { runGeminiVoiceExtract } from "@/lib/server/voiceExtractServer"

export async function POST(request) {
  const denied = requireBearerAuth(request)
  if (denied) return denied

  const formData = await request.formData()
  const questionsRaw = formData.get("questions")
  if (!questionsRaw) {
    return NextResponse.json({ message: "questions JSON is required." }, { status: 400 })
  }

  let questions
  try {
    questions = JSON.parse(String(questionsRaw))
  } catch {
    return NextResponse.json({ message: "Invalid questions JSON." }, { status: 400 })
  }

  const audioFile = formData.get("audio_file")
  if (!(audioFile instanceof Blob) || audioFile.size === 0) {
    return NextResponse.json({ message: "audio_file is required." }, { status: 400 })
  }

  const result = await runGeminiVoiceExtract(audioFile, questions)
  return NextResponse.json(result.body ?? {}, { status: result.ok ? 200 : result.status || 500 })
}
