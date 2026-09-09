import { jsPDF } from "jspdf"
import { APP_BRANDING } from "@/lib/config/appBranding"
import { ORG_BRANDING } from "@/lib/config/orgBranding"
import { drawAuditTrailPdfSection } from "@/lib/utils/crfAuditTrailPdfSection"
import { drawPiSignoffPdfSection } from "@/lib/utils/crfPiSignoffPdfSection"
import { CRF_PDF_DEFAULT_LAYOUT_OPTIONS, resolveCrfPdfTheme } from "@/lib/utils/crfPdfTheme"
import { formatGeneratedUtc } from "@/lib/utils/reportGeneratedMeta"

const MARGIN = 15
const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const HEADER_HEIGHT = 45
const BODY_TOP = MARGIN + HEADER_HEIGHT
// Reserve a bit more space at the bottom so table borders/text
// don't visually collide with the footer strip.
const BODY_BOTTOM = PAGE_HEIGHT - MARGIN - 28
const LINE_HEIGHT = 5
const LABEL_COL_WIDTH = 75
const VALUE_COL_WIDTH = PAGE_WIDTH - 2 * MARGIN - LABEL_COL_WIDTH

// Active theme is resolved per-export in buildCrfEntryPdfDocument.
let PDF_THEME = resolveCrfPdfTheme("mac-premium")

// jsPDF core fonts don't reliably render the "₹" glyph.
// We will embed a rupee-capable Noto Sans font at runtime and then print "₹".
const PDF_FONT_FAMILY = "NotoSans"
const RUPEE_SYMBOL = "₹"
const RUPEE_FALLBACK = "Rs."
const CURRENCY_SYMBOL_TEXT_MAP = {
  "$": "Dollar",
  "€": "Euro",
  "£": "Pound",
  "¥": "Yen",
}

// Flip to true after jsPDF successfully loads the embedded rupee-capable fonts.
let pdfRupeeFontLoaded = false
let pdfRupeeFontLoadWarned = false

const pdfFontBase64Cache = {
  ready: null,
  regular: null,
  bold: null,
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ""
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  // btoa expects a binary string
  return btoa(binary)
}

async function loadPdfRupeeFontsOnce() {
  if (pdfFontBase64Cache.ready) return pdfFontBase64Cache.ready
  pdfFontBase64Cache.ready = (async () => {
    const [regularRes, boldRes] = await Promise.all([
      fetch("/fonts/NotoSans-Regular.ttf"),
      fetch("/fonts/NotoSans-Bold.ttf"),
    ])
    if (!regularRes.ok || !boldRes.ok) {
      throw new Error("Failed to fetch rupee fonts")
    }

    const isProbablyBase64 = (s) => {
      const t = String(s ?? "").trim()
      if (t.length < 1000) return false
      // Base64 charset plus '=' padding and line breaks.
      return /^[A-Za-z0-9+/=\r\n]+$/.test(t)
    }

    const [regularTxt, boldTxt] = await Promise.all([regularRes.text(), boldRes.text()])
    if (isProbablyBase64(regularTxt) && isProbablyBase64(boldTxt)) {
      // Gitiles/fuchsia sometimes returns the binary file as base64 text.
      // jsPDF expects base64 of binary file in VFS, so pass it through (clean whitespace).
      pdfFontBase64Cache.regular = String(regularTxt).replace(/\s+/g, "")
      pdfFontBase64Cache.bold = String(boldTxt).replace(/\s+/g, "")
    } else {
      // If server returned actual binary, convert it.
      const [regularBuf, boldBuf] = await Promise.all([regularRes.arrayBuffer(), boldRes.arrayBuffer()])
      pdfFontBase64Cache.regular = arrayBufferToBase64(regularBuf)
      pdfFontBase64Cache.bold = arrayBufferToBase64(boldBuf)
    }
  })()
  return pdfFontBase64Cache.ready
}

async function ensurePdfRupeeFontLoaded(doc) {
  // Patch is per-document. Even if fonts were loaded previously, every new jsPDF
  // instance must have its own setFont override.
  const patchDocSetFont = () => {
    if (!doc || doc.__ecrfSetFontPatched) return
    const originalSetFont = doc.setFont.bind(doc)
    doc.setFont = (fontName, fontStyle) => {
      const style = fontStyle || "normal"
      const supportedStyle = style === "bold" ? "bold" : "normal"
      return originalSetFont(PDF_FONT_FAMILY, supportedStyle)
    }
    doc.__ecrfSetFontPatched = true
  }

  if (pdfRupeeFontLoaded) {
    patchDocSetFont()
    return true
  }
  try {
    await loadPdfRupeeFontsOnce()

    // Add fonts to jsPDF's VFS and register the font family.
    doc.addFileToVFS("NotoSans-Regular.ttf", pdfFontBase64Cache.regular)
    doc.addFileToVFS("NotoSans-Bold.ttf", pdfFontBase64Cache.bold)

    doc.addFont("NotoSans-Regular.ttf", PDF_FONT_FAMILY, "normal", 400, "Identity-H")
    doc.addFont("NotoSans-Bold.ttf", PDF_FONT_FAMILY, "bold", 700, "Identity-H")

    // Force all doc.setFont(...) calls to use the embedded font family.
    patchDocSetFont()

    pdfRupeeFontLoaded = true
    return true
  } catch (e) {
    // Keep fallback behavior (Rs.) if font load fails.
    pdfRupeeFontLoaded = false
    if (!pdfRupeeFontLoadWarned) {
      pdfRupeeFontLoadWarned = true
      console.warn("[ECRF_PDF_DEBUG] Rupee font load failed:", e?.message || e)
    }
    return false
  }
}

// Targeted debug: helps us diagnose encoded dropdown artifacts only
// when they include special characters (e.g. '<', '>', '&', '-') and digit tokens.
const ECRF_PDF_DEBUG_SEEN = new Set()
function ecrfPdfDebugIfEncodedSpecial(context, rawValue, extra = {}) {
  if (typeof rawValue !== "string") return
  const hasSpecialChars = /[<>&-]/.test(rawValue)
  const hasEncodedDigitTokens = /[&＆]\d/.test(rawValue)
  if (!hasSpecialChars || !hasEncodedDigitTokens) return

  const key = `${context}::${rawValue.slice(0, 80)}`
  if (ECRF_PDF_DEBUG_SEEN.has(key)) return
  ECRF_PDF_DEBUG_SEEN.add(key)

  // Keep output small but useful.
  const preview = rawValue.length > 180 ? `${rawValue.slice(0, 180)}…` : rawValue
  console.log("[ECRF_PDF_DEBUG]", context, { rawValue: preview, ...extra })
}

function ecrfPdfDebugIfCurrencyMissingComparator(context, rawValue, extra = {}) {
  if (typeof rawValue !== "string") return
  // UI typically shows rupee. If PDF has '<' or '>' but rupee is missing,
  // we want to diagnose why early.
  const hasComparator = /[<>]/.test(rawValue)
  const hasDigits = /\d/.test(rawValue)
  const missingRupee = !/₹/.test(rawValue) && !/\bRs\.?\b/i.test(rawValue) && !/\bINR\b/i.test(rawValue)
  if (!hasComparator || !hasDigits || !missingRupee) return

  const key = `${context}::${rawValue.slice(0, 80)}`
  if (ECRF_PDF_DEBUG_SEEN.has(key)) return
  ECRF_PDF_DEBUG_SEEN.add(key)
  const preview = rawValue.length > 180 ? `${rawValue.slice(0, 180)}…` : rawValue
  console.log("[ECRF_PDF_DEBUG]", context, { rawValue: preview, ...extra })
}

async function toDataUrlFromUrl(url) {
  if (!url) return null
  try {
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function isLikelyDataUrl(value) {
  return typeof value === "string" && value.startsWith("data:image/")
}

/**
 * Backend sometimes stores dropdown labels as per-character token streams like
 * `¹&3&0&3&7&5& &a&n&d &a&b&o&v&e`. Rebuild by splitting on `&` and joining
 * segments (keeps intentional ` ` segments from `& &` word boundaries). Runs
 * BEFORE HTML decode so `&` is not treated as entities.
 */
function collapseAmpersandTokenStreamPrefix(input) {
  const original = String(input ?? "")
  const ampAll = original.match(/[&＆]/g) || []
  if (ampAll.length < 2) return original
  if (!/[&＆]\s*[A-Za-z0-9<>=\-₹]/.test(original) && !/[&＆]\s+\S/.test(original)) return original

  const digitAfterAmp = (original.match(/[&＆]\s*\d/g) || []).length
  const letterAfterAmp = (original.match(/[&＆]\s*[A-Za-z]/g) || []).length
  const looksEncoded =
    digitAfterAmp >= 2 ||
    letterAfterAmp >= 3 ||
    (digitAfterAmp >= 1 && letterAfterAmp >= 1 && ampAll.length >= 4)
  if (!looksEncoded) return original

  const decoded = original
    .split(/[&＆]/g)
    .join("")
    .replace(/^[\u00B9\u00B2\u00B3\u2070-\u2079\u200B\uFEFF]+/u, "")
    .replace(/\s+/g, " ")
    .trim()
  return decoded
}

/**
 * Dropdown/table option strings for annotated blank PDFs sometimes arrive as
 * ampersand token streams (&k&g&…) or HTML entities; normalize like other PDF
 * fields so legends do not render garbage (common on long "Unit" lists).
 */
function normalizePdfTableOptionForLegend(opt) {
  const trimmed = String(opt ?? "").trim()
  if (!trimmed) return ""
  const decoded = normalizePdfValueText(trimmed)
  return decoded.trim() || trimmed
}

/** PDF display: avoid currency symbols / glyph issues — plain numbers and words only. */
function stripCurrencyDecoratorsForPdf(s) {
  return String(s ?? "")
    .replace(/₹/g, "")
    .replace(/\b(?:Rs\.?|INR|rupees?|rupee)\b/gi, "")
    .replace(/\b(?:Dollar|Dollars|USD|Euro|Euros|EUR|Pound|Pounds|GBP|Yen|JPY)\b/gi, "")
    .replace(/[$€£¥]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** Full decode/cleanup for values shown in PDF (not for static section/field labels). */
function normalizePdfValueText(value) {
  return stripCurrencyDecoratorsForPdf(normalizeMultilineText(value))
}

function normalizeMultilineText(value) {
  if (!value) return ""
  let raw = collapseAmpersandTokenStreamPrefix(String(value))

  const rupeePrefix = pdfRupeeFontLoaded ? RUPEE_SYMBOL : RUPEE_FALLBACK

  const debugContextBase = "normalizeMultilineText"
  ecrfPdfDebugIfCurrencyMissingComparator(`${debugContextBase}-pre`, raw, {})

  // Decode common HTML entities first.
  // (Browser-safe path via textarea + fallback replacements.)
  try {
    if (typeof document !== "undefined") {
      const textarea = document.createElement("textarea")
      textarea.innerHTML = raw
      raw = textarea.value
    }
  } catch {
    // ignore; fallback replacements run below
  }
  raw = raw
    .replace(/&amp;/gi, "&")
    .replace(/&#38;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")

  // Normalize unicode symbols often unsupported by jsPDF core fonts.
  // This avoids glyph corruption in PDF output for values like "≥ once/week".
  raw = raw
    // If rupee-capable font is not loaded yet, normalize rupee glyph to ASCII.
    .replace(/₹/g, pdfRupeeFontLoaded ? RUPEE_SYMBOL : RUPEE_FALLBACK)
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/[–—]/g, "-")
    .replace(/−/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")

  // Other currency symbols can be unstable across PDF fonts. Convert to words.
  raw = raw.replace(/[$€£¥]/g, (symbol) => CURRENCY_SYMBOL_TEXT_MAP[symbol] || symbol)

  // Some backend payloads encode values as "&3&0&3&7&5" / "&a&n&d" / "&<&4&5&5&6".
  // Decode these token streams generically before any label matching/rendering.
  const encodedTokenMatches = raw.match(/[&＆]\s*\S/g) || []
  if (encodedTokenMatches.length >= 3) {
    // High-confidence encoded stream: strip all token markers.
    // Example: "&7&5&9&4&-&1&1&3&6&1" -> "7594-11361"
    raw = raw.replace(/[&＆]\s*/g, "")
  }

  // Treat "Rs"/"INR"/"₹" as the same currency token for numeric/comparator bands.
  // This keeps matching generic even when API payload uses different currency forms.
  raw = raw
    .replace(/\b(?:rs\.?|inr)\b\.?\s*(?=[<>=]?\s*\d)/gi, rupeePrefix)
    .replace(/₹\s*(?=[<>=]?\s*\d)/g, rupeePrefix)

  // Comparator-style bands may appear with/without currency symbol.
  // Keep comparator-first style so output remains consistent with CRF labels.
  {
    const trimmed = raw.trim()
    let m = trimmed.match(/^(<<|<|<=)\s*(?:₹\s*)?(\d{1,10})$/)
    if (m) {
      const op = m[1] === "<=" ? "<=" : "<"
      const num = m[2]
      raw = `${op}${rupeePrefix}${num}`
    } else {
      m = trimmed.match(/^(>>|>)\s*(?:₹\s*)?(\d{1,10})$/)
      if (m) {
        const op = ">"
        const num = m[2]
        raw = `${op}${rupeePrefix}${num}`
      }
    }
  }

  // Backend sometimes encodes numeric band labels using repeated patterns like:
  //   `&1&5&1&8&&- '&3&0&3&7&4`
  // These don't get decoded by generic HTML-entity cleanup, so we detect heavy
  // `&<digit>` token usage and collapse it into a clean numeric range.
  const encodedDigitTokens = raw.match(/[&＆]\d/g) || []
  if (encodedDigitTokens.length >= 3) {
    const hasEncodedCurrencyArtifact = /&&&\s*8\s*&&&/.test(raw) || /[&＆]\s*8\s*[&＆]{2,}/.test(raw)
    const hasRupee = /₹/i.test(raw) || /\b(?:Rs\.?|INR)\b/i.test(raw) || hasEncodedCurrencyArtifact
    let cleaned = raw.replace(/[&＆]/g, "").replace(/'/g, "").replace(/\s+/g, " ").trim()
    // Remove currency words if they exist (so we don't end up with "₹Rs INR15188-30374")
    cleaned = cleaned.replace(/\b(?:Rs\.?|INR)\b/gi, "").trim()
    // Some payloads contain an extra standalone "8" token as a currency artefact
    // (example around encoded rupee markers). Drop that isolated token only when present.
    cleaned = cleaned.replace(/\b8\b(?=\s*[-<>=])/g, "").replace(/([<>=-]\s*)8\b/g, "$1")
    // Normalize dash spacing so ranges look like "15188-30374"
    cleaned = cleaned.replace(/\s*-\s*/g, "-")
    // Collapse accidental double dashes created by patterns like "&&-"
    cleaned = cleaned.replace(/--+/g, "-")
    raw = hasRupee ? `${rupeePrefix}${cleaned.replace(/₹/g, "").trim()}` : cleaned
  }

  // 1) Treat "&&& " as line-break first so encoded multi-values split nicely.
  raw = raw.replace(/&&&\s*/g, "\n")

  // 2) Some backends encode letters like "&&&Y&&&S" (no space after &&&). Remove &&& prefixes.
  raw = raw.replace(/&&&(?=[A-Za-z0-9])/g, "")

  // 3) Decode patterns like:
  //    "&M&a&r&r&i&e&d" -> "Married"
  //    "& M & a & r & r & i & e & d" -> "Married"
  // Apply only when there are at least 2 encoded chars to avoid touching normal "&".
  raw = raw.replace(/(?:[&＆]\s*[A-Za-z0-9]\s*){2,}/g, (chunk) => chunk.replace(/[&＆\s]/g, ""))

  // 4) If backend encodes multi-values as separate lines prefixed by "&",
  // remove that prefix (ex: "& Excellent", "& Good", ...).
  raw = raw.replace(/(^|\r?\n)\s*&\s*/g, "$1")

  // 5) If backend encodes a word as "E x c e l l e n t" (letters separated by spaces),
  // collapse it back to "Excellent".
  raw = raw.replace(/\b(?:[A-Za-z]\s+){2,}[A-Za-z]\b/g, (m) => m.replace(/\s+/g, ""))

  // 6) Special-case backend artefacts like `'&1&5&1&8&&- '&3&0&3&7&4` so they render as a
  // clean numeric band (option labels for income/score bands sometimes arrive this way).
  // If the whole string is composed only of digits, ampersands, quotes, dashes, currency
  // markers and whitespace, we normalise it by stripping `&` / quotes and collapsing spaces.
  if (/^[\s'&0-9\-₹Rs.]+$/.test(raw)) {
    const hasRupee = /₹/.test(raw)
    const cleanedDigits = raw.replace(/[&']/g, "").replace(/\s+/g, " ").trim()
    const withoutCurrencyWord = cleanedDigits.replace(/\b(?:Rs\.?|INR)\b/gi, "").trim()
    raw = hasRupee ? `₹${withoutCurrencyWord.replace(/₹/g, "").trim()}` : withoutCurrencyWord
  }

  // 8) FINAL SAFETY NET for stubborn encoded patterns:
  // If we STILL see heavy "&<digit>" usage, aggressively strip ampersands/quotes and
  // collapse spaces/dashes so PDF never shows raw encoding like "&1&5&1&8&&- '&3&0&3&7&4".
  const encodedDigitTokensAfter = raw.match(/[&＆]\d/g) || []
  if (encodedDigitTokensAfter.length >= 2 && /[&＆]\d/.test(raw)) {
    const before = raw
    raw = raw.replace(/[&＆']/g, "").replace(/\s+/g, " ").replace(/\s*-\s*/g, "-").trim()
    ecrfPdfDebugIfEncodedSpecial("normalizeMultilineText-final-fix", before, { normalized: raw })
  }

  // 7) Trim each line and drop empty lines
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  return lines.join("\n")
}

function parsePdfDate(value) {
  if (value === undefined || value === null || value === "") return null
  const s = String(value).trim()
  if (!s) return null
  const isoDay = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoDay) {
    const parsed = new Date(Number(isoDay[1]), Number(isoDay[2]) - 1, Number(isoDay[3]))
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  const dmy = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/)
  if (dmy) {
    const parsed = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]))
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  const parsed = new Date(s)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

// Format for UI-style display in PDF (match how data appears in the app)
function formatDate(value) {
  const parsed = parsePdfDate(value)
  if (!parsed) return value ? String(value) : ""
  try {
    return parsed.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  } catch {
    return String(value)
  }
}

function formatTime(value) {
  if (!value) return ""
  try {
    return new Date(value).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  } catch {
    return String(value)
  }
}

function formatDateTime(value) {
  const parsed = parsePdfDate(value)
  if (!parsed) return value ? String(value) : ""
  try {
    return parsed.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return String(value)
  }
}

function formatPdfTableCellText(cellText, cellType) {
  const type = String(cellType || "").toLowerCase()
  const raw = String(cellText ?? "").trim()
  if (!raw || raw === "—") return raw || "—"
  if (type === "date") return formatDate(raw) || raw
  if (type === "datetime") return formatDateTime(raw) || raw
  if (type === "time") return formatTime(raw) || raw
  return normalizePdfValueText(raw)
}

function formatKeyValue(value, { dashOnEmpty = true } = {}) {
  // Allow callers to explicitly suppress the "—" placeholder.
  if (value && typeof value === "object" && "value" in value) {
    const next = value.value
    const nextDashOnEmpty = value.dashOnEmpty
    return formatKeyValue(next, { dashOnEmpty: nextDashOnEmpty ?? dashOnEmpty })
  }

  if (value == null) return dashOnEmpty ? "—" : ""
  const s = String(value).trim()
  return s.length ? s : dashOnEmpty ? "—" : ""
}

function drawTopStrip(doc, meta, page, totalPages, printedInfo, showDates) {
  const generatedBy =
    printedInfo?.generatedBy ?? printedInfo?.printedBy ?? "—"
  const generatedOnIso = printedInfo?.generatedOn ?? printedInfo?.printedOn

  const disclaimerText = `This is an electronically generated report through ${APP_BRANDING.pdfProductName}.`
  const pageText = `Page ${page} of ${totalPages}`
  const rightEdge = PAGE_WIDTH - MARGIN
  const lineY = PAGE_HEIGHT - MARGIN - 16
  const belowLineY = lineY + 5.5

  // Page number — above footer line, right-aligned
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.setTextColor(30, 30, 30)
  const pageW = doc.getTextWidth(pageText)
  doc.text(pageText, rightEdge - pageW, lineY - 5)

  // Footer divider
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.25)
  doc.line(MARGIN, lineY, PAGE_WIDTH - MARGIN, lineY)

  // Below line — left: disclaimer
  const leftMaxWidth = PAGE_WIDTH - MARGIN * 2 - 78
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(100, 100, 100)
  const disclaimerLines = doc.splitTextToSize(disclaimerText, Math.max(40, leftMaxWidth))
  doc.text(disclaimerLines, MARGIN, belowLineY)

  // Below line — right: Generated + Generated by
  const metaLines = []
  if (showDates && generatedOnIso) {
    metaLines.push(`Generated: ${formatGeneratedUtc(generatedOnIso)}`)
  }
  metaLines.push(`Generated by: ${generatedBy}`)

  let metaY = belowLineY
  for (const text of metaLines) {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.setTextColor(100, 100, 100)
    const w = doc.getTextWidth(text)
    doc.text(text, rightEdge - w, metaY)
    metaY += 4.2
  }
}

function drawHeaderBand(doc, meta, options = {}) {
  const { orgName, orgAddress, studyNo, patientId, logoDataUrl, formType, crfVersion } = meta
  const showSubjectIdentity = options.showSubjectIdentity !== false

  // Logo block
  const logoSize = 18
  doc.setDrawColor(0, 0, 0)
  doc.rect(MARGIN, MARGIN, logoSize, logoSize)
  if (logoDataUrl) {
    try {
      const innerPad = 1.2
      doc.addImage(
        logoDataUrl,
        "PNG",
        MARGIN + innerPad,
        MARGIN + innerPad,
        logoSize - innerPad * 2,
        logoSize - innerPad * 2
      )
    } catch {
      doc.setFont("helvetica", "bold")
      doc.setFontSize(14)
      doc.setTextColor(0, 0, 0)
      doc.text("E", MARGIN + logoSize / 2 - 2, MARGIN + logoSize / 2 + 4)
    }
  } else {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(14)
    doc.setTextColor(0, 0, 0)
    doc.text("E", MARGIN + logoSize / 2 - 2, MARGIN + logoSize / 2 + 4)
  }

  // Organisation
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  const orgText = orgName || ORG_BRANDING.orgDisplayName
  const orgTextWidth = PAGE_WIDTH - MARGIN - (MARGIN + logoSize + 6) - 4
  const orgLines = doc.splitTextToSize(orgText, orgTextWidth).slice(0, 2)
  doc.text(orgLines, MARGIN + logoSize + 6, MARGIN + 5.5)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  const addr = orgAddress || ORG_BRANDING.orgAddress
  const addrLines = String(addr).split("\n")
  const addrStartY = MARGIN + 5.5 + orgLines.length * 3.8
  doc.text(addrLines, MARGIN + logoSize + 6, addrStartY)

  // Case report band
  const bandTop = MARGIN + logoSize + 6
  const bandHeight = 12
  const colWidth = (PAGE_WIDTH - 2 * MARGIN) / 3

  doc.rect(MARGIN, bandTop, PAGE_WIDTH - 2 * MARGIN, bandHeight)
  doc.line(MARGIN + colWidth, bandTop, MARGIN + colWidth, bandTop + bandHeight)
  doc.line(MARGIN + 2 * colWidth, bandTop, MARGIN + 2 * colWidth, bandTop + bandHeight)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  // Left cell title (vertically centered-ish)
  doc.text("CASE REPORT FORM", MARGIN + 2, bandTop + 8.2)

  // Middle cell: Study No
  doc.setFontSize(8.5)
  doc.text("Study No.:", MARGIN + colWidth + 2, bandTop + 4.6)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.text(studyNo || "—", MARGIN + colWidth + 2, bandTop + 9.6)

  // Right cell: Patient ID for filled PDFs, Form Type for blank templates.
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8.5)
  doc.text(
    showSubjectIdentity ? "Patient ID:" : "Form Type:",
    MARGIN + 2 * colWidth + 2,
    bandTop + 4.6
  )
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  const rightValue = showSubjectIdentity
    ? (patientId || "—")
    : `${formType || "Blank Template"}${crfVersion ? ` (v${crfVersion})` : ""}`
  doc.text(rightValue, MARGIN + 2 * colWidth + 2, bandTop + 9.6)
}

function drawCrfTitleBars(doc, y, crfName) {
  let curY = y
  doc.setDrawColor(0, 0, 0)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.rect(MARGIN, curY, PAGE_WIDTH - 2 * MARGIN, 6)
  doc.text("Case Report Form", MARGIN + (PAGE_WIDTH - 2 * MARGIN) / 2 - doc.getTextWidth("Case Report Form") / 2, curY + 4)
  curY += 7
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  const title = (crfName || "CRF").toUpperCase()
  doc.rect(MARGIN, curY, PAGE_WIDTH - 2 * MARGIN, 8)
  doc.text(title, MARGIN + (PAGE_WIDTH - 2 * MARGIN) / 2 - doc.getTextWidth(title) / 2, curY + 5.5)
  curY += 9
  return curY
}

function normalizeHeaderKey(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ")
}

function drawCompactDetailHeader(doc, meta, crfName, options = {}) {
  const showSubjectIdentity = options.showSubjectIdentity !== false
  const compactTop = MARGIN + 2
  const compactH = 10
  const barW = PAGE_WIDTH - 2 * MARGIN

  doc.setDrawColor(...PDF_THEME.colors.compactHeaderBorder)
  doc.setFillColor(...PDF_THEME.colors.compactHeaderFill)
  doc.roundedRect(
    MARGIN,
    compactTop,
    barW,
    compactH,
    PDF_THEME.radius.compactHeader,
    PDF_THEME.radius.compactHeader,
    "FD",
  )

  const left = `CRF: ${String(crfName || "CRF").trim()}`
  const mid = `Study: ${String(meta?.studyNo || "—").trim()}`
  const right = showSubjectIdentity
    ? `Patient: ${String(meta?.patientId || "—").trim()}`
    : `Type: ${String(meta?.formType || "Blank").trim()}`

  doc.setFont("helvetica", "bold")
  doc.setFontSize(PDF_THEME.font.compactHeader)
  doc.setTextColor(48, 56, 76)
  doc.text(left, MARGIN + 2.2, compactTop + 6.4)
  doc.setFont("helvetica", "normal")
  doc.text(mid, MARGIN + barW * 0.42, compactTop + 6.4)
  doc.text(right, MARGIN + barW * 0.72, compactTop + 6.4)
  doc.setTextColor(0, 0, 0)

  return compactTop + compactH + 3
}

function drawSectionStartHeader(doc, y, sectionTitle) {
  const boxW = PAGE_WIDTH - 2 * MARGIN
  const padX = 3
  const padY = 2.2
  const text = `SECTION: ${String(sectionTitle || "Section").trim()}`
  doc.setFont("helvetica", "bold")
  doc.setFontSize(PDF_THEME.font.section)
  const lines = doc.splitTextToSize(text, Math.max(20, boxW - padX * 2))
  const lineH = 3.4
  const boxH = Math.max(7, padY * 2 + lines.length * lineH + 0.5)
  doc.setDrawColor(...PDF_THEME.colors.sectionBorder)
  doc.setFillColor(...PDF_THEME.colors.sectionFill)
  doc.roundedRect(MARGIN, y, boxW, boxH, PDF_THEME.radius.section, PDF_THEME.radius.section, "FD")
  doc.setTextColor(46, 55, 77)
  doc.text(lines, MARGIN + padX, y + padY + 2.4)
  doc.setTextColor(0, 0, 0)
  return y + boxH
}

const SUBSECTION_HEADER_PAD_X = 3
const SUBSECTION_HEADER_PAD_Y = 2.4
const SUBSECTION_HEADER_LINE_H = 3.35
const SUBSECTION_HEADER_MIN_H = 6.2
const SUBSECTION_HEADER_FONT_SIZE = 7.8

/** Measure label/criteria banner (wraps long text inside the rounded box). */
function getMacSubsectionHeaderMetrics(doc, title) {
  const text = String(title || "").trim().toUpperCase()
  if (!text) return { boxH: 0, blockH: 0 }
  const boxW = PAGE_WIDTH - 2 * MARGIN
  const innerW = Math.max(20, boxW - SUBSECTION_HEADER_PAD_X * 2)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(SUBSECTION_HEADER_FONT_SIZE)
  const lines = doc.splitTextToSize(text, innerW)
  const textH = lines.length * SUBSECTION_HEADER_LINE_H
  const boxH = Math.max(SUBSECTION_HEADER_MIN_H, SUBSECTION_HEADER_PAD_Y * 2 + textH + 0.6)
  return {
    boxH,
    blockH: boxH + PDF_THEME.spacing.subsectionAfterGap,
    lines,
    innerW,
  }
}

function drawMacSubsectionHeader(doc, y, title) {
  const text = String(title || "").trim().toUpperCase()
  if (!text) return y
  const boxW = PAGE_WIDTH - 2 * MARGIN
  const { boxH, blockH, lines } = getMacSubsectionHeaderMetrics(doc, title)
  if (blockH <= 0) return y

  doc.setDrawColor(...PDF_THEME.colors.sectionBorder)
  doc.setFillColor(248, 250, 253)
  doc.roundedRect(
    MARGIN,
    y,
    boxW,
    boxH,
    PDF_THEME.radius.section,
    PDF_THEME.radius.section,
    "FD",
  )
  doc.setFont("helvetica", "bold")
  doc.setFontSize(SUBSECTION_HEADER_FONT_SIZE)
  doc.setTextColor(55, 65, 81)
  doc.text(lines, MARGIN + SUBSECTION_HEADER_PAD_X, y + SUBSECTION_HEADER_PAD_Y + 2.1)
  doc.setTextColor(0, 0, 0)
  return y + blockH
}

function drawCoverPage(doc, meta, patient, visit, crfName, options = {}) {
  const showSubjectIdentity = options.showSubjectIdentity !== false
  drawHeaderBand(doc, meta, { showSubjectIdentity })

  const cardTop = BODY_TOP + 2
  const cardW = PAGE_WIDTH - 2 * MARGIN
  const cardH = 86
  doc.setDrawColor(0, 0, 0)
  doc.rect(MARGIN, cardTop, cardW, cardH)

  const leftX = MARGIN + 3
  const rightX = MARGIN + cardW / 2 + 3
  let y = cardTop + 8

  const leftPairs = [
    ["Study No.", meta.studyNo],
    ["Study Details", meta.studyTitle],
    ["Site No.", meta.siteNo],
  ]

  const rightPairs = showSubjectIdentity
    ? [
        ["Patient ID", meta.patientId],
        ["Patient Name / Initial", patient?.initial || patient?.name || patient?.patientName || ""],
        ["Visit", visit?.visitName || visit?.name || ""],
        ["CRF", crfName],
      ]
    : [
        ["Document", "Annotated Blank CRF"],
        ["CRF Type", meta.formType || visit?.visitName || visit?.name || ""],
        ["CRF Name", crfName],
        ["Version", meta.crfVersion ? `v${meta.crfVersion}` : "Current"],
      ]

  // Keep each key/value pair strictly inside its own half-card.
  const colInnerPad = 3
  const colGap = 3
  const colWidth = cardW / 2
  const contentWidth = colWidth - colInnerPad * 2
  const labelWidth = 34
  const valueWidth = Math.max(18, contentWidth - labelWidth - colGap)

  const drawPairColumn = (pairs, baseX) => {
    let curY = y
    for (const [k, v] of pairs) {
      const labelX = baseX
      const valueX = baseX + labelWidth + colGap

      doc.setFont("helvetica", "bold")
      doc.setFontSize(8.5)
      const labelLines = doc.splitTextToSize(String(k), labelWidth)
      doc.text(labelLines, labelX, curY)

      doc.setFont("helvetica", "normal")
      doc.setFontSize(8.5)
      const val = formatKeyValue(v)
      const valueLines = doc.splitTextToSize(val, valueWidth)
      doc.text(valueLines, valueX, curY)

      const maxLines = Math.max(labelLines.length, valueLines.length)
      curY += Math.max(7, maxLines * 4.4)
      if (curY > cardTop + cardH - 8) break
    }
  }

  // Column divider
  doc.setDrawColor(0, 0, 0)
  doc.line(MARGIN + cardW / 2, cardTop, MARGIN + cardW / 2, cardTop + cardH)

  drawPairColumn(leftPairs, leftX + colInnerPad)
  drawPairColumn(rightPairs, rightX + colInnerPad)

  // CRF name band (like reference)
  const bandY = cardTop + cardH + 10
  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.rect(MARGIN, bandY, cardW, 10)
  const title = (crfName || "CRF").toUpperCase()
  doc.text(title, MARGIN + cardW / 2 - doc.getTextWidth(title) / 2, bandY + 6.5)

  // Small note area
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(80, 80, 80)
  const note = `Note: This is an electronically generated report through ${APP_BRANDING.pdfProductName}.`
  doc.text(note, MARGIN, bandY + 18)
  doc.setTextColor(0, 0, 0)
}

function getTableRowHeight(doc, label, value, isSectionHeader = false) {
  const padding = 3
  doc.setFont("helvetica", "normal")
  doc.setFontSize(isSectionHeader ? 9 : 8)
  const labelMaxW = isSectionHeader ? PAGE_WIDTH - 2 * MARGIN - 4 : LABEL_COL_WIDTH - 4
  const labelLines = doc.splitTextToSize(String(label || "—"), labelMaxW)
  const labelH = labelLines.length * LINE_HEIGHT
  if (isSectionHeader) return Math.max(8, padding * 2 + labelH)
  doc.setFontSize(8)
  const valueLines = doc.splitTextToSize(String(value || "—"), VALUE_COL_WIDTH - 4)
  const valueH = valueLines.length * LINE_HEIGHT
  return Math.max(10, padding * 2 + Math.max(labelH, valueH))
}

function drawTableRow(doc, y, label, value, isSectionHeader = false) {
  const padding = 3
  doc.setDrawColor(0, 0, 0)

  if (isSectionHeader) {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    const labelLines = doc.splitTextToSize(String(label || "—"), PAGE_WIDTH - 2 * MARGIN - 4)
    const labelH = labelLines.length * LINE_HEIGHT
    const rowHeight = Math.max(8, padding * 2 + labelH)
    doc.setFillColor(245, 247, 255)
    doc.rect(MARGIN, y, PAGE_WIDTH - 2 * MARGIN, rowHeight, "FD")
    doc.rect(MARGIN, y, PAGE_WIDTH - 2 * MARGIN, rowHeight)
    doc.text(labelLines, MARGIN + 2, y + padding + 3)
    return y + rowHeight
  }

  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  const labelLines = doc.splitTextToSize(String(label || "—"), LABEL_COL_WIDTH - 4)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  const valueLines = doc.splitTextToSize(String(value || "—"), VALUE_COL_WIDTH - 4)
  const labelH = labelLines.length * LINE_HEIGHT
  const valueH = valueLines.length * LINE_HEIGHT
  const rowHeight = Math.max(10, padding * 2 + Math.max(labelH, valueH))

  doc.rect(MARGIN, y, LABEL_COL_WIDTH, rowHeight)
  doc.rect(MARGIN + LABEL_COL_WIDTH, y, VALUE_COL_WIDTH, rowHeight)

  doc.setFont("helvetica", "bold")
  doc.text(labelLines, MARGIN + 2, y + padding + 2)
  doc.setFont("helvetica", "normal")
  doc.text(valueLines, MARGIN + LABEL_COL_WIDTH + 2, y + padding + 2)
  return y + rowHeight
}

function extractControlOptions(control) {
  const props = control?.properties || {}
  const source =
    props.options ||
    props.items ||
    props.choices ||
    props.values ||
    control?.options ||
    []
  if (!Array.isArray(source)) return []
  return source
    .map((opt) => {
      if (opt == null) return ""
      if (typeof opt === "string" || typeof opt === "number") return String(opt)
      return String(opt.label ?? opt.text ?? opt.name ?? opt.value ?? opt.code ?? "")
    })
    .map((s) => normalizeMultilineText(s).trim())
    .filter(Boolean)
}

function getControlLabelInputGap() {
  return PDF_THEME.spacing.controlLabelInputGap ?? 1.5
}

function isCompactFilledChoiceType(type, pdfMode) {
  const t = String(type || "").toLowerCase()
  return pdfMode === "filled" && ["radio", "checkbox", "select", "dropdown"].includes(t)
}

/** Filled export: show selected value inside input (DD-style), optional dot for radio/checkbox. */
function drawFilledInputValue(doc, x, curY, width, displayText, { variant = "text" } = {}) {
  const inputX = x + 3
  const inputW = Math.max(20, width - 6)
  const inputH = PDF_THEME.spacing.controlInputHeight
  const value = displayText || "—"
  doc.setDrawColor(...PDF_THEME.colors.inputBorder)
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(inputX, curY, inputW, inputH, PDF_THEME.radius.input, PDF_THEME.radius.input, "FD")
  doc.setFont("helvetica", "normal")
  doc.setFontSize(PDF_THEME.font.controlInput)
  doc.setTextColor(30, 41, 59)
  let textX = inputX + 2.2
  if (variant === "choice" && value !== "—") {
    doc.setFillColor(79, 70, 229)
    doc.circle(inputX + 2.6, curY + inputH * 0.52, 0.55, "F")
    textX = inputX + 5.4
  }
  if (variant === "select") {
    doc.setTextColor(...PDF_THEME.colors.helperText)
    doc.setFontSize(PDF_THEME.font.controlHelper)
    doc.text("v", inputX + inputW - 3.2, curY + inputH * 0.65)
    doc.setFontSize(PDF_THEME.font.controlInput)
    doc.setTextColor(30, 41, 59)
  }
  const valueLines = doc.splitTextToSize(value, inputW - (variant === "choice" ? 9 : 6))
  doc.text(valueLines[0] || value, textX, curY + inputH * 0.65)
  doc.setTextColor(0, 0, 0)
}

function drawTableCellFilledValue(doc, cellX, rowY, colWidth, rowHeight, value, cellType) {
  const padding = 1.8
  const boxX = cellX + 1.2
  const boxY = rowY + 1.2
  const boxW = colWidth - 2.4
  const boxH = Math.min(rowHeight - 2.4, 7.5)
  const display = value || "—"
  const type = String(cellType || "").toLowerCase()
  const isChoice = ["radio", "checkbox", "select", "dropdown"].includes(type)
  doc.setDrawColor(...PDF_THEME.colors.inputBorder)
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(boxX, boxY, boxW, boxH, PDF_THEME.radius.tableCellInput, PDF_THEME.radius.tableCellInput, "FD")
  doc.setFont("helvetica", "normal")
  doc.setFontSize(PDF_THEME.font.tableCellInput)
  doc.setTextColor(30, 41, 59)
  let textX = boxX + 1.4
  if (isChoice && display !== "—") {
    doc.setFillColor(79, 70, 229)
    doc.circle(boxX + 2.2, boxY + boxH * 0.52, 0.45, "F")
    textX = boxX + 4.2
  }
  if (type === "select" || type === "dropdown") {
    doc.setTextColor(...PDF_THEME.colors.helperText)
    doc.setFontSize(PDF_THEME.font.tableCellChoice)
    doc.text("v", boxX + boxW - 2.6, boxY + boxH * 0.58)
    doc.setFontSize(PDF_THEME.font.tableCellInput)
    doc.setTextColor(30, 41, 59)
  }
  const lines = doc.splitTextToSize(display, Math.max(8, boxW - (isChoice ? 8 : 4)))
  doc.text(lines[0] || display, textX, boxY + boxH * 0.58)
  doc.setTextColor(0, 0, 0)
}

function measureAnnotatedControlHeight(doc, control, width, pdfMode = "blank") {
  const innerWidth = Math.max(28, width - 8)
  const label = normalizeMultilineText(control?.label || control?.properties?.labelText || "Field")
  const required = !!(control?.properties?.required || control?.properties?.conditionallyRequired)
  const finalLabel = `${label}${required ? " *" : ""}`
  const labelLines = doc.splitTextToSize(finalLabel, innerWidth)
  const labelH = labelLines.length * PDF_THEME.spacing.controlLabelLineHeight
  const type = String(control?.type || "").toLowerCase()
  const options = extractControlOptions(control)
  const top = PDF_THEME.spacing.controlTopPadding
  const bottom = PDF_THEME.spacing.controlBottomPadding
  const inputH = PDF_THEME.spacing.controlInputHeight
  const labelGap = getControlLabelInputGap()

  if (type === "textarea") {
    const display =
      pdfMode === "filled" ? normalizeMultilineText(getDisplayValue(control, "filled")) : ""
    const valueLines = display ? doc.splitTextToSize(display, innerWidth) : []
    const boxH = display ? Math.max(12, valueLines.length * 3.15 + 3) : 14
    return top + labelH + labelGap + boxH + bottom
  }
  if (isCompactFilledChoiceType(type, pdfMode)) {
    return top + labelH + labelGap + inputH + bottom
  }
  if (type === "radio" || type === "checkbox") {
    const renderedOptions = options.length > 0 ? options.slice(0, 9) : ["Yes", "No"]
    const rows = Math.ceil(renderedOptions.length / 2)
    return top + labelH + labelGap + Math.max(6.5, rows * 5.1) + bottom
  }
  if (type === "select" || type === "dropdown") {
    // Blank annotated PDFs render a one-line helper hint under the select.
    // Keep this conservative so helper text never overlaps the next row.
    const helper = pdfMode === "blank" && options.length > 0 ? 5.0 : 0
    return top + labelH + labelGap + inputH + helper + bottom
  }
  if (type === "table") return 12
  return top + labelH + labelGap + inputH + bottom
}

function getBlankControlHeight(doc, control, width = PAGE_WIDTH - 2 * MARGIN) {
  return measureAnnotatedControlHeight(doc, control, width, "blank")
}

function inferBlankInputPlaceholder(control, type) {
  const props = control?.properties || {}
  const explicit = normalizeMultilineText(
    props.placeholder || props.placeHolder || props.inputPlaceholder || ""
  ).trim()
  if (explicit) return explicit
  if (type === "date") return "dd-mmm-yyyy"
  if (type === "datetime") return "dd-mmm-yyyy hh:mm"
  if (type === "time") return "hh:mm"
  if (type === "select" || type === "dropdown") return "Select..."
  return ""
}

function drawBlankControlRow(doc, y, control, layout = {}) {
  const x = Number.isFinite(layout?.x) ? layout.x : MARGIN
  const width = Number.isFinite(layout?.width) ? layout.width : (PAGE_WIDTH - 2 * MARGIN)
  const type = String(control?.type || "").toLowerCase()
  const label = normalizeMultilineText(control?.label || control?.properties?.labelText || "Field")
  const required = !!(control?.properties?.required || control?.properties?.conditionallyRequired)
  const finalLabel = `${label}${required ? " *" : ""}`
  const rowH = getBlankControlHeight(doc, control, width)

  doc.setDrawColor(...PDF_THEME.colors.cardBorder)
  doc.setFillColor(...PDF_THEME.colors.cardFill)
  doc.roundedRect(x, y, width, rowH, PDF_THEME.radius.card, PDF_THEME.radius.card, "FD")

  let curY = y + PDF_THEME.spacing.controlTopPadding
  doc.setFont("helvetica", "normal")
  doc.setFontSize(PDF_THEME.font.controlLabel)
  const labelLines = doc.splitTextToSize(finalLabel, Math.max(20, width - 8))
  doc.text(labelLines, x + 3, curY)
  curY += labelLines.length * PDF_THEME.spacing.controlLabelLineHeight + getControlLabelInputGap()

  if (type === "radio" || type === "checkbox") {
    const options = extractControlOptions(control)
    const renderedOptions = options.length > 0 ? options.slice(0, 9) : ["Yes", "No"]
    const colWidth = Math.max(24, (width - 8) / 2)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(PDF_THEME.font.controlLabel)
    renderedOptions.forEach((opt, idx) => {
      const col = idx % 2
      const row = Math.floor(idx / 2)
      const ox = x + 3 + col * colWidth
      const oy = curY + row * 5.4
      if (type === "checkbox") {
        doc.rect(ox + 0.3, oy - 2.0, 2.0, 2.0)
      } else {
        doc.circle(ox + 1.4, oy - 1.2, 1.0)
      }
      const txt = doc.splitTextToSize(opt, Math.max(18, colWidth - 6))
      doc.text(txt[0] || "", ox + 4, oy)
    })
  } else if (type === "select" || type === "dropdown") {
    const options = extractControlOptions(control)
    const inputX = x + 3
    const inputW = Math.max(20, width - 6)
    doc.setDrawColor(...PDF_THEME.colors.inputBorder)
    const inputH = PDF_THEME.spacing.controlInputHeight
    doc.roundedRect(inputX, curY, inputW, inputH, PDF_THEME.radius.input, PDF_THEME.radius.input, "S")
    doc.setFont("helvetica", "normal")
    doc.setFontSize(PDF_THEME.font.controlInput)
    doc.setTextColor(...PDF_THEME.colors.placeholderText)
    const placeholder = inferBlankInputPlaceholder(control, type) || "Select..."
    doc.text(placeholder, inputX + 2.2, curY + inputH * 0.65)
    doc.setTextColor(...PDF_THEME.colors.helperText)
    doc.text("v", inputX + inputW - 3.5, curY + 4.6)
    if (options.length > 0) {
      const optionsText = options.join(" / ")
      const optionLines = doc.splitTextToSize(optionsText, inputW - 8)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(PDF_THEME.font.controlHelper)
      doc.setTextColor(...PDF_THEME.colors.helperText)
      // Render only first line to avoid excessive vertical whitespace in paired rows.
      const firstLine = optionLines[0] || ""
      doc.text(firstLine, inputX + 2.2, curY + 11.8)
    }
    doc.setTextColor(0, 0, 0)
  } else if (type === "textarea") {
    doc.setDrawColor(...PDF_THEME.colors.inputBorder)
    doc.roundedRect(
      x + 3,
      curY,
      Math.max(20, width - 6),
      18,
      PDF_THEME.radius.input,
      PDF_THEME.radius.input,
      "S",
    )
  } else {
    const inputX = x + 3
    const inputW = Math.max(20, width - 6)
    const inputH = PDF_THEME.spacing.controlInputHeight
    doc.setDrawColor(...PDF_THEME.colors.inputBorder)
    doc.roundedRect(inputX, curY, inputW, inputH, PDF_THEME.radius.input, PDF_THEME.radius.input, "S")
    const placeholder = inferBlankInputPlaceholder(control, type)
    if (placeholder) {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(PDF_THEME.font.controlInput)
      doc.setTextColor(...PDF_THEME.colors.placeholderText)
      doc.text(placeholder, inputX + 2.2, curY + inputH * 0.65)
      doc.setTextColor(0, 0, 0)
    }
  }

  return y + rowH
}

function getControlSelectionLabels(control) {
  const type = String(control?.type || "").toLowerCase()
  if (!["checkbox", "radio", "select", "dropdown"].includes(type)) return new Set()
  const display = normalizeMultilineText(getDisplayValue(control, "filled"))
  if (!display) return new Set()
  const parts =
    type === "checkbox"
      ? display.split(",").map((s) => s.trim()).filter(Boolean)
      : display.split(/\n/).map((s) => s.trim()).filter(Boolean)
  return new Set(parts.map((p) => normalizeMultilineText(p)))
}

function optionIsSelected(optionLabel, selectedSet) {
  const opt = normalizeMultilineText(optionLabel)
  if (!opt || selectedSet.size === 0) return false
  if (selectedSet.has(opt)) return true
  for (const sel of selectedSet) {
    if (sel && (opt.includes(sel) || sel.includes(opt))) return true
  }
  return false
}

function getFilledControlHeight(doc, control, width = PAGE_WIDTH - 2 * MARGIN) {
  return measureAnnotatedControlHeight(doc, control, width, "filled")
}

function drawFilledControlRow(doc, y, control, layout = {}) {
  const x = Number.isFinite(layout?.x) ? layout.x : MARGIN
  const width = Number.isFinite(layout?.width) ? layout.width : PAGE_WIDTH - 2 * MARGIN
  const type = String(control?.type || "").toLowerCase()
  const label = normalizeMultilineText(control?.label || control?.properties?.labelText || "Field")
  const required = !!(control?.properties?.required || control?.properties?.conditionallyRequired)
  const finalLabel = `${label}${required ? " *" : ""}`
  const rowH = getFilledControlHeight(doc, control, width)
  const display = normalizeMultilineText(getDisplayValue(control, "filled"))
  const displayText = display || "—"

  doc.setDrawColor(...PDF_THEME.colors.cardBorder)
  doc.setFillColor(...PDF_THEME.colors.cardFill)
  doc.roundedRect(x, y, width, rowH, PDF_THEME.radius.card, PDF_THEME.radius.card, "FD")

  let curY = y + PDF_THEME.spacing.controlTopPadding
  doc.setFont("helvetica", "normal")
  doc.setFontSize(PDF_THEME.font.controlLabel)
  doc.setTextColor(48, 56, 76)
  const labelLines = doc.splitTextToSize(finalLabel, Math.max(20, width - 8))
  doc.text(labelLines, x + 3, curY)
  curY += labelLines.length * PDF_THEME.spacing.controlLabelLineHeight + getControlLabelInputGap()

  if (isCompactFilledChoiceType(type, "filled")) {
    const variant = type === "radio" || type === "checkbox" ? "choice" : "select"
    drawFilledInputValue(doc, x, curY, width, displayText, { variant })
  } else if (type === "textarea") {
    const inputX = x + 3
    const inputW = Math.max(20, width - 6)
    const boxH = Math.max(14, rowH - (curY - y) - 2)
    doc.setDrawColor(...PDF_THEME.colors.inputBorder)
    doc.setFillColor(255, 255, 255)
    doc.roundedRect(inputX, curY, inputW, boxH, PDF_THEME.radius.input, PDF_THEME.radius.input, "FD")
    doc.setFont("helvetica", "normal")
    doc.setFontSize(PDF_THEME.font.controlInput)
    doc.setTextColor(30, 41, 59)
    const valueLines = doc.splitTextToSize(displayText, inputW - 6)
    doc.text(valueLines, inputX + 2.2, curY + 4.2)
  } else {
    drawFilledInputValue(doc, x, curY, width, displayText, { variant: "text" })
  }

  doc.setTextColor(0, 0, 0)
  return y + rowH
}

/** Labels longer than this use full-width cards (no side-by-side pairing). */
const PDF_PAIR_MAX_LABEL_CHARS = 44

function controlLabelTooLongForPairing(control) {
  const lbl = normalizeMultilineText(control?.label || control?.properties?.labelText || "")
  return lbl.length > PDF_PAIR_MAX_LABEL_CHARS
}

/** 3–4 column rows are disabled; layout is always at most 2 fields per row. */
function tryRenderMultiColumnRow() {
  return null
}

function renderAnnotatedSectionControls(doc, y, controls, pdfMode, startDetailPage) {
  const drawRow = pdfMode === "blank" ? drawBlankControlRow : drawFilledControlRow
  const measureRow = pdfMode === "blank" ? getBlankControlHeight : getFilledControlHeight
  const list = (controls || []).filter(Boolean)

  for (let controlIndex = 0; controlIndex < list.length; controlIndex += 1) {
    const control = list[controlIndex]
    const type = (control.type || "").toLowerCase()
    if (type === "hr") continue

    if (type === "label") {
      const labelText = normalizeMultilineText(
        control.label || control.properties?.labelText || control.properties?.text || control.properties?.title || "",
      )
      if (!labelText) continue
      const sub = labelText.toUpperCase()
      const { blockH: labelBlockH } = getMacSubsectionHeaderMetrics(doc, sub)
      if (labelBlockH <= 0) continue
      y = ensureSpace(doc, y, labelBlockH, startDetailPage)
      y = drawMacSubsectionHeader(doc, y, sub)
      continue
    }

    if (type === "table" && isStructuredTableValue(control.value)) {
      const label = normalizeMultilineText(control.label || control.properties?.labelText || "")
      const tableTitle = label && label.toLowerCase() !== "field" ? label : ""
      const tableTitleBlockH = tableTitle
        ? getMacSubsectionHeaderMetrics(doc, tableTitle.toUpperCase()).blockH
        : 0
      const titleNeed = (tableTitleBlockH || 0) + 8
      y = ensureSpace(doc, y, titleNeed, startDetailPage)
      y = drawStructuredTablePaginated(doc, y, control.value, startDetailPage, {
        repeatHeader: true,
        pdfMode,
        tableTitle,
      })
      continue
    }

    const multi = tryRenderMultiColumnRow(doc, y, list, controlIndex, pdfMode, startDetailPage, drawRow, measureRow)
    if (multi) {
      y = multi.y
      controlIndex = multi.nextIndex
      continue
    }

    const columnGap = PDF_THEME.spacing.multiColumnGap ?? 3
    const halfWidth = (PAGE_WIDTH - 2 * MARGIN - columnGap) / 2
    const isFullWidth = shouldRenderBlankControlFullWidth(control)
    const nextControl = list[controlIndex + 1]
    const nextType = String(nextControl?.type || "").toLowerCase()
    const canPair =
      !isFullWidth &&
      !!nextControl &&
      !shouldRenderBlankControlFullWidth(nextControl) &&
      nextType !== "table" &&
      nextType !== "label" &&
      !controlLabelTooLongForPairing(control) &&
      !controlLabelTooLongForPairing(nextControl)

    if (canPair) {
      const leftH = measureRow(doc, control, halfWidth)
      const rightH = measureRow(doc, nextControl, halfWidth)
      const rowH = Math.max(leftH, rightH)
      y = ensureSpace(doc, y, rowH, startDetailPage)
      drawRow(doc, y, control, { x: MARGIN, width: halfWidth })
      drawRow(doc, y, nextControl, { x: MARGIN + halfWidth + columnGap, width: halfWidth })
      y += rowH + PDF_THEME.spacing.controlRowGap
      controlIndex += 1
    } else {
      const need = measureRow(doc, control, PAGE_WIDTH - 2 * MARGIN)
      y = ensureSpace(doc, y, need, startDetailPage)
      y = drawRow(doc, y, control, { x: MARGIN, width: PAGE_WIDTH - 2 * MARGIN })
      y += PDF_THEME.spacing.controlRowGap
    }
  }

  return y
}

function shouldRenderBlankControlFullWidth(control) {
  const type = String(control?.type || "").toLowerCase()
  if (type === "textarea" || type === "table" || type === "label" || type === "hr") return true
  const props = control?.properties || {}
  if (props.fullWidth === true || props.isFullWidth === true || props.columnSpan >= 2) return true
  return false
}

function isStructuredTableValue(value) {
  return Boolean(value && typeof value === "object" && value.__table === true && Array.isArray(value.rows))
}

function getStructuredTableHeight(doc, tableValue) {
  const headers = Array.isArray(tableValue?.headers) ? tableValue.headers : []
  const rows = Array.isArray(tableValue?.rows) ? tableValue.rows : []
  const columnCount = Math.max(1, headers.length, ...rows.map((r) => (Array.isArray(r) ? r.length : 0)))
  const tableWidth = PAGE_WIDTH - 2 * MARGIN
  const colWidth = tableWidth / columnCount
  const padding = 1.8
  const minRowHeight = 6

  const calcRowHeight = (cells, isHeader = false) => {
    const safeCells = Array.from({ length: columnCount }, (_, i) =>
      normalizePdfValueText(String(cells?.[i] ?? (isHeader ? `Column ${i + 1}` : "—"))),
    )
    const lineCounts = safeCells.map((cell) => {
      doc.setFont("helvetica", isHeader ? "bold" : "normal")
      doc.setFontSize(8)
      return doc.splitTextToSize(cell, Math.max(8, colWidth - padding * 2)).length
    })
    const maxLines = Math.max(1, ...lineCounts)
    // jsPDF's effective line spacing is a bit higher than 3.8 for our font size.
    // Using a slightly larger factor keeps rowHeight from underestimating.
    return Math.max(minRowHeight, padding * 2 + maxLines * 4.1)
  }

  let height = 0
  height += calcRowHeight(headers, true)
  rows.forEach((row) => {
    height += calcRowHeight(row, false)
  })
  return height
}

function drawStructuredTable(doc, y, tableValue) {
  const headers = Array.isArray(tableValue?.headers) ? tableValue.headers : []
  const rows = Array.isArray(tableValue?.rows) ? tableValue.rows : []
  const columnCount = Math.max(1, headers.length, ...rows.map((r) => (Array.isArray(r) ? r.length : 0)))
  const tableWidth = PAGE_WIDTH - 2 * MARGIN
  const colWidth = tableWidth / columnCount
  const padding = 1.8
  const minRowHeight = 6

  const drawRow = (cells, isHeader = false) => {
    const safeCells = Array.from({ length: columnCount }, (_, i) =>
      normalizePdfValueText(String(cells?.[i] ?? (isHeader ? `Column ${i + 1}` : "—"))),
    )
    const lineCounts = safeCells.map((cell) => {
      doc.setFont("helvetica", isHeader ? "bold" : "normal")
      doc.setFontSize(8)
      return doc.splitTextToSize(cell, Math.max(8, colWidth - padding * 2)).length
    })
    const maxLines = Math.max(1, ...lineCounts)
    const rowHeight = Math.max(minRowHeight, padding * 2 + maxLines * 4.1)

    for (let i = 0; i < columnCount; i++) {
      const cellX = MARGIN + i * colWidth
      doc.setDrawColor(0, 0, 0)
      if (isHeader) {
        doc.setFillColor(245, 247, 255)
        doc.rect(cellX, y, colWidth, rowHeight, "FD")
      } else {
        doc.rect(cellX, y, colWidth, rowHeight)
      }
      doc.setFont("helvetica", isHeader ? "bold" : "normal")
      doc.setFontSize(8)
      const lines = doc.splitTextToSize(safeCells[i], Math.max(8, colWidth - padding * 2))
      doc.text(lines, cellX + padding, y + padding + 2)
    }
    y += rowHeight
  }

  drawRow(headers, true)
  rows.forEach((row) => drawRow(row, false))
  return y
}

/**
 * Structured table with pagination support.
 * jsPDF tables are drawn row-by-row; if remaining space is not enough for the next row,
 * we create a new page, redraw CRF header/title bars, and (optionally) repeat the table header.
 */
function drawStructuredTablePaginated(
  doc,
  y,
  tableValue,
  startDetailPage,
  { repeatHeader = true, pdfMode = "filled", tableTitle = "" } = {},
) {
  const headers = Array.isArray(tableValue?.headers) ? tableValue.headers : []
  const rows = Array.isArray(tableValue?.rows) ? tableValue.rows : []
  const cellMetaRows = Array.isArray(tableValue?.cellMetaRows) ? tableValue.cellMetaRows : []
  const cellTypes = Array.isArray(tableValue?.cellTypes) ? tableValue.cellTypes : []
  const columnTypes = Array.isArray(tableValue?.columnTypes) ? tableValue.columnTypes : []
  const columnOptionValues = Array.isArray(tableValue?.columnOptionValues) ? tableValue.columnOptionValues : []

  const columnCount = Math.max(1, headers.length, ...rows.map((r) => (Array.isArray(r) ? r.length : 0)))
  const tableWidth = PAGE_WIDTH - 2 * MARGIN
  const colWidth = tableWidth / columnCount
  const padding = 1.8
  const minRowHeight = 6

  const getCellTypeAndOptions = (rowIdx, colIdx) => {
    const prebuiltMeta = cellMetaRows?.[rowIdx]?.[colIdx]
    if (prebuiltMeta && typeof prebuiltMeta === "object") {
      const preOpts = Array.isArray(prebuiltMeta.options) ? prebuiltMeta.options : []
      return {
        cellType: String(prebuiltMeta.type || "").toLowerCase(),
        optionList: preOpts.map(normalizePdfTableOptionForLegend).filter(Boolean),
        isLabelCell: prebuiltMeta.isLabelCell === true,
      }
    }
    const cellType = String(cellTypes?.[rowIdx]?.[colIdx] || columnTypes?.[colIdx] || "").toLowerCase()
    const rawOptions = columnOptionValues?.[colIdx]
    const optionListRaw = Array.isArray(rawOptions)
      ? rawOptions.map((v) => String(v ?? "").trim()).filter(Boolean)
      : typeof rawOptions === "string"
        ? rawOptions.split(",").map((v) => v.trim()).filter(Boolean)
        : []
    const optionList = optionListRaw.map(normalizePdfTableOptionForLegend).filter(Boolean)
    return { cellType, optionList, isLabelCell: cellType === "label" }
  }

  const drawDropdownLegend = () => {
    if (pdfMode !== "blank") return
    const parts = []
    for (let i = 0; i < columnCount; i += 1) {
      const header = String(headers?.[i] ?? `Column ${i + 1}`).trim()
      const rawOptions = columnOptionValues?.[i]
      const optionListRaw = Array.isArray(rawOptions)
        ? rawOptions.map((v) => String(v ?? "").trim()).filter(Boolean)
        : typeof rawOptions === "string"
          ? rawOptions.split(",").map((v) => v.trim()).filter(Boolean)
          : []
      const optionList = optionListRaw.map(normalizePdfTableOptionForLegend).filter(Boolean)
      if (optionList.length === 0) continue
      const colType = String(columnTypes?.[i] || "").toLowerCase()
      const isOptionColumn = ["select", "dropdown", "radio", "checkbox"].includes(colType) || optionList.length > 0
      if (!isOptionColumn) continue
      parts.push({ header, text: optionList.join(" / ") })
    }

    if (parts.length === 0) return

    const contentWidth = PAGE_WIDTH - 2 * MARGIN - 4
    const labelPrefix = "Options"
    const sectionGap = 0.9
    let legendHeight = 3.8 // top padding

    // Pre-calculate height line-by-line so the box is exact.
    parts.forEach((part) => {
      const headerText = `${part.header}:`
      const headerW = doc.getTextWidth(headerText)
      const valueMaxW = Math.max(10, contentWidth - headerW - 1.2)
      const valueLines = doc.splitTextToSize(part.text || "", valueMaxW)
      const rowLines = Math.max(1, valueLines.length)
      legendHeight += rowLines * 3.2 + sectionGap
    })
    legendHeight += 2.0 // bottom padding

    ensureRowFits(legendHeight)

    doc.setDrawColor(...PDF_THEME.colors.legendBorder)
    doc.setFillColor(...PDF_THEME.colors.legendFill)
    doc.roundedRect(
      MARGIN,
      y,
      PAGE_WIDTH - 2 * MARGIN,
      legendHeight,
      PDF_THEME.radius.legend,
      PDF_THEME.radius.legend,
      "FD",
    )

    const startX = MARGIN + 2
    let cursorY = y + 3.6
    doc.setTextColor(...PDF_THEME.colors.legendText)

    doc.setFont("helvetica", "bold")
    doc.setFontSize(PDF_THEME.font.legend)
    doc.text(`${labelPrefix}:`, startX, cursorY)
    cursorY += 3.2

    parts.forEach((part) => {
      const headerText = `${part.header}:`
      doc.setFont("helvetica", "bold")
      const headerW = doc.getTextWidth(headerText)
      doc.text(headerText, startX, cursorY)

      doc.setFont("helvetica", "normal")
      const valueMaxW = Math.max(10, contentWidth - headerW - 1.2)
      const valueLines = doc.splitTextToSize(part.text || "", valueMaxW)
      if (valueLines.length > 0) {
        doc.text(valueLines, startX + headerW + 1.2, cursorY)
      }
      const rowLines = Math.max(1, valueLines.length)
      cursorY += rowLines * 3.2 + sectionGap
    })

    doc.setTextColor(0, 0, 0)
    y += legendHeight + 1.2
  }

  /** Blank PDF: compact row height for table cells (no full radio option lists). */
  const measureBlankDataRowHeight = (rowIdx, cells) => {
    let maxH = Math.max(minRowHeight, 10)
    for (let i = 0; i < columnCount; i += 1) {
      const { cellType, optionList, isLabelCell } = getCellTypeAndOptions(rowIdx, i)
      const safeCell = normalizePdfValueText(String(cells?.[i] ?? "—"))
      const isOptionCell = ["select", "dropdown", "radio", "checkbox"].includes(cellType)
      const isStaticCell =
        isLabelCell || (!isOptionCell && safeCell && safeCell !== "—")

      if (isStaticCell) {
        doc.setFont("helvetica", "normal")
        doc.setFontSize(8)
        const lines = doc.splitTextToSize(safeCell, Math.max(8, colWidth - padding * 2))
        const h = padding * 2 + lines.length * 4.1
        maxH = Math.max(maxH, h)
      } else if (isOptionCell) {
        maxH = Math.max(maxH, 8.8)
      }
    }
    return maxH
  }

  const formatTableCell = (raw, rowIdx, colIdx, isHeader) => {
    const text = String(raw ?? (isHeader ? `Column ${colIdx + 1}` : "—"))
    if (isHeader) return normalizePdfValueText(text)
    const { cellType } = getCellTypeAndOptions(rowIdx, colIdx)
    return formatPdfTableCellText(normalizePdfValueText(text), cellType)
  }

  const calcRowHeight = (cells, isHeader, rowIdx = -1) => {
    if (!isHeader && pdfMode === "blank") {
      if (rowIdx >= 0) return measureBlankDataRowHeight(rowIdx, cells)
      return Math.max(minRowHeight, 10)
    }
    if (!isHeader && pdfMode === "filled") {
      let maxH = minRowHeight
      for (let i = 0; i < columnCount; i += 1) {
        const { cellType } = getCellTypeAndOptions(rowIdx, i)
        const isChoice = ["radio", "checkbox", "select", "dropdown"].includes(cellType)
        if (isChoice) {
          maxH = Math.max(maxH, 8.8)
        } else {
          const cell = formatTableCell(cells?.[i], rowIdx, i, isHeader)
          doc.setFont("helvetica", "normal")
          doc.setFontSize(8)
          const lines = doc.splitTextToSize(cell, Math.max(8, colWidth - padding * 2)).length
          maxH = Math.max(maxH, padding * 2 + lines * 4.1)
        }
      }
      return maxH
    }
    const safeCells = Array.from({ length: columnCount }, (_, i) =>
      formatTableCell(cells?.[i], rowIdx, i, isHeader),
    )
    const lineCounts = safeCells.map((cell) => {
      doc.setFont("helvetica", isHeader ? "bold" : "normal")
      doc.setFontSize(8)
      return doc.splitTextToSize(cell, Math.max(8, colWidth - padding * 2)).length
    })
    const maxLines = Math.max(1, ...lineCounts)
    return Math.max(minRowHeight, padding * 2 + maxLines * 4.1)
  }

  const drawRowAt = (cells, rowY, isHeader, rowIdx = -1) => {
    const safeCells = Array.from({ length: columnCount }, (_, i) =>
      formatTableCell(cells?.[i], rowIdx, i, isHeader),
    )
    const rowHeight = calcRowHeight(cells, isHeader, rowIdx)

    for (let i = 0; i < columnCount; i++) {
      const cellX = MARGIN + i * colWidth
      doc.setDrawColor(...PDF_THEME.colors.sectionBorder)
      if (isHeader) {
        doc.setFillColor(...PDF_THEME.colors.sectionFill)
        doc.rect(cellX, rowY, colWidth, rowHeight, "FD")
        doc.rect(cellX, rowY, colWidth, rowHeight)
      } else {
        doc.setFillColor(255, 255, 255)
        doc.rect(cellX, rowY, colWidth, rowHeight, "FD")
        doc.rect(cellX, rowY, colWidth, rowHeight)
      }

      if (!isHeader && pdfMode === "blank") {
        const { cellType, optionList, isLabelCell } = getCellTypeAndOptions(rowIdx, i)
        const isOptionCell = ["select", "dropdown", "radio", "checkbox"].includes(cellType)
        const isStaticCell =
          isLabelCell || (!isOptionCell && safeCells[i] && safeCells[i] !== "—")

        if (isStaticCell) {
          doc.setFont("helvetica", "normal")
          doc.setFontSize(8)
          const lines = doc.splitTextToSize(safeCells[i], Math.max(8, colWidth - padding * 2))
          doc.text(lines, cellX + padding, rowY + padding + 2)
        } else {
          const boxX = cellX + 1.2
          const boxY = rowY + 1.2
          const boxW = colWidth - 2.4
          const boxH = rowHeight - 2.4
          doc.setDrawColor(...PDF_THEME.colors.inputBorder)
          doc.roundedRect(
            boxX,
            boxY,
            boxW,
            boxH,
            PDF_THEME.radius.tableCellInput,
            PDF_THEME.radius.tableCellInput,
            "S",
          )

          if (isOptionCell) {
            doc.setFont("helvetica", "normal")
            doc.setFontSize(PDF_THEME.font.tableCellInput)
            doc.setTextColor(...PDF_THEME.colors.placeholderText)
            doc.text("Select...", boxX + 1.4, boxY + boxH / 2 + 0.9)
            doc.setTextColor(...PDF_THEME.colors.helperText)
            doc.text("v", boxX + boxW - 2.8, boxY + boxH / 2 + 0.9)
            doc.setTextColor(0, 0, 0)
          }
        }
      } else if (!isHeader && pdfMode === "filled") {
        const { cellType } = getCellTypeAndOptions(rowIdx, i)
        const val = safeCells[i]
        const isChoiceCell = ["radio", "checkbox", "select", "dropdown"].includes(cellType)
        if (isChoiceCell) {
          drawTableCellFilledValue(doc, cellX, rowY, colWidth, rowHeight, val, cellType)
        } else {
          doc.setFont("helvetica", "normal")
          doc.setFontSize(8)
          const lines = doc.splitTextToSize(val, Math.max(8, colWidth - padding * 2))
          doc.text(lines, cellX + padding, rowY + padding + 2)
        }
      } else {
        doc.setFont("helvetica", isHeader ? "bold" : "normal")
        doc.setFontSize(8)
        const lines = doc.splitTextToSize(safeCells[i], Math.max(8, colWidth - padding * 2))
        doc.text(lines, cellX + padding, rowY + padding + 2)
      }
    }

    return rowHeight
  }

  const ensureRowFits = (rowHeight) => {
    if (y + rowHeight <= BODY_BOTTOM) return
    doc.addPage()
    y = startDetailPage()
  }

  if (tableTitle) {
    const titleNeed = 6.2 + PDF_THEME.spacing.subsectionAfterGap
    ensureRowFits(titleNeed)
    y = drawMacSubsectionHeader(doc, y, tableTitle)
  }

  if (repeatHeader) {
    drawDropdownLegend()
    const headerRowHeight = calcRowHeight(headers, true, -1)
    ensureRowFits(headerRowHeight)
    const used = drawRowAt(headers, y, true, -1)
    y += used
  }

  rows.forEach((row, rowIdx) => {
    const rowHeight = calcRowHeight(row, false, rowIdx)
    ensureRowFits(rowHeight)
    const used = drawRowAt(row, y, false, rowIdx)
    y += used
  })

  return y
}

function ensureSpace(doc, y, needed, renderNewPageHeader) {
  // Add a small safety buffer to avoid border/text collisions near the footer,
  // especially when jsPDF line spacing rounds differently across devices.
  const safeNeeded = (Number(needed) || 0) + 1.2
  if (y + safeNeeded <= BODY_BOTTOM) return y
  doc.addPage()
  if (typeof renderNewPageHeader === "function") return renderNewPageHeader()
  return BODY_TOP
}

function getDisplayValue(control, pdfMode = "filled") {
  if (!control) return ""
  const type = (control.type || "").toLowerCase()
  const rawValue = control.value

  if (type === "table") {
    // Tables can be stored as nested JSON or flattened keys; rendering a full grid needs CRF schema.
    // We still show something meaningful instead of "[object Object]" or skipping.
    if (rawValue == null || rawValue === "") return ""
    if (typeof rawValue === "string") return normalizePdfValueText(rawValue)
    try {
      return normalizePdfValueText(JSON.stringify(rawValue, null, 2))
    } catch {
      return ""
    }
  }

  // Checkbox/Select/Radio:
  // - with data: show only selected values
  // - blank: show available options so the CRF layout doesn't look empty
  // Some CRFs store dropdown controls as "dropdown" instead of "select".
  if (type === "checkbox" || type === "radio" || type === "select" || type === "dropdown") {
    const options = Array.isArray(control.options) ? control.options : []

    // If backend stores dropdown selections as { value, label } keep label to match UI.
    // This is the primary fix for encoded dropdowns (e.g. Kuppuswamy income) where formData.value is encoded.
    if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)) {
      const label =
        rawValue.label ??
        rawValue.Label ??
        rawValue.displayLabel ??
        rawValue.display ??
        rawValue.text ??
        rawValue.name ??
        rawValue.labelText
      const value = rawValue.value ?? rawValue.Value
      const chosen = label ?? value
      const isEncoded = typeof value === "string" && /[&＆]\d/.test(value)
      if (isEncoded) {
        // Log only the structure of this object so we can quickly fix label-key mapping if needed.
        // This is critical for your root-cause tracking.
        ecrfPdfDebugIfEncodedSpecial(
          `control:${control.label || control.id || "unknown"}(object-keys)`,
          String(value ?? ""),
          { objectKeys: Object.keys(rawValue), hasLabel: label != null, chosenPreview: String(chosen ?? "").slice(0, 80) }
        )
      }

      if (chosen !== undefined && chosen !== null && String(chosen).trim() !== "") {
        ecrfPdfDebugIfEncodedSpecial(`control:${control.label || control.id || "unknown"}(object)`, String(value ?? ""), { type })
        return normalizePdfValueText(String(chosen))
      }
    }

    // Multi-select may also arrive as array of { value, label } objects.
    if (Array.isArray(rawValue) && rawValue.length > 0 && rawValue.some((v) => v && typeof v === "object")) {
      const labels = rawValue
        .map((v) => {
          if (!v || typeof v !== "object") return v
          return v.label ?? v.Label ?? v.value ?? v.Value ?? ""
        })
        .map((v) => (v == null ? "" : String(v)).trim())
        .filter(Boolean)
      if (labels.length > 0) {
        const decoded = labels.map((t) => normalizePdfValueText(t))
        return type === "checkbox" ? decoded.join(", ") : decoded.join("\n")
      }
    }

    const rawSelected = Array.isArray(rawValue)
      ? rawValue.map((v) => String(v).trim()).filter(Boolean)
      : typeof rawValue === "string" && rawValue
        ? (
            // Single-select controls must not fan out into multiple values.
            // Only checkbox values are expected as comma-separated strings.
            type === "checkbox"
              ? rawValue.split(",").map((v) => v.trim()).filter(Boolean)
              : [rawValue.trim()].filter(Boolean)
          )
        : []
    if (rawSelected.length === 0) {
      if (pdfMode === "blank" && options.length > 0) {
        const getOptionLabel = (opt) => {
          const optStr =
            typeof opt === "object" && opt != null && (opt.label != null || opt.value != null)
              ? (opt.label ?? opt.value ?? "")
              : String(opt)
          return normalizePdfValueText(optStr)
        }

        const optionLabels = options.map(getOptionLabel).filter(Boolean)
        if (optionLabels.length === 0) return ""

        // Show as multi-line text in the value column.
        // (No unicode checkbox glyphs to avoid font issues.)
        return type === "checkbox" ? optionLabels.join(", ") : optionLabels.join("\n")
      }
      return ""
    }

    const selectedSet = new Set(rawSelected)
    const selectedSetNormalized = new Set(rawSelected.map((v) => normalizeMultilineText(v)))

    // Generic canonical signature matcher:
    // - decodes encoded payloads (via normalizeMultilineText)
    // - removes rupee/currency words/symbols
    // - preserves meaning tokens (range/comparators/keywords) when building signature
    // This avoids field-specific hacks and works for "₹15188-₹30374", "<₹4556",
    // "30375 and above", and encoded variants like "&1&5...".
    const canonicalizeForCompare = (s) => {
      // Normalize to the same human-readable form used by the PDF renderer,
      // then build a stable signature that preserves meaning tokens:
      // - numeric ranges: "15188-30374"
      // - comparators: "<4556", ">1234", "<=999"
      // - words: "and above", "open", "closed"
      const n = normalizeMultilineText(String(s ?? ""))
        .toLowerCase()
        .replace(/\b(?:rs\.?|inr|rupee|rupees|dollar|dollars|usd|eur|euro|euros|gbp|pound|pounds|jpy|yen)\b/g, "")
        .replace(/₹/g, "")
        .replace(/[$€£¥]/g, "")
        .replace(/\s+/g, " ")
        .trim()

      // Normalize common phrases so they match even with spacing differences.
      const withWords = n
        .replace(/\band\s*above\b/g, " andabove ")
        .replace(/\band\s*above\s*\/\s*equal\b/g, " andabove ")
        .replace(/\bopen\b/g, " open ")
        .replace(/\bclosed\b/g, " closed ")

      // Keep letters/numbers plus comparator/range symbols that carry meaning.
      // Everything else becomes whitespace, then we remove whitespace for a final signature.
      return withWords
        .replace(/[^\p{L}\p{N}<>=+\-., ]/gu, " ")
        .replace(/\s+/g, "")
    }

    const selectedCanonical = rawSelected.map((v) => canonicalizeForCompare(v)).filter(Boolean)
    const selectedCanonicalSet = new Set(selectedCanonical)

    const isEncodedLike = (s) => /[&＆]\s*[a-z0-9]/i.test(String(s ?? ""))
    const optionToStr = (opt) =>
      typeof opt === "object" && opt != null && (opt.label != null || opt.value != null)
        ? String(opt.label ?? opt.value ?? "")
        : String(opt)
    const getOptionLabelMatch = (opt) => normalizeMultilineText(optionToStr(opt))
    const getOptionLabelDisplay = (opt) => normalizePdfValueText(optionToStr(opt))
    const selectedLabels = options.length > 0
      ? options
          .filter((opt) => {
            const label = getOptionLabelMatch(opt)
            const rawOpt = typeof opt === "object" && opt != null ? (opt.value ?? opt.label ?? "") : String(opt)
            const labelNorm = canonicalizeForCompare(label)
            const rawOptNorm = canonicalizeForCompare(rawOpt)

            // Additional guard for encoded payloads: compare canonical semantic signatures.
            const selectedLooksEncoded = rawSelected.some((v) => isEncodedLike(v))
            if (selectedLooksEncoded) {
              ecrfPdfDebugIfEncodedSpecial(
                `control:${control.label || control.id || "unknown"}(canonical-match)`,
                String(rawSelected[0] ?? ""),
                { labelNorm, rawOptNorm }
              )
            }

            return (
              selectedSet.has(rawOpt) ||
              selectedSet.has(label) ||
              selectedSetNormalized.has(label) ||
              selectedCanonicalSet.has(labelNorm) ||
              selectedCanonicalSet.has(rawOptNorm)
            )
          })
          .map(getOptionLabelDisplay)
      : rawSelected.map((v) => normalizePdfValueText(v))
    const uniqueLabels = [...new Set(selectedLabels)]

    // Safety: select/radio represent a single choice.
    // If backend accidentally sends a CSV-like payload, keep only first resolved label.
    if ((type === "select" || type === "dropdown" || type === "radio") && uniqueLabels.length > 1) {
      return uniqueLabels[0]
    }

    return uniqueLabels.length > 0 ? uniqueLabels.join(", ") : rawSelected.map((v) => normalizePdfValueText(v)).join(", ")
  }

  if (rawValue == null || rawValue === "") return ""

  // Defensive normaliser for object-shaped saved values that may still
  // leak through (e.g. callers that bypass `flattenCrfFormData`). For
  // non-option control types (text / date / number / textarea /
  // label / paragraph) the only legitimate user input is `.value`
  // (or its `.text` alias). We deliberately DO NOT fall back to
  // `.label` / `.displayLabel` / `.name` here — those are field
  // titles, NOT user input, and falling back to them would print the
  // field label inside the answer cell whenever the user saved a
  // record with that field still blank. The option-type branch above
  // (L1699) handles checkbox / radio / select / dropdown — those WANT
  // the label.
  let scalarValue = rawValue
  if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)) {
    const valueCandidates = [
      rawValue.value,
      rawValue.Value,
      rawValue.text,
      rawValue.Text,
    ]
    scalarValue = valueCandidates.find((c) => {
      if (c == null || c === "") return false
      // Reject nested objects — they would re-trigger the bug downstream.
      if (typeof c === "object") return false
      return true
    })
    if (scalarValue == null) return ""
  }

  // Match UI: date = date only, time = time only, datetime = date + time
  if (type === "date") return formatDate(scalarValue)
  if (type === "time") return formatTime(scalarValue)
  if (type === "datetime") return formatDateTime(scalarValue)
  if (type === "number") return String(scalarValue)
  return normalizePdfValueText(String(scalarValue))
}

async function buildCrfEntryPdfDocument({
  crfMeta,
  patient,
  visit,
  sections,
  printedInfo,
  showDates = true,
  pdfMode = "filled",
  crfName,
  layoutOptions = {},
  auditTrailRows = null,
  piSignoffRecord = undefined,
}) {
  const resolvedThemePreset = layoutOptions?.themePreset || CRF_PDF_DEFAULT_LAYOUT_OPTIONS.themePreset
  PDF_THEME = resolveCrfPdfTheme(resolvedThemePreset)

  const doc = new jsPDF({ unit: "mm", format: "a4" })

  // Embed a rupee-capable font so "₹" renders correctly in jsPDF output.
  // Falls back to Rs. if font loading fails.
  await ensurePdfRupeeFontLoaded(doc)

  const resolvedLogo =
    (crfMeta?.logoDataUrl && isLikelyDataUrl(crfMeta.logoDataUrl) ? crfMeta.logoDataUrl : null) ||
    (await toDataUrlFromUrl(crfMeta?.logoUrl || crfMeta?.orgLogoUrl || ORG_BRANDING.logoPath))

  const meta = {
    orgName: crfMeta?.orgName,
    orgAddress: crfMeta?.orgAddress,
    studyNo: crfMeta?.studyNo,
    studyTitle: crfMeta?.studyTitle,
    siteNo: crfMeta?.siteNo,
    investigatorCode: crfMeta?.investigatorCode,
    investigatorName: crfMeta?.investigatorName,
    formType: crfMeta?.formType,
    crfVersion: crfMeta?.crfVersion,
    patientId: patient?.patientId,
    logoDataUrl: resolvedLogo,
  }
  const showSubjectIdentity = layoutOptions?.showSubjectIdentity !== false
  const startSectionOnNewPage =
    layoutOptions?.startSectionOnNewPage ?? CRF_PDF_DEFAULT_LAYOUT_OPTIONS.startSectionOnNewPage
  const showSectionPageHeader =
    layoutOptions?.showSectionPageHeader ?? CRF_PDF_DEFAULT_LAYOUT_OPTIONS.showSectionPageHeader
  const useAnnotatedLayout =
    layoutOptions?.useAnnotatedLayout ?? CRF_PDF_DEFAULT_LAYOUT_OPTIONS.useAnnotatedLayout

  // Page 1: Cover / Summary (like reference)
  drawCoverPage(doc, meta, patient, visit, crfName, { showSubjectIdentity })
  doc.addPage()

  // Page 2+: Actual CRF detail pages
  let detailPageCount = 0
  const startDetailPage = () => {
    detailPageCount += 1
    let curY = BODY_TOP
    if (detailPageCount === 1) {
      drawHeaderBand(doc, meta, { showSubjectIdentity })
      curY = drawCrfTitleBars(doc, curY, crfName)
    } else {
      curY = drawCompactDetailHeader(doc, meta, crfName, { showSubjectIdentity })
    }
    return curY
  }

  let y = startDetailPage()

  const allSections = sections || []
  for (let sectionIndex = 0; sectionIndex < allSections.length; sectionIndex += 1) {
    const section = allSections[sectionIndex]
    const sectionTitle = normalizeMultilineText(section.name || "Section").toUpperCase()
    if (startSectionOnNewPage && sectionIndex > 0) {
      doc.addPage()
      y = startDetailPage()
    }
    if (showSectionPageHeader) {
      y = ensureSpace(doc, y, 10, startDetailPage)
      y = drawSectionStartHeader(doc, y, sectionTitle)
      y += PDF_THEME.spacing.sectionHeaderAfterGap
    }
    const sectionHeaderKey = normalizeHeaderKey(sectionTitle)
    // Avoid repeating the same section title as a second heavy row when section banner already exists.
    if (!showSectionPageHeader) {
      const sectionNeed = getTableRowHeight(doc, sectionTitle, "", true)
      y = ensureSpace(doc, y, sectionNeed, startDetailPage)
      y = drawTableRow(doc, y, sectionTitle, "", true)
      y += PDF_THEME.spacing.sectionRowAfterGap
    }
    let lastRenderedHeaderKey = sectionHeaderKey

    const controls = (section.controls || []).filter(Boolean)

    if (useAnnotatedLayout) {
      y = renderAnnotatedSectionControls(doc, y, controls, pdfMode, startDetailPage)
      continue
    }

    for (let controlIndex = 0; controlIndex < controls.length; controlIndex += 1) {
      const control = controls[controlIndex]
      const type = (control.type || "").toLowerCase()
      if (type === "hr") continue
      if (type === "label") {
        const labelText = normalizeMultilineText(
          control.label || control.properties?.labelText || control.properties?.text || control.properties?.title || "",
        )
        if (!labelText) continue
        const sub = labelText.toUpperCase()
        const subHeaderKey = normalizeHeaderKey(sub)
        if (subHeaderKey === lastRenderedHeaderKey) continue
        const need = getTableRowHeight(doc, sub, "", true)
        y = ensureSpace(doc, y, need, startDetailPage)
        y = drawTableRow(doc, y, sub, "", true)
        lastRenderedHeaderKey = subHeaderKey
        continue
      }

      const label = normalizeMultilineText(control.label || control.properties?.labelText || "Field")
      const valueRaw = getDisplayValue(control, pdfMode)

      if (type === "table" && isStructuredTableValue(control.value)) {
        const labelNeed = getTableRowHeight(doc, label, " ", false)
        y = ensureSpace(doc, y, labelNeed, startDetailPage)
        y = drawTableRow(doc, y, label, " ", false)
        y = drawStructuredTablePaginated(doc, y, control.value, startDetailPage, { repeatHeader: true, pdfMode })
        continue
      }

      const value =
        valueRaw != null && valueRaw !== ""
          ? normalizePdfValueText(String(valueRaw))
          : pdfMode === "blank"
            ? " "
            : "—"
      const need = getTableRowHeight(doc, label, value, false)
      y = ensureSpace(doc, y, need, startDetailPage)
      y = drawTableRow(doc, y, label, value, false)
    }
  }

  if (piSignoffRecord !== undefined) {
    doc.addPage()
    let piY = startDetailPage()
    piY = drawPiSignoffPdfSection(
      doc,
      piY,
      piSignoffRecord,
      startDetailPage,
      resolvedThemePreset,
    )
  }

  if (auditTrailRows != null) {
    doc.addPage()
    let auditY = startDetailPage()
    auditY = drawAuditTrailPdfSection(
      doc,
      auditY,
      auditTrailRows,
      startDetailPage,
      resolvedThemePreset,
    )
  }

  const pageCount = doc.internal.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    drawTopStrip(doc, meta, p, pageCount, printedInfo, showDates)
  }

  return { doc, meta }
}

export async function generateCrfEntryPdf({
  crfMeta,
  patient,
  visit,
  sections,
  printedInfo,
  showDates = true,
  pdfMode = "filled",
  filename,
  crfName,
  layoutOptions = {},
  auditTrailRows = null,
  piSignoffRecord = undefined,
}) {
  const { doc, meta } = await buildCrfEntryPdfDocument({
    crfMeta,
    patient,
    visit,
    sections,
    printedInfo,
    showDates,
    pdfMode,
    crfName,
    layoutOptions,
    auditTrailRows,
    piSignoffRecord,
  })

  const safeStudy = (meta.studyNo || "Study").replace(/[^a-zA-Z0-9-_]/g, "_")
  const safePatient = (
    layoutOptions?.showSubjectIdentity === false ? "Template" : (meta.patientId || "Patient")
  ).replace(/[^a-zA-Z0-9-_]/g, "_")
  const baseName = `CRF_${safeStudy}_${safePatient}.pdf`
  doc.save(filename || baseName)
}

/** Same layout as generateCrfEntryPdf but returns a Blob (e.g. for ZIP packaging). */
export async function generateCrfEntryPdfBlob(args) {
  const { doc } = await buildCrfEntryPdfDocument(args)
  return doc.output("blob")
}

export default generateCrfEntryPdf

