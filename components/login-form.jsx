"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { authService } from "@/lib/services"
import { Loader2, Eye, EyeOff, RefreshCw, Send } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { BrandLoginLockup } from "@/components/brand-logo"
import LoginAuthMethodToggle from "@/components/login/login-auth-method-toggle"
import { APP_BRANDING } from "@/lib/config/appBranding"
import {
  LOGIN_BTN_PRIMARY,
  LOGIN_BRAND_LINK_CLASS,
  LOGIN_BRAND_LINK_SUBTLE_CLASS,
  LOGIN_FORM_FOOTER_LINK_CLASS,
  LOGIN_INPUT_CLASS,
  LOGIN_LABEL_CLASS,
  OTP_LOGIN_ENABLED,
  PASSWORD_INPUT_IOS_PROPS,
  PASSWORD_TOGGLE_BTN_CLASS,
} from "@/lib/login/loginUi"
import { DEVREV_WIDGET_ENABLED } from "@/lib/config/supportWidget"
import { cn } from "@/lib/utils"

/** Safe internal path after login — avoids open redirects and bad ?redirect= values. */
function resolveSafeRedirectPath(raw) {
  if (!raw || typeof raw !== "string") return "/dashboard"
  try {
    let path = raw.trim()
    if (path.includes("%")) {
      try {
        path = decodeURIComponent(path)
      } catch {
        /* use path as-is */
      }
    }
    if (path.startsWith("http://") || path.startsWith("https://")) {
      try {
        const url = new URL(path)
        if (typeof window !== "undefined" && url.origin === window.location.origin) {
          path = `${url.pathname}${url.search}${url.hash}`
        } else {
          return "/dashboard"
        }
      } catch {
        return "/dashboard"
      }
    }
    if (!path.startsWith("/") || path.startsWith("//")) return "/dashboard"
    if (path.startsWith("/login")) return "/dashboard"
    return path
  } catch {
    return "/dashboard"
  }
}

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [authMethod, setAuthMethod] = useState("password") // "password" or "otp"
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    mobileNumber: "",
    otp: "",
  })
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [isSendingOTP, setIsSendingOTP] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otpId, setOtpId] = useState(null) // Store OTP ID from send-otp response
  const [showPassword, setShowPassword] = useState(false)
  const [apiMessage, setApiMessage] = useState(null)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [captchaValue, setCaptchaValue] = useState("")
  const [captchaAnswer, setCaptchaAnswer] = useState(0)
  const [captchaQuestion, setCaptchaQuestion] = useState("")
  const [otpCountdown, setOtpCountdown] = useState(0)
  const widgetAutoCycleRef = useRef(null)
  const widgetObserverRef = useRef(null)
  const widgetVisibilityGuardRef = useRef(null)

  const redirectPath = resolveSafeRedirectPath(searchParams.get("redirect"))

  // Deep-link from DashboardLayout when session had no role
  useEffect(() => {
    if (searchParams.get("reason") !== "no-role") return
    setApiMessage({
      type: "error",
      text: "Your account has no role assigned. Contact your administrator to assign a role, then sign in again.",
    })
  }, [searchParams])

  // Focus function to focus on a field
  const focus = (fieldId, delay) => {
    setTimeout(() => {
      const field = document.getElementById(fieldId)
      if (field) {
        field.focus()
      }
    }, delay)
  }

  // Function to apply widget styles
  const applyWidgetStyles = () => {
    // Try multiple selectors to find the widget
    const selectors = [
      '[data-plug-widget-launcher]',
      '.plug-widget-launcher',
      '[id*="plug"]',
      '[class*="plug"]',
      '[class*="Plug"]',
      'div[style*="position: fixed"]',
      'div[style*="bottom"]',
      'div[style*="z-index"]',
    ]

    let widgetFound = false

    selectors.forEach((selector) => {
      try {
        const elements = document.querySelectorAll(selector)
        elements.forEach((el) => {
          if (el instanceof HTMLElement) {
            // Check if it looks like the widget (has fixed positioning and is near bottom)
            const style = window.getComputedStyle(el)
            const isFixed = style.position === 'fixed'
            const hasBottom = style.bottom !== 'auto' && style.bottom !== ''

            if (isFixed && hasBottom) {
              el.style.zIndex = "99999"
              el.style.position = "fixed"
              // Match globals.css launcher offset — avoid covering Save / sticky footers
              el.style.bottom = "max(7rem, calc(4.5rem + env(safe-area-inset-bottom, 0px)))"
              el.style.visibility = "visible"
              el.style.opacity = "1"
              el.style.display = "block"
              el.style.pointerEvents = "auto"
              widgetFound = true
            }
          }
        })
      } catch (e) {
        // Ignore selector errors
      }
    })

    // Specifically target ONLY the launcher iframe (the button, not the modal)
    const launcherIframe = document.querySelector('iframe[data-drid="PLUG_LAUNCHER_IFRAME"]')
    if (launcherIframe) {
      launcherIframe.setAttribute('data-plug-widget-enabled', 'true')
      // Force display: block with !important ONLY for the launcher button
      launcherIframe.style.setProperty('display', 'block', 'important')
      launcherIframe.style.zIndex = "99999"
      launcherIframe.style.position = "fixed"
      launcherIframe.style.bottom = "max(7rem, calc(4.5rem + env(safe-area-inset-bottom, 0px)))"
      launcherIframe.style.visibility = "visible"
      launcherIframe.style.opacity = "1"
      launcherIframe.style.pointerEvents = "auto"
      widgetFound = true
    }

    // For other iframes (widget modal), enable them but don't force display
    // Let the SDK control modal visibility (open/close)
    const iframes = document.querySelectorAll('iframe')
    iframes.forEach((iframe) => {
      if (iframe.src && (iframe.src.includes('devrev') || iframe.src.includes('plug-platform'))) {
        // Skip the launcher iframe (already handled above)
        if (iframe.getAttribute('data-drid') === 'PLUG_LAUNCHER_IFRAME') {
          return
        }

        // Enable the widget
        if (iframe.hasAttribute('data-plug-widget-enabled')) {
          iframe.setAttribute('data-plug-widget-enabled', 'true')
        }

        // Only set z-index and position, but let SDK control display (for close functionality)
        iframe.style.zIndex = "99998"
        iframe.style.position = "fixed"
        iframe.style.right = "max(0.75rem, env(safe-area-inset-right, 0px))"
        iframe.style.bottom = "max(0.75rem, env(safe-area-inset-bottom, 0px))"
        iframe.style.width = "min(420px, calc(100vw - 1.5rem))"
        iframe.style.maxWidth = "min(420px, calc(100vw - 1.5rem))"
        iframe.style.height = "min(760px, calc(100vh - 1.5rem))"
        iframe.style.maxHeight = "min(760px, calc(100vh - 1.5rem))"
        iframe.style.borderRadius = "20px"
        iframe.style.border = "1px solid rgba(255,255,255,0.72)"
        iframe.style.overflow = "hidden"
        iframe.style.boxShadow =
          "0 28px 70px -24px rgba(15,23,42,0.52), 0 10px 26px -12px rgba(15,23,42,0.34), 0 0 0 1px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.78)"
        // Don't force display - let SDK control open/close
        widgetFound = true
      }
    })

    return widgetFound
  }

  const applyMacWidgetAnimation = (isOpen) => {
    const widgetIframes = document.querySelectorAll('iframe[src*="devrev"], iframe[src*="plug-platform"]')
    widgetIframes.forEach((iframe) => {
      if (!(iframe instanceof HTMLElement)) return
      iframe.style.transition = "transform 460ms cubic-bezier(0.22, 1, 0.36, 1), opacity 360ms ease, box-shadow 460ms ease"
      iframe.style.transformOrigin = "bottom right"
      iframe.style.willChange = "transform, opacity"
      iframe.style.opacity = isOpen ? "1" : "0.9"
      iframe.style.transform = isOpen ? "translateY(0) scale(1)" : "translateY(14px) scale(0.98)"
      iframe.style.boxShadow = isOpen
        ? "0 30px 70px rgba(15, 23, 42, 0.28), 0 8px 24px rgba(15, 23, 42, 0.2)"
        : "0 12px 34px rgba(15, 23, 42, 0.16)"
    })
  }

  const startWidgetAutoCycle = () => {
    if (widgetAutoCycleRef.current || typeof window.plugSDK?.toggleWidget !== "function") {
      return
    }

    const CYCLE_MS = 2000
    let isOpen = true

    window.plugSDK.toggleWidget(true)
    applyMacWidgetAnimation(true)

    widgetAutoCycleRef.current = setInterval(() => {
      isOpen = !isOpen
      window.plugSDK.toggleWidget(isOpen)
      applyMacWidgetAnimation(isOpen)
      applyWidgetStyles()
    }, CYCLE_MS)
  }

  // Initialize DevRev Plug Widget
  function initializePlugWidget() {
    if (!DEVREV_WIDGET_ENABLED) return
    if (typeof window === "undefined") {
      return
    }

    // Global initializer in app layout handles one-time SDK init.
    // Keep login page safe from duplicate init/race.
    if (window.__devrevPlugInitialized) {
      return
    }

    if (typeof window.plugSDK?.init !== "function") {
      return setTimeout(initializePlugWidget, 300)
    }

    try {
      // Init plugSDK
      window.plugSDK.init({
        app_id:
          "DvRvStPZG9uOmNvcmU6ZHZydi1pbi0xOmRldm8vMktvb3FrQnlQUDpwbHVnX3NldHRpbmcvMV9ffHxfXzIwMjUtMDctMjIgMTA6MjA6NDUuODE2MzQyOTU1ICswMDAwIFVUQw==xlxendsDvRv",
      })
      window.__devrevPlugInitialized = true

      // Apply styles immediately and retry multiple times
      const applyStylesWithRetry = (attempt = 0) => {
        const maxAttempts = 10
        const found = applyWidgetStyles()

        if (!found && attempt < maxAttempts) {
          setTimeout(() => applyStylesWithRetry(attempt + 1), 500)
        }
      }

      // Start applying styles with retries
      applyStylesWithRetry()

      // Use MutationObserver to watch for widget being added to DOM
      const observer = new MutationObserver(() => {
        applyWidgetStyles()
      })

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'id'],
      })
      widgetObserverRef.current = observer

      // Listen to SDK events
      window.plugSDK.onEvent(function (payload) {
        if (payload.type === "ON_PLUG_WIDGET_READY") {
          if (typeof window.plugSDK.toggleWidget === "function") {
            // Keep widget collapsed by default; user must click launcher icon to open.
            window.plugSDK.toggleWidget(false)
          }

          // Enable and show the widget when ready
          setTimeout(() => {
            const launcherIframe = document.querySelector('iframe[data-drid="PLUG_LAUNCHER_IFRAME"]')
            if (launcherIframe) {
              launcherIframe.setAttribute('data-plug-widget-enabled', 'true')
              // Force display: block with !important
              launcherIframe.style.setProperty('display', 'block', 'important')
              launcherIframe.style.visibility = "visible"
              launcherIframe.style.opacity = "1"
            }
            applyWidgetStyles()
          }, 100)

          setTimeout(() => {
            applyWidgetStyles()
          }, 500)

          setTimeout(() => {
            applyWidgetStyles()
          }, 1000)
          // IMPORTANT: do not auto-open/auto-cycle; keep only launcher icon visible.

          // Continuously monitor and fix display: none issue
          const fixDisplayInterval = setInterval(() => {
            const launcherIframe = document.querySelector('iframe[data-drid="PLUG_LAUNCHER_IFRAME"]')
            if (launcherIframe) {
              // Always ensure it's enabled and visible
              if (launcherIframe.getAttribute('data-plug-widget-enabled') !== 'true') {
                launcherIframe.setAttribute('data-plug-widget-enabled', 'true')
              }
              // Force display: block to override any display: none
              const computedStyle = window.getComputedStyle(launcherIframe)
              if (computedStyle.display === 'none') {
                launcherIframe.style.setProperty('display', 'block', 'important')
              }
            }
          }, 1000)
          widgetVisibilityGuardRef.current = fixDisplayInterval

          // Stop monitoring after 60 seconds
          setTimeout(() => {
            clearInterval(fixDisplayInterval)
            if (widgetVisibilityGuardRef.current === fixDisplayInterval) {
              widgetVisibilityGuardRef.current = null
            }
          }, 60000)
        }
      })
    } catch (error) {
      // Silently handle errors
    }
  }

  // Initialize function
  function init() {
    focus("loginname", 1000)
    initializePlugWidget()
  }

  // Generate captcha question
  const generateCaptcha = () => {
    const num1 = Math.floor(Math.random() * 10) + 1
    const num2 = Math.floor(Math.random() * 10) + 1
    const answer = num1 + num2
    setCaptchaAnswer(answer)
    setCaptchaQuestion(`${num1} + ${num2} = ?`)
    setCaptchaValue("")
  }

  // Call init on component mount
  useEffect(() => {
    if (!DEVREV_WIDGET_ENABLED) {
      focus("loginname", 1000)
      return
    }

    // Wait for script to load if not already loaded
    const checkScriptAndInit = () => {
      const scriptLoaded = document.querySelector('script[src*="plug-platform.devrev.ai"]')

      if (scriptLoaded || window.plugSDK) {
        init()
      } else {
        setTimeout(checkScriptAndInit, 200)
      }
    }

    checkScriptAndInit()

    return () => {
      if (widgetAutoCycleRef.current) {
        clearInterval(widgetAutoCycleRef.current)
        widgetAutoCycleRef.current = null
      }
      if (widgetVisibilityGuardRef.current) {
        clearInterval(widgetVisibilityGuardRef.current)
        widgetVisibilityGuardRef.current = null
      }
      if (widgetObserverRef.current) {
        widgetObserverRef.current.disconnect()
        widgetObserverRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Generate captcha only on client side to prevent hydration mismatch
  useEffect(() => {
    generateCaptcha()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Warm up key routes so post-login navigation feels faster.
  useEffect(() => {
    router.prefetch?.("/dashboard")
    router.prefetch?.("/force-change-password")
  }, [router])

  // Countdown timer for OTP resend
  useEffect(() => {
    if (otpCountdown > 0) {
      const timer = setTimeout(() => {
        setOtpCountdown(otpCountdown - 1)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [otpCountdown])

  const validateForm = () => {
    const newErrors = {}

    if (authMethod === "password") {
      if (!formData.username.trim()) {
        newErrors.username = "Username is required"
      }
      if (!formData.password) {
        newErrors.password = "Password is required"
      } else if (formData.password.length < 6) {
        newErrors.password = "Password must be at least 6 characters"
      }
      // Validate captcha
      if (!captchaValue.trim()) {
        newErrors.captcha = "Please solve the captcha"
      } else if (parseInt(captchaValue) !== captchaAnswer) {
        newErrors.captcha = "Incorrect captcha answer"
      }
    } else if (authMethod === "otp") {
      if (!otpSent) {
        // Validate mobile number before sending OTP
        if (!formData.mobileNumber.trim()) {
          newErrors.mobileNumber = "Mobile number is required"
        } else if (formData.mobileNumber.length !== 10) {
          newErrors.mobileNumber = "Mobile number must be exactly 10 digits"
        } else if (!/^\d+$/.test(formData.mobileNumber)) {
          newErrors.mobileNumber = "Mobile number must contain only digits"
        }
        // Validate captcha before sending OTP
        if (!captchaValue.trim()) {
          newErrors.captcha = "Please solve the captcha"
        } else if (parseInt(captchaValue) !== captchaAnswer) {
          newErrors.captcha = "Incorrect captcha answer"
        }
        return Object.keys(newErrors).length === 0
      }
      // Validate OTP if it's been sent (exactly 6 digits as per backend)
      if (!formData.otp) {
        newErrors.otp = "OTP is required"
      } else if (formData.otp.length !== 6) {
        newErrors.otp = "OTP must be exactly 6 digits"
      } else if (!/^[0-9]{6}$/.test(formData.otp)) {
        newErrors.otp = "OTP must contain only digits"
      }
    }

    if (!acceptedTerms) {
      newErrors.terms = "You must accept the Terms and Conditions"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    // Limit OTP to exactly 6 digits (as per backend API)
    if (name === "otp") {
      const numericValue = value.replace(/\D/g, "").slice(0, 6)
      setFormData((prev) => ({
        ...prev,
        [name]: numericValue,
      }))
    } else if (name === "mobileNumber") {
      // Limit mobile number to 10 digits, only numbers
      const numericValue = value.replace(/\D/g, "").slice(0, 10)
      setFormData((prev) => ({
        ...prev,
        [name]: numericValue,
      }))
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }))
    }
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }))
    }
    // Clear API message when user starts typing
    if (apiMessage) {
      setApiMessage(null)
    }
  }

  const handleAuthMethodChange = (method) => {
    if (!OTP_LOGIN_ENABLED && method === "otp") return
    setAuthMethod(method)
    setFormData((prev) => ({
      ...prev,
      password: "",
      mobileNumber: "",
      otp: "",
    }))
    setOtpSent(false)
    setOtpId(null) // Reset OTP ID when switching methods
    setOtpCountdown(0) // Reset countdown
    setErrors({})
    setApiMessage(null)
    // Generate captcha for both password and OTP methods
    generateCaptcha()
  }

  const handleSendOTP = async (e) => {
    e.preventDefault()
    setApiMessage(null)

    // Validate mobile number
    if (!formData.mobileNumber.trim()) {
      setErrors({ mobileNumber: "Mobile number is required" })
      return
    }

    if (formData.mobileNumber.length !== 10) {
      setErrors({ mobileNumber: "Mobile number must be exactly 10 digits" })
      return
    }

    if (!/^\d+$/.test(formData.mobileNumber)) {
      setErrors({ mobileNumber: "Mobile number must contain only digits" })
      return
    }

    // Validate captcha before sending OTP
    if (!captchaValue.trim()) {
      setErrors((prev) => ({ ...prev, captcha: "Please solve the captcha" }))
      return
    }

    if (parseInt(captchaValue) !== captchaAnswer) {
      setErrors((prev) => ({ ...prev, captcha: "Incorrect captcha answer" }))
      return
    }

    setIsSendingOTP(true)

    try {
      const response = await authService.sendOTP(formData.mobileNumber)

      if (response.isSuccess && response.data) {
        // Store OTP ID from response (backend returns: { success: true, data: { otpId: "...", message: "..." } })
        const receivedOtpId = response.data.otpId
        if (receivedOtpId) {
          setOtpId(receivedOtpId)
        } else {
          setApiMessage({
            type: "error",
            text: "OTP sent but OTP ID not received. Please try again.",
          })
          setIsSendingOTP(false)
          return
        }
        // Get last 4 digits of mobile number
        const last4Digits = formData.mobileNumber.slice(-4)
        setApiMessage({
          type: "success",
          text: `OTP sent successfully to your mobile number ending with ${last4Digits}`,
        })
        setOtpSent(true)
        setOtpCountdown(59) // Start countdown from 59 seconds
        authService.setLastUsername(formData.mobileNumber)
        // Reset captcha after successful OTP send
        generateCaptcha()
      } else {
        setApiMessage({
          type: "error",
          text: response.message || "Failed to send OTP. Please try again.",
        })
      }
    } catch (error) {
      setApiMessage({
        type: "error",
        text: error.message || "An unexpected error occurred. Please try again.",
      })
    } finally {
      setIsSendingOTP(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setApiMessage(null)

    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      let response
      if (authMethod === "password") {
        response = await authService.login(formData.username, formData.password)
      } else {
        // OTP login - requires otpId from send-otp response
        if (!otpId) {
          setApiMessage({
            type: "error",
            text: "OTP session expired. Please request a new OTP.",
          })
          setIsLoading(false)
          setOtpSent(false)
          setOtpId(null)
          return
        }
        response = await authService.loginWithOTP(formData.mobileNumber, otpId, formData.otp)
      }

      // Handle successful login
      if (response.isSuccess) {
        const loggedInUser = response.data?.user

        // Check if password change is required (allow through before role check)
        if (loggedInUser?.isPasswordChangeRequired) {
          setApiMessage({
            type: "success",
            text: response.message || "Login successful! Redirecting...",
          })
          authService.setLastUsername(authMethod === "password" ? formData.username : formData.mobileNumber)
          setIsRedirecting(true)
          window.location.assign("/force-change-password")
          return
        } else if (!authService.hasRequiredRoleAssignment(loggedInUser)) {
          await authService.logout()
          setApiMessage({
            type: "error",
            text:
              "Your account has no role assigned. You cannot use the application until an administrator assigns a role.",
          })
        } else {
          setApiMessage({
            type: "success",
            text: response.message || "Login successful! Redirecting...",
          })
          authService.setLastUsername(authMethod === "password" ? formData.username : formData.mobileNumber)
          setIsRedirecting(true)
          // Full navigation avoids Next.js RSC fetch stuck in Pending after login
          window.location.assign(redirectPath)
          return
        }
      } else {
        // Handle failed login
        setApiMessage({
          type: "error",
          text: response.message || "Login failed. Please check your credentials.",
        })
      }
    } catch (error) {
      setApiMessage({
        type: "error",
        text: error.message || "An unexpected error occurred. Please try again.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotpassword = (e) => {
    if (e) {
      e.preventDefault()
    }
    router.push("/forgot-password")
  }

  // Check if Send OTP button should be disabled
  const isSendOTPDisabled = () => {
    if (authMethod !== "otp" || otpSent) {
      return false // Not applicable for password method or after OTP is sent
    }
    // Disable if mobile number is invalid
    const isMobileValid = formData.mobileNumber.trim().length === 10 && /^\d+$/.test(formData.mobileNumber)
    // Disable if captcha is invalid
    const isCaptchaValid = captchaValue.trim() !== "" && parseInt(captchaValue) === captchaAnswer
    // Disable if terms not accepted
    return !isMobileValid || !isCaptchaValid || !acceptedTerms
  }

  const inputClass = (hasError) =>
    cn(LOGIN_INPUT_CLASS, hasError && "border-red-400 focus-visible:ring-red-500/15")

  return (
    <div className="flex w-full flex-col">
      <div className="mb-10 lg:hidden">
        <BrandLoginLockup className="!justify-start" />
      </div>

      <header className="mb-8">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7C6BB5]">
          {APP_BRANDING.productName}
        </p>
        <h1 className="text-[2rem] font-semibold tracking-[-0.04em] text-[#2D1C4E]">
          Sign in
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[#7C6F96]">
          Access your clinical data capture workspace.
        </p>
      </header>

      {/* API Message */}
      {apiMessage && (
        <div
          className={`mb-5 rounded-xl p-3.5 ${
            apiMessage.type === "success"
              ? "border border-violet-200 bg-violet-50 text-violet-900"
              : "border border-red-200 bg-red-50 text-red-900"
          }`}
        >
          <div className="flex items-start gap-2">
            {apiMessage.type === "success" ? (
              <svg className="mt-0.5 h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <svg className="mt-0.5 h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 001.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            <div className="flex-1">
              <p className="text-sm font-medium">{apiMessage.text}</p>
              {authMethod === "otp" && otpSent && otpCountdown > 0 && (
                <p className="mt-0.5 text-xs text-violet-800">
                  Resend OTP in {otpCountdown} second{otpCountdown !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {OTP_LOGIN_ENABLED && (
        <div className="mb-5">
          <LoginAuthMethodToggle
            value={authMethod}
            onChange={handleAuthMethodChange}
            disabled={isLoading || isRedirecting || isSendingOTP}
          />
        </div>
      )}

      <form onSubmit={authMethod === "otp" && !otpSent ? handleSendOTP : handleSubmit} className="space-y-4">
        {/* Username Field - Only for password method */}
        {authMethod === "password" && (
          <div>
            <Label htmlFor="loginname" className={LOGIN_LABEL_CLASS}>
              Email or username
            </Label>
            <Input
              id="loginname"
              name="username"
              type="email"
              autoComplete="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="name@company.com"
              className={inputClass(errors.username)}
              disabled={isLoading}
            />
            {errors.username && <p className="mt-1.5 text-xs font-medium text-red-600">{errors.username}</p>}
          </div>
        )}

          {/* Mobile Number Field - Only for OTP method */}
          {authMethod === "otp" && !otpSent && (
            <div className="space-y-2">
              <Label htmlFor="mobileNumber" className="text-xs">
                Mobile Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="mobileNumber"
                name="mobileNumber"
                type="text"
                value={formData.mobileNumber}
                onChange={handleChange}
                placeholder="Enter 10-digit mobile number"
                maxLength={10}
                className={inputClass(errors.mobileNumber)}
                disabled={isLoading || isSendingOTP}
              />
              {errors.mobileNumber && <p className="mt-1 text-[10px] text-red-600 font-medium">{errors.mobileNumber}</p>}
            </div>
          )}

          {/* Captcha Field - Show for OTP method before OTP is sent */}
          {authMethod === "otp" && !otpSent && (
            <div className="space-y-2">
              <Label htmlFor="captcha-otp" className="text-xs">
                Captcha <span className="text-red-500">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 h-9">
                  <span className="text-sm font-semibold text-slate-700 select-none tracking-widest">{captchaQuestion}</span>
                  <button
                    type="button"
                    onClick={generateCaptcha}
                    className="text-slate-400 transition-colors hover:text-[#0f766e] p-1"
                    title="Refresh captcha"
                    disabled={isLoading || isSendingOTP}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
                <Input
                  id="captcha-otp"
                  name="captcha-otp"
                  type="number"
                  value={captchaValue}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 3)
                    setCaptchaValue(value)
                    if (errors.captcha) {
                      setErrors((prev) => {
                        const newErrors = { ...prev }
                        delete newErrors.captcha
                        return newErrors
                      })
                    }
                  }}
                  placeholder="Answer"
                  className={cn(inputClass(errors.captcha), "w-24 text-center")}
                  disabled={isLoading || isSendingOTP}
                />
              </div>
              {errors.captcha && <p className="mt-1 text-[10px] text-red-600 font-medium">{errors.captcha}</p>}
            </div>
          )}

        {/* Password Field - Only show for password method */}
        {authMethod === "password" && (
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <Label htmlFor="password" className="mb-0 text-[13px] font-medium text-[#242424]">
                Password
              </Label>
              <a
                href="/forgot-password"
                onClick={(e) => {
                  e.preventDefault()
                  handleForgotpassword(e)
                }}
                className={LOGIN_BRAND_LINK_CLASS}
              >
                Forgot password?
              </a>
            </div>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                inputMode="text"
                autoComplete="current-password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                className={cn(inputClass(errors.password), "password-input-custom-toggle relative z-0 pr-11")}
                disabled={isLoading}
                {...PASSWORD_INPUT_IOS_PROPS}
                onPointerDown={(e) => {
                  e.currentTarget.focus()
                }}
                onTouchStart={(e) => {
                  e.currentTarget.focus()
                }}
              />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onPointerDown={(e) => e.preventDefault()}
                onTouchStart={(e) => e.preventDefault()}
                onClick={() => setShowPassword(!showPassword)}
                className={PASSWORD_TOGGLE_BTN_CLASS}
                disabled={isLoading}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="mt-1.5 text-xs font-medium text-red-600">{errors.password}</p>}
          </div>
        )}

          {/* Captcha Field - Only show for password method */}
          {authMethod === "password" && (
            <div>
              <Label htmlFor="captcha" className={LOGIN_LABEL_CLASS}>
                Captcha
              </Label>
              <div className="flex items-center gap-2">
                <div className="flex h-12 flex-1 items-center justify-between gap-2 rounded-[4px] border border-[#8A8886] bg-[#F3F2F1] px-3">
                  <span className="select-none text-[15px] font-semibold tracking-widest text-[#242424]">
                    {captchaQuestion}
                  </span>
                  <button
                    type="button"
                    onClick={generateCaptcha}
                    className="p-1 text-[#605E5C] transition-colors hover:text-[#0F766E]"
                    title="Refresh captcha"
                    disabled={isLoading}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </div>
                <Input
                  id="captcha"
                  name="captcha"
                  type="number"
                  value={captchaValue}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 3)
                    setCaptchaValue(value)
                    if (errors.captcha) {
                      setErrors((prev) => {
                        const newErrors = { ...prev }
                        delete newErrors.captcha
                        return newErrors
                      })
                    }
                  }}
                  placeholder="Answer"
                  className={cn(inputClass(errors.captcha), "w-24 text-center")}
                  disabled={isLoading}
                />
              </div>
              {errors.captcha && <p className="mt-1.5 text-xs font-medium text-red-600">{errors.captcha}</p>}
            </div>
          )}

          {/* OTP Field - Only show for OTP method after OTP is sent */}
          {authMethod === "otp" && otpSent && (
            <div className="space-y-2">
              <Label htmlFor="otp" className="text-xs">
                OTP <span className="text-red-500">*</span>
              </Label>
              <Input
                id="otp"
                name="otp"
                type="text"
                value={formData.otp}
                onChange={handleChange}
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                className={inputClass(errors.otp)}
                disabled={isLoading}
              />
              {errors.otp && <p className="mt-1 text-[10px] text-red-600 font-medium">{errors.otp}</p>}
            </div>
          )}

          {/* Terms and Conditions */}
          <div className="flex items-start gap-2.5 pt-1">
            <Checkbox
              id="terms"
              checked={acceptedTerms}
              onCheckedChange={(checked) => {
                setAcceptedTerms(checked)
                if (errors.terms && checked) {
                  setErrors((prev) => {
                    const newErrors = { ...prev }
                    delete newErrors.terms
                    return newErrors
                  })
                }
              }}
              className="mt-0.5"
            />
            <Label htmlFor="terms" className="cursor-pointer text-[13px] font-normal leading-snug text-[#4B5563]">
              I agree to the{" "}
              <a
                href="/terms-and-conditions"
                target="_blank"
                rel="noopener noreferrer"
                className={LOGIN_BRAND_LINK_SUBTLE_CLASS}
                onClick={(e) => e.stopPropagation()}
              >
                Terms and Conditions
              </a>
            </Label>
          </div>
          {errors.terms && <p className="text-xs font-medium text-red-600">{errors.terms}</p>}

        {/* Submit Button */}
        <div className="pt-2">
          <Button
            type="submit"
            disabled={isLoading || isRedirecting || isSendingOTP || (authMethod === "otp" && !otpSent && isSendOTPDisabled())}
            className={LOGIN_BTN_PRIMARY}
          >
            {isLoading || isRedirecting || isSendingOTP ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span>
                  {isRedirecting
                    ? "Opening workspace..."
                    : authMethod === "otp" && !otpSent
                      ? "Sending OTP..."
                      : "Signing in..."}
                </span>
              </>
            ) : authMethod === "otp" && !otpSent ? (
              <>
                Send OTP <Send className="ml-2 h-4 w-4" />
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </div>
      </form>

      <footer className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-2">
        <a href="/terms-and-conditions" target="_blank" rel="noopener noreferrer" className={LOGIN_FORM_FOOTER_LINK_CLASS}>
          Terms of use
        </a>
        <a href="/terms-and-conditions" target="_blank" rel="noopener noreferrer" className={LOGIN_FORM_FOOTER_LINK_CLASS}>
          Privacy & cookies
        </a>
        <a
          href={APP_BRANDING.supportUrl || "/terms-and-conditions"}
          target="_blank"
          rel="noopener noreferrer"
          className={LOGIN_FORM_FOOTER_LINK_CLASS}
        >
          Help
        </a>
      </footer>
    </div>
  )
}
