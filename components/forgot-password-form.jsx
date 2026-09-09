"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { authService } from "@/lib/services"
import { ArrowLeft, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react"
import {
  LOGIN_BTN_PRIMARY,
  LOGIN_BRAND_LINK_CLASS,
  LOGIN_INPUT_CLASS,
  LOGIN_LABEL_CLASS,
  PASSWORD_INPUT_IOS_PROPS,
  PASSWORD_TOGGLE_BTN_CLASS,
} from "@/lib/login/loginUi"
import { BrandLoginLockup } from "@/components/brand-logo"
import { APP_BRANDING } from "@/lib/config/appBranding"
import { cn } from "@/lib/utils"

const STEP_EMAIL = "email"
const STEP_RESET = "reset"

export default function ForgotPasswordForm() {
  const router = useRouter()
  const [step, setStep] = useState(STEP_EMAIL)
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [apiMessage, setApiMessage] = useState(null)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || "").trim())

  const validateEmailStep = () => {
    const e = {}
    if (!email.trim()) e.email = "Email is required"
    else if (!isValidEmail(email)) e.email = "Please enter a valid email address"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const validateResetStep = () => {
    const e = {}
    if (!otp.trim()) e.otp = "OTP is required"
    else if (otp.replace(/\D/g, "").length !== 6) e.otp = "OTP must be 6 digits"
    if (!newPassword) e.newPassword = "New password is required"
    else if (newPassword.length < 6) e.newPassword = "Password must be at least 6 characters"
    if (newPassword !== confirmPassword) e.confirmPassword = "Passwords do not match"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSendReset = async (e) => {
    e.preventDefault()
    setApiMessage(null)
    if (!validateEmailStep()) return
    setIsLoading(true)
    try {
      const response = await authService.forgotPassword(email.trim())
      if (response.isSuccess) {
        setApiMessage({
          type: "success",
          text: response.message || "If the email exists, a password reset code has been sent.",
        })
        setStep(STEP_RESET)
        setOtp("")
        setNewPassword("")
        setConfirmPassword("")
        setErrors({})
      } else {
        setApiMessage({ type: "error", text: response.message || "Request failed. Please try again." })
      }
    } catch (err) {
      setApiMessage({ type: "error", text: err.message || "Something went wrong. Please try again." })
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setApiMessage(null)
    if (!validateResetStep()) return
    setIsLoading(true)
    try {
      const otpDigits = otp.replace(/\D/g, "").slice(0, 6)
      const response = await authService.resetPassword(email.trim(), otpDigits, newPassword)
      if (response.isSuccess) {
        setApiMessage({
          type: "success",
          text: response.message || "Password reset successfully. Redirecting to sign in...",
        })
        setTimeout(() => router.push("/login"), 2000)
      } else {
        setApiMessage({ type: "error", text: response.message || "Password reset failed. Please try again." })
      }
    } catch (err) {
      setApiMessage({ type: "error", text: err.message || "Something went wrong. Please try again." })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => router.push("/login")
  const inputClass = (hasError) =>
    cn(LOGIN_INPUT_CLASS, "w-full", hasError && "border-red-500 focus-visible:ring-red-500")

  return (
    <div className="flex w-full flex-col">
      <div className="mb-8 lg:hidden">
        <BrandLoginLockup className="!justify-start" />
      </div>

      <header className="mb-8">
        <h1 className="text-[2rem] font-semibold tracking-[-0.04em] text-[#0f172a]">
          {step === STEP_EMAIL ? "Forgot password?" : "Reset password"}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[#64748b]">
          {step === STEP_EMAIL
            ? `We’ll email a code to reset your ${APP_BRANDING.productName} account.`
            : "Enter the code from your email and choose a new password."}
        </p>
      </header>

      {apiMessage && (
        <div
          className={cn(
            "mb-5 flex items-start gap-2 rounded-[4px] border p-3 text-sm font-medium",
            apiMessage.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          )}
        >
          {apiMessage.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <p>{apiMessage.text}</p>
        </div>
      )}

      {step === STEP_EMAIL ? (
        <form onSubmit={handleSendReset} className="space-y-4">
          <div>
            <label htmlFor="email" className={LOGIN_LABEL_CLASS}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (errors.email) setErrors((p) => ({ ...p, email: "" }))
                setApiMessage(null)
              }}
              placeholder="name@company.com"
              className={inputClass(errors.email)}
              disabled={isLoading}
              autoComplete="email"
            />
            {errors.email && <p className="mt-1.5 text-xs font-medium text-red-600">{errors.email}</p>}
          </div>

          <button type="submit" disabled={isLoading} className={LOGIN_BTN_PRIMARY}>
            {isLoading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </span>
            ) : (
              "Send reset code"
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className={LOGIN_LABEL_CLASS}>Email</label>
            <input
              type="email"
              value={email}
              readOnly
              className={cn(LOGIN_INPUT_CLASS, "w-full bg-[#F3F2F1] text-[#605E5C]")}
            />
          </div>

          <div>
            <label htmlFor="otp" className={LOGIN_LABEL_CLASS}>
              Verification code
            </label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => {
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                if (errors.otp) setErrors((p) => ({ ...p, otp: "" }))
                setApiMessage(null)
              }}
              placeholder="000000"
              className={cn(inputClass(errors.otp), "text-center font-mono text-lg tracking-[0.35em]")}
              disabled={isLoading}
              autoComplete="one-time-code"
            />
            {errors.otp && <p className="mt-1.5 text-xs font-medium text-red-600">{errors.otp}</p>}
          </div>

          <div>
            <label htmlFor="newPassword" className={LOGIN_LABEL_CLASS}>
              New password
            </label>
            <div className="relative">
              <input
                id="newPassword"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value)
                  if (errors.newPassword) setErrors((p) => ({ ...p, newPassword: "" }))
                  setApiMessage(null)
                }}
                placeholder="At least 6 characters"
                className={cn(inputClass(errors.newPassword), "password-input-custom-toggle pr-11")}
                disabled={isLoading}
                autoComplete="new-password"
                {...PASSWORD_INPUT_IOS_PROPS}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className={PASSWORD_TOGGLE_BTN_CLASS}
                tabIndex={-1}
                aria-label={showNewPassword ? "Hide password" : "Show password"}
              >
                {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {errors.newPassword && <p className="mt-1.5 text-xs font-medium text-red-600">{errors.newPassword}</p>}
          </div>

          <div>
            <label htmlFor="confirmPassword" className={LOGIN_LABEL_CLASS}>
              Confirm password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  if (errors.confirmPassword) setErrors((p) => ({ ...p, confirmPassword: "" }))
                  setApiMessage(null)
                }}
                placeholder="Re-enter new password"
                className={cn(inputClass(errors.confirmPassword), "password-input-custom-toggle pr-11")}
                disabled={isLoading}
                autoComplete="new-password"
                {...PASSWORD_INPUT_IOS_PROPS}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className={PASSWORD_TOGGLE_BTN_CLASS}
                tabIndex={-1}
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="mt-1.5 text-xs font-medium text-red-600">{errors.confirmPassword}</p>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setStep(STEP_EMAIL)}
              disabled={isLoading}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-[4px] border border-[#8A8886] px-4 text-[14px] font-semibold text-[#242424] transition-colors hover:bg-[#F3F2F1] disabled:opacity-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button type="submit" disabled={isLoading} className={cn(LOGIN_BTN_PRIMARY, "mt-0 flex-1")}>
              {isLoading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Resetting...
                </span>
              ) : (
                "Reset password"
              )}
            </button>
          </div>
        </form>
      )}

      <div className="mt-10">
        <button type="button" onClick={handleCancel} className={LOGIN_BRAND_LINK_CLASS}>
          Back to sign in
        </button>
      </div>
    </div>
  )
}
