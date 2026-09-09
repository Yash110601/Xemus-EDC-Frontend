import { NextResponse } from "next/server"
import { getNerApiBaseUrl, getServerNerApiKey } from "@/lib/server/aiEnv"
import { requireBearerAuth } from "@/lib/server/aiRouteAuth"

export async function GET(request) {
  const denied = requireBearerAuth(request)
  if (denied) return denied

  const key = getServerNerApiKey()
  if (!key) {
    return NextResponse.json(
      {
        message:
          "NER API key not configured. Local: lib/config/aiKeys.local.js. UAT: NER_API_KEY in Azure.",
      },
      { status: 500 },
    )
  }

  const studyId = request.nextUrl.searchParams.get("study_id") || ""
  const trimmed = String(studyId).replace(/\s+/g, "")
  if (!trimmed) {
    return NextResponse.json({ message: "study_id is required." }, { status: 400 })
  }

  const url = `${getNerApiBaseUrl()}/form-schema?study_id=${encodeURIComponent(trimmed)}`
  const upstream = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
    },
  })

  const raw = await upstream.text()
  return new NextResponse(raw, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/json",
    },
  })
}
