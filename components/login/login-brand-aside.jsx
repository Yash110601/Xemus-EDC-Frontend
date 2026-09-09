import { APP_BRANDING } from "@/lib/config/appBranding"
import { XemusWordmark } from "@/components/brand-logo"
import { LOGIN_PANEL_PADDING_X } from "@/lib/login/loginUi"
import { cn } from "@/lib/utils"

/**
 * Full-bleed brand stage — the visual hero of the sign-in experience.
 */
export default function LoginBrandAside() {
  return (
    <aside
      className="login-brand-stage relative hidden h-full w-[52%] shrink-0 overflow-hidden lg:flex xl:w-[54%]"
      aria-label={`${APP_BRANDING.productName} brand`}
    >
      <div className="login-brand-stage__media" aria-hidden="true">
        <img
          src="/images/xemus-login-atmosphere.png"
          alt=""
          className="login-brand-stage__img"
        />
        <div className="login-brand-stage__veil" />
      </div>

      <div
        className={cn(
          "relative z-10 flex h-full w-full flex-col justify-between",
          LOGIN_PANEL_PADDING_X,
          "py-12 xl:py-16"
        )}
      >
        <div className="login-brand-stage__top">
          <XemusWordmark
            variant="light"
            markClassName="h-10 w-10 xl:h-11 xl:w-11"
            textClassName="text-[1.9rem] xl:text-[2.1rem]"
          />
        </div>

        <div className="login-brand-stage__hero max-w-xl">
          <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-teal-200/90">
            {APP_BRANDING.productName}
          </p>
          <h2 className="mt-5 text-[2.75rem] font-semibold leading-[1.08] tracking-[-0.035em] text-white xl:text-[3.25rem]">
            Built for clinical
            <br />
            clarity.
          </h2>
          <p className="mt-6 max-w-md text-[16px] leading-relaxed text-white/72">
            A modern electronic data capture workspace for teams who need speed,
            compliance, and trust.
          </p>
        </div>

        <div className="flex items-center gap-6 text-[12px] font-medium text-white/50">
          {APP_BRANDING.complianceLabels.slice(0, 3).map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      </div>
    </aside>
  )
}
