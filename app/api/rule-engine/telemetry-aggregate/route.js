import { NextResponse } from "next/server"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const MAX_BODY_BYTES = 1_000_000
const STORE = path.join(process.cwd(), ".data", "rule-telemetry", "aggregate.json")

function mergeAggregate(prev, incoming) {
  const base =
    prev && typeof prev === "object"
      ? prev
      : {
          version: 1,
          batches: 0,
          lastReceivedAt: null,
          studyIds: {},
          formIds: {},
        }
  const next = {
    ...base,
    batches: Number(base.batches || 0) + 1,
    lastReceivedAt: incoming?.receivedAt || new Date().toISOString(),
  }
  const studyId = incoming?.studyId != null ? String(incoming.studyId) : "unknown"
  const formId = incoming?.formId != null ? String(incoming.formId) : "unknown"
  next.studyIds = { ...(next.studyIds || {}) }
  next.formIds = { ...(next.formIds || {}) }
  next.studyIds[studyId] = Number(next.studyIds[studyId] || 0) + 1
  next.formIds[formId] = Number(next.formIds[formId] || 0) + 1
  if (Array.isArray(incoming?.stageSamples?.evaluate)) {
    next.lastEvaluateSamples = incoming.stageSamples.evaluate.slice(-50)
  }
  if (incoming?.parity && typeof incoming.parity === "object") {
    next.lastParitySummary = {
      mismatchCount: incoming.parity.mismatchCount ?? incoming.parity.mismatches?.length,
      generatedAt: incoming.receivedAt,
    }
  }
  return next
}

export async function POST(request) {
  try {
    const raw = await request.text()
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, error: "Payload too large" }, { status: 413 })
    }
    let incoming
    try {
      incoming = JSON.parse(raw)
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 })
    }

    const dir = path.dirname(STORE)
    await mkdir(dir, { recursive: true })
    let prev = {}
    try {
      prev = JSON.parse(await readFile(STORE, "utf8"))
    } catch {
      prev = {}
    }
    const merged = mergeAggregate(prev, incoming)
    await writeFile(STORE, JSON.stringify(merged, null, 2), "utf8")

    return NextResponse.json({ ok: true, aggregate: merged })
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 }
    )
  }
}
