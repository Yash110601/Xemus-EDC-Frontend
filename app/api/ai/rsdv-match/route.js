import { NextResponse } from "next/server"
import { API_CONFIG } from "@/lib/api/config"
import { requireBearerAuth } from "@/lib/server/aiRouteAuth"

/** Proxy RSDV source-match suggest to backend; fallback empty when unavailable. */
export async function POST(request) {
  const denied = requireBearerAuth(request)
  if (denied) return denied

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ statusCode: 400, message: "Invalid JSON body." }, { status: 400 })
  }

  const auth = request.headers.get("authorization") || ""
  const url = `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.XEMUS_AI.SUGGEST_SOURCE_MATCH}`

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
    const raw = await upstream.text()
    return new NextResponse(raw, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "application/json",
      },
    })
  } catch {
    return NextResponse.json({
      isSuccess: true,
      data: {
        extractedText: "",
        matchStatus: "unclear",
        confidence: 0,
        rationale: "Backend suggest unavailable — draw region and link field manually.",
      },
      source: "frontend_fallback",
    })
  }
}
