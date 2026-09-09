import { NextResponse } from "next/server"

/** Require logged-in user (Bearer token from EDC login). */
export function requireBearerAuth(request) {
  const auth = request.headers.get("authorization") || ""
  if (!auth.startsWith("Bearer ") || auth.length < 20) {
    return NextResponse.json(
      { statusCode: 401, error: "Unauthorized", message: "Login required for AI features." },
      { status: 401 },
    )
  }
  return null
}
