/**
 * Parse CRF HTML content into sections and controls.
 * Used by CRFDesigner (load) and manage page (view) so preview and view render identically,
 * including table cellTypes and columnOptionValues.
 */
export function parseHtmlContent(htmlContent) {
  if (!htmlContent || typeof htmlContent !== 'string') {
    return []
  }

  try {
    // Decode HTML-escaped values coming from the designer HTML (e.g. &lt;once/week&gt; -> <once/week>).
    const decodeHtmlEntities = (str) => {
      if (!str || typeof str !== 'string') return str
      try {
        const textarea = document.createElement('textarea')
        textarea.innerHTML = str
        return textarea.value
      } catch {
        return str
      }
    }

    const parser = new DOMParser()
    const doc = parser.parseFromString(htmlContent, 'text/html')
    const crfForm = doc.querySelector('.crf-form')

    if (!crfForm) {
      console.warn("No .crf-form found in HTML content")
      return []
    }

    const sections = []
    const sectionElements = crfForm.querySelectorAll('.crf-section')

    sectionElements.forEach((sectionEl) => {
      const sectionId = sectionEl.getAttribute('data-section-id') || `section_${Date.now()}`
      const titleEl = sectionEl.querySelector('.section-title')
      const sectionName = titleEl ? (titleEl.textContent || titleEl.innerText || 'Untitled Section').trim() : 'Untitled Section'

      const controls = []
      const controlWrappers = sectionEl.querySelectorAll('.control-wrapper')

      controlWrappers.forEach((wrapper, wrapperIndex) => {
        let controlId = (wrapper.getAttribute('data-control-id') || '').trim()
        if (!controlId) {
          const idEl = wrapper.querySelector(
            'input[id], select[id], textarea[id], table[id], .label-control[id]',
          )
          controlId = (idEl?.getAttribute('id') || '').trim()
        }
        if (!controlId) {
          controlId = `ctrl_${Date.now()}_${wrapperIndex}`
        }
        const styleAttr = wrapper.getAttribute('style') || ''
        const widthMatch = styleAttr.match(/width:\s*(\d+(?:\.\d+)?)%/)
        const widthPercent = widthMatch ? parseFloat(widthMatch[1]) : 100
        const controlSize = Math.round((widthPercent / 100) * 12) || 12

        const labelEl = wrapper.querySelector('.control-label')
        let labelText = ''
        if (labelEl) {
          const labelClone = labelEl.cloneNode(true)
          const requiredSpan = labelClone.querySelector('.required')
          if (requiredSpan) requiredSpan.remove()
          labelText = (labelClone.textContent || labelClone.innerText || '').trim()
        }

        const properties = { labelText: labelText }

        let controlType = 'text'
        let inputEl = null
        const explicitControlType = (wrapper.getAttribute("data-control-type") || "").trim().toLowerCase()

        const labelControl = wrapper.querySelector('.label-control')
        const hrControl = wrapper.querySelector('hr.divider-control, hr')
        const tableControl = wrapper.querySelector('table.table-control, table')

        if (labelControl) {
          controlType = 'label'
          inputEl = labelControl
        } else if (hrControl) {
          controlType = 'hr'
          inputEl = hrControl
        } else if (tableControl) {
          controlType = 'table'
          inputEl = tableControl
          const columns = tableControl.getAttribute('data-columns') || tableControl.querySelectorAll('th').length || 1
          const rows = tableControl.getAttribute('data-rows') || tableControl.querySelectorAll('tbody tr').length || 1
          properties.columns = parseInt(columns)
          properties.rows = parseInt(rows)
          const thEls = tableControl.querySelectorAll('thead th')
          if (thEls.length > 0) {
            properties.columnHeaders = Array.from(thEls).map(th => (th.textContent || '').replace(/\s*\*\s*$/, '').trim())
          }
          const reqCol = tableControl.getAttribute('data-required-column')
          if (reqCol !== null && reqCol !== '') properties.requiredColumn = parseInt(reqCol, 10)
          const reqRow = tableControl.getAttribute('data-required-row')
          if (reqRow !== null && reqRow !== '') properties.requiredRow = parseInt(reqRow, 10)
          const colTypes = tableControl.getAttribute('data-column-types')
          if (colTypes) {
            try {
              properties.columnTypes = colTypes.split(',').map(s => s.trim()).filter(Boolean)
            } catch (_) {}
          }
          const cellTypesAttr = tableControl.getAttribute('data-cell-types')
          if (cellTypesAttr) {
            try {
              properties.cellTypes = JSON.parse(decodeURIComponent(cellTypesAttr))
            } catch (_) {}
          }
          const columnAlignmentAttr = tableControl.getAttribute('data-column-alignment')
          if (columnAlignmentAttr) {
            try {
              properties.columnAlignment = JSON.parse(decodeURIComponent(columnAlignmentAttr))
            } catch (_) {}
          }
          const columnOptionValuesAttr = tableControl.getAttribute('data-column-option-values')
          if (columnOptionValuesAttr) {
            try {
              properties.columnOptionValues = JSON.parse(decodeURIComponent(columnOptionValuesAttr))
            } catch (_) {}
          }
          const columnDateRestrictionsAttr = tableControl.getAttribute('data-column-date-restrictions')
          if (columnDateRestrictionsAttr) {
            try {
              properties.columnDateRestrictions = JSON.parse(decodeURIComponent(columnDateRestrictionsAttr))
            } catch (_) {}
          }
          const columnTerminologyCodingAttr = tableControl.getAttribute('data-column-terminology-coding')
          if (columnTerminologyCodingAttr) {
            try {
              properties.columnTerminologyCoding = JSON.parse(decodeURIComponent(columnTerminologyCodingAttr))
            } catch (_) {}
          }
          const columnDateMinFromFieldAttr = tableControl.getAttribute('data-column-date-min-from-field')
          if (columnDateMinFromFieldAttr) {
            try {
              properties.columnDateMinFromField = JSON.parse(decodeURIComponent(columnDateMinFromFieldAttr))
            } catch (_) {}
          }
          const columnDateMaxFromFieldAttr = tableControl.getAttribute('data-column-date-max-from-field')
          if (columnDateMaxFromFieldAttr) {
            try {
              properties.columnDateMaxFromField = JSON.parse(decodeURIComponent(columnDateMaxFromFieldAttr))
            } catch (_) {}
          }
          const cellLabelsAttr = tableControl.getAttribute('data-cell-labels')
          if (cellLabelsAttr) {
            try {
              properties.cellLabels = JSON.parse(decodeURIComponent(cellLabelsAttr))
            } catch (_) {}
          }
          const cellLabTestIdsAttr = tableControl.getAttribute('data-cell-lab-test-ids')
          if (cellLabTestIdsAttr) {
            try {
              properties.cellLabTestIds = JSON.parse(decodeURIComponent(cellLabTestIdsAttr))
            } catch (_) {}
          }
          const cellLabTestLabelsAttr = tableControl.getAttribute('data-cell-lab-test-labels')
          if (cellLabTestLabelsAttr) {
            try {
              properties.cellLabTestLabels = JSON.parse(decodeURIComponent(cellLabTestLabelsAttr))
            } catch (_) {}
          }
          const requiredCellsAttr = tableControl.getAttribute('data-required-cells')
          if (requiredCellsAttr) {
            try {
              const parsedRequiredCells = JSON.parse(decodeURIComponent(requiredCellsAttr))
              if (Array.isArray(parsedRequiredCells)) {
                properties.requiredCells = parsedRequiredCells.filter(c => c && c.row != null && c.col != null)
              }
            } catch (_) {}
          }
          const addRowAttr = tableControl.getAttribute('data-add-row')
          if (addRowAttr !== null && addRowAttr !== '') properties.addRow = addRowAttr === 'true'
          const maxRowsAttr = tableControl.getAttribute('data-max-rows')
          if (maxRowsAttr !== null && maxRowsAttr !== '') properties.maxRows = parseInt(maxRowsAttr, 10)
          const hasParsedColumnTerminology =
            Array.isArray(properties.columnTerminologyCoding) &&
            properties.columnTerminologyCoding.some((x) => x && String(x).trim())
          if (!properties.cellTypes?.length || !properties.columnAlignment?.length || !properties.columnOptionValues?.length || !properties.columnDateRestrictions?.length || !hasParsedColumnTerminology || !properties.columnDateMinFromField?.length || !properties.columnDateMaxFromField?.length || !properties.cellLabels?.length || !(Array.isArray(properties.cellLabTestIds) && properties.cellLabTestIds.length) || !(Array.isArray(properties.cellLabTestLabels) && properties.cellLabTestLabels.length) || !properties.requiredCells?.length || properties.addRow === undefined) {
            for (let i = 0; i < tableControl.childNodes.length; i++) {
              const node = tableControl.childNodes[i]
              if (node.nodeType === 8 && node.textContent?.trim().startsWith('crf-table-data:')) {
                try {
                  const raw = node.textContent.trim().replace(/^crf-table-data:\s*/, '')
                  const data = JSON.parse(decodeURIComponent(raw))
                  if (data.cellTypes && Array.isArray(data.cellTypes)) properties.cellTypes = data.cellTypes
                  if (data.columnAlignment && Array.isArray(data.columnAlignment)) properties.columnAlignment = data.columnAlignment
                  if (data.columnOptionValues && Array.isArray(data.columnOptionValues)) properties.columnOptionValues = data.columnOptionValues
                  if (data.columnDateRestrictions && Array.isArray(data.columnDateRestrictions)) properties.columnDateRestrictions = data.columnDateRestrictions
                  if (data.columnTerminologyCoding && Array.isArray(data.columnTerminologyCoding)) properties.columnTerminologyCoding = data.columnTerminologyCoding
                  if (data.columnDateMinFromField && Array.isArray(data.columnDateMinFromField)) properties.columnDateMinFromField = data.columnDateMinFromField
                  if (data.columnDateMaxFromField && Array.isArray(data.columnDateMaxFromField)) properties.columnDateMaxFromField = data.columnDateMaxFromField
                  if (data.cellLabels && Array.isArray(data.cellLabels)) properties.cellLabels = data.cellLabels
                  if (data.cellLabTestIds && Array.isArray(data.cellLabTestIds)) properties.cellLabTestIds = data.cellLabTestIds
                  if (data.cellLabTestLabels && Array.isArray(data.cellLabTestLabels)) properties.cellLabTestLabels = data.cellLabTestLabels
                  if (data.requiredCells && Array.isArray(data.requiredCells)) properties.requiredCells = data.requiredCells.filter(c => c && c.row != null && c.col != null)
                  if (data.addRow !== undefined) properties.addRow = data.addRow === true
                  if (data.maxRows != null) properties.maxRows = parseInt(data.maxRows, 10)
                } catch (_) {}
                break
              }
            }
          }
        } else {
          inputEl = wrapper.querySelector('input, select, textarea')
          if (!inputEl) return

          const inputType = inputEl.tagName.toLowerCase()
          const type = inputEl.getAttribute('type') || 'text'

          if (explicitControlType === "ukunkdate" || inputEl.classList.contains("ukunk-date-control")) {
            controlType = "ukunkdate"
          } else if (inputEl.classList.contains('lab-control')) {
            controlType = 'lab'
          } else if (inputType === 'select') {
            controlType = 'select'
          } else if (inputType === 'textarea') {
            controlType = 'textarea'
          } else if (type === 'number') {
            controlType = 'number'
          } else if (type === 'date') {
            controlType = 'date'
          } else if (type === 'time') {
            controlType = 'time'
          } else if (type === 'file') {
            controlType = 'file'
          } else if (type === 'checkbox') {
            controlType = 'checkbox'
          } else if (type === 'radio') {
            controlType = 'radio'
          } else {
            controlType = 'text'
          }

          properties.required = inputEl.hasAttribute('required') || labelEl?.querySelector('.required') !== null
          properties.readonly =
            inputEl.hasAttribute('readonly') ||
            inputEl.hasAttribute('readOnly') ||
            wrapper.getAttribute('data-readonly') === 'true'
          if (properties.readonly) {
            properties.designerReadonly = true
          }
          properties.placeholder = inputEl.getAttribute('placeholder') || ''
          properties.defaultValue = inputEl.getAttribute('value') || (inputEl.tagName === 'TEXTAREA' ? inputEl.textContent : '')
          if (inputEl.getAttribute('maxlength')) properties.maxLength = parseInt(inputEl.getAttribute('maxlength'))
          if (inputEl.getAttribute('min')) properties.min = parseFloat(inputEl.getAttribute('min'))
          if (inputEl.getAttribute('max')) properties.max = parseFloat(inputEl.getAttribute('max'))
          if (inputEl.getAttribute('step')) properties.step = parseFloat(inputEl.getAttribute('step'))

          if (controlType === 'file') {
            const accept = inputEl.getAttribute('accept')
            if (accept) properties.accept = accept
            if (inputEl.hasAttribute('multiple')) properties.multiple = true
          }
          if (controlType === 'date' || controlType === "ukunkdate") {
            const minDate = inputEl.getAttribute('min')
            if (minDate) properties.minDate = minDate
            const maxDate = inputEl.getAttribute('max')
            if (maxDate) properties.maxDate = maxDate
          }
        }

        const tooltip = wrapper.getAttribute('data-tooltip')
        if (tooltip) properties.tooltip = tooltip
        const prefix = wrapper.getAttribute('data-prefix')
        if (prefix != null && prefix !== '') properties.prefix = prefix
        const postfix = wrapper.getAttribute('data-postfix')
        if (postfix != null && postfix !== '') properties.postfix = postfix
        const defaultFromAttr = wrapper.getAttribute('data-default-value')
        const hasDefault =
          properties.defaultValue !== undefined &&
          properties.defaultValue !== null &&
          String(properties.defaultValue).trim() !== ""
        if (defaultFromAttr != null && defaultFromAttr !== '' && !hasDefault) {
          properties.defaultValue = decodeHtmlEntities(defaultFromAttr)
        }
        const labelPosition = wrapper.getAttribute('data-label-position')
        if (labelPosition) properties.labelPosition = labelPosition
        const fontWeight = wrapper.getAttribute('data-font-weight')
        if (fontWeight) properties.fontWeight = fontWeight
        const textDecoration = wrapper.getAttribute('data-text-decoration')
        if (textDecoration) properties.textDecoration = textDecoration
        const multiline = wrapper.getAttribute('data-multiline')
        if (multiline === 'true') properties.multiline = true
        const scale = wrapper.getAttribute('data-scale')
        if (scale != null && String(scale).trim() !== '') properties.scale = parseFloat(scale)
        const dateRestriction = wrapper.getAttribute('data-date-restriction')
        if (dateRestriction) properties.dateRestriction = dateRestriction
        const isVisitDateAttr = wrapper.getAttribute('data-is-visit-date')
        if (isVisitDateAttr === 'true') properties.isVisitDate = true
        const minDateFromFieldId = wrapper.getAttribute('data-date-min-from-field')
        if (minDateFromFieldId) properties.minDateFromFieldId = minDateFromFieldId
        const maxDateFromFieldId = wrapper.getAttribute('data-date-max-from-field')
        if (maxDateFromFieldId) properties.maxDateFromFieldId = maxDateFromFieldId
        const genderSpecific = wrapper.getAttribute("data-gender-specific")
        if (genderSpecific) properties.genderSpecific = String(genderSpecific).toLowerCase()
        const labTestIdAttr = wrapper.getAttribute('data-lab-test-id')
        if (labTestIdAttr) properties.labTestId = decodeHtmlEntities(labTestIdAttr)
        const labTestLabelAttr = wrapper.getAttribute('data-lab-test-label')
        if (labTestLabelAttr) properties.labTestLabel = decodeHtmlEntities(labTestLabelAttr)
        const autoValueMapSource = wrapper.getAttribute('data-auto-value-map-source')
        if (autoValueMapSource != null && String(autoValueMapSource).trim() !== '') {
          properties.autoValueMapSourceFieldId = decodeHtmlEntities(String(autoValueMapSource).trim())
        }
        const autoValueMapRulesAttr = wrapper.getAttribute('data-auto-value-map-rules')
        if (autoValueMapRulesAttr != null && String(autoValueMapRulesAttr).trim() !== '') {
          try {
            properties.autoValueMapRules = decodeURIComponent(autoValueMapRulesAttr)
          } catch {
            properties.autoValueMapRules = decodeHtmlEntities(autoValueMapRulesAttr)
          }
        }
        const terminologyCodingAttr = (wrapper.getAttribute('data-terminology-coding') || '').trim().toLowerCase()
        if (terminologyCodingAttr === 'meddra') properties.terminologyCoding = 'meddra'
        if (terminologyCodingAttr === 'whodd' || terminologyCodingAttr === 'whodrug')
          properties.terminologyCoding = 'whodd'

        if (controlType === 'select' && inputEl && inputEl.tagName.toLowerCase() === 'select') {
          const dataSource = inputEl.getAttribute('data-source')
          const csvValues = inputEl.getAttribute('data-csv-values')
          const multiple = inputEl.getAttribute('data-multiple')
          if (dataSource) properties.dataSource = dataSource
          if (csvValues) {
            properties.csvValues = csvValues
            const options = csvValues
              .split(',')
              .map(opt => decodeHtmlEntities(opt.trim()))
              .filter(opt => opt !== '')
              .map(opt => ({ value: opt, label: opt }))
            if (options.length > 0) properties.options = options
          } else {
            const options = []
            inputEl.querySelectorAll('option').forEach((optEl) => {
              const rawValue = optEl.getAttribute('value') || optEl.textContent
              options.push({
                value: decodeHtmlEntities(rawValue),
                label: optEl.textContent || optEl.getAttribute('value') || ''
              })
            })
            if (options.length > 0) {
              properties.options = options
              properties.csvValues = options.map(opt => typeof opt === 'string' ? opt : opt.label).join(', ')
            }
          }
          if (multiple !== null) properties.multiple = multiple === 'true'
        }

        if (controlType === 'radio') {
          const radioGroupEl = wrapper.querySelector('.radio-group')
          const csvValues = radioGroupEl ? radioGroupEl.getAttribute('data-csv-values') : null
          const alignment = radioGroupEl ? radioGroupEl.getAttribute('data-alignment') : null
          if (csvValues) {
            properties.csvValues = csvValues
            const options = csvValues
              .split(',')
              .map(opt => decodeHtmlEntities(opt.trim()))
              .filter(opt => opt !== '')
              .map(opt => ({ value: opt, label: opt }))
            if (options.length > 0) properties.options = options
          } else {
            const radioGroup = wrapper.querySelectorAll('input[type="radio"]')
            if (radioGroup.length > 0) {
              const options = []
              radioGroup.forEach((radioEl) => {
                const radioLabel = wrapper.querySelector(`label[for="${radioEl.getAttribute('id')}"]`)
                const rawValue = radioEl.getAttribute('value') || ''
                options.push({
                  value: decodeHtmlEntities(rawValue),
                  label: radioLabel ? radioLabel.textContent : rawValue,
                })
              })
              if (options.length > 0) {
                properties.options = options
                properties.csvValues = options.map(opt => opt.label).join(', ')
              }
            }
          }
          if (alignment) properties.alignment = alignment
        }

        if (controlType === 'checkbox') {
          const checkboxGroupEl = wrapper.querySelector('.checkbox-group')
          const csvValues = checkboxGroupEl ? checkboxGroupEl.getAttribute('data-csv-values') : null
          const alignment = checkboxGroupEl ? checkboxGroupEl.getAttribute('data-alignment') : null
          if (csvValues) {
            properties.csvValues = csvValues
            const options = csvValues
              .split(',')
              .map(opt => decodeHtmlEntities(opt.trim()))
              .filter(opt => opt !== '')
              .map(opt => ({ value: opt, label: opt }))
            if (options.length > 0) properties.options = options
          } else {
            const checkboxes = wrapper.querySelectorAll('input[type="checkbox"]')
            if (checkboxes.length > 1) {
              const options = []
              checkboxes.forEach((checkboxEl) => {
                const checkboxLabel = wrapper.querySelector(`label[for="${checkboxEl.getAttribute('id')}"]`)
                const rawValue = checkboxEl.getAttribute('value') || ''
                options.push({
                  value: decodeHtmlEntities(rawValue),
                  label: checkboxLabel ? checkboxLabel.textContent : rawValue,
                })
              })
              if (options.length > 0) {
                properties.options = options
                properties.csvValues = options.map(opt => opt.label).join(', ')
              }
            }
          }
          if (alignment) properties.alignment = alignment
        }

        Object.keys(properties).forEach(key => {
          if (properties[key] === undefined) delete properties[key]
        })

        controls.push({
          id: controlId,
          type: controlType,
          label: labelText,
          controlSize: controlSize,
          properties: properties
        })
      })

      const sectionTypeAttr = (sectionEl.getAttribute("data-section-type") || "").trim().toLowerCase()
      const labFacilityIdRaw = sectionEl.getAttribute("data-lab-facility-id") || ""
      const labFacilityLabelRaw = sectionEl.getAttribute("data-lab-facility-label") || ""

      const baseSection = {
        id: sectionId,
        name: sectionName,
        controls,
      }

      if (sectionTypeAttr === "lab") {
        sections.push({
          ...baseSection,
          sectionType: "lab",
          labBinding: {
            labFacilityId:
              labFacilityIdRaw.trim() !== "" ? decodeHtmlEntities(labFacilityIdRaw.trim()) : null,
            labFacilityLabel: decodeHtmlEntities(labFacilityLabelRaw.trim() || ""),
          },
        })
      } else if (sectionTypeAttr === "studycompletionstatus") {
        const statusCodeRaw = sectionEl.getAttribute("data-study-completion-status-code") || ""
        const statusKeyRaw = sectionEl.getAttribute("data-study-completion-status-key") || ""
        const statusLabelRaw = sectionEl.getAttribute("data-study-completion-status-label") || ""
        const statusCode = Number.parseInt(String(statusCodeRaw).trim(), 10)
        sections.push({
          ...baseSection,
          sectionType: "studyCompletionStatus",
          studyCompletionStatus: {
            statusCode: Number.isFinite(statusCode) ? statusCode : null,
            statusKey: decodeHtmlEntities(statusKeyRaw.trim()),
            statusLabel: decodeHtmlEntities(statusLabelRaw.trim() || sectionName),
          },
        })
      } else {
        sections.push(baseSection)
      }
    })

    return sections
  } catch (error) {
    console.error("Error parsing HTML content:", error)
    return []
  }
}
