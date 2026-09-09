"use client"

import { useCallback } from "react"

const noopConsole = {
  log: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  group: () => {},
  groupCollapsed: () => {},
  groupEnd: () => {},
  table: () => {},
}
const console = noopConsole

export default function useAuditReasonCore({
  auditReasonModalOpen,
  preCapturedAuditReason,
  formData,
  formAuditBaselineById,
  auditLightLogControlIds,
  /** Flag per fieldId: user touched this field vs persisted baseline via handleFormInputChange (excludes system/rule clears). */
  auditLightDirtyById,
  setAuditChangeReason,
  setAuditReasonModal,
  selectedFormId,
  lastAuditTouchedFieldRef,
  auditReasonDebugRef,
}) {
  const normalizeAuditFieldValue = useCallback((value) => {
    if (value == null) return ""
    if (typeof value === "string") return value
    if (typeof value === "number" || typeof value === "boolean") return String(value)
    if (Array.isArray(value)) return value.map((v) => normalizeAuditFieldValue(v)).join(",")
    if (typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "value")) {
      return normalizeAuditFieldValue(value?.value)
    }
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }, [])

  const computeChangedAuditFields = useCallback((formId, latestFormData, options = {}) => {
    const onlyUserAttributedChanges = Boolean(options.onlyUserAttributedChanges)
    const baseline = formAuditBaselineById?.[formId]
    if (!baseline?.hasPersistedRecord) return []
    const baselineValues = baseline?.values && typeof baseline.values === "object" ? baseline.values : {}
    const latestValues = latestFormData && typeof latestFormData === "object" ? latestFormData : {}
    const keySet = new Set([...Object.keys(baselineValues), ...Object.keys(latestValues)])
    const changed = []
    keySet.forEach((fieldName) => {
      const fieldKey = String(fieldName || "")
      if (!fieldKey || fieldKey.endsWith("_rowCount")) return
      if (!auditLightLogControlIds.has(fieldKey)) return
      if (onlyUserAttributedChanges && !auditLightDirtyById?.[fieldKey]) return
      const oldValue = normalizeAuditFieldValue(baselineValues[fieldKey])
      const newValue = normalizeAuditFieldValue(latestValues[fieldKey])
      if (oldValue === newValue) return
      changed.push({ fieldName: fieldKey, oldValue, newValue })
    })
    if (auditReasonDebugRef?.current) {
      try {
        console.log("[AuditReason][computeChangedAuditFields]", {
          formId,
          hasPersistedRecord: Boolean(formAuditBaselineById?.[formId]?.hasPersistedRecord),
          changedCount: changed.length,
          changedPreview: changed.slice(0, 10),
        })
      } catch {}
    }
    return changed
  }, [
    auditLightDirtyById,
    auditLightLogControlIds,
    auditReasonDebugRef,
    formAuditBaselineById,
    normalizeAuditFieldValue,
  ])

  const promptAuditReasonCaptureIfNeeded = useCallback((formId, options = {}) => {
    if (!formId) return false
    if (auditReasonModalOpen) return false
    if (String(preCapturedAuditReason || "").trim()) return false
    const triggerControlId = String(options?.triggerControlId || "").trim()
    const latestFormData = formData?.[formId] && typeof formData[formId] === "object" ? formData[formId] : {}
    let changedFields = computeChangedAuditFields(formId, latestFormData, {
      onlyUserAttributedChanges: true,
    })
    if (changedFields.length === 0) return false

    if (triggerControlId) {
      const triggerPrefix = `${triggerControlId}_row_`
      const prioritized = changedFields.filter((entry) => {
        const fieldName = String(entry?.fieldName || "")
        return fieldName === triggerControlId || fieldName.startsWith(triggerPrefix)
      })
      if (prioritized.length > 0) {
        const prioritizedKeys = new Set(prioritized.map((entry) => String(entry?.fieldName || "")))
        const rest = changedFields.filter((entry) => !prioritizedKeys.has(String(entry?.fieldName || "")))
        changedFields = [...prioritized, ...rest]
      }
    }

    setAuditChangeReason("")
    setAuditReasonModal({
      open: true,
      status: null,
      options: null,
      changedFields,
      mode: "capture_only",
      pendingSectionId: options?.pendingSectionId ?? null,
    })
    return true
  }, [
    auditReasonModalOpen,
    preCapturedAuditReason,
    formData,
    computeChangedAuditFields,
    setAuditChangeReason,
    setAuditReasonModal,
  ])

  const handleAuditReasonBlurCapture = useCallback((event) => {
    if (!selectedFormId || auditReasonModalOpen) return
    const target = event?.target
    const tagName = String(target?.tagName || "").toUpperCase()
    const role = String(target?.getAttribute?.("role") || "").toLowerCase()
    const isLikelyFormInteraction =
      tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || role === "combobox" || role === "spinbutton"
    if (!isLikelyFormInteraction) return
    const relatedTarget = event?.relatedTarget
    if (relatedTarget?.closest?.("[data-audit-transition='section-tab']")) return
    if (relatedTarget?.closest?.("[data-audit-transition='audit-light-action']")) return

    setTimeout(() => {
      const hasOpenDatePopover =
        typeof document !== "undefined" &&
        (Boolean(document.querySelector(".rdp")) || Boolean(document.querySelector("[data-radix-popper-content-wrapper]")))
      if (hasOpenDatePopover) return
      const touched = lastAuditTouchedFieldRef.current
      const triggerControlId = touched?.formId === selectedFormId ? String(touched?.controlId || "") : ""
      promptAuditReasonCaptureIfNeeded(selectedFormId, {
        triggerControlId,
        preferTriggerField: true,
      })
    }, 0)
  }, [selectedFormId, auditReasonModalOpen, lastAuditTouchedFieldRef, promptAuditReasonCaptureIfNeeded])

  return {
    normalizeAuditFieldValue,
    computeChangedAuditFields,
    promptAuditReasonCaptureIfNeeded,
    handleAuditReasonBlurCapture,
  }
}
