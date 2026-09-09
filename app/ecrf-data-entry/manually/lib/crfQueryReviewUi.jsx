"use client"

import { normalizeCrfSection } from "@/lib/utils/crfLabSection"

export const QUERY_TYPE_SYSTEM = 1
export const QUERY_TYPE_MANUAL = 2
export const QUERY_STATUS_OPEN = 1
export const QUERY_STATUS_IN_PROCESS = 2
export const QUERY_STATUS_CLOSED = 3

export const normalizeQueryType = (t) => {
  if (t === QUERY_TYPE_SYSTEM || t === "SystemGenerated") return QUERY_TYPE_SYSTEM
  if (t === QUERY_TYPE_MANUAL || t === "ManualGenerated") return QUERY_TYPE_MANUAL
  const n = parseInt(t, 10)
  return Number.isFinite(n) ? n : null
}

export const normalizeQueryStatus = (s) => {
  if (s === QUERY_STATUS_OPEN || s === "Open") return QUERY_STATUS_OPEN
  if (s === QUERY_STATUS_IN_PROCESS || s === "InProcess" || s === "In Process") return QUERY_STATUS_IN_PROCESS
  // Backward compatibility for legacy backend values
  if (s === "SentBack" || s === "ReSubmitted") return QUERY_STATUS_IN_PROCESS
  if (s === 4 || s === "4") return QUERY_STATUS_CLOSED
  if (s === QUERY_STATUS_CLOSED || s === "Closed") return QUERY_STATUS_CLOSED
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : null
}

export const isQueryOpenStatus = (status) => {
  const n = normalizeQueryStatus(status)
  return n === QUERY_STATUS_OPEN || n === QUERY_STATUS_IN_PROCESS
}
export const isQueryClosedStatus = (status) => normalizeQueryStatus(status) === QUERY_STATUS_CLOSED

/** Latest query lifecycle instant used to invalidate field SDV/PI until re-verified. */
export const getQueryLifecycleTimestampMs = (query) => {
  const status = normalizeQueryStatus(query?.status ?? query?.Status)
  if (status === QUERY_STATUS_OPEN || status === QUERY_STATUS_IN_PROCESS) {
    // While a query is active, verification cannot count as current.
    return Number.MAX_SAFE_INTEGER
  }
  if (status === QUERY_STATUS_CLOSED) {
    const raw =
      query?.closedAt ??
      query?.ClosedAt ??
      query?.updatedAt ??
      query?.UpdatedAt ??
      query?.createdAt ??
      query?.CreatedAt
    const ms = raw ? new Date(raw).getTime() : NaN
    return Number.isFinite(ms) ? ms : 0
  }
  return 0
}

export const parseVerificationTimestampMs = (value) => {
  if (!value) return null
  let normalized = String(value).trim()
  if (!normalized) return null
  if (/\s*UTC\s*$/i.test(normalized)) {
    normalized = normalized.replace(/\s*UTC\s*$/i, "").trim().replace(" ", "T") + "Z"
  } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)) {
    normalized = normalized.replace(" ", "T") + "Z"
  }
  const ms = new Date(normalized).getTime()
  return Number.isFinite(ms) ? ms : null
}

/**
 * True when field SDV/PI must be performed again after query activity on this field.
 * Trust persisted isSdvApproved/isPiSigned from formData — do not second-guess with timestamps.
 */
export const fieldRequiresReverificationAfterQueries = (
  queries,
  { approved = false } = {},
) => {
  const list = Array.isArray(queries) ? queries.filter(Boolean) : []
  if (!list.length) return false

  if (list.some((q) => isQueryOpenStatus(q?.status ?? q?.Status))) return true

  const hasClosedQuery = list.some((q) => isQueryClosedStatus(q?.status ?? q?.Status))
  if (!hasClosedQuery) return false

  return !approved
}

export const getQueryStatusLabel = (status) => {
  const n = normalizeQueryStatus(status)
  if (n === QUERY_STATUS_OPEN) return "Open"
  if (n === QUERY_STATUS_IN_PROCESS) return "In Process"
  if (n === QUERY_STATUS_CLOSED) return "Closed"
  return "Unknown"
}

export const isManualQueryType = (q) => normalizeQueryType(q?.queryType) === QUERY_TYPE_MANUAL
export const isSystemQueryType = (q) => normalizeQueryType(q?.queryType) === QUERY_TYPE_SYSTEM
export const getQueryApproverComment = (q) =>
  q?.queryApproverComment ?? q?.QueryApproverComment ?? q?.reviewerComment ?? ""
export const getCrfSubmitterComment = (q) =>
  q?.crfSubmitterComment ?? q?.CrfSubmitterComment ?? q?.submittedUserComment ?? q?.SubmittedUserComment ?? ""
export const getQueryApproverUserId = (q) =>
  q?.queryApproverUserId ?? q?.QueryApproverUserId ?? q?.reviewerUserId ?? q?.ReviewerUserId ?? null
export const getQueryAssignedToUserId = (q) =>
  q?.queryAssignedToUserId ?? q?.QueryAssignedToUserId ?? q?.submittedByUserId ?? q?.SubmittedByUserId ?? null

/** Prefer camelCase DTO keys; fall back to PascalCase from older payloads. */
export const queryDtoPick = (row, ...keys) => {
  for (const k of keys) {
    const v = row?.[k]
    if (v === undefined || v === null) continue
    if (typeof v === "string" && v.trim() === "") continue
    return v
  }
  return ""
}

export const formatQueryGridScalar = (v) => {
  if (v === null || v === undefined) return "—"
  if (typeof v === "boolean") return v ? "Yes" : "No"
  const s = String(v)
  return s.length > 240 ? `${s.slice(0, 237)}…` : s
}

export const formatQueryGridDate = (iso) => {
  if (!iso) return "—"
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return String(iso)
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
  } catch {
    return String(iso)
  }
}

export const queryGridTypeLabel = (t) => {
  const n = normalizeQueryType(t)
  if (n === QUERY_TYPE_SYSTEM) return "System"
  if (n === QUERY_TYPE_MANUAL) return "Manual"
  return formatQueryGridScalar(t)
}

export const getQueryStatusPillClass = (status) => {
  const n = normalizeQueryStatus(status)
  if (n === QUERY_STATUS_OPEN) return "border-sky-200 bg-sky-50 text-sky-900"
  // Match field query icons (`getCrmQueryIconButtonClass`): in-process reads as warm / active work.
  if (n === QUERY_STATUS_IN_PROCESS) return "border-orange-200 bg-orange-50 text-orange-900"
  if (n === QUERY_STATUS_CLOSED) return "border-emerald-200 bg-emerald-50 text-emerald-900"
  return "border-slate-200 bg-slate-50 text-slate-800"
}

export const canCurrentUserCloseQuery = (query, loggedInUserId) => {
  const reviewerId = Number(getQueryApproverUserId(query))
  if (!Number.isFinite(reviewerId) || reviewerId <= 0 || !loggedInUserId) return false
  return reviewerId === loggedInUserId
}

export const deriveExpectedActualAndBody = (query) => {
  const rawText = String(query?.queryText || query?.QueryText || "")
  let expected = String(query?.expectedCondition ?? query?.ExpectedCondition ?? "").trim()
  let actual = String(query?.actualValue ?? query?.ActualValue ?? "").trim()
  let body = rawText
  let details = ""

  if (rawText) {
    const lines = rawText.split(/\r?\n/).map((l) => l.trim())
    const remainingLines = []

    for (const line of lines) {
      if (!expected && line.toLowerCase().startsWith("expected:")) {
        expected = line.substring(9).trim()
        continue
      }
      if (!actual && line.toLowerCase().startsWith("actual:")) {
        actual = line.substring(7).trim()
        continue
      }
      if (!details && line.toLowerCase().startsWith("details:")) {
        details = line.substring(8).trim()
        continue
      }
      remainingLines.push(line)
    }

    body = remainingLines.filter(Boolean).join("\n").trim()
  }

  const displayBody =
    body ||
    details ||
    (expected || actual
      ? [
          expected && `Expected: ${expected}`,
          actual && `Actual: ${actual}`,
        ]
          .filter(Boolean)
          .join("\n\n")
      : rawText)

  return {
    expected: expected || "",
    actual: actual || "",
    body: displayBody || "",
  }
}

/** Query IDs for table cells are decorated (`tableId__col_C__row_R`); form data uses flat keys (`tableId_row_(R-1)_col_C`). */
export const resolveQueryFieldIdToFormFlatKey = (fieldId) => {
  const fid = String(fieldId || "").trim()
  if (!fid) return ""
  const m = fid.match(/^(.*)__col_(\d+)__row_(\d+)$/)
  if (!m) return fid
  const baseId = String(m[1] || "").trim()
  const colIdx = Number.parseInt(String(m[2] || ""), 10)
  const rowOneBased = Number.parseInt(String(m[3] || ""), 10)
  if (!baseId || !Number.isFinite(colIdx) || !Number.isFinite(rowOneBased)) return fid
  const rowZeroBased = Math.max(0, rowOneBased - 1)
  return `${baseId}_row_${rowZeroBased}_col_${colIdx}`
}

/** Stable DOM id for scrolling to a queried field in the CRF body. */
export const toEcrfFieldDomId = (fieldId) => {
  const flat = resolveQueryFieldIdToFormFlatKey(fieldId)
  if (!flat) return ""
  return `ecrf-field-${flat.replace(/[^a-zA-Z0-9_-]/g, "_")}`
}

export const normalizeQueryFieldKey = (fieldId) => resolveQueryFieldIdToFormFlatKey(fieldId)

export const getQueryDedupKey = (query) => {
  const fieldKey = normalizeQueryFieldKey(query?.fieldId ?? query?.FieldId)
  const ruleId = Number(query?.ruleId ?? query?.RuleId ?? 0)
  const type = normalizeQueryType(query?.queryType ?? query?.QueryType) ?? 0
  const queryId = Number(query?.id ?? query?.queryId ?? 0)
  const status = normalizeQueryStatus(query?.status ?? query?.Status)
  if (type === QUERY_TYPE_SYSTEM && ruleId > 0) {
    return `${type}|${fieldKey}|${ruleId}`
  }
  // Only one open manual query is allowed per field — collapse duplicate API rows.
  if (type === QUERY_TYPE_MANUAL && isQueryOpenStatus(status)) {
    return `${type}|open|${fieldKey}`
  }
  return `${type}|${fieldKey}|${queryId}|${status ?? "unknown"}`
}

/** Collapse duplicate CRM rows that share field + rule + type (e.g. re-submit or mixed fieldId formats). */
export const dedupeQueries = (queries = []) => {
  const seen = new Map()
  const out = []
  ;(Array.isArray(queries) ? queries : []).forEach((query) => {
    const key = getQueryDedupKey(query)
    const prev = seen.get(key)
    if (!prev) {
      seen.set(key, query)
      out.push(query)
      return
    }
    const prevId = Number(prev?.id ?? prev?.queryId ?? 0)
    const nextId = Number(query?.id ?? query?.queryId ?? 0)
    if (nextId > prevId) {
      const idx = out.indexOf(prev)
      if (idx >= 0) out[idx] = query
      seen.set(key, query)
    }
  })
  return out
}

export const queryFieldMatchesControl = (fieldId, controlId) => {
  const fid = String(fieldId || "").trim()
  const cid = String(controlId || "").trim()
  if (!fid || !cid) return false
  const normalizedField = normalizeQueryFieldKey(fid)
  if (normalizedField === cid) return true
  if (normalizedField.startsWith(`${cid}_row_`)) return true
  return fid === cid || fid.startsWith(`${cid}__col_`) || fid.startsWith(`${cid}_row_`)
}

export const filterQueriesForControl = (queries, controlId, { queryType = null } = {}) => {
  const matched = (Array.isArray(queries) ? queries : []).filter((query) => {
    if (queryType === QUERY_TYPE_SYSTEM && !isSystemQueryType(query)) return false
    if (queryType === QUERY_TYPE_MANUAL && !isManualQueryType(query)) return false
    return queryFieldMatchesControl(query?.fieldId ?? query?.FieldId, controlId)
  })
  return dedupeQueries(matched)
}

/** Current CRF slice value (includes optimistic in-flight edits). */
export const getLiveQueryFieldValueRaw = (fieldId, formId, formData, optimisticControlValues) => {
  const flatKey = resolveQueryFieldIdToFormFlatKey(fieldId)
  if (!flatKey || !formId) return undefined
  if (optimisticControlValues && Object.prototype.hasOwnProperty.call(optimisticControlValues, flatKey)) {
    return optimisticControlValues[flatKey]
  }
  return (formData?.[formId] || {})[flatKey]
}

export const stringifyQueryActualValue = (value) => {
  if (value == null) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "NaN"
    if (!Number.isFinite(value)) return value > 0 ? "Infinity" : "-Infinity"
    return String(value)
  }
  if (typeof value === "boolean") return value ? "true" : "false"
  if (typeof value === "bigint") return value.toString()
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString()

  if (Array.isArray(value)) {
    return value
      .map((v) => stringifyQueryActualValue(v))
      .filter((v) => v !== "")
      .join(", ")
      .trim()
  }

  // Objects (including nested/circular): safe JSON stringify with fallback.
  if (typeof value === "object") {
    try {
      const seen = new WeakSet()
      return JSON.stringify(value, (_k, v) => {
        if (typeof v === "bigint") return v.toString()
        if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString()
        if (typeof v === "object" && v !== null) {
          if (seen.has(v)) return "[Circular]"
          seen.add(v)
        }
        return v
      })
    } catch {
      return Object.prototype.toString.call(value)
    }
  }

  if (typeof value === "symbol") return value.description || "Symbol"
  if (typeof value === "function") return "[Function]"
  return String(value)
}

export const normalizeQueryChoiceOptions = (control) => {
  const rawOptions =
    control?.properties?.options ??
    control?.properties?.choices ??
    control?.options ??
    []
  if (!Array.isArray(rawOptions)) return []
  return rawOptions
    .map((opt, idx) => {
      if (opt == null) return null
      if (typeof opt === "string" || typeof opt === "number" || typeof opt === "boolean") {
        const str = String(opt).trim()
        if (!str) return null
        return { value: str, label: str, index: idx }
      }
      if (typeof opt === "object") {
        const valueRaw = opt?.value ?? opt?.id ?? opt?.code ?? opt?.name ?? opt?.label ?? ""
        const labelRaw = opt?.label ?? opt?.name ?? opt?.value ?? opt?.code ?? opt?.id ?? ""
        const value = String(valueRaw ?? "").trim()
        const label = String(labelRaw ?? "").trim()
        if (!value && !label) return null
        return {
          value: value || label,
          label: label || value,
          index: idx,
        }
      }
      return null
    })
    .filter(Boolean)
}

export const stripQueryFieldDecorators = (fieldId) => {
  const raw = String(fieldId || "")
  if (!raw) return ""
  const idx = raw.indexOf("__col_")
  return idx > -1 ? raw.slice(0, idx) : raw
}

export const getDisplaySectionsFromSelectedForm = (selectedForm) => {
  if (!selectedForm || typeof selectedForm !== "object") return []
  if (Array.isArray(selectedForm?.crfDesign?.sections) && selectedForm.crfDesign.sections.length > 0) {
    return selectedForm.crfDesign.sections
  }
  if (selectedForm?.section) return [selectedForm.section]
  return []
}

export const findControlForQueryField = (selectedForm, queryFieldId) => {
  const baseFieldId = stripQueryFieldDecorators(queryFieldId)
  if (!baseFieldId) return null
  const decoratedFieldId = String(queryFieldId || "")
  const tableCellMatch = decoratedFieldId.match(/__col_(\d+)__row_(\d+)$/)
  const sections = getDisplaySectionsFromSelectedForm(selectedForm).map((s) => normalizeCrfSection(s))
  for (const section of sections) {
    const controls = Array.isArray(section?.controls) ? section.controls : []
    for (const control of controls) {
      if (String(control?.id || "") !== String(baseFieldId)) continue
      const controlType = String(control?.type || "").toLowerCase()
      if (controlType !== "table" || !tableCellMatch) return control
      const colIdx = Number.parseInt(tableCellMatch[1], 10)
      if (!Number.isFinite(colIdx) || colIdx < 0) return control
      const columnTypes = Array.isArray(control?.properties?.columnTypes) ? control.properties.columnTypes : []
      const columnOptionValues = Array.isArray(control?.properties?.columnOptionValues)
        ? control.properties.columnOptionValues
        : []
      const cellTypeRaw = columnTypes[colIdx] ?? "text"
      const cellType = String(cellTypeRaw || "text").toLowerCase()
      const rawOptions = columnOptionValues[colIdx]
      const normalizedOptions =
        typeof rawOptions === "string" && rawOptions.trim()
          ? rawOptions
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
              .map((opt) => ({ value: opt, label: opt }))
          : []
      return {
        ...control,
        type: cellType,
        properties: {
          ...(control?.properties || {}),
          options: normalizedOptions,
        },
      }
    }
  }
  return null
}

/**
 * Query "Actual value" validation must stay aligned with CRF data entry:
 * - Resolve the field's control through the same sections + `getRuleAwareControl` as the grid.
 * - Run `validateControl` only (see `validateQueryModalActualValue` below).
 * New min/max/required/designer validation rules belong in `formValidation.js` / control props / rule pipeline —
 * no separate query-modal validators.
 *
 * Form flat keys use `tableId_row_R_col_C`; design lookup uses `tableId__col_C__row_R`.
 */
export const normalizeQueryFieldIdForTableColumnLookup = (fieldId) => {
  const raw = String(fieldId || "").trim()
  if (!raw) return raw
  const m = raw.match(/^(.*)_row_(\d+)_col_(\d+)$/)
  if (!m) return raw
  return `${m[1]}__col_${m[3]}__row_${m[2]}`
}

export const renderQueryActualReadOnlyByControl = (control, rawValue) => {
  const type = String(control?.type || "").toLowerCase()
  const v = stringifyQueryActualValue(rawValue)
  const display = String(v ?? "").trim() === "" ? "—" : v
  const opts = normalizeQueryChoiceOptions(control)
  if ((type === "select" || type === "dropdown") && opts.length > 0 && display !== "—") {
    const opt = opts.find((o) => String(o.value) === String(display))
    const line = opt?.label != null ? String(opt.label) : display
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-900 min-h-[40px] flex items-center break-words">
        {line}
      </div>
    )
  }
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-900 min-h-[40px] flex items-center font-mono tabular-nums break-all whitespace-pre-wrap">
      {display}
    </div>
  )
}