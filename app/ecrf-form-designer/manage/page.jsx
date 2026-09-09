"use client"

import { useState, useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import DashboardLayout from "@/components/dashboard-layout"
import { APP_VIEWPORT_WORKSPACE_CLASS } from "@/lib/ui/appShellClasses"
import CRFDesigner from "@/components/crf-designer/CRFDesigner"
import CRFViewer from "@/components/crf-designer/CRFViewer"
import CRFList from "@/components/crf-designer/CRFList"
import { parseHtmlContent } from "@/components/crf-designer/parseHtmlContent"
import { buildCrfDesignerConfigFromApi } from "@/lib/utils/crfDesignerConfigFromApi"
import { buildPdfSectionsForExport } from "@/lib/utils/crfPdfSectionsBuilder"
import { getDefaultCrfOrgMeta } from "@/lib/config/orgBranding"
import { generateCrfEntryPdf } from "@/lib/utils/crfEntryPdf"
import { buildPrintedInfoFromUser } from "@/lib/utils/reportGeneratedMeta"
import { CRF_PDF_DEFAULT_LAYOUT_OPTIONS } from "@/lib/utils/crfPdfTheme"
import { authService, studyService } from "@/lib/services"
import { getCrfFormTypeDisplayLabel } from "@/lib/visitTypes"
import { useReportExportJobs } from "@/context/ReportExportJobsContext"
import { useStudySiteContext } from "@/hooks/useStudySiteContext"

export default function CRFManagePage() {
  const pathname = usePathname()
  const [mode, setMode] = useState("list") // "list", "design", "view"
  const [currentCRF, setCurrentCRF] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const prevPathnameRef = useRef(pathname)
  const deepLinkOpenedRef = useRef(false)
  const { studyId: contextStudyId, ready: contextReady } = useStudySiteContext()
  const [studyId, setStudyId] = useState(null)
  const { startReportExport } = useReportExportJobs()

  useEffect(() => {
    if (!contextReady || contextStudyId == null) return
    setStudyId((prev) => (prev == null ? contextStudyId : prev))
  }, [contextReady, contextStudyId])

  const getCrfFormTypeLabel = (crfFormType) => getCrfFormTypeDisplayLabel(crfFormType, "CRF")

  const handleCreateNew = () => {
    setCurrentCRF(null)
    setMode("design")
  }

  const handleView = async (crf) => {
    // If CRF has ID and studyId, fetch full data to ensure we have the latest structure
    if (crf.id && crf.studyId) {
      try {
        const { crfDesignService } = await import("@/lib/services")
        const response = await crfDesignService.getCrfDesignById(crf.id, crf.studyId)
        if (response.isSuccess && response.data) {
          const fullCRF = response.data
          
          // Prefer htmlContent when available so table cellLabels (e.g. Body System labels),
          // postfix, and other designer props are preserved. Else use sections from API.
          let parsedSections = []
          if (fullCRF.htmlContent) {
            parsedSections = parseHtmlContent(fullCRF.htmlContent)
          } else if (fullCRF.sections && fullCRF.sections.length > 0) {
            parsedSections = fullCRF.sections
          } else if (crf.sections && crf.sections.length > 0) {
            parsedSections = crf.sections
          }
          
          // Merge with existing crf data, prioritizing API response
          setCurrentCRF({
            ...crf,
            ...fullCRF,
            studyId: fullCRF.studyId || crf.studyId,
            crfFormType: fullCRF.crfFormType || crf.crfFormType,
            sections: parsedSections,
            config: buildCrfDesignerConfigFromApi(fullCRF, crf.config),
          })
        } else {
          // If fetch fails, try to parse sections from crf data
          let parsedSections = []
          if (crf.sections && crf.sections.length > 0) {
            parsedSections = crf.sections
          } else if (crf.htmlContent) {
            parsedSections = parseHtmlContent(crf.htmlContent)
          }
          
          setCurrentCRF({
            ...crf,
            sections: parsedSections
          })
        }
      } catch (error) {
        console.error("Error fetching CRF for view:", error)
        // If fetch fails, try to parse sections from crf data
        let parsedSections = []
        if (crf.sections && crf.sections.length > 0) {
          parsedSections = crf.sections
        } else if (crf.htmlContent) {
          parsedSections = parseHtmlContent(crf.htmlContent)
        }
        
        setCurrentCRF({
          ...crf,
          sections: parsedSections
        })
      }
    } else {
      // Parse sections if available
      let parsedSections = []
      if (crf.sections && crf.sections.length > 0) {
        parsedSections = crf.sections
      } else if (crf.htmlContent) {
        parsedSections = parseHtmlContent(crf.htmlContent)
      }
      
      setCurrentCRF({
        ...crf,
        sections: parsedSections
      })
    }
    setMode("view")
  }

  const handleEdit = async (crf) => {
    // If CRF has ID and studyId, fetch full data to ensure we have the latest structure
    if (crf.id && crf.studyId) {
      try {
        const { crfDesignService } = await import("@/lib/services")
        const response = await crfDesignService.getCrfDesignById(crf.id, crf.studyId)
        if (response.isSuccess && response.data) {
          const fullCRF = response.data
          // Prefer htmlContent so table cellLabels (Body System etc.), postfix, etc. are preserved
          let parsedSections = []
          if (fullCRF.htmlContent) {
            parsedSections = parseHtmlContent(fullCRF.htmlContent)
          } else if (fullCRF.sections && fullCRF.sections.length > 0) {
            parsedSections = fullCRF.sections
          } else if (crf.sections && crf.sections.length > 0) {
            parsedSections = crf.sections
          }
          setCurrentCRF({
            ...crf,
            ...fullCRF,
            studyId: fullCRF.studyId || crf.studyId,
            crfFormType: fullCRF.crfFormType || crf.crfFormType,
            sections: parsedSections,
            config: buildCrfDesignerConfigFromApi(fullCRF, crf.config),
          })
        } else {
          // If fetch fails, use existing crf data
          setCurrentCRF(crf)
        }
      } catch (error) {
        console.error("Error fetching CRF for edit:", error)
        // If fetch fails, use existing crf data
        setCurrentCRF(crf)
      }
    } else {
      setCurrentCRF(crf)
    }
    setMode("design")
  }

  const handleBackToList = () => {
    setMode("list")
    setCurrentCRF(null)
  }

  const generateAnnotatedBlankPdf = async (crf, setDetail) => {
    try {
      setDetail?.("Preparing CRF design…")
      let mergedCrf = null
      if (crf.id && crf.studyId) {
        const { crfDesignService } = await import("@/lib/services")
        const response = await crfDesignService.getCrfDesignById(crf.id, crf.studyId)
        if (response.isSuccess && response.data) {
          const fullCRF = response.data
          let parsedSections = []
          if (fullCRF.htmlContent) {
            parsedSections = parseHtmlContent(fullCRF.htmlContent)
          } else if (fullCRF.sections && fullCRF.sections.length > 0) {
            parsedSections = fullCRF.sections
          } else if (crf.sections && crf.sections.length > 0) {
            parsedSections = crf.sections
          }
          mergedCrf = {
            ...crf,
            ...fullCRF,
            studyId: fullCRF.studyId || crf.studyId,
            crfFormType: fullCRF.crfFormType || crf.crfFormType,
            sections: parsedSections,
            config: buildCrfDesignerConfigFromApi(fullCRF, crf.config),
          }
        } else {
          let parsedSections = crf.sections && crf.sections.length > 0 ? crf.sections : []
          if (crf.htmlContent) parsedSections = parseHtmlContent(crf.htmlContent)
          mergedCrf = { ...crf, sections: parsedSections }
        }
      } else {
        let parsedSections = crf.sections && crf.sections.length > 0 ? crf.sections : []
        if (crf.htmlContent) parsedSections = parseHtmlContent(crf.htmlContent)
        mergedCrf = { ...crf, sections: parsedSections }
      }

      if (!mergedCrf) return

      setDetail?.("Building PDF layout…")
      const sections = buildPdfSectionsForExport(mergedCrf, {}, "blank")
      const crfName = mergedCrf.config?.name || mergedCrf.name || "CRF"

      let studyNo =
        mergedCrf.studyProtocolNumber ||
        mergedCrf.study?.protocolNumber ||
        (studyId ? `Study-${studyId}` : "")
      let studyTitle =
        mergedCrf.studyTitle ||
        mergedCrf.study?.studyTitle ||
        mergedCrf.study?.title ||
        mergedCrf.study?.name ||
        studyNo

      const looksLikeFallbackStudy = (v) =>
        /^study-\d+$/i.test(String(v || "").trim())

      if (
        mergedCrf.studyId &&
        (!studyNo ||
          !studyTitle ||
          looksLikeFallbackStudy(studyNo) ||
          looksLikeFallbackStudy(studyTitle))
      ) {
        try {
          const studyResp = await studyService.getStudyById(mergedCrf.studyId)
          const studyData = studyResp?.data || {}
          const apiProtocol =
            studyData?.studyProtocolNumber ||
            studyData?.protocolNumber ||
            studyData?.name ||
            ""
          const apiTitle = studyData?.studyTitle || ""

          if (!studyNo || looksLikeFallbackStudy(studyNo)) {
            studyNo = apiProtocol || studyNo
          }
          if (!studyTitle || looksLikeFallbackStudy(studyTitle)) {
            studyTitle = apiTitle || apiProtocol || studyTitle
          }
        } catch {
        }
      }

      const crfMeta = {
        ...getDefaultCrfOrgMeta(),
        studyNo,
        studyTitle,
        formType: getCrfFormTypeLabel(mergedCrf.crfFormType),
        crfVersion:
          mergedCrf.version ||
          mergedCrf.crfVersion ||
          mergedCrf.config?.version ||
          "",
        siteNo: "",
        investigatorCode: "",
        investigatorName: "",
      }

      const patient = {
        patientId: "",
        initial: "",
        name: "",
      }

      const visit = {
        visitDate: "",
        visitName: getCrfFormTypeLabel(mergedCrf.crfFormType),
      }

      const u = authService.getUser?.() || {}
      const printedInfo = buildPrintedInfoFromUser(u)

      const safeCrf = crfName.replace(/[^a-zA-Z0-9-_]/g, "_")
      const filename = `CRF_${safeCrf}_blank.pdf`

      setDetail?.("Generating PDF file…")
      await generateCrfEntryPdf({
        crfMeta,
        patient,
        visit,
        sections,
        printedInfo,
        showDates: true,
        pdfMode: "blank",
        layoutOptions: {
          ...CRF_PDF_DEFAULT_LAYOUT_OPTIONS,
          showSubjectIdentity: false,
        },
        filename,
        crfName,
      })
    } catch (error) {
      console.error("Error generating blank CRF PDF:", error)
      throw error
    }
  }

  const handlePrintBlank = async (crf) => {
    startReportExport({
      kind: "crf-annotated-pdf",
      label: "Annotated blank CRF (PDF)",
      task: async (setDetail) => {
        await generateAnnotatedBlankPdf(crf, setDetail)
      },
    })
  }

  const handleSaveComplete = () => {
    // After saving, reload the list to show updated data
    setMode("list")
    setCurrentCRF(null)
    // Force list to reload by triggering a refresh
    // Use a single refresh trigger to avoid multiple API calls
    setRefreshKey(prev => prev + 1)
  }

  // When the manage route is shown (including returning from another app page), show the grid — not a stale designer/view.
  useEffect(() => {
    if (pathname !== "/ecrf-form-designer/manage") return
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      if (params.get("openCrfId")) return
    }
    prevPathnameRef.current = pathname
    setMode("list")
    setCurrentCRF(null)
    const timer = setTimeout(() => {
      setRefreshKey((prev) => prev + 1)
    }, 100)
    return () => clearTimeout(timer)
  }, [pathname])

  // CRF Studio (or other callers): open designer directly when ?openCrfId=&studyId= are present.
  useEffect(() => {
    if (pathname !== "/ecrf-form-designer/manage" || typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const openCrfId = params.get("openCrfId")
    const openStudyId = params.get("studyId") || contextStudyId
    if (!openCrfId || !openStudyId || deepLinkOpenedRef.current) return

    deepLinkOpenedRef.current = true
    const crfId = Number(openCrfId)
    const sid = Number(openStudyId)
    if (!Number.isFinite(crfId) || !Number.isFinite(sid)) return

    void handleEdit({ id: crfId, studyId: sid })
    window.history.replaceState({}, "", "/ecrf-form-designer/manage")
  }, [pathname, contextStudyId])

  // Sidebar "Manage eCRF Form" while already on this URL does not change pathname; reset to list explicitly.
  useEffect(() => {
    if (typeof window === "undefined") return
    const onReset = () => {
      setMode("list")
      setCurrentCRF(null)
      setRefreshKey((prev) => prev + 1)
    }
    window.addEventListener("ecrfFormDesignerManageReset", onReset)
    return () => window.removeEventListener("ecrfFormDesignerManageReset", onReset)
  }, [])

  return (
    <DashboardLayout>
      <div className={`w-full min-w-0 flex flex-col ${mode === "design" ? "flex-1 min-h-0" : ""}`}>
        {/* Content */}
        <div className={mode === "design" ? "flex flex-1 min-h-0 min-w-0 flex-col" : "flex-1"}>
          {mode === "list" && (
            <CRFList
              key={refreshKey}
              studyId={studyId}
              onStudyChange={setStudyId}
              onView={handleView}
              onEdit={handleEdit}
              onCreateNew={handleCreateNew}
              onPrintBlank={handlePrintBlank}
            />
          )}
          {mode === "view" && (
            <CRFViewer
              crfData={currentCRF}
              onEdit={() => handleEdit(currentCRF)}
              onBack={handleBackToList}
            />
          )}
          {mode === "design" && (
            <div className={APP_VIEWPORT_WORKSPACE_CLASS}>
              <CRFDesigner
                initialCRF={currentCRF}
                onSave={handleSaveComplete}
                onCancel={handleBackToList}
              />
            </div>
          )}

        </div>
      </div>
    </DashboardLayout>
  )
}
