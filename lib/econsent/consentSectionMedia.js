/** Helpers for consent section video / embed (Viedoc-style watch-to-continue). */

export function toEmbedUrl(url) {
  if (!url) return null
  const u = String(url).trim()
  if (u.includes("youtu.be/")) {
    const id = u.split("/").pop()?.split("?")[0]
    return id ? `https://www.youtube.com/embed/${id}` : null
  }
  if (u.includes("youtube.com/watch")) {
    const q = u.indexOf("?")
    if (q >= 0) {
      for (const part of u.slice(q + 1).split("&")) {
        if (part.startsWith("v=")) return `https://www.youtube.com/embed/${decodeURIComponent(part.slice(2))}`
      }
    }
    return null
  }
  if (u.includes("vimeo.com/")) {
    const id = u.replace(/\/$/, "").split("/").pop()
    return id ? `https://player.vimeo.com/video/${id}` : null
  }
  return u
}

export function sectionHasRequiredVideo(section) {
  const url = section?.videoUrl || section?.VideoUrl
  const req = section?.requireVideoWatch ?? section?.RequireVideoWatch
  return Boolean(url && req)
}
