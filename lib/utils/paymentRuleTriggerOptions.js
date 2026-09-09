import { PAYMENT_TRIGGER_METRIC } from "@/lib/utils/paymentRuleEnums"
import { mapVisitTypeEnumToLabel, mapVisitTypeLabelToEnum } from "@/lib/visitTypes"

const KEY_PREFIX = "prtrigger:"

export function getConfiguredVisitDisplayName(visit) {
  const name = String(visit?.visitName ?? visit?.VisitName ?? "").trim()
  const visitNo = visit?.visitNo ?? visit?.VisitNo
  if (name && visitNo != null && String(visitNo) !== "") {
    return `${name} (#${visitNo})`
  }
  if (name) return name
  return formatVisitScheduleLabel(visit)
}

export function resolveVisitTypeLabel(visit) {
  const candidates = [
    visit?.visitTypeId,
    visit?.VisitTypeId,
    visit?.visitType,
    visit?.VisitType,
    visit?.visitTypeName,
    visit?.VisitTypeName,
  ]
  for (const candidate of candidates) {
    if (candidate == null || candidate === "") continue
    const fromEnum = mapVisitTypeEnumToLabel(candidate)
    if (fromEnum) return fromEnum
    const fromLabel = mapVisitTypeEnumToLabel(mapVisitTypeLabelToEnum(candidate))
    if (fromLabel) return fromLabel
    if (typeof candidate === "string") return candidate
  }
  return ""
}

export function formatVisitScheduleLabel(visit) {
  const id = visit?.id ?? visit?.Id
  const name = visit?.visitName ?? visit?.VisitName ?? `Visit ${visit?.visitNo ?? visit?.VisitNo ?? id ?? ""}`
  const visitNo = visit?.visitNo ?? visit?.VisitNo
  const typeLabel = resolveVisitTypeLabel(visit)
  const parts = [name]
  if (visitNo != null && visitNo !== "") parts.push(`#${visitNo}`)
  if (typeLabel) parts.push(typeLabel)
  return parts.join(" · ")
}

export function sortVisitSchedules(visits = []) {
  return [...visits].sort((a, b) => {
    const noA = Number(a?.visitNo ?? a?.VisitNo ?? 0)
    const noB = Number(b?.visitNo ?? b?.VisitNo ?? 0)
    if (noA !== noB) return noA - noB
    const idA = Number(a?.id ?? a?.Id ?? 0)
    const idB = Number(b?.id ?? b?.Id ?? 0)
    return idA - idB
  })
}

/** Composite select value: prtrigger:m:{metric} or prtrigger:m:{metric}:v:{visitId} */
export function encodePaymentRuleTriggerKey(triggerMetric, visitScheduleId = null) {
  const metric = Number(triggerMetric)
  if (!Number.isFinite(metric)) return ""
  if (Number(visitScheduleId) > 0) {
    return `${KEY_PREFIX}m:${metric}:v:${Number(visitScheduleId)}`
  }
  return `${KEY_PREFIX}m:${metric}`
}

export function decodePaymentRuleTriggerKey(key) {
  const raw = String(key ?? "")
  if (!raw.startsWith(KEY_PREFIX)) {
    return {
      triggerMetric: Number.parseInt(raw, 10) || null,
      visitScheduleId: null,
    }
  }
  const metricMatch = raw.match(/m:(\d+)/)
  const visitMatch = raw.match(/v:(\d+)/)
  return {
    triggerMetric: metricMatch ? Number(metricMatch[1]) : null,
    visitScheduleId: visitMatch ? Number(visitMatch[1]) : null,
  }
}

function catalogMetric(catalog, metricEnum) {
  return (catalog?.metrics ?? []).find((m) => Number(m.metric) === Number(metricEnum))
}

/**
 * Grouped trigger matrix for payment rule dialog + rules table labels.
 * @returns {{ flatOptions: object[], groups: { id: string, title: string, options: object[] }[] }}
 */
export function buildPaymentRuleTriggerMatrix(catalog, visitSchedules = []) {
  const metrics = catalog?.metrics ?? []
  const metricByEnum = (n) => metrics.find((m) => Number(m.metric) === Number(n))

  const enrollmentMetrics = [
    PAYMENT_TRIGGER_METRIC.ENROLLMENT_STARTED,
    PAYMENT_TRIGGER_METRIC.ENROLLMENT_COMPLETED,
    PAYMENT_TRIGGER_METRIC.ENROLLMENT_PERCENTAGE,
  ]
    .map((n) => metricByEnum(n))
    .filter(Boolean)
    .map((m) => ({
      value: encodePaymentRuleTriggerKey(m.metric),
      label: m.name || `Metric ${m.metric}`,
      title: "Enrollment-based payment trigger",
    }))

  const sbMetrics = [
    PAYMENT_TRIGGER_METRIC.SCREENING_COMPLETED,
    PAYMENT_TRIGGER_METRIC.BASELINE_COMPLETED,
    PAYMENT_TRIGGER_METRIC.SCREENING_AND_BASELINE_COMPLETED,
  ]
    .map((n) => metricByEnum(n))
    .filter(Boolean)
    .map((m) => ({
      value: encodePaymentRuleTriggerKey(m.metric),
      label: m.name || `Metric ${m.metric}`,
      title: "Counts patients completing screening / baseline CRFs (all SB visits in this study)",
    }))

  const sortedVisits = sortVisitSchedules(visitSchedules)
  const visitMetric = metricByEnum(PAYMENT_TRIGGER_METRIC.VISIT_COMPLETED)
  const configuredVisitOptions = visitMetric
    ? sortedVisits.map((visit) => {
        const id = visit?.id ?? visit?.Id
        const label = formatVisitScheduleLabel(visit)
        return {
          value: encodePaymentRuleTriggerKey(PAYMENT_TRIGGER_METRIC.VISIT_COMPLETED, id),
          label,
          title: `Pay when patients complete CRFs for ${label}`,
          visitScheduleId: id,
        }
      })
    : []

  const studyCompleteMetric = metricByEnum(PAYMENT_TRIGGER_METRIC.STUDY_COMPLETE)
  const completionOptions = studyCompleteMetric
    ? [
        {
          value: encodePaymentRuleTriggerKey(PAYMENT_TRIGGER_METRIC.STUDY_COMPLETE),
          label: studyCompleteMetric.name || "Study complete",
          title: "All required study CRFs completed per patient",
        },
      ]
    : []

  const groups = [
    { id: "enrollment", title: "Enrollment", options: enrollmentMetrics },
    { id: "screening", title: "Screening & baseline", options: sbMetrics },
    {
      id: "visits",
      title: `Configured visits (${sortedVisits.length})`,
      options: configuredVisitOptions,
      emptyHint:
        sortedVisits.length === 0
          ? "No visits configured — add visits under Visit configuration first."
          : null,
    },
    { id: "completion", title: "Study completion", options: completionOptions },
  ].filter((g) => g.options.length > 0 || g.emptyHint)

  const flatOptions = []
  for (const group of groups) {
    flatOptions.push({
      value: `__group_${group.id}`,
      label: group.title,
      groupHeader: true,
    })
    if (group.options.length === 0 && group.emptyHint) {
      flatOptions.push({
        value: `__empty_${group.id}`,
        label: group.emptyHint,
        disabled: true,
      })
    } else {
      flatOptions.push(...group.options)
    }
  }

  return { flatOptions, groups, sortedVisits }
}

export function resolvePaymentRuleTriggerLabel(
  { triggerMetric, visitScheduleId, triggerMetricName, visitScheduleName } = {},
  visitSchedules = [],
) {
  const metric = Number(triggerMetric)
  const visitId = visitScheduleId != null ? Number(visitScheduleId) : null

  if (metric === PAYMENT_TRIGGER_METRIC.VISIT_COMPLETED && visitId) {
    const visit = visitSchedules.find((v) => Number(v?.id ?? v?.Id) === visitId)
    const visitLabel = visit ? formatVisitScheduleLabel(visit) : visitScheduleName
    return visitLabel ? `Visit completed — ${visitLabel}` : triggerMetricName || "Visit completed"
  }

  if (visitScheduleName) {
    return `${triggerMetricName || "Visit"} — ${visitScheduleName}`
  }

  return triggerMetricName || "—"
}

export function triggerKeyFromRule(rule) {
  if (!rule) return encodePaymentRuleTriggerKey(PAYMENT_TRIGGER_METRIC.ENROLLMENT_STARTED)
  return encodePaymentRuleTriggerKey(rule.triggerMetric, rule.visitScheduleId)
}
