/** Download PDF (and optional HTML) from eCONSENT signed-document API payload. */

export function downloadConsentPdfFromDocument(doc) {
  if (!doc) return
  const b64 = doc.pdfBase64 || doc.PdfBase64
  const fileName = doc.fileName || doc.FileName || "econsent.pdf"
  if (b64) {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
    const blob = new Blob([bytes], { type: "application/pdf" })
    triggerDownload(blob, fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`)
    return
  }
  downloadConsentHtmlFromDocument(doc)
}

export function downloadConsentHtmlFromDocument(doc) {
  if (!doc) return
  const html = doc.html || doc.Html
  if (!html) return
  const fileName = (doc.fileName || doc.FileName || "econsent.html").replace(/\.pdf$/i, ".html")
  const blob = new Blob([html], { type: "text/html;charset=utf-8" })
  triggerDownload(blob, fileName.endsWith(".html") ? fileName : `${fileName}.html`)
}

function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
