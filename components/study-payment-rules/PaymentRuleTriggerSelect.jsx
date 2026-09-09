"use client"

import { useMemo } from "react"
import SearchableSelect from "@/components/ui/searchable-select"
import { buildSimpleWhenToPaySelectOptions } from "@/lib/utils/paymentRuleSimpleTriggers"
import { sortVisitSchedules } from "@/lib/utils/paymentRuleTriggerOptions"

export default function PaymentRuleTriggerSelect({
  visitSchedules = [],
  value,
  onChange,
  disabled = false,
}) {
  const { flatOptions, visitCount } = useMemo(
    () => buildSimpleWhenToPaySelectOptions(visitSchedules),
    [visitSchedules],
  )

  const configuredVisitCount =
    visitCount ?? sortVisitSchedules(visitSchedules).filter((v) => v?.id ?? v?.Id).length

  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-600">When to pay</label>
      <SearchableSelect
        placeholder={
          configuredVisitCount > 0
            ? "Pick a configured visit, enrollment, or study complete…"
            : "Add visits in Visit configuration first"
        }
        options={flatOptions}
        value={value}
        onChange={onChange}
        disabled={disabled}
        showSearch
        includeEmptyOption={false}
        contentClassName="min-w-[min(100vw-2rem,420px)]"
      />
      <p className="mt-1 text-[11px] text-slate-500">
        {configuredVisitCount > 0 ? (
          <>
            Showing <strong>{configuredVisitCount} configured visit(s)</strong> — one row each, exact names from
            Visit configuration. After you pick a visit, choose the completion rule (% / count / all).
          </>
        ) : (
          <>Configure visits under Visit configuration — they will appear here by name.</>
        )}
      </p>
    </div>
  )
}
