/**
 * Normalize stored/full email HTML for the in-app rich text editor.
 * Strips outer document shell so users edit only the message body.
 */
export function normalizeEmailBodyForEditor(html) {
  if (!html || typeof html !== "string") return ""

  const trimmed = html.trim()
  if (!/<html[\s>]/i.test(trimmed) && !/<!doctype/i.test(trimmed)) {
    return trimmed
  }

  const bodyCell = trimmed.match(/class=["']email-body["'][^>]*>([\s\S]*?)<\/td>/i)
  if (bodyCell?.[1]) return bodyCell[1].trim()

  const bodyTag = trimmed.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  if (bodyTag?.[1]) return bodyTag[1].trim()

  return trimmed
}

const KPI_CARD_STYLES = [
  "flex:1 1 120px;min-width:120px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:14px 10px;text-align:center;",
  "flex:1 1 120px;min-width:120px;background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;padding:14px 10px;text-align:center;",
  "flex:1 1 120px;min-width:120px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;padding:14px 10px;text-align:center;",
  "flex:1 1 120px;min-width:120px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:14px;padding:14px 10px;text-align:center;",
]

function divLabelsToParagraphs(html) {
  return html.replace(/<div/gi, "<p").replace(/<\/div>/gi, "</p>")
}

function convertLegacyKpiTables(html) {
  if (typeof window === "undefined") return html
  if (!/<table[^>]+role=["']presentation["']/i.test(html)) return html
  if (!/width=["']25%["']/i.test(html)) return html

  try {
    const doc = new DOMParser().parseFromString(`<div data-email-root="1">${html}</div>`, "text/html")
    const root = doc.querySelector("[data-email-root]")
    if (!root) return html

    root.querySelectorAll('table[role="presentation"]').forEach((table) => {
      const row = table.querySelector("tbody > tr") || table.querySelector("tr")
      if (!row) return

      const kpiCells = [...row.children].filter(
        (el) => el.tagName === "TD" && el.getAttribute("width") === "25%",
      )
      if (kpiCells.length !== 4) return

      const grid = doc.createElement("div")
      grid.className = "email-kpi-grid"
      grid.setAttribute("style", "display:flex;flex-wrap:wrap;gap:8px;margin:0 0 18px;")

      kpiCells.forEach((cell, index) => {
        const innerTd = cell.querySelector('table[role="presentation"] td')
        const card = doc.createElement("div")
        card.setAttribute("style", KPI_CARD_STYLES[index] || KPI_CARD_STYLES[0])
        card.innerHTML = divLabelsToParagraphs(innerTd?.innerHTML || "")
        grid.appendChild(card)
      })

      table.replaceWith(grid)
    })

    root.querySelectorAll('table[role="presentation"]').forEach((table) => {
      const cell = table.querySelector("td")
      const text = cell?.textContent?.trim() || ""
      if (!/automatically generated email/i.test(text)) return

      const div = doc.createElement("div")
      div.setAttribute(
        "style",
        "background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px 20px;text-align:center;",
      )
      div.innerHTML = cell.innerHTML
      table.replaceWith(div)
    })

    return root.innerHTML
  } catch {
    return html
  }
}

/** Strip email shell and convert legacy table KPI blocks to editable div layout. */
export function prepareEmailBodyForEditor(html) {
  return convertLegacyKpiTables(normalizeEmailBodyForEditor(html))
}
