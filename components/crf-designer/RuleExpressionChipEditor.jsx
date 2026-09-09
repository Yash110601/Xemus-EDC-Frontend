"use client"

import { useState } from "react"
import { Calendar, CheckSquare, Circle, Clock, Hash, List, Minus, Plus, Type, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const FIELD_CHIP_CLASS =
  "inline-flex items-center gap-1.5 pl-2 pr-1 py-1 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 shadow-sm"
const OP_CHIP_CLASS =
  "inline-flex items-center gap-1 pl-2.5 pr-1 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-mono text-slate-800 shadow-sm"
const LITERAL_CHIP_CLASS =
  "inline-flex items-center gap-1 pl-2.5 pr-1 py-1 bg-amber-50 border border-amber-200 rounded-lg text-xs font-medium text-amber-950 shadow-sm"

function getControlIcon(type) {
  switch (String(type || "").toLowerCase()) {
    case "text":
    case "textarea":
      return <Type className="h-3.5 w-3.5 text-slate-500 shrink-0" />
    case "number":
      return <Hash className="h-3.5 w-3.5 text-slate-500 shrink-0" />
    case "date":
    case "ukunkdate":
      return <Calendar className="h-3.5 w-3.5 text-slate-500 shrink-0" />
    case "time":
      return <Clock className="h-3.5 w-3.5 text-slate-500 shrink-0" />
    case "checkbox":
      return <CheckSquare className="h-3.5 w-3.5 text-slate-500 shrink-0" />
    case "radio":
      return <Circle className="h-3.5 w-3.5 text-slate-500 shrink-0" />
    case "select":
      return <List className="h-3.5 w-3.5 text-slate-500 shrink-0" />
    case "hr":
      return <Minus className="h-3.5 w-3.5 text-slate-500 shrink-0" />
    default:
      return <Type className="h-3.5 w-3.5 text-slate-500 shrink-0" />
  }
}

export default function RuleExpressionChipEditor({
  parts = [],
  onRemoveAt,
  onClear,
  onAddLiteral,
  hasError = false,
  emptyHint = "Click field chips and operators above to build your rule.",
}) {
  const [manualText, setManualText] = useState("")

  const handleAddManualText = () => {
    const value = String(manualText || "").trim()
    if (!value) return
    onAddLiteral?.(value)
    setManualText("")
  }

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "min-h-[96px] w-full rounded-xl border bg-white/90 p-2.5",
          hasError ? "border-rose-400 ring-1 ring-rose-100" : "border-slate-200/90",
        )}
        role="group"
        aria-label="Rule expression builder"
      >
        <div className="flex min-h-[72px] flex-wrap items-center gap-2 content-start">
          {parts.length === 0 ? (
            <p className="px-1 py-2 text-xs text-slate-400">{emptyHint}</p>
          ) : (
            parts.map((part, index) => {
              if (part.kind === "field") {
                const label = String(part.label || part.fieldId || "Field").trim()
                const fieldId = String(part.fieldId || "").trim()
                return (
                  <span
                    key={`field-${index}-${fieldId}`}
                    className={FIELD_CHIP_CLASS}
                    title={fieldId ? `${label} (${fieldId})` : label}
                  >
                    {getControlIcon(part.controlType)}
                    <span className="max-w-[200px] truncate">{label}</span>
                    <button
                      type="button"
                      onClick={() => onRemoveAt?.(index)}
                      className="ml-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      aria-label={`Remove ${label}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )
              }
              if (part.kind === "operator") {
                const value = String(part.value || "").trim()
                return (
                  <span key={`op-${index}-${value}`} className={OP_CHIP_CLASS} title={value}>
                    <span>{value}</span>
                    <button
                      type="button"
                      onClick={() => onRemoveAt?.(index)}
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      aria-label={`Remove operator ${value}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )
              }
              if (part.kind === "literal") {
                const value = String(part.value || "").trim()
                const chipLabel = /^-?\d+(\.\d+)?$/.test(value) ? value : `"${value}"`
                return (
                  <span key={`lit-${index}-${value}`} className={LITERAL_CHIP_CLASS} title={chipLabel}>
                    <Type className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                    <span className="max-w-[180px] truncate">{chipLabel}</span>
                    <button
                      type="button"
                      onClick={() => onRemoveAt?.(index)}
                      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-amber-500 hover:bg-amber-100 hover:text-amber-800"
                      aria-label={`Remove text ${value}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )
              }
              return null
            })
          )}
        </div>
        {parts.length > 0 ? (
          <div className="mt-2 flex justify-end border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={onClear}
              className="text-xs font-medium text-slate-500 hover:text-rose-600"
            >
              Clear all
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              handleAddManualText()
            }
          }}
          placeholder="Manual text (e.g. 18, Yes, No, Other — do not wrap in quotes)"
          className="h-9 rounded-lg border-slate-200 bg-white text-sm"
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleAddManualText}
          disabled={!String(manualText || "").trim()}
          className="h-9 shrink-0 rounded-lg border-slate-300 bg-white text-sm"
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add text
        </Button>
      </div>
    </div>
  )
}
