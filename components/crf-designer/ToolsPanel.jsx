"use client"

import { useDraggable } from "@dnd-kit/core"
import { ChevronDown, ChevronUp, Type, Hash, Calendar, Clock, CheckSquare, Circle, List, Minus, Table, FlaskConical } from "lucide-react"
import { useState } from "react"

const ToolItem = ({ id, icon: Icon, label, disabled }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `tool_${id}`,
    disabled: disabled,
  })

  return (
    <div
      ref={setNodeRef}
      {...(disabled ? {} : { ...listeners, ...attributes })}
      className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
        disabled 
          ? "opacity-40 cursor-not-allowed bg-slate-100" 
          : "cursor-move hover:bg-emerald-50"
      } ${isDragging ? "opacity-30" : ""}`}
      title={disabled ? "Please fill CRF Configuration (Name) first" : ""}
    >
      <Icon className={`w-4 h-4 flex-shrink-0 ${disabled ? "text-slate-400" : "text-emerald-600"}`} />
      <span className={`text-xs font-medium truncate ${disabled ? "text-slate-400" : "text-slate-700"}`}>{label}</span>
    </div>
  )
}

const ToolsPanel = ({ disabled = false }) => {
  const [toolsExpanded, setToolsExpanded] = useState(true)

  const tools = [
    { id: "label", icon: Type, label: "Label" },
    { id: "text", icon: Type, label: "Text Box" },
    { id: "number", icon: Hash, label: "Number Box" },
    { id: "date", icon: Calendar, label: "Date Picker" },
    { id: "ukunkdate", icon: Calendar, label: "UK/UNK Date Picker" },
    { id: "time", icon: Clock, label: "Time Picker" },
    { id: "checkbox", icon: CheckSquare, label: "Check Box" },
    { id: "radio", icon: Circle, label: "Option Button" },
    { id: "select", icon: List, label: "Option List" },
    { id: "hr", icon: Minus, label: "Divider" },
    { id: "table", icon: Table, label: "Table" },
    { id: "lab", icon: FlaskConical, label: "Lab" },
  ]

  return (
    <div className="h-full min-h-0 flex flex-col">
      {/* Header */}
      <div className="p-3 flex-shrink-0 border-b border-slate-200 bg-slate-50">
        <h3 className="font-semibold text-slate-900 text-sm">Tools</h3>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-x-none">
        {/* Tools Section */}
        <div className="border-b border-slate-200">
          <button
            onClick={() => setToolsExpanded(!toolsExpanded)}
            className="w-full flex items-center justify-between p-2 hover:bg-blue-50 transition-colors"
          >
            <h4 className="font-medium text-slate-700 text-sm">Tools</h4>
            {toolsExpanded ? (
              <ChevronUp className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            )}
          </button>
          {toolsExpanded && (
            <div className="p-1.5 space-y-0.5">
              {tools.map((tool) => (
                <ToolItem key={tool.id} id={tool.id} icon={tool.icon} label={tool.label} disabled={disabled} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ToolsPanel

