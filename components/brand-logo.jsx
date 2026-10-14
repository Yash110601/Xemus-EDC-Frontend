import { cn } from "@/lib/utils"
import { APP_BRANDING } from "@/lib/config/appBranding"

const HEIGHT = {
  xs: "h-7",
  sm: "h-9",
  md: "h-11",
  lg: "h-14",
  xl: "h-[4.25rem]",
  card: "h-[3.75rem]",
}

/** Xemus mark (inline SVG — crisp at any size). */
export function XemusMark({ className, variant = "color" }) {
  const fill = variant === "light" ? "#E8F7F5" : "#0F2744"
  const ink = variant === "light" ? "#0F2744" : "#FFFFFF"
  const accent = variant === "light" ? "#0D9488" : "#14B8A6"

  return (
    <svg viewBox="0 0 80 80" fill="none" className={className} aria-hidden="true">
      <rect x="4" y="4" width="72" height="72" rx="18" fill={fill} />
      <path d="M4 58h72v4a18 18 0 0 1-18 18H22A18 18 0 0 1 4 62v-4z" fill={accent} />
      <text
        x="40"
        y="50"
        textAnchor="middle"
        fill={ink}
        fontFamily="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
        fontSize="15"
        fontWeight="800"
        letterSpacing="-0.04em"
      >
        Xemus
      </text>
    </svg>
  )
}

/** Full lockup: Xemus mark + Xemus wordmark. */
export function XemusWordmark({ className, variant = "color", markClassName, textClassName }) {
  const textColor = variant === "light" ? "text-white" : "text-[#0F2744]"

  return (
    <div className={cn("inline-flex items-center gap-2.5", className)} role="img" aria-label="Xemus">
      <XemusMark variant={variant} className={cn("h-9 w-9 shrink-0 sm:h-10 sm:w-10", markClassName)} />
      <span
        className={cn(
          "text-[1.65rem] font-bold leading-none tracking-[-0.045em] sm:text-[1.85rem]",
          textColor,
          textClassName,
        )}
      >
        Xemus
      </span>
    </div>
  )
}

/** App chrome logo (sidebar etc). */
export function BrandLogo({ size = "md", className, imgClassName, blendOnLight = false, src, ...props }) {
  if (src) {
    return (
      <img
        src={src}
        alt={APP_BRANDING.logoAlt}
        className={cn(
          "w-auto max-w-full object-contain object-left",
          HEIGHT[size] ?? HEIGHT.md,
          blendOnLight && "login-brand-logo__img",
          className,
          imgClassName,
        )}
        {...props}
      />
    )
  }

  return <XemusWordmark className={className} />
}

export function BrandMark({ size = "md", className }) {
  return <XemusMark className={cn("aspect-square", HEIGHT[size] ?? HEIGHT.md, className)} />
}

export function BrandWordmark({ showTagline = false, className, light = false }) {
  return (
    <div className={cn("flex flex-col", className)}>
      <XemusWordmark variant={light ? "light" : "color"} />
      {showTagline ? (
        <span className={cn("mt-1 text-xs", light ? "text-slate-400" : "text-slate-500")}>
          {APP_BRANDING.tagline}
        </span>
      ) : null}
    </div>
  )
}

/** Login lockup. */
export function BrandLoginLockup({ className, variant = "color" }) {
  return (
    <div className={cn("login-brand-logo", className)}>
      <XemusWordmark variant={variant} />
    </div>
  )
}
