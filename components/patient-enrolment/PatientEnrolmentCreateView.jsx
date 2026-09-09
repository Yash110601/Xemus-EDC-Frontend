"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import patientEnrolmentService from "@/lib/services/patientEnrolment.service"
import eConsentService from "@/lib/services/eConsent.service"
import { useToast } from "@/hooks/use-toast"
import { useStudySiteContext } from "@/hooks/useStudySiteContext"
import { useStudyEConsentRequiredForStudy } from "@/hooks/useStudyEConsentRequired"
import DatePicker from "@/components/ui/date-picker"
import GenderSegmentedControl from "@/components/patient-enrolment/GenderSegmentedControl"
import PatientEnrolmentPageShell from "@/components/patient-enrolment/PatientEnrolmentPageShell"
import { usePatientIdentifierStudySettings } from "@/components/patient-enrolment/usePatientIdentifierStudySettings"
import { useStudyIwrsRtsmEnabled } from "@/components/patient-enrolment/useStudyIwrsRtsmEnabled"
import IwrsEnrolmentLinkBanner from "@/components/patient-enrolment/IwrsEnrolmentLinkBanner"
import {
  PE_ALERT_ERROR_CLASS,
  PE_ALERT_SUCCESS_CLASS,
  PE_ALERT_WARN_CLASS,
  PE_BTN_CLEAR_CLASS,
  PE_BTN_SUBMIT_CLASS,
  PE_FOOTER_CLASS,
  PE_FORM_GRID_CLASS,
  PE_HINT_CLASS,
  PE_INPUT_CLASS,
  PE_INPUT_ERROR_CLASS,
  PE_LABEL_CLASS,
  PE_PANEL_CLASS,
  PE_REQUIRED_CLASS,
  PE_SECTION_FOLLOWING_CLASS,
  PE_SECTION_HEADER_CLASS,
  PE_SECTION_ICON_CLASS,
  PE_SHELL_CARD_CLASS,
} from "@/lib/study/patientEnrolmentFormUi"
import { convertDateToISO } from "@/lib/study/patientEnrolmentUtils"
import { cn } from "@/lib/utils"
import { Calendar, FileSignature, Send, User, X } from "lucide-react"

function summarizeValidationErrors(fieldErrors) {
  const messages = Object.values(fieldErrors).filter(Boolean)
  if (messages.length === 0) return "Please fill in all required fields"
  if (messages.length === 1) return messages[0]
  return messages.slice(0, 3).join(" · ")
}

function scrollToFirstError(fieldErrors, refsByField) {
  const firstKey = Object.keys(fieldErrors)[0]
  if (!firstKey) return
  const target = refsByField[firstKey]?.current
  target?.scrollIntoView?.({ behavior: "smooth", block: "center" })
}

export default function PatientEnrolmentCreateView() {
  const router = useRouter()
  const { toast } = useToast()
  const successTimerRef = useRef(null)
  const eConsentSectionRef = useRef(null)
  const patientSectionRef = useRef(null)
  const { studyId, siteId } = useStudySiteContext()
  const { screeningEnabled } = usePatientIdentifierStudySettings(studyId)
  const { iwrsEnabled } = useStudyIwrsRtsmEnabled(studyId)
  const { isEConsentRequired, loading: eConsentLoading } = useStudyEConsentRequiredForStudy(studyId)
  const eConsentOn = isEConsentRequired === true

  const [formData, setFormData] = useState({
    screeningNo: "",
    patientId: "",
    dataCaptureDate: "",
    initial: "",
    gender: "",
    dateOfBirth: "",
    jurisdictionCode: "IN",
    shareConsent: true,
    contactEmail: "",
    contactMobile: "",
    formVersionId: "",
  })
  const [publishedVersions, setPublishedVersions] = useState([])
  const [errors, setErrors] = useState({})
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)

  const enrollBlockedReason = useMemo(() => {
    if (!studyId || !siteId) {
      return !studyId && !siteId
        ? "Select a study and site from the header before enrolling."
        : !studyId
          ? "Select a study from the header before enrolling."
          : "Select a site from the header before enrolling."
    }
    if (eConsentLoading) return null
    if (eConsentOn && publishedVersions.length === 0) {
      return "This study requires eCONSENT, but no consent form is published yet. Publish one under eCONSENT → Forms first."
    }
    return null
  }, [studyId, siteId, eConsentLoading, eConsentOn, publishedVersions.length])

  const sanitizeInitial = (raw, maxLength = 3) => {
    const next = String(raw || "")
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
    return maxLength ? next.slice(0, maxLength) : next
  }

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!eConsentOn || !studyId) {
      setPublishedVersions([])
      return
    }
    let cancelled = false
    ;(async () => {
      const res = await eConsentService.getPublishedVersions(studyId)
      if (cancelled) return
      const rows = Array.isArray(res?.data) ? res.data : []
      setPublishedVersions(rows)
      if (rows.length === 1) {
        const only = String(rows[0].formVersionId ?? rows[0].FormVersionId)
        setFormData((prev) => ({ ...prev, formVersionId: only }))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [eConsentOn, studyId])

  const handleInputChange = (field, value, maxLength) => {
    const nextValue = field === "initial" ? sanitizeInitial(value, maxLength || 3) : value
    if (maxLength && String(nextValue).length > maxLength) return
    setFormData((prev) => ({ ...prev, [field]: nextValue }))
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const handleClear = () => {
    setFormData({
      screeningNo: "",
      patientId: "",
      dataCaptureDate: "",
      initial: "",
      gender: "",
      dateOfBirth: "",
      jurisdictionCode: "IN",
      shareConsent: true,
      contactEmail: "",
      contactMobile: "",
      formVersionId:
        publishedVersions.length === 1
          ? String(publishedVersions[0].formVersionId ?? publishedVersions[0].FormVersionId)
          : "",
    })
    setErrors({})
    setError("")
    setSuccess("")
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrors({})
    setError("")
    setSuccess("")

    const newErrors = {}
    if (!formData.initial) newErrors.initial = "This field is required."
    if (!formData.gender) newErrors.gender = "This field is required."
    if (!studyId || studyId <= 0) newErrors.studyId = "Study is required."
    if (!siteId || siteId <= 0) newErrors.siteId = "Site is required."

    if (eConsentOn) {
      if (!formData.dateOfBirth) newErrors.dateOfBirth = "Date of birth is required for eCONSENT."
      if (!formData.jurisdictionCode?.trim()) newErrors.jurisdictionCode = "Jurisdiction is required."
      if (!formData.contactEmail?.trim()) newErrors.contactEmail = "Email is required to share eCONSENT."
      if (!formData.contactMobile?.trim()) newErrors.contactMobile = "Mobile is required to share eCONSENT."
      if (publishedVersions.length > 1 && !formData.formVersionId) {
        newErrors.formVersionId = "Select which consent form version to assign."
      }
      if (publishedVersions.length === 0) {
        newErrors.formVersionId = "Publish at least one consent form before enrolling."
      }
    }

    if (formData.dataCaptureDate) {
      const selected = new Date(formData.dataCaptureDate)
      const today = new Date()
      selected.setHours(0, 0, 0, 0)
      today.setHours(0, 0, 0, 0)
      if (selected > today) {
        newErrors.dataCaptureDate = "Data capture date cannot be in the future."
      }
    }

    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) {
      setError(summarizeValidationErrors(newErrors))
      scrollToFirstError(newErrors, {
        studyId: patientSectionRef,
        siteId: patientSectionRef,
        initial: patientSectionRef,
        gender: patientSectionRef,
        dataCaptureDate: patientSectionRef,
        formVersionId: eConsentSectionRef,
        dateOfBirth: eConsentSectionRef,
        jurisdictionCode: eConsentSectionRef,
        contactEmail: eConsentSectionRef,
        contactMobile: eConsentSectionRef,
      })
      return
    }

    try {
      setLoading(true)
      const dataCaptureDateIso = formData.dataCaptureDate
        ? convertDateToISO(formData.dataCaptureDate)
        : new Date().toISOString()

      const payload = {
        StudyId: studyId,
        SiteId: siteId,
        ScreeningNo: formData.screeningNo || "",
        PatientId: formData.patientId || "",
        Initial: formData.initial,
        Gender: formData.gender,
        DataCaptureDate: dataCaptureDateIso,
      }

      if (eConsentOn) {
        payload.DateOfBirth = convertDateToISO(formData.dateOfBirth) || formData.dateOfBirth
        payload.JurisdictionCode = formData.jurisdictionCode.trim().toUpperCase()
        payload.ShareConsent = true
        payload.ContactEmail = formData.contactEmail.trim()
        payload.ContactMobile = formData.contactMobile.trim()
        if (formData.formVersionId) {
          payload.FormVersionId = Number(formData.formVersionId)
        }
      }

      const response = await patientEnrolmentService.createPatientEnrolment(payload)

      if (response.isSuccess) {
        const message = eConsentOn
          ? "Patient created. eCONSENT invite is pending — subject is not study-eligible until consent is approved."
          : "Patient created successfully"
        setSuccess(message)
        toast({ title: message, variant: "success", duration: 4000 })
        if (successTimerRef.current) clearTimeout(successTimerRef.current)
        successTimerRef.current = setTimeout(() => {
          router.push("/patient-enrolment/manage")
        }, 1200)
      } else {
        let errorMessage = response.message || "An error occurred while saving. Please try again."
        if (response.data && Array.isArray(response.data)) {
          const apiErrors = {}
          response.data.forEach((item) => {
            if (item.includes("Initial")) apiErrors.initial = item
            else if (item.includes("Gender")) apiErrors.gender = item
            else apiErrors.submit = item
          })
          setErrors(apiErrors)
          setError("Please correct the errors below.")
        } else if (response.data && typeof response.data === "object") {
          const apiErrors = {}
          Object.keys(response.data).forEach((key) => {
            const formField = key.charAt(0).toLowerCase() + key.slice(1)
            apiErrors[formField] = Array.isArray(response.data[key])
              ? response.data[key][0]
              : response.data[key]
          })
          if (Object.keys(apiErrors).length > 0) {
            setErrors(apiErrors)
            setError("Please correct the errors below.")
          } else {
            setError(errorMessage)
          }
        } else {
          setError(errorMessage)
        }
      }
    } catch {
      setError("An error occurred while creating the patient enrolment. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <PatientEnrolmentPageShell
      title="Create patient enrolment"
      description="Register a new patient for the selected study and site."
    >
      <div className={PE_SHELL_CARD_CLASS}>
        <form onSubmit={handleSubmit} className={PE_PANEL_CLASS}>
          {enrollBlockedReason ? (
            <div className={PE_ALERT_WARN_CLASS}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-white">
                !
              </div>
              <div className="flex-1">
                <p className="font-semibold text-amber-900">Enrollment blocked</p>
                <p className="text-sm text-amber-800/90">{enrollBlockedReason}</p>
                {eConsentOn && publishedVersions.length === 0 && studyId ? (
                  <Link
                    href={`/econsent/forms?studyId=${encodeURIComponent(studyId)}`}
                    className="mt-2 inline-block text-sm font-semibold text-emerald-800 hover:text-emerald-950"
                  >
                    Open eCONSENT Forms →
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          {iwrsEnabled ? <IwrsEnrolmentLinkBanner className="mb-0" /> : null}

          {success && (
            <div className={PE_ALERT_SUCCESS_CLASS}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                ✓
              </div>
              <p className="flex-1 font-medium text-emerald-900">{success}</p>
            </div>
          )}
          {error && (
            <div className={PE_ALERT_ERROR_CLASS}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-white">
                !
              </div>
              <p className="flex-1 font-medium text-amber-900">{error}</p>
              <button type="button" onClick={() => setError("")} className="text-amber-700 hover:text-amber-900">
                <X className="h-5 w-5" />
              </button>
            </div>
          )}

          <div ref={patientSectionRef} className={PE_SECTION_HEADER_CLASS}>
            <div className={PE_SECTION_ICON_CLASS}>
              <User className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 sm:text-xl">Patient information</h2>
              <p className="text-xs text-slate-500 sm:text-sm">
                Enter initials, gender, and capture date for the new patient.
              </p>
            </div>
          </div>

          <div className={PE_FORM_GRID_CLASS}>
            {screeningEnabled ? (
              <div className="md:col-span-2">
                <label className={PE_LABEL_CLASS}>Subject ID (screening / SUBJID)</label>
                <input
                  type="text"
                  value=""
                  readOnly
                  disabled
                  className={cn(PE_INPUT_CLASS, "cursor-not-allowed bg-slate-50 text-slate-500")}
                  placeholder="Auto-assigned on save"
                  aria-describedby="screening-subjid-hint"
                />
                <p id="screening-subjid-hint" className={PE_HINT_CLASS}>
                  Assigned automatically by the EDC — not hand-typed. Format is configured in Study
                  Settings.
                  {iwrsEnabled
                    ? " Use this same Subject ID when you enroll or randomize the subject in Enterprise IWRS."
                    : ""}
                </p>
              </div>
            ) : null}

            <div>
              <label className={PE_LABEL_CLASS}>
                Initial <span className={PE_REQUIRED_CLASS}>*</span>
              </label>
              <input
                type="text"
                value={formData.initial}
                onChange={(e) => handleInputChange("initial", e.target.value, 3)}
                className={cn(PE_INPUT_CLASS, errors.initial && PE_INPUT_ERROR_CLASS)}
                placeholder="Enter initial"
                required
              />
              {errors.initial && <p className="mt-1.5 text-xs text-amber-800">{errors.initial}</p>}
              <p className={PE_HINT_CLASS}>{formData.initial.length} / 3 characters</p>
            </div>

            <div>
              <label className={PE_LABEL_CLASS}>
                Gender <span className={PE_REQUIRED_CLASS}>*</span>
              </label>
              <GenderSegmentedControl
                name="gender"
                value={formData.gender}
                onChange={(next) => handleInputChange("gender", next)}
                error={errors.gender}
              />
            </div>

            <div className="md:col-span-2 md:max-w-md">
              <label className={PE_LABEL_CLASS}>
                <Calendar className="h-4 w-4 text-emerald-600" />
                Data capture date
              </label>
              <DatePicker
                value={formData.dataCaptureDate || null}
                onChange={(value) => {
                  setErrors((prev) => {
                    const next = { ...prev }
                    delete next.dataCaptureDate
                    return next
                  })
                  handleInputChange("dataCaptureDate", value || "")
                }}
                placeholder="dd-mm-yyyy"
                disableFuture
                className={errors.dataCaptureDate ? PE_INPUT_ERROR_CLASS : ""}
              />
              {errors.dataCaptureDate && (
                <p className="mt-1.5 text-xs text-amber-800">{errors.dataCaptureDate}</p>
              )}
            </div>
          </div>

          {eConsentOn ? (
            <div ref={eConsentSectionRef} className={PE_SECTION_FOLLOWING_CLASS}>
              <div className={PE_SECTION_HEADER_CLASS}>
                <div className={PE_SECTION_ICON_CLASS}>
                  <FileSignature className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 sm:text-xl">eCONSENT</h2>
                  <p className="text-xs text-slate-500 sm:text-sm">
                    Age and jurisdiction resolve required signers. Email and mobile are required to share
                    consent. Patient is not study-eligible until consent is approved.
                  </p>
                </div>
              </div>

              <div className={PE_FORM_GRID_CLASS}>
                {publishedVersions.length > 0 ? (
                  <div className="md:col-span-2">
                    <label className={PE_LABEL_CLASS}>
                      Consent form version{" "}
                      {publishedVersions.length > 1 ? <span className={PE_REQUIRED_CLASS}>*</span> : null}
                    </label>
                    <select
                      className={cn(PE_INPUT_CLASS, errors.formVersionId && PE_INPUT_ERROR_CLASS)}
                      value={formData.formVersionId}
                      onChange={(e) => handleInputChange("formVersionId", e.target.value)}
                      required={publishedVersions.length > 1}
                    >
                      {publishedVersions.length > 1 ? <option value="">Select consent version…</option> : null}
                      {publishedVersions.map((opt) => {
                        const id = opt.formVersionId ?? opt.FormVersionId
                        const label =
                          opt.label ||
                          opt.Label ||
                          `${opt.formName || opt.FormName} · v${opt.versionLabel || opt.VersionLabel}`
                        return (
                          <option key={id} value={String(id)}>
                            {label}
                          </option>
                        )
                      })}
                    </select>
                    {errors.formVersionId ? (
                      <p className="mt-1.5 text-xs text-amber-800">{errors.formVersionId}</p>
                    ) : (
                      <p className={PE_HINT_CLASS}>
                        {publishedVersions.length > 1
                          ? "This study has multiple published consents — pick which one to assign."
                          : "Assigned to the published consent version above."}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="md:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    No published consent form found. Publish a template under eCONSENT → Forms before enrolling.
                  </div>
                )}

                <div className="md:max-w-md">
                  <label className={PE_LABEL_CLASS}>
                    Date of birth <span className={PE_REQUIRED_CLASS}>*</span>
                  </label>
                  <DatePicker
                    value={formData.dateOfBirth || null}
                    onChange={(value) => handleInputChange("dateOfBirth", value || "")}
                    placeholder="dd-mm-yyyy"
                    disableFuture
                    className={errors.dateOfBirth ? PE_INPUT_ERROR_CLASS : ""}
                  />
                  {errors.dateOfBirth && (
                    <p className="mt-1.5 text-xs text-amber-800">{errors.dateOfBirth}</p>
                  )}
                </div>

                <div>
                  <label className={PE_LABEL_CLASS}>
                    Jurisdiction <span className={PE_REQUIRED_CLASS}>*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.jurisdictionCode}
                    onChange={(e) => handleInputChange("jurisdictionCode", e.target.value.toUpperCase(), 16)}
                    className={cn(PE_INPUT_CLASS, errors.jurisdictionCode && PE_INPUT_ERROR_CLASS)}
                    placeholder="IN"
                    required
                  />
                  {errors.jurisdictionCode && (
                    <p className="mt-1.5 text-xs text-amber-800">{errors.jurisdictionCode}</p>
                  )}
                </div>

                <div>
                  <label className={PE_LABEL_CLASS}>
                    Email <span className={PE_REQUIRED_CLASS}>*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.contactEmail}
                    onChange={(e) => handleInputChange("contactEmail", e.target.value)}
                    className={cn(PE_INPUT_CLASS, errors.contactEmail && PE_INPUT_ERROR_CLASS)}
                    placeholder="patient@example.com"
                    required
                  />
                  {errors.contactEmail && (
                    <p className="mt-1.5 text-xs text-amber-800">{errors.contactEmail}</p>
                  )}
                </div>

                <div>
                  <label className={PE_LABEL_CLASS}>
                    Mobile <span className={PE_REQUIRED_CLASS}>*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.contactMobile}
                    onChange={(e) => handleInputChange("contactMobile", e.target.value, 32)}
                    className={cn(PE_INPUT_CLASS, errors.contactMobile && PE_INPUT_ERROR_CLASS)}
                    placeholder="10-digit mobile"
                    required
                  />
                  {errors.contactMobile && (
                    <p className="mt-1.5 text-xs text-amber-800">{errors.contactMobile}</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <div className={PE_FOOTER_CLASS}>
            <button type="button" onClick={handleClear} disabled={loading} className={PE_BTN_CLEAR_CLASS}>
              <X className="h-4 w-4" />
              Clear
            </button>
            <button
              type="submit"
              disabled={loading || Boolean(enrollBlockedReason) || eConsentLoading}
              className={PE_BTN_SUBMIT_CLASS}
            >
              <Send className="h-4 w-4" />
              {loading ? "Enrolling..." : "Enroll"}
            </button>
          </div>
        </form>
      </div>
    </PatientEnrolmentPageShell>
  )
}
