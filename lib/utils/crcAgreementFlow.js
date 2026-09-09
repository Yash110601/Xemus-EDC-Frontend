/**
 * CRC agreement gate — single source of truth for when to show the agreement modal.
 *
 * Priority (senior / reliable):
 * 1. Accessible studies list (GET studies with sites) — isAgreementEnabled / isAgreementSigned
 * 2. Study settings API — isAgreementEnabled (cannot override list when list says enabled)
 * 3. UserAgreement GetAgreementDataByStudyId — final signed state + modal content
 *
 * We do NOT skip the modal based on stale localStorage when studies list says unsigned.
 */

import userAgreementService from "@/lib/services/userAgreement.service"
import {
  ensureAccessibleStudiesList,
  fetchAccessibleStudiesListFresh,
  fetchStudySettingsByStudyId,
  pickIsAgreementEnabledFromStudiesList,
  pickIsAgreementSignedFromStudiesList,
  resolveIsAgreementEnabled,
} from "@/lib/utils/studySettingsRead"

export const AGREEMENT_SIGNED_LS_PREFIX = "agreementSigned_"

export function parseStudyId(studyId) {
  const id = Number.parseInt(String(studyId), 10)
  return Number.isFinite(id) && id > 0 ? id : null
}

export function isCrcUser(user, roleNameFallback = "") {
  const role = String(
    user?.roleName ?? user?.RoleName ?? user?.roleCode ?? user?.RoleCode ?? roleNameFallback ?? "",
  )
    .trim()
    .toLowerCase()
  return role === "crc"
}

export function isAgreementSignedFromApiPayload(data) {
  if (!data || typeof data !== "object") return false
  return Boolean(
    data.isSigned ||
      data.hasSigned ||
      data.isAgreementSigned ||
      data.agreementSigned ||
      (data.userAgreementId && data.userAgreementId > 0),
  )
}

export function getAgreementSignedCache(studyId) {
  const id = parseStudyId(studyId)
  if (!id || typeof window === "undefined") return false
  return localStorage.getItem(`${AGREEMENT_SIGNED_LS_PREFIX}${id}`) === "true"
}

export function setAgreementSignedCache(studyId, signed) {
  const id = parseStudyId(studyId)
  if (!id || typeof window === "undefined") return
  const key = `${AGREEMENT_SIGNED_LS_PREFIX}${id}`
  if (signed) localStorage.setItem(key, "true")
  else localStorage.removeItem(key)
}

/** Keep studiesList localStorage in sync after sign (so next check does not re-open modal). */
export function patchStudyAgreementSignedInList(studyId, signed) {
  const id = parseStudyId(studyId)
  if (!id || typeof window === "undefined") return
  try {
    const raw = localStorage.getItem("studiesList")
    if (!raw) return
    const list = JSON.parse(raw)
    if (!Array.isArray(list)) return
    const updated = list.map((s) => {
      const sid = Number.parseInt(String(s?.id ?? s?.studyId ?? s?.Id ?? s?.StudyId), 10)
      if (sid !== id) return s
      return { ...s, isAgreementSigned: signed, IsAgreementSigned: signed }
    })
    localStorage.setItem("studiesList", JSON.stringify(updated))
    localStorage.setItem("studiesListTime", String(Date.now()))
  } catch {
    /* best-effort */
  }
}

export function markAgreementSignedForStudy(studyId) {
  const id = parseStudyId(studyId)
  if (!id) return
  setAgreementSignedCache(id, true)
  patchStudyAgreementSignedInList(id, true)
}

export function clearAgreementSignedForStudy(studyId) {
  const id = parseStudyId(studyId)
  if (!id) return
  setAgreementSignedCache(id, false)
  patchStudyAgreementSignedInList(id, false)
}

/**
 * Synchronous fast path from cached accessible studies list (localStorage).
 * Used to open the agreement modal immediately after study/site selection.
 */
export function getCrcAgreementStatusFromCache(studyId) {
  const id = parseStudyId(studyId)
  const idle = {
    studyId: id,
    agreementEnabled: false,
    agreementRequired: false,
    agreementSigned: true,
    showModal: false,
    agreementData: null,
    isTentative: false,
  }
  if (!id) return idle

  const enabledFromList = pickIsAgreementEnabledFromStudiesList(id)
  if (enabledFromList === false) {
    return { ...idle, agreementSigned: true, isTentative: false }
  }

  const signedFromList = pickIsAgreementSignedFromStudiesList(id)
  if (signedFromList === true) {
    return {
      studyId: id,
      agreementEnabled: true,
      agreementRequired: true,
      agreementSigned: true,
      showModal: false,
      agreementData: null,
      isTentative: false,
    }
  }

  if (signedFromList === false || enabledFromList === true) {
    return {
      studyId: id,
      agreementEnabled: enabledFromList !== false,
      agreementRequired: true,
      agreementSigned: false,
      showModal: true,
      agreementData: null,
      isTentative: true,
    }
  }

  return { ...idle, isTentative: true }
}

/**
 * Resolve CRC agreement UI state for a study (async).
 * @param {number} studyId
 * @param {{ refreshStudiesList?: () => Promise<void> }} options
 * @returns {Promise<{
 *   studyId: number,
 *   agreementEnabled: boolean,
 *   agreementRequired: boolean,
 *   agreementSigned: boolean,
 *   showModal: boolean,
 *   agreementData: object|null,
 * }>}
 */
export async function resolveCrcAgreementStatus(studyId, { refreshStudiesList } = {}) {
  const id = parseStudyId(studyId)
  const idle = {
    studyId: id,
    agreementEnabled: false,
    agreementRequired: false,
    agreementSigned: true,
    showModal: false,
    agreementData: null,
  }
  if (!id) return idle

  const cachedSignedBefore = pickIsAgreementSignedFromStudiesList(id)
  const shouldFetchAgreement = cachedSignedBefore !== true

  const studiesPromise =
    typeof refreshStudiesList === "function"
      ? refreshStudiesList().catch((e) => {
          console.warn("[crcAgreementFlow] studies refresh failed", e)
          return ensureAccessibleStudiesList()
        })
      : ensureAccessibleStudiesList().catch((e) => {
          console.warn("[crcAgreementFlow] studies list ensure failed", e)
          return fetchAccessibleStudiesListFresh()
        })

  const settingsPromise = fetchStudySettingsByStudyId(id, { forceRefresh: false })
  const agreementPromise = shouldFetchAgreement
    ? userAgreementService.getAgreementDataByStudyId(id).catch((error) => {
        console.error("[crcAgreementFlow] getAgreementDataByStudyId failed", error)
        return null
      })
    : Promise.resolve(null)

  await studiesPromise
  const [settingsRes, agreementResponse] = await Promise.all([settingsPromise, agreementPromise])

  const agreementEnabled = resolveIsAgreementEnabled(id, settingsRes?.data ?? null)

  if (agreementEnabled === false) {
    return { ...idle, studyId: id, agreementSigned: true }
  }

  const signedFromList = pickIsAgreementSignedFromStudiesList(id)

  if (signedFromList === true) {
    markAgreementSignedForStudy(id)
    return {
      studyId: id,
      agreementEnabled: true,
      agreementRequired: true,
      agreementSigned: true,
      showModal: false,
      agreementData: null,
    }
  }

  if (signedFromList === false) {
    setAgreementSignedCache(id, false)
  }

  let agreementData = null
  if (agreementResponse?.isSuccess && agreementResponse.data) {
    agreementData = agreementResponse.data
  }

  const signedFromApi = isAgreementSignedFromApiPayload(agreementData)

  if (signedFromApi) {
    markAgreementSignedForStudy(id)
    return {
      studyId: id,
      agreementEnabled: true,
      agreementRequired: true,
      agreementSigned: true,
      showModal: false,
      agreementData,
    }
  }

  const agreementRequired = agreementEnabled === true || signedFromList === false
  const showModal = agreementRequired

  return {
    studyId: id,
    agreementEnabled: agreementEnabled !== false,
    agreementRequired,
    agreementSigned: false,
    showModal,
    agreementData,
  }
}
