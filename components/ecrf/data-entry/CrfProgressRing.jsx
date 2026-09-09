"use client"

import { cn } from "@/lib/utils"
import { getCrfProgressTone, normalizeCrfProgress } from "@/lib/utils/crfProgress"

const RING_COLORS = {
  completed: { stroke: "#10b981", track: "rgba(16,185,129,0.18)" },
  inProgress: { stroke: "#14b8a6", track: "rgba(20,184,166,0.16)" },
  notStarted: { stroke: "#94a3b8", track: "rgba(148,163,184,0.22)" },
}

const SIZE_MAP = {
  xs: { box: 36, stroke: 3, font: "text-[9px]" },
  sm: { box: 44, stroke: 3.5, font: "text-[10px]" },
  md: { box: 56, stroke: 4, font: "text-xs" },
  lg: { box: 72, stroke: 5, font: "text-sm" },
}

/**
 * Circular CRF completion gauge (0–100%).
 * @param {"xs"|"sm"|"md"|"lg"} size
 */
export default function CrfProgressRing({
  progress,
  size = "sm",
  inverted = false,
  showLabel = true,
  className,
  labelClassName,
}) {
  const normalized = normalizeCrfProgress(progress)
  const tone = getCrfProgressTone(normalized)
  const colors = RING_COLORS[tone]
  const spec = SIZE_MAP[size] || SIZE_MAP.sm

  const radius = (spec.box - spec.stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (normalized.progressPercent / 100) * circumference

  return (
    <div
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: spec.box, height: spec.box }}
      role="img"
      aria-label={`CRF progress ${normalized.progressPercent} percent`}
    >
      <svg width={spec.box} height={spec.box} className="-rotate-90">
        <circle
          cx={spec.box / 2}
          cy={spec.box / 2}
          r={radius}
          fill="none"
          stroke={inverted ? "rgba(255,255,255,0.25)" : colors.track}
          strokeWidth={spec.stroke}
        />
        <circle
          cx={spec.box / 2}
          cy={spec.box / 2}
          r={radius}
          fill="none"
          stroke={inverted ? "#ffffff" : colors.stroke}
          strokeWidth={spec.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      {showLabel ? (
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center font-bold tabular-nums leading-none",
            spec.font,
            inverted ? "text-white" : "text-slate-800",
            labelClassName,
          )}
        >
          {normalized.progressPercent}%
        </span>
      ) : null}
    </div>
  )
}
