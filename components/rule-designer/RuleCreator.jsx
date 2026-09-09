"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChevronDown, ChevronUp, HelpCircle, Plus, FileText, FlaskConical, Type, Hash, Calendar, Clock, CheckSquare, Circle, List, Minus } from "lucide-react"
import { crfDesignService } from "@/lib/services"
import { useToast } from "@/hooks/use-toast"
import RuleTestingModal from "./RuleTestingModal"

const RuleCreator = () => {
  const { toast } = useToast()
  const [category, setCategory] = useState("C") // "C" = CRF, "G" = Group, "CO" = Constant
  const [studyEventId, setStudyEventId] = useState("")
  const [crfList, setCrfList] = useState([])
  const [expandedCrfs, setExpandedCrfs] = useState({})
  const [expandedSections, setExpandedSections] = useState({})
  const [ruleName, setRuleName] = useState("")
  const [ruleCategory, setRuleCategory] = useState("")
  const [ruleExpression, setRuleExpression] = useState("")
  const [message, setMessage] = useState("")
  const [applySimilarActivity, setApplySimilarActivity] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showTestModal, setShowTestModal] = useState(false)

  const ruleCategories = [
    { text: "Submit Action", value: "submit" },
    { text: "Retro Action", value: "retro" },
    { text: "Show Action", value: "show" },
    { text: "Hide Action", value: "hide" },
    { text: "Disable Action", value: "disable" },
    { text: "Enable Visit Action", value: "enable" },
    { text: "Compute Action", value: "compute" },
  ]

  const operators = [
    { label: "==", tooltip: "Equal" },
    { label: "!=", tooltip: "Not Equal" },
    { label: ">", tooltip: "Greater Than" },
    { label: ">=", tooltip: "Greater Than Equal" },
    { label: "<", tooltip: "Less Than" },
    { label: "<=", tooltip: "Less Than Equal" },
    { label: "&&", tooltip: "And Operator" },
    { label: "||", tooltip: "Or Operator" },
    { label: "+", tooltip: "Add" },
    { label: "-", tooltip: "Subtract" },
    { label: "*", tooltip: "Multiply" },
    { label: "/", tooltip: "Divide" },
    { label: "(", tooltip: "Open Parenthesis" },
    { label: ")", tooltip: "Close Parenthesis" },
    { label: "Blank''", tooltip: "Blank" },
    { label: ",", tooltip: "Comma" },
  ]

  const functions = [
    { label: "DATE_DIFF", tooltip: "Date Difference" },
    { label: "DATE_ADD", tooltip: "Date Add" },
    { label: "TIME_DIFF", tooltip: "Time Difference" },
    { label: "SUBSTRING", tooltip: "Substring" },
    { label: "CONCAT", tooltip: "Concatenate" },
  ]

  const keywords = [
    { label: "'Year'", tooltip: "Year" },
    { label: "'Month'", tooltip: "Month" },
    { label: "'Day'", tooltip: "Day" },
    { label: "'Hour'", tooltip: "Hour" },
    { label: "'Minute'", tooltip: "Minute" },
    { label: "'Second'", tooltip: "Second" },
    { label: "Today", tooltip: "Current Date" },
  ]

  const handleOperatorClick = (op) => {
    setRuleExpression((prev) => prev + (prev ? " " : "") + op)
  }

  const toggleCrf = (crfId) => {
    setExpandedCrfs((prev) => ({
      ...prev,
      [crfId]: !prev[crfId],
    }))
  }

  const toggleSection = (sectionId) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }))
  }

  const handleFieldClick = (control) => {
    // Add field to rule expression
    const fieldText = control.label || control.id
    setRuleExpression((prev) => prev + (prev ? " " : "") + fieldText)
  }

  const handleRuleGroup = () => {
    toast({
      title: "Rule Group",
      description: "Rule Group management feature will be implemented here.",
    })
    // TODO: Open rule group dialog/modal
  }

  const handleTestRule = async () => {
    // Validation
    if (!ruleExpression.trim()) {
      toast({
        title: "Validation Error",
        description: "Please build a rule expression",
        variant: "destructive",
      })
      return
    }

    // Open the test modal
    setShowTestModal(true)
  }

  const handleSave = async () => {
    // Validation
    if (!ruleName.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a Rule Name",
        variant: "destructive",
      })
      return
    }

    if (!ruleCategory) {
      toast({
        title: "Validation Error",
        description: "Please select a Rule Category",
        variant: "destructive",
      })
      return
    }

    if (!ruleExpression.trim()) {
      toast({
        title: "Validation Error",
        description: "Please build a rule expression",
        variant: "destructive",
      })
      return
    }

    // Check if rule category requires message or target control
    const requiresMessage = !["hide", "show", "disable", "compute", "enable"].includes(ruleCategory)
    if (requiresMessage && !message.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a Rule Message",
        variant: "destructive",
      })
      return
    }

    setSaving(true)
    try {
      const ruleData = {
        id: `rule_${Date.now()}`,
        ruleName: ruleName.trim(),
        ruleCategory,
        ruleExpression: ruleExpression.trim(),
        message: message.trim(),
        applySimilarActivity,
        studyEventId,
        category,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      // TODO: Save to API
      // For now, save to localStorage
      const savedRules = JSON.parse(localStorage.getItem("rules") || "[]")
      savedRules.push(ruleData)
      localStorage.setItem("rules", JSON.stringify(savedRules))

      toast({
        title: "Success",
        description: "Rule saved successfully!",
      })

      // Reset form after successful save
      handleClear()
    } catch (error) {
      toast({
        title: "Save Failed",
        description: error.message || "Error saving rule",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleClear = () => {
    setRuleName("")
    setRuleCategory("")
    setRuleExpression("")
    setMessage("")
    setApplySimilarActivity(false)
    setStudyEventId("")
    toast({
      title: "Cleared",
      description: "All fields have been cleared",
    })
  }

  const getControlIcon = (type) => {
    switch (type) {
      case "text":
        return <Type className="h-3.5 w-3.5 text-slate-500" />
      case "number":
        return <Hash className="h-3.5 w-3.5 text-slate-500" />
      case "date":
        return <Calendar className="h-3.5 w-3.5 text-slate-500" />
      case "time":
        return <Clock className="h-3.5 w-3.5 text-slate-500" />
      case "checkbox":
        return <CheckSquare className="h-3.5 w-3.5 text-slate-500" />
      case "radio":
        return <Circle className="h-3.5 w-3.5 text-slate-500" />
      case "select":
        return <List className="h-3.5 w-3.5 text-slate-500" />
      case "hr":
        return <Minus className="h-3.5 w-3.5 text-slate-500" />
      default:
        return <FlaskConical className="h-3.5 w-3.5 text-slate-500" />
    }
  }

  // Load saved CRFs
  useEffect(() => {
    const loadCRFs = async () => {
      setLoading(true)
      try {
        // Call API to get CRF Designs
        const response = await crfDesignService.getCrfDesignsList(1, 100, null, null, true)

        if (response.isSuccess && response.data) {
          const data = response.data
          const items = Array.isArray(data) ? data : (data.items || data.Items || [])
          
          // Transform API response to match component expectations
          const formattedCrfs = items.map((item) => {
            // Parse HtmlContent if it exists (contains the CRF structure)
            let crfStructure = null
            if (item.htmlContent) {
              try {
                crfStructure = JSON.parse(item.htmlContent)
              } catch (e) {
                console.warn("Failed to parse HtmlContent:", e)
              }
            }

            return {
              id: item.id,
              name: item.name || crfStructure?.config?.name || "Unnamed CRF",
              config: crfStructure?.config || {
                name: item.name,
                description: item.description
              },
              sections: crfStructure?.sections || [],
            }
          })
          setCrfList(formattedCrfs)
        } else {
          setCrfList([])
        }
      } catch (error) {
        console.error("Error loading CRF Designs:", error)
        setCrfList([])
      } finally {
        setLoading(false)
      }
    }

    if (category === "C") {
      loadCRFs()
    }
  }, [category, studyEventId])

  return (
    <div className="flex h-full bg-slate-50">
      {/* Left Panel */}
      <div className="w-80 border-r border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
        {/* Left Panel Header */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wide">Select Field</h3>

          {/* Radio Buttons */}
          <div className="flex items-center gap-4 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="category"
                checked={category === "C"}
                onChange={() => setCategory("C")}
                className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 focus:ring-2"
              />
              <span className="text-sm font-medium text-slate-700">CRF</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="category"
                checked={category === "G"}
                onChange={() => setCategory("G")}
                className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 focus:ring-2"
              />
              <span className="text-sm font-medium text-slate-700">Group</span>
            </label>
            <div className="ml-auto flex gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 border-slate-300 hover:bg-emerald-50 hover:border-emerald-300"
                onClick={() => {
                  const allExpanded = {}
                  crfList.forEach(crf => {
                    allExpanded[crf.id] = true
                    if (crf.sections) {
                      crf.sections.forEach(section => {
                        setExpandedSections(prev => ({ ...prev, [section.id]: true }))
                      })
                    }
                  })
                  setExpandedCrfs(allExpanded)
                }}
                title="Expand All"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7 border-slate-300 hover:bg-emerald-50 hover:border-emerald-300"
                onClick={() => {
                  setExpandedCrfs({})
                  setExpandedSections({})
                }}
                title="Collapse All"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Event Name Select */}
          <div>
            <Label className="text-xs font-semibold text-slate-700 mb-1.5 block">Event Name *</Label>
            <Select value={studyEventId} onValueChange={setStudyEventId}>
              <SelectTrigger className="h-9 bg-white">
                <SelectValue placeholder="Select event..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="baseline">BASELINE</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* CRF List */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="space-y-2 py-3">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className="rounded-lg border border-slate-200 bg-white p-2.5">
                  <Skeleton className="h-4 w-36 bg-slate-200/80" />
                  <Skeleton className="mt-1.5 h-3 w-20 bg-slate-200/70" />
                </div>
              ))}
            </div>
          ) : crfList.length === 0 ? (
            <div className="text-center py-8 px-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm text-slate-500 font-medium">No CRFs found</p>
              <p className="text-xs text-slate-400 mt-1">Create a CRF first</p>
            </div>
          ) : (
            <div className="space-y-1">
              {crfList.map((crf) => (
                <div key={crf.id} className="mb-1">
                  {/* CRF Header */}
                  <button
                    onClick={() => toggleCrf(crf.id)}
                    className="w-full flex items-center gap-2 p-2.5 hover:bg-emerald-50 rounded-lg text-left transition-colors group border border-transparent hover:border-emerald-200"
                  >
                    {expandedCrfs[crf.id] ? (
                      <ChevronUp className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-emerald-600 flex-shrink-0" />
                    )}
                    <span className="flex-1 text-sm font-semibold text-slate-900 truncate">{crf.name}</span>
                  </button>

                  {/* CRF Sections */}
                  {expandedCrfs[crf.id] && crf.sections && crf.sections.length > 0 && (
                    <div className="ml-6 mt-1 space-y-0.5 border-l-2 border-slate-200 pl-2">
                      {crf.sections.map((section) => (
                        <div key={section.id}>
                          {/* Section Header */}
                          <button
                            onClick={() => toggleSection(section.id)}
                            className="w-full flex items-center gap-2 p-2 hover:bg-blue-50 rounded-md text-left transition-colors group"
                          >
                            {expandedSections[section.id] ? (
                              <ChevronUp className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-500 flex-shrink-0" />
                            )}
                            <span className="flex-1 text-xs font-medium text-slate-700 truncate">{section.name}</span>
                          </button>

                          {/* Section Controls/Fields */}
                          {expandedSections[section.id] && section.controls && section.controls.length > 0 && (
                            <div className="ml-4 mt-1 space-y-0.5">
                              {section.controls.map((control) => (
                                <div
                                  key={control.id}
                                  onClick={() => handleFieldClick(control)}
                                  className="flex items-center gap-2 p-2 hover:bg-emerald-50 rounded-md cursor-pointer text-xs text-slate-600 hover:text-emerald-700 transition-all group/item border border-transparent hover:border-emerald-200"
                                >
                                  <span className="flex-shrink-0">{getControlIcon(control.type)}</span>
                                  <span className="flex-1 truncate font-medium">{control.label || control.id}</span>
                                  <Plus className="h-3.5 w-3.5 opacity-0 group-hover/item:opacity-100 transition-opacity text-emerald-600 flex-shrink-0" />
                                </div>
                              ))}
                            </div>
                          )}
                          {expandedSections[section.id] && (!section.controls || section.controls.length === 0) && (
                            <div className="ml-4 mt-1 p-2 text-xs text-slate-400 italic">
                              No fields
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {expandedCrfs[crf.id] && (!crf.sections || crf.sections.length === 0) && (
                    <div className="ml-6 mt-1 p-2 text-xs text-slate-400 italic border-l-2 border-slate-200 pl-2">
                      No sections
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-4xl mx-auto p-6">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-5 border border-emerald-100 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br btn-brand-gradient flex items-center justify-center shadow-lg">
                  <FlaskConical className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Discrepancy Note Action</h3>
                  <p className="text-xs text-slate-600 mt-0.5">Build and configure validation rules</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRuleGroup}
                  className="border-slate-300 hover:bg-emerald-50 hover:border-emerald-300"
                >
                  Rule Group
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestRule}
                  disabled={testing || saving}
                  className="border-slate-300 hover:bg-emerald-50 hover:border-emerald-300"
                >
                  {testing ? "Testing..." : "Test Rule"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClear}
                  disabled={saving || testing}
                  className="border-slate-300 hover:bg-blue-50"
                >
                  Clear
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  title="Rule Help"
                  className="border-slate-300 hover:bg-emerald-50 hover:border-emerald-300"
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Form Fields Section */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm">
            <div className="space-y-5">
              <div>
                <Label className="text-sm font-semibold text-slate-700 mb-2 block">
                  Rule Name * <span className="text-xs font-normal text-slate-400">({ruleName.length}/200)</span>
                </Label>
                <Input
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="Enter rule name"
                  maxLength={200}
                  className="h-10"
                />
              </div>

              <div>
                <Label className="text-sm font-semibold text-slate-700 mb-2 block">Rule Category *</Label>
                <Select value={ruleCategory} onValueChange={setRuleCategory}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select rule category..." />
                  </SelectTrigger>
                  <SelectContent className="bg-white opacity-100 shadow-lg z-[100]">
                    {ruleCategories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.text}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Rule Expression Builder */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6 shadow-sm">
            <Label className="text-sm font-semibold text-slate-700 mb-3 block">Rule Expression *</Label>

            {/* Operator Buttons */}
            <div className="mb-4 space-y-3">
              <div>
                <Label className="text-xs font-medium text-slate-500 mb-2 block">Operators</Label>
                <div className="flex flex-wrap gap-2">
                  {operators.map((op) => (
                    <Button
                      key={op.label}
                      variant="outline"
                      size="sm"
                      onClick={() => handleOperatorClick(op.label)}
                      title={op.tooltip}
                      className="text-xs h-8 border-slate-300 hover:bg-emerald-50 hover:border-emerald-300"
                    >
                      {op.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-500 mb-2 block">Functions</Label>
                <div className="flex flex-wrap gap-2">
                  {functions.map((fn) => (
                    <Button
                      key={fn.label}
                      variant="outline"
                      size="sm"
                      onClick={() => handleOperatorClick(fn.label)}
                      title={fn.tooltip}
                      className="text-xs h-8 border-slate-300 hover:bg-emerald-50 hover:border-emerald-300"
                    >
                      {fn.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-500 mb-2 block">Keywords</Label>
                <div className="flex flex-wrap gap-2">
                  {keywords.map((kw) => (
                    <Button
                      key={kw.label}
                      variant="outline"
                      size="sm"
                      onClick={() => handleOperatorClick(kw.label)}
                      title={kw.tooltip}
                      className="text-xs h-8 border-slate-300 hover:bg-emerald-50 hover:border-emerald-300"
                    >
                      {kw.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <Textarea
              value={ruleExpression}
              onChange={(e) => setRuleExpression(e.target.value)}
              placeholder="Build your rule expression here... (Click on fields from the left panel to add them)"
              className="min-h-[120px] font-mono text-sm border-slate-300 focus:border-emerald-500 focus:ring-emerald-500"
            />
          </div>

          {/* Options and Message Section */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="space-y-5">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <input
                  type="checkbox"
                  id="similar-activity"
                  checked={applySimilarActivity}
                  onChange={(e) => setApplySimilarActivity(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 focus:ring-2 rounded border-slate-300"
                />
                <Label htmlFor="similar-activity" className="cursor-pointer text-sm font-medium text-slate-700">
                  Apply Similar Activities
                </Label>
              </div>

              <div>
                <Label className="text-sm font-semibold text-slate-700 mb-2 block">Message *</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter rule message..."
                  className="min-h-[100px] border-slate-300 focus:border-emerald-500 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rule Testing Modal */}
      <RuleTestingModal
        open={showTestModal}
        onClose={() => setShowTestModal(false)}
        ruleExpression={ruleExpression}
        ruleMessage={message}
      />
    </div>
  )
}

export default RuleCreator

