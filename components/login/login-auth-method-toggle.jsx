"use client"

import { KeyRound, Smartphone } from "lucide-react"
import {
  LOGIN_AUTH_TOGGLE_ACTIVE,
  LOGIN_AUTH_TOGGLE_IDLE,
  LOGIN_AUTH_TOGGLE_WRAP,
} from "@/lib/login/loginUi"
import { cn } from "@/lib/utils"

export default function LoginAuthMethodToggle({ value, onChange, disabled = false }) {
  return (
    <div className={LOGIN_AUTH_TOGGLE_WRAP} role="tablist" aria-label="Sign-in method">
      <button
        type="button"
        role="tab"
        aria-selected={value === "password"}
        disabled={disabled}
        onClick={() => onChange("password")}
        className={cn(value === "password" ? LOGIN_AUTH_TOGGLE_ACTIVE : LOGIN_AUTH_TOGGLE_IDLE)}
      >
        <KeyRound className={cn("h-4 w-4", value === "password" ? "text-emerald-600" : "text-slate-400")} aria-hidden />
        Password
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "otp"}
        disabled={disabled}
        onClick={() => onChange("otp")}
        className={cn(value === "otp" ? LOGIN_AUTH_TOGGLE_ACTIVE : LOGIN_AUTH_TOGGLE_IDLE)}
      >
        <Smartphone className={cn("h-4 w-4", value === "otp" ? "text-emerald-600" : "text-slate-400")} aria-hidden />
        OTP
      </button>
    </div>
  )
}
