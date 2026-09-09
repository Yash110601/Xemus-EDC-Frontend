"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { X, Plus, FlaskConical, Trash2 } from "lucide-react"

const RulesPanel = ({ rules = [], onChange, allControls = [] }) => {
  const [newRule, setNewRule] = useState({
    name: "",
    category: "",
    expression: "",
    message: "",
    severity: "SOFT",
    targetField: ""
  })

  const ruleCategories = [
    { text: "Show Action", value: "show" },
    { text: "Hide Action", value: "hide" },
    { text: "Disable Action", value: "disable" },
    { text: "Enable Action", value: "enable" },
    { text: "Compute Action", value: "compute" },
    { text: "Validation", value: "validation" },
  ]

  const operators = [
    { label: "==", value: "==" },
    { label: "===", value: "===" },
    { label: "!=", value: "!=" },
    { label: ">", value: ">" },
    { label: ">=", value: ">=" },
    { label: "<", value: "<" },
    { label: "<=", value: "<=" },
    { label: "&&", value: "&&" },
    { label: "||", value: "||" },
  ]

  const handleAddRule = () => {
    if (!newRule.name.trim() || !newRule.category || !newRule.expression.trim()) {
      return
    }

    const rule = {
      id: `rule_${Date.now()}`,
      name: newRule.name.trim(),
      category: newRule.category,
      expression: newRule.expression.trim(),
      message: newRule.message.trim() || newRule.expression.trim(),
      severity: newRule.severity,
      targetField: newRule.targetField || null,
      trigger: "ON_CHANGE",
      createdAt: new Date().toISOString()
    }

    onChange([...rules, rule])
    setNewRule({
      name: "",
      category: "",
      expression: "",
      message: "",
      severity: "SOFT",
      targetField: ""
    })
  }

  const handleDeleteRule = (ruleId) => {
    onChange(rules.filter(r => r.id !== ruleId))
  }

  const handleFieldClick = (field) => {
    // Add field name (label) to expression so user sees readable names instead of control IDs
    const fieldLabel = field.label || field.properties?.labelText || field.id
    setNewRule(prev => ({
      ...prev,
      expression: prev.expression + (prev.expression ? " " : "") + fieldLabel
    }))
  }

  const handleOperatorClick = (op) => {
    setNewRule(prev => ({
      ...prev,
      expression: prev.expression + (prev.expression ? " " : "") + op
    }))
  }

  // Get available fields for rule building
  const availableFields = allControls.filter(
    c => c.type !== "label" && c.type !== "hr" && c.type !== "table"
  )

  return (
    <div className="border-t border-slate-200 bg-white relative">
      <div className="p-4 relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <FlaskConical className="w-5 h-5 text-emerald-600" />
          <h3 className="font-semibold text-slate-900">CRF Rules</h3>
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
            {rules.length} rule{rules.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Existing Rules List */}
        {rules.length > 0 && (
          <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-emerald-900 truncate">
                      {rule.name}
                    </div>
                    <div className="text-emerald-700 mt-0.5">
                      <span className="font-medium">Category:</span> {rule.category} | 
                      <span className="font-medium ml-1">Severity:</span> {rule.severity}
                    </div>
                    <div className="text-slate-600 mt-1 text-[10px] font-mono bg-white px-1.5 py-0.5 rounded border border-emerald-100 break-all">
                      {rule.expression}
                    </div>
                    {rule.message && (
                      <div className="text-slate-600 mt-1 text-[10px]">
                        <span className="font-medium">Message:</span> {rule.message}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 flex-shrink-0"
                    title="Remove rule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add New Rule Form */}
        <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div>
            <Label className="text-xs font-medium mb-1 block">Rule Name <span className="text-red-500">*</span></Label>
            <Input
              value={newRule.name}
              onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
              placeholder="Enter rule name"
              className="text-xs h-8"
              maxLength={200}
            />
          </div>

          <div>
            <Label className="text-xs font-medium mb-1 block">Rule Category <span className="text-red-500">*</span></Label>
            <Select value={newRule.category} onValueChange={(value) => setNewRule({ ...newRule, category: value })}>
              <SelectTrigger className="text-xs h-8 w-full cursor-pointer pointer-events-auto">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent className="z-[100] bg-white opacity-100 shadow-lg" position="popper">
                {ruleCategories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.text}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Expression Builder */}
          <div>
            <Label className="text-xs font-medium mb-1 block">Rule Expression <span className="text-red-500">*</span></Label>
            
            {/* Available Fields */}
            {availableFields.length > 0 && (
              <div className="mb-2">
                <Label className="text-[10px] text-slate-600 mb-1 block">Fields:</Label>
                <div className="flex flex-wrap gap-1 p-1.5 bg-white rounded border border-slate-200 max-h-20 overflow-y-auto">
                  {availableFields.map((field) => {
                    const fieldLabel = field.label || field.properties?.labelText || "Unnamed Field"
                    return (
                      <button
                        key={field.id}
                        type="button"
                        onClick={() => handleFieldClick(field)}
                        className="px-1.5 py-0.5 bg-slate-50 border border-slate-300 rounded text-[10px] hover:bg-emerald-50 hover:border-emerald-400 transition-colors"
                        title={`Click to add "${fieldLabel}" to expression`}
                      >
                        {fieldLabel}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Operators */}
            <div className="mb-2">
              <Label className="text-[10px] text-slate-600 mb-1 block">Operators:</Label>
              <div className="flex flex-wrap gap-1 p-1.5 bg-white rounded border border-slate-200">
                {operators.map((op) => (
                  <button
                    key={op.value}
                    type="button"
                    onClick={() => handleOperatorClick(op.value)}
                    className="px-2 py-0.5 bg-slate-50 border border-slate-300 rounded text-[10px] font-mono hover:bg-emerald-50 hover:border-emerald-400 transition-colors"
                    title={op.label}
                  >
                    {op.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Expression Input */}
            <Textarea
              value={newRule.expression}
              onChange={(e) => setNewRule({ ...newRule, expression: e.target.value })}
              placeholder="Build expression (e.g., Age > 18 && Status == 'Active')"
              className="font-mono text-xs min-h-[60px]"
            />
          </div>

          <div>
            <Label className="text-xs font-medium mb-1 block">Message</Label>
            <Input
              value={newRule.message}
              onChange={(e) => setNewRule({ ...newRule, message: e.target.value })}
              placeholder="Error/warning message"
              className="text-xs h-8"
              maxLength={500}
            />
          </div>

          <div>
            <Label className="text-xs font-medium mb-1 block">Severity</Label>
            <Select value={newRule.severity} onValueChange={(value) => setNewRule({ ...newRule, severity: value })}>
              <SelectTrigger className="text-xs h-8 w-full cursor-pointer pointer-events-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[100]" position="popper">
                <SelectItem value="SOFT">Soft (Warning)</SelectItem>
                <SelectItem value="HARD">Hard (Blocking)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleAddRule}
            size="sm"
            className="w-full h-8 text-xs"
            disabled={!newRule.name.trim() || !newRule.category || !newRule.expression.trim()}
          >
            <Plus className="w-3 h-3 mr-1" />
            Add Rule
          </Button>
        </div>
      </div>
    </div>
  )
}

export default RulesPanel
