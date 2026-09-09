/**
 * Match IWRS → EDC integration events to patient enrolments by Subject ID / enrolment id.
 */

const EVENT_LABELS = {
  SUBJECT_ENROLLED: "Enrolled in IWRS",
  SUBJECT_RANDOMIZED: "Randomized in IWRS",
  SUBJECT_DISCONTINUED: "Discontinued in IWRS",
  SUBJECT_COMPLETED: "Completed in IWRS",
  KIT_DISPENSED: "Kit dispensed",
  VISIT_COMPLETED: "Visit sent to IWRS",
  STRATIFICATION_CAPTURED: "Stratification sent to IWRS",
  SUBJECT_DISPOSITION_UPDATED: "Disposition synced",
}

export function labelIwrsEventType(eventType) {
  const key = String(eventType ?? "")
    .trim()
    .toUpperCase()
  return EVENT_LABELS[key] || key.replace(/_/g, " ") || "IWRS event"
}

/**
 * @param {object[]} events — platform integration events (may include patientNo / edcPatientEnrolmentId)
 * @returns {Map<string, object>} key = `id:${enrolmentId}` or `no:${patientNoLower}`
 */
export function buildIwrsSyncIndex(events = []) {
  const index = new Map()
  const sorted = [...events].sort((a, b) => {
    const ta = new Date(a.createdAtUtc ?? a.CreatedAtUtc ?? 0).getTime()
    const tb = new Date(b.createdAtUtc ?? b.CreatedAtUtc ?? 0).getTime()
    return tb - ta
  })

  for (const event of sorted) {
    const source = String(event.sourceModule ?? event.SourceModule ?? "").toUpperCase()
    if (source && source !== "IWRS" && source !== "EDC_TO_IWRS") continue

    const enrolmentId = event.edcPatientEnrolmentId ?? event.EdcPatientEnrolmentId
    const patientNo = String(event.patientNo ?? event.PatientNo ?? "")
      .trim()
      .toLowerCase()

    const payload = {
      eventType: event.eventType ?? event.EventType ?? "",
      status: event.status ?? event.Status ?? "",
      createdAtUtc: event.createdAtUtc ?? event.CreatedAtUtc ?? null,
      sourceModule: event.sourceModule ?? event.SourceModule ?? "",
      label: labelIwrsEventType(event.eventType ?? event.EventType),
    }

    if (enrolmentId != null && Number(enrolmentId) > 0) {
      const key = `id:${Number(enrolmentId)}`
      if (!index.has(key)) index.set(key, payload)
    }
    if (patientNo) {
      const key = `no:${patientNo}`
      if (!index.has(key)) index.set(key, payload)
    }
  }

  return index
}

export function lookupIwrsSync(index, { enrolmentId, screeningNo, usubjid, patientId } = {}) {
  if (!index || typeof index.get !== "function") return null
  if (enrolmentId != null && Number(enrolmentId) > 0) {
    const byId = index.get(`id:${Number(enrolmentId)}`)
    if (byId) return byId
  }
  for (const raw of [screeningNo, usubjid, patientId]) {
    const no = String(raw ?? "")
      .trim()
      .toLowerCase()
    if (!no) continue
    const hit = index.get(`no:${no}`)
    if (hit) return hit
  }
  return null
}
