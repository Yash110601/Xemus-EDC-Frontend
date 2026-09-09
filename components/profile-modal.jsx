"use client"

import { useState, useEffect } from "react"
import { authService, userService } from "@/lib/services"
import { loadImageAsBlobUrl } from "@/lib/utils/imageLoader"
import { isValidEmail } from "@/lib/utils/emailValidation"
import { Skeleton } from "@/components/ui/skeleton"
import { User, Upload, Save, Mail, Phone, Lock, ChevronDown, ChevronUp } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

export default function ProfileModal({ isOpen, onClose }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState(null)
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    roleName: "",
    profileImage: null,
    profileImagePreview: null,
  })
  const [errors, setErrors] = useState({})
  const [success, setSuccess] = useState("")
  const [error, setError] = useState("")
  const [profileImageUrl, setProfileImageUrl] = useState(null) // Blob URL for profile image from API
  // Change password section
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [passwordError, setPasswordError] = useState("")
  const [passwordSuccess, setPasswordSuccess] = useState("")
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordErrors, setPasswordErrors] = useState({})

  // Load profile image using common utility function
  const loadProfileImage = async (imageUrl) => {
    if (!imageUrl) {
      // Clean up existing blob URL if any
      if (profileImageUrl) {
        window.URL.revokeObjectURL(profileImageUrl)
      }
      setProfileImageUrl(null)
      return
    }

    // Clean up old blob URL before setting new one
    if (profileImageUrl) {
      window.URL.revokeObjectURL(profileImageUrl)
    }

    // Use common utility function to load image
    const { blobUrl, error } = await loadImageAsBlobUrl(imageUrl)
    
    // Silently fail - just don't show the image if there's an error
    if (error || !blobUrl) {
      setProfileImageUrl(null)
      return
    }

    setProfileImageUrl(blobUrl)
  }

  const fetchUserProfile = async () => {
    try {
      setLoading(true)
      const currentUser = authService.getUser()
      setUser(currentUser)

      if (currentUser) {
        const photoUrl = currentUser.profilePhotoUrl || currentUser.profileImage || currentUser.profileImageUrl || null
        let phoneNumber = currentUser.phoneNumber || currentUser.phone || currentUser.PhoneNumber || ""
        if (phoneNumber && String(phoneNumber).startsWith("91") && String(phoneNumber).length > 10) {
          phoneNumber = String(phoneNumber).substring(2)
        }
        setFormData({
          firstName: currentUser.firstName ?? currentUser.FirstName ?? "",
          lastName: currentUser.lastName ?? currentUser.LastName ?? "",
          email: currentUser.email ?? currentUser.Email ?? "",
          phoneNumber: String(phoneNumber || ""),
          roleName: currentUser.roleName ?? currentUser.RoleName ?? "",
          profileImage: null,
          profileImagePreview: null,
        })

        // Load profile image asynchronously without blocking form rendering
        // Always use ViewByUrl endpoint since blob storage requires authentication
        if (photoUrl) {
          // Don't await - let it load in background
          loadProfileImage(photoUrl).catch((error) => {
            console.warn("Failed to load profile image:", error)
            setProfileImageUrl(null)
          })
        } else {
          setProfileImageUrl(null)
        }
      }
    } catch (error) {
      console.error("Error fetching user profile:", error)
      setError("Failed to load user profile")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchUserProfile()
      // Reset errors and messages when opening
      setError("")
      setSuccess("")
    } else {
      // Reset form state when closing
      setFormData((prev) => ({
        ...prev,
        profileImage: null,
      }))
      setErrors({})
      setShowChangePassword(false)
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
      setPasswordError("")
      setPasswordSuccess("")
      setPasswordErrors({})
      // Clean up blob URL when modal closes
      if (profileImageUrl) {
        window.URL.revokeObjectURL(profileImageUrl)
        setProfileImageUrl(null)
      }
    }
  }, [isOpen])

  // Cleanup: Revoke blob URLs when component unmounts or profileImageUrl changes
  useEffect(() => {
    return () => {
      if (profileImageUrl) {
        window.URL.revokeObjectURL(profileImageUrl)
      }
    }
  }, [profileImageUrl])

  const handleInputChange = (field, value) => {
    // First Name and Last Name: allow only letters and spaces (no numbers)
    if (field === "firstName" || field === "lastName") {
      value = value.replace(/[^a-zA-Z\s]/g, "")
    }
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
    setError("")
    setSuccess("")
  }

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.type.startsWith("image/")) {
        if (file.size > 5 * 1024 * 1024) {
          setError("Image size should be less than 5MB")
          return
        }
        const reader = new FileReader()
        reader.onloadend = () => {
          setFormData((prev) => ({
            ...prev,
            profileImage: file,
            profileImagePreview: reader.result,
          }))
        }
        reader.readAsDataURL(file)
        setError("")
      } else {
        setError("Please upload a valid image file")
      }
    }
  }

  const handlePasswordFieldChange = (field, value) => {
    setPasswordForm((prev) => ({ ...prev, [field]: value }))
    if (passwordErrors[field]) {
      setPasswordErrors((prev) => ({ ...prev, [field]: undefined }))
    }
    setPasswordError("")
    setPasswordSuccess("")
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPasswordError("")
    setPasswordSuccess("")
    const newErrors = {}
    if (!passwordForm.currentPassword.trim()) {
      newErrors.currentPassword = "Current password is required"
    }
    if (!passwordForm.newPassword.trim()) {
      newErrors.newPassword = "New password is required"
    } else if (passwordForm.newPassword.length < 6) {
      newErrors.newPassword = "New password must be at least 6 characters"
    } else if (passwordForm.newPassword.length > 100) {
      newErrors.newPassword = "New password must not exceed 100 characters"
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match"
    }
    if (passwordForm.currentPassword && passwordForm.newPassword && passwordForm.currentPassword === passwordForm.newPassword) {
      newErrors.newPassword = "New password must be different from current password"
    }
    setPasswordErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return

    const currentUser = authService.getUser()
    // Backend expects the same identifier as login (email)
    const username =
      currentUser?.email ||
      currentUser?.username ||
      currentUser?.userName ||
      currentUser?.loginName ||
      ""
    if (!username) {
      setPasswordError("Could not identify user. Please sign in again.")
      return
    }

    try {
      setChangingPassword(true)
      const response = await authService.changePassword({
        username,
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })
      if (response.isSuccess) {
        setPasswordSuccess("Password changed. Redirecting to login...")
        setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
        setPasswordErrors({})
        await authService.logout()
        if (typeof window !== "undefined") {
          window.location.href = "/login"
        }
      } else {
        // 401 wrong current password, 400 validation, 500 generic – show API message or errors
        const msg =
          response.message ||
          (response.data && typeof response.data === "object" && response.data.message) ||
          (Array.isArray(response.data?.errors) && response.data.errors.length
            ? response.data.errors.join(", ")
            : null) ||
          (response.httpStatus === 500 ? "Something went wrong. Please try again." : "Failed to change password.")
        setPasswordError(msg)
      }
    } catch (err) {
      const msg =
        err?.message ||
        (err?.data?.message) ||
        (Array.isArray(err?.data?.errors) && err.data.errors.length ? err.data.errors.join(", ") : null) ||
        "Something went wrong. Please try again."
      setPasswordError(msg)
    } finally {
      setChangingPassword(false)
    }
  }

  const validateForm = () => {
    const newErrors = {}
    
    const nameOnlyRegex = /^[a-zA-Z\s]+$/
    // First name validation (required, characters only, max 100 chars)
    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required"
    } else if (!nameOnlyRegex.test(formData.firstName.trim())) {
      newErrors.firstName = "First name must contain only letters"
    } else if (formData.firstName.length > 100) {
      newErrors.firstName = "First name must not exceed 100 characters"
    }

    // Last name validation (required, characters only, max 100 chars)
    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required"
    } else if (!nameOnlyRegex.test(formData.lastName.trim())) {
      newErrors.lastName = "Last name must contain only letters"
    } else if (formData.lastName.length > 100) {
      newErrors.lastName = "Last name must not exceed 100 characters"
    }
    
    // Email validation (required, valid format, max 255 chars)
    // Allows hyphens in local part (e.g. first.last@example.com)
    if (!formData.email.trim()) {
      newErrors.email = "Email is required"
    } else if (!isValidEmail(formData.email)) {
      newErrors.email = "Please enter a valid email address (e.g. name@domain.com or first.last@example.com)"
    } else if (formData.email.length > 255) {
      newErrors.email = "Email must not exceed 255 characters"
    }
    
    // Phone number validation (required, 10 digits or 12 with 91 prefix - backend: ^(91)?\d{10}$)
    const phone = formData.phoneNumber?.trim() || ""
    if (!phone) {
      newErrors.phoneNumber = "Phone number is required"
    } else if (!/^(91)?\d{10}$/.test(phone.replace(/\s/g, ""))) {
      newErrors.phoneNumber = "Phone must be 10 digits or 12 with 91 prefix (e.g. 919876543210)"
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (!validateForm()) {
      return
    }

    try {
      setSaving(true)
      const currentUser = authService.getUser()
      const resolvedUsername =
        currentUser?.username ||
        currentUser?.userName ||
        currentUser?.loginName ||
        currentUser?.email ||
        ""
      // API: PUT /api/Profile/UpdateProfile, Content-Type: multipart/form-data
      // Fields: FirstName, LastName, Email, PhoneNumber (required), Gender (optional), Photo (optional)
      const firstName = formData.firstName.trim()
      const lastName = formData.lastName.trim()
      const email = formData.email.trim()
      const phoneNumber = (formData.phoneNumber?.trim() || "").replace(/\s/g, "")

      const formDataToSend = new FormData()
      formDataToSend.append("FirstName", firstName)
      formDataToSend.append("LastName", lastName)
      formDataToSend.append("Email", email)
      formDataToSend.append("PhoneNumber", phoneNumber)
      if (formData.gender != null && formData.gender !== "") {
        formDataToSend.append("Gender", String(formData.gender).trim())
      }
      if (formData.profileImage) {
        formDataToSend.append("Photo", formData.profileImage)
      }

      const response = await userService.updateProfile(formDataToSend)

      if (response.isSuccess) {
        setSuccess("Profile updated successfully!")
        const updatedUserData = response.data || {}
        const photoUrl = updatedUserData.profilePhotoUrl

        // If profile photo was updated, load the new image
        if (photoUrl && !formData.profileImagePreview) {
          if (profileImageUrl) {
            window.URL.revokeObjectURL(profileImageUrl)
          }
          await loadProfileImage(photoUrl)
        } else if (formData.profileImagePreview) {
          // Keep preview when user uploaded a new image
        }

        // Merge API response (support both camelCase and PascalCase from backend) and form values
        const updatedUser = {
          ...user,
          id: updatedUserData.id ?? user?.id,
          guid: updatedUserData.guid ?? user?.guid,
          username:
            updatedUserData.username ?? updatedUserData.userName ?? updatedUserData.loginName ?? resolvedUsername,
          firstName: updatedUserData.firstName ?? updatedUserData.FirstName ?? firstName,
          lastName: updatedUserData.lastName ?? updatedUserData.LastName ?? lastName,
          email: updatedUserData.email ?? updatedUserData.Email ?? email,
          phone: updatedUserData.phoneNumber ?? updatedUserData.PhoneNumber ?? phoneNumber,
          phoneNumber: updatedUserData.phoneNumber ?? updatedUserData.PhoneNumber ?? phoneNumber,
          profilePhotoUrl: photoUrl ?? updatedUserData.profilePhotoUrl ?? user?.profilePhotoUrl,
          profilePhotoName: updatedUserData.profilePhotoName ?? user?.profilePhotoName,
          roleName: updatedUserData.roleName ?? updatedUserData.RoleName ?? user?.roleName,
          roleGuid: updatedUserData.roleGuid ?? user?.roleGuid,
          isActive: updatedUserData.isActive ?? user?.isActive,
        }
        authService.storeAuthData(authService.getToken(), updatedUser, authService.getMenu())
        setUser(updatedUser)
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("profileUpdated", { detail: { user: updatedUser } }))
        }
        setFormData((prev) => ({
          ...prev,
          profileImage: null,
        }))
        // Close modal after a short delay
        setTimeout(() => {
          onClose()
          setSuccess("")
        }, 1500)
      } else {
        // Handle API validation errors
        if (response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
          const apiErrors = {}
          Object.keys(response.data).forEach((key) => {
            const fieldName = key.charAt(0).toLowerCase() + key.slice(1)
            if (Array.isArray(response.data[key])) {
              apiErrors[fieldName] = response.data[key][0]
            } else {
              apiErrors[fieldName] = response.data[key]
            }
          })
          if (Object.keys(apiErrors).length > 0) {
            setErrors(apiErrors)
            setError("Please correct the errors below.")
          } else {
            setError(response.message || "Failed to update profile")
          }
        } else {
          setError(response.message || "Failed to update profile")
        }
      }
    } catch (error) {
      console.error("Error updating profile:", error)
      setError("Failed to update profile. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto z-[100] bg-white shadow-2xl border-0">
        <DialogHeader>
          <DialogTitle>User Profile</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-14 w-14 rounded-full bg-slate-200/80" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-36 bg-slate-200/80" />
                <Skeleton className="h-3.5 w-28 bg-slate-200/70" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Skeleton className="h-10 w-full rounded-lg bg-slate-200/70" />
              <Skeleton className="h-10 w-full rounded-lg bg-slate-200/70" />
              <Skeleton className="h-10 w-full rounded-lg bg-slate-200/70" />
              <Skeleton className="h-10 w-full rounded-lg bg-slate-200/70" />
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                {success}
              </div>
            )}

            {/* Profile Image Section */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Photo</label>
              <div className="flex items-center gap-4">
                <div className="relative">
                  {formData.profileImagePreview || profileImageUrl ? (
                    <div className="relative">
                      <img
                        src={formData.profileImagePreview || profileImageUrl}
                        alt="Profile"
                        className="w-24 h-24 rounded-full object-cover border-2 border-emerald-100 shadow-md"
                        onError={(e) => {
                          // Fallback if image fails to load
                          console.warn("Profile image failed to load, showing default avatar", {
                            src: e.target.src,
                            profileImagePreview: formData.profileImagePreview,
                            profileImageUrl: profileImageUrl,
                          })
                          e.target.style.display = 'none'
                          const fallback = e.target.nextElementSibling
                          if (fallback) {
                            fallback.classList.remove('hidden')
                          }
                          // Clear the failed URL
                          if (profileImageUrl && !formData.profileImagePreview) {
                            setProfileImageUrl(null)
                          }
                        }}
                        onLoad={(e) => {
                          // Image loaded successfully
                          const fallback = e.target.nextElementSibling
                          if (fallback) {
                            fallback.classList.add('hidden')
                          }
                        }}
                      />
                      <div className="hidden w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center border-2 border-emerald-100 shadow-md">
                        <User className="w-12 h-12 text-white" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center border-2 border-emerald-100 shadow-md">
                      <User className="w-12 h-12 text-white" />
                    </div>
                  )}
                </div>
                <div>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer shadow-md">
                    <Upload className="w-3.5 h-3.5" />
                    {formData.profileImagePreview ? "Change Photo" : "Upload Photo"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                  <p className="text-xs text-slate-500 mt-1">JPG, PNG or GIF. Max size 5MB</p>
                </div>
              </div>
            </div>

            {/* Personal Information */}
            <div className="space-y-3">
              {/* Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange("firstName", e.target.value)}
                    className={`w-full px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      errors.firstName ? "border-red-500" : "border-slate-300"
                    }`}
                    placeholder="Enter first name"
                    maxLength={100}
                  />
                  {errors.firstName && (
                    <p className="text-red-500 text-xs mt-0.5">{errors.firstName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange("lastName", e.target.value)}
                    className={`w-full px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      errors.lastName ? "border-red-500" : "border-slate-300"
                    }`}
                    placeholder="Enter last name"
                    maxLength={100}
                  />
                  {errors.lastName && (
                    <p className="text-red-500 text-xs mt-0.5">{errors.lastName}</p>
                  )}
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Phone Number *
                </label>
                <div className="relative">
                  <Phone className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => {
                      let value = e.target.value.replace(/\D/g, '')
                      // Remove "91" prefix if present at the start
                      if (value.startsWith('91') && value.length > 10) {
                        value = value.substring(2)
                      }
                      // Limit to 10 digits
                      value = value.slice(0, 10)
                      handleInputChange("phoneNumber", value)
                    }}
                    className={`w-full pl-9 pr-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      errors.phoneNumber ? "border-red-500" : "border-slate-300"
                    }`}
                    placeholder="Enter 10-digit phone number"
                    maxLength={10}
                  />
                </div>
                {errors.phoneNumber && (
                  <p className="text-red-500 text-xs mt-0.5">{errors.phoneNumber}</p>
                )}
                {formData.phoneNumber && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formData.phoneNumber.length} / 10 digits
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    pattern="[a-zA-Z0-9._+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}"
                    title="e.g. user@domain.com or first.last@example.com"
                    className={`w-full pl-9 pr-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      errors.email ? "border-red-500" : "border-slate-300"
                    }`}
                    placeholder="e.g. first.last@example.com"
                  />
                </div>
                {errors.email && (
                  <p className="text-red-500 text-xs mt-0.5">{errors.email}</p>
                )}
              </div>
            </div>

            {/* Read-only Information */}
            <div className="pt-3 border-t border-slate-200">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Role</label>
                <div className="px-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
                  {formData.roleName || "N/A"}
                </div>
              </div>
            </div>

            {/* Change Password */}
            <div className="pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  if (!showChangePassword) {
                    setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
                    setPasswordError("")
                    setPasswordSuccess("")
                    setPasswordErrors({})
                  }
                  setShowChangePassword((prev) => !prev)
                }}
                className="flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700"
              >
                <Lock className="w-4 h-4" />
                {showChangePassword ? "Hide change password" : "Change password"}
                {showChangePassword ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showChangePassword && (
                <div className="mt-3 space-y-3 pl-6 border-l-2 border-emerald-100">
                  {passwordError && (
                    <p className="text-xs text-red-600">{passwordError}</p>
                  )}
                  {passwordSuccess && (
                    <p className="text-xs text-green-600">{passwordSuccess}</p>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Current password</label>
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => handlePasswordFieldChange("currentPassword", e.target.value)}
                      className={`password-input-custom-toggle w-full rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                        passwordErrors.currentPassword ? "border-red-500" : "border-slate-300"
                      }`}
                      placeholder="Enter current password"
                      autoComplete="current-password"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                    {passwordErrors.currentPassword && (
                      <p className="text-red-500 text-xs mt-0.5">{passwordErrors.currentPassword}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">New password</label>
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => handlePasswordFieldChange("newPassword", e.target.value)}
                      className={`password-input-custom-toggle w-full rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                        passwordErrors.newPassword ? "border-red-500" : "border-slate-300"
                      }`}
                      placeholder="At least 6 characters"
                      autoComplete="new-password"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                    {passwordErrors.newPassword && (
                      <p className="text-red-500 text-xs mt-0.5">{passwordErrors.newPassword}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Confirm new password</label>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => handlePasswordFieldChange("confirmPassword", e.target.value)}
                      className={`password-input-custom-toggle w-full rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                        passwordErrors.confirmPassword ? "border-red-500" : "border-slate-300"
                      }`}
                      placeholder="Re-enter new password"
                      autoComplete="new-password"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                    {passwordErrors.confirmPassword && (
                      <p className="text-red-500 text-xs mt-0.5">{passwordErrors.confirmPassword}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleChangePassword}
                    disabled={changingPassword}
                    className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {changingPassword ? "Updating..." : "Update password"}
                  </button>
                </div>
              )}
            </div>

            <DialogFooter>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 text-sm text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

