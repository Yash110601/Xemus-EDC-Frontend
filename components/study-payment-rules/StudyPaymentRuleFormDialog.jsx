"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import SearchableSelect from "@/components/ui/searchable-select"
import { Loader2, ChevronDown, ChevronUp } from "lucide-react"
import {
  PAYMENT_COMPLETION_LEVEL,
  PAYMENT_DENOMINATOR_SOURCE,
  PAYMENT_MODEL,
  PAYMENT_TARGET_TYPE,
  PAYMENT_TRIGGER_METRIC,
} from "@/lib/utils/paymentRuleEnums"
import {
  applySimplePresetToForm,
  buildSimpleWhenToPayOptions,
  getDefaultVisitCompletionMode,
  isCombinedWhenValue,
  isVisitWhenValue,
  resolveEffectivePreset,
  ruleToWhenToPayState,
  VISIT_COMPLETION_MODES,
} from "@/lib/utils/paymentRuleSimpleTriggers"
import PaymentRuleTriggerSelect from "@/components/study-payment-rules/PaymentRuleTriggerSelect"
import PaymentRuleCombinedVisitPicker from "@/components/study-payment-rules/PaymentRuleCombinedVisitPicker"

const EMPTY_FORM = {
  ruleName: "",
  sequenceNo: 1,
  triggerMetric: PAYMENT_TRIGGER_METRIC.VISIT_COMPLETED,
  triggerCategory: 4,
  visitScheduleId: "",
  operator: 1,
  targetType: PAYMENT_TARGET_TYPE.PERCENTAGE,
  targetValue: 50,
  paymentModel: PAYMENT_MODEL.SITE_AGGREGATE,
  completionLevel: PAYMENT_COMPLETION_LEVEL.SUBMITTED,
  denominatorSource: PAYMENT_DENOMINATOR_SOURCE.PLANNED_PATIENTS,
  prerequisiteRuleId: "",
  requiresAgreementSigned: true,
  isAutoCalculate: true,
  isActive: true,
}

function ruleToForm(rule) {
  if (!rule) return { ...EMPTY_FORM }
  return {
    ruleName: rule.ruleName ?? "",
    sequenceNo: rule.sequenceNo ?? 1,
    triggerMetric: rule.triggerMetric ?? PAYMENT_TRIGGER_METRIC.SCREENING_AND_BASELINE_COMPLETED,
    triggerCategory: rule.triggerCategory ?? 1,
    visitScheduleId: rule.visitScheduleId != null ? String(rule.visitScheduleId) : "",
    operator: rule.operator ?? 1,
    targetType: rule.targetType ?? PAYMENT_TARGET_TYPE.PERCENTAGE,
    targetValue: rule.targetValue ?? 50,
    paymentModel: rule.paymentModel ?? PAYMENT_MODEL.SITE_AGGREGATE,
    completionLevel: rule.completionLevel ?? PAYMENT_COMPLETION_LEVEL.SUBMITTED,
    denominatorSource: rule.denominatorSource ?? PAYMENT_DENOMINATOR_SOURCE.PLANNED_PATIENTS,
    prerequisiteRuleId: rule.prerequisiteRuleId != null ? String(rule.prerequisiteRuleId) : "",
    requiresAgreementSigned: Boolean(rule.requiresAgreementSigned ?? true),
    isAutoCalculate: Boolean(rule.isAutoCalculate ?? true),
    isActive: Boolean(rule.isActive ?? true),
  }
}

export default function StudyPaymentRuleFormDialog({
  open,
  onOpenChange,
  mode = "create",
  initialRule = null,
  visitSchedules = [],
  prerequisiteRules = [],
  saving = false,
  onSubmit,
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [whenValue, setWhenValue] = useState("")
  const [visitCompletionMode, setVisitCompletionMode] = useState(getDefaultVisitCompletionMode())
  const [combinedVisitIds, setCombinedVisitIds] = useState([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [errors, setErrors] = useState({})

  const presets = useMemo(() => buildSimpleWhenToPayOptions(visitSchedules), [visitSchedules])
  const selectedPreset = useMemo(
    () =>
      resolveEffectivePreset(whenValue, visitCompletionMode, visitSchedules, presets, combinedVisitIds),
    [whenValue, visitCompletionMode, visitSchedules, presets, combinedVisitIds],
  )
  const showVisitCompletion = isVisitWhenValue(whenValue) || isCombinedWhenValue(whenValue)
  const showCombinedVisitPicker = isCombinedWhenValue(whenValue)

  useEffect(() => {
    if (!open) return
    const nextForm = ruleToForm(initialRule)
    const whenState = ruleToWhenToPayState(initialRule, visitSchedules)
    setForm(nextForm)
    setWhenValue(whenState.whenValue)
    setVisitCompletionMode(whenState.visitCompletionMode)
    setCombinedVisitIds(whenState.combinedVisitIds ?? [])
    setShowAdvanced(Boolean(initialRule?.prerequisiteRuleId))
    setErrors({})
  }, [open, initialRule, visitSchedules])

  const prerequisiteOptions = useMemo(
    () =>
      prerequisiteRules
        .filter((rule) => rule?.id !== initialRule?.id)
        .map((rule) => ({
          value: String(rule.id),
          label: `Step ${rule.sequenceNo} — ${rule.ruleName}`,
        })),
    [prerequisiteRules, initialRule?.id],
  )

  const applyWhenSelection = (
    nextWhenValue,
    nextCompletionMode = visitCompletionMode,
    nextCombinedVisitIds = combinedVisitIds,
  ) => {
    const preset = resolveEffectivePreset(
      nextWhenValue,
      nextCompletionMode,
      visitSchedules,
      presets,
      nextCombinedVisitIds,
    )
    if (!preset) return
    const applied = applySimplePresetToForm(
      preset,
      preset.needsTarget ? preset.defaultTarget ?? form.targetValue : undefined,
    )
    if (applied) {
      setForm((prev) => ({ ...prev, ...applied }))
    }
  }

  const handleWhenChange = (value) => {
    setWhenValue(value)
    if (isCombinedWhenValue(value) && combinedVisitIds.length < 2) {
      const sorted = visitSchedules
        .map((v) => Number(v?.id ?? v?.Id))
        .filter((id) => Number.isFinite(id) && id > 0)
      const defaults = sorted.slice(0, 2)
      setCombinedVisitIds(defaults)
      applyWhenSelection(value, visitCompletionMode, defaults)
    } else {
      applyWhenSelection(value)
    }
    setErrors((prev) => ({
      ...prev,
      whenValue: undefined,
      visitCompletionMode: undefined,
      combinedVisitIds: undefined,
    }))
  }

  const handleVisitCompletionChange = (mode) => {
    setVisitCompletionMode(mode)
    applyWhenSelection(whenValue, mode)
    setErrors((prev) => ({ ...prev, visitCompletionMode: undefined }))
  }

  const handleCombinedVisitsChange = (ids) => {
    setCombinedVisitIds(ids)
    applyWhenSelection(whenValue, visitCompletionMode, ids)
    setErrors((prev) => ({ ...prev, combinedVisitIds: undefined }))
  }

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const validate = () => {
    const next = {}
    if (!String(form.ruleName).trim()) next.ruleName = "Name is required"
    if (!whenValue) next.whenValue = "Choose when to pay"
    if (!Number.isFinite(Number(form.sequenceNo)) || Number(form.sequenceNo) < 1) {
      next.sequenceNo = "Step must be at least 1"
    }
    if (selectedPreset?.needsTarget) {
      const tv = Number(form.targetValue)
      if (!Number.isFinite(tv) || tv < 1) next.targetValue = "Enter a value of 1 or more"
      if (selectedPreset.targetUnit === "percent" && tv > 100) {
        next.targetValue = "Enter 1–100"
      }
    }
    if (isCombinedWhenValue(whenValue) && combinedVisitIds.length < 2) {
      next.combinedVisitIds = "Select at least 2 visits"
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!validate()) return

    const preset = resolveEffectivePreset(
      whenValue,
      visitCompletionMode,
      visitSchedules,
      presets,
      combinedVisitIds,
    )
    const applied = preset ? applySimplePresetToForm(preset, form.targetValue) : null
    const triggerMetric = applied?.triggerMetric ?? Number(form.triggerMetric)
    const visitScheduleId =
      applied?.visitScheduleId != null && applied.visitScheduleId !== ""
        ? Number(applied.visitScheduleId)
        : form.visitScheduleId
          ? Number(form.visitScheduleId)
          : null
    const visitScheduleIds = Array.isArray(applied?.visitScheduleIds)
      ? applied.visitScheduleIds
      : combinedVisitIds

    onSubmit?.({
      ...form,
      sequenceNo: Number(form.sequenceNo),
      triggerMetric,
      triggerCategory: Number(form.triggerCategory),
      operator: applied?.operator ?? Number(form.operator),
      targetType: applied?.targetType ?? Number(form.targetType),
      targetValue: applied?.targetValue ?? Number(form.targetValue),
      paymentAmount:
        mode === "edit" && initialRule?.paymentAmount != null ? Number(initialRule.paymentAmount) : 0,
      paymentModel: Number(form.paymentModel),
      completionLevel: Number(form.completionLevel),
      denominatorSource: Number(form.denominatorSource),
      visitScheduleId: visitScheduleId && visitScheduleId > 0 ? visitScheduleId : null,
      visitScheduleIds:
        Number(triggerMetric) === PAYMENT_TRIGGER_METRIC.VISITS_COMBINED_COMPLETED
          ? visitScheduleIds
          : [],
      prerequisiteRuleId: form.prerequisiteRuleId ? Number(form.prerequisiteRuleId) : null,
    })
  }

  const targetLabel =
    selectedPreset?.targetUnit === "patients"
      ? "Number of patients"
      : selectedPreset?.targetUnit === "percent"
        ? "Percentage (%)"
        : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-hidden border border-slate-200/80 bg-white p-0 shadow-2xl">
        <div className="max-h-[90vh] overflow-y-auto overscroll-contain p-6">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit payment step" : "Add payment step"}</DialogTitle>
          <DialogDescription className="text-left text-sm text-slate-600">
            Set <strong>when</strong> the site earns each milestone. Amounts are entered per doctor in{" "}
            <strong>User Creation</strong>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Step</label>
              <Input
                type="number"
                min={1}
                value={form.sequenceNo}
                onChange={(e) => setField("sequenceNo", e.target.value)}
              />
              <p className="mt-1 text-[11px] text-slate-500">Match milestone no. in User Creation</p>
              {errors.sequenceNo ? <p className="mt-1 text-xs text-red-600">{errors.sequenceNo}</p> : null}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Name</label>
              <Input
                value={form.ruleName}
                onChange={(e) => setField("ruleName", e.target.value)}
                placeholder="e.g. Milestone 1 — 50% SB"
              />
              {errors.ruleName ? <p className="mt-1 text-xs text-red-600">{errors.ruleName}</p> : null}
            </div>

            <div className="sm:col-span-2">
              <PaymentRuleTriggerSelect
                visitSchedules={visitSchedules}
                value={whenValue}
                onChange={handleWhenChange}
              />
              {selectedPreset?.hint ? (
                <p className="mt-1 text-[11px] text-slate-500">{selectedPreset.hint}</p>
              ) : null}
              {errors.whenValue ? <p className="mt-1 text-xs text-red-600">{errors.whenValue}</p> : null}
            </div>

            {showCombinedVisitPicker ? (
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-600">Select visits (combined)</label>
                <PaymentRuleCombinedVisitPicker
                  visitSchedules={visitSchedules}
                  selectedIds={combinedVisitIds}
                  onChange={handleCombinedVisitsChange}
                />
                {errors.combinedVisitIds ? (
                  <p className="mt-1 text-xs text-red-600">{errors.combinedVisitIds}</p>
                ) : null}
              </div>
            ) : null}

            {showVisitCompletion ? (
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-600">Completion rule</label>
                <SearchableSelect
                  placeholder="How many patients must complete?"
                  options={VISIT_COMPLETION_MODES.map((mode) => ({
                    value: mode.value,
                    label: mode.label,
                  }))}
                  value={visitCompletionMode}
                  onChange={handleVisitCompletionChange}
                  includeEmptyOption={false}
                />
                {errors.visitCompletionMode ? (
                  <p className="mt-1 text-xs text-red-600">{errors.visitCompletionMode}</p>
                ) : null}
              </div>
            ) : null}

            {selectedPreset?.needsTarget ? (
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slate-600">{targetLabel}</label>
                <Input
                  type="number"
                  min={1}
                  max={selectedPreset.targetUnit === "percent" ? 100 : undefined}
                  value={form.targetValue}
                  onChange={(e) => setField("targetValue", e.target.value)}
                />
                {errors.targetValue ? <p className="mt-1 text-xs text-red-600">{errors.targetValue}</p> : null}
              </div>
            ) : null}

            <div className="sm:col-span-2 flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.requiresAgreementSigned}
                  onChange={(e) => setField("requiresAgreementSigned", e.target.checked)}
                />
                Agreement signed required
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={Number(form.completionLevel) === PAYMENT_COMPLETION_LEVEL.SDV_VERIFIED}
                  onChange={(e) =>
                    setField(
                      "completionLevel",
                      e.target.checked
                        ? PAYMENT_COMPLETION_LEVEL.SDV_VERIFIED
                        : PAYMENT_COMPLETION_LEVEL.SUBMITTED,
                    )
                  }
                />
                Count SDV-verified only
              </label>
            </div>
          </div>

          <button
            type="button"
            className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            Advanced options
            {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showAdvanced ? (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
              {prerequisiteOptions.length > 0 ? (
                <SearchableSelect
                  label="Must finish step first"
                  placeholder="None"
                  options={[{ value: "", label: "None" }, ...prerequisiteOptions]}
                  value={form.prerequisiteRuleId}
                  onChange={(v) => setField("prerequisiteRuleId", v)}
                />
              ) : null}
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setField("isActive", e.target.checked)}
                />
                Active
              </label>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {mode === "edit" ? "Save" : "Add step"}
            </Button>
          </DialogFooter>
        </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
