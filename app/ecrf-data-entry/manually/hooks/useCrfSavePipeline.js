"use client"

import {
  dedupeQueries,
  getQueryDedupKey,
  isQueryOpenStatus,
  isSystemQueryType,
  normalizeQueryFieldKey,
} from "../lib/crfQueryReviewUi"

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

export default function useCrfSavePipeline({
  saveRequestInFlightRef,
  selectedForm,
  selectedPatient,
  studyId,
  selectedVisit,
  isCraReviewer = false,
  canTsiEditSubmittedCrf,
  currentFormStatus,
  setErrorModal,
  isFormReadOnlyByPermission,
  canEditExistingCrf,
  canCreateCrf,
  /** View on manual eCRF entry route (sub-menu). Used to allow CRA SDV Verify without Edit. */
  canViewEcrfManual = false,
  /** Study-level SDV feature flag — must align with CRA SDV UI. */
  isSdvConfiguredForStudy = false,
  canPerformSdvForStudy = false,
  formData,
  getRuleAwareControl,
  validateControl,
  setValidationErrors,
  summarizeValidationBySection,
  setHighlightSectionErrors,
  sectionsWithContentForDataEntry,
  crfRuleMessages,
  isBlockingSeverity,
  isSubmitBlockingCategory,
  isDateRestrictionCategory,
  replaceFieldIdsWithLabels,
  createFieldLabelMap,
  toRequiredQueryText,
  setSubmitPopupFlow,
  setShowScreeningFailedModal,
  setShowRandomizedEnrolledModal,
  isPatientStatusEnabled,
  visits,
  setLastVisitModal,
  isStudyCompletionDataEntry = false,
  getStudyCompletionSubmitContext,
  applyStudyCompletionStatusBeforeSubmit,
  setSubmitConfirmModalOpen,
  computeChangedAuditFields,
  preCapturedAuditReason,
  setAuditChangeReason,
  setAuditReasonModal,
  setSaving,
  buildNestedFormDataForSave,
  getRepeatableKindFromValue,
  toPositiveRowNumber,
  resolveRepeatableRowCrfDataId,
  toDesignKey,
  auditReasonDebugRef,
  crfDataService,
  persistFieldAuditTrail,
  toast,
  setSaveSuccessPopup,
  isSoftSeverity,
  eConsentBlocksSave = false,
  eConsentBlockMessage = "",
  eConsentService = null,
  siteId,
  currentFormSections,
  stringifyQueryActualValue,
  crfQueryManagementService,
  setCurrentFormStatus,
  setSelectedForm,
  setFormAuditBaselineById,
  setPreCapturedAuditReason,
  crfDataCacheRef,
  invalidateCrfDataByIdCache,
  fetchCrfDataForPatient,
  syncPatientVisitCrfFromGrid,
  setPatientQueriesRefreshTick,
  fetchFormsForVisit,
  setVisitCrfDataMap,
  toScheduleKey,
  setSelectedPatient,
  setPatients,
  setAvailableFormsByVisit,
  setLastSavedAt,
  setShowFormDropdown,
  setSelectedVisit,
  syncSdvAuditMetaFromSavedFormData,
  syncAiEntryFlagsFromSavedFormData,
  /** Optional: resolve persisted CRF row id from visit map when selectedForm.crfDataId is stale. */
  resolveExistingCrfDataIdForSave,
}) {
  const normalizeGender = (raw) => {
    const s = String(raw || "").trim().toLowerCase()
    if (!s) return ""
    if (s === "m" || s === "male") return "male"
    if (s === "f" || s === "female") return "female"
    if (s === "both" || s === "all" || s === "any") return "both"
    return s
  }

  const isControlApplicableForPatientGender = (control) => {
    const controlGender = normalizeGender(control?.properties?.genderSpecific || "both")
    if (!controlGender || controlGender === "both") return true
    const patientGender = normalizeGender(selectedPatient?.gender)
    if (!patientGender) return true
    return controlGender === patientGender
  }

  const resolvePrimaryVisitDateValue = (form, currentFormData) => {
    const designSections = Array.isArray(form?.crfDesign?.sections) ? form.crfDesign.sections : []
    const controlsFromDesign = designSections.flatMap((s) => (Array.isArray(s?.controls) ? s.controls : []))
    const controlsFromCurrentSection = Array.isArray(form?.section?.controls) ? form.section.controls : []
    const controls = [...controlsFromCurrentSection, ...controlsFromDesign]
    const isVisitDateIdentifierControl = (control) => {
      const type = String(control?.type || "").trim().toLowerCase()
      const isDateLikeType =
        type === "date" ||
        type === "ukunkdate" ||
        type === "datepicker" ||
        type.includes("date")
      if (!isDateLikeType) return false
      if (Boolean(control?.properties?.isVisitDate)) return true
      const keyHints = [
        control?.id,
        control?.name,
        control?.properties?.name,
        control?.properties?.fieldName,
        control?.properties?.key,
      ]
      const hasVisitDateKeyHint = keyHints.some((raw) => {
        const token = String(raw || "")
          .trim()
          .toLowerCase()
          .replace(/[\s_-]+/g, "")
        return (
          token.includes("primaryvisitdate") ||
          token.includes("visitdateidentifier") ||
          token === "visitdate"
        )
      })
      if (hasVisitDateKeyHint) return true
      const label = String(control?.properties?.labelText || control?.label || "")
        .trim()
        .toLowerCase()
        .replace(/\*/g, "")
        .replace(/\s+/g, " ")
      return (
        label === "visit date identifier" ||
        label === "date of patient's visit" ||
        label === "date of patients visit"
      )
    }
    const visitDateCandidates = controls.filter((c) => isVisitDateIdentifierControl(c))
    if (visitDateCandidates.length === 0) {
      return { hasVisitDateIdentifier: false, primaryVisitDate: null }
    }

    // Prefer a candidate whose control id currently has a filled value.
    const pickWithValue = visitDateCandidates.find((c) => {
      const id = String(c?.id || "").trim()
      if (!id) return false
      const v = currentFormData?.[id]
      return !(v == null || String(v).trim() === "")
    })

    // Fallback to first candidate if none are filled yet.
    const visitDateControl = pickWithValue || visitDateCandidates[0]
    const rawValue = currentFormData?.[String(visitDateControl?.id || "").trim()]
    const normalized =
      rawValue == null || String(rawValue).trim() === "" ? null : String(rawValue).trim()
    return {
      hasVisitDateIdentifier: true,
      primaryVisitDate: normalized,
    }
  }

  const resolvePersistedCrfDataId = () => {
    const fromForm = parseInt(String(selectedForm?.crfDataId ?? ""), 10)
    if (Number.isFinite(fromForm) && fromForm > 0) return fromForm
    if (typeof resolveExistingCrfDataIdForSave === "function") {
      const fromLookup = parseInt(String(resolveExistingCrfDataIdForSave() ?? ""), 10)
      if (Number.isFinite(fromLookup) && fromLookup > 0) return fromLookup
    }
    return null
  }

  const handleSaveCrfData = async (status, options = {}) => {
    const {
      skipLastVisitCheck = false,
      skipPreSubmitPopups = false,
      /** When true, continue without showing the global "submit locks form" confirmation (caller already confirmed or is a chained step). */
      skipSubmitConfirm = false,
      skipAuditReasonPrompt = false,
      auditReason = "",
      pendingAuditChanges = null,
      keepFormOpen = false,
      skipPostSaveRefetch: skipPostSaveRefetchOption = false,
  /** SDV Verify: persist JSON (isSdvApproved). Payload/UI status stays same as current CRF row status. */
      sdvApprovalSave = false,
      /** CRF-level SDV verification flag (true only when all eligible fields are checked). */
      isSdvVerify = false,
    } = options
    if (saveRequestInFlightRef.current) return
    saveRequestInFlightRef.current = true
    if (!selectedForm || !selectedPatient || !studyId) {
      setErrorModal({ open: true, message: "Please select a patient and study before saving." })
      saveRequestInFlightRef.current = false
      return
    }

    if (!selectedVisit || !selectedVisit.visitScheduleId) {
      setErrorModal({ open: true, message: "Visit Schedule ID is required. Please select a visit." })
      saveRequestInFlightRef.current = false
      return
    }

    // Hard gate: when study requires eCONSENT, patient must be Approved before any CRF write.
    if (eConsentBlocksSave && !sdvApprovalSave) {
      setErrorModal({
        open: true,
        message: eConsentBlockMessage || "eCONSENT is not approved for this patient.",
      })
      saveRequestInFlightRef.current = false
      return
    }
    if (eConsentService && studyId && selectedPatient?.id && !sdvApprovalSave) {
      try {
        const elig = await eConsentService.getEligibility(studyId, selectedPatient.id)
        const data = elig?.data
        const required = Boolean(data?.isEConsentRequired ?? data?.IsEConsentRequired)
        const eligible = data?.isEligible ?? data?.IsEligible
        if (required && eligible === false) {
          setErrorModal({
            open: true,
            message:
              data?.message ||
              data?.Message ||
              eConsentBlockMessage ||
              "eCONSENT is not approved for this patient.",
          })
          saveRequestInFlightRef.current = false
          return
        }
      } catch {
        // Fall through — backend still enforces on create/update.
      }
    }

    const persistedCrfDataId = resolvePersistedCrfDataId()
    const isExistingCrf = Boolean(persistedCrfDataId)
    /** User with SDV role may Verify (SDV / isSdvApproved) on an existing row with View only. */
    const allowSdvVerifyOnlySave = Boolean(
      sdvApprovalSave &&
        canPerformSdvForStudy &&
        isExistingCrf &&
        canViewEcrfManual &&
        isSdvConfiguredForStudy,
    )

    const currentFormStatusParsed = Number.parseInt(String(currentFormStatus ?? ""), 10)
    const isSubmittedCurrentStatus = currentFormStatusParsed === 3
    const tsiCorrectionSave = Boolean(canTsiEditSubmittedCrf && isSubmittedCurrentStatus && status === 2)
    if (canTsiEditSubmittedCrf && isSubmittedCurrentStatus && status !== 2) {
      setErrorModal({
        open: true,
        message: "After submit, use Save only to apply field corrections (draft/submit are not used here).",
      })
      saveRequestInFlightRef.current = false
      return
    }

    if (isFormReadOnlyByPermission && !canTsiEditSubmittedCrf && !allowSdvVerifyOnlySave) {
      setErrorModal({ open: true, message: "You have view-only access for this CRF row." })
      saveRequestInFlightRef.current = false
      return
    }

    const canMutateThisCrf = isExistingCrf ? canEditExistingCrf : canCreateCrf
    if (
      !canMutateThisCrf &&
      !(tsiCorrectionSave && canEditExistingCrf) &&
      !allowSdvVerifyOnlySave
    ) {
      setErrorModal({
        open: true,
        message: isExistingCrf
          ? "You do not have permission to edit this CRF."
          : "You do not have permission to create/save this CRF.",
      })
      saveRequestInFlightRef.current = false
      return
    }

    if (!selectedForm.crfDesignId) {
      setErrorModal({ open: true, message: "CRF Design ID is missing. Please refresh the page and try again." })
      saveRequestInFlightRef.current = false
      return
    }

    /** SDV role pressing Verify: allow PATCH on submitted rows without unlocking full data entry. */
    const preserveSubmittedSdvSave = Boolean(
      canPerformSdvForStudy && sdvApprovalSave && isSubmittedCurrentStatus,
    )
    /** SDV approve must never change CRF lifecycle status in payload or UI; always reuse current tab status. */
    const isKnownStoredCrfStatus =
      Number.isFinite(currentFormStatusParsed) &&
      currentFormStatusParsed >= 1 &&
      currentFormStatusParsed <= 3

    if (status === 3) {
      const currentFormData = formData[selectedForm.id] || {}
      let allControls = selectedForm.section?.controls || []

      if (isStudyCompletionDataEntry && typeof getStudyCompletionSubmitContext === "function") {
        const gateCtx = getStudyCompletionSubmitContext()
        if (gateCtx?.gateError) {
          setErrorModal({
            open: true,
            message: gateCtx.gateError,
          })
          saveRequestInFlightRef.current = false
          return
        }
        allControls = Array.isArray(gateCtx?.controls) ? gateCtx.controls : []
      }

      const allErrors = {}
      let hasErrors = false

      allControls.forEach((control) => {
        const evaluatedControl = getRuleAwareControl(control)
        if (!isControlApplicableForPatientGender(evaluatedControl)) return
        if (evaluatedControl.properties?.hidden) return

        const value = currentFormData[control.id]
        const validation = validateControl(evaluatedControl, value, currentFormData, {
          skipDateRestrictionValidation: true,
          patientGender: selectedPatient?.gender,
        })
        const errorsToBlock = validation.errors || []

        if (errorsToBlock.length > 0) {
          hasErrors = true
          allErrors[control.id] = errorsToBlock
        }
      })

      const controlByIdForSaveLog = new Map(allControls.map((c) => [c.id, c]))
      const labelForSaveValidationKey = (controlId) => {
        const direct = controlByIdForSaveLog.get(controlId)
        if (direct) {
          const t = String(direct.label || direct.properties?.labelText || controlId).trim()
          return t || controlId
        }
        const cellMatch = String(controlId).match(/^(.*)_row_(\d+)_col_(\d+)$/)
        if (cellMatch) {
          const table = controlByIdForSaveLog.get(cellMatch[1])
          const row = parseInt(cellMatch[2], 10) + 1
          const col = parseInt(cellMatch[3], 10) + 1
          const tableLabel = table
            ? String(table.label || table.properties?.labelText || table.id).trim()
            : cellMatch[1]
          return `${tableLabel || cellMatch[1]} (row ${row}, column ${col})`
        }
        return controlId
      }

      setValidationErrors((prev) => ({
        ...prev,
        [selectedForm.id]: allErrors,
      }))

      if (hasErrors) {
        const sectionSummary = summarizeValidationBySection(allErrors)
        setHighlightSectionErrors(true)
        const failureRows = Object.entries(allErrors).map(([controlId, errs]) => ({
          controlId,
          label: labelForSaveValidationKey(controlId),
          errors: Array.isArray(errs) ? errs.map((e) => String(e || "").trim()).filter(Boolean) : [String(errs)],
        }))
        const saveValidationContext = {
          saveStatus: status,
          formId: selectedForm?.id,
          crfDesignId: selectedForm?.crfDesignId,
          patientEnrolmentId: selectedPatient?.id,
          visitScheduleId: selectedVisit?.visitScheduleId,
          failedFieldCount: failureRows.length,
          failures: failureRows,
        }
        console.groupCollapsed("[CRF Save] Validation failed — see table and context below")
        console.table(
          failureRows.map((r) => ({
            controlId: r.controlId,
            label: r.label,
            errors: r.errors.join(" | "),
          })),
        )
        console.warn("Full validation context:", saveValidationContext)
        console.groupEnd()

        const maxLinesInModal = 12
        const detailLines = failureRows.slice(0, maxLinesInModal).map((r) => {
          const msg = r.errors.join(" ")
          return `• ${r.label}${msg ? ` — ${msg}` : ""}`
        })
        const overflow =
          failureRows.length > maxLinesInModal
            ? `\n… and ${failureRows.length - maxLinesInModal} more (see browser console: [CRF Save] Validation failed)`
            : ""
        const sectionNameById = new Map(
          sectionsWithContentForDataEntry.map((s) => [String(s.id), String(s.name || "Section")]),
        )
        const sectionLines = sectionSummary.orderedInvalidSectionIds
          .map((sectionId) => {
            const count = Number(sectionSummary.counts[sectionId] || 0)
            if (!count) return null
            return `• ${sectionNameById.get(sectionId) || "Section"} (${count})`
          })
          .filter(Boolean)
        const detailBlock =
          detailLines.length > 0
            ? `\n\nSections with errors:\n${sectionLines.join("\n")}\n\nFields needing attention:\n${detailLines.join("\n")}${overflow}`
            : ""

        const submitValidationMessage =
          "Please fix all validation errors before submitting. Check the fields marked in red."
        setErrorModal({
          open: true,
          message: submitValidationMessage + detailBlock,
        })
        saveRequestInFlightRef.current = false
        return
      }
    }

    if (status === 3 && selectedForm.crfDesign?.rules && Array.isArray(selectedForm.crfDesign.rules)) {
      const blockingRules = crfRuleMessages.filter(
        (msg) =>
          isBlockingSeverity(msg?.severity) &&
          isSubmitBlockingCategory(msg?.category) &&
          !isDateRestrictionCategory(msg?.category) &&
          !Boolean(msg?.isDateRestriction),
      )
      if (blockingRules.length > 0) {
        const designRules = Array.isArray(selectedForm?.crfDesign?.rules) ? selectedForm.crfDesign.rules : []
        const ruleById = new Map(
          designRules
            .filter(Boolean)
            .map((r) => [String(r?.id ?? ""), r])
            .filter(([k]) => !!k),
        )

        const diagnostics = blockingRules.map((r, idx) => {
          const rid = String(r?.ruleId ?? "")
          const meta = ruleById.get(rid) || {}
          const ruleName = String(meta?.ruleName ?? meta?.name ?? `Rule ${rid || idx + 1}`).trim()
          const exprRaw = String(meta?.expression ?? meta?.ruleExpression ?? "").trim()
          const exprLabel = exprRaw ? replaceFieldIdsWithLabels(exprRaw, createFieldLabelMap(selectedForm.section?.controls || [])) : ""
          const message = String(r?.message || "").trim()
          const severity = String(r?.severity || "BLOCKING").toUpperCase()
          return {
            ruleId: rid || "N/A",
            ruleName,
            severity,
            expression: exprLabel,
            message,
          }
        })

        const submitBlockDetails = {
          patientEnrolmentId: selectedPatient?.id,
          patientDisplayId: selectedPatient?.patientId,
          visitScheduleId: selectedVisit?.visitScheduleId,
          crfDesignId: selectedForm?.crfDesignId,
          formId: selectedForm?.id,
          blockingRuleCount: diagnostics.length,
          blockingRules: diagnostics,
        }
        console.group("CRF submit blocked by rule conditions")
        console.warn("Submit blocked details:\n" + JSON.stringify(submitBlockDetails, null, 2))
        console.groupEnd()

        const cleanedMessages = blockingRules
          .map((r) => toRequiredQueryText(r?.message || "", ""))
          .filter(Boolean)
          .map((m) => {
            const looksLikeExpression = /(indexof\(|[><]=|&&|\|\||[*/])/.test(m.toLowerCase())
            return looksLikeExpression
              ? "One or more rule conditions are not satisfied for this form."
              : m
          })
        const uniqueMessages = [...new Set(cleanedMessages)]
        const topRuleLines = diagnostics
          .slice(0, 3)
          .map((d, i) => {
            const msg = d.message || (uniqueMessages[i] || "")
            return `${i + 1}. ${d.ruleName}${msg ? ` - ${msg}` : ""}`
          })
          .filter(Boolean)
        const fallbackMessage =
          uniqueMessages.length > 0
            ? uniqueMessages.slice(0, 2).join(" ")
            : "One or more rule conditions are not satisfied for this form."
        const blockingMessage =
          topRuleLines.length > 0
            ? `Cannot submit.\nFailed rule condition(s):\n${topRuleLines.join("\n")}`
            : `Cannot submit: ${fallbackMessage}`
        setErrorModal({
          open: true,
          message: blockingMessage,
        })
        saveRequestInFlightRef.current = false
        return
      }
    }

    // One-time confirmation before submit: locks form — offer draft save instead (shows before screening / last visit / audit prompts).
    if (status === 3 && !skipSubmitConfirm && typeof setSubmitConfirmModalOpen === "function") {
      setSubmitConfirmModalOpen(true)
      saveRequestInFlightRef.current = false
      return
    }

    if (status === 3 && !skipPreSubmitPopups) {
      const shouldShowScreeningPopup = selectedForm?.crfDesign?.isScreenFailedCrf === true
      const shouldShowRandomizedPopup = selectedForm?.crfDesign?.isRandomizedEnrolledCrf === true
      if (shouldShowScreeningPopup || shouldShowRandomizedPopup) {
        const totalSteps = shouldShowScreeningPopup && shouldShowRandomizedPopup ? 2 : 1
        setSubmitPopupFlow({
          active: true,
          showRandomizedAfterScreening: shouldShowScreeningPopup && shouldShowRandomizedPopup,
          totalSteps,
        })
        if (shouldShowScreeningPopup) setShowScreeningFailedModal(true)
        else setShowRandomizedEnrolledModal(true)
        saveRequestInFlightRef.current = false
        return
      }
    }

    // Study Completion Form: status from in-form gateway — update before CRF submit; skip last-visit modal.
    if (
      status === 3 &&
      isStudyCompletionDataEntry &&
      typeof applyStudyCompletionStatusBeforeSubmit === "function"
    ) {
      const applied = await applyStudyCompletionStatusBeforeSubmit()
      if (!applied?.ok) {
        toast({
          title: "Status update failed",
          description: applied?.message || "Could not update patient status.",
          variant: "destructive",
        })
        saveRequestInFlightRef.current = false
        return
      }
    }

    // When IsPatientStatusEnabled is on, final status is handled by Study Completion Form,
    // screening/randomized CRF prompts, or manual patient status — not a separate last-visit modal.
    // (Legacy lastVisitModal flow is kept in page.jsx for handleLastVisitConfirm parity.)

    const currentFormData = formData[selectedForm.id] || {}
    const auditFieldChanges = Array.isArray(pendingAuditChanges)
      ? pendingAuditChanges
      : computeChangedAuditFields(selectedForm.id, currentFormData, {
          onlyUserAttributedChanges: true,
        })
    const effectiveAuditReason = String(auditReason || preCapturedAuditReason || "").trim()
    if (!skipAuditReasonPrompt && auditFieldChanges.length > 0) {
      setAuditChangeReason(effectiveAuditReason)
      setAuditReasonModal({
        open: true,
        status,
        options: {
          ...options,
          pendingAuditChanges: auditFieldChanges,
        },
        changedFields: auditFieldChanges,
        mode: "save",
        pendingSectionId: null,
      })
      saveRequestInFlightRef.current = false
      return
    }

    setSaving(true)
    try {
      const repeatableKindForRowNumber =
        selectedVisit?.repeatableKind || getRepeatableKindFromValue(selectedVisit?.visitName)
      const shouldSendRowNumber =
        repeatableKindForRowNumber === "unscheduled" || repeatableKindForRowNumber === "adverse"
      const resolvedRowNumber =
        toPositiveRowNumber(selectedVisit?.repeatableRowNumber) ??
        toPositiveRowNumber(selectedForm?.rowNumber)
      const repeatableExistingCrfDataId = (() => {
        if (!shouldSendRowNumber || resolvedRowNumber == null) return null
        const kind = repeatableKindForRowNumber
        const fromIndex = resolveRepeatableRowCrfDataId(kind, resolvedRowNumber, selectedForm?.crfDesignId)
        if (fromIndex != null) return fromIndex
        const designKey = toDesignKey(selectedForm?.crfDesignId)
        const list = Array.isArray(selectedPatient?.visitCrfData) ? selectedPatient.visitCrfData : []
        const found = list.find((entry) => {
          const entryKind =
            getRepeatableKindFromValue(entry?.crfFormType) ||
            getRepeatableKindFromValue(entry?.visitType) ||
            getRepeatableKindFromValue(entry?.visitName)
          const entryRow = toPositiveRowNumber(entry?.rowNumber)
          const entryDesignKey = toDesignKey(entry?.crfDesignId ?? entry?.crfDesignID ?? null)
          return entryKind === kind && entryRow === resolvedRowNumber && entryDesignKey === designKey
        })
        const id = parseInt(String(found?.crfDataId ?? ""), 10)
        return Number.isFinite(id) && id > 0 ? id : null
      })()
      const effectiveCrfDataId = persistedCrfDataId || repeatableExistingCrfDataId
      const isFirstCrfCreate = !effectiveCrfDataId

      const saveFormShape = buildNestedFormDataForSave(currentFormData, selectedForm, {
        isFirstCreate: isFirstCrfCreate,
      })
      const nestedFormData = saveFormShape?.nestedFormData || {}
      const fieldStateIndex = Array.isArray(saveFormShape?.fieldStateIndex)
        ? saveFormShape.fieldStateIndex
        : []

      const payloadStatus = (() => {
        if (sdvApprovalSave) {
          if (isKnownStoredCrfStatus) return currentFormStatusParsed
          if (preserveSubmittedSdvSave) return 3
          return status
        }
        if (tsiCorrectionSave) return 3
        return status
      })()
      const payload = {
        crfDesignId: selectedForm.crfDesignId,
        patientEnrolmentId: selectedPatient.id,
        visitScheduleId: selectedVisit.visitScheduleId,
        ...(shouldSendRowNumber && resolvedRowNumber != null ? { rowNumber: resolvedRowNumber } : {}),
        formData: nestedFormData,
        fieldStateIndex,
        status: payloadStatus,
        // SDV verify flag (backend expects camelCase key: isSdvVerify)
        ...(sdvApprovalSave ? { isSdvVerify: Boolean(isSdvVerify) } : {}),
        // Always include key for backend consistency; value resolved from visit-date control when available.
        primaryVisitDate: null,
      }
      const { hasVisitDateIdentifier, primaryVisitDate } = resolvePrimaryVisitDateValue(
        selectedForm,
        currentFormData,
      )
      if (hasVisitDateIdentifier) {
        payload.primaryVisitDate = primaryVisitDate
      }

      if (auditReasonDebugRef.current) {
        console.log("Saving CRF Data with payload:", payload)
        console.log("Selected Form:", selectedForm)
        console.log("Selected Patient:", selectedPatient)
        console.log("Selected Visit:", selectedVisit)
      }

      let response

      const canUpdateExistingCrfData =
        effectiveCrfDataId &&
        (!isSubmittedCurrentStatus ||
          tsiCorrectionSave ||
          preserveSubmittedSdvSave ||
          (sdvApprovalSave && canPerformSdvForStudy))

      if (canUpdateExistingCrfData) {
        if (isSubmittedCurrentStatus && !tsiCorrectionSave && !preserveSubmittedSdvSave && !sdvApprovalSave) {
          setErrorModal({ open: true, message: "Cannot update submitted CRF data. It is locked." })
          setSaving(false)
          return
        }
        if (auditReasonDebugRef.current) console.log("Updating CRF Data with ID:", effectiveCrfDataId)
        response = await crfDataService.updateCrfData(effectiveCrfDataId, payload)
      } else if (sdvApprovalSave && effectiveCrfDataId) {
        if (auditReasonDebugRef.current) console.log("SDV verify update with ID:", effectiveCrfDataId)
        response = await crfDataService.updateCrfData(effectiveCrfDataId, payload)
      } else {
        if (auditReasonDebugRef.current) console.log("Creating new CRF Data")
        response = await crfDataService.createCrfData(payload)
        if (
          !response?.isSuccess &&
          typeof response?.message === "string" &&
          /already exists/i.test(response.message)
        ) {
          let retryId = resolvePersistedCrfDataId() ?? effectiveCrfDataId ?? null
          if (!retryId && typeof crfDataService?.getCrfDataList === "function") {
            try {
              const listRes = await crfDataService.getCrfDataList(
                1,
                50,
                studyId,
                selectedPatient.id,
                selectedForm.crfDesignId,
                null,
                true,
              )
              const items = listRes?.data?.items ?? listRes?.data?.Items ?? []
              const scheduleId = selectedVisit?.visitScheduleId
              const rowNum = shouldSendRowNumber ? resolvedRowNumber : null
              const match = items.find((item) => {
                const itemSchedule = item?.visitScheduleId ?? item?.VisitScheduleId
                const sameSchedule =
                  itemSchedule === scheduleId ||
                  String(itemSchedule) === String(scheduleId)
                if (!sameSchedule) return false
                if (rowNum != null) {
                  const itemRow = toPositiveRowNumber(item?.rowNumber ?? item?.RowNumber)
                  return itemRow === rowNum
                }
                return true
              })
              const parsed = parseInt(String(match?.id ?? match?.Id ?? ""), 10)
              if (Number.isFinite(parsed) && parsed > 0) retryId = parsed
            } catch {
              /* list lookup is best-effort */
            }
          }
          if (retryId) {
            if (auditReasonDebugRef.current) console.log("Retrying save as update for existing CRF Data ID:", retryId)
            response = await crfDataService.updateCrfData(retryId, payload)
          }
        }
      }

      if (auditReasonDebugRef.current) {
        console.log("Save CRF Data Response:", response?.isSuccess, response?.statusCode, response?.message)
      }

      if (!response) {
        console.error("Save CRF Data failed: No response from API (network or server error)")
        setErrorModal({ open: true, message: "No response from server. Please check your connection and try again." })
        return
      }

      if (response.isSuccess) {
        const finalizedCrfDataId = parseInt(
          String(response?.data?.id ?? effectiveCrfDataId ?? selectedForm?.crfDataId ?? ""),
          10,
        )
        if (typeof invalidateCrfDataByIdCache === "function" && Number.isFinite(finalizedCrfDataId) && finalizedCrfDataId > 0) {
          invalidateCrfDataByIdCache(finalizedCrfDataId)
        }
        const shouldPersistFieldAudit =
          Array.isArray(auditFieldChanges) &&
          auditFieldChanges.length > 0 &&
          Number.isFinite(finalizedCrfDataId) &&
          finalizedCrfDataId > 0
        if (shouldPersistFieldAudit) {
          const auditResult = await persistFieldAuditTrail(
            auditFieldChanges,
            effectiveAuditReason,
            finalizedCrfDataId,
          )
          if (auditResult.failed > 0) {
            toast({
              title: "Saved with partial audit logging",
              description: "Some field-change audit entries could not be stored. Please retry if required.",
              variant: "destructive",
              duration: 4500,
            })
          }
        }

        if (status === 3) {
          const softRuleMessages = (crfRuleMessages || []).filter((msg) => isSoftSeverity(msg?.severity))
          if (softRuleMessages.length > 0) {
            const crfDataId = response?.data?.id || selectedForm?.crfDataId || null
            if (crfDataId) {
              const studyIdFinal = parseInt(String(studyId ?? ""), 10)
              const siteIdFinal = parseInt(String(siteId ?? ""), 10)
              const patientEnrolmentIdFinal = parseInt(String(selectedPatient?.id ?? ""), 10)
              const visitScheduleIdFinal = parseInt(String(selectedVisit?.visitScheduleId ?? ""), 10)
              const crfDesignIdFinal = parseInt(String(selectedForm?.crfDesignId ?? ""), 10)

              const canCreateQueries =
                Number.isFinite(studyIdFinal) &&
                studyIdFinal > 0 &&
                Number.isFinite(siteIdFinal) &&
                siteIdFinal > 0 &&
                Number.isFinite(patientEnrolmentIdFinal) &&
                patientEnrolmentIdFinal > 0 &&
                Number.isFinite(visitScheduleIdFinal) &&
                visitScheduleIdFinal > 0 &&
                Number.isFinite(crfDesignIdFinal) &&
                crfDesignIdFinal > 0 &&
                Number.isFinite(parseInt(String(crfDataId ?? ""), 10)) &&
                parseInt(String(crfDataId ?? ""), 10) > 0

              if (!canCreateQueries) {
                toast({
                  title: "CRF submitted, but queries were not created",
                  description:
                    "Missing or invalid identifiers required for system-generated query creation.",
                  variant: "destructive",
                  duration: 4500,
                })
              } else {
                const allControls =
                  (currentFormSections?.flatMap((s) => s.controls || []) || selectedForm?.section?.controls || []) ?? []
                const fieldLabelMap = createFieldLabelMap(allControls)

                const designRules = selectedForm?.crfDesign?.rules || []
                const ruleById = new Map(
                  (designRules || [])
                    .filter(Boolean)
                    .map((r) => [String(r?.id ?? ""), r])
                    .filter(([k]) => !!k),
                )

                const uniqueViolations = new Map()
                const existingOpenSystemQueryKeys = new Set()

                try {
                  const existingRes = await crfQueryManagementService.getQueryListByCrfDataId(crfDataId)
                  if (existingRes?.isSuccess && Array.isArray(existingRes.data)) {
                    dedupeQueries(existingRes.data)
                      .filter((q) => isSystemQueryType(q) && isQueryOpenStatus(q.status))
                      .forEach((q) => existingOpenSystemQueryKeys.add(getQueryDedupKey(q)))
                  }
                } catch {
                  /* proceed without skip-set if list API fails */
                }

                for (const msg of softRuleMessages) {
                  const ruleIdRaw = msg?.ruleId ?? msg?.ruleID
                  const ruleId = parseInt(String(ruleIdRaw ?? ""), 10)
                  if (!Number.isFinite(ruleId) || ruleId <= 0) continue

                  const rule = ruleById.get(String(ruleId)) || {}
                  const ruleNameSnapshot = toRequiredQueryText(
                    rule?.ruleName ?? rule?.ruleNameSnapshot ?? rule?.name ?? `Rule_${ruleId}`,
                  )
                  const ruleExpressionSnapshot = toRequiredQueryText(
                    rule?.expression ?? rule?.ruleExpression ?? rule?.ruleExpressionSnapshot ?? "",
                    "Rule condition",
                  )

                  const queryText = toRequiredQueryText(msg?.message ?? "", "System-generated query for rule violation.")
                  if (!queryText) continue

                  const tf = msg?.targetField
                  let fieldIds = []
                  if (Array.isArray(tf)) {
                    fieldIds = tf
                  } else if (typeof tf === "string") {
                    const s = tf.trim()
                    if (!s) fieldIds = []
                    else fieldIds = s.includes(",") ? s.split(",").map((x) => x.trim()).filter(Boolean) : [s]
                  } else if (tf != null) {
                    fieldIds = [String(tf)]
                  }

                  for (const fieldIdRaw of fieldIds) {
                    const fieldId = String(fieldIdRaw ?? "").trim()
                    if (!fieldId) continue

                    const fieldLabel = toRequiredQueryText(fieldLabelMap?.[fieldId] ?? fieldId, fieldId)
                    const rawFieldValue = currentFormData?.[fieldId]
                    const actualValue = stringifyQueryActualValue(rawFieldValue)
                    const expectedCondition =
                      toRequiredQueryText(
                        rule?.expectedCondition ??
                          rule?.expectedValue ??
                          rule?.expected ??
                          queryText,
                        `Value for ${fieldLabel} must satisfy the configured rule condition.`,
                      )
                    const actualValueFinal = toRequiredQueryText(actualValue, "N/A")

                    const key = `${crfDataId}-${normalizeQueryFieldKey(fieldId)}-${ruleId}`
                    if (uniqueViolations.has(key)) continue

                    const existingDedupKey = getQueryDedupKey({
                      fieldId,
                      ruleId,
                      queryType: 1,
                    })
                    if (existingOpenSystemQueryKeys.has(existingDedupKey)) continue

                    uniqueViolations.set(key, {
                      studyId: studyIdFinal,
                      siteId: siteIdFinal,
                      patientEnrolmentId: patientEnrolmentIdFinal,
                      visitScheduleId: visitScheduleIdFinal,
                      crfDesignId: crfDesignIdFinal,
                      crfDataId: parseInt(String(crfDataId), 10),
                      fieldId,
                      fieldLabel,
                      ruleId,
                      ruleNameSnapshot,
                      ruleExpressionSnapshot,
                      expectedCondition,
                      actualValue: actualValueFinal,
                      queryText,
                      queryApproverComment: null,
                    })
                  }
                }

                const payloads = [...uniqueViolations.values()]
                if (payloads.length > 0) {
                  const results = await Promise.allSettled(
                    payloads.map((p) => crfQueryManagementService.createSystemGeneratedQuery(p)),
                  )
                  const failures = results.filter((r) => {
                    if (r.status !== "fulfilled") return true
                    const v = r.value
                    return !v?.isSuccess
                  })

                  if (failures.length > 0) {
                    toast({
                      title: "Submitted successfully, but some queries failed",
                      description: "CRF saved, however query creation for SOFT rule violations did not fully complete. Please try again or contact support.",
                      variant: "destructive",
                      duration: 4000,
                    })
                  } else {
                    toast({
                      title: "System-generated query has been generated",
                      description: `SOFT rule queries created for the submitted CRF (${payloads.length} item${payloads.length === 1 ? "" : "s"}).`,
                      variant: "success",
                      duration: 3500,
                    })
                  }
                }
              }
            }
          }
        }

        const effectiveStatusAfterSave = (() => {
          if (sdvApprovalSave) {
            if (isKnownStoredCrfStatus) return currentFormStatusParsed
            if (preserveSubmittedSdvSave) return 3
            return status
          }
          if (tsiCorrectionSave) return 3
          return status
        })()
        setCurrentFormStatus(effectiveStatusAfterSave)
        if (response.data?.id) {
          setSelectedForm((prev) => ({
            ...prev,
            crfDataId: response.data.id,
          }))
        }
        setFormAuditBaselineById((prev) => ({
          ...prev,
          [selectedForm.id]: {
            values: { ...currentFormData },
            hasPersistedRecord: true,
          },
        }))
        const savedFormDataFromResponse =
          response?.data?.formData ?? response?.data?.FormData ?? response?.formData ?? null
        if (
          typeof syncSdvAuditMetaFromSavedFormData === "function" &&
          savedFormDataFromResponse &&
          selectedForm?.id != null
        ) {
          syncSdvAuditMetaFromSavedFormData(savedFormDataFromResponse, selectedForm.id)
        }
        if (
          typeof syncAiEntryFlagsFromSavedFormData === "function" &&
          savedFormDataFromResponse &&
          selectedForm?.id != null
        ) {
          syncAiEntryFlagsFromSavedFormData(savedFormDataFromResponse, selectedForm.id)
        }
        if (effectiveAuditReason) setPreCapturedAuditReason("")

        if (!skipPostSaveRefetchOption && selectedPatient && studyId) {
          const cacheKey = `${selectedPatient.id}_${studyId}`
          delete crfDataCacheRef.current[cacheKey]
          await fetchCrfDataForPatient(selectedPatient.id, studyId)
          if (typeof syncPatientVisitCrfFromGrid === "function") {
            await syncPatientVisitCrfFromGrid(selectedPatient.id)
          }
          setPatientQueriesRefreshTick((t) => t + 1)
        }
        if (!skipPostSaveRefetchOption && selectedVisit) {
          await fetchFormsForVisit(selectedVisit.visitId, true)
        }

        const statusNames = { 1: "Draft", 2: "Saved", 3: "Submitted" }
        const statusName = statusNames[effectiveStatusAfterSave] || "Saved"

        const successTitle = sdvApprovalSave
          ? "SDV verification saved"
          : tsiCorrectionSave
            ? "Corrections saved"
            : effectiveStatusAfterSave === 3
              ? "CRF submitted"
              : effectiveStatusAfterSave === 2
                ? "CRF saved"
                : "CRF saved as draft"

        const successDescription = sdvApprovalSave
          ? "SDV verification has been recorded for this CRF."
          : tsiCorrectionSave
            ? "Your corrections were saved. The CRF remains submitted."
            : effectiveStatusAfterSave === 3
              ? "The form was submitted successfully and is now locked for data entry."
              : `The form was ${statusName.toLowerCase()} successfully.`

        if (typeof setSaveSuccessPopup === "function") {
          setSaveSuccessPopup({
            open: true,
            title: successTitle,
            description: successDescription,
          })
        } else {
          toast({
            title: successTitle,
            description: successDescription,
            variant: "success",
            duration: 3000,
          })
        }
        setLastSavedAt(new Date())

        const updatedCrfDataId = response.data?.id || selectedForm?.crfDataId || null
        if (selectedVisit?.visitScheduleId) {
          const scheduleKey = toScheduleKey(selectedVisit.visitScheduleId)
          if (scheduleKey) {
          const designKey = toDesignKey(selectedForm?.crfDesignId ?? selectedForm?.crfDesignID ?? null)

          setVisitCrfDataMap((prev) => {
            const existing = prev?.[scheduleKey]
            const normalizedExisting =
              existing && existing.crfDesignId != null
                ? { [String(existing.crfDesignId)]: existing }
                : existing

            return {
              ...prev,
              [scheduleKey]: {
                ...(normalizedExisting || {}),
                [designKey]: {
                  crfDataId: updatedCrfDataId,
                  status: statusName,
                  crfDesignId: selectedForm?.crfDesignId,
                  crfFormType: selectedVisit?.visitName,
                },
              },
            }
          })

          const upsertVisitCrfData = (arr = []) => {
            const next = Array.isArray(arr) ? [...arr] : []
            const selectedScheduleId = selectedVisit.visitScheduleId
            const selectedDesignId = selectedForm?.crfDesignId ?? selectedForm?.crfDesignID ?? null

            const idx = next.findIndex((x) => {
              const sameSchedule =
                x?.visitScheduleId === selectedScheduleId ||
                x?.visitScheduleId?.toString?.() === selectedScheduleId?.toString?.()
              const selectedRowNumber = toPositiveRowNumber(selectedVisit?.repeatableRowNumber)
              const xRowNumber = toPositiveRowNumber(x?.rowNumber)
              const sameRow = selectedRowNumber == null ? true : xRowNumber === selectedRowNumber
              if (selectedDesignId != null) {
                const xDesignId = x?.crfDesignId ?? x?.crfDesignID ?? null
                return sameSchedule && sameRow && String(xDesignId) === String(selectedDesignId)
              }
              return sameSchedule && sameRow
            })
            const newItem = {
              visitScheduleId: selectedScheduleId,
              crfDataId: updatedCrfDataId,
              status: statusName,
              crfFormType: selectedVisit?.visitName,
              crfDesignId: selectedForm?.crfDesignId,
              rowNumber: toPositiveRowNumber(selectedVisit?.repeatableRowNumber) ?? null,
            }
            if (idx >= 0) next[idx] = { ...next[idx], ...newItem }
            else next.push(newItem)
            return next
          }

          setSelectedPatient((prev) =>
            prev ? { ...prev, visitCrfData: upsertVisitCrfData(prev.visitCrfData) } : prev,
          )
          setPatients((prev) =>
            prev.map((p) =>
              p.id === selectedPatient?.id
                ? { ...p, visitCrfData: upsertVisitCrfData(p.visitCrfData) }
                : p,
            ),
          )

          setAvailableFormsByVisit((prev) => {
            const forms = prev?.[selectedVisit.visitId]
            if (!forms || !Array.isArray(forms)) return prev
            const nextStatus = effectiveStatusAfterSave === 3 ? "completed" : "inprogress"
            const selectedRowNumber = toPositiveRowNumber(selectedVisit?.repeatableRowNumber)
            return {
              ...prev,
              [selectedVisit.visitId]: forms.map((f) =>
                toDesignKey(f?.crfDesignId) === toDesignKey(selectedForm?.crfDesignId ?? null) &&
                (selectedRowNumber == null
                  ? true
                  : toPositiveRowNumber(f?.repeatableRowNumber) === selectedRowNumber)
                  ? {
                      ...f,
                      status: nextStatus,
                      crfDataId: updatedCrfDataId,
                    }
                  : f,
              ),
            }
          })
          }
        }

        if (!tsiCorrectionSave && !keepFormOpen) {
          setShowFormDropdown(null)
          setSelectedForm(null)
          setSelectedVisit(null)
          setCurrentFormStatus(null)
        }
      } else {
        const errorMessage = response?.message || (Array.isArray(response?.errors) ? response.errors.join(", ") : response?.errors) || "Unknown error occurred"
        const isAlreadySubmitted = typeof errorMessage === "string" && /already submitted|cannot be modified/i.test(errorMessage)
        if (isAlreadySubmitted) {
          console.warn("Save CRF Data:", errorMessage, { crfDesignId: payload?.crfDesignId, status: payload?.status })
          setCurrentFormStatus(3)
          if (selectedVisit?.visitId) fetchFormsForVisit(selectedVisit.visitId, true)
        } else {
          console.error("Save CRF Data failed:", errorMessage, {
            isSuccess: response?.isSuccess,
            statusCode: response?.statusCode,
            message: response?.message,
            errors: response?.errors,
            crfDesignId: payload?.crfDesignId,
            patientEnrolmentId: payload?.patientEnrolmentId,
            visitScheduleId: payload?.visitScheduleId,
            status: payload?.status,
          })
        }
        setErrorModal({ open: true, message: `Failed to save: ${errorMessage}` })
      }
    } catch (error) {
      const errMsg = error?.message || "Unknown error occurred"
      console.error("Error saving CRF data:", errMsg, error)
      console.error("Error details:", {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
        crfDesignId: selectedForm?.crfDesignId,
        patientEnrolmentId: selectedPatient?.id,
        visitScheduleId: selectedVisit?.visitScheduleId,
        status,
      })
      setErrorModal({ open: true, message: `Error saving form: ${error.message || "Unknown error occurred."}` })
    } finally {
      setSaving(false)
      saveRequestInFlightRef.current = false
    }
  }

  return {
    handleSaveCrfData,
  }
}
