"use client"

import { cn } from "@/lib/utils"

/** Diagonal light sweep on hover — Mac-style glass highlight. */
export default function GlassSheen({ className, active = false }) {
  return (
    <span
      className={cn("pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]", className)}
      aria-hidden
    >
      <span
        className={cn(
          "absolute -left-[60%] top-[-40%] h-[180%] w-[42%] -rotate-[32deg]",
          "bg-gradient-to-b from-transparent via-white/70 to-transparent",
          "opacity-0 transition-[left,opacity] duration-700 ease-out",
          active ? "left-[130%] opacity-90" : "group-hover:left-[130%] group-hover:opacity-90",
        )}
      />
      <span
        className={cn(
          "absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/30",
          "opacity-60 transition-opacity duration-500",
          active ? "opacity-100" : "group-hover:opacity-100",
        )}
      />
    </span>
  )
}
