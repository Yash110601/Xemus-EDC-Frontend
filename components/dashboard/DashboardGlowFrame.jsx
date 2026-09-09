"use client"

import { cn } from "@/lib/utils"

/**
 * Rounded panel with light border; hover/active shows spinning multicolor edge glow.
 */
export default function DashboardGlowFrame({
  children,
  className,
  innerClassName,
  as: Component = "div",
  interactive = false,
  active = false,
  accent = "emerald",
  ...props
}) {
  return (
    <Component
      className={cn(
        "novera-glow-frame group relative rounded-2xl",
        `novera-glow-frame--${accent}`,
        active && "novera-glow-frame--active",
        interactive &&
          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-300/80",
        className
      )}
      {...props}
    >
      <span className="novera-glow-frame__ring" aria-hidden="true" />
      <div
        className={cn(
          "novera-glow-frame__inner relative h-full rounded-[calc(1rem-1px)] border border-slate-200/75 bg-white/95",
          "transition-[transform,box-shadow,border-color,background] duration-300 ease-out",
          !active && "group-hover:-translate-y-1 group-hover:border-slate-200",
          !active && "group-hover:shadow-[0_18px_44px_-22px_rgba(15,23,42,0.12)]",
          active && "novera-glow-frame__inner--active -translate-y-1 shadow-[0_20px_48px_-20px_rgba(15,23,42,0.14)]",
          interactive && "group-active:translate-y-0 group-active:scale-[0.99]",
          innerClassName
        )}
      >
        {children}
      </div>
    </Component>
  )
}
