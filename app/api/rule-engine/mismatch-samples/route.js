import { NextResponse } from "next/server"
import { mkdir, appendFile } from "node:fs/promises"
import path from "node:path"

const MAX_BODY_BYTES = 2_000_000

export async function POST(request) {
  try {
    const raw = await request.text()
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: "Payload too large" }, { status: 413 })
    }
    let body
    try {
      body = JSON.parse(raw)
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
    }

    const dir = path.join(process.cwd(), ".data", "rule-mismatch")
    await mkdir(dir, { recursive: true })
    const file = path.join(dir, `samples-${new Date().toISOString().slice(0, 10)}.ndjson`)
    await appendFile(file, `${JSON.stringify(body)}\n`, "utf8")

    return NextResponse.json({ ok: true, stored: file })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 }
    )
  }
}
