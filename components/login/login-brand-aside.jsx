import { APP_BRANDING } from "@/lib/config/appBranding"
import { XemusWordmark } from "@/components/brand-logo"
import { LOGIN_PANEL_PADDING_X } from "@/lib/login/loginUi"
import { cn } from "@/lib/utils"

/**
 * Soft lavender brand stage — visual hero of the sign-in experience.
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
        <div
          className="pointer-events-none absolute -left-16 top-16 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(167,139,250,0.28),transparent_68%)] blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 right-0 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(124,107,181,0.32),transparent_70%)] blur-2xl"
          aria-hidden
        />
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
          <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#e9e0ff] backdrop-blur-md">
            Electronic Data Capture
          </p>
          <h2 className="mt-6 text-[2.65rem] font-semibold leading-[1.08] tracking-[-0.035em] text-white xl:text-[3.1rem]">
            One workspace
            <br />
            for every visit.
          </h2>
          <p className="mt-6 max-w-md text-[16px] leading-relaxed text-white/75">
            Capture, review, and oversee study data with a calm lavender interface built for clinical teams.
          </p>
          <div className="mt-8 grid max-w-md gap-3 sm:grid-cols-2">
            {APP_BRANDING.features.slice(0, 2).map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-md"
              >
                <p className="text-[13px] font-semibold text-white">{feature.title}</p>
                <p className="mt-1 text-[12px] leading-snug text-white/65">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] font-medium text-white/55">
          {APP_BRANDING.complianceLabels.slice(0, 3).map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      </div>
    </aside>
  )
}
