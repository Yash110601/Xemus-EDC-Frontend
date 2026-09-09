"use client"

import { ECRF_MATRIX_STATUS } from "@/lib/utils/ecrfVisitMatrixStatus"

const LEGEND_ITEMS = [
  ECRF_MATRIX_STATUS.pending,
  ECRF_MATRIX_STATUS.inprocess,
  ECRF_MATRIX_STATUS.completed,
  ECRF_MATRIX_STATUS.notdone,
]

export default function EcrfDataEntryStatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2" role="list" aria-label="Visit status legend">
      {LEGEND_ITEMS.map((item) => (
        <div key={item.id} className="inline-flex items-center gap-2 text-[11px] font-medium text-slate-600" role="listitem">
          <span className={cnDot(item.dot)} aria-hidden />
          {item.label}
        </div>
      ))}
    </div>
  )
}

function cnDot(dotClass) {
  return `h-2.5 w-2.5 rounded-full ${dotClass}`
}
