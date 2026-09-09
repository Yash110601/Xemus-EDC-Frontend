"use client"

import { CheckCircle2, CircleDollarSign, Clock, Shield } from "lucide-react"
import {
  achievementStatusTone,
  eligibilityTone,
  formatProgressPercent,
} from "@/lib/utils/paymentRuleProgress"
import { cn } from "@/lib/utils"

function StatusPill({ label, tone }) {
  const classes =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : tone === "amber"
        ? "bg-amber-50 text-amber-800 border-amber-200"
        : tone === "indigo"
          ? "bg-indigo-50 text-indigo-700 border-indigo-200"
          : tone === "sky"
            ? "bg-sky-50 text-sky-700 border-sky-200"
            : "bg-slate-50 text-slate-600 border-slate-200"

  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold", classes)}>
      {tone === "emerald" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
      {label || "—"}
    </span>
  )
}

export default function FinancePaymentRulesPanel({
  rules = [],
  onPaymentClick,
  onOverrideClick,
  canCapturePayment = true,
  canOverride = false,
}) {
  if (!rules.length) return null

  return (
    <div>
      <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-700">Payment rules</h4>
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[960px] overflow-hidden rounded-lg border border-slate-200 text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">#</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Rule</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Achievement</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Progress</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Eligibility</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Amount</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Cheque</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Payment</th>
              {(canCapturePayment || canOverride) && (
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {[...rules]
              .sort((a, b) => (a.sequenceNo ?? 0) - (b.sequenceNo ?? 0))
              .map((rule, idx) => {
                const payStatus = String(rule.paymentStatus ?? "Unpaid")
                const payLower = payStatus.toLowerCase()
                const isPaid = payLower === "paid"
                const isPartial = payLower === "partially paid"
                const eligName = String(rule.paymentEligibilityStatusName ?? "").toLowerCase()
                const canPay =
                  canCapturePayment &&
                  (rule.paymentEligibilityStatus === 2 ||
                    rule.paymentEligibilityStatus === 3 ||
                    (eligName.includes("eligible") && !eligName.includes("not")))
                const displayAmount = Number(rule.paymentAmount ?? 0)
                const amountFromCrc = Boolean(rule.paymentAmountFromCrcMilestone)
                const crcPatientRef = rule.referenceNoOfPatients

                return (
                  <tr key={rule.id ?? idx}>
                    <td className="px-3 py-2 text-slate-800">{rule.sequenceNo ?? idx + 1}</td>
                    <td className="px-3 py-2 text-slate-800">
                      <p className="font-medium">{rule.ruleName || "—"}</p>
                      {rule.achievedAt ? (
                        <p className="text-[11px] text-slate-500">
                          Achieved {new Date(rule.achievedAt).toLocaleDateString("en-IN")}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill
                        label={rule.statusName || "Pending"}
                        tone={achievementStatusTone(rule.statusName, rule.status)}
                      />
                    </td>
                    <td className="px-3 py-2 text-slate-800">
                      <span className="font-semibold">{formatProgressPercent(rule)}</span>
                      <p className="text-[11px] text-slate-500">
                        {rule.calculatedNumerator ?? 0}/{rule.calculatedDenominator ?? 0}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill
                        label={rule.paymentEligibilityStatusName || "Not eligible"}
                        tone={eligibilityTone(rule.paymentEligibilityStatusName, rule.paymentEligibilityStatus)}
                      />
                    </td>
                    <td className="px-3 py-2 text-slate-800">
                      ₹{" "}
                      {Number(displayAmount).toLocaleString("en-IN", {
                        maximumFractionDigits: 2,
                      })}
                      {amountFromCrc ? (
                        <p className="text-[11px] text-slate-500">
                          From CRC assignment
                          {crcPatientRef != null ? ` · ref. ${crcPatientRef} patients` : ""}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-slate-800">{rule.chequeNumber ?? "—"}</td>
                    <td className="px-3 py-2">
                      <StatusPill
                        label={payStatus}
                        tone={isPaid ? "emerald" : isPartial ? "amber" : "slate"}
                      />
                    </td>
                    {(canCapturePayment || canOverride) && (
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          {canCapturePayment ? (
                            <button
                              type="button"
                              disabled={!canPay && !isPaid && !isPartial}
                              title={
                                !canPay && !isPaid
                                  ? "Payment capture requires eligibility (agreement + rule achieved)"
                                  : "Add / edit cheque details"
                              }
                              onClick={() => onPaymentClick?.(rule)}
                              className={cn(
                                "inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
                                isPaid
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                  : canPay
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                    : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400",
                              )}
                            >
                              <CircleDollarSign className="h-4 w-4" />
                            </button>
                          ) : null}
                          {canOverride ? (
                            <button
                              type="button"
                              onClick={() => onOverrideClick?.(rule)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                              title="Manual achievement override"
                            >
                              <Shield className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
