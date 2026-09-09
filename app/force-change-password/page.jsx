"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { authService } from "@/lib/services"
import { useToast } from "@/hooks/use-toast"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import LoginBrandAside from "@/components/login/login-brand-aside"
import { BrandLoginLockup } from "@/components/brand-logo"
import { APP_BRANDING } from "@/lib/config/appBranding"
import {
  LOGIN_BTN_PRIMARY,
  LOGIN_FORM_INNER_CLASS,
  LOGIN_FORM_PANEL_CLASS,
  LOGIN_INPUT_CLASS,
  LOGIN_LABEL_CLASS,
  LOGIN_PAGE_CLASS,
  PASSWORD_INPUT_IOS_PROPS,
  PASSWORD_TOGGLE_BTN_CLASS,
} from "@/lib/login/loginUi"
import { cn } from "@/lib/utils"

export default function ForceChangePasswordPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  })
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    const currentUser = authService.getUser()
    if (!currentUser) {
      router.push("/login")
      return
    }
    setUser(currentUser)
  }, [router])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }))
  }

  const validate = () => {
    const newErrors = {}
    if (!formData.currentPassword) newErrors.currentPassword = "Current password is required"
    if (!formData.newPassword) newErrors.newPassword = "New password is required"
    if (formData.newPassword.length < 6) newErrors.newPassword = "Password must be at least 6 characters"
    if (formData.newPassword !== formData.confirmPassword) newErrors.confirmPassword = "Passwords do not match"
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    setIsLoading(true)
    try {
      if (!user) {
        toast({
          title: "Session Invalid",
          description: "User session invalid. Please login again.",
          variant: "destructive",
        })
        router.push("/login")
        return
      }

      const payload = {
        username: user.username || user.loginName || user.email,
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      }

      const response = await authService.changePassword(payload)

      if (response.isSuccess) {
        const updatedUser = { ...user, isPasswordChangeRequired: false }
        const token = authService.getToken()
        const menu = authService.getMenu()
        authService.storeAuthData(token, updatedUser, menu)
        router.push("/dashboard")
      } else {
        setErrors((prev) => ({ ...prev, form: response.message || "Failed to change password" }))
      }
    } catch (error) {
      setErrors((prev) => ({ ...prev, form: error.message || "An unexpected error occurred" }))
    } finally {
      setIsLoading(false)
    }
  }

  const toggleShowPassword = (field) => {
    setShowPassword((prev) => ({ ...prev, [field]: !prev[field] }))
  }

  const inputClass = (hasError) =>
    cn(LOGIN_INPUT_CLASS, "password-input-custom-toggle pr-11", hasError && "border-red-500")

  return (
    <div className={LOGIN_PAGE_CLASS}>
      <LoginBrandAside />

      <main className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-white lg:w-[54%] xl:w-[52%]">
        <div className={LOGIN_FORM_PANEL_CLASS}>
          <div className={LOGIN_FORM_INNER_CLASS}>
            <div className="mb-8 lg:hidden">
              <BrandLoginLockup className="!justify-start" />
            </div>

            <header className="mb-7">
              <h1 className="text-[28px] font-semibold tracking-tight text-[#242424] sm:text-[32px]">
                Update password
              </h1>
              <p className="mt-2 text-[15px] text-[#605E5C]">
                For security, set a new password before continuing to {APP_BRANDING.productName}.
              </p>
            </header>

            {errors.form && (
              <div className="mb-5 rounded-[4px] border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-900">
                {errors.form}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="currentPassword" className={LOGIN_LABEL_CLASS}>
                  Current password
                </Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    name="currentPassword"
                    type={showPassword.current ? "text" : "password"}
                    value={formData.currentPassword}
                    onChange={handleChange}
                    disabled={isLoading}
                    className={inputClass(errors.currentPassword)}
                    placeholder="Enter current password"
                    autoComplete="current-password"
                    {...PASSWORD_INPUT_IOS_PROPS}
                  />
                  <button type="button" onClick={() => toggleShowPassword("current")} className={PASSWORD_TOGGLE_BTN_CLASS}>
                    {showPassword.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.currentPassword && (
                  <p className="mt-1.5 text-xs font-medium text-red-600">{errors.currentPassword}</p>
                )}
              </div>

              <div>
                <Label htmlFor="newPassword" className={LOGIN_LABEL_CLASS}>
                  New password
                </Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    name="newPassword"
                    type={showPassword.new ? "text" : "password"}
                    value={formData.newPassword}
                    onChange={handleChange}
                    disabled={isLoading}
                    className={inputClass(errors.newPassword)}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                    {...PASSWORD_INPUT_IOS_PROPS}
                  />
                  <button type="button" onClick={() => toggleShowPassword("new")} className={PASSWORD_TOGGLE_BTN_CLASS}>
                    {showPassword.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.newPassword && <p className="mt-1.5 text-xs font-medium text-red-600">{errors.newPassword}</p>}
              </div>

              <div>
                <Label htmlFor="confirmPassword" className={LOGIN_LABEL_CLASS}>
                  Confirm new password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword.confirm ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    disabled={isLoading}
                    className={inputClass(errors.confirmPassword)}
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                    {...PASSWORD_INPUT_IOS_PROPS}
                  />
                  <button type="button" onClick={() => toggleShowPassword("confirm")} className={PASSWORD_TOGGLE_BTN_CLASS}>
                    {showPassword.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1.5 text-xs font-medium text-red-600">{errors.confirmPassword}</p>
                )}
              </div>

              <Button type="submit" className={LOGIN_BTN_PRIMARY} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
