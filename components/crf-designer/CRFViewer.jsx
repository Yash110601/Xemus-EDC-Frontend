"use client"

import { useState, useEffect } from "react"
import ControlRenderer from "./ControlRenderer"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Edit, Eye } from "lucide-react"
import { useRouter } from "next/navigation"
import { useRuleEvaluation } from "./useRuleEvaluation"
import { evaluateRule, createFieldLabelMap } from "./ruleEvaluator"
import { AlertCircle } from "lucide-react"
import { CrfLabSectionBanner, CrfLabSectionTabAffix } from "./CrfLabSectionBanner"

const CRFViewer = ({ 
  crfData, 
  onEdit, 
  isPreviewMode = false,
  initialFormValues = {},
  onValueChange,
  onSave,
  onSubmit,
  showSaveButtons = false,
  validationErrors = {}, // Pass validation errors to show inline
  printMode = false // When true: hide nav/buttons, show all sections stacked for blank CRF PDF
}) => {
  const router = useRouter()
  const [activeSection, setActiveSection] = useState("")
  const [formValues, setFormValues] = useState(initialFormValues || {})
  const [ruleMessages, setRuleMessages] = useState([])
  
  // Use rule evaluation hook for dynamic rule application
  const { 
    evaluatedControls, 
    updateFormValue, 
    getEvaluatedControl 
  } = useRuleEvaluation(crfData?.sections || [], formValues)

  // Evaluate CRF-level rules (in preview mode or data entry mode)
  useEffect(() => {
    if (!crfData?.rules || crfData.rules.length === 0) {
      setRuleMessages([])
      return
    }
    
    // Show rules in preview mode OR data entry mode (when showSaveButtons is true)
    if (!isPreviewMode && !showSaveButtons) {
      setRuleMessages([])
      return
    }

    const allControls = []
    crfData.sections?.forEach(section => {
      if (section.controls) {
        allControls.push(...section.controls)
      }
    })
    const fieldLabelMap = createFieldLabelMap(allControls)

    const messages = []
    crfData.rules.forEach(rule => {
      try {
        const conditionMet = evaluateRule(rule.expression, formValues, fieldLabelMap)
        if (conditionMet) {
          messages.push({
            ruleId: rule.id,
            message: rule.message || rule.expression,
            severity: rule.severity || "SOFT",
            category: rule.category
          })
        }
      } catch (error) {
        console.error(`Error evaluating rule ${rule.id}:`, error)
      }
    })

    setRuleMessages(messages)
  }, [formValues, crfData?.rules, crfData?.sections, isPreviewMode, showSaveButtons])

  // Update form values when control values change
  const handleValueChange = (controlId, value) => {
    const updatedValues = { ...formValues, [controlId]: value }
    setFormValues(updatedValues)
    if (updateFormValue) {
      updateFormValue(controlId, value)
    }
    // Notify parent component of value change (for data entry mode)
    if (onValueChange) {
      onValueChange(controlId, value, updatedValues)
    }
  }

  // Initialize form values from props
  useEffect(() => {
    if (initialFormValues && Object.keys(initialFormValues).length > 0) {
      setFormValues(initialFormValues)
    }
  }, [initialFormValues])

  useEffect(() => {
    if (crfData?.sections && crfData.sections.length > 0) {
      setActiveSection(crfData.sections[0].id)
    }
  }, [crfData])

  if (!crfData) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-500">No CRF data to display</p>
      </div>
    )
  }

  const activeSectionData = crfData.sections?.find(s => s.id === activeSection)

  const sectionsToRender = printMode && crfData.sections?.length
    ? crfData.sections
    : activeSectionData ? [activeSectionData] : []

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header - hidden in print mode (print layout provides its own header) */}
      {!printMode && (
        <div className="border-b border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.back()}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              )}
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{crfData.config?.name || "CRF Viewer"}</h2>
                {crfData.config?.description && (
                  <p className="text-sm text-slate-600 mt-1">{crfData.config.description}</p>
                )}
              </div>
            </div>
            {onEdit && (
              <Button
                onClick={() => onEdit(crfData)}
                size="sm"
              >
                <Edit className="w-4 h-4 mr-2" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Section Tabs - hidden in print mode; print shows all sections stacked */}
      {!printMode && crfData.sections && crfData.sections.length > 0 && (
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 overflow-x-auto">
          {crfData.sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors whitespace-nowrap ${activeSection === section.id
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
            >
              <span className="inline-flex items-center gap-2">
                <CrfLabSectionTabAffix section={section} />
                {section.name}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* CRF Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {sectionsToRender.length > 0 ? (
          <div className="max-w-6xl mx-auto">
            {sectionsToRender.map((section, sectionIndex) => (
              <div key={section.id} className={sectionIndex > 0 ? "mt-10" : ""}>
                {/* CRF Configuration - only above first section (or when single section) */}
                {sectionIndex === 0 && crfData.config && !printMode && (
                  <div className="mb-6 border border-slate-200 rounded-lg bg-slate-50 p-4">
                    <h3 className="font-semibold text-slate-900 mb-4 text-lg">CRF Configuration</h3>
                    <div className="grid grid-cols-2 gap-4">
                      {crfData.config.name && (
                        <div>
                          <Label className="text-sm font-medium text-red-600 mb-1 block">
                            Name <span className="text-red-500">*</span>
                          </Label>
                          <p className="text-sm text-slate-700 font-medium">{crfData.config.name}</p>
                        </div>
                      )}
                      {crfData.config.isFinalPrint && (
                        <div>
                          <Label className="text-sm font-medium text-red-600 mb-1 block">
                            Is Available for final CRF print? <span className="text-red-500">*</span>
                          </Label>
                          <p className="text-sm text-slate-700 font-medium">{crfData.config.isFinalPrint === "Y" ? "Yes" : crfData.config.isFinalPrint === "N" ? "No" : crfData.config.isFinalPrint}</p>
                        </div>
                      )}
                      {crfData.config.activityRights && crfData.config.activityRights.length > 0 && (
                        <div>
                          <Label className="text-sm font-medium text-red-600 mb-1 block">
                            Activity Rights <span className="text-red-500">*</span>
                          </Label>
                          <p className="text-sm text-slate-700 font-medium">{Array.isArray(crfData.config.activityRights) ? crfData.config.activityRights.join(", ") : crfData.config.activityRights}</p>
                        </div>
                      )}
                      {crfData.config.description && (
                        <div className="col-span-2">
                          <Label className="text-sm font-medium mb-1 block">Description</Label>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{crfData.config.description}</p>
                        </div>
                      )}
                      {crfData.config.remarks && (
                        <div className="col-span-2">
                          <Label className="text-sm font-medium mb-1 block">Remarks</Label>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap">{crfData.config.remarks}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!printMode && (
                  <CrfLabSectionBanner section={section} variant="preview" />
                )}
                <h3 className="text-xl font-semibold mb-6 text-slate-900">{section.name}</h3>

                {/* Rule Messages - Show in preview mode or data entry mode (skip in print mode) */}
                {!printMode && (isPreviewMode || showSaveButtons) && ruleMessages.length > 0 && sectionIndex === 0 && (
                  <div className="mb-6 space-y-2">
                    {ruleMessages.map((msg) => (
                      <div
                        key={msg.ruleId}
                        className={`p-3 rounded-lg border flex items-start gap-2 ${
                          msg.severity === "HARD"
                            ? "bg-red-50 border-red-200 text-red-900"
                            : "bg-amber-50 border-amber-200 text-amber-900"
                        }`}
                      >
                        <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                          msg.severity === "HARD" ? "text-red-600" : "text-amber-600"
                        }`} />
                        <div className="flex-1">
                          <div className="font-semibold text-sm">
                            {msg.severity === "HARD" ? "Blocking Rule" : "Warning"}
                          </div>
                          <div className="text-sm mt-1">{msg.message}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-12 gap-4">
                  {section.controls && section.controls.length > 0 ? (
                    section.controls.map((control) => {
                      const evaluatedControl = getEvaluatedControl(control.id) || control
                      const colSpanMap = {
                        2: "col-span-2",
                        4: "col-span-4",
                        6: "col-span-6",
                        8: "col-span-8",
                        10: "col-span-10",
                        12: "col-span-12"
                      }
                      const colSpanClass = colSpanMap[evaluatedControl.controlSize] || "col-span-12"
                      const isHidden = evaluatedControl.properties?.hidden === true
                      if (isHidden) return null
                      const controlErrors = validationErrors[evaluatedControl.id] || []
                      return (
                        <div
                          key={evaluatedControl.id}
                          className={`${colSpanClass} p-4 border rounded-lg ${
                            controlErrors.length > 0
                              ? "border-red-300 bg-red-50/30"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <ControlRenderer
                            control={evaluatedControl}
                            isViewMode={printMode ? true : !isPreviewMode && !showSaveButtons}
                            isPreviewMode={printMode ? false : (isPreviewMode || showSaveButtons)}
                            formValues={formValues}
                            onValueChange={(idOrVal, val) => {
                              if (!isPreviewMode && !showSaveButtons && !printMode) return
                              if (val !== undefined) handleValueChange(idOrVal, val)
                              else handleValueChange(evaluatedControl.id, idOrVal)
                            }}
                          />
                          {controlErrors.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {controlErrors.map((error, idx) => (
                                <p key={idx} className="text-xs text-red-600">{error}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <div className="col-span-12 text-center text-slate-400 py-8">
                      No controls in this section
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-500">Select a section to view</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default CRFViewer

