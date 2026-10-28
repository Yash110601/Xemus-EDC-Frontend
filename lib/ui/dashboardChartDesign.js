/** Xemus dashboard chart palette — soft lavender with complementary accents. */
export const NOVERA_CHART = Object.freeze({
  violet: "#7C6BB5",
  violetDark: "#3D2F63",
  violetLight: "#C4B5E0",
  indigo: "#6366F1",
  fuchsia: "#A78BFA",
  rose: "#E879A9",
  amber: "#D4A017",
  teal: "#6B9B9B",
  slate: "#8B7BA8",
  grid: "rgba(124, 107, 181, 0.12)",
  axis: "#9B8FB0",
  // aliases kept for existing chart call sites
  emerald: "#7C6BB5",
  emeraldDark: "#5B4B8A",
  emeraldLight: "#C4B5E0",
  tealDark: "#5B7A7A",
  cyan: "#8B7BB8",
  navy: "#3D2F63",
})

export const NOVERA_SERIES = [
  { main: "#7C6BB5", light: "#C4B5E0", dark: "#3D2F63" },
  { main: "#9B87C7", light: "#D4CBE8", dark: "#5B4B8A" },
  { main: "#6366F1", light: "#A5B4FC", dark: "#4338CA" },
  { main: "#3D2F63", light: "#8B7BB8", dark: "#2D1C4E" },
  { main: "#D4A017", light: "#F0D78C", dark: "#A67C00" },
  { main: "#E879A9", light: "#F5C6DA", dark: "#BE185D" },
]

export const NOVERA_CHART_MARGIN = { top: 12, right: 12, left: 0, bottom: 4 }

export const NOVERA_TOOLTIP_STYLE = {
  backgroundColor: "#ffffff",
  border: "1px solid #E4DCF2",
  borderRadius: "14px",
  padding: "10px 12px",
  boxShadow: "0 16px 40px -24px rgba(61, 47, 99, 0.35)",
}

export function pickSeriesColor(index) {
  return NOVERA_SERIES[index % NOVERA_SERIES.length]
}

export function normalizeChartColor(hex, fallbackIndex = 0) {
  const h = String(hex || "").toLowerCase()
  // Remap legacy teal/emerald Novera greens into Xemus violet family.
  if (
    h.includes("10b981") ||
    h.includes("059669") ||
    h.includes("047857") ||
    h.includes("14b8a6") ||
    h.includes("0d9488") ||
    h.includes("06b6d4") ||
    h.includes("0f3d4a")
  ) {
    return pickSeriesColor(fallbackIndex).main
  }
  return hex || pickSeriesColor(fallbackIndex).main
}
