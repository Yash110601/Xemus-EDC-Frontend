"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const RuleTestingModal = ({ open, onClose, ruleExpression, ruleMessage }) => {
  const [testValues, setTestValues] = useState({})
  const [testResult, setTestResult] = useState(null)
  const [isChecking, setIsChecking] = useState(false)
  const [fieldNames, setFieldNames] = useState([])

  // Extract field names from rule expression
  useEffect(() => {
    if (!ruleExpression) {
      setFieldNames([])
      return
    }

    // Simple parser to extract field names
    // Matches patterns like: Age, PatientID, Field_Name, etc.
    // Excludes operators, functions, keywords, and numbers
    const fieldPattern = /\b([A-Za-z_][A-Za-z0-9_]*)\b/g
    const operators = [
      "==", "!=", ">", "<", ">=", "<=", "&&", "||", "+", "-", "*", "/",
      "DATE_DIFF", "DATE_ADD", "TIME_DIFF", "SUBSTRING", "CONCAT",
      "Year", "Month", "Day", "Hour", "Minute", "Second", "Today",
      "(", ")", ",", "Blank"
    ]
    
    const matches = ruleExpression.match(fieldPattern) || []
    const uniqueFields = [...new Set(matches)]
    
    // Filter out operators, functions, and keywords
    const fields = uniqueFields.filter(field => {
      // Check if it's a known operator/keyword
      if (operators.some(op => op.toLowerCase() === field.toLowerCase())) {
        return false
      }
      // Check if it's a string literal (quoted)
      if (ruleExpression.includes(`'${field}'`) || ruleExpression.includes(`"${field}"`)) {
        return false
      }
      // Check if it's a number
      if (/^\d+$/.test(field)) {
        return false
      }
      return true
    })

    setFieldNames(fields)
    // Initialize test values
    const initialValues = {}
    fields.forEach(field => {
      initialValues[field] = ""
    })
    setTestValues(initialValues)
    setTestResult(null)
  }, [ruleExpression])

  const handleValueChange = (fieldName, value) => {
    setTestValues(prev => ({
      ...prev,
      [fieldName]: value
    }))
    setTestResult(null) // Clear result when value changes
  }

  const evaluateRule = (expression, values) => {
    try {
      // Replace field names with their values
      let evalExpression = expression

      // Replace each field name with its value
      Object.keys(values).forEach(field => {
        const value = values[field]
        if (value === "" || value === null || value === undefined) {
          // If value is empty, replace with null
          evalExpression = evalExpression.replace(new RegExp(`\\b${field}\\b`, 'g'), 'null')
        } else {
          // Check if value is a number
          const numValue = Number(value)
          if (!isNaN(numValue) && value.trim() !== '') {
            evalExpression = evalExpression.replace(new RegExp(`\\b${field}\\b`, 'g'), numValue)
          } else {
            // Treat as string, wrap in quotes
            evalExpression = evalExpression.replace(new RegExp(`\\b${field}\\b`, 'g'), `"${value}"`)
          }
        }
      })

      // Replace operators that JavaScript understands
      evalExpression = evalExpression.replace(/==/g, '===')
      evalExpression = evalExpression.replace(/!=/g, '!==')
      evalExpression = evalExpression.replace(/&&/g, '&&')
      evalExpression = evalExpression.replace(/\|\|/g, '||')

      // Replace string literals
      evalExpression = evalExpression.replace(/'([^']+)'/g, '"$1"')

      // Handle date comparisons (simplified - would need more sophisticated parsing)
      // Handle Today keyword
      if (evalExpression.includes('Today')) {
        const today = new Date().toISOString().split('T')[0]
        evalExpression = evalExpression.replace(/Today/g, `"${today}"`)
      }

      // Evaluate the expression
      // Note: Using Function constructor instead of eval for safer evaluation
      const result = Function(`"use strict"; return (${evalExpression})`)()
      
      return {
        success: true,
        result: Boolean(result),
        expression: evalExpression
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        result: false
      }
    }
  }

  const handleCheckRule = async () => {
    setIsChecking(true)
    setTestResult(null)

    try {
      // Validate that all fields have values
      const missingFields = fieldNames.filter(field => !testValues[field] || testValues[field].toString().trim() === "")
      
      if (missingFields.length > 0) {
        setTestResult({
          success: false,
          error: `Please provide values for: ${missingFields.join(", ")}`,
          result: false
        })
        setIsChecking(false)
        return
      }

      // Evaluate the rule
      const evaluation = evaluateRule(ruleExpression, testValues)
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500))

      setTestResult({
        ...evaluation,
        rulePassed: evaluation.result,
        discrepancyMessage: evaluation.result ? "Rule passed successfully" : (ruleMessage || "Rule validation failed")
      })
    } catch (error) {
      setTestResult({
        success: false,
        error: error.message || "Error evaluating rule",
        result: false
      })
    } finally {
      setIsChecking(false)
    }
  }

  const handleClose = () => {
    setTestResult(null)
    setTestValues({})
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] p-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-900 to-emerald-800 px-6 py-4 text-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Rule Testing</DialogTitle>
          </DialogHeader>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Rule Expression Display */}
          <div>
            <Label className="text-sm font-semibold text-slate-700 mb-2 block">Rule Expression</Label>
            <div className="bg-slate-100 border border-slate-300 rounded-md p-4 font-mono text-sm text-slate-800 min-h-[50px] flex items-center">
              {ruleExpression || "(No rule expression)"}
            </div>
          </div>

          {/* Test Input Fields */}
          {fieldNames.length > 0 ? (
            <div className="space-y-4">
              <Label className="text-sm font-semibold text-slate-700 mb-3 block">Test Values</Label>
              {fieldNames.map(field => (
                <div key={field} className="flex items-center gap-4">
                  <Label htmlFor={`test-${field}`} className="text-sm font-medium text-slate-700 w-32 flex-shrink-0">
                    {field}
                  </Label>
                  <Input
                    id={`test-${field}`}
                    type="text"
                    value={testValues[field] || ""}
                    onChange={(e) => handleValueChange(field, e.target.value)}
                    placeholder={`Enter ${field} value`}
                    className="flex-1"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-slate-500 text-sm">
              No field references found in rule expression
            </div>
          )}

          {/* Test Result */}
          {testResult && (
            <div className={`rounded-lg border-2 p-4 ${
              testResult.rulePassed 
                ? "bg-green-50 border-green-200" 
                : "bg-red-50 border-red-200"
            }`}>
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  testResult.rulePassed ? "bg-green-500" : "bg-red-500"
                }`}>
                  {testResult.rulePassed ? (
                    <span className="text-white font-bold text-lg">✓</span>
                  ) : (
                    <span className="text-white font-bold text-lg">✗</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className={`font-semibold mb-2 ${
                    testResult.rulePassed ? "text-green-800" : "text-red-800"
                  }`}>
                    Rule has been executed successfully with following
                  </p>
                  {!testResult.rulePassed && ruleMessage && (
                    <p className="text-sm text-red-700 mb-1">
                      <span className="font-semibold">Discrepancy Message:</span> {ruleMessage}
                    </p>
                  )}
                  {testResult.error && (
                    <p className="text-sm text-red-700">
                      <span className="font-semibold">Error:</span> {testResult.error}
                    </p>
                  )}
                  {testResult.rulePassed && (
                    <p className="text-sm text-green-700">
                      Rule validation passed. No discrepancies found.
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTestResult(null)}
                  className="flex-shrink-0"
                >
                  <span className="text-slate-500">×</span>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={handleClose}
            className="px-6"
          >
            CLOSE
          </Button>
          <Button
            onClick={handleCheckRule}
            disabled={isChecking || fieldNames.length === 0 || !ruleExpression}
            className="px-6 bg-violet-600 hover:bg-violet-700 text-white"
          >
            {isChecking ? "Checking..." : "CHECK RULE"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default RuleTestingModal

