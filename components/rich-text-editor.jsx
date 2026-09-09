"use client"

import { useRef, useState, useEffect } from "react"
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Link,
  Quote,
  Code,
  Type,
  Table,
  Variable,
  ChevronDown,
  Plus,
  Minus,
  Columns,
  Rows,
  Trash2,
  IndentIncrease,
  IndentDecrease,
  Subscript,
  Superscript,
  SeparatorHorizontal,
  Highlighter,
} from "lucide-react"

const AGREEMENT_FONT_SIZES = [
  { label: "12", value: "12px" },
  { label: "13", value: "13px" },
  { label: "14", value: "14px" },
  { label: "15", value: "15px" },
  { label: "16", value: "16px" },
  { label: "18", value: "18px" },
  { label: "20", value: "20px" },
  { label: "22", value: "22px" },
  { label: "24", value: "24px" },
]

const AGREEMENT_LINE_HEIGHTS = [
  { label: "Tight", value: "1.35" },
  { label: "Normal", value: "1.55" },
  { label: "Relaxed", value: "1.65" },
  { label: "Loose", value: "1.85" },
  { label: "Double", value: "2" },
]

const AGREEMENT_PARAGRAPH_SPACING = [
  { label: "Compact", value: "4px" },
  { label: "Normal", value: "8px" },
  { label: "Relaxed", value: "14px" },
  { label: "Wide", value: "22px" },
]

const HIGHLIGHT_COLORS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#e9d5ff"]

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Enter content...",
  variables = [],
  showVariables = true,
  variant = "default",
  readOnly = false,
}) {
  const editorRef = useRef(null)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showHighlightPicker, setShowHighlightPicker] = useState(false)
  const [showVariablesMenu, setShowVariablesMenu] = useState(false)
  const [isTableSelected, setIsTableSelected] = useState(false)
  const [showDeleteTableConfirm, setShowDeleteTableConfirm] = useState(false)
  const pendingTableDeleteRef = useRef(null)

  // Toolbar active state: highlight the button that matches current selection
  const [toolbarState, setToolbarState] = useState({
    formatBlock: "",
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    justifyLeft: false,
    justifyCenter: false,
    justifyRight: false,
    justifyFull: false,
    unorderedList: false,
    orderedList: false,
    blockquote: false,
    pre: false,
  })

  const clearToolbarState = () => {
    setToolbarState({
      formatBlock: "",
      bold: false,
      italic: false,
      underline: false,
      strikeThrough: false,
      justifyLeft: false,
      justifyCenter: false,
      justifyRight: false,
      justifyFull: false,
      unorderedList: false,
      orderedList: false,
      blockquote: false,
      pre: false,
    })
  }

  const updateToolbarState = () => {
    if (!editorRef.current || document.activeElement !== editorRef.current) {
      return
    }
    try {
      const formatBlock = (document.queryCommandValue("formatBlock") || "").toLowerCase()
      setToolbarState({
        formatBlock: ["h1", "h2", "h3", "h4", "p"].includes(formatBlock) ? formatBlock : "",
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        strikeThrough: document.queryCommandState("strikeThrough"),
        justifyLeft: document.queryCommandState("justifyLeft"),
        justifyCenter: document.queryCommandState("justifyCenter"),
        justifyRight: document.queryCommandState("justifyRight"),
        justifyFull: document.queryCommandState("justifyFull"),
        unorderedList: document.queryCommandState("insertUnorderedList"),
        orderedList: document.queryCommandState("insertOrderedList"),
        blockquote: formatBlock === "blockquote",
        pre: formatBlock === "pre",
      })
    } catch {
      // ignore
    }
  }
  
  // Default variables if none provided
  const defaultVariables = [
    { key: "study_title", label: "Study Title" },
    { key: "effective_date", label: "Effective Date" },
    { key: "amount", label: "Amount" },
    { key: "patients_no", label: "Patients No" },
    // Milestone variables (MS1 to MS12)
    ...Array.from({ length: 12 }, (_, i) => {
      const msNum = i + 1
      return [
        { key: `ms${msNum}_no_patient`, label: `MS${msNum} No Patient` },
        { key: `ms${msNum}_amount`, label: `MS${msNum} Amount` }
      ]
    }).flat()
  ]
  
  const availableVariables = variables.length > 0 ? variables : defaultVariables

  // Close color picker and variables menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showColorPicker && !event.target.closest('.color-picker-container')) {
        setShowColorPicker(false)
      }
      if (showHighlightPicker && !event.target.closest(".highlight-picker-container")) {
        setShowHighlightPicker(false)
      }
      if (showVariablesMenu && !event.target.closest('.variables-menu-container')) {
        setShowVariablesMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showColorPicker, showHighlightPicker, showVariablesMenu])

  const notifyChange = () => {
    if (onChange && editorRef.current) {
      onChange(editorRef.current.innerHTML || "")
    }
    setTimeout(updateToolbarState, 0)
  }

  const applyToBlockElement = (mutator) => {
    editorRef.current?.focus()
    const selection = window.getSelection()
    if (!selection?.rangeCount) return
    let node = selection.anchorNode
    if (node?.nodeType === Node.TEXT_NODE) node = node.parentElement
    const blockTags = new Set(["P", "H1", "H2", "H3", "H4", "LI", "DIV", "TD", "TH"])
    while (node && node !== editorRef.current) {
      if (blockTags.has(node.nodeName)) {
        mutator(node)
        notifyChange()
        return
      }
      node = node.parentElement
    }
  }

  const wrapSelectionWithStyle = (styleText) => {
    editorRef.current?.focus()
    const selection = window.getSelection()
    if (!selection?.rangeCount) return

    const range = selection.getRangeAt(0)
    if (range.collapsed) {
      if (styleText.startsWith("font-size:")) {
        const size = styleText.replace("font-size:", "").trim()
        applyToBlockElement((el) => {
          el.style.fontSize = size
        })
      }
      return
    }

    const fragment = range.extractContents()
    const span = document.createElement("span")
    span.setAttribute("style", styleText)
    span.appendChild(fragment)
    range.insertNode(span)
    range.setStartAfter(span)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
    notifyChange()
  }

  const applyFontSize = (size) => wrapSelectionWithStyle(`font-size: ${size}`)
  const applyLineHeight = (value) => {
    applyToBlockElement((el) => {
      el.style.lineHeight = value
    })
  }
  const applyParagraphSpacing = (marginY) => {
    applyToBlockElement((el) => {
      el.style.marginTop = marginY
      el.style.marginBottom = marginY
    })
  }

  const cleanPastedAgreementHtml = (html) => {
    const tempDiv = document.createElement("div")
    tempDiv.innerHTML = html
    tempDiv.querySelectorAll("script, style, meta, link").forEach((el) => el.remove())
    tempDiv.querySelectorAll("table").forEach((table) => {
      if (!table.classList.contains("agreement-rich-table")) {
        table.classList.add("agreement-rich-table")
      }
      table.style.borderCollapse = "collapse"
      table.style.width = "100%"
    })
    return tempDiv.innerHTML
  }

  const saveSelection = () => {
    const selection = window.getSelection()
    if (selection.rangeCount > 0) {
      return selection.getRangeAt(0)
    }
    return null
  }

  const restoreSelection = (range) => {
    if (range) {
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }

  const executeCommand = (command, value = null) => {
    editorRef.current?.focus()
    const savedRange = saveSelection()
    
    try {
      if (command === "insertHTML" && value) {
        // Better way to insert HTML
        const selection = window.getSelection()
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0)
          range.deleteContents()
          const tempDiv = document.createElement("div")
          tempDiv.innerHTML = value
          const fragment = document.createDocumentFragment()
          while (tempDiv.firstChild) {
            fragment.appendChild(tempDiv.firstChild)
          }
          range.insertNode(fragment)
          range.collapse(false)
          selection.removeAllRanges()
          selection.addRange(range)
        } else {
          editorRef.current.innerHTML += value
        }
      } else {
        document.execCommand(command, false, value)
      }
    } catch (error) {
      console.error("Command execution error:", error)
    }
    
    if (onChange && editorRef.current) {
      onChange(editorRef.current.innerHTML || "")
    }
    setTimeout(updateToolbarState, 0)
  }

  const handleInput = () => {
    if (onChange && editorRef.current) {
      onChange(editorRef.current.innerHTML || "")
    }
    updateToolbarState()
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const text = e.clipboardData.getData("text/plain")
    const html = e.clipboardData.getData("text/html")

    if (html) {
      const cleanHTML =
        variant === "agreement" ? cleanPastedAgreementHtml(html) : html
      executeCommand("insertHTML", cleanHTML)
    } else {
      document.execCommand("insertText", false, text)
    }
  }

  const insertLink = () => {
    const selection = window.getSelection()
    const selectedText = selection.toString()
    const url = prompt("Enter URL:", selectedText ? "" : "https://")
    
    if (url) {
      if (selectedText) {
        executeCommand("createLink", url)
      } else {
        const linkText = prompt("Enter link text:", url)
        if (linkText) {
          const linkHTML = `<a href="${url}" target="_blank">${linkText}</a>`
          executeCommand("insertHTML", linkHTML)
        }
      }
    }
  }

  const insertTable = () => {
    const rows = prompt("Enter number of rows:", "2")
    const cols = prompt("Enter number of columns:", "2")
    
    if (rows && cols && !isNaN(rows) && !isNaN(cols)) {
      const tableClass = variant === "agreement" ? "agreement-rich-table" : ""
      const classAttr = tableClass ? ` class='${tableClass}'` : ""
      let tableHTML = `<table${classAttr} border='1' style='border-collapse: collapse; width: 100%; margin: 10px 0;'>`
      for (let i = 0; i < parseInt(rows); i++) {
        tableHTML += "<tr>"
        for (let j = 0; j < parseInt(cols); j++) {
          tableHTML += "<td style='padding: 8px; border: 1px solid #ccc;'>&nbsp;</td>"
        }
        tableHTML += "</tr>"
      }
      tableHTML += "</table><br>"
      executeCommand("insertHTML", tableHTML)
    }
  }

  // Get the current table cell and table element
  const getCurrentTable = () => {
    const selection = window.getSelection()
    if (selection.rangeCount === 0) return null
    
    let node = selection.anchorNode
    while (node && node !== editorRef.current) {
      if (node.nodeName === 'TD' || node.nodeName === 'TH') {
        const table = node.closest('table')
        const row = node.parentElement
        // Verify the row is actually a child of the table
        if (table && row && table.contains(row)) {
          return { cell: node, table, row }
        }
      }
      node = node.parentElement
    }
    return null
  }

  // Add row above current row
  const addRowAbove = () => {
    const tableInfo = getCurrentTable()
    if (!tableInfo) return
    
    const { table, row } = tableInfo
    
    // Verify row is still a child of table
    if (!table.contains(row)) return
    
    // Get number of columns from the current row
    const colCount = row.cells.length
    
    // Create new row
    const newRow = document.createElement('tr')
    for (let i = 0; i < colCount; i++) {
      const newCell = document.createElement('td')
      newCell.style.padding = '8px'
      newCell.style.border = '1px solid #ccc'
      newCell.innerHTML = '&nbsp;'
      newRow.appendChild(newCell)
    }
    
    // Insert before the current row
    if (row.parentNode === table) {
      table.insertBefore(newRow, row)
      updateContent()
    }
  }

  // Add row below current row
  const addRowBelow = () => {
    const tableInfo = getCurrentTable()
    if (!tableInfo) return
    
    const { table, row } = tableInfo
    
    // Verify row is still a child of table
    if (!table.contains(row)) return
    
    // Get number of columns from the current row
    const colCount = row.cells.length
    
    // Create new row
    const newRow = document.createElement('tr')
    for (let i = 0; i < colCount; i++) {
      const newCell = document.createElement('td')
      newCell.style.padding = '8px'
      newCell.style.border = '1px solid #ccc'
      newCell.innerHTML = '&nbsp;'
      newRow.appendChild(newCell)
    }
    
    // Insert after the current row
    if (row.parentNode === table) {
      if (row.nextSibling) {
        table.insertBefore(newRow, row.nextSibling)
      } else {
        table.appendChild(newRow)
      }
      updateContent()
    }
  }

  // Delete current row
  const deleteRow = () => {
    const tableInfo = getCurrentTable()
    if (!tableInfo) return
    
    const { table, row } = tableInfo
    
    // Verify row is still a child of table
    if (!table.contains(row)) return
    
    if (table.rows.length > 1) {
      row.remove()
      updateContent()
    } else {
      alert("Cannot delete the last row. Delete the entire table instead.")
    }
  }

  // Add column to the left
  const addColumnLeft = () => {
    const tableInfo = getCurrentTable()
    if (!tableInfo) return
    
    const { table, cell } = tableInfo
    const row = cell.parentElement
    
    // Verify cell is still in the table
    if (!table.contains(cell)) return
    
    const cellIndex = Array.from(row.cells).indexOf(cell)
    
    Array.from(table.rows).forEach(tableRow => {
      const newCell = document.createElement('td')
      newCell.style.padding = '8px'
      newCell.style.border = '1px solid #ccc'
      newCell.innerHTML = '&nbsp;'
      
      if (cellIndex === 0) {
        tableRow.insertBefore(newCell, tableRow.firstChild)
      } else if (tableRow.cells[cellIndex]) {
        tableRow.insertBefore(newCell, tableRow.cells[cellIndex])
      } else {
        tableRow.appendChild(newCell)
      }
    })
    updateContent()
  }

  // Add column to the right
  const addColumnRight = () => {
    const tableInfo = getCurrentTable()
    if (!tableInfo) return
    
    const { table, cell } = tableInfo
    const row = cell.parentElement
    
    // Verify cell is still in the table
    if (!table.contains(cell)) return
    
    const cellIndex = Array.from(row.cells).indexOf(cell)
    
    Array.from(table.rows).forEach(tableRow => {
      const newCell = document.createElement('td')
      newCell.style.padding = '8px'
      newCell.style.border = '1px solid #ccc'
      newCell.innerHTML = '&nbsp;'
      
      if (cellIndex === tableRow.cells.length - 1) {
        tableRow.appendChild(newCell)
      } else if (tableRow.cells[cellIndex + 1]) {
        tableRow.insertBefore(newCell, tableRow.cells[cellIndex + 1])
      } else {
        tableRow.appendChild(newCell)
      }
    })
    updateContent()
  }

  // Delete current column
  const deleteColumn = () => {
    const tableInfo = getCurrentTable()
    if (!tableInfo) return
    
    const { table, cell } = tableInfo
    const row = cell.parentElement
    
    // Verify cell is still in the table
    if (!table.contains(cell)) return
    
    const cellIndex = Array.from(row.cells).indexOf(cell)
    
    if (table.rows[0] && table.rows[0].cells.length > 1) {
      Array.from(table.rows).forEach(tableRow => {
        if (tableRow.cells[cellIndex]) {
          tableRow.cells[cellIndex].remove()
        }
      })
      updateContent()
    } else {
      alert("Cannot delete the last column. Delete the entire table instead.")
    }
  }

  // Open delete table confirmation modal
  const deleteTable = () => {
    const tableInfo = getCurrentTable()
    if (!tableInfo) return
    pendingTableDeleteRef.current = tableInfo
    setShowDeleteTableConfirm(true)
  }

  // Perform delete table after user confirms in modal
  const handleConfirmDeleteTable = () => {
    const tableInfo = pendingTableDeleteRef.current
    if (tableInfo) {
      tableInfo.table.remove()
      updateContent()
    }
    pendingTableDeleteRef.current = null
    setShowDeleteTableConfirm(false)
  }

  // Update content after table modification
  const updateContent = () => {
    if (onChange && editorRef.current) {
      onChange(editorRef.current.innerHTML || "")
    }
  }

  // Check if cursor is in a table
  const checkTableSelection = () => {
    const selection = window.getSelection()
    if (selection.rangeCount === 0) {
      setIsTableSelected(false)
      return
    }
    
    let node = selection.anchorNode
    while (node && node !== editorRef.current) {
      if (node.nodeName === 'TD' || node.nodeName === 'TH' || node.nodeName === 'TABLE') {
        setIsTableSelected(true)
        return
      }
      node = node.parentElement
    }
    setIsTableSelected(false)
  }

  // Listen for selection changes to detect table selection
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    const handleSelectionChange = () => {
      checkTableSelection()
      updateToolbarState()
    }

    document.addEventListener('selectionchange', handleSelectionChange)
    editor.addEventListener('click', handleSelectionChange)
    editor.addEventListener('keyup', handleSelectionChange)

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
      editor.removeEventListener('click', handleSelectionChange)
      editor.removeEventListener('keyup', handleSelectionChange)
    }
  }, [])

  const insertVariable = (variableKey) => {
    const placeholder = `{{${variableKey}}}`
    const placeholderHTML = `<span class="variable-placeholder" data-variable="${variableKey}" contenteditable="false" style="background-color: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-weight: 600; border: 1px solid #fbbf24; display: inline-block; margin: 0 2px;">${placeholder}</span>`
    executeCommand("insertHTML", placeholderHTML)
    setShowVariablesMenu(false)
  }

  const colors = [
    "#000000", "#333333", "#666666", "#999999", "#CCCCCC",
    "#FF0000", "#FF6600", "#FFCC00", "#33CC00", "#0066FF",
    "#6600FF", "#FF00FF", "#FF0066", "#00CCFF", "#00FF66"
  ]

  // Initialize and sync editor content — never overwrite while user is typing inside the editor
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    const active = document.activeElement
    if (active === editor || editor.contains(active)) return

    const currentContent = editor.innerHTML || ""
    if ((value || "") !== currentContent) {
      editor.innerHTML = value || ""
    }
  }, [value])

  const isAgreement = variant === "agreement"
  const isEmail = variant === "email"
  const shellClass = isEmail
    ? "flex h-[min(480px,58vh)] flex-col overflow-hidden rounded-2xl border-2 border-slate-300 bg-white shadow-sm"
    : "border-2 border-slate-200 rounded-lg overflow-hidden bg-white"
  const toolbarClass = isEmail
    ? `flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-3 py-2.5${readOnly ? " pointer-events-none opacity-50" : ""}`
    : `border-b border-slate-200 bg-slate-50 p-2 flex flex-wrap items-center gap-1${readOnly ? " pointer-events-none opacity-50" : ""}`
  const toolbarBtnActive = isEmail ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/80" : "bg-emerald-200 text-emerald-800"
  const toolbarBtnIdle = isEmail ? "text-slate-600 hover:bg-slate-100" : "hover:bg-slate-200"
  const toolbarDivider = isEmail ? "border-r border-slate-200/80 pr-2 mr-2" : "border-r border-slate-300 pr-2 mr-2"

  return (
    <div className={shellClass}>
      {/* Toolbar */}
      <div className={`${toolbarClass}${isEmail ? " shrink-0" : ""}`}>
        {/* Headings */}
        <div className={`flex items-center gap-1 ${toolbarDivider}`}>
          <button
            type="button"
            onClick={() => executeCommand("formatBlock", "h1")}
            className={`px-2 py-1 rounded text-sm font-bold ${toolbarState.formatBlock === "h1" ? toolbarBtnActive : toolbarBtnIdle}`}
            title="Heading 1"
          >
            H1
          </button>
          <button
            type="button"
            onClick={() => executeCommand("formatBlock", "h2")}
            className={`px-2 py-1 rounded text-sm font-bold ${toolbarState.formatBlock === "h2" ? toolbarBtnActive : toolbarBtnIdle}`}
            title="Heading 2"
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => executeCommand("formatBlock", "h3")}
            className={`px-2 py-1 rounded text-sm font-bold ${toolbarState.formatBlock === "h3" ? toolbarBtnActive : toolbarBtnIdle}`}
            title="Heading 3"
          >
            H3
          </button>
          {variant === "agreement" && (
            <>
              <button
                type="button"
                onClick={() => executeCommand("formatBlock", "h4")}
                className={`px-2 py-1 rounded text-sm font-bold ${toolbarState.formatBlock === "h4" ? toolbarBtnActive : toolbarBtnIdle}`}
                title="Heading 4"
              >
                H4
              </button>
              <button
                type="button"
                onClick={() => executeCommand("formatBlock", "p")}
                className={`px-2 py-1 rounded text-xs font-semibold ${toolbarState.formatBlock === "p" || toolbarState.formatBlock === "" ? toolbarBtnActive : toolbarBtnIdle}`}
                title="Normal paragraph"
              >
                P
              </button>
            </>
          )}
        </div>

        {/* Font Styles */}
        <div className="flex items-center gap-1 border-r border-slate-300 pr-2 mr-2">
          <button
            type="button"
            onClick={() => executeCommand("bold")}
            className={`px-2 py-1 rounded ${toolbarState.bold ? toolbarBtnActive : toolbarBtnIdle}`}
            title="Bold"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand("italic")}
            className={`px-2 py-1 rounded ${toolbarState.italic ? toolbarBtnActive : toolbarBtnIdle}`}
            title="Italic"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand("underline")}
            className={`px-2 py-1 rounded ${toolbarState.underline ? toolbarBtnActive : toolbarBtnIdle}`}
            title="Underline"
          >
            <Underline className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand("strikeThrough")}
            className={`px-2 py-1 rounded ${toolbarState.strikeThrough ? toolbarBtnActive : toolbarBtnIdle}`}
            title="Strikethrough"
          >
            <Strikethrough className="w-4 h-4" />
          </button>
        </div>

        {/* Font Color */}
        <div className="relative border-r border-slate-300 pr-2 mr-2 color-picker-container">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setShowColorPicker(!showColorPicker)
            }}
            className="px-2 py-1 rounded hover:bg-slate-100 flex items-center gap-1"
            title="Font Color"
          >
            <Type className="w-4 h-4" />
            <div className="w-3 h-3 bg-black rounded"></div>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showColorPicker && (
            <div 
              className="absolute top-full left-0 mt-1 bg-white border-2 border-slate-200 rounded-lg shadow-lg p-2 z-50"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="grid grid-cols-5 gap-1">
                {colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      editorRef.current?.focus()
                      executeCommand("foreColor", color)
                      setShowColorPicker(false)
                    }}
                    className="w-6 h-6 rounded border border-slate-300 hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Text Alignment */}
        <div className="flex items-center gap-1 border-r border-slate-300 pr-2 mr-2">
          <button
            type="button"
            onClick={() => executeCommand("justifyLeft")}
            className={`px-2 py-1 rounded ${toolbarState.justifyLeft ? toolbarBtnActive : toolbarBtnIdle}`}
            title="Align Left"
          >
            <AlignLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand("justifyCenter")}
            className={`px-2 py-1 rounded ${toolbarState.justifyCenter ? toolbarBtnActive : toolbarBtnIdle}`}
            title="Align Center"
          >
            <AlignCenter className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand("justifyRight")}
            className={`px-2 py-1 rounded ${toolbarState.justifyRight ? toolbarBtnActive : toolbarBtnIdle}`}
            title="Align Right"
          >
            <AlignRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand("justifyFull")}
            className={`px-2 py-1 rounded ${toolbarState.justifyFull ? toolbarBtnActive : toolbarBtnIdle}`}
            title="Justify"
          >
            <AlignJustify className="w-4 h-4" />
          </button>
        </div>

        {/* Lists */}
        <div className="flex items-center gap-1 border-r border-slate-300 pr-2 mr-2">
          <button
            type="button"
            onClick={() => executeCommand("insertUnorderedList")}
            className={`px-2 py-1 rounded ${toolbarState.unorderedList ? toolbarBtnActive : toolbarBtnIdle}`}
            title="Bullet List"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand("insertOrderedList")}
            className={`px-2 py-1 rounded ${toolbarState.orderedList ? toolbarBtnActive : toolbarBtnIdle}`}
            title="Numbered List"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
        </div>

        {showVariables && (
          <div className="relative border-r border-slate-300 pr-2 mr-2 variables-menu-container">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowVariablesMenu(!showVariablesMenu)
                setShowColorPicker(false)
              }}
              className="px-2 py-1 rounded hover:bg-slate-200 flex items-center gap-1 text-sm font-medium text-emerald-700"
              title="Insert Variable"
            >
              <Variable className="w-4 h-4" />
              <span className="text-xs">Variables</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {showVariablesMenu && (
              <div
                className="absolute top-full left-0 mt-1 bg-white border-2 border-slate-200 rounded-lg shadow-lg z-50 min-w-[200px] max-h-64 overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-2">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-2">Dynamic Variables</div>
                  <div className="space-y-1">
                    {availableVariables.map((variable) => (
                      <button
                        key={variable.key}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          insertVariable(variable.key)
                        }}
                        className="w-full text-left px-3 py-2 rounded hover:bg-emerald-50 hover:text-emerald-700 transition-colors text-sm flex items-center justify-between group"
                      >
                        <span className="font-medium">{variable.label}</span>
                        <span className="text-xs text-slate-400 group-hover:text-emerald-500 font-mono">
                          {`{{${variable.key}}}`}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Table Tools */}
        <div className="flex items-center gap-1 border-r border-slate-300 pr-2 mr-2">
          <button
            type="button"
            onClick={insertTable}
            className="px-2 py-1 rounded hover:bg-slate-200"
            title="Insert Table"
          >
            <Table className="w-4 h-4" />
          </button>
          
          {/* Table editing buttons - only show when table is selected */}
          {isTableSelected && (
            <>
              <div className="w-px h-6 bg-slate-300 mx-1"></div>
              <button
                type="button"
                onClick={addRowAbove}
                className="px-2 py-1 rounded hover:bg-slate-100 flex items-center gap-1"
                title="Add Row Above"
              >
                <Plus className="w-3 h-3" />
                <Rows className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={addRowBelow}
                className="px-2 py-1 rounded hover:bg-slate-100 flex items-center gap-1"
                title="Add Row Below"
              >
                <Rows className="w-3 h-3" />
                <Plus className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={deleteRow}
                className="px-2 py-1 rounded hover:bg-slate-100 flex items-center gap-1"
                title="Delete Row"
              >
                <Rows className="w-3 h-3" />
                <Minus className="w-3 h-3" />
              </button>
              <div className="w-px h-6 bg-slate-300 mx-1"></div>
              <button
                type="button"
                onClick={addColumnLeft}
                className="px-2 py-1 rounded hover:bg-slate-100 flex items-center gap-1"
                title="Add Column Left"
              >
                <Plus className="w-3 h-3" />
                <Columns className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={addColumnRight}
                className="px-2 py-1 rounded hover:bg-slate-100 flex items-center gap-1"
                title="Add Column Right"
              >
                <Columns className="w-3 h-3" />
                <Plus className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={deleteColumn}
                className="px-2 py-1 rounded hover:bg-slate-100 flex items-center gap-1"
                title="Delete Column"
              >
                <Columns className="w-3 h-3" />
                <Minus className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={deleteTable}
                className="px-2 py-1 rounded hover:bg-red-200 text-red-600 flex items-center gap-1"
                title="Delete Table"
              >
                <Table className="w-3 h-3" />
                <Minus className="w-3 h-3" />
              </button>
            </>
          )}
        </div>

        {/* Other Tools */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={insertLink}
            className="px-2 py-1 rounded hover:bg-slate-200"
            title="Insert Link"
          >
            <Link className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand("formatBlock", "blockquote")}
            className={`px-2 py-1 rounded ${toolbarState.blockquote ? toolbarBtnActive : toolbarBtnIdle}`}
            title="Quote"
          >
            <Quote className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand("formatBlock", "pre")}
            className={`px-2 py-1 rounded ${toolbarState.pre ? toolbarBtnActive : toolbarBtnIdle}`}
            title="Code Block"
          >
            <Code className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand("removeFormat")}
            className="px-2 py-1 rounded hover:bg-slate-200"
            title="Clear Formatting"
          >
            <span className="text-xs font-bold">Tx</span>
          </button>
        </div>
      </div>

      {variant === "agreement" && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-2 py-2">
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            Size
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) applyFontSize(e.target.value)
                e.target.value = ""
              }}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-emerald-400"
              title="Font size"
            >
              <option value="">—</option>
              {AGREEMENT_FONT_SIZES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}px
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            Line
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) applyLineHeight(e.target.value)
                e.target.value = ""
              }}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-emerald-400"
              title="Line spacing"
            >
              <option value="">—</option>
              {AGREEMENT_LINE_HEIGHTS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            Space
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) applyParagraphSpacing(e.target.value)
                e.target.value = ""
              }}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-emerald-400"
              title="Paragraph spacing"
            >
              <option value="">—</option>
              {AGREEMENT_PARAGRAPH_SPACING.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <div className="mx-1 h-6 w-px bg-slate-200" />

          <button
            type="button"
            onClick={() => executeCommand("indent")}
            className="rounded px-2 py-1 hover:bg-slate-100"
            title="Increase indent"
          >
            <IndentIncrease className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand("outdent")}
            className="rounded px-2 py-1 hover:bg-slate-100"
            title="Decrease indent"
          >
            <IndentDecrease className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand("subscript")}
            className="rounded px-2 py-1 hover:bg-slate-100"
            title="Subscript"
          >
            <Subscript className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand("superscript")}
            className="rounded px-2 py-1 hover:bg-slate-100"
            title="Superscript"
          >
            <Superscript className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand("insertHorizontalRule")}
            className="rounded px-2 py-1 hover:bg-slate-100"
            title="Horizontal line"
          >
            <SeparatorHorizontal className="h-4 w-4" />
          </button>

          <div className="relative highlight-picker-container">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowHighlightPicker(!showHighlightPicker)
                setShowColorPicker(false)
              }}
              className="flex items-center gap-1 rounded px-2 py-1 hover:bg-slate-100"
              title="Highlight color"
            >
              <Highlighter className="h-4 w-4" />
            </button>
            {showHighlightPicker && (
              <div
                className="absolute left-0 top-full z-50 mt-1 rounded-lg border-2 border-slate-200 bg-white p-2 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex gap-1">
                  {HIGHLIGHT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        editorRef.current?.focus()
                        executeCommand("hiliteColor", color)
                        setShowHighlightPicker(false)
                      }}
                      className="h-6 w-6 rounded border border-slate-300 hover:scale-110"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Editor — scroll on wrapper; contenteditable grows naturally inside */}
      {isEmail ? (
        <div className="email-editor-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar-light">
          <div
            ref={editorRef}
            role="textbox"
            tabIndex={readOnly ? -1 : 0}
            spellCheck
            contentEditable={readOnly ? false : true}
            onInput={readOnly ? undefined : handleInput}
            onPaste={readOnly ? undefined : handlePaste}
            onFocus={readOnly ? undefined : updateToolbarState}
            onKeyDown={readOnly ? (e) => e.preventDefault() : undefined}
            onBlur={
              readOnly
                ? undefined
                : () => {
                    if (onChange && editorRef.current) {
                      onChange(editorRef.current.innerHTML || "")
                    }
                    clearToolbarState()
                  }
            }
            suppressContentEditableWarning
            className={`email-content-editor min-h-[280px] max-w-none outline-none focus:ring-2 focus:ring-emerald-500/30 text-slate-900 ${
              readOnly ? "cursor-default" : "cursor-text"
            }`}
            style={{
              fontFamily: "inherit",
            }}
            data-placeholder={placeholder}
            aria-readonly={readOnly || undefined}
          />
        </div>
      ) : (
        <div
          ref={editorRef}
          role="textbox"
          tabIndex={readOnly ? -1 : 0}
          spellCheck
          contentEditable={readOnly ? false : true}
          onInput={readOnly ? undefined : handleInput}
          onPaste={readOnly ? undefined : handlePaste}
          onFocus={readOnly ? undefined : updateToolbarState}
          onKeyDown={readOnly ? (e) => e.preventDefault() : undefined}
          onBlur={
            readOnly
              ? undefined
              : () => {
                  if (onChange && editorRef.current) {
                    onChange(editorRef.current.innerHTML || "")
                  }
                  clearToolbarState()
                }
          }
          suppressContentEditableWarning
          className={`${
            isAgreement ? "min-h-[480px]" : "min-h-[300px]"
          } outline-none focus:ring-2 focus:ring-green-500 ${
            isAgreement
              ? "prose prose-sm max-w-none text-slate-800 agreement-content-editor p-4"
              : "prose prose-sm max-w-none p-4 text-slate-800"
          } ${readOnly ? "cursor-default" : "cursor-text"}`}
          style={{
            fontFamily: isAgreement ? "Georgia, 'Times New Roman', Times, serif" : "inherit",
          }}
          data-placeholder={placeholder}
          aria-readonly={readOnly || undefined}
        />
      )}
      
      <style jsx global>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
        [contenteditable] table {
          border-collapse: collapse;
          width: 100%;
          margin: 10px 0;
        }
        [contenteditable]:not(.email-content-editor) table td,
        [contenteditable]:not(.email-content-editor) table th {
          border: 1px solid #ccc;
          padding: 8px;
        }
        [contenteditable] blockquote {
          border-left: 4px solid #ccc;
          padding-left: 16px;
          margin: 10px 0;
          font-style: italic;
        }
        [contenteditable] pre {
          background: #f5f5f5;
          padding: 10px;
          border-radius: 4px;
          overflow-x: auto;
        }
        [contenteditable] a {
          color: #0066cc;
          text-decoration: underline;
        }
        [contenteditable] ul,
        [contenteditable] ol {
          margin: 0.5em 0;
          padding-left: 2em;
        }
        [contenteditable] ul {
          list-style-type: disc;
        }
        [contenteditable] ol {
          list-style-type: decimal;
        }
        [contenteditable] li {
          display: list-item;
          margin: 0.25em 0;
        }
        [contenteditable] .variable-placeholder {
          background-color: #fef3c7 !important;
          color: #92400e !important;
          padding: 2px 6px !important;
          border-radius: 4px !important;
          font-weight: 600 !important;
          border: 1px solid #fbbf24 !important;
          display: inline-block !important;
          margin: 0 2px !important;
          font-family: monospace !important;
          cursor: default !important;
        }
        [contenteditable].agreement-content-editor {
          line-height: 1.65;
          font-size: 15px;
          color: #1d1d1f;
          text-align: justify;
        }
        [contenteditable].agreement-content-editor h1,
        [contenteditable].agreement-content-editor h2,
        [contenteditable].agreement-content-editor h3,
        [contenteditable].agreement-content-editor h4 {
          color: #1e293b;
          font-weight: 700;
          margin: 14px 0 8px;
        }
        [contenteditable].agreement-content-editor hr {
          border: none;
          border-top: 1px solid #e2e8f0;
          margin: 16px 0;
        }
        [contenteditable].agreement-content-editor p {
          margin: 8px 0;
          line-height: 1.55;
        }
        [contenteditable].agreement-content-editor strong,
        [contenteditable].agreement-content-editor b {
          color: #1e293b;
          font-weight: 600;
        }
        [contenteditable].agreement-content-editor table,
        [contenteditable].agreement-content-editor .agreement-rich-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
          font-size: 14px;
          border: 1px solid #e2e8f0;
        }
        [contenteditable].agreement-content-editor table th,
        [contenteditable].agreement-content-editor .agreement-rich-table th {
          background: #f8fafc;
          color: #334155;
          padding: 12px 14px;
          text-align: left;
          font-weight: 600;
          border-bottom: 2px solid #e2e8f0;
        }
        [contenteditable].agreement-content-editor table td,
        [contenteditable].agreement-content-editor .agreement-rich-table td {
          padding: 12px 14px;
          border-bottom: 1px solid #e2e8f0;
          color: #334155;
          vertical-align: top;
        }
        [contenteditable].agreement-content-editor table tbody tr:nth-child(even) td,
        [contenteditable].agreement-content-editor .agreement-rich-table tbody tr:nth-child(even) td {
          background: #f8fafc;
        }
        [contenteditable].email-content-editor {
          line-height: 1.65;
          font-size: 15px;
          color: #0f172a;
          background: #ffffff;
          padding: 1.25rem 1.5rem !important;
          opacity: 1 !important;
          -webkit-user-modify: read-write;
          user-select: text;
          caret-color: #0f172a;
          overflow: visible;
        }
        .email-editor-scroll {
          overflow-y: auto !important;
          overflow-x: hidden;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
          scrollbar-gutter: stable;
        }
        [contenteditable].email-content-editor * {
          opacity: 1 !important;
        }
        [contenteditable].email-content-editor p {
          margin: 0 0 0.85em;
          color: #334155;
        }
        [contenteditable].email-content-editor .email-kpi-grid {
          display: flex !important;
          flex-wrap: wrap !important;
          gap: 8px !important;
          margin: 0 0 18px !important;
        }
        [contenteditable].email-content-editor .email-kpi-grid > div {
          pointer-events: auto;
        }
        [contenteditable].email-content-editor strong,
        [contenteditable].email-content-editor b {
          color: #0f172a;
          font-weight: 700;
        }
        [contenteditable].email-content-editor table[role="presentation"] {
          margin: 0.5rem 0 1rem;
          table-layout: fixed;
          width: 100% !important;
          min-width: 520px;
        }
        [contenteditable].email-content-editor table[role="presentation"] > tbody > tr > td[width="25%"] {
          border: none !important;
          vertical-align: top;
          width: 25% !important;
          padding: 4px !important;
        }
        [contenteditable].email-content-editor table[role="presentation"] > tbody > tr > td:not([width="25%"]) {
          border: none !important;
          width: auto !important;
          padding: 16px 20px !important;
        }
        [contenteditable].email-content-editor table[role="presentation"] table[role="presentation"] {
          width: 100% !important;
          margin: 0 !important;
          display: table !important;
        }
        [contenteditable].email-content-editor table[role="presentation"] table[role="presentation"] td {
          border: none !important;
          padding: 14px 10px !important;
        }
        [contenteditable].email-content-editor table[role="presentation"] table[role="presentation"] td div {
          color: inherit;
        }
      `}</style>

      {/* Delete Table Confirmation Modal */}
      {showDeleteTableConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-red-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-bold text-white">Delete Table</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-700">
                Are you sure you want to delete the entire table?
              </p>
              <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    pendingTableDeleteRef.current = null
                    setShowDeleteTableConfirm(false)
                  }}
                  className="px-5 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteTable}
                  className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 shadow-sm transition-all"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

