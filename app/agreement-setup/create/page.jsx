"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import AgreementFormShell from "@/components/agreement-setup/agreement-form-shell"
import { agreementService, studyService } from "@/lib/services"
import { loadImageAsBlobUrl } from "@/lib/utils/imageLoader"
import {
  readAgreementEditPrefill,
  clearAgreementEditPrefill,
} from "@/lib/utils/agreementEditPrefill"
import {
  Save,
  Upload,
  X,
  Image as ImageIcon,
  FileText,
  User,
  Building2,
  Signature,
  RotateCcw,
} from "lucide-react"
import RichTextEditor from "@/components/rich-text-editor"
import { sanitizeAgreementContentHtml } from "@/lib/utils/agreementContentHtml"
import {
  AGREEMENT_TEXT_STANDARD,
  buildStandardAgreementBodyHtml,
  isAgreementContentEmpty,
} from "@/lib/utils/agreementContentStandard"

// Example CIN format for placeholder (static to avoid hydration mismatch)
const CIN_PLACEHOLDER = "e.g., U74999MH1234PLC123456"

function AgreementCreateContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const agreementId = searchParams.get("id")
  const isEditMode = !!agreementId
  
  const [formData, setFormData] = useState({
    studyId: "",
    // Company details
    headerLogo: null,
    headerLogoPreview: null,
    companyName: "",
    companyTagline: "",
    companyAddress: "",
    
    // Header Content (rich text)
    headerContent: "",
    
    // Footer settings
    footerPhone: "",
    footerWebsite: "",
    footerCIN: "",
    
    // Company Representative Signature
    companySignature: {
      image: null,
      imagePreview: null,
      name: "",
      designation: "",
      description: "",
    },
  })
  
  const [errors, setErrors] = useState({})
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingAgreement, setLoadingAgreement] = useState(false)
  const [availableStudies, setAvailableStudies] = useState([])
  const [loadingStudies, setLoadingStudies] = useState(false)
  const [studySearchInput, setStudySearchInput] = useState("")
  const [isStudyDropdownOpen, setIsStudyDropdownOpen] = useState(false)
  const hasAppliedStandardTemplateRef = useRef(false)
  const hasLoadedAgreementRef = useRef(false)

  const applyStandardAgreementContent = () => {
    const html = buildStandardAgreementBodyHtml({
      companyName: formData.companyName || "the Company",
    })
    handleInputChange("headerContent", html)
  }

  // New agreement: pre-fill Xemus standard body format (minimal edits per study)
  useEffect(() => {
    if (isEditMode || hasAppliedStandardTemplateRef.current) return
    if (!isAgreementContentEmpty(formData.headerContent)) return
    hasAppliedStandardTemplateRef.current = true
    setFormData((prev) => ({
      ...prev,
      headerContent: buildStandardAgreementBodyHtml({
        companyName: prev.companyName || "the Company",
      }),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode])
  
  // Blob URLs for images loaded from API (for edit mode)
  const [headerLogoBlobUrl, setHeaderLogoBlobUrl] = useState(null)
  const [signatureImageBlobUrl, setSignatureImageBlobUrl] = useState(null)

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

  // Load agreement data if in edit mode
  useEffect(() => {
    if (isEditMode && agreementId && !hasLoadedAgreementRef.current) {
      hasLoadedAgreementRef.current = true

      const prefill = readAgreementEditPrefill(agreementId)
      if (prefill) {
        setFormData((prev) => ({
          ...prev,
          studyId: prefill.studyId ? String(prefill.studyId) : prev.studyId,
          companyName: prefill.companyName || prev.companyName,
          companyTagline: prefill.tagline || prev.companyTagline,
        }))
      }

      loadAgreementData(parseInt(agreementId))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, agreementId])

  // Fetch studies on component mount
  useEffect(() => {
    fetchStudies()
  }, [])

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (headerLogoBlobUrl) {
        window.URL.revokeObjectURL(headerLogoBlobUrl)
      }
      if (signatureImageBlobUrl) {
        window.URL.revokeObjectURL(signatureImageBlobUrl)
      }
    }
  }, [headerLogoBlobUrl, signatureImageBlobUrl])

  const loadAgreementData = async (id) => {
    try {
      setLoadingAgreement(true)
      setError("")
      const response = await agreementService.getAgreementById(id)
      
      if (response.isSuccess && response.data) {
        const agreement = response.data
        
        // Clean up existing blob URLs
        if (headerLogoBlobUrl) {
          window.URL.revokeObjectURL(headerLogoBlobUrl)
          setHeaderLogoBlobUrl(null)
        }
        if (signatureImageBlobUrl) {
          window.URL.revokeObjectURL(signatureImageBlobUrl)
          setSignatureImageBlobUrl(null)
        }
        
        // Map API response to form data structure
        setFormData({
          studyId: agreement.studyId ? String(agreement.studyId) : "",
          headerLogo: null, // Will need to handle file download separately if needed
          headerLogoPreview: agreement.logoUrl || null,
          companyName: agreement.companyName || "",
          companyTagline: agreement.tagline || "",
          companyAddress: agreement.address || "",
          headerContent: agreement.agreementContent || "",
          footerPhone: agreement.phoneNumber || "",
          footerWebsite: agreement.website || "",
          footerCIN: agreement.cin || "",
          companySignature: {
            image: null,
            imagePreview: agreement.signatureUrl || null,
            name: agreement.companyRepresentativeName || agreement.signatureName || "",
            designation: agreement.designation || agreement.signatureDesignation || "",
            description: agreement.description || agreement.signatureDescription || "",
          },
        })
        
        // Load images as blob URLs in the background (non-blocking)
        // Images will appear when ready, but form will be shown immediately
        if (agreement.logoUrl) {
          loadImageAsBlobUrl(agreement.logoUrl).then(({ blobUrl, error }) => {
            if (blobUrl) {
              setHeaderLogoBlobUrl(blobUrl)
            } else if (error) {
              console.warn("Failed to load header logo:", error)
            }
          }).catch((error) => {
            console.warn("Error loading header logo:", error)
          })
        }
        
        if (agreement.signatureUrl) {
          loadImageAsBlobUrl(agreement.signatureUrl).then(({ blobUrl, error }) => {
            if (blobUrl) {
              setSignatureImageBlobUrl(blobUrl)
            } else if (error) {
              console.warn("Failed to load signature image:", error)
            }
          }).catch((error) => {
            console.warn("Error loading signature image:", error)
          })
        }
      } else {
        setError(response.message || "Failed to load agreement")
      }
    } catch (err) {
      setError(err.message || "Failed to load agreement")
    } finally {
      clearAgreementEditPrefill()
      setLoadingAgreement(false)
    }
  }

  const handleInputChange = (field, value) => {
    // Special handling for phone number - only allow digits and max 10 digits
    if (field === "footerPhone") {
      // Remove all non-digit characters
      const digitsOnly = value.replace(/\D/g, "")
      // Limit to 10 digits
      const limitedValue = digitsOnly.slice(0, 10)
      setFormData((prev) => ({ ...prev, [field]: limitedValue }))
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

  const handleImageUpload = (type, file) => {
    if (file && file.type.startsWith("image/")) {
      // Clean up existing blob URL when new image is uploaded
      if (type === "company" && signatureImageBlobUrl) {
        window.URL.revokeObjectURL(signatureImageBlobUrl)
        setSignatureImageBlobUrl(null)
      } else if (type === "header" && headerLogoBlobUrl) {
        window.URL.revokeObjectURL(headerLogoBlobUrl)
        setHeaderLogoBlobUrl(null)
      }
      
      const reader = new FileReader()
      reader.onloadend = () => {
        if (type === "company") {
          setFormData((prev) => ({
            ...prev,
            companySignature: {
              ...prev.companySignature,
              image: file,
              imagePreview: reader.result,
            },
          }))
        } else if (type === "header") {
          setFormData((prev) => ({
            ...prev,
            headerLogo: file,
            headerLogoPreview: reader.result,
          }))
        }
      }
      reader.readAsDataURL(file)
    } else {
      setError("Please upload a valid image file")
    }
  }

  const removeImage = (type) => {
    if (type === "company") {
      // Clean up blob URL if exists
      if (signatureImageBlobUrl) {
        window.URL.revokeObjectURL(signatureImageBlobUrl)
        setSignatureImageBlobUrl(null)
      }
      setFormData((prev) => ({
        ...prev,
        companySignature: {
          ...prev.companySignature,
          image: null,
          imagePreview: null,
        },
      }))
    } else if (type === "header") {
      // Clean up blob URL if exists
      if (headerLogoBlobUrl) {
        window.URL.revokeObjectURL(headerLogoBlobUrl)
        setHeaderLogoBlobUrl(null)
      }
      setFormData((prev) => ({
        ...prev,
        headerLogo: null,
        headerLogoPreview: null,
      }))
    }
  }

  const updateCompanySignature = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      companySignature: {
        ...prev.companySignature,
        [field]: value,
      },
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setLoading(true)

    const newErrors = {}
    
    // Validate study selection
    if (!formData.studyId || formData.studyId === "") newErrors.studyId = "Study is required"
    
    // Validate header
    if (!formData.companyName) newErrors.companyName = "Name is required"
    if (!formData.companyAddress) newErrors.companyAddress = "Address is required"
    
    // Validate header content
    if (!formData.headerContent || formData.headerContent.trim() === "") {
      newErrors.headerContent = "Header content is required"
    }
    
    // Validate phone number - must be exactly 10 digits if provided
    if (formData.footerPhone && formData.footerPhone.trim() !== "") {
      const phoneDigits = formData.footerPhone.replace(/\D/g, "")
      if (phoneDigits.length !== 10) {
        newErrors.footerPhone = "Phone number must be exactly 10 digits"
      }
    }
    
    setErrors(newErrors)

    if (Object.keys(newErrors).length > 0) {
      setError("Please fill in all required fields")
      setLoading(false)
      return
    }

    try {
      // Map form data to API structure
      const agreementData = {
        StudyId: parseInt(formData.studyId),
        CompanyName: formData.companyName,
        Tagline: formData.companyTagline || null,
        Address: formData.companyAddress || null,
        PhoneNumber: formData.footerPhone || null,
        Website: formData.footerWebsite || null,
        CIN: formData.footerCIN || null,
        Logo: formData.headerLogo || null,
        Signature: formData.companySignature.image || null,
        AgreementContent: sanitizeAgreementContentHtml(formData.headerContent) || null,
        // Company Representative Signature fields - send as null if empty
        CompanyRepresentativeName: formData.companySignature.name?.trim() || null,
        Designation: formData.companySignature.designation?.trim() || null,
        Description: formData.companySignature.description?.trim() || null,
      }

      let response
      if (isEditMode && agreementId) {
        response = await agreementService.updateAgreement(parseInt(agreementId), agreementData)
      } else {
        response = await agreementService.createAgreement(agreementData)
      }

      if (response.isSuccess) {
        setSuccess(isEditMode ? "Agreement updated successfully!" : "Agreement saved successfully!")
        
        // Navigate to manage page after successful save
        setTimeout(() => {
          router.push("/agreement-setup/manage")
        }, 1500)
      } else {
        setError(response.message || "Failed to save agreement. Please try again.")
      }
    } catch (err) {
      setError(err.message || "Failed to save agreement. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setFormData({
      studyId: "",
      headerLogo: null,
      headerLogoPreview: null,
      companyName: "",
      companyTagline: "",
      companyAddress: "",
      headerContent: buildStandardAgreementBodyHtml({ companyName: "the Company" }),
      footerPhone: "",
      footerWebsite: "",
      footerCIN: "",
      companySignature: {
        image: null,
        imagePreview: null,
        name: "",
        designation: "",
        description: "",
      },
    })
    setErrors({})
    setError("")
    setSuccess("")
  }

  const handleCancel = () => {
    router.push("/agreement-setup/manage")
  }

  const isFormHydrating = isEditMode && loadingAgreement

  return (
    <DashboardLayout>
      <div className="w-full min-h-[calc(100dvh-var(--topbar-height,4rem))] bg-[#f5f5f7] p-4 sm:p-6 lg:p-8">
        <div className="w-full space-y-6">
          <div className="rounded-2xl border border-white/60 bg-white/70 px-5 py-4 shadow-sm backdrop-blur-xl">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {isEditMode ? "Edit Agreement" : "Create Agreement"}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {isEditMode
                ? "Update company letterhead, body content, and signature settings."
                : "Configure company letterhead, agreement body, and signature settings."}
            </p>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="relative space-y-6"
            aria-busy={isFormHydrating}
          >
            {isFormHydrating && (
              <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden rounded-t-2xl bg-emerald-100">
                <div className="agreement-refresh-bar h-full w-1/3 rounded-full bg-emerald-500" />
              </div>
            )}
            {/* Success/Error Messages */}
            {success && (
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 flex items-center gap-3">
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
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-center gap-3">
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

            {/* Section 1: Company Details */}
            <div className={`rounded-2xl border border-white/60 bg-white/80 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] backdrop-blur-xl transition-opacity duration-200 ${isFormHydrating ? "opacity-80" : ""}`}>
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Company Details</h2>
              </div>
              <div className="space-y-6">
                {/* Study Selection */}
                <div className="relative">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                    Study <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={studySearchInput || (formData.studyId ? availableStudies.find(s => s.studyId === parseInt(formData.studyId))?.studyProtocolNumber || `Study ${formData.studyId}` : "")}
                      onChange={(e) => {
                        setStudySearchInput(e.target.value)
                        setIsStudyDropdownOpen(true)
                      }}
                      onFocus={() => {
                        if (!isEditMode) {
                          setIsStudyDropdownOpen(true)
                          if (availableStudies.length === 0) {
                            fetchStudies()
                          }
                        }
                      }}
                      placeholder="Search and select a study..."
                      className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${errors.studyId
                        ? "border-red-300 bg-red-50/50 focus:border-red-500"
                        : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        } outline-none bg-white text-slate-800`}
                      disabled={loadingStudies || isEditMode}
                      onClick={() => {
                        if (!isEditMode) {
                          setIsStudyDropdownOpen(true)
                          if (availableStudies.length === 0) {
                            fetchStudies()
                          }
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
                        <div className="absolute z-20 w-full mt-1 bg-white border-2 border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
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
                                    handleInputChange("studyId", String(study.studyId))
                                    setStudySearchInput("")
                                    setIsStudyDropdownOpen(false)
                                  }}
                                  className={`px-4 py-2 cursor-pointer hover:bg-blue-50 transition-colors ${formData.studyId === String(study.studyId) ? "bg-blue-100" : ""}`}
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
                    <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                      <span>⚠</span> {errors.studyId}
                    </p>
                  )}
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                    Logo
                  </label>
                  <div className="flex items-center gap-4">
                    {(headerLogoBlobUrl || formData.headerLogoPreview) ? (
                      <div className="relative">
                        <img
                          src={headerLogoBlobUrl || formData.headerLogoPreview}
                          alt="Header Logo"
                          className="h-20 w-auto object-contain border-2 border-slate-200 rounded-lg p-2 bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage("header")}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 bg-slate-50 flex flex-col items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-slate-400 mb-2" />
                        <p className="text-sm text-slate-500">No logo uploaded</p>
                      </div>
                    )}
                    <label className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors cursor-pointer flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      {formData.headerLogoPreview ? "Change Logo" : "Upload Logo"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload("header", e.target.files[0])}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => handleInputChange("companyName", e.target.value)}
                      placeholder="Xemus"
                      className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${errors.companyName
                        ? "border-red-300 bg-red-50/50 focus:border-red-500"
                        : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        } outline-none`}
                    />
                    {errors.companyName && (
                      <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                        <span>⚠</span> {errors.companyName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                      Tagline
                    </label>
                    <input
                      type="text"
                      value={formData.companyTagline}
                      onChange={(e) => handleInputChange("companyTagline", e.target.value)}
                      placeholder="e.g., Dedicated To Life"
                      className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                      Address <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={formData.companyAddress}
                      onChange={(e) => handleInputChange("companyAddress", e.target.value)}
                      placeholder="Enter full company address"
                      rows={3}
                      className={`w-full px-4 py-3 rounded-lg border-2 transition-all resize-none ${errors.companyAddress
                        ? "border-red-300 bg-red-50/50 focus:border-red-500"
                        : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        } outline-none`}
                    />
                    {errors.companyAddress && (
                      <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                        <span>⚠</span> {errors.companyAddress}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={formData.footerPhone}
                      onChange={(e) => handleInputChange("footerPhone", e.target.value)}
                      placeholder="1234567890"
                      maxLength={10}
                      className={`w-full px-4 py-3 rounded-lg border-2 ${
                        errors.footerPhone
                          ? "border-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-100"
                          : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      } outline-none`}
                    />
                    {errors.footerPhone && (
                      <p className="text-red-600 text-xs mt-1.5 flex items-center gap-1">
                        <span>⚠</span> {errors.footerPhone}
                      </p>
                    )}
                    {formData.footerPhone && !errors.footerPhone && (
                      <p className="text-slate-500 text-xs mt-1.5">{formData.footerPhone.length} / 10 digits</p>
                    )}
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                      Website
                    </label>
                    <input
                      type="text"
                      value={formData.footerWebsite}
                      onChange={(e) => handleInputChange("footerWebsite", e.target.value)}
                      placeholder="e.g., www.example.com"
                      className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                      CIN
                    </label>
                    <input
                      type="text"
                      value={formData.footerCIN}
                      onChange={(e) => handleInputChange("footerCIN", e.target.value)}
                      placeholder={CIN_PLACEHOLDER}
                      className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Header Content */}
            <div className={`rounded-2xl border border-white/60 bg-white/80 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] backdrop-blur-xl transition-opacity duration-200 ${isFormHydrating ? "opacity-80" : ""}`}>
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Header Content</h2>
              </div>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Content Editor <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={applyStandardAgreementContent}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                      title="Reset to Xemus EDC standard agreement text format"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Standard format
                    </button>
                    <div className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                      Saved as HTML — same layout is used for agreement PDF
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 text-xs text-slate-600 leading-relaxed">
                  <span className="font-semibold text-slate-700">Standard text: </span>
                  {AGREEMENT_TEXT_STANDARD.fontSize} body · line {AGREEMENT_TEXT_STANDARD.lineHeight} · {AGREEMENT_TEXT_STANDARD.fontFamily.split(",")[0]} · justified paragraphs · numbered sections · milestone table. Edit study-specific wording only; doctor/study cards and signatures are added automatically in PDF.
                </div>
                <RichTextEditor
                  value={formData.headerContent}
                  onChange={(html) => handleInputChange("headerContent", html)}
                  placeholder="Enter agreement body content (letter text, sections, milestone tables)..."
                  showVariables={false}
                  variant="agreement"
                />
                {errors.headerContent && (
                  <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                    <span>⚠</span> {errors.headerContent}
                  </p>
                )}
                <p className="text-xs text-slate-500 mt-2">
                  New agreements start with the Xemus standard template. Change company name above, then click <strong>Standard format</strong> to refresh the company name in the letter.
                </p>
              </div>
            </div>

            {/* Section 3: Signature Settings */}
            <div className={`rounded-2xl border border-white/60 bg-white/80 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] backdrop-blur-xl transition-opacity duration-200 ${isFormHydrating ? "opacity-80" : ""}`}>
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
                  <Signature className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Signature Settings</h2>
              </div>
              <div className="space-y-6">
                {/* Company Representative Signature */}
                <div>
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-4">
                    <User className="w-4 h-4" />
                    Company Representative Signature
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Signature Image Upload */}
                    <div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                        Signature Image
                      </label>
                      <div className="flex items-center gap-4">
                        {(signatureImageBlobUrl || formData.companySignature.imagePreview) ? (
                          <div className="relative">
                            <img
                              src={signatureImageBlobUrl || formData.companySignature.imagePreview}
                              alt="Company Signature"
                              className="h-24 w-auto object-contain border-2 border-slate-200 rounded-lg p-2 bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => removeImage("company")}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 bg-slate-50 flex flex-col items-center justify-center min-w-[120px]">
                            <Signature className="w-6 h-6 text-slate-400 mb-2" />
                            <p className="text-xs text-slate-500 text-center">No signature</p>
                          </div>
                        )}
                        <label className="px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors cursor-pointer flex items-center gap-2 text-sm">
                          <Upload className="w-4 h-4" />
                          Upload
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageUpload("company", e.target.files[0])}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    {/* Signature Details */}
                    <div className="space-y-4">
                      <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                          Name
                        </label>
                        <input
                          type="text"
                          value={formData.companySignature.name}
                          onChange={(e) => updateCompanySignature("name", e.target.value)}
                          placeholder="Dr.ABC"
                          className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${errors.companySignatureName
                            ? "border-red-300 bg-red-50/50 focus:border-red-500"
                            : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            } outline-none`}
                        />
                        {errors.companySignatureName && (
                          <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                            <span>⚠</span> {errors.companySignatureName}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                          Designation
                        </label>
                        <input
                          type="text"
                          value={formData.companySignature.designation}
                          onChange={(e) => updateCompanySignature("designation", e.target.value)}
                          placeholder="e.g., Study Coordinator"
                          className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${errors.companySignatureDesignation
                            ? "border-red-300 bg-red-50/50 focus:border-red-500"
                            : "border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            } outline-none`}
                        />
                        {errors.companySignatureDesignation && (
                          <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                            <span>⚠</span> {errors.companySignatureDesignation}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                          Description
                        </label>
                        <textarea
                          value={formData.companySignature.description}
                          onChange={(e) => updateCompanySignature("description", e.target.value)}
                          placeholder="Additional description about the signatory"
                          rows={2}
                          className="w-full px-4 py-3 rounded-lg border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none resize-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="rounded-2xl border border-white/60 bg-white/80 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] backdrop-blur-xl">
              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={loading || isFormHydrating}
                  className="px-6 py-3 rounded-lg border-2 border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 hover:border-slate-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={loading || isFormHydrating}
                  className="px-6 py-3 rounded-lg border-2 border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 hover:border-slate-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  disabled={loading || isFormHydrating}
                  className="px-6 py-3 rounded-lg bg-gradient-to-r btn-brand-gradient text-white font-semibold  transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {loading ? "Saving..." : isFormHydrating ? "Loading..." : "Save Agreement"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  )
}

export default function AgreementCreatePage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <AgreementFormShell message="Opening agreement form..." />
        </DashboardLayout>
      }
    >
      <AgreementCreateContent />
    </Suspense>
  )
}

