import ForgotPasswordForm from "@/components/forgot-password-form"
import LoginBrandAside from "@/components/login/login-brand-aside"
import { APP_BRANDING } from "@/lib/config/appBranding"
import { LOGIN_FORM_INNER_CLASS, LOGIN_FORM_PANEL_CLASS, LOGIN_PAGE_CLASS } from "@/lib/login/loginUi"

export const metadata = {
  title: `Forgot Password - ${APP_BRANDING.productName}`,
  description: `Reset your password for your ${APP_BRANDING.productName} ${APP_BRANDING.platformDescription} account`,
}

export default function ForgotPasswordPage() {
  return (
    <div className={LOGIN_PAGE_CLASS}>
      <LoginBrandAside />

      <main className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-white lg:w-[48%] xl:w-[46%]">
        <div className={LOGIN_FORM_PANEL_CLASS}>
          <div className={LOGIN_FORM_INNER_CLASS}>
            <ForgotPasswordForm />
          </div>
        </div>
      </main>
    </div>
  )
}
