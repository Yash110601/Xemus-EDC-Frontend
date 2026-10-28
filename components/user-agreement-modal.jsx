"use client"

import { useState, useEffect, useRef } from "react"
import userAgreementService from "@/lib/services/userAgreement.service"
import { markAgreementSignedForStudy } from "@/lib/utils/crcAgreementFlow"
import { Skeleton } from "@/components/ui/skeleton"
import { X, FileText, Loader2, CheckCircle2, AlertCircle, Pen, Eraser, Upload, CreditCard, ArrowLeft } from "lucide-react"

const STEP_FORM = "form"
const STEP_OTP = "otp"
const STEP_SUCCESS = "success"

export default function UserAgreementModal({ studyId, onAgreementSigned, isOpen, initialAgreementData }) {
  const [agreementData, setAgreementData] = useState(initialAgreementData || null)
  const [loading, setLoading] = useState(false)
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [agreementAccepted, setAgreementAccepted] = useState(false)
  const [signature, setSignature] = useState(null) // Base64 signature image (scribble)
  const [uploadedSignatureFile, setUploadedSignatureFile] = useState(null) // Uploaded signature file
  const [signatureMode, setSignatureMode] = useState("scribble") // "scribble" | "upload"
  const [isDrawing, setIsDrawing] = useState(false)

  // PAN card upload
  const [panCardFile, setPanCardFile] = useState(null)
  const [panCardPreviewUrl, setPanCardPreviewUrl] = useState(null)

  // Flow step: form | otp | success
  const [step, setStep] = useState(STEP_FORM)
  const [sendingOtp, setSendingOtp] = useState(false)
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [otpId, setOtpId] = useState(null)
  const [mobileNumberMasked, setMobileNumberMasked] = useState("")
  const [otpCountdown, setOtpCountdown] = useState(0)
  const [otp, setOtp] = useState("")
  const otpCountdownIntervalRef = useRef(null)

  const canvasRef = useRef(null)
  const signaturePadWrapRef = useRef(null)
  const fileInputRef = useRef(null)
  const panCardInputRef = useRef(null)
  const lastPointRef = useRef(null)
  const hasFetchedRef = useRef(false)
  const rafSaveRef = useRef(null)

  // Update agreement data when initialAgreementData prop changes
  useEffect(() => {
    if (initialAgreementData) {
      setAgreementData(initialAgreementData)
      hasFetchedRef.current = true
    }
  }, [initialAgreementData])

  // Reset fetch flag when studyId changes (only if no initial data)
  useEffect(() => {
    if (!initialAgreementData) {
      hasFetchedRef.current = false
    }
  }, [studyId, initialAgreementData])

  // Fetch agreement data when studyId changes and modal is open
  // Only fetch if we don't have initial data and haven't fetched yet
  useEffect(() => {
    if (isOpen && studyId) {
      // If we have initial data, use it and don't fetch
      if (initialAgreementData) {
        setAgreementData(initialAgreementData)
        hasFetchedRef.current = true
        return
      }
      
      // Only fetch if we don't have data and haven't fetched yet
      if (!hasFetchedRef.current && !agreementData) {
        fetchAgreementData()
        hasFetchedRef.current = true
      }
    }
  }, [isOpen, studyId, initialAgreementData])

  // Initialize signature pad: canvas size = wrapper size for exact 1:1 coordinates
  useEffect(() => {
    if (!isOpen || signatureMode !== "scribble") return

    const init = () => {
      const wrap = signaturePadWrapRef.current
      const canvas = canvasRef.current
      if (!wrap || !canvas) return
      const w = Math.max(300, wrap.clientWidth || 400)
      const h = 220
      if (w <= 0) return

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext("2d")
        ctx.strokeStyle = "#1e3a5f"
        ctx.lineWidth = 3
        ctx.lineCap = "round"
        ctx.lineJoin = "round"
      }
    }

    init()
    const t1 = setTimeout(init, 100)
    const t2 = setTimeout(init, 400)
    window.addEventListener("resize", init)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      window.removeEventListener("resize", init)
    }
  }, [isOpen, signatureMode])

  // PAN card preview URL cleanup
  useEffect(() => {
    if (!panCardFile) {
      setPanCardPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      return
    }
    const url = URL.createObjectURL(panCardFile)
    setPanCardPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [panCardFile])

  // Clear signature, PAN, OTP state and reset fetch flag when modal closes
  useEffect(() => {
    if (!isOpen) {
      clearSignature()
      setPanCardFile(null)
      if (panCardInputRef.current) panCardInputRef.current.value = ""
      setStep(STEP_FORM)
      setOtpId(null)
      setMobileNumberMasked("")
      setOtp("")
      setOtpCountdown(0)
      setSendingOtp(false)
      setVerifyingOtp(false)
      if (otpCountdownIntervalRef.current) {
        clearInterval(otpCountdownIntervalRef.current)
        otpCountdownIntervalRef.current = null
      }
      hasFetchedRef.current = false
    }
  }, [isOpen])

  // OTP countdown timer: start once when entering OTP step
  useEffect(() => {
    if (step !== STEP_OTP || otpCountdown <= 0) return
    otpCountdownIntervalRef.current = setInterval(() => {
      setOtpCountdown((prev) => {
        if (prev <= 1) {
          if (otpCountdownIntervalRef.current) {
            clearInterval(otpCountdownIntervalRef.current)
            otpCountdownIntervalRef.current = null
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (otpCountdownIntervalRef.current) {
        clearInterval(otpCountdownIntervalRef.current)
        otpCountdownIntervalRef.current = null
      }
    }
  }, [step])

  const getCanvasPoint = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const clientX = e.clientX != null ? e.clientX : (e.touches && e.touches[0]?.clientX)
    const clientY = e.clientY != null ? e.clientY : (e.touches && e.touches[0]?.clientY)
    if (clientX == null || clientY == null) return null
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: Math.max(0, Math.min((clientX - rect.left) * scaleX, canvas.width)),
      y: Math.max(0, Math.min((clientY - rect.top) * scaleY, canvas.height)),
    }
  }

  const startDrawing = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const canvas = canvasRef.current
    const point = getCanvasPoint(e)
    if (!canvas || !point) return
    if (canvas.setPointerCapture && e.pointerId != null) canvas.setPointerCapture(e.pointerId)

    const ctx = canvas.getContext("2d")
    ctx.strokeStyle = "#1e3a5f"
    ctx.lineWidth = 3
    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    setIsDrawing(true)
    lastPointRef.current = point
    ctx.beginPath()
    ctx.moveTo(point.x, point.y)
  }

  const draw = (e) => {
    if (!isDrawing) return
    e.preventDefault()
    e.stopPropagation()
    const canvas = canvasRef.current
    const point = getCanvasPoint(e)
    if (!canvas || !point) return

    const ctx = canvas.getContext("2d")
    const last = lastPointRef.current
    if (!last) return

    ctx.strokeStyle = "#1e3a5f"
    ctx.lineWidth = 3
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.beginPath()
    ctx.moveTo(last.x, last.y)
    ctx.lineTo(point.x, point.y)
    ctx.stroke()
    lastPointRef.current = point

    if (rafSaveRef.current) cancelAnimationFrame(rafSaveRef.current)
    rafSaveRef.current = requestAnimationFrame(() => {
      rafSaveRef.current = null
      if (canvasRef.current) setSignature(canvasRef.current.toDataURL("image/png"))
    })
  }

  const stopDrawing = (e) => {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    if (!isDrawing) return
    setIsDrawing(false)
    lastPointRef.current = null
    const canvas = canvasRef.current
    if (canvas) setSignature(canvas.toDataURL("image/png"))
  }

  const clearSignature = () => {
    setSignature(null)
    setUploadedSignatureFile(null)
    lastPointRef.current = null
    if (fileInputRef.current) fileInputRef.current.value = ""

    const canvas = canvasRef.current
    if (canvas && canvas.width) {
      const ctx = canvas.getContext("2d")
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }

  const switchToScribble = () => {
    setUploadedSignatureFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
    setSignatureMode("scribble")
    setError("")
  }

  const switchToUpload = () => {
    setSignature(null)
    lastPointRef.current = null
    const canvas = canvasRef.current
    if (canvas && canvas.width) {
      const ctx = canvas.getContext("2d")
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    setSignatureMode("upload")
    setError("")
  }

  const acceptedImageTypes = ["image/jpeg", "image/jpg", "image/png"]
  const maxFileSizeMB = 5
  const maxFileSizeBytes = maxFileSizeMB * 1024 * 1024

  const handleSignatureFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!acceptedImageTypes.includes(file.type)) {
      setError("Please upload a valid image file (JPEG or PNG).")
      e.target.value = ""
      return
    }
    if (file.size > maxFileSizeBytes) {
      setError(`File size must be under ${maxFileSizeMB} MB.`)
      e.target.value = ""
      return
    }
    setError("")
    setUploadedSignatureFile(file)
  }

  const handlePanCardFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!acceptedImageTypes.includes(file.type)) {
      setError("Please upload a valid PAN card image (.jpg, .jpeg or .png).")
      e.target.value = ""
      return
    }
    if (file.size > maxFileSizeBytes) {
      setError(`PAN card file size must be under ${maxFileSizeMB} MB.`)
      e.target.value = ""
      return
    }
    setError("")
    setPanCardFile(file)
  }

  const removePanCard = () => {
    setPanCardFile(null)
    if (panCardInputRef.current) panCardInputRef.current.value = ""
  }

  // Object URL for upload preview; create/revoke in effect to avoid leaks
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState(null)
  useEffect(() => {
    if (!uploadedSignatureFile) {
      setUploadedPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      return
    }
    const url = URL.createObjectURL(uploadedSignatureFile)
    setUploadedPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [uploadedSignatureFile])

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafSaveRef.current) cancelAnimationFrame(rafSaveRef.current)
    }
  }, [])

  const fetchAgreementData = async () => {
    if (!studyId) return
    
    // Don't fetch if we already have data
    if (agreementData) return

    setLoading(true)
    setError("")
    try {
      const response = await userAgreementService.getAgreementDataByStudyId(studyId)

      if (response.isSuccess && response.data) {
        setAgreementData(response.data)
      } else {
        setError(response.message || "Failed to load agreement. Please try again.")
      }
    } catch (err) {
      console.error("Error fetching agreement data:", err)
      setError(err.message || "Failed to load agreement. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  /**
   * Compress image to ensure it's under 5 MB
   * @param {string} dataUrl - Base64 data URL of the image
   * @param {number} maxSizeMB - Maximum file size in MB (default: 5)
   * @returns {Promise<File>} Compressed image file
   */
  const compressImageToFile = async (dataUrl, maxSizeMB = 5) => {
    const maxSizeBytes = maxSizeMB * 1024 * 1024 // Convert MB to bytes
    
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement("canvas")
        let width = img.width
        let height = img.height
        let quality = 0.9
        let fileType = "image/jpeg" // Use JPEG for better compression
        
        // Start with original dimensions
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        
        // Draw white background for JPEG (since JPEG doesn't support transparency)
        ctx.fillStyle = "#FFFFFF"
        ctx.fillRect(0, 0, width, height)
        
        // Draw the image
        ctx.drawImage(img, 0, 0)
        
        // Function to try compression
        const tryCompress = () => {
          // Convert to blob to check size
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Failed to compress image"))
                return
              }
              
              const fileSizeMB = blob.size / (1024 * 1024)
              
              // If file is under limit, create File and return
              if (blob.size <= maxSizeBytes) {
                const file = new File([blob], "signature.jpg", { type: fileType })
                resolve(file)
                return
              }
              
              // If still too large, reduce quality or dimensions
              if (quality > 0.1) {
                // Reduce quality first
                quality = Math.max(0.1, quality - 0.1)
                canvas.toBlob(tryCompress, fileType, quality)
              } else if (width > 800 || height > 600) {
                // If quality is already low, reduce dimensions
                width = Math.max(800, width * 0.8)
                height = Math.max(600, height * 0.8)
                canvas.width = width
                canvas.height = height
                
                // Redraw
                ctx.fillStyle = "#FFFFFF"
                ctx.fillRect(0, 0, width, height)
                ctx.drawImage(img, 0, 0, width, height)
                
                quality = 0.9 // Reset quality for new dimensions
                canvas.toBlob(tryCompress, fileType, quality)
              } else {
                // If we can't compress further, reject
                reject(new Error(`Image is too large. Maximum file size is ${maxSizeMB} MB.`))
              }
            },
            fileType,
            quality
          )
        }
        
        // Start compression
        tryCompress()
      }
      
      img.onerror = () => {
        reject(new Error("Failed to load image"))
      }
      
      img.src = dataUrl
    })
  }

  /** Accept & Continue: validate, send OTP, then show OTP step */
  const handleAcceptAndContinue = async () => {
    if (!studyId || !agreementAccepted) {
      setError("Please accept the agreement to proceed.")
      return
    }
    const hasScribble = signatureMode === "scribble" && signature
    const hasUpload = signatureMode === "upload" && uploadedSignatureFile
    if (!hasScribble && !hasUpload) {
      setError("Please provide your signature (scribble or upload) before continuing.")
      return
    }
    if (!panCardFile) {
      setError("Please upload your PAN card image to continue.")
      return
    }

    setError("")
    setSendingOtp(true)
    try {
      const response = await userAgreementService.sendAgreementOtp(studyId)
      if (!response.isSuccess) {
        setError(response.message || "Failed to send OTP. Please try again.")
        return
      }
      const data = response.data || {}
      setOtpId(data.otpId || null)
      setMobileNumberMasked(data.mobileNumberMasked || "")
      setOtpCountdown(typeof data.expiresInSeconds === "number" ? data.expiresInSeconds : 59)
      setStep(STEP_OTP)
      setOtp("")
    } catch (err) {
      setError(err.message || "Failed to send OTP. Please try again.")
    } finally {
      setSendingOtp(false)
    }
  }

  /** Submit OTP: verify OTP then sign agreement with FormData (signature + PAN) */
  const handleSubmitOtp = async () => {
    if (!studyId || !otpId || !otp || otp.length !== 6) {
      setError("Please enter the 6-digit OTP sent to your mobile.")
      return
    }

    setError("")
    setVerifyingOtp(true)
    try {
      const verifyRes = await userAgreementService.verifyAgreementOtp({ studyId, otpId, otp })
      if (!verifyRes.isSuccess) {
        setError(verifyRes.message || "Invalid OTP or verification failed. Please try again.")
        return
      }

      // Build signature file (scribble or upload)
      let signatureFile
      if (signatureMode === "upload" && uploadedSignatureFile) {
        if (uploadedSignatureFile.size > maxFileSizeBytes) {
          setError(`Signature file is too large. Maximum allowed size is ${maxFileSizeMB} MB.`)
          setVerifyingOtp(false)
          return
        }
        signatureFile = uploadedSignatureFile
      } else {
        try {
          signatureFile = await compressImageToFile(signature, 5)
        } catch (compressError) {
          setError(compressError.message || "Failed to process signature image.")
          setVerifyingOtp(false)
          return
        }
      }

      const formData = new FormData()
      formData.append("StudyId", studyId.toString())
      formData.append("SignatureFile", signatureFile)
      formData.append("PanCardFile", panCardFile)

      setSigning(true)
      const signRes = await userAgreementService.signAgreement(formData)
      setSigning(false)

      if (signRes.isSuccess) {
        setSuccess(true)
        setStep(STEP_SUCCESS)
        markAgreementSignedForStudy(studyId)
        setTimeout(() => {
          if (onAgreementSigned) onAgreementSigned(studyId)
        }, 2200)
      } else {
        const statusCode = signRes.statusCode || signRes.httpStatus || 0
        if (statusCode === 404) {
          setError("The agreement signing endpoint is not available. Please contact the administrator.")
        } else if (statusCode === 415) {
          setError("Invalid file format. Please use .jpg, .jpeg or .png for signature and PAN card.")
        } else if (statusCode === 413) {
          setError("File size too large. Maximum allowed size is 5 MB per file.")
        } else {
          setError(signRes.message || signRes.errors?.join(", ") || "Failed to sign agreement. Please try again.")
        }
      }
    } catch (err) {
      setError(err.message || "Failed to verify OTP or sign agreement. Please try again.")
    } finally {
      setVerifyingOtp(false)
    }
  }

  const handleSignAgreement = async () => {
    // Legacy path unused now; flow is handleAcceptAndContinue -> handleSubmitOtp
    await handleAcceptAndContinue()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] mx-4 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <FileText className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">User Agreement</h2>
              <p className="text-sm text-slate-600">Please read and accept the agreement to continue and sign</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="space-y-4 py-6">
              <Skeleton className="h-6 w-48 bg-slate-200/80" />
              <Skeleton className="h-10 w-full rounded-xl bg-slate-200/70" />
              <Skeleton className="h-40 w-full rounded-xl bg-slate-200/70" />
              <div className="flex gap-3">
                <Skeleton className="h-10 w-28 rounded-lg bg-slate-200/70" />
                <Skeleton className="h-10 w-36 rounded-lg bg-slate-200/70" />
              </div>
            </div>
          ) : error && !agreementData ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
              <p className="text-red-600 text-center">{error}</p>
              <button
                onClick={fetchAgreementData}
                className="mt-4 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : agreementData ? (
            <>
              {/* Success step: full-screen animation */}
              {step === STEP_SUCCESS && (
                <div className="flex flex-col items-center justify-center py-16 px-6">
                  <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center animate-pulse">
                    <CheckCircle2 className="w-14 h-14 text-green-600" />
                  </div>
                  <h3 className="mt-6 text-xl font-bold text-slate-900">Agreement submitted successfully</h3>
                  <p className="mt-2 text-slate-600 text-center max-w-sm">
                    Your agreement has been signed and recorded. You can now proceed.
                  </p>
                </div>
              )}

              {/* OTP step */}
              {step === STEP_OTP && (
                <div className="max-w-md mx-auto py-8 space-y-6">
                  <div className="text-center">
                    <p className="text-slate-700">
                      OTP sent to <span className="font-semibold text-slate-900">{mobileNumberMasked || "your registered mobile"}</span>
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      Enter the 6-digit code below. Valid for{" "}
                      <span className="font-mono font-semibold text-emerald-600">
                        {Math.floor(otpCountdown / 60)}:{(otpCountdown % 60).toString().padStart(2, "0")}
                      </span>
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">OTP</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      className="w-full px-4 py-3 text-center text-xl font-mono tracking-[0.5em] border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      disabled={verifyingOtp || signing}
                    />
                  </div>
                  {error && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <p className="text-red-700 text-sm">{error}</p>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setStep(STEP_FORM)
                        setError("")
                        setOtp("")
                        if (otpCountdownIntervalRef.current) {
                          clearInterval(otpCountdownIntervalRef.current)
                          otpCountdownIntervalRef.current = null
                        }
                      }}
                      disabled={verifyingOtp || signing}
                      className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitOtp}
                      disabled={otp.length !== 6 || otpCountdown <= 0 || verifyingOtp || signing}
                      className="flex-1 px-4 py-2.5 bg-gradient-to-r btn-brand-gradient text-white font-semibold rounded-lg  disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {verifyingOtp || signing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {signing ? "Signing..." : "Verifying..."}
                        </>
                      ) : (
                        "Submit OTP"
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Form step: agreement content + signature + PAN + checkbox */}
              {step === STEP_FORM && (
            <div className="space-y-6">
              {/* Company letterhead-style header: show banner exactly as provided, edge to edge */}
              {agreementData.logoDataUri && (
                <div className="mb-6">
                  <img 
                    src={agreementData.logoDataUri} 
                    alt="Company Header" 
                    className="w-full object-contain"
                  />
                </div>
              )}

              {/* Doctor Information - Same Design as Study Details */}
              <div className="my-8">
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 px-6 py-4 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-800">Doctor Information</h3>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="space-y-3 text-sm">
                      {agreementData.doctorName && (
                        <div>
                          <strong className="text-slate-700">Dr. {agreementData.doctorName}</strong>
                        </div>
                      )}
                      {agreementData.micrCode && (
                        <div>
                          <strong className="text-slate-700">Registration No.:</strong> <span className="text-slate-600 uppercase">{agreementData.micrCode}</span>
                        </div>
                      )}
                      {agreementData.panCard && (
                        <div>
                          <strong className="text-slate-700">PAN:</strong> <span className="text-slate-600 uppercase">{agreementData.panCard}</span>
                        </div>
                      )}
                      {agreementData.currentDate && (
                        <div>
                          <strong className="text-slate-700">Date:</strong> <span className="text-slate-600">{agreementData.currentDate}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

             
              {/* Study Details - Card Design */}
              <div className="my-8">
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 px-6 py-4 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-800">Study Details</h3>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      {agreementData.studyTitle && (
                        <div>
                          <strong className="text-slate-700">Study Title:</strong><br />
                          <span className="text-slate-600">{agreementData.studyTitle}</span>
                        </div>
                      )}
                      {agreementData.studyProtocolNumber && (
                        <div>
                          <strong className="text-slate-700">Protocol Number:</strong><br />
                          <span className="text-slate-600">{agreementData.studyProtocolNumber}</span>
                        </div>
                      )}
                      {agreementData.studyPeriod && (
                        <div>
                          <strong className="text-slate-700">Study Period:</strong><br />
                          <span className="text-slate-600">{agreementData.studyPeriod}</span>
                        </div>
                      )}
                      {agreementData.sponsor && (
                        <div>
                          <strong className="text-slate-700">Sponsor:</strong><br />
                          <span className="text-slate-600">{agreementData.sponsor}</span>
                        </div>
                      )}
                      {agreementData.therapeuticArea && (
                        <div>
                          <strong className="text-slate-700">Therapeutic Area:</strong><br />
                          <span className="text-slate-600">{agreementData.therapeuticArea}</span>
                        </div>
                      )}
                      {agreementData.effectiveDate && (
                        <div>
                          <strong className="text-slate-700">Effective Date:</strong><br />
                          <span className="text-slate-600">{agreementData.effectiveDate}</span>
                        </div>
                      )}
                      {agreementData.studyEndDate && (
                        <div>
                          <strong className="text-slate-700">Study End Date:</strong><br />
                          <span className="text-slate-600">{agreementData.studyEndDate}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {/* Subject Line - Centered, Black, Bold */}
              <div className="flex justify-center items-center my-8">
                <h2 className="text-lg font-bold text-slate-900 text-center">
                  Sub: Letter of Engagement for Research Services
                </h2>
              </div>

              {/* Greeting */}
              <div className="text-lg font-medium text-slate-700">
                Dear Doctor,
              </div>

              {/* Agreement Content */}
              <div className="prose max-w-none prose-ul:list-disc prose-ul:pl-6 prose-ol:list-decimal prose-ol:pl-6 prose-li:my-1">
                {agreementData.agreementContent ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: agreementData.agreementContent }}
                    className="text-slate-700 leading-relaxed text-justify [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1"
                  />
                ) : (
                  <div className="text-slate-600">
                    <p>No agreement content available.</p>
                  </div>
                )}
              </div>

              {/* Payment Details - Same Design as Study Details */}
              {agreementData.paymentRows && agreementData.paymentRows.length > 0 && (
                <div className="mt-10 mb-8">
                  <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
                    <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 px-6 py-4 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-800">Payment Details</h3>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="px-6 py-4 text-left font-semibold text-slate-700 text-sm border-b border-slate-200">
                              {agreementData.paymentTableHeader || "Milestone"}
                            </th>
                            <th className="px-6 py-4 text-left font-semibold text-slate-700 text-sm border-b border-slate-200">
                              Total no. of Patients
                            </th>
                            <th className="px-6 py-4 text-left font-semibold text-slate-700 text-sm border-b border-slate-200">
                              Honorarium Amount
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {agreementData.paymentRows.map((row, index) => (
                            <tr 
                              key={index} 
                              className={`transition-colors ${
                                index % 2 === 0 
                                  ? "bg-white hover:bg-blue-50" 
                                  : "bg-slate-50/50 hover:bg-blue-50"
                              }`}
                            >
                              <td className="px-6 py-4 text-slate-700 font-medium border-b border-slate-200">
                                {row.label || `Milestone ${index + 1}`}
                              </td>
                              <td className="px-6 py-4 text-slate-700 border-b border-slate-200">
                                {row.count || 0}
                              </td>
                              <td className="px-6 py-4 text-slate-800 font-semibold border-b border-slate-200">
                                ₹{row.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Closing Statement */}
              <div className="mt-8 text-slate-700 text-lg leading-relaxed">
                We request you to sign this letter as a token of your acceptance.
              </div>

              {/* Signature: one of Scribble or Upload */}
              <div className="border-t border-slate-200 pt-6 mt-6">
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Signature <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-slate-500 mb-3">Choose one: draw below or upload an image.</p>
                {/* Tabs: Scribble | Upload */}
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={switchToScribble}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                      signatureMode === "scribble"
                        ? "bg-violet-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <Pen className="w-4 h-4" />
                    Scribble
                  </button>
                  <button
                    type="button"
                    onClick={switchToUpload}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                      signatureMode === "upload"
                        ? "bg-violet-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <Upload className="w-4 h-4" />
                    Upload image
                  </button>
                </div>

                {signatureMode === "scribble" ? (
                  <div
                    ref={signaturePadWrapRef}
                    className="border-2 border-slate-300 rounded-lg bg-white relative overflow-hidden select-none w-full"
                    style={{ height: "220px", touchAction: "none" }}
                  >
                    <canvas
                      ref={canvasRef}
                      className="block w-full h-full"
                      style={{
                        touchAction: "none",
                        display: "block",
                        cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%231e3a5f' stroke-width='2.5' stroke-linecap='round'%3E%3Cline x1='12' y1='4' x2='12' y2='20'/%3E%3Cline x1='4' y1='12' x2='20' y2='12'/%3E%3C/svg%3E") 12 12, crosshair`,
                      }}
                      onPointerDown={startDrawing}
                      onPointerMove={draw}
                      onPointerUp={stopDrawing}
                      onPointerLeave={stopDrawing}
                      onPointerCancel={stopDrawing}
                      onTouchStart={(e) => e.preventDefault()}
                    />
                    {signature && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          clearSignature()
                        }}
                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1 text-sm shadow-md z-10"
                        title="Clear signature"
                      >
                        <Eraser className="w-4 h-4" />
                        Clear
                      </button>
                    )}
                    {!signature && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <p className="text-slate-400 text-sm">Sign here</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png"
                      onChange={handleSignatureFileChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-4 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 hover:bg-slate-100 hover:border-emerald-400 text-slate-600 hover:text-emerald-600 transition-colors flex flex-col items-center gap-2"
                    >
                      <Upload className="w-8 h-8" />
                      <span className="text-sm font-medium">
                        {uploadedSignatureFile ? "Change signature image" : "Choose signature image (JPEG or PNG, max 5 MB)"}
                      </span>
                    </button>
                    {uploadedSignatureFile && uploadedPreviewUrl && (
                      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <img
                          src={uploadedPreviewUrl}
                          alt="Uploaded signature"
                          className="h-16 w-auto object-contain border border-slate-200 rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">{uploadedSignatureFile.name}</p>
                          <p className="text-xs text-slate-500">
                            {(uploadedSignatureFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={clearSignature}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove"
                        >
                          <Eraser className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-2">
                  {signatureMode === "scribble"
                    ? "Sign above using your mouse or touch screen"
                    : "Upload an image of your signature (JPEG or PNG, max 5 MB)"}
                </p>
              </div>

              {/* Upload PAN card */}
              <div className="border-t border-slate-200 pt-6 mt-6">
                <label className="block text-sm font-semibold text-slate-700 mb-3">
                  Upload PAN card <span className="text-red-500">*</span>
                </label>
                <input
                  ref={panCardInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,image/jpeg,image/jpg,image/png"
                  onChange={handlePanCardFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => panCardInputRef.current?.click()}
                  className="w-full py-4 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 hover:bg-slate-100 hover:border-emerald-400 text-slate-600 hover:text-emerald-600 transition-colors flex flex-col items-center gap-2"
                >
                  <CreditCard className="w-8 h-8" />
                  <span className="text-sm font-medium">
                    {panCardFile ? "Change PAN card image" : "Choose PAN card image (.jpg, .jpeg or .png, max 5 MB)"}
                  </span>
                </button>
                {panCardFile && panCardPreviewUrl && (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 mt-3">
                    <img
                      src={panCardPreviewUrl}
                      alt="PAN card"
                      className="h-16 w-auto object-contain border border-slate-200 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{panCardFile.name}</p>
                      <p className="text-xs text-slate-500">
                        {(panCardFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={removePanCard}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove"
                    >
                      <Eraser className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-2">
                  Allowed formats: .jpg, .jpeg, .png. Maximum size 5 MB.
                </p>
              </div>

              {/* Checkbox */}
              <div className="border-t border-slate-200 pt-4 mt-6">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreementAccepted}
                    onChange={(e) => setAgreementAccepted(e.target.checked)}
                    className="mt-1 w-5 h-5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 focus:ring-2"
                  />
                  <span className="text-slate-700">
                    I have read and agree to the terms and conditions stated in this agreement.{" "}
                    <span className="text-red-500 font-semibold">*</span>
                  </span>
                </label>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              {/* Success Message (form step only) */}
              {success && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-green-700 text-sm">Agreement signed successfully!</p>
                </div>
              )}
            </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer: only show for form step */}
        {step === STEP_FORM && agreementData && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
            <button
              onClick={handleAcceptAndContinue}
              disabled={
                !agreementAccepted ||
                (signatureMode === "scribble" ? !signature : !uploadedSignatureFile) ||
                !panCardFile ||
                sendingOtp ||
                signing ||
                success ||
                loading
              }
              className="px-6 py-2.5 bg-gradient-to-r btn-brand-gradient text-white font-semibold rounded-lg  disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 shadow-md"
            >
              {sendingOtp ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending OTP...
                </>
              ) : (
                "Accept & Continue"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

