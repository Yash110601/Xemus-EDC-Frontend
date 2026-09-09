"use client"

import { useEffect, useState } from "react"
import { Loader2, Sparkles } from "lucide-react"
import DashboardChartSection from "@/components/dashboard/DashboardChartCard"
import xemusAiService from "@/lib/services/xemusAi.service"
import { cn } from "@/lib/utils"

/**
 * CRA monitoring copilot summary (Insight AI).
 */
export default function AiMonitoringSummaryCard({ studyId, siteId, enabled = false, className }) {
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!enabled || !studyId) {
      setSummary(null)
      return
    }
    let alive = true
    setLoading(true)
    setError("")
    xemusAiService
      .generateMonitoringSummary({
        studyId: Number(studyId),
        siteId: siteId ? Number(siteId) : undefined,
      })
      .then((res) => {
        if (!alive) return
        setSummary(res?.data ?? null)
      })
      .catch((err) => {
        if (!alive) return
        setError(err?.message || "Summary unavailable")
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [enabled, studyId, siteId])

  if (!enabled) return null

  const narrative =
    summary?.summaryText ??
    summary?.summary ??
    summary?.narrative ??
    summary?.weeklySummary ??
    (typeof summary === "string" ? summary : "")
  const sites = summary?.sitesNeedingAttention ?? summary?.attentionSites ?? []

  return (
    <DashboardChartSection
      title="CRA monitoring copilot"
      icon={Sparkles}
      className={cn("min-h-[200px]", className)}
      bodyClassName="p-4"
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500" role="status" aria-busy="true">
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating monitoring summary…
        </div>
      ) : error ? (
        <p className="text-sm text-slate-500">{error}</p>
      ) : (
        <div className="space-y-3 text-sm text-slate-700">
          {narrative ? (
            <p className="leading-relaxed whitespace-pre-wrap">{String(narrative)}</p>
          ) : (
            <p className="text-slate-500">
              Insight AI will summarize open queries, SDV/RSDV backlog, and enrollment when the backend
              endpoint is available.
            </p>
          )}
          {Array.isArray(sites) && sites.length > 0 ? (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-violet-800">
                Sites needing attention
              </p>
              <ul className="list-disc space-y-0.5 pl-4 text-xs">
                {sites.slice(0, 8).map((site, i) => (
                  <li key={typeof site === "object" ? (site.siteId ?? site.id ?? i) : i}>
                    {typeof site === "string"
                      ? site
                      : (site.siteName ?? site.name ?? site.label ?? `Site ${i + 1}`) +
                        (site.reason ? ` — ${site.reason}` : "")}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </DashboardChartSection>
  )
}
