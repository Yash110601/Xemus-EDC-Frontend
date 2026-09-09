import {
  PAYMENT_RULE_OPERATOR,
  PAYMENT_TARGET_TYPE,
  PAYMENT_TRIGGER_CATEGORY,
  PAYMENT_TRIGGER_METRIC,
} from "@/lib/utils/paymentRuleEnums"
import { VISIT_TYPE, visitMatchesTypeEnum } from "@/lib/visitTypes"
import {
  encodePaymentRuleTriggerKey,
  getConfiguredVisitDisplayName,
  resolveVisitTypeLabel,
  sortVisitSchedules,
} from "@/lib/utils/paymentRuleTriggerOptions"
import { parseVisitScheduleIdsFromRule } from "@/lib/utils/paymentRuleVisitScheduleIds"

const PRESET_PREFIX = "simple:"
export const COMBINED_WHEN_VALUE = `${PRESET_PREFIX}combined`

export const VISIT_COMPLETION_MODES = [
  {
    value: "all",
    label: "All patients complete",
    needsTarget: false,
    targetType: PAYMENT_TARGET_TYPE.PERCENTAGE,
    targetValue: 100,
  },
  {
    value: "pct",
    label: "% of patients complete",
    needsTarget: true,
    targetUnit: "percent",
    defaultTarget: 50,
    targetType: PAYMENT_TARGET_TYPE.PERCENTAGE,
  },
  {
    value: "count",
    label: "Patient count reached",
    needsTarget: true,
    targetUnit: "patients",
    defaultTarget: 5,
    targetType: PAYMENT_TARGET_TYPE.COUNT,
  },
]

function metricCategory(metric) {
  switch (Number(metric)) {
    case PAYMENT_TRIGGER_METRIC.ENROLLMENT_STARTED:
    case PAYMENT_TRIGGER_METRIC.ENROLLMENT_COMPLETED:
    case PAYMENT_TRIGGER_METRIC.ENROLLMENT_PERCENTAGE:
      return PAYMENT_TRIGGER_CATEGORY.ENROLLMENT
    case PAYMENT_TRIGGER_METRIC.SCREENING_COMPLETED:
    case PAYMENT_TRIGGER_METRIC.SCREENING_AND_BASELINE_COMPLETED:
      return PAYMENT_TRIGGER_CATEGORY.SCREENING
    case PAYMENT_TRIGGER_METRIC.BASELINE_COMPLETED:
      return PAYMENT_TRIGGER_CATEGORY.BASELINE
    case PAYMENT_TRIGGER_METRIC.VISIT_COMPLETED:
    case PAYMENT_TRIGGER_METRIC.VISITS_COMBINED_COMPLETED:
      return PAYMENT_TRIGGER_CATEGORY.VISIT
    case PAYMENT_TRIGGER_METRIC.STUDY_COMPLETE:
      return PAYMENT_TRIGGER_CATEGORY.STUDY_COMPLETE
    default:
      return PAYMENT_TRIGGER_CATEGORY.ENROLLMENT
  }
}

function isScreeningVisit(visit) {
  return (
    visitMatchesTypeEnum(visit, VISIT_TYPE.SCREENING) ||
    resolveVisitTypeLabel(visit) === "Screening"
  )
}

function isBaselineVisit(visit) {
  return (
    visitMatchesTypeEnum(visit, VISIT_TYPE.BASELINE) ||
    resolveVisitTypeLabel(visit) === "Baseline"
  )
}

function getCombinedScreeningBaselineLabel(visitSchedules = []) {
  const names = sortVisitSchedules(visitSchedules)
    .filter((v) => isScreeningVisit(v) || isBaselineVisit(v))
    .map(getConfiguredVisitDisplayName)
  return names.length > 0 ? names.join(" + ") : "Screening + Baseline"
}

export function isVisitWhenValue(value) {
  return /^simple:visit:\d+$/.test(String(value ?? ""))
}

export function isCombinedWhenValue(value) {
  return String(value ?? "") === COMBINED_WHEN_VALUE
}

export function formatCombinedVisitLabel(visitSchedules = [], visitIds = []) {
  const ids = visitIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
  if (ids.length === 0) return "Combined visits"
  const names = ids.map((id) => {
    const visit = visitSchedules.find((v) => Number(v?.id ?? v?.Id) === id)
    return visit ? getConfiguredVisitDisplayName(visit) : `Visit ${id}`
  })
  return names.join(" + ")
}

export function buildCombinedModePreset(visitIds = [], mode = "pct", visitSchedules = []) {
  const ids = visitIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
  if (ids.length < 2) return null

  const label = formatCombinedVisitLabel(visitSchedules, ids)
  const modeDef = VISIT_COMPLETION_MODES.find((m) => m.value === mode) ?? VISIT_COMPLETION_MODES[1]

  return {
    value: `${PRESET_PREFIX}combined_${mode}:${ids.join(",")}`,
    label: `${label} — ${modeDef.label.toLowerCase()}`,
    hint: `Pay when patients complete all selected visits (${label}). Each patient must finish every selected visit to count.`,
    needsTarget: modeDef.needsTarget,
    targetUnit: modeDef.targetUnit,
    defaultTarget: modeDef.defaultTarget,
    metric: PAYMENT_TRIGGER_METRIC.VISITS_COMBINED_COMPLETED,
    targetType: modeDef.targetType,
    targetValue: modeDef.targetValue,
    visitScheduleIds: ids,
  }
}

export function parseVisitIdFromWhenValue(value) {
  const match = String(value ?? "").match(/^simple:visit:(\d+)$/)
  return match ? Number(match[1]) : null
}

/** @typedef {{ value: string, label: string, group?: string, hint?: string, needsTarget?: boolean, targetUnit?: 'percent'|'patients', defaultTarget?: number, metric: number, targetType: number, targetValue?: number, operator?: number, visitScheduleId?: number|null, disabled?: boolean, isVisitPick?: boolean }} SimpleTriggerPreset */

export function buildVisitModePreset(visitId, mode = "pct", visitSchedules = []) {
  const id = Number(visitId)
  if (!Number.isFinite(id) || id <= 0) return null

  const visit = visitSchedules.find((v) => Number(v?.id ?? v?.Id) === id)
  const name = visit ? getConfiguredVisitDisplayName(visit) : `Visit ${id}`
  const modeDef = VISIT_COMPLETION_MODES.find((m) => m.value === mode) ?? VISIT_COMPLETION_MODES[1]

  return {
    value: `${PRESET_PREFIX}visit_${mode}:${id}`,
    label: `${name} — ${modeDef.label.toLowerCase()}`,
    hint:
      mode === "all"
        ? `Pay when every planned patient completes ${name}.`
        : mode === "count"
          ? `Pay when a set number of patients complete ${name}.`
          : `Pay when a percentage of planned patients complete ${name}.`,
    needsTarget: modeDef.needsTarget,
    targetUnit: modeDef.targetUnit,
    defaultTarget: modeDef.defaultTarget,
    metric: PAYMENT_TRIGGER_METRIC.VISIT_COMPLETED,
    targetType: modeDef.targetType,
    targetValue: modeDef.targetValue,
    visitScheduleId: id,
  }
}

/**
 * Plain-language options — one row per configured visit (names from Visit configuration).
 */
export function buildSimpleWhenToPayOptions(visitSchedules = []) {
  /** @type {SimpleTriggerPreset[]} */
  const presets = []
  const sorted = sortVisitSchedules(visitSchedules)

  if (sorted.length === 0) {
    presets.push({
      group: "Configured visits",
      value: `${PRESET_PREFIX}__no_visits`,
      label: "No visits configured — add visits in Visit configuration first",
      disabled: true,
      metric: PAYMENT_TRIGGER_METRIC.VISIT_COMPLETED,
      targetType: PAYMENT_TARGET_TYPE.PERCENTAGE,
      targetValue: 100,
    })
  } else {
    for (const visit of sorted) {
      const id = visit?.id ?? visit?.Id
      if (!id) continue
      const name = getConfiguredVisitDisplayName(visit)
      presets.push({
        group: "Configured visits",
        value: `${PRESET_PREFIX}visit:${id}`,
        label: name,
        hint: `Pay when patients complete ${name}. Choose how many patients below.`,
        isVisitPick: true,
        visitScheduleId: Number(id),
        metric: PAYMENT_TRIGGER_METRIC.VISIT_COMPLETED,
        targetType: PAYMENT_TARGET_TYPE.PERCENTAGE,
        targetValue: 100,
      })
    }
  }

  if (sorted.length >= 2) {
    presets.push({
      group: "Combined visits (any names)",
      value: COMBINED_WHEN_VALUE,
      label: "Combined visits — pick 2 or more",
      hint: "Count a patient only when they complete every visit you select (e.g. Screening + Visit 1).",
      isCombinedPick: true,
      metric: PAYMENT_TRIGGER_METRIC.VISITS_COMBINED_COMPLETED,
      targetType: PAYMENT_TARGET_TYPE.PERCENTAGE,
      targetValue: 100,
    })
  }

  presets.push(
    {
      group: "Enrollment",
      value: `${PRESET_PREFIX}enroll_first`,
      label: "First patient enrolled",
      hint: "Pays when the site enrolls at least one patient.",
      metric: PAYMENT_TRIGGER_METRIC.ENROLLMENT_STARTED,
      targetType: PAYMENT_TARGET_TYPE.BOOLEAN,
      targetValue: 1,
      operator: PAYMENT_RULE_OPERATOR.EQUAL,
    },
    {
      group: "Enrollment",
      value: `${PRESET_PREFIX}enroll_all`,
      label: "All planned patients enrolled",
      metric: PAYMENT_TRIGGER_METRIC.ENROLLMENT_COMPLETED,
      targetType: PAYMENT_TARGET_TYPE.PERCENTAGE,
      targetValue: 100,
    },
    {
      group: "Study completion",
      value: `${PRESET_PREFIX}study_all`,
      label: "All study CRFs complete (every visit)",
      metric: PAYMENT_TRIGGER_METRIC.STUDY_COMPLETE,
      targetType: PAYMENT_TARGET_TYPE.PERCENTAGE,
      targetValue: 100,
    },
  )

  const hasScreening = sorted.some(isScreeningVisit)
  const hasBaseline = sorted.some(isBaselineVisit)
  if (hasScreening && hasBaseline) {
    const combinedNames = getCombinedScreeningBaselineLabel(sorted)
    presets.push(
      {
        group: "Optional — combined screening & baseline",
        value: `${PRESET_PREFIX}sb_all`,
        label: `${combinedNames} — all patients complete (combined)`,
        hint: "Counts a patient only when all screening and baseline visits in this study are done.",
        metric: PAYMENT_TRIGGER_METRIC.SCREENING_AND_BASELINE_COMPLETED,
        targetType: PAYMENT_TARGET_TYPE.PERCENTAGE,
        targetValue: 100,
      },
      {
        group: "Optional — combined screening & baseline",
        value: `${PRESET_PREFIX}sb_pct`,
        label: `${combinedNames} — % of patients complete (combined)`,
        needsTarget: true,
        targetUnit: "percent",
        defaultTarget: 50,
        metric: PAYMENT_TRIGGER_METRIC.SCREENING_AND_BASELINE_COMPLETED,
        targetType: PAYMENT_TARGET_TYPE.PERCENTAGE,
      },
      {
        group: "Optional — combined screening & baseline",
        value: `${PRESET_PREFIX}sb_count`,
        label: `${combinedNames} — patient count (combined)`,
        needsTarget: true,
        targetUnit: "patients",
        defaultTarget: 5,
        metric: PAYMENT_TRIGGER_METRIC.SCREENING_AND_BASELINE_COMPLETED,
        targetType: PAYMENT_TARGET_TYPE.COUNT,
      },
    )
  }

  return presets.filter((p) => !p.disabled || p.value.includes("__no_visits"))
}

/** Flat list with group headers for SearchableSelect. */
export function buildSimpleWhenToPaySelectOptions(visitSchedules = []) {
  const presets = buildSimpleWhenToPayOptions(visitSchedules)
  const flatOptions = []
  let lastGroup = null

  for (const preset of presets) {
    if (preset.group && preset.group !== lastGroup) {
      lastGroup = preset.group
      flatOptions.push({
        value: `__group_${lastGroup}`,
        label: lastGroup,
        groupHeader: true,
      })
    }
    if (preset.disabled) {
      flatOptions.push({
        value: preset.value,
        label: preset.label,
        disabled: true,
      })
      continue
    }
    flatOptions.push({
      value: preset.value,
      label: preset.label,
      title: preset.hint,
    })
  }

  return { flatOptions, presets, visitCount: sortVisitSchedules(visitSchedules).length }
}

export function getDefaultWhenToPayValue(visitSchedules = []) {
  const sorted = sortVisitSchedules(visitSchedules)
  const first = sorted[0]
  const id = first?.id ?? first?.Id
  if (id) return `${PRESET_PREFIX}visit:${id}`
  return `${PRESET_PREFIX}enroll_first`
}

export function getDefaultVisitCompletionMode() {
  return "pct"
}

export function getSimplePresetByValue(presets, value) {
  return presets.find((p) => p.value === value && !p.disabled) ?? null
}

export function resolveEffectivePreset(
  whenValue,
  visitCompletionMode,
  visitSchedules = [],
  presets = [],
  combinedVisitIds = [],
) {
  if (isCombinedWhenValue(whenValue)) {
    return buildCombinedModePreset(
      combinedVisitIds,
      visitCompletionMode || getDefaultVisitCompletionMode(),
      visitSchedules,
    )
  }

  const visitId = parseVisitIdFromWhenValue(whenValue)
  if (visitId) {
    return buildVisitModePreset(visitId, visitCompletionMode || getDefaultVisitCompletionMode(), visitSchedules)
  }

  const legacyVisit = String(whenValue ?? "").match(/^simple:visit_(all|pct|count):(\d+)$/)
  if (legacyVisit) {
    const mode = legacyVisit[1] === "all" ? "all" : legacyVisit[1] === "count" ? "count" : "pct"
    return buildVisitModePreset(Number(legacyVisit[2]), mode, visitSchedules)
  }

  const list = presets.length > 0 ? presets : buildSimpleWhenToPayOptions(visitSchedules)
  return getSimplePresetByValue(list, whenValue)
}

/** Map saved rule back to dropdown state (best effort). */
export function ruleToWhenToPayState(rule, visitSchedules = []) {
  if (!rule) {
    return {
      whenValue: getDefaultWhenToPayValue(visitSchedules),
      visitCompletionMode: getDefaultVisitCompletionMode(),
      combinedVisitIds: [],
    }
  }

  const metric = Number(rule.triggerMetric)
  const targetType = Number(rule.targetType)
  const targetValue = Number(rule.targetValue)
  const visitId = rule.visitScheduleId != null ? Number(rule.visitScheduleId) : null
  const combinedIds = parseVisitScheduleIdsFromRule(rule)

  if (metric === PAYMENT_TRIGGER_METRIC.VISITS_COMBINED_COMPLETED && combinedIds.length >= 2) {
    let mode = "pct"
    if (targetType === PAYMENT_TARGET_TYPE.COUNT) mode = "count"
    else if (targetValue >= 100) mode = "all"
    return {
      whenValue: COMBINED_WHEN_VALUE,
      visitCompletionMode: mode,
      combinedVisitIds: combinedIds,
    }
  }

  if (metric === PAYMENT_TRIGGER_METRIC.ENROLLMENT_STARTED) {
    return {
      whenValue: `${PRESET_PREFIX}enroll_first`,
      visitCompletionMode: getDefaultVisitCompletionMode(),
      combinedVisitIds: [],
    }
  }
  if (metric === PAYMENT_TRIGGER_METRIC.ENROLLMENT_COMPLETED && targetValue >= 100) {
    return {
      whenValue: `${PRESET_PREFIX}enroll_all`,
      visitCompletionMode: getDefaultVisitCompletionMode(),
      combinedVisitIds: [],
    }
  }
  if (metric === PAYMENT_TRIGGER_METRIC.SCREENING_AND_BASELINE_COMPLETED) {
    if (targetType === PAYMENT_TARGET_TYPE.COUNT) {
      return {
        whenValue: `${PRESET_PREFIX}sb_count`,
        visitCompletionMode: getDefaultVisitCompletionMode(),
        combinedVisitIds: [],
      }
    }
    if (targetValue >= 100) {
      return {
        whenValue: `${PRESET_PREFIX}sb_all`,
        visitCompletionMode: getDefaultVisitCompletionMode(),
        combinedVisitIds: [],
      }
    }
    return {
      whenValue: `${PRESET_PREFIX}sb_pct`,
      visitCompletionMode: getDefaultVisitCompletionMode(),
      combinedVisitIds: [],
    }
  }
  if (metric === PAYMENT_TRIGGER_METRIC.STUDY_COMPLETE) {
    return {
      whenValue: `${PRESET_PREFIX}study_all`,
      visitCompletionMode: getDefaultVisitCompletionMode(),
      combinedVisitIds: [],
    }
  }
  if (metric === PAYMENT_TRIGGER_METRIC.VISIT_COMPLETED && visitId) {
    let mode = "pct"
    if (targetType === PAYMENT_TARGET_TYPE.COUNT) mode = "count"
    else if (targetValue >= 100) mode = "all"
    return { whenValue: `${PRESET_PREFIX}visit:${visitId}`, visitCompletionMode: mode, combinedVisitIds: [] }
  }

  return {
    whenValue: encodePaymentRuleTriggerKey(metric, visitId),
    visitCompletionMode: getDefaultVisitCompletionMode(),
    combinedVisitIds: [],
  }
}

/** @deprecated Use ruleToWhenToPayState */
export function ruleToSimpleWhenValue(rule, visitSchedules = []) {
  return ruleToWhenToPayState(rule, visitSchedules).whenValue
}

export function applySimplePresetToForm(preset, targetInput) {
  if (!preset || preset.disabled) return null

  const targetValue = preset.needsTarget
    ? Number(targetInput ?? preset.defaultTarget ?? 0)
    : Number(preset.targetValue ?? 1)

  return {
    triggerMetric: preset.metric,
    triggerCategory: metricCategory(preset.metric),
    visitScheduleId: preset.visitScheduleId != null ? String(preset.visitScheduleId) : "",
    visitScheduleIds: Array.isArray(preset.visitScheduleIds) ? preset.visitScheduleIds : [],
    operator: preset.operator ?? PAYMENT_RULE_OPERATOR.GREATER_THAN_OR_EQUAL,
    targetType: preset.targetType,
    targetValue,
  }
}

export function formatSimpleRuleSummary(rule, visitSchedules = []) {
  if (!rule) return "—"

  const { whenValue, visitCompletionMode, combinedVisitIds } = ruleToWhenToPayState(rule, visitSchedules)
  const presets = buildSimpleWhenToPayOptions(visitSchedules)
  const preset = resolveEffectivePreset(
    whenValue,
    visitCompletionMode,
    visitSchedules,
    presets,
    combinedVisitIds,
  )
  const target = Number(rule.targetValue ?? 0)

  if (Number(rule.triggerMetric) === PAYMENT_TRIGGER_METRIC.VISITS_COMBINED_COMPLETED) {
    const label = formatCombinedVisitLabel(visitSchedules, combinedVisitIds)
    if (Number(rule.targetType) === PAYMENT_TARGET_TYPE.COUNT) return `${label} — ${target} patients (combined)`
    if (target >= 100) return `${label} — all patients complete (combined)`
    return `${label} — ${target}% (combined)`
  }

  if (preset) {
    if (preset.needsTarget) {
      const unit = preset.targetUnit === "patients" ? `${target} patients` : `${target}%`
      const visitId = preset.visitScheduleId
      const visit = visitSchedules.find((v) => Number(v?.id ?? v?.Id) === Number(visitId))
      const name = visit ? getConfiguredVisitDisplayName(visit) : preset.label.split(" — ")[0]
      return `${name} — ${unit}`
    }
    if (isVisitWhenValue(whenValue)) {
      const visitId = parseVisitIdFromWhenValue(whenValue)
      const visit = visitSchedules.find((v) => Number(v?.id ?? v?.Id) === Number(visitId))
      const name = visit ? getConfiguredVisitDisplayName(visit) : preset.label
      return `${name} — all patients complete`
    }
    return preset.label
  }

  const visitId = rule.visitScheduleId != null ? Number(rule.visitScheduleId) : null
  if (Number(rule.triggerMetric) === PAYMENT_TRIGGER_METRIC.VISIT_COMPLETED && visitId) {
    const visit = visitSchedules.find((v) => Number(v?.id ?? v?.Id) === visitId)
    const name = visit ? getConfiguredVisitDisplayName(visit) : rule.visitScheduleName || "Visit"
    if (Number(rule.targetType) === PAYMENT_TARGET_TYPE.COUNT) return `${name} — ${target} patients`
    if (target >= 100) return `${name} — all patients complete`
    return `${name} — ${target}%`
  }

  return rule.triggerMetricName || rule.ruleName || "—"
}

export { PRESET_PREFIX }
