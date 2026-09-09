/**
 * NER / AI service for eCRF data entry (Tatva NER API)
 * - Form schema: GET .../form-schema?study_id=... (questions_list)
 * - NER: POST .../ner with questions + audio_file (voice) or file (upload) or transcription (text)
 * - Response: { transcription?, answers: [{ response: [{ question_id, answer }] }], timings? }
 */

import { API_CONFIG, STORAGE_KEYS } from "../api/config"
import logger from "../api/logger"

const NER_BASE = API_CONFIG.NER_API_BASE_URL || "https://pm-tatva-agents-uat.tatvacare.in/api/v1/evalus"
const NER_ENDPOINT = `${NER_BASE}/ner`
const FORM_SCHEMA_ENDPOINT = `${NER_BASE}/form-schema`
const OCR_FORM_FILL_URL = API_CONFIG.OCR_FORM_FILL_URL || "https://pm-rx-digitization-gpt-uat.tatvacare.in/ocr_form_fill_gemini"

/** Browser calls Next.js API routes; keys stay server-side (Azure runtime env). */
const useServerAiProxy = typeof window !== "undefined"

function getAiProxyAuthHeaders(extra = {}) {
  const headers = { ...extra }
  if (typeof window !== "undefined") {
    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
    if (token) headers.Authorization = `Bearer ${token}`
  }
  return headers
}

function shouldUseDirectGeminiOcr() {
  const key = String(API_CONFIG.GEMINI_API_KEY || "").trim()
  if (!key) return false
  if (process.env.NEXT_PUBLIC_USE_DIRECT_GEMINI_OCR === "false") return false
  return process.env.NEXT_PUBLIC_USE_DIRECT_GEMINI_OCR === "true" || key.startsWith("AIza") || key.startsWith("AQ.")
}

function guessMimeType(file) {
  const type = String(file?.type || "").trim()
  if (type) return type
  const name = String(file?.name || "").toLowerCase()
  if (name.endsWith(".pdf")) return "application/pdf"
  if (name.endsWith(".png")) return "image/png"
  if (/\.jpe?g$/i.test(name)) return "image/jpeg"
  return "application/octet-stream"
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== "string") {
        reject(new Error("Could not read file."))
        return
      }
      const comma = result.indexOf(",")
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(new Error("Could not read file."))
    reader.readAsDataURL(file)
  })
}

function parseJsonFromModelText(text) {
  if (!text || typeof text !== "string") return null
  const trimmed = text.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fence ? fence[1].trim() : trimmed
  try {
    return JSON.parse(candidate)
  } catch {
    return null
  }
}

/**
 * Document OCR via Google Generative Language API (Gemini).
 * Uses GEMINI_API_KEY + GEMINI_OCR_MODEL (default gemini-3.1-flash-lite).
 */
async function extractFormDataViaDirectGemini(files, questions) {
  const apiKey = String(API_CONFIG.GEMINI_API_KEY || "").trim()
  const model = String(API_CONFIG.GEMINI_OCR_MODEL || "gemini-3.1-flash-lite").trim()
  if (!apiKey) {
    return { isSuccess: false, message: "Gemini API key is not configured." }
  }

  const file = files[0]
  const mimeType = guessMimeType(file)
  const allowed = ["application/pdf", "image/png", "image/jpeg", "image/jpg"]
  if (!allowed.includes(mimeType)) {
    return { isSuccess: false, message: "Unsupported file type for Gemini OCR. Use PDF, PNG, or JPEG." }
  }

  let base64
  try {
    base64 = await fileToBase64(file)
  } catch (e) {
    return { isSuccess: false, message: e?.message || "Could not read uploaded file." }
  }

  const prompt = [
    "You are a clinical form OCR assistant.",
    "Extract answers from the attached document for each question below.",
    "Return JSON only in this exact shape:",
    '{ "response": [ { "question_id": "<id>", "answer": "<value>" } ] }',
    "Use empty string for missing answers. Do not invent data.",
    "Rules:",
    "- Each question_id must be filled separately. Never merge multiple fields into one answer.",
    "- Table cells use question_id format: <tableId>_row_<rowIndex>_col_<colIndex> (row/col are zero-based).",
    "- For ukunkdate cells use DAY-MONTH-YEAR (e.g. 18-JAN-2024, UK-UNK-2020). Use UK for unknown day, UNK for unknown month (not OK).",
    "- For date cells use ISO yyyy-mm-dd when possible.",
    "",
    "Questions:",
    JSON.stringify(questions),
  ].join("\n")

  const url = `${API_CONFIG.GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const started = typeof performance !== "undefined" ? performance.now() : Date.now()

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    }),
  })

  const raw = await res.text()
  let payload = null
  try {
    payload = raw ? JSON.parse(raw) : null
  } catch {
    payload = { message: raw }
  }

  if (!res.ok) {
    const errMsg =
      payload?.error?.message ||
      payload?.message ||
      (typeof payload === "string" ? payload : null) ||
      `Gemini OCR failed (HTTP ${res.status}).`
    throw new Error(errMsg)
  }

  const textPart =
    payload?.candidates?.[0]?.content?.parts?.find((p) => typeof p?.text === "string")?.text ||
    payload?.candidates?.[0]?.content?.parts?.[0]?.text ||
    ""

  const parsed = parseJsonFromModelText(textPart) || payload
  const out = normalizeOcrResponse(parsed)
  const rawResponseItems = getRawResponseArray(parsed)

  if (!out) {
    return {
      isSuccess: false,
      message: "Gemini returned an invalid OCR response format.",
    }
  }

  const ended = typeof performance !== "undefined" ? performance.now() : Date.now()
  return {
    isSuccess: true,
    data: out,
    rawResponseItems,
    timings: { total_ms: Math.round(ended - started), model },
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== "string") {
        reject(new Error("Could not read audio."))
        return
      }
      const comma = result.indexOf(",")
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(new Error("Could not read audio."))
    reader.readAsDataURL(blob)
  })
}

/**
 * Voice fill via Gemini in the browser (fallback when server has no GEMINI_API_KEY in Azure).
 * Uses NEXT_PUBLIC_GEMINI_API_KEY baked at Docker build — same key path as direct document OCR.
 */
async function extractFormDataViaDirectGeminiVoice(audioBlob, questions) {
  if (!shouldUseDirectGeminiOcr()) {
    return { isSuccess: false, message: "Gemini API key is not configured in the app bundle." }
  }

  const apiKey = String(API_CONFIG.GEMINI_API_KEY || "").trim()
  const model = String(API_CONFIG.GEMINI_OCR_MODEL || "gemini-3.1-flash-lite").trim()
  const mimeType = String(audioBlob?.type || "audio/webm").trim() || "audio/webm"

  let base64
  try {
    base64 = await blobToBase64(audioBlob)
  } catch (e) {
    return { isSuccess: false, message: e?.message || "Could not read audio recording." }
  }

  const prompt = [
    "You are a clinical form voice assistant.",
    "Listen to the audio, transcribe what the user said, and extract answers for each question below.",
    "Return JSON only:",
    '{ "transcription": "<full transcript>", "response": [ { "question_id": "<id>", "answer": "<value>" } ] }',
    "Use empty string for missing answers. Do not invent data.",
    "Questions:",
    JSON.stringify(questions),
  ].join("\n")

  const url = `${API_CONFIG.GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const started = typeof performance !== "undefined" ? performance.now() : Date.now()

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        },
      ],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
    }),
  })

  const raw = await res.text()
  let payload = null
  try {
    payload = raw ? JSON.parse(raw) : null
  } catch {
    payload = { message: raw }
  }

  if (!res.ok) {
    const errMsg =
      payload?.error?.message || payload?.message || `Gemini voice failed (HTTP ${res.status}).`
    return { isSuccess: false, message: errMsg }
  }

  const textPart =
    payload?.candidates?.[0]?.content?.parts?.find((p) => typeof p?.text === "string")?.text ||
    payload?.candidates?.[0]?.content?.parts?.[0]?.text ||
    ""

  const parsed = parseJsonFromModelText(textPart) || payload
  const out = normalizeOcrResponse(parsed)
  const rawResponseItems = getRawResponseArray(parsed)
  if (!out) {
    return { isSuccess: false, message: "Gemini returned an invalid voice response format." }
  }

  const ended = typeof performance !== "undefined" ? performance.now() : Date.now()
  return {
    isSuccess: true,
    data: out,
    transcription: parsed?.transcription || "",
    rawResponseItems,
    timings: { total_ms: Math.round(ended - started), model, source: "client_gemini_voice" },
  }
}

/**
 * Tatva x-api-key for voice NER + form-schema only.
 * Document upload uses GEMINI_API_KEY (Google AIza) — never mix keys.
 */
function getNerApiKey() {
  const key = String(API_CONFIG.NER_API_KEY || "").trim()
  if (key.startsWith("AQ.") || key.startsWith("AIza")) return ""
  return key
}

/** Headers for JSON requests (e.g. form-schema GET). */
function getAuthHeaders() {
  const headers = { "Content-Type": "application/json" }
  const key = getNerApiKey()
  if (key) {
    headers["x-api-key"] = key
  }
  return headers
}

/** Add `x-api-key` only (FormData: do not set Content-Type). */
function addNerApiKey(headers = {}) {
  const key = getNerApiKey()
  if (key) {
    headers["x-api-key"] = key
  }
  return headers
}

/**
 * Fetch form schema from Tatva API (old API contract)
 * GET .../form-schema?study_id=...
 * @param {string} studyId - Study ID or study code (e.g. "PN/SEM1225/12")
 * @returns {Promise<{ isSuccess: boolean, questions?: Array }>}
 */
export async function getFormSchema(studyId) {
  if (!studyId) return { isSuccess: false, questions: null }
  try {
    const trimmed = String(studyId).replace(/\s+/g, "")
    const url = useServerAiProxy
      ? `/api/ai/form-schema?study_id=${encodeURIComponent(trimmed)}`
      : `${FORM_SCHEMA_ENDPOINT}?study_id=${encodeURIComponent(trimmed)}`
    const res = await fetch(url, {
      method: "GET",
      headers: useServerAiProxy ? getAiProxyAuthHeaders() : getAuthHeaders(),
    })
    const raw = await res.text()
    let data = null
    if (raw && (raw.trim().startsWith("{") || res.headers.get("content-type")?.includes("json"))) {
      try {
        data = JSON.parse(raw)
      } catch {
        data = raw
      }
    }
    if (!res.ok) {
      logger.error("Form schema fetch failed", { status: res.status, data })
      return { isSuccess: false, questions: null }
    }
    const forms = data?.forms
    const questions = Array.isArray(forms) && forms.length > 0 ? (forms[0].questions_list || []) : []
    return { isSuccess: true, questions }
  } catch (e) {
    logger.error("Form schema fetch error", { error: e?.message })
    return { isSuccess: false, questions: null }
  }
}

/**
 * Build "questions" list in Tatva NER format from form controls (fallback when form-schema not used)
 * @param {Array<{ id: string|number, type?: string, label?: string, properties?: { labelText?: string }, gridSchema?: object }>} controls
 * @returns {Array<{ question_id: number|string, question: string, question_type: string, validation_rules: Array, answer: null, grid_schema?: object }>}
 */
const UK_UNK_MONTHS_AI = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
]

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function getTableColumnMeta(control) {
  const props = control?.properties || {}
  const numCols = Math.max(1, Number(props.columns || 1))
  const columnHeaders = Array.isArray(props.columnHeaders) ? props.columnHeaders : []
  const columnTypes = Array.isArray(props.columnTypes) ? props.columnTypes : []
  const cellTypes = Array.isArray(props.cellTypes) ? props.cellTypes : []
  const cols = []
  for (let c = 0; c < numCols; c += 1) {
    const cellType = cellTypes?.[0]?.[c]
    const effectiveType =
      cellType && cellType !== "empty"
        ? String(cellType).toLowerCase()
        : String(columnTypes[c] || "text").toLowerCase()
    if (effectiveType === "empty") continue
    cols.push({
      colIdx: c,
      header: columnHeaders[c] != null && columnHeaders[c] !== "" ? String(columnHeaders[c]) : `Column ${c + 1}`,
      type: effectiveType,
    })
  }
  return cols
}

function getTableRowCountForAi(control) {
  const props = control?.properties || {}
  const designRows = Math.max(1, Number(props.rows || 1))
  const addRow = props.addRow === true
  const maxRows = Math.max(designRows, parseInt(props.maxRows, 10) || 10)
  if (!addRow) return designRows
  return Math.min(maxRows, Math.max(designRows, 6))
}

/**
 * Questions list with table cells expanded to flat field ids (row/col) for OCR/NER.
 */
export function buildAiQuestionsFromControls(controls) {
  if (!controls || !Array.isArray(controls)) return []
  const questions = []
  controls.forEach((control) => {
    const type = String(control?.type || "").toLowerCase()
    const id = String(control?.id || "").trim()
    if (!id || type === "label" || type === "hr") return

    if (type === "table") {
      const tableLabel = control.properties?.labelText || control.label || id
      const cols = getTableColumnMeta(control)
      const numRows = getTableRowCountForAi(control)
      for (let row = 0; row < numRows; row += 1) {
        cols.forEach(({ colIdx, header, type: colType }) => {
          questions.push({
            question_id: `${id}_row_${row}_col_${colIdx}`,
            question: `${tableLabel} - Row ${row + 1} - ${header}`,
            question_type: colType,
            validation_rules: [],
            answer: null,
          })
        })
      }
      return
    }

    questions.push({
      question_id: id,
      question: control.properties?.labelText || control.label || id,
      question_type: type,
      validation_rules: [],
      answer: null,
    })
  })
  return questions
}

export function buildQuestionsFromControls(controls) {
  return buildAiQuestionsFromControls(controls)
}

/** Normalize AI date text for ukunkdate cells (OCR often returns OK instead of UK, or dd-mm-yyyy). */
export function normalizeAiAnswerForCellType(rawValue, cellType) {
  const type = String(cellType || "").toLowerCase()
  let text = String(rawValue ?? "").trim()
  if (!text) return ""

  if (type === "ukunkdate") {
    text = text.replace(/\bOK\b/gi, "UK")
    const dmy = text.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/i)
    if (dmy) {
      const day = String(Number(dmy[1]))
      const monthNum = Number(dmy[2])
      const year = dmy[3]
      if (monthNum >= 1 && monthNum <= 12) {
        return `${day}-${UK_UNK_MONTHS_AI[monthNum - 1]}-${year}`
      }
    }
    const parts = text.split("-")
    if (parts.length === 3) {
      return parts.map((p) => String(p || "").trim().toUpperCase()).join("-")
    }
    return text.toUpperCase()
  }

  if (type === "date" || type.includes("date")) {
    const dmy = text.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
    if (dmy) {
      const yyyy = dmy[3]
      const mm = String(dmy[2]).padStart(2, "0")
      const dd = String(dmy[1]).padStart(2, "0")
      return `${yyyy}-${mm}-${dd}`
    }
  }

  return text
}

/**
 * Parse a combined table answer (legacy Gemini shape) into column index → value.
 */
function parseTableBlobAnswer(answer, columnHeaders) {
  const text = String(answer || "").trim()
  if (!text) return []
  const rowChunks = text.split(/\s*;\s*/).filter(Boolean)
  const headers = (columnHeaders || []).map((h, idx) => ({
    idx,
    label: String(h != null && h !== "" ? h : `Column ${idx + 1}`).trim(),
  }))

  return rowChunks.map((chunk) => {
    const row = {}
    headers.forEach(({ idx, label }) => {
      const regex = new RegExp(`${escapeRegex(label)}\\s*:\\s*`, "i")
      const match = chunk.match(regex)
      if (!match) return
      const start = match.index + match[0].length
      let end = chunk.length
      headers.forEach(({ label: otherLabel }) => {
        if (otherLabel === label) return
        const nextRegex = new RegExp(`\\s*,\\s*${escapeRegex(otherLabel)}\\s*:`, "i")
        const nextMatch = chunk.slice(start).match(nextRegex)
        if (nextMatch && nextMatch.index != null) {
          const candidate = start + nextMatch.index
          if (candidate < end) end = candidate
        }
      })
      row[idx] = chunk.slice(start, end).trim().replace(/,\s*$/, "")
    })
    return row
  })
}

/**
 * Map flat AI answers to form flat keys (expands table blobs → tableId_row_R_col_C).
 */
export function expandAiExtractedDataForControls(flatData, controls) {
  if (!flatData || typeof flatData !== "object") return {}
  const out = { ...flatData }
  const controlById = new Map(
    (Array.isArray(controls) ? controls : [])
      .filter((c) => c?.id)
      .map((c) => [String(c.id), c]),
  )

  controlById.forEach((control, tableId) => {
    if (String(control?.type || "").toLowerCase() !== "table") return
    const blob = String(out[tableId] ?? "").trim()
    if (!blob) return

    const props = control.properties || {}
    const columnHeaders = Array.isArray(props.columnHeaders) ? props.columnHeaders : []
    const cols = getTableColumnMeta(control)
    const parsedRows = parseTableBlobAnswer(blob, columnHeaders)

    if (parsedRows.length > 0) {
      parsedRows.forEach((row, rowIdx) => {
        cols.forEach(({ colIdx, type: colType }) => {
          const raw = row[colIdx]
          if (raw == null || String(raw).trim() === "") return
          const fieldId = `${tableId}_row_${rowIdx}_col_${colIdx}`
          out[fieldId] = normalizeAiAnswerForCellType(raw, colType)
        })
      })
      if (props.addRow === true) {
        const designRows = Math.max(1, Number(props.rows || 1))
        out[`${tableId}_rowCount`] = String(Math.max(designRows, parsedRows.length))
      }
    }

    delete out[tableId]
  })

  Object.keys(out).forEach((key) => {
    const cellMatch = key.match(/^(.*)_row_(\d+)_col_(\d+)$/)
    if (!cellMatch) return
    const table = controlById.get(cellMatch[1])
    if (!table) return
    const colIdx = parseInt(cellMatch[3], 10)
    const cols = getTableColumnMeta(table)
    const colMeta = cols.find((c) => c.colIdx === colIdx)
    if (!colMeta) return
    const normalized = normalizeAiAnswerForCellType(out[key], colMeta.type)
    if (normalized !== out[key]) out[key] = normalized
  })

  const cleaned = {}
  Object.entries(out).forEach(([k, v]) => {
    if (v === undefined || v === null) return
    const text = typeof v === "string" ? v.trim() : String(v)
    if (text === "") return
    cleaned[k] = typeof v === "string" ? v : String(v)
  })
  return cleaned
}

function getTableStructureFingerprint(control) {
  const cols = getTableColumnMeta(control)
  const label = String(control?.properties?.labelText || control?.label || "")
    .trim()
    .toLowerCase()
  return `${label}::${cols.map((c) => `${c.header}|${c.type}`).join("||")}`
}

function tableHasCellAnswers(flat, tableId) {
  const prefix = `${tableId}_row_`
  return Object.entries(flat).some(
    ([key, value]) => key.startsWith(prefix) && String(value ?? "").trim() !== "",
  )
}

function copyTableAnswersBetweenIds(flat, sourceTableId, targetTableId, targetControl) {
  const cols = getTableColumnMeta(targetControl)
  let maxRowIdx = -1
  Object.keys(flat).forEach((key) => {
    if (!key.startsWith(`${sourceTableId}_row_`)) return
    const match = key.match(/_row_(\d+)_col_(\d+)$/)
    if (!match) return
    maxRowIdx = Math.max(maxRowIdx, parseInt(match[1], 10))
  })
  const numRows = Math.max(getTableRowCountForAi(targetControl), maxRowIdx + 1)
  for (let row = 0; row < numRows; row += 1) {
    cols.forEach(({ colIdx }) => {
      const srcKey = `${sourceTableId}_row_${row}_col_${colIdx}`
      const tgtKey = `${targetTableId}_row_${row}_col_${colIdx}`
      const srcVal = String(flat[srcKey] ?? "").trim()
      if (srcVal) flat[tgtKey] = flat[srcKey]
    })
  }
  if (flat[`${sourceTableId}_rowCount`]) {
    flat[`${targetTableId}_rowCount`] = flat[`${sourceTableId}_rowCount`]
  }
}

/**
 * When duplicate tables share the same layout, copy AI answers onto the active-section table.
 */
export function remapAiTableDataToPreferredControls(
  flatData,
  controls,
  preferredControlIds = [],
) {
  if (!flatData || typeof flatData !== "object") return {}
  const out = { ...flatData }
  const preferred = new Set((preferredControlIds || []).map((id) => String(id)))
  const tables = (Array.isArray(controls) ? controls : []).filter(
    (c) => String(c?.type || "").toLowerCase() === "table" && c?.id,
  )
  const groups = new Map()
  tables.forEach((table) => {
    const fp = getTableStructureFingerprint(table)
    if (!groups.has(fp)) groups.set(fp, [])
    groups.get(fp).push(table)
  })

  groups.forEach((tableControls) => {
    if (tableControls.length < 2) return
    const withData = tableControls.filter((t) => tableHasCellAnswers(out, String(t.id)))
    const withoutData = tableControls.filter((t) => !tableHasCellAnswers(out, String(t.id)))
    if (!withData.length || !withoutData.length) return

    withData.forEach((sourceControl) => {
      const sourceId = String(sourceControl.id)
      withoutData.forEach((targetControl) => {
        const targetId = String(targetControl.id)
        const preferTarget =
          preferred.size === 0 || preferred.has(targetId) || !preferred.has(sourceId)
        if (!preferTarget) return
        copyTableAnswersBetweenIds(out, sourceId, targetId, targetControl)
        if (preferred.has(targetId) && !preferred.has(sourceId)) {
          Object.keys(out).forEach((key) => {
            if (key === sourceId || key.startsWith(`${sourceId}_row_`)) delete out[key]
          })
        }
      })
    })
  })

  return out
}

/**
 * Build field descriptions from form controls (legacy shape for backward compatibility)
 * @param {Array<{ id: string, type?: string, label?: string, properties?: { labelText?: string } }>} controls
 * @returns {Array<{ id: string, label: string, type: string }>}
 */
export function buildFieldDescriptions(controls) {
  if (!controls || !Array.isArray(controls)) return []
  return controls.map((c) => ({
    id: c.id,
    label: c.properties?.labelText || c.label || c.id,
    type: (c.type || "text").toLowerCase(),
  }))
}

/**
 * Normalize NER response to flat { [question_id]: answer } (old API: answers[0].response)
 * @param {object} data - Raw NER response
 * @returns {Record<string, string>|null}
 */
function getRawResponseArray(data) {
  if (Array.isArray(data?.response)) return data.response
  if (Array.isArray(data?.answers?.[0]?.response)) return data.answers[0].response
  if (Array.isArray(data?.data?.response)) return data.data.response
  return null
}

function normalizeNerResponse(data) {
  const response = data?.answers?.[0]?.response
  if (!Array.isArray(response)) return null
  const out = {}
  for (const item of response) {
    const id = item?.question_id
    const answer = item?.answer
    if (id !== undefined && id !== null && answer !== undefined && answer !== null) {
      out[String(id)] = typeof answer === "string" ? answer : String(answer)
    }
  }
  return Object.keys(out).length ? out : null
}

/**
 * Call NER API and normalize response to { isSuccess, data?: Record<string, string>, message?, transcription?, timings? }
 * Supports old API shape: { transcription, answers: [{ response: [{ question_id, answer }] }], timings }
 */
async function callNerApi(bodyOrFormData, isFormData = false) {
  let response
  if (useServerAiProxy) {
    const proxyHeaders = getAiProxyAuthHeaders()
    if (!isFormData) {
      proxyHeaders["Content-Type"] = "application/json"
    }
    response = await fetch("/api/ai/ner", {
      method: "POST",
      headers: proxyHeaders,
      body: isFormData ? bodyOrFormData : JSON.stringify(bodyOrFormData),
    })
  } else {
    const options = {
      method: "POST",
      headers: isFormData ? {} : getAuthHeaders(),
      body: isFormData ? bodyOrFormData : JSON.stringify(bodyOrFormData),
    }
    if (isFormData) {
      addNerApiKey(options.headers)
    }
    response = await fetch(NER_ENDPOINT, options)
  }
  const contentType = response.headers.get("content-type") || ""
  let data = null
  const raw = await response.text()
  if (raw && (contentType.includes("application/json") || raw.trim().startsWith("{"))) {
    try {
      data = JSON.parse(raw)
    } catch {
      data = raw
    }
  } else {
    data = raw
  }

  if (!response.ok) {
    let msg = data?.message || data?.error || (typeof data === "string" ? data : null) || `HTTP ${response.status}`
    if (typeof data?.error === "string") msg = data.error
    if (response.status === 401) {
      const invalidSecret =
        String(msg).toLowerCase().includes("invalid secret") ||
        String(data?.message || "").toLowerCase().includes("invalid secret")
      if (invalidSecret) {
        msg =
          "NER API rejected the key (Invalid secret). NER_API_KEY must be Tatva EvalusApiKey (not the Google upload key). Ask Tatva/backend for UAT EvalusApiKey, or ensure GEMINI_API_KEY is set for automatic voice fallback."
      } else {
        const isProdBundle = process.env.NODE_ENV === "production"
        msg = isProdBundle
          ? "NER API unauthorized (401). Set NER_API_KEY in Azure (pr-edc-fe-uat) to Tatva EvalusApiKey only — not the Google GEMINI key. Voice still works via GEMINI_API_KEY fallback."
          : "NER API unauthorized (401). Set nerApiKey in lib/config/aiKeys.local.js to Tatva EvalusApiKey (not the Google geminiApiKey), or leave nerApiKey empty and use geminiApiKey for voice."
      }
    }
    throw new Error(msg)
  }

  // Old API: answers[0].response -> { question_id, answer }[]
  const normalized = normalizeNerResponse(data)
  const rawResponseItems = getRawResponseArray(data)

  if (normalized) {
    return {
      isSuccess: true,
      data: normalized,
      message: data?.message,
      transcription: data?.transcription,
      timings: data?.timings,
      rawResponseItems,
    }
  }

  // Legacy: flat extractedData / formData / data
  const extracted = data?.extractedData ?? data?.formData ?? data?.data ?? data
  if (extracted && typeof extracted === "object" && !Array.isArray(extracted)) {
    return {
      isSuccess: true,
      data: extracted,
      message: data?.message,
      transcription: data?.transcription,
      timings: data?.timings,
      rawResponseItems,
    }
  }
  return { isSuccess: false, message: data?.message || "Invalid NER response format.", data: null }
}

/**
 * Convert field descriptions to questions list (for NER when form-schema not used)
 * @param {Array<{ id: string, label: string, type: string }>} fieldDescriptions
 * @returns {Array<{ question_id: string, question: string, question_type: string, validation_rules: [], answer: null }>}
 */
function fieldDescriptionsToQuestions(fieldDescriptions) {
  if (!fieldDescriptions?.length) return []
  return fieldDescriptions.map((fd) => ({
    question_id: fd.id,
    question: fd.label || fd.id || "",
    question_type: (fd.type || "text").toLowerCase(),
    validation_rules: [],
    answer: null,
  }))
}

/**
 * Normalize questionsOrFieldDescriptions to questions array (accepts form-schema questions or legacy fieldDescriptions)
 */
function toQuestionsArray(questionsOrFieldDescriptions) {
  if (!questionsOrFieldDescriptions?.length) return []
  const first = questionsOrFieldDescriptions[0]
  if (first && (first.question_id !== undefined || first.question !== undefined)) {
    return questionsOrFieldDescriptions
  }
  return fieldDescriptionsToQuestions(questionsOrFieldDescriptions)
}

/**
 * Extract form data from audio recording using NER API (EvalusResponseApiUrl)
 * POST: audio_file, transcription_model, inference_model, questions (JSON).
 * @param {Blob} audioBlob - Recording blob (e.g. audio/webm)
 * @param {Array} questionsOrFieldDescriptions - Form-schema questions_list or legacy fieldDescriptions
 * @returns {Promise<{ isSuccess: boolean, data?: Record<string, string>, message?: string, transcription?: string }>}
 */
export async function extractFormDataFromAudioBlob(audioBlob, questionsOrFieldDescriptions) {
  if (!audioBlob || !(audioBlob instanceof Blob)) {
    return { isSuccess: false, message: "No audio provided." }
  }
  const questions = toQuestionsArray(questionsOrFieldDescriptions)
  if (!questions.length) {
    return { isSuccess: false, message: "No form fields provided." }
  }

  try {
    const formData = new FormData()
    formData.append("audio_file", audioBlob, "recording.webm")
    formData.append("transcription_model", API_CONFIG.NER_VOICE_TRANSCRIPTION_MODEL || "azure_openai")
    formData.append("inference_model", API_CONFIG.NER_VOICE_INFERENCE_MODEL || "azure_openai")
    formData.append("questions", JSON.stringify(questions))
    const response = await callNerApi(formData, true)
    if (response.isSuccess && response.data) {
      return {
        isSuccess: true,
        data: response.data,
        transcription: response.transcription,
        timings: response.timings,
        rawResponseItems: response.rawResponseItems,
      }
    }
    return { isSuccess: false, message: response.message || "Could not extract form data from audio." }
  } catch (error) {
    const msg = error?.message || "Failed to extract form data from audio."
    logger.error("NER extractFormDataFromAudioBlob error", { error: msg })

    if (useServerAiProxy && shouldUseDirectGeminiOcr()) {
      const direct = await extractFormDataViaDirectGeminiVoice(audioBlob, questions)
      if (direct.isSuccess && direct.data) {
        return {
          isSuccess: true,
          data: direct.data,
          transcription: direct.transcription,
          timings: direct.timings,
          rawResponseItems: direct.rawResponseItems,
        }
      }
      return {
        isSuccess: false,
        message: direct.message || msg,
      }
    }

    return { isSuccess: false, message: msg }
  }
}

/**
 * Extract form data from speech transcript (fallback when audio recording not used)
 * @param {string} transcript - Text from speech-to-text
 * @param {Array} questionsOrFieldDescriptions - Form-schema questions_list or legacy fieldDescriptions
 */
export async function extractFormDataFromTranscript(transcript, questionsOrFieldDescriptions) {
  if (!transcript || typeof transcript !== "string" || transcript.trim() === "") {
    return { isSuccess: false, message: "No transcript provided." }
  }
  const questions = toQuestionsArray(questionsOrFieldDescriptions)
  if (!questions.length) {
    return { isSuccess: false, message: "No form fields provided." }
  }

  try {
    const formData = new FormData()
    formData.append("transcription", transcript.trim())
    formData.append("questions", JSON.stringify(questions))
    formData.append("inference_model", API_CONFIG.NER_VOICE_INFERENCE_MODEL || "azure_openai")
    const response = await callNerApi(formData, true)
    if (response.isSuccess && response.data) {
      return { isSuccess: true, data: response.data, transcription: response.transcription }
    }
    return { isSuccess: false, message: response.message || "Could not extract form data from speech." }
  } catch (error) {
    const msg = error?.message || "Failed to extract form data from speech."
    logger.error("NER extractFormDataFromTranscript error", { error: msg })
    return { isSuccess: false, message: msg }
  }
}

/**
 * Call OCR form-fill API (EvalusOCRFormFill) - multipart: files, input_json (questions).
 * Response normalized to same shape as NER for "apply to form" logic.
 */
async function callOcrApi(formData) {
  const options = {
    method: "POST",
    headers: {},
    body: formData,
  }
  addNerApiKey(options.headers)

  const response = await fetch(OCR_FORM_FILL_URL, options)
  const contentType = response.headers.get("content-type") || ""
  let data = null
  const raw = await response.text()
  if (raw && (contentType.includes("application/json") || raw.trim().startsWith("{"))) {
    try {
      data = JSON.parse(raw)
    } catch {
      data = raw
    }
  } else {
    data = raw
  }

  if (!response.ok) {
    const msg = data?.message || data?.error || (typeof data === "string" ? data : null) || `HTTP ${response.status}`
    throw new Error(msg)
  }

  const out = normalizeOcrResponse(data)
  const rawResponseItems = getRawResponseArray(data)
  if (out) {
    return {
      isSuccess: true,
      data: out,
      rawResponseItems,
      timings: data?.timings,
    }
  }
  return { isSuccess: false, message: data?.message || "Invalid OCR response format.", data: null }
}

/** Normalize OCR response to { [question_id]: answer } - same shape as NER for apply-to-form */
function normalizeOcrResponse(data) {
  const arr =
    Array.isArray(data?.response)
      ? data.response
      : Array.isArray(data?.answers?.[0]?.response)
        ? data.answers[0].response
        : Array.isArray(data)
          ? data
          : null
  if (arr && arr.length) {
    const out = {}
    for (const item of arr) {
      const id = item?.question_id
      if (id === undefined || id === null) continue
      const answer = item?.answer
      out[String(id)] =
        answer !== undefined && answer !== null
          ? (typeof answer === "string" ? answer : String(answer))
          : ""
    }
    return out
  }
  return null
}

/**
 * Extract form data from uploaded file(s) using OCR API (EvalusOCRFormFill)
 * POST: files (one or more), input_json (questions as JSON string).
 * @param {File|File[]} fileOrFiles - Single file or array of files (PDF, images)
 * @param {Array} questionsOrFieldDescriptions - Form-schema questions_list or legacy fieldDescriptions
 * @returns {Promise<{ isSuccess: boolean, data?: Record<string, string>, message?: string }>}
 */
export async function extractFormDataFromOCRFiles(fileOrFiles, questionsOrFieldDescriptions) {
  const files = Array.isArray(fileOrFiles) ? fileOrFiles : (fileOrFiles ? [fileOrFiles] : [])
  const valid = files.filter((f) => f instanceof File || f instanceof Blob)
  if (!valid.length) {
    return { isSuccess: false, message: "No file(s) provided." }
  }
  const questions = toQuestionsArray(questionsOrFieldDescriptions)
  if (!questions.length) {
    return { isSuccess: false, message: "No form fields provided." }
  }

  try {
    if (useServerAiProxy) {
      const formData = new FormData()
      valid.forEach((file) => {
        formData.append("files", file, file.name || "uploaded_file")
      })
      formData.append("questions", JSON.stringify(questions))
      const res = await fetch("/api/ai/document-ocr", {
        method: "POST",
        headers: getAiProxyAuthHeaders(),
        body: formData,
      })
      const raw = await res.text()
      let data = null
      try {
        data = raw ? JSON.parse(raw) : null
      } catch {
        data = { message: raw }
      }
      if (!res.ok) {
        const msg =
          data?.message ||
          data?.error?.message ||
          (typeof data?.error === "string" ? data.error : null) ||
          `Document OCR failed (HTTP ${res.status}).`
        return { isSuccess: false, message: msg }
      }
      const out = normalizeOcrResponse(data)
      const rawResponseItems = getRawResponseArray(data)
      if (out) {
        return { isSuccess: true, data: out, rawResponseItems, timings: data?.timings }
      }
      return { isSuccess: false, message: data?.message || "Invalid OCR response format." }
    }

    if (shouldUseDirectGeminiOcr()) {
      const direct = await extractFormDataViaDirectGemini(valid, questions)
      if (direct.isSuccess && direct.data) {
        return {
          isSuccess: true,
          data: direct.data,
          rawResponseItems: direct.rawResponseItems,
          timings: direct.timings,
        }
      }
      return {
        isSuccess: false,
        message: direct.message || "Could not extract form data via Gemini.",
      }
    }

    const formData = new FormData()
    valid.forEach((file) => {
      const name = file.name || "uploaded_file"
      formData.append("files", file, name)
    })
    formData.append("input_json", JSON.stringify(questions))
    formData.append("inference_model", API_CONFIG.NER_VOICE_INFERENCE_MODEL || "azure_openai")
    const response = await callOcrApi(formData)
    if (response.isSuccess && response.data) {
      return {
        isSuccess: true,
        data: response.data,
        rawResponseItems: response.rawResponseItems,
        timings: response.timings,
      }
    }
    return { isSuccess: false, message: response.message || "Could not extract form data from document(s)." }
  } catch (error) {
    const msg = error?.message || "Failed to extract form data from document(s)."
    logger.error("OCR extractFormDataFromOCRFiles error", { error: msg })
    return { isSuccess: false, message: msg }
  }
}

/**
 * Extract form data from a single uploaded file via OCR API (convenience wrapper).
 */
export async function extractFormDataFromFile(file, questionsOrFieldDescriptions) {
  return extractFormDataFromOCRFiles(file, questionsOrFieldDescriptions)
}

export default {
  getFormSchema,
  buildQuestionsFromControls,
  buildAiQuestionsFromControls,
  buildFieldDescriptions,
  expandAiExtractedDataForControls,
  remapAiTableDataToPreferredControls,
  normalizeAiAnswerForCellType,
  extractFormDataFromAudioBlob,
  extractFormDataFromTranscript,
  extractFormDataFromFile,
  extractFormDataFromOCRFiles,
}
