"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { visitScheduleService, studyService } from "@/lib/services"
import { syncVisitPaymentRulesAfterVisitSave } from "@/lib/paymentRules/syncVisitPaymentRules"
import {
  Save,
  X,
  Hash,
  Clock,
  CalendarDays,
  Plus,
  Minus,
  Loader2,
  Send,
  BookOpen,
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CRF_DESIGNER_VISIT_OPTIONS, mapVisitTypeEnumToLabel, mapVisitTypeLabelToEnum } from "@/lib/visitTypes"
import { useStudySiteContext } from "@/hooks/useStudySiteContext"
import { publishWorkspaceStudySiteSelection } from "@/lib/utils/studySiteContext"

const VISIT_TYPE_PLACEHOLDER_VALUE = "__visit_type_placeholder__"
const isBatchVisitType = (visitType) => String(visitType || "").trim().toLowerCase() === "visits"
const getSingleVisitName = (visitType) => mapVisitTypeEnumToLabel(mapVisitTypeLabelToEnum(visitType)) || visitType || "Visit"

export default function VisitConfigurationCreatePage() {
  const router = useRouter()

  const [formData, setFormData] = useState({
    totalVisits: "",
    visitType: "",
    duration: "",
    windowMin: "",
    windowMax: "",
  })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)
  const { studyId } = useStudySiteContext()
  const [availableStudies, setAvailableStudies] = useState([])
  const [loadingStudies, setLoadingStudies] = useState(false)
  const [studySearchInput, setStudySearchInput] = useState("")
  const [isStudyDropdownOpen, setIsStudyDropdownOpen] = useState(false)

  const visitTypeOptions = CRF_DESIGNER_VISIT_OPTIONS

  // Fetch available studies
  const fetchStudies = async () => {
    setLoadingStudies(true)
    try {
      const response = await studyService.getStudiesForDropdown()
      if (response?.isSuccess && response?.data) {
        const list = Array.isArray(response.data)
          ? response.data
          : []
        setAvailableStudies(list)
      }
    } catch (error) {
      console.error("Error fetching studies:", error)
    } finally {
      setLoadingStudies(false)
    }
  }

  // Fetch studies on component mount
  useEffect(() => {
    fetchStudies()
  }, [])

  const handleInputChange = (field, value, maxLength) => {
    if (maxLength && value.length > maxLength) return
    
    // Special handling for numeric fields
    if (field === "totalVisits" || field === "duration" || field === "windowMin" || field === "windowMax") {
      // Allow only numbers or empty string
      if (value === "" || /^\d+$/.test(value)) {
        setFormData((prev) => ({ ...prev, [field]: value }))
      }
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }))
    }
    
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setLoading(true)

    const newErrors = {}
    
    // Validate studyId
    if (!studyId) {
      newErrors.studyId = "Study is required"
    }
    
    // Only require totalVisits if visitType is "Visits"
    if (isBatchVisitType(formData.visitType) && !formData.totalVisits) {
      newErrors.totalVisits = "This field is required."
    }
    if (!formData.visitType) newErrors.visitType = "This field is required."
    if (!formData.duration) newErrors.duration = "This field is required."
    // Window Min and Window Max are optional - no validation needed

    setErrors(newErrors)

    if (Object.keys(newErrors).length > 0) {
      setError("Please fill in all required fields")
      setLoading(false)
      return
    }

    try {
      // Call the API to create visit schedule batch
      // Common data fields for create
      const requestData = {
        studyId: studyId,
        visitType: formData.visitType,
        duration: formData.duration,
        windowMin: formData.windowMin,
        windowMax: formData.windowMax,
      }
      
      // For create mode: use 'batch' mode only for Visits, otherwise use 'single' mode.
      // Add mode-specific fields
      if (isBatchVisitType(formData.visitType)) {
        // Batch mode: totalVisits is required
        requestData.totalVisits = formData.totalVisits
      } else {
        // Single mode: visitNo and visitName are required
        requestData.visitNo = "1"
        requestData.visitName = getSingleVisitName(formData.visitType)
      }
      
      const response = await visitScheduleService.createVisitScheduleBatch(requestData)

      if (response.isSuccess) {
        setSuccess(response.message || "Visit schedule created successfully!")
        void syncVisitPaymentRulesAfterVisitSave(studyId).catch(() => {})
        handleClear()
        // Navigate to manage page after successful submit
        setTimeout(() => {
          router.push("/visit-configuration/manage")
        }, 1500)
      } else {
        // Handle API error response
        const errorMessage = response.message || "Failed to save visit schedule. Please try again."
        const errorDetails = response.data?.errors || response.data
        
        if (Array.isArray(errorDetails)) {
          setError(errorDetails.join(", ") || errorMessage)
        } else if (typeof errorDetails === "string") {
          setError(errorDetails)
        } else {
          setError(errorMessage)
        }
      }
    } catch (err) {
      setError(err.message || "Failed to save visit schedule. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setFormData({
      totalVisits: "",
      visitType: "",
      duration: "",
      windowMin: "",
      windowMax: "",
    })
    setErrors({})
    setError("")
    setSuccess("")
  }

  const handleCancel = () => {
    router.push("/visit-configuration/manage")
  }

  return (
    <DashboardLayout>
      <div className="w-full min-h-screen bg-[radial-gradient(circle_at_top,#eef2ff_0%,#f8fafc_45%,#ffffff_100%)] p-4 sm:p-6 lg:p-8">
        <div className="w-full space-y-6">
          <div className="rounded-2xl border border-slate-200/80 bg-white/85 px-5 py-4 shadow-[0_12px_36px_rgba(15,23,42,0.08)] backdrop-blur">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Create Visit Configuration</h1>
            <p className="mt-1 text-sm text-slate-600">Define visit type, duration, and window period for the selected study.</p>
          </div>
          {/* Form */}
          <form onSubmit={handleSubmit} className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white/90 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.1)] backdrop-blur sm:p-6 lg:p-8">
            {/* Success/Error Messages */}
              {success && (
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-bold">✓</span>
                  </div>
                  <p className="text-green-800 font-medium">{success}</p>
                  <button
                    type="button"
                    onClick={() => setSuccess("")}
                    className="ml-auto text-green-600 hover:text-green-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
              {error && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-bold">!</span>
                  </div>
                  <p className="text-red-800 font-medium">{error}</p>
                  <button
                    type="button"
                    onClick={() => setError("")}
                    className="ml-auto text-red-600 hover:text-red-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}

              <div className="space-y-8">
                {/* Study Selection */}
                <div className="relative">
                  <div className="absolute -top-3 left-0 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-1 text-xs font-bold text-white shadow-sm ring-2 ring-white flex items-center gap-2">
                    <BookOpen className="w-3 h-3" />
                    Study Selection
                  </div>
                  <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/65 via-white to-teal-50/45 p-5 pt-8 shadow-[0_6px_18px_rgba(16,185,129,0.09)] sm:p-6 sm:pt-8">
                    <div className="relative">
                      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                        Study <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={studySearchInput || (studyId ? availableStudies.find(s => s.studyId === parseInt(studyId))?.studyProtocolNumber || `Study ${studyId}` : "")}
                          onChange={(e) => {
                            setStudySearchInput(e.target.value)
                            setIsStudyDropdownOpen(true)
                          }}
                          onFocus={() => {
                            setIsStudyDropdownOpen(true)
                            if (availableStudies.length === 0) {
                              fetchStudies()
                            }
                          }}
                          placeholder="Search and select a study..."
                          className={`w-full rounded-xl border px-4 py-3.5 text-sm transition-all ${errors.studyId
                            ? "border-red-300 bg-red-50/50 focus:border-red-500"
                            : "border-slate-200 bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100/80"
                            } outline-none bg-white text-slate-800`}
                          disabled={loadingStudies}
                          onClick={() => {
                            setIsStudyDropdownOpen(true)
                            if (availableStudies.length === 0) {
                              fetchStudies()
                            }
                          }}
                        />
                        {isStudyDropdownOpen && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => {
                                setIsStudyDropdownOpen(false)
                                setStudySearchInput("")
                              }}
                            />
                            <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                              {loadingStudies ? (
                                <div className="px-4 py-3 text-sm text-slate-500">Loading studies...</div>
                              ) : availableStudies.filter(study => {
                                if (!studySearchInput) return true
                                const searchLower = studySearchInput.toLowerCase()
                                const protocolNumber = (study.studyProtocolNumber || "").toLowerCase()
                                return protocolNumber.includes(searchLower)
                              }).length === 0 ? (
                                <div className="px-4 py-3 text-sm text-slate-500">No studies found</div>
                              ) : (
                                availableStudies
                                  .filter(study => {
                                    if (!studySearchInput) return true
                                    const searchLower = studySearchInput.toLowerCase()
                                    const protocolNumber = (study.studyProtocolNumber || "").toLowerCase()
                                    return protocolNumber.includes(searchLower)
                                  })
                                  .map((study) => (
                                    <div
                                      key={study.studyId}
                                      onClick={() => {
                                        publishWorkspaceStudySiteSelection(study.studyId, null)
                                        setStudySearchInput("")
                                        setIsStudyDropdownOpen(false)
                                      }}
                                      className={`px-4 py-2 cursor-pointer hover:bg-emerald-50 transition-colors ${studyId === study.studyId ? "bg-emerald-100" : ""}`}
                                    >
                                      <div className="text-sm font-medium text-slate-900">
                                        {study.studyProtocolNumber || `Study ${study.studyId}`}
                                      </div>
                                    </div>
                                  ))
                              )}
                            </div>
                          </>
                        )}
                      </div>
                      {errors.studyId && (
                        <p className="text-red-500 text-xs mt-1">{errors.studyId}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 1: Visit Information */}
                <div className="relative">
                  <div className="absolute -top-3 left-0 rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 px-4 py-1 text-xs font-bold text-white shadow-sm ring-2 ring-white flex items-center gap-2">
                    <Hash className="w-3 h-3" />
                    Visit Information
                  </div>
                  <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50/65 via-white to-emerald-50/45 p-5 pt-8 shadow-[0_6px_18px_rgba(59,130,246,0.1)] sm:p-6 sm:pt-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Visit Type */}
                      <div className="relative">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Visit Type <span className="text-red-500">*</span>
                        </label>
                        <Select
                          value={formData.visitType ? formData.visitType : VISIT_TYPE_PLACEHOLDER_VALUE}
                          onValueChange={(v) =>
                            handleInputChange("visitType", v === VISIT_TYPE_PLACEHOLDER_VALUE ? "" : v)
                          }
                        >
                          <SelectTrigger
                            className="h-auto w-full min-w-0 rounded-xl border border-slate-200 bg-white py-3.5"
                            aria-invalid={errors.visitType ? true : undefined}
                          >
                            <SelectValue placeholder="Select visit type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem
                              value={VISIT_TYPE_PLACEHOLDER_VALUE}
                              className="px-2 py-2 text-sm font-medium text-slate-500 transition-transform duration-200 data-[highlighted]:translate-x-1"
                            >
                              Select visit type
                            </SelectItem>
                            {visitTypeOptions.map((type) => (
                              <SelectItem
                                key={type}
                                value={type}
                                className="px-2 py-2 text-sm font-medium text-slate-700 transition-transform duration-200 data-[highlighted]:translate-x-1"
                              >
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.visitType && (
                          <p className="text-red-500 text-xs mt-1">{errors.visitType}</p>
                        )}
                      </div>

                      {/* Duration (in Days) */}
                      <div className="relative">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          Duration (in Days) <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={formData.duration}
                            onChange={(e) => handleInputChange("duration", e.target.value)}
                            placeholder="Enter duration in days"
                            className={`w-full rounded-xl border px-4 py-3.5 text-sm transition-all ${errors.duration
                              ? "border-red-300 bg-red-50/50 focus:border-red-500"
                              : "border-slate-200 bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100/80"
                              } outline-none bg-white`}
                          />
                        </div>
                        {errors.duration && (
                          <p className="text-red-500 text-xs mt-1">{errors.duration}</p>
                        )}
                      </div>
                      {/* Total Visits - Only show when Visit Type is "Visits" */}
                      {isBatchVisitType(formData.visitType) && (
                        <div className="relative md:col-span-2">
                          <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Total Visits <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={formData.totalVisits}
                              onChange={(e) => handleInputChange("totalVisits", e.target.value)}
                              placeholder="Enter total number of visits (1-1000)"
                              className={`w-full rounded-xl border px-4 py-3.5 text-sm transition-all ${errors.totalVisits
                                ? "border-red-300 bg-red-50/50 focus:border-red-500"
                                : "border-slate-200 bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100/80"
                                } outline-none bg-white`}
                            />
                          </div>
                          {errors.totalVisits && (
                            <p className="text-red-500 text-xs mt-1">{errors.totalVisits}</p>
                          )}
                          <p className="text-xs text-slate-500 mt-1">This will create visits automatically from 1 to the specified number</p>
                        </div>
                      )}

                    </div>
                  </div>
                </div>

                {/* Section 2: Window Period */}
                <div className="relative">
                  <div className="absolute -top-3 left-0 rounded-full bg-gradient-to-r from-teal-500 to-pink-500 px-4 py-1 text-xs font-bold text-white shadow-sm ring-2 ring-white flex items-center gap-2">
                    <CalendarDays className="w-3 h-3" />
                    Window Period
                  </div>
                  <div className="rounded-2xl border border-teal-200/80 bg-gradient-to-br from-teal-50/65 via-white to-pink-50/45 p-5 pt-8 shadow-[0_6px_18px_rgba(168,85,247,0.1)] sm:p-6 sm:pt-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Window Min */}
                      <div className="relative">
                        <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                          <Minus className="w-4 h-4 text-red-600" />
                          Window Min (in Days)
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={formData.windowMin}
                            onChange={(e) => handleInputChange("windowMin", e.target.value)}
                            placeholder="Enter window min"
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm focus:border-teal-500 focus:ring-4 focus:ring-teal-100/80 outline-none transition-all"
                          />
                        </div>
                      </div>

                      {/* Window Max */}
                      <div className="relative">
                        <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                          <Plus className="w-4 h-4 text-green-600" />
                          Window Max (in Days)
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={formData.windowMax}
                            onChange={(e) => handleInputChange("windowMax", e.target.value)}
                            placeholder="Enter window max"
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm focus:border-teal-500 focus:ring-4 focus:ring-teal-100/80 outline-none transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="sticky bottom-0 z-10 mt-3 flex items-center justify-end gap-3 border-t border-slate-200/90 bg-white/95 pt-4 backdrop-blur">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="inline-flex h-10 min-w-[108px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/70 active:translate-y-[1px] active:shadow-sm"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="inline-flex h-10 min-w-[86px] items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/70 active:translate-y-[1px] active:shadow-sm"
                  >
                    Clear
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex h-10 min-w-[110px] items-center justify-center gap-2 rounded-lg bg-gradient-to-r btn-brand-gradient px-4 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:-translate-y-0.5  hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/80 active:translate-y-[1px] active:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Submit
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
        </div>
      </div>
    </DashboardLayout>
  )
}

