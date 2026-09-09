"use client"

import Link from "next/link"
import { Loader2, Settings2, Sparkles } from "lucide-react"
import DashboardLayout from "@/components/dashboard-layout"
import AiMonitoringSummaryCard from "@/components/intelligence/AiMonitoringSummaryCard"
import IntelligenceHubModuleCard from "@/components/intelligence/IntelligenceHubModuleCard"
import { useStudySiteContext } from "@/hooks/useStudySiteContext"
import { useStudyAiSettingsForStudy } from "@/lib/intelligence/useStudyAiSettings"
import { INTELLIGENCE_HUB_MODULES, isAiModuleEnabled } from "@/lib/intelligence/xemusIntelligence"
import {
  REPORT_CARD_CLASS,
  REPORT_HEADER_ICON_WRAP_CLASS,
  REPORT_PAGE_SHELL_CLASS,
} from "@/lib/reports/studySitePatientReportUi"

export default function XemusIntelligencePage() {
  const { studyId, siteId } = useStudySiteContext()
  const { loading, settings } = useStudyAiSettingsForStudy(studyId)
  const isXemusIntelligenceEnabled = Boolean(settings.isXemusIntelligenceEnabled)
  const isAiInsightEnabled = isAiModuleEnabled(settings, "isAiInsightEnabled")

  return (
    <DashboardLayout>
      <div className={REPORT_PAGE_SHELL_CLASS}>
        <div className="mb-5 flex items-start gap-3">
          <div className={REPORT_HEADER_ICON_WRAP_CLASS}>
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-slate-800 sm:text-2xl">YP Intelligence</h1>
            <p className="mt-1 text-sm text-slate-500">
              Governed AI layer — suggest only. Humans confirm; every action is audit-logged.
            </p>
          </div>
          <Link
            href="/study-management/study-settings"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50"
          >
            <Settings2 className="h-4 w-4" />
            Study settings
          </Link>
        </div>

        {!studyId ? (
          <div className={`${REPORT_CARD_CLASS} p-6 text-sm text-slate-600`}>
            Select a study in the workspace header to see which Intelligence modules are enabled.
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading study Intelligence flags…
          </div>
        ) : (
          <div className="space-y-5">
            <div className={`${REPORT_CARD_CLASS} p-4 sm:p-5`}>
              <p className="text-sm font-medium text-slate-900">
                {isXemusIntelligenceEnabled
                  ? "Master switch is on for this study."
                  : "Master switch is off — enable YP Intelligence under Study settings."}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Sub-modules stay off until you turn them on. AI never auto-submits CRFs, queries, or SDV marks.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {INTELLIGENCE_HUB_MODULES.map((mod) => (
                <IntelligenceHubModuleCard
                  key={mod.module}
                  title={mod.title}
                  description={mod.description}
                  href={mod.href}
                  enabled={Boolean(isXemusIntelligenceEnabled && settings[mod.key])}
                />
              ))}
            </div>

            <Link
              href="/reports/ai-oversight-report"
              className={`${REPORT_CARD_CLASS} flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50 sm:px-5`}
            >
              AI Oversight Report
              <span className="text-xs font-normal text-slate-500">Accept / reject audit across modules</span>
            </Link>

            {isAiInsightEnabled ? (
              <AiMonitoringSummaryCard studyId={studyId} siteId={siteId} enabled />
            ) : null}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
