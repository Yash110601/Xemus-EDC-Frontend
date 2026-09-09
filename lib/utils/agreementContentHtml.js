/**
 * Prepare agreement header/body HTML for storage and PDF rendering.
 * Strips editor-only variable chips and ensures tables use PDF-friendly classes.
 */
export function sanitizeAgreementContentHtml(html) {
  if (!html || typeof html !== "string") return html || ""

  let content = html

  // Unwrap editor variable chips → plain merge tokens (if any legacy content exists)
  content = content.replace(
    /<span[^>]*class="[^"]*variable-placeholder[^"]*"[^>]*data-variable="([^"]+)"[^>]*>[\s\S]*?<\/span>/gi,
    (_, key) => `{{${key}}}`
  )
  content = content.replace(
    /<span[^>]*class="[^"]*variable-placeholder[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
    "$1"
  )

  // PDF template styles tables via agreement-rich-table
  content = content.replace(
    /<table(?![^>]*class=)([^>]*)>/gi,
    '<table class="agreement-rich-table"$1>'
  )

  return content.trim()
}
