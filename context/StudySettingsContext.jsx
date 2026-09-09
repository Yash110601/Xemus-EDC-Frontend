"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  clearStudySettingsCache,
  fetchStudySettingsByStudyId,
  pickIsEConsentRequired,
  resolveIsAgreementEnabled,
  resolveIsCdashEnabled,
} from "@/lib/utils/studySettingsRead"
import { autoSelectSingleAssignedStudy } from "@/lib/utils/studySiteContext"
import { studyService } from "@/lib/services"

const StudySettingsContext = createContext(null)

function readSelectedStudyId() {
  if (typeof window === "undefined") return null
  const raw = localStorage.getItem("selectedStudyId")
  const id = raw ? Number.parseInt(raw, 10) : null
  return Number.isFinite(id) && id > 0 ? id : null
}

export function StudySettingsProvider({ children }) {
  // Always start null so SSR HTML matches the first client paint (localStorage is client-only).
  const [studyId, setStudyId] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const loadedStudyIdRef = useRef(null)
  const loadSeqRef = useRef(0)
  const isMountedRef = useRef(false)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      loadSeqRef.current += 1
    }
  }, [])

  const load = useCallback(async (id, { force = false } = {}) => {
    if (!isMountedRef.current) return null

    if (!id) {
      if (!isMountedRef.current) return null
      setStudyId(null)
      setData(null)
      setLoading(false)
      loadedStudyIdRef.current = null
      return null
    }

    if (!force && loadedStudyIdRef.current === id) {
      return null
    }

    const seq = ++loadSeqRef.current
    if (!isMountedRef.current) return null
    setStudyId(id)
    setLoading(true)

    try {
      const res = await fetchStudySettingsByStudyId(id, { forceRefresh: force })
      if (!isMountedRef.current || seq !== loadSeqRef.current) return res

      setData(res?.isSuccess ? (res.data ?? null) : null)
      loadedStudyIdRef.current = id
      return res
    } finally {
      if (isMountedRef.current && seq === loadSeqRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      let id = readSelectedStudyId()
      if (!id) {
        id = await autoSelectSingleAssignedStudy(() => studyService.getStudiesForDropdown())
      }
      if (cancelled || !id) return
      void load(id)
    })()

    let debounceTimer = null
    const scheduleLoad = (id, { force = false } = {}) => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        debounceTimer = null
        const resolved = id ?? readSelectedStudyId()
        if (!force && resolved === loadedStudyIdRef.current) return
        load(resolved, { force })
      }, 80)
    }

    const onStudyEvent = (e) => {
      const id = e?.detail?.studyId ?? readSelectedStudyId()
      scheduleLoad(id)
    }

    const onStorage = (e) => {
      if (e?.key !== "selectedStudyId") return
      const id = e.newValue ? Number.parseInt(e.newValue, 10) : null
      scheduleLoad(Number.isFinite(id) && id > 0 ? id : null)
    }

    const onSettingsUpdated = (e) => {
      const id = e?.detail?.studyId ?? readSelectedStudyId()
      clearStudySettingsCache(id)
      loadedStudyIdRef.current = null
      scheduleLoad(id, { force: true })
    }

    window.addEventListener("studySelected", onStudyEvent)
    window.addEventListener("studySiteChanged", onStudyEvent)
    window.addEventListener("studySettingsUpdated", onSettingsUpdated)
    window.addEventListener("storage", onStorage)

    return () => {
      cancelled = true
      if (debounceTimer) clearTimeout(debounceTimer)
      window.removeEventListener("studySelected", onStudyEvent)
      window.removeEventListener("studySiteChanged", onStudyEvent)
      window.removeEventListener("studySettingsUpdated", onSettingsUpdated)
      window.removeEventListener("storage", onStorage)
    }
  }, [load])

  const isAgreementEnabled = useMemo(() => {
    if (!studyId) return null
    return resolveIsAgreementEnabled(studyId, data)
  }, [studyId, data])

  const isEConsentRequired = useMemo(() => {
    if (!studyId) return null
    if (data == null) return null
    const raw =
      data.isEConsentRequired ??
      data.IsEConsentRequired ??
      data.studySetting?.isEConsentRequired ??
      data.studySetting?.IsEConsentRequired
    // Missing field (stale cache / old API) → unknown; do not hide the eCONSENT nav yet.
    if (raw === undefined || raw === null || raw === "") return null
    return pickIsEConsentRequired(data)
  }, [studyId, data])

  const isCdashEnabled = useMemo(() => {
    if (!studyId) return null
    return resolveIsCdashEnabled(studyId, data)
  }, [studyId, data])

  const value = useMemo(
    () => ({
      studyId,
      data,
      loading,
      isAgreementEnabled,
      isEConsentRequired,
      isCdashEnabled,
      refresh: (id, { force = false } = {}) => {
        loadedStudyIdRef.current = null
        return load(id ?? studyId ?? readSelectedStudyId(), { force })
      },
    }),
    [studyId, data, loading, isAgreementEnabled, isEConsentRequired, isCdashEnabled, load],
  )

  return (
    <StudySettingsContext.Provider value={value}>{children}</StudySettingsContext.Provider>
  )
}

export function useStudySettings() {
  return useContext(StudySettingsContext)
}
