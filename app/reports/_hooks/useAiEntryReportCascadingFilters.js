"use client"

import { AI_ENTRY_REPORT_INITIAL_FILTERS } from "@/lib/reports/studySitePatientReportUi"
import { useReportPatientCascadeFilters } from "@/app/reports/_hooks/useReportPatientCascadeFilters"

export function useAiEntryReportCascadingFilters() {
  return useReportPatientCascadeFilters({
    initialFilters: AI_ENTRY_REPORT_INITIAL_FILTERS,
  })
}
