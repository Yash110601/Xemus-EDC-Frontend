/** NoveraRM dashboard chart palette — no legacy indigo/purple. */
export const NOVERA_CHART = Object.freeze({
  emerald: "#10b981",
  emeraldDark: "#059669",
  emeraldLight: "#6ee7b7",
  teal: "#14b8a6",
  tealDark: "#0d9488",
  cyan: "#06b6d4",
  navy: "#0f3d4a",
  amber: "#f59e0b",
  rose: "#f43f5e",
  slate: "#64748b",
  grid: "rgba(148, 163, 184, 0.18)",
  axis: "#94a3b8",
})

export const NOVERA_SERIES = [
  { main: "#10b981", light: "#6ee7b7", dark: "#047857" },
  { main: "#14b8a6", light: "#5eead4", dark: "#0f766e" },
  { main: "#06b6d4", light: "#67e8f9", dark: "#0891b2" },
  { main: "#0f3d4a", light: "#1e5a6e", dark: "#071a14" },
  { main: "#f59e0b", light: "#fcd34d", dark: "#d97706" },
  { main: "#f43f5e", light: "#fda4af", dark: "#e11d48" },
]

export const NOVERA_CHART_MARGIN = { top: 12, right: 12, left: 0, bottom: 4 }

export const NOVERA_TOOLTIP_STYLE = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  padding: "10px 12px",
  boxShadow: "0 16px 40px -24px rgba(15, 23, 42, 0.35)",
}

export function pickSeriesColor(index) {
  return NOVERA_SERIES[index % NOVERA_SERIES.length]
}

export function normalizeChartColor(hex, fallbackIndex = 0) {
  const h = String(hex || "").toLowerCase()
  if (h.includes("6366f1") || h.includes("4f46e5") || h.includes("8b5cf6") || h.includes("a78bfa")) {
    return pickSeriesColor(fallbackIndex).main
  }
  return hex || pickSeriesColor(fallbackIndex).main
}
