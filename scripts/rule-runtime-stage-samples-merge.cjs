/* eslint-disable no-console */
"use strict"

const fs = require("fs")
const path = require("path")

function parseJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8")
  const parsed = JSON.parse(raw)
  return parsed?.stageSamples || parsed || {}
}

function normalizeEntries(arr, sourceFile) {
  if (!Array.isArray(arr)) return []
  return arr
    .map((entry) => {
      if (typeof entry === "number") {
        return {
          durationMs: Number(entry),
          sourceFile,
        }
      }
      if (entry && typeof entry === "object" && Number.isFinite(Number(entry.durationMs))) {
        return {
          ...entry,
          durationMs: Number(entry.durationMs),
          sourceFile,
        }
      }
      return null
    })
    .filter((v) => v && Number.isFinite(v.durationMs) && v.durationMs >= 0)
}

function quantile(sortedValues, q) {
  if (!Array.isArray(sortedValues) || sortedValues.length === 0) return 0
  const idx = Math.min(sortedValues.length - 1, Math.max(0, Math.floor(sortedValues.length * q)))
  return sortedValues[idx]
}

function summarizeDurations(durations) {
  if (!Array.isArray(durations) || durations.length === 0) {
    return { count: 0, avgMs: 0, p50Ms: 0, p95Ms: 0, maxMs: 0 }
  }
  const sorted = [...durations].sort((a, b) => a - b)
  const avg = sorted.reduce((sum, n) => sum + n, 0) / sorted.length
  return {
    count: sorted.length,
    avgMs: Number(avg.toFixed(2)),
    p50Ms: Number(quantile(sorted, 0.5).toFixed(2)),
    p95Ms: Number(quantile(sorted, 0.95).toFixed(2)),
    maxMs: Number(sorted[sorted.length - 1].toFixed(2)),
  }
}

function walkJsonFiles(dirPath, out = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  entries.forEach((entry) => {
    const full = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      walkJsonFiles(full, out)
      return
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) {
      out.push(full)
    }
  })
  return out
}

function collectInputFiles(argv) {
  const files = []
  const inputDir = String(process.env.RULE_STAGE_SAMPLES_DIR || "").trim()
  if (inputDir) {
    const resolvedDir = path.resolve(process.cwd(), inputDir)
    if (!fs.existsSync(resolvedDir)) {
      console.error(`[stage-merge] Missing directory: ${resolvedDir}`)
      process.exit(1)
    }
    if (!fs.statSync(resolvedDir).isDirectory()) {
      console.error(`[stage-merge] Not a directory: ${resolvedDir}`)
      process.exit(1)
    }
    walkJsonFiles(resolvedDir, files)
  }
  argv.forEach((arg) => {
    const value = String(arg || "").trim()
    if (!value) return
    if (value.includes("*")) {
      console.error(`[stage-merge] Wildcards are not supported: ${value}`)
      process.exit(1)
    }
    files.push(path.resolve(process.cwd(), value))
  })
  if (files.length === 0) {
    console.error("[stage-merge] Provide input files or set RULE_STAGE_SAMPLES_DIR.")
    process.exit(1)
  }
  const deduped = [...new Set(files)]
  deduped.forEach((filePath) => {
    if (!fs.existsSync(filePath)) {
      console.error(`[stage-merge] Missing file: ${filePath}`)
      process.exit(1)
    }
  })
  return deduped
}

function buildBreakdown(stageSamples) {
  const grouped = new Map()
  ;["evaluate", "apply", "render"].forEach((stage) => {
    const entries = Array.isArray(stageSamples?.[stage]) ? stageSamples[stage] : []
    entries.forEach((entry) => {
      const formId = entry?.formId == null ? "unknown_form" : String(entry.formId)
      const studyId = entry?.studyId == null ? "unknown_study" : String(entry.studyId)
      const key = `${studyId}::${formId}`
      if (!grouped.has(key)) {
        grouped.set(key, {
          studyId,
          formId,
          stages: { evaluate: [], apply: [], render: [] },
        })
      }
      grouped.get(key).stages[stage].push(Number(entry?.durationMs || 0))
    })
  })
  return [...grouped.values()].map((row) => ({
    studyId: row.studyId,
    formId: row.formId,
    evaluate: summarizeDurations(row.stages.evaluate),
    apply: summarizeDurations(row.stages.apply),
    render: summarizeDurations(row.stages.render),
  }))
}

function main() {
  const outPath = path.resolve(
    process.cwd(),
    process.env.RULE_STAGE_SAMPLES_MERGE_OUT || "scripts/rule-runtime-stage-samples.merged.json"
  )
  const inputFiles = collectInputFiles(process.argv.slice(2))

  const merged = {
    stageSamples: {
      evaluate: [],
      apply: [],
      render: [],
    },
    meta: {
      mergedAt: new Date().toISOString(),
      sourceFiles: inputFiles.map((f) => path.relative(process.cwd(), f)),
    },
  }

  inputFiles.forEach((filePath) => {
    let parsed
    try {
      parsed = parseJsonFile(filePath)
    } catch (error) {
      console.error(`[stage-merge] Failed to parse ${filePath}`)
      console.error(error?.message || error)
      process.exit(1)
    }
    merged.stageSamples.evaluate.push(...normalizeEntries(parsed?.evaluate, path.basename(filePath)))
    merged.stageSamples.apply.push(...normalizeEntries(parsed?.apply, path.basename(filePath)))
    merged.stageSamples.render.push(...normalizeEntries(parsed?.render, path.basename(filePath)))
  })

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  merged.meta.overall = {
    evaluate: summarizeDurations(merged.stageSamples.evaluate.map((s) => Number(s.durationMs || 0))),
    apply: summarizeDurations(merged.stageSamples.apply.map((s) => Number(s.durationMs || 0))),
    render: summarizeDurations(merged.stageSamples.render.map((s) => Number(s.durationMs || 0))),
  }
  merged.meta.breakdownByStudyForm = buildBreakdown(merged.stageSamples)
  fs.writeFileSync(outPath, JSON.stringify(merged, null, 2), "utf8")

  console.log(
    `[stage-merge] wrote=${path.relative(process.cwd(), outPath)} files=${inputFiles.length} evaluate=${merged.stageSamples.evaluate.length} apply=${merged.stageSamples.apply.length} render=${merged.stageSamples.render.length} groups=${merged.meta.breakdownByStudyForm.length}`
  )
}

main()
