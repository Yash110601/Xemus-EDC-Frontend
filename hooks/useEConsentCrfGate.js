"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import eConsentService from "@/lib/services/eConsent.service"
import studySettingsService from "@/lib/services/studySettings.service"
import { pickIsEConsentRequired } from "@/lib/utils/studySettingsRead"

export const ECONSENT_CRF_BLOCK_MESSAGE =
  "eCONSENT is not approved for this patient. Complete and approve consent before entering CRF data."

function isApprovedStatus(status) {
  const s = String(status || "").toLowerCase()
  return s === "approved"
}

function enrolmentIdFromConsent(row) {
  return row?.patientEnrolmentId ?? row?.PatientEnrolmentId ?? null
}

function statusFromConsent(row) {
  return row?.status ?? row?.Status ?? ""
}

/**
 * Blocks eCRF data entry until subject consent is Approved (when study requires eCONSENT).
 */
export default function useEConsentCrfGate(studyId) {
  const [loading, setLoading] = useState(false)
  const [isEConsentRequired, setIsEConsentRequired] = useState(false)
  const [approvedEnrolmentIds, setApprovedEnrolmentIds] = useState(() => new Set())

  const refresh = useCallback(async () => {
    const sid = Number.parseInt(String(studyId ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0) {
      setIsEConsentRequired(false)
      setApprovedEnrolmentIds(new Set())
      return
    }

    setLoading(true)
    try {
      const settingsRes = await studySettingsService.getByStudyId(sid)
      const required = pickIsEConsentRequired(settingsRes?.data || {})
      setIsEConsentRequired(required)

      if (!required) {
        setApprovedEnrolmentIds(new Set())
        return
      }

      const consentsRes = await eConsentService.getSubjects(sid)
      const rows = Array.isArray(consentsRes?.data) ? consentsRes.data : []

      const approved = new Set()
      for (const row of rows) {
        const eid = enrolmentIdFromConsent(row)
        if (eid != null && isApprovedStatus(statusFromConsent(row))) {
          approved.add(String(eid))
        }
      }
      setApprovedEnrolmentIds(approved)
    } catch {
      setApprovedEnrolmentIds(new Set())
    } finally {
      setLoading(false)
    }
  }, [studyId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const isPatientEligible = useCallback(
    (patientEnrolmentId) => {
      if (!isEConsentRequired) return true
      if (patientEnrolmentId == null || patientEnrolmentId === "") return false
      return approvedEnrolmentIds.has(String(patientEnrolmentId))
    },
    [isEConsentRequired, approvedEnrolmentIds],
  )

  const getPatientLockReason = useCallback(
    (patientEnrolmentId) => {
      if (!isEConsentRequired) return ""
      if (isPatientEligible(patientEnrolmentId)) return ""
      return ECONSENT_CRF_BLOCK_MESSAGE
    },
    [isEConsentRequired, isPatientEligible],
  )

  return useMemo(
    () => ({
      loading,
      isEConsentRequired,
      isPatientEligible,
      getPatientLockReason,
      blockMessage: ECONSENT_CRF_BLOCK_MESSAGE,
      refresh,
    }),
    [loading, isEConsentRequired, isPatientEligible, getPatientLockReason, refresh],
  )
}
