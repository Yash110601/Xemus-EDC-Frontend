"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import {
  Download,
  ChevronDown,
  FileText,
  FileCheck,
  Shield,
  Video,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"

function initialsFromName(name) {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return "U"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
}

function formatToday() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

/** Dashboard header — overview bar, optional study identity strip, then KPI strip. */
export default function DashboardCommandHero({
  displayName,
  roleName,
  studyTitle,
  profileImageUrl,
  canShowDocuments,
  downloadDocLoading,
  downloadDropdownOpen,
  setDownloadDropdownOpen,
  downloadButtonRef,
  downloadDropdownPosition,
  getSelectedStudyId,
  onDownloadDocument,
  onDownloadResource,
  onOpenDemoVideo,
  documentResources,
  loadingDocumentResources,
  onDownloadAgreement,
  showAgreementInDocuments,
  studySiteInfo,
  children,
}) {
  // Avoid SSR/client locale mismatch on the date label.
  const [today, setToday] = useState("")
  useEffect(() => {
    setToday(formatToday())
  }, [])

  const hasStudyPanel = Boolean(studySiteInfo)
  const avatarInitials = initialsFromName(displayName)

  const resourceDocuments = Array.isArray(documentResources?.documents)
    ? documentResources.documents
    : Array.isArray(documentResources?.Documents)
      ? documentResources.Documents
      : []
  const demoVideoUrl = documentResources?.demoVideoUrl ?? documentResources?.DemoVideoUrl ?? ""

  const headerRow = (
    <div
      className={cn(
        "relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between",
        hasStudyPanel && "px-5 pb-5 pt-6 sm:px-7 sm:pb-5 sm:pt-7 md:px-8",
        !hasStudyPanel && "px-5 py-6 sm:px-7 md:px-8",
      )}
    >
      <div className="min-w-0">
        <p className="mb-2 inline-flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[#8B7BA8]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#7C6BB5] shadow-[0_0_0_3px_rgba(124,107,181,0.18)]" aria-hidden />
          Study workspace
        </p>
        <h1 className="text-[clamp(1.65rem,3.2vw,2.05rem)] font-bold leading-[1.1] tracking-[-0.03em] text-[#2D1C4E]">
          Overview
        </h1>
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          {displayName ? (
            <span className="text-[14px] font-semibold text-[#2D1C4E]">{displayName}</span>
          ) : null}
          {roleName ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E4DCF2]/90 bg-white/70 px-2.5 py-1 text-[11.5px] font-semibold text-[#5B4B8A] shadow-[0_1px_0_rgba(255,255,255,.7)_inset]">
              <Shield className="h-3.5 w-3.5 shrink-0 text-[#7C6BB5]" strokeWidth={2.2} aria-hidden />
              {roleName}
            </span>
          ) : null}
          {today ? (
            <span className="text-[12.5px] font-medium text-[#8B7BA8]">{today}</span>
          ) : (
            <span className="inline-block h-3.5 w-24 rounded bg-[#EDE7F6]/80" aria-hidden />
          )}
        </div>
        {!hasStudyPanel && studyTitle ? (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#7C6F96]">
            <span className="font-semibold text-[#2D1C4E]">Study</span>
            <span className="mx-1.5 text-[#C9BEDC]">·</span>
            <span>{studyTitle}</span>
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-3 sm:ml-4 sm:pt-1">
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#E4DCF2] bg-white/75 px-3 py-1.5 text-[11.5px] font-semibold tracking-wide text-[#5B4B8A] shadow-[0_1px_0_rgba(255,255,255,.8)_inset]">
          <span className="relative h-1.5 w-1.5 rounded-full bg-[#7C6BB5]" aria-hidden>
            <span className="novera-dashboard-live-pulse absolute inset-[-4px] rounded-full border-2 border-[#7C6BB5] opacity-50" />
          </span>
          Active
        </span>

        {canShowDocuments && (
          <div className="relative">
            <button
              ref={downloadButtonRef}
              type="button"
              onClick={() => getSelectedStudyId() && !downloadDocLoading && setDownloadDropdownOpen((o) => !o)}
              disabled={downloadDocLoading || !getSelectedStudyId()}
              className={cn(
                "inline-flex h-10 min-w-10 items-center justify-center gap-2 rounded-2xl border border-[#E4DCF2] bg-white/90 px-2.5 text-[#5B4B8A] shadow-sm transition-all duration-200",
                "hover:-translate-y-px hover:border-[#D9CFEC] hover:bg-[#F7F4FC]",
                "disabled:cursor-not-allowed disabled:opacity-50 sm:px-3",
              )}
              title={
                getSelectedStudyId()
                  ? "Study manuals, protocol, EC letter, demo video"
                  : "Select a study to view documents"
              }
              aria-label="Study documents"
            >
              {downloadDocLoading ? (
                <span className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-[#7C6BB5] border-t-transparent" />
              ) : (
                <>
                  <Download className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                  <span className="hidden text-sm font-medium sm:inline">Documents</span>
                  <ChevronDown className="hidden h-3.5 w-3.5 opacity-50 sm:inline" />
                </>
              )}
            </button>
            {downloadDropdownOpen &&
              getSelectedStudyId() &&
              downloadDropdownPosition &&
              typeof document !== "undefined" &&
              createPortal(
                <div
                  data-download-dropdown
                  className="fixed z-[9999] min-w-[200px] overflow-hidden rounded-2xl border border-[#E4DCF2] bg-white py-1 shadow-xl"
                  style={{
                    top: downloadDropdownPosition.top,
                    left: downloadDropdownPosition.left,
                  }}
                >
                  {loadingDocumentResources ? (
                    <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading…
                    </div>
                  ) : null}
                  {!loadingDocumentResources && resourceDocuments.length > 0
                    ? resourceDocuments.map((doc) => {
                        const id = doc.id ?? doc.Id
                        const label = doc.displayName ?? doc.DisplayName ?? "Document"
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => onDownloadResource?.(id)}
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[#2D1C4E] hover:bg-[#F7F4FC]"
                          >
                            <FileText className="h-4 w-4 shrink-0 text-[#7C6F96]" />
                            {label}
                          </button>
                        )
                      })
                    : null}
                  {!loadingDocumentResources && resourceDocuments.length === 0 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onDownloadDocument(1)}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[#2D1C4E] hover:bg-[#F7F4FC]"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-[#7C6F96]" />
                        EC Letter
                      </button>
                      <button
                        type="button"
                        onClick={() => onDownloadDocument(2)}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[#2D1C4E] hover:bg-[#F7F4FC]"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-[#7C6F96]" />
                        Protocol
                      </button>
                    </>
                  ) : null}
                  {demoVideoUrl ? (
                    <button
                      type="button"
                      onClick={onOpenDemoVideo}
                      className="flex w-full items-center gap-2 border-t border-[#E4DCF2] px-3 py-2.5 text-left text-sm text-[#2D1C4E] hover:bg-[#F7F4FC]"
                    >
                      <Video className="h-4 w-4 shrink-0 text-red-500" />
                      Demo video (YouTube)
                    </button>
                  ) : null}
                  {showAgreementInDocuments && (
                    <button
                      type="button"
                      onClick={onDownloadAgreement}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[#2D1C4E] hover:bg-[#F7F4FC]"
                    >
                      <FileCheck className="h-4 w-4 shrink-0 text-[#7C6F96]" />
                      Agreement
                    </button>
                  )}
                </div>,
                document.body,
              )}
          </div>
        )}

        <div
          className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#8B7BB8] to-[#3D2F63] text-[13px] font-bold tracking-wide text-white shadow-[0_8px_18px_-6px_rgba(61,47,99,.55)]"
          aria-hidden={profileImageUrl ? undefined : true}
        >
          {profileImageUrl ? (
            <img src={profileImageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            avatarInitials
          )}
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-[2.5px] border-white bg-[#7C6BB5]" aria-hidden />
        </div>
      </div>
    </div>
  )

  const heroShellClass =
    "novera-dashboard-hero relative isolate overflow-hidden rounded-[26px] border border-[#E4DCF2]/95 bg-gradient-to-br from-white via-[#FCFBFE] to-[#F3EEF9] shadow-[0_1px_2px_rgba(45,28,78,.03),0_18px_40px_-24px_rgba(61,47,99,.28)]"

  return (
    <header className="novera-dashboard-header space-y-[22px]">
      <div className={heroShellClass}>
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#EDE7F6]/55 to-transparent"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute -right-16 -top-24 z-0 h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,rgba(124,107,181,0.16),transparent_68%)]"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute -bottom-20 -left-10 z-0 h-[220px] w-[220px] rounded-full bg-[radial-gradient(circle,rgba(157,135,199,0.12),transparent_70%)]"
          aria-hidden
        />
        <div className="relative z-[1]">
          {headerRow}
          {hasStudyPanel ? studySiteInfo : null}
        </div>
      </div>

      {children ? <div className="novera-dashboard-metric-strip">{children}</div> : null}
    </header>
  )
}
