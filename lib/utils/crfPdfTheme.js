const BASE_THEME = {
  colors: {
    line: [0, 0, 0],
    sectionBorder: [193, 200, 216],
    sectionFill: [240, 244, 252],
    compactHeaderBorder: [210, 216, 228],
    compactHeaderFill: [248, 250, 255],
    cardBorder: [221, 226, 236],
    cardFill: [255, 255, 255],
    tableBorder: [211, 218, 231],
    inputBorder: [211, 218, 231],
    helperText: [88, 96, 114],
    placeholderText: [118, 127, 147],
    legendBorder: [222, 227, 238],
    legendFill: [249, 250, 255],
    legendText: [92, 101, 120],
  },
  radius: {
    compactHeader: 1.6,
    section: 1.4,
    card: 1.1,
    input: 1.3,
    legend: 1,
    tableCellInput: 1,
  },
  font: {
    compactHeader: 8,
    section: 8.2,
    controlLabel: 8.1,
    controlInput: 8.3,
    controlHelper: 8.1,
    tableCellInput: 7.4,
    tableCellChoice: 7.2,
    legend: 7,
  },
  spacing: {
    sectionHeaderAfterGap: 3.5,
    subsectionAfterGap: 2.8,
    sectionRowAfterGap: 1.2,
    controlTopPadding: 3.8,
    controlLabelLineHeight: 3.1,
    controlLabelInputGap: 1.5,
    controlInputHeight: 6.2,
    controlBottomPadding: 2.2,
    controlRowGap: 2.8,
    multiColumnMax: 2,
    multiColumnGap: 3,
  },
}

const PRESET_OVERRIDES = {
  classic: {
    radius: {
      compactHeader: 1.1,
      section: 1.1,
      card: 0.8,
      input: 0.8,
      legend: 0.8,
      tableCellInput: 0.8,
    },
    font: {
      controlLabel: 8.3,
      controlInput: 8.2,
      controlHelper: 7.9,
    },
    spacing: {
      controlTopPadding: 4.0,
      controlLabelLineHeight: 3.45,
    },
  },
  "mac-premium": {
    radius: {
      compactHeader: 2,
      section: 1.8,
      card: 1.6,
      input: 1.5,
      legend: 1.2,
      tableCellInput: 1.2,
    },
    spacing: {
      sectionHeaderAfterGap: 4,
      subsectionAfterGap: 3,
      sectionRowAfterGap: 1.4,
      controlTopPadding: 4,
      controlLabelLineHeight: 3.05,
      controlLabelInputGap: 1.6,
      controlInputHeight: 6,
      controlBottomPadding: 2,
      controlRowGap: 3,
      multiColumnMax: 2,
      multiColumnGap: 3.2,
    },
  },
}

/** Default layout for annotated CRF PDFs (blank + with-data). */
export const CRF_PDF_DEFAULT_LAYOUT_OPTIONS = Object.freeze({
  themePreset: "mac-premium",
  useAnnotatedLayout: true,
  startSectionOnNewPage: true,
  showSectionPageHeader: true,
})

function deepMerge(target, source) {
  const out = { ...target }
  Object.keys(source || {}).forEach((k) => {
    const sv = source[k]
    if (sv && typeof sv === "object" && !Array.isArray(sv)) {
      out[k] = deepMerge(target?.[k] || {}, sv)
    } else {
      out[k] = sv
    }
  })
  return out
}

export function resolveCrfPdfTheme(preset = "mac-premium") {
  const key = PRESET_OVERRIDES[preset] ? preset : "mac-premium"
  return deepMerge(BASE_THEME, PRESET_OVERRIDES[key] || {})
}

export const CRF_PDF_THEME_PRESETS = Object.freeze(Object.keys(PRESET_OVERRIDES))

