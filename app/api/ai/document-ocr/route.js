import { NextResponse } from "next/server"
import { runDocumentOcr } from "@/lib/server/documentOcrServer"
import { requireBearerAuth } from "@/lib/server/aiRouteAuth"

export async function POST(request) {
  const denied = requireBearerAuth(request)
  if (denied) return denied

  const formData = await request.formData()
  const questionsRaw = formData.get("questions") || formData.get("input_json")
  if (!questionsRaw) {
    return NextResponse.json({ message: "questions JSON is required." }, { status: 400 })
  }

  let questions
  try {
    questions = JSON.parse(String(questionsRaw))
  } catch {
    return NextResponse.json({ message: "Invalid questions JSON." }, { status: 400 })
  }

  const files = []
  for (const [key, value] of formData.entries()) {
    if (key === "questions" || key === "input_json" || key === "inference_model") continue
    if (value instanceof Blob && value.size > 0) {
      files.push(value)
    }
  }

  if (!files.length) {
    return NextResponse.json({ message: "No file(s) provided." }, { status: 400 })
  }

  const result = await runDocumentOcr(files, questions)
  return NextResponse.json(result.body ?? {}, { status: result.ok ? 200 : result.status || 500 })
}
