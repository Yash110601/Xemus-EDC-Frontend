"use client"

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

/** Dashboard header — greeting hero, optional study identity strip, then KPI strip. */
export default function DashboardCommandHero({
  greeting,
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
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  const hasStudyPanel = Boolean(studySiteInfo)
  const avatarInitials = initialsFromName(displayName)

  const resourceDocuments = Array.isArray(documentResources?.documents)
    ? documentResources.documents
    : Array.isArray(documentResources?.Documents)
      ? documentResources.Documents
      : []
  const demoVideoUrl = documentResources?.demoVideoUrl ?? documentResources?.DemoVideoUrl ?? ""

  const greetingRow = (
    <div
      className={cn(
        "relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between",
        hasStudyPanel && "px-5 pb-5 pt-6 sm:px-8 sm:pb-6 sm:pt-7 md:px-[34px]",
        !hasStudyPanel && "px-5 py-6 sm:px-8 md:px-[34px]",
      )}
    >
      <div className="min-w-0">
        <p className="mb-3.5 inline-flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.16em] text-[#047857]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#0E9F6E] shadow-[0_0_0_3px_#E7F6EF]" aria-hidden />
          Clinical Operations
        </p>
        <h1 className="text-[clamp(1.625rem,3.4vw,2.125rem)] font-bold leading-tight tracking-tight text-[#0F1B17]">
          {greeting}, {displayName}{" "}
          <span className="novera-dashboard-wave inline-block" aria-hidden>
            👋
          </span>
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          {roleName ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E7F6EF] bg-[#F1FAF5] px-2.5 py-1 text-[12.5px] font-semibold text-[#047857]">
              <Shield className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} aria-hidden />
              {roleName}
            </span>
          ) : null}
          {roleName ? <span className="text-[#C8D2CE]" aria-hidden>·</span> : null}
          <span className="text-[13.5px] font-medium text-[#7C8B85]">{today}</span>
        </div>
        {!hasStudyPanel && studyTitle ? (
          <p className="mt-3 text-sm text-[#7C8B85]">
            <span className="font-semibold text-[#0F1B17]">Study</span>
            <span className="mx-1.5 text-[#C8D2CE]">·</span>
            <span>{studyTitle}</span>
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-3.5 sm:ml-4">
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#CFEFDF] bg-[#E7F6EF] px-3 py-1.5 text-xs font-semibold tracking-wide text-[#047857]">
          <span className="relative h-1.5 w-1.5 rounded-full bg-[#0E9F6E]" aria-hidden>
            <span className="novera-dashboard-live-pulse absolute inset-[-4px] rounded-full border-2 border-[#0E9F6E] opacity-50" />
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
                "inline-flex h-10 min-w-10 items-center justify-center gap-2 rounded-xl border border-[#E5EBE9] bg-white px-2.5 text-[#475A53] transition-all duration-200",
                "hover:-translate-y-px hover:border-[#CFEFDF] hover:bg-[#F1FAF5] hover:text-[#047857]",
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
                <span className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-[#0E9F6E] border-t-transparent" />
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
                  className="fixed z-[9999] min-w-[200px] overflow-hidden rounded-xl border border-[#E5EBE9] bg-white py-1 shadow-xl"
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
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[#0F1B17] hover:bg-[#F1FAF5]"
                          >
                            <FileText className="h-4 w-4 shrink-0 text-[#7C8B85]" />
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
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[#0F1B17] hover:bg-[#F1FAF5]"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-[#7C8B85]" />
                        EC Letter
                      </button>
                      <button
                        type="button"
                        onClick={() => onDownloadDocument(2)}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[#0F1B17] hover:bg-[#F1FAF5]"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-[#7C8B85]" />
                        Protocol
                      </button>
                    </>
                  ) : null}
                  {demoVideoUrl ? (
                    <button
                      type="button"
                      onClick={onOpenDemoVideo}
                      className="flex w-full items-center gap-2 border-t border-[#E5EBE9] px-3 py-2.5 text-left text-sm text-[#0F1B17] hover:bg-[#F1FAF5]"
                    >
                      <Video className="h-4 w-4 shrink-0 text-red-500" />
                      Demo video (YouTube)
                    </button>
                  ) : null}
                  {showAgreementInDocuments && (
                    <button
                      type="button"
                      onClick={onDownloadAgreement}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[#0F1B17] hover:bg-[#F1FAF5]"
                    >
                      <FileCheck className="h-4 w-4 shrink-0 text-[#7C8B85]" />
                      Agreement
                    </button>
                  )}
                </div>,
                document.body,
              )}
          </div>
        )}

        <div
          className="relative flex h-[46px] w-[46px] shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-gradient-to-br from-[#12B47E] to-[#047857] text-base font-bold tracking-wide text-white shadow-[0_6px_14px_-4px_rgba(4,120,87,.5)]"
          aria-hidden={profileImageUrl ? undefined : true}
        >
          {profileImageUrl ? (
            <img src={profileImageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            avatarInitials
          )}
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-[2.5px] border-white bg-[#22C55E]" aria-hidden />
        </div>
      </div>
    </div>
  )

  return (
    <header className="novera-dashboard-header space-y-[22px]">
      {hasStudyPanel ? (
        <div className="novera-dashboard-hero relative isolate overflow-hidden rounded-[24px] border border-[#E5EBE9] bg-white shadow-[0_1px_2px_rgba(15,27,23,.04),0_12px_32px_-12px_rgba(15,27,23,.10)]">
          <span
            className="pointer-events-none absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#0E9F6E] to-[#047857]"
            aria-hidden
          />
          <span
            className="pointer-events-none absolute -right-20 -top-[120px] z-0 h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,rgba(14,159,110,0.10),transparent_68%)]"
            aria-hidden
          />
          <div className="relative z-[1]">
            {greetingRow}
            {studySiteInfo}
          </div>
        </div>
      ) : (
        <div className="novera-dashboard-hero relative isolate overflow-hidden rounded-[24px] border border-[#E5EBE9] bg-white shadow-[0_1px_2px_rgba(15,27,23,.04),0_12px_32px_-12px_rgba(15,27,23,.10)]">
          <span
            className="pointer-events-none absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#0E9F6E] to-[#047857]"
            aria-hidden
          />
          <span
            className="pointer-events-none absolute -right-20 -top-[120px] z-0 h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,rgba(14,159,110,0.10),transparent_68%)]"
            aria-hidden
          />
          <div className="relative z-[1]">{greetingRow}</div>
        </div>
      )}

      {children ? <div className="novera-dashboard-metric-strip">{children}</div> : null}
    </header>
  )
}
