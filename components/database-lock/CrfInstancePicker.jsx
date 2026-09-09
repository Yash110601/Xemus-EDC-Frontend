"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import SearchableSelect from "@/components/ui/searchable-select"
import { Skeleton } from "@/components/ui/skeleton"
import crfDataService from "@/lib/services/crfData.service"

function toScheduleKey(value) {
  const n = Number.parseInt(String(value ?? ""), 10)
  return Number.isFinite(n) && n > 0 ? String(n) : ""
}

function toDesignKey(value) {
  const n = Number.parseInt(String(value ?? ""), 10)
  return Number.isFinite(n) && n > 0 ? String(n) : "default"
}

/** Grid API uses patientId on PatientRowDto (not patientEnrolmentId). */
function getPatientRowId(item) {
  const enrolmentId = item?.patientEnrolmentId ?? item?.PatientEnrolmentId
  if (enrolmentId != null && String(enrolmentId).trim() !== "") {
    return String(enrolmentId).trim()
  }
  const patientId = item?.patientId ?? item?.PatientId
  if (patientId != null && String(patientId).trim() !== "") {
    return String(patientId).trim()
  }
  return ""
}

function getPatientLabel(item) {
  const rowId = getPatientRowId(item)
  const patientId = item?.patientId ?? item?.PatientId
  const initial = String(item?.initial ?? item?.Initial ?? "").trim()

  if (initial && patientId != null) {
    return `${initial} · PID-${patientId}`
  }
  if (patientId != null) return `PID-${patientId}`
  return rowId ? `Patient ${rowId}` : "Patient"
}

function hasCrfDataId(vcd) {
  const id = Number.parseInt(String(vcd?.crfDataId ?? vcd?.CrfDataId ?? ""), 10)
  return Number.isFinite(id) && id > 0
}

function resolveCrfLabel(visitMeta, designId, crfDataId) {
  const designMeta =
    visitMeta?.crfDesigns?.find(
      (d) => String(d.crfDesignId ?? d.CrfDesignId ?? d.id ?? "") === String(designId),
    ) ?? null
  return (
    designMeta?.crfName ??
    designMeta?.CrfName ??
    visitMeta?.crfName ??
    visitMeta?.CrfName ??
    `CRF #${crfDataId}`
  )
}

/**
 * Patient + visit/CRF picker. Selecting a visit immediately resolves the CRF instance
 * and loads the section/field tree via parent onChange (crfDataId).
 */
export default function CrfInstancePicker({ studyId, siteId, value, onChange, disabled = false }) {
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [patients, setPatients] = useState([])
  const [visits, setVisits] = useState([])
  const [selectedPatientRowId, setSelectedPatientRowId] = useState(() => value?.patientRowId ?? "")
  const [selectedVisitCrfKey, setSelectedVisitCrfKey] = useState("")

  const emitChange = useCallback(
    (next) => {
      onChange?.(next)
    },
    [onChange],
  )

  useEffect(() => {
    setSelectedPatientRowId("")
    setSelectedVisitCrfKey("")
    setLoadError("")
    emitChange(null)
  }, [studyId, siteId, emitChange])

  useEffect(() => {
    const sid = Number.parseInt(String(studyId ?? ""), 10)
    const siteNum = Number.parseInt(String(siteId ?? ""), 10)
    if (!Number.isFinite(sid) || sid <= 0 || !Number.isFinite(siteNum) || siteNum <= 0) {
      setPatients([])
      setVisits([])
      return
    }

    let cancelled = false
    const load = async () => {
      setLoading(true)
      setLoadError("")
      try {
        const res = await crfDataService.getPatientAndVisitDataForCrfDataEntry(sid, siteNum)
        if (cancelled) return

        if (!res?.isSuccess) {
          setPatients([])
          setVisits([])
          setLoadError(res?.message || "Could not load patients for this site.")
          return
        }

        const patientList = res?.data?.patientList ?? res?.data?.PatientList ?? []
        const visitList = res?.data?.visitList ?? res?.data?.VisitList ?? []
        setPatients(Array.isArray(patientList) ? patientList : [])
        setVisits(
          (Array.isArray(visitList) ? visitList : []).map((visit, index) => ({
            scheduleKey: toScheduleKey(visit.visitScheduleId ?? visit.VisitScheduleId),
            visitName: visit.visitName ?? visit.VisitName ?? `Visit ${visit.visitNo ?? visit.VisitNo ?? index + 1}`,
            visitNo: visit.visitNo ?? visit.VisitNo ?? index,
            crfDesigns: Array.isArray(visit.crfDesigns ?? visit.CrfDesigns)
              ? (visit.crfDesigns ?? visit.CrfDesigns)
              : [],
            crfDesignId: visit.crfDesignId ?? visit.CrfDesignId,
            crfName: visit.crfName ?? visit.CrfName,
          })),
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [studyId, siteId])

  const patientOptions = useMemo(
    () =>
      patients
        .map((item) => {
          const rowId = getPatientRowId(item)
          if (!rowId) return null
          return { value: rowId, label: getPatientLabel(item) }
        })
        .filter(Boolean),
    [patients],
  )

  const selectedPatient = useMemo(
    () => patients.find((item) => getPatientRowId(item) === String(selectedPatientRowId)) ?? null,
    [patients, selectedPatientRowId],
  )

  /** One row per saved CRF instance (visit × design). Selecting this loads all fields for lock. */
  const visitCrfOptions = useMemo(() => {
    if (!selectedPatient) return []

    const visitCrfMap = {}
    for (const vcd of selectedPatient?.visitCrfData ?? selectedPatient?.VisitCrfData ?? []) {
      if (!hasCrfDataId(vcd)) continue
      const scheduleKey = toScheduleKey(vcd.visitScheduleId ?? vcd.VisitScheduleId)
      if (!scheduleKey) continue
      const designKey = toDesignKey(vcd.crfDesignId ?? vcd.CrfDesignId)
      if (!visitCrfMap[scheduleKey]) visitCrfMap[scheduleKey] = {}
      visitCrfMap[scheduleKey][designKey] = vcd
    }

    const options = []
    for (const visit of visits) {
      const entries = Object.entries(visitCrfMap[visit.scheduleKey] ?? {}).filter(([, vcd]) =>
        hasCrfDataId(vcd),
      )
      if (!entries.length) continue

      const multiCrfOnVisit = entries.length > 1
      for (const [designKey, vcd] of entries) {
        const crfDataId = String(vcd.crfDataId ?? vcd.CrfDataId ?? "")
        const designId = String(vcd.crfDesignId ?? vcd.CrfDesignId ?? designKey)
        const crfLabel = resolveCrfLabel(visit, designId, crfDataId)
        options.push({
          value: `${visit.scheduleKey}:${crfDataId}`,
          label: multiCrfOnVisit ? `${visit.visitName} — ${crfLabel}` : visit.visitName,
          visitLabel: visit.visitName,
          crfLabel,
          crfDataId,
          crfDesignId: designId,
        })
      }
    }

    return options
  }, [selectedPatient, visits])

  useEffect(() => {
    if (!value?.crfDataId) return
    const match = visitCrfOptions.find((opt) => opt.crfDataId === String(value.crfDataId))
    if (match) setSelectedVisitCrfKey(match.value)
    if (value?.patientRowId || value?.patientEnrolmentId) {
      setSelectedPatientRowId(String(value.patientRowId ?? value.patientEnrolmentId ?? ""))
    }
  }, [value?.crfDataId, value?.patientRowId, value?.patientEnrolmentId, visitCrfOptions])

  useEffect(() => {
    if (!selectedPatientRowId) {
      setSelectedVisitCrfKey("")
      emitChange(null)
      return
    }
    if (visitCrfOptions.length === 1 && !selectedVisitCrfKey) {
      setSelectedVisitCrfKey(visitCrfOptions[0].value)
    }
  }, [selectedPatientRowId, visitCrfOptions, selectedVisitCrfKey, emitChange])

  useEffect(() => {
    if (!selectedPatientRowId || !selectedVisitCrfKey) {
      emitChange(null)
      return
    }

    const option = visitCrfOptions.find((opt) => opt.value === selectedVisitCrfKey)
    if (!option?.crfDataId) {
      emitChange(null)
      return
    }

    emitChange({
      patientRowId: String(selectedPatientRowId),
      patientEnrolmentId: String(selectedPatientRowId),
      crfDataId: option.crfDataId,
      crfDesignId: option.crfDesignId,
      visitLabel: option.visitLabel,
      crfLabel: option.crfLabel,
    })
  }, [selectedPatientRowId, selectedVisitCrfKey, visitCrfOptions, emitChange])

  const emptyPatients = !loading && patientOptions.length === 0
  const patientSelectedNoVisits =
    Boolean(selectedPatientRowId) && !loading && visitCrfOptions.length === 0

  if (loading && !patients.length) {
    return (
      <div className="space-y-2" role="status" aria-busy="true" aria-label="Loading CRF instances">
        <Skeleton className="h-11 w-full rounded-xl bg-slate-200/60" />
        <Skeleton className="h-11 w-full rounded-xl bg-slate-200/60" />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-3 md:grid-cols-2">
        <SearchableSelect
          placeholder={emptyPatients ? "No patients at this site" : "Select patient…"}
          options={patientOptions}
          value={selectedPatientRowId}
          onChange={setSelectedPatientRowId}
          disabled={disabled || loading || emptyPatients}
          showSearch
          includeEmptyOption
          emptyOptionLabel="Select patient"
        />
        <SearchableSelect
          placeholder={
            !selectedPatientRowId
              ? "Select patient first"
              : patientSelectedNoVisits
                ? "No saved CRF visits"
                : "Select visit / CRF…"
          }
          options={visitCrfOptions.map(({ value: optValue, label }) => ({ value: optValue, label }))}
          value={selectedVisitCrfKey}
          onChange={setSelectedVisitCrfKey}
          disabled={disabled || !selectedPatientRowId || visitCrfOptions.length === 0}
          showSearch
          includeEmptyOption
          emptyOptionLabel="Select visit"
        />
      </div>

      {loadError ? (
        <p className="text-xs text-red-600" role="alert">
          {loadError}
        </p>
      ) : null}

      {emptyPatients && !loadError ? (
        <p className="text-xs text-slate-500">
          No patients returned for this study and site. Enrol patients or check site assignment.
        </p>
      ) : null}

      {patientSelectedNoVisits ? (
        <p className="text-xs text-amber-800">
          This patient has no saved CRF rows at this site yet. Open eCRF, save a visit form, then return here to lock
          it.
        </p>
      ) : null}

      {selectedVisitCrfKey ? (
        <p className="text-xs text-slate-600">
          Visit selected — all sections and fields for this CRF load below. Expand each section and tick fields to
          lock.
        </p>
      ) : null}
    </div>
  )
}
