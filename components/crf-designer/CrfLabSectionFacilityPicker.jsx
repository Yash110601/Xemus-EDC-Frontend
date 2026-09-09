"use client"

import { normalizeCrfSection, SECTION_TYPE_LAB } from "@/lib/utils/crfLabSection"

/**
 * eCRF data entry — lab facility dropdown shown only on laboratory sections (not standard sections).
 * Parent owns options (getLabsDropdown); on selection change, parent refetches range rows.
 */
export function CrfLabSectionFacilityPicker({
  section,
  labOptions = [],
  loadingLabs = false,
  /** Controlled value (design binding ± user override normalized by parent) */
  valueLabFacilityId = "",
  onChangeBinding,
}) {
  const normalized = normalizeCrfSection(section)
  if (normalized.sectionType !== SECTION_TYPE_LAB) return null

  const fid = normalized.id ? String(normalized.id) : "section"

  return (
    <div className="mt-4 rounded-xl border border-teal-200 bg-teal-50/70 px-4 py-3 dark:border-teal-900/55 dark:bg-teal-950/25">
      <label
        htmlFor={`ecrf-entry-lab-${fid}`}
        className="block text-xs font-bold uppercase tracking-wide text-teal-900 dark:text-teal-200"
      >
        Lab facility <span className="text-red-500">*</span>
      </label>
      <p className="mt-1 text-xs text-teal-800/85 dark:text-teal-300/90">
        Maps this visit&apos;s laboratory results to Lab Management. Range hints use the assignments for the facility
        you select below.
      </p>
      <select
        id={`ecrf-entry-lab-${fid}`}
        disabled={loadingLabs}
        className="mt-2 flex h-10 w-full max-w-md rounded-xl border border-teal-200 bg-white px-3 text-sm font-medium shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 disabled:opacity-60 dark:border-teal-800 dark:bg-slate-900"
        value={valueLabFacilityId ?? ""}
        onChange={(e) => {
          const val = e.target.value.trim()
          const opt = labOptions.find((x) => String(x.id) === String(val))
          if (!onChangeBinding) return
          onChangeBinding({
            labFacilityId: val !== "" ? val : null,
            labFacilityLabel: opt?.name ?? "",
          })
        }}
      >
        <option value="">
          {loadingLabs ? "Loading labs…" : labOptions?.length ? "Select laboratory…" : "No labs loaded — retry or check API"}
        </option>
        {labOptions.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.name || `Lab ${opt.id}`}
          </option>
        ))}
      </select>
      {!loadingLabs && (!labOptions || labOptions.length === 0) && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
          Lab list unavailable. Confirm Lab Management and your login still allow the labs dropdown endpoint.
        </p>
      )}
    </div>
  )
}
