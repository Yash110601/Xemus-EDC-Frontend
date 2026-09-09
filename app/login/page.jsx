import LoginFormShell from "./login-form-shell"
import LoginBrandAside from "@/components/login/login-brand-aside"
import { APP_BRANDING } from "@/lib/config/appBranding"
import { LOGIN_FORM_INNER_CLASS, LOGIN_FORM_PANEL_CLASS, LOGIN_PAGE_CLASS } from "@/lib/login/loginUi"

export const metadata = {
  title: `Sign In - ${APP_BRANDING.productName}`,
  description: `Sign in to your ${APP_BRANDING.productName} ${APP_BRANDING.platformDescription} workspace`,
}

export default function LoginPage() {
  return (
    <div className={LOGIN_PAGE_CLASS}>
      <LoginBrandAside />

      <main className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-white lg:w-[48%] xl:w-[46%]">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-slate-100 lg:block" aria-hidden />
        <div className={LOGIN_FORM_PANEL_CLASS}>
          <div className={LOGIN_FORM_INNER_CLASS}>
            <LoginFormShell />
          </div>
        </div>
      </main>
    </div>
  )
}
