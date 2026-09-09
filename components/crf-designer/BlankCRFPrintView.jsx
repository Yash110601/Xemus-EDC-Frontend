"use client"

import { useEffect } from "react"
import CRFViewer from "./CRFViewer"

/**
 * Renders a blank CRF for print/PDF with study & CRF description, created by, and created date
 * on each page (via fixed header/footer in print media).
 */
const BlankCRFPrintView = ({ crfData, onAfterPrint }) => {
  useEffect(() => {
    const handleAfterPrint = () => {
      onAfterPrint?.()
    }
    window.addEventListener("afterprint", handleAfterPrint)
    return () => window.removeEventListener("afterprint", handleAfterPrint)
  }, [onAfterPrint])

  if (!crfData) return null

  const studyProtocol = crfData.studyProtocolNumber || crfData.study?.protocolNumber || "—"
  const crfName = crfData.config?.name || crfData.name || "Unnamed CRF"
  const crfDescription = crfData.config?.description || crfData.description || "—"
  const studyDescription = crfData.studyDescription || crfData.study?.description || ""
  const createdBy = crfData.createdBy || "—"
  const createdAt = (() => {
    if (!crfData.createdAt) return "—"
    try {
      return new Date(crfData.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    } catch {
      return String(crfData.createdAt)
    }
  })()

  return (
    <div className="bg-white">
      {/* Header: on screen shows once; in print repeats on each page via fixed */}
      <div className="p-3 border-b border-slate-200 bg-slate-50 print:fixed print:top-0 print:left-0 print:right-0 print:py-2 print:px-4 print:bg-white print:border-b print:z-[9999] print:text-[11px]">
        <div className="font-semibold text-slate-800">Study: {studyProtocol}</div>
        {studyDescription && (
          <div className="text-slate-600 mt-0.5 text-sm">{studyDescription}</div>
        )}
        <div className="font-semibold text-slate-800 mt-1">CRF: {crfName}</div>
        <div className="text-slate-600 mt-0.5 text-sm">{crfDescription}</div>
      </div>
      <div className="print:pt-24 print:pb-14">
        <CRFViewer
          crfData={crfData}
          onEdit={null}
          isPreviewMode={true}
          initialFormValues={{}}
          printMode={true}
        />
      </div>
      {/* Footer: on screen shows once; in print repeats on each page via fixed */}
      <div className="p-3 border-t border-slate-200 bg-slate-50 text-slate-600 text-sm print:fixed print:bottom-0 print:left-0 print:right-0 print:py-2 print:px-4 print:bg-white print:border-t print:z-[9999] print:text-[10px]">
        <span>Created by: {createdBy}</span>
        <span className="ml-4">Created date: {createdAt}</span>
      </div>
    </div>
  )
}

export default BlankCRFPrintView
