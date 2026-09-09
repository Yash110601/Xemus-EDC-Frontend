import { NextResponse } from "next/server"
import { API_CONFIG } from "@/lib/api/config"
import { requireBearerAuth } from "@/lib/server/aiRouteAuth"

/** Optional proxy for CRF Studio extraction orchestration. */
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
  const projectId = body?.projectId ?? body?.ProjectId
  const studyId = body?.studyId ?? body?.StudyId
  if (!projectId || !studyId) {
    return NextResponse.json(
      { statusCode: 400, message: "projectId and studyId are required." },
      { status: 400 },
    )
  }

  const url = `${API_CONFIG.BASE_URL}/CrfStudio/projects/${projectId}/extract?studyId=${studyId}`

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
  } catch (error) {
    return NextResponse.json(
      { statusCode: 500, message: error?.message || "Studio extraction proxy failed." },
      { status: 500 },
    )
  }
}
