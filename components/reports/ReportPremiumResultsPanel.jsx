"use client"

import { cn } from "@/lib/utils"
import {
  REPORT_PREMIUM_PANEL_CLASS,
  REPORT_PREMIUM_PANEL_HEADER_CLASS,
} from "@/lib/reports/studySitePatientReportUi"

/**
 * Mac-style glass results shell shared by premium report grids.
 */
export default function ReportPremiumResultsPanel({
  title,
  titleSuffix,
  toolbar,
  headerNote,
  children,
  footer,
  className,
}) {
  return (
    <div className={cn(REPORT_PREMIUM_PANEL_CLASS, className)}>
      <div className={REPORT_PREMIUM_PANEL_HEADER_CLASS}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight text-slate-900">
            {title}
            {titleSuffix ? (
              <span className="ml-1.5 text-[11px] font-normal text-slate-500">{titleSuffix}</span>
            ) : null}
          </h2>
          {toolbar}
        </div>
        {headerNote}
      </div>
      {children}
      {footer}
    </div>
  )
}
